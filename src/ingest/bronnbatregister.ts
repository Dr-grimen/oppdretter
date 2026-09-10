/**
 * Mattilsynet si liste over godkjende transporteiningar for levande akvakulturdyr —
 * altså brønnbåtregisteret. Ope, ingen konto, oppdatert dagleg.
 *
 * https://www.mattilsynet.no/godkjente-produkter-og-virksomheter/
 *   transportenheter-godkjent-for-transport-av-levende-akvakulturdyr
 *
 * Dette er nøkkelen til å skilje ekte brønnbåt frå slaktebåt: AIS gir oss
 * kallesignalet, og kallesignalet står i registeret. Ein båt som IKKJE står her
 * har ikkje lov til å transportere levande fisk, uansett kva AIS kallar han.
 *
 * MERK: lista inneheld òg brønnbilar og transporttankar på land (utan kallesignal),
 * og godkjenningar som har gått ut på dato. Begge må filtrerast bort.
 */
import { hent } from "../lib/http.ts";

const SIDE =
  "https://www.mattilsynet.no/godkjente-produkter-og-virksomheter/" +
  "transportenheter-godkjent-for-transport-av-levende-akvakulturdyr";

export type Transporteining = {
  verksemd: string;
  orgnr: string | null;
  namn: string;
  kallesignal: string | null;
  kommune: string | null;
  fylke: string | null;
  godkjentFra: string | null;
  godkjentTil: string | null;
  /** Fartøy har kallesignal; brønnbilar og tankar har det ikkje. */
  erFartoy: boolean;
  /** Godkjenninga gjeld framleis. */
  gyldig: boolean;
};

/** Lenka har ein innhalds-hash i seg, så vi hentar ho frå sida kvar gong. */
async function finnCsvUrl(): Promise<string> {
  const { status, tekst } = await hent(SIDE);
  if (status !== 200) throw new Error(`Mattilsynet-sida: HTTP ${status}`);
  const m = tekst.match(/https:\/\/[^"']*v_virklist_transport_levende_akva\.csv/);
  if (!m) throw new Error("Fann ikkje lenka til brønnbåtlista på sida.");
  return m[0];
}

/** CSV-en er komma-separert med siterte felt. */
function delLinje(l: string): string[] {
  const ut: string[] = [];
  let felt = "", iSitat = false;
  for (let i = 0; i < l.length; i++) {
    const c = l[i];
    if (c === '"') {
      if (iSitat && l[i + 1] === '"') { felt += '"'; i++; }
      else iSitat = !iSitat;
    } else if (c === "," && !iSitat) { ut.push(felt); felt = ""; }
    else felt += c;
  }
  ut.push(felt);
  return ut;
}

export async function hentBronnbatregister(): Promise<Transporteining[]> {
  const url = await finnCsvUrl();
  const { status, tekst } = await hent(url);
  if (status !== 200) throw new Error(`Brønnbåtlista: HTTP ${status}`);

  const linjer = tekst.split(/\r?\n/).filter((l) => l.trim());
  const hovud = delLinje(linjer[0] ?? "").map((h) => h.trim().toUpperCase());
  const i = (n: string): number => hovud.indexOf(n);
  const iNamn = i("NAVN"), iKs = i("KALLESIGNAL"), iVerk = i("VIRKSOMHETSNAVN");
  const iOrg = i("BEDRIFTSNR"), iKom = i("KOMMUNE"), iFyl = i("FYLKE");
  const iFra = i("GODKJENTFRADATO"), iTil = i("GODKJENTTILDATO");

  const idag = new Date().toISOString().slice(0, 10);
  const ut: Transporteining[] = [];

  for (const l of linjer.slice(1)) {
    const f = delLinje(l);
    const ks = (f[iKs] ?? "").trim().toUpperCase();
    const til = (f[iTil] ?? "").trim().slice(0, 10) || null;
    // Eit kallesignal er bokstavar og tal utan mellomrom. «ZD 25876» er eit bilskilt.
    const erFartoy = /^[A-Z0-9]{4,7}$/.test(ks);
    ut.push({
      verksemd: (f[iVerk] ?? "").trim(),
      orgnr: (f[iOrg] ?? "").trim() || null,
      namn: (f[iNamn] ?? "").trim(),
      kallesignal: erFartoy ? ks : null,
      kommune: (f[iKom] ?? "").trim() || null,
      fylke: (f[iFyl] ?? "").trim() || null,
      godkjentFra: (f[iFra] ?? "").trim().slice(0, 10) || null,
      godkjentTil: til,
      erFartoy,
      gyldig: til === null || til >= idag,
    });
  }
  return ut;
}

/** Oppslag frå kallesignal til godkjenning. Berre gyldige fartøy. */
export function pakallesignal(reg: Transporteining[]): Map<string, Transporteining> {
  const m = new Map<string, Transporteining>();
  for (const t of reg) {
    if (!t.erFartoy || !t.kallesignal || !t.gyldig) continue;
    const finst = m.get(t.kallesignal);
    // Ved fleire oppføringar: behald den som varer lengst.
    if (!finst || (t.godkjentTil ?? "9999") > (finst.godkjentTil ?? "9999")) {
      m.set(t.kallesignal, t);
    }
  }
  return m;
}
