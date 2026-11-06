"use strict";
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const {play,ROUTES}=require("../tests/helpers/scenario-220-playthrough");
const {plain}=require("../tests/helpers/game-harness");
const seeds=[224,1,42,196220,2026240,0xffffffff],rows=[];
for(const difficulty of ["standard","crisis"])for(const route of Object.keys(ROUTES))for(const seed of seeds){
 const r=play(route,seed,{allowFallback:true,difficulty}),c=r.core;
 rows.push({difficulty,route,seed,actionBudget:24,actions:c.totalActions,normal:c.story220.completedNormally===true,turn:c.turn,
   ending:c.ending,challenge:r.run.api.calculateScenarioChallenge(r.run.window.GAME_DATA.scenarios.find(item=>item.id===c.scenarioId),c),stats:c.stats,hidden:c.hidden,
   decisions:r.trace,actionTrace:r.actionTrace,failedIntents:r.failures,promises:c.story220.promises,consequences:c.story220.consequences,
   achievedRoute:c.story220.stance===route,story:c.story220,
   cost:r.trace.reduce((n,x)=>n+x.decisionCost,0)+r.actionTrace.reduce((n,x)=>n+x.cost,0),
   actionDistribution:r.actionTrace.reduce((a,x)=>(a[x.actionId]=(a[x.actionId]||0)+1,a),{})});
 console.log(`SAMPLE ${difficulty} ${route} ${seed} ${c.ending.title} intendedFailures=${r.failures.length}`);
}
const summary=[];
for(const difficulty of ["standard","crisis"])for(const route of Object.keys(ROUTES)){
 const a=rows.filter(x=>x.difficulty===difficulty&&x.route===route),mean=key=>Math.round(a.reduce((n,x)=>n+x.stats[key],0)/a.length*10)/10;
 summary.push({difficulty,route,samples:a.length,normal:a.filter(x=>x.normal).length,achieved:a.filter(x=>x.achievedRoute).length,
   failedIntents:a.reduce((n,x)=>n+x.failedIntents.length,0),brokenPromises:a.reduce((n,x)=>n+x.promises.filter(p=>p.status==="broken").length,0),
   authority:mean("authority"),security:mean("security"),treasury:mean("treasury"),cost:a.reduce((n,x)=>n+x.cost,0),actions:a.reduce((n,x)=>n+x.actions,0),
   endings:a.reduce((out,x)=>(out[x.ending.title]=(out[x.ending.title]||0)+1,out),{})});
}
const sourceFiles=fs.readdirSync(path.resolve(__dirname,"../src"),{recursive:true}).filter(x=>x.endsWith(".js")).sort();
const hash=crypto.createHash("sha256");for(const f of sourceFiles)hash.update(f).update(fs.readFileSync(path.resolve(__dirname,"../src",f)));
const report={rulesVersion:225,sourceHash:hash.digest("hex"),seeds,method:"same visible-state policy, maximum 2 AP/month; no stat patches; keep fallback/early/failed samples; scripted samples are not player win rates",summary,rows:plain(rows)};
const output=process.env.STORY_OUTPUT||path.resolve(__dirname,"../../story-balance-v225.json");fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,JSON.stringify(report,null,2));
console.log(JSON.stringify({samples:rows.length,summary,output}));
