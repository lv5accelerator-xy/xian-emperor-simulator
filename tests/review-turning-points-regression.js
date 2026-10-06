"use strict";
const assert = require("node:assert/strict");
const { harness, plain } = require("./helpers/game-harness");
const sum = breakdown => breakdown.before + breakdown.decisions + breakdown.actions + breakdown.otherDuringMonth + breakdown.sources.reduce((total, item) => total + item.delta, 0);

// A genuine fixed monthly cost crosses the final treasury target and supplies the actual cause.
const fiscal = harness(); fiscal.window.XianShortChallenges.start("white_horse");
const initial = fiscal.api.getState();
fiscal.replaceCore({ turn: 6, eventResolved: true, actionPoints: 0, stats: { ...initial.stats, authority: 40, treasury: 25, caoAlert: 60 }, hidden: { ...initial.hidden, leakRisk: 0 } });
fiscal.api.endTurn();
const result = plain(fiscal.window.XianShortChallenges.getState().results[0]);
const point = result.review.turningPoints.find(item => item.path === "stats.treasury");
assert.equal(point.turn, 6); assert.equal(point.before, 25); assert.equal(point.after, 24); assert.equal(point.finalPassed, false);
assert.match(point.source, /固定用度与守成/);
assert.equal(point.breakdown.sources.find(item => item.source === "固定用度与守成").delta, -1);
assert.equal(sum(point.breakdown), point.breakdown.after);
assert.match(fiscal.node("short-ending-review").innerHTML, /目标转折与当月来源/);
const reloaded = harness(fiscal.stores()); reloaded.node("continue-game-btn").click();
assert.deepEqual(plain(reloaded.window.XianShortChallenges.getState().results[0].review.turningPoints), result.review.turningPoints);
assert.match(reloaded.window.XianShortChallenges.formatReviewText(reloaded.api.getState()), /固定用度与守成 -1/);

// Play every month: receipt effects and all sealed monthly sources must reconcile after later feedback.
const played = harness(); played.loadMechanics(); played.window.XianShortChallenges.start("xudu_mutiny"); played.flush();
while (!played.api.getState().ended) {
  played.decide(1); played.flush();
  if (played.api.getState().ended) break;
  played.act("audience", { "modal-character-select": "xun_yu", "audience-mode": "public" }); played.flush();
  played.node("end-turn-btn").click(); played.node("modal-confirm").click(); played.flush();
}
const review = played.window.XianShortChallenges.getState().results[0].review;
assert.equal(review.months.length, 5);
assert.equal(review.effort.complete, true); assert.equal(review.effort.actions, 5);
assert.equal(review.choices.filter(item => item.kind === "decision").length, 5);
assert.ok(review.turningPoints.length > 0);
for (const item of review.turningPoints) { assert.ok(item.breakdown); assert.equal(sum(item.breakdown), item.breakdown.after); }
const goal = review.turningPoints.find(item => item.path === "stats.security");
assert.ok(goal.breakdown.decisions !== 0 || goal.breakdown.actions !== 0);

// Quarterly rewards can restore a goal after a real temporary drop; both sources remain explicit.
const quarter = harness(); quarter.window.XianShortChallenges.start("white_horse"); let core = quarter.api.getState();
quarter.replaceCore({ turn: 4, eventResolved: true, actionPoints: 0, stats: { ...core.stats, treasury: 12 }, hidden: { ...core.hidden, leakRisk: 0 } });
quarter.load("quarterly-agenda"); quarter.window.XianQuarterlyAgenda.refresh();
assert.equal(quarter.window.XianQuarterlyAgenda.selectAgenda("restore_treasury"), true);
core = quarter.api.getState(); quarter.replaceCore({ turn: 6, eventResolved: true, actionPoints: 0, stats: { ...core.stats, treasury: 25, authority: 40, caoAlert: 60 } });
quarter.api.endTurn();
const qp = quarter.window.XianShortChallenges.getState().results[0].review.turningPoints.find(item => item.path === "stats.treasury");
assert.equal(qp.before, 25); assert.equal(qp.after, 24); assert.equal(qp.finalPassed, true);
assert.ok(qp.breakdown.sources.some(item => /季度/.test(item.source) && item.delta > 0));
assert.equal(sum(qp.breakdown), qp.breakdown.after);

// Missing old ledgers stay unknown; imported titles and sources are escaped.
const saved = fiscal.stores(); const shortKey = "xian_emperor_short_challenges_v230";
const old = JSON.parse(saved[shortKey]); delete old.results[0].review.turningPoints; delete old.results[0].review.effort; delete old.results[0].review.choices;
saved[shortKey] = JSON.stringify(old);
const legacy = harness(saved); legacy.node("continue-game-btn").click();
assert.match(legacy.node("short-ending-review").innerHTML, /旧复盘未保存转折来源/);
const unsafe = plain(result.review); const unsafePoint = unsafe.turningPoints.find(item => item.path === "stats.treasury");
unsafePoint.source = '<img src=x onerror="bad()">';
unsafePoint.breakdown.sources[0].source = "<script>bad()</script>";
const html = fiscal.window.XianShortReview.html(unsafe);
assert.doesNotMatch(html, /<img|<script>/); assert.match(html, /&lt;script&gt;/);
console.log("Review turning points passed: actual crossings, receipt/month reconciliation, quarterly recovery, complete play, reload, old records and escaping.");
