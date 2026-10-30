// Baixa e guarda (offline) previsão do tempo, mar, vento observado e maré observada.
// Fontes:
//  - Tempo/vento: ECMWF IFS 0,25° via Open-Meteo (UV/visibilidade do best_match)
//  - Ondas/swell: Open-Meteo Marine (MeteoFrance MFWAM / ECMWF WAM)
//  - Vento observado: METAR SBSV (Aeroporto de Salvador) via função Netlify /api/metar
//  - Nível do mar observado: marégrafo EMSAL Salvador (IOC Sea Level Monitoring)
import { get, set } from "idb-keyval";
import { MARINE_POINTS, CITY_POINT } from "../data/beaches";

const TZ = "America%2FBahia";

export type Weather = {
  time: number[];
  temp: number[];
  feels: number[];
  precip: number[];
  precipProb: number[];
  code: number[];
  cloud: number[];
  windKn: number[];
  windDir: number[];
  gustKn: number[];
  uv: (number | null)[];
  visibility: (number | null)[];
  daily: { time: number[]; sunrise: number[]; sunset: number[]; uvMax: (number | null)[] };
};

export type Marine = {
  time: number[];
  wave: number[];
  waveDir: number[];
  wavePeriod: number[];
  swell: number[];
  swellDir: number[];
  swellPeriod: number[];
  windWave: number[];
  seaLevel: (number | null)[];
};

export type Metar = { time: number; raw: string; windDir: number | null; windKn: number; gustKn: number | null; temp: number | null; visib: string | null };
export type SeaLevelObs = { time: number; level: number }[];

export type Bundle = {
  fetchedAt: number;
  weather: Weather;
  marine: Record<string, Marine>;
  metar?: Metar | null;
  seaObs?: SeaLevelObs | null;
};

const KEY = "forecast-bundle-v1";

// Open-Meteo devolve horário local sem fuso (America/Bahia = UTC-3, sem horário de verão).
const parseLocal = (s: string) => Date.parse(s.length === 10 ? `${s}T00:00:00-03:00` : `${s}:00-03:00`);

async function getJson(url: string, timeoutMs = 20000, tries = 2): Promise<any> {
  for (let k = 1; ; k++) {
    try {
      return await getJsonOnce(url, timeoutMs);
    } catch (e) {
      if (k >= tries) throw e;
      await new Promise((r) => setTimeout(r, 1500 * k));
    }
  }
}

async function getJsonOnce(url: string, timeoutMs: number): Promise<any> {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctrl.signal, cache: "no-store" });
    if (!r.ok) throw new Error(`${r.status} ${url}`);
    return await r.json();
  } finally {
    clearTimeout(id);
  }
}

async function fetchWeather(): Promise<Weather> {
  const base = `https://api.open-meteo.com/v1/forecast?latitude=${CITY_POINT.lat}&longitude=${CITY_POINT.lon}&timezone=${TZ}&wind_speed_unit=kn&past_days=1&forecast_days=8`;
  const vars = "&hourly=temperature_2m,apparent_temperature,precipitation,precipitation_probability,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m&daily=sunrise,sunset";
  const [ec, bm] = await Promise.all([
    // ECMWF primeiro; se falhar, cai pro melhor modelo automático do Open-Meteo.
    getJson(`${base}&models=ecmwf_ifs025${vars}`).catch(() => getJson(`${base}${vars}`)),
    getJson(`${base}&hourly=uv_index,visibility,precipitation_probability&daily=uv_index_max`).catch(() => null),
  ]);
  const h = ec.hourly;
  const prob: number[] = h.precipitation_probability.map((v: number | null, i: number) => v ?? bm?.hourly?.precipitation_probability?.[i] ?? 0);
  return {
    time: h.time.map(parseLocal),
    temp: h.temperature_2m,
    feels: h.apparent_temperature,
    precip: h.precipitation,
    precipProb: prob,
    code: h.weather_code,
    cloud: h.cloud_cover,
    windKn: h.wind_speed_10m,
    windDir: h.wind_direction_10m,
    gustKn: h.wind_gusts_10m,
    uv: bm?.hourly?.uv_index ?? h.time.map(() => null),
    visibility: bm?.hourly?.visibility ?? h.time.map(() => null),
    daily: {
      time: ec.daily.time.map(parseLocal),
      sunrise: ec.daily.sunrise.map(parseLocal),
      sunset: ec.daily.sunset.map(parseLocal),
      uvMax: bm?.daily?.uv_index_max ?? ec.daily.time.map(() => null),
    },
  };
}

