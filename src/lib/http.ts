/**
 * Felles HTTP-lag: rate limit + retry med backoff.
 * BarentsWatch publiserer ingen tal for struping (verifisert: 0 treff på
 * "rate limit"/429/Retry-After i heile spesifikasjonen), men fråvær av
 * dokumentasjon er ikkje fråvær av struping. Vilkåra krev dessutan at
 * batch-nedlastingar går sekvensielt i éin tråd.
 */

export type FetchOptions = {
  headers?: Record<string, string>;
  method?: string;
  body?: string;
  /** Rå tekst i staden for JSON. Nokre feilsvar frå BarentsWatch er text/plain. */
  raw?: boolean;
  /** Tak på eitt enkelt kall. Standard tre minutt. */
  timeoutMs?: number;
};

const MIN_MS_MELLOM_KALL = 250; // maks 4 kall/sek, sekvensielt
const MAKS_FORSOK = 5;
const MAKS_VENT_MS = 60_000; // aldri sov meir enn eitt minutt mellom forsøk

let sisteKall = 0;

async function vent(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function strup(): Promise<void> {
  const no = Date.now();
  const sidan = no - sisteKall;
  if (sidan < MIN_MS_MELLOM_KALL) await vent(MIN_MS_MELLOM_KALL - sidan);
  sisteKall = Date.now();
}

export class HttpFeil extends Error {
  status: number;
  url: string;
  kropp: string;

  constructor(status: number, url: string, kropp: string) {
    super(`HTTP ${status} for ${url}: ${kropp.slice(0, 300)}`);
    this.name = "HttpFeil";
    this.status = status;
    this.url = url;
    this.kropp = kropp;
  }
}

/** Eitt kall med backoff. Retry berre på 429/5xx og nettverksfeil. */
export async function hent(
  url: string,
  opt: FetchOptions = {},
): Promise<{ status: number; tekst: string; headers: Headers }> {
  let sisteFeil: unknown;
  for (let forsok = 1; forsok <= MAKS_FORSOK; forsok++) {
    await strup();
    try {
      // Utan timeout kan eit kall henge til jobben blir drepen.
      const svar = await fetch(url, {
        method: opt.method ?? "GET",
        headers: opt.headers ?? {},
        signal: AbortSignal.timeout(opt.timeoutMs ?? 180_000),
        ...(opt.body !== undefined ? { body: opt.body } : {}),
      });
      const tekst = await svar.text();

      if (svar.status === 429 || svar.status >= 500) {
        // Retry-After kan vere sekund ELLER ein HTTP-dato, og ein server kan
        // oppgi timevis. Utan tak kunne den daglege jobben sove til han blei
        // drepen av tidsgrensa.
        const raa = svar.headers.get("Retry-After");
        const fraaHeader = raa === null ? NaN
          : /^\d+$/.test(raa.trim()) ? Number(raa) * 1000
          : Date.parse(raa) - Date.now();
        const ventMs = Number.isFinite(fraaHeader) && fraaHeader > 0
          ? Math.min(MAKS_VENT_MS, fraaHeader)
          : Math.min(MAKS_VENT_MS, 2 ** forsok * 500);
        if (forsok < MAKS_FORSOK) {
          console.error(
            `  [retry ${forsok}/${MAKS_FORSOK}] ${svar.status} — ventar ${ventMs} ms`,
          );
          await vent(ventMs);
          continue;
        }
      }
      return { status: svar.status, tekst, headers: svar.headers };
    } catch (e) {
      sisteFeil = e;
      if (forsok < MAKS_FORSOK) {
        const ventMs = Math.min(30_000, 2 ** forsok * 500);
        console.error(`  [retry ${forsok}/${MAKS_FORSOK}] nettverksfeil — ventar ${ventMs} ms`);
        await vent(ventMs);
        continue;
      }
    }
  }
  throw sisteFeil ?? new Error(`Gav opp etter ${MAKS_FORSOK} forsøk: ${url}`);
}

/** Som hent(), men krev 2xx og parsar JSON. */
export async function hentJson<T = unknown>(
  url: string,
  opt: FetchOptions = {},
): Promise<T> {
  const { status, tekst } = await hent(url, opt);
  if (status < 200 || status >= 300) throw new HttpFeil(status, url, tekst);
  return JSON.parse(tekst) as T;
}
