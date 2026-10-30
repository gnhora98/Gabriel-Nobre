import "leaflet/dist/leaflet.css";
import "./styles.css";
import { Capacitor } from "@capacitor/core";
import { registerSW } from "virtual:pwa-register";
import { initData } from "./state";
import { homeView } from "./views/home";
import { navView } from "./views/nav";
import { surfDetailView, surfListView } from "./views/surf";
import { weatherView } from "./views/weather";
import { settingsView } from "./views/settings";
import { applySettings, onSettings } from "./settings";
import { t } from "./i18n";

const app = document.getElementById("app")!;
let cleanup: (() => void) | null = null;

function tabbar(active: string): string {
  if (active === "nav") return "";
  const tab = (href: string, ic: string, label: string, key: string) => `<a href="${href}" class="${active === key ? "act" : ""}"><i>${ic}</i>${label}</a>`;
  return `<nav class="tabbar">${tab("#/", "⌂", t("tab.home"), "home")}${tab("#/nav", "⚓", t("tab.nav"), "nav")}${tab("#/surf", "🏄", t("tab.surf"), "surf")}${tab("#/tempo", "⛅", t("tab.wx"), "tempo")}${tab("#/ajustes", "⚙", t("tab.settings"), "ajustes")}</nav>`;
}

function route() {
  cleanup?.();
  cleanup = null;
  const parts = location.hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  const key = ["nav", "surf", "tempo", "ajustes"].includes(parts[0]) ? parts[0] : "home";
  app.className = `view-${key}`;
  app.innerHTML = `<main id="view"></main>${tabbar(key)}`;
  const view = document.getElementById("view")!;
  if (key === "nav") cleanup = navView(view);
  else if (key === "surf" && parts[1]) cleanup = surfDetailView(view, parts[1]);
  else if (key === "surf") cleanup = surfListView(view);
  else if (key === "tempo") cleanup = weatherView(view);
  else if (key === "ajustes") cleanup = settingsView(view);
  else cleanup = homeView(view);
  window.scrollTo(0, 0);
}

// O Netlify injeta um selo fixo no canto inferior; abre espaço pra ele não cobrir os botões.
const badgeCheck = () => document.body.classList.toggle("has-host-badge", !!document.getElementById("nl-badge-frame"));
new MutationObserver(badgeCheck).observe(document.body, { childList: true });
badgeCheck();

window.addEventListener("hashchange", route);
// idioma, tema ou unidades mudaram: redesenha a tela atual
onSettings(() => {
  const y = window.scrollY;
  route();
  window.scrollTo(0, y);
});
applySettings();
initData();
route();
// No app Android os arquivos já vêm dentro do APK; o service worker só serve pra versão web.
if (!Capacitor.isNativePlatform()) registerSW({ immediate: true });
