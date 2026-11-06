"use strict";
const assert = require("node:assert/strict");
const { harness } = require("./military-consistency-regression");
let groups = 0;
function check(name, fn) { fn(); groups++; console.log(`PASS: ${name}`); }
function reconcile(h) { h.window.XianStrategyNetwork.reconcilePromises(); }
function decree(h, text) {
  const timestamp = h.core.reports.length + 1;
  h.core.reports.unshift({ id: `edict-${timestamp}`, timestamp, title: "圣旨·交涉", text: `“${text}”（80%）` });
  h.flush(); reconcile(h);
}
function fixture(options = {}) {
  const h = harness(), armies = h.army(), strategies = h.strategy();
  h.core.relations.yuan_shao = options.refused ? 20 : 90;
  Object.values(armies.armies).forEach(army => { army.status = "destroyed"; army.troops = 0; });
  Object.assign(armies.armies.yuan_main, { cityId: "luoyang", targetCityId: "luoyang", task: "attack", status: "engaged", troops: 6000, supply: 90 });
  Object.assign(strategies.cities.luoyang, { controller: "cao_cao", defense: 33, supply: 24 });
  strategies.strategies.yuan_shao.trust = 90;
  h.restoreArmy(armies); h.restoreStrategy(strategies);
  h.core.turn = 2; h.flush();
  assert.equal(h.army().sieges.luoyang.status, "active", "fixture must form siege through the real military settlement");
  return h;
}
check("accepted ceasefire lifts an already active siege before another siege month", () => {
  const h = fixture();
  decree(h, "令袁绍与曹操停战");
  assert.equal(h.army().sieges.luoyang.status, "lifted");
  assert.equal(h.army().armies.yuan_main.task, "idle");
  const previous = h.army().sieges.luoyang;
  for (let turn = 3; turn <= 5; turn++) { h.core.turn = turn; h.flush(); reconcile(h); }
  assert.equal(h.army().conquests.length, 0);
  assert.equal(h.strategy().cities.luoyang.controller, "cao_cao");
  assert.equal(h.army().sieges.luoyang.progress, previous.progress);
  assert.equal(h.army().sieges.luoyang.citySupply, previous.citySupply);
  assert.equal(h.strategy().promises[0].status, "fulfilled");
});
check("marching bilateral attacks stop while a third-party campaign continues", () => {
  const h = harness(), a = h.army(), s = h.strategy();
  h.core.relations.yuan_shao = 90; s.strategies.yuan_shao.trust = 90;
  s.cities.luoyang.controller = "cao_cao";
  h.restoreStrategy(s);
  decree(h, "令袁绍攻取洛阳");
  assert.equal(h.army().armies.yuan_main.status, "marching");
  const third = h.army(); Object.assign(third.armies.yuan_vanguard, { cityId: "linzi", targetCityId: "wujun", task: "attack", status: "marching" }); h.restoreArmy(third);
  decree(h, "令袁绍与曹操停战");
  assert.equal(h.army().armies.yuan_main.task, "idle");
  assert.equal(h.army().armies.yuan_vanguard.task, "attack");
  assert.equal(h.army().orders[0].status, "superseded");
  assert.equal(h.strategy().promises[0].status, "active");
});
check("an unaccepted ceasefire explains its refusal and old orders cannot exempt later siege damage", () => {
  const h = fixture({ refused: true });
  const army = h.army(); army.orders.unshift({ id: "pre-treaty-order", turn: 1, owner: "yuan_shao", targetOwner: "cao_cao", targetCityId: "luoyang", task: "attack", status: "executing" }); h.restoreArmy(army);
  decree(h, "令袁绍与曹操停战");
  assert.match(h.strategy().promises[0].lastChange, /未.*承接|调遣/);
  assert.equal(h.army().sieges.luoyang.status, "active");
  h.core.turn = 3; h.flush(); reconcile(h);
  let promise = h.strategy().promises[0];
  assert.equal(promise.status, "broken");
  assert.equal(promise.contract.receipts.length, 1);
  assert.equal(promise.contract.receipts[0].kind, "siege-progress");
  assert.equal(promise.contract.receipts[0].turn, 2, "facts use the completed military month, not the currently displayed month");
  assert.equal(promise.contract.receipts[0].attackerOwner, "yuan_shao");
  assert.equal(promise.contract.receipts[0].defenderOwner, "cao_cao");
  const frozen = JSON.stringify(promise.contract.receipts), s = h.strategy(); s.cities.luoyang.controller = "sun_ce"; h.restoreStrategy(s);
  for (let i = 0; i < 6; i++) { h.flush(); reconcile(h); }
  assert.equal(JSON.stringify(h.strategy().promises[0].contract.receipts), frozen, "later ownership changes cannot reinterpret past hostilities");
});
check("siege progression and occupation are durable hostile evidence after report trimming", () => {
  const h = fixture({ refused: true }); decree(h, "令袁绍与曹操停战");
  for (let turn = 3; turn <= 5; turn++) { h.core.turn = turn; h.flush(); }
  const a = h.army();
  const occupation = a.militaryFacts.find(item => item.kind === "occupation");
  assert.ok(occupation); assert.equal(occupation.attackerOwner, "yuan_shao"); assert.equal(occupation.defenderOwner, "cao_cao");
  assert.equal(a.conquests.length, 1); assert.equal(h.events.filter(item => item.type === "xian:city-captured").length, 1);
  a.battleReports = []; a.orders = []; a.conquests = []; a.militaryFacts = [occupation];
  h.restoreArmy(a); reconcile(h);
  assert.equal(h.strategy().promises[0].status, "broken");
  assert.equal(h.strategy().promises[0].contract.receipts[0].kind, "occupation");
  const facts = JSON.stringify(h.army().militaryFacts), receipts = JSON.stringify(h.strategy().promises[0].contract.receipts);
  for (let i = 0; i < 6; i++) { h.restoreArmy(h.army()); h.restoreStrategy(h.strategy()); h.flush(); reconcile(h); }
  assert.equal(JSON.stringify(h.army().militaryFacts), facts); assert.equal(JSON.stringify(h.strategy().promises[0].contract.receipts), receipts);
});
check("continuing a third-party siege cannot break a bilateral ceasefire", () => {
  const h = fixture(), s = h.strategy(); s.cities.luoyang.controller = "sun_ce"; h.restoreStrategy(s);
  decree(h, "令袁绍与曹操停战");
  assert.equal(h.army().sieges.luoyang.status, "active", "bilateral peace does not stop unrelated wars");
  for (let turn = 3; turn <= 6; turn++) { h.core.turn = turn; h.flush(); reconcile(h); }
  assert.equal(h.strategy().promises[0].status, "fulfilled");
  assert.ok(h.army().militaryFacts.some(item => item.kind === "occupation" && item.defenderOwner === "sun_ce"));
});
check("the final treaty month is checked after its military phase, before fulfillment", () => {
  const h = fixture({ refused: true }); decree(h, "令袁绍与曹操停战");
  const a = h.army(); a.lastProcessedTurn = 4; a.sieges.luoyang.lastResolvedTurn = 3;
  h.core.turn = 4; h.core.monthlySettledTurn = 3; h.restoreArmy(a);
  h.core.monthlySettledTurn = 4;
  h.storage.setItem("xian_emperor_simulator_v01", JSON.stringify(h.core)); h.window.XianStrategyNetwork.settleMonth(); reconcile(h);
  assert.equal(h.strategy().promises[0].status, "active", "the core month marker alone is not evidence that armies completed their month");
  h.window.XianArmySystem.settleMonth(); reconcile(h);
  const p = h.strategy().promises[0];
  assert.equal(p.status, "broken"); assert.equal(p.contract.receipts[0].turn, 4);
  assert.ok(!p.contract.receipts.some(item => item.id.startsWith("observed:")));
});
check("defend, retreat and mismatched saved tasks lift siege without damage or invented history", () => {
  for (const mode of ["defend", "retreat", "idle", "moved", "target", "source", "destroyed"]) {
    const h = fixture(), before = h.army().sieges.luoyang;
    if (mode === "defend") decree(h, "令袁绍守备洛阳");
    else if (mode === "retreat") assert.equal(h.window.XianArmySystem.issueMapOrder("yuan_main", "ye", "retreat").ok, true);
    else {
      const a = h.army();
      Object.assign(a.armies.yuan_main, { idle: { task: "idle", status: "recovering" }, moved: { cityId: "ye" }, target: { targetCityId: "ye" }, source: { currentOrderId: "replacement" }, destroyed: { troops: 0, status: "destroyed" } }[mode]);
      if (mode === "source") a.sieges.luoyang.sourceOrderId = "prior";
      delete a.militaryFacts; h.restoreArmy(a);
    }
    const after = h.army().sieges.luoyang;
    assert.equal(after.status, "lifted", mode); assert.equal(after.progress, before.progress); assert.equal(after.citySupply, before.citySupply);
    assert.ok(!(h.army().militaryFacts || []).some(item => ["siege-progress", "occupation"].includes(item.kind)));
    assert.equal(h.army().conquests.length, 0);
  }
});
check("old contracts lacking siege history retain unknown observation instead of claiming fulfillment", () => {
  const h = fixture(); decree(h, "令袁绍与曹操停战");
  const s = h.strategy(); s.promises[0].contract.version = 1; delete s.promises[0].contract.initialFactIds;
  h.core.turn = 4; h.storage.setItem("xian_emperor_simulator_v01", JSON.stringify(h.core)); h.restoreStrategy(s); h.flush();
  h.core.turn = 5; h.flush(); reconcile(h);
  const p = h.strategy().promises[0];
  assert.equal(p.status, "unverified"); assert.equal(p.contract.receipts.length, 0); assert.match(p.lastChange, /未知/);
});
check("active ceasefire previews identify a deliberate new attack and result records one breach", () => {
  const h = fixture(); decree(h, "令袁绍与曹操停战");
  const a = h.army(); a.armies.yuan_main.cityId = "ye"; a.armies.yuan_main.targetCityId = "ye"; h.restoreArmy(a);
  const preview = h.window.XianArmySystem.previewMapOrder("yuan_main", "luoyang", "attack");
  assert.equal(preview.ok, true); assert.equal(preview.ceasefireBreaches.length, 1); assert.ok(preview.warnings.some(item => item.includes("主动违约")));
  assert.match(h.window.XianStrategyNetwork.previewHostilities("令袁绍攻取洛阳")[0].message, /主动违约/);
  const order = h.window.XianArmySystem.issueMapOrder("yuan_main", "luoyang", "attack");
  assert.equal(order.ok, true); assert.match(order.message, /主动违背/); reconcile(h);
  assert.equal(h.strategy().promises[0].status, "broken"); assert.equal(h.strategy().promises[0].contract.receipts.length, 1);
});
if (require.main === module) console.log(`Ceasefire/siege regression passed: ${groups} groups.`);
module.exports = { fixture, decree, reconcile };
