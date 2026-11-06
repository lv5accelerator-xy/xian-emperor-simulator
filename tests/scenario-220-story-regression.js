"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { plain, CORE_KEY } = require("./helpers/game-harness");
const { ready, play, signature, actions } = require("./helpers/scenario-220-playthrough");
let groups = 0;
function check(name, test) { test(); groups++; console.log(`PASS: ${name}`); }
function continueRun(run) { const next = ready(run.stores()); next.node("continue-game-btn").click(); next.flush(); return next; }
function snapshots(run) { return plain({ stats: run.api.getState().stats, hidden: run.api.getState().hidden, random: run.api.getState().random, story220: run.api.getState().story220 }); }
function legal(core) { for (const group of [core.stats, core.hidden, core.relations]) for (const value of Object.values(group)) assert.ok(Number.isFinite(value) && value >= 0 && value <= 100); }

check("original first-month edict remains untouched; previews do not resolve nodes or draw RNG", () => {
  const r = ready(); r.api.startNewGame("standard", "yankang_220", { randomSeed: 224 }); r.flush();
  assert.equal(r.api.getCurrentEvent().id, "scenario_220_opening");
  assert.equal(r.api.getCurrentEvent().title, "禅代试表");
  assert.deepEqual(plain(r.api.getCurrentEvent().choices[0].effects), { authority: 8, prestige: 6, security: -7, caoAlert: 10 });
  const before = snapshots(r);
  for (let i = 0; i < 5; i++) { r.api.getCurrentEvent(); r.window.XianScenario220Story.statusHtml(r.api.getState()); r.window.XianScenario220Story.selectEvent(r.api.getState()); }
  assert.deepEqual(snapshots(r), before);
  assert.equal(r.window.XianScenario220Story.buildEvent("story220_council", r.api.getState()), null, "an imported future node cannot bypass its real scheduled month");
});

const routes = {};
check("three distinct real twelve-month routes, four scheduled nodes and normal legacy endings", () => {
  for (const route of ["resist", "preserve", "negotiate"]) {
    const result = play(route); routes[route] = result;
    assert.equal(result.core.turn, 12); assert.equal(result.core.monthlySettledTurn, 12); assert.equal(result.core.ended, true);
    assert.equal(result.core.story220.phase, 4); assert.equal(result.core.story220.completedNormally, true);
    assert.deepEqual(result.trace.filter(item => item.id.startsWith("story220_")).map(item => item.turn), [3, 6, 9, 11]);
    assert.equal(result.run.window.XianScenario220Story.buildAfterword(result.core).direction, route);
    assert.equal(result.core.story220.consequences.length, 4); assert.ok(result.core.story220.consequences.every(item => item.status !== "pending"));
    legal(result.core);
    console.log(JSON.stringify({ route, seed: 224, ending: result.core.ending.title, stats: result.core.stats, hidden: result.core.hidden, actions: result.core.totalActions }));
  }
  assert.ok(routes.preserve.core.stats.authority < routes.resist.core.stats.authority);
  assert.ok(routes.resist.core.stats.security < routes.negotiate.core.stats.security);
  assert.ok(routes.preserve.core.stats.treasury > routes.negotiate.core.stats.treasury);
});

check("earlier choices alter actual delayed support, proponents and available seal routes", () => {
  const a = play("resist", 224, { stopAt: 6 }), b = play("preserve", 224, { stopAt: 6 });
  assert.equal(a.core.story220.consequences[0].id, "petition_network");
  assert.equal(a.core.story220.consequences[0].status, "fulfilled");
  assert.ok(a.core.story220.consequences[0].actual.stats.officials > 0);
  assert.match(a.run.api.getCurrentEvent().text, /私护旧臣|回牍/);
  assert.ok(a.run.api.getCurrentEvent().choices.find(item => item.key === "mandate").disabledReason === "");
  assert.ok(b.run.api.getCurrentEvent().choices.find(item => item.key === "mandate").disabledReason);
  const c = play("preserve", 224, { stopAt: 9 });
  assert.ok(c.run.api.getCurrentEvent().choices.find(item => item.key === "assert").disabledReason);
  assert.equal(c.core.story220.consequences.find(item => item.id === "shrine_register").status, "fulfilled");
  assert.ok(c.core.story220.consequences.find(item => item.id === "shrine_register").actual.stats.security > 0);
  assert.equal(c.run.api.getCurrentEvent().choices.find(item => item.key === "terms").disabledReason, "");
});

