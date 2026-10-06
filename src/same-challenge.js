/* v2.20.0 · Read-only comparisons of two runs with a recorded identical start. */
(() => {
  "use strict";
  const canonical = value => {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
    return value;
  };
  const escape = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const number = value => value == null || !Number.isFinite(Number(value)) ? null : Math.round(Number(value) * 100) / 100;
  const display = value => number(value) == null ? "未记录" : number(value);
  const signed = value => number(value) == null ? "未记录" : `${value > 0 ? "+" : ""}${number(value)}`;
  const medals = value => ({ gold: "金章", silver: "银章", bronze: "铜章", none: "未获章" })[value] || "未记录";

  function identity(definition, core) {
    const code = String(definition?.code || "").trim().toUpperCase();
    if (!/^XIAN-\d{4}W\d{2}-[0-9A-Z]{5}$/.test(code) || !Number.isInteger(core?.random?.seed)) return null;
    if (window.XianWeeklyChallenge?.parseCode && !window.XianWeeklyChallenge.parseCode(code)) return null;
    const start = { code, seed: core.random.seed, rulesVersion: 216, algorithm: core.random.algorithm,
      definition: { scenarioId: definition.scenarioId, duration: definition.duration, difficulty: definition.difficulty || "standard",
        sequence: definition.sequence, setup: definition.setup || {}, goals: (definition.goals || []).map(({ path, min, max }) => ({ path, min, max })) },
      opening: { stats: core.stats, hidden: core.hidden, relations: core.relations, randomDraws: core.random.draws } };
    return { code, seed: start.seed, rulesVersion: 216, key: JSON.stringify(canonical(start)) };
  }

  function eligible(result) {
    const item = result?.comparisonIdentity;
    return Boolean(item?.code && typeof item.key === "string" && item.key && Number.isInteger(item.seed) && item.seed === result.randomSeed && item.rulesVersion === result.rulesVersion);
  }

  function compare(current, previous) {
    if (!eligible(current) || !eligible(previous) || current.comparisonIdentity.key !== previous.comparisonIdentity.key
      || current.comparisonIdentity.code !== previous.comparisonIdentity.code || current.randomSeed !== previous.randomSeed || current.rulesVersion !== previous.rulesVersion
      || current.gameCreatedAt === previous.gameCreatedAt) return { available: false, reason: "两局缺少一致的同题码、种子、规则或开局记录，不能直接比较。" };
    const goals = (current.checks || []).map(goal => {
      const old = (previous.checks || []).find(item => item.path === goal.path);
      const before = number(old?.value), after = number(goal.value);
      const delta = before == null || after == null ? null : number(after - before);
      const improvement = delta == null ? null : (goal.min == null ? -delta : delta);
      const gap = value => value == null ? null : number(goal.min != null ? Math.max(0, goal.min - value) : Math.max(0, value - goal.max));
      return { label: goal.label, path: goal.path, previous: before, current: after, delta, previousGap: gap(before), currentGap: gap(after),
        outcome: improvement == null ? "unknown" : improvement > 0 ? "improved" : improvement < 0 ? "worse" : "same" };
    });
    const effort = key => ({ previous: previous.review?.effort?.complete ? number(previous.review.effort[key]) : null,
      current: current.review?.effort?.complete ? number(current.review.effort[key]) : null });
    const choices = result => {
      const grouped = new Map();
      for (const receipt of result.review?.choices || []) {
        if (!grouped.has(receipt.turn)) grouped.set(receipt.turn, []);
        grouped.get(receipt.turn).push(`${receipt.kind === "decision" ? "裁决" : receipt.kind === "action" ? "行动" : "处分"}：${receipt.choice || receipt.title}`);
      }
      return grouped;
    };
    const oldChoices = choices(previous), newChoices = choices(current);
    const choiceDifferences = [...new Set([...oldChoices.keys(), ...newChoices.keys()])].sort((a, b) => a - b).flatMap(turn => {
      const before = oldChoices.get(turn) || [], after = newChoices.get(turn) || [];
      return JSON.stringify(before) === JSON.stringify(after) ? [] : [{ turn, previous: before, current: after }];
    });
    return { available: true, code: current.comparisonIdentity.code, previousAt: previous.completedAt, currentAt: current.completedAt,
      previousMedal: previous.medal, currentMedal: current.medal, previousScore: previous.score, currentScore: current.score,
      previousEarly: Boolean(previous.endedEarly), currentEarly: Boolean(current.endedEarly), goals,
      effort: { actions: effort("actions"), treasury: effort("treasury") }, choiceDifferences,
      choicesComplete: Boolean(previous.review?.fromStart && current.review?.fromStart && previous.review?.choices && current.review?.choices) };
  }

  function findPrevious(current, results = []) {
    if (!eligible(current)) return { available: false, reason: "这局未保存完整的同题与开局条件。旧成绩继续保留，暂不能作两局对比。" };
    const index = results.findIndex(item => item.gameCreatedAt === current.gameCreatedAt);
    const older = index >= 0 ? results.slice(index + 1) : results;
    const previous = older.find(item => eligible(item) && item.comparisonIdentity.key === current.comparisonIdentity.key && item.gameCreatedAt !== current.gameCreatedAt);
    return previous ? compare(current, previous) : { available: false, reason: "暂无相同条件的上一局记录。使用“再试此短局”完成同题后，可查看两局差异；旧成绩或不同条件的成绩保留在历史中。" };
  }

  function html(comparison) {
    if (!comparison?.available) return `<section class="same-challenge"><h3>同题两局对比</h3><p class="short-review-note">${escape(comparison?.reason || "尚无对比记录。")}</p></section>`;
    const row = (label, values) => `<tr><th>${escape(label)}</th><td>${display(values.previous)}</td><td>${display(values.current)}</td><td>${values.previous == null || values.current == null ? "未记录" : signed(values.current - values.previous)}</td></tr>`;
    return `<details class="same-challenge"><summary>与上次同题比较</summary><p>${escape(comparison.code)} · 同题码、种子、规则和已记录开局条件一致。</p>
      <p>上次：${escape(medals(comparison.previousMedal))} · ${display(comparison.previousScore)} 分${comparison.previousEarly ? " · 提前终局" : ""}<br>本局：${escape(medals(comparison.currentMedal))} · ${display(comparison.currentScore)} 分${comparison.currentEarly ? " · 提前终局" : ""}</p>
      <table><thead><tr><th>目标</th><th>上次终值</th><th>本局终值</th><th>变化</th></tr></thead><tbody>${comparison.goals.map(goal => `<tr class="${goal.outcome}"><th>${escape(goal.label)}</th><td>${display(goal.previous)}<small>差额 ${display(goal.previousGap)}</small></td><td>${display(goal.current)}<small>差额 ${display(goal.currentGap)}</small></td><td>${signed(goal.delta)}</td></tr>`).join("")}</tbody></table>
      <table><thead><tr><th>实际投入</th><th>上次</th><th>本局</th><th>变化</th></tr></thead><tbody>${row("御前行动次数", comparison.effort.actions)}${row("处分国库净支出", comparison.effort.treasury)}</tbody></table>
      <p class="short-review-note">支出为已记录处分的实际国库净减少之和，不含月末用度；缺失的投入不记作零。</p>
      <details><summary>查看不同的逐月选择 · ${comparison.choiceDifferences.length} 月</summary>${comparison.choiceDifferences.map(item => `<article><strong>第 ${item.turn} 月</strong><p>上次：${escape(item.previous.join("；") || "无记录")}</p><p>本局：${escape(item.current.join("；") || "无记录")}</p></article>`).join("") || "<p>已记录的选择相同。</p>"}${!comparison.choicesComplete ? '<p class="short-review-note">部分选择记录不完整，未记录不代表未行动。</p>' : ""}</details>
      <p class="short-review-note">比较实际结果；差异还包含行动引出的回响与风险，不能据此认定某个选择必胜。</p></details>`;
  }

  function text(comparison) {
    if (!comparison?.available) return `同题两局对比：${comparison?.reason || "尚无记录"}`;
    return [`同题两局对比：${comparison.code}`, `上次 ${medals(comparison.previousMedal)} ${comparison.previousScore} 分；本局 ${medals(comparison.currentMedal)} ${comparison.currentScore} 分`,
      ...comparison.goals.map(goal => `${goal.label}：${display(goal.previous)} → ${display(goal.current)}（${signed(goal.delta)}）；目标差额 ${display(goal.previousGap)} → ${display(goal.currentGap)}`),
      `御前行动次数：${display(comparison.effort.actions.previous)} → ${display(comparison.effort.actions.current)}`,
      `处分国库净支出：${display(comparison.effort.treasury.previous)} → ${display(comparison.effort.treasury.current)}`,
      ...comparison.choiceDifferences.map(item => `第 ${item.turn} 月｜上次 ${item.previous.join("；") || "无记录"}｜本局 ${item.current.join("；") || "无记录"}`)].join("\n");
  }
  window.XianSameChallenge = Object.freeze({ identity, compare, findPrevious, html, text });
})();
