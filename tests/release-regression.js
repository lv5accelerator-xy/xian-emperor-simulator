"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

function loadArmyApi() {
  function StorageMock() {}
  StorageMock.prototype.setItem = function setItem() {};
  StorageMock.prototype.getItem = function getItem() { return null; };
  const context = {
    console,
    setTimeout,
    clearTimeout,
    Storage: StorageMock,
    localStorage: new StorageMock(),
    document: { readyState: "loading", addEventListener() {} },
    CustomEvent: function CustomEvent() {},
    window: {
      XIAN_ARMY_DATA: { armies: [], commanders: [], taskLabels: {}, statusLabels: {} },
      XIAN_STRATEGY_DATA: { cities: [], routes: [], lords: [] },
      XianStrategyNetwork: {},
      addEventListener() {},
      clearTimeout,
      setTimeout,
    },
  };
  vm.runInNewContext(read("src/army-system.js"), context, { filename: "army-system.js" });
  return context.window.XianArmySystem;
}

function loadCourtApi() {
  function StorageMock() {}
  StorageMock.prototype.setItem = function setItem() {};
  StorageMock.prototype.getItem = function getItem() { return null; };
  const context = {
    console,
    setTimeout,
    clearTimeout,
    Storage: StorageMock,
    localStorage: new StorageMock(),
    document: { readyState: "loading", addEventListener() {} },
    window: { addEventListener() {}, clearTimeout, setTimeout },
  };
  vm.runInNewContext(read("src/court-politics.js"), context, { filename: "court-politics.js" });
  return context.window.XianCourtPolitics;
}

function loadGameApi() {
  const context = {
    console,
    setTimeout,
    clearTimeout,
    document: { addEventListener() {} },
    window: {},
  };
  vm.runInNewContext(read("src/data.js"), context, { filename: "data.js" });
  vm.runInNewContext(read("src/game.js"), context, { filename: "game.js" });
  return { api: context.window.XianEmperorGame, data: context.window.GAME_DATA };
}

function loadStrategyApi() {
  function StorageMock() {}
  StorageMock.prototype.setItem = function setItem() {};
  StorageMock.prototype.getItem = function getItem() { return null; };
  const context = {
    console,
    setTimeout,
    clearTimeout,
    Storage: StorageMock,
    localStorage: new StorageMock(),
    document: { readyState: "loading", addEventListener() {} },
    CustomEvent: function CustomEvent() {},
    window: { setTimeout, clearTimeout },
  };
  vm.runInNewContext(read("src/strategy-network-data.js"), context, { filename: "strategy-network-data.js" });
  vm.runInNewContext(read("src/strategy-network.js"), context, { filename: "strategy-network.js" });
  return context.window.XianStrategyNetwork;
}

