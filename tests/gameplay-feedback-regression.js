"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");

class StorageMock {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.get(key) || null; }
  setItem(key, value) { this.values.set(key, String(value)); }
  removeItem(key) { this.values.delete(key); }
}
function harness() {
  const listeners = new Map();
  const timers = [];
  const document = {
    readyState: "loading",
    addEventListener(type, handler) { if (!listeners.has(type)) listeners.set(type, []); listeners.get(type).push(handler); },
    dispatchEvent(event) { (listeners.get(event.type) || []).forEach(handler => handler(event)); },
    getElementById() { return null; }, querySelector() { return null; },
  };
  function setTimeout(callback) { timers.push(callback); return timers.length; }
  const context = { console, Storage: StorageMock, localStorage: new StorageMock(), document,
    CustomEvent: function(type, options) { this.type = type; this.detail = options?.detail; },
    setTimeout, clearTimeout() {}, window: { setTimeout, clearTimeout() {}, addEventListener() {} },
  };
  context.load = (...files) => files.forEach(file => vm.runInNewContext(fs.readFileSync(path.join(root, `src/${file}.js`), "utf8"), context, { filename: file }));
  context.emit = (type, detail = {}) => document.dispatchEvent({ type, detail });
  context.flush = () => { let count = 0; while (timers.length && count++ < 50) timers.shift()(); assert.ok(count < 50, "watchers must settle"); };
  return context;
}
const coreFixture = () => ({
  createdAt: "gameplay-test", turn: 1, maxTurns: 12, year: 196, month: 10, eventResolved: true, actionPoints: 2, ended: false,
  stats: { authority: 46, prestige: 60, security: 50, treasury: 42, officials: 52, caoAlert: 40 },
  hidden: { loyalNetwork: 30, leakRisk: 18, peopleStability: 48, externalBalance: 40 },
  relations: { cao_cao: 50, liu_biao: 55 }, reports: [], chronicle: [], causality: { metrics: { courtVictories: 0 } },
});

// Exercise the same parser and outcome builder used by the core and confirmation page.
const rules = harness();
rules.load("data", "strategy-network-data", "edict-rules", "game", "monthly-report", "strategy-network", "decree-confirmation");
const game = rules.window.XianEmperorGame;
const core = coreFixture();
assert.equal(game.previewEdict("不得练兵，不得任命曹操。", core).ok, false, "negated orders must not become executable positive policies");
assert.equal(game.previewEdict("不要练兵，不任命曹操。", core).ok, false);
const mixed = game.previewEdict("不得练兵；安抚曹操。", core);
assert.deepEqual(Array.from(mixed.interpretation.categories), ["appease"]);
assert.equal(mixed.outcome.effects.treasury || 0, 0, "excluded military text must not charge military spending");
assert.equal(mixed.outcome.edict.effectiveText, "安抚曹操", "subsystems receive affirmative text only");
const names = game.previewEdict("曹操、袁绍、袁术、刘表、孙策各守本分。", core).outcome;
assert.equal(Object.keys(names.relations).length, 0, "name lists alone cannot grant relations");
assert.equal(names.hidden.externalBalance || 0, 0, "name lists alone cannot grant external balance");
assert.equal(rules.window.XianEdictRules.reportText({ ...names, text: names.text }), "", "name lists must not create world or army orders");
const pair = game.previewEdict("安抚袁绍、刘表。", core).outcome;
assert.ok(pair.hidden.externalBalance <= 3, "multiple targets share one political budget");
assert.ok(Object.values(pair.relations).reduce((sum, value) => sum + value, 0) <= 5);
assert.equal(game.previewEdict("开仓赈济；任命刘表；恢复朝仪；安抚曹操。", core).ok, false, "more than two policy categories require separate actions");
assert.equal(game.previewEdict("安抚曹操、袁绍、刘表。", core).ok, false, "more than two named targets require separate actions");
assert.deepEqual(Array.from(rules.window.XianStrategyNetwork.detectOrders("不得出兵驰援许都。")), []);
assert.deepEqual(Array.from(rules.window.XianStrategyNetwork.detectPromises("不得奉表进贡。")), []);
assert.equal(rules.window.XianDecreeConfirmation.analyzeEdict("不得练兵；安抚曹操。", null).orders.length, 0);
const longText = "命刘表自襄阳出兵驰援许都；" + "照例验明官牒".repeat(24) + "；三月内奉表贡赋。";
const longEdict = game.previewEdict(longText, core).outcome;
assert.ok(rules.window.XianEdictRules.reportText(longEdict).includes("奉表贡赋"), "full validated commands survive the 90-character report quote");

