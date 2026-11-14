"""Smoke test: confirm every configured POWER parameter returns monthly data.

Run from backend/:  python scripts/check_datasets.py
"""
import asyncio
import sys

sys.path.insert(0, ".")

from app.services.nasa_service import NasaPowerService  # noqa: E402


async def main() -> None:
    for dataset_id, meta in NasaPowerService.DATASET_MAPPING.items():
        try:
            df = await NasaPowerService.fetch_time_series(dataset_id, 17.4, 78.5, 1990, 2020)
            valid = int(df["value"].notna().sum())
            print(f"OK    {dataset_id:14s} {meta['nasa_variable']:12s} {valid}/{len(df)} valid")
        except Exception as exc:
            print(f"FAIL  {dataset_id:14s} {meta['nasa_variable']:12s} {exc}")


if __name__ == "__main__":
    asyncio.run(main())
