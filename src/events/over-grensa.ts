/**
 * Ende-til-ende-prøve: hentar ei rapportveke frå Mattilsynet, koplar kvar
 * lokalitet mot Akvakulturregisteret (fylke + produksjonsområde), reknar ut
 * lusegrensa etter § 8, og listar kven som ligg over.
 *
 * Køyr:  npm run over-grensa -- 2026 36
 */
import { hentVeke, harBehandling, type Luserapport } from "../ingest/mattilsynet.ts";
import { lesLoyverader, tilLokalitetar, type Lokalitet } from "../ingest/akvakulturregister.ts";
import { lesProduksjonsomrade, fyllProduksjonsomrade } from "../ingest/produksjonsomrade.ts";
import { lusegrense, erOverGrensa, region } from "./lusegrense.ts";

const aar = Number(process.argv[2] ?? 2026);
const uke = Number(process.argv[3] ?? 36);
const dag = process.argv[4] ?? new Date().toISOString().slice(0, 10);
const mappe = `${process.cwd()}/data/snapshots/${dag}`;

// 1. Registeret gir fylke, koordinatar og eigar. Kjelde: Fiskeridirektoratet.
const lokalitetar = tilLokalitetar(await lesLoyverader(`${mappe}/akvakulturregister.csv.gz`));
fyllProduksjonsomrade(lokalitetar, lesProduksjonsomrade(`${mappe}/produksjonsomrader.geojson.gz`));
const register = new Map<number, Lokalitet>(
  lokalitetar.map((l) => [Number(l.lokalitetsnr), l]),
);

// 2. Lusetala. Kjelde: Mattilsynet.
const { rapportar, totaltFraApi, forkasta } = await hentVeke(aar, uke);

console.log(`Lakselus ${aar} veke ${uke}\n`);
console.log(`  rapportar frå Mattilsynet : ${rapportar.length} (x-count sa ${totaltFraApi})`);
if (forkasta) console.log(`  forkasta rader            : ${forkasta}`);

let utanRegister = 0;
type Rad = { r: Luserapport; l: Lokalitet; lus: number; grense: number; over: boolean };
const rader: Rad[] = [];

for (const r of rapportar) {
  const l = register.get(r.lokalitetsnummer);
  if (!l) { utanRegister++; continue; }
  const lus = r.lusetelling?.voksneHunnlus;
  if (lus === null || lus === undefined) continue;
  const g = lusegrense(l.fylkenr, r.år, r.uke);
  if (!g.gyldig) continue;
  rader.push({ r, l, lus, grense: g.verdi, over: erOverGrensa(lus, g) });
}

console.log(`  kopla mot registeret      : ${rader.length}`);
console.log(`  ikkje funne i registeret  : ${utanRegister}`);

const g0 = lusegrense("18", aar, uke);
const g1 = lusegrense("46", aar, uke);
console.log(`\n  Grense denne veka (${g0.heimel}):`);
console.log(`    nord (Nordland/Troms/Finnmark): ${g0.verdi}`);
console.log(`    sør  (resten av landet)       : ${g1.verdi}`);

const over = rader.filter((x) => x.over).sort((a, b) => b.lus - a.lus);
console.log(`\n  OVER GRENSA: ${over.length} av ${rader.length} lokalitetar\n`);
for (const x of over.slice(0, 15)) {
  const eigar = x.l.innehavarar[0]?.namn ?? x.r.organisasjonsnavn ?? "?";
  const beh = harBehandling(x.r) ? "  [behandlar]" : "";
  console.log(
    `    ${String(x.lus.toFixed(2)).padStart(5)} / ${x.grense}  ` +
      `${x.r.lokalitetsnavn.padEnd(24).slice(0, 24)} ` +
      `PO ${String(x.l.produksjonsomrade ?? "?").padStart(2)}  ` +
      `${region(x.l.fylkenr).padEnd(4)} ${eigar.slice(0, 28)}${beh}`,
  );
}
if (over.length > 15) console.log(`    … og ${over.length - 15} til`);

// Behandlingsklynge: tre eller fleire i same produksjonsområde same veke.
const behPerPo = new Map<number, string[]>();
for (const x of rader) {
  if (!harBehandling(x.r) || x.l.produksjonsomrade === null) continue;
  const liste = behPerPo.get(x.l.produksjonsomrade) ?? [];
  liste.push(x.r.lokalitetsnavn);
  behPerPo.set(x.l.produksjonsomrade, liste);
}
const klynger = [...behPerPo.entries()].filter(([, v]) => v.length >= 3).sort((a, b) => b[1].length - a[1].length);
const behTotalt = [...behPerPo.values()].reduce((s, v) => s + v.length, 0);
console.log(`\n  Behandlingar denne veka: ${behTotalt}`);
console.log(`  Behandlingsklynger (≥3 i same produksjonsområde): ${klynger.length}`);
for (const [po, namn] of klynger.slice(0, 6)) {
  console.log(`    PO ${String(po).padStart(2)}: ${namn.length} lokalitetar — ${namn.slice(0, 3).join(", ")}${namn.length > 3 ? " …" : ""}`);
}

// Den viktigaste fella: kven har fisk, men ingen rapport?
const rapporterte = new Set(rapportar.map((r) => r.lokalitetsnummer));
console.log(`\n  Lokalitetar med rapport   : ${rapporterte.size}`);
console.log(`  (Manglande rapport = UKJENT, ikkje trygt. Sjå docs/UTAN-KONTO.md § 1.)`);
