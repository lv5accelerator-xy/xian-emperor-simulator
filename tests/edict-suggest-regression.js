"use strict";
// 圣旨识别不出具体政务时的示范写法：只在会按“中央一般政令”办理时给出；每句示范本身都能被识别成具体政务、不被拦下；
// 优先用句中提到的城池与人物；能识别的圣旨与被整句否定的圣旨不给建议。只读，不改动局面。
const assert = require("node:assert/strict");
const { harness, plain } = require("./helpers/game-harness");
const h = harness(); h.loadMechanics(); h.api.startNewGame("standard", "jianan_196", { randomSeed: 20261125 }); h.flush();
const rules = h.window.XianEdictRules, before = plain(h.api.getState());
for (const text of ["让曹操去许都看看", "朕要天下太平", "给荀彧写封信", "洛阳如何了", "董承近来可好"]) {
  const suggestion = rules.suggest(text);
  assert.ok(suggestion && suggestion.examples.length >= 3, `${text}：应给出示范写法`);
  for (const example of suggestion.examples) {
    const parsed = rules.analyze(example);
    assert.ok(!parsed.blocked && parsed.effectiveText && !parsed.categories.includes("generic"), `${text} 的示范“${example}”本身应能被识别`);
  }
}
assert.ok(rules.suggest("让曹操去许都看看").examples.some(example => example.includes("许都")), "句中提到的城池用于造句");
assert.ok(rules.suggest("给荀彧写封信").examples.some(example => example.includes("荀彧")), "句中提到的人物用于造句");
for (const text of ["派兵增援许都", "赏赐荀彧黄金百两", "不要增兵宛城", ""]) assert.equal(rules.suggest(text), null, `${text || "空白"}：不应给建议`);
assert.deepEqual(plain(h.api.getState()), before, "suggestions are read-only");
console.log("edict-suggest-regression passed");
