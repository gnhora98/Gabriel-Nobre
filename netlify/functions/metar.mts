// Proxy do METAR do Aeroporto de Salvador (SBSV). A API do aviationweather.gov não libera CORS
// pra navegador, então o app busca por aqui.
import type { Config } from "@netlify/functions";

export default async () => {
  const r = await fetch("https://aviationweather.gov/api/data/metar?ids=SBSV&format=json&hours=3", {
    headers: { "User-Agent": "carta-bts (uso pessoal)" },
  });
  if (!r.ok) return new Response(JSON.stringify({ error: r.status }), { status: 502, headers: { "content-type": "application/json" } });
  return new Response(await r.text(), {
    headers: { "content-type": "application/json", "cache-control": "public, max-age=300" },
  });
};

export const config: Config = { path: "/api/metar" };
