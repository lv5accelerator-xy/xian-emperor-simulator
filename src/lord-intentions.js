/* Structured proposals are plans. Only army receipts establish military facts. */
(() => {
  "use strict";
  const militaryTasks = ["attack", "support", "advance", "defend", "supply"];
  const hash = text => { let n = 2166136261; for (const c of String(text)) n = Math.imul(n ^ c.charCodeAt(0), 16777619); return n >>> 0; };
  const allied = (a, b, strategy, turn) => window.XianAllianceDiplomacy.allied(a, b, strategy, turn);
  function ledger(value, core, existingFacts = []) {
    const current = value || {}, result = { entryTurn: core.turn, ...current, schemaVersion: 2 };
    for (const field of ["generatedTurns", "intents", "consequences", "incidents", "reactions", "promiseOutcomes"]) result[field] = Array.isArray(current[field]) ? current[field] : [];
    result.ignoreReactionFactIds = current.schemaVersion === 2 && Array.isArray(current.ignoreReactionFactIds) ? current.ignoreReactionFactIds : existingFacts.map(f => f.id);
    result.reactionStartTurn = current.reactionStartTurn ?? core.turn;
    return result;
  }
  function pathBetween(from, to) {
    const queue = [{ city: from, path: [] }], seen = new Set([from]);
    while (queue.length) { const item = queue.shift(); if (item.city === to) return item.path;
      for (const route of window.XIAN_STRATEGY_DATA.routes) { const next = route.from === item.city ? route.to : route.to === item.city ? route.from : null;
        if (next && !seen.has(next)) { seen.add(next); queue.push({ city: next, path: [...item.path, route.id] }); }
      }
    }
    return [];
  }
  function activeOrder(army, orders = []) {
    if (!army?.currentOrderId) return false;
    return ["marching", "routing", "engaged", "besieging"].includes(army.status) || orders.find(o => o.id === army.currentOrderId)?.status !== "arrived";
  }
  function compareIntents(a, b) { return Number(b.priority || 0) - Number(a.priority || 0) || a.id.localeCompare(b.id); }
  function betrayalPact(owner, targetOwner, strategy, turn, world = window.XianWorldSystem?.getState?.()) {
    const lord = world?.lords?.[owner] || window.XIAN_STRATEGY_DATA.lords.find(l => l.id === owner) || {};
    if (Number(strategy.strategies[owner]?.trust ?? 50) >= 30 || Number(lord.expansion ?? 50) - Number(lord.caution ?? 50) < 25 || owner === targetOwner) return null;
    return (strategy.promises || []).find(p => window.XianAllianceDiplomacy.active(p, turn) && p.contract.parties.includes(owner) && p.contract.parties.includes(targetOwner));
  }
  function canBetray(intent, strategy) { return intent.betrayalPactId && betrayalPact(intent.owner, intent.targetOwner, strategy, intent.turn)?.id === intent.betrayalPactId; }
  function conflictWarnings(intent, strategy, armies) {
    const candidates = (strategy.commandChain?.intents || []).filter(p => p.id !== intent.id && p.turn === intent.turn && p.status === "proposed");
    for (const unit of Object.values(armies.armies || {})) if (unit.id !== intent.armyId && unit.troops >= 500 && ["marching", "engaged", "besieging"].includes(unit.status)) candidates.push({ armyId: unit.id, owner: unit.owner,
      ownerName: window.XianCharacterAvailability?.faction?.(unit.owner)?.name || unit.ownerName, originCityId: unit.cityId, targetCityId: unit.targetCityId, task: unit.task, routeIds: unit.routeIds.slice(unit.routeIndex) });
    const warnings = [];
    for (const other of candidates) {
      if (other.armyId === intent.armyId) { warnings.push("同军团另有请求：已有付费军令优先，未接令军议按固定优先序复核"); continue; }
      if (allied(other.owner, intent.owner, strategy, intent.turn) || ![other.task, intent.task].includes("attack")) continue;
      if (other.targetCityId === intent.targetCityId) warnings.push(`${other.ownerName}也有军团或军议指向同城，可能争夺目标`);
      if (intent.routeIds?.length && other.routeIds?.[0] === intent.routeIds[0] && other.originCityId !== intent.originCityId) warnings.push(`与${other.ownerName}对向行军，实际出兵后可能在军路遭遇`);
    }
    return [...new Set(warnings)];
  }
  function proposeBatch(core, strategy, armies, world, key) {
    const data = window.XIAN_STRATEGY_DATA;
    const candidates = data.lords.map(lord => {
      const army = Object.values(armies.armies || {}).filter(a => a.owner === lord.id && a.status !== "destroyed" && a.troops >= 500)
        .sort((a, b) => Number(activeOrder(a, armies.orders)) - Number(activeOrder(b, armies.orders)) || a.id.localeCompare(b.id))[0];
      const personality = world?.lords?.[lord.id] || {};
      const threats = (strategy.commandChain?.incidents || []).filter(f => f.defenderOwner === lord.id && f.turn >= core.turn - 2 && strategy.cities[f.cityId]?.controller === lord.id);
      const aid = (strategy.commandChain?.reactions || []).filter(r => r.actor === lord.id && r.turn >= core.turn - 2 && strategy.cities[r.cityId]?.controller === r.protectedOwner);
      return { lord, army, expansion: Number(personality.expansion ?? lord.expansion ?? 50), caution: Number(personality.caution ?? lord.caution ?? 50),
        threats, aid, rank: hash(`${key}:${core.turn}:${lord.id}`) + (threats.length || aid.length ? 4294967296 : 0) };
    }).filter(x => x.army).sort((a, b) => b.rank - a.rank || a.lord.id.localeCompare(b.lord.id));
    return candidates.slice(0, 3).map(chosen => {
    const { lord, army, expansion, caution } = chosen;
    let targets = data.routes.filter(r => r.from === army.cityId || r.to === army.cityId).map(r => ({ route: r.id, city: r.from === army.cityId ? r.to : r.from }))
      .filter(x => strategy.cities[x.city] && (!allied(lord.id, strategy.cities[x.city].controller, strategy, core.turn) || betrayalPact(lord.id, strategy.cities[x.city].controller, strategy, core.turn, world)))
      .sort((a, b) => hash(`${key}:${core.turn}:${a.city}`) - hash(`${key}:${core.turn}:${b.city}`));
    const betrayals = targets.filter(x => betrayalPact(lord.id, strategy.cities[x.city].controller, strategy, core.turn, world));
    if (betrayals.length) targets = betrayals;
    const attack = targets.length && expansion >= caution && Number(strategy.strategies[lord.id]?.readiness || 0) >= 30;
    const reaction = chosen.threats.at(-1) || chosen.aid.at(-1);
    const target = reaction?.cityId || (attack ? targets[0].city : army.cityId);
    const task = reaction ? (chosen.threats.length ? "defend" : "support") : attack ? "attack" : "defend";
    const betrayal = task === "attack" ? betrayalPact(lord.id, strategy.cities[target]?.controller, strategy, core.turn, world) : null;
    const name = window.XianCharacterAvailability?.faction?.(lord.id, core)?.name || lord.name;
    return { id: `lord-intent:${core.createdAt}:${core.turn}:${lord.id}`, source: "autonomous", owner: lord.id, ownerName: name,
      armyId: army.id, armyName: window.XIAN_ARMY_DATA?.armies?.find(x => x.id === army.id)?.name || name + "军团",
      turn: core.turn, dueTurn: core.turn, originCityId: army.cityId, targetCityId: target,
      targetName: data.cities.find(c => c.id === target)?.name || target, targetOwner: strategy.cities[target]?.controller,
      task, routeIds: pathBetween(army.cityId, target), status: "proposed", priority: chosen.rank, ...(betrayal ? { betrayalPactId: betrayal.id } : {}),
      reactionIds: reaction ? [reaction.id] : [],
      reason: reaction ? `${chosen.threats.length ? "本镇目标遭到实际敌对行动，拟增防" : "已有援军目的地遭到实际敌对行动，拟护援"}；依据第${reaction.turn}月军务凭据`
        : betrayal ? `对朝廷信任不足30，扩张意愿${expansion}、谨慎${caution}；拟主动背盟进攻，接令时复核；失信由该镇承担`
          : attack ? `扩张意愿 ${expansion}、谨慎 ${caution}；拟沿相邻军路进攻` : `扩张意愿 ${expansion}、谨慎 ${caution}；拟就地守备整顿` };
    });
  }
  function propose(...args) { return proposeBatch(...args)[0] || null; }
  function ceasefires(intent, strategy, turn, armies = {}) {
    if (intent.task !== "attack") return [];
    const opponents = [strategy.cities[intent.targetCityId]?.controller, ...Object.values(armies.armies || {})
      .filter(a => a.troops >= 500 && a.status !== "destroyed" && a.status !== "routing" && (a.cityId === intent.targetCityId
        || (a.status === "marching" && a.routeIds[a.routeIndex] === intent.routeIds?.[0] && a.cityId !== intent.originCityId))).map(a => a.owner)];
    return (strategy.promises || []).filter(p => (p.type === "ceasefire" || window.XianAllianceDiplomacy.formal(p)) && p.status === "active" && turn <= p.deadlineTurn
      && p.contract?.parties?.includes(intent.owner) && opponents.some(owner => owner !== intent.owner && p.contract.parties.includes(owner)));
  }
  function assess(intent, army, strategy, turn, orders = []) {
    if (!army || army.owner !== intent.owner || army.status === "destroyed" || army.troops < 500) return "军团已失去建制或不再属于该镇";
    if (army.cityId !== intent.originCityId) return "军团已离开军议起点，须另立军令";
    const prior = orders.find(o => o.id === army.currentOrderId);
    if (!["idle", "recovering", "defending", "supplying"].includes(army.status) || (army.currentOrderId && prior?.status !== "arrived")) return "军团已有军令，不能覆盖正在执行的任务";
    if ((strategy.promises || []).some(p => p.status === "active" && p.type === "military_aid" && (p.contract?.armyId === army.id || (!p.contract?.armyId && p.lordId === army.owner)))) return "该镇须优先履行现有援军约定";
    if (strategy.cities[intent.targetCityId]?.controller !== intent.targetOwner) return "目标归属已改变，原军议作废";
    if (intent.task === "attack" && allied(intent.owner, intent.targetOwner, strategy, turn) && !canBetray(intent, strategy)) return "目标属于本镇或友军";
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
      if (!intent) { intent = { ...response.request, id: response.intentId, source: response.request?.source || "edict", status: "requested" }; chain.intents.push(intent); }
      // A refused restraint does not decide whether the commander will march.
      if (response.kind === "restrain" && response.status === "refused") { intent.restraintResponse = response.id; continue; }
      if (["autonomous", "coalition"].includes(intent.source) && response.authority === "court" && response.status === "refused") {
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
      const facts = (armyState.militaryFacts || []).filter(f => f.sourceOrderId === response.orderId || f.opposingOrderId === response.orderId || f.participants?.some(p => p.orderId === response.orderId));
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
        const attacking = fact.attackerOwner === intent.owner || fact.participants?.some(p => p.orderId === response.orderId && p.side === "attacker");
        const endorsed = response.authority === "court" && attacking;
        const liabilityId = intent.sourceCoalitionPlanId || intent.id;
        const priorPenalty = chain.consequences.some(c => (c.liabilityId || c.intentId) === liabilityId && c.defenderOwner === fact.defenderOwner && (c.penaltyIssued || c.trustDelta < 0));
        // Existing ceasefire settlements retain their own once-only penalty.
        const contracts = (strategy.promises || []).filter(p => p.type === "ceasefire" && p.contract?.receipts?.some(r => r.source === fact.source));
        const victim = strategy.strategies[fact.defenderOwner], penaltyIssued = Boolean(endorsed && !priorPenalty && victim);
        const before = Number(victim?.trust || 0), after = penaltyIssued ? Math.max(0, before - 3) : before;
        const delta = after - before;
        if (penaltyIssued) victim.trust = after;
        chain.consequences.push({ id, intentId: intent.id, liabilityId, factId: fact.id, kind: fact.kind, turn: fact.turn,
          attackerOwner: fact.attackerOwner, defenderOwner: fact.defenderOwner, attackerName: fact.attackerName, defenderName: fact.defenderName,
          responsibility: !attacking ? "defence" : endorsed ? "court" : "lord", penaltyIssued, requestedTrustDelta: penaltyIssued ? -3 : 0, trustDelta: delta, promiseIds: contracts.map(p => p.id) });
      }
      // A late observed breach may attach to a fact already displayed.
      for (const consequence of chain.consequences.filter(c => c.intentId === intent.id)) {
        consequence.promiseIds = [...new Set([...(consequence.promiseIds || []), ...(strategy.promises || []).filter(p => p.contract?.receipts?.some(r => r.id === `breach:${consequence.factId}`)).map(p => p.id)])];
      }
    }
    reconcileIncidents(chain, armyState, strategy, core);
    for (const promise of strategy.promises || []) if (promise.settlement && !chain.promiseOutcomes.some(o => o.id === promise.settlement.id)) {
      const orderId = promise.contract?.orderId;
      const facts = (armyState.militaryFacts || []).filter(f => (promise.contract?.receipts || []).some(r => r.sourceFactId === f.id || r.id === `breach:${f.id}`));
      chain.promiseOutcomes.push({ ...promise.settlement, status: promise.status, promiseId: promise.id, label: promise.label, actor: promise.lordId, actorName: promise.identity?.representativeName || promise.lordId,
        sourceOrderId: orderId || null, sourceFactIds: facts.map(f => f.id),
        conflictIds: (armyState.commandConflicts || []).filter(c => (orderId && c.previousOrderId === orderId) || c.factIds?.some(id => facts.some(f => f.id === id))).map(c => c.id) });
    }
    for (const intent of chain.intents) if (["proposed", "requested"].includes(intent.status) && core.turn > intent.dueTurn) { intent.status = "expired"; intent.responseReason = "本月未获军团回执，不追认出兵"; }
  }
  function reconcileIncidents(chain, armyState, strategy, core) {
    for (const fact of [...(armyState.militaryFacts || [])].sort((a, b) => a.turn - b.turn || a.id.localeCompare(b.id))) {
      let incident = chain.incidents.find(i => i.id === fact.id);
      if (!incident) {
        const response = (armyState.commandResponses || []).find(r => r.orderId === fact.sourceOrderId);
        const order = (armyState.orders || []).find(o => o.id === fact.sourceOrderId);
        incident = { ...fact, authority: fact.authority || response?.authority || order?.authority || (order?.source === "grand-map" ? "court" : "lord"),
          intentIds: chain.intents.filter(i => i.orderId && [fact.sourceOrderId, fact.opposingOrderId].includes(i.orderId)).map(i => i.id).sort(), promiseIds: [] };
        chain.incidents.push(incident);
      }
      const linked = (strategy.promises || []).filter(p => p.contract?.receipts?.some(r => r.id === `breach:${fact.id}` || r.sourceFactId === fact.id)).map(p => p.id);
      incident.promiseIds = [...new Set([...(incident.promiseIds || []), ...linked])];
      incident.intentIds = [...new Set([...(incident.intentIds || []), ...chain.intents.filter(i => i.orderId && [fact.sourceOrderId, fact.opposingOrderId].includes(i.orderId)).map(i => i.id)])].sort();
      if (chain.ignoreReactionFactIds.includes(fact.id)) continue;
      // Witnesses were frozen before casualties, retreat, or contract settlement.
      // Reconstructing them from the latest state would erase real observations.
      for (const witness of fact.aidWitnesses || []) {
        const { actor, protectedOwner, sourcePromiseId, supportingOrderId } = witness;
        if (!actor || !protectedOwner || !sourcePromiseId || !supportingOrderId || !witness.acceptedReceiptId) continue;
        const id = `aid-alarm:${actor}:${protectedOwner}:${fact.sourceOrderId || fact.id}`;
        const existing = chain.reactions.find(r => r.id === id);
        if (existing) { existing.sourcePromiseIds = [...new Set([...(existing.sourcePromiseIds || [existing.sourcePromiseId]), sourcePromiseId])]; existing.supportingOrderIds = [...new Set([...(existing.supportingOrderIds || [existing.supportingOrderId]), supportingOrderId])]; continue; }
        const sharedAllianceWarning = (strategy.allianceDiplomacy?.reactions || []).some(r => r.actor === actor && r.root === (fact.sourceOrderId || fact.id) && r.requestedTrustDelta < 0);
        const trust = strategy.strategies[actor], before = Number(trust?.trust || 0), requested = incident.authority === "court" && trust && !sharedAllianceWarning ? -2 : 0;
        if (trust && requested) trust.trust = Math.max(0, before + requested);
        chain.reactions.push({ id, kind: witness.kind, turn: fact.turn, actor, actorName: witness.actorName || actor,
          protectedOwner, protectedName: witness.protectedName, cityId: witness.cityId, routeId: fact.routeId || null, sourceFactId: fact.id, sourceOrderId: fact.sourceOrderId,
          sourcePromiseId, sourcePromiseIds: [sourcePromiseId], supportingOrderId, supportingOrderIds: [supportingOrderId], attackerOwner: fact.attackerOwner, attackerName: fact.attackerName,
          sharedAllianceWarning, requestedTrustDelta: requested, trustDelta: trust ? trust.trust - before : 0,
          text: `${witness.kind === "aid-intercepted" ? "已承接援军在军路遭到实际截击" : `${witness.protectedName || fact.defenderName}的受援目的地遭到实际敌对行动`}；援方警惕并在后续军议优先复核护援，当前军令不自动撤换，已结束约定不追认为履约` });
      }
    }
  }
  window.XianLordIntentions = Object.freeze({ militaryTasks, hash, ledger, propose, proposeBatch, assess, ceasefires, reconcile, activeOrder, compareIntents, conflictWarnings, canBetray });
})();
