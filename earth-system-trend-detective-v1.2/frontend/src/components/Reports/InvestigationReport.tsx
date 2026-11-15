import React from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle, Award, CheckCircle2, FileDown, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { InvestigationResponse } from "../../types/science";
import { btnPrimary, card, subCard } from "../../styles/ui";
import { DataQualityBadge } from "./DataQualityBadge";
import { ChangePointCard, RecordsCard } from "./InsightPanels";

interface InvestigationReportProps {
  data: InvestigationResponse;
}

const fmt = (n: number, digits = 3) => n.toFixed(digits);
const fmtP = (p: number) => (p < 0.0001 ? "< 0.0001" : p.toFixed(4));
const year = (d: string) => d.slice(0, 4);

function csvCell(value: string | number | null): string {
  if (value === null) return "";
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const TrendIcon: React.FC<{ direction: string }> = ({ direction }) => {
  if (direction === "increasing") return <TrendingUp className="h-6 w-6 text-emerald-400" />;
  if (direction === "decreasing") return <TrendingDown className="h-6 w-6 text-rose-400" />;
  return <Minus className="h-6 w-6 text-amber-400" />;
};

const Stat: React.FC<{ title: string; value: string; note?: string }> = ({ title, value, note }) => (
  <div className={subCard}>
    <div className="font-mono text-xs uppercase tracking-wider text-slate-400">{title}</div>
    <div className="mt-1 text-xl font-bold text-white">{value}</div>
    {note && <div className="mt-1 text-xs text-slate-400">{note}</div>}
  </div>
);

export const InvestigationReport: React.FC<InvestigationReportProps> = ({ data }) => {
  const { statistics: st, time_series, unit } = data;
  const perDecade = st.sen_slope * 10;
  const ci = st.sen_slope_ci.map((c) => c * 10);

  const exportCSV = () => {
    const header = ["date", "observed_value", "fitted_trend", "anomaly"];
    const rows = time_series.map((p) =>
      [p.date, p.value, p.trend_value, p.anomaly].map(csvCell).join(",")
    );
    const blob = new Blob([[header.join(","), ...rows].join("\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `trend_${data.dataset_id}_${data.time_period}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-8">
      <div className={`${card} relative overflow-hidden`}>
        <div className="pointer-events-none absolute right-0 top-0 p-8 opacity-10">
          <Award className="h-48 w-48 text-cyan-400" />
        </div>
        <div className="relative z-10 flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="mb-2 font-mono text-xs uppercase tracking-widest text-cyan-400">
              NASA Scientific Investigation Report - {data.time_period}
            </div>
            <h2 className="text-3xl font-extrabold tracking-tight text-white">{data.location_name}</h2>
            <p className="mt-1 font-medium text-slate-300">{data.variable_name}</p>
            <p className="mt-1 text-xs text-slate-400">{data.data_source}</p>
            <div className="mt-3">
              <DataQualityBadge quality={data.data_quality} />
            </div>
          </div>
          <button onClick={exportCSV} className={`${btnPrimary} self-start md:self-auto`}>
            <FileDown className="h-4 w-4" />
            Export CSV
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className={subCard}>
          <div className="font-mono text-xs uppercase tracking-wider text-slate-400">Trend</div>
          <div className="mt-1 flex items-center gap-2 text-xl font-bold capitalize text-white">
            <TrendIcon direction={st.trend_direction} />
            {st.trend_direction}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            {st.is_significant ? "Statistically significant" : "Not statistically significant"}
          </div>
        </div>
        <Stat
          title="Theil-Sen slope"
          value={`${perDecade >= 0 ? "+" : ""}${fmt(perDecade)} ${unit}/decade`}
          note={`95% interval ${fmt(ci[0])} to ${fmt(ci[1])}`}
        />
        <Stat title="p-value" value={fmtP(st.p_value)} note={st.test_used} />
        <Stat
          title="Serial correlation"
          value={st.autocorrelation_detected ? "Detected" : "Not detected"}
          note={`${st.n_observations} ${st.resolution} observations`}
        />
      </div>

      <div className={card}>
        <h3 className="mb-4 text-lg font-bold text-white">Observed series, fitted trend and anomalies</h3>
        <div className="h-80 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={time_series} margin={{ top: 8, right: 16, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
              <XAxis dataKey="date" tickFormatter={year} stroke="#94a3b8" minTickGap={32} />
              <YAxis stroke="#94a3b8" domain={["auto", "auto"]} />
              <Tooltip
                contentStyle={{ background: "#0f172a", border: "1px solid #155e75" }}
                formatter={(v) => (typeof v === "number" ? v.toFixed(3) : String(v))}
              />
              <Legend />
              {data.change_point && data.change_point.is_significant && (
                <ReferenceLine
                  x={data.change_point.change_date}
                  stroke="#a78bfa"
                  strokeDasharray="4 4"
                  label={{ value: `Change ${data.change_point.resolution === "monthly" ? data.change_point.change_date : data.change_point.change_year}`, fill: "#c4b5fd", fontSize: 11, position: "top" }}
                />
              )}
              <Bar dataKey="anomaly" name={`Anomaly (${unit})`} fill="#475569" opacity={0.6} />
              <Line type="monotone" dataKey="value" name={`Observed (${unit})`} stroke="#22d3ee" dot={false} strokeWidth={2} />
              <Line type="linear" dataKey="trend_value" name="Fitted Theil-Sen trend" stroke="#f59e0b" dot={false} strokeWidth={2} strokeDasharray="6 4" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className={card}>
        <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-white">
          <CheckCircle2 className="h-5 w-5 text-emerald-400" />
          Key findings
        </h3>
        <ul className="space-y-3 text-sm leading-relaxed text-slate-200">
          {data.key_findings.map((f, i) => (
            <li key={i}>{f}</li>
          ))}
        </ul>
      </div>

      <ChangePointCard changePoint={data.change_point} unit={unit} />
      <RecordsCard records={data.records} unit={unit} />

      {data.seasonal_insights.length > 0 && (
        <div className={card}>
          <h3 className="mb-4 text-lg font-bold text-white">Seasonal breakdown</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="font-mono text-xs uppercase text-slate-400">
                <tr>
                  <th className="py-2 pr-4">Season</th>
                  <th className="py-2 pr-4">Mean ({unit})</th>
                  <th className="py-2 pr-4">Trend per decade</th>
                  <th className="py-2">Years</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800 text-slate-200">
                {data.seasonal_insights.map((s) => (
                  <tr key={s.season}>
                    <td className="py-2 pr-4">{s.season}</td>
                    <td className="py-2 pr-4">{fmt(s.mean_value)}</td>
                    <td className="py-2 pr-4">
                      {s.trend_per_decade === null ? "n/a (too few years)" : fmt(s.trend_per_decade)}
                    </td>
                    <td className="py-2">{s.n_years}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className={card}>
        <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-white">
          <AlertTriangle className="h-5 w-5 text-amber-400" />
          Limitations
        </h3>
        <ul className="list-disc space-y-2 pl-5 text-sm text-slate-300">
          {data.limitations.map((l, i) => (
            <li key={i}>{l}</li>
          ))}
        </ul>
      </div>
    </div>
  );
};
