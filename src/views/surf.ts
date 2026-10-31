import { BEACHES } from "../data/beaches";
import { beachDays, explain, rankBeaches, LEVELS } from "../lib/surf";
import { hourIndex, wx } from "../lib/forecast";
import { compass } from "../lib/geo";
import { DAY, esc, dayStart, fmtTime, fmtWeekday, localHour, num, cap, fmtDate } from "../lib/util";
import { state, onData } from "../state";
import { addUserCam, camsFor, normalizeUrl, removeUserCam } from "../lib/cams";
import { dayChips, statusLine, surfThermometer, tidePanel } from "../ui/components";
import { t } from "../i18n";
import { height, rain, temp, wind } from "../units";

let selectedDay = 0;

const tag = (l: 1 | 2 | 3 | 4 | 5) => `<span class="tag" style="background:${LEVELS[l].color};color:${LEVELS[l].text}">${LEVELS[l].label}</span>`;
const days7 = () => Array.from({ length: 7 }, (_, i) => dayStart(Date.now()) + i * DAY);

export function surfListView(root: HTMLElement): () => void {
  const render = () => {
    const b = state.bundle;
    const days = days7();
    if (!selectedDay || !days.includes(selectedDay)) selectedDay = days[0];
    if (!b) {
      root.innerHTML = `<div class="page"><h1>${t("surf.title")}</h1><div class="status">${statusLine()}</div></div>`;
      return;
    }
    const ranked = rankBeaches(b, selectedDay);
    root.innerHTML = `<div class="page">
      <div class="muted small">${selectedDay === days[0] ? t("today") : cap(fmtDate(selectedDay))} · ${t("surf.bestTime")}</div>
      <h1>${t("surf.title")}</h1>
      ${dayChips(days, selectedDay, (d) => {
        const best = rankBeaches(b, d)[0];
        return best ? LEVELS[best.day.best.level].color : undefined;
      })}
      <div class="list">${ranked
        .map(({ beach, day }) => {
          const h = day.best;
          return `<a class="beach" href="#/surf/${beach.id}">
            <div><div class="n">${beach.name}${beach.city !== "Salvador" ? ` <small>(Lauro)</small>` : ""}${camsFor(beach).length ? ` <span class="camtag">📹 ${t("live")}</span>` : ""}</div>
            <div class="d">${height(h.breakHeight)} · ${Math.round(h.period)} s · ${compass(h.swellDir)} · ${t(`wk.${h.windKind}`)} · ${fmtTime(day.window[0])}–${fmtTime(day.window[1])}</div></div>
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
  if (!beach) {
    root.innerHTML = `<div class="page"><a href="#/surf">${t("back")}</a><p>${t("notFound")}</p></div>`;
    return () => {};
  }
  // Câmeras não dependem da previsão: aparecem mesmo sem dados salvos.
  const camsBlock = () => `<div class="cams">${camsFor(beach).map((c) => `<div class="camrow"><a class="cam" href="${esc(c.url)}" target="_blank" rel="noopener"><b>📹 ${esc(c.name)}</b><span>${t("cam.open", { p: esc(c.provider) })}</span></a>${c.user ? `<button class="camdel" data-url="${esc(c.url)}" title="✕">✕</button>` : ""}</div>`).join("")}
        <button class="camadd" id="camAdd">${t("cam.add")}</button></div>`;
  const bindCams = () => {
    root.querySelector("#camAdd")?.addEventListener("click", () => {
      const raw = prompt(t("cam.paste", { b: beach.name }));
      if (!raw) return;
      const url = normalizeUrl(raw);
      if (!url) { alert(t("cam.invalid")); return; }
      const name = prompt(t("cam.name"), t("cam.default")) || t("cam.default");
      addUserCam(beach.id, { name: name.slice(0, 40), url, provider: new URL(url).hostname.replace(/^www\./, "") });
      render();
    });
    root.querySelectorAll<HTMLButtonElement>(".camdel").forEach((btn) =>
      btn.addEventListener("click", () => { if (confirm(t("cam.remove"))) { removeUserCam(beach.id, btn.dataset.url!); render(); } }),
    );
  };
  const render = () => {
    const b = state.bundle;
    if (!b) { root.innerHTML = `<div class="page"><a href="#/surf" class="back">${t("back")}</a><h1>${beach.name}</h1>${camsBlock()}<div class="status">${statusLine()}</div></div>`; bindCams(); return; }
    const days = days7();
    if (!selectedDay || !days.includes(selectedDay)) selectedDay = days[0];
    const all = beachDays(beach, b, days[0], 7);
    const d = all.find((x) => x.day === selectedDay) ?? all[0];
    if (!d) { root.innerHTML = `<div class="page"><a href="#/surf" class="back">${t("back")}</a><h1>${beach.name}</h1>${camsBlock()}<p>${t("noDayData")}</p></div>`; bindCams(); return; }
    const h = d.best;
    const w = b.weather;
    // clima do dia
    const idx = w.time.map((t, i) => [t, i] as const).filter(([t]) => t >= d.day && t < d.day + DAY).map(([, i]) => i);
    const tmin = Math.min(...idx.map((i) => w.temp[i])), tmax = Math.max(...idx.map((i) => w.temp[i]));
    const rainMm = idx.reduce((s, i) => s + w.precip[i], 0);
    const prob = Math.max(...idx.map((i) => w.precipProb[i] ?? 0));
    const midday = idx.find((i) => localHour(w.time[i]) === 12) ?? idx[0];
    const [ic, desc] = wx(w.code[midday]);
    const di = hourIndex(w.daily.time, d.day + 12 * 3_600_000);
    const uv = w.daily.uvMax[di];

    const bars = d.hours
      .map((x) => `<div class="hbar" title="${fmtTime(x.time)}"><i style="height:${Math.max(8, (x.score / 5) * 100)}%;background:${LEVELS[x.level].color}"></i><span>${localHour(x.time)}</span></div>`)
      .join("");

    root.innerHTML = `<div class="page">
      <a href="#/surf" class="back">${t("back")}</a>
      <h1>${beach.name}</h1>
      <div class="muted small">${beach.city} · ${t("bottom", { b: t(`b.${beach.bottom}`) })} · ${t(`note.${beach.id}`)}</div>
      ${camsBlock()}
      ${surfThermometer(h.level, h.score)}
      ${dayChips(days, d.day, (dd) => { const x = all.find((a) => a.day === dd); return x ? LEVELS[x.best.level].color : undefined; })}
      <div class="grid">
        <div><span>${t("g.break")}</span><b>${height(h.breakHeight)}</b><small>swell ${height(h.swell)} · ${compass(h.swellDir)} ${Math.round(h.swellDir)}°</small></div>
        <div><span>${t("g.period")}</span><b>${Math.round(h.period)} s</b><small>${t(h.period >= 10 ? "per.ground" : h.period >= 7 ? "per.mid" : "per.windsea")}</small></div>
        <div><span>${t("g.wind")}</span><b>${wind(h.windKn)}</b><small>${compass(h.windDir)} · ${t(`wk.${h.windKind}`)}${h.windKind === "terral" ? " ✓" : ""}</small></div>
        <div><span>${t("g.tideAt", { t: fmtTime(h.time) })}</span><b>${height(h.tide)}</b><small>${t(h.tideTrend === "enchendo" ? "rising" : "falling")}</small></div>
      </div>
      <div class="why">${t("bestWindow")} <b>${fmtTime(d.window[0])}–${fmtTime(d.window[1])}</b>. ${explain(beach, d, all.filter((x) => x.day > d.day))}</div>
      <h2>${t("hourly")}</h2>
      <div class="hbars">${bars}</div>
      <h2>${t("tide")}</h2>
      ${tidePanel(d.day, { compact: true })}
      <h2>${d.day === days[0] ? t("wxToday") : t("wxDay", { d: fmtWeekday(d.day, "long") })}</h2>
      <div class="card wxday">
        <div class="big">${ic}</div>
        <div><b>${temp(tmin)}–${temp(tmax)}</b> · ${desc}<br>
        <span class="muted small">${t("rainLine", { r: rain(rainMm), p: Math.round(prob) })}${uv != null ? ` · UV ${Math.round(uv)}` : ""} · ${t("sunLine", { a: fmtTime(w.daily.sunrise[di]), b: fmtTime(w.daily.sunset[di]) })}</span></div>
      </div>
      <div class="status">${statusLine()}</div>
    </div>`;
    root.querySelectorAll<HTMLButtonElement>(".day").forEach((btn) =>
      btn.addEventListener("click", () => { selectedDay = Number(btn.dataset.day); render(); }),
    );
    bindCams();
  };
  render();
  return onData(render);
}
