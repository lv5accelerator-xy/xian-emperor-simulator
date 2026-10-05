"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const CORE_KEY = "xian_emperor_simulator_v01";
const plain = value => JSON.parse(JSON.stringify(value));

// Minimal DOM adapter: run the real core's click handlers and save/load paths.
function harness(stores = {}, ambientRandom = .99) {
  const listeners = new Map();
  const nodes = new Map();
  const timers = new Map(); let timerId = 0;
  let clock = Date.now() + Math.round(ambientRandom * 100000000);
  class ClockDate extends Date { constructor(...args) { super(...(args.length ? args : [clock++])); } static now() { return clock++; } }
  class Element {
    constructor() {
      this.handlers = new Map(); this.dataset = {}; this.style = {}; this.value = ""; this.src = ""; this.hidden = false;
      this._html = ""; this.queries = new Map();
      const classes = new Set();
      this.classes = classes;
      this.classList = { add: (...keys) => keys.forEach(key => classes.add(key)), remove: (...keys) => keys.forEach(key => classes.delete(key)),
        contains: key => classes.has(key), toggle(key, force) { const on = force ?? !classes.has(key); on ? classes.add(key) : classes.delete(key); return on; } };
    }
    set id(value) { this._id = value; nodes.set(value, this); }
    get id() { return this._id; }
    set className(value) { this.classes.clear(); String(value).split(/\s+/).filter(Boolean).forEach(key => this.classes.add(key)); }
    get className() { return [...this.classes].join(" "); }
    set innerHTML(value) {
      this._html = String(value); this.queries.clear();
      for (const match of this._html.matchAll(/\bid="([^"]+)"/g)) { const child = new Element(); child.id = match[1]; }
    }
    get innerHTML() { return this._html; }
    addEventListener(type, handler) { if (!this.handlers.has(type)) this.handlers.set(type, []); this.handlers.get(type).push(handler); }
    dispatchEvent(event) { (this.handlers.get(event.type) || []).forEach(handler => handler(event)); }
    click() { this.dispatchEvent({ type: "click", target: this }); }
    querySelectorAll(selector) {
      if (this.queries.has(selector)) return this.queries.get(selector);
      const attribute = selector.match(/^\[(data-[a-z-]+)\]$/)?.[1];
      const found = attribute ? [...this._html.matchAll(new RegExp(`${attribute}="([^"]*)"`, "g"))].map(match => {
        const node = new Element(); node.dataset[attribute.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = match[1]; return node;
      }) : [];
      this.queries.set(selector, found); return found;
    }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    setAttribute() {} appendChild(child) { child.parentNode = this; return child; } insertAdjacentElement() {} remove() {} focus() {} before() {} closest() { return null; }
  }
  class StorageMock {
    constructor() { this.values = new Map(Object.entries(stores)); }
    getItem(key) { return this.values.get(key) ?? null; }
    setItem(key, value) { this.values.set(key, String(value)); }
    removeItem(key) { this.values.delete(key); }
  }
  const localStorage = new StorageMock();
  const node = id => { if (!nodes.has(id)) nodes.set(id, new Element()); return nodes.get(id); };
  const document = { readyState: "loading", body: new Element(), getElementById: node, createElement: () => new Element(),
    querySelector: () => null, querySelectorAll: () => [],
    addEventListener(type, handler) { if (!listeners.has(type)) listeners.set(type, []); listeners.get(type).push(handler); },
    dispatchEvent(event) { (listeners.get(event.type) || []).slice().forEach(handler => handler(event)); } };
  const math = Object.create(Math); math.random = () => ambientRandom;
  const context = { console, document, localStorage, Storage: StorageMock, Math: math, Date: ClockDate, JSON,
    setTimeout: callback => { timers.set(++timerId, callback); return timerId; }, clearTimeout: id => timers.delete(id), requestAnimationFrame: callback => callback(),
    MutationObserver: class { observe() {} disconnect() {} },
    Event: class { constructor(type) { this.type = type; } }, CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options?.detail; } },
    FileReader: class { readAsText(file) { this.result = file.text; this.onload(); } },
    window: { confirm: () => true, addEventListener() {}, scrollTo() {}, location: { reload() {} },
      XianDynastySaga: { isActive: () => false }, XianCommandCenter: { registerTab() {}, close() {}, refresh() {}, escapeHtml: String } } };
  context.window.setTimeout = context.setTimeout; context.window.clearTimeout = context.clearTimeout;
  vm.createContext(context);
  const load = (...files) => files.forEach(file => vm.runInContext(fs.readFileSync(path.join(root, "src", `${file}.js`), "utf8"), context, { filename: file }));
  load("data", "edict-rules", "action-feedback", "game", "short-challenges", "weekly-challenge", "monthly-report");
  // Initialize the core only; monthly report's pure builder remains available below.
  listeners.get("DOMContentLoaded")[0]();
  const api = context.window.XianEmperorGame;
  const replaceCore = patch => { const core = api.getState(); Object.assign(core, patch); localStorage.setItem(CORE_KEY, JSON.stringify(core)); node("continue-game-btn").click(); return api.getState(); };
  const decide = index => { const buttons = node("event-choices").querySelectorAll("[data-choice-index]"); assert.ok(buttons[index], "real event choice must exist"); buttons[index].click(); };
  const edict = text => { node("decree-input").value = text; node("issue-decree-btn").click(); };
  const flush = () => { let count = 0; while (timers.size && count++ < 500) { const [id, callback] = timers.entries().next().value; timers.delete(id); callback(); } assert.ok(count < 500, "save watchers must settle"); };
  const loadEngine = () => {
    const initial = listeners.get("DOMContentLoaded").length;
    // Dynamic UI panels are absent until their modules install them.
    const staticIds = new Set([...fs.readFileSync(path.join(root, "index.html"), "utf8").matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));
    document.getElementById = id => nodes.has(id) || staticIds.has(id) ? node(id) : null;
    load("world-data", "strategy-network-data", "army-data", "campaign-evolution-data", "world-system", "strategy-network", "army-system", "court-politics", "campaign-evolution");
    listeners.get("DOMContentLoaded").slice(initial).forEach(handler => handler()); flush();
  };
  return { api, window: context.window, document, node, localStorage, load, loadEngine, flush, replaceCore, decide, edict, stores: () => Object.fromEntries(localStorage.values) };
}

