"use strict";
// 跨局累计记录的上限：同题／每周挑战的最佳成绩与自定义题目定义不能随游玩周数无限增长。
// 内置挑战的最佳成绩、最近成绩引用的题目与进行中的题目必须保留。
const assert = require("node:assert/strict");
const { harness, plain } = require("./helpers/game-harness");
const SHORT_KEY = "xian_emperor_short_challenges_v230";

const seedRun = harness({}, .91); seedRun.loadMechanics();
const builtIn = seedRun.window.XianShortChallenges.getChallenges()[0];
const oldResult = (id, day) => ({ challengeId: id, name: id, score: 10, medal: "none", rulesVersion: 1, completedAt: `2025-01-${String(day).padStart(2, "0")}T00:00:00.000Z`, review: { months: [] } });
const best = { [builtIn.id]: oldResult(builtIn.id, 1) };
const customDefinitions = {};
for (let i = 0; i < 100; i++) {
  const id = `weekly_old_${i}`;
  best[id] = oldResult(id, 1 + (i % 28));
  customDefinitions[id] = { ...builtIn, id, kind: "weekly", code: `OLD-${i}` };
}
for (let i = 0; i < 60; i++) customDefinitions[`unused_${i}`] = { ...builtIn, id: `unused_${i}`, kind: "weekly" };
const referenced = oldResult("weekly_old_99", 1);
const stores = { [SHORT_KEY]: JSON.stringify({ version: 1, active: null, results: [referenced], best, rewards: [], customDefinitions }) };

const run = harness(stores, .91); run.loadMechanics(); run.mount("save-backups"); run.flush();
run.window.XianShortChallenges.startCustom({ ...builtIn, randomSeed: 1818 });
run.advance(400); run.flush();
for (let i = 0; i < 10 && !run.api.getState().ended; i++) { run.decide(1); run.api.endTurn(); run.flush(); }
assert.ok(run.api.getState().ended, "the short game finishes");
const state = plain(run.window.XianShortChallenges.getState());
const customBest = Object.keys(state.best).filter(id => id !== builtIn.id);
assert.ok(customBest.length <= 40, `custom best records are capped (${customBest.length})`);
assert.ok(state.best[builtIn.id], "built-in best record is always kept");
assert.ok(state.customDefinitions.weekly_old_99, "a definition still referenced by a recent result is kept");
const unreferenced = Object.keys(state.customDefinitions).filter(id => !state.results.some(item => item.challengeId === id) && !state.best[id] && id !== state.active?.challengeId);
assert.ok(unreferenced.length <= 40, `unreferenced definitions are capped (${unreferenced.length})`);
assert.ok(Object.keys(state.customDefinitions).length < 160, "old definitions were pruned");
console.log(`save-capacity-regression passed: ${Object.keys(best).length - 1} → ${customBest.length} custom best records, 160 → ${Object.keys(state.customDefinitions).length} definitions`);
