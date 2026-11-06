"use strict";
const assert = require("node:assert/strict");
const { harness, plain, CORE_KEY } = require("./helpers/game-harness");
let groups = 0;
const check = (name, fn) => { fn(); groups++; console.log(`PASS ${name}`); };
function ready(id = "yankang_220") { const r = harness(); r.api.startNewGame("standard", id, { randomSeed: 225 }); const c = r.api.getState(); r.replaceCore({ eventResolved: true, stats: { ...c.stats, treasury: 70, caoAlert: 40, security: 65 } }); return r; }
const dead220 = ["cao_cao", "xun_yu", "empress_fu", "dong_cheng", "yuan_shao", "yuan_shu", "liu_biao", "sun_ce"];
check("every current character card opens a complete real detail modal across five scenarios", () => {
  for (const id of ["zhongping_189", "xingping_195", "jianan_196", "jianan_200", "yankang_220"]) {
    const r = ready(id), before = plain(r.api.getState());
    const cards = r.node("character-list").querySelectorAll("[data-character-id]");
    assert.equal(cards.length, r.window.XianCharacterAvailability.availableCharacters(before).length);
    for (const card of cards) {
      const person = r.window.XianCharacterAvailability.getCharacter(card.dataset.characterId);
      assert.doesNotThrow(() => card.click(), `${id}:${person.id} current card detail must render`);
      assert.equal(r.node("modal-title").textContent, `${person.name}｜${person.title}`);
      assert.doesNotMatch(r.node("modal-body").innerHTML, /undefined/);
      r.api.closeUtilityModal();
    }
    assert.deepEqual(plain(r.api.getState()), before, "character inspection is read-only");
  }
});
check("220 current action plans exclude deceased actors and keep four usable target lists", () => {
  const r = ready(), c = r.api.getState(), api = r.window.XianCharacterAvailability;
  assert.ok(!r.window.XianActionPlans.list(c).some(plan => dead220.includes(plan.targetId)), "220 opening says Cao Cao died: current actions must not target him");
  for (const action of ["audience", "appointment", "secret", "regional"]) {
    const people = api.availableCharacters(c, { action }); assert.ok(people.length > 0, action);
    assert.ok(people.every(person => api.isAvailable(person.id, c)));
  }
  assert.ok(api.availableCharacters(c).some(person => person.id === "cao_pi"));
  assert.ok(api.availableCharacters(c).some(person => person.id === "yang_biao"));
});
check("tampered current action handlers reject unavailable targets without consuming resources", () => {
  const r = ready();
  for (const [action, fields] of [["audience", { "audience-mode": "public" }], ["appointment", { "modal-appointment-type": "honor" }], ["secret", { "modal-secret-type": "support" }], ["regional", { "regional-method": "edict" }]]) {
    const before = plain(r.api.getState());
    assert.equal(r.act(action, { ...fields, "modal-character-select": "cao_cao" }), false, action);
    assert.deepEqual(plain(r.api.getState()), before, action);
  }
});
check("current edict parsing rejects deceased named recipients and resolves present representatives", () => {
  const r = ready(); r.load("strategy-network-data"); const c = r.api.getState();
  for (const name of ["曹操", "荀彧", "董承", "伏皇后"]) {
    const before = plain(r.api.getState()); const preview = r.api.previewEdict(`命${name}整顿宿卫，加强武备。`, c);
    assert.equal(preview.ok, false, name); assert.ok(preview.interpretation.blocked); assert.deepEqual(plain(r.api.getState()), before);
  }
  const preview = r.api.previewEdict("命曹丕整顿宿卫，加强武备。", c); assert.equal(preview.ok, true); assert.ok(preview.interpretation.targets.includes("cao_pi"));
  assert.deepEqual(plain(r.window.XianCharacterAvailability.diplomaticTargets("令曹丕与江东使署停战", c)), ["cao_cao", "sun_ce"]);
  assert.deepEqual(plain(r.window.XianCharacterAvailability.diplomaticTargets("令江东使署与曹丕停战", c)), ["sun_ce", "cao_cao"], "responsibility preserves textual recipient order");
  assert.deepEqual(plain(r.window.XianCharacterAvailability.diplomaticTargets("令曹操与孙策停战", c)), []);
});
check("new relations begin independently; real audience changes no deceased personal value", () => {
  const r = ready(), c = r.api.getState();
  r.replaceCore({ relations: { ...c.relations, cao_cao: 97, cao_pi: 50 } });
  assert.equal(r.act("audience", { "modal-character-select": "cao_pi", "audience-mode": "public" }), true);
  const after = r.api.getState(); assert.equal(after.relations.cao_cao, 97); assert.ok(after.relations.cao_pi > 50);
});
check("old core and full import initialize independent representatives and retain past records", () => {
  const r = ready(), c = r.api.getState();
  const old = { ...c, relations: { ...c.relations, cao_cao: 97 }, chronicle: [...c.chronicle, { date: "过去", text: "曹操曾奉诏入朝。" }] };
  delete old.relations.cao_pi; delete old.relations.court_secretariat;
  r.localStorage.setItem(CORE_KEY, JSON.stringify(old)); r.node("continue-game-btn").click();
  assert.equal(r.api.getState().relations.cao_pi, 50); assert.equal(r.api.getState().relations.court_secretariat, 50);
  assert.equal(r.api.getState().relations.cao_cao, 97); assert.ok(r.api.getState().chronicle.some(item => item.text === "曹操曾奉诏入朝。"));
  const bundle = plain(r.api.captureFullSave()), imported = harness(); assert.equal(imported.api.restoreFullSave(bundle), true);
  const resumed = harness(imported.stores()); resumed.node("continue-game-btn").click();
  assert.equal(resumed.api.getState().relations.cao_pi, 50); assert.equal(resumed.api.getState().relations.cao_cao, 97);
  assert.ok(resumed.api.getState().chronicle.some(item => item.text === "曹操曾奉诏入朝。"));
  assert.ok(resumed.api.getActionPlans().every(plan => !dead220.includes(plan.targetId)));
});
check("all six quarterly topics have current eligible advisers and refuse old direct selections", () => {
  const r = ready(); r.mount("quarterly-agenda", "council-advice"); const council = r.window.XianCouncilAdvice, availability = r.window.XianCharacterAvailability, c = r.api.getState();
  for (const id of ["restore_treasury", "steady_court", "settle_people", "secure_palace", "renew_mandate", "turn_the_front"]) {
    const offers = council.buildAdvice(c, id); assert.equal(offers.length, 3, id); assert.ok(offers.every(item => availability.isAvailable(item.id, c)), id);
  }
  assert.equal(council.chooseAdvice("cao_cao"), false); assert.equal(council.chooseAdvice("xun_yu"), false);
});
check("other ordinary scenarios retain living characters and sufficient valid routes", () => {
  for (const id of ["zhongping_189", "xingping_195", "jianan_196", "jianan_200"]) {
    const r = ready(id), c = r.api.getState(), availability = r.window.XianCharacterAvailability;
    assert.equal(availability.isAvailable("cao_cao", c), true, id); assert.equal(availability.isAvailable("cao_pi", c), false, id);
    for (const action of ["audience", "appointment", "secret", "regional"]) assert.ok(availability.availableCharacters(c, { action }).length, `${id}:${action}`);
    r.mount("quarterly-agenda", "council-advice"); for (const topic of ["steady_court", "turn_the_front"]) assert.equal(r.window.XianCouncilAdvice.buildAdvice(c, topic).length, 3, `${id}:${topic}`);
  }
  const r = ready("jianan_200"), api = r.window.XianCharacterAvailability, c = r.api.getState();
  assert.equal(api.isAvailable("yuan_shu", c), false); assert.equal(api.isAvailable("dong_cheng", c), false);
  assert.equal(api.isAvailable("sun_ce", { ...c, year: 201 }), false);
});
check("directed 220 short games preserve their sequence while using current recipient rules", () => {
  const r = harness(); assert.ok(r.window.XianShortChallenges.start("abdication_eve"));
  const c = r.api.getState(), definition = r.window.XianShortChallenges.getChallenges().find(item => item.id === "abdication_eve");
  assert.equal(r.api.getCurrentEvent().id, definition.sequence[0]); assert.equal(r.window.XianCharacterAvailability.isAvailable("cao_cao", c), false);
  assert.ok(r.api.getActionPlans().every(plan => !dead220.includes(plan.targetId)));
  const saved = plain(r.api.captureFullSave()), imported = harness(); assert.equal(imported.api.restoreFullSave(saved), true);
  assert.equal(imported.api.getCurrentEvent().id, definition.sequence[0]);
});
check("current event adaptation is scoped, explicit and cannot mutate old content", () => {
  const r = ready(), api = r.window.XianCharacterAvailability, c = r.api.getState();
  const source = r.window.GAME_DATA.randomEvents.find(item => item.id === "secret_letter"), before = plain(source), adapted = api.presentEvent(source, c);
  assert.equal(adapted.id, source.id); assert.match(adapted.text, /当前使署改编/); assert.match(adapted.choices[1].label, /尚书台使署/);
  assert.equal(adapted.choices[1].relations.dong_cheng, undefined); assert.equal(adapted.choices[1].relations.court_secretariat, 5); assert.deepEqual(plain(source), before);
  const oldEvent = api.presentEvent(source, { ...c, year: 196, scenarioId: "jianan_196" }); assert.equal(oldEvent, source);
});
check("faction IDs stay stable and current commander labels never revive the old person", () => {
  const r = ready(); r.load("strategy-network-data", "army-data"); const api = r.window.XianCharacterAvailability, c = r.api.getState();
  assert.equal(api.faction("cao_cao", c).id, "cao_cao"); assert.equal(api.faction("cao_cao", c).name, "魏王府"); assert.equal(api.representative("cao_cao", c).id, "cao_pi");
  assert.equal(api.representative("yuan_shao", c).id, "hebei_envoy"); assert.match(api.commander("yuan_shao", "yuan_shao", c).name, /机构/);
  assert.equal(api.commander("cao_cao", "cao_cao", { ...c, year: 196 }).name, "曹操");
});
check("recommender and comparison targets share current availability", () => {
  const r = ready(); r.load("command-center"); const c = r.api.getState(), availability = r.window.XianCharacterAvailability;
  const rec = r.window.XianCommandCenter.recommendAction(c); if (rec.fields?.["modal-character-select"]) assert.equal(availability.isAvailable(rec.fields["modal-character-select"], c), true);
  const comparison = r.window.XianCommandCenter.compareActions(c); assert.equal(comparison.available, true);
  for (const choice of comparison.choices) if (choice.fields?.["modal-character-select"]) assert.equal(availability.isAvailable(choice.fields["modal-character-select"], c), true);
});
check("restored pending personal chapters are suspended without transferring old progress", () => {
  const r = ready(), c = r.api.getState();
  r.localStorage.setItem("xian_emperor_progression_v100", JSON.stringify({ version: 1, profile: { tutorialSeen: true }, session: { gameCreatedAt: c.createdAt, pathId: "guard", pendingArc: { arcId: "cao_cao", chapterIndex: 1 }, lastArcTurn: c.turn, arcProgress: { cao_cao: { stage: 1, affinity: 2, choices: [0] } } } }));
  r.mount("imperial-progress-data", "imperial-progress"); r.window.XianImperialProgress.sync();
  const progress = r.window.XianImperialProgress.getState(); assert.equal(progress.session.pendingArc, null); assert.equal(progress.session.arcProgress.cao_cao.stage, 1); assert.equal(progress.session.arcProgress.cao_pi, undefined);
});
check("world implementation recognizes current aliases and creates independent political profiles", () => {
  const r = ready(); r.loadEngine(); r.mount("decree-world");
  const world = r.window.XianWorldSystem.getState();
  assert.equal(world.characters.cao_pi.loyalty, 50); assert.equal(world.characters.court_secretariat.loyalty, 50);
  assert.deepEqual(plain(r.window.XianDecreeWorld.detectTargets("命曹丕整顿宿卫").lords), ["cao_cao"]);
  assert.deepEqual(plain(r.window.XianDecreeWorld.detectTargets("命曹操整顿宿卫").lords), []);
  const before = r.api.getState().totalActions; r.edict("命曹丕整顿宿卫，加强武备。"); r.flush();
  assert.equal(r.api.getState().totalActions, before + 1);
  const impacts = r.window.XianDecreeWorld.getState().history;
  assert.ok(impacts.some(item => item.lordChanges.some(lord => lord.id === "cao_cao" && lord.name === "魏王府")));
});
console.log(`Character availability regression passed: ${groups} groups.`);
