/** Calendar decisions use Europe/Oslo, independently of the build machine. */
export type Veke = { aar: number; uke: number };

export function norskDato(d: Date): Date {
  const delar = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Oslo", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(d);
  return new Date(`${delar}T00:00:00Z`);
}

export function isoVeke(d: Date): Veke {
  const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  t.setUTCDate(t.getUTCDate() - ((t.getUTCDay() + 6) % 7) + 3);
  const aar = t.getUTCFullYear();
  const f = new Date(Date.UTC(aar, 0, 4));
  f.setUTCDate(f.getUTCDate() - ((f.getUTCDay() + 6) % 7) + 3);
  return { aar, uke: 1 + Math.round((t.getTime() - f.getTime()) / (7 * 864e5)) };
}

export function vekerIAar(aar: number): number {
  return isoVeke(new Date(Date.UTC(aar, 11, 28))).uke;
}

export function forrige(aar: number, uke: number, n: number): Veke {
  let a = aar, u = uke - n;
  while (u < 1) { a--; u += vekerIAar(a); }
  return { aar: a, uke: u };
}

/** Tuesday is the deadline day, not a guarantee every report has arrived. */
export function sisteRapportveke(d: Date): Veke & { forbiFrist: boolean } {
  const lokal = norskDato(d);
  const no = isoVeke(lokal);
  const forbiFrist = lokal.getUTCDay() === 0 || lokal.getUTCDay() >= 3;
  return { ...forrige(no.aar, no.uke, forbiFrist ? 1 : 2), forbiFrist };
}

/** Kystdatahuset explicitly calls its field date_time_utc, sometimes without Z. */
export function aisTidIso(t: unknown): string | null {
  if (typeof t !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(t)) return null;
  const utc = /(?:Z|[+-]\d{2}:\d{2})$/i.test(t) ? t : `${t}Z`;
  const ms = Date.parse(utc);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
}

/** Mattilsynet sends nanoseconds; Date.parse alone loses submillisecond corrections. */
export function samanliknTid(a: string, b: string): number {
  const presis = (t: string): bigint => {
    const fraksjon = (t.match(/\.(\d+)(?:Z|[+-]\d{2}:\d{2})$/)?.[1] ?? "").padEnd(9, "0").slice(0, 9);
    return BigInt(Date.parse(t)) * 1_000_000n + BigInt(fraksjon.slice(3));
  };
  const x = presis(a), y = presis(b);
  return x < y ? -1 : x > y ? 1 : 0;
}
