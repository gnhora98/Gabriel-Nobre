"""Gera viagem-estrada.html (página única) a partir de template.html + src/*.js + dados.
O mapa offline vai à parte em mapa.bin (gerado por pack_mapa.py).
Uso: python3 build.py [--local LIBDIR]  (--local troca as bibliotecas do CDN por arquivos locais, para testes)"""
import json, sys, pathlib
here = pathlib.Path(__file__).parent
dados = here.parent / "dados"
s = (here / "template.html").read_text(encoding="utf8")
ids = ["teste-stella-maris", "viagem-exemplo"]
trips = []
for i in ids:
    t = json.loads((dados / f"{i}.json").read_text(encoding="utf8")); t.setdefault("id", i); trips.append(t)
routes = {i: json.loads((dados / "rotas" / f"{i}.json").read_text(encoding="utf8")) for i in ids}
js = lambda n: (here / "src" / n).read_text(encoding="utf8")
emb = lambda o: json.dumps(o, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
s = s.replace("__TRIPS_JSON__", emb(trips)).replace("__ROUTES_JSON__", emb(routes))
s = s.replace("__STYLE_JSON__", (here / "mapa-estilo.json").read_text(encoding="utf8").replace("</", "<\\/"))
s = s.replace("/*__MOTO3D__*/", js("moto3d.js")).replace("/*__NAV__*/", js("nav.js")).replace("/*__APP__*/", js("app.js"))
out = "viagem-estrada.html"
if "--local" in sys.argv:
    lib = sys.argv[sys.argv.index("--local") + 1]
    s = s.replace("https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/4.7.1/maplibre-gl.js", f"{lib}/maplibre-gl.js")
    s = s.replace("https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js", f"{lib}/three.min.js")
    out = "viagem-estrada.local.html"
(here / out).write_text(s, encoding="utf8")
print(out, len(s) // 1024, "KB")
