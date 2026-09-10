/**
 * Fyller ut produksjonsområde der registeret manglar det.
 *
 * Berre 963 av 1 777 lokalitetar (54 %) har PROD_OMR utfylt i Akvakulturregisteret.
 * (Kartlegginga sitt tal på 74 % var per løyve-rad, ikkje per lokalitet.)
 * Resten reknar vi ut frå koordinatane mot Fiskeridirektoratet sine PO-polygon.
 *
 * Der begge finst, samanliknar vi — avvik tyder på at éi av kjeldene tek feil,
 * og det vil vi vite om.
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { lagBoks, finnFoerste, type Geometri, type MedBoks } from "../lib/geo.ts";
import type { Lokalitet } from "./akvakulturregister.ts";

export type PO = { id: number; namn: string; status: string };

export function lesProduksjonsomrade(sti: string): MedBoks<PO>[] {
  const rå = JSON.parse(gunzipSync(readFileSync(sti)).toString("utf8")) as {
    features: { properties: Record<string, unknown>; geometry: Geometri }[];
  };
  return rå.features
    .map((f) =>
      lagBoks<PO>(
        {
          id: Number(f.properties["id"]),
          namn: String(f.properties["name"] ?? ""),
          status: String(f.properties["status"] ?? ""),
        },
        f.geometry,
      ),
    )
    .sort((a, b) => a.verdi.id - b.verdi.id);
}

export type PoResultat = {
  fyltUt: number;
  alleredeSatt: number;
  einige: number;
  usamde: { lokalitetsnr: string; register: number; geometri: number }[];
  utanTreff: string[];
};

/** Muterer lokalitetane: set produksjonsomrade der det mangla. */
export function fyllProduksjonsomrade(
  lokalitetar: Lokalitet[],
  po: MedBoks<PO>[],
): PoResultat {
  const res: PoResultat = { fyltUt: 0, alleredeSatt: 0, einige: 0, usamde: [], utanTreff: [] };

  for (const l of lokalitetar) {
    if (l.lat === null || l.lon === null) continue;
    const treff = finnFoerste(l.lon, l.lat, po);

    if (l.produksjonsomrade !== null) {
      res.alleredeSatt++;
      if (treff && treff.id === l.produksjonsomrade) res.einige++;
      else if (treff) {
        res.usamde.push({
          lokalitetsnr: l.lokalitetsnr,
          register: l.produksjonsomrade,
          geometri: treff.id,
        });
      }
      continue;
    }

    if (treff) {
      l.produksjonsomrade = treff.id;
      res.fyltUt++;
    } else {
      res.utanTreff.push(l.lokalitetsnr);
    }
  }
  return res;
}
