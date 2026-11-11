"use strict";
const assert=require("node:assert/strict");
const {plain}=require("./helpers/game-harness");
const {alliedFixture,seal}=require("./alliance-coalition-regression");
const {resume,month,CORE,STRATEGY,ARMY}=require("./lord-command-chain-regression");
const parties=["yuan_shao","gongsun_zan"],text="令袁绍与公孙瓒结盟";
function choose(h){if(!h.api.getState().eventResolved){const event=h.api.getCurrentEvent();h.decide(event.choices.findIndex(c=>!c.disabledReason));}}
function peacefulFixture(patch=()=>{}){
 const initial=alliedFixture(patch),b=plain(initial.api.captureFullSave()),world=b.stores[Object.keys(b.stores).find(k=>k.includes("world_v"))];
 for(const id of parties)world.lords[id]={...(world.lords[id]||{}),caution:95,expansion:5};
 return resume(b);
}
function betrayedFixture(patch=()=>{}){const h=peacefulFixture(patch);seal(h,text);assert.equal(h.window.XianArmySystem.issueMapOrder("yuan_main","ji","attack").ok,true);month(h);choose(h);return h;}
const relation=h=>plain(h.window.XianStrategyNetwork.getState().diplomaticRelations);
const act=(h,kind)=>h.window.XianStrategyNetwork.performDiplomaticAction(kind,parties);
function recover(h){
 assert.equal(act(h,"peace"),true);const start=h.api.getState().turn;
 while(h.api.getState().turn<start+2)month(h);choose(h);assert.equal(act(h,"repair"),true);
 while(h.api.getState().turn<start+4)month(h);choose(h);seal(h,text);
 return h;
}
const cases={
 realliance(){const h=betrayedFixture();seal(h,text);const p=h.window.XianStrategyNetwork.getState().promises.find(p=>p.type==="alliance");assert.equal(p.status,"refused","an immediate signature cannot bypass the victim's unresolved relationship grievance");assert.match(p.contract.receipts.map(r=>r.reason).join("；"),/修好|议和|旧怨/);},
 preview(){const h=betrayedFixture(),before=h.stores(),rng=plain(h.api.getState().random);assert.equal(typeof h.window.XianStrategyNetwork.previewDiplomaticAction,"function","postwar negotiation must have a real read-only preview");const p=h.window.XianStrategyNetwork.previewDiplomaticAction("peace",parties);assert.equal(p.ok,true);assert.equal(p.accepted,true);assert.equal(p.treasuryCost,2);assert.deepEqual(h.stores(),before);assert.deepEqual(plain(h.api.getState().random),rng);},
 peace(){const h=betrayedFixture(),before=plain(h.api.getState()),past=plain(h.window.XianArmySystem.getState().militaryFacts);assert.equal(act(h,"peace"),true);assert.equal(h.api.getState().actionPoints,before.actionPoints-1);assert.equal(h.api.getState().stats.treasury,before.stats.treasury-2);assert.equal(relation(h).treaties[0].status,"active");assert.ok(relation(h).treaties[0].consents.every(r=>r.status==="accepted"));assert.ok(!["attack","siege"].includes(h.window.XianArmySystem.getState().armies.yuan_main.task));assert.deepEqual(plain(h.window.XianArmySystem.getState().militaryFacts),past,"peace must preserve prior hostile facts");},
 recovery(){const h=betrayedFixture();assert.equal(h.window.XianStrategyNetwork.previewDiplomaticAction("repair",parties).ok,false);recover(h);
  assert.equal(h.window.XianStrategyNetwork.getState().promises.find(p=>p.type==="alliance").status,"active");
  assert.equal(relation(h).treaties[0].status,"fulfilled");assert.ok(relation(h).requests.some(r=>r.kind==="repair"&&r.accepted));
  for(let i=0;i<5;i++)month(h);const s=h.window.XianStrategyNetwork.getState();assert.equal(relation(h).repairs.length,1);
  const v=h.window.XianDiplomaticEndings.preview(h.api.getState());assert.equal(v.counts.courtBreaches,1);assert.equal(v.counts.unresolvedCourtBreaches,0,"peace, acknowledged repair and a later alliance term must reach the same ending assessment");assert.equal(v.counts.peaceSettlements,1);assert.equal(v.counts.reconciliationMissions,1);
 },
 legacyIgnoredFacts(){const h=betrayedFixture(),b=plain(h.api.captureFullSave());delete b.stores[STRATEGY].allianceDiplomacy;delete b.stores[STRATEGY].diplomaticRelations;
  const a=resume(b),d=a.window.XianStrategyNetwork.getState().allianceDiplomacy;assert.equal(d.consequences.length,0,"a migration that explicitly ignored old facts cannot issue new historical penalties");assert.equal(d.reputations.yuan_shao,undefined);
 },
 clippedPeace(){const h=betrayedFixture();act(h,"peace");for(let i=0;i<4;i++)month(h);assert.equal(relation(h).treaties[0].status,"fulfilled");const b=plain(h.api.captureFullSave());b.stores[ARMY].militaryFacts=[];b.stores[ARMY].militaryFactsStartTurn=h.api.getState().turn;b.stores[ARMY].diplomaticPeaceResponses=[];
  const a=resume(b);assert.equal(relation(a).treaties[0].status,"fulfilled","confirmed peace observation survives clipped source histories");assert.equal(relation(a).periods.filter(p=>p.kind==="peace").length,1);
 },
 refusalAndBudget(){const h=betrayedFixture(),b=plain(h.api.captureFullSave()),world=b.stores[Object.keys(b.stores).find(k=>k.includes("world_v"))];for(const id of parties)world.lords[id]={...(world.lords[id]||{}),expansion:100,caution:0};const a=resume(b),before=plain(a.api.getState());
  assert.equal(a.window.XianStrategyNetwork.previewDiplomaticAction("peace",parties).accepted,false);assert.equal(act(a,"peace"),true);assert.equal(a.api.getState().actionPoints,before.actionPoints-1);assert.equal(relation(a).treaties.length,0);assert.equal(relation(a).requests[0].accepted,false);
  const stores=a.stores();assert.equal(act(a,"peace"),false,"a repeated same-month request cannot charge twice");assert.deepEqual(a.stores(),stores);
 },
 overlappingBreach(){const h=recover(betrayedFixture(({s})=>s.cities.xudu.controller="gongsun_zan"));month(h);choose(h);seal(h,"令袁绍与公孙瓒结盟，共讨刘表，合攻洛阳");
  const network=h.window.XianStrategyNetwork,plan=network.getState().allianceDiplomacy.plans.find(p=>p.turn===h.api.getState().turn);assert.ok(plan);assert.equal(network.interveneCoalition(plan.id,"coordinate"),true);month(h);choose(h);
  const api=h.window.XianArmySystem,a=api.getState(),order=a.orders.find(o=>o.id===a.armies.yuan_main.currentOrderId);assert.ok(order?.sourceCoalitionPlanId,"fixture must have a real unfinished joint order");assert.equal(order.arrivedTurn,null);
  const p=api.previewMapOrder("yuan_main","xudu","attack");assert.equal(p.ok,true);
  const before=h.window.XianStrategyNetwork.getState().allianceDiplomacy.consequences.length;
  assert.equal(api.issueMapOrder("yuan_main","xudu","attack",{replaceExisting:true,expectedOrderId:p.expectedOrderId}).ok,true);
  const d=h.window.XianStrategyNetwork.getState().allianceDiplomacy;
  assert.equal(d.consequences.length,before+1,"one explicit map replacement breaking peace and overlapping alliance terms is one root action");
  assert.equal(relation(h).treaties[0].status,"broken");
  const summary=h.window.XianDiplomaticRelations.summary(h.window.XianStrategyNetwork.getState(),h.api.getState());
  assert.equal(summary.peaceSettlements,1,"later breach does not erase the prior completed peace observation");assert.equal(summary.currentPeaceSettlements,0);
 },
 battleOutcome(){const h=betrayedFixture(({a})=>Object.assign(a.armies.youzhou_cavalry,{cityId:"ji",originCityId:"ji",targetCityId:"ji",troops:1500,maxTroops:1500}));
  const battle=h.window.XianArmySystem.getState().militaryFacts.find(f=>f.kind==="battle");assert.ok(battle);assert.equal(battle.victor,"yuan_shao");
  const p=h.window.XianDiplomaticRelations.pair(h.window.XianStrategyNetwork.getState(),...parties);
  assert.ok(p.weariness.gongsun_zan>p.weariness.yuan_shao,"a real defeat must weigh more heavily on peace willingness than winning the same battle");
 },
 thirdParty(){const h=betrayedFixture(({a,s})=>{Object.assign(a.armies.jingzhou_navy,{cityId:"luoyang",originCityId:"luoyang",targetCityId:"luoyang",troops:6000,maxTroops:6000,status:"engaged",task:"attack",currentOrderId:"third-war",supply:90});
   a.orders.push({id:"third-war",turn:1,armyId:"jingzhou_navy",owner:"liu_biao",task:"attack",originCityId:"luoyang",targetCityId:"luoyang",targetOwner:"cao_cao",routeIds:[],status:"executing",authority:"lord"});s.cities.luoyang.defense=100;s.cities.luoyang.supply=90;});
  const before=plain(h.window.XianArmySystem.getState());assert.equal(before.sieges.luoyang.status,"active");assert.equal(act(h,"peace"),true);const after=h.window.XianArmySystem.getState();
  assert.deepEqual(plain(after.armies.jingzhou_navy),before.armies.jingzhou_navy);assert.deepEqual(plain(after.sieges.luoyang),before.sieges.luoyang);
  assert.equal(h.window.XianDiplomaticRelations.atPeace("yuan_shao","liu_biao",h.window.XianStrategyNetwork.getState()),false);
 },
 positiveMemory(){const h=peacefulFixture();for(let term=0;term<3;term++){choose(h);seal(h,text);for(let m=0;m<5;m++)month(h);}choose(h);
  const s=plain(h.window.XianStrategyNetwork.getState()),a=h.window.XianArmySystem.getState(),c=h.api.getState(),neutral=plain(s);delete neutral.diplomaticRelations;
  const world={lords:{yuan_shao:{expansion:70,caution:50}}};let before,after;
  for(let n=0;n<200&&!before;n++){const k=`goodwill-${n}`,p=h.window.XianLordIntentions.proposeBatch(c,neutral,a,world,k).find(i=>i.owner==="yuan_shao"&&i.task==="attack"&&i.targetOwner==="gongsun_zan");if(p){before=p;after=h.window.XianLordIntentions.proposeBatch(c,s,a,world,k).find(i=>i.owner==="yuan_shao");}}
  assert.ok(before);assert.ok(after);assert.equal(after.task,"defend");assert.match(after.relationshipReason,/长期守约/);
 },
 autonomousReneging(){const h=betrayedFixture();act(h,"peace");const army=h.window.XianArmySystem,p=army.previewMapOrder("yuan_main","ye","defend");assert.equal(p.ok,true);assert.equal(army.issueMapOrder("yuan_main","ye","defend").ok,true);for(let i=0;i<2;i++)month(h);choose(h);
  const b=plain(h.api.captureFullSave()),s=b.stores[STRATEGY],world=b.stores[Object.keys(b.stores).find(k=>k.includes("world_v"))];s.strategies.yuan_shao.trust=20;world.lords.yuan_shao={...world.lords.yuan_shao,expansion:95,caution:5};let intent;
  for(let n=0;n<200&&!intent;n++)intent=h.window.XianLordIntentions.proposeBatch(b.stores[CORE],s,b.stores[ARMY],world,`reneging-${n}`).find(i=>i.owner==="yuan_shao"&&i.betrayalPactId);
  assert.ok(intent,"a distrusting expansionist can reconsider a still resentful peace");s.commandChain.intents=[intent];const a=resume(b),courtBefore=a.window.XianStrategyNetwork.getState().strategies.gongsun_zan.trust;month(a);
  assert.equal(relation(a).treaties[0].status,"broken");const consequences=a.window.XianStrategyNetwork.getState().allianceDiplomacy.consequences;
  assert.equal(consequences.filter(c=>c.responsibility==="court").length,1);assert.equal(consequences.filter(c=>c.responsibility==="lord").length,1);assert.equal(a.window.XianStrategyNetwork.getState().strategies.gongsun_zan.trust,courtBefore);
 },
 invalidAndCooldown(){const h=peacefulFixture(),stores=h.stores();assert.equal(h.window.XianStrategyNetwork.previewDiplomaticAction("peace",parties).ok,false);assert.equal(act(h,"peace"),false);assert.deepEqual(h.stores(),stores);
  const a=betrayedFixture();act(a,"peace");assert.equal(a.window.XianStrategyNetwork.previewDiplomaticAction("repair",parties).ok,false);month(a);choose(a);assert.equal(a.window.XianStrategyNetwork.previewDiplomaticAction("repair",parties).ok,false);
  month(a);choose(a);assert.equal(act(a,"repair"),true);const after=a.stores();assert.equal(act(a,"repair"),false);assert.deepEqual(a.stores(),after);
 },
};
if(require.main===module)for(const [name,run] of Object.entries(cases))if(!process.argv[2]||process.argv[2]===name){run();console.log(`PASS diplomatic relations ${name}`);}
module.exports={parties,text,choose,peacefulFixture,betrayedFixture,relation,act,recover,cases};
