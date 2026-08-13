/* 天子蒙尘：献帝模拟器 v2.1.0 · 一月一断 */
(() => {
  "use strict";

  const CORE_KEY = "xian_emperor_simulator_v01";
  const STORE_KEY = "xian_emperor_monthly_flow_v210";
  const STAT_NAMES = {
    authority: "皇权", prestige: "汉室威望", security: "宫廷安全",
    treasury: "国库", officials: "百官支持", caoAlert: "曹氏警戒",
    loyalNetwork: "忠汉网络", leakRisk: "泄密风险", peopleStability: "民间稳定",
    externalBalance: "外部制衡", escapeRoute: "南方退路",
  };

  let store = loadStore();
  let bar = null;

  document.addEventListener("DOMContentLoaded", init, { once: true });
  document.addEventListener("xian:core-saved", () => queueRefresh());
  document.addEventListener("xian:decision-resolved", event => rememberDecision(event.detail || {}));

  function init() {
    installBar();
    installModeButton();
    applyMode();
    window.XianCommandCenter?.registerTab?.({
      id: "monthly",
      label: "一月一断",
      kicker: "v2.1.0 · 三步朝会",
      title: "把一个月收束为一次判断",
      render: renderTab,
      onMount: mountTab,
    });
    refresh();
  }

  function installBar() {
    if (document.getElementById("monthly-flow-bar")) return;
    const main = document.querySelector("#game-shell .game-main");
    if (!main) return;
    bar = document.createElement("section");
    bar.id = "monthly-flow-bar";
    bar.className = "monthly-flow-bar";
    bar.setAttribute("aria-live", "polite");
    main.before(bar);
    bar.addEventListener("click", event => {
      const button = event.target.closest("[data-flow-jump]");
      if (!button) return;
      jump(button.dataset.flowJump);
    });
  }

  function installModeButton() {
    const nav = document.querySelector(".utility-nav");
    if (!nav || document.getElementById("monthly-mode-btn")) return;
    const button = document.createElement("button");
    button.id = "monthly-mode-btn";
    button.type = "button";
    button.addEventListener("click", () => setMode(store.mode === "simple" ? "full" : "simple"));
    nav.appendChild(button);
    updateModeButton();
  }

  function getStepState(core = readCore()) {
    if (!core) return { current: 1, resolved: false, acted: false };
    const resolved = Boolean(core.eventResolved);
    const acted = Number(core.actionPoints || 0) < 2;
    return { current: !resolved ? 1 : !acted ? 2 : 3, resolved, acted };
  }

  function refresh() {
    const core = readCore();
    if (!bar) bar = document.getElementById("monthly-flow-bar");
    if (!bar) return;
    if (!core || core.ended || document.getElementById("game-shell")?.classList.contains("hidden")) {
      bar.hidden = true;
      return;
    }
    bar.hidden = false;
    const steps = getStepState(core);
    const event = window.XianEmperorGame?.getCurrentEvent?.();
    const recommendation = window.XianCommandCenter?.recommendAction?.(core);
    bar.innerHTML = `
      <div class="monthly-flow-copy"><span>本月只看一件事</span><strong>${escapeHtml(event?.title || "御前奏议")}</strong><small>${escapeHtml(flowPrompt(core, event))}</small></div>
      <div class="monthly-flow-steps">
        ${stepButton(1, "裁决奏报", steps.resolved, steps.current, "event")}
        ${stepButton(2, "安排一事", steps.acted, steps.current, "actions")}
        ${stepButton(3, "月末结算", false, steps.current, "end")}
      </div>
      <div class="monthly-flow-advice"><span>尚书台建议</span><strong>${escapeHtml(recommendation?.label || (steps.resolved ? "可直接结束本月" : "先作裁决"))}</strong><button type="button" data-flow-jump="overview">查看理由</button></div>`;
    renderChoiceImpacts();
  }

  function stepButton(index, label, complete, current, target) {
    const stateClass = complete ? "complete" : current === index ? "current" : "";
    return `<button type="button" class="${stateClass}" data-flow-jump="${target}"><i>${complete ? "✓" : index}</i><span>${label}</span></button>`;
  }

  function flowPrompt(core, event) {
    if (!core.eventResolved) return event?.text ? `${event.text.slice(0, 54)}${event.text.length > 54 ? "……" : ""}` : "先处理送到御前的奏报。";
    if (Number(core.actionPoints || 0) === 2) return "奏报已决。可安排一项御前行动，也可以守成至月末。";
    return `已安排 ${2 - Number(core.actionPoints || 0)} 项行动；确认风险后即可进入下月。`;
  }

  function jump(target) {
    if (target === "overview") return window.XianCommandCenter?.open?.("monthly");
    const selectors = { event: ".event-panel", actions: ".action-panel", end: "#end-turn-btn" };
    const element = document.querySelector(selectors[target]);
    element?.scrollIntoView({ behavior: "smooth", block: "center" });
    element?.classList.add("monthly-flow-pulse");
    setTimeout(() => element?.classList.remove("monthly-flow-pulse"), 1200);
  }

  function renderChoiceImpacts() {
    const core = readCore();
    const event = window.XianEmperorGame?.getCurrentEvent?.();
    if (!core || core.eventResolved || !event) return;
    document.querySelectorAll("#event-choices [data-choice-index]").forEach(button => {
      if (button.querySelector(".monthly-choice-impact")) return;
      const choice = event.choices?.[Number(button.dataset.choiceIndex)];
      const impact = buildChoiceImpact(choice);
      if (!impact.length) return;
      const small = document.createElement("small");
      small.className = "monthly-choice-impact";
      small.textContent = impact.join(" · ");
      button.querySelector("span:last-child")?.appendChild(small);
    });
  }

  function buildChoiceImpact(choice = {}) {
    const visible = Object.entries(choice.effects || {}).filter(([, value]) => Number(value));
    const risks = Object.entries(choice.hidden || {}).filter(([key, value]) => Number(value) && ["leakRisk"].includes(key));
    return [...visible, ...risks].slice(0, 3).map(([key, value]) => `${STAT_NAMES[key] || key}${Number(value) > 0 ? "+" : ""}${value}`);
  }

  function renderTab() {
    const core = readCore();
    if (!core) return '<div class="command-empty">开始一局后，这里会整理本月唯一的核心流程。</div>';
    const event = window.XianEmperorGame?.getCurrentEvent?.();
    const steps = getStepState(core);
    const warnings = window.XianCommandCenter?.collectWarnings?.(core) || [];
    return `
      <section class="monthly-tab-hero"><span>${store.mode === "simple" ? "简明御前" : "完整朝局"}</span><h3>${escapeHtml(event?.title || "本月奏议")}</h3><p>${escapeHtml(flowPrompt(core, event))}</p></section>
      <div class="monthly-tab-steps">
        <article class="${steps.resolved ? "done" : "active"}"><b>一</b><div><strong>裁决奏报</strong><p>${steps.resolved ? `已选择：${escapeHtml(store.lastDecision?.choiceLabel || "本月方案")}` : "阅读三个方案，只决定本月最重要的一件事。"}</p></div></article>
        <article class="${steps.acted ? "done" : steps.resolved ? "active" : ""}"><b>二</b><div><strong>安排一事</strong><p>${steps.acted ? `已使用 ${2 - Number(core.actionPoints || 0)} 次行动。` : "行动是可选的；不行动会转化为小幅守成收益。"}</p></div></article>
        <article class="${steps.current === 3 ? "active" : ""}"><b>三</b><div><strong>月末结算</strong><p>系统会自动结算财政、民生、警戒和长期印记。</p></div></article>
      </div>
      <section class="monthly-tab-risks"><h3>若不处理，最值得留意</h3>${warnings.slice(0, 2).map(item => `<article class="${item.level}"><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.text)}</p></article>`).join("")}</section>
      <div class="monthly-tab-actions"><button type="button" data-monthly-mode>${store.mode === "simple" ? "切换完整朝局" : "切换简明御前"}</button><button type="button" data-monthly-jump="${steps.current === 1 ? "event" : steps.current === 2 ? "actions" : "end"}">前往当前步骤</button></div>`;
  }

  function mountTab(root) {
    root.querySelector("[data-monthly-mode]")?.addEventListener("click", () => {
      setMode(store.mode === "simple" ? "full" : "simple");
      window.XianCommandCenter?.open?.("monthly");
    });
    root.querySelector("[data-monthly-jump]")?.addEventListener("click", event => {
      window.XianCommandCenter?.close?.();
      setTimeout(() => jump(event.currentTarget.dataset.monthlyJump), 30);
    });
  }

  function rememberDecision(detail) {
    store.lastDecision = { createdAt: detail.createdAt, turn: detail.turn, choiceLabel: detail.choiceLabel, eventTitle: detail.eventTitle };
    saveStore();
    queueRefresh();
  }

  function setMode(mode) {
    store.mode = mode === "full" ? "full" : "simple";
    saveStore();
    applyMode();
    refresh();
  }

  function applyMode() {
    document.body.classList.toggle("xian-flow-simple", store.mode === "simple");
    updateModeButton();
  }

  function updateModeButton() {
    const button = document.getElementById("monthly-mode-btn");
    if (button) button.textContent = store.mode === "simple" ? "完整朝局" : "简明御前";
  }

  function queueRefresh() { setTimeout(refresh, 20); }
  function defaultStore() { return { version: 1, mode: "simple", lastDecision: null }; }
  function loadStore() { try { return { ...defaultStore(), ...(JSON.parse(localStorage.getItem(STORE_KEY) || "null") || {}) }; } catch (_) { return defaultStore(); } }
  function saveStore() { try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (error) { console.warn("月度流程设置保存失败", error); } }
  function readCore() { try { const value = JSON.parse(localStorage.getItem(CORE_KEY) || "null"); return value?.stats ? value : null; } catch (_) { return null; } }
  function escapeHtml(value) { return window.XianCommandCenter?.escapeHtml?.(value) || String(value ?? ""); }

  window.XianMonthlyFlow = Object.freeze({
    buildChoiceImpact,
    getStepState,
    getMode: () => store.mode,
    setMode,
  });
})();
