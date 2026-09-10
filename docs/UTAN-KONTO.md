# Utan konto — kva kan vi bygge?

**Prosjekt:** oppdretter · **Dato:** 10. september 2026
**Føresetnad:** ingen konto hos BarentsWatch. Alt under er testa med ekte kall utan innlogging, og har overlevd ein runde der ein annan agent prøvde å motbevise det. Påstandar som ikkje overlevde, står ikkje her.

---

## Svaret, kort

- **Lusetala finst ope. Ja.** Mattilsynet publiserer dei sjølve — per lokalitet, per veke, utan konto, utan nøkkel, utan registrering. Det er same tal som BarentsWatch viser, fordi BarentsWatch hentar dei frå Mattilsynet.
- **Det einaste du treng i koden er eit sjølvvalt namn.** Ein header som heiter `Client-Id: oppdretter`. Det er ikkje ein hemmelegheit, ikkje ein nøkkel. Den kan stå rett i koden på GitHub. Ingen secrets å halde ved like.
- **Ja, det er framleis eit produkt.** 5 av dei 10 hendingsreglane kan byggast heilt, 4 delvis, 1 er daud.
- **Kostnaden i kroner er null.** Alle kjeldene er gratis og lovlege å bruke kommersielt (NLOD-lisens). Du må kreditere Mattilsynet og Kystverket i varsla.
- **Kostnaden i data er ein ting, og han er konkret:** du kan sjå at ein brønnbåt kjem, men du kan ikkje sikkert skilje ein brønnbåt frå ein slaktebåt. BarentsWatch har eit ferdig flagg for det. Vi må gjette.
- **Det største du mister er slakteridata.** Regel 8 (slaktevindauge) er den eine som er heilt daud utan konto.
- **Ei felle du må vite om:** at ein lokalitet manglar i lusetala tyder ikkje at alt er bra. 85 lokalitetar med fisk i sjøen hadde ingen luserapport i veke 36. Manglande rad = ukjent, ikkje trygt.

---

## 1. Lusetala — finst dei ope?

# JA.

Per-lokalitet, per-veke, med behandlingar og sjøtemperatur. Kjelda er Mattilsynet, ikkje BarentsWatch.

| Kjelde | Kva vi fann | Type tal | Status |
|---|---|---|---|
| **Mattilsynet, akvakultur-offentlig-api** | `voksneHunnlus`, `bevegeligeLus`, `fastsittendeLus`, sjøtemperatur, medikamentelle + ikkje-medikamentelle + kombinasjonsbehandlingar, resistensmistankar, lokalitetsnummer, lokalitetsnamn, organisasjonsnummer | **Per lokalitet, per veke** | **OPE.** HTTP 200 anonymt. Testa med tullverdiar i Client-Id («x», «asdfqwer12345») — alle 200 |
| BarentsWatch fiskehelse-API | Same tal, men bak token | Per lokalitet, per veke | Stengd. 401 anonymt |
| BarentsWatch sitt eige offentlege lusekart | Kartet er gratis å sjå i nettlesar, men endepunkta bak (`/fishhealth/localities`) gjev 401 og krev innlogging med tofaktor | Per lokalitet | Stengd maskinelt |
| BarentsWatch WFS/WMS (geo.barentswatch.no) | Ingen luselag i det heile. 29 WFS-lag og 46 WMS-lag gjennomsøkte, null treff på lus | — | Finst ikkje |
| Fiskeridirektoratet pub-aqua | Ingen lus. `/api/v1/lice` gjev 404 | — | Finst ikkje |
| Havforskningsinstituttet | Modellert smittepress, og dei hentar rådataa frå Mattilsynet sjølve | **Modellert**, ikkje målt | Rapportar, ikkje API |
| Akvafakta (vekestatistikk) | Dekomprimerte PDF-en og søkte: null treff på «lus», «lakselus», «lokalitet». Berre pris og eksport | — | Ingen lusetal |
| Geonorge | Søk på «lakselus» gjev 2 treff, begge peikar tilbake til BarentsWatch | — | Ingen eigen kjelde |
| Felles datakatalog (data.norge.no) | Berre 2 lakselus-datasett i heile Noreg: Mattilsynet sitt og BarentsWatch sitt | — | Ingen tredje kjelde |

