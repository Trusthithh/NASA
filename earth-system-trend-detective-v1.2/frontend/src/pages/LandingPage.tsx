import React from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, MapPin, Sparkles } from "lucide-react";
import { EarthGlobe } from "../components/Globe/EarthGlobe";
import { HotspotPicker } from "../components/Hotspots/HotspotPicker";
import { Hotspot } from "../data/hotspots";
import { LocationSearch } from "../components/Search/LocationSearch";
import { useSelectedLocation } from "../context/LocationContext";
import { LocationResult } from "../types/science";
import { SelectedLocation, formatCoords, investigateUrl } from "../utils/geo";
import { btnPrimary, chip } from "../styles/ui";

export const LandingPage: React.FC = () => {
  const navigate = useNavigate();
  const { location, setLocation } = useSelectedLocation();

  // Search jumps straight to the Trend Analyser with the best match.
  const handleSelectPlace = (place: LocationResult) => {
    const chosen: SelectedLocation = { lat: place.lat, lon: place.lon, name: place.name };
    setLocation(chosen);
    navigate(investigateUrl(chosen));
  };

  // Clicking the globe selects a point; the card below opens it in the analyser.
  const handlePick = (lat: number, lon: number) => {
    setLocation({ lat, lon, name: formatCoords(lat, lon) });
  };

  // One-click hotspot: select it on the globe and show its short story.
  const handleHotspot = (h: Hotspot) => {
    setLocation({ lat: h.lat, lon: h.lon, name: h.name, story: h.story, dataset: h.dataset });
  };

  return (
    <div className="relative h-[calc(100vh-4rem)] min-h-[700px] overflow-hidden bg-[#050811]">
      {/* Globe: full width on phones (below the text), right-hand 62% on large screens. */}
      <div className="absolute inset-x-0 bottom-0 top-72 lg:inset-y-0 lg:left-[38%] lg:right-0">
        <EarthGlobe selected={location} onPick={handlePick} heightClass="h-full" distance={8.5} />
      </div>

      {/* Text and search: top on phones, left-hand column on large screens. */}
      <div className="pointer-events-none relative z-10 flex h-full flex-col items-center px-4 pt-8 lg:w-[38%] lg:items-start lg:justify-center lg:px-10 lg:pt-0">
        <div className="pointer-events-auto text-center lg:text-left">
          <div className={`${chip} mb-3`}>
            <Sparkles className="h-3.5 w-3.5 animate-pulse text-cyan-400" />
            <span>NASA Space Apps Challenge</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-5xl">
            Earth System{" "}
            <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              Trend Detective
            </span>
          </h1>
          <p className="mt-3 max-w-xl text-sm text-slate-300 sm:text-base">
            Search a place, or click the globe, to investigate decades of NASA climate data.
          </p>
        </div>

        <div className="pointer-events-auto mt-6 w-full max-w-2xl">
          <LocationSearch onSelectLocation={handleSelectPlace} />
        </div>

        <div className="pointer-events-auto mt-5 hidden w-full max-w-2xl lg:block">
          <HotspotPicker onSelect={handleHotspot} activeName={location?.name} />
        </div>

        <div className="flex-1 lg:hidden" />

        {location && (
          <div className="pointer-events-auto mb-8 mt-6 flex w-full max-w-xl flex-col items-start justify-between gap-3 rounded-2xl border border-cyan-800/60 bg-slate-900/85 p-4 shadow-2xl backdrop-blur-md sm:flex-row sm:items-center lg:mb-0 lg:max-w-md lg:flex-col lg:items-start">
            <span className="flex items-center gap-2 text-sm text-slate-100">
              <MapPin className="h-4 w-4 text-amber-400" />
              <span>
                <span className="block font-medium">{location.name}</span>
                <span className="block font-mono text-xs text-slate-400">
                  {formatCoords(location.lat, location.lon)}
                </span>
                {location.story && (
                  <span className="mt-1 block max-w-sm text-xs leading-relaxed text-slate-300">
                    {location.story}
                  </span>
                )}
              </span>
            </span>
            <button className={btnPrimary} onClick={() => navigate(investigateUrl(location))}>
              Open in Trend Analyser <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
