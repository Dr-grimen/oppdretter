/**
 * Lusegrensa etter FOR-2012-12-05-1140 § 8 («forskrift om lakselusbekjempelse»),
 * slik ho har lydd sidan FOR-2017-03-06-275 tok til å gjelde 6. mars 2017.
 *
 * Grensa er eit ANLEGGSSNITT av vaksne holus per fisk, og ho gjeld til ei kvar tid.
 *
 *   Sør  («Nord-Trøndelag og sørover»): 0,2 i veke 16–21, elles 0,5
 *   Nord («Nordland, Troms og Finnmark»): 0,2 i veke 21–26, elles 0,5
 *
 * Veke 21 er 0,2 i BEGGE regionar. Veke 22–26 er 0,5 i sør og 0,2 i nord.
 * Det er der eit naivt system med éi grense for heile landet bommar.
 *
 * Forskrifta bruker gamle fylke, ikkje produksjonsområde. Produksjonsområda
 * styrer trafikklyssystemet, ikkje § 8.
 *
 * ÅTVARINGAR:
 *  - Før 6.3.2017 var grensa 0,5 heile året, heile landet. Bruk aldri dagens
 *    regel på eldre veker — då blir kvar einaste vår feilklassifisert.
 *  - Mattilsynet handhevar 0,2-grensa med ein slingringsmon (0,3-regelen).
 *    Sjå erOverGrensa vs. erHandhevaOver under.
 *  - Stamfisk kan ha løyve til høgare grense (§ 8 fjerde ledd). Vi kjenner ikkje
 *    dei løyva, så eit varsel kan vere ein falsk positiv.
 */

/** Fylkesnummer som fell under nordregelen, historiske inkluderte. */
const NORDFYLKE = new Set([
  "18", // Nordland
  "19", // Troms (til 2020)
  "20", // Finnmark (til 2020)
  "54", // Troms og Finnmark (2020–2023)
  "55", // Troms (frå 2024)
  "56", // Finnmark (frå 2024)
]);

export type Region = "nord" | "sor";

export function region(fylkenr: string): Region {
  return NORDFYLKE.has(fylkenr.trim()) ? "nord" : "sor";
}

/** Datoen § 8 fekk dagens ordlyd. Alt før dette er eit anna regime. */
export const REGEL_FRA_AAR = 2017;
export const REGEL_FRA_UKE = 10; // 6. mars 2017 fell i veke 10

export type Grense = {
  verdi: 0.2 | 0.5;
  region: Region;
  /** false for veker før 6.3.2017 — då gjeld ikkje denne regelen. */
  gyldig: boolean;
  heimel: string;
};

export function lusegrense(fylkenr: string, aar: number, uke: number): Grense {
  const r = region(fylkenr);
  const gyldig = aar > REGEL_FRA_AAR || (aar === REGEL_FRA_AAR && uke >= REGEL_FRA_UKE);

  const streng =
    r === "nord" ? uke >= 21 && uke <= 26 : uke >= 16 && uke <= 21;

  return {
    verdi: streng ? 0.2 : 0.5,
    region: r,
    gyldig,
    heimel: "FOR-2012-12-05-1140 § 8",
  };
}

/** Rein overskriding av den juridiske grensa. */
export function erOverGrensa(voksneHunnlus: number, grense: Grense): boolean {
  return voksneHunnlus > grense.verdi;
}

/**
 * Mattilsynet si eigen handheving av 0,2-grensa, publisert 06.04.2022:
 *   - 0,3 eller høgare éin gong  → handheva som over 0,2
 *   - mellom 0,2 og 0,3 tre etterfølgjande TELJINGAR → handheva som over
 *   - under 0,3 ein eller to gonger → handheva som under
 *
 * Merk «teljingar», ikkje veker: under 4 °C er teljeplikta kvar 14. dag, så
 * tre teljingar kan spenne seks veker.
 *
 * `serie` er verdiar i kronologisk rekkjefølgje, nyaste sist.
 */
export function erHandhevaOver(serie: number[], grense: Grense): boolean {
  const siste = serie.at(-1);
  if (siste === undefined) return false;
  if (grense.verdi === 0.5) return siste > 0.5;

  if (siste >= 0.3) return true;
  const tre = serie.slice(-3);
  return tre.length === 3 && tre.every((v) => v > 0.2);
}
