"use strict";
const assert = require("node:assert/strict");
const { harness, plain } = require("./helpers/game-harness");

const run = harness(); run.load("command-center");
run.window.XianShortChallenges.start("xudu_mutiny");
assert.equal(run.window.XianCommandCenter.compareActions(run.api.getState()).available, false);
run.decide(1);
const before = plain(run.api.getState()), stores = run.stores();
const comparison = plain(run.window.XianCommandCenter.compareActions(before));
assert.equal(comparison.available, true);
assert.deepEqual(plain(run.api.getState()), before); assert.deepEqual(run.stores(), stores);
const recommendation = run.window.XianCommandCenter.recommendAction(before);
assert.deepEqual(comparison.choices.find(item => item.recommended).fields, plain(recommendation.fields));
assert.ok(comparison.choices.length <= 4);
assert.ok(comparison.choices.filter(item => item.actionId !== "end" && !item.recommended).length <= 2);
assert.equal(comparison.choices.filter(item => item.actionId === "end").length, 1);
assert.equal(new Set(comparison.choices.map(item => JSON.stringify([item.actionId, item.fields]))).size, comparison.choices.length);
assert.ok(recommendation.benefit && recommendation.cost);
assert.match(recommendation.cost, /行动 1/);
const guard = comparison.choices.find(item => item.actionId === "end");
const fixed = run.window.XianMonthlySafety.preview(before).projected;
for (const row of guard.changes) {
  const [group, key] = row.path.split(".");
  assert.equal(row.immediate, before[group][key]); assert.equal(row.fixed, fixed[group][key]); assert.equal(row.versusGuard, 0);
}
for (const item of comparison.choices.filter(item => item.actionId !== "end")) {
  const plan = run.window.XianActionPlans.build(item.actionId, item.fields, before);
  assert.ok(plan.affordable && before.stats.treasury - plan.cost >= 1);
  assert.match(item.cost, /行动 1/);
}

// The real comparison button enters a preselected original menu, then requires confirmation.
run.node("action-grid").querySelector("[data-action-compare]").click();
assert.equal(run.node("modal-title").textContent, "行动方案比较");
assert.match(run.node("modal-body").innerHTML, /比守成/);
const index = comparison.choices.findIndex(item => item.actionId !== "end");
const choice = comparison.choices[index];
run.node("modal-body").querySelectorAll("[data-compare-choice]")[index].click();
assert.deepEqual(plain(run.api.getState()), before, "selecting a candidate must not execute it");
for (const [name, value] of Object.entries(choice.fields)) {
  const actual = name.startsWith("modal-") ? run.node(name).value : run.document.querySelector(`input[name="${name}"]:checked`).value;
  assert.equal(actual, value);
}
run.node("modal-cancel").click();
assert.deepEqual(plain(run.api.getState()), before); assert.deepEqual(run.stores(), stores);
run.node("action-grid").querySelector("[data-action-compare]").click();
run.node("modal-body").querySelectorAll("[data-compare-choice]")[index].click();
run.node("modal-confirm").click();
assert.equal(run.api.getState().actionPoints, before.actionPoints - 1);
const projected = run.window.XianActionPlans.project(before, run.window.XianActionPlans.build(choice.actionId, choice.fields, before));
assert.deepEqual(plain(run.api.getState().stats), plain(projected.stats));
assert.deepEqual(plain(run.api.getState().hidden), plain(projected.hidden));

// Background changes invalidate the shown choices, and selecting guard only opens preflight.
run.api.openActionComparison();
run.api.applyExternalPackage({ effects: { treasury: 1 } });
const changed = plain(run.api.getState());
run.node("modal-body").querySelectorAll("[data-compare-choice]")[0].click();
assert.equal(run.node("modal-title").textContent, "行动方案比较");
assert.deepEqual(plain(run.api.getState()), changed);
const fresh = run.window.XianCommandCenter.compareActions(changed);
const guardIndex = fresh.choices.findIndex(item => item.actionId === "end");
run.node("modal-body").querySelectorAll("[data-compare-choice]")[guardIndex].click();
assert.equal(run.node("modal-title").textContent, "月末结算预检");
assert.deepEqual(plain(run.api.getState()), changed);
run.node("modal-cancel").click();

// Every curated starting position yields bounded, affordable, genuinely different choices.
for (const challenge of run.window.XianShortChallenges.getChallenges()) {
  const sample = harness(); sample.load("command-center"); sample.window.XianShortChallenges.start(challenge.id); sample.decide(0);
  const state = plain(sample.api.getState()), result = sample.window.XianCommandCenter.compareActions(state);
  if (!result.available) continue;
  const primary = result.choices.find(item => item.recommended);
  const previewOf = item => sample.window.XianMonthlySafety.preview(item.actionId === "end" ? state : sample.window.XianActionPlans.project(state, sample.window.XianActionPlans.build(item.actionId, item.fields, state))).projected;
  const base = previewOf(primary);
  for (const item of result.choices.filter(item => !item.recommended && item.actionId !== "end")) {
    const next = previewOf(item);
    const deltas = ["stats", "hidden"].flatMap(group => Object.keys(base[group]).map(key => (next[group][key] - base[group][key]) * (["caoAlert", "leakRisk"].includes(key) ? -1 : 1)));
    const relationGain = candidate => candidate.relations.reduce((sum, relation) => sum + relation.delta, 0);
    deltas.push(relationGain(item) - relationGain(primary));
    assert.ok(deltas.some(delta => delta > 0) && deltas.some(delta => delta < 0), "an alternative must have a real tradeoff against the recommendation");
    assert.ok(!result.choices.some(other => other !== item && other.actionId === item.actionId && !other.recommended), "no duplicate alternative categories");
  }
}
const poor = plain(before); poor.stats.treasury = 2;
for (const item of run.window.XianCommandCenter.compareActions(poor).choices.filter(item => item.actionId !== "end")) {
  assert.ok(run.window.XianActionPlans.build(item.actionId, item.fields, poor).cost <= 1);
}
assert.equal(run.window.XianCommandCenter.compareActions({ ...before, actionPoints: 0 }).available, false);
assert.equal(run.window.XianCommandCenter.compareActions({ ...before, ended: true }).available, false);
console.log("Action comparison passed: read-only previews, bounded tradeoffs, affordability, original confirmation, stale views and guard preflight.");
