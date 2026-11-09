"use strict";
const assert = require("node:assert/strict");
const { plain } = require("./helpers/game-harness");
const { parallelFixture } = require("./parallel-council-regression");
const { ready, resume, chain, month, CORE, ARMY, STRATEGY } = require("./lord-command-chain-regression");
const clocks = new Set(["updatedAt", "createdAt", "gameCreatedAt", "capturedAt", "exportedAt", "startedAt", "completedAt", "timestamp"]);
function normalize(value, key = "") {
  if (clocks.has(key) || /Timestamp$/.test(key)) return "<time>";
  if (Array.isArray(value)) {
    const list = value.map(v => normalize(v));
    return ["intents", "orders"].includes(key) ? list.sort((a, b) => a.id.localeCompare(b.id)) : list;
  }
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, normalize(v, k)]));
  return typeof value === "string" ? value.replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/g, "<game>").replace(/\b\d{13,}\b/g, "<clock>").replace(/<clock>-[a-z0-9]{5,}/g, "<clock>-<nonce>") : value;
}
function trace(mode, delay = 0, restore = false, reverse = false) {
  let h = parallelFixture(({ s, a }) => {
    if (reverse) { s.commandChain.intents.reverse(); a.armies = Object.fromEntries(Object.entries(a.armies).reverse()); }
  });
  const reload = () => { if (restore) h = resume(plain(h.api.captureFullSave())); };
  reload();
  const ids = chain(h).intents.slice().sort((a, b) => b.priority - a.priority).map(i => i.id);
  if (mode === "coordinate") for (const id of ids) assert.equal(h.window.XianStrategyNetwork.interveneLordIntent(id, "coordinate"), true);
  if (mode === "restrain") assert.equal(h.window.XianStrategyNetwork.interveneLordIntent(ids[0], "restrain"), true);
  h.advance(delay); reload();
  for (let n = 0; n < 4 && !h.api.getState().ended; n++) { month(h); h.advance(delay); reload(); }
  const a = h.window.XianArmySystem.getState();
  assert.equal(new Set(a.militaryFacts.map(f => f.id)).size, a.militaryFacts.length);
  assert.equal(new Set(a.commandResponses.map(r => r.id)).size, a.commandResponses.length);
  assert.equal(new Set(a.commandConflicts.map(r => r.id)).size, a.commandConflicts.length);
  if (mode !== "restrain") assert.ok(a.militaryFacts.some(f => f.routeId === "ye_ji" && f.opposingOrderId));
  return normalize(plain(h.api.captureFullSave()).stores);
}
for (const mode of ["autonomous", "coordinate", "restrain"]) {
  const expected = trace(mode);
  for (const delay of [50, 500]) assert.deepEqual(trace(mode, delay), expected, `${mode}: timing ${delay}`);
  assert.deepEqual(trace(mode, 0, true), expected, `${mode}: all stores restored after every step`);
  assert.deepEqual(trace(mode, 0, false, true), expected, `${mode}: reversed serialized council and army insertion order`);
}
// Two simultaneous requests for one physical army have one stable winner.
for (const reverse of [false, true]) {
  const h = parallelFixture(({ s }) => {
    const high = s.commandChain.intents[0], low = { ...high, id: high.id + ":lower", priority: 1, targetCityId: "jinyang", targetOwner: "liu_biao", routeIds: ["ye_jinyang"] };
    s.commandChain.intents = reverse ? [low, high] : [high, low];
  });
  month(h);
  const responses = h.window.XianArmySystem.getState().commandResponses;
  assert.equal(responses.find(r => r.intentId.endsWith(":lower")).status, "refused");
  assert.equal(responses.filter(r => r.status === "accepted" && r.armyId === "yuan_main").length, 1);
  assert.equal(h.api.getState().totalActions, 0, "autonomous dispatch cannot consume or grant player actions");
}
// Crash recovery uses the actual paid core produced by the public map action.
for (const paid of [false, true]) {
  const h = parallelFixture(), before = plain(h.api.captureFullSave());
  const preview = plain(h.window.XianArmySystem.previewMapOrder("yuan_main", "luoyang", "attack"));
  assert.equal(h.window.XianArmySystem.issueMapOrder("yuan_main", "luoyang", "attack").ok, true);
  const after = plain(h.api.captureFullSave()), response = after.stores[ARMY].commandResponses.find(r => r.request?.source === "map");
  const staged = paid ? after : before;
  staged.stores[ARMY] = before.stores[ARMY]; staged.stores[STRATEGY] = before.stores[STRATEGY];
  staged.stores[ARMY].pendingMapCommands = [{ id: response.intentId, receiptId: response.intentId, gameCreatedAt: before.stores[CORE].createdAt, turn: 1,
    armyId: "yuan_main", targetCityId: "luoyang", task: "attack", expectedOrderId: "none", preview }];
  let restored = resume(staged);
  assert.equal(restored.api.getState().actionPoints, paid ? 1 : 2);
  assert.equal(restored.window.XianArmySystem.getState().orders.length, paid ? 1 : 0);
  assert.equal(restored.window.XianArmySystem.getState().pendingMapCommands.length, 0);
  const orderId = restored.window.XianArmySystem.getState().armies.yuan_main.currentOrderId;
  restored = resume(plain(restored.api.captureFullSave())); restored.api.commit("duplicate-map-recovery");
  assert.equal(restored.window.XianArmySystem.getState().orders.length, paid ? 1 : 0);
  if (paid) {
    assert.equal(restored.window.XianArmySystem.getState().armies.yuan_main.currentOrderId, orderId);
    month(restored);
    assert.equal(restored.window.XianArmySystem.getState().commandResponses.find(r => r.intentId.endsWith("yuan_shao")).status, "refused", "paid map action precedes competing autonomous plans");
  }
}
// The third council does not create a third monthly player action.
const three = ready(); three.decide(0);
for (const i of chain(three).intents.slice(0, 2)) assert.equal(three.window.XianStrategyNetwork.interveneLordIntent(i.id, "coordinate"), true);
assert.equal(three.api.getState().actionPoints, 0);
assert.equal(three.window.XianStrategyNetwork.interveneLordIntent(chain(three).intents[2].id, "coordinate"), false);
assert.equal(three.api.getState().totalActions, 2);
console.log("Parallel council persistence passed: 15 complete-store traces, timing/restore/permutations, same-army priority, real paid/unpaid map interruption, action budget.");
module.exports = { normalize };
