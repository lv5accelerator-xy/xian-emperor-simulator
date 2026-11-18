"use strict";
// 舆图上的城池与军团标记靠 transform 定位（军团标记 translate(-50%,-50%) 居中，城池按名牌方位用变量）。全局的 button:hover:not(:disabled)
// 会把 transform 整个改写成 translateY(-1px)，优先级还高于 .grand-city:hover，于是标记在悬停时跳开半个身位、
// 鼠标随即落空。舆图样式必须用不低于全局规则的优先级保住居中。
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const root = path.resolve(__dirname, "..");
const global = fs.readFileSync(path.join(root, "styles.css"), "utf8"), map = fs.readFileSync(path.join(root, "src/grand-map.css"), "utf8");

// 粗略的优先级：[类/伪类/属性数, 标签数]。:not() 本身不计，括号里的照算。
function specificity(selector) {
  const plain = selector.replace(/:not\(([^)]*)\)/g, " $1 ");
  return [(plain.match(/\.[\w-]+|:(?!:)[\w-]+|\[[^\]]+\]/g) || []).length, (plain.match(/(^|[\s>+~])[a-z][\w-]*/g) || []).length];
}
const higherOrEqual = (a, b) => a[0] > b[0] || (a[0] === b[0] && a[1] >= b[1]);

const generic = global.match(/(button:hover[^{,]*)\{[^}]*transform:[^}]*\}/);
assert.ok(generic, "全局按钮悬停位移规则仍在，本测试才有意义");
for (const element of [".grand-city", ".grand-army-marker"]) {
  const rules = [...map.matchAll(/([^{}]+)\{([^}]*)\}/g)].flatMap(([, selectors, body]) => selectors.split(",").map(selector => ({ selector: selector.trim(), body })))
    .filter(rule => rule.selector.includes(`${element}:hover`) && /transform:/.test(rule.body));
  const strong = rules.filter(rule => higherOrEqual(specificity(rule.selector), specificity(generic[1].trim())));
  assert.ok(strong.length, `${element} 的悬停样式优先级必须不低于全局按钮悬停规则`);
  // 城池自 v2.34 起按名牌方位用变量定位（圆点落在坐标上），军团标记仍居中。
  assert.ok(strong.every(rule => /transform:\s*translate\((-50%,\s*-50%|var\(--city-x\),\s*var\(--city-y\))\)/.test(rule.body)), `${element} 悬停时必须保留定位位移`);
}
console.log("map-hover-regression passed");
