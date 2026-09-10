/**
 * ILA- og PD-soner frå BarentsWatch sin opne WFS (geo.barentswatch.no).
 * Ingen konto. Alt i EPSG:4326, lon/lat-rekkjefølgje.
 *
 * Vi testar kvar lokalitet mot sonene sjølve — BarentsWatch har eit endepunkt
 * for dette, men det ligg bak token.
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { lagBoks, finnFoerste, type Geometri, type MedBoks } from "../lib/geo.ts";

export type SoneType = "ILA-bekjempelse" | "ILA-overvaking" | "PD-bekjempelse" | "PD-overvaking";
export type Sone = { type: SoneType; forskrift: string | null; frå: string | null };

const LAG: [string, SoneType][] = [
  ["wfs-ilaprotectionzone", "ILA-bekjempelse"],
  ["wfs-ilasurveillancezone", "ILA-overvaking"],
  ["wfs-pdprotectionzone", "PD-bekjempelse"],
  ["wfs-pdsurveillancezone", "PD-overvaking"],
];

export function lesSoner(mappe: string): MedBoks<Sone>[] {
  const ut: MedBoks<Sone>[] = [];
  for (const [fil, type] of LAG) {
    let rå: { features?: { properties: Record<string, unknown>; geometry: Geometri }[] };
    try {
      rå = JSON.parse(gunzipSync(readFileSync(`${mappe}/${fil}.geojson.gz`)).toString());
    } catch {
      continue; // laget manglar i snapshotet
    }
    for (const f of rå.features ?? []) {
      // Berre aktive soner: todate er tom når sona framleis gjeld.
      if (f.properties["todate"]) continue;
      ut.push(
        lagBoks<Sone>(
          {
            type,
            forskrift: (f.properties["forsknr"] as string) ?? null,
            frå: ((f.properties["fromdate"] as string) ?? "").slice(0, 10) || null,
          },
          f.geometry,
        ),
      );
    }
  }
  return ut;
}

export function soneFor(lon: number, lat: number, soner: MedBoks<Sone>[]): Sone[] {
  const treff: Sone[] = [];
  for (const s of soner) {
    const t = finnFoerste(lon, lat, [s]);
    if (t) treff.push(t);
  }
  return treff;
}
