// Importa cartas raster do CHM (.zip ou .kap), corta em blocos com níveis de resolução
// e guarda tudo no aparelho (IndexedDB). Uma GridLayer do Leaflet desenha os blocos sob demanda.
import L from "leaflet";
import { t } from "../i18n";
import { unzipSync } from "fflate";
import { createStore, get, set, del, keys } from "idb-keyval";
import { blankMask, fitGeoref, kapRows, latLonToPx, parseKapHeader, pxToLatLon, toMercX, toMercY, type Georef, type KapHeader } from "./kap";

const TILE = 512;
const LEVELS = [1, 4, 16]; // fator de redução de cada nível

export type ChartMeta = {
  id: string;
  number: string;
  name: string;
  scale: number;
  edition: string;
  update?: string;
  importedAt: number;
  width: number;
  height: number;
  georef: Georef;
  bounds: [[number, number], [number, number]]; // [[S,W],[N,E]]
  levels: { factor: number; cols: number; rows: number; w: number; h: number }[];
  file: string;
  builtin?: string; // versão da carta incluída no app (ausente = importada pelo usuário)
  base?: string; // cartas incluídas: pasta dos blocos PNG prontos (gerados por scripts/build-charts.ts)
};

const metaStore = createStore("cartas-meta", "meta");
const tileStore = createStore("cartas-tiles", "tiles");

let builtinCatalog: Promise<ChartMeta[]> | null = null;

/** Cartas que já vêm no app (site e APK), prontas em public/charts. */
function builtinCharts(): Promise<ChartMeta[]> {
  builtinCatalog ??= fetch(`${import.meta.env.BASE_URL}charts/catalog.json`)
    .then((r) => (r.ok ? r.json() : { cartas: [] }))
    .then((d: { cartas: ChartMeta[] }) => d.cartas)
    .catch(() => {
      builtinCatalog = null;
      return [];
    });
  return builtinCatalog;
}

/** Cartas incluídas + importadas pelo usuário (a importada substitui a incluída de mesmo número). */
export async function listCharts(): Promise<ChartMeta[]> {
  const ks = await keys(metaStore);
  const mine: ChartMeta[] = [];
  for (const k of ks) {
    const m = await get<ChartMeta>(k, metaStore);
    if (!m) continue;
    // cópia antiga de carta incluída (v1.1 processava no aparelho): agora vem pronta, apaga
    if (m.builtin) void deleteChart(m.id);
    else mine.push(m);
  }
  const ids = new Set(mine.map((m) => m.id));
  const all = [...(await builtinCharts()).filter((m) => !ids.has(m.id)), ...mine];
  return all.sort((a, b) => b.scale - a.scale);
}

export async function deleteChart(id: string): Promise<void> {
  const m = await get<ChartMeta>(id, metaStore);
  if (!m) return;
  for (const lv of m.levels)
    for (let r = 0; r < lv.rows; r++)
      for (let c = 0; c < lv.cols; c++) await del(`${id}/${lv.factor}/${r}/${c}`, tileStore);
  await del(id, metaStore);
  bitmapCache.clear();
}

function makeCanvas(w: number, h: number): HTMLCanvasElement | OffscreenCanvas {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h);
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  return c;
}

async function toBlob(c: HTMLCanvasElement | OffscreenCanvas): Promise<Blob> {
  if ("convertToBlob" in c) return c.convertToBlob({ type: "image/png" });
  return new Promise((res, rej) => (c as HTMLCanvasElement).toBlob((b) => (b ? res(b) : rej(new Error("toBlob falhou"))), "image/png"));
}

type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

/** Recorta pelo polígono útil da carta (PLY), escondendo margens e legendas. */
function maskPly(ctx: Ctx, h: KapHeader, g: Georef, ox: number, oy: number, factor: number) {
  if (h.ply.length < 3) return;
  ctx.globalCompositeOperation = "destination-in";
  ctx.beginPath();
  h.ply.forEach((p, i) => {
    const q = latLonToPx(g, p.lat + h.dtm.lat, p.lon + h.dtm.lon);
    const x = (q.x - ox) / factor, y = (q.y - oy) / factor;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  });
  ctx.closePath();
  ctx.fillStyle = "#000";
  ctx.fill();
  ctx.globalCompositeOperation = "source-over";
}

export type ImportProgress = (msg: string, frac: number) => void;

/** Importa um arquivo .zip (BSB) ou .kap. Retorna as cartas criadas. */
export async function importChartFile(file: File, progress: ImportProgress = () => {}): Promise<ChartMeta[]> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const kaps: { name: string; data: Uint8Array }[] = [];
  if (file.name.toLowerCase().endsWith(".zip") || (buf[0] === 0x50 && buf[1] === 0x4b)) {
    const files = unzipSync(buf, { filter: (f) => /\.kap$/i.test(f.name) });
    for (const [name, data] of Object.entries(files)) kaps.push({ name: name.split("/").pop()!, data });
    if (!kaps.length) throw new Error(t("charts.noKap"));
  } else {
    kaps.push({ name: file.name, data: buf });
  }
  const out: ChartMeta[] = [];
  for (let i = 0; i < kaps.length; i++) {
    out.push(await importKap(kaps[i].name, kaps[i].data, (m, f) => progress(`${kaps[i].name}: ${m}`, (i + f) / kaps.length)));
  }
  bitmapCache.clear();
  return out;
}

