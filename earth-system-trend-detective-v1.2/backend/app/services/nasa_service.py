"""NASA POWER client: fetches monthly point data as a clean DataFrame."""
import asyncio
import logging
from datetime import date
from typing import Any, Dict

import httpx
import pandas as pd
from cachetools import TTLCache
from fastapi import HTTPException

from app.config import settings

logger = logging.getLogger(__name__)

FILL_VALUE = -999.0


def latest_complete_year() -> int:
    """POWER monthly data lags real time, so only complete past years are offered."""
    return date.today().year - 1


class NasaPowerService:
    """Authentic Earth-science data from the NASA POWER REST API."""

    DATASET_MAPPING: Dict[str, Dict[str, Any]] = {
        "temperature": {
            "name": "MERRA-2 2 m Surface Air Temperature",
            "nasa_variable": "T2M",
            "community": "RE",
            "unit": "°C",
            "start_year": 1981,
            "source": "NASA POWER (MERRA-2 reanalysis, NASA GMAO)",
            "limitation": "Reanalysis grid cell (~50 km) smooths local "
            "microclimates, especially in complex terrain.",
        },
        "precipitation": {
            "name": "MERRA-2 Bias-Corrected Precipitation",
            "nasa_variable": "PRECTOTCORR",
            "community": "RE",
            "unit": "mm/day",
            "start_year": 1981,
            "source": "NASA POWER (MERRA-2 corrected precipitation)",
            "limitation": "Bias-corrected reanalysis product; localized "
            "convective extremes may be smoothed.",
        },
        "soil_moisture": {
            "name": "MERRA-2 Root Zone Soil Wetness",
            "nasa_variable": "GWETROOT",
            "community": "RE",
            "unit": "fraction (0-1)",
            "start_year": 1981,
            "source": "NASA POWER (MERRA-2 land model)",
            "limitation": "Modeled root-zone wetness, not direct "
            "satellite radiometer soil moisture.",
        },
        "aerosol": {
            "name": "MERRA-2 Aerosol Optical Depth (550 nm)",
            "nasa_variable": "AOD_55",
            "community": "RE",
            "unit": "dimensionless",
            "start_year": 1981,
            "source": "NASA POWER (MERRA-2 aerosol reanalysis)",
            "limitation": "Assimilated aerosol product; higher uncertainty "
            "over bright snow and desert surfaces.",
        },
    }

    _cache: TTLCache = TTLCache(maxsize=256, ttl=settings.cache_ttl_seconds)

    @classmethod
    def get_meta(cls, dataset_id: str) -> Dict[str, Any]:
        if dataset_id not in cls.DATASET_MAPPING:
            raise HTTPException(status_code=400, detail=f"Unsupported dataset: {dataset_id}")
        return cls.DATASET_MAPPING[dataset_id]

    @classmethod
    def validate_window(cls, dataset_id: str, start_year: int, end_year: int) -> None:
        meta = cls.get_meta(dataset_id)
        last = latest_complete_year()
        if start_year < meta["start_year"] or end_year > last:
            raise HTTPException(
                status_code=422,
                detail=f"{meta['name']} is available for {meta['start_year']}-{last}.",
            )
        if start_year > end_year:
            raise HTTPException(status_code=422, detail="start_year is after end_year.")

    @staticmethod
    def parse_payload(payload: Dict[str, Any], variable: str) -> pd.DataFrame:
        """Convert a POWER monthly JSON payload to a DataFrame(date, value)."""
        try:
            series = payload["properties"]["parameter"][variable]
        except (KeyError, TypeError):
            raise HTTPException(
                status_code=502,
                detail="NASA POWER response did not contain the requested variable.",
            )
        header = payload.get("header") or {}
        fill = float(header.get("fill_value", FILL_VALUE))

        rows = []
        for key, raw in series.items():
            if len(key) != 6 or not key.isdigit():
                continue
            year, month = int(key[:4]), int(key[4:])
            if not 1 <= month <= 12:
                continue  # YYYY13 is POWER's annual mean, not a month
            value = None if raw is None else float(raw)
            if value is not None and abs(value - fill) < 1e-6:
                value = None  # sentinel becomes NaN, never zero
            rows.append({"date": pd.Timestamp(year=year, month=month, day=1), "value": value})

        if not rows:
            raise HTTPException(status_code=502, detail="NASA POWER returned no monthly records.")
        df = pd.DataFrame(rows).sort_values("date").reset_index(drop=True)
        df["value"] = pd.to_numeric(df["value"], errors="coerce")
        return df

    @staticmethod
    def _upstream_message(response: httpx.Response) -> str:
        try:
            body = response.json()
            messages = body.get("messages") or [body.get("message")]
            return "; ".join(str(m) for m in messages if m) or response.text[:200]
        except Exception:
            return response.text[:200]

    @classmethod
    async def _get_json(cls, url: str, params: Dict[str, Any]) -> Dict[str, Any]:
        last_error = "unknown error"
        async with httpx.AsyncClient(timeout=settings.nasa_timeout_seconds) as client:
            for attempt in range(2):
                try:
                    response = await client.get(url, params=params)
                    if response.status_code in (400, 422):
                        raise HTTPException(
                            status_code=422,
                            detail="NASA POWER rejected the request: "
                            + cls._upstream_message(response),
                        )
                    response.raise_for_status()
                    return response.json()
                except HTTPException:
                    raise
                except (httpx.TransportError, httpx.HTTPStatusError, ValueError) as exc:
                    last_error = f"{type(exc).__name__}: {exc}"
                    logger.warning("NASA POWER attempt %d failed: %s", attempt + 1, last_error)
                    if attempt == 0:
                        await asyncio.sleep(1.5)
        raise HTTPException(status_code=502, detail=f"NASA POWER API unavailable ({last_error}).")

    @classmethod
    async def fetch_time_series(
        cls, dataset_id: str, lat: float, lon: float, start_year: int, end_year: int
    ) -> pd.DataFrame:
        cls.validate_window(dataset_id, start_year, end_year)
        meta = cls.DATASET_MAPPING[dataset_id]

        key = (dataset_id, round(lat, 3), round(lon, 3), start_year, end_year)
        cached = cls._cache.get(key)
        if cached is not None:
            return cached.copy()

        params = {
            "parameters": meta["nasa_variable"],
            "community": meta["community"],
            "longitude": lon,
            "latitude": lat,
            "start": start_year,
            "end": end_year,
            "format": "JSON",
        }
        payload = await cls._get_json(f"{settings.nasa_power_base_url}/monthly/point", params)
        df = cls.parse_payload(payload, meta["nasa_variable"])
        cls._cache[key] = df
        return df.copy()