**Kva dette betyr:** vi treng ikkje aggregat eller modellar. Vi får dei ekte, rapporterte tala per lokalitet.

### Det du må vite før du stolar på tala

- **Ei veke er aldri ferdig.** Veke 36 fekk framleis inn nye rader 10. september. Eldste rapport i veka var 31. august. Rader kjem i minst ti dagar. Køyr eldre veker på nytt, ikkje berre den ferskaste.
- **Manglande rad ≠ ingen fare.** Fiskeridirektoratet har 630 lokalitetar med fisk; berre 545 av dei hadde luserapport i veke 36. 85 manglar. (Motsett hadde 58 lokalitetar lusetal sjølv om Fiskeridirektoratet sa «ingen fisk», så registeret deira er delvis utdatert.) Behandle manglande rad som **ukjent**.
- **`aar` er rapporteringsåret, ikkje veka sitt år.** `aar=2026&uke=52` gjev rapportar levert i januar 2026 for veke 52 i 2025. Dette vil gje feil om du reknar lusegrenser per veke.
- **Det finst søppelrader.** Ein rapport med år=1 og veke=1. Sjukdomstilfelle med varslingsdato i 1959. Filtrer dei bort.
- **Historikk:** 2024 = 32 362 rader, 2025 = 33 854, 2026 så langt = 20 774. Nok til backtest. Ikkje bruk 2022 (19 rare rader) eller 2023 (migreringsstøy).
- **Fylke får du gratis.** Lusepayloaden manglar fylke, men Fiskeridirektoratet sitt Biomasse-lag (ope, ingen konto) gjev fylke og produksjonsområde for 603 av 604 lokalitetar — 99,8 %. Det løyser 0,2-grensa i veke 16–21 / 21–26.

---

## 2. Kva er ope, verkeleg

Alt under er stadfesta med eit ekte kall utan konto.

### Lus, sjukdom og drift — Mattilsynet
Alle krev headeren `Client-Id: <sjølvvalt namn>`. Utan den kjem HTTP 400 «must not be blank» — det er validering, ikkje innlogging. Lisens NLOD 2.0.

| Endepunkt | Kva det gir | Format | Status |
|---|---|---|---|
| `/api/lakselus/v2/rapporteringer` | **Lusetal per lokalitet per veke** + behandlingar + sjøtemperatur. Filter: aar, uke, lokalitetsnummer, organisasjonsnummer, fra-/til-rapporteringstidspunkt | JSON | 200 ✔ 606 rader i veke 36; heile 2026 (20 774 rader, 11,6 MB) i eitt kall på 46 s |
| `/api/sykdomstilfeller/v1/rapporteringer` | Sjukdomstilfelle med varslingsdato → mistankedato → diagnosedato → avslutningsdato, type og subtype (PD_SAV2/PD_SAV3) | JSON | 200 ✔ 212 tilfelle |
| `/api/helsestatus/v2/lokaliteter` | Lokalitet + alle verksemder med orgnr, namn, gateadresse, postnummer, poststad | JSON | 200 ✔ 1 527 lokalitetar |
| `/api/rensefisk/v1/rapporteringer` | Rensefisk per merd per månad: art, behaldning, utsett, uttak splitta på dødsårsak | JSON | 200 ✔ 461 rapportar |
| `/api/driftsplaner/v1/aktive/soknader` | Framoverskodande brakklegging, utsett og flytting med datoar | JSON | 200 ✔ men berre 10 planar, og 7 av dei er tomme |
| `/q/openapi` | Full spesifikasjon (leverer YAML som standard) | YAML | 200 ✔ |

Kvart svar har headeren `x-count` med totaltalet for spørjinga. Bruk den til å vite kor mykje som finst.

### Lokalitetar, søknader, miljø — Fiskeridirektoratet
Ingen header, ingen konto. Lisens NLOD 2.0 (`/pub-aqua/api/terms` viser vidare dit).

