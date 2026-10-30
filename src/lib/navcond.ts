// Termômetro de navegação: resume vento, rajada, ondas e tempo na BTS em uma palavra.
import type { Bundle } from "./forecast";
import { hourIndex } from "./forecast";
import { t } from "../i18n";

export type NavLevel = 0 | 1 | 2 | 3 | 4;
const nv = (n: NavLevel, color: string) => ({
  get word() { return t(`nv.${n}`); },
  get hint() { return t(`nvh.${n}`); },
  color,
});
export const NAV_LEVELS: Record<NavLevel, { readonly word: string; readonly hint: string; color: string }> = {
  0: nv(0, "#8aa0b6"),
  1: nv(1, "#21d07a"),
  2: nv(2, "#3fb6ff"),
  3: nv(3, "#ffb020"),
  4: nv(4, "#ff3b5c"),
};

export type NavCond = { level: NavLevel; windKn: number; gustKn: number; windDir: number; wave: number; code: number; time: number };

export function navCondition(b: Bundle, t: number): NavCond {
  const w = b.weather;
  const wi = hourIndex(w.time, t);
  const m = b.marine["barra"] ?? Object.values(b.marine)[0];
  const mi = hourIndex(m.time, t);
  const windKn = w.windKn[wi], gustKn = w.gustKn[wi], wave = m.wave[mi], code = w.code[wi];

  let level: NavLevel;
  if (gustKn >= 34 || windKn >= 27 || wave >= 2.5 || code >= 95) level = 4;
  else if (gustKn >= 25 || windKn >= 19 || wave >= 1.8) level = 3;
  else if (gustKn >= 18 || windKn >= 12 || wave >= 1.1 || code === 65 || code === 82) level = 2;
  else if (windKn < 4 && wave < 0.4) level = 0;
  else level = 1;
  return { level, windKn, gustKn, windDir: w.windDir[wi], wave, code, time: w.time[wi] };
}

/** Pior condição do dia em horas de luz (pra cards de 7 dias). */
export function navDay(b: Bundle, dayStart: number): NavCond {
  let worst: NavCond | null = null;
  for (let h = 6; h <= 18; h++) {
    const c = navCondition(b, dayStart + h * 3_600_000);
    if (!worst || c.level > worst.level || (c.level === worst.level && c.windKn > worst.windKn)) worst = c;
  }
  return worst!;
}