async function fetchMarine(lat: number, lon: number): Promise<Marine> {
  const d = await getJson(
    `https://marine-api.open-meteo.com/v1/marine?latitude=${lat}&longitude=${lon}&timezone=${TZ}&past_days=1&forecast_days=8` +
      `&hourly=wave_height,wave_direction,wave_period,swell_wave_height,swell_wave_direction,swell_wave_period,wind_wave_height,sea_level_height_msl`,
  );
  const h = d.hourly;
  const num = (a: (number | null)[]) => a.map((v) => v ?? 0);
  return {
    time: h.time.map(parseLocal),
    wave: num(h.wave_height),
    waveDir: num(h.wave_direction),
    wavePeriod: num(h.wave_period),
    swell: num(h.swell_wave_height),
    swellDir: num(h.swell_wave_direction),
    swellPeriod: num(h.swell_wave_period),
    windWave: num(h.wind_wave_height),
    seaLevel: h.sea_level_height_msl,
  };
}

async function fetchMetar(): Promise<Metar | null> {
  try {
    const d = await getJson("/api/metar", 10000);
    const m = Array.isArray(d) ? d[0] : null;
    if (!m) return null;
    return {
      time: m.obsTime * 1000,
      raw: m.rawOb,
      windDir: typeof m.wdir === "number" ? m.wdir : null,
      windKn: m.wspd ?? 0,
      gustKn: m.wgst ?? null,
      temp: m.temp ?? null,
      visib: m.visib != null ? String(m.visib) : null,
    };
  } catch {
    return null;
  }
}

async function fetchSeaObs(): Promise<SeaLevelObs | null> {
  try {
    const now = new Date();
    const start = new Date(now.getTime() - 26 * 3_600_000);
    const fmt = (d: Date) => d.toISOString().slice(0, 16);
    const d = await getJson(
      `https://www.ioc-sealevelmonitoring.org/service.php?query=data&code=salv&timestart=${fmt(start)}&timestop=${fmt(now)}&format=json`,
      12000,
    );
    if (!Array.isArray(d) || !d.length) return null;
    // Prefere radar; cai pra qualquer sensor de nível disponível (exceto bateria).
    const sensors = [...new Set(d.map((x: any) => x.sensor))].filter((s) => s !== "bat");
    const pick = ["rad", "enc", "prs", "flt", "aux"].find((s) => sensors.includes(s)) ?? sensors[0];
    if (!pick) return null;
    return d
      .filter((x: any) => x.sensor === pick && typeof x.slevel === "number")
      .map((x: any) => ({ time: Date.parse(x.stime.replace(" ", "T") + "Z"), level: x.slevel }));
  } catch {
    return null;
  }
}

export async function loadCached(): Promise<Bundle | undefined> {
  try {
    return await get<Bundle>(KEY);
  } catch {
    return undefined;
  }
}

let inflight: Promise<Bundle> | null = null;

/** Atualiza tudo. Mantém o cache antigo se algo falhar. */
export function refresh(): Promise<Bundle> {
  if (inflight) return inflight;
  inflight = (async () => {
    const old = await loadCached();
    const [weather, metar, seaObs, ...marines] = await Promise.all([
      fetchWeather(),
      fetchMetar(),
      fetchSeaObs(),
      ...MARINE_POINTS.map((p) => fetchMarine(p.lat, p.lon)),
    ]);
    const marine: Record<string, Marine> = {};
    MARINE_POINTS.forEach((p, i) => (marine[p.id] = marines[i] as Marine));
    const b: Bundle = {
      fetchedAt: Date.now(),
      weather: weather as Weather,
      marine,
      metar: (metar as Metar | null) ?? old?.metar ?? null,
      seaObs: (seaObs as SeaLevelObs | null) ?? old?.seaObs ?? null,
    };
    await set(KEY, b);
    return b;
  })().finally(() => (inflight = null));
  return inflight;
}

/** Índice da hora mais próxima de `ms` numa série horária. */
export function hourIndex(times: number[], ms: number): number {
  let best = 0, bd = Infinity;
  for (let i = 0; i < times.length; i++) {
    const d = Math.abs(times[i] - ms);
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

export const WEATHER_CODES: Record<number, [string, string]> = {
  0: ["☀️", "Céu limpo"], 1: ["🌤️", "Poucas nuvens"], 2: ["⛅", "Sol entre nuvens"], 3: ["☁️", "Nublado"],
  45: ["🌫️", "Nevoeiro"], 48: ["🌫️", "Nevoeiro"],
  51: ["🌦️", "Garoa fraca"], 53: ["🌦️", "Garoa"], 55: ["🌧️", "Garoa forte"],
  61: ["🌦️", "Chuva fraca"], 63: ["🌧️", "Chuva"], 65: ["🌧️", "Chuva forte"],
  80: ["🌦️", "Pancadas fracas"], 81: ["🌧️", "Pancadas de chuva"], 82: ["⛈️", "Pancadas fortes"],
  95: ["⛈️", "Trovoada"], 96: ["⛈️", "Trovoada com granizo"], 99: ["⛈️", "Trovoada forte"],
};
export const wx = (code: number) => WEATHER_CODES[code] ?? ["⛅", "—"];
