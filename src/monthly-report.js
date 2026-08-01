/*
 * 天子蒙尘：献帝模拟器 - 月度施政覆奏扩展 v0.1.1
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

  let originalEndTurnButton = null;
  let visibleEndTurnButton = null;
  let originalObserver = null;

  document.addEventListener("DOMContentLoaded", initMonthlyReports);

  function initMonthlyReports() {
    injectStyles();
    installArchiveButton();
    wrapEndTurnButton();
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

  function wrapEndTurnButton() {
    originalEndTurnButton = document.getElementById("end-turn-btn");
    if (!originalEndTurnButton || originalEndTurnButton.dataset.monthlyReportWrapped === "true") return;

    const clone = originalEndTurnButton.cloneNode(true);
    clone.dataset.monthlyReportWrapped = "true";
    originalEndTurnButton.replaceWith(clone);
    visibleEndTurnButton = clone;

    clone.addEventListener("click", handleMonthEndClick);

    syncEndTurnButton();
    originalObserver = new MutationObserver(syncEndTurnButton);
    originalObserver.observe(originalEndTurnButton, {
      attributes: true,
      childList: true,
      characterData: true,
      subtree: true,
    });
  }

  function syncEndTurnButton() {
    if (!originalEndTurnButton || !visibleEndTurnButton) return;
    visibleEndTurnButton.disabled = originalEndTurnButton.disabled;
    visibleEndTurnButton.textContent = originalEndTurnButton.textContent;
    visibleEndTurnButton.className = originalEndTurnButton.className;
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

  function handleMonthEndClick() {
    if (!originalEndTurnButton || originalEndTurnButton.disabled) return;

    const before = readGameState();
    if (!before) {
      originalEndTurnButton.click();
      syncEndTurnButton();
      return;
    }

    const beforeKey = stateMonthKey(before);
    const monthStart = getMonthStartSnapshot(before);

    originalEndTurnButton.click();
    syncEndTurnButton();

    const after = readGameState();
    if (!after) return;

    const monthChanged = stateMonthKey(after) !== beforeKey;
    const campaignEnded = Boolean(after.ended);
    if (!monthChanged && !campaignEnded) return;

    const report = buildMonthlyReport(before, after, monthStart);
    saveMonthlyReport(report, before.createdAt || null);

    if (!campaignEnded) writeMonthSnapshot(after);
    showMonthlyReport(report, { campaignEnded });
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
    const dynamics = extractMonthEndReports(after, date);
    const averageExecution = operations.length
      ? Math.round(operations.reduce((sum, item) => sum + item.execution, 0) / operations.length)
      : 100;
    const overall = executionBand(averageExecution);

    const counts = {
      fulfilled: operations.filter((item) => item.execution >= 75).length,
      partial: operations.filter((item) => item.execution >= 50 && item.execution < 75).length,
      poor: operations.filter((item) => item.execution < 50).length,
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
      overall,
      counts,
      statChanges,
      hiddenTrends,
      monthEndNotes: dynamics.notes.length ? dynamics.notes : ["朝廷庶务照常运转，未见另项异常。"],
      monthEndSummary: dynamics.summary || "尚书台未列额外公开数值变化。",
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
      .filter((report) => report.date === date && (report.type === "decision" || report.type === "action"))
      .slice()
      .reverse();

    return selected.map((report, index) => {
      const execution = extractExecutionPercent(report.text) ?? estimateExecution(before, report, index);
      const band = executionBand(execution);
      const [result, changes] = splitReportText(report.text);
      return {
        id: `operation-${before.turn}-${report.timestamp || index}`,
        kind: inferOperationKind(report),
        title: report.title || "未题名政务",
        result,
        changes: changes || "未见即时公开数值变化",
        execution,
        status: band.label,
        statusClass: band.className,
        assessment: buildOperationAssessment(before, report, execution),
      };
    });
  }

  function extractMonthEndReports(after, date) {
    const reports = Array.isArray(after.reports) ? after.reports : [];
    const items = reports
      .filter(
        (report) =>
          report.date === date &&
          (report.title === "月末结算" || report.title === "宫中警讯")
      )
      .slice()
      .reverse();

    const notes = [];
    let summary = "";

    items.forEach((report) => {
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
        .forEach((item) => notes.push(item));
      if (delta) summary = delta.replace(/[。.]$/, "");
    });

    return { notes, summary };
  }

  function splitReportText(text = "") {
    const parts = String(text).split("｜");
    return [parts.shift()?.trim() || "", parts.join("｜").trim()];
  }

  function extractExecutionPercent(text = "") {
    const preferred = String(text).match(/(?:执行评估|落实到地方|执行度)[^0-9]{0,18}(\d{1,3})%/);
    const fallback = String(text).match(/(\d{1,3})%/);
    const value = Number(preferred?.[1] || fallback?.[1]);
    return Number.isFinite(value) ? clamp(Math.round(value), 0, 100) : null;
  }

  function estimateExecution(state, report, index) {
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

    const jitter = (stableHash(`${report.title}|${report.timestamp}|${index}`) % 11) - 5;
    return clamp(Math.round(score + jitter), 28, 96);
  }

  function stableHash(value) {
    let hash = 2166136261;
    const text = String(value);
    for (let i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return Math.abs(hash >>> 0);
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
    if (value >= 90) return { label: "奉诏尽行", className: "excellent" };
    if (value >= 75) return { label: "大部施行", className: "good" };
    if (value >= 60) return { label: "施行过半", className: "balanced" };
    if (value >= 45) return { label: "层层折损", className: "warning" };
    return { label: "奉行不力", className: "critical" };
  }

  function buildVerdict(report) {
    const favorable = report.statChanges.filter(
      (item) => (item.key === "caoAlert" ? item.delta < 0 : item.delta > 0)
    ).length;
    const adverse = report.statChanges.filter(
      (item) => (item.key === "caoAlert" ? item.delta > 0 : item.delta < 0)
    ).length;

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
    if (Number(stats.treasury || 0) <= 22) return "国库难以支撑赏赐和赈济，可寻求贡赋或削减仪典。";
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
                <strong>${report.averageExecution}% · ${escapeHtml(report.overall.label)}</strong>
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
        overlay.remove();
        showMonthlyReport(report, { archive: true });
      });
    });
  }

  function showMonthlyReport(report, { archive = false, campaignEnded = false } = {}) {
    if (!report) return;
    document.querySelector(".monthly-addon-overlay")?.remove();

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
    document.querySelector(".monthly-addon-overlay")?.remove();

    const overlay = document.createElement("div");
    overlay.className = "monthly-addon-overlay";
    overlay.innerHTML = `
      <section class="monthly-addon-dialog" role="dialog" aria-modal="true" aria-label="${escapeHtml(title)}">
        <header>
          <span class="monthly-addon-modal-seal">奏</span>
          <h2>${escapeHtml(title)}</h2>
        </header>
        <div class="monthly-addon-body"></div>
        <footer>
          <button class="monthly-addon-confirm" type="button">御览完毕</button>
        </footer>
      </section>
    `;
    document.body.appendChild(overlay);

    const close = () => overlay.remove();
    overlay.querySelector(".monthly-addon-confirm").addEventListener("click", close);
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) close();
    });

    return overlay;
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
                  <strong>${operation.execution}%</strong>
                </div>
                <div class="monthly-addon-meter"><i style="width:${clamp(operation.execution, 0, 100)}%"></i></div>
                <p class="monthly-addon-status">${escapeHtml(operation.status)}｜${escapeHtml(operation.assessment)}</p>
                <p><b>覆奏：</b>${escapeHtml(operation.result)}</p>
                <p class="monthly-addon-change"><b>公开影响：</b>${escapeHtml(operation.changes)}</p>
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
          <h3>月度施政执行核验</h3>
          <p>所列百分比为朝廷依据奏报、钱粮与承办反馈作出的执行度评估。</p>
        </header>

        ${
          report.baselinePartial
            ? '<p class="monthly-addon-baseline-warning">本月月初快照不完整；“国势变动”从本次载入时起计算，政令执行核验不受影响。</p>'
            : ""
        }

        <div class="monthly-addon-summary">
          <div class="${report.overall.className}">
            <span>综合奉行度</span>
            <strong>${report.averageExecution}%</strong>
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

        <section class="monthly-addon-section">
          <h3>二、月终国势变动</h3>
          <div class="monthly-addon-deltas">${statHtml}</div>
          <div class="monthly-addon-trends">${hiddenHtml}</div>
        </section>

        <section class="monthly-addon-section">
          <h3>三、月末庶务与异常</h3>
          <ul>${report.monthEndNotes.map((note) => `<li>${escapeHtml(note)}</li>`).join("")}</ul>
          <p class="monthly-addon-dynamics">${escapeHtml(report.monthEndSummary)}</p>
        </section>

        <section class="monthly-addon-verdict">
          <span>尚书台总评</span>
          <p>${escapeHtml(report.verdict)}</p>
          <span>来月御前提示</span>
          <p>${escapeHtml(report.advice)}</p>
        </section>
      </div>
    `;
  }

  function injectStyles() {
    if (document.getElementById("monthly-report-addon-styles")) return;
    const style = document.createElement("style");
    style.id = "monthly-report-addon-styles";
    style.textContent = `
      .monthly-addon-overlay{position:fixed;inset:0;z-index:150;display:grid;place-items:center;padding:1rem;background:rgba(5,4,3,.86);backdrop-filter:blur(9px)}
      .monthly-addon-dialog{width:min(940px,100%);max-height:92vh;display:flex;flex-direction:column;border:1px solid rgba(221,187,105,.45);border-radius:14px;background:linear-gradient(145deg,#34241c,#18110e);box-shadow:0 30px 110px rgba(0,0,0,.72);overflow:hidden;color:#eee2cb}
      .monthly-addon-dialog>header{display:flex;align-items:center;gap:.75rem;padding:1rem 1.1rem;border-bottom:1px solid rgba(222,185,105,.25)}
      .monthly-addon-dialog>header h2{margin:0;font:600 1.2rem/1.4 "Noto Serif SC","Songti SC","SimSun",serif}
      .monthly-addon-modal-seal{width:40px;height:40px;display:grid;place-items:center;border:3px double #d4ad5d;border-radius:7px;background:#762b28;color:#f0d58f;font-family:"Noto Serif SC","SimSun",serif}
      .monthly-addon-body{padding:1rem;overflow:auto}
      .monthly-addon-dialog>footer{display:flex;justify-content:flex-end;padding:.85rem 1rem;border-top:1px solid rgba(222,185,105,.25)}
      .monthly-addon-confirm{padding:.72rem 1.1rem;border:1px solid #efd99b;border-radius:8px;background:linear-gradient(#e5c87e,#b98d3e);color:#21140f;font:700 .85rem "Microsoft YaHei",sans-serif;cursor:pointer}
      .monthly-addon-confirm:hover{filter:brightness(1.08)}
      .monthly-addon-report{display:grid;gap:1rem}
      .monthly-addon-masthead{padding:.85rem;border:1px solid rgba(221,187,105,.25);border-radius:9px;background:linear-gradient(90deg,rgba(132,44,37,.14),transparent)}
      .monthly-addon-masthead span{color:#d4ad5d;font-size:.68rem;letter-spacing:.12em}
      .monthly-addon-masthead h3{margin:.16rem 0;color:#eee2cb;font:600 1.22rem/1.4 "Noto Serif SC","SimSun",serif}
      .monthly-addon-masthead p{margin:.1rem 0 0;color:#a99578;font-size:.68rem}
      .monthly-addon-baseline-warning{margin:0;padding:.65rem .75rem;border:1px solid rgba(194,123,61,.45);border-radius:8px;background:rgba(194,123,61,.08);color:#d8b083;font-size:.7rem}
      .monthly-addon-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.55rem}
      .monthly-addon-summary>div{display:grid;gap:.1rem;padding:.7rem;border:1px solid rgba(222,185,105,.25);border-radius:8px;background:rgba(255,255,255,.025)}
      .monthly-addon-summary span,.monthly-addon-summary small{color:#a99578;font-size:.63rem}
      .monthly-addon-summary strong{color:#f0d58f;font:700 1.3rem/1.2 "Noto Serif SC","SimSun",serif}
      .monthly-addon-summary .excellent,.monthly-addon-summary .good{border-color:rgba(113,141,101,.5)}
      .monthly-addon-summary .warning,.monthly-addon-summary .critical{border-color:rgba(185,71,63,.55)}
      .monthly-addon-section{padding:.82rem;border:1px solid rgba(222,185,105,.18);border-radius:9px;background:rgba(0,0,0,.08)}
      .monthly-addon-section>h3{margin:0 0 .65rem;color:#f0d58f;font:600 .94rem/1.4 "Noto Serif SC","SimSun",serif}
      .monthly-addon-operations{display:grid;gap:.65rem}
      .monthly-addon-operation{padding:.75rem;border:1px solid rgba(222,185,105,.25);border-left:4px solid #c6a153;border-radius:8px;background:rgba(255,255,255,.025)}
      .monthly-addon-operation.excellent,.monthly-addon-operation.good{border-left-color:#78986c}
      .monthly-addon-operation.warning{border-left-color:#c27b3d}
      .monthly-addon-operation.critical{border-left-color:#b9473f}
      .monthly-addon-operation-head{display:grid;grid-template-columns:auto 1fr auto;gap:.6rem;align-items:center}
      .monthly-addon-operation-head>span{width:28px;height:28px;display:grid;place-items:center;border:1px solid rgba(222,185,105,.25);border-radius:50%;color:#d4ad5d;font-size:.62rem}
      .monthly-addon-operation-head small,.monthly-addon-operation-head h4{display:block;margin:0}
      .monthly-addon-operation-head small{color:#a99578;font-size:.6rem}
      .monthly-addon-operation-head h4{margin-top:.06rem;color:#eee2cb;font:600 .86rem/1.35 "Noto Serif SC","SimSun",serif}
      .monthly-addon-operation-head>strong{color:#f0d58f}
      .monthly-addon-meter{height:7px;margin:.5rem 0 .32rem;overflow:hidden;border-radius:99px;background:rgba(255,255,255,.08)}
      .monthly-addon-meter i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#8b3a32,#d7b35f)}
      .monthly-addon-operation p{margin:.32rem 0 0;color:#b8a789;font-size:.7rem;line-height:1.65}
      .monthly-addon-operation p b{color:#d7c19a}
      .monthly-addon-status{color:#d4ad5d!important}
      .monthly-addon-change{padding-top:.32rem;border-top:1px dashed rgba(221,187,105,.15)}
      .monthly-addon-deltas{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.45rem}
      .monthly-addon-delta{display:grid;grid-template-columns:1fr auto;gap:.12rem .45rem;padding:.52rem .6rem;border:1px solid rgba(221,187,105,.15);border-radius:7px}
      .monthly-addon-delta span{color:#a99578;font-size:.63rem}
      .monthly-addon-delta strong{font-size:.68rem}
      .monthly-addon-delta em{grid-column:2;font-style:normal;font-size:.66rem}
      .monthly-addon-delta.positive em{color:#9ab58d}.monthly-addon-delta.negative em{color:#d47a6f}.monthly-addon-delta.neutral em{color:#8f816c}
      .monthly-addon-trends{display:flex;flex-wrap:wrap;gap:.4rem;margin-top:.6rem}
      .monthly-addon-trend{padding:.23rem .48rem;border:1px solid rgba(221,187,105,.15);border-radius:999px;color:#a99578;font-size:.61rem}
      .monthly-addon-trend.good{color:#b8c9a8}.monthly-addon-trend.bad{color:#d1a397}
      .monthly-addon-section ul{margin:0;padding-left:1.15rem;color:#b8a789;font-size:.7rem}
      .monthly-addon-section li+li{margin-top:.28rem}
      .monthly-addon-dynamics{margin:.6rem 0 0;padding-top:.5rem;border-top:1px dashed rgba(221,187,105,.15);color:#d4ad5d;font-size:.69rem}
      .monthly-addon-verdict{padding:.85rem;border:1px solid rgba(221,187,105,.32);border-radius:9px;background:linear-gradient(90deg,rgba(132,44,37,.12),transparent)}
      .monthly-addon-verdict span{display:block;color:#d4ad5d;font-size:.64rem;letter-spacing:.1em}
      .monthly-addon-verdict p{margin:.25rem 0 .7rem;color:#d5c3a3;font:.76rem/1.72 "Noto Serif SC","SimSun",serif}
      .monthly-addon-verdict p:last-child{margin-bottom:0}
      .monthly-addon-note{margin:0 0 .75rem;color:#b8a789;font-size:.72rem}
      .monthly-addon-archive-list{display:grid;gap:.5rem}
      .monthly-addon-archive-list button{display:grid;grid-template-columns:1fr auto;gap:.18rem .7rem;padding:.7rem .8rem;border:1px solid rgba(222,185,105,.25);border-radius:8px;background:rgba(255,255,255,.025);color:#eee2cb;text-align:left;cursor:pointer}
      .monthly-addon-archive-list button:hover{border-color:rgba(222,185,105,.55);background:rgba(212,173,93,.07)}
      .monthly-addon-archive-list button span{font-family:"Noto Serif SC","SimSun",serif}
      .monthly-addon-archive-list button strong{color:#f0d58f;font-size:.72rem}
      .monthly-addon-archive-list button small{grid-column:1/-1;color:#a99578;font-size:.62rem}
      .monthly-addon-empty{color:#a99578;font-size:.72rem}
      .monthly-addon-toast{position:fixed;right:1rem;bottom:1rem;z-index:180;max-width:min(420px,calc(100vw - 2rem));padding:.72rem .9rem;border:1px solid rgba(222,185,105,.35);border-radius:8px;background:#2b1e18;color:#eee2cb;box-shadow:0 12px 40px rgba(0,0,0,.45);font-size:.75rem;transform:translateY(12px);opacity:0;transition:.2s}
      .monthly-addon-toast.show{transform:none;opacity:1}.monthly-addon-toast.warning{border-color:#c27b3d}.monthly-addon-toast.error{border-color:#b9473f}
      @media(max-width:720px){.monthly-addon-summary,.monthly-addon-deltas{grid-template-columns:1fr 1fr}.monthly-addon-operation-head{grid-template-columns:auto 1fr}.monthly-addon-operation-head>strong{grid-column:2}.monthly-addon-dialog{max-height:96vh}}
    `;
    document.head.appendChild(style);
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
    return `建安${toChineseYear(Number(year) - 195)}年${toChineseMonth(Number(month))}`;
  }

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
})();
