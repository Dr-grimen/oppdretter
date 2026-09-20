/** Validate the generated document, source health and the scripts it actually loads.
 * Browser interaction is verified separately. Optional source outages are allowed
 * only when explicitly represented; an unknown value must never become zero.
 */
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { Script } from "node:vm";

const sti = resolve(process.argv[2] ?? "app/index.html");
const rot = dirname(sti);
const h = readFileSync(sti, "utf8");
const feil = [];
const varsler = [];
let d = null;
if (h.includes("__DATA__")) feil.push("datablokka blei aldri sett inn");
const data = h.match(/<script\b[^>]*\bid=["']d["'][^>]*>([\s\S]*?)<\/script>/i);
if (!data) feil.push('fann ikkje <script id="d">');
else try { d = JSON.parse(data[1].replaceAll("<\\/", "</")); }
catch (e) { feil.push(`datablokka er ikkje gyldig JSON: ${e.message}`); }

if (d) {
  if (!Array.isArray(d.hendingar)) feil.push("manglar hendingsliste");
  if (!d.lokalitetar?.length) feil.push("null lokalitetar");
  if (!d.po?.length) feil.push("null produksjonsområde");
  if (!Number.isInteger(d.veke?.uke) || !Number.isInteger(d.veke?.aar)) feil.push("manglar rapportveke");
  const alder = (Date.now() - Date.parse(d.bygd)) / 36e5;
  if (!Number.isFinite(alder) || alder < -0.1 || alder > 6) feil.push("ugyldig eller meir enn 6 timar gammalt byggtidspunkt");
  if (d.schemaVersjon !== 2 || !d.kjelder) feil.push("manglar dokumentert kjeldestatus");
  else {
    for (const namn of ["lakselus", "ais", "register", "soner", "pdsoner", "skipsregister", "bronnbatregister", "biomasse", "sjukdom", "soknader", "rensefisk"]) {
      const k = d.kjelder[namn];
      if (!k || !["ok", "delvis", "feila"].includes(k.status) || !Number.isFinite(Date.parse(k.henta))) {
        feil.push(`ugyldig kjeldestatus for ${namn}`);
      } else if (k.status !== "ok") {
        if (!k.melding) feil.push(`kjeldeutfall utan forklaring: ${namn}`);
        varsler.push(`${namn}: ${k.status}`);
      }
    }
    if (d.aisFeila !== (d.kjelder.ais?.status === "feila")) feil.push("AIS-feilflagget og kjeldestatus er usamde");
    if (d.aisFeila && d.fartoy?.length) feil.push("fartøy blir viste som ferske under AIS-feil");
    if (d.kjelder.lakselus?.status === "ok") {
      const n = d.lokalitetar?.filter((l) => typeof l.lus === "number").length ?? 0;
      if (n < 200) feil.push(`berre ${n} anlegg med lusetal trass frisk kjelde — undersøk før publisering`);
    }
  }
  const lokale = d.lokalitetar ?? [];
  if (new Set(lokale.map((l) => l.n)).size !== lokale.length) feil.push("duplikate lokalitetar");
  for (const l of lokale) {
    if (l.lus !== null && (typeof l.lus !== "number" || !Number.isFinite(l.lus) || l.lus < 0)) feil.push(`ugyldig lusetal på ${l.n}`);
    if (l.hist && l.hist.length !== d.veker?.length) feil.push(`feil historikklengd på ${l.n}`);
    if (l.rapport && (l.rapport.aar !== d.veke.aar || l.rapport.uke !== d.veke.uke)) feil.push(`feil rapportveke på ${l.n}`);
    if (l.rapport && l.hist && l.hist.at(-1) !== null && Math.abs(l.hist.at(-1) - l.lus) > 0.0051) feil.push(`kurve og siste tal er usamde på ${l.n}`);
  }
  const fartoy = d.fartoy ?? [];
  if (new Set(fartoy.map((f) => f.m)).size !== fartoy.length) feil.push("duplikate AIS-fartøy");
  for (const f of fartoy) {
    if (!Number.isFinite(f.la) || Math.abs(f.la) > 90 || !Number.isFinite(f.lo) || Math.abs(f.lo) > 180) feil.push(`ugyldig AIS-posisjon for ${f.m}`);
    if (!Number.isFinite(Date.parse(f.t)) || !/(Z|[+-]\d\d:\d\d)$/.test(f.t)) feil.push(`AIS-tid utan tidssone for ${f.m}`);
    if (f.ved && (f.fa === null || f.fa > 2 || f.fa < 0)) feil.push(`nærleik blir tolka frå ukjend/høg fart for ${f.m}`);
  }
}

function lokalFil(url) {
  if (/^(?:https?:|data:|\/\/|#)/.test(url)) return null;
  const fil = resolve(rot, url.split(/[?#]/)[0]);
  if (!fil.startsWith(rot + sep)) { feil.push(`ressurs utanfor app-mappa: ${url}`); return null; }
  if (!existsSync(fil)) { feil.push(`lokal ressurs manglar: ${url}`); return null; }
  return fil;
}
let skript = 0;
for (const m of h.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
  const attr = m[1];
  if (/\btype=["']application\/(?:ld\+)?json["']/i.test(attr) || /\bid=["']d["']/.test(attr)) continue;
  const src = attr.match(/\bsrc=["']([^"']+)["']/i)?.[1];
  const fil = src ? lokalFil(src) : null;
  if (src && !fil) continue;
  const kode = fil ? readFileSync(fil, "utf8") : m[2];
  if (!kode.trim()) continue;
  skript++;
  try { new Script(kode, { filename: fil ?? `${sti}:inline-${skript}` }); }
  catch (e) { feil.push(`JavaScript-feil: ${e.message}`); }
}
for (const m of h.matchAll(/<link\b[^>]*href=["']([^"']+)["'][^>]*>/gi)) lokalFil(m[1]);
if (!skript) feil.push("ingen køyrbare lokale skript");
if (!h.includes("leaflet")) feil.push("Leaflet manglar");
if (!h.includes("NLOD")) feil.push("NLOD-attribusjonen manglar");
if (!/name=["']viewport["']/.test(h) && !sti.endsWith("artifact.html")) feil.push("viewport for mobil manglar");

if (feil.length) {
  console.error("SJEKKEN FEILA:\n" + [...new Set(feil)].map((f) => "  ✗ " + f).join("\n"));
  process.exit(1);
}
for (const v of varsler) console.warn("KJELDEVARSEL: " + v);
console.log(`OK: ${d.hendingar.length} varsel · ${d.lokalitetar.length} anlegg · ${d.fartoy?.length ?? 0} fartøy · veke ${d.veke.uke} · ${skript} skript kontrollerte`);
