# API-funn del 2 — regelverk, marknad og kva som er igjen

Fase 0, prosjekt «oppdretter». Skriven 10. september 2026.
Del 1 dekte autentisering, fiskehelse-API, soner/geografi og lisens. Dette er hola.

Alt som står under **Fakta** har overlevd ein motbevis-runde der kjeldene vart opna på nytt og lesne ordrett. Alt som fall, eller som aldri vart stadfesta, ligg i **§ 7 Må framleis avklarast** eller er merkt eksplisitt i teksten.

---

## Kort for ein ikkje-teknisk lesar

- **Det ubehagelege først: mesteparten av produktet finst allereie.** Av dei ti hendingsreglane vi planla, leverer BarentsWatch tre heilt ferdig, tre er ein enkel utrekning på data vi får utlevert komplett, éin har ingen open datakjelde i det heile, og berre to krev noko ingen andre har bygd.
- **Det einaste som verkeleg manglar i heile Noreg er push.** BarentsWatch, Fiskeridirektoratet og Kystverket publiserer alle *tilstand* — korleis det står til akkurat no. Ingen av dei sender deg beskjed når noko endrar seg. BarentsWatch har til og med ein favoritt-liste-funksjon, så sjølve utvalet av anlegg finst gratis. Det som manglar er meldinga.
- **Lusegrensa kan vi rekne ut sjølve, og ho er ikkje ein konstant.** 0,5 vaksne holus til vanleg, 0,2 i eit vårvindauge — men vindauget ligg fem veker seinare i nord enn i sør. Eit system som brukar éin grense for heile landet vil ta feil kvar einaste vår.
- **Målgruppe B (leverandørane) er den svakaste delen av planen.** Dei rike søknadsdataa — kor mykje MTB nokon søkjer om, kor mykje fôr og kva slags not — ligg bak innlogging hos Fiskeridirektoratet og er ikkje opne. Det som er ope, gir omtrent 13 nye søknader i månaden, og over halvparten manglar lokalitetsnummer.
- **Bota som skulle drive innkjøpa verkar ikkje.** Mattilsynet si eiga klagesakseining har konkludert med at tvangsmulkta er lågare enn det oppdrettaren tener på å la fisken stå, og frå 2. juli 2026 reagerer dei ikkje lenger automatisk på ei enkelt overskriding. «Du får bot om du ikkje handlar no» er ikkje eit ærleg salsargument lenger.
- **Ingen har bygd dette før — men ein annan nordmann har prøvd.** Repoet `jernjan/aqua-shield-0.1` ser ved første augekast ut som eksakt vårt produkt. Vi las koden: SMS-funksjonen skriv berre til skjermen, den planlagde nattkøyringa planlegg ingenting, og sjøtemperaturen er eit tilfeldig tal. Det er stillas, ikkje ein konkurrent.
- **Alt datagrunnlaget er gratis og lovleg å selje vidare.** BarentsWatch, Fiskeridirektoratet og Brønnøysund ligg alle under NLOD, som uttrykkeleg tillèt kommersiell bruk mot at vi namngjev kjelda. Null kroner i månaden for datalaget.
- **Éin ting til: mange anlegg blir drivne av fleire selskap saman.** 471 av 1 777 lokalitetar har meir enn eitt organisasjonsnummer, opptil ni. Spørsmålet «kven skal eg ringje?» er difor ikkje avgjort av registeret åleine.

---

## 1. Lusegrensa og rapporteringsfristen

### Gjeldande forskrift

**FOR-2012-12-05-1140 — «Forskrift om bekjempelse av lakselus i akvakulturanlegg»**, korttittel **«Forskrift om lakselusbekjempelse»**.

| | |
|---|---|
| I kraft | 01.01.2013 |
| Formelt sist endra | FOR-2023-12-14-2087 |
| **Sist endra i substans** | **FOR-2017-03-06-275, i kraft 06.03.2017** |
| Status per 9.9.2026 | Gjeldande (ligg under SF, ikkje SFO) |
| Alle endringar | 242/2016, 275/2017, 674/2018, 2087/2023 |

**Viktig nyanse:** endringa frå desember 2023 rører ikkje lusereglane. Ho endrar berre § 2 andre ledd — ei krysstilvising til dyrehelseforskriften og akvabiosikkerhetsforskriften. Det er datoen **6. mars 2017** som skal stå i ei `regel_versjon`-kolonne, ikkje 2023.

### Grensa per periode (§ 8)

Grensa er eit **anleggssnitt** av vaksne holus per fisk, og ho gjeld «til en hver tid».

| Region (§ 8-ordlyd) | Veke 14 | 16 | 19 | 21 | 22–26 | 27 | Elles |
|---|---|---|---|---|---|---|---|
| **«Nord-Trøndelag og sørover»** | 0,5 (men 20-fisk-teljing startar) | **0,2** | 0,2 | **0,2** | 0,5 | 0,5 | 0,5 |
| **«Nordland, Troms og Finnmark»** | 0,5 | 0,5 | 0,5 (20-fisk-teljing startar) | **0,2** | **0,2** | 0,5 | 0,5 |

Presist:

- **Sør:** 0,2 frå måndag i veke 16 til sundag i veke 21. 0,5 frå veke 22 til veke 15.
- **Nord:** 0,2 frå måndag i veke 21 til sundag i veke 26. 0,5 frå veke 27 til veke 20.
- **Veke 21 er 0,2 i begge regionar.** Veke 22–26 er 0,5 i sør og 0,2 i nord. Det er der eit naivt system bommar.
- Ingen veker fell utanfor.

**Unntak (§ 8 fjerde ledd):** «Mattilsynet kan gi tillatelse til en høyere grense for lakselus for stamfisk det siste halve året den står i sjøen.» Ein stamfisklokalitet kan altså liggje lovleg over grensa. BarentsWatch viser berre dei generelle grensene, og seier det sjølv i FAQ-en. Eit varsel som flaggar ein slik lokalitet er ein falsk positiv — og ein oppdrettar som blir feilaktig utheva som lovbrytar er ein tapt kunde.

### Kan vi rekne ut grensa sjølve?

**Ja, og det er trivielt.**

Forskrifta brukar **gamle fylke**, ikkje produksjonsområde 1–13. Produksjonsområda styrer trafikklyssystemet, ikkje § 8. Mappinga er rein:

| Fylkesnummer | Region |
|---|---|
| 18 Nordland, 55 Troms, 56 Finnmark (historisk 19, 20, og 54 i 2020–2023) | **Nordregelen** |
| Alt anna | **Sørregelen** |

Trøndelag vart danna 1.1.**2018** av Nord-Trøndelag (17) og Sør-Trøndelag (16). Begge låg på sørsida av § 8-skiljet, så samanslåinga flytta ingen kommunar over linja. Merk at fylke **54 «Troms og Finnmark» berre eksisterte 2020–2023** — ein oppslagstabell som framleis ventar 54 på ferske data vil droppe heile nordgruppa.

BarentsWatch reknar òg ut grensa sjølve, i felta `liceLimit` og `aboveLiceLimit`. Men — sjå § 7 punkt 1 — desse er berre dokumenterte på førehandsvisings-endepunktet (10 rader), ikkje på sjølve nedlastinga, og eksporten krev token. Rådet er difor: **eig regelmotoren sjølv, og bruk BarentsWatch som kryssjekk når token er på plass.** Avvik mellom oss og dei er i seg sjølv eit signal verdt å granske.

### Teljing og rapportering

