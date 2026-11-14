import React, { useEffect, useRef, useState } from "react";
import { ArrowRight, Loader2, MapPin, Search } from "lucide-react";
import { getErrorMessage, searchLocations } from "../../services/api";
import { LocationResult } from "../../types/science";

interface LocationSearchProps {
  onSelectLocation: (location: LocationResult) => void;
  placeholder?: string;
}

export const LocationSearch: React.FC<LocationSearchProps> = ({
  onSelectLocation,
  placeholder = "Search a city or town and press Enter...",
}) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<LocationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const requestId = useRef(0);
  const resolvedQuery = useRef(""); // the query that `results` belongs to

  const fetchResults = async (q: string): Promise<LocationResult[]> => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const data = await searchLocations(q);
      if (id !== requestId.current) return [];
      setResults(data);
      resolvedQuery.current = q;
      if (data.length === 0) setError("No matching places found. Try another spelling.");
      return data;
    } catch (err) {
      if (id === requestId.current) {
        setResults([]);
        setError(getErrorMessage(err, "Location search failed."));
      }
      return [];
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  };

  // Live suggestions while typing.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      requestId.current++;
      setResults([]);
      setError(null);
      setLoading(false);
      return;
    }
    if (q === resolvedQuery.current) return;
    const timer = setTimeout(() => void fetchResults(q), 350);
    return () => clearTimeout(timer);
  }, [query]);

  const choose = (location: LocationResult) => {
    setOpen(false);
    onSelectLocation(location);
  };

  // Enter / Go: jump straight to the best match.
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (q.length < 2) {
      setError("Enter at least 2 characters.");
      return;
    }
    const data =
      q === resolvedQuery.current && results.length > 0 ? results : await fetchResults(q);
    if (data.length > 0) choose(data[0]);
  };

  return (
    <div className="mx-auto w-full max-w-2xl">
      <form onSubmit={handleSubmit} className="relative flex items-center">
        <Search className="absolute left-4 h-5 w-5 text-cyan-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          placeholder={placeholder}
          aria-label="Search for a place"
          className="w-full rounded-2xl border border-cyan-800/60 bg-slate-900/90 py-4 pl-12 pr-32 text-white placeholder-slate-400 shadow-xl backdrop-blur-md transition-all focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-500/30"
        />
        <button
          type="submit"
          disabled={loading}
          className="absolute right-2 flex items-center gap-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 px-5 py-2.5 font-medium text-white shadow-lg shadow-cyan-600/30 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-60"
        >
          <span>Analyse</span>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
        </button>
      </form>

      {error && <p className="mt-3 text-center text-sm text-rose-300">{error}</p>}

      {open && results.length > 0 && (
        <div className="mt-2 divide-y divide-cyan-950 overflow-hidden rounded-2xl border border-cyan-900/60 bg-slate-900/95 shadow-2xl backdrop-blur-md">
          {results.map((loc, idx) => (
            <button
              type="button"
              key={`${loc.lat}-${loc.lon}-${idx}`}
              onMouseDown={(e) => {
                e.preventDefault();
                choose(loc);
              }}
              className="group flex w-full items-center justify-between px-5 py-3 text-left transition-colors hover:bg-cyan-950/40"
            >
              <span className="flex items-center gap-3">
                <MapPin className="h-4 w-4 text-cyan-400" />
                <span>
                  <span className="block font-medium text-white">{loc.name}</span>
                  <span className="block text-xs text-slate-400">
                    {[loc.admin1, loc.country].filter(Boolean).join(", ")} - {loc.lat.toFixed(2)}°,{" "}
                    {loc.lon.toFixed(2)}°
                  </span>
                </span>
              </span>
              <ArrowRight className="h-4 w-4 text-slate-500 transition-colors group-hover:text-cyan-400" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
