"use strict";
// 各窗口的键盘回归：舆图、御前档案、军团等自建窗口与通用弹窗、月报，用键盘打开后
// 焦点进入窗口、连按 Tab 不出窗、背景不可聚焦、Esc 关闭后焦点回到打开它的按钮；窗口上再叠通用弹窗也一样。
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict");
const { pathToFileURL } = require("node:url");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const root = path.resolve(__dirname, ".."), out = path.resolve(process.env.KEYBOARD_SCREENS_OUTPUT || path.join(root, "../browser-keyboard-screens"));
fs.mkdirSync(out, { recursive: true });

(async () => {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || "chrome" });
  const failures = [];
  let page = null;
  const check = (width, name, ok, detail) => { console.log(ok ? "PASS" : "FAIL", width, name, ok ? "" : JSON.stringify(detail)); if (!ok) failures.push({ width, name, detail }); };
  const focusInfo = () => page.evaluate(() => {
    const el = document.activeElement, rect = el.getBoundingClientRect();
    let hidden = false; for (let node = el; node; node = node.parentElement) if (node.inert || node.getAttribute?.("aria-hidden") === "true") hidden = true;
    const layer = el.closest('[role="dialog"][aria-modal="true"]');
    return { id: el.id, text: (el.textContent || "").trim().slice(0, 10), body: el === document.body, visible: rect.width > 0 && rect.height > 0, hidden,
      layer: layer ? (layer.id || layer.className.split(" ")[0]) : null };
  });
  async function fresh(width, height) {
    if (page) await page.context().close();
    page = await (await browser.newContext({ viewport: { width, height }, reducedMotion: "reduce" })).newPage();
    page.errors = [];
    page.on("pageerror", error => page.errors.push(String(error)));
    page.on("dialog", dialog => dialog.accept());
    await page.goto(pathToFileURL(path.join(root, "index.html")).href);
    await page.waitForFunction(() => window.XianEmperorGame);
    await page.evaluate(() => window.XianEmperorGame.startNewGame("standard", "jianan_196", { randomSeed: 20261017 }));
    await page.waitForTimeout(1200);
    for (const selector of ["[data-tutorial-move='skip']", "#modal-confirm"]) { const target = page.locator(selector).first(); if (await target.isVisible().catch(() => false)) await target.click().catch(() => {}); }
    // 等教程等窗口都关闭、焦点归还（下一轮事件循环）完成后再开始，免得归还焦点恰好落在下一步“聚焦—回车”之间。
    await page.waitForFunction(() => ![...document.querySelectorAll('[role="dialog"][aria-modal="true"]')].some(node => node.getClientRects().length && !node.closest(".hidden,[hidden]")));
    await page.waitForTimeout(200);
  }
  async function pressOn(selector) {
    if (!await page.locator(selector).isVisible()) { await page.locator("#utility-more-toggle").focus(); await page.keyboard.press("Enter"); }
    await page.locator(selector).waitFor({ state: "visible" });
    // 像真人一样：确认焦点确实落在按钮上再按回车。
    for (let attempt = 0; attempt < 5; attempt++) {
      await page.locator(selector).focus();
      if (await page.evaluate(sel => document.activeElement === document.querySelector(sel), selector)) break;
      await page.waitForTimeout(100);
    }
    await page.keyboard.press("Enter");
    await page.waitForTimeout(500);
  }
  async function cycle(width, name, layer, opener) {
    const first = await focusInfo();
    check(width, `${name}: opening moves focus into the window`, first.layer === layer, first);
    const seen = [];
    for (let i = 0; i < 40; i++) { await page.keyboard.press("Tab"); seen.push(await focusInfo()); }
    for (let i = 0; i < 5; i++) { await page.keyboard.press("Shift+Tab"); seen.push(await focusInfo()); }
    const escaped = seen.filter(item => item.layer !== layer || item.body || !item.visible || item.hidden);
    check(width, `${name}: Tab and Shift+Tab stay on visible controls inside`, escaped.length === 0, escaped.slice(0, 3));
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    const after = await focusInfo();
    if (opener) check(width, `${name}: Escape returns focus to its opener`, after.id === opener.replace("#", "") || (opener === "more" && after.id === "utility-more-toggle"), after);
    return after;
  }
  try {
    const desktop = [["舆图", "#world-map-btn", "xian-world-window"], ["御前档案", "#imperial-archive-btn", "imperial-dialog"], ["军团", "#army-system-btn", "army-system-window"], ["说明", "#help-btn", "modal"], ["存档备份", "#backups-btn", "modal"]];
    for (const [name, selector, layer] of desktop) {
      await fresh(1366, 900);
      const inMenu = !await page.locator(selector).isVisible();
      await pressOn(selector);
      if (selector === "#world-map-btn" && await page.locator("[data-map-guide-skip]").isVisible()) { await page.locator("[data-map-guide-skip]").focus(); await page.keyboard.press("Enter"); await page.waitForTimeout(200); await page.locator("#xian-world-close").focus(); }
      await cycle(1366, name, layer, inMenu ? "more" : selector);
      check(1366, `${name}: no page errors`, page.errors.length === 0, page.errors);
    }

    // 窗口上再叠通用弹窗：弹窗关闭后焦点回到窗口里，窗口仍拦住 Tab。
    await fresh(1366, 900);
    await pressOn("#world-map-btn");
    if (await page.locator("[data-map-guide-skip]").isVisible()) await page.locator("[data-map-guide-skip]").click();
    await page.locator("[data-world-panel='people']").focus();
    await page.evaluate(() => window.XianEmperorGame.openUtilityModal({ title: "叠加测试", body: "<p>叠在舆图上</p>", onConfirm: () => window.XianEmperorGame.closeUtilityModal() }));
    await page.waitForTimeout(300);
    check(1366, "stacked: dialog over the map takes focus", (await focusInfo()).layer === "modal", await focusInfo());
    await page.keyboard.press("Escape"); await page.waitForTimeout(400);
    let info = await focusInfo();
    check(1366, "stacked: closing it returns focus inside the map", info.layer === "xian-world-window", info);
    const leaked = [];
    for (let i = 0; i < 15; i++) { await page.keyboard.press("Tab"); const item = await focusInfo(); if (item.layer !== "xian-world-window") leaked.push(item); }
    check(1366, "stacked: the map still traps Tab afterwards", leaked.length === 0, leaked.slice(0, 2));

    // 月报与月末预检（通用弹窗与自管焦点的月报接力）。
    await fresh(1366, 900);
    await page.locator("[data-choice-index='0']").click(); await page.waitForTimeout(300);
    await pressOn("#end-turn-btn");
    await cycle(1366, "月末预检", "modal", "#end-turn-btn");
    await pressOn("#end-turn-btn");
    await page.locator("#modal-confirm").focus(); await page.keyboard.press("Enter");
    await page.locator(".monthly-addon-confirm").waitFor({ timeout: 20000 }); await page.waitForTimeout(300);
    info = await focusInfo();
    check(1366, "月报: report keeps focus after the preflight dialog closes", info.layer === "monthly-addon-dialog", info);

    // 手机宽度：舆图入口在底部导航。
    await fresh(390, 844);
    await page.locator("[data-mobile-destination='map']").focus(); await page.keyboard.press("Enter"); await page.waitForTimeout(600);
    if (await page.locator("[data-map-guide-skip]").isVisible()) { await page.locator("[data-map-guide-skip]").focus(); await page.keyboard.press("Enter"); await page.waitForTimeout(200); }
    info = await focusInfo();
    const mobileLayer = info.layer;
    check(390, "舆图: opening on a phone (and skipping the guide) keeps focus in the window", mobileLayer === "xian-world-window", info);
    if (mobileLayer) await cycle(390, "舆图", mobileLayer, null);
    check(390, "no page errors", page.errors.length === 0, page.errors);
  } finally { await browser.close(); }
  fs.writeFileSync(path.join(out, "summary.json"), JSON.stringify({ failures }, null, 2));
  assert.deepEqual(failures, [], "keyboard screens");
  console.log("PASS keyboard screens: windows, stacked dialogs and the monthly report keep focus inside and return it");
})().catch(error => { console.error(error); process.exitCode = 1; });
