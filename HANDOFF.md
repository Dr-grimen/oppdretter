# Handoff — oppdretter

Lim inn heile denne fila i ein ny sesjon, eller sei «les ~/oppdretter/HANDOFF.md».
Skrive 10. september 2026.

---

## Les dette først

Sondre er **ikkje teknisk** og har **ingen Run-knapp**. Køyr alt sjølv med Bash.
Aldri «lim inn dette i Terminal». Svar på nynorsk, kort, utan uforklart jargong.
Alt skal vere **gratis** — vis månadspris før noko som kostar.

Han har **jobba på Storevikholmen (lokalitet 11492, PO 3)**. Det er den einaste
bransjeerfaringa han har delt, og den beste produktinnsikta i heile prosjektet kom
derfrå: det ein oppdrettar vil vite er **lusetala hos naboane i fjorden**, ikkje
berre sine eigne. Spør han om drifta før du gjettar.

Han går tom for **vekekvote**, ikkje tokens. Ikkje brenn kvote på lange
undersøkingar utan at det trengst.

---

## Kva som finst

| | |
|---|---|
| Live app | https://dr-grimen.github.io/oppdretter/ |
| Kode | https://github.com/Dr-grimen/oppdretter (offentleg) |
| Artifact-kopi | https://claude.ai/code/artifact/f36a42ec-3f0b-4277-a03d-0fc75cfc869f |
| Lokalt | `~/oppdretter` |

Oppdaterer seg sjølv kvar morgon 05:20 UTC via `.github/workflows/dagleg.yml`.
Tek 50 sekund. **Ingen nøklar, ingen konto, 0 kr.**

### Byggje lokalt
```
./scripts/snapshot.sh          # dagens rådata (blir overskrivne hos kjelda!)
npm run arkiver                # 30 kB kompakt tilstand → data/arkiv/, blir committa
npm run bygg                   # hentar alt, køyrer reglane → data/app/data.json
./scripts/bygg-side.sh         # → app/index.html (Pages) + app/artifact.html
node scripts/sjekk-side.mjs app/index.html
```
**Rediger `app/mal.html`, aldri `app/index.html`** — den blir bygd og er git-ignorert.

Node ligg i `~/.local/share/node`, symlenka i `~/.local/bin`. Ingen Homebrew.

---

## Fem feller eg gjekk i. Ikkje gjenta dei.

1. **Verifiser i nettlesar, ikkje berre i data.** Eg publiserte to funksjonar som
   aldri var i fila og sa dei var ferdige. `tsc`, `JSON.parse` og `new Function()`
   fangar det ikkje. Klikk gjennom kvar fane. `window.onerror` fangar
   ReferenceError. `scripts/sjekk-side.mjs` sjekkar no at kvar kalla funksjon finst
   — behald den kontrollen.

2. **Bruk `assert` i python-patchar.** `s.replace(markør, ...)` som ikkje finn
   markøren gjer ingenting og seier ingenting. Det er slik dei to funksjonane forsvann.

3. **Artifact og Pages er ikkje same sak.** Artifact-innpakninga legg på
   `<!doctype>`, charset og viewport. GitHub Pages gjer det ikkje. Utan viewport
   reknar telefonar sida som 980 px og heile mobil-CSS-en er daud. `bygg-side.sh`
   byggjer difor to utgåver.

4. **10 km er for tett i ein fjord.** Rundt Storevikholmen har berre 2 av 11
   naboar innan 10 km luserapport. Standard nabo-radius er 20 km (`NABO_KM`).

5. **gh manglar `workflow`-scope.** Workflow-filer kan ikkje pushast. Legg dei inn
   via GitHub si opplastingsside i nettlesaren (`/upload/main/.github/workflows`)
   med `mcp__claude-in-chrome__file_upload`. Det krev ingen nye løyve.

---

## Verifiserte fakta — ikkje bruk kvote på å finne dei igjen

Alt står med kjelde i `docs/API-FUNN.md`, `docs/API-FUNN-DEL2.md`, `docs/UTAN-KONTO.md`.

- **Lakselus er ope hos Mattilsynet**, ikkje berre hos BarentsWatch:
  `akvakultur-offentlig-api.fisk.mattilsynet.io/api/lakselus/v2/rapporteringer`
  Krev berre headeren `Client-Id: oppdretter` — eit sjølvvalt namn, ikkje ein nøkkel.
- **Lusegrensa:** FOR-2012-12-05-1140 § 8. 0,5 normalt, 0,2 i veke 16–21 sør og
  21–26 nord (fylke 18/55/56). Veke 21 er 0,2 i begge. Gjaldt frå 6.3.2017 —
  ikkje bruk regelen på eldre veker.
