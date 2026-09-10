/**
 * Helsesjekk før publisering. Stoppar utlegginga heller enn å publisere
 * noko gale — ei side som står stille ein dag er betre enn ei som lyg.
 *
 * Køyr:  node scripts/sjekk-side.mjs [sti]
 */
import { readFileSync } from "node:fs";

const sti = process.argv[2] ?? "app/index.html";
const h = readFileSync(sti, "utf8");
const feil = [];

if (h.includes("__DATA__")) feil.push("datablokka blei aldri sett inn");

const merke = 'id="d"';
const iMerke = h.indexOf(merke);
if (iMerke < 0) feil.push('fann ikkje <script id="d">');

let d = null;
if (iMerke >= 0) {
  const start = h.indexOf(">", iMerke) + 1;
  const slutt = h.indexOf("</script>", start);   // frå datablokka, ikkje frå toppen
  try {
    d = JSON.parse(h.slice(start, slutt).replaceAll("<\\/", "</"));
  } catch (e) {
    feil.push(`datablokka er ikkje gyldig JSON: ${e.message}`);
  }
}

if (d) {
  if (!d.hendingar?.length) feil.push("null hendingar");
  if (!d.lokalitetar?.length) feil.push("null lokalitetar");
  if (!d.po?.length) feil.push("null produksjonsområde");
  if (!d.veke?.uke) feil.push("manglar rapportveke");
  const medLus = d.lokalitetar?.filter((l) => l.lus !== null).length ?? 0;
  if (medLus < 200) feil.push(`berre ${medLus} anlegg har lusetal — venta over 200`);
  const dagar = (Date.now() - Date.parse(d.bygd)) / 36e5;
  if (dagar > 6) feil.push(`datasettet er ${Math.round(dagar)} timar gammalt`);
}

if (!h.includes("leaflet")) feil.push("Leaflet manglar");
if (!h.includes("NLOD")) feil.push("NLOD-attribusjonen manglar — det er eit lisenskrav");

if (feil.length) {
  console.error("SJEKKEN FEILA:");
  for (const f of feil) console.error("  ✗ " + f);
  process.exit(1);
}
console.log(
  `OK: ${d.hendingar.length} varsel · ${d.lokalitetar.length} anlegg · ` +
  `${d.fartoy?.length ?? 0} fartøy · veke ${d.veke.uke} · ${Math.round(h.length / 1024)} kB`,
);