async function importKap(fileName: string, data: Uint8Array, progress: ImportProgress): Promise<ChartMeta> {
  const h = parseKapHeader(data);
  const g = fitGeoref(h);
  const id = fileName.replace(/\.kap$/i, "").toUpperCase();
  await deleteChart(id);
  progress("analisando", 0);
  const blank = blankMask(data, h);

  // Tabela de cores RGBA (índice 0 = transparente).
  const lut = new Uint32Array(256);
  const little = new Uint8Array(new Uint32Array([1]).buffer)[0] === 1;
  h.palette.forEach((c, i) => {
    if (!c) return;
    lut[i] = little ? ((255 << 24) | (c[2] << 16) | (c[1] << 8) | c[0]) >>> 0 : ((c[0] << 24) | (c[1] << 16) | (c[2] << 8) | 255) >>> 0;
  });

  const levels = LEVELS.map((factor) => {
    const w = Math.ceil(h.width / factor), hh = Math.ceil(h.height / factor);
    return { factor, w, h: hh, cols: Math.ceil(w / TILE), rows: Math.ceil(hh / TILE) };
  }).filter((lv, i) => i === 0 || lv.w >= TILE / 2);

  // Canvases dos níveis reduzidos, montados faixa a faixa.
  const ovr = levels.slice(1).map((lv) => {
    const c = makeCanvas(lv.w, lv.h);
    const ctx = c.getContext("2d") as Ctx;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    return { lv, c, ctx };
  });

  const strip = new Uint32Array(h.width * TILE);
  const stripCanvas = makeCanvas(h.width, TILE);
  const sctx = stripCanvas.getContext("2d") as Ctx;
  const tileCanvas = makeCanvas(TILE, TILE);
  const tctx = tileCanvas.getContext("2d") as Ctx;

  const flush = async (stripRow: number) => {
    const rows = Math.min(TILE, h.height - stripRow);
    const img = new ImageData(new Uint8ClampedArray(strip.buffer, 0, h.width * rows * 4), h.width, rows);
    sctx.clearRect(0, 0, h.width, TILE);
    sctx.putImageData(img, 0, 0);
    const lv = levels[0];
    for (let c = 0; c < lv.cols; c++) {
      tctx.clearRect(0, 0, TILE, TILE);
      tctx.drawImage(stripCanvas as CanvasImageSource, c * TILE, 0, TILE, rows, 0, 0, TILE, rows);
      maskPly(tctx, h, g, c * TILE, stripRow, 1);
      await set(`${id}/1/${stripRow / TILE}/${c}`, await toBlob(tileCanvas), tileStore);
    }
    for (const o of ovr) {
      const f = o.lv.factor;
      o.ctx.drawImage(stripCanvas as CanvasImageSource, 0, 0, h.width, rows, 0, stripRow / f, h.width / f, rows / f);
    }
  };

  // As linhas vêm em ordem crescente no KAP; grava uma faixa de TILE linhas por vez.
  let stripRow = 0;
  for (const [y, row] of kapRows(data, h)) {
    const sIdx = Math.floor(y / TILE) * TILE;
    if (sIdx !== stripRow) {
      await flush(stripRow);
      strip.fill(0);
      stripRow = sIdx;
      progress("cortando blocos", y / h.height);
    }
    const base = (y - stripRow) * h.width;
    const mrow = Math.floor(y / blank.cell) * blank.cw;
    for (let x = 0; x < h.width; x++) strip[base + x] = blank.mask[mrow + Math.floor(x / blank.cell)] ? 0 : lut[row[x]];
  }
  await flush(stripRow);

  for (const o of ovr) {
    for (let r = 0; r < o.lv.rows; r++)
      for (let c = 0; c < o.lv.cols; c++) {
        tctx.clearRect(0, 0, TILE, TILE);
        tctx.drawImage(o.c as CanvasImageSource, c * TILE, r * TILE, TILE, TILE, 0, 0, TILE, TILE);
        maskPly(tctx, h, g, c * TILE * o.lv.factor, r * TILE * o.lv.factor, o.lv.factor);
        await set(`${id}/${o.lv.factor}/${r}/${c}`, await toBlob(tileCanvas), tileStore);
      }
  }

  const a = pxToLatLon(g, 0, 0), b = pxToLatLon(g, h.width, h.height);
  const meta: ChartMeta = {
    id, number: h.number || id, name: h.name, scale: h.scale, edition: h.edition, update: h.update, importedAt: Date.now(),
    width: h.width, height: h.height, georef: g,
    bounds: [[Math.min(a.lat, b.lat), Math.min(a.lon, b.lon)], [Math.max(a.lat, b.lat), Math.max(a.lon, b.lon)]],
    levels: levels.map(({ factor, cols, rows, w, h: hh }) => ({ factor, cols, rows, w, h: hh })),
    file: fileName,
  };
  await set(id, meta, metaStore);
  progress("pronto", 1);
  return meta;
}

