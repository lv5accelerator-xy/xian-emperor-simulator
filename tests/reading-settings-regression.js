"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "../src/reading-settings.js"), "utf8");
const KEY = "xian_reading_size_v1";
const CORE = "xian_emperor_simulator_v01";

function page({ preference, denied = false, ready = "loading" } = {}) {
  const core = JSON.stringify({ turn: 3, month: 12, actionPoints: 1, stats: { treasury: 29 }, random: { seed: 42, state: 314, draws: 17 } });
  const values = new Map([[CORE, core], ["xian_font_mode_v1", "clear"]]);
  if (preference != null) values.set(KEY, preference);
  const writes = [], handlers = {}, root = { dataset: { fontMode: "clear" } };
  const button = size => ({ dataset: size ? { readingSize: size } : {}, attributes: {}, listeners: {},
    setAttribute(key, value) { this.attributes[key] = value; },
    addEventListener(type, callback) { this.listeners[type] = callback; },
    click() { this.listeners.click(); },
  });
  const choices = ["standard", "large", "largest", "standard", "large", "largest"].map(button);
  const toggles = [button(), button()];
  const document = { documentElement: root, readyState: ready,
    querySelectorAll(selector) {
      if (selector === "button[data-reading-size]") return choices;
      if (selector === "[data-reading-toggle]") return toggles;
      throw new Error(`Unexpected selector: ${selector}`);
    },
    addEventListener(type, callback) { handlers[type] = callback; },
  };
  vm.runInNewContext(source, { document,
    localStorage: {
      getItem(key) { if (denied) throw new Error("Storage denied"); return values.get(key) ?? null; },
      setItem(key, value) { if (denied) throw new Error("Storage denied"); writes.push([key, value]); values.set(key, value); },
    },
    window: { addEventListener(type, callback) { handlers[type] = callback; } },
  }, { filename: "reading-settings.js" });
  return { choices, toggles, root, values, writes, handlers, core, boot() { handlers.DOMContentLoaded?.(); } };
}

const first = page();
assert.equal(first.root.dataset.readingSize, "standard", "default size is applied before body paint");
first.boot(); first.choices[1].click();
assert.equal(first.root.dataset.readingSize, "large");
assert.equal(first.choices[4].attributes["aria-pressed"], "true", "ending and opening selectors agree");
assert.match(first.toggles[0].attributes["aria-label"], /大字，切换为特大/);
first.toggles[1].click();
assert.equal(first.values.get(KEY), "largest");
assert.equal(first.toggles[0].textContent, "字号：特大");
first.toggles[0].click();
assert.equal(first.root.dataset.readingSize, "standard", "toggle wraps from largest to standard");
assert.equal(first.values.get(CORE), first.core, "turn, AP, resources and random progress stay byte-identical");
assert.equal(first.values.get("xian_font_mode_v1"), "clear", "size does not overwrite the font preference");
assert.equal(first.root.dataset.fontMode, "clear");
assert.ok(first.writes.every(([key]) => key === KEY));

for (const preference of ["large", "largest"]) {
  const restored = page({ preference });
  assert.equal(restored.root.dataset.readingSize, preference, "reload restores size before controls mount");
  restored.boot();
  assert.equal(restored.choices.find(button => button.dataset.readingSize === preference).attributes["aria-pressed"], "true");
}
for (const preference of ["", "invalid", "null", "<script>"]) {
  assert.equal(page({ preference }).root.dataset.readingSize, "standard");
}
const denied = page({ denied: true }); denied.boot(); denied.choices[2].click();
assert.equal(denied.root.dataset.readingSize, "largest", "blocked storage still allows this page to resize");
const loaded = page({ preference: "large", ready: "complete" });
loaded.handlers.storage({ key: KEY, newValue: "largest" });
assert.equal(loaded.root.dataset.readingSize, "largest");
loaded.handlers.storage({ key: "xian_font_mode_v1", newValue: "classic" });
loaded.handlers.storage({ key: CORE, newValue: null });
assert.equal(loaded.root.dataset.readingSize, "largest", "unrelated storage events cannot resize the page");
loaded.handlers.storage({ key: null, newValue: null });
assert.equal(loaded.root.dataset.readingSize, "standard");
assert.equal(loaded.writes.length, 0, "cross-tab updates do not write back");
console.log("Reading sizes: restore, three modes, cross-tab sync, blocked storage and game/font isolation passed.");
