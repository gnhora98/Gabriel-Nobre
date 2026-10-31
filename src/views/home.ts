import { navCondition, NAV_LEVELS } from "../lib/navcond";
import { rankBeaches, LEVELS } from "../lib/surf";
import { hourIndex, wx } from "../lib/forecast";
import { dayStart, fmtDate, cap } from "../lib/util";
import { state, onData, update } from "../state";
import { statusLine } from "../ui/components";
import { t } from "../i18n";
import { temp } from "../units";

export function homeView(root: HTMLElement): () => void {
  const render = () => {
    const b = state.bundle;
    const now = Date.now();
    let navChip = "", surfChip = "", wxChip = "";
    if (b) {
      const c = navCondition(b, now);
      navChip = t("chip.navNow", { w: NAV_LEVELS[c.level].word });
      const top = rankBeaches(b, dayStart(now))[0];
      if (top) surfChip = t("chip.best", { b: top.beach.name, l: LEVELS[top.day.best.level].label });
      const i = hourIndex(b.weather.time, now);
      const [ic, desc] = wx(b.weather.code[i]);
      wxChip = `${ic} ${temp(b.weather.temp[i])} · ${desc}`;
    }
    root.innerHTML = `<div class="page home">
      <div class="muted small">Salvador · ${cap(fmtDate(dayStart(now)))}</div>
      <h1>${t("greeting")}</h1>
      <a class="mode-card nav" href="#/nav"><div class="ic">⚓</div><b>${t("mode.nav")}</b><p>${t("mode.nav.desc")}</p>${navChip ? `<span class="chip">${navChip}</span>` : ""}</a>
      <a class="mode-card surf" href="#/surf"><div class="ic">🏄</div><b>${t("mode.surf")}</b><p>${t("mode.surf.desc")}</p>${surfChip ? `<span class="chip">${surfChip}</span>` : ""}</a>
      <a class="mode-card wx" href="#/tempo"><div class="ic">⛅</div><b>${t("mode.wx")}</b><p>${t("mode.wx.desc")}</p>${wxChip ? `<span class="chip">${wxChip}</span>` : ""}</a>
      <div class="status">${statusLine()} <button class="link" id="refresh">${t("refresh")}</button></div>
      <p class="disclaimer">${t("disclaimer")}</p>
    </div>`;
    root.querySelector("#refresh")?.addEventListener("click", () => update());
  };
  render();
  return onData(render);
}
