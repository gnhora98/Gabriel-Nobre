import { describe, expect, it } from "vitest";
import { tideExtremes, tideHeight } from "../src/lib/tide";

describe("maré de Salvador", () => {
  it("tem duas preamares e duas baixa-mares por dia (semidiurna)", () => {
    const t0 = Date.parse("2026-11-10T03:00:00Z");
    const ex = tideExtremes(t0, t0 + 86_400_000);
    expect(ex.filter((e) => e.kind === "high").length).toBeGreaterThanOrEqual(1);
    expect(ex.length).toBeGreaterThanOrEqual(3);
    expect(ex.length).toBeLessThanOrEqual(5);
  });

  it("alturas acima do NR ficam na faixa conhecida de Salvador (-0,3 a 2,9 m)", () => {
    const t0 = Date.parse("2026-01-01T00:00:00Z");
    let min = Infinity, max = -Infinity;
    for (let t = t0; t < t0 + 365 * 86_400_000; t += 1_800_000) {
      const h = tideHeight(t);
      min = Math.min(min, h); max = Math.max(max, h);
    }
    expect(min).toBeGreaterThan(-0.4);
    expect(max).toBeLessThan(3.0);
    expect(max - min).toBeGreaterThan(2.2);
  });
});