check("insufficient support breaks a recorded promise; preview cannot invent support", () => {
  const result = play("resist", 224, { stopAt: 5 }), r = result.run;
  r.replaceCore({ hidden: { ...result.core.hidden, leakRisk: 65 }, relations: { ...result.core.relations, yang_biao: 25 } });
  r.decide(0); r.api.endTurn(); r.flush();
  const core = r.api.getState(), echo = core.story220.consequences[0];
  assert.equal(echo.status, "broken"); assert.ok(echo.actual.stats.security < 0);
  assert.match(r.api.getCurrentEvent().text, /未能成议/);
});

check("double click, stale resolved flag and reload cannot reapply a decision", () => {
  const { run: r } = play("preserve", 224, { stopAt: 3 });
  const button = r.node("event-choices").querySelectorAll("[data-choice-index]")[1];
  button.click(); r.flush(); const once = snapshots(r); button.click(); r.flush(); assert.deepEqual(snapshots(r), once);
  r.replaceCore({ eventResolved: false }); assert.equal(r.api.getState().eventResolved, true);
  const resumed = continueRun(r); assert.deepEqual(snapshots(resumed), once);
  assert.equal(Object.keys(resumed.api.getState().story220.decisions).length, 1);
});

check("all four undecided nodes survive refresh and full-save import", () => {
  for (const turn of [3, 6, 9, 11]) {
    const { run: r } = play("negotiate", 224, { stopAt: turn });
    const event = r.api.getCurrentEvent(), before = snapshots(r), resumed = continueRun(r);
    assert.equal(resumed.api.getCurrentEvent().id, event.id); assert.equal(resumed.api.getState().eventResolved, false);
    assert.deepEqual(snapshots(resumed), before);
    const importer = ready(); assert.ok(importer.api.restoreFullSave(plain(r.api.captureFullSave())));
    const imported = continueRun(importer);
    assert.equal(imported.api.getCurrentEvent().id, event.id); assert.deepEqual(snapshots(imported), before);
  }
});

check("same seed, rules and choices reproduce final state across reload and full import", () => {
  const direct = routes.negotiate;
  const reload = play("negotiate", 224, { ambientRandom: .01, reloadAt: 9, resumeRandom: .75 });
  assert.deepEqual(signature(reload.core), signature(direct.core));
  const midway = play("negotiate", 224, { stopAt: 9 }), importer = ready();
  assert.ok(importer.api.restoreFullSave(plain(midway.run.api.captureFullSave())));
  const restored = continueRun(importer);
  assert.deepEqual(signature(play("negotiate", 224, { run: restored }).core), signature(direct.core));
});

check("interrupted final month resumes once, retaining effects and settlement sources", () => {
  const { run: r } = play("negotiate", 224, { stopAt: 12 });
  r.decide(0); r.flush(); actions(r, "negotiate");
  r.document.addEventListener("xian:month-settled", () => { throw new Error("simulated interruption after final story checkpoint"); });
  assert.throws(() => r.api.endTurn(), /simulated interruption/);
  const interrupted = JSON.parse(r.localStorage.getItem(CORE_KEY));
  assert.equal(interrupted.monthlySettledTurn, 12);
  assert.equal(interrupted.story220.consequences.find(item => item.id === "final_negotiate").status, "fulfilled");
  const resumed = continueRun(r), before = snapshots(resumed);
  resumed.api.endTurn(); resumed.flush();
  assert.deepEqual(resumed.api.getState().stats, before.stats); assert.deepEqual(resumed.api.getState().random, before.random);
  assert.ok(resumed.api.getState().lastSettlement.rows.some(row => row.sources.some(source => source.source.includes("延康主线"))));
  assert.equal(resumed.api.getState().chronicle.filter(item => item.text.includes("延康后续·议事终月核验")).length, 1);
});

