/* 天子蒙尘 v2.11.0：群臣对策 */
(() => {
  "use strict";
  const VERSION = "2.11.0";
  const STORAGE_KEY = "xian_emperor_council_advice_v2110";
  const SPEAKERS = {
    yang_biao: { name: "杨彪", title: "太尉", stance: "守制", keywords: ["朝会", "任免", "冗费", "礼制"], package: { effects: { officials: 2, treasury: -1 }, relations: { yang_biao: 3 } } },
    xun_yu: { name: "荀彧", title: "侍中", stance: "经略", keywords: ["贡赋", "赈济", "巡抚", "军"], package: { effects: { authority: 1, officials: 1 }, relations: { xun_yu: 3 } } },
    cao_cao: { name: "曹操", title: "司空", stance: "权宜", keywords: ["安抚", "借调", "出征", "宿卫"], package: { effects: { security: 2, authority: -1, caoAlert: -2 }, relations: { cao_cao: 3 } } },
    dong_cheng: { name: "董承", title: "车骑将军", stance: "进取", keywords: ["密令", "军", "宿卫", "外镇"], package: { effects: { authority: 2, caoAlert: 2 }, hidden: { loyalNetwork: 2 }, relations: { dong_cheng: 3 } } },
    empress_fu: { name: "伏皇后", title: "皇后", stance: "持重", keywords: ["宫禁", "召见", "赈济", "安抚"], package: { effects: { security: 2 }, hidden: { leakRisk: -1 }, relations: { empress_fu: 3 } } },
    liu_biao: { name: "刘表", title: "荆州牧", stance: "外援", keywords: ["外镇", "贡赋", "减赋", "遣使"], package: { effects: { prestige: 2, caoAlert: 1 }, hidden: { externalBalance: 2 }, relations: { liu_biao: 3 } } },
  };
  const ADVISER_SETS = {
    restore_treasury: ["yang_biao", "xun_yu", "cao_cao"],
    steady_court: ["yang_biao", "empress_fu", "cao_cao"],
    settle_people: ["xun_yu", "empress_fu", "liu_biao"],
    secure_palace: ["empress_fu", "cao_cao", "dong_cheng"],
    renew_mandate: ["yang_biao", "dong_cheng", "xun_yu"],
    turn_the_front: ["cao_cao", "dong_cheng", "liu_biao"],
  };
  const PROPOSALS = {
    restore_treasury: ["先核百司冗费，保住朝廷自己的度支。", "通漕运、清积欠，使钱粮从制度而来。", "请司空府暂济燃眉，再以政令换取时间。"],
    steady_court: ["重开朝会，以礼次约束争论。", "先调和可合作之臣，再办最急政务。", "权责归一，能办事比一时口舌更紧要。"],
    settle_people: ["先查仓粮与流民去处，救济必须落实。", "由内廷督问抚恤，不许文书空转。", "请州郡分担安置，使朝廷诏意落到乡里。"],
    secure_palace: ["宫门名籍当由可信之人逐一复核。", "让司空府协助换防，先止眼前漏洞。", "另布心腹耳目，不能把宫禁全托于外府。"],
    renew_mandate: ["以朝仪、任官和成法重立中枢。", "名分须有敢行之人支撑，不可只存文书。", "先做成一两件实政，天下自然再看汉廷。"],
    turn_the_front: ["军令贵在统一，莫使诸军各行其是。", "选一处要害速战，胜势可以振奋忠汉。", "联络外镇共举汉旗，不必独担锋镝。"],
  };
  let state = loadState();

  document.addEventListener("DOMContentLoaded", sync);
  document.addEventListener("xian:quarterly-agenda-updated", sync);
  document.addEventListener("xian:quarterly-panel-rendered", render);
  document.addEventListener("xian:external-action-completed", event => rewardAlignedAction(event.detail || {}));
  document.addEventListener("xian:decision-resolved", event => rewardAlignedAction(event.detail || {}));

  function blankState() { return { version: 1, gameCreatedAt: null, cycle: 0, agendaId: null, chosen: null, processed: [], history: [] }; }
  function loadState() { try { const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); return { ...blankState(), ...(value || {}) }; } catch (_) { return blankState(); } }
  function saveState() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {} render(); }
  function coreState() { return window.XianEmperorGame?.getState?.() || null; }
  function agendaState() { return window.XianQuarterlyAgenda?.getState?.() || null; }

  function sync() {
    const core = coreState();
    const agenda = agendaState();
    if (!core || core.ended) return render();
    if (state.gameCreatedAt !== core.createdAt) { state = blankState(); state.gameCreatedAt = core.createdAt; }
    if (agenda?.active && (state.cycle !== agenda.cycle || state.agendaId !== agenda.active.id)) {
      state.cycle = agenda.cycle;
      state.agendaId = agenda.active.id;
      state.chosen = null;
      state.processed = [];
      saveState();
      return;
    }
    render();
  }

  function buildAdvice(core = coreState(), agendaId = state.agendaId) {
    const ids = ADVISER_SETS[agendaId] || ADVISER_SETS.steady_court;
    const proposals = PROPOSALS[agendaId] || PROPOSALS.steady_court;
    const memories = window.XianCharacterMemory?.getState?.()?.memories || [];
    return ids.map((id, index) => {
      const speaker = SPEAKERS[id];
      const relation = Number(core?.relations?.[id] ?? 50);
      const remembered = memories.filter(item => item.characterId === id && (!item.gameCreatedAt || item.gameCreatedAt === core?.createdAt)).length;
      return {
        id, ...speaker, proposal: proposals[index], relation, remembered,
        trust: relation >= 70 ? "愿以身任事" : relation >= 48 ? "愿意进言" : "仍有保留",
      };
    });
  }

  function chooseAdvice(id) {
    const core = coreState();
    const adviser = buildAdvice(core).find(item => item.id === id);
    if (!core || !adviser || state.chosen) return false;
    state.chosen = { id, turn: core.turn, proposal: adviser.proposal, alignedActions: 0 };
    state.history.unshift({ cycle: state.cycle, agendaId: state.agendaId, adviserId: id, adviserName: adviser.name, proposal: adviser.proposal });
    state.history = state.history.slice(0, 12);
    saveState();
    window.XianQuarterlyAgenda?.addContribution?.(18, `采纳${adviser.name}的${adviser.stance}之策`);
    window.XianEmperorGame?.applyExternalPackage?.({
      ...adviser.package,
      causal: false,
      report: { title: `群臣对策·${adviser.name}`, text: `天子采纳${adviser.name}所陈：“${adviser.proposal}”此后三月，循此方略办事将更易推进御题。`, type: "decision" },
      chronicle: `天子采纳${adviser.name}之策，以办三月御题。`,
    });
    return true;
  }

  function rewardAlignedAction(detail) {
    if (!state.chosen || !state.agendaId) return;
    const core = coreState();
    if (!core || detail.createdAt && detail.createdAt !== core.createdAt) return;
    const adviser = SPEAKERS[state.chosen.id];
    const id = detail.id || `${detail.eventId || "decision"}-${detail.turn || core.turn}`;
    if (!adviser || state.processed.includes(id)) return;
    const text = `${detail.title || detail.eventTitle || ""} ${detail.text || detail.choiceLabel || ""}`;
    if (!adviser.keywords.some(keyword => text.includes(keyword))) return;
    state.processed.push(id);
    state.processed = state.processed.slice(-16);
    state.chosen.alignedActions += 1;
    saveState();
    window.XianQuarterlyAgenda?.addContribution?.(10, `依${adviser.name}对策施行政务`);
  }

  function render() {
    const slot = document.getElementById("imperial-advice-slot");
    const agenda = agendaState();
    if (!slot) return;
    if (!agenda?.active || !state.agendaId) { slot.innerHTML = ""; return; }
    const advisers = buildAdvice();
    if (state.chosen) {
      const adviser = advisers.find(item => item.id === state.chosen.id) || SPEAKERS[state.chosen.id];
      slot.innerHTML = `<section class="council-chosen"><div><span>本季主议</span><strong>${esc(adviser.name)} · ${esc(adviser.stance)}</strong></div><p>“${esc(state.chosen.proposal)}”</p><small>已循此策推进 ${state.chosen.alignedActions || 0} 次；匹配的裁决或行动将获得额外进度。</small></section>`;
      return;
    }
    slot.innerHTML = `<section class="council-advice"><header><div><span>群臣对策</span><strong>三人三策，只采纳一议</strong></div><small>不消耗行动</small></header><div>${advisers.map(item => `<button type="button" data-adviser-id="${item.id}"><span>${esc(item.title)} · ${esc(item.stance)}</span><strong>${esc(item.name)}</strong><p>“${esc(item.proposal)}”</p><small>关系 ${Math.round(item.relation)} · ${item.trust}${item.remembered ? ` · 记得 ${item.remembered} 件旧事` : ""}</small><b>采纳此议</b></button>`).join("")}</div></section>`;
    slot.querySelectorAll("[data-adviser-id]").forEach(button => button.addEventListener("click", () => chooseAdvice(button.dataset.adviserId)));
  }

  function getState() { return JSON.parse(JSON.stringify(state)); }
  function esc(value) { return String(value ?? "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char])); }
  window.XianCouncilAdvice = Object.freeze({ version: VERSION, speakers: { ...SPEAKERS }, buildAdvice, chooseAdvice, getState });
})();
