"use strict";
const assert=require("node:assert/strict");
const {plain}=require("./helpers/game-harness");
const {betrayedFixture,choose,parties,text,act}=require("./diplomatic-relations-regression");
const {seal}=require("./alliance-coalition-regression");
const {resume,month,CORE,STRATEGY,ARMY}=require("./lord-command-chain-regression");
const clocks=new Set(["updatedAt","createdAt","gameCreatedAt","capturedAt","exportedAt","startedAt","completedAt","timestamp"]);
function normalized(value,key=""){
 if(clocks.has(key)||/Timestamp$/.test(key))return "<time>";
 if(Array.isArray(value)){const list=value.map(v=>normalized(v));return ["orders","intents"].includes(key)?list.sort((a,b)=>a.id.localeCompare(b.id)):list;}
 if(value&&typeof value==="object")return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,normalized(v,k)]));
 return typeof value==="string"?value.replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/g,"<game>").replace(/\b\d{13,}\b/g,"<clock>").replace(/<clock>-[a-z0-9]{5,}/g,"<clock>-<nonce>"):value;
}
function records(h){return normalized(Object.fromEntries(Object.entries(h.stores()).map(([k,v])=>{try{return [k,JSON.parse(v)]}catch{return [k,v]}})));}
function trace(mode,delay=0,restore=false,reverse=false){
 let h=betrayedFixture(({c,s})=>{c.maxTurns=13;s.cities.xudu.controller="gongsun_zan";});
 if(mode==="refusal"||reverse){const b=plain(h.api.captureFullSave());
  if(mode==="refusal"){const w=b.stores[Object.keys(b.stores).find(k=>k.includes("world_v"))];for(const id of parties)w.lords[id]={...(w.lords[id]||{}),caution:0,expansion:100};}
  if(reverse){b.stores[ARMY].armies=Object.fromEntries(Object.entries(b.stores[ARMY].armies).reverse());b.stores[ARMY].orders.reverse();b.stores[STRATEGY].commandChain.intents.reverse();}h=resume(b);
 }
 h.load("final-verdict");
 const step=()=>{h.advance(delay);const before=records(h);h.api.commit("relations-idempotent");assert.deepEqual(records(h),before,`${mode}: immediate commit must already contain every store result`);
  if(restore){const bundle=plain(h.api.captureFullSave());h=resume(bundle);h.load("final-verdict");h.advance(delay);assert.deepEqual(records(h),before,`${mode}: complete restore`);}};
 const start=h.api.getState().turn;assert.equal(act(h,"peace"),true);step();
 while(!h.api.getState().ended){choose(h);
  if(mode==="repair"&&h.api.getState().turn===start+2){assert.equal(act(h,"repair"),true);step();}
  if(mode==="repair"&&h.api.getState().turn===start+4){seal(h,text);step();}
  if(mode==="repair"&&h.api.getState().turn===start+9){seal(h,text);step();}
  if(mode==="renege"&&h.api.getState().turn===start+2){const a=h.window.XianArmySystem,p=a.previewMapOrder("yuan_main","xudu","attack");assert.equal(p.ok,true);assert.equal(a.issueMapOrder("yuan_main","xudu","attack",{replaceExisting:true,expectedOrderId:p.expectedOrderId}).ok,true);step();}
  month(h);step();
 }
 assert.ok(h.api.getState().diplomaticOutcome?.relations);return records(h);
}
if(!process.env.RELATIONS_RECOVERY_ONLY)for(const mode of ["peace","repair","refusal","renege"]){const expected=trace(mode);for(const delay of [50,500])assert.deepEqual(trace(mode,delay),expected,`${mode}: ${delay}ms`);assert.deepEqual(trace(mode,0,true),expected,`${mode}: full restore`);assert.deepEqual(trace(mode,0,false,true),expected,`${mode}: insertion order`);}
for(const kind of ["peace","repair"])for(const paid of [false,true]){
 const h=betrayedFixture();if(kind==="repair"){act(h,"peace");month(h);month(h);choose(h);}
 const before=plain(h.api.captureFullSave());assert.equal(act(h,kind),true);const after=plain(h.api.captureFullSave()),request=after.stores[STRATEGY].diplomaticRelations.requests.findLast(r=>r.kind===kind);
 const staged=plain(paid?after:before);staged.stores[STRATEGY]=plain(before.stores[STRATEGY]);staged.stores[ARMY]=plain(before.stores[ARMY]);
 staged.stores[STRATEGY].diplomaticRelations.requests.push({...request,resolved:false,accepted:false,paymentConfirmed:false,consents:[]});
 const a=resume(staged);assert.equal(a.api.getState().actionPoints,before.stores[CORE].actionPoints-(paid?1:0));assert.equal(a.api.getState().stats.treasury,before.stores[CORE].stats.treasury-(paid?2:0));
 assert.equal(a.window.XianStrategyNetwork.getState().diplomaticRelations.requests.filter(r=>r.id===request.id&&r.accepted).length,paid?1:0);
 const expected=records(a);for(let n=0;n<3;n++)a.api.commit("repeat-paid-political-recovery");assert.deepEqual(records(a),expected);
 if(!paid){assert.equal(act(a,kind),true);assert.equal(a.api.getState().actionPoints,before.stores[CORE].actionPoints-1);}
}
// Both paid action orders must survive an interruption between the core and add-on writes.
{
const h=betrayedFixture(({s})=>s.cities.xudu.controller="gongsun_zan"),before=plain(h.api.captureFullSave());act(h,"peace");const peace=plain(h.api.captureFullSave());
const army=h.window.XianArmySystem,preview=army.previewMapOrder("yuan_main","xudu","attack");assert.equal(preview.ok,true);assert.equal(army.issueMapOrder("yuan_main","xudu","attack").ok,true);
const after=plain(h.api.captureFullSave()),response=after.stores[ARMY].commandResponses.findLast(r=>r.request?.source==="map"),staged=plain(after);
staged.stores[STRATEGY]=plain(before.stores[STRATEGY]);staged.stores[ARMY]=plain(before.stores[ARMY]);
const request=peace.stores[STRATEGY].diplomaticRelations.requests.findLast(r=>r.kind==="peace");
staged.stores[STRATEGY].diplomaticRelations.requests.push({...request,resolved:false,accepted:false,paymentConfirmed:false,consents:[]});
staged.stores[ARMY].pendingMapCommands=[{id:response.intentId,receiptId:response.intentId,turn:2,gameCreatedAt:before.stores[CORE].createdAt,armyId:"yuan_main",targetCityId:"xudu",task:"attack",replaceExisting:false,expectedOrderId:preview.expectedOrderId,preview}];
const recovered=resume(staged);assert.equal(recovered.api.getState().actionPoints,0);assert.equal(recovered.window.XianArmySystem.getState().armies.yuan_main.targetCityId,"xudu");assert.equal(recovered.window.XianStrategyNetwork.getState().diplomaticRelations.treaties[0].status,"broken");
assert.equal(recovered.window.XianStrategyNetwork.getState().allianceDiplomacy.consequences.length,2);
const stable=records(recovered);recovered.api.commit("repeat-chronological-peace-breach");assert.deepEqual(records(recovered),stable);
{
 const b=betrayedFixture(),original=plain(b.api.captureFullSave()),a=b.window.XianArmySystem,p=a.previewMapOrder("yuan_main","ye","retreat");
 assert.equal(a.issueMapOrder("yuan_main","ye","retreat",{replaceExisting:true,expectedOrderId:p.expectedOrderId}).ok,true);const mapped=plain(b.api.captureFullSave());assert.equal(act(b,"peace"),true);
 const finished=plain(b.api.captureFullSave()),mixed=plain(finished),r=finished.stores[STRATEGY].diplomaticRelations.requests.findLast(x=>x.kind==="peace"),mr=mapped.stores[ARMY].commandResponses.findLast(x=>x.request?.source==="map");
 mixed.stores[STRATEGY]=plain(original.stores[STRATEGY]);mixed.stores[ARMY]=plain(original.stores[ARMY]);mixed.stores[STRATEGY].diplomaticRelations.requests.push({...r,resolved:false,accepted:false,paymentConfirmed:false,consents:[]});
 mixed.stores[ARMY].pendingMapCommands=[{id:mr.intentId,receiptId:mr.intentId,turn:2,gameCreatedAt:original.stores[CORE].createdAt,armyId:"yuan_main",targetCityId:"ye",task:"retreat",expectedOrderId:p.expectedOrderId,preview:p}];
 const restored=resume(mixed),rs=restored.window.XianStrategyNetwork.getState(),ra=restored.window.XianArmySystem.getState();
 assert.equal(ra.commandResponses.find(x=>x.id===mr.id).status,"accepted");assert.equal(ra.armies.yuan_main.task,"retreat");assert.equal(rs.diplomaticRelations.treaties[0].status,"active");
 assert.equal(rs.allianceDiplomacy.consequences.length,1);const stable=records(restored);restored.api.commit("repeat-map-before-peace");assert.deepEqual(records(restored),stable);
}
}
console.log("Diplomatic relationship persistence passed: 20 complete-store traces, 0/50/500ms, full restores/permutations, four paid/unpaid recoveries and chronological peace-before-map recovery.");
module.exports={normalized,records,trace};
