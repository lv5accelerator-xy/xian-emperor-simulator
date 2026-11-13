"use strict";
// 界面上的月末结算分帧执行：先显示“结算中”，再逐段推进。它必须与同步的 endTurn 得到相同结果，
// 结算期间不得重入，页面隐藏或关闭时要同步跑完，不能把月份留在半途。
const assert = require("node:assert/strict");
const { harness, plain } = require("./helpers/game-harness");
const SEED = 20261017;
const strip = value => JSON.parse(JSON.stringify(value, (key, item) => key === "updatedAt" || key === "createdAt" || key === "gameCreatedAt" || key === "timestamp" || key === "capturedAt" ? undefined : item)
  .replace(/\d{4}-\d\d-\d\dT[\d:.]+Z/g, "<time>").replace(/\d{9,}/g, "0"));

function start() {
  const h = harness(); h.loadMechanics();
  h.api.startNewGame("standard", "jianan_196", { randomSeed: SEED });
  h.decide(0);
  return h;
}
function confirmEndTurn(h) { h.node("end-turn-btn").click(); h.node("modal-confirm").click(); }

// 基准：公开接口同步结算一个月。
const sync = start(); sync.api.endTurn();
assert.equal(sync.api.getState().turn, 2);
const expected = strip(sync.api.getState());

// 夹具的动画帧默认同步执行：界面入口应当一次走完，结果与同步结算一致。
const immediate = start(); confirmEndTurn(immediate);
assert.deepEqual(strip(immediate.api.getState()), expected, "界面确认与同步结算结果一致");

// 把动画帧改为排队，逐帧推进。
function framed() {
  const h = start(), frames = [];
  h.window.requestAnimationFrame = callback => { frames.push(callback); return frames.length; };
  // 时间预算设为负数，强制在每个安全点让出。
  h.window.__xianSettlementSliceMs = -1;
  const pump = () => { const callback = frames.shift(); if (callback) callback(); return Boolean(callback); };
  return { h, frames, pump };
}

{
  const { h, frames, pump } = framed();
  confirmEndTurn(h);
  assert.equal(h.api.getState().turn, 1, "确认后先显示提示，尚未结算");
  assert.ok(frames.length >= 1, "已排入下一帧");
  // 结算期间：再次请求或直接调用同步接口都不得重入。
  h.api.endTurn(); h.api.requestEndTurn();
  assert.equal(h.api.getState().turn, 1, "结算进行中不重入");
  let pumped = 0; while (pump()) { pumped++; assert.ok(pumped < 50, "逐帧推进应当收敛"); }
  assert.ok(pumped >= 4, `应分成多帧执行，实际 ${pumped} 帧`);
  assert.deepEqual(strip(h.api.getState()), expected, "逐帧结算与同步结算结果一致");
  assert.equal(h.api.getState().pendingSettlement, undefined, "结算完成后不留待结算标记");
}

// 中途页面隐藏：同步跑完剩余阶段。
for (const stopAfter of [1, 2, 3, 4]) {
  const { h, frames, pump } = framed();
  const listeners = [];
  const originalAdd = h.window.addEventListener;
  h.window.addEventListener = (type, callback, ...rest) => { if (type === "pagehide") listeners.push(callback); return originalAdd?.call(h.window, type, callback, ...rest); };
  confirmEndTurn(h);
  for (let i = 0; i < stopAfter; i++) pump();
  assert.ok(listeners.length >= 1, "已登记页面隐藏时的收尾");
  listeners.forEach(callback => callback({ type: "pagehide" }));
  assert.deepEqual(strip(h.api.getState()), expected, `第 ${stopAfter} 帧后页面隐藏，仍完整结算且结果一致`);
  while (pump()) { /* 已排队的帧回调此后应为空操作 */ }
  assert.deepEqual(strip(h.api.getState()), expected, "收尾后残留的帧回调不重复结算");
}
console.log("settlement-frames-regression passed");