check("old and incomplete saves do not fabricate earlier decisions or deadlock the next month", () => {
  const { run: r, core } = play("preserve", 224, { stopAt: 7 });
  const old = { ...core }; delete old.story220;
  r.localStorage.setItem(CORE_KEY, JSON.stringify(old)); r.node("continue-game-btn").click(); r.flush();
  assert.deepEqual(plain(r.api.getState().story220.decisions), {}); assert.equal(r.api.getState().story220.entryTurn, 7);
  while (!r.api.getState().ended) {
    const event = r.api.getCurrentEvent();
    const preferred = event.choices.findIndex(item => ["concede", "preserve"].includes(item.key) && !item.disabledReason);
    r.decide(preferred >= 0 ? preferred : event.choices.findIndex(item => !item.disabledReason));
    r.api.endTurn(); r.flush();
  }
  const finished = r.api.getState();
  assert.equal(finished.turn, 12); assert.equal(finished.ended, true);
  assert.ok(!finished.story220.decisions.story220_petition);
  const word = r.window.XianScenario220Story.afterwordText(finished);
  assert.doesNotMatch(word, /许议名分，换取缓期/);
  const broken = { ...core, story220: { version: 1, phase: 99, entryTurn: -3, decisions: { story220_petition: { choice: "<img onerror=alert(1)>", turn: 3, resolved: true } }, consequences: [null] }, currentEventId: "story220_unknown" };
  r.localStorage.setItem(CORE_KEY, JSON.stringify(broken)); r.node("continue-game-btn").click();
  assert.ok(r.api.getCurrentEvent()); assert.equal(r.api.getState().story220.phase, 0);
});

check("fresh start clears story; old normal endings show only demonstrable state", () => {
  const r = continueRun(routes.resist.run);
  r.api.startNewGame("standard", "yankang_220", { randomSeed: 224 }); r.flush();
  assert.equal(r.api.getState().story220.phase, 0); assert.deepEqual(plain(r.api.getState().story220.consequences), []);
  const old = { ...routes.preserve.core }; delete old.story220;
  r.localStorage.setItem(CORE_KEY, JSON.stringify(old)); r.node("continue-game-btn").click();
  assert.match(r.window.XianScenario220Story.afterwordText(r.api.getState()), /旧档没有可证实/);
  assert.doesNotMatch(r.window.XianScenario220Story.afterwordText(r.api.getState()), /天子裁为/);
});

check("four other scenarios preserve openings, fixed turns, random pools and seed progression", () => {
  for (const id of ["zhongping_189", "xingping_195", "jianan_196", "jianan_200"]) {
    const a = ready({}, .99, false), b = ready({}, .99, false);
    b.window.XianScenario220Story = undefined;
    a.api.startNewGame("standard", id, { randomSeed: 88 }); b.api.startNewGame("standard", id, { randomSeed: 88 });
    for (let turn = 0; turn < a.api.getState().maxTurns && !a.api.getState().ended; turn++) {
      assert.equal(a.api.getCurrentEvent().id, b.api.getCurrentEvent().id);
      assert.ok(!a.api.getCurrentEvent().story220);
      a.decide(1); b.decide(1); a.api.endTurn(); b.api.endTurn(); a.flush(); b.flush();
      assert.deepEqual(a.api.getState().stats, b.api.getState().stats); assert.deepEqual(a.api.getState().random, b.api.getState().random);
    }
  }
});

