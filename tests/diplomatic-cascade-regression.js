"use strict";
const assert = require("node:assert/strict");
const { plain } = require("./helpers/game-harness");
const { parallelFixture } = require("./parallel-council-regression");
const { resume, chain, month, CORE, ARMY, STRATEGY } = require("./lord-command-chain-regression");
function convoyFixture() {
  const h = parallelFixture(({ a, s, c }) => {
    a.armies.yuan_main.troops = 0; a.armies.yuan_main.status = "destroyed";
    Object.assign(a.armies.youzhou_cavalry, { troops: 18000, maxTroops: 18000, cityId: "changan", originCityId: "changan" });
    Object.assign(a.armies.jingzhou_navy, { troops: 5000, status: "idle", task: "idle", cityId: "chengdu", originCityId: "chengdu", currentOrderId: null, supply: 90, morale: 90, fatigue: 0 });
    c.relations.liu_biao = 90; s.strategies.liu_biao.trust = 90;
    for (const route of Object.values(s.routes)) Object.assign(route, { supply: 90, pressure: 10, blockadedUntil: 0 });
    s.cities.nanzheng.controller = "zhang_lu";
    s.commandChain.intents = [];
  });
  h.edict("令刘表派援军驰援邺城"); h.edict("令公孙瓒与刘表停战"); month(h);
  const b = plain(h.api.captureFullSave()), c = b.stores[CORE], s = b.stores[STRATEGY], army = b.stores[ARMY].armies.youzhou_cavalry;
  assert.equal(b.stores[ARMY].armies.jingzhou_navy.cityId, "nanzheng");
  const route = h.window.XIAN_STRATEGY_DATA.routes.find(r => [r.from, r.to].includes("nanzheng") && [r.from, r.to].includes("changan"));
  // Isolate convoy interception from the independent winter-road event.
  Object.assign(s.routes[route.id], { supply: 90, pressure: 10, blockadedUntil: 0, weatherUntilTurn: 0, weatherCost: 0 });
  s.commandChain.intents.push({ id: `convoy-intercept:${c.createdAt}:2`, source: "autonomous", owner: "gongsun_zan", ownerName: "公孙瓒", armyId: army.id, armyName: "幽州骑军",
    turn: 2, dueTurn: 2, originCityId: "changan", targetCityId: "nanzheng", targetName: "南郑", targetOwner: "zhang_lu", task: "attack", routeIds: [route.id], priority: 100, status: "proposed", reason: "南郑攻势" });
  return resume(b);
}
function tests() {
const h = convoyFixture(); h.decide(0);
const council = chain(h).intents.find(i => i.id.startsWith("convoy-intercept:"));
assert.equal(h.window.XianStrategyNetwork.previewLordIntervention(council.id, "coordinate").risk, true, "opposing treaty convoy must be warned about before consent");
const ap = h.api.getState().actionPoints;
assert.equal(h.window.XianStrategyNetwork.interveneLordIntent(council.id, "coordinate"), false);
assert.equal(h.api.getState().actionPoints, ap);
assert.equal(h.window.XianStrategyNetwork.interveneLordIntent(council.id, "coordinate", true), true);
assert.equal(h.window.XianStrategyNetwork.getState().promises.find(p => p.type === "ceasefire").status, "active", "a third-party city order is only a risk until the actual bilateral encounter");
month(h);
const a = h.window.XianArmySystem.getState(), s = h.window.XianStrategyNetwork.getState();
const battle = a.militaryFacts.find(f => f.kind === "battle" && f.routeId && f.attackerOwner === "gongsun_zan" && f.defenderOwner === "liu_biao");
assert.ok(battle, `actual opposing convoy must be intercepted on the shared road: ${JSON.stringify({ units: [a.armies.youzhou_cavalry, a.armies.jingzhou_navy], responses: a.commandResponses, facts: a.militaryFacts })}`);
const aid = s.promises.find(p => p.type === "military_aid"), peace = s.promises.find(p => p.type === "ceasefire");
assert.equal(aid.status, "broken"); assert.equal(peace.status, "broken");
assert.equal(aid.contract.receipts.find(r => r.kind === "mission-stopped").sourceFactId, battle.id);
assert.equal(peace.contract.receipts.filter(r => r.id === `breach:${battle.id}`).length, 1);
const incident = chain(h).incidents.find(i => i.id === battle.id);
assert.deepEqual([...incident.promiseIds].sort(), [aid.id, peace.id].sort(), "one battle links both contracts without creating another battle");
const reaction = chain(h).reactions.find(r => r.kind === "aid-intercepted");
assert.ok(reaction); assert.equal(reaction.sourceFactId, battle.id); assert.equal(reaction.trustDelta, -2);
assert.equal(reaction.protectedOwner, "yuan_shao"); assert.equal(reaction.cityId, "ye", "the convoy's protected destination is distinct from the battle road");
assert.equal(chain(h).promiseOutcomes.filter(o => o.sourceFactIds.includes(battle.id)).length, 2);
const snapshot = plain(h.api.captureFullSave()), restored = resume(snapshot), trust = restored.window.XianStrategyNetwork.getState().strategies.liu_biao.trust;
for (let n = 0; n < 4; n++) restored.api.commit("repeat-cascade");
assert.equal(restored.window.XianStrategyNetwork.getState().strategies.liu_biao.trust, trust);
assert.deepEqual(chain(restored).reactions, chain(h).reactions);
assert.deepEqual(chain(restored).promiseOutcomes, chain(h).promiseOutcomes);
const nextMonth = plain(snapshot);
nextMonth.stores[STRATEGY].commandChain.generatedTurns = nextMonth.stores[STRATEGY].commandChain.generatedTurns.filter(t => t !== nextMonth.stores[CORE].turn);
const following = resume(nextMonth), protective = chain(following).intents.find(i => i.turn === nextMonth.stores[CORE].turn && i.owner === "liu_biao");
assert.ok(protective?.reactionIds.includes(reaction.id), "next-month council must cite the actual frozen aid warning");
assert.equal(protective.task, "support"); assert.equal(protective.targetCityId, "ye");
assert.equal(following.window.XianArmySystem.getState().militaryFacts.length, a.militaryFacts.length, "a follow-up plan cannot fabricate another battle");
assert.deepEqual(plain(following.api.getState().random), nextMonth.stores[CORE].random);
// Old saves do not acquire new penalties from already observed military facts.
const legacy = plain(snapshot); legacy.stores[STRATEGY].commandChain.schemaVersion = 1;
legacy.stores[STRATEGY].commandChain.reactions = []; delete legacy.stores[STRATEGY].commandChain.ignoreReactionFactIds;
const migrated = resume(legacy); assert.equal(chain(migrated).reactions.length, 0);
assert.equal(migrated.window.XianStrategyNetwork.getState().strategies.liu_biao.trust, trust);
// Frozen proof survives display-history loss and cannot charge the same actor twice.
const clipped = plain(snapshot); clipped.stores[STRATEGY].promises = []; clipped.stores[ARMY].orders = [];
const archive = resume(clipped); assert.deepEqual(chain(archive).reactions, chain(h).reactions);
assert.deepEqual(chain(archive).promiseOutcomes, chain(h).promiseOutcomes);
for (const floor of [0, 1]) {
  const b = plain(snapshot), ledger = b.stores[STRATEGY].commandChain;
  ledger.reactions = []; b.stores[STRATEGY].strategies.liu_biao.trust = floor;
  const source = b.stores[ARMY].militaryFacts.find(f => f.id === battle.id);
  source.aidWitnesses.push({ ...source.aidWitnesses[0], sourcePromiseId: "another-accepted-pact", supportingOrderId: "another-real-aid-order" });
  const replay = resume(b), r = chain(replay).reactions.find(r => r.kind === "aid-intercepted");
  assert.equal(r.trustDelta, floor ? -floor : 0); assert.equal(r.requestedTrustDelta, -2);
  assert.equal(r.sourcePromiseIds.length, 2, "two references for the same actor do not multiply the penalty");
  assert.equal(chain(replay).reactions.length, 1);
  replay.window.XianStrategyNetwork.applyCampaignEffects({ strategies: { liu_biao: { trust: 10 } } }); replay.api.commit("zero-effect-dedup");
  assert.equal(replay.window.XianStrategyNetwork.getState().strategies.liu_biao.trust, 10);
}
const ordinaryPeace = parallelFixture(({ s }) => { s.commandChain.intents = s.commandChain.intents.slice(0, 1); });
ordinaryPeace.edict("令刘表与公孙瓒停战");
assert.equal(ordinaryPeace.window.XianStrategyNetwork.interveneLordIntent(chain(ordinaryPeace).intents[0].id, "coordinate"), true);
assert.equal(chain(ordinaryPeace).reactions.length, 0, "a bilateral ceasefire does not imply third-party military protection");
console.log("Diplomatic cascade passed: convoy consent, one real road battle, two contract outcomes, frozen aid witness, exact once-only reaction, full restore and conservative migration.");
}
if (require.main === module) tests();
module.exports = { convoyFixture };
