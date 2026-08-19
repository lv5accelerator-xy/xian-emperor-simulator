"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const store = new Map();
const core = {
  createdAt: "path-test", ended: false, turn: 7,
  stats: { authority: 62, officials: 64, prestige: 70 }, hidden: { peopleStability: 52 },
  causality: { metrics: { courtVictories: 1, citiesTaken: 0, battles: 2 } },
};
const quarterly = { history: [{ success: true, agendaId: "steady_court" }, { success: true, agendaId: "renew_mandate" }] };
const council = { history: [{ adviserId: "yang_biao" }, { adviserId: "xun_yu" }] };
const pathEvents = [
  { id: "path_restoration_seals", pathId: "restoration", pathStage: 1 },
  { id: "path_restoration_offices", pathId: "restoration", pathStage: 2 },
];
const context = {
  console,
  localStorage: { getItem: key => store.get(key) || null, setItem: (key, value) => store.set(key, value) },
  document: { addEventListener(type, handler) { if (type === "DOMContentLoaded") handler(); }, getElementById() { return null; } },
  window: {
    GAME_DATA: { pathEvents },
    XianEmperorGame: { getState: () => JSON.parse(JSON.stringify(core)), applyExternalPackage() {} },
    XianQuarterlyAgenda: { getState: () => JSON.parse(JSON.stringify(quarterly)), addContribution() {} },
    XianCouncilAdvice: { getState: () => JSON.parse(JSON.stringify(council)) },
  },
};
vm.runInNewContext(fs.readFileSync(path.join(root, "src/imperial-paths.js"), "utf8"), context, { filename: "imperial-paths.js" });
const api = context.window.XianImperialPaths;
assert.equal(api.version, "2.13.0");
assert.equal(api.paths.length, 3, "three distinct medium-term imperial paths should exist");
const scored = api.scorePaths(core, quarterly, council);
assert.equal(scored[0].id, "restoration", "real long-term behavior should drive the recommendation order");
assert.equal(api.choosePath("restoration"), true);
assert.equal(api.choosePath("benevolent"), false, "the chosen medium-term path is a lasting commitment");
assert.equal(api.selectEventId(core), "path_restoration_seals", "the chosen path should inject its own memorials");
assert.equal(api.selectEventId({ ...core, turn: 8 }), null, "exclusive memorials should not crowd every month");
console.log("imperial paths regression ok");
