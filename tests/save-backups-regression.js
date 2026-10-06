"use strict";
const assert = require("node:assert/strict");
const { harness, plain, CORE_KEY } = require("./helpers/game-harness");
const BACKUP_KEY = "xian_emperor_save_backups_v2180";
const SHORT_KEY = "xian_emperor_short_challenges_v230";
const ARMY_KEY = "xian_emperor_armies_v050";
const MEMORY_KEY = "xian_emperor_character_memory_v170";

function ready(stores = {}, random = .91) {
  const run = harness(stores, random); run.loadMechanics(); run.mount("save-backups"); run.flush(); return run;
}
function oneMonth(run) { run.decide(1); run.api.endTurn(); run.flush(); }
function playedState(run) {
  const core = run.api.getState(), result = run.window.XianShortChallenges.getResultForGame(core.createdAt);
  return plain({ stats: core.stats, hidden: core.hidden, random: core.random, turn: core.turn, ending: core.ending,
    armies: run.window.XianArmySystem.getState().armies,
    review: result?.review && { goals: result.review.goals, months: result.review.months.map(month => ({ turn: month.turn, changes: month.changes })) } });
}

const run = ready();
const definition = { ...run.window.XianShortChallenges.getChallenges()[0], randomSeed: 1818 };
run.window.XianShortChallenges.startCustom(definition);
run.advance(400);
assert.equal(run.window.XianSaveBackups.getEntries().length, 0, "backup must wait for delayed army and campaign saves");
run.flush();
let entries = run.window.XianSaveBackups.getEntries();
assert.equal(entries.length, 1); assert.equal(entries[0].turn, 1);
assert.ok(entries[0].bundle.stores[ARMY_KEY]);
assert.ok(entries[0].bundle.stores[SHORT_KEY].active.reviewLog);
assert.equal(Object.hasOwn(entries[0].bundle.stores, BACKUP_KEY), false, "complete snapshots must not recursively contain the backup index");
const monthOne = JSON.stringify(entries[0].bundle);
run.decide(1); run.flush();
assert.equal(JSON.stringify(run.window.XianSaveBackups.getEntries()[0].bundle), monthOne, "an action must not overwrite the month's recovery point");
run.api.endTurn(); run.flush();
oneMonth(run); oneMonth(run); oneMonth(run);
entries = run.window.XianSaveBackups.getEntries();
assert.deepEqual(plain(entries.map(entry => entry.turn)), [5, 4, 3], "only the latest three monthly snapshots are retained");
const checkpoint = plain(entries.find(entry => entry.turn === 3));
run.api.applyExternalPackage({ effects: { treasury: 1 } });
const beforeRestore = plain(run.api.captureFullSave());
run.node("backups-btn").click();
assert.match(run.node("modal-body").innerHTML, /军团、人物、随机进度/);
const restoreButton = run.node("modal-body").querySelectorAll("[data-backup-restore]").find(button => button.dataset.backupRestore === checkpoint.slot);
assert.ok(restoreButton); restoreButton.click();
assert.match(run.node("modal-title").textContent, /恢复完整备份/);
run.node("modal-confirm").click();
for (const key of run.api.getPortableStorageKeys()) {
  assert.deepEqual(JSON.parse(run.localStorage.getItem(key) || "null"), checkpoint.bundle.stores[key] ?? null, `${key} must restore as part of the same snapshot`);
}
const prior = run.window.XianSaveBackups.getEntries().find(entry => entry.slot === "replacement");
assert.deepEqual(plain(prior.bundle.stores), beforeRestore.stores, "restoring must archive the live save before replacing it");
// A queued save from the previous world cannot overwrite the restored world while reload is pending.
run.localStorage.setItem(ARMY_KEY, JSON.stringify({ gameCreatedAt: "stale-world" }));
assert.deepEqual(JSON.parse(run.localStorage.getItem(ARMY_KEY)), checkpoint.bundle.stores[ARMY_KEY]);
run.flush();
for (const key of run.api.getPortableStorageKeys()) {
  assert.deepEqual(JSON.parse(run.localStorage.getItem(key) || "null"), checkpoint.bundle.stores[key] ?? null, `${key} must survive delayed pre-restore callbacks`);
}

