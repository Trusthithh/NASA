import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Loader2 } from "lucide-react";
import { EarthGlobe } from "../Globe/EarthGlobe";
import { LocationSearch } from "../Search/LocationSearch";
import { HotspotPicker } from "../Hotspots/HotspotPicker";
import { DataQualityBadge } from "../Reports/DataQualityBadge";
import { getErrorMessage, runComparison } from "../../services/api";
import {
  CompareResponse,
  DatasetInfo,
  InvestigationResponse,
  LocationResult,
  Resolution,
} from "../../types/science";
import { Hotspot } from "../../data/hotspots";
import { useSelectedLocation } from "../../context/LocationContext";
import { formatCoords } from "../../utils/geo";
import { btnPrimary, card, input, label, subCard } from "../../styles/ui";

interface Place {
  lat: number;
  lon: number;
  name: string;
}
type Slot = "a" | "b";
type View = "observed" | "anomaly";
type Row = Record<string, string | number | null>;

const COLOR_A = "#f59e0b";
const COLOR_B = "#38bdf8";
const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), hi);
const fmt = (n: number, d = 3) => n.toFixed(d);
const fmtP = (p: number) => (p < 0.0001 ? "< 0.0001" : p.toFixed(4));

const DEFAULT_A: Place = { lat: 78.2, lon: 15.6, name: "Arctic (Svalbard)" };
const DEFAULT_B: Place = { lat: -3.1, lon: -60.0, name: "Amazon (Manaus)" };

function mergeSeries(result: CompareResponse): Row[] {
  const rows = new Map<string, Row>();
  const add = (r: InvestigationResponse, key: "a" | "b") => {
    r.time_series.forEach((p) => {
      const row = rows.get(p.date) ?? { date: p.date };
      row[`${key}_value`] = p.value;
      row[`${key}_trend`] = p.trend_value;
      row[`${key}_anom`] = p.anomaly;
      rows.set(p.date, row);
    });
  };
  add(result.a, "a");
  add(result.b, "b");
  return Array.from(rows.values()).sort((x, y) => String(x.date).localeCompare(String(y.date)));
}

const SlotButton: React.FC<{
  title: string;
  place: Place;
  color: string;
  active: boolean;
  onClick: () => void;
}> = ({ title, place, color, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={
      "flex-1 rounded-2xl border p-3 text-left transition-colors " +
      (active ? "border-cyan-400 bg-cyan-950/40" : "border-slate-700 bg-slate-950/60 hover:border-slate-500")
    }
  >
    <div className="flex items-center gap-2 text-xs font-mono uppercase tracking-wider text-slate-400">
      <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: color }} />
      {title} {active && "(selecting)"}
    </div>
    <div className="mt-1 truncate text-sm font-medium text-white">{place.name}</div>
    <div className="font-mono text-xs text-slate-400">{formatCoords(place.lat, place.lon)}</div>
  </button>
);

