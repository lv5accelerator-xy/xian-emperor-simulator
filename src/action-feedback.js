/* v2.15.0 · 本次处分的实际结果，与月末结算分开呈现。 */
(() => {
  "use strict";
  const HIDDEN_NAMES = { loyalNetwork: "忠汉网络", leakRisk: "泄密风险", peopleStability: "民间稳定", externalBalance: "外部制衡", escapeRoute: "安全退路" };
  let lastRender = "";

  function escapeHtml(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  }
  function number(value) { return String(Math.round(Number(value) * 100) / 100); }
  function signed(value) { return `${value > 0 ? "+" : ""}${number(value)}`; }
  function name(key) { return window.GAME_DATA?.statMeta?.[key]?.name || key; }
  function describeChanges(outcome) {
    return (outcome?.stats || []).map(item => `${name(item.key)} ${number(item.before)} → ${number(item.after)}（${signed(item.delta)}）`).join("，");
  }

  function buildHtml(report) {
    const outcome = report.outcome;
    const treasury = (outcome.stats || []).find(item => item.key === "treasury")?.delta || 0;
    const cost = `御前行动 ${number(outcome.actionPointsSpent || 0)} 次 · 国库${treasury < 0 ? `净支出 ${number(-treasury)}` : treasury > 0 ? `净入库 ${number(treasury)}` : "无净消耗"}`;
    const changes = (outcome.stats || []).map(item => {
      const favorable = item.key === "caoAlert" ? item.delta < 0 : item.delta > 0;
      return `<li class="${favorable ? "gain" : "cost"}">${escapeHtml(name(item.key))} <b>${number(item.before)} → ${number(item.after)}</b> <span>${signed(item.delta)}</span></li>`;
    }).join("");
    const hidden = (outcome.hidden || []).map(item => `${HIDDEN_NAMES[item.key] || item.key}：${item.delta > 0 ? "上升" : "下降"}`);
    const relations = (outcome.relations || []).map(item => `${window.GAME_DATA?.characters?.find(person => person.id === item.key)?.name || item.key}关系 ${signed(item.delta)}`);
    const followUps = (outcome.followUps || []).map(item => `<li>第 ${number(item.dueTurn)} 月 · ${escapeHtml(item.title)}：${escapeHtml(item.text)}</li>`).join("");
    return `<header><span>${outcome.kind === "decision" ? "奏报已裁决" : "行动已完成"} · 实际结果</span><strong>${escapeHtml(report.title)}</strong></header>
      <p class="feedback-cost">${escapeHtml(cost)}</p>
      ${changes ? `<ul class="feedback-changes">${changes}</ul>` : '<p>本次没有公开指标净变化。</p>'}
      ${hidden.length || relations.length ? `<details><summary>局势与人物变化</summary><p>${escapeHtml([...hidden, ...relations].join(" · "))}</p></details>` : ""}
      ${outcome.execution ? `<p>圣旨执行评估（已记录）：${number(outcome.execution.value)}%</p>` : ""}
      ${followUps ? `<details class="feedback-future"><summary>新增后续事项 ${outcome.followUps.length} 项</summary><ul>${followUps}</ul></details>` : ""}
      <small>以上为本次处分及即时朝局反馈；月末用度、泄密检验和后续回响另行结算。</small>`;
  }

  function render(core) {
    const panel = document.getElementById("action-feedback");
    if (!panel) return;
    const report = (core?.reports || []).find(item => item.gameCreatedAt === core.createdAt && item.turn === core.turn
      && ["action", "decision"].includes(item.outcome?.kind));
    panel.hidden = !report;
    if (!report) { lastRender = ""; return; }
    const key = JSON.stringify([core.createdAt, core.turn, report.timestamp, report.outcome]);
    if (key === lastRender) return;
    lastRender = key;
    panel.innerHTML = buildHtml(report);
  }

  window.XianActionFeedback = Object.freeze({ render, buildHtml, describeChanges });
})();
