// Gera prévia reduzida de uma carta KAP: npx tsx tests/preview-kap.ts carta.kap saida.png [fator]
import { readFileSync, writeFileSync } from "fs";
import { PNG } from "pngjs";
import { blankMask, kapRows, fitGeoref, parseKapHeader, pxToLatLon } from "../src/lib/kap";

const [, , src, out, f = "8"] = process.argv;
const factor = Number(f);
const buf = new Uint8Array(readFileSync(src));
const t0 = Date.now();
const h = parseKapHeader(buf);
const g = fitGeoref(h);
console.log(h.number, h.name, `${h.width}x${h.height}`, "1:" + h.scale, h.projection, "depth", h.depth, "refs", h.refs.length, "ply", h.ply.length, "ed", h.edition, "rmsPx", g.rmsPx.toFixed(3));
console.log("cantos", pxToLatLon(g, 0, 0), pxToLatLon(g, h.width, h.height));
const bm = blankMask(buf, h);
console.log("células vazias", (bm.mask.reduce((a, b) => a + b, 0) / bm.mask.length * 100).toFixed(1) + "%");
const W = Math.ceil(h.width / factor), H = Math.ceil(h.height / factor);
const png = new PNG({ width: W, height: H });
let rows = 0, maxIdx = 0;
for (const [y, row] of kapRows(buf, h)) {
  rows++;
  for (let x = 0; x < h.width; x++) maxIdx = Math.max(maxIdx, row[x]);
  if (y % factor) continue;
  for (let x = 0; x < W; x++) {
    const blank = bm.mask[Math.floor(y / bm.cell) * bm.cw + Math.floor((x * factor) / bm.cell)];
    const c = blank ? [255, 0, 255] : h.palette[row[x * factor]] ?? [255, 0, 255];
    const o = ((y / factor) * W + x) * 4;
    png.data[o] = c[0]; png.data[o + 1] = c[1]; png.data[o + 2] = c[2]; png.data[o + 3] = 255;
  }
}
console.log("linhas", rows, "maior índice", maxIdx, "paleta", h.palette.length - 1, "ms", Date.now() - t0);
writeFileSync(out, PNG.sync.write(png));
