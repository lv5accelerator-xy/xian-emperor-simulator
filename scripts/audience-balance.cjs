"use strict";
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const { harness, plain } = require("../tests/helpers/game-harness");
const audience = id => ["audience", { "modal-character-select": id, "audience-mode": "public" }];
const POLICIES = {
  same_person: [audience("yang_biao"), audience("yang_biao")],
  same_faction_rotation: [audience("yang_biao"), audience("dong_cheng")],
  safety_repair: [audience("xun_yu"), audience("cao_cao")],
  audience_finance: [audience("yang_biao"), ["revenue", { "revenue-method": "audit" }]],
  audience_ritual: [audience("yang_biao"), ["ritual", { "ritual-type": "court" }]],
  audience_secret: [audience("yang_biao"), ["secret", { "modal-character-select": "dong_cheng", "modal-secret-type": "support" }]],
  audience_diplomacy: [audience("yang_biao"), ["regional", { "modal-character-select": "liu_biao", "regional-type": "edict" }]],
};
const CONTEXTS = {
  scarce: { stats: { authority: 45, prestige: 45, officials: 45, security: 55, treasury: 1, caoAlert: 45 }, weights: { treasury: 6, authority: 1, officials: .6, security: .3, caoAlert: -.4, leakRisk: -.4 } },
  high_alert: { stats: { authority: 45, prestige: 45, officials: 45, security: 35, treasury: 30, caoAlert: 82 }, weights: { security: 3, caoAlert: -4, authority: .3, officials: .3, treasury: .1, leakRisk: -2 } },
  authority: { stats: { authority: 25, prestige: 45, officials: 42, security: 55, treasury: 35, caoAlert: 45 }, weights: { authority: 4, officials: 1, treasury: .1, caoAlert: -.4, security: .4, leakRisk: -.6 } },
};
const samples = Number(process.env.BALANCE_SAMPLES || 24);
assert.ok(Number.isInteger(samples) && samples > 0 && samples <= 64);
const seeds = Array.from({ length: samples }, (_, index) => Math.imul(index + 1, 2654435761) >>> 0);
const rows = [];
function prepare(seed, adviserMode, context) {
  const r = harness(); r.api.startNewGame("standard", "jianan_196", { randomSeed: seed });
  r.mount("quarterly-agenda", "council-advice");
  r.decide(1);
  const beforeAdoption = plain(r.api.getState());
  if (adviserMode !== "none") {
    assert.equal(r.window.XianQuarterlyAgenda.selectAgenda("steady_court"), true);
    assert.equal(r.window.XianCouncilAdvice.chooseAdvice("empress_fu"), true);
  }
  const adoption = { adviserId: r.window.XianCouncilAdvice.getState().chosen?.id || null,
    stats: Object.fromEntries(Object.keys(beforeAdoption.stats).map(key => [key, r.api.getState().stats[key] - beforeAdoption.stats[key]])),
    leakRisk: r.api.getState().hidden.leakRisk - beforeAdoption.hidden.leakRisk };
  if (adviserMode === "exhausted") {
    assert.equal(r.act(...audience("yang_biao")), true);
    assert.equal(r.act(...audience("dong_cheng")), true);
    assert.equal(r.window.XianCouncilAdvice.getState().chosen.alignedActions, 2);
  }
  r.api.endTurn(); r.decide(1);
  const core = r.api.getState();
  // Explicit controlled starting positions isolate marginal action choices. They are not campaign outcomes.
  r.replaceCore({ eventResolved: true, stats: { ...core.stats, ...context.stats },
    hidden: { ...core.hidden, loyalNetwork: 20, leakRisk: 20, externalBalance: 15, escapeRoute: 15, peopleStability: 45 },
    relations: Object.fromEntries(Object.keys(core.relations).map(key => [key, 50])) });
  return { r, adoption };
}
for (const [contextId, context] of Object.entries(CONTEXTS)) for (const adviserMode of ["none", "chosen", "exhausted"]) {
  for (const [policy, actions] of Object.entries(POLICIES)) for (const seed of seeds) {
    const { r, adoption } = prepare(seed, adviserMode, context), before = plain(r.api.getState());
    const trace = []; let spent = 0;
    for (const [actionId, fields] of actions) {
      const core = r.api.getState(), plan = r.window.XianActionPlans.build(actionId, fields, core);
      const success = r.act(actionId, fields);
      const reason = success ? null : !plan ? "invalid-plan" : !plan.affordable ? "treasury-shortfall" : !core.actionPoints ? "no-action-point" : core.ended ? "ended" : "handler-rejected";
      if (success) { spent += plan.cost; assert.equal(r.api.getState().totalActions, core.totalActions + 1); }
      trace.push({ actionId, fields, success, reason, plan: plain(plan), adviserUsesAfter: r.window.XianCouncilAdvice.getState().chosen?.alignedActions || 0 });
    }
    const after = r.api.getState(), delta = { ...Object.fromEntries(Object.keys(after.stats).map(key => [key, after.stats[key] - before.stats[key]])),
      ...Object.fromEntries(Object.keys(after.hidden).map(key => [key, after.hidden[key] - before.hidden[key]])) };
    const objective = Object.entries(context.weights).reduce((sum, [key, weight]) => sum + (delta[key] || 0) * weight, 0);
    rows.push({ context: contextId, adviserMode, policy, seed, rulesVersion: after.rulesVersion, budget: 2,
      before: { stats: before.stats, hidden: before.hidden }, after: { stats: after.stats, hidden: after.hidden },
      adoption, adviserUsesBefore: adviserMode === "exhausted" ? 2 : 0, adviserUsesAfter: r.window.XianCouncilAdvice.getState().chosen?.alignedActions || 0,
      spent, successfulActions: after.totalActions - before.totalActions, failedActions: trace.filter(item => !item.success).length,
      relationDelta: Object.fromEntries(Object.keys(after.relations).filter(key => after.relations[key] !== before.relations[key]).map(key => [key, after.relations[key] - before.relations[key]])),
      delta, objective: Math.round(objective * 100) / 100, trace });
  }
}
const cells = Object.entries(CONTEXTS).flatMap(([context]) => ["none", "chosen", "exhausted"].flatMap(adviserMode => Object.keys(POLICIES).map(policy => {
  const runs = rows.filter(row => row.context === context && row.adviserMode === adviserMode && row.policy === policy);
  const mean = key => Math.round(runs.reduce((sum, row) => sum + row[key], 0) / runs.length * 100) / 100;
  return { context, adviserMode, policy, samples: runs.length, objective: mean("objective"), spent: mean("spent"), failedActions: runs.reduce((sum, row) => sum + row.failedActions, 0),
    delta: runs[0].delta, relationDelta: runs[0].relationDelta };
})));
const winners = Object.keys(CONTEXTS).map(context => ({ context, policy: cells.filter(cell => cell.context === context && cell.adviserMode === "none")
  .sort((a, b) => b.objective - a.objective || a.policy.localeCompare(b.policy))[0].policy }));