const R = 6378137;

// ---------- Camada de exibição ----------

const bitmapCache = new Map<string, Promise<ImageBitmap | null>>();
const CACHE_MAX = 80;

function loadTile(m: ChartMeta, f: number, r: number, c: number): Promise<ImageBitmap | null> {
  return m.base ? loadBitmap(`${import.meta.env.BASE_URL}${m.base}${f}/${r}-${c}.png`, true) : loadBitmap(`${m.id}/${f}/${r}/${c}`);
}

function loadBitmap(key: string, url = false): Promise<ImageBitmap | null> {
  let p = bitmapCache.get(key);
  if (p) {
    bitmapCache.delete(key);
    bitmapCache.set(key, p);
    return p;
  }
  const blob = url ? fetch(key).then((r) => (r.ok ? r.blob() : undefined)) : get<Blob>(key, tileStore);
  p = blob.then((b) => (b ? createImageBitmap(b) : null)).catch(() => null);
  bitmapCache.set(key, p);
  if (bitmapCache.size > CACHE_MAX) {
    const first = bitmapCache.keys().next().value as string;
    const old = bitmapCache.get(first);
    bitmapCache.delete(first);
    old?.then((bm) => bm?.close());
  }
  return p;
}

const HALF = Math.PI * R;

export class ChartLayer extends L.GridLayer {
  charts: ChartMeta[] = [];

  setCharts(charts: ChartMeta[]) {
    // Escala maior (menos detalhe) embaixo; carta mais detalhada por cima.
    this.charts = [...charts].sort((a, b) => b.scale - a.scale);
    this.redraw();
  }

  createTile(coords: L.Coords, done: L.DoneCallback): HTMLElement {
    const size = this.getTileSize();
    const canvas = document.createElement("canvas");
    canvas.width = size.x;
    canvas.height = size.y;
    this.drawTile(canvas, coords).then(() => done(undefined, canvas), (e) => done(e, canvas));
    return canvas;
  }

  private async drawTile(canvas: HTMLCanvasElement, c: L.Coords) {
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingEnabled = true;
    const n = 2 ** c.z;
    const span = (2 * HALF) / n;
    const X0 = -HALF + c.x * span, X1 = X0 + span;
    const Y0 = HALF - c.y * span, Y1 = Y0 - span; // topo, base
    for (const m of this.charts) {
      const g = m.georef;
      // retângulo do tile web em pixels da carta (nível 1)
      const px0 = g.ax * X0 + g.bx, px1 = g.ax * X1 + g.bx;
      const py0 = g.ay * Y0 + g.by, py1 = g.ay * Y1 + g.by;
      const left = Math.min(px0, px1), right = Math.max(px0, px1);
      const top = Math.min(py0, py1), bottom = Math.max(py0, py1);
      if (right <= 0 || bottom <= 0 || left >= m.width || top >= m.height) continue;
      const ratio = (right - left) / canvas.width; // pixels da carta por pixel de tela
      if (ratio > 48) continue; // muito afastado: carta ilegível, não desenha
      const lv = [...m.levels].reverse().find((l) => l.factor <= Math.max(1, ratio)) ?? m.levels[0];
      const f = lv.factor;
      const lx0 = left / f, lx1 = right / f, ly0 = top / f, ly1 = bottom / f;
      const sx = canvas.width / (lx1 - lx0), sy = canvas.height / (ly1 - ly0);
      const c0 = Math.max(0, Math.floor(lx0 / TILE)), c1 = Math.min(lv.cols - 1, Math.floor(lx1 / TILE));
      const r0 = Math.max(0, Math.floor(ly0 / TILE)), r1 = Math.min(lv.rows - 1, Math.floor(ly1 / TILE));
      const jobs: Promise<void>[] = [];
      for (let r = r0; r <= r1; r++)
        for (let cc = c0; cc <= c1; cc++) {
          jobs.push(
            loadTile(m, f, r, cc).then((bm) => {
              if (!bm) return;
              const dx = (cc * TILE - lx0) * sx, dy = (r * TILE - ly0) * sy;
              ctx.drawImage(bm, dx, dy, TILE * sx, TILE * sy);
            }),
          );
        }
      await Promise.all(jobs);
    }
  }
}

export function chartsCover(charts: ChartMeta[], lat: number, lon: number): ChartMeta[] {
  const X = toMercX(lon), Y = toMercY(lat);
  return charts.filter((m) => {
    const x = m.georef.ax * X + m.georef.bx, y = m.georef.ay * Y + m.georef.by;
    return x >= 0 && y >= 0 && x < m.width && y < m.height;
  });
}