| Krav | Paragraf | Innhald |
|---|---|---|
| Teljefrekvens | § 6 andre ledd | Minst kvar **7. dag** ved ≥4 °C. Minst kvar **14. dag** under 4 °C. Stamfisk unnateke under 4 °C. |
| Sjøtemperatur | § 6 første ledd | Målast på **tre meters djup**, minst kvar veke. Temperaturen avgjer sjølv teljefrekvensen. |
| Unntak frå teljing | § 6 tredje ledd | Fell bort dersom **all** fisken i anlegget skal slaktast ut innan 14 dagar. |
| Talet på fisk | Vedlegg 1 pkt. 2 og 3 | **20 fisk** frå alle merder: veke 14–21 (sør), veke 19–26 (nord). Elles **10 fisk**. Teljekravet skjerpast **to veker før** grensa fell. |
| Utrekning | Vedlegg 1 pkt. 6 | **Uvekta** snitt av merdsnitta. Ein liten merd tel like mykje som ein stor. |
| Rapporteringsfrist | § 10 | Til Mattilsynet seinast **tysdag i næraste påfølgjande veke**. |
| Kanal | — | Altinn-skjemaet «Vekentleg rapportering av lakselus», eller Mattilsynets API. Feilretting krev at **heile** skjemaet for veka blir sendt inn på nytt: «Det nyaste rapporterte skjemaet blir lagt til grunn.» |

**Konsekvens for oss:** varselet må gå **tysdag kveld eller onsdag morgon**, ikkje måndag. Data for veke N er først komplette etter tysdag i veke N+1.

**Konsekvens 2:** manglande lusetal er ikkje automatisk brot. Om vinteren halverast teljeplikta under 4 °C, og eit anlegg som skal tømast heilt er fritatt. Men merk klagesak 2025/322220, avgjort 20.02.2026: **utslakting av enkeltmerder gir ikkje fritak** — unntaket krev at all fisken i anlegget skal slaktast innan 14 dagar. Eit anlegg som sluttar å rapportere medan det framleis har fisk i andre merder er eit brot, ikkje eit utslaktingssignal.

### Kva skjer ved overskriding

**Ingenting automatisk.** § 8 tredje ledd seier berre: «Det skal gjennomføres tiltak for å sikre at mengden lakselus ikke overskrider grensene i første og andre ledd, herunder om nødvendig utslakting av fisk.» Ingen frist, ingen automatisk pålegg.

**Ikkje lov «pålegg innan X dagar» til kunden.** Den 14-dagars behandlingsfristen mange hugsar stod i den opphevde 2009-forskrifta og fall bort 1.1.2013. Ei slik påstand i produktet er direkte feil og øydelegg truverdet hos folk som kan regelverket.

**Mattilsynet, publisert 02.07.2026:** «Vi reagerer ikkje lenger automatisk ved enkeltståande overskridingar.» Det som utløyser oppfølging er gjentekne eller langvarige overskridingar, svært høge tal, velferdskonsekvensar, eller manglande/feil rapportering. Same side: «Dersom grensa blir overskriden, skal du sette inn tiltak omgåande, utan å vente på varsel frå Mattilsynet.»

**0,3-regelen (Mattilsynet, publisert 06.04.2022):** fordi låge tal gir falske positive og negative, handhevar Mattilsynet 0,2-grensa slik:

- 0,3 eller høgare **éin gong** → handheva som over 0,2.
- Mellom 0,2 og 0,3 **tre etterfølgjande teljingar** → handheva som over 0,2 ved alle tre.
- Under 0,3 ein eller to gonger → handheva som under 0,2.

Merk ordet **teljingar**, ikkje veker. Under 4 °C er teljeplikta kvar 14. dag, så tre teljingar kan spenne seks veker. Ein detektor som ser etter tre kalenderveker vil bomme.

Same side stadfestar vårovervekta: «Overskridingar om våren og forsommaren vil då vege tyngre enn overskridingar resten av året.»

**Tvangsmulkt (§ 12):** folketrygdas grunnbeløp delt på 36,5, per påbegynte 10 000 fisk, per dag — og først frå fristen i eit **enkeltvedtak** går ut. Med G = 136 549 kr (frå 1.5.2026) blir det 3 741 kr per 10 000 fisk per dag. Eit faktisk vedtak frå 2019 lydde på 333 771 kr per dag (= 122 einingar).

**Men:** Mattilsynet si eiga klagesakseining har konkludert med at «beregningsmodellen for tvangsmulkt i forskriften om lakselusbekjempelse § 12 ikke lenger var effektiv som det pressmiddelet det var ment å være» — mulkta er lågare enn forteninga ved å la fisken stå. Kombinert med at automatisk reaksjon fall bort 02.07.2026: **verken bot eller pålegg er ein truverdig kjøpsutløysar.** Trend og vedvarenheit er det einaste som står att.

### Har grensa endra seg sidan 2012?

Ja, tre gonger, og backfill er difor farleg.

| Periode | Regime |
|---|---|
| **2012** (FOR-2009-08-18-1095, oppheva 1.1.2013) | **Tiltaksgrenser**, ikkje absolutt grense: meir enn 0,5 holus *eller* meir enn tre bevegelege, 1.1–31.8; meir enn 1 holus eller fem bevegelege, 1.9–31.12. Eksplisitt **14-dagars behandlingsfrist**. Teljefrekvens: kvar 14. dag ved 4–10 °C, kvar 7. dag ved ≥10 °C, ingen plikt under 4 °C. Rapporterte **ikkje** fastsitjande stadium. I tillegg gjaldt mellombels FOR-2011-12-19-1401 våren 2012 (0,1 bevegelege + holus, Rogaland t.o.m. Nordland). |
| **1.1.2013 – 5.3.2017** | § 8: berre **0,5 heile året, heile landet**. Inga 0,2-grense, ingen veker. Men § 7 kravde samordna vårbehandling ved tiltaksgrense **0,1**, med ei **anna geografisk inndeling**: Nord-Trøndelag låg i gruppe med Nordland (26. mars–1. mai), ikkje med sør. |
| **14.3.2016 – 5.3.2017** | FOR-2016-03-14-242 endra § 7 til eitt felles vindauge **5. mars–25. juni**, «hvert år», for alle kystfylke frå Rogaland til Finnmark. Framleis tiltaksgrense 0,1. |
| **Frå 6.3.2017** | FOR-2017-03-06-275: 0,2-grensa og veke-splitten kjem inn i § 8. § 7 vart oppheva. Vedlegg 1 pkt. 2, 3 og 4 omskrivne. Dagens ordlyd. |

**Praktisk kutt for backfill:**

- **Set grensa ved 6. mars 2017** for alt som handlar om compliance. Alle vårar før den datoen blir feilklassifiserte som «under grensa» om ein brukar dagens regel.
- 2013–2016 kan brukast, men ein `regel_versjon`-kolonne må versjonere **både grenseverdi og regioninndeling** — Nord-Trøndelag skifta side.
- **2012 skal ikkje backfillast som «same måltal».** Anna regime, anna frist, anna teljefrekvens, anna innhald. Rå lusetal-trend, ja. «Over grensa»-statistikk, aldri.
- Tysdagsfristen er derimot uendra heilt tilbake til 1.1.2011 (2009-forskrifta § 4b, tilføydd ved FOR-2010-12-17-1744). Rapporteringstidspunktet er samanliknbart over heile perioden.

### Ny forskrift på veg?

Ei høyring om ny lakselusforskrift vart klarert **6. januar 2020** med frist 6. april 2020. Ho har ikkje ført fram på over seks år, og 1140 står framleis uendra i substans. Det føreslåtte merdnivå-kravet var eit **kvalitativt velferdskrav** («ikke skal være nivåer av lakselus som kan redusere fiskevelferden»), ikkje ei talgrense; 0,5/0,2 blei vidareført på anleggsnivå.

Risikoen for at datagrunnlaget blir utdatert over natta er difor **låg**. Hald regelmotoren i éin isolert, versjonert modul — men av vanleg hygiene, ikkje av akutt fare.

---

## 2. Marknaden

### Kva BarentsWatch allereie leverer gratis

| Funksjon | Finst? |
|---|---|
| Kart over lokalitetar, lus, sjukdom, soner | Ja |
| Fartøysbesøk per lokalitet og veke | Ja — i høgre panel |
| Klikkbare skipsspor med retning og tidsstempel | Ja — kartlag «Fartøy» |
| **Favorittliste** (per-brukar utval av lokalitetar) | **Ja** |
| Vekevis blaing bakover i tid | Ja |
| **Varsel / abonnement / e-post når noko skjer** | **Nei** |