| Endepunkt | Kva det gir | Format | Status |
|---|---|---|---|
| `Yggdrasil/Akvakultursøknader/MapServer/0/query` | **309 søknader under behandling**: søkjar, orgnr, lokalitet, ønska MTB i tonn, status, innsendt dato. 115 har MTB i klartekst | Esri JSON | 200 ✔ nyaste innsend 9. sept — i går |
| `Yggdrasil/Akvakultursøknader/MapServer/4/query` | 599 ferdigbehandla søknader med GRANTED/avslag og vedtaksdato | Esri JSON | 200 ✔ |
| `Yggdrasil/Miljøtilstand/FeatureServer/0/query` | 921 B-undersøkingar: tilstand 1–4, måledato, orgnr, `cause`-felt | Esri JSON | 200 ✔ nyaste 3. sept |
| `Yggdrasil/Biomasse/MapServer/0/query` | har_fisk Ja/Nei, **fylke og produksjonsområde per lokalitetsnummer** | Esri JSON | 200 ✔ 640 med fisk, oppdatert månadleg |
| `Yggdrasil/Rømming/FeatureServer/0/query` | 578 rømmingar: selskap, dato, art, estimert antal, gjenfangst | Esri JSON | 200 ✔ men sju vekers etterslep |
| `Yggdrasil/Forbudssoner_.../MapServer` | 1 270 soner for badebehandling, 727 for kitinsyntesehemmarar | Esri JSON | 200 ✔ |
| `pub-aqua/api/v1/dump/new-legacy-csv-file` | Heile Akvakulturregisteret, dagsdatert i første linje | CSV | 200 ✔ 6,9 MB, «PR. 10-09-2026» |
| `pub-aqua/api/v1/sites?range=0-99` | Lokalitetar med paginering. **`range` er parameteren** — standard er `0-9`, maks 100 per side | JSON | 200 ✔ 1 780 lokalitetar totalt |
| `pub-aqua/api/api-docs` | OpenAPI 3.1, 28 stiar | JSON | 200 ✔ |
| `api.fiskeridir.no/envreportreg-public/api/v1/report/{id}` | Full miljørapport per rapport-ID | JSON | 200 ✔ |

### Fartøy — Kystdatahuset (Kystverket)
Ingen konto. Lisens NLOD.

| Endepunkt | Kva det gir | Format | Status |
|---|---|---|---|
| `/ws/api/ais/realtime/geojson` | Alle fartøy i norske farvatn. Utan parameter: siste 10 min. **Med `?timeStamp=`: opptil 30 dagar bakover** | GeoJSON | 200 ✔ ~3 500 fartøy, 3,3 MB, 9–23 s |
| `/ws/api/ais/statinfo/for-mmsis-time` | **`shiptypelevel5: "Fish Carrier"`, `statcode5: "B12B2FC"`** per MMSI, pluss IMO, kallesignal, lengd, GT. 250 MMSI per kall | JSON | 200 ✔ alle 3 525 MMSI klassifisert på 29 s |
| `/ws/api/tracks/for-ships/by-mmsi` | **Historiske spor** med LineString, starttid, sluttid, `nmi` (segla distanse) | JSON | 200 ✔ verkar gjennom heile 2026 fram til ~21. aug |
| `/ws/api/tracks/for-ships/by-mmsi-mid` | Alle fartøy med norsk MMSI-prefiks i eit tidsrom | JSON | 200 ✔ 11 661 segment for 6 timar, 14,1 MB, 52 s |
| `/ws/api/voyage/for-ships/by-mmsi` | Anløpshistorikk | JSON | 200 ✔ fram til 3. sept |
| `/ws/swagger/v1/swagger.json` | Spesifikasjon, 121 stiar | JSON | 200 ✔ |

