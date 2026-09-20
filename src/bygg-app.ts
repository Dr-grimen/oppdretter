/**
 * Byggjer datasettet appen viser. Hentar alle kjelder, køyrer hendingsreglane,
 * og skriv ei kompakt JSON-fil som blir bygd inn i den publiserte sida.
 *
 * Køyr:  npm run bygg
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { hentVeke, rapportDetalj, type Luserapport } from "./ingest/mattilsynet.ts";
import { lesLoyverader, tilLokalitetar, offentlegEigar, type Lokalitet } from "./ingest/akvakulturregister.ts";
import { lesProduksjonsomrade, fyllProduksjonsomrade } from "./ingest/produksjonsomrade.ts";
import { finnFoerste } from "./lib/geo.ts";
import { hentSjukdom, hentSoknader, hentBiomasse, sjukdomDetalj } from "./ingest/kjelder.ts";
import { hentSanntid, hentSkipsinfoMedStatus, gruppe, finnVedAnlegg } from "./ingest/ais.ts";
import { lesSonerMedStatus, soneFor, sonerGeo, lesPdOmrade } from "./ingest/soner.ts";
import { hentBronnbatregister, pakallesignal, type Transporteining } from "./ingest/bronnbatregister.ts";
import {
  finnOverGrensa, finnLuseauke, finnBehandling, finnKlynger,
  finnSjukdom, finnSoknader, settPoOppslag, score, driftsvekt, SEGMENT, type Hending,
} from "./events/hendingar.ts";
import { lusegrense } from "./events/lusegrense.ts";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { forrige, sisteRapportveke } from "./lib/tid.ts";
import { valfriKjelde, type Kjeldestatus } from "./lib/kjeldestatus.ts";
import { hentRensefisk, sisteRensefisk, rensefiskDetalj } from "./ingest/rensefisk.ts";
import { lesBwSjukdom } from "./ingest/bw-sjukdom.ts";
import { lesIla10km, ila10kmTreff } from "./ingest/ila10km.ts";

const VEKER = 8;
const dag = process.env["SNAPSHOT"] ?? new Date().toISOString().slice(0, 10);
const mappe = `${process.cwd()}/data/snapshots/${dag}`;

const kjelder: Record<string, Kjeldestatus> = {};
const snapshotTid = `${dag}T00:00:00Z`;
const bwSjukdom = lesBwSjukdom(mappe, snapshotTid);
Object.assign(kjelder, bwSjukdom.kjelder);
const ila10km = lesIla10km(mappe, snapshotTid);
kjelder.ila10km = ila10km.status;

console.log("Byggjer oppdretter-datasettet\n");

// ── Register ────────────────────────────────────────────────────────────────
const lokalitetar = tilLokalitetar(await lesLoyverader(`${mappe}/akvakulturregister.csv.gz`));
const poLag = lesProduksjonsomrade(`${mappe}/produksjonsomrader.geojson.gz`);
fyllProduksjonsomrade(lokalitetar, poLag);
const lok = new Map<number, Lokalitet>(lokalitetar.map((l) => [Number(l.lokalitetsnr), l]));
console.log(`  register        ${lokalitetar.length} lokalitetar`);

// ── Lus, siste VEKER veker ──────────────────────────────────────────────────
// The deadline ends on Tuesday in Norway, regardless of the runner timezone.
const idag = new Date();
const { forbiFrist, ...siste } = sisteRapportveke(idag);
console.log(`  rapportveke     ${siste.aar} v${siste.uke} (${forbiFrist ? "fristen er passert" : "ventar på fristen"})`);
const veker: { aar: number; uke: number }[] = [];
for (let i = VEKER - 1; i >= 0; i--) veker.push(forrige(siste.aar, siste.uke, i));

const perVeke = new Map<string, Luserapport[]>();
const feilaVeker: string[] = [];
for (const v of veker) {
  const svar = await valfriKjelde(async () => (await hentVeke(v.aar, v.uke)).rapportar);
  const nøkkel = `${v.aar}-${v.uke}`;
  if (svar.status.status === "feila") feilaVeker.push(nøkkel);
  perVeke.set(nøkkel, svar.data);
  process.stdout.write(`  lus ${v.aar} v${String(v.uke).padStart(2)}  ${svar.data.length} rapportar (${svar.status.status})\n`);
}
const alleRapportar = [...perVeke.values()].flat();
kjelder.lakselus = {
  status: feilaVeker.length === veker.length ? "feila" : feilaVeker.length ? "delvis" : "ok",
  henta: new Date().toISOString(), tal: alleRapportar.length,
  ...(alleRapportar.length ? { dataTid: alleRapportar.map((r) => r.rapporteringstidspunkt).sort().at(-1)! } : {}),
  ...(feilaVeker.length ? { melding: `Kunne ikkje hente rapportvekene ${feilaVeker.join(", ")}. Tala for desse vekene er ukjende.` } : {}),
};
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
const sjukdomSvar = await valfriKjelde(hentSjukdom);
const sjukdom = sjukdomSvar.data;
kjelder.sjukdom = sjukdomSvar.status;
const soknadSvar = await valfriKjelde(() => hentSoknader(0));
const opneSok = soknadSvar.data;
kjelder.soknader = soknadSvar.status;
const biomasseSvar = await valfriKjelde(hentBiomasse);
const biomasse = biomasseSvar.data;
kjelder.biomasse = biomasseSvar.status;
const harFisk = new Map(biomasse.map((b) => [b.loknr, b.har_fisk === "Ja" ? true : b.har_fisk === "Nei" ? false : null]));
const biomasseTid = new Map(biomasse.map((b) => [b.loknr, b.siste_rapport]));
const rensefiskSvar = await valfriKjelde(hentRensefisk);
kjelder.rensefisk = rensefiskSvar.status;
const rensefisk = sisteRensefisk(rensefiskSvar.data);
const sjukdomPerLok = new Map<number, ReturnType<typeof sjukdomDetalj>[]>();
for (const s of sjukdom) sjukdomPerLok.set(s.lokalitetsnummer, [...(sjukdomPerLok.get(s.lokalitetsnummer) ?? []), sjukdomDetalj(s)]);
if (rensefiskSvar.data.length) kjelder.rensefisk.dataTid = rensefiskSvar.data.map((r) => r.rapporteringstidspunkt).sort().at(-1)!;
console.log(`  sjukdom ${sjukdom.length} · søknader ${opneSok.length} · biomasse ${biomasse.length} · rensefisk ${rensefisk.size}`);

// ── Hendingar ───────────────────────────────────────────────────────────────
settPoOppslag((lon, lat) => finnFoerste(lon, lat, poLag)?.id ?? null);
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
if (unike.size !== hendingar.length) {
  console.log(`  (${hendingar.length - unike.size} duplikat fjerna via natural_key)`);
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
let aisFeila = false;
let registrerteBronnbatar = 0;

function byggFartoy(
  pos: Awaited<ReturnType<typeof hentSanntid>>,
  info: Awaited<ReturnType<typeof hentSkipsinfoMedStatus>>["info"],
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
      gk: g ? { v: g.verksemd, o: g.orgnr, n: g.namn, fra: g.godkjentFra, til: g.godkjentTil, fy: g.fylke } : null,
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

// Keep valid positions if vessel metadata fails. Every failure is explicit.
const aisSvar = await valfriKjelde(hentSanntid);
kjelder.ais = aisSvar.status;
aisFeila = aisSvar.status.status === "feila";
const pos = aisSvar.data;
aisTid = pos.map((p) => p.tid).sort().at(-1) ?? "";
if (aisTid) kjelder.ais.dataTid = aisTid;
if (aisTid && Date.now() - Date.parse(aisTid) > 30 * 60_000) {
  kjelder.ais.status = "delvis";
  kjelder.ais.melding = "AIS-posisjonane er eldre enn 30 minutt. Dette er ikkje sanntid.";
}
const infoSvar = await hentSkipsinfoMedStatus(pos.map((p) => p.mmsi));
kjelder.skipsregister = {
  status: aisFeila || (infoSvar.bolkar > 0 && infoSvar.feilaBolkar === infoSvar.bolkar) ? "feila" : infoSvar.feilaBolkar ? "delvis" : "ok",
  henta: new Date().toISOString(), tal: infoSvar.info.size,
  ...(aisFeila || infoSvar.feilaBolkar ? { melding: "Nokre fartøy kan ikkje klassifiserast fordi registerdata manglar." } : {}),
};
const regSvar = await valfriKjelde(hentBronnbatregister);
kjelder.bronnbatregister = regSvar.status;
const reg = pakallesignal(regSvar.data);
registrerteBronnbatar = reg.size;
const ved = finnVedAnlegg(pos, anlegg);
vedAnlegg = ved;
const vedKart = new Map(ved.map((v) => [v.mmsi, { lokalitetsnr: v.lokalitetsnr, lokalitetsnamn: v.lokalitetsnamn, avstandM: v.avstandM }]));
const alleFartoy = byggFartoy(pos, infoSvar.info, vedKart, reg);
// Keep all observed vessels: traffic and health share one map. UI controls
// the relevant-vessels filter; metadata failure must not erase positions.
fartoy = alleFartoy;
console.log(`  AIS ${pos.length} fartøy · ${reg.size} godkjende i registeret · status ${kjelder.ais.status}`);

// ── Kartdata ────────────────────────────────────────────────────────────────
const sisteLus = new Map<number, number>();
for (const r of sisteRapportar) {
  const v = r.lusetelling?.voksneHunnlus;
  if (v !== null && v !== undefined) sisteLus.set(r.lokalitetsnummer, v);
}

const soneSvar = lesSonerMedStatus(mappe);
const soner_ = soneSvar.soner;
const pdSvar = lesPdOmrade(mappe);
kjelder.pdsoner = {
  status: pdSvar.feila ? "feila" : "ok", henta: snapshotTid, tal: pdSvar.soner.length,
  ...(pdSvar.feila ? { melding: "Nasjonale PD-område kunne ikkje lesast frå BarentsWatch." } : {}),
};
kjelder.soner = {
  status: soneSvar.feilaLag.length === 4 && !soner_.length ? "feila" : soneSvar.feilaLag.length ? "delvis" : "ok",
  henta: snapshotTid, tal: soner_.length,
  ...(soneSvar.feilaLag.length ? { melding: `Sonedata manglar for ${soneSvar.feilaLag.join(", ")}.` } : {}),
};
kjelder.register = { status: "ok", henta: snapshotTid, tal: lokalitetar.length };
const rapportPerLok = new Map(sisteRapportar.map((r) => [r.lokalitetsnummer, r]));
console.log(`  aktive soner    ${soner_.length}`);

/** Lusegrensa i FOR-2012-12-05-1140 § 8 gjeld laksefisk. Blåskjell, tare,
 *  torsk og østers har ikkje lakselus, og skal ikkje merkast «ingen luserapport». */