Fråværet av varsel er verifisert tre uavhengige vegar: rå HTML av bruksanvisninga gir null treff på «varsling», «abonn» og «e-post»; OpenAPI-spesifikasjonen har 128 stiar og null treff på notif/subscri/alert/varsel/email/push/webhook; og nyheitsartikkelen om ny funksjonalitet nemner ingen brukarvarsling.

Ein presisering: BarentsWatch *har* eit abonnement, men på feil ting — «you should sign up for our notification of changes in the API», altså varsel om API-endringar for utviklarar, pluss eit vanleg nyheitsbrev.

**Sidan favorittlista alt finst gratis, sel vi ikkje ei liste. Vi sel ei melding.**

### To reelle dekningshòl hos BarentsWatch

1. **Berre NIS-registrerte brønnbåtar blir viste.** Ordrett: «I dag viser vi bare skip som er registrert som Brønnbåter i NIS registeret, og dermed vises ikke alle som driver med avlusing.» Avlusingsskip, rensefisktransport, spesialskip og lekterar fell utanfor.
2. **Slakteribesøk blir ikkje viste i det heile.** «Vi viser ikke dette nå, men ønsker på sikt å legge til besøk i slakteri.» Dei kan ikkje tidfeste det. Datastrukturen (`slaughterhouseVisits` i TrackAnalysis) finst likevel i API-et.

### Konkurrentar, med namn

| Aktør | Kva dei sel | Pris | Trussel |
|---|---|---|---|
| **Manolin** (Bergen) — «Harpoon» | «Customer Account Intelligence» til leverandørar som jobbar i Noreg. Produktbevis frå **private** gardsdata: «what happened after treatment?» | «Reach Out» på alle tre pakkene | **Høg for målgruppe B.** Lansert 2023, tre års forsprang, kundar Veramaris, MSD Animal Health, Cargill — konsern, ikkje småleverandørar. Peikar mot enterprise-prising, og dermed mot eit tomt rom under dei. |
| **Kontali** | Sjømat-marknadsintelligens: pris, tilbod, handel, prognose 6–18 mnd. Premium har «Industry Intelligence» og API-tilgang. | Essentials **€99/mnd**; resten «Contact us» | Låg på lokalitetsnivå, men nærare enn ein skulle tru. Ikkje avskriv dei før ein veit kva Industry Intelligence inneheld. |
| **Byggfakta SMART** | Byggeprosjekt-leads med overvakingslister på geografi og kategori | «skreddersydd modell» — ingen publisert pris | Ingen — men **rett forretningsmodell-mal**. Kopier strukturen (filter på produksjonsområde, anleggstype, hending). |
| **AquaCloud** | Datadeling mellom 32 oppdrettarar (~55 % av biomassen) | — | Ingen. Deling, ikkje sal. |
| **Akvafakta** (Sjømat Norge) | Veke-/månadsstatistikk som opne PDF-ar (264 kB, ingen innlogging) | Gratis | Ingen. Potensiell distribusjonspartnar. |
| **iLaks** | Annonsefinansierte nyheiter, ingen betalmur | Gratis | Ingen. Distribusjonspartnar. |
| **IntraFish** | Redaksjonelle nyheiter | 8 000 kr/år enkelt, **30 000 kr/år for 6 brukarar** | Ingen. |
| **AKVA fishtalk / Ocea Mercatus** | Driftssystem til oppdrettarane | — | Ingen. Motsett kunderetning. |
| **AkvaInfo** (BarentsWatch) | «Havbruk i din kommune» — kommuneteneste | Gratis | Ingen. |

### GitHub — dei som har prøvd

| Repo | Kva | Dom |
|---|---|---|
| `jernjan/aqua-shield-0.1` | «Varslingssystem for norsk akvakultur» med SMS/e-post og nattleg analyse | **Ikkje ein konkurrent.** `sendSMS()` er ein `console.log` med kommentaren «TODO: In production, implement real Twilio SMS sending». `scheduleCronJob()` skriv berre ut ein streng. Temperaturen er `8 + Math.random() * 4`. BarentsWatch-kallet fell tilbake på mock-data. Stillas, ikkje eit system. Ingen commits sidan 20. mars 2026, ingen lisens. |
| `torsteinko/barents-lice-forecasting` | ML-prognose for luseoverskriding på 1, 2 og 12 veker + LLM-drive SQL-chat | Demo-repo etter forfattaren sitt eige ord. 0 stjerner. Sist push 2026-06-24. |
| `eigenreza/aquarisk-norway` | Bayesiansk tidleg-varsel-plattform, live dashbord på Azure, MIT | Reell og fersk: sist push 2026-09-07. 0 stjerner. **Prognosefeltet er oppteke.** |
| `EmilLindfors/bw_rs` | Rust-klient autogenerert frå BarentsWatch OpenAPI, 181 dokumentasjonsfiler | Nyttig oppslag, men sist push 2025-01-21 — over 20 månader gammalt. Ikkje fasit. Den lokale `fishhealth-openapi.json` er fasit. |
| `barentswatch/barentswatch-api-examples` | Offisielle døme, m.a. `fiskehelse_weeksummary.py` | 4 stjerner |

Merk: GitHub sitt repo-søk fann 20 repo som «nemner BarentsWatch», men søket dekkjer berre namn, skildring og emneord — ikkje README eller kode. Verken `aqua-shield` eller `aquarisk-norway` er blant dei 20. Økosystemet er større enn det ser ut, og av ukjend storleik.

### Marknadsstorleik (Fiskeridirektoratet, nøkkeltal havbruk 2024, per 31.12.2024)

| | Tal |
|---|---|
| Sjølokalitetar, kommersielle løyve | **994** (Vestland 273, Nordland 217, Trøndelag 157) |
| Matfisktillatelser (laks, regnbueørret, ørret) | 1 195 |
| Settefisktillatelser | 240 |
| **Selskap med matfiskproduksjon** | **168** — heile kundelista for målgruppe A |
| Brønnbåtar (Kystrederiene) | 106 (Møre og Romsdal 71) |

Leverandørsida (Nofima):

| | Tal |
|---|---|
| Bedrifter som leverer til havbruk | **over 6 000** |
| Selskap definerte som «spesialiserte» | **~1 150** (over 1 600 bedrifter) |
| Sjømatnæringas årlege kjøp av varer og tenester | **~130 mrd. kr** |
| Sysselsette hos leverandørane | **over 46 000** — mot knapt 40 000 i kjerneverksemda |

Eit døme på storleiken til éin leverandør i lusesegmentet: Stingray Marine Solutions omsette for 362 mill. kr i 2023 (247 mill. i 2022), med over 1 000 installerte luselaserar.

### Kvar er tomrommet?

**Målgruppe A (folk på anlegget): tomrommet er reelt, men det er berre push.** Ingen sender varsel. Ingen har bygd det (AquaShield tel ikkje). Men 168 selskap på ei gratisteneste gir null inntekt.

**Målgruppe B (leverandørane): tomrommet er smalare enn planlagt.** Manolin sit alt i Bergen og sel «Customer Account Intelligence» til leverandørar i Noreg. Skiljelinja er skarp og er vår opning: dei sel **produktbevis** frå private gardsdata, vi ville selje **tidssignal** frå opne data. To ulike produkt. Vi taper på datatilgang, så vi skal ikkje konkurrere på deira felt.

**Men premissen for tidssignalet har svekka seg kraftig** (sjå § 4 og § 5): dei rike søknadsfelta er token-låste, tvangsmulkta verkar ikkje, Mattilsynet reagerer ikkje automatisk, og det einaste opne søknadssignalet gir ~13 nye rader i månaden.

**Om pris:** vi har **ingen verifisert prisanker**. IntraFish (30 000 kr) er redaksjonelle nyheiter og Kontali (€99/mnd) er aggregert marknadsstatistikk — begge feil produktkategori. Dei to som faktisk sel signal- eller leadsprodukt, Manolin og Byggfakta, nektar begge å publisere pris. Ei omsetningsrekning basert på «15 000–40 000 kr/år» kviler på tal som ikkje er belagte.

### Lisens — den juridiske ryggrada

