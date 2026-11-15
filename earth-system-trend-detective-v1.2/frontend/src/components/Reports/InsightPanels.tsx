import React from "react";
import { Activity, Flame, Snowflake, Trophy } from "lucide-react";
import { ChangePoint, RecordEntry, RecordsResult } from "../../types/science";
import { card, subCard } from "../../styles/ui";

const fmt = (n: number) => n.toFixed(3);
const fmtP = (p: number) => (p < 0.0001 ? "< 0.0001" : p.toFixed(4));

export const ChangePointCard: React.FC<{ changePoint: ChangePoint | null; unit: string }> = ({
  changePoint,
  unit,
}) => (
  <div className={card}>
    <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-white">
      <Activity className="h-5 w-5 text-cyan-400" />
      Change-point detection
    </h3>
    {changePoint === null ? (
      <p className="text-sm text-slate-300">
        Not available: the series has no variability or is too short.
      </p>
    ) : (
      <div className="space-y-4">
        <p className="text-sm leading-relaxed text-slate-200">
          {changePoint.is_significant
            ? `A nominally significant step change was detected at ${changePoint.resolution === "monthly" ? changePoint.change_date : changePoint.change_year}.`
            : "No nominally significant change point was detected; any shift in the record could be random variation."}
        </p>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div className={subCard}>
            <div className="font-mono text-xs text-slate-400">Most likely {changePoint.resolution === "monthly" ? "month" : "year"}</div>
            <div className="mt-1 text-lg font-bold text-white">{changePoint.resolution === "monthly" ? changePoint.change_date : changePoint.change_year}</div>
          </div>
          <div className={subCard}>
            <div className="font-mono text-xs text-slate-400">Level before</div>
            <div className="mt-1 text-lg font-bold text-white">{fmt(changePoint.level_before)}</div>
            <div className="text-xs text-slate-500">{unit}</div>
          </div>
          <div className={subCard}>
            <div className="font-mono text-xs text-slate-400">Level after</div>
            <div className="mt-1 text-lg font-bold text-white">{fmt(changePoint.level_after)}</div>
            <div className="text-xs text-slate-500">{unit}</div>
          </div>
          <div className={subCard}>
            <div className="font-mono text-xs text-slate-400">Pettitt p-value</div>
            <div className="mt-1 text-lg font-bold text-white">{fmtP(changePoint.p_value)}</div>
            <div className="text-xs text-slate-500">shift {changePoint.shift >= 0 ? "+" : ""}{fmt(changePoint.shift)}</div>
          </div>
        </div>
        <p className="text-xs text-slate-400">
          Pettitt p-values are asymptotic and assume independent observations; serial correlation is
          not corrected and can inflate false detections. Treat this as exploratory. A step change
          is not the same as a gradual trend.
        </p>
      </div>
    )}
  </div>
);

const EntryList: React.FC<{ title: string; entries: RecordEntry[]; unit: string; icon: React.ReactNode }> = ({
  title,
  entries,
  unit,
  icon,
}) => (
  <div className={subCard}>
    <div className="mb-2 flex items-center gap-2 font-mono text-xs uppercase tracking-wider text-slate-400">
      {icon}
      {title}
    </div>
    {entries.length === 0 ? (
      <p className="text-xs text-slate-500">Not enough data.</p>
    ) : (
      <ol className="space-y-1 text-sm text-slate-200">
        {entries.map((e, i) => (
          <li key={e.label} className="flex justify-between gap-4">
            <span>
              {i + 1}. {e.label}
            </span>
            <span className="font-mono text-slate-300">
              {fmt(e.value)} {unit}
            </span>
          </li>
        ))}
      </ol>
    )}
  </div>
);

export const RecordsCard: React.FC<{ records: RecordsResult; unit: string }> = ({ records, unit }) => (
  <div className={card}>
    <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-white">
      <Trophy className="h-5 w-5 text-amber-400" />
      Records and extremes
    </h3>

    {records.latest_year !== null && records.latest_rank_high !== null && (
      <p className="mb-4 text-sm leading-relaxed text-slate-200">
        The latest complete year, {records.latest_year}, ranks{" "}
        <strong>{records.latest_rank_high}</strong> of {records.n_years} for the highest annual value
        {records.latest_value !== null ? ` (${fmt(records.latest_value)} ${unit})` : ""}. Of the 5 highest
        years, {records.highest5_in_last_decade} fall in the last 10 years; of the 5 lowest,{" "}
        {records.lowest5_in_last_decade} do.
      </p>
    )}

    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <EntryList title="Highest years" entries={records.highest_years} unit={unit} icon={<Flame className="h-3.5 w-3.5 text-rose-400" />} />
      <EntryList title="Lowest years" entries={records.lowest_years} unit={unit} icon={<Snowflake className="h-3.5 w-3.5 text-cyan-400" />} />
      <EntryList title="Highest months" entries={records.highest_months} unit={unit} icon={<Flame className="h-3.5 w-3.5 text-rose-400" />} />
      <EntryList title="Lowest months" entries={records.lowest_months} unit={unit} icon={<Snowflake className="h-3.5 w-3.5 text-cyan-400" />} />
    </div>

    <p className="mt-4 text-xs text-slate-400">
      Record-setting years (a new high or low for the period so far):{" "}
      {records.record_high_years.length > 0 ? `highs ${records.record_high_years.join(", ")}` : "no new highs"};{" "}
      {records.record_low_years.length > 0 ? `lows ${records.record_low_years.join(", ")}` : "no new lows"}.
    </p>
  </div>
);
