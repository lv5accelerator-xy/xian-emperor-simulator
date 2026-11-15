"use strict";
// 浏览器回归共用的“真实点击”：用鼠标坐标点击，而不是直接触发元素的 click，
// 这样被遮挡、移出视口或尚在移动的控件会像真人操作一样点不中，测试才能发现。
const assert = require("node:assert/strict");

// width：视口宽度；手机宽度（390）下舆图内的元素也用普通的滚动入视口。
// settleMs：点击后固定等待的毫秒数，供依赖短暂过渡的脚本使用。
function createTap(page, { width, settleMs = 0 } = {}) {
  return async function tap(target) {
    await target.waitFor({ state: "visible" });
    // 舆图是自带滚动的容器：把目标滚到容器中部偏左上，避开右侧军情栏；其余元素滚到视口中央。
    const bringIntoView = () => target.evaluate((node, viewportWidth) => {
      const viewport = node.closest("[data-grand-viewport]");
      if (viewport && viewportWidth !== 390) {
        const r = node.getBoundingClientRect(), b = viewport.getBoundingClientRect();
        viewport.scrollTo({ left: viewport.scrollLeft + r.x + r.width / 2 - b.x - b.width * .4, top: viewport.scrollTop + r.y + r.height / 2 - b.y - b.height * .45, behavior: "instant" });
      } else node.scrollIntoView({ block: "center", inline: "center", behavior: "instant" });
    }, width);
    await bringIntoView();
    // 地图缩放、面板展开等动画期间元素仍在移动，而且过渡可能晚几帧才开始；
    // 所以按时间判断：位置保持 200ms 不变才算稳定，再取可点击的坐标，否则点击会落空。
    const locate = () => target.evaluate(async node => {
      if (node.disabled) return null;
      const probe = () => {
        const r = node.getBoundingClientRect();
        for (const fy of [.5, .25, .75]) for (const fx of [.5, .25, .75]) {
          const x = r.x + r.width * fx, y = r.y + r.height * fy, hit = document.elementFromPoint(x, y);
          if (hit && (hit === node || node.contains(hit))) return { x, y };
        }
        return null;
      };
      // 带呼吸动画的控件（如告急城池）每帧都在微动，永远不会静止：等满 800ms 后只要能点中就接受。
      const started = performance.now(), deadline = started + 3000;
      let last = "", since = started;
      while (performance.now() < deadline) {
        const r = node.getBoundingClientRect(), key = `${r.x}|${r.y}|${r.width}|${r.height}`, now = performance.now();
        if (key !== last) { last = key; since = now; }
        if (now - since >= 200 || now - started >= 800) { const found = probe(); if (found) return found; }
        await new Promise(resolve => requestAnimationFrame(() => resolve()));
      }
      return probe();
    });
    let point = await locate();
    // 页面自己的滚动（回到顶部、跳到某个面板）可能在上面那次滚动之后才落地，把目标又带出视口；重新滚动再定位。
    for (let retry = 0; !point && retry < 2; retry++) { await bringIntoView(); point = await locate(); }
    if (!point) console.log(await target.evaluate(node => ({ disabled: node.disabled, rect: node.getBoundingClientRect().toJSON(),
      viewport: node.closest("[data-grand-viewport]")?.getBoundingClientRect().toJSON(),
      hit: document.elementFromPoint(node.getBoundingClientRect().x + 5, node.getBoundingClientRect().y + 5)?.className })));
    assert.ok(point, `visible control must receive pointer input: ${target}`);
    // 悬停本身会改变样式，曾让舆图标记整个跳开（见 tests/map-hover-regression.js）。
    // 所以先把指针移过去，隔 60ms 再确认一次：两次都悬停在目标上、且坐标仍落在目标范围内才按下；
    // 否则重新定位。不要求位置分毫不差：悬停放大和呼吸动画都会让控件小幅移动。
    const hovered = at => target.evaluate((node, p) => { const r = node.getBoundingClientRect(); return node.matches(":hover") && p.x >= r.left && p.x <= r.right && p.y >= r.top && p.y <= r.bottom; }, at);
    for (let attempt = 0; attempt < 30; attempt++) {
      await page.mouse.move(point.x, point.y);
      if (await hovered(point)) {
        await page.waitForTimeout(60);
        if (await hovered(point)) break;
      } else await page.waitForTimeout(50);
      point = await locate() || point;
    }
    await page.mouse.click(point.x, point.y);
    if (settleMs) await page.waitForTimeout(settleMs);
  };
}

module.exports = { createTap };
