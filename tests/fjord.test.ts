import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const sandbox: any = {};
runInNewContext(readFileSync(new URL('../app/fjord.js', import.meta.url), 'utf8'), sandbox);
const { summarize, suppliers, distance } = sandbox.OppdretterFjord;
const anchor = { n: 1, la: 60, lo: 5, lus: 9, gr: .5 };
const weeks = [{ aar: 2026, uke: 36 }, { aar: 2026, uke: 37 }];

test('fjord statistics exclude home site, non-salmon sites, missing values and distant sites', () => {
  const result = summarize([anchor,
    { n: 2, la: 60.01, lo: 5, lus: 0, gr: .5, hist: [null, 0] },
    { n: 3, la: 60.02, lo: 5, lus: .5, gr: .5, hist: [.7, .5] },
    { n: 4, la: 60.03, lo: 5, lus: null, gr: .5 },
    { n: 5, la: 60.04, lo: 5, lus: 5, lf: false },
    { n: 6, la: 65, lo: 5, lus: 3, gr: .5 },
  ], 1, 20, weeks);
  assert.equal(result.total, 3);
  assert.equal(result.reported, 2);
  assert.equal(result.mean, .25);
  assert.equal(result.over, 1);
  assert.equal(result.trend[0].mean, .7);
  assert.equal(result.trend[0].reported, 1);
  assert.equal(result.trend[1].reported, 2);
});

test('empty and invalid fjord observations stay unknown, and radius is geographic', () => {
  const result = summarize([anchor, { n: 2, la: 60.2, lo: 5, lus: NaN, hist: [-1, null] }], 1, 30, weeks);
  assert.equal(result.total, 1);
  assert.equal(result.mean, null);
  assert.equal(result.trend[0].mean, null);
  assert.equal(summarize([anchor], 99, 20, weeks), null);
  assert.equal(summarize([anchor], 1, -5, weeks), null);
  assert.equal(summarize([anchor, { n: 2, la: 60.2, lo: 5 }], 1, 20, weeks).total, 0);
  assert.equal(distance(anchor, { la: null, lo: 5 }), Infinity);
});

test('supplier matching uses declared county or national coverage, never presumed proximity', () => {
  const catalog = [
    { id: 'local', dekning: ['Vestland'], kategoriar: ['service'] },
    { id: 'national', dekning: ['Noreg'], kategoriar: ['not'] },
    { id: 'elsewhere', dekning: ['Nordland'], kategoriar: ['service'] },
  ];
  assert.equal(suppliers(catalog, 'VESTLAND').map(s => s.id).join(','), 'local,national');
  assert.equal(suppliers(catalog, 'Vestland', 'service').map(s => s.id).join(','), 'local');
  assert.equal(suppliers(catalog, null).map(s => s.id).join(','), 'national');
});
