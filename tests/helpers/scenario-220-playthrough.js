"use strict";
const assert = require("node:assert/strict");
const { harness } = require("./game-harness");

const ROUTES = {
  resist: ["network", "mandate", "assert", "resist"],
  preserve: ["discuss", "register", "terms", "preserve"],
  negotiate: ["network", "register", "terms", "negotiate"],
};
function ready(stores = {}, ambientRandom = .99, mechanics = true) {
  const run = harness(stores, ambientRandom);
  if (mechanics) run.loadMechanics();
  run.mount("final-verdict");
  return run;
}
function eventIndex(run, route) {
  const event = run.api.getCurrentEvent();
  if (event.id === "scenario_220_opening") return 1;
  if (event.story220) {
    const node = run.window.XianScenario220Story.nodes().findIndex(item => item.id === event.id);
    return event.choices.findIndex(item => item.key === ROUTES[route][node]);
  }
  const weights = { authority: 1, prestige: 1, security: 2, treasury: .5, officials: 1, caoAlert: -2, leakRisk: -2 };
  return event.choices.map((choice, index) => ({ index, score: Object.entries({ ...choice.effects, ...choice.hidden }).reduce((sum, [key, delta]) => sum + delta * (weights[key] || 0), 0) })).sort((a, b) => b.score - a.score || a.index - b.index)[0].index;
}
function actions(run, route) {
  if (route === "preserve") return;
  for (let step = 0; step < 2; step++) {
    const core = run.api.getState();
    if (core.ended || core.actionPoints === 0) break;
    let acted;
    if (route === "resist" && core.turn === 1 && core.hidden.loyalNetwork < 20) {
      acted = run.act("secret", { "modal-character-select": "yang_biao", "modal-secret-type": "support" });
    } else if (route === "resist" && (core.stats.caoAlert >= 67 || core.stats.security < 48)) {
      acted = run.act("appease", { "appease-type": core.stats.security < 48 ? "military" : "praise" });
    } else acted = run.act("audience", { "modal-character-select": "yang_biao", "audience-mode": "public" });
    assert.ok(acted, "policy must perform the real confirmed action");
    run.flush();
  }
}
function play(route, seed = 224, options = {}) {
  let run = options.run || ready({}, options.ambientRandom ?? .99, options.mechanics !== false);
  if (!options.run) { run.api.startNewGame("standard", "yankang_220", { randomSeed: seed }); run.flush(); }
  const trace = [];
  while (!run.api.getState().ended && run.api.getState().turn < (options.stopAt || Infinity)) {
    const core = run.api.getState(), event = run.api.getCurrentEvent();
    let index = eventIndex(run, route);
    if (options.allowFallback && (index < 0 || event.choices[index].disabledReason)) {
      index = event.choices.findIndex(item => ["discuss", "archive", "concede", "preserve"].includes(item.key) && !item.disabledReason);
      if (index < 0) index = event.choices.findIndex(item => !item.disabledReason);
    }
    assert.ok(index >= 0 && !event.choices[index].disabledReason, `${route} must have its supported choice at ${core.turn}: ${event.choices[index]?.disabledReason}`);
    run.decide(index); run.flush();
    actions(run, route);
    trace.push({ turn: core.turn, id: event.id, choice: event.choices[index].key || index });
    run.api.endTurn(); run.flush();
    if (options.reloadAt === run.api.getState().turn && !run.api.getState().ended) {
      run = ready(run.stores(), options.resumeRandom ?? .01, options.mechanics !== false);
      run.node("continue-game-btn").click(); run.flush();
    }
  }
  return { run, core: run.api.getState(), trace };
}
function signature(core) {
  return { turn: core.turn, monthlySettledTurn: core.monthlySettledTurn, stats: core.stats, hidden: core.hidden, relations: core.relations,
    random: core.random, ending: core.ending, story220: core.story220 };
}
module.exports = { ROUTES, ready, eventIndex, actions, play, signature };
