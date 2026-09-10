/**
 * Normalisering av Akvakulturregisteret (Fiskeridirektoratet, NLOD).
 *
 * Kjelde: api.fiskeridir.no/pub-aqua/api/v1/dump/new-legacy-csv-file
 * Snapshot blir teke av scripts/snapshot.sh. Rådata blir aldri endra —
 * denne modulen les det gzippa snapshotet og skriv til separate tabellar.
 *
 * Struktur: semikolon, UTF-8, tittellinje på linje 1, kolonnenamn på linje 2,
 * data frå linje 3. 34 kolonnar.
 *
 * FELLE (dokumentert i docs/API-FUNN-DEL2.md § 4): fila har éi rad per LØYVE,
 * ikkje per lokalitet. LOK_KAP er gjenteke på kvar løyve-rad — opptil 322 rader
 * for éin lokalitet. Naiv summering gir over 20x overteljing. Dedup på LOK_NR.
 */

import { createReadStream } from "node:fs";
import { createGunzip } from "node:zlib";
import { createInterface } from "node:readline";

export type LoyveRad = Record<string, string>;

export type Lokalitet = {
  lokalitetsnr: string;
  namn: string;
  kommunenr: string;
  kommune: string;
  fylkenr: string;
  fylke: string;
  /** PO 1-13. Berre ~74 % av radene har denne utfylt. */
  produksjonsomrade: number | null;
  lat: number | null;
  lon: number | null;
  /** Maksimalt tillaten biomasse. Eininga MÅ lagrast med — 2 061 rader er ikkje tonn. */
  kapasitet: number | null;
  kapasitetEining: string | null;
  plassering: string;
  vannmiljo: string;
  /** Alle artar det er løyve for på lokaliteten. */
  artar: string[];
  /** Alle innehavarar. 26,5 % av lokalitetane har fleire enn éin. */
  innehavarar: Innehavar[];
};

export type Innehavar = {
  /** null for privatpersonar (PNR). Desse skal filtrerast bort frå kommersielle lister. */
  orgnr: string | null;
  namn: string;
  adresse: string;
  postnr: string;
  poststad: string;
  erPrivatperson: boolean;
};

