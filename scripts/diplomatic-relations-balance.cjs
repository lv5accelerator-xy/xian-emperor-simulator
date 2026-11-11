"use strict";
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict"),crypto=require("node:crypto");
const candidate=path.resolve(process.env.DIPLOMATIC_CANDIDATE_ROOT||path.resolve(__dirname,"..")),baseline=process.env.LORD_BASELINE_ROOT&&path.resolve(process.env.LORD_BASELINE_ROOT);
const output=process.env.LORD_BALANCE_OUTPUT||path.resolve(candidate,"../alliance-coalition-balance.json");
const seeds=[226001,2654435761,42424242],policies=["observe","cooperate","betray","reconcile"];
const files=["index.html",...fs.readdirSync(path.join(candidate,"src"),{recursive:true}).filter(f=>/\.(js|css)$/.test(f)).sort().map(f=>`src/${f.replaceAll("\\","/")}`)];
const fingerprint=root=>Object.fromEntries(files.filter(f=>fs.existsSync(path.join(root,f))).map(f=>[f,crypto.createHash("sha256").update(fs.readFileSync(path.join(root,f))).digest("hex")]));
fs.mkdirSync(path.dirname(output),{recursive:true});
const reference=null,baselineReuse=null;
const fingerprintTree=root=>Object.fromEntries(["index.html",...fs.readdirSync(path.join(root,"src"),{recursive:true}).filter(f=>/\.(js|css)$/.test(f)).sort().map(f=>`src/${f.replaceAll("\\","/")}`)].map(f=>[f,crypto.createHash("sha256").update(fs.readFileSync(path.join(root,f))).digest("hex")]));
const before=fingerprint(candidate),rows=[];
function eventChoice(h){const c=h.api.getState(),weights={authority:c.stats.authority<45?2:.7,security:c.stats.security<45?3:.7,treasury:c.stats.treasury<28?3:.6,officials:c.stats.officials<40?2:.6,prestige:c.stats.prestige<40?2:.5,caoAlert:c.stats.caoAlert>65?-4:-.9,leakRisk:c.hidden.leakRisk>35?-3:-.6,peopleStability:.5,loyalNetwork:.2,externalBalance:.3};return h.api.getCurrentEvent().choices.map((x,i)=>({i,x,score:Object.entries({...x.effects,...x.hidden}).reduce((s,[k,v])=>s+v*(weights[k]||0),0)})).filter(x=>!x.x.disabledReason).sort((a,b)=>b.score-a.score||a.i-b.i)[0].i;}
function driveAlliances(h,policy,memory,trace,failures){
  let cost=0;const api=h.window.XianStrategyNetwork,model=h.window.XianAllianceDiplomacy,data=h.window.XIAN_STRATEGY_DATA;
  const core=()=>h.api.getState(),strategy=()=>api.getState(),armies=()=>h.window.XianArmySystem.getState();
  const label=id=>h.window.XianCharacterAvailability.faction(id,core()).name;
  let s=strategy(),pact=s.promises.find(p=>model.active(p,core().turn));
  if(!pact && core().actionPoints && core().turn-memory.lastOffer>=4){
    const candidates=data.lords.filter(l=>api.detectLordTargets(label(l.id)).includes(l.id)&&Object.values(armies().armies).some(a=>a.owner===l.id&&a.status!=="destroyed"&&a.troops>=500));
    const preferred=["yuan_shao","gongsun_zan"].map(id=>candidates.find(l=>l.id===id)).filter(Boolean);
    const pair=[...preferred,...candidates.filter(l=>!preferred.includes(l)).sort((a,b)=>s.strategies[b.id].trust-s.strategies[a.id].trust||a.id.localeCompare(b.id))].slice(0,memory.partyCount);
    if(pair.length===memory.partyCount){
      const units=pair.map(l=>Object.values(armies().armies).filter(a=>a.owner===l.id&&a.status!=="destroyed").sort((a,b)=>a.id.localeCompare(b.id))[0]);
      const targets=data.cities.filter(c=>pair.every(l=>!model.allied(l.id,s.cities[c.id].controller,s,core().turn)))
        .map(c=>({c,d:units.reduce((n,a)=>n+api.findRoutePath(a.cityId,c.id).length,0)})).sort((a,b)=>a.d-b.d||a.c.id.localeCompare(b.c.id));
      if(targets.length){const city=targets[0].c,text=`令${pair.map(l=>label(l.id)).join("与")}结盟，共讨${label(s.cities[city.id].controller)}，合攻${city.name}`,before=core(),preview=h.api.previewEdict(text);
        memory.lastOffer=before.turn;h.edict(text);const after=core();cost+=after.totalActions>before.totalActions?Number(preview.cost||0):0;
        const offered=strategy().promises.find(p=>p.type==="alliance"&&p.createdTurn===before.turn);
        trace.push({turn:before.turn,kind:"alliance-offer",text,ok:after.totalActions>before.totalActions,cost:preview.cost,status:offered?.status||"not-created",consents:offered?.contract?.receipts});
        if(after.totalActions===before.totalActions)failures.push({turn:before.turn,kind:"alliance-offer",reason:preview.reason||"actual edict rejected"});
      }
    }
    s=strategy();pact=s.promises.find(p=>model.active(p,core().turn));
  }
  if(!pact||!core().actionPoints||core().ended)return cost;
  if(policy==="betray"){
    let acted=false;
    for(const owner of pact.contract.parties){
      const unit=Object.values(armies().armies).filter(a=>a.owner===owner&&a.status!=="destroyed"&&a.troops>=500).sort((a,b)=>a.id.localeCompare(b.id))[0];if(!unit)continue;
      const retreat=["besieging","engaged"].includes(unit.status),target=retreat?data.lords.find(l=>l.id===owner)?.seatCity:data.cities.find(c=>pact.contract.parties.includes(s.cities[c.id].controller)&&s.cities[c.id].controller!==owner)?.id;
      if(!target||target===unit.cityId)continue;const task=retreat?"retreat":"attack",preview=h.window.XianArmySystem.previewMapOrder(unit.id,target,task);
      if(preview.ok){const result=h.window.XianArmySystem.issueMapOrder(unit.id,target,task,{replaceExisting:true,expectedOrderId:preview.expectedOrderId});trace.push({turn:core().turn,kind:"deliberate-betrayal",armyId:unit.id,target,task,ok:result.ok,cost:preview.treasuryCost,warnings:preview.warnings});if(result.ok){cost+=preview.treasuryCost;acted=true;break;}}
      else failures.push({turn:core().turn,kind:"deliberate-betrayal",actor:owner,reason:preview.message});
    }
    if(!acted && core().actionPoints){
      const owner=pact.contract.parties[0],person=h.window.XianCharacterAvailability.representative(owner,core()),fields={"modal-character-select":person.id,"regional-type":"edict"},plan=h.window.XianActionPlans.build("regional",fields,core());
      if(plan?.affordable){const ok=h.act("regional",fields);trace.push({turn:core().turn,kind:"build-command-relationship",actor:owner,ok,cost:plan.cost});if(ok)cost+=plan.cost;}
    }
  }else{
    const plan=strategy().allianceDiplomacy.plans.find(p=>p.pactId===pact.id&&p.turn===core().turn&&!p.intervention&&p.members.some(m=>m.status==="proposed"));
    if(plan){const preview=api.previewCoalitionIntervention(plan.id,"coordinate");if(preview.ok){const ok=api.interveneCoalition(plan.id,"coordinate");trace.push({turn:core().turn,kind:"coalition-coordinate",ok,cost:preview.treasuryCost,members:preview.members.map(m=>({actor:m.owner,accepted:m.accepted,reason:m.reason,eta:m.eta}))});if(ok)cost+=preview.treasuryCost;}
      else failures.push({turn:core().turn,kind:"coalition-coordinate",reason:preview.message});}
  }
  return cost;
}

