/* 天子蒙尘 v2.18.0：共用固定结算与只读预检。这里不取随机数、不写存档。 */
(() => {
  "use strict";
  const clone = value => JSON.parse(JSON.stringify(value));
  const clamp = value => Math.max(0, Math.min(100, value));

  function fixedDynamics(core) {
    const effects = { treasury: -1 }, hidden = {}, notes = [];
    if (core.actionPoints > 0) {
      effects.security = core.actionPoints;
      hidden.leakRisk = -core.actionPoints;
      notes.push(`余下${core.actionPoints}次行动用于谨慎守成`);
    }
    if (core.stats.treasury <= 18) {
      effects.officials = -3; effects.prestige = -2;
      notes.push("俸粮与行政经费不足");
    }
    if (core.hidden.peopleStability <= 22) {
      effects.prestige = (effects.prestige || 0) - 4;
      effects.security = (effects.security || 0) - 2;
      notes.push("民间不稳，流言与盗贼滋生");
    } else if (core.hidden.peopleStability >= 72) {
      effects.prestige = (effects.prestige || 0) + 2;
      notes.push("地方相对安定，汉廷声望回升");
    }
    if (core.stats.authority >= 72) {
      effects.caoAlert = 2;
      notes.push("皇权扩张引起司空府关注");
    }
    if (core.stats.caoAlert > 55) effects.caoAlert = (effects.caoAlert || 0) - 1;
    if (core.stats.caoAlert < 25 && core.stats.authority > 45) effects.caoAlert = (effects.caoAlert || 0) + 1;
    if (core.hidden.leakRisk >= 70) hidden.loyalNetwork = -2;
    return { effects, hidden, notes };
  }

  function preview(core, goals = []) {
    if (!core) return null;
    const settled = Number(core.monthlySettledTurn || 0) >= Number(core.turn);
    const fixed = settled ? { effects: {}, hidden: {}, notes: ["固定月末结算已完成，不再重复扣款或发放守成收益"] } : fixedDynamics(core);
    const projected = clone(core);
    for (const [kind, changes] of [["stats", fixed.effects], ["hidden", fixed.hidden]]) {
      for (const [key, delta] of Object.entries(changes)) projected[kind][key] = clamp(Number(core[kind][key] || 0) + delta);
    }
    const checks = goals.map(goal => {
      const [kind, key] = goal.path.split(".");
      const value = Number(core[kind]?.[key] || 0), after = Number(projected[kind]?.[key] || 0);
      const passed = item => (goal.min == null || item >= goal.min) && (goal.max == null || item <= goal.max);
      return { ...goal, value, after, passed: passed(value), afterPassed: passed(after),
        gap: Math.max(0, Number(goal.min ?? after) - after, after - Number(goal.max ?? after)) };
    });
    const severity = Math.ceil(Number(core.hidden.leakRisk || 0) / 20);
    return { settled, fixed, projected, checks, unusedActions: settled ? 0 : Number(core.actionPoints || 0),
      leak: settled ? null : { chance: Math.max(0, Math.min(.65, Number(core.hidden.leakRisk || 0) / 150)), securityLoss: 2 + severity, alertGain: 3 + severity } };
  }
  function snapshot(core) { return { stats: { ...core.stats }, hidden: { ...core.hidden } }; }
  function beginSettlement(core, goals = []) {
    const estimate = preview(core, goals);
    return { gameCreatedAt: core.createdAt, turn: core.turn, partial: estimate.settled,
      before: snapshot(core), fixed: snapshot(estimate.projected), reportsBefore: clone(core.reports || []), entries: [],
      goals: goals.map(({ path, label, min, max }) => ({ path, label, min, max })) };
  }
  function recordSettlement(ledger, source, before, after) {
    const changes = ["stats", "hidden"].flatMap(group => Object.keys(before[group]).map(key => ({
      path: `${group}.${key}`, delta: Number(after[group]?.[key] || 0) - Number(before[group][key] || 0),
    })).filter(change => change.delta !== 0));
    if (changes.length) ledger.entries.push({ source, changes });
  }
  function finishSettlement(ledger, core) {
    const names = { ...Object.fromEntries(Object.entries(window.GAME_DATA.statMeta).map(([key, meta]) => [key, meta.name])),
      loyalNetwork: "忠汉网络", leakRisk: "泄密风险", peopleStability: "民间稳定", externalBalance: "外部制衡", escapeRoute: "南方退路" };
    const rows = ["stats", "hidden"].flatMap(group => Object.keys(ledger.before[group]).map(key => {
      const path = `${group}.${key}`, before = Number(ledger.before[group][key]), fixed = Number(ledger.fixed[group][key]), actual = Number(core[group][key]);
      const sources = ledger.entries.flatMap(entry => entry.changes.filter(change => change.path === path).map(change => ({ source: entry.source, delta: change.delta })));
      const residual = actual - before - sources.reduce((sum, entry) => sum + entry.delta, 0);
      if (Math.abs(residual) > .000001) sources.push({ source: "其他变化（未归类）", delta: residual });
      return { path, name: names[key] || key, before, fixed, actual, difference: actual - fixed, sources };
    })).filter(row => row.path.startsWith("stats.") || row.actual !== row.before || ledger.goals.some(goal => goal.path === row.path));
    const goals = ledger.goals.map(goal => {
      const [group, key] = goal.path.split("."), actual = Number(core[group][key]), fixed = Number(ledger.fixed[group][key]);
      const passed = value => (goal.min == null || value >= goal.min) && (goal.max == null || value <= goal.max);
      return { ...goal, actual, fixed, passed: passed(actual), predictedPassed: passed(fixed) };
    });
    return { gameCreatedAt: ledger.gameCreatedAt, turn: ledger.turn, partial: ledger.partial, rows, goals };
  }
  function renderSettlement(settlement) {
    if (!settlement?.rows?.length) return "";
    const escape = text => String(text).replace(/[&<>"']/g, value => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[value]));
    const number = value => Math.round(value * 100) / 100;
    const signed = value => `${value > 0 ? "+" : ""}${number(value)}`;
    return `<section class="settlement-audit"><h3>预检与实际结算对账 · 第 ${Number(settlement.turn)} 月</h3>
      <p>${settlement.partial ? "本记录从已完成固定结算的续接处开始。" : "预检只估计固定用度与守成；下列为本次月末实际记录，包含数值上限的影响。"}</p>
      ${settlement.goals?.length ? `<ul class="preflight-goals">${settlement.goals.map(goal => `<li class="${goal.passed ? "safe" : "risk"}"><strong>${escape(goal.label)}</strong><span>预检 ${number(goal.fixed)} → 实际 ${number(goal.actual)} · ${goal.passed ? "实际达标" : "实际未达标"}${goal.predictedPassed && !goal.passed ? "，结算后跌出目标" : ""}</span></li>`).join("")}</ul>` : ""}
      <details><summary>展开 ${settlement.rows.length} 项数值与来源</summary><div class="settlement-audit-rows">${settlement.rows.map(row => `<article><strong>${escape(row.name)}</strong><span>结算前 ${number(row.before)} · 预检 ${number(row.fixed)} · 实际 ${number(row.actual)}</span><small>与预检差额 ${signed(row.difference)}</small><p>${row.sources.length ? row.sources.map(entry => `${escape(entry.source)} ${signed(entry.delta)}`).join("；") : "本次月末无净变化"}</p></article>`).join("")}</div></details></section>`;
  }
  window.XianMonthlySafety = Object.freeze({ fixedDynamics, preview, snapshot, beginSettlement, recordSettlement, finishSettlement, renderSettlement });
})();