// Final treasury spending changes the medal; unused AP can also complete a final-month goal.
const fiscal = harness();
fiscal.window.XianShortChallenges.start("white_horse");
let core = fiscal.api.getState();
const beforeFiscal = fiscal.replaceCore({ turn: 6, eventResolved: true, actionPoints: 0,
  stats: { ...core.stats, authority: 40, treasury: 25, caoAlert: 60 }, hidden: { ...core.hidden, leakRisk: 0 } });
assert.equal(fiscal.window.XianShortChallenges.evaluateChallenge(fiscal.window.XianShortChallenges.getChallenges()[0], beforeFiscal).medal, "gold");
fiscal.api.endTurn();
let result = fiscal.window.XianShortChallenges.getState().results[0];
assert.equal(fiscal.api.getState().stats.treasury, 24, "final month must spend treasury before grading");
assert.equal(result.medal, "silver");
assert.equal(result.checks.find(item => item.path === "stats.treasury").value, 24);
assert.ok(fiscal.api.getState().reports.some(item => item.title === "月末结算" && item.turn === 6));
const finalReport = fiscal.window.XianMonthlyReport.buildMonthlyReport(beforeFiscal, fiscal.api.getState(), beforeFiscal);
assert.equal(finalReport.statChanges.find(item => item.key === "treasury").after, result.checks.find(item => item.path === "stats.treasury").value);
fiscal.api.endTurn();
assert.equal(fiscal.window.XianShortChallenges.getState().results.length, 1, "ending must not grade twice");

const interrupted = harness(); interrupted.window.XianShortChallenges.start("white_horse"); core = interrupted.api.getState();
interrupted.replaceCore({ turn: 6, eventResolved: true, actionPoints: 0, monthlySettledTurn: 6,
  stats: { ...core.stats, authority: 40, treasury: 24, caoAlert: 60 }, hidden: { ...core.hidden, leakRisk: 0 } });
