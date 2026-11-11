"use strict";
const fs = require("node:fs"), path = require("node:path"), http = require("node:http"), assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const { alliedFixture, seal, treatyText } = require("../tests/alliance-coalition-regression");

const { STRATEGY } = require("../tests/lord-command-chain-regression");
const { resume, CORE } = require("../tests/lord-command-chain-regression");
const { harness } = require("../tests/helpers/game-harness");
const root = path.resolve(__dirname, ".."), out = process.env.COUNCIL_BROWSER_OUTPUT || path.resolve(root, "../browser-diplomatic-relations");
fs.mkdirSync(out, { recursive: true });
const {betrayedFixture,parties,text}=require("../tests/diplomatic-relations-regression");
const h0=betrayedFixture(),bundle=h0.api.captureFullSave();bundle.stores[CORE].maxTurns=13;
Object.assign(bundle.stores[CORE].stats,{authority:50,prestige:90,security:85,officials:85,treasury:85,caoAlert:15});
Object.assign(bundle.stores[CORE].hidden,{externalBalance:85,peopleStability:85,loyalNetwork:0,leakRisk:0});
const recoveryFile=path.join(out,"controlled-before-peace.json");fs.writeFileSync(recoveryFile,JSON.stringify(bundle));
const refusal=JSON.parse(JSON.stringify(bundle)),world=refusal.stores[Object.keys(refusal.stores).find(k=>k.includes("world_v"))];for(const id of parties)Object.assign(world.lords[id],{expansion:100,caution:0});
const refusalFile=path.join(out,"controlled-refusal.json");fs.writeFileSync(refusalFile,JSON.stringify(refusal));
const legacyFile=process.env.DIPLOMATIC_LEGACY_SAVE;assert.ok(legacyFile,"supply an actual v229 completed full save");
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
      await page.waitForTimeout(80);
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
    const endMonth = async () => {const turn=(await core()).turn;await tap(page.locator("#end-turn-btn"));await tap(page.locator("#modal-confirm"));await tap(page.locator(".monthly-addon-confirm"));await page.waitForFunction(t=>{const c=window.XianEmperorGame.getState();return c.ended||c.turn>t},turn,{polling:50});await page.waitForTimeout(200);};
    const choose = async () => {if(!(await core()).eventResolved)await tap(page.locator("#event-choices [data-choice-index]:enabled").first());};
    const reading=async()=>{if(width===390)await tap(page.locator(".mobile-reading-toolbar [data-reading-toggle]"));else await tool("reading-size-btn");};
    const openRelations=async()=>{await tap(page.locator(".alliance-brief"));await page.locator(".relations-desk").waitFor();};
    const negotiate=async kind=>{await openRelations();await tap(page.locator(`[data-relations-action='${kind}']`));await tap(page.locator("#modal-confirm"));await tap(page.locator("#strategy-network-close"));};
    const ally=async()=>{await tap(page.locator("#decree-helper-open"));await page.locator("#decree-input").fill(text);await tap(page.locator("#issue-decree-btn"));await tap(page.locator("#decree-confirmation-confirm"));if(await page.locator("#decree-helper-close").isVisible())await tap(page.locator("#decree-helper-close"));};
    const leaveEnding = async () => { if(await page.locator("#end-screen").isVisible()){
      await tap(page.locator(".final-verdict-card button"));await tap(page.locator("#command-center-overlay [data-command-close]"));
    }};
    const download = async (target,name) => {const pending=page.waitForEvent("download");await tap(target);const d=await pending,file=path.join(out,`${name}-${width}.txt`);await d.saveAs(file);return fs.readFileSync(file,"utf8");};
    try {
      console.log(`START relationship browser ${width}`);
      await page.goto(process.env.COUNCIL_BROWSER_URL || `http://127.0.0.1:${server.address().port}/`,{waitUntil:"domcontentloaded"});await skipTutorial();
      await page.evaluate(()=>window.XianEmperorGame.startNewGame("standard","jianan_196",{randomSeed:226001}));await skipTutorial();
      await importFile(recoveryFile);const initial=await core(),oldFacts=(await army()).militaryFacts;
      await openRelations();const before=await core();await tap(page.locator("[data-relations-action='peace']"));assert.match(await page.locator("#modal-body").innerText(),/2\/2镇愿承接/);await tap(page.locator("#modal-cancel"));assert.deepEqual((await core()).random,before.random);assert.equal((await core()).totalActions,before.totalActions);
      await tap(page.locator("[data-relations-action='peace']"));await tap(page.locator("#modal-confirm"));
      assert.equal((await core()).actionPoints,initial.actionPoints-1);assert.equal((await core()).stats.treasury,initial.stats.treasury-2);assert.equal((await army()).armies.yuan_main.task,"idle");assert.deepEqual((await army()).militaryFacts,oldFacts);
      assert.equal((await strategy()).diplomaticRelations.treaties[0].status,"active");await tap(page.locator(".relations-desk summary"));await page.screenshot({path:path.join(out,`peace-confirmed-${width}.png`)});
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);await tap(page.locator("#strategy-network-close"));
      await reading();await reading();assert.equal(await page.evaluate(()=>document.documentElement.dataset.readingSize),"largest");await openRelations();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);await page.screenshot({path:path.join(out,`relations-largest-${width}.png`)});await tap(page.locator("#strategy-network-close"));await reading();
      const peaceExport=await exportFile("peace");await importFile(peaceExport);assert.equal((await strategy()).diplomaticRelations.treaties[0].status,"active");
      const monthly=[];
      while(!(await core()).ended){await choose();const turn=(await core()).turn;
        if(turn===4){const before=await core();await negotiate("repair");assert.equal((await core()).actionPoints,before.actionPoints-1);assert.equal((await strategy()).diplomaticRelations.requests.filter(r=>r.kind==="repair"&&r.accepted).length,1);
          const file=await exportFile("after-repair");await importFile(file);await page.reload({waitUntil:"domcontentloaded"});await skipTutorial();await tap(page.locator("#continue-game-btn"));await skipTutorial();}
        if(turn===6||turn===11){await ally();assert.ok((await strategy()).promises.some(p=>p.type==="alliance"&&p.status==="active"));}
        if(turn===11)assert.equal((await strategy()).diplomaticRelations.repairs.length,1);
        await endMonth();monthly.push({turn,after:(await core()).turn,ended:(await core()).ended});
      }
      const ended=await core(),snapshot=ended.diplomaticOutcome;assert.equal(ended.ending.title,"帝国调停者");assert.equal(snapshot.counts.repairedBreaches,1);assert.equal(snapshot.counts.unresolvedCourtBreaches,0);assert.equal(snapshot.counts.courtBreaches,1);assert.equal(snapshot.counts.peaceSettlements,1);assert.equal(snapshot.counts.reconciliationMissions,1);
      await page.screenshot({path:path.join(out,`repaired-ending-${width}.png`)});const chronicle=await download(page.locator("#ending-export"),"chronicle-repaired");assert.match(chronicle,/修好使节获承接1次/);
      await tap(page.locator(".final-verdict-card button"));const verdict=await download(page.locator("[data-verdict-export]").first(),"verdict-repaired");assert.match(verdict,/修好使节获承接1次/);await page.screenshot({path:path.join(out,`verdict-repaired-${width}.png`)});await tap(page.locator("#command-center-overlay [data-command-close]"));
      const endedFile=await exportFile("repaired-ended");await importFile(endedFile);assert.deepEqual((await core()).diplomaticOutcome,snapshot);await page.reload({waitUntil:"domcontentloaded"});await skipTutorial();await tap(page.locator("#continue-game-btn"));await skipTutorial();assert.deepEqual((await core()).diplomaticOutcome,snapshot);
      await leaveEnding();await importFile(refusalFile);const refusalBefore=await core(),war=(await army()).armies.yuan_main.currentOrderId;await openRelations();await tap(page.locator("[data-relations-action='peace']"));assert.match(await page.locator("#modal-body").innerText(),/0\/2镇愿承接/);await tap(page.locator("#modal-confirm"));assert.equal((await core()).actionPoints,refusalBefore.actionPoints-1);assert.equal((await core()).stats.treasury,refusalBefore.stats.treasury-2);assert.equal((await army()).armies.yuan_main.currentOrderId,war);assert.equal((await strategy()).diplomaticRelations.treaties.length,0);await page.screenshot({path:path.join(out,`refusal-${width}.png`)});await tap(page.locator("#strategy-network-close"));
      await importFile(legacyFile);const legacy=JSON.parse(fs.readFileSync(legacyFile,"utf8")).stores[CORE];assert.equal((await core()).ending.title,legacy.ending.title);assert.equal((await core()).ending.text,legacy.ending.text);assert.deepEqual((await core()).diplomaticOutcome,legacy.diplomaticOutcome);await page.screenshot({path:path.join(out,`actual-legacy-v229-${width}.png`)});
      assert.deepEqual(errors,[]);assert.deepEqual(httpFailures,[]);results.push({channel,width,actualMonthEnds:monthly,controlledRecovery:true,ending:ended.ending.title,counts:snapshot.counts,readOnlyCancel:true,acceptedPeaceStopsActualOrder:true,refusalCostsWithoutStopping:true,largestFontNoOverflow:true,nativeFullExportImport:true,nativeChronicleAndVerdictExport:true,intermediateReload:true,frozenConclusion:true,actualV229EndingPreserved:true,pageErrors:errors,httpFailures});
      fs.writeFileSync(path.join(out,"summary.json"),JSON.stringify(results,null,2));console.log(`PASS relationship browser ${width}`);
    }catch(error){console.error(error);await page.screenshot({path:path.join(out,`failure-${width}.png`),timeout:10000});throw error;}finally{await page.close();}
  }
  fs.writeFileSync(path.join(out,"summary.json"),JSON.stringify(results,null,2));console.log(JSON.stringify(results));
  }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
