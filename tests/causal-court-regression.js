"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const source = fs.readFileSync(path.join(root, "src/causal-court.js"), "utf8");
const listeners = new Map();
const document = {
  addEventListener(name, handler) { listeners.set(name, handler); },
  getElementById() { return null; },
  querySelector() { return null; },
  body: { appendChild() {} },
};
const window = {
  GAME_DATA: {
    characters: [
      { id: "empress_fu", name: "伏皇后" },
      { id: "dong_cheng", name: "董承" },
      { id: "yang_biao", name: "杨彪" },
      { id: "xun_yu", name: "荀彧" },
      { id: "cao_cao", name: "曹操" },
    ],
  },
  setTimeout,
  clearTimeout,
};
vm.runInNewContext(source, { window, document, console, CustomEvent: class CustomEvent {}, Date, setTimeout, clearTimeout }, { filename: "causal-court.js" });

const api = window.XianCausalCourt;
assert.ok(api, "causal court API should load");

const core = {
  turn: 6,
  ended: false,
  stats: { authority: 48, prestige: 62, security: 52, treasury: 18, officials: 45, caoAlert: 68 },
  hidden: { peopleStability: 34, externalBalance: 35, leakRisk: 22 },
  relations: { empress_fu: 60, dong_cheng: 30, yang_biao: 55, xun_yu: 58, cao_cao: 36 },
  recentEventIds: [],
  causality: { metrics: { battles: 2, courtVictories: 1, courtDefeats: 1, lastBattleTurn: 5 } },
};
const systems = {
  army: {
    armies: {
      a: { owner: "court", status: "marching", supply: 22 },
      b: { owner: "court", status: "defending", supply: 28 },
    },
    sieges: { xudu: { status: "active" } },
  },
  strategy: {
    cities: { xudu: { controller: "court" }, luoyang: { controller: "court" } },
    routes: { a: { supply: 24, pressure: 76 }, b: { supply: 60, pressure: 30 } },
  },
  court: {
    factions: { cao: { support: 35, tension: 82 }, loyalists: { support: 50, tension: 48 } },
  },
};

const issues = Array.from(api.deriveIssues(core, systems));
assert.equal(issues.length, 3, "the dashboard should focus on exactly three current matters");
assert.equal(issues[0].id, "finance", "treasury and army supply crisis should become the top matter");
assert.ok(issues.some(item => item.id === "court" || item.id === "war"), "politics or war pressure should enter the focused matters");
assert.equal(api.selectEventId(core), "causal_grain_and_army", "the highest unresolved matter should direct the next memorial");

const monthly = api.buildMonthlyConsequences(core, systems);
assert.ok(monthly.effects.treasury < 0, "low army supply should create a treasury consequence");
assert.ok(monthly.effects.officials < 0, "high faction tension and low supply should reduce official support");
assert.equal(monthly.danger, true, "a high-pressure monthly settlement should be marked dangerous");

console.log("causal court regression ok");
