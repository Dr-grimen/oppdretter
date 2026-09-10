# API-funn — fase 0

Skrive 9. september 2026. Alt som står som fakta her har overlevd ein motbevis-runde der ein uavhengig kontrollør opna kjelda på nytt og sjekka påstanden («kept» eller «corrected»). Påstandar som blei drepne, eller som aldri blei kontrollerte, står ikkje som fakta — dei ligg i seksjon 8 og 9.

---

## Kort oppsummering for ein ikkje-teknisk lesar

- **Sjukdomssonene er heilt gratis og heilt opne.** ILA- og PD-sonene ligg på ei open karteneste hos BarentsWatch (geo.barentswatch.no) som ikkje krev konto, passord eller nøkkel i det heile. Dette er verifisert med ekte kall.
- **Lusedata er det ikkje.** Alle lusetal, temperaturar og behandlingar krev innlogging med eit token. Utan token får du «401 — ikkje autorisert». Det er verifisert på seks ulike endepunkt.
- **Det kostar ingenting.** All data ligg under NLOD (norsk lisens for offentlege data), og BarentsWatch seier uttrykkeleg at kommersiell bruk er lov. Det finst ingen prisliste å uroe seg for. Einaste unnataket: ved «høgtrafikk» kan dei krevje handteringskostnader, men ingen tal er publiserte.
- **Den største hindringa er eit menneske i ein nettlesar.** Klienten må registrerast manuelt på barentswatch.no/minside. Det kan ingen maskin gjere for deg. Du vel sjølv passordet (client secret) der.
- **Tre felt vi hadde tenkt oss finst ikkje.** Det er ikkje noko «har fisk»-felt, ikkje noko «MTB»-felt, og ikkje noko lusegrense-felt per lokalitet. Vi må enten rekne dei ut sjølve eller hente dei ein annan stad.
- **Ingenting er testa med ekte token.** Ingen av dei to kontrollrundane logga inn. Alt som ligg bak innlogging er lese ut av dokumentasjonen, ikkje av eit svar. Det er den viktigaste risikoen i heile fase 0.
- **To av seks kartleggingar manglar i datagrunnlaget.** Det finst ingen rapport om regelverket (lusegrense, rapporteringsfrist) og ingen marknadskartlegging. AIS-rapporten mangla motbevis-dom. Seksjon 4, 5 og 7 er difor tynne med vilje, ikkje av slurv.

---

## 1. Autentisering

### Registrering — dette må eit menneske gjere sjølv i nettlesar

Ingen maskin kan gjere stega under. Sida krev innlogging, og ingen av kontrollrundane logga inn.

1. Logg inn på **https://www.barentswatch.no/minside** (ordrett frå dokumentasjonen: «Log on to https://www.barentswatch.no/minside»). Merk: registrering skjer **ikkje** på developer.barentswatch.no — den sida er berre dokumentasjon.
2. Klikk «show more» under **«Utviklertilganger»** og vel anten **BarentsWatch API** eller **AIS API**. Ordrett: «If you need access to both you need to create two clients.» Til fiskehelse: BarentsWatch API.
3. Klikk **«Ny klient»** under **«Mine klienter»**.
4. **Du vel sjølv passordet.** Ordrett: «make a note of the password (client secret) you choose.» Det blir altså ikkje generert for deg, og det er ikkje dokumentert offentleg om det kan hentast fram att seinare.
5. Fyll ut feltet **«Formål»** — BarentsWatch ber uttrykkeleg om det.
6. Client ID får e-postadressa di som prefiks, i forma `epost@example.com:klientnamn`.

> **Hemmelegheita skal ikkje i chat.** Client secret må skrivast rett inn i eit terminalvindauge eller ein GUI-dialog, ikkje limast inn i ein samtale.

### Token

| Element | Verdi |
|---|---|
| Endepunkt | `https://id.barentswatch.no/connect/token` (POST, HTTPS) |
| Content-Type | `application/x-www-form-urlencoded` |
| grant_type | `client_credentials` |
| scope | `api` for fiskehelse, `ais` for AIS-API-et |
| Plassering | client_id, client_secret, scope og grant_type skal i **BODY**, ikkje som headerar |
| URL-enkoding | `@` → `%40`, `:` → `%3A`, altså `myusername%40example.com%3Amyclient` |
| Flyt | Sjølvregistrerte klientar støttar **berre** client_credentials |

Verifisert live i motbevis-runden: OIDC-discovery (`https://id.barentswatch.no/.well-known/openid-configuration`) stadfestar issuer, token_endpoint, `client_credentials` blant grant_types_supported og `client_secret_basic` + `client_secret_post` som auth-metodar. Ein POST utan legitimasjon gir HTTP 400 `{"error":"invalid_request"}`.

```bash
# Ordrett frå https://developer.barentswatch.no/docs/appreg
curl -X POST --header "Content-Type: application/x-www-form-urlencoded" \
  -d "client_id=YOUR_CLIENT_ID&scope=api&client_secret=YOUR_CLIENT_SECRET&grant_type=client_credentials" \
  https://id.barentswatch.no/connect/token

# API-kall med token
curl -X GET "https://www.barentswatch.no/bwapi/v1/geodata/fishhealth/locality/35657/avgfemalelice/2022" \
  -H "Authorization: Bearer <token>"
```

**Fallgruver som blei retta i motbevis-runden:**

- Token-svaret har **ikkje** same form i alle døma. `docs/tutorial` viser `"token_type":"Bearer"` og eit `scope`-felt; `docs/appreg` viser `"token_type": "bearer"` med små bokstavar og **ingen** scope-felt. Les `token_type` utan omsyn til store/små bokstavar, og krev ikkje at `scope` finst.
- **Ikkje hardkod 3600.** Begge døma viser `expires_in: 3600`, men ingen av dei er eit levande svar. Les `expires_in` frå det faktiske svaret.
- `scopes_supported` i discovery-dokumentet listar 12 scope (permissiongroups, email, profile, openid, IdentityServerApi, bwidentityserverapi_api, api, ais, legacyapi, nosapi, areapi, offline_access). At eit scope står der tyder **ikkje** at ein sjølvregistrert klient får be om det — dokumentasjonen avgrensar deg til `api` eller `ais`.

