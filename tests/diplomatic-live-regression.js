"use strict";
const assert = require("node:assert/strict");
const { harness, plain } = require("./helpers/game-harness");
function start() {
  const h = harness(); h.api.startNewGame("standard", "jianan_196", { randomSeed: 226001 }); h.loadEngine();
  const core = h.api.getState();
  h.replaceCore({ eventResolved: true, stats: { ...core.stats, authority: 75, prestige: 70, treasury: 40 }, relations: { ...core.relations, yuan_shao: 90 } });
  return h;
}
function resume(bundle) {
  const h = harness(Object.fromEntries(Object.entries(bundle.stores).map(([key, value]) => [key, JSON.stringify(value)])));
  h.node("continue-game-btn").click(); h.loadEngine(); return h;
}
function month(h) { if (!h.api.getState().eventResolved) h.decide(0); h.api.endTurn(); }

// Diagnostic previews are also used on the opening screen before a core exists.
const unopened = harness(); unopened.loadEngine();
for (const text of ["请袁绍进贡国库6", "请袁绍派援军驰援许都", "令袁绍与曹操停战"])
  assert.deepEqual(plain(unopened.window.XianStrategyNetwork.previewContracts(text)), [], "no active game means no dated contract preview");

// Actual shared decree parser -> real core commit -> strategy -> treasury package.
const original = start(); original.edict("请袁绍在邺城奉表贡赋6");
assert.equal(original.window.XianStrategyNetwork.getState().promises.length, 1);
assert.equal(original.window.XianStrategyNetwork.getState().promises[0].progress, 0);
original.api.endTurn();
const saved = plain(original.api.captureFullSave());
assert.equal(saved.stores.xian_emperor_strategy_network_v040.promises[0].contract.delivered, 3);
const continued = resume(saved);
const beforeRead = continued.api.getState().stats.treasury;
for (let repeat = 0; repeat < 5; repeat++) { continued.node("continue-game-btn").click(); continued.api.commit("duplicate-observation"); }
assert.equal(continued.api.getState().stats.treasury, beforeRead);
month(original); month(continued);
assert.deepEqual(continued.api.getState().stats, original.api.getState().stats, "full restore preserves the remaining settlement trajectory");
assert.deepEqual(plain(continued.window.XianStrategyNetwork.getState().promises), plain(original.window.XianStrategyNetwork.getState().promises));
const promise = continued.window.XianStrategyNetwork.getState().promises[0];
assert.equal(promise.status, "fulfilled"); assert.equal(promise.contract.delivered, 6);
assert.equal(new Set(promise.contract.receipts.map(item => item.id)).size, 2);
assert.equal(continued.api.getState().appliedReceipts.filter(id => id.startsWith("tribute:")).length, 2);
assert.ok(continued.api.getState().reports.some(item => item.title === "贡赋实收"));

// Core cap means only one unit was actually delivered; do not debit three locally.
const capped = start(); capped.edict("请袁绍在邺城奉表贡赋6");
const supply = capped.window.XianStrategyNetwork.getState().cities.ye.supply;
const armySystem = capped.window.XianArmySystem, supplyBeforeArmy = [];
capped.window.XianArmySystem = { ...armySystem, syncFromCore: raw => {
  const strategy = capped.window.XianStrategyNetwork.getState();
  if (strategy.promises[0]?.contract?.delivered === 1) supplyBeforeArmy.push(strategy.cities.ye.supply);
  return armySystem.syncFromCore(raw);
} };
capped.replaceCore({ stats: { ...capped.api.getState().stats, treasury: 99 }, monthlySettledTurn: 1 });
capped.window.XianArmySystem = armySystem;
const capPromise = capped.window.XianStrategyNetwork.getState().promises[0];
assert.equal(capPromise.contract.delivered, 1); assert.equal(capPromise.contract.receipts[0].amount, 1);
assert.equal(capPromise.contract.receipts[0].sourceSupplySpent, 1);
assert.equal(supplyBeforeArmy[0], supply - 1, "tribute must debit exactly the actual one-unit receipt before the army phase");
const sameMonthBattle = armySystem.getState().militaryFacts.filter(fact => fact.kind === "battle" && fact.cityId === "ye" && fact.turn === 1);
assert.equal(sameMonthBattle.length, 1, "fixed seed retains the real same-month attack instead of disabling military interference");
assert.equal(sameMonthBattle[0].attackerOwner, "gongsun_zan"); assert.equal(sameMonthBattle[0].defenderOwner, "yuan_shao");
assert.equal(capped.window.XianStrategyNetwork.getState().cities.ye.supply, supply - 1 - 5, "battle consumes its own five units after the one-unit tribute transfer");
assert.equal(capped.api.getState().stats.treasury, 100);

// A complete save can be captured between the core month marker and module
// settlement. Loading that checkpoint must retain both sides of the transfer.
const interrupted = start(); interrupted.edict("请袁绍在邺城进贡国库6");
const interruptedSave = plain(interrupted.api.captureFullSave());
interruptedSave.stores.xian_emperor_simulator_v01.monthlySettledTurn = 1;
const interruptedBefore = interruptedSave.stores.xian_emperor_simulator_v01.stats.treasury;
const interruptedResume = resume(interruptedSave);
const interruptedPromise = interruptedResume.window.XianStrategyNetwork.getState().promises[0];
assert.equal(interruptedPromise.contract.delivered, 3, "month-end interrupted load must retain the paid tribute receipt");
assert.equal(interruptedResume.api.getState().stats.treasury, interruptedBefore + 3);
assert.equal(interruptedPromise.contract.receipts.length, 1);

// Real map action must settle a ceasefire breach before exposing the saved action.
const war = start(); war.window.XianStrategyNetwork.applyCampaignEffects({ strategies: { yuan_shao: { trust: 50 } } });
war.edict("令袁绍与曹操停战");
const army = Object.values(war.window.XianArmySystem.getState().armies).find(item => item.owner === "yuan_shao");
assert.equal(war.window.XianArmySystem.issueMapOrder(army.id, "xudu", "attack").ok, true);
const breach = war.window.XianStrategyNetwork.getState().promises[0];
assert.equal(breach.status, "broken"); assert.equal(breach.contract.receipts[0].kind, "hostile-order");
assert.equal(war.window.XianArmySystem.getState().orders[0].targetOwner, "cao_cao");
const breachSave = war.api.captureFullSave();
assert.equal(breachSave.stores.xian_emperor_strategy_network_v040.promises[0].status, "broken");
const loadedWar = resume(breachSave);
assert.equal(loadedWar.window.XianStrategyNetwork.getState().promises[0].contract.receipts.length, 1);
loadedWar.node("strategy-network-overlay").querySelectorAll("[data-strategy-tab]").find(button => button.dataset.strategyTab === "promises").click();
assert.match(loadedWar.node("strategy-network-content").innerHTML, /实际履约回执|敌对军令违约/);
assert.match(loadedWar.node("strategy-network-content").innerHTML, new RegExp(breach.contract.receipts[0].source));
console.log("diplomatic live regression ok: real edict, cap, full restore continuation, duplicate reads, map breach, receipt UI");