check("curated short/weekly event order, scores and seeded results equal the original rules", () => {
  for (const weekly of [false, true]) {
    const a = ready(), b = ready(); b.window.XianScenario220Story = undefined;
    const definition = plain(a.window.XianShortChallenges.getChallenges().find(item => item.id === "abdication_eve"));
    for (const r of [a, b]) {
      if (weekly) r.window.XianShortChallenges.startCustom({ ...definition, id: "fixed-weekly-220", kind: "weekly", randomSeed: 2026240 });
      else r.window.XianShortChallenges.start("abdication_eve");
      r.flush();
    }
    for (let turn = 0; turn < definition.duration; turn++) {
      assert.equal(a.api.getCurrentEvent().id, definition.sequence[turn]); assert.equal(a.api.getCurrentEvent().id, b.api.getCurrentEvent().id);
      assert.ok(!a.api.getState().story220); a.decide(1); b.decide(1); a.api.endTurn(); b.api.endTurn(); a.flush(); b.flush();
    }
    assert.deepEqual(signature(a.api.getState()), signature(b.api.getState()));
    assert.equal(a.window.XianShortChallenges.getState().results[0].score, b.window.XianShortChallenges.getState().results[0].score);
    assert.equal(a.window.XianScenario220Story.buildAfterword(a.api.getState()), null);
    const importer = ready(); assert.ok(importer.api.restoreFullSave(plain(a.api.captureFullSave())));
    assert.ok(!importer.api.getState().story220, "a full short-save import cannot acquire a main-story record from the previous runtime");
  }
});

check("existing early failures, external endings and path endings keep authority over the story", () => {
  for (const [patch, expected] of [[{ security: 0 }, "深宫幽闭"], [{ caoAlert: 100 }, "密谋败露"], [{ prestige: 0 }, "天下弃汉"]]) {
    const { run: r, core } = play("resist", 224, { stopAt: 5 });
    r.replaceCore({ stats: { ...core.stats, ...patch }, hidden: { ...core.hidden, loyalNetwork: 40 } });
    r.api.applyExternalPackage({}); r.flush();
    assert.equal(r.api.getState().ending.title, expected); assert.equal(r.window.XianScenario220Story.buildAfterword(r.api.getState()), null);
  }
  const { run: r } = play("negotiate", 224, { stopAt: 12 });
  r.window.XianImperialProgress = { getPathEnding: () => ({ title: "方略原终局", text: "沿用现有终局调用。" }) };
  r.decide(1); r.api.endTurn(); r.flush();
  assert.equal(r.api.getState().ending.title, "方略原终局"); assert.ok(r.window.XianScenario220Story.buildAfterword(r.api.getState()));
  const late = play("preserve", 224, { stopAt: 12 }).run, g = late.api.getState();
  late.replaceCore({ monthlySettledTurn: 12, stats: { ...g.stats, security: 0 } });
  late.api.applyExternalPackage({});
  assert.equal(late.api.getState().ending.title, "深宫幽闭");
  assert.equal(late.window.XianScenario220Story.buildAfterword(late.api.getState()), null, "a last-month failure is not normal completion");
});

check("empty treasury always leaves a resolvable main choice; disabled choices cannot execute", () => {
  for (const turn of [3, 6, 9, 11]) {
    const { run: r, core } = play("negotiate", 224, { stopAt: turn });
    r.replaceCore({ stats: { ...core.stats, treasury: 0, officials: 30 } });
    const choices = r.api.getCurrentEvent().choices, blocked = choices.findIndex(item => item.disabledReason), allowed = choices.findIndex(item => !item.disabledReason);
    assert.ok(allowed >= 0); const before = snapshots(r);
    if (blocked >= 0) { r.decide(blocked); assert.deepEqual(snapshots(r), before); }
    r.decide(allowed); assert.equal(r.api.getState().eventResolved, true); legal(r.api.getState());
  }
});

