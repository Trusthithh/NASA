import numpy as np
import pandas as pd
import pytest

from app.analysis.compare import compare_series
from app.analysis.correlation import correlate, effective_n, interpret
from app.analysis.quality import assess_quality
from app.analysis.records import compute_records
from app.analysis.trends import (
    InsufficientDataError,
    compute_trend_analysis,
    decimal_year,
    pettitt_test,
)


def monthly(start=1990, end=2020, slope=0.0, step_year=None, step=0.0, noise=0.2, seed=1):
    rng = np.random.default_rng(seed)
    dates = pd.date_range(f"{start}-01-01", f"{end}-12-01", freq="MS")
    t = np.arange(len(dates)) / 12.0
    values = 15.0 + 8.0 * np.sin(2 * np.pi * (dates.month - 1) / 12.0) + slope * t
    values = values + rng.normal(0, noise, len(dates))
    if step_year is not None:
        values = values + np.where(dates.year >= step_year, step, 0.0)
    return pd.DataFrame({"date": dates, "value": values})


# ---------- change point ----------
def test_pettitt_finds_a_known_step():
    rng = np.random.default_rng(3)
    y = np.concatenate([rng.normal(0, 0.3, 20), rng.normal(2.0, 0.3, 20)])
    res = pettitt_test(y)
    assert abs(res["index"] - 19) <= 2
    assert res["p_value"] < 0.05


def test_pettitt_ignores_pure_noise():
    y = np.random.default_rng(5).normal(0, 1, 40)
    assert pettitt_test(y)["p_value"] > 0.05


def test_change_point_is_reported_in_the_analysis():
    out = compute_trend_analysis(monthly(step_year=2005, step=2.0), "annual")
    cp = out["change_point"]
    assert cp["is_significant"] is True
    assert abs(cp["change_year"] - 2005) <= 2
    assert cp["shift"] > 1.5
    assert cp["n_before"] + cp["n_after"] == out["statistics"]["n_observations"]


# ---------- records ----------
def test_records_find_extremes_and_rank():
    df = monthly(1990, 2010, slope=0.1)
    rec = compute_records(df)
    assert rec["n_years"] == 21
    assert rec["highest_years"][0]["label"] == "2010"
    assert rec["lowest_years"][0]["label"] == "1990"
    assert rec["latest_year"] == 2010 and rec["latest_rank_high"] == 1
    assert rec["highest5_in_last_decade"] >= 4
    assert len(rec["highest_months"]) == 5 and len(rec["lowest_months"]) == 5


def test_records_handle_short_data():
    rec = compute_records(monthly(2000, 2001))
    assert rec["highest_years"] == [] and rec["n_years"] == 2


# ---------- data quality ----------
def test_quality_good_for_complete_data():
    df = monthly(1990, 2020)
    q = assess_quality(df, 1990, 2020, {})
    assert q["level"] == "good" and q["coverage_pct"] == 100.0


def test_quality_penalises_gaps_and_source_breaks():
    df = monthly(1990, 2020)
    df.loc[df.index[100:120], "value"] = np.nan  # 20-month gap
    q = assess_quality(df, 1990, 2020, {})
    assert q["longest_gap_months"] == 20 and q["level"] in ("fair", "poor")
    q2 = assess_quality(monthly(1990, 2020), 1990, 2020, {"source_break_year": 2001})
    assert q2["level"] == "fair" and any("2001" in n for n in q2["notes"])


def test_quality_flags_mostly_zero_series():
    df = monthly(1990, 2020)
    df["value"] = 0.0
    q = assess_quality(df, 1990, 2020, {})
    assert q["level"] == "fair" and any("zero" in n for n in q["notes"])


# ---------- correlation ----------
def _t(n):
    return np.arange(n, dtype=float)


def test_correlated_series_have_high_r():
    rng = np.random.default_rng(2)
    x = rng.normal(0, 1, 40)
    y = 0.9 * x + rng.normal(0, 0.3, 40)
    res = correlate(x, y, _t(40))
    assert res["pearson_r"] > 0.8 and res["detrended_r"] > 0.7


def test_shared_trend_is_exposed_by_detrending():
    rng = np.random.default_rng(4)
    t = _t(40)
    x = 0.1 * t + rng.normal(0, 0.2, 40)
    y = 0.1 * t + rng.normal(0, 0.2, 40)
    res = correlate(x, y, t)
    assert res["pearson_r"] > 0.9
    assert abs(res["detrended_r"]) < 0.5
    assert any("shared long-term trends" in line for line in interpret(res, "X", "Y", "annual"))


def test_effective_n_shrinks_with_autocorrelation():
    assert effective_n(40, 0.6, 0.6) < 40
    assert effective_n(40, -0.2, 0.5) == 40.0


def test_constant_variable_is_rejected():
    with pytest.raises(InsufficientDataError):
        correlate(np.zeros(20), np.arange(20, dtype=float), _t(20))


def test_decimal_year_axis():
    dates = pd.Series(pd.to_datetime(["2000-01-01", "2000-07-01"]))
    assert list(decimal_year(dates)) == [2000.0, 2000.5]


# ---------- compare ----------
def _place(name, slope, ci, sig, anomalies):
    dates = [f"{2000 + i}-07-01" for i in range(len(anomalies))]
    return {"name": name, "sen_slope": slope, "sen_slope_ci": ci, "is_significant": sig,
            "dates": dates, "anomalies": anomalies}


