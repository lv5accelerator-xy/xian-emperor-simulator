"use strict";
const fs = require("node:fs"), path = require("node:path"), http = require("node:http"), assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const root = path.resolve(__dirname, ".."), out = process.env.BROWSER_CEASEFIRE_OUTPUT || path.resolve(root, "../browser-v225/ceasefire");
fs.mkdirSync(out, { recursive: true });
const server = http.createServer((req, res) => {
  const file = path.resolve(root, "." + decodeURIComponent(new URL(req.url, "http://local").pathname).replace(/\/$/, "/index.html"));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403).end(); return; }
  fs.readFile(file, (error, data) => {
    if (error) { res.writeHead(404).end(); return; }
    res.setHeader("Content-Type", ({ ".html": "text/html; charset=utf-8", ".js": "application/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".woff2": "font/woff2" })[path.extname(file)] || "application/octet-stream"); res.end(data);
  });
});
const setups = [{ mode: "accepted", width: 1366, height: 900, size: "standard" }, { mode: "refused", width: 390, height: 844, size: "largest" }];
const CORE = "xian_emperor_simulator_v01", ARMY = "xian_emperor_armies_v050", STRATEGY = "xian_emperor_strategy_network_v040";
(async () => {
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || "msedge" }), results = [], pageErrors = [], httpFailures = [];
  try {
    for (const setup of setups) {
      const context = await browser.newContext({ viewport: { width: setup.width, height: setup.height }, reducedMotion: "reduce" }), page = await context.newPage();
      page.setDefaultTimeout(45000); page.on("pageerror", error => pageErrors.push(String(error))); page.on("dialog", dialog => dialog.accept());
      page.on("response", response => { if (response.status() >= 400 && !response.url().endsWith("favicon.ico")) httpFailures.push({ status: response.status(), url: response.url() }); });
      await page.goto(`http://127.0.0.1:${server.address().port}/`);
      await page.locator(`#start-screen [data-reading-size='${setup.size}']`).click(); await page.locator("#scenario-select").selectOption("jianan_196"); await page.locator("#new-game-btn").click();
      await page.waitForTimeout(650); const skip = page.locator("[data-tutorial-move='skip']").first(); if (await skip.isVisible()) await skip.click();
      await page.locator("[data-choice-index='1']").click();
      const core = () => page.evaluate(() => window.XianEmperorGame.getState());
      const army = () => page.evaluate(() => window.XianArmySystem.getState());
      const promise = () => page.evaluate(() => window.XianStrategyNetwork.getState().promises.find(item => item.type === "ceasefire"));
      const importBundle = async bundle => { await Promise.all([page.waitForEvent("domcontentloaded"), page.evaluate(value => window.XianEmperorGame.restoreFullSave(value), bundle)]); await page.locator("#continue-game-btn").click(); };
      // Only this fixture setup edits a captured public save: no private runtime state.
      // Ordinary 196 is deliberate: Yuan Shao and Cao Cao are current actors there.
      const fixture = await page.evaluate(() => window.XianEmperorGame.captureFullSave());
      const c = fixture.stores[CORE], a = fixture.stores[ARMY], s = fixture.stores[STRATEGY];
      Object.assign(c.stats, { authority: 75, prestige: 70, treasury: 80, security: 80, officials: 60, caoAlert: 30 }); c.hidden.leakRisk = 0; c.relations.yuan_shao = setup.mode === "accepted" ? 90 : 20;
      Object.values(a.armies).forEach(unit => { unit.status = "destroyed"; unit.troops = 0; });
      Object.assign(a.armies.yuan_main, { cityId: "luoyang", targetCityId: "luoyang", task: "attack", status: "engaged", troops: 6000, supply: 90 });
      Object.assign(s.cities.luoyang, { controller: "cao_cao", defense: 33, supply: 24 }); s.strategies.yuan_shao.trust = 90;
      await importBundle(fixture);
      const month = async () => {
        if (!(await core()).eventResolved) await page.locator("[data-choice-index='1']").click();
        const turn = (await core()).turn; await page.locator("#end-turn-btn").click(); await page.locator("#modal-confirm").click();
        // 月末结算分帧执行：等“结算中”提示消失再读取结果。
        await page.waitForFunction(() => !document.getElementById("settlement-progress"));
        const report = page.locator(".monthly-addon-confirm"); if (await report.isVisible()) await report.click();
        assert.equal((await core()).turn, turn + 1); assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
      };
      await month(); assert.equal((await core()).turn, 2); assert.equal((await army()).sieges.luoyang.status, "active");
      await page.locator("[data-choice-index='1']").click();
      await page.locator("#decree-helper-open").click(); await page.locator("#decree-input").fill("令袁绍与曹操停战"); await page.locator("#issue-decree-btn").click();
      const confirmation = await page.locator("#decree-confirmation-content").innerText(); assert.match(confirmation, /停战|围城/);
      if (setup.mode === "refused") assert.match(confirmation, /调遣|关系50/);
      const beforeAction = (await core()).totalActions; await page.locator("#decree-confirmation-confirm").click(); assert.equal((await core()).totalActions, beforeAction + 1);
      const afterPeace = await army(); assert.equal(afterPeace.sieges.luoyang.status, setup.mode === "accepted" ? "lifted" : "active");
      // Open the existing public army viewer; read and operate its real tab UI.
      await page.evaluate(() => window.XianArmySystem.open()); await page.locator("[data-army-tab='battles']").click();
      const feedback = await page.locator("#army-system-content").innerText(); assert.match(feedback, setup.mode === "accepted" ? /已接受停战|停战.*解除/ : /未接受|未开放调遣/);
      await page.screenshot({ path: path.join(out, `${setup.mode}-feedback.png`), fullPage: true }); await page.locator("#army-system-close").click();
      let violationPreview = false;
      if (setup.mode === "accepted") {
        await page.locator("#decree-helper-open").click();
        await page.locator("#decree-input").fill("令袁绍攻取洛阳"); const before = await core(); await page.locator("#issue-decree-btn").click();
        assert.match(await page.locator("#decree-confirmation-content").innerText(), /主动违约/); await page.screenshot({ path: path.join(out, "accepted-restart-preview.png"), fullPage: true });
        await page.locator("#decree-confirmation-edit").click(); assert.deepEqual((await core()).stats, before.stats); assert.deepEqual((await core()).random, before.random); violationPreview = true;
      }
      const checkpoint = await page.evaluate(() => window.XianEmperorGame.captureFullSave()), beforeRestore = await army();
      await page.reload(); await page.locator("#continue-game-btn").click(); assert.deepEqual((await army()).sieges, beforeRestore.sieges);
      await importBundle(checkpoint); assert.deepEqual((await army()).sieges, beforeRestore.sieges);
      await page.evaluate(() => { for (let repeat = 0; repeat < 6; repeat++) window.XianEmperorGame.commit("browser-repeat"); });
      assert.deepEqual((await army()).sieges, beforeRestore.sieges);
      while ((await core()).turn < 5) await month();
      const finalArmy = await army(), finalPromise = await promise();
      assert.equal(finalPromise.status, setup.mode === "accepted" ? "fulfilled" : "broken"); assert.equal(finalPromise.contract.receipts.length, 1);
      assert.equal(finalArmy.conquests.length, setup.mode === "accepted" ? 0 : 1);
      if (setup.mode === "accepted") { assert.equal(finalArmy.sieges.luoyang.progress, afterPeace.sieges.luoyang.progress); assert.equal(finalArmy.sieges.luoyang.citySupply, afterPeace.sieges.luoyang.citySupply); }
      else { assert.equal(finalPromise.contract.receipts[0].kind, "siege-progress"); assert.equal(finalPromise.contract.receipts[0].turn, 2); }
      const bundle = await page.evaluate(() => window.XianEmperorGame.captureFullSave()); fs.writeFileSync(path.join(out, `${setup.mode}-full.json`), JSON.stringify(bundle, null, 2));
      results.push({ ...setup, fixture: { scenario: "jianan_196", city: "luoyang", owner: "cao_cao", army: "yuan_main", troops: 6000, supply: 90, defense: 33, citySupply: 24 },
        formedByActualMilitarySettlement: true, actualUiDecree: true, uiFeedback: feedback, refresh: true, fullImport: true, duplicateCommits: 6, violationPreview, turn: (await core()).turn,
        status: finalPromise.status, receipts: finalPromise.contract.receipts, captures: finalArmy.conquests.length, passed: true });
      console.log(`PASS actual index ceasefire ${setup.mode} ${setup.width} ${setup.size}`); await context.close();
    }
    assert.deepEqual(pageErrors, []); assert.deepEqual(httpFailures, []);
    fs.writeFileSync(path.join(out, "result.json"), JSON.stringify({ results, pageErrors, httpFailures }, null, 2));
  } finally { await browser.close(); server.close(); }
})().catch(error => { fs.writeFileSync(path.join(out, "error.log"), String(error.stack || error)); console.error(error); server.close(); process.exitCode = 1; });

