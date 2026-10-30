import "leaflet/dist/leaflet.css";
import "./styles.css";
import { registerSW } from "virtual:pwa-register";
import { initData } from "./state";
import { homeView } from "./views/home";
import { navView } from "./views/nav";
import { surfDetailView, surfListView } from "./views/surf";
import { weatherView } from "./views/weather";

const app = document.getElementById("app")!;
let cleanup: (() => void) | null = null;

function tabbar(active: string): string {
  if (active === "nav") return "";
  const t = (href: string, ic: string, label: string, key: string) => `<a href="${href}" class="${active === key ? "act" : ""}"><i>${ic}</i>${label}</a>`;
  return `<nav class="tabbar">${t("#/", "⌂", "Início", "home")}${t("#/nav", "⚓", "Navegar", "nav")}${t("#/surf", "🏄", "Surf", "surf")}${t("#/tempo", "⛅", "Previsão", "tempo")}</nav>`;
}

function route() {
  cleanup?.();
  cleanup = null;
  const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  const key = parts[0] === "nav" ? "nav" : parts[0] === "surf" ? "surf" : parts[0] === "tempo" ? "tempo" : "home";
  app.className = `view-${key}`;
  app.innerHTML = `<main id="view"></main>${tabbar(key)}`;
  const view = document.getElementById("view")!;
  if (key === "nav") cleanup = navView(view);
  else if (key === "surf" && parts[1]) cleanup = surfDetailView(view, parts[1]);
  else if (key === "surf") cleanup = surfListView(view);
  else if (key === "tempo") cleanup = weatherView(view);
  else cleanup = homeView(view);
  window.scrollTo(0, 0);
}

window.addEventListener("hashchange", route);
initData();
route();
registerSW({ immediate: true });
