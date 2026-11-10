"use strict";
const assert = require("node:assert/strict");
const { plain } = require("./helpers/game-harness");
const { prepare, choose } = require("./diplomatic-ending-regression");
const { alliedFixture, seal } = require("./alliance-coalition-regression");
const { resume, month, CORE, ARMY, STRATEGY } = require("./lord-command-chain-regression");
const view = h => plain(h.window.XianDiplomaticEndings.preview(h.api.getState()));
let groups = 0;
function check(name, run) { run(); groups++; console.log(`PASS diplomatic evidence ${name}`); }
check("paper, lone attacker and remote supporter earn no joint victory", () => {
  for (const mode of ["paper", "partial", "remote"]) {
    const h = alliedFixture(({a}) => { if (mode === "partial") a.armies.youzhou_cavalry.supply = 5;
      if (mode === "remote") Object.assign(a.armies.youzhou_cavalry, { cityId: "chengdu", originCityId: "chengdu", targetCityId: "chengdu" }); });
    seal(h); if (mode !== "paper") { month(h); month(h); }
    assert.equal(view(h).counts.jointVictories, 0, mode);
    assert.equal(view(h).eligibility.confederation.eligible, false, mode);
  }
});
check("only a real winning coalition earns battle credit after reports are clipped", () => {
  for (const troops of [1500,60000]) {
    const h = alliedFixture(({a}) => Object.assign(a.armies.jingzhou_navy, { troops, maxTroops: troops, cityId: "jinyang", targetCityId: "jinyang",
      status: "defending", task: "defend", supply: 100, morale: 100, fatigue: 0 }));
    seal(h); month(h);
    const a = h.window.XianArmySystem.getState(), fact = a.militaryFacts.find(f => f.kind === "battle");
    assert.ok(fact?.participants?.length >= 3); assert.ok(fact.participants.every(p => p.orderId || p.owner === "liu_biao"));
    const report = a.battleReports.find(r => r.id === fact.source); assert.equal(fact.victor, report.victor);
    const victories = view(h).counts.jointVictories;
    assert.equal(victories, ["yuan_shao","gongsun_zan"].includes(report.victor) ? 1 : 0);
    if (troops === 1500) assert.equal(victories, 1); else assert.equal(victories, 0);
    const b = plain(h.api.captureFullSave()); b.stores[ARMY].battleReports = []; delete b.stores[STRATEGY].allianceDiplomacy.outcomeEvidence;
    assert.equal(view(resume(b)).counts.jointVictories, victories);
  }
});
check("rich v228 occupation needs the matching physical siege witness", () => {
  const b = plain(prepare("cooperate").api.captureFullSave());
  delete b.stores[STRATEGY].allianceDiplomacy.outcomeEvidence;
  for (const f of b.stores[ARMY].militaryFacts) if (f.kind === "occupation") delete f.participants;
  b.stores[CORE].rulesVersion = 228;
  const restored = resume(b); assert.ok(view(restored).counts.jointCaptures >= 1);
  const missing = plain(b); missing.stores[ARMY].militaryFacts = missing.stores[ARMY].militaryFacts.filter(f => f.kind !== "siege-progress");
  assert.equal(view(resume(missing)).counts.jointVictories, 0, "current city ownership and old plans cannot invent participation");
});
check("confirmed results survive clipped display histories", () => {
  const h = prepare("cooperate"), before = view(h), b = plain(h.api.captureFullSave());
  Object.assign(b.stores[ARMY], { militaryFacts: [], orders: [], commandResponses: [], battleReports: [] });
  b.stores[STRATEGY].promises = b.stores[STRATEGY].promises.filter(p => p.status === "active");
  b.stores[STRATEGY].allianceDiplomacy.plans = [];
  const restored = resume(b); assert.equal(view(restored).counts.jointCaptures, before.counts.jointCaptures);
  assert.equal(view(restored).counts.fulfilledAlliances, before.counts.fulfilledAlliances);
  assert.deepEqual(view(restored).sourceEvidence, before.sourceEvidence);
});
check("unknown old observations never become fulfilled or newly blamed", () => {
  const b = plain(prepare("cooperate").api.captureFullSave()), s = b.stores[STRATEGY];
  delete s.allianceDiplomacy.outcomeEvidence;
  for (const p of s.promises) if (p.type === "alliance") { p.contract.receipts = p.contract.receipts.filter(r => r.kind !== "peace-observed"); p.contract.missingHistoricalObservation = true; }
  const v = view(resume(b)); assert.equal(v.counts.fulfilledAlliances, 0); assert.equal(v.counts.courtBreaches, 0);
  assert.equal(v.coverage, "partial"); assert.equal(v.eligibility.confederation.eligible, false);
});
check("autonomous betrayal is the lord's responsibility", () => {
  const h = alliedFixture(); seal(h, "令袁绍与公孙瓒结盟");
  const b = plain(h.api.captureFullSave()), s = b.stores[STRATEGY]; s.strategies.yuan_shao.trust = 20;
  let intent; for (let n = 0; n < 80 && !intent; n++) intent = h.window.XianLordIntentions.proposeBatch(b.stores[CORE], s, b.stores[ARMY],
    { lords: { yuan_shao: { expansion: 90, caution: 20 } } }, `betrayal-${n}`).find(i => i.owner === "yuan_shao" && i.betrayalPactId);
  assert.ok(intent); s.commandChain.intents = [intent];
  Object.assign(b.stores[Object.keys(b.stores).find(k => k.includes("world_v"))].lords.yuan_shao, { expansion: 90, caution: 20 });
  const a = resume(b); month(a); const v = view(a);
  assert.equal(v.counts.lordBreaches, 1); assert.equal(v.counts.courtBreaches, 0);
  assert.ok(!v.supporters.some(p => p.id === "yuan_shao"));
});
check("a new signature cannot erase breach; two later observed terms repair it", () => {
  let h = alliedFixture(({c}) => c.maxTurns = 18); seal(h, "令袁绍与公孙瓒结盟");
  assert.equal(h.window.XianArmySystem.issueMapOrder("yuan_main", "ji", "attack").ok, true); month(h); choose(h);
  seal(h, "令袁绍与公孙瓒结盟"); assert.equal(view(h).counts.unresolvedCourtBreaches, 1);
  while (h.api.getState().turn < 7) month(h);
  assert.equal(view(h).counts.repairedBreaches, 0); choose(h); seal(h, "令袁绍与公孙瓒结盟");
  while (h.api.getState().turn < 12) month(h);
  const v = view(h); assert.equal(v.counts.repairedBreaches, 1); assert.equal(v.counts.unresolvedCourtBreaches, 0);
  assert.equal(v.counts.courtBreaches, 1); assert.equal(v.sourceEvidence.breachIds.length, 1);
  const restored = resume(plain(h.api.captureFullSave())); assert.deepEqual(view(restored), v);
});
check("mediation requires an actual stopped attack and its full observation", () => {
  for (const attack of [false, true]) {
    const h = alliedFixture();
    if (attack) assert.equal(h.window.XianArmySystem.issueMapOrder("yuan_main", "ji", "attack").ok, true);
    h.edict("令袁绍与公孙瓒停战");
    assert.equal(view(h).eligibility.mediation.eligible, false, "a new stop order is not yet fulfilled");
    for (let n = 0; n < 5; n++) month(h);
    const v = view(h); assert.equal(v.counts.observedCeasefires, attack ? 1 : 0);
    assert.equal(v.eligibility.mediation.eligible, attack);
  }
});
check("final covered month can contribute both fulfillment and endorsement", () => {
  const h = alliedFixture(({c,s}) => { c.maxTurns = 5; s.cities.jinyang.defense = 5; s.cities.jinyang.supply = 1; }); seal(h);
  h.window.XianStrategyNetwork.interveneCoalition(h.window.XianStrategyNetwork.getState().allianceDiplomacy.plans[0].id, "coordinate");
  for (let n = 0; n < 5; n++) month(h);
  const v = h.api.getState().diplomaticOutcome; assert.equal(v.counts.fulfilledAlliances, 1); assert.equal(v.counts.reliableSupporters, 2);
  assert.equal(v.eligibility.confederation.eligible, true);
});
check("final-month court attack blocks common allegiance before snapshot", () => {
  const h = prepare("cooperate"), army = h.window.XianArmySystem, p = army.previewMapOrder("yuan_main", "ji", "attack");
  assert.equal(p.ok, true); assert.equal(army.issueMapOrder("yuan_main", "ji", "attack", { replaceExisting: true, expectedOrderId: p.expectedOrderId }).ok, true);
  h.api.endTurn(); assert.equal(h.api.getState().ending.title, "盟约离心"); assert.equal(h.api.getState().diplomaticOutcome.counts.unresolvedCourtBreaches, 1);
});
check("positive path, central external gate and frozen verdict use the same evidence", () => {
  const h = prepare("cooperate"), c = h.api.getState();
  h.localStorage.setItem("xian_emperor_progression_v100", JSON.stringify({ version: 1, profile: {}, session: { gameCreatedAt: c.createdAt, pathId: "balance", pathStage: 3 } }));
  h.load("imperial-progress-data", "imperial-progress", "final-verdict");
  assert.equal(h.window.XianImperialProgress.getPathEnding(c).title, "天下共奉"); h.api.endTurn();
  assert.equal(h.api.getState().ending.title, "天下共奉");
  const verdict = h.window.XianFinalVerdict.getState().verdicts[0]; assert.deepEqual(plain(verdict.diplomaticOutcome), plain(h.api.getState().diplomaticOutcome));
  const bad = prepare("betray"); bad.load("final-verdict"); bad.api.concludeExternalEnding({ title: "天下共奉", text: "不应绕过凭据" });
  assert.equal(bad.api.getState().ending.title, "盟约离心");
  const v = bad.window.XianFinalVerdict.getState().verdicts[0]; assert.ok(v.dimensions.find(d => d.id === "balance").score <= 40);
  assert.match(v.finalComment, /朝廷授意背盟尚有1宗未修复/);
  assert.notEqual(v.posthumous, "和");
});
check("preview ignores foreign stores and escapes source identities", () => {
  const h = prepare("cooperate"), before = h.stores(), c = h.api.getState();
  const missing = h.window.XianDiplomaticEndings.preview(c, { strategy: { gameCreatedAt: "foreign" }, armies: { gameCreatedAt: "foreign" } });
  assert.equal(missing.coverage, "missing"); assert.equal(missing.rating, null); assert.equal(missing.eligibility.confederation.eligible, false);
  const v = view(h); v.supporters[0].name = '<img src=x onerror="boom">'; v.sourceEvidence.pactIds.push("<script>boom</script>");
  const html = h.window.XianDiplomaticEndings.render(v); assert.ok(!html.includes("<img")); assert.ok(!html.includes("<script>"));
  assert.deepEqual(h.stores(), before);
});
console.log(`Diplomatic evidence passed: ${groups} groups.`);
