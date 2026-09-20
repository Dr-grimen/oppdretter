/**
 * BarentsWatch WFS bw:localitywithpd / bw:localitywithila (NLOD).
 * Source fields checked against actual snapshots and the official schemas.
 * https://www.barentswatch.no/veiledning/fiskehelse-forklaring-og-bruksanvisning/
 * distinguishes suspicion, diagnosis, emptied and closed. These WFS layers
 * do NOT include avsluttetdato: neither tomtdato nor a missing row is proof
 * that an outbreak is closed, that a site is healthy, or that fish are present.
 *
 * This is the retrieved WFS selection, not complete historical case data.
 * It contains dated emptied localities too. Keep it separate from Mattilsynet
 * cases, legal control zones, the national PD area and lice thresholds.
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { norskDato } from "../lib/tid.ts";
import type { Kjeldestatus } from "../lib/kjeldestatus.ts";

export type BwSjukdom = {
  id: string;
  type: "PD" | "ILA";
  subtype: "SAV2" | "SAV3" | null;
  /** Latest dated SOURCE STAGE, never a clinical judgement about current fish. */
  status: "mistanke" | "paavist" | "tomt" | "registrert";
  mistanke: string | null;
  paavist: string | null;
  tomt: string | null;
  kjeldeTekst: string | null;
};
type Rad = BwSjukdom & { lokalitetsnummer: number; versjon: number };

/** WFS timestamps are Norwegian calendar dates serialized as 22/23 UTC. */
export function bwDato(v: unknown): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (typeof v !== "string") throw new Error("Ugyldig sjukdomsdato");
  if (/^\d{4}-\d{2}-\d{2}Z?$/.test(v)) {
    const dag = v.slice(0, 10), d = new Date(`${dag}T00:00:00Z`);
    if (!Number.isFinite(d.getTime()) || d.toISOString().slice(0, 10) !== dag) throw new Error("Ugyldig sjukdomsdato");
    return dag;
  }
  if (!/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(v)) throw new Error("Sjukdomsdato manglar tidssone");
  const d = new Date(v);
  if (!Number.isFinite(d.getTime())) throw new Error("Ugyldig sjukdomsdato");
  // Date.parse rolls impossible dates into the next month in some runtimes.
  const originalDag = v.slice(0, 10);
  const kontroll = new Date(`${originalDag}T00:00:00Z`);
  if (!Number.isFinite(kontroll.getTime()) || kontroll.toISOString().slice(0, 10) !== originalDag) throw new Error("Ugyldig sjukdomsdato");
  return norskDato(d).toISOString().slice(0, 10);
}

export function bwStadium(mistanke: string | null, paavist: string | null, tomt: string | null): BwSjukdom["status"] {
  const stadium: { status: BwSjukdom["status"]; dato: string | null; rang: number }[] = [
    { status: "mistanke", dato: mistanke, rang: 1 },
    { status: "paavist", dato: paavist, rang: 2 },
    { status: "tomt", dato: tomt, rang: 3 },
  ];
  return stadium.filter((s) => s.dato).sort((a, b) => b.dato!.localeCompare(a.dato!) || b.rang - a.rang)[0]?.status ?? "registrert";
}

export function normaliserBwSjukdom(p: Record<string, unknown>, type: BwSjukdom["type"]): Rad[] {
  if (!p || !Number.isInteger(p.lokalitetsnummer) || Number(p.lokalitetsnummer) <= 0) throw new Error("Ugyldig lokalitetsnummer");
  const nr = Number(p.lokalitetsnummer);
  const kjeldeTekst = typeof p.sykdommer === "string" ? p.sykdommer : null;
  const tomt = bwDato(p.tomtdato);
  const versjon = typeof p.version === "number" && Number.isFinite(p.version) ? p.version : 0;
  const lag = (subtype: BwSjukdom["subtype"], mistanke: string | null, paavist: string | null): Rad => ({
    id: `bw:${type}:${nr}:${subtype ?? "ukjent"}`, lokalitetsnummer: nr, versjon,
    type, subtype, status: bwStadium(mistanke, paavist, tomt), mistanke, paavist, tomt, kjeldeTekst,
  });
  if (type === "ILA") return [lag(null, bwDato(p.mistankedato), bwDato(p.paavistdato))];
  const ut: Rad[] = [];
  for (const [prefiks, subtype] of [["pd_ukjent", null], ["pd_sav2", "SAV2"], ["pd_sav3", "SAV3"]] as const) {
    const mistanke = bwDato(p[`${prefiks}_mistankedato`]);
    const paavist = bwDato(p[`${prefiks}_paavistdato`]);
    // Raw labels can identify a subtype even when the dates are unavailable.
    const namngitt = subtype !== null && new RegExp(`\\b${subtype}\\b`, "i").test(kjeldeTekst ?? "");
    if (mistanke || paavist || namngitt) ut.push(lag(subtype, mistanke, paavist));
  }
  if (!ut.length) ut.push(lag(null, null, null));
  return ut;
}

