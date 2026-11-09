"use strict";
const assert=require("node:assert/strict");
const {plain}=require("./helpers/game-harness");
const {fixture,resume,chain,intent,month,intervene,CORE,ARMY,STRATEGY}=require("./lord-command-chain-regression");
const clock=new Set(["updatedAt","createdAt","gameCreatedAt","capturedAt","exportedAt","startedAt","completedAt","timestamp","lastReportTimestamp","v041LastCorrectedTimestamp","lastCoreReportTimestamp"]);
function normalize(x,key=""){
  if(clock.has(key)||/Timestamp$/.test(key))return "<time>";
  if(Array.isArray(x))return x.map(v=>normalize(v));
  if(x&&typeof x==="object")return Object.fromEntries(Object.entries(x).map(([k,v])=>[k,normalize(v,k)]));
  return typeof x==="string"?x.replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/g,"<game>").replace(/\b\d{13,}\b/g,"<clock>").replace(/<clock>-[a-z0-9]{5,}/g,"<clock>-<nonce>"):x;
}
function peace(h){h.edict("令袁绍与曹操停战");assert.equal(h.window.XianStrategyNetwork.getState().promises[0].status,"active");}
function peaceFixture(){return fixture(({s,intent})=>{s.cities.jinyang.controller="cao_cao";intent.targetOwner="cao_cao";});}
const safe=peaceFixture();peace(safe);const risk=safe.window.XianStrategyNetwork.previewLordIntervention(intent(safe).id,"coordinate");assert.equal(risk.risk,true);const ap=safe.api.getState().actionPoints;assert.equal(intervene(safe),false);assert.equal(safe.api.getState().actionPoints,ap);month(safe);assert.equal(intent(safe).status,"refused");assert.equal(chain(safe).consequences.length,0,"an autonomous commander respects an active ceasefire");
const breach=peaceFixture();peace(breach);const trust=breach.window.XianStrategyNetwork.getState().strategies.yuan_shao.trust;assert.equal(intervene(breach,"coordinate",true),true);assert.equal(breach.window.XianStrategyNetwork.getState().promises[0].status,"broken");assert.equal(breach.window.XianStrategyNetwork.getState().strategies.yuan_shao.trust,trust-13);const breachSaved=resume(plain(breach.api.captureFullSave()));assert.equal(breachSaved.window.XianStrategyNetwork.getState().promises[0].contract.receipts.length,1);assert.equal(breachSaved.window.XianStrategyNetwork.getState().strategies.yuan_shao.trust,trust-13);assert.equal(chain(breachSaved).consequences[0].promiseIds.length,1);
const clippedPromise=plain(breach.api.captureFullSave());clippedPromise.stores[STRATEGY].promises=[];assert.equal(chain(resume(clippedPromise)).consequences[0].promiseIds.length,1,"display-only promise clipping cannot erase already observed diplomatic links");
const field=fixture(({a})=>{a.armies.cao_central.cityId="jinyang";a.armies.cao_central.targetCityId="jinyang";});peace(field);assert.equal(field.window.XianStrategyNetwork.previewLordIntervention(intent(field).id,"coordinate").risk,true,"a treaty partner's field army at a third-party city also requires explicit consent");month(field);assert.equal(intent(field).status,"refused");assert.equal(field.window.XianStrategyNetwork.getState().promises[0].status,"active");
const direct=fixture(({intent})=>intent.status="restrained"),walls=direct.window.XianStrategyNetwork.getState().cities.jinyang.defense;direct.edict("令袁绍攻取晋阳");assert.equal(direct.window.XianStrategyNetwork.getState().cities.jinyang.defense,walls);const decreeIntent=chain(direct).intents.find(i=>i.source==="edict");assert.ok(decreeIntent.orderId);assert.equal(decreeIntent.owner,"yuan_shao");assert.equal(decreeIntent.status,"marching");
const endedSource=fixture();peace(endedSource);const ended=plain(endedSource.api.captureFullSave());Object.assign(ended.stores[CORE],{ended:true,turn:8,monthlySettledTurn:8});ended.stores[ARMY].lastProcessedTurn=9;ended.stores[STRATEGY].lastProcessedTurn=9;const archivedTrust=ended.stores[STRATEGY].strategies.yuan_shao.trust,archived=resume(ended);assert.equal(archived.window.XianStrategyNetwork.getState().promises[0].status,"active","ended archives do not retrospectively settle legacy promises");assert.equal(archived.window.XianStrategyNetwork.getState().strategies.yuan_shao.trust,archivedTrust);
// A crash between the action receipt and the army response resumes the response,
// while an unspent provisional request is rolled back and can be retried.
for(const paid of [false,true]){
  const b=plain(fixture().api.captureFullSave()),i=b.stores[STRATEGY].commandChain.intents[0],receipt=`lord-intervention:${i.id}`;
  i.intervention={kind:"coordinate",receiptId:receipt,turn:1,acknowledgeBreach:false};
  if(paid){b.stores[CORE].appliedReceipts.push(receipt);b.stores[CORE].actionPoints--;b.stores[CORE].stats.treasury--;}
  const h=resume(b);assert.equal(h.api.getState().actionPoints,paid?1:2);assert.equal(h.window.XianArmySystem.getState().orders.length,paid?1:0);
  if(paid){assert.equal(intent(h).status,"marching");assert.equal(intervene(h),false);}else{assert.equal(intent(h).intervention,undefined);assert.equal(intervene(h),true);}
}
// Changes of control during a march create new frozen victim evidence. They do
// not rewrite the earlier request or turn the new holder into the old victim.
const changed=fixture();intervene(changed);const earlier=chain(changed).consequences[0];changed.window.XianStrategyNetwork.applyCampaignEffects({cities:{jinyang:{controller:"cao_cao",controllerName:"曹操"}}});month(changed);assert.equal(chain(changed).consequences[0].defenderOwner,"liu_biao");assert.deepEqual(chain(changed).consequences[0],earlier);assert.ok(chain(changed).consequences.some(c=>c.defenderOwner==="cao_cao"));
function trace(mode,delay=0,restore=false){
  let h=mode==="breach"?peaceFixture():fixture(mode==="refused"?({a})=>a.armies.yuan_main.supply=5:mode==="reject-restraint"?({c})=>c.stats.authority=20:()=>{});
  const reload=()=>{if(restore)h=resume(plain(h.api.captureFullSave()));};reload();
  if(mode==="breach"){peace(h);intervene(h,"coordinate",true);}
  else if(mode==="coordinate")intervene(h);
  else if(mode==="restrain"||mode==="reject-restraint")intervene(h,"restrain");
  h.advance(delay);reload();
  for(let n=0;n<5&&!h.api.getState().ended;n++){month(h);h.advance(delay);reload();}
  if(["coordinate","autonomous","reject-restraint","breach"].includes(mode))assert.ok(chain(h).consequences.some(c=>c.kind==="occupation"),`${mode} must reach actual capture`);
  const facts=h.window.XianArmySystem.getState().militaryFacts;assert.equal(new Set(facts.map(f=>f.id)).size,facts.length);
  const responses=h.window.XianArmySystem.getState().commandResponses;assert.equal(new Set(responses.map(r=>r.id)).size,responses.length);
  return normalize(plain(h.api.captureFullSave()).stores);
}
for(const mode of ["coordinate","autonomous","restrain","reject-restraint","refused","breach"]){const base=trace(mode);for(const delay of [50,500])assert.deepEqual(trace(mode,delay),base,`${mode} timing ${delay}`);assert.deepEqual(trace(mode,0,true),base,`${mode} full-save at every stage`);}
// The final ordinary month must finish army work before grading the campaign.
const last=fixture(({c,s,a,intent})=>{c.turn=24;c.year=197;c.month=12;c.monthlySettledTurn=23;s.lastProcessedTurn=24;a.lastProcessedTurn=24;intent.turn=24;intent.dueTurn=24;intent.id+="final";});month(last);assert.equal(last.api.getState().ended,true);assert.ok(last.window.XianArmySystem.getState().commandResponses.length>0);assert.notEqual(intent(last).status,"proposed");const final=resume(plain(last.api.captureFullSave()));assert.deepEqual(chain(final),chain(last));
console.log("Lord command persistence passed: ceasefire consent and exact penalty, third-party ownership, paid/unpaid interruption, 24 full-store seeded traces with 0/50/500ms and repeated restore, actual captures, final month.");
module.exports={normalize};