function driveRepair(h,memory,trace,failures){
 const api=h.window.XianStrategyNetwork,core=()=>h.api.getState(),s=()=>api.getState();
 const breach=s().allianceDiplomacy.consequences.find(b=>b.responsibility==="court"&&b.victimOwners?.length);
 if(!breach)return driveAlliances(h,"betray",memory,trace,failures);
 const parties=[breach.actor,breach.victimOwners[0]].sort(),label=id=>h.window.XianCharacterAvailability.faction(id,core()).name;
 if(!core().actionPoints)return 0;
 if(api.previewDiplomaticAction){
  const d=s().diplomaticRelations,peace=d.treaties.find(t=>h.window.XianDiplomaticRelations.active(t)&&t.parties.every(id=>parties.includes(id)));
  const kind=peace?"repair":"peace",view=api.previewDiplomaticAction(kind,parties);
  if(view.ok&&core().turn-(memory.lastNegotiation||-10)>=2){const turn=core().turn,ok=api.performDiplomaticAction(kind,parties);memory.lastNegotiation=turn;trace.push({turn,kind:`postwar-${kind}`,ok,accepted:view.accepted,consents:view.consents,cost:ok?2:0});return ok?2:0;}
  if(!view.ok)failures.push({turn:core().turn,kind:`postwar-${kind}`,reason:view.message});
 }else if(core().turn-(memory.lastNegotiation||-10)>=4){
  const text=`令${parties.map(label).join("与")}停战`,before=core(),view=h.api.previewEdict(text);h.edict(text);memory.lastNegotiation=before.turn;
  const ok=core().totalActions>before.totalActions;trace.push({turn:before.turn,kind:"legacy-ceasefire",text,ok,cost:ok?view.cost:0});return ok?Number(view.cost||0):0;
 }
 if(core().actionPoints&&core().turn-memory.lastOffer>=4&&!s().promises.some(p=>h.window.XianAllianceDiplomacy.active(p,core().turn))){
  const text=`令${parties.map(label).join("与")}结盟`,before=core(),view=h.api.previewEdict(text);h.edict(text);memory.lastOffer=before.turn;
  const ok=core().totalActions>before.totalActions;trace.push({turn:before.turn,kind:"postwar-realliance",ok,status:s().promises.find(p=>p.createdTurn===before.turn&&p.type==="alliance")?.status,cost:ok?view.cost:0});return ok?Number(view.cost||0):0;
 }
 return 0;
}

