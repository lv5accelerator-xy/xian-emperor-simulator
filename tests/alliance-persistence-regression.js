"use strict";
const assert=require("node:assert/strict");
const {plain}=require("./helpers/game-harness");
const {alliedFixture,seal,pact,plans}=require("./alliance-coalition-regression");
const {resume,month,CORE,ARMY,STRATEGY}=require("./lord-command-chain-regression");
const clocks=new Set(["updatedAt","createdAt","gameCreatedAt","capturedAt","exportedAt","startedAt","completedAt","timestamp"]);
function normalize(value,key="") {
  if(clocks.has(key)||/Timestamp$/.test(key))return "<time>";
  if(Array.isArray(value)){const list=value.map(v=>normalize(v));return ["intents","orders"].includes(key)?list.sort((a,b)=>a.id.localeCompare(b.id)):list;}
  if(value&&typeof value==="object")return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,normalize(v,k)]));
  return typeof value==="string"?value.replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/g,"<game>").replace(/\b\d{13,}\b/g,"<clock>").replace(/<clock>-[a-z0-9]{5,}/g,"<clock>-<nonce>"):value;
}
function trace(mode,delay=0,restore=false,reverse=false){
  let h=alliedFixture(({s,a})=>{if(mode==="refusal")s.strategies.gongsun_zan.trust=0;if(mode==="withdrawal"){s.cities.luoyang.controller="liu_biao";s.cities.luoyang.defense=100;}if(reverse){s.commandChain.intents.reverse();a.armies=Object.fromEntries(Object.entries(a.armies).reverse());}});
  const reload=()=>{h.advance(delay);const records=()=>normalize(Object.fromEntries(Object.entries(h.stores()).map(([k,v])=>{try{return [k,JSON.parse(v)];}catch{return [k,v];}})));const before=records();h.api.commit("idempotent-step");assert.deepEqual(records(),before,`${mode}: another commit must not settle a missing secondary-store result`);if(restore)h=resume(plain(h.api.captureFullSave()));};
  seal(h,mode==="betrayal"?"令袁绍与公孙瓒结盟":mode==="withdrawal"?"令袁绍与公孙瓒结盟，合攻洛阳":undefined);reload();
  if(mode==="coordinate"||mode==="restrain")assert.equal(h.window.XianStrategyNetwork.interveneCoalition(plans(h)[0].id,mode==="coordinate"?"coordinate":"restrain"),true);
  if(mode==="betrayal")assert.equal(h.window.XianArmySystem.issueMapOrder("yuan_main","ji","attack").ok,true);
  reload();
  for(let n=0;n<5&&!h.api.getState().ended;n++){
    month(h);reload();
    if(mode==="withdrawal"&&n===0){if(!h.api.getState().eventResolved)h.decide(0);assert.equal(h.window.XianArmySystem.issueMapOrder("yuan_main","ye","retreat").ok,true);reload();}
  }
  const a=h.window.XianArmySystem.getState(),d=h.window.XianStrategyNetwork.getState().allianceDiplomacy;
  assert.equal(new Set(a.orders.map(o=>o.id)).size,a.orders.length);assert.equal(new Set(a.commandResponses.map(o=>o.id)).size,a.commandResponses.length);assert.equal(new Set(d.consequences.map(o=>o.id)).size,d.consequences.length);
  assert.equal(pact(h).status,mode==="refusal"?"refused":["betrayal","withdrawal"].includes(mode)?"broken":"fulfilled");
  return normalize(plain(h.api.captureFullSave()).stores);
}
for(const mode of ["coordinate","autonomous","restrain","betrayal","withdrawal","refusal"]){const expected=trace(mode);for(const delay of [50,500])assert.deepEqual(trace(mode,delay),expected,`${mode}: delay ${delay}`);assert.deepEqual(trace(mode,0,true),expected,`${mode}: all stores restore`);assert.deepEqual(trace(mode,0,false,true),expected,`${mode}: insertion order`);}
for(const paid of [false,true]){
  const h=alliedFixture();seal(h);const before=plain(h.api.captureFullSave()),id=plans(h)[0].id;
  assert.equal(h.window.XianStrategyNetwork.interveneCoalition(id,"coordinate"),true);const after=plain(h.api.captureFullSave());
  const staged=plain(paid?after:before);staged.stores[STRATEGY]=plain(before.stores[STRATEGY]);staged.stores[ARMY]=plain(before.stores[ARMY]);
  staged.stores[STRATEGY].allianceDiplomacy.plans[0].intervention=after.stores[STRATEGY].allianceDiplomacy.plans[0].intervention;
  const restored=resume(staged);assert.equal(restored.api.getState().actionPoints,paid?0:1);assert.equal(restored.window.XianArmySystem.getState().orders.length,paid?2:0);
  const expected=normalize(plain(restored.api.captureFullSave()).stores);restored.api.commit("repeat-coalition-recovery");assert.deepEqual(normalize(plain(restored.api.captureFullSave()).stores),expected);
}
// Actual paid map replacement follows the earlier paid joint mandate after interruption.
const h=alliedFixture(({c})=>c.actionPoints=3);seal(h);const before=plain(h.api.captureFullSave()),id=plans(h)[0].id;
assert.equal(h.window.XianStrategyNetwork.interveneCoalition(id,"coordinate"),true);
const beforeMap=plain(h.api.captureFullSave()),preview=plain(h.window.XianArmySystem.previewMapOrder("yuan_main","ji","attack"));
assert.equal(h.window.XianArmySystem.issueMapOrder("yuan_main","ji","attack",{replaceExisting:true,expectedOrderId:preview.expectedOrderId}).ok,true);
const after=plain(h.api.captureFullSave()),response=after.stores[ARMY].commandResponses.findLast(r=>r.request?.source==="map");
const interrupted=plain(after);interrupted.stores[ARMY]=plain(before.stores[ARMY]);interrupted.stores[STRATEGY]=plain(before.stores[STRATEGY]);
interrupted.stores[STRATEGY].allianceDiplomacy.plans[0].intervention=beforeMap.stores[STRATEGY].allianceDiplomacy.plans[0].intervention;
interrupted.stores[ARMY].pendingMapCommands=[{id:response.intentId,receiptId:response.intentId,turn:1,gameCreatedAt:before.stores[CORE].createdAt,armyId:"yuan_main",targetCityId:"ji",task:"attack",replaceExisting:true,expectedOrderId:preview.expectedOrderId,preview}];
const recovered=resume(interrupted);assert.equal(recovered.api.getState().actionPoints,0);
assert.equal(recovered.window.XianArmySystem.getState().armies.yuan_main.targetCityId,"ji","recover earlier coalition before the later explicit map replacement");
assert.equal(pact(recovered).status,"broken");assert.equal(recovered.window.XianStrategyNetwork.getState().allianceDiplomacy.consequences.length,1);
console.log("Alliance persistence passed: 30 complete-store traces, 0/50/500ms, restore/permutations, paid/unpaid joint interruption and chronological map replacement.");
module.exports={normalize,trace};
