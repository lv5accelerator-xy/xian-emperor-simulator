"use strict";
const assert = require("node:assert/strict");
const { plain } = require("./helpers/game-harness");
const { prepare } = require("./diplomatic-ending-regression");
const { resume, ARMY, STRATEGY } = require("./lord-command-chain-regression");
const clocks = new Set(["updatedAt","createdAt","gameCreatedAt","capturedAt","exportedAt","startedAt","completedAt","timestamp"]);
function normalized(value, key = "") {
  if (clocks.has(key) || /Timestamp$/.test(key)) return "<time>";
  if (Array.isArray(value)) { const list = value.map(v => normalized(v)); return ["intents", "orders"].includes(key) ? list.sort((a,b) => a.id.localeCompare(b.id)) : list; }
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([k,v]) => [k,normalized(v,k)]));
  return typeof value === "string" ? value.replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/g,"<game>").replace(/\b\d{13,}\b/g,"<clock>").replace(/<clock>-[a-z0-9]{5,}/g,"<clock>-<nonce>") : value;
}
function trace(mode, delay = 0, restore = false, reverse = false) {
  let h = prepare(mode);
  const restoreAll = () => { const bundle = plain(h.api.captureFullSave());
    if (reverse) { bundle.stores[STRATEGY].commandChain.intents.reverse(); bundle.stores[ARMY].orders.reverse();
      bundle.stores[ARMY].armies = Object.fromEntries(Object.entries(bundle.stores[ARMY].armies).reverse()); }
    h = resume(bundle);
  };
  if (restore || reverse) restoreAll();
  h.load("final-verdict"); h.advance(delay);
  const stateBefore = h.stores(); h.window.XianDiplomaticEndings.preview(h.api.getState()); assert.deepEqual(h.stores(), stateBefore);
  h.api.endTurn(); h.advance(delay);
  const records = () => normalized(Object.fromEntries(Object.entries(h.stores()).map(([k,v]) => { try { return [k, JSON.parse(v)]; } catch { return [k,v]; } })));
  const expected = records();
  for (let n = 0; n < 3; n++) { h.api.commit("repeat-frozen-ending"); h.advance(delay); assert.deepEqual(records(), expected, `${mode}: frozen full-store commit`); }
  if (restore) { restoreAll(); h.load("final-verdict"); h.advance(delay); assert.deepEqual(records(), expected, `${mode}: final full save restore`); }
  const core = h.api.getState(), verdict = h.window.XianFinalVerdict.getState().verdicts[0];
  assert.deepEqual(plain(verdict.diplomaticOutcome), plain(core.diplomaticOutcome));
  assert.match(h.node("ending-stats").innerHTML, /data-diplomatic-outcome="frozen"/);
  return expected;
}
for (const mode of ["none", "cooperate", "peace", "betray"]) {
  const baseline = trace(mode);
  for (const delay of [50,500]) assert.deepEqual(trace(mode,delay), baseline, `${mode}: ${delay}ms`);
  assert.deepEqual(trace(mode,0,true), baseline, `${mode}: complete restore`);
  assert.deepEqual(trace(mode,0,false,true), baseline, `${mode}: insertion order`);
}
console.log("Diplomatic ending persistence passed: 20 full-store traces, 0/50/500ms, before/after restore, permutations, frozen verdict and repeated commits.");
module.exports = { normalized, trace };
