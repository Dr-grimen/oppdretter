import test from "node:test";
import assert from "node:assert/strict";
import { kollapsRapportar, hentVeke, mattilsynetApi, rapportDetalj, type Luserapport } from "../src/ingest/mattilsynet.ts";
import { sisteRapportveke, forrige, aisTidIso } from "../src/lib/tid.ts";
import { valfriKjelde } from "../src/lib/kjeldestatus.ts";
import { parseAis, finnVedAnlegg, hentSkipsinfoMedStatus, type AisPosisjon } from "../src/ingest/ais.ts";
import { finnOverGrensa, finnBehandling, finnKlynger, finnLuseauke } from "../src/events/hendingar.ts";
import { lusegrense, erOverGrensa } from "../src/events/lusegrense.ts";
import { sisteRensefisk, rensefiskDetalj, type RensefiskRapport } from "../src/ingest/rensefisk.ts";
import type { Lokalitet } from "../src/ingest/akvakulturregister.ts";

const rapport = (endre: Partial<Luserapport> = {}): Luserapport => ({
  id: "før", lokalitetsnummer: 11492, lokalitetsnavn: "Testanlegg", organisasjonsnummer: null,
  organisasjonsnavn: null, år: 2026, uke: 37, rapporteringstidspunkt: "2026-09-15T12:00:00Z",
  sjøtemperatur: 11, lusetelling: { voksneHunnlus: 0.7, bevegeligeLus: 0.3, fastsittendeLus: 0 },
  ikkeMedikamentelleBehandlinger: [{ type: "TERMISK_BEHANDLING", antallMerder: 2 }],
  medikamentelleBehandlinger: [], kombinasjonsbehandlinger: [], resistensmistanker: [], ...endre,
});
const lok = { lokalitetsnr: "11492", namn: "Testanlegg", fylkenr: "46", fylke: "Vestland",
  produksjonsomrade: 3, lat: 60, lon: 5, innehavarar: [] } as unknown as Lokalitet;
const ctx = { lok: new Map([[11492, lok]]) };

test("newest corrected report governs latest value, treatment, thresholds and clusters regardless of input order", () => {
  const gammel = rapport();
  const ny = rapport({ id: "etter", rapporteringstidspunkt: "2026-09-16T12:00:00Z",
    lusetelling: { voksneHunnlus: 0.1, bevegeligeLus: 0, fastsittendeLus: 0.2 }, ikkeMedikamentelleBehandlinger: [] });
  for (const data of [[ny, gammel], [gammel, ny, gammel]]) {
    const r = kollapsRapportar(data);
    assert.equal(r.length, 1);
    assert.equal(r[0]!.lusetelling!.voksneHunnlus, 0.1);
    assert.deepEqual(finnOverGrensa(r, ctx), []);
    assert.deepEqual(finnBehandling(r, ctx), []);
    assert.deepEqual(finnKlynger(r, ctx), []);
    assert.equal(rapportDetalj(r[0]!).bevegelege, 0);
  }
});

test("a correction without lice clears old lice rather than keeping an obsolete reassuring number", () => {
  const r = kollapsRapportar([rapport(), rapport({ id: "new", rapporteringstidspunkt: "2026-09-16T12:00:00Z", lusetelling: null })]);
  assert.equal(r[0]!.lusetelling, null);
  assert.equal(rapportDetalj(r[0]!).bevegelege, null);
});

test("invalid weeks, timestamps and nonfinite/negative counts never become observations", () => {
  assert.equal(kollapsRapportar([rapport({ år: 2025, uke: 53 }), rapport({ rapporteringstidspunkt: "invalid" }), rapport({ lokalitetsnummer: NaN })]).length, 0);
  const r = kollapsRapportar([rapport({ sjøtemperatur: -0.5, lusetelling: { voksneHunnlus: NaN, bevegeligeLus: -1, fastsittendeLus: Infinity } })])[0]!;
  assert.deepEqual(r.lusetelling, { voksneHunnlus: null, bevegeligeLus: null, fastsittendeLus: null });
  assert.equal(rapportDetalj(r).temperatur, -0.5);
});

