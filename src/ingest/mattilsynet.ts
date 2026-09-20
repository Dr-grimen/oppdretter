/**
 * Lakselus frå Mattilsynet — den opne kjelda.
 *
 * https://akvakultur-offentlig-api.fisk.mattilsynet.io
 * Lisens NLOD 2.0. Ingen konto, ingen nøkkel, ingen registrering.
 * Det einaste kravet er headeren `Client-Id` med eit sjølvvalt namn — utan den
 * kjem HTTP 400 «must not be blank». Det er validering, ikkje autentisering,
 * så namnet kan stå rett i koden.
 *
 * Dette er kjelda BarentsWatch sjølv les frå. Vi går til kjelda i staden.
 *
 * FELLER (verifiserte):
 *  - Query-parameteren heiter `aar`, men feltet i svaret heiter `år`.
 *    `aar` er rapporteringsåret, ikkje veka sitt år: aar=2026&uke=52 gir
 *    rapportar leverte i januar 2026 for veke 52 i 2025. Filtrer difor alltid
 *    på `år`/`uke` i svaret, ikkje berre på spørjinga.
 *  - Ei veke er aldri ferdig. Rader kjem inn i minst ti dagar etter fristen,
 *    og eksisterande rader kan bli retta. Køyr eldre veker på nytt.
 *  - Manglande rad tyder IKKJE at alt er bra. Det tyder ukjent.
 *  - Det finst søppelrader (år=1, veke=1). Filtrer dei bort.
 */

import { hent } from "../lib/http.ts";
import { vekerIAar, samanliknTid } from "../lib/tid.ts";

const BASE = "https://akvakultur-offentlig-api.fisk.mattilsynet.io";
const CLIENT_ID = "oppdretter";

export type Lusetelling = {
  voksneHunnlus: number | null;
  bevegeligeLus: number | null;
  fastsittendeLus: number | null;
};

export type Behandling = Record<string, unknown>;

export type Luserapport = {
  id: string;
  lokalitetsnummer: number;
  lokalitetsnavn: string;
  organisasjonsnummer: string | null;
  organisasjonsnavn: string | null;
  uke: number;
  år: number;
  rapporteringstidspunkt: string;
  sjøtemperatur: number | null;
  lusetelling: Lusetelling | null;
  ikkeMedikamentelleBehandlinger: Behandling[];
  medikamentelleBehandlinger: Behandling[];
  kombinasjonsbehandlinger: Behandling[];
  resistensmistanker: Behandling[];
};

export async function mattilsynetApi<T>(sti: string, sok: Record<string, string | number>): Promise<{
  data: T[];
  totalt: number;
}> {
  const limit = Number(sok.limit ?? 5000);
  const data: T[] = [];
  let totalt = -1;
  let forrigeSide = "";
  for (let side = 0; side < 100; side++) {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(sok)) p.set(k, String(v));
    p.set("limit", String(limit));
    p.set("offset", String(data.length));
    const { status, tekst, headers } = await hent(`${BASE}${sti}?${p}`, {
      headers: { "Client-Id": CLIENT_ID, Accept: "application/json" },
    });
    if (status !== 200) throw new Error(`Mattilsynet svarte HTTP ${status} på ${sti}`);
    const rader: unknown = JSON.parse(tekst);
    if (!Array.isArray(rader)) throw new Error(`Mattilsynet ${sti}: ugyldig datasvar`);
    const antall = Number(headers.get("x-count") ?? "-1");
    if (Number.isFinite(antall) && antall >= 0) totalt = antall;
    if (rader.length > 0 && tekst === forrigeSide) throw new Error(`Mattilsynet ${sti}: paginering gjentok ei side`);
    forrigeSide = tekst;
    data.push(...rader as T[]);
    if (rader.length < limit && (totalt < 0 || data.length >= totalt)) return { data, totalt };
    if (totalt >= 0 && data.length >= totalt) return { data, totalt };
    if (rader.length === 0) throw new Error(`Mattilsynet ${sti}: ufullstendig datasvar`);
  }
  throw new Error(`Mattilsynet ${sti}: for mange sider, avbryt ufullstendig datasett`);
}

/** Ei søppelrad er ei rad vi ikkje kan plassere i tid. */
export function erGyldig(r: Luserapport): boolean {
  return !!r && Number.isInteger(r.år) && r.år >= 2012 && r.år <= 2100 &&
    Number.isInteger(r.uke) && r.uke >= 1 && r.uke <= vekerIAar(r.år) &&
    Number.isInteger(r.lokalitetsnummer) && r.lokalitetsnummer > 0 &&
    Number.isFinite(Date.parse(r.rapporteringstidspunkt));
}

export function ikkjeNegativ(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null;
}

function normaliser(r: Luserapport): Luserapport {
  return { ...r,
    sjøtemperatur: typeof r.sjøtemperatur === "number" && Number.isFinite(r.sjøtemperatur) ? r.sjøtemperatur : null,
    lusetelling: r.lusetelling ? {
      voksneHunnlus: ikkjeNegativ(r.lusetelling.voksneHunnlus),
      bevegeligeLus: ikkjeNegativ(r.lusetelling.bevegeligeLus),
      fastsittendeLus: ikkjeNegativ(r.lusetelling.fastsittendeLus),
    } : null,
    ikkeMedikamentelleBehandlinger: Array.isArray(r.ikkeMedikamentelleBehandlinger) ? r.ikkeMedikamentelleBehandlinger : [],
    medikamentelleBehandlinger: Array.isArray(r.medikamentelleBehandlinger) ? r.medikamentelleBehandlinger : [],
    kombinasjonsbehandlinger: Array.isArray(r.kombinasjonsbehandlinger) ? r.kombinasjonsbehandlinger : [],
    resistensmistanker: Array.isArray(r.resistensmistanker) ? r.resistensmistanker : [],
  };
}

