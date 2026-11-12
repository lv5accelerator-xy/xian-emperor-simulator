/*
 * 天子蒙尘：献帝模拟器 v0.7.0
 * 城池节点、战争路线、诸侯方略与外交承诺系统。
 */
(() => {
  "use strict";

  // Preserve storage watchers and the original error path while making failures visible.
  function storageWrite(method, ...args) {
    try { return localStorage[method](...args); }
    catch (error) {
      try { window.XianStorageFeedback?.report?.(error); } catch (_) { /* Keep the original failure. */ }
      throw error;
    }
  }

  const DATA = window.XIAN_STRATEGY_DATA;
  if (!DATA) {
    console.error("XIAN_STRATEGY_DATA 未加载，军略网络无法启动。");
    return;
  }

  const GAME_SAVE_KEY = "xian_emperor_simulator_v01";
  const WORLD_SAVE_KEY = "xian_emperor_world_v020";
  const STORAGE_KEY = "xian_emperor_strategy_network_v040";
  const VERSION = "1.5.1";
  const MAX_LOG = 60;
  const MAX_PROMISES = 40;

  let state = null;
  let coreState = null;
  let activeTab = "cities";
  let diplomaticSelection = ["yuan_shao","gongsun_zan"];
  let initialized = false;
  let processTimer = null;
  let pendingCoreCommit = false;

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
      if (window.XianEmperorGame?.commit) return;
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
      window.XianAllianceDiplomacy.migrate(state, core);
      processNewReports(core);
      reconcileDiplomaticRelations(core);
      saveState();
      renderAll();
      return;
    }

    state = migrateState(loaded, core);
    migrateLegacyOrderedRoutes(core);
    processNewReports(core);
    reconcileDiplomaticRelations(core);
    processElapsedTurns(core);
    state.updatedAt = new Date().toISOString();
    saveState();
    renderAll();

    if (!firstLoad && document.getElementById("strategy-network-overlay")?.classList.contains("hidden") === false) {
      renderOverlay();
    }
    if (pendingCoreCommit) {
      pendingCoreCommit = false;
      window.XianEmperorGame?.commit?.("diplomacy-settled");
    }
  }

  function isValidCore(core) {
    return Boolean(core && typeof core === "object" && Number.isFinite(core.turn) && core.stats && core.hidden);
  }

  function safeParse(raw) {
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (_) { return null; }
  }

  // 军团状态的只读快照；军团模块未提供 peekState 时退回深拷贝。
  function armySnapshot() { const army = window.XianArmySystem; return army?.peekState ? army.peekState() : army?.getState?.(); }
  function deepFreeze(value) {
    if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.freeze(value); for (const key of Object.keys(value)) deepFreeze(value[key]); }
    return value;
  }
  let peekRawCache = null, peekSnapshotCache = null;
  function peekState() {
    if (!state) return null;
    const raw = JSON.stringify(state);
    if (raw !== peekRawCache) { peekSnapshotCache = deepFreeze(JSON.parse(raw)); peekRawCache = raw; }
    return peekSnapshotCache;
  }

  function loadState() {
    return safeParse(localStorage.getItem(STORAGE_KEY));
  }

  function saveState() {
    if (!state) return;
    // 内容与存储中完全相同时不重写：对账类调用多数并不改动状态，却会整份重写上百KB。
    try { const raw = JSON.stringify(state); if (localStorage.getItem(STORAGE_KEY) !== raw) storageWrite("setItem", STORAGE_KEY, raw); } catch (error) { console.warn("军略网络保存失败", error); }
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
      lastReportTimestamp: 0,
      v041LastCorrectedTimestamp: 0,
      lastProcessedTurn: core.turn,
      cities,
      routes,
      strategies,
      promises: [],
      commandChain: window.XianLordIntentions?.ledger(null, core),
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
      commandChain: window.XianLordIntentions?.ledger(current.commandChain, core, (() => { const army = safeParse(localStorage.getItem("xian_emperor_armies_v050")); return army?.gameCreatedAt === core.createdAt ? army.militaryFacts || [] : []; })()),
      log: Array.isArray(current.log) ? current.log : [],
      lastReportTimestamp: Number(current.lastReportTimestamp) || 0,
      v041LastCorrectedTimestamp: Number(current.v041LastCorrectedTimestamp) || 0,
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
    migrated.promises.forEach(promise => {
      const availability = window.XianCharacterAvailability;
      if (!promise.identity) {
        const personal = ["hostage", "title"].includes(promise.type);
        const priorPerson = availability?.getCharacter?.(promise.lordId);
        const unavailablePrior = personal && priorPerson && !availability.isAvailable(promise.lordId, core);
        promise.identity = unavailablePrior ? { scope: "legacy-person", factionId: promise.lordId, representativeId: promise.lordId, representativeName: priorPerson.name, migrated: true }
          : promiseIdentity(promise.type, promise.lordId, core);
      }
      if (promise.status === "active" && ["legacy-person", "person"].includes(promise.identity.scope)
        && availability && !availability.isAvailable(promise.identity.representativeId, core)) {
        promise.status = "unverified";
        promise.lastChange = `原对象${promise.identity.representativeName}当前不可受命；个人承诺保留历史，不自动转交现任代表、不补记兑现`;
      }
      if (!["tribute", "military_aid", "ceasefire"].includes(promise.type)) return;
      if (!promise.contract) {
        if (promise.status !== "active") {
          promise.evidenceStatus = "legacy-unverified-no-retroactive-reward";
          return;
        }
        promise.contract = buildContract(promise.type, promise.lordId, [promise.lordId], promise.cityIds || [], promise.text || "", { ...core, turn: promise.createdTurn });
        promise.contract.deadlineTurn = promise.deadlineTurn;
        promise.contract.migration = "legacy-active-no-historical-credit";
        promise.contract.observationStartTurn = core.turn;
        promise.contract.lastDeliveryTurn = core.turn - 1;
        promise.progress = 0;
      }
      promise.contract.receipts ||= [];
      promise.contract.initialOrderIds ||= [];
      promise.contract.initialBattleIds ||= [];
      if (promise.type === "ceasefire" && promise.contract.version !== 2) {
        const armies = armySnapshot() || {};
        promise.contract.version = 2;
        promise.contract.initialFactIds = (armies.militaryFacts || []).map(item => item.id);
        promise.contract.initialConquestIds = (armies.conquests || []).map(item => item.id);
        promise.contract.observationStartTurn = core.turn;
        promise.contract.missingHistoricalObservation = core.turn > promise.contract.startTurn || Number(core.monthlySettledTurn || 0) >= promise.contract.startTurn;
        promise.contract.migration ||= "legacy-ceasefire-no-siege-history";
      }
      promise.contract.initialFactIds ||= [];
      promise.contract.initialConquestIds ||= [];
    });
    window.XianAllianceDiplomacy.migrate(migrated, core, armySnapshot() || safeParse(localStorage.getItem("xian_emperor_armies_v050")));
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

  function migrateLegacyOrderedRoutes(core) {
    if (state.v041LastCorrectedTimestamp > 0) return;
    const alreadyProcessed = Number(state.lastReportTimestamp) || 0;
    const reports = (Array.isArray(core.reports) ? core.reports : [])
      .filter(report => /^圣旨·/.test(report.title || ""))
      .filter(report => (Number(report.timestamp) || 0) <= alreadyProcessed)
      .sort((a, b) => (Number(a.timestamp) || 0) - (Number(b.timestamp) || 0));

    reports.forEach(report => {
      const text = window.XianEdictRules?.reportText(report) ?? extractEdictText(report.text || "");
      if (!text) return;
      const cityIds = detectCityTargets(text);
      const lordIds = detectLordTargets(text);
      const order = choosePrimaryOrder(detectOrders(text));
      const routeIds = resolveOrderRoute(cityIds, lordIds);
      const targets = lordIds.length ? lordIds : ["court"];

      targets.forEach(lordId => {
        const strategy = state.strategies[lordId];
        if (!strategy) return;
        strategy.order = order;
        strategy.targetCities = cityIds.length
          ? [...cityIds]
          : [lordDef(lordId)?.seatCity || "xudu"];
        strategy.routeIds = [...routeIds];
        strategy.objective = buildObjective(lordId, order, strategy.targetCities);
        strategy.lastChange = `已按诏书文字顺序校正：${shortText(text)}`;
      });

      state.v041LastCorrectedTimestamp = Math.max(
        Number(state.v041LastCorrectedTimestamp) || 0,
        Number(report.timestamp) || 0,
      );
    });

    if (!reports.length) {
      state.v041LastCorrectedTimestamp = Math.max(1, alreadyProcessed);
    }
  }

  function processEdictReport(report, core) {
    const text = window.XianEdictRules?.reportText(report) ?? extractEdictText(report.text || "");
    if (!text) return;
    const targets = window.XianCharacterAvailability?.validateTargets?.(text, core);
    if (targets && !targets.ok) {
      state.log.unshift({ id: `unavailable-edict-${report.id || report.timestamp}`, turn: core.turn, type: "warning", text: `诏令未落实：${targets.reason}` });
      return;
    }
    const cityIds = detectCityTargets(text);
    const lordIds = detectLordTargets(text);
    const orders = detectOrders(text);
    const promiseTypes = detectPromises(text);
    const execution = extractExecution(report.text || "");
    const primaryOrder = choosePrimaryOrder(orders);
    const routeIds = resolveOrderRoute(cityIds, lordIds);

    const alliance = window.XianAllianceDiplomacy.explicit(text);
    if (!alliance) {
      applyEdictToCities(cityIds, primaryOrder, execution, text);
      applyEdictToRoutes(routeIds, primaryOrder, execution, text);
      applyEdictToStrategies(lordIds, cityIds, routeIds, primaryOrder, execution, text, core.turn);
    }
    createPromises(promiseTypes, lordIds, cityIds, routeIds, execution, text, core, report);
    state.v041LastCorrectedTimestamp = Math.max(
      Number(state.v041LastCorrectedTimestamp) || 0,
      Number(report.timestamp) || 0,
    );

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

  function orderedMatches(text, records) {
    return records
      .map(record => {
        const positions = record.aliases
          .map(alias => text.indexOf(alias))
          .filter(position => position >= 0);
        return positions.length
          ? { id: record.id, position: Math.min(...positions) }
          : null;
      })
      .filter(Boolean)
      .sort((a, b) => a.position - b.position)
      .map(item => item.id);
  }

  function detectCityTargets(text) {
    return orderedMatches(window.XianEdictRules?.affirmativeText(text) ?? String(text || ""), DATA.cities);
  }

  function detectLordTargets(text) {
    const effective = window.XianEdictRules?.affirmativeText(text) ?? String(text || "");
    if (window.XianCharacterAvailability?.diplomaticTargets) return window.XianCharacterAvailability.diplomaticTargets(effective, window.XianEmperorGame?.getState?.() || coreState);
    return orderedMatches(effective, DATA.lords);
  }

  function detectOrders(text) {
    text = window.XianEdictRules?.affirmativeText(text) ?? text;
    const found = DATA.orderRules.filter(rule => new RegExp(rule.pattern).test(text)).map(rule => rule.id);
    return [...new Set(found)];
  }

  function detectPromises(text) {
    text = window.XianEdictRules?.affirmativeText(text) ?? text;
    const found = DATA.promiseRules.filter(rule => new RegExp(rule.pattern).test(text)).map(rule => rule.id);
    return [...new Set(found)];
  }

  function choosePrimaryOrder(orders) {
    const priority = ["attack", "support", "advance", "defend", "supply", "ceasefire", "trade"];
    return priority.find(order => orders.includes(order)) || orders[0] || "administration";
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
      if (from === to) return [];
    } else if (cityIds.length === 1) {
      from = "xudu";
      [to] = cityIds;
    } else if (lordIds.length > 0) {
      from = lordDef(lordIds[0])?.seatCity || "xudu";
      to = "xudu";
      if (from === to) return [];
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
    if (["attack", "support", "defend", "supply", "advance"].includes(order)) return;
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
    if (["attack", "support", "defend", "supply", "advance"].includes(order)) return;
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

  function createPromises(types, lordIds, cityIds, routeIds, execution, text, core, report) {
    if (window.XianAllianceDiplomacy.explicit(text)) {
      const p = window.XianAllianceDiplomacy.create(text, core, state, armySnapshot() || {}, execution, report);
      if (p) state.promises.unshift(p);
    }
    if (!types.length || !lordIds.length) return;
    types.forEach(type => {
      if (type === "alliance") return;
      const rule = DATA.promiseRules.find(item => item.id === type);
      lordIds.forEach((lordId, lordIndex) => {
        if (type === "ceasefire" && lordIndex > 0) return;
        const contract = buildContract(type, lordId, lordIds, cityIds, text, core);
        const duplicate = state.promises.some(item => item.status === "active" && item.type === type && item.lordId === lordId && item.createdTurn === core.turn
          && (type !== "ceasefire" || JSON.stringify([...(item.contract?.parties || [])].sort()) === JSON.stringify([...contract.parties].sort())));
        if (duplicate) return;
        const strategy = state.strategies[lordId];
        const immediate = type === "title" && !/(许诺|将授|拟授|日后)/.test(text);
        state.promises.unshift({
          id: `promise-${type}-${lordId}-${core.turn}-${core.edictsIssued || core.reports.length}`,
          type,
          label: rule?.label || type,
          direction: rule?.direction || "mutual",
          lordId,
          cityIds: [...cityIds],
          routeIds: [...routeIds],
          createdTurn: core.turn,
          deadlineTurn: core.turn + (rule?.deadline || 3),
          progress: immediate ? 100 : ["tribute", "military_aid", "ceasefire"].includes(type) ? 0 : clamp(Math.round(execution * 0.35 + (strategy?.trust || 40) * 0.2), 12, 62),
          status: immediate ? "fulfilled" : "active",
          text: shortText(text, 90),
          identity: promiseIdentity(type, lordId, core),
          lastChange: immediate ? "诏书颁下即已履行" : "等待履约",
          contract,
        });
        if (immediate && strategy) strategy.trust = clamp(strategy.trust + 4, 0, 100);
      });
    });
    trimCollections();
  }

  function processElapsedTurns(core) {
    const nextTurn = Math.max(core.turn, Number(core.monthlySettledTurn || 0) + 1);
    const gap = clamp(nextTurn - state.lastProcessedTurn, 0, 24);
    for (let index = 0; index < gap; index += 1) {
      const completedTurn = state.lastProcessedTurn;
      simulateTurn(completedTurn, core);
      state.lastProcessedTurn += 1;
    }
  }

  function simulateTurn(turn, core) {
    const key = window.XianEmperorGame?.getRandomKey?.("strategy", state.gameCreatedAt, core) ?? state.gameCreatedAt;
    const rng = seededRandom(`${key}-${turn}-strategy`);
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
    if (["attack", "support", "defend", "supply", "advance"].includes(strategy.order)) return;
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
      if (promise.type === "alliance") return;
      if (["tribute", "military_aid", "ceasefire"].includes(promise.type)) {
        if (!promise.contract) {
          promise.contract = buildContract(promise.type, promise.lordId, [promise.lordId], promise.cityIds || [], promise.text || "", { ...core, turn: promise.createdTurn });
          promise.contract.migration = "legacy-active-no-historical-credit";
          promise.contract.lastDeliveryTurn = turn;
        }
        if (promise.type === "tribute") deliverTribute(promise, turn, core);
        return;
      }
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

  function buildContract(type, lordId, parties, cityIds, text, core) {
    if (!["tribute", "military_aid", "ceasefire"].includes(type)) return null;
    const army = armySnapshot() || {};
    const quantity = clamp(Number(text.match(/(?:贡赋|进贡|朝贡|输贡|纳贡)[^\d]{0,6}(\d+)/)?.[1] || 6), 1, 30);
    return { version: type === "ceasefire" ? 2 : 1, responsible: lordId, beneficiary: "court", quantity: type === "tribute" ? quantity : null,
      payerCityId: DATA.lords.find(item => item.id === lordId)?.seatCity || null,
      delivered: 0, targetCityId: cityIds.at(-1) || "xudu", armyId: null,
      ...(type === "military_aid" ? { protectedOwner: state.cities[cityIds.at(-1) || "xudu"]?.controller, protectedName: controllerName(state.cities[cityIds.at(-1) || "xudu"]?.controller) } : {}),
      parties: [...new Set(parties.length > 1 ? (type === "ceasefire" ? parties.slice(0, 2) : parties) : [lordId, "court"])],
      startTurn: Number(core.turn), deadlineTurn: Number(core.turn) + (type === "ceasefire" ? 2 : 3),
      condition: type === "tribute" ? "实际到账钱粮" : type === "military_aid" ? "承接指定任务并抵达目标" : "约定双方在期限内无敌对军令、野战、围城推进或军事占领",
      receipts: [], lastDeliveryTurn: Number(core.turn) - 1,
      initialOrderIds: (army.orders || []).map(item => item.id), initialBattleIds: (army.battleReports || []).map(item => item.id),
      initialFactIds: (army.militaryFacts || []).map(item => item.id), initialConquestIds: (army.conquests || []).map(item => item.id) };
  }

  function promiseIdentity(type, factionId, core) {
    const representative = window.XianCharacterAvailability?.representative?.(factionId, core);
    return { scope: ["hostage", "title"].includes(type) ? (representative?.institution ? "institution" : "person") : "faction",
      factionId, representativeId: representative?.id || factionId, representativeName: representative?.name || lordDef(factionId)?.name || factionId };
  }

  function promiseName(promise) {
    return ["legacy-person", "person"].includes(promise.identity?.scope) ? `${promise.identity.representativeName}${promise.identity.scope === "legacy-person" ? "（历史对象）" : ""}` : strategyName(promise.lordId);
  }

  function deliverTribute(promise, turn, core) {
    const contract = promise.contract;
    if (turn < contract.startTurn || contract.lastDeliveryTurn >= turn) return;
    if (turn > promise.deadlineTurn) {
      settlePromise(promise, false, `期限已过，实收 ${contract.delivered}/${contract.quantity}；不追补往月贡赋`);
      promise.status = contract.delivered ? "partial" : "expired";
      if (promise.settlement) promise.settlement.status = promise.status;
      return;
    }
    contract.lastDeliveryTurn = turn;
    const payerCityId = contract.payerCityId || DATA.lords.find(item => item.id === promise.lordId)?.seatCity;
    const city = state.cities[payerCityId], policy = state.strategies[promise.lordId];
    const live = window.XianEmperorGame?.getState?.() || core;
    const controlsPayer = city?.controller === contract.responsible;
    const amount = controlsPayer && policy?.trust >= 30 && policy?.readiness >= 20 ? Math.max(0, Math.min(3, contract.quantity - contract.delivered, Math.floor(city?.supply || 0), 100 - Number(live.stats.treasury))) : 0;
    if (amount) {
      const id = `tribute:${promise.id}:${turn}`;
      const before = Number(live.stats.treasury);
      const paid = window.XianEmperorGame?.applyExternalPackage?.({ receiptId: id, causal: false, deferCommit: true, effects: { treasury: amount }, report: { title: "贡赋实收", text: `${strategyName(promise.lordId)}自${cityDef(payerCityId)?.name || payerCityId}解送钱粮 ${amount}，计入国库。`, type: "diplomacy" } });
      if (paid && paid.applied !== false) {
        pendingCoreCommit = true;
        const after = Number(window.XianEmperorGame?.getState?.()?.stats.treasury ?? before + amount), actual = Math.max(0, Math.min(amount, after - before));
        city.supply -= actual; contract.delivered += actual;
        contract.receipts.push({ id, turn, sourceCityId: payerCityId, payer: contract.responsible, beneficiary: contract.beneficiary, resource: "treasury", amount: actual, before, after, sourceSupplySpent: actual });
      }
    }
    promise.progress = Math.round(contract.delivered / contract.quantity * 100);
    promise.lastChange = `实际到账 ${contract.delivered}/${contract.quantity}${!controlsPayer ? "；责任方已失去治所，无法转运" : amount ? "" : "；钱粮、信任或国库容量不足，等待转运"}`;
    if (contract.delivered >= contract.quantity) settlePromise(promise, true, `钱粮实收 ${contract.delivered}，凭据 ${contract.receipts.map(item => item.id).join("、")}`);
    else if (turn >= promise.deadlineTurn) {
      settlePromise(promise, false, `期限届满，实收 ${contract.delivered}/${contract.quantity}`);
      promise.status = contract.delivered ? "partial" : "expired";
      if (promise.settlement) promise.settlement.status = promise.status;
    }
  }

  function reconcilePromises() {
    if (!state || !coreState) return;
    // The army phase writes city ownership and routes to this store. Reconcile
    // those writes before persisting contract receipts, so captures are retained.
    const latest = loadState();
    if (latest?.gameCreatedAt === coreState.createdAt) state = migrateState(latest, coreState);
    if (coreState.ended) { reconcileLordCommands(); reconcileAllianceState(); saveState(); renderAll(); return; }
    resolvePendingLordCommands();
    let armies = armySnapshot() || {};
    for (const promise of state.promises) {
      if (promise.status !== "active" || !promise.contract) continue;
      const contract = promise.contract;
      if (promise.type === "military_aid") {
        if (!contract.armyId && coreState.turn <= promise.deadlineTurn) {
          window.XianArmySystem?.acceptPromiseMission?.(promise);
          armies = armySnapshot() || armies;
          const acceptedStrategy = loadState();
          if (acceptedStrategy?.gameCreatedAt === state.gameCreatedAt) { state.cities = acceptedStrategy.cities; state.routes = acceptedStrategy.routes; }
          const order = (armies.orders || []).find(item => item.sourcePromiseId === promise.id && item.owner === promise.lordId && item.targetCityId === contract.targetCityId && item.turn >= promise.createdTurn && ["support", "defend"].includes(item.task));
          if (order) { contract.armyId = order.armyId; contract.orderId = order.id; contract.receipts.push({ id: `accepted:${order.id}`, turn: order.turn, source: order.id, kind: "accepted", armyId: order.armyId }); }
        }
        const army = armies.armies?.[contract.armyId];
        const order = (armies.orders || []).find(item => item.id === contract.orderId || item.sourcePromiseId === promise.id);
        const arrivalTurn = Number(order?.arrivedTurn);
        const arrived = order?.arrivedTurn != null && Number.isFinite(arrivalTurn) && arrivalTurn >= promise.createdTurn && arrivalTurn <= promise.deadlineTurn && order.targetCityId === contract.targetCityId;
        if (army && (army.status === "destroyed" || army.troops < 500)) settlePromise(promise, false, `承担援军的 ${army.id} 已覆灭或溃散`);
        else if (arrived) {
          contract.receipts.push({ id: `arrival:${promise.id}`, turn: arrivalTurn, armyId: order.armyId, cityId: contract.targetCityId, source: order.id, kind: "arrival" });
          promise.progress = 100; settlePromise(promise, true, `军团 ${order.armyId} 于第 ${arrivalTurn} 月抵达 ${cityDef(contract.targetCityId)?.name || contract.targetCityId}`);
        } else if (coreState.turn > promise.deadlineTurn || Number(coreState.monthlySettledTurn || 0) >= promise.deadlineTurn) { settlePromise(promise, false, army ? `援军未按期抵达；${army.lastChange}` : "期限届满，无军团实际承接任务"); promise.status = "expired"; if (promise.settlement) promise.settlement.status = promise.status; }
        else if (order?.status === "superseded" || order?.status === "failed") {
          const id = `mission-stopped:${promise.id}:${order.id}`;
          if (!contract.receipts.some(r => r.id === id)) contract.receipts.push({ id, kind: "mission-stopped", turn: coreState.turn, source: order.id, sourceFactId: order.failureFactId || null, status: order.status });
          settlePromise(promise, false, `约定军令 ${order.id} 已被撤换或失败`);
        }
        else { promise.progress = army ? 50 : 0; promise.lastChange = army ? `军团 ${army.id} 尚在途中：${army.lastChange}` : "尚无军团接受约定任务"; }
      }
      if (promise.type === "ceasefire") {
        const parties = contract.parties || [];
        const observationStart = Math.max(contract.startTurn, Number(contract.observationStartTurn || contract.startTurn));
        const bilateral = item => item.turn >= observationStart && item.turn <= contract.deadlineTurn
          && parties.includes(item.attackerOwner) && parties.includes(item.defenderOwner) && item.attackerOwner !== item.defenderOwner;
        const fact = (armies.militaryFacts || []).find(item => !contract.initialFactIds.includes(item.id) && bilateral(item));
        const battle = (armies.battleReports || []).find(item => !contract.initialBattleIds.includes(item.id) && item.turn >= contract.startTurn && item.turn <= contract.deadlineTurn && parties.includes(item.attackerOwner) && parties.includes(item.defenderOwner) && item.attackerOwner !== item.defenderOwner);
        const order = (armies.orders || []).find(item => !contract.initialOrderIds.includes(item.id) && item.turn >= contract.startTurn && item.turn <= contract.deadlineTurn && item.task === "attack" && parties.includes(item.owner) && parties.includes(item.targetOwner) && item.owner !== item.targetOwner);
        const conquest = (armies.conquests || []).find(item => !contract.initialConquestIds.includes(item.id)
          && bilateral({ ...item, attackerOwner: item.newOwner, defenderOwner: item.previousOwner }));
        if (fact || battle || order || conquest) {
          const source = fact || battle || order || conquest;
          const kind = fact?.kind || (battle ? "battle" : order ? "hostile-order" : "occupation");
          const sourceId = fact?.source || source.id;
          const entry = { id: `breach:${source.id}`, turn: source.turn, source: sourceId, kind,
            attackerOwner: source.attackerOwner || source.owner || source.newOwner,
            defenderOwner: source.defenderOwner || source.targetOwner || source.previousOwner };
          if (!contract.receipts.some(item => item.id === entry.id)) contract.receipts.push(entry);
          settlePromise(promise, false, `停战违约：${{ battle: "战报", "hostile-order": "敌对军令", "siege-start": "建立包围", "siege-progress": "围城推进", occupation: "军事占领" }[kind] || "敌对事实"} ${sourceId}`);
        } else if ((Number(coreState.monthlySettledTurn || 0) >= promise.deadlineTurn || coreState.turn > promise.deadlineTurn)
          && Number(armies.lastProcessedTurn || 0) > promise.deadlineTurn) {
          if (contract.missingHistoricalObservation || Number(armies.militaryFactsStartTurn || contract.startTurn) > contract.startTurn) {
            promise.status = "unverified";
            promise.lastChange = "观察期已结束；旧档缺少完整围城与占领历史，保留未知，不补记履约或失信";
          } else {
            contract.receipts.push({ id: `observed:${promise.id}`, turn: promise.deadlineTurn, condition: "no-bilateral-hostile-facts-after-final-army-phase" });
            promise.progress = 100; settlePromise(promise, true, "约定最后一月军团结算已完成，未发生双方敌对命令、交战、围城或军事占领");
          }
        } else {
          promise.progress = Math.round(Math.max(0, coreState.turn - promise.createdTurn) / Math.max(1, promise.deadlineTurn - promise.createdTurn + 1) * 100);
          const response = (armies.ceasefireResponses || []).findLast(item => item.turn === promise.createdTurn && parties.every(id => item.parties.includes(id)));
          promise.lastChange = response?.rejected?.length ? `停战尚未被全部承接：${response.rejected.map(item => `${item.armyId} ${item.reason}`).join("；")}` : "按军令、野战、围城与占领事实观察；须等待最后一月军团结算";
        }
      }
    }
    reconcileLordCommands();
    reconcileAllianceState();
    saveState(); renderAll();
  }

  function reconcileAllianceState() {
    const closedAlliances = window.XianAllianceDiplomacy.reconcile(state, armySnapshot() || {}, coreState);
    saveState();
    for (const id of closedAlliances) window.XianArmySystem?.releaseAllianceOrders?.(id, "盟约已结束，解除尚未完成的共同任务");
    if (closedAlliances.length) {
      reconcileLordCommands();
      window.XianAllianceDiplomacy.reconcile(state, armySnapshot() || {}, coreState);
    }
    window.XianDiplomaticEndings?.reconcile(state, armySnapshot() || {}, coreState);
    reconcileDiplomaticRelations(coreState);
    window.XianAllianceDiplomacy.propose(state, armySnapshot() || {}, coreState);
  }

  function reconcileDiplomaticRelations(core) {
    const model=window.XianDiplomaticRelations,armies=armySnapshot();
    if (!model || !core || core.ended || state?.gameCreatedAt!==core.createdAt || window.__xianFullSaveImporting) return;
    model.ledger(state,core);
    if (armies?.gameCreatedAt!==core.createdAt) return;
    model.reconcile(state,armies,core);
  }

  // The army replays paid diplomacy and military actions in their original order.
  function resolveDiplomaticRequest(id,armies,core) {
    if(!state||state.gameCreatedAt!==core?.createdAt||core.ended)return false;
    const model=window.XianDiplomaticRelations;if(!model)return false;
    model.reconcile(state,armies,core);
    model.resolveRequests(state,armies,core,window.XianWorldSystem?.getState?.()||{},id);
    model.reconcile(state,armies,core);saveState();return true;
  }

  function previewDiplomaticAction(kind,parties) {
    const core=window.XianEmperorGame?.getState?.(),model=window.XianDiplomaticRelations;
    if(!core || !model)return {ok:false,message:"外交档案尚未载入。"};
    const result=model.preview(kind,parties,state,armySnapshot(),core,window.XianWorldSystem?.getState?.()||{});
    if(!result.ok)return result;
    if(!core.eventResolved||core.ended||core.actionPoints<1||Number(core.monthlySettledTurn||0)>=core.turn)return {ok:false,message:"先裁决本月奏报，并保留1次行动。"};
    if(core.stats.treasury<result.treasuryCost)return {ok:false,message:"国库不足，议和或修好需国库2。"};
    if(state.diplomaticRelations.requests.some(r=>r.kind===kind&&r.pairId===result.pairId&&r.turn===core.turn&&core.appliedReceipts.includes(r.id)))return {ok:false,message:"本月已就同一事项交涉，请等待下一月。"};
    return result;
  }

  function performDiplomaticAction(kind,parties) {
    const view=previewDiplomaticAction(kind,parties);if(!view.ok)return false;
    const core=window.XianEmperorGame.getState(),id=`diplomatic-action:${core.createdAt}:${core.turn}:${kind}:${view.pairId}`;
    const d=state.diplomaticRelations;d.requests=d.requests.filter(r=>r.id!==id);
    d.requests.push({id,kind,parties:view.parties,pairId:view.pairId,turn:core.turn,gameCreatedAt:core.createdAt,operationSequence:core.operationSequence+1,
      offer:JSON.parse(JSON.stringify(view)),initialFactIds:(armySnapshot().militaryFacts||[]).map(f=>f.id),sourceConflictIds:d.hostilities.filter(f=>[f.attackerOwner,f.defenderOwner].sort().join("~")===view.pairId).map(f=>f.id),resolved:false});saveState();
    const applied=window.XianEmperorGame.performExternalAction({receiptId:id,actionId:"diplomatic-relations",causal:false,title:kind==="peace"?"外交·战后议和":"外交·遣使修好",
      text:view.message,chronicle:`天子为${view.parties.map(controllerName).join("与")}遣使${kind==="peace"?"议和":"修好"}，双方分别答复。`,effects:{treasury:-view.treasuryCost}});
    if(!applied&&!window.XianEmperorGame.getState().appliedReceipts.includes(id)){state.diplomaticRelations.requests=state.diplomaticRelations.requests.filter(r=>r.id!==id);saveState();}
    return applied===true;
  }

  function resolvePendingLordCommands() {
    const core = window.XianEmperorGame?.getState?.();
    if (!state.commandChain || !core || core.createdAt !== state.gameCreatedAt || core.ended || window.__xianFullSaveImporting) return;
    const pending = [...state.commandChain.intents, ...(state.allianceDiplomacy?.plans || []).map(p => ({ ...p, coalition: true }))].sort((a,b) => {
      const first = core.appliedReceipts.indexOf(a.intervention?.receiptId), second = core.appliedReceipts.indexOf(b.intervention?.receiptId);
      return (first < 0 ? Infinity : first) - (second < 0 ? Infinity : second) || window.XianLordIntentions.compareIntents(a,b);
    });
    for (const intent of pending) {
      const intervention = intent.intervention;
      if (intent.status !== "proposed" || !intervention) continue;
      if (!core.appliedReceipts.includes(intervention.receiptId)) { delete intent.intervention; continue; }
      if (intent.coalition) window.XianArmySystem?.resolveCoalitionPlan?.(intent.id, intervention.kind);
      else window.XianArmySystem?.resolveLordIntent?.(intent.id, intervention.kind);
    }
    const updated = loadState();
    if (updated?.gameCreatedAt === state.gameCreatedAt) { state.cities = updated.cities; state.routes = updated.routes; }
  }

  function reconcileLordCommands() {
    const model = window.XianLordIntentions, core = window.XianEmperorGame?.getState?.(), armies = armySnapshot();
    if (!model || !core || !armies || armies.gameCreatedAt !== state.gameCreatedAt || core.createdAt !== state.gameCreatedAt || window.__xianFullSaveImporting) return;
    const chain = state.commandChain = model.ledger(state.commandChain, core);
    model.reconcile(chain, armies, state, core);
    const short = window.XianShortChallenges?.getActiveStatus?.(core);
    if (core.ended || short || Number(core.monthlySettledTurn || 0) >= core.turn || chain.generatedTurns.includes(core.turn)) return;
    chain.generatedTurns.push(core.turn);
    chain.intents.push(...model.proposeBatch(core, state, armies, window.XianWorldSystem?.getState?.(), window.XianEmperorGame.getRandomKey("lord-intent", core.createdAt, core)));
  }

  function previewLordIntervention(intentId, kind, acknowledgeBreach = false) {
    const core = window.XianEmperorGame?.getState?.(), intent = state?.commandChain?.intents.find(i => i.id === intentId);
    if (!["coordinate", "restrain"].includes(kind) || !core || intent?.intervention) return { ok: false, message: "本次军议已干预或不存在。" };
    const result = window.XianArmySystem?.previewLordIntent?.(intentId, kind, acknowledgeBreach);
    if (!result?.ok) return result || { ok: false, message: "尚未载入军籍。" };
    const treasuryCost = kind === "coordinate" && result.accepted ? (intent.task === "attack" ? 1 : intent.task === "supply" ? 3 : 0) : 0;
    if (!core.eventResolved || core.ended || core.actionPoints < 1 || Number(core.monthlySettledTurn || 0) >= core.turn) return { ok: false, message: "先裁决本月奏报，并保留1次御前行动。" };
    if (core.stats.treasury < treasuryCost) return { ok: false, message: `国库不足，需 ${treasuryCost}。` };
    return { ...result, intentId, kind, actionCost: 1, treasuryCost, acknowledgeBreach, message: `${result.reason}；消耗1次御前行动、国库${treasuryCost}。${result.accepted ? "" : "交涉失败也消耗此次行动。"}${(result.overlapWarnings || []).join("；")}` };
  }

  function previewCoalitionIntervention(planId, kind) {
    const core = window.XianEmperorGame?.getState?.(), plan = state?.allianceDiplomacy?.plans.find(p => p.id === planId);
    if (!["coordinate", "restrain"].includes(kind) || !core || !plan || plan.intervention) return { ok: false, message: "共同军议已干预或不存在。" };
    const result = window.XianArmySystem?.previewCoalitionPlan?.(planId, kind);
    if (!result?.ok) return result || { ok: false, message: "尚未载入军籍。" };
    const treasuryCost = kind === "coordinate" ? result.members.filter(m => m.accepted && m.task === "attack").length : 0;
    if (!core.eventResolved || core.ended || core.actionPoints < 1 || Number(core.monthlySettledTurn || 0) >= core.turn) return { ok: false, message: "先裁决本月奏报，并保留1次御前行动。" };
    if (core.stats.treasury < treasuryCost) return { ok: false, message: `国库不足，需${treasuryCost}。` };
    return { ...result, actionCost: 1, treasuryCost, message: `${result.members.filter(m => m.accepted).length}/${result.members.length}镇愿接令；消耗1次御前行动、国库${treasuryCost}。各镇独立答复，拒绝交涉也消耗行动。` };
  }

  function interveneCoalition(planId, kind) {
    const preview = previewCoalitionIntervention(planId, kind);
    if (!preview.ok) return false;
    const plan = state.allianceDiplomacy.plans.find(p => p.id === planId), receiptId = `coalition-intervention:${planId}`;
    plan.intervention = { receiptId, kind, turn: coreState.turn, operationSequence: Number(coreState.operationSequence || 0)+1 }; saveState();
    const applied = window.XianEmperorGame.performExternalAction({ receiptId, actionId: "lord-command", causal: false,
      title: `联军·${kind === "coordinate" ? "协调" : "劝止"}`, text: preview.message,
      chronicle: `天子${kind === "coordinate" ? "协调" : "劝止"}诸侯共同军议。`, effects: { treasury: -preview.treasuryCost } });
    if (!applied && !window.XianEmperorGame.getState().appliedReceipts.includes(receiptId)) { delete plan.intervention; saveState(); }
    return applied === true;
  }

  function interveneLordIntent(intentId, kind, acknowledgeBreach = false) {
    const preview = previewLordIntervention(intentId, kind, acknowledgeBreach);
    if (!preview.ok) return false;
    if (preview.needsAcknowledgement) { window.XianEmperorGame.notify("请先勾选承担主动违背停战或盟约的后果，再确认交涉。", "warning"); return false; }
    const intent = state.commandChain.intents.find(i => i.id === intentId);
    const receiptId = `lord-intervention:${intentId}`;
    intent.intervention = { receiptId, kind, acknowledgeBreach: acknowledgeBreach === true, turn: coreState.turn, operationSequence: Number(coreState.operationSequence || 0)+1 };
    saveState();
    const applied = window.XianEmperorGame.performExternalAction({ receiptId, actionId: "lord-command", causal: false,
      title: `军议·${kind === "coordinate" ? "协调" : "劝止"}`, text: `${intent.ownerName}拟${orderLabel(intent.task)}${intent.targetName}；${preview.message}`,
      chronicle: `天子${kind === "coordinate" ? "协调" : "劝止"}${intent.ownerName}军议。`, effects: { treasury: -preview.treasuryCost } });
    if (!applied && !window.XianEmperorGame.getState().appliedReceipts.includes(receiptId)) { delete intent.intervention; saveState(); }
    return applied === true;
  }

  function settlePromise(promise, fulfilled, reason) {
    if (promise.status !== "active") return;
    promise.status = fulfilled ? "fulfilled" : "broken";
    promise.lastChange = reason;
    const strategy = state.strategies[promise.lordId];
    const trustBefore = Number(strategy?.trust || 0);
    if (strategy) strategy.trust = clamp(strategy.trust + (fulfilled ? 7 : -13), 0, 100);
    promise.settlement = { id: `promise-settlement:${promise.id}`, turn: Number(coreState?.turn || state.lastProcessedTurn), status: promise.status,
      reason, trustBefore, trustAfter: Number(strategy?.trust || 0), trustDelta: Number(strategy?.trust || 0) - trustBefore };
    promise.cityIds.forEach(cityId => {
      const city = state.cities[cityId];
      if (city) city.courtLoyalty = clamp(city.courtLoyalty + (fulfilled ? 3 : -5), 0, 100);
    });
    state.log.unshift({
      id: `promise-result-${promise.id}`,
      turn: state.lastProcessedTurn,
      type: fulfilled ? "diplomacy" : "warning",
      text: `${promiseName(promise)}${fulfilled ? "履行" : "违背"}${promise.label}：${reason}。`,
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
  function strategyName(id) { return window.XianCharacterAvailability?.faction?.(id, coreState)?.name || (id === "court" ? "汉廷" : lordDef(id)?.name || "外镇"); }
  function clamp(value, min, max) { return Math.min(max, Math.max(min, Number(value) || 0)); }
  function shortText(text, limit = 58) { const normalized = String(text || "").replace(/\s+/g, " ").trim(); return normalized.length > limit ? `${normalized.slice(0, limit)}……` : normalized; }
  function trimCollections() { state.log = state.log.slice(0, MAX_LOG); }

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
    content.innerHTML = `<button type="button" data-brief-tab="routes"><span>最紧张战线</span><strong>${escapeHtml(routeDef(front?.[0])?.name || "暂无")}</strong><small>${front ? `${escapeHtml(front[1].status)} · 军压 ${Math.round(front[1].pressure)}` : "等待诏令"}</small></button><button type="button" data-brief-tab="cities"><span>最脆弱城池</span><strong>${escapeHtml(cityDef(vulnerable?.[0])?.name || "暂无")}</strong><small>${vulnerable ? `守备 ${Math.round(vulnerable[1].defense)} · 粮秣 ${Math.round(vulnerable[1].supply)}` : "等待推演"}</small></button><button type="button" data-brief-tab="promises"><span>外交承诺</span><strong>${active.length} 项履行中</strong><small>${broken.length ? `${broken.length} 项已经失信` : "尚无失信记录"}</small></button>`;
    const current = state.commandChain?.intents.filter(i => i.turn === coreState?.turn && i.source === "autonomous") || [];
    if (current.length) content.innerHTML += `<button type="button" class="lord-intent-brief" data-brief-tab="strategies"><span>本月并行军议 · ${current.length} 镇 · ${current.filter(i=>i.status==="proposed").length} 项待决</span><strong>${current.map(i=>`${escapeHtml(i.ownerName)}：${escapeHtml(orderLabel(i.task))}${escapeHtml(i.targetName)}`).join("；")}</strong><small>每次协调或劝止使用1次行动；未干预军议月末按固定次序决断，旧令与已承接援军优先。查看全部军议、冲突与外交因果 →</small></button>`;
    const pacts = state.promises.filter(p => window.XianAllianceDiplomacy.formal(p) && p.status === "active");
    const joint = state.allianceDiplomacy?.plans.filter(p => p.turn === coreState?.turn) || [];
    content.innerHTML += `<button type="button" class="alliance-brief" data-brief-tab="strategies"><span>诸侯结盟与联军</span><strong>${pacts.length ? `${pacts.length}份有效盟约 · ${joint.length}项本月共同军议` : "拟旨邀请二至三镇结盟"}</strong><small>例：令${escapeHtml(controllerName("yuan_shao"))}与${escapeHtml(controllerName("gongsun_zan"))}结盟，共讨${escapeHtml(controllerName("liu_biao"))}，合攻晋阳。各镇须同意，再分别接令；查看联军、战后议和、遣使修好与背盟后果 →</small></button>`;
    content.querySelectorAll("[data-brief-tab]").forEach(button => button.addEventListener("click", () => { activeTab = button.dataset.briefTab; openOverlay(); }));
  }

  function renderOverlay() {
    const content = document.getElementById("strategy-network-content");
    const date = document.getElementById("strategy-network-date");
    if (!content || !date) return;
    document.querySelectorAll("[data-strategy-tab]").forEach(button => button.classList.toggle("active", button.dataset.strategyTab === activeTab));
    date.textContent = coreState ? `建安局势 · 第 ${coreState.turn}/${window.XianEmperorGame?.getDeadline?.(coreState) || coreState.maxTurns || 24} 月` : "尚未载入本局";
    if (!state) { content.innerHTML = '<p class="empty-state">请先开启或读取一局游戏。</p>'; return; }
    const renderers = { cities: renderCities, routes: renderRoutes, promises: renderPromises, strategies: renderStrategies };
    content.innerHTML = renderSummary() + (renderers[activeTab] || renderCities)();
    content.querySelectorAll("[data-lord-action]").forEach(button => button.addEventListener("click", () => openLordIntervention(button.dataset.intentId, button.dataset.lordAction)));
    content.querySelectorAll("[data-relations-party]").forEach(select=>select.addEventListener("change",()=>{diplomaticSelection[Number(select.dataset.relationsParty)]=select.value;renderOverlay();}));
    content.querySelectorAll("[data-relations-action]").forEach(button=>button.addEventListener("click",()=>openDiplomaticAction(button.dataset.relationsAction)));
    content.querySelectorAll("[data-coalition-action]").forEach(button => button.addEventListener("click", () => openCoalitionIntervention(button.dataset.planId, button.dataset.coalitionAction)));
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
    return `<section><div class="strategy-section-head"><div><span class="section-kicker">战争路线</span><h3>军路与补给线</h3></div><small>按军事压力排序</small></div><div class="route-network-list">${sorted.map(([def, route]) => `<article class="route-card ${route.status === "战线激烈" ? "danger" : /阻断|封锁/.test(route.status) ? "blocked" : ""}"><div class="route-card-head"><div><strong>${escapeHtml(def.name)}</strong><small>${escapeHtml(def.type)} · ${escapeHtml(def.terrain)}</small></div><b>${escapeHtml(route.status)}</b></div><div class="route-endpoints"><span>${escapeHtml(cityDef(def.from)?.name || def.from)}</span><i>⇄</i><span>${escapeHtml(cityDef(def.to)?.name || def.to)}</span></div>${metric("补给", route.supply)}${metric("军压", route.pressure, true)}<p>${escapeHtml(route.lastChange)}</p></article>`).join("")}</div></section>`;
  }

  function renderPromises() {
    const order = { active: 0, broken: 1, fulfilled: 2 };
    const promises = [...state.promises].sort((a, b) => (order[a.status] ?? 3) - (order[b.status] ?? 3) || b.createdTurn - a.createdTurn).slice(0, MAX_PROMISES);
    return `<section><div class="strategy-section-head"><div><span class="section-kicker">外交承诺</span><h3>盟约与履约</h3></div><small>全局${state.promises.length}项，展示前40项；贡赋按实收、援军按抵达、停战按实际行为结算</small></div><div class="promise-list">${promises.length ? promises.map(promise => `<article class="promise-card ${escapeHtml(promise.status ?? "")}"><div class="promise-card-head"><div><span>${escapeHtml(promise.label)}</span><strong>${escapeHtml(promiseName(promise))}</strong></div><b>${promiseStatus(promise.status)}</b></div><p>${escapeHtml(promise.text)}</p>${renderContract(promise)}<div class="promise-progress"><i><b style="width:${clamp(promise.progress, 0, 100)}%"></b></i><em>${Math.round(promise.progress)}%</em></div><small>第 ${promise.createdTurn} 月立约 · 第 ${promise.deadlineTurn} 月期限 · ${escapeHtml(promise.lastChange)}</small></article>`).join("") : '<p class="empty-state">在圣旨中写明奉表、出兵、结盟、停战、互市、质子或官爵，即可建立外交承诺。</p>'}</div></section>`;
  }

  function renderContract(promise) {
    const contract = promise.contract;
    if (window.XianAllianceDiplomacy.formal(promise)) return `<p>${escapeHtml(contract.partyNames.join(" ↔ "))}；第${contract.startTurn}—${contract.deadlineTurn}月互不进攻。${contract.targetCityId ? `共同${contract.operation === "defend" ? "防守" : "进攻"}${escapeHtml(contract.targetName)}，主攻方${escapeHtml(controllerName(contract.leaderOwner))}；签约不会直接出兵。` : "未约定共同军事目标。"}</p><ul>${contract.receipts.filter(r=>r.kind==="consent").map(r=>`<li>${escapeHtml(r.actorName)}：${r.status === "accepted" ? "同意" : "拒绝"} · ${escapeHtml(r.reason)}</li>`).join("")}</ul><p>主动攻击盟方或撤换未完成的共同军令会背盟；战败、缺粮与接令前拒绝不等于背盟。守约信誉与责任归属见联军记录。</p>`;
    if (promise.identity?.scope === "legacy-person") return "<p>此项以原人物为对象的承诺仅作历史保留，当前代表不继承个人承诺；缺少重新约定时不推定兑现。</p>";
    if (!contract) return `<p>${promise.evidenceStatus ? "旧档保留原结论：缺少实物或军务凭据，不补发钱粮，不补记抵达。" : "此类承诺按信任、准备度与期限推演，仅影响信任与地方忠诚；不代表实物交付。"}</p>`;
    const detail = promise.type === "tribute"
      ? `${controllerName(contract.responsible)} → ${controllerName(contract.beneficiary)}：约定钱粮 ${contract.quantity}，实收 ${contract.delivered}；来源 ${cityDef(contract.payerCityId)?.name || "责任方治所"}，每月最多 3，实收等额扣除当地粮秣。`
      : promise.type === "military_aid"
        ? `${controllerName(contract.responsible)} → ${cityDef(contract.targetCityId)?.name || contract.targetCityId}：${contract.armyId ? `军团 ${contract.armyId}，军令 ${contract.orderId || "待核"}` : "尚未承接"}；须在第 ${promise.deadlineTurn} 月结束前实际抵达，沿途承担军粮与减员。`
        : `${contract.parties.map(controllerName).join(" ↔ ")}：第 ${contract.startTurn}—${contract.deadlineTurn} 月停止相互进攻；敌对军令、双方野战、围城推进及军事占领构成违约；旧军令不豁免签约后的敌对行动。`;
    const receipts = (contract.receipts || []).map(receipt => {
      const line = receipt.resource === "treasury" ? `国库 ${receipt.before} → ${receipt.after}（实收 ${receipt.amount}；来源粮秣 −${receipt.sourceSupplySpent ?? receipt.amount}）`
        : receipt.kind === "arrival" ? `军团 ${receipt.armyId} 已抵达 ${cityDef(receipt.cityId)?.name || receipt.cityId}`
          : receipt.kind === "accepted" ? `军团 ${receipt.armyId} 已承接任务`
            : receipt.kind === "battle" ? "双方战报违约" : receipt.kind === "hostile-order" ? "敌对军令违约"
              : receipt.kind === "siege-start" ? "建立包围违约" : receipt.kind === "siege-progress" ? "围城推进违约" : receipt.kind === "occupation" ? "军事占领违约" : "约定期限观察完成";
      return `<li>第 ${receipt.turn} 月：${escapeHtml(line)}<small>凭据 ${escapeHtml(receipt.source || receipt.id)}</small></li>`;
    }).join("");
    return `<p>${escapeHtml(detail)}</p>${contract.migration ? "<p>旧档迁移：仅核验载入后的事实，不追认缺失的历史成果。</p>" : ""}<details><summary>实际履约回执（${contract.receipts.length}）</summary>${receipts ? `<ul>${receipts}</ul>` : "<p>暂无实际履约凭据。</p>"}</details>`;
  }

  function renderStrategies() {
    const entries = Object.values(state.strategies).sort((a, b) => b.readiness - a.readiness);
    return renderDiplomaticRelations() + renderAlliances() + renderCommandChain() + `<section><div class="strategy-section-head"><div><span class="section-kicker">诸侯战略</span><h3>当前方略</h3></div><small>诏令目标与准备度；实际行动以军令回执为准</small></div><div class="lord-strategy-grid">${entries.map(strategy => `<article class="lord-strategy-card"><div><strong>${escapeHtml(strategyName(strategy.lordId))}</strong><b>${escapeHtml(orderLabel(strategy.order))}</b></div><h4>${escapeHtml(strategy.objective)}</h4>${metric("战备", strategy.readiness)}${metric("信任", strategy.trust)}<p>${escapeHtml(strategy.lastChange)}</p></article>`).join("")}</div><section class="strategy-log"><div class="strategy-section-head"><div><span class="section-kicker">军国记录</span><h3>最近变化</h3></div></div>${state.log.slice(0, 12).map(item => `<article><span>${escapeHtml(logIcon(item.type))}</span><div><strong>第 ${item.turn} 月</strong><p>${escapeHtml(item.text)}</p></div></article>`).join("")}</section></section>`;
  }

  function chainStatus(status) { return { proposed: "待接令", requested: "待回执", accepted: "已接令", restrained: "已劝止", refused: "拒令", marching: "行军中", arrived: "已抵达", besieging: "围城中", captured: "已占领", failed: "军令失败", superseded: "已换令", expired: "逾期无回执" }[status] || status; }

  function renderCommandChain() {
    const chain = state.commandChain;
    if (!chain) return "";
    const intents = [...chain.intents].reverse().sort((a, b) => b.turn - a.turn).slice(0, 12);
    return `<section class="lord-command-chain"><div class="strategy-section-head"><div><span class="section-kicker">诸侯军议</span><h3>意图 → 接令 → 军务 → 外交</h3></div><small>共 ${chain.intents.length} 条，显示最近12条</small></div><p>常规局每月最多三镇并议，御前仍只有两次行动。不干预时主将在月末自行决断；军议与天下传闻均不等于出兵。协调或劝止消耗1次行动，拒令也消耗交涉行动。</p>${renderCouncilLedger()}${intents.length ? intents.map(intent => {
      const consequences = chain.consequences.filter(c => c.intentId === intent.id);
      const controls = intent.source === "autonomous" && intent.status === "proposed" && !intent.intervention && intent.turn === coreState.turn;
      const coordinate = controls && previewLordIntervention(intent.id, "coordinate"), restrain = controls && previewLordIntervention(intent.id, "restrain");
      return `<article class="lord-command-card" data-lord-intent="${escapeHtml(intent.id)}"><div><strong>第 ${intent.turn} 月 · ${escapeHtml(intent.ownerName)}</strong><b>${escapeHtml(chainStatus(intent.status))}</b></div><h4>${escapeHtml(intent.armyName || intent.ownerName)}：${escapeHtml(orderLabel(intent.task))}${escapeHtml(intent.targetName || "本镇驻地")}</h4><p>${escapeHtml(intent.reason || "朝廷军令请求")}</p><p>${escapeHtml(intent.responseReason || "尚无接令回执")}${intent.restraintResponse ? "；曾拒绝朝廷劝止" : ""}</p>${intent.orderId ? `<p>军务：${escapeHtml(intent.lastProgress || "已建立真实军令，等待军团结算")}</p>` : ""}${controls ? `<div class="lord-command-actions"><button type="button" data-lord-action="coordinate" data-intent-id="${escapeHtml(intent.id)}" ${coordinate.ok ? "" : "disabled"}>协调执行 · 1行动 / ${coordinate.treasuryCost || 0}国库</button><button type="button" data-lord-action="restrain" data-intent-id="${escapeHtml(intent.id)}" ${restrain.ok ? "" : "disabled"}>劝止军议 · 1行动</button></div><small>${escapeHtml(coordinate.message)}</small>` : ""}<details><summary>军务与外交凭据（${intent.factIds?.length || 0}）</summary>${consequences.length ? consequences.map(c => `<p>第 ${c.turn} 月 · ${escapeHtml(c.attackerName)} → ${escapeHtml(c.defenderName)}：${escapeHtml({ "hostile-order": "敌对军令", battle: "野战", "siege-start": "建立包围", "siege-progress": "围城推进", occupation: "军事占领" }[c.kind] || c.kind)}；${c.responsibility === "court" ? "朝廷协调" : c.responsibility === "defence" ? "受战一方" : "诸侯自主"}${c.trustDelta ? `，对方对朝廷信任 ${c.trustDelta}` : ""}${c.promiseIds.length ? "；相关停战已按原约结算" : ""}。</p>`).join("") : "<p>尚无敌对军事事实；拒令与拟议本身不造成战果或违约。守备抵达以军令回执核验。</p>"}</details></article>`;
    }).join("") : '<p class="empty-state">本局尚无可核验军议。旧档不补造历史军令，短局与周挑战沿用原定事件流程。</p>'}</section>`;
  }

  function renderCouncilLedger() {
    const chain = state.commandChain;
    const conflicts = armySnapshot()?.commandConflicts || [];
    const reactions = chain.reactions || [], incidents = chain.incidents || [], outcomes = chain.promiseOutcomes || [];
    const kinds = { "army-busy": "军团争令", replacement: "明确换令", "target-competition": "同城争夺", "road-meeting": "军路遭遇", "siege-command": "友军协战" };
    return `<details class="council-ledger"><summary>军令冲突 ${conflicts.length} · 外交回应 ${reactions.length} · 实际军事事件 ${incidents.length}</summary><p>提示本身不交战、不改城防，也不处罚。冲突只在实际请求或军团行动后入档；停战、援军及第三方回应沿同一事实追溯。</p><h4>军令复核</h4>${[...conflicts].reverse().slice(0,8).map(c=>`<article><strong>第${c.turn}月 · ${escapeHtml(kinds[c.kind] || "军令复核")}</strong><p>${escapeHtml((c.armyNames || []).join(" ↔ "))}${c.routeName || c.cityName ? ` · ${escapeHtml(c.routeName || c.cityName)}` : ""}：${escapeHtml(c.reason)}</p><small>${c.decision === "refused" ? "新请求未执行" : c.decision === "replaced" ? "旧任务已撤换" : c.decision === "occupied" ? `${escapeHtml(c.victorName)}实际占领` : c.decision === "closed" ? "相关军令已停止，未记录占领" : c.decision === "fighting" ? "已有实战，尚无占领凭据" : c.decision === "contested" ? "尚须真实交战决定" : c.decision === "support" ? "仅主攻军推进围城" : `${c.factIds?.length || 0}项真实战斗凭据`}</small></article>`).join("") || "<p>尚无实际冲突。</p>"}<h4>外交连锁</h4>${[...reactions].reverse().slice(0,8).map(r=>`<article><strong>第${r.turn}月 · ${escapeHtml(r.actorName)}护援警讯</strong><p>${escapeHtml(r.attackerName)} → ${escapeHtml(r.protectedName)}；${escapeHtml(r.text)}</p><p>${r.requestedTrustDelta ? `朝廷背书的敌对行动触发援方警惕：援方对朝廷信任实际 ${r.trustDelta}；同一军令、援方与受援方只处理一次` : "诸侯自主行动：记录援方警惕，不扣朝廷信任"}。</p><small>${chain.intents.filter(i=>(i.reactionIds || []).includes(r.id)).length}项后续军议已引用此回应；援军是否完成仍按原军令核验</small></article>`).join("") || "<p>尚无符合实际援约及接令凭据的第三方回应，普通停战不视为同盟。</p>"}<h4>原约结算</h4>${outcomes.slice(-8).reverse().map(o=>`<article><strong>第${o.turn}月 · ${escapeHtml(o.actorName)} · ${escapeHtml(o.label || "外交承诺")}</strong><p>${escapeHtml(promiseStatus(o.status))}，信任实际 ${o.trustDelta}；${escapeHtml(o.reason)}</p><small>关联${o.conflictIds.length}项军令冲突、${o.sourceFactIds.length}项军事事实；沿用原约结算，不另加同一处罚</small></article>`).join("") || "<p>尚无新结算凭据。</p>"}<h4>最近实际事件</h4>${incidents.slice(-6).reverse().map(i=>`<p>第${i.turn}月 · ${escapeHtml(i.attackerName)} → ${escapeHtml(i.defenderName)}：${i.routeId ? "军路交战" : ({"hostile-order":"敌对军令",battle:"野战","siege-start":"建立包围","siege-progress":"围城推进",occupation:"军事占领"}[i.kind] || "军事行动")}，关联${i.intentIds.length}项军议、${i.promiseIds.length}项原约后果。</p>`).join("") || "<p>尚无军事事实。</p>"}</details>`;
  }

  function openLordIntervention(intentId, kind) {
    const preview = previewLordIntervention(intentId, kind);
    if (!preview.ok) return;
    window.XianEmperorGame.openUtilityModal({ title: kind === "coordinate" ? "协调诸侯军议" : "劝止诸侯军议", confirmText: "确认交涉", body: `<p>${escapeHtml(preview.message)}</p><p>接令后仍须真实行军与作战，不保证抵达或取胜。</p>${preview.risk ? '<label class="lord-breach-consent"><input id="lord-breach-consent" type="checkbox">我愿承担主动破坏现有停战或盟约的后果；仅在军团实际接令后记违约。</label>' : ""}`,
      onConfirm: () => {
        if (interveneLordIntent(intentId, kind, preview.risk && document.getElementById("lord-breach-consent")?.checked === true)) window.XianEmperorGame.closeUtilityModal();
      } });
  }

  function openDiplomaticAction(kind) {
    const parties=[...diplomaticSelection],view=previewDiplomaticAction(kind,parties);
    if(!view.ok){window.XianEmperorGame.notify(view.message,"warning");return;}
    window.XianEmperorGame.openUtilityModal({title:kind==="peace"?"提议战后议和":"遣使修复盟好",wide:true,
      body:`<p>${escapeHtml(parties.map(controllerName).join(" ↔ "))}</p><p>${escapeHtml(view.message)}</p>${view.consents.map(c=>`<p><strong>${escapeHtml(c.actorName)}：${c.status==="accepted"?"愿意承接":"将拒绝"}</strong> · 交涉意愿${c.score}；厌战${c.weariness}，对朝廷信任${c.trust}。${escapeHtml(c.reason)}</p>`).join("")}<p>${kind==="peace"?"各镇同意后，军团按本镇意愿停止双方进攻并撤围；第三方战事不受此约影响。须完成四个月观察，和约才算履行；其后继续维持和平，除非实际破约。":"须先有至少两个月实际和平观察。修好承接可改善互信与信誉；旧背盟仍须两个后续完整守约期才确认修复。每轮旧怨最多两次修好承接，同月不能重复。"}</p>`,
      confirmText:"确认交涉 · 1行动／2国库",onConfirm:()=>{window.XianEmperorGame.closeUtilityModal();performDiplomaticAction(kind,parties);}});
  }

  function renderDiplomaticRelations() {
    if(!window.XianDiplomaticRelations||!coreState||!state.diplomaticRelations)return "";
    const d=state.diplomaticRelations,p=window.XianDiplomaticRelations.pair(state,...diplomaticSelection),peace=previewDiplomaticAction("peace",diplomaticSelection),repair=previewDiplomaticAction("repair",diplomaticSelection);
    const options=i=>DATA.lords.map(l=>`<option value="${escapeHtml(l.id)}" ${diplomaticSelection[i]===l.id?"selected":""}>${escapeHtml(controllerName(l.id))}</option>`).join("");
    const status=t=>({active:"观察中",fulfilled:"已完整履行，继续维持和平",broken:"和约已破",unverified:"历史观察有缺项，保留当前和平同意"}[t.status]||t.status);
    return `<section class="relations-desk" aria-label="战后议和与信任修复"><h3>战后议和与信任修复</h3><p>双方须分别同意。议和先停攻撤围，再按实际军事结算观察；遣使修好与后续守约逐步重建信任。</p><div class="relations-selectors"><label>一方<select data-relations-party="0" aria-label="交涉一方">${options(0)}</select></label><label>另一方<select data-relations-party="1" aria-label="交涉另一方">${options(1)}</select></label></div><p class="relations-current">${escapeHtml(diplomaticSelection.map(controllerName).join(" ↔ "))} · 双方互信${p.trust}／100 · 旧怨${p.grievance}／100</p><div class="lord-command-actions"><button type="button" data-relations-action="peace" ${peace.ok?"":"disabled"}>提议议和 · 1行动／2国库</button><button type="button" data-relations-action="repair" ${repair.ok?"":"disabled"}>遣使修好 · 1行动／2国库</button></div><p>${escapeHtml(peace.message)}</p><p>${escapeHtml(repair.message)}</p><details><summary>查看和约与双方长期关系</summary>${d.treaties.slice().reverse().map(t=>`<p>${escapeHtml(t.parties.map(controllerName).join(" ↔ "))} · ${escapeHtml(status(t))}；第${t.createdTurn}—${t.deadlineTurn}月观察，实际观察${t.observedTurns.length}月，${t.stoppedArmies||0}支军团停攻。${t.brokenTurn?`第${t.brokenTurn}月实际破约；旧履约记录保留。`:""}</p>`).join("")||"<p>尚无战后和约。</p>"}${Object.values(d.pairs).sort((a,b)=>a.id.localeCompare(b.id)).map(p=>`<p>${escapeHtml(p.parties.map(controllerName).join(" ↔ "))} · 互信${p.trust}，旧怨${p.grievance}；${d.repairs.filter(r=>r.pairId===p.id).length}宗背盟责任已获修复确认。</p>`).join("")}${d.requests.filter(r=>r.resolved).slice(-6).reverse().map(r=>`<p>第${r.turn}月 · ${escapeHtml(r.parties.map(controllerName).join(" ↔ "))} ${r.kind==="peace"?"议和":"修好"}：${r.accepted?"双方已承接":"未获全部承接"}。${r.consents.map(c=>`${escapeHtml(c.actorName)}：${escapeHtml(c.reason)}`).join("；")}</p>`).join("")}</details></section>`;
  }

  function renderAlliances() {
    const d = state.allianceDiplomacy, pacts = state.promises.filter(window.XianAllianceDiplomacy.formal);
    const plans = d.plans.filter(p=>p.turn===coreState?.turn || p.orderIds.length).slice(-6).reverse();
    const facts = armySnapshot()?.militaryFacts || [];
    const cards = plans.map(plan => {
      const current = plan.turn === coreState?.turn && !plan.intervention && plan.members.some(m=>m.status==="proposed");
      const coordinate = current ? previewCoalitionIntervention(plan.id,"coordinate") : {}, restrain = current ? previewCoalitionIntervention(plan.id,"restrain") : {};
      const times = plan.members.map(m=>m.routeIds.length), staggered = Math.max(...times) !== Math.min(...times);
      const participation = facts.filter(f=>f.participants?.some(p=>plan.orderIds.includes(p.orderId))).slice(-3);
      return `<article class="lord-command-card coalition-card" data-coalition-plan="${escapeHtml(plan.id)}"><div><strong>第${plan.turn}月 · 共同军议 · ${escapeHtml(cityDef(plan.targetCityId)?.name || "本镇")}</strong><b>${escapeHtml({proposed:"待接令",accepted:"各镇已接令",partial:"部分承接",refused:"未承接",restrained:"已暂缓"}[plan.status] || plan.status)}</b></div><p>主攻方${escapeHtml(controllerName(plan.leaderOwner))}；${escapeHtml(plan.lastChange)}</p>${plan.members.map(m=>`<p><strong>${escapeHtml(m.ownerName)} · ${escapeHtml(m.armyName)}</strong>：${m.coalitionRole === "leader" ? "主攻" : "协战"}，${escapeHtml(cityDef(m.originCityId)?.name || "无驻地")} → ${escapeHtml(m.targetName)}；${m.routeIds.length}段军路，预计${m.routeIds.length}月；${escapeHtml(chainStatus(m.status))}。${escapeHtml(m.lastProgress || m.responseReason || "尚无实际军令")}</p>`).join("")}<small>${staggered ? "各军到达时间不同；早到军须独自承受战事，迟到军不能远程助战。" : "各军分别行军；须实际同城或同路、同向出发才协战。"}同城每月仅推进一次城围，实际主攻方接管城池。</small>${current ? `<div class="lord-command-actions"><button type="button" data-coalition-action="coordinate" data-plan-id="${escapeHtml(plan.id)}" ${coordinate.ok ? "" : "disabled"}>协调联军 · 1行动 / ${coordinate.treasuryCost || 0}国库</button><button type="button" data-coalition-action="restrain" data-plan-id="${escapeHtml(plan.id)}" ${restrain.ok ? "" : "disabled"}>劝止联军 · 1行动</button></div><small>${escapeHtml(coordinate.message || "")}</small>` : ""}${participation.map(f=>`<p>第${f.turn}月实际协战：${f.participants.map(p=>`${escapeHtml(controllerName(p.owner))}到场${p.troopsBefore}兵，伤亡${p.losses}、耗粮${p.supplySpent}`).join("；")}。</p>`).join("")}</article>`;
    }).join("");
    return `<section class="alliance-desk"><div class="strategy-section-head"><h3>盟约与联军</h3><small>${pacts.filter(p=>p.status==="active").length}份有效盟约 · 各方独立同意与接令</small></div><p>结盟须明确二至三镇；可写“共讨某镇，合攻某城”。签约使用拟旨行动，协调或劝止整项共同军议另用1行动；月末未干预军议由各镇自主决定。</p>${pacts.slice(0,6).map(p=>`<p><strong>${escapeHtml(p.contract.partyNames.join(" ↔ "))}</strong> · ${promiseStatus(p.status)} · 第${p.deadlineTurn}月止；${escapeHtml(p.lastChange)}</p>`).join("") || "<p>尚无正式盟约。</p>"}${cards}${window.XianDiplomaticEndings?.render(window.XianDiplomaticEndings.preview(coreState)) || ""}<details class="alliance-consequences"><summary>守约信誉与背盟后果</summary><p>${DATA.lords.map(l=>`${escapeHtml(controllerName(l.id))} ${d.reputations[l.id] ?? 50}`).join(" · ")}</p><p>信誉初始50，背盟至多−13；低于35难以再次结盟。朝廷授意背盟另使受害方对朝廷信任至多−5，相关盟方警惕至多−2；诸侯自主背盟由本镇承担。重复事实不重复扣罚，不自动引发盟友的盟友参战。</p>${d.consequences.slice(-8).reverse().map(c=>`<p>第${c.turn}月 · ${escapeHtml(c.actorName)}${c.kind === "coalition-withdrawal" ? "撤离共同任务" : c.kind === "peace-breach" ? "违背和约" : "攻击盟方"}：守约信誉实际${c.reputationDelta}；${c.responsibility === "court" ? "朝廷授意" : "诸侯自主"}；${c.trustChanges.map(x=>`${escapeHtml(controllerName(x.actor))}对朝廷信任${x.actual}`).join("，")}。</p>`).join("") || "<p>尚无背盟事实。</p>"}${d.reactions.slice(-8).map(r=>`<p>第${r.turn}月 · ${escapeHtml(r.actorName)}因本镇盟约而警惕；对朝廷信任实际${r.trustDelta}${r.sharedAidWarning ? "，与援军警惕共用一次处罚" : ""}。</p>`).join("")}</details></section>`;
  }

  function openCoalitionIntervention(planId, kind) {
    const preview = previewCoalitionIntervention(planId,kind);
    if (!preview.ok) return;
    window.XianEmperorGame.openUtilityModal({ title: kind === "coordinate" ? "协调联军" : "劝止联军", confirmText: "确认交涉",
      body: `<p>${escapeHtml(preview.message)}</p>${preview.members.map(m=>`<p>${escapeHtml(m.ownerName)}：${m.accepted ? "愿意" : "拒绝"}；${escapeHtml(m.reason)}；预计${m.eta}月抵达。</p>`).join("")}<p>每军单独复核；现有军令与已承接援军优先。实际到场后才计协战，不保证同时到达或取胜。</p>`,
      onConfirm: () => { if(interveneCoalition(planId,kind))window.XianEmperorGame.closeUtilityModal(); } });
  }

  function metric(label, value, inverse = false) {
    return `<div class="strategy-metric ${inverse ? "inverse" : ""}"><span>${label}</span><i><b style="width:${clamp(value, 0, 100)}%"></b></i><em>${Math.round(value)}</em></div>`;
  }

  function promiseStatus(status) { return { active: "履行中", fulfilled: "已履行", broken: "已失信", partial: "部分履行", expired: "已超期", unverified: "历史待核", refused: "未成盟" }[status] || status; }
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
    if (window.XianCharacterAvailability?.faction) return window.XianCharacterAvailability.faction(id, coreState).name;
    if (id === "court") return "汉廷";
    if (id === "fragmented") return "地方残部";
    if (id === "shi_family") return "士氏";
    return DATA.lords.find(lord => lord.id === id)?.name || id;
  }

  function applyCampaignEffects(pkg = {}) {
    if (!state) return false;
    Object.entries(pkg.cities || {}).forEach(([id, effects]) => {
      const city = state.cities[id];
      if (!city) return;
      ["defense", "supply", "courtLoyalty", "pressure"].forEach(key => {
        if (Number.isFinite(Number(effects[key]))) city[key] = clamp(Number(city[key] || 0) + Number(effects[key]), 0, 100);
      });
      if (effects.controller) city.controller = effects.controller;
      if (effects.controllerName) city.controllerName = effects.controllerName;
      city.lastChange = effects.reason || pkg.reason || "战役态势调整";
    });
    Object.entries(pkg.routes || {}).forEach(([id, effects]) => {
      const route = state.routes[id];
      if (!route) return;
      if (Number.isFinite(Number(effects.supply))) route.supply = clamp(Number(route.supply || 0) + Number(effects.supply), 0, 100);
      if (Number.isFinite(Number(effects.pressure))) route.pressure = clamp(Number(route.pressure || 0) + Number(effects.pressure), 0, 100);
      ["blockadedUntil", "weatherUntilTurn", "weatherCost"].forEach(key => {
        if (effects[key] === null) delete route[key];
        else if (Number.isFinite(Number(effects[key]))) route[key] = Number(effects[key]);
      });
      route.status = Number(route.blockadedUntil || 0) >= Number(coreState?.turn || 0) ? "道路封锁" : routeStatus(route.supply, route.pressure);
      route.lastChange = effects.reason || pkg.reason || "战役态势调整";
    });
    Object.entries(pkg.strategies || {}).forEach(([id, effects]) => {
      const strategy = state.strategies[id];
      if (!strategy) return;
      if (Number.isFinite(Number(effects.trust))) strategy.trust = clamp(Number(strategy.trust || 0) + Number(effects.trust), 0, 100);
      if (Number.isFinite(Number(effects.readiness))) strategy.readiness = clamp(Number(strategy.readiness || 0) + Number(effects.readiness), 0, 100);
      strategy.lastChange = effects.reason || pkg.reason || "人物差遣影响";
    });
    if (pkg.log) state.log.unshift({ id: `campaign-${Date.now()}`, turn: Number(coreState?.turn || state.lastProcessedTurn || 1), type: pkg.type || "system", text: pkg.log });
    state.log = state.log.slice(0, MAX_LOG);
    saveState();
    renderAll();
    document.dispatchEvent(new CustomEvent("xian:strategy-campaign-update", { detail: { reason: pkg.reason || "战役态势调整" } }));
    return true;
  }

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
  }

  function previewHostilities(text, core = window.XianEmperorGame?.getState?.() || coreState) {
    if (!state || !isValidCore(core) || choosePrimaryOrder(detectOrders(text)) !== "attack") return [];
    const owners = detectLordTargets(text), targetCityId = detectCityTargets(text).at(-1);
    const targetOwner = state.cities[targetCityId]?.controller;
    const fieldOwners = Object.values(armySnapshot()?.armies || {}).filter(army => army.cityId === targetCityId
      && army.troops >= 500 && !["destroyed", "routing", "marching"].includes(army.status)).map(army => army.owner);
    return [...state.promises,...(window.XianDiplomaticRelations?.protectedTreaties(state)||[])].filter(promise => (promise.type === "ceasefire" || promise.type === "postwar_peace" || window.XianAllianceDiplomacy.formal(promise)) && promise.status === "active"
      && core.turn <= promise.deadlineTurn
      && (owners.length ? owners : ["court"]).some(owner => promise.contract?.parties?.includes(owner)
        && [targetOwner, ...fieldOwners].some(opponent => opponent !== owner && promise.contract.parties.includes(opponent))))
      .map(promise => ({ promiseId: promise.id, targetOwner, targetCityId,
        message: promise.contract.parties.includes(targetOwner) ? `主动违约：若此攻击军令被承接，将违背 ${promise.contract.parties.map(controllerName).join("与")} 的停战或盟约；旧军令也不能豁免签约后继续围城或占领。`
          : `停战风险：目标城外存在约定对方的野战军，实际交战将违背 ${promise.contract.parties.map(controllerName).join("与")} 的停战或盟约。` }));
  }

  window.XianStrategyNetwork = Object.freeze({
    previewDiplomaticAction,
    performDiplomaticAction,
    resolveDiplomaticRequest,
    previewCoalitionIntervention,
    interveneCoalition,
    previewLordIntervention,
    interveneLordIntent,
    reconcilePromises,
    previewHostilities,
    previewContracts: (text, execution = 65) => {
      const core = window.XianEmperorGame?.getState?.() || coreState;
      if (!isValidCore(core)) return [];
      const lords = detectLordTargets(text), cities = detectCityTargets(text);
      const contracts = detectPromises(text).filter(type => ["tribute", "military_aid", "ceasefire"].includes(type)).flatMap(type => (type === "ceasefire" ? lords.slice(0, 1) : lords).map(lord => ({ type, ...buildContract(type, lord, lords, cities, text, core) })));
      const alliance = window.XianAllianceDiplomacy.offer(text, core, state, armySnapshot() || {}, execution);
      return alliance ? [...contracts, alliance] : contracts;
    },
    syncFromCore: raw => processCoreSave(raw),
    settleMonth: () => {
      processCoreSave(localStorage.getItem(GAME_SAVE_KEY));
      if (state && coreState && state.lastProcessedTurn <= Number(coreState.monthlySettledTurn || 0)) processCoreSave(localStorage.getItem(GAME_SAVE_KEY));
    },
    detectCityTargets,
    detectLordTargets,
    detectOrders,
    detectPromises,
    findRoutePath,
    resolveOrderedPath: resolveOrderRoute,
    choosePrimaryOrder,
    extractEdictText,
    applyCampaignEffects,
    getState: () => state ? JSON.parse(JSON.stringify(state)) : null,
    peekState,
    open: openOverlay,
  });
})();
