"use strict";
const assert = require("node:assert/strict");
const { harness, plain } = require("./helpers/game-harness");

const run = harness();
run.window.XianShortChallenges.startCustom({ ...run.window.XianShortChallenges.getChallenges()[0], randomSeed: 1818 });
run.decide(1); run.flush();
const original = run.api.getState();
run.replaceCore({ stats: { ...original.stats, treasury: 25, authority: 45, security: 60, prestige: 65, officials: 55, caoAlert: 40 },
  hidden: { ...original.hidden, peopleStability: 50, leakRisk: 0 } }); run.flush();
const before = plain(run.api.getState()), stores = run.stores();
for (let count = 0; count < 12; count++) {
  run.node("end-turn-btn").click();
  assert.match(run.node("modal-title").textContent, /月末结算预检/);
  assert.match(run.node("modal-body").innerHTML, /国库≥25[\s\S]*预计 24[\s\S]*原已达标，月末将跌出/);
  assert.match(run.node("modal-body").innerHTML, /余下 2 次行动守成/);
  assert.match(run.node("modal-body").innerHTML, /不保证最终成绩/);
  run.node("modal-cancel").click(); run.flush();
}
assert.deepEqual(plain(run.api.getState()), before, "preview/cancel cannot spend AP, resources or RNG draws");
assert.deepEqual(run.stores(), stores, "preview cannot write or reshape the save");
run.node("end-turn-btn").click(); run.node("modal-confirm").click(); run.flush();
const settled = run.api.getState();
assert.equal(settled.turn, 2); assert.equal(settled.stats.treasury, 24);
assert.equal(settled.stats.security, 62); assert.equal(settled.random.draws, before.random.draws + 1);
run.node("modal-confirm").click();
assert.equal(run.api.getState().turn, 2, "one confirmation settles once");

// A delayed resource change while the dialog is open must force a fresh preview.
run.decide(1); run.node("end-turn-btn").click();
run.api.applyExternalPackage({ effects: { treasury: -2 } });
const changed = plain(run.api.getState()); run.node("modal-confirm").click();
assert.equal(run.api.getState().turn, changed.turn);
assert.deepEqual(plain(run.api.getState().random), changed.random);
assert.match(run.node("modal-body").innerHTML, new RegExp(`<td>${changed.stats.treasury}</td><td>${changed.stats.treasury - 1}</td>`));
run.node("modal-confirm").click(); run.flush();
assert.equal(run.api.getState().turn, changed.turn + 1);

// The same fixed rules cover treasury penalties, unstable people and high alert.
const fixed = harness(); fixed.api.startNewGame(); fixed.decide(1);
const core = fixed.api.getState();
fixed.replaceCore({ actionPoints: 1, stats: { ...core.stats, treasury: 18, authority: 75, caoAlert: 90, security: 40, prestige: 30, officials: 40 },
  hidden: { ...core.hidden, peopleStability: 20, leakRisk: 0 } });
const preview = fixed.window.XianMonthlySafety.preview(fixed.api.getState());
fixed.api.endTurn();
assert.deepEqual(plain(fixed.api.getState().stats), plain(preview.projected.stats), "fixed-only preview must match real settlement without a leak");
fixed.replaceCore({ eventResolved: true, monthlySettledTurn: fixed.api.getState().turn });
assert.deepEqual(plain(fixed.window.XianMonthlySafety.preview(fixed.api.getState()).fixed.effects), {});
fixed.node("end-turn-btn").click();
assert.match(fixed.node("modal-body").innerHTML, /不再重复扣款/);

// Final-month grading is based on actual settlement, even if a current goal is already green.
const last = harness(); last.window.XianShortChallenges.startCustom({ ...last.window.XianShortChallenges.getChallenges()[0], id: "preflight-last", duration: 1, randomSeed: 9 });
last.decide(1); const lastCore = last.api.getState();
last.replaceCore({ stats: { ...lastCore.stats, treasury: 25, authority: 60, security: 80, caoAlert: 30 }, hidden: { ...lastCore.hidden, leakRisk: 0 } });
last.node("end-turn-btn").click(); assert.match(last.node("modal-body").innerHTML, /本月完成短局/);
last.node("modal-confirm").click();
assert.equal(last.api.getState().ended, true);
assert.equal(last.window.XianShortChallenges.getResultForGame(lastCore.createdAt).checks.find(check => check.path === "stats.treasury").passed, false);

const advise = harness(); advise.load("command-center");
const cases = [["white_horse", { treasury: 25 }, {}, "revenue"], ["girdle_edict", {}, { loyalNetwork: 20 }, "secret"],
  ["eastward_return", {}, { peopleStability: 30 }, "relief"], ["xudu_mutiny", { officials: 36 }, {}, "ritual"],
  ["abdication_eve", { authority: 22 }, {}, "ritual"]];
for (const [id, stats, hidden, expected] of cases) {
  advise.window.XianShortChallenges.start(id); advise.decide(1);
  const current = advise.api.getState();
  advise.replaceCore({ stats: { ...current.stats, treasury: 60, authority: 60, security: 65, prestige: 75, officials: 65, caoAlert: 30, ...stats },
    hidden: { ...current.hidden, peopleStability: 60, loyalNetwork: 65, leakRisk: 5, externalBalance: 60, ...hidden } });
  const state = plain(advise.api.getState());
  assert.equal(advise.window.XianCommandCenter.recommendAction(state).actionId, expected, `${id} must address its own short-run deficit`);
  assert.deepEqual(plain(advise.api.getState()), state, "recommendations must be read-only");
}
let safe = advise.api.getState(); advise.replaceCore({ stats: { ...safe.stats, authority: 60, treasury: 60 } });
assert.equal(advise.window.XianCommandCenter.recommendAction(advise.api.getState()).actionId, "end");
advise.node("action-grid").querySelector("[data-action-recommend]").click();
assert.match(advise.node("modal-title").textContent, /月末结算预检/);
assert.equal(advise.api.getState().turn, 1, "guard recommendation opens review rather than spending a turn");
advise.node("modal-cancel").click(); safe = advise.api.getState();
advise.replaceCore({ stats: { ...safe.stats, caoAlert: 95 } });
assert.equal(advise.window.XianCommandCenter.recommendAction(advise.api.getState()).actionId, "appease", "terminal danger outranks short goals");
safe = advise.api.getState(); advise.replaceCore({ stats: { ...safe.stats, caoAlert: 30, treasury: 3, authority: 22 } });
assert.equal(advise.window.XianCommandCenter.recommendAction(advise.api.getState()).actionId, "revenue", "unfunded goal actions need money first");

advise.api.startNewGame(); advise.decide(1);
advise.window.XianQuarterlyAgenda = { getState: () => ({ gameCreatedAt: advise.api.getState().createdAt, active: { id: "steady_court" } }), calculateProgress: () => 25 };
safe = advise.api.getState(); advise.replaceCore({ stats: { ...safe.stats, treasury: 60, security: 65, authority: 65, prestige: 70, caoAlert: 30 }, hidden: { ...safe.hidden, peopleStability: 60, leakRisk: 5 } });
assert.equal(advise.window.XianCommandCenter.recommendAction(advise.api.getState()).actionId, "audience", "quarterly goals guide a normal campaign");
console.log("Monthly preflight, read-only RNG, actual final grading, stale confirmation and goal-aware advice passed.");
