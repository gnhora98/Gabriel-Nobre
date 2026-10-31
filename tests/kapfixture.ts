// Gera uma carta KAP sintética (Mercator) pra testes do leitor e da importação.
import { toMercX, toMercY, fromMercX, fromMercY } from "../src/lib/kap";

export function makeKap(opts: { w: number; h: number; south: number; north: number; west: number; east: number; pixel: (x: number, y: number) => number }): Uint8Array {
  const { w, h, south, north, west, east } = opts;
  const X0 = toMercX(west), X1 = toMercX(east), Y0 = toMercY(north), Y1 = toMercY(south);
  const geo = (x: number, y: number) => ({ lon: fromMercX(X0 + (x / w) * (X1 - X0)), lat: fromMercY(Y0 + (y / h) * (Y1 - Y0)) });
  const refs = [[0, 0], [w, 0], [w, h], [0, h]].map(([x, y], i) => { const g = geo(x, y); return `REF/${i + 1},${x},${y},${g.lat.toFixed(8)},${g.lon.toFixed(8)}`; });
  const inset = (x: number, y: number) => geo(x, y);
  const ply = [[40, 40], [w - 40, 40], [w - 40, h - 40], [40, h - 40]].map(([x, y], i) => { const g = inset(x, y); return `PLY/${i + 1},${g.lat.toFixed(8)},${g.lon.toFixed(8)}`; });
  const header = [
    "VER/3.0",
    `BSB/NA=CARTA TESTE SALVADOR,NU=9999,RA=${w},${h},DU=254`,
    "KNP/SC=20000,GD=WGS84,PR=MERCATOR,PP=-13.0,PI=UNKNOWN,SP=UNKNOWN,SK=0.0",
    "    TA=90.0,UN=METERS,SD=MEAN LOWER LOW WATER,DX=2.0,DY=2.0",
    "CED/SE=1,RE=1,ED=01/01/2026",
    "RGB/1,212,236,247", "RGB/2,243,230,184", "RGB/3,30,30,30", "RGB/4,210,30,30", "RGB/5,255,255,255",
    ...refs, ...ply, "DTM/0.0,0.0",
  ].join("\r\n") + "\r\n";
  const out: number[] = [...new TextEncoder().encode(header), 0x1a, 0x00, 7];
  const varint = (v: number) => { const b: number[] = []; do { b.unshift(v & 0x7f); v >>= 7; } while (v); for (let i = 0; i < b.length - 1; i++) b[i] |= 0x80; return b; };
  for (let y = 0; y < h; y++) {
    out.push(...varint(y + 1));
    let x = 0;
    while (x < w) {
      const v = opts.pixel(x, y);
      let run = 1;
      while (x + run < w && opts.pixel(x + run, y) === v) run++;
      x += run;
      // profundidade 7: 1 byte de valor por run; o restante do comprimento em bytes de continuação
      let r = run - 1;
      const extra: number[] = [];
      while (r > 0) { extra.unshift(r & 0x7f); r >>= 7; }
      out.push((v & 0x7f) | (extra.length ? 0x80 : 0));
      for (let i = 0; i < extra.length; i++) out.push(extra[i] | (i < extra.length - 1 ? 0x80 : 0));
    }
    out.push(0);
  }
  return new Uint8Array(out);
}
