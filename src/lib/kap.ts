// Leitor de cartas raster no formato NOAA BSB/KAP v3 (formato das cartas raster gratuitas do CHM).
// Referência do formato: driver BSB do GDAL (frmts/bsb/bsb_read.c).

export type RefPoint = { x: number; y: number; lat: number; lon: number };

export type KapHeader = {
  name: string;
  number: string;
  width: number;
  height: number;
  scale: number;
  projection: string;
  datum: string;
  edition: string;
  update: string; // último Aviso aos Navegantes aplicado (NTM), ex. "2024-80 (06/10/2024)"
  palette: [number, number, number][]; // índice → RGB (índice 0 não usado)
  refs: RefPoint[];
  ply: { lat: number; lon: number }[];
  dtm: { lat: number; lon: number }; // deslocamento de datum (graus)
  dataOffset: number;
  depth: number;
};

function fields(rec: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /([A-Z][A-Z0-9])=(.*?)(?=,\s*[A-Z][A-Z0-9]=|$)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(rec))) out[m[1]] = m[2].trim();
  return out;
}

export function parseKapHeader(buf: Uint8Array): KapHeader {
  let end = buf.indexOf(0x1a);
  if (end < 0) throw new Error("Arquivo KAP inválido (sem fim de cabeçalho)");
  const text = new TextDecoder("latin1").decode(buf.subarray(0, end));
  // Junta linhas de continuação (começam com espaço).
  const lines: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    if (/^\s/.test(raw) && lines.length) lines[lines.length - 1] += "," + raw.trim();
    else if (raw.trim()) lines.push(raw.trim());
  }
  const h: KapHeader = {
    name: "", number: "", width: 0, height: 0, scale: 0, projection: "", datum: "", edition: "", update: "",
    palette: [], refs: [], ply: [], dtm: { lat: 0, lon: 0 }, dataOffset: 0, depth: 7,
  };
  for (const line of lines) {
    if (line.startsWith("!")) continue;
    const slash = line.indexOf("/");
    if (slash < 0) continue;
    const tag = line.slice(0, slash);
    const body = line.slice(slash + 1);
    const nums = () => body.split(",").map((s) => parseFloat(s));
    switch (tag) {
      case "BSB":
      case "NOS": {
        const f = fields(body);
        h.name ||= f.NA ?? "";
        h.number ||= f.NU ?? "";
        if (f.RA) {
          const [w, hh] = f.RA.split(",").map((s) => parseInt(s, 10));
          h.width = w; h.height = hh;
        }
        break;
      }
      case "KNP": {
        const f = fields(body);
        if (f.SC) h.scale = parseFloat(f.SC);
        if (f.PR) h.projection = f.PR.toUpperCase();
        if (f.GD) h.datum = f.GD;
        break;
      }
      case "CED": {
        const f = fields(body);
        h.edition = f.ED ?? f.SE ?? "";
        break;
      }
      case "NTM": {
        const f = fields(body);
        if (f.NE) h.update = f.ND ? `${f.NE} (${f.ND})` : f.NE;
        break;
      }
      case "RGB": {
        const [i, r, g, b] = nums();
        h.palette[i] = [r, g, b];
        break;
      }
      case "REF": {
        const [, x, y, lat, lon] = nums();
        h.refs.push({ x, y, lat, lon });
        break;
      }
      case "PLY": {
        const [, lat, lon] = nums();
        h.ply.push({ lat, lon });
        break;
      }
      case "DTM": {
        const [dlat, dlon] = nums();
        // Deslocamento em segundos de arco.
        h.dtm = { lat: (dlat || 0) / 3600, lon: (dlon || 0) / 3600 };
        break;
      }
    }
  }
  if (!h.width || !h.height) throw new Error("Cabeçalho KAP sem dimensões (RA)");
  end++;
  if (buf[end] === 0x00) end++;
  h.depth = buf[end];
  h.dataOffset = end + 1;
  if (h.depth < 1 || h.depth > 7) throw new Error(`Profundidade de cor inválida: ${h.depth}`);
  return h;
}

/**
 * Decodifica as linhas do raster em sequência, chamando `onRow(y, indices)` para cada linha (y base 0).
 * `indices` é reaproveitado entre chamadas.
 */
export function decodeKapRows(buf: Uint8Array, h: KapHeader, onRow: (y: number, row: Uint8Array) => void): void {
  for (const [y, row] of kapRows(buf, h)) onRow(y, row);
}