### Andre
| Kjelde | Kva det gir | Status |
|---|---|---|
| `geo.barentswatch.no` WFS `bw:localitywithila` / `bw:localitywithpd` | ILA- og PD-lokalitetar med mistankedato, paavistdato, **tomtdato** (= utbrotet er over) | 200 ✔ men sjå åtvaring under punkt 8 |
| `data.brreg.no/.../oppdateringer/enheter?dato=` | Endringsstraum for alle norske selskap | 200 ✔ ~3 000 endringar per dag |
| `data.brreg.no/.../enheter?konkurs=true&naeringskode=03.211` | **Konkursflagget per oppdrettsselskap** | 200 ✔ |
| `w2.brreg.no/kunngjoring/kombisok.jsp` | Konkurskunngjeringar med dato- og bransjefilter. HTML, ikkje JSON | 200 ✔ 59 konkursar i bransje A, juni–sept 2026 |
| `data.ssb.no/api/v0/no/table/03024/` | Vekevis lakseeksportpris i kr/kg | 200 ✔ oppdatert kvar onsdag |

---

## 3. Kva er stengt

- **BarentsWatch fiskehelse-API** (lus, behandlingar, sjøtemperatur, VesselVisit med `isWellboat`) — 401. *Vi treng det ikkje for lus lenger, men `isWellboat` finst ingen annan stad.*
- **BarentsWatch AIS** (`/geodata/ais/openpositions`, `live.ais.barentswatch.no`) — 401 trass i namnet «open».
- **BarentsWatch sitt eige offentlege lusekart** — kartet er gratis å sjå, men endepunkta bak krev innlogging med tofaktor. Lusetala er altså ikkje fritt maskinlesbare frå BarentsWatch for nokon.
- **BarentsWatch slakteridata** (`/fishslaughterhouses`) — 401.
- **Mattilsynet abonnement/webhook** (`/api/*/abonnement`) — krev Maskinporten. *Berre ei bekvemmelegheit; pull-endepunkta gjev same data.*
- **HAIS (hais.kystverket.no)** — ser ut som eit gratis bestillingsskjema, men krev **Microsoft-innlogging** (Entra OAuth). Stengd.
- **aisstream.io** — krev GitHub-innlogging og API-nøkkel.
- **ais.kystverket.no** — 503, nede.
- **ais-public.kystverket.no** (gamal open CSV) — daud. Geonorge peikar framleis på den.
- **nais.kystverket.no** — ser ut som Kystverket, men er ein BarentsWatch-app med innlogging mot id.barentswatch.no.
- **Kystdatahuset sine skipsregister-endepunkt** (`/api/ship/data/shipinfo/...`, `/shiptypes`, `/nsr/download` m.fl.) — 401 «Due to licensing constraints», sjølv om spesifikasjonen seier dei er opne. **Ikkje stol på security-feltet i Kystdatahuset sin OpenAPI.**
- **Kystdatahuset `/api/ais/positions/*`** — teknisk øydelagt frå 18. mars 2026 og fram til i dag. *Feilen kjem som HTTP 200 med `success:false` i kroppen — sjekk alltid `success`, aldri berre statuskoden.*
- **Doffin** — krev abonnementsnøkkel.
- **NAV sitt dokumenterte public-feed** — krev Bearer-token. (Deira udokumenterte søkjebakstykke er ope, men signalet er for tynt: «røkter» gjev 7 treff, eitt av dei ein frisørsalong.)
- **Veterinærinstituttet** — 401 på alle app-stiar.
- **Nasdaq Salmon Index** — nedlagd, etterfølgjaren SISALMONI blir sendt på e-post til abonnentar. Bruk SSB 03024.
- **Konkursregisteret sitt kunngjerings-API** — krev rettsleg grunnlag. (Men konkursflagget og HTML-søket er opne.)
- **Akvakultursøknader FeatureServer** — gjev 500 «extension not found». Det er ei manglande utviding, ikkje ei sperre. **MapServer verkar.**

---

## 4. Fartøy — held Kystdatahuset?

**Krev det konto?** Nei. Alle endepunkta over svarar HTTP 200 heilt anonymt. Testa frå null. Kystverket skriv sjølve: «Merk at noen web services er åpne og ikke krever autentisering.»

