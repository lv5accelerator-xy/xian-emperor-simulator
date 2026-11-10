"use strict";
const fs = require("node:fs"), path = require("node:path"), http = require("node:http"), assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const { alliedFixture, seal, treatyText } = require("../tests/alliance-coalition-regression");

const { STRATEGY } = require("../tests/lord-command-chain-regression");
const root = path.resolve(__dirname, ".."), out = process.env.COUNCIL_BROWSER_OUTPUT || path.resolve(root, "../browser-alliance-coalition");
fs.mkdirSync(out, { recursive: true });
function writeFixture(name, h) {
  const bundle = h.api.captureFullSave();
  const file = path.join(out, `${name}-full-save.json`); fs.writeFileSync(file, JSON.stringify(bundle)); return file;
}
const invitationFile = writeFixture("invitation",alliedFixture());
const betrayal = alliedFixture(({s,a})=>{s.cities.luoyang.controller="gongsun_zan";Object.assign(a.armies.yuan_main,{cityId:"xudu",originCityId:"xudu",targetCityId:"xudu"});}); seal(betrayal,"令袁绍与公孙瓒结盟"); const betrayalFile = writeFixture("before-betrayal",betrayal);
const refused=alliedFixture(({s})=>s.strategies.gongsun_zan.trust=0);seal(refused);const refusalFile=writeFixture("refused",refused);
const server = http.createServer((req, res) => {
  const file = path.resolve(root, "." + decodeURIComponent(new URL(req.url, "http://localhost").pathname).replace(/\/$/, "/index.html"));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (error, data) => { if (error) { res.writeHead(404).end(); return; }
    res.setHeader("Content-Type", ({ ".html": "text/html; charset=utf-8", ".js": "application/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".woff2": "font/woff2" })[path.extname(file)] || "application/octet-stream"); res.end(data);
  });
});
const results = [];
(async () => {
  await new Promise(r => server.listen(0, "127.0.0.1", r));
  const channel = process.env.COUNCIL_BROWSER_CHANNEL || "chrome";
  const browser = await chromium.launch({ channel, headless: true, args: ["--disable-background-timer-throttling", "--disable-renderer-backgrounding", "--disable-backgrounding-occluded-windows"] });
  try { for (const width of (process.env.COUNCIL_BROWSER_WIDTHS || "1366,390").split(",").map(Number)) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: "reduce" }), errors = [], httpFailures = [];
    page.setDefaultTimeout(30000); page.setDefaultNavigationTimeout(30000); page.on("pageerror", e => errors.push(String(e))); page.on("dialog", d => d.accept());
    page.on("response", r => { if (r.status() >= 400 && !r.url().endsWith("favicon.ico")) httpFailures.push({ url: r.url(), status: r.status() }); });
    const core = () => page.evaluate(() => window.XianEmperorGame.getState());
    const strategy = () => page.evaluate(() => window.XianStrategyNetwork.getState());
    const army = () => page.evaluate(() => window.XianArmySystem.getState());
    // Use real pointer input with an explicit hit test. Some desktop browser
    // sessions stop animation frames after navigation; pointer input remains
    // available and must still respect overlays and disabled controls.
    const tap = async target => {
      await target.waitFor({ state: "visible" });
      await target.evaluate((node,width) => { const v=node.closest("[data-grand-viewport]"); if(v && width!==390){const r=node.getBoundingClientRect(),b=v.getBoundingClientRect();v.scrollTo({left:v.scrollLeft+r.x+r.width/2-b.x-b.width*.4,top:v.scrollTop+r.y+r.height/2-b.y-b.height*.45,behavior:"instant"});}else node.scrollIntoView({block:"center",inline:"center",behavior:"instant"});},width);
      const point = await target.evaluate(node => {
        if (node.disabled) return null;
        const r = node.getBoundingClientRect();
        for (const fy of [.5, .25, .75]) for (const fx of [.5, .25, .75]) {
          const x = r.x + r.width * fx, y = r.y + r.height * fy, hit = document.elementFromPoint(x, y);
          if (hit && (hit === node || node.contains(hit))) return { x, y };
        }
        return null;
      });
      if(!point)console.log(await target.evaluate(n=>({disabled:n.disabled,rect:n.getBoundingClientRect().toJSON(),viewport:n.closest("[data-grand-viewport]")?.getBoundingClientRect().toJSON(),hit:document.elementFromPoint(n.getBoundingClientRect().x+5,n.getBoundingClientRect().y+5)?.className})));
      assert.ok(point, `visible control must receive pointer input: ${target}`);
      await page.mouse.click(point.x, point.y);
    };
    const skipTutorial = async () => { await page.waitForTimeout(700); for (const selector of ["#tutorial-skip", ".tutorial-dialog footer [data-tutorial-move='skip']"]) if (await page.locator(selector).first().isVisible()) await tap(page.locator(selector).first()); };
    const tool = async id => {
      if (width === 390 && ["export-btn", "import-btn"].includes(id)) { await tap(page.locator("#mobile-save-tools")); await tap(page.locator(`[data-mobile-tool='${id}']`)); }
      else if (id === "world-map-btn" && width === 390) await tap(page.locator("[data-mobile-destination='map']"));
      else if (await page.locator(`#${id}`).isVisible()) await tap(page.locator(`#${id}`));
      else { await tap(page.locator("#utility-more-toggle")); await tap(page.locator(`#${id}`)); }
    };
    const openChain = async (expectPlan=true) => { await tap(page.locator(".alliance-brief")); await page.locator(expectPlan ? ".coalition-card" : ".alliance-desk").first().waitFor(); };
    const importFile = async file => { console.log(`IMPORT ${width} ${path.basename(file)}`); const chooser = page.waitForEvent("filechooser"); await tool("import-btn"); const selected = await chooser;
      await Promise.all([page.waitForEvent("domcontentloaded"), selected.setFiles(file)]); await skipTutorial(); await tap(page.locator("#continue-game-btn")); await skipTutorial(); console.log(`IMPORTED ${width}`); };
    const exportFile = async name => { const pending = page.waitForEvent("download"); await tool("export-btn"); const download = await pending, file = path.join(out, `${name}-${width}.json`); await download.saveAs(file); return file; };
    const endMonth = async () => { const prior=(await core()).turn; await tap(page.locator("#end-turn-btn")); await tap(page.locator("#modal-confirm")); await tap(page.locator(".monthly-addon-confirm")); await page.waitForFunction(turn=>window.XianEmperorGame.getState().turn>turn,prior,{polling:50}); await page.waitForTimeout(200); };
    try {
      console.log(`START alliance browser ${width}`);
      await page.goto(process.env.COUNCIL_BROWSER_URL || `http://127.0.0.1:${server.address().port}/`, { waitUntil: "domcontentloaded" }); await skipTutorial();
      await page.evaluate(() => window.XianEmperorGame.startNewGame("standard", "jianan_196", { randomSeed: 226001 })); await skipTutorial();
      await importFile(invitationFile);
      await tap(page.locator("#decree-helper-open")); await page.locator("#decree-input").fill(treatyText);
      const before=await core(); await tap(page.locator("#issue-decree-btn"));
      assert.match(await page.locator("#decree-confirmation-content").innerText(),/共同进攻晋阳/);
      assert.match(await page.locator("#decree-confirmation-content").innerText(),/预计同意/);
      assert.equal((await core()).actionPoints,2);assert.deepEqual((await core()).random,before.random);
      await page.screenshot({path:path.join(out,`alliance-preview-${width}.png`)});
      await tap(page.locator("#decree-confirmation-confirm"));
      assert.equal((await core()).actionPoints,1);assert.equal((await army()).orders.length,0);
      assert.equal((await strategy()).promises.find(p=>p.type==="alliance").status,"active");
      if(await page.locator("#decree-helper-close").isVisible())await tap(page.locator("#decree-helper-close"));
      await openChain();await tap(page.locator("[data-coalition-action='coordinate']:enabled").first());
      assert.equal((await core()).actionPoints,1);assert.match(await page.locator("#modal-body").innerText(),/2\/2镇愿接令/);await tap(page.locator("#modal-cancel"));
      await tap(page.locator("[data-coalition-action='coordinate']:enabled").first());await tap(page.locator("#modal-confirm"));
      assert.equal((await core()).actionPoints,0);assert.equal((await army()).orders.filter(o=>o.sourceAllianceId).length,2);
      assert.equal(await page.locator("[data-coalition-action='coordinate']:enabled").count(),0);
      await page.screenshot({path:path.join(out,`coalition-orders-${width}.png`)});await tap(page.locator("#strategy-network-close"));
      const paid=await exportFile("paid-coalition");await importFile(paid);assert.equal((await core()).actionPoints,0);assert.equal((await army()).orders.length,2);
      await endMonth();assert.equal((await army()).sieges.jinyang.attackerArmyId,"yuan_main");
      if(!(await core()).eventResolved)await tap(page.locator("[data-choice-index='0']"));
      await endMonth();
      const progress=(await army()).militaryFacts.filter(f=>f.kind==="siege-progress"&&f.turn===2&&f.cityId==="jinyang");
      assert.equal(progress.length,1);assert.equal(progress[0].participants.length,2);assert.ok(progress[0].participants.every(p=>p.supplySpent>0&&p.orderId));
      await openChain();assert.match(await page.locator(".alliance-desk").innerText(),/实际协战/);await page.screenshot({path:path.join(out,`coalition-siege-${width}.png`)});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);await tap(page.locator("#strategy-network-close"));
      const settled=await exportFile("settled-coalition");await importFile(settled);assert.equal((await army()).militaryFacts.filter(f=>f.kind==="siege-progress"&&f.turn===2).length,1);
      await importFile(betrayalFile);await tool("world-map-btn");if(await page.locator("[data-map-guide-skip]").isVisible())await tap(page.locator("[data-map-guide-skip]"));
      {for(let n=0;n<3;n++)await tap(page.locator("[data-map-zoom='in']"));await page.waitForTimeout(250);}
      await tap(page.locator("[data-grand-army-city='xudu']"));await tap(page.locator("[data-map-command-army='yuan_main'][data-map-command-task='attack']"));
      await tap(page.locator("[data-grand-city='luoyang']"));assert.match(await page.locator("#xian-world-overlay").innerText(),/盟约/);
      await tap(page.locator("[data-map-command-confirm]"));
      const bs=await strategy();assert.equal(bs.promises.find(p=>p.type==="alliance").status,"broken");assert.equal(bs.allianceDiplomacy.reputations.yuan_shao,37);assert.equal(bs.allianceDiplomacy.consequences.length,1);
      await page.screenshot({path:path.join(out,`betrayal-map-${width}.png`)});await tap(page.locator("#xian-world-close"));
      await openChain(false);await tap(page.locator(".alliance-consequences summary"));assert.match(await page.locator(".alliance-consequences").innerText(),/朝廷授意/);
      await page.screenshot({path:path.join(out,`betrayal-ledger-${width}.png`)});await tap(page.locator("#strategy-network-close"));
      const broken=await exportFile("broken-alliance");await importFile(broken);assert.deepEqual((await strategy()).allianceDiplomacy,bs.allianceDiplomacy);
      await page.reload({waitUntil:"domcontentloaded"});await skipTutorial();await tap(page.locator("#continue-game-btn"));await skipTutorial();assert.deepEqual((await strategy()).allianceDiplomacy,bs.allianceDiplomacy);
      await importFile(refusalFile);await openChain(false);await tap(page.locator("[data-strategy-tab='promises']"));
      assert.match(await page.locator(".promise-card").first().innerText(),/未成盟/);assert.match(await page.locator(".promise-card").first().innerText(),/公孙瓒：拒绝/);
      assert.equal((await army()).orders.length,0);await page.screenshot({path:path.join(out,`refused-alliance-${width}.png`)});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);assert.deepEqual(errors,[]);assert.deepEqual(httpFailures,[]);
      results.push({channel,width,actualInvitation:true,readOnlyPreview:true,twoActionBudget:true,individualOrders:true,singleSiegeTick:true,physicalContributions:true,actualMapBetrayal:true,refusal:true,actualFileExportImport:true,reload:true,pageErrors:errors,httpFailures});
      fs.writeFileSync(path.join(out,"summary.json"),JSON.stringify(results,null,2));console.log(`PASS alliance browser ${width}`);
    }catch(error){console.error(error);await page.screenshot({path:path.join(out,`failure-${width}.png`),timeout:10000});throw error;}finally{await page.close();}
  }
  fs.writeFileSync(path.join(out,"summary.json"),JSON.stringify(results,null,2));console.log(JSON.stringify(results));
  }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
