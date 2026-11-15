import asyncio
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd
from scipy import stats

from app.analysis.compare import compare_series
from app.analysis.correlation import correlate, interpret
from app.analysis.quality import assess_quality
from app.analysis.records import compute_records
from app.analysis.trends import InsufficientDataError, compute_trend_analysis, decimal_year
from app.models.schemas import (
    AnalysisRequest,
    ChangePointResult,
    CompareRequest,
    CompareResponse,
    CompareSummary,
    CorrelationPoint,
    CorrelationRequest,
    CorrelationResponse,
    DataQuality,
    InvestigationResponse,
    RecordsResult,
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
    meta: Dict[str, Any],
    place: str,
    req: AnalysisRequest,
    st: StatisticalResult,
    cp: Optional[ChangePointResult],
    rec: RecordsResult,
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

    if cp is not None:
        if cp.is_significant:
            findings.append(
                f"A nominally significant Pettitt step change was detected at {cp.change_date} "
                f"(asymptotic p = {_fmt_p(cp.p_value)}, not corrected for serial dependence): "
                f"the average level moved from "
                f"{cp.level_before:.3f} to {cp.level_after:.3f} {unit} ({cp.shift:+.3f})."
            )
        else:
            findings.append(
                f"No nominally significant Pettitt change point was detected (asymptotic p = "
                f"{_fmt_p(cp.p_value)})."
            )

    if rec.highest_years and rec.lowest_years:
        findings.append(
            f"Highest annual value: {rec.highest_years[0].value:.3f} {unit} in "
            f"{rec.highest_years[0].label}; lowest: {rec.lowest_years[0].value:.3f} {unit} in "
            f"{rec.lowest_years[0].label}."
        )
    if rec.latest_year is not None and rec.latest_rank_high is not None:
        findings.append(
            f"The latest complete year ({rec.latest_year}) ranks {rec.latest_rank_high} of "
            f"{rec.n_years} for the highest value (1 = highest)."
        )

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
        "The Pettitt change-point p-value is an asymptotic approximation that assumes independent observations; serial correlation can inflate false detections. Treat it as exploratory, not autocorrelation-corrected.",
    ]
    if st.resolution == "annual":
        notes.append("Annual means use only years with all 12 months valid.")
    else:
        notes.append("Monthly values are analysed as anomalies from each calendar month's mean.")
    return notes


def _num(value: Any) -> Any:
    return None if pd.isna(value) else float(value)


async def _analyse(
    dataset_id: str, lat: float, lon: float, start: int, end: int, resolution: str
) -> Tuple[Dict[str, Any], pd.DataFrame, Dict[str, Any]]:
    meta = NasaPowerService.get_meta(dataset_id)
    df = await NasaPowerService.fetch_time_series(dataset_id, lat, lon, start, end)
    return meta, df, compute_trend_analysis(df, resolution)


async def _labelled(label: str, req: AnalysisRequest) -> InvestigationResponse:
    try:
        return await AnalysisService.run_investigation(req)
    except InsufficientDataError as exc:
        raise InsufficientDataError(f"{label}: {exc}") from exc


class AnalysisService:
    @staticmethod
    async def run_investigation(req: AnalysisRequest) -> InvestigationResponse:
        meta, df, analysis = await _analyse(
            req.dataset_id, req.lat, req.lon, req.start_year, req.end_year, req.temporal_resolution
        )
        statistics = StatisticalResult(**analysis["statistics"])
        change_point = ChangePointResult(**analysis["change_point"]) if analysis["change_point"] else None
        records = RecordsResult(**compute_records(df))
        quality = DataQuality(**assess_quality(df, req.start_year, req.end_year, meta))
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
            key_findings=build_findings(meta, place, req, statistics, change_point, records),
            statistics=statistics,
            change_point=change_point,
            records=records,
            data_quality=quality,
            time_series=points,
            seasonal_insights=build_seasonal_insights(df, req.lat),
            limitations=build_limitations(meta, statistics),
        )

    @staticmethod
    async def run_comparison(req: CompareRequest) -> CompareResponse:
        def make(place) -> AnalysisRequest:
            return AnalysisRequest(
                dataset_id=req.dataset_id,
                lat=place.lat,
                lon=place.lon,
                start_year=req.start_year,
                end_year=req.end_year,
                temporal_resolution=req.temporal_resolution,
                location_name=place.name or f"{place.lat:.2f}°, {place.lon:.2f}°",
            )

        a, b = await asyncio.gather(
            _labelled("Place A", make(req.place_a)), _labelled("Place B", make(req.place_b))
        )

        def pack(r: InvestigationResponse) -> Dict[str, Any]:
            return {
                "name": r.location_name,
                "sen_slope": r.statistics.sen_slope,
                "sen_slope_ci": r.statistics.sen_slope_ci,
                "is_significant": r.statistics.is_significant,
                "dates": [p.date for p in r.time_series],
                "anomalies": [p.anomaly for p in r.time_series],
            }

        summary = compare_series(pack(a), pack(b), a.unit)
        return CompareResponse(a=a, b=b, comparison=CompareSummary(**summary))

    @staticmethod
    async def run_correlation(req: CorrelationRequest) -> CorrelationResponse:
        if req.dataset_x == req.dataset_y:
            raise InsufficientDataError("Choose two different variables to correlate.")
        (mx, dfx, ax), (my, dfy, ay) = await asyncio.gather(
            _analyse(req.dataset_x, req.lat, req.lon, req.start_year, req.end_year, req.temporal_resolution),
            _analyse(req.dataset_y, req.lat, req.lon, req.start_year, req.end_year, req.temporal_resolution),
        )
        px = ax["processed_df"][["date", "anomaly"]].rename(columns={"anomaly": "x"})
        py = ay["processed_df"][["date", "anomaly"]].rename(columns={"anomaly": "y"})
        merged = px.merge(py, on="date", how="inner").sort_values("date").reset_index(drop=True)
        result = correlate(
            merged["x"].to_numpy(dtype=float),
            merged["y"].to_numpy(dtype=float),
            decimal_year(merged["date"]),
        )

        place = req.location_name or f"{req.lat:.2f}°, {req.lon:.2f}°"
        return CorrelationResponse(
            location_name=place,
            lat=req.lat,
            lon=req.lon,
            x_name=mx["name"],
            x_unit=mx["unit"],
            y_name=my["name"],
            y_unit=my["unit"],
            time_period=f"{req.start_year}-{req.end_year}",
            resolution=req.temporal_resolution,
            interpretation=interpret(result, mx["name"], my["name"], req.temporal_resolution),
            points=[
                CorrelationPoint(date=row.date.strftime("%Y-%m-%d"), x=float(row.x), y=float(row.y))
                for row in merged.itertuples(index=False)
            ],
            limitations=[
                "Both series are analysed as anomalies (deseasonalised, or annual means), so "
                "the seasonal cycle cannot create a correlation.",
                "Reanalysis variables are produced by the same model, so some relationships "
                "partly reflect how the model links them.",
                mx["limitation"],
                my["limitation"],
            ],
            quality_x=DataQuality(**assess_quality(dfx, req.start_year, req.end_year, mx)),
            quality_y=DataQuality(**assess_quality(dfy, req.start_year, req.end_year, my)),
            **result,
        )
