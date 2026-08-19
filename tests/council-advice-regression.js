"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const store = new Map();
const core = { createdAt: "council-test", ended: false, turn: 2, relations: { yang_biao: 72, xun_yu: 58, cao_cao: 44 } };
const agenda = { cycle: 1, active: { id: "restore_treasury" } };
let bonus = 0;
const context = {
  console,
  localStorage: { getItem: key => store.get(key) || null, setItem: (key, value) => store.set(key, value) },
  document: { addEventListener(type, handler) { if (type === "DOMContentLoaded") handler(); }, getElementById() { return null; } },
  window: {
    XianEmperorGame: { getState: () => JSON.parse(JSON.stringify(core)), applyExternalPackage() { return { applied: true }; } },
    XianQuarterlyAgenda: { getState: () => JSON.parse(JSON.stringify(agenda)), addContribution(points) { bonus += points; } },
    XianCharacterMemory: { getState: () => ({ memories: [{ characterId: "yang_biao", gameCreatedAt: "council-test" }] }) },
  },
};
vm.runInNewContext(fs.readFileSync(path.join(root, "src/council-advice.js"), "utf8"), context, { filename: "council-advice.js" });
const api = context.window.XianCouncilAdvice;
assert.equal(api.version, "2.11.0");
const advice = api.buildAdvice(core, "restore_treasury");
assert.equal(advice.length, 3, "each agenda should present exactly three conflicting advisers");
assert.equal(advice[0].name, "杨彪");
assert.equal(advice[0].remembered, 1, "advice should acknowledge character memory");
assert.equal(api.chooseAdvice("yang_biao"), true);
assert.equal(api.chooseAdvice("xun_yu"), false, "only one plan may be adopted each quarter");
assert.equal(bonus, 18, "adopting advice should advance the existing quarterly goal, not create a currency");
console.log("council advice regression ok");
