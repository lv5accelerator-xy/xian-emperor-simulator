"use strict";
const assert=require("node:assert/strict");
const {harness,plain}=require("./helpers/game-harness");
const CORE="xian_emperor_simulator_v01",ARMY="xian_emperor_armies_v050",STRATEGY="xian_emperor_strategy_network_v040";
function resume(bundle){let r=harness(Object.fromEntries(Object.entries(bundle.stores).map(([k,v])=>[k,JSON.stringify(v)])));r.node("continue-game-btn").click();r.loadEngine();r.api.commit("fixture");return r;}
function ready(){const r=harness();r.loadEngine();r.api.startNewGame("standard","jianan_196",{randomSeed:226001});return r;}
function rejectedAttack(){const r=ready(),b=plain(r.api.captureFullSave()),c=b.stores[CORE],s=b.stores[STRATEGY];c.eventResolved=true;c.stats.authority=20;c.relations.yuan_shao=10;s.strategies.yuan_shao.trust=10;const h=resume(b),before=h.window.XianStrategyNetwork.getState().cities.luoyang.defense;h.edict("令袁绍攻取洛阳");assert.equal(h.window.XianArmySystem.getState().orders.filter(x=>x.owner==="yuan_shao").length,0);assert.equal(h.window.XianStrategyNetwork.getState().cities.luoyang.defense,before,"a refused military request cannot damage walls before any army acted");}
function fixture(patch=()=>{}) {
  const b=plain(ready().api.captureFullSave()),c=b.stores[CORE],s=b.stores[STRATEGY],a=b.stores[ARMY];
  c.eventResolved=true; Object.assign(c.stats,{authority:80,treasury:75,prestige:75,security:75,officials:75,caoAlert:20});c.relations.yuan_shao=90;
  s.strategies.yuan_shao.trust=85;s.cities.jinyang.controller="liu_biao";s.cities.jinyang.defense=15;
  const intent={id:`lord-intent:${c.createdAt}:1:yuan_shao`,source:"autonomous",owner:"yuan_shao",ownerName:"袁绍",armyId:"yuan_main",armyName:"河北主力",turn:1,dueTurn:1,originCityId:"ye",targetCityId:"jinyang",targetName:"晋阳",targetOwner:"liu_biao",task:"attack",routeIds:["ye_jinyang"],status:"proposed",reason:"测试军议"};
  s.commandChain={schemaVersion:1,entryTurn:1,generatedTurns:Array.from({length:24},(_,i)=>i+1),intents:[intent],consequences:[]};
  patch({c,s,a,intent,b});return resume(b);
}
const chain=h=>plain(h.window.XianStrategyNetwork.getState().commandChain);
const intent=h=>chain(h).intents[0];
function month(h){if(!h.api.getState().eventResolved)h.decide(0);h.api.endTurn();}
function intervene(h,kind="coordinate",ack=false){return h.window.XianStrategyNetwork.interveneLordIntent(intent(h).id,kind,ack);}
function tests(){
  rejectedAttack();
  const generated=ready(),generatedChain=chain(generated);assert.equal(generatedChain.intents.length,1);
  const before=plain(generated.api.captureFullSave());for(let i=0;i<4;i++)generated.api.commit("read-again");assert.deepEqual(chain(generated),generatedChain,"commits cannot reroll proposals");assert.deepEqual(plain(generated.api.getState().random),before.stores[CORE].random);
  const accepted=fixture(),id=intent(accepted).id,raw=accepted.stores(),rng=plain(accepted.api.getState().random);
  const preview=accepted.window.XianStrategyNetwork.previewLordIntervention(id,"coordinate");assert.equal(preview.accepted,true);assert.equal(preview.treasuryCost,1);assert.deepEqual(accepted.stores(),raw,"preview must be read-only");assert.deepEqual(plain(accepted.api.getState().random),rng);
  const ap=accepted.api.getState().actionPoints,money=accepted.api.getState().stats.treasury,trust=accepted.window.XianStrategyNetwork.getState().strategies.liu_biao.trust;
  assert.equal(intervene(accepted),true);assert.equal(accepted.api.getState().actionPoints,ap-1);assert.equal(accepted.api.getState().stats.treasury,money-1);assert.equal(intent(accepted).status,"marching");assert.equal(accepted.window.XianStrategyNetwork.getState().strategies.liu_biao.trust,trust-3);
  assert.equal(intervene(accepted),false);for(let i=0;i<4;i++)accepted.api.commit("duplicate");assert.equal(accepted.api.getState().actionPoints,ap-1);assert.equal(chain(accepted).consequences.length,1);
  const load=resume(plain(accepted.api.captureFullSave()));assert.deepEqual(chain(load),chain(accepted));assert.equal(load.api.getState().actionPoints,ap-1);
  const autonomous=fixture(),autoTrust=autonomous.window.XianStrategyNetwork.getState().strategies.liu_biao.trust;month(autonomous);assert.ok(["arrived","besieging","captured"].includes(intent(autonomous).status),intent(autonomous).status);assert.ok(chain(autonomous).consequences.length>0);assert.equal(chain(autonomous).consequences[0].responsibility,"lord");assert.equal(autonomous.window.XianStrategyNetwork.getState().strategies.liu_biao.trust,autoTrust);
  const stopped=fixture();assert.equal(intervene(stopped,"restrain"),true);assert.equal(intent(stopped).status,"restrained");month(stopped);assert.equal(stopped.window.XianArmySystem.getState().orders.length,0);
  const rejected=fixture(({c})=>{c.stats.authority=20;});const rejectMoney=rejected.api.getState().stats.treasury;assert.equal(intervene(rejected),true);assert.equal(intent(rejected).status,"proposed");assert.ok(intent(rejected).interventionResponse);assert.equal(rejected.api.getState().stats.treasury,rejectMoney);assert.equal(chain(rejected).consequences.length,0);month(rejected);assert.equal(rejected.window.XianArmySystem.getState().orders.length,1);assert.equal(chain(rejected).consequences[0].responsibility,"lord","rejected coordination cannot secretly cancel a lord's proposal or blame the court for his autonomous attack");
  const rejectedStop=fixture(({c})=>{c.stats.authority=20;});assert.equal(intervene(rejectedStop,"restrain"),true);assert.equal(intent(rejectedStop).status,"proposed");month(rejectedStop);assert.equal(rejectedStop.window.XianArmySystem.getState().orders.length,1);assert.ok(intent(rejectedStop).restraintResponse);
  for(const [name,patch] of Object.entries({grain:({a})=>a.armies.yuan_main.supply=5,morale:({a})=>a.armies.yuan_main.morale=10,fatigue:({a})=>a.armies.yuan_main.fatigue=90,troops:({a})=>a.armies.yuan_main.troops=600,missing:({a})=>a.armies.yuan_main.status="destroyed",blocked:({s})=>s.routes.ye_jinyang.blockadedUntil=3,route:({intent})=>intent.routeIds=[],busy:({a})=>a.armies.yuan_main.currentOrderId="existing",changed:({s})=>s.cities.jinyang.controller="cao_cao",aid:({s})=>s.promises.push({id:"existing-aid",type:"military_aid",status:"active",lordId:"yuan_shao",cityIds:[],routeIds:[],createdTurn:1,deadlineTurn:4,progress:0,contract:{armyId:"yuan_main",orderId:"existing",targetCityId:"xudu",responsible:"yuan_shao",initialOrderIds:[],receipts:[]}})})){
    const h=fixture(patch);month(h);assert.equal(intent(h).status,"refused",name);assert.equal(chain(h).consequences.length,0,name);
  }
  const noBudget=fixture(({c})=>c.actionPoints=0);assert.equal(intervene(noBudget),false);assert.equal(intent(noBudget).intervention,undefined);
  const noMoney=fixture(({c})=>c.stats.treasury=0);assert.equal(intervene(noMoney),false);
  for(const floor of [0,1]){const h=fixture(({s})=>s.strategies.liu_biao.trust=floor);intervene(h);assert.equal(chain(h).consequences[0].trustDelta,floor?-floor:0,"record actual capped trust change");assert.equal(chain(h).consequences[0].penaltyIssued,true);h.window.XianStrategyNetwork.applyCampaignEffects({strategies:{liu_biao:{trust:5}}});month(h);assert.equal(h.window.XianStrategyNetwork.getState().strategies.liu_biao.trust,5,"a zero-effect receipt still prevents a later second penalty");assert.equal(chain(h).consequences.filter(c=>c.penaltyIssued).length,1);}
  // Acceptance creates one durable response even when the old display history is clipped.
  const clipped=plain(accepted.api.captureFullSave());clipped.stores[ARMY].orders=[];const clip=resume(clipped);assert.equal(intent(clip).status,"marching");assert.equal(chain(clip).consequences.length,1);assert.equal(intervene(clip),false);
  // Conservative migration never turns an old report into a new military result.
  const legacy=plain(accepted.api.captureFullSave());delete legacy.stores[STRATEGY].commandChain;delete legacy.stores[ARMY].commandResponses;legacy.stores[CORE].turn=8;legacy.stores[CORE].monthlySettledTurn=7;legacy.stores[STRATEGY].lastProcessedTurn=8;legacy.stores[ARMY].lastProcessedTurn=8;const migrated=resume(legacy);assert.equal(chain(migrated).entryTurn,8);assert.ok(chain(migrated).intents.every(x=>x.turn>=8));assert.equal(chain(migrated).consequences.length,0);
  console.log("Lord command chain regression passed: paper damage, deterministic/read-only planning, accepted/refused/blocked/busy orders, restraint, costs, actual trust floor and zero-effect deduplication, clipping, migration, full restore.");
}
if(require.main===module)tests();
module.exports={ready,resume,rejectedAttack,fixture,chain,intent,month,intervene,CORE,ARMY,STRATEGY};
