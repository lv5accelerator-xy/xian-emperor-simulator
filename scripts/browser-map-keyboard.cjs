"use strict";
// 舆图回归：只用 Tab、Shift+Tab、方向键、回车与 Esc 完成一次调兵；另查标注避让。
// 检查焦点不会在军情栏内容替换后掉回页面顶部、Esc 能取消军令、焦点环可见，城池圆点落在坐标上、名牌与军团标记互不遮挡。
// 桌面与手机宽度各跑一遍；另查工具栏不压两侧栏、许都不被浮层遮住、最东的城池能滚到可见处（含 1530×740 与特大字号）。
const fs = require("node:fs"), path = require("node:path"), assert = require("node:assert/strict");
const { pathToFileURL } = require("node:url");
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const root = path.resolve(__dirname, ".."), out = path.resolve(process.env.MAP_KEYBOARD_OUTPUT || path.join(root, "../browser-map-keyboard"));
fs.mkdirSync(out, { recursive: true });

// 浮层检查：工具栏不能压住两侧栏；地图归中后许都不在任何浮层底下；最东的城池能滚到没被遮住的区域。
const panelCheck = () => {
  const rect = selector => document.querySelector(selector)?.getBoundingClientRect();
  const toolbar = rect(".grand-map-toolbar"), rail = rect(".world-map-status-rail"), inspector = rect(".grand-map-inspector");
  const overlap = (a, b) => a && b && a.height && b.height && a.left < b.right && a.right > b.left ? Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)) : 0;
  const covers = point => [...document.querySelectorAll(".grand-map-toolbar, .world-map-status-rail, .grand-map-inspector, .grand-map-legend")]
    .some(node => { const box = node.getBoundingClientRect(); return box.width && getComputedStyle(node).opacity !== "0" && point.x > box.left && point.x < box.right && point.y > box.top && point.y < box.bottom; });
  const dot = id => { const box = document.querySelector(`[data-grand-city="${id}"] span`).getBoundingClientRect(); return { x: box.left + box.width / 2, y: box.top + box.height / 2 }; };
  const viewport = document.querySelector("[data-grand-viewport]");
  const easternmost = [...document.querySelectorAll("[data-grand-city]")].map(node => node.dataset.grandCity).sort((a, b) => window.XianGrandMap.positions[b][0] - window.XianGrandMap.positions[a][0])[0];
  const before = viewport.scrollLeft; viewport.scrollLeft = viewport.scrollWidth;
  const eastVisible = !covers(dot(easternmost));
  viewport.scrollLeft = before;
  const result = { railOverlap: Math.round(overlap(toolbar, rail)), inspectorOverlap: Math.round(overlap(toolbar, inspector)), xuduCovered: covers(dot("xudu")), easternmost, eastVisible };
  return { ...result, ok: !result.railOverlap && !result.inspectorOverlap && !result.xuduCovered && eastVisible };
};

