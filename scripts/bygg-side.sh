#!/bin/bash
# Set datasettet inn i malen og lag den ferdige sida.
set -euo pipefail
ROT="$(cd "$(dirname "$0")/.." && pwd)"
python3 - "$ROT" <<'PY'
import sys, json
rot = sys.argv[1]
mal  = open(f"{rot}/app/mal.html", encoding="utf-8").read()
data = open(f"{rot}/data/app/data.json", encoding="utf-8").read()
d = json.loads(data)
data = data.replace("</", "<\\/")          # </script> inne i JSON ville lukke taggen
ut = mal.replace("__DATA__", data)
assert "__DATA__" not in ut
open(f"{rot}/app/index.html", "w", encoding="utf-8").write(ut)
print(f"app/index.html: {round(len(ut.encode())/1024)} kB · "
      f"{len(d['hendingar'])} hendingar · {len(d['lokalitetar'])} lokalitetar")
PY