export function parseBwLag(d: unknown, type: BwSjukdom["type"]): { rader: Rad[]; ugyldige: number } {
  if (!d || typeof d !== "object" || !("type" in d) || d.type !== "FeatureCollection" ||
    !("features" in d) || !Array.isArray(d.features)) throw new Error("Ugyldig BarentsWatch-svar");
  const unike = new Map<string, Rad>();
  const total = "numberMatched" in d ? d.numberMatched : "totalFeatures" in d ? d.totalFeatures : null;
  let ugyldige = typeof total === "number" && Number.isFinite(total) ? Math.max(0, total - d.features.length) : 0;
  const sisteDato = (r: Rad): string => [r.mistanke, r.paavist, r.tomt].filter((x): x is string => !!x).sort().at(-1) ?? "";
  for (const f of d.features) {
    try {
      for (const r of normaliserBwSjukdom(f?.properties, type)) {
        const før = unike.get(r.id);
        if (!før || r.versjon > før.versjon || (r.versjon === før.versjon &&
          (sisteDato(r) > sisteDato(før) || (sisteDato(r) === sisteDato(før) && JSON.stringify(r) > JSON.stringify(før))))) unike.set(r.id, r);
      }
    } catch {
      ugyldige++;
    }
  }
  return { rader: [...unike.values()].sort((a, b) => a.lokalitetsnummer - b.lokalitetsnummer || a.id.localeCompare(b.id)), ugyldige };
}

export function lesBwSjukdom(mappe: string, snapshotTid: string): {
  perLokalitet: Map<number, BwSjukdom[]>;
  kjelder: Record<"bwSjukdom" | "bwPd" | "bwIla", Kjeldestatus>;
} {
  const perLokalitet = new Map<number, BwSjukdom[]>();
  const delkjelder: Partial<Record<"bwPd" | "bwIla", Kjeldestatus>> = {};
  for (const [type, namn, fil] of [["PD", "bwPd", "localitywithpd"], ["ILA", "bwIla", "localitywithila"]] as const) {
    try {
      const d = JSON.parse(gunzipSync(readFileSync(`${mappe}/wfs-${fil}.geojson.gz`)).toString());
      const { rader, ugyldige } = parseBwLag(d, type);
      delkjelder[namn] = {
        status: ugyldige ? rader.length ? "delvis" : "feila" : "ok", henta: snapshotTid, tal: rader.length,
        ...(typeof d.timeStamp === "string" && Number.isFinite(Date.parse(d.timeStamp)) ? { dataTid: d.timeStamp } : {}),
        ...(ugyldige ? { melding: `${ugyldige} ugyldige ${type}-oppføringar kunne ikkje lesast. Status kan mangle.` } : {}),
      };
      for (const { lokalitetsnummer, versjon: _versjon, ...r } of rader) {
        perLokalitet.set(lokalitetsnummer, [...(perLokalitet.get(lokalitetsnummer) ?? []), r]);
      }
    } catch {
      delkjelder[namn] = { status: "feila", henta: snapshotTid, tal: 0,
        melding: `BarentsWatch sitt ${type}-utval kunne ikkje lesast. Fråvær tyder ukjent, ikkje frisk.` };
    }
  }
  const bwPd = delkjelder.bwPd!, bwIla = delkjelder.bwIla!;
  const status: Kjeldestatus["status"] = bwPd.status === "ok" && bwIla.status === "ok" ? "ok"
    : bwPd.status === "feila" && bwIla.status === "feila" ? "feila" : "delvis";
  const dataTid = [bwPd.dataTid, bwIla.dataTid].filter((d): d is string => !!d).sort().at(-1);
  return { perLokalitet, kjelder: { bwPd, bwIla, bwSjukdom: {
    status, henta: snapshotTid, tal: bwPd.tal + bwIla.tal,
    ...(dataTid ? { dataTid } : {}),
    ...(status !== "ok" ? { melding: "BarentsWatch sitt sjukdomsutval er ufullstendig. Sjå status for PD og ILA." } : {}),
  } } };
}
