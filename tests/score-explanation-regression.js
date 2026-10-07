"use strict";
const assert = require("node:assert/strict");
const { harness, plain } = require("./helpers/game-harness");
const SHORT_KEY = "xian_emperor_short_challenges_v230";
const run = harness(); run.loadMechanics();
const scores = run.window.XianShortScore;
const definition = run.window.XianWeeklyChallenge.buildDefinition(run.window.XianWeeklyChallenge.codeForWeek("2026W41"));
function play(choice, audience) {
  run.window.XianShortChallenges.startCustom(definition); run.flush();
  while (!run.api.getState().ended) {
    run.decide(choice); run.flush();
    if (audience && run.api.getState().turn === 1) {
      assert.equal(run.act("audience", { "modal-character-select": "xun_yu", "audience-mode": "public" }), true); run.flush();
    }
    run.node("end-turn-btn").click(); run.node("modal-confirm").click(); run.flush();
  }
  const result = plain(run.window.XianShortChallenges.getState().results[0]);
  const recorded = plain(scores.read(result));
  assert.ok(recorded);
  assert.equal(recorded.inputs.prestige, run.api.getState().stats.prestige);
  assert.equal(recorded.inputs.authority, run.api.getState().stats.authority);
  assert.equal(Math.round(recorded.inputs.completed / Math.max(1, recorded.inputs.total) * 1000 + recorded.inputs.prestige * 2 + recorded.inputs.authority), result.score);
  assert.equal(Math.round(Object.values(recorded.components).reduce((sum, value) => sum + value, 0) * 100) / 100, result.score);
  return result;
}
const first = play(0, false), second = play(1, true);
const comparison = plain(run.window.XianShortChallenges.getComparison(second));
assert.equal(comparison.available, true); assert.equal(comparison.scoreDifference.available, true);
assert.equal(comparison.scoreDifference.delta, second.score - first.score);
assert.equal(Math.round(comparison.scoreDifference.parts.reduce((sum, part) => sum + part.delta, 0) * 100) / 100, second.score - first.score);
assert.match(run.window.XianShortChallenges.formatReviewText(run.api.getState()), /分数构成：.*目标达成分/);
assert.match(run.node("short-ending-review").innerHTML, /分差从哪里来/);
const before = plain(run.api.getState()), stores = run.stores();
scores.html(second); scores.text(second); scores.compare(second, first);
run.window.XianShortChallenges.renderEndingReview(run.api.getState());
assert.deepEqual(plain(run.api.getState()), before); assert.deepEqual(run.stores(), stores);
const reload = harness(stores); reload.node("continue-game-btn").click();
assert.deepEqual(plain(reload.window.XianShortScore.read(reload.window.XianShortChallenges.getState().results[0])), plain(scores.read(second)));
const importing = harness();
const envelope = { format: "xian-emperor-full-save", stores: Object.fromEntries(Object.entries(stores).map(([key, value]) => [key, JSON.parse(value)])) };
importing.node("import-file").dispatchEvent({ type: "change", target: { value: "full.json", files: [{ text: JSON.stringify(envelope) }] } });
const imported = harness(importing.stores()); imported.node("continue-game-btn").click();
assert.deepEqual(plain(imported.window.XianShortScore.read(imported.window.XianShortChallenges.getState().results[0])), plain(scores.read(second)));

// Preserve old totals and pairing, but never infer their prestige/authority from a score.
const legacyStores = { ...stores }, old = JSON.parse(legacyStores[SHORT_KEY]);
delete old.results[1].scoreBreakdown; delete old.best[first.challengeId].scoreBreakdown;
legacyStores[SHORT_KEY] = JSON.stringify(old);
const legacy = harness(legacyStores); legacy.node("continue-game-btn").click();
const oldResult = legacy.window.XianShortChallenges.getState().results[1];
assert.equal(oldResult.score, first.score); assert.equal(oldResult.scoreBreakdown, undefined);
assert.equal(legacy.window.XianShortScore.read(oldResult), null);
assert.match(legacy.window.XianShortScore.html(oldResult), /旧成绩未记录评分构成/);
const limited = legacy.window.XianShortChallenges.getComparison(legacy.window.XianShortChallenges.getState().results[0]);
assert.equal(limited.available, true); assert.equal(limited.scoreDifference.available, false);
assert.equal(limited.scoreDifference.delta, second.score - first.score);
assert.match(legacy.window.XianSameChallenge.html(limited), /只显示总分差/);

// Displayed components reconcile after fractional target points and final rounding.
const fractional = { rulesVersion: 216, completed: 2, total: 3, score: 785, endedEarly: false };
fractional.scoreBreakdown = scores.build(fractional, { stats: { prestige: 45.12, authority: 27.83 } });
assert.deepEqual(plain(scores.read(fractional).components), { goals: 666.67, prestige: 90.24, authority: 27.83, rounding: .26 });
for (const corrupt of [item => { item.score += 1; }, item => { item.rulesVersion = 215; },
  item => { item.scoreBreakdown.inputs.prestige = null; }, item => { item.scoreBreakdown.components.goals += 1; }]) {
  const invalid = plain(fractional); corrupt(invalid); assert.equal(scores.read(invalid), null);
}
const recorded = (score, prestige, authority) => {
  const item = { rulesVersion: 216, completed: 3, total: 3, score, endedEarly: false };
  item.scoreBreakdown = scores.build(item, { stats: { prestige, authority } }); return item;
};
const delta = plain(scores.compare(recorded(1203, 84, 35), recorded(1235, 91, 53)));
assert.equal(delta.delta, -32);
assert.equal(delta.parts.find(part => part.key === "goals").delta, 0);
assert.equal(delta.parts.find(part => part.key === "prestige").delta, -14);
assert.equal(delta.parts.find(part => part.key === "authority").delta, -18);

// A real interrupted run gets zero, even when some of its goals already pass.
const early = harness({}, 0); early.window.XianShortChallenges.start("xudu_mutiny");
const core = early.api.getState();
early.replaceCore({ eventResolved: true, actionPoints: 0, stats: { ...core.stats, security: 2 }, hidden: { ...core.hidden, leakRisk: 90 } });
early.api.endTurn();
const ended = early.window.XianShortChallenges.getState().results[0];
assert.equal(ended.endedEarly, true); assert.equal(ended.score, 0);
assert.deepEqual(plain(early.window.XianShortScore.read(ended).components), { goals: 0, prestige: 0, authority: 0, rounding: 0 });
assert.match(early.window.XianShortScore.html(ended), /提前终局，本局不计分/);
console.log("Score explanation passed: actual paired runs, grading inputs, fractional rounding, early zero, read-only views, legacy totals, invalid data, reload and full import.");
