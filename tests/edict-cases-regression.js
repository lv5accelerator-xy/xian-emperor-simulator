"use strict";
const assert = require("node:assert/strict");
const fixture = require("./fixtures/edict-cases.json");
const { harness, plain } = require("./helpers/game-harness");
const { observe, differences } = require("./helpers/edict-observation");
const h = harness(); h.loadMechanics();
h.api.startNewGame(fixture.context.difficulty, fixture.context.scenario, { randomSeed: fixture.context.seed }); h.flush();
assert.ok(fixture.cases.length >= 40);
assert.equal(new Set(fixture.cases.map(row => row.id)).size, fixture.cases.length);
for (const group of ["否定与语境", "多目标与多政务", "城池顺序"]) assert.ok(fixture.cases.some(row => row.group === group));
const before = plain(h.api.getState());
for (const row of fixture.cases) {
  const actual = observe(h, row.text);
  assert.deepEqual(actual, row.observed, `${row.id}: current behavior changed; review the snapshot rather than silently rewriting it`);
  assert.deepEqual(differences(actual, row.desired), row.differences, `${row.id}: known semantic mismatch classification`);
}
assert.deepEqual(plain(h.api.getState()), before, "observing parsing and preview must not execute any order or consume RNG");
console.log(`${fixture.cases.length} edict behavior snapshots passed; ${fixture.cases.filter(row => row.differences.length).length} known semantic mismatches recorded, parser unchanged.`);
