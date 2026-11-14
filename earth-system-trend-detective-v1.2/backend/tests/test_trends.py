import numpy as np
import pandas as pd
import pytest

from app.analysis.trends import InsufficientDataError, compute_trend_analysis


def make_monthly(start=1990, end=2020, slope=0.0, noise=0.2, seed=1):
    rng = np.random.default_rng(seed)
    dates = pd.date_range(f"{start}-01-01", f"{end}-12-01", freq="MS")
    t = np.arange(len(dates)) / 12.0
    seasonal = 10.0 * np.sin(2 * np.pi * (dates.month - 1) / 12.0)
    values = 15.0 + seasonal + slope * t + rng.normal(0, noise, len(dates))
    return pd.DataFrame({"date": dates, "value": values})


def test_recovers_known_annual_trend():
    out = compute_trend_analysis(make_monthly(slope=0.03), "annual")
    st = out["statistics"]
    assert st["trend_direction"] == "increasing"
    assert st["is_significant"] is True
    assert abs(st["sen_slope"] - 0.03) < 0.01
    assert st["sen_slope_ci"][0] < st["sen_slope"] < st["sen_slope_ci"][1]


def test_recovers_known_monthly_trend():
    out = compute_trend_analysis(make_monthly(slope=-0.05), "monthly")
    st = out["statistics"]
    assert st["trend_direction"] == "decreasing"
    assert abs(st["sen_slope"] + 0.05) < 0.01


def test_pure_seasonality_is_not_a_trend():
    out = compute_trend_analysis(make_monthly(slope=0.0), "monthly")
    assert out["statistics"]["is_significant"] is False


def test_missing_values_are_not_zero_filled():
    df = make_monthly(slope=0.0)
    df.loc[df.index[::7], "value"] = np.nan
    out = compute_trend_analysis(df, "monthly")
    assert out["processed_df"]["value"].notna().all()
    assert out["processed_df"]["value"].min() > 0.0


def test_incomplete_years_are_excluded_from_annual_means():
    df = make_monthly(1990, 2005)
    df = df[~((df["date"].dt.year == 1995) & (df["date"].dt.month == 3))]
    out = compute_trend_analysis(df, "annual")
    assert 1995 not in out["processed_df"]["date"].dt.year.values


def test_short_series_is_rejected():
    with pytest.raises(InsufficientDataError):
        compute_trend_analysis(make_monthly(2015, 2019), "annual")


def test_constant_series_is_stable():
    df = make_monthly(noise=0.0, slope=0.0)
    out = compute_trend_analysis(df, "monthly")
    assert out["statistics"]["trend_direction"] == "stable"
    assert out["statistics"]["p_value"] == 1.0
