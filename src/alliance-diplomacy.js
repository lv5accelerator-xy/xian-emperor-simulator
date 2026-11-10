/* Treaties require consent; coalition strength comes from actual army receipts. */
(() => {
  "use strict";
  const cap = n => Math.max(0, Math.min(100, n));
  const name = id => window.XianCharacterAvailability?.faction?.(id, window.XianEmperorGame?.getState?.())?.name || window.XIAN_STRATEGY_DATA?.lords.find(l => l.id === id)?.name || id;
  const affirmative = text => window.XianEdictRules?.affirmativeText?.(text) ?? text;
  const explicit = text => /结盟|盟约|会盟|同盟|联盟/.test(affirmative(text));
  const formal = p => p?.type === "alliance" && p.contract?.treatyType === "alliance" && p.contract.version === 1;
  const active = (p, turn) => formal(p) && p.status === "active" && p.contract.startTurn <= turn && turn <= p.deadlineTurn;
  const allied = (a, b, strategy, turn) => a === b || [a,b].every(x => ["court","cao_cao"].includes(x))
    || (strategy?.promises || []).some(p => active(p, turn) && p.contract.parties.includes(a) && p.contract.parties.includes(b));
  function migrate(strategy, core, armies = {}) {
    if (strategy.allianceDiplomacy?.schemaVersion === 1) { strategy.allianceDiplomacy.peaceRewards ||= []; return strategy.allianceDiplomacy; }
    if (!armies || armies.gameCreatedAt !== core.createdAt) armies = {};
    for (const p of strategy.promises || []) if (p.type === "alliance" && p.status === "active" && !formal(p)) {
      p.status = "unverified"; p.lastChange = "旧盟约缺少各方同意凭据，保留历史，不补记结盟或失信";
    }
    for (const p of strategy.promises || []) if (formal(p) && p.status === "active" && p.createdTurn < core.turn) p.contract.missingHistoricalObservation = true;
    return strategy.allianceDiplomacy = { schemaVersion: 1, entryTurn: core.turn, reputations: {}, plans: [], consequences: [], reactions: [], peaceRewards: [],
      ignoredFactIds: (armies.militaryFacts || []).map(f => f.id), ignoredConflictIds: (armies.commandConflicts || []).map(f => f.id),
      ignoredReportIds: (core.reports || []).map(r => String(r.id || r.timestamp)) };
  }
  function offer(text, core, strategy, armies = {}, execution = 65) {
    const clean = affirmative(text);
    if (!explicit(clean)) return null;
    const objectiveAt = clean.search(/共讨|合攻|共同进攻|共同攻打|共同防守|协同防守/);
    const prefix = objectiveAt < 0 ? clean : clean.slice(0, objectiveAt), suffix = objectiveAt < 0 ? "" : clean.slice(objectiveAt);
    const parties = window.XianStrategyNetwork.detectLordTargets(prefix);
    const city = window.XianStrategyNetwork.detectCityTargets(suffix).at(-1) || null;
    const targetOwner = city ? strategy.cities[city]?.controller : null;
    const operation = city ? /共同防守|协同防守/.test(suffix) ? "defend" : "attack" : null;
    const invalid = parties.length < 2 || parties.length > 3 ? "盟约须明确列出二至三方" : operation === "attack" && parties.some(id => allied(id, targetOwner, strategy, core.turn)) ? "共同进攻目标属于盟方或现有友军" : null;
    const receipts = parties.map(actor => {
      const trust = Number(strategy.strategies[actor]?.trust || 0), reputation = Number(strategy.allianceDiplomacy?.reputations[actor] ?? 50);
      const reason = invalid || (trust < 30 ? "对朝廷信任不足30" : reputation < 35 ? "守约信誉不足35" : execution < 45 ? "诏令执行力不足45" : "同意共同盟约");
      return { id: `consent:${actor}`, kind: "consent", actor, actorName: name(actor), turn: core.turn, status: invalid || trust < 30 || reputation < 35 || execution < 45 ? "refused" : "accepted", reason, trust, reputation, execution };
    });
    return { type: "alliance", version: 1, treatyType: "alliance", parties, partyNames: parties.map(name), leaderOwner: parties[0],
      targetCityId: city, targetOwner, targetName: window.XIAN_STRATEGY_DATA.cities.find(c => c.id === city)?.name || null,
      operation, startTurn: core.turn, deadlineTurn: core.turn + 4, invalid, receipts,
      initialFactIds: (armies.militaryFacts || []).map(f => f.id), initialOrderIds: (armies.orders || []).map(o => o.id),
      initialConflictIds: (armies.commandConflicts || []).map(c => c.id) };
  }
  function create(text, core, strategy, armies, execution, report) {
    const d = strategy.allianceDiplomacy, key = String(report.id || report.timestamp);
    if (d.ignoredReportIds.includes(key) || strategy.promises.some(p => p.sourceReportId === key)) return null;
    const contract = offer(text, core, strategy, armies, execution);
    if (!contract) return null;
    const terms = c => JSON.stringify([[...c.parties].sort(), c.targetCityId, c.targetOwner, c.operation]);
    if (strategy.promises.some(p => active(p, core.turn) && terms(p.contract) === terms(contract))) { d.ignoredReportIds.push(key); return null; }
    const accepted = !contract.invalid && contract.receipts.length >= 2 && contract.receipts.every(r => r.status === "accepted");
    return { id: `promise-alliance:${core.createdAt}:${key}`, sourceReportId: key, type: "alliance", label: "诸侯盟约", lordId: contract.leaderOwner,
      direction: "mutual", createdTurn: core.turn, deadlineTurn: contract.deadlineTurn, progress: 0, text: String(text).slice(0,120),
      status: accepted ? "active" : "refused", cityIds: contract.targetCityId ? [contract.targetCityId] : [], routeIds: [], contract,
      lastChange: accepted ? "各方已同意；共同军议尚须军团分别接令" : contract.invalid || "有盟方拒绝，盟约未成立" };
  }
  function propose(strategy, armies, core) {
    const d = strategy.allianceDiplomacy;
    if (core.ended || Number(core.monthlySettledTurn || 0) >= core.turn || window.XianShortChallenges?.getActiveStatus?.(core)) return;
    for (const p of strategy.promises.filter(p => active(p, core.turn) && p.contract.targetCityId)) {
      const id = `coalition:${p.id}:${core.turn}`;
      if (d.plans.some(x => x.id === id) || d.plans.some(x => x.pactId === p.id && x.orderIds?.some(id => {
        const o = (armies.orders || []).find(o => o.id === id), a = armies.armies?.[o?.armyId];
        return o && !["failed","superseded"].includes(o.status) && a?.currentOrderId === id && ["marching","engaged","besieging"].includes(a.status);
      }))) continue;
      // An occupied common objective is a completed operation, not a new attack.
      if (p.contract.operation === "attack" && p.contract.parties.some(owner => allied(owner, strategy.cities[p.contract.targetCityId]?.controller, strategy, core.turn))) continue;
      const members = p.contract.parties.map((owner, i) => {
        const army = Object.values(armies.armies || {}).filter(a => a.owner === owner && a.status !== "destroyed" && a.troops >= 500)
          .sort((a,b) => Number(window.XianLordIntentions.activeOrder(a, armies.orders)) - Number(window.XianLordIntentions.activeOrder(b, armies.orders)) || a.id.localeCompare(b.id))[0];
        const target = p.contract.targetCityId, routeIds = army ? window.XianStrategyNetwork.findRoutePath(army.cityId, target) : [];
        return { id: `${id}:${owner}`, source: "coalition", sourceAllianceId: p.id, sourceCoalitionPlanId: id, coalitionRole: i ? "support" : "leader",
          owner, ownerName: name(owner), armyId: army?.id || null, armyName: army ? window.XIAN_ARMY_DATA.armies.find(a => a.id === army.id)?.name || name(owner) + "军" : "无完整军团",
          turn: core.turn, dueTurn: core.turn, originCityId: army?.cityId || null, targetCityId: target, targetName: p.contract.targetName,
          targetOwner: strategy.cities[target]?.controller, task: p.contract.operation === "defend" ? "defend" : i ? "support" : "attack",
          routeIds, priority: 500 - i, status: "proposed", reason: i ? "盟军分路护援，抵达同城后协战" : "按盟约共同目标主攻；城池由实际主攻方接管" };
      });
      d.plans.push({ id, pactId: p.id, turn: core.turn, targetCityId: p.contract.targetCityId, leaderOwner: p.contract.leaderOwner,
        status: "proposed", members, orderIds: [], lastChange: `0/${members.length}镇已实际接令；${members.map(m=>`${m.ownerName}：待答复`).join("；")}` });
      strategy.commandChain.intents.push(...members);
    }
  }
  function witnesses(strategy, turn, attacker, defender) {
    return (strategy?.promises || []).filter(p => active(p, turn) && p.contract.parties.includes(attacker) && p.contract.parties.includes(defender)
      && attacker !== defender).map(p => ({ pactId: p.id, parties: [...p.contract.parties] }));
  }
  function reconcile(strategy, armies, core) {
    const d = strategy.allianceDiplomacy, closed = new Set();
    for (const plan of d.plans) {
      const intents = strategy.commandChain.intents.filter(i => i.sourceCoalitionPlanId === plan.id);
      for (const m of plan.members) { const current = intents.find(i => i.id === m.id); if (current) Object.assign(m, current); }
      plan.orderIds = [...new Set([...plan.orderIds, ...plan.members.map(m => m.orderId).filter(Boolean)])];
      const accepted = plan.members.filter(m => m.orderId), done = plan.members.every(m => !["proposed","requested"].includes(m.status));
      plan.status = accepted.length === plan.members.length ? "accepted" : accepted.length ? "partial" : done ? "refused" : "proposed";
      if (plan.members.every(m => m.status === "restrained")) plan.status = "restrained";
      plan.lastChange = `${accepted.length}/${plan.members.length}镇已实际接令；${plan.members.map(m => `${m.ownerName}：${m.responseReason || "待答复"}`).join("；")}`;
    }
    const events = (armies.militaryFacts || []).filter(f => !d.ignoredFactIds.includes(f.id)).map(f => ({ ...f, root: f.sourceOrderId || f.id,
      witnesses: f.allianceWitnesses || witnesses(strategy, f.turn, f.attackerOwner, f.defenderOwner) }));
    for (const conflict of armies.commandConflicts || []) {
      if (conflict.kind !== "replacement" || d.ignoredConflictIds.includes(conflict.id)) continue;
      const old = (armies.orders || []).find(o => o.id === conflict.previousOrderId);
      if (!old?.sourceAllianceId || (old.arrivedTurn != null && !conflict.unfulfilledCoalition) || !old.sourceCoalitionPlanId) continue;
      const p = strategy.promises.find(p => p.id === old.sourceAllianceId);
      if (!p || !formal(p) || p.contract.initialConflictIds.includes(conflict.id) || conflict.turn > p.deadlineTurn) continue;
      events.push({ id: conflict.id, kind: "coalition-withdrawal", turn: conflict.turn, attackerOwner: old.owner,
        defenderOwner: p.contract.parties.find(id => id !== old.owner), authority: "court", sourceOrderId: old.id,
        root: conflict.id, witnesses: [{ pactId: p.id, parties: [...p.contract.parties] }] });
    }
    for (const fact of events.sort((a,b) => a.turn - b.turn || a.id.localeCompare(b.id))) {
      const affected = fact.witnesses.map(w => strategy.promises.find(p => p.id === w.pactId))
        .filter(p => formal(p) && p.status === "active" && fact.turn >= p.createdTurn && fact.turn <= p.deadlineTurn && !p.contract.initialFactIds.includes(fact.id));
      if (!affected.length) continue;
      const id = `alliance-breach:${fact.attackerOwner}:${fact.root}`;
      let entry = d.consequences.find(c => c.id === id);
      if (!entry) {
        const before = Number(d.reputations[fact.attackerOwner] ?? 50), after = cap(before - 13);
        d.reputations[fact.attackerOwner] = after;
        entry = { id, turn: fact.turn, actor: fact.attackerOwner, actorName: name(fact.attackerOwner), kind: fact.kind,
          root: fact.root, sourceFactId: fact.id, sourceOrderId: fact.sourceOrderId || null, pactIds: [], victimOwners: [], trustChanges: [],
          responsibility: fact.authority === "court" ? "court" : "lord", reputationBefore: before, reputationAfter: after, reputationDelta: after - before };
        d.consequences.push(entry);
      }
      for (const p of affected) {
        if (!entry.pactIds.includes(p.id)) entry.pactIds.push(p.id);
        p.status = "broken"; p.progress = 0; closed.add(p.id);
        p.lastChange = `${name(fact.attackerOwner)}${fact.kind === "coalition-withdrawal" ? "撤换未抵达的联军军令" : "向盟方发起实际敌对行动"}，盟约破裂；守约信誉实际${entry.reputationDelta}`;
        p.contract.receipts.push({ id: `breach:${fact.id}`, kind: fact.kind, actor: fact.attackerOwner, turn: fact.turn, sourceFactId: fact.id, source: fact.root });
        const victim = fact.defenderOwner;
        if (victim && !entry.victimOwners.includes(victim)) {
          entry.victimOwners.push(victim); const trust = strategy.strategies[victim], before = Number(trust?.trust || 0);
          if (trust && entry.responsibility === "court") trust.trust = cap(before - 5);
          entry.trustChanges.push({ actor: victim, requested: entry.responsibility === "court" ? -5 : 0, actual: Number(trust?.trust || 0) - before });
        }
      }
      const observers = [...new Set((strategy.promises || []).filter(p => formal(p) && p.contract.startTurn <= fact.turn && fact.turn <= p.deadlineTurn
        && p.contract.parties.includes(fact.attackerOwner) && (p.status === "active" || entry.pactIds.includes(p.id))).flatMap(p => p.contract.parties))]
        .filter(actor => actor !== fact.attackerOwner && !entry.victimOwners.includes(actor));
      for (const actor of observers) {
        const rid = `alliance-warning:${actor}:${fact.root}`;
        if (d.reactions.some(r => r.id === rid)) continue;
        const aid = (strategy.commandChain.reactions || []).some(r => r.actor === actor && r.sourceOrderId === fact.sourceOrderId);
        const trust = strategy.strategies[actor], before = Number(trust?.trust || 0), requested = entry.responsibility === "court" && !aid ? -2 : 0;
        if (trust) trust.trust = cap(before + requested);
        d.reactions.push({ id: rid, actor, actorName: name(actor), turn: fact.turn, root: fact.root, sourceFactId: fact.id, sourceOrderId: fact.sourceOrderId,
          responsibility: entry.responsibility, requestedTrustDelta: requested, trustDelta: Number(trust?.trust || 0) - before, sharedAidWarning: aid });
      }
    }
    for (const p of strategy.promises.filter(p => active(p, Math.min(core.turn, p.deadlineTurn)))) {
      if (Number(armies.lastProcessedTurn || 0) <= p.deadlineTurn) continue;
      if (p.contract.missingHistoricalObservation) { p.status = "unverified"; p.lastChange = "旧档缺少完整盟约观察期，不补记履约或失信"; closed.add(p.id); continue; }
      p.status = "fulfilled"; p.progress = 100; closed.add(p.id);
      const changes = p.contract.parties.map(actor => { const trust = strategy.strategies[actor], before = Number(trust?.trust || 0), rep = Number(d.reputations[actor] ?? 50);
        const receiptId = `alliance-peace:${actor}:${p.deadlineTurn}`, paid = d.peaceRewards.includes(receiptId);
        if (!paid) { if (trust) trust.trust = cap(before + 4); d.reputations[actor] = cap(rep + 3); d.peaceRewards.push(receiptId); }
        else d.reputations[actor] = rep;
        return { actor, trustDelta: Number(trust?.trust || 0) - before, reputationDelta: d.reputations[actor] - rep }; });
      p.contract.receipts.push({ id: `observed:${p.id}`, kind: "peace-observed", turn: p.deadlineTurn, changes });
      p.lastChange = "最后一月军事结算已完成，各方守约；信任至多+4、守约信誉至多+3。军事目标另凭实际战果判断";
    }
    return [...closed];
  }
  window.XianAllianceDiplomacy = Object.freeze({ explicit, formal, active, allied, migrate, offer, create, propose, witnesses, reconcile, name });
})();
