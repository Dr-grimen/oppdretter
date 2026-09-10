/**
 * Fase 0, den opne halvdelen: ekte data på skjermen UTAN nøkkel.
 *
 * Køyr:  npm run fase0:opent
 *
 * Kjelder (alle NLOD):
 *  - geo.barentswatch.no  — ILA/PD-soner, WFS, EPSG:4326
 *  - gis.fiskeridir.no    — produksjonsområde 1–13
 *  - www.barentswatch.no  — fiskehelse (skal svare 401 utan token)
 */

import { hent, hentJson } from "./lib/http.ts";

const WFS = "https://geo.barentswatch.no/geoserver/ows";

type Feature = {
  geometry: { type: string; coordinates: unknown } | null;
  properties: Record<string, unknown>;
};
type FeatureCollection = {
  type: string;
  features: Feature[];
  crs?: { properties?: { name?: string } };
  numberReturned?: number;
};

function wfsUrl(lag: string, cqlFilter?: string): string {
  const p = new URLSearchParams({
    service: "WFS",
    version: "2.0.0",
    request: "GetFeature",
    typeNames: lag,
    outputFormat: "application/json",
  });
  // Eitt lag per kall. Fleire lag i typeNames tolkast som JOIN og gir HTTP 500.
  if (cqlFilter) p.set("CQL_FILTER", cqlFilter);
  return `${WFS}?${p.toString()}`;
}

function overskrift(t: string): void {
  console.log(`\n${"─".repeat(72)}\n${t}\n${"─".repeat(72)}`);
}

async function sjekkSoner(): Promise<void> {
  overskrift("1. ILA- og PD-soner frå geo.barentswatch.no (WFS, ingen nøkkel)");

  const lag = [
    "bw:ilaprotectionzone",
    "bw:ilasurveillancezone",
    "bw:pdprotectionzone",
    "bw:pdsurveillancezone",
    "bw:localitywithila",
    "bw:localitywithpd",
  ];

  for (const l of lag) {
    try {
      const fc = await hentJson<FeatureCollection>(wfsUrl(l));
      const crs = fc.crs?.properties?.name ?? "(ikkje oppgitt)";
      const geomtypar = [...new Set(fc.features.map((f) => f.geometry?.type ?? "null"))];
      console.log(
        `  ${l.padEnd(28)} ${String(fc.features.length).padStart(4)} objekt  ${geomtypar.join("/")}  ${crs}`,
      );
    } catch (e) {
      console.log(`  ${l.padEnd(28)} FEIL: ${(e as Error).message.slice(0, 80)}`);
    }
  }

  // Aktive ILA-bekjempelsessoner: todate er tom.
  const aktive = await hentJson<FeatureCollection>(
    wfsUrl("bw:ilaprotectionzone", "todate IS NULL"),
  );
  console.log(`\n  Aktive ILA-bekjempelsessoner no: ${aktive.features.length}`);
  for (const f of aktive.features.slice(0, 5)) {
    const p = f.properties;
    console.log(
      `    id ${String(p["id"]).padStart(4)}  ${String(p["forsknr"] ?? "").padEnd(22)} frå ${String(p["fromdate"] ?? "").slice(0, 10)}`,
    );
  }
}

async function sjekkProduksjonsomrade(): Promise<void> {
  overskrift("2. Produksjonsområde 1–13 frå Fiskeridirektoratet (ingen nøkkel)");

  const url =
    "https://gis.fiskeridir.no/server/rest/services/Yggdrasil/" +
    "Produksjonsomr%C3%A5der/FeatureServer/0/query" +
    "?where=1%3D1&outFields=id,name,status&returnGeometry=false&f=json";

  const svar = await hentJson<{ features: { attributes: Record<string, unknown> }[] }>(url);
  console.log(`  ${svar.features.length} produksjonsområde\n`);
  const rader = svar.features
    .map((f) => f.attributes)
    .sort((a, b) => Number(a["id"]) - Number(b["id"]));
  for (const r of rader) {
    console.log(
      `    PO ${String(r["id"]).padStart(2)}  ${String(r["name"]).padEnd(32)} trafikklys: ${r["status"]}`,
    );
  }
}

async function sjekkAtLuseDataKrevNokkel(): Promise<void> {
  overskrift("3. Lusedata utan token — skal gi 401");

  const url = "https://www.barentswatch.no/bwapi/v1/geodata/fishhealth/localities";
  const { status, tekst } = await hent(url);
  const forventa = status === 401;
  console.log(`  GET ${url}`);
  console.log(`  → HTTP ${status} ${forventa ? "(som venta — lusedata krev nøkkel)" : "(UVENTA!)"}`);
  if (tekst.trim()) console.log(`  kropp: ${tekst.slice(0, 120)}`);
}

async function sjekkSpesifikasjon(): Promise<void> {
  overskrift("4. OpenAPI-spesifikasjonen (open, ingen nøkkel)");

  const url = "https://www.barentswatch.no/bwapi/openapi/fishhealth/openapi.json";
  const spec = await hentJson<{
    openapi: string;
    info: { title: string; version: string };
    paths: Record<string, Record<string, unknown>>;
    components: { schemas: Record<string, unknown> };
  }>(url);

  const stiar = Object.keys(spec.paths);
  const operasjonar = stiar.flatMap((s) => Object.keys(spec.paths[s] ?? {}));
  console.log(`  ${spec.info.title} v${spec.info.version} (openapi ${spec.openapi})`);
  console.log(`  ${stiar.length} stiar, ${operasjonar.length} operasjonar, ${Object.keys(spec.components.schemas).length} skjema`);

  const fartoy = stiar.filter((s) => /vessel/i.test(s));
  console.log(`\n  Fartøy-endepunkt (${fartoy.length}) — BarentsWatch reknar allereie ut besøk:`);
  for (const s of fartoy) console.log(`    ${s}`);
}

async function main(): Promise<void> {
  console.log("oppdretter — fase 0, open del (ingen nøkkel kravd)");
  console.log("Data: Mattilsynet, Veterinærinstituttet og Fiskeridirektoratet,");
  console.log("formidla via BarentsWatch. Lisens NLOD.");

  await sjekkSoner();
  await sjekkProduksjonsomrade();
  await sjekkAtLuseDataKrevNokkel();
  await sjekkSpesifikasjon();

  overskrift("Ferdig");
  console.log("  Neste steg krev nøkkel. Sjå README.md.");
}

await main();
