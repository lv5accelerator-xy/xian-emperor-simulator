/*
 * 天子蒙尘：献帝模拟器 - 月度施政覆奏扩展 v2.23.0
 *
 * 该扩展不修改核心规则引擎。它在“结束本月”前后读取本地存档，
 * 汇总当月奏报裁决、御前行动、月末结算和国势变化，
 * 生成可复查的《尚书台月度施政覆奏》。
 */
(() => {
  "use strict";

  const GAME_SAVE_KEY = "xian_emperor_simulator_v01";
  const REPORT_STORE_KEY = "xian_emperor_monthly_reports_v011";
  const SNAPSHOT_STORE_KEY = "xian_emperor_month_snapshot_v011";
  const MAX_REPORTS = 36;
  let closeActiveOverlay = null;
  let returnFocus = null;

  document.addEventListener("DOMContentLoaded", initMonthlyReports);

  function initMonthlyReports() {
    installArchiveButton();
    document.addEventListener("xian:settlement-completed", event => {
      const { before, after } = event.detail;
      const report = buildMonthlyReport(before, after, getMonthStartSnapshot(before));
      saveMonthlyReport(report, before.createdAt || null);
      if (!after.ended) showMonthlyReport(report, { campaignEnded: false });
    });
    document.addEventListener("xian:core-saved", () => setTimeout(() => ensureCurrentMonthSnapshot(), 0));
    document.getElementById("ending-audit-btn")?.addEventListener("click", () => {
      const settlement = window.XianEmperorGame.getState()?.lastSettlement;
      if (!settlement) return showAddonToast("本存档尚无结算对账记录。", "warning");
      window.XianEmperorGame.openUtilityModal({ title: "终月结算对账", body: window.XianMonthlySafety.renderSettlement(settlement),
        confirmText: "关闭", cancelHidden: true, wide: true, onConfirm: window.XianEmperorGame.closeUtilityModal });
    });
    bindSnapshotHooks();
    ensureCurrentMonthSnapshot();
  }

  function readGameState() {
    try {
      const raw = localStorage.getItem(GAME_SAVE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return parsed && parsed.stats && parsed.hidden ? parsed : null;
    } catch (error) {
      console.error("月报扩展读取存档失败", error);
      return null;
    }
  }

  function readReportStore() {
    try {
      const raw = localStorage.getItem(REPORT_STORE_KEY);
      if (!raw) return { gameCreatedAt: null, reports: [] };
      const parsed = JSON.parse(raw);
      return {
        gameCreatedAt: parsed?.gameCreatedAt || null,
        reports: Array.isArray(parsed?.reports) ? parsed.reports : [],
      };
    } catch (error) {
      console.error("月报扩展读取月报档案失败", error);
      return { gameCreatedAt: null, reports: [] };
    }
  }

  function writeReportStore(store) {
    try {
      localStorage.setItem(
        REPORT_STORE_KEY,
        JSON.stringify({
          gameCreatedAt: store.gameCreatedAt || null,
          reports: (store.reports || []).slice(-MAX_REPORTS),
        })
      );
    } catch (error) {
      console.error("月报扩展保存失败", error);
      showAddonToast("月报保存失败：浏览器可能禁止本地存储。", "error");
    }
  }

  function readMonthSnapshot() {
    try {
      const raw = localStorage.getItem(SNAPSHOT_STORE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function writeMonthSnapshot(state) {
    if (!state) return;
    const snapshot = {
      gameCreatedAt: state.createdAt || null,
      turn: state.turn,
      year: state.year,
      month: state.month,
      date: formatReignDate(state.year, state.month),
      stats: { ...state.stats },
      hidden: { ...state.hidden },
      capturedAt: new Date().toISOString(),
    };
    try {
      localStorage.setItem(SNAPSHOT_STORE_KEY, JSON.stringify(snapshot));
    } catch (error) {
      console.error("月报扩展保存月初快照失败", error);
    }
  }

  function ensureCurrentMonthSnapshot(force = false) {
    const state = readGameState();
    if (!state || state.ended) return;
    const snapshot = readMonthSnapshot();
    const matches =
      snapshot &&
      snapshot.gameCreatedAt === (state.createdAt || null) &&
      snapshot.turn === state.turn &&
      snapshot.year === state.year &&
      snapshot.month === state.month;

    if (force || !matches) writeMonthSnapshot(state);
  }

  function installArchiveButton() {
    const nav = document.querySelector(".utility-nav");
    if (!nav || document.getElementById("month-report-btn")) return;

    const button = document.createElement("button");
    button.id = "month-report-btn";
    button.type = "button";
    button.textContent = "月报";
    button.title = "复查历月尚书台施政覆奏";
    button.addEventListener("click", openReportArchive);

    const helpButton = document.getElementById("help-btn");
    nav.insertBefore(button, helpButton || null);
  }

  function bindSnapshotHooks() {
    const resetForNewGame = () => {
      localStorage.removeItem(REPORT_STORE_KEY);
      localStorage.removeItem(SNAPSHOT_STORE_KEY);
      setTimeout(() => ensureCurrentMonthSnapshot(true), 0);
    };

    document.getElementById("new-game-btn")?.addEventListener("click", resetForNewGame);
    document.getElementById("continue-game-btn")?.addEventListener("click", () => {
      setTimeout(() => ensureCurrentMonthSnapshot(false), 0);
    });
    document.getElementById("load-btn")?.addEventListener("click", () => {
      setTimeout(() => ensureCurrentMonthSnapshot(true), 0);
    });
    document.getElementById("import-file")?.addEventListener("change", () => {
      setTimeout(() => ensureCurrentMonthSnapshot(true), 80);
    });
  }

  function getMonthStartSnapshot(before) {
    const snapshot = readMonthSnapshot();
    const matches =
      snapshot &&
      snapshot.gameCreatedAt === (before.createdAt || null) &&
      snapshot.turn === before.turn &&
      snapshot.year === before.year &&
      snapshot.month === before.month;

    if (matches) return { ...snapshot, partial: false };

    return {
      gameCreatedAt: before.createdAt || null,
      turn: before.turn,
      year: before.year,
      month: before.month,
      date: formatReignDate(before.year, before.month),
      stats: { ...before.stats },
      hidden: { ...before.hidden },
      partial: true,
    };
  }

  function buildMonthlyReport(before, after, monthStart) {
    const date = formatReignDate(before.year, before.month);
    const operations = extractOperations(before, date);
    const dynamics = extractMonthEndReports(after, date, before);
    const averageExecution = operations.length
      ? Math.round(operations.reduce((sum, item) => sum + item.execution, 0) / operations.length)
      : null;
    const overall = executionBand(averageExecution);

    const counts = {
      fulfilled: operations.filter((item) => item.execution >= 75).length,
      partial: operations.filter((item) => item.execution >= 50 && item.execution < 75).length,
      poor: operations.filter((item) => item.execution < 50).length,
      estimated: operations.filter(item => item.executionSource !== "recorded").length,
    };

    const statNames = {
      authority: ["皇权", "诏"],
      prestige: ["汉室威望", "汉"],
      security: ["宫廷安全", "禁"],
      treasury: ["国库", "财"],
      officials: ["百官支持", "官"],
      caoAlert: ["曹氏警戒", "戒"],
    };

    const statChanges = Object.entries(statNames).map(([key, [name, icon]]) => {
      const beforeValue = Math.round(monthStart.stats?.[key] ?? before.stats?.[key] ?? 0);
      const afterValue = Math.round(after.stats?.[key] ?? before.stats?.[key] ?? 0);
      return {
        key,
        name,
        icon,
        before: beforeValue,
        after: afterValue,
        delta: afterValue - beforeValue,
      };
    });

    const hiddenNames = {
      loyalNetwork: "忠汉网络",
      leakRisk: "泄密风险",
      peopleStability: "民间稳定",
      externalBalance: "外部制衡",
      escapeRoute: "南方退路",
    };

    const hiddenTrends = Object.entries(hiddenNames).map(([key, name]) => {
      const startValue = Math.round(monthStart.hidden?.[key] ?? before.hidden?.[key] ?? 0);
      const endValue = Math.round(after.hidden?.[key] ?? before.hidden?.[key] ?? 0);
      const delta = endValue - startValue;
      const favorableDelta = key === "leakRisk" ? -delta : delta;
      return {
        key,
        name,
        delta,
        direction: delta > 0 ? "上升" : delta < 0 ? "下降" : "持平",
        tone: favorableDelta > 0 ? "good" : favorableDelta < 0 ? "bad" : "flat",
      };
    });

    const report = {
      id: `monthly-report-${before.createdAt || "game"}-${before.turn}-${Date.now()}`,
      gameCreatedAt: before.createdAt || null,
      turn: before.turn,
      date,
      operations,
      averageExecution,
      hasEstimates: counts.estimated > 0,
      overall,
      counts,
      statChanges,
      hiddenTrends,
      settlement: after.lastSettlement?.gameCreatedAt === before.createdAt && after.lastSettlement.turn === before.turn ? after.lastSettlement : null,
      monthEndNotes: dynamics.notes.length ? dynamics.notes : ["朝廷庶务照常运转，未见另项异常。"],
      monthEndSummary: dynamics.summary || "尚书台未列额外公开数值变化。",
      alerts: dynamics.alerts,
      baselinePartial: Boolean(monthStart.partial),
      campaignEnded: Boolean(after.ended),
      advice: buildStrategicAdvice(after),
      verdict: "",
      generatedAt: new Date().toISOString(),
    };

    report.verdict = buildVerdict(report);
    return report;
  }

  function extractOperations(before, date) {
    const reports = Array.isArray(before.reports) ? before.reports : [];
    const selected = reports
      .filter((report) => matchesMonth(report, before, date) && (report.type === "decision" || report.type === "action"))
      .slice()
      .reverse();

    return selected.map((report, index) => {
      const recorded = report.outcome?.execution?.source === "recorded" ? report.outcome.execution.value : extractExecutionPercent(report.text);
      const executionSource = recorded == null ? "estimated" : "recorded";
      const execution = recorded ?? estimateExecution(before, report);
      const band = executionBand(execution);
      const [result, changes] = splitReportText(report.text);
      return {
        id: `operation-${before.turn}-${report.timestamp || index}`,
        kind: inferOperationKind(report),
        title: report.title || "未题名政务",
        result,
        changes: report.outcome ? describeActualChanges(report.outcome) : changes || "未见即时公开数值变化",
        actualChanges: Boolean(report.outcome),
        actionPointsSpent: report.outcome?.actionPointsSpent ?? null,
        executionSource,
        execution,
        status: band.label,
        statusClass: band.className,
        assessment: `${executionSource === "estimated" ? "按当月局势估计，实际结果以记录变化为准；" : "采用政令中已记录的执行评估；"}${buildOperationAssessment(before, report, execution)}`,
      };
    });
  }

  function matchesMonth(report, core, date) {
    if (report.turn != null) return Number(report.turn) === Number(core.turn) && (!report.gameCreatedAt || report.gameCreatedAt === core.createdAt);
    return report.date === date;
  }

  function extractMonthEndReports(after, date, before = after) {
    const reports = Array.isArray(after.reports) ? after.reports : [];
    const previous = new Set((before.reports || []).map(item => `${item.timestamp}:${item.title}:${item.text}`));
    const items = reports
      .filter(
        (report) =>
          matchesMonth(report, before, date) &&
          (report.title === "月末结算" || report.title === "宫中警讯" || !previous.has(`${report.timestamp}:${report.title}:${report.text}`))
      )
      .slice()
      .reverse();

    const notes = [];
    const summaries = [];
    const alerts = [];

    items.forEach((report) => {
      if (["danger", "warning"].includes(report.type) || report.title === "宫中警讯") {
        alerts.push(`${report.title}：${report.text}`);
      }
      if (report.title === "宫中警讯") {
        notes.push(report.text);
        return;
      }

      const [main, delta] = splitReportText(report.text);
      main
        .replace(/[。.]$/, "")
        .split("；")
        .map((item) => item.trim())
        .filter(Boolean)
        .forEach((item) => {
          notes.push(report.title === "月末结算" ? item : `${report.title}：${item}`);
          if (report.title === "月末结算" && ["俸粮与行政经费不足", "民间不稳，流言与盗贼滋生"].includes(item)) {
            alerts.push(`月末结算：${item}`);
          }
        });
      if (delta) summaries.push(`${report.title}：${delta.replace(/[。.]$/, "")}`);
    });

    return { notes, summary: summaries.join("；"), alerts };
  }

  function splitReportText(text = "") {
    const parts = String(text).split("｜");
    return [parts.shift()?.trim() || "", parts.join("｜").trim()];
  }

  function extractExecutionPercent(text = "") {
    const preferred = String(text).match(/(?:执行评估|落实到地方|执行度)[^0-9]{0,18}(\d{1,3})%/);
    if (!preferred) return null;
    const value = Number(preferred[1]);
    return Number.isFinite(value) ? clamp(Math.round(value), 0, 100) : null;
  }

  function describeActualChanges(outcome) {
    return (outcome.stats || []).map(item => `${window.GAME_DATA?.statMeta?.[item.key]?.name || item.key} ${item.before} → ${item.after}（${signed(item.delta)}）`).join("，") || "公开指标无净变化";
  }

  function estimateExecution(state, report) {
    const stats = state.stats || {};
    const hidden = state.hidden || {};
    let score =
      45 +
      Number(stats.authority || 0) * 0.2 +
      Number(stats.officials || 0) * 0.16 +
      Number(stats.security || 0) * 0.06;

    score -= Math.max(0, Number(stats.caoAlert || 0) - 55) * 0.18;

    const text = `${report.title || ""} ${report.text || ""}`;
    if (/密令|密联|秘密|衣带/.test(text)) {
      score += Number(hidden.loyalNetwork || 0) * 0.08;
      score -= Number(hidden.leakRisk || 0) * 0.18;
    }
    if (/外镇|袁绍|袁术|刘表|孙策|使者|贡赋/.test(text)) {
      score += Number(hidden.externalBalance || 0) * 0.06;
    }
    if (report.type === "decision") score += 3;
    if (/国库不足|无法|折损|未能/.test(text)) score -= 12;

    return clamp(Math.round(score), 28, 96);
  }

  function inferOperationKind(report) {
    const title = `${report.title || ""} ${report.text || ""}`;
    if (report.type === "decision") return "奏报裁决";
    if (/圣旨/.test(title)) return "自由圣旨";
    if (/召见|召对/.test(title)) return "召对";
    if (/封赏|任命|加授|赐爵|褒奖/.test(title)) return "任免封赏";
    if (/密联|密令|秘密/.test(title)) return "密令联络";
    if (/赈济|减赋|仓廪/.test(title)) return "赈济减赋";
    if (/朝会|宗庙|经筵|朝仪/.test(title)) return "礼制";
    if (/司空|曹氏|赐宴|军务便宜/.test(title)) return "安抚曹氏";
    if (/外镇|慰劳|贡赋|使者/.test(title)) return "外镇交涉";
    return "御前政务";
  }

  function buildOperationAssessment(state, report, execution) {
    const reasons = [];
    const stats = state.stats || {};
    const hidden = state.hidden || {};
    const text = `${report.title || ""} ${report.text || ""}`;

    if (execution >= 80) reasons.push("中枢承办顺畅");
    if (Number(stats.authority || 0) < 35) reasons.push("诏令权威有限");
    if (Number(stats.officials || 0) < 35) reasons.push("尚书台承办能力不足");
    if (Number(stats.caoAlert || 0) >= 70) reasons.push("司空府审查牵制");
    if (/密令|密联|秘密/.test(text) && Number(hidden.leakRisk || 0) >= 45) {
      reasons.push("传递链路受泄密风险影响");
    }
    if (/国库不足|无法/.test(text)) reasons.push("钱粮调拨吃紧");
    if (reasons.length === 0) reasons.push("各署依常例办理");

    return reasons.join("；");
  }

  function executionBand(value) {
    if (value == null) return { label: "无可评估政令", className: "neutral" };
    if (value >= 90) return { label: "奉诏尽行", className: "excellent" };
    if (value >= 75) return { label: "大部施行", className: "good" };
    if (value >= 60) return { label: "施行过半", className: "balanced" };
    if (value >= 45) return { label: "层层折损", className: "warning" };
    return { label: "奉行不力", className: "critical" };
  }

  function buildVerdict(report) {
    if (report.averageExecution == null) return "本月没有可评估的政令记录；请依据月末用度与国势净变判断局势，不能据此认定政令全部落实。";
    const favorable = report.statChanges.filter(
      (item) => (item.key === "caoAlert" ? item.delta < 0 : item.delta > 0)
    ).length;
    const adverse = report.statChanges.filter(
      (item) => (item.key === "caoAlert" ? item.delta > 0 : item.delta < 0)
    ).length;

    if (report.hasEstimates) {
      return `${adverse > favorable ? "本月公开指标净变偏弱，来月宜复核钱粮、宿卫与官心。" : "本月施政已留下实际变化，可结合月终净变继续判断局势。"}综合奉行度包含局势估计，不能据此认定所有政令已经落实。`;
    }

    if (report.averageExecution >= 82 && favorable >= adverse) {
      return "本月诏令大体得行，中枢与承办官署尚能奉命。可在不骤增曹氏戒心的前提下，继续积累制度性权力。";
    }
    if (report.counts.poor > 0 || report.averageExecution < 55) {
      return "本月已有政令奉行不力。症结多在诏令权威、官署承办或外府牵制，来月宜减少并行事务，优先督办一至两项要政。";
    }
    if (adverse > favorable) {
      return "政令虽有落实，但月终国势净变不利。来月不宜只看诏书是否发出，更应追问钱粮、宿卫与官署能否持续承办。";
    }
    return "本月施政过半落实，尚书台仍能维持运转。对执行不足之事，应复核承办人、钱粮来源与地方阻力。";
  }

  function buildStrategicAdvice(state) {
    const stats = state.stats || {};
    const hidden = state.hidden || {};
    if (Number(stats.caoAlert || 0) >= 82) return "司空府戒备已近极限，宜先降温、清理密线或提高宫廷安全。";
    if (Number(stats.security || 0) <= 28) return "宫禁松动，任何秘密行动都可能反噬，应先处理宿卫与内廷。";
    if (Number(stats.treasury || 0) <= 22) return "国库难以支撑赏赐和赈济，可从常用行动筹措钱粮，并选择节流、催贡或借调。";
    if (Number(stats.authority || 0) <= 28) return "诏令执行力不足，可整顿尚书台、举行朝会或以官爵换取支持。";
    if (Number(hidden.leakRisk || 0) >= 65) return "宫中耳目复杂，密诏与联络行动极易泄露。";
    if (Number(stats.prestige || 0) >= 75 && Number(hidden.externalBalance || 0) >= 45) {
      return "汉室名分与外部制衡已有基础，可尝试争取更高的制度性权力。";
    }
    return "当前尚可周旋。避免单项数值过度攀升，尤其要在皇权与曹氏警戒之间保持余地。";
  }

  function saveMonthlyReport(report, gameCreatedAt) {
    const store = readReportStore();
    if (store.gameCreatedAt && store.gameCreatedAt !== gameCreatedAt) {
      store.reports = [];
    }
    store.gameCreatedAt = gameCreatedAt;

    const duplicateIndex = store.reports.findIndex(
      (item) => item.gameCreatedAt === report.gameCreatedAt && item.turn === report.turn
    );
    if (duplicateIndex >= 0) store.reports.splice(duplicateIndex, 1, report);
    else store.reports.push(report);

    writeReportStore(store);
  }

  function openReportArchive() {
    const state = readGameState();
    const store = readReportStore();
    const reports =
      store.gameCreatedAt && state?.createdAt && store.gameCreatedAt !== state.createdAt
        ? []
        : [...store.reports].reverse();

    if (!reports.length) {
      showAddonToast("尚无已封卷的月度施政覆奏。", "warning");
      return;
    }

    const overlay = createOverlay("历月施政覆奏");
    const body = overlay.querySelector(".monthly-addon-body");
    body.innerHTML = `
      <p class="monthly-addon-note">选择一月，复核当月诏令是否落实、执行程度及月终国势变化。</p>
      <div class="monthly-addon-archive-list">
        ${reports
          .map(
            (report) => `
              <button type="button" data-report-id="${escapeHtml(report.id)}">
                <span>${escapeHtml(report.date)}</span>
                <strong>${executionLabel(report)} · ${escapeHtml(report.overall.label)}</strong>
                <small>政令 ${report.operations.length} 项｜奉行不力 ${report.counts.poor} 项</small>
              </button>
            `
          )
          .join("")}
      </div>
    `;

    body.querySelectorAll("[data-report-id]").forEach((button) => {
      button.addEventListener("click", () => {
        const report = reports.find((item) => item.id === button.dataset.reportId);
        showMonthlyReport(report, { archive: true });
      });
    });
  }

  function showMonthlyReport(report, { archive = false, campaignEnded = false } = {}) {
    if (!report) return;
    const overlay = createOverlay(`${report.date}·尚书台施政覆奏`);
    const body = overlay.querySelector(".monthly-addon-body");
    const footerButton = overlay.querySelector(".monthly-addon-confirm");

    body.innerHTML = buildReportHtml(report);
    footerButton.textContent = archive
      ? "收卷"
      : campaignEnded
        ? "御览完毕，查看终局"
        : "御览完毕，继续理政";
  }

  function createOverlay(title) {
    const previousFocus = closeActiveOverlay ? returnFocus : document.activeElement;
    closeActiveOverlay?.(false);
    returnFocus = previousFocus;

    const overlay = document.createElement("div");
    overlay.className = "monthly-addon-overlay";
    overlay.innerHTML = `
      <section class="monthly-addon-dialog" role="dialog" aria-modal="true" aria-labelledby="monthly-report-title">
        <header>
          <span class="monthly-addon-modal-seal" aria-hidden="true">奏</span>
          <h2 id="monthly-report-title">${escapeHtml(title)}</h2>
          <button class="monthly-addon-close" type="button" aria-label="收起月报">×</button>
        </header>
        <div class="monthly-addon-body"></div>
        <footer>
          <button class="monthly-addon-confirm" type="button">御览完毕</button>
        </footer>
      </section>
    `;
    document.body.appendChild(overlay);
    document.body.classList.add("monthly-report-open");

    const close = (restoreFocus = true) => {
      overlay.remove();
      document.body.classList.remove("monthly-report-open");
      closeActiveOverlay = null;
      if (restoreFocus) {
        const target = previousFocus?.isConnected && !previousFocus.disabled && previousFocus.getClientRects().length
          ? previousFocus : document.querySelector("#event-choices button:not(:disabled)");
        target?.focus();
      }
    };
    closeActiveOverlay = close;
    overlay.querySelector(".monthly-addon-confirm").addEventListener("click", () => close());
    overlay.querySelector(".monthly-addon-close").addEventListener("click", () => close());
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) close();
    });
    overlay.addEventListener("keydown", event => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); close(); return; }
      if (event.key !== "Tab") return;
      const controls = [...overlay.querySelectorAll('button:not(:disabled), summary, [tabindex="0"]')]
        .filter(element => element.getClientRects().length);
      const first = controls[0], last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    });
    overlay.querySelector(".monthly-addon-confirm").focus({ preventScroll: true });

    return overlay;
  }

  function summarizeReport(report) {
    const finite = value => typeof value === "number" && Number.isFinite(value);
    const goals = (report.settlement?.goals || []).map(goal => {
      const known = finite(goal.actual) && (finite(goal.min) || finite(goal.max));
      const passed = known && (!finite(goal.min) || goal.actual >= goal.min) && (!finite(goal.max) || goal.actual <= goal.max);
      const requirement = [finite(goal.min) ? `至少 ${goal.min}` : "", finite(goal.max) ? `不高于 ${goal.max}` : ""].filter(Boolean).join("，");
      return { label: goal.label, actual: goal.actual, known, passed, requirement,
        fellOut: known && goal.predictedPassed === true && !passed };
    });
    const changes = (report.statChanges || []).filter(item => finite(item.delta) && item.delta !== 0)
      .slice().sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 3);
    return { goals, changes, alerts: Array.isArray(report.alerts) ? report.alerts.filter(item => typeof item === "string") : null };
  }

  function buildBriefHtml(report) {
    const brief = summarizeReport(report);
    return `<section class="monthly-report-brief" aria-label="本月重点">
      <h3>本月重点</h3>
      <h4>短局目标 · 本月结算后</h4>
      ${brief.goals.length ? `<ul class="monthly-report-goals">${brief.goals.map(goal => `<li class="${goal.known ? goal.passed ? "safe" : "risk" : ""}"><strong>${escapeHtml(goal.label)} · ${goal.known ? goal.passed ? "已达标" : "未达标" : "未记录"}</strong><span>${goal.known ? `实际 ${goal.actual}，${escapeHtml(goal.requirement)}${goal.fellOut ? "；结算后跌出目标" : ""}` : "旧记录缺少实际值或目标条件，不补造结果。"}</span></li>`).join("")}</ul><p>此处显示本月实际值；奖章以终局核验为准。</p>` : "<p>本月未记录短局目标。</p>"}
      <h4>${report.baselinePartial ? "载入后关键净变" : "全月关键净变"}</h4>
      ${brief.changes.length ? `<ul class="monthly-report-key-changes">${brief.changes.map(item => `<li class="${(item.key === "caoAlert" ? -item.delta : item.delta) > 0 ? "positive" : "negative"}"><span>${escapeHtml(item.name)}</span><strong>${item.before} → ${item.after}（${signed(item.delta)}）</strong></li>`).join("")}</ul><p>按变化幅度列出最多三项；完整国势见下方明细。</p>` : "<p>已记录的公开指标无净变化。</p>"}
      <h4>重要异常</h4>
      ${brief.alerts === null ? "<p>旧月报未单独记录警讯，请展开庶务核对。</p>" : brief.alerts.length ? `<ul class="monthly-report-alerts">${brief.alerts.slice(0, 2).map(alert => `<li>${escapeHtml(alert)}</li>`).join("")}</ul>${brief.alerts.length > 2 ? `<p>共 ${brief.alerts.length} 条警讯，庶务明细保留全部记录。</p>` : ""}` : "<p>本月未记录额外警讯。</p>"}
    </section>`;
  }

  function buildReportHtml(report) {
    const operationsHtml = report.operations.length
      ? report.operations
          .map(
            (operation, index) => `
              <article class="monthly-addon-operation ${operation.statusClass}">
                <div class="monthly-addon-operation-head">
                  <span>${String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <small>${escapeHtml(operation.kind)}</small>
                    <h4>${escapeHtml(operation.title)}</h4>
                  </div>
                  <strong>${operation.executionSource === "recorded" ? "记录" : "估计"} ${operation.execution}%</strong>
                </div>
                <div class="monthly-addon-meter"><i style="width:${clamp(operation.execution, 0, 100)}%"></i></div>
                <p class="monthly-addon-status">${escapeHtml(operation.status)}｜${escapeHtml(operation.assessment)}</p>
                <p><b>覆奏：</b>${escapeHtml(operation.result)}</p>
                ${operation.actionPointsSpent != null ? `<p class="monthly-addon-change"><b>实际投入：</b>御前行动 ${operation.actionPointsSpent} 次</p>` : ""}
                <p class="monthly-addon-change"><b>${operation.actualChanges ? "实际公开变化" : "原始记录变化"}：</b>${escapeHtml(operation.changes)}</p>
              </article>
            `
          )
          .join("")
      : '<p class="monthly-addon-empty">本月除例行奏报外，未另施政令。</p>';

    const statHtml = report.statChanges
      .map((item) => {
        const beneficial = item.key === "caoAlert" ? -item.delta : item.delta;
        const tone = beneficial > 0 ? "positive" : beneficial < 0 ? "negative" : "neutral";
        return `
          <div class="monthly-addon-delta ${tone}">
            <span>${escapeHtml(item.icon)} ${escapeHtml(item.name)}</span>
            <strong>${item.before} → ${item.after}</strong>
            <em>${item.delta === 0 ? "持平" : signed(item.delta)}</em>
          </div>
        `;
      })
      .join("");

    const hiddenHtml = report.hiddenTrends
      .map(
        (item) => `
          <span class="monthly-addon-trend ${item.tone}">
            ${escapeHtml(item.name)}：${escapeHtml(item.direction)}
          </span>
        `
      )
      .join("");

    return `
      <div class="monthly-addon-report">
        <header class="monthly-addon-masthead">
          <span>尚书台谨覆</span>
          <h3>月度施政覆奏</h3>
          <p>先阅本月重点，完整处分与结算记录可展开复查。</p>
        </header>

        ${
          report.baselinePartial
            ? '<p class="monthly-addon-baseline-warning">本月月初快照不完整；“国势变动”从本次载入时起计算，政令执行核验不受影响。</p>'
            : ""
        }

        ${report.settlement?.partial ? '<p class="monthly-addon-baseline-warning">月末对账从固定结算后的续接处开始，请结合完整记录判断。</p>' : ""}
        ${buildBriefHtml(report)}

        <details class="monthly-report-details"><summary>处分与执行评估 · ${report.operations.length} 项</summary>
        <p class="monthly-addon-note">圣旨采用已记录的执行评估；其他政务明确标为估计，估计不代表已经全部落实。</p>
        <div class="monthly-addon-summary">
          <div class="${report.overall.className}">
            <span>综合奉行度</span>
            <strong>${executionLabel(report)}</strong>
            <small>${escapeHtml(report.overall.label)}</small>
          </div>
          <div><span>奉诏较全</span><strong>${report.counts.fulfilled}</strong><small>75%以上</small></div>
          <div><span>部分施行</span><strong>${report.counts.partial}</strong><small>50%—74%</small></div>
          <div><span>奉行不力</span><strong>${report.counts.poor}</strong><small>不足50%</small></div>
        </div>

        <section class="monthly-addon-section">
          <h3>一、诏令与御前处分核验</h3>
          <div class="monthly-addon-operations">${operationsHtml}</div>
        </section>
        </details>

        <details class="monthly-report-details"><summary>完整国势 · ${report.statChanges.length} 项与隐情趋势</summary>
        <section class="monthly-addon-section">
          <h3>二、月终国势变动</h3>
          <div class="monthly-addon-deltas">${statHtml}</div>
          <div class="monthly-addon-trends">${hiddenHtml}</div>
        </section>
        </details>

        <details class="monthly-report-details"><summary>结算对账与庶务 · 展开全部来源</summary>
        <section class="monthly-addon-section">
          ${window.XianMonthlySafety?.renderSettlement?.(report.settlement) || ""}
          <h3>三、月末庶务与异常</h3>
          <ul>${report.monthEndNotes.map((note) => `<li>${escapeHtml(note)}</li>`).join("")}</ul>
          <p class="monthly-addon-dynamics">${escapeHtml(report.monthEndSummary)}</p>
        </section>
        </details>

        <details class="monthly-report-details"><summary>尚书台总评与来月提示</summary>
        <section class="monthly-addon-verdict">
          <span>尚书台总评</span>
          <p>${escapeHtml(report.verdict)}</p>
          <span>来月御前提示</span>
          <p>${escapeHtml(report.advice)}</p>
        </section>
        </details>
      </div>
    `;
  }

  function showAddonToast(message, type = "neutral") {
    const toast = document.createElement("div");
    toast.className = `monthly-addon-toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("show"));
    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 220);
    }, 2600);
  }

  function stateMonthKey(state) {
    return `${state.createdAt || "game"}:${state.turn}:${state.year}:${state.month}`;
  }

  function formatReignDate(year, month) {
    return window.XianEmperorGame.formatReignDate(Number(year), Number(month));
  }

  function executionLabel(report) { return report.averageExecution == null ? "—" : `${report.hasEstimates === false ? "记录" : "估计"} ${report.averageExecution}%`; }

  function toChineseYear(yearNumber) {
    const map = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
    if (yearNumber <= 10) return yearNumber === 10 ? "十" : map[yearNumber] || String(yearNumber);
    if (yearNumber < 20) return `十${map[yearNumber - 10]}`;
    return String(yearNumber);
  }

  function toChineseMonth(month) {
    const names = ["正月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"];
    return names[month - 1] || `${month}月`;
  }

  function signed(value) {
    return value > 0 ? `+${value}` : String(value);
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, Number(value) || 0));
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
  window.XianMonthlyReport = Object.freeze({ buildMonthlyReport, formatReignDate, buildReportHtml, summarizeReport });
})();