**Er kommersiell bruk lov?** Ja. NLOD gjev bruk «til ethvert formål og i enhver sammenheng», vederlagsfritt, og lisensen definerer «tilgjengeliggjøre» til å omfatte «selge, låne ut og leie ut». To plikter: du **må** skrive «Inneholder data under Norsk lisens for offentlige data (NLOD) tilgjengeliggjort av Kystverket» med lenkje, og du **kan ikkje** bruke Kystverket sitt namn slik at det ser ut som dei støttar produktet. «Byggjer på opne data frå Kystverket» er greitt. «I samarbeid med Kystverket» er det ikkje.

**Rate limits?** Ingen dokumenterte, ingen målte. Vilkåra seier ordrett: «Det er ingen begrensninger i APIet men operasjoner som tar lang tid vil utløpe etter fire minutter.» 15 raske kall på rad og 42 batchar gav alle 200, og ingen rate-limit-headerar finst. Men Kystverket ber om å få vite kven som lagar høg last. Fråvær av grense i ein liten test er ikkje det same som at det ikkje finst ei.

**Kan vi finne brønnbåtar utan BarentsWatch sitt flagg?** Delvis, og dette er det viktigaste atterhaldet i heile dokumentet.

- Ja, vi finn kandidatane: `statcode5 = B12B2FC` / `shiptypelevel5 = "Fish Carrier"`. 88 fartøy i eit augeblikksbilete, 98 over 30 dagar.
- **Nei, vi kan ikkje skilje brønnbåt frå slaktebåt.** Slaktebåten NORWEGIAN GANNET (94 m) har nøyaktig same kode som brønnbåtane. For eit lusevarsel er det to heilt ulike hendingar. Ingen open kjelde løyser dette. BarentsWatch sitt `isWellboat` gjer det.
- Lista er òg ureinsa nedover: 16 av 98 er under 40 m, 6 manglar IMO-nummer, minste er 14,8 m. Eit filter på lengd over 40 m + gyldig IMO reinskar mykje, men vil òg fjerne små brønnbåtar.
- Eit hardkoda filter på norsk MMSI (257/258/259) er feil: over 30 dagar dukka det opp ein russiskflagga (MID 273, ANATOLI FIRSOV).

**Uavklart:**
- Sporarkivet ligg ~20 dagar etter sanntid. Om det etterslepet er fast, veit vi ikkje.
- Meldinga «Using public filter» i sporsvaret tyder på at anonyme brukarar får ei redusert mengd. Kva som blir filtrert bort, veit vi ikkje.
- Kystverket held uansett tilbake fiskefartøy under 15 m og fritidsbåtar under 45 m, av personvernomsyn.
- Dekninga i trange fjordar er ikkje målt. Kystverket åtvarar sjølv om hol i basestasjonsdekninga.

---

## 5. Dei ti reglane — kva overlever