### Basis-URL-ar

| Miljø | URL |
|---|---|
| Produksjon | `https://www.barentswatch.no/bwapi/` |
| Pilot | `https://pilot.barentswatch.net/bwapi/` (krev eigen klient konfigurert for miljøet) |
| Gamalt API | `https://www.barentswatch.no/api/` — **deprecated, blir fjerna** |
| Støtte | post@barentswatch.no |

### Opne endepunkt i tabellen over (ingen token)

| Metode | URL | Merknad |
|---|---|---|
| GET | `https://id.barentswatch.no/.well-known/openid-configuration` | OIDC-discovery |
| GET | `https://www.barentswatch.no/bwapi/openapi/fishhealth/openapi.json` | Heile spesifikasjonen, 675 543 byte, openapi 3.0.4, 128 stiar |
| POST | `https://id.barentswatch.no/connect/token` | Token (krev legitimasjon i body) |

---

## 2. Fiskehelse-API

Spesifikasjonen er lasta ned og parsa uavhengig av to omgangar; begge fekk same fil (SHA256 `2f08778f09272ef1c9e07aab13a23f8ee50df6f50b7b8097edd91826ca1a7630`). **128 stiar = 128 operasjonar, av dei 126 GET og 2 POST.** Global tryggleik er `[{"oauth2": ["api"]}]`, og ingen av dei 128 operasjonane overstyrer det.

### 2.1 Endepunkt

| # | Metode | Sti (etter `https://www.barentswatch.no/bwapi`) | Kva du får |
|---|---|---|---|
| 1 | GET | `/v1/geodata/fishhealth/locality/{year}/{week}` | Vekeliste over alle lokalitetar. 40+ valfrie query-filter. |
| 2 | POST | `/v2/geodata/fishhealth/locality/{year}/{week}` | Same, v2. **POST med JSON-body**, ikkje GET. |
| 3 | GET | `/v1/geodata/fishhealth/locality/{localityNo}/{year}/{week}` | Full detalj for éin lokalitet éi veke (rå lusetal). |
| 4 | GET | `/v2/geodata/fishhealth/locality/{localityNo}/{year}/{week}` | Same, v2, med trend mot førre veke. |
| 5 | GET | `/v1/geodata/fishhealth/locality/{localityNo}/avgfemalelice/{year}` | Tidsserie vaksne holus, heilt år. |
| 6 | GET | `/v1/geodata/fishhealth/locality/{localityNo}/liceTypeDistribution/{year}` | Tidsserie, alle tre lusestadia. |
| 7 | GET | `/v1/geodata/fishhealth/locality/{localityNo}/seatemperature/{year}` | Tidsserie sjøtemperatur. |
| 8 | GET | `/v1/geodata/fishhealth/locality/{localityNo}/liceTreatments/{year}` | Tidsserie behandlingar. |
| 9 | GET | `/v1/geodata/fishhealth/localities` | Statisk register, alle lokalitetar. Valfri `query`. |
| 10 | GET | `/v1/geodata/fishhealth/localitieswithsalmonoids` | Register avgrensa til laksefisk-løyve. |
| 11 | GET | `/v1/geodata/locality/{localityNo}/salmonlice` | Rapportstatistikk. «Available from year 2012». |
| 12 | GET | `/v1/geodata/locality/{localityNo}/capacity` | Kapasitetshistorikk. «Available from year 2012». |
| 13 | GET | `/v1/geodata/download/fishhealth` | Bulk CSV/XLSX. `reporttype` og `filetype` er **påkravde**. |
| 14 | GET | `/v1/geodata/download/fishhealth/preview` | Førehandsvising — **dette** er endepunktet som returnerer eksport-DTO-en. |
| 15 | GET | `/v1/geodata/fishhealth/localitiesoverlimitbyweek` | Tal lokalitetar over lusegrensa per veke. `startYear`, `endYear`. |
| 16 | GET | `/v1/geodata/fishhealth/{year}/{week}` | Nasjonalt vekesamandrag (18 felt). |
| 17 | POST | `/v2/geodata/fishhealth/{year}/{week}` | Same, v2. **POST.** |
| 18 | GET | `/v3/geodata/fishhealth/locality/{localityNo}/disease` | Alle sjukdomstilfelle for lokaliteten. |
| 19 | GET | `/v3/geodata/fishhealth/locality/{localityNo}/disease/{year}` | Sjukdomstilfelle for eitt år. |

**Parameterformat:** år og veke er to separate heiltal i stien, ordrett skildra som «The year part of ISO week date» og «The week part of ISO week date». Ingen dato-streng.

**Enum-ar for nedlasting:** `reporttype` = `Disease` | `Lice` | `Treatments`; `filetype` = `Xlsx` | `Csv`. Verdiane står i skjemaa `FishHealthReportType` og `FishHealthReportFileFormat`, ikkje på parameteren sjølv — og parameterteksten bruker små bokstavar sjølv om verdiane som skal sendast har stor forbokstav.

### 2.2 Feltnamn mappa mot datamodellen i oppdraget

Alle namn er ordrett frå spesifikasjonen. Ingen oppdikta felt blei funne i nokon av dei to kontrollrundane.

