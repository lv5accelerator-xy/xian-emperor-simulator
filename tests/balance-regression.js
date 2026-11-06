"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path");
const { harness } = require("./helpers/game-harness");

// Paired seeds, actual event buttons and common-action confirmations; no stat patches.
const POLICIES = {
  cautious: { name: "守成", weights: { security: 1.4, officials: 1, treasury: .6, caoAlert: -1, leakRisk: -1, authority: .4 } },
  welfare: { name: "民生", weights: { prestige: 1, peopleStability: 1.6, officials: .7, treasury: .4, security: .4, caoAlert: -.5 } },
  intrigue: { name: "密谋", weights: { loyalNetwork: 1.6, escapeRoute: .6, authority: .5, security: .5, leakRisk: -.5, caoAlert: -.5 } },
  rotation: { name: "轮换召见", weights: { security: 1.4, officials: 1, treasury: .6, caoAlert: -1, leakRisk: -1, authority: .4 } },
};
function targetFor(run, action, preferred) {
  const core = run.api.getState();
  if (!run.window.XianCharacterAvailability) return preferred;
  const available = run.window.XianCharacterAvailability.availableCharacters(core, { action });
  return available.find(item => item.id === preferred)?.id || available[0]?.id;
}
function actChecked(run, actionId, fields, attempts) {
  const core = run.api.getState(), plan = run.window.XianActionPlans.build(actionId, fields, core);
  const success = run.act(actionId, fields);
  const reason = !plan ? "无有效行动计划／对象" : !plan.affordable ? "国库不足" : !core.actionPoints ? "行动点不足" : core.ended ? "本局已结束" : "处理器拒绝";
  attempts.push({ turn: core.turn, actionId, fields, success, ...(!success ? { reason } : { cost: plan.cost }) });
  assert.ok(success, `${actionId} strategy action did not execute: ${reason}`);
  return success;
}

function scoreChoice(choice, weights) {
  return Object.entries({ ...choice.effects, ...choice.hidden }).reduce((sum, [key, value]) => sum + Number(value) * (weights[key] || 0), 0);
}

function goalWeights(definition, core) {
  const weights = { ...POLICIES.cautious.weights, caoAlert: core.stats.caoAlert >= 78 ? -3 : -1 };
  for (const goal of definition.goals) {
    const [group, key] = goal.path.split(".");
    const value = core[group][key];
    if (goal.min != null && value < goal.min) weights[key] = 4;
    if (goal.max != null && value > goal.max - 5) weights[key] = -4;
  }
  return weights;
}

function fillGoal(run, definition, attempts) {
  const core = run.api.getState();
  if (core.ended) return;
  const missing = definition.goals.filter(goal => goal.min != null && goal.path.split(".").reduce((value, key) => value[key], core) < goal.min);
  const paths = new Set(missing.map(goal => goal.path));
  if (paths.has("stats.treasury")) actChecked(run, "revenue", { "revenue-method": "audit" }, attempts);
  else if (core.stats.caoAlert >= 80) actChecked(run, "appease", { "appease-type": "praise" }, attempts);
  else if (paths.has("hidden.loyalNetwork") && core.hidden.leakRisk < 50) actChecked(run, "secret", { "modal-character-select": targetFor(run, "secret", "dong_cheng"), "modal-secret-type": "intelligence" }, attempts);
  else if (paths.has("stats.authority") && core.stats.treasury >= 4) actChecked(run, "ritual", { "ritual-type": "court" }, attempts);
  else if (paths.has("stats.officials") && core.stats.treasury >= 3) actChecked(run, "ritual", { "ritual-type": "lecture" }, attempts);
  else if (paths.has("stats.prestige") && core.stats.treasury >= 5) actChecked(run, "ritual", { "ritual-type": "temple" }, attempts);
  else if (paths.has("hidden.peopleStability") && core.stats.treasury >= 4) actChecked(run, "relief", { "relief-level": "small" }, attempts);
}

