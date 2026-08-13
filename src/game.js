/*
 * 天子蒙尘：献帝模拟器 v2.5.0
 * 核心逻辑：纯前端、无外部依赖、可直接部署到 GitHub Pages。
 */

(() => {
  "use strict";

  const DATA = window.GAME_DATA;
  const SAVE_KEY = "xian_emperor_simulator_v01";
  const SCENARIO_RECORDS_KEY = "xian_emperor_scenario_records_v070";
  const PORTABLE_STORAGE_KEYS = [
    SAVE_KEY,
    "xian_emperor_monthly_reports_v011",
    "xian_emperor_month_snapshot_v011",
    "xian_emperor_world_v020",
    "xian_emperor_decree_world_v030",
    "xian_emperor_strategy_network_v040",
    "xian_emperor_armies_v050",
    "xian_emperor_court_politics_v060",
    "xian_emperor_audio_v023",
    SCENARIO_RECORDS_KEY,
    "xian_emperor_progression_v100",
    "xian_emperor_campaign_evolution_v150",
    "xian_emperor_command_center_v160",
    "xian_emperor_character_memory_v170",
    "xian_emperor_world_marks_v180",
    "xian_emperor_historian_v190",
    "xian_emperor_dynasty_saga_v200",
    "xian_emperor_monthly_flow_v210",
    "xian_emperor_consequence_echoes_v220",
    "xian_emperor_short_challenges_v230",
    "xian_emperor_weekly_challenge_v240",
    "xian_emperor_final_verdict_v250",
  ];
  const MAX_REPORTS = 10;

  const STARTING_STATS = {
    authority: 34,
    prestige: 72,
    security: 56,
    treasury: 42,
    officials: 46,
    caoAlert: 38,
  };

  const STARTING_HIDDEN = {
    loyalNetwork: 18,
    leakRisk: 12,
    peopleStability: 48,
    externalBalance: 18,
    escapeRoute: 0,
  };

  let state = null;
  let modalConfirmHandler = null;

  const el = {};

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    cacheElements();
    bindGlobalEvents();
    renderStaticContent();
    updateContinueButton();
  }

  function cacheElements() {
    const ids = [
      "start-screen",
      "continue-game-btn",
      "new-game-btn",
      "scenario-select",
      "scenario-preview",
      "scenario-records",
      "difficulty-select",
      "game-shell",
      "scenario-name",
      "date-label",
      "turn-label",
      "ap-label",
      "stats-grid",
      "faction-list",
      "character-list",
      "event-category",
      "event-title",
      "event-text",
      "event-choices",
      "event-resolved",
      "report-list",
      "action-grid",
      "decree-input",
      "issue-decree-btn",
      "end-turn-btn",
      "court-assessment",
      "chronicle-preview",
      "chronicle-title",
      "save-btn",
      "load-btn",
      "export-btn",
      "import-btn",
      "reset-btn",
      "help-btn",
      "chronicle-btn",
      "import-file",
      "danger-banner",
      "toast-container",
      "modal-backdrop",
      "modal-title",
      "modal-body",
      "modal-cancel",
      "modal-confirm",
      "end-screen",
      "ending-title",
      "ending-text",
      "ending-stats",
      "ending-chronicle",
      "ending-restart",
      "ending-export",
    ];

    ids.forEach((id) => {
      el[id] = document.getElementById(id);
    });
  }

  function bindGlobalEvents() {
    el["new-game-btn"].addEventListener("click", () => {
      startNewGame(el["difficulty-select"].value, el["scenario-select"]?.value || "jianan_196");
    });

    el["scenario-select"]?.addEventListener("change", renderScenarioPreview);

    el["continue-game-btn"].addEventListener("click", () => {
      if (!loadGame(true)) {
        showToast("未找到可读取的存档。", "warning");
      }
    });

    el["issue-decree-btn"].addEventListener("click", issueFreeformEdict);
    el["end-turn-btn"].addEventListener("click", endTurn);
    el["save-btn"].addEventListener("click", () => saveGame(false));
    el["load-btn"].addEventListener("click", () => loadGame(false));
    el["export-btn"].addEventListener("click", exportSave);
    el["import-btn"].addEventListener("click", () => el["import-file"].click());
    el["import-file"].addEventListener("change", importSave);
    el["reset-btn"].addEventListener("click", confirmReset);
    el["help-btn"].addEventListener("click", showHelp);
    el["chronicle-btn"].addEventListener("click", showChronicle);

    el["modal-cancel"].addEventListener("click", closeModal);
    el["modal-backdrop"].addEventListener("click", (event) => {
      if (event.target === el["modal-backdrop"]) closeModal();
    });
    el["modal-confirm"].addEventListener("click", () => {
      if (typeof modalConfirmHandler === "function") {
        modalConfirmHandler();
      }
    });

    el["ending-restart"].addEventListener("click", () => {
      el["end-screen"].classList.add("hidden");
      el["start-screen"].classList.remove("hidden");
      el["game-shell"].classList.add("hidden");
      updateContinueButton();
      renderScenarioPreview();
    });
    el["ending-export"].addEventListener("click", exportChronicleText);

    document.addEventListener("keydown", (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
        event.preventDefault();
        if (state && !state.ended) saveGame(false);
      }
      if (event.key === "Escape") closeModal();
    });
  }

  function renderStaticContent() {
    el["scenario-name"].textContent = getScenarioById("jianan_196").name;
    renderScenarioPreview();

    el["faction-list"].innerHTML = DATA.factions
      .map(
        (faction) => `
          <button class="faction-row" type="button" data-faction-id="${faction.id}">
            <span class="faction-dot" style="--faction-color:${faction.color}"></span>
            <span class="faction-copy">
              <strong>${faction.name}</strong>
              <small>${faction.description}</small>
            </span>
          </button>
        `
      )
      .join("");

    el["faction-list"].querySelectorAll("[data-faction-id]").forEach((button) => {
      button.addEventListener("click", () => showFaction(button.dataset.factionId));
    });

    el["action-grid"].innerHTML = DATA.actionCatalog
      .filter((action) => action.id !== "edict")
      .map(
        (action) => `
          <button class="action-button" type="button" data-action-id="${action.id}">
            <span class="action-seal">${action.icon}</span>
            <span>
              <strong>${action.name}</strong>
              <small>${action.description}</small>
            </span>
          </button>
        `
      )
      .join("");

    el["action-grid"].querySelectorAll("[data-action-id]").forEach((button) => {
      button.addEventListener("click", () => openAction(button.dataset.actionId));
    });
  }

  function createInitialState(difficulty, scenarioId = "jianan_196") {
    const scenario = getScenarioById(scenarioId);
    const stats = { ...STARTING_STATS };
    const hidden = { ...STARTING_HIDDEN };

    applyNumericModifiers(stats, scenario.statModifiers);
    applyNumericModifiers(hidden, scenario.hiddenModifiers);

    if (difficulty === "lenient") {
      stats.authority += 5;
      stats.security += 10;
      stats.treasury += 10;
      stats.caoAlert -= 6;
      hidden.leakRisk -= 3;
    } else if (difficulty === "crisis") {
      stats.authority -= 5;
      stats.security -= 6;
      stats.treasury -= 8;
      stats.caoAlert += 10;
      hidden.peopleStability -= 5;
      hidden.leakRisk += 5;
    }

    return {
      version: DATA.version,
      schemaVersion: 100,
      scenarioId: scenario.id,
      difficulty,
      turn: 1,
      year: scenario.startYear,
      month: scenario.startMonth,
      maxTurns: scenario.maxTurns,
      actionPoints: 2,
      stats,
      hidden,
      relations: Object.fromEntries(DATA.characters.map((character) => [character.id, character.relation])),
      usedRandomEvents: [],
      recentEventIds: [],
      currentEventId: null,
      eventResolved: false,
      reports: [],
      chronicle: [],
      totalActions: 0,
      edictsIssued: 0,
      ended: false,
      ending: null,
      challengeRecorded: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  function startNewGame(difficulty = "standard", scenarioId = "jianan_196") {
    const scenario = getScenarioById(scenarioId);
    state = createInitialState(difficulty, scenario.id);
    addChronicle(
      formatReignDate(scenario.startYear, scenario.startMonth),
      scenario.opening
    );
    addReport("御前记事", scenario.intro, "important");
    prepareTurn();
    enterGame();
    saveGame(true);
  }

  function enterGame() {
    el["start-screen"].classList.add("hidden");
    el["end-screen"].classList.add("hidden");
    el["game-shell"].classList.remove("hidden");
    renderAll();
  }

  function prepareTurn() {
    if (!state || state.ended) return;
    state.actionPoints = 2;
    state.eventResolved = false;
    state.currentEventId = selectEventForTurn().id;
    addReport(
      "本月奏报",
      `${formatReignDate(state.year, state.month)}，新的奏报已送入御前。`,
      "neutral"
    );
  }

  function selectEventForTurn() {
    const scenarioId = state.scenarioId || "jianan_196";
    const directedEventId = window.XianShortChallenges?.selectEventId?.({
      turn: state.turn,
      scenarioId,
      createdAt: state.createdAt,
    });
    const directedEvent = [...DATA.fixedEvents, ...DATA.randomEvents, ...Object.values(DATA.scenarioEvents || {})]
      .find(event => event.id === directedEventId);
    if (directedEvent) return directedEvent;
    const scenarioOpening = state.turn === 1 ? DATA.scenarioEvents?.[scenarioId] : null;
    if (scenarioOpening) return scenarioOpening;
    const fixed = scenarioId === "jianan_196" ? DATA.fixedEvents.find((event) => event.fixedTurn === state.turn) : null;
    if (fixed) return fixed;

    const scenarioPools = {
      zhongping_189: ["forged_edict", "old_official_petition", "palace_rumor", "seal_ceremony", "court_banquet", "secret_letter", "imperial_clothing"],
      xingping_195: ["forged_edict", "old_official_petition", "palace_rumor", "seal_ceremony", "border_bandits", "court_banquet", "secret_letter", "imperial_clothing"],
      jianan_200: ["grain_price", "forged_edict", "tax_petition", "scholar_recommendation", "seal_ceremony", "border_bandits", "envoy_jiangdong", "frontier_victory"],
      yankang_220: ["forged_edict", "old_official_petition", "palace_rumor", "seal_ceremony", "court_banquet", "secret_letter", "imperial_clothing"],
    };
    const allowedIds = scenarioPools[scenarioId];
    const availableRandomEvents = allowedIds ? DATA.randomEvents.filter(event => allowedIds.includes(event.id)) : DATA.randomEvents;

    let pool = availableRandomEvents.filter(
      (event) => !state.usedRandomEvents.includes(event.id) && !state.recentEventIds.includes(event.id)
    );

    if (pool.length === 0) {
      pool = availableRandomEvents.filter((event) => !state.recentEventIds.includes(event.id));
    }
    if (pool.length === 0) pool = [...availableRandomEvents];

    const selected = pool[Math.floor(Math.random() * pool.length)];
    state.usedRandomEvents.push(selected.id);
    if (state.usedRandomEvents.length > DATA.randomEvents.length) {
      state.usedRandomEvents = state.usedRandomEvents.slice(-DATA.randomEvents.length);
    }
    return selected;
  }

  function getCurrentEvent() {
    return [...DATA.fixedEvents, ...DATA.randomEvents, ...Object.values(DATA.scenarioEvents || {})].find((event) => event.id === state.currentEventId);
  }

  function renderAll() {
    if (!state) return;
    renderHeader();
    renderStats();
    renderCharacters();
    renderEvent();
    renderReports();
    renderAssessment();
    renderChroniclePreview();
    updateControls();
    renderDangerBanner();
  }

  function renderHeader() {
    const scenario = getActiveScenario();
    el["scenario-name"].textContent = scenario.name;
    if (el["chronicle-title"]) el["chronicle-title"].textContent = `《${scenario.recordTitle}·御前本》`;
    el["date-label"].textContent = `${formatReignDate(state.year, state.month)}`;
    el["turn-label"].textContent = `第 ${state.turn} / ${state.maxTurns} 月`;
    el["ap-label"].textContent = `可行动 ${state.actionPoints}`;
  }

  function renderStats() {
    el["stats-grid"].innerHTML = Object.entries(DATA.statMeta)
      .map(([key, meta]) => {
        const value = state.stats[key];
        const status = getStatStatus(key, value);
        return `
          <article class="stat-card ${status.className}" title="${meta.description}">
            <div class="stat-heading">
              <span class="stat-seal">${meta.icon}</span>
              <span>${meta.name}</span>
              <strong>${Math.round(value)}</strong>
            </div>
            <div class="stat-track" role="progressbar" aria-label="${meta.name}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(
          value
        )}">
              <span style="width:${clamp(value, 0, 100)}%"></span>
            </div>
            <small>${status.label}</small>
          </article>
        `;
      })
      .join("");
  }

  function getStatStatus(key, value) {
    if (key === "caoAlert") {
      if (value >= 85) return { className: "critical", label: "刀锋将至" };
      if (value >= 68) return { className: "warning", label: "严密戒备" };
      if (value >= 35) return { className: "balanced", label: "彼此试探" };
      if (value >= 15) return { className: "good", label: "戒心较低" };
      return { className: "muted", label: "或已不以你为威胁" };
    }

    if (value <= 15) return { className: "critical", label: "濒临崩溃" };
    if (value <= 32) return { className: "warning", label: "明显不足" };
    if (value <= 60) return { className: "balanced", label: "勉强维持" };
    if (value <= 82) return { className: "good", label: "局势有利" };
    return { className: "excellent", label: "根基稳固" };
  }

  function renderCharacters() {
    el["character-list"].innerHTML = DATA.characters
      .filter((character) => character.id !== "liu_xie")
      .map((character) => {
        const faction = DATA.factions.find((item) => item.id === character.faction);
        const relation = state.relations[character.id] ?? 50;
        return `
          <button class="character-card" type="button" data-character-id="${character.id}">
            <span class="portrait-mark" style="--portrait-color:${faction?.color || "#777"}">${character.initials}</span>
            <span class="character-copy">
              <strong>${character.name}</strong>
              <small>${character.title}</small>
              <span class="relation-line"><i style="width:${clamp(relation, 0, 100)}%"></i></span>
            </span>
            <span class="relation-number">${Math.round(relation)}</span>
          </button>
        `;
      })
      .join("");

    el["character-list"].querySelectorAll("[data-character-id]").forEach((button) => {
      button.addEventListener("click", () => showCharacter(button.dataset.characterId));
    });
  }

  function renderEvent() {
    const event = getCurrentEvent();
    if (!event) return;

    el["event-category"].textContent = event.category;
    el["event-title"].textContent = event.title;
    el["event-text"].textContent = event.text;
    el["event-resolved"].classList.toggle("hidden", !state.eventResolved);

    if (state.eventResolved) {
      el["event-choices"].innerHTML = "";
      return;
    }

    el["event-choices"].innerHTML = event.choices
      .map(
        (choice, index) => `
          <button class="choice-button" type="button" data-choice-index="${index}">
            <span class="choice-number">${index + 1}</span>
            <span>
              <strong>${choice.label}</strong>
              <small>${choice.hint}</small>
            </span>
          </button>
        `
      )
      .join("");

    el["event-choices"].querySelectorAll("[data-choice-index]").forEach((button) => {
      button.addEventListener("click", () => resolveEvent(Number(button.dataset.choiceIndex)));
    });
  }

  function resolveEvent(choiceIndex) {
    if (!state || state.eventResolved || state.ended) return;
    const event = getCurrentEvent();
    const choice = event?.choices[choiceIndex];
    if (!choice) return;

    const deltaText = applyPackage(choice);
    document.dispatchEvent(new CustomEvent("xian:decision-resolved", { detail: {
      eventId: event.id,
      eventTitle: event.title,
      choiceIndex,
      choiceLabel: choice.label,
      chronicle: choice.chronicle,
      relations: { ...(choice.relations || {}) },
      effects: { ...(choice.effects || {}) },
      hidden: { ...(choice.hidden || {}) },
      turn: state.turn,
      date: formatReignDate(state.year, state.month),
      createdAt: state.createdAt,
    } }));
    state.eventResolved = true;
    state.recentEventIds.push(event.id);
    state.recentEventIds = state.recentEventIds.slice(-4);
    addChronicle(formatReignDate(state.year, state.month), choice.chronicle);
    addReport(event.title, `${choice.chronicle}${deltaText ? `｜${deltaText}` : ""}`, "decision");
    showToast("本月奏报已裁决。", "success");
    checkImmediateEnding();
    saveGame(true);
    renderAll();
  }

  function applyPackage(pkg) {
    const actualChanges = [];
    if (pkg.effects) {
      Object.entries(pkg.effects).forEach(([key, delta]) => {
        const before = state.stats[key];
        state.stats[key] = clamp(before + delta, 0, 100);
        const actual = Math.round(state.stats[key] - before);
        if (actual !== 0) actualChanges.push(`${DATA.statMeta[key]?.name || key}${formatSigned(actual)}`);
      });
    }

    if (pkg.hidden) {
      Object.entries(pkg.hidden).forEach(([key, delta]) => {
        state.hidden[key] = clamp((state.hidden[key] ?? 0) + delta, 0, 100);
      });
    }

    if (pkg.relations) {
      Object.entries(pkg.relations).forEach(([id, delta]) => {
        state.relations[id] = clamp((state.relations[id] ?? 50) + delta, 0, 100);
      });
    }

    return actualChanges.join("，");
  }

  function renderReports() {
    if (state.reports.length === 0) {
      el["report-list"].innerHTML = '<p class="empty-state">尚无御前记录。</p>';
      return;
    }

    el["report-list"].innerHTML = state.reports
      .slice(0, MAX_REPORTS)
      .map(
        (report) => `
          <article class="report-item ${report.type}">
            <div>
              <strong>${escapeHtml(report.title)}</strong>
              <time>${escapeHtml(report.date)}</time>
            </div>
            <p>${escapeHtml(report.text)}</p>
          </article>
        `
      )
      .join("");
  }

  function renderAssessment() {
    const h = state.hidden;
    const lines = [
      { label: "忠汉网络", value: qualitative(h.loyalNetwork, [20, 45, 70], ["零散", "萌芽", "渐成", "广布"]) },
      { label: "泄密风险", value: qualitative(h.leakRisk, [20, 45, 70], ["低", "可控", "危险", "极高"]) },
      { label: "外部制衡", value: qualitative(h.externalBalance, [20, 45, 70], ["薄弱", "初现", "可用", "强势"]) },
      { label: "民间稳定", value: qualitative(h.peopleStability, [25, 50, 75], ["动荡", "不稳", "尚安", "安定"]) },
      { label: "南方退路", value: qualitative(h.escapeRoute, [15, 35, 60], ["全无", "传闻", "可议", "已备"]) },
    ];

    const guidance = buildStrategicGuidance();
    el["court-assessment"].innerHTML = `
      <div class="assessment-grid">
        ${lines
          .map(
            (item) => `<div><span>${item.label}</span><strong>${item.value}</strong></div>`
          )
          .join("")}
      </div>
      <p class="strategic-guidance">${escapeHtml(guidance)}</p>
    `;
  }

  function buildStrategicGuidance() {
    const s = state.stats;
    if (s.caoAlert >= 82) return "司空府戒备已近极限。宜先降温、清理密线或提高宫廷安全。";
    if (s.security <= 28) return "宫禁松动，任何秘密行动都可能反噬。应先处理宿卫与内廷。";
    if (s.treasury <= 22) return "国库难以支撑赏赐和赈济。可寻求贡赋、削减仪典或与外镇交换资源。";
    if (s.authority <= 28) return "诏令执行力不足。可整顿尚书台、举行朝会或用官爵换取百官支持。";
    if (state.hidden.leakRisk >= 65) return "宫中耳目复杂，密诏与联络行动极易泄露。";
    if (s.prestige >= 75 && state.hidden.externalBalance >= 45)
      return "汉室名分与外部制衡已有基础，可尝试争取更高的制度性权力。";
    return "当前尚可周旋。避免单项数值过度攀升，尤其要在皇权与曹氏警戒之间保持余地。";
  }

  function renderChroniclePreview() {
    const latest = state.chronicle.slice(-4).reverse();
    el["chronicle-preview"].innerHTML = latest
      .map(
        (entry) => `
          <article class="chronicle-entry">
            <time>${escapeHtml(entry.date)}</time>
            <p>${escapeHtml(entry.text)}</p>
          </article>
        `
      )
      .join("");
  }

  function renderDangerBanner() {
    const warnings = [];
    if (state.stats.caoAlert >= 85) warnings.push("曹氏警戒已进入危险区：减少密令与扩权，先安抚外府");
    if (state.stats.security <= 20) warnings.push("宫廷安全濒临崩溃：优先整饬宫门与宿卫");
    if (state.hidden.leakRisk >= 75) warnings.push("密线极可能泄露：暂停联络并清理耳目");
    if (state.stats.treasury <= 12) warnings.push("国库将尽：避免赏赐、赈济与高消耗行动");
    if (state.stats.prestige <= 15) warnings.push("天下将弃汉廷：通过朝仪、赈济或外交恢复威望");

    if (warnings.length === 0) {
      el["danger-banner"].classList.add("hidden");
      return;
    }

    el["danger-banner"].textContent = `警讯：${warnings.join("；")}。`;
    el["danger-banner"].classList.remove("hidden");
  }

  function updateControls() {
    const noActions = state.actionPoints <= 0 || state.ended;
    el["issue-decree-btn"].disabled = noActions || !state.eventResolved;
    el["decree-input"].disabled = noActions || !state.eventResolved;
    el["action-grid"].querySelectorAll("button").forEach((button) => {
      button.disabled = noActions || !state.eventResolved;
    });
    el["end-turn-btn"].disabled = !state.eventResolved || state.ended;
    el["end-turn-btn"].textContent = state.turn >= state.maxTurns ? "完成终局结算" : "结束本月";
  }

  function openAction(actionId) {
    if (!canAct()) return;
    const handlers = {
      audience: openAudienceModal,
      appointment: openAppointmentModal,
      secret: openSecretModal,
      relief: openReliefModal,
      ritual: openRitualModal,
      appease: openAppeaseModal,
      regional: openRegionalModal,
    };
    handlers[actionId]?.();
  }

  function canAct() {
    if (!state || state.ended) return false;
    if (!state.eventResolved) {
      showToast("请先裁决本月奏报。", "warning");
      return false;
    }
    if (state.actionPoints <= 0) {
      showToast("本月行动次数已用尽。", "warning");
      return false;
    }
    return true;
  }

  function openAudienceModal() {
    const people = DATA.characters.filter((character) => character.id !== "liu_xie");
    openModal({
      title: "召见人物",
      body: `
        <p class="modal-note">公开召见更有制度效果；秘密召见更能增进信任，但可能提高警戒。</p>
        <label class="field-label">召见对象</label>
        <select id="modal-character-select" class="modal-select">
          ${people.map((p) => `<option value="${p.id}">${p.name}｜${p.title}</option>`).join("")}
        </select>
        <label class="field-label">召见方式</label>
        <div class="radio-row">
          <label><input type="radio" name="audience-mode" value="public" checked> 公开召见</label>
          <label><input type="radio" name="audience-mode" value="private"> 私下召见</label>
        </div>
      `,
      confirmText: "下令召见",
      onConfirm: () => {
        const targetId = document.getElementById("modal-character-select").value;
        const mode = document.querySelector('input[name="audience-mode"]:checked').value;
        performAudience(targetId, mode);
      },
    });
  }

  function performAudience(targetId, mode) {
    const character = getCharacter(targetId);
    if (!character) return;

    const relationGain = mode === "public" ? 4 : 7;
    const effects = mode === "public" ? { authority: 2, officials: 2 } : { security: -1, caoAlert: 2 };
    const hidden = mode === "private" ? { leakRisk: 2 } : null;

    if (character.faction === "cao_group") {
      effects.caoAlert = (effects.caoAlert || 0) - 3;
      effects.security = (effects.security || 0) + 2;
    } else if (character.faction === "regional_lords") {
      effects.prestige = 2;
      effects.caoAlert = (effects.caoAlert || 0) + 2;
    } else if (character.faction === "han_loyalists" && mode === "private") {
      hidden.loyalNetwork = 3;
    }

    const advice = getCharacterAdvice(character);
    completeAction({
      title: `召见${character.name}`,
      text: `${mode === "public" ? "天子于朝堂召见" : "天子于内廷密召"}${character.name}。${advice}`,
      chronicle: `${mode === "public" ? "公开召见" : "私下召见"}${character.name}，君臣有所商议。`,
      effects,
      hidden,
      relations: { [targetId]: relationGain },
    });
    closeModal();
  }

  function openAppointmentModal() {
    const people = DATA.characters.filter((character) => character.id !== "liu_xie" && character.id !== "cao_cao");
    openModal({
      title: "任免封赏",
      body: `
        <p class="modal-note">官爵是汉廷仍可支配的稀缺政治资源。过度封赏会使官爵贬值。</p>
        <label class="field-label">对象</label>
        <select id="modal-character-select" class="modal-select">
          ${people.map((p) => `<option value="${p.id}">${p.name}｜${p.title}</option>`).join("")}
        </select>
        <label class="field-label">方式</label>
        <select id="modal-appointment-type" class="modal-select">
          <option value="praise">下诏褒奖（稳妥）</option>
          <option value="office">加授官职（强化关系）</option>
          <option value="title">赐爵增秩（影响最大）</option>
        </select>
      `,
      confirmText: "颁下任命",
      onConfirm: () => {
        const targetId = document.getElementById("modal-character-select").value;
        const type = document.getElementById("modal-appointment-type").value;
        performAppointment(targetId, type);
      },
    });
  }

  function performAppointment(targetId, type) {
    const character = getCharacter(targetId);
    if (!character) return;

    const packages = {
      praise: { effects: { authority: 2, prestige: 2, treasury: -1 }, relation: 5, alert: 1 },
      office: { effects: { authority: 4, officials: 2, treasury: -3 }, relation: 9, alert: 4 },
      title: { effects: { prestige: 4, authority: 3, treasury: -5 }, relation: 13, alert: 6 },
    };
    const pkg = packages[type];
    pkg.effects.caoAlert = pkg.alert;

    if (character.faction === "cao_group") pkg.effects.caoAlert -= 6;
    if (character.faction === "regional_lords") {
      pkg.effects.prestige += 1;
      pkg.effects.caoAlert += 2;
    }

    completeAction({
      title: `封赏${character.name}`,
      text: `朝廷对${character.name}${type === "praise" ? "下诏褒奖" : type === "office" ? "加授官职" : "赐爵增秩"}。官爵换来了支持，也引起各方重新估量。`,
      chronicle: `天子${type === "praise" ? "褒奖" : type === "office" ? "加官于" : "赐爵于"}${character.name}。`,
      effects: pkg.effects,
      relations: { [targetId]: pkg.relation },
    });
    closeModal();
  }

  function openSecretModal() {
    const people = DATA.characters.filter((character) =>
      ["empress_fu", "dong_cheng", "yang_biao", "yuan_shao", "liu_biao", "sun_ce"].includes(character.id)
    );
    openModal({
      title: "密令联络",
      body: `
        <p class="modal-note danger-note">密令可以改变格局，也最容易导致宫廷灾难。泄密风险会在每月结算时接受检验。</p>
        <label class="field-label">联络对象</label>
        <select id="modal-character-select" class="modal-select">
          ${people.map((p) => `<option value="${p.id}">${p.name}｜${p.title}</option>`).join("")}
        </select>
        <label class="field-label">密令目标</label>
        <select id="modal-secret-type" class="modal-select">
          <option value="intelligence">建立情报线</option>
          <option value="support">争取关键时刻支持</option>
          <option value="escape">筹备安全退路</option>
        </select>
      `,
      confirmText: "发出密令",
      onConfirm: () => {
        const targetId = document.getElementById("modal-character-select").value;
        const type = document.getElementById("modal-secret-type").value;
        performSecret(targetId, type);
      },
    });
  }

  function performSecret(targetId, type) {
    const character = getCharacter(targetId);
    if (!character) return;

    const base = {
      effects: { security: -3, caoAlert: 7 },
      hidden: { loyalNetwork: 7, leakRisk: 8 },
      relations: { [targetId]: 7 },
    };

    if (type === "intelligence") {
      base.hidden.loyalNetwork += 2;
      base.hidden.leakRisk += 1;
    } else if (type === "support") {
      base.effects.authority = 2;
      base.hidden.loyalNetwork += 4;
      base.hidden.leakRisk += 3;
    } else if (type === "escape") {
      base.hidden.escapeRoute = 9;
      base.hidden.externalBalance = 3;
      base.effects.security -= 1;
    }

    if (character.faction === "regional_lords") {
      base.hidden.externalBalance = (base.hidden.externalBalance || 0) + 6;
      base.effects.caoAlert += 3;
    }

    completeAction({
      title: `密联${character.name}`,
      text: `一封不署名的密令经数重转手送往${character.name}处。宫中没有留下正式文书，但耳目未必全无所觉。`,
      chronicle: `宫中暗中联络${character.name}，所议不载于尚书台。`,
      ...base,
    });
    closeModal();
  }

  function openReliefModal() {
    openModal({
      title: "赈济减赋",
      body: `
        <p class="modal-note">选择赈济规模。执行率会受到当前皇权与百官支持影响。</p>
        <div class="option-cards">
          <label><input type="radio" name="relief-level" value="small" checked><span><strong>局部赈济</strong><small>国库 -4，风险较低</small></span></label>
          <label><input type="radio" name="relief-level" value="medium"><span><strong>州郡减赋</strong><small>国库 -8，威望提升明显</small></span></label>
          <label><input type="radio" name="relief-level" value="large"><span><strong>大开仓廪</strong><small>国库 -13，强力收拢民心</small></span></label>
        </div>
      `,
      confirmText: "施行赈济",
      onConfirm: () => {
        const level = document.querySelector('input[name="relief-level"]:checked').value;
        performRelief(level);
      },
    });
  }

  function performRelief(level) {
    const scale = {
      small: { cost: 4, prestige: 3, support: 1, stability: 4, label: "局部赈济" },
      medium: { cost: 8, prestige: 6, support: 3, stability: 8, label: "州郡减赋" },
      large: { cost: 13, prestige: 10, support: 4, stability: 13, label: "大开仓廪" },
    }[level];

    if (state.stats.treasury < scale.cost) {
      showToast("国库不足，无法按此规模施行。", "error");
      return;
    }

    const efficiency = clamp((state.stats.authority + state.stats.officials) / 160, 0.45, 1.15);
    completeAction({
      title: scale.label,
      text: `朝廷下诏${scale.label}。依当前执行力，约有${Math.round(efficiency * 100)}%的政令能够落实到地方。`,
      chronicle: `天子施行${scale.label}，以安流民与灾户。`,
      effects: {
        treasury: -scale.cost,
        prestige: Math.round(scale.prestige * efficiency),
        officials: scale.support,
        caoAlert: level === "large" ? 3 : 1,
      },
      hidden: { peopleStability: Math.round(scale.stability * efficiency) },
    });
    closeModal();
  }

  function openRitualModal() {
    openModal({
      title: "整饬朝仪",
      body: `
        <p class="modal-note">礼制不会直接产生军队，却能提醒天下：官爵、讨伐与秩序仍需来自汉廷。</p>
        <select id="modal-ritual-type" class="modal-select">
          <option value="court">恢复大朝会</option>
          <option value="temple">祭告宗庙</option>
          <option value="lecture">开设经筵</option>
        </select>
      `,
      confirmText: "举行仪典",
      onConfirm: () => performRitual(document.getElementById("modal-ritual-type").value),
    });
  }

  function performRitual(type) {
    const map = {
      court: {
        label: "恢复大朝会",
        effects: { authority: 5, officials: 4, treasury: -4, caoAlert: 3 },
      },
      temple: {
        label: "祭告宗庙",
        effects: { prestige: 7, authority: 3, treasury: -5, caoAlert: 2 },
      },
      lecture: {
        label: "开设经筵",
        effects: { officials: 6, authority: 3, treasury: -3, caoAlert: 2 },
      },
    };
    const pkg = map[type];
    if (state.stats.treasury < Math.abs(pkg.effects.treasury)) {
      showToast("国库不足以筹办此项仪典。", "error");
      return;
    }
    completeAction({
      title: pkg.label,
      text: `${pkg.label}依汉家旧制举行。礼仪本身不能改变兵权，却让百官与天下再次看见朝廷。`,
      chronicle: `朝廷${pkg.label}，汉家礼制稍复。`,
      effects: pkg.effects,
    });
    closeModal();
  }

  function openAppeaseModal() {
    openModal({
      title: "安抚曹氏",
      body: `
        <p class="modal-note">降低曹氏警戒能换取时间，但让步太多会削弱皇权。</p>
        <div class="option-cards">
          <label><input type="radio" name="appease-type" value="praise" checked><span><strong>公开褒奖</strong><small>小幅降警戒</small></span></label>
          <label><input type="radio" name="appease-type" value="military"><span><strong>暂授军务便宜</strong><small>安全提高，皇权下降</small></span></label>
          <label><input type="radio" name="appease-type" value="banquet"><span><strong>赐宴修好</strong><small>消耗国库，改善关系</small></span></label>
        </div>
      `,
      confirmText: "施行安抚",
      onConfirm: () => performAppease(document.querySelector('input[name="appease-type"]:checked').value),
    });
  }

  function performAppease(type) {
    const map = {
      praise: {
        label: "公开褒奖司空",
        effects: { caoAlert: -7, prestige: 1, authority: -1 },
        relation: 6,
      },
      military: {
        label: "暂授军务便宜",
        effects: { caoAlert: -11, security: 6, authority: -6 },
        relation: 8,
      },
      banquet: {
        label: "赐宴修好",
        effects: { caoAlert: -8, security: 3, treasury: -5, officials: 1 },
        relation: 7,
      },
    };
    const pkg = map[type];
    if (pkg.effects.treasury && state.stats.treasury < Math.abs(pkg.effects.treasury)) {
      showToast("国库不足以筹备赐宴。", "error");
      return;
    }
    completeAction({
      title: pkg.label,
      text: `${pkg.label}。司空府表面接受天子善意，旧臣则重新评估你的真实意图。`,
      chronicle: `天子${pkg.label}，许都君臣关系暂缓。`,
      effects: pkg.effects,
      relations: { cao_cao: pkg.relation, dong_cheng: -2 },
    });
    closeModal();
  }

  function openRegionalModal() {
    const people = DATA.characters.filter((character) => character.faction === "regional_lords");
    openModal({
      title: "结交外镇",
      body: `
        <p class="modal-note">以诏书、官爵或使者建立外部制衡。曹氏通常会关注此类往来。</p>
        <label class="field-label">外镇对象</label>
        <select id="modal-character-select" class="modal-select">
          ${people.map((p) => `<option value="${p.id}">${p.name}｜${p.title}</option>`).join("")}
        </select>
        <label class="field-label">交涉方式</label>
        <select id="modal-regional-type" class="modal-select">
          <option value="edict">颁诏慰劳</option>
          <option value="envoy">派遣密使</option>
          <option value="tribute">以官爵换取贡赋</option>
        </select>
      `,
      confirmText: "派出使者",
      onConfirm: () => {
        const targetId = document.getElementById("modal-character-select").value;
        const type = document.getElementById("modal-regional-type").value;
        performRegional(targetId, type);
      },
    });
  }

  function performRegional(targetId, type) {
    const character = getCharacter(targetId);
    if (!character) return;
    const map = {
      edict: {
        effects: { prestige: 3, authority: 1, caoAlert: 3, treasury: -1 },
        hidden: { externalBalance: 4 },
        relation: 6,
        label: "颁诏慰劳",
      },
      envoy: {
        effects: { security: -2, caoAlert: 7, treasury: -3 },
        hidden: { externalBalance: 8, leakRisk: 5 },
        relation: 9,
        label: "派遣密使",
      },
      tribute: {
        effects: { treasury: 7, authority: -1, prestige: 2, caoAlert: 5 },
        hidden: { externalBalance: 5 },
        relation: 7,
        label: "以官爵换取贡赋",
      },
    };
    const pkg = map[type];
    completeAction({
      title: `${pkg.label}·${character.name}`,
      text: `朝廷向${character.name}${pkg.label}。外镇对汉廷的态度有所变化，司空府也注意到使者往来。`,
      chronicle: `朝廷与${character.name}往来，以求外镇奉汉。`,
      effects: pkg.effects,
      hidden: pkg.hidden,
      relations: { [targetId]: pkg.relation },
    });
    closeModal();
  }

  function issueFreeformEdict() {
    if (!canAct()) return;
    const text = el["decree-input"].value.trim();
    if (text.length < 4) {
      showToast("圣旨内容过短，请写明对象和目的。", "warning");
      return;
    }
    if (text.length > 600) {
      showToast("本版圣旨最多 600 字。", "warning");
      return;
    }

    const interpretation = interpretEdict(text);
    const efficiency = calculateEdictEfficiency(interpretation);
    const result = buildEdictOutcome(text, interpretation, efficiency);
    completeAction(result);
    state.edictsIssued += 1;
    el["decree-input"].value = "";
  }

  function interpretEdict(text) {
    const categories = [];
    const targets = [];
    const patterns = [
      ["relief", /(赈|救灾|灾民|流民|开仓|粮价|饥)/],
      ["tax", /(免税|减税|减赋|免赋|赋役)/],
      ["investigation", /(彻查|查办|御史|贪腐|侵吞|整顿吏治)/],
      ["military", /(练兵|整军|禁军|宿卫|军队|兵权|武备)/],
      ["ritual", /(宗庙|祭祀|朝仪|礼制|经筵|大朝会)/],
      ["secret", /(密诏|密令|秘密|暗中|心腹|衣带|联络)/],
      ["appointment", /(任命|加封|封爵|拜为|授官|罢免|黜)/],
      ["diplomacy", /(遣使|结盟|外援|牵制|贡赋|奉表)/],
      ["appease", /(安抚|嘉奖|褒奖|信任|赐宴|军务便宜)/],
    ];
    patterns.forEach(([category, regex]) => {
      if (regex.test(text)) categories.push(category);
    });

    DATA.characters.forEach((character) => {
      if (text.includes(character.name)) targets.push(character.id);
    });

    if (categories.length === 0) categories.push("generic");
    return { categories, targets };
  }

  function calculateEdictEfficiency(interpretation) {
    let score = 0.34 + state.stats.authority / 220 + state.stats.officials / 360;
    score -= Math.max(0, state.stats.caoAlert - 65) / 400;
    if (interpretation.categories.includes("secret")) score -= state.hidden.leakRisk / 500;
    if (interpretation.categories.includes("relief") || interpretation.categories.includes("tax")) {
      score += state.hidden.peopleStability < 40 ? 0.06 : 0;
    }
    return clamp(score + (Math.random() - 0.5) * 0.12, 0.28, 0.94);
  }

  function buildEdictOutcome(originalText, interpretation, efficiency) {
    const effects = {};
    const hidden = {};
    const relations = {};
    const labels = [];

    const add = (target, key, value) => {
      target[key] = (target[key] || 0) + value;
    };

    interpretation.categories.forEach((category) => {
      switch (category) {
        case "relief":
          labels.push("赈济");
          add(effects, "treasury", -7);
          add(effects, "prestige", Math.round(7 * efficiency));
          add(hidden, "peopleStability", Math.round(8 * efficiency));
          break;
        case "tax":
          labels.push("减赋");
          add(effects, "treasury", -5);
          add(effects, "prestige", Math.round(5 * efficiency));
          add(hidden, "peopleStability", Math.round(6 * efficiency));
          break;
        case "investigation":
          labels.push("察吏");
          add(effects, "authority", Math.round(5 * efficiency));
          add(effects, "officials", efficiency >= 0.6 ? 2 : -2);
          add(effects, "caoAlert", 3);
          break;
        case "military":
          labels.push("整军");
          add(effects, "authority", Math.round(4 * efficiency));
          add(effects, "security", Math.round(4 * efficiency));
          add(effects, "caoAlert", 8);
          add(effects, "treasury", -5);
          break;
        case "ritual":
          labels.push("礼制");
          add(effects, "prestige", Math.round(6 * efficiency));
          add(effects, "authority", Math.round(3 * efficiency));
          add(effects, "treasury", -3);
          break;
        case "secret":
          labels.push("密令");
          add(hidden, "loyalNetwork", Math.round(8 * efficiency));
          add(hidden, "leakRisk", 8);
          add(effects, "caoAlert", 7);
          add(effects, "security", -3);
          break;
        case "appointment":
          labels.push("任官");
          add(effects, "authority", Math.round(4 * efficiency));
          add(effects, "officials", Math.round(4 * efficiency));
          add(effects, "caoAlert", 4);
          add(effects, "treasury", -2);
          break;
        case "diplomacy":
          labels.push("外交");
          add(effects, "prestige", Math.round(4 * efficiency));
          add(effects, "caoAlert", 5);
          add(hidden, "externalBalance", Math.round(7 * efficiency));
          break;
        case "appease":
          labels.push("安抚");
          add(effects, "caoAlert", -6);
          add(effects, "security", 3);
          add(effects, "authority", -2);
          break;
        default:
          labels.push("一般政令");
          add(effects, "authority", efficiency >= 0.62 ? 3 : 1);
          add(effects, "prestige", efficiency >= 0.7 ? 2 : 0);
          add(effects, "officials", efficiency < 0.45 ? -2 : 1);
      }
    });

    interpretation.targets.forEach((targetId) => {
      const character = getCharacter(targetId);
      if (!character) return;
      const positive = !/(罢免|黜|问罪|讨伐|斥责)/.test(originalText);
      relations[targetId] = positive ? Math.round(5 * efficiency) : -Math.round(7 * efficiency);
      if (character.faction === "regional_lords") add(hidden, "externalBalance", positive ? 3 : -2);
      if (targetId === "cao_cao") add(effects, "caoAlert", positive ? -3 : 7);
    });

    if ((effects.treasury || 0) < 0 && state.stats.treasury < Math.abs(effects.treasury)) {
      const shortfall = Math.abs(effects.treasury) - state.stats.treasury;
      effects.treasury = -Math.max(0, state.stats.treasury - 1);
      add(effects, "prestige", -Math.ceil(shortfall / 2));
      add(effects, "officials", -2);
    }

    const status = efficiency >= 0.76 ? "大部执行" : efficiency >= 0.55 ? "部分落实" : "层层折损";
    const targetNames = interpretation.targets.map((id) => getCharacter(id)?.name).filter(Boolean);
    const decreeQuote = originalText.length > 90 ? `${originalText.slice(0, 90)}……` : originalText;

    return {
      title: `圣旨·${labels.join("、")}`,
      text: `“${decreeQuote}” 尚书台将此诏解释为${labels.join("、")}政令，执行评估为${status}（${Math.round(
        efficiency * 100
      )}%）${targetNames.length ? `，涉及${targetNames.join("、")}` : ""}。`,
      chronicle: `天子下诏施行${labels.join("、")}之政，政令${status}。`,
      effects,
      hidden,
      relations,
    };
  }

  function completeAction(pkg) {
    if (!canAct()) return;
    const deltaText = applyPackage(pkg);
    state.actionPoints -= 1;
    state.totalActions += 1;
    addReport(pkg.title, `${pkg.text}${deltaText ? `｜${deltaText}` : ""}`, "action");
    addChronicle(formatReignDate(state.year, state.month), pkg.chronicle);
    showToast(`行动完成，尚可行动 ${state.actionPoints} 次。`, "success");
    checkImmediateEnding();
    saveGame(true);
    renderAll();
  }

  function endTurn() {
    if (!state || state.ended) return;
    if (!state.eventResolved) {
      showToast("请先裁决本月奏报。", "warning");
      return;
    }

    document.dispatchEvent(new CustomEvent("xian:before-month-end", { detail: { turn: state.turn, createdAt: state.createdAt } }));
    if (state.ended) return;
    applyMonthlyDynamics();
    if (checkImmediateEnding()) return;

    if (state.turn >= state.maxTurns) {
      finishCampaign();
      return;
    }

    advanceCalendar();
    state.turn += 1;
    prepareTurn();
    state.updatedAt = new Date().toISOString();
    saveGame(true);
    renderAll();
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function applyMonthlyDynamics() {
    const effects = {};
    const hidden = {};
    const notes = [];

    // 朝廷日常消耗
    effects.treasury = -1;

    // 未使用的行动可转化为谨慎治理收益
    if (state.actionPoints > 0) {
      effects.security = state.actionPoints;
      hidden.leakRisk = -state.actionPoints;
      notes.push(`余下${state.actionPoints}次行动用于谨慎守成`);
    }

    // 国库与官僚连锁
    if (state.stats.treasury <= 18) {
      effects.officials = (effects.officials || 0) - 3;
      effects.prestige = (effects.prestige || 0) - 2;
      notes.push("俸粮与行政经费不足");
    }

    // 民间稳定反馈
    if (state.hidden.peopleStability <= 22) {
      effects.prestige = (effects.prestige || 0) - 4;
      effects.security = (effects.security || 0) - 2;
      notes.push("民间不稳，流言与盗贼滋生");
    } else if (state.hidden.peopleStability >= 72) {
      effects.prestige = (effects.prestige || 0) + 2;
      notes.push("地方相对安定，汉廷声望回升");
    }

    // 皇权过快增长会刺激警戒
    if (state.stats.authority >= 72) {
      effects.caoAlert = (effects.caoAlert || 0) + 2;
      notes.push("皇权扩张引起司空府关注");
    }

    // 警戒自然回落或回归
    if (state.stats.caoAlert > 55) effects.caoAlert = (effects.caoAlert || 0) - 1;
    if (state.stats.caoAlert < 25 && state.stats.authority > 45) effects.caoAlert = (effects.caoAlert || 0) + 1;

    // 泄密检验
    const leakChance = clamp(state.hidden.leakRisk / 150, 0, 0.65);
    if (Math.random() < leakChance) {
      const severity = Math.ceil(state.hidden.leakRisk / 20);
      effects.security = (effects.security || 0) - (2 + severity);
      effects.caoAlert = (effects.caoAlert || 0) + (3 + severity);
      hidden.leakRisk = (hidden.leakRisk || 0) - 8;
      notes.push("一条密线被司空府察觉");
      addReport("宫中警讯", "内外往来出现异常，司空府已更换数名门吏并盘查使者。", "danger");
    } else {
      hidden.leakRisk = (hidden.leakRisk || 0) - 1;
    }

    // 忠汉网络在高风险下会自行损耗
    if (state.hidden.leakRisk >= 70) hidden.loyalNetwork = (hidden.loyalNetwork || 0) - 2;

    const summary = applyPackage({ effects, hidden });
    if (notes.length || summary) {
      addReport(
        "月末结算",
        `${notes.length ? notes.join("；") : "朝廷庶务照常运转"}${summary ? `｜${summary}` : ""}。`,
        "neutral"
      );
    }
  }

  function advanceCalendar() {
    state.month += 1;
    if (state.month > 12) {
      state.month = 1;
      state.year += 1;
    }
  }

  function checkImmediateEnding() {
    if (!state || state.ended) return true;
    let ending = null;

    if (state.stats.security <= 0) {
      ending = {
        title: "深宫幽闭",
        text: "宫禁彻底失守。内廷被重新清洗，可信近侍尽数调离。你仍保留天子名号，却再也无法接触真实政务。",
      };
    } else if (state.stats.prestige <= 0) {
      ending = {
        title: "天下弃汉",
        text: "诏书不再被视为具有约束力的命令，诸侯公开自置官号。汉廷名分已经失去最后的政治价值。",
      };
    } else if (state.stats.caoAlert >= 100) {
      ending = {
        title: state.hidden.loyalNetwork >= 35 ? "密谋败露" : "许都锁宫",
        text:
          state.hidden.loyalNetwork >= 35
            ? "司空府掌握了足以指向宫中的密谋证据。忠臣被捕，宿卫换防，所有诏令从此必须由外府核验。"
            : "司空府认定皇权已构成不可控风险，宫门封锁、使者禁绝，天子的政治行动被彻底停止。",
      };
    } else if (state.stats.treasury <= 0 && state.stats.officials <= 10) {
      ending = {
        title: "朝廷解体",
        text: "国库枯竭、百官离散，尚书台已无法维持最基本的行政。汉廷只剩宫门与空名。",
      };
    }

    if (ending) {
      concludeGame(ending);
      return true;
    }
    return false;
  }

  function finishCampaign() {
    const s = state.stats;
    const h = state.hidden;
    let ending;
    const pathEnding = window.XianImperialProgress?.getPathEnding?.(state);

    if (pathEnding) {
      ending = pathEnding;
    } else if (s.authority >= 70 && h.loyalNetwork >= 58 && s.security >= 34 && s.caoAlert < 94) {
      ending = {
        title: "再振汉纲",
        text: "你没有凭空得到百万雄兵，而是重新建立了可执行的诏令、可信的中枢与互相呼应的忠臣网络。曹氏仍强，但汉廷已不再只是印玺与名号。新的较量才刚开始。",
      };
    } else if (h.externalBalance >= 62 && s.prestige >= 66) {
      ending = {
        title: "诸侯共奉",
        text: "河北、荆州与江东都承认汉廷仍是天下秩序的中心。没有一方能独占朝廷，你以名分和制衡换得了脆弱却真实的政治空间。",
      };
    } else if (h.escapeRoute >= 42 && s.security <= 38) {
      ending = {
        title: "衣冠南渡",
        text: "许都已不可久留。你借宗亲与外镇安排，在宫禁合围前离开中原，于南方重建流亡朝廷。汉祚未绝，但从此必须在陌生土地上重新开始。",
      };
    } else if (s.officials >= 68 && s.prestige >= 70 && h.peopleStability >= 62) {
      ending = {
        title: "帝国调停者",
        text: "你未能收回全部军政权，却使尚书台恢复运转，减轻赋役，并让诸侯愿意接受朝廷调停。百姓记住的不是一场豪赌，而是乱世中短暂恢复的秩序。",
      };
    } else if (s.caoAlert >= 80 || s.authority <= 22) {
      ending = {
        title: "有名无实",
        text: "汉室名义仍被保留，因为它对强者有用。你活了下来，宗庙也尚在，但朝廷每一道命令都必须先符合司空府的意志。",
      };
    } else if (s.security >= 62 && s.caoAlert <= 58) {
      ending = {
        title: "许都守成",
        text: "你以克制换取时间，保住宫廷、百官与宗庙。皇权恢复有限，却避免了最坏的清洗。乱世尚长，耐心本身也是一种政治。",
      };
    } else {
      ending = {
        title: "风雨续祚",
        text: "二十四个月里，你既未摆脱控制，也没有让汉廷坠入深渊。每一道诏书、每一次召见都只换来有限的空间，但大汉的灯火仍未熄灭。",
      };
    }

    concludeGame(ending);
  }

  function concludeGame(ending) {
    state.ended = true;
    state.ending = ending;
    state.updatedAt = new Date().toISOString();
    addChronicle(formatReignDate(state.year, state.month), `终局：${ending.title}。${ending.text}`);
    recordScenarioResult();
    document.dispatchEvent(new CustomEvent("xian:campaign-concluded", { detail: {
      state: JSON.parse(JSON.stringify(state)),
      scenario: JSON.parse(JSON.stringify(getActiveScenario())),
      score: calculateScenarioScore(state),
      challenge: calculateScenarioChallenge(getActiveScenario(), state),
    } }));
    saveGame(true);
    displayEnding(ending);
  }

  function displayEnding(ending) {
    el["ending-title"].textContent = ending.title;
    el["ending-text"].textContent = ending.text;
    const challenge = calculateScenarioChallenge(getActiveScenario(), state);
    el["ending-stats"].innerHTML = Object.entries(DATA.statMeta)
      .map(([key, meta]) => `<div><span>${meta.name}</span><strong>${Math.round(state.stats[key])}</strong></div>`)
      .join("") + `<div class="scenario-result ${challenge.completed ? "complete" : "incomplete"}"><span>${escapeHtml(challenge.title)}</span><strong>${challenge.completed ? "挑战完成" : "尚未完成"}</strong></div>`;
    el["ending-chronicle"].innerHTML = state.chronicle
      .slice(-8)
      .map((entry) => `<p><strong>${escapeHtml(entry.date)}</strong>　${escapeHtml(entry.text)}</p>`)
      .join("");
    el["end-screen"].classList.remove("hidden");
  }

  function showCharacter(characterId) {
    if (!state) return;
    const character = getCharacter(characterId);
    if (!character) return;
    const faction = DATA.factions.find((item) => item.id === character.faction);
    const relation = state.relations[characterId] ?? 50;
    const attitude = relation >= 75 ? "信任" : relation >= 55 ? "愿意合作" : relation >= 35 ? "谨慎观望" : relation >= 18 ? "疏远" : "敌视";

    openModal({
      title: `${character.name}｜${character.title}`,
      body: `
        <div class="character-detail">
          <div class="detail-portrait" style="--portrait-color:${faction?.color || "#777"}">${character.initials}</div>
          <div>
            <p>${character.profile}</p>
            <p><strong>所属：</strong>${faction?.name || "未知"}</p>
            <p><strong>公开性格：</strong>${character.publicTraits.join("、")}</p>
            <p><strong>对天子态度：</strong>${attitude}（${Math.round(relation)}）</p>
            <p><strong>政治影响：</strong>${character.influence}</p>
          </div>
        </div>
        <blockquote>${escapeHtml(getCharacterAdvice(character))}</blockquote>
      `,
      confirmText: "关闭",
      cancelHidden: true,
      onConfirm: closeModal,
    });
  }

  function getCharacterAdvice(character) {
    const s = state.stats;
    const h = state.hidden;
    const relation = state.relations[character.id] ?? 50;
    const cautious = relation < 45 ? "其言辞颇为谨慎" : "其态度相对坦诚";

    const adviceMap = {
      empress_fu:
        s.security < 40
          ? "皇后低声劝道：宫门与内侍尚未安定，陛下不可只顾外朝。"
          : "皇后认为宫中尚可维持，但任何密使都应减少经手之人。",
      dong_cheng:
        h.loyalNetwork < 45
          ? "董承称愿联络旧部，但眼下能真正冒死响应者仍然不多。"
          : "董承认为忠汉之士已可彼此呼应，只欠明确时机。",
      yang_biao:
        s.authority < 45
          ? "杨彪主张先正诏令与朝仪：名分若不能落实为制度，密谋也难长久。"
          : "杨彪认为朝廷制度稍有恢复，下一步应谨慎收回任官与考功之权。",
      xun_yu:
        s.officials < 50
          ? "荀彧指出，尚书台缺员而法令反复，任何宏图都必须先有能执行的官吏。"
          : "荀彧认为百官已可用，关键是让政令稳定，不应因一时猜疑反复更改。",
      cao_cao:
        s.caoAlert > 70
          ? "曹操笑言天下未定，宫中却多流言。话虽温和，警告之意甚明。"
          : "曹操表示愿奉天子号令平定四方，但军务必须迅速，不可受繁文牵制。",
      yuan_shao:
        h.externalBalance < 45
          ? "袁绍的使者重申四世三公之望，却没有给出明确出兵或输粮承诺。"
          : "河北愿继续奉汉，但要求朝廷在官爵与讨伐名义上给予更多回报。",
      yuan_shu:
        "袁术的回信辞藻华丽，却处处试探朝廷还能给予何种实际利益。",
      liu_biao:
        h.escapeRoute < 30
          ? "刘表愿修宗亲之礼，但对接纳朝廷南迁仍语焉不详。"
          : "荆州方面已开始考虑接驾与安置百官的具体可能。",
      sun_ce:
        "孙策重视朝廷承认，愿以江东战功换取官爵，但不会接受过多束缚。",
    };

    return `${adviceMap[character.id] || "此人暂未表露明确立场。"}${cautious}。`;
  }

  function showFaction(factionId) {
    const faction = DATA.factions.find((item) => item.id === factionId);
    if (!faction) return;
    const members = DATA.characters.filter((character) => character.faction === factionId);
    openModal({
      title: faction.name,
      body: `
        <p>${faction.description}</p>
        <h4 class="modal-subtitle">已知相关人物</h4>
        <div class="compact-list">
          ${members.length ? members.map((m) => `<span>${m.name}｜${m.title}</span>`).join("") : "<span>暂无核心人物资料</span>"}
        </div>
      `,
      confirmText: "关闭",
      cancelHidden: true,
      onConfirm: closeModal,
    });
  }

  function showChronicle() {
    if (!state) return;
    openModal({
      title: "《建安实录·御前本》",
      body: `
        <div class="full-chronicle">
          ${state.chronicle
            .map(
              (entry, index) => `
                <article>
                  <span>${String(index + 1).padStart(2, "0")}</span>
                  <div><time>${escapeHtml(entry.date)}</time><p>${escapeHtml(entry.text)}</p></div>
                </article>
              `
            )
            .join("")}
        </div>
      `,
      confirmText: "关闭",
      cancelHidden: true,
      wide: true,
      onConfirm: closeModal,
    });
  }

  function showHelp() {
    openModal({
      title: "御前手册",
      body: `
        <div class="help-copy">
          <h4>每月流程</h4>
          <ol>
            <li>先裁决中央奏报。</li>
            <li>使用最多两次行动：召见、任官、密令、赈济、礼制、安抚或外交。</li>
            <li>也可在右侧自由拟写圣旨。本版使用本地关键词规则解析，不调用网络 AI。</li>
            <li>结束本月后进行国库、民心、警戒与泄密结算。</li>
          </ol>
          <h4>关键原则</h4>
          <p>皇权、威望、安全、国库与百官支持通常越高越好；曹氏警戒过高会直接导致终局。密令虽强，却会累积隐藏的泄密风险。</p>
          <h4>存档</h4>
          <p>游戏会在浏览器 localStorage 中自动保存。可使用“导出”把存档下载为 JSON 文件，换电脑时再导入。</p>
          <h4>快捷键</h4>
          <p><kbd>Ctrl</kbd> + <kbd>S</kbd>：手动保存；<kbd>Esc</kbd>：关闭弹窗。</p>
        </div>
      `,
      confirmText: "明白",
      cancelHidden: true,
      onConfirm: closeModal,
    });
  }

  function openModal({ title, body, confirmText = "确定", onConfirm, cancelHidden = false, wide = false }) {
    el["modal-title"].textContent = title;
    el["modal-body"].innerHTML = body;
    el["modal-confirm"].textContent = confirmText;
    el["modal-cancel"].classList.toggle("hidden", cancelHidden);
    el["modal-backdrop"].classList.toggle("wide", Boolean(wide));
    modalConfirmHandler = onConfirm;
    el["modal-backdrop"].classList.remove("hidden");
    setTimeout(() => el["modal-confirm"].focus(), 0);
  }

  function closeModal() {
    if (!el["modal-backdrop"] || el["modal-backdrop"].classList.contains("hidden")) return;
    el["modal-backdrop"].classList.add("hidden");
    el["modal-backdrop"].classList.remove("wide");
    modalConfirmHandler = null;
  }

  function addReport(title, text, type = "neutral") {
    state.reports.unshift({
      title,
      text,
      type,
      date: formatReignDate(state.year, state.month),
      timestamp: Date.now(),
    });
    state.reports = state.reports.slice(0, 30);
  }

  function addChronicle(date, text) {
    state.chronicle.push({ date, text });
  }

  function saveGame(silent = false) {
    if (!state) return;
    state.updatedAt = new Date().toISOString();
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(state));
      document.dispatchEvent(new CustomEvent("xian:core-saved", { detail: { turn: state.turn, createdAt: state.createdAt } }));
      updateContinueButton();
      if (!silent) showToast("御前存档已保存到本浏览器。", "success");
    } catch (error) {
      console.error(error);
      showToast("保存失败：浏览器可能禁止本地存储。", "error");
    }
  }

  function loadGame(silent = false) {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return false;
      const loaded = JSON.parse(raw);
      if (!validateSave(loaded)) throw new Error("Invalid save");
      state = migrateSave(loaded);
      enterGame();
      if (state.ended && state.ending) displayEnding(state.ending);
      if (!silent) showToast("存档读取成功。", "success");
      return true;
    } catch (error) {
      console.error(error);
      showToast("存档损坏或版本不兼容。", "error");
      return false;
    }
  }

  function validateSave(save) {
    return Boolean(save && typeof save === "object" && save.stats && save.hidden && Array.isArray(save.chronicle));
  }

  function migrateSave(save) {
    const migrated = {
      ...createInitialState(save.difficulty || "standard", save.scenarioId || "jianan_196"),
      ...save,
      version: DATA.version,
      schemaVersion: 100,
      scenarioId: save.scenarioId || "jianan_196",
      stats: { ...STARTING_STATS, ...(save.stats || {}) },
      hidden: { ...STARTING_HIDDEN, ...(save.hidden || {}) },
      relations: {
        ...Object.fromEntries(DATA.characters.map((character) => [character.id, character.relation])),
        ...(save.relations || {}),
      },
    };
    if (!migrated.currentEventId && !migrated.ended) {
      const fixed = DATA.fixedEvents.find((event) => event.fixedTurn === migrated.turn);
      migrated.currentEventId = (fixed || DATA.randomEvents[0]).id;
    }
    return migrated;
  }

  function exportSave() {
    if (!state) return;
    saveGame(true);
    const stores = {};
    PORTABLE_STORAGE_KEYS.forEach(key => {
      try {
        const raw = localStorage.getItem(key);
        if (raw !== null) stores[key] = JSON.parse(raw);
      } catch (_) {}
    });
    const bundle = {
      format: "xian-emperor-full-save",
      version: DATA.version,
      exportedAt: new Date().toISOString(),
      stores,
    };
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json;charset=utf-8" });
    downloadBlob(blob, `xian-emperor-v${DATA.version}-turn-${state.turn}.json`);
    showToast("完整存档包已导出，包含军团、政议、方略与收藏。", "success");
  }

  function importSave(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const imported = JSON.parse(String(reader.result));
        const isBundle = imported?.format === "xian-emperor-full-save" && imported.stores && typeof imported.stores === "object";
        const importedCore = isBundle ? imported.stores[SAVE_KEY] : imported;
        if (!validateSave(importedCore)) throw new Error("Invalid save");
        if (isBundle) {
          window.__xianFullSaveImporting = true;
          PORTABLE_STORAGE_KEYS.filter(key => key !== SAVE_KEY).forEach(key => {
            if (Object.prototype.hasOwnProperty.call(imported.stores, key)) {
              localStorage.setItem(key, JSON.stringify(imported.stores[key]));
            }
          });
        }
        state = migrateSave(importedCore);
        if (isBundle) {
          localStorage.setItem(SAVE_KEY, JSON.stringify(state));
          showToast("完整存档包已导入，正在重新载入全部系统。", "success");
          setTimeout(() => window.location.reload(), 350);
          return;
        }
        saveGame(true);
        enterGame();
        if (state.ended && state.ending) displayEnding(state.ending);
        showToast("旧版核心存档已迁移并导入。", "success");
      } catch (error) {
        window.__xianFullSaveImporting = false;
        console.error(error);
        showToast("导入失败：文件不是有效存档。", "error");
      }
    };
    reader.readAsText(file, "utf-8");
  }

  function exportChronicleText() {
    if (!state) return;
    const scenario = getActiveScenario();
    const lines = [
      DATA.title,
      `剧本：${scenario.name}`,
      `结局：${state.ending?.title || "未结算"}`,
      "",
      ...state.chronicle.map((entry) => `${entry.date}　${entry.text}`),
      "",
      "终局数值：",
      ...Object.entries(DATA.statMeta).map(([key, meta]) => `${meta.name}：${Math.round(state.stats[key])}`),
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    downloadBlob(blob, `${scenario.id}-chronicle.txt`);
  }

  function confirmReset() {
    openModal({
      title: "重开本局",
      body: "<p>这会删除当前浏览器中的自动存档，并返回开局界面。已导出的 JSON 文件不会受影响。</p>",
      confirmText: "确认删除",
      onConfirm: () => {
        localStorage.removeItem(SAVE_KEY);
        state = null;
        closeModal();
        el["game-shell"].classList.add("hidden");
        el["end-screen"].classList.add("hidden");
        el["start-screen"].classList.remove("hidden");
        updateContinueButton();
        renderScenarioPreview();
        showToast("旧存档已删除。", "success");
      },
    });
  }

  function updateContinueButton() {
    const hasSave = Boolean(localStorage.getItem(SAVE_KEY));
    el["continue-game-btn"].disabled = !hasSave;
    el["continue-game-btn"].textContent = hasSave ? "继续御览" : "暂无存档";
  }

  function showToast(message, type = "neutral") {
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;
    el["toast-container"].appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("show"));
    setTimeout(() => {
      toast.classList.remove("show");
      setTimeout(() => toast.remove(), 250);
    }, 2600);
  }

  function getCharacter(id) {
    return DATA.characters.find((character) => character.id === id);
  }

  function qualitative(value, thresholds, labels) {
    if (value < thresholds[0]) return labels[0];
    if (value < thresholds[1]) return labels[1];
    if (value < thresholds[2]) return labels[2];
    return labels[3];
  }

  function getScenarioById(id) {
    return (DATA.scenarios || []).find((scenario) => scenario.id === id) || DATA.scenario || {};
  }

  function getActiveScenario() {
    return getScenarioById(state?.scenarioId || "jianan_196");
  }

  function applyNumericModifiers(target, modifiers = {}) {
    Object.entries(modifiers || {}).forEach(([key, value]) => {
      target[key] = clamp(Number(target[key] || 0) + Number(value || 0), 0, 100);
    });
  }

  function renderScenarioPreview() {
    if (!el["scenario-preview"] || !el["scenario-records"]) return;
    const scenario = getScenarioById(el["scenario-select"]?.value || "jianan_196");
    const records = loadScenarioRecords();
    const record = records[scenario.id];
    el["scenario-preview"].innerHTML = `
      <div><span>当前剧本 · ${escapeHtml(scenario.difficulty)}</span><strong>${escapeHtml(scenario.name)}</strong></div>
      <div><p>${escapeHtml(scenario.summary)}</p><div class="scenario-preview-meta"><span>${scenario.maxTurns} 个月</span><span>${scenario.startYear} 年开局</span><span>${record?.attempts || 0} 次记录</span></div></div>
      <div class="scenario-challenge"><b>历史挑战｜${escapeHtml(scenario.challenge?.title || "存续")}</b>　${escapeHtml(scenario.challenge?.description || "坚持至剧本结束。")}</div>`;
    el["scenario-records"].innerHTML = (DATA.scenarios || []).map(item => {
      const itemRecord = records[item.id];
      const classes = ["scenario-record-badge", itemRecord?.completed ? "complete" : "", item.id === scenario.id ? "current" : ""].filter(Boolean).join(" ");
      return `<span class="${classes}">${item.startYear} ${itemRecord?.completed ? "✓" : "·"} ${itemRecord?.bestScore ? `最高 ${itemRecord.bestScore}` : "未完成"}</span>`;
    }).join("");
  }

  function loadScenarioRecords() {
    try {
      const records = JSON.parse(localStorage.getItem(SCENARIO_RECORDS_KEY) || "{}");
      return records && typeof records === "object" ? records : {};
    } catch (_) {
      return {};
    }
  }

  function calculateScenarioChallenge(scenario, gameState) {
    const challenge = scenario?.challenge || {};
    const survived = Boolean(gameState && gameState.turn >= gameState.maxTurns);
    const statMin = Object.entries(challenge.statMin || {}).every(([key, value]) => Number(gameState?.stats?.[key] || 0) >= value);
    const statMax = Object.entries(challenge.statMax || {}).every(([key, value]) => Number(gameState?.stats?.[key] || 0) <= value);
    const hiddenMin = Object.entries(challenge.hiddenMin || {}).every(([key, value]) => Number(gameState?.hidden?.[key] || 0) >= value);
    return { title: challenge.title || "剧本挑战", completed: survived && statMin && statMax && hiddenMin, survived };
  }

  function calculateScenarioScore(gameState) {
    const positive = ["authority", "prestige", "security", "treasury", "officials"].reduce((sum, key) => sum + Number(gameState?.stats?.[key] || 0), 0);
    const alertControl = Math.max(0, 100 - Number(gameState?.stats?.caoAlert || 0));
    const progress = Math.min(1, Number(gameState?.turn || 0) / Math.max(1, Number(gameState?.maxTurns || 1)));
    return Math.round((positive + alertControl) * progress);
  }

  function recordScenarioResult() {
    if (!state || state.challengeRecorded) return null;
    const scenario = getActiveScenario();
    const challenge = calculateScenarioChallenge(scenario, state);
    const records = loadScenarioRecords();
    const previous = records[scenario.id] || { attempts: 0, completed: false, bestScore: 0 };
    records[scenario.id] = {
      attempts: previous.attempts + 1,
      completed: Boolean(previous.completed || challenge.completed),
      bestScore: Math.max(Number(previous.bestScore || 0), calculateScenarioScore(state)),
      lastEnding: state.ending?.title || "未结算",
      updatedAt: new Date().toISOString(),
    };
    try { localStorage.setItem(SCENARIO_RECORDS_KEY, JSON.stringify(records)); } catch (error) { console.warn("剧本史册保存失败", error); }
    state.challengeRecorded = true;
    return records[scenario.id];
  }

  function formatReignDate(year, month) {
    let era;
    let eraYear;
    if (year === 189) { era = "中平"; eraYear = 6; }
    else if (year >= 190 && year <= 193) { era = "初平"; eraYear = year - 189; }
    else if (year >= 194 && year <= 195) { era = "兴平"; eraYear = year - 193; }
    else if (year >= 196 && year <= 219) { era = "建安"; eraYear = year - 195; }
    else if (year === 220) { era = "延康"; eraYear = 1; }
    else return `公元${year}年${toChineseMonth(month)}`;
    return `${era}${eraYear === 1 ? "元" : toChineseYear(eraYear)}年${toChineseMonth(month)}`;
  }

  function toChineseYear(yearNumber) {
    const map = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
    if (yearNumber <= 10) return yearNumber === 10 ? "十" : map[yearNumber];
    if (yearNumber < 20) return `十${map[yearNumber - 10]}`;
    return String(yearNumber);
  }

  function toChineseMonth(month) {
    const names = ["正月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"];
    return names[month - 1] || `${month}月`;
  }

  function formatSigned(value) {
    return value > 0 ? `+${value}` : String(value);
  }

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, Number(value) || 0));
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function applyExternalPackage(pkg = {}) {
    if (!state || state.ended) return { applied: false, changes: "" };
    const changes = applyPackage(pkg);
    if (pkg.report?.title && pkg.report?.text) {
      addReport(pkg.report.title, `${pkg.report.text}${changes ? `｜${changes}` : ""}`, pkg.report.type || "decision");
    }
    if (pkg.chronicle) addChronicle(formatReignDate(state.year, state.month), pkg.chronicle);
    checkImmediateEnding();
    saveGame(true);
    renderAll();
    return { applied: true, changes };
  }

  function performExternalAction(pkg = {}) {
    if (!canAct()) return false;
    completeAction(pkg);
    return true;
  }

  function concludeExternalEnding(ending = {}) {
    if (!state || state.ended || !ending.title || !ending.text) return false;
    concludeGame({ title: String(ending.title), text: String(ending.text) });
    return true;
  }

  window.XianEmperorGame = Object.freeze({
    applyExternalPackage,
    performExternalAction,
    concludeExternalEnding,
    endTurn,
    startNewGame,
    getCurrentEvent: () => {
      const event = getCurrentEvent();
      return event ? JSON.parse(JSON.stringify(event)) : null;
    },
    getScenarioById: (id) => JSON.parse(JSON.stringify(getScenarioById(id))),
    calculateScenarioChallenge: (scenario, gameState) => calculateScenarioChallenge(scenario, gameState),
    getState: () => state ? JSON.parse(JSON.stringify(state)) : null,
  });
})();