check("afterword cites actual decisions and costs; HTML and imported text are escaped", () => {
  const r = routes.negotiate.run, g = routes.negotiate.core;
  const verdict = r.window.XianFinalVerdict.buildVerdict(g);
  assert.match(verdict.storyAfterword.paragraphs.join("\n"), /私护旧臣，密存异议|交礼权，换宗庙与旧臣名册|援引旧约/);
  assert.match(verdict.storyAfterword.paragraphs.join("\n"), /国库-5/);
  const attack = { ...g, ending: { title: '<img src=x onerror="window.injected=1">', text: "test" } };
  const html = r.window.XianScenario220Story.afterwordHtml(attack);
  assert.doesNotMatch(html, /<img|onerror="/); assert.match(html, /&lt;img/);
  r.localStorage.setItem(CORE_KEY, JSON.stringify(attack)); r.node("continue-game-btn").click();
  assert.doesNotMatch(r.node("story220-afterword").innerHTML, /<img/);
  assert.match(r.node("story220-afterword").innerHTML, /&lt;img/);
  assert.ok(g.story220.promises.every(item => ["fulfilled", "broken"].includes(item.status)));
});
check("retreat needs a real route and costs; absent external reception breaks the sourced plan", () => {
  const { run: r } = play("negotiate", 224, { stopAt: 9 });
  const core = r.api.getState();
  r.replaceCore({ hidden: { ...core.hidden, escapeRoute: 0 } });
  assert.ok(r.api.getCurrentEvent().choices.find(item => item.key === "retreat").disabledReason);
  r.replaceCore({ hidden: { ...core.hidden } });
  const event = r.api.getCurrentEvent(), index = event.choices.findIndex(item => item.key === "retreat");
  assert.equal(event.choices[index].disabledReason, ""); r.decide(index); r.flush();
  assert.equal(r.api.getState().story220.decisions.story220_seal.actual.stats.treasury, -8);
  assert.ok(r.api.getState().hidden.escapeRoute > core.hidden.escapeRoute);
  for (let turn = 9; turn < 11; turn++) {
    if (!r.api.getState().eventResolved) r.decide(1);
    r.api.endTurn(); r.flush();
  }
  assert.equal(r.api.getState().story220.consequences.find(item => item.id === "seal_retreat").status, "broken");
  assert.ok(r.api.getCurrentEvent().choices.find(item => item.key === "retreat").disabledReason);
  assert.match(r.api.getCurrentEvent().text, /未获可靠接应/);
});

check("pure branch construction uses only source records and never calls Math.random", () => {
  const math = Object.create(Math); math.random = () => { throw new Error("preview consumed randomness"); };
  const context = { window: {}, Math: math };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../src/scenario-220-story.js"), "utf8"), context);
  for (const node of context.window.XianScenario220Story.nodes()) {
    const core = { ...routes.negotiate.core, ended: false, turn: node.turn };
    assert.ok(context.window.XianScenario220Story.buildEvent(node.id, core));
    context.window.XianScenario220Story.statusHtml(core);
  }
});
check("deterministic paired policy samples retain costs, risk and non-universal outcomes", () => {
  const seeds = [224, 1, 42, 196220, 2026240, 0xffffffff];
  const report = [];
  for (const route of ["resist", "preserve", "negotiate"]) {
    const runs = seeds.map(seed => play(route, seed, { allowFallback: true }).core);
    for (const core of runs) { assert.ok(core.ended); legal(core); }
    const mean = key => Math.round(runs.reduce((sum, core) => sum + core.stats[key], 0) / runs.length * 10) / 10;
    const entry = { policy: route, seeds, samples: runs.length, twelveMonths: runs.filter(core => core.turn === 12 && core.story220.completedNormally).length,
      stances: Object.fromEntries([...new Set(runs.map(core => core.story220.stance))].map(stance => [stance, runs.filter(core => core.story220.stance === stance).length])),
      authority: mean("authority"), security: mean("security"), treasury: mean("treasury"),
      brokenPromises: runs.reduce((sum, core) => sum + core.story220.promises.filter(item => item.status === "broken").length, 0) };
    report.push(entry); console.log(JSON.stringify(entry));
  }
  assert.ok(report[0].authority > report[1].authority && report[0].security < report[1].security, "resistance needs a measurable safety tradeoff");
  assert.ok(report[1].treasury > report[2].treasury, "negotiation invests resources beyond passive preservation");
  assert.ok(report[0].stances.resist && report[2].stances.negotiate, "supported political routes must remain achievable");
});
console.log(`Scenario 220 story regression passed: ${groups} groups; 3 complete routes plus compatibility, interruption and import controls.`);
