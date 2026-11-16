"""Empacota o mapa offline do app (assets/mapa) num único arquivo mapa.json para o protótipo.
Formato: {"v": 1, "index": {caminho: [início, tamanho, gzip]}, "data": base64 dos arquivos concatenados}."""
import os, gzip, json, base64, pathlib
here = pathlib.Path(__file__).parent
src = here.parent / "app/src/main/assets/mapa"
index, blobs, off = {}, [], 0
for p in sorted(src.rglob("*")):
    if not p.is_file() or p.name == "estilo-noite.json": continue
    rel = p.relative_to(src).as_posix(); b = p.read_bytes(); gz = rel.endswith(".pbf")
    if gz: b = gzip.compress(b, 9)
    index[rel] = [off, len(b), 1 if gz else 0]; blobs.append(b); off += len(b)
(here / "mapa.json").write_text(json.dumps({"v": 1, "index": index, "data": base64.b64encode(b"".join(blobs)).decode()}, separators=(",", ":")))
style = json.loads((src / "estilo-noite.json").read_text(encoding="utf8"))
style["sources"]["openmaptiles"]["tiles"] = ["pack://tiles/{z}/{x}/{y}.pbf"]
for l in style["layers"]: l.get("paint", {}).pop("fill-pattern", None)  # padrão de textura ausente no sprite
style["glyphs"] = "pack://fonts/{fontstack}/{range}.pbf"; style["sprite"] = "pack://sprites/ofm"
(here / "mapa-estilo.json").write_text(json.dumps(style, ensure_ascii=False), encoding="utf8")
print("mapa.json", (here / "mapa.json").stat().st_size // 1024, "KB,", len(index), "arquivos")