const LAKSEFISK = ["LAKS", "ØRRET", "REGNBUEØRRET", "REGNBUEAURE", "AURE"];
function harLaksefisk(l: Lokalitet): boolean {
  return l.artar.some((a) => LAKSEFISK.some((k) => a.toUpperCase().includes(k)));
}

const kartLok = lokalitetar
  .filter((l) => l.lat !== null && l.lon !== null && l.plassering !== "LAND")
  .map((l) => {
    const nr = Number(l.lokalitetsnr);
    const lus = sisteLus.get(nr);
    const rapport = rapportPerLok.get(nr);
    const rf = rensefisk.get(nr);
    const ilaRingar = ila10kmTreff(l.lon ?? 0, l.lat ?? 0, ila10km.ringar);
    const g = lusegrense(l.fylkenr, siste.aar, siste.uke);
    const laksefisk = harLaksefisk(l);
    const historikk = veker.map((v) => {
      const p = serier.get(nr)?.find((x) => x.aar === v.aar && x.uke === v.uke);
      return p ? Math.round(p.lus * 100) / 100 : null;
    });
    const harHistorikk = historikk.some((x) => x !== null);
    const soner = soneFor(l.lon ?? 0, l.lat ?? 0, soner_).map((z) => ({ t: z.type, f: z.forskrift }));
    // Tomme felt blir utelatne heilt. 708 av 1377 anlegg har ikkje eit einaste
    // lusetal, og bar før ei liste med åtte null-verdiar kvar.
    return {
      n: nr,
      nm: l.namn,
      la: Math.round((l.lat ?? 0) * 1e4) / 1e4,
      lo: Math.round((l.lon ?? 0) * 1e4) / 1e4,
      po: l.produksjonsomrade,
      pdOmrade: finnFoerste(l.lon ?? 0, l.lat ?? 0, pdSvar.soner)?.id ?? null,
      f: l.fylke,
      s: offentlegEigar(l),
      k: l.kapasitetEining === "TN" ? l.kapasitet : null,
      lus: lus ?? null,
      ...(rapport ? { rapport: rapportDetalj(rapport) } : {}),
      ...(rf ? { rensefisk: rensefiskDetalj(rf) } : {}),
      ...(sjukdomPerLok.has(nr) ? { sjukdom: sjukdomPerLok.get(nr) } : {}),
      ...(bwSjukdom.perLokalitet.has(nr) ? { bwSjukdom: bwSjukdom.perLokalitet.get(nr) } : {}),
      ...(ilaRingar.length ? { ila10km: ilaRingar } : {}),
      ...(biomasseTid.get(nr) ? { fiskTid: biomasseTid.get(nr) } : {}),
      ...(laksefisk ? { gr: g.verdi } : { lf: false }),
      fisk: harFisk.get(nr) ?? null,
      km: l.kommune,
      ...(l.artar.length ? { ar: l.artar.slice(0, 2) } : {}),
      ...(soner.length ? { so: soner } : {}),
      ...(harHistorikk ? { hist: historikk } : {}),
      // Lusegrensa er ikkje konstant gjennom vindauget: 0,2 i veke 16-21 sør og
      // 21-26 nord. Ei kurve med éi grenselinje over åtte veker viser feil grense
      // for delar av perioden. Difor grensa per veke.
      ...(harHistorikk
        ? { grh: veker.map((v) => lusegrense(l.fylkenr, v.aar, v.uke).verdi) }
        : {}),
    };
  });

