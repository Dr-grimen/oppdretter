import test from "node:test";
import assert from "node:assert/strict";
import { soneErAktiv, gyldigSoneGeometri, sonerGeo } from "../src/ingest/soner.ts";
import { lagBoks } from "../src/lib/geo.ts";

test("zones exclude future starts and expired dates while keeping a future end date", () => {
  const no = new Date("2026-09-20T12:00:00Z");
  assert.equal(soneErAktiv({ fromdate: "2026-09-20Z", todate: null }, no), true);
  assert.equal(soneErAktiv({ fromdate: "2026-09-21Z", todate: null }, no), false);
  assert.equal(soneErAktiv({ fromdate: null, todate: "2026-09-21Z" }, no), true);
  assert.equal(soneErAktiv({ fromdate: "2026-01-01Z", todate: "2026-09-20Z" }, no), false);
  assert.throws(() => soneErAktiv({ fromdate: "invalid" }, no), /sonedato/);
  assert.throws(() => soneErAktiv({ fromdate: "2026-02-30Z" }, no), /sonedato/);
});

test("display zones preserve valid original WGS84 rings, names, dates and statute links", () => {
  const geometry = { type: "Polygon", coordinates: [[[5, 60], [6, 60], [6, 61], [5, 60]]] };
  assert.equal(gyldigSoneGeometri(geometry), true);
  assert.equal(gyldigSoneGeometri({ ...geometry, coordinates: [[[5, 60], [6, 60], [6, 61], [5, 59]]] }), false);
  assert.equal(gyldigSoneGeometri({ type: "Point", coordinates: [5, 60] }), false);
  assert.equal(gyldigSoneGeometri({ type: "Polygon", coordinates: [[[5, 600], [6, 600], [6, 610], [5, 600]]] }), false);
  const zones = sonerGeo([lagBoks({ type: "ILA-bekjempelse", forskrift: "FOR-2026-01-01-1", frå: "2026-01-01", til: null, namn: "Test", lenkje: null }, geometry)]);
  assert.deepEqual(zones[0]!.geometry, geometry);
  assert.equal(zones[0]!.fra, "2026-01-01");
});

test("zone timestamp starts are interpreted on the Norwegian date", () => {
  assert.equal(soneErAktiv({ fromdate: "2026-09-20T22:00:00Z", todate: null }, new Date("2026-09-20T12:00:00Z")), false);
});