test("report deadline follows Oslo midnight during both daylight saving and winter time", () => {
  assert.deepEqual(sisteRapportveke(new Date("2026-09-15T21:59:59Z")), { aar: 2026, uke: 36, forbiFrist: false });
  assert.deepEqual(sisteRapportveke(new Date("2026-09-15T22:00:00Z")), { aar: 2026, uke: 37, forbiFrist: true });
  assert.deepEqual(sisteRapportveke(new Date("2027-01-05T22:59:59Z")), { aar: 2026, uke: 52, forbiFrist: false });
  assert.deepEqual(sisteRapportveke(new Date("2027-01-05T23:00:00Z")), { aar: 2026, uke: 53, forbiFrist: true });
  assert.deepEqual(forrige(2027, 1, 1), { aar: 2026, uke: 53 });
});

test("report queries retain previous-year weeks corrected in January", async (t) => {
  t.mock.method(globalThis, "fetch", async (url: string) => {
    assert.equal(new URL(url).searchParams.has("aar"), false);
    return new Response(JSON.stringify([
      rapport({ år: 2026, uke: 53, rapporteringstidspunkt: "2027-01-06T12:00:00Z" }),
      rapport({ år: 2020, uke: 53, rapporteringstidspunkt: "2021-01-05T12:00:00Z" }),
    ]), { headers: { "x-count": "2" } });
  });
  const r = await hentVeke(2026, 53);
  assert.equal(r.rapportar.length, 1);
  assert.equal(r.rapportar[0]!.år, 2026);
});

test("Mattilsynet paginates and rejects a broken repeat instead of silently truncating data", async (t) => {
  const offsets: string[] = [];
  t.mock.method(globalThis, "fetch", async (url: string) => {
    const off = new URL(url).searchParams.get("offset")!;
    offsets.push(off);
    return new Response(JSON.stringify(off === "0" ? [{ id: 1 }, { id: 2 }] : [{ id: 3 }]), { headers: { "x-count": "3" } });
  });
  assert.equal((await mattilsynetApi("/test", { limit: 2 })).data.length, 3);
  assert.deepEqual(offsets, ["0", "2"]);
  t.mock.restoreAll();
  t.mock.method(globalThis, "fetch", async () => new Response('[{"id":1},{"id":2}]', { headers: { "x-count": "4" } }));
  await assert.rejects(() => mattilsynetApi("/test", { limit: 2 }), /gjentok/);
});

test("a source outage and a successful empty source have different public status", async () => {
  const empty = await valfriKjelde(async () => []);
  const failed = await valfriKjelde(async () => { throw new Error("private URL or credential"); });
  assert.equal(empty.status.status, "ok");
  assert.equal(failed.status.status, "feila");
  assert.equal(failed.status.tal, 0);
  assert.ok(!JSON.stringify(failed).includes("credential"));
});

const feature = (p: Record<string, unknown> = {}, coordinates = [5, 60]) => ({
  geometry: { type: "Point", coordinates },
  properties: { mmsi: 257123456, date_time_utc: "2026-09-20T12:00:00", speed: 1, cog: 10, ...p },
});
test("AIS validates GeoJSON, coordinates, IDs, sentinels, duplicate positions and timezone", () => {
  assert.throws(() => parseAis({ success: false }), /success=false/);
  assert.throws(() => parseAis({}), /GeoJSON/);
  assert.deepEqual(parseAis({ type: "FeatureCollection", features: [] }), []);
  const r = parseAis({ type: "FeatureCollection", features: [
    feature({ date_time_utc: "2026-09-20T11:59:00", speed: 1 }),
    feature({ speed: 102.3, cog: 360 }), feature({ mmsi: 257123457 }, [5, 91]),
    feature({ mmsi: "invalid" }),
  ] });
  assert.equal(r.length, 1);
  assert.equal(r[0]!.tid, "2026-09-20T12:00:00.000Z");
  assert.equal(r[0]!.fart, null);
  assert.equal(r[0]!.kurs, null);
  assert.equal(aisTidIso("2026-09-20T14:00:00+02:00"), "2026-09-20T12:00:00.000Z");
});

test("nearby association requires a fresh, known low speed and chooses nearest locality", () => {
  const p = parseAis({ type: "FeatureCollection", features: [feature()] })[0]!;
  const anlegg = [{ nr: 1, namn: "Lenger unna", lat: 60.002, lon: 5 }, { nr: 2, namn: "Nærast", lat: 60, lon: 5 }];
  const no = new Date("2026-09-20T12:10:00Z");
  const sjekk = (endre: Partial<AisPosisjon>) => finnVedAnlegg([{ ...p, ...endre }], anlegg, 500, 2, no);
  assert.equal(sjekk({})[0]!.lokalitetsnr, 2);
  for (const fart of [null, NaN, -1, 2.1]) assert.equal(sjekk({ fart }).length, 0);
  for (const tid of ["bad", "2026-09-20T11:30:00Z", "2026-09-20T12:20:00Z"]) assert.equal(sjekk({ tid }).length, 0);
});

