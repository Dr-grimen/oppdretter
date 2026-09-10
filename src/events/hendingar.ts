/**
 * Hendingsdeteksjon. Alt er reglar, ingen modellar.
 *
 * Kvar hending har ein natural_key så same hending aldri blir laga to gonger,
 * og ein occurred_on som er RAPPORTVEKA — ikkje hentetidspunktet.
 */
import type { Luserapport } from "../ingest/mattilsynet.ts";
import { offentlegEigar, type Lokalitet } from "../ingest/akvakulturregister.ts";
import type { Sjukdomstilfelle, Soknad } from "../ingest/kjelder.ts";
import { lusegrense, erOverGrensa, region } from "./lusegrense.ts";

export type Segment = "not" | "fortoying" | "bronnbat" | "avlusing" | "for" | "service";
export const SEGMENT: Segment[] = ["not", "fortoying", "bronnbat", "avlusing", "for", "service"];

export const SEGMENTNAMN: Record<Segment, string> = {
  not: "Not og oppdrettsutstyr",
  fortoying: "Fortøying og forankring",
  bronnbat: "Brønnbåt og transport",
  avlusing: "Avlusing og fiskehelse",
  for: "Fôr",
  service: "Service og vedlikehald",
};

export type Relevans = { score: number; why: string };

export type HendingType =
  | "over_grensa"
  | "luseauke"
  | "behandling"
  | "behandlingsklynge"
  | "sjukdom_paavist"
  | "sjukdom_avslutta"
  | "ny_soknad"
  | "soknad_avgjort";

export type Hending = {
  natural_key: string;
  type: HendingType;
  tittel: string;
  detalj: string;
  lokalitetsnr: number | null;
  lokalitetsnamn: string;
  selskap: string | null;
  orgnr: string | null;
  produksjonsomrade: number | null;
  fylke: string | null;
  /** Rapportveka, ikkje hentedato. */
  dato: string;
  lat: number | null;
  lon: number | null;
  alvor: 1 | 2 | 3;
  relevans: Partial<Record<Segment, Relevans>>;
};

/** Måndag i ei ISO-veke — hendingar blir daterte på rapportveka. */
export function vekeStart(aar: number, uke: number): string {
  const jan4 = new Date(Date.UTC(aar, 0, 4));
  const dagNr = (jan4.getUTCDay() + 6) % 7;
  const maandag1 = new Date(jan4);
  maandag1.setUTCDate(jan4.getUTCDate() - dagNr);
  const d = new Date(maandag1);
  d.setUTCDate(maandag1.getUTCDate() + (uke - 1) * 7);
  return d.toISOString().slice(0, 10);
}

type Ctx = { lok: Map<number, Lokalitet> };

function grunnlag(r: Luserapport, c: Ctx): Omit<Hending, "natural_key" | "type" | "tittel" | "detalj" | "alvor" | "relevans"> {
  const l = c.lok.get(r.lokalitetsnummer);
  return {
    lokalitetsnr: r.lokalitetsnummer,
    lokalitetsnamn: r.lokalitetsnavn,
    selskap: r.organisasjonsnavn ?? (l ? offentlegEigar(l) : null),
    orgnr: r.organisasjonsnummer ?? l?.innehavarar.find((i) => !i.erPrivatperson)?.orgnr ?? null,
    produksjonsomrade: l?.produksjonsomrade ?? null,
    fylke: l?.fylke ?? null,
    dato: vekeStart(r.år, r.uke),
    lat: l?.lat ?? null,
    lon: l?.lon ?? null,
  };
}

export function finnOverGrensa(rapportar: Luserapport[], c: Ctx): Hending[] {
  const ut: Hending[] = [];
  for (const r of rapportar) {
    const l = c.lok.get(r.lokalitetsnummer);
    const lus = r.lusetelling?.voksneHunnlus;
    if (!l || lus === null || lus === undefined) continue;
    const g = lusegrense(l.fylkenr, r.år, r.uke);
    if (!g.gyldig || !erOverGrensa(lus, g)) continue;

    const overskot = lus / g.verdi;
    ut.push({
      ...grunnlag(r, c),
      natural_key: `over_grensa:${r.lokalitetsnummer}:${r.år}-${r.uke}`,
      type: "over_grensa",
      tittel: `${r.lokalitetsnavn} er over lusegrensa`,
      detalj:
        `${lus.toFixed(2)} vaksne holus mot grensa på ${g.verdi} ` +
        `(${g.region === "nord" ? "nordregelen" : "sørregelen"}, veke ${r.uke}). ` +
        `${overskot.toFixed(1)} gonger grensa.`,
      alvor: overskot >= 2 ? 3 : 2,
      relevans: {
        avlusing: { score: Math.min(100, Math.round(overskot * 40)), why: "Anlegget må sette inn tiltak omgåande. Avlusing er nær føreståande." },
        bronnbat: { score: Math.min(90, Math.round(overskot * 30)), why: "Overskriding fører ofte til badebehandling eller utslakting, som krev båt." },
        service: { score: 30, why: "Mekanisk avlusing krev ofte innleigd mannskap og utstyr." },
      },
    });
  }
  return ut;
}

