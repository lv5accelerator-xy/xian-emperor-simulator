/*
 * 天子蒙尘：献帝模拟器 v0.4.1
 * 用玺前展示受命者、城池顺序、军路、战略动作与外交承诺。
 */
(() => {
  "use strict";

  const CORE_KEY = "xian_emperor_simulator_v01";
  const DATA = window.XIAN_STRATEGY_DATA;
  const API = window.XianStrategyNetwork;
  if (!DATA || !API) return;

  let bypassNextClick = false;
  let currentAnalysis = null;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

  function init() {
    const button = document.getElementById("issue-decree-btn");
    const input = document.getElementById("decree-input");
    if (!button || !input || document.getElementById("decree-confirmation-overlay")) return;

    installOverlay();
    button.addEventListener("click", event => interceptIssue(event, button, input), true);
  }

  function installOverlay() {
    const overlay = document.createElement("div");
    overlay.id = "decree-confirmation-overlay";
    overlay.className = "decree-confirmation-overlay hidden";
    overlay.innerHTML = `
      <section class="decree-confirmation-window" role="dialog" aria-modal="true" aria-labelledby="decree-confirmation-title">
        <header>
          <div><span class="section-kicker">尚书台复核</span><h2 id="decree-confirmation-title">诏令解析确认</h2><p>用玺前核对系统理解。取消后可返回修改原文。</p></div>
          <button id="decree-confirmation-close" type="button" aria-label="关闭">×</button>
        </header>
        <div id="decree-confirmation-content"></div>
        <footer>
          <button id="decree-confirmation-edit" class="secondary-button" type="button">返回修改</button>
          <button id="decree-confirmation-confirm" class="primary-button" type="button">确认用玺</button>
        </footer>
      </section>`;
    document.body.appendChild(overlay);

    overlay.querySelector("#decree-confirmation-close")?.addEventListener("click", closeOverlay);
    overlay.querySelector("#decree-confirmation-edit")?.addEventListener("click", closeOverlay);
    overlay.querySelector("#decree-confirmation-confirm")?.addEventListener("click", confirmIssue);
    overlay.addEventListener("click", event => { if (event.target === overlay) closeOverlay(); });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && !overlay.classList.contains("hidden")) closeOverlay();
    });
  }

  function interceptIssue(event, button, input) {
    if (bypassNextClick) {
      bypassNextClick = false;
      return;
    }

    const text = input.value.trim();
    if (text.length < 4 || text.length > 600) return;

    event.preventDefault();
    event.stopImmediatePropagation();
    currentAnalysis = analyzeEdict(text, button);
    renderAnalysis(currentAnalysis);
    document.getElementById("decree-confirmation-overlay")?.classList.remove("hidden");
    document.body.classList.add("decree-confirmation-open");
    document.getElementById("decree-confirmation-confirm")?.focus();
  }

  function analyzeEdict(text, button) {
    const cityIds = API.detectCityTargets(text);
    const lordIds = API.detectLordTargets(text);
    const orders = API.detectOrders(text);
    const promises = API.detectPromises(text);
    const primaryOrder = API.choosePrimaryOrder?.(orders) || choosePrimaryOrder(orders);
    const routeIds = API.resolveOrderedPath?.(cityIds, lordIds) || resolvePath(cityIds, lordIds);
    const route = buildRouteSummary(cityIds, lordIds, routeIds);
    const execution = estimateExecution(text);
    const warnings = [];

    if (!lordIds.length && ["attack", "support", "advance", "defend", "supply"].includes(primaryOrder)) {
      warnings.push("未识别明确受命诸侯；军事命令将优先记入汉廷方略，不会自动指定外镇军团。");
    }
    if (!cityIds.length && ["attack", "support", "advance", "defend", "supply"].includes(primaryOrder)) {
      warnings.push("未识别起点或目标城池；军团无法建立具体行军路线。");
    }
    if (cityIds.length === 1 && lordIds.length && DATA.lords.find(lord => lord.id === lordIds[0])?.seatCity === cityIds[0]) {
      warnings.push("受命诸侯当前治所与目标相同，系统会将命令解释为就地守备或整顿。");
    }
    if (route.blocked) warnings.push("预计路线存在低补给路段，抵达时间与兵力损耗可能增加。");
    if (text.includes("三月内") && route.eta > 3) warnings.push("诏令期限短于预计行军时间，违约概率较高。");

    return {
      text,
      cityIds,
      lordIds,
      orders,
      promises,
      primaryOrder,
      routeIds,
      route,
      execution,
      warnings,
      button,
    };
  }

  function renderAnalysis(analysis) {
    const content = document.getElementById("decree-confirmation-content");
    if (!content) return;

    const lordNames = analysis.lordIds.map(id => lordDef(id)?.name).filter(Boolean);
    const cityNames = analysis.cityIds.map(id => cityDef(id)?.name).filter(Boolean);
    const orderNames = analysis.orders.map(orderLabel);
    const promiseNames = analysis.promises.map(promiseLabel);

    content.innerHTML = `
      <blockquote>${escapeHtml(analysis.text)}</blockquote>
      <section class="decree-confirmation-grid">
        ${analysisItem("受命者", lordNames.length ? lordNames.join("、") : "未明确指定", lordNames.length ? "clear" : "uncertain")}
        ${analysisItem("战略行动", orderNames.length ? orderNames.join("、") : "中央一般政令", orderNames.length ? "clear" : "neutral")}
        ${analysisItem("城池顺序", cityNames.length ? cityNames.join(" → ") : "未识别城池", cityNames.length ? "clear" : "uncertain")}
        ${analysisItem("预计行军", analysis.route.display || "没有形成跨城路线", analysis.routeIds.length ? "clear" : "neutral")}
        ${analysisItem("预计耗时", analysis.routeIds.length ? `${analysis.route.eta} 个月` : "无需行军或无法估算", analysis.route.blocked ? "danger" : "neutral")}
        ${analysisItem("执行预估", `${analysis.execution.low}%—${analysis.execution.high}%`, analysis.execution.mid >= 65 ? "clear" : analysis.execution.mid < 45 ? "danger" : "neutral")}
      </section>
      <section class="decree-confirmation-promises">
        <div><span class="section-kicker">外交承诺</span><h3>${promiseNames.length ? `${promiseNames.length} 项` : "未建立承诺"}</h3></div>
        ${promiseNames.length ? `<ul>${promiseNames.map(name => `<li>${escapeHtml(name)}</li>`).join("")}</ul>` : "<p>写明奉表、贡赋、援军、结盟、停战、互市、质子或官爵，可建立有期限的履约记录。</p>"}
      </section>
      ${analysis.warnings.length ? `<section class="decree-confirmation-warnings"><strong>复核提醒</strong>${analysis.warnings.map(text => `<p>${escapeHtml(text)}</p>`).join("")}</section>` : ""}
      <p class="decree-confirmation-note">最终执行度仍包含地方阻力与少量随机波动；军团命令将在圣旨正式写入御前记录后生效。</p>`;
  }

  function analysisItem(label, value, tone) {
    return `<article class="${tone}"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></article>`;
  }

  function confirmIssue() {
    const analysis = currentAnalysis;
    if (!analysis?.button) return;
    closeOverlay();
    bypassNextClick = true;
    analysis.button.click();
    currentAnalysis = null;
  }

  function closeOverlay() {
    document.getElementById("decree-confirmation-overlay")?.classList.add("hidden");
    document.body.classList.remove("decree-confirmation-open");
  }

  function estimateExecution(text) {
    const core = safeParse(localStorage.getItem(CORE_KEY));
    if (!core?.stats) return { low: 45, mid: 52, high: 58 };
    let score = 0.34 + Number(core.stats.authority || 0) / 220 + Number(core.stats.officials || 0) / 360;
    score -= Math.max(0, Number(core.stats.caoAlert || 0) - 65) / 400;
    if (/(密诏|密令|秘密|暗中|心腹|衣带|联络)/.test(text)) score -= Number(core.hidden?.leakRisk || 0) / 500;
    const mid = Math.round(clamp(score, 0.28, 0.94) * 100);
    return { low: clamp(mid - 6, 28, 94), mid, high: clamp(mid + 6, 28, 94) };
  }

  function buildRouteSummary(cityIds, lordIds, routeIds) {
    const routeDefs = routeIds.map(routeDef).filter(Boolean);
    const avgSupply = routeDefs.length
      ? routeDefs.reduce((sum, def) => sum + Number(def.supply || 50), 0) / routeDefs.length
      : 100;
    const blocked = avgSupply < 42 || routeDefs.some(def => Number(def.supply || 0) < 35);
    const eta = Math.max(1, routeIds.length + (blocked ? 1 : 0));
    const display = routeDefs.length
      ? routeDefs.map(def => def.name).join("；")
      : cityIds.length >= 2
        ? `${cityDef(cityIds[0])?.name || cityIds[0]}至${cityDef(cityIds[cityIds.length - 1])?.name || cityIds[cityIds.length - 1]}未找到连通军路`
        : lordIds.length && cityIds.length
          ? "受命者在目标城池就地执行"
          : "";
    return { display, eta, blocked, avgSupply };
  }

  function resolvePath(cityIds, lordIds) {
    let from = null;
    let to = null;
    if (cityIds.length >= 2) [from, to] = [cityIds[0], cityIds[cityIds.length - 1]];
    else if (cityIds.length === 1 && lordIds.length) {
      from = lordDef(lordIds[0])?.seatCity;
      to = cityIds[0];
    }
    return from && to && from !== to ? API.findRoutePath(from, to) : [];
  }

  function choosePrimaryOrder(orders) {
    return ["attack", "support", "advance", "defend", "supply", "ceasefire", "trade"].find(order => orders.includes(order)) || "administration";
  }

  function orderLabel(id) {
    return DATA.orderRules.find(rule => rule.id === id)?.label || "一般政令";
  }

  function promiseLabel(id) {
    return DATA.promiseRules.find(rule => rule.id === id)?.label || id;
  }

  function cityDef(id) { return DATA.cities.find(city => city.id === id); }
  function routeDef(id) { return DATA.routes.find(route => route.id === id); }
  function lordDef(id) { return DATA.lords.find(lord => lord.id === id); }
  function safeParse(raw) { try { return raw ? JSON.parse(raw) : null; } catch (_) { return null; } }
  function clamp(value, min, max) { return Math.min(max, Math.max(min, Number(value) || 0)); }
  function escapeHtml(value) { return String(value ?? "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char])); }

  window.XianDecreeConfirmation = Object.freeze({ analyzeEdict });
})();