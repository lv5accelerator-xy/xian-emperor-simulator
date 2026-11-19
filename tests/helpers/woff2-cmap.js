"use strict";
// 读取 WOFF2 字体的 cmap（字体包含哪些码位），供字体相关回归共用；不依赖第三方库。
const assert = require("node:assert/strict"), fs = require("node:fs"), zlib = require("node:zlib");

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

module.exports = { codepoints };
