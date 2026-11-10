"use strict";
const fs = require("node:fs"), path = require("node:path"), http = require("node:http"), assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const { alliedFixture, seal, treatyText } = require("../tests/alliance-coalition-regression");

const { STRATEGY } = require("../tests/lord-command-chain-regression");
const { harness } = require("../tests/helpers/game-harness");
const root = path.resolve(__dirname, ".."), out = process.env.COUNCIL_BROWSER_OUTPUT || path.resolve(root, "../browser-diplomatic-endings");
fs.mkdirSync(out, { recursive: true });
const { prepare } = require("../tests/diplomatic-ending-regression");
const fixtures = Object.fromEntries(["none","cooperate","peace","betray"].map(mode => {
  const file=path.join(out,`before-ending-${mode}.json`);fs.writeFileSync(file,JSON.stringify(prepare(mode).api.captureFullSave()));return [mode,file];
}));
const legacyFallback=prepare("betray");legacyFallback.api.endTurn();const old=legacyFallback.api.captureFullSave();
old.stores.xian_emperor_simulator_v01.ending={title:"诸侯共奉",text:"旧规则结局，原样保留。"};old.stores.xian_emperor_simulator_v01.rulesVersion=228;delete old.stores.xian_emperor_simulator_v01.diplomaticOutcome;
const legacyFallbackFile=path.join(out,"legacy-ended-fixture.json");fs.writeFileSync(legacyFallbackFile,JSON.stringify(old));
const legacyFile=process.env.DIPLOMATIC_LEGACY_SAVE||legacyFallbackFile;
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
    const endMonth = async () => { await tap(page.locator("#end-turn-btn"));await tap(page.locator("#modal-confirm"));await tap(page.locator(".monthly-addon-confirm"));await page.waitForFunction(()=>window.XianEmperorGame.getState().ended,null,{polling:50});await page.waitForTimeout(250); };
    const leaveEnding = async () => { if(await page.locator("#end-screen").isVisible()){
      await tap(page.locator(".final-verdict-card button"));await tap(page.locator("#command-center-overlay [data-command-close]"));
    }};
    const download = async (target,name) => {const pending=page.waitForEvent("download");await tap(target);const d=await pending,file=path.join(out,`${name}-${width}.txt`);await d.saveAs(file);return fs.readFileSync(file,"utf8");};
    try {
      console.log(`START diplomatic ending browser ${width}`);
      await page.goto(process.env.COUNCIL_BROWSER_URL || `http://127.0.0.1:${server.address().port}/`, { waitUntil: "domcontentloaded" });await skipTutorial();
      await page.evaluate(()=>window.XianEmperorGame.startNewGame("standard","jianan_196",{randomSeed:226001}));await skipTutorial();
      const cases=[];
      for(const mode of ["betray","cooperate","peace","none"]){
        await leaveEnding();await importFile(fixtures[mode]);
        const before=await core(),stores=await page.evaluate(()=>JSON.stringify(Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith("xian_emperor_")).map(k=>[k,localStorage.getItem(k)]))));
        await page.evaluate(()=>window.XianDiplomaticEndings.preview(window.XianEmperorGame.getState()));
        assert.equal(await page.evaluate(()=>JSON.stringify(Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith("xian_emperor_")).map(k=>[k,localStorage.getItem(k)])))),stores);
        assert.deepEqual((await core()).random,before.random);
        await openChain(false);assert.match(await page.locator(".alliance-desk [data-diplomatic-outcome='preview']").innerText(),/外交终局核验/);
        await page.screenshot({path:path.join(out,`ending-preview-${mode}-${width}.png`)});await tap(page.locator("#strategy-network-close"));
        await endMonth();const ended=await core(),snapshot=ended.diplomaticOutcome;
        assert.equal(ended.ending.title,mode==="betray"?"盟约离心":mode==="none"?"合纵未固":"诸侯共奉");
        assert.match(await page.locator("#ending-stats").innerText(),/外交终局依据/);
        if(mode==="betray")assert.equal(snapshot.counts.unresolvedCourtBreaches,1);
        if(mode==="cooperate")assert.ok(snapshot.counts.jointCaptures>=1);
        if(mode==="peace")assert.equal(snapshot.confederationRoute,"sustained-peace");
        const panel=page.locator("#ending-stats [data-diplomatic-outcome='frozen']");await panel.scrollIntoViewIfNeeded();
        await page.screenshot({path:path.join(out,`ending-${mode}-${width}.png`)});
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
        if(mode==="cooperate"){
          await tap(page.locator("#end-screen [data-reading-size='largest']"));await panel.scrollIntoViewIfNeeded();
          assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
          assert.deepEqual((await core()).diplomaticOutcome,snapshot);await page.screenshot({path:path.join(out,`ending-largest-${width}.png`)});
          await tap(page.locator("#end-screen [data-reading-size='standard']"));
        }
        const chronicle=await download(page.locator("#ending-export"),`chronicle-${mode}`);assert.match(chronicle,/外交终局依据/);assert.ok(chronicle.includes(ended.ending.title));
        await tap(page.locator(".final-verdict-card button"));
        assert.match(await page.locator("#command-center-overlay").innerText(),/外交终局依据/);
        const verdict=await download(page.locator("[data-verdict-export]").first(),`verdict-${mode}`);assert.match(verdict,/外交终局依据/);
        assert.ok(verdict.includes(`朝廷背盟${snapshot.counts.courtBreaches}宗`));
        if(mode==="betray")assert.match(verdict,/朝廷授意背盟尚有1宗未修复/);
        await page.screenshot({path:path.join(out,`verdict-${mode}-${width}.png`)});await tap(page.locator("#command-center-overlay [data-command-close]"));
        const file=await exportFile(`ended-${mode}`);const exported=JSON.parse(fs.readFileSync(file,"utf8"));assert.deepEqual(exported.stores.xian_emperor_simulator_v01.diplomaticOutcome,snapshot);
        await importFile(file);assert.deepEqual((await core()).diplomaticOutcome,snapshot);assert.equal((await core()).ending.title,ended.ending.title);
        await page.reload({waitUntil:"domcontentloaded"});await skipTutorial();await tap(page.locator("#continue-game-btn"));await skipTutorial();
        assert.deepEqual((await core()).diplomaticOutcome,snapshot);assert.equal((await core()).ending.title,ended.ending.title);
        await page.locator(".final-verdict-card button").waitFor();
        assert.deepEqual(await page.evaluate(()=>window.XianFinalVerdict.getState().verdicts.find(v=>v.gameCreatedAt===window.XianEmperorGame.getState().createdAt&&!v.archivedByCoreImport).diplomaticOutcome),snapshot);
        cases.push({mode,ending:ended.ending.title,counts:snapshot.counts,actualMonthEnd:true,nativeFullExportImport:true,nativeChronicleExport:true,nativeVerdictExport:true,reloadFrozen:true});
      }
      await leaveEnding();await importFile(legacyFile);const legacy=JSON.parse(fs.readFileSync(legacyFile,"utf8")).stores.xian_emperor_simulator_v01;
      assert.equal((await core()).ending.title,legacy.ending.title);assert.equal((await core()).diplomaticOutcome,undefined);
      assert.equal(await page.locator("#ending-stats [data-diplomatic-outcome]").count(),0);await page.screenshot({path:path.join(out,`legacy-ended-${width}.png`)});
      assert.deepEqual(errors,[]);assert.deepEqual(httpFailures,[]);
      results.push({channel,width,cases,largestFontNoOverflow:true,legacyOriginalEnding:true,legacySource:process.env.DIPLOMATIC_LEGACY_SAVE?"actual-v228-baseline":"controlled-legacy-fixture",pageErrors:errors,httpFailures});
      fs.writeFileSync(path.join(out,"summary.json"),JSON.stringify(results,null,2));console.log(`PASS diplomatic ending browser ${width}`);
    }catch(error){console.error(error);await page.screenshot({path:path.join(out,`failure-${width}.png`),timeout:10000});throw error;}finally{await page.close();}
  }
  fs.writeFileSync(path.join(out,"summary.json"),JSON.stringify(results,null,2));console.log(JSON.stringify(results));
  }finally{await browser.close();server.close();}
})().catch(error=>{console.error(error);server.close();process.exitCode=1;});
