/**
 * Fartøy frå Kystdatahuset (Kystverket). Ope, ingen konto. Lisens NLOD.
 *
 *   /ws/api/ais/realtime/geojson          — alle fartøy, siste ~10 min
 *   /ws/api/ais/statinfo/for-mmsis-time   — skipsregisterdata, 250 MMSI per kall
 *
 * ÅTVARINGAR som må stå i grensesnittet:
 *  - Fiskefartøy under 15 m og fritidsbåtar under 45 m er haldne UTE av
 *    personvernomsyn. Små arbeidsbåtar på lokaliteten ser vi ikkje i det heile.
 *  - «Fish Carrier» skil IKKJE brønnbåt frå slaktebåt. Slaktebåten
 *    NORWEGIAN GANNET har same kode som brønnbåtane. Vi må merke det ærleg.
 *  - Namnet i sanntidsfeeden og i registeret kan vere ulikt for same fartøy.
 *  - Kystdatahuset svarar HTTP 200 med success:false ved feil. Sjekk kroppen.
 */
import { hent } from "../lib/http.ts";
import { haversineM } from "../lib/geo.ts";

const BASE = "https://kystdatahuset.no/ws";

export type AisPosisjon = {
  mmsi: number;
  namn: string | null;
  imo: number | null;
  kallesignal: string | null;
  lat: number;
  lon: number;
  fart: number | null;
  kurs: number | null;
  lengd: number | null;
  djupgang: number | null;
  destinasjon: string | null;
  aisSkipstype: number | null;
  tid: string;
};

type RaFeature = {
  geometry: { type: string; coordinates: number[][] | number[] };
  properties: Record<string, unknown>;
};

export async function hentSanntid(): Promise<AisPosisjon[]> {
  const { status, tekst } = await hent(`${BASE}/api/ais/realtime/geojson`);
  if (status !== 200) throw new Error(`Kystdatahuset sanntid: HTTP ${status}`);
  const d = JSON.parse(tekst) as { type?: string; features?: RaFeature[]; success?: boolean };
  if (d.success === false) throw new Error(`Kystdatahuset sanntid: success=false`);

  const ut: AisPosisjon[] = [];
  for (const f of d.features ?? []) {
    // Geometrien er ein LineString med siste posisjonar. Vi tek den første.
    const c = f.geometry.coordinates;
    const p = Array.isArray(c[0]) ? (c[0] as number[]) : (c as number[]);
    const lon = p[0], lat = p[1];
    if (typeof lon !== "number" || typeof lat !== "number") continue;
    const pr = f.properties;
    ut.push({
      mmsi: Number(pr["mmsi"]),
      namn: (pr["ship_name"] as string) || null,
      imo: pr["imo"] ? Number(pr["imo"]) : null,
      kallesignal: (pr["callsign"] as string) || null,
      lat, lon,
      fart: pr["speed"] === null || pr["speed"] === undefined ? null : Number(pr["speed"]),
      kurs: pr["cog"] === null || pr["cog"] === undefined ? null : Number(pr["cog"]),
      lengd: pr["length"] ? Number(pr["length"]) : null,
      djupgang: pr["draught"] ? Number(pr["draught"]) : null,
      destinasjon: (pr["destination"] as string) || null,
      aisSkipstype: pr["ship_type"] ? Number(pr["ship_type"]) : null,
      tid: String(pr["date_time_utc"] ?? ""),
    });
  }
  return ut;
}

export type SkipsInfo = {
  mmsi: number;
  namn: string | null;
  imo: number | null;
  lengd: number | null;
  breidd: number | null;
  gt: number | null;
  skipstype: string | null;
  statcode5: string | null;
};

function tidsstempel(d: Date): string {
  const p = (n: number, b = 2): string => String(n).padStart(b, "0");
  return `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}`;
}

