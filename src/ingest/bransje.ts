/**
 * Bransjenytt og ledige jobbar. Alt ope, ingen konto.
 *
 *   ilaks.no          RSS, annonsefinansiert, ingen betalmur
 *   kyst.no           RSS via ?lab_viewport=rss
 *   sjomatnorge.no    RSS frå Sjømat Norge (bransjeorganisasjonen)
 *   arbeidsplassen.nav.no/stillinger/api/search — NAV sine stillingar
 *
 * MERK: NAV sitt DOKUMENTERTE public-feed krev Bearer-token. Søke-API-et
 * bak nettsida gjer ikkje det. Vi bruker det siste, og held oss til eit
 * roleg tal kall ein gong i døgnet.
 */
import { hent } from "../lib/http.ts";

export type Nyheit = {
  tittel: string;
  lenke: string;
  dato: string;
  utdrag: string;
  kjelde: string;
};

const KJELDER: { namn: string; url: string }[] = [
  { namn: "iLaks", url: "https://ilaks.no/feed/" },
  { namn: "Kyst.no", url: "https://www.kyst.no/?lab_viewport=rss" },
  { namn: "Sjømat Norge", url: "https://sjomatnorge.no/feed/" },
];

function avkod(s: string): string {
  return s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function felt(item: string, tag: string): string {
  const m = item.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return m?.[1] ? avkod(m[1]) : "";
}

export async function hentNytt(): Promise<Nyheit[]> {
  const ut: Nyheit[] = [];
  for (const k of KJELDER) {
    try {
      const { status, tekst } = await hent(k.url, { timeoutMs: 45_000 });
      if (status !== 200) { console.error(`  ${k.namn}: HTTP ${status}`); continue; }
      const saker = tekst.match(/<item[\s>][\s\S]*?<\/item>/gi) ?? [];
      let n = 0;
      for (const it of saker) {
        // iLaks set ein tankestrek framfor sitattitlar.
        const tittel = felt(it, "title").replace(/^[–—-]\s*/, "");
        const lenke = felt(it, "link");
        const raa = felt(it, "pubDate");
        const tid = Date.parse(raa);
        // «Les magasinet her» og liknande snarvegar har verken dato eller innhald.
        if (!tittel || !lenke || !Number.isFinite(tid)) continue;
        ut.push({
          tittel,
          lenke,
          dato: new Date(tid).toISOString(),
          // RSS-utdraga endar i «Les mer»/«Les meir»-halar frå kjelda.
          utdrag: felt(it, "description")
            .replace(/\s*(Les (mer|meir)|Continue reading).*$/i, "")
            .slice(0, 230)
            .trim(),
          kjelde: k.namn,
        });
        n++;
      }
      console.log(`  ${k.namn.padEnd(13)} ${n} saker`);
    } catch (e) {
      console.error(`  ${k.namn}: ${(e as Error).message}`);
    }
  }
  return ut.sort((a, b) => (a.dato < b.dato ? 1 : -1));
}

export type Jobb = {
  id: string;
  tittel: string;
  arbeidsgivar: string;
  stad: string;
  publisert: string;
  frist: string | null;
  lenke: string;
  /** Søkeordet som fann stillinga, til gruppering i UI-et. */
  omrade: string;
};

/**
 * NAV strupar oss (HTTP 429) om åtte søk kjem rett etter kvarandre. Vi held
 * oss til fire breie ord med pause mellom, og lèt «akvakultur» og «havbruk»
 * fange det meste. Fire søk gav 43 treff; åtte raske gav same talet pluss
 * fire strupa kall.
 */
const SOK = ["akvakultur", "havbruk", "røkter", "oppdrett"];
const PAUSE_MS = 1500;

function sov(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

type NavTreff = {
  _source: {
    uuid?: string;
    title?: string;
    employer?: { name?: string };
    businessName?: string;
    published?: string;
    expires?: string;
    locationList?: { municipal?: string; county?: string; city?: string }[];
  };
};

/** Ord som gjer ei stilling havbruksrelevant uavhengig av arbeidsgivar. */
const RELEVANT = /r(ø|o)kter|akvakultur|havbruk|oppdrett|settefisk|matfisk|smolt|br(ø|o)nnb|fiskehelse|lakselus|merd|fiskeoppdrett|sj(ø|o)mat|lakse|biolog.*fisk|driftsteknikar|driftstekniker/i;

/** Ord som tyder på at treffet er frå ein heilt annan bransje. */
const IRRELEVANT = /nortura|kylling|svin|landbruk|b(ø|o)nder|rørlegg|elektrikar|elektriker|butikk|kundes(e|ø)nter/i;

/**
 * Eit breitt søk på «oppdrett» og «havbruk» dreg inn slakteri for kylling og
 * slangeforretningar. Vi held det som anten har eit havbruksord i tittelen,
 * eller ein arbeidsgivar vi kjenner frå Akvakulturregisteret.
 */
function erRelevant(j: Jobb, kjendeSelskap: Set<string>): boolean {
  const arb = j.arbeidsgivar.toUpperCase();
  for (const namn of kjendeSelskap) {
    if (namn.length > 5 && arb.includes(namn)) return true;
  }
  const tekst = `${j.tittel} ${j.arbeidsgivar}`;
  if (IRRELEVANT.test(tekst)) return false;
  return RELEVANT.test(tekst);
}

export async function hentJobbar(kjendeSelskap = new Set<string>()): Promise<Jobb[]> {
  const kart = new Map<string, Jobb>();
  for (const [i, q] of SOK.entries()) {
    if (i > 0) await sov(PAUSE_MS);
    try {
      const url =
        "https://arbeidsplassen.nav.no/stillinger/api/search" +
        `?q=${encodeURIComponent(q)}&size=100`;
      const { status, tekst } = await hent(url, { timeoutMs: 45_000 });
      if (status !== 200) { console.error(`  jobb «${q}»: HTTP ${status}`); continue; }
      const d = JSON.parse(tekst) as { hits?: { hits?: NavTreff[] } };
      for (const t of d.hits?.hits ?? []) {
        const s = t._source;
        if (!s.uuid || !s.title) continue;
        if (kart.has(s.uuid)) continue;
        const l = s.locationList?.[0];
        kart.set(s.uuid, {
          id: s.uuid,
          tittel: s.title,
          arbeidsgivar: s.employer?.name ?? s.businessName ?? "",
          stad: [l?.municipal, l?.county].filter(Boolean).join(", "),
          publisert: (s.published ?? "").slice(0, 10),
          frist: s.expires ? s.expires.slice(0, 10) : null,
          lenke: `https://arbeidsplassen.nav.no/stillinger/stilling/${s.uuid}`,
          omrade: q,
        });
      }
    } catch (e) {
      console.error(`  jobb «${q}»: ${(e as Error).message}`);
    }
  }
  const idag = new Date().toISOString().slice(0, 10);
  const opne = [...kart.values()].filter((j) => !j.frist || j.frist >= idag);
  const ut = opne
    .filter((j) => erRelevant(j, kjendeSelskap))
    .sort((a, b) => (a.publisert < b.publisert ? 1 : -1));
  console.log(`  jobbar        ${ut.length} i havbruk (${opne.length} opne treff totalt)`);
  return ut;
}
