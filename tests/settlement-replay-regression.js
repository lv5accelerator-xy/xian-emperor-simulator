"use strict";
const assert = require("node:assert/strict");
const { harness, plain, CORE_KEY } = require("./helpers/game-harness");

// Final treasury spending changes the medal; unused AP can also complete a final-month goal.
const fiscal = harness();
fiscal.window.XianShortChallenges.start("white_horse");
let core = fiscal.api.getState();
const beforeFiscal = fiscal.replaceCore({ turn: 6, eventResolved: true, actionPoints: 0,
  stats: { ...core.stats, authority: 40, treasury: 25, caoAlert: 60 }, hidden: { ...core.hidden, leakRisk: 0 } });
assert.equal(fiscal.window.XianShortChallenges.evaluateChallenge(fiscal.window.XianShortChallenges.getChallenges()[0], beforeFiscal).medal, "gold");
fiscal.api.endTurn();
let result = fiscal.window.XianShortChallenges.getState().results[0];
assert.equal(fiscal.api.getState().stats.treasury, 24, "final month must spend treasury before grading");
assert.equal(result.medal, "silver");
assert.equal(result.checks.find(item => item.path === "stats.treasury").value, 24);
assert.ok(fiscal.api.getState().reports.some(item => item.title === "月末结算" && item.turn === 6));
const finalReport = fiscal.window.XianMonthlyReport.buildMonthlyReport(beforeFiscal, fiscal.api.getState(), beforeFiscal);
assert.equal(finalReport.statChanges.find(item => item.key === "treasury").after, result.checks.find(item => item.path === "stats.treasury").value);
fiscal.api.endTurn();
assert.equal(fiscal.window.XianShortChallenges.getState().results.length, 1, "ending must not grade twice");

const interrupted = harness(); interrupted.window.XianShortChallenges.start("white_horse"); core = interrupted.api.getState();
interrupted.replaceCore({ turn: 6, eventResolved: true, actionPoints: 0, monthlySettledTurn: 6,
  stats: { ...core.stats, authority: 40, treasury: 24, caoAlert: 60 }, hidden: { ...core.hidden, leakRisk: 0 } });
interrupted.api.endTurn();
assert.equal(interrupted.api.getState().stats.treasury, 24, "resuming between month settlement and grading cannot charge the month twice");

const guards = harness();
guards.window.XianShortChallenges.start("xudu_mutiny"); core = guards.api.getState();
guards.replaceCore({ turn: 5, eventResolved: true, actionPoints: 1,
  stats: { ...core.stats, security: 41, officials: 42, caoAlert: 82 }, hidden: { ...core.hidden, leakRisk: 0 } });
guards.api.endTurn();
assert.equal(guards.window.XianShortChallenges.getState().results[0].medal, "gold", "last-month cautious governance must count toward palace security");
assert.equal(guards.api.getState().stats.security, 42);

// Use the real quarterly module, registered after short challenges as in index.html.
const quarterly = harness();
quarterly.window.XianShortChallenges.start("white_horse"); core = quarterly.api.getState();
quarterly.replaceCore({ turn: 4, eventResolved: true, actionPoints: 0, stats: { ...core.stats, treasury: 12 }, hidden: { ...core.hidden, leakRisk: 0 } });
quarterly.load("quarterly-agenda"); quarterly.window.XianQuarterlyAgenda.refresh();
assert.equal(quarterly.window.XianQuarterlyAgenda.selectAgenda("restore_treasury"), true);
core = quarterly.api.getState();
quarterly.replaceCore({ turn: 6, eventResolved: true, actionPoints: 0, stats: { ...core.stats, treasury: 25, authority: 40, caoAlert: 60 } });
quarterly.api.endTurn();
const quarterState = quarterly.window.XianQuarterlyAgenda.getState();
assert.equal(quarterState.history[0].success, true);
const reward = quarterly.window.XianQuarterlyAgenda.agendas.find(item => item.id === "restore_treasury").success.effects.treasury;
assert.equal(quarterly.api.getState().stats.treasury, 24 + reward, "quarter rewards must precede the final challenge grade");
assert.equal(quarterly.window.XianShortChallenges.getState().results[0].checks.find(item => item.path === "stats.treasury").value, 24 + reward);

const collapse = harness({}, 0);
collapse.window.XianShortChallenges.start("xudu_mutiny"); core = collapse.api.getState();
collapse.replaceCore({ turn: 5, eventResolved: true, actionPoints: 0,
  stats: { ...core.stats, security: 2, officials: 70, caoAlert: 45 }, hidden: { ...core.hidden, leakRisk: 90 } });
