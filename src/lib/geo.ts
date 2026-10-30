const R_NM = 3440.065;
const D2R = Math.PI / 180;

export type LatLon = { lat: number; lon: number };

/** Distância em milhas náuticas (haversine). */
export function distanceNm(a: LatLon, b: LatLon): number {
  const dLat = (b.lat - a.lat) * D2R;
  const dLon = (b.lon - a.lon) * D2R;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * D2R) * Math.cos(b.lat * D2R) * Math.sin(dLon / 2) ** 2;
  return 2 * R_NM * Math.asin(Math.sqrt(h));
}

/** Rumo verdadeiro de a para b (graus). */
export function bearingDeg(a: LatLon, b: LatLon): number {
  const y = Math.sin((b.lon - a.lon) * D2R) * Math.cos(b.lat * D2R);
  const x = Math.cos(a.lat * D2R) * Math.sin(b.lat * D2R) - Math.sin(a.lat * D2R) * Math.cos(b.lat * D2R) * Math.cos((b.lon - a.lon) * D2R);
  return (Math.atan2(y, x) / D2R + 360) % 360;
}

/** Ponto a `distNm` de `a` no rumo `brg`. */
export function destination(a: LatLon, brg: number, distNm: number): LatLon {
  const d = distNm / R_NM;
  const t = brg * D2R;
  const lat1 = a.lat * D2R, lon1 = a.lon * D2R;
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(t));
  const lon2 = lon1 + Math.atan2(Math.sin(t) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
  return { lat: lat2 / D2R, lon: lon2 / D2R };
}

/** Diferença angular assinada b - a em (-180, 180]. */
export function angleDiff(a: number, b: number): number {
  let d = (((b - a) % 360) + 540) % 360 - 180;
  if (d === -180) d = 180;
  return d;
}

export function formatLat(lat: number): string {
  const h = lat < 0 ? "S" : "N";
  const a = Math.abs(lat);
  const d = Math.floor(a);
  return `${String(d).padStart(2, "0")}°${((a - d) * 60).toFixed(3).padStart(6, "0")}'${h}`;
}

export function formatLon(lon: number): string {
  const h = lon < 0 ? "W" : "E";
  const a = Math.abs(lon);
  const d = Math.floor(a);
  return `${String(d).padStart(3, "0")}°${((a - d) * 60).toFixed(3).padStart(6, "0")}'${h}`;
}

export const KN_PER_MS = 1.943844;

const COMPASS = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSO", "SO", "OSO", "O", "ONO", "NO", "NNO"];
export function compass(deg: number): string {
  return COMPASS[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];
}
