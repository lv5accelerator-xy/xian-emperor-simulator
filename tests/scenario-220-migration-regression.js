"use strict";
const assert=require("node:assert/strict");
const {plain,CORE_KEY}=require("./helpers/game-harness");
const {ready,play}=require("./helpers/scenario-220-playthrough");
let groups=0;
function check(name,fn){fn();groups++;console.log(`PASS ${name}`);}
function reload(r){const h=ready(r.stores());h.node("continue-game-btn").click();h.flush();return h;}
const midway=play("negotiate",224,{stopAt:9});
check("choice and follow-up receipts share the core effects snapshot",()=>{
 const c=midway.core,s=midway.run.window.XianScenario220Story;
 for(const id of Object.keys(c.story220.decisions))assert.ok(c.appliedReceipts.includes(s.decisionReceipt(c,id)));
 for(const echo of c.story220.consequences.filter(x=>x.status!=="pending"))assert.ok(c.appliedReceipts.includes(s.echoReceipt(c,echo.id)));
 const before=plain({stats:c.stats,hidden:c.hidden,random:c.random,story:c.story220,receipts:c.appliedReceipts});
 for(let i=0;i<5;i++)midway.run.api.commit("repeat-story-checkpoint");
 const after=midway.run.api.getState();assert.deepEqual(plain({stats:after.stats,hidden:after.hidden,random:after.random,story:after.story220,receipts:after.appliedReceipts}),before);
});
check("receipt-only lost choices remain unknown and cannot reschedule or deadlock",()=>{
 const bundle=plain(midway.run.api.captureFullSave()),c=bundle.stores[CORE_KEY];
 delete c.story220.decisions.story220_petition;
 c.currentEventId="story220_petition";c.eventResolved=false;
 const r=ready();assert.equal(r.api.restoreFullSave(bundle),true);const h=reload(r);
 assert.equal(h.api.getState().eventResolved,true);
 const before=plain(h.api.getState().stats);assert.equal(h.node("event-choices").querySelectorAll("[data-choice-index]").length,0);h.api.commit("receipt-only-load");assert.deepEqual(plain(h.api.getState().stats),before);
 h.api.endTurn();h.flush();assert.notEqual(h.api.getCurrentEvent().id,"story220_petition");
 assert.ok(!h.api.getState().story220.decisions.story220_petition);
});
check("receipt-only echo loss does not recreate rewards or narrate failure",()=>{
 const c=plain(midway.core),s=midway.run.window.XianScenario220Story;
 const e=c.story220.consequences.find(item=>item.id==="shrine_register");e.status="pending";e.resolvedTurn=null;e.actual=null;
 assert.equal(s.settle(c,()=>assert.fail("receipt-proven effect cannot be applied again")),true);
 assert.equal(c.story220.consequences.find(item=>item.id==="shrine_register").status,"unknown");
 const text=s.buildEvent("story220_seal",c).text;assert.match(text,/记录缺失/);assert.doesNotMatch(text,/未确认完整保护名册/);
});
check("ordinary full import overrides the previous runtime short identity",()=>{
 const r=ready();assert.equal(r.window.XianShortChallenges.start("abdication_eve"),true);r.flush();
 assert.ok(!r.api.getState().story220);assert.equal(r.api.restoreFullSave(plain(midway.run.api.captureFullSave())),true);
 assert.ok(r.api.getState().story220,"migration must use incoming bundle identity");
 const h=reload(r);assert.equal(h.api.getCurrentEvent().id,"story220_seal");assert.equal(h.api.getState().eventResolved,false);
});
check("short full import overrides ordinary identity without main-story state",()=>{
 const short=ready();short.window.XianShortChallenges.start("abdication_eve");short.flush();
 const r=ready();r.api.startNewGame("standard","yankang_220",{randomSeed:225});
 assert.equal(r.api.restoreFullSave(plain(short.api.captureFullSave())),true);
 assert.ok(!r.api.getState().story220);const h=reload(r);assert.ok(!h.api.getState().story220);
 assert.equal(h.api.getCurrentEvent().id,short.api.getCurrentEvent().id);
});
check("sourced outcomes do not also enter generic delayed consequences",()=>{
 const r=play("negotiate",224,{stopAt:4}).run;
 const echo=JSON.parse(r.localStorage.getItem("xian_emperor_consequence_echoes_v220"));
 assert.ok(!JSON.stringify(echo).includes("story220_petition"),"main story owns delayed effects");
 const c=plain(r.api.getState());delete c.story220;
 r.localStorage.setItem(CORE_KEY,JSON.stringify(c));const h=reload(r);
 assert.deepEqual(plain(h.api.getState().story220.decisions),{});assert.equal(h.api.getState().story220.entryTurn,4);
});
console.log(`Scenario 220 migration regression passed: ${groups} groups.`);