collapse.api.endTurn(); result = collapse.window.XianShortChallenges.getState().results[0];
assert.equal(collapse.api.getState().ending.title, "深宫幽闭");
assert.equal(result.endedEarly, true); assert.equal(result.medal, "none"); assert.equal(result.score, 0);
assert.equal(collapse.window.XianShortChallenges.getState().rewards.length, 0, "fatal last-month risk cannot award a successful challenge reward");

// Receipts use clamped, actual changes and remain readable after loading.
const feedback = harness(); feedback.api.startNewGame(); core = feedback.api.getState();
feedback.replaceCore({ eventResolved: true, stats: { ...core.stats, authority: 99 } });
feedback.api.performExternalAction({ title: "试行<诏>", text: "计划提高5点。", effects: { authority: 5, treasury: -3 }, hidden: { leakRisk: 2 }, relations: { cao_cao: 4 } });
let receipt = feedback.api.getState().reports.find(item => item.outcome?.kind === "action");
assert.equal(receipt.outcome.stats.find(item => item.key === "authority").delta, 1, "caps must not create a fictitious full reward");
assert.equal(receipt.outcome.actionPointsSpent, 1);
assert.match(feedback.node("action-feedback").innerHTML, /净支出 3/);
assert.match(feedback.node("action-feedback").innerHTML, /99 → 100/);
assert.match(feedback.node("action-feedback").innerHTML, /试行&lt;诏&gt;/);
assert.match(feedback.node("action-feedback").innerHTML, /泄密风险：上升/);
feedback.node("continue-game-btn").click();
assert.deepEqual(plain(feedback.api.getState().reports[0].outcome), plain(receipt.outcome));
feedback.document.addEventListener("xian:external-action-completed", () => {
  feedback.api.applyExternalPackage({ effects: { treasury: 1 }, causal: false });
  const causality = feedback.api.getState().causality;
  causality.pending.push({ id: "feedback-follow-up", source: "度支复核", text: "下月复核钱粮。", dueTurn: 2 });
  feedback.api.updateCausality(causality);
});
feedback.api.performExternalAction({ title: "度支", text: "原文含税额10%。", effects: { treasury: -3 } });
receipt = feedback.api.getState().reports.find(item => item.outcome?.kind === "action");
assert.equal(receipt.outcome.stats.find(item => item.key === "treasury").delta, -2, "receipt must include synchronous political replies");
assert.equal(receipt.outcome.followUps[0].dueTurn, 2);
const noAp = feedback.api.getState();
assert.equal(feedback.api.performExternalAction({ title: "重复", effects: { treasury: 10 } }), false);
assert.deepEqual(plain(feedback.api.getState()), plain(noAp));
const estimated = feedback.window.XianMonthlyReport.buildMonthlyReport(noAp, noAp, noAp);
assert.equal(estimated.operations.find(item => item.title === "度支").executionSource, "estimated", "an unrelated percentage is not an execution record");
assert.equal(estimated.hasEstimates, true);
assert.match(feedback.window.XianMonthlyReport.buildReportHtml(estimated), /估计/);
assert.match(feedback.window.XianMonthlyReport.buildReportHtml(estimated), /实际公开变化/);

