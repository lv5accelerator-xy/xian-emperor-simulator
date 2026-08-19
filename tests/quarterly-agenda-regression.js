"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const core = {
  createdAt: "agenda-test", ended: false, turn: 1, maxTurns: 12, eventResolved: false,
  stats: { treasury: 18, officials: 42, security: 50, authority: 38, prestige: 62 },
  hidden: { peopleStability: 34, leakRisk: 24 },
  causality: { metrics: { courtVictories: 0, courtDefeats: 1 } },
};
const store = new Map();
const context = {
  console,
  localStorage: { getItem: key => store.get(key) || null, setItem: (key, value) => store.set(key, value) },
  CustomEvent: function CustomEvent(type, init) { this.type = type; this.detail = init?.detail; },
  document: { addEventListener(type, handler) { if (type === "DOMContentLoaded") handler(); }, getElementById() { return null; }, dispatchEvent() {} },
  window: { XianEmperorGame: { getState: () => JSON.parse(JSON.stringify(core)) } },
};
vm.runInNewContext(fs.readFileSync(path.join(root, "src/quarterly-agenda.js"), "utf8"), context, { filename: "quarterly-agenda.js" });
const api = context.window.XianQuarterlyAgenda;
assert.equal(api.version, "2.10.0");
assert.equal(api.agendas.length, 6, "six reusable three-month agendas should exist");
const offers = api.buildOffers(core);
assert.equal(offers.length, 3, "the player should only see three agenda choices");
assert.equal(offers[0].id, "restore_treasury", "the most urgent real situation should lead the offers");
assert.equal(api.selectAgenda(offers[0].id), true, "an offered agenda should be selectable without spending an action");
core.stats.treasury += 12;
assert.equal(api.calculateProgress(core), 100, "meeting the tracked target should complete the agenda");
console.log("quarterly agenda regression ok");
