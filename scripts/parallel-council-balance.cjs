"use strict";
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict"),crypto=require("node:crypto");
const candidate=path.resolve(__dirname,".."),baseline=process.env.LORD_BASELINE_ROOT&&path.resolve(process.env.LORD_BASELINE_ROOT);
const output=process.env.LORD_BALANCE_OUTPUT||path.resolve(candidate,"../parallel-council-balance.json");
const seeds=[226001,2654435761,42424242],policies=["observe","coordinate","restrain"];
const files=["index.html",...fs.readdirSync(path.join(candidate,"src"),{recursive:true}).filter(f=>/\.(js|css)$/.test(f)).sort().map(f=>`src/${f.replaceAll("\\","/")}`)];
const fingerprint=root=>Object.fromEntries(files.filter(f=>fs.existsSync(path.join(root,f))).map(f=>[f,crypto.createHash("sha256").update(fs.readFileSync(path.join(root,f))).digest("hex")]));
const before=fingerprint(candidate),rows=[];
function eventChoice(h){const c=h.api.getState(),weights={authority:c.stats.authority<45?2:.7,security:c.stats.security<45?3:.7,treasury:c.stats.treasury<28?3:.6,officials:c.stats.officials<40?2:.6,prestige:c.stats.prestige<40?2:.5,caoAlert:c.stats.caoAlert>65?-4:-.9,leakRisk:c.hidden.leakRisk>35?-3:-.6,peopleStability:.5,loyalNetwork:.2,externalBalance:.3};return h.api.getCurrentEvent().choices.map((x,i)=>({i,x,score:Object.entries({...x.effects,...x.hidden}).reduce((s,[k,v])=>s+v*(weights[k]||0),0)})).filter(x=>!x.x.disabledReason).sort((a,b)=>b.score-a.score||a.i-b.i)[0].i;}
function play(root,version,policy,scenario,seed){
  const {harness}=require(path.join(root,"tests/helpers/game-harness")),h=harness();h.loadMechanics();h.load("command-center");h.api.startNewGame("standard",scenario.id,{randomSeed:seed});
  const trace=[],failures=[];let spent=0;
  while(!h.api.getState().ended){let c=h.api.getState();assert.ok(c.turn<=scenario.maxTurns);const choice=eventChoice(h);h.decide(choice);trace.push({turn:c.turn,kind:"decision",choice});if(h.api.getState().ended)break;
    const strategy=h.window.XianStrategyNetwork;
    const pendingCouncils=(strategy.getState().commandChain?.intents||[]).filter(i=>i.source==="autonomous"&&i.turn===c.turn&&i.status==="proposed"&&!i.intervention).sort((a,b)=>Number(b.priority||0)-Number(a.priority||0)||a.id.localeCompare(b.id)).slice(0,2);
    for(const pending of policy==="observe"?[]:pendingCouncils){
      if(h.api.getState().actionPoints<1||h.api.getState().ended)break;
      const kind=policy==="coordinate"?"coordinate":"restrain",preview=strategy.previewLordIntervention(pending.id,kind);
      if(preview.ok&&!preview.risk){const ok=strategy.interveneLordIntent(pending.id,kind);trace.push({turn:c.turn,kind,ok,accepted:preview.accepted,cost:preview.treasuryCost,reason:preview.reason});if(ok)spent+=preview.treasuryCost;else failures.push({turn:c.turn,kind,reason:"execution rejected"});}
      else failures.push({turn:c.turn,kind,reason:preview.risk?"active ceasefire: no automatic consent":preview.message});
    }
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
  rows.push(row);fs.writeFileSync(output,JSON.stringify({seeds,policies,sourceBefore:before,baselineSource:baseline&&fingerprint(baseline),rows},null,2));console.log(JSON.stringify({version,scenario:row.scenario,seed,policy,turn:c.turn,accepted:row.accepted,refused:row.refused,restrained:row.restrained,captures:row.captures}));
}
const {harness}=require(path.join(candidate,"tests/helpers/game-harness")),scenarios=harness().window.GAME_DATA.scenarios.filter(s=>!process.env.LORD_SCENARIO||s.id===process.env.LORD_SCENARIO);
for(const scenario of scenarios)for(const seed of seeds){if(baseline)play(baseline,"2.26.0","observe",scenario,seed);for(const policy of policies)play(candidate,"2.27.0",policy,scenario,seed);}
assert.deepEqual(fingerprint(candidate),before,"game source must remain fixed throughout paired sampling");
const groups=[...new Set(rows.map(r=>`${r.version}/${r.policy}`))].map(key=>{const list=rows.filter(r=>`${r.version}/${r.policy}`===key);return {key,runs:list.length,deadline:list.filter(r=>!r.early).length,actions:list.reduce((s,r)=>s+r.actions,0),spent:list.reduce((s,r)=>s+r.spent,0),proposals:list.reduce((s,r)=>s+r.proposals,0),accepted:list.reduce((s,r)=>s+r.accepted,0),refused:list.reduce((s,r)=>s+r.refused,0),restrained:list.reduce((s,r)=>s+r.restrained,0),autonomousOrders:list.reduce((s,r)=>s+r.autonomousOrders,0),courtOrders:list.reduce((s,r)=>s+r.courtOrders,0),captures:list.reduce((s,r)=>s+r.captures,0),trustPenalties:list.reduce((s,r)=>s+r.trustPenalties,0)};});
fs.writeFileSync(output,JSON.stringify({seeds,policies,sourceBefore:before,sourceAfter:fingerprint(candidate),baselineSource:baseline&&fingerprint(baseline),groups,rows},null,2));console.log(JSON.stringify({runs:rows.length,groups},null,2));
