"use strict";
const fs=require("node:fs"),path=require("node:path"),http=require("node:http"),assert=require("node:assert/strict");
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||"playwright");
const {eventIndex,nextAction,play,signature}=require("../tests/helpers/scenario-220-playthrough");
const root=path.resolve(__dirname,".."),out=process.env.BROWSER_OUTPUT||path.resolve(root,"../browser-v225");fs.mkdirSync(out,{recursive:true});
const server=http.createServer((req,res)=>{const f=path.resolve(root,"."+decodeURIComponent(new URL(req.url,"http://local").pathname).replace(/\/$/,"/index.html"));if(!f.startsWith(root+path.sep)){res.writeHead(403).end();return;}fs.readFile(f,(e,b)=>{if(e){res.writeHead(404).end();return;}res.setHeader("Content-Type",({".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".woff2":"font/woff2"})[path.extname(f)]||"application/octet-stream");res.end(b);});});
const scenarios=[{route:"resist",width:1366,height:900,size:"standard",font:"classic"},{route:"preserve",width:320,height:740,size:"largest",font:"classic"},{route:"negotiate",width:390,height:844,size:"largest",font:"clear"}];
(async()=>{await new Promise(r=>server.listen(0,"127.0.0.1",r));const url=`http://127.0.0.1:${server.address().port}/`;const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||"msedge"}),errors=[],failures=[],results=[];
try{
 for(const setup of scenarios){
  const context=await browser.newContext({viewport:{width:setup.width,height:setup.height},reducedMotion:"reduce"}),page=await context.newPage();page.on("pageerror",e=>errors.push(String(e)));page.on("dialog",d=>d.accept());page.on("response",r=>{if(r.status()>=400&&!r.url().endsWith("favicon.ico"))failures.push({status:r.status(),url:r.url()});});page.setDefaultTimeout(15000);
  await page.goto(url);await page.locator(`#start-screen [data-reading-size='${setup.size}']`).click();await page.locator(`#start-screen [data-font-mode='${setup.font}']`).click();
  await page.locator("#scenario-select").selectOption("yankang_220");await page.locator("#new-game-btn").click();
  await page.evaluate(()=>window.XianEmperorGame.startNewGame("standard","yankang_220",{randomSeed:224}));
  await page.waitForTimeout(650);const tutorial=page.locator("[data-tutorial-move='skip']").first();if(await tutorial.isVisible())await tutorial.click();
  const core=()=>page.evaluate(()=>window.XianEmperorGame.getState());
  const closeReport=async()=>{const report=page.locator(".monthly-addon-confirm");if(await report.isVisible())await report.click();};
  async function act(action){const before=await core();const category={audience:"domestic",secret:"intrigue",revenue:"finance"}[action.id];await page.locator(`[data-action-category-tab='${category}']`).click();await page.locator(`[data-action-id='${action.id}']`).click();for(const [key,value]of Object.entries(action.fields)){if(key.startsWith("modal-"))await page.locator(`#${key}`).selectOption(value);else await page.locator(`input[name='${key}'][value='${value}']`).check();}const preview=await page.locator("#modal-body").innerText();if(action.id==="audience")assert.match(preview,/国家|人物|同月/);await page.locator("#modal-confirm").click();assert.equal((await core()).totalActions,before.totalActions+1);}
  let refresh=false,fullImport=false;const nodes=[];
  while(!(await core()).ended){
   const c=await core(),ev=await page.evaluate(()=>window.XianEmperorGame.getCurrentEvent());
   if([3,6,9,11].includes(c.turn)){
    assert.equal(ev.story220,true);nodes.push(c.turn);await page.locator("#story220-status").scrollIntoViewIfNeeded();assert.match(await page.locator("#story220-status").innerText(),/准备/);
    if(c.turn===9){const before=signature(c);await page.reload();await page.locator("#continue-game-btn").click();assert.deepEqual(signature(await core()),before);refresh=true;
      const bundle=await page.evaluate(()=>window.XianEmperorGame.captureFullSave());await Promise.all([page.waitForEvent("domcontentloaded"),page.evaluate(b=>window.XianEmperorGame.restoreFullSave(b),bundle)]);await page.locator("#continue-game-btn").click();assert.deepEqual(signature(await core()),before);fullImport=true;}
    await page.screenshot({path:path.join(out,`${setup.route}-${c.turn}.png`),fullPage:true});
   }
   const actualNodes=await page.evaluate(()=>window.XianScenario220Story.nodes());
   const i=eventIndex({api:{getCurrentEvent:()=>ev,getState:()=>c},window:{XianScenario220Story:{nodes:()=>actualNodes}}},setup.route);assert.ok(i>=0&&!ev.choices[i].disabledReason);await page.locator(`[data-choice-index='${i}']`).click();assert.equal((await core()).eventResolved,true);
   for(let step=0;step<2;step++){const a=nextAction(await core(),setup.route,step);if(a)await act(a);}
   await page.locator("#end-turn-btn").click();assert.match(await page.locator("#modal-title").innerText(),/预检/);
   if(c.turn===9){const before=signature(await core());await page.locator("#modal-cancel").click();assert.deepEqual(signature(await core()),before);await page.locator("#end-turn-btn").click();}
   await page.locator("#modal-confirm").click();await closeReport();
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`no horizontal overflow ${setup.route} turn${c.turn}`);
  }
  const final=await core();assert.equal(final.turn,12);assert.equal(final.story220.completedNormally,true);assert.deepEqual(nodes,[3,6,9,11]);assert.ok(final.story220.consequences.every(x=>x.status!=="pending"));
  assert.match(await page.locator("#story220-afterword").innerText(),/可考之事|实际|代价/);assert.equal(await page.evaluate(()=>document.documentElement.dataset.readingSize),setup.size);
  await page.screenshot({path:path.join(out,`${setup.route}-ending.png`),fullPage:true});fs.writeFileSync(path.join(out,`${setup.route}-full.json`),JSON.stringify(await page.evaluate(()=>window.XianEmperorGame.captureFullSave()),null,2));
  const expected=play(setup.route,224);assert.deepEqual(signature(final),signature(expected.core),"real index route must match current full mechanics, not PR #7 scores");
  results.push({...setup,nodes,refresh,fullImport,stats:final.stats,ending:final.ending.title,actions:final.totalActions});await context.close();console.log(`PASS actual index ${setup.route} ${setup.width} ${setup.size}`);
 }
 assert.deepEqual(errors,[]);assert.deepEqual(failures,[]);fs.writeFileSync(path.join(out,"story-result.json"),JSON.stringify({results,pageErrors:errors,httpFailures:failures},null,2));
}finally{await browser.close();server.close();}})().catch(e=>{console.error(e);server.close();process.exitCode=1;});
