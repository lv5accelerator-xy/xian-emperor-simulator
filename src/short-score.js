/* v2.21.0 · Explain recorded scores without changing the v2.16 scoring rules. */
(() => {
  "use strict";
  const round = value => Math.round(value * 100) / 100;
  const signed = value => `${value > 0 ? "+" : ""}${round(value)}`;
  const escape = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const labels = { goals: "目标达成分", prestige: "威望分", authority: "皇权分", rounding: "取整调整" };
  const unknown = "旧成绩未记录评分构成，或记录与总分不一致；保留原总分，不推算缺失数值。";

  function build(result, core) {
    if (result?.rulesVersion !== 216 || !Number.isFinite(result.score) || !Number.isInteger(result.completed)
      || !Number.isInteger(result.total) || result.total < 0 || result.completed < 0 || result.completed > result.total
      || !Number.isFinite(core?.stats?.prestige) || !Number.isFinite(core?.stats?.authority)) return null;
    const inputs = { completed: result.completed, total: result.total, prestige: core.stats.prestige, authority: core.stats.authority };
    const rawGoals = result.completed / Math.max(1, result.total) * 1000;
    if (result.score !== (result.endedEarly ? 0 : Math.round(rawGoals + inputs.prestige * 2 + inputs.authority))) return null;
    const components = result.endedEarly ? { goals: 0, prestige: 0, authority: 0, rounding: 0 }
      : { goals: round(rawGoals), prestige: round(inputs.prestige * 2), authority: round(inputs.authority) };
    components.rounding = round(result.score - components.goals - components.prestige - components.authority);
    return { version: 1, rulesVersion: 216, endedEarly: Boolean(result.endedEarly), inputs, components, total: result.score };
  }

  function read(result) {
    const saved = result?.scoreBreakdown;
    if (saved?.version !== 1 || saved.rulesVersion !== result.rulesVersion || saved.total !== result.score
      || saved.endedEarly !== Boolean(result.endedEarly) || saved.inputs?.completed !== result.completed || saved.inputs?.total !== result.total) return null;
    const verified = build(result, { stats: saved.inputs });
    return verified && Object.keys(labels).every(key => verified.components[key] === saved.components?.[key]) ? verified : null;
  }

  function compare(current, previous) {
    const delta = Number.isFinite(current?.score) && Number.isFinite(previous?.score) ? round(current.score - previous.score) : null;
    const after = read(current), before = read(previous);
    if (!after || !before) return { available: false, delta, reason: "至少一局未记录完整评分构成，只显示总分差，不推算原因。" };
    return { available: true, delta, early: Boolean(current.endedEarly || previous.endedEarly),
      parts: Object.entries(labels).map(([key, label]) => ({ key, label, previous: before.components[key], current: after.components[key], delta: round(after.components[key] - before.components[key]) })) };
  }

  function html(result) {
    const score = read(result);
    return `<details class="short-score"><summary>分数构成 · ${Number.isFinite(result?.score) ? result.score : "未记录"} 分</summary>${score
      ? `${score.endedEarly ? '<p>提前终局，本局不计分；各项计分均为 0。</p>' : `<p>目标 ${score.inputs.completed}/${score.inputs.total} × 1000；评分时威望 ${round(score.inputs.prestige)} × 2，皇权 ${round(score.inputs.authority)} × 1；合计后取整。</p>`}
        <dl>${Object.entries(labels).map(([key, label]) => `<div><dt>${label}</dt><dd>${score.components[key]}</dd></div>`).join("")}<div><dt>总分</dt><dd>${score.total}</dd></div></dl>`
      : `<p class="short-review-note">${unknown}</p>`}</details>`;
  }

  function comparisonText(comparison) {
    const heading = `总分变化 ${comparison?.delta == null ? "未记录" : signed(comparison.delta)} 分。`;
    if (!comparison?.available) return `${heading}${comparison?.reason || "评分构成未记录。"}`;
    return `${heading}${comparison.parts.map(part => `${part.label} ${signed(part.delta)}`).join("；")}。${comparison.early ? "提前终局一局不计分，各项均按零计。" : "目标分按达标项数计，不按目标余量计；终值改善也可能因威望或皇权降低而少得分。"}`;
  }

  function comparisonHtml(comparison) {
    return `<section class="score-difference"><h3>分差从哪里来</h3><p>${escape(comparisonText(comparison))}</p>${comparison?.available
      ? `<table><thead><tr><th>计分项</th><th>上次</th><th>本局</th><th>分差</th></tr></thead><tbody>${comparison.parts.map(part => `<tr><th>${escape(part.label)}</th><td>${part.previous}</td><td>${part.current}</td><td>${signed(part.delta)}</td></tr>`).join("")}</tbody></table>` : ""}</section>`;
  }

  function text(result) {
    const score = read(result);
    if (!score) return `分数构成：${unknown}`;
    return `分数构成：${Object.entries(labels).map(([key, label]) => `${label} ${score.components[key]}`).join("；")}；总分 ${score.total}。${score.endedEarly ? "提前终局不计分。" : `评分时威望 ${round(score.inputs.prestige)}，皇权 ${round(score.inputs.authority)}；目标达标项数 / 总项数 × 1000 + 威望 × 2 + 皇权，合计取整。`}`;
  }

  window.XianShortScore = Object.freeze({ build, read, compare, html, text, comparisonText, comparisonHtml });
})();