/** Stigning over tre målingar der siste framleis er under grensa. */
export function finnLuseauke(
  serier: Map<number, { aar: number; uke: number; lus: number }[]>,
  c: Ctx,
  sisteAar: number,
  sisteUke: number,
): Hending[] {
  const ut: Hending[] = [];
  for (const [loknr, serie] of serier) {
    const l = c.lok.get(loknr);
    if (!l || serie.length < 3) continue;
    const s = serie.slice(-3);
    const [a, b, d] = s as [typeof s[0], typeof s[0], typeof s[0]];
    if (d.aar !== sisteAar || d.uke !== sisteUke) continue;
    // Tre MÅLINGAR er ikkje det same som tre veker. Under 4 °C er teljeplikta
    // kvar 14. dag, og eit anlegg kan hoppe over veker. Rekn kor langt det
    // faktisk spenner, så teksten ikkje lyg.
    const spenn = (d.aar - a.aar) * 52 + (d.uke - a.uke) + 1;

    const g = lusegrense(l.fylkenr, d.aar, d.uke);
    if (!g.gyldig) continue;
    if (d.lus > g.verdi) continue; // då er det over_grensa i staden
    const stig = d.lus > b.lus && b.lus > a.lus;
    const auke = d.lus - a.lus;
    if (!stig || auke < 0.05) continue;

    const naerleik = d.lus / g.verdi;
    ut.push({
      lokalitetsnr: loknr,
      lokalitetsnamn: l.namn,
      selskap: offentlegEigar(l),
      orgnr: l.innehavarar.find((i) => !i.erPrivatperson)?.orgnr ?? null,
      produksjonsomrade: l.produksjonsomrade,
      fylke: l.fylke,
      dato: vekeStart(d.aar, d.uke),
      lat: l.lat,
      lon: l.lon,
      natural_key: `luseauke:${loknr}:${d.aar}-${d.uke}`,
      type: "luseauke",
      tittel: `${l.namn} har stigande lusetal`,
      detalj:
        `${a.lus.toFixed(2)} → ${b.lus.toFixed(2)} → ${d.lus.toFixed(2)} ` +
        (spenn === 3 ? "over tre veker" : `over ${spenn} veker, tre teljingar`) +
        `. Grensa er ${g.verdi}. Framleis under, men på veg opp.`,
      alvor: naerleik > 0.8 ? 2 : 1,
      relevans: {
        avlusing: { score: Math.round(naerleik * 70), why: "Tre veker med stigning endar som regel i behandling. Ta kontakt før dei må." },
        for: { score: 20, why: "Lusepress endrar fôringsregime og appetitt." },
        service: { score: 15, why: "Førebyggande tiltak som luseskjørt blir vurdert på dette stadiet." },
      },
    });
  }
  return ut;
}

function behandlingstypar(r: Luserapport): string[] {
  const t: string[] = [];
  if (r.medikamentelleBehandlinger.length) t.push(`${r.medikamentelleBehandlinger.length} medikamentell`);
  if (r.ikkeMedikamentelleBehandlinger.length) t.push(`${r.ikkeMedikamentelleBehandlinger.length} ikkje-medikamentell`);
  if (r.kombinasjonsbehandlinger.length) t.push(`${r.kombinasjonsbehandlinger.length} kombinasjon`);
  return t;
}

