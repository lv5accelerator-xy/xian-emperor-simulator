/* 天子蒙尘：献帝模拟器 v1.1.0 · 九州大地图 */
(() => {
  "use strict";

  const STRATEGY_KEY = "xian_emperor_strategy_network_v040";
  const ARMY_KEY = "xian_emperor_armies_v050";
  const WIDTH = 1200;
  const HEIGHT = 720;
  const ZOOMS = [0.72, 0.88, 1, 1.18, 1.38, 1.62];

  const CITY_POSITIONS = {
    wuwei: [105, 215], changan: [305, 315], luoyang: [485, 300], xudu: [600, 350],
    nanzheng: [335, 435], chengdu: [185, 555], xiangyang: [535, 515], wan: [535, 420],
    shouchun: [755, 470], wujun: [955, 570], xiapi: [855, 365], linzi: [925, 255],
    ye: [730, 210], jinyang: [495, 160], ji: [885, 105], guangxin: [555, 660],
  };

  const REGION_SHAPES = {
    liangzhou: "M32 140 L235 130 L278 230 L208 294 L48 270 Z",
    guanzhong: "M218 246 L390 238 L452 318 L386 394 L236 374 L182 300 Z",
    yizhou: "M70 405 L300 390 L360 492 L310 656 L122 680 L48 555 Z",
    hanzhong: "M278 365 L450 360 L494 452 L390 492 L300 448 Z",
    jingzhou: "M430 392 L644 380 L706 522 L620 612 L425 570 L385 480 Z",
    jiaozhou: "M310 570 L688 580 L700 708 L284 708 Z",
    jiangdong: "M756 488 L1110 448 L1168 596 L1020 674 L770 610 Z",
    huainan: "M650 386 L838 375 L892 488 L748 540 L650 500 Z",
    sili_yuzhou: "M424 245 L674 245 L700 388 L620 430 L450 390 L390 310 Z",
    xuzhou: "M794 298 L1042 292 L1060 440 L890 490 L790 408 Z",
    qingzhou: "M820 188 L1090 170 L1124 310 L1010 346 L812 298 Z",
    jizhou: "M620 120 L842 112 L876 245 L792 304 L640 268 L584 185 Z",
    bingzhou: "M390 80 L632 72 L638 225 L540 274 L382 218 Z",
    youzhou: "M790 34 L1138 28 L1148 180 L900 224 L810 158 Z",
  };

  let state = { zoomIndex: 2, layer: "all", selectedType: null, selectedId: null };

  function safeParse(raw) {
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (_) { return null; }
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }

  function clamp(value, min, max) { return Math.min(max, Math.max(min, Number(value) || 0)); }
  function formatNumber(value) { return Math.max(0, Number(value) || 0).toLocaleString("zh-CN"); }

  function readRuntime() {
    const strategy = safeParse(localStorage.getItem(STRATEGY_KEY)) || {};
    const army = safeParse(localStorage.getItem(ARMY_KEY)) || {};
    return { strategy, army };
  }

  function cityRuntime(city, strategy) { return strategy?.cities?.[city.id] || city; }
  function routeRuntime(route, strategy) { return strategy?.routes?.[route.id] || route; }

  function controllerMeta(controllerId) {
    const world = window.XIAN_WORLD_DATA?.controllers || {};
    return world[controllerId] || world.fragmented || { name: controllerId || "未定", color: "#6b6258", text: "#fff" };
  }

  function armyName(army) {
    return army?.name || window.XIAN_ARMY_DATA?.armies?.find(item => item.id === army?.id)?.name || army?.id || "无名军团";
  }

  function armyStatus(army) {
    return window.XIAN_ARMY_DATA?.statusLabels?.[army?.status] || window.XIAN_ARMY_DATA?.taskLabels?.[army?.status] || army?.status || "驻扎";
  }

  function armiesByCity(armyState) {
    const grouped = {};
    Object.values(armyState?.armies || {}).filter(item => item && item.status !== "destroyed").forEach(item => {
      const id = item.cityId || item.targetCityId;
      if (!id) return;
      (grouped[id] ||= []).push(item);
    });
    return grouped;
  }

  function render(worldState, coreState) {
    const strategyData = window.XIAN_STRATEGY_DATA || { cities: [], routes: [] };
    const worldData = window.XIAN_WORLD_DATA || { regions: [], controllers: {} };
    const runtime = readRuntime();
    const cityArmies = armiesByCity(runtime.army);
    const activeArmies = Object.values(runtime.army?.armies || {}).filter(item => item?.status && !["idle", "defending", "destroyed"].includes(item.status));
    const criticalRoutes = strategyData.routes.filter(route => Number(routeRuntime(route, runtime.strategy).pressure || 0) >= 62);
    const weakCities = strategyData.cities.filter(city => Number(cityRuntime(city, runtime.strategy).defense || 0) < 45);
    const regionStates = worldState?.regions || Object.fromEntries(worldData.regions.map(region => [region.id, region]));

    return `
      <section class="grand-map-shell" data-map-layer="${state.layer}">
        <header class="grand-map-toolbar">
          <div><span class="section-kicker">九州军政总览</span><h3>汉末天下大地图</h3><p>势力、城池、军路、军团与战线汇于一图</p></div>
          <div class="grand-map-actions" aria-label="地图图层">
            ${layerButton("all", "全局")}${layerButton("politics", "势力")}${layerButton("routes", "军路")}${layerButton("armies", "军团")}${layerButton("pressure", "战线")}
          </div>
          <div class="grand-map-zoom" aria-label="地图缩放">
            <button type="button" data-map-zoom="out" aria-label="缩小地图">−</button>
            <button type="button" data-map-zoom="reset" class="zoom-readout">${Math.round(ZOOMS[state.zoomIndex] * 100)}%</button>
            <button type="button" data-map-zoom="in" aria-label="放大地图">＋</button>
          </div>
        </header>
        <div class="grand-map-layout">
          <div class="grand-map-viewport" data-grand-viewport tabindex="0" aria-label="可拖动的汉末天下地图">
            <div class="grand-map-zoom-space" data-map-space>
              <div class="grand-map-stage" data-map-stage style="--map-width:${WIDTH}px;--map-height:${HEIGHT}px">
                <svg class="grand-map-terrain" viewBox="0 0 ${WIDTH} ${HEIGHT}" aria-hidden="true">
                  <defs>
                    <linearGradient id="mapPaper" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#17201d"/><stop offset=".5" stop-color="#101715"/><stop offset="1" stop-color="#171310"/></linearGradient>
                    <filter id="mapGlow"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
                    <pattern id="mapGrid" width="42" height="42" patternUnits="userSpaceOnUse"><path d="M42 0H0V42" fill="none" stroke="rgba(214,188,128,.055)" stroke-width="1"/></pattern>
                  </defs>
                  <rect width="1200" height="720" fill="url(#mapPaper)"/><rect width="1200" height="720" fill="url(#mapGrid)"/>
                  <g class="terrain-ridges"><path d="M60 365Q210 310 330 350T590 305T850 330T1140 285"/><path d="M280 85Q330 160 420 190T575 310"/><path d="M100 520Q230 470 345 525T600 570"/></g>
                  <g class="terrain-rivers"><path d="M250 360Q450 335 610 365T930 430T1160 530"/><path d="M505 210Q620 270 690 390T840 610"/></g>
                  <g class="grand-regions">${worldData.regions.map(region => renderRegion(region, regionStates[region.id])).join("")}</g>
                  <g class="grand-routes">${strategyData.routes.map(route => renderRoute(route, runtime.strategy)).join("")}</g>
                </svg>
                <div class="grand-city-layer">${strategyData.cities.map(city => renderCity(city, runtime.strategy, cityArmies[city.id] || [])).join("")}</div>
                <div class="grand-army-layer">${Object.entries(cityArmies).map(([cityId, armies]) => renderArmyMarker(cityId, armies)).join("")}</div>
                <div class="grand-map-compass" aria-hidden="true"><b>北</b><i></i><span>九州</span></div>
              </div>
            </div>
          </div>
          <aside class="grand-map-inspector" data-map-inspector>${renderOverviewInspector(coreState, activeArmies, criticalRoutes, weakCities)}</aside>
        </div>
        <footer class="grand-map-legend">
          <span><i class="legend-city"></i>城池</span><span><i class="legend-route"></i>军路</span><span><i class="legend-hot"></i>高压战线</span><span><i class="legend-army"></i>军团</span>
          <p>拖动画面平移；点击城池、军路或军团查看详情。地图为策略示意，不代表精确古代疆界。</p>
        </footer>
      </section>`;
  }

  function layerButton(id, label) {
    return `<button type="button" data-map-layer="${id}" aria-pressed="${state.layer === id}">${label}</button>`;
  }

  function renderRegion(region, runtime) {
    const controller = controllerMeta(runtime?.controller || region.controller);
    const path = REGION_SHAPES[region.id] || "";
    return `<path class="grand-region" data-grand-region="${region.id}" d="${path}" style="--region-color:${controller.color}" tabindex="0" role="button" aria-label="${escapeHtml(region.name)}，${escapeHtml(controller.name)}"/>`;
  }

  function renderRoute(route, strategy) {
    const from = CITY_POSITIONS[route.from];
    const to = CITY_POSITIONS[route.to];
    if (!from || !to) return "";
    const current = routeRuntime(route, strategy);
    const pressure = clamp(current.pressure, 0, 100);
    const level = pressure >= 70 ? "critical" : pressure >= 55 ? "tense" : "open";
    const water = /水/.test(route.type);
    return `<g class="grand-route ${level}${water ? " water" : ""}" data-grand-route="${route.id}" tabindex="0" role="button" aria-label="${escapeHtml(route.name)}，军压 ${Math.round(pressure)}"><line class="route-hit" x1="${from[0]}" y1="${from[1]}" x2="${to[0]}" y2="${to[1]}"/><line class="route-line" x1="${from[0]}" y1="${from[1]}" x2="${to[0]}" y2="${to[1]}"/></g>`;
  }

  function renderCity(city, strategy, armies) {
    const pos = CITY_POSITIONS[city.id] || [600, 360];
    const current = cityRuntime(city, strategy);
    const controller = controllerMeta(current.controller || city.controller);
    const critical = Number(current.defense || 0) < 45 || Number(current.supply || 0) < 35;
    return `<button type="button" class="grand-city${critical ? " critical" : ""}" data-grand-city="${city.id}" style="left:${pos[0]}px;top:${pos[1]}px;--city-color:${controller.color}" aria-label="${escapeHtml(city.name)}，${escapeHtml(controller.name)}"><span></span><strong>${escapeHtml(city.name)}</strong><small>${Math.round(current.defense)}防 · ${Math.round(current.supply)}粮${armies.length ? ` · ${armies.length}军` : ""}</small></button>`;
  }

  function renderArmyMarker(cityId, armies) {
    const pos = CITY_POSITIONS[cityId];
    if (!pos || !armies.length) return "";
    const troops = armies.reduce((sum, army) => sum + Number(army.troops || 0), 0);
    const active = armies.some(army => !["idle", "defending"].includes(army.status));
    return `<button type="button" class="grand-army-marker${active ? " active" : ""}" data-grand-army-city="${cityId}" style="left:${pos[0] + 28}px;top:${pos[1] - 25}px" aria-label="${armies.length}支军团，共${formatNumber(troops)}人"><b>${armies.length}</b><span>${troops >= 10000 ? `${Math.round(troops / 1000)}k` : formatNumber(troops)}</span></button>`;
  }

  function renderOverviewInspector(core, activeArmies, criticalRoutes, weakCities) {
    return `<div class="map-inspector-head"><span>总览</span><h4>御前军政图</h4><p>${escapeHtml(core ? `第 ${core.turn}/${core.maxTurns || 24} 月 · ${core.scenarioName || "本局"}` : "尚未开启本局")}</p></div>
      <div class="map-inspector-metrics"><article><span>行动军团</span><strong>${activeArmies.length}</strong></article><article><span>高压军路</span><strong>${criticalRoutes.length}</strong></article><article><span>薄弱城池</span><strong>${weakCities.length}</strong></article></div>
      <div class="map-inspector-note"><strong>阅读地图</strong><p>先看红色军路与发光军团，再检查低防、缺粮城池。切换图层可隐藏无关信息，减少一次处理的内容。</p></div>
      <div class="map-inspector-list"><strong>当前警讯</strong>${criticalRoutes.slice(0, 4).map(route => `<button type="button" data-grand-route="${route.id}"><span>${escapeHtml(route.name)}</span><b>军压 ${Math.round(routeRuntime(route, readRuntime().strategy).pressure)}</b></button>`).join("") || "<p>暂无高压军路。</p>"}</div>`;
  }

  function bind(root, onRegion) {
    const shell = root?.querySelector?.(".grand-map-shell");
    if (!shell) return;
    const viewport = shell.querySelector("[data-grand-viewport]");
    applyZoom(shell);

    shell.querySelectorAll("[data-map-layer]").forEach(button => button.addEventListener("click", () => {
      state.layer = button.dataset.mapLayer;
      shell.dataset.mapLayer = state.layer;
      shell.querySelectorAll("[data-map-layer]").forEach(item => item.setAttribute("aria-pressed", String(item.dataset.mapLayer === state.layer)));
    }));

    shell.querySelectorAll("[data-map-zoom]").forEach(button => button.addEventListener("click", () => {
      const command = button.dataset.mapZoom;
      state.zoomIndex = command === "reset" ? 2 : clamp(state.zoomIndex + (command === "in" ? 1 : -1), 0, ZOOMS.length - 1);
      applyZoom(shell);
    }));

    shell.querySelectorAll("[data-grand-city]").forEach(button => button.addEventListener("click", () => inspectCity(shell, button.dataset.grandCity, onRegion)));
    shell.querySelectorAll("[data-grand-route]").forEach(button => {
      const open = () => inspectRoute(shell, button.dataset.grandRoute);
      button.addEventListener("click", open);
      button.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); } });
    });
    shell.querySelectorAll("[data-grand-region]").forEach(region => {
      const open = () => inspectRegion(shell, region.dataset.grandRegion, onRegion);
      region.addEventListener("click", open);
      region.addEventListener("keydown", event => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); open(); } });
    });
    shell.querySelectorAll("[data-grand-army-city]").forEach(button => button.addEventListener("click", () => inspectArmies(shell, button.dataset.grandArmyCity)));
    bindDrag(viewport);
    requestAnimationFrame(() => {
      viewport.scrollLeft = Math.max(0, (viewport.scrollWidth - viewport.clientWidth) * .45);
      viewport.scrollTop = Math.max(0, (viewport.scrollHeight - viewport.clientHeight) * .38);
    });
  }

  function applyZoom(shell) {
    const scale = ZOOMS[state.zoomIndex];
    const stage = shell.querySelector("[data-map-stage]");
    const space = shell.querySelector("[data-map-space]");
    if (!stage || !space) return;
    stage.style.transform = `scale(${scale})`;
    space.style.width = `${WIDTH * scale}px`;
    space.style.height = `${HEIGHT * scale}px`;
    const readout = shell.querySelector('[data-map-zoom="reset"]');
    if (readout) readout.textContent = `${Math.round(scale * 100)}%`;
  }

  function bindDrag(viewport) {
    if (!viewport) return;
    let drag = null;
    viewport.addEventListener("pointerdown", event => {
      if (event.target.closest("button,[role=button]")) return;
      drag = { x: event.clientX, y: event.clientY, left: viewport.scrollLeft, top: viewport.scrollTop };
      viewport.classList.add("dragging");
      viewport.setPointerCapture?.(event.pointerId);
    });
    viewport.addEventListener("pointermove", event => {
      if (!drag) return;
      viewport.scrollLeft = drag.left - (event.clientX - drag.x);
      viewport.scrollTop = drag.top - (event.clientY - drag.y);
    });
    const stop = () => { drag = null; viewport.classList.remove("dragging"); };
    viewport.addEventListener("pointerup", stop);
    viewport.addEventListener("pointercancel", stop);
  }

  function inspector(shell) { return shell.querySelector("[data-map-inspector]"); }

  function inspectCity(shell, id, onRegion) {
    const city = window.XIAN_STRATEGY_DATA?.cities?.find(item => item.id === id);
    if (!city) return;
    const runtime = readRuntime();
    const current = cityRuntime(city, runtime.strategy);
    const controller = controllerMeta(current.controller || city.controller);
    const armies = Object.values(runtime.army?.armies || {}).filter(army => army?.cityId === id && army.status !== "destroyed");
    inspector(shell).innerHTML = `<div class="map-inspector-head"><span>城池</span><h4>${escapeHtml(city.name)}</h4><p>${escapeHtml(city.importance)} · ${escapeHtml(controller.name)}</p></div>${gauge("城防", current.defense)}${gauge("粮秣", current.supply)}${gauge("朝廷向心", current.courtLoyalty)}<div class="map-inspector-note"><strong>驻军</strong><p>${armies.length ? `${armies.map(army => escapeHtml(armyName(army))).join("、")}，合计 ${formatNumber(armies.reduce((sum, army) => sum + Number(army.troops || 0), 0))} 人。` : "当前没有成建制军团驻扎。"}</p></div><button type="button" class="map-inspector-primary" data-open-region="${city.regionId}">查看州郡完整档案</button>`;
    inspector(shell).querySelector("[data-open-region]")?.addEventListener("click", () => onRegion?.(city.regionId));
  }

  function inspectRoute(shell, id) {
    const route = window.XIAN_STRATEGY_DATA?.routes?.find(item => item.id === id);
    if (!route) return;
    const current = routeRuntime(route, readRuntime().strategy);
    const from = window.XIAN_STRATEGY_DATA.cities.find(item => item.id === route.from);
    const to = window.XIAN_STRATEGY_DATA.cities.find(item => item.id === route.to);
    inspector(shell).innerHTML = `<div class="map-inspector-head"><span>${escapeHtml(route.type)} · 军路</span><h4>${escapeHtml(route.name)}</h4><p>${escapeHtml(from?.name)} → ${escapeHtml(to?.name)} · ${escapeHtml(route.terrain)}</p></div>${gauge("补给通畅", current.supply)}${gauge("军事压力", current.pressure, true)}<div class="map-inspector-note"><strong>御前判断</strong><p>${Number(current.pressure) >= 70 ? "此路已接近战线激化，应先补给、调兵或降低附近军压。" : Number(current.supply) < 40 ? "此路补给困难，大军经过容易停滞与减员。" : "此路目前尚可通行，可用于转运、驰援或建立外部联系。"}</p></div><small class="map-inspector-change">${escapeHtml(current.lastChange || "暂无最新军路变化")}</small>`;
  }

  function inspectRegion(shell, id, onRegion) {
    const region = window.XIAN_WORLD_DATA?.regions?.find(item => item.id === id);
    if (!region) return;
    const worldState = safeParse(localStorage.getItem("xian_emperor_world_v020"));
    const current = worldState?.regions?.[id] || region;
    const controller = controllerMeta(current.controller || region.controller);
    inspector(shell).innerHTML = `<div class="map-inspector-head"><span>${escapeHtml(region.importance)}</span><h4>${escapeHtml(region.name)}</h4><p>${escapeHtml(region.capital)} · ${escapeHtml(controller.name)}</p></div>${gauge("地方稳定", current.stability)}${gauge("军事压力", current.military, true)}${gauge("朝廷态度", current.courtAttitude)}<div class="map-inspector-note"><strong>局势摘要</strong><p>${escapeHtml(region.summary)}</p></div><button type="button" class="map-inspector-primary" data-open-region="${id}">打开州郡档案与急递</button>`;
    inspector(shell).querySelector("[data-open-region]")?.addEventListener("click", () => onRegion?.(id));
  }

  function inspectArmies(shell, cityId) {
    const runtime = readRuntime();
    const armies = Object.values(runtime.army?.armies || {}).filter(army => army?.cityId === cityId && army.status !== "destroyed");
    const city = window.XIAN_STRATEGY_DATA?.cities?.find(item => item.id === cityId);
    inspector(shell).innerHTML = `<div class="map-inspector-head"><span>军团集群</span><h4>${escapeHtml(city?.name || "城外")}</h4><p>${armies.length} 支军团 · ${formatNumber(armies.reduce((sum, army) => sum + Number(army.troops || 0), 0))} 人</p></div><div class="map-army-list">${armies.map(army => `<article><div><strong>${escapeHtml(armyName(army))}</strong><span>${escapeHtml(armyStatus(army))}</span></div><p>${formatNumber(army.troops)} 人 · 士气 ${Math.round(army.morale || 0)} · 粮秣 ${Math.round(army.supply || 0)}</p><small>${escapeHtml(army.lastChange || "暂无最新变化")}</small></article>`).join("")}</div>`;
  }

  function gauge(label, value, dangerHigh = false) {
    const safe = clamp(value, 0, 100);
    return `<div class="map-inspector-gauge${dangerHigh ? " danger-high" : ""}"><div><span>${label}</span><strong>${Math.round(safe)}</strong></div><i><b style="width:${safe}%"></b></i></div>`;
  }

  window.XianGrandMap = Object.freeze({ render, bind, positions: CITY_POSITIONS });
})();
