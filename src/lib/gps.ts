// GPS: posição, velocidade (SOG) e rumo (COG) com suavização; mantém a tela ligada.
import { bearingDeg, distanceNm, KN_PER_MS } from "./geo";

export type Fix = { lat: number; lon: number; acc: number; sog: number; cog: number | null; time: number };
type Listener = (f: Fix | null, err?: string) => void;

let watchId: number | null = null;
let last: Fix | null = null;
let prev: { lat: number; lon: number; time: number } | null = null;
const listeners = new Set<Listener>();
let wakeLock: { release(): Promise<void> } | null = null;

export const lastFix = () => last;

export function onFix(fn: Listener): () => void {
  listeners.add(fn);
  if (last) fn(last);
  start();
  return () => {
    listeners.delete(fn);
    if (!listeners.size) stop();
  };
}

function emit(f: Fix | null, err?: string) {
  listeners.forEach((l) => l(f, err));
}

function start() {
  if (watchId != null || !("geolocation" in navigator)) {
    if (!("geolocation" in navigator)) emit(null, "Este aparelho não tem GPS disponível no navegador.");
    return;
  }
  watchId = navigator.geolocation.watchPosition(
    (p) => {
      const { latitude: lat, longitude: lon, accuracy: acc, speed, heading } = p.coords;
      const time = p.timestamp;
      let sog = speed != null && !Number.isNaN(speed) ? speed * KN_PER_MS : NaN;
      let cog: number | null = heading != null && !Number.isNaN(heading) ? heading : null;
      // Sem velocidade do GPS (comum no iPhone parado/PWA): calcula pela variação de posição.
      if (prev && time - prev.time > 1500) {
        const dNm = distanceNm(prev, { lat, lon });
        const dtH = (time - prev.time) / 3_600_000;
        const derived = dNm / dtH;
        if (Number.isNaN(sog)) sog = derived;
        if (cog == null && dNm * 1852 > Math.max(5, acc / 2)) cog = bearingDeg(prev, { lat, lon });
      }
      if (Number.isNaN(sog)) sog = 0;
      if (!prev || time - prev.time > 1500) prev = { lat, lon, time };
      // suavização exponencial leve
      if (last) sog = last.sog * 0.4 + sog * 0.6;
      if (sog < 0.3) cog = last?.cog ?? cog; // parado: mantém último rumo
      last = { lat, lon, acc, sog, cog, time };
      emit(last);
    },
    (e) => emit(last, e.code === 1 ? "Permita o acesso à localização pra usar o GPS." : "Sem sinal de GPS."),
    { enableHighAccuracy: true, maximumAge: 1000, timeout: 30000 },
  );
  keepAwake();
}

function stop() {
  if (watchId != null) navigator.geolocation.clearWatch(watchId);
  watchId = null;
  wakeLock?.release().catch(() => {});
  wakeLock = null;
}

async function keepAwake() {
  try {
    const nav = navigator as Navigator & { wakeLock?: { request(t: "screen"): Promise<{ release(): Promise<void> }> } };
    if (nav.wakeLock && !wakeLock) wakeLock = await nav.wakeLock.request("screen");
  } catch {
    /* sem suporte */
  }
}

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && watchId != null) {
    wakeLock = null;
    keepAwake();
  }
});
