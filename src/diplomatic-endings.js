/* Diplomatic conclusions use durable receipts, never national values alone. */
(() => {
  "use strict";
  const copy = value => JSON.parse(JSON.stringify(value));
  const unique = values => [...new Set(values)].sort();
  const formal = p => p?.type === "alliance" && p.contract?.treatyType === "alliance" && p.contract.version === 1;
  const consent = p => formal(p) && !p.contract.invalid && unique(p.contract.parties || []).length >= 2
    && unique(p.contract.parties || []).length <= 3 && Number.isInteger(p.contract.startTurn) && Number.isInteger(p.deadlineTurn)
    && p.contract.startTurn <= p.deadlineTurn && (p.contract.parties || []).every(actor =>
    p.contract.receipts?.some(r => r.kind === "consent" && r.actor === actor && r.status === "accepted"));
  const name = (id, core) => window.XianCharacterAvailability?.faction?.(id, core)?.name || id;
  const empty = () => ({ version: 1, pacts: [], operations: [], breaches: [], ceasefires: [] });
  function matching(value, core) { return value?.gameCreatedAt === core?.createdAt; }
  function context(core, supplied = {}) {
    const strategy = supplied.strategy || window.XianStrategyNetwork?.getState?.();
    const armies = supplied.armies || window.XianArmySystem?.getState?.();
    return { strategy: matching(strategy, core) ? strategy : {}, armies: matching(armies, core) ? armies : {} };
  }
  function put(list, value) {
    const index = list.findIndex(x => x.id === value.id);
    if (index < 0) list.push(value); else list[index] = value;
  }
  // This derives on a copy for previews. Only the explicit reconciliation writes it.
  function collect(core, strategy, armies) {
    const saved = strategy.allianceDiplomacy?.outcomeEvidence;
    const evidence = saved?.version === 1 ? copy(saved) : empty();
    for (const p of strategy.promises || []) {
      if (!consent(p)) continue;
      const c = p.contract, observed = !c.missingHistoricalObservation && c.receipts.some(r => r.kind === "peace-observed" && r.turn === p.deadlineTurn);
      put(evidence.pacts, { id: p.id, parties: unique(c.parties), startTurn: c.startTurn, deadlineTurn: p.deadlineTurn,
        status: p.status, observed: Boolean(observed && p.status === "fulfilled"), receiptId: observed ? `observed:${p.id}` : null });
    }
    for (const b of strategy.allianceDiplomacy?.consequences || []) {
      if (!b.id || !["court", "lord"].includes(b.responsibility) || !b.sourceFactId && !b.sourceOrderId) continue;
      put(evidence.breaches, { id: b.id, turn: b.turn, actor: b.actor, responsibility: b.responsibility,
        victims: unique(b.victimOwners || []), kind: b.kind, root: b.root, sourceFactId: b.sourceFactId || null, sourceOrderId: b.sourceOrderId || null });
    }
    const orders = new Map((armies.commandResponses || []).filter(r => r.status === "accepted" && r.order?.id).map(r => [r.order.id, r.order]));
    // An actual issued order is itself a durable acceptance; proposals are not.
    for (const o of armies.orders || []) if (o.sourceAllianceId && o.sourceCoalitionPlanId) orders.set(o.id, o);
    for (const f of armies.militaryFacts || []) {
      if (!["battle", "occupation"].includes(f.kind) || evidence.operations.some(o => o.id === f.id)) continue;
      const report = (armies.battleReports || []).find(r => r.id === f.source && r.turn === f.turn);
      const victor = f.victor ?? report?.victor;
      if (f.kind === "battle" && !victor) continue;
      // v2.28 occupations can be proved by a same-month physical siege receipt.
      const witness = f.kind === "occupation" ? (armies.militaryFacts || []).find(w => w.kind === "siege-progress" && w.turn === f.turn
        && w.cityId === f.cityId && w.sourceOrderId === f.sourceOrderId && w.participants?.length >= 2) : null;
      const side = f.kind === "occupation" || victor === f.attackerOwner ? "attacker" : "defender";
      const participants = (f.participants || witness?.participants || report?.participants || []).filter(p => p.side === side && p.troopsBefore > 0);
      const groups = new Map();
      for (const participant of participants) {
        const order = orders.get(participant.orderId), pact = evidence.pacts.find(p => p.id === order?.sourceAllianceId);
        if (!order?.sourceCoalitionPlanId || order.owner !== participant.owner || order.armyId !== participant.armyId || order.turn > f.turn
          || !pact || !pact.parties.includes(participant.owner) || pact.startTurn > f.turn || pact.deadlineTurn < f.turn) continue;
        const key = order.sourceCoalitionPlanId;
        if (!groups.has(key)) groups.set(key, { pact, participants: [] });
        groups.get(key).participants.push(participant);
      }
      for (const [planId, group] of groups) {
        const owners = unique(group.participants.map(p => p.owner));
        if (owners.length < 2) continue;
        put(evidence.operations, { id: f.id, kind: f.kind, turn: f.turn, cityId: f.cityId, routeId: f.routeId || null,
          pactId: group.pact.id, planId, owners, orderIds: unique(group.participants.map(p => p.orderId)),
          witnessIds: unique([f.id, ...(witness ? [witness.id] : [])]) });
        break;
      }
    }
    for (const p of strategy.promises || []) {
      if (p.type !== "ceasefire" || p.status !== "fulfilled" || p.contract?.missingHistoricalObservation
        || !p.contract?.receipts?.some(r => r.condition === "no-bilateral-hostile-facts-after-final-army-phase")) continue;
      const parties = p.contract.parties || [];
      const response = (armies.ceasefireResponses || []).find(r => r.turn === p.createdTurn && parties.every(id => r.parties.includes(id)));
      if (!response || Number(response.stopped) <= 0 || response.rejected?.length || unique(parties).length < 2) continue;
      put(evidence.ceasefires, { id: p.id, parties: unique(parties), startTurn: p.createdTurn, deadlineTurn: p.deadlineTurn,
        responseId: response.id, stoppedArmies: response.stopped });
    }
    for (const key of ["pacts", "operations", "breaches", "ceasefires"]) evidence[key].sort((a,b) => a.id.localeCompare(b.id));
    return evidence;
  }
  function reconcile(strategy, armies, core) {
    if (!core || core.ended || !matching(strategy, core) || !matching(armies, core) || !strategy.allianceDiplomacy) return;
    strategy.allianceDiplomacy.outcomeEvidence = collect(core, strategy, armies);
  }
  function preview(core, supplied) {
    if (!core || core.ended) return core?.diplomaticOutcome?.version === 1 ? copy(core.diplomaticOutcome) : null;
    const { strategy, armies } = context(core, supplied), evidence = collect(core, strategy, armies);
    const fulfilled = evidence.pacts.filter(p => p.observed), windows = unique(fulfilled.map(p => p.deadlineTurn));
    const trust = id => Number(strategy.strategies?.[id]?.trust || 0);
    const reputation = id => Number(strategy.allianceDiplomacy?.reputations?.[id] ?? 50);
    const relations = window.XianDiplomaticRelations?.summary(strategy,core) || null;
    const breaches = evidence.breaches.map(b => {
      const repaired = strategy.diplomaticRelations?.schemaVersion === 1 ? b.victims.length > 0 && b.victims.every(victim => strategy.diplomaticRelations.repairs.some(r=>r.breachId===b.id&&r.victim===victim)) : b.victims.length > 0 && b.victims.every(victim => unique(fulfilled.filter(p => p.startTurn > b.turn
        && p.parties.includes(b.actor) && p.parties.includes(victim)).map(p => p.deadlineTurn)).length >= 2 && trust(victim) >= 60) && reputation(b.actor) >= 40;
      return { ...b, repaired };
    });
    const unresolved = breaches.filter(b => !b.repaired), court = unresolved.filter(b => b.responsibility === "court");
    const unreliable = new Set(unresolved.map(b => b.actor));
    const lastSettled = Math.min(core.turn, Number(armies.lastProcessedTurn || 0) - 1);
    const current = (strategy.promises || []).filter(p => consent(p) && (p.status === "active" || p.status === "fulfilled"
      && evidence.pacts.some(e => e.id === p.id && e.observed)) && !p.contract.missingHistoricalObservation
      && p.contract.startTurn <= core.turn && p.deadlineTurn >= core.turn && lastSettled - p.contract.startTurn + 1 >= 2
      && Number(armies.militaryFactsStartTurn || Infinity) <= p.contract.startTurn);
    const supporters = unique(current.flatMap(p => p.contract.parties)).filter(id => trust(id) >= 50 && reputation(id) >= 40 && !unreliable.has(id));
    const supported = new Set(supporters);
    const operations = evidence.operations.filter(o => o.owners.filter(id => supported.has(id)).length >= 2
      && fulfilled.some(p => o.owners.every(id => p.parties.includes(id))));
    const peace = supporters.length >= 3 && current.some(p => {
      const parties = p.contract.parties.filter(id => supported.has(id));
      return parties.length >= 3 && unique(fulfilled.filter(f => parties.every(id => f.parties.includes(id))).map(f => f.deadlineTurn)).length >= 2;
    });
    const route = operations.length ? "joint-success" : peace ? "sustained-peace" : null;
    const reasons = [];
    if (court.length) reasons.push(`朝廷授意的背盟尚有${court.length}宗未修复`);
    if (!fulfilled.length) reasons.push("缺少完整观察至期满的正式盟约");
    if (supporters.length < 2) reasons.push("尚无至少两镇持续两个月的可信在约支持");
    if (!route) reasons.push("尚无可信盟方共同战果，也未形成三镇两期守约的和平共奉");
    const eligible = !reasons.length;
    const ceasefires = evidence.ceasefires.filter(p => p.parties.every(id => trust(id) >= 50 && !unreliable.has(id))
      && !(strategy.diplomaticRelations?.hostilities||[]).some(f=>f.turn>p.deadlineTurn&&p.parties.includes(f.attackerOwner)&&p.parties.includes(f.defenderOwner)));
    const mediator = !court.length && (fulfilled.length > 0 && supporters.length >= 2 || ceasefires.length > 0 || relations?.currentPeaceSettlements > 0);
    const unknown = (strategy.promises || []).filter(p => p.status === "unverified" || formal(p) && p.status === "fulfilled" && !evidence.pacts.find(e => e.id === p.id)?.observed).length;
    const coverage = !matching(strategy, core) || !matching(armies, core) ? "missing" : unknown ? "partial" : "complete";
    const counts = { fulfilledAlliances: fulfilled.length, fulfilledWindows: windows.length, reliableSupporters: supporters.length,
      jointVictories: evidence.operations.length, jointCaptures: evidence.operations.filter(o => o.kind === "occupation").length,
      qualifyingJointVictories: operations.length, courtBreaches: breaches.filter(b => b.responsibility === "court").length,
      unresolvedCourtBreaches: court.length, lordBreaches: breaches.filter(b => b.responsibility === "lord").length,
      unresolvedLordBreaches: unresolved.filter(b => b.responsibility === "lord").length, repairedBreaches: breaches.filter(b => b.repaired).length,
      observedCeasefires: evidence.ceasefires.length, unverifiedAgreements: unknown, peaceSettlements: relations?.peaceSettlements||0,
      currentPeaceSettlements:relations?.currentPeaceSettlements||0,brokenPeaceSettlements:relations?.brokenPeaceSettlements||0,reconciliationMissions:relations?.reconciliationMissions||0 };
    let rating = Math.min(35, windows.length * 10 + supporters.length * 5 + (relations?.currentPeaceSettlements||0)*10) + (route === "joint-success" ? 30 : peace ? 25 : 0)
      + Math.max(0, 35 - court.length * 20 - unresolved.filter(b => b.responsibility === "lord").length * 5);
    if (court.length) rating = Math.min(40, rating);
    return { version: 1, rulesVersion: 230, gameCreatedAt: core.createdAt, turn: core.turn, coverage, counts, relations,
      rating: coverage === "missing" ? null : rating, confederationRoute: route,
      supporters: supporters.map(id => ({ id, name: name(id, core), trust: trust(id), reputation: reputation(id) })),
      breaches: breaches.map(b => ({ ...b, actorName: name(b.actor, core), victimNames: b.victims.map(id => name(id, core)) })),
      eligibility: { confederation: { eligible, reasons }, mediation: { eligible: mediator,
        reasons: mediator ? [] : [court.length ? "朝廷背盟责任尚未修复" : "缺少可信在约支持或实际止战并履行至期满的凭据"] } },
      evidenceDetails: {
        pacts: fulfilled.map(p => ({ id: p.id, parties: p.parties.map(id => name(id, core)), startTurn: p.startTurn, deadlineTurn: p.deadlineTurn })),
        operations: evidence.operations.map(o => ({ id: o.id, kind: o.kind, turn: o.turn, parties: o.owners.map(id => name(id, core)),
          place: window.XIAN_STRATEGY_DATA?.cities?.find(c => c.id === o.cityId)?.name || "军路" })),
        ceasefires: evidence.ceasefires.map(p => ({ id: p.id, parties: p.parties.map(id => name(id, core)), deadlineTurn: p.deadlineTurn, stoppedArmies: p.stoppedArmies })) },
      sourceEvidence: { pactIds: fulfilled.map(p => p.id), operationIds: evidence.operations.map(o => o.id),
        breachIds: breaches.map(b => b.id), ceasefireIds: evidence.ceasefires.map(p => p.id),peaceIds:relations?.peaceIds||[],reconciliationIds:relations?.reconciliationIds||[],repairIds:relations?.repairIds||[] } };
  }
  function resolve(ending, outcome, core) {
    if (!outcome || !["诸侯共奉", "天下共奉", "帝国调停者"].includes(ending.title)) return ending;
    const confederation = ending.title !== "帝国调停者", gate = confederation ? outcome.eligibility.confederation : outcome.eligibility.mediation;
    if (gate.eligible) return { ...ending, text: `${outcome.supporters.map(p => p.name).join("、") || "实际止战的各镇"}留下了可核验的外交承接。${text(outcome)}${confederation ? "朝廷凭这些履行与支持取得共奉之势，诸镇仍各有军政权力。" : "朝廷的调停已有实际承接，乱世因此恢复了有限秩序。"}` };
    if (outcome.counts.unresolvedCourtBreaches) return { title: "盟约离心", text: `朝廷仍有名望，却不能以新签一纸盟书抵销旧日背盟。${text(outcome)}受害各镇尚未以两期守约重建信任，共奉之势未成。` };
    if (confederation && outcome.eligibility.mediation.eligible && core.stats.officials >= 68 && core.stats.prestige >= 70 && core.hidden.peopleStability >= 62)
      return resolve({ title: "帝国调停者" }, outcome, core);
    return { title: confederation ? "合纵未固" : "朝纲渐复", text: `${confederation ? "朝廷以声望联络外镇，但共同秩序尚未坐实。" : "百官与民生渐复，诸镇接受调停的实证仍不足。"}${gate.reasons.join("；")}。${text(outcome)}` };
  }
  function text(value) {
    if (!value) return "旧档保留原结局，未按新规则追认外交事实。";
    const c = value.counts;
    return `盟约履行${c.fulfilledAlliances}份／${c.fulfilledWindows}期，可信在约支持${c.reliableSupporters}镇；联军实绩${c.jointVictories}次（共同攻城${c.jointCaptures}次）；朝廷背盟${c.courtBreaches}宗（未修复${c.unresolvedCourtBreaches}），诸侯自主背盟${c.lordBreaches}宗，修复${c.repairedBreaches}宗；实际止战履约${c.observedCeasefires}份。${value.relations?`战后和约履行${c.peaceSettlements}份（当前有效${c.currentPeaceSettlements}），破约${c.brokenPeaceSettlements}份；修好使节获承接${c.reconciliationMissions}次。`:""}${value.coverage !== "complete" ? "部分历史凭据不足，未补记功过。" : ""}`;
  }
  const escape = value => String(value).replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
  function render(value, frozen = false) {
    if (!value) return "";
    const details = value.evidenceDetails || {}, receipts = [
      ...(details.pacts || []).map(p => `第${p.startTurn}—${p.deadlineTurn}月 · ${p.parties.join("、")}完整守约`),
      ...(details.operations || []).map(o => `第${o.turn}月 · ${o.parties.join("、")}在${o.place}${o.kind === "occupation" ? "共同攻取城池" : "共同战胜对手"}`),
      ...(details.ceasefires || []).map(p => `${p.parties.join("、")}实际停止${p.stoppedArmies}支进攻军团，履约至第${p.deadlineTurn}月`),
    ];
    return `<section class="diplomatic-outcome" data-diplomatic-outcome="${frozen ? "frozen" : "preview"}"><h3>${frozen ? "外交终局依据" : "外交终局核验"}</h3><p>${escape(text(value))}</p><p>${value.eligibility.confederation.eligible ? `共奉实证已满足 · ${value.confederationRoute === "sustained-peace" ? "三镇两期守约" : "联军实绩与守约"}` : escape(value.eligibility.confederation.reasons.join("；"))}</p><p>可信在约各镇：${escape(value.supporters.map(p => p.name).join("、") || "尚未形成")}。另须满足国势与相应方略条件。</p><details><summary>查看履约、战果与背盟凭据</summary>${receipts.map(r => `<p>${escape(r)}</p>`).join("") || "<p>尚无已确认履约或战果。</p>"}${(value.relations?.pairs||[]).map(p=>`<p>${escape(p.names.join(" ↔ "))} · 双方互信${p.trust}，旧怨${p.grievance}</p>`).join("")}${value.breaches.map(b => `<p>第${b.turn}月 · ${escape(b.actorName)} · ${b.responsibility === "court" ? "朝廷授意" : "诸侯自主"} · ${b.repaired ? "两期守约后修复，历史保留" : "尚未修复"}</p>`).join("")}</details></section>`;
  }
  window.XianDiplomaticEndings = Object.freeze({ preview, reconcile, resolve, render, text });
})();
