import React, { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2, MapPin, Sliders } from "lucide-react";
import { fetchDatasets, getErrorMessage, runInvestigation } from "../services/api";
import {
  AnalysisParams,
  DatasetInfo,
  InvestigationResponse,
  LocationResult,
  Resolution,
} from "../types/science";
import { EarthGlobe } from "../components/Globe/EarthGlobe";
import { LocationSearch } from "../components/Search/LocationSearch";
import { InvestigationReport } from "../components/Reports/InvestigationReport";
import { ResearchAssistant } from "../components/Assistant/ResearchAssistant";
import { useSelectedLocation } from "../context/LocationContext";
import { SelectedLocation, formatCoords } from "../utils/geo";
import { btnPrimary, card, container, input, label, page } from "../styles/ui";

const DEFAULT_LOCATION: SelectedLocation = { lat: 30.04, lon: 31.23, name: "Cairo" };

const parseCoord = (text: string, min: number, max: number): number | null => {
  const n = Number(text);
  return text.trim() !== "" && Number.isFinite(n) && n >= min && n <= max ? n : null;
};

const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), hi);

export const InvestigationPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { location: shared, setLocation } = useSelectedLocation();

  // Starting point: URL (search / landing page) > shared selection > default.
  const [initial] = useState<SelectedLocation>(() => {
    const lat = parseCoord(searchParams.get("lat") ?? "", -90, 90);
    const lon = parseCoord(searchParams.get("lon") ?? "", -180, 180);
    if (lat !== null && lon !== null) {
      return { lat, lon, name: searchParams.get("name") ?? formatCoords(lat, lon) };
    }
    return shared ?? DEFAULT_LOCATION;
  });

  const [latText, setLatText] = useState(String(initial.lat));
  const [lonText, setLonText] = useState(String(initial.lon));
  const [placeName, setPlaceName] = useState(initial.name);

  const [datasets, setDatasets] = useState<DatasetInfo[]>([]);
  const [datasetId, setDatasetId] = useState(searchParams.get("dataset") ?? "temperature");
  const [startYear, setStartYear] = useState(1990);
  const [endYear, setEndYear] = useState(2020);
  const [resolution, setResolution] = useState<Resolution>("annual");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [investigation, setInvestigation] = useState<InvestigationResponse | null>(null);
  const [analysedParams, setAnalysedParams] = useState<AnalysisParams | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const initialRunDone = useRef(false);
  const info = datasets.find((d) => d.id === datasetId);

  const lat = parseCoord(latText, -90, 90);
  const lon = parseCoord(lonText, -180, 180);
  const markerPoint = lat !== null && lon !== null ? { lat, lon } : null;

  const runAnalysis = async (override?: SelectedLocation) => {
    const useLat = override ? override.lat : lat;
    const useLon = override ? override.lon : lon;
    if (useLat === null || useLon === null) {
      setError("Enter a latitude between -90 and 90 and a longitude between -180 and 180.");
      return;
    }
    if (startYear > endYear) {
      setError("The start year must not be later than the end year.");
      return;
    }
    const name = override ? override.name : placeName || formatCoords(useLat, useLon);
    const params: AnalysisParams = {
      dataset_id: datasetId,
      lat: useLat,
      lon: useLon,
      start_year: startYear,
      end_year: endYear,
      temporal_resolution: resolution,
      location_name: name,
    };

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const res = await runInvestigation(params, controller.signal);
      if (controller.signal.aborted) return;
      setInvestigation(res);
      setAnalysedParams(params);
      setLocation({ lat: useLat, lon: useLon, name });
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(getErrorMessage(err, "Failed to execute the trend analysis."));
    } finally {
      if (abortRef.current === controller) setLoading(false);
    }
  };

  // A new place from the globe or the search box fills the panel and re-runs the analysis.
  const applyLocation = (next: SelectedLocation) => {
    setLatText(String(next.lat));
    setLonText(String(next.lon));
    setPlaceName(next.name);
    void runAnalysis(next);
  };

  const handleGlobePick = (pickLat: number, pickLon: number) => {
    applyLocation({ lat: pickLat, lon: pickLon, name: formatCoords(pickLat, pickLon) });
  };

  const handleSearchSelect = (place: LocationResult) => {
    applyLocation({ lat: place.lat, lon: place.lon, name: place.name });
  };

  useEffect(() => {
    fetchDatasets()
      .then((list) => {
        setDatasets(list);
        const chosen = list.find((d) => d.id === datasetId) ?? list[0];
        if (!chosen) return;
        setDatasetId(chosen.id);
        setStartYear(clamp(1990, chosen.start_year, chosen.end_year));
        setEndYear(chosen.end_year);
      })
      .catch((err) => setError(getErrorMessage(err, "Failed to load dataset metadata.")));
    return () => abortRef.current?.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (datasets.length > 0 && !initialRunDone.current) {
      initialRunDone.current = true;
      void runAnalysis();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datasets]);

  const handleDatasetChange = (id: string) => {
    setDatasetId(id);
    const next = datasets.find((d) => d.id === id);
    if (next) {
      setStartYear((y) => clamp(y, next.start_year, next.end_year));
      setEndYear((y) => clamp(y, next.start_year, next.end_year));
    }
  };

  const minYear = info?.start_year ?? 1981;
  const maxYear = info?.end_year ?? new Date().getFullYear() - 1;

  return (
    <div className={`${page} py-10`}>
      <div className={`${container} space-y-8`}>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
          <div className={`${card} lg:col-span-2`}>
            <h2 className="mb-1 text-lg font-bold">Select on the globe</h2>
            <p className="mb-3 text-xs text-slate-400">
              Click anywhere to analyse that point. The panel updates automatically.
            </p>
            <div className="overflow-hidden rounded-2xl border border-slate-800 bg-black/40">
              <EarthGlobe
                selected={markerPoint}
                onPick={handleGlobePick}
                heightClass="h-[380px]"
                distance={8}
              />
            </div>
          </div>

          <div className={`${card} lg:col-span-3`}>
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-800 bg-cyan-950">
                <Sliders className="h-5 w-5 text-cyan-400" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Trend Analyser</h1>
                <p className="flex items-center gap-1 text-xs text-slate-400">
                  <MapPin className="h-3.5 w-3.5" />
                  {placeName || "Custom coordinates"}
                </p>
              </div>
            </div>

            <div className="mb-5">
              <LocationSearch
                onSelectLocation={handleSearchSelect}
                placeholder="Search another place..."
              />
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className={label} htmlFor="dataset">Variable</label>
                <select id="dataset" className={input} value={datasetId} onChange={(e) => handleDatasetChange(e.target.value)}>
                  {datasets.map((d) => (
                    <option key={d.id} value={d.id}>{d.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={label} htmlFor="res">Resolution</label>
                <select id="res" className={input} value={resolution} onChange={(e) => setResolution(e.target.value as Resolution)}>
                  <option value="annual">Annual means (recommended)</option>
                  <option value="monthly">Monthly (deseasonalised)</option>
                </select>
              </div>
              <div>
                <label className={label} htmlFor="lat">Latitude</label>
                <input id="lat" className={input} value={latText} onChange={(e) => { setLatText(e.target.value); setPlaceName(""); }} />
              </div>
              <div>
                <label className={label} htmlFor="lon">Longitude</label>
                <input id="lon" className={input} value={lonText} onChange={(e) => { setLonText(e.target.value); setPlaceName(""); }} />
              </div>
              <div>
                <label className={label} htmlFor="start">Start year</label>
                <input id="start" type="number" className={input} min={minYear} max={maxYear} value={startYear} onChange={(e) => setStartYear(Number(e.target.value))} />
              </div>
              <div>
                <label className={label} htmlFor="end">End year</label>
                <input id="end" type="number" className={input} min={minYear} max={maxYear} value={endYear} onChange={(e) => setEndYear(Number(e.target.value))} />
              </div>
            </div>

            <button className={`${btnPrimary} mt-5 w-full`} disabled={loading || datasets.length === 0} onClick={() => void runAnalysis()}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Run trend analysis
            </button>
            {info && (
              <p className="mt-4 text-xs text-slate-400">
                Available {info.start_year}-{info.end_year} - {info.spatial_resolution} - {info.limitation}
              </p>
            )}
          </div>
        </div>

        {error && (
          <div className="rounded-2xl border border-rose-800/60 bg-rose-950/40 p-4 text-sm text-rose-200">
            {error}
          </div>
        )}

        {loading && !investigation && (
          <div className="flex items-center gap-3 text-slate-300">
            <Loader2 className="h-5 w-5 animate-spin" /> Fetching NASA data and running statistics...
          </div>
        )}

        {investigation && analysedParams && (
          <div className="grid grid-cols-1 gap-8 xl:grid-cols-3">
            <div className="relative xl:col-span-2">
              {loading && (
                <div className="absolute right-4 top-4 z-10 flex items-center gap-2 rounded-full bg-slate-900/90 px-3 py-1.5 text-xs text-cyan-300">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" /> Updating...
                </div>
              )}
              <InvestigationReport data={investigation} />
            </div>
            <div className="xl:col-span-1">
              <ResearchAssistant params={analysedParams} locationName={investigation.location_name} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
