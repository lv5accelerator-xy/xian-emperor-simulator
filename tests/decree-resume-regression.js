"use strict";
const assert = require("node:assert/strict");
const { harness, plain, CORE_KEY } = require("./helpers/game-harness");

function mountFlow(run) {
  run.loadEngine();
  const query = run.document.querySelector;
  run.document.querySelector = selector => ({ ".decree-panel": run.node("decree-panel"), ".event-panel": run.node("event-panel"),
    ".action-panel": run.node("action-panel"), "#game-shell .game-main": run.node("game-main"), "#end-turn-btn": run.node("end-turn-btn") })[selector] || query(selector);
  run.mount("monthly-flow", "decree-helper", "decree-confirmation");
}

const run = harness(); mountFlow(run);
run.window.XianShortChallenges.startCustom({ ...run.window.XianShortChallenges.getChallenges()[3], randomSeed: 321 }); run.flush();
const helper = run.window.XianDecreeHelper;
assert.match(run.node("turn-label").textContent, /1 \/ 5.*许都夜变/);
assert.match(run.node("short-challenge-status").innerHTML, /最后 5 个月/);
assert.match(run.node("short-challenge-status").innerHTML, /最终|最后一月结算/);
assert.equal(run.window.XianMonthlyFlow.getStepState(run.api.getState()).current, 1);
const before = plain(run.api.getState());
for (const policy of ["relief", "tax", "investigation", "military", "ritual", "secret", "appointment", "diplomacy", "appease"]) {
  for (const target of helper.targets(policy)) {
    const draft = helper.buildDraft(policy, target.id, "steady");
    const interpretation = run.api.interpretEdict(draft);
    assert.equal(interpretation.blocked, false, `${policy}/${target.name} must produce a valid editable draft`);
    assert.deepEqual(plain(interpretation.categories), [policy], "a goal sentence must not add an accidental second policy");
    run.api.previewEdict(draft, run.api.getState());
  }
}
assert.deepEqual(plain(run.api.getState()), before, "building and previewing drafts cannot spend AP, money or random draws");
assert.equal(helper.buildDraft("relief", "untrusted<script>", "steady"), "");
assert.match(helper.buildPreviewHtml("开仓赈济。", run.api.getState()), /请先裁决本月奏报/);
run.decide(1); run.flush();
assert.equal(run.window.XianMonthlyFlow.getStepState(run.api.getState()).current, 2);
const core = run.api.getState();
const poor = { ...core, stats: { ...core.stats, treasury: 6 } };
const denied = run.api.previewEdict("开仓赈济。", poor);
assert.equal(denied.ok, false); assert.equal(denied.treasuryCost, 7); assert.match(denied.reason, /国库不足/);
assert.equal(run.api.previewEdict("开仓赈济。", { ...poor, stats: { ...poor.stats, treasury: 7 } }).ok, true);
assert.match(run.api.previewEdict("不得练兵。", core).reason, /否定|正面/);
assert.match(helper.buildPreviewHtml("安抚曹操<script>。", core), /曹操/);
assert.doesNotMatch(helper.buildPreviewHtml("安抚曹操<script>。", core), /<script>/);

// Actual input handler persists a handwritten draft; reload resumes the workspace without issuing it.
const draft = "命许都开仓赈济，安置流民。以安定地方人心。";
run.node("decree-helper-open").click(); run.node("decree-input").value = draft;
run.node("decree-input").dispatchEvent({ type: "input" }); run.flush();
const saved = JSON.parse(run.localStorage.getItem(CORE_KEY));
assert.equal(saved.decreeDraft, draft); assert.equal(saved.decreeWorkspaceOpen, true);
const checkpoint = run.stores();
const resumed = harness(checkpoint); mountFlow(resumed); resumed.node("continue-game-btn").click(); resumed.flush();
assert.equal(resumed.node("decree-input").value, draft);
assert.equal(resumed.node("decree-panel").classList.contains("is-drafting"), true);
assert.deepEqual(plain(resumed.node("decree-panel").lastScroll), { behavior: "smooth", block: "center" });
assert.equal(resumed.api.getState().actionPoints, saved.actionPoints);
assert.deepEqual(plain(resumed.api.getState().random), plain(saved.random));
assert.equal(resumed.window.XianMonthlyFlow.getStepState(resumed.api.getState()).current, 2);
resumed.node("decree-policy").value = "appease"; resumed.node("decree-policy").dispatchEvent({ type: "change" });
assert.equal(resumed.node("decree-input").value, draft, "changing helpers must not overwrite the restored handwritten draft");

