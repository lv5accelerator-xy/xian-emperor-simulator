"use strict";
const assert = require("node:assert/strict");
const { harness, plain, CORE_KEY } = require("./helpers/game-harness");
const BACKUPS = "xian_emperor_save_backups_v2180";
const REPORTS = "xian_emperor_monthly_reports_v011";
const SNAPSHOT = "xian_emperor_month_snapshot_v011";
const tests = [];
const test = (name, fn) => tests.push([name, fn]);

function fixture({ finished = false, weekly = false } = {}) {
  const h = harness(); h.loadMechanics(); h.mount("monthly-report", "historian", "save-backups");
  if (weekly) h.window.XianShortChallenges.startCustom(h.window.XianWeeklyChallenge.buildDefinition("XIAN-2026W42-1HBDF"));
  else h.window.XianShortChallenges.start("abdication_eve");
  h.flush();
  const oldCore = plain(h.api.getState()), oldBundle = plain(h.api.captureFullSave());
  if (finished) {
    while (!h.api.getState().ended) { h.decide(0); h.api.endTurn(); h.flush(); }
    h.window.XianShortChallenges.renderEndingReview(h.api.getState());
  } else {
    h.decide(0); h.api.endTurn(); h.flush(); h.decide(0); h.flush();
  }
  assert.ok(h.localStorage.getItem(REPORTS), "prior monthly archive is present");
  assert.ok(h.localStorage.getItem(SNAPSHOT), "month-start snapshot is present");
  return { h, oldCore, oldBundle };
}

function rejectBackup(h, operation) {
  const core = plain(h.api.getState()), before = h.stores(), short = plain(h.window.XianShortChallenges.getState());
  const write = h.localStorage.setItem; let failures = 0;
  h.localStorage.setItem = function(key, value) {
    if (key === BACKUPS) { failures++; throw new Error("injected replacement backup quota failure"); }
    return write.call(this, key, value);
  };
  operation(); h.flush();
  assert.ok(failures >= 1, "the real route attempts a replacement backup");
  assert.deepEqual(h.api.getState(), core, "failed replacement preserves live core, RNG and challenge identity");
  assert.deepEqual(plain(h.window.XianShortChallenges.getState()), short, "failed replacement preserves active definition and results in memory");
  for (const key of h.api.getPortableStorageKeys()) assert.equal(h.localStorage.getItem(key), before[key] ?? null, `${key} survives the failed replacement`);
  assert.equal(h.localStorage.getItem(BACKUPS), before[BACKUPS], "existing backup index survives");
  assert.ok(!h.window.__xianFullSaveImporting, "failure does not leave imports locked");
  assert.match(h.window.XianSaveBackups.getProblem(), /未能保存/);
  h.localStorage.setItem = write;
}

test("A2 backup failure: ordinary new-game button", () => {
  const { h } = fixture(); rejectBackup(h, () => h.node("new-game-btn").click());
});
test("A2 backup failure: new curated short game", () => {
  const { h } = fixture(); rejectBackup(h, () => assert.equal(h.window.XianShortChallenges.start("white_horse"), false));
});
test("A2 backup failure: fixed-code same challenge", () => {
  const { h } = fixture(); const definition = h.window.XianWeeklyChallenge.buildDefinition("XIAN-2026W42-1HBDF");
  rejectBackup(h, () => assert.equal(h.window.XianShortChallenges.startCustom(definition), false));
});
for (const weekly of [false, true]) {
  test(`A2 backup failure: actual ${weekly ? "same-challenge" : "curated"} ending retry button`, () => {
    const { h } = fixture({ finished: true, weekly });
    const retry = h.node("short-ending-review").querySelector("[data-short-retry]");
    assert.ok(retry, "real ending review exposes retry handler");
    rejectBackup(h, () => retry.click());
  });
}
test("A2 backup failure: legacy core import-file handler", () => {
  const { h, oldCore } = fixture();
  rejectBackup(h, () => h.node("import-file").dispatchEvent({ type: "change", target: { files: [{ text: JSON.stringify(oldCore) }], value: "core.json" } }));
});
test("A2 backup failure: full snapshot import-file handler", () => {
  const { h, oldBundle } = fixture();
  rejectBackup(h, () => h.node("import-file").dispatchEvent({ type: "change", target: { files: [{ text: JSON.stringify(oldBundle) }], value: "full.json" } }));
});
test("A2 cancelled short replacement leaves every portable store untouched", () => {
  const { h } = fixture(); const before = h.stores(), core = h.api.getState();
  h.window.confirm = () => false;
  assert.equal(h.window.XianShortChallenges.start("white_horse"), false);
  assert.equal(h.window.XianShortChallenges.startCustom(h.window.XianWeeklyChallenge.buildDefinition("XIAN-2026W42-1HBDF")), false);
  assert.deepEqual(h.api.getState(), core); assert.deepEqual(h.stores(), before);
});
let failed = 0;
for (const [name, fn] of tests) { try { fn(); console.log(`PASS ${name}`); } catch (error) { failed++; console.error(`FAIL ${name}: ${error.stack}`); } }
console.log(`${tests.length - failed}/${tests.length} replacement failure routes passed`);
if (failed) process.exitCode = 1;