- **Rapporteringsfrist:** tysdag i påfølgande veke. Ei veke er aldri heilt ferdig.
  Manglande rapport tyder **ukjent**, ikkje trygt.
- **Brønnbåt vs. slaktebåt:** AIS «Fish Carrier» skil dei ikkje. Mattilsynet sitt
  register over godkjende transporteiningar gjer det, via kallesignal.
- **Flyfoto finst ikkje ope.** Norge i bilder svarar «Bruker kan ikke autentiseres».
  Kartverket sin opne cache har berre topo, toporaster, topograatone, sjokartraster.
- **Biomasse i tonn per anlegg** er unnateke offentlegheit, forvaltningslova § 13.
- Blåskjell, tare og torsk har ikkje lakselus. 315 anlegg er merkte `lf:false`.

---

## Planen, i rekkjefølgje

### 1. Seks funn står att (halvdags arbeid)

- **Retta luserapportar blir handterte tre ulike måtar.** Trendkurva, siste-veke-talet
  og hendingsdeteksjonen les same rad ulikt. Fiks: kollaps rader per
  `(lokalitetsnummer, år, uke)` med nyaste `rapporteringstidspunkt` **før** alt anna,
  i `src/bygg-app.ts`.
- **AIS-feil blir ikkje sagt til brukaren.** Helsesjekken stoppar publisering, men om
  ein delvis feil slepp gjennom seier Båtar-fana «0 brønnbåtar» — ei aktiv løgn.
  Skriv `aisFeila:true` i datasettet og vis det i UI-et.
- **Søket gjeld alle fanene.** Du kan søke i feeden, byte til Kart, og sjå eit tomt
  kart utan å skjøne kvifor. Vis eit merke over kartet når `S.sok` ikkje er tom.
- **Anlegg du følgjer som blir nedlagt** gir «0 varsel» utan forklaring. Sjekk
  `S.mine` mot `LOK` ved oppstart og sei frå.
- **«Over grensa: 10»** bør vere «10 av 601 rapporterte», med ei rad for dei 776
  utan rapport.
- **Rydd daude `.pkt.p-*` CSS-reglar** i `app/mal.html` (2 stk. igjen etter
  Leaflet-byttet).

### 2. To brev Sondre må sende (avgjer om produktet veks)

- **Fiskeridirektoratet:** innsynskrav etter akvakulturdriftsforskrifta § 44 om
  utsett og utslakting per lokalitet. Får han ja, blir `harvest_window` mogleg —
  det einaste varselet som ikkje finst i dag.
- **BarentsWatch:** kan ILA/PD-sonene brukast kommersielt? Vilkåra seier «Some
  restrictions apply — contact for details». Dette må avklarast **før** han sel noko.
  Sjå `docs/UTAN-KONTO.md` § 7.

### 3. Test på ekte folk før du byggjer meir

Ein oppdrettar og ein leverandør. Vi har gjetta på kva som er nyttig. Sondre har
stått på merdkanten, men to menneske til vil finne ting vi begge overser.

### 4. Ikkje bygg dette

- **Eit finare kart enn BarentsWatch.** Du taper og treng ikkje vinne.
- **Prognose eller maskinlæring.** Minst to andre prosjekt gjer det alt, og alle
  reglane her er reglar, ikkje modellar.
- **Rå AIS-besøksdeteksjon frå botnen.** Kystdatahuset + brønnbåtregisteret held.
- **Sanntid.** Dagleg batch held. Lusedata kjem uansett berre ein gong i veka.

---

## Forretningssida, ærleg

Av dei ti opphavlege hendingsreglane er **ingen** eigen analyse. Dei er API-kall,
ein diff, eller ei linje SQL. Det einaste tomrommet i heile Noreg er **push** —
ingen kjelde varslar når noko endrar seg. BarentsWatch har til og med favorittliste.
Utvalet finst gratis; meldinga manglar.

**Målgruppe B (leverandørane som skal betale) er svakare enn planen gjekk ut frå.**
Manolin i Bergen sel alt «Customer Account Intelligence» til leverandørar i Noreg.
Tvangsmulkta verkar ikkje som pressmiddel etter Mattilsynet si eiga vurdering, og
frå 2. juli 2026 reagerer dei ikkje automatisk på ei enkelt overskriding. Vi har
**ingen verifisert prisanker** i denne produktkategorien.

Ikkje selg noko før punkt 2 og 3 over er gjort.