// Real capture listener intercepts issue; returning to edit spends nothing.
resumed.node("issue-decree-btn").click();
assert.equal(resumed.api.getState().actionPoints, saved.actionPoints);
resumed.node("decree-confirmation-edit").click();
assert.equal(resumed.api.getState().edictsIssued, 0);
resumed.node("issue-decree-btn").click(); resumed.node("decree-confirmation-confirm").click(); resumed.flush();
assert.equal(resumed.api.getState().actionPoints, saved.actionPoints - 1);
assert.equal(resumed.api.getState().stats.treasury, saved.stats.treasury - 7);
assert.equal(resumed.api.getState().decreeDraft, "");
assert.equal(resumed.api.getState().decreeWorkspaceOpen, false);
assert.equal(resumed.node("decree-input").value, "");
assert.equal(resumed.window.XianMonthlyFlow.getStepState(resumed.api.getState()).current, 3);
const spentReload = harness(resumed.stores()); mountFlow(spentReload); spentReload.node("continue-game-btn").click(); spentReload.flush();
assert.equal(spentReload.window.XianMonthlyFlow.getStepState(spentReload.api.getState()).current, 3);
assert.ok(spentReload.node("end-turn-btn").lastScroll, "reload after an action should bring the player to month settlement");

// Denied funds and stale confirmation both recheck without consuming the seeded stream.
resumed.replaceCore({ actionPoints: 1, stats: { ...resumed.api.getState().stats, treasury: 0 } });
resumed.node("decree-input").value = "开仓赈济。";
const noFunds = plain(resumed.api.getState());
resumed.node("issue-decree-btn").click();
assert.equal(resumed.node("decree-confirmation-confirm").disabled, true);
resumed.node("decree-confirmation-confirm").click();
assert.deepEqual(plain(resumed.api.getState()), noFunds);
resumed.node("decree-confirmation-edit").click();
resumed.replaceCore({ stats: { ...resumed.api.getState().stats, treasury: 20 } });
resumed.node("issue-decree-btn").click();
resumed.api.applyExternalPackage({ effects: { treasury: -20 }, causal: false });
const stale = plain(resumed.api.getState());
resumed.node("decree-confirmation-confirm").click();
assert.deepEqual(plain(resumed.api.getState()), stale);
assert.equal(resumed.node("decree-confirmation-confirm").disabled, true);

resumed.node("decree-confirmation-edit").click();
resumed.api.applyExternalPackage({ effects: { treasury: 20 }, causal: false });
resumed.node("decree-input").value = "开仓赈济。";
resumed.node("issue-decree-btn").click();
const beforeErase = plain(resumed.api.getState());
resumed.node("decree-input").value = "";
resumed.node("decree-confirmation-confirm").click();
assert.deepEqual(plain(resumed.api.getState()), beforeErase, "clearing a stale draft must not issue its earlier text");
assert.equal(resumed.node("decree-confirmation-confirm").disabled, true);

// Completed settlement cannot be turned back into an extra action after a reload.
resumed.replaceCore({ monthlySettledTurn: resumed.api.getState().turn });
assert.equal(resumed.window.XianMonthlyFlow.getStepState(resumed.api.getState()).current, 3);
assert.equal(resumed.api.previewEdict("安抚曹操。", resumed.api.getState()).ok, false);
assert.equal(resumed.node("issue-decree-btn").disabled, true);

const legacy = harness(checkpoint); const old = JSON.parse(legacy.localStorage.getItem(CORE_KEY));
delete old.decreeDraft; delete old.decreeWorkspaceOpen;
legacy.localStorage.setItem(CORE_KEY, JSON.stringify(old)); legacy.node("continue-game-btn").click();
assert.equal(legacy.api.getState().decreeDraft, ""); assert.equal(legacy.api.getState().decreeWorkspaceOpen, false);
assert.equal(legacy.api.getState().turn, old.turn, "new UI fields cannot reset an existing game");
console.log("Decree templates, actual costs, capture confirmation, draft persistence and step resume regression passed.");