| # | Regel | Utan konto | Kjelde | Merknad |
|---|---|---|---|---|
| 1 | Utsett av fisk | **DELVIS** | Biomasse `har_fisk` (månadleg) + B-undersøking `cause=beforeExposing` (232 postar) + driftsplanar | B-undersøkinga er leiande: 7 dagar frå måling til synleg data. Men driftsplanane har berre 3 reelle planar |
| 2 | Brakklegging | **DELVIS** | Biomasse `har_fisk=Nei` + B-undersøking `cause=brakklegging` | Svakt. `har_fisk=Nei` har rapportdatoar heilt tilbake til 2005, og `brakklegging` har berre 15 av 921 postar. Ikkje tidfesta |
| 3 | Luseauke | **MOGLEG** | Mattilsynet lakselus | Per lokalitet, per veke. Rekn trend sjølv over 2–3 veker |
| 4 | Over lusegrensa | **MOGLEG** | Mattilsynet lakselus + Biomasse for fylke | ~19 over 0,5 i eit ti-dagars vindauge. 0,2-grensa i veke 16–21/21–26 krev fylke — løyst, 603 av 604 lokalitetar. Grensa må reknast ut sjølv frå FOR-2012-12-05-1140 § 8 |
| 5 | Behandling utført | **MOGLEG** | Mattilsynet lakselus | Felta `medikamentelleBehandlinger`, `ikkeMedikamentelleBehandlinger`, `kombinasjonsbehandlinger` med type og antal merder. ~164 av 990 rapportar i eit ti-dagars vindauge |
| 6 | Behandlingsklynge | **MOGLEG** på fylke-/produksjonsområde-nivå | Mattilsynet + Biomasse | Fylke og produksjonsområde er stadfesta. Klynge på radius krev koordinatar per lokalitet — ikkje stadfesta enno, sjå punkt 8 |
| 7 | Sonebyte | **MOGLEG** | BarentsWatch WFS (ILA/PD) + Mattilsynet sykdomstilfeller + 1 997 behandlingsforbodssoner | Betre enn spesifisert. Men bruk WFS til å avgjere når eit utbrot er OVER: Mattilsynet har 19 ILA-saker utan sluttdato, WFS har berre 6 aktive. Berre Mattilsynet gjev tre gonger for mange «aktivt utbrot»-varsel |
| 8 | Slaktevindauge | **UMOGLEG** | — | BarentsWatch `/fishslaughterhouses` er 401. Kystdatahuset kan ikkje skilje slaktebåt frå brønnbåt. Ingen open erstatning funnen |
| 9 | Brønnbåt-besøk | **DELVIS** | Kystdatahuset sanntid + spor | Vi ser at eit «Fish Carrier» stoppar ved ein lokalitet. Vi veit ikkje sikkert om det er ein brønnbåt eller ein slaktebåt. Bruk stopp-deteksjon: sporsegmenta har `nmi` og start/slutt-tid, så eit stopp fell ut direkte. Utan fartsfilter blir tre av tre treff i ein test falske positive (gjennomfart i 10–12 knop) |
| 10 | Smittepress | **DELVIS** | Mattilsynet lakselus + geografi | Vi kan rekne vår eigen nabo-lusepressindeks frå opne tal. Men det er vår modell, ikkje Havforskningsinstituttet sin validerte. Ikkje kall det «offisielt smittepress» |

**Sum: 5 moglege, 4 delvise, 1 daud.**

---

## 6. Nye hendingar vi kan bygge i staden

Desse var ikkje i dei ti reglane, men er opne, ferske og verifiserte.

| Hending | Kjelde | Frekvens | Volum |
|---|---|---|---|
| **Ny søknad under behandling, med ønska MTB** | Fiskeridirektoratet Akvakultursøknader MapServer lag 0 | Dagleg (nyaste var frå i går) | 309 opne, 115 med MTB. Størst: MULTIGEN GADUS 8 000 t, LERØY AURORA 7 200 t, SINKABERGHANSEN 7 020 t |
| **Søknad innvilga** | Same, lag 4 | Dagleg | 599 ferdigbehandla |
| **B-undersøking før utsett** (`cause=beforeExposing`) | Miljøtilstand FeatureServer | ~7 dagar frå måling til synleg | 232 postar. Varsel om at fisk kjem om få veker |
| **Miljøtilstand 3 eller 4** (må kutte produksjon) | Same | Same | Tilstand 1–4 per lokalitet |
| **Nytt sjukdomstilfelle** | Mattilsynet sykdomstilfeller | Løpande | 212 totalt. Berre 5 sjukdomstypar finst faktisk i dataa: PD 138, ILA 54, flavobacterium 9, BKD 6, francisellose 5 |
| **Utbrot avslutta** | BarentsWatch WFS `tomtdato` | Løpande | Meir presist enn Mattilsynet på akkurat dette |
| **Konkurs / sletting i oppdrettsbransjen** | BRREG endringsstraum + `konkurs=true&naeringskode=03.211` | Dagleg | ~3 000 endringar/dag totalt, filtrer mot dei 494 oppdrettsorgnra |
| **Kapasitetsendring / eigarskifte** | Dagleg diff av Akvakulturregister-CSV + `capacity-history` | Dagleg | Dumpen daterer seg sjølv |
| **Lakseprisen fell eller stig** | SSB tabell 03024 | Kvar onsdag | Fersk laks: 73,52 → 71,87 → 69,71 kr/kg over veke 34–36 |
| **Rensefiskbruk endrar seg** | Mattilsynet rensefisk | Månadleg | 461 rapportar, per merd, med dødsårsak |
| **Rømming** | Fiskeridirektoratet Rømming | **~7 vekers etterslep** | 578 totalt, 57 i 2026. **Ikkje lov å love «her rømte det fisk i går»** — august og september 2026 har null hendingar, mot 9–13 i same månader tidlegare år. Bruk det som historikk og risikoprofil per selskap, ikkje som varsel |