| Vår modell | Feltnamn i API-et | Kvar det ligg | Status |
|---|---|---|---|
| `locality_no` | `localityNo` (tal) | LocalityDto, LocalityWeek, alle graf-DTO-ar. I v2 heiter det `locality.no` | ✅ |
| `name` | `name` / `localityName` / `locality.name` | LocalityDto / LocalityReportV1 / v2 | ✅ |
| `municipality` | `municipalityNo` (**streng**) + `municipality` | LocalityDto. I v2: `MunicipalityLink {no, name}` | ✅ |
| `production_area` | `ProductionAreaLink {id, name, color}`; flatt som `productionAreaId` + `productionAreaName` i eksport-DTO-en | v1/v2 detalj + eksport. Gyldige id-ar 1–13 | ⚠️ Berre id/namn. **Geometri må hentast frå Fiskeridirektoratet** — sjå seksjon 3 |
| `lat` | `lat` (double) | LocalityDto, AquaCultureLocalityDto, eksport-DTO | ✅ EPSG:4326 |
| `lon` | `lon` (double) | Same | ✅ EPSG:4326 |
| `capacity_mtb` | **IKKJE FUNNE som MTB.** Strengen «MTB» har **0 treff** i heile 675 kB-fila. Nærmaste er `capacity` (double) + `unit` (streng, døme `"TN"`, kapasitet 6240) | AquaCultureRegisterDetails, AquaCultureLocalityDto, LicenseDto | ❌ Eininga er **data**, ikkje ein antaking. Historikk: endepunkt 12 |
| `has_fish` | **IKKJE FUNNE.** Nærmaste er `isFallow` | LocalityDto, LocalityWeek | ❌ Sjå åtvaringa under |
| `lice_adult_female` | v1: `avgAdultFemaleLice`. v2: `adultFemaleLice.average` (LiceTrend) | LocalityDto, LocalityWeek, LiceReport | ✅ Skildring: «Average adult female lice per fish (this is the lice development stage lice limits target)» |
| `lice_mobile` | v1: `avgMobileLice`. v2: `mobileLice.average` | LocalityWeek, LiceReport | ✅ |
| `lice_stationary` | v1: `avgStationaryLice`. v2: `stationaryLice.average` | LocalityWeek, LiceReport | ✅ (v2 har òg `totalLice`) |
| `lice_limit` | **IKKJE FUNNE i JSON.** `liceLimit` og `aboveLiceLimit` finst berre i `LocalityWeekExportDto` (CSV/Excel), begge `{"type":"string","nullable":true,"readOnly":true}` **utan skildring** | Eksport-DTO, endepunkt 13/14 | ❌ Sjå seksjon 5 |
| `sea_temp` | `seaTemperature` (float, nullable, døme 8.5). Avrunda i eksport: `seaTemperatureRounded` | LocalityWeek, LiceReport, WeekSeaTemparatureDto | ✅ Merk feilstava skjemanamn «Temparature» |
| `treatments` | v1: `bathTreatments`, `inFeedTreatments`, `mechanicalRemoval`, `medicinalTreatments`, `nonMedicinalTreatments`, `combinationTreatments`, `timeSinceLastChitinSynthesisInhibitorTreatment`. v2: `LiceTreatments` med 8 felt (`combinationTreatments`, `medicinalTreatments`, `nonMedicinalTreatments`, `bathTreatments`, `cleanerFishTreatment`, `inFeedTreatments`, `mechanicalRemovalTreatment`, `daysSinceLastChitinSynthesisInhibitorTreatment`) | LocalityWeek / LiceReport | ✅ men sjå tidsbrot |
| `cleaner_fish` | `cleanerFish` = `CleanerFish {id, entireLocality, cleanerFishDetail[]}`, detalj = `{id, speciesId, species, quantity}`. Flagg: `hasCleanerfishDeployed` (LocalityDto) / `hasCleanerFishDeployed` (LocalityWeek) | LocalityWeek | ⚠️ **Hardt datastopp: ikkje tilgjengeleg etter veke 16, 2018** |

**Fire ting som gjer at kode går i stykker om du ikkje veit det:**

1. **`isFallow` er ikkje «tom merd».** Ordrett: «When a site obliged to report salmon lice, has not reported for four consecutive weeks or more, we assume it has no fish. Then it is exempt from salmon lice reporting.» Det er ein **avleidd** verdi. `isFallow=false` + `hasReportedLice=false` er ein **aktiv lokalitet som manglar rapport**, ikkje ein tom lokalitet. Dette skiljet må fram i UI-et.
2. **Casing skiftar mellom DTO-ar.** `hasCleanerfishDeployed` (liten f) i LocalityDto mot `hasCleanerFishDeployed` (stor F) i LocalityWeek. Og «har rapportert» heiter `hasReportedLice` i v1, men `hasReported` i v2.
3. **Spesifikasjonen lyg om responskodar.** Han deklarerer berre 200, 204, 400 og 404 — **ingen 401 og ingen 403** — sjølv om 401 er det faktiske svaret på eit kall utan token. Ikkje generer klientkode som stolar på responskodane i spesifikasjonen.
4. **Fylke finst berre i eksporten.** `county` og `countyNumber` er med i `LocalityWeekExportDto`, men ikkje i nokon JSON-DTO.

### 2.3 Tidsbrot i datasettet (må inn i alle tidsseriar)

- **Rensefisk:** «Cleaner fish data is not available after week 16, 2018, because of changes in reporting requirements.» I tillegg: «From the 19th of April 2018 there might be missing data due to transition to new reporting.»
- **Behandlingar:** `nonMedicinalTreatmentType` er «Only relevant for reports from updated licereport form starting 2024». `LocalityWeek` har eit `version`-felt — eldre og nyare veker må tolkast ulikt.
- **ILA/PD-saker:** delt ved veke 44 i 2020 («up to week 44 of 2020» mot «after week 44 of 2020»).
- **Slakteri:** «No results for weeks before 2019/23».
- **Brønnbåt-sporing:** «From week 35, 2020».

### 2.4 Ansvar for datakvalitet

Ordrett frå spesifikasjonen: «The data are raw data reported from the fish farms» og «The user of the data has the responsibility of quality control of data.» Det er altså **vi** som eig kvalitetskontrollen, ikkje BarentsWatch.

---

## 3. Kontrollsoner og geografi

### 3.1 Den opne vegen — WFS, ingen konto

`https://geo.barentswatch.no/geoserver/ows` svarar med ekte data heilt utan innlogging. Dette er verifisert med kredentialfrie kall mot ni lag, alle HTTP 200. **Merk:** dokumentasjonsartikkelen seier ikkje sjølv at det er utan autentisering — beviset er dei levande kalla, ikkje teksten.

- 29 lag totalt, **alle** med `DefaultSRS = urn:x-ogc:def:crs:EPSG:4326`. Ingen andre SRS-verdiar finst.
- Utdata er ekte GeoJSON FeatureCollection, `urn:ogc:def:crs:EPSG::4326`, **lon,lat-rekkjefølgje** (verifisert: Storvika I Skjerstadfjorden = `[15.275233, 67.203967]`).
- Reprojeksjon til UTM33 fungerer med `srsName=EPSG:25833`.