test("partial ship metadata failure preserves successful batches and reports missing batches", async (t) => {
  let kall = 0;
  t.mock.method(globalThis, "fetch", async () => {
    kall++;
    return kall === 1 ? new Response('{"success":true,"data":[{"mmsi":257123456,"shiptypelevel5":"Fish Carrier"}]}') : new Response('{"success":false}');
  });
  const r = await hentSkipsinfoMedStatus(Array.from({ length: 251 }, (_, i) => 257123456 + i));
  assert.equal(r.info.size, 1);
  assert.equal(r.feilaBolkar, 1);
  assert.equal(r.bolkar, 2);
});

test("trend duration correctly spans a 53-week year", () => {
  const serie = new Map([[11492, [{ aar: 2026, uke: 52, lus: 0.1 }, { aar: 2026, uke: 53, lus: 0.2 }, { aar: 2027, uke: 1, lus: 0.3 }]]]);
  assert.match(finnLuseauke(serie, ctx, 2027, 1)[0]!.detalj, /over tre veker/);
});

test("cleaner fish uses latest period, retains unknown removals, and labels previous-month inventory", () => {
  const r: RensefiskRapport = { id: "a", lokalitetsnummer: 1, år: 2026, måned: 8, rapporteringstidspunkt: "2026-09-01T00:00:00Z",
    produksjonsenheter: [{ merdId: "1", arter: [{ artskode: "LUM", artsnavn: "Rognkjeks", beholdningVedForrigeMånedsslutt: 100, utsett: null, uttak: null }] }] };
  const korrigertEldre = { ...r, id: "b", måned: 7, rapporteringstidspunkt: "2026-09-20T00:00:00Z" };
  const siste = sisteRensefisk([r, korrigertEldre]).get(1)!;
  assert.equal(siste.måned, 8);
  const d = rensefiskDetalj(siste);
  assert.equal(d.behaldningForrigeManad, 100);
  assert.equal(d.selvdode, null);
  assert.equal(d.avliva, null);
  assert.equal(d.utsettNye, null);
  assert.deepEqual(d.artar, ["Rognkjeks"]);
});

test("corrections differing within one millisecond keep their true nanosecond order", () => {
  const r = kollapsRapportar([
    rapport({ id: "first", rapporteringstidspunkt: "2026-09-15T12:00:00.123Z" }),
    rapport({ id: "last", rapporteringstidspunkt: "2026-09-15T12:00:00.123000001Z" }),
  ]);
  assert.equal(r[0]!.id, "last");
});

test("AIS LineString position is the latest (last) point, paired with the latest timestamp", () => {
  const r = parseAis({ type: "FeatureCollection", features: [{
    geometry: { type: "LineString", coordinates: [[5, 60], [5.02, 60.01], [5.03, 60.02]] },
    properties: feature().properties,
  }] });
  assert.equal(r[0]!.lon, 5.03);
  assert.equal(r[0]!.lat, 60.02);
});

test("general lice thresholds include equality in both regions and at season boundaries", () => {
  for (const fylke of ["46", "18"]) {
    for (const uke of [15, 16, 20, 21, 22, 26, 27]) {
      const g = lusegrense(fylke, 2026, uke);
      assert.equal(erOverGrensa(g.verdi, g), true);
      assert.equal(erOverGrensa(g.verdi - 0.01, g), false);
      assert.equal(erOverGrensa(g.verdi + 0.01, g), true);
      assert.equal(erOverGrensa(NaN, g), false);
    }
  }
  assert.equal(lusegrense("46", 2026, 21).verdi, 0.2);
  assert.equal(lusegrense("46", 2026, 22).verdi, 0.5);
  assert.equal(lusegrense("18", 2026, 21).verdi, 0.2);
  assert.equal(lusegrense("18", 2026, 27).verdi, 0.5);
  assert.equal(erOverGrensa(1, lusegrense("18", 2016, 20)), false);
});

test("empty strings and booleans in AIS measurements remain unknown rather than zero speed", () => {
  for (const speed of ["", " ", false, true]) {
    const r = parseAis({ type: "FeatureCollection", features: [feature({ speed, cog: speed })] });
    assert.equal(r[0]!.fart, null);
    assert.equal(r[0]!.kurs, null);
  }
});
