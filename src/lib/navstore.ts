import { createStore, get, set } from "idb-keyval";

export type Waypoint = { id: string; name: string; lat: number; lon: number; created: number };
export type Track = { id: string; name: string; start: number; end?: number; points: [number, number, number][] };

const store = createStore("navegacao", "dados");

export const loadWaypoints = async () => (await get<Waypoint[]>("waypoints", store)) ?? [];
export const saveWaypoints = (w: Waypoint[]) => set("waypoints", w, store);
export const loadTracks = async () => (await get<Track[]>("tracks", store)) ?? [];
export const saveTracks = (t: Track[]) => set("tracks", t, store);

export const newId = () => Math.random().toString(36).slice(2, 10);

/** Comprimento da trilha em milhas náuticas. */
export function trackLengthNm(t: Track): number {
  let d = 0;
  for (let i = 1; i < t.points.length; i++) {
    const [a1, o1] = t.points[i - 1], [a2, o2] = t.points[i];
    const dLat = ((a2 - a1) * Math.PI) / 180, dLon = ((o2 - o1) * Math.PI) / 180;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos((a1 * Math.PI) / 180) * Math.cos((a2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    d += 2 * 3440.065 * Math.asin(Math.sqrt(h));
  }
  return d;
}

/** Exporta trilha em GPX (pra abrir em outros apps). */
export function trackToGpx(t: Track): string {
  const pts = t.points.map(([lat, lon, ts]) => `<trkpt lat="${lat}" lon="${lon}"><time>${new Date(ts).toISOString()}</time></trkpt>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="Carta BTS" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>${t.name}</name><trkseg>${pts}</trkseg></trk></gpx>`;
}
