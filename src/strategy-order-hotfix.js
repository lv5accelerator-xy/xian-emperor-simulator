/*
 * v0.4.1 稳定补丁：按圣旨文字出现顺序识别城池与诸侯，
 * 修正“起点—途经—目的地”被基础数据顺序打乱的问题。
 */
(() => {
  "use strict";

  const DATA = window.XIAN_STRATEGY_DATA;
  const originalApi = window.XianStrategyNetwork;
  if (!DATA || !originalApi) return;

  const CORE_KEY = "xian_emperor_simulator_v01";
  const STRATEGY_KEY = "xian_emperor_strategy_network_v040";
  let timer = null;

  function orderedMatches(text, records) {
    return records
      .map(record => {
        const positions = record.aliases
          .map(alias => text.indexOf(alias))
          .filter(position => position >= 0);
        return positions.length ? { id: record.id, position: Math.min(...positions) } : null;
      })
      .filter(Boolean)
      .sort((a, b) => a.position - b.position)
      .map(item => item.id);
  }

  function detectCityTargets(text) {
    return orderedMatches(String(text || ""), DATA.cities);
  }

  function detectLordTargets(text) {
    return orderedMatches(String(text || ""), DATA.lords);
  }

  function extractEdictText(text) {
    const match = String(text || "").match(/“([^”]+)”/);
    return (match?.[1] || text || "").trim();
  }

  function choosePrimaryOrder(orders) {
    const priority = ["attack", "support", "advance", "defend", "supply", "ceasefire", "trade"];
    return priority.find(order => orders.includes(order)) || orders[0] || "administration";
  }

  function resolveOrderedPath(cityIds, lordIds) {
    let from = null;
    let to = null;
    if (cityIds.length >= 2) {
      from = cityIds[0];
      to = cityIds[cityIds.length - 1];
    } else if (cityIds.length === 1 && lordIds.length) {
      from = DATA.lords.find(lord => lord.id === lordIds[0])?.seatCity || "xudu";
      to = cityIds[0];
      if (from === to) return [];
    } else if (cityIds.length === 1) {
      from = "xudu";
      to = cityIds[0];
    } else if (lordIds.length) {
      from = DATA.lords.find(lord => lord.id === lordIds[0])?.seatCity || "xudu";
      to = "xudu";
      if (from === to) return [];
    }
    return from && to ? originalApi.findRoutePath(from, to) : [];
  }

  function strategyObjective(lordId, order, cityIds) {
    const names = cityIds
      .map(id => DATA.cities.find(city => city.id === id)?.name)
      .filter(Boolean)
      .join("、") || "本镇";
    const subject = DATA.lords.find(lord => lord.id === lordId)?.name || "汉廷";
    const verbs = {
      attack: `向${names}进攻`,
      support: `驰援${names}`,
      advance: `调兵进驻${names}`,
      defend: `固守${names}`,
      supply: `向${names}转运粮饷`,
      ceasefire: `在${names}方向停战`,
      trade: `开通${names}互市`,
      administration: `经营${names}`,
    };
    return `${subject}${verbs[order] || verbs.administration}`;
  }

  function nudgeCorrectRoutes(state, routeIds, order, text) {
    routeIds.forEach(routeId => {
      const route = state.routes?.[routeId];
      if (!route) return;
      if (["attack", "advance"].includes(order)) {
        route.pressure = clamp(route.pressure + 2, 0, 100);
        route.supply = clamp(route.supply - 1, 0, 100);
      } else if (order === "support") {
        route.pressure = clamp(route.pressure + 1, 0, 100);
      } else if (["supply", "trade"].includes(order)) {
        route.supply = clamp(route.supply + 2, 0, 100);
      } else if (order === "ceasefire") {
        route.pressure = clamp(route.pressure - 2, 0, 100);
      }
      route.status = routeStatus(route.supply, route.pressure);
      route.lastChange = `路线顺序修正：${shortText(text)}`;
    });
  }

  function correctLatestEdicts(rawCore) {
    const core = safeParse(rawCore);
    const strategy = safeParse(localStorage.getItem(STRATEGY_KEY));
    if (!core?.reports || !strategy?.strategies) return;

    const lastCorrected = Number(strategy.v041LastCorrectedTimestamp) || 0;
    const reports = core.reports
      .filter(report => /^圣旨·/.test(report.title || "") && (Number(report.timestamp) || 0) > lastCorrected)
      .sort((a, b) => (Number(a.timestamp) || 0) - (Number(b.timestamp) || 0));
    if (!reports.length) return;

    reports.forEach(report => {
      const text = extractEdictText(report.text);
      const cityIds = detectCityTargets(text);
      const lordIds = detectLordTargets(text);
      const orders = originalApi.detectOrders(text);
      const order = choosePrimaryOrder(orders);
      const routeIds = resolveOrderedPath(cityIds, lordIds);
      const targets = lordIds.length ? lordIds : ["court"];

      targets.forEach(lordId => {
        const current = strategy.strategies[lordId];
        if (!current) return;
        current.order = order;
        current.targetCities = cityIds.length ? [...cityIds] : current.targetCities;
        current.routeIds = [...routeIds];
        current.objective = strategyObjective(lordId, order, cityIds);
        current.lastChange = `已按诏书文字顺序校正：${shortText(text)}`;
      });
      nudgeCorrectRoutes(strategy, routeIds, order, text);
      strategy.log = Array.isArray(strategy.log) ? strategy.log : [];
      strategy.log.unshift({
        id: `route-fix-${Number(report.timestamp) || Date.now()}`,
        turn: core.turn,
        type: "system",
        text: `尚书台按诏书顺序核定军路：${cityIds.map(id => DATA.cities.find(city => city.id === id)?.name).filter(Boolean).join(" → ") || "未指定城池"}。`,
      });
      strategy.v041LastCorrectedTimestamp = Math.max(Number(strategy.v041LastCorrectedTimestamp) || 0, Number(report.timestamp) || 0);
    });

    strategy.updatedAt = new Date().toISOString();
    localStorage.setItem(STRATEGY_KEY, JSON.stringify(strategy));

    window.__xianStrategyRefreshOnly = true;
    try {
      localStorage.setItem(CORE_KEY, rawCore);
    } finally {
      window.__xianStrategyRefreshOnly = false;
    }
  }

  function installWatcher() {
    if (window.__xianStrategyOrderHotfixInstalled) return;
    window.__xianStrategyOrderHotfixInstalled = true;
    const previousSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function orderedStrategySetItem(key, value) {
      previousSetItem.apply(this, arguments);
      if (this !== localStorage || key !== CORE_KEY || window.__xianFullSaveImporting || window.__xianStrategyRefreshOnly) return;
      window.clearTimeout(timer);
      timer = window.setTimeout(() => correctLatestEdicts(value), 170);
    };
  }

  function safeParse(raw) {
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (_) { return null; }
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, Number(value) || 0));
  }

  function shortText(text, limit = 56) {
    const value = String(text || "").replace(/\s+/g, " ").trim();
    return value.length > limit ? `${value.slice(0, limit)}……` : value;
  }

  function routeStatus(supply, pressure) {
    if (supply <= 22) return "补给阻断";
    if (pressure >= 78) return "战线激烈";
    if (pressure >= 58) return "争夺中";
    if (supply >= 72 && pressure <= 42) return "畅通";
    return "可通行";
  }

  window.XianStrategyNetwork = Object.freeze({
    ...originalApi,
    detectCityTargets,
    detectLordTargets,
    resolveOrderedPath,
    choosePrimaryOrder,
  });

  installWatcher();
})();
