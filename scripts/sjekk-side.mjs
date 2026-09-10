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
  // Feilar AIS under bygginga, blir fartoy tom. Då seier Båtar-fana at det er
  // null brønnbåtar i sjøen — ei aktiv løgn, ikkje ei feilmelding.
  const fartoy = d.fartoy?.length ?? 0;
  if (fartoy < 100) feil.push(`berre ${fartoy} fartøy — AIS har truleg feila`);
  const godkjende = d.fartoy?.filter((f) => f.g === "godkjend").length ?? 0;
  if (godkjende < 20) feil.push(`berre ${godkjende} godkjende brønnbåtar — brønnbåtregisteret har truleg feila`);
  const soner = d.lokalitetar?.filter((l) => l.so?.length).length ?? 0;
  if (soner === 0) feil.push("ingen anlegg i sjukdomssone — WFS-en har truleg feila");
  const dagar = (Date.now() - Date.parse(d.bygd)) / 36e5;
  if (dagar > 6) feil.push(`datasettet er ${Math.round(dagar)} timar gammalt`);
}

/* Kvar funksjon som blir kalla må finnast.
   Denne kontrollen finst fordi to funksjonar ein gong forsvann ut av fila utan at
   noko sa frå: syntaksen var gyldig, dataa var rette, og feilen viste seg først
   når nokon trykte på fana. */
{
  const i0 = h.lastIndexOf("<script>");
  let js = h.slice(i0, h.lastIndexOf("</script>"));
  // Kommentarar og tekststrengar inneheld ord som liknar funksjonskall
  // («Kartverket (NLOD)», «(fleire …»). Dei må vekk før vi leiter.
  js = js
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*\/\/.*$/gm, " ")
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, "``");
  const definerte = new Set([...js.matchAll(/function\s+([A-Za-zÆØÅæøå_$][\w$]*)\s*\(/g)].map((m) => m[1]));
  for (const m of js.matchAll(/(?:var|let|const)\s+([\w$]+)\s*=\s*function/g)) definerte.add(m[1]);
  const innebygde = new Set([
    "if","for","while","switch","catch","return","typeof","function","new","await",
    "Number","String","Boolean","Array","Object","JSON","Math","Date","Set","Map",
    "parseInt","parseFloat","isNaN","console","setTimeout","clearTimeout","alert",
    "getComputedStyle","requestAnimationFrame","ResizeObserver","Promise","RegExp","Error",
  ]);
  const manglar = new Set();
  for (const m of js.matchAll(/(^|[^\w$.])([A-Za-zÆØÅæøå_$][\w$]*)\s*\(/g)) {
    const n = m[2];
    if (!definerte.has(n) && !innebygde.has(n)) manglar.add(n);
  }
  if (manglar.size) feil.push(`kallar funksjonar som ikkje finst: ${[...manglar].join(", ")}`);
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
