"use strict";
const assert = require("node:assert/strict");
const { harness, plain } = require("./helpers/game-harness");
const cosmetic = new Set(["updatedAt", "createdAt", "gameCreatedAt", "capturedAt", "exportedAt", "startedAt", "completedAt", "timestamp", "lastReportTimestamp", "v041LastCorrectedTimestamp", "lastCoreReportTimestamp"]);
function normalize(value, key = "") {
  if (cosmetic.has(key) || /Timestamp$/.test(key)) return "<time>";
  if (Array.isArray(value)) return value.map(item => normalize(item));
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).map(([name, item]) => [name, normalize(item, name)]));
  if (typeof value === "string") return value.replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z/g, "<game>").replace(/\b\d{13,}\b/g, "<clock>").replace(/<clock>-[a-z0-9]{5,}/g, "<clock>-<nonce>");
  return value;
}
function play(mode, interval = 0, restore = false) {
  let h = harness(); h.loadEngine(); h.api.startNewGame("standard", "jianan_196", { randomSeed: 224003 });
  let core = h.api.getState();
  h.replaceCore({ stats: { ...core.stats, authority: 75, prestige: 70, treasury: 40 }, relations: { ...core.relations, yuan_shao: 90 } });
  h.window.XianStrategyNetwork.applyCampaignEffects({ strategies: { yuan_shao: { trust: 60 } } });
  const pauses = [0, 47, 210, 81, 501, 3]; let step = 0;
  const pause = () => h.advance(interval === "random" ? pauses[(step++) % pauses.length] : interval);
  const text = { tribute: "请袁绍在邺城进贡国库6", partial: "请袁绍在邺城进贡国库30", aid: "请袁绍派援军驰援许都", peace: "令袁绍与曹操停战", breach: "令袁绍与曹操停战" }[mode];
  for (let month = 1; month <= 4; month++) {
    if (!h.api.getState().eventResolved) h.decide(0); pause();
    if (month === 1) { h.edict(text); pause(); }
    if (mode === "breach" && month === 2) {
      const army = Object.values(h.window.XianArmySystem.getState().armies).find(item => item.owner === "yuan_shao");
      assert.equal(h.window.XianArmySystem.issueMapOrder(army.id, "xudu", "attack").ok, true); pause();
    }
    h.api.endTurn(); pause();
    if (restore && month === 2) {
      const bundle = plain(h.api.captureFullSave());
      h = harness(Object.fromEntries(Object.entries(bundle.stores).map(([key, value]) => [key, JSON.stringify(value)])));
      h.node("continue-game-btn").click(); h.loadEngine(); pause();
    }
  }
  const contract = h.window.XianStrategyNetwork.getState().promises[0];
  assert.equal(contract.status, mode === "partial" ? "partial" : mode === "breach" ? "broken" : "fulfilled", `${mode} actual handler result`);
  return normalize(plain(h.api.captureFullSave()).stores);
}
for (const mode of ["tribute", "partial", "aid", "peace", "breach"]) {
  const baseline = play(mode);
  for (const delay of [50, 500, "random"]) assert.deepEqual(play(mode, delay), baseline, `${mode} all stores must ignore operation interval ${delay}`);
  assert.deepEqual(play(mode, 0, true), baseline, `${mode} all stores must survive full-save continuation`);
}
console.log("diplomatic replay regression ok: 25 seeded real-handler traces, tribute/partial/aid/peace/breach, 0/50/500/fixed-varied intervals, full-store restore comparison");
