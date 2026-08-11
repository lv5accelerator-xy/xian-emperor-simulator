/*
 * 天子蒙尘：献帝模拟器 v0.7.0
 * 城池节点、战争路线、诸侯方略与外交承诺系统。
 */
(() => {
  "use strict";

  const DATA = window.XIAN_STRATEGY_DATA;
  if (!DATA) {
    console.error("XIAN_STRATEGY_DATA 未加载，军略网络无法启动。");
    return;
  }

  const GAME_SAVE_KEY = "xian_emperor_simulator_v01";
  const WORLD_SAVE_KEY = "xian_emperor_world_v020";
  const STORAGE_KEY = "xian_emperor_strategy_network_v040";
  const VERSION = "0.7.0";
  const MAX_LOG = 60;
  const MAX_PROMISES = 40;

  let state = null;
  let coreState = null;
  let activeTab = "cities";
  let initialized = false;
  let processTimer = null;

  installStorageWatcher();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

  function installStorageWatcher() {
    if (window.__xianStrategyNetworkWatcherInstalled) return;
    window.__xianStrategyNetworkWatcherInstalled = true;
    const previousSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function strategyAwareSetItem(key, value) {
      previousSetItem.apply(this, arguments);
      if (!window.__xianFullSaveImporting && this === localStorage && key === GAME_SAVE_KEY) {
        window.clearTimeout(processTimer);
        processTimer = window.setTimeout(() => processCoreSave(value), 90);
      }
    };
  }

  function init() {
    if (initialized) return;
    initialized = true;
    installNavButton();
    installBrief();
    installOverlay();
    processCoreSave(localStorage.getItem(GAME_SAVE_KEY), true);
  }

  function processCoreSave(raw, firstLoad = false) {
    const core = safeParse(raw);
    if (!isValidCore(core)) {
      coreState = null;
      state = loadState();
      renderAll();
      return;
    }

    coreState = core;
    const loaded = loadState();
    if (!loaded || loaded.gameCreatedAt !== core.createdAt) {
      state = createState(core);
      saveState();
      renderAll();
      return;
    }

    state = migrateState(loaded, core);
    processNewReports(core);
    processElapsedTurns(core);
    state.updatedAt = new Date().toISOString();
    saveState();
    renderAll();

    if (!firstLoad && document.getElementById("strategy-network-overlay")?.classList.contains("hidden") === false) {
      renderOverlay();
    }
  }

  function isValidCore(core) {
    return Boolean(core && typeof core === "object" && Number.isFinite(core.turn) && core.stats && core.hidden);
  }

  function safeParse(raw) {
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (_) { return null; }
  }

  function loadState() {
    return safeParse(localStorage.getItem(STORAGE_KEY));
  }

  function saveState() {
    if (!state) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (error) { console.warn("军略网络保存失败", error); }
  }

  function createState(core) {
    const scenario = (window.GAME_DATA?.scenarios || []).find(item => item.id === core.scenarioId) || {};
    const cities = {};
    DATA.cities.forEach(city => {
      const override = scenario.cityOverrides?.[city.id] || {};
      cities[city.id] = {
        controller: override.controller || city.controller,
        controllerName: override.controllerName || city.controllerName,
        defense: clamp(override.defense ?? city.defense, 0, 100),
        supply: clamp(override.supply ?? city.supply, 0, 100),
        courtLoyalty: clamp(override.courtLoyalty ?? city.courtLoyalty, 0, 100),
        pressure: clamp(override.pressure ?? 20, 0, 100),
        lastChange: scenario.id ? `${scenario.name}开局态势` : "开局态势",
      };
    });

    const routes = {};
    DATA.routes.forEach(route => {
      routes[route.id] = {
        supply: route.supply,
        pressure: route.pressure,
        status: routeStatus(route.supply, route.pressure),
        lastChange: "开局通路",
      };
    });

    const strategies = {
      court: { lordId: "court", objective: "维持诏令交通与许都安全", order: "administration", targetCities: ["xudu"], routeIds: [], readiness: 48, trust: 100, orderedTurn: core.turn, lastChange: "开局方略" },
    };
    DATA.lords.forEach(lord => {
      const worldLord = readWorldLord(lord.id);
      strategies[lord.id] = {
        lordId: lord.id,
        objective: lord.defaultObjective,
        order: "watch",
        targetCities: [lord.seatCity],
        routeIds: [],
        readiness: clamp(Math.round((worldLord?.power ?? 55) * 0.62), 20, 90),
        trust: clamp(Math.round(worldLord?.courtNeed ?? 50), 5, 95),
        orderedTurn: core.turn,
        lastChange: "尚在观望",
      };
    });

    return {
      version: VERSION,
      gameCreatedAt: core.createdAt,
      lastReportTimestamp: latestTimestamp(core.reports),
      lastProcessedTurn: core.turn,
      cities,
      routes,
      strategies,
      promises: [],
      log: [{ id: `opening-${Date.now()}`, turn: core.turn, type: "system", text: "尚书台建立城池、驿道、军路与诸侯承诺档案。" }],
      updatedAt: new Date().toISOString(),
    };
  }

  function migrateState(current, core) {
    const migrated = {
      ...current,
      version: VERSION,
      gameCreatedAt: core.createdAt,
      cities: { ...(current.cities || {}) },
      routes: { ...(current.routes || {}) },
      strategies: { ...(current.strategies || {}) },
      promises: Array.isArray(current.promises) ? current.promises : [],
      log: Array.isArray(current.log) ? current.log : [],
      lastReportTimestamp: Number(current.lastReportTimestamp) || 0,
      lastProcessedTurn: Number.isFinite(current.lastProcessedTurn) ? current.lastProcessedTurn : core.turn,
    };

    DATA.cities.forEach(city => {
      migrated.cities[city.id] = {
        controller: city.controller,
        controllerName: city.controllerName,
        defense: city.defense,
        supply: city.supply,
        courtLoyalty: city.courtLoyalty,
        pressure: 20,
        lastChange: "资料补全",
        ...(migrated.cities[city.id] || {}),
      };
    });
    DATA.routes.forEach(route => {
      migrated.routes[route.id] = {
        supply: route.supply,
        pressure: route.pressure,
        status: routeStatus(route.supply, route.pressure),
        lastChange: "资料补全",
        ...(migrated.routes[route.id] || {}),
      };
    });
    if (!migrated.strategies.court) {
      migrated.strategies.court = { lordId: "court", objective: "维持诏令交通与许都安全", order: "administration", targetCities: ["xudu"], routeIds: [], readiness: 48, trust: 100, orderedTurn: core.turn, lastChange: "资料补全" };
    }
    DATA.lords.forEach(lord => {
      migrated.strategies[lord.id] = {
        lordId: lord.id,
        objective: lord.defaultObjective,
        order: "watch",
        targetCities: [lord.seatCity],
        routeIds: [],
        readiness: 45,
        trust: 50,
        orderedTurn: core.turn,
        lastChange: "资料补全",
        ...(migrated.strategies[lord.id] || {}),
      };
    });
    return migrated;
  }

  function processNewReports(core) {
    const reports = Array.isArray(core.reports) ? [...core.reports] : [];
    const incoming = reports
      .filter(report => (Number(report.timestamp) || 0) > (state.lastReportTimestamp || 0))
      .sort((a, b) => (Number(a.timestamp) || 0) - (Number(b.timestamp) || 0));

    incoming.filter(report => /^圣旨·/.test(report.title || "")).forEach(report => processEdictReport(report, core));
    state.lastReportTimestamp = Math.max(state.lastReportTimestamp || 0, latestTimestamp(reports));
  }

  function processEdictReport(report, core) {
    const text = extractEdictText(report.text || "");
    if (!text) return;
    const cityIds = detectCityTargets(text);
    const lordIds = detectLordTargets(text);
    const orders = detectOrders(text);
    const promiseTypes = detectPromises(text);
    const execution = extractExecution(report.text || "");
    const primaryOrder = orders[0] || "administration";
    const routeIds = resolveOrderRoute(cityIds, lordIds);

    applyEdictToCities(cityIds, primaryOrder, execution, text);
    applyEdictToRoutes(routeIds, primaryOrder, execution, text);
    applyEdictToStrategies(lordIds, cityIds, routeIds, primaryOrder, execution, text, core.turn);
    createPromises(promiseTypes, lordIds, cityIds, routeIds, execution, text, core);

    const targetNames = [
      ...cityIds.map(id => cityDef(id)?.name).filter(Boolean),
      ...lordIds.map(id => lordDef(id)?.name).filter(Boolean),
    ];
    state.log.unshift({
      id: `edict-${Number(report.timestamp) || Date.now()}`,
      turn: core.turn,
      type: primaryOrder,
      text: `${targetNames.length ? targetNames.join("、") : "天下诸镇"}接到诏令：${orderLabel(primaryOrder)}；执行度 ${execution}%。`,
    });
    trimCollections();
  }

  function extractEdictText(text) {
    const match = text.match(/“([^”]+)”/);
    return (match?.[1] || text).trim();
  }

  function extractExecution(text) {
    const match = text.match(/[（(](\d{1,3})%[）)]/);
    return clamp(Number(match?.[1]) || 58, 20, 100);
  }

  function detectCityTargets(text) {
    return DATA.cities.filter(city => city.aliases.some(alias => text.includes(alias))).map(city => city.id);
  }

  function detectLordTargets(text) {
    return DATA.lords.filter(lord => lord.aliases.some(alias => text.includes(alias))).map(lord => lord.id);
  }

  function detectOrders(text) {
    const found = DATA.orderRules.filter(rule => new RegExp(rule.pattern).test(text)).map(rule => rule.id);
    return [...new Set(found)];
  }

  function detectPromises(text) {
    const found = DATA.promiseRules.filter(rule => new RegExp(rule.pattern).test(text)).map(rule => rule.id);
    return [...new Set(found)];
  }

  function resolveOrderRoute(cityIds, lordIds) {
    let from = null;
    let to = null;
    if (cityIds.length >= 2) {
      [from] = cityIds;
      to = cityIds[cityIds.length - 1];
    } else if (cityIds.length === 1 && lordIds.length > 0) {
      from = lordDef(lordIds[0])?.seatCity || "xudu";
      [to] = cityIds;
      if (from === to) from = "xudu";
    } else if (cityIds.length === 1) {
      from = "xudu";
      [to] = cityIds;
    } else if (lordIds.length > 0) {
      from = "xudu";
      to = lordDef(lordIds[0])?.seatCity;
    }
    return from && to ? findRoutePath(from, to) : [];
  }

  function findRoutePath(from, to) {
    if (!from || !to || from === to) return [];
    const graph = new Map();
    DATA.routes.forEach(route => {
      if (!graph.has(route.from)) graph.set(route.from, []);
      if (!graph.has(route.to)) graph.set(route.to, []);
      graph.get(route.from).push({ city: route.to, routeId: route.id });
      graph.get(route.to).push({ city: route.from, routeId: route.id });
    });
    const queue = [{ city: from, path: [] }];
    const visited = new Set([from]);
    while (queue.length) {
      const current = queue.shift();
      for (const edge of graph.get(current.city) || []) {
        if (visited.has(edge.city)) continue;
        const path = [...current.path, edge.routeId];
        if (edge.city === to) return path;
        visited.add(edge.city);
        queue.push({ city: edge.city, path });
      }
    }
    return [];
  }

  function applyEdictToCities(cityIds, order, execution, text) {
    const scale = Math.max(1, Math.round(execution / 22));
    cityIds.forEach(id => {
      const city = state.cities[id];
      if (!city) return;
      if (order === "attack") { city.pressure += scale * 3; city.defense -= scale; }
      else if (order === "support") { city.defense += scale * 2; city.supply -= scale; city.pressure += scale; }
      else if (order === "defend") { city.defense += scale * 2; city.supply -= Math.max(1, scale - 1); }
      else if (order === "supply" || order === "trade") { city.supply += scale * 2; city.courtLoyalty += scale; }
      else if (order === "ceasefire") { city.pressure -= scale * 3; city.courtLoyalty += scale; }
      else if (order === "advance") { city.pressure += scale * 2; city.supply -= scale; }
      city.defense = clamp(city.defense, 0, 100);
      city.supply = clamp(city.supply, 0, 100);
      city.courtLoyalty = clamp(city.courtLoyalty, 0, 100);
      city.pressure = clamp(city.pressure, 0, 100);
      city.lastChange = `${orderLabel(order)}诏令：${shortText(text)}`;
    });
  }

  function applyEdictToRoutes(routeIds, order, execution, text) {
    const scale = Math.max(1, Math.round(execution / 25));
    routeIds.forEach(id => {
      const route = state.routes[id];
      if (!route) return;
      if (["attack", "advance"].includes(order)) { route.pressure += scale * 3; route.supply -= scale * 2; }
      else if (order === "support") { route.pressure += scale; route.supply -= scale; }
      else if (order === "defend") { route.pressure += scale; route.supply += scale; }
      else if (["supply", "trade"].includes(order)) { route.supply += scale * 3; route.pressure -= scale; }
      else if (order === "ceasefire") { route.pressure -= scale * 4; route.supply += scale; }
      route.supply = clamp(route.supply, 0, 100);
      route.pressure = clamp(route.pressure, 0, 100);
      route.status = routeStatus(route.supply, route.pressure);
      route.lastChange = `${orderLabel(order)}诏令：${shortText(text)}`;
    });
  }

  function applyEdictToStrategies(lordIds, cityIds, routeIds, order, execution, text, turn) {
    const targets = lordIds.length ? lordIds : ["court"];
    targets.forEach(lordId => {
      const strategy = state.strategies[lordId];
      if (!strategy) return;
      strategy.order = order;
      strategy.targetCities = cityIds.length ? [...cityIds] : [lordDef(lordId)?.seatCity || "xudu"];
      strategy.routeIds = [...routeIds];
      strategy.readiness = clamp(strategy.readiness + Math.round((execution - 45) / 10), 0, 100);
      strategy.orderedTurn = turn;
      strategy.objective = buildObjective(lordId, order, strategy.targetCities);
      strategy.lastChange = shortText(text);
    });
  }

  function createPromises(types, lordIds, cityIds, routeIds, execution, text, core) {
    if (!types.length || !lordIds.length) return;
    types.forEach(type => {
      const rule = DATA.promiseRules.find(item => item.id === type);
      lordIds.forEach(lordId => {
        const duplicate = state.promises.some(item => item.status === "active" && item.type === type && item.lordId === lordId && item.createdTurn === core.turn);
        if (duplicate) return;
        const strategy = state.strategies[lordId];
        const immediate = type === "title" && !/(许诺|将授|拟授|日后)/.test(text);
        state.promises.unshift({
          id: `promise-${type}-${lordId}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          type,
          label: rule?.label || type,
          direction: rule?.direction || "mutual",
          lordId,
          cityIds: [...cityIds],
          routeIds: [...routeIds],
          createdTurn: core.turn,
          deadlineTurn: core.turn + (rule?.deadline || 3),
          progress: immediate ? 100 : clamp(Math.round(execution * 0.35 + (strategy?.trust || 40) * 0.2), 12, 62),
          status: immediate ? "fulfilled" : "active",
          text: shortText(text, 90),
          lastChange: immediate ? "诏书颁下即已履行" : "等待履约",
        });
        if (immediate && strategy) strategy.trust = clamp(strategy.trust + 4, 0, 100);
      });
    });
    trimCollections();
  }

  function processElapsedTurns(core) {
    const gap = clamp(core.turn - state.lastProcessedTurn, 0, 24);
    for (let index = 0; index < gap; index += 1) {
      const completedTurn = state.lastProcessedTurn;
      simulateTurn(completedTurn, core);
      state.lastProcessedTurn += 1;
    }
  }

  function simulateTurn(turn, core) {
    const rng = seededRandom(`${state.gameCreatedAt}-${turn}-strategy`);
    Object.values(state.strategies).forEach(strategy => {
      if (!strategy) return;
      const avgSupply = averageRouteMetric(strategy.routeIds, "supply", 55);
      const avgPressure = averageRouteMetric(strategy.routeIds, "pressure", 35);
      strategy.readiness = clamp(strategy.readiness + Math.round((avgSupply - 50) / 20) - Math.round(Math.max(0, avgPressure - 65) / 18) + (rng() > 0.58 ? 1 : 0), 0, 100);
      executeStrategyPulse(strategy, turn);
      if (turn - strategy.orderedTurn >= 4 && !["watch", "administration"].includes(strategy.order)) {
        strategy.order = "watch";
        strategy.routeIds = [];
        strategy.lastChange = "前一阶段诏令已转入观望与整顿";
      }
    });

    evaluatePromises(turn, core);
    naturalRouteDrift(rng);
    state.log = state.log.slice(0, MAX_LOG);
  }

  function executeStrategyPulse(strategy, turn) {
    const strength = strategy.readiness >= 70 ? 2 : strategy.readiness >= 45 ? 1 : 0;
    if (!strength) return;
    strategy.routeIds.forEach(routeId => {
      const route = state.routes[routeId];
      if (!route) return;
      if (["attack", "advance"].includes(strategy.order)) { route.pressure += 2 * strength; route.supply -= strength; }
      if (strategy.order === "support") { route.pressure += strength; route.supply -= strength; }
      if (strategy.order === "supply" || strategy.order === "trade") { route.supply += 2 * strength; route.pressure -= strength; }
      if (strategy.order === "ceasefire") route.pressure -= 3 * strength;
      if (strategy.order === "defend") route.supply += strength;
      route.supply = clamp(route.supply, 0, 100);
      route.pressure = clamp(route.pressure, 0, 100);
      route.status = routeStatus(route.supply, route.pressure);
      route.lastChange = `${strategyName(strategy.lordId)}执行${orderLabel(strategy.order)}方略`;
    });
    strategy.targetCities.forEach(cityId => {
      const city = state.cities[cityId];
      if (!city) return;
      if (strategy.order === "attack") { city.pressure += 2 * strength; city.defense -= strength; }
      if (["defend", "support"].includes(strategy.order)) city.defense += strength;
      if (["supply", "trade"].includes(strategy.order)) city.supply += 2 * strength;
      if (strategy.order === "ceasefire") city.pressure -= 2 * strength;
      city.defense = clamp(city.defense, 0, 100);
      city.supply = clamp(city.supply, 0, 100);
      city.pressure = clamp(city.pressure, 0, 100);
      city.lastChange = `${strategyName(strategy.lordId)}方略推进至第 ${turn} 月`;
    });
  }

  function evaluatePromises(turn, core) {
    state.promises.forEach(promise => {
      if (promise.status !== "active") return;
      const strategy = state.strategies[promise.lordId];
      const routeSupply = averageRouteMetric(promise.routeIds, "supply", 55);
      const routePressure = averageRouteMetric(promise.routeIds, "pressure", 35);
      const prestige = Number(core.stats?.prestige || 50);
      const base = Math.round(((strategy?.trust || 40) + (strategy?.readiness || 40) + prestige) / 34);
      const penalty = routeSupply < 35 ? 4 : routePressure > 75 ? 3 : 0;
      promise.progress = clamp(promise.progress + Math.max(2, base - penalty), 0, 100);
      promise.lastChange = `履约进度 ${promise.progress}%`;

      if (promise.progress >= 100) {
        settlePromise(promise, true, "提前完成承诺");
      } else if (turn + 1 >= promise.deadlineTurn) {
        const threshold = promise.type === "ceasefire" ? 48 : 58;
        settlePromise(promise, promise.progress >= threshold, promise.progress >= threshold ? "按期履约" : "期限届满仍未履约");
      }
    });
  }

  function settlePromise(promise, fulfilled, reason) {
    promise.status = fulfilled ? "fulfilled" : "broken";
    promise.lastChange = reason;
    const strategy = state.strategies[promise.lordId];
    if (strategy) strategy.trust = clamp(strategy.trust + (fulfilled ? 7 : -13), 0, 100);
    promise.cityIds.forEach(cityId => {
      const city = state.cities[cityId];
      if (city) city.courtLoyalty = clamp(city.courtLoyalty + (fulfilled ? 3 : -5), 0, 100);
    });
    state.log.unshift({
      id: `promise-result-${promise.id}`,
      turn: state.lastProcessedTurn,
      type: fulfilled ? "diplomacy" : "warning",
      text: `${strategyName(promise.lordId)}${fulfilled ? "履行" : "违背"}${promise.label}：${reason}。`,
    });
  }

  function naturalRouteDrift(rng) {
    Object.values(state.routes).forEach(route => {
      if (route.pressure >= 70) route.supply -= 1;
      else if (route.pressure <= 35 && rng() > 0.55) route.supply += 1;
      route.pressure += rng() > 0.82 ? 1 : rng() < 0.16 ? -1 : 0;
      route.supply = clamp(route.supply, 0, 100);
      route.pressure = clamp(route.pressure, 0, 100);
      route.status = routeStatus(route.supply, route.pressure);
    });
  }

  function averageRouteMetric(ids, key, fallback) {
    if (!ids?.length) return fallback;
    const values = ids.map(id => Number(state.routes[id]?.[key])).filter(Number.isFinite);
    return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : fallback;
  }

  function latestTimestamp(reports) {
    if (!Array.isArray(reports) || !reports.length) return 0;
    return Math.max(0, ...reports.map(report => Number(report.timestamp) || 0));
  }

  function readWorldLord(id) {
    const world = safeParse(localStorage.getItem(WORLD_SAVE_KEY));
    return world?.lords?.[id] || null;
  }

  function buildObjective(lordId, order, cityIds) {
    const names = cityIds.map(id => cityDef(id)?.name).filter(Boolean).join("、") || "本镇";
    const subject = lordId === "court" ? "汉廷" : lordDef(lordId)?.name || "诸侯";
    const verbs = { attack: "向", support: "驰援", defend: "固守", supply: "向", ceasefire: "在", trade: "开通", advance: "调兵至", administration: "整顿" };
    if (order === "attack") return `${subject}向${names}推进兵锋`;
    if (order === "supply") return `${subject}向${names}转运粮饷`;
    if (order === "ceasefire") return `${subject}在${names}方向停战议和`;
    if (order === "trade") return `${subject}开通${names}互市商路`;
    return `${subject}${verbs[order] || "经营"}${names}`;
  }

  function routeStatus(supply, pressure) {
    if (supply <= 22) return "补给阻断";
    if (pressure >= 78) return "战线激烈";
    if (pressure >= 58) return "争夺中";
    if (supply >= 72 && pressure <= 42) return "畅通";
    return "可通行";
  }

  function orderLabel(id) {
    return DATA.orderRules.find(rule => rule.id === id)?.label || (id === "administration" ? "行政整顿" : id === "watch" ? "观望" : "综合方略");
  }

  function cityDef(id) { return DATA.cities.find(city => city.id === id); }
  function routeDef(id) { return DATA.routes.find(route => route.id === id); }
  function lordDef(id) { return DATA.lords.find(lord => lord.id === id); }
  function strategyName(id) { return id === "court" ? "汉廷" : lordDef(id)?.name || "外镇"; }
  function clamp(value, min, max) { return Math.min(max, Math.max(min, Number(value) || 0)); }
  function shortText(text, limit = 58) { const normalized = String(text || "").replace(/\s+/g, " ").trim(); return normalized.length > limit ? `${normalized.slice(0, limit)}……` : normalized; }
  function trimCollections() { state.promises = state.promises.slice(0, MAX_PROMISES); state.log = state.log.slice(0, MAX_LOG); }

  function seededRandom(seed) {
    let hash = 2166136261;
    for (let index = 0; index < seed.length; index += 1) { hash ^= seed.charCodeAt(index); hash = Math.imul(hash, 16777619); }
    return () => { hash += 0x6d2b79f5; let value = hash; value = Math.imul(value ^ (value >>> 15), value | 1); value ^= value + Math.imul(value ^ (value >>> 7), value | 61); return ((value ^ (value >>> 14)) >>> 0) / 4294967296; };
  }

  function installNavButton() {
    const nav = document.querySelector(".utility-nav");
    if (!nav || document.getElementById("strategy-network-btn")) return;
    const button = document.createElement("button");
    button.id = "strategy-network-btn";
    button.type = "button";
    button.textContent = "军略";
    button.addEventListener("click", openOverlay);
    nav.insertBefore(button, document.getElementById("reset-btn") || null);
  }

  function installBrief() {
    if (document.getElementById("strategy-network-brief")) return;
    const section = document.createElement("section");
    section.id = "strategy-network-brief";
    section.className = "strategy-network-brief panel";
    section.innerHTML = `<div class="strategy-brief-head"><div><span class="section-kicker">军国网络</span><h2>城池·军路·盟约</h2></div><button id="strategy-brief-open" class="text-button" type="button">展开军略</button></div><div id="strategy-brief-content" class="strategy-brief-content"></div>`;
    const worldBrief = document.getElementById("world-brief");
    const stats = document.getElementById("stats-grid");
    if (worldBrief) worldBrief.insertAdjacentElement("afterend", section);
    else stats?.insertAdjacentElement("afterend", section);
    section.querySelector("#strategy-brief-open")?.addEventListener("click", openOverlay);
  }

  function installOverlay() {
    if (document.getElementById("strategy-network-overlay")) return;
    const overlay = document.createElement("div");
    overlay.id = "strategy-network-overlay";
    overlay.className = "strategy-network-overlay hidden";
    overlay.innerHTML = `<section class="strategy-network-window" role="dialog" aria-modal="true" aria-labelledby="strategy-network-title"><header><div><span class="section-kicker">尚书台军国档案</span><h2 id="strategy-network-title">城池、战争路线与外交承诺</h2><p id="strategy-network-date">尚未载入本局</p></div><button id="strategy-network-close" type="button" aria-label="关闭">×</button></header><nav class="strategy-network-tabs"><button type="button" data-strategy-tab="cities">城池</button><button type="button" data-strategy-tab="routes">战争路线</button><button type="button" data-strategy-tab="promises">外交承诺</button><button type="button" data-strategy-tab="strategies">诸侯方略</button></nav><div id="strategy-network-content"></div></section>`;
    document.body.appendChild(overlay);
    overlay.querySelector("#strategy-network-close")?.addEventListener("click", closeOverlay);
    overlay.addEventListener("click", event => { if (event.target === overlay) closeOverlay(); });
    overlay.querySelectorAll("[data-strategy-tab]").forEach(button => button.addEventListener("click", () => { activeTab = button.dataset.strategyTab; renderOverlay(); }));
    document.addEventListener("keydown", event => { if (event.key === "Escape" && !overlay.classList.contains("hidden")) closeOverlay(); });
  }

  function openOverlay() {
    const overlay = document.getElementById("strategy-network-overlay");
    if (!overlay) return;
    overlay.classList.remove("hidden");
    document.body.classList.add("strategy-network-open");
    renderOverlay();
  }

  function closeOverlay() {
    document.getElementById("strategy-network-overlay")?.classList.add("hidden");
    document.body.classList.remove("strategy-network-open");
  }

  function renderAll() {
    renderBrief();
    if (!document.getElementById("strategy-network-overlay")?.classList.contains("hidden")) renderOverlay();
  }

  function renderBrief() {
    const content = document.getElementById("strategy-brief-content");
    if (!content) return;
    if (!state) { content.innerHTML = '<p class="empty-state">开启新局后建立城池、军路与盟约档案。</p>'; return; }
    const front = hottestRoute();
    const active = state.promises.filter(item => item.status === "active");
    const broken = state.promises.filter(item => item.status === "broken");
    const vulnerable = Object.entries(state.cities).sort((a, b) => cityRisk(b[1]) - cityRisk(a[1]))[0];
    content.innerHTML = `<button type="button" data-brief-tab="routes"><span>最紧张战线</span><strong>${escapeHtml(routeDef(front?.[0])?.name || "暂无")}</strong><small>${front ? `${front[1].status} · 军压 ${Math.round(front[1].pressure)}` : "等待诏令"}</small></button><button type="button" data-brief-tab="cities"><span>最脆弱城池</span><strong>${escapeHtml(cityDef(vulnerable?.[0])?.name || "暂无")}</strong><small>${vulnerable ? `守备 ${Math.round(vulnerable[1].defense)} · 粮秣 ${Math.round(vulnerable[1].supply)}` : "等待推演"}</small></button><button type="button" data-brief-tab="promises"><span>外交承诺</span><strong>${active.length} 项履行中</strong><small>${broken.length ? `${broken.length} 项已经失信` : "尚无失信记录"}</small></button>`;
    content.querySelectorAll("[data-brief-tab]").forEach(button => button.addEventListener("click", () => { activeTab = button.dataset.briefTab; openOverlay(); }));
  }

  function renderOverlay() {
    const content = document.getElementById("strategy-network-content");
    const date = document.getElementById("strategy-network-date");
    if (!content || !date) return;
    document.querySelectorAll("[data-strategy-tab]").forEach(button => button.classList.toggle("active", button.dataset.strategyTab === activeTab));
    date.textContent = coreState ? `建安局势 · 第 ${coreState.turn}/${coreState.maxTurns || 24} 月` : "尚未载入本局";
    if (!state) { content.innerHTML = '<p class="empty-state">请先开启或读取一局游戏。</p>'; return; }
    const renderers = { cities: renderCities, routes: renderRoutes, promises: renderPromises, strategies: renderStrategies };
    content.innerHTML = renderSummary() + (renderers[activeTab] || renderCities)();
  }

  function renderSummary() {
    const contested = Object.values(state.routes).filter(route => route.pressure >= 58).length;
    const blocked = Object.values(state.routes).filter(route => route.supply <= 22).length;
    const active = state.promises.filter(item => item.status === "active").length;
    const fulfilled = state.promises.filter(item => item.status === "fulfilled").length;
    return `<section class="strategy-summary"><article><span>城池节点</span><strong>${DATA.cities.length}</strong><small>守备、粮秣、朝廷向心</small></article><article><span>争夺路线</span><strong>${contested}</strong><small>${blocked} 条补给阻断</small></article><article><span>履行中承诺</span><strong>${active}</strong><small>${fulfilled} 项已履行</small></article><article><span>当前急务</span><strong>${escapeHtml(buildPriority())}</strong><small>依据城防与军路综合判断</small></article></section>`;
  }

  function renderCities() {
    return `<section><div class="strategy-section-head"><div><span class="section-kicker">城池节点</span><h3>天下要城</h3></div><small>守备 · 粮秣 · 军压 · 向心</small></div><div class="city-network-grid">${DATA.cities.map(def => renderCityCard(def, state.cities[def.id])).join("")}</div></section>`;
  }

  function renderCityCard(def, city) {
    return `<article class="city-node-card ${city.pressure >= 70 ? "danger" : city.supply <= 25 ? "blocked" : ""}"><div><span>${escapeHtml(def.regionId)}</span><strong>${escapeHtml(def.name)}</strong><small>${escapeHtml(city.controllerName || controllerName(city.controller) || def.controllerName)} · ${escapeHtml(def.importance)}</small></div>${metric("守备", city.defense)}${metric("粮秣", city.supply)}${metric("军压", city.pressure, true)}${metric("向心", city.courtLoyalty)}<p>${escapeHtml(city.lastChange)}</p></article>`;
  }

  function renderRoutes() {
    const sorted = DATA.routes.map(def => [def, state.routes[def.id]]).sort((a, b) => b[1].pressure - a[1].pressure);
    return `<section><div class="strategy-section-head"><div><span class="section-kicker">战争路线</span><h3>军路与补给线</h3></div><small>按军事压力排序</small></div><div class="route-network-list">${sorted.map(([def, route]) => `<article class="route-card ${route.status === "战线激烈" ? "danger" : route.status === "补给阻断" ? "blocked" : ""}"><div class="route-card-head"><div><strong>${escapeHtml(def.name)}</strong><small>${escapeHtml(def.type)} · ${escapeHtml(def.terrain)}</small></div><b>${escapeHtml(route.status)}</b></div><div class="route-endpoints"><span>${escapeHtml(cityDef(def.from)?.name || def.from)}</span><i>⇄</i><span>${escapeHtml(cityDef(def.to)?.name || def.to)}</span></div>${metric("补给", route.supply)}${metric("军压", route.pressure, true)}<p>${escapeHtml(route.lastChange)}</p></article>`).join("")}</div></section>`;
  }

  function renderPromises() {
    const order = { active: 0, broken: 1, fulfilled: 2 };
    const promises = [...state.promises].sort((a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3) || b.createdTurn - a.createdTurn);
    return `<section><div class="strategy-section-head"><div><span class="section-kicker">外交承诺</span><h3>盟约与履约</h3></div><small>承诺会按期限、军路与信任结算</small></div><div class="promise-list">${promises.length ? promises.map(promise => `<article class="promise-card ${promise.status}"><div class="promise-card-head"><div><span>${escapeHtml(promise.label)}</span><strong>${escapeHtml(strategyName(promise.lordId))}</strong></div><b>${promiseStatus(promise.status)}</b></div><p>${escapeHtml(promise.text)}</p><div class="promise-progress"><i><b style="width:${clamp(promise.progress, 0, 100)}%"></b></i><em>${Math.round(promise.progress)}%</em></div><small>第 ${promise.createdTurn} 月立约 · 第 ${promise.deadlineTurn} 月期限 · ${escapeHtml(promise.lastChange)}</small></article>`).join("") : '<p class="empty-state">在圣旨中写明奉表、出兵、结盟、停战、互市、质子或官爵，即可建立外交承诺。</p>'}</div></section>`;
  }

  function renderStrategies() {
    const entries = Object.values(state.strategies).sort((a, b) => b.readiness - a.readiness);
    return `<section><div class="strategy-section-head"><div><span class="section-kicker">诸侯战略</span><h3>当前方略</h3></div><small>诏令目标 · 战备 · 对朝廷信任</small></div><div class="lord-strategy-grid">${entries.map(strategy => `<article class="lord-strategy-card"><div><strong>${escapeHtml(strategyName(strategy.lordId))}</strong><b>${escapeHtml(orderLabel(strategy.order))}</b></div><h4>${escapeHtml(strategy.objective)}</h4>${metric("战备", strategy.readiness)}${metric("信任", strategy.trust)}<p>${escapeHtml(strategy.lastChange)}</p></article>`).join("")}</div><section class="strategy-log"><div class="strategy-section-head"><div><span class="section-kicker">军国记录</span><h3>最近变化</h3></div></div>${state.log.slice(0, 12).map(item => `<article><span>${escapeHtml(logIcon(item.type))}</span><div><strong>第 ${item.turn} 月</strong><p>${escapeHtml(item.text)}</p></div></article>`).join("")}</section></section>`;
  }

  function metric(label, value, inverse = false) {
    return `<div class="strategy-metric ${inverse ? "inverse" : ""}"><span>${label}</span><i><b style="width:${clamp(value, 0, 100)}%"></b></i><em>${Math.round(value)}</em></div>`;
  }

  function promiseStatus(status) { return { active: "履行中", fulfilled: "已履行", broken: "已失信" }[status] || status; }
  function logIcon(type) { return { attack: "兵", support: "援", defend: "守", supply: "粮", ceasefire: "和", trade: "市", advance: "军", diplomacy: "盟", warning: "警", system: "档" }[type] || "诏"; }
  function cityRisk(city) { return (100 - city.defense) * 0.4 + (100 - city.supply) * 0.35 + city.pressure * 0.25; }
  function hottestRoute() { return Object.entries(state?.routes || {}).sort((a, b) => b[1].pressure - a[1].pressure)[0] || null; }
  function buildPriority() {
    const hottest = hottestRoute();
    if (hottest?.[1].supply <= 22) return "打通补给";
    if (hottest?.[1].pressure >= 78) return "稳定前线";
    if (state.promises.some(item => item.status === "active" && item.deadlineTurn <= (coreState?.turn || 0) + 1)) return "催促履约";
    const weakest = Object.values(state.cities).sort((a, b) => cityRisk(b) - cityRisk(a))[0];
    if (weakest && cityRisk(weakest) >= 58) return "加强城防";
    return "经营交通";
  }

  function controllerName(id) {
    if (id === "court") return "汉廷";
    if (id === "fragmented") return "地方残部";
    if (id === "shi_family") return "士氏";
    return DATA.lords.find(lord => lord.id === id)?.name || id;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  }

  window.XianStrategyNetwork = Object.freeze({
    detectCityTargets,
    detectLordTargets,
    detectOrders,
    detectPromises,
    findRoutePath,
    extractEdictText,
    getState: () => state ? JSON.parse(JSON.stringify(state)) : null,
    open: openOverlay,
  });
})();
