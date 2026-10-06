"use strict";
const assert = require("node:assert/strict");
const { harness, plain } = require("./helpers/game-harness");
const initial = harness(); initial.api.startNewGame();
const core = initial.api.getState();
const state = { ...core, eventResolved: true, stats: Object.fromEntries(Object.keys(core.stats).map(key => [key, 70])), hidden: Object.fromEntries(Object.keys(core.hidden).map(key => [key, 20])) };
const plans = initial.window.XianActionPlans.list(state);
for (const expected of plans) {
  const run = harness(); run.api.startNewGame(); run.replaceCore({ ...state, createdAt: run.api.getState().createdAt }); run.flush();
  const before = plain(run.api.getState()), stores = run.stores();
  run.api.openRecommendedAction({ ...expected, reason: "核对真实选项" });
  assert.deepEqual(plain(run.api.getState()), before, "opening a recommendation must not execute it");
  assert.deepEqual(run.stores(), stores);
  for (const [name, value] of Object.entries(expected.fields)) {
    const selected = name.startsWith("modal-") ? run.node(name).value : run.document.querySelector(`input[name="${name}"]:checked`)?.value;
    assert.equal(selected, value, `${expected.label}: concrete menu option must be selected`);
  }
  run.node("modal-confirm").click();
  const actual = run.api.getState(), predicted = run.window.XianActionPlans.project(before, expected);
  assert.equal(actual.totalActions, before.totalActions + 1, expected.label);
  assert.deepEqual(plain(actual.stats), plain(predicted.stats), `${expected.label}: displayed rules must match executed stats`);
  assert.deepEqual(plain(actual.hidden), plain(predicted.hidden), `${expected.label}: displayed rules must match hidden metrics`);
}
const low = harness(); low.api.startNewGame(); const start = low.api.getState();
low.replaceCore({ eventResolved: true, stats: { ...start.stats, treasury: 1 } });
const before = plain(low.api.getState());
low.api.openRecommendedAction({ actionId: "appointment", fields: { "modal-character-select": "xun_yu", "modal-appointment-type": "title" }, reason: "费用不足" });
low.node("modal-confirm").click(); assert.deepEqual(plain(low.api.getState()), before, "unaffordable appointments cannot spend AP or clamp a negative treasury to zero");
console.log(`Concrete recommendation menus and all ${plans.length} actual action plans passed.`);
