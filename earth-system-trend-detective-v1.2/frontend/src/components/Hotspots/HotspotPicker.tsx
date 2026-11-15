import React from "react";
import { Compass } from "lucide-react";
import { HOTSPOTS, Hotspot } from "../../data/hotspots";

interface HotspotPickerProps {
  onSelect: (hotspot: Hotspot) => void;
  activeName?: string;
  label?: string;
}

export const HotspotPicker: React.FC<HotspotPickerProps> = ({
  onSelect,
  activeName,
  label = "Try a hotspot",
}) => (
  <div>
    <div className="mb-2 flex items-center gap-1.5 font-mono text-xs uppercase tracking-wider text-slate-400">
      <Compass className="h-3.5 w-3.5 text-cyan-400" />
      {label}
    </div>
    <div className="flex flex-wrap gap-2">
      {HOTSPOTS.map((h) => {
        const active = h.name === activeName;
        return (
          <button
            key={h.id}
            type="button"
            onClick={() => onSelect(h)}
            className={
              "rounded-full border px-3 py-1 text-xs transition-colors " +
              (active
                ? "border-cyan-400 bg-cyan-900/60 text-white"
                : "border-slate-700 bg-slate-900/70 text-slate-300 hover:border-cyan-600 hover:text-white")
            }
          >
            {h.name}
          </button>
        );
      })}
    </div>
  </div>
);