---

## 7. ÆRLEG DOM

**Er det eit produkt? Ja.** Og det er eit betre produkt enn det du hadde grunn til å tru, fordi lusetala aldri var problemet — vi såg berre feil stad.

**Det beste som kan byggast utan konto, i fem setningar:**

Ein dagleg motor som hentar Mattilsynet sine luserapportar inkrementelt på `fra-rapporteringstidspunkt`, koplar kvar lokalitet til fylke og produksjonsområde via Fiskeridirektoratet, og reknar ut sjølv om lokaliteten er over grensa i den veka. Same motor diffar Akvakulturregisteret, søknadslaget og B-undersøkingane mot gårsdagen, og gjer skilnadene om til daterte hendingar per lokalitet og per selskap. Sjukdom hentar han frå Mattilsynet, men bruker BarentsWatch sitt opne WFS til å avgjere når eit utbrot faktisk er over. Fartøysporet frå Kystdatahuset legg på eit «eit fartøy av brønnbåttypen har lege stille her i fire timar»-signal, med ærleg merking om at det kan vere ein slaktebåt. Alt køyrer gratis i GitHub Actions, utan ein einaste hemmelegheit å halde ved like, og leverer ein e-post- eller Slack-digest med filter på fylke, produksjonsområde og selskap.

**Kva ville fem minutt med registrering hos BarentsWatch låse opp?**

Det er eit mykje mindre spørsmål enn før. Konkret og fullstendig:

1. **`VesselVisit` med `isWellboat`** — BarentsWatch har alt rekna ut kva som er ein brønnbåt og kva som er eit brønnbåtbesøk. Det løyser regel 9 heilt og fjernar den einaste plassen der vi må gjette.
2. **Slakteridata (`/fishslaughterhouses`)** — regel 8, den eine daude regelen, blir levande.
3. **Fartøysporing og rømming direkte frå BarentsWatch** — kanskje ferskare enn Fiskeridirektoratet sitt sju veker gamle rømmingslag. Ikkje testa.

Det låser **ikkje** opp lusetal, behandlingar, sjøtemperatur eller sjukdom. Alt det har vi allereie, frå kjelda BarentsWatch sjølv les frå.

**Kva det kostar å ha ein konto:** eit token som må ligge som secret i GitHub Actions, som kan gå ut på dato, som du må halde i live, og vilkår du må lese. Akkurat den typen ting du har bygt heile prosjektet for å sleppe.

**Kva det kostar å stå utan:** null kroner, regel 8, og eit atterhald i teksten på brønnbåt-varselet. Det er heile rekninga.

Du har bestemt deg, og avgjerda er lett å forsvare. Bygg utan konto. Om brønnbåt-varselet ein gong viser seg å vere det folk faktisk betaler for, kan du ta opp spørsmålet på nytt då — då er det éin funksjon som skal betre seg, ikkje eit heilt prosjekt som står og fell.

---

## 8. Må avklarast

