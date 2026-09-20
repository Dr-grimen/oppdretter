#!/bin/bash
# Build the deployable app and a matching, versioned offline bundle.
set -euo pipefail
ROT="$(cd "$(dirname "$0")/.." && pwd)"
# Domain checks also run in the existing daily workflow before publication.
OPPDRETTER_NODE="$(command -v node || true)"
if [ -z "$OPPDRETTER_NODE" ]; then OPPDRETTER_NODE="$HOME/.local/bin/node"; fi
(cd "$ROT" && "$OPPDRETTER_NODE" --experimental-strip-types --test tests/*.test.ts)
if command -v python3.12 >/dev/null 2>&1; then
  OPPDRETTER_PYTHON="$(command -v python3.12)"
elif [ -x "$HOME/.local/bin/python3.12" ]; then
  OPPDRETTER_PYTHON="$HOME/.local/bin/python3.12"
else
  OPPDRETTER_PYTHON="$(command -v python3)"
fi
"$OPPDRETTER_PYTHON" - "$ROT" <<'PY'
from pathlib import Path
import hashlib
import json
import re
import shutil
import sys

root = Path(sys.argv[1])
app = root / "app"
template = (app / "mal.html").read_text(encoding="utf-8")
if template.count("__DATA__") != 1:
    raise SystemExit("Malen må innehalde nøyaktig éin __DATA__.")
data = json.loads((root / "data/app/data.json").read_text(encoding="utf-8"))
if not isinstance(data, dict) or not isinstance(data.get("lokalitetar"), list):
    raise SystemExit("Datasettet manglar ei gyldig lokalitetsliste.")
if not data.get("bygd"):
    raise SystemExit("Datasettet manglar tidspunktet for oppdateringa.")

# The supplier directory is editorial content, separate from fetched agency data.
suppliers = json.loads((app / "leverandorar.json").read_text(encoding="utf-8"))
if not isinstance(suppliers, list):
    raise SystemExit("Leverandørlista må vere ei liste.")
from urllib.parse import urlsplit
supplier_ids = set()
for supplier in suppliers:
    for key in ("id", "namn", "kategoriar", "omtale", "dekning", "dekningTekst", "url", "kjeldeUrl", "kontrollert"):
        if not supplier.get(key):
            raise SystemExit(f"Leverandør manglar {key}.")
    if supplier["id"] in supplier_ids:
        raise SystemExit("Duplikat i leverandørlista.")
    supplier_ids.add(supplier["id"])
    for key in ("url", "kjeldeUrl"):
        parsed = urlsplit(supplier[key])
        if parsed.scheme != "https" or not parsed.netloc or parsed.username or parsed.password:
            raise SystemExit("Leverandørlenkjer må vere offentlege HTTPS-adresser.")
data["leverandorar"] = suppliers

# Escaping '<' prevents all HTML/script termination, including mixed-case tags.
# JSON.parse restores the original strings without interpreting them as HTML.
encoded = json.dumps(data, ensure_ascii=False, separators=(",", ":"), allow_nan=False)
for old, new in (("&", "\\u0026"), ("<", "\\u003c"), (">", "\\u003e"),
                 ("\u2028", "\\u2028"), ("\u2029", "\\u2029")):
    encoded = encoded.replace(old, new)

asset_names = ["app.css", "fjord.js", "app.js", "register-sw.js", "lib/leaflet.css", "lib/leaflet.js"]
asset_names += ["lib/images/" + name for name in (
    "layers.png", "layers-2x.png", "marker-icon.png", "marker-icon-2x.png", "marker-shadow.png")]
metadata_names = ["manifest.webmanifest", "icons/mark.svg", "icons/icon-192.png",
                  "icons/icon-512.png", "icons/apple-touch-icon.png"]
worker_template = (root / "scripts/service-worker.js").read_text(encoding="utf-8")
digest = hashlib.sha256()
for value in (template, encoded, worker_template, (root / "scripts/bygg-side.sh").read_text()):
    digest.update(value.encode("utf-8"))
for name in asset_names + metadata_names:
    path = app / name
    if not path.is_file() or not path.stat().st_size:
        raise SystemExit(f"Appfila manglar eller er tom: {name}")
    digest.update(name.encode("utf-8"))
    digest.update(path.read_bytes())
version = digest.hexdigest()[:20]
version_root = app / "assets" / version
version_root.mkdir(parents=True, exist_ok=True)
for name in asset_names:
    target = version_root / name
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(app / name, target)

body = template.replace("__BUILD_VERSION__", version).replace("__DATA__", encoded)
body = re.sub(r"<title>.*?</title>\s*", "", body, flags=re.IGNORECASE | re.DOTALL)
head = f'''<!doctype html>
<html lang="nn">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Oppdretter · Oversikt langs kysten</title>
<meta name="description" content="Samla oversikt over norsk oppdrett: lokalitetar, lakselus, fiskehelse, sjukdomssoner og sjøtrafikk. Opne kjelder, tydeleg datostempling.">
<meta name="theme-color" content="#102f43">
<meta name="color-scheme" content="light">
<meta name="app-build" content="{version}">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="Oppdretter">
<meta name="referrer" content="strict-origin-when-cross-origin">
<link rel="icon" href="./icons/mark.svg" type="image/svg+xml">
<link rel="icon" href="./icons/icon-192.png" type="image/png" sizes="192x192">
<link rel="apple-touch-icon" href="./icons/apple-touch-icon.png">
<link rel="manifest" href="./manifest.webmanifest">
<link rel="stylesheet" href="./assets/{version}/lib/leaflet.css">
<link rel="stylesheet" href="./assets/{version}/app.css">
<script defer src="./assets/{version}/lib/leaflet.js"></script>
<script defer src="./assets/{version}/fjord.js"></script>
<script defer src="./assets/{version}/app.js"></script>
<script defer src="./assets/{version}/register-sw.js"></script>
</head>
<body>
'''
html = head + body + "\n</body>\n</html>\n"

def write_atomic(path, content):
    temporary = path.with_name(path.name + ".tmp")
    temporary.write_text(content, encoding="utf-8")
    temporary.replace(path)

write_atomic(app / "index.html", html)
artifact = (f'<link rel="stylesheet" href="./assets/{version}/lib/leaflet.css">\n'
            f'<link rel="stylesheet" href="./assets/{version}/app.css">\n' + body +
            f'\n<script src="./assets/{version}/lib/leaflet.js"></script>'
            f'\n<script src="./assets/{version}/fjord.js"></script>'
            f'\n<script src="./assets/{version}/app.js"></script>\n')
write_atomic(app / "artifact.html", artifact)
precache = [f"assets/{version}/{name}" for name in asset_names] + metadata_names
worker = worker_template.replace("__BUILD_VERSION__", version).replace(
    "__PRECACHE_FILES__", json.dumps(precache, separators=(",", ":")))
write_atomic(app / "sw.js", worker)

# Content-addressed bundles make each page independent of a newer deployment.
# Old active workers keep their own complete bundle in browser storage.
for older in (app / "assets").iterdir():
    if older.is_dir() and older.name != version:
        shutil.rmtree(older)
print(f"app/index.html: {len(html.encode()) // 1024} kB · {len(data['lokalitetar'])} lokalitetar")
print(f"Bygg {version} · {len(precache)} lokale appressursar · datastempel {data['bygd']}")
PY
