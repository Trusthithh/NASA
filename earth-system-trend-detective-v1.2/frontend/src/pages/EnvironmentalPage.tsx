import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Droplets, ShieldAlert, Thermometer, Wind } from "lucide-react";
import { chip, container, page } from "../styles/ui";

const challenges = [
  {
    title: "Surface Warming",
    icon: <Thermometer className="h-6 w-6 text-rose-400" />,
    description:
      "Long-term rise in average surface air temperature. Scientific assessments attribute " +
      "most observed global warming to human greenhouse-gas emissions.",
    indicator: "MERRA-2 Earth Skin Temperature",
    action: "Support decarbonisation and the transition to renewable energy.",
    dataset: "skin_temperature",
  },
  {
    title: "Water Stress & Drought",
    icon: <Droplets className="h-6 w-6 text-cyan-400" />,
    description:
      "Changes in precipitation and root-zone soil wetness can affect crops, water supply " +
      "and wildfire risk. Local trends vary widely by region.",
    indicator: "MERRA-2 Root Zone Soil Wetness and bias-corrected precipitation",
    action: "Invest in efficient irrigation and drought-resilient agriculture.",
    dataset: "soil_moisture",
  },
  {
    title: "Atmospheric Aerosols",
    icon: <Wind className="h-6 w-6 text-amber-400" />,
    description:
      "Airborne particles affect air quality, health and the planet's radiation budget; " +
      "aerosol optical depth is a common proxy for loading.",
    indicator: "MERRA-2 Aerosol Optical Depth (550 nm)",
    action: "Enforce emission controls and monitor air-quality indices.",
    dataset: "aerosol",
  },
];

export const EnvironmentalPage: React.FC = () => (
  <div className={`${page} py-12`}>
    <div className={`${container} space-y-12`}>
      <div className="mx-auto max-w-3xl space-y-4 text-center">
        <div className={chip}>
          <ShieldAlert className="h-3.5 w-3.5 text-cyan-400" />
          <span>Planetary Health Indicators</span>
        </div>
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl">Environmental Challenges</h1>
        <p className="text-base leading-relaxed text-slate-300">
          Connect local NASA Earth science time-series to wider environmental themes. A local
          trend is an observation, not an attribution of cause.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
        {challenges.map((c) => (
          <div
            key={c.title}
            className="flex flex-col justify-between space-y-6 rounded-3xl border border-slate-800 bg-slate-900/90 p-6 shadow-xl sm:p-8"
          >
            <div className="space-y-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-800 bg-slate-950">
                {c.icon}
              </div>
              <h3 className="text-xl font-bold text-white">{c.title}</h3>
              <p className="text-sm leading-relaxed text-slate-300">{c.description}</p>
            </div>
            <div className="space-y-2 border-t border-slate-800 pt-4">
              <div className="font-mono text-xs text-cyan-400">Indicator: {c.indicator}</div>
              <div className="text-xs text-slate-400">
                <strong>Action:</strong> {c.action}
              </div>
              <Link
                to={`/investigate?dataset=${c.dataset}`}
                className="inline-flex items-center gap-1 pt-2 text-sm font-medium text-cyan-400 hover:text-cyan-300"
              >
                Investigate this indicator <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  </div>
);
