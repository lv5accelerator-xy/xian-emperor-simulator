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
assert.equal(api.geography.version, "2.34.0", "real geography data should match the map release");
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
assert.equal((html.match(/class="province-name-label(?: compact)?"/g) || []).length, 13);
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

// 州制随年份：189 年十三州，194 年起河西另置雍州，213 年起复为九州
assert.equal(geo.provinceEras.length, 3);
const eraOf = year => geo.provincesForYear(year);
assert.equal(eraOf(189).provinces.length, 13);
assert.equal(eraOf(195).provinces.length, 14);
assert.equal(eraOf(200).provinces.length, 14);
assert.equal(eraOf(213).provinces.length, 9);
assert.equal(eraOf(220).provinces.length, 9);
assert.deepEqual(Array.from(eraOf(220).provinces, item => item.name).sort(), ["兖州", "冀州", "徐州", "扬州", "益州", "荆州", "豫州", "雍州", "青州"].sort());
for (const era of geo.provinceEras) {
  assert.equal(era.provinces.reduce((sum, item) => sum + item.commanderies.length, 0), 105, `${era.id}: every commandery belongs to exactly one province`);
}
const provinceIn = (year, point) => eraOf(year).provinces.find(item => pointIn(item.d, geo.project(point)))?.name;
assert.equal(provinceIn(189, [94.66, 40.14]), "凉州", "Dunhuang in Liangzhou before 194");
assert.equal(provinceIn(196, [94.66, 40.14]), "雍州", "Dunhuang in the Hexi Yongzhou from 194");
assert.equal(provinceIn(196, [103.85, 35.40]), "凉州", "Longxi stays in Liangzhou in 196");
assert.equal(provinceIn(220, [103.85, 35.40]), "雍州", "Liangzhou merged into Yongzhou in 213");
assert.equal(provinceIn(220, [112.50, 37.85]), "冀州", "Bingzhou merged into Jizhou in 213");
assert.equal(provinceIn(220, [113.27, 23.13]), "荆州", "Jiaozhou merged into Jingzhou in 213");
assert.ok(eraOf(220).provinces.find(item => item.name === "冀州").commanderies.includes("河内郡"), "Henei joined Jizhou with Wei's ten commanderies");
const html220 = api.render({ regions: {} }, { turn: 3, maxTurns: 24, year: 220 });
assert.equal((html220.match(/class="han-province"/g) || []).length, 9, "the map shows the province system of the current game year");
assert.match(html220, /州制：建安十八年复九州/);
assert.match(api.render({ regions: {} }, { turn: 1, maxTurns: 24, year: 196 }), /州制：兴平元年分置雍州/);

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
assert.equal((html.match(/class="region-name-label"/g) || []).length, 0, "strategic region names live in the inspector, not as large map labels");
assert.equal((html.match(/class="grand-region"[^>]*aria-label="[^"]+"/g) || []).length, 14, "all fourteen strategic regions stay clickable and named");
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

// 舆图数据按需载入：首页不直接引用数据脚本，地址写在 grand-map.js 标签的 data-geography-src 上；
// 数据尚未载入时 render 先给出“载入中”，并插入一个指向该地址的经典脚本（双击运行同样可用）。
{
  const indexHtml = read("index.html");
  assert.doesNotMatch(indexHtml, /<script src="src\/historical-geography-data\.js/, "geography data is not a blocking script on the first page");
  const tag = indexHtml.match(/<script src="src\/grand-map\.js\?v=([\d.]+)" data-geography-src="(src\/historical-geography-data\.js)\?v=([\d.]+)"><\/script>/);
  assert.ok(tag, "grand-map.js carries the geography data address");
  assert.ok(fs.existsSync(path.join(root, tag[2])), "the lazily loaded data file exists");
  const appended = [];
  const lazy = {
    console, localStorage, requestAnimationFrame(callback) { callback(); }, window: {},
    document: { currentScript: { dataset: { geographySrc: "src/historical-geography-data.js?v=test" } }, head: { appendChild(node) { appended.push(node); } }, createElement: tagName => ({ tagName }) },
  };
  for (const file of ["src/world-data.js", "src/strategy-network-data.js", "src/army-data.js", "src/grand-map.js"]) vm.runInNewContext(read(file), lazy, { filename: file });
  const loading = lazy.window.XianGrandMap.render({ regions: {} }, { year: 196, turn: 1 });
  assert.match(loading, /data-grand-map-loading/, "map shows a loading state before its data arrives");
  assert.equal(appended.length, 1, "the data script is requested once");
  assert.equal(appended[0].src, "src/historical-geography-data.js?v=test");
  lazy.window.XianGrandMap.render({ regions: {} }, { year: 196, turn: 1 });
  assert.equal(appended.length, 1, "repeated renders reuse the pending request");
  vm.runInNewContext(read("src/historical-geography-data.js"), lazy, { filename: "src/historical-geography-data.js" });
  appended[0].onload();
  const loaded = lazy.window.XianGrandMap.render({ regions: {} }, { year: 196, turn: 1 });
  assert.match(loaded, /grand-map-viewport/, "after loading the full map renders");
  assert.equal(Object.keys(lazy.window.XianGrandMap.positions).length, 16, "city positions become available after loading");
  console.log("grand map lazy-load ok");
}
