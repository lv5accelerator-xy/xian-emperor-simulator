/* 天子蒙尘：献帝模拟器 v1.5.1 · 战役阶段、人物差遣与动态战线 */
(() => {
  "use strict";

  const DATA = window.XIAN_CAMPAIGN_DATA;
  if (!DATA) return;
  const CORE_KEY = "xian_emperor_simulator_v01";
  const STORE_KEY = "xian_emperor_campaign_evolution_v150";
  const VERSION = "1.5.1";
  const MAX_ASSIGNMENTS = 3;
  let core = null;
  let state = null;
  let panel = null;
  let overlay = null;
  let activeTab = "objectives";
  let syncTimer = null;

  installStorageBridge();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();

  function safeParse(raw) {
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (_) { return null; }
  }

  function deepClone(value) { return JSON.parse(JSON.stringify(value)); }
  function clamp(value, min = 0, max = 100) { return Math.min(max, Math.max(min, Number(value) || 0)); }
  function esc(value) { return String(value ?? "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char])); }

  function installStorageBridge() {
    const previousSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function campaignAwareSetItem(key, value) {
      previousSetItem.apply(this, arguments);
      if (this === localStorage && key === CORE_KEY && !window.__xianFullSaveImporting && !window.__xianEvolutionRefreshOnly) queueSync(value);
    };
    document.addEventListener("xian:map-order", queueSync);
    document.addEventListener("xian:strategy-campaign-update", renderAll);
  }

  function queueSync(raw) {
    window.clearTimeout(syncTimer);
    syncTimer = window.setTimeout(() => syncFromCore(typeof raw === "string" ? raw : localStorage.getItem(CORE_KEY)), 360);
  }

  function init() {
    installPanel();
    installOverlay();
    bind();
    syncFromCore(localStorage.getItem(CORE_KEY));
  }

  function installPanel() {
    panel = document.getElementById("campaign-focus");
    if (panel) return;
    panel = document.createElement("section");
    panel.id = "campaign-focus";
    panel.className = "campaign-focus hidden";
    panel.setAttribute("aria-label", "战役目标与动态战线");
    const focus = document.getElementById("imperial-focus");
    (focus || document.getElementById("danger-banner"))?.insertAdjacentElement("afterend", panel);
  }

  function installOverlay() {
    overlay = document.getElementById("campaign-evolution-overlay");
    if (overlay) return;
    overlay = document.createElement("div");
    overlay.id = "campaign-evolution-overlay";
    overlay.className = "campaign-evolution-overlay hidden";
    document.body.appendChild(overlay);
  }

  function bind() {
    ["new-game-btn", "continue-game-btn", "load-btn"].forEach(id => document.getElementById(id)?.addEventListener("click", () => setTimeout(() => { queueSync(); renderAll(); }, 0)));
    panel?.addEventListener("click", event => {
      if (event.target.closest("[data-campaign-open]")) openOverlay("objectives");
    });
    overlay?.addEventListener("click", event => {
      if (event.target === overlay || event.target.closest("[data-campaign-close]")) return closeOverlay();
      const tab = event.target.closest("[data-campaign-tab]");
      if (tab) { activeTab = tab.dataset.campaignTab; return renderOverlay(); }
      const create = event.target.closest("[data-assignment-create]");
      if (create) createAssignment();
      const cancel = event.target.closest("[data-assignment-cancel]");
      if (cancel) cancelAssignment(cancel.dataset.assignmentCancel);
      const roleSelect = event.target.closest("#assignment-role");
      if (roleSelect) renderAssignmentTargets(roleSelect.value);
    });
    overlay?.addEventListener("change", event => {
      if (event.target.matches?.("#assignment-role")) renderAssignmentTargets(event.target.value);
    });
    document.addEventListener("keydown", event => { if (event.key === "Escape" && overlay && !overlay.classList.contains("hidden")) closeOverlay(); });
  }

  function defaultState(coreState) {
    return {
      version: VERSION,
      gameCreatedAt: coreState.createdAt,
      scenarioId: coreState.scenarioId,
      currentStage: 0,
      completedStages: [],
      assignments: [],
      assignmentsCompleted: 0,
      lastProcessedTurn: Number(coreState.turn || 1),
      lastEnvironmentTurn: Number(coreState.turn || 1) - 1,
      environment: { season: seasonForMonth(coreState.month), events: [], activeBlockades: [] },
      log: [],
      updatedAt: new Date().toISOString(),
    };
  }

  function migrateState(value, coreState) {
    const base = defaultState(coreState);
    return {
      ...base,
      ...(value || {}),
      version: VERSION,
      gameCreatedAt: coreState.createdAt,
      scenarioId: coreState.scenarioId,
      completedStages: Array.isArray(value?.completedStages) ? value.completedStages : [],
      assignments: Array.isArray(value?.assignments) ? value.assignments : [],
      assignmentsCompleted: Number(value?.assignmentsCompleted || 0),
      environment: { ...base.environment, ...(value?.environment || {}), events: Array.isArray(value?.environment?.events) ? value.environment.events : [], activeBlockades: Array.isArray(value?.environment?.activeBlockades) ? value.environment.activeBlockades : [] },
      log: Array.isArray(value?.log) ? value.log : [],
    };
  }

  function syncFromCore(raw) {
    const parsed = safeParse(raw);
    if (!parsed || !parsed.createdAt || !parsed.stats || !parsed.hidden) {
      core = null;
      state = safeParse(localStorage.getItem(STORE_KEY));
      return renderAll();
    }
    core = parsed;
    const loaded = safeParse(localStorage.getItem(STORE_KEY));
    state = !loaded || loaded.gameCreatedAt !== core.createdAt ? defaultState(core) : migrateState(loaded, core);
    processElapsedTurns();
    evaluateStage();
    state.updatedAt = new Date().toISOString();
    saveState();
    renderAll();
  }

  function saveState() {
    if (!state) return;
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (error) { console.warn("战役进程保存失败", error); }
  }

  function stages() { return DATA.scenarioStages[core?.scenarioId] || []; }
  function currentStage() { return stages()[Math.min(Number(state?.currentStage || 0), stages().length - 1)] || null; }
  function strategyState() { return window.XianStrategyNetwork?.getState?.() || safeParse(localStorage.getItem("xian_emperor_strategy_network_v040")) || {}; }
  function armyState() { return window.XianArmySystem?.getState?.() || safeParse(localStorage.getItem("xian_emperor_armies_v050")) || {}; }

  function objectiveValue(goal, context = {}) {
    const c = context.core || core || {};
    const s = context.strategy || strategyState();
    const e = context.evolution || state || {};
    if (goal.type === "statMin" || goal.type === "statMax") return Number(c.stats?.[goal.key] || 0);
    if (goal.type === "hiddenMin" || goal.type === "hiddenMax") return Number(c.hidden?.[goal.key] || 0);
    if (goal.type === "turnMin") return Number(c.turn || 0);
    if (goal.type === "edictMin") return Number(c.edictsIssued || 0);
    if (goal.type === "routeSupplyMin") return Number(s.routes?.[goal.key]?.supply || 0);
    if (goal.type === "cityDefenseMin") return Number(s.cities?.[goal.key]?.defense || 0);
    if (goal.type === "assignmentCount") return Number(e.assignmentsCompleted || 0);
    return 0;
  }

  function objectiveComplete(goal, context = {}) {
    const value = objectiveValue(goal, context);
    return /Max$/.test(goal.type) ? value <= goal.target : value >= goal.target;
  }

  function evaluateStage() {
    const stage = currentStage();
    if (!stage || state.completedStages.includes(stage.id) || !stage.goals.every(goal => objectiveComplete(goal))) return;
    state.completedStages.push(stage.id);
    state.currentStage = Math.min(stages().length, state.currentStage + 1);
    state.log.unshift({ turn: core.turn, text: `阶段目标“${stage.title}”完成。` });
    state.log = state.log.slice(0, 30);
    saveState();
    window.__xianEvolutionRefreshOnly = true;
    try {
      window.XianEmperorGame?.applyExternalPackage?.({
        ...(stage.reward || {}),
        report: { title: "战役阶段达成", text: `“${stage.title}”已经完成，朝廷获得小幅整备奖励。`, type: "important" },
        chronicle: `朝廷完成战役阶段“${stage.title}”。`,
      });
    } finally { window.__xianEvolutionRefreshOnly = false; }
    core = window.XianEmperorGame?.getState?.() || core;
  }

  function seasonForMonth(month) {
    const value = ((Number(month || 1) - 1) % 12 + 12) % 12 + 1;
    if (value <= 3) return "spring";
    if (value <= 6) return "summer";
    if (value <= 9) return "autumn";
    return "winter";
  }

  function seededIndex(seed, length) {
    let value = 2166136261;
    String(seed).split("").forEach(char => { value ^= char.charCodeAt(0); value = Math.imul(value, 16777619); });
    return length ? Math.abs(value) % length : 0;
  }

  function routeDefs() { return window.XIAN_STRATEGY_DATA?.routes || []; }

  function buildSeasonEffects(season, turn, routes = routeDefs()) {
    const result = {};
    routes.forEach(route => {
      if (season === "autumn") result[route.id] = { supply: 1, reason: "秋收转运" };
      else if (season === "spring" && /栈道|山道|关道/.test(route.type || "")) result[route.id] = { supply: -1, weatherUntilTurn: turn, weatherCost: 1, reason: "春汛泥泞" };
      else if (season === "summer" && /水/.test(`${route.type}${route.terrain}`)) result[route.id] = { supply: 1, reason: "盛夏水运" };
      else if (season === "winter" && /栈道|山道|关道/.test(route.type || "")) result[route.id] = { supply: -2, weatherUntilTurn: turn, weatherCost: 2, reason: "隆冬封路" };
    });
    return result;
  }

  function chooseFrontEvent(season, turn, routes = routeDefs(), currentStrategy = strategyState(), seed = state?.gameCreatedAt || "") {
    const routeStates = currentStrategy.routes || {};
    let candidates = [];
    let type = "convoy";
    if (season === "summer") { type = "flood"; candidates = routes.filter(route => /水/.test(`${route.type}${route.terrain}`)); }
    else if (season === "winter") { type = "closure"; candidates = routes.filter(route => /栈道|山道|关道/.test(route.type || "")); }
    else if (season === "autumn") { type = "convoy"; candidates = [...routes].sort((a, b) => Number(routeStates[a.id]?.supply || a.supply) - Number(routeStates[b.id]?.supply || b.supply)).slice(0, 5); }
    else { type = "blockade"; candidates = routes.filter(route => Number(routeStates[route.id]?.pressure || route.pressure) >= 60); }
    if (!candidates.length) candidates = routes;
    const route = candidates[seededIndex(`${seed}-${turn}-${season}`, candidates.length)];
    if (!route) return null;
    const eventMap = {
      flood: { title: "暴雨冲漕", text: `${route.name}遭遇暴雨，水运暂时受阻。`, effects: { supply: -3, weatherUntilTurn: turn + 1, weatherCost: 1, reason: "暴雨冲漕" } },
      closure: { title: "关道雪闭", text: `${route.name}积雪封路，本月行军更加艰难。`, effects: { supply: -2, blockadedUntil: turn + 1, weatherUntilTurn: turn + 1, weatherCost: 2, reason: "关道雪闭" } },
      convoy: { title: "秋粮抵线", text: `${route.name}迎来一批新粮，补给压力暂缓。`, effects: { supply: 4, pressure: -1, reason: "秋粮抵线" } },
      blockade: { title: "驿路封锁", text: `${route.name}遭敌军截断，本月需另觅通路。`, effects: { supply: -2, pressure: 2, blockadedUntil: turn + 1, reason: "敌军封锁" } },
    };
    return { id: `${type}-${turn}-${route.id}`, type, routeId: route.id, routeName: route.name, turn, ...eventMap[type] };
  }

  function processElapsedTurns() {
    if (!state || !core) return;
    const targetTurn = Number(core.turn || 1);
    let cursor = Number(state.lastProcessedTurn || targetTurn);
    while (cursor < targetTurn) {
      cursor += 1;
      processAssignments(cursor);
    }
    state.lastProcessedTurn = targetTurn;
    if (Number(state.lastEnvironmentTurn || 0) < targetTurn) processEnvironment(targetTurn);
  }

  function processAssignments(turn) {
    state.assignments.forEach(item => {
      if (item.status !== "active" || turn <= item.startTurn) return;
      if (item.roleId === "governor") window.XianStrategyNetwork?.applyCampaignEffects?.({ cities: { [item.targetId]: { defense: 1, courtLoyalty: 1, reason: `${item.characterName}巡抚州郡` } }, reason: "人物差遣" });
      if (item.roleId === "envoy") window.XianStrategyNetwork?.applyCampaignEffects?.({ strategies: { [item.targetId]: { trust: 2 } }, reason: `${item.characterName}持节出使` });
      if (item.roleId === "supervisor") window.XianArmySystem?.applyCampaignAssignment?.(item.targetId, { morale: 2, training: 1, supply: 1, fatigue: -1 }, `${item.characterName}监军劳师`);
      item.progressTurns = Number(item.progressTurns || 0) + 1;
      if (turn >= item.endTurn) {
        item.status = "completed";
        state.assignmentsCompleted += 1;
        state.log.unshift({ turn, text: `${item.characterName}完成“${item.roleName}”。` });
      }
    });
    state.assignments = state.assignments.filter(item => item.status === "active" || turn - item.endTurn <= 3);
  }

  function processEnvironment(turn) {
    const strategy = strategyState();
    if (!strategy?.gameCreatedAt || strategy.gameCreatedAt !== core.createdAt) return false;
    const expired = {};
    Object.entries(strategy.routes || {}).forEach(([id, route]) => {
      const patch = {};
      if (Number(route.blockadedUntil || 0) < turn) patch.blockadedUntil = null;
      if (Number(route.weatherUntilTurn || 0) < turn) { patch.weatherUntilTurn = null; patch.weatherCost = null; }
      if (Object.keys(patch).length) expired[id] = patch;
    });
    if (Object.keys(expired).length && !window.XianStrategyNetwork?.applyCampaignEffects?.({ routes: expired, reason: "季节影响消退" })) return false;
    const season = seasonForMonth(core.month);
    const seasonal = buildSeasonEffects(season, turn);
    if (Object.keys(seasonal).length && !window.XianStrategyNetwork?.applyCampaignEffects?.({ routes: seasonal, reason: DATA.seasons[season].name })) return false;
    const event = chooseFrontEvent(season, turn);
    if (event) {
      if (!window.XianStrategyNetwork?.applyCampaignEffects?.({ routes: { [event.routeId]: event.effects }, reason: event.title, log: event.text })) return false;
      state.environment.events.unshift(event);
      state.environment.events = state.environment.events.slice(0, 12);
    }
    state.environment.season = season;
    const after = strategyState();
    state.environment.activeBlockades = Object.entries(after.routes || {}).filter(([, route]) => Number(route.blockadedUntil || 0) >= turn).map(([id]) => id);
    state.lastEnvironmentTurn = turn;
    return true;
  }

  function createAssignment() {
    if (!core || !state) return;
    const active = state.assignments.filter(item => item.status === "active");
    if (active.length >= MAX_ASSIGNMENTS) return notify("同时最多安排三项差遣。", "warning");
    const characterId = document.getElementById("assignment-character")?.value;
    const roleId = document.getElementById("assignment-role")?.value;
    const targetId = document.getElementById("assignment-target")?.value;
    const character = (window.GAME_DATA?.characters || []).find(item => item.id === characterId);
    const role = DATA.assignments.find(item => item.id === roleId);
    if (!character || !role || !targetId) return notify("请完整选择人物、差遣和目标。", "warning");
    if (active.some(item => item.characterId === characterId)) return notify("该人物已有差遣在身。", "warning");
    const targetName = targetLabel(role.targetType, targetId);
    const accepted = window.XianEmperorGame?.performExternalAction?.({
      title: `人物差遣·${role.name}`,
      text: `${character.name}奉命前往${targetName}，预计三个月完成。`,
      chronicle: `天子遣${character.name}${role.name}，目标为${targetName}。`,
    });
    if (!accepted) return notify("请先裁决本月奏报，并确认仍有行动次数。", "warning");
    core = window.XianEmperorGame?.getState?.() || core;
    state.assignments.unshift({ id: `assignment-${Date.now()}`, characterId, characterName: character.name, roleId, roleName: role.name, targetId, targetName, startTurn: core.turn, endTurn: core.turn + role.duration, progressTurns: 0, status: "active" });
    state.log.unshift({ turn: core.turn, text: `${character.name}受命${role.name}。` });
    saveState();
    renderAll();
    notify("差遣已列入本月政务。", "success");
  }

  function cancelAssignment(id) {
    const item = state?.assignments.find(entry => entry.id === id && entry.status === "active");
    if (!item) return;
    item.status = "cancelled";
    item.endTurn = Number(core?.turn || item.endTurn);
    state.log.unshift({ turn: core?.turn || 1, text: `${item.characterName}的“${item.roleName}”差遣被召回。` });
    saveState();
    renderAll();
  }

  function targetLabel(type, id) {
    if (type === "city") return (window.XIAN_STRATEGY_DATA?.cities || []).find(item => item.id === id)?.name || id;
    if (type === "lord") return (window.XIAN_STRATEGY_DATA?.lords || []).find(item => item.id === id)?.name || id;
    return (window.XIAN_ARMY_DATA?.armies || []).find(item => item.id === id)?.name || id;
  }

  function targetOptions(roleId) {
    const role = DATA.assignments.find(item => item.id === roleId) || DATA.assignments[0];
    if (role.targetType === "city") return (window.XIAN_STRATEGY_DATA?.cities || []).map(item => ({ id: item.id, name: item.name }));
    if (role.targetType === "lord") return (window.XIAN_STRATEGY_DATA?.lords || []).map(item => ({ id: item.id, name: item.name }));
    const current = armyState().armies || {};
    return (window.XIAN_ARMY_DATA?.armies || []).filter(item => current[item.id]?.status !== "destroyed").map(item => ({ id: item.id, name: item.name }));
  }

  function renderAssignmentTargets(roleId) {
    const select = document.getElementById("assignment-target");
    if (!select) return;
    select.innerHTML = targetOptions(roleId).map(item => `<option value="${esc(item.id)}">${esc(item.name)}</option>`).join("");
  }

  function goalProgress(goal) {
    const value = Math.round(objectiveValue(goal));
    return /Max$/.test(goal.type) ? `${value} / ≤${goal.target}` : `${Math.min(value, goal.target)} / ${goal.target}`;
  }

  function renderAll() {
    renderPanel();
    if (overlay && !overlay.classList.contains("hidden")) renderOverlay();
  }

  function renderPanel() {
    if (!panel) return;
    const hasGame = Boolean(core && state);
    panel.classList.toggle("hidden", !hasGame || document.getElementById("game-shell")?.classList.contains("hidden"));
    if (!hasGame) return;
    const stage = currentStage();
    const complete = state.currentStage >= stages().length;
    const season = DATA.seasons[state.environment.season] || DATA.seasons.spring;
    const alert = state.environment.events[0];
    panel.innerHTML = `<div class="campaign-focus-copy"><span class="section-kicker">战役目标 · ${esc(season.name)}</span><h2>${complete ? "本剧本阶段目标已经完成" : esc(stage?.title || "整顿朝局")}</h2><p>${complete ? "接下来可按自己的路线经营朝廷与天下。" : esc(stage?.summary || "")}</p></div><div class="campaign-focus-goals">${complete ? `<span class="goal-chip done">四阶段完成</span>` : (stage?.goals || []).map(goal => `<span class="goal-chip ${objectiveComplete(goal) ? "done" : ""}">${objectiveComplete(goal) ? "✓" : "○"} ${esc(goal.label)} <b>${goalProgress(goal)}</b></span>`).join("")}</div><div class="campaign-focus-front"><small>本月战线</small><strong>${esc(alert?.title || season.note)}</strong><span>${esc(alert?.routeName || season.note)}</span></div><button class="campaign-open-button" data-campaign-open type="button">打开战役台</button>`;
  }

  function openOverlay(tab = "objectives") {
    if (!overlay || !state) return;
    activeTab = tab;
    overlay.classList.remove("hidden");
    document.body.classList.add("campaign-open");
    renderOverlay();
  }

  function closeOverlay() {
    overlay?.classList.add("hidden");
    document.body.classList.remove("campaign-open");
  }

  function renderOverlay() {
    if (!overlay || !state || !core) return;
    const tabs = [{ id: "objectives", name: "战役目标" }, { id: "assignments", name: "人物差遣" }, { id: "front", name: "动态战线" }];
    overlay.innerHTML = `<section class="campaign-console" role="dialog" aria-modal="true" aria-label="战役台"><header><div><span class="section-kicker">御前战役台</span><h2>一处处理目标、人物与战线</h2><p>所有主动操作均使用原有行动次数，不增加新货币。</p></div><button data-campaign-close class="campaign-close" type="button" aria-label="关闭">×</button></header><nav>${tabs.map(tab => `<button class="${activeTab === tab.id ? "active" : ""}" data-campaign-tab="${tab.id}" type="button">${tab.name}</button>`).join("")}</nav><main>${activeTab === "assignments" ? renderAssignments() : activeTab === "front" ? renderFront() : renderObjectives()}</main></section>`;
    if (activeTab === "assignments") renderAssignmentTargets(document.getElementById("assignment-role")?.value || DATA.assignments[0].id);
  }

  function renderObjectives() {
    const all = stages();
    return `<section class="campaign-section"><div class="campaign-section-head"><div><span class="section-kicker">剧本阶段</span><h3>四步看清本局方向</h3></div><strong>${Math.min(state.currentStage, all.length)} / ${all.length}</strong></div><div class="stage-list">${all.map((stage, index) => {
      const done = state.completedStages.includes(stage.id);
      const current = index === state.currentStage;
      return `<article class="stage-card ${done ? "done" : current ? "current" : "locked"}"><span class="stage-number">${done ? "✓" : index + 1}</span><div><small>${done ? "已完成" : current ? "当前阶段" : "后续阶段"}</small><h4>${esc(stage.title)}</h4><p>${esc(stage.summary)}</p>${current ? `<div class="stage-goals">${stage.goals.map(goal => `<span>${objectiveComplete(goal) ? "✓" : "○"} ${esc(goal.label)} <b>${goalProgress(goal)}</b></span>`).join("")}</div>` : ""}</div></article>`;
    }).join("")}</div></section>`;
  }

  function renderAssignments() {
    const characters = (window.GAME_DATA?.characters || []).filter(item => item.id !== "liu_xie");
    const active = state.assignments.filter(item => item.status === "active");
    return `<section class="campaign-section"><div class="campaign-section-head"><div><span class="section-kicker">人物与地图联动</span><h3>派一人，办一件事</h3></div><strong>${active.length} / ${MAX_ASSIGNMENTS}</strong></div><div class="assignment-form"><label>人物<select id="assignment-character">${characters.map(item => `<option value="${esc(item.id)}">${esc(item.name)} · ${esc(item.title)}</option>`).join("")}</select></label><label>差遣<select id="assignment-role">${DATA.assignments.map(item => `<option value="${item.id}">${item.name}</option>`).join("")}</select></label><label>目标<select id="assignment-target"></select></label><button data-assignment-create type="button">下达差遣 · 1 行动</button></div><p class="assignment-note">巡抚影响城池，出使影响诸侯，监军影响军团；每项持续三个月。</p><div class="assignment-list">${active.length ? active.map(item => `<article><div><small>${esc(item.roleName)}</small><strong>${esc(item.characterName)} → ${esc(item.targetName)}</strong><span>进度 ${item.progressTurns} / ${Math.max(1, item.endTurn - item.startTurn)} 月</span></div><button data-assignment-cancel="${esc(item.id)}" type="button">召回</button></article>`).join("") : `<div class="campaign-empty">暂无进行中的差遣。新玩家可以先从“巡抚州郡”开始。</div>`}</div></section>`;
  }

  function renderFront() {
    const season = DATA.seasons[state.environment.season] || DATA.seasons.spring;
    const strategy = strategyState();
    const blocked = Object.entries(strategy.routes || {}).filter(([, route]) => Number(route.blockadedUntil || 0) >= core.turn);
    return `<section class="campaign-section"><div class="season-banner"><span>${esc(season.name)}</span><div><h3>${esc(season.note)}</h3><p>季节只改变少数军路，不会额外要求玩家逐项操作。</p></div></div><div class="front-summary"><article><small>当前封锁</small><strong>${blocked.length}</strong><span>条军路</span></article><article><small>本季事件</small><strong>${state.environment.events.filter(item => seasonForMonth(core.month) === state.environment.season).length}</strong><span>最近记录</span></article><article><small>差遣进行</small><strong>${state.assignments.filter(item => item.status === "active").length}</strong><span>项任务</span></article></div><div class="front-events">${state.environment.events.length ? state.environment.events.map(event => `<article><span>第 ${event.turn} 月</span><div><strong>${esc(event.title)} · ${esc(event.routeName)}</strong><p>${esc(event.text)}</p></div></article>`).join("") : `<div class="campaign-empty">本局尚未出现动态战线事件。</div>`}</div></section>`;
  }

  function notify(message, type = "info") {
    const container = document.getElementById("toast-container");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 2600);
  }

  window.XianCampaignEvolution = Object.freeze({
    version: VERSION,
    objectiveValue,
    objectiveComplete,
    seasonForMonth,
    buildSeasonEffects,
    chooseFrontEvent,
    getState: () => state ? deepClone(state) : null,
    open: openOverlay,
  });
})();
