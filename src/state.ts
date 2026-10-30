// Estado global simples: dados de previsão (cache offline) + atualização automática.
import { loadCached, refresh, type Bundle } from "./lib/forecast";

type Listener = (b: Bundle | undefined) => void;

export const state = {
  bundle: undefined as Bundle | undefined,
  loading: false,
  error: "" as string,
  online: navigator.onLine,
};

const listeners = new Set<Listener>();
export function onData(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
const emit = () => listeners.forEach((f) => f(state.bundle));

export async function initData() {
  state.bundle = await loadCached();
  emit();
  update();
  window.addEventListener("online", () => { state.online = true; update(); });
  window.addEventListener("offline", () => { state.online = false; emit(); });
  // Ao voltar pro app (estava em segundo plano), atualiza se o dado tiver mais de 30 min.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && (!state.bundle || Date.now() - state.bundle.fetchedAt > 30 * 60_000)) update();
  });
}

export async function update() {
  if (!navigator.onLine) return;
  state.loading = true;
  state.error = "";
  emit();
  try {
    state.bundle = await refresh();
  } catch (e) {
    state.error = e instanceof Error ? e.message : String(e);
  } finally {
    state.loading = false;
    emit();
  }
}
