/* v2.17.0 · 短局复盘。只读实际记录，不改变行动、随机序列或成绩规则。 */
(() => {
  "use strict";
  const NAMES = { authority: "皇权", prestige: "汉室威望", security: "宫廷安全", treasury: "国库", officials: "百官支持", caoAlert: "曹氏警戒",
    loyalNetwork: "忠汉网络", leakRisk: "泄密风险", peopleStability: "民间稳定", externalBalance: "外部制衡", escapeRoute: "安全退路" };
  const snapshot = core => ({ stats: { ...core.stats }, hidden: { ...core.hidden } });
  const number = value => Math.round(Number(value) * 100) / 100;
  const signed = value => `${value > 0 ? "+" : ""}${number(value)}`;
  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const read = (value, path) => { const found = String(path).split(".").reduce((item, key) => item?.[key], value); return found != null && Number.isFinite(Number(found)) ? number(found) : null; };
  const name = path => NAMES[String(path).split(".").at(-1)] || String(path);
  const medalName = value => ({ gold: "金章", silver: "银章", bronze: "铜章", none: "未获章" })[value] || "未获章";

  function createLog(core, fromStart = false) {
    return { version: 2, fromStart, fromTurn: Number(core.turn), baseline: fromStart ? snapshot(core) : null, receipts: [], months: [], settlements: [],
      pendingMonth: { turn: Number(core.turn), date: date(core), start: snapshot(core), partial: !fromStart && (core.eventResolved || core.actionPoints < 2 || core.monthlySettledTurn >= core.turn) } };
  }

  function date(core) { return window.XianEmperorGame?.formatReignDate?.(core.year, core.month) || `${core.year}年${core.month}月`; }

  function capture(log, core) {
    if (!log || !core) return;
    if (log.pendingMonth?.turn !== Number(core.turn)) {
      log.pendingMonth = { turn: Number(core.turn), date: date(core), start: snapshot(core), partial: core.eventResolved || core.actionPoints < 2 };
    }
    const receipts = new Map((log.receipts || []).map(item => [item.id, item]));
    for (const report of core.reports || []) {
      if (report.gameCreatedAt !== core.createdAt || !["action", "decision"].includes(report.outcome?.kind)) continue;
      if (!Number.isFinite(Number(report.timestamp))) continue;
      const changes = ["stats", "hidden"].flatMap(group => (report.outcome[group] || []).filter(item => Number.isFinite(Number(item.delta)) && Number(item.delta) !== 0)
        .map(item => ({ path: `${group}.${item.key}`, before: number(item.before), after: number(item.after), delta: number(item.delta) })));
      const id = String(report.timestamp);
      receipts.set(id, { id, turn: Number(report.turn), date: String(report.date || "御前"), title: String(report.title || "御前处分").slice(0, 100),
        kind: report.outcome.kind, actionPointsSpent: Number(report.outcome.actionPointsSpent || 0),
        treasurySpent: Math.max(0, -(changes.find(item => item.path === "stats.treasury")?.delta || 0)),
        choice: String(report.choiceLabel || "").slice(0, 120), changes });
    }
    log.receipts = [...receipts.values()].sort((a, b) => a.turn - b.turn || Number(a.id) - Number(b.id)).slice(-40);
  }

  function settle(log, core) {
    capture(log, core);
    if (!log || core.monthlySettledTurn < core.turn) return;
    const month = { ...log.pendingMonth, end: snapshot(core) };
    log.months = [...(log.months || []).filter(item => item.turn !== month.turn), month].sort((a, b) => a.turn - b.turn).slice(-8);
  }

  function recordSettlement(log, core, settlement) {
    if (!log || !core || settlement?.gameCreatedAt !== core.createdAt || settlement.turn !== core.turn) return;
    capture(log, core);
    const record = { turn: settlement.turn, partial: Boolean(settlement.partial), rows: (settlement.rows || []).map(row => ({
      path: row.path, before: row.before, actual: row.actual,
      sources: (row.sources || []).map(item => ({ source: String(item.source), delta: number(item.delta) })),
    })) };
    log.settlements = [...(log.settlements || []).filter(item => item.turn !== record.turn), record].sort((a, b) => a.turn - b.turn).slice(-8);
  }

  function breakdownFor(log, month, goal) {
    const ledger = log?.settlements?.find(item => item.turn === month.turn);
    const row = ledger?.rows?.find(item => item.path === goal.path);
    const before = read(month.start, goal.path), after = read(month.end, goal.path);
    if (!row || before == null || after == null) return null;
    const receipts = (log.receipts || []).filter(item => item.turn === month.turn);
    const receiptDelta = kind => number(receipts.filter(item => item.kind === kind).reduce((sum, item) => sum + (item.changes.find(change => change.path === goal.path)?.delta || 0), 0));
    const decisions = receiptDelta("decision"), actions = receiptDelta("action");
    const sources = (row.sources || []).map(item => ({ ...item }));
    const residual = number(after - row.before - sources.reduce((sum, item) => sum + item.delta, 0));
    if (Math.abs(residual) > .000001) sources.push({ source: "其他结算变化（未归类）", delta: residual });
    return { before, after, decisions, actions, otherDuringMonth: number(row.before - before - decisions - actions), sources,
      partial: Boolean(month.partial || ledger.partial) };
  }

  function turningPoints(goals, log) {
    const months = [...(log?.months || [])];
    // A terminal interruption can have a real ledger without a completed-month record.
    for (const ledger of log?.settlements || []) {
      if (months.some(month => month.turn === ledger.turn) || log.pendingMonth?.turn !== ledger.turn) continue;
      const end = JSON.parse(JSON.stringify(log.pendingMonth.start));
      for (const row of ledger.rows) { const [group, key] = row.path.split("."); if (end[group]) end[group][key] = row.actual; }
      months.push({ ...log.pendingMonth, end, partial: true });
    }
    months.sort((a, b) => a.turn - b.turn);
    return goals.flatMap(goal => {
      const passed = value => value != null && (goal.min == null || value >= goal.min) && (goal.max == null || value <= goal.max);
      let point = null, selectedMonth = null;
      for (const month of months) {
        const receipts = (log.receipts || []).filter(item => item.turn === month.turn);
        for (const receipt of receipts) {
          const change = receipt.changes.find(item => item.path === goal.path);
          if (change && passed(change.before) && !passed(change.after)) {
            point = { before: change.before, after: change.after, source: `${receipt.kind === "decision" ? "奏报裁决" : receipt.kind === "action" ? "御前行动" : "已记录处分"} · ${receipt.title}` };
            break;
          }
        }
        const row = log.settlements?.find(item => item.turn === month.turn)?.rows.find(item => item.path === goal.path);
        if (!point && row) {
          let current = row.before;
          for (const item of row.sources) {
            const next = number(current + item.delta);
            if (passed(current) && !passed(next)) { point = { before: current, after: next, source: `月末 · ${item.source}` }; break; }
            current = next;
          }
        }
        if (!point && passed(read(month.start, goal.path)) && !passed(read(month.end, goal.path))) {
          point = { before: read(month.start, goal.path), after: read(month.end, goal.path), source: "月内净变化；逐项转折来源未完整记录" };
        }
        if (point) { selectedMonth = month; break; }
      }
      let kind = "首次记录的跌出";
      if (!point) {
        const observations = months.filter(month => read(month.end, goal.path) != null);
        selectedMonth = observations.find(month => !passed(read(month.end, goal.path)));
        if (selectedMonth) kind = "首个已记录月末未达";
        else {
          selectedMonth = observations.sort((a, b) => {
            const margin = month => goal.min != null ? read(month.end, goal.path) - goal.min : goal.max - read(month.end, goal.path);
            return margin(a) - margin(b) || a.turn - b.turn;
          })[0];
          kind = "余量最小的一月";
        }
        if (selectedMonth) point = { before: read(selectedMonth.start, goal.path), after: read(selectedMonth.end, goal.path), source: "当月实际净变化" };
      }
      return !point || !selectedMonth ? [] : [{ ...point, kind, path: goal.path, label: goal.label, turn: selectedMonth.turn,
        finalPassed: goal.passed, partial: Boolean(selectedMonth.partial), breakdown: breakdownFor(log, selectedMonth, goal) }];
    });
  }

  function breakdownText(item) {
    const b = item.breakdown;
    return b ? `月初 ${b.before} → 月末 ${b.after}；奏报裁决 ${signed(b.decisions)}；御前行动 ${signed(b.actions)}${b.otherDuringMonth ? `；其他月内变化（未逐项记录） ${signed(b.otherDuringMonth)}` : ""}${b.sources.length ? `；${b.sources.map(source => `${source.source} ${signed(source.delta)}`).join("；")}` : "；月末无净变化"}${b.partial ? "（记录从续接或中止处开始）" : ""}` : "旧记录缺少当月结算来源，不能逐项解释。";
  }

  function adviceFor(goal, passed) {
    const target = goal.min ?? goal.max;
    const tips = {
      "stats.treasury": `先留出国库目标 ${target} 与月末用度；吃紧时用“筹措钱粮”，赈济或赏赐前核对全额费用。`,
      "stats.authority": "前两月择机整饬朝仪或任免封赏，先复核费用和曹氏警戒；接近皇权目标后减少连续加码。",
      "stats.security": "裁决前比较宫廷安全的实际预览；危急时先稳住宿卫，也可保留行动用于月末守成。",
      "stats.officials": "比较奏报中百官支持的代价，择机公开召见或任免封赏；不要只补宫廷安全而忽略官心。",
      "stats.prestige": "择机整饬朝仪或拟旨修明礼制，复核国库支出；保持汉廷名分也要留足月末钱粮。",
      "stats.caoAlert": "避免连续密令或整军；安抚曹氏能降低警戒，但会牺牲皇权，接近目标后可留行动守成。",
      "hidden.loyalNetwork": "前期择机密令联络可信人物，守成不会自动补足忠汉网络；每次密联后留意泄密与警戒。",
      "hidden.leakRisk": "减少连续密令，比较奏报中的泄密代价，穿插公开召见或守成；不要只看忠汉网络的收益。",
      "hidden.peopleStability": "量力赈济或减轻赋役，先复核费用；缺钱时先筹措，同时保留宫禁与百官所需资源。",
    };
    return { path: goal.path, heading: passed ? `保持${name(goal.path)}` : `优先${goal.min != null ? "补足" : "降低"}${name(goal.path)}`, text: tips[goal.path] || "裁决和用玺前比较目标的收益与代价，留出最后一月用度；结果仍需在终月核验。" };
  }

  function build(result, definition = {}, core = {}, log = null) {
    const goals = (result.checks || []).map(check => {
      const value = number(check.value);
      const start = read(log?.baseline, check.path);
      const gap = number(check.min != null ? Math.max(0, check.min - value) : Math.max(0, value - check.max));
      const margin = number(check.min != null ? value - check.min : check.max - value);
      return { ...check, value, start, change: start == null ? null : number(value - start), gap, margin };
    });
    const goalPaths = new Set(goals.map(goal => goal.path));
    const moments = (log?.receipts || []).map(receipt => ({ ...receipt,
      weight: receipt.changes.filter(change => goalPaths.has(change.path)).reduce((sum, change) => sum + Math.abs(change.delta), 0),
      changes: receipt.changes.filter(change => goalPaths.has(change.path) || change.path === "stats.treasury"),
    })).filter(receipt => receipt.weight > 0).sort((a, b) => b.weight - a.weight || a.turn - b.turn || Number(a.id) - Number(b.id)).slice(0, 3).sort((a, b) => a.turn - b.turn || Number(a.id) - Number(b.id));
    const months = (log?.months || []).map(month => ({ turn: month.turn, date: month.date, partial: Boolean(month.partial),
      changes: goals.map(goal => ({ path: goal.path, before: read(month.start, goal.path), after: read(month.end, goal.path) }))
        .filter(change => change.before != null && change.after != null).map(change => ({ ...change, delta: number(change.after - change.before) })) }));
    const missing = goals.filter(goal => !goal.passed).sort((a, b) => b.gap - a.gap);
    const priorities = missing.length ? missing : [...goals].sort((a, b) => a.margin - b.margin).slice(0, 2);
    const advice = priorities.slice(0, 3).map(goal => adviceFor(goal, Boolean(goal.passed)));
    if (result.endedEarly) advice.unshift({ heading: "先避免提前终局", text: "先处理触发本次终局的宫禁、威望、警戒或钱粮危机，再追求短局目标；提前终局不授章。" });
    const receipts = log?.receipts || [];
    const effortKnown = Boolean(log?.fromStart) && receipts.every(item => Number.isFinite(item.actionPointsSpent) && Number.isFinite(item.treasurySpent));
    return { version: 2, name: String(result.name || definition.name || "乱世短局"), medal: result.medal, completed: result.completed, total: result.total,
      endedEarly: Boolean(result.endedEarly), endingTitle: String(result.endingTitle || core.ending?.title || ""),
      duration: Number(definition.duration || 0), turn: Number(core.turn || result.finalTurn || 0), fromStart: Boolean(log?.fromStart), fromTurn: Number(log?.fromTurn || 0),
      receiptCount: receipts.length, goals, moments, months, advice: advice.slice(0, 3), turningPoints: turningPoints(goals, log),
      effort: { complete: effortKnown, actions: effortKnown ? receipts.reduce((sum, item) => sum + item.actionPointsSpent, 0) : null,
        treasury: effortKnown ? number(receipts.reduce((sum, item) => sum + item.treasurySpent, 0)) : null },
      choices: receipts.map(({ turn, kind, title, choice }) => ({ turn, kind, title, choice })) };
  }

  function goalText(goal) {
    return `${goal.label} · 终值 ${goal.value} · ${goal.passed ? `达标，余量 ${Math.max(0, goal.margin)}` : `${goal.min != null ? "尚差" : "须降低"} ${goal.gap}`}`;
  }
  function changeText(change) { return `${name(change.path)} ${change.before} → ${change.after}（${signed(change.delta)}）`; }

  function html(review) {
    const coverage = review.fromStart ? `记录覆盖开局至终局，已保存 ${review.months.length} 次月末核验。` : "旧局或中途接续的记录有限；未记录的开局值与月份不作推断。";
    return `<header class="short-review-heading"><div><span>乱世短局 · ${review.endedEarly ? "提前终局" : "终月核验"}</span><h2>本局复盘</h2></div><strong>${escapeHtml(medalName(review.medal))} · ${review.completed}/${review.total}</strong></header>
      ${review.endedEarly ? `<p class="short-review-warning">第 ${review.turn} 月提前终局${review.endingTitle ? `：${escapeHtml(review.endingTitle)}` : ""}，未完成 ${review.duration} 个月限时核验。部分指标达标也不授章。</p>` : ""}
      <section><h3>目标差在哪</h3><ul class="short-review-goals">${review.goals.map(goal => `<li class="${goal.passed ? "passed" : "pending"}"><strong>${escapeHtml(goalText(goal))}</strong><span>${goal.start == null ? "开局值未记录" : `开局 ${goal.start} → 终值 ${goal.value}（${signed(goal.change)}）`}</span></li>`).join("")}</ul></section>
      <section><h3>影响目标的已记录处分</h3><p class="short-review-note">按目标即时变化幅度选出最多三项；月末用度、后续回响与其他处分也会影响终值。</p>${review.moments.length ? `<ol class="short-review-moments">${review.moments.map(item => `<li><strong>第 ${item.turn} 月 · ${escapeHtml(item.title)}</strong>${item.choice ? `<p>${escapeHtml(item.choice)}</p>` : ""}<p>${escapeHtml(item.changes.map(changeText).join(" · "))}</p></li>`).join("")}</ol>` : '<p class="short-review-note">没有足够的目标变化记录，不推断关键原因。</p>'}</section>
      <section><h3>目标转折与当月来源</h3>${review.turningPoints?.length ? `<ul class="short-review-turns">${review.turningPoints.map(item => `<li><strong>${escapeHtml(item.label)} · 第 ${item.turn} 月 · ${escapeHtml(item.kind)}</strong><p>${escapeHtml(item.source)}：${item.before} → ${item.after}。终局${item.finalPassed ? "已达标" : "未达标"}${item.partial ? "；本月记录有限" : ""}。</p><details><summary>展开当月变化来源</summary><p>${escapeHtml(breakdownText(item))}</p></details></li>`).join("")}</ul>` : '<p class="short-review-note">旧复盘未保存转折来源，不补造历史。</p>'}<p class="short-review-note">这里解释已记录的变化；调整其中一项不能保证改变最终成绩。</p></section>
      <section><h3>下一局先做什么</h3><ul class="short-review-advice">${review.advice.map(item => `<li><strong>${escapeHtml(item.heading)}</strong><p>${escapeHtml(item.text)}</p></li>`).join("")}</ul></section>
      <details class="short-review-months"><summary>逐月净变化 · ${review.months.length} 个月已记录</summary><p>${escapeHtml(coverage)}</p>${review.months.map(month => `<article><strong>第 ${month.turn} 月 · ${escapeHtml(month.date)}${month.partial ? "（从续接时开始）" : ""}</strong><p>${escapeHtml(month.changes.map(changeText).join(" · "))}</p></article>`).join("")}</details>
      <p class="short-review-note">建议用于比较下一局的取舍，不能保证获章。</p>`;
  }

  function text(review) {
    return ["短局复盘：", `${review.name} · ${medalName(review.medal)} · 完成 ${review.completed}/${review.total} 项目标`,
      ...(review.endedEarly ? [`第 ${review.turn} 月提前终局：${review.endingTitle}；未完成终月核验，提前终局不授章。`] : []),
      "目标核验：", ...review.goals.map(goalText), "已记录处分（即时变化，其他处分与月末回响另算）：",
      ...review.moments.map(item => `第 ${item.turn} 月 ${item.title}${item.choice ? `｜${item.choice}` : ""}：${item.changes.map(changeText).join("；")}`),
      "逐月净变化：", ...review.months.map(month => `第 ${month.turn} 月${month.partial ? "（从续接时开始）" : ""}：${month.changes.map(changeText).join("；")}`),
      ...(!review.fromStart ? ["旧局或中途接续记录有限，未记录数据不作推断。"] : []), "目标转折与当月来源：",
      ...(review.turningPoints || []).map(item => `${item.label}｜第 ${item.turn} 月 ${item.kind}｜${item.source} ${item.before} → ${item.after}｜${breakdownText(item)}`),
      "下一局建议：", ...review.advice.map(item => `${item.heading}：${item.text}`),
      "建议不能保证获章。"].join("\n");
  }

  window.XianShortReview = Object.freeze({ createLog, capture, settle, recordSettlement, build, html, text });
})();
