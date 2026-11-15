"""Statistical trend engine.

Method summary
- Missing values are dropped (never zero-filled).
- Annual resolution: means of complete 12-month years only.
- Monthly resolution: monthly climatology is removed first, so the seasonal
  cycle cannot masquerade as (or hide) a trend.
- Significance: Hamed-Rao modified Mann-Kendall (serial-correlation corrected).
- Magnitude: Theil-Sen slope with 95% interval, plus OLS with a t-based interval.
- Slopes are always expressed per year on a real (decimal-year) time axis.
"""
from typing import Any, Dict, Optional, Tuple

import numpy as np
import pandas as pd
import pymannkendall as mk
from scipy import stats
from statsmodels.stats.diagnostic import acorr_ljungbox

ALPHA = 0.05
COMPLETE_YEAR_MONTHS = 12
MIN_ANNUAL_POINTS = 10
MIN_MONTHLY_POINTS = 60
MIN_CHANGE_SEGMENT = 10


class InsufficientDataError(ValueError):
    """Raised when a series is too short for a meaningful trend test."""


def decimal_year(dates: pd.Series) -> np.ndarray:
    return (dates.dt.year + (dates.dt.month - 1) / 12.0).to_numpy(dtype=float)


def build_annual_series(obs: pd.DataFrame) -> pd.DataFrame:
    # Collapse duplicate monthly timestamps before testing for exactly 12 months.
    clean = obs.dropna(subset=["value"]).copy()
    clean["date"] = pd.to_datetime(clean["date"]).dt.to_period("M").dt.to_timestamp()
    clean = clean.groupby("date", as_index=False)["value"].mean()
    grouped = clean.groupby(clean["date"].dt.year)["value"].agg(["mean", "count"])
    complete = grouped[grouped["count"] == COMPLETE_YEAR_MONTHS]
    return pd.DataFrame(
        {
            "date": pd.to_datetime([f"{int(y)}-07-01" for y in complete.index]),
            "value": complete["mean"].to_numpy(dtype=float),
        }
    )


def add_climatology(series: pd.DataFrame, resolution: str) -> None:
    if resolution == "monthly":
        clim = series.groupby(series["date"].dt.month)["value"].transform("mean")
    else:
        clim = pd.Series(series["value"].mean(), index=series.index)
    series["climatology"] = clim
    series["anomaly"] = series["value"] - clim


