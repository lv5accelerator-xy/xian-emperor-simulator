"use strict";
// 自带字体是按“游戏里实际出现的字”裁剪的。新增文案若用到子集之外的字，浏览器会逐字回退到系统字体，
// 一句话里混出两种字形，还可能因此多下载一份回退字体。发现缺字时重新运行 scripts/build-font-subsets.py
// （来源与用法见 assets/fonts/README.md），并更新字体的缓存参数。
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const { codepoints } = require("./helpers/woff2-cmap");
const root = path.resolve(__dirname, "..");

// 只统计会显示出来的文字：去掉脚本与样式里的注释。字符串里含“//”的行会被多删一些，只会漏检，不会误报。
function displayedCharacters() {
  const files = ["index.html", "styles.css", ...fs.readdirSync(path.join(root, "src"), { recursive: true }).filter(name => /\.(js|css)$/.test(name)).map(name => path.join("src", name))];
  const characters = new Map();
  for (const file of files) {
    let text = fs.readFileSync(path.join(root, file), "utf8");
    text = file.endsWith(".html") ? text.replace(/<!--[\s\S]*?-->/g, "")
      : text.replace(/\/\*[\s\S]*?\*\//g, "").split("\n").map(line => line.replace(/(^|[^:"'`])\/\/.*$/, "$1")).join("\n");
    for (const character of text) if (!characters.has(character)) characters.set(character, file);
  }
  return characters;
}

const cjk = code => (code >= 0x2e80 && code <= 0x303f) || (code >= 0x3400 && code <= 0x4dbf) || (code >= 0x4e00 && code <= 0x9fff) || (code >= 0xf900 && code <= 0xfaff) || (code >= 0xff01 && code <= 0xff60);
const displayed = displayedCharacters();
// 题名字体（站酷小薇）原字体本身缺少个别生僻字，按字体栈回退到文楷，不在此列。
for (const font of ["wenkai-game-regular", "wenkai-game-medium", "noto-sans-sc-game", "noto-serif-sc-game"]) {
  const available = codepoints(path.join(root, "assets/fonts", `${font}.woff2`));
  const missing = [...displayed].filter(([character]) => cjk(character.codePointAt(0)) && !available.has(character.codePointAt(0)));
  assert.deepEqual(missing.map(([character, file]) => `${character}（${file}）`), [], `${font} 缺少界面用字，请重建字体子集`);
  assert.ok(available.has(0x20) && available.has(0x3000), `${font} 应包含半角与全角空格`);
}
console.log(`font-coverage-regression passed: ${[...displayed.keys()].filter(character => cjk(character.codePointAt(0))).length} 个界面汉字与标点均有字形`);
