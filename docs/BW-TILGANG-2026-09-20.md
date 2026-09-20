# BarentsWatch: kva Oppdretter kan hente utan konto

Kontrollert 20. september 2026 med offisiell dokumentasjon, ei fersk komplett OpenAPI-spesifikasjon og offentlege WFS-kall. Dette er tilgangskartlegging, ikkje eit løfte om at alle lag er integrerte. Kode er ikkje endra i denne undersøkinga.

## Prioritet for «lus i fjorden»

Den sterkaste nye opne kjelda er **BarentsWatch sine ILA 10-km-ringar**. Ho kan visast saman med lusetal frå Mattilsynet, sjøtemperatur, rapporterte behandlingar, PD-/ILA-soner og fartøy som appen allereie hentar. Ein ring eller eit nærliggjande anlegg med lus er ikkje ein validert modell for smittepress eller dokumentasjon på smitteoverføring.

### Verifisert nedlasting av ILA 10-km-ringar

- [GetFeature, GeoJSON](https://geo.barentswatch.no/geoserver/ows?service=WFS&version=2.0.0&request=GetFeature&typeNames=bw%3Aisa10kmcircle&outputFormat=application%2Fjson)
- [DescribeFeatureType, skjema](https://geo.barentswatch.no/geoserver/ows?service=WFS&version=2.0.0&request=DescribeFeatureType&typeNames=bw%3Aisa10kmcircle)
- Ingen konto eller nøkkel. Faktisk svar: seks `Polygon`, `numberMatched=numberReturned=6`, EPSG:4326, koordinatrekkjefølgje lengdegrad/breiddegrad.
- Alle seks har `year: 2026`, `week: 38`. Hentetid i WFS-svaret: `2026-09-20T18:37:09.754Z`.
- Faktiske eigenskapar: `id` heiltal, `localityno` heiltal, `name` tekst, `year` heiltal, `week` heiltal. XSD annonserer ikkje `name`, sjølv om det er med i svaret; behandl namnet som valfritt.
- Lokalitetar: 11272 Øksengård; 12625 Bjørgan; 13811 Breivika; 24695 Årnes; 31837 Sørfjorden Stamfiskanlegg; 32397 Storvika I Skjerstadfjorden.
- Tilrådd identitet i appen: kombinasjonen lokalitetsnummer, år og veke. GeoJSON-funksjons-ID og løpenummer `id` treng ikkje vere stabile over tid.
- Vis som **«ILA 10-km-ring · BarentsWatch · veke 38»**. Luserapportane kan samtidig gjelde veke 37. Ikkje kall alt «veke 37» berre fordi det er appen si luseveke.
- Ingen historikkparameter er annonsert for dette laget. Arkiver eigne daterte snapshot dersom historikken skal visast; ikkje presenter dagens ring som historisk sone.

BarentsWatch si [offisielle bruksrettleiing](https://www.barentswatch.no/veiledning/fiskehelse-forklaring-og-bruksanvisning/) forklarer at ringane vert laga automatisk rundt relevante ILA-lokalitetar. Visingsregelen skil mellom mistanke, påvist sjukdom og tømming. Ringane skal gjere aktørar merksame på smittefare og særskilde eksportkrav. Dei er **ikkje det same som formelle verne- eller overvakingssoner**. Behald derfor eigne teiknforklaringar.

## Andre BarentsWatch-lag som er offentlege utan klient

[WFS GetCapabilities](https://geo.barentswatch.no/geoserver/ows?service=WFS&version=2.0.0&request=GetCapabilities) gav 29 annonserte lag. Lista inneheld ikkje lus, rømming, B-/C-undersøkingar eller biomasse. Relevant havbruksinnhald:

| Lag | Tilgang og viktige felt | Datadato/dekning |
|---|---|---|
| `bw:localitywithila` | GeoJSON punkt. `lokalitetsnummer`, `lokalitetsnavn`, `sykdommer`, `mistankedato`, `paavistdato`, `tomtdato`, `version` | Ekte svar 20.09 kl. 18:36 UTC: 17 punkt. Dette er kjelda sitt aktuelle sjukdomslag, ikkje eit uttømmande historisk sakarkiv. |
| `bw:localitywithpd` | Punkt. Same identitet; mistanke/påvising splitta på `pd_ukjent_*`, `pd_sav2_*`, `pd_sav3_*`; dessutan `tomtdato` | Ekte svar 20.09 kl. 18:36 UTC: 31 punkt. |
| `bw:ilaprotectionzone`, `bw:ilasurveillancezone` | Formelle ILA-verne- og overvakingssoner. `id`, `forsknr`, `forsknavn`, `forsklink`, `sistendret`, `fromdate`, `todate`, `originaldate`, `version` | Historiske og gjeldande objekt kan liggje i same lag. Bruk gyldigheitsdatoar. Allereie kjelder i prosjektet. |
| `bw:pdprotectionzone`, `bw:pdsurveillancezone` | Tilsvarande for PD | Same varsemd om gyldigheitsdatoar. Annonserte i ferske capabilities. |
| `bw:pdzone`, `bw:pdzone_borders` | Nasjonale PD-soner og grenser | Annonserte i ferske capabilities. Nasjonal sone er ikkje eit individuelt sjukdomstilfelle. |
| `bw:isa10kmcircle` | Automatisk ring for aktuelle ILA-lokalitetar | Direkte kontrollert ovanfor; år/veke i kvar post. |

Bruk det same GetFeature-mønsteret som for ringane, med rett `typeNames`. Kall kvart lag for seg. Ein `tomtdato` er dato for tømming, ikkje utan vidare datoen då ei sak vart avslutta eller ei friskmelding. BarentsWatch si rettleiing skil eksplisitt mellom «Tømt» og «Avsluttet».

## Fiskehelse/AquaInfo som krev gratis registrert klient

Fersk [OpenAPI](https://www.barentswatch.no/bwapi/openapi/fishhealth/openapi.json) vart henta komplett (677 274 byte): 128 stiar og global sikkerheit `oauth2: api`. Basis-URL under er `https://www.barentswatch.no/bwapi`. [Autentiseringsrettleiinga](https://developer.barentswatch.no/docs/appreg/) krev eigen brukar og registrert API-klient. Det er ikkje noko som skal omgåast. Ingen klient vart oppretta i denne kontrollen.

| Tema | Dokumentert endepunkt | Feltskjema og dekning | Kontroll |
|---|---|---|---|
| B-miljøstatistikk per lokalitet | `/v1/geodata/locality/{localityNo}/momb` | Liste med `year`, `condition`, `count`. Condition: `VeryGood`, `Good`, `Poor`, `VeryPoor`. Dokumentert frå 2012. Dette er årleg statistikk, ikkje full enkeltundersøking. | Eit anonymt kall for lokalitet 12067 gav **HTTP 401**. Ingen ny prøve utan gyldig tilgang. |
| Rømmingsstatistikk per lokalitet | `/v1/geodata/locality/{localityNo}/farmedfishescapes` | `year`, `count`, dokumentert frå 2012 | Eit anonymt kall for 12067 gav **HTTP 401**. |
| Rømmingsdetaljar per år | `/v1/geodata/fishhealth/locality/{localityNo}/escape/{year}` | `localityNo`, `year`, `data[{week,escapes[]}]`. Detaljar omfattar dato, art, tal/estimat, storleik, kommentar, status, lokalitet og endringstid. | Dokumentert OAuth; ikkje testa med klient. |
| Miljøundersøkingar per kommune | `/v1/geodata/municipality/{municipalityNumber}/environmentalsurveys` | `municipalityNumber`, `year`, `type`, `count` | Dokumentert årleg kommuneaggregat. Ikkje ein C-rapportdatabase. |
| B-tilstand per kommune | `/v1/geodata/municipality/{municipalityNumber}/momb` | `municipalityNumber`, `year`, `condition`, `count`, dokumentert frå 2012 | Krev klient etter dokumentasjonen. |
| Full vekeleg fiskehelse | `/v1/geodata/fishhealth/locality/{localityNo}/{year}/{week}` | LocalityReportV1 med lus, behandlingar, temperatur og lokalitetsdetaljar. Dokumentasjonen seier nattleg oppdatering og rensefiskstopp etter veke 16/2018 i dette datasettet. | Krev klient. Mattilsynet er allereie ei open originalkjelde til fleire av felta. |
| Sjukdomshistorikk | `/v3/geodata/fishhealth/locality/{localityNo}/disease` og variant med `/{year}` | Historiske saker per lokalitet | Krev klient. Direkte Mattilsynet-API gir offentlege sjukdomssaker utan BW-klient. |
| Luse-/temperatur-/behandlingshistorikk | `/v1/geodata/fishhealth/locality/{localityNo}/avgfemalelice/{year}`, `seatemperature/{year}`, `liceTreatments/{year}` | Årsseriar. Generell Fiskehelsehistorikk tilbake til 2012; enkelte felt har seinare start/brot. | Krev klient. Ikkje lov full 2012-historikk frå Mattilsynet v2 utan å kontrollere dekninga. |
| Fartøybesøk | `/v1/geodata/fishhealth/locality/{localityNo}/vessel/{year}/{week}` og årsvariant | Registrerte passeringar/besøk med BW sine eigne definisjonar | Krev klient. Appen sitt «nær anlegg»-treff er ei anna berekning og må merkast slik. |
| CSV/XLSX fiskehelse | `/v1/geodata/download/fishhealth` | Rapporttype og filformat; vanleg autentisert nedlasting | Krev klient. Det at ei fil kan lastast ned av ein innlogga brukar gjer ikkje dette til eit anonymt API. |

[AquaInfo](https://www.barentswatch.no/artikler/apnedata/) ligg i same API og har kommuneindikatorar for kapasitet, areal, løyve, miljø, Havbruksfond m.m. «Maksimalt tillaten biomasse» er eit løyvetak og **ikkje faktisk biomasse eller fiskemengd no**. Det avleidde fiskehelsefeltet `isFallow` er heller ikkje sikker sanntidsdokumentasjon på tomme merdar.

API-et annonserer også 13 uttrykkeleg anonyme OLEX-nedlastingar for sjukdom, soner og lokalitetsgeometri. Dei er kartplotterformat, ikkje ein anonym inngang til luserapportar, rømming eller AquaInfo-statistikk. Dei vart kartlagde i prosjektet tidlegare; det vart ikkje gjort 13 nye fullnedlastingar no.

## Same offentlege originaldata utan BW-konto

Fiskeridirektoratet si [oversikt over opne og sensitive data](https://www.fiskeridir.no/statistikk-tall-og-analyse/apne-og-sensitive-data) listar B- og C-undersøkingar, andre miljøundersøkingar og rømmingsmeldingar som offentlege. Biomasseregisteret per lokalitet er lista som unntatt offentlegheit. Integrasjon frå originalkjelda er ikkje data henta via BarentsWatch og skal krediterast deretter.

To offisielle GIS-servicekatalogar vart henta utan innlogging og gav gyldig metadata:

- [Miljøtilstand FeatureServer](https://gis.fiskeridir.no/server/rest/services/Yggdrasil/Milj%C3%B8tilstand/FeatureServer?f=json): lag 0 B-undersøkingar, 1 historiske B-undersøkingar, 2 C-undersøkingar, 3 strandsone, 4 straum, 5 andre miljøundersøkingar, 6 miljøgift, 7 alternative B-undersøkingar. Katalogen gjev grunnlag for vidare avgrensa query. Raddatoar, full dekning og feltskjemaa vart ikkje testa i denne oppfølginga etter at arbeidet vart prioritert mot fjord/lus og ILA-ringar.
- [Rømming FeatureServer](https://gis.fiskeridir.no/server/rest/services/Yggdrasil/R%C3%B8mming/FeatureServer?f=json): lag 0 Rømming. Same avgrensing: metadata er verifisert, ferskaste hending og full dekning er ikkje kontrollert i denne runden.
- Fiskeridirektoratet lenkjer sjølv til [B-undersøkingar sitt offentlege API](https://api.fiskeridir.no/envreportreg-public/swagger-ui/index.html). Vidare gjennomgang av API-et kan gjerast ved ei eiga miljøutviding.

## Lisens og publisering

BarentsWatch si [Fiskehelse-dokumentasjon](https://developer.barentswatch.no/docs/fishhealth/) seier NLOD frå relevante dataeigarar og krev at brukarane kjenner datagrunnlaget. Ho åtvarar om at `v1/shipinfo` har kommersiell lisens og ikkje er under NLOD. Batchnedlasting skal skje i éin tråd.

[BarentsWatch sine bruksvilkår](https://www.barentswatch.no/artikler/api-vilkar/) krev synleg «Data levert av BarentsWatch», namngjeving av eigaren og tydeleg skilje frå eit offisielt BW-produkt. Vanleg API-tilgang er gratis; høg trafikk/overbelasting kan gi handteringskostnader. Ingen betalt teneste er lagt til.

[Fiskeridirektoratet sin lisensside](https://www.fiskeridir.no/statistikk-tall-og-analyse/lisens-for-bruk-av-fiskeridirektoratets-data) krev NLOD og til dømes «Kjelde: Fiskeridirektoratet». Dataeigaren må ikkje framstå som om han godkjenner appen.
