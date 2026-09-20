import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { bwDato, bwStadium, normaliserBwSjukdom, parseBwLag, lesBwSjukdom } from "../src/ingest/bw-sjukdom.ts";
const ila = { lokalitetsnummer: 12345, sykdommer: "ILA", mistankedato: "2026-08-11T22:00:00Z", paavistdato: "2026-08-25T22:00:00Z", tomtdato: null, version: 0 };
const collection = (properties: Record<string, unknown>[]) => ({ type: "FeatureCollection", features: properties.map(p => ({ type: "Feature", properties: p })) });

test("BarentsWatch dates preserve Norwegian calendar day across summer and winter UTC offsets", () => {
  assert.equal(bwDato("2026-08-11T22:00:00Z"), "2026-08-12");
  assert.equal(bwDato("2025-12-11T23:00:00Z"), "2025-12-12");
  assert.equal(bwDato("2026-09-20Z"), "2026-09-20");
  assert.equal(bwDato(null), null);
  for (const invalid of ["bad", "2026-02-30", "2026-02-30T00:00:00Z", "2026-09-20T00:00:00", 1234]) assert.throws(() => bwDato(invalid));
});

test("emptied is separate from closed and a missing emptying date does not prove ongoing infection", () => {
  assert.equal(normaliserBwSjukdom(ila, "ILA")[0]!.status, "paavist");
  const tomt = normaliserBwSjukdom({ ...ila, tomtdato: "2026-09-01T22:00:00Z" }, "ILA")[0]!;
  assert.equal(tomt.status, "tomt");
  assert.equal(tomt.tomt, "2026-09-02");
  assert.equal("avslutta" in tomt, false);
  assert.equal("aktiv" in tomt, false);
  const udaterte = normaliserBwSjukdom({ lokalitetsnummer: 12345, sykdommer: "ILA" }, "ILA")[0]!;
  assert.equal(udaterte.status, "registrert");
  assert.equal(udaterte.paavist, null);
});

test("stage reflects the latest recorded event, not a fixed precedence hiding newer suspicion", () => {
  assert.equal(bwStadium("2026-09-20", "2026-01-01", "2026-02-01"), "mistanke");
  assert.equal(bwStadium("2026-01-01", "2026-09-20", "2026-02-01"), "paavist");
  assert.equal(bwStadium("2026-09-20", "2026-09-20", "2026-09-20"), "tomt");
  assert.equal(bwStadium(null, null, null), "registrert");
});

test("PD subtype dates stay separate and raw labels never imply a diagnosis date", () => {
  const p = { lokalitetsnummer: 12345, sykdommer: "PD SAV2, PD SAV3", pd_sav2_mistankedato: "2026-09-01Z", pd_sav3_paavistdato: "2026-09-05Z" };
  const r = normaliserBwSjukdom(p, "PD");
  assert.equal(r.length, 2);
  assert.equal(r.find(x => x.subtype === "SAV2")!.status, "mistanke");
  assert.equal(r.find(x => x.subtype === "SAV3")!.status, "paavist");
  assert.equal(r.find(x => x.subtype === "SAV2")!.paavist, null);
  const utanDato = normaliserBwSjukdom({ lokalitetsnummer: 12345, sykdommer: "PD SAV3" }, "PD");
  assert.equal(utanDato[0]!.subtype, "SAV3");
  assert.equal(utanDato[0]!.status, "registrert");
});

test("duplicate WFS rows collapse, higher source revision replaces an older diagnosis", () => {
  const r = parseBwLag(collection([ila, ila, { ...ila, version: 1, paavistdato: null }]), "ILA");
  assert.equal(r.rader.length, 1);
  assert.equal(r.rader[0]!.status, "mistanke");
  assert.equal(r.rader[0]!.paavist, null);
});

test("malformed or truncated WFS records are marked incomplete while valid records survive", () => {
  const r = parseBwLag({ ...collection([ila, { ...ila, lokalitetsnummer: 0 }, { ...ila, tomtdato: "bad" }]), numberMatched: 4 }, "ILA");
  assert.equal(r.rader.length, 1);
  assert.equal(r.ugyldige, 3);
  assert.throws(() => parseBwLag({ features: [] }, "ILA"));
});

test("an absent PD file is an explicit partial outage; valid ILA and successful empty selections survive", t => {
  const dir = mkdtempSync(join(tmpdir(), "oppdretter-bw-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  writeFileSync(join(dir, "wfs-localitywithila.geojson.gz"), gzipSync(JSON.stringify(collection([ila]))));
  const a = lesBwSjukdom(dir, "2026-09-20T00:00:00Z");
  assert.equal(a.kjelder.bwPd.status, "feila");
  assert.equal(a.kjelder.bwIla.status, "ok");
  assert.equal(a.kjelder.bwSjukdom.status, "delvis");
  assert.equal(a.perLokalitet.get(12345)!.length, 1);
  assert.equal(a.perLokalitet.has(99999), false);
  writeFileSync(join(dir, "wfs-localitywithpd.geojson.gz"), gzipSync(JSON.stringify(collection([]))));
  const b = lesBwSjukdom(dir, "2026-09-20T00:00:00Z");
  assert.equal(b.kjelder.bwPd.status, "ok");
  assert.equal(b.kjelder.bwPd.tal, 0);
  assert.equal(b.kjelder.bwSjukdom.status, "ok");
});