function play(root,version,policy,scenario,seed){
  const {harness}=require(path.join(root,"tests/helpers/game-harness")),h=harness();h.loadMechanics();h.load("command-center");h.api.startNewGame("standard",scenario.id,{randomSeed:seed});
  const trace=[],failures=[],memory={lastOffer:-10,partyCount:seed===226001?2:3};let spent=0;
  while(!h.api.getState().ended){let c=h.api.getState();assert.ok(c.turn<=scenario.maxTurns);const choice=eventChoice(h);h.decide(choice);trace.push({turn:c.turn,kind:"decision",choice});if(h.api.getState().ended)break;
    const strategy=h.window.XianStrategyNetwork;
    if(policy==="reconcile")spent+=driveRepair(h,memory,trace,failures);else if(policy!=="observe")spent+=driveAlliances(h,policy,memory,trace,failures);
    for(let step=0;step<2&&!h.api.getState().ended;step++){
      c=h.api.getState();if(!c.actionPoints)break;
      const rec=h.window.XianCommandCenter.recommendAction(c);if(!rec.fields||rec.actionId==="end")break;
      const plan=h.window.XianActionPlans.build(rec.actionId,rec.fields,c);
      if(!plan?.affordable){failures.push({turn:c.turn,kind:rec.actionId,reason:"unaffordable recommendation"});break;}
      const ok=h.act(plan.actionId,plan.fields);trace.push({turn:c.turn,kind:plan.actionId,ok,cost:plan.cost});if(!ok){failures.push({turn:c.turn,kind:plan.actionId,reason:"real confirmation failed"});break;}spent+=plan.cost;
    }
    if(!h.api.getState().ended)h.api.endTurn();
  }
  const c=h.api.getState(),s=h.window.XianStrategyNetwork.getState(),a=h.window.XianArmySystem.getState(),chain=s.commandChain;
  assert.ok(c.ended);assert.ok(c.actionPoints>=0);assert.ok(c.totalActions<=c.turn*2,"all policies share the actual monthly action budget");
  const row={version,scenario:scenario.id,seed,policy,turn:c.turn,deadline:scenario.maxTurns,early:c.turn<scenario.maxTurns,ending:c.ending.title,actions:c.totalActions,spent,stats:c.stats,hidden:c.hidden,
    proposals:chain?.intents.filter(i=>i.source==="autonomous").length||0,accepted:(a.commandResponses||[]).filter(r=>r.status==="accepted").length,refused:(a.commandResponses||[]).filter(r=>r.status==="refused").length,restrained:(a.commandResponses||[]).filter(r=>r.status==="restrained").length,
    autonomousOrders:(a.commandResponses||[]).filter(r=>r.status==="accepted"&&r.authority==="lord").length,courtOrders:(a.commandResponses||[]).filter(r=>r.status==="accepted"&&r.authority==="court").length,
    facts:a.militaryFacts.length,captures:a.conquests.length,roadBattles:a.militaryFacts.filter(f=>f.kind==="battle"&&f.routeId).length,conflicts:a.commandConflicts||[],reactions:chain?.reactions||[],promiseOutcomes:chain?.promiseOutcomes||[],trustPenalties:(chain?.consequences||[]).reduce((n,x)=>n-x.trustDelta,0),intents:chain?.intents||[],consequences:chain?.consequences||[],trace,failures};
  row.random=c.random;row.diplomaticRelations=s.diplomaticRelations||null;row.diplomaticOutcome=c.diplomaticOutcome||null;row.alliances=(s.promises||[]).filter(p=>p.type==="alliance");row.allianceDiplomacy=s.allianceDiplomacy||null;row.coalitionOrders=(a.orders||[]).filter(o=>o.sourceAllianceId);row.coalitionFights=(a.militaryFacts||[]).filter(f=>f.participants?.length>1);row.finalSave=`saves/${version}-${policy}-${scenario.id}-${seed}.json`;fs.mkdirSync(path.join(path.dirname(output),"saves"),{recursive:true});fs.writeFileSync(path.join(path.dirname(output),row.finalSave),JSON.stringify(h.api.captureFullSave()));
  rows.push(row);fs.writeFileSync(output,JSON.stringify({seeds,policies,baselineReuse,protocol:{partyCountBySeed:{226001:2,2654435761:3,42424242:3}},sourceBefore:before,baselineSource:baseline&&fingerprintTree(baseline),rows},null,2));console.log(JSON.stringify({version,scenario:row.scenario,seed,policy,turn:c.turn,accepted:row.accepted,refused:row.refused,restrained:row.restrained,captures:row.captures}));
}
const {harness}=require(path.join(candidate,"tests/helpers/game-harness")),scenarios=harness().window.GAME_DATA.scenarios.filter(s=>!process.env.LORD_SCENARIO||s.id===process.env.LORD_SCENARIO);
for(const scenario of scenarios)for(const seed of seeds){for(const policy of policies){if(baseline)play(baseline,"2.29.0",policy,scenario,seed);play(candidate,process.env.DIPLOMATIC_CANDIDATE_VERSION||"2.30.0",policy,scenario,seed);}}
assert.deepEqual(fingerprint(candidate),before,"game source must remain fixed throughout paired sampling");
const groups=[...new Set(rows.map(r=>`${r.version}/${r.policy}`))].map(key=>{const list=rows.filter(r=>`${r.version}/${r.policy}`===key);return {key,runs:list.length,deadline:list.filter(r=>!r.early).length,actions:list.reduce((s,r)=>s+r.actions,0),spent:list.reduce((s,r)=>s+r.spent,0),proposals:list.reduce((s,r)=>s+r.proposals,0),accepted:list.reduce((s,r)=>s+r.accepted,0),refused:list.reduce((s,r)=>s+r.refused,0),restrained:list.reduce((s,r)=>s+r.restrained,0),autonomousOrders:list.reduce((s,r)=>s+r.autonomousOrders,0),courtOrders:list.reduce((s,r)=>s+r.courtOrders,0),captures:list.reduce((s,r)=>s+r.captures,0),trustPenalties:list.reduce((s,r)=>s+r.trustPenalties,0)};});
fs.writeFileSync(output,JSON.stringify({seeds,policies,baselineReuse,protocol:{partyCountBySeed:{226001:2,2654435761:3,42424242:3}},sourceBefore:before,sourceAfter:fingerprint(candidate),baselineSource:baseline&&fingerprintTree(baseline),groups,rows},null,2));console.log(JSON.stringify({runs:rows.length,groups},null,2));