/** Gerador de linhas [y, índices]; o array é reaproveitado a cada passo. */
export function* kapRows(buf: Uint8Array, h: KapHeader): Generator<[number, Uint8Array]> {
  const shift = 7 - h.depth;
  const valueMask = ((1 << h.depth) - 1) << shift;
  const countMask = (1 << shift) - 1;
  const row = new Uint8Array(h.width);
  let p = h.dataOffset;
  const n = buf.length;
  for (let r = 0; r < h.height && p < n; r++) {
    // número da linha (varint 7 bits)
    let line = 0, c: number;
    do {
      c = buf[p++];
      line = line * 128 + (c & 0x7f);
    } while (c & 0x80 && p < n);
    row.fill(0);
    let x = 0;
    while (p < n && (c = buf[p++]) !== 0) {
      const v = (c & valueMask) >> shift;
      let run = c & countMask;
      while (c & 0x80 && p < n) {
        c = buf[p++];
        run = run * 128 + (c & 0x7f);
      }
      run += 1;
      const e = Math.min(x + run, h.width);
      row.fill(v, x, e);
      x = e;
    }
    const y = line - 1;
    if (y >= 0 && y < h.height) yield [y, row];
  }
}

// ---------- Georreferenciamento ----------

const R = 6378137;
export const toMercX = (lon: number) => (R * lon * Math.PI) / 180;
export const toMercY = (lat: number) => R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
export const fromMercX = (x: number) => (x / R) * (180 / Math.PI);
export const fromMercY = (y: number) => (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * (180 / Math.PI);

/** Transformação linear pixel ↔ Web Mercator (carta norte-pra-cima). */
export type Georef = { ax: number; bx: number; ay: number; by: number; rmsPx: number };

function linfit(xs: number[], ys: number[]): [number, number] {
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; }
  const a = sxy / sxx;
  return [a, my - a * mx];
}

/** Ajusta px = ax*X + bx, py = ay*Y + by (X,Y em metros Web Mercator). */
export function fitGeoref(h: KapHeader): Georef {
  if (h.refs.length < 2) throw new Error("Carta sem pontos de referência (REF)");
  if (!h.projection.startsWith("MERCATOR")) {
    // Outras projeções funcionam aproximadamente em áreas pequenas.
    console.warn("Projeção não-Mercator:", h.projection);
  }
  const X = h.refs.map((r) => toMercX(r.lon + h.dtm.lon));
  const Y = h.refs.map((r) => toMercY(r.lat + h.dtm.lat));
  const [ax, bx] = linfit(X, h.refs.map((r) => r.x));
  const [ay, by] = linfit(Y, h.refs.map((r) => r.y));
  let s = 0;
  h.refs.forEach((r, i) => { s += (ax * X[i] + bx - r.x) ** 2 + (ay * Y[i] + by - r.y) ** 2; });
  return { ax, bx, ay, by, rmsPx: Math.sqrt(s / h.refs.length) };
}

export const pxToLatLon = (g: Georef, px: number, py: number) => ({
  lat: fromMercY((py - g.by) / g.ay),
  lon: fromMercX((px - g.bx) / g.ax),
});
export const latLonToPx = (g: Georef, lat: number, lon: number) => ({
  x: g.ax * toMercX(lon) + g.bx,
  y: g.ay * toMercY(lat) + g.by,
});

// ---------- Áreas em branco (fora do desenho) ----------

/**
 * Detecta regiões brancas "vazias" que encostam nos cantos da carta (ex.: área fora de um plano
 * com borda diagonal). No papel elas não têm informação, mas branco também é a cor de água funda,
 * então se ficarem por cima de outra carta escondem áreas rasas. Retorna uma grade (célula de
 * `cell` px) com 1 nas células a deixar transparentes.
 */
export function blankMask(buf: Uint8Array, h: KapHeader, cell = 4): { cell: number; cw: number; ch: number; mask: Uint8Array } {
  const cw = Math.ceil(h.width / cell), ch = Math.ceil(h.height / cell);
  const white = new Uint8Array(256);
  h.palette.forEach((c, i) => { if (c && c[0] >= 250 && c[1] >= 250 && c[2] >= 250) white[i] = 1; });
  // célula "toda branca" só se todos os pixels dela forem brancos
  const allWhite = new Uint8Array(cw * ch).fill(1);
  for (const [y, row] of kapRows(buf, h)) {
    const base = Math.floor(y / cell) * cw;
    for (let x = 0; x < h.width; x++) if (!white[row[x]]) allWhite[base + Math.floor(x / cell)] = 0;
  }
  const mask = new Uint8Array(cw * ch);
  const stack: number[] = [];
  for (const start of [0, cw - 1, (ch - 1) * cw, ch * cw - 1]) {
    if (!allWhite[start] || mask[start]) continue;
    const region: number[] = [];
    stack.push(start);
    mask[start] = 1;
    while (stack.length) {
      const i = stack.pop()!;
      region.push(i);
      const x = i % cw, y = (i - x) / cw;
      const nb = [x > 0 ? i - 1 : -1, x < cw - 1 ? i + 1 : -1, y > 0 ? i - cw : -1, y < ch - 1 ? i + cw : -1];
      for (const n of nb) if (n >= 0 && allWhite[n] && !mask[n]) { mask[n] = 1; stack.push(n); }
    }
    // Região enorme provavelmente é água funda de verdade: mantém.
    if (region.length > cw * ch * 0.5) for (const i of region) mask[i] = 0;
  }
  return { cell, cw, ch, mask };
}