interrupted.api.endTurn();
assert.equal(interrupted.api.getState().stats.treasury, 24, "resuming between month settlement and grading cannot charge the month twice");

const guards = harness();
guards.window.XianShortChallenges.start("xudu_mutiny"); core = guards.api.getState();
guards.replaceCore({ turn: 5, eventResolved: true, actionPoints: 1,
  stats: { ...core.stats, security: 41, officials: 42, caoAlert: 82 }, hidden: { ...core.hidden, leakRisk: 0 } });
guards.api.endTurn();
assert.equal(guards.window.XianShortChallenges.getState().results[0].medal, "gold", "last-month cautious governance must count toward palace security");
assert.equal(guards.api.getState().stats.security, 42);

// Use the real quarterly module, registered after short challenges as in index.html.
const quarterly = harness();
quarterly.window.XianShortChallenges.start("white_horse"); core = quarterly.api.getState();
quarterly.replaceCore({ turn: 4, eventResolved: true, actionPoints: 0, stats: { ...core.stats, treasury: 12 }, hidden: { ...core.hidden, leakRisk: 0 } });
quarterly.load("quarterly-agenda"); quarterly.window.XianQuarterlyAgenda.refresh();
assert.equal(quarterly.window.XianQuarterlyAgenda.selectAgenda("restore_treasury"), true);
core = quarterly.api.getState();
quarterly.replaceCore({ turn: 6, eventResolved: true, actionPoints: 0, stats: { ...core.stats, treasury: 25, authority: 40, caoAlert: 60 } });
quarterly.api.endTurn();
const quarterState = quarterly.window.XianQuarterlyAgenda.getState();
assert.equal(quarterState.history[0].success, true);
const reward = quarterly.window.XianQuarterlyAgenda.agendas.find(item => item.id === "restore_treasury").success.effects.treasury;
assert.equal(quarterly.api.getState().stats.treasury, 24 + reward, "quarter rewards must precede the final challenge grade");
assert.equal(quarterly.window.XianShortChallenges.getState().results[0].checks.find(item => item.path === "stats.treasury").value, 24 + reward);

const collapse = harness({}, 0);
collapse.window.XianShortChallenges.start("xudu_mutiny"); core = collapse.api.getState();
collapse.replaceCore({ turn: 5, eventResolved: true, actionPoints: 0,
  stats: { ...core.stats, security: 2, officials: 70, caoAlert: 45 }, hidden: { ...core.hidden, leakRisk: 90 } });
collapse.api.endTurn(); result = collapse.window.XianShortChallenges.getState().results[0];
assert.equal(collapse.api.getState().ending.title, "深宫幽闭");
assert.equal(result.endedEarly, true); assert.equal(result.medal, "none"); assert.equal(result.score, 0);
assert.equal(collapse.window.XianShortChallenges.getState().rewards.length, 0, "fatal last-month risk cannot award a successful challenge reward");

