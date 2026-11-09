"use strict";
const fs = require("node:fs"), path = require("node:path"), http = require("node:http"), assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const { parallelFixture } = require("../tests/parallel-council-regression");
const { convoyFixture } = require("../tests/diplomatic-cascade-regression");
const { STRATEGY } = require("../tests/lord-command-chain-regression");
const root = path.resolve(__dirname, ".."), out = process.env.COUNCIL_BROWSER_OUTPUT || path.resolve(root, "../browser-parallel-council");
fs.mkdirSync(out, { recursive: true });
function writeFixture(name, h) {
  const bundle = h.api.captureFullSave(); bundle.stores[STRATEGY].commandChain.generatedTurns = Array.from({ length: h.api.getState().turn }, (_, i) => i + 1);
  const file = path.join(out, `${name}-full-save.json`); fs.writeFileSync(file, JSON.stringify(bundle)); return file;
}
const road = parallelFixture(); const roadFile = writeFixture("opposing-councils", road);
const replacement = parallelFixture(); replacement.window.XianStrategyNetwork.interveneLordIntent(replacement.window.XianStrategyNetwork.getState().commandChain.intents[0].id, "coordinate");
const replacementFile = writeFixture("executing-order", replacement);
const convoyFile = writeFixture("aid-convoy", convoyFixture());
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
  const channel = process.env.COUNCIL_BROWSER_CHANNEL || "msedge";
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
      await target.evaluate(node => node.scrollIntoView({ block: "center", inline: "center", behavior: "instant" }));
      const point = await target.evaluate(node => {
        if (node.disabled) return null;
        const r = node.getBoundingClientRect();
        for (const fy of [.5, .25, .75]) for (const fx of [.5, .25, .75]) {
          const x = r.x + r.width * fx, y = r.y + r.height * fy, hit = document.elementFromPoint(x, y);
          if (hit && (hit === node || node.contains(hit))) return { x, y };
        }
        return null;
      });
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
    const openChain = async () => { await tap(page.locator(".lord-intent-brief")); await page.locator(".lord-command-card").first().waitFor(); };
    const importFile = async file => { console.log(`IMPORT ${width} ${path.basename(file)}`); const chooser = page.waitForEvent("filechooser"); await tool("import-btn"); const selected = await chooser;
      await Promise.all([page.waitForEvent("domcontentloaded"), selected.setFiles(file)]); await skipTutorial(); await tap(page.locator("#continue-game-btn")); await skipTutorial(); console.log(`IMPORTED ${width}`); };
    const exportFile = async name => { const pending = page.waitForEvent("download"); await tool("export-btn"); const download = await pending, file = path.join(out, `${name}-${width}.json`); await download.saveAs(file); return file; };
    const endMonth = async () => { await tap(page.locator("#end-turn-btn")); await tap(page.locator("#modal-confirm")); await tap(page.locator(".monthly-addon-confirm")); };
    try {
      console.log(`START parallel browser ${width}`);
      await page.goto(process.env.COUNCIL_BROWSER_URL || `http://127.0.0.1:${server.address().port}/`, { waitUntil: "domcontentloaded" }); await skipTutorial();
      await page.evaluate(() => window.XianEmperorGame.startNewGame("standard", "jianan_196", { randomSeed: 226001 })); await skipTutorial();
      assert.equal((await strategy()).commandChain.intents.length, 3); await tap(page.locator("[data-choice-index='0']")); await openChain();
      assert.equal(await page.locator(".lord-command-card").count(), 3);
      const before = await core(); await tap(page.locator("[data-lord-action='coordinate']:enabled").first());
      assert.deepEqual((await core()).random, before.random); assert.equal((await core()).actionPoints, 2); await tap(page.locator("#modal-cancel"));
      for (let n = 0; n < 2; n++) { await tap(page.locator("[data-lord-action='coordinate']:enabled").first()); await tap(page.locator("#modal-confirm")); }
      assert.equal((await core()).actionPoints, 0); assert.equal(await page.locator("[data-lord-action='coordinate']:enabled").count(), 0);
      await page.screenshot({ path: path.join(out, `three-councils-${width}.png`) }); await tap(page.locator("#strategy-network-close"));
      const normal = await exportFile("normal-three-councils"); await endMonth(); assert.equal((await core()).turn, 2);
      assert.equal((await strategy()).commandChain.intents.filter(i => i.turn === 1 && i.status !== "proposed").length, 3);
      await importFile(normal); assert.equal((await core()).actionPoints, 0); assert.equal((await strategy()).commandChain.intents.length, 3);
      console.log(`Normal budget and file restore passed ${width}`);
      await importFile(roadFile); await openChain();
      for (let n = 0; n < 2; n++) { await tap(page.locator("[data-lord-action='coordinate']:enabled").first()); assert.match(await page.locator("#modal-body").innerText(), /对向行军/); await tap(page.locator("#modal-confirm")); }
      await tap(page.locator("#strategy-network-close")); await endMonth();
      const roadFacts = (await army()).militaryFacts.filter(f => f.kind === "battle" && f.routeId === "ye_ji"); assert.equal(roadFacts.length, 1);
      assert.ok((await strategy()).commandChain.intents.filter(i => i.turn === 1).every(i => i.factIds.includes(roadFacts[0].id)));
      await openChain(); await tap(page.locator(".council-ledger summary")); assert.match(await page.locator(".council-ledger").innerText(), /军路遭遇/);
      await page.screenshot({ path: path.join(out, `road-conflict-${width}.png`) }); await tap(page.locator("#strategy-network-close"));
      const roadSaved = await exportFile("settled-road-battle"); await importFile(roadSaved);
      assert.equal((await army()).militaryFacts.filter(f => f.kind === "battle" && f.routeId === "ye_ji").length, 1);
      console.log(`Shared road battle and restore passed ${width}`);
      await importFile(replacementFile); const old = (await army()).armies.yuan_main.currentOrderId, ap = (await core()).actionPoints;
      await tool("world-map-btn"); if (await page.locator("[data-map-guide-skip]").isVisible()) await tap(page.locator("[data-map-guide-skip]"));
      if (width === 390) {
        for (let n = 0; n < 3; n++) await tap(page.locator("[data-map-zoom='in']"));
        await page.waitForTimeout(250);
      }
      await tap(page.locator("[data-grand-army-city='ye']")); await tap(page.locator("[data-map-command-army='yuan_main'][data-map-command-task='attack']"));
      await tap(page.locator("[data-grand-city='luoyang']")); await tap(page.locator("[data-map-command-confirm]"));
      assert.equal((await core()).actionPoints, ap); assert.equal((await army()).armies.yuan_main.currentOrderId, old);
      await tap(page.locator("[data-map-replace]")); assert.equal(await page.locator("[data-map-replace]").isChecked(), true); await tap(page.locator("[data-map-command-confirm]"));
      assert.equal((await core()).actionPoints, ap - 1); assert.equal((await army()).orders.find(o => o.id === old).status, "superseded");
      await page.screenshot({ path: path.join(out, `replacement-${width}.png`) }); await tap(page.locator("#xian-world-close"));
      console.log(`Explicit replacement passed ${width}`);
      await importFile(convoyFile); await tap(page.locator("[data-choice-index='0']")); await openChain();
      await tap(page.locator("[data-lord-action='coordinate']:enabled").first()); await tap(page.locator("#lord-breach-consent")); assert.equal(await page.locator("#lord-breach-consent").isChecked(), true); await tap(page.locator("#modal-confirm"));
      await tap(page.locator("#strategy-network-close")); await endMonth();
      const cascade = await strategy(), observed = cascade.commandChain.reactions.find(r => r.kind === "aid-intercepted");
      assert.ok(observed); assert.equal(cascade.promises.filter(p => p.status === "broken").length, 2);
      const cascadeSave = await exportFile("settled-diplomatic-cascade"); await importFile(cascadeSave);
      assert.deepEqual((await strategy()).commandChain.reactions, cascade.commandChain.reactions);
      await page.reload({ waitUntil: "domcontentloaded" }); await skipTutorial(); await tap(page.locator("#continue-game-btn")); await skipTutorial();
      assert.deepEqual((await strategy()).commandChain.reactions, cascade.commandChain.reactions);
      await openChain(); await tap(page.locator(".council-ledger summary")); assert.match(await page.locator(".council-ledger").innerText(), /实际截击/);
      await page.screenshot({ path: path.join(out, `diplomatic-cascade-${width}.png`) });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      assert.deepEqual(errors, []); assert.deepEqual(httpFailures, []);
      results.push({ channel, width, threeCouncils: true, twoActionBudget: true, readOnlyPreview: true, actualRoadBattle: true, sharedFact: true, explicitReplacement: true,
        convoyBattle: true, twoBrokenContracts: true, frozenReaction: true, actualFileExportImport: true, reload: true, pageErrors: errors, httpFailures });
      fs.writeFileSync(path.join(out, "summary.json"), JSON.stringify(results, null, 2));
      console.log(`PASS parallel browser ${width}`);
    } catch (error) { console.error(error); await page.screenshot({ path: path.join(out, `failure-${width}.png`), timeout: 10000 }); throw error; }
    finally { await page.close(); }
  }
  fs.writeFileSync(path.join(out, "summary.json"), JSON.stringify(results, null, 2)); console.log(JSON.stringify(results));
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); server.close(); process.exitCode = 1; });
