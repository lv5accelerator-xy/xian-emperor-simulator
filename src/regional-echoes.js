/* 天子蒙尘 v2.12.0：山河回响 */
(() => {
  "use strict";
  const VERSION = "2.12.0";
  const STORAGE_KEY = "xian_emperor_regional_echoes_v2120";
  const CITY_NAMES = Object.fromEntries((window.XIAN_STRATEGY_DATA?.cities || []).map(item => [item.id, item.name]));
  let state = loadState();

  document.addEventListener("DOMContentLoaded", sync);
  document.addEventListener("xian:core-saved", sync);
  document.addEventListener("xian:quarterly-panel-rendered", render);
  document.addEventListener("xian:battle-report", event => recordEcho(buildEchoFromBattle(event.detail || {})));
  document.addEventListener("xian:city-captured", event => recordEcho(buildEchoFromCapture(event.detail || {})));
  document.addEventListener("xian:before-month-end", advanceEchoes);

  function blankState() { return { version: 1, gameCreatedAt: null, echoes: [], history: [], processed: [] }; }
  function loadState() { try { const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null"); return { ...blankState(), ...(value || {}), echoes: Array.isArray(value?.echoes) ? value.echoes : [], history: Array.isArray(value?.history) ? value.history : [], processed: Array.isArray(value?.processed) ? value.processed : [] }; } catch (_) { return blankState(); } }
  function saveState() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (_) {} render(); }
  function coreState() { return window.XianEmperorGame?.getState?.() || null; }
  function strategyState() { return window.XianStrategyNetwork?.getState?.() || null; }

  function sync() {
    const core = coreState();
    if (!core || core.ended) return render();
    if (state.gameCreatedAt !== core.createdAt) { state = blankState(); state.gameCreatedAt = core.createdAt; saveState(); return; }
    render();
  }

  function buildEchoFromBattle(report) {
    if (!report?.cityId) return null;
    const losses = Number(report.attackerLosses || 0) + Number(report.defenderLosses || 0);
    return {
      id: `battle-${report.id || `${report.turn}-${report.cityId}`}`,
      sourceId: report.id,
      cityId: report.cityId,
      cityName: CITY_NAMES[report.cityId] || report.title?.replace(/之战$/, "") || report.cityId,
      kind: "battle_scars",
      title: "兵火之后",
      text: `${report.title || "一场战事"}留下伤兵、失所百姓与受损粮道，胜负并没有立刻结束地方代价。`,
      severity: clamp(Math.round(losses / 260), 18, 80),
      createdTurn: Number(report.turn || 1),
      dueTurn: Number(report.turn || 1) + 1,
      phase: "forming",
      choice: null,
    };
  }

  function buildEchoFromCapture(capture) {
    if (!capture?.cityId) return null;
    const taken = capture.newOwner === "court";
    return {
      id: `capture-${capture.id || `${capture.turn}-${capture.cityId}`}`,
      sourceId: capture.id,
      cityId: capture.cityId,
      cityName: CITY_NAMES[capture.cityId] || capture.cityId,
      kind: taken ? "new_rule" : "lost_city",
      title: taken ? "新附之民" : "失城流离",
      text: taken ? "城池易主只是开始。旧吏、守军和百姓正在判断汉廷会如何对待新附之地。" : "失城之后，逃散官吏与百姓涌向邻郡，朝廷仍须决定如何承受这场失败。",
      severity: taken ? 46 : 68,
      createdTurn: Number(capture.turn || 1),
      dueTurn: Number(capture.turn || 1) + 1,
      phase: "forming",
      choice: null,
    };
  }

  function recordEcho(echo) {
    const core = coreState();
    if (!core || !echo || state.processed.includes(echo.sourceId || echo.id)) return false;
    state.processed.push(echo.sourceId || echo.id);
    state.processed = state.processed.slice(-60);
    const existing = state.echoes.find(item => item.cityId === echo.cityId && item.phase !== "resolved");
    if (existing) {
      existing.severity = clamp(Math.max(existing.severity, echo.severity) + 8, 0, 100);
      existing.text = `${existing.text} ${echo.text}`;
      existing.dueTurn = Math.min(existing.dueTurn, echo.dueTurn);
    } else {
      state.echoes.push(echo);
    }
    state.echoes = state.echoes.slice(-8);
    saveState();
    return true;
  }

  function advanceEchoes(event) {
    const core = coreState();
    if (!core || event.detail?.createdAt && event.detail.createdAt !== core.createdAt) return;
    let changed = false;
    state.echoes.forEach(echo => {
      if (echo.phase === "forming" && core.turn >= echo.dueTurn) {
        echo.phase = "decision";
        echo.dueTurn = core.turn + 1;
        changed = true;
      } else if (echo.phase === "decision" && core.turn >= echo.dueTurn) {
        resolveEcho(echo, "neglect", true);
        changed = true;
      } else if (echo.phase === "watch" && core.turn >= echo.dueTurn) {
        concludeEcho(echo);
        changed = true;
      }
    });
    if (changed) saveState();
  }

  function getResolutionOptions(echo) {
    if (!echo) return [];
    if (echo.kind === "battle_scars") return [
      { id: "relief", label: "抚恤修道", note: "国库 -3，民稳 +3；改善当地粮道与忠诚。", core: { effects: { treasury: -3, prestige: 1 }, hidden: { peopleStability: 3 } }, city: { supply: 4, courtLoyalty: 4, pressure: -5 } },
      { id: "requisition", label: "就地征发", note: "国库 +2，但民稳 -3；地方压力继续累积。", core: { effects: { treasury: 2 }, hidden: { peopleStability: -3 } }, city: { supply: -3, courtLoyalty: -4, pressure: 7 } },
    ];
    if (echo.kind === "new_rule") return [
      { id: "amnesty", label: "赦旧安民", note: "威望 +2；新附忠诚明显改善，城防恢复较慢。", core: { effects: { prestige: 2 } }, city: { courtLoyalty: 7, defense: -1, pressure: -5 } },
      { id: "garrison", label: "整军设防", note: "国库 -2、宫禁 +1；城防提高但人心更紧张。", core: { effects: { treasury: -2, security: 1 } }, city: { defense: 7, courtLoyalty: -2, pressure: 4 } },
    ];
    if (echo.kind === "lost_city") return [
      { id: "receive", label: "接纳流民", note: "国库 -2、民稳 +2；保住朝廷声望。", core: { effects: { treasury: -2, prestige: 1 }, hidden: { peopleStability: 2 } }, city: {} },
      { id: "counterplot", label: "筹备反制", note: "皇权 +1、警戒 +2；在当地积累反攻压力。", core: { effects: { authority: 1, caoAlert: 2 } }, city: { pressure: 8, courtLoyalty: 3 } },
    ];
    return [];
  }

  function resolveEcho(echoOrId, optionId, automatic = false) {
    const echo = typeof echoOrId === "string" ? state.echoes.find(item => item.id === echoOrId) : echoOrId;
    if (!echo || echo.phase !== "decision") return false;
    let option = getResolutionOptions(echo).find(item => item.id === optionId);
    if (automatic) option = { id: "neglect", label: "因循未决", note: "地方自行承担代价。", core: { effects: { prestige: -1 }, hidden: { peopleStability: -2 } }, city: { courtLoyalty: -3, pressure: 5 } };
    if (!option) return false;
    echo.choice = option.id;
    echo.choiceLabel = option.label;
    echo.phase = "watch";
    echo.dueTurn = Number(coreState()?.turn || echo.dueTurn) + 2;
    echo.text = `${echo.text} 朝廷选择“${option.label}”，其真正结果仍需时间显现。`;
    applyCity(echo.cityId, option.city, `${echo.cityName}·${option.label}`);
    saveState();
    window.XianQuarterlyAgenda?.addContribution?.(automatic ? 0 : 7, `处置${echo.cityName}地方余波`);
    window.XianEmperorGame?.applyExternalPackage?.({
      ...option.core, causal: false,
      report: { title: `山河回响·${echo.cityName}`, text: automatic ? `${echo.cityName}的余波久未裁处，地方只能自行承担。` : `朝廷以“${option.label}”处置${echo.cityName}余波。两个月后将见分晓。`, type: automatic ? "danger" : "decision" },
      chronicle: `${echo.cityName}有余波，朝廷${automatic ? "久未裁处" : `命以“${option.label}”善后`}。`,
    });
    return true;
  }

  function concludeEcho(echo) {
    const city = strategyState()?.cities?.[echo.cityId];
    const good = Number(city?.courtLoyalty || 50) >= 52 && Number(city?.pressure || 0) <= 58 && echo.choice !== "neglect";
    echo.phase = "resolved";
    echo.resolvedTurn = coreState()?.turn || echo.dueTurn;
    echo.outcome = good ? "处置逐渐见效，地方开始把朝廷视作可依赖的秩序。" : "余波仍未完全平息，地方对朝廷的信任恢复缓慢。";
    state.history.unshift({ id: echo.id, cityName: echo.cityName, kind: echo.kind, choiceLabel: echo.choiceLabel || "因循未决", outcome: echo.outcome, resolvedTurn: echo.resolvedTurn });
    state.history = state.history.slice(0, 18);
    window.XianEmperorGame?.applyExternalPackage?.({
      effects: good ? { prestige: 1 } : {}, hidden: good ? { peopleStability: 1 } : { peopleStability: -1 }, causal: false,
      report: { title: `地方后报·${echo.cityName}`, text: echo.outcome, type: good ? "decision" : "neutral" },
      chronicle: `${echo.cityName}善后有报：${echo.outcome}`,
    });
  }

  function applyCity(cityId, patch, reason) {
    if (!cityId || !patch || !Object.keys(patch).length) return;
    window.XianStrategyNetwork?.applyCampaignEffects?.({ cities: { [cityId]: patch }, reason, log: `${reason}改变了当地忠诚、压力与守备。` });
  }

  function render() {
    const slot = document.getElementById("regional-echo-slot");
    if (!slot) return;
    const active = state.echoes.filter(item => item.phase !== "resolved").sort((a, b) => phaseOrder(a.phase) - phaseOrder(b.phase) || b.severity - a.severity);
    if (!active.length) { slot.innerHTML = ""; return; }
    const echo = active[0];
    const options = echo.phase === "decision" ? getResolutionOptions(echo) : [];
    const status = echo.phase === "forming" ? `第 ${echo.dueTurn} 月送达御前` : echo.phase === "watch" ? `已处置 · 第 ${echo.dueTurn} 月见后报` : "本月须作处置";
    slot.innerHTML = `<section class="regional-echo ${echo.phase}"><header><div><span>山河回响 · ${esc(echo.cityName)}</span><strong>${esc(echo.title)}</strong></div><small>${status}${active.length > 1 ? ` · 另有 ${active.length - 1} 项` : ""}</small></header><p>${esc(echo.text)}</p>${options.length ? `<div>${options.map(option => `<button type="button" data-echo-id="${esc(echo.id)}" data-echo-option="${option.id}"><strong>${option.label}</strong><small>${option.note}</small></button>`).join("")}</div>` : ""}</section>`;
    slot.querySelectorAll("[data-echo-option]").forEach(button => button.addEventListener("click", () => resolveEcho(button.dataset.echoId, button.dataset.echoOption)));
  }

  function phaseOrder(phase) { return { decision: 0, watch: 1, forming: 2 }[phase] ?? 9; }
  function getState() { return JSON.parse(JSON.stringify(state)); }
  function clamp(value, min, max) { return Math.min(max, Math.max(min, Number(value) || 0)); }
  function esc(value) { return String(value ?? "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char])); }
  window.XianRegionalEchoes = Object.freeze({ version: VERSION, buildEchoFromBattle, buildEchoFromCapture, getResolutionOptions, recordEcho, resolveEcho, getState });
})();
