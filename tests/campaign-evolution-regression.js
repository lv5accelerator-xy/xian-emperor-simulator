"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

class StorageMock {
  getItem() { return null; }
  setItem() {}
}

const document = { readyState: "loading", addEventListener() {} };
const context = {
  console,
  document,
  Storage: StorageMock,
  localStorage: new StorageMock(),
  setTimeout,
  clearTimeout,
  window: { addEventListener() {}, XIAN_STRATEGY_DATA: null },
};

for (const file of ["src/strategy-network-data.js", "src/campaign-evolution-data.js", "src/campaign-evolution.js"]) {
  vm.runInNewContext(read(file), context, { filename: file });
}

const data = context.window.XIAN_CAMPAIGN_DATA;
const api = context.window.XianCampaignEvolution;
assert.ok(api, "campaign evolution API should load");
assert.equal(data.version, "1.5.0");
assert.equal(Object.keys(data.scenarioStages).length, 5, "all five scenarios should have staged objectives");
for (const [scenarioId, stages] of Object.entries(data.scenarioStages)) {
  assert.equal(stages.length, 4, `${scenarioId} should have exactly four readable stages`);
  assert.ok(stages.every(stage => stage.goals.length >= 2), `${scenarioId} stages need clear multi-part goals`);
}

const objectiveContext = {
  core: { turn: 5, edictsIssued: 2, stats: { security: 55, caoAlert: 60 }, hidden: { externalBalance: 35 } },
  strategy: { routes: { xudu_ye: { supply: 52 } } },
  evolution: { assignmentsCompleted: 1 },
};
assert.equal(api.objectiveComplete({ type: "statMin", key: "security", target: 50 }, objectiveContext), true);
assert.equal(api.objectiveComplete({ type: "statMax", key: "caoAlert", target: 59 }, objectiveContext), false);
assert.equal(api.objectiveComplete({ type: "routeSupplyMin", key: "xudu_ye", target: 50 }, objectiveContext), true);
assert.equal(api.objectiveComplete({ type: "assignmentCount", target: 1 }, objectiveContext), true);

assert.deepEqual([1, 4, 7, 10].map(api.seasonForMonth), ["spring", "summer", "autumn", "winter"]);
const routes = Array.from(context.window.XIAN_STRATEGY_DATA.routes);
const autumn = api.buildSeasonEffects("autumn", 4, routes);
assert.equal(Object.keys(autumn).length, routes.length, "autumn should give every route a small supply recovery");
assert.ok(Object.values(autumn).every(effect => effect.supply === 1));
const winter = api.buildSeasonEffects("winter", 5, routes);
assert.ok(Object.values(winter).some(effect => effect.weatherCost === 2), "winter should increase mountain route travel cost");

const strategy = { routes: Object.fromEntries(routes.map(route => [route.id, { supply: route.supply, pressure: route.pressure }])) };
const first = api.chooseFrontEvent("summer", 6, routes, strategy, "same-game");
const second = api.chooseFrontEvent("summer", 6, routes, strategy, "same-game");
assert.equal(first.id, second.id, "front events should be deterministic for a save and turn");
assert.equal(first.type, "flood");

console.log("campaign evolution regression ok: stages, goals, seasons and deterministic fronts");
