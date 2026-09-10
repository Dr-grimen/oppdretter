/** Dei opne kjeldene som ikkje ligg i snapshotet frå før. */
import { hent } from "../lib/http.ts";

const MT = "https://akvakultur-offentlig-api.fisk.mattilsynet.io";
const GIS = "https://gis.fiskeridir.no/server/rest/services/Yggdrasil";

async function mt<T>(sti: string, sok: Record<string, string | number>): Promise<T[]> {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(sok)) p.set(k, String(v));
  const { status, tekst } = await hent(`${MT}${sti}?${p}`, {
    headers: { "Client-Id": "oppdretter", Accept: "application/json" },
  });
  if (status !== 200) throw new Error(`Mattilsynet ${sti}: HTTP ${status}`);
  return JSON.parse(tekst) as T[];
}

export type Sjukdomstilfelle = {
  id: string;
  lokalitetsnummer: number;
  lokalitetsnavn: string;
  varslingsdato: string | null;
  diagnosedato: string | null;
  avslutningsdato: string | null;
  ugyldiggjøringsdato: string | null;
  sykdomstype: string;
  sykdomssubtype: string | null;
};

export async function hentSjukdom(): Promise<Sjukdomstilfelle[]> {
  const alle = await mt<Sjukdomstilfelle>("/api/sykdomstilfeller/v1/rapporteringer", {
    limit: 5000,
  });
  // Ugyldiggjorte saker er trekte tilbake av Mattilsynet. Dei skal ikkje varslast.
  return alle.filter((s) => !s.ugyldiggjøringsdato);
}

export type Soknad = {
  applicationno: string;
  applicantorganisationname: string;
  applicantorganisationnumber: string;
  soeknadstype: string;
  status_application: string;
  submittedat: number | null;
  sitenr: number | null;
  sitename: string | null;
  municipalityname: string | null;
  countymunicipalityname: string | null;
  /** Ønskt biomasse i tonn. Dette er kjøpssignalet. */
  desiredbiomass_value: number | null;
  plannedprod_value: number | null;
  plannedfeedsize_value: number | null;
  maxfeedoutsize_value: number | null;
  netdata_typedescription: string | null;
  netdata_depth_value: number | null;
  netdata_treatment: string | null;
  art_popularname: string | null;
  sitelatitudedecimaldegree: number | null;
  sitelongitudedecimaldegree: number | null;
};

/**
 * Opne akvakultursøknader.
 *
 * MERK: MapServer verkar, FeatureServer gir HTTP 500. Og koordinatane kjem
 * som grader ganga med 100 (6581.14 = 65,8114 °N) — ikkje grader-minutt.
 */
export async function hentSoknader(lag = 0): Promise<Soknad[]> {
  const u =
    `${GIS}/Akvakultursøknader/MapServer/${lag}/query` +
    `?where=1%3D1&outFields=*&returnGeometry=false&resultRecordCount=5000&f=json`;
  const { status, tekst } = await hent(u);
  if (status !== 200) throw new Error(`Søknader: HTTP ${status}`);
  const d = JSON.parse(tekst) as
    | { features?: { attributes: Soknad }[] }
    | { error: { code: number; message: string } };
  // Fiskeridirektoratet svarar HTTP 200 med feil i kroppen. Må sjekkast.
  if ("error" in d) throw new Error(`Søknader: ${d.error.code} ${d.error.message}`);
  return (d.features ?? []).map((f) => f.attributes);
}

export function soknadKoordinat(s: Soknad): [number, number] | null {
  const la = s.sitelatitudedecimaldegree;
  const lo = s.sitelongitudedecimaldegree;
  if (la === null || lo === null) return null;
  const lat = la / 100;
  const lon = lo / 100;
  if (lat < 55 || lat > 82 || lon < -5 || lon > 40) return null;
  return [lon, lat];
}

export type BiomasseRad = {
  loknr: number;
  har_fisk: string;
  siste_rapport: string | null;
  art: string | null;
  kapasitet_lok: number | null;
  fylke: string | null;
  produksjonsomraade: string | null;
};

export async function hentBiomasse(): Promise<BiomasseRad[]> {
  const u =
    `${GIS}/Biomasse/MapServer/0/query` +
    `?where=1%3D1&outFields=*&returnGeometry=false&resultRecordCount=5000&f=json`;
  const { status, tekst } = await hent(u);
  if (status !== 200) throw new Error(`Biomasse: HTTP ${status}`);
  const d = JSON.parse(tekst) as
    | { features?: { attributes: BiomasseRad }[] }
    | { error: { code: number; message: string } };
  if ("error" in d) throw new Error(`Biomasse: ${d.error.code} ${d.error.message}`);
  return (d.features ?? []).map((f) => f.attributes);
}
