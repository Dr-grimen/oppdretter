#!/bin/bash
# Set datasettet inn i malen og lag dei ferdige sidene.
#
# To utgåver frå same mal:
#   app/index.html     komplett HTML-dokument — for GitHub Pages og alle andre vertar
#   app/artifact.html  berre innhaldet — Artifact-verktøyet legg på <head> sjølv,
#                      og avviser eigne <!doctype>/<html>/<head>-taggar
#
# Utan <!doctype> og <meta name="viewport"> reknar telefonar sida som 980 px brei
# og skalerer ned. Då slår ingen av mobilreglane inn. Det var slik den levande
# sida oppførte seg fram til 10.9.2026.
set -euo pipefail
ROT="$(cd "$(dirname "$0")/.." && pwd)"
python3 - "$ROT" <<'PY'
import sys, json
rot = sys.argv[1]
mal  = open(f"{rot}/app/mal.html", encoding="utf-8").read()
data = open(f"{rot}/data/app/data.json", encoding="utf-8").read()
d = json.loads(data)
innhald = mal.replace("__DATA__", data.replace("</", "<\\/"))
assert "__DATA__" not in innhald

# Artifact-utgåva: bar, utan dokumentramme
open(f"{rot}/app/artifact.html", "w", encoding="utf-8").write(innhald)

# Nettside-utgåva: komplett dokument
full = (
    '<!doctype html>\n<html lang="nn">\n<head>\n'
    '<meta charset="utf-8">\n'
    '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
    '<meta name="description" content="Varsel for norsk havbruk: lakselus, sjukdom, '
    'sjukdomssoner og brønnbåtar frå opne norske kjelder.">\n'
    '<meta name="color-scheme" content="light dark">\n'
    '<meta name="theme-color" content="#12447E">\n'
    '<link rel="icon" href="data:image/svg+xml,'
    '%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 32 32%22%3E'
    '%3Ctext y=%2226%22 font-size=%2226%22%3E%F0%9F%90%9F%3C/text%3E%3C/svg%3E">\n'
    '<style>html{-webkit-text-size-adjust:100%}body{margin:0}img{max-width:100%}'
    '[hidden]{display:none!important}</style>\n'
    '</head>\n<body>\n' + innhald + '\n</body>\n</html>\n'
)
open(f"{rot}/app/index.html", "w", encoding="utf-8").write(full)

print(f"app/index.html    {round(len(full.encode())/1024)} kB  (komplett dokument)")
print(f"app/artifact.html {round(len(innhald.encode())/1024)} kB  (bar, for Artifact)")
print(f"                  {len(d['hendingar'])} varsel · {len(d['lokalitetar'])} anlegg")
PY
