export interface SelectedLocation {
  lat: number;
  lon: number;
  name: string;
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
  if (dataset) qs.set("dataset", dataset);
  return `/investigate?${qs.toString()}`;
}
