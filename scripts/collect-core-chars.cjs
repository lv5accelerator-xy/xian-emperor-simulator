"use strict";
// 收集“常用字”：开局、主界面、月末预检、月报、舆图实际显示的字（三个剧本 × 桌面与手机宽度，另加清晰字风），
// 写入 assets/fonts/core-chars.txt，供 scripts/split-font-slices.py 把字体切成常用片与其余片。
// 只影响首屏要下载多少字体，不影响显示是否正确：不在表里的字仍在“其余片”里，用到时才下载。
const fs = require("node:fs"), path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const root = path.resolve(__dirname, ".."), output = process.env.CORE_CHARS_OUTPUT || path.join(root, "assets/fonts/core-chars.txt");

(async () => {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || undefined });
  const seen = new Set();
  const grab = async page => {
    const text = await page.evaluate(() => document.body.innerText + [...document.querySelectorAll("[aria-label],[title],[placeholder]")]
      .map(node => (node.getAttribute("aria-label") || "") + (node.getAttribute("title") || "") + (node.getAttribute("placeholder") || "")).join(""));
    for (const character of text) if (!/\s/.test(character)) seen.add(character);
  };
  try {
    // 古风、清晰两种字风的说明文字不同，各走一遍。
    const runs = [];
    for (const scenario of ["zhongping_189", "jianan_196", "yankang_220"]) for (const [width, height] of [[1366, 900], [390, 844]]) runs.push({ scenario, width, height, mode: "classic" });
    runs.push({ scenario: "jianan_196", width: 1366, height: 900, mode: "clear" }, { scenario: "jianan_196", width: 390, height: 844, mode: "clear" });
    for (const { scenario, width, height, mode } of runs) {
      const context = await browser.newContext({ viewport: { width, height } });
      await context.addInitScript(value => { try { localStorage.setItem("xian_font_mode_v1", value); } catch (_) {} }, mode);
      const page = await context.newPage();
      page.on("dialog", dialog => dialog.accept());
      await page.goto(pathToFileURL(path.join(root, "index.html")).href);
      await page.waitForTimeout(600); await grab(page);
      await page.evaluate(id => window.XianEmperorGame.startNewGame("standard", id, { randomSeed: 20261017 }), scenario);
      await page.waitForTimeout(1200); await grab(page);
      for (const selector of ["[data-tutorial-move='skip']", "#modal-confirm"]) { const target = page.locator(selector).first(); if (await target.isVisible().catch(() => false)) await target.click().catch(() => {}); }
      await grab(page);
      await page.locator("[data-choice-index='0']").click(); await page.waitForTimeout(300); await grab(page);
      await page.evaluate(() => window.XianEmperorGame.requestEndTurn()); await page.waitForTimeout(300); await grab(page);
      await page.locator("#modal-confirm").click();
      await page.locator(".monthly-addon-confirm").waitFor({ timeout: 20000 }); await grab(page);
      await page.locator(".monthly-addon-confirm").click(); await page.waitForTimeout(300); await grab(page);
      if (width > 760) { if (!await page.locator("#world-map-btn").isVisible()) await page.locator("#utility-more-toggle").click(); await page.locator("#world-map-btn").click(); }
      else await page.locator("[data-mobile-destination='map']").click();
      await page.waitForTimeout(1200); await grab(page);
      await context.close();
    }
  } finally { await browser.close(); }
  const cjk = [...seen].filter(character => /[⺀-〿㐀-䶿一-鿿豈-﫿！-｠]/u.test(character)).sort();
  fs.writeFileSync(output, cjk.join("") + "\n");
  console.log(`core chars: ${cjk.length} → ${path.relative(root, output)}`);
})().catch(error => { console.error(error); process.exitCode = 1; });