| Lag | Geometri | Talet på objekt (målt) |
|---|---|---|
| `bw:ilaprotectionzone` | MultiPolygon | 102 |
| `bw:ilasurveillancezone` | MultiPolygon | 179 |
| `bw:pdprotectionzone` | MultiPolygon | 3 |
| `bw:pdsurveillancezone` | MultiPolygon | 8 |
| `bw:pdzone` | MultiPolygon | 2 (`id` = `pd` og `surveillance`) |
| `bw:pdzone_borders` | LineString | 2 |
| `bw:isa10kmcircle` | Polygon | 6 — **berre inneverande veke** |
| `bw:localitywithila` | Point | 17 |
| `bw:localitywithpd` | Point | 32 |

**Feltnamn i sonelaga** (frå DescribeFeatureType): `id` (xsd:long), `forsknr`, `forsknavn`, `forsklink` (xsd:string), `sistendret` (xsd:dateTime), `fromdate`, `todate`, `originaldate` (xsd:date), `version` (xsd:long). **Geometri-eigenskapen heiter `geom`**, ikkje `geometry` — viktig om du bruker `propertyName`.

**Feltnamn i lokalitetslaga:** `lokalitetsnavn`, `lokalitetsnummer`, `sykdommer`, `mistankedato`, `paavistdato`, `tomtdato`, `version`. PD-laget splittar datoane per subtype: `pd_ukjent_*`, `pd_sav2_*`, `pd_sav3_*`.

```bash
# Aktive ILA-bekjempelsessoner (todate er tom) — verifisert: gir 5 treff, m.a. id 310 / FOR-2026-03-17-416
curl -s 'https://geo.barentswatch.no/geoserver/ows?service=WFS&version=2.0.0&request=GetFeature&typeNames=bw:ilaprotectionzone&outputFormat=application/json&CQL_FILTER=todate%20IS%20NULL' -o ila-aktive.geojson

# Same i UTM33
curl -s '...&srsName=EPSG:25833&CQL_FILTER=todate%20IS%20NULL' -o ila-utm33.geojson
```

> **⛔ Fallgruve som blei avslørt:** Å be om fleire lag i eitt kall (`typeNames=a,b,c,d`) **fungerer ikkje**. GeoServer tolkar det som ein JOIN og svarar HTTP 500 med `<ows:ExceptionText>Join query must specify a filter</ows:ExceptionText>`. Med `curl -s -o fil.json` får du ei øydelagd XML-fil utan synleg feil. **Køyr eitt kall per lag og slå saman sjølv.**

**Historikk i den opne WFS-en:** ILA-bekjempelsessoner tilbake til 2020-06-17, ILA-overvakingssoner tilbake til 2016-04-07 (målt over alle objekta).

**Risiko:** BarentsWatch si eiga opne-data-tabell dokumenterer berre **tre** fiskehelse-karttenester: «Locality with disease», «ISA control zones», «ISA surveillance zones». Det finst **inga rad for PD-soner**. `bw:pdprotectionzone`, `bw:pdsurveillancezone`, `bw:pdzone`, `bw:pdzone_borders` og `bw:isa10kmcircle` fungerer, men er udokumenterte — dei kan endre namn eller forsvinne utan varsel. Pinn ein reserveveg.

### 3.2 Dei 13 anonyme OLEX-endepunkta

Under `https://www.barentswatch.no/bwapi/v1/geodata/download/anonymous*` ligg det **13** stiar som svarar HTTP 200 `application/gzip` heilt utan token. Alle 13 er testa live (43 byte til 1,37 MB). Spesifikasjonen sin eigen summary: «Download dataset to OLEX chart plotter without authentication».

- **Berre `format=olex` verkar.** Alt anna gir HTTP 400 med `Content-Type: text/plain` og den bare strengen `Only OLEX format is supported without authentication`. Spesifikasjonen påstår at 400-svaret er JSON — det stemmer ikkje. Ikkje JSON-parse den feilmeldinga.
- Formatet er gzippa OLEX-tekst med koordinatar i desimalminutt (`3889.157340 / 60 = 64,82°`). Må parsast for hand.
- Datasetta dekkjer sjukdom, soner og geometri — **ingen lusetal** (0 treff på «lus»/«lice» i eit uthenta datasett).
- Ei liste blei retta: rapporten sa først 9, lista 12, fasiten er 13. `anonymous-exportrestrictions` (med bindestrek) og `anonymousexportrestrictions` er **to ulike stiar**.

### 3.3 REST-vegen (krev token)

| Sti | Merknad |
|---|---|
| `/v2/geodata/fishhealth/ilaprotectionzone/{year}/{week}` | «Coordinates are in EPSG:4326.» |
| `/v2/geodata/fishhealth/pdsurveillancezone/{year}/{week}` | Same |
| `/v1/geodata/fishhealth/pdzone` | Nasjonale PD-soner. **Ikkje** deprecated |
| `/v1/geodata/fishhealth/ilacontrolarea/firstvaliddate` | «The application doesn't have data on protection and surveillance zones before this date.» |
| `/v1/geodata/fishhealth/pdcontrolarea/firstvaliddate` | Same |
| `/v1/geodata/fishhealth/locality/diseasezonehistory/{localityNo}/{year}/{week}` | Sonehistorikk per lokalitet |

Svarmodellen `IlaControlArea` / `PdControlArea` bruker **camelCase**: `id`, `geometry`, `forskNr`, `forskNavn`, `forskLink`, `sistEndret`, `fromDate`, `toDate`, `version`, `originalDate` — altså andre namn enn WFS-en sine småbokstavar.

**«v1 er deprecated» er for grovt.** Berre desse er merkte `deprecated: true`: dei fire v1-sonestiane på forma `/{year}/{week}`, `/v1/geodata/fishhealth/locality/diseasezonehistory/{localityNo}` og `/v1/geodata/productionarea`. Alt anna v1 — inkludert `{forsknr}`-variantane, `pdzone`, `firstvaliddate` og alle `/v1/geodata/download/*` — er **ikkje** deprecated, og fleire av dei er einaste veg til data.

### 3.4 Produksjonsområde 1–13 — Fiskeridirektoratet, ikkje BarentsWatch

