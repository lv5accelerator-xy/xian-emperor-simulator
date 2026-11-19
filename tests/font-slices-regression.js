"use strict";
// 字体切片：每种字体分“常用片”与“其余片”，由 src/font-faces.css 按 unicode-range 声明（scripts/split-font-slices.py 生成）。
// 检查：样式表引用的切片都存在；声明的码位都在该切片里有字形；两片合起来正好等于完整子集；
// 界面上用到、完整子集里有的汉字都落在某一片的声明范围内；常用字表里的字都在常用片里。
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path");
const { codepoints } = require("./helpers/woff2-cmap");
const root = path.resolve(__dirname, "..");
const css = fs.readFileSync(path.join(root, "src/font-faces.css"), "utf8");

function parseRange(text) {
  const codes = new Set();
  for (const part of text.split(",").map(item => item.trim().replace(/^U\+/i, ""))) {
    const [a, b = a] = part.split("-").map(value => parseInt(value, 16));
    for (let code = a; code <= b; code++) codes.add(code);
  }
  return codes;
}
const faces = [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)].map(([, body]) => ({
  family: body.match(/font-family:\s*"([^"]+)"/)[1], weight: body.match(/font-weight:\s*([^;]+);/)[1].trim(),
  file: body.match(/url\("\.\.\/assets\/fonts\/([^"?]+)\?v=[\w.-]+"\)/)[1], range: parseRange(body.match(/unicode-range:\s*([^;]+);/)[1]),
}));
assert.equal(faces.length, 10, "five fonts × two slices");
for (const visual of ["src/visual-refresh.css", "src/typography.css", "styles.css"]) assert.doesNotMatch(fs.readFileSync(path.join(root, visual), "utf8"), /@font-face/, `${visual} 不应再声明完整字体`);

const core = new Set([...fs.readFileSync(path.join(root, "assets/fonts/core-chars.txt"), "utf8").trim()].map(character => character.codePointAt(0)));
const stems = [...new Set(faces.map(face => face.file.replace(/-(core|rest)\.woff2$/, "")))];
for (const stem of stems) {
  const pair = faces.filter(face => face.file.startsWith(`${stem}-`));
  assert.deepEqual(pair.map(face => face.file).sort(), [`${stem}-core.woff2`, `${stem}-rest.woff2`]);
  const full = codepoints(path.join(root, "assets/fonts", `${stem}.woff2`));
  const declared = new Set();
  for (const face of pair) {
    const available = codepoints(path.join(root, "assets/fonts", face.file));
    const missing = [...face.range].filter(code => !available.has(code));
    assert.deepEqual(missing, [], `${face.file} 声明了没有字形的码位`);
    for (const code of face.range) { assert.ok(!declared.has(code), `${stem} 两片的声明范围不应重叠（U+${code.toString(16)}）`); declared.add(code); }
  }
  // 文楷只声明汉字与中文标点；其余字体声明全部码位。两片合起来不多不少。
  const wenkaiRange = code => [[0x2e80, 0x2fff], [0x3000, 0x303f], [0x3400, 0x4dbf], [0x4e00, 0x9fff], [0xf900, 0xfaff], [0xff01, 0xff60], [0x20000, 0x2fa1f]].some(([a, b]) => code >= a && code <= b);
  const expected = pair[0].family === "Xian WenKai" ? new Set([...full].filter(wenkaiRange)) : full;
  assert.deepEqual([...declared].sort((a, b) => a - b), [...expected].sort((a, b) => a - b), `${stem} 两片合起来应等于完整子集`);
  const coreFace = pair.find(face => face.file.endsWith("-core.woff2"));
  const absent = [...core].filter(code => full.has(code) && !coreFace.range.has(code));
  assert.deepEqual(absent.map(code => String.fromCodePoint(code)), [], `${stem} 常用片应包含全部常用字`);
}
// 预加载的是题名字体的常用片，地址与样式表一致。
const preload = fs.readFileSync(path.join(root, "index.html"), "utf8").match(/assets\/fonts\/zcool-xiaowei-game-core\.woff2\?v=[\w.-]+/)?.[0];
assert.ok(preload && css.includes(preload.replace("assets/fonts/", "../assets/fonts/")), "preload targets the display font's core slice with the same URL as font-faces.css");
console.log(`font-slices-regression passed: ${stems.length} fonts, ${core.size} core characters`);
