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
    variable: str
    unit: str
    spatial_resolution: str
    temporal_resolution: str
    start_year: int
    end_year: int
    description: str
    limitation: str


class AnalysisRequest(BaseModel):
    dataset_id: str = Field(..., description="Dataset id, e.g. temperature")
    lat: float = Field(..., ge=-90.0, le=90.0)
    lon: float = Field(..., ge=-180.0, le=180.0)
    start_year: int = Field(..., ge=1981, le=2100)
    end_year: int = Field(..., ge=1981, le=2100)
    temporal_resolution: Resolution = "annual"
    location_name: Optional[str] = Field(None, max_length=120)

    @model_validator(mode="after")
    def check_year_order(self) -> "AnalysisRequest":
        if self.start_year > self.end_year:
            raise ValueError("start_year must not be later than end_year")
        return self


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
    time_series: List[TimeSeriesPoint]
    seasonal_insights: List[SeasonalInsight]
    limitations: List[str]


class AssistantRequest(BaseModel):
    question: str = Field(..., min_length=3, max_length=500)
    analysis: AnalysisRequest


class AssistantResponse(BaseModel):
    answer: str
    sources_cited: List[str]
    confidence_note: str
