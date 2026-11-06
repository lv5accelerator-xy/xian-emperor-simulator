"use strict";
const assert = require("node:assert/strict");
const { harness, plain } = require("./helpers/game-harness");
const fields = (id, mode = "public") => ({ "modal-character-select": id, "audience-mode": mode });
let groups = 0;
function check(name, test) { test(); groups++; console.log(`PASS ${name}`); }
function ready() {
  const r = harness(); r.api.startNewGame("standard", "jianan_196", { randomSeed: 225 });
  const c = r.api.getState();
  r.replaceCore({ eventResolved: true, stats: { ...c.stats, authority: 45, officials: 45, security: 55, treasury: 50, caoAlert: 45 },
    hidden: { ...c.hidden, loyalNetwork: 20, leakRisk: 20 }, relations: { ...c.relations, yang_biao: 50, dong_cheng: 50, xun_yu: 50, cao_cao: 50 } });
  return r;
}
check("rotation shares national benefits and preserves a new personal relationship", () => {
  const r = ready(); assert.equal(r.act("audience", fields("yang_biao")), true);
  const c = r.api.getState(), plan = r.window.XianActionPlans.build("audience", fields("dong_cheng"), c);
  assert.equal(plan.repetition.multiplier, .5, "rotation must not restore national audience benefits");
  assert.equal(plan.repetition.personalMultiplier, 1, "another person still receives full relationship benefit");
  assert.equal(plan.effects.authority, 1); assert.equal(plan.effects.officials, 1);
  assert.equal(plan.relations.dong_cheng, 4);
  assert.equal(r.act("audience", fields("dong_cheng")), true);
  assert.equal(r.api.getState().relations.dong_cheng - c.relations.dong_cheng, 4);
  assert.equal(r.api.getState().actionRepetitions.counts["audience:state"], 2);
  assert.equal(r.api.getState().actionRepetitions.counts["audience:dong_cheng"], 1);
});
check("same person halves relationship once and changing mode cannot reset either counter", () => {
  const r = ready(); r.act("audience", fields("yang_biao"));
  const publicPlan = r.window.XianActionPlans.build("audience", fields("yang_biao"), r.api.getState());
  assert.equal(publicPlan.relations.yang_biao, 2, "national and personal factors must not multiply the same benefit twice");
  const before = r.api.getState(), plan = r.window.XianActionPlans.build("audience", fields("yang_biao", "private"), before);
  assert.equal(plan.repetition.ordinal, 2); assert.equal(plan.repetition.personalOrdinal, 2);
  assert.equal(plan.relations.yang_biao, 3); assert.equal(plan.hidden.loyalNetwork, 2);
  assert.equal(plan.effects.security, -1); assert.equal(plan.effects.caoAlert, 3); assert.equal(plan.hidden.leakRisk, 3);
  assert.equal(r.act("audience", fields("yang_biao", "private")), true);
  const projected = r.window.XianActionPlans.project(before, plan), after = r.api.getState();
  for (const group of ["stats", "hidden", "relations"]) assert.deepEqual(plain(after[group]), plain(projected[group]));
});
check("each political role has a distinct benefit and a real concession", () => {
  const r = ready(), c = r.api.getState(), build = id => r.window.XianActionPlans.build("audience", fields(id), c);
  const loyal = build("yang_biao"), cao = build("xun_yu"), regional = build("liu_biao");
  assert.equal(loyal.effects.authority, 3); assert.equal(loyal.effects.officials, 3); assert.equal(loyal.effects.caoAlert, 2);
  assert.equal(cao.effects.authority, -1); assert.equal(cao.effects.security, 3); assert.equal(cao.effects.caoAlert, -5);
  assert.equal(regional.hidden.externalBalance, 3); assert.equal(regional.effects.prestige, 3); assert.equal(regional.cost, 1);
  assert.ok([loyal, cao, regional].every(plan => plan.purpose));
});
check("costs, AP and adverse changes remain whole; rejection preserves both counters", () => {
  const r = ready(), c = r.api.getState(); r.replaceCore({ stats: { ...c.stats, treasury: 2 } });
  r.act("audience", fields("liu_biao"));
  const plan = r.window.XianActionPlans.build("audience", fields("sun_ce"), r.api.getState());
  assert.equal(plan.cost, 1); assert.equal(plan.effects.caoAlert, 3); assert.equal(plan.relations.sun_ce, 4);
  assert.equal(r.act("audience", fields("sun_ce")), true); assert.equal(r.api.getState().actionPoints, 0);
  assert.equal(r.api.getState().stats.treasury, 0);
  r.api.endTurn(); r.decide(1);
  const empty = r.api.getState(); r.replaceCore({ stats: { ...empty.stats, treasury: 0 } });
  const before = plain(r.api.getState());
  assert.equal(r.act("audience", fields("liu_biao")), false);
  assert.deepEqual(plain(r.api.getState()), before);
});
check("adviser enters the shared calculation before one national multiplier and uses real quota", () => {
  const r = ready(); r.mount("quarterly-agenda", "council-advice");
  assert.equal(r.window.XianQuarterlyAgenda.selectAgenda("steady_court"), true);
  assert.equal(r.window.XianCouncilAdvice.chooseAdvice("empress_fu"), true);
  const first = r.window.XianActionPlans.build("audience", fields("yang_biao"), r.api.getState());
  assert.equal(first.effects.security, 2); assert.equal(first.hidden.leakRisk, -1); assert.ok(first.advice);
  r.act("audience", fields("yang_biao"));
  const before = r.api.getState(), second = r.window.XianActionPlans.build("audience", fields("dong_cheng"), before);
  assert.equal(second.effects.security, 1); assert.equal(second.hidden.leakRisk, 0); assert.equal(second.relations.dong_cheng, 4);
  assert.equal(r.act("audience", fields("dong_cheng")), true);
  assert.deepEqual(plain(r.api.getState().stats), plain(r.window.XianActionPlans.project(before, second).stats));
  assert.equal(r.window.XianCouncilAdvice.getState().chosen.alignedActions, 2);
  assert.equal(r.window.XianActionPlans.build("audience", fields("yang_biao"), r.api.getState()).advice, null);
});
check("previews, list, comparison and recommendations are pure and share repetition identity", () => {
  const r = ready(); r.act("audience", fields("yang_biao")); r.load("command-center");
  const before = plain(r.api.getState()), stores = r.stores();
  r.window.XianActionPlans.list(before); r.window.XianCommandCenter.recommendAction(before);
  const comparison = r.window.XianCommandCenter.compareActions(before);
  for (const choice of comparison.choices.filter(item => item.actionId !== "end")) {
    const plan = r.window.XianActionPlans.build(choice.actionId, choice.fields, before);
    assert.deepEqual(plain(choice.repetition), plain(plan.repetition));
  }
  assert.deepEqual(plain(r.api.getState()), before); assert.deepEqual(r.stores(), stores);
});
check("refresh and complete import retain both counts and new month clears them", () => {
  const r = ready(); r.act("audience", fields("yang_biao"));
  const saved = plain(r.api.captureFullSave()), resumed = harness(r.stores()); resumed.node("continue-game-btn").click();
  const read = run => run.window.XianActionPlans.build("audience", fields("dong_cheng"), run.api.getState());
  assert.equal(read(resumed).repetition.ordinal, 2); assert.equal(read(resumed).repetition.personalOrdinal, 1);
  r.act("audience", fields("dong_cheng")); assert.equal(r.api.restoreFullSave(saved), true);
  const restored = harness(r.stores()); restored.node("continue-game-btn").click();
  assert.equal(read(restored).repetition.ordinal, 2); assert.equal(read(restored).repetition.personalOrdinal, 1);
  restored.api.endTurn(); assert.equal(read(restored).repetition.ordinal, 1); assert.equal(read(restored).repetition.personalOrdinal, 1);
});
check("old explicit personal counts seed common history without inventing absent actions", () => {
  const r = ready(), c = r.api.getState();
  r.replaceCore({ actionRepetitions: { turn: c.turn, counts: { "audience:yang_biao": 1, "audience:dong_cheng": 2 } } });
  const plan = r.window.XianActionPlans.build("audience", fields("xun_yu"), r.api.getState());
  assert.equal(plan.repetition.ordinal, 4); assert.equal(plan.repetition.personalOrdinal, 1);
  assert.equal(r.act("audience", fields("xun_yu")), true);
  assert.equal(r.api.getState().actionRepetitions.counts["audience:state"], 4);
  assert.equal(r.window.XianActionPlans.build("audience", fields("cao_cao"), r.api.getState()).repetition.ordinal, 5);
  r.replaceCore({ actionRepetitions: { turn: c.turn, counts: {} } });
  assert.equal(r.window.XianActionPlans.build("audience", fields("xun_yu"), r.api.getState()).repetition.ordinal, 1);
});
check("other action categories keep their existing individual repeat rules", () => {
  const r = ready(); r.act("audience", fields("yang_biao"));
  for (const [id, f] of [["revenue", { "revenue-method": "audit" }], ["ritual", { "ritual-type": "court" }],
    ["secret", { "modal-character-select": "dong_cheng", "modal-secret-type": "support" }],
    ["regional", { "modal-character-select": "liu_biao", "regional-type": "edict" }]]) {
    assert.equal(r.window.XianActionPlans.build(id, f, r.api.getState()).repetition.multiplier, 1);
  }
});
console.log(`Audience common counter regression passed: ${groups} groups.`);
