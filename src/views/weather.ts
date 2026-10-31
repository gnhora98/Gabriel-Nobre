import { hourIndex, wx } from "../lib/forecast";
import { compass } from "../lib/geo";
import { navDay, NAV_LEVELS } from "../lib/navcond";
import { DAY, dayStart, fmtTime, fmtWeekday, num, relTime, cap } from "../lib/util";
import { state, onData } from "../state";
import { lineChart, statusLine } from "../ui/components";
import { t } from "../i18n";
import { height, heightNum, heightUnit, rain, temp, tempNum, tempUnit, wind, windNum, windUnit } from "../units";

type Tab = "tempo" | "vento" | "mar" | "chuva";
let tab: Tab = "tempo";
let openDay = 0;

export function weatherView(root: HTMLElement): () => void {
  const render = () => {
    const b = state.bundle;
    if (!b) { root.innerHTML = `<div class="page"><h1>${t("mode.wx")}</h1><div class="status">${statusLine()}</div></div>`; return; }
    const w = b.weather;
    const now = Date.now();
    const i = hourIndex(w.time, now);
    const [ic, desc] = wx(w.code[i]);
    const days = Array.from({ length: 7 }, (_, k) => dayStart(now) + k * DAY);
    const m = b.marine["orla"] ?? Object.values(b.marine)[0];
    const allT = w.temp, gMin = Math.min(...allT), gMax = Math.max(...allT);

    const rows = days.map((d, k) => {
      const idx = w.time.map((t, j) => [t, j] as const).filter(([t]) => t >= d && t < d + DAY).map(([, j]) => j);
      if (!idx.length) return "";
      const mid = idx.find((j) => new Date(w.time[j]).getUTCHours() === 15) ?? idx[Math.floor(idx.length / 2)];
      const [dic] = wx(w.code[mid]);
      const tmin = Math.min(...idx.map((j) => w.temp[j])), tmax = Math.max(...idx.map((j) => w.temp[j]));
      const rainMm = idx.reduce((s, j) => s + w.precip[j], 0);
      const prob = Math.max(...idx.map((j) => w.precipProb[j] ?? 0));
      const wmax = Math.max(...idx.map((j) => w.windKn[j])), gmax = Math.max(...idx.map((j) => w.gustKn[j]));
      const wdir = w.windDir[mid];
      const midx = m.time.map((t, j) => [t, j] as const).filter(([t]) => t >= d && t < d + DAY).map(([, j]) => j);
      const wave = Math.max(...midx.map((j) => m.wave[j]));
      const per = midx.length ? m.swellPeriod[midx[Math.floor(midx.length / 2)]] : 0;
      const nav = navDay(b, d);
      let right = "";
      if (tab === "tempo") right = `<div class="rng"><i style="left:${((tmin - gMin) / (gMax - gMin || 1)) * 100}%;right:${100 - ((tmax - gMin) / (gMax - gMin || 1)) * 100}%"></i></div><span class="r">${temp(tmin)}–${temp(tmax)}</span>`;
      if (tab === "vento") right = `<span class="arrow" style="transform:rotate(${wdir + 180}deg)">↑</span><span class="r">${wind(wmax)} ${compass(wdir)} · ${t("wx.gustShort", { g: wind(gmax) })}</span>`;
      if (tab === "mar") right = `<span class="dot" style="background:${NAV_LEVELS[nav.level].color}"></span><span class="r">${height(wave)} · ${Math.round(per)} s · ${NAV_LEVELS[nav.level].word}</span>`;
      if (tab === "chuva") right = `<div class="rng rain"><i style="left:0;right:${100 - prob}%"></i></div><span class="r">${Math.round(prob)}% · ${rain(rainMm)}</span>`;
      const open = openDay === d;
      let detail = "";
      if (open) {
        const pts = idx.map((j) => ({ t: w.time[j], v: tab === "vento" ? windNum(w.windKn[j]) : tab === "chuva" ? w.precipProb[j] : tempNum(w.temp[j]) }));
        const mpts = midx.map((j) => ({ t: m.time[j], v: heightNum(m.wave[j]) }));
        detail = `<div class="wdetail">${tab === "mar" ? lineChart(mpts, { from: d, to: d + DAY, min: 0, now }) : lineChart(pts, { from: d, to: d + DAY, min: tab === "tempo" ? undefined : 0, now })}
          <div class="muted small">${tab === "mar" ? t("wx.ch.wave", { u: heightUnit() }) : tab === "vento" ? t("wx.ch.wind", { u: windUnit() }) : tab === "chuva" ? t("wx.ch.rain") : t("wx.ch.temp", { u: tempUnit() })} · ${t("wx.tapClose")}</div></div>`;
      }
      return `<button class="wrow ${open ? "open" : ""}" data-day="${d}"><b>${k === 0 ? t("today") : cap(fmtWeekday(d))}</b><span class="ic">${dic}</span>${right}</button>${detail}`;
    }).join("");

    const mt = b.metar;
    const di = hourIndex(w.daily.time, now);
    root.innerHTML = `<div class="page">
      <div class="muted small">${t("wx.sub")}</div>
      <div class="nowwx"><div class="big">${ic}</div><div><div class="temp">${temp(w.temp[i])}</div><div class="muted">${desc} · ${t("wx.feels", { t: temp(w.feels[i]) })}</div></div></div>
      ${mt ? `<div class="card metar"><b>${t("wx.metar")}</b> <span class="muted small">${relTime(mt.time)}</span><br>
        ${t("wx.metarWind", { d: mt.windDir != null ? compass(mt.windDir) : t("wx.variable"), w: wind(mt.windKn) })}${mt.gustKn ? ` (${t("wx.gusts", { g: wind(mt.gustKn) })})` : ""}${mt.temp != null ? ` · ${temp(mt.temp)}` : ""}${mt.visib ? ` · ${t("wx.visib", { v: mt.visib === "6+" ? "> 10 km" : mt.visib + " mi" })}` : ""}</div>` : ""}
      <div class="seg">${(["tempo", "vento", "mar", "chuva"] as Tab[]).map((tb) => `<button data-tab="${tb}" class="${tb === tab ? "on" : ""}">${t(`wx.tab.${tb}`)}</button>`).join("")}</div>
      <div class="wlist">${rows}</div>
      <div class="muted small" style="margin-top:10px">${t("wx.sun", { a: fmtTime(w.daily.sunrise[di]), b: fmtTime(w.daily.sunset[di]) })}${w.daily.uvMax[di] != null ? t("wx.uv", { u: Math.round(w.daily.uvMax[di]!) }) : ""}</div>
      <a class="card linkcard" href="https://www.marinha.mil.br/chm/dados-do-smm-avisos-de-mau-tempo/avisos-de-mau-tempo" target="_blank" rel="noopener">${t("wx.warnings")}</a>
      <div class="status">${statusLine()}</div>
    </div>`;
    root.querySelectorAll<HTMLButtonElement>(".seg button").forEach((x) => x.addEventListener("click", () => { tab = x.dataset.tab as Tab; render(); }));
    root.querySelectorAll<HTMLButtonElement>(".wrow").forEach((x) =>
      x.addEventListener("click", () => { const d = Number(x.dataset.day); openDay = openDay === d ? 0 : d; render(); }),
    );
  };
  render();
  return onData(render);
}
