"use strict";
// 文字对比度回归（WCAG 2.2 最低对比度：普通文字 4.5:1，大字 3:1）。
// 游戏界面大量使用渐变、插图与半透明叠层，自动工具多半无法判断背景；这里按实际渲染测量：
// 每个屏幕截两张图，一张正常显示，一张把文字设为透明只剩背景，前景取计算样式色，背景取该文字区域内像素的中位亮度。
// 只检查 HTML 文字（SVG 地图标注自带描边，另由人工查看），禁用控件不计。
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const root = path.resolve(__dirname, ".."), out = path.resolve(process.env.CONTRAST_OUTPUT || path.join(root, "../browser-contrast"));
fs.mkdirSync(out, { recursive: true });

const collect = () => {
  const items = [];
  for (const element of document.querySelectorAll("body *")) {
    if (element.closest("svg") || element.closest("button:disabled,[aria-disabled=true]")) continue;
    const text = [...element.childNodes].filter(node => node.nodeType === 3 && node.textContent.trim()).map(node => node.textContent.trim()).join("");
    if (!text) continue;
    const style = getComputedStyle(element);
    if (style.visibility !== "visible" || style.display === "none") continue;
    let opacity = 1;
    for (let node = element; node; node = node.parentElement) opacity *= Number(getComputedStyle(node).opacity);
    if (opacity < 0.2) continue;
    const rect = element.getBoundingClientRect();
    if (rect.width < 4 || rect.height < 4 || rect.bottom < 0 || rect.right < 0 || rect.top > innerHeight || rect.left > innerWidth) continue;
    const top = document.elementFromPoint(Math.min(innerWidth - 1, Math.max(0, rect.left + rect.width / 2)), Math.min(innerHeight - 1, Math.max(0, rect.top + rect.height / 2)));
    if (!top || !(top === element || element.contains(top) || top.contains(element))) continue;
    const color = style.color.match(/[\d.]+/g).map(Number);
    items.push({ key: `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ""}${element.classList.length ? `.${[...element.classList].join(".")}` : ""}`, text: text.slice(0, 16),
      x: Math.max(0, rect.left), y: Math.max(0, rect.top), w: Math.min(rect.width, innerWidth - rect.left), h: Math.min(rect.height, innerHeight - rect.top),
      color: color.slice(0, 3), alpha: (color[3] ?? 1) * opacity, size: parseFloat(style.fontSize), weight: Number(style.fontWeight) });
  }
  return items;
};

// 在页面里解码截图并计算每个文字区域的背景中位色与对比度。
const evaluate = async ({ png, items }) => {
  const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${png}`)).blob());
  const canvas = new OffscreenCanvas(bitmap.width, bitmap.height), context = canvas.getContext("2d");
  context.drawImage(bitmap, 0, 0);
  const lum = ([r, g, b]) => [r, g, b].map(c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; }).reduce((sum, c, i) => sum + c * [0.2126, 0.7152, 0.0722][i], 0);
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
  return items.map(item => {
    const data = context.getImageData(Math.floor(item.x), Math.floor(item.y), Math.max(1, Math.floor(item.w)), Math.max(1, Math.floor(item.h))).data;
    const pixels = [];
    for (let i = 0; i < data.length; i += 4) pixels.push([data[i], data[i + 1], data[i + 2]]);
    pixels.sort((a, b) => lum(a) - lum(b));
    const background = pixels[pixels.length >> 1];
    const foreground = item.color.map((c, k) => c * item.alpha + background[k] * (1 - item.alpha));
    const large = item.size >= 24 || (item.size >= 18.66 && item.weight >= 700);
    return { ...item, background, ratio: Number(ratio(foreground, background).toFixed(2)), required: large ? 3 : 4.5 };
  });
};

(async () => {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || undefined });
  const results = [];
  try {
    for (const [width, height] of [[1366, 900], [390, 844]]) {
      const context = await browser.newContext({ viewport: { width, height }, reducedMotion: "reduce", deviceScaleFactor: 1 });
      const page = await context.newPage();
      page.on("dialog", dialog => dialog.accept());
      const measure = async screen => {
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(500);
        const items = await page.evaluate(collect);
        await page.addStyleTag({ content: "*:not(svg *){color:transparent!important;-webkit-text-fill-color:transparent!important;text-shadow:none!important}" });
        await page.waitForTimeout(150);
        const png = (await page.screenshot()).toString("base64");
        await page.evaluate(() => document.querySelectorAll("style").forEach(style => { if (style.textContent.includes("-webkit-text-fill-color:transparent!important")) style.remove(); }));
        for (const row of await page.evaluate(evaluate, { png, items })) results.push({ screen: `${screen}@${width}`, ...row });
      };
      const skip = async () => { for (const selector of ["[data-tutorial-move='skip']", "#modal-confirm"]) { const target = page.locator(selector).first(); if (await target.isVisible().catch(() => false)) await target.click().catch(() => {}); } };
      await page.goto(`file://${path.join(root, "index.html")}`);
      await measure("start");
      await page.evaluate(() => window.XianEmperorGame.startNewGame("standard", "jianan_196", { randomSeed: 20261017 }));
      await page.waitForTimeout(1500); await skip();
      await page.evaluate(() => scrollTo(0, 0)); await measure("game-top");
      await page.evaluate(() => scrollTo(0, 900)); await measure("game-middle");
      await page.evaluate(() => scrollTo(0, 0));
      await page.locator("[data-choice-index='0']").click();
      await page.waitForTimeout(400);
      await page.evaluate(() => window.XianEmperorGame.requestEndTurn());
      await page.waitForTimeout(400); await measure("preflight");
      await page.locator("#modal-confirm").click();
      await page.locator(".monthly-addon-confirm").waitFor({ timeout: 20000 }); await measure("monthly-report");
      await page.locator(".monthly-addon-confirm").click();
      await page.waitForTimeout(400);
      if (width > 800) { if (!await page.locator("#world-map-btn").isVisible()) await page.locator("#utility-more-toggle").click(); await page.locator("#world-map-btn").click(); }
      else await page.locator("[data-mobile-destination='map']").click();
      await page.waitForTimeout(800);
      if (await page.locator("[data-map-guide-skip]").isVisible()) await page.locator("[data-map-guide-skip]").click();
      await measure("map");
      await context.close();
    }
  } finally { await browser.close(); }
  fs.writeFileSync(path.join(out, "contrast-result.json"), JSON.stringify(results, null, 1));
  const failures = results.filter(row => row.ratio < row.required);
  for (const row of failures) console.log(`FAIL ${row.screen} ${row.key} “${row.text}” ${row.ratio}:1 < ${row.required}:1 (fg ${row.color} on ${row.background}, ${row.size}px)`);
  assert.ok(results.length > 300, `measured enough text elements (${results.length})`);
  assert.deepEqual(failures.map(row => `${row.screen} ${row.key}`), [], "all measured text meets WCAG minimum contrast");
  console.log(`PASS contrast: ${results.length} text elements on 12 screens meet WCAG minimum contrast`);
})().catch(error => { console.error(error); process.exitCode = 1; });
