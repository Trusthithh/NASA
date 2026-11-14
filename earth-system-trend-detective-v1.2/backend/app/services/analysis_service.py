from typing import Any, Dict, List

import pandas as pd
from scipy import stats

from app.analysis.trends import compute_trend_analysis
from app.models.schemas import (
    AnalysisRequest,
    InvestigationResponse,
    SeasonalInsight,
    StatisticalResult,
    TimeSeriesPoint,
)
from app.services.nasa_service import NasaPowerService

MIN_SEASON_YEARS = 10
NORTH_SEASONS = {
    12: "Winter", 1: "Winter", 2: "Winter",
    3: "Spring", 4: "Spring", 5: "Spring",
    6: "Summer", 7: "Summer", 8: "Summer",
    9: "Autumn", 10: "Autumn", 11: "Autumn",
}  # fmt: skip
SOUTH_SWAP = {"Winter": "Summer", "Summer": "Winter", "Spring": "Autumn", "Autumn": "Spring"}


def season_for(month: int, lat: float) -> str:
    season = NORTH_SEASONS[month]
    return SOUTH_SWAP[season] if lat < 0 else season


def build_seasonal_insights(df: pd.DataFrame, lat: float) -> List[SeasonalInsight]:
    obs = df.dropna(subset=["value"]).copy()
    if obs.empty:
        return []
    obs["season"] = [season_for(int(m), lat) for m in obs["date"].dt.month]
    # December belongs to the winter-season block that ends the following February.
    obs["season_year"] = obs["date"].dt.year + (obs["date"].dt.month == 12).astype(int)

    insights: List[SeasonalInsight] = []
    for season in ("Winter", "Spring", "Summer", "Autumn"):
        per_year = obs[obs["season"] == season].groupby("season_year")["value"].agg(["mean", "count"])
        per_year = per_year[per_year["count"] == 3]
        if per_year.empty:
            continue
        trend = None
        if len(per_year) >= MIN_SEASON_YEARS:
            slope = stats.theilslopes(
                per_year["mean"].to_numpy(dtype=float),
                per_year.index.to_numpy(dtype=float),
            )[0]
            trend = float(slope) * 10.0
        insights.append(
            SeasonalInsight(
                season=season,
                mean_value=float(per_year["mean"].mean()),
                trend_per_decade=trend,
                n_years=int(len(per_year)),
            )
        )
    return insights


def _fmt_p(p: float) -> str:
    return "< 0.0001" if p < 1e-4 else f"{p:.4f}"


def build_findings(
    meta: Dict[str, Any], place: str, req: AnalysisRequest, st: StatisticalResult
) -> List[str]:
    unit = meta["unit"]
    per_decade = st.sen_slope * 10.0
    low, high = (c * 10.0 for c in st.sen_slope_ci)
    basis = (
        "annual means of complete years"
        if st.resolution == "annual"
        else "deseasonalised monthly anomalies"
    )
    if st.is_significant:
        headline = f"a statistically significant {st.trend_direction} trend"
    else:
        headline = "no statistically significant trend"

    findings = [
        f"Over {req.start_year}-{req.end_year}, {meta['name']} at {place} shows {headline}.",
        f"Theil-Sen estimate: {per_decade:+.3f} {unit} per decade "
        f"(95% interval {low:+.3f} to {high:+.3f}), based on {basis} (n = {st.n_observations}).",
    ]
    if st.is_significant:
        findings.append(
            f"{st.test_used}: p = {_fmt_p(st.p_value)}, below the 0.05 significance threshold."
        )
    else:
        findings.append(
            f"{st.test_used}: p = {_fmt_p(st.p_value)}. The data provide insufficient "
            "evidence to reject the null hypothesis of no trend; this does not prove "
            "that no environmental change occurred."
        )
    if st.autocorrelation_detected:
        findings.append(
            "Serial correlation was detected in the residuals (Ljung-Box test); the "
            "Hamed-Rao correction adjusts the p-value for it."
        )
    else:
        findings.append("No significant serial correlation was detected in the residuals.")
    findings.append(f"Dataset provenance: {meta['source']}, nearest grid cell to the chosen point.")
    findings.append(
        "Statistical significance describes the observed record; it does not by itself "
        "establish the cause of a trend."
    )
    return findings


def build_limitations(meta: Dict[str, Any], st: StatisticalResult) -> List[str]:
    notes = [
        meta["limitation"],
        "Values are reanalysis-based gridded estimates (~0.5 x 0.625 degrees), "
        "not station measurements.",
        "Confidence intervals assume independent errors and may be somewhat narrow "
        "when serial correlation is present.",
    ]
    if st.resolution == "annual":
        notes.append("Annual means use only years with all 12 months valid.")
    else:
        notes.append("Monthly values are analysed as anomalies from each calendar month's mean.")
    return notes


def _num(value: Any) -> Any:
    return None if pd.isna(value) else float(value)


class AnalysisService:
    @staticmethod
    async def run_investigation(req: AnalysisRequest) -> InvestigationResponse:
        meta = NasaPowerService.get_meta(req.dataset_id)
        df = await NasaPowerService.fetch_time_series(
            req.dataset_id, req.lat, req.lon, req.start_year, req.end_year
        )
        analysis = compute_trend_analysis(df, req.temporal_resolution)
        statistics = StatisticalResult(**analysis["statistics"])
        processed: pd.DataFrame = analysis["processed_df"]

        points = [
            TimeSeriesPoint(
                date=row.date.strftime("%Y-%m-%d"),
                value=_num(row.value),
                trend_value=_num(row.trend_value),
                anomaly=_num(row.anomaly),
            )
            for row in processed.itertuples(index=False)
        ]

        place = req.location_name or f"{req.lat:.2f}°, {req.lon:.2f}°"
        return InvestigationResponse(
            location_name=place,
            lat=req.lat,
            lon=req.lon,
            dataset_id=req.dataset_id,
            variable_name=meta["name"],
            unit=meta["unit"],
            time_period=f"{req.start_year}-{req.end_year}",
            data_source=meta["source"],
            key_findings=build_findings(meta, place, req, statistics),
            statistics=statistics,
            time_series=points,
            seasonal_insights=build_seasonal_insights(df, req.lat),
            limitations=build_limitations(meta, statistics),
        )
