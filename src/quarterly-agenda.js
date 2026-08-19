/* 天子蒙尘 v2.10.0：三月朝局 */
(() => {
  "use strict";

  const VERSION = "2.10.0";
  const STORAGE_KEY = "xian_emperor_quarterly_agenda_v2100";
  const MAX_HISTORY = 12;
  let state = loadState();
  let lastCoreSignature = "";

  const AGENDAS = [
    {
      id: "restore_treasury", title: "度支有继", seal: "帑", category: "财政",
      summary: "三月内补足朝廷用度，同时避免以过重征敛换取短期数字。",
      metric: "treasury", delta: 12, actions: ["筹措", "贡赋", "冗费", "赈济"],
      success: { effects: { treasury: 3, officials: 1 } },
      failure: { effects: { treasury: -2, officials: -2 }, hidden: { peopleStability: -1 } },
    },
    {
      id: "steady_court", title: "朝议归一", seal: "议", category: "朝堂",
      summary: "修补百官支持，让派系争执重新回到可以执行政令的范围。",
      metric: "officials", delta: 10, actions: ["召见", "封赏", "朝会", "经筵"],
      success: { effects: { officials: 3, authority: 2 } },
      failure: { effects: { officials: -3, authority: -1 } },
    },
    {
      id: "settle_people", title: "安集黎庶", seal: "民", category: "民生",
      summary: "压低流民与征敛造成的地方压力，让民间重新相信朝廷诏令。",
      metric: "peopleStability", delta: 12, actions: ["赈济", "减赋", "开仓", "巡抚"],
      success: { effects: { prestige: 3 }, hidden: { peopleStability: 3 } },
      failure: { effects: { prestige: -2 }, hidden: { peopleStability: -3 } },
    },
    {
      id: "secure_palace", title: "清宁宫禁", seal: "禁", category: "宫禁",
      summary: "整顿宿卫并压低泄密风险，给接下来的政治行动留出安全余地。",
      metric: "security", delta: 10, secondary: "leakRisk", secondaryDirection: -1, actions: ["安抚", "宫禁", "宿卫", "召见"],
      success: { effects: { security: 3, caoAlert: -2 } },
      failure: { effects: { security: -3, caoAlert: 2 }, hidden: { leakRisk: 2 } },
    },
    {
      id: "renew_mandate", title: "重申汉命", seal: "诏", category: "皇权",
      summary: "以礼制与有效政令恢复天子的制度存在，而不是只追逐一次性威望。",
      metric: "authority", delta: 10, secondary: "prestige", secondaryDirection: 1, actions: ["朝仪", "宗庙", "圣旨", "任免"],
      success: { effects: { authority: 3, prestige: 2, caoAlert: 1 } },
      failure: { effects: { authority: -2, prestige: -1 } },
    },
    {
      id: "turn_the_front", title: "转危为战", seal: "军", category: "军略",
      summary: "在三个月内取得一次对朝廷有利的战果，或实质改善军团态势。",
      metric: "courtVictories", delta: 1, actions: ["军", "出征", "监军", "攻城"],
      success: { effects: { prestige: 3, authority: 1 }, hidden: { externalBalance: 2 } },
      failure: { effects: { prestige: -2, treasury: -1 } },
    },
  ];

  document.addEventListener("DOMContentLoaded", init);
  document.addEventListener("xian:core-saved", sync);
  document.addEventListener("xian:decision-resolved", event => recordContribution(event.detail || {}, "decision"));
  document.addEventListener("xian:external-action-completed", event => recordContribution(event.detail || {}, "action"));
  document.addEventListener("xian:battle-report", event => recordContribution(event.detail || {}, "battle"));
  document.addEventListener("xian:city-captured", event => recordContribution(event.detail || {}, "capture"));
  document.addEventListener("xian:before-month-end", settleIfDue);

  function init() {
    document.getElementById("quarterly-agenda-panel")?.addEventListener("click", handleClick);
    sync();
  }

  function blankState() {
    return {
      version: 1,
      gameCreatedAt: null,
      cycle: 0,
      active: null,
      offers: [],
      history: [],
      contribution: 0,
      contributionLog: [],
      cooldownUntilTurn: 0,
      updatedAt: null,
    };
  }

  function normalize(value) {
    const base = blankState();
    const current = value && typeof value === "object" ? value : {};
    return {
      ...base,
      ...current,
      offers: Array.isArray(current.offers) ? current.offers.slice(0, 3) : [],
      history: Array.isArray(current.history) ? current.history.slice(0, MAX_HISTORY) : [],
      contributionLog: Array.isArray(current.contributionLog) ? current.contributionLog.slice(0, 8) : [],
    };
  }

  function loadState() {
    try { return normalize(JSON.parse(localStorage.getItem(STORAGE_KEY) || "null")); }
    catch (_) { return blankState(); }
  }

  function saveState(notify = true) {
    state.updatedAt = new Date().toISOString();
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {}
    render();
    if (notify) document.dispatchEvent(new CustomEvent("xian:quarterly-agenda-updated", { detail: getState() }));
  }

  function coreState() { return window.XianEmperorGame?.getState?.() || null; }

  function sync() {
    const core = coreState();
    if (!core || core.ended) return render();
    if (state.gameCreatedAt !== core.createdAt) {
      state = blankState();
      state.gameCreatedAt = core.createdAt;
    }
    const signature = `${core.createdAt}-${core.turn}-${core.eventResolved}-${state.active?.id || "none"}-${state.cycle}`;
    if (!state.active && !state.offers.length && Number(core.turn || 1) >= Number(state.cooldownUntilTurn || 0)) {
      state.offers = buildOffers(core).map(item => item.id);
      saveState();
    } else if (signature !== lastCoreSignature) {
      lastCoreSignature = signature;
      render();
    }
  }

  function buildOffers(core) {
    const causes = core.causality?.metrics || {};
    const values = {
      restore_treasury: 100 - Number(core.stats?.treasury || 0),
      steady_court: 100 - Number(core.stats?.officials || 0),
      settle_people: 100 - Number(core.hidden?.peopleStability || 0),
      secure_palace: (100 - Number(core.stats?.security || 0)) + Number(core.hidden?.leakRisk || 0) * .5,
      renew_mandate: (100 - Number(core.stats?.authority || 0)) * .7 + (100 - Number(core.stats?.prestige || 0)) * .3,
      turn_the_front: 42 + Math.max(0, Number(causes.courtDefeats || 0) - Number(causes.courtVictories || 0)) * 12,
    };
    return [...AGENDAS].sort((a, b) => values[b.id] - values[a.id]).slice(0, 3);
  }

  function selectAgenda(id) {
    const core = coreState();
    const agenda = AGENDAS.find(item => item.id === id);
    if (!core || core.ended || state.active || !state.offers.includes(id) || !agenda) return false;
    state.cycle += 1;
    state.active = {
      id,
      startTurn: core.turn,
      endTurn: Math.min(core.maxTurns, core.turn + 2),
      baseline: readMetric(core, agenda.metric),
      secondaryBaseline: agenda.secondary ? readMetric(core, agenda.secondary) : null,
      startedAt: new Date().toISOString(),
    };
    state.offers = [];
    state.contribution = 0;
    state.contributionLog = [];
    saveState();
    return true;
  }

  function recordContribution(detail, kind) {
    const core = coreState();
    const agenda = getActiveAgenda();
    if (!core || !agenda || detail.createdAt && detail.createdAt !== core.createdAt) return;
    const text = `${detail.title || detail.eventTitle || ""} ${detail.text || detail.choiceLabel || ""}`;
    const packageKeys = [...Object.keys(detail.effects || {}), ...Object.keys(detail.hidden || {})];
    let points = 0;
    if (agenda.actions.some(keyword => text.includes(keyword))) points += kind === "action" ? 24 : 16;
    if (packageKeys.includes(agenda.metric)) points += 12;
    if (agenda.secondary && packageKeys.includes(agenda.secondary)) points += 6;
    if (agenda.id === "turn_the_front" && kind === "battle") points += detail.winner === "court" || detail.courtVictory ? 55 : 10;
    if (agenda.id === "turn_the_front" && kind === "capture") points += detail.newOwner === "court" || detail.taken ? 60 : 0;
    if (!points) return;
    state.contribution = clamp(Number(state.contribution || 0) + points, 0, 100);
    state.contributionLog.unshift({ turn: core.turn, text: detail.title || detail.eventTitle || "一项相关处分", points });
    state.contributionLog = state.contributionLog.slice(0, 8);
    saveState();
  }

  function addContribution(points, text = "群臣对策推动御题") {
    const core = coreState();
    if (!core || !getActiveAgenda() || !state.active || !Number(points)) return false;
    state.contribution = clamp(Number(state.contribution || 0) + Number(points), 0, 100);
    state.contributionLog.unshift({ turn: core.turn, text: String(text), points: Number(points) });
    state.contributionLog = state.contributionLog.slice(0, 8);
    saveState();
    return true;
  }

  function calculateProgress(core = coreState(), agenda = getActiveAgenda()) {
    if (!core || !agenda || !state.active) return 0;
    const current = readMetric(core, agenda.metric);
    const change = (current - Number(state.active.baseline || 0)) * (agenda.metric === "courtVictories" ? 100 : (100 / agenda.delta));
    let secondary = 0;
    if (agenda.secondary) {
      const secondaryChange = (readMetric(core, agenda.secondary) - Number(state.active.secondaryBaseline || 0)) * Number(agenda.secondaryDirection || 1);
      secondary = secondaryChange * 5;
    }
    return clamp(Math.max(Number(state.contribution || 0), change + secondary), 0, 100);
  }

  function settleIfDue(event) {
    const core = coreState();
    const agenda = getActiveAgenda();
    if (!core || !agenda || !state.active || event.detail?.createdAt && event.detail.createdAt !== core.createdAt) return;
    if (Number(core.turn || 0) < Number(state.active.endTurn || Infinity)) return;
    const progress = calculateProgress(core, agenda);
    const success = progress >= 100;
    const record = {
      cycle: state.cycle,
      agendaId: agenda.id,
      title: agenda.title,
      success,
      progress: Math.round(progress),
      startTurn: state.active.startTurn,
      endTurn: core.turn,
      result: success ? "三月施政有成，朝廷上下看见了连续政令的作用。" : "三月之期已尽，此事未能办成，并留下了需要继续承担的缺口。",
    };
    state.history.unshift(record);
    state.history = state.history.slice(0, MAX_HISTORY);
    state.active = null;
    state.contribution = 0;
    state.contributionLog = [];
    state.cooldownUntilTurn = Number(core.turn || 0) + 1;
    saveState();
    window.XianEmperorGame?.applyExternalPackage?.({
      ...(success ? agenda.success : agenda.failure),
      causal: false,
      report: {
        title: `三月朝局·${success ? "有成" : "未竟"}`,
        text: `${agenda.title}${success ? "如期完成" : "未能如期完成"}。${record.result}`,
        type: success ? "decision" : "danger",
      },
      chronicle: `三月御题“${agenda.title}”${success ? "告成" : "未竟"}。`,
    });
  }

  function getActiveAgenda() { return AGENDAS.find(item => item.id === state.active?.id) || null; }

  function readMetric(core, key) {
    if (key in (core.stats || {})) return Number(core.stats[key] || 0);
    if (key in (core.hidden || {})) return Number(core.hidden[key] || 0);
    if (key in (core.causality?.metrics || {})) return Number(core.causality.metrics[key] || 0);
    return 0;
  }

  function render() {
    const root = document.getElementById("quarterly-agenda-panel");
    const core = coreState();
    if (!root) return;
    if (!core || core.ended) {
      root.classList.add("hidden");
      root.innerHTML = "";
      return;
    }
    root.classList.remove("hidden");
    const agenda = getActiveAgenda();
    if (!agenda) return renderOffers(root);
    const progress = Math.round(calculateProgress(core, agenda));
    const remaining = Math.max(0, Number(state.active.endTurn || core.turn) - Number(core.turn || 0) + 1);
    const latest = state.contributionLog[0];
    root.innerHTML = `
      <header class="quarterly-head">
        <div><span class="section-kicker">第 ${state.cycle} 季 · 御前主线</span><h2>${esc(agenda.title)}</h2><p>${esc(agenda.summary)}</p></div>
        <div class="quarterly-seal" aria-hidden="true">${agenda.seal}</div>
      </header>
      <div class="quarterly-progress-row"><div><span>三月进度</span><strong>${progress}%</strong></div><span>尚余 ${remaining} 月</span></div>
      <div class="quarterly-track" role="progressbar" aria-label="${esc(agenda.title)}进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progress}"><span style="width:${progress}%"></span></div>
      <div class="quarterly-guidance"><strong>${progress >= 100 ? "本季目标已经达成" : buildGuidance(agenda)}</strong><span>${latest ? `最近推进：${esc(latest.text)} +${latest.points}` : "相关奏报、行动、战果都会推进目标。"}</span></div>
      <div id="imperial-advice-slot" class="imperial-extension-slot"></div>
      <div id="regional-echo-slot" class="imperial-extension-slot"></div>
      <div id="imperial-path-slot" class="imperial-extension-slot"></div>
      ${state.history.length ? `<button class="quarterly-history-button" type="button" data-quarterly-history>查看历季得失</button>` : ""}`;
    document.dispatchEvent(new CustomEvent("xian:quarterly-panel-rendered", { detail: getState() }));
  }

  function renderOffers(root) {
    const offers = state.offers.map(id => AGENDAS.find(item => item.id === id)).filter(Boolean);
    root.innerHTML = `
      <header class="quarterly-head"><div><span class="section-kicker">三月朝局 · 只择一事</span><h2>此季，陛下欲先办成何事？</h2><p>选择不会消耗行动。未来三个月的奏报、行动、人物与战事都会围绕此目标汇总。</p></div><div class="quarterly-seal" aria-hidden="true">策</div></header>
      <div class="quarterly-offers">${offers.map(item => `<button type="button" data-agenda-id="${item.id}"><span>${item.category}</span><strong>${esc(item.title)}</strong><small>${esc(item.summary)}</small><b>定为御题 →</b></button>`).join("")}</div>
      ${state.history.length ? `<button class="quarterly-history-button" type="button" data-quarterly-history>查看历季得失</button>` : ""}`;
  }

  function buildGuidance(agenda) {
    const map = {
      restore_treasury: "优先使用筹措钱粮，并避免新的大额支出。",
      steady_court: "召见、封赏或恢复朝会都能推动此事。",
      settle_people: "赈济、减赋与巡抚州郡最为直接。",
      secure_palace: "降低泄密与警戒，同时恢复宫廷安全。",
      renew_mandate: "礼制、任免与有效圣旨都能重申汉命。",
      turn_the_front: "取得战果、夺城或派出监军即可显著推进。",
    };
    return map[agenda.id] || "处理与目标相关的奏报和行动。";
  }

  function handleClick(event) {
    const choice = event.target.closest?.("[data-agenda-id]");
    if (choice) return selectAgenda(choice.dataset.agendaId);
    if (event.target.closest?.("[data-quarterly-history]")) showHistory();
  }

  function showHistory() {
    const prior = document.getElementById("quarterly-history-overlay");
    prior?.remove();
    const overlay = document.createElement("div");
    overlay.id = "quarterly-history-overlay";
    overlay.className = "quarterly-history-overlay";
    overlay.innerHTML = `<section role="dialog" aria-modal="true" aria-labelledby="quarterly-history-title"><header><div><span class="section-kicker">御前施政录</span><h2 id="quarterly-history-title">历季得失</h2></div><button type="button" data-close aria-label="关闭">×</button></header><div>${state.history.map(item => `<article class="${item.success ? "success" : "failure"}"><span>第 ${item.cycle} 季</span><div><strong>${esc(item.title)} · ${item.success ? "有成" : "未竟"}</strong><p>${esc(item.result)}</p></div><b>${item.progress}%</b></article>`).join("") || "<p>尚无结算记录。</p>"}</div></section>`;
    overlay.addEventListener("click", event => { if (event.target === overlay || event.target.closest?.("[data-close]")) overlay.remove(); });
    document.body.appendChild(overlay);
  }

  function getState() { return JSON.parse(JSON.stringify(state)); }
  function clamp(value, min, max) { return Math.min(max, Math.max(min, Number(value) || 0)); }
  function esc(value) { return String(value ?? "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char])); }

  window.XianQuarterlyAgenda = Object.freeze({
    version: VERSION,
    agendas: AGENDAS.map(item => ({ ...item })),
    buildOffers,
    calculateProgress,
    addContribution,
    selectAgenda,
    getState,
    refresh: sync,
  });
})();
