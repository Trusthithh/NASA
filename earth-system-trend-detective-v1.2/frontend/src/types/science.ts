export type Resolution = "annual" | "monthly";

export interface LocationResult {
  name: string;
  country?: string | null;
  admin1?: string | null;
  lat: number;
  lon: number;
}

export interface DatasetInfo {
  id: string;
  name: string;
  category: string;
  variable: string;
  unit: string;
  spatial_resolution: string;
  temporal_resolution: string;
  start_year: number;
  end_year: number;
  description: string;
  limitation: string;
}

export interface TimeSeriesPoint {
  date: string;
  value: number | null;
  trend_value: number | null;
  anomaly: number | null;
}

export interface SeasonalInsight {
  season: string;
  mean_value: number;
  trend_per_decade: number | null;
  n_years: number;
}

export interface StatisticalResult {
  trend_direction: "increasing" | "decreasing" | "stable";
  sen_slope: number;
  sen_slope_ci: [number, number];
  ols_slope: number;
  ols_slope_ci: [number, number];
  p_value: number;
  is_significant: boolean;
  autocorrelation_detected: boolean;
  lag1_autocorrelation: number | null;
  ljung_box_p_value: number | null;
  test_used: string;
  n_observations: number;
  resolution: Resolution;
}

export interface ChangePoint {
  change_date: string;
  change_year: number;
  change_month: number;
  resolution: Resolution;
  p_value: number;
  is_significant: boolean;
  level_before: number;
  level_after: number;
  shift: number;
  n_before: number;
  n_after: number;
  method: string;
}

export interface RecordEntry {
  label: string;
  value: number;
}

export interface RecordsResult {
  n_years: number;
  highest_years: RecordEntry[];
  lowest_years: RecordEntry[];
  latest_year: number | null;
  latest_value: number | null;
  latest_rank_high: number | null;
  record_high_years: number[];
  record_low_years: number[];
  highest_months: RecordEntry[];
  lowest_months: RecordEntry[];
  highest5_in_last_decade: number;
  lowest5_in_last_decade: number;
}

export interface DataQuality {
  coverage_pct: number;
  valid_months: number;
  expected_months: number;
  longest_gap_months: number;
  complete_years: number;
  level: "good" | "fair" | "poor";
  notes: string[];
  temporal_continuity_pct: number;
  duplicate_months: number;
  incomplete_years: number[];
  source_break_years: number[];
}

export interface InvestigationResponse {
  location_name: string;
  lat: number;
  lon: number;
  dataset_id: string;
  variable_name: string;
  unit: string;
  time_period: string;
  data_source: string;
  key_findings: string[];
  statistics: StatisticalResult;
  change_point: ChangePoint | null;
  records: RecordsResult;
  data_quality: DataQuality;
  time_series: TimeSeriesPoint[];
  seasonal_insights: SeasonalInsight[];
  limitations: string[];
}

export interface AnalysisParams {
  dataset_id: string;
  lat: number;
  lon: number;
  start_year: number;
  end_year: number;
  temporal_resolution: Resolution;
  location_name?: string;
}

export interface AssistantResponse {
  answer: string;
  sources_cited: string[];
  confidence_note: string;
}

export interface PlaceInput {
  lat: number;
  lon: number;
  name?: string;
}

export interface CompareParams {
  dataset_id: string;
  place_a: PlaceInput;
  place_b: PlaceInput;
  start_year: number;
  end_year: number;
  temporal_resolution: Resolution;
}

export interface CompareSummary {
  slope_difference_per_decade: number;
  ci_overlap: boolean;
  anomaly_correlation: number | null;
  n_overlap: number;
  notes: string[];
}

export interface CompareResponse {
  a: InvestigationResponse;
  b: InvestigationResponse;
  comparison: CompareSummary;
}

export interface CorrelationParams {
  dataset_x: string;
  dataset_y: string;
  lat: number;
  lon: number;
  start_year: number;
  end_year: number;
  temporal_resolution: Resolution;
  location_name?: string;
}

export interface CorrelationPoint {
  date: string;
  x: number;
  y: number;
}

export interface CorrelationResponse {
  location_name: string;
  lat: number;
  lon: number;
  x_name: string;
  x_unit: string;
  y_name: string;
  y_unit: string;
  time_period: string;
  resolution: Resolution;
  n: number;
  n_effective: number;
  pearson_r: number;
  pearson_p: number;
  pearson_p_adjusted: number;
  pearson_p_adjustment_method: string;
  spearman_rho: number;
  spearman_p: number;
  detrended_r: number | null;
  detrended_p: number | null;
  lag1_x: number | null;
  lag1_y: number | null;
  strength: string;
  interpretation: string[];
  points: CorrelationPoint[];
  limitations: string[];
  quality_x: DataQuality;
  quality_y: DataQuality;
}
