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
