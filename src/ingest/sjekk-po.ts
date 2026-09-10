import { lesLoyverader, tilLokalitetar } from "./akvakulturregister.ts";
import { lesProduksjonsomrade, fyllProduksjonsomrade } from "./produksjonsomrade.ts";

const dag = process.argv[2] ?? new Date().toISOString().slice(0, 10);
const mappe = `${process.cwd()}/data/snapshots/${dag}`;

const lok = tilLokalitetar(await lesLoyverader(`${mappe}/akvakulturregister.csv.gz`));
const po = lesProduksjonsomrade(`${mappe}/produksjonsomrader.geojson.gz`);

console.log(`Produksjonsområde, snapshot ${dag}\n`);
console.log(`  polygon lasta: ${po.length} (PO ${po[0]?.verdi.id}–${po[po.length - 1]?.verdi.id})`);

const foer = lok.filter((l) => l.produksjonsomrade !== null).length;
const r = fyllProduksjonsomrade(lok, po);
const etter = lok.filter((l) => l.produksjonsomrade !== null).length;

console.log(`\n  hadde PO frå registeret : ${foer} (${((foer / lok.length) * 100).toFixed(1)} %)`);
console.log(`  fylt ut frå geometri     : ${r.fyltUt}`);
console.log(`  utan treff i noko polygon: ${r.utanTreff.length}`);
console.log(`  DEKNING ETTER            : ${etter} av ${lok.length} (${((etter / lok.length) * 100).toFixed(1)} %)`);

console.log(`\n  Kryssjekk der begge finst:`);
console.log(`    einige : ${r.einige} av ${r.alleredeSatt}`);
console.log(`    usamde : ${r.usamde.length}`);
for (const u of r.usamde.slice(0, 8)) {
  console.log(`      lok ${u.lokalitetsnr}: registeret seier PO ${u.register}, geometrien seier PO ${u.geometri}`);
}

const utan = lok.filter((l) => l.produksjonsomrade === null);
console.log(`\n  Utan PO etter utfylling (${utan.length}) — fordeling på plassering:`);
const plass = new Map<string, number>();
for (const l of utan) plass.set(l.plassering, (plass.get(l.plassering) ?? 0) + 1);
for (const [p, n] of [...plass].sort((a, b) => b[1] - a[1])) {
  console.log(`    ${(p || "(tom)").padEnd(10)} ${n}`);
}

const fordeling = new Map<number, number>();
for (const l of lok) if (l.produksjonsomrade !== null) {
  fordeling.set(l.produksjonsomrade, (fordeling.get(l.produksjonsomrade) ?? 0) + 1);
}
console.log(`\n  Lokalitetar per produksjonsområde:`);
for (const p of po) {
  const n = fordeling.get(p.verdi.id) ?? 0;
  console.log(`    PO ${String(p.verdi.id).padStart(2)}  ${p.verdi.namn.padEnd(32)} ${String(n).padStart(4)}  ${p.verdi.status}`);
}
