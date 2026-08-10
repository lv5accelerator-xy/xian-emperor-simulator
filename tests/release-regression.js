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

const expectedVersion = process.env.EXPECTED_VERSION || "0.5.2";
const escapedVersion = expectedVersion.replaceAll(".", "\\.");
assert.match(read("index.html"), new RegExp(`v${escapedVersion}`));
assert.match(read("CHANGELOG.md"), new RegExp(`## v${escapedVersion}`));

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

console.log(`release regression ok: v${expectedVersion}`);