// All historical scenarios use the core calendar; current logs have stable game/turn identities.
const monthly = rules.window.XianMonthlyReport;
for (const [year, expected] of [[189, "中平六年"], [195, "兴平二年"], [196, "建安元年"], [220, "延康元年"]]) {
  assert.ok(monthly.formatReignDate(year, 1).startsWith(expected));
  const before = { ...coreFixture(), year, month: 1, reports: [{ title: "旧存档裁决", type: "decision", date: game.formatReignDate(year, 1), text: "执行度（75%）", timestamp: 1 }] };
  assert.equal(monthly.buildMonthlyReport(before, before, before).operations.length, 1, `${year} legacy date log must be included`);
}
const before = coreFixture();
before.reports = [
  { title: "当前行动", type: "action", turn: 1, gameCreatedAt: before.createdAt, date: "旧格式日期", text: "执行度（80%）", timestamp: 2 },
  { title: "其他回合", type: "action", turn: 2, gameCreatedAt: before.createdAt, date: game.formatReignDate(196, 10), text: "执行度（100%）", timestamp: 3 },
  { title: "另一局", type: "action", turn: 1, gameCreatedAt: "other", date: game.formatReignDate(196, 10), text: "执行度（100%）", timestamp: 4 },
];
const after = { ...before, turn: 2, reports: [...before.reports, { title: "月末结算", type: "neutral", turn: 1, gameCreatedAt: before.createdAt, text: "俸粮不足｜国库-1", timestamp: 5 }] };
const report = monthly.buildMonthlyReport(before, after, before);
assert.equal(report.operations.length, 1);
assert.equal(report.averageExecution, 80);
assert.equal(report.monthEndNotes[0], "俸粮不足");
const empty = monthly.buildMonthlyReport(coreFixture(), coreFixture(), coreFixture());
assert.equal(empty.averageExecution, null, "no evaluable logs cannot imply perfect execution");
assert.equal(empty.overall.label, "无可评估政令");
assert.doesNotMatch(monthly.buildReportHtml(empty), /100%|null%/);

// Reproduce treasury loss with high activity, then settle only after month-end consumption.
const agenda = harness();
const agendaCore = coreFixture();
agendaCore.stats.treasury = 18;
agenda.window.XianEmperorGame = { getState: () => JSON.parse(JSON.stringify(agendaCore)), applyExternalPackage() {} };
agenda.load("quarterly-agenda");
agenda.emit("DOMContentLoaded");
assert.equal(agenda.window.XianQuarterlyAgenda.selectAgenda("restore_treasury"), true);
agendaCore.stats.treasury -= 8;
agenda.window.XianQuarterlyAgenda.addContribution(100, "连续赈济");
assert.equal(agenda.window.XianQuarterlyAgenda.calculateProgress(agendaCore), 0, "spending and activity must not count as treasury recovery");
agendaCore.turn = 3;
agendaCore.stats.treasury = 30;
assert.equal(agenda.window.XianQuarterlyAgenda.calculateProgress(agendaCore), 100);
agenda.emit("xian:before-month-end", { createdAt: agendaCore.createdAt });
assert.ok(agenda.window.XianQuarterlyAgenda.getState().active, "do not settle before recurring monthly costs");
agendaCore.stats.treasury -= 1;
agenda.emit("xian:month-ended", { createdAt: agendaCore.createdAt });
assert.equal(agenda.window.XianQuarterlyAgenda.getState().history[0].success, false, "falling below target after costs is not success");
// A bounded 0–100 stat has a reachable target, and a secondary condition cannot be traded away.
const capped = harness();
const cappedCore = coreFixture(); cappedCore.stats.security = 95;
capped.localStorage.setItem("xian_emperor_quarterly_agenda_v2100", JSON.stringify({ gameCreatedAt: cappedCore.createdAt, active: { id: "secure_palace", baseline: 95, secondaryBaseline: 18, endTurn: 3 }, contribution: 100 }));
capped.window.XianEmperorGame = { getState: () => cappedCore, applyExternalPackage() {} };
capped.load("quarterly-agenda");
cappedCore.stats.security = 100;
assert.equal(capped.window.XianQuarterlyAgenda.calculateProgress(cappedCore), 100, "a near-cap stat must have a reachable target");
cappedCore.hidden.leakRisk = 19;
assert.ok(capped.window.XianQuarterlyAgenda.calculateProgress(cappedCore) < 100, "worsened secondary conditions must prevent success");

