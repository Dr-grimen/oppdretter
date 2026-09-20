import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { parseIla10km, lesIla10km, ila10kmTreff } from "../src/ingest/ila10km.ts";
const geometry = { type: "Polygon", coordinates: [[[5, 60], [6, 60], [6, 61], [5, 61], [5, 60]]] };
const feature = { type: "Feature", properties: { id: 1, localityno: 24695, name: "Test", year: 2026, week: 38 }, geometry };
const collection = { type: "FeatureCollection", features: [feature], numberMatched: 1 };

test("ILA rings preserve their own week and original source geometry; site membership is just geometric", () => {
  const { ringar, ugyldige } = parseIla10km(collection);
  assert.equal(ugyldige, 0);
  assert.equal(ringar[0]!.aar, 2026);
  assert.equal(ringar[0]!.uke, 38);
  assert.equal(ringar[0]!.nr, 24695);
  assert.deepEqual(ringar[0]!.geometry, geometry);
  assert.deepEqual(ila10kmTreff(5.5, 60.5, ringar), ["1"]);
  assert.deepEqual(ila10kmTreff(6.5, 60.5, ringar), []);
  assert.equal("sykdom" in ringar[0]!, false);
  assert.equal("forskrift" in ringar[0]!, false);
});

test("invalid ISO weeks, missing polygons and truncated ring collections cannot be marked complete", () => {
  const bad = { ...feature, properties: { ...feature.properties, year: 2025, week: 53 } };
  const r = parseIla10km({ ...collection, features: [feature, bad], numberMatched: 3 });
  assert.equal(r.ringar.length, 1);
  assert.equal(r.ugyldige, 2);
  assert.throws(() => parseIla10km({ error: "upstream failed" }));
});

test("a missing ring file is a source outage; older week is explicitly partial; successful zero is valid", t => {
  const dir = mkdtempSync(join(tmpdir(), "oppdretter-ila-ring-"));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const no = new Date("2026-09-20T12:00:00Z"), tid = "2026-09-20T00:00:00Z";
  assert.equal(lesIla10km(dir, tid, no).status.status, "feila");
  const path = join(dir, "wfs-isa10kmcircle.geojson.gz");
  writeFileSync(path, gzipSync(JSON.stringify(collection)));
  assert.equal(lesIla10km(dir, tid, no).status.status, "ok");
  assert.equal(lesIla10km(dir, tid, new Date("2026-09-21T12:00:00Z")).status.status, "delvis");
  writeFileSync(path, gzipSync(JSON.stringify({ type: "FeatureCollection", features: [], numberMatched: 0 })));
  const empty = lesIla10km(dir, tid, no);
  assert.equal(empty.status.status, "ok");
  assert.equal(empty.ringar.length, 0);
});
