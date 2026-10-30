import { locale, t } from "../i18n";

export const DAY = 86_400_000;
const OFFSET = 3 * 3_600_000; // America/Bahia = UTC-3 fixo
const TZ = "America/Bahia";

/** Meia-noite local (Bahia) do dia de `ms`. */
export const dayStart = (ms: number) => Math.floor((ms - OFFSET) / DAY) * DAY + OFFSET;

export const fmtTime = (ms: number) => new Date(ms).toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: TZ });
export const fmtWeekday = (ms: number, style: "short" | "long" = "short") =>
  new Date(ms + 12 * 3_600_000).toLocaleDateString(locale(), { weekday: style, timeZone: TZ }).replace(".", "");
export const fmtDayNum = (ms: number) => new Date(ms + 12 * 3_600_000).toLocaleDateString(locale(), { day: "numeric", timeZone: TZ });
export const fmtDate = (ms: number) =>
  new Date(ms + 12 * 3_600_000).toLocaleDateString(locale(), { weekday: "short", day: "numeric", month: "short", timeZone: TZ }).replace(/\./g, "");
export const localHour = (ms: number) => ((new Date(ms).getUTCHours() - 3 + 24) % 24);

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const num = (v: number, d = 1) => v.toLocaleString(locale(), { minimumFractionDigits: d, maximumFractionDigits: d });

export const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function el<T extends HTMLElement = HTMLElement>(html: string): T {
  const t = document.createElement("template");
  t.innerHTML = html.trim();
  return t.content.firstElementChild as T;
}

export function relTime(ms: number): string {
  const m = Math.round((Date.now() - ms) / 60000);
  if (m < 1) return t("rel.now");
  if (m < 60) return t("rel.min", { n: m });
  const h = Math.round(m / 60);
  if (h < 24) return t("rel.h", { n: h });
  return t("rel.d", { n: Math.round(h / 24) });
}

export function storageGet<T>(key: string, def: T): T {
  try {
    const v = localStorage.getItem(key);
    return v == null ? def : (JSON.parse(v) as T);
  } catch {
    return def;
  }
}
export function storageSet(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* sem armazenamento */
  }
}
