/*
 * 天子蒙尘：献帝模拟器 v0.5.2
 * 军团、行军、野战、围城、城池易手与战后裁决。
 */
(() => {
  "use strict";

  const DATA = window.XIAN_ARMY_DATA;
  const STRATEGY_DATA = window.XIAN_STRATEGY_DATA;
  const STRATEGY_API = window.XianStrategyNetwork;
  if (!DATA || !STRATEGY_DATA || !STRATEGY_API) {
    console.error("军团系统依赖未加载。");
    return;
  }

  const CORE_KEY = "xian_emperor_simulator_v01";
  const STRATEGY_KEY = "xian_emperor_strategy_network_v040";
  const STORAGE_KEY = "xian_emperor_armies_v050";
  const VERSION = "0.5.2";
  const MAX_REPORTS = 40;
  const MAX_ORDERS = 50;
  const MAX_LOG = 80;

  let state = null;
  let coreState = null;
  let activeTab = "armies";
  let initialized = false;
  let processTimer = null;
  let strategyDirty = false;

  installStorageWatcher();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

  function installStorageWatcher() {
    if (window.__xianArmyWatcherInstalled) return;
    window.__xianArmyWatcherInstalled = true;
    const previousSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function armyAwareSetItem(key, value) {
      previousSetItem.apply(this, arguments);
      if (
        this !== localStorage ||
        key !== CORE_KEY ||
        window.__xianArmyRefreshOnly ||
        window.__xianStrategyRefreshOnly
      ) return;
      window.clearTimeout(processTimer);
      processTimer = window.setTimeout(() => processCoreSave(value), 240);
    };
  }

  function init() {
    if (initialized) return;
    initialized = true;
    installNavButton();
    installBrief();
    installOverlay();
    processCoreSave(localStorage.getItem(CORE_KEY), true);
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
    strategyDirty = false;
    processNewReports(core);
    processElapsedTurns(core);
    state.updatedAt = new Date().toISOString();
    saveState();
    renderAll();

    if (strategyDirty && !firstLoad) signalStrategyRefresh(raw);
  }

  function isValidCore(core) {
    return Boolean(core && typeof core === "object" && Number.isFinite(core.turn) && core.stats && core.hidden);
  }

  function loadState() {
    return safeParse(localStorage.getItem(STORAGE_KEY));
  }

  function saveState() {
    if (!state) return;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
    catch (error) { console.warn("军团系统保存失败", error); }
  }

  function createState(core) {
    const armies = {};
    DATA.armies.forEach(def => {
      armies[def.id] = {
        id: def.id,
        owner: def.owner,
        ownerName: def.ownerName,
        commander: def.commander,
        troops: def.troops,
        maxTroops: def.troops,
        morale: def.morale,
        supply: def.supply,
        training: def.training,
        loyalty: def.loyalty,
        fatigue: 8,
        cityId: def.cityId,
        originCityId: def.cityId,
        targetCityId: def.cityId,
        routeIds: [],
        routeIndex: 0,
        currentRouteId: null,
        task: "idle",
        status: "idle",
        orderedTurn: core.turn,
        eta: 0,
        orderAuthority: 50,
        lastChange: "开局驻军",
      };
    });

    return {
      version: VERSION,
      gameCreatedAt: core.createdAt,
      lastReportTimestamp: latestTimestamp(core.reports),
      lastProcessedTurn: core.turn,
      armies,
      orders: [],
      battleReports: [],
      sieges: {},
      conquests: [],
      pendingJudgments: [],
      judgmentHistory: [],
      captives: [],
      surrenderedOfficers: [],
      log: [{ id: `army-opening-${Date.now()}`, turn: core.turn, type: "system", text: "大司马府建立军团、兵力、粮秣与行军档案。" }],
      updatedAt: new Date().toISOString(),
    };
  }

  function migrateState(current, core) {
    const migrated = {
      ...current,
      version: VERSION,
      gameCreatedAt: core.createdAt,
      armies: { ...(current.armies || {}) },
      orders: Array.isArray(current.orders) ? current.orders : [],
      battleReports: Array.isArray(current.battleReports) ? current.battleReports : [],
      sieges: current.sieges && typeof current.sieges === "object" ? current.sieges : {},
      conquests: Array.isArray(current.conquests) ? current.conquests : [],
      pendingJudgments: Array.isArray(current.pendingJudgments) ? current.pendingJudgments : [],
      judgmentHistory: Array.isArray(current.judgmentHistory) ? current.judgmentHistory : [],
      captives: Array.isArray(current.captives) ? current.captives : [],
      surrenderedOfficers: Array.isArray(current.surrenderedOfficers) ? current.surrenderedOfficers : [],
      log: Array.isArray(current.log) ? current.log : [],
      lastReportTimestamp: Number(current.lastReportTimestamp) || 0,
      lastProcessedTurn: Number.isFinite(current.lastProcessedTurn) ? current.lastProcessedTurn : core.turn,
    };

    DATA.armies.forEach(def => {
      migrated.armies[def.id] = {
        id: def.id,
        owner: def.owner,
        ownerName: def.ownerName,
        commander: def.commander,
        troops: def.troops,
        maxTroops: def.troops,
        morale: def.morale,
        supply: def.supply,
        training: def.training,
        loyalty: def.loyalty,
        fatigue: 8,
        cityId: def.cityId,
        originCityId: def.cityId,
        targetCityId: def.cityId,
        routeIds: [],
        routeIndex: 0,
        currentRouteId: null,
        task: "idle",
        status: "idle",
        orderedTurn: core.turn,
        eta: 0,
        orderAuthority: 50,
        lastChange: "资料补全",
        ...(migrated.armies[def.id] || {}),
      };
    });
    return migrated;
  }

  function processNewReports(core) {
    const reports = Array.isArray(core.reports) ? [...core.reports] : [];
    const incoming = reports
      .filter(report => (Number(report.timestamp) || 0) > (state.lastReportTimestamp || 0))
      .sort((a, b) => (Number(a.timestamp) || 0) - (Number(b.timestamp) || 0));

    incoming.filter(report => /^圣旨·/.test(report.title || "")).forEach(report => processArmyEdict(report, core));
    state.lastReportTimestamp = Math.max(state.lastReportTimestamp || 0, latestTimestamp(reports));
  }

  function processArmyEdict(report, core) {
    const text = extractEdictText(report.text || "");
    const cityIds = STRATEGY_API.detectCityTargets(text);
    const lordIds = STRATEGY_API.detectLordTargets(text);
    const orders = STRATEGY_API.detectOrders(text);
    const primaryOrder = choosePrimaryOrder(orders);
    const execution = extractExecution(report.text || "");

    if (primaryOrder === "ceasefire") {
      const owners = lordIds.length ? lordIds : uniqueOwners();
      stopArmies(owners, text, core.turn);
      return;
    }

    if (!["attack", "support", "advance", "defend", "supply"].includes(primaryOrder)) return;
    const owners = lordIds.length ? lordIds : inferCourtOwner(text);
    owners.forEach(owner => assignArmyOrder(owner, cityIds, primaryOrder, execution, text, core.turn, report.timestamp));
    trimCollections();
  }

  function assignArmyOrder(owner, cityIds, task, execution, text, turn, timestamp) {
    const army = selectArmy(owner, cityIds[0]);
    if (!army) {
      addLog(turn, "warning", `${ownerName(owner)}没有可执行诏令的完整军团。`);
      return;
    }

    const destination = cityIds.length ? cityIds[cityIds.length - 1] : army.cityId;
    const routeIds = destination !== army.cityId ? STRATEGY_API.findRoutePath(army.cityId, destination) : [];
    if (destination !== army.cityId && !routeIds.length) {
      army.lastChange = `诏令无法落实：${cityName(army.cityId)}至${cityName(destination)}没有可用军路`;
      addLog(turn, "warning", `${armyName(army)}未找到通往${cityName(destination)}的军路。`);
      return;
    }

    army.originCityId = army.cityId;
    army.targetCityId = destination;
    army.routeIds = [...routeIds];
    army.routeIndex = 0;
    army.currentRouteId = routeIds[0] || null;
    army.task = task;
    army.orderedTurn = turn;
    army.orderAuthority = execution;
    army.eta = routeIds.length;
    army.fatigue = clamp(army.fatigue + 3, 0, 100);
    army.lastChange = shortText(text, 90);

    if (!routeIds.length) {
      army.status = task === "defend" ? "defending" : task === "supply" ? "supplying" : "recovering";
    } else {
      army.status = "marching";
    }

    state.orders.unshift({
      id: `army-order-${Number(timestamp) || Date.now()}-${army.id}`,
      turn,
      armyId: army.id,
      owner,
      task,
      originCityId: army.originCityId,
      targetCityId: destination,
      routeIds: [...routeIds],
      execution,
      text: shortText(text, 120),
      status: routeIds.length ? "executing" : "arrived",
    });

    addLog(
      turn,
      task,
      `${armyName(army)}奉诏${taskLabel(task)}，${routeIds.length ? `自${cityName(army.originCityId)}向${cityName(destination)}进发，预计${routeIds.length}个月抵达` : `在${cityName(destination)}就地执行`}。`
    );
    routeIds.forEach(routeId => adjustStrategyRoute(routeId, { pressure: task === "attack" ? 3 : 1, supply: task === "supply" ? 2 : -1 }, `${armyName(army)}奉诏进入军路`));
  }

  function stopArmies(owners, text, turn) {
    let stopped = 0;
    Object.values(state.armies).forEach(army => {
      if (!owners.includes(army.owner) || ["destroyed", "idle", "recovering"].includes(army.status)) return;
      army.routeIds = [];
      army.routeIndex = 0;
      army.currentRouteId = null;
      army.targetCityId = army.cityId;
      army.task = "idle";
      army.status = "recovering";
      army.eta = 0;
      army.lastChange = `奉诏停战：${shortText(text)}`;
      stopped += 1;
    });
    addLog(turn, "ceasefire", stopped ? `${stopped}支军团奉诏停止当前军事行动。` : "停战诏令已发，但没有正在交战或行军的目标军团。");
  }

  function selectArmy(owner, preferredCityId) {
    const candidates = Object.values(state.armies).filter(army => army.owner === owner && army.status !== "destroyed" && army.troops >= 500);
    if (!candidates.length) return null;
    const preferred = candidates.filter(army => army.cityId === preferredCityId && !["marching", "routing"].includes(army.status));
    const pool = preferred.length ? preferred : candidates;
    return pool.sort((a, b) => armyReadiness(b) - armyReadiness(a))[0];
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
    const rng = seededRandom(`${state.gameCreatedAt}-${turn}-armies`);
    Object.values(state.armies).forEach(army => {
      if (army.status === "destroyed") return;
      if (["marching", "routing"].includes(army.status)) advanceArmy(army, turn, rng);
      else recoverArmy(army);
    });

    processSieges(turn, core, rng);
    resolveCityBattles(turn, core, rng);
    updateOrderStatuses();
    state.log = state.log.slice(0, MAX_LOG);
    state.battleReports = state.battleReports.slice(0, MAX_REPORTS);
  }

  function advanceArmy(army, turn, rng) {
    if (!army.routeIds.length || army.routeIndex >= army.routeIds.length) {
      arriveArmy(army, turn);
      return;
    }

    const routeId = army.routeIds[army.routeIndex];
    const routeDef = STRATEGY_DATA.routes.find(route => route.id === routeId);
    const routeState = readStrategyState()?.routes?.[routeId];
    if (!routeDef) {
      army.status = "recovering";
      army.lastChange = "军路资料缺失，停止行军";
      return;
    }

    const pressure = Number(routeState?.pressure ?? routeDef.pressure ?? 40);
    const routeSupply = Number(routeState?.supply ?? routeDef.supply ?? 55);
    const terrainCost = /栈道|山道|关道|远道/.test(routeDef.type) ? 2 : /水路/.test(routeDef.type) ? 1 : 0;
    const consumption = Math.round(4 + terrainCost + pressure / 28 + army.troops / 9000);
    army.supply = clamp(army.supply - consumption, 0, 100);
    army.fatigue = clamp(army.fatigue + 8 + terrainCost, 0, 100);
    army.morale = clamp(army.morale - (pressure >= 70 ? 4 : pressure >= 55 ? 2 : 1), 0, 100);

    if (army.supply <= 12) {
      const lost = Math.max(30, Math.round(army.troops * (0.012 + rng() * 0.01)));
      army.troops = Math.max(0, army.troops - lost);
      army.morale = clamp(army.morale - 5, 0, 100);
      army.lastChange = `粮秣枯竭，停滞于${routeDef.name}并损失${lost}人`;
      addLog(turn, "warning", `${armyName(army)}在${routeDef.name}因缺粮停滞，非战斗减员${lost}人。`);
      adjustStrategyRoute(routeId, { supply: -3, pressure: 2 }, `${armyName(army)}缺粮滞留`);
      checkDestroyed(army, turn);
      return;
    }

    if (pressure >= 72 || routeSupply <= 25) {
      const attritionRate = pressure >= 82 ? 0.018 : 0.009;
      const lost = Math.max(0, Math.round(army.troops * attritionRate * (0.65 + rng() * 0.7)));
      army.troops = Math.max(0, army.troops - lost);
      if (lost) addLog(turn, "warning", `${armyName(army)}通过${routeDef.name}时受袭与掉队，损失${lost}人。`);
    }

    const nextCity = nextCityForRoute(army.cityId, routeDef);
    if (!nextCity) {
      army.status = "recovering";
      army.lastChange = `行军序列与${routeDef.name}不衔接，已停止`;
      addLog(turn, "warning", `${armyName(army)}行军序列异常，停在${cityName(army.cityId)}。`);
      return;
    }

    army.cityId = nextCity;
    army.routeIndex += 1;
    army.currentRouteId = army.routeIds[army.routeIndex] || null;
    army.eta = Math.max(0, army.routeIds.length - army.routeIndex);
    army.lastChange = `通过${routeDef.name}，抵达${cityName(nextCity)}`;
    adjustStrategyRoute(routeId, { supply: army.task === "supply" ? 1 : -1, pressure: army.task === "attack" ? 3 : 1 }, `${armyName(army)}通过`);

    if (army.routeIndex >= army.routeIds.length || army.cityId === army.targetCityId) arriveArmy(army, turn);
    checkDestroyed(army, turn);
  }

  function arriveArmy(army, turn) {
    army.cityId = army.targetCityId || army.cityId;
    army.currentRouteId = null;
    army.eta = 0;
    if (army.status === "routing" || army.task === "retreat") {
      army.status = "recovering";
      army.task = "idle";
      army.lastChange = `退至${cityName(army.cityId)}休整`;
    } else if (army.task === "defend" || army.task === "support" || army.task === "advance") {
      army.status = "defending";
      army.lastChange = `抵达${cityName(army.cityId)}并展开守备`;
    } else if (army.task === "supply") {
      army.status = "supplying";
      army.lastChange = `抵达${cityName(army.cityId)}交付粮秣`;
      army.supply = clamp(army.supply + 8, 0, 100);
      adjustStrategyCity(army.cityId, { supply: 6, pressure: -2 }, `${armyName(army)}完成转运`);
    } else if (army.task === "attack") {
      army.status = "engaged";
      army.lastChange = `抵达${cityName(army.cityId)}并在城外列阵`;
    } else {
      army.status = "recovering";
    }
    addLog(turn, army.task, `${armyName(army)}抵达${cityName(army.cityId)}。`);
  }

  function recoverArmy(army) {
    const supplyGain = army.status === "supplying" ? 4 : army.status === "defending" ? 2 : 3;
    army.supply = clamp(army.supply + supplyGain, 0, 100);
    army.morale = clamp(army.morale + (army.fatigue > 60 ? 1 : 2), 0, 100);
    army.fatigue = clamp(army.fatigue - 8, 0, 100);
    if (army.status === "recovering" && army.fatigue <= 24) army.status = "idle";
  }

  function resolveCityBattles(turn, core, rng) {
    const byCity = new Map();
    Object.values(state.armies)
      .filter(army => army.status !== "destroyed" && army.troops >= 500)
      .forEach(army => {
        if (!byCity.has(army.cityId)) byCity.set(army.cityId, []);
        byCity.get(army.cityId).push(army);
      });

    byCity.forEach((armies, cityId) => {
      const pair = findHostilePair(armies, cityId);
      if (!pair) return;
      const [attacker, defender] = pair;
      resolveBattle(attacker, defender, cityId, turn, core, rng);
    });
  }

  function findHostilePair(armies, cityId) {
    const attackers = armies.filter(army => army.task === "attack" && army.targetCityId === cityId);
    for (const attacker of attackers.sort((a, b) => armyReadiness(b) - armyReadiness(a))) {
      const defender = armies
        .filter(army => army.owner !== attacker.owner && areHostile(attacker.owner, army.owner))
        .sort((a, b) => armyReadiness(b) - armyReadiness(a))[0];
      if (defender) return [attacker, defender];
    }
    return null;
  }

  function areHostile(ownerA, ownerB) {
    if (ownerA === ownerB) return false;
    if ([ownerA, ownerB].includes("court") && [ownerA, ownerB].includes("cao_cao")) return false;
    return true;
  }

  function resolveBattle(attacker, defender, cityId, turn, core, rng) {
    const strategy = readStrategyState();
    const cityDefense = Number(strategy?.cities?.[cityId]?.defense ?? 55);
    const attackRoll = 0.9 + rng() * 0.2;
    const defendRoll = 0.9 + rng() * 0.2;
    const attackPower = calculateCombatPower(attacker, commanderDef(attacker.commander), 0, false, attackRoll);
    const defendPower = calculateCombatPower(defender, commanderDef(defender.commander), cityDefense, true, defendRoll);
    const total = Math.max(1, attackPower + defendPower);
    const attackerLossRate = clamp(0.1 + defendPower / total * 0.34 + rng() * 0.05, 0.09, 0.43);
    const defenderLossRate = clamp(0.1 + attackPower / total * 0.35 + rng() * 0.05, 0.09, 0.44);
    const attackerLosses = Math.min(attacker.troops, Math.max(80, Math.round(attacker.troops * attackerLossRate)));
    const defenderLosses = Math.min(defender.troops, Math.max(80, Math.round(defender.troops * defenderLossRate)));

    attacker.troops -= attackerLosses;
    defender.troops -= defenderLosses;
    attacker.supply = clamp(attacker.supply - 8, 0, 100);
    defender.supply = clamp(defender.supply - 6, 0, 100);
    attacker.fatigue = clamp(attacker.fatigue + 18, 0, 100);
    defender.fatigue = clamp(defender.fatigue + 16, 0, 100);

    const ratio = attackPower / Math.max(1, defendPower);
    let result;
    let victor;
    if (ratio >= 1.18) {
      result = ratio >= 1.55 ? "进攻方大胜" : "进攻方小胜";
      victor = attacker.owner;
      attacker.morale = clamp(attacker.morale + 5, 0, 100);
      attacker.status = "engaged";
      defender.morale = clamp(defender.morale - 12, 0, 100);
      orderRetreat(defender, cityId, turn);
    } else if (ratio <= 0.85) {
      result = ratio <= 0.62 ? "守军大胜" : "守军击退进攻";
      victor = defender.owner;
      defender.morale = clamp(defender.morale + 5, 0, 100);
      defender.status = "defending";
      attacker.morale = clamp(attacker.morale - 12, 0, 100);
      orderRetreat(attacker, cityId, turn);
    } else {
      result = "双方相持";
      victor = null;
      attacker.morale = clamp(attacker.morale - 5, 0, 100);
      defender.morale = clamp(defender.morale - 4, 0, 100);
      attacker.status = "recovering";
      defender.status = "recovering";
    }

    checkDestroyed(attacker, turn);
    checkDestroyed(defender, turn);
    const report = {
      id: `battle-${turn}-${cityId}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      turn,
      date: formatTurnDate(core, turn),
      cityId,
      title: `${cityName(cityId)}之战`,
      attackerId: attacker.id,
      defenderId: defender.id,
      attackerOwner: attacker.owner,
      defenderOwner: defender.owner,
      attackerName: armyName(attacker),
      defenderName: armyName(defender),
      attackerCommander: commanderName(attacker.commander),
      defenderCommander: commanderName(defender.commander),
      attackerLosses,
      defenderLosses,
      attackerRemaining: attacker.troops,
      defenderRemaining: defender.troops,
      result,
      victor,
      cityControlChanged: false,
      note: victor === attacker.owner ? "进攻军已经兵临城下，将进入围城结算。" : victor === defender.owner ? "守军维持城池控制，败军沿原路撤退。" : "双方暂时脱离接触，等待下月整补。",
    };
    state.battleReports.unshift(report);
    addLog(turn, "battle", `${report.title}：${result}；${report.attackerName}损失${attackerLosses}，${report.defenderName}损失${defenderLosses}。`);
    adjustStrategyCity(cityId, { defense: -Math.round((attackerLosses + defenderLosses) / 2200), supply: -5, pressure: 14 }, report.title);
    const battleRoute = attacker.routeIds[Math.max(0, attacker.routeIndex - 1)] || defender.routeIds[Math.max(0, defender.routeIndex - 1)];
    if (battleRoute) adjustStrategyRoute(battleRoute, { supply: -4, pressure: 10 }, report.title);
    if (victor === attacker.owner && attacker.status !== "destroyed") beginSiege(attacker, defender, cityId, turn, report);
    document.dispatchEvent(new CustomEvent("xian:battle-report", { detail: report }));
  }

  function beginSiege(attacker, defender, cityId, turn, report) {
    const strategy = readStrategyState();
    const city = strategy?.cities?.[cityId];
    if (!city || city.controller === attacker.owner) {
      attacker.status = "defending";
      attacker.task = "defend";
      return null;
    }
    const existing = state.sieges[cityId];
    if (existing?.status === "active") {
      existing.attackerArmyId = attacker.id;
      existing.attackerOwner = attacker.owner;
      existing.lastChange = `${armyName(attacker)}接替围城阵地`;
      return existing;
    }
    const siege = {
      id: `siege-${cityId}-${turn}-${Date.now()}`,
      cityId,
      attackerArmyId: attacker.id,
      attackerOwner: attacker.owner,
      defenderOwner: city.controller,
      defenderCommander: defender?.commander || null,
      stance: "blockade",
      progress: 6,
      walls: clamp(city.defense, 10, 100),
      citySupply: clamp(city.supply, 0, 100),
      garrison: Math.max(900, Math.round((city.defense * 72) + (defender?.troops || 0) * 0.18)),
      startedTurn: turn,
      lastResolvedTurn: turn,
      status: "active",
      lastChange: "野战得胜，进攻军开始围城",
    };
    state.sieges[cityId] = siege;
    attacker.status = "besieging";
    attacker.task = "siege";
    attacker.targetCityId = cityId;
    report.siegeId = siege.id;
    addLog(turn, "siege", `${armyName(attacker)}包围${cityName(cityId)}，城内尚有守军与粮秣。`);
    return siege;
  }

  function processSieges(turn, core, rng) {
    Object.values(state.sieges || {}).forEach(siege => {
      if (!siege || siege.status !== "active" || siege.lastResolvedTurn >= turn) return;
      const army = state.armies[siege.attackerArmyId];
      const strategy = readStrategyState();
      const city = strategy?.cities?.[siege.cityId];
      if (!army || army.status === "destroyed" || army.cityId !== siege.cityId || !city) {
        siege.status = "lifted";
        siege.lastChange = "围城军已经撤离，城围解除";
        addLog(turn, "retreat", `${cityName(siege.cityId)}之围已经解除。`);
        return;
      }
      const outcome = calculateSiegeTurn(siege, army, city, core, rng());
      siege.progress = clamp(siege.progress + outcome.progress, 0, 100);
      siege.walls = clamp(siege.walls - outcome.wallLoss, 0, 100);
      siege.citySupply = clamp(siege.citySupply - outcome.supplyLoss, 0, 100);
      siege.garrison = Math.max(0, siege.garrison - outcome.garrisonLoss);
      siege.lastResolvedTurn = turn;
      siege.lastChange = outcome.summary;
      army.troops = Math.max(0, army.troops - outcome.attackerLoss);
      army.supply = clamp(army.supply - outcome.attackerSupply, 0, 100);
      army.fatigue = clamp(army.fatigue + outcome.fatigue, 0, 100);
      adjustStrategyCity(siege.cityId, {
        defense: -outcome.wallLoss,
        supply: -outcome.supplyLoss,
        pressure: 3,
      }, outcome.summary);
      checkDestroyed(army, turn);
      if (army.status === "destroyed") {
        siege.status = "lifted";
        siege.lastChange = "围城军伤亡过重，攻势瓦解";
        return;
      }
      const surrendered = siege.citySupply <= 0 || siege.garrison < 500;
      if (siege.progress >= 100 || siege.walls <= 0 || surrendered) {
        captureCity(siege, army, turn, surrendered ? "守军粮尽请降" : siege.walls <= 0 ? "城防被突破" : "围城进度完成");
      }
    });
  }

  function calculateSiegeTurn(siege, army, city, core, roll = 0.5) {
    const stance = ["assault", "blockade", "persuade"].includes(siege?.stance) ? siege.stance : "blockade";
    const armyStrength = Math.max(0.6, (Number(army?.troops) || 0) / 6200)
      * (0.65 + clamp(army?.morale, 0, 100) / 180)
      * (0.62 + clamp(army?.supply, 0, 100) / 190);
    const defense = clamp(siege?.walls ?? city?.defense, 0, 100);
    const prestige = clamp(core?.stats?.prestige, 0, 100);
    const loyalty = clamp(city?.courtLoyalty, 0, 100);
    if (stance === "assault") {
      return {
        progress: Math.max(7, Math.round(14 + armyStrength * 8 + roll * 7 - defense * 0.07)),
        wallLoss: Math.max(4, Math.round(5 + armyStrength * 3 + roll * 3)),
        supplyLoss: Math.max(3, Math.round(4 + roll * 3)),
        garrisonLoss: Math.max(120, Math.round(180 + armyStrength * 150 + roll * 120)),
        attackerLoss: Math.max(90, Math.round((Number(army?.troops) || 0) * (0.012 + defense / 6200))),
        attackerSupply: 8,
        fatigue: 12,
        summary: "强攻城垣，进展最快但攻城军伤亡明显",
      };
    }
    if (stance === "persuade") {
      const authority = clamp(army?.orderAuthority, 0, 100);
      return {
        progress: Math.max(5, Math.round(5 + prestige * 0.08 + loyalty * 0.07 + authority * 0.04 + roll * 4)),
        wallLoss: 0,
        supplyLoss: Math.max(2, Math.round(2 + roll * 2)),
        garrisonLoss: Math.max(25, Math.round(30 + roll * 45)),
        attackerLoss: Math.max(10, Math.round((Number(army?.troops) || 0) * 0.0015)),
        attackerSupply: 3,
        fatigue: 3,
        summary: "宣示朝廷名分并劝降守军，伤亡较低",
      };
    }
    return {
      progress: Math.max(6, Math.round(9 + armyStrength * 4 + roll * 5 - defense * 0.035)),
      wallLoss: Math.max(1, Math.round(1 + roll * 2)),
      supplyLoss: Math.max(7, Math.round(8 + armyStrength * 2 + roll * 3)),
      garrisonLoss: Math.max(55, Math.round(70 + armyStrength * 65 + roll * 60)),
      attackerLoss: Math.max(25, Math.round((Number(army?.troops) || 0) * 0.004)),
      attackerSupply: 5,
      fatigue: 6,
      summary: "封锁城门与粮道，稳步消耗城内守备",
    };
  }

  function captureCity(siege, army, turn, reason) {
    const strategy = readStrategyState();
    const city = strategy?.cities?.[siege.cityId];
    if (!city) return;
    const previousOwner = city.controller;
    city.controller = army.owner;
    city.controllerName = ownerName(army.owner);
    city.defense = clamp(Math.max(18, siege.walls), 0, 100);
    city.supply = clamp(Math.max(12, siege.citySupply), 0, 100);
    city.pressure = clamp(city.pressure - 20, 0, 100);
    city.courtLoyalty = clamp(city.courtLoyalty + (siege.stance === "persuade" ? 8 : siege.stance === "assault" ? -6 : 2), 0, 100);
    city.lastChange = `${ownerName(army.owner)}攻取城池：${reason}`;
    strategy.log = Array.isArray(strategy.log) ? strategy.log : [];
    strategy.log.unshift({ id: `capture-${siege.id}`, turn, type: "attack", text: `${cityName(siege.cityId)}由${ownerName(previousOwner)}转归${ownerName(army.owner)}。` });
    strategy.updatedAt = new Date().toISOString();
    localStorage.setItem(STRATEGY_KEY, JSON.stringify(strategy));
    strategyDirty = true;
    siege.status = "captured";
    siege.capturedTurn = turn;
    siege.previousOwner = previousOwner;
    siege.lastChange = `${reason}，${ownerName(army.owner)}取得控制权`;
    army.status = "defending";
    army.task = "defend";
    army.lastChange = `攻取${cityName(siege.cityId)}后整顿城防`;
    state.conquests.unshift({
      id: `conquest-${siege.id}`,
      cityId: siege.cityId,
      turn,
      previousOwner,
      newOwner: army.owner,
      stance: siege.stance,
      reason,
    });
    state.conquests = state.conquests.slice(0, 30);
    createPostwarJudgment(siege, army, previousOwner, turn);
    addLog(turn, "capture", `${cityName(siege.cityId)}城破，控制权由${ownerName(previousOwner)}转归${ownerName(army.owner)}。`);
    document.dispatchEvent(new CustomEvent("xian:city-captured", { detail: state.conquests[0] }));
  }

  function setSiegeStance(cityId, stance) {
    const siege = state?.sieges?.[cityId];
    if (!siege || siege.status !== "active" || !["assault", "blockade", "persuade"].includes(stance)) return false;
    siege.stance = stance;
    siege.lastChange = `围城方略改为${siegeStanceLabel(stance)}`;
    saveState();
    renderAll();
    return true;
  }

  function createPostwarJudgment(siege, army, previousOwner, turn) {
    if (state.pendingJudgments.some(item => item.conquestId === `conquest-${siege.id}`)) return;
    const commanderId = siege.defenderCommander;
    const commander = commanderDef(commanderId);
    const captureChance = siege.stance === "persuade" ? 0.82 : siege.stance === "blockade" ? 0.62 : 0.38;
    const captured = Boolean(commanderId && seededRandom(`${siege.id}-captive`)() <= captureChance);
    let captiveId = null;
    if (captured) {
      captiveId = `captive-${siege.id}-${commanderId}`;
      state.captives.unshift({
        id: captiveId,
        commanderId,
        name: commander?.name || commanderId,
        formerOwner: previousOwner,
        cityId: siege.cityId,
        capturedTurn: turn,
        status: "awaiting",
        lastChange: "城破后被押送御前候旨",
      });
    }
    state.pendingJudgments.unshift({
      id: `judgment-${siege.id}`,
      conquestId: `conquest-${siege.id}`,
      cityId: siege.cityId,
      previousOwner,
      newOwner: army.owner,
      attackerArmyId: army.id,
      captiveId,
      stance: siege.stance,
      turn,
      status: "pending",
    });
    addLog(turn, "judgment", `${cityName(siege.cityId)}战后处置待天子裁决${captured ? `，俘将${commander?.name || commanderId}一并候旨` : ""}。`);
  }

  function getJudgmentDecision(decision, judgment, core = coreState) {
    const city = readStrategyState()?.cities?.[judgment?.cityId] || {};
    const captive = state?.captives?.find(item => item.id === judgment?.captiveId);
    const prestige = clamp(core?.stats?.prestige, 0, 100);
    const recruitChance = clamp(Math.round(30 + prestige * 0.35 + clamp(city.courtLoyalty, 0, 100) * 0.25 + (judgment?.stance === "persuade" ? 12 : 0)), 25, 88);
    const choices = {
      pacify: {
        label: "赦降安民",
        effects: { prestige: 3, officials: 2 },
        hidden: { peopleStability: 5 },
        city: { defense: 2, supply: 4, courtLoyalty: 12, pressure: -10 },
        captiveStatus: captive ? "released" : null,
        text: "保全降卒与百姓，旧将释归，地方向心明显恢复。",
      },
      appoint: {
        label: "汉官接掌",
        effects: { authority: 5, treasury: -6, caoAlert: 6 },
        hidden: { loyalNetwork: 4 },
        city: { defense: 4, supply: -2, courtLoyalty: 9, pressure: -4, controller: "court" },
        captiveStatus: captive ? "detained" : null,
        text: "绕过功臣而由朝廷直接任官，皇权上升，也会引起实力派警觉。",
      },
      reward: {
        label: "论功行赏",
        effects: { treasury: -5, officials: 2, caoAlert: -2 },
        hidden: { externalBalance: 3 },
        city: { defense: 8, supply: 3, courtLoyalty: 2, pressure: -8 },
        captiveStatus: captive ? "released" : null,
        trust: 8,
        text: "承认攻城方继续治理，军心与盟友信任提高。",
      },
      recruit: {
        label: "纳降任用",
        effects: { authority: 2, prestige: 2, caoAlert: 3 },
        hidden: { loyalNetwork: 3, leakRisk: 2 },
        city: { defense: 3, supply: 2, courtLoyalty: 7, pressure: -6 },
        captiveStatus: captive ? "recruit-check" : null,
        recruitChance,
        text: captive ? `尝试以汉室名分招纳${captive.name}，预计成功率 ${recruitChance}%。` : "收编降官与守军骨干，为朝廷补充可用之人。",
      },
    };
    return choices[decision] || null;
  }

  function resolvePostwarJudgment(judgmentId, decision) {
    const judgment = state?.pendingJudgments?.find(item => item.id === judgmentId && item.status === "pending");
    if (!judgment) return false;
    const result = getJudgmentDecision(decision, judgment, coreState);
    if (!result) return false;
    const strategy = readStrategyState();
    const city = strategy?.cities?.[judgment.cityId];
    if (!city) return false;
    const captive = state.captives.find(item => item.id === judgment.captiveId);
    Object.entries(result.city || {}).forEach(([key, value]) => {
      if (key === "controller") {
        city.controller = value;
        city.controllerName = ownerName(value);
      } else {
        city[key] = clamp(Number(city[key] || 0) + Number(value || 0), 0, 100);
      }
    });
    if (result.trust && strategy.strategies?.[judgment.newOwner]) {
      strategy.strategies[judgment.newOwner].trust = clamp(strategy.strategies[judgment.newOwner].trust + result.trust, 0, 100);
      strategy.strategies[judgment.newOwner].lastChange = `${cityName(judgment.cityId)}战后论功行赏`;
    }
    let recruitSucceeded = false;
    if (captive) {
      if (result.captiveStatus === "recruit-check") {
        recruitSucceeded = seededRandom(`${judgment.id}-recruit`)() * 100 <= result.recruitChance;
        captive.status = recruitSucceeded ? "recruited" : "detained";
        captive.lastChange = recruitSucceeded ? "奉诏归降，列入汉廷可用将领" : "拒绝归降，继续留置候议";
        if (recruitSucceeded) state.surrenderedOfficers.unshift({ commanderId: captive.commanderId, name: captive.name, joinedTurn: judgment.turn, sourceCityId: judgment.cityId });
      } else if (result.captiveStatus) {
        captive.status = result.captiveStatus;
        captive.lastChange = result.captiveStatus === "released" ? "奉诏获释" : "留置朝廷看管";
      }
    } else if (decision === "recruit") {
      state.surrenderedOfficers.unshift({ commanderId: `garrison-${judgment.cityId}-${judgment.turn}`, name: `${cityName(judgment.cityId)}降官`, joinedTurn: judgment.turn, sourceCityId: judgment.cityId });
      recruitSucceeded = true;
    }
    city.lastChange = `${result.label}：${result.text}${decision === "recruit" && captive ? (recruitSucceeded ? " 招降成功。" : " 对方暂未归顺。") : ""}`;
    strategy.log = Array.isArray(strategy.log) ? strategy.log : [];
    strategy.log.unshift({ id: `judgment-result-${judgment.id}`, turn: judgment.turn, type: "diplomacy", text: `${cityName(judgment.cityId)}战后裁决：${result.label}。` });
    strategy.updatedAt = new Date().toISOString();
    localStorage.setItem(STRATEGY_KEY, JSON.stringify(strategy));
    strategyDirty = true;
    judgment.status = "resolved";
    judgment.decision = decision;
    judgment.decisionLabel = result.label;
    judgment.resolvedAt = new Date().toISOString();
    judgment.recruitSucceeded = recruitSucceeded;
    state.pendingJudgments = state.pendingJudgments.filter(item => item.status === "pending");
    state.judgmentHistory.unshift(judgment);
    state.judgmentHistory = state.judgmentHistory.slice(0, 30);
    state.surrenderedOfficers = state.surrenderedOfficers.slice(0, 24);
    addLog(coreState?.turn || judgment.turn, "judgment", `${cityName(judgment.cityId)}战后裁决为“${result.label}”。`);
    saveState();
    window.XianEmperorGame?.applyExternalPackage({
      effects: result.effects,
      hidden: result.hidden,
      report: { title: `战后裁决·${cityName(judgment.cityId)}`, text: `${result.label}：${result.text}`, type: "decision" },
      chronicle: `${cityName(judgment.cityId)}既定，朝廷诏以${result.label}处置战后诸事。`,
    });
    renderAll();
    return true;
  }

  function orderRetreat(army, cityId, turn) {
    if (army.status === "destroyed") return;
    const destination = army.originCityId && army.originCityId !== cityId
      ? army.originCityId
      : ownerSeatCity(army.owner) !== cityId
        ? ownerSeatCity(army.owner)
        : adjacentRetreatCity(cityId);
    const routeIds = destination ? STRATEGY_API.findRoutePath(cityId, destination) : [];
    if (!destination || !routeIds.length) {
      army.status = "recovering";
      army.task = "idle";
      army.lastChange = `败退后困于${cityName(cityId)}`;
      return;
    }
    army.originCityId = cityId;
    army.targetCityId = destination;
    army.routeIds = routeIds;
    army.routeIndex = 0;
    army.currentRouteId = routeIds[0];
    army.task = "retreat";
    army.status = "routing";
    army.eta = routeIds.length;
    army.lastChange = `战败后向${cityName(destination)}撤退`;
    addLog(turn, "retreat", `${armyName(army)}脱离战场，向${cityName(destination)}撤退。`);
  }

  function adjacentRetreatCity(cityId) {
    const route = STRATEGY_DATA.routes.find(item => item.from === cityId || item.to === cityId);
    if (!route) return null;
    return route.from === cityId ? route.to : route.from;
  }

  function checkDestroyed(army, turn) {
    if (army.troops >= 500) return false;
    army.troops = Math.max(0, army.troops);
    army.status = "destroyed";
    army.task = "idle";
    army.routeIds = [];
    army.currentRouteId = null;
    army.eta = 0;
    army.lastChange = "军团建制已经溃散";
    addLog(turn, "warning", `${armyName(army)}余部不足五百，建制溃散。`);
    return true;
  }

  function calculateCombatPower(army, commander, cityDefense = 0, defending = false, roll = 1) {
    const troopFactor = Math.max(0, Number(army?.troops || 0));
    const trainingFactor = 0.58 + clamp(army?.training, 0, 100) / 190;
    const moraleFactor = 0.56 + clamp(army?.morale, 0, 100) / 210;
    const supplyFactor = 0.52 + clamp(army?.supply, 0, 100) / 205;
    const fatigueFactor = 1 - clamp(army?.fatigue, 0, 100) / 240;
    const commandFactor = 0.68 + clamp(commander?.command || 55, 0, 100) / 240;
    const defenseFactor = defending ? 1 + clamp(cityDefense, 0, 100) / 260 : 1;
    return troopFactor * trainingFactor * moraleFactor * supplyFactor * fatigueFactor * commandFactor * defenseFactor * clamp(roll, 0.75, 1.25);
  }

  function armyReadiness(army) {
    return army.troops * (0.4 + army.morale / 200) * (0.45 + army.supply / 200) * (0.5 + army.training / 220);
  }

  function updateOrderStatuses() {
    state.orders.forEach(order => {
      const army = state.armies[order.armyId];
      if (!army || army.status === "destroyed") order.status = "failed";
      else if (["marching", "routing"].includes(army.status)) order.status = "executing";
      else if (army.cityId === order.targetCityId) order.status = "arrived";
    });
  }

  function adjustStrategyRoute(routeId, delta, note) {
    const strategy = readStrategyState();
    const route = strategy?.routes?.[routeId];
    if (!route) return;
    route.supply = clamp(route.supply + Number(delta.supply || 0), 0, 100);
    route.pressure = clamp(route.pressure + Number(delta.pressure || 0), 0, 100);
    route.status = routeStatus(route.supply, route.pressure);
    route.lastChange = note;
    strategy.updatedAt = new Date().toISOString();
    localStorage.setItem(STRATEGY_KEY, JSON.stringify(strategy));
    strategyDirty = true;
  }

  function adjustStrategyCity(cityId, delta, note) {
    const strategy = readStrategyState();
    const city = strategy?.cities?.[cityId];
    if (!city) return;
    city.defense = clamp(city.defense + Number(delta.defense || 0), 0, 100);
    city.supply = clamp(city.supply + Number(delta.supply || 0), 0, 100);
    city.pressure = clamp(city.pressure + Number(delta.pressure || 0), 0, 100);
    city.courtLoyalty = clamp(city.courtLoyalty + Number(delta.courtLoyalty || 0), 0, 100);
    city.lastChange = note;
    strategy.log = Array.isArray(strategy.log) ? strategy.log : [];
    strategy.log.unshift({ id: `army-strategy-${Date.now()}-${cityId}`, turn: state.lastProcessedTurn, type: "warning", text: `${cityName(cityId)}：${note}。` });
    strategy.updatedAt = new Date().toISOString();
    localStorage.setItem(STRATEGY_KEY, JSON.stringify(strategy));
    strategyDirty = true;
  }

  function readStrategyState() {
    return safeParse(localStorage.getItem(STRATEGY_KEY));
  }

  function signalStrategyRefresh(rawCore) {
    if (!rawCore) return;
    window.__xianArmyRefreshOnly = true;
    window.__xianStrategyRefreshOnly = true;
    try { localStorage.setItem(CORE_KEY, rawCore); }
    finally {
      window.__xianArmyRefreshOnly = false;
      window.__xianStrategyRefreshOnly = false;
    }
  }

  function extractEdictText(text) {
    const match = String(text || "").match(/“([^”]+)”/);
    return (match?.[1] || text || "").trim();
  }

  function extractExecution(text) {
    const match = String(text || "").match(/[（(](\d{1,3})%[）)]/);
    return clamp(Number(match?.[1]) || 58, 20, 100);
  }

  function choosePrimaryOrder(orders) {
    return ["attack", "support", "advance", "defend", "supply", "ceasefire", "trade"].find(order => orders.includes(order)) || "administration";
  }

  function inferCourtOwner(text) {
    return /(禁军|宿卫|汉廷|朝廷|御营|董承)/.test(text) ? ["court"] : [];
  }

  function uniqueOwners() {
    return [...new Set(Object.values(state.armies).map(army => army.owner))];
  }

  function nextCityForRoute(currentCityId, route) {
    if (route.from === currentCityId) return route.to;
    if (route.to === currentCityId) return route.from;
    return null;
  }

  function ownerSeatCity(owner) {
    if (owner === "court" || owner === "cao_cao") return "xudu";
    return STRATEGY_DATA.lords.find(lord => lord.id === owner)?.seatCity || null;
  }

  function commanderDef(id) { return DATA.commanders.find(commander => commander.id === id); }
  function commanderName(id) { return commanderDef(id)?.name || id; }
  function armyDef(id) { return DATA.armies.find(army => army.id === id); }
  function armyName(army) { return armyDef(army.id)?.name || army.id; }
  function cityName(id) { return STRATEGY_DATA.cities.find(city => city.id === id)?.name || id || "未知"; }
  function routeName(id) { return STRATEGY_DATA.routes.find(route => route.id === id)?.name || id; }
  function ownerName(id) { return id === "court" ? "汉廷" : STRATEGY_DATA.lords.find(lord => lord.id === id)?.name || DATA.armies.find(army => army.owner === id)?.ownerName || id; }
  function taskLabel(id) { return DATA.taskLabels[id] || id; }
  function statusLabel(id) { return DATA.statusLabels[id] || (id === "engaged" ? "城下列阵" : id); }

  function latestTimestamp(reports) {
    if (!Array.isArray(reports) || !reports.length) return 0;
    return Math.max(0, ...reports.map(report => Number(report.timestamp) || 0));
  }

  function routeStatus(supply, pressure) {
    if (supply <= 22) return "补给阻断";
    if (pressure >= 78) return "战线激烈";
    if (pressure >= 58) return "争夺中";
    if (supply >= 72 && pressure <= 42) return "畅通";
    return "可通行";
  }

  function formatTurnDate(core, turn) {
    if (!core) return `第${turn}月`;
    const offset = Math.max(0, core.turn - turn);
    let year = Number(core.year || 196);
    let month = Number(core.month || 10) - offset;
    while (month <= 0) { month += 12; year -= 1; }
    return `${year}年${month}月`;
  }

  function addLog(turn, type, text) {
    state.log.unshift({ id: `army-log-${Date.now()}-${Math.random().toString(16).slice(2)}`, turn, type, text });
  }

  function trimCollections() {
    state.orders = state.orders.slice(0, MAX_ORDERS);
    state.battleReports = state.battleReports.slice(0, MAX_REPORTS);
    state.log = state.log.slice(0, MAX_LOG);
  }

  function seededRandom(seed) {
    let hash = 2166136261;
    for (let index = 0; index < seed.length; index += 1) { hash ^= seed.charCodeAt(index); hash = Math.imul(hash, 16777619); }
    return () => { hash += 0x6d2b79f5; let value = hash; value = Math.imul(value ^ (value >>> 15), value | 1); value ^= value + Math.imul(value ^ (value >>> 7), value | 61); return ((value ^ (value >>> 14)) >>> 0) / 4294967296; };
  }

  function safeParse(raw) { try { return raw ? JSON.parse(raw) : null; } catch (_) { return null; } }
  function clamp(value, min, max) { return Math.min(max, Math.max(min, Number(value) || 0)); }
  function shortText(text, limit = 70) { const value = String(text || "").replace(/\s+/g, " ").trim(); return value.length > limit ? `${value.slice(0, limit)}……` : value; }
  function escapeHtml(value) { return String(value ?? "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char])); }

  function installNavButton() {
    const nav = document.querySelector(".utility-nav");
    if (!nav || document.getElementById("army-system-btn")) return;
    const button = document.createElement("button");
    button.id = "army-system-btn";
    button.type = "button";
    button.textContent = "军团";
    button.addEventListener("click", openOverlay);
    nav.insertBefore(button, document.getElementById("reset-btn") || null);
  }

  function installBrief() {
    if (document.getElementById("army-system-brief")) return;
    const section = document.createElement("section");
    section.id = "army-system-brief";
    section.className = "army-system-brief panel";
    section.innerHTML = `<div class="army-brief-head"><div><span class="section-kicker">军团推演</span><h2>军团·行军·战报</h2></div><button id="army-brief-open" class="text-button" type="button">展开军团</button></div><div id="army-brief-content" class="army-brief-content"></div>`;
    const strategyBrief = document.getElementById("strategy-network-brief");
    const worldBrief = document.getElementById("world-brief");
    const stats = document.getElementById("stats-grid");
    if (strategyBrief) strategyBrief.insertAdjacentElement("afterend", section);
    else if (worldBrief) worldBrief.insertAdjacentElement("afterend", section);
    else stats?.insertAdjacentElement("afterend", section);
    section.querySelector("#army-brief-open")?.addEventListener("click", openOverlay);
  }

  function installOverlay() {
    if (document.getElementById("army-system-overlay")) return;
    const overlay = document.createElement("div");
    overlay.id = "army-system-overlay";
    overlay.className = "army-system-overlay hidden";
    overlay.innerHTML = `<section class="army-system-window" role="dialog" aria-modal="true" aria-labelledby="army-system-title"><header><div><span class="section-kicker">大司马府军籍</span><h2 id="army-system-title">军团、围城与战后裁决</h2><p id="army-system-date">尚未载入本局</p></div><button id="army-system-close" type="button" aria-label="关闭">×</button></header><nav class="army-system-tabs"><button type="button" data-army-tab="armies">军团</button><button type="button" data-army-tab="movements">行军命令</button><button type="button" data-army-tab="sieges">围城</button><button type="button" data-army-tab="judgments">战后裁决</button><button type="button" data-army-tab="battles">战报</button></nav><div id="army-system-content"></div></section>`;
    document.body.appendChild(overlay);
    overlay.querySelector("#army-system-close")?.addEventListener("click", closeOverlay);
    overlay.addEventListener("click", event => { if (event.target === overlay) closeOverlay(); });
    overlay.querySelectorAll("[data-army-tab]").forEach(button => button.addEventListener("click", () => { activeTab = button.dataset.armyTab; renderOverlay(); }));
    document.addEventListener("keydown", event => { if (event.key === "Escape" && !overlay.classList.contains("hidden")) closeOverlay(); });
  }

  function openOverlay() {
    document.getElementById("army-system-overlay")?.classList.remove("hidden");
    document.body.classList.add("army-system-open");
    renderOverlay();
  }

  function closeOverlay() {
    document.getElementById("army-system-overlay")?.classList.add("hidden");
    document.body.classList.remove("army-system-open");
  }

  function renderAll() {
    renderBrief();
    if (!document.getElementById("army-system-overlay")?.classList.contains("hidden")) renderOverlay();
  }

  function renderBrief() {
    const content = document.getElementById("army-brief-content");
    if (!content) return;
    if (!state) { content.innerHTML = '<p class="empty-state">开启新局后建立军团与战役档案。</p>'; return; }
    const active = Object.values(state.armies).filter(army => ["marching", "routing", "engaged"].includes(army.status));
    const troops = Object.values(state.armies).filter(army => army.status !== "destroyed").reduce((sum, army) => sum + army.troops, 0);
    const lowSupply = Object.values(state.armies).filter(army => army.status !== "destroyed" && army.supply <= 25).length;
    const latest = state.battleReports[0];
    content.innerHTML = `<button type="button" data-army-brief-tab="armies"><span>天下军力</span><strong>${formatNumber(troops)} 人</strong><small>${Object.values(state.armies).filter(army => army.status !== "destroyed").length} 支完整军团</small></button><button type="button" data-army-brief-tab="movements"><span>正在行动</span><strong>${active.length} 支军团</strong><small>${lowSupply ? `${lowSupply} 支粮秣告急` : "当前无军团缺粮"}</small></button><button type="button" data-army-brief-tab="battles"><span>最近战报</span><strong>${escapeHtml(latest?.title || "尚无战事")}</strong><small>${escapeHtml(latest?.result || "等待军事接触")}</small></button>`;
    content.querySelectorAll("[data-army-brief-tab]").forEach(button => button.addEventListener("click", () => { activeTab = button.dataset.armyBriefTab; openOverlay(); }));
  }

  function renderOverlay() {
    const content = document.getElementById("army-system-content");
    const date = document.getElementById("army-system-date");
    if (!content || !date) return;
    document.querySelectorAll("[data-army-tab]").forEach(button => button.classList.toggle("active", button.dataset.armyTab === activeTab));
    date.textContent = coreState ? `建安军务 · 第 ${coreState.turn}/${coreState.maxTurns || 24} 月` : "尚未载入本局";
    if (!state) { content.innerHTML = '<p class="empty-state">请先开启或读取一局游戏。</p>'; return; }
    const renderers = { armies: renderArmies, movements: renderMovements, sieges: renderSieges, judgments: renderJudgments, battles: renderBattles };
    content.innerHTML = renderArmySummary() + (renderers[activeTab] || renderArmies)();
    content.querySelectorAll("[data-siege-stance]").forEach(button => button.addEventListener("click", () => setSiegeStance(button.dataset.siegeCity, button.dataset.siegeStance)));
    content.querySelectorAll("[data-judgment-decision]").forEach(button => button.addEventListener("click", () => resolvePostwarJudgment(button.dataset.judgmentId, button.dataset.judgmentDecision)));
  }

  function renderArmySummary() {
    const alive = Object.values(state.armies).filter(army => army.status !== "destroyed");
    const moving = alive.filter(army => ["marching", "routing"].includes(army.status));
    const total = alive.reduce((sum, army) => sum + army.troops, 0);
    const avgSupply = alive.length ? Math.round(alive.reduce((sum, army) => sum + army.supply, 0) / alive.length) : 0;
    const activeSieges = Object.values(state.sieges || {}).filter(item => item.status === "active").length;
    return `<section class="army-summary"><article><span>完整军团</span><strong>${alive.length}</strong><small>${state.armies ? Object.values(state.armies).length - alive.length : 0} 支已经溃散</small></article><article><span>登记兵力</span><strong>${formatNumber(total)}</strong><small>不等同于可立即投入战斗人数</small></article><article><span>行军与败退</span><strong>${moving.length}</strong><small>${moving.reduce((sum, army) => sum + army.eta, 0)} 段军路待通过</small></article><article><span>正在围城</span><strong>${activeSieges}</strong><small>${state.conquests.length} 座城池已经易手</small></article><article><span>待裁决</span><strong>${state.pendingJudgments.length}</strong><small>${state.captives.filter(item => item.status === "awaiting").length} 名俘虏候旨</small></article><article><span>归降将吏</span><strong>${state.surrenderedOfficers.length}</strong><small>${state.judgmentHistory.length} 次战后处置</small></article><article><span>平均粮秣</span><strong>${avgSupply}</strong><small>${alive.filter(army => army.supply <= 25).length} 支处于低补给</small></article></section>`;
  }

  function renderArmies() {
    const armies = Object.values(state.armies).sort((a, b) => b.troops - a.troops);
    return `<section><div class="army-section-head"><div><span class="section-kicker">军团名册</span><h3>天下军团</h3></div><small>兵力 · 士气 · 粮秣 · 训练 · 疲劳</small></div><div class="army-card-grid">${armies.map(renderArmyCard).join("")}</div></section>`;
  }

  function renderArmyCard(army) {
    const routeText = army.routeIds.length ? army.routeIds.slice(army.routeIndex).map(routeName).join("；") : "无跨城行军路线";
    return `<article class="army-card ${army.status} ${army.supply <= 25 ? "low-supply" : ""}"><div class="army-card-head"><div><span>${escapeHtml(ownerName(army.owner))}</span><strong>${escapeHtml(armyName(army))}</strong><small>主将 ${escapeHtml(commanderName(army.commander))}</small></div><b>${escapeHtml(statusLabel(army.status))}</b></div><div class="army-position"><span>${escapeHtml(cityName(army.cityId))}</span><i>→</i><span>${escapeHtml(cityName(army.targetCityId))}</span></div><div class="army-troops"><span>兵力</span><strong>${formatNumber(army.troops)}</strong><small>编制 ${formatNumber(army.maxTroops)}</small></div>${metric("士气", army.morale)}${metric("粮秣", army.supply)}${metric("训练", army.training)}${metric("疲劳", army.fatigue, true)}<p><strong>${escapeHtml(taskLabel(army.task))}</strong> · ${escapeHtml(routeText)}</p><small>${escapeHtml(army.lastChange)}</small></article>`;
  }

  function renderMovements() {
    const orders = [...state.orders].sort((a, b) => b.turn - a.turn);
    const active = Object.values(state.armies).filter(army => ["marching", "routing", "engaged"].includes(army.status));
    return `<section><div class="army-section-head"><div><span class="section-kicker">行军态势</span><h3>当前行动</h3></div><small>每月通过一段主要军路；缺粮或高军压会造成停滞与减员</small></div><div class="movement-list">${active.length ? active.map(army => `<article class="movement-card"><div><strong>${escapeHtml(armyName(army))}</strong><b>${escapeHtml(statusLabel(army.status))}</b></div><p>${escapeHtml(cityName(army.cityId))} → ${escapeHtml(cityName(army.targetCityId))}</p><div class="movement-route">${army.routeIds.length ? army.routeIds.map((id, index) => `<span class="${index < army.routeIndex ? "passed" : index === army.routeIndex ? "current" : ""}">${escapeHtml(routeName(id))}</span>`).join("") : "<span>已抵达目标区域</span>"}</div><small>预计还需 ${army.eta} 个月 · 粮秣 ${Math.round(army.supply)} · 士气 ${Math.round(army.morale)}</small></article>`).join("") : '<p class="empty-state">当前没有跨城行军的军团。</p>'}</div><div class="army-section-head order-history-head"><div><span class="section-kicker">诏令军务</span><h3>命令记录</h3></div></div><div class="army-order-list">${orders.length ? orders.map(order => `<article><div><strong>${escapeHtml(armyName(state.armies[order.armyId] || { id: order.armyId }))}</strong><b>${orderStatusLabel(order.status)}</b></div><p>${escapeHtml(cityName(order.originCityId))} → ${escapeHtml(cityName(order.targetCityId))} · ${escapeHtml(taskLabel(order.task))}</p><small>第 ${order.turn} 月 · 执行度 ${order.execution}% · ${escapeHtml(order.text)}</small></article>`).join("") : '<p class="empty-state">尚无军团命令。圣旨写明诸侯、城池和进攻或驰援等动作后，会在此建立军务记录。</p>'}</div></section>`;
  }

  function renderBattles() {
    return `<section><div class="army-section-head"><div><span class="section-kicker">战役结算</span><h3>战报</h3></div><small>野战胜利后转入围城，城破后会真实改变控制权</small></div><div class="battle-report-list">${state.battleReports.length ? state.battleReports.map(report => `<article class="battle-report-card"><div class="battle-report-head"><div><span>${escapeHtml(report.date)}</span><strong>${escapeHtml(report.title)}</strong></div><b>${escapeHtml(report.result)}</b></div><div class="battle-sides"><section><span>进攻方</span><strong>${escapeHtml(report.attackerName)}</strong><small>主将 ${escapeHtml(report.attackerCommander)}</small><p>损失 ${formatNumber(report.attackerLosses)} · 余 ${formatNumber(report.attackerRemaining)}</p></section><i>战</i><section><span>守备方</span><strong>${escapeHtml(report.defenderName)}</strong><small>主将 ${escapeHtml(report.defenderCommander)}</small><p>损失 ${formatNumber(report.defenderLosses)} · 余 ${formatNumber(report.defenderRemaining)}</p></section></div><p>${escapeHtml(report.note)}</p></article>`).join("") : '<p class="empty-state">尚未发生军团接触。可命诸侯向敌军驻地进攻，军团抵达后会自动结算战役。</p>'}</div><section class="army-log"><div class="army-section-head"><div><span class="section-kicker">军中记录</span><h3>最近动态</h3></div></div>${state.log.slice(0, 16).map(item => `<article><span>${escapeHtml(logIcon(item.type))}</span><div><strong>第 ${item.turn} 月</strong><p>${escapeHtml(item.text)}</p></div></article>`).join("")}</section></section>`;
  }

  function renderSieges() {
    const sieges = Object.values(state.sieges || {}).sort((a, b) => (a.status === "active" ? -1 : 1) || (b.startedTurn || 0) - (a.startedTurn || 0));
    return `<section><div class="army-section-head"><div><span class="section-kicker">城池攻守</span><h3>围城与城池易手</h3></div><small>强攻、围困与劝降各有代价</small></div><div class="siege-list">${sieges.length ? sieges.map(renderSiegeCard).join("") : '<p class="empty-state">尚无围城。进攻军在敌方城池赢得野战后会自动建立围城。</p>'}</div></section>`;
  }

  function renderJudgments() {
    const pending = state.pendingJudgments || [];
    const history = state.judgmentHistory || [];
    const captiveCards = (state.captives || []).filter(item => item.status !== "released");
    return `<section><div class="army-section-head"><div><span class="section-kicker">克城之后</span><h3>战后裁决</h3></div><small>城池、功臣与降将必须一并权衡</small></div><div class="judgment-list">${pending.length ? pending.map(renderJudgmentCard).join("") : '<p class="empty-state">当前没有等待裁决的克城事务。</p>'}</div>${captiveCards.length ? `<div class="army-section-head judgment-subhead"><div><span class="section-kicker">御前候旨</span><h3>俘虏与归降</h3></div><small>${state.surrenderedOfficers.length} 人已经归降</small></div><div class="captive-list">${captiveCards.map(item => `<article><div><strong>${escapeHtml(item.name)}</strong><b>${escapeHtml(captiveStatusLabel(item.status))}</b></div><p>${escapeHtml(ownerName(item.formerOwner))}旧将 · ${escapeHtml(cityName(item.cityId))}</p><small>${escapeHtml(item.lastChange)}</small></article>`).join("")}</div>` : ""}${history.length ? `<div class="army-section-head judgment-subhead"><div><span class="section-kicker">诏令归档</span><h3>历次处置</h3></div></div><div class="judgment-history">${history.slice(0, 12).map(item => `<article><strong>${escapeHtml(cityName(item.cityId))}</strong><span>${escapeHtml(item.decisionLabel)}</span><small>第 ${item.turn} 月 · ${escapeHtml(ownerName(item.newOwner))}克城</small></article>`).join("")}</div>` : ""}</section>`;
  }

  function renderJudgmentCard(judgment) {
    const captive = state.captives.find(item => item.id === judgment.captiveId);
    const recruit = getJudgmentDecision("recruit", judgment, coreState);
    return `<article class="judgment-card"><div class="judgment-card-head"><div><span>第 ${judgment.turn} 月克城</span><strong>${escapeHtml(cityName(judgment.cityId))}</strong><small>${escapeHtml(ownerName(judgment.previousOwner))} → ${escapeHtml(ownerName(judgment.newOwner))}</small></div><b>${captive ? `俘将 ${escapeHtml(captive.name)}` : "守军请降"}</b></div><p>城池已经易手，但由谁治理、如何安民以及怎样处置降将，将决定皇权与诸侯关系。</p><div class="judgment-actions"><button type="button" data-judgment-id="${escapeHtml(judgment.id)}" data-judgment-decision="pacify"><strong>赦降安民</strong><span>威望与民稳上升</span></button><button type="button" data-judgment-id="${escapeHtml(judgment.id)}" data-judgment-decision="appoint"><strong>汉官接掌</strong><span>皇权上升 · 曹氏警戒</span></button><button type="button" data-judgment-id="${escapeHtml(judgment.id)}" data-judgment-decision="reward"><strong>论功行赏</strong><span>功臣保有城池</span></button><button type="button" data-judgment-id="${escapeHtml(judgment.id)}" data-judgment-decision="recruit"><strong>纳降任用</strong><span>${captive ? `归降机会 ${recruit.recruitChance}%` : "收编降官"}</span></button></div></article>`;
  }

  function renderSiegeCard(siege) {
    const army = state.armies[siege.attackerArmyId];
    const active = siege.status === "active";
    return `<article class="siege-card ${escapeHtml(siege.status)}"><div class="siege-card-head"><div><span>${active ? "城下军议" : siege.status === "captured" ? "克城记录" : "围城结束"}</span><strong>${escapeHtml(cityName(siege.cityId))}</strong><small>${escapeHtml(ownerName(siege.attackerOwner))}进攻 · ${escapeHtml(ownerName(siege.defenderOwner))}守备</small></div><b>${active ? `${Math.round(siege.progress)}%` : siege.status === "captured" ? "已易手" : "已解围"}</b></div><div class="siege-metrics">${metric("围城进展", siege.progress)}${metric("城墙", siege.walls)}${metric("城内粮秣", siege.citySupply)}${metric("守军", Math.min(100, siege.garrison / 70))}</div><p>${escapeHtml(siege.lastChange)}</p>${active ? `<div class="siege-stances" role="group" aria-label="${escapeHtml(cityName(siege.cityId))}围城方略"><button type="button" data-siege-city="${escapeHtml(siege.cityId)}" data-siege-stance="assault" class="${siege.stance === "assault" ? "active" : ""}"><strong>强攻</strong><span>进展快 · 伤亡高</span></button><button type="button" data-siege-city="${escapeHtml(siege.cityId)}" data-siege-stance="blockade" class="${siege.stance === "blockade" ? "active" : ""}"><strong>围困</strong><span>消耗粮秣 · 稳妥</span></button><button type="button" data-siege-city="${escapeHtml(siege.cityId)}" data-siege-stance="persuade" class="${siege.stance === "persuade" ? "active" : ""}"><strong>劝降</strong><span>依赖名分 · 少伤亡</span></button></div><small>${escapeHtml(armyName(army || { id: siege.attackerArmyId }))} · 兵力 ${formatNumber(army?.troops || 0)} · 粮秣 ${Math.round(army?.supply || 0)}</small>` : ""}</article>`;
  }

  function metric(label, value, inverse = false) {
    return `<div class="army-metric ${inverse ? "inverse" : ""}"><span>${label}</span><i><b style="width:${clamp(value, 0, 100)}%"></b></i><em>${Math.round(value)}</em></div>`;
  }

  function orderStatusLabel(status) { return { executing: "执行中", arrived: "已抵达", failed: "失败" }[status] || status; }
  function siegeStanceLabel(id) { return { assault: "强攻", blockade: "围困", persuade: "劝降" }[id] || id; }
  function captiveStatusLabel(id) { return { awaiting: "候旨", detained: "留置", recruited: "归降", released: "获释" }[id] || id; }
  function logIcon(type) { return { attack: "攻", support: "援", advance: "调", defend: "守", supply: "粮", ceasefire: "和", retreat: "退", battle: "战", siege: "围", capture: "城", warning: "警", system: "籍" }[type] || "军"; }
  function formatNumber(value) { return Math.max(0, Math.round(Number(value) || 0)).toLocaleString("zh-CN"); }

  window.XianArmySystem = Object.freeze({
    choosePrimaryOrder,
    calculateCombatPower,
    calculateSiegeTurn,
    setSiegeStance,
    getJudgmentDecision,
    resolvePostwarJudgment,
    getState: () => state ? JSON.parse(JSON.stringify(state)) : null,
    open: openOverlay,
  });
})();
