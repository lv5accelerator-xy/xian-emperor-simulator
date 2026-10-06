/* 天子蒙尘：献帝模拟器 v1.6.0 · 御前总览 */
(() => {
  "use strict";

  const CORE_KEY = "xian_emperor_simulator_v01";
  const STORE_KEY = "xian_emperor_command_center_v160";
  const ACTION_ADVICE = {
    audience: ["改善一名人物的态度", "适合修补关键关系"],
    appointment: ["以官爵换取支持", "皇权上升，但会刺激曹氏"],
    secret: ["扩大忠汉网络", "高收益，同时增加泄密风险"],
    revenue: ["补充国库钱粮", "节流、催贡或借调都伴随政治代价"],
    relief: ["用国库换民心与威望", "国库紧张时应谨慎"],
    ritual: ["恢复朝廷名分", "适合威望或皇权不足时"],
    appease: ["降低曹氏警戒", "安全增加，但独立形象受损"],
    regional: ["建立外部制衡", "适合曹氏警戒偏高时"],
  };
  const TAB_GROUPS = [
    { id: "month", label: "本月", tabs: ["brief", "monthly", "guide"] },
    { id: "court", label: "朝局", tabs: ["people", "marks", "echoes"] },
    { id: "challenge", label: "挑战", tabs: ["short-runs", "weekly"] },
    { id: "history", label: "史册", tabs: ["historian", "saga", "verdict"] },
  ];

  const tabs = new Map();
  let activeTab = "brief";
  let core = null;
  let store = loadStore();
  let overlay;

  document.addEventListener("DOMContentLoaded", init, { once: true });
  document.addEventListener("xian:core-saved", () => queueRefresh());
  document.addEventListener("xian:quarterly-agenda-updated", () => queueRefresh());
  window.addEventListener?.("storage", event => {
    if (event.key === CORE_KEY || event.key === STORE_KEY) queueRefresh();
  });

  registerTab({
    id: "brief",
    label: "本月要务",
    kicker: "v1.6.0 · 御前减负",
    title: "此刻只处理三件事",
    render: renderBriefTab,
  });

  registerTab({
    id: "guide",
    label: "新手指引",
    kicker: "因局势而变的提示",
    title: "从奏报走到月末",
    render: renderGuideTab,
  });

  function init() {
    installFocusStrip();
    installOverlay();
    installUtilityButton();
    bindOverlay();
    refresh();
  }

  function installFocusStrip() {
    if (document.getElementById("imperial-focus-strip")) return;
    const shell = document.getElementById("game-shell");
    const main = shell?.querySelector(".game-main");
    if (!shell || !main) return;
    const strip = document.createElement("section");
    strip.id = "imperial-focus-strip";
    strip.className = "imperial-focus-strip";
    strip.setAttribute("aria-live", "polite");
    main.before(strip);
  }

  function installOverlay() {
    if (document.getElementById("command-center-overlay")) {
      overlay = document.getElementById("command-center-overlay");
      return;
    }
    overlay = document.createElement("div");
    overlay.id = "command-center-overlay";
    overlay.className = "command-center-overlay hidden";
    document.body.appendChild(overlay);
  }

  function installUtilityButton() {
    const nav = document.querySelector(".utility-nav");
    if (!nav || document.getElementById("imperial-command-btn")) return;
    const button = document.createElement("button");
    button.id = "imperial-command-btn";
    button.type = "button";
    button.dataset.uiIcon = "要";
    button.textContent = "总览";
    button.addEventListener("click", () => open("brief"));
    nav.prepend(button);
  }

  function bindOverlay() {
    overlay?.addEventListener("click", event => {
      if (event.target === overlay || event.target.closest("[data-command-close]")) return close();
      const tabButton = event.target.closest("[data-command-tab]");
      if (tabButton) {
        activeTab = tabButton.dataset.commandTab;
        renderOverlay();
        return;
      }
      const groupButton = event.target.closest("[data-command-group]");
      if (groupButton) {
        const group = TAB_GROUPS.find(item => item.id === groupButton.dataset.commandGroup);
        const nextTab = group?.tabs.find(id => tabs.has(id));
        if (nextTab) activeTab = nextTab;
        renderOverlay();
        return;
      }
      const jump = event.target.closest("[data-command-jump]");
      if (jump) {
        close();
        jumpTo(jump.dataset.commandJump);
      }
      const guide = event.target.closest("[data-command-guide-done]");
      if (guide) {
        if (core?.scenarioId) store.seenScenarios[core.scenarioId] = true;
        saveStore();
        activeTab = "brief";
        refresh();
        renderOverlay();
      }
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && overlay && !overlay.classList.contains("hidden")) close();
    });
  }

  let refreshTimer = 0;
  function queueRefresh() {
    clearTimeout(refreshTimer);
    refreshTimer = setTimeout(refresh, 60);
  }

  function refresh() {
    core = readCore();
    renderFocusStrip();
    enhanceActionCards();
    if (overlay && !overlay.classList.contains("hidden")) renderOverlay();
  }

  function renderFocusStrip() {
    const strip = document.getElementById("imperial-focus-strip");
    if (!strip) return;
    if (!core || core.ended) {
      strip.innerHTML = "";
      strip.hidden = true;
      return;
    }
    strip.hidden = false;
    const focus = getFocus(core);
    const recommendation = recommendAction(core);
    const firstVisit = !store.seenScenarios[core.scenarioId];
    strip.innerHTML = `
      <div class="focus-copy">
        <span class="section-kicker">本月要务</span>
        <strong>${escapeHtml(focus.title)}</strong>
        <small>${escapeHtml(focus.detail)}</small>
      </div>
      <div class="focus-recommendation"><span>建议</span><strong>${escapeHtml(recommendation.label)}</strong><small>${escapeHtml(recommendation.benefit || recommendation.reason)}</small>${recommendation.cost ? `<small>代价：${escapeHtml(recommendation.cost)}</small>` : ""}</div>
      <div class="focus-actions">
        ${firstVisit ? '<button type="button" data-focus-open="guide" class="focus-guide">第一次到此剧本 · 查看指引</button>' : ""}
        <button type="button" data-focus-jump="${focus.target}">${escapeHtml(focus.button)}</button>
        <button type="button" data-focus-open="brief">展开总览</button>
      </div>`;
    strip.querySelectorAll("[data-focus-open]").forEach(button => button.addEventListener("click", () => open(button.dataset.focusOpen)));
    strip.querySelectorAll("[data-focus-jump]").forEach(button => button.addEventListener("click", () => jumpTo(button.dataset.focusJump)));
  }

  function enhanceActionCards() {
    const recommendation = core ? recommendAction(core) : null;
    document.querySelectorAll("#action-grid [data-action-id]").forEach(button => {
      const id = button.dataset.actionId;
      const advice = ACTION_ADVICE[id];
      if (!advice) return;
      let note = button.querySelector(".command-consequence");
      if (!note) {
        note = document.createElement("small");
        note.className = "command-consequence";
        button.querySelector("span:last-child")?.appendChild(note);
      }
      note.textContent = advice[1];
      button.classList.toggle("command-recommended", recommendation?.actionId === id);
    });
  }

  function getFocus(state) {
    if (!state.eventResolved) return { title: "先裁决本月奏报", detail: "裁决后才可拟旨或施行御前行动。", target: "event", button: "前往奏报" };
    const rec = recommendAction(state);
    if (rec.actionId === "end") return { title: rec.label, detail: rec.reason, target: "end", button: "查看月末预检" };
    if (Number(state.actionPoints || 0) > 0) return { title: `尚可行动 ${state.actionPoints} 次`, detail: "选择一项最能处理当前危险的行动；不必把所有系统都打开。", target: "actions", button: "查看行动" };
    return { title: "本月行动已经用尽", detail: "检查警告后即可结束本月，未处理的扩展页面不会产生惩罚。", target: "end", button: "结束本月" };
  }

  function recommendActionCategory(state) {
    const stats = state?.stats || {};
    const hidden = state?.hidden || {};
    if (!state?.eventResolved) return { actionId: "event", label: "裁决奏报", reason: "所有行动都要在本月奏报裁决后进行。" };
    if (Number(state.actionPoints ?? 2) <= 0) return { actionId: "end", label: "结束本月", reason: "本月行动已用尽，核对风险后进入月末结算。" };
    if (state.monthlySettledTurn >= state.turn) return { actionId: "end", label: "继续月末核验", reason: "固定结算已完成，本月不能再安排新行动。" };
    if ((stats.caoAlert || 0) >= 85) return { actionId: "appease", label: "安抚曹氏", reason: "警戒接近 100 的失败线。可先公开褒奖，避免继续密联或扩权。" };
    if ((stats.security ?? 50) <= 20) return { actionId: "appease", label: "安抚曹氏 · 修复宿卫", reason: "安全接近崩溃。暂授军务便宜可换安全 +6，但皇权 −6；先保住本局。" };
    if ((stats.prestige ?? 50) <= 15) return { actionId: stats.treasury >= 6 ? "ritual" : "revenue", label: stats.treasury >= 6 ? "整饬朝仪 · 祭告宗庙" : "先筹措仪典用度", reason: "威望接近零的失败线。祭告宗庙需国库 5，另留月末用度 1。" };
    if ((stats.treasury || 0) <= 12) return { actionId: "revenue", label: "筹措钱粮", reason: "国库已近枯竭，先补用度；核减冗费会降低百官支持，借调会降低皇权。" };
    const short = window.XianShortChallenges?.getActiveStatus?.(state);
    if (short) return recommendShortAction(state, short);
    if ((stats.caoAlert || 0) >= 72) return { actionId: "appease", label: "安抚曹氏", reason: "曹氏警戒偏高，先换取政治空间。" };
    if ((stats.treasury || 0) <= 24) return { actionId: "revenue", label: "筹措钱粮", reason: "国库偏低，先补用度，并核对筹措方案的政治代价。" };
    if ((stats.security ?? 50) <= 28) return { actionId: "appease", label: "安抚曹氏 · 修复宿卫", reason: "宫禁已经松动。暂授军务便宜可换安全 +6，但皇权 −6。" };
    if ((hidden.peopleStability || 0) <= 35 && (stats.treasury || 0) >= 28) return { actionId: "relief", label: "赈济减赋", reason: "民间稳定偏低，继续拖延会反噬威望与宫廷安全。" };
    if ((hidden.leakRisk || 0) >= 55) return { actionId: "audience", label: "召见人物", reason: "泄密风险偏高，暂缓密令并修补关键关系。" };
    const quarterly = window.XianQuarterlyAgenda?.getState?.();
    if (quarterly?.gameCreatedAt === state.createdAt && quarterly.active && window.XianQuarterlyAgenda.calculateProgress(state) < 100) {
      const choices = {
        restore_treasury: ["revenue", "筹措钱粮", "御题度支有继需要国库净增长，先补用度。"],
        steady_court: ["audience", "召见人物", "御题朝议归一需要百官支持，优先修补朝臣关系。"],
        settle_people: ["relief", "赈济减赋", "御题安集黎庶需要民间稳定，注意预留后续财政。"],
        secure_palace: ["appease", "安抚曹氏", "御题清宁宫禁需要安全净增长，避免新增泄密。"],
        renew_mandate: ["ritual", "恢复朝仪", "御题重申汉命需要皇权净增长，并维持汉室威望。"],
      };
      const choice = choices[quarterly.active.id];
      if (choice) {
        if (["relief", "ritual"].includes(choice[0]) && stats.treasury < 5) return { actionId: "revenue", label: "先筹措御题用度", reason: "御题行动至少需要国库 4，并应留出月末用度 1。" };
        return { actionId: choice[0], label: choice[1], reason: choice[2] };
      }
    }
    const progression = window.XianImperialProgress?.getState?.();
    if (progression?.session?.gameCreatedAt === state.createdAt) {
      const choice = { guard: ["appease", "安抚曹氏", "宿卫方略先稳住宫廷安全，再经营直属力量。"], balance: ["regional", "结交外镇", "外镇方略需要地方关系与制衡，先取得可兑现的合作。"], covert: ["secret", "派遣密使", "忠汉方略需要可信密线；注意控制泄密与曹氏警戒。"] }[progression.session.pathId];
      if (choice) return { actionId: choice[0], label: choice[1], reason: choice[2] };
    }
    if ((hidden.externalBalance || 0) <= 35) return { actionId: "regional", label: "结交外镇", reason: "朝廷缺少外部制衡，地方承认能牵制一方独大。" };
    if ((stats.authority || 0) <= 45) return { actionId: "appointment", label: "任免封赏", reason: "皇权偏弱，可借官爵重新建立中枢存在感。" };
    return { actionId: "audience", label: "召见人物", reason: "当前没有迫近的数值危机，适合经营关键人物关系。" };
  }

  function planScore(state, next, goals) {
    const checks = window.XianMonthlySafety.preview(next, goals).checks;
    let score = 0;
    for (const check of checks) {
      const margin = check.min != null ? check.after - check.min : check.max - check.after;
      score -= check.gap * 18 + (check.afterPassed ? 0 : 90);
      score -= Math.max(0, (check.min != null ? 2 : 3) - margin) * 4;
    }
    // The recommendation reads the present position; it never draws future randomness.
    score += .05 * (next.stats.security - next.stats.caoAlert - next.hidden.leakRisk);
    score -= Math.max(0, 30 - next.stats.security) * 6;
    score -= Math.max(0, next.stats.caoAlert - 72) * 5;
    score -= Math.max(0, next.hidden.leakRisk - 35) * 1.5;
    score -= Math.max(0, 18 - next.stats.prestige) * 6;
    const short = window.XianShortChallenges?.getActiveStatus?.(state);
    const reserve = short ? Math.max(1, short.duration - state.turn + 1) : 1;
    score -= Math.max(0, reserve - next.stats.treasury) * 8;
    score -= Math.max(0, state.stats.treasury - next.stats.treasury) * .4;
    return score;
  }

  function concreteAdvice(state, plan, prefix, goals = []) {
    const before = window.XianMonthlySafety.preview(state, goals);
    const next = window.XianActionPlans.project(state, plan);
    const after = window.XianMonthlySafety.preview(next, goals);
    const changed = after.checks.filter((item, index) => item.after !== before.checks[index].after)
      .map((item, index) => `${item.label}预计 ${Math.round(before.checks.find(check => check.path === item.path).after)} → ${Math.round(item.after)}`);
    const names = { ...Object.fromEntries(Object.entries(window.GAME_DATA.statMeta).map(([key, value]) => [key, value.name])), leakRisk: "泄密风险", peopleStability: "民间稳定", loyalNetwork: "忠汉网络", externalBalance: "外部制衡" };
    const costs = [["stats", plan.effects], ["hidden", plan.hidden]].flatMap(([group, changes]) => Object.entries(changes)
      .filter(([key, delta]) => key === "caoAlert" || key === "leakRisk" ? delta > 0 : delta < 0)
      .map(([key, delta]) => `${names[key] || key}${delta > 0 ? "+" : ""}${delta}`));
    return { actionId: plan.actionId, fields: { ...plan.fields }, label: plan.label, ...summarizePlan(state, plan),
      reason: `${prefix}${changed.length ? changed.join("；") + "。" : ""}${costs.length ? "代价：" + costs.join("、") + "。" : "不耗国库。"}比较已计入固定月末用度；即时回响与随机风险仍会改变结果。` };
  }

  function metricName(path) {
    const key = path.split(".")[1];
    return window.GAME_DATA.statMeta[key]?.name || ({ loyalNetwork: "忠汉网络", leakRisk: "泄密风险", peopleStability: "民间稳定", externalBalance: "外部制衡", escapeRoute: "安全退路" })[key] || key;
  }
  const signed = value => `${value > 0 ? "+" : ""}${Math.round(value * 100) / 100}`;
  const direction = path => /\.(caoAlert|leakRisk)$/.test(path) ? -1 : 1;

  function summarizePlan(state, plan) {
    const next = window.XianActionPlans.project(state, plan);
    const changes = ["stats", "hidden"].flatMap(group => Object.keys(state[group]).map(key => ({
      path: `${group}.${key}`, delta: next[group][key] - state[group][key],
    })).filter(item => item.delta !== 0));
    const gains = changes.filter(item => direction(item.path) * item.delta > 0);
    const losses = changes.filter(item => item.path !== "stats.treasury" && direction(item.path) * item.delta < 0);
    return { benefit: gains.slice(0, 3).map(item => `${metricName(item.path)} ${signed(item.delta)}`).join(" · ") || "经营人物关系",
      cost: [`行动 1`, plan.cost ? `国库 ${plan.cost}` : "不耗国库", ...losses.slice(0, 2).map(item => `${metricName(item.path)} ${signed(item.delta)}`)].join(" · ") };
  }

  function compareActions(state) {
    if (!state || state.ended || !state.eventResolved || state.actionPoints <= 0 || state.monthlySettledTurn >= state.turn) {
      return { available: false, reason: "裁决奏报后且本月仍可行动时，才能比较方案。", choices: [] };
    }
    const goals = window.XianShortChallenges?.getActiveStatus?.(state)?.checks || [];
    const baseline = window.XianMonthlySafety.preview(state, goals);
    const recommendation = recommendAction(state);
    const make = (plan, recommended = false) => {
      const next = plan ? window.XianActionPlans.project(state, plan) : state;
      const estimate = window.XianMonthlySafety.preview(next, goals);
      const relations = Object.entries(plan?.relations || {}).flatMap(([id, delta]) => {
        const before = state.relations?.[id] ?? 50;
        const actual = Math.max(0, Math.min(100, before + delta)) - before;
        return actual ? [{ name: window.GAME_DATA.characters.find(person => person.id === id)?.name || id, delta: actual }] : [];
      });
      const paths = ["stats", "hidden"].flatMap(group => Object.keys(state[group]).map(key => `${group}.${key}`));
      const vector = paths.map(path => { const [group, key] = path.split("."); return direction(path) * estimate.projected[group][key]; });
      vector.push(relations.reduce((sum, item) => sum + item.delta, 0));
      const changes = paths.map(path => {
        const [group, key] = path.split(".");
        return { path, name: metricName(path), before: state[group][key], immediate: next[group][key], fixed: estimate.projected[group][key],
          versusGuard: estimate.projected[group][key] - baseline.projected[group][key] };
      }).filter(item => item.immediate !== item.before || item.fixed !== item.before || goals.some(goal => goal.path === item.path));
      const summary = plan ? summarizePlan(state, plan) : {
        benefit: `保留 ${state.actionPoints} 次行动，守成收益计入下方月末预估`, cost: "不再消耗行动或国库；月末固定用度仍会结算",
      };
      return { actionId: plan?.actionId || "end", fields: plan ? { ...plan.fields } : null,
        label: plan?.label || `留 ${state.actionPoints} 次行动守成`, recommended, ...summary, changes, relations,
        checks: estimate.checks, leak: estimate.leak, vector, plan,
        score: goals.length ? planScore(state, next, goals) : vector.slice(0, -1).reduce((sum, value, index) => sum + (value - direction(paths[index]) * baseline.projected[paths[index].split(".")[0]][paths[index].split(".")[1]]), 0) };
    };
    const guard = make(null, recommendation.actionId === "end");
    const plans = window.XianActionPlans.list(state).filter(plan => plan.affordable && state.stats.treasury - plan.cost >= 1);
    const records = plans.map(plan => make(plan));
    const key = item => JSON.stringify([item.actionId, item.fields]);
    const advised = recommendation.fields && window.XianActionPlans.build(recommendation.actionId, recommendation.fields, state);
    const primary = advised?.affordable && state.stats.treasury - advised.cost >= 1 ? make(advised, true) : { ...guard, recommended: true };
    const dominates = (a, b) => a.vector.every((value, index) => value >= b.vector[index]) && a.vector.some((value, index) => value > b.vector[index]);
    // Same numeric outcomes are one candidate; a different target is still selectable in its original menu.
    const unique = new Map();
    for (const item of [primary, ...records]) {
      const signature = JSON.stringify(item.vector);
      if (!unique.has(signature)) unique.set(signature, item);
    }
    const all = [...unique.values(), guard];
    const candidates = [...unique.values()].filter(item => item.plan && key(item) !== key(primary)
      && item.vector.some((value, index) => value > primary.vector[index])
      && item.vector.some((value, index) => value < primary.vector[index])
      && ["security", "prestige"].every(key => window.XianActionPlans.project(state, item.plan).stats[key] > 0)
      && !item.changes.some(row => row.path === "stats.caoAlert" && row.immediate >= 100)
      && !all.some(other => dominates(other, item))).sort((a, b) => b.score - a.score || a.plan.cost - b.plan.cost);
    const alternatives = [];
    for (const item of candidates) {
      if (alternatives.some(other => other.actionId === item.actionId)) continue;
      alternatives.push(item);
      if (alternatives.length === 2) break;
    }
    const choices = primary.actionId === "end" ? [primary, ...alternatives] : [primary, ...alternatives, guard];
    return { available: true, gameCreatedAt: state.createdAt, turn: state.turn, actionPoints: state.actionPoints,
      choices: choices.map(({ vector, plan, score, ...item }) => item),
      note: "数值为当前方案与固定月末结算的预估。即时回应、后续回响和随机风险仍会改变实际结果。候选按已知数值筛选，人物后续故事另计。" };
  }

  function recommendAction(state) {
    const recommendation = recommendActionCategory(state);
    if (recommendation.fields || ["event", "end"].includes(recommendation.actionId) || !window.XianActionPlans) return recommendation;
    const short = window.XianShortChallenges?.getActiveStatus?.(state);
    let plans = window.XianActionPlans.list(state).filter(plan => plan.actionId === recommendation.actionId && plan.affordable);
    if (recommendation.label.includes("修复宿卫")) plans = plans.filter(plan => plan.fields["appease-type"] === "military");
    if (recommendation.label.includes("祭告宗庙")) plans = plans.filter(plan => plan.fields["ritual-type"] === "temple");
    const goals = short?.checks || [];
    const weights = { authority: 1, prestige: .7, security: 1.4, officials: .8, treasury: .3, caoAlert: -1.5,
      leakRisk: -1, loyalNetwork: .3, peopleStability: .5, externalBalance: .5 };
    const scored = plans.map(plan => ({ plan, score: goals.length ? planScore(state, window.XianActionPlans.project(state, plan), goals)
      : Object.entries({ ...plan.effects, ...plan.hidden }).reduce((sum, [key, delta]) => sum + delta * (weights[key] || 0), 0) }));
    scored.sort((a, b) => b.score - a.score || a.plan.cost - b.plan.cost);
    return scored[0] ? concreteAdvice(state, scored[0].plan, recommendation.reason, goals) : recommendation;
  }

  function recommendShortAction(state, short) {
    const preview = window.XianMonthlySafety.preview(state, short.checks);
    const guard = reason => ({ actionId: "end", label: "留行动守成", reason: `${reason}余下 ${state.actionPoints} 次行动可换安全与泄密控制。先查看月末预检；随机风险仍需留意。` });
    const ample = preview.checks.every(check => check.afterPassed && (check.min == null || check.after >= check.min + 2) && (check.max == null || check.after <= check.max - 3));
    if (ample && state.hidden.leakRisk < 55) return guard("短局目标在固定结算后均有余量。可保住现有成果。");
    const baseline = planScore(state, state, short.checks);
    const plans = window.XianActionPlans.list(state).filter(plan => plan.affordable && state.stats.treasury - plan.cost >= 1);
    const ranked = plans.map(plan => ({ plan, score: planScore(state, window.XianActionPlans.project(state, plan), short.checks) }));
    ranked.sort((a, b) => b.score - a.score || a.plan.cost - b.plan.cost);
    if (!ranked.length || ranked[0].score <= baseline + .01) return guard("已比较可行方案，没有比保留行动更稳妥的目标改善。");
    return concreteAdvice(state, ranked[0].plan, `${short.name}：同时比较全部目标与行动代价。`, short.checks);
  }

  function renderBriefTab() {
    if (!core) return '<div class="command-empty">开启或读取一局后，此处会给出当月要务。</div>';
    const focus = getFocus(core);
    const rec = recommendAction(core);
    const warnings = collectWarnings(core);
    return `
      <div class="command-hero"><span>${escapeHtml(focus.title)}</span><strong>${escapeHtml(rec.label)}</strong><p>${escapeHtml(rec.benefit || rec.reason)}</p>${rec.cost ? `<p>代价：${escapeHtml(rec.cost)}</p><details><summary>详细依据</summary><p>${escapeHtml(rec.reason)}</p></details>` : ""}</div>
      <div class="command-three-steps">
        ${stepCard("一", "裁决奏报", core.eventResolved, "event")}
        ${stepCard("二", "使用御前行动", Number(core.actionPoints || 0) <= 0, "actions")}
        ${stepCard("三", "结束本月", false, "end")}
      </div>
      <section class="command-section"><h3>只需注意这些风险</h3><div class="command-warning-list">${warnings.map(item => `<article class="${item.level}"><strong>${escapeHtml(item.title)}</strong><span>${escapeHtml(item.text)}</span></article>`).join("")}</div></section>`;
  }

  function renderGuideTab() {
    const scenario = window.GAME_DATA?.scenarios?.find(item => item.id === core?.scenarioId);
    return `
      <div class="command-guide-intro"><span class="command-guide-seal">汉</span><div><strong>${escapeHtml(scenario?.name || "献帝朝局")}</strong><p>${escapeHtml(scenario?.summary || "以有限行动维持朝廷，并争取不由他人书写的结局。")}</p></div></div>
      <ol class="command-guide-list">
        <li><strong>先看中央奏报</strong><span>每月只必须处理一件奏报，选项下方已经写明主要收益与代价。</span></li>
        <li><strong>再安排御前行动</strong><span>优先处理御前总览提示的红色风险；天下、军团和政议都是可选深度。</span></li>
        <li><strong>最后结束本月</strong><span>行动次数可以留空，剩余行动会转化为谨慎守成，不会白白消失。</span></li>
        <li><strong>不必追求全满</strong><span>皇权增长会刺激警戒，强力密令会增加泄密。稳定的取舍才是本作核心。</span></li>
      </ol>
      <button type="button" class="primary-button" data-command-guide-done>知道了，开始临朝</button>`;
  }

  function stepCard(number, title, complete, target) {
    return `<button type="button" data-command-jump="${target}" class="${complete ? "complete" : ""}"><span>${complete ? "✓" : number}</span><strong>${title}</strong></button>`;
  }

  function collectWarnings(state) {
    const s = state.stats || {};
    const h = state.hidden || {};
    const result = [];
    if ((s.caoAlert || 0) >= 72) result.push({ level: "danger", title: "曹氏警戒", text: "达到 100 将直接失败；避免继续扩张皇权或使用密令。" });
    if ((s.security || 0) <= 30) result.push({ level: "danger", title: "宫廷安全", text: "宫禁已经脆弱，应优先换取宿卫与安全。" });
    if ((s.treasury || 0) <= 24) result.push({ level: "warning", title: "国库", text: "俸粮不足会同时拖累百官与汉室威望。" });
    if ((h.peopleStability || 0) <= 35) result.push({ level: "warning", title: "民间稳定", text: "继续恶化会造成威望与宫廷安全的连锁损失。" });
    if ((h.leakRisk || 0) >= 55) result.push({ level: "warning", title: "泄密风险", text: "私会与密令更容易被察觉，宜暂缓隐秘行动。" });
    if (!result.length) result.push({ level: "safe", title: "局势尚可控制", text: "没有指标逼近失败线，可以按长期方略经营人物与天下。" });
    return result.slice(0, 3);
  }

  function registerTab(tab) {
    if (!tab?.id || typeof tab.render !== "function") return false;
    tabs.set(tab.id, tab);
    if (overlay && !overlay.classList.contains("hidden")) renderOverlay();
    return true;
  }

  function open(tabId = "brief") {
    if (!overlay) installOverlay();
    activeTab = tabs.has(tabId) ? tabId : "brief";
    renderOverlay();
    overlay.classList.remove("hidden");
    document.body.classList.add("command-center-open");
  }

  function close() {
    overlay?.classList.add("hidden");
    document.body.classList.remove("command-center-open");
  }

  function renderOverlay() {
    if (!overlay) return;
    const tab = tabs.get(activeTab) || tabs.get("brief");
    const activeGroup = groupForTab(tab.id);
    const groupTabs = activeGroup.tabs.map(id => tabs.get(id)).filter(Boolean);
    overlay.innerHTML = `
      <section class="command-center-window" role="dialog" aria-modal="true" aria-labelledby="command-center-title">
        <header><div><span>${escapeHtml(tab.kicker || "御前总览")}</span><h2 id="command-center-title">${escapeHtml(tab.title || tab.label)}</h2></div><button type="button" data-command-close aria-label="关闭">×</button></header>
        <nav class="command-group-nav" aria-label="总览分组">${TAB_GROUPS.map(group => `<button type="button" data-command-group="${group.id}" class="${group.id === activeGroup.id ? "active" : ""}">${escapeHtml(group.label)}</button>`).join("")}</nav>
        <nav class="command-tab-nav" aria-label="${escapeHtml(activeGroup.label)}栏目">${groupTabs.map(item => `<button type="button" data-command-tab="${item.id}" class="${item.id === tab.id ? "active" : ""}">${escapeHtml(item.label)}</button>`).join("")}</nav>
        <main>${tab.render({ core: clone(core), store: clone(store) })}</main>
      </section>`;
    tab.onMount?.(overlay.querySelector("main"), { core: clone(core), refresh });
  }

  function groupForTab(tabId) {
    return TAB_GROUPS.find(group => group.tabs.includes(tabId)) || TAB_GROUPS[0];
  }

  function jumpTo(target) {
    const selectors = { event: ".event-panel", actions: ".action-panel", end: "#end-turn-btn" };
    const element = document.querySelector(selectors[target] || target);
    element?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (target === "end" && element && !element.disabled) element.classList.add("command-pulse");
    setTimeout(() => element?.classList.remove("command-pulse"), 1400);
  }

  function loadStore() {
    try {
      const value = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
      return { version: 1, seenScenarios: {}, ...(value && typeof value === "object" ? value : {}) };
    } catch (_) {
      return { version: 1, seenScenarios: {} };
    }
  }

  function saveStore() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); }
    catch (error) { console.warn("御前总览设置保存失败", error); }
  }

  function readCore() {
    try {
      const value = JSON.parse(localStorage.getItem(CORE_KEY) || "null");
      return value && value.stats && value.hidden ? value : null;
    } catch (_) { return null; }
  }

  function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }
  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
  }

  window.XianCommandCenter = Object.freeze({
    registerTab,
    open,
    close,
    refresh,
    getCore: () => clone(core),
    recommendAction: state => clone(recommendAction(state)),
    compareActions: state => clone(compareActions(state)),
    collectWarnings: state => clone(collectWarnings(state)),
    groupForTab: tabId => clone(groupForTab(tabId)),
    escapeHtml,
  });
})();