/** Skipsregisterdata for ei liste MMSI. Maks 250 per kall. */
export async function hentSkipsinfo(mmsis: number[]): Promise<Map<number, SkipsInfo>> {
  const kart = new Map<number, SkipsInfo>();
  const no = new Date();
  const start = tidsstempel(new Date(no.getTime() - 3 * 864e5));
  const slutt = tidsstempel(no);

  for (let i = 0; i < mmsis.length; i += 250) {
    const bolk = mmsis.slice(i, i + 250);
    const { status, tekst } = await hent(`${BASE}/api/ais/statinfo/for-mmsis-time`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mmsiIds: bolk, start, end: slutt }),
    });
    if (status !== 200) continue;
    const d = JSON.parse(tekst) as { success?: boolean; data?: Record<string, unknown>[] };
    if (!d.success || !d.data) continue;
    for (const r of d.data) {
      const mmsi = Number(r["mmsi"]);
      if (!Number.isFinite(mmsi)) continue;
      kart.set(mmsi, {
        mmsi,
        namn: (r["name"] as string) || null,
        imo: r["imo_num"] ? Number(r["imo_num"]) : null,
        lengd: r["length"] ? Number(r["length"]) : null,
        breidd: r["breadth"] ? Number(r["breadth"]) : null,
        gt: r["gt"] ? Number(r["gt"]) : null,
        skipstype: (r["shiptypelevel5"] as string) || null,
        statcode5: (r["statcode5"] as string) || null,
      });
    }
  }
  return kart;
}

export type Fartoygruppe = "godkjend" | "brønnbåt" | "service" | "fiske" | "frakt" | "anna";

/**
 * Sortering i tre trinn:
 *  «godkjend» — kallesignalet står i Mattilsynet sitt register over godkjende
 *               transporteiningar for levande fisk. Då VEIT vi det er ein brønnbåt.
 *  «brønnbåt» — AIS seier «Fish Carrier», men båten står ikkje i registeret.
 *               Kan vere slaktebåt. Må merkast med atterhald.
 *  resten     — grovsortering på skipstype.
 */
export function gruppe(info: SkipsInfo | undefined, godkjend?: boolean): Fartoygruppe {
  if (godkjend) return "godkjend";
  const t = info?.skipstype ?? "";
  if (info?.statcode5 === "B12B2FC" || t === "Fish Carrier") return "brønnbåt";
  if (t === "Work/Repair Vessel" || t.includes("Offshore") || t.includes("Tug")) return "service";
  if (t === "Fishing Vessel") return "fiske";
  if (t.includes("Cargo") || t.includes("Tanker") || t.includes("Bulk")) return "frakt";
  return "anna";
}

export type VedAnlegg = {
  mmsi: number;
  lokalitetsnr: number;
  lokalitetsnamn: string;
  avstandM: number;
};

/**
 * Fartøy som ligg stille nær eit anlegg.
 *
 * Fartsfilteret er avgjerande: utan det blir gjennomfart i 10–12 knop
 * rekna som besøk. Terskelen er 2 knop, som i den opphavlege spesifikasjonen.
 */
export function finnVedAnlegg(
  posisjonar: AisPosisjon[],
  anlegg: { nr: number; namn: string; lat: number; lon: number }[],
  radiusM = 500,
  maksFart = 2,
): VedAnlegg[] {
  const ut: VedAnlegg[] = [];
  const grovGrad = radiusM / 111_000 * 2.2; // grovfilter før haversine

  for (const p of posisjonar) {
    if (p.fart !== null && p.fart > maksFart) continue;
    for (const a of anlegg) {
      if (Math.abs(a.lat - p.lat) > grovGrad) continue;
      if (Math.abs(a.lon - p.lon) > grovGrad * 2.5) continue;
      const d = haversineM([p.lon, p.lat], [a.lon, a.lat]);
      if (d > radiusM) continue;
      ut.push({ mmsi: p.mmsi, lokalitetsnr: a.nr, lokalitetsnamn: a.namn, avstandM: Math.round(d) });
      break;
    }
  }
  return ut;
}