export function finnBehandling(rapportar: Luserapport[], c: Ctx): Hending[] {
  const ut: Hending[] = [];
  for (const r of rapportar) {
    const typar = behandlingstypar(r);
    if (!typar.length) continue;
    ut.push({
      ...grunnlag(r, c),
      natural_key: `behandling:${r.lokalitetsnummer}:${r.år}-${r.uke}`,
      type: "behandling",
      tittel: `${r.lokalitetsnavn} har avlusa`,
      detalj: `${typar.join(", ")} i veke ${r.uke}. Sjøtemperatur ${r.sjøtemperatur?.toFixed(1) ?? "?"} °C.`,
      alvor: 1,
      relevans: {
        bronnbat: { score: 55, why: "Badebehandling krev brønnbåt eller presenning. Sjekk om dei treng kapasitet neste gong." },
        avlusing: { score: 45, why: "Behandling no tyder på at metoden verkar eller ikkje verkar. Begge deler er ein samtale." },
        not: { score: 25, why: "Mekanisk avlusing slit på nota. Ettersyn og reparasjon kjem etterpå." },
      },
    });
  }
  return ut;
}

/** Tre eller fleire behandlingar i same produksjonsområde same veke. */
export function finnKlynger(rapportar: Luserapport[], c: Ctx): Hending[] {
  const perPo = new Map<number, Luserapport[]>();
  for (const r of rapportar) {
    if (!behandlingstypar(r).length) continue;
    const po = c.lok.get(r.lokalitetsnummer)?.produksjonsomrade;
    if (po === null || po === undefined) continue;
    perPo.set(po, [...(perPo.get(po) ?? []), r]);
  }
  const ut: Hending[] = [];
  for (const [po, liste] of perPo) {
    if (liste.length < 3) continue;
    const f = liste[0];
    if (!f) continue;
    const l = c.lok.get(f.lokalitetsnummer);
    ut.push({
      lokalitetsnr: null,
      lokalitetsnamn: `Produksjonsområde ${po}`,
      selskap: null,
      orgnr: null,
      produksjonsomrade: po,
      fylke: null,
      dato: vekeStart(f.år, f.uke),
      lat: l?.lat ?? null,
      lon: l?.lon ?? null,
      natural_key: `klynge:${po}:${f.år}-${f.uke}`,
      type: "behandlingsklynge",
      tittel: `${liste.length} anlegg avlusar samtidig i PO ${po}`,
      detalj: `${liste.slice(0, 4).map((x) => x.lokalitetsnavn).join(", ")}${liste.length > 4 ? ` og ${liste.length - 4} til` : ""} — alle i veke ${f.uke}.`,
      alvor: liste.length >= 8 ? 3 : 2,
      relevans: {
        bronnbat: { score: Math.min(100, liste.length * 9), why: "Samtidig avlusing i eit heilt område betyr kamp om båtkapasitet. Den som ringjer først vinn." },
        avlusing: { score: Math.min(90, liste.length * 8), why: "Regionalt lusepress. Fleire kundar med same problem i same veke." },
        for: { score: 20, why: "Behandling gir fôringsstopp. Leveranseplanar må justerast." },
      },
    });
  }
  return ut;
}