BarentsWatch sitt `/v1/geodata/productionarea` er både `deprecated: true` **og** bak token (verifisert 401). Det finst heller ikkje noko PO-lag i den opne WFS-en.

Open kjelde som fungerer, ingen innlogging:

```bash
curl -s 'https://gis.fiskeridir.no/server/rest/services/Yggdrasil/Produksjonsomr%C3%A5der/FeatureServer/0/query?where=1%3D1&outFields=*&f=geojson' -o produksjonsomrader.geojson
```

- Nøyaktig 13 objekt, id 1–13 komplett. Verifisert døme: `{'id': 3, 'name': 'Karmøy til Sotra', 'status': 'rød'}`.
- Felt: `objectid`, `id`, `name`, `status`, `areal`, `sjoareal`, `sjoareal_gl`, `globalid`. `status` er trafikklys (grønn/gul/rød).
- `wkid 4326`, formata JSON / geoJSON / PBF. Lisens NLOD.
- Yggdrasil har **inga** ILA-/PD-soneteneste (~90 tenester gjennomgått), så BarentsWatch er einaste kjelde til sonegeometri.

### 3.5 To ting å vere obs på i geodata

- **Datoane er ikkje samstemte mellom kjelder.** For same forskrift FOR-2026-03-17-416 seier WFS `fromdate = 2026-03-16Z`, medan OLEX-fila seier «Gyldig fra: 2026-03-15». Vel éi kjelde og dokumenter valet. Tidsstempla er dessutan lagra som norsk midnatt i UTC (22:00:00Z / 23:00:00Z) — bestem tidssone-handteringa med vilje.
- **Terminologien er ikkje stabil.** Av 102 ILA-bekjempelsessoner seier 40 «kontrollområde» og 62 «restriksjonssone» i same `forsknavn`-felt. Ordet «kontrollsone» finst ikkje som feltverdi i det heile. API-et bruker eit tredje sett: `controlarea`, `protectionzone` (= bekjempelsessone), `surveillancezone` (= overvakingssone). **Ikkje filtrer på tekststrengar.**

---

## 4. AIS

> ⚠️ **ÅTVARING OM KJELDA:** AIS-rapporten i datagrunnlaget har **ingen motbevis-dom**. Ingen uavhengig kontrollør har opna kjeldene på nytt. Etter regelen for dette dokumentet skal ingenting under presenterast som fakta. Det står her fordi det er retning for fase 1, ikkje fordi det er verifisert. **Alt i denne seksjonen må faktasjekkast før det blir brukt.** Sjå seksjon 9 for nøyaktig kva som må sjekkast.

**Det einaste i AIS-rapporten som er uavhengig stadfesta** (via autentiserings-rapporten sin motbevis-dom): scope må vere `api` **eller** `ais` avhengig av API-type, og du treng **to ulike klientar** om du vil ha begge. AIS bruker altså **ikkje** same token som fiskehelse.

### Tilråding (uverifisert)

Bruk **Fishhealth sitt eige fartøybesøk-endepunkt** framfor å byggje besøksdeteksjon frå råe AIS-posisjonar. Grunngiving: rapporten hevdar at `/v1/geodata/fishhealth/locality/{localityNo}/vessel/{year}/{week}` allereie returnerer ferdig utrekna besøk med `mmsi`, `vesselName`, `startTime`, `stopTime` og eit ferdig `isWellboat`-flagg. Om det stemmer, slepp vi heile deteksjonsproblemet, vi treng berre `api`-scope (ikkje `ais`), og vi slepp å halde eit eige brønnbåtregister. **Dette endepunktet er ikkje stadfesta av nokon kontrollør.** Sjekk det først.

Rå AIS er dyrare på alle måtar: eige token, eigen klient, strøymande API, og eit klassifiseringsproblem vi ikkje kan løyse frå AIS åleine.

### Feltnamn (uverifiserte)

| Antatt i oppdraget | Påstått faktisk namn |
|---|---|
| `lat` | `latitude` |
| `lon` | `longitude` |
| `sog` | `speedOverGround` |
| `cog` | `courseOverGround` |
| `imo` | `imoNumber` |
| `mmsi` | `mmsi` ✅ |
| `name` | `name` ✅ |
| `shipType` | `shipType` ✅ |
| `msgtime` | `msgtime` ✅ |

Merk: rapporten hevdar at `vesselslatestpositions` i Fishhealth bruker **andre** namn igjen (`cog`, `sog`, `rot`).

### Korleis identifisere brønnbåt (uverifisert)

- **AIS `shipType` er ikkje nok.** Den offisielle lista 0–99 har ingen kode for brønnbåt, servicefartøy eller fôrbåt. Verkelege brønnbåtar skal sende ulike kodar (70, 79, 99).
- **Register, ikkje AIS-type.** To vegar er påstådde: `isWellboat`-flagget i Fishhealth (kjelda for flagget er ikkje dokumentert), og Kystdatahuset sitt opne `/api/ais/statinfo/for-mmsis-time` der `shiptypelevel5 = "Fish Carrier"` og `statcode5 = "B12B2FC"` skal tyde brønnbåt. Servicefartøy skal kome ut som `Work/Repair Vessel` (`B34T2QR`).
- Kystverket åtvarar sjølv om at feil transponder-oppsett gjer fartøytypar vanskelege å skilje — eit argument for register framfor AIS-type.

### Dekningsgrenser som MÅ stå i UI-et

Desse er påstådde stadfesta frå to uavhengige Kystverket-kjelder, men er ikkje motbeviste her:

- Opne AIS-data inneheld **ikkje fiskefartøy under 15 meter** og **ikkje fritidsfartøy under 45 meter** — av personvernomsyn.
- BarentsWatch Live AIS: berre siste **24 timar** per MMSI. Historic AIS: berre **14 dagar**. Alt eldre må hentast frå Kystdatahuset.
- Historic AIS polygon-søk: maks **7 dagar** og maks **500 km²**.

### Historiske Kystverket-data