export const PlaceComparison: React.FC<{ datasets: DatasetInfo[] }> = ({ datasets }) => {
  const { location: shared } = useSelectedLocation();
  const [placeA, setPlaceA] = useState<Place>(
    shared ? { lat: shared.lat, lon: shared.lon, name: shared.name } : DEFAULT_A
  );
  const [placeB, setPlaceB] = useState<Place>(DEFAULT_B);
  const [active, setActive] = useState<Slot>("b");
  const [datasetId, setDatasetId] = useState("");
  const [resolution, setResolution] = useState<Resolution>("annual");
  const [startYear, setStartYear] = useState(1990);
  const [endYear, setEndYear] = useState(2020);
  const [view, setView] = useState<View>("observed");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CompareResponse | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const info = datasets.find((d) => d.id === datasetId);
  const minYear = info?.start_year ?? 1981;
  const maxYear = info?.end_year ?? new Date().getFullYear() - 1;
  const categories = Array.from(new Set(datasets.map((d) => d.category)));

  useEffect(() => {
    if (!datasetId && datasets.length > 0) setDatasetId(datasets[0].id);
  }, [datasets, datasetId]);

  useEffect(() => {
    setStartYear((y) => clamp(y, minYear, maxYear));
    setEndYear((y) => clamp(y, minYear, maxYear));
  }, [minYear, maxYear]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const assign = (place: Place) => {
    if (active === "a") {
      setPlaceA(place);
      setActive("b");
    } else {
      setPlaceB(place);
    }
  };

  const handlePick = (lat: number, lon: number) => assign({ lat, lon, name: formatCoords(lat, lon) });
  const handleSearch = (p: LocationResult) => assign({ lat: p.lat, lon: p.lon, name: p.name });
  const handleHotspot = (h: Hotspot) => assign({ lat: h.lat, lon: h.lon, name: h.name });

  const run = async () => {
    if (!datasetId) return;
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
      const res = await runComparison(
        {
          dataset_id: datasetId,
          place_a: placeA,
          place_b: placeB,
          start_year: startYear,
          end_year: endYear,
          temporal_resolution: resolution,
        },
        controller.signal
      );
      if (!controller.signal.aborted) setResult(res);
    } catch (err) {
      if (!controller.signal.aborted) setError(getErrorMessage(err, "The comparison failed."));
    } finally {
      if (abortRef.current === controller) setLoading(false);
    }
  };

  const chartData = useMemo(() => (result ? mergeSeries(result) : []), [result]);
  const activePlace = active === "a" ? placeA : placeB;
  const otherPlace = active === "a" ? placeB : placeA;

  const metricRows: Array<[string, (r: InvestigationResponse) => string]> = result
    ? [
        ["Trend", (r) => `${r.statistics.trend_direction}${r.statistics.is_significant ? " (significant)" : " (not significant)"}`],
        ["Theil-Sen slope per decade", (r) => `${fmt(r.statistics.sen_slope * 10)} ${r.unit}`],
        ["95% interval per decade", (r) => `${fmt(r.statistics.sen_slope_ci[0] * 10)} to ${fmt(r.statistics.sen_slope_ci[1] * 10)}`],
        ["p-value", (r) => fmtP(r.statistics.p_value)],
        ["Change point", (r) => (r.change_point ? `${r.change_point.change_year}${r.change_point.is_significant ? "" : " (not significant)"}` : "n/a")],
        ["Highest year", (r) => (r.records.highest_years[0] ? `${r.records.highest_years[0].label} (${fmt(r.records.highest_years[0].value)})` : "n/a")],
        ["Lowest year", (r) => (r.records.lowest_years[0] ? `${r.records.lowest_years[0].label} (${fmt(r.records.lowest_years[0].value)})` : "n/a")],
      ]
    : [];

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className={`${card} lg:col-span-2`}>
          <h2 className="mb-1 text-lg font-bold">Pick two places</h2>
          <p className="mb-3 text-xs text-slate-400">
            Choose which place you are setting, then click the globe, search or use a hotspot.
          </p>
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-black/40">
            <EarthGlobe
              selected={activePlace}
              secondary={otherPlace}
              secondaryColor={active === "a" ? COLOR_B : COLOR_A}
              onPick={handlePick}
              heightClass="h-[380px]"
              distance={8}
            />
          </div>
        </div>

        <div className={`${card} space-y-5 lg:col-span-3`}>
          <div className="flex flex-col gap-3 sm:flex-row">
            <SlotButton title="Place A" place={placeA} color={COLOR_A} active={active === "a"} onClick={() => setActive("a")} />
            <SlotButton title="Place B" place={placeB} color={COLOR_B} active={active === "b"} onClick={() => setActive("b")} />
          </div>

          <LocationSearch onSelectLocation={handleSearch} placeholder="Search a place for the selected slot..." />
          <HotspotPicker onSelect={handleHotspot} label={`Hotspots for Place ${active.toUpperCase()}`} />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={label} htmlFor="cmp-dataset">Variable</label>
              <select id="cmp-dataset" className={input} value={datasetId} onChange={(e) => setDatasetId(e.target.value)}>
                {categories.map((cat) => (
                  <optgroup key={cat} label={cat}>
                    {datasets.filter((d) => d.category === cat).map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </div>
            <div>
              <label className={label} htmlFor="cmp-res">Resolution</label>
              <select id="cmp-res" className={input} value={resolution} onChange={(e) => setResolution(e.target.value as Resolution)}>
                <option value="annual">Annual means (recommended)</option>
                <option value="monthly">Monthly (deseasonalised)</option>
              </select>
            </div>
            <div>
              <label className={label} htmlFor="cmp-start">Start year</label>
              <input id="cmp-start" type="number" className={input} min={minYear} max={maxYear} value={startYear} onChange={(e) => setStartYear(Number(e.target.value))} />
            </div>
            <div>
              <label className={label} htmlFor="cmp-end">End year</label>
              <input id="cmp-end" type="number" className={input} min={minYear} max={maxYear} value={endYear} onChange={(e) => setEndYear(Number(e.target.value))} />
            </div>
          </div>

          <button className={`${btnPrimary} w-full`} disabled={loading || !datasetId} onClick={() => void run()}>
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Compare places
          </button>
          {info && <p className="text-xs text-slate-400">Available {info.start_year}-{info.end_year}. {info.limitation}</p>}
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-800/60 bg-rose-950/40 p-4 text-sm text-rose-200">{error}</div>
      )}

      {result && (
        <div className="space-y-8">
          <div className={card}>
            <h3 className="mb-3 text-lg font-bold text-white">Comparison summary</h3>
            <ul className="space-y-2 text-sm leading-relaxed text-slate-200">
              {result.comparison.notes.map((n, i) => (
                <li key={i}>{n}</li>
              ))}
            </ul>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div className={subCard}>
                <div className="font-mono text-xs text-slate-400">Slope difference (A - B)</div>
                <div className="mt-1 text-lg font-bold text-white">
                  {result.comparison.slope_difference_per_decade >= 0 ? "+" : ""}
                  {fmt(result.comparison.slope_difference_per_decade)} {result.a.unit}/decade
                </div>
              </div>
              <div className={subCard}>
                <div className="font-mono text-xs text-slate-400">Slope intervals</div>
                <div className="mt-1 text-lg font-bold text-white">{result.comparison.ci_overlap ? "Overlap" : "Do not overlap"}</div>
              </div>
              <div className={subCard}>
                <div className="font-mono text-xs text-slate-400">Anomaly correlation</div>
                <div className="mt-1 text-lg font-bold text-white">
                  {result.comparison.anomaly_correlation === null ? "n/a" : fmt(result.comparison.anomaly_correlation, 2)}
                </div>
              </div>
            </div>
          </div>

          <div className={card}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-lg font-bold text-white">{result.a.variable_name}</h3>
              <div className="flex gap-2">
                {(["observed", "anomaly"] as View[]).map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setView(v)}
                    className={"rounded-full border px-3 py-1 text-xs " + (view === v ? "border-cyan-400 bg-cyan-900/60 text-white" : "border-slate-700 text-slate-300")}
                  >
                    {v === "observed" ? "Observed + trend" : "Anomalies"}
                  </button>
                ))}
              </div>
            </div>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="date" tickFormatter={(d: string) => d.slice(0, 4)} stroke="#94a3b8" minTickGap={32} />
                  <YAxis stroke="#94a3b8" domain={["auto", "auto"]} />
                  <Tooltip
                    contentStyle={{ background: "#0f172a", border: "1px solid #155e75" }}
                    formatter={(v) => (typeof v === "number" ? v.toFixed(3) : String(v))}
                  />
                  <Legend />
                  {view === "observed" ? (
                    <>
                      <Line type="monotone" dataKey="a_value" name={`${result.a.location_name}`} stroke={COLOR_A} dot={false} strokeWidth={2} connectNulls />
                      <Line type="monotone" dataKey="b_value" name={`${result.b.location_name}`} stroke={COLOR_B} dot={false} strokeWidth={2} connectNulls />
                      <Line type="linear" dataKey="a_trend" name="Trend A" stroke={COLOR_A} dot={false} strokeDasharray="6 4" connectNulls />
                      <Line type="linear" dataKey="b_trend" name="Trend B" stroke={COLOR_B} dot={false} strokeDasharray="6 4" connectNulls />
                    </>
                  ) : (
                    <>
                      <Line type="monotone" dataKey="a_anom" name={`${result.a.location_name} anomaly`} stroke={COLOR_A} dot={false} strokeWidth={2} connectNulls />
                      <Line type="monotone" dataKey="b_anom" name={`${result.b.location_name} anomaly`} stroke={COLOR_B} dot={false} strokeWidth={2} connectNulls />
                    </>
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-2 text-xs text-slate-400">
              Units: {result.a.unit}. Use the anomaly view to compare change when the two places have very different baseline levels.
            </p>
          </div>

          <div className={card}>
            <h3 className="mb-4 text-lg font-bold text-white">Side by side</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="font-mono text-xs uppercase text-slate-400">
                  <tr>
                    <th className="py-2 pr-4">Metric</th>
                    <th className="py-2 pr-4" style={{ color: COLOR_A }}>{result.a.location_name}</th>
                    <th className="py-2" style={{ color: COLOR_B }}>{result.b.location_name}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-200">
                  {metricRows.map(([name, get]) => (
                    <tr key={name}>
                      <td className="py-2 pr-4 text-slate-400">{name}</td>
                      <td className="py-2 pr-4">{get(result.a)}</td>
                      <td className="py-2">{get(result.b)}</td>
                    </tr>
                  ))}
                  <tr>
                    <td className="py-2 pr-4 text-slate-400">Data quality</td>
                    <td className="py-2 pr-4"><DataQualityBadge quality={result.a.data_quality} /></td>
                    <td className="py-2"><DataQualityBadge quality={result.b.data_quality} /></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
