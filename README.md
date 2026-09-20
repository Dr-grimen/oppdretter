# Oppdretter

Ein gratis, kartbasert oversikt over norsk havbruk. Publisert på https://dr-grimen.github.io/oppdretter/.

## Funksjonar

- Samla kart med lokalitetar og AIS-posisjonar; val av kart/sjøkart/produksjonsområde.
- Anleggsregister med søk, område-/helsefilter, favorittar og CSV-eksport.
- Lakselus med rapportveke, tre lusestadium, temperatur, behandlingar og trendkurve.
- Naboanlegg innan 10, 20, 30 eller 50 km. Avstanden er luftlinje og snittet er ikkje ein smittemodell.
- Månadlege rensefiskrapportar når Mattilsynet har publisert dei.
- Sjukdomssoner, sjukdomshendingar og offentlege søknader.
- Fartøykort med posisjonstid, fart, kurs, registertreff og avstand til anlegg. Nærleik er ikkje eit stadfesta besøk.
- Synleg datastatus per kjelde, feiltilstandar og varsling om gamle data.
- Installerbar nettapp med ein versjonert reservekopi for bruk utan nett etter første vellukka innlasting. Kartfliser og eksterne API blir ikkje lagra for offlinebruk.

## Datakjelder og kostnad

Mattilsynet, Fiskeridirektoratet, Kystverket og BarentsWatch. Ingen hemmelegheiter, API-abonnement eller nye betalte tenester. MarineTraffic er berre ei ekstern lenkje frå fartøykortet; sjøtrafikken i appen kjem frå Kystverket. Sjå [kontrollerte kjelder](docs/KJELDER-2026-09-20.md) for dokumentasjon, tilgang og lisens.

Opplysningane er ikkje nødvendigvis komplette. Faktisk biomasse, alle tilsynsdokument og upubliserte vedtak er ikkje del av løysinga. Lusegrensa er ei generell referanse, ikkje eit individuelt vedtak. Oppdretter er ikkje eit navigasjonssystem.

## Utvikling

Node 22+ (produksjon: Node 24), TypeScript og Python 3.12 til pakking. Det eksisterande låseformatet og den enkle statiske arkitekturen er bevarte.

- `app/mal.html`: strukturen i sida.
- `app/app.css`: responsiv utforming.
- `app/app.js`: kart, søk, filter, detaljar og lokal lagring.
- `src/`: innhenting, normalisering, kjeldestatus og hendingsreglar.
- `scripts/bygg-side.sh`: byggjer komplett HTML og samsvarande versjonerte ressursar.
- `scripts/sjekk-side.mjs`: kontrollerer publiseringsgrunnlaget.
- `tests/`: domene- og datatryggleikstestar.

Køyr `npm ci`, `npm run typecheck` og `npm test` ved utvikling. Hent kjelder med `./scripts/snapshot.sh`, arkiver med `npm run arkiver`, bygg data med `npm run bygg`, og bygg sida med `./scripts/bygg-side.sh`. Sjekk med `node scripts/sjekk-side.mjs app/index.html` før publisering. Genererte filer i `app/assets`, `app/index.html`, `app/sw.js` og `data/app` skal ikkje redigerast.

Den daglege jobben i `.github/workflows/dagleg.yml` køyrer i GitHub Actions og publiserer til GitHub Pages. Jobben krev ikkje at den lokale maskina er på. GitHub kan forseinke planlagde starttidspunkt. Ved kritisk feil blir publisering stoppa; appen viser då alderen til førre publisering.