- `hais.kystverket.no` er eit **bestillingsskjema**, ikkje eit API: du oppgjev e-post og får datasettet tilsendt. Maks eitt år per bestilling. Du må velje skip eller teikne område — skipstype åleine er ikkje nok filter.
- Parquet-strukturen skal vere: `date_time_utc, mmsi, longitude, latitude, status, course_over_ground, true_heading, speed_over_ground, rate_of_turn, maneuvre, data_source, ais_class, msg_type, geometry`. **Ingen `name`, `imo`, `callsign` eller `ship_type`** — du kan altså ikkje identifisere ein brønnbåt frå Parquet-fila åleine.
- Den opne nedlastingskatalogen Geonorge framleis peikar på (`ais-public.kystverket.no/ais-download/`) skal vere død (connection reset).

---

## 5. Lusegrense og rapporteringsfrist

> **⛔ DETTE MANGLAR HEILT I DATAGRUNNLAGET.** Det ligg ingen kartleggingsrapport om regelverket i materialet eg fekk. Eg kan difor **ikkje** oppgi paragraf, grenseverdi per sesong, eller rapporteringsfrist. Alt slikt måtte eg ha funne på, og det gjer eg ikkje.

**Det vi faktisk veit, frå API-et og berre derifrå:**

- Tala 0,5 og 0,2 finst i spesifikasjonen, men **berre som skildringar av filterparametrar**: `AboveLiceThreshold` = «Above 0.5 avg. female lice», `AboveMinimumLiceThreshold` = «Above 0.2 avg. female lice». Det finst òg `BelowLiceThreshold`, `BelowMinimumLiceThreshold`, `MinLiceUserThreshold`, `MaxLiceUserThreshold`.
- Feltet det gjeld er identifisert: `avgAdultFemaleLice` har skildringa «Average adult female lice per fish (this is the lice development stage lice limits target)».
- **Det finst inga per-lokalitet lusegrense i JSON-API-et.** Eit systematisk søk gjennom alle skjema-eigenskapar etter «licelimit» gav berre `liceLimit` og `aboveLiceLimit` i `LocalityWeekExportDto` (CSV/Excel), pluss aggregat-tellarane `localitiesAboveLiceLimitAnnual` og `localitiesAboveLiceLimitCount`.
- `liceLimit` og `aboveLiceLimit` er begge `{"type":"string","nullable":true,"readOnly":true}` **utan skildring**. Vi veit ikkje om verdien er «0,5» eller «Ja»/«Nei».
- BarentsWatch reknar sjølv ut ei grense server-side — endepunkt 15 (`localitiesoverlimitbyweek`) leverer ferdige tal på lokalitetar over grensa. Kva regel dei bruker er ikkje dokumentert.

**Konsekvens for prosjektet:** vi må anten (a) lese `liceLimit` ut av ei ekte CSV-fil og sjå kva som faktisk står der, eller (b) rekne grensa ut sjølve frå regelverket — som først må kartleggjast. Rapporteringsfristen er heilt ukjend; at data er organiserte per ISO-veke fortel oss kadensen, men ikkje fristen.

---

## 6. Lisens, attribusjon og namn

### Attribusjonstekst som må stå i UI-et

To tekstar, begge påbodne:

> **Data levert av BarentsWatch**
> *(engelsk: Data delivered by BarentsWatch)*

> **Opplysninger om lakselus, rensefisk og medikamentbruk er hentet fra Mattilsynet.**
> *(engelsk: Information about lice, cleaner fish and treatments is provided by Mattilsynet.)*

Ordrett frå vilkåra: «We do not specify how the text are to be displayed, but it must be clearly visible to end user.» Teksten skal altså vere godt synleg når brukaren startar eller bruker tenesta. Det skal òg lenkjast til BarentsWatch der det er mogleg — vilkåra nemner berre `www.barentswatch.no/fiskinfo` som døme. (Ei tidlegare påstand om at `www.barentswatch.no/fiskehelse` var eit lenkjekrav var feil: den adressa står i utviklardokumentasjonen, og gjeld **kreditering**, ikkje lenking. To ulike plikter var slått saman.)

For Fiskeridirektoratet sine produksjonsområde gjeld NLOD på same måte.

### Lisens

- **NLOD** (`https://data.norge.no/nlod`) er deklarert både i spesifikasjonen og på vilkårssida. Vilkåra er sist oppdaterte 2. november 2023.
- **To unnatak frå NLOD:** (1) data under `v1/shipinfo` — ordrett, med kjelda sine eigne skrivefeil: «Data under v1/shipinfo is not under NLOD, but has a commecial lisence.» (2) Innhald som krev særleg tilgang: «Der deler av innholdet i APIet krever særlig tilgang ... er disse dataene ikke å regne som lisensiert under NLOD.» Begge har verknad for eventuell vidaredistribusjon.

### Restriksjonar

- **Namn:** «you cannot use BarentsWatch as a part of the service name.» Du kan heller ikkje lage noko som ser ut som det er laga av BarentsWatch.
- **Innhald:** «Du kan ikke endre på innholdet i data som leveres.» Gjeld òg dei opne OLEX-endepunkta.
- Ikkje bruk på pornografiske/rasistiske sider eller sider som bryt norsk lov.
- **Udokumenterte endepunkt er forbodne:** «There might be endpoints in the API that are not mentioned in this documentation. Those endpoints are most likely used by the BarentsWatch.no portal and might change without notice. They should not be used by others.» Altså: ikkje skrap nettverkstrafikken frå barentswatch.no.

### Kommersiell bruk

Lov: «You may use data from BarentsWatch commercially as long as you follow the guidelines.» Reklame på sida er lov. Vidaredistribusjon er lov med kreditering. Ved kommersiell bruk ber dei om upersonleg kontakt-e-post, kontaktperson, selskap og formål.

### Rate limits

