"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const store = new Map();
const core = { createdAt: "echo-test", ended: false, turn: 4 };
const context = {
  console,
  localStorage: { getItem: key => store.get(key) || null, setItem: (key, value) => store.set(key, value) },
  document: { addEventListener(type, handler) { if (type === "DOMContentLoaded") handler(); }, getElementById() { return null; } },
  window: {
    XIAN_STRATEGY_DATA: { cities: [{ id: "luoyang", name: "洛阳" }] },
    XianEmperorGame: { getState: () => ({ ...core }), applyExternalPackage() {} },
    XianQuarterlyAgenda: { addContribution() {} },
    XianStrategyNetwork: { getState: () => ({ cities: { luoyang: { courtLoyalty: 55, pressure: 40 } } }), applyCampaignEffects() {} },
  },
};
vm.runInNewContext(fs.readFileSync(path.join(root, "src/regional-echoes.js"), "utf8"), context, { filename: "regional-echoes.js" });
const api = context.window.XianRegionalEchoes;
assert.equal(api.version, "2.12.0");
const battle = api.buildEchoFromBattle({ id: "b1", cityId: "luoyang", title: "洛阳之战", turn: 4, attackerLosses: 2400, defenderLosses: 1800 });
assert.equal(battle.kind, "battle_scars");
assert.ok(battle.severity >= 18 && battle.severity <= 80, "battle scars must be bounded");
const capture = api.buildEchoFromCapture({ id: "c1", cityId: "luoyang", turn: 5, newOwner: "court" });
assert.equal(capture.kind, "new_rule");
assert.equal(api.getResolutionOptions(capture).length, 2, "regional consequences should offer two readable responses");
assert.ok(api.getResolutionOptions(capture).every(item => item.city && item.core), "each response must affect both local and court state");
assert.equal(api.recordEcho(battle), true);
assert.equal(api.recordEcho(battle), false, "one battle may not create duplicate local stories");
console.log("regional echoes regression ok");
