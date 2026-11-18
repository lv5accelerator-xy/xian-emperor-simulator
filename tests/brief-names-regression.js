"use strict";
// A11Y-04：军议、联军两张摘要卡是整张按钮，按钮名称默认取全部文字，读屏会把示例圣旨与说明一并念出。
// 名称只取标题（aria-labelledby），其余作为描述（aria-describedby），被引用的 id 必须都在同一按钮里。
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const source = fs.readFileSync(path.join(__dirname, "..", "src/strategy-network.js"), "utf8");
for (const cls of ["lord-intent-brief", "alliance-brief"]) {
  const start = source.indexOf(`class="${cls}"`);
  assert.ok(start > 0, `${cls} 按钮仍在`);
  const button = source.slice(source.lastIndexOf("<button", start), source.indexOf("</button>", start));
  const labelled = button.match(/aria-labelledby="([^"]+)"/), described = button.match(/aria-describedby="([^"]+)"/);
  assert.ok(labelled && described, `${cls} 应分开名称与描述`);
  for (const id of [...labelled[1].split(" "), ...described[1].split(" ")]) assert.match(button, new RegExp(`id="${id}"`), `${cls} 引用的 ${id} 在按钮内`);
  assert.doesNotMatch(labelled[1], /note/, `${cls} 的名称不含说明文字`);
}
console.log("brief-names-regression passed");