- **Ingen tal er publiserte nokon stad.** Null treff på 429, «rate limit», «ratelimit», «Retry-After», «X-RateLimit», «throttl» og «quota» i heile 675 kB-spesifikasjonen, og ingenting i dokumentasjonen.
- **Men fråvær av dokumentasjon er ikkje fråvær av struping.** Same spesifikasjon manglar òg 401 og 403, sjølv om 401 er den faktiske oppførselen. Serverside-struping kan finnast og vil først vise seg under last.
- Den einaste konkrete regelen: batch-nedlastingar skal gjerast **sekvensielt i éin tråd, ingen parallelle nedlastingar**. Gjentatt to stader. Gjeld langvarige batch-jobbar, ikkje sluttbrukarklientar.
- Spenning i BarentsWatch si eiga dokumentasjon: intro seier «BarentsWatch imposes no formal requirements on the load that third party tools add to the API», medan vilkåra seier at høgtrafikk krev førehandskontakt og kan gi handteringskostnader. Les dei saman. Ingen tal er oppgitt for kva «høgtrafikk» tyder eller kva det kostar — må avklarast med post@barentswatch.no.

---

## 7. Marknad: kva finst frå før

> **⛔ DETTE MANGLAR HEILT I DATAGRUNNLAGET.** Det ligg ingen marknadskartlegging i materialet. Eg kan ikkje seie noko om konkurrentar, prisar eller eksisterande produkt utan å finne det på.

Det einaste marknadsrelevante som ligg i materialet, henta frå kjeldene sjølve:

- **BarentsWatch løyser allereie delar av oppgåva sjølv.** Dei driftar tenesta `www.barentswatch.no/fiskehelse`, og API-et deira leverer ferdige aggregat vi elles måtte rekna ut: `localitiesoverlimitbyweek` (tal lokalitetar over lusegrensa per veke) og eit nasjonalt vekesamandrag med 18 felt, inkludert prosentdelar over/under grensa.
- Om AIS-rapporten stemmer, har BarentsWatch **òg** ferdig utrekna fartøybesøk per lokalitet med brønnbåt-flagg. Det er kjernen i ein tenkt varslingsfunksjon — allereie løyst av kjelda.
- Vilkåra tillèt kommersiell bruk, men forbyr «BarentsWatch» i tenestenamnet.

Ei ekte marknadskartlegging må gjerast før fase 1.

---

## 8. AVVIK FRÅ OPPDRAGET

Dette er den viktigaste seksjonen. Kvart punkt er ein stad der dokumentasjonen motseier ein antaking i oppdragsteksten.

**Om tilgang og registrering**

1. **Fiskehelse-API-et er ikkje heilt bak innlogging.** Det finst 13 opne `anonymous*`-endepunkt som gir HTTP 200 utan token. Men dei gir berre OLEX-kartplotterformat, og inneheld **ingen lusetal** — berre sjukdom, soner og geometri. For lakselus treng vi framleis token.
2. **Registrering skjer ikkje på «utviklarportalen».** developer.barentswatch.no er berre dokumentasjon (Docusaurus). Klientregistreringa ligg på `barentswatch.no/minside` under «Utviklertilganger».
3. **Client secret blir ikkje generert for deg — du vel det sjølv.** Det er eit passord du skriv inn. Ingen offentleg dokumentasjon seier om det kan roterast eller hentast fram att.
4. **To lenker i BarentsWatch sin eigen dokumentasjon er daude:** `/om/api-vilkar` (lenka frå docs/intro og docs/appreg) og `/om/apnedata/` (lenka frå den norske vilkårssida, nettopp der ho forklarer kvar du skal registrere deg). Den engelske vilkårssida har same problem. Levande adresser: `/artikler/apnedata/` og `/artikler/api-vilkar/`.

**Om geodata**

5. **Sonene krev ikkje token.** Oppdraget gjekk ut frå at ein måtte gjennom BarentsWatch-API-et. Den opne WFS-en gir same sonegeometri som GeoJSON utan konto, nøkkel eller hemmelegheiter å handtere. REST-vegen er den tyngre, ikkje den einaste.
6. **CRS er EPSG:4326 overalt, ikkje UTM33.** Ordet «UTM» og talet «25833» har **null** treff i heile 675 kB-spesifikasjonen. Alle 29 WFS-laga har DefaultSRS 4326. UTM33 finst berre som reprojeksjon på førespurnad via `srsName`.
7. **Produksjonsområde finst ikkje brukande hos BarentsWatch.** `/v1/geodata/productionarea` er både deprecated og bak token, og det finst ikkje noko PO-lag i WFS-en. Kjelda er **Fiskeridirektoratet** — ei anna etat enn oppdraget peika på.
8. **«Kontrollsone» er ikkje eit omgrep i dataa.** Forskriftene heiter anten «kontrollområde» (40 av 102) eller «restriksjonssone» (62 av 102), og API-et bruker eit tredje sett kodenamn. Du kan ikkje søke på «kontrollsone».
9. **Veterinærinstituttet har ikkje eit eige API.** Dei er datakjelde bak BarentsWatch sitt lokalitet-med-sjukdom-lag; sonene eig Mattilsynet. Det finst ikkje noko «Veterinærinstituttet-API» å kalle.

**Om datamodellen**

10. **`has_fish` finst ikkje.** Strengen har 0 treff. Nærmaste er `isFallow`, som er avleidd (fire veker utan rapport), ikkje målt.
11. **«MTB» finst ikkje.** 0 treff. Kapasitet er `capacity` (double) + `unit` (streng, døme «TN»). Eininga er data, ikkje ein antaking.
12. **Lusegrense per lokalitet finst ikkje i JSON.** Berre som udokumenterte strengar i CSV-eksporten, og som filterskildringar (0,5 / 0,2).
13. **v2-vekelista er POST, ikkje GET.** `/v2/geodata/fishhealth/locality/{year}/{week}` tek filter i JSON-body. Same for det nasjonale v2-endepunktet. Berre v1 er GET med query-parametrar. (Detalj-endepunktet for éin lokalitet er derimot GET i både v1 og v2.)
14. **Rensefisk-serien er broten.** Ingen data etter veke 16, 2018. Behandlingsformatet endra seg i 2024. ILA/PD-saker er delte ved veke 44 i 2020. Alle lange tidsseriar har regimeskifte.

**Om AIS (uverifisert, sjå seksjon 4)**