export function finnSjukdom(saker: Sjukdomstilfelle[], c: Ctx): Hending[] {
  const ut: Hending[] = [];
  const namn: Record<string, string> = {
    PANKREASSYKDOM: "PD",
    INFEKSIØS_LAKSEANEMI: "ILA",
    ILA: "ILA",
  };
  for (const s of saker) {
    const l = c.lok.get(s.lokalitetsnummer);
    const sjukdom = namn[s.sykdomstype] ?? s.sykdomstype.replaceAll("_", " ").toLowerCase();
    const sub = s.sykdomssubtype ? ` (${s.sykdomssubtype.replace("PD_", "")})` : "";
    const base = {
      lokalitetsnr: s.lokalitetsnummer,
      lokalitetsnamn: s.lokalitetsnavn,
      selskap: l ? offentlegEigar(l) : null,
      orgnr: l?.innehavarar[0]?.orgnr ?? null,
      produksjonsomrade: l?.produksjonsomrade ?? null,
      fylke: l?.fylke ?? null,
      lat: l?.lat ?? null,
      lon: l?.lon ?? null,
    };

    // Ei sak som er avslutta skal ikkje stå som eit pågåande utbrot.
    const paagaar = !s.avslutningsdato;
    if (s.diagnosedato) {
      ut.push({
        ...base,
        dato: s.diagnosedato.slice(0, 10),
        natural_key: `sjukdom:${s.id}:paavist`,
        type: "sjukdom_paavist",
        tittel: paagaar
          ? `${sjukdom}${sub} påvist på ${s.lokalitetsnavn}`
          : `${sjukdom}${sub} blei påvist på ${s.lokalitetsnavn}`,
        detalj:
          `Diagnose stilt ${s.diagnosedato.slice(0, 10)}.` +
          (s.varslingsdato ? ` Varsla ${s.varslingsdato.slice(0, 10)}.` : "") +
          (paagaar
            ? " Saka er ikkje avslutta. Anlegget kjem truleg inn i ei kontrollsone."
            : ` Saka blei avslutta ${s.avslutningsdato?.slice(0, 10)}.`),
        alvor: paagaar ? 3 : 1,
        relevans: {
          service: { score: 70, why: "Sjukdomsutbrot utløyser desinfeksjon, ekstra tilsyn og strengare rutinar." },
          bronnbat: { score: 60, why: "ILA endar ofte i utslakting. PD gir restriksjonar på flytting." },
          not: { score: 35, why: "Utslakting og brakklegging betyr notskifte og ettersyn." },
          avlusing: { score: 25, why: "Sjuk fisk toler behandling dårlegare. Metodevalet endrar seg." },
        },
      });
    }
    if (s.avslutningsdato) {
      ut.push({
        ...base,
        dato: s.avslutningsdato.slice(0, 10),
        natural_key: `sjukdom:${s.id}:avslutta`,
        type: "sjukdom_avslutta",
        tittel: `${sjukdom}-saka på ${s.lokalitetsnavn} er avslutta`,
        detalj: `Avslutta ${s.avslutningsdato.slice(0, 10)}. Anlegget skal etter kvart ut av kontrollsona og kan settast i drift att.`,
        alvor: 1,
        relevans: {
          not: { score: 65, why: "Ny produksjonssyklus krev ny not. Bestillinga skjer no." },
          fortoying: { score: 55, why: "Ettersyn av fortøying blir gjort før nytt utsett." },
          for: { score: 50, why: "Nytt utsett betyr ny fôrkontrakt." },
          service: { score: 40, why: "Klargjering av lokaliteten før utsett." },
        },
      });
    }
  }
  return ut;
}

/** Sett av bygget, så hendingsreglane slepp å kjenne til geometri. */
let poOppslag: ((lon: number, lat: number) => number | null) | null = null;
export function settPoOppslag(f: (lon: number, lat: number) => number | null): void {
  poOppslag = f;
}
function poFraPunkt(s: Soknad): number | null {
  if (!poOppslag) return null;
  const k = soknadKoordinatLokal(s);
  return k ? poOppslag(k[0], k[1]) : null;
}
/** Koordinatane kjem som grader ganga med 100 (6581.14 = 65,8114 °N). */
function soknadKoordinatLokal(s: Soknad): [number, number] | null {
  const la = s.sitelatitudedecimaldegree, lo = s.sitelongitudedecimaldegree;
  if (la === null || lo === null) return null;
  const lat = la / 100, lon = lo / 100;
  if (lat < 55 || lat > 82 || lon < -5 || lon > 40) return null;
  return [lon, lat];
}

/** Nokre søknader har rå kode i staden for norsk tekst i soeknadstype-feltet. */
const SOKNADSTYPE: Record<string, string> = {
  SPECIAL_INTENTION_SITE_CLEARANCE: "Klarering av lokalitet til særleg føremål",
  RESEARCH: "Forskingsløyve",
  RESEARCH_EXPERIMENT_PLAN: "Forskingsløyve, forsøksplan",
  RESEARCH_EXTENSION: "Forlenging av forskingsløyve",
};
function soknadstype(s: Soknad): string {
  const rå = (s.soeknadstype ?? "").trim();
  const kjent = SOKNADSTYPE[rå];
  if (kjent) return kjent;
  // «... i sjø.» + «, Kommune» gav dobbelt punktum.
  return rå.replace(/\.\s*$/, "");
}