BarentsWatch-data ligg under **NLOD 2.0** med Kystverket som utgjevar. Lisensteksten tillèt ordrett «å benytte datasettet kommersielt» på vilkår «at du navngir lisensgiver slik lisensgiver ber om». Fiskeridirektoratet: «All bruk av data fra Fiskeridirektoratet er underlagt Norsk lisens for offentlige data (NLOD).» Brønnøysund: same lisens.

**Vidaresal er dermed lovleg.** Legg «Inneheld data frå Fiskeridirektoratet, Kystverket og Brønnøysundregistra under NLOD» i foten på både gratis- og betalproduktet.

**Men merk unntaket:** NLOD dekkjer ikkje data som krev «særlig tilgang» — og BarentsWatch sitt AIS krev nettopp eit eige scope. Sjå § 7.

---

## 3. AIS — kva er sant

| # | Påstand | Dom | Kjelde / merknad |
|---|---|---|---|
| **A** | Live AIS gir berre siste 24 timar per MMSI; Historic AIS held berre 14 dagar | **DELVIS SANT** | 14-dagars-grensa er ordrett: «This API has AIS data from the past 14 days.» Men etiketten er feil: `/v1/ais` er ein **straum** utan historikk, `/v1/latest/ais` gir siste melding per MMSI innan 24 t — og `/v1/historic/trackslast24hours/{mmsi}` gir faktisk **eit døgn med spor** per MMSI, i Historic AIS. |
| **B** | Polygon-søket har maks 7 dagar og maks 500 km² | **SANT** | Ordrett: «Max timeframe is 7 days. Max area of the polygon is 500 square kilometers.» (`/v1/historic/mmsiinarea`) |
| **C** | AIS-feltnamna er lange (`courseOverGround` osv.), ikkje korte | **SANT, MEN MÅ AVGRENSAST** | Gjeld berre BarentsWatch AIS. Det finst **tre** ulike feltnamnsett: BW AIS (`courseOverGround`, `imoNumber`, `callSign`), Fiskehelse (`cog`, `sog`, `rot`), Kystdatahuset (`ship_name`, `imo`, `ship_type`), og Kystverkets Parquet (`course_over_ground`). |
| **D** | Fiskefartøy under 15 m og fritidsfartøy under 45 m manglar i opne AIS-data | **SANT** | Ordrett frå Kystverket: «...dette av personvernhensyn.» Empirisk stadfesta to gonger: av 3 416 fartøy var 534 fiskefartøy, kortaste 15 m, null under; 8 fritidsfartøy, kortaste 46 m, null under. Bakdør: søknad til **ais@kystverket.no**. |
| **E** | `hais.kystverket.no` er eit bestillingsskjema, ikkje eit API | **SANT** | Maks eitt år per bestilling, levering på e-post, Parquet eller CSV, krev e-postadresse og samtykke. |
| **F** | Parquet-filene har ingen identitet — berre MMSI | **SANT** | Kolonnane er: `date_time_utc, mmsi, longitude, latitude, status, course_over_ground, true_heading, speed_over_ground, rate_of_turn, maneuvre, data_source, ais_class, msg_type, geometry`. Ingen namn, IMO, kallesignal, skipstype, destinasjon eller djupgang — sjølv om meldingstype 5 og 24 er med i `msg_type`. |
| **G** | `ais-public.kystverket.no` er daud | **SANT** | «Recv failure: Connection reset by peer» (exit 35), testa frå to uavhengige nett. Namnet er ein CNAME til `ca-kyv-hais-bff-prod...norwayeast.azurecontainerapps.io` — tenesta er **flytta** til hais, ikkje berre nede. |
| **H** | Kystdatahuset gir AIS gratis utan token | **SANT** | Verifisert live. 36 av 121 stiar krev JWT; `realtime/geojson`, `positions/for-mmsis-time`, `statinfo/for-mmsis-time` og `positions/within-geom-time` er **ikkje** blant dei. |
| **I** | AIS shipType kan ikkje brukast til å finne brønnbåtar | **SANT** | Den offisielle kodelista 0–99 har ingen kode for brønnbåt eller levandefisk-transport. Same Ronja-flåte melder m.a. type 0, 30, 40, 59, 60, 70, 75, 81 og 90 — inkludert 81 (tankskip, farleg last) og 60 (passasjer). Merk at typefeltet **endrar seg med spørjevindauget**, så konkrete talrekkjer frå eitt uttrekk skal ikkje siterast vidare. |

### To ting som vart motbeviste undervegs

- **Kystdatahuset sitt polygon-søk er IKKJE øydelagt.** Med det dokumenterte polygon-formatet svarte `/api/ais/positions/within-geom-time` med data for 2018, 2023, 2024 og februar 2026. Runde 1 testa berre datoar inne i arkivholet og forveksla eit datohol med eit øydelagt endepunkt. Endepunktet tek dessutan `minSpeed` — nyttig nettopp til å finne fartøy som ligg stille ved eit anlegg.
- **Kystdatahuset sitt arkivhol startar rundt 20. mars 2026**, ikkje i mai. 15.3.2026 gav data; 20.3 og alt fram til 1.9.2026 gir «42P01: relation ais2026xx... does not exist». Arkivet ligg nesten seks månader etter.

### Korleis identifisere brønnbåtar

Ikkje på AIS-type, og **ikkje på namn**: MMSI 257262000 / IMO 9652129 / kallesignal LDBG heiter «OYSUND» i Kystdatahuset sitt statinfo og «RONJA SUND» i sanntidsfeeden **same time**.

Riktig veg: hent `shiptypelevel5 = "Fish Carrier"` / `statcode5 = "B12B2FC"` frå Kystdatahuset (utan token), bygg lista på **MMSI + IMO + statcode5**, og kryss mot `isWellboat` frå Fiskehelse. I dag kom 24 av 24 MMSI som kringkastar eit RONJA-namn tilbake som Fish Carrier / B12B2FC. Cache lista — ho endrar seg sakte.

### Treng vi rå AIS i det heile?

**Nei, ikkje for å byggje produktet — dersom vi har BarentsWatch-token.**

Grunngjevinga i runde 1 var at BarentsWatch manglar destinasjon, ETA og djupgang. Det er feil. Det gjeld `VesselVisit` (det ferdige besøksobjektet), men **ikkje** BarentsWatch som heilskap:

- `VesselPosition`, bak `/v1/geodata/fishhealth/vesselslatestpositions`, har `destination`, `eta`, `draught`, `sog`, `cog`, `rot`, `isWellBoat` og `isSlaughterBoat`.
- BarentsWatch sitt AIS-API har `AisComboFull` (`/v1/combined`), som gir posisjon, namn, IMO, kallesignal, destinasjon, ETA, djupgang og skipstype **i éi og same melding** — pluss ein push-straum (`/v1/ais`, `/v1/sse/ais`) med filtrering på MMSI og geometri.

Heile signalet finst hos BarentsWatch. Det ligg bak token, ikkje bak eit hol i datamodellen. Både BarentsWatch AIS og Fiskehelse sine fartøysendepunkt gir HTTP 401 anonymt — valet står mellom **token** og **Kystdatahuset**, ikkje mellom to opne kjelder.

**Konkret tilråding:**

1. **Skaff BarentsWatch-token og bruk `vesselslatestpositions`.** Éin klient, éin kjelde, push-straum tilgjengeleg.
2. **Bruk Kystdatahuset som gratis fallback og kryssjekk** — sanntidsfeeden (3 416 fartøy, 2,99 MB, ~20 sek svartid, median alder 2,4 min, eldste 11 min) og MMSI-oppslaga verkar. Legg inn ein helsesjekk.
3. **Ikkje planlegg noko rundt `hais.kystverket.no` eller Parquet-filene.** Bestillingsskjema med e-postlevering, og filene har ingen identitet.
4. **Ikkje bygg varselet på destinasjonsfeltet åleine.** Av 24 brønnbåtar i dag skreiv **16 berre «FISHFARMS»** — som ikkje peikar på noko anlegg — 4 skreiv eit VHF-/telefonnummer («CH 16/47662036»), og berre 4 skreiv eit stadnamn. Totalt var 754 av 3 416 destinasjonsfelt tomme. Feltet er eit **svakt signal** som må kombinerast med kurs, fart og nærleik.
5. **Djupgangs-hypotesen («lett inn, djup ut = lasta fisk») er uprøvd.** Feltet blir faktisk sett per tur — for 17 av 24 brønnbåtar avvik live-djupgang meir enn 0,2 m frå registerverdien. Men Kystdatahuset sine **historiske** posisjonar har ingen djupgangskolonne, så hypotesen kan ikkje etterprøvast bakover. Han krev eigne snapshot over veker, kryssa mot `VesselVisit`.

