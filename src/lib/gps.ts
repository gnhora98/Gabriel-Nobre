// GPS: posição, velocidade (SOG) e rumo (COG) com suavização; mantém a tela ligada.
import { Capacitor, registerPlugin } from "@capacitor/core";
import { bearingDeg, distanceNm, KN_PER_MS } from "./geo";
import { t } from "../i18n";

// No app Android, GPS em segundo plano (continua com a tela apagada) e tela sempre ligada.
type BgLocation = { latitude: number; longitude: number; accuracy: number; speed: number | null; bearing: number | null; time: number | null };
type BgGeo = {
  addWatcher(o: Record<string, unknown>, cb: (l?: BgLocation, e?: { code?: string; message?: string }) => void): Promise<string>;
  removeWatcher(o: { id: string }): Promise<void>;
  openSettings(): Promise<void>;
};
const native = Capacitor.isNativePlatform();
const BackgroundGeolocation = native ? registerPlugin<BgGeo>("BackgroundGeolocation") : null;
const KeepAwake = native ? registerPlugin<{ keepAwake(): Promise<void>; allowSleep(): Promise<void> }>("KeepAwake") : null;
let nativeWatcher: string | null = null;

export type Fix = { lat: number; lon: number; acc: number; sog: number; cog: number | null; time: number };
// err é uma chave de tradução (i18n.ts)
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
    if (!("geolocation" in navigator)) emit(null, "gps.none");
    return;
  }
  if (BackgroundGeolocation) {
    watchId = -1;
    BackgroundGeolocation.addWatcher(
      { backgroundTitle: "Carta BTS", backgroundMessage: t("gps.bg"), requestPermissions: true, stale: false, distanceFilter: 0 },
      (l, e) => {
        if (e) {
          emit(last, e.code === "NOT_AUTHORIZED" ? "gps.nativeDenied" : "gps.noSignal");
          return;
        }
        if (l) handle(l.latitude, l.longitude, l.accuracy, l.speed, l.bearing, l.time ?? Date.now());
      },
    ).then((id) => (nativeWatcher = id));
    KeepAwake?.keepAwake().catch(() => {});
    return;
  }
  watchId = navigator.geolocation.watchPosition(
    (p) => {
      const { latitude: lat, longitude: lon, accuracy: acc, speed, heading } = p.coords;
      handle(lat, lon, acc, speed, heading, p.timestamp);
    },
    (e) => emit(last, e.code === 1 ? "gps.denied" : "gps.noSignal"),
    { enableHighAccuracy: true, maximumAge: 1000, timeout: 30000 },
  );
  keepAwake();
}

function handle(lat: number, lon: number, acc: number, speed: number | null, heading: number | null, time: number) {
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
}

function stop() {
  if (nativeWatcher) { BackgroundGeolocation?.removeWatcher({ id: nativeWatcher }); nativeWatcher = null; KeepAwake?.allowSleep().catch(() => {}); }
  else if (watchId != null && watchId >= 0) navigator.geolocation.clearWatch(watchId);
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
