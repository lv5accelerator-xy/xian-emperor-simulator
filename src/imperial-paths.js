/* 天子蒙尘 v2.13.0：帝业殊途 */
(() => {
  "use strict";
  const VERSION = "2.13.0";
  const STORAGE_KEY = "xian_emperor_imperial_paths_v2130";
  const PATHS = [
    {
      id: "benevolent", title: "仁政存汉", seal: "仁", summary: "先让百姓重新相信朝廷，再以可持续的州郡秩序保存汉祚。",
      stages: [
        { id: "settle", title: "安集流民", label: "民间稳定达到 55" },
        { id: "trust", title: "政令取信", label: "完成至少两季三月御题" },
        { id: "lasting", title: "仁政成法", label: "民稳达到 65，并处理两次专属奏报" },
      ],
      rewards: [
        { effects: { prestige: 2 }, hidden: { peopleStability: 2 } },
        { effects: { officials: 2, treasury: 1 } },
        { effects: { prestige: 3, authority: 2 }, hidden: { peopleStability: 3 } },
      ],
    },
    {
      id: "restoration", title: "法统归政", seal: "汉", summary: "以百司、诏令和能被执行的制度，把天子的名分重新变成中枢权力。",
      stages: [
        { id: "offices", title: "百司可用", label: "百官支持达到 55" },
        { id: "mandate", title: "诏令有行", label: "皇权达到 55" },
        { id: "government", title: "中枢再造", label: "完成三季御题，并处理两次专属奏报" },
      ],
      rewards: [
        { effects: { officials: 2, authority: 1 } },
        { effects: { authority: 2, caoAlert: 1 } },
        { effects: { authority: 3, officials: 3, prestige: 1 } },
      ],
    },
    {
      id: "martial", title: "戎马中兴", seal: "武", summary: "让奉诏出师成为现实，以战果、新附城池与将士归属重建朝廷力量。",
      stages: [
        { id: "victory", title: "一战立名", label: "取得一次汉军胜利或新附城池" },
        { id: "foothold", title: "山河立足", label: "取得一座新附城池或参与三次战斗" },
        { id: "revival", title: "兵威归汉", label: "两次汉军胜利，并处理两次专属奏报" },
      ],
      rewards: [
        { effects: { prestige: 2, authority: 1 } },
        { effects: { treasury: 1, security: 2 } },
        { effects: { prestige: 3, authority: 2 }, hidden: { externalBalance: 2 } },
      ],
    },
  ];
  let state = loadState();
  let evaluating = false;

  document.addEventListener("DOMContentLoaded", sync);
  document.addEventListener("xian:core-saved", sync);
  document.addEventListener("xian:quarterly-agenda-updated", sync);
  document.addEventListener("xian:quarterly-panel-rendered", render);
  document.addEventListener("xian:decision-resolved", event => recordPathDecision(event.detail || {}));

  function blankState() { return { version: 1, gameCreatedAt: null, unlocked: false, offers: [], active: null, history: [] }; }
  function loadState() { try { const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); return { ...blankState(), ...(value || {}), offers: Array.isArray(value?.offers) ? value.offers : [], history: Array.isArray(value?.history) ? value.history : [] }; } catch (_) { return blankState(); } }
  function saveState(renderNow = true) { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {} if (renderNow) render(); }
  function coreState() { return window.XianEmperorGame?.getState?.() || null; }
  function quarterlyState() { return window.XianQuarterlyAgenda?.getState?.() || null; }
  function councilState() { return window.XianCouncilAdvice?.getState?.() || null; }

  function sync() {
    const core = coreState();
    if (!core || core.ended) return render();
    if (state.gameCreatedAt !== core.createdAt) { state = blankState(); state.gameCreatedAt = core.createdAt; }
    const quarters = quarterlyState()?.history || [];
    if (!state.unlocked && (quarters.length >= 2 || Number(core.turn || 0) >= 7)) {
      state.unlocked = true;
      state.offers = scorePaths(core, quarterlyState(), councilState()).map(item => item.id);
      saveState();
      return;
    }
    evaluateStage(core);
    render();
  }

  function scorePaths(core, quarterly = {}, council = {}) {
    const successes = (quarterly?.history || []).filter(item => item.success);
    const advisers = (council?.history || []).map(item => item.adviserId);
    const metrics = core?.causality?.metrics || {};
    const scores = {
      benevolent: Number(core?.hidden?.peopleStability || 0) * .7 + Number(core?.stats?.prestige || 0) * .25 + successes.filter(item => item.agendaId === "settle_people").length * 14 + advisers.filter(id => ["empress_fu", "xun_yu", "liu_biao"].includes(id)).length * 5,
      restoration: Number(core?.stats?.authority || 0) * .55 + Number(core?.stats?.officials || 0) * .4 + successes.length * 7 + advisers.filter(id => ["yang_biao", "xun_yu", "dong_cheng"].includes(id)).length * 5,
      martial: Number(core?.stats?.prestige || 0) * .35 + Number(metrics.courtVictories || 0) * 18 + Number(metrics.citiesTaken || 0) * 22 + advisers.filter(id => ["cao_cao", "dong_cheng", "liu_biao"].includes(id)).length * 5,
    };
    return PATHS.map(path => ({ ...path, score: Math.round(scores[path.id]), reason: suitabilityReason(path.id, core, successes, metrics) })).sort((a, b) => b.score - a.score);
  }

  function suitabilityReason(id, core, successes, metrics) {
    if (id === "benevolent") return `民稳 ${Math.round(core?.hidden?.peopleStability || 0)}，民生御题告成 ${successes.filter(item => item.agendaId === "settle_people").length} 季`;
    if (id === "restoration") return `皇权 ${Math.round(core?.stats?.authority || 0)}，百官 ${Math.round(core?.stats?.officials || 0)}，御题告成 ${successes.length} 季`;
    return `汉军胜绩 ${Number(metrics.courtVictories || 0)}，新附城池 ${Number(metrics.citiesTaken || 0)}`;
  }

  function choosePath(id) {
    const core = coreState();
    const path = PATHS.find(item => item.id === id);
    if (!core || !state.unlocked || state.active || !state.offers.includes(id) || !path) return false;
    state.active = { id, stage: 0, selectedTurn: core.turn, momentum: 0, seenEvents: [], lastEventTurn: 0, lastStageTurn: 0, completed: false };
    state.history.unshift({ turn: core.turn, type: "chosen", pathId: id, title: path.title, text: `天子选择“${path.title}”作为中期帝业。` });
    saveState();
    window.XianEmperorGame?.applyExternalPackage?.({ causal: false, report: { title: `帝业殊途·${path.title}`, text: `${path.summary} 此后专属奏报与阶段目标将进入御前。`, type: "important" }, chronicle: `天子定中期帝业为“${path.title}”。` });
    return true;
  }

  function getStageProgress(path = activePath(), core = coreState()) {
    if (!path || !state.active) return null;
    const quarterly = quarterlyState();
    const successes = (quarterly?.history || []).filter(item => item.success).length;
    const metrics = core?.causality?.metrics || {};
    const stage = Number(state.active.stage || 0);
    if (path.id === "benevolent") {
      if (stage === 0) return progress("民间稳定", core?.hidden?.peopleStability, 55);
      if (stage === 1) return progress("告成御题", successes, 2);
      return dualProgress("民稳与专属奏报", core?.hidden?.peopleStability, 65, state.active.momentum, 2);
    }
    if (path.id === "restoration") {
      if (stage === 0) return progress("百官支持", core?.stats?.officials, 55);
      if (stage === 1) return progress("皇权", core?.stats?.authority, 55);
      return dualProgress("御题与专属奏报", successes, 3, state.active.momentum, 2);
    }
    if (stage === 0) return alternativeProgress("胜利或新附", metrics.courtVictories, 1, metrics.citiesTaken, 1);
    if (stage === 1) return alternativeProgress("新附或战历", metrics.citiesTaken, 1, metrics.battles, 3);
    return dualProgress("胜绩与专属奏报", metrics.courtVictories, 2, state.active.momentum, 2);
  }

  function evaluateStage(core) {
    if (evaluating || !state.active || state.active.completed || state.active.lastStageTurn === core.turn) return;
    const path = activePath();
    const stageIndex = Number(state.active.stage || 0);
    const current = getStageProgress(path, core);
    if (!path || !current?.done) return;
    evaluating = true;
    state.active.stage += 1;
    state.active.lastStageTurn = core.turn;
    state.active.completed = state.active.stage >= path.stages.length;
    const completedStage = path.stages[stageIndex];
    state.history.unshift({ turn: core.turn, type: "stage", pathId: path.id, title: completedStage.title, text: state.active.completed ? `${path.title}三阶段全部完成。` : `帝业阶段“${completedStage.title}”完成。` });
    state.history = state.history.slice(0, 20);
    saveState();
    window.XianQuarterlyAgenda?.addContribution?.(8, `帝业阶段“${completedStage.title}”告成`);
    window.XianEmperorGame?.applyExternalPackage?.({
      ...path.rewards[stageIndex], causal: false,
      report: { title: `帝业进境·${completedStage.title}`, text: state.active.completed ? `${path.title}三阶段全部告成，这条道路已经成为本局鲜明的历史定论。` : `“${completedStage.title}”已经完成，下一阶段为“${path.stages[state.active.stage].title}”。`, type: "decision" },
      chronicle: `帝业“${path.title}”进至${completedStage.title}。`,
    });
    evaluating = false;
  }

  function selectEventId(core = coreState()) {
    if (!core || !state.active || state.active.completed || core.ended) return null;
    if (Number(core.turn || 0) - Number(state.active.lastEventTurn || 0) < 2) return null;
    const available = (window.GAME_DATA?.pathEvents || []).filter(event => event.pathId === state.active.id && Number(event.pathStage || 1) <= Number(state.active.stage || 0) + 1 && !state.active.seenEvents.includes(event.id));
    const selected = available[0];
    if (!selected) return null;
    state.active.seenEvents.push(selected.id);
    state.active.lastEventTurn = core.turn;
    saveState(false);
    return selected.id;
  }

  function recordPathDecision(detail) {
    if (!state.active || !String(detail.eventId || "").startsWith(`path_${state.active.id}_`)) return;
    const id = detail.eventId;
    if (state.history.some(item => item.type === "event" && item.eventId === id)) return;
    state.active.momentum = Number(state.active.momentum || 0) + 1;
    state.history.unshift({ turn: detail.turn, type: "event", eventId: id, pathId: state.active.id, title: detail.eventTitle, text: `御前裁为“${detail.choiceLabel}”。` });
    state.history = state.history.slice(0, 20);
    saveState();
    window.XianQuarterlyAgenda?.addContribution?.(8, `裁决${activePath()?.title || "帝业"}专属奏报`);
  }

  function render() {
    const slot = document.getElementById("imperial-path-slot");
    const core = coreState();
    if (!slot) return;
    if (!core || !state.unlocked) { slot.innerHTML = ""; return; }
    if (!state.active) {
      const scored = scorePaths(core, quarterlyState(), councilState());
      slot.innerHTML = `<section class="imperial-path-offers"><header><div><span>帝业殊途</span><strong>前两季已经写出你的倾向</strong></div><small>选定后不可更改</small></header><p>系统只做推荐，不替陛下决定。三条路使用现有国势、御题与战果，不增加新资源。</p><div>${scored.map((path, index) => `<button type="button" data-path-id="${path.id}"><span>${index === 0 ? "最顺当前局势" : "亦可改弦"} · 适配 ${path.score}</span><strong><i>${path.seal}</i>${esc(path.title)}</strong><p>${esc(path.summary)}</p><small>${esc(path.reason)}</small><b>定此帝业 →</b></button>`).join("")}</div></section>`;
      slot.querySelectorAll("[data-path-id]").forEach(button => button.addEventListener("click", () => choosePath(button.dataset.pathId)));
      return;
    }
    const path = activePath();
    const stageProgress = getStageProgress(path, core);
    slot.innerHTML = `<section class="imperial-path-active ${state.active.completed ? "complete" : ""}"><header><div class="path-seal">${path.seal}</div><div><span>中期帝业 · ${state.active.completed ? "已成定论" : `第 ${Math.min(state.active.stage + 1, 3)} 阶段`}</span><strong>${esc(path.title)}</strong><small>${esc(path.summary)}</small></div></header><div class="path-stages">${path.stages.map((stage, index) => `<article class="${index < state.active.stage ? "done" : index === state.active.stage && !state.active.completed ? "current" : ""}"><i>${index < state.active.stage ? "✓" : index + 1}</i><span><strong>${esc(stage.title)}</strong><small>${esc(stage.label)}</small></span></article>`).join("")}</div>${state.active.completed ? `<p class="path-complete-note">这条道路已经写入本局历史定论；仍可继续完成当前三月御题。</p>` : `<div class="path-next"><span>当前进境</span><strong>${esc(stageProgress.label)} · ${stageProgress.text}</strong><div><i style="width:${stageProgress.percent}%"></i></div></div>`}</section>`;
  }

  function activePath() { return PATHS.find(item => item.id === state.active?.id) || null; }
  function progress(label, value, target) { value = Number(value || 0); return { label, text: `${Math.min(value, target)} / ${target}`, percent: clamp(value / target * 100, 0, 100), done: value >= target }; }
  function dualProgress(label, first, firstTarget, second, secondTarget) { const a = progress("", first, firstTarget); const b = progress("", second, secondTarget); return { label, text: `${Math.min(Number(first || 0), firstTarget)}/${firstTarget} · ${Math.min(Number(second || 0), secondTarget)}/${secondTarget}`, percent: Math.min(a.percent, b.percent), done: a.done && b.done }; }
  function alternativeProgress(label, first, firstTarget, second, secondTarget) { const a = progress("", first, firstTarget); const b = progress("", second, secondTarget); return { label, text: `${Math.min(Number(first || 0), firstTarget)}/${firstTarget} 或 ${Math.min(Number(second || 0), secondTarget)}/${secondTarget}`, percent: Math.max(a.percent, b.percent), done: a.done || b.done }; }
  function getState() { return JSON.parse(JSON.stringify(state)); }
  function clamp(value, min, max) { return Math.min(max, Math.max(min, Number(value) || 0)); }
  function esc(value) { return String(value ?? "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char])); }
  window.XianImperialPaths = Object.freeze({ version: VERSION, paths: PATHS.map(item => ({ ...item })), scorePaths, choosePath, getStageProgress, selectEventId, getState });
})();
