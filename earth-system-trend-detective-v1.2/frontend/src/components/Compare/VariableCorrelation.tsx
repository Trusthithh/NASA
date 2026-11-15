import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Loader2 } from "lucide-react";
import { EarthGlobe } from "../Globe/EarthGlobe";
import { LocationSearch } from "../Search/LocationSearch";
import { HotspotPicker } from "../Hotspots/HotspotPicker";
import { DataQualityBadge } from "../Reports/DataQualityBadge";
import { VariableSelect } from "./VariableSelect";
import { getErrorMessage, runCorrelation } from "../../services/api";
import { CorrelationResponse, DatasetInfo, LocationResult, Resolution } from "../../types/science";
import { Hotspot } from "../../data/hotspots";
import { useSelectedLocation } from "../../context/LocationContext";
import { formatCoords } from "../../utils/geo";
import { btnPrimary, card, input, label, subCard } from "../../styles/ui";

interface Place {
  lat: number;
  lon: number;
  name: string;
}

const DEFAULT_PLACE: Place = { lat: -3.1, lon: -60.0, name: "Amazon (Manaus)" };
const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), hi);
const fmt = (n: number, d = 2) => n.toFixed(d);
const fmtP = (p: number) => (p < 0.0001 ? "< 0.0001" : p.toFixed(4));

function linearFit(points: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> | null {
  if (points.length < 2) return null;
  const mx = points.reduce((s, p) => s + p.x, 0) / points.length;
  const my = points.reduce((s, p) => s + p.y, 0) / points.length;
  const sxx = points.reduce((s, p) => s + (p.x - mx) ** 2, 0);
  if (sxx === 0) return null;
  const slope = points.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0) / sxx;
  const intercept = my - slope * mx;
  const xs = points.map((p) => p.x);
  const lo = Math.min(...xs);
  const hi = Math.max(...xs);
  return [
    { x: lo, y: intercept + slope * lo },
    { x: hi, y: intercept + slope * hi },
  ];
}

