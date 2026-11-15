"""Smoke test: confirm every configured POWER parameter returns monthly data and
show the first year with real values (to verify each start_year).

Run from backend/:  python scripts/check_datasets.py
"""
import asyncio
import sys

sys.path.insert(0, ".")

from app.services.nasa_service import NasaPowerService, latest_complete_year  # noqa: E402


async def main() -> None:
    last = latest_complete_year()
    print(f"{'id':18s} {'code':20s} {'configured':>10s} {'first valid':>11s} {'valid/total':>12s}")
    for dataset_id, meta in NasaPowerService.DATASET_MAPPING.items():
        try:
            df = await NasaPowerService.fetch_time_series(
                dataset_id, 17.4, 78.5, meta["start_year"], last
            )
            valid = df.dropna(subset=["value"])
            first = int(valid["date"].dt.year.min()) if len(valid) else None
            flag = "OK  " if first == meta["start_year"] else "CHECK"
            print(
                f"{flag} {dataset_id:13s} {meta['nasa_variable']:20s} {meta['start_year']:>10d} "
                f"{str(first):>11s} {len(valid):>5d}/{len(df):<6d}"
            )
        except Exception as exc:
            print(f"FAIL {dataset_id:13s} {meta['nasa_variable']:20s} {exc}")


if __name__ == "__main__":
    asyncio.run(main())
