"use strict";
// 存档与各扩展存储里的字段可被导入文件改写；拼进 class 属性前必须转义，否则引号可闭合属性并注入标签。
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const { harness } = require("./helpers/game-harness");
const src = path.resolve(__dirname, "../src");
const dynamicClass = /class="[^"]*\$\{([^}]*)\}[^"]*"/g;
const persistedField = /\.(type|tone|kind|status|level|severity|category|outcome|area)\b(?!\s*(===|!==))/;
const offenders = [];
for (const file of fs.readdirSync(src).filter(name => name.endsWith(".js")).sort()) {
  fs.readFileSync(path.join(src, file), "utf8").split("\n").forEach((line, index) => {
    for (const match of line.matchAll(dynamicClass)) {
      // 三元表达式只检查实际输出的分支；条件里读取字段不会进入 HTML。
      const emitted = match[1].split(" : ").map(part => part.includes(" ? ") ? part.slice(part.indexOf(" ? ") + 3) : part);
      if (emitted.some(part => persistedField.test(part) && !/^\s*(escapeHtml|escape|esc)\(/.test(part))) offenders.push(`${file}:${index + 1} ${match[1].trim()}`);
    }
  });
}
assert.deepEqual(offenders, [], "class 属性中的存档字段必须先转义");

// 行为验证：恶意 report.type 不得原样进入奏报列表的 HTML。
const h = harness(); h.api.startNewGame();
const key = "xian_emperor_simulator_v01", payload = 'x"><img src=x onerror="window.__pwned=1">';
const stores = h.stores(), save = JSON.parse(stores[key]);
save.reports.unshift({ title: "t", text: "x", date: "d", timestamp: Date.now(), turn: save.turn, gameCreatedAt: save.createdAt, type: payload });
stores[key] = JSON.stringify(save);
const resumed = harness(stores); resumed.node("continue-game-btn").click();
const html = resumed.node("report-list").innerHTML;
assert.ok(html.includes("report-item"), "奏报列表应已渲染");
assert.ok(!html.includes("<img"), "report.type 不得注入标签");
assert.ok(html.includes("&quot;&gt;&lt;img"), "report.type 应以转义形式出现");
console.log("class-injection-regression passed");