assert.deepEqual(winners.map(item => item.policy), ["audience_finance", "safety_repair", "audience_ritual"]);
for (const mode of ["none", "chosen", "exhausted"]) {
  const same = rows.find(row => row.context === "authority" && row.adviserMode === mode && row.policy === "same_person");
  const rotation = rows.find(row => row.context === "authority" && row.adviserMode === mode && row.policy === "same_faction_rotation");
  assert.deepEqual(same.delta, rotation.delta, "rotation must not recover national benefits");
  assert.equal(same.relationDelta.yang_biao, 6); assert.equal(rotation.relationDelta.yang_biao + rotation.relationDelta.dong_cheng, 8);
}
const report = { kind: "controlled-two-action-comparison", samples, seeds, contexts: CONTEXTS, policies: POLICIES,
  method: "Three explicit controlled positions; two AP; real action confirmations. Actual empress adviser adoption is recorded; exhausted case consumes two real uses in prior month. Preset positions equalize national metrics before the marginal comparison. No claimed player win rate or campaign ending.",
  winners, cells, rows };
const output = process.env.BALANCE_OUTPUT || path.resolve(__dirname, "../../audience-balance-v225.json");
fs.writeFileSync(output, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ output, runs: rows.length, cells: cells.length, failuresRetained: rows.reduce((sum, row) => sum + row.failedActions, 0), winners }));