// Receipts use clamped, actual changes and remain readable after loading.
const feedback = harness(); feedback.api.startNewGame(); core = feedback.api.getState();
feedback.replaceCore({ eventResolved: true, stats: { ...core.stats, authority: 99 } });
feedback.api.performExternalAction({ title: "试行<诏>", text: "计划提高5点。", effects: { authority: 5, treasury: -3 }, hidden: { leakRisk: 2 }, relations: { cao_cao: 4 } });
let receipt = feedback.api.getState().reports.find(item => item.outcome?.kind === "action");
assert.equal(receipt.outcome.stats.find(item => item.key === "authority").delta, 1, "caps must not create a fictitious full reward");
assert.equal(receipt.outcome.actionPointsSpent, 1);
assert.match(feedback.node("action-feedback").innerHTML, /净支出 3/);
assert.match(feedback.node("action-feedback").innerHTML, /99 → 100/);
assert.match(feedback.node("action-feedback").innerHTML, /试行&lt;诏&gt;/);
assert.match(feedback.node("action-feedback").innerHTML, /泄密风险：上升/);
feedback.node("continue-game-btn").click();
assert.deepEqual(plain(feedback.api.getState().reports[0].outcome), plain(receipt.outcome));
feedback.document.addEventListener("xian:external-action-completed", () => {
  feedback.api.applyExternalPackage({ effects: { treasury: 1 }, causal: false });
  const causality = feedback.api.getState().causality;
  causality.pending.push({ id: "feedback-follow-up", source: "度支复核", text: "下月复核钱粮。", dueTurn: 2 });
  feedback.api.updateCausality(causality);
});
feedback.api.performExternalAction({ title: "度支", text: "原文含税额10%。", effects: { treasury: -3 } });
receipt = feedback.api.getState().reports.find(item => item.outcome?.kind === "action");
assert.equal(receipt.outcome.stats.find(item => item.key === "treasury").delta, -2, "receipt must include synchronous political replies");
assert.equal(receipt.outcome.followUps[0].dueTurn, 2);
const noAp = feedback.api.getState();
assert.equal(feedback.api.performExternalAction({ title: "重复", effects: { treasury: 10 } }), false);
assert.deepEqual(plain(feedback.api.getState()), plain(noAp));
const estimated = feedback.window.XianMonthlyReport.buildMonthlyReport(noAp, noAp, noAp);
assert.equal(estimated.operations.find(item => item.title === "度支").executionSource, "estimated", "an unrelated percentage is not an execution record");
assert.equal(estimated.hasEstimates, true);
assert.match(feedback.window.XianMonthlyReport.buildReportHtml(estimated), /估计/);
assert.match(feedback.window.XianMonthlyReport.buildReportHtml(estimated), /实际公开变化/);

// Same weekly seed and action sequence, even with different ambient randomness and timestamps.
function meaningfulState(api) {
  const value = api.getState();
  return plain({ turn: value.turn, currentEventId: value.currentEventId, stats: value.stats, hidden: value.hidden, relations: value.relations,
    random: value.random, actionPoints: value.actionPoints, totalActions: value.totalActions, edictsIssued: value.edictsIssued, ending: value.ending });
}
function continueRun(run, months) {
  const trace = [];
  for (let index = 0; index < months && !run.api.getState().ended; index += 1) {
    if (!run.api.getState().eventResolved) run.decide(0);
    run.flush();
    const beforePreview = plain(run.api.getState().random);
    for (let preview = 0; preview < 4; preview += 1) run.api.previewEdict("安抚曹操。", run.api.getState());
    assert.deepEqual(plain(run.api.getState().random), beforePreview, "previews cannot reroll the challenge stream");
    run.edict("安抚曹操。");
    run.flush();
    const saved = JSON.parse(run.localStorage.getItem(CORE_KEY));
    assert.equal(saved.edictsIssued, run.api.getState().edictsIssued, "edict count must be persisted with its random result");
    const monthly = run.window.XianMonthlyReport.buildMonthlyReport(run.api.getState(), run.api.getState(), run.api.getState());
    const edictOperation = monthly.operations.find(item => item.kind === "自由圣旨");
    assert.equal(edictOperation.executionSource, "recorded");
    assert.match(run.window.XianMonthlyReport.buildReportHtml(monthly), /记录/);
    run.api.endTurn(); run.flush(); trace.push(meaningfulState(run.api));
  }
  return trace;
}
const first = harness({}, .01);
const code = first.window.XianWeeklyChallenge.codeForWeek("2026W41");
const definition = first.window.XianWeeklyChallenge.buildDefinition(code);
assert.ok(Number.isInteger(definition.randomSeed));
first.window.XianShortChallenges.startCustom(definition);
const initial = meaningfulState(first.api);
const firstHalf = continueRun(first, 2);
assert.equal(firstHalf.length, 2);
const checkpoint = first.stores();
const secondHalf = continueRun(first, 4);
assert.equal(secondHalf.length, 4, "the replay fixture must complete all six months");
const fresh = harness({}, .97);
fresh.window.XianShortChallenges.startCustom(fresh.window.XianWeeklyChallenge.buildDefinition(code));
assert.deepEqual(meaningfulState(fresh.api), initial);
assert.equal(fresh.api.getRandomKey("world"), first.api.getRandomKey("world"), "subsystem randomness cannot depend on opening time");
assert.deepEqual(continueRun(fresh, 6), [...firstHalf, ...secondHalf]);
const resumed = harness(checkpoint, .67); resumed.node("continue-game-btn").click();
assert.deepEqual(continueRun(resumed, 4), secondHalf, "reload must retain random state and final-month results");
const imported = harness({}, .45);
const envelope = { format: "xian-emperor-full-save", stores: Object.fromEntries(Object.entries(checkpoint).map(([key, value]) => [key, JSON.parse(value)])) };
imported.node("import-file").dispatchEvent({ type: "change", target: { value: "save.json", files: [{ text: JSON.stringify(envelope) }] } });
const afterImport = harness(imported.stores(), .84); afterImport.node("continue-game-btn").click();
assert.deepEqual(continueRun(afterImport, 4), secondHalf, "full save import must retain both core RNG and active challenge state");
const legacy = harness(checkpoint); const oldCore = JSON.parse(legacy.localStorage.getItem(CORE_KEY)); delete oldCore.random;
legacy.localStorage.setItem(CORE_KEY, JSON.stringify(oldCore)); legacy.node("continue-game-btn").click();
assert.equal(legacy.api.getState().random, null, "ongoing legacy runs must not silently restart a seeded stream");
assert.equal(legacy.api.getRandomKey("capture", "legacy-siege-captive"), "legacy-siege-captive", "unseeded runs retain their original subsystem keys");

