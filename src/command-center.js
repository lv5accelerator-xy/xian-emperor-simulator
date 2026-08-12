/* 天子蒙尘：献帝模拟器 v1.6.0 · 御前总览 */
(() => {
  "use strict";

  const CORE_KEY = "xian_emperor_simulator_v01";
  const STORE_KEY = "xian_emperor_command_center_v160";
  const ACTION_ADVICE = {
    audience: ["改善一名人物的态度", "适合修补关键关系"],
    appointment: ["以官爵换取支持", "皇权上升，但会刺激曹氏"],
    secret: ["扩大忠汉网络", "高收益，同时增加泄密风险"],
    relief: ["用国库换民心与威望", "国库紧张时应谨慎"],
    ritual: ["恢复朝廷名分", "适合威望或皇权不足时"],
    appease: ["降低曹氏警戒", "安全增加，但独立形象受损"],
    regional: ["建立外部制衡", "适合曹氏警戒偏高时"],
  };

  const tabs = new Map();
  let activeTab = "brief";
  let core = null;
  let store = loadStore();
  let overlay;

  document.addEventListener("DOMContentLoaded", init, { once: true });
  document.addEventListener("xian:core-saved", () => queueRefresh());
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
      <div class="focus-recommendation"><span>建议</span><strong>${escapeHtml(recommendation.label)}</strong><small>${escapeHtml(recommendation.reason)}</small></div>
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
    if (Number(state.actionPoints || 0) > 0) return { title: `尚可行动 ${state.actionPoints} 次`, detail: "选择一项最能处理当前危险的行动；不必把所有系统都打开。", target: "actions", button: "查看行动" };
    return { title: "本月行动已经用尽", detail: "检查警告后即可结束本月，未处理的扩展页面不会产生惩罚。", target: "end", button: "结束本月" };
  }

  function recommendAction(state) {
    const stats = state?.stats || {};
    const hidden = state?.hidden || {};
    if (!state?.eventResolved) return { actionId: "event", label: "裁决奏报", reason: "所有行动都要在本月奏报裁决后进行。" };
    if ((stats.caoAlert || 0) >= 72) return { actionId: "appease", label: "安抚曹氏", reason: "曹氏警戒已接近危险线，先换取政治空间。" };
    if ((stats.treasury || 0) <= 24) return { actionId: "ritual", label: "整饬朝仪", reason: "国库紧张，优先采用较少消耗财政的礼制行动。" };
    if ((hidden.peopleStability || 0) <= 35 && (stats.treasury || 0) >= 28) return { actionId: "relief", label: "赈济减赋", reason: "民间稳定偏低，继续拖延会反噬威望与宫廷安全。" };
    if ((hidden.leakRisk || 0) >= 55) return { actionId: "audience", label: "召见人物", reason: "泄密风险偏高，暂缓密令并修补关键关系。" };
    if ((hidden.externalBalance || 0) <= 35) return { actionId: "regional", label: "结交外镇", reason: "朝廷缺少外部制衡，地方承认能牵制一方独大。" };
    if ((stats.authority || 0) <= 45) return { actionId: "appointment", label: "任免封赏", reason: "皇权偏弱，可借官爵重新建立中枢存在感。" };
    return { actionId: "audience", label: "召见人物", reason: "当前没有迫近的数值危机，适合经营关键人物关系。" };
  }

  function renderBriefTab() {
    if (!core) return '<div class="command-empty">开启或读取一局后，此处会给出当月要务。</div>';
    const focus = getFocus(core);
    const rec = recommendAction(core);
    const warnings = collectWarnings(core);
    return `
      <div class="command-hero"><span>${escapeHtml(focus.title)}</span><strong>${escapeHtml(rec.label)}</strong><p>${escapeHtml(rec.reason)}</p></div>
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
        <li><strong>再用两次行动</strong><span>优先处理御前总览提示的红色风险；天下、军团和政议都是可选深度。</span></li>
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
    overlay.innerHTML = `
      <section class="command-center-window" role="dialog" aria-modal="true" aria-labelledby="command-center-title">
        <header><div><span>${escapeHtml(tab.kicker || "御前总览")}</span><h2 id="command-center-title">${escapeHtml(tab.title || tab.label)}</h2></div><button type="button" data-command-close aria-label="关闭">×</button></header>
        <nav>${[...tabs.values()].map(item => `<button type="button" data-command-tab="${item.id}" class="${item.id === tab.id ? "active" : ""}">${escapeHtml(item.label)}</button>`).join("")}</nav>
        <main>${tab.render({ core: clone(core), store: clone(store) })}</main>
      </section>`;
    tab.onMount?.(overlay.querySelector("main"), { core: clone(core), refresh });
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
    collectWarnings: state => clone(collectWarnings(state)),
    escapeHtml,
  });
})();