---

## 4. Der data manglar hos BarentsWatch

Alt som mangla er funne. Alt er ope, gratis, utan innlogging og NLOD-lisensiert.

### Kjelder

| Kjelde | URL | Format | Storleik | Lisens |
|---|---|---|---|---|
| Akvakulturregisteret, CSV-dump | `api.fiskeridir.no/pub-aqua/api/v1/dump/new-legacy-csv-file` | CSV, 34 kolonnar | 6,9 MB, 27 098 rader | NLOD |
| Same, XLSX | `.../dump/xlsx-file` | OOXML | 3,8 MB | NLOD |
| Akvakulturregisteret, REST-API | `api.fiskeridir.no/pub-aqua` | OpenAPI 3.1, 26 stiar, 37 skjema | — | NLOD |
| `har_fisk` | Yggdrasil `Biomasse/FeatureServer/0` | ArcGIS REST | 1 127 features | NLOD |
| Akvakultursøknader | `fiskeridir.no/.../aqua-download-list?format=csv` | CSV, **berre 16 kolonnar** | 907 rader | NLOD |
| Selskapsdata | `data.brreg.no/enhetsregisteret/api/enheter` | JSON, opptil 2 000 orgnr per kall | — | NLOD |

CSV-dumpen blir **regenerert dagleg** — datostempelet flytta seg frå «per 2026-09-09» til «per 2026-09-10» på eit døgn, med uendra storleik og radtal. Gårsdagens fil er borte. **Lagre eit dagleg snapshot frå dag éin**; historikk kan ikkje rekonstruerast bakover.

### MTB

MTB ligg eksplisitt i registeret som **`LOK_KAP` + `LOK_ENHET`** (lokalitetsnivå) og `TILL_KAP` + `TILL_ENHET` (løyvenivå).

Heimelen er **akvakulturdriftsforskrifta FOR-2008-06-17-822 § 47 Biomasse**, ordrett: «Biomassen på en lokalitet skal ikke overstige den maksimalt tillatte biomassen som er klarert for lokaliteten i henhold til tillatelsen.»

Einingsfordelinga:

| Eining | Rader |
|---|---|
| **TN** (tonn) | **25 037** |
| STK | 839 |
| DA | 764 |
| KG | 281 |
| M3 | 143 |
| M2 | 34 |

**Lagre alltid eininga saman med talet.** 2 061 av 27 098 rader er ikkje tonn. Ein modell som antek tonn overalt gjev feil på alger, skjel og settefisk.

**KRITISK MODELLERINGSFELLE:** `LOK_KAP` er **gjenteke på kvar løyve-rad**. Éin lokalitet har opptil **322 rader** (median 11). Naiv summering over alle TN-rader gir **93 501 053 tonn** mot reelt **4 492 456 tonn** — **20,8× overteljing**. Godt nytt: verdien er konsistent per lokalitet (alle 1 777 har nøyaktig éin distinkt `(LOK_KAP, LOK_ENHET)`-kombinasjon), så **dedup på `LOK_NR` er trygt og trivielt**. Men det må stå i spesifikasjonen.

Kapasitetshistorikk finst per løyve: `/v1/licenses/{nr}/capacity-history` gir kvar endring med dato, type og storleik (`capacityValueType: "MTK"`, `typeValue: "OPPJUSTERING"`, `validFrom`).

**Er BarentsWatch sin `capacity` same storleik?** Sannsynleg, men ikkje talverifisert (krev token). Indisia er sterke: BarentsWatch sine skjema ligg under namnerommet `AquacultureRegister`, `capacity` har eksempel 6240 med `unit: "TN"`, og `LicenseDto.capacity` har eksempel **780** — nøyaktig lisenskapasiteten pub-aqua returnerer for ST-F-0010 (780,0 TN). Ein stikkprøve mot lokalitet 28636 (venta 10 920 TN) avgjer saka.

### Organisasjonsnummer og selskapskopling

**Koplinga lokalitet → selskap finst ferdig og open.** Tre vegar:

1. Same rad i CSV-dumpen (`LOK_NR` og `ORG.NR/PERS.NR` står i lag).
2. `/v1/sites?legal-entity-nr={orgnr}` — dokumentert filter.
3. `/v1/entities/sites-by-entity-nr/{orgnr}` — eige endepunkt.

**Ingen fuzzy namnematching, ingen skraping.** Dagsverk 1, ikkje eit forskingsprosjekt.

Dekning:

| Felt | Utfylt |
|---|---|
| `LOK_NR` | 100 % |
| `NAVN` | 100 % |
| `LOK_KAP` | 100 % |
| Koordinatar | 100 % |
| `ORG.NR/PERS.NR` | **99,7 %** (27 009 av 27 098) |
| `PROD_OMR` | **berre 74,4 %** (20 158 av 27 098) |

1 777 unike lokalitetar, 494 unike organisasjonsnummer.

**MEN — koplinga er mange-til-mange, ikkje 1:1.** **471 av 1 777 lokalitetar (26,5 %) har meir enn eitt organisasjonsnummer**, opptil ni. Årsaka er samdrift og samlokalisering: § 47 gjer innehavarane «solidarisk ansvarlige for overskridelse av lokalitetsbiomasse». For ei salsliste betyr det at «kven skal eg ringje?» ikkje er avgjort av registeret åleine.

Dei manglande 0,3 % er **privatpersonar**, ikkje selskap: 89 rader, **43 unike personar** fordelte på 50 lokalitetar, med `innehavernr: "PNR"` og `orgnr: null`. **Filtrer desse bort frå kommersielle lister** — å selje kontaktlister over namngjevne privatpersonar er ei anna sak juridisk enn å selje selskapsdata.

CSV-en har òg **ADRESSE, POSTNR og POSTSTED** — meir kontaktdata enn venta.

### `har_fisk` — feltet som «ikkje fanst»

Det finst, men hos Fiskeridirektoratet, ikkje BarentsWatch. Yggdrasil-laget **Biomasse** har `har_fisk` (Ja/Nei) saman med `siste_rapport`, `art`, `kapasitet_lok`, `aktuell_kapasitet` og `produksjonsomraade`. Ingen token.

| | Tal (reprodusert 10.9.2026) |
|---|---|
| Lokalitetar i laget | 1 127 features (1 117 unike `loknr`) |
| `har_fisk = 'Ja'` | **640** |
| `har_fisk = 'Nei'` | 487 |
| Nyaste `siste_rapport` | 2026-08-31 |

**Tre atterhald:**

1. **Dekninga er berre ~60 %.** 705 av registeret sine 1 777 lokalitetar finst ikkje i Biomasse-laget i det heile.
2. **«Akkurat no» er strekk.** 265 lokalitetar har siste rapport frå før 2026 — eldste er `loknr` 11954, status AKTIV, `har_fisk = 'Nei'`, siste rapport **30. april 2005**. «Nei» tyder både «tømt førre månad» og «ingen har sagt noko sidan 2005». **Filtrer alltid på alderen til `siste_rapport`**, elles varslar systemet brakklegging på anlegg som har lege daude i tjue år.
3. **Laget har berre siste snapshot, ingen historikk.** Overgangen Nei→Ja må vi fange sjølve ved å snapshotte og diffe.

Etterslepet er 1–2 veker: § 44 set fristen for månadsrapporten til den 7. i påfølgjande månad.

**Biomasse i tonn får vi aldri.** «Register for biomassedata» står under Unntatt offentlighet med heimel forvaltningsloven § 13 første ledd nr. 2. Ja/nei-flagget pluss MTB-taket er taket for kva vi kan levere lovleg. **Lov ingen kunde tonnasje-tal.**

