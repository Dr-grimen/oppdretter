#!/bin/bash
# Dagleg snapshot av dei opne kjeldene som blir OVERSKRIVNE.
# Fiskeridirektoratet regenererer CSV-dumpen kvart døgn; gårsdagens fil er borte.
# Historikk kan ikkje hentast inn i ettertid — difor er dette det einaste
# steget som må starte med ein gong, uavhengig av resten av bygginga.
#
# Rådata blir lagra uendra (NLOD-krav) og gzippa.
set -euo pipefail

ROT="$(cd "$(dirname "$0")/.." && pwd)"
DAG=$(date +%F)
UT="$ROT/data/snapshots/$DAG"
mkdir -p "$UT"

hent() {
  local namn=$1 url=$2
  local fil="$UT/$namn"
  echo "  $namn ..."
  if ! curl -fsSL --retry 3 --retry-delay 5 --max-time 300 -o "$fil" "$url"; then
    echo "    FEIL: kunne ikkje hente $namn" >&2
    return 1
  fi
  # 200 med feil i kroppen er ei kjend felle hos Fiskeridirektoratet.
  if head -c 200 "$fil" | grep -q '"error"'; then
    echo "    FEIL: HTTP 200 men feil i kroppen: $(head -c 200 "$fil")" >&2
    rm -f "$fil"; return 1
  fi
  gzip -f "$fil"
  echo "    $(du -h "$fil.gz" | cut -f1)"
}

echo "Snapshot $DAG -> $UT"
[ -n "${GITHUB_ACTIONS:-}" ] && echo "(køyrer i GitHub Actions)"


hent akvakulturregister.csv \
  "https://api.fiskeridir.no/pub-aqua/api/v1/dump/new-legacy-csv-file"

# UAVKLART: URL-en til den opne søknads-CSV-en er ikkje funnen att.
# Fire kandidatar gav 404 den 10.9.2026, og pub-aqua publiserer inga OpenAPI-fil
# vi klarte å hente. Sjå docs/API-FUNN-DEL2.md § 7 punkt 7 — laget
# «Akvakultursøknader» hos Yggdrasil krev dessutan token (HTTP 200 med
# {"code":499} i kroppen). Fyll inn her når URL-en er stadfesta.
# hent akvakultursoknader.csv "<URL manglar>"

hent biomasse.json \
  "https://gis.fiskeridir.no/server/rest/services/Yggdrasil/Biomasse/FeatureServer/0/query?where=1%3D1&outFields=*&returnGeometry=false&f=json"

hent produksjonsomrader.geojson \
  "https://gis.fiskeridir.no/server/rest/services/Yggdrasil/Produksjonsomr%C3%A5der/FeatureServer/0/query?where=1%3D1&outFields=*&f=geojson"

for LAG in ilaprotectionzone ilasurveillancezone pdprotectionzone pdsurveillancezone localitywithila localitywithpd; do
  hent "wfs-$LAG.geojson" \
    "https://geo.barentswatch.no/geoserver/ows?service=WFS&version=2.0.0&request=GetFeature&typeNames=bw:$LAG&outputFormat=application/json"
done

echo
echo "Ferdig. $(ls "$UT" | wc -l | tr -d ' ') filer:"
ls -la "$UT"
