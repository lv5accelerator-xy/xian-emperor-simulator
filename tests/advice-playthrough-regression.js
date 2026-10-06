"use strict";
const assert = require("node:assert/strict");
const { harness, plain } = require("./helpers/game-harness");

// Only visible event effects guide event choices; common actions follow the shipped advisor.
function chooseEvent(run, definition, mode) {
  if (mode < 2) return Math.min(mode, run.api.getCurrentEvent().choices.length - 1);
  const core = run.api.getState(), weights = { security: .8, treasury: .3, officials: .3, caoAlert: -.6, leakRisk: -.5 };
  for (const goal of definition.goals) {
    const [group, key] = goal.path.split("."), value = core[group][key];
    weights[key] = goal.min != null ? value < goal.min + 5 ? 4 : 1 : value > goal.max - 8 ? -4 : -.6;
  }
  return run.api.getCurrentEvent().choices.map((choice, index) => ({ index,
    score: Object.entries({ ...choice.effects, ...choice.hidden }).reduce((sum, [key, delta]) => sum + delta * (weights[key] || 0), 0),
  })).sort((a, b) => b.score - a.score || a.index - b.index)[0].index;
}
function ready(stores = {}) { const run = harness(stores); run.loadMechanics(); run.load("command-center"); return run; }
function play(definition, seed, policy, resumeAt = null) {
  let run = ready();
  run.window.XianShortChallenges.startCustom({ ...definition, id: `advice-${definition.id}-${seed}`, kind: "advice-validation", randomSeed: seed }); run.flush();
  const trace = []; let spent = 0, actions = 0, reloadChecked = false;
  while (!run.api.getState().ended) {
    const beginning = run.api.getState(); assert.ok(beginning.turn <= definition.duration);
    run.decide(chooseEvent(run, definition, seed % 3)); run.flush();
    if (run.api.getState().ended) break;
    for (let step = 0; step < 3 && policy === "advisor"; step++) {
      const before = plain(run.api.getState()), stores = run.stores();
      const advice = plain(run.window.XianCommandCenter.recommendAction(before));
      assert.deepEqual(plain(run.api.getState()), before); assert.deepEqual(run.stores(), stores, "asking for advice cannot consume random draws or write saves");
      trace.push({ turn: before.turn, actionId: advice.actionId, fields: advice.fields || null });
      if (advice.actionId === "end") break;
      assert.ok(advice.fields, "a usable action recommendation must specify a real variant and target");
      const plan = run.window.XianActionPlans.build(advice.actionId, advice.fields, before);
      assert.ok(plan?.affordable); spent += plan.cost; actions += 1;
      run.node("action-grid").querySelector("[data-action-recommend]").click();
      assert.equal(run.api.getState().totalActions, before.totalActions, "recommendation click opens confirmation without spending");
      run.node("modal-confirm").click(); run.flush();
      assert.equal(run.api.getState().totalActions, before.totalActions + 1);
      if (run.api.getState().ended || run.api.getState().actionPoints === 0) break;
    }
    if (run.api.getState().ended) break;
    run.node("end-turn-btn").click(); run.node("modal-confirm").click(); run.flush();
    if (resumeAt === run.api.getState().turn && !run.api.getState().ended) {
      const state = plain(run.api.getState()), advice = plain(run.window.XianCommandCenter.recommendAction(state));
      const resumed = ready(run.stores()); resumed.node("continue-game-btn").click(); resumed.flush();
      assert.deepEqual(plain(resumed.api.getState().random), state.random);
      assert.deepEqual(plain(resumed.window.XianCommandCenter.recommendAction(resumed.api.getState())), advice, "reload must produce the same advice");
      run = resumed; reloadChecked = true;
    }
  }
  const core = plain(run.api.getState()), result = plain(run.window.XianShortChallenges.getState().results[0]);
  assert.ok(core.ended && result, "every complete run must have an actual terminal grade");
  for (const check of result.checks) { const [group, key] = check.path.split("."); assert.equal(check.value, core[group][key]); }
  return { completed: result.completed, gold: result.medal === "gold", early: result.endedEarly, spent, actions, trace,
    final: { stats: core.stats, hidden: core.hidden, random: core.random, score: result.score }, reloadChecked };
}
const scenarios = harness().window.XianShortChallenges.getChallenges();
const report = [];
for (const definition of scenarios) {
  const cell = { challenge: definition.id, samples: 24, advisorGold: 0, baselineGold: 0, advisorGoals: 0, baselineGoals: 0, early: 0, spent: 0, actions: 0 };
  for (let index = 1; index <= cell.samples; index++) {
    const seed = index * 2654435761 >>> 0;
    const advisor = play(definition, seed, "advisor"), baseline = play(definition, seed, "guard");
    cell.advisorGold += Number(advisor.gold); cell.baselineGold += Number(baseline.gold);
    cell.advisorGoals += advisor.completed; cell.baselineGoals += baseline.completed; cell.early += Number(advisor.early); cell.spent += advisor.spent; cell.actions += advisor.actions;
  }
  report.push(cell); console.log(JSON.stringify(cell));
}
const seeded = play(scenarios[1], 20261006, "advisor"), resumed = play(scenarios[1], 20261006, "advisor", 3);
assert.equal(resumed.reloadChecked, true); assert.deepEqual(resumed.final, seeded.final); assert.deepEqual(resumed.trace, seeded.trace);
// Multi-goal traps: raising treasury must preserve a feasible authority goal; secrecy must not undo leak control.
for (const [id, stats, hidden, forbidden] of [
  ["white_horse", { treasury: 25, authority: 32 }, { leakRisk: 0 }, "revenue-method"],
  ["girdle_edict", { security: 34 }, { loyalNetwork: 27, leakRisk: 57 }, "secret-type"],
]) {
  const run = ready(); run.window.XianShortChallenges.start(id); run.flush(); const core = run.api.getState();
  run.replaceCore({ eventResolved: true, actionPoints: 2, stats: { ...core.stats, treasury: 60, security: 65, prestige: 65, officials: 55, caoAlert: 40, ...stats }, hidden: { ...core.hidden, ...hidden } });
  const state = run.api.getState(), goals = run.window.XianShortChallenges.getActiveStatus(state).checks;
  const advice = run.window.XianCommandCenter.recommendAction(state); assert.notEqual(advice.actionId, "end");
  const predicted = run.window.XianMonthlySafety.preview(run.window.XianActionPlans.project(state, run.window.XianActionPlans.build(advice.actionId, advice.fields, state)), goals);
  assert.ok(predicted.checks.every(goal => goal.afterPassed), `${id}: choose a feasible improvement without sacrificing another goal`);
}
for (const cell of report) {
  assert.equal(cell.early, 0, `${cell.challenge}: advice must avoid early collapse for these paired seeds`);
  assert.ok(cell.advisorGoals >= cell.baselineGoals, `${cell.challenge}: actual advisor must not lose goal completion against the same visible event policy`);
}
console.log("120 real advisor runs + 120 paired guard controls, concrete UI confirmations, final grading and seeded reload passed.");
