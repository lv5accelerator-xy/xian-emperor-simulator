"use strict";
const assert = require("node:assert/strict");
const { harness, plain } = require("./helpers/game-harness");
const KEY = "xian_emperor_progression_v100";
const click = (run, attribute, value) => run.document.dispatchEvent({ type: "click", target: { closest: selector => selector === `[data-${attribute}]`
  ? { dataset: { [attribute.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())]: value } } : null } });
function fixture(treasury, extra = {}) {
  const run = harness(); run.api.startNewGame();
  const core = run.api.getState(); run.replaceCore({ eventResolved: true, stats: { ...core.stats, treasury } });
  run.localStorage.setItem(KEY, JSON.stringify({ profile: { tutorialSeen: true }, session: { gameCreatedAt: core.createdAt,
    pathId: "balance", pathStage: 1, ...extra } }));
  run.mount("imperial-progress-data", "imperial-progress"); return run;
}
for (const treasury of [0, 2, 3]) {
  const run = fixture(treasury, { pendingArc: { arcId: "yang_biao", chapterIndex: 0 } });
  const core = plain(run.api.getState()), progress = plain(run.window.XianImperialProgress.getState());
  click(run, "arc-choice", "0");
  if (treasury < 3) {
    assert.deepEqual(plain(run.api.getState()), core, `treasury ${treasury}: failed arc payment preserves core and RNG`);
    assert.deepEqual(plain(run.window.XianImperialProgress.getState()), progress, "failed payment preserves pending chapter and collections");
  } else {
    assert.equal(run.api.getState().stats.treasury, 0);
    assert.equal(run.window.XianImperialProgress.getState().session.arcProgress.yang_biao.stage, 1);
    const once = plain(run.api.getState()); click(run, "arc-choice", "0");
    assert.deepEqual(plain(run.api.getState()), once, "same chapter cannot pay twice");
  }
}
{
  const run = fixture(20);
  let latestCommit;
  run.document.addEventListener("xian:commit-completed", () => { latestCommit = plain(run.window.XianImperialProgress.getState()); });
  click(run, "path-action", "grant_staves");
  assert.equal(latestCommit.session.lastUsedTurns.grant_staves, run.api.getState().turn, "final commit includes path-action cooldown");
  const once = plain(run.api.getState()); click(run, "path-action", "grant_staves");
  assert.deepEqual(plain(run.api.getState()), once, "same month path action respects cooldown");
}
{
  const run = harness(); run.window.XianShortChallenges.start("abdication_eve");
  const core = run.api.getState();
  run.localStorage.setItem(KEY, JSON.stringify({ profile: { tutorialSeen: true }, session: { gameCreatedAt: core.createdAt, pathId: "guard", pathStage: 0 } }));
  run.mount("imperial-progress-data", "imperial-progress");
  assert.ok(run.window.XianImperialProgress.getState().session.pendingArc, "first-quarter character threshold uses actual four-month deadline");
}
{
  const run = harness(); run.api.startNewGame(); run.api.concludeExternalEnding({ title: "本局结束", text: "结束后不能新增帝业处分。" });
  run.localStorage.setItem("xian_emperor_imperial_paths_v2130", JSON.stringify({ gameCreatedAt: run.api.getState().createdAt, unlocked: true,
    offers: ["benevolent"], active: null, history: [] }));
  run.mount("imperial-paths");
  const before = plain(run.window.XianImperialPaths.getState());
  assert.equal(run.window.XianImperialPaths.choosePath("benevolent"), false, "ended game cannot adopt a new imperial path");
  assert.deepEqual(plain(run.window.XianImperialPaths.getState()), before);
}
console.log("Progression consistency: paid chapter budget boundaries, duplicate choice, action cooldown commit and short-run deadline passed.");
