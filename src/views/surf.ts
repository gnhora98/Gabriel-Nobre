import { BEACHES } from "../data/beaches";
import { beachDays, explain, rankBeaches, LEVELS } from "../lib/surf";
import { hourIndex, wx } from "../lib/forecast";
import { compass } from "../lib/geo";
import { DAY, dayStart, fmtTime, fmtWeekday, localHour, num, cap, fmtDate } from "../lib/util";
import { state, onData } from "../state";
import { dayChips, statusLine, surfThermometer, tidePanel } from "../ui/components";

let selectedDay = 0;

const tag = (l: 1 | 2 | 3 | 4 | 5) => `<span class="tag" style="background:${LEVELS[l].color};color:${LEVELS[l].text}">${LEVELS[l].label}</span>`;
const days7 = () => Array.from({ length: 7 }, (_, i) => dayStart(Date.now()) + i * DAY);

export function surfListView(root: HTMLElement): () => void {
  const render = () => {
    const b = state.bundle;
    const days = days7();
    if (!selectedDay || !days.includes(selectedDay)) selectedDay = days[0];
    if (!b) {
      root.innerHTML = `<div class="page"><h1>Onde tá rolando?</h1><div class="status">${statusLine()}</div></div>`;
      return;
    }
    const ranked = rankBeaches(b, selectedDay);
    root.innerHTML = `<div class="page">
      <div class="muted small">${selectedDay === days[0] ? "Hoje" : cap(fmtDate(selectedDay))} · melhor horário de cada praia</div>
      <h1>Onde tá rolando?</h1>
      ${dayChips(days, selectedDay, (d) => {
        const best = rankBeaches(b, d)[0];
        return best ? LEVELS[best.day.best.level].color : undefined;
      })}
      <div class="list">${ranked
        .map(({ beach, day }) => {
          const h = day.best;
          return `<a class="beach" href="#/surf/${beach.id}">
            <div><div class="n">${beach.name}${beach.city !== "Salvador" ? ` <small>(Lauro)</small>` : ""}${beach.cams?.length ? ` <span class="camtag">📹 ao vivo</span>` : ""}</div>
            <div class="d">${num(h.breakHeight)} m · ${Math.round(h.period)} s · ${compass(h.swellDir)} · ${h.windKind} · ${fmtTime(day.window[0])}–${fmtTime(day.window[1])}</div></div>
            ${tag(h.level)}</a>`;
        })
        .join("")}</div>
      <div class="status">${statusLine()}</div>
    </div>`;
    root.querySelectorAll<HTMLButtonElement>(".day").forEach((btn) =>
      btn.addEventListener("click", () => { selectedDay = Number(btn.dataset.day); render(); }),
    );
  };
  render();
  return onData(render);
}

export function surfDetailView(root: HTMLElement, id: string): () => void {
  const beach = BEACHES.find((x) => x.id === id);
  const render = () => {
    const b = state.bundle;
    if (!beach) { root.innerHTML = `<div class="page"><a href="#/surf">‹ Praias</a><p>Praia não encontrada.</p></div>`; return; }
    if (!b) { root.innerHTML = `<div class="page"><a href="#/surf" class="back">‹ Praias</a><h1>${beach.name}</h1><div class="status">${statusLine()}</div></div>`; return; }
    const days = days7();
    if (!selectedDay || !days.includes(selectedDay)) selectedDay = days[0];
    const all = beachDays(beach, b, days[0], 7);
    const d = all.find((x) => x.day === selectedDay) ?? all[0];
    if (!d) { root.innerHTML = `<div class="page"><a href="#/surf" class="back">‹ Praias</a><p>Sem dados pra esse dia.</p></div>`; return; }
    const h = d.best;
    const w = b.weather;
    // clima do dia
    const idx = w.time.map((t, i) => [t, i] as const).filter(([t]) => t >= d.day && t < d.day + DAY).map(([, i]) => i);
    const tmin = Math.min(...idx.map((i) => w.temp[i])), tmax = Math.max(...idx.map((i) => w.temp[i]));
    const rain = idx.reduce((s, i) => s + w.precip[i], 0);
    const prob = Math.max(...idx.map((i) => w.precipProb[i] ?? 0));
    const midday = idx.find((i) => localHour(w.time[i]) === 12) ?? idx[0];
    const [ic, desc] = wx(w.code[midday]);
    const di = hourIndex(w.daily.time, d.day + 12 * 3_600_000);
    const uv = w.daily.uvMax[di];

    const bars = d.hours
      .map((x) => `<div class="hbar" title="${fmtTime(x.time)}"><i style="height:${Math.max(8, (x.score / 5) * 100)}%;background:${LEVELS[x.level].color}"></i><span>${localHour(x.time)}</span></div>`)
      .join("");

    root.innerHTML = `<div class="page">
      <a href="#/surf" class="back">‹ Praias</a>
      <h1>${beach.name}</h1>
      <div class="muted small">${beach.city} · fundo de ${beach.bottom} · ${beach.notes}</div>
      ${beach.cams?.length ? `<div class="cams">${beach.cams.map((c) => `<a class="cam" href="${c.url}" target="_blank" rel="noopener"><b>📹 ${c.name}</b><span>ao vivo · ${c.provider} · abre no navegador ↗</span></a>`).join("")}</div>` : ""}
      ${surfThermometer(h.level, h.score)}
      ${dayChips(days, d.day, (dd) => { const x = all.find((a) => a.day === dd); return x ? LEVELS[x.best.level].color : undefined; })}
      <div class="grid">
        <div><span>Onda na arrebentação</span><b>${num(h.breakHeight)} m</b><small>swell ${num(h.swell)} m · ${compass(h.swellDir)} ${Math.round(h.swellDir)}°</small></div>
        <div><span>Período</span><b>${Math.round(h.period)} s</b><small>${h.period >= 10 ? "swell de fundo" : h.period >= 7 ? "swell médio" : "mar de vento"}</small></div>
        <div><span>Vento</span><b>${Math.round(h.windKn)} nós</b><small>${compass(h.windDir)} · ${h.windKind}${h.windKind === "terral" ? " ✓" : ""}</small></div>
        <div><span>Maré às ${fmtTime(h.time)}</span><b>${num(h.tide)} m</b><small>${h.tideTrend}</small></div>
      </div>
      <div class="why">Melhor janela: <b>${fmtTime(d.window[0])}–${fmtTime(d.window[1])}</b>. ${explain(beach, d, all.filter((x) => x.day > d.day))}</div>
      <h2>Hora a hora</h2>
      <div class="hbars">${bars}</div>
      <h2>Maré</h2>
      ${tidePanel(d.day, { compact: true })}
      <h2>Clima ${d.day === days[0] ? "hoje" : fmtWeekday(d.day, "long")}</h2>
      <div class="card wxday">
        <div class="big">${ic}</div>
        <div><b>${Math.round(tmin)}°–${Math.round(tmax)}°</b> · ${desc}<br>
        <span class="muted small">Chuva ${num(rain)} mm (${Math.round(prob)}%)${uv != null ? ` · UV ${Math.round(uv)}` : ""} · sol ${fmtTime(w.daily.sunrise[di])}–${fmtTime(w.daily.sunset[di])}</span></div>
      </div>
      <div class="status">${statusLine()}</div>
    </div>`;
    root.querySelectorAll<HTMLButtonElement>(".day").forEach((btn) =>
      btn.addEventListener("click", () => { selectedDay = Number(btn.dataset.day); render(); }),
    );
  };
  render();
  return onData(render);
}
