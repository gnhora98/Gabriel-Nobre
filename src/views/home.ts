import { navCondition, NAV_LEVELS } from "../lib/navcond";
import { rankBeaches, LEVELS } from "../lib/surf";
import { hourIndex, wx } from "../lib/forecast";
import { dayStart, fmtDate, cap } from "../lib/util";
import { state, onData, update } from "../state";
import { statusLine } from "../ui/components";

export function homeView(root: HTMLElement): () => void {
  const render = () => {
    const b = state.bundle;
    const now = Date.now();
    let nav = "Carta, GPS, trilha e waypoints offline", navChip = "";
    let surf = "Ranking das praias de Salvador e Lauro de Freitas", surfChip = "";
    let wxTxt = "Tempo, vento, chuva e mar dos próximos 7 dias", wxChip = "";
    if (b) {
      const c = navCondition(b, now);
      navChip = `Mar agora: ${NAV_LEVELS[c.level].word}`;
      const top = rankBeaches(b, dayStart(now))[0];
      if (top) surfChip = `Melhor hoje: ${top.beach.name} · ${LEVELS[top.day.best.level].label}`;
      const i = hourIndex(b.weather.time, now);
      const [ic, desc] = wx(b.weather.code[i]);
      wxChip = `${ic} ${Math.round(b.weather.temp[i])}° · ${desc}`;
    }
    root.innerHTML = `<div class="page home">
      <div class="muted small">Salvador · ${cap(fmtDate(dayStart(now)))}</div>
      <h1>E aí, vai pra onde hoje?</h1>
      <a class="mode-card nav" href="#/nav"><div class="ic">⚓</div><b>Navegador</b><p>${nav}</p>${navChip ? `<span class="chip">${navChip}</span>` : ""}</a>
      <a class="mode-card surf" href="#/surf"><div class="ic">🏄</div><b>Surfista</b><p>${surf}</p>${surfChip ? `<span class="chip">${surfChip}</span>` : ""}</a>
      <a class="mode-card wx" href="#/tempo"><div class="ic">⛅</div><b>Previsão</b><p>${wxTxt}</p>${wxChip ? `<span class="chip">${wxChip}</span>` : ""}</a>
      <div class="status">${statusLine()} <button class="link" id="refresh">Atualizar</button></div>
      <p class="disclaimer">App de apoio. Não substitui as cartas oficiais atualizadas nem os equipamentos de navegação obrigatórios.</p>
    </div>`;
    root.querySelector("#refresh")?.addEventListener("click", () => update());
  };
  render();
  return onData(render);
}
