/** Original BarentsWatch ILA 10 km polygons. Not legal protection zones and
 * not a diagnosis for neighbouring sites. The layer carries its own year/week,
 * which is generally newer than the last lice reporting week.
 * https://www.barentswatch.no/veiledning/fiskehelse-forklaring-og-bruksanvisning/
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { gyldigSoneGeometri } from "./soner.ts";
import { iGeometri, type Geometri } from "../lib/geo.ts";
import { isoVeke, norskDato, vekerIAar } from "../lib/tid.ts";
import type { Kjeldestatus } from "../lib/kjeldestatus.ts";

export type Ila10km = { id: string; nr: number; namn: string | null; aar: number; uke: number; geometry: Geometri };

export function parseIla10km(d: unknown): { ringar: Ila10km[]; ugyldige: number } {
  if (!d || typeof d !== "object" || !("type" in d) || d.type !== "FeatureCollection" ||
    !("features" in d) || !Array.isArray(d.features)) throw new Error("Ugyldig ILA-ringlag");
  const total = "numberMatched" in d ? d.numberMatched : "totalFeatures" in d ? d.totalFeatures : null;
  let ugyldige = typeof total === "number" && Number.isFinite(total) ? Math.max(0, total - d.features.length) : 0;
  const unike = new Map<string, Ila10km>();
  for (const f of d.features) {
    const p = f?.properties;
    if (!p || (typeof p.id !== "string" && typeof p.id !== "number") || String(p.id).trim() === "" ||
      !Number.isInteger(p.localityno) || p.localityno <= 0 ||
      !Number.isInteger(p.year) || p.year < 2016 || p.year > 2100 ||
      !Number.isInteger(p.week) || p.week < 1 || p.week > vekerIAar(p.year) ||
      !gyldigSoneGeometri(f.geometry)) {
      ugyldige++;
      continue;
    }
    const id = String(p.id);
    const r = { id, nr: p.localityno as number, namn: typeof p.name === "string" ? p.name : null,
      aar: p.year as number, uke: p.week as number, geometry: f.geometry as Geometri };
    const før = unike.get(id);
    if (!før || r.aar * 100 + r.uke > før.aar * 100 + før.uke) unike.set(id, r);
  }
  return { ringar: [...unike.values()], ugyldige };
}

export function lesIla10km(mappe: string, snapshotTid: string, no = new Date()): { ringar: Ila10km[]; status: Kjeldestatus } {
  try {
    const d = JSON.parse(gunzipSync(readFileSync(`${mappe}/wfs-isa10kmcircle.geojson.gz`)).toString());
    const { ringar, ugyldige } = parseIla10km(d);
    const veke = isoVeke(norskDato(no));
    const annaVeke = ringar.some((r) => r.aar !== veke.aar || r.uke !== veke.uke);
    const melding = [
      ...(ugyldige ? [`${ugyldige} ringar manglar eller har ugyldige data.`] : []),
      ...(annaVeke ? ["Ringlaget inneheld ei anna veke enn inneverande veke. Sjå år og veke på kvar ring."] : []),
    ].join(" ");
    return { ringar, status: {
      status: ugyldige && !ringar.length ? "feila" : ugyldige || annaVeke ? "delvis" : "ok",
      henta: snapshotTid, tal: ringar.length,
      ...(typeof d.timeStamp === "string" && Number.isFinite(Date.parse(d.timeStamp)) ? { dataTid: d.timeStamp } : {}),
      ...(melding ? { melding } : {}),
    } };
  } catch {
    return { ringar: [], status: { status: "feila", henta: snapshotTid, tal: 0,
      melding: "BarentsWatch sine ILA 10 km-ringar kunne ikkje lesast. Manglande treff tyder ukjent." } };
  }
}

/** Geographic membership only; no implication about infection or legal duties. */
export function ila10kmTreff(lon: number, lat: number, ringar: Ila10km[]): string[] {
  if (!Number.isFinite(lon) || !Number.isFinite(lat)) return [];
  return ringar.filter((r) => iGeometri(lon, lat, r.geometry)).map((r) => r.id);
}
