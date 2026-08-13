"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

function loadModule(file, windowExtras = {}) {
  const values = new Map();
  const localStorage = {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };
  const document = {
    addEventListener() {},
    dispatchEvent() {},
    getElementById() { return null; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    body: { classList: { add() {}, remove() {}, toggle() {} } },
  };
  const window = {
    XianCommandCenter: { registerTab() {}, refresh() {}, escapeHtml: String },
    ...windowExtras,
  };
  const context = {
    window,
    document,
    localStorage,
    console,
    navigator: {},
    CustomEvent: class CustomEvent {},
    Event: class Event {},
    setTimeout,
    clearTimeout,
    Date,
    Blob: class Blob {},
    URL: { createObjectURL() { return "blob:test"; }, revokeObjectURL() {} },
  };
  vm.runInNewContext(read(file), context, { filename: file });
  return window;
}

const monthly = loadModule("src/monthly-flow.js").XianMonthlyFlow;
assert.equal(monthly.getMode(), "simple", "simple court should be the default mode");
assert.equal(monthly.getStepState({ eventResolved: false, actionPoints: 2 }).current, 1);
assert.equal(monthly.getStepState({ eventResolved: true, actionPoints: 2 }).current, 2);
assert.equal(monthly.getStepState({ eventResolved: true, actionPoints: 1 }).current, 3);
assert.deepEqual(Array.from(monthly.buildChoiceImpact({ effects: { prestige: 4, treasury: -3 }, hidden: { leakRisk: 2 } })), ["汉室威望+4", "国库-3", "泄密风险+2"]);

const characters = [{ id: "dong_cheng", name: "董承", relation: 55 }];
const echoes = loadModule("src/consequence-echoes.js", { GAME_DATA: { characters } }).XianConsequenceEchoes;
const [promiseStat, promiseTarget] = Array.from(echoes.selectPromiseStat({ security: 5, prestige: 2 }, { security: 50, prestige: 60 }));
assert.equal(promiseStat, "security");
assert.equal(promiseTarget, 45);
const kept = echoes.evaluatePromise({ characterId: "dong_cheng", relationTarget: 50, statKey: "security", statTarget: 40 }, { relations: { dong_cheng: 60 }, stats: { security: 45 } });
const broken = echoes.evaluatePromise({ characterId: "dong_cheng", relationTarget: 65, statKey: "security", statTarget: 50 }, { relations: { dong_cheng: 40 }, stats: { security: 35 } });
assert.equal(kept.success, true, "maintained relation and state should fulfil a promise");
assert.equal(broken.success, false, "missing promise conditions should break it");

const shortWindow = loadModule("src/short-challenges.js", { XianDynastySaga: { isActive: () => false } });
const short = shortWindow.XianShortChallenges;
const challenges = short.getChallenges();
assert.equal(challenges.length, 5, "five curated short challenges should exist");
assert.deepEqual(Array.from(challenges, item => item.duration), [6, 6, 6, 5, 4]);
const gold = short.evaluateChallenge(challenges[0], { stats: { authority: 40, treasury: 30, caoAlert: 60, prestige: 50 } });
const bronze = short.evaluateChallenge(challenges[0], { stats: { authority: 35, treasury: 10, caoAlert: 90, prestige: 50 } });
assert.equal(gold.medal, "gold");
assert.equal(bronze.medal, "bronze");

const weekly = loadModule("src/weekly-challenge.js").XianWeeklyChallenge;
const week = weekly.getIsoWeek(new Date("2026-08-13T12:00:00Z"));
const code = weekly.codeForWeek(week);
assert.equal(weekly.parseCode(code), week, "weekly share code should round-trip");
assert.equal(weekly.parseCode(`${code.slice(0, -1)}Z`), null, "tampered share code should fail validation");
const weeklyA = weekly.buildDefinition(code);
const weeklyB = weekly.buildDefinition(code);
assert.deepEqual(weeklyA, weeklyB, "same code should produce an identical challenge");
assert.equal(weeklyA.sequence.length, 6);

const gameData = {
  scenarios: [{ id: "jianan_196", name: "建安元年·许都" }],
  characters: [
    { id: "dong_cheng", name: "董承", relation: 50 },
    { id: "cao_cao", name: "曹操", relation: 50 },
    { id: "empress_fu", name: "伏皇后", relation: 50 },
    { id: "xun_yu", name: "荀彧", relation: 50 },
  ],
};
const verdictWindow = loadModule("src/final-verdict.js", {
  GAME_DATA: gameData,
  XianHistorian: { classifyRoute: () => ({ id: "people", name: "民生调停", text: "以民为先。" }), getState: () => ({ runs: [] }) },
  XianCharacterMemory: { getState: () => ({ memories: [{ gameCreatedAt: "game-1", characterId: "dong_cheng" }] }) },
  XianConsequenceEchoes: { getState: () => ({ records: [{ gameCreatedAt: "game-1", type: "promise", status: "fulfilled" }] }) },
});
const verdict = verdictWindow.XianFinalVerdict.buildVerdict({
  createdAt: "game-1",
  scenarioId: "jianan_196",
  ending: { title: "帝国调停者", text: "朝廷仍能调停天下。" },
  stats: { authority: 58, prestige: 72, security: 60, treasury: 55, officials: 62, caoAlert: 45 },
  hidden: { loyalNetwork: 45, leakRisk: 22, peopleStability: 68, externalBalance: 55, escapeRoute: 20 },
  relations: { dong_cheng: 80, cao_cao: 38, empress_fu: 72, xun_yu: 64 },
  chronicle: [{ date: "建安元年", text: "天子临朝。" }],
}, { scenario: gameData.scenarios[0], score: 620 });
assert.equal(verdict.posthumous, "仁", "strong prestige and public stability should produce the humane epithet");
assert.equal(verdict.virtues.length, 3);
assert.equal(verdict.characters.length, 4);
assert.equal(verdict.promiseSummary.fulfilled, 1);
assert.match(verdict.finalComment, /史臣曰/);

console.log("post-v2 systems regression ok");
