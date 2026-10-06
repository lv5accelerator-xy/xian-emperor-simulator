"use strict";
const assert = require("node:assert/strict");
const { harness, plain } = require("./helpers/game-harness");
const run = harness(); run.loadMechanics();
const definition = run.window.XianWeeklyChallenge.buildDefinition(run.window.XianWeeklyChallenge.codeForWeek("2026W41"));
function play(choiceIndex, act) {
  assert.equal(run.window.XianShortChallenges.startCustom(definition), true); run.flush();
  while (!run.api.getState().ended) {
    run.decide(choiceIndex); run.flush();
    if (run.api.getState().ended) break;
    if (act) { assert.equal(run.act("audience", { "modal-character-select": "xun_yu", "audience-mode": "public" }), true); run.flush(); }
    run.node("end-turn-btn").click(); run.node("modal-confirm").click(); run.flush();
  }
  return plain(run.window.XianShortChallenges.getState().results[0]);
}
const first = play(0, false);
assert.equal(run.window.XianShortChallenges.getComparison(first).available, false);
const second = play(1, true);
assert.equal(second.comparisonIdentity.key, first.comparisonIdentity.key);
const before = plain(run.api.getState()), stores = run.stores();
const comparison = plain(run.window.XianShortChallenges.getComparison(second));
assert.equal(comparison.available, true);
assert.equal(comparison.previousScore, first.score); assert.equal(comparison.currentScore, second.score);
assert.equal(comparison.effort.actions.previous, 0);
assert.ok(comparison.effort.actions.current > 0);
assert.ok(comparison.choiceDifferences.length > 0);
for (const row of comparison.goals) {
  assert.equal(row.previous, first.checks.find(item => item.path === row.path).value);
  assert.equal(row.current, second.checks.find(item => item.path === row.path).value);
  assert.equal(row.delta, row.current - row.previous);
}
assert.match(run.node("short-ending-review").innerHTML, /与上次同题比较/);
assert.match(run.window.XianShortChallenges.formatReviewText(run.api.getState()), /同题两局对比/);
assert.deepEqual(plain(run.api.getState()), before); assert.deepEqual(run.stores(), stores);
const reload = harness(stores); reload.node("continue-game-btn").click();
assert.deepEqual(plain(reload.window.XianShortChallenges.getComparison(reload.window.XianShortChallenges.getState().results[0])), comparison);
const imported = harness();
const envelope = { format: "xian-emperor-full-save", stores: Object.fromEntries(Object.entries(stores).map(([key, value]) => [key, JSON.parse(value)])) };
imported.node("import-file").dispatchEvent({ type: "change", target: { value: "full.json", files: [{ text: JSON.stringify(envelope) }] } });
const continued = harness(imported.stores()); continued.node("continue-game-btn").click();
assert.equal(continued.window.XianShortChallenges.getComparison(continued.window.XianShortChallenges.getState().results[0]).available, true);

// Code, seed, rule, difficulty/opening configuration and old metadata all gate comparison.
for (const change of [
  item => { item.comparisonIdentity.code = "XIAN-2026W40-ABCDE"; },
  item => { item.randomSeed += 1; item.comparisonIdentity.seed = item.randomSeed; },
  item => { item.rulesVersion = 215; item.comparisonIdentity.rulesVersion = 215; },
  item => { item.comparisonIdentity.key += "different-opening"; },
  item => { delete item.comparisonIdentity; },
]) {
  const other = plain(first); change(other);
  assert.equal(run.window.XianSameChallenge.compare(second, other).available, false);
}
assert.equal(run.window.XianSameChallenge.compare(second, second).available, false);
const unrelated = plain(first); unrelated.gameCreatedAt += "-other"; unrelated.comparisonIdentity.key += "other";
const legacy = plain(first); legacy.gameCreatedAt += "-legacy"; delete legacy.comparisonIdentity;
assert.equal(run.window.XianSameChallenge.findPrevious(second, [second, unrelated, legacy, first]).previousScore, first.score);
const noEffort = plain(first); delete noEffort.review.effort; delete noEffort.review.choices;
const limited = run.window.XianSameChallenge.compare(second, noEffort);
assert.equal(limited.effort.actions.previous, null); assert.equal(limited.choicesComplete, false);
assert.match(run.window.XianSameChallenge.html(limited), /未记录/);
const unsafe = plain(comparison); unsafe.code = "<img src=x>"; unsafe.goals[0].label = "<script>bad()</script>";
unsafe.choiceDifferences[0].previous = ["<svg onload=bad()>"];
assert.doesNotMatch(run.window.XianSameChallenge.html(unsafe), /<img|<script>|<svg/);
const seedZero = plain(before); seedZero.random.seed = 0;
assert.equal(run.window.XianSameChallenge.identity(definition, seedZero).seed, 0);
const differentDifficulty = { ...definition, difficulty: "crisis" };
assert.notEqual(run.window.XianSameChallenge.identity(differentDifficulty, before).key, second.comparisonIdentity.key);
console.log("Same challenge passed: two actual seeded runs, goals/costs/choices, strict pairing, read-only views, reload, full import, old data and escaping.");
