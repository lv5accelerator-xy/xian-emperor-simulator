"use strict";
const assert = require("node:assert/strict");
const { harness, plain, CORE_KEY } = require("./helpers/game-harness");
const COURT_KEY = "xian_emperor_court_politics_v060";
const REGIONAL_KEY = "xian_emperor_regional_echoes_v2120";
const PATH_KEY = "xian_emperor_imperial_paths_v2130";
const emit = (h, type, detail) => h.document.dispatchEvent({ type, detail });
const tests = [];
function test(name, fn) { tests.push([name, fn]); }
function start() { const h = harness(); h.api.startNewGame(); return h; }
function courtFixture(h, treasury = 42) {
  const core = h.api.getState();
  h.replaceCore({ stats: { ...core.stats, treasury }, eventResolved: true, actionPoints: 2 });
  h.localStorage.setItem(COURT_KEY, JSON.stringify({ gameCreatedAt: core.createdAt, lastProcessedTurn: 1,
    factions: {}, petitions: [{ id: "petition-1-fu_guard", templateId: "fu_guard", turn: 1, status: "pending" }], history: [], resolvedCount: 0 }));
  h.mount("court-politics");
  return h.window.XianCourtPolitics;
}
test("A3 resolved petitions survive five reloads without another generation", () => {
  let h = start(); let court = courtFixture(h);
  assert.equal(court.resolvePetition("petition-1-fu_guard", "refuse"), true);
  const expected = h.api.getState();
  for (let i = 0; i < 5; i++) {
    h = harness(h.stores()); h.node("continue-game-btn").click(); h.mount("court-politics"); court = h.window.XianCourtPolitics;
    assert.equal(court.diagnostics().petitions.length, 0, "resolved month cannot generate another petition");
    assert.deepEqual(h.api.getState().stats, expected.stats);
    assert.deepEqual(h.api.getState().random, expected.random);
  }
  h.replaceCore({ turn: 2 }); h.flush();
  assert.equal(court.diagnostics().petitions.length, 1, "next month generates normally");
});
test("A5 court costs reject before mutation and charge once at exact budget", () => {
  for (const treasury of [0, 3, 4]) {
    const h = start(); const court = courtFixture(h, treasury); const before = plain(court.diagnostics()); const core = h.api.getState();
    const result = court.resolvePetition("petition-1-fu_guard", "accept");
    assert.equal(result, treasury >= 4);
    if (treasury < 4) { assert.deepEqual(court.diagnostics(), before); assert.deepEqual(h.api.getState(), core); }
    else { assert.equal(h.api.getState().stats.treasury, 0); assert.equal(h.api.getState().stats.security, core.stats.security + 7);
      assert.equal(court.resolvePetition("petition-1-fu_guard", "accept"), false); assert.equal(h.api.getState().stats.treasury, 0); }
  }
});
test("A6 pure warlord battles never create court debt or court participation", () => {
  const h = start(); h.mount("causal-court"); const treasury = h.api.getState().stats.treasury;
  for (let i = 0; i < 3; i++) emit(h, "xian:battle-report", { id: `warlord-${i}`, turn: 1, cityId: "luoyang", attackerOwner: "cao", defenderOwner: "yuan", victor: "cao", attackerLosses: 100, defenderLosses: 200 });
  let causes = h.window.XianCausalCourt.getState(); assert.equal(causes.metrics.battles, 3);
  assert.equal(causes.pending.filter(item => item.kind === "war_debt").length, 0, "warlord losses cannot generate court debt");
  assert.equal(causes.metrics.courtBattles, 0);
  h.replaceCore({ turn: 2 }); emit(h, "xian:before-month-end", { createdAt: h.api.getState().createdAt, turn: 2 });
  assert.equal(h.api.getState().stats.treasury, treasury);
});
test("A6 court battle receipts survive replay and delayed debt settles once", () => {
  let h = start(); h.mount("causal-court"); const treasury = h.api.getState().stats.treasury;
  const report = { id: "court-1", turn: 1, cityId: "luoyang", attackerOwner: "court", defenderOwner: "cao", victor: "court", attackerLosses: 100, defenderLosses: 200 };
  emit(h, "xian:battle-report", report); emit(h, "xian:battle-report", report);
  assert.equal(h.window.XianCausalCourt.getState().metrics.courtBattles, 1); assert.equal(h.api.getState().stats.treasury, treasury - 2);
  h = harness(h.stores()); h.node("continue-game-btn").click(); h.mount("causal-court"); emit(h, "xian:battle-report", report);
  h.replaceCore({ turn: 2 }); emit(h, "xian:before-month-end", { turn: 2 }); emit(h, "xian:before-month-end", { turn: 2 });
  assert.equal(h.api.getState().stats.treasury, treasury - 3); assert.equal(h.window.XianCausalCourt.getState().metrics.courtBattles, 1);
});
let failed = 0;
for (const [name, fn] of tests) { try { fn(); console.log(`PASS ${name}`); } catch (error) { failed++; console.error(`FAIL ${name}: ${error.message}`); } }
console.log(`${tests.length - failed}/${tests.length} court rules regressions passed`);
if (failed) process.exitCode = 1;
