// Previsão harmônica da maré de Salvador.
// Constantes ajustadas a partir das medições do marégrafo EMSAL (IBGE/CHM, UHSLC 708)
// com scripts/tide_fit.py. Alturas referidas ao Nível de Redução da DHN (Z0 = 133,5 cm).
import tideData from "../data/tide-salvador.json";

type Constituent = { amp: number; phase: number; speed: number };
const CONS = tideData.constituents as Record<string, Constituent>;
const EPOCH_MS = Date.parse(tideData.epoch);
const D2R = Math.PI / 180;

function nodeDeg(tHours: number): number {
  const jd = 2461041.5 + tHours / 24;
  const T = (jd - 2451545.0) / 36525;
  return 125.04452 - 1934.136261 * T;
}

// Correções nodais (Schureman); mesmas fórmulas do script de ajuste.
function nodal(name: string, N: number): [number, number] {
  const n = N * D2R;
  const c = Math.cos, s = Math.sin;
  const fm2 = 1.0004 - 0.0373 * c(n) + 0.0002 * c(2 * n);
  const um2 = -2.14 * s(n);
  switch (name) {
    case "M2": case "N2": case "2N2": case "MU2": case "NU2": case "L2":
      return [fm2, um2];
    case "K2":
      return [1.0241 + 0.2863 * c(n) + 0.0083 * c(2 * n) - 0.0015 * c(3 * n), -17.74 * s(n) + 0.68 * s(2 * n) - 0.04 * s(3 * n)];
    case "K1":
      return [1.006 + 0.115 * c(n) - 0.0088 * c(2 * n) + 0.0006 * c(3 * n), -8.86 * s(n) + 0.68 * s(2 * n) - 0.07 * s(3 * n)];
    case "O1": case "Q1": case "2Q1":
      return [1.0089 + 0.1871 * c(n) - 0.0147 * c(2 * n) + 0.0014 * c(3 * n), 10.8 * s(n) - 1.34 * s(2 * n) + 0.19 * s(3 * n)];
    case "J1":
      return [1.0129 + 0.1676 * c(n) - 0.017 * c(2 * n) + 0.0016 * c(3 * n), -12.94 * s(n) + 1.34 * s(2 * n) - 0.19 * s(3 * n)];
    case "OO1":
      return [1.1027 + 0.6504 * c(n) + 0.0317 * c(2 * n) - 0.0014 * c(3 * n), -36.68 * s(n) + 4.02 * s(2 * n) - 0.57 * s(3 * n)];
    case "M4": case "MN4":
      return [fm2 ** 2, 2 * um2];
    case "MS4":
      return [fm2, um2];
    case "M6":
      return [fm2 ** 3, 3 * um2];
    case "M3":
      return [fm2 ** 1.5, 1.5 * um2];
    case "MK3": {
      const [fk, uk] = nodal("K1", N);
      return [fm2 * fk, um2 + uk];
    }
    case "Mf":
      return [1.043 + 0.414 * c(n), -23.7 * s(n) + 2.7 * s(2 * n) - 0.4 * s(3 * n)];
    case "Mm":
      return [1 - 0.13 * c(n), 0];
    default:
      return [1, 0];
  }
}

/** Altura da maré (m, acima do NR) no instante `ms`. */
export function tideHeight(ms: number): number {
  const t = (ms - EPOCH_MS) / 3_600_000;
  const N = nodeDeg(t);
  let h = 0;
  for (const name in CONS) {
    const k = CONS[name];
    const [f, u] = nodal(name, N);
    h += f * k.amp * Math.cos((k.speed * t + u - k.phase) * D2R);
  }
  return h + tideData.datumOffset;
}

export type TideExtreme = { time: number; height: number; kind: "high" | "low" };

/** Preamares e baixa-mares entre `from` e `to` (ms). */
export function tideExtremes(from: number, to: number): TideExtreme[] {
  const step = 6 * 60_000;
  const out: TideExtreme[] = [];
  let prev = tideHeight(from - step);
  let cur = tideHeight(from);
  for (let t = from; t <= to; t += step) {
    const next = tideHeight(t + step);
    if ((cur > prev && cur >= next) || (cur < prev && cur <= next)) {
      // refino parabólico
      const denom = prev - 2 * cur + next;
      const off = denom !== 0 ? (0.5 * (prev - next)) / denom : 0;
      const tt = t + off * step;
      out.push({ time: tt, height: tideHeight(tt), kind: cur > prev ? "high" : "low" });
    }
    prev = cur;
    cur = next;
  }
  return out;
}

/** Série para gráfico: pontos a cada `stepMin` minutos. */
export function tideSeries(from: number, to: number, stepMin = 15): { t: number; h: number }[] {
  const pts = [];
  for (let t = from; t <= to; t += stepMin * 60_000) pts.push({ t, h: tideHeight(t) });
  return pts;
}

export function tideTrend(ms: number): "enchendo" | "vazando" {
  return tideHeight(ms + 10 * 60_000) > tideHeight(ms) ? "enchendo" : "vazando";
}

/** Coeficiente simples de sizígia/quadratura a partir da amplitude do dia. */
export function tideRange(dayStart: number): number {
  const ex = tideExtremes(dayStart, dayStart + 86_400_000);
  const hi = ex.filter((e) => e.kind === "high").map((e) => e.height);
  const lo = ex.filter((e) => e.kind === "low").map((e) => e.height);
  if (!hi.length || !lo.length) return 0;
  return Math.max(...hi) - Math.min(...lo);
}
