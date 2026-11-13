"use strict";
// 损坏或被改写的核心存档：必须在读取时被拒绝并保持原局面，不能把界面留在半载入状态；
// 字段缺失的旧档仍应照常读取。
const assert = require("node:assert/strict");
const { harness } = require("./helpers/game-harness");
const KEY = "xian_emperor_simulator_v01";

function saved() {
  const h = harness(); h.api.startNewGame("standard", "jianan_196", { randomSeed: 5 }); h.decide(0);
  return h.stores();
}
function reopen(stores, mutate) {
  const core = JSON.parse(stores[KEY]); mutate(core);
  const h = harness({ ...stores, [KEY]: JSON.stringify(core) });
  h.node("continue-game-btn").click();
  return h;
}
const base = saved();

// 合法存档与缺字段的旧档照常读取。
assert.equal(reopen(base, () => {}).api.getState()?.turn, 1);
for (const [label, mutate] of [
  ["缺少 reports", core => { delete core.reports; }],
  ["缺少 relations", core => { delete core.relations; }],
  ["relations 为 null", core => { core.relations = null; }],
  ["缺少 turn 之外的新字段", core => { delete core.causality; delete core.random; delete core.appliedReceipts; }],
  ["stats 缺键", core => { delete core.stats.prestige; }],
  ["奏报类型为任意字符串", core => { core.reports.unshift({ title: "t", text: "x", date: "d", type: 'x"><img src=x>' }); }],
]) {
  const h = reopen(base, mutate);
  assert.ok(h.api.getState(), `${label}：仍应读取`);
}

// 必然无法运行的形状被拒绝，局面保持为未载入。
for (const [label, mutate] of [
  ["stats 为数组", core => { core.stats = []; }],
  ["hidden 为字符串", core => { core.hidden = "x"; }],
  ["chronicle 含 null", core => { core.chronicle.push(null); }],
  ["chronicle 非数组", core => { core.chronicle = {}; }],
  ["reports 含 null", core => { core.reports.push(null); }],
  ["reports 为 null", core => { core.reports = null; }],
  ["reports 含字符串", core => { core.reports.push("x"); }],
  ["relations 为数组", core => { core.relations = []; }],
  ["turn 非数值", core => { core.turn = "abc"; }],
]) {
  const h = reopen(base, mutate);
  assert.equal(h.api.getState(), null, `${label}：应拒绝并保持未载入`);
  assert.equal(h.api.restoreFullSave({ format: "xian-emperor-full-save", stores: { [KEY]: (() => { const core = JSON.parse(base[KEY]); mutate(core); return core; })() } }), false, `${label}：完整存档导入同样拒绝`);
}

// 已在局中时读取损坏存档：退回原局面。
{
  const h = harness(); h.api.startNewGame("standard", "jianan_196", { randomSeed: 6 }); h.decide(0);
  const before = h.api.getState();
  const broken = JSON.parse(h.localStorage.getItem(KEY)); broken.reports = [null];
  h.localStorage.setItem(KEY, JSON.stringify(broken));
  h.node("load-btn").click();
  assert.deepEqual(h.api.getState().stats, before.stats, "读取失败后仍是原局面");
  assert.equal(h.api.getState().createdAt, before.createdAt);
}
console.log("save-validation-regression passed");