def test_compare_detects_non_overlapping_slopes():
    rng = np.random.default_rng(8)
    an = list(rng.normal(0, 1, 20))
    a = _place("A", 0.05, [0.03, 0.07], True, an)
    b = _place("B", 0.01, [0.00, 0.02], False, an)
    out = compare_series(a, b, "degC")
    assert out["ci_overlap"] is False
    assert out["slope_difference_per_decade"] == pytest.approx(0.4)
    assert out["anomaly_correlation"] == pytest.approx(1.0)
    assert out["n_overlap"] == 20


def test_compare_overlapping_intervals_and_short_overlap():
    a = _place("A", 0.05, [0.00, 0.10], True, [0.1, 0.2, 0.3])
    b = _place("B", 0.04, [0.01, 0.08], True, [0.3, 0.2, 0.1])
    out = compare_series(a, b, "degC")
    assert out["ci_overlap"] is True and out["anomaly_correlation"] is None


def test_pettitt_monthly_result_reports_exact_month():
    rng = np.random.default_rng(42)
    dates = pd.date_range("1990-01-01", "2019-12-01", freq="MS")
    t = np.arange(len(dates)) / 12
    values = 12 + 5 * np.sin(2 * np.pi * (dates.month - 1) / 12) + 0.01 * t
    values = values + np.where(dates >= pd.Timestamp("2005-04-01"), 2.5, 0)
    values += rng.normal(0, 0.15, len(dates))
    out = compute_trend_analysis(pd.DataFrame({"date": dates, "value": values}), "monthly")
    cp = out["change_point"]
    assert cp is not None
    assert cp["resolution"] == "monthly"
    assert cp["change_date"].startswith("2005-")
    assert 1 <= cp["change_month"] <= 12
    assert cp["n_before"] >= 10 and cp["n_after"] >= 10
    assert "serial dependence not corrected" in cp["method"]


def test_change_point_rejects_edge_split_with_too_short_segment():
    values = np.r_[np.zeros(3), np.ones(37)]
    from app.analysis.trends import detect_change_point
    dates = pd.date_range("2000-01-01", periods=40, freq="MS")
    series = pd.DataFrame({"date": dates, "value": values, "anomaly": values})
    assert detect_change_point(series, values, "monthly") is None


def test_quality_reports_missing_years_duplicates_and_temporal_continuity():
    df = monthly(2000, 2004)
    df = df[~df["date"].dt.year.eq(2002)]
    df = pd.concat([df, df.iloc[[0]]], ignore_index=True)
    quality = assess_quality(df, 2000, 2004, {})
    assert 2002 in quality["incomplete_years"]
    assert quality["duplicate_months"] == 1
    assert quality["temporal_continuity_pct"] < 100


def test_quality_reports_source_discontinuity_separately():
    quality = assess_quality(monthly(1990, 2010), 1990, 2010, {"source_break_year": 2001})
    assert quality["source_break_years"] == [2001]
    assert any("source changes" in note for note in quality["notes"])


def test_effective_n_is_bounded_for_strong_positive_autocorrelation():
    assert 3 <= effective_n(100, 0.95, 0.95) < 10
    assert effective_n(100, -0.9, 0.9) == 100.0


def test_duplicate_months_are_aggregated_before_annual_completeness_check():
    df = monthly(1990, 2001)
    df = pd.concat([df, df.iloc[[0]]], ignore_index=True)
    out = compute_trend_analysis(df, "annual")
    assert out["statistics"]["n_observations"] == 12


def test_missing_whole_year_is_excluded_from_annual_series():
    df = monthly(1990, 2005)
    df = df[~df["date"].dt.year.eq(1998)]
    out = compute_trend_analysis(df, "annual")
    assert 1998 not in out["processed_df"]["date"].dt.year.to_numpy()


def test_constant_monthly_series_has_no_change_point():
    df = monthly(1990, 2020, noise=0.0, slope=0.0)
    df["value"] = 5.0
    out = compute_trend_analysis(df, "monthly")
    assert out["change_point"] is None


def test_edge_missingness_is_not_zero_filled():
    df = monthly(1990, 2020)
    df.loc[df.index[:6], "value"] = np.nan
    df.loc[df.index[-6:], "value"] = np.nan
    out = compute_trend_analysis(df, "monthly")
    assert out["processed_df"]["value"].notna().all()
    assert out["processed_df"]["value"].min() > 0


def test_correlate_detects_strong_serial_dependence_in_effective_sample_size():
    rng = np.random.default_rng(123)
    n = 240
    x = np.zeros(n)
    y = np.zeros(n)
    for i in range(1, n):
        x[i] = 0.92 * x[i - 1] + rng.normal()
        y[i] = 0.90 * y[i - 1] + rng.normal()
    result = correlate(x, y, _t(n))
    assert result["lag1_x"] > 0.75
    assert result["lag1_y"] > 0.75
    assert result["n_effective"] < result["n"] / 5


def test_records_do_not_duplicate_months_in_extremes():
    df = monthly(2000, 2002)
    df = pd.concat([df, df.iloc[[0]]], ignore_index=True)
    records = compute_records(df)
    assert len(records["highest_months"]) == 5
    assert len({entry["label"] for entry in records["highest_months"]}) == 5


def test_ai_numeric_claim_guard_rejects_unverified_values():
    from app.services.ai_service import _numeric_claims_are_grounded
    verified = "Trend slope 0.12345 per year, p = 0.0040, period 1990-2020."
    assert _numeric_claims_are_grounded("The slope is 0.123 and p is 0.004.", verified)
    assert not _numeric_claims_are_grounded("The slope is 0.123 and warming is 2.7 degrees.", verified)
    assert not _numeric_claims_are_grounded("The measured slope is 0.0.", verified)
    assert _numeric_claims_are_grounded("The trend covers 1990 to 2020.", verified)