// Forenkla PO-polygon som bakgrunn. Held annakvart punkt for å spare plass.
/**
 * Rundar polygonkoordinatane til tre desimalar (~100 m). Vi tynna dette
 * hardare før — kvart fjerde punkt — men då låg 255 anlegg synleg utanfor sitt
 * eige produksjonsområde. Full oppløysing kostar 4 kB og gir null slike.
 */
function rundPolygon(ringar: number[][][]): number[][][] {
  return ringar.map((r) =>
    r.map((p) => [Math.round((p[0] ?? 0) * 1e3) / 1e3, Math.round((p[1] ?? 0) * 1e3) / 1e3]),
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
    p: polys.map(rundPolygon),
  };
});

// ── Skriv ───────────────────────────────────────────────────────────────────
const kvifortabell = (() => {
  const sett = new Set<string>();
  for (const h of alle) for (const r of Object.values(h.relevans)) sett.add(r.why);
  return [...sett];
})();

const data = {
  bygd: new Date().toISOString(),
  schemaVersjon: 2,
  kjelder,
  feilaVeker,
  aisFeila,
  snapshot: dag,
  veke: { aar: siste.aar, uke: siste.uke },
  veker,
  // Dei same «kvifor»-tekstane går att i hundrevis av hendingar. Vi lagrar dei
  // éin gong og viser til dei med indeks.
  kvifor: kvifortabell,
  hendingar: alle
    .map((h) => {
      const d = Math.max(0, dagarSidan(h.dato));
      // Full vekt i to veker, så jamn nedtrapping til 35 % etter eit halvt år.
      const fersk = d <= 14 ? 1 : Math.max(0.35, 1 - (d - 14) / 260);
      // natural_key trengst berre i ingest for idempotens, ikkje i appen.
      const { natural_key, relevans, ...rest } = h;
      return {
        ...rest,
        // [segment]: [score, indeks i kvifor-lista]
        rel: Object.fromEntries(
          Object.entries(relevans).map(([k, v]) => [k, [v.score, kvifortabell.indexOf(v.why)]]),
        ),
        topp: score(h, "alle"),
        drift: driftsvekt(h),
        dagar: Math.round(d),
        fersk: Math.round(fersk * 100) / 100,
      };
    })
    .sort((a, b) => b.topp * b.fersk - a.topp * a.fersk),
  lokalitetar: kartLok,
  fartoy,
  aisTid,
  po: poGeo,
  sonerGeo: sonerGeo(soner_),
  pdSonerGeo: pdSvar.soner.map(({ verdi, geometri }) => ({ ...verdi, geometry: geometri })),
  ila10kmGeo: ila10km.ringar,
  segment: SEGMENT,
  statistikk: {
    lokalitetar: lokalitetar.length,
    rapportar: sisteRapportar.length,
    medLusetal: kartLok.filter((l) => l.lus !== null).length,
    utanLusetal: kartLok.filter((l) => !("lf" in l && l.lf === false) && l.lus === null).length,
    overGrensa: kartLok.filter((l) => l.lus !== null && "gr" in l && l.lus >= l.gr).length,
    medFisk: [...harFisk.values()].filter(Boolean).length,
    selskap: new Set(lokalitetar.flatMap((l) => l.innehavarar.map((i) => i.orgnr)).filter(Boolean)).size,
    fartoy: fartoy.length,
    bronnbat: fartoy.filter((f) => f.g === "brønnbåt").length,
    godkjend: fartoy.filter((f) => f.g === "godkjend").length,
    registrerte: registrerteBronnbatar,
    // Berre godkjende brønnbåtar og «Fish Carrier» — ikkje losbåtar, ferjer
    // og redningsskøyter som tilfeldigvis ligg innanfor 500 m.
    vedAnlegg: fartoy.filter((f) => f.ved && (f.g === "godkjend" || f.g === "brønnbåt")).length,
    vedAnleggAlle: vedAnlegg.length,
  },
};

mkdirSync(`${process.cwd()}/data/app`, { recursive: true });
const ut = `${process.cwd()}/data/app/data.json`;
writeFileSync(ut, JSON.stringify(data));
const kb = Math.round(JSON.stringify(data).length / 1024);
console.log(`\n  Skrive ${ut} (${kb} kB)`);
const iSone = kartLok.filter((l) => (l.so?.length ?? 0) > 0).length;
console.log(`  I sjukdomssone: ${iSone} lokalitetar`);
console.log(`  Kartpunkt: ${kartLok.length}  |  PO-polygon: ${poGeo.length}  |  Fartøy: ${fartoy.length}`);
