// Gera uma carta sintética grande pra testar a importação no navegador: npx tsx tests/gen-sample.ts saida.kap
import { writeFileSync } from "fs";
import { makeKap } from "./kapfixture";
const w = 3000, h = 2400;
const kap = makeKap({
  w, h, south: -13.05, north: -12.9, west: -38.62, east: -38.45,
  pixel: (x, y) => (x > 2000 && y < 900 + x / 10 ? 2 : x % 250 < 3 || y % 250 < 3 ? 3 : Math.hypot(x - 1500, y - 1200) < 60 ? 4 : 1),
});
writeFileSync(process.argv[2], kap);
console.log(kap.length, "bytes");