### Akvakultursøknader — her sprekk målgruppe B

Runde 1 kalla dette «største funn for målgruppe B». Det held ikkje.

**Yggdrasil-laget `Akvakultursøknader` er IKKJE ope.** `.../Yggdrasil/Akvakultursøknader/MapServer?f=json` returnerer `{"error":{"code":499,"message":"Token Required"}}` — tre av tre forsøk, medan Biomasse svarar normalt i same testrunde. Det er ikkje nettverk, encoding eller rate limit.

**Difor finst ikkje dei felta som utgjorde heile salsargumentet:** ønska MTB i tonn, planlagt produksjon, planlagt fôrforbruk per syklus, maks utfôring per månad, nottype, notdjupn, notbehandling. Eit programmatisk søk i den opne CSV-en etter kolonnar med «biomas», «mtb», «fôr», «not», «kapasit» eller «tonn» gav **null treff**.

Den opne søknads-CSV-en har **16 kolonnar**: Søknadsnummer, Søknadstype, Status, Tittel, Søkers navn, Organisasjonsnummer, Innsendt, Trukket, Fylke, Kommune, Produksjonsområde, Lokalitetsnummer, Lokalitet, Art, Breddegrad, Lengdegrad.

Du får vite **kven** som søkjer, **kvar** og **kva type** — ikkje kor mykje MTB dei vil ha, kor mykje fôr dei skal bruke, eller kva slags not dei treng.

Og signalet er tregare enn det såg ut:

| | Tal |
|---|---|
| Totalt i CSV-en | 907–908 rader, 100 % orgnr |
| Ferdigbehandlet | 519 |
| Under behandling | 273 |
| Trukket | 80 |
| Returnert | 36 |
| **Opne søknader (273 + 36)** | **309** |
| Med lokalitetsnummer | **berre 137 av 309** |
| Median alder, open søknad | **9,6 månader** |
| Over eitt år | 121 |
| Over to år | 46 |
| **Nye siste 30 dagar** | **13** |

Eit dagleg diff gir altså **~13 nye signal i månaden**, ikkje 309. Og VARHOLMEN-døma frå runde 1 (SinkabergHansen, lok. 36317) er ikkje eit ferskt kjøpssignal — det er den **eldste opne søknaden i heile datasettet**, innsend 24. februar 2023, 3,5 år gammal.

«Ferdigbehandlet» skil dessutan **ikkje** mellom innvilga og avslått. Utan det kan vi ikkje måle treffrate på varsla våre.

Søknadstypar (open CSV): Endring av lokalitet 80, Ny lokalitet 44, Landbasert 37, Samlokalisering 36, Mindre arealendringar 12.

### Vedtak

`/v1/sites/{nr}/decisions` er ope og har eigen type `CAPACITY_CHANGE` / «Kapasitetsendring» med `registeredTime`. Men det finst **ingen «endra sidan»-parameter** — `/decisions` tek berre `site-nr`. Å polle vedtak for 1 777 lokalitetar er 1 777 kall per runde. Det treng ei løysing.

`/sites?registered-from={ISO-dato}` fungerer for nye lokalitetar, med hard grense på 100 per kall.

### Brønnøysund

Gratis, ingen nøkkel, **opptil 2 000 orgnr i eitt kall**. Gir namn, næringskode, konkurs, underAvvikling, sektorkode, siste innsendte årsrekneskap og `antallAnsatte` (ujamt utfylt — `harRegistrertAntallAnsatte` kan vere false).

Bruk det til tre ting:
1. Filtrere bort **konkurs** og **underAvvikling** før vi sel lister. Eit konkursbu i ei leverandørliste øydelegg tilliten med ein gong.
2. Filtrere på **næringskode 03.211** for å skilje ekte oppdrettarar frå forskingsinstitutt. Registeret inneheld NMBU og NIVA med kommersielle løyve.
3. Berike alle 494 selskapa i **eitt** dagleg kall.

Bulk-filene blir produserte «hver natt, cirka klokken 0500» — sett synk-jobben etter det.

### Driftsfelle

**Det token-sikra søknadsendepunktet returnerer HTTP 200 med feilen i JSON-kroppen** (`{"code":499}`). Ein GitHub Actions-jobb som sjekkar `curl -f` eller statuskode vil rapportere «alt OK» medan han hentar null rader. **Overvakinga må parse kroppen og telje rader**, ikkje stole på 200.

---

## 5. KVA ER IGJEN Å BYGGE

Brutalt ærleg gjennomgang av dei ti hendingsreglane.

| # | Regel | Leverer BarentsWatch det ferdig? | Kva er faktisk vår verdiskaping |
|---|---|---|---|
| 1 | `stocking_started` | **Nei — ingen data.** Null treff på stocking, utsett, generation, biomass, smolt, harvest i heile spesifikasjonen. | `har_fisk` Nei→Ja hos Fiskeridirektoratet. Men laget har **berre snapshot**. **Snapshot + diff er vårt.** Etterslep 1–2 veker. |
| 2 | `fallow_started` | **Delvis, og dårleg.** `isFallow` er avleidd, ordrett: «has not reported for four consecutive weeks or more, we assume it has no fish». | `har_fisk` Ja→Nei er langt betre, pluss aldersfilter på `siste_rapport`. § 40 gir minimum to månaders brakklegging, så vindauget har kjend minstelengd. **Snapshot + diff + filter er vårt.** |
| 3 | `lice_rising` | **Delvis.** `LiceTrend` er berre ei **ein-vekes** samanlikning (`average`, `averageOfPreviousWeek`, enum Stable/Increasing/Decreasing). | Rådataserien blir levert komplett (`/locality/{nr}/avgfemalelice/{år}` gir alle veker som `{week, value}`). Vår del er **ei tre-punkts samanlikning**. Trivielt. |
| 4 | `lice_over_limit` | **Ja, ferdig utrekna.** `liceLimit` og `aboveLiceLimit` per lokalitet per veke i eksport-DTO-en, pluss filtera `AboveLiceThreshold` («Above 0.5») og `AboveMinimumLiceThreshold` («Above 0.2») på både v1 og v2. | **Nesten null** — men vi bør eige regelmotoren som kryssjekk, og handtere stamfisk-dispensasjonar som BarentsWatch ikkje kjenner. Merk at `localitiesoverlimitbyweek` er ubrukeleg: det gir berre eit nasjonalt **tal**, aldri ei lokalitetsliste. |
| 5 | `treatment_logged` | **Ja, rikt.** `hasBathTreatment`, `hasInFeedTreatment`, `hasMechanicalRemoval`, `hasCleanerFishDeployed` + arrayane. Eksporten har `treatmentType`, `treatmentSubType`, `substance`, `quantity`, `treatmentScope`, `numberOfCages`. | **Null.** Rein viderformidling. |
| 6 | `treatment_cluster` | **Nei.** `ProductionAreaWeek` har ingen lus- eller behandlingsdata — berre teljingar av anlegg og slakteri. | Men kvar behandlingsrad ber allereie `productionAreaId` og `productionAreaName`. Vår del er **ein GROUP BY** på ferdig merka data. Trivielt. |
| 7 | `zone_change` | **Ja.** `/diseasezonehistory/{localityNo}/{year}/{week}` gir `ControlAreaLinkV1` med `fromDate`, `toDate`, `forskNr` og lenke til Lovdata. **Dette endepunktet er ikkje deprecated** — berre varianten utan år/veke er det. | **Null.** Overgangsdatoane er leverte, ikkje avleidde. (Reserve: sjukdomseksporten har `mistankedato`, `paavistdato`, `tomtdato`, `avsluttetdato`.) |
| 8 | `harvest_window` | **Nei — ingen open kjelde.** | **Men dataa finst.** Akvakulturdriftsforskrifta § 44 krev at oppdrettar kvar månad rapporterer **utsett** (art, antal, årsklasse), beholdning med årsklasse, biomasse og **utslaktingskvantum med slaktevekt** til Fiskeridirektoratet. Dei publiserer berre på fylke og produksjonsområde. **Dette er eit innsyns- og avtaleproblem, ikkje eit datafråvær.** Alternativet — å gjette generasjon frå `har_fisk`-overgangar — krev mange månaders eigen snapshot-historikk først. |
| 9 | `wellboat_arrival` | **Ja for besøket.** `VesselVisit` gir fulle tidsstempel med minuttoppløysing, dekning frå veke 35 2020 for alle fartøy som har vitja eit anlegg. `TrackAnalysis` gir ferdig geoanalyse mot sjukdomssoner, produksjonsområde og slakteri. | **Ikkje sjølve besøksdeteksjonen** — den skal vi ikkje gjenta. Vår del er (a) å oppdage besøket **medan det skjer**, ikkje etter at veka er analysert (`weekIsAnalyzed`), og (b) å pushe det. Forspranget er reelt: BarentsWatch seier sjølve at «det kan ta noe tid før eventuell behandling er rapportert inn fordi oppdrettere har frist tirsdag i etterfølgende uke». **Hol:** berre NIS-registrerte brønnbåtar er med. |
| 10 | `neighbour_pressure` | **Nei.** Null treff på neighbour, neighbor, nearby, distance i heile spesifikasjonen. | Men `lat`/`lon` finst i EPSG:4326 for kvar lokalitet, og `withinPolygon`-filteret lèt oss sende ein sirkel til serveren. Vår del er **ein haversine over ~1 100 punkt**. Trivielt. |

