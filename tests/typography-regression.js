"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "../src/typography.js"), "utf8");
const KEY = "xian_font_mode_v1";

function page({ preference, blockRead = false, blockWrite = false, ready = "loading" } = {}) {
  const values = new Map([["xian_emperor_simulator_v01", '{"month":3,"ap":1}']]);
  if (preference != null) values.set(KEY, preference);
  const writes = [];
  const handlers = {};
  const root = { tagName: "HTML", dataset: { fontMode: "classic" } };
  const button = mode => ({
    tagName: "BUTTON", dataset: mode ? { fontMode: mode } : {}, attributes: {}, listeners: {},
    setAttribute(key, value) { this.attributes[key] = value; },
    addEventListener(type, callback) { this.listeners[type] = callback; },
    click() { this.listeners.click(); },
  });
  const choices = [button("classic"), button("clear"), button("classic"), button("clear")];
  const toggles = [button(), button()];
  const descriptions = [{ textContent: "" }];
  const document = {
    documentElement: root, readyState: ready,
    querySelectorAll(selector) {
      if (selector === "[data-font-mode]") return [root, ...choices];
      if (selector === "button[data-font-mode]") return choices;
      if (selector === "[data-font-toggle]") return toggles;
      if (selector === "[data-font-description]") return descriptions;
      throw new Error(`Unexpected selector: ${selector}`);
    },
    addEventListener(type, callback) { handlers[type] = callback; },
  };
  const localStorage = {
    getItem(key) { if (blockRead) throw new Error("Storage denied"); return values.get(key) ?? null; },
    setItem(key, value) {
      writes.push([key, value]);
      if (blockWrite) throw new Error("Storage denied");
      values.set(key, value);
    },
  };
  vm.runInNewContext(source, {
    document, localStorage,
    window: { addEventListener(type, callback) { handlers[type] = callback; } },
  }, { filename: "typography.js" });
  return { root, choices, toggles, descriptions, values, writes, handlers,
    boot() { handlers.DOMContentLoaded?.(); } };
}

const first = page();
assert.equal(first.root.dataset.fontMode, "classic", "new players see the classic theme before the body loads");
first.boot();
assert.equal(first.choices[0].attributes["aria-pressed"], "true");
first.choices[1].click();
assert.equal(first.root.dataset.fontMode, "clear");
assert.equal(first.values.get(KEY), "clear");
assert.equal(first.choices[3].attributes["aria-pressed"], "true", "opening and ending selectors stay in sync");
assert.equal(first.toggles[0].textContent, "字体：清晰");
assert.equal(first.toggles[1].attributes["aria-pressed"], "false");
assert.match(first.descriptions[0].textContent, /清晰/);
assert.equal(first.values.get("xian_emperor_simulator_v01"), '{"month":3,"ap":1}', "font switches preserve the game save");
assert.ok(first.writes.every(([key]) => key === KEY), "only the preference key may be written");

const reload = page({ preference: first.values.get(KEY) });
assert.equal(reload.root.dataset.fontMode, "clear", "refresh restores the preference before paint");
reload.boot();
reload.toggles[1].click();
assert.equal(reload.root.dataset.fontMode, "classic", "mobile toggle switches back");
assert.equal(reload.values.get(KEY), "classic");
assert.equal(reload.choices[2].attributes["aria-pressed"], "true");
assert.match(reload.toggles[0].attributes["aria-label"], /切换为清晰/);

for (const preference of ["unknown", "null", "<script>"]) {
  const invalid = page({ preference });
  invalid.boot();
  assert.equal(invalid.root.dataset.fontMode, "classic", "unknown preferences safely fall back");
}
const denied = page({ blockRead: true, blockWrite: true });
denied.boot();
denied.choices[1].click();
assert.equal(denied.root.dataset.fontMode, "clear", "switching still works when browser storage is blocked");
assert.equal(denied.choices[1].attributes["aria-pressed"], "true");

const loaded = page({ preference: "clear", ready: "complete" });
assert.equal(loaded.choices[1].attributes["aria-pressed"], "true");
loaded.handlers.storage({ key: KEY, newValue: "classic" });
assert.equal(loaded.root.dataset.fontMode, "classic", "another tab's preference propagates");
assert.equal(loaded.writes.length, 0, "storage notifications never write back");
loaded.handlers.storage({ key: "xian_emperor_simulator_v01", newValue: "clear" });
assert.equal(loaded.root.dataset.fontMode, "classic", "game-save events cannot switch typography");
loaded.handlers.storage({ key: KEY, newValue: "clear" });
loaded.handlers.storage({ key: null, newValue: null });
assert.equal(loaded.root.dataset.fontMode, "classic", "cleared preferences restore the default");

console.log("Typography preferences: persistence, controls, blocked storage and save isolation passed.");
