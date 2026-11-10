"use strict";
const assert = require("node:assert/strict");
const { harness, plain } = require("./helpers/game-harness");
const { parallelFixture } = require("./parallel-council-regression");
const { resume, month, CORE, ARMY, STRATEGY } = require("./lord-command-chain-regression");
const treatyText = "令袁绍与公孙瓒结盟，共讨刘表，合攻晋阳";
function alliedFixture(patch = () => {}) {
  return parallelFixture(ctx => {
    const { a, s } = ctx;
    s.commandChain.intents = [];
    Object.assign(a.armies.youzhou_cavalry, { cityId: "ye", originCityId: "ye", targetCityId: "ye" });
    for (const route of Object.values(s.routes)) Object.assign(route, { supply: 90, pressure: 10, blockadedUntil: 0 });
    s.cities.jinyang.controller = "liu_biao"; s.cities.jinyang.defense = 100;
    patch(ctx);
  });
}
const pact = h => plain(h.window.XianStrategyNetwork.getState().promises.find(p => p.type === "alliance"));
const plans = h => plain(h.window.XianStrategyNetwork.getState().allianceDiplomacy?.plans || []);
function seal(h, text = treatyText) { h.edict(text); return pact(h); }
const cases = {
  currentIdentities() {
    const h=harness();h.loadEngine();h.api.startNewGame("standard","yankang_220",{randomSeed:226001});h.decide(0);
    const ids=["yuan_shao","gongsun_zan"],names=ids.map(id=>h.window.XianCharacterAvailability.faction(id,h.api.getState()).name),text=`令${names.join("与")}结盟`;
    assert.ok(!names.includes("袁绍"));
    const preview=h.window.XianStrategyNetwork.previewContracts(text).find(p=>p.type==="alliance");
    assert.deepEqual(plain(preview.partyNames),names,"220 treaty names must use current faction institutions rather than resurrect former rulers");
    seal(h,text);assert.deepEqual(pact(h).contract.partyNames,names);assert.deepEqual(pact(h).contract.receipts.filter(r=>r.kind==="consent").map(r=>r.actorName),names);
    const brief=h.node("strategy-brief-content");h.api.commit("current-alliance-example");assert.ok(brief.innerHTML.includes(`令${names.join("与")}结盟`),"current scenario guidance must not recommend unavailable former rulers");
  },
  parsing() {
    const h = alliedFixture(), r = h.window.XianEdictRules.analyze(treatyText);
    assert.equal(r.blocked, false); assert.ok(r.effectiveText.includes("合攻晋阳"));
    assert.ok(!r.targets.includes("liu_biao"), "the common enemy is not a positively treated signatory");
    assert.equal(h.window.XianStrategyNetwork.previewContracts("禁止袁绍与公孙瓒结盟").length, 0);
    const three = h.window.XianEdictRules.analyze("令袁绍与公孙瓒及刘表结盟"); assert.equal(three.blocked, false);
    assert.equal(h.window.XianStrategyNetwork.previewContracts("令袁绍与公孙瓒及刘表结盟")[0].parties.length, 3);
  },
  formation() {
    const h = alliedFixture(), before = plain(h.api.getState().random), raw = h.stores();
    const preview = h.window.XianStrategyNetwork.previewContracts(treatyText);
    assert.equal(preview.filter(p => p.type === "alliance").length, 1, "one real shared treaty must be previewed, with both parties distinct from the common enemy");
    assert.deepEqual(h.stores(), raw); assert.deepEqual(plain(h.api.getState().random), before);
    const p = seal(h), s = h.window.XianStrategyNetwork.getState();
    assert.equal(s.promises.filter(p => p.type === "alliance").length, 1);
    assert.deepEqual([...p.contract.parties].sort(), ["gongsun_zan", "yuan_shao"]);
    assert.equal(p.contract.targetCityId, "jinyang"); assert.equal(p.contract.targetOwner, "liu_biao");
    assert.equal(p.contract.receipts.filter(r => r.kind === "consent" && r.status === "accepted").length, 2);
    assert.equal(p.status, "active"); assert.equal(h.window.XianArmySystem.getState().orders.length, 0, "signing cannot invent an army dispatch");
    assert.equal(plans(h).length, 1); assert.equal(h.api.getState().actionPoints, 1);
    h.edict(treatyText);assert.equal(h.window.XianStrategyNetwork.getState().promises.filter(p=>p.type==="alliance").length,1,"repeating the same active terms cannot create farmable duplicate treaties");
  },
  refusal() {
    const h = alliedFixture(({ s }) => { s.strategies.gongsun_zan.trust = 0; }); const p = seal(h);
    assert.equal(p.status, "refused", "one refusal prevents the entire treaty being treated as active");
    assert.ok(p.contract.receipts.some(r => r.actor === "gongsun_zan" && r.status === "refused"));
    assert.equal(plans(h).length, 0); assert.equal(h.window.XianArmySystem.getState().orders.length, 0);
  },
  nonaggression() {
    const h = parallelFixture(); seal(h, "令袁绍与公孙瓒结盟"); month(h);
    assert.equal(h.window.XianArmySystem.getState().militaryFacts.filter(f => f.kind === "battle").length, 0, "accepted allies must not fight each other while crossing the same road");
  },
  coalition() {
    const h = alliedFixture(); const p = seal(h), plan = plans(h)[0];
    assert.ok(plan, "a sealed common objective creates a joint plan");
    const before = plain(h.api.getState()), raw = h.stores();
    const preview = h.window.XianStrategyNetwork.previewCoalitionIntervention(plan.id, "coordinate");
    assert.equal(preview.ok, true); assert.equal(preview.members.filter(m => m.accepted).length, 2); assert.deepEqual(h.stores(), raw);
    assert.equal(h.window.XianStrategyNetwork.interveneCoalition(plan.id, "coordinate"), true);
    assert.equal(h.api.getState().actionPoints, before.actionPoints - 1);
    assert.equal(h.window.XianStrategyNetwork.interveneCoalition(plan.id, "coordinate"), false);
    const orders = h.window.XianArmySystem.getState().orders.filter(o => o.sourceAllianceId === p.id);
    assert.equal(orders.length, 2); assert.equal(new Set(orders.map(o => o.armyId)).size, 2);
    month(h); const a = h.window.XianArmySystem.getState();
    assert.equal(a.militaryFacts.filter(f => f.kind === "battle" && ["yuan_shao", "gongsun_zan"].includes(f.attackerOwner) && ["yuan_shao", "gongsun_zan"].includes(f.defenderOwner)).length, 0);
    assert.equal(a.sieges.jinyang.attackerArmyId, "yuan_main");
    month(h); const advanced = h.window.XianArmySystem.getState();
    const progress = advanced.militaryFacts.filter(f => f.kind === "siege-progress" && f.turn === 2 && f.cityId === "jinyang");
    assert.equal(progress.length, 1); assert.equal(progress[0].participants.length, 2);
    assert.ok(progress[0].participants.every(x => x.orderId && x.troopsBefore > 0 && x.supplySpent > 0));
    assert.equal(advanced.sieges.jinyang.attackerArmyId, "yuan_main", "the allied supporter cannot steal the primary siege");
  },
  betrayal() {
    const h = alliedFixture(); seal(h, "令袁绍与公孙瓒结盟");
    const victim = h.window.XianStrategyNetwork.getState().strategies.gongsun_zan.trust;
    assert.equal(h.window.XianArmySystem.issueMapOrder("yuan_main", "ji", "attack").ok, true);
    assert.equal(pact(h).status, "broken", "a real hostile order against a signatory must break the treaty immediately");
    const d = h.window.XianStrategyNetwork.getState().allianceDiplomacy;
    assert.equal(d.reputations.yuan_shao, 37); assert.equal(d.consequences.length, 1);
    assert.equal(d.consequences[0].reputationDelta, -13);
    assert.ok(d.consequences[0].sourceFactId);
    assert.ok(h.window.XianStrategyNetwork.getState().strategies.gongsun_zan.trust <= victim - 5);
    const saved = resume(plain(h.api.captureFullSave())); for (let n = 0; n < 4; n++) saved.api.commit("repeat-betrayal");
    assert.deepEqual(saved.window.XianStrategyNetwork.getState().allianceDiplomacy.consequences, d.consequences);
    assert.equal(saved.window.XianStrategyNetwork.getState().allianceDiplomacy.reputations.yuan_shao, 37);
  },
  road() {
    const h=alliedFixture(({a})=>{const e=a.armies.jingzhou_navy;Object.assign(e,{troops:25000,maxTroops:25000,cityId:"jinyang",originCityId:"jinyang",targetCityId:"ye",task:"attack",status:"marching",routeIds:["ye_jinyang"],routeIndex:0,currentRouteId:"ye_jinyang",currentOrderId:"enemy-road",supply:90,morale:90,fatigue:0});a.orders.push({id:"enemy-road",armyId:e.id,owner:e.owner,turn:1,task:"attack",targetCityId:"ye",targetOwner:"yuan_shao",originCityId:"jinyang",routeIds:["ye_jinyang"],status:"executing",authority:"lord"});});
    seal(h);month(h);const a=h.window.XianArmySystem.getState(),f=a.militaryFacts.filter(f=>f.kind==="battle"&&f.routeId==="ye_jinyang");
    assert.equal(f.length,1);assert.equal(f[0].participants.length,3);assert.equal(new Set(f[0].participants.map(p=>p.armyId)).size,3);
    assert.ok(f[0].participants.every(p=>p.orderId&&p.losses>0&&p.supplySpent>0));
    assert.equal(a.armies.yuan_main.cityId,"ye");assert.equal(a.armies.youzhou_cavalry.cityId,"ye");assert.equal(a.conquests.length,0);
  },
  currentOpponent() {
    for(const [previous,current,stopped] of [["gongsun_zan","liu_biao",false],["liu_biao","gongsun_zan",true]]){
      const original=alliedFixture(({s})=>s.cities.ji.controller=previous);
      assert.equal(original.window.XianArmySystem.issueMapOrder("yuan_main","ji","attack").ok,true);
      const b=plain(original.api.captureFullSave()),id=b.stores[ARMY].armies.yuan_main.currentOrderId;
      b.stores[STRATEGY].cities.ji.controller=current;const h=resume(b);seal(h,"令袁绍与公孙瓒结盟");
      assert.equal(pact(h).status,"active");
      assert.equal(h.window.XianArmySystem.getState().orders.find(o=>o.id===id).status,stopped?"superseded":"executing","consensual peace considers the actual current opponent, preserving the original target owner as history");
    }
  }
};
if (require.main === module) for (const [name, run] of Object.entries(cases)) if (!process.argv[2] || process.argv[2] === name) { run(); console.log(`PASS alliance ${name}`); }
module.exports = { alliedFixture, treatyText, pact, plans, seal, cases };
