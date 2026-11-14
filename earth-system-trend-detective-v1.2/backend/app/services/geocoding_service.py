from typing import List

import httpx
from fastapi import HTTPException

from app.models.schemas import LocationResult

GEOCODING_URL = "https://geocoding-api.open-meteo.com/v1/search"


class GeocodingService:
    @staticmethod
    async def search_locations(query: str) -> List[LocationResult]:
        params = {"name": query, "count": 10, "language": "en", "format": "json"}
        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                response = await client.get(GEOCODING_URL, params=params)
                response.raise_for_status()
                data = response.json()
            except (httpx.HTTPError, ValueError) as exc:
                raise HTTPException(status_code=502, detail=f"Geocoding service error: {exc}")

        results: List[LocationResult] = []
        for item in data.get("results") or []:
            lat, lon, name = item.get("latitude"), item.get("longitude"), item.get("name")
            if lat is None or lon is None or not name:
                continue
            results.append(
                LocationResult(
                    name=name,
                    country=item.get("country"),
                    admin1=item.get("admin1"),
                    lat=float(lat),
                    lon=float(lon),
                )
            )
        return results
