"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path");
const { harness, plain, CORE_KEY } = require("./helpers/game-harness");
const ready = (stores = {}) => { const h = harness(stores, .73); h.loadMechanics(); h.mount("save-backups"); h.flush(); return h; };
const importFile = (h, value) => h.node("import-file").dispatchEvent({ type: "change", target: { files: [{ text: JSON.stringify(value) }], value: "save.json" } });
const before = ready(); before.api.startNewGame("standard", "jianan_196", { randomSeed: 42424242 }); before.flush();
assert.ok(before.api.getState().random, "roundtrip must exercise the real seeded random state");
before.decide(1); before.api.endTurn(); before.flush();
const bundle = before.api.captureFullSave();
assert.equal(bundle.saveSchemaVersion, 1);
assert.equal(Object.getOwnPropertyDescriptor(bundle, "saveSchemaVersion").writable, false, "runtime export schema header is informational and read-only");
assert.throws(() => { bundle.saveSchemaVersion = 999; }, TypeError);
assert.equal(before.api.downloadFullSave(bundle, "roundtrip.json"), true);
const downloaded = JSON.parse(before.downloads.at(-1).text);
assert.deepEqual(downloaded.stores, plain(bundle.stores));
// Clear every persisted key before importing the actual JSON download.
for (const key of Object.keys(before.stores())) before.localStorage.removeItem(key);
assert.equal(Object.keys(before.stores()).length, 0);
const restored = ready(before.stores()); importFile(restored, downloaded);
for (const key of restored.api.getPortableStorageKeys()) {
  assert.deepEqual(JSON.parse(restored.localStorage.getItem(key) || "null"), downloaded.stores[key] ?? null, `full roundtrip: ${key}`);
}
assert.deepEqual(plain(restored.api.getState()), downloaded.stores[CORE_KEY]);
assert.deepEqual(plain(restored.api.getSaveSchemaInfo().lastImported), { present: true, value: 1 });
const resumed = ready(restored.stores()); resumed.node("continue-game-btn").click(); resumed.flush();
for (const field of ["stats", "hidden", "relations", "random", "turn", "actionPoints", "causality", "appliedReceipts"]) {
  assert.deepEqual(plain(resumed.api.getState()[field]), downloaded.stores[CORE_KEY][field], `resumed ${field}`);
}
for (const header of [undefined, 999, "unknown-future-header"]) {
  const copy = plain(downloaded); delete copy.saveSchemaVersion;
  if (header !== undefined) copy.saveSchemaVersion = header;
  const h = ready(); importFile(h, copy);
  assert.deepEqual(plain(h.api.getState()), downloaded.stores[CORE_KEY], "schema observation cannot change import decisions");
  assert.deepEqual(plain(h.api.getSaveSchemaInfo().lastImported), { present: header !== undefined, value: header ?? null });
}
const legacy = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures/save-core-v2.13.0.json"), "utf8"));
assert.equal(legacy.version, "2.13.0"); assert.equal(legacy.schemaVersion, 101); assert.equal(legacy.random, undefined);
const old = ready(); importFile(old, legacy);
const migrated = old.api.getState();
assert.equal(migrated.version, old.window.GAME_DATA.version); assert.equal(migrated.schemaVersion, 103); assert.equal(migrated.rulesVersion, 230);
assert.deepEqual(plain(migrated.stats), legacy.stats); assert.deepEqual(plain(migrated.hidden), legacy.hidden);
assert.equal(migrated.turn, legacy.turn); assert.equal(migrated.importMigration.source, "core-only");
assert.equal(migrated.importMigration.missingHistory, true);
assert.equal(migrated.random, null, "legacy unseeded core keeps the existing unseeded import behavior");
assert.deepEqual(plain(old.api.getSaveSchemaInfo().lastImported), { present: false, value: null });
assert.equal(old.localStorage.getItem("xian_emperor_armies_v050"), null, "old core must not invent a historical army store");
console.log("Full-save roundtrip, 26-store restoration, schema observation and archived v2.13.0 upgrade passed.");
