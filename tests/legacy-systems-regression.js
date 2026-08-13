"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

class StorageMock {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}

const localStorage = new StorageMock();
localStorage.setItem("xian_emperor_simulator_v01", JSON.stringify({
  createdAt: "regression-game",
  scenarioId: "jianan_196",
  turn: 6,
  maxTurns: 24,
  eventResolved: true,
  actionPoints: 2,
  stats: { authority: 45, prestige: 60, security: 50, treasury: 40, officials: 52, caoAlert: 76 },
  hidden: { loyalNetwork: 30, leakRisk: 18, peopleStability: 48, externalBalance: 22 },
  relations: {}, chronicle: [], reports: [],
}));

const context = {
  console,
  setTimeout,
  clearTimeout,
  Blob,
  URL: { createObjectURL() { return "blob:test"; }, revokeObjectURL() {} },
  Event: function Event() {},
  CustomEvent: function CustomEvent() {},
  Storage: StorageMock,
  localStorage,
  document: { addEventListener() {}, getElementById() { return null; }, querySelector() { return null; }, body: { classList: { add() {}, remove() {} }, appendChild() {} } },
  window: { addEventListener() {}, GAME_DATA: null },
};

for (const file of ["src/data.js", "src/command-center.js", "src/character-memory.js", "src/world-marks.js", "src/historian.js", "src/dynasty-saga.js"]) {
  vm.runInNewContext(read(file), context, { filename: file });
}

const command = context.window.XianCommandCenter;
assert.ok(command, "command center API should load");
assert.equal(command.recommendAction(JSON.parse(localStorage.getItem("xian_emperor_simulator_v01"))).actionId, "appease", "high Cao alert should recommend appeasement");
assert.equal(command.recommendAction({ eventResolved: true, stats: { caoAlert: 35, treasury: 20 }, hidden: {} }).actionId, "revenue", "low treasury should recommend fundraising");
assert.equal(command.collectWarnings({ stats: { caoAlert: 80, security: 25, treasury: 20 }, hidden: {} }).length, 3, "brief should remain limited to three warnings");

const memory = context.window.XianCharacterMemory;
assert.ok(memory, "character memory API should load");
assert.ok(memory.buildAdvicePackage("cao_cao", true).effects.caoAlert < 0, "favorable Cao consultation should lower alert");
assert.ok(memory.buildAdvicePackage("liu_biao", true).hidden.externalBalance > 0, "regional consultation should improve balance");

const marks = context.window.XianWorldMarks;
assert.equal(marks.inferAction("州郡减赋", "开仓赈济"), "relief");
assert.equal(marks.inferAction("派遣密使", "联络外镇"), "regional");
assert.match(marks.describePackage(marks.templates.relief.monthly), /民间稳定\+2/);

const historian = context.window.XianHistorian;
const route = historian.classifyRoute({ stats: { authority: 70, prestige: 75, officials: 78, security: 50, treasury: 40, caoAlert: 35 }, hidden: { externalBalance: 20, loyalNetwork: 20, leakRisk: 20, peopleStability: 40 } });
assert.equal(route.id, "ritual", "strong legitimacy state should classify as ritual governance");
const points = historian.selectTurningPoints({ maxTurns: 24, chronicle: [{ date: "一月", text: "开局" }, { date: "六月", text: "中局" }, { date: "十二月", text: "终局" }] }, []);
assert.ok(points.length >= 3, "historian should create a readable fallback timeline");

const saga = context.window.XianDynastySaga;
assert.deepEqual(Array.from(saga.chapters), ["zhongping_189", "xingping_195", "jianan_196", "jianan_200", "yankang_220"]);
const inherited = saga.combineLegacies([{ id: "ritual" }, { id: "ritual" }, { id: "ritual" }, { id: "ritual" }]);
assert.equal(inherited.effects.prestige, 8, "legacy inheritance must be capped to prevent snowballing");
assert.equal(saga.isFailureEnding("深宫幽闭"), true);
assert.equal(saga.isFailureEnding("再振汉纲"), false);

console.log("legacy systems regression ok");
