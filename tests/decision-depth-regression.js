"use strict";
const assert = require("node:assert/strict");
const { harness, plain } = require("./helpers/game-harness");
const audience = { "modal-character-select": "xun_yu", "audience-mode": "public" };
function prepare() {
  const run = harness(); run.api.startNewGame(); const core = run.api.getState();
  run.replaceCore({ eventResolved: true, stats: { ...core.stats, treasury: 70, authority: 40, officials: 40, security: 55, caoAlert: 40 },
    hidden: { ...core.hidden, leakRisk: 20 }, relations: { ...core.relations, xun_yu: 50 } });
  return run;
}
{
  const run = prepare(); assert.equal(run.act("audience", audience), true);
  const before = run.api.getState(), preview = run.window.XianActionPlans.build("audience", audience, before);
  assert.equal(preview.effects.authority, -1, "political concessions remain intact on a repeat audience");
  assert.equal(preview.effects.security, 1, "second public audience halves favorable national security");
  assert.equal(preview.effects.caoAlert, -2, "favorable alert reductions round toward zero");
  assert.equal(preview.repetition.ordinal, 2);
  const rng = plain(before.random); run.window.XianActionPlans.list(before); assert.deepEqual(plain(run.api.getState().random), rng);
  assert.equal(run.act("audience", audience), true);
  const after = run.api.getState(), projected = run.window.XianActionPlans.project(before, preview);
  assert.deepEqual(plain(after.stats), plain(projected.stats));
  assert.deepEqual(plain(after.relations), plain(projected.relations));
  assert.equal(after.actionRepetitions.counts[preview.repetition.key], 2);
  const resumed = harness(run.stores()); resumed.node("continue-game-btn").click();
  assert.equal(resumed.window.XianActionPlans.build("audience", audience, resumed.api.getState()).repetition.ordinal, 3, "load preserves action count");
  run.api.endTurn();
  assert.equal(run.window.XianActionPlans.build("audience", audience, run.api.getState()).repetition.ordinal, 1, "new month resets repeats");
}
{
  const run = prepare(); run.act("audience", audience);
  const core = run.api.getState();
  assert.equal(run.window.XianActionPlans.build("audience", { ...audience, "audience-mode": "private" }, core).repetition.ordinal, 2, "same target shares count across methods");
  const rotated = run.window.XianActionPlans.build("audience", { ...audience, "modal-character-select": "cao_cao" }, core);
  assert.equal(rotated.repetition.ordinal, 2, "different target shares the national audience count");
  assert.equal(rotated.repetition.personalOrdinal, 1, "different target keeps a separate relationship count");
  run.act("revenue", { "revenue-method": "audit" });
  assert.equal(run.window.XianActionPlans.build("revenue", { "revenue-method": "tribute" }, run.api.getState()).repetition.ordinal, 2, "untargeted methods share action category");
}
{
  const run = prepare(); const core = run.api.getState();
  run.replaceCore({ relations: { ...core.relations, xun_yu: 99 } });
  const plan = run.window.XianActionPlans.build("audience", audience, run.api.getState());
  assert.equal(plan.relations.xun_yu, 1, "preview shows actual relation gain at cap");
}
{
  const run = prepare(); run.mount("quarterly-agenda", "council-advice");
  const quarter = run.window.XianQuarterlyAgenda, council = run.window.XianCouncilAdvice;
  assert.ok(quarter.getState().offers.includes("steady_court"));
  assert.equal(quarter.selectAgenda("steady_court"), true);
  assert.match(run.node("imperial-advice-slot").innerHTML, /百官额外 \+2/, "advice describes its actual recurring bonus before adoption");
  assert.match(run.node("imperial-advice-slot").innerHTML, /国库 −1/, "adoption fee is visible before paying");
  assert.equal(council.chooseAdvice("yang_biao"), true);
  const fields = { "ritual-type": "lecture" }, before = run.api.getState();
  const plan = run.window.XianActionPlans.build("ritual", fields, before);
  assert.ok(plan.advice, "real quarter adviser changes structured matching action plan");
  assert.equal(plan.cost, 2, "Yang Biao reduces actual ritual cost by one");
  assert.equal(plan.effects.officials, 8, "Yang Biao increases actual official support by two");
  const unaligned = run.window.XianActionPlans.build("secret", { "modal-character-select": "dong_cheng", "modal-secret-type": "support" }, before);
  assert.equal(unaligned.advice, null, "nonmatching structured type receives no bonus");
  assert.equal(run.act("ritual", fields), true);
  assert.deepEqual(plain(run.api.getState().stats), plain(run.window.XianActionPlans.project(before, plan).stats));
  assert.equal(council.getState().chosen.alignedActions, 1);
  const receipt = run.api.getState().reports.find(item => item.type === "action");
  const beforeDuplicate = plain(council.getState());
  run.document.dispatchEvent({ type: "xian:external-action-completed", detail: { id: receipt?.id || "duplicate", actionId: "ritual", type: "lecture", createdAt: before.createdAt } });
  assert.deepEqual(plain(council.getState()), beforeDuplicate, "replayed completed events cannot grant modifiers");
  assert.equal(run.act("ritual", fields), true);
  assert.equal(council.getState().chosen.alignedActions, 2);
  assert.equal(run.window.XianActionPlans.build("ritual", fields, run.api.getState()).advice, null, "two uses is the seasonal cap");
  quarter.addContribution(100, "投入不是成果");
  const current = run.api.getState();
  run.replaceCore({ stats: { ...current.stats, officials: quarter.getState().active.baseline } });
  assert.equal(quarter.calculateProgress(run.api.getState()), 0, "100 contribution does not replace real metric progress");
  const resumed = harness(run.stores()); resumed.node("continue-game-btn").click(); resumed.mount("quarterly-agenda", "council-advice");
  assert.equal(resumed.window.XianCouncilAdvice.getState().chosen.alignedActions, 2, "load preserves adviser cap");
}
{
  const run = prepare(); run.mount("quarterly-agenda", "council-advice"); run.load("command-center");
  const quarter = run.window.XianQuarterlyAgenda, council = run.window.XianCouncilAdvice;
  quarter.selectAgenda("steady_court"); council.chooseAdvice("yang_biao");
  run.act("ritual", { "ritual-type": "lecture" });
  const saved = plain(run.api.captureFullSave()), usedReceipt = council.getState().processed[0];
  const core = run.api.getState(), comparison = run.window.XianCommandCenter.compareActions(core);
  for (const choice of comparison.choices.filter(item => item.actionId !== "end")) {
    const plan = run.window.XianActionPlans.build(choice.actionId, choice.fields, core);
    assert.ok(choice.repetition, "comparison exposes the repeat rule used for its numbers");
    assert.deepEqual(plain(choice.repetition), plain(plan.repetition), "comparison carries current repeat rule");
    assert.deepEqual(plain(choice.advice), plain(plan.advice), "comparison carries actual adviser modifier");
    const projected = run.window.XianActionPlans.project(core, plan);
    for (const change of choice.changes) {
      const [group, key] = change.path.split("."); assert.equal(change.immediate, projected[group][key]);
    }
  }
  run.act("ritual", { "ritual-type": "lecture" });
  assert.equal(run.api.restoreFullSave(saved), true);
  const restored = harness(run.stores()); restored.node("continue-game-btn").click(); restored.mount("quarterly-agenda", "council-advice");
  const restoredCouncil = restored.window.XianCouncilAdvice;
  assert.equal(restoredCouncil.getState().chosen.alignedActions, 1, "complete import reinstalls the captured seasonal allowance");
  const plan = restored.window.XianActionPlans.build("ritual", { "ritual-type": "lecture" }, restored.api.getState());
  assert.equal(plan.repetition.ordinal, 2, "complete import reinstalls the captured repeat count");
  assert.equal(restoredCouncil.consumeActionModifier(plan, usedReceipt, restored.api.getState()), false, "imported receipt cannot be consumed again");
  restored.act("ritual", { "ritual-type": "lecture" });
  assert.equal(restoredCouncil.getState().chosen.alignedActions, 2);
  while (restored.api.getState().turn < 4 && !restored.api.getState().ended) {
    if (!restored.api.getState().eventResolved) restored.decide(0);
    restored.api.endTurn();
  }
  const nextQuarter = restored.window.XianQuarterlyAgenda;
  assert.equal(nextQuarter.getState().active, null);
  assert.ok(nextQuarter.getState().offers.length);
  nextQuarter.selectAgenda(nextQuarter.getState().offers[0]);
  assert.equal(restoredCouncil.getState().chosen, null, "next quarter resets adviser selection");
  const adviser = restoredCouncil.buildAdvice()[0]; restoredCouncil.chooseAdvice(adviser.id);
  assert.equal(restoredCouncil.getState().chosen.alignedActions, 0, "next quarter starts with two fresh uses");
  assert.deepEqual(plain(restoredCouncil.getState().processed), []);
}
console.log("Decision depth: actual actions, shared repeat keys, preview/net changes, cap, RNG purity and actual quarterly adviser effects passed.");
