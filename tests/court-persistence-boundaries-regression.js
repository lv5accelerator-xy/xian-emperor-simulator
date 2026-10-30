"use strict";
const assert = require("node:assert/strict");
const { harness, plain, CORE_KEY } = require("./helpers/game-harness");
const ECHO = "xian_emperor_regional_echoes_v2120";
const ARMY = "xian_emperor_armies_v050";
const emit = (h, type, detail) => h.document.dispatchEvent({ type, detail });
const tests = [];
const test = (name, handler) => tests.push([name, handler]);
function start() { const h = harness(); h.api.startNewGame("standard", "jianan_196", { randomSeed: 244 }); return h; }
function regionFixture(treasury, kind = "battle_scars") {
  const h = start(); h.loadEngine();
  h.replaceCore({ stats: { ...h.api.getState().stats, treasury } });
  const echo = { id: "boundary-echo", cityId: "luoyang", cityName: "洛阳", kind, phase: "decision", title: "余波", text: "测试实际善后", createdTurn: 1, dueTurn: 2, severity: 20 };
  h.localStorage.setItem(ECHO, JSON.stringify({ version: 2, gameCreatedAt: h.api.getState().createdAt, echoes: [echo], history: [], processed: ["boundary-source"] }));
  h.mount("regional-echoes");
  return h;
}
for (const [kind, option, cost] of [["battle_scars", "relief", 3], ["new_rule", "garrison", 2], ["lost_city", "receive", 2]]) {
  test(`A5 regional ${kind} 0/cost-1/cost and replay`, () => {
    for (const treasury of [0, cost - 1, cost]) {
      const h = regionFixture(treasury, kind), api = h.window.XianRegionalEchoes;
      const preview = api.previewResolution(api.getState().echoes[0], option);
      assert.equal(preview.budget.cost, cost); assert.equal(preview.budget.ok, treasury >= cost);
      const before = h.stores(); const core = h.api.getState();
      assert.equal(api.resolveEcho("boundary-echo", option), treasury >= cost);
      if (treasury < cost) { assert.deepEqual(h.stores(), before, "rejection cannot mutate any persisted system"); assert.deepEqual(h.api.getState(), core); }
      else {
        assert.equal(h.api.getState().stats.treasury, 0); assert.equal(api.getState().echoes[0].phase, "watch");
        assert.equal(api.getState().resolutionReceipts["boundary-echo"].cost, cost);
        const success = h.stores(); assert.equal(api.resolveEcho("boundary-echo", option), false); assert.deepEqual(h.stores(), success);
      }
    }
  });
}
test("A5 preview budget change and ended reject preserve pending, world and RNG", () => {
  for (const ended of [false, true]) {
    const h = regionFixture(3), api = h.window.XianRegionalEchoes;
    assert.equal(api.previewResolution(api.getState().echoes[0], "relief").budget.ok, true);
    h.replaceCore({ ended, stats: { ...h.api.getState().stats, treasury: ended ? 3 : 2 } });
    const before = h.stores(); const core = h.api.getState();
    assert.equal(api.resolveEcho("boundary-echo", "relief"), false);
    assert.deepEqual(h.stores(), before); assert.deepEqual(h.api.getState(), core);
    assert.equal(api.getState().echoes[0].phase, "decision");
  }
});
test("A6 event receipt remains after more than 80 events and persisted restore", () => {
  let h = start(); h.mount("causal-court");
  const battle = { id: "old-court-battle", turn: 1, cityId: "luoyang", attackerOwner: "court", defenderOwner: "cao", victor: "court", attackerLosses: 100, defenderLosses: 200 };
  emit(h, "xian:battle-report", battle);
  for (let i = 0; i < 90; i++) emit(h, "xian:decree-world-impact", { id: `impact-${i}`, turn: 1, title: "州郡来报" });
  h = harness(h.stores()); h.node("continue-game-btn").click(); h.mount("causal-court");
  const before = h.api.getState(); emit(h, "xian:battle-report", battle);
  assert.equal(h.api.getState().causality.metrics.courtBattles, 1, "historic receipt cannot expire with UI history");
  assert.deepEqual(h.api.getState(), before, "replay must not add count, debt or package");
});
test("A6 legacy counts migrate only from participant evidence", () => {
  const source = start(); const core = source.api.getState();
  delete core.causality.metrics.courtBattles;
  core.causality.metrics.battles = 3;
  core.causality.history = [
    { id: "historical-court", type: "battle", turn: 1, participants: ["court", "cao"] },
    { id: "historical-warlord", type: "battle", turn: 1, participants: ["yuan", "cao"] },
    { id: "historical-unknown", type: "battle", turn: 1, text: "汉军得胜的修辞不能替代参与方字段" },
  ];
  core.causality.processedEventIds = ["historical-court", "historical-warlord", "historical-unknown"];
  core.causality.pending = ["historical-court", "historical-warlord", "historical-unknown"].map(id => ({ id: `war-debt-${id}`, kind: "war_debt", dueTurn: 2, source: id }));
  let h = harness({ [CORE_KEY]: JSON.stringify(core) }); h.node("continue-game-btn").click(); h.mount("causal-court");
  assert.equal(h.api.getState().causality.metrics.courtBattles, 1, "only one recorded participant set contains court");
  assert.equal(h.api.getState().causality.pending.filter(item => item.kind === "war_debt").length, 1);
  const migrated = h.api.getState(); h = harness(h.stores()); h.node("continue-game-btn").click(); h.mount("causal-court");
  assert.equal(h.api.getState().causality.metrics.courtBattles, 1); assert.deepEqual(h.api.getState().stats, migrated.stats);
});
test("regional simultaneous delayed conclusions persist every completed echo", () => {
  const h = regionFixture(30), api = h.window.XianRegionalEchoes;
  const regional = api.getState();
  regional.echoes = ["luoyang", "xudu"].map((cityId, index) => ({ ...regional.echoes[0], id: `delayed-${index}`, cityId,
    phase: "watch", choice: "relief", choiceLabel: "抚恤修道", dueTurn: 1 }));
  h.localStorage.setItem(ECHO, JSON.stringify(regional)); api.syncFromCore();
  emit(h, "xian:before-month-end", { turn: 1, createdAt: h.api.getState().createdAt });
  assert.ok(api.getState().echoes.every(item => item.phase === "resolved"), "nested core saves must not replace later pending object references");
  const before = h.stores(); emit(h, "xian:before-month-end", { turn: 1, createdAt: h.api.getState().createdAt });
  assert.deepEqual(h.stores(), before, "delayed conclusions remain one-time");
});
test("A6 army evidence excludes duplicate, future and foreign reports without RNG draws", () => {
  for (const sameIdentity of [true, false]) {
    const source = start(), core = source.api.getState();
    core.causality.history = [{ id: "known-court", type: "battle", turn: 1, participants: ["court", "cao"] }];
    core.causality.metrics.courtBattles = 0;
    delete core.causality.participationVersion;
    const army = { gameCreatedAt: sameIdentity ? core.createdAt : "another-game", battleReports: [
      { id: "known-court", turn: 1, attackerOwner: "court", defenderOwner: "cao" },
      { id: "army-evidence", turn: 1, attackerOwner: "yuan", defenderOwner: "court" },
      { id: "future-report", turn: 3, attackerOwner: "court", defenderOwner: "cao" },
      { id: "unsupported-victor", turn: 1, victor: "court" },
    ] };
    const h = harness({ [CORE_KEY]: JSON.stringify(core), [ARMY]: JSON.stringify(army) });
    h.node("continue-game-btn").click(); h.mount("causal-court");
    assert.equal(h.api.getState().causality.metrics.courtBattles, sameIdentity ? 2 : 1);
    assert.deepEqual(h.api.getState().random, core.random);
    assert.deepEqual(h.api.getState().stats, core.stats);
    assert.ok(!h.api.getState().causality.processedEventIds.includes("future-report"));
  }
});
let failed = 0;
for (const [name, fn] of tests) { try { fn(); console.log(`PASS ${name}`); } catch (error) { failed++; console.error(`FAIL ${name}: ${error.stack}`); } }
console.log(`${tests.length - failed}/${tests.length} persistence boundary groups passed`);
if (failed) process.exitCode = 1;