function tal(s: string | undefined): number | null {
  if (!s) return null;
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/** Organisasjonsnummer er 9 siffer. Alt anna er eit personnummer. */
function erOrgnr(s: string): boolean {
  return /^\d{9}$/.test(s.trim());
}

/** Les alle løyve-rader ut av det gzippa snapshotet. */
export async function lesLoyverader(sti: string): Promise<LoyveRad[]> {
  const linjer = createInterface({
    input: createReadStream(sti).pipe(createGunzip()),
    crlfDelay: Infinity,
  });

  let kolonner: string[] | null = null;
  const rader: LoyveRad[] = [];
  let nr = 0;

  for await (const linje of linjer) {
    nr++;
    if (nr === 1) continue; // «AKVAKULTURTILLATELSER PR. dd-mm-yyyy»
    if (nr === 2) {
      kolonner = linje.split(";").map((k) => k.trim());
      continue;
    }
    if (!linje.trim() || !kolonner) continue;
    const felt = linje.split(";");
    const rad: LoyveRad = {};
    for (let i = 0; i < kolonner.length; i++) {
      rad[kolonner[i] as string] = (felt[i] ?? "").trim();
    }
    rader.push(rad);
  }
  return rader;
}

/**
 * Slår løyve-rader saman til unike lokalitetar.
 *
 * Kastar om LOK_KAP sprikjer innanfor same lokalitet — då held ikkje
 * dedup-antakinga lenger, og det skal oppdagast med ein gong, ikkje
 * gøymast bak eit stille val av «siste rad vinn».
 */
export function tilLokalitetar(rader: LoyveRad[]): Lokalitet[] {
  const kart = new Map<string, Lokalitet>();
  const kapasitetSett = new Map<string, Set<string>>();

  for (const r of rader) {
    const nr = r["LOK_NR"];
    if (!nr) continue; // løyve utan lokalitet (t.d. reine tillatelser)

    const kapNokkel = `${r["LOK_KAP"] ?? ""}|${r["LOK_ENHET"] ?? ""}`;
    const sett = kapasitetSett.get(nr) ?? new Set<string>();
    sett.add(kapNokkel);
    kapasitetSett.set(nr, sett);

    let lok = kart.get(nr);
    if (lok) {
      // PROD_OMR er ikkje utfylt på alle rader for same lokalitet. Ta den
      // første ikkje-tomme vi ser, ikkje berre den frå raden som oppretta han.
      if (lok.produksjonsomrade === null) lok.produksjonsomrade = tal(r["PROD_OMR"]);
    }
    if (!lok) {
      lok = {
        lokalitetsnr: nr,
        namn: r["LOK_NAVN"] ?? "",
        kommunenr: r["LOK_KOMNR"] ?? "",
        kommune: r["LOK_KOM"] ?? "",
        fylkenr: r["LOK_FYLKENR"] ?? "",
        fylke: r["LOK_FYLKE"] ?? "",
        produksjonsomrade: tal(r["PROD_OMR"]),
        lat: tal(r["N_GEOWGS84"]),
        lon: tal(r["Ø_GEOWGS84"]),
        kapasitet: tal(r["LOK_KAP"]),
        kapasitetEining: r["LOK_ENHET"] || null,
        plassering: r["LOK_PLASS"] ?? "",
        vannmiljo: r["VANNMILJØ"] ?? "",
        artar: [],
        innehavarar: [],
      };
      kart.set(nr, lok);
    }

    const art = (r["ART"] ?? "").trim();
    if (art && !lok.artar.includes(art)) lok.artar.push(art);

    // 89 av 27 098 rader har tomt ORG.NR/PERS.NR. I CSV-en står det ingenting —
    // ikkje eit personnummer. Det er privatpersonar, identifiserte berre ved namn.
    // Dei skal med i modellen, men filtrerast bort frå kommersielle lister.
    const rawId = (r["ORG.NR/PERS.NR"] ?? "").trim();
    const namn = r["NAVN"] ?? "";
    const erPerson = !erOrgnr(rawId);
    const orgnr = erPerson ? null : rawId;
    const alt = lok.innehavarar.some((i) => i.orgnr === orgnr && i.namn === namn);
    if (!alt && (orgnr !== null || namn !== "")) {
      lok.innehavarar.push({
        orgnr,
        namn,
        adresse: r["ADRESSE"] ?? "",
        postnr: r["POSTNR"] ?? "",
        poststad: r["POSTSTED"] ?? "",
        erPrivatperson: erPerson,
      });
    }
  }

  const sprikande = [...kapasitetSett.entries()].filter(([, s]) => s.size > 1);
  if (sprikande.length > 0) {
    const doeme = sprikande
      .slice(0, 3)
      .map(([nr, s]) => `${nr}: ${[...s].join(" / ")}`)
      .join("; ");
    throw new Error(
      `${sprikande.length} lokalitetar har fleire ulike LOK_KAP-verdiar. ` +
        `Dedup-antakinga held ikkje lenger. Døme: ${doeme}`,
    );
  }

  return [...kart.values()];
}

/**
 * Namnet som kan visast offentleg for eit anlegg.
 *
 * Registeret har 43 privatpersonar som eig 50 lokalitetar. Å publisere namnet
 * deira i eit kommersielt produkt er ei anna sak juridisk enn å publisere eit
 * selskapsnamn. Vi vel difor eit selskap om det finst, og skriv elles berre at
 * eigaren er ein privatperson.
 */
export function offentlegEigar(l: Lokalitet): string | null {
  const selskap = l.innehavarar.find((i) => !i.erPrivatperson && i.orgnr);
  if (selskap) return selskap.namn;
  if (l.innehavarar.length) return "privat eigar";
  return null;
}
