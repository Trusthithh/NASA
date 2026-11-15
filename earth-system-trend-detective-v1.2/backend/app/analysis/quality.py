"""Transparent data-quality assessment of the monthly source series."""
from typing import Any, Dict

import pandas as pd

MAX_GOOD_GAP = 3
MAX_FAIR_GAP = 12


def assess_quality(df: pd.DataFrame, start_year: int, end_year: int, meta: Dict[str, Any]) -> Dict[str, Any]:
    index = pd.date_range(f"{start_year}-01-01", f"{end_year}-12-01", freq="MS")
    expected = int(len(index))

    # NASA responses should have one row per month. Collapse duplicates for the
    # coverage calculation while surfacing them as a separate quality warning.
    source = df.loc[:, ["date", "value"]].copy()
    source["date"] = (
        pd.to_datetime(source["date"], errors="coerce")
        .dt.to_period("M")
        .dt.to_timestamp()
    )
    source["value"] = pd.to_numeric(source["value"], errors="coerce")
    source = source.dropna(subset=["date"])
    duplicate_rows = int(source.duplicated(subset=["date"], keep="first").sum())
    monthly = source.groupby("date")["value"].mean().reindex(index)

    valid_mask = monthly.notna()
    valid = int(valid_mask.sum())
    missing = expected - valid
    coverage = 100.0 * valid / expected if expected else 0.0

    longest = run = 0
    for is_missing in (~valid_mask).to_numpy():
        run = run + 1 if is_missing else 0
        longest = max(longest, run)

    counts_by_year = valid_mask.groupby(valid_mask.index.year).sum()
    complete_years = int((counts_by_year == 12).sum())
    incomplete_years = [int(year) for year, count in counts_by_year.items() if count != 12]
    valid_pairs = int((valid_mask.iloc[:-1].to_numpy() & valid_mask.iloc[1:].to_numpy()).sum()) if expected > 1 else 0
    temporal_continuity = 100.0 * valid_pairs / (expected - 1) if expected > 1 else 100.0

    notes = []
    if missing == 0:
        notes.append(f"All {expected} months in the period have valid values.")
    else:
        notes.append(f"{missing} of {expected} months are missing ({100.0 - coverage:.1f}%).")
    if longest > MAX_GOOD_GAP:
        notes.append(f"The longest gap is {longest} consecutive months.")
    notes.append(
        f"Temporal continuity is {temporal_continuity:.1f}% of adjacent month-pairs with valid values on both sides."
    )
    if incomplete_years:
        preview = ", ".join(map(str, incomplete_years[:12]))
        suffix = " …" if len(incomplete_years) > 12 else ""
        notes.append(f"Incomplete calendar years (excluded from annual means): {preview}{suffix}.")
    if duplicate_rows:
        notes.append(
            f"{duplicate_rows} duplicate monthly record(s) were found; duplicate dates were averaged for quality scoring."
        )

    if coverage >= 98.0 and longest <= MAX_GOOD_GAP:
        level = "good"
    elif coverage >= 90.0 and longest <= MAX_FAIR_GAP:
        level = "fair"
    else:
        level = "poor"

    break_year = meta.get("source_break_year")
    source_break_years = [int(break_year)] if break_year and start_year < break_year <= end_year else []
    if source_break_years:
        notes.append(
            f"The underlying data source changes in {break_year}, which can introduce an artificial step in a long-term series."
        )
        if level == "good":
            level = "fair"

    present = monthly.dropna()
    if len(present) > 0 and float((present == 0).mean()) >= 0.9:
        notes.append("Over 90% of values are exactly zero, so trends here may have limited meaning.")
        if level == "good":
            level = "fair"
    if complete_years < 10:
        notes.append(f"Only {complete_years} complete years are available (10 or more is preferable).")
        if level == "good":
            level = "fair"
    if duplicate_rows:
        level = "poor" if duplicate_rows > max(1, int(expected * 0.01)) else ("fair" if level == "good" else level)

    return {
        "coverage_pct": round(coverage, 1),
        "valid_months": valid,
        "expected_months": expected,
        "longest_gap_months": int(longest),
        "complete_years": complete_years,
        "level": level,
        "notes": notes,
        "temporal_continuity_pct": round(temporal_continuity, 1),
        "duplicate_months": duplicate_rows,
        "incomplete_years": incomplete_years,
        "source_break_years": source_break_years,
    }
