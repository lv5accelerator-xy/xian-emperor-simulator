/* 天子蒙尘：献帝模拟器 v1.8.0 · 山河留痕 */
(() => {
  "use strict";

  const CORE_KEY = "xian_emperor_simulator_v01";
  const STORE_KEY = "xian_emperor_world_marks_v180";
  const MAX_HISTORY = 48;
  const MARK_TEMPLATES = {
    relief: { title: "仓廪开济", scope: "民政", duration: 4, icon: "谷", monthly: { effects: { prestige: 1 }, hidden: { peopleStability: 2 } }, text: "赈济并非一月即止，地方粮价与人心会持续恢复。" },
    ritual: { title: "汉仪重张", scope: "朝廷", duration: 3, icon: "礼", monthly: { effects: { authority: 1, officials: 1 } }, text: "朝仪重新被百官与地方使者看见，名分影响仍在延续。" },
    regional: { title: "使节往来", scope: "外交", duration: 4, icon: "使", monthly: { hidden: { externalBalance: 2 }, effects: { caoAlert: 1 } }, text: "远方承认强化朝廷制衡，也持续引起司空府注意。" },
    secret: { title: "暗线余波", scope: "宫禁", duration: 3, icon: "密", monthly: { hidden: { loyalNetwork: 2, leakRisk: 1 } }, text: "密令留下的人脉仍在运转，泄密风险也不会立即消散。" },
    appease: { title: "许都暂和", scope: "朝局", duration: 3, icon: "和", monthly: { effects: { security: 1, caoAlert: -1, authority: -1 } }, text: "君臣表面的缓和维持了安全，也让主动权恢复得更慢。" },
    appointment: { title: "新授官爵", scope: "百官", duration: 3, icon: "官", monthly: { effects: { officials: 1, caoAlert: 1 } }, text: "任命改变了官场预期，各方仍在观察天子的用人方向。" },
  };

  let state = loadState();
  let core = readCore();
  let lastCore = core;

  document.addEventListener("DOMContentLoaded", init, { once: true });
  document.addEventListener("xian:core-saved", () => inspectCore());
  document.addEventListener("xian:decision-resolved", event => recordDecisionMark(event.detail || {}));
  document.addEventListener("xian:before-month-end", event => applyMonthlyMarks(event.detail || {}));

  function init() {
    core = readCore();
    lastCore = core;
    window.XianCommandCenter?.registerTab?.({
      id: "marks",
      label: "山河留痕",
      kicker: "v1.8.0 · 长期影响",
      title: "选择会在天下留下余波",
      render: renderTab,
    });
  }

  function inspectCore() {
    const next = readCore();
    if (!next || next.createdAt !== lastCore?.createdAt) {
      core = next;
      lastCore = next;
      return;
    }
    const newest = next.reports?.[0];
    const previousNewest = lastCore?.reports?.[0];
    if (newest?.timestamp && newest.timestamp !== previousNewest?.timestamp && newest.type === "action") {
      const actionType = inferAction(newest.title || "", newest.text || "");
      if (actionType && MARK_TEMPLATES[actionType]) createMark(actionType, newest.title, next.turn);
    }
    core = next;
    lastCore = next;
  }

  function inferAction(title, text) {
    const value = `${title}${text}`;
    if (/赈|减赋|仓廪/.test(value)) return "relief";
    if (/朝仪|祭|经筵|宗庙/.test(value)) return "ritual";
    if (/结交|使者|使节|贡赋|外镇/.test(value)) return "regional";
    if (/密联|密令|暗中/.test(value)) return "secret";
    if (/安抚|赐宴|司空府/.test(value)) return "appease";
    if (/封赏|任命|加官|赐爵|褒奖/.test(value)) return "appointment";
    return null;
  }

  function recordDecisionMark(detail) {
    const text = `${detail.eventTitle || ""}${detail.choiceLabel || ""}${detail.chronicle || ""}`;
    let type = null;
    if (/赈|民|粮|减赋/.test(text)) type = "relief";
    else if (/礼|朝仪|宗庙|用玺/.test(text)) type = "ritual";
    else if (/外镇|诸侯|使者|河北|荆州|江东/.test(text)) type = "regional";
    else if (/密|暗|忠汉/.test(text)) type = "secret";
    else if (/曹氏|司空府|宿卫/.test(text)) type = "appease";
    else if (/官|任|封|爵/.test(text)) type = "appointment";
    if (type) createMark(type, detail.eventTitle || "奏报裁决", detail.turn || 0);
  }

  function createMark(type, source, turn) {
    core = readCore();
    if (!core) return;
    const template = MARK_TEMPLATES[type];
    const existing = state.active.find(item => item.type === type && item.gameCreatedAt === core.createdAt);
    if (existing) {
      existing.remaining = Math.min(template.duration + 2, Math.max(existing.remaining, template.duration));
      existing.source = source;
      existing.updatedTurn = turn;
    } else {
      state.active.push({
        id: `${type}-${Date.now()}`,
        type,
        source,
        remaining: template.duration,
        createdTurn: turn,
        updatedTurn: turn,
        gameCreatedAt: core.createdAt,
      });
    }
    saveState();
    window.XianCommandCenter?.refresh?.();
  }

  function applyMonthlyMarks(detail) {
    core = readCore();
    if (!core || detail.createdAt !== core.createdAt) return;
    const active = state.active.filter(item => item.gameCreatedAt === core.createdAt && item.remaining > 0);
    if (!active.length) return;
    const total = { effects: {}, hidden: {} };
    active.forEach(mark => {
      const monthly = MARK_TEMPLATES[mark.type]?.monthly || {};
      for (const group of ["effects", "hidden"]) Object.entries(monthly[group] || {}).forEach(([key, delta]) => { total[group][key] = (total[group][key] || 0) + delta; });
      mark.remaining -= 1;
      if (mark.remaining <= 0) state.history.unshift({ ...mark, endedTurn: detail.turn });
    });
    state.active = state.active.filter(item => item.remaining > 0);
    state.history = state.history.slice(0, MAX_HISTORY);
    saveState();
    window.XianEmperorGame?.applyExternalPackage?.({
      ...total,
      report: { title: "山河余波", text: active.map(item => MARK_TEMPLATES[item.type]?.title).filter(Boolean).join("、") + "仍在影响朝局。", type: "decision" },
      chronicle: `此前的选择仍留下${active.length}道山河余波。`,
    });
  }

  function renderTab() {
    core = readCore();
    const active = state.active.filter(item => !core || item.gameCreatedAt === core.createdAt);
    return `
      <div class="marks-intro"><div><span>正在生效</span><strong>${active.length}</strong></div><p>长期印记会在月末自动结算，数值始终使用现有国势与隐藏局势，不新增资源。</p></div>
      <div class="marks-grid">${active.length ? active.map(renderMark).join("") : '<div class="command-empty">尚无长期印记。重要的民政、礼制、外交、密令与任命会在此留下余波。</div>'}</div>
      ${state.history.length ? `<section class="marks-history"><h3>已经消散的印记</h3>${state.history.slice(0, 6).map(item => `<span>${escapeHtml(MARK_TEMPLATES[item.type]?.title || item.type)} · 第 ${item.endedTurn} 月</span>`).join("")}</section>` : ""}`;
  }

  function renderMark(mark) {
    const template = MARK_TEMPLATES[mark.type];
    const effects = describePackage(template.monthly);
    return `<article class="world-mark"><div class="mark-icon">${template.icon}</div><div><span>${template.scope} · 剩余 ${mark.remaining} 月</span><strong>${escapeHtml(template.title)}</strong><p>${escapeHtml(template.text)}</p><small>每月：${escapeHtml(effects)}｜源于 ${escapeHtml(mark.source)}</small></div></article>`;
  }

  function describePackage(pkg) {
    const names = { authority: "皇权", prestige: "威望", security: "安全", treasury: "国库", officials: "百官", caoAlert: "曹氏警戒", peopleStability: "民间稳定", externalBalance: "外部制衡", loyalNetwork: "忠汉网络", leakRisk: "泄密风险" };
    return ["effects", "hidden"].flatMap(group => Object.entries(pkg[group] || {}).map(([key, value]) => `${names[key] || key}${value > 0 ? "+" : ""}${value}`)).join("，");
  }

  function defaultState() { return { version: 1, active: [], history: [] }; }
  function loadState() { try { const value = JSON.parse(localStorage.getItem(STORE_KEY) || "null"); return { ...defaultState(), ...(value || {}), active: Array.isArray(value?.active) ? value.active : [], history: Array.isArray(value?.history) ? value.history : [] }; } catch (_) { return defaultState(); } }
  function saveState() { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (error) { console.warn("山河印记保存失败", error); } }
  function readCore() { try { const value = JSON.parse(localStorage.getItem(CORE_KEY) || "null"); return value?.stats ? value : null; } catch (_) { return null; } }
  function escapeHtml(value) { return window.XianCommandCenter?.escapeHtml?.(value) || String(value ?? ""); }

  window.XianWorldMarks = Object.freeze({
    getState: () => JSON.parse(JSON.stringify(state)),
    inferAction,
    describePackage,
    templates: MARK_TEMPLATES,
  });
})();
