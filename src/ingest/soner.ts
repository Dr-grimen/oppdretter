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
import { norskDato } from "../lib/tid.ts";

export type SoneType = "ILA-bekjempelse" | "ILA-overvaking" | "PD-bekjempelse" | "PD-overvaking";
export type Sone = { type: SoneType; forskrift: string | null; frå: string | null; til: string | null; namn: string | null; lenkje: string | null };

const LAG: [string, SoneType][] = [
  ["wfs-ilaprotectionzone", "ILA-bekjempelse"],
  ["wfs-ilasurveillancezone", "ILA-overvaking"],
  ["wfs-pdprotectionzone", "PD-bekjempelse"],
  ["wfs-pdsurveillancezone", "PD-overvaking"],
];

export function lesSoner(mappe: string): MedBoks<Sone>[] {
  return lesSonerMedStatus(mappe).soner;
}

/** WFS uses date-only strings such as 2026-03-10Z, not valid ISO instants. */
function kjeldedato(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}(?:Z|T.*)?$/.test(v)) throw new Error("Ugyldig sonedato");
  if (v.includes("T")) {
    const tid = new Date(v);
    if (!Number.isFinite(tid.getTime())) throw new Error("Ugyldig sonedato");
    return norskDato(tid).toISOString().slice(0, 10);
  }
  const dag = v.slice(0, 10);
  const d = new Date(`${dag}T00:00:00Z`);
  if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== dag) throw new Error("Ugyldig sonedato");
  return dag;
}

export function soneErAktiv(p: Record<string, unknown>, no = new Date()): boolean {
  const frå = kjeldedato(p.fromdate), til = kjeldedato(p.todate);
  const dag = norskDato(no).toISOString().slice(0, 10);
  // A missing start stays unknown in payload; an open-ended published zone is
  // still included. Future-start and expired zones are never shown as current.
  return (!frå || frå <= dag) && (!til || til > dag);
}

export function gyldigSoneGeometri(g: Geometri): boolean {
  if (!g || (g.type !== "Polygon" && g.type !== "MultiPolygon")) return false;
  const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
  if (!Array.isArray(polys) || !polys.length) return false;
  return polys.every((p) => Array.isArray(p) && p.length > 0 && p.every((ring: unknown) => {
    if (!Array.isArray(ring) || ring.length < 4) return false;
    if (!ring.every((c) => Array.isArray(c) && typeof c[0] === "number" && typeof c[1] === "number" &&
      Number.isFinite(c[0]) && Math.abs(c[0]) <= 180 && Number.isFinite(c[1]) && Math.abs(c[1]) <= 90)) return false;
    return ring[0][0] === ring.at(-1)[0] && ring[0][1] === ring.at(-1)[1];
  }));
}

export function lesSonerMedStatus(mappe: string, no = new Date()): { soner: MedBoks<Sone>[]; feilaLag: string[] } {
  const ut: MedBoks<Sone>[] = [];
  const feilaLag: string[] = [];
  for (const [fil, type] of LAG) {
    let rå: { features?: { properties: Record<string, unknown>; geometry: Geometri }[] };
    try {
      rå = JSON.parse(gunzipSync(readFileSync(`${mappe}/${fil}.geojson.gz`)).toString());
      if (!Array.isArray(rå.features)) throw new Error("Ugyldig GeoJSON");
    } catch {
      feilaLag.push(type);
      continue; // laget manglar i snapshotet
    }
    for (const f of rå.features ?? []) {
      try {
      if (!soneErAktiv(f.properties, no)) continue;
      if (!gyldigSoneGeometri(f.geometry)) throw new Error("Ugyldig sonegeometri");
      ut.push(
        lagBoks<Sone>(
          {
            type,
            forskrift: (f.properties["forsknr"] as string) ?? null,
            frå: kjeldedato(f.properties["fromdate"]),
            til: kjeldedato(f.properties["todate"]),
            namn: typeof f.properties["forsknavn"] === "string" ? f.properties["forsknavn"] : null,
            lenkje: typeof f.properties["forsklink"] === "string" && f.properties["forsklink"].startsWith("https://lovdata.no/") ? f.properties["forsklink"] : null,
          },
          f.geometry,
        ),
      );
      } catch {
        if (!feilaLag.includes(type)) feilaLag.push(type);
      }
    }
  }
  return { soner: ut, feilaLag };
}

/** Display geometries are original WGS84 GeoJSON, with provenance and dates. */
export function sonerGeo(soner: MedBoks<Sone>[]) {
  return soner.map(({ verdi: s, geometri }) => ({
    type: s.type, forskrift: s.forskrift, geometry: geometri,
    fra: s.frå, til: s.til, namn: s.namn, lenkje: s.lenkje,
  }));
}

export type PdOmrade = { id: "pd" | "surveillance"; type: string; kind: "nasjonal"; fra: string | null; til: string | null };

/** National PD management areas, distinct from temporary outbreak controls. */
export function lesPdOmrade(mappe: string, no = new Date()): { soner: MedBoks<PdOmrade>[]; feila: boolean } {
  try {
    const rå = JSON.parse(gunzipSync(readFileSync(`${mappe}/wfs-pdzone.geojson.gz`)).toString()) as {
      features?: { properties: Record<string, unknown>; geometry: Geometri }[];
    };
    if (!Array.isArray(rå.features)) throw new Error("Ugyldige PD-område");
    const soner: MedBoks<PdOmrade>[] = [];
    for (const f of rå.features) {
      if (!soneErAktiv(f.properties, no)) continue;
      const id = f.properties.id;
      if ((id !== "pd" && id !== "surveillance") || !gyldigSoneGeometri(f.geometry)) throw new Error("Ukjent PD-område");
      soner.push(lagBoks({ id, type: id === "pd" ? "PD-område" : "PD-overvakingsområde", kind: "nasjonal",
        fra: kjeldedato(f.properties.fromdate), til: kjeldedato(f.properties.todate),
      }, f.geometry));
    }
    return { soner, feila: false };
  } catch {
    return { soner: [], feila: true };
  }
}

export function soneFor(lon: number, lat: number, soner: MedBoks<Sone>[]): Sone[] {
  const treff: Sone[] = [];
  for (const s of soner) {
    const t = finnFoerste(lon, lat, [s]);
    if (t) treff.push(t);
  }
  return treff;
}
