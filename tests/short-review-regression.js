"use strict";
const assert = require("node:assert/strict");
const { harness, plain } = require("./helpers/game-harness");
const SHORT_KEY = "xian_emperor_short_challenges_v230";

function finish(run) {
  while (!run.api.getState().ended) {
    if (!run.api.getState().eventResolved) run.decide(1);
    run.api.endTurn(); run.flush();
  }
  return plain(run.window.XianShortChallenges.getState().results[0]);
}

// Real choices and receipts remain available after the core's report window drops them.
const run = harness();
run.window.XianShortChallenges.start("xudu_mutiny");
const initial = plain(run.api.getState());
run.decide(1);
run.edict("命许都开仓赈济，安置流民。");
let log = plain(run.window.XianShortChallenges.getState().active.reviewLog);
assert.equal(log.fromStart, true);
assert.equal(log.baseline.stats.security, initial.stats.security);
assert.equal(log.receipts.length, 2, "one decision and one edict must be recorded exactly once");
assert.equal(log.receipts[0].choice, "接受统一宿卫，另设内廷值班");
assert.equal(log.receipts[0].changes.find(item => item.path === "stats.security").delta, 7);
assert.equal(log.receipts[1].changes.find(item => item.path === "stats.treasury").delta, -7);
const checkpoint = run.stores();
const reloaded = harness(checkpoint, .25); reloaded.node("continue-game-btn").click();
assert.deepEqual(plain(reloaded.window.XianShortChallenges.getState().active.reviewLog), log, "reload must preserve already captured choices without duplication");
assert.equal(reloaded.api.getState().actionPoints, 1, "review restoration cannot spend an action");
run.replaceCore({ reports: [] });
assert.equal(run.window.XianShortChallenges.getState().active.reviewLog.receipts.length, 2, "review must retain choices no longer in the core report window");
const result = finish(run);
assert.equal(result.rulesVersion, 216, "display-only reviews cannot discard existing best scores");
assert.equal(result.review.months.length, 5);
assert.equal(result.review.goals.length, 3);
for (const goal of result.review.goals) {
  const [group, key] = goal.path.split(".");
  assert.equal(goal.value, run.api.getState()[group][key], "review must use the final settled value");
  assert.equal(goal.change, goal.value - initial[group][key]);
}
assert.ok(result.review.moments.some(item => item.choice === "接受统一宿卫，另设内廷值班"));
assert.equal(result.review.months[0].changes.find(item => item.path === "stats.security").before, 44);
assert.equal(result.review.months.at(-1).changes.find(item => item.path === "stats.security").after, run.api.getState().stats.security);
assert.match(run.node("short-ending-review").innerHTML, /本局复盘/);
assert.match(run.node("ending-stats").innerHTML, /乱世短局 · 许都夜变/);
assert.doesNotMatch(run.node("ending-stats").innerHTML, /许都自立/, "short endings should identify the actual short-run goals");
const settledResult = plain(result);
run.api.endTurn(); run.flush();
assert.equal(run.window.XianShortChallenges.getState().results.length, 1);
assert.deepEqual(plain(run.window.XianShortChallenges.getState().results[0]), settledResult, "viewing a completed result must not regrade it");
const endedReload = harness(run.stores()); endedReload.node("continue-game-btn").click();
assert.equal(endedReload.node("short-ending-review").hidden, false, "ending review must restore synchronously on continue");
assert.equal(endedReload.node("short-ending-review").innerHTML, run.node("short-ending-review").innerHTML);
assert.equal(endedReload.window.XianShortChallenges.getState().results.length, 1);
assert.match(endedReload.window.XianShortChallenges.formatReviewText(endedReload.api.getState()), /逐月净变化/);

