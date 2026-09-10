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

async function api<T>(sti: string, sok: Record<string, string | number>): Promise<{
  data: T[];
  totalt: number;
}> {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(sok)) p.set(k, String(v));
  const url = `${BASE}${sti}?${p.toString()}`;
  const { status, tekst, headers } = await hent(url, {
    headers: { "Client-Id": CLIENT_ID, Accept: "application/json" },
  });
  if (status !== 200) {
    throw new Error(`Mattilsynet svarte HTTP ${status} på ${sti}: ${tekst.slice(0, 200)}`);
  }
  const totalt = Number(headers.get("x-count") ?? "-1");
  return { data: JSON.parse(tekst) as T[], totalt };
}

/** Ei søppelrad er ei rad vi ikkje kan plassere i tid. */
function erGyldig(r: Luserapport): boolean {
  return r.år >= 2012 && r.uke >= 1 && r.uke <= 53 && Number.isFinite(r.lokalitetsnummer);
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
  const { data, totalt } = await api<Luserapport>("/api/lakselus/v2/rapporteringer", {
    aar,
    uke,
    limit: 20000,
  });
  const rapportar = data.filter((r) => erGyldig(r) && r.år === aar && r.uke === uke);
  return { rapportar, totaltFraApi: totalt, forkasta: data.length - rapportar.length };
}

/** Alle rapportar levert etter eit tidspunkt — grunnlaget for inkrementell ingest. */
export async function hentSidan(tidspunktIso: string): Promise<Luserapport[]> {
  const { data } = await api<Luserapport>("/api/lakselus/v2/rapporteringer", {
    "fra-rapporteringstidspunkt": tidspunktIso,
    limit: 20000,
  });
  return data.filter(erGyldig);
}

export function harBehandling(r: Luserapport): boolean {
  return (
    r.medikamentelleBehandlinger.length > 0 ||
    r.ikkeMedikamentelleBehandlinger.length > 0 ||
    r.kombinasjonsbehandlinger.length > 0
  );
}
