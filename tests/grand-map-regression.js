"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

class StorageMock {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.has(key) ? this.values.get(key) : null; }
  setItem(key, value) { this.values.set(key, String(value)); }
}

const localStorage = new StorageMock();
const context = {
  console,
  localStorage,
  requestAnimationFrame(callback) { callback(); },
  window: {},
};

for (const file of ["src/world-data.js", "src/strategy-network-data.js", "src/army-data.js", "src/historical-geography-data.js", "src/grand-map.js"]) {
  vm.runInNewContext(read(file), context, { filename: file });
}

localStorage.setItem("xian_emperor_strategy_network_v040", JSON.stringify({
  cities: { xudu: { defense: 38, supply: 24, courtLoyalty: 82, controller: "court" } },
  routes: { xudu_ye: { pressure: 86, supply: 39, lastChange: "测试军压" } },
}));
localStorage.setItem("xian_emperor_armies_v050", JSON.stringify({
  armies: {
    test_army: { id: "test_army", name: "测试勤王军", cityId: "xudu", status: "marching", troops: 6000, morale: 70, supply: 65 },
  },
}));

const api = context.window.XianGrandMap;
assert.ok(api, "grand map API should load");
assert.equal(Object.keys(api.positions).length, 16, "all sixteen strategic cities need map coordinates");
assert.equal(api.geography.version, "2.6.0", "real geography data should match the map release");
assert.match(api.geography.source, /Natural Earth/);
assert.ok(api.positions.wuwei[0] < api.positions.changan[0], "Wuwei should be west of Chang'an");
assert.ok(api.positions.ji[1] < api.positions.xudu[1], "Ji should be north of Xudu");
assert.ok(api.positions.wujun[0] > api.positions.xiangyang[0], "Wu commandery should be east of Xiangyang");

const html = api.render({ regions: {} }, { turn: 3, maxTurns: 24, scenarioName: "建安元年·许都" });
assert.equal((html.match(/class="grand-city(?: |")/g) || []).length, 16, "map should render sixteen city buttons");
assert.equal((html.match(/class="grand-route /g) || []).length, 18, "map should render eighteen strategic routes");
assert.equal((html.match(/data-map-layer=/g) || []).length, 6, "map shell and five map layers should be present");
assert.match(html, /data-grand-viewport/);
assert.match(html, /测试勤王军|1支军团/);
assert.match(html, /军压 86/);
assert.match(html, /山河真形/);
assert.match(html, /汉末山河军政图/);
assert.match(html, /geography-land/);
assert.match(html, /黄河/);
assert.match(html, /长江/);
assert.match(html, /地图归中/);
assert.match(html, /本月关键警讯 · 最多三条/);
assert.match(html, /选择军团后可直接在地图下令/);
assert.match(html, /舆图指引/);

for (const city of context.window.XIAN_STRATEGY_DATA.cities) {
  assert.match(html, new RegExp(`data-grand-city="${city.id}"`), `missing city ${city.id}`);
}
for (const route of context.window.XIAN_STRATEGY_DATA.routes) {
  assert.match(html, new RegExp(`data-grand-route="${route.id}"`), `missing route ${route.id}`);
}

console.log("grand map regression ok: real geography, 16 cities, 18 routes, layers and armies");
