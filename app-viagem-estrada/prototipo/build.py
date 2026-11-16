"""Gera viagem-estrada.html (página única) a partir de template.html + src/*.js + dados.
Uso: python3 build.py [--local LIBDIR]  (--local troca as bibliotecas do CDN por arquivos locais, para testes)"""
import json, sys, pathlib
here = pathlib.Path(__file__).parent
s = (here / "template.html").read_text(encoding="utf8")
trip = json.loads((here.parent / "dados/viagem-exemplo.json").read_text(encoding="utf8"))
routes = (here / "dados-rota.json").read_text(encoding="utf8")
js = lambda n: (here / "src" / n).read_text(encoding="utf8")
s = s.replace("__TRIP_JSON__", json.dumps(trip, ensure_ascii=False).replace("</", "<\\/"))
s = s.replace("__ROUTES_JSON__", routes.replace("</", "<\\/"))
s = s.replace("/*__MOTO3D__*/", js("moto3d.js")).replace("/*__NAV__*/", js("nav.js")).replace("/*__APP__*/", js("app.js"))
out = "viagem-estrada.html"
if "--local" in sys.argv:
    lib = sys.argv[sys.argv.index("--local") + 1]
    s = s.replace("https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/4.7.1/maplibre-gl.js", f"file://{lib}/maplibre-gl.js")
    s = s.replace("https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.min.js", f"file://{lib}/three.min.js")
    out = "viagem-estrada.local.html"
(here / out).write_text(s, encoding="utf8")
print(out, len(s) // 1024, "KB")
