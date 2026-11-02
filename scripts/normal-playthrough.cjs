"use strict";
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict");
const { harness, plain } = require("../tests/helpers/game-harness");
const output = process.env.NORMAL_OUTPUT || path.resolve(__dirname, "../../normal-playthrough.json");
const seeds = [20261017, 2654435761, 42424242];
const scenarios = harness().window.GAME_DATA.scenarios;
const rows = [];
const click = (run, attribute, value) => run.document.dispatchEvent({ type: "click", target: { closest: selector => selector === `[data-${attribute}]`
  ? { dataset: { [attribute.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())]: value } } : null } });
function scorePackage(pkg, core) {
  const weights = { authority: core.stats.authority < 45 ? 2 : .7, security: core.stats.security < 45 ? 3 : .7,
    treasury: core.stats.treasury < 28 ? 3 : .6, officials: core.stats.officials < 40 ? 2 : .6,
    prestige: core.stats.prestige < 40 ? 2 : .5, caoAlert: core.stats.caoAlert > 65 ? -4 : -.9,
    peopleStability: core.hidden.peopleStability < 40 ? 1.5 : .3, leakRisk: core.hidden.leakRisk > 35 ? -3 : -.6,
    externalBalance: .3, loyalNetwork: .2 };
  return Object.entries({ ...pkg.effects, ...pkg.hidden }).reduce((sum, [key, delta]) => sum + delta * (weights[key] || 0), 0);
}
function snapshot(run, turn, phase) {
  const core = run.api.getState(), armies = run.window.XianArmySystem.getState(), campaign = run.window.XianCampaignEvolution.getState();
  return { turn, phase, stats: core.stats, hidden: core.hidden, random: core.random, courtMetrics: core.causality.metrics,
    army: { court: Object.values(armies?.armies || {}).filter(army => army.owner === "court"),
      orders: armies?.orders.length || 0, battles: armies?.battleReports.length || 0,
      conquests: armies?.conquests.length || 0, sieges: Object.values(armies?.sieges || {}).map(siege => ({ cityId: siege.cityId, status: siege.status, progress: siege.progress })) },
    campaign: { stage: campaign?.currentStage, completed: campaign?.completedStages || [] },
    progression: run.window.XianImperialProgress.getState().session,
    quarters: run.window.XianQuarterlyAgenda.getState(), imperialPath: run.window.XianImperialPaths.getState() };
}
for (const scenario of scenarios) for (const seed of seeds) {
  const run = harness(); run.loadMechanics(); run.load("command-center");
  run.api.startNewGame("standard", scenario.id, { randomSeed: seed });
  click(run, "path-select", "guard");
  const trace = [], settlements = [], checkpoints = [snapshot(run, 1, "start")];
  let treasurySpent = 0, armyOrdered = false;
  run.document.addEventListener("xian:settlement-completed", event => {
    const detail = event.detail;
    settlements.push({ turn: detail.after.turn, treasury: detail.after.stats.treasury, stages: detail.settlement?.stages || detail.settlement?.phases || [] });
    checkpoints.push(snapshot(run, detail.after.turn, "settled"));
  });
  while (!run.api.getState().ended) {
    let core = run.api.getState(); assert.ok(core.turn <= scenario.maxTurns, "normal trajectory cannot overrun the scenario");
    const choices = run.api.getCurrentEvent().choices;
    const decision = choices.map((choice, index) => ({ index, score: scorePackage(choice, core) }))
      .sort((a, b) => b.score - a.score || a.index - b.index)[0].index;
    trace.push({ turn: core.turn, kind: "decision", eventId: core.currentEventId, choice: decision });
    run.decide(decision);
    if (run.api.getState().ended) break;
    const quarter = run.window.XianQuarterlyAgenda;
    if (!quarter.getState().active && quarter.getState().offers.length) quarter.selectAgenda(quarter.getState().offers[0]);
    const council = run.window.XianCouncilAdvice;
    if (quarter.getState().active && !council.getState().chosen) {
      const speaker = council.buildAdvice().find(item => item.affordable);
      if (speaker) { treasurySpent += speaker.cost; council.chooseAdvice(speaker.id); }
    }
    const progress = run.window.XianImperialProgress.getState();
    if (progress.session.pendingArc) {
      const pending = progress.session.pendingArc;
      const chapter = run.window.XianImperialProgress.data.arcs.find(arc => arc.id === pending.arcId).chapters[pending.chapterIndex];
      const chosen = chapter.choices.map((choice, index) => ({ choice, index, score: scorePackage(choice, run.api.getState()) }))
        .filter(item => run.api.canAffordEffects(item.choice.effects).ok).sort((a, b) => b.score - a.score || a.index - b.index)[0];
      if (chosen) { treasurySpent += Math.max(0, -Number(chosen.choice.effects?.treasury || 0)); click(run, "arc-choice", String(chosen.index)); }
    }
    const imperial = run.window.XianImperialPaths;
    if (imperial.getState().unlocked && !imperial.getState().active) imperial.choosePath(imperial.getState().offers[0]);
    for (const judgment of run.window.XianArmySystem.getState().pendingJudgments || []) run.window.XianArmySystem.resolvePostwarJudgment(judgment.id, "pacify");
    core = run.api.getState();
    if (!armyOrdered && core.turn >= 2 && core.actionPoints) {
      const target = "luoyang", city = run.window.XianStrategyNetwork.getState().cities[target];
      const task = city.controller === "court" ? "defend" : "attack";
      const preview = run.window.XianArmySystem.previewMapOrder("han_palace_guard", target, task);
      if (preview.ok) {
        const result = run.window.XianArmySystem.issueMapOrder("han_palace_guard", target, task);
        if (result.ok) { armyOrdered = true; treasurySpent += preview.treasuryCost; trace.push({ turn: core.turn, kind: "army", task, target }); }
      }
    }
    for (let action = 0; action < 2 && !run.api.getState().ended; action++) {
      core = run.api.getState(); if (!core.actionPoints) break;
      const recommendation = run.window.XianCommandCenter.recommendAction(core);
      if (!recommendation.fields || recommendation.actionId === "end") break;
      const plan = run.window.XianActionPlans.build(recommendation.actionId, recommendation.fields, core);
      if (!plan?.affordable || !run.act(plan.actionId, plan.fields)) break;
      treasurySpent += plan.cost;
      trace.push({ turn: core.turn, kind: "action", actionId: plan.actionId, fields: plan.fields, cost: plan.cost,
        ordinal: plan.repetition.ordinal, adviser: plan.advice?.adviserId || null });
    }
    if (!run.api.getState().ended) run.api.endTurn();
  }
  const final = run.api.getState();
  checkpoints.push(snapshot(run, final.turn, "ending"));
  const pick = fraction => checkpoints.filter(point => point.turn <= Math.max(1, Math.round(scenario.maxTurns * fraction))).at(-1) || checkpoints[0];
  rows.push({ scenario: scenario.id, seed, deadline: scenario.maxTurns, finalTurn: final.turn, early: final.turn < scenario.maxTurns,
    ending: final.ending.title, treasurySpent, actionDistribution: trace.filter(item => item.kind === "action").reduce((counts, item) => ({ ...counts, [item.actionId]: (counts[item.actionId] || 0) + 1 }), {}),
    stages: { early: pick(.2), middle: pick(.5), late: pick(.9), final: checkpoints.at(-1) }, checkpoints, settlements, trace });
  console.log(JSON.stringify({ scenario: scenario.id, seed, turn: final.turn, ending: final.ending.title, treasury: final.stats.treasury, treasurySpent,
    campaignStages: rows.at(-1).stages.final.campaign.completed.length, armyOrders: rows.at(-1).stages.final.army.orders, conquests: rows.at(-1).stages.final.army.conquests }));
  fs.writeFileSync(output, JSON.stringify({ rulesVersion: final.rulesVersion, seeds, policy: "risk-aware actual choices, quarterly advisers, guard progression, one court army order, shared action recommendation", rows }, null, 2));
}
assert.equal(rows.length, 15);
assert.ok(rows.every(row => row.stages.early && row.stages.middle && row.stages.final));
console.log(`PASS ${rows.length} complete normal-scenario trajectories; ${rows.filter(row => !row.early).length} reached the deadline.`);