// Load the actual world, army, diplomacy, court and campaign watchers together.
function engineState(run) {
  const world = JSON.parse(run.localStorage.getItem("xian_emperor_world_v020") || "null");
  const strategy = run.window.XianStrategyNetwork.getState();
  const army = run.window.XianArmySystem.getState();
  const court = run.window.XianCourtPolitics.diagnostics();
  const evolution = run.window.XianCampaignEvolution.getState();
  return plain({ core: meaningfulState(run.api), world: world && { regions: world.regions, lords: world.lords },
    strategy: strategy && { cities: strategy.cities, routes: strategy.routes, strategies: strategy.strategies },
    armies: army?.armies, court: court && { factions: court.factions, petitions: court.petitions.map(item => ({ templateId: item.templateId, turn: item.turn, status: item.status })) },
    evolution: evolution && { currentStage: evolution.currentStage, completedStages: evolution.completedStages, environment: evolution.environment } });
}
const engineA = harness({}, .08); engineA.loadEngine(); engineA.window.XianShortChallenges.startCustom(definition); engineA.flush();
const engineFirstHalf = continueRun(engineA, 2); const engineCheckpoint = engineA.stores();
const engineRest = continueRun(engineA, 4); const engineFinal = engineState(engineA);
assert.equal(engineRest.length, 4);
assert.equal(engineA.api.getState().monthlySettledTurn, 6);
assert.equal(engineA.window.XianWorldSystem.getState().lastProcessedTurn, 7, "world must settle the terminal month before grading");
assert.equal(engineA.window.XianStrategyNetwork.getState().lastProcessedTurn, 7);
assert.equal(engineA.window.XianArmySystem.getState().lastProcessedTurn, 7);
const engineB = harness({}, .91); engineB.loadEngine(); engineB.window.XianShortChallenges.startCustom(definition); engineB.flush();
assert.deepEqual(continueRun(engineB, 6), [...engineFirstHalf, ...engineRest], "full engine must replay despite different opening clocks and ambient random IDs");
assert.deepEqual(engineState(engineB), engineFinal);
const engineReload = harness(engineCheckpoint, .72); engineReload.loadEngine(); engineReload.node("continue-game-btn").click(); engineReload.flush();
assert.deepEqual(continueRun(engineReload, 4), engineRest);
assert.deepEqual(engineState(engineReload), engineFinal, "all systems must retain the same seeded outcome after reload");

console.log("Settlement, actual feedback, seeded replay, reload and full-save import regression passed.");
