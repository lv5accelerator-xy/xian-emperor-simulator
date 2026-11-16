"use strict";
// 系统开启“减少动态效果”时，界面跳转不得平滑滚动；各模块统一通过 XianMotion 取滚动方式。
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const src = path.resolve(__dirname, "../src");

function motion(reduced) {
  const window = { matchMedia: query => ({ matches: reduced && /prefers-reduced-motion:\s*reduce/.test(query) }), addEventListener() {} };
  const document = { documentElement: { dataset: {} }, querySelectorAll: () => [], addEventListener() {}, readyState: "loading" };
  vm.runInNewContext(fs.readFileSync(path.join(src, "reading-settings.js"), "utf8"), { window, document, localStorage: { getItem: () => null, setItem() {} } });
  return window.XianMotion;
}
assert.equal(motion(false).scrollBehavior(), "smooth");
assert.equal(motion(false).scrollBehavior(false), "auto");
assert.equal(motion(true).scrollBehavior(), "auto", "减少动态效果时直接定位");
assert.equal(motion(true).scrollBehavior(true), "auto");

const literal = [];
for (const file of fs.readdirSync(src).filter(name => name.endsWith(".js")).sort()) {
  fs.readFileSync(path.join(src, file), "utf8").split("\n").forEach((line, index) => {
    if (/behavior:\s*["']smooth["']/.test(line)) literal.push(`${file}:${index + 1}`);
  });
}
assert.deepEqual(literal, [], "不要写死平滑滚动，请用 window.XianMotion?.scrollBehavior() || \"smooth\"");
console.log("reduced-motion-regression passed");