/** One authoritative correction per locality/week, before trend/events/latest. */
export function kollapsRapportar(rapportar: Luserapport[]): Luserapport[] {
  const siste = new Map<string, Luserapport>();
  for (const rå of rapportar) {
    if (!erGyldig(rå)) continue;
    const r = normaliser(rå);
    const nøkkel = `${r.lokalitetsnummer}:${r.år}:${r.uke}`;
    const før = siste.get(nøkkel);
    // A deterministic tie-break avoids output changes if upstream order changes.
    if (!før || samanliknTid(r.rapporteringstidspunkt, før.rapporteringstidspunkt) > 0 ||
      (samanliknTid(r.rapporteringstidspunkt, før.rapporteringstidspunkt) === 0 &&
        `${r.id}:${JSON.stringify(r)}` > `${før.id}:${JSON.stringify(før)}`)) {
      siste.set(nøkkel, r);
    }
  }
  return [...siste.values()].sort((a, b) => a.år - b.år || a.uke - b.uke || a.lokalitetsnummer - b.lokalitetsnummer);
}

/**
 * Hentar alle luserapportar for éi rapportveke.
 *
 * Filtrerer på `år`/`uke` i svaret, ikkje berre i spørjinga, fordi `aar`
 * i spørjinga er rapporteringsåret.
 */
export async function hentVeke(aar: number, uke: number): Promise<{
  rapportar: Luserapport[];
  totaltFraApi: number;
  forkasta: number;
}> {
  // `aar` filters submission year, so a December report submitted/corrected
  // in January disappears when filtering only aar. Fetch this week across
  // submission years and use the report's own år below instead.
  const { data, totalt } = await mattilsynetApi<Luserapport>("/api/lakselus/v2/rapporteringer", {
    uke,
    limit: 5000,
  });
  const rapportar = kollapsRapportar(data.filter((r) => erGyldig(r) && r.år === aar && r.uke === uke));
  return { rapportar, totaltFraApi: totalt, forkasta: data.length - rapportar.length };
}

/** Alle rapportar levert etter eit tidspunkt — grunnlaget for inkrementell ingest. */
export async function hentSidan(tidspunktIso: string): Promise<Luserapport[]> {
  const { data } = await mattilsynetApi<Luserapport>("/api/lakselus/v2/rapporteringer", {
    "fra-rapporteringstidspunkt": tidspunktIso,
    limit: 20000,
  });
  return kollapsRapportar(data);
}

export type RapportDetalj = {
  aar: number; uke: number; t: string; temperatur: number | null;
  bevegelege: number | null; fastsitjande: number | null;
  behandlingar: { type: string; metode: string; merder: number | null; heile: boolean | null; forTeljing: boolean | null; virkestoff: string | null }[];
  resistensmistankar: number;
};

/** No dosage advice: only the methods and coverage actually reported. */
export function rapportDetalj(r: Luserapport): RapportDetalj {
  const behandlingar: RapportDetalj["behandlingar"] = [];
  const leggTil = (b: Behandling, type: string): void => {
    behandlingar.push({ type, metode: String(b.type ?? "UKJENT"),
      merder: ikkjeNegativ(b.antallMerder), heile: typeof b.heleLokaliteten === "boolean" ? b.heleLokaliteten : null,
      forTeljing: typeof b.gjennomførtFørTelling === "boolean" ? b.gjennomførtFørTelling : null,
      virkestoff: b.virkestoff && typeof b.virkestoff === "object" && "type" in b.virkestoff ? String(b.virkestoff.type) : null,
    });
  };
  for (const b of r.medikamentelleBehandlinger) leggTil(b, "medikamentell");
  for (const b of r.ikkeMedikamentelleBehandlinger) leggTil(b, "ikkje-medikamentell");
  for (const k of r.kombinasjonsbehandlinger) {
    for (const b of (Array.isArray(k.medikamentelleBehandlinger) ? k.medikamentelleBehandlinger : [])) leggTil(b, "kombinasjon");
    for (const b of (Array.isArray(k.ikkeMedikamentelleBehandlinger) ? k.ikkeMedikamentelleBehandlinger : [])) leggTil(b, "kombinasjon");
  }
  return { aar: r.år, uke: r.uke, t: r.rapporteringstidspunkt, temperatur: r.sjøtemperatur,
    bevegelege: r.lusetelling?.bevegeligeLus ?? null, fastsitjande: r.lusetelling?.fastsittendeLus ?? null,
    behandlingar, resistensmistankar: r.resistensmistanker.length };
}

export function harBehandling(r: Luserapport): boolean {
  return (
    r.medikamentelleBehandlinger.length > 0 ||
    r.ikkeMedikamentelleBehandlinger.length > 0 ||
    r.kombinasjonsbehandlinger.length > 0
  );
}