| Spørsmål | Kva som svarar på det |
|---|---|
| **Får vi koordinatar per lokalitet?** Regel 6 (klynge på radius) heng på det | Køyr Biomasse-laget med `returnGeometry=true&outSR=4326`, og sjekk om Akvakulturregister-CSV-en har lat/lon-kolonnar. Fylke og produksjonsområde er allereie stadfesta |
| **Kvifor manglar 85 lokalitetar med fisk i luserapporten?** Avgjer om «ingen rad» kan tolkast | Tre kandidatar: utdatert `har_fisk` hos Fiskeridirektoratet, unntaket for sjøtemperatur under 4 °C, eller reelle hol. Hent dei 85 lokalitetsnummera og slå kvart opp i `/api/lakselus/v2/rapporteringer?lokalitetsnummer=X` for dei fire siste vekene |
| **Blir gamle luserader retta i ettertid, eller berre lagt til?** Avgjer om du kan gjere upsert på `id` | Lagre `id` + innhald for 200 rader i dag, hent dei same på nytt om ei veke og samanlikn. Talet på rapportar med behandling gjekk frå 152 til 164 medan berre 2 nye rader kom inn — det tyder på at rader muterer |
| **Kva filtrerer «Using public filter» bort i Kystdatahuset sine spor?** | Samanlikn talet på unike MMSI i `tracks/by-mmsi-mid` mot talet i sanntidsfeeden for same tidsrom. Om småbåtar manglar i sporet men finst i feeden, er filteret på storleik |
| **Kor stort er etterslepet i Kystdatahuset sitt sporarkiv?** Var ~20 dagar | Køyr `tracks/for-ships/by-mmsi` for ein kjend brønnbåt for kvar dag dei siste 30, og sjå kva dag som er ferskast med data. Gjenta om ein månad |
| **Toler `by-mmsi-mid` eit heilt døgn?** 6 timar tok 52 s og 14,1 MB; vilkåra avbryt etter 4 minutt | Køyr eitt kall med 24 timars vindauge og mål tid og storleik |
| **Er BarentsWatch sitt WFS lovleg i eit kommersielt produkt?** | WFS-en seier «Fees: NONE» men òg «Some restrictions apply for BarentsWatch services. Contact for details.» Gratis er ikkje det same som fritt. Send ein e-post til BarentsWatch og spør konkret om ILA- og PD-laga kan brukast kommersielt. Til det er avklart: bruk Mattilsynet sine sjukdomstilfelle som primærkjelde, sidan dei er NLOD |
| **Fyllest driftsplan-feeden opp?** 10 planar der 7 er tomme er for tynt til å byggje på | Hent `/api/driftsplaner/v1/aktive/soknader` ein gong i veka og logg `x-count`. Finn innleveringsfristen i akvakulturdriftsforskrifta |
| **Kor ofte blir rømmingslaget oppdatert?** Kan ikkje skilje «ingen rømmingar» frå etterslep | Logg `x-count` og nyaste `rommingsdato` dagleg i seks veker. Når ei hending frå august 2026 dukkar opp, veit du etterslepet |
| **Rate-grense hos Mattilsynet** | Ikkje test dette ved å presse. Bruk `fra-rapporteringstidspunkt` og hent inkrementelt ein gong i timen eller ein gong om natta. Vilkåra gjev dei rett til å stengje ved overbelastning |
| **Toler BRREG sitt kunngjeringssøk maskinell henting?** Det er HTML, ikkje API | Finn vilkårssida for `w2.brreg.no`, eller bruk berre `konkurs=true`-flagget frå det ordentlege API-et, som er trygt |
| **Kva betyr `sekvensnummer` i lusedataa?** Null i alle rader vi såg | Truleg ubrukeleg. Bruk `x-count` og `fra-rapporteringstidspunkt` i staden |

---

### Namngjeving (pliktig, ikkje valfritt)

NLOD punkt 5 krev at kjelda blir namngitt. I varsla og på nettsida:

> Inneheld data under Norsk lisens for offentlege data (NLOD), tilgjengeleggjort av Mattilsynet, Fiskeridirektoratet og Kystverket. Data er bearbeidde av oss.

NLOD punkt 6 krev òg at data ikkje blir framstilt villeiande, og at feiltolkingar blir retta når du blir kjend med dei. Du kan **ikkje** skrive noko som antyder at desse etatane støttar eller samarbeider med produktet.
