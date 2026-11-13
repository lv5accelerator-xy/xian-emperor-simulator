"use strict";
// 自带字体是按“游戏里实际出现的字”裁剪的。新增文案若用到子集之外的字，浏览器会逐字回退到系统字体，
// 一句话里混出两种字形，还可能因此多下载一份回退字体。发现缺字时重新运行 scripts/build-font-subsets.py
// （来源与用法见 assets/fonts/README.md），并更新字体的缓存参数。
const assert = require("node:assert/strict"), fs = require("node:fs"), path = require("node:path"), zlib = require("node:zlib");
const root = path.resolve(__dirname, "..");

// 读取 WOFF2 的 cmap：表目录 + 整体 Brotli 数据流；cmap 不做变换，可直接解析。
function codepoints(file) {
  const data = fs.readFileSync(file);
  assert.equal(data.toString("latin1", 0, 4), "wOF2", `${file} 不是 WOFF2`);
  const numTables = data.readUInt16BE(12), compressedLength = data.readUInt32BE(20);
  let offset = 48;
  const base128 = () => { let value = 0; for (let i = 0; i < 5; i++) { const byte = data[offset++]; value = value * 128 + (byte & 0x7f); if (!(byte & 0x80)) return value; } throw new Error("UIntBase128 过长"); };
  const tables = [];
  for (let i = 0; i < numTables; i++) {
    const flags = data[offset++], index = flags & 0x3f, version = flags >> 6;
    const tag = index === 63 ? data.toString("latin1", offset, (offset += 4)) : index;
    const length = base128();
    // glyf(10)、loca(11) 在版本 0 时经过变换；其余表在版本非 0 时经过变换。变换后的表另有长度字段。
    const transformed = index === 10 || index === 11 ? version === 0 : version !== 0;
    tables.push({ tag, length: transformed ? base128() : length });
  }
  const stream = zlib.brotliDecompressSync(data.subarray(offset, offset + compressedLength));
  let start = 0, cmap = null;
  for (const table of tables) { if (table.tag === 0) cmap = stream.subarray(start, start + table.length); start += table.length; }
  assert.ok(cmap, `${file} 缺少 cmap`);
  const found = new Set();
  for (let i = 0, count = cmap.readUInt16BE(2); i < count; i++) {
    const sub = cmap.readUInt32BE(8 + i * 8), format = cmap.readUInt16BE(sub);
    if (format === 12) {
      for (let g = 0, groups = cmap.readUInt32BE(sub + 12); g < groups; g++) {
        const at = sub + 16 + g * 12;
        for (let code = cmap.readUInt32BE(at), end = cmap.readUInt32BE(at + 4); code <= end; code++) found.add(code);
      }
    } else if (format === 4) {
      const segments = cmap.readUInt16BE(sub + 6) / 2, ends = sub + 14, starts = ends + segments * 2 + 2, deltas = starts + segments * 2, ranges = deltas + segments * 2;
      for (let s = 0; s < segments; s++) {
        const end = cmap.readUInt16BE(ends + s * 2), first = cmap.readUInt16BE(starts + s * 2), delta = cmap.readUInt16BE(deltas + s * 2), range = cmap.readUInt16BE(ranges + s * 2);
        for (let code = first; code <= end && code !== 0xffff; code++) {
          const glyph = range ? cmap.readUInt16BE(ranges + s * 2 + range + (code - first) * 2) : (code + delta) & 0xffff;
          if (glyph) found.add(code);
        }
      }
    }
  }
  return found;
}

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