const expectedVersion = process.env.EXPECTED_VERSION || "2.10.0";
const escapedVersion = expectedVersion.replaceAll(".", "\\.");
assert.match(read("index.html"), new RegExp(`v${escapedVersion}`));
assert.match(read("CHANGELOG.md"), new RegExp(`## v${escapedVersion}`));
assert.match(read("index.html"), /imperial-progress\.css\?v=1\.5\.1/);
assert.match(read("index.html"), /imperial-progress-data\.js\?v=1\.5\.1/);
assert.match(read("index.html"), /imperial-progress\.js\?v=1\.5\.1/);
assert.match(read("index.html"), /grand-map\.css\?v=2\.6\.1/);
assert.match(read("index.html"), /historical-geography-data\.js\?v=2\.6\.1/);
assert.match(read("index.html"), /grand-map\.js\?v=2\.6\.1/);
assert.match(read("index.html"), /campaign-evolution\.css\?v=1\.5\.1/);
assert.match(read("index.html"), /campaign-evolution-data\.js\?v=1\.5\.1/);
assert.match(read("index.html"), /campaign-evolution\.js\?v=1\.5\.1/);
assert.match(read("index.html"), /src\/ui\.css\?v=1\.5\.1/);
assert.match(read("index.html"), /src\/ui\.js\?v=2\.6\.1/);
assert.match(read("index.html"), /src\/visual-refresh\.css\?v=2\.7\.1/);
assert.match(read("index.html"), /src\/ui-refresh-v280\.css\?v=2\.8\.0/);
assert.match(read("index.html"), /src\/ui-refresh-v280\.js\?v=2\.8\.0/);
assert.match(read("index.html"), /src\/causal-court\.css\?v=2\.9\.0/);
assert.match(read("index.html"), /src\/causal-court\.js\?v=2\.9\.0/);
assert.match(read("index.html"), /id="causal-court-panel"/);
assert.match(read("index.html"), /src\/quarterly-agenda\.css\?v=2\.10\.0/);
assert.match(read("index.html"), /src\/quarterly-agenda\.js\?v=2\.10\.0/);
assert.match(read("index.html"), /id="quarterly-agenda-panel"/);
assert.match(read("src/ui-refresh-v280.css"), /@media \(max-width: 820px\)[\s\S]+\.mobile-imperial-nav/);
assert.match(read("src/ui-refresh-v280.css"), /\.topbar-v110 \.utility-nav-upgraded\s*{\s*display:\s*none/);
assert.match(read("src/ui-refresh-v280.js"), /data-mobile-destination="month"[\s\S]+data-mobile-destination="actions"[\s\S]+data-mobile-destination="map"[\s\S]+data-mobile-destination="archive"/);
assert.match(read("index.html"), /preload[^>]+zcool-xiaowei-game\.woff2/);
for (const font of ["zcool-xiaowei-game.woff2", "noto-serif-sc-game.woff2", "noto-sans-sc-game.woff2"]) {
  const file = path.join(root, "assets", "fonts", font);
  assert.ok(fs.existsSync(file), `${font} should be included`);
  assert.ok(fs.statSync(file).size > 100000, `${font} should contain a real WOFF2 subset`);
}
for (const license of ["ZCOOL-XiaoWei-OFL.txt", "Noto-Serif-SC-OFL.txt", "Noto-Sans-SC-OFL.txt"]) {
  assert.ok(fs.existsSync(path.join(root, "assets", "fonts", "licenses", license)), `${license} should be included`);
}
for (const illustration of [
  "opening-palace.webp", "court-memorial.webp", "army-crossing.webp", "ending-river-mountains.webp",
  "treasury-crisis.webp", "granary-relief.webp", "secret-edict.webp", "regional-envoys.webp",
  "palace-guard.webp", "military-dispatch.webp",
]) {
  assert.ok(fs.existsSync(path.join(root, "assets", "images", "illustrations", illustration)), `${illustration} should be included`);
  assert.ok(fs.statSync(path.join(root, "assets", "images", "illustrations", illustration)).size > 40000, `${illustration} should contain a real WebP illustration`);
}
for (const resource of [
  "command-center.css?v=2.5.0-r2", "command-center.js?v=2.5.0-r2",
  "character-memory.css?v=1.7.0", "character-memory.js?v=1.7.0",
  "world-marks.css?v=1.8.0", "world-marks.js?v=1.8.0",
  "historian.css?v=1.9.0", "historian.js?v=1.9.0",
  "dynasty-saga.css?v=2.0.0", "dynasty-saga.js?v=2.0.0-r2",
  "monthly-flow.css?v=2.1.0", "monthly-flow.js?v=2.1.0",
  "consequence-echoes.css?v=2.2.0", "consequence-echoes.js?v=2.2.0",
  "short-challenges.css?v=2.3.0", "short-challenges.js?v=2.3.0",
  "weekly-challenge.css?v=2.4.0", "weekly-challenge.js?v=2.4.0",
  "final-verdict.css?v=2.5.0", "final-verdict.js?v=2.5.0",
]) assert.ok(read("index.html").includes(resource), `${resource} should be referenced`);
assert.match(read("src/game.js"), /xian-emperor-full-save/);
assert.match(read("src/game.js"), /schemaVersion:\s*101/);
assert.match(read("src/game.js"), /__xianFullSaveImporting\s*=\s*true/);
for (const file of [
  "world-system.js",
  "decree-world.js",
  "strategy-network.js",
  "army-system.js",
  "court-politics.js",
  "imperial-progress.js",
  "campaign-evolution.js",
]) {
  assert.match(read(path.join("src", file)), /__xianFullSaveImporting/, `${file} must preserve imported subsystem data`);
}

const musicContext = { window: {} };
vm.runInNewContext(read("src/audio-tracks.js"), musicContext, { filename: "audio-tracks.js" });
const musicTracks = musicContext.window.XIAN_MUSIC_TRACKS;
assert.deepEqual(Array.from(Object.keys(musicTracks)), ["menu", "court", "crisis", "battle", "ending"]);
for (const [scene, file] of Object.entries(musicTracks)) {
  assert.equal(file.includes("/alternates/"), false, `${scene} must not reference a backup track`);
  const bytes = fs.readFileSync(path.join(root, file));
  assert.ok(bytes.length > 500_000, `${scene} music file is unexpectedly small`);
  assert.equal(bytes.subarray(0, 3).toString("ascii"), "ID3", `${scene} music file should be an MP3`);
}
const alternateFiles = fs.readdirSync(path.join(root, "assets/audio/bgm/alternates"))
  .filter(name => name.endsWith(".mp3"));
assert.equal(alternateFiles.length, 3, "three backup tracks should be archived");

for (const file of fs.readdirSync(path.join(root, "src")).filter((name) => name.endsWith(".js"))) {
  new vm.Script(read(path.join("src", file)), { filename: file });
}

const armyApi = loadArmyApi();
assert.ok(armyApi, "army diagnostics API should load");
const siege = { stance: "blockade", walls: 65 };
const army = { troops: 9000, morale: 72, supply: 70, orderAuthority: 65 };
const city = { defense: 65, courtLoyalty: 50 };
const core = { stats: { prestige: 60 } };
const blockade = armyApi.calculateSiegeTurn(siege, army, city, core, 0.5);
const assault = armyApi.calculateSiegeTurn({ ...siege, stance: "assault" }, army, city, core, 0.5);
const persuade = armyApi.calculateSiegeTurn({ ...siege, stance: "persuade" }, army, city, core, 0.5);

assert.ok(assault.progress > blockade.progress, "assault should make faster progress than blockade");
assert.ok(assault.attackerLoss > blockade.attackerLoss, "assault should cost more attackers");
assert.ok(blockade.supplyLoss > persuade.supplyLoss, "blockade should consume more city supply");
assert.ok(persuade.attackerLoss < assault.attackerLoss, "persuasion should reduce attacker losses");

const judgment = { cityId: "xudu", newOwner: "cao_cao", stance: "persuade" };
const appoint = armyApi.getJudgmentDecision("appoint", judgment, { stats: { prestige: 60 } });
const recruit = armyApi.getJudgmentDecision("recruit", judgment, { stats: { prestige: 60 } });
assert.equal(appoint.city.controller, "court", "direct appointment should place the city under court control");
assert.ok(appoint.effects.caoAlert > 0, "direct appointment should alarm Cao's faction");
assert.ok(recruit.recruitChance >= 25 && recruit.recruitChance <= 88, "recruitment chance should stay bounded");

const courtApi = loadCourtApi();
assert.ok(courtApi, "court politics diagnostics API should load");
assert.equal(courtApi.factions.length, 5, "five political factions should be available");
const courtState = { factions: { imperial: { support: 50, tension: 30 } } };
const acceptGuard = courtApi.previewResponse("fu_guard", "accept", courtState);
const refuseGuard = courtApi.previewResponse("fu_guard", "refuse", courtState);
assert.ok(acceptGuard.supportAfter > refuseGuard.supportAfter, "accepting a petition should improve its faction support");
assert.ok(acceptGuard.effects.security > 0, "guard petition should improve court security");
assert.ok(courtApi.petitions.some(item => item.type === "negotiation"), "dynamic negotiations should be included");

const game = loadGameApi();
assert.equal(game.data.version, expectedVersion, "game data version should match the release");
assert.equal(game.data.causalEvents.length, 6, "six situation-driven memorials should connect existing systems");
assert.ok(game.data.causalEvents.every(event => event.choices.every(choice => choice.causalLinks)), "causal memorial choices should declare downstream system links");
assert.ok(game.data.actionCatalog.some(item => item.id === "revenue"), "common actions should include treasury fundraising");
assert.deepEqual(
  Array.from(new Set(game.data.actionCatalog.filter(item => item.id !== "edict").map(item => item.category))).sort(),
  ["diplomacy", "domestic", "finance", "intrigue"],
  "common actions should be divided into four readable categories",
);
for (const [title, expectedFile] of [
  ["国库告急", "treasury-crisis.webp"],
  ["开仓赈济", "granary-relief.webp"],
  ["深夜密诏", "secret-edict.webp"],
  ["江东使者入朝", "regional-envoys.webp"],
  ["宫门换防", "palace-guard.webp"],
  ["边郡军报", "military-dispatch.webp"],
]) {
  assert.equal(game.api.chooseEventIllustration({ title, text: title }).file, expectedFile, `${title} should use ${expectedFile}`);
}
const auditRevenue = game.api.buildTreasuryActionPackage("audit", 40);
const emergencyRevenue = game.api.buildTreasuryActionPackage("tribute", 12);
const borrowedRevenue = game.api.buildTreasuryActionPackage("borrow", 30);
assert.equal(auditRevenue.effects.treasury, 4, "expense auditing should provide a modest safe treasury gain");
assert.equal(emergencyRevenue.effects.treasury, 9, "low treasury should receive the two-point emergency bonus");
assert.ok(emergencyRevenue.hidden.peopleStability < 0, "collecting tribute should carry a public-stability cost");
assert.ok(borrowedRevenue.effects.authority < 0, "borrowing from Cao's office should reduce imperial autonomy");
assert.ok(borrowedRevenue.hidden.externalBalance < 0, "borrowing should weaken external balance");
assert.equal(game.data.scenarios.length, 5, "five historical scenarios should be available");
assert.deepEqual(Array.from(game.data.scenarios, item => item.startYear), [189, 195, 196, 200, 220]);
const lateScenario = game.api.getScenarioById("yankang_220");
assert.equal(lateScenario.maxTurns, 12, "the 220 challenge should be a compact twelve-month campaign");
const challengePass = game.api.calculateScenarioChallenge(lateScenario, { turn: 12, maxTurns: 12, stats: { prestige: 60, authority: 45 }, hidden: {} });
const challengeFail = game.api.calculateScenarioChallenge(lateScenario, { turn: 12, maxTurns: 12, stats: { prestige: 40, authority: 45 }, hidden: {} });
assert.equal(challengePass.completed, true, "meeting all late-scenario goals should complete its challenge");
assert.equal(challengeFail.completed, false, "missing a late-scenario goal should fail its challenge");

assert.match(read("src/game.js"), /xian_emperor_campaign_evolution_v150/, "full saves should include campaign evolution data");
assert.match(read("src/game.js"), /xian_emperor_quarterly_agenda_v2100/, "full saves should include quarterly agenda data");
for (const key of [
  "xian_emperor_command_center_v160",
  "xian_emperor_character_memory_v170",
  "xian_emperor_world_marks_v180",
  "xian_emperor_historian_v190",
  "xian_emperor_dynasty_saga_v200",
  "xian_emperor_monthly_flow_v210",
  "xian_emperor_consequence_echoes_v220",
  "xian_emperor_short_challenges_v230",
  "xian_emperor_weekly_challenge_v240",
  "xian_emperor_final_verdict_v250",
]) assert.match(read("src/game.js"), new RegExp(key), `full saves should include ${key}`);

const strategyApi = loadStrategyApi();
assert.ok(strategyApi, "strategy network diagnostics API should load");
const orderedCities = Array.from(strategyApi.detectCityTargets("命荆州牧刘表自襄阳出兵，经宛城驰援许都"));
assert.deepEqual(orderedCities, ["xiangyang", "wan", "xudu"], "edict cities should follow written order");
assert.deepEqual(
  Array.from(strategyApi.resolveOrderedPath(orderedCities, ["liu_biao"])),
  ["wan_xiangyang", "xudu_wan"],
  "ordered cities should resolve to the intended route",
);
assert.equal(strategyApi.choosePrimaryOrder(["supply", "support"]), "support", "military support should outrank supply");

console.log(`release regression ok: v${expectedVersion}`);
