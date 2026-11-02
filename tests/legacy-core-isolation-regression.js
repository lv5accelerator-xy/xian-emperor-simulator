"use strict";
const assert = require("node:assert/strict");
const { harness, plain, CORE_KEY } = require("./helpers/game-harness");
const HISTORIAN = "xian_emperor_historian_v190";
const REPORTS = "xian_emperor_monthly_reports_v011";
const SNAPSHOT = "xian_emperor_month_snapshot_v011";
const PROGRESSION = "xian_emperor_progression_v100";
const FINAL = "xian_emperor_final_verdict_v250";
const tests = [];
const test = (name, fn) => tests.push([name, fn]);
function setup() {
  const h = harness(); h.loadMechanics(); h.mount("monthly-report", "historian", "save-backups");
  h.api.startNewGame("standard", "jianan_196", { randomSeed: 1024 }); h.flush();
  const old = h.api.getState();
  for (let i = 0; i < 2; i++) { h.decide(0); h.api.endTurn(); h.flush(); }
  h.decide(0); h.flush();
  assert.equal(h.api.getState().turn, 3);
  const historian = JSON.parse(h.localStorage.getItem(HISTORIAN));
  historian.runs = [{ id: "older-completed-run", gameCreatedAt: "other-finished-game", score: 123 }];
  h.localStorage.setItem(HISTORIAN, JSON.stringify(historian));
  return { h, old };
}
for (const sameIdentity of [true, false]) {
  test(`A2 legacy core import from month 3 to 1 (${sameIdentity ? "same" : "different"} identity)`, () => {
    let { h, old } = setup();
    if (!sameIdentity) old.createdAt = "imported-earlier-game";
    h.node("import-file").dispatchEvent({ type: "change", target: { files: [{ text: JSON.stringify(old) }], value: "legacy.json" } });
    assert.equal(h.api.getState().turn, 1);
    h = harness(h.stores()); h.loadMechanics(); h.mount("monthly-report", "historian"); h.node("continue-game-btn").click(); h.flush();
    assert.equal(h.api.getState().turn, 1);
    for (const name of ["XianWorldSystem", "XianStrategyNetwork", "XianArmySystem", "XianCampaignEvolution"]) {
      const system = h.window[name].getState();
      assert.equal(system.gameCreatedAt, old.createdAt, `${name} identity`);
      assert.ok(system.lastProcessedTurn <= 1, `${name} cannot retain future progress`);
    }
    const historian = JSON.parse(h.localStorage.getItem(HISTORIAN));
    assert.equal(historian.runs[0].id, "older-completed-run", "cross-run history remains");
    assert.ok(!historian.currentDecisions.some(item => item.turn > 1 || item.gameCreatedAt !== old.createdAt), "live historian must not retain future or foreign decisions");
    const reports = JSON.parse(h.localStorage.getItem(REPORTS) || "null");
    assert.ok(!reports?.reports?.some(item => item.turn > 1));
    assert.equal(JSON.parse(h.localStorage.getItem(SNAPSHOT)).turn, 1);
    assert.equal(h.window.XianShortChallenges.getState().active, null);
  });
}
test("A2 legacy missing stage history cannot fabricate completed rewards", () => {
  let { h, old } = setup();
  delete old.appliedReceipts; delete old.rulesVersion; delete old.commit; delete old.schemaVersion;
  h.node("import-file").dispatchEvent({ type: "change", target: { files: [{ text: JSON.stringify(old) }], value: "legacy.json" } });
  h = harness(h.stores()); h.loadMechanics(); h.node("continue-game-btn").click(); h.flush();
  assert.deepEqual(h.api.getState().stats, old.stats, "loading missing history cannot mint another stage reward");
  assert.equal(h.window.XianCampaignEvolution.getState().completedStages.length, 0, "unknown historical stage outcome is not a recorded completion");
  assert.deepEqual(plain(h.window.XianCampaignEvolution.getState().skippedStages), ["196-capital"]);
  assert.deepEqual(h.api.getState().random, old.random, "missing-history rebuild must not consume RNG");
});
test("A2 proven stage receipt survives a core-only rebuild without another reward", () => {
  let { h, old } = setup();
  const receipt = `stage:${old.createdAt}:196-capital`;
  assert.ok(old.appliedReceipts.includes(receipt));
  h.node("import-file").dispatchEvent({ type: "change", target: { files: [{ text: JSON.stringify(old) }], value: "core.json" } });
  h = harness(h.stores()); h.loadMechanics(); h.node("continue-game-btn").click(); h.flush();
  assert.deepEqual(plain(h.window.XianCampaignEvolution.getState().completedStages), ["196-capital"]);
  assert.deepEqual(plain(h.window.XianCampaignEvolution.getState().skippedStages), []);
  assert.deepEqual(h.api.getState().stats, old.stats);
  assert.deepEqual(h.api.getState().random, old.random);
  assert.equal(h.api.getState().appliedReceipts.filter(id => id === receipt).length, 1);
});
test("A2 same-identity finished archives stay historical after rewinding the core", () => {
  let h = harness(); h.loadMechanics(); h.mount("historian", "final-verdict", "save-backups");
  h.window.XianShortChallenges.start("white_horse"); h.flush();
  const old = h.api.getState();
  while (!h.api.getState().ended) { h.decide(0); h.api.endTurn(); h.flush(); }
  const result = h.window.XianShortChallenges.getResultForGame(old.createdAt);
  assert.ok(result, "real completed short result exists");
  const history = JSON.parse(h.localStorage.getItem(HISTORIAN)), verdict = JSON.parse(h.localStorage.getItem(FINAL));
  assert.ok(history.runs.some(item => item.gameCreatedAt === old.createdAt));
  assert.ok(verdict.verdicts.some(item => item.gameCreatedAt === old.createdAt));
  const plan = h.api.planLegacyImport(old);
  assert.deepEqual(plain(plan.stores[HISTORIAN].currentDecisions), []);
  assert.equal(plan.stores[HISTORIAN].runs.find(item => item.gameCreatedAt === old.createdAt).archivedByCoreImport, true);
  assert.equal(plan.stores[FINAL].verdicts.find(item => item.gameCreatedAt === old.createdAt).archivedByCoreImport, true);
  assert.equal(plan.stores.xian_emperor_short_challenges_v230.results.find(item => item.id === result.id).archivedByCoreImport, true);
  h.node("import-file").dispatchEvent({ type: "change", target: { files: [{ text: JSON.stringify(old) }], value: "rewind.json" } });
  h = harness(h.stores()); h.loadMechanics(); h.mount("historian", "final-verdict"); h.node("continue-game-btn").click(); h.flush();
  assert.equal(h.window.XianShortChallenges.getResultForGame(old.createdAt), null, "old completed branch is not the restored current result");
  const kept = h.window.XianShortChallenges.getState().results.find(item => item.id === result.id);
  assert.ok(kept.archivedByCoreImport); assert.equal(kept.score, result.score); assert.equal(kept.rulesVersion, result.rulesVersion);
  assert.deepEqual(plain(h.window.XianHistorian.getState().currentDecisions), []);
  assert.equal(h.window.XianHistorian.getState().runs.filter(item => item.gameCreatedAt === old.createdAt).length, 1);
  assert.deepEqual(h.api.getState().random, old.random);
});
test("A2 progression reset cannot create completion, resource, RNG or extra-run evidence", () => {
  let { h, old } = setup();
  const profile = plain(h.window.XianImperialProgress.getState().profile);
  h.node("import-file").dispatchEvent({ type: "change", target: { files: [{ text: JSON.stringify(old) }], value: "progression.json" } });
  h = harness(h.stores()); h.loadMechanics(); h.node("continue-game-btn").click(); h.flush();
  const next = h.window.XianImperialProgress.getState();
  assert.equal(next.session.pathId, null); assert.equal(next.session.pathStage, 0);
  assert.deepEqual(plain(next.profile.completedPaths), profile.completedPaths);
  assert.deepEqual(h.api.getState().stats, old.stats); assert.deepEqual(h.api.getState().random, old.random);
  assert.equal(next.profile.totalRuns, profile.totalRuns, "core-only import does not create a new played run");
});
let failed = 0;
for (const [name, fn] of tests) { try { fn(); console.log(`PASS ${name}`); } catch (error) { failed++; console.error(`FAIL ${name}: ${error.message}`); } }
console.log(`${tests.length - failed}/${tests.length} legacy isolation groups passed`);
if (failed) process.exitCode = 1;
