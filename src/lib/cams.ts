// Câmeras ao vivo: as do app (beaches.ts) + as que o usuário adiciona (guardadas no aparelho).
import type { Beach, Cam } from "../data/beaches";
import { storageGet, storageSet } from "./util";

const KEY = "userCams";
type UserCams = Record<string, Cam[]>;

export function camsFor(b: Beach): (Cam & { user?: boolean })[] {
  const mine = storageGet<UserCams>(KEY, {})[b.id] ?? [];
  return [...(b.cams ?? []), ...mine.map((c) => ({ ...c, user: true }))];
}

export function addUserCam(beachId: string, cam: Cam) {
  const all = storageGet<UserCams>(KEY, {});
  (all[beachId] ??= []).push(cam);
  storageSet(KEY, all);
}

export function removeUserCam(beachId: string, url: string) {
  const all = storageGet<UserCams>(KEY, {});
  all[beachId] = (all[beachId] ?? []).filter((c) => c.url !== url);
  storageSet(KEY, all);
}

/** Aceita só links http(s); completa "www.site.com" com https://. */
export function normalizeUrl(raw: string): string | null {
  let u = raw.trim();
  if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
  try {
    const p = new URL(u);
    return p.protocol === "https:" || p.protocol === "http:" ? p.href : null;
  } catch {
    return null;
  }
}
