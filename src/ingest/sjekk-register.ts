/**
 * Sjekkar normaliseringa mot dei tala kartlegginga fann. Køyrer på snapshotet.
 * Formålet er å oppdage om kjelda endrar seg under føtene på oss.
 */
import { lesLoyverader, tilLokalitetar } from "./akvakulturregister.ts";

const dag = process.argv[2] ?? new Date().toISOString().slice(0, 10);
const sti = `${process.cwd()}/data/snapshots/${dag}/akvakulturregister.csv.gz`;

const rader = await lesLoyverader(sti);
const lok = tilLokalitetar(rader);

const orgnr = new Set<string>();
let personRader = 0;
const personar = new Set<string>();
for (const l of lok) {
  for (const i of l.innehavarar) {
    if (i.orgnr) orgnr.add(i.orgnr);
    else { personRader++; personar.add(i.namn); }
  }
}

const fleire = lok.filter((l) => l.innehavarar.length > 1);
const maksInnehavarar = Math.max(...lok.map((l) => l.innehavarar.length));
const medPO = lok.filter((l) => l.produksjonsomrade !== null).length;
const medKoord = lok.filter((l) => l.lat !== null && l.lon !== null).length;

const einingar = new Map<string, number>();
for (const r of rader) {
  const e = r["LOK_ENHET"] || "(tom)";
  einingar.set(e, (einingar.get(e) ?? 0) + 1);
}

const sumRiktig = lok
  .filter((l) => l.kapasitetEining === "TN")
  .reduce((s, l) => s + (l.kapasitet ?? 0), 0);
const sumNaivt = rader
  .filter((r) => r["LOK_ENHET"] === "TN")
  .reduce((s, r) => s + Number((r["LOK_KAP"] ?? "0").replace(",", ".") || 0), 0);

console.log(`Akvakulturregisteret, snapshot ${dag}\n`);
console.log(`  løyve-rader          ${rader.length}`);
console.log(`  unike lokalitetar    ${lok.length}`);
console.log(`  unike organisasjonsnr ${orgnr.size}`);
console.log(`  privatperson-rader   ${personRader} (${personar.size} unike personar)`);
console.log(`  med >1 innehavar     ${fleire.length} (${((fleire.length / lok.length) * 100).toFixed(1)} %), maks ${maksInnehavarar}`);
console.log(`  med produksjonsområde ${medPO} (${((medPO / lok.length) * 100).toFixed(1)} %)`);
console.log(`  med koordinatar      ${medKoord} (${((medKoord / lok.length) * 100).toFixed(1)} %)`);

console.log(`\n  Kapasitetseiningar (løyve-rader):`);
for (const [e, n] of [...einingar].sort((a, b) => b[1] - a[1])) {
  console.log(`    ${e.padEnd(8)} ${n}`);
}

console.log(`\n  MTB i tonn, dedup på lokalitet: ${Math.round(sumRiktig).toLocaleString("nn-NO")} tonn`);
console.log(`  Same tal summert naivt over alle rader: ${Math.round(sumNaivt).toLocaleString("nn-NO")} tonn`);
console.log(`  → overteljing ${(sumNaivt / sumRiktig).toFixed(1)}x om ein gløymer dedup`);

const verstingar = [...lok].sort((a, b) => b.innehavarar.length - a.innehavarar.length).slice(0, 3);
console.log(`\n  Lokalitetar med flest innehavarar:`);
for (const l of verstingar) {
  console.log(`    ${l.lokalitetsnr} ${l.namn} — ${l.innehavarar.length} innehavarar`);
}
