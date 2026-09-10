/**
 * Byggjer datasettet appen viser. Hentar alle kjelder, køyrer hendingsreglane,
 * og skriv ei kompakt JSON-fil som blir bygd inn i den publiserte sida.
 *
 * Køyr:  npm run bygg
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { hentVeke, type Luserapport } from "./ingest/mattilsynet.ts";
import { lesLoyverader, tilLokalitetar, type Lokalitet } from "./ingest/akvakulturregister.ts";
import { lesProduksjonsomrade, fyllProduksjonsomrade } from "./ingest/produksjonsomrade.ts";
import { hentSjukdom, hentSoknader, hentBiomasse } from "./ingest/kjelder.ts";
import { hentSanntid, hentSkipsinfo, gruppe, finnVedAnlegg } from "./ingest/ais.ts";
import { lesSoner, soneFor } from "./ingest/soner.ts";
import { hentBronnbatregister, pakallesignal, type Transporteining } from "./ingest/bronnbatregister.ts";
import {
  finnOverGrensa, finnLuseauke, finnBehandling, finnKlynger,
  finnSjukdom, finnSoknader, score, SEGMENT, type Hending,
} from "./events/hendingar.ts";
import { lusegrense } from "./events/lusegrense.ts";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

const VEKER = 8;
const dag = process.env["SNAPSHOT"] ?? new Date().toISOString().slice(0, 10);
const mappe = `${process.cwd()}/data/snapshots/${dag}`;

function isoVeke(d: Date): { aar: number; uke: number } {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7) + 3);
  const aar = t.getUTCFullYear();
  const f = new Date(Date.UTC(aar, 0, 4));
  f.setUTCDate(f.getUTCDate() - ((f.getUTCDay() + 6) % 7) + 3);
  return { aar, uke: 1 + Math.round((t.getTime() - f.getTime()) / (7 * 864e5)) };
}

function forrige(aar: number, uke: number, n: number): { aar: number; uke: number } {
  let a = aar, u = uke - n;
  while (u < 1) { a--; u += 52; }
  return { aar: a, uke: u };
}

console.log("Byggjer oppdretter-datasettet\n");

// ── Register ────────────────────────────────────────────────────────────────
const lokalitetar = tilLokalitetar(await lesLoyverader(`${mappe}/akvakulturregister.csv.gz`));
const poLag = lesProduksjonsomrade(`${mappe}/produksjonsomrader.geojson.gz`);
fyllProduksjonsomrade(lokalitetar, poLag);
const lok = new Map<number, Lokalitet>(lokalitetar.map((l) => [Number(l.lokalitetsnr), l]));
console.log(`  register        ${lokalitetar.length} lokalitetar`);

// ── Lus, siste VEKER veker ──────────────────────────────────────────────────
// Rapportfristen er tysdag i påfølgande veke, så siste heile veke er 2 bak.
const idag = new Date();
const no = isoVeke(idag);
// Rapportfristen er tysdag i påfølgande veke (§ 10). Er vi komne forbi tysdag,
// er førre veke komplett; er vi ikkje det, må vi to veker bak.
// getUTCDay: 0=sundag, 1=måndag, 2=tysdag.
const dagIVeka = idag.getUTCDay();
const forbiFrist = dagIVeka === 0 || dagIVeka >= 3;
const siste = forrige(no.aar, no.uke, forbiFrist ? 1 : 2);
console.log(`  rapportveke     ${siste.aar} v${siste.uke} (${forbiFrist ? "fristen er passert" : "ventar på fristen"})`);
const veker: { aar: number; uke: number }[] = [];
for (let i = VEKER - 1; i >= 0; i--) veker.push(forrige(siste.aar, siste.uke, i));

const perVeke = new Map<string, Luserapport[]>();
for (const v of veker) {
  const { rapportar } = await hentVeke(v.aar, v.uke);
  perVeke.set(`${v.aar}-${v.uke}`, rapportar);
  process.stdout.write(`  lus ${v.aar} v${String(v.uke).padStart(2)}  ${String(rapportar.length).padStart(4)} rapportar\n`);
}
const sisteRapportar = perVeke.get(`${siste.aar}-${siste.uke}`) ?? [];

// Tidsserie per lokalitet, til trend.
const serier = new Map<number, { aar: number; uke: number; lus: number }[]>();
for (const v of veker) {
  for (const r of perVeke.get(`${v.aar}-${v.uke}`) ?? []) {
    const lus = r.lusetelling?.voksneHunnlus;
    if (lus === null || lus === undefined) continue;
    serier.set(r.lokalitetsnummer, [...(serier.get(r.lokalitetsnummer) ?? []), { aar: v.aar, uke: v.uke, lus }]);
  }
}

// ── Andre kjelder ───────────────────────────────────────────────────────────
const sjukdom = await hentSjukdom();
console.log(`  sjukdom         ${sjukdom.length} gyldige saker`);
const opneSok = await hentSoknader(0);
console.log(`  søknader opne   ${opneSok.length}`);
const biomasse = await hentBiomasse();
const harFisk = new Map(biomasse.map((b) => [b.loknr, b.har_fisk === "Ja"]));
console.log(`  biomasse        ${biomasse.length} (${[...harFisk.values()].filter(Boolean).length} med fisk)`);

// ── Hendingar ───────────────────────────────────────────────────────────────
const c = { lok };
const hendingar: Hending[] = [
  ...finnOverGrensa(sisteRapportar, c),
  ...finnLuseauke(serier, c, siste.aar, siste.uke),
  ...finnBehandling(sisteRapportar, c),
  ...finnKlynger(sisteRapportar, c),
  ...finnSjukdom(sjukdom, c),
  // Lag 0 ER søknadene under behandling. Statusane som faktisk finst er
  // SUBMITTED (273) og RETURNED (36) — «UNDER_TREATMENT» og «RECEIVED» finst
  // ikkje. Eit filter på dei kasta 273 av 309 søknader og heldt att berre dei
  // som var sende i retur til søkjaren.
  ...finnSoknader(opneSok, c, true),
];

// Idempotens: same natural_key skal aldri gi to hendingar.
const unike = new Map(hendingar.map((h) => [h.natural_key, h]));
let alle = [...unike.values()];

// Eit varsel er ikkje eit varsel når det er eit halvt år gammalt. Sjukdomssaker
// og søknader går tilbake til 2023 i kjelda; dei er historikk, ikkje nyheiter.
const MAKS_ALDER_DAGAR: Record<string, number> = {
  sjukdom_paavist: 180,
  sjukdom_avslutta: 90,
  ny_soknad: 365,
  soknad_avgjort: 90,
};
const naa = Date.now();
const dagarSidan = (d: string): number => (naa - Date.parse(d)) / 864e5;
const foerKutt = alle.length;
alle = alle.filter((h) => {
  const maks = MAKS_ALDER_DAGAR[h.type];
  return maks === undefined || dagarSidan(h.dato) <= maks;
});
console.log(`  aldersfilter    ${foerKutt - alle.length} for gamle hendingar fjerna`);
if (alle.length !== hendingar.length) {
  console.log(`  (${hendingar.length - alle.length} duplikat fjerna via natural_key)`);
}

const tal = new Map<string, number>();
for (const h of alle) tal.set(h.type, (tal.get(h.type) ?? 0) + 1);
console.log(`\n  HENDINGAR: ${alle.length}`);
for (const [t, n] of [...tal].sort((a, b) => b[1] - a[1])) console.log(`    ${t.padEnd(20)} ${n}`);

// ── Fartøy ──────────────────────────────────────────────────────────────────
const anlegg = lokalitetar
  .filter((l) => l.lat !== null && l.lon !== null && l.plassering !== "LAND")
  .map((l) => ({ nr: Number(l.lokalitetsnr), namn: l.namn, lat: l.lat as number, lon: l.lon as number }));

let fartoy: ReturnType<typeof byggFartoy> = [];
let vedAnlegg: { mmsi: number; lokalitetsnr: number; lokalitetsnamn: string; avstandM: number }[] = [];
let aisTid = "";

function byggFartoy(
  pos: Awaited<ReturnType<typeof hentSanntid>>,
  info: Awaited<ReturnType<typeof hentSkipsinfo>>,
  ved: Map<number, { lokalitetsnr: number; lokalitetsnamn: string; avstandM: number }>,
  reg: Map<string, Transporteining>,
) {
  return pos.map((p) => {
    const i = info.get(p.mmsi);
    const v = ved.get(p.mmsi);
    const ks = (p.kallesignal ?? "").toUpperCase();
    const g = ks ? reg.get(ks) : undefined;
    return {
      m: p.mmsi,
      nm: i?.namn ?? p.namn,
      ks: ks || null,
      // Godkjenning frå Mattilsynet — det som gjer ein brønnbåt til ein brønnbåt.
      gk: g ? { v: g.verksemd, o: g.orgnr, n: g.namn, til: g.godkjentTil, fy: g.fylke } : null,
      la: Math.round(p.lat * 1e4) / 1e4,
      lo: Math.round(p.lon * 1e4) / 1e4,
      fa: p.fart,
      ku: p.kurs,
      le: i?.lengd ?? p.lengd,
      br: i?.breidd ?? null,
      de: p.destinasjon,
      g: gruppe(i, !!g),
      ty: i?.skipstype ?? null,
      t: p.tid,
      ved: v ? { n: v.lokalitetsnr, nm: v.lokalitetsnamn, d: v.avstandM } : null,
    };
  });
}

try {
  const pos = await hentSanntid();
  aisTid = pos.map((p) => p.tid).sort().at(-1) ?? "";
  console.log(`  AIS sanntid     ${pos.length} fartøy`);
  const info = await hentSkipsinfo(pos.map((p) => p.mmsi));
  console.log(`  skipsregister   ${info.size} klassifiserte`);
  const reg = pakallesignal(await hentBronnbatregister());
  console.log(`  brønnbåtregister ${reg.size} godkjende fartøy hos Mattilsynet`);
  const ved = finnVedAnlegg(pos, anlegg);
  vedAnlegg = ved;
  const vedKart = new Map(ved.map((v) => [v.mmsi, { lokalitetsnr: v.lokalitetsnr, lokalitetsnamn: v.lokalitetsnamn, avstandM: v.avstandM }]));
  fartoy = byggFartoy(pos, info, vedKart, reg);
  const gk = fartoy.filter((f) => f.g === "godkjend").length;
  const bb = fartoy.filter((f) => f.g === "brønnbåt").length;
  const gkVed = fartoy.filter((f) => f.g === "godkjend" && f.ved).length;
  console.log(`  godkjende i sjøen ${gk} (${gkVed} ligg ved eit anlegg)`);
  console.log(`  uverifiserte      ${bb} melder «Fish Carrier» utan godkjenning`);
} catch (e) {
  console.log(`  AIS FEILA: ${(e as Error).message} — appen blir bygd utan fartøy`);
}

// ── Kartdata ────────────────────────────────────────────────────────────────
const sisteLus = new Map<number, number>();
for (const r of sisteRapportar) {
  const v = r.lusetelling?.voksneHunnlus;
  if (v !== null && v !== undefined) sisteLus.set(r.lokalitetsnummer, v);
}

const soner = lesSoner(mappe);
console.log(`  aktive soner    ${soner.length}`);

const kartLok = lokalitetar
  .filter((l) => l.lat !== null && l.lon !== null && l.plassering !== "LAND")
  .map((l) => {
    const nr = Number(l.lokalitetsnr);
    const lus = sisteLus.get(nr);
    const g = lusegrense(l.fylkenr, siste.aar, siste.uke);
    return {
      n: nr,
      nm: l.namn,
      la: Math.round((l.lat ?? 0) * 1e4) / 1e4,
      lo: Math.round((l.lon ?? 0) * 1e4) / 1e4,
      po: l.produksjonsomrade,
      f: l.fylke,
      s: l.innehavarar[0]?.namn ?? null,
      k: l.kapasitetEining === "TN" ? l.kapasitet : null,
      lus: lus ?? null,
      gr: g.verdi,
      fisk: harFisk.get(nr) ?? null,
      km: l.kommune,
      ar: l.artar,
      // Aktive ILA-/PD-soner lokaliteten ligg inne i.
      so: soneFor(l.lon ?? 0, l.lat ?? 0, soner).map((z) => ({ t: z.type, f: z.forskrift })),
      // Åtte veker lusetal, til trendkurva i detaljpanelet. null = ingen rapport.
      hist: veker.map((v) => {
        const p = serier.get(nr)?.find((x) => x.aar === v.aar && x.uke === v.uke);
        return p ? Math.round(p.lus * 100) / 100 : null;
      }),
    };
  });

// Forenkla PO-polygon som bakgrunn. Held annakvart punkt for å spare plass.
function tynn(ringar: number[][][], hopp: number): number[][][] {
  return ringar.map((r) =>
    r.filter((_, i) => i % hopp === 0 || i === r.length - 1).map((p) => [
      Math.round((p[0] ?? 0) * 1e3) / 1e3,
      Math.round((p[1] ?? 0) * 1e3) / 1e3,
    ]),
  );
}
const poRå = JSON.parse(gunzipSync(readFileSync(`${mappe}/produksjonsomrader.geojson.gz`)).toString()) as {
  features: { properties: Record<string, unknown>; geometry: { type: string; coordinates: unknown } }[];
};
const poGeo = poRå.features.map((f) => {
  const g = f.geometry;
  const polys = g.type === "MultiPolygon" ? (g.coordinates as number[][][][]) : [g.coordinates as number[][][]];
  return {
    id: Number(f.properties["id"]),
    nm: String(f.properties["name"] ?? ""),
    st: String(f.properties["status"] ?? ""),
    p: polys.map((p) => tynn(p, 4)),
  };
});

// ── Skriv ───────────────────────────────────────────────────────────────────
const data = {
  bygd: new Date().toISOString(),
  veke: { aar: siste.aar, uke: siste.uke },
  veker,
  hendingar: alle
    .map((h) => {
      const d = Math.max(0, dagarSidan(h.dato));
      // Full vekt i to veker, så jamn nedtrapping til 35 % etter eit halvt år.
      const fersk = d <= 14 ? 1 : Math.max(0.35, 1 - (d - 14) / 260);
      return { ...h, topp: score(h, "alle"), dagar: Math.round(d), fersk: Math.round(fersk * 100) / 100 };
    })
    .sort((a, b) => b.topp * b.fersk - a.topp * a.fersk),
  lokalitetar: kartLok,
  fartoy,
  aisTid,
  po: poGeo,
  segment: SEGMENT,
  statistikk: {
    lokalitetar: lokalitetar.length,
    rapportar: sisteRapportar.length,
    medFisk: [...harFisk.values()].filter(Boolean).length,
    selskap: new Set(lokalitetar.flatMap((l) => l.innehavarar.map((i) => i.orgnr)).filter(Boolean)).size,
    fartoy: fartoy.length,
    bronnbat: fartoy.filter((f) => f.g === "brønnbåt").length,
    godkjend: fartoy.filter((f) => f.g === "godkjend").length,
    registrerte: 0, // fyllast under
    vedAnlegg: vedAnlegg.length,
  },
};

mkdirSync(`${process.cwd()}/data/app`, { recursive: true });
const ut = `${process.cwd()}/data/app/data.json`;
writeFileSync(ut, JSON.stringify(data));
const kb = Math.round(JSON.stringify(data).length / 1024);
console.log(`\n  Skrive ${ut} (${kb} kB)`);
const iSone = kartLok.filter((l) => l.so.length > 0).length;
console.log(`  I sjukdomssone: ${iSone} lokalitetar`);
console.log(`  Kartpunkt: ${kartLok.length}  |  PO-polygon: ${poGeo.length}  |  Fartøy: ${fartoy.length}`);