const importing = harness();
const envelope = { format: "xian-emperor-full-save", stores: Object.fromEntries(Object.entries(checkpoint).map(([key, value]) => [key, JSON.parse(value)])) };
importing.node("import-file").dispatchEvent({ type: "change", target: { value: "save.json", files: [{ text: JSON.stringify(envelope) }] } });
const imported = harness(importing.stores()); imported.node("continue-game-btn").click();
assert.deepEqual(plain(imported.window.XianShortChallenges.getState().active.reviewLog), plain(reloaded.window.XianShortChallenges.getState().active.reviewLog), "full save import must preserve the same review log");

// Retry uses the existing real start path, preserves history and resets only the active run.
const oldCreatedAt = endedReload.api.getState().createdAt;
endedReload.node("short-ending-review").querySelector("[data-short-retry]").click();
assert.equal(endedReload.api.getState().ended, false);
assert.equal(endedReload.api.getState().turn, 1);
assert.notEqual(endedReload.api.getState().createdAt, oldCreatedAt);
assert.equal(endedReload.window.XianShortChallenges.getState().active.challengeId, "xudu_mutiny");
assert.equal(endedReload.window.XianShortChallenges.getState().active.reviewLog.receipts.length, 0);
assert.equal(endedReload.window.XianShortChallenges.getState().results.length, 1);

// Last-month costs create a real one-point deficit; action receipts are not a substitute for monthly net change.
const fiscal = harness(); fiscal.window.XianShortChallenges.start("white_horse");
let core = fiscal.api.getState();
fiscal.replaceCore({ turn: 6, eventResolved: true, actionPoints: 0, stats: { ...core.stats, authority: 40, treasury: 25, caoAlert: 60 }, hidden: { ...core.hidden, leakRisk: 0 } });
fiscal.api.endTurn();
const fiscalResult = plain(fiscal.window.XianShortChallenges.getState().results[0]);
const treasury = fiscalResult.review.goals.find(item => item.path === "stats.treasury");
assert.equal(treasury.value, 24); assert.equal(treasury.gap, 1); assert.equal(treasury.passed, false);
assert.equal(fiscalResult.review.months.at(-1).changes.find(item => item.path === "stats.treasury").delta, -1);
assert.match(fiscal.node("short-ending-review").innerHTML, /国库≥25 · 终值 24 · 尚差 1/);
assert.match(fiscal.node("short-ending-review").innerHTML, /筹措钱粮/);

// A quarter-end reward must also be visible in the review's terminal-month net changes.
const quarter = harness(); quarter.window.XianShortChallenges.start("white_horse"); core = quarter.api.getState();
quarter.replaceCore({ turn: 4, eventResolved: true, actionPoints: 0, stats: { ...core.stats, treasury: 12 }, hidden: { ...core.hidden, leakRisk: 0 } });
quarter.load("quarterly-agenda"); quarter.window.XianQuarterlyAgenda.refresh();
assert.equal(quarter.window.XianQuarterlyAgenda.selectAgenda("restore_treasury"), true);
core = quarter.api.getState(); quarter.replaceCore({ turn: 6, eventResolved: true, actionPoints: 0, stats: { ...core.stats, treasury: 25, authority: 40, caoAlert: 60 } });
quarter.api.endTurn();
const qr = quarter.window.XianShortChallenges.getState().results[0].review;
assert.equal(qr.goals.find(item => item.path === "stats.treasury").value, quarter.api.getState().stats.treasury);
assert.equal(qr.months.at(-1).changes.find(item => item.path === "stats.treasury").after, quarter.api.getState().stats.treasury);

// Immediate replies update the same receipt instead of producing duplicate causes.
const reply = harness(); reply.window.XianShortChallenges.start("white_horse"); reply.decide(1);
reply.document.addEventListener("xian:external-action-completed", () => reply.api.applyExternalPackage({ effects: { treasury: 1 } }));
reply.api.performExternalAction({ title: "度支", text: "核减用度", effects: { treasury: -3 } });
log = reply.window.XianShortChallenges.getState().active.reviewLog;
assert.equal(log.receipts.filter(item => item.title === "度支").length, 1);
assert.equal(log.receipts.find(item => item.title === "度支").changes.find(item => item.path === "stats.treasury").delta, -2);

