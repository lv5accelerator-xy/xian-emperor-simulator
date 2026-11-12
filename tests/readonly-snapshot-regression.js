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