export function finnSoknader(soknader: Soknad[], c: Ctx, opne: boolean): Hending[] {
  const ut: Hending[] = [];
  for (const s of soknader) {
    if (!s.submittedat) continue;
    const dato = new Date(s.submittedat).toISOString().slice(0, 10);
    const l = s.sitenr ? c.lok.get(s.sitenr) : undefined;
    const mtb = s.desiredbiomass_value;
    const bitar: string[] = [];
    if (mtb) bitar.push(`ønskjer ${mtb.toLocaleString("nn-NO")} tonn MTB`);
    if (s.plannedfeedsize_value) bitar.push(`planlagt fôr ${s.plannedfeedsize_value.toLocaleString("nn-NO")} tonn`);
    // netdata_depth_value kjem i centimeter i kjelda.
    if (s.netdata_depth_value) bitar.push(`notdjupn ${Math.round(s.netdata_depth_value / 100)} m`);

    const stor = (mtb ?? 0) >= 3000;
    // Eit landbasert anlegg eller havbeite har verken not eller fortøying.
    // Å love ein notleverandør at dette er ein kunde er å sende han feil veg.
    const tekst = `${s.soeknadstype ?? ""} ${s.sitename ?? ""}`.toLowerCase();
    const iSjo = !/landbasert|på land|havbeite|klekkeri|settefisk/.test(tekst);
    // RETURNED = sendt i retur til søkjaren. Det er ikkje ein aktiv søknad,
    // og skal ikkje lesast som «dei skal bygge no».
    const returnert = s.status_application === "RETURNED";
    ut.push({
      lokalitetsnr: s.sitenr,
      lokalitetsnamn: s.sitename ?? "Ny lokalitet",
      selskap: s.applicantorganisationname,
      orgnr: s.applicantorganisationnumber,
      // Fell tilbake til PO frå koordinatane når søknaden ikkje har eit
      // lokalitetsnummer enno — elles gøymer områdefilteret kvar einaste søknad.
      produksjonsomrade: l?.produksjonsomrade ?? poFraPunkt(s) ?? null,
      fylke: s.countymunicipalityname ?? l?.fylke ?? null,
      dato,
      lat: l?.lat ?? null,
      lon: l?.lon ?? null,
      natural_key: `soknad:${s.applicationno}:${opne ? "open" : "avgjort"}`,
      type: opne ? "ny_soknad" : "soknad_avgjort",
      tittel: !opne
        ? `Søknad avgjort: ${s.sitename ?? s.applicationno}`
        : returnert
          ? `${s.applicantorganisationname} fekk søknaden om ${s.sitename ?? "ny lokalitet"} i retur`
          : `${s.applicantorganisationname} søkjer om ${s.sitename ?? "ny lokalitet"}`,
      detalj:
        (returnert ? "Sendt i retur til søkjaren — ikkje ein aktiv søknad. " : "") +
        `${soknadstype(s)}${s.municipalityname ? `, ${s.municipalityname}` : ""}. ` +
        (bitar.length ? `${bitar.join(", ")}. ` : "") +
        (s.netdata_typedescription ? `Not: ${s.netdata_typedescription.slice(0, 120)}` : ""),
      alvor: returnert ? 1 : stor ? 3 : opne ? 2 : 1,
      relevans: {
        ...(iSjo
          ? {
              not: { score: stor ? 90 : 60, why: "Ein søknad med oppgitt notdjupn og nottype er ei innkjøpsspesifikasjon i praksis." },
              fortoying: { score: stor ? 85 : 55, why: "Ny lokalitet krev heilt nytt fortøyingsanlegg. Lang leveringstid." },
            }
          : {}),
        for: { score: mtb ? Math.min(95, Math.round(mtb / 60)) : 40, why: "Planlagt fôrmengd står i søknaden. Det er kontraktstorleiken." },
        service: { score: 45, why: "Etablering krev montering, dykking og sertifisering." },
        bronnbat: { score: 30, why: "Nytt anlegg betyr nye smoltleveransar." },
      },
    });
  }
  return ut;
}

/** Toppscore for eit segment, brukt til sortering i feeden. */
/**
 * Kor viktig hendinga er for nokon som DRIV eit anlegg, i motsetnad til nokon
 * som sel til det. Ein søknad frå eit anna selskap er eit salssignal, ikkje
 * noko ein driftsleiar treng å vite om i dag.
 */
export function driftsvekt(h: Hending): number {
  switch (h.type) {
    case "over_grensa": return 100;
    case "sjukdom_paavist": return 90;
    case "luseauke": return 70;
    case "behandlingsklynge": return 60;
    case "behandling": return 45;
    case "sjukdom_avslutta": return 25;
    case "soknad_avgjort": return 12;
    case "ny_soknad": return 10;
    default: return 20;
  }
}

export function score(h: Hending, seg: Segment | "alle"): number {
  if (seg === "alle") {
    const alle = Object.values(h.relevans).map((r) => r.score);
    return alle.length ? Math.max(...alle) : 0;
  }
  return h.relevans[seg]?.score ?? 0;
}