// Early termination must explain the actual ending and never award a medal for partial goals.
const early = harness({}, 0); early.window.XianShortChallenges.start("xudu_mutiny"); core = early.api.getState();
early.replaceCore({ eventResolved: true, actionPoints: 0, stats: { ...core.stats, security: 2 }, hidden: { ...core.hidden, leakRisk: 90 } });
early.api.endTurn();
const er = early.window.XianShortChallenges.getState().results[0];
assert.equal(er.endedEarly, true); assert.equal(er.medal, "none");
assert.equal(er.review.endingTitle, "深宫幽闭"); assert.equal(er.review.months.length, 0);
assert.match(early.node("short-ending-review").innerHTML, /部分指标达标也不授章/);
assert.equal(er.review.advice[0].heading, "先避免提前终局");
assert.match(early.window.XianShortReview.brief(er.review).text, /深宫幽闭/);
assert.doesNotMatch(early.window.XianShortReview.brief(er.review).text, /首次记录的跌出/);

// Old in-progress and completed saves remain readable without inventing a full-run baseline.
const legacyStores = { ...checkpoint };
const oldShort = JSON.parse(legacyStores[SHORT_KEY]); delete oldShort.active.reviewLog;
legacyStores[SHORT_KEY] = JSON.stringify(oldShort);
const legacy = harness(legacyStores); legacy.node("continue-game-btn").click();
assert.equal(legacy.window.XianShortChallenges.getState().active.reviewLog.fromStart, false);
const legacyResult = finish(legacy);
assert.equal(legacyResult.review.goals[0].start, null);
assert.equal(legacyResult.review.months[0].partial, true);
assert.match(legacy.node("short-ending-review").innerHTML, /未记录的开局值与月份不作推断/);
const oldEndedStores = run.stores(); const oldEnded = JSON.parse(oldEndedStores[SHORT_KEY]); delete oldEnded.results[0].review;
oldEndedStores[SHORT_KEY] = JSON.stringify(oldEnded);
const oldResult = harness(oldEndedStores); oldResult.node("continue-game-btn").click();
assert.match(oldResult.node("short-ending-review").innerHTML, /开局值未记录/);
assert.equal(oldResult.window.XianShortChallenges.getState().results[0].medal, result.medal);

// Weekly retry preserves its share-code seed, and pure review building cannot draw randomness or consume resources.
const weekly = harness({}, .13);
const definition = weekly.window.XianWeeklyChallenge.buildDefinition(weekly.window.XianWeeklyChallenge.codeForWeek("2026W41"));
weekly.window.XianShortChallenges.startCustom(definition);
const before = plain(weekly.api.getState());
const previewGrade = weekly.window.XianShortChallenges.evaluateChallenge(definition, before);
const preview = weekly.window.XianShortReview.build({ ...previewGrade, name: definition.name, endedEarly: false }, definition, before, weekly.window.XianShortChallenges.getState().active.reviewLog);
weekly.window.XianShortReview.html(preview); weekly.window.XianShortReview.text(preview);
assert.deepEqual(plain(weekly.api.getState()), before);
finish(weekly);
weekly.node("short-ending-review").querySelector("[data-short-retry]").click();
assert.equal(weekly.api.getState().random.seed, definition.randomSeed);
assert.equal(weekly.api.getState().random.draws, before.random.draws);

// Text from imported histories is escaped in the review UI.
const unsafe = plain(result.review);
unsafe.endingTitle = '<img src=x onerror="alert(1)">'; unsafe.endedEarly = true;
unsafe.goals[0].label = "<script>bad()</script>";
unsafe.moments[0].title = "<svg onload=bad()>";
const escaped = run.window.XianShortReview.html(unsafe);
assert.doesNotMatch(escaped, /<script>|<svg|<img/);
assert.match(escaped, /&lt;script&gt;/);

console.log("Short review regression passed: settled deficits, receipts, quarterly rewards, early endings, retry, old saves, reload and seeded challenges.");
