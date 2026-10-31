// Avaliação de surf por praia: transforma os dados de mar/vento/maré em nota de 0 a 5
// e numa das cinco categorias (ruim → swell).
import { BEACHES, marinePointFor, type Beach } from "../data/beaches";
import type { Bundle, Marine, Weather } from "./forecast";
import { hourIndex } from "./forecast";
import { angleDiff, compass } from "./geo";
import { t } from "../i18n";
import { height } from "../units";
import { tideHeight, tideTrend } from "./tide";
import { fmtWeekday } from "./util";

export type Level = 1 | 2 | 3 | 4 | 5;
// Frases informais traduzidas em i18n.ts (lv.N / lvs.N).
const lv = (n: Level, color: string, text: string) => ({
  get label() { return t(`lv.${n}`); },
  get short() { return t(`lvs.${n}`); },
  color,
  text,
});
export const LEVELS: Record<Level, { readonly label: string; readonly short: string; color: string; text: string }> = {
  1: lv(1, "#6b7c8f", "#fff"),
  2: lv(2, "#3fb6ff", "#06121d"),
  3: lv(3, "#21d07a", "#06121d"),
  4: lv(4, "#ffb020", "#06121d"),
  5: lv(5, "#ff3b5c", "#fff"),
};

/** Motivo da nota: chave de tradução + valores (traduzido só na hora de mostrar). */
export type Reason = { k: string; v?: Record<string, string | number> };
export const reasonText = (r: Reason) => t(r.k, r.v && Object.fromEntries(Object.entries(r.v).map(([k, v]) => [k, k === "d" ? compass(Number(v)) : k === "t" ? t(`tl.${v}`) : v])));

export type SurfHour = {
  time: number;
  score: number; // 0..5
  level: Level;
  breakHeight: number; // m estimado na arrebentação
  swell: number;
  swellDir: number;
  period: number;
  windKn: number;
  windDir: number;
  windKind: "terral" | "lateral" | "maral" | "fraco";
  tide: number;
  tideTrend: "enchendo" | "vazando";
  reasons: Reason[];
};

export function levelOf(score: number): Level {
  if (score < 1.4) return 1;
  if (score < 2.4) return 2;
  if (score < 3.3) return 3;
  if (score < 4.2) return 4;
  return 5;
}

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

// altura na arrebentação (m) → nota de tamanho
const SIZE_CURVE: [number, number][] = [[0, 0], [0.3, 0.5], [0.6, 1.5], [0.9, 2.3], [1.2, 3.0], [1.6, 3.7], [2.2, 4.4], [3.0, 5]];
function interp(x: number, pts: [number, number][]): number {
  if (x <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    const [x1, y1] = pts[i];
    if (x <= x1) { const [x0, y0] = pts[i - 1]; return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0); }
  }
  return pts[pts.length - 1][1];
}

export function scoreHour(beach: Beach, m: Marine, w: Weather, i: number, t: number): SurfHour {
  const wi = hourIndex(w.time, t);
  const swell = m.swell[i], swellDir = m.swellDir[i], period = m.swellPeriod[i];
  const windKn = w.windKn[wi], windDir = w.windDir[wi];
  const reasons: Reason[] = [];

  // 1) Quanto do swell entra na praia (direção x orientação x abrigo).
  const dirOff = Math.abs(angleDiff(beach.facing, swellDir));
  const dirFactor = dirOff >= 100 ? 0 : Math.cos((Math.min(dirOff, 90) * Math.PI) / 180) ** 0.7;
  // Mar de vento local (wind_wave) entra parcialmente, sempre com qualidade pior.
  const windSea = m.windWave[i] * 0.5 * beach.exposure;
  let h = swell * beach.exposure * dirFactor;
  // 2) Período: swell longo cresce mais na arrebentação.
  const periodFactor = clamp(0.55 + 0.045 * period, 0.75, 1.35);
  const breakHeight = h * periodFactor + windSea * 0.6;

  // 3) Nota base pela altura na arrebentação; abaixo do mínimo da praia a bancada não funciona direito.
  let score = interp(breakHeight, SIZE_CURVE);
  if (breakHeight < beach.minHeight) score *= breakHeight / beach.minHeight;

  if (dirOff >= 100) reasons.push({ k: "r.swellBlocked", v: { d: swellDir } });
  else if (dirOff > 55) reasons.push({ k: "r.swellSide", v: { d: swellDir } });
  else reasons.push({ k: "r.swellFront", v: { d: swellDir } });

  // 4) Período: curto = mar de vento sem força; longo = swell de fundo organizado.
  if (period < 7) { score -= 0.8; reasons.push({ k: "r.perShort", v: { p: period.toFixed(0) } }); }
  else if (period < 9) { score -= 0.3; reasons.push({ k: "r.perMid", v: { p: period.toFixed(0) } }); }
  else if (period >= 13) { score += 0.5; reasons.push({ k: "r.perGround", v: { p: period.toFixed(0) } }); }
  else if (period >= 11) { score += 0.3; reasons.push({ k: "r.perGood", v: { p: period.toFixed(0) } }); }

  // 5) Vento: terral (offshore) limpa, maral (onshore) estraga.
  const offshoreFrom = (beach.facing + 180) % 360;
  const wOff = Math.abs(angleDiff(offshoreFrom, windDir));
  let windKind: SurfHour["windKind"];
  if (windKn < 5) { windKind = "fraco"; score += 0.3; reasons.push({ k: "r.calm" }); }
  else if (wOff <= 50) {
    windKind = "terral";
    score += windKn < 18 ? 0.6 : 0.1;
    reasons.push({ k: windKn < 18 ? "r.offshore" : "r.offshoreStrong" });
  } else if (wOff <= 115) {
    windKind = "lateral";
    score -= (windKn / 12) * 0.5;
    reasons.push({ k: "r.cross", v: { d: windDir } });
  } else {
    windKind = "maral";
    score -= (windKn / 10) * 0.75;
    reasons.push({ k: windKn > 12 ? "r.onshoreStrong" : "r.onshore", v: { d: windDir } });
  }

  // 6) Maré preferida.
  const tide = tideHeight(t);
  const tt = tideTrend(t);
  const tideLvl = tide < 0.8 ? "baixa" : tide > 1.7 ? "cheia" : "media";
  if (beach.tide !== "qualquer") {
    if (tideLvl === beach.tide) { score += 0.3; reasons.push({ k: "r.tideGood", v: { t: tideLvl } }); }
    else if ((beach.tide === "cheia" && tideLvl === "baixa") || (beach.tide === "baixa" && tideLvl === "cheia")) {
      score -= 0.5;
      reasons.push({ k: "r.tideBad", v: { t: tideLvl } });
    }
  }
  if (beach.bottom !== "areia" && tide < 0.5) { score -= 0.3; reasons.push({ k: "r.shallow" }); }

  // Swell muito grande sempre vira "swellzão", mesmo com vento ruim.
  if (breakHeight > 2.4) score = Math.max(score, 4.3);
  score = clamp(score, 0, 5);

  return { time: t, score, level: levelOf(score), breakHeight, swell, swellDir, period, windKn, windDir, windKind, tide, tideTrend: tt, reasons };
}