### Teljinga

| Kategori | Reglar | Tal |
|---|---|---|
| **Rein viderformidling** — BarentsWatch leverer svaret ferdig | 4, 5, 7 | **3** |
| **Triviell utrekning** over data vi får utlevert komplett (diff, GROUP BY, tre-punkts, haversine) | 3, 6, 10 | **3** |
| **Krev eit snapshot→hending-lag som ingen har bygd** | 1, 2 | **2** |
| **Kjelda finst, men er lukka** — krev innsyn eller avtale | 8 | **1** |
| **Deteksjonen er ferdig; berre timinga og pushen er vår** | 9 | **1** |

**Analytisk verdiskaping i reglane sjølve: null av ti.** Ingen av dei ti er ein modell, ein prognose eller ei innsikt. Fire er API-kall. Tre er ei linje SQL.

**Det som faktisk er vårt, ligg i laget under reglane:**

1. **State → event.** BarentsWatch og Fiskeridirektoratet publiserer **tilstand**, aldri **hendingar**. Ingen av dei har historikk på `har_fisk`, ingen har diff, ingen sender beskjed. Eit snapshot-arkiv med idempotent hendingsutsending er den einaste komponenten som ikkje finst nokon annan stad. Med det arkivet blir alle ti reglane trivielle SQL-spørjingar over data vi eig.
2. **Push.** Verken BarentsWatch, Fiskeridirektoratet, Kystverket eller Kystdatahuset har varsel. BarentsWatch har til og med favorittlista — utvalet finst, meldinga manglar.
3. **Timing.** Å sjå brønnbåten **medan** han ligg der, ikkje etter at veka er analysert.

**Ei nedjustering av vår eigen sjølvskryt:** revisjonshandtering er mindre spesielt enn det vart selt som. `LocalityWeek` har eit heiltalsfelt `version`, og BarentsWatch skriv sjølve at retting bakover «skjer ikke ofte» — sjølv om oppdrettarar teoretisk kan rette alle veker i inneverande år. Det er framleis arbeid, men det er ikkje ein vollgrav.

**Og ei god nyheit for arkitekturen:** luserapportar er synlege «minutter etter at oppdretter har sendt inn data». Eit **dagleg** pollande system i GitHub Actions taper nesten ingenting mot eit timesbasert, til same pris: null.

---

## 6. TILRÅDING

**Bygg éin ting først: snapshot → diff → push.** Last ned Akvakulturregisteret sin CSV, Biomasse-laget, søknads-CSV-en og fiskehelse-eksporten kvar dag i GitHub Actions, lagre snapshot frå dag éin, diff mot gårsdagen, og send meldinga. Køyr lusedelen tysdag kveld eller onsdag morgon, aldri måndag. Alle ti reglane fell då ut som SQL over eit arkiv vi eig — men arkivet finst ikkje før vi lagar det, og historikken kan ikkje hentast inn i ettertid, så dagen vi startar snapshottinga er den einaste datoen som betyr noko.

**Ikkje bygg kart, prognose eller eigen AIS-besøksdeteksjon.** Kartet finst gratis på barentswatch.no med klikkbare skipsspor. Prognosefeltet er oppteke av minst to andre prosjekt, det ferskaste oppdatert tre dagar før denne kartlegginga. Og BarentsWatch har alt gjort geoanalysen mot anlegg, sjukdomssoner og slakteri — å byggje den på nytt frå rå AIS er ekte arbeid utan gevinst. Historikk frå dei, timing frå oss.

**Premissen i oppdraget held ikkje for målgruppe B slik han er formulert.** «Sel kjøpssignal frå opne data til leverandørindustrien» byggjer på fire ting som alle har svikta i denne runden: dei rike søknadsfelta (ønska MTB, fôrmengd, nottype) er token-låste og ikkje opne; tvangsmulkta er etter Mattilsynet si eiga vurdering for låg til å verke som pressmiddel; Mattilsynet reagerer frå 2. juli 2026 ikkje lenger automatisk på ei enkelt overskriding; og det einaste opne søknadssignalet gir ~13 nye rader i månaden, over halvparten utan lokalitetsnummer. Legg til at vi ikkje har eit einaste verifisert prisanker for denne produktkategorien i Noreg.

**Difor: gjer målgruppe A ferdig først, og gjer eitt konkret forsøk på å opne målgruppe B.** Målgruppe A er 168 selskap og gir null i inntekt, men det er den einaste delen der tomrommet er reelt, avgrensa og byggbart på ei veke. Parallelt: send eitt brev til Fiskeridirektoratet og be om at Akvakultursøknader-laget blir opna, og eitt innsynskrav etter § 44 om utsett- og utslaktingsdata per lokalitet. Får vi ja på begge, er målgruppe B eit ekte produkt. Får vi nei, er det ein illusjon, og då bør vi vite det før vi byggjer resten.

---

## 7. MÅ FRAMLEIS AVKLARAST

### Krev BarentsWatch-token (scope `api`) — gjer desse i same økt

1. **Har CSV/Excel-eksporten faktisk kolonnane `liceLimit` og `aboveLiceLimit`?**
   Spesifikasjonen dokumenterer dei berre på `/v1/geodata/download/fishhealth/**preview**` (som gir 10 rader). Sjølve `/download/fishhealth` har `responses: {"200": {"description": "OK"}}` uten schema, fordi han returnerer xlsx/csv.
   → **Kall** `GET /v1/geodata/download/fishhealth/preview?reporttype=lice&localityno=28636&fromweek=16&fromyear=2026&toweek=21&toyear=2026` med token, og les kolonnenamna. Deretter same kall mot `/download/fishhealth` og opne fila.
   *Avgjer om vi kan bruke BarentsWatch som fasit eller må eige fylkesmappinga aleine. (Mappinga er uansett triviell: fylke 18/55/56 = nord.)*

2. **Er `liceLimit` utfylt for år før 2017, då grensa var 0,5 heile året?**
   Feltet er ein nullable string.
   → Same kall med `fromyear=2015&toyear=2015`.

3. **Kor raskt blir `VesselVisit` oppdatert?**
   Dette er **det einaste talet** som avgjer om det ferdige endepunktet kan brukast til varsling i det heile. `weekIsAnalyzed` finst, men ingen SLA er oppgitt.
   → **Poll** `/v1/geodata/fishhealth/locality/{nr}/vessel/{år}/{veke}` kvar time i to veker og logg når flagget snur. **Gjer dette først av alt.**

4. **Er BarentsWatch `capacity` = Fiskeridirektoratet `LOK_KAP`?**
   → Éin stikkprøve: hent lokalitet **28636** frå BarentsWatch og sjekk mot venta **10 920 TN**.

