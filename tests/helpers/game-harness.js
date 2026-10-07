"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "../..");
const CORE_KEY = "xian_emperor_simulator_v01";
const plain = value => JSON.parse(JSON.stringify(value));

// Minimal DOM adapter: run the real core's click handlers and save/load paths.
function harness(stores = {}, ambientRandom = .99) {
  const listeners = new Map();
  const nodes = new Map();
  const timers = new Map(); let timerId = 0, timerClock = 0;
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
      this._html = String(value); this.queries.clear(); this.radioInputs = [];
      for (const match of this._html.matchAll(/<input\b([^>]+)>/g)) {
        const attrs = match[1], name = attrs.match(/name="([^"]+)"/)?.[1], value = attrs.match(/value="([^"]+)"/)?.[1];
        if (!name || !/type="radio"/.test(attrs)) continue;
        const input = new Element(); input.name = name; input.value = value; input._checked = false;
        Object.defineProperty(input, "checked", { get: () => input._checked, set: checked => {
          input._checked = checked;
          if (checked) formValues.set(`input[name="${name}"]:checked`, input);
          else if (formValues.get(`input[name="${name}"]:checked`) === input) formValues.delete(`input[name="${name}"]:checked`);
        } });
        this.radioInputs.push(input); if (/\bchecked\b/.test(attrs)) input.checked = true;
      }
      for (const match of this._html.matchAll(/\bid="([^"]+)"/g)) { const child = new Element(); child.id = match[1]; }
      for (const match of this._html.matchAll(/<select\b[^>]*id="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g)) {
        const options = [...match[2].matchAll(/<option\b([^>]*value="([^"]+)"[^>]*)>/g)];
        node(match[1]).value = (options.find(option => /\bselected\b/.test(option[1])) || options[0])?.[2] || "";
      }
    }
    get innerHTML() { return this._html; }
    addEventListener(type, handler, options) { if (!this.handlers.has(type)) this.handlers.set(type, []); this.handlers.get(type).push({ handler, capture: options === true || options?.capture }); }
    dispatchEvent(event) {
      event.currentTarget = this; event.target ||= this;
      event.preventDefault ||= () => {}; event.stopImmediatePropagation ||= () => { event.stopped = true; };
      for (const entry of [...(this.handlers.get(event.type) || [])].sort((a, b) => Number(Boolean(b.capture)) - Number(Boolean(a.capture)))) {
        entry.handler(event); if (event.stopped) break;
      }
    }
    click() { if (!this.disabled) this.dispatchEvent({ type: "click", target: this }); }
    querySelectorAll(selector) {
      const radioName = selector.match(/^input\[name="([^"]+)"\]$/)?.[1];
      if (radioName) return (this.radioInputs || []).filter(input => input.name === radioName);
      if (this.queries.has(selector)) return this.queries.get(selector);
      const attribute = selector.match(/^\[(data-[a-z-]+)\]$/)?.[1];
      const found = attribute ? [...this._html.matchAll(new RegExp(`${attribute}="([^"]*)"`, "g"))].map(match => {
        const node = new Element(); node.dataset[attribute.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = match[1]; return node;
      }) : [];
      this.queries.set(selector, found); return found;
    }
    querySelector(selector) { if (selector.startsWith(".")) {
        if (!this.queries.has(selector) && this._html.includes(selector.slice(1))) this.queries.set(selector, [new Element()]);
        return this.queries.get(selector)?.[0] || null;
      }
      return selector.startsWith("#") ? nodes.get(selector.slice(1)) || null : this.querySelectorAll(selector)[0] || null; }
    prepend(child) { this.prepended = child; }
    setAttribute() {} appendChild(child) { child.parentNode = this; return child; } insertAdjacentElement() {} remove() {} focus() {} before() {} after() {} scrollIntoView(options) { this.lastScroll = options; } closest() { return null; }
  }
  class StorageMock {
    constructor() { this.values = new Map(Object.entries(stores)); }
    getItem(key) { return this.values.get(key) ?? null; }
    setItem(key, value) { this.values.set(key, String(value)); }
    removeItem(key) { this.values.delete(key); }
  }
  const localStorage = new StorageMock();
  const downloads = [];
  const formValues = new Map();
  const node = id => { if (!nodes.has(id)) nodes.set(id, new Element()); return nodes.get(id); };
  const document = { readyState: "loading", body: new Element(), head: new Element(), getElementById: node, createElement: () => new Element(),
    querySelector: selector => formValues.get(selector) || null, querySelectorAll: () => [],
    addEventListener(type, handler) { if (!listeners.has(type)) listeners.set(type, []); listeners.get(type).push(handler); },
    dispatchEvent(event) { (listeners.get(event.type) || []).slice().forEach(handler => handler(event)); } };
  const math = Object.create(Math); math.random = () => ambientRandom;
  const context = { console, document, Blob: class { constructor(parts) { this.text = parts.join(""); } },
    URL: { createObjectURL: blob => { downloads.push(blob); return "blob:test"; }, revokeObjectURL() {} }, localStorage, Storage: StorageMock, Math: math, Date: ClockDate, JSON,
    setTimeout: (callback, delay = 0) => { timers.set(++timerId, { callback, deadline: timerClock + Number(delay || 0) }); return timerId; }, clearTimeout: id => timers.delete(id), requestAnimationFrame: callback => callback(),
    MutationObserver: class { observe() {} disconnect() {} },
    Event: class { constructor(type) { this.type = type; } }, CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options?.detail; } },
    FileReader: class { readAsText(file) { this.result = file.text; this.onload(); } },
    window: { confirm: () => true, addEventListener() {}, scrollTo() {}, location: { reload() {} },
      XianDynastySaga: { isActive: () => false }, XianCommandCenter: { registerTab() {}, close() {}, refresh() {}, escapeHtml: String } } };
  context.window.setTimeout = context.setTimeout; context.window.clearTimeout = context.clearTimeout;
  vm.createContext(context);
  const load = (...files) => files.forEach(file => vm.runInContext(fs.readFileSync(path.join(root, "src", `${file}.js`), "utf8"), context, { filename: file }));
  const mount = (...files) => { const initial = (listeners.get("DOMContentLoaded") || []).length; load(...files); listeners.get("DOMContentLoaded").slice(initial).forEach(handler => handler()); };
  load("data", "action-plans", "monthly-safety", "edict-rules", "action-feedback", "game", "short-score", "short-review", "same-challenge", "short-challenges", "weekly-challenge", "monthly-report");
  // Initialize the core only; monthly report's pure builder remains available below.
  listeners.get("DOMContentLoaded")[0]();
  const api = context.window.XianEmperorGame;
  const replaceCore = patch => { const core = api.getState(); Object.assign(core, patch); localStorage.setItem(CORE_KEY, JSON.stringify(core)); node("continue-game-btn").click(); return api.getState(); };
  const decide = index => { const buttons = node("event-choices").querySelectorAll("[data-choice-index]"); assert.ok(buttons[index], "real event choice must exist"); buttons[index].click(); };
  const edict = text => { node("decree-input").value = text; node("issue-decree-btn").click(); };
  const advance = (duration = Infinity) => {
    const until = timerClock + duration; let count = 0;
    while (timers.size && count++ < 500) {
      const [id, entry] = [...timers.entries()].sort((a, b) => a[1].deadline - b[1].deadline || a[0] - b[0])[0];
      if (entry.deadline > until) break;
      timers.delete(id); timerClock = entry.deadline; entry.callback();
    }
    if (Number.isFinite(until)) timerClock = until;
    assert.ok(count < 500, "save watchers must settle");
  };
  const flush = () => advance();
  const loadEngine = () => {
    const initial = listeners.get("DOMContentLoaded").length;
    // Dynamic UI panels are absent until their modules install them.
    const staticIds = new Set([...fs.readFileSync(path.join(root, "index.html"), "utf8").matchAll(/\bid="([^"]+)"/g)].map(match => match[1]));
    document.getElementById = id => nodes.has(id) || staticIds.has(id) ? node(id) : null;
    load("world-data", "strategy-network-data", "army-data", "campaign-evolution-data", "world-system", "strategy-network", "army-system", "court-politics", "campaign-evolution");
    listeners.get("DOMContentLoaded").slice(initial).forEach(handler => handler()); flush();
  };
  const act = (id, fields = {}) => {
    const button = node("action-grid").querySelectorAll("[data-action-id]").find(item => item.dataset.actionId === id);
    assert.ok(button, `actual action ${id} must exist`);
    button.click();
    for (const [name, value] of Object.entries(fields)) {
      if (name.startsWith("modal-")) node(name).value = value;
      else { const input = new Element(); input.value = value; formValues.set(`input[name="${name}"]:checked`, input); }
    }
    const before = api.getState().totalActions;
    node("modal-confirm").click();
    return api.getState().totalActions > before;
  };
  const loadMechanics = () => {
    loadEngine();
    const initial = listeners.get("DOMContentLoaded").length;
    load("imperial-progress-data", "imperial-progress", "character-memory", "world-marks", "consequence-echoes", "causal-court", "quarterly-agenda", "council-advice", "regional-echoes", "imperial-paths");
    listeners.get("DOMContentLoaded").slice(initial).forEach(handler => handler()); flush();
  };
  return { downloads, act, mount, loadMechanics, api, window: context.window, document, node, localStorage, load, loadEngine, advance, flush, replaceCore, decide, edict, stores: () => Object.fromEntries(localStorage.values) };
}


module.exports = { harness, plain, CORE_KEY };
