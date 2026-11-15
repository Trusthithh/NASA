import axios from "axios";
import {
  AnalysisParams,
  AssistantResponse,
  CompareParams,
  CompareResponse,
  CorrelationParams,
  CorrelationResponse,
  DatasetInfo,
  InvestigationResponse,
  LocationResult,
} from "../types/science";

const API_BASE = import.meta.env.VITE_API_BASE_URL?.trim() || "/api/v1";

export const apiClient = axios.create({
  baseURL: API_BASE,
  timeout: 90_000, // free-tier hosts can take a while to wake up
  headers: { "Content-Type": "application/json" },
});

export function getErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    if (err.code === "ERR_CANCELED") return "Request cancelled.";
    if (err.code === "ECONNABORTED") {
      return "The request timed out. The server may be waking up; please retry.";
    }
    if (!err.response) return "Cannot reach the analysis server.";
    const detail = (err.response.data as { detail?: unknown } | undefined)?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail) && detail.length > 0) {
      const first = detail[0] as { msg?: string };
      if (first?.msg) return first.msg;
    }
  }
  return fallback;
}

export async function searchLocations(query: string): Promise<LocationResult[]> {
  const { data } = await apiClient.get<LocationResult[]>("/locations/search", {
    params: { q: query },
  });
  return data;
}

export async function fetchDatasets(): Promise<DatasetInfo[]> {
  const { data } = await apiClient.get<DatasetInfo[]>("/datasets");
  return data;
}

export async function runInvestigation(
  params: AnalysisParams,
  signal?: AbortSignal
): Promise<InvestigationResponse> {
  const { data } = await apiClient.post<InvestigationResponse>("/analysis", params, { signal });
  return data;
}

export async function runComparison(
  params: CompareParams,
  signal?: AbortSignal
): Promise<CompareResponse> {
  const { data } = await apiClient.post<CompareResponse>("/analysis/compare", params, { signal });
  return data;
}

export async function runCorrelation(
  params: CorrelationParams,
  signal?: AbortSignal
): Promise<CorrelationResponse> {
  const { data } = await apiClient.post<CorrelationResponse>("/analysis/correlation", params, {
    signal,
  });
  return data;
}

export async function askAssistant(
  question: string,
  analysis: AnalysisParams,
  history: Array<{ role: "user" | "assistant"; content: string }> = []
): Promise<AssistantResponse> {
  const { data } = await apiClient.post<AssistantResponse>("/assistant/explain", {
    question,
    analysis,
    history: history.slice(-8),
  });
  return data;
}
