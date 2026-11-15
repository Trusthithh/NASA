from typing import List, Literal, Optional

from pydantic import BaseModel, Field, model_validator

Resolution = Literal["annual", "monthly"]


class LocationResult(BaseModel):
    name: str
    country: Optional[str] = None
    admin1: Optional[str] = None
    lat: float
    lon: float


class DatasetInfo(BaseModel):
    id: str
    name: str
    category: str
    variable: str
    unit: str
    spatial_resolution: str
    temporal_resolution: str
    start_year: int
    end_year: int
    description: str
    limitation: str


class WindowRequest(BaseModel):
    start_year: int = Field(..., ge=1981, le=2100)
    end_year: int = Field(..., ge=1981, le=2100)
    temporal_resolution: Resolution = "annual"

    @model_validator(mode="after")
    def check_year_order(self) -> "WindowRequest":
        if self.start_year > self.end_year:
            raise ValueError("start_year must not be later than end_year")
        return self


class AnalysisRequest(WindowRequest):
    dataset_id: str = Field(..., description="Dataset id, e.g. skin_temperature")
    lat: float = Field(..., ge=-90.0, le=90.0)
    lon: float = Field(..., ge=-180.0, le=180.0)
    location_name: Optional[str] = Field(None, max_length=120)


class PlaceInput(BaseModel):
    lat: float = Field(..., ge=-90.0, le=90.0)
    lon: float = Field(..., ge=-180.0, le=180.0)
    name: Optional[str] = Field(None, max_length=120)


class CompareRequest(WindowRequest):
    dataset_id: str
    place_a: PlaceInput
    place_b: PlaceInput


class CorrelationRequest(WindowRequest):
    dataset_x: str
    dataset_y: str
    lat: float = Field(..., ge=-90.0, le=90.0)
    lon: float = Field(..., ge=-180.0, le=180.0)
    location_name: Optional[str] = Field(None, max_length=120)


class TimeSeriesPoint(BaseModel):
    date: str
    value: Optional[float] = None
    trend_value: Optional[float] = None
    anomaly: Optional[float] = None


class SeasonalInsight(BaseModel):
    season: str
    mean_value: float
    trend_per_decade: Optional[float] = None
    n_years: int


class StatisticalResult(BaseModel):
    trend_direction: Literal["increasing", "decreasing", "stable"]
    sen_slope: float  # units per year
    sen_slope_ci: List[float]  # 95% interval, units per year
    ols_slope: float  # units per year
    ols_slope_ci: List[float]  # 95% t-based interval, units per year
    p_value: float
    is_significant: bool
    autocorrelation_detected: bool
    lag1_autocorrelation: Optional[float] = None
    ljung_box_p_value: Optional[float] = None
    test_used: str
    n_observations: int
    resolution: Resolution


class ChangePointResult(BaseModel):
    change_date: str
    change_year: int
    change_month: int = 7
    resolution: Resolution = "annual"
    p_value: float
    is_significant: bool
    level_before: float
    level_after: float
    shift: float
    n_before: int
    n_after: int
    method: str


class RecordEntry(BaseModel):
    label: str
    value: float


class RecordsResult(BaseModel):
    n_years: int
    highest_years: List[RecordEntry]
    lowest_years: List[RecordEntry]
    latest_year: Optional[int] = None
    latest_value: Optional[float] = None
    latest_rank_high: Optional[int] = None
    record_high_years: List[int]
    record_low_years: List[int]
    highest_months: List[RecordEntry]
    lowest_months: List[RecordEntry]
    highest5_in_last_decade: int
    lowest5_in_last_decade: int


class DataQuality(BaseModel):
    coverage_pct: float
    valid_months: int
    expected_months: int
    longest_gap_months: int
    complete_years: int
    level: Literal["good", "fair", "poor"]
    notes: List[str]
    temporal_continuity_pct: float = 100.0
    duplicate_months: int = 0
    incomplete_years: List[int] = Field(default_factory=list)
    source_break_years: List[int] = Field(default_factory=list)


class InvestigationResponse(BaseModel):
    location_name: str
    lat: float
    lon: float
    dataset_id: str
    variable_name: str
    unit: str
    time_period: str
    data_source: str
    key_findings: List[str]
    statistics: StatisticalResult
    change_point: Optional[ChangePointResult] = None
    records: RecordsResult
    data_quality: DataQuality
    time_series: List[TimeSeriesPoint]
    seasonal_insights: List[SeasonalInsight]
    limitations: List[str]


class CompareSummary(BaseModel):
    slope_difference_per_decade: float  # place A minus place B
    ci_overlap: bool
    anomaly_correlation: Optional[float] = None
    n_overlap: int
    notes: List[str]


class CompareResponse(BaseModel):
    a: InvestigationResponse
    b: InvestigationResponse
    comparison: CompareSummary


class CorrelationPoint(BaseModel):
    date: str
    x: float
    y: float


class CorrelationResponse(BaseModel):
    location_name: str
    lat: float
    lon: float
    x_name: str
    x_unit: str
    y_name: str
    y_unit: str
    time_period: str
    resolution: Resolution
    n: int
    n_effective: float
    pearson_r: float
    pearson_p: float
    pearson_p_adjusted: float  # legacy key; approximate AR(1)-style effective-n p-value
    pearson_p_adjustment_method: str = "Approximate lag-1 effective-n heuristic"
    spearman_rho: float
    spearman_p: float
    detrended_r: Optional[float] = None
    detrended_p: Optional[float] = None
    lag1_x: Optional[float] = None
    lag1_y: Optional[float] = None
    strength: str
    interpretation: List[str]
    points: List[CorrelationPoint]
    limitations: List[str]
    quality_x: DataQuality
    quality_y: DataQuality


class ConversationTurn(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., min_length=1, max_length=1000)


class AssistantRequest(BaseModel):
    question: str = Field(..., min_length=3, max_length=500)
    analysis: AnalysisRequest
    history: List[ConversationTurn] = Field(default_factory=list, max_length=8)


class AssistantResponse(BaseModel):
    answer: str
    sources_cited: List[str]
    confidence_note: str