5. **Er BarentsWatch sitt `isWellboat` samd med Kystdatahuset sin `Fish Carrier` / `B12B2FC`?**
   → Kryss dei 24 Ronja-MMSI-ane mot BarentsWatch-flagget.

6. **Har Fiskehelse eit varsel bak innlogging på «Min side»?**
   Tre uavhengige offentlege kjelder seier nei, og null av 128 API-stiar har varselfunksjonar — men eit reint frontend-varsel utan eige endepunkt kan i teorien finnast.
   → Logg inn og sjekk. Femten minutt.

### Krev brev eller e-post — desse avgjer om målgruppe B finst

7. **Kan Akvakultursøknader-laget opnast?**
   Dette er det einaste som avgjer om målgruppe B er mogleg slik han er skissert. Laget gir 499 Token Required i dag.
   → **Skriv til Fiskeridirektoratet** og spør om laget kan opnast, eller om vi kan få tilgang. Nemn at Biomasse-laget i same katalog er ope.

8. **Kan vi få utsett- og utslaktingsdata per lokalitet etter § 44?**
   Oppdrettarane rapporterer allereie utsett (art, antal, årsklasse) og utslaktingskvantum med slaktevekt kvar månad. Fiskeridirektoratet publiserer berre på fylke og produksjonsområde.
   → **Innsynskrav** til Fiskeridirektoratet. Avgjer om `harvest_window` kan byggast i det heile.

9. **Finst det gjeldande soneforskrifter etter luseforskrifta § 5 med eigne lusegrenser?**
   Begge dei to kjende luse-soneforskriftene er opphevde (Hordaland/Rogaland ved FOR-2017-06-30-1101 frå 1.7.2017; Nord-Trøndelag/Osen ligg i Lovdata si samling for opphevde). Mattilsynet si lakselus-hovudside listar berre 1140 under «Regelverk». Men Lovdata sitt søk svarar HTTP 405, så vi kan ikkje uttømande stadfeste at ingen finst.
   → **Behandle som «truleg ingen», ikkje «ingen».** Spør Mattilsynet direkte.

10. **Status for arbeidet med ny lakselusforskrift.**
    Mattilsynet sin eigen URL (`om_mattilsynet/ny_lakselusforskrift.25694`) er ei tom navigasjonsside. Ingen primærkjelde seier verken at arbeidet er lagt ned eller at det er aktivt.
    → Spør Mattilsynet. **Utan hastverk** — høyringa er frå januar 2020 og har lege død i over seks år.

11. **Kva utgjer kvantitativt «gjentatte eller langvarige overskridingar» i den nye praksisen frå 02.07.2026?**
    Sida gir **ingen tal**, berre kvalitative kriterium. Nærast eit tal er ein klagesak der vedtak kom etter overskriding i tre av dei fire siste vekene.
    → Spør Mattilsynet, eller les fleire klagesaker.

12. **Er fylkesmappinga vår korrekt?**
    § 8 brukar «Nord-Trøndelag og sørover» — eit fylke som ikkje har eksistert sidan 1.1.2018.
    → Be Mattilsynet stadfeste skriftleg at skiljet går mellom Trøndelag og Nordland, altså fylke 18/55/56 = nordregelen.

13. **BarentsWatch sine eigne API-vilkår.** NLOD 2.0 dekkjer datasettet og tillèt kommersiell bruk, men vi fann inga vilkårsside på barentswatch.no — fem sannsynlege URL-ar gav 404 og sitemap har ingen treff på vilkar/lisens/terms. Rate limits og eventuelt forbod mot vidaresal står ein stad vi ikkje fann. **NLOD dekkjer heller ikkje data som krev «særlig tilgang» — og AIS krev nettopp eige scope.**
    → Spør BarentsWatch før vi sel noko.

14. **Kystdatahuset sine bruksvilkår og rate limits.** OpenAPI oppgir NLOD 1.0, men `kystdatahuset.no/artikkel/api-tilgang` er ein JavaScript-app utan lesbar vilkårstekst. Ingen `X-RateLimit`-headerar i svara.
    → E-post til **support.kystdatahuset@kystverket.no**. Kommersiell bruk er korkje stadfesta eller avkrefta.

15. **Er arkivholet hos Kystdatahuset frå ca. 20. mars 2026 mellombels?**
    Feilmeldinga er ein manglande partisjonstabell — drift, ikkje policy — men vi finn ingen driftsmelding.
    → Gjenta kallet for `2026-04-01` om ei veke og om ein månad. Legg det inn som helsesjekk.

### Krev berre eit kall eller ei måling — enkelt

16. **Skil «Ferdigbehandlet» mellom innvilga og avslått?**
    Den opne CSV-en har berre fire statusar og skil ikkje. Utan dette kan vi ikkje måle treffrate.
    → Sjekk `/sites/{nr}/decisions` for lokalitetar med ferdigbehandla søknad, eller spør Fiskeridirektoratet.

17. **Kvifor manglar 705 av 1 777 lokalitetar i Biomasse-laget, og kva er dei 45 `loknr` som finst i Biomasse men ikkje i registeret?**
    → Må avklarast før vi lovar dekning til målgruppe A.

18. **Kor stor del av dei 494 oppdrettsselskapa har `antallAnsatte`?**
    → Éin batch mot Brreg med alle 494 orgnr avgjer det.

19. **Gir `avgfemalelice/{år}` og eksporten identiske tal?**
    Eksporten har `avgAdultFemaleLiceRounded` (avrunda), graf-endepunktet har rå float. Terskelkryssingar rett på 0,5 kan sprike.
    → Samanlikn éin lokalitet, eitt år.

20. **Er `TrackAnalysis.slaughterhouseVisits` faktisk utfylt i praksis?**
    Skjemaet finst med `fromTime`/`toTime`, men flagget `hasSlaughterhouseVisitsAnalysis` tyder på at analysen kan vere av, og BarentsWatch skriv i FAQ-en at dei ikkje viser slakteribesøk. Dette er den einaste moglege snarvegen til `harvest_window`.
    → Eitt autentisert testkall.

21. **Skil djupgangssignalet lasta frå tom brønnbåt?**
    Kan ikkje etterprøvast på Kystdatahuset sine historiske data (ingen `draught`-kolonne).
    → Krev eigen innsamling av sanntids-snapshot over veker, kryssa mot `VesselVisit`.

22. **Kva står «MTK» for som `capacityValueType`?**
    Negativt stadfesta: skjemaet seier berre «Verditypen til kapasiteten», og strengen finst ikkje elles i spesifikasjonen.
    → Spør Fiskeridirektoratet, eller lat vere — samanhengen med MTB er tydeleg frå § 47 og einingane.

23. **Kva Manolin Harpoon kostar, og kor mange betalande norske leverandørkundar dei har.**
    Alle tre pakkene seier «Reach Out». Kundane vi kjenner (Veramaris, MSD Animal Health, Cargill) er konsern, noko som peikar mot enterprise-prising — og dermed mot eit tomt rom under dei.
    → Utan dette veit vi ikkje om marknaden toler 5 000 eller 500 000 kr i året.

24. **Kva Kontali Species Pro og Premium Add-ons kostar, og kva «Industry Intelligence» faktisk inneheld.**
    → Kontali er nærare oss enn runde 1 gav inntrykk av. Ikkje avskriv dei som distribusjonspartnar før dette er kjent.

25. **Sel nokon reine kjøpssignal («dette anlegget skal avluse neste veke») til norske leverandørar?**
    Vi søkte aktivt på norsk og engelsk og fann ingen. Fråværet er godt underbygd, men eit negativt søkeresultat er ikkje bevis — slike produkt blir ofte selde stille via direkte sal utan nettside.

26. **Kor stor del av dei 6 000 leverandørbedriftene har salsbudsjett for datakjøp?**
    Uendra ukjend. Talet på reelle betalarar er truleg nærare 1 150 enn 6 000.

---

*Kjelder: BarentsWatch (Kystverket), Fiskeridirektoratet, Mattilsynet, Lovdata, Brønnøysundregistra, Kystdatahuset, Nofima. Data frå Fiskeridirektoratet, Kystverket og Brønnøysundregistra under NLOD.*