const resumed = ready(run.stores(), .14); resumed.node("continue-game-btn").click(); resumed.flush();
assert.equal(resumed.api.getState().turn, 3);
assert.deepEqual(plain(resumed.api.getState().random), checkpoint.bundle.stores[CORE_KEY].random);
const directStores = Object.fromEntries(Object.entries(checkpoint.bundle.stores).map(([key, value]) => [key, JSON.stringify(value)]));
const direct = ready(directStores, .64); direct.node("continue-game-btn").click(); direct.flush();
while (!resumed.api.getState().ended) oneMonth(resumed);
while (!direct.api.getState().ended) oneMonth(direct);
assert.deepEqual(playedState(resumed), playedState(direct), "restored RNG, armies and review must continue identically to the original complete checkpoint");

// Restarting a short run must archive its old active definition before that definition is overwritten.
const archivedCore = plain(resumed.api.captureFullSave());
resumed.window.XianShortChallenges.start("xudu_mutiny"); resumed.flush();
const archived = resumed.window.XianSaveBackups.getEntries().find(entry => entry.slot === "replacement");
assert.deepEqual(plain(archived.bundle.stores), archivedCore.stores);
assert.notEqual(resumed.api.getState().createdAt, archived.bundle.stores[CORE_KEY].createdAt);
assert.ok(archived.bundle.stores[SHORT_KEY].results.length);

// Importing a package without a system store must remove a stale system from the other run.
const minimal = plain(resumed.api.captureFullSave()); delete minimal.stores[MEMORY_KEY];
assert.ok(resumed.localStorage.getItem(MEMORY_KEY));
assert.equal(resumed.api.restoreFullSave(minimal), true);
assert.equal(resumed.localStorage.getItem(MEMORY_KEY), null);

// Fail partway through the multi-store write: roll back every portable store and the live core.
const failing = ready(); failing.window.XianShortChallenges.startCustom(definition); failing.flush();
const earlier = plain(failing.api.captureFullSave()); oneMonth(failing);
const live = plain(failing.api.getState()), stableStores = failing.stores();
const set = failing.localStorage.setItem; let rejected = false;
failing.localStorage.setItem = function(key, value) {
  if (!rejected && key === "xian_emperor_world_v020") { rejected = true; throw new Error("simulated quota rejection"); }
  return set.call(this, key, value);
};
assert.equal(failing.api.restoreFullSave(earlier), false);
for (const key of failing.api.getPortableStorageKeys()) assert.equal(failing.localStorage.getItem(key), stableStores[key] ?? null, `${key} must roll back on partial failure`);
assert.deepEqual(plain(failing.api.getState()), live);
assert.equal(failing.window.__xianFullSaveImporting, false);
assert.equal(failing.window.__xianFullSaveWriting, false);
failing.localStorage.setItem = set;

// If a replacement backup cannot be saved, starting another short run must leave the current run intact.
failing.localStorage.setItem = function(key, value) { if (key === BACKUP_KEY) throw new Error("backup storage full"); return set.call(this, key, value); };
const shortBefore = failing.localStorage.getItem(SHORT_KEY);
assert.equal(failing.window.XianShortChallenges.start("xudu_mutiny"), false);
assert.deepEqual(plain(failing.api.getState()), live); assert.equal(failing.localStorage.getItem(SHORT_KEY), shortBefore);
assert.match(failing.window.XianSaveBackups.getProblem(), /未能保存/);

const active = ready(); active.window.XianShortChallenges.startCustom(definition); active.flush();
active.decide(1); active.flush(); const activeBefore = plain(active.api.captureFullSave());
active.window.XianShortChallenges.start("xudu_mutiny"); active.flush();
const oldActive = active.window.XianSaveBackups.getEntries().find(entry => entry.slot === "replacement");
assert.deepEqual(plain(oldActive.bundle.stores), activeBefore.stores, "backup must preserve the previous active challenge and receipts before switching definitions");
assert.equal(oldActive.bundle.stores[SHORT_KEY].active.challengeId, "white_horse");

// Save files from before automatic backups existed still become complete checkpoints on first resume.
const legacy = { ...directStores }; delete legacy[BACKUP_KEY];
const old = ready(legacy); old.node("continue-game-btn").click(); old.flush();
assert.equal(old.window.XianSaveBackups.getEntries()[0].turn, 3);
assert.deepEqual(plain(old.window.XianSaveBackups.getEntries()[0].bundle.stores[CORE_KEY].random), checkpoint.bundle.stores[CORE_KEY].random);
console.log("Bounded full backups, UI restore, seeded replay, old-save compatibility, stale-store cleanup and rollback passed.");
