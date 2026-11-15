"""Records and extremes: highest/lowest years and months, and how the latest year ranks."""
from typing import Any, Dict, List

import numpy as np
import pandas as pd

from app.analysis.trends import build_annual_series

TOP_YEARS = 3
TOP_MONTHS = 5
RANK_WINDOW = 5
RECENT_YEARS = 10


def _entries(labels: List[str], values: np.ndarray, order: np.ndarray, k: int) -> List[Dict[str, Any]]:
    return [{"label": labels[i], "value": float(values[i])} for i in order[:k]]


def compute_records(df: pd.DataFrame) -> Dict[str, Any]:
    obs = df.dropna(subset=["value"]).copy()
    obs["date"] = pd.to_datetime(obs["date"]).dt.to_period("M").dt.to_timestamp()
    obs = obs.groupby("date", as_index=False)["value"].mean().sort_values("date")
    result: Dict[str, Any] = {
        "n_years": 0,
        "highest_years": [],
        "lowest_years": [],
        "latest_year": None,
        "latest_value": None,
        "latest_rank_high": None,
        "record_high_years": [],
        "record_low_years": [],
        "highest_months": [],
        "lowest_months": [],
        "highest5_in_last_decade": 0,
        "lowest5_in_last_decade": 0,
    }

    if len(obs) > 0:
        month_vals = obs["value"].to_numpy(dtype=float)
        month_labels = [d.strftime("%b %Y") for d in obs["date"]]
        result["highest_months"] = _entries(month_labels, month_vals, np.argsort(-month_vals), TOP_MONTHS)
        result["lowest_months"] = _entries(month_labels, month_vals, np.argsort(month_vals), TOP_MONTHS)

    annual = build_annual_series(obs)
    n = len(annual)
    result["n_years"] = int(n)
    if n < 3:
        return result

    years = annual["date"].dt.year.to_numpy(dtype=int)
    vals = annual["value"].to_numpy(dtype=float)
    labels = [str(y) for y in years]
    high_order = np.argsort(-vals)
    low_order = np.argsort(vals)
    result["highest_years"] = _entries(labels, vals, high_order, TOP_YEARS)
    result["lowest_years"] = _entries(labels, vals, low_order, TOP_YEARS)

    result["latest_year"] = int(years[-1])
    result["latest_value"] = float(vals[-1])
    result["latest_rank_high"] = int(1 + np.sum(vals > vals[-1]))

    running_max, running_min = vals[0], vals[0]
    for year, v in zip(years[1:], vals[1:]):
        if v > running_max:
            result["record_high_years"].append(int(year))
            running_max = v
        if v < running_min:
            result["record_low_years"].append(int(year))
            running_min = v

    cutoff = years[-1] - RECENT_YEARS
    top_high = high_order[:RANK_WINDOW]
    top_low = low_order[:RANK_WINDOW]
    result["highest5_in_last_decade"] = int(np.sum(years[top_high] > cutoff))
    result["lowest5_in_last_decade"] = int(np.sum(years[top_low] > cutoff))
    return result
