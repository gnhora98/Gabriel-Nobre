import { LANG_FLAGS, LANG_NAMES, t } from "../i18n";
import { settings, updateSettings, THEME_COLORS, type Lang, type Theme, type Units } from "../settings";

const THEMES: Theme[] = ["azul-escuro", "azul-claro", "verde-escuro", "verde-claro", "preto", "branco"];
// cor de destaque mostrada na amostra de cada tema
const THEME_ACCENT: Record<Theme, string> = {
  "azul-escuro": "#1f8fff", "azul-claro": "#1f7ae0", "verde-escuro": "#16a372", "verde-claro": "#12936a", preto: "#2f8cff", branco: "#1f6fe0",
};

type UnitKey = keyof Units;
const UNIT_OPTS: { key: UnitKey; opts: { v: string; label: () => string }[] }[] = [
  { key: "speed", opts: ["kn", "kmh", "ms", "mph"].map((v) => ({ v, label: () => t(`un.${v}`) })) },
  { key: "wind", opts: ["kn", "kmh", "ms", "mph", "bft"].map((v) => ({ v, label: () => t(`un.${v}`) })) },
  { key: "dist", opts: ["nm", "km", "mi"].map((v) => ({ v, label: () => t(`un.${v}`) })) },
  { key: "height", opts: ["m", "ft"].map((v) => ({ v, label: () => t(`un.${v}`) })) },
  { key: "temp", opts: ["c", "f"].map((v) => ({ v, label: () => t(`un.${v}`) })) },
  { key: "rain", opts: ["mm", "in"].map((v) => ({ v, label: () => t(`un.${v}`) })) },
  { key: "coord", opts: ["dm", "dms", "dd"].map((v) => ({ v, label: () => t(`coord.${v}`) })) },
];

export function settingsView(root: HTMLElement): () => void {
  root.innerHTML = `<div class="page settings">
    <h1>${t("set.title")}</h1>

    <h2>${t("set.lang")}</h2>
    <div class="opts langs">${(Object.keys(LANG_NAMES) as Lang[])
      .map((l) => `<button class="opt ${settings.lang === l ? "on" : ""}" data-lang="${l}"><span>${LANG_FLAGS[l]}</span>${LANG_NAMES[l]}</button>`)
      .join("")}</div>

    <h2>${t("set.theme")}</h2>
    <div class="themes">${THEMES.map(
      (th) => `<button class="theme ${settings.theme === th ? "on" : ""}" data-theme="${th}">
        <span class="sw" style="background:${THEME_COLORS[th]}"><i style="background:${THEME_ACCENT[th]}"></i></span>${t(`th.${th}`)}</button>`,
    ).join("")}</div>

    <h2>${t("set.units")}</h2>
    <div class="units">${UNIT_OPTS.map(
      (u) => `<div class="urow"><span>${t(`u.${u.key}`)}</span><div class="seg small">${u.opts
        .map((o) => `<button class="${settings.units[u.key] === o.v ? "on" : ""}" data-unit="${u.key}" data-v="${o.v}">${o.label()}</button>`)
        .join("")}</div></div>`,
    ).join("")}</div>

    <h2>${t("set.about")}</h2>
    <p class="muted small">${t("set.sources")}</p>
    <p class="disclaimer">${t("disclaimer")}</p>
  </div>`;

  root.querySelectorAll<HTMLButtonElement>("[data-lang]").forEach((b) => b.addEventListener("click", () => updateSettings({ lang: b.dataset.lang as Lang })));
  root.querySelectorAll<HTMLButtonElement>("[data-theme]").forEach((b) => b.addEventListener("click", () => updateSettings({ theme: b.dataset.theme as Theme })));
  root.querySelectorAll<HTMLButtonElement>("[data-unit]").forEach((b) =>
    b.addEventListener("click", () => updateSettings({ units: { [b.dataset.unit as UnitKey]: b.dataset.v } as Partial<Units> })),
  );
  return () => {};
}
