/**
 * Skriv eit kompakt dagleg arkiv av tilstanden vi diffar på.
 *
 * Rå snapshot er 1,9 MB per dag og ville sprengt repoet på eit år. Arkivet
 * held berre felta hendingsreglane treng for å oppdage endring, og blir
 * committa. Rådata blir liggjande lokalt og i Actions-køyringa.
 *
 * Dette er den einaste fila som ikkje kan hentast inn att seinare — kjeldene
 * overskriv seg sjølve. Difor blir den skriven først, og feil her skal stoppe
 * heile køyringa.
 */
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { gzipSync, gunzipSync } from "node:zlib";
import { lesLoyverader, tilLokalitetar } from "./ingest/akvakulturregister.ts";

const dag = process.env["SNAPSHOT"] ?? new Date().toISOString().slice(0, 10);
const rot = process.cwd();
const mappe = `${rot}/data/snapshots/${dag}`;

type BiomasseRad = { loknr: number; har_fisk: string; siste_rapport: string | null };

const lok = tilLokalitetar(await lesLoyverader(`${mappe}/akvakulturregister.csv.gz`));

let harFisk = new Map<number, { f: boolean; r: string | null }>();
try {
  const b = JSON.parse(
    gunzipSync(readFileSync(`${mappe}/biomasse.json.gz`)).toString(),
  ) as { features?: { attributes: BiomasseRad }[] };
  for (const f of b.features ?? []) {
    harFisk.set(f.attributes.loknr, {
      f: f.attributes.har_fisk === "Ja",
      r: f.attributes.siste_rapport ?? null,
    });
  }
} catch {
  console.error("  åtvaring: biomasse manglar i snapshotet — har_fisk blir tomt");
}

const tilstand = lok.map((l) => {
  const nr = Number(l.lokalitetsnr);
  const b = harFisk.get(nr);
  return {
    n: nr,
    nm: l.namn,
    o: l.innehavarar.map((i) => i.orgnr).filter(Boolean),
    k: l.kapasitet,
    e: l.kapasitetEining,
    po: l.produksjonsomrade,
    f: b ? b.f : null,
    r: b ? b.r : null,
  };
});

mkdirSync(`${rot}/data/arkiv`, { recursive: true });
const ut = `${rot}/data/arkiv/${dag}.json.gz`;
const kropp = gzipSync(JSON.stringify({ dag, lokalitetar: tilstand }));
writeFileSync(ut, kropp);
console.log(`  arkiv ${dag}: ${tilstand.length} lokalitetar, ${Math.round(kropp.length / 1024)} kB`);
