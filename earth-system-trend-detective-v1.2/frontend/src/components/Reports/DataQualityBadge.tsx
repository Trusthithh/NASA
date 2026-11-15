import React, { useState } from "react";
import { ChevronDown, ChevronUp, ShieldCheck } from "lucide-react";
import { DataQuality } from "../../types/science";

const STYLES: Record<DataQuality["level"], { chip: string; text: string }> = {
  good: { chip: "border-emerald-700/60 bg-emerald-950/50 text-emerald-300", text: "Good data quality" },
  fair: { chip: "border-amber-700/60 bg-amber-950/50 text-amber-300", text: "Fair data quality" },
  poor: { chip: "border-rose-700/60 bg-rose-950/50 text-rose-300", text: "Poor data quality" },
};

export const DataQualityBadge: React.FC<{ quality: DataQuality }> = ({ quality }) => {
  const [open, setOpen] = useState(false);
  const style = STYLES[quality.level];

  return (
    <div className="inline-block text-left">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium ${style.chip}`}
        aria-expanded={open}
      >
        <ShieldCheck className="h-3.5 w-3.5" />
        {style.text} - {quality.coverage_pct.toFixed(1)}% coverage
        {open ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
      </button>
      {open && (
        <div className="mt-2 max-w-md rounded-2xl border border-slate-800 bg-slate-950/80 p-4 text-xs text-slate-300">
          <div className="mb-2 grid grid-cols-2 gap-x-6 gap-y-1 font-mono text-slate-400">
            <span>Valid months</span>
            <span className="text-slate-200">
              {quality.valid_months} / {quality.expected_months}
            </span>
            <span>Longest gap</span>
            <span className="text-slate-200">{quality.longest_gap_months} months</span>
            <span>Complete years</span>
            <span className="text-slate-200">{quality.complete_years}</span>
            <span>Temporal continuity</span>
            <span className="text-slate-200">{quality.temporal_continuity_pct.toFixed(1)}%</span>
            <span>Duplicate months</span>
            <span className="text-slate-200">{quality.duplicate_months}</span>
            <span>Source breaks</span>
            <span className="text-slate-200">{quality.source_break_years.length ? quality.source_break_years.join(", ") : "None flagged"}</span>
          </div>
          <ul className="list-disc space-y-1 pl-4">
            {quality.notes.map((n, i) => (
              <li key={i}>{n}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