// Use the actual army loader/order interface: access and affordability are checked before mutating.
const army = harness();
const armyCore = coreFixture();
army.window.XianEmperorGame = {
  getState: () => JSON.parse(JSON.stringify(armyCore)),
  performExternalAction(pkg) { armyCore.stats.treasury += pkg.effects.treasury || 0; armyCore.actionPoints--; return true; },
};
army.window.XianStrategyNetwork = { findRoutePath: () => ["test-route"] };
army.load("data", "strategy-network-data", "army-data", "army-system");
army.localStorage.setItem("xian_emperor_simulator_v01", JSON.stringify(armyCore));
army.flush();
const armyApi = army.window.XianArmySystem;
const courtArmy = Object.values(armyApi.getState().armies).find(item => item.owner === "court");
const outerArmy = Object.values(armyApi.getState().armies).find(item => item.owner === "liu_biao");
assert.equal(armyApi.getCommandAccess(courtArmy).allowed, true);
assert.equal(armyApi.getCommandAccess(outerArmy).allowed, false, "an unrelated outer army cannot be directly moved");
assert.equal(armyApi.issueMapOrder(outerArmy.id, "xudu", "support").ok, false);
assert.equal(armyCore.actionPoints, 2, "rejected command must consume no action");
army.localStorage.setItem("xian_emperor_strategy_network_v040", JSON.stringify({ strategies: { liu_biao: { trust: 65 } }, routes: {} }));
assert.equal(armyApi.getCommandAccess(outerArmy).allowed, true, "sufficient authority, trust and relation permit cooperation");
armyCore.stats.treasury = 2;
assert.equal(armyApi.issueMapOrder(courtArmy.id, courtArmy.cityId, "supply").ok, false, "insufficient treasury cannot issue a funded order");
assert.equal(armyCore.stats.treasury, 2);
assert.equal(armyCore.actionPoints, 2);
armyCore.stats.treasury = 3;
const preview = armyApi.previewMapOrder(courtArmy.id, courtArmy.cityId, "supply");
assert.equal(preview.actionCost, 1);
assert.equal(preview.treasuryCost, 3);
assert.equal(armyApi.issueMapOrder(courtArmy.id, courtArmy.cityId, "supply").ok, true);
assert.equal(armyCore.stats.treasury, 0);
assert.equal(armyCore.actionPoints, 1, "a valid order spends exactly the previewed costs");

// Crisis guidance has priority; otherwise the active real quarterly objective guides all action views.
const guidance = harness();
guidance.load("data", "command-center");
guidance.window.XianQuarterlyAgenda = { getState: () => ({ gameCreatedAt: core.createdAt, active: { id: "restore_treasury" } }), calculateProgress: () => 0 };
assert.equal(guidance.window.XianCommandCenter.recommendAction(core).actionId, "revenue");
assert.equal(guidance.window.XianCommandCenter.recommendAction({ ...core, stats: { ...core.stats, caoAlert: 80 } }).actionId, "appease");
assert.equal(guidance.window.XianCommandCenter.recommendAction({ ...core, actionPoints: 0 }).actionId, "end");
console.log("gameplay feedback regression ok: edicts, historical monthly logs, actual agenda outcomes, command access and costs, guidance");
