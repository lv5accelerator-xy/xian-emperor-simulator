/* Structured proposals are plans. Only army receipts establish military facts. */
(() => {
  "use strict";
  const militaryTasks = ["attack", "support", "advance", "defend", "supply"];
  const hash = text => { let n = 2166136261; for (const c of String(text)) n = Math.imul(n ^ c.charCodeAt(0), 16777619); return n >>> 0; };
  const allied = (a, b) => a === b || [a, b].every(x => ["court", "cao_cao"].includes(x));
  function ledger(value, core) {
    return { schemaVersion: 1, entryTurn: core.turn, generatedTurns: [], intents: [], consequences: [], ...value };
  }
  function propose(core, strategy, armies, world, key) {
    const data = window.XIAN_STRATEGY_DATA;
    const candidates = data.lords.map(lord => {
      const army = Object.values(armies.armies || {}).filter(a => a.owner === lord.id && a.status !== "destroyed" && a.troops >= 500)
        .sort((a, b) => a.id.localeCompare(b.id))[0];
      const personality = world?.lords?.[lord.id] || {};
      return { lord, army, expansion: Number(personality.expansion ?? lord.expansion ?? 50), caution: Number(personality.caution ?? lord.caution ?? 50),
        rank: hash(`${key}:${core.turn}:${lord.id}`) };
    }).filter(x => x.army).sort((a, b) => b.rank - a.rank || a.lord.id.localeCompare(b.lord.id));
    const chosen = candidates[0];
    if (!chosen) return null;
    const { lord, army, expansion, caution } = chosen;
    const targets = data.routes.filter(r => r.from === army.cityId || r.to === army.cityId).map(r => ({ route: r.id, city: r.from === army.cityId ? r.to : r.from }))
      .filter(x => strategy.cities[x.city] && !allied(lord.id, strategy.cities[x.city].controller))
      .sort((a, b) => hash(`${key}:${core.turn}:${a.city}`) - hash(`${key}:${core.turn}:${b.city}`));
    const attack = targets.length && expansion >= caution && Number(strategy.strategies[lord.id]?.readiness || 0) >= 30;
    const target = attack ? targets[0].city : army.cityId;
    const name = window.XianCharacterAvailability?.faction?.(lord.id, core)?.name || lord.name;
    return { id: `lord-intent:${core.createdAt}:${core.turn}:${lord.id}`, source: "autonomous", owner: lord.id, ownerName: name,
      armyId: army.id, armyName: window.XIAN_ARMY_DATA?.armies?.find(x => x.id === army.id)?.name || name + "军团",
      turn: core.turn, dueTurn: core.turn, originCityId: army.cityId, targetCityId: target,
      targetName: data.cities.find(c => c.id === target)?.name || target, targetOwner: strategy.cities[target]?.controller,
      task: attack ? "attack" : "defend", routeIds: attack ? [targets[0].route] : [], status: "proposed",
      reason: attack ? `扩张意愿 ${expansion}、谨慎 ${caution}；拟沿相邻军路进攻` : `扩张意愿 ${expansion}、谨慎 ${caution}；拟就地守备整顿` };
  }
  function ceasefires(intent, strategy, turn, armies = {}) {
    if (intent.task !== "attack") return [];
    const opponents = [strategy.cities[intent.targetCityId]?.controller, ...Object.values(armies.armies || {})
      .filter(a => a.cityId === intent.targetCityId && a.troops >= 500 && !["marching", "routing", "destroyed"].includes(a.status)).map(a => a.owner)];
    return (strategy.promises || []).filter(p => p.type === "ceasefire" && p.status === "active" && turn <= p.deadlineTurn
      && p.contract?.parties?.includes(intent.owner) && opponents.some(owner => owner !== intent.owner && p.contract.parties.includes(owner)));
  }
  function assess(intent, army, strategy, turn, orders = []) {
    if (!army || army.owner !== intent.owner || army.status === "destroyed" || army.troops < 500) return "军团已失去建制或不再属于该镇";
    if (army.cityId !== intent.originCityId) return "军团已离开军议起点，须另立军令";
    const prior = orders.find(o => o.id === army.currentOrderId);
    if (!["idle", "recovering", "defending", "supplying"].includes(army.status) || (army.currentOrderId && prior?.status !== "arrived")) return "军团已有军令，不能覆盖正在执行的任务";
    if ((strategy.promises || []).some(p => p.status === "active" && p.type === "military_aid" && (p.contract?.armyId === army.id || (!p.contract?.armyId && p.lordId === army.owner)))) return "该镇须优先履行现有援军约定";
    if (strategy.cities[intent.targetCityId]?.controller !== intent.targetOwner) return "目标归属已改变，原军议作废";
    if (intent.task === "attack" && allied(intent.owner, intent.targetOwner)) return "目标属于本镇或友军";
    if (army.morale < 40 || army.fatigue > 70) return "士气不足40或疲劳超过70，军团请求整顿";
    if (intent.task === "attack" && army.troops < 2000) return "出战兵力不足2000";
    let city = intent.originCityId;
    for (const id of intent.routeIds || []) {
      const route = window.XIAN_STRATEGY_DATA.routes.find(r => r.id === id), state = strategy.routes[id];
      if (!route || ![route.from, route.to].includes(city)) return "军路不连通";
      if (!state || state.supply <= 22 || Number(state.blockadedUntil || 0) >= turn) return "军路断粮或遭封锁，拒绝出兵";
      city = route.from === city ? route.to : route.from;
    }
    if (city !== intent.targetCityId) return "军路未通达目标城池";
    if (army.supply < (intent.task === "attack" ? 35 + intent.routeIds.length * 4 : 15)) return "军粮不足，拒绝出兵";
    return null;
  }
  function reconcile(chain, armyState, strategy, core) {
    for (const response of armyState.commandResponses || []) {
      let intent = chain.intents.find(x => x.id === response.intentId);
      if (!intent) { intent = { ...response.request, id: response.intentId, source: "edict", status: "requested" }; chain.intents.push(intent); }
      // A refused restraint does not decide whether the commander will march.
      if (response.kind === "restrain" && response.status === "refused") { intent.restraintResponse = response.id; continue; }
      if (intent.source === "autonomous" && response.authority === "court" && response.status === "refused") {
        intent.interventionResponse = response.id;
        if (!intent.responseId) intent.responseReason = `朝廷协调未获承接：${response.reason}；月末仍由主将决断`;
        continue;
      }
      intent.responseId = response.id;
      intent.responseReason = response.reason;
      intent.status = response.status === "restrained" ? "restrained" : response.status === "refused" ? "refused" : "accepted";
      if (!response.orderId) continue;
      intent.orderId = response.orderId;
      const order = (armyState.orders || []).find(o => o.id === response.orderId) || intent.orderSnapshot || response.order;
      const army = armyState.armies?.[response.armyId];
      // Persist progress before the display-only order list is clipped.
      if (order) intent.orderSnapshot = { ...order };
      const facts = (armyState.militaryFacts || []).filter(f => f.sourceOrderId === response.orderId);
      intent.factIds = facts.map(f => f.id);
      const capture = facts.find(f => f.kind === "occupation");
      intent.status = capture ? "captured" : ["failed", "superseded"].includes(order?.status) ? order.status
        : army?.currentOrderId !== response.orderId && order?.status !== "arrived" ? "superseded"
          : army?.status === "destroyed" ? "failed" : facts.some(f => f.kind === "siege-start") && army?.currentOrderId === response.orderId && army?.status === "besieging" ? "besieging"
            : order?.status === "arrived" ? "arrived" : "marching";
      intent.lastProgress = army?.currentOrderId === response.orderId ? army.lastChange : order?.status === "arrived" ? "军令已有抵达回执" : "军团已转入其他任务";
      for (const fact of facts) {
        const id = `diplomacy:${intent.id}:${fact.id}`;
        if (chain.consequences.some(c => c.id === id)) continue;
        const endorsed = response.authority === "court";
        const priorPenalty = chain.consequences.some(c => c.intentId === intent.id && c.defenderOwner === fact.defenderOwner && (c.penaltyIssued || c.trustDelta < 0));
        // Existing ceasefire settlements retain their own once-only penalty.
        const contracts = (strategy.promises || []).filter(p => p.type === "ceasefire" && p.contract?.receipts?.some(r => r.source === fact.source));
        const victim = strategy.strategies[fact.defenderOwner], penaltyIssued = Boolean(endorsed && !priorPenalty && victim);
        const before = Number(victim?.trust || 0), after = penaltyIssued ? Math.max(0, before - 3) : before;
        const delta = after - before;
        if (penaltyIssued) victim.trust = after;
        chain.consequences.push({ id, intentId: intent.id, factId: fact.id, kind: fact.kind, turn: fact.turn,
          attackerOwner: fact.attackerOwner, defenderOwner: fact.defenderOwner, attackerName: fact.attackerName, defenderName: fact.defenderName,
          responsibility: endorsed ? "court" : "lord", penaltyIssued, requestedTrustDelta: penaltyIssued ? -3 : 0, trustDelta: delta, promiseIds: contracts.map(p => p.id) });
      }
      // A late observed breach may attach to a fact already displayed.
      for (const consequence of chain.consequences.filter(c => c.intentId === intent.id)) {
        consequence.promiseIds = (strategy.promises || []).filter(p => p.contract?.receipts?.some(r => r.id === `breach:${consequence.factId}`)).map(p => p.id);
      }
    }
    for (const intent of chain.intents) if (["proposed", "requested"].includes(intent.status) && core.turn > intent.dueTurn) { intent.status = "expired"; intent.responseReason = "本月未获军团回执，不追认出兵"; }
  }
  window.XianLordIntentions = Object.freeze({ militaryTasks, hash, ledger, propose, assess, ceasefires, reconcile });
})();
