/** Mattilsynet /api/rensefisk/v1/rapporteringer, NLOD 2.0.
 * Schema verified against /q/openapi and real payloads 2026-09-20.
 * Monthly data, often delayed. No inference of today's stock or mortality rate.
 */
import { mattilsynetApi, ikkjeNegativ } from "./mattilsynet.ts";
import { samanliknTid } from "../lib/tid.ts";

export type RensefiskArt = {
  artskode: string; artsnavn: string; beholdningVedForrigeMånedsslutt: number;
  utsett: Record<string, number> | null; uttak: Record<string, number> | null;
};
export type RensefiskRapport = {
  id: string; lokalitetsnummer: number; år: number; måned: number;
  rapporteringstidspunkt: string;
  produksjonsenheter: { merdId: string; arter: RensefiskArt[] }[];
};

export async function hentRensefisk(): Promise<RensefiskRapport[]> {
  const { data } = await mattilsynetApi<RensefiskRapport>("/api/rensefisk/v1/rapporteringer", { limit: 5000 });
  return data.filter((r) => r && Number.isInteger(r.lokalitetsnummer) && r.lokalitetsnummer > 0 &&
    Number.isInteger(r.år) && r.år >= 2020 && Number.isInteger(r.måned) && r.måned >= 1 && r.måned <= 12 &&
    Number.isFinite(Date.parse(r.rapporteringstidspunkt)) && Array.isArray(r.produksjonsenheter));
}

/** Last report month wins, then newest correction (not latest submission only). */
export function sisteRensefisk(data: RensefiskRapport[]): Map<number, RensefiskRapport> {
  const siste = new Map<number, RensefiskRapport>();
  for (const r of data) {
    const før = siste.get(r.lokalitetsnummer);
    const periode = r.år * 12 + r.måned;
    const førPeriode = før ? før.år * 12 + før.måned : -1;
    if (!før || periode > førPeriode || (periode === førPeriode &&
      (samanliknTid(r.rapporteringstidspunkt, før.rapporteringstidspunkt) > 0 ||
      (samanliknTid(r.rapporteringstidspunkt, før.rapporteringstidspunkt) === 0 && r.id > før.id)))) siste.set(r.lokalitetsnummer, r);
  }
  return siste;
}

export function rensefiskDetalj(r: RensefiskRapport) {
  const artar = r.produksjonsenheter.flatMap((p) => p.arter ?? []);
  // Missing fields stay unknown. In particular null uttak is not proof of zero deaths.
  const sum = (f: (a: RensefiskArt) => unknown): number | null => {
    const tal = artar.map((a) => ikkjeNegativ(f(a)));
    return !tal.length || tal.some((n) => n === null) ? null : tal.reduce<number>((s, n) => s + (n ?? 0), 0);
  };
  const avliving = ["antallAvlivetSykdom", "antallAvlivetSkader", "antallAvlivetAvmagret",
    "antallAvlivetForeståendeHåndteringAvLaksen", "antallAvlivetForeståendeUgunstigLevemiljø", "antallAvlivetSkalIkkeBrukes"];
  return {
    aar: r.år, manad: r.måned, t: r.rapporteringstidspunkt,
    merder: r.produksjonsenheter.length, artar: [...new Set(artar.map((a) => a.artsnavn).filter(Boolean))],
    behaldningForrigeManad: sum((a) => a.beholdningVedForrigeMånedsslutt),
    utsettNye: sum((a) => a.utsett?.antallNy), flyttaInn: sum((a) => a.utsett?.antallFlyttet),
    flyttaUt: sum((a) => a.uttak?.antallFlyttetUt), selvdode: sum((a) => a.uttak?.antallSelvdød),
    tapUkjent: sum((a) => a.uttak?.antallKanIkkeGjøresRedeFor),
    avliva: sum((a) => {
      const tal = avliving.map((k) => ikkjeNegativ(a.uttak?.[k]));
      return tal.some((n) => n === null) ? null : tal.reduce<number>((s, n) => s + (n ?? 0), 0);
    }),
  };
}
