"use strict";
const assert=require("node:assert/strict");
const {plain}=require("./helpers/game-harness");
const {alliedFixture,seal,pact}=require("./alliance-coalition-regression");
const {resume,month,CORE,ARMY,STRATEGY}=require("./lord-command-chain-regression");
function choose(h){if(!h.api.getState().eventResolved){const c=h.api.getCurrentEvent();const i=c.choices.findIndex(x=>!x.disabledReason);h.decide(i);}}
function prepare(mode="none"){
  let h=alliedFixture(({c,s})=>{c.maxTurns=mode==="peace"?13:8;s.cities.jinyang.defense=5;s.cities.jinyang.supply=1;s.strategies.liu_biao.trust=90;});
  if(mode==="cooperate"){seal(h);h.window.XianStrategyNetwork.interveneCoalition(h.window.XianStrategyNetwork.getState().allianceDiplomacy.plans[0].id,"coordinate");}
  if(mode==="betray"){seal(h,"令袁绍与公孙瓒结盟");assert.equal(h.window.XianArmySystem.issueMapOrder("yuan_main","ji","attack").ok,true);}
  if(mode==="peace")seal(h,"令袁绍与公孙瓒及刘表结盟");
  while(h.api.getState().turn<h.api.getState().maxTurns&&!h.api.getState().ended){month(h);if(["cooperate","peace"].includes(mode)&&[6,11].includes(h.api.getState().turn)){choose(h);seal(h,mode==="peace"?"令袁绍与公孙瓒及刘表结盟":"令袁绍与公孙瓒结盟");}}
  assert.equal(h.api.getState().ended,false,"controlled campaign must reach its actual final month");choose(h);
  const b=plain(h.api.captureFullSave()),c=b.stores[CORE];Object.assign(c.stats,{authority:50,prestige:85,security:80,officials:80,treasury:80,caoAlert:15});Object.assign(c.hidden,{externalBalance:85,peopleStability:80,loyalNetwork:20,leakRisk:0,escapeRoute:0});
  h=resume(b);return h;
}
const result=h=>plain(h.api.getState().diplomaticOutcome);
const cases={
  empty(){const h=prepare();h.api.endTurn();assert.notEqual(h.api.getState().ending.title,"诸侯共奉","high national values without diplomatic receipts cannot manufacture common allegiance");assert.equal(result(h).counts.fulfilledAlliances,0);assert.equal(result(h).eligibility.confederation.eligible,false);},
  betrayal(){const h=prepare("betray");h.api.endTurn();assert.notEqual(h.api.getState().ending.title,"诸侯共奉","real court-backed betrayal must affect the diplomatic ending");assert.equal(result(h).counts.unresolvedCourtBreaches,1);assert.equal(h.api.getState().ending.title,"盟约离心");assert.ok(result(h).sourceEvidence.breachIds.length);},
  cooperation(){const h=prepare("cooperate");h.api.endTurn();assert.equal(h.api.getState().ending.title,"诸侯共奉");assert.ok(result(h).counts.fulfilledAlliances>=1);assert.ok(result(h).counts.jointCaptures>=1);assert.ok(result(h).counts.reliableSupporters>=2);assert.equal(result(h).counts.unresolvedCourtBreaches,0);},
  peace(){const h=prepare("peace");h.api.endTurn();assert.equal(h.api.getState().ending.title,"诸侯共奉","a broad alliance with two observed terms can earn the peaceful route without compulsory war");assert.ok(result(h).counts.fulfilledWindows>=2);assert.ok(result(h).counts.reliableSupporters>=3);assert.equal(result(h).counts.jointVictories,0);assert.equal(result(h).confederationRoute,"sustained-peace");},
  preview(){const h=prepare("cooperate"),before=h.stores(),rng=plain(h.api.getState().random);const view=h.window.XianDiplomaticEndings.preview(h.api.getState());assert.equal(view.version,1);assert.deepEqual(h.stores(),before);assert.deepEqual(plain(h.api.getState().random),rng);},
  path(){const h=prepare("betray"),c=h.api.getState();h.localStorage.setItem("xian_emperor_progression_v100",JSON.stringify({version:1,profile:{},session:{gameCreatedAt:c.createdAt,pathId:"balance",pathStage:3}}));h.load("imperial-progress-data","imperial-progress");assert.equal(h.window.XianImperialProgress.getPathEnding(c),null,"completing the external-balance path cannot bypass the common-allegiance evidence gate");h.api.endTurn();assert.notEqual(h.api.getState().ending.title,"天下共奉");},
  legacy(){const old=prepare("betray");old.api.endTurn();const b=plain(old.api.captureFullSave());b.stores[CORE].ending={title:"诸侯共奉",text:"旧规则结局，原样保留。"};b.stores[CORE].rulesVersion=228;delete b.stores[CORE].diplomaticOutcome;const restored=resume(b);assert.equal(restored.api.getState().ending.title,"诸侯共奉");assert.equal(restored.api.getState().diplomaticOutcome,undefined,"an ended legacy archive must not be regraded from current live stores");},
  frozen(){const h=prepare("cooperate");h.api.endTurn();const snapshot=result(h),b=plain(h.api.captureFullSave());b.stores[STRATEGY].promises=[];b.stores[ARMY].militaryFacts=[];const restored=resume(b);for(let i=0;i<3;i++)restored.api.commit("repeat-ending");assert.deepEqual(result(restored),snapshot);assert.equal(restored.api.getState().ending.title,h.api.getState().ending.title);}
};
if(require.main===module)for(const [name,run] of Object.entries(cases))if(!process.argv[2]||name===process.argv[2]){run();console.log(`PASS diplomatic ending ${name}`);}
module.exports={prepare,choose,result,cases};
