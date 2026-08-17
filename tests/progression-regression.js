"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

class StorageMock {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
}

const localStorage = new StorageMock();
const context = {
  console,
  setTimeout,
  clearTimeout,
  Storage: StorageMock,
  localStorage,
  document: { readyState: "loading", addEventListener() {} },
  window: { addEventListener() {} },
};
vm.runInNewContext(read("src/imperial-progress-data.js"), context, { filename: "imperial-progress-data.js" });
const data = context.window.XIAN_IMPERIAL_PROGRESS_DATA;

assert.equal(data.paths.length, 3, "three imperial paths should exist");
assert.deepEqual(Array.from(data.paths, pathItem => pathItem.id), ["covert", "balance", "guard"]);
for (const pathItem of data.paths) {
  assert.equal(pathItem.stages.length, 3, `${pathItem.id} should have three stages`);
  assert.ok(pathItem.ending?.title && pathItem.ending?.text, `${pathItem.id} should have a special ending`);
  for (const stage of pathItem.stages) {
    assert.equal(stage.objectives.length, 2, `${pathItem.id}/${stage.title} should have two objectives`);
    assert.ok(stage.action?.id && stage.action?.cooldown >= 3, `${pathItem.id}/${stage.title} should unlock a bounded action`);
  }
}

assert.equal(data.arcs.length, 5, "five major character arcs should exist");
for (const arc of data.arcs) {
  assert.equal(arc.chapters.length, 3, `${arc.id} should have three chapters`);
  assert.ok(arc.memory && arc.goodTitle, `${arc.id} should unlock a memory and title`);
  for (const chapter of arc.chapters) assert.equal(chapter.choices.length, 2, `${arc.id}/${chapter.title} should have two choices`);
}
assert.deepEqual(Array.from(data.themes, theme => theme.id), ["ink", "jade", "frost"]);

localStorage.setItem("xian_emperor_progression_v100", JSON.stringify({
  version: 1,
  profile: {},
  session: { gameCreatedAt: "test-game", pathId: "balance", pathStage: 3 },
}));
vm.runInNewContext(read("src/imperial-progress.js"), context, { filename: "imperial-progress.js" });
const api = context.window.XianImperialProgress;
assert.ok(api, "imperial progress diagnostics API should load");
assert.equal(api.getPathEnding({ createdAt: "other-game", stats: {}, hidden: {} }), null, "path rewards must not leak across runs");
assert.equal(api.getPathEnding({ createdAt: "test-game", stats: { prestige: 70 }, hidden: { externalBalance: 65 } })?.title, "天下共奉");
assert.equal(api.getPathEnding({ createdAt: "test-game", stats: { prestige: 50 }, hidden: { externalBalance: 65 } }), null, "special ending conditions must be enforced");

function loadEndingApi(pathId) {
  class IsolatedStorage extends StorageMock {}
  const storage = new IsolatedStorage();
  storage.setItem("xian_emperor_progression_v100", JSON.stringify({
    version: 1,
    profile: {},
    session: { gameCreatedAt: "ending-test", pathId, pathStage: 3 },
  }));
  const isolated = {
    console,
    setTimeout,
    clearTimeout,
    Storage: IsolatedStorage,
    localStorage: storage,
    document: { readyState: "loading", addEventListener() {} },
    window: { addEventListener() {} },
  };
  vm.runInNewContext(read("src/imperial-progress-data.js"), isolated);
  vm.runInNewContext(read("src/imperial-progress.js"), isolated);
  return isolated.window.XianImperialProgress;
}

assert.equal(loadEndingApi("covert").getPathEnding({
  createdAt: "ending-test",
  stats: { security: 40, caoAlert: 70 },
  hidden: { loyalNetwork: 65 },
})?.title, "灯下同盟");
assert.equal(loadEndingApi("guard").getPathEnding({
  createdAt: "ending-test",
  stats: { authority: 70, security: 60 },
  hidden: {},
})?.title, "宫门自掌");

const gameSource = read("src/game.js");
assert.match(gameSource, /xian-emperor-full-save/, "v1.0 should export a full save envelope");
assert.match(gameSource, /performExternalAction/, "path actions should use the core action economy");
assert.match(gameSource, /schemaVersion:\s*101/, "old saves should migrate to schema 101");

console.log("imperial progression regression ok");
