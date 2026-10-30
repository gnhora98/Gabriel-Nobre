// Conversão e formatação nas unidades escolhidas em Ajustes.
// Internamente o app trabalha sempre em nós, milhas náuticas, metros, °C e mm.
import { settings } from "./settings";
import { locale, t } from "./i18n";

export const fmtNum = (v: number, d = 1) => v.toLocaleString(locale(), { minimumFractionDigits: d, maximumFractionDigits: d });

const SPEED = { kn: 1, kmh: 1.852, ms: 0.514444, mph: 1.150779 } as const;

/** Escala Beaufort a partir de nós. */
export function beaufort(kn: number): number {
  const lim = [1, 4, 7, 11, 17, 22, 28, 34, 41, 48, 56, 64];
  const i = lim.findIndex((l) => kn < l);
  return i < 0 ? 12 : i;
}

export const speedUnit = () => t(`un.${settings.units.speed}`);
export const windUnit = () => (settings.units.wind === "bft" ? "Bft" : t(`un.${settings.units.wind}`));
export const distUnit = () => t(`un.${settings.units.dist}`);
export const heightUnit = () => t(`un.${settings.units.height}`);
export const tempUnit = () => t(`un.${settings.units.temp}`);
export const rainUnit = () => t(`un.${settings.units.rain}`);

/** Velocidade do barco (entrada em nós) só com o número. */
export const speedVal = (kn: number, d = 1) => fmtNum(kn * SPEED[settings.units.speed], d);
export const speed = (kn: number, d = 1) => `${speedVal(kn, d)} ${speedUnit()}`;

/** Vento (entrada em nós). */
export function windNum(kn: number): number {
  const u = settings.units.wind;
  return u === "bft" ? beaufort(kn) : kn * SPEED[u];
}
export const windVal = (kn: number) => (settings.units.wind === "bft" ? String(beaufort(kn)) : fmtNum(windNum(kn), 0));
export const wind = (kn: number) => (settings.units.wind === "bft" ? `${beaufort(kn)} Bft` : `${windVal(kn)} ${windUnit()}`);

/** Distância (entrada em milhas náuticas). */
const DIST = { nm: 1, km: 1.852, mi: 1.150779 } as const;
export const distVal = (nm: number, d?: number) => {
  const v = nm * DIST[settings.units.dist];
  return fmtNum(v, d ?? (v < 10 ? 2 : 1));
};
export const dist = (nm: number, d?: number) => `${distVal(nm, d)} ${distUnit()}`;

/** Altura de onda e maré (entrada em metros). */
export const heightNum = (m: number) => (settings.units.height === "ft" ? m * 3.28084 : m);
export const heightVal = (m: number, d = 1) => fmtNum(heightNum(m), settings.units.height === "ft" ? Math.max(0, d - 1) : d);
export const height = (m: number, d = 1) => `${heightVal(m, d)} ${settings.units.height === "ft" ? "ft" : "m"}`;

/** Temperatura (entrada em °C), sem casa decimal. */
export const tempNum = (c: number) => (settings.units.temp === "f" ? (c * 9) / 5 + 32 : c);
export const temp = (c: number) => `${Math.round(tempNum(c))}°`;

/** Chuva (entrada em mm). */
export const rain = (mm: number) => (settings.units.rain === "in" ? `${fmtNum(mm / 25.4, 2)} in` : `${fmtNum(mm, 1)} mm`);

/** Coordenadas no formato escolhido. */
export function coord(v: number, isLat: boolean): string {
  // N/S/E/W: padrão náutico internacional, igual em todos os idiomas
  const hemi = isLat ? (v < 0 ? "S" : "N") : v < 0 ? "W" : "E";
  const a = Math.abs(v);
  const pad = isLat ? 2 : 3;
  const fmt = settings.units.coord;
  if (fmt === "dd") return `${v.toFixed(5)}°`;
  const d = Math.floor(a);
  const m = (a - d) * 60;
  if (fmt === "dm") return `${String(d).padStart(pad, "0")}°${m.toFixed(3).padStart(6, "0")}'${hemi}`;
  const mi = Math.floor(m);
  const s = (m - mi) * 60;
  return `${String(d).padStart(pad, "0")}°${String(mi).padStart(2, "0")}'${s.toFixed(1).padStart(4, "0")}"${hemi}`;
}