def autocorrelation_diagnostics(
    residuals: np.ndarray,
) -> Tuple[bool, Optional[float], Optional[float]]:
    """Return (detected, lag-1 autocorrelation, Ljung-Box p-value)."""
    n = len(residuals)
    if n < 8 or float(np.std(residuals)) < 1e-12:
        return False, None, None
    lag1 = float(np.corrcoef(residuals[:-1], residuals[1:])[0, 1])
    lag1_out = lag1 if np.isfinite(lag1) else None
    lag = int(min(12, max(1, n // 5)))
    try:
        table = acorr_ljungbox(residuals, lags=[lag], return_df=True)
        lb_p = float(table["lb_pvalue"].iloc[0])
    except Exception:
        return False, lag1_out, None
    return lb_p < ALPHA, lag1_out, lb_p


def pettitt_test(y: np.ndarray) -> Dict[str, float]:
    """Pettitt (1979) rank-based single change-point statistic.

    ``index`` is the final observation in the first segment. The commonly used
    exponential p-value is asymptotic and assumes independent observations; it
    is therefore reported as a nominal approximation for serially dependent
    environmental time series, not as an autocorrelation-corrected p-value.
    """
    values = np.asarray(y, dtype=float)
    if values.ndim != 1 or len(values) < 2 or not np.isfinite(values).all():
        raise ValueError("Pettitt test requires at least two finite one-dimensional values")
    n = len(values)
    # U_t = sum_j sign(x_t - x_j), accumulated through each candidate split.
    signs = np.sign(values[:, None] - values[None, :])
    u = np.cumsum(signs.sum(axis=1))
    magnitude = np.abs(u)
    index = int(np.argmax(magnitude))
    k = float(magnitude[index])
    p_value = float(min(1.0, 2.0 * np.exp(-6.0 * k**2 / (n**3 + n**2))))
    return {"index": index, "k": k, "p_value": p_value}


def detect_change_point(
    series: pd.DataFrame, y: np.ndarray, resolution: str = "annual"
) -> Optional[Dict[str, Any]]:
    """Detect a single shift, requiring at least ten observations per segment.

    Monthly results are dated to the detected month (not just the calendar
    year). Their Pettitt p-value remains nominal because monthly environmental
    observations can be serially dependent.
    """
    n = len(y)
    if n < 2 * MIN_CHANGE_SEGMENT:
        return None
    result = pettitt_test(y)
    first_new = result["index"] + 1
    if first_new < MIN_CHANGE_SEGMENT or n - first_new < MIN_CHANGE_SEGMENT:
        return None
    overall = float(series["value"].mean())
    before = series["anomaly"].iloc[:first_new]
    after = series["anomaly"].iloc[first_new:]
    level_before = overall + float(before.mean())
    level_after = overall + float(after.mean())
    date = series["date"].iloc[first_new]
    return {
        "change_date": date.strftime("%Y-%m-%d"),
        "change_year": int(date.year),
        "change_month": int(date.month),
        "resolution": resolution,
        "p_value": result["p_value"],
        "is_significant": bool(result["p_value"] < ALPHA),
        "level_before": level_before,
        "level_after": level_after,
        "shift": level_after - level_before,
        "n_before": int(len(before)),
        "n_after": int(len(after)),
        "method": "Pettitt test (nominal asymptotic p-value; serial dependence not corrected)",
    }


def _flat_statistics(n: int, resolution: str) -> Dict[str, Any]:
    return {
        "trend_direction": "stable",
        "sen_slope": 0.0,
        "sen_slope_ci": [0.0, 0.0],
        "ols_slope": 0.0,
        "ols_slope_ci": [0.0, 0.0],
        "p_value": 1.0,
        "is_significant": False,
        "autocorrelation_detected": False,
        "lag1_autocorrelation": None,
        "ljung_box_p_value": None,
        "test_used": "None (series has no variability after seasonal adjustment)",
        "n_observations": n,
        "resolution": resolution,
    }


def _fit(x: np.ndarray, y: np.ndarray, resolution: str) -> Tuple[Dict[str, Any], float, float]:
    sen = stats.theilslopes(y, x, alpha=0.95)
    sen_slope, sen_intercept, sen_low, sen_high = (float(v) for v in sen)

    ols = stats.linregress(x, y)
    t_crit = float(stats.t.ppf(0.975, len(y) - 2))
    ols_ci = [
        float(ols.slope - t_crit * ols.stderr),
        float(ols.slope + t_crit * ols.stderr),
    ]

    try:
        result = mk.hamed_rao_modification_test(y, alpha=ALPHA)
        test_used = "Hamed-Rao modified Mann-Kendall"
    except Exception:
        result = mk.original_test(y, alpha=ALPHA)
        test_used = "Mann-Kendall (original; Hamed-Rao could not be computed)"

    p_value = float(result.p)
    is_significant = p_value < ALPHA
    if result.trend == "increasing":
        direction = "increasing"
    elif result.trend == "decreasing":
        direction = "decreasing"
    else:
        direction = "stable"

    residuals = y - (sen_intercept + sen_slope * x)
    detected, lag1, lb_p = autocorrelation_diagnostics(residuals)

    statistics = {
        "trend_direction": direction,
        "sen_slope": sen_slope,
        "sen_slope_ci": [sen_low, sen_high],
        "ols_slope": float(ols.slope),
        "ols_slope_ci": ols_ci,
        "p_value": p_value,
        "is_significant": bool(is_significant),
        "autocorrelation_detected": bool(detected),
        "lag1_autocorrelation": lag1,
        "ljung_box_p_value": lb_p,
        "test_used": test_used,
        "n_observations": int(len(y)),
        "resolution": resolution,
    }
    return statistics, sen_slope, sen_intercept


def compute_trend_analysis(df: pd.DataFrame, resolution: str = "annual") -> Dict[str, Any]:
    """Analyse a DataFrame(date, value) and return statistics + processed series."""
    if resolution not in ("annual", "monthly"):
        raise ValueError("resolution must be 'annual' or 'monthly'")

    obs = df.dropna(subset=["value"]).copy()
    obs["date"] = pd.to_datetime(obs["date"]).dt.to_period("M").dt.to_timestamp()
    obs = (
        obs.groupby("date", as_index=False)["value"]
        .mean()
        .sort_values("date")
        .reset_index(drop=True)
    )

    if resolution == "annual":
        series = build_annual_series(obs)
        minimum, noun = MIN_ANNUAL_POINTS, "complete years"
    else:
        series = obs[["date", "value"]].copy()
        minimum, noun = MIN_MONTHLY_POINTS, "monthly observations"

    if len(series) < minimum:
        raise InsufficientDataError(
            f"Only {len(series)} {noun} available; at least {minimum} are required "
            f"for {resolution} trend analysis. Choose a longer period."
        )

    series = series.reset_index(drop=True)
    add_climatology(series, resolution)
    x = decimal_year(series["date"])
    y = series["anomaly"].to_numpy(dtype=float)

    scale = max(1.0, float(np.abs(series["value"]).max()))
    if float(np.ptp(y)) < 1e-9 * scale:
        statistics, slope, intercept = _flat_statistics(len(series), resolution), 0.0, 0.0
        change_point = None
    else:
        statistics, slope, intercept = _fit(x, y, resolution)
        change_point = detect_change_point(series, y, resolution)

    series["trend_value"] = series["climatology"] + intercept + slope * x
    processed = series[["date", "value", "trend_value", "anomaly"]].copy()
    return {"statistics": statistics, "processed_df": processed, "change_point": change_point}
