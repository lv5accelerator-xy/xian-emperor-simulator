/* 天子蒙尘：献帝模拟器 v1.5.1 · 九州军令舆图 */
(() => {
  "use strict";

  const STRATEGY_KEY = "xian_emperor_strategy_network_v040";
  const ARMY_KEY = "xian_emperor_armies_v050";
  const PROGRESSION_KEY = "xian_emperor_progression_v100";
  const GUIDE_KEY = "xian_emperor_map_guide_v120";
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

  let state = { zoomIndex: 2, layer: "all", selectedType: null, selectedId: null, command: null, guideStep: 0 };

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

  function isFocusMode() {
    return safeParse(localStorage.getItem(PROGRESSION_KEY))?.profile?.viewMode !== "full";
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
      <section class="grand-map-shell${isFocusMode() ? " focus-map" : ""}${state.command ? " commanding" : ""}" data-map-layer="${state.layer}">
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
        </footer>${renderMapGuide()}
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
    const blocked = Number(current.blockadedUntil || 0) >= Number(strategy?.lastProcessedTurn || 0);
    return `<g class="grand-route ${level}${water ? " water" : ""}${blocked ? " blocked" : ""}" data-grand-route="${route.id}" tabindex="0" role="button" aria-label="${escapeHtml(route.name)}，军压 ${Math.round(pressure)}${blocked ? "，道路封锁" : ""}"><line class="route-hit" x1="${from[0]}" y1="${from[1]}" x2="${to[0]}" y2="${to[1]}"/><line class="route-line" x1="${from[0]}" y1="${from[1]}" x2="${to[0]}" y2="${to[1]}"/></g>`;
  }

  function renderCity(city, strategy, armies) {
    const pos = CITY_POSITIONS[city.id] || [600, 360];
    const current = cityRuntime(city, strategy);
    const controller = controllerMeta(current.controller || city.controller);
    const critical = Number(current.defense || 0) < 45 || Number(current.supply || 0) < 35;
    const priority = critical || armies.length || /中枢|门户|要冲|旧都|核心/.test(city.importance || "");
    return `<button type="button" class="grand-city${critical ? " critical" : ""}${priority ? " priority" : ""}" data-grand-city="${city.id}" style="left:${pos[0]}px;top:${pos[1]}px;--city-color:${controller.color}" aria-label="${escapeHtml(city.name)}，${escapeHtml(controller.name)}"><span></span><strong>${escapeHtml(city.name)}</strong><small>${Math.round(current.defense)}防 · ${Math.round(current.supply)}粮${armies.length ? ` · ${armies.length}军` : ""}</small></button>`;
  }

  function renderArmyMarker(cityId, armies) {
    const pos = CITY_POSITIONS[cityId];
    if (!pos || !armies.length) return "";
    const troops = armies.reduce((sum, army) => sum + Number(army.troops || 0), 0);
    const active = armies.some(army => !["idle", "defending"].includes(army.status));
    return `<button type="button" class="grand-army-marker${active ? " active" : ""}" data-grand-army-city="${cityId}" style="left:${pos[0] + 28}px;top:${pos[1] - 25}px" aria-label="${armies.length}支军团，共${formatNumber(troops)}人"><b>${armies.length}</b><span>${troops >= 10000 ? `${Math.round(troops / 1000)}k` : formatNumber(troops)}</span></button>`;
  }

  function renderOverviewInspector(core, activeArmies, criticalRoutes, weakCities) {
    const runtime = readRuntime();
    const allArmies = Object.values(runtime.army?.armies || {}).filter(army => army?.status !== "destroyed");
    const alerts = [];
    const hungry = [...allArmies].sort((a, b) => Number(a.supply || 0) - Number(b.supply || 0))[0];
    if (hungry && Number(hungry.supply || 0) <= 35) alerts.push({ type: "军粮", title: armyName(hungry), detail: `粮秣 ${Math.round(hungry.supply || 0)}`, armyCity: hungry.cityId });
    const weak = weakCities.sort((a, b) => Number(cityRuntime(a, runtime.strategy).defense || 0) - Number(cityRuntime(b, runtime.strategy).defense || 0))[0];
    if (weak) alerts.push({ type: "城防", title: weak.name, detail: `守备 ${Math.round(cityRuntime(weak, runtime.strategy).defense || 0)}`, city: weak.id });
    const hot = criticalRoutes.sort((a, b) => Number(routeRuntime(b, runtime.strategy).pressure || 0) - Number(routeRuntime(a, runtime.strategy).pressure || 0))[0];
    if (hot) alerts.push({ type: "战线", title: hot.name, detail: `军压 ${Math.round(routeRuntime(hot, runtime.strategy).pressure || 0)}`, route: hot.id });
    return `<div class="map-inspector-head"><span>总览</span><h4>御前军政图</h4><p>${escapeHtml(core ? `第 ${core.turn}/${core.maxTurns || 24} 月 · ${core.scenarioName || "本局"}` : "尚未开启本局")}</p></div>
      <div class="map-inspector-metrics"><article><span>行动军团</span><strong>${activeArmies.length}</strong></article><article><span>高压军路</span><strong>${criticalRoutes.length}</strong></article><article><span>薄弱城池</span><strong>${weakCities.length}</strong></article></div>
      <div class="map-inspector-note"><strong>本月读图顺序</strong><p>只处理下方三条关键警讯，再决定是否查看完整势力与军路。选择军团后可直接在地图下令。</p></div>
      <div class="map-inspector-list map-alert-list"><strong>本月关键警讯 · 最多三条</strong>${alerts.slice(0, 3).map(alert => `<button type="button" ${alert.city ? `data-map-locate-city="${alert.city}"` : alert.route ? `data-map-locate-route="${alert.route}"` : `data-map-locate-city="${alert.armyCity}"`}><span><em>${alert.type}</em>${escapeHtml(alert.title)}</span><b>${escapeHtml(alert.detail)} · 定位</b></button>`).join("") || "<p>本月没有必须立即处理的地图警讯。</p>"}</div>`;
  }

  function renderMapGuide() {
    if (localStorage.getItem(GUIDE_KEY) === "seen") return "";
    const steps = [
      ["先看三条警讯", "右侧只保留本月最值得处理的缺粮、薄弱城池和高压战线。"],
      ["选择军团再选城池", "点击地图上的军团标记，选择进攻、驰援、驻防、补给或撤退，然后点击目标城池。"],
      ["确认路线才会下令", "预览会显示军路、耗时、粮秣和风险；确认后才消耗一次现有行动。"],
    ];
    const step = steps[state.guideStep] || steps[0];
    return `<div class="map-guide-backdrop" data-map-guide><article><span>舆图指引 · ${state.guideStep + 1}/3</span><h4>${step[0]}</h4><p>${step[1]}</p><div><button type="button" data-map-guide-skip>跳过</button><button type="button" data-map-guide-next>${state.guideStep >= 2 ? "开始使用" : "下一步"}</button></div></article></div>`;
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

    shell.querySelectorAll("[data-grand-city]").forEach(button => button.addEventListener("click", () => state.command ? previewCommand(shell, button.dataset.grandCity) : inspectCity(shell, button.dataset.grandCity, onRegion)));
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
    shell.querySelectorAll("[data-map-locate-city]").forEach(button => button.addEventListener("click", () => locateCity(shell, button.dataset.mapLocateCity, onRegion)));
    shell.querySelectorAll("[data-map-locate-route]").forEach(button => button.addEventListener("click", () => locateRoute(shell, button.dataset.mapLocateRoute)));
    shell.querySelector("[data-map-guide-skip]")?.addEventListener("click", () => finishGuide(shell));
    shell.querySelector("[data-map-guide-next]")?.addEventListener("click", () => {
      if (state.guideStep >= 2) return finishGuide(shell);
      state.guideStep += 1;
      const guide = shell.querySelector("[data-map-guide]");
      if (guide) {
        guide.outerHTML = renderMapGuide();
        bindGuide(shell);
      }
    });
    bindDrag(viewport);
    requestAnimationFrame(() => {
      viewport.scrollLeft = Math.max(0, (viewport.scrollWidth - viewport.clientWidth) * .45);
      viewport.scrollTop = Math.max(0, (viewport.scrollHeight - viewport.clientHeight) * .38);
    });
  }

  function bindGuide(shell) {
    shell.querySelector("[data-map-guide-skip]")?.addEventListener("click", () => finishGuide(shell));
    shell.querySelector("[data-map-guide-next]")?.addEventListener("click", () => {
      if (state.guideStep >= 2) return finishGuide(shell);
      state.guideStep += 1;
      const guide = shell.querySelector("[data-map-guide]");
      if (guide) { guide.outerHTML = renderMapGuide(); bindGuide(shell); }
    });
  }

  function finishGuide(shell) {
    localStorage.setItem(GUIDE_KEY, "seen");
    shell.querySelector("[data-map-guide]")?.remove();
    state.guideStep = 0;
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

  function locateCity(shell, id, onRegion) {
    const viewport = shell.querySelector("[data-grand-viewport]");
    const pos = CITY_POSITIONS[id];
    if (viewport && pos) {
      const scale = ZOOMS[state.zoomIndex];
      viewport.scrollTo?.({ left: Math.max(0, pos[0] * scale - viewport.clientWidth / 2), top: Math.max(0, pos[1] * scale - viewport.clientHeight / 2), behavior: "smooth" });
    }
    inspectCity(shell, id, onRegion);
  }

  function locateRoute(shell, id) {
    const route = window.XIAN_STRATEGY_DATA?.routes?.find(item => item.id === id);
    if (!route) return;
    const from = CITY_POSITIONS[route.from];
    const to = CITY_POSITIONS[route.to];
    const viewport = shell.querySelector("[data-grand-viewport]");
    if (viewport && from && to) {
      const scale = ZOOMS[state.zoomIndex];
      viewport.scrollTo?.({ left: Math.max(0, ((from[0] + to[0]) / 2) * scale - viewport.clientWidth / 2), top: Math.max(0, ((from[1] + to[1]) / 2) * scale - viewport.clientHeight / 2), behavior: "smooth" });
    }
    inspectRoute(shell, id);
  }

  function beginCommand(shell, armyId, task) {
    state.command = { armyId, task };
    shell.classList.add("commanding");
    shell.querySelectorAll(".grand-city").forEach(city => city.classList.add("command-target"));
    const armyState = readRuntime().army?.armies?.[armyId];
    inspector(shell).innerHTML = `<div class="map-inspector-head"><span>正在下令</span><h4>${escapeHtml(armyName(armyState))}</h4><p>${escapeHtml(window.XIAN_ARMY_DATA?.taskLabels?.[task] || task)} · 当前位于${escapeHtml(window.XIAN_STRATEGY_DATA?.cities?.find(city => city.id === armyState?.cityId)?.name || "未知")}</p></div><div class="map-command-prompt"><strong>请选择目标城池</strong><p>地图上所有城池均可点击；下一步只会生成路线预览，不会立刻消耗行动。</p></div><button type="button" class="map-command-cancel" data-map-command-cancel>取消军令</button>`;
    bindInspectorActions(shell);
  }

  function previewCommand(shell, targetCityId) {
    if (!state.command) return;
    const preview = window.XianArmySystem?.previewMapOrder?.(state.command.armyId, targetCityId, state.command.task);
    if (!preview?.ok) {
      inspector(shell).innerHTML = `<div class="map-inspector-head"><span>无法下令</span><h4>路线复核未通过</h4><p>${escapeHtml(preview?.message || "军令资料不足")}</p></div><button type="button" class="map-command-cancel" data-map-command-cancel>重新选择军令</button>`;
      bindInspectorActions(shell);
      return;
    }
    inspector(shell).innerHTML = `<div class="map-inspector-head"><span>军令复核</span><h4>${escapeHtml(preview.armyName)} · ${escapeHtml(preview.taskLabel)}</h4><p>${escapeHtml(preview.originName)} → ${escapeHtml(preview.targetName)}</p></div><div class="map-command-route"><strong>预计路线</strong><p>${preview.routeNames.length ? preview.routeNames.map(escapeHtml).join(" → ") : "就地执行，无需跨城行军"}</p></div><div class="map-inspector-metrics"><article><span>预计耗时</span><strong>${preview.eta}月</strong></article><article><span>粮秣消耗</span><strong>约${preview.estimatedSupplyCost}</strong></article><article><span>执行度</span><strong>${preview.execution}%</strong></article></div>${preview.warnings.length ? `<div class="map-command-warnings"><strong>行军提醒</strong>${preview.warnings.map(item => `<p>· ${escapeHtml(item)}</p>`).join("")}</div>` : '<div class="map-command-safe">当前路线没有额外高风险提示。</div>'}<div class="map-command-confirm"><button type="button" data-map-command-cancel>返回</button><button type="button" data-map-command-confirm data-army-id="${preview.armyId}" data-target-city="${preview.targetCityId}" data-task="${preview.task}">确认下令</button></div>`;
    bindInspectorActions(shell);
  }

  function bindInspectorActions(shell) {
    inspector(shell).querySelectorAll("[data-map-command-army]").forEach(button => button.addEventListener("click", () => beginCommand(shell, button.dataset.mapCommandArmy, button.dataset.mapCommandTask)));
    inspector(shell).querySelectorAll("[data-map-command-cancel]").forEach(button => button.addEventListener("click", () => {
      const previousArmyId = state.command?.armyId;
      const previousCityId = readRuntime().army?.armies?.[previousArmyId]?.cityId || "xudu";
      state.command = null;
      shell.classList.remove("commanding");
      shell.querySelectorAll(".grand-city").forEach(city => city.classList.remove("command-target"));
      inspectArmies(shell, previousCityId);
    }));
    inspector(shell).querySelector("[data-map-command-confirm]")?.addEventListener("click", event => {
      const button = event.currentTarget;
      const result = window.XianArmySystem?.issueMapOrder?.(button.dataset.armyId, button.dataset.targetCity, button.dataset.task);
      if (!result?.ok) {
        inspector(shell).insertAdjacentHTML("beforeend", `<p class="map-command-error">${escapeHtml(result?.message || "军令未能执行")}</p>`);
        return;
      }
      state.command = null;
      shell.classList.remove("commanding");
      inspector(shell).innerHTML = `<div class="map-command-success"><span>✓</span><h4>军令已经下达</h4><p>${escapeHtml(result.armyName)}将${escapeHtml(result.taskLabel)}至${escapeHtml(result.targetName)}，预计${result.eta}个月。</p><small>本次使用现有行动次数，详细记录已写入军团与御前实录。</small></div>`;
    });
  }

  function inspectCity(shell, id, onRegion) {
    const city = window.XIAN_STRATEGY_DATA?.cities?.find(item => item.id === id);
    if (!city) return;
    const runtime = readRuntime();
    const current = cityRuntime(city, runtime.strategy);
    const controller = controllerMeta(current.controller || city.controller);
    const armies = Object.values(runtime.army?.armies || {}).filter(army => army?.cityId === id && army.status !== "destroyed");
    const pressure = Number(current.pressure || 0);
    const advice = Number(current.supply || 0) < 35 ? "优先转运粮秣；继续增兵会加快库存消耗。" : Number(current.defense || 0) < 45 ? "城防偏低，适合派军驻防或任命人物镇守。" : pressure >= 65 ? "周边军压较高，先查看相连军路再决定是否出战。" : armies.length ? "驻军和补给尚可，可作为驰援或进攻起点。" : "局势暂稳，可保留行动处理更紧迫的战线。";
    inspector(shell).innerHTML = `<div class="map-inspector-head"><span>城池</span><h4>${escapeHtml(city.name)}</h4><p>${escapeHtml(city.importance)} · ${escapeHtml(controller.name)}</p></div>${gauge("城防", current.defense)}${gauge("粮秣", current.supply)}${gauge("朝廷向心", current.courtLoyalty)}<div class="map-inspector-note"><strong>驻军</strong><p>${armies.length ? `${armies.map(army => escapeHtml(armyName(army))).join("、")}，合计 ${formatNumber(armies.reduce((sum, army) => sum + Number(army.troops || 0), 0))} 人。` : "当前没有成建制军团驻扎。"}</p></div><div class="map-city-advice"><strong>建议操作</strong><p>${escapeHtml(advice)}</p></div><button type="button" class="map-inspector-primary" data-open-region="${city.regionId}">查看州郡完整档案</button>`;
    inspector(shell).querySelector("[data-open-region]")?.addEventListener("click", () => onRegion?.(city.regionId));
  }

  function inspectRoute(shell, id) {
    const route = window.XIAN_STRATEGY_DATA?.routes?.find(item => item.id === id);
    if (!route) return;
    const runtime = readRuntime();
    const current = routeRuntime(route, runtime.strategy);
    const from = window.XIAN_STRATEGY_DATA.cities.find(item => item.id === route.from);
    const to = window.XIAN_STRATEGY_DATA.cities.find(item => item.id === route.to);
    const blocked = Number(current.blockadedUntil || 0) >= Number(runtime.strategy?.lastProcessedTurn || 0);
    inspector(shell).innerHTML = `<div class="map-inspector-head"><span>${escapeHtml(route.type)} · 军路${blocked ? " · 已封锁" : ""}</span><h4>${escapeHtml(route.name)}</h4><p>${escapeHtml(from?.name)} → ${escapeHtml(to?.name)} · ${escapeHtml(route.terrain)}</p></div>${gauge("补给通畅", current.supply)}${gauge("军事压力", current.pressure, true)}<div class="map-inspector-note"><strong>御前判断</strong><p>${blocked ? "道路正被封锁，军团可能停滞并遭受额外减员；可转运补给、改道或等待封锁解除。" : Number(current.pressure) >= 70 ? "此路已接近战线激化，应先补给、调兵或降低附近军压。" : Number(current.supply) < 40 ? "此路补给困难，大军经过容易停滞与减员。" : "此路目前尚可通行，可用于转运、驰援或建立外部联系。"}</p></div><small class="map-inspector-change">${escapeHtml(current.lastChange || "暂无最新军路变化")}</small>`;
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
    inspector(shell).innerHTML = `<div class="map-inspector-head"><span>军团集群</span><h4>${escapeHtml(city?.name || "城外")}</h4><p>${armies.length} 支军团 · ${formatNumber(armies.reduce((sum, army) => sum + Number(army.troops || 0), 0))} 人</p></div><div class="map-army-list">${armies.map(army => `<article><div><strong>${escapeHtml(armyName(army))}</strong><span>${escapeHtml(armyStatus(army))}</span></div><p>${formatNumber(army.troops)} 人 · 士气 ${Math.round(army.morale || 0)} · 粮秣 ${Math.round(army.supply || 0)}</p><small>${escapeHtml(army.lastChange || "暂无最新变化")}</small><div class="map-army-actions">${[["attack","进攻"],["support","驰援"],["defend","驻防"],["supply","补给"],["retreat","撤退"]].map(([task,label]) => `<button type="button" data-map-command-army="${army.id}" data-map-command-task="${task}">${label}</button>`).join("")}</div></article>`).join("")}</div>`;
    bindInspectorActions(shell);
  }

  function gauge(label, value, dangerHigh = false) {
    const safe = clamp(value, 0, 100);
    return `<div class="map-inspector-gauge${dangerHigh ? " danger-high" : ""}"><div><span>${label}</span><strong>${Math.round(safe)}</strong></div><i><b style="width:${safe}%"></b></i></div>`;
  }

  window.XianGrandMap = Object.freeze({ render, bind, positions: CITY_POSITIONS });
})();
