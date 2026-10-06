"use strict";
const assert = require("node:assert/strict");
const { harness, plain } = require("./helpers/game-harness");
function checkTotals(ledger) {
  for (const row of ledger.rows) {
    const sum = row.sources.reduce((total, source) => total + source.delta, 0);
    assert.ok(Math.abs(row.actual - row.before - sum) < .000001, `${row.name}: all recorded sources must sum to actual change`);
    assert.ok(Math.abs(row.difference - (row.actual - row.fixed)) < .000001);
  }
}
const run = harness(); run.mount("monthly-report"); run.window.XianShortChallenges.start("xudu_mutiny"); run.flush(); run.decide(1);
let core = run.api.getState(); run.replaceCore({ hidden: { ...core.hidden, leakRisk: 0 } }); run.flush();
run.window.XianArmySystem = { settleMonth: () => run.api.applyExternalPackage({ effects: { security: -2 }, report: { title: "军团用度反馈", text: "真实月末接口" } }) };
const before = plain(run.api.getState()), projected = run.window.XianMonthlySafety.preview(before).projected;
run.node("end-turn-btn").click(); run.node("modal-cancel").click(); run.flush();
assert.equal(run.api.getState().lastSettlement, undefined, "cancelling preflight cannot create an actual receipt");
assert.deepEqual(plain(run.api.getState()), before);
run.node("end-turn-btn").click(); run.node("modal-confirm").click(); run.flush();
const ledger = plain(run.api.getState().lastSettlement); checkTotals(ledger);
const security = ledger.rows.find(row => row.path === "stats.security");
assert.equal(security.fixed, projected.stats.security); assert.equal(security.actual, projected.stats.security - 2);
assert.equal(security.difference, -2); assert.ok(security.sources.some(source => /军团结算/.test(source.source) && source.delta === -2));
let archive = JSON.parse(run.localStorage.getItem("xian_emperor_monthly_reports_v011"));
assert.equal(archive.reports.length, 1, "preflight confirmation must archive the real settlement once");
assert.deepEqual(archive.reports[0].settlement, ledger);
assert.match(run.window.XianMonthlyReport.buildReportHtml(archive.reports[0]), /预检与实际结算对账/);
run.api.endTurn(); assert.equal(JSON.parse(run.localStorage.getItem("xian_emperor_monthly_reports_v011")).reports.length, 1);
const resumed = harness(run.stores()); resumed.node("continue-game-btn").click();
assert.deepEqual(plain(resumed.api.getState().lastSettlement), ledger, "actual attribution survives reload");

const quarter = harness(); quarter.mount("monthly-report"); quarter.window.XianShortChallenges.start("white_horse"); quarter.flush();
core = quarter.api.getState(); quarter.replaceCore({ turn: 4, eventResolved: true, actionPoints: 0, stats: { ...core.stats, treasury: 12 }, hidden: { ...core.hidden, leakRisk: 0 } });
quarter.load("quarterly-agenda"); quarter.window.XianQuarterlyAgenda.refresh(); quarter.window.XianQuarterlyAgenda.selectAgenda("restore_treasury");
core = quarter.api.getState(); quarter.replaceCore({ turn: 6, eventResolved: true, actionPoints: 0, stats: { ...core.stats, treasury: 25, authority: 40, caoAlert: 60 } });
quarter.api.endTurn(); const final = quarter.api.getState(), result = quarter.window.XianShortChallenges.getState().results[0];
checkTotals(final.lastSettlement);
const treasury = final.lastSettlement.rows.find(row => row.path === "stats.treasury");
assert.equal(treasury.fixed, 24); assert.equal(treasury.actual, 27); assert.ok(treasury.sources.some(source => /季度御题/.test(source.source) && source.delta === 3));
assert.equal(final.lastSettlement.goals.find(goal => goal.path === "stats.treasury").actual, result.checks.find(goal => goal.path === "stats.treasury").value);
assert.equal(JSON.parse(quarter.localStorage.getItem("xian_emperor_monthly_reports_v011")).reports[0].campaignEnded, true);
quarter.node("ending-audit-btn").click(); assert.match(quarter.node("modal-body").innerHTML, /终|预检与实际/);

const clamp = harness({}, 0); clamp.api.startNewGame(); core = clamp.api.getState();
clamp.replaceCore({ eventResolved: true, actionPoints: 2, stats: { ...core.stats, security: 99, caoAlert: 40 }, hidden: { ...core.hidden, leakRisk: 100 } });
clamp.api.endTurn(); const cap = clamp.api.getState().lastSettlement; checkTotals(cap);
const capSecurity = cap.rows.find(row => row.path === "stats.security"); assert.equal(capSecurity.fixed, 100); assert.equal(capSecurity.actual, 94);
assert.ok(capSecurity.sources.some(source => /泄密检验（触发/.test(source.source)));
const pure = run.window.XianMonthlySafety.beginSettlement(before);
const changed = plain(before); changed.stats.treasury += 2;
assert.ok(run.window.XianMonthlySafety.finishSettlement(pure, changed).rows.find(row => row.path === "stats.treasury").sources.some(source => source.source === "其他变化（未归类）"));
// Persisted attribution survives an interruption after the fixed charge, without applying it again.
const interrupted = harness(); interrupted.window.XianShortChallenges.startCustom({ ...interrupted.window.XianShortChallenges.getChallenges()[0], randomSeed: 20261006 }); interrupted.decide(1);
const original = interrupted.api.getState();
interrupted.window.XianWorldSystem = { settleMonth: () => { throw new Error("interrupted settlement"); } };
assert.throws(() => interrupted.api.endTurn(), /interrupted settlement/);
assert.ok(interrupted.api.getState().pendingSettlement);
const continued = harness(interrupted.stores()); continued.node("continue-game-btn").click(); continued.api.endTurn();
const continuedCore = continued.api.getState(); checkTotals(continuedCore.lastSettlement);
assert.equal(continuedCore.stats.treasury, original.stats.treasury - 1);
assert.equal(continuedCore.lastSettlement.rows.find(row => row.path === "stats.treasury").sources.filter(source => source.source === "固定用度与守成").length, 1);
assert.equal(continuedCore.pendingSettlement, undefined);
console.log("Settlement attribution, clamps, randomness, quarterly final grading, archive and reload passed.");
