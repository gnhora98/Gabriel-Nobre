import { LEVELS, type Level } from "../lib/surf";
import { NAV_LEVELS, type NavLevel } from "../lib/navcond";
import { tideExtremes, tideHeight, tideSeries, tideTrend, tideRange } from "../lib/tide";
import { DAY, fmtDayNum, fmtTime, fmtWeekday, num, relTime } from "../lib/util";
import { t } from "../i18n";
import { height, heightNum } from "../units";
import { state } from "../state";
import tideData from "../data/tide-salvador.json";

/** Termômetro de surf com as 5 categorias. */
export function surfThermometer(level: Level, score: number): string {
  const pct = Math.max(6, Math.min(100, (score / 5) * 100));
  const rows = ([5, 4, 3, 2, 1] as Level[])
    .map((l) => `<div class="tscale ${l === level ? "on" : ""}" style="--c:${LEVELS[l].color}">${l === level ? "▶ " : ""}${LEVELS[l].label}<small>${LEVELS[l].short}</small></div>`)
    .join("");
  return `<div class="therm">
    <div class="tcol"><div class="tube"><div class="fill" style="height:${pct}%"></div></div><div class="bulb" style="background:${LEVELS[level].color}"></div></div>
    <div class="tscales">${rows}</div>
  </div>`;
}

/** Termômetro de navegação compacto (uma palavra). */
export function navBadge(level: NavLevel, sub: string): string {
  const pct = [8, 30, 52, 76, 100][level];
  const L = NAV_LEVELS[level];
  return `<div class="navbadge">
    <div class="mini"><div class="fill" style="height:${pct}%;background:${L.color}"></div></div>
    <div><div class="cap">${t("cond")}</div><div class="word" style="color:${L.color}">${L.word}</div><div class="sub">${sub}</div></div>
  </div>`;
}

export function navScale(level: NavLevel): string {
  return `<div class="navscale">${([4, 3, 2, 1, 0] as NavLevel[])
    .map((l) => `<div class="${l === level ? "on" : ""}"><span style="background:${NAV_LEVELS[l].color}"></span>${NAV_LEVELS[l].word}</div>`)
    .join("")}</div>`;
}

/** Gráfico SVG de linha simples. */
export function lineChart(
  pts: { t: number; v: number }[],
  opts: { from: number; to: number; min?: number; max?: number; now?: number; color?: string; height?: number; fill?: boolean; labels?: boolean },
): string {
  const W = 340, H = opts.height ?? 120, P = 4;
  if (!pts.length) return "";
  const vs = pts.map((p) => p.v);
  const min = opts.min ?? Math.min(...vs), max = opts.max ?? Math.max(...vs);
  const x = (t: number) => P + ((t - opts.from) / (opts.to - opts.from)) * (W - 2 * P);
  const y = (v: number) => H - 18 - ((v - min) / (max - min || 1)) * (H - 30);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join("");
  const color = opts.color ?? "var(--accent)";
  const area = opts.fill !== false ? `<path d="${d}L${x(pts[pts.length - 1].t)},${H - 18}L${x(pts[0].t)},${H - 18}Z" fill="${color}" opacity=".18"/>` : "";
  let nowMark = "";
  if (opts.now && opts.now >= opts.from && opts.now <= opts.to) {
    const nx = x(opts.now);
    nowMark = `<line x1="${nx}" y1="4" x2="${nx}" y2="${H - 18}" stroke="var(--fg)" stroke-dasharray="3 3" opacity=".7"/>`;
  }
  const hours = opts.labels === false ? "" : [0, 6, 12, 18, 24].map((h) => {
    const t = opts.from + h * 3_600_000;
    return `<text x="${x(t)}" y="${H - 4}" text-anchor="${h === 0 ? "start" : h === 24 ? "end" : "middle"}">${String(h).padStart(2, "0")}h</text>`;
  }).join("");
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">${area}<path d="${d}" fill="none" stroke="${color}" stroke-width="2.2" vector-effect="non-scaling-stroke"/>${nowMark}<g class="ax">${hours}</g></svg>`;
}

/** Nível do mar medido agora no marégrafo de Salvador, convertido pro NR. */
export function observedTide(): { h: number; time: number } | null {
  const obs = state.bundle?.seaObs;
  if (!obs || obs.length < 24) return null;
  // Calibra o zero do sensor comparando com a previsão nas últimas 24 h.
  let s = 0;
  for (const o of obs) s += o.level - tideHeight(o.time);
  const off = s / obs.length;
  const last = obs[obs.length - 1];
  if (Date.now() - last.time > 3 * 3_600_000) return null;
  return { h: last.level - off, time: last.time };
}

/** Painel de maré do dia (curva + preamares/baixa-mares). */
export function tidePanel(day: number, opts: { compact?: boolean } = {}): string {
  const now = Date.now();
  const series = tideSeries(day, day + DAY, 15).map((p) => ({ t: p.t, v: p.h }));
  const ex = tideExtremes(day, day + DAY);
  const isToday = now >= day && now < day + DAY;
  const range = tideRange(day);
  const kind = t(range > 2.0 ? "tide.spring" : range < 1.3 ? "tide.neap" : "tide.mid");
  const obs = isToday ? observedTide() : null;
  const head = isToday
    ? `<div class="tidenow"><b>${height(tideHeight(now), 2)}</b><span>${t(tideTrend(now) === "enchendo" ? "tide.rising" : "tide.falling")}</span></div>
       ${obs ? `<div class="muted small">${t("tide.measured", { h: height(obs.h, 2), t: relTime(obs.time) })}</div>` : ""}`
    : "";
  return `<div class="card tide ${opts.compact ? "compact" : ""}">
    ${head}
    ${lineChart(series.map((p) => ({ t: p.t, v: heightNum(p.v) })), { from: day, to: day + DAY, min: heightNum(-0.3), max: heightNum(2.9), now: isToday ? now : undefined, color: "var(--hi)" })}
    <div class="extremes">${ex
      .map((e) => `<div><span>${fmtTime(e.time)}</span><span class="${e.kind === "high" ? "hi" : "lo"}">${t(e.kind === "high" ? "tide.high" : "tide.low")} ${height(e.height, 1)}</span></div>`)
      .join("")}</div>
    <div class="muted small">${t("tide.foot", { k: kind, r: height(range, 1), z: num(tideData.datumOffset * 100, 1) })}</div>
  </div>`;
}

export function dayChips(days: number[], selected: number, dots?: (d: number) => string | undefined): string {
  return `<div class="days">${days
    .map((d, i) => {
      const dot = dots?.(d);
      const lbl = i === 0 ? t("today") : fmtWeekday(d);
      const n = fmtDayNum(d);
      return `<button class="day ${d === selected ? "sel" : ""}" data-day="${d}">${lbl}<b>${n}</b>${dot ? `<span style="background:${dot}"></span>` : ""}</button>`;
    })
    .join("")}</div>`;
}

export function statusLine(): string {
  const b = state.bundle;
  const net = state.online ? "" : `<span class="off">● ${t("offline")}</span> `;
  if (state.loading) return `${net}<span class="muted">${t("status.updating")}</span>`;
  if (!b) return `${net}<span class="muted">${t("status.noData")}</span>`;
  const err = state.error ? ` · <span class="warn">${t("status.failed")}</span>` : "";
  return `${net}<span class="muted">${t("status.from", { t: relTime(b.fetchedAt) })}${err}</span>`;
}