(async () => {
  const browser = await chromium.launch({ channel: process.env.BROWSER_CHANNEL || "chrome" });
  const failures = [];
  try {
    for (const [width, height] of [[1366, 900], [390, 844]]) {
      const context = await browser.newContext({ viewport: { width, height }, reducedMotion: "reduce" });
      const page = await context.newPage(), errors = [];
      page.on("pageerror", error => errors.push(String(error)));
      page.on("dialog", dialog => dialog.accept());
      const check = (name, ok, detail) => { console.log(ok ? "PASS" : "FAIL", width, name, ok ? "" : JSON.stringify(detail)); if (!ok) failures.push({ width, name, detail }); };
      const focusInfo = () => page.evaluate(() => {
        const el = document.activeElement;
        return { tag: el?.tagName, body: el === document.body, army: el?.dataset?.grandArmyCity, city: el?.dataset?.grandCity, task: el?.dataset?.mapCommandArmy ? el.dataset.mapCommandTask : undefined,
          inInspector: Boolean(el?.closest?.("[data-map-inspector]")), heading: el?.matches?.("[data-map-inspector] h4") ? el.textContent : undefined,
          confirm: el?.matches?.("[data-map-command-confirm]"), preview: el?.matches?.("[data-map-command-preview]"), select: el?.matches?.("[data-map-command-target]") };
      });
      // 按 Tab 直到满足条件；最多 limit 次，途中焦点不得掉回 body。
      const tabUntil = async (predicate, limit = 260, key = "Tab") => {
        for (let i = 0; i < limit; i++) {
          await page.keyboard.press(key);
          const info = await focusInfo();
          if (predicate(info)) return { info, presses: i + 1 };
        }
        return { info: await focusInfo(), presses: limit, missed: true };
      };

      await page.goto(pathToFileURL(path.join(root, "index.html")).href);
      await page.waitForFunction(() => window.XianEmperorGame);
      await page.evaluate(() => window.XianEmperorGame.startNewGame("standard", "jianan_196", { randomSeed: 20261017 }));
      await page.waitForTimeout(1200);
      for (const selector of ["[data-tutorial-move='skip']", "#modal-confirm"]) { const target = page.locator(selector).first(); if (await target.isVisible().catch(() => false)) await target.click().catch(() => {}); }
      // 军令要先裁决本月奏报；这一步不是本测试的对象，直接点选。
      await page.locator("[data-choice-index='0']").click();
      await page.waitForTimeout(300);
      // 用键盘打开舆图：把焦点放到入口上按回车。
      const entry = width > 800 ? "#world-map-btn" : "[data-mobile-destination='map']";
      if (width > 800 && !await page.locator(entry).isVisible()) { await page.locator("#utility-more-toggle").focus(); await page.keyboard.press("Enter"); }
      await page.locator(entry).focus();
      await page.keyboard.press("Enter");
      await page.locator(".grand-map-shell").waitFor();
      await page.waitForTimeout(600);
      if (await page.locator("[data-map-guide-skip]").isVisible()) { await page.locator("[data-map-guide-skip]").focus(); await page.keyboard.press("Enter"); }

      // 标注避让：城池名牌之间、军团标记与城池名牌之间基本不重叠（允许名牌边缘少量相交）。
      await page.waitForTimeout(300);
      const overlaps = await page.evaluate(() => {
        const boxes = [...document.querySelectorAll(".grand-city, .grand-army-marker")].map(el => ({ name: el.dataset.grandCity || `军@${el.dataset.grandArmyCity}`, r: el.getBoundingClientRect() })).filter(item => item.r.width);
        const bad = [];
        for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
          const a = boxes[i].r, b = boxes[j].r;
          const area = Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) * Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top));
          const share = area / Math.min(a.width * a.height, b.width * b.height);
          if (share > 0.2) bad.push(`${boxes[i].name}/${boxes[j].name} ${Math.round(share * 100)}%`);
        }
        return { count: boxes.length, bad };
      });
      check("city labels and army markers do not cover each other", overlaps.bad.length === 0, overlaps);
      check("city dots sit on their map coordinates", await page.evaluate(() => [...document.querySelectorAll(".grand-city")].every(el => {
        const dot = el.querySelector("span").getBoundingClientRect(), stage = document.querySelector("[data-map-stage]").getBoundingClientRect();
        const scale = stage.width / 1200, [x, y] = window.XianGrandMap.positions[el.dataset.grandCity];
        return Math.abs(dot.left + dot.width / 2 - (stage.left + x * scale)) < 3 && Math.abs(dot.top + dot.height / 2 - (stage.top + y * scale)) < 3;
      })));

      const panels = await page.evaluate(panelCheck);
      check("toolbar does not cover the side panels, and Xudu is not hidden behind any panel", panels.ok, panels);

      // 找一支可以直接下令的军团所在城池。
      const target = await page.evaluate(() => {
        const armies = Object.values(window.XianArmySystem?.getState?.()?.armies || {});
        const army = armies.find(item => item.status !== "destroyed" && window.XianArmySystem.getCommandAccess?.(item)?.allowed !== false);
        if (!army) return null;
        // 列表里第一个能通过路线复核的目标（下标从 1 起，保证要按方向键）。
        const cities = window.XIAN_STRATEGY_DATA.cities;
        for (const task of ["attack", "support", "defend", "supply", "retreat"]) {
          const index = cities.findIndex((city, i) => i > 0 && window.XianArmySystem.previewMapOrder?.(army.id, city.id, task)?.ok);
          if (index > 0) return { cityId: army.cityId, armyId: army.id, task, index };
        }
        return { cityId: army.cityId, armyId: army.id, index: -1 };
      });
      check("a commandable army exists", Boolean(target), target);
      if (!target) { await context.close(); continue; }

      await page.locator("[data-grand-viewport]").focus();
      const reach = await tabUntil(info => info.army === target.cityId);
      check("army marker is reachable with Tab", !reach.missed, reach);
      const ring = await page.evaluate(() => getComputedStyle(document.activeElement).outlineStyle);
      check("army marker shows a focus ring", ring !== "none", ring);

      await page.keyboard.press("Enter");
      let info = await focusInfo();
      check("opening an army moves focus to the inspector heading", Boolean(info.heading), info);
      check("inspector change is announced", (await page.locator("[data-map-announce]").textContent()).includes("军团集群"), await page.locator("[data-map-announce]").textContent());

      const firstTask = await tabUntil(i => Boolean(i.task), 40);
      check("command buttons follow the heading", !firstTask.missed && firstTask.presses <= 6, firstTask);
      await page.keyboard.press("Enter");
      info = await focusInfo();
      check("starting a command focuses the target picker", info.select === true, info);

      await page.keyboard.press("Escape");
      info = await focusInfo();
      check("Escape cancels the command", await page.evaluate(() => !document.querySelector(".grand-map-shell").classList.contains("commanding")), info);
      check("after Escape focus returns to the army list", Boolean(info.heading) && !info.body, info);

      // 再下一次令，这次用列表选目标并确认。
      const again = await tabUntil(i => i.task === target.task, 40);
      check("command buttons reachable again", !again.missed, again);
      await page.keyboard.press("Enter");
      for (let i = 0; i < Math.max(1, target.index); i++) await page.keyboard.press("ArrowDown");
      const chosen = await page.evaluate(() => document.activeElement.value);
      check("arrow keys change the target city", Boolean(chosen), chosen);
      const preview = await tabUntil(i => i.preview, 3);
      check("preview button follows the picker", !preview.missed, preview);
      await page.keyboard.press("Enter");
      info = await focusInfo();
      check("route review moves focus to its heading", Boolean(info.heading), info);
      const reviewed = await page.locator("[data-map-command-confirm]").count();
      check("a reachable target was found for the keyboard order", target.index > 0, target);
      if (reviewed) {
        const confirm = await tabUntil(i => i.confirm, 6);
        check("confirm is a few Tabs from the review heading", !confirm.missed, confirm);
        const before = await page.evaluate(() => window.XianEmperorGame.getState().actionPoints);
        if (await page.locator("[data-map-replace]").count()) await page.locator("[data-map-replace]").check();
        await page.keyboard.press("Enter");
        info = await focusInfo();
        const after = await page.evaluate(() => window.XianEmperorGame.getState().actionPoints);
        check("order issued by keyboard", (await page.locator(".map-command-success").count()) === 1 && after < before, { before, after });
        check("success message receives focus", Boolean(info.heading), info);
        check("the redrawn map is no longer in command mode", await page.evaluate(() => !document.querySelector(".grand-map-shell.commanding, .grand-city.command-target")));
      } else {
        check("refused route still leaves focus in the inspector", info.inInspector, info);
      }

      // 地图上的城池同样可用 Tab 到达并有焦点环。先确保已退出下令状态。
      if (await page.evaluate(() => document.querySelector(".grand-map-shell").classList.contains("commanding"))) await page.keyboard.press("Escape");
      await page.locator("[data-grand-viewport]").focus();
      const city = await tabUntil(i => Boolean(i.city), 120);
      check("cities are reachable with Tab", !city.missed, city);
      check("city shows a focus ring", await page.evaluate(() => getComputedStyle(document.activeElement.querySelector("span")).outlineStyle !== "none"));
      await page.keyboard.press("Enter");
      info = await focusInfo();
      check("inspecting a city keeps focus on the map", info.city === city.info.city, info);

      check("no page errors", errors.length === 0, errors);
      await page.screenshot({ path: path.join(out, `map-keyboard-${width}.png`) });
      await context.close();
    }
    // 用户反馈的窗口：1530×740，另测特大字号（工具栏更高）。
    for (const size of ["standard", "largest"]) {
      const context = await browser.newContext({ viewport: { width: 1530, height: 740 }, reducedMotion: "reduce" });
      const page = await context.newPage();
      page.on("dialog", dialog => dialog.accept());
      await page.addInitScript(value => { try { localStorage.setItem("xian_reading_size_v1", value); } catch (_) {} }, size);
      await page.goto(pathToFileURL(path.join(root, "index.html")).href);
      await page.evaluate(() => window.XianEmperorGame.startNewGame("standard", "zhongping_189", { randomSeed: 20261017 }));
      await page.waitForTimeout(1000);
      for (const selector of ["[data-tutorial-move='skip']", "#modal-confirm"]) { const target = page.locator(selector).first(); if (await target.isVisible().catch(() => false)) await target.click().catch(() => {}); }
      if (!await page.locator("#world-map-btn").isVisible()) await page.locator("#utility-more-toggle").click();
      await page.locator("#world-map-btn").click();
      await page.locator(".grand-map-viewport").waitFor(); await page.waitForTimeout(800);
      if (await page.locator("[data-map-guide-skip]").isVisible()) await page.locator("[data-map-guide-skip]").click();
      await page.waitForTimeout(300);
      const panels = await page.evaluate(panelCheck);
      const ok = panels.ok;
      console.log(ok ? "PASS" : "FAIL", 1530, `${size}: panels clear of the toolbar and every city reachable`, ok ? "" : JSON.stringify(panels));
      if (!ok) failures.push({ width: 1530, name: size, detail: panels });
      await context.close();
    }
  } finally { await browser.close(); }
  fs.writeFileSync(path.join(out, "summary.json"), JSON.stringify({ failures }, null, 2));
  assert.deepEqual(failures, [], "map keyboard operation");
  console.log("PASS map keyboard: dispatch an army with keyboard only at 1366 and 390");
})().catch(error => { console.error(error); process.exitCode = 1; });
