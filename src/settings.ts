// Preferências do usuário: idioma, tema e unidades. Ficam salvas no aparelho.
// (sem importar util.ts, que depende daqui pro idioma das datas)
function storageGet<T>(key: string, def: T): T {
  try {
    const v = localStorage.getItem(key);
    return v == null ? def : (JSON.parse(v) as T);
  } catch {
    return def;
  }
}
function storageSet(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* sem armazenamento */
  }
}

export type Lang = "pt" | "es" | "en" | "fr" | "de";
export type Theme = "azul-escuro" | "azul-claro" | "verde-escuro" | "verde-claro" | "preto" | "branco";
export type Units = {
  speed: "kn" | "kmh" | "ms" | "mph";
  wind: "kn" | "kmh" | "ms" | "mph" | "bft";
  dist: "nm" | "km" | "mi";
  height: "m" | "ft";
  temp: "c" | "f";
  rain: "mm" | "in";
  coord: "dm" | "dms" | "dd";
};
export type Settings = { lang: Lang; theme: Theme; units: Units };

const DEFAULTS: Settings = {
  lang: "pt",
  theme: "azul-escuro",
  units: { speed: "kn", wind: "kn", dist: "nm", height: "m", temp: "c", rain: "mm", coord: "dm" },
};

function initialLang(): Lang {
  const n = (navigator.language || "pt").slice(0, 2) as Lang;
  return (["pt", "es", "en", "fr", "de"] as Lang[]).includes(n) ? n : "pt";
}

const saved = storageGet<Partial<Settings> | null>("settings", null);
export const settings: Settings = {
  lang: saved?.lang ?? initialLang(),
  theme: saved?.theme ?? DEFAULTS.theme,
  units: { ...DEFAULTS.units, ...(saved?.units ?? {}) },
};

const listeners = new Set<() => void>();
export function onSettings(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export const THEME_COLORS: Record<Theme, string> = {
  "azul-escuro": "#0f1c2b",
  "azul-claro": "#eef5fb",
  "verde-escuro": "#0d1f1a",
  "verde-claro": "#eef8f3",
  preto: "#000000",
  branco: "#f6f7f9",
};

export function applySettings() {
  const html = document.documentElement;
  html.dataset.theme = settings.theme;
  html.lang = { pt: "pt-BR", es: "es", en: "en", fr: "fr", de: "de" }[settings.lang];
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", THEME_COLORS[settings.theme]);
}

export function updateSettings(patch: Partial<Omit<Settings, "units">> & { units?: Partial<Units> }) {
  if (patch.lang) settings.lang = patch.lang;
  if (patch.theme) settings.theme = patch.theme;
  if (patch.units) Object.assign(settings.units, patch.units);
  storageSet("settings", settings);
  applySettings();
  listeners.forEach((f) => f());
}
