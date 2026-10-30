import { hourIndex, wx } from "../lib/forecast";
import { compass } from "../lib/geo";
import { navDay, NAV_LEVELS } from "../lib/navcond";
import { DAY, dayStart, fmtTime, fmtWeekday, num, relTime, cap } from "../lib/util";
import { state, onData } from "../state";
import { lineChart, statusLine } from "../ui/components";

type Tab = "tempo" | "vento" | "mar" | "chuva";
let tab: Tab = "tempo";
let openDay = 0;

export function weatherView(root: HTMLElement): () => void {
  const render = () => {
    const b = state.bundle;
    if (!b) { root.innerHTML = `<div class="page"><h1>Previsão</h1><div class="status">${statusLine()}</div></div>`; return; }
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
      const rain = idx.reduce((s, j) => s + w.precip[j], 0);
      const prob = Math.max(...idx.map((j) => w.precipProb[j] ?? 0));
      const wmax = Math.max(...idx.map((j) => w.windKn[j])), gmax = Math.max(...idx.map((j) => w.gustKn[j]));
      const wdir = w.windDir[mid];
      const midx = m.time.map((t, j) => [t, j] as const).filter(([t]) => t >= d && t < d + DAY).map(([, j]) => j);
      const wave = Math.max(...midx.map((j) => m.wave[j]));
      const per = midx.length ? m.swellPeriod[midx[Math.floor(midx.length / 2)]] : 0;
      const nav = navDay(b, d);
      let right = "";
      if (tab === "tempo") right = `<div class="rng"><i style="left:${((tmin - gMin) / (gMax - gMin || 1)) * 100}%;right:${100 - ((tmax - gMin) / (gMax - gMin || 1)) * 100}%"></i></div><span class="r">${Math.round(tmin)}°–${Math.round(tmax)}°</span>`;
      if (tab === "vento") right = `<span class="arrow" style="transform:rotate(${wdir + 180}deg)">↑</span><span class="r">${Math.round(wmax)} nós ${compass(wdir)} · raj ${Math.round(gmax)}</span>`;
      if (tab === "mar") right = `<span class="dot" style="background:${NAV_LEVELS[nav.level].color}"></span><span class="r">${num(wave)} m · ${Math.round(per)} s · ${NAV_LEVELS[nav.level].word}</span>`;
      if (tab === "chuva") right = `<div class="rng rain"><i style="left:0;right:${100 - prob}%"></i></div><span class="r">${Math.round(prob)}% · ${num(rain)} mm</span>`;
      const open = openDay === d;
      let detail = "";
      if (open) {
        const pts = idx.map((j) => ({ t: w.time[j], v: tab === "vento" ? w.windKn[j] : tab === "chuva" ? w.precipProb[j] : w.temp[j] }));
        const mpts = midx.map((j) => ({ t: m.time[j], v: m.wave[j] }));
        detail = `<div class="wdetail">${tab === "mar" ? lineChart(mpts, { from: d, to: d + DAY, min: 0, now }) : lineChart(pts, { from: d, to: d + DAY, min: tab === "tempo" ? undefined : 0, now })}
          <div class="muted small">${tab === "mar" ? "Altura de onda (m) na orla" : tab === "vento" ? "Vento médio (nós)" : tab === "chuva" ? "Chance de chuva (%)" : "Temperatura (°C)"} · toque de novo pra fechar</div></div>`;
      }
      return `<button class="wrow ${open ? "open" : ""}" data-day="${d}"><b>${k === 0 ? "Hoje" : cap(fmtWeekday(d))}</b><span class="ic">${dic}</span>${right}</button>${detail}`;
    }).join("");

    const mt = b.metar;
    const di = hourIndex(w.daily.time, now);
    root.innerHTML = `<div class="page">
      <div class="muted small">Salvador / Lauro de Freitas · modelo europeu ECMWF</div>
      <div class="nowwx"><div class="big">${ic}</div><div><div class="temp">${Math.round(w.temp[i])}°</div><div class="muted">${desc} · sensação ${Math.round(w.feels[i])}°</div></div></div>
      ${mt ? `<div class="card metar"><b>Medido agora no aeroporto (SBSV)</b> <span class="muted small">${relTime(mt.time)}</span><br>
        Vento ${mt.windDir != null ? compass(mt.windDir) : "variável"} ${mt.windKn} nós${mt.gustKn ? ` (rajadas ${mt.gustKn})` : ""}${mt.temp != null ? ` · ${mt.temp}°C` : ""}${mt.visib ? ` · visib. ${mt.visib === "6+" ? "> 10 km" : mt.visib + " mi"}` : ""}</div>` : ""}
      <div class="seg">${(["tempo", "vento", "mar", "chuva"] as Tab[]).map((t) => `<button data-tab="${t}" class="${t === tab ? "on" : ""}">${cap(t)}</button>`).join("")}</div>
      <div class="wlist">${rows}</div>
      <div class="muted small" style="margin-top:10px">Nascer ${fmtTime(w.daily.sunrise[di])} · Pôr ${fmtTime(w.daily.sunset[di])}${w.daily.uvMax[di] != null ? ` · UV máx ${Math.round(w.daily.uvMax[di]!)}` : ""}</div>
      <a class="card linkcard" href="https://www.marinha.mil.br/chm/dados-do-smm-avisos-de-mau-tempo/avisos-de-mau-tempo" target="_blank" rel="noopener">⚠️ Avisos de mau tempo da Marinha (abre o site do CHM)</a>
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
