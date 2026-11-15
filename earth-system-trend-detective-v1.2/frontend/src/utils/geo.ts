export interface SelectedLocation {
  lat: number;
  lon: number;
  name: string;
  story?: string; // set when the place is a one-click hotspot
  dataset?: string; // recommended variable for that hotspot
}

export function formatCoords(lat: number, lon: number): string {
  return `${lat.toFixed(2)}°, ${lon.toFixed(2)}°`;
}

export function investigateUrl(loc: SelectedLocation, dataset?: string): string {
  const qs = new URLSearchParams({
    lat: String(loc.lat),
    lon: String(loc.lon),
    name: loc.name,
  });
  const chosen = dataset ?? loc.dataset;
  if (chosen) qs.set("dataset", chosen);
  return `/investigate?${qs.toString()}`;
}
