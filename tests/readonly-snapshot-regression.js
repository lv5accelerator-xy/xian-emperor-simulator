"use strict";
// 只读快照必须与 getState 内容一致、随状态更新、且不可被调用方改写；公开的 getState 仍返回独立副本。
const assert = require("node:assert/strict");
const { harness, plain } = require("./helpers/game-harness");
const run = harness(); run.loadMechanics();
run.api.startNewGame("standard", "jianan_196", { randomSeed: 20261017 });
for (const name of ["XianArmySystem", "XianStrategyNetwork"]) {
  const system = run.window[name];
  assert.equal(typeof system.peekState, "function", `${name} 应提供 peekState`);
  const peek = system.peekState();
  assert.deepEqual(plain(peek), plain(system.getState()), `${name} 快照与 getState 一致`);
  assert.equal(system.peekState(), peek, `${name} 状态未变时复用同一快照`);
  assert.ok(Object.isFrozen(peek) && Object.values(peek).filter(v => v && typeof v === "object").every(Object.isFrozen), `${name} 快照应深度冻结`);
  const copy = system.getState(); copy.__scratch = 1;
  assert.equal(system.getState().__scratch, undefined, `${name} getState 仍返回独立副本`);
  assert.equal(system.peekState().__scratch, undefined);
}
const before = run.window.XianStrategyNetwork.peekState(), armyBefore = run.window.XianArmySystem.peekState();
run.decide(0); run.advance();
assert.deepEqual(plain(run.window.XianStrategyNetwork.peekState()), plain(run.window.XianStrategyNetwork.getState()), "状态推进后快照跟随状态");
assert.deepEqual(plain(run.window.XianArmySystem.peekState()), plain(run.window.XianArmySystem.getState()));
assert.ok(run.window.XianStrategyNetwork.peekState() !== before || run.window.XianArmySystem.peekState() !== armyBefore, "状态变化后应生成新快照");

// 人物查找不再复制整张人物表，但结果必须与全表一致，且每次返回独立对象。
const cast = run.window.XianCharacterAvailability, core = run.api.getState();
for (const person of cast.allCharacters()) {
  assert.deepEqual(plain(cast.getCharacter(person.id)), plain(person));
  assert.notEqual(cast.getCharacter(person.id), cast.getCharacter(person.id));
  assert.equal(typeof cast.isAvailable(person.id, core), "boolean");
}
assert.equal(cast.getCharacter("no_such_person"), null);
assert.equal(cast.isAvailable("no_such_person", core), false);
console.log("readonly-snapshot-regression passed");

// 备份索引的解析缓存以存储原文为键：外部改写后必须读到新内容，损坏时仍按原路径报错。
{
  const KEY = "xian_emperor_save_backups_v2180", h = harness(); h.loadMechanics(); h.load("save-backups");
  h.api.startNewGame("standard", "jianan_196", { randomSeed: 7 });
  const backups = h.window.XianSaveBackups;
  assert.equal(backups.captureBeforeReplacement("甲"), true);
  assert.equal(backups.captureBeforeReplacement("乙"), true, "缓存命中后仍能正常留档");
  assert.equal(JSON.parse(h.localStorage.getItem(KEY)).replacement.label, "乙");
  const emptied = JSON.parse(h.localStorage.getItem(KEY)); emptied.months = []; emptied.replacement = null;
  h.localStorage.setItem(KEY, JSON.stringify(emptied));
  assert.equal(backups.captureBeforeReplacement("丙"), true);
  const after = JSON.parse(h.localStorage.getItem(KEY));
  assert.equal(after.replacement.label, "丙"); assert.equal(after.months.length, 0, "外部清空后不得用旧缓存复活月度备份");
  const entries = backups.getEntries(); entries[0].bundle.stores = null;
  assert.ok(backups.getEntries()[0].bundle.stores, "列表返回独立副本");
  h.localStorage.setItem(KEY, "{broken");
  assert.equal(backups.captureBeforeReplacement("丁"), false, "索引损坏时仍报告失败");
}
console.log("backup-index-cache checks passed");

// 核心状态的只读快照：内容与 getState 一致、冻结、随状态更新；getState 仍是独立可变副本。
{
  const h = harness(); h.api.startNewGame("standard", "jianan_196", { randomSeed: 11 });
  const peek = h.api.peekState();
  assert.deepEqual(plain(peek), plain(h.api.getState()));
  assert.equal(h.api.peekState(), peek, "状态未变时复用同一快照");
  assert.ok(Object.isFrozen(peek) && Object.isFrozen(peek.stats) && Object.isFrozen(peek.reports));
  assert.throws(() => { "use strict"; peek.stats.treasury = 999; }, TypeError, "误写快照应立即报错");
  const copy = h.api.getState(); copy.stats.treasury = -1;
  assert.notEqual(h.api.getState().stats.treasury, -1, "getState 的副本与核心状态互不影响");
  h.decide(0);
  assert.notEqual(h.api.peekState(), peek, "裁决后生成新快照");
  assert.deepEqual(plain(h.api.peekState()), plain(h.api.getState()));
}
console.log("core-peek checks passed");
