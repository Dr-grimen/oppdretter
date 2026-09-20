# Oppdretter – vidare arbeid

Oppdatert 20. september 2026 etter Sondre sitt uttrykkelege oppdrag om å ta full styring og oppgradere heile appen.

## Autoritativ app og prosjekt

- Publisert app: https://dr-grimen.github.io/oppdretter/
- GitHub: Dr-grimen/oppdretter, offentleg repo, eksisterande dagleg GitHub Actions-jobb.
- Opphavleg lokal mappe: /Users/sondregrimen/oppdretter.
- Arbeidskopi for denne oppgraderinga: /Users/sondregrimen/Documents/Codex/2026-09-20/s/work/oppdretter.
- Gamle Claude Artifact-kopiar er stillbilete og skal ikkje brukast som fasit.

## Kva som er endra

Heilt ny responsiv utforming med sidemeny, mobilmeny, oversiktskort, felles anleggs-/fartøykart, anleggsregister, kjeldestatus og detaljpanel. Anlegg kan følgjast lokalt og delast med lenkje. CSV-eksport har vern mot formelinjeksjon. MarineTraffic-lenkjer er eksterne; Kystverket leverer sjøtrafikken gratis.

Mattilsynet-data har no konsekvent val av nyaste korrigerte rapport før kurve, tal og hendingar blir berekna. Feil i ei valfri kjelde blir oppgitt som ukjent/feila, ikkje som null. Innhentinga legg ved temperatur, lusestadium, behandlingar og månadlege rensefiskdata. Kjeldestatus ligg i `D.kjelder`. Domene- og feiltilstandar har automatiske testar.

Leaflet er lokalt lagra, og kvar publisering får innhaldshasha ressursar. Nettappen kan installerast og bruker ein samsvarande lokal reservekopi utan nett. Kartfliser blir ikkje cachelagra. Stale-/offline-status skal alltid vere synleg.

## Viktige presiseringar

- Bruk `app/mal.html`, `app/app.css` og `app/app.js`; aldri rediger generert `app/index.html` direkte.
- Rådata ligg i `data/snapshots/<dato>`. Eldre data må aldri få ein oppdikta fersk dato.
- AIS-tid frå Kystdatahuset er UTC sjølv når `Z` manglar. LineString går frå eldre til nyare koordinat; bruk siste punkt.
- Ein båt kan vere nær eit anlegg utan å besøkje det. Ukjend fart må ikkje telje som låg fart.
- Lusekravet er færre enn 0,5 / 0,2; lik grensa skal ikkje merkast under. Merk generelle grenser og eventuelle individuelle unntak tydeleg.
- Rensefiskbehaldning gjeld slutten av månaden før rapportmånaden, ikkje no.
- Ingen rapport betyr ukjent; sjukdomsfråvær i datasettet er ikkje ei friskmelding.
- Ingen funksjon sender e-post, SMS eller andre meldingar til folk. «Hendingar» er ei oversikt inne i appen.
- Bruk faktiske primærkjelder og `docs/KJELDER-2026-09-20.md`; ikkje lov «alt frå Mattilsynet» eller eit garantert sanntidskart.
- Kjøp ingen tenester. Standard er 0 kr. Vis månadspris før eventuell betalt avhengigheit.

## Verifikasjon og publisering

Køyr `npm run typecheck`, `npm test`, pakking og `scripts/sjekk-side.mjs`. Kontroller både 390 px mobil og vanleg dataskjerm i nettlesaren. Sjå særleg etter kartmarkørar, zoom-/lagkontrollar, søk → detalj → naboar, favorittar, tomme filter, kildefeil og fanebytte.

Eksisterande workflow startar planlagt eller manuelt, ikkje på kvar push. Oppdaterte kjelder og publisering må verifiserast etter ei kodeendring. Endringar i workflow kan krevje ekstra GitHub-tilgang; ikkje ta for gitt at eit vanleg push-token har workflow-scope.

Sondre har jobba på Storevikholmen (11492, PO 3). Den viktige funksjonen er å sjå lusetal hos dei andre anlegga i fjorden. Bruk 20 km standardradius, og ikkje omtal eit uvekta nabosnitt som smittepress.
