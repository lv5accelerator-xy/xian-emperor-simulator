/* 天子蒙尘：献帝模拟器 v2.3.0 · 乱世短局 */
(() => {
  "use strict";

  const CORE_KEY = "xian_emperor_simulator_v01";
  const STORE_KEY = "xian_emperor_short_challenges_v230";
  const CHALLENGES = [
    {
      id: "white_horse", name: "白马解围", subtitle: "官渡战云中的六个月", scenarioId: "jianan_200", duration: 6,
      intro: "袁曹相持，朝廷必须在不彻底倒向任何一方的情况下保存名分与粮秣。",
      sequence: ["scenario_200_opening", "northern_envoy", "grain_price", "frontier_victory", "court_debate", "cao_gift"],
      setup: { effects: { treasury: -4, prestige: 3, caoAlert: 4 }, hidden: { externalBalance: 5 } },
      goals: [{ path: "stats.authority", min: 32, label: "皇权≥32" }, { path: "stats.treasury", min: 25, label: "国库≥25" }, { path: "stats.caoAlert", max: 78, label: "曹氏警戒≤78" }],
      reward: "白马羽檄",
      advice: "保住钱粮是本局要务。赈济前留出国库目标与月末用度；吃紧时可先筹措。",
    },
    {
      id: "girdle_edict", name: "衣带诏影", subtitle: "秘密与忠诚的六个月", scenarioId: "jianan_196", duration: 6,
      intro: "忠汉之士请求更明确的承诺，但每一次秘密往来都会留下痕迹。",
      sequence: ["arrival_xu", "secret_letter", "palace_guard", "dong_cheng_plan", "forged_edict", "palace_rumor"],
      setup: { effects: { security: -3, caoAlert: 5 }, hidden: { loyalNetwork: 8, leakRisk: 7 } },
      goals: [{ path: "hidden.loyalNetwork", min: 28, label: "忠汉网络≥28" }, { path: "hidden.leakRisk", max: 58, label: "泄密风险≤58" }, { path: "stats.security", min: 34, label: "宫廷安全≥34" }],
      reward: "缄书铜印",
      advice: "守成不能代替忠汉网络。择机密联，再留出守成或公开召见的月份，控制泄密风险。",
    },
    {
      id: "eastward_return", name: "衣冠东归", subtitle: "流亡朝廷的六个月", scenarioId: "xingping_195", duration: 6,
      intro: "粮尽路断，百官离散。先把朝廷带回关东，再谈天下名分。",
      sequence: ["scenario_195_opening", "border_bandits", "grain_price", "old_official_petition", "imperial_clothing", "seal_ceremony"],
      setup: { effects: { treasury: -4, security: -2 }, hidden: { peopleStability: -4, escapeRoute: 6 } },
      goals: [{ path: "stats.security", min: 36, label: "宫廷安全≥36" }, { path: "hidden.peopleStability", min: 40, label: "民间稳定≥40" }, { path: "stats.officials", min: 35, label: "百官支持≥35" }],
      reward: "东归车铃",
      advice: "安民与宫禁同样重要。量力赈济并照顾百官，缺钱时先筹措，避免连续密令。",
    },
    {
      id: "xudu_mutiny", name: "许都夜变", subtitle: "五个月内稳定宫城", scenarioId: "jianan_196", duration: 5,
      intro: "宿卫名籍异常、流言四起。必须在不刺激司空府的前提下恢复宫禁秩序。",
      sequence: ["palace_guard", "palace_rumor", "forged_edict", "xun_yu_memorial", "court_banquet"],
      setup: { effects: { security: -12, officials: -3, caoAlert: 6 } },
      goals: [{ path: "stats.security", min: 42, label: "宫廷安全≥42" }, { path: "stats.officials", min: 42, label: "百官支持≥42" }, { path: "stats.caoAlert", max: 82, label: "曹氏警戒≤82" }],
      reward: "宫门夜牌",
      advice: "优先恢复宿卫、保留百官支持。可以留下行动守成，不必每月用尽两次行动。",
    },
    {
      id: "abdication_eve", name: "禅代前夜", subtitle: "最后四个月的名分", scenarioId: "yankang_220", duration: 4,
      intro: "群臣已在准备新朝仪式。你未必能扭转时代，但仍能决定汉廷如何写下最后一页。",
      sequence: ["scenario_220_opening", "imperial_clothing", "old_official_petition", "final_pressure"],
      setup: { effects: { authority: -4, prestige: 4, caoAlert: 7 } },
      goals: [{ path: "stats.prestige", min: 54, label: "汉室威望≥54" }, { path: "stats.authority", min: 32, label: "皇权≥32" }, { path: "stats.security", min: 28, label: "宫廷安全≥28" }],
      reward: "残汉玉册",
      advice: "守成难以补足皇权。选择适量朝仪或任官，接近目标后留意曹氏警戒，不必连续加码。",
    },
  ];

  let store = loadStore();
  let finishing = false;

  document.addEventListener("DOMContentLoaded", init, { once: true });
  document.addEventListener("xian:core-saved", () => trackProgress());
  document.addEventListener("xian:game-entered", () => {
    const core = window.XianEmperorGame?.getState?.();
    if (core?.ended) recordResult({ state: core });
    else trackProgress();
  });
  document.addEventListener("xian:month-settled", () => { trackProgress(true); checkChallengeEnd(); });
  document.addEventListener("xian:campaign-concluded", event => recordResult(event.detail || {}));

  function init() {
    window.XianCommandCenter?.registerTab?.({
      id: "short-runs",
      label: "乱世短局",
      kicker: "v2.3.0 · 十分钟挑战",
      title: "用一段短局验证一种判断",
      render: renderTab,
      onMount: mountTab,
    });
  }

  function start(id) {
    const definition = challengeById(id);
    if (!definition || window.XianDynastySaga?.isActive?.()) return false;
    const current = window.XianEmperorGame?.getState?.();
    if (current && !current.ended && typeof window.confirm === "function" && !window.confirm("开始短局会覆盖当前单局存档，完整导出后仍可恢复。确定继续吗？")) return false;
    store.active = { kind: "curated", challengeId: definition.id, gameCreatedAt: null, startedAt: new Date().toISOString(), pendingGrade: null };
    saveStore();
    syncStartSelectors(definition);
    window.XianEmperorGame?.startNewGame?.("standard", definition.scenarioId);
    const core = window.XianEmperorGame?.getState?.();
    if (!core) { store.active = null; saveStore(); return false; }
    store.active.gameCreatedAt = core.createdAt;
    saveStore();
    window.XianEmperorGame?.applyExternalPackage?.({
      ...definition.setup,
      report: { title: `短局·${definition.name}`, text: `${definition.intro}本局持续 ${definition.duration} 个月。`, type: "important" },
      chronicle: `天子进入短局挑战“${definition.name}”。`,
    });
    beginReview();
    window.XianCommandCenter?.close?.();
    return true;
  }

  function startCustom(config) {
    if (!config?.id || !config.scenarioId || !Array.isArray(config.sequence)) return false;
    const custom = { ...config, kind: config.kind || "weekly" };
    store.customDefinitions[custom.id] = custom;
    saveStore();
    const current = window.XianEmperorGame?.getState?.();
    if (current && !current.ended && typeof window.confirm === "function" && !window.confirm("开始同题挑战会覆盖当前单局存档，确定继续吗？")) return false;
    store.active = { kind: custom.kind, challengeId: custom.id, gameCreatedAt: null, startedAt: new Date().toISOString(), pendingGrade: null };
    saveStore();
    syncStartSelectors(custom);
    window.XianEmperorGame?.startNewGame?.(custom.difficulty || "standard", custom.scenarioId, { randomSeed: custom.randomSeed });
    const core = window.XianEmperorGame?.getState?.();
    if (!core) return false;
    store.active.gameCreatedAt = core.createdAt;
    saveStore();
    window.XianEmperorGame?.applyExternalPackage?.({
      ...(custom.setup || {}),
      report: { title: custom.name, text: custom.intro || "所有玩家面对相同事件顺序。", type: "important" },
      chronicle: `天子进入挑战“${custom.name}”。`,
    });
    beginReview();
    window.XianCommandCenter?.close?.();
    return true;
  }

  function beginReview() {
    const core = window.XianEmperorGame?.getState?.();
    if (!core || !store.active || !window.XianShortReview) return;
    store.active.reviewLog = window.XianShortReview.createLog(core, true);
    saveStore();
  }

  function trackProgress(settled = false) {
    const core = window.XianEmperorGame?.getState?.();
    const active = store.active;
    if (!window.XianShortReview || !core || !active?.gameCreatedAt || active.gameCreatedAt !== core.createdAt) return;
    const before = JSON.stringify(active.reviewLog);
    // A missing log is an older run. Its original baseline must remain unknown.
    active.reviewLog ||= window.XianShortReview.createLog(core, false);
    window.XianShortReview.capture(active.reviewLog, core);
    if (settled) window.XianShortReview.settle(active.reviewLog, core);
    if (JSON.stringify(active.reviewLog) !== before) saveStore();
  }

  function selectEventId(context = {}) {
    const active = store.active;
    if (!active || (active.gameCreatedAt && active.gameCreatedAt !== context.createdAt)) return null;
    const definition = activeDefinition();
    return definition?.sequence?.[Math.max(0, Number(context.turn || 1) - 1)] || null;
  }

  function checkChallengeEnd() {
    if (finishing || !store.active) return;
    const core = window.XianEmperorGame?.getState?.() || readCore();
    const definition = activeDefinition();
    if (!core || core.ended || !definition || core.createdAt !== store.active.gameCreatedAt || Number(core.turn) < Number(definition.duration)) return;
    finishing = true;
    const grade = evaluateChallenge(definition, core);
    store.active.pendingGrade = grade;
    saveStore();
    window.XianEmperorGame?.concludeExternalEnding?.({
      title: `${definition.name}·${grade.medal === "none" ? "余烬" : medalName(grade.medal)}`,
      text: `${definition.duration}个月的限时危局已完成最后一月结算。你完成 ${grade.completed}/${grade.total} 项目标，${grade.medal === "none" ? "未获章" : `获得${medalName(grade.medal)}`}。`,
    });
    finishing = false;
  }

  function recordResult(detail) {
    if (!store.active || detail.state?.createdAt !== store.active.gameCreatedAt) return;
    const definition = activeDefinition();
    if (!definition) return;
    const endedEarly = !store.active.pendingGrade;
    const grade = store.active.pendingGrade || { ...evaluateChallenge(definition, detail.state), medal: "none", score: 0 };
    const result = {
      id: `short-${Date.now()}`,
      kind: store.active.kind,
      challengeId: definition.id,
      name: definition.name,
      gameCreatedAt: detail.state.createdAt,
      medal: grade.medal,
      completed: grade.completed,
      total: grade.total,
      score: grade.score,
      checks: grade.checks,
      endedEarly,
      finalTurn: detail.state.turn,
      endingTitle: detail.state.ending?.title || "",
      rulesVersion: 216,
      randomSeed: detail.state.random?.seed ?? null,
      reward: definition.reward || "无名史签",
      completedAt: new Date().toISOString(),
    };
    const log = store.active.reviewLog || (window.XianShortReview && window.XianShortReview.createLog(detail.state, false));
    window.XianShortReview?.capture(log, detail.state);
    result.review = window.XianShortReview?.build(result, definition, detail.state, log) || null;
    store.results.unshift(result);
    store.results = store.results.slice(0, 40);
    const old = store.best[definition.id];
    if (!old || old.rulesVersion !== result.rulesVersion || result.score > old.score) store.best[definition.id] = result;
    if (grade.medal !== "none" && !store.rewards.includes(result.reward)) store.rewards.push(result.reward);
    store.active = null;
    saveStore();
    window.XianCommandCenter?.refresh?.();
    document.dispatchEvent(new CustomEvent("xian:short-challenge-completed", { detail: { ...result } }));
  }

  function evaluateChallenge(definition, core) {
    const checks = (definition.goals || []).map(goal => {
      const value = readPath(core, goal.path);
      return { ...goal, value, passed: goal.min != null ? value >= goal.min : value <= goal.max };
    });
    const completed = checks.filter(item => item.passed).length;
    const ratio = completed / Math.max(1, checks.length);
    const medal = ratio >= 1 ? "gold" : ratio >= .66 ? "silver" : ratio >= .33 ? "bronze" : "none";
    return { checks, completed, total: checks.length, medal, score: Math.round(ratio * 1000 + Number(core.stats?.prestige || 0) * 2 + Number(core.stats?.authority || 0)) };
  }

  function getActiveStatus(core = readCore()) {
    const definition = activeDefinition();
    if (!core || core.ended || !store.active || !definition || (store.active.gameCreatedAt && store.active.gameCreatedAt !== core.createdAt)) return null;
    return { id: definition.id, name: definition.name, duration: definition.duration, advice: definition.advice || "最终目标在最后一月结算后核验。",
      checks: evaluateChallenge(definition, core).checks };
  }

  function refreshStatus(core = readCore()) {
    const panel = document.getElementById("short-challenge-status");
    if (!panel) return;
    const status = getActiveStatus(core);
    panel.hidden = !status;
    if (!status) return;
    panel.innerHTML = `<div class="short-status-heading"><strong>${escapeHtml(status.name)}</strong><span>第 ${core.turn}/${status.duration} 月 · 最后 ${Math.max(1, status.duration - core.turn + 1)} 个月</span></div>
      <div class="short-status-goals">${status.checks.map(check => {
        const gap = check.min != null ? Math.max(0, check.min - check.value) : Math.max(0, check.value - check.max);
        return `<span class="${check.passed ? "passed" : "pending"}">${escapeHtml(check.label)} · 当前 ${check.value}${gap ? ` · ${check.min != null ? "尚差" : "须降低"} ${gap}` : " · 已达当前目标"}</span>`;
      }).join("")}</div><p>${escapeHtml(status.advice)} 当前值供理政参考，奖章以最后一月结算后的结果为准。</p>`;
  }

  function renderTab() {
    const active = store.active;
    const activeDef = activeDefinition();
    const sagaActive = window.XianDynastySaga?.isActive?.();
    return `
      ${active && activeDef ? renderActive(activeDef) : `<div class="short-intro"><span>不增加永久倍率</span><strong>一局只解决一种危机</strong><p>固定月份与事件顺序，适合在十至二十分钟内完成。奖励仅为史签与纪念物。</p></div>`}
      ${sagaActive ? '<div class="short-warning">汉祚长卷进行中，完成或退出长卷后才能开启短局。</div>' : ""}
      <section class="short-grid">${CHALLENGES.map(item => renderCard(item, sagaActive || Boolean(active))).join("")}</section>
      <section class="short-rewards"><h3>短局纪念物</h3><div>${store.rewards.length ? store.rewards.map(item => `<span>${escapeHtml(item)}</span>`).join("") : "<p>完成至少一项目标即可获得纪念物。</p>"}</div></section>
      ${store.results.length ? `<section class="short-history"><h3>最近短局 · 点击查看复盘</h3>${store.results.slice(0, 6).map(result => `<details><summary>${escapeHtml(result.name)} · ${medalName(result.medal)} · ${result.completed}/${result.total}${result.endedEarly ? " · 提前终局" : ""}</summary><div class="short-ending-review">${reviewHtml(result)}</div></details>`).join("")}</section>` : ""}`;
  }

  function renderActive(definition) {
    const core = readCore();
    const grade = core ? evaluateChallenge(definition, core) : null;
    return `<div class="short-active"><div><span>短局进行中 · 第 ${core?.turn || 1}/${definition.duration} 月</span><strong>${escapeHtml(definition.name)}</strong><p>${escapeHtml(definition.intro)}成绩在最后一月用度与风险结算后核验。</p></div><section>${(grade?.checks || definition.goals).map(goal => `<i class="${goal.passed ? "pass" : ""}">${goal.passed ? "✓" : "○"} ${escapeHtml(goal.label)}${goal.value != null ? `（${Math.round(goal.value)}）` : ""}</i>`).join("")}</section></div>`;
  }

  function renderCard(item, disabled) {
    const best = store.best[item.id];
    return `<article class="short-card"><header><div><span>${item.duration}个月</span><strong>${escapeHtml(item.name)}</strong></div>${best ? `<b class="${best.medal}">${medalName(best.medal)}</b>` : ""}</header><p>${escapeHtml(item.subtitle)}</p><div>${item.goals.map(goal => `<small>${escapeHtml(goal.label)}</small>`).join("")}</div><footer><span>纪念物：${escapeHtml(item.reward)}</span><button type="button" data-short-start="${item.id}" ${disabled ? "disabled" : ""}>开始短局</button></footer></article>`;
  }

  function mountTab(root) {
    root.querySelectorAll("[data-short-start]").forEach(button => button.addEventListener("click", () => start(button.dataset.shortStart)));
  }

  function getResultForGame(createdAt) { return store.results.find(result => result.gameCreatedAt === createdAt) || null; }

  function getReview(result, core = {}) {
    return result?.review || window.XianShortReview?.build(result, challengeById(result.challengeId) || store.customDefinitions[result.challengeId], core);
  }

  function reviewHtml(result, core = {}) {
    const review = getReview(result, core);
    return review ? window.XianShortReview.html(review) : `<p>完成 ${result.completed}/${result.total} 项目标。</p>`;
  }

  function renderEndingReview(core) {
    const panel = document.getElementById("short-ending-review");
    if (!panel) return;
    const result = core?.ended ? getResultForGame(core.createdAt) : null;
    panel.hidden = !result;
    if (!result) { panel.innerHTML = ""; return; }
    const definition = challengeById(result.challengeId) || store.customDefinitions[result.challengeId];
    panel.innerHTML = reviewHtml(result, core) + `<p class="short-review-reward">${result.medal === "none" ? "未收录纪念物" : `收录“${escapeHtml(result.reward)}”`}</p>`
      + (definition ? `<button type="button" class="primary-button" data-short-retry="">再试此短局</button>` : "");
    panel.querySelector("[data-short-retry]")?.addEventListener("click", () => {
      if (challengeById(result.challengeId)) start(result.challengeId);
      else startCustom(definition);
    });
  }

  function formatReviewText(core) {
    const result = core && getResultForGame(core.createdAt);
    const review = result && getReview(result, core);
    return review ? window.XianShortReview.text(review) : "";
  }

  function syncStartSelectors(definition) {
    const scenario = document.getElementById("scenario-select");
    const difficulty = document.getElementById("difficulty-select");
    if (scenario) { scenario.disabled = false; scenario.value = definition.scenarioId; scenario.dispatchEvent(new Event("change", { bubbles: true })); }
    if (difficulty) difficulty.value = definition.difficulty || "standard";
  }

  function activeDefinition() { return store.active ? challengeById(store.active.challengeId) || store.customDefinitions[store.active.challengeId] : null; }
  function challengeById(id) { return CHALLENGES.find(item => item.id === id); }
  function readPath(value, path) { return Number(String(path).split(".").reduce((result, key) => result?.[key], value) || 0); }
  function medalName(id) { return ({ gold: "金章", silver: "银章", bronze: "铜章", none: "未获章" })[id] || "未获章"; }
  function defaultStore() { return { version: 1, active: null, results: [], best: {}, rewards: [], customDefinitions: {} }; }
  function loadStore() { try { const value = JSON.parse(localStorage.getItem(STORE_KEY) || "null"); return { ...defaultStore(), ...(value || {}), results: Array.isArray(value?.results) ? value.results : [], best: value?.best || {}, rewards: Array.isArray(value?.rewards) ? value.rewards : [], customDefinitions: value?.customDefinitions || {} }; } catch (_) { return defaultStore(); } }
  function saveStore() { try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (error) { console.warn("短局挑战保存失败", error); } }
  function readCore() { try { const value = JSON.parse(localStorage.getItem(CORE_KEY) || "null"); return value?.stats ? value : null; } catch (_) { return null; } }
  function escapeHtml(value) { return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]); }

  window.XianShortChallenges = Object.freeze({
    selectEventId,
    evaluateChallenge,
    getActiveStatus,
    refreshStatus,
    getResultForGame,
    renderEndingReview,
    formatReviewText,
    start,
    startCustom,
    getChallenges: () => JSON.parse(JSON.stringify(CHALLENGES)),
    getState: () => JSON.parse(JSON.stringify(store)),
  });
})();
