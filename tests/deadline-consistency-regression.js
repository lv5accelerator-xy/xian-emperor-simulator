"use strict";
const assert = require("node:assert/strict");
const { harness, plain } = require("./helpers/game-harness");
const KEY = "xian_emperor_quarterly_agenda_v2100";
for (const [id, duration] of [["abdication_eve", 4], ["xudu_mutiny", 5], ["white_horse", 6]]) {
  const run = harness(); run.window.XianShortChallenges.start(id);
  run.replaceCore({ turn: duration - 1, eventResolved: true });
  run.mount("quarterly-agenda");
  const agenda = run.window.XianQuarterlyAgenda;
  assert.equal(agenda.getState().offers.length, 0, `${id}: two remaining months cannot offer a full quarter`);
  assert.match(run.node("quarterly-agenda-panel").innerHTML, /最终目标/);
}
{
  const run = harness(); run.api.startNewGame();
  run.replaceCore({ turn: run.api.getState().maxTurns - 1 }); run.mount("quarterly-agenda");
  assert.equal(run.window.XianQuarterlyAgenda.getState().offers.length, 0, "ordinary final two months share the deadline rule");
}
{
  const run = harness(); run.window.XianShortChallenges.start("xudu_mutiny");
  run.replaceCore({ turn: 3, eventResolved: true }); run.mount("quarterly-agenda");
  const agenda = run.window.XianQuarterlyAgenda;
  assert.equal(agenda.getState().offers.length, 3, "exactly three remaining months can start a quarter");
  assert.equal(agenda.selectAgenda(agenda.getState().offers[0]), true);
  assert.equal(agenda.getState().active.endTurn, 5);
  run.replaceCore({ turn: 5, eventResolved: true }); run.api.endTurn();
  assert.equal(agenda.getState().active, null, "normal final settlement cannot leave an active quarter");
  assert.equal(agenda.getState().history.length, 1);
}
{
  const run = harness(); run.window.XianShortChallenges.start("abdication_eve");
  run.replaceCore({ turn: 4, eventResolved: true });
  const core = run.api.getState();
  run.localStorage.setItem(KEY, JSON.stringify({ gameCreatedAt: core.createdAt, cycle: 2,
    active: { id: "restore_treasury", startTurn: 4, endTurn: 6, baseline: 100, peopleBaseline: 100 }, history: [] }));
  run.mount("quarterly-agenda");
  const before = plain(run.api.getState());
  run.api.concludeExternalEnding({ title: "期限结束", text: "旧档越界御题终局归档" });
  const after = run.api.getState(), agenda = run.window.XianQuarterlyAgenda.getState();
  assert.equal(agenda.active, null, "legacy overrun quarter is archived on campaign conclusion");
  assert.equal(agenda.history[0].endReason, "campaign-ended");
  assert.equal(agenda.history[0].scheduledEndTurn, 6);
  assert.equal(agenda.history[0].endTurn, 4);
  assert.deepEqual(plain(after.stats), before.stats, "unplayed months never incur a quarter failure fee");
  run.document.dispatchEvent({ type: "xian:campaign-concluded", detail: { state: after } });
  assert.equal(run.window.XianQuarterlyAgenda.getState().history.length, 1, "duplicate conclusion is harmless");
}
console.log("Deadline consistency: 4/5/6 month short runs, ordinary end, exact quarter, legacy archive and duplicate conclusion passed.");
