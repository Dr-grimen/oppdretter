# oppdretter

Varselsystem for norsk havbruk, bygd på opne data.

**Status: fase 0.** Datagrunnlaget er kartlagt og faktasjekka. Den opne halvdelen
køyrer og gir ekte data. Den autentiserte halvdelen ventar på ein API-klient.

---

## Ingen konto, ingen nøklar

Prosjektet har **ingen hemmelegheiter i det heile**. Ingen konto, ingen API-nøkkel,
ingen token som går ut på dato, ingenting å legge inn i GitHub Actions.

Lakselusdata kjem frå **Mattilsynet**, som er kjelda BarentsWatch sjølv les frå:

    https://akvakultur-offentlig-api.fisk.mattilsynet.io/api/lakselus/v2/rapporteringer

Det einaste kravet er headeren `Client-Id: oppdretter` — eit sjølvvalt namn, ikkje ein
nøkkel. Utan den kjem HTTP 400 «must not be blank», som er validering og ikkje
innlogging. Difor står namnet rett i koden.

BarentsWatch-token ville berre låst opp to ting: `isWellboat` (skilje brønnbåt frå
slaktebåt) og slakteridata. Sjå `docs/UTAN-KONTO.md` § 7.

## Køyre

```bash
npm run fase0:opent          # soner, produksjonsområde, spesifikasjonen
npm run sjekk:register       # normaliser Akvakulturregisteret og kontroller tala
npm run sjekk:po             # fyll ut produksjonsområde frå koordinatar
npm run over-grensa -- 2026 36   # lus + grense + behandlingsklynger for ei veke
npm run typecheck
./scripts/snapshot.sh        # dagleg snapshot av kjeldene som blir overskrivne
```

Node ligg lokalt i `~/.local/share/node` (ingen Homebrew, ingen passord kravd).

---

## Attribusjon — dette er eit lisenskrav, ikkje ei høflegheit

Begge tekstane må vere **godt synlege** for sluttbrukar på kvar skjerm som viser
desse dataa:

> Inneheld data under Norsk lisens for offentlege data (NLOD), tilgjengeleggjort av
> Mattilsynet, Fiskeridirektoratet og Kystverket. Data er bearbeidde av oss.

Vidare gjeld:

- Lisens **NLOD 2.0**. Kommersiell bruk er uttrykkeleg lov — lisensen dekker òg
  «selge, låne ut og leie ut».
- Du kan **ikkje** skrive noko som antyder at etatane støttar eller samarbeider med
  produktet. «Byggjer på opne data frå Kystverket» er greitt. «I samarbeid med» er det ikkje.
- **«BarentsWatch» kan ikkje vere del av tenestenamnet.** Derfor «oppdretter».
- **Datainnhaldet kan ikkje endrast.** Difor er rådata og utleidde data skilde.
- Udokumenterte endepunkt skal ikkje brukast.
- Produksjonsområde kjem frå Fiskeridirektoratet, òg NLOD.

---

## Dokumentasjon

| Fil | Innhald |
|---|---|
| `docs/API-FUNN.md` | Fase 0 del 1: autentisering, fiskehelse-API, soner, lisens. Alt faktasjekka mot kjelde. |
| `docs/API-FUNN-DEL2.md` | Fase 0 del 2: regelverk, marknad, AIS, kva som faktisk er igjen å bygge. |
| `docs/UTAN-KONTO.md` | **Les denne først.** Kva som er ope utan konto, og kva vi mistar. |
| `docs/fishhealth-openapi.json` | Heile OpenAPI-spesifikasjonen (128 stiar, 191 skjema), lagra lokalt. |

**Les avviks-seksjonane før du kodar noko nytt** — `API-FUNN.md` § 8 og
`API-FUNN-DEL2.md` § 5. Dei viktigaste:

- `has_fish` finst ikkje hos BarentsWatch. `isFallow` er avleidd av fire veker
  utan rapport. Det ekte feltet heiter `har_fisk` og ligg hos Fiskeridirektoratet
  (Yggdrasil/Biomasse), men dekkjer berre ~60 % av lokalitetane.
- `MTB` finst ikkje i BarentsWatch-API-et. Det ligg som `LOK_KAP` + `LOK_ENHET` i
  Akvakulturregisteret — men er **gjenteke på kvar løyve-rad**. Naiv summering gir
  20,8× overteljing. Dedup på `LOK_NR`.
- Lusegrensa finst ikkje per lokalitet i JSON, men vi kan rekne henne ut sjølve:
  0,5 til vanleg, 0,2 i veke 16–21 sør og veke 21–26 nord (fylke 18/55/56).
- ILA/PD-soner krev **ikkje** nøkkel — dei ligg ope på ein WFS i EPSG:4326.
- Rapportfristen er **tysdag i påfølgande veke**. Varselet må gå tysdag kveld
  eller onsdag, aldri måndag.

### Den ubehagelege konklusjonen

Av dei ti planlagde hendingsreglane er **null** eigen analyse. Tre er rein
viderformidling, tre er ein diff eller ein GROUP BY, éin har inga open kjelde, og
brønnbåt-besøka reknar BarentsWatch allereie ut ferdig med `isWellboat`-flagg.

Det som faktisk manglar i heile Noreg er **push**: ingen av kjeldene sender
beskjed når noko endrar seg. BarentsWatch har til og med favorittliste. Utvalet
finst gratis — meldinga manglar.

Difor er `snapshot → diff → push` heile produktet, og resten er kontekst.

## Snapshot — startar i dag, ikkje seinare

```bash
./scripts/snapshot.sh
```

Fiskeridirektoratet regenererer CSV-dumpen kvart døgn og **gårsdagens fil er
borte**. Historikk kan ikkje hentast inn i ettertid. Første snapshot er teke
**10. september 2026** (~1,9 MB gzippa per dag). Datoen vi starta er den einaste
datoen som betyr noko for produktet.

Lagringa er førebels berre lokal i `data/` (git-ignorert). Varig, gratis lagring
må avgjerast i fase 1 — Macen søv, så jobben skal etter kvart i GitHub Actions.

---

## Struktur

```
src/lib/http.ts                  rate limit + retry med backoff
src/lib/geo.ts                   punkt-i-polygon og haversine, alt EPSG:4326
src/ingest/mattilsynet.ts        lakselus, open kjelde
src/ingest/akvakulturregister.ts lokalitetar, eigarar, MTB
src/ingest/produksjonsomrade.ts  PO frå koordinatar der registeret manglar det
src/events/lusegrense.ts         FOR-2012-12-05-1140 § 8
src/events/over-grensa.ts        ende-til-ende-prøve
src/fase0-opent.ts               open verifisering
scripts/snapshot.sh              dagleg snapshot
docs/                            funn og spesifikasjon
```
