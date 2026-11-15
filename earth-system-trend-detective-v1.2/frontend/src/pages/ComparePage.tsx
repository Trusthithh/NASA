import React, { useEffect, useState } from "react";
import { ArrowLeftRight, GitCompare } from "lucide-react";
import { PlaceComparison } from "../components/Compare/PlaceComparison";
import { VariableCorrelation } from "../components/Compare/VariableCorrelation";
import { fetchDatasets, getErrorMessage } from "../services/api";
import { DatasetInfo } from "../types/science";
import { container, page } from "../styles/ui";

type Tab = "places" | "variables";

const TABS: Array<{ id: Tab; label: string; icon: React.ReactNode }> = [
  { id: "places", label: "Compare two places", icon: <ArrowLeftRight className="h-4 w-4" /> },
  { id: "variables", label: "Variable correlation", icon: <GitCompare className="h-4 w-4" /> },
];

export const ComparePage: React.FC = () => {
  const [tab, setTab] = useState<Tab>("places");
  const [datasets, setDatasets] = useState<DatasetInfo[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDatasets()
      .then(setDatasets)
      .catch((err) => setError(getErrorMessage(err, "Failed to load dataset metadata.")));
  }, []);

  return (
    <div className={`${page} py-10`}>
      <div className={`${container} space-y-8`}>
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">Compare</h1>
          <p className="mt-1 text-sm text-slate-300">
            Compare the same variable at two places, or test how two variables move together at one place.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={
                "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors " +
                (tab === t.id
                  ? "border-cyan-400 bg-cyan-900/60 text-white"
                  : "border-slate-700 bg-slate-900/70 text-slate-300 hover:border-cyan-600")
              }
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="rounded-2xl border border-rose-800/60 bg-rose-950/40 p-4 text-sm text-rose-200">{error}</div>
        )}

        {tab === "places" && <PlaceComparison datasets={datasets} />}
        {tab === "variables" && <VariableCorrelation datasets={datasets} />}
      </div>
    </div>
  );
};
