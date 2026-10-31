import { coord } from "../units";
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

export const formatLat = (lat: number) => coord(lat, true);
export const formatLon = (lon: number) => coord(lon, false);

export const KN_PER_MS = 1.943844;

export { compass } from "../i18n";
