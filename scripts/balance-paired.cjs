"use strict";
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const source=path.resolve(process.env.BALANCE_SOURCE || path.join(__dirname,".."));
const {harness}=require(path.join(source,"tests/helpers/game-harness.js"));
const samples=Number(process.env.BALANCE_SAMPLES || 24),output=process.env.BALANCE_OUTPUT || path.resolve(__dirname,"../../balance-after.json");
const names={guard:"守成",repeat:"重复召见",rotation:"轮换旧臣召见",welfare:"民生",intrigue:"密谋",goals:"按目标补缺"};
const definitions=harness().window.XianShortChallenges.getChallenges(),rows=[];
function choose(h,d,policy){const core=h.api.getState();const weights={authority:.4,security:1.4,treasury:.6,officials:1,caoAlert:-1,leakRisk:-1};if(policy==="welfare")Object.assign(weights,{peopleStability:1.6,prestige:1,officials:.7});if(policy==="intrigue")Object.assign(weights,{loyalNetwork:1.6,escapeRoute:.6});if(policy==="goals")for(const g of d.goals){const [group,k]=g.path.split('.'),v=core[group][k];weights[k]=g.min!=null?(v<g.min+5?4:1):(v>g.max-8?-4:-.6);}return h.api.getCurrentEvent().choices.map((c,i)=>({i,s:Object.entries({...c.effects,...c.hidden}).reduce((s,[k,v])=>s+v*(weights[k]||0),0)})).sort((a,b)=>b.s-a.s||a.i-b.i)[0].i;}
for(const d of definitions)for(const policy of Object.keys(names)){
 for(let sample=1;sample<=samples;sample++){
const seed=Math.imul(sample,2654435761)>>>0,h=harness();h.loadMechanics();h.load("command-center");h.window.XianShortChallenges.startCustom({...d,kind:"paired-balance",randomSeed:seed});h.flush();let spent=0,repeat=0;const trace=[],seen={},failedActions=[];
while(!h.api.getState().ended){let c=h.api.getState();assert.ok(c.turn<=d.duration,"strategy must reach its real deadline");h.decide(choose(h,d,policy));h.flush();assert.ok(h.api.getState().eventResolved,"strategy decision must actually execute");
 for(let step=0;step<2&&!h.api.getState().ended;step++){
 c=h.api.getState();if(!c.actionPoints||policy==="guard")break;let a;
 if(policy==="goals")a=h.window.XianCommandCenter.recommendAction(c);
else if(policy==="repeat")a={actionId:"audience",fields:{"modal-character-select":h.window.XianCharacterAvailability?.isAvailable("xun_yu",c)===false?"cao_pi":"xun_yu","audience-mode":"public"}};
else if(policy==="rotation"){const people=h.window.XianCharacterAvailability?.availableCharacters(c,{action:"audience"})||h.window.GAME_DATA.characters;const loyalists=people.filter(p=>p.faction==="han_loyalists");a={actionId:"audience",fields:{"modal-character-select":loyalists[step%loyalists.length]?.id,"audience-mode":"public"}};}
 else if(policy==="welfare")a=c.stats.treasury<10?{actionId:"revenue",fields:{"revenue-method":"audit"}}:{actionId:"relief",fields:{"relief-level":"small"}};
else a=c.hidden.leakRisk>=50||c.stats.security<=28||c.stats.caoAlert>=75?{actionId:"audience",fields:{"modal-character-select":h.window.XianCharacterAvailability?.isAvailable("xun_yu",c)===false?"cao_pi":"xun_yu","audience-mode":"public"}}:{actionId:"secret",fields:{"modal-character-select":h.window.XianCharacterAvailability?.isAvailable("dong_cheng",c)===false?"court_secretariat":"dong_cheng","modal-secret-type":"intelligence"}};
if(!a||a.actionId==="end")break;const plan=h.window.XianActionPlans.build(a.actionId,a.fields,c);if(!plan?.affordable){failedActions.push({turn:c.turn,...a,reason:!plan?"当前对象或方案不可用":`国库不足：需${plan.cost}，现有${c.stats.treasury}`});break;}
if(h.act(a.actionId,a.fields)){const key=`${c.turn}:${a.actionId}:${a.fields['modal-character-select']||'none'}`;repeat+=seen[key]?1:0;seen[key]=true;spent+=plan.cost;trace.push({turn:c.turn,actionId:a.actionId,fields:a.fields,cost:plan.cost,success:true});}else{failedActions.push({turn:c.turn,...a,reason:"真实确认未增加成功行动数"});break;}h.flush();
 }
 if(!h.api.getState().ended){h.api.endTurn();h.flush();}
 }
 const c=h.api.getState(),r=h.window.XianShortChallenges.getState().results[0];assert.ok(r&&c.ended);
rows.push({challenge:d.id,policy,seed,goals:r.completed,total:r.total,gold:r.medal==="gold",early:r.endedEarly,ending:c.ending?.title,score:r.score,spent,repeat,actions:c.totalActions,stats:c.stats,hidden:c.hidden,trace,failedActions,promises:h.window.XianStrategyNetwork.getState()?.promises||[]});
 }
 const cell=rows.filter(r=>r.challenge===d.id&&r.policy===policy);console.log(JSON.stringify({challenge:d.id,policy,samples:cell.length,gold:cell.filter(r=>r.gold).length,goals:cell.reduce((s,r)=>s+r.goals,0),spent:cell.reduce((s,r)=>s+r.spent,0)}));
 fs.writeFileSync(output,JSON.stringify({source,samples,policies:names,rows},null,2));
}
for(const d of definitions)assert.ok(rows.some(r=>r.challenge===d.id&&r.policy==="goals"&&r.gold),`${d.id} retains a reachable gold path`);
console.log(`PASS ${rows.length} paired policy runs`);
