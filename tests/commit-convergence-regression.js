"use strict";
const assert = require("node:assert/strict");
const { harness, plain } = require("./helpers/game-harness");
const EVOLUTION = "xian_emperor_campaign_evolution_v150";
const PATHS = "xian_emperor_imperial_paths_v2130";
function rewardChain() {
  const h = harness(); h.loadEngine(); h.api.startNewGame("standard", "jianan_196", { randomSeed: 2240 }); h.flush();
  const c = h.api.getState(); h.replaceCore({ turn: 7, stats: { ...c.stats, authority: 54, officials: 54, caoAlert: 40 } });
  const campaign = h.window.XianCampaignEvolution.getState();
  Object.assign(campaign, { currentStage: 3, completedStages: ["196-capital", "196-edict", "196-network"], lastProcessedTurn: 7, lastEnvironmentTurn: 7 });
  h.localStorage.setItem(EVOLUTION, JSON.stringify(campaign));
  h.localStorage.setItem(PATHS, JSON.stringify({ gameCreatedAt: c.createdAt, unlocked: true, offers: [], history: [],
    active: { id: "restoration", stage: 0, momentum: 0, seenEvents: [], lastStageTurn: 0, lastEventTurn: 0 } }));
  h.mount("imperial-paths");
  h.api.applyExternalPackage({ effects: { officials: 1 }, receiptId: "chain-officials" });
  assert.ok(h.window.XianCampaignEvolution.getState().completedStages.includes("196-independent"), "imperial reward must settle the newly reached campaign goal before operation returns");
  assert.equal(h.api.getState().stats.authority, 58);
  const stats = plain(h.api.getState().stats), random = plain(h.api.getState().random);
  h.node("save-btn").click(); h.flush();
  assert.deepEqual(h.api.getState().stats, stats, "save itself cannot mint delayed gameplay rewards");
  assert.deepEqual(h.api.getState().random, random);
}
function pendingLegacyStage() {
  const source = harness(); source.api.startNewGame("standard", "xingping_195", { randomSeed: 244 });
  source.replaceCore({ turn: 4, stats: { ...source.api.getState().stats, officials: 45, prestige: 60, authority: 35 } });
  const core = source.api.getState();
  source.localStorage.setItem(EVOLUTION, JSON.stringify({ gameCreatedAt: core.createdAt, scenarioId: core.scenarioId, currentStage: 2,
    completedStages: ["195-carriage", "195-route"], assignments: [], lastProcessedTurn: 4, lastEnvironmentTurn: 4,
    environment: { events: [], activeBlockades: [] }, log: [] }));
  const h = harness(source.stores()); h.loadEngine();
  assert.equal(h.api.getState(), null);
  assert.ok(!h.window.XianCampaignEvolution.getState().completedStages.includes("195-officials"), "module initialization cannot acknowledge a stage before live core can receive its reward");
  h.node("continue-game-btn").click(); h.flush();
  assert.equal(h.api.getState().stats.authority, 36); assert.equal(h.api.getState().stats.officials, 47);
  assert.ok(h.api.getState().appliedReceipts.includes(`stage:${core.createdAt}:195-officials`));
  const once = plain(h.api.getState().stats); h.node("load-btn").click(); h.flush(); assert.deepEqual(h.api.getState().stats, once);
}
const cases = { rewardChain, pendingLegacyStage };
let failed = 0;
for (const [name, fn] of Object.entries(cases)) { try { fn(); console.log(`PASS ${name}`); } catch (error) { failed++; console.error(`FAIL ${name}: ${error.message}`); } }
if (failed) process.exitCode = 1;
