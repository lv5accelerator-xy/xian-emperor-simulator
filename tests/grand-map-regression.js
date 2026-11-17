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
const worldSystemCode = read("src/world-system.js");
assert.ok(api, "grand map API should load");
assert.equal(Object.keys(api.positions).length, 16, "all sixteen strategic cities need map coordinates");
assert.equal(api.geography.version, "2.31.0", "real geography data should match the map release");
const geo = api.geography;
assert.match(geo.terrainImage, /^assets\/images\/map\/terrain\.webp/, "terrain basemap image is bundled locally");
assert.ok(fs.existsSync(path.join(root, geo.terrainImage.split("?")[0])), "terrain basemap image exists");
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
assert.match(html, /郡国全图/);
assert.match(html, /汉末山河军政图/);
assert.match(html, /geography-land/);
assert.match(html, /黄河/);
assert.match(html, /长江/);

// 实测地形底图与汉代水系
assert.match(html, /class="geography-terrain" href="assets\/images\/map\/terrain\.webp/);
assert.doesNotMatch(html, /mapRelief|feTurbulence/, "the random-noise relief is replaced by the real terrain image");
for (const name of ["济水", "渭水", "淮水", "汉水"]) assert.match(html, new RegExp(`>${name}<`), `river label ${name}`);
const historic = Array.from(geo.rivers.filter(river => river.historic), river => river.id).sort();
assert.deepEqual(historic, ["he-han", "huai-han", "ji", "jiang-han", "ru-river", "si"], "Han-era courses are flagged as historic (drawn dashed)");
assert.equal((html.match(/class="terrain-river[^"]*historic/g) || []).length, historic.length);
assert.ok(geo.lakes.some(lake => lake.name === "巨野泽") && !geo.lakes.some(lake => /鄱阳|洪泽/.test(lake.name)), "Han-era lakes only");
for (const river of geo.rivers) assert.match(river.d, /^M[\d.]+ [\d.]+ L/, `river ${river.id} has drawable geometry`);

// 十三州界：东汉十三州部，各州至少含本州的郡治
const provinceNames = ["司隶", "豫州", "冀州", "兖州", "徐州", "青州", "荆州", "扬州", "益州", "凉州", "并州", "幽州", "交州"];
assert.deepEqual(Array.from(geo.provinces, item => item.name).sort(), [...provinceNames].sort(), "thirteen Eastern Han provinces");
assert.equal((html.match(/class="han-province"/g) || []).length, 13);
assert.equal((html.match(/class="province-name-label"/g) || []).length, 13);
assert.equal(geo.commanderySeats.length, 104, "all commandery seats inside the map frame (Rinan lies south of it)");
const seatsByProvince = geo.commanderySeats.reduce((map, seat) => ({ ...map, [seat.province]: [...(map[seat.province] || []), seat] }), {});
for (const province of geo.provinces) assert.ok(seatsByProvince[province.id]?.length, `${province.name} has commandery seats`);
// 几处典型归属：许都在豫州，成都在益州，吴郡在扬州，邺在冀州
const pointIn = (d, [x, y]) => d.split("M").filter(Boolean).reduce((inside, ring) => {
  const pts = ring.replace(/ Z/, "").split(" L").map(part => part.trim().split(" ").map(Number));
  let hit = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) hit = !hit;
  }
  return inside !== hit;
}, false);
const provinceAt = point => geo.provinces.find(item => pointIn(item.d, geo.project(point)))?.name;
assert.equal(provinceAt([113.85, 34.04]), "豫州", "Xudu lies in Yuzhou");
assert.equal(provinceAt([104.07, 30.67]), "益州", "Chengdu lies in Yizhou");
assert.equal(provinceAt([120.62, 31.30]), "扬州", "Wu lies in Yangzhou");
assert.equal(provinceAt([114.35, 36.33]), "冀州", "Ye lies in Jizhou");
assert.equal(provinceAt([112.62, 34.72]), "司隶", "Luoyang lies in Sili");
assert.equal(provinceAt([119.30, 26.08]), "扬州", "Fujian belonged to Kuaiji in Yangzhou");

// 底图切换：默认地形，可切到州界，偏好记在本机
assert.match(html, /data-basemap="terrain"/);
assert.equal((html.match(/data-map-basemap=/g) || []).length, 2);
assert.match(html, /data-map-basemap="provinces" aria-pressed="false">州界/);
localStorage.setItem("xian_map_basemap_v1", "provinces");
const context2 = { console, localStorage, requestAnimationFrame(callback) { callback(); }, window: {} };
for (const file of ["src/world-data.js", "src/strategy-network-data.js", "src/army-data.js", "src/historical-geography-data.js", "src/grand-map.js"]) vm.runInNewContext(read(file), context2, { filename: file });
const html2 = context2.window.XianGrandMap.render({ regions: {} }, { turn: 3, maxTurns: 24, scenarioName: "建安元年·许都" });
assert.match(html2, /data-basemap="provinces"/, "saved basemap preference is restored");
localStorage.setItem("xian_map_basemap_v1", "<bad>");
const context3 = { console, localStorage, requestAnimationFrame(callback) { callback(); }, window: {} };
for (const file of ["src/world-data.js", "src/strategy-network-data.js", "src/army-data.js", "src/historical-geography-data.js", "src/grand-map.js"]) vm.runInNewContext(read(file), context3, { filename: file });
assert.match(context3.window.XianGrandMap.render({ regions: {} }, { turn: 3, maxTurns: 24 }), /data-basemap="terrain"/, "unknown preference falls back to terrain");
localStorage.values.delete("xian_map_basemap_v1");
assert.match(html, /地图归中/);
assert.match(html, /本月关键警讯 · 最多三条/);
assert.match(html, /选择军团后可直接在地图下令/);
assert.match(html, /舆图指引/);
assert.equal((html.match(/class="region-name-label"/g) || []).length, 14, "all fourteen strategic regions need large map labels");
assert.equal((html.match(/class="minor-place"/g) || []).length, 32, "commandery and county-seat labels should enrich the historical map");
assert.match(html, /data-map-inspector-toggle/);
assert.match(worldSystemCode, /world-map-page/);
assert.match(worldSystemCode, /map-mode/);
assert.match(worldSystemCode, /data-world-intel-toggle/);

for (const city of context.window.XIAN_STRATEGY_DATA.cities) {
  assert.match(html, new RegExp(`data-grand-city="${city.id}"`), `missing city ${city.id}`);
}
for (const route of context.window.XIAN_STRATEGY_DATA.routes) {
  assert.match(html, new RegExp(`data-grand-route="${route.id}"`), `missing route ${route.id}`);
}

console.log("grand map regression ok: real terrain, Han waterways, 13 provinces, basemap toggle, 16 cities, 18 routes, layers and armies");