15. **Ikkje same token som fiskehelse.** Eigen AIS-klient, scope `ais`. To klientar, to token. *(Denne er stadfesta via autentiseringsrapporten.)*
16. Feltnamna skal vere `latitude`/`longitude`/`speedOverGround`/`courseOverGround`/`imoNumber`, ikkje `lat`/`lon`/`sog`/`cog`/`imo`.
17. Det finst ingen open nedlastings-URL for historiske Kystverket-data — berre eit bestillingsskjema med e-postlevering.
18. AIS `shipType` kan ikkje identifisere brønnbåt. Kodelista 0–99 har ingen slik kode.

**Om metode**

19. **Ein OpenAPI-spesifikasjon er ikkje fasit på oppførsel.** Fishhealth-spesifikasjonen deklarerer ingen 401 og ingen 403, sjølv om 401 er det reproduserbare svaret på kvart uautentisert kall. «Ingen 429 i spesifikasjonen» er difor bevis for at struping ikkje er *dokumentert*, ikkje for at ho ikkje *finst*.

---

## 9. MÅ AVKLARAST MED EIT EKTE KALL

**Ingenting i dette dokumentet er testa med eit ekte token.** Ingen av kontrollrundane logga inn. Det er hovudrisikoen i fase 0.

### 9.1 Krev token (Sondre må registrere klient først)

| Spørsmål | Nøyaktig kall som svarar på det |
|---|---|
| Opnar scope `api` verkeleg alle 128 operasjonane? | `GET /v1/geodata/fishhealth/localities` med Bearer-token. Deretter eitt kall per endepunktfamilie. |
| Kva er reell token-levetid? | Les `expires_in` frå svaret på `POST https://id.barentswatch.no/connect/token`. Ikkje hardkod 3600. |
| Kva inneheld `liceLimit` og `aboveLiceLimit` — «0,5» eller «Ja»/«Nei»? | `GET /v1/geodata/download/fishhealth?reporttype=Lice&filetype=Csv&fromyear=2025&fromweek=1&toyear=2025&toweek=5` og les kolonna. |
| Kor langt tilbake går vekedata for lakselus? | `GET /v1/geodata/fishhealth/locality/{localityNo}/avgfemalelice/{year}` for fallande årstal til det blir tomt. Spesifikasjonen seier ingenting; berre statistikk-endepunkta er dokumenterte «from year 2012». |
| Når startar sonehistorikken i REST-API-et? | `GET /v1/geodata/fishhealth/ilacontrolarea/firstvaliddate` og `/pdcontrolarea/firstvaliddate`. (Den opne WFS-en går tilbake til 2016-04-07 for overvakingssoner.) |
| Kva inneheld `ruling` og resten av eksport-DTO-en? | `GET /v1/geodata/download/fishhealth/preview` — **ikkje** `/download/fishhealth`, som deklarerer tomt 200-innhald. Alle 22 feltskildringane i den DTO-en er tomme strengar. |
| Kva strengverdiar tek `subType` i `/v3/.../disease`? | `GET /v3/geodata/fishhealth/locality/{localityNo}/disease`. Feltet er ein **fri streng**, ikkje ein enum — SAV2/SAV3-enumen ligg i eit foreldrelaust skjema som ingen sti peikar på. Ikkje bygg på ei lukka verdiliste. |
| Verkar `format=geojson` på dei autentiserte nedlastingane? | `GET /v1/geodata/download/ilaprotectionzone?format=geojson` med token. `format` er berre `{"type":"string"}` utan enum. |
| Er det struping i praksis? | Mål empirisk under last. Ingen dokumentasjon finst. |
| Kva form har dei to POST-endepunkta sine request-body? | `POST /v2/geodata/fishhealth/locality/{year}/{week}` med `LocalityReportQueryV2`. Ikkje undersøkt. |

### 9.2 Krev at eit menneske ser på ei nettside

| Spørsmål | Kva som må gjerast |
|---|---|
| Kva står i registreringsskjemaet på minside? | Sondre loggar inn på `barentswatch.no/minside` og les. Berre feltet «Formål» er kjent frå dokumentasjonen. |
| Kor mange klientar kan ein ha? Kan secret roterast? | Same. Udokumentert offentleg. |
| Kva kostar «handteringskostnader», og kva er «høgtrafikk»? | Send e-post til post@barentswatch.no. Ingen tal er publiserte. |
| Trengst det databehandlaravtale ved kommersiell bruk? | Ikkje nemnt i nokon av vilkårssidene. Må spørjast om. |

### 9.3 Kan avklarast utan token (bør gjerast tidleg)

| Spørsmål | Kall |
|---|---|
| Kor ofte blir WFS-laga oppdaterte? Finst SLA? | Mål `sistendret` over nokre veker. Ingen dokumentasjon finst; WFS-en er ikkje dekt av OpenAPI-spesifikasjonen. |
| Er WFS og REST i synk? | Kryssjekk same forskrift i begge når vi har token. Vi veit alt at WFS (`2026-03-16Z`) og OLEX («Gyldig fra: 2026-03-15») er **usamde med éin dag**. |
| Oppfører alle 13 anonyme OLEX-endepunkta seg likt? | Testa: alle 13 gir HTTP 200 gzip. Men berre `anonymousilaprotectionzone` er testa heilt ut (nedlasta, pakka opp, lesen). |
| Er PD-sonelaga dokumenterte på geonorge.no? | Søk i Geonorge. Dei står **ikkje** i BarentsWatch si eiga opne-data-tabell, så dei har ingen dokumentert støttegaranti. |

### 9.4 Heile kartleggingar som manglar

| Manglar | Kva som må gjerast |
|---|---|
| **AIS-rapporten har ingen motbevis-dom.** | Alt i seksjon 4 må faktasjekkast. Konkret, i denne rekkjefølgja: (1) Finst `/v1/geodata/fishhealth/locality/{localityNo}/vessel/{year}/{week}` verkeleg i `openapi.json`? Grep i fila vi alt har. (2) Stemmer feltnamna mot `https://live.ais.barentswatch.no/live/openapi/ais/openapi.json`? (3) Svarar Kystdatahuset sine endepunkt verkeleg utan token? |
| **Regelverk: lusegrense og rapporteringsfrist.** | Ingen rapport i datagrunnlaget. Treng eiga kartlegging mot Lovdata. Ikkje bygg noko som treng grensa før dette er gjort. |
| **Marknad.** | Ingen rapport i datagrunnlaget. Treng eiga kartlegging. |