// Same weekly seed and action sequence, even with different ambient randomness and timestamps.
function meaningfulState(api) {
  const value = api.getState();
  return plain({ turn: value.turn, currentEventId: value.currentEventId, stats: value.stats, hidden: value.hidden, relations: value.relations,
    random: value.random, actionPoints: value.actionPoints, totalActions: value.totalActions, edictsIssued: value.edictsIssued, ending: value.ending });
}
function continueRun(run, months) {
  const trace = [];
  for (let index = 0; index < months && !run.api.getState().ended; index += 1) {
    if (!run.api.getState().eventResolved) run.decide(0);
    run.flush();
    const beforePreview = plain(run.api.getState().random);
    for (let preview = 0; preview < 4; preview += 1) run.api.previewEdict("安抚曹操。", run.api.getState());
    assert.deepEqual(plain(run.api.getState().random), beforePreview, "previews cannot reroll the challenge stream");
    run.edict("安抚曹操。");
    run.flush();
    const saved = JSON.parse(run.localStorage.getItem(CORE_KEY));
    assert.equal(saved.edictsIssued, run.api.getState().edictsIssued, "edict count must be persisted with its random result");
    const monthly = run.window.XianMonthlyReport.buildMonthlyReport(run.api.getState(), run.api.getState(), run.api.getState());
    const edictOperation = monthly.operations.find(item => item.kind === "自由圣旨");
    assert.equal(edictOperation.executionSource, "recorded");
    assert.match(run.window.XianMonthlyReport.buildReportHtml(monthly), /记录/);
    run.api.endTurn(); run.flush(); trace.push(meaningfulState(run.api));
  }
  return trace;
}
const first = harness({}, .01);
const code = first.window.XianWeeklyChallenge.codeForWeek("2026W41");
const definition = first.window.XianWeeklyChallenge.buildDefinition(code);
assert.ok(Number.isInteger(definition.randomSeed));
first.window.XianShortChallenges.startCustom(definition);
const initial = meaningfulState(first.api);
const firstHalf = continueRun(first, 2);
assert.equal(firstHalf.length, 2);
const checkpoint = first.stores();
const secondHalf = continueRun(first, 4);
assert.equal(secondHalf.length, 4, "the replay fixture must complete all six months");
const fresh = harness({}, .97);
fresh.window.XianShortChallenges.startCustom(fresh.window.XianWeeklyChallenge.buildDefinition(code));
assert.deepEqual(meaningfulState(fresh.api), initial);
assert.equal(fresh.api.getRandomKey("world"), first.api.getRandomKey("world"), "subsystem randomness cannot depend on opening time");
assert.deepEqual(continueRun(fresh, 6), [...firstHalf, ...secondHalf]);
const resumed = harness(checkpoint, .67); resumed.node("continue-game-btn").click();
assert.deepEqual(continueRun(resumed, 4), secondHalf, "reload must retain random state and final-month results");
const imported = harness({}, .45);
const envelope = { format: "xian-emperor-full-save", stores: Object.fromEntries(Object.entries(checkpoint).map(([key, value]) => [key, JSON.parse(value)])) };
imported.node("import-file").dispatchEvent({ type: "change", target: { value: "save.json", files: [{ text: JSON.stringify(envelope) }] } });
const afterImport = harness(imported.stores(), .84); afterImport.node("continue-game-btn").click();
assert.deepEqual(continueRun(afterImport, 4), secondHalf, "full save import must retain both core RNG and active challenge state");
const legacy = harness(checkpoint); const oldCore = JSON.parse(legacy.localStorage.getItem(CORE_KEY)); delete oldCore.random;
legacy.localStorage.setItem(CORE_KEY, JSON.stringify(oldCore)); legacy.node("continue-game-btn").click();
assert.equal(legacy.api.getState().random, null, "ongoing legacy runs must not silently restart a seeded stream");
assert.equal(legacy.api.getRandomKey("capture", "legacy-siege-captive"), "legacy-siege-captive", "unseeded runs retain their original subsystem keys");

// Load the actual world, army, diplomacy, court and campaign watchers together.
function engineState(run) {
  const world = JSON.parse(run.localStorage.getItem("xian_emperor_world_v020") || "null");
  const strategy = run.window.XianStrategyNetwork.getState();
  const army = run.window.XianArmySystem.getState();
  const court = run.window.XianCourtPolitics.diagnostics();
  const evolution = run.window.XianCampaignEvolution.getState();
  return plain({ core: meaningfulState(run.api), world: world && { regions: world.regions, lords: world.lords },
    strategy: strategy && { cities: strategy.cities, routes: strategy.routes, strategies: strategy.strategies },
    armies: army?.armies, court: court && { factions: court.factions, petitions: court.petitions.map(item => ({ templateId: item.templateId, turn: item.turn, status: item.status })) },
    evolution: evolution && { currentStage: evolution.currentStage, completedStages: evolution.completedStages, environment: evolution.environment } });
}
const engineA = harness({}, .08); engineA.loadEngine(); engineA.window.XianShortChallenges.startCustom(definition); engineA.flush();
const engineFirstHalf = continueRun(engineA, 2); const engineCheckpoint = engineA.stores();
const engineRest = continueRun(engineA, 4); const engineFinal = engineState(engineA);
assert.equal(engineRest.length, 4);
assert.equal(engineA.api.getState().monthlySettledTurn, 6);
assert.equal(engineA.window.XianWorldSystem.getState().lastProcessedTurn, 7, "world must settle the terminal month before grading");
assert.equal(engineA.window.XianStrategyNetwork.getState().lastProcessedTurn, 7);
assert.equal(engineA.window.XianArmySystem.getState().lastProcessedTurn, 7);
const engineB = harness({}, .91); engineB.loadEngine(); engineB.window.XianShortChallenges.startCustom(definition); engineB.flush();
assert.deepEqual(continueRun(engineB, 6), [...engineFirstHalf, ...engineRest], "full engine must replay despite different opening clocks and ambient random IDs");
assert.deepEqual(engineState(engineB), engineFinal);
const engineReload = harness(engineCheckpoint, .72); engineReload.loadEngine(); engineReload.node("continue-game-btn").click(); engineReload.flush();
assert.deepEqual(continueRun(engineReload, 4), engineRest);
assert.deepEqual(engineState(engineReload), engineFinal, "all systems must retain the same seeded outcome after reload");

console.log("Settlement, actual feedback, seeded replay, reload and full-save import regression passed.");
