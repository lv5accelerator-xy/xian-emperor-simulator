"use strict";
const assert = require("node:assert/strict");
const { harness, plain } = require("./helpers/game-harness");
const STRATEGY = "xian_emperor_strategy_network_v040";
let groups = 0;
const check = (name, fn) => { fn(); groups++; console.log(`PASS: ${name}`); };
function ready() {
  const h = harness(); h.loadEngine(); h.api.startNewGame("standard", "yankang_220", { randomSeed: 225220 });
  const core = h.api.getState();
  h.replaceCore({ eventResolved: true, stats: { ...core.stats, authority: 80, prestige: 70, treasury: 80, security: 80, caoAlert: 30 },
    relations: { ...core.relations, cao_cao: 97, cao_pi: 50, yuan_shao: 97, hebei_envoy: 90 } });
  h.window.XianStrategyNetwork.applyCampaignEffects({ strategies: { yuan_shao: { trust: 90 }, cao_cao: { trust: 90 } } }); return h;
}
check("220 military execution never borrows a deceased commander's personal relationship", () => {
  const h = ready();
  h.replaceCore({ relations: { ...h.api.getState().relations, yuan_shao: 0 } });
  const a = h.window.XianArmySystem.previewMapOrder("yuan_main", "luoyang", "attack");
  h.replaceCore({ relations: { ...h.api.getState().relations, yuan_shao: 100 } });
  const b = h.window.XianArmySystem.previewMapOrder("yuan_main", "luoyang", "attack");
  assert.equal(a.ok, true); assert.equal(a.execution, b.execution);
  assert.equal(h.window.XianArmySystem.getCommandAccess(h.window.XianArmySystem.getState().armies.yuan_main).relation, 90);
});
check("improving today's representative retries refused aid within the same month", () => {
  const h = ready(); h.replaceCore({ relations: { ...h.api.getState().relations, hebei_envoy: 20 } });
  h.edict("请河北使署派援军驰援许都");
  let p = h.window.XianStrategyNetwork.getState().promises.find(item => item.type === "military_aid");
  assert.ok(p); assert.equal(p.contract.armyId, null);
  h.replaceCore({ relations: { ...h.api.getState().relations, hebei_envoy: 90 } }); h.api.commit("representative-improved");
  p = h.window.XianStrategyNetwork.getState().promises.find(item => item.id === p.id);
  assert.equal(p.contract.armyId, "yuan_main"); assert.equal(p.identity.scope, "faction");
  assert.equal(p.identity.representativeId, "hebei_envoy"); assert.equal(h.api.getState().relations.yuan_shao, 97);
});
check("old personal hostage and deferred title promises retain historical objects without inheritance", () => {
  for (const type of ["hostage", "title"]) {
    const h = ready(), s = h.window.XianStrategyNetwork.getState();
    s.promises.unshift({ id: `old-${type}`, type, label: "旧个人承诺", lordId: "cao_cao", createdTurn: 1, deadlineTurn: 4,
      cityIds: [], routeIds: [], status: "active", progress: 99, text: "曹操的个人约定", lastChange: "待核验" });
    h.localStorage.setItem(STRATEGY, JSON.stringify(s)); h.api.commit("old-personal-promise");
    const p = h.window.XianStrategyNetwork.getState().promises.find(item => item.id === `old-${type}`);
    assert.equal(p.status, "unverified"); assert.equal(p.identity.representativeId, "cao_cao"); assert.equal(p.identity.representativeName, "曹操");
    assert.match(p.lastChange, /不自动转交/); assert.equal(h.api.getState().relations.cao_pi, 50);
    const importer = harness(); assert.equal(importer.api.restoreFullSave(plain(h.api.captureFullSave())), true);
    const restored = harness(importer.stores()); restored.node("continue-game-btn").click(); restored.loadEngine(); restored.api.commit("restored-personal-promise");
    assert.equal(restored.window.XianStrategyNetwork.getState().promises.find(item => item.id === p.id).status, "unverified");
  }
});
check("220 current aliases bind the two faction keys while old named recipients are refused", () => {
  const h = ready(), before = plain(h.api.getState()); h.edict("令曹操与袁绍停战");
  assert.deepEqual(plain(h.api.getState()), before);
  h.edict("令河北使署与曹丕停战");
  const p = h.window.XianStrategyNetwork.getState().promises.find(item => item.type === "ceasefire");
  assert.deepEqual(plain(p.contract.parties), ["yuan_shao", "cao_cao"]); assert.equal(p.identity.scope, "faction");
  assert.equal(p.identity.representativeId, "hebei_envoy");
});
console.log(`Ceasefire/current cast regression passed: ${groups} groups.`);