export function beachHours(beach: Beach, b: Bundle, from: number, to: number): SurfHour[] {
  const m = b.marine[marinePointFor(beach)];
  if (!m) return [];
  const out: SurfHour[] = [];
  for (let i = 0; i < m.time.length; i++) {
    const t = m.time[i];
    if (t < from || t > to) continue;
    out.push(scoreHour(beach, m, b.weather, i, t));
  }
  return out;
}

const isDaylight = (t: number) => {
  const h = new Date(t).getUTCHours() - 3;
  const hh = (h + 24) % 24;
  return hh >= 5 && hh <= 17;
};

export type SurfDay = { day: number; best: SurfHour; window: [number, number]; hours: SurfHour[] };

/** Melhor momento de cada dia (só horas de luz). */
export function beachDays(beach: Beach, b: Bundle, startDay: number, days = 7): SurfDay[] {
  const out: SurfDay[] = [];
  for (let d = 0; d < days; d++) {
    const from = startDay + d * 86_400_000;
    const hours = beachHours(beach, b, from, from + 86_400_000 - 1).filter((h) => isDaylight(h.time));
    if (!hours.length) continue;
    const best = hours.reduce((a, c) => (c.score > a.score ? c : a));
    // janela: horas contíguas em torno do melhor com nota até 0,4 abaixo
    const bi = hours.indexOf(best);
    let s = bi, e = bi;
    while (s > 0 && hours[s - 1].score >= best.score - 0.4) s--;
    while (e < hours.length - 1 && hours[e + 1].score >= best.score - 0.4) e++;
    out.push({ day: from, best, window: [hours[s].time, hours[e].time], hours });
  }
  return out;
}

export function rankBeaches(b: Bundle, dayStart: number): { beach: Beach; day: SurfDay }[] {
  return BEACHES.map((beach) => ({ beach, day: beachDays(beach, b, dayStart, 1)[0] }))
    .filter((x) => x.day)
    .sort((a, b2) => b2.day.best.score - a.day.best.score);
}

/** Frase informal explicando a nota. */
export function explain(beach: Beach, d: SurfDay, next?: SurfDay[]): string {
  const h = d.best;
  const sz = h.breakHeight < 0.4 ? 0 : h.breakHeight < 0.8 ? 1 : h.breakHeight < 1.2 ? 2 : h.breakHeight < 1.8 ? 3 : 4;
  let s = t("explain", { s: t(`sz.${sz}`), h: height(h.breakHeight), r: h.reasons.slice(0, 3).map(reasonText).join("; ") });
  if (next?.length) {
    const top = next.reduce((a, c) => (c.best.score > a.best.score ? c : a));
    if (top.best.score > d.best.score + 0.6) s += t("watch", { d: fmtWeekday(top.day, "long"), l: LEVELS[top.best.level].label });
  }
  void beach;
  return s;
}