function runChallenge(definition, policyId, seed) {
  const run = harness(); run.loadMechanics();
  run.window.XianShortChallenges.startCustom({ ...definition, kind: "balance", randomSeed: seed }); run.flush();
  const policy = POLICIES[policyId];
  const trace = [], attempts = []; let spent = 0; let raised = 0;
  for (let month = 0; month < definition.duration && !run.api.getState().ended; month++) {
    const choices = run.api.getCurrentEvent().choices;
    const weights = policyId === "goalAware" ? goalWeights(definition, run.api.getState()) : policy.weights;
    const index = choices.map((choice, index) => ({ index, score: scoreChoice(choice, weights) }))
      .sort((a, b) => b.score - a.score || a.index - b.index)[0].index;
    run.decide(index); run.flush();
    let core = run.api.getState();
    if (policyId === "goalAware") { fillGoal(run, definition, attempts); run.flush(); }
    else if (!core.ended && policyId !== "cautious") {
      if (policyId === "rotation") {
        const people = run.window.XianCharacterAvailability?.availableCharacters(core, { action: "audience" })
          || run.window.GAME_DATA.characters.filter(item => item.id !== "liu_xie");
        const loyalists = people.filter(item => item.faction === "han_loyalists");
        for (const person of loyalists.slice(0, 2)) actChecked(run, "audience", { "modal-character-select": person.id, "audience-mode": "public" }, attempts);
      } else if (policyId === "welfare") {
        if (core.stats.treasury < 10) actChecked(run, "revenue", { "revenue-method": "audit" }, attempts);
        else actChecked(run, "relief", { "relief-level": "small" }, attempts);
      } else if (core.hidden.leakRisk >= 50 || core.stats.security <= 28 || core.stats.caoAlert >= 75) {
        actChecked(run, "audience", { "modal-character-select": targetFor(run, "audience", "xun_yu"), "audience-mode": "public" }, attempts);
      } else actChecked(run, "secret", { "modal-character-select": targetFor(run, "secret", "dong_cheng"), "modal-secret-type": "intelligence" }, attempts);
      run.flush();
    }
    run.api.endTurn(); run.flush();
    core = run.api.getState();
    const receipts = core.reports.filter(item => item.turn === month + 1 && item.outcome);
    for (const receipt of receipts) {
      const delta = receipt.outcome.stats.find(item => item.key === "treasury")?.delta || 0;
      spent += Math.max(0, -delta); raised += Math.max(0, delta);
    }
    trace.push({ turn: core.turn, settled: core.monthlySettledTurn, treasury: core.stats.treasury });
  }
  const core = run.api.getState();
  const result = run.window.XianShortChallenges.getState().results[0];
  assert.ok(core.ended && result, "every simulation must reach a real ending and challenge grade");
  if (!result.endedEarly) assert.equal(core.monthlySettledTurn, definition.duration, "every completed short run must settle its final month");
  for (const check of result.checks) {
    assert.equal(check.value, check.path.split(".").reduce((value, key) => value[key], core));
  }
  return { seed, challenge: definition.id, policy: policyId, medal: result.medal, endedEarly: result.endedEarly, completed: result.completed, checks: result.checks,
    stats: core.stats, stability: core.hidden.peopleStability, network: core.hidden.loyalNetwork,
    leak: core.hidden.leakRisk, spent, raised, actions: core.totalActions, ending: core.ending.title, trace, attempts,
    failedActions: attempts.filter(item => !item.success) };
}

function simulate(samples = 24) {
  assert.ok(Number.isInteger(samples) && samples > 0 && samples <= 64);
  const definitions = harness().window.XianShortChallenges.getChallenges();
  const cells = [];
  for (const definition of definitions) for (const [id, policy] of Object.entries(POLICIES)) {
    const runs = Array.from({ length: samples }, (_, index) => runChallenge(definition, id, (index + 1) * 2654435761 >>> 0));
    const mean = key => Math.round(runs.reduce((sum, run) => sum + run[key], 0) / samples * 10) / 10;
    const failedGoals = Object.fromEntries(definition.goals.map(goal => [goal.label, runs.filter(run => !run.checks.find(item => item.path === goal.path).passed).length]));
    cells.push({ challenge: definition.id, name: definition.name, policy: id, policyName: policy.name, samples,
      gold: runs.filter(run => run.medal === "gold").length, completed: runs.filter(run => !run.endedEarly).length,
      spent: mean("spent"), raised: mean("raised"), actions: mean("actions"), stability: mean("stability"),
      network: mean("network"), leak: mean("leak"), treasury: Math.round(runs.reduce((sum, run) => sum + run.stats.treasury, 0) / samples * 10) / 10,
      failedGoals, runs, earlyEndings: Object.fromEntries([...new Set(runs.filter(run => run.endedEarly).map(run => run.ending))]
        .map(ending => [ending, runs.filter(run => run.endedEarly && run.ending === ending).length])) });
  }
  const controls = definitions.map(definition => {
    const runs = Array.from({ length: samples }, (_, index) => runChallenge(definition, "goalAware", (index + 1) * 2654435761 >>> 0));
    const gold = runs.filter(run => run.medal === "gold").length;
    assert.ok(gold > 0, `${definition.name} must remain achievable with actual goal-aware decisions`);
    return { challenge: definition.id, name: definition.name, samples, gold, completed: runs.filter(run => !run.endedEarly).length, runs };
  });
  const intrigue = cells.filter(cell => cell.policy === "intrigue");
  assert.ok(intrigue.some(cell => cell.gold > 0) && intrigue.some(cell => cell.gold < cell.samples), "intrigue must have both a suitable challenge and real tradeoffs");
  for (const definition of definitions) {
    const cautious = cells.find(cell => cell.challenge === definition.id && cell.policy === "cautious");
    const welfare = cells.find(cell => cell.challenge === definition.id && cell.policy === "welfare");
    assert.ok(welfare.spent > cautious.spent, "welfare must retain its real financial cost");
    assert.ok(welfare.stability >= cautious.stability, "welfare must buy an actual public-welfare benefit");
  }
  return { samples, policies: Object.fromEntries(Object.entries(POLICIES).map(([id, policy]) => [id, policy.name])), cells, controls };
}

if (require.main === module) {
  const report = simulate(Number(process.env.BALANCE_SAMPLES || 24));
  if (process.env.BALANCE_REPORT) {
    const target = path.resolve(process.env.BALANCE_REPORT);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, JSON.stringify(report, null, 2));
  }
  if (!process.argv.includes("--json")) {
    for (const cell of report.cells) console.log(`${cell.name} / ${cell.policyName}: gold ${cell.gold}/${cell.samples}, completed ${cell.completed}/${cell.samples}, spent ${cell.spent}, treasury ${cell.treasury}`);
  } else console.log(JSON.stringify(report, null, 2));
}
module.exports = { simulate, runChallenge };
