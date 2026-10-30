// Gera a base fixa de cartas náuticas: lê os KAP de charts-src/ e grava blocos PNG prontos em
// public/charts/<ID>/<fator>/<linha>-<coluna>.png + public/charts/catalog.json.
// Roda antes do build (npm run build), então site e APK já saem com as cartas embutidas.
//
// Pra incluir uma carta nova: coloque o .KAP (ou o .zip BSB do CHM) em charts-src/ e rode o build.
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import sharp from "sharp";
import { unzipSync } from "fflate";
import { blankMask, fitGeoref, kapRows, latLonToPx, parseKapHeader, pxToLatLon, type KapHeader, type Georef } from "../src/lib/kap";
import type { ChartMeta } from "../src/lib/charts";

const SRC = "charts-src";
const OUT = "public/charts";
const TILE = 512;
const LEVELS = [1, 4, 16];

function kapFiles(): { name: string; data: Uint8Array }[] {
  const out: { name: string; data: Uint8Array }[] = [];
  for (const f of readdirSync(SRC).sort()) {
    const buf = new Uint8Array(readFileSync(join(SRC, f)));
    if (/\.kap$/i.test(f)) out.push({ name: f, data: buf });
    else if (/\.zip$/i.test(f)) {
      const files = unzipSync(buf, { filter: (e) => /\.kap$/i.test(e.name) });
      for (const [n, d] of Object.entries(files)) out.push({ name: n.split("/").pop()!, data: d });
    }
  }
  // um mesmo KAP pode vir solto e dentro do zip: fica um só
  return [...new Map(out.map((k) => [k.name.toUpperCase(), k])).values()];
}

/** Intervalos [x0, x1) dentro do polígono útil (PLY) na linha y, em pixels. */
function plyIntervals(poly: { x: number; y: number }[], y: number, width: number): [number, number][] {
  if (poly.length < 3) return [[0, width]];
  const yc = y + 0.5;
  const xs: number[] = [];
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i], b = poly[j];
    if ((a.y > yc) !== (b.y > yc)) xs.push(a.x + ((yc - a.y) / (b.y - a.y)) * (b.x - a.x));
  }
  xs.sort((p, q) => p - q);
  const out: [number, number][] = [];
  for (let k = 0; k + 1 < xs.length; k += 2) out.push([Math.max(0, Math.round(xs[k])), Math.min(width, Math.round(xs[k + 1]))]);
  return out;
}

/** Reduz uma imagem RGBA por `f` (média com peso de transparência). */
function downsample(src: Uint8Array, w: number, h: number, f: number): { data: Uint8Array; w: number; h: number } {
  const W = Math.ceil(w / f), H = Math.ceil(h / f);
  const out = new Uint8Array(W * H * 4);
  for (let Y = 0; Y < H; Y++)
    for (let X = 0; X < W; X++) {
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let y = Y * f; y < Math.min(h, Y * f + f); y++)
        for (let x = X * f; x < Math.min(w, X * f + f); x++) {
          const o = (y * w + x) * 4, al = src[o + 3];
          r += src[o] * al; g += src[o + 1] * al; b += src[o + 2] * al; a += al; n++;
        }
      const o = (Y * W + X) * 4;
      if (a) { out[o] = r / a; out[o + 1] = g / a; out[o + 2] = b / a; out[o + 3] = a / n; }
    }
  return { data: out, w: W, h: H };
}

async function writeTiles(img: Uint8Array, w: number, h: number, dir: string) {
  mkdirSync(dir, { recursive: true });
  const cols = Math.ceil(w / TILE), rows = Math.ceil(h / TILE);
  const tile = Buffer.alloc(TILE * TILE * 4);
  const jobs: Promise<unknown>[] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) {
      // copia só o bloco (copiar a imagem inteira por bloco deixava o build lento)
      tile.fill(0);
      const tw = Math.min(TILE, w - c * TILE), th = Math.min(TILE, h - r * TILE);
      for (let y = 0; y < th; y++) {
        const s0 = ((r * TILE + y) * w + c * TILE) * 4;
        tile.set(img.subarray(s0, s0 + tw * 4), y * TILE * 4);
      }
      jobs.push(
        sharp(Buffer.from(tile), { raw: { width: TILE, height: TILE, channels: 4 } })
          .png({ palette: true, quality: 100, dither: 0, compressionLevel: 9 })
          .toFile(join(dir, `${r}-${c}.png`)),
      );
      if (jobs.length >= 8) await Promise.all(jobs.splice(0));
    }
  await Promise.all(jobs);
  return { cols, rows };
}

async function buildChart(name: string, data: Uint8Array): Promise<ChartMeta> {
  const h: KapHeader = parseKapHeader(data);
  const g: Georef = fitGeoref(h);
  const id = name.replace(/\.kap$/i, "").toUpperCase();
  const blank = blankMask(data, h);
  const poly = h.ply.map((p) => latLonToPx(g, p.lat + h.dtm.lat, p.lon + h.dtm.lon));

  // imagem RGBA completa, já com transparência fora do polígono e nas áreas vazias
  const img = new Uint8Array(h.width * h.height * 4);
  for (const [y, row] of kapRows(data, h)) {
    const mrow = Math.floor(y / blank.cell) * blank.cw;
    for (const [x0, x1] of plyIntervals(poly, y, h.width))
      for (let x = x0; x < x1; x++) {
        const c = h.palette[row[x]];
        if (!c || blank.mask[mrow + Math.floor(x / blank.cell)]) continue;
        const o = (y * h.width + x) * 4;
        img[o] = c[0]; img[o + 1] = c[1]; img[o + 2] = c[2]; img[o + 3] = 255;
      }
  }

  const levels: ChartMeta["levels"] = [];
  let cur = { data: img, w: h.width, h: h.height }, prevF = 1;
  for (const f of LEVELS) {
    if (f > 1) {
      if (cur.w / (f / prevF) < TILE / 2) break;
      cur = downsample(cur.data, cur.w, cur.h, f / prevF);
      prevF = f;
    }
    const { cols, rows } = await writeTiles(cur.data, cur.w, cur.h, join(OUT, id, String(f)));
    levels.push({ factor: f, cols, rows, w: cur.w, h: cur.h });
  }

  const a = pxToLatLon(g, 0, 0), b = pxToLatLon(g, h.width, h.height);
  return {
    id, number: h.number || id, name: h.name, scale: h.scale, edition: h.edition, update: h.update, importedAt: 0,
    width: h.width, height: h.height, georef: g,
    bounds: [[Math.min(a.lat, b.lat), Math.min(a.lon, b.lon)], [Math.max(a.lat, b.lat), Math.max(a.lon, b.lon)]],
    levels, file: name, builtin: h.update || h.edition || "1", base: `charts/${id}/`,
  };
}

const t0 = Date.now();
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const catalog: ChartMeta[] = [];
for (const k of kapFiles()) {
  const m = await buildChart(k.name, k.data);
  catalog.push(m);
  console.log(`carta ${m.id} (${m.name}) 1:${m.scale} — ${m.levels.map((l) => `${l.cols}x${l.rows}`).join(", ")} blocos`);
}
writeFileSync(join(OUT, "catalog.json"), JSON.stringify({ fonte: "Cartas raster BSB do CHM/DHN – Marinha do Brasil", cartas: catalog }));
console.log(`${catalog.length} carta(s) em ${((Date.now() - t0) / 1000).toFixed(1)} s`);