export const VariableCorrelation: React.FC<{ datasets: DatasetInfo[] }> = ({ datasets }) => {
  const { location: shared, setLocation: setSharedLocation } = useSelectedLocation();
  const [place, setPlace] = useState<Place>(
    shared ? { lat: shared.lat, lon: shared.lon, name: shared.name } : DEFAULT_PLACE
  );
  useEffect(() => {
    if (shared) setPlace({ lat: shared.lat, lon: shared.lon, name: shared.name });
  }, [shared?.lat, shared?.lon, shared?.name]);

  const [xId, setXId] = useState("");
  const [yId, setYId] = useState("");
  const [resolution, setResolution] = useState<Resolution>("annual");
  const [startYear, setStartYear] = useState(1990);
  const [endYear, setEndYear] = useState(2020);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CorrelationResponse | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const infoX = datasets.find((d) => d.id === xId);
  const infoY = datasets.find((d) => d.id === yId);
  const minYear = Math.max(infoX?.start_year ?? 1981, infoY?.start_year ?? 1981);
  const maxYear = Math.min(
    infoX?.end_year ?? new Date().getFullYear() - 1,
    infoY?.end_year ?? new Date().getFullYear() - 1
  );

  useEffect(() => {
    if (datasets.length > 1 && !xId && !yId) {
      setXId(datasets[0].id);
      setYId((datasets.find((d) => d.id === "precipitation") ?? datasets[1]).id);
    }
  }, [datasets, xId, yId]);

  useEffect(() => {
    setStartYear((y) => clamp(y, minYear, maxYear));
    setEndYear((y) => clamp(y, minYear, maxYear));
  }, [minYear, maxYear]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const updatePlace = (next: Place) => {
    setPlace(next);
    setSharedLocation({ lat: next.lat, lon: next.lon, name: next.name });
  };
  const handlePick = (lat: number, lon: number) => updatePlace({ lat, lon, name: formatCoords(lat, lon) });
  const handleSearch = (p: LocationResult) => updatePlace({ lat: p.lat, lon: p.lon, name: p.name });
  const handleHotspot = (h: Hotspot) => updatePlace({ lat: h.lat, lon: h.lon, name: h.name });

  const run = async () => {
    if (!xId || !yId) return;
    if (xId === yId) {
      setError("Choose two different variables.");
      return;
    }
    if (startYear > endYear) {
      setError("The start year must not be later than the end year.");
      return;
    }
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError(null);
    try {
      const res = await runCorrelation(
        {
          dataset_x: xId,
          dataset_y: yId,
          lat: place.lat,
          lon: place.lon,
          start_year: startYear,
          end_year: endYear,
          temporal_resolution: resolution,
          location_name: place.name,
        },
        controller.signal
      );
      if (!controller.signal.aborted) setResult(res);
    } catch (err) {
      if (!controller.signal.aborted) setError(getErrorMessage(err, "The correlation failed."));
    } finally {
      if (abortRef.current === controller) setLoading(false);
    }
  };

  const fit = useMemo(() => (result ? linearFit(result.points) : null), [result]);

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className={`${card} lg:col-span-2`}>
          <h2 className="mb-1 text-lg font-bold">Pick a place</h2>
          <p className="mb-3 text-xs text-slate-400">Both variables are analysed at the same location.</p>
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-black/40">
            <EarthGlobe selected={place} onPick={handlePick} heightClass="h-[380px]" distance={8} />
          </div>
        </div>

        <div className={`${card} space-y-5 lg:col-span-3`}>
          <div className={subCard}>
            <div className="font-mono text-xs uppercase tracking-wider text-slate-400">Location</div>
            <div className="mt-1 text-sm font-medium text-white">{place.name}</div>
            <div className="font-mono text-xs text-slate-400">{formatCoords(place.lat, place.lon)}</div>
          </div>

          <LocationSearch onSelectLocation={handleSearch} placeholder="Search another place..." />
          <HotspotPicker onSelect={handleHotspot} activeName={place.name} />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <VariableSelect id="cor-x" title="Variable X" value={xId} datasets={datasets} onChange={setXId} />
            <VariableSelect id="cor-y" title="Variable Y" value={yId} datasets={datasets} onChange={setYId} />
            <div>
              <label className={label} htmlFor="cor-res">Resolution</label>
              <select id="cor-res" className={input} value={resolution} onChange={(e) => setResolution(e.target.value as Resolution)}>
                <option value="annual">Annual means (recommended)</option>
                <option value="monthly">Monthly (deseasonalised)</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className={label} htmlFor="cor-start">Start year</label>
                <input id="cor-start" type="number" className={input} min={minYear} max={maxYear} value={startYear} onChange={(e) => setStartYear(Number(e.target.value))} />
              </div>
              <div>
                <label className={label} htmlFor="cor-end">End year</label>
                <input id="cor-end" type="number" className={input} min={minYear} max={maxYear} value={endYear} onChange={(e) => setEndYear(Number(e.target.value))} />
              </div>
            </div>
          </div>

          <button className={`${btnPrimary} w-full`} disabled={loading || !xId || !yId} onClick={() => void run()}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Correlate variables
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-800/60 bg-rose-950/40 p-4 text-sm text-rose-200">{error}</div>
      )}

      {result && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className={subCard}>
              <div className="font-mono text-xs uppercase text-slate-400">Pearson r</div>
              <div className="mt-1 text-xl font-bold text-white">{fmt(result.pearson_r)}</div>
              <div className="text-xs text-slate-400">{result.strength}</div>
            </div>
            <div className={subCard}>
              <div className="font-mono text-xs uppercase text-slate-400">Spearman rho</div>
              <div className="mt-1 text-xl font-bold text-white">{fmt(result.spearman_rho)}</div>
              <div className="text-xs text-slate-400">rank-based, p = {fmtP(result.spearman_p)} (not autocorrelation-adjusted)</div>
            </div>
            <div className={subCard}>
              <div className="font-mono text-xs uppercase text-slate-400">Detrended r</div>
              <div className="mt-1 text-xl font-bold text-white">
                {result.detrended_r === null ? "n/a" : fmt(result.detrended_r)}
              </div>
              <div className="text-xs text-slate-400">trend removed from both</div>
            </div>
            <div className={subCard}>
              <div className="font-mono text-xs uppercase text-slate-400">Approx. p-value</div>
              <div className="mt-1 text-xl font-bold text-white">{fmtP(result.pearson_p_adjusted)}</div>
              <div className="text-xs text-slate-400">
                n = {result.n}, effective n ≈ {fmt(result.n_effective, 0)}
              </div>
              <div className="mt-1 text-[10px] text-slate-500">Lag-1 heuristic only; not a definitive serial-correlation correction.</div>
            </div>
          </div>

          <div className={card}>
            <h3 className="mb-3 text-lg font-bold text-white">
              {result.x_name} vs {result.y_name}
            </h3>
            <div className="h-96 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart margin={{ top: 8, right: 16, bottom: 28, left: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis
                    type="number"
                    dataKey="x"
                    name={result.x_name}
                    stroke="#94a3b8"
                    domain={["auto", "auto"]}
                    tickFormatter={(v: number) => v.toFixed(2)}
                    label={{ value: `${result.x_name} anomaly (${result.x_unit})`, position: "insideBottom", offset: -16, fill: "#94a3b8", fontSize: 12 }}
                  />
                  <YAxis
                    type="number"
                    dataKey="y"
                    name={result.y_name}
                    stroke="#94a3b8"
                    domain={["auto", "auto"]}
                    tickFormatter={(v: number) => v.toFixed(2)}
                    label={{ value: `${result.y_name} anomaly (${result.y_unit})`, angle: -90, position: "insideLeft", fill: "#94a3b8", fontSize: 12 }}
                  />
                  <Tooltip
                    cursor={{ strokeDasharray: "3 3" }}
                    contentStyle={{ background: "#0f172a", border: "1px solid #155e75" }}
                    formatter={(v) => (typeof v === "number" ? v.toFixed(3) : String(v))}
                  />
                  <Legend verticalAlign="top" />
                  <Scatter name="Observations" data={result.points} fill="#22d3ee" />
                  {fit && (
                    <Line data={fit} dataKey="y" name="Linear fit" stroke="#f59e0b" dot={false} strokeWidth={2} isAnimationActive={false} legendType="line" />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className={card}>
            <h3 className="mb-3 text-lg font-bold text-white">What this means</h3>
            <ul className="space-y-2 text-sm leading-relaxed text-slate-200">
              {result.interpretation.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
            <div className="mt-4 flex flex-wrap gap-3">
              <div>
                <div className="mb-1 font-mono text-xs text-slate-400">{result.x_name}</div>
                <DataQualityBadge quality={result.quality_x} />
              </div>
              <div>
                <div className="mb-1 font-mono text-xs text-slate-400">{result.y_name}</div>
                <DataQualityBadge quality={result.quality_y} />
              </div>
            </div>
            <ul className="mt-4 list-disc space-y-1 pl-5 text-xs text-slate-400">
              {result.limitations.map((l, i) => (
                <li key={i}>{l}</li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};
