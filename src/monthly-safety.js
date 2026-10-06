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
  window.XianMonthlySafety = Object.freeze({ fixedDynamics, preview });
})();
