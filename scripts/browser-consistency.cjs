"use strict";
const fs=require("node:fs"), path=require("node:path"), http=require("node:http"), assert=require("node:assert/strict");
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || "playwright");
const root=path.resolve(__dirname,".."), out=path.resolve(root,"../browser-evidence");fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{const file=path.resolve(root,"."+decodeURIComponent(new URL(req.url,"http://localhost").pathname).replace(/\/$/,"/index.html"));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(file,(err,data)=>{if(err){res.writeHead(404).end();return;}res.setHeader("Content-Type",({".html":"text/html; charset=utf-8",".js":"application/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".woff2":"font/woff2"})[path.extname(file)]||"application/octet-stream");res.end(data);});});
const cosmetic=new Set(["updatedAt","createdAt","gameCreatedAt","capturedAt","exportedAt","startedAt","completedAt","timestamp","lastReportTimestamp","v041LastCorrectedTimestamp","lastCoreReportTimestamp"]);
function normalize(value,key=""){
 if(cosmetic.has(key) || /Timestamp$/.test(key))return "<time>";
 if(Array.isArray(value))return value.map(v=>normalize(v));
 if(value&&typeof value==="object")return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,normalize(v,k)]));
 if(typeof value==="string")return value.replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/g,"<game>").replace(/\b\d{13,}\b/g,"<clock>").replace(/<clock>-[a-z0-9]{5,}/g,"<clock>-<nonce>");
 return value;
}
(async()=>{await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));const url=`http://127.0.0.1:${server.address().port}/`;const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL || "msedge"});let allErrors=[];
 async function play(delay,restore=false){const context=await browser.newContext({viewport:{width:1366,height:768}});const page=await context.newPage();page.on("pageerror",e=>allErrors.push(String(e)));page.on("dialog",d=>d.accept());await page.goto(url);await page.evaluate(()=>{const d=window.XianWeeklyChallenge.buildDefinition("XIAN-2026W42-1HBDF");window.XianShortChallenges.startCustom(d);});
 let checkpoint=null;const pauses=[0,47,210,81,501,3];let step=0;
 const wait=async()=>{const ms=delay==="random"?pauses[(step++)%pauses.length]:delay;if(ms)await page.waitForTimeout(ms);};
 for(let month=1;month<=6;month++){
   if(await page.evaluate(()=>window.XianEmperorGame.getState().ended))break;
   await page.evaluate(()=>document.querySelector("[data-choice-index='0']").click());await wait();
   if([1,3,5].includes(month)) {await page.evaluate(()=>{document.getElementById("decree-input").value="请袁绍在邺城开仓赈济，整饬军备。";document.getElementById("issue-decree-btn").click();document.getElementById("decree-confirmation-confirm")?.click();});await wait();}
   if(restore&&month===3){checkpoint=await page.evaluate(()=>window.XianEmperorGame.captureFullSave());await Promise.all([page.waitForEvent("domcontentloaded"),page.evaluate(b=>window.XianEmperorGame.restoreFullSave(b),checkpoint)]);await page.waitForFunction(()=>Boolean(window.XianEmperorGame));await page.evaluate(()=>document.getElementById("continue-game-btn").click());}
   await page.evaluate(()=>{document.getElementById("end-turn-btn").click();document.getElementById("modal-confirm").click();});await wait();
 }
 const bundle=await page.evaluate(()=>window.XianEmperorGame.captureFullSave());
 fs.writeFileSync(path.join(out,`trace-${delay}-${restore}.json`),JSON.stringify(bundle,null,2));await context.close();return bundle;
 }
 try {
 const baseline=await play(0);assert.ok(baseline.stores.xian_emperor_simulator_v01.ended,"trace reaches ending");
 for(const [delay,restore]of [[50,false],[500,false],["random",false],[0,true]]){
   const actual=await play(delay,restore);assert.deepEqual(normalize(actual.stores),normalize(baseline.stores),`full gameplay snapshot differs delay=${delay}, restore=${restore}`);console.log(`PASS actual index trace delay=${delay} restore=${restore}`);
 }
 assert.deepEqual(allErrors,[]);fs.writeFileSync(path.join(out,"result.json"),JSON.stringify({pageErrors:allErrors,score:baseline.stores.xian_emperor_short_challenges_v230?.results?.[0]?.score},null,2));
 }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1;});

