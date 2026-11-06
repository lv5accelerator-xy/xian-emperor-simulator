"use strict";
const assert = require("node:assert/strict");
const { harness, plain } = require("./helpers/game-harness");
const CORE = "xian_emperor_simulator_v01", ARMIES = "xian_emperor_armies_v050", STRATEGY = "xian_emperor_strategy_network_v040";
let groups = 0;
function check(name, fn) { fn(); groups++; console.log(`PASS: ${name}`); }
function resume(bundle, imported = false) {
  let h = harness(Object.fromEntries(Object.entries(bundle.stores).map(([key, value]) => [key, JSON.stringify(value)])));
  if (imported) { assert.equal(h.api.restoreFullSave(plain(bundle)), true); h = harness(h.stores()); }
  h.node("continue-game-btn").click(); h.loadEngine(); h.api.commit("resume-complete"); return h;
}
function fixture() {
  const h = harness(); h.loadEngine(); h.api.startNewGame("standard", "jianan_196", { randomSeed: 225014 });
  const bundle = plain(h.api.captureFullSave()), core = bundle.stores[CORE], a = bundle.stores[ARMIES], s = bundle.stores[STRATEGY];
  core.eventResolved = true; Object.assign(core.stats, { authority: 75, prestige: 70, treasury: 65, security: 80, officials: 60, caoAlert: 30 });
  core.hidden.leakRisk = 0; core.relations.yuan_shao = 90; s.strategies.yuan_shao.trust = 90;
  Object.values(a.armies).forEach(army => { army.status = "destroyed"; army.troops = 0; });
  Object.assign(a.armies.yuan_main, { cityId: "luoyang", targetCityId: "luoyang", task: "attack", status: "engaged", troops: 6000, supply: 90 });
  Object.assign(s.cities.luoyang, { controller: "cao_cao", defense: 33, supply: 24 });
  const run = resume(bundle); run.api.endTurn();
  assert.equal(run.window.XianArmySystem.getState().sieges.luoyang.status, "active"); return run;
}
function month(h, interval = 0) { if (!h.api.getState().eventResolved) h.decide(1); h.advance(interval); h.api.endTurn(); h.advance(interval); }
function signature(h) {
  const a = h.window.XianArmySystem.getState(), p = h.window.XianStrategyNetwork.getState().promises;
  return plain({ stats: h.api.getState().stats, random: h.api.getState().random, sieges: a.sieges, conquests: a.conquests, facts: a.militaryFacts, promises: p });
}
check("actual ceasefire commit/full export/import/repeated read never replays a siege month", () => {
  const direct = fixture(), savedActive = plain(direct.api.captureFullSave());
  const restored = resume(savedActive, true);
  assert.deepEqual(signature(restored), signature(direct));
  for (const h of [direct, restored]) {
    h.decide(1); h.edict("令袁绍与曹操停战");
    assert.equal(h.window.XianArmySystem.getState().sieges.luoyang.status, "lifted");
  }
  const peace = resume(plain(restored.api.captureFullSave()), true), before = signature(peace);
  for (let i = 0; i < 6; i++) { peace.api.commit("duplicate"); peace.node("continue-game-btn").click(); peace.api.commit("duplicate-read"); }
  assert.deepEqual(signature(peace), before);
  while (direct.api.getState().turn < 5) month(direct);
  while (peace.api.getState().turn < 5) month(peace, 50);
  assert.deepEqual(signature(peace), signature(direct));
  assert.equal(peace.window.XianArmySystem.getState().conquests.length, 0);
  const p = peace.window.XianStrategyNetwork.getState().promises[0]; assert.equal(p.status, "fulfilled"); assert.equal(p.contract.receipts.length, 1);
});
check("refused ceasefire survives complete import with one actual breach and one capture", () => {
  const direct = fixture(), core = direct.api.getState(); direct.replaceCore({ relations: { ...core.relations, yuan_shao: 20 } });
  direct.decide(1); direct.edict("令袁绍与曹操停战");
  const imported = resume(plain(direct.api.captureFullSave()), true);
  for (const h of [direct, imported]) while (h.api.getState().turn < 5) month(h);
  assert.deepEqual(signature(imported), signature(direct));
  const a = imported.window.XianArmySystem.getState(), p = imported.window.XianStrategyNetwork.getState().promises[0];
  assert.equal(a.conquests.length, 1); assert.equal(a.militaryFacts.filter(item => item.kind === "occupation").length, 1);
  assert.equal(p.status, "broken"); assert.equal(p.contract.receipts.length, 1);
  const before = signature(imported); for (let i = 0; i < 5; i++) imported.api.commit("repeat-capture-observation");
  assert.deepEqual(signature(imported), before);
});
check("shared decree pipeline links accepted aid, arrival, attack, refused peace, siege and occupation", () => {
  const h = harness(); h.loadEngine(); h.api.startNewGame("standard", "jianan_196", { randomSeed: 225015 });
  const bundle = plain(h.api.captureFullSave()), core = bundle.stores[CORE], a = bundle.stores[ARMIES], s = bundle.stores[STRATEGY];
  core.eventResolved = true; Object.assign(core.stats, { authority: 85, prestige: 75, treasury: 90, security: 90, officials: 70, caoAlert: 15 }); core.hidden.leakRisk = 0; core.relations.yuan_shao = 90;
  s.strategies.yuan_shao.trust = 90;
  Object.values(a.armies).forEach(army => { if (army.id !== "yuan_main") { army.status = "destroyed"; army.troops = 0; } });
  Object.assign(s.cities.luoyang, { controller: "cao_cao", defense: 33, supply: 24 });
  const run = resume(bundle); run.edict("请袁绍派援军驰援许都");
  while (run.window.XianStrategyNetwork.getState().promises[0].status === "active" && run.api.getState().turn < 6) month(run);
  const aid = run.window.XianStrategyNetwork.getState().promises[0]; assert.equal(aid.status, "fulfilled"); assert.ok(aid.contract.receipts.some(item => item.kind === "arrival"));
  if (!run.api.getState().eventResolved) run.decide(1);
  run.edict("令袁绍攻取洛阳");
  while (!run.window.XianArmySystem.getState().sieges.luoyang && run.api.getState().turn < 9) month(run);
  assert.equal(run.window.XianArmySystem.getState().sieges.luoyang.status, "active");
  run.replaceCore({ relations: { ...run.api.getState().relations, yuan_shao: 20 } });
  if (!run.api.getState().eventResolved) run.decide(1);
  run.edict("令袁绍与曹操停战");
  while (!run.window.XianArmySystem.getState().conquests.length && run.api.getState().turn < 12) month(run);
  const finalArmy = run.window.XianArmySystem.getState(), treaties = run.window.XianStrategyNetwork.getState().promises;
  assert.equal(treaties.find(item => item.type === "military_aid").status, "fulfilled");
  assert.equal(treaties.find(item => item.type === "ceasefire").status, "broken");
  assert.equal(finalArmy.conquests.length, 1); assert.ok(finalArmy.militaryFacts.some(item => item.kind === "siege-progress")); assert.ok(finalArmy.militaryFacts.some(item => item.kind === "occupation"));
  console.log(JSON.stringify({ seed: 225015, turn: run.api.getState().turn, aid: aid.contract.receipts, peace: treaties.find(item => item.type === "ceasefire").contract.receipts, capture: finalArmy.conquests[0], actions: run.api.getState().totalActions, treasury: run.api.getState().stats.treasury }));
});
console.log(`Ceasefire live regression passed: ${groups} groups; real core handlers with a test DOM adapter, not browser acceptance.`);
