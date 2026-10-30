import { describe, expect, it } from "vitest";
import { decodeKapRows, fitGeoref, latLonToPx, parseKapHeader, pxToLatLon } from "../src/lib/kap";
import { makeKap } from "./kapfixture";

const pixel = (x: number, y: number) => (x > 300 && y < 200 ? 2 : (x + y) % 97 === 0 ? 3 : 1);
const kap = makeKap({ w: 640, h: 480, south: -13.05, north: -12.9, west: -38.62, east: -38.45, pixel });

describe("leitor KAP", () => {
  it("lê o cabeçalho", () => {
    const h = parseKapHeader(kap);
    expect(h.width).toBe(640);
    expect(h.height).toBe(480);
    expect(h.number).toBe("9999");
    expect(h.scale).toBe(20000);
    expect(h.projection).toBe("MERCATOR");
    expect(h.refs).toHaveLength(4);
    expect(h.ply).toHaveLength(4);
    expect(h.palette[2]).toEqual([243, 230, 184]);
  });

  it("decodifica todas as linhas sem erro", () => {
    const h = parseKapHeader(kap);
    let n = 0, bad = 0;
    decodeKapRows(kap, h, (y, row) => {
      n++;
      for (let x = 0; x < h.width; x++) if (row[x] !== pixel(x, y)) bad++;
    });
    expect(n).toBe(480);
    expect(bad).toBe(0);
  });

  it("georreferencia com erro menor que 1 pixel", () => {
    const h = parseKapHeader(kap);
    const g = fitGeoref(h);
    expect(g.rmsPx).toBeLessThan(1);
    const p = latLonToPx(g, -12.975, -38.535);
    const back = pxToLatLon(g, p.x, p.y);
    expect(back.lat).toBeCloseTo(-12.975, 6);
    expect(back.lon).toBeCloseTo(-38.535, 6);
    expect(pxToLatLon(g, 0, 0).lat).toBeCloseTo(-12.9, 5);
  });
});
