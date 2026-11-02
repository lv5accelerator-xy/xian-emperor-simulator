"use strict";
const assert = require("node:assert/strict");
const { harness, plain, CORE_KEY } = require("./helpers/game-harness");
const EVOLUTION = "xian_emperor_campaign_evolution_v150";
const SNAPSHOT = "xian_emperor_month_snapshot_v011";
const REPORTS = "xian_emperor_monthly_reports_v011";
function transient(interval) {
  const h = harness(); h.loadEngine();
  h.api.startNewGame("standard", "xingping_195", { randomSeed: 2240 }); h.flush();
  const core = h.api.getState();
  h.replaceCore({turn: 4, stats: {...core.stats, officials:44, prestige:60}});
  const evolution = h.window.XianCampaignEvolution.getState();
  Object.assign(evolution, {currentStage:2, completedStages:["195-carriage","195-route"], lastProcessedTurn:4});
  h.localStorage.setItem(EVOLUTION, JSON.stringify(evolution)); h.node("load-btn").click(); h.flush();
  h.api.applyExternalPackage({effects:{officials:1}, causalId:"test-threshold-up"}); h.advance(interval);
  h.api.applyExternalPackage({effects:{officials:-4}, causalId:"test-threshold-down"}); h.flush();
  assert.ok(h.window.XianCampaignEvolution.getState().completedStages.includes("195-officials"), "committed transient threshold must award stage before next action");
  const once = h.api.getState().stats.authority;
  h.api.applyExternalPackage({effects:{officials:1}, causalId:"test-threshold-up"});
  assert.equal(h.api.getState().stats.authority, once, "replayed receipt cannot award again");
  return plain({stats:h.api.getState().stats, random:h.api.getState().random, stages:h.window.XianCampaignEvolution.getState().completedStages});
}
function snapshotReload() {
  const h = harness(); h.mount("monthly-report"); h.api.startNewGame(); h.flush();
  const before = h.localStorage.getItem(SNAPSHOT); assert.ok(before);
  h.decide(0); h.flush(); h.node("load-btn").click(); h.flush();
  assert.equal(h.localStorage.getItem(SNAPSHOT), before, "loading mid-month must preserve original month baseline");
}
function failedNewGame() {
  const h = harness(); h.mount("monthly-report", "save-backups"); h.api.startNewGame(); h.flush();
  h.localStorage.setItem(REPORTS, JSON.stringify({gameCreatedAt:h.api.getState().createdAt,reports:[{turn:0,title:"retained"}]}));
  const before = h.stores(); const set = h.localStorage.setItem;
  h.localStorage.setItem = function(key,value) {if(key==="xian_emperor_save_backups_v2180") throw new Error("injected backup failure"); return set.call(this,key,value);};
  h.node("new-game-btn").click(); h.flush();
  for(const key of [CORE_KEY,SNAPSHOT,REPORTS]) assert.equal(h.localStorage.getItem(key),before[key],`${key} survives rejected new game`);
}
const cases = { transient:()=>{const baseline=transient(0); for(const delay of [50,500]) assert.deepEqual(transient(delay),baseline);}, snapshotReload, failedNewGame };
if(process.argv[2]) cases[process.argv[2]](); else Object.values(cases).forEach(test=>test());
console.log("PASS committed transient stages, durable receipts, stable month baseline, rejected replacement lifecycle");
