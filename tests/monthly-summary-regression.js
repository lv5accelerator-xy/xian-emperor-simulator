"use strict";
const assert = require("node:assert/strict");
const { harness, plain } = require("./helpers/game-harness");

// Run a real month: fixed guarding reaches the target, then an actual army loss drops below it.
const run = harness(); run.mount("monthly-report");
const definition = run.window.XianShortChallenges.getChallenges().find(item => item.id === "xudu_mutiny");
run.window.XianShortChallenges.startCustom({ ...definition, randomSeed: 20261007 }); run.flush(); run.decide(1);
let core = run.api.getState();
run.replaceCore({ actionPoints: 2, stats: { ...core.stats, security: 41, officials: 45, caoAlert: 40 },
  hidden: { ...core.hidden, leakRisk: 0 },
  reports: [...core.reports, { title: "旧警讯", text: "月内已有记录", type: "danger", turn: 1, gameCreatedAt: core.createdAt, timestamp: 1 }],
});
run.flush();
run.window.XianArmySystem = { settleMonth: () => run.api.applyExternalPackage({ effects: { security: -2 },
  report: { title: "军团警讯", text: "<img src=x onerror=alert(1)>宿卫折损", type: "danger" } }) };
run.api.endTurn(); run.flush();
const archived = JSON.parse(run.localStorage.getItem("xian_emperor_monthly_reports_v011")).reports[0];
const monthly = run.window.XianMonthlyReport;
const summary = plain(monthly.summarizeReport(archived));
const security = summary.goals.find(goal => /宫廷安全/.test(goal.label));
assert.equal(security.actual, run.api.getState().lastSettlement.goals.find(goal => goal.path === "stats.security").actual);
assert.equal(security.actual, 41);
assert.equal(security.passed, false);
assert.equal(security.fellOut, true, "use the actual final value, even when fixed preflight passed");
assert.equal(summary.alerts.length, 1);
assert.match(summary.alerts[0], /军团警讯/);
assert.doesNotMatch(summary.alerts.join(""), /旧警讯/, "existing month records are not new month-end alerts");

const saved = run.stores(), state = plain(run.api.getState()), original = plain(archived);
let html;
for (let i = 0; i < 4; i++) { monthly.summarizeReport(archived); html = monthly.buildReportHtml(archived); }
assert.deepEqual(run.stores(), saved, "reading a summary does not save or settle again");
assert.deepEqual(plain(run.api.getState()), state, "summary rendering preserves AP, stats and random progress");
assert.deepEqual(plain(archived), original, "sorting top changes cannot reorder the archived record");
assert.match(html, /结算后跌出目标/);
assert.ok(html.indexOf("本月重点") < html.indexOf("处分与执行评估"));
assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
assert.doesNotMatch(html, /<img src=x/);
assert.equal((html.match(/<details class="monthly-report-details">/g) || []).length, 4, "full records remain available in four closed folds");
assert.doesNotMatch(html, /<details class="monthly-report-details"[^>]*\bopen\b/);
assert.match(html, /预检与实际结算对账/);
assert.match(html, /估计/);

const old = plain(archived); delete old.alerts; delete old.settlement;
assert.equal(monthly.summarizeReport(old).alerts, null);
assert.match(monthly.buildReportHtml(old), /旧月报未单独记录警讯/);
assert.match(monthly.buildReportHtml(old), /本月未记录短局目标/);
const unknown = plain(archived); unknown.settlement.goals[0].actual = null;
assert.equal(monthly.summarizeReport(unknown).goals[0].known, false, "missing actual value is not zero or a failure");
const capped = plain(archived);
capped.statChanges = [
  { key: "security", name: "宫廷安全", before: 99, after: 100, delta: 1 },
  { key: "caoAlert", name: "曹氏警戒", before: 40, after: 47, delta: 7 },
  { key: "treasury", name: "国库", before: 30, after: 26, delta: -4 },
  { key: "authority", name: "皇权", before: 40, after: 40, delta: 0 },
];
const top = monthly.summarizeReport(capped).changes;
assert.deepEqual(Array.from(top, item => item.key), ["caoAlert", "treasury", "security"]);
assert.equal(top[2].delta, 1, "clipped gains remain the actual one-point change");
assert.match(monthly.buildReportHtml(capped), /class="negative"><span>曹氏警戒/);
capped.alerts = []; capped.baselinePartial = true; capped.settlement.partial = true;
assert.match(monthly.buildReportHtml(capped), /载入后关键净变/);
assert.match(monthly.buildReportHtml(capped), /月末对账从固定结算后的续接处开始/);
const monthStart = { ...plain(state), turn: 2, reports: [] };
const monthEnd = plain(monthStart);
monthEnd.reports = [{ title: "月末结算", type: "neutral", turn: 2, gameCreatedAt: monthStart.createdAt,
  timestamp: 123, text: "俸粮与行政经费不足；地方相对安定，汉廷声望回升｜国库-1" }];
const financeAlert = monthly.buildMonthlyReport(monthStart, monthEnd, monthStart);
assert.equal(financeAlert.alerts.length, 1, "recorded fiscal trouble is prominent even in a neutral settlement log");
assert.match(financeAlert.alerts[0], /俸粮/);

// The last month's charge must be present in the displayed goal and match the final grade.
const final = harness(); final.window.XianShortChallenges.start("white_horse");
core = final.api.getState();
final.replaceCore({ turn: 6, eventResolved: true, actionPoints: 0,
  stats: { ...core.stats, treasury: 25, authority: 40, caoAlert: 60 }, hidden: { ...core.hidden, leakRisk: 0 } });
const before = plain(final.api.getState()); final.api.endTurn();
const finalReport = final.window.XianMonthlyReport.buildMonthlyReport(before, final.api.getState(), before);
const treasury = final.window.XianMonthlyReport.summarizeReport(finalReport).goals.find(goal => /国库/.test(goal.label));
const graded = final.window.XianShortChallenges.getState().results[0].checks.find(goal => goal.path === "stats.treasury");
assert.equal(treasury.actual, 24); assert.equal(treasury.actual, graded.value); assert.equal(treasury.passed, graded.passed);
console.log("Monthly brief: actual goals, late losses, final costs, alerts, legacy records, escaping and read-only rendering passed.");
