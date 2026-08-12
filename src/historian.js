/* 天子蒙尘：献帝模拟器 v1.9.0 · 史官执笔 */
(() => {
  "use strict";

  const CORE_KEY = "xian_emperor_simulator_v01";
  const STORE_KEY = "xian_emperor_historian_v190";
  const MAX_RUNS = 24;
  const ARCHETYPES = [
    { id: "ritual", name: "礼法守成", text: "以皇权、百官与汉家威望恢复朝廷秩序。", score: s => avg(s.authority, s.prestige, s.officials) },
    { id: "balance", name: "诸侯制衡", text: "借外镇承认牵制一方独大，让汉廷继续居中。", score: (s, h) => avg(s.prestige, h.externalBalance, 100 - s.caoAlert) },
    { id: "covert", name: "密诏复汉", text: "以忠汉网络和隐秘行动寻找反制机会。", score: (s, h) => avg(s.authority, h.loyalNetwork, 100 - h.leakRisk) },
    { id: "people", name: "民生调停", text: "把百姓、财政和官僚秩序放在短期争权之前。", score: (s, h) => avg(s.treasury, s.officials, s.prestige, h.peopleStability) },
    { id: "survival", name: "乱世存续", text: "在安全与警戒之间保持克制，以时间延续汉祚。", score: s => avg(s.security, 100 - s.caoAlert, s.authority) },
  ];

  let state = loadState();
  let currentDecisions = [];

  document.addEventListener("DOMContentLoaded", init, { once: true });
  document.addEventListener("xian:decision-resolved", event => captureDecision(event.detail || {}));
  document.addEventListener("xian:campaign-concluded", event => recordRun(event.detail || {}));

  function init() {
    window.XianCommandCenter?.registerTab?.({
      id: "historian",
      label: "史官执笔",
      kicker: "v1.9.0 · 抉择复盘",
      title: "看见自己如何走到此刻",
      render: renderTab,
      onMount: mountTab,
    });
    const core = readCore();
    if (core?.ended && !state.runs.some(run => run.gameCreatedAt === core.createdAt)) {
      recordRun({ state: core, scenario: scenarioById(core.scenarioId), score: calculateFallbackScore(core), challenge: { completed: false } });
    }
  }

  function captureDecision(detail) {
    if (!detail.createdAt) return;
    const importance = Object.values(detail.relations || {}).reduce((sum, value) => sum + Math.abs(Number(value) || 0), 0);
    currentDecisions.unshift({
      gameCreatedAt: detail.createdAt,
      turn: detail.turn || 0,
      date: detail.date || "御前",
      title: detail.eventTitle || "朝堂裁决",
      choice: detail.choiceLabel || detail.chronicle || "已裁决",
      importance,
    });
    currentDecisions = currentDecisions.filter(item => item.gameCreatedAt === detail.createdAt).slice(0, 18);
  }

  function recordRun(detail) {
    const game = detail.state;
    if (!game?.createdAt || state.runs.some(run => run.gameCreatedAt === game.createdAt)) return;
    const route = classifyRoute(game);
    const decisions = currentDecisions.filter(item => item.gameCreatedAt === game.createdAt);
    const turningPoints = selectTurningPoints(game, decisions);
    const run = {
      id: `run-${Date.now()}`,
      gameCreatedAt: game.createdAt,
      scenarioId: game.scenarioId,
      scenarioName: detail.scenario?.name || scenarioById(game.scenarioId)?.name || game.scenarioId,
      ending: game.ending?.title || "未结算",
      endingText: game.ending?.text || "",
      score: Number(detail.score || calculateFallbackScore(game)),
      challengeCompleted: Boolean(detail.challenge?.completed),
      routeId: route.id,
      routeName: route.name,
      routeText: route.text,
      stats: { ...(game.stats || {}) },
      hidden: { ...(game.hidden || {}) },
      turningPoints,
      chronicle: Array.isArray(game.chronicle) ? game.chronicle.slice(-12) : [],
      completedAt: new Date().toISOString(),
    };
    state.runs.unshift(run);
    state.runs = state.runs.slice(0, MAX_RUNS);
    saveState();
    window.XianCommandCenter?.refresh?.();
    installEndingReview(run);
  }

  function classifyRoute(game) {
    const scores = ARCHETYPES.map(item => ({ ...item, value: Math.round(item.score(game.stats || {}, game.hidden || {})) }));
    return scores.sort((a, b) => b.value - a.value)[0];
  }

  function selectTurningPoints(game, decisions) {
    const selected = [...decisions].sort((a, b) => b.importance - a.importance || a.turn - b.turn).slice(0, 4).sort((a, b) => a.turn - b.turn);
    if (selected.length >= 3) return selected;
    const chronicle = Array.isArray(game.chronicle) ? game.chronicle : [];
    const indexes = [0, Math.floor(chronicle.length / 2), Math.max(0, chronicle.length - 1)];
    indexes.forEach((index, order) => {
      const entry = chronicle[index];
      if (entry && !selected.some(item => item.choice === entry.text)) selected.push({ turn: order * Math.max(1, Math.floor(game.maxTurns / 2)), date: entry.date, title: order === 0 ? "开局" : order === 2 ? "终卷" : "中局", choice: entry.text, importance: 0 });
    });
    return selected.slice(0, 5).sort((a, b) => a.turn - b.turn);
  }

  function renderTab() {
    const core = readCore();
    const currentRoute = core ? classifyRoute(core) : null;
    const relevant = state.runs.slice(0, 8);
    return `
      ${currentRoute ? `<div class="historian-current"><span>本局目前更接近</span><strong>${escapeHtml(currentRoute.name)}</strong><p>${escapeHtml(currentRoute.text)}</p></div>` : ""}
      <section class="historian-section"><header><h3>历次终卷</h3><span>${state.runs.length} 局已经入史</span></header>${relevant.length ? `<div class="historian-runs">${relevant.map(renderRunCard).join("")}</div>` : '<div class="command-empty">完成一局后，史官会在此整理路线与关键转折。</div>'}</section>
      ${state.runs.length ? renderRouteComparison() : ""}`;
  }

  function renderRunCard(run) {
    return `<article class="historian-run"><header><div><span>${escapeHtml(run.scenarioName)}</span><strong>${escapeHtml(run.ending)}</strong></div><b>${run.score}</b></header><p>${escapeHtml(run.routeName)} · ${run.challengeCompleted ? "历史挑战完成" : "挑战未完成"}</p><div>${run.turningPoints.slice(0, 3).map(point => `<span>${escapeHtml(point.date)}｜${escapeHtml(point.choice)}</span>`).join("")}</div><button type="button" data-historian-export="${run.id}">导出复盘</button></article>`;
  }

  function renderRouteComparison() {
    const counts = Object.fromEntries(ARCHETYPES.map(item => [item.id, 0]));
    state.runs.forEach(run => { counts[run.routeId] = (counts[run.routeId] || 0) + 1; });
    const max = Math.max(1, ...Object.values(counts));
    return `<section class="historian-section route-comparison"><header><h3>你的路线分布</h3><span>只比较本浏览器完成的历史</span></header>${ARCHETYPES.map(item => `<div><span>${item.name}</span><i><b style="width:${Math.round((counts[item.id] || 0) / max * 100)}%"></b></i><strong>${counts[item.id] || 0}</strong></div>`).join("")}</section>`;
  }

  function mountTab(root) {
    root.querySelectorAll("[data-historian-export]").forEach(button => button.addEventListener("click", () => exportRun(button.dataset.historianExport)));
  }

  function installEndingReview(run) {
    setTimeout(() => {
      const actions = document.querySelector(".ending-actions");
      if (!actions || actions.querySelector("[data-ending-review]")) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "secondary-button";
      button.dataset.endingReview = run.id;
      button.textContent = "查看史官复盘";
      button.addEventListener("click", () => {
        document.getElementById("end-screen")?.classList.add("hidden");
        window.XianCommandCenter?.open?.("historian");
      });
      actions.prepend(button);
    }, 30);
  }

  function exportRun(id) {
    const run = state.runs.find(item => item.id === id);
    if (!run) return;
    const lines = [
      "《天子蒙尘：献帝模拟器》史官复盘",
      `剧本：${run.scenarioName}`,
      `结局：${run.ending}`,
      `路线：${run.routeName}`,
      `评分：${run.score}`,
      "",
      "关键转折：",
      ...run.turningPoints.map(item => `${item.date}　${item.title}：${item.choice}`),
      "",
      "史官总评：",
      `${run.routeText}${run.endingText ? ` 最终，${run.endingText}` : ""}`,
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `献帝模拟器-${run.scenarioId}-${run.ending}-复盘.txt`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  function avg(...values) { return values.reduce((sum, value) => sum + Number(value || 0), 0) / Math.max(1, values.length); }
  function calculateFallbackScore(game) { return Math.round(["authority", "prestige", "security", "treasury", "officials"].reduce((sum, key) => sum + Number(game.stats?.[key] || 0), Math.max(0, 100 - Number(game.stats?.caoAlert || 0)))); }
  function scenarioById(id) { return window.GAME_DATA?.scenarios?.find(item => item.id === id); }
  function defaultState() { return { version: 1, runs: [] }; }
  function loadState() { try { const value = JSON.parse(localStorage.getItem(STORE_KEY) || "null"); return { ...defaultState(), ...(value || {}), runs: Array.isArray(value?.runs) ? value.runs : [] }; } catch (_) { return defaultState(); } }
  function saveState() { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (error) { console.warn("史官档案保存失败", error); } }
  function readCore() { try { const value = JSON.parse(localStorage.getItem(CORE_KEY) || "null"); return value?.stats ? value : null; } catch (_) { return null; } }
  function escapeHtml(value) { return window.XianCommandCenter?.escapeHtml?.(value) || String(value ?? ""); }

  window.XianHistorian = Object.freeze({
    classifyRoute,
    selectTurningPoints,
    getState: () => JSON.parse(JSON.stringify(state)),
  });
})();
