/*
 * 天子蒙尘：献帝模拟器 v0.7.0
 * 全国局势、诸侯动态、人物四维关系、历史时间线与史料引用模块。
 *
 * 本模块采用独立 localStorage，不改写核心存档结构，可兼容 v0.1.x 存档。
 */
(() => {
  "use strict";

  const DATA = window.XIAN_WORLD_DATA;
  if (!DATA) {
    console.error("XIAN_WORLD_DATA 未加载，天下模块无法启动。");
    return;
  }

  const GAME_SAVE_KEY = "xian_emperor_simulator_v01";
  const WORLD_SAVE_KEY = "xian_emperor_world_v020";
  const MAX_WORLD_LOG = 72;
  const MAX_MONTHLY_HISTORY = 36;

  let worldState = null;
  let lastCoreState = null;
  let overlayState = { tab: "world", sourceFilter: null, characterId: null };
  let syncQueued = false;

  installStorageWatcher();
  document.addEventListener("DOMContentLoaded", init);

  function init() {
    installNavButtons();
    installWorldBrief();
    installOverlay();
    installEventSourceButton();
    installUiObservers();
    installDelegatedEvents();
    syncFromCoreStorage("init");
  }

  function installStorageWatcher() {
    if (window.__xianWorldStorageWatcherInstalled) return;
    window.__xianWorldStorageWatcherInstalled = true;

    const nativeSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function patchedSetItem(key, value) {
      nativeSetItem.apply(this, arguments);
      if (!window.__xianFullSaveImporting && this === localStorage && key === GAME_SAVE_KEY) {
        queueSync(value, "core-save");
      }
    };
  }

  function queueSync(raw, reason) {
    if (syncQueued) return;
    syncQueued = true;
    setTimeout(() => {
      syncQueued = false;
      syncFromCoreRaw(raw || localStorage.getItem(GAME_SAVE_KEY), reason);
    }, 0);
  }

  function syncFromCoreStorage(reason) {
    syncFromCoreRaw(localStorage.getItem(GAME_SAVE_KEY), reason);
  }

  function syncFromCoreRaw(raw, reason) {
    const core = safeParse(raw);
    if (!isValidCoreState(core)) {
      lastCoreState = null;
      worldState = loadWorldState();
      refreshUi();
      return;
    }

    lastCoreState = core;
    worldState = ensureWorldState(core);
    processNewCoreReports(core);

    const gap = Math.max(0, Math.min(24, core.turn - worldState.lastProcessedTurn));
    for (let index = 0; index < gap; index += 1) {
      const completedTurn = worldState.lastProcessedTurn;
      processWorldMonth(core, completedTurn);
      worldState.lastProcessedTurn += 1;
    }

    if (core.ended && !worldState.finalPulseRecorded) {
      worldState.finalPulseRecorded = true;
      worldState.worldLog.unshift({
        id: `final-${Date.now()}`,
        date: formatTurnDate(core.turn),
        lordId: "court",
        regionId: "sili_yuzhou",
        type: "court",
        mode: "simulation",
        text: `汉廷本局已结算：${core.ending?.title || "终局已定"}。天下态势档案停止自动推演。`,
        sourceIds: [],
      });
    }

    worldState.lastCoreStats = { ...core.stats };
    worldState.lastCoreHidden = { ...core.hidden };
    worldState.updatedAt = new Date().toISOString();
    saveWorldState();
    refreshUi(reason);
  }

  function isValidCoreState(core) {
    return Boolean(core && typeof core === "object" && core.stats && core.hidden && Number.isFinite(core.turn));
  }

  function safeParse(raw) {
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (error) {
      console.warn("天下模块读取存档失败", error);
      return null;
    }
  }

  function loadWorldState() {
    return safeParse(localStorage.getItem(WORLD_SAVE_KEY));
  }

  function saveWorldState() {
    if (!worldState) return;
    try {
      localStorage.setItem(WORLD_SAVE_KEY, JSON.stringify(worldState));
    } catch (error) {
      console.warn("天下模块保存失败", error);
    }
  }

  function ensureWorldState(core) {
    const loaded = loadWorldState();
    if (!loaded || loaded.gameCreatedAt !== core.createdAt) {
      return createWorldState(core);
    }
    return migrateWorldState(loaded, core);
  }

  function createWorldState(core) {
    const scenario = getScenario(core.scenarioId);
    const regions = {};
    DATA.regions.forEach((region) => {
      regions[region.id] = {
        controller: region.controller,
        stability: region.stability,
        military: region.military,
        courtAttitude: region.courtAttitude,
        lastChange: "开局态势",
      };
    });

    const lords = {};
    DATA.lords.forEach((lord) => {
      lords[lord.id] = {
        power: lord.power,
        courtNeed: lord.courtNeed,
        expansion: lord.expansion,
        caution: lord.caution,
        lastAction: "尚在观望",
      };
    });

    const characters = {};
    Object.entries(DATA.characterProfiles).forEach(([id, profile]) => {
      characters[id] = {
        loyalty: profile.loyalty,
        fear: profile.fear,
        ambition: profile.ambition,
        interest: profile.interest,
        lastReason: "开局评估",
      };
    });

    return {
      version: DATA.version,
      gameCreatedAt: core.createdAt,
      lastProcessedTurn: core.turn,
      lastReportTimestamp: latestReportTimestamp(core.reports),
      lastCoreRelations: { ...(core.relations || {}) },
      lastCoreStats: { ...core.stats },
      lastCoreHidden: { ...core.hidden },
      regions,
      lords,
      characters,
      worldLog: [
        {
          id: `opening-${Date.now()}`,
          date: formatTurnDate(1),
          lordId: "court",
          regionId: "sili_yuzhou",
          type: "court",
          mode: "historical-anchor",
          text: scenario.opening || "汉廷在乱世中重新整理诏令与天下档案。",
          sourceIds: scenario.id === "jianan_196" ? ["hhs_9", "sgz_1", "zz_62"] : [],
        },
      ],
      monthlyHistory: [],
      finalPulseRecorded: false,
      updatedAt: new Date().toISOString(),
    };
  }

  function migrateWorldState(state, core) {
    const migrated = {
      ...state,
      version: DATA.version,
      gameCreatedAt: core.createdAt,
      regions: { ...(state.regions || {}) },
      lords: { ...(state.lords || {}) },
      characters: { ...(state.characters || {}) },
      worldLog: Array.isArray(state.worldLog) ? state.worldLog : [],
      monthlyHistory: Array.isArray(state.monthlyHistory) ? state.monthlyHistory : [],
      lastCoreRelations: { ...(state.lastCoreRelations || core.relations || {}) },
      lastCoreStats: { ...(state.lastCoreStats || core.stats) },
      lastCoreHidden: { ...(state.lastCoreHidden || core.hidden) },
      lastProcessedTurn: Number.isFinite(state.lastProcessedTurn) ? state.lastProcessedTurn : core.turn,
    };

    DATA.regions.forEach((region) => {
      migrated.regions[region.id] = {
        controller: region.controller,
        stability: region.stability,
        military: region.military,
        courtAttitude: region.courtAttitude,
        lastChange: "资料补全",
        ...(migrated.regions[region.id] || {}),
      };
    });

    DATA.lords.forEach((lord) => {
      migrated.lords[lord.id] = {
        power: lord.power,
        courtNeed: lord.courtNeed,
        expansion: lord.expansion,
        caution: lord.caution,
        lastAction: "尚在观望",
        ...(migrated.lords[lord.id] || {}),
      };
    });

    Object.entries(DATA.characterProfiles).forEach(([id, profile]) => {
      migrated.characters[id] = {
        loyalty: profile.loyalty,
        fear: profile.fear,
        ambition: profile.ambition,
        interest: profile.interest,
        lastReason: "资料补全",
        ...(migrated.characters[id] || {}),
      };
    });

    return migrated;
  }

  function latestReportTimestamp(reports) {
    if (!Array.isArray(reports) || reports.length === 0) return 0;
    return Math.max(0, ...reports.map((report) => Number(report.timestamp) || 0));
  }

  function processNewCoreReports(core) {
    if (!worldState) return;
    const reports = Array.isArray(core.reports) ? [...core.reports] : [];
    const newReports = reports
      .filter((report) => (Number(report.timestamp) || 0) > (worldState.lastReportTimestamp || 0))
      .sort((a, b) => (Number(a.timestamp) || 0) - (Number(b.timestamp) || 0));

    const relationChanges = compareRelations(worldState.lastCoreRelations, core.relations || {});
    Object.entries(relationChanges).forEach(([characterId, delta]) => {
      applyRelationDelta(characterId, delta, "朝廷关系变化");
    });

    newReports.forEach((report) => {
      applyReportSignals(report);
    });

    worldState.lastCoreRelations = { ...(core.relations || {}) };
    worldState.lastReportTimestamp = Math.max(worldState.lastReportTimestamp || 0, latestReportTimestamp(reports));
  }

  function compareRelations(previous, current) {
    const output = {};
    Object.keys({ ...(previous || {}), ...(current || {}) }).forEach((id) => {
      const before = Number(previous?.[id] ?? current?.[id] ?? 50);
      const after = Number(current?.[id] ?? before);
      const delta = after - before;
      if (Math.abs(delta) >= 1) output[id] = delta;
    });
    return output;
  }

  function applyRelationDelta(characterId, delta, reason) {
    const metrics = worldState.characters[characterId];
    if (!metrics) return;
    metrics.loyalty = clamp(metrics.loyalty + Math.round(delta * 0.35), 0, 100);
    metrics.interest = clamp(metrics.interest + Math.round(delta * 0.65), 0, 100);
    if (delta < 0) metrics.fear = clamp(metrics.fear + Math.max(1, Math.round(Math.abs(delta) * 0.2)), 0, 100);
    if (delta > 7) metrics.ambition = clamp(metrics.ambition + 1, 0, 100);
    metrics.lastReason = `${reason}${formatSigned(delta)}`;
  }

  function applyReportSignals(report) {
    const combined = `${report.title || ""} ${report.text || ""}`;
    const positive = /(采纳|准|赐|封|任|慰|嘉|关系改善|支持|奉诏|加爵|召见)/.test(combined);
    const negative = /(拒绝|罢|黜|斥|问罪|惩|关系恶化|不满|警告)/.test(combined);
    const secret = /(密令|密诏|秘密|泄密|密线|衣带)/.test(combined);
    const appointment = /(任免|封赏|官爵|加其官|征辟)/.test(combined);

    Object.keys(worldState.characters).forEach((id) => {
      const character = window.GAME_DATA?.characters?.find((item) => item.id === id);
      if (!character || !combined.includes(character.name)) return;
      const metrics = worldState.characters[id];
      if (positive) {
        metrics.loyalty = clamp(metrics.loyalty + 1, 0, 100);
        metrics.interest = clamp(metrics.interest + (appointment ? 4 : 2), 0, 100);
      }
      if (negative) {
        metrics.loyalty = clamp(metrics.loyalty - 2, 0, 100);
        metrics.fear = clamp(metrics.fear + 2, 0, 100);
      }
      if (secret) metrics.fear = clamp(metrics.fear + 3, 0, 100);
      if (appointment) metrics.ambition = clamp(metrics.ambition + 1, 0, 100);
      metrics.lastReason = report.title || "御前处置";
    });
  }

  function processWorldMonth(core, completedTurn) {
    const date = formatTurnDate(completedTurn);
    const rng = seededRandom(`${worldState.gameCreatedAt}-${completedTurn}-${core.stats.prestige}`);
    const lordPool = [...DATA.lords]
      .map((lord) => ({ lord, score: rng() + (worldState.lords[lord.id]?.expansion || lord.expansion) / 300 }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map((item) => item.lord);

    const monthEntries = [];
    const changedRegions = new Set();

    lordPool.forEach((lord, index) => {
      const runtime = worldState.lords[lord.id];
      const templates = DATA.dynamicTemplates[lord.id] || ["继续观察天下形势。"];
      const templateIndex = Math.floor(rng() * templates.length) % templates.length;
      const text = templates[templateIndex];
      const primaryRegionId = lord.regions[0];
      const region = worldState.regions[primaryRegionId];

      const powerDelta = Math.round((rng() - 0.42) * 5);
      const courtDelta = Math.round((core.stats.prestige - 55) / 22 + (rng() - 0.5) * 3);
      runtime.power = clamp(runtime.power + powerDelta, 0, 100);
      runtime.courtNeed = clamp(runtime.courtNeed + courtDelta, 0, 100);
      runtime.lastAction = text;

      if (region) {
        const stabilityDelta = regionalStabilityDelta(lord.id, rng);
        const militaryDelta = Math.round((runtime.expansion - 50) / 28 + (rng() - 0.5) * 3);
        region.stability = clamp(region.stability + stabilityDelta, 0, 100);
        region.military = clamp(region.military + militaryDelta, 0, 100);
        region.courtAttitude = clamp(region.courtAttitude + Math.round(courtDelta * 0.65), 0, 100);
        region.lastChange = text;
        changedRegions.add(primaryRegionId);
      }

      const entry = {
        id: `${completedTurn}-${lord.id}-${index}`,
        date,
        lordId: lord.id,
        regionId: primaryRegionId,
        type: classifyLordAction(lord.id, text),
        mode: "simulation",
        text,
        sourceIds: lord.sourceIds || [],
      };
      worldState.worldLog.unshift(entry);
      monthEntries.push(entry);
    });

    applyHistoricalAnchors(completedTurn, date, core, monthEntries, changedRegions);
    applyCourtToWorld(core, rng, date, monthEntries);
    driftCharacterMetrics(core, rng);

    const summary = buildMonthlyWorldSummary(core, monthEntries, changedRegions);
    worldState.monthlyHistory.unshift({
      turn: completedTurn,
      date,
      summary,
      entries: monthEntries.map((entry) => entry.id),
      changedRegions: [...changedRegions],
    });

    worldState.monthlyHistory = worldState.monthlyHistory.slice(0, MAX_MONTHLY_HISTORY);
    worldState.worldLog = worldState.worldLog.slice(0, MAX_WORLD_LOG);
  }

  function regionalStabilityDelta(lordId, rng) {
    const base = { cao_cao: 1, yuan_shao: 1, yuan_shu: -3, liu_biao: 2, sun_ce: -1, liu_zhang: 2, zhang_lu: 1, ma_han: -2 }[lordId] ?? 0;
    return base + Math.round((rng() - 0.5) * 3);
  }

  function classifyLordAction(lordId, text) {
    if (/(出兵|攻取|兵锋|清剿|战线|军粮)/.test(text)) return "military";
    if (/(奉表|官爵|朝廷|诏令|名分)/.test(text)) return "diplomacy";
    if (lordId === "yuan_shu" || /(帝号|符瑞|僭)/.test(text)) return "threat";
    return "administration";
  }

  function applyHistoricalAnchors(completedTurn, date, core, entries, changedRegions) {
    const { year, month } = dateFromTurn(completedTurn);
    const anchors = [];

    if (year === 197 && month === 1) {
      anchors.push({ id: `anchor-wan-${completedTurn}`, date, lordId: "cao_cao", regionId: "jingzhou", type: "military", mode: "historical-anchor", text: "历史锚点：曹操在宛城受挫，许都军政集团短期承压。", sourceIds: ["sgz_1", "zz_62"] });
      worldState.lords.cao_cao.power = clamp(worldState.lords.cao_cao.power - 4, 0, 100);
    }

    if (year === 197 && month === 2) {
      anchors.push({ id: `anchor-yuanshu-${completedTurn}`, date, lordId: "yuan_shu", regionId: "huainan", type: "threat", mode: "historical-anchor", text: "历史锚点：淮南僭号风险公开化，汉廷正统受到直接挑战。", sourceIds: ["sgz_6", "zz_62"] });
      worldState.regions.huainan.courtAttitude = clamp(worldState.regions.huainan.courtAttitude - 10, 0, 100);
      worldState.regions.huainan.stability = clamp(worldState.regions.huainan.stability - 4, 0, 100);
      changedRegions.add("huainan");
    }

    if (year === 198 && month >= 7) {
      anchors.push({ id: `anchor-xuzhou-${completedTurn}`, date, lordId: "cao_cao", regionId: "xuzhou", type: "military", mode: "historical-anchor", text: "历史锚点：徐州战局趋于紧张，曹操与吕布之间的决战正在逼近。", sourceIds: ["sgz_1", "zz_62"] });
      worldState.regions.xuzhou.stability = clamp(worldState.regions.xuzhou.stability - 3, 0, 100);
      changedRegions.add("xuzhou");
    }

    anchors.forEach((entry) => {
      worldState.worldLog.unshift(entry);
      entries.unshift(entry);
    });

    if (core.stats.prestige >= 75 && anchors.length > 0) {
      worldState.regions.sili_yuzhou.courtAttitude = clamp(worldState.regions.sili_yuzhou.courtAttitude + 1, 0, 100);
    }
  }

  function applyCourtToWorld(core, rng, date, entries) {
    const external = Number(core.hidden.externalBalance || 0);
    const prestige = Number(core.stats.prestige || 0);
    const authority = Number(core.stats.authority || 0);
    const caoAlert = Number(core.stats.caoAlert || 0);

    DATA.regions.forEach((regionDef) => {
      const region = worldState.regions[regionDef.id];
      if (!region) return;
      const influence = (prestige - 50) / 45 + (external - 30) / 70 + (rng() - 0.5) * 0.8;
      region.courtAttitude = clamp(region.courtAttitude + Math.round(influence), 0, 100);
    });

    worldState.lords.cao_cao.courtNeed = clamp(worldState.lords.cao_cao.courtNeed + Math.round((prestige - 60) / 28), 0, 100);

    if (authority >= 65 || external >= 60) {
      const entry = { id: `court-pulse-${Date.now()}`, date, lordId: "court", regionId: "sili_yuzhou", type: "court", mode: "simulation", text: "汉廷诏令影响有所外溢，部分外镇在文书中更谨慎地使用朝廷名号。", sourceIds: [] };
      worldState.worldLog.unshift(entry);
      entries.push(entry);
    } else if (caoAlert >= 80) {
      const entry = { id: `cao-watch-${Date.now()}`, date, lordId: "cao_cao", regionId: "sili_yuzhou", type: "threat", mode: "simulation", text: "司空府加强对诏书、使者与宿卫的核验，朝廷对外联络受到明显压缩。", sourceIds: ["sgz_1"] };
      worldState.worldLog.unshift(entry);
      entries.push(entry);
    }
  }

  function driftCharacterMetrics(core, rng) {
    const caoAlert = Number(core.stats.caoAlert || 0);
    const prestige = Number(core.stats.prestige || 0);
    const authority = Number(core.stats.authority || 0);
    const external = Number(core.hidden.externalBalance || 0);

    Object.entries(worldState.characters).forEach(([id, metrics]) => {
      const profile = DATA.characterProfiles[id];
      if (!profile) return;
      if (["empress_fu", "dong_cheng", "yang_biao", "xun_yu"].includes(id)) {
        metrics.loyalty = clamp(metrics.loyalty + Math.round((prestige - 60) / 40), 0, 100);
        metrics.fear = clamp(metrics.fear + Math.round((caoAlert - 55) / 35), 0, 100);
      }
      if (["yuan_shao", "liu_biao", "sun_ce"].includes(id)) metrics.interest = clamp(metrics.interest + Math.round((prestige + external - 100) / 45), 0, 100);
      if (id === "cao_cao") {
        metrics.interest = clamp(metrics.interest + Math.round((prestige - 55) / 30), 0, 100);
        metrics.fear = clamp(metrics.fear + Math.round((authority - 55) / 35), 0, 100);
        metrics.ambition = clamp(metrics.ambition + (rng() > 0.72 ? 1 : 0), 0, 100);
      }
      if (id === "yuan_shu") {
        metrics.loyalty = clamp(metrics.loyalty - (prestige < 55 ? 1 : 0), 0, 100);
        metrics.ambition = clamp(metrics.ambition + (rng() > 0.55 ? 1 : 0), 0, 100);
      }
      metrics.lastReason = "月度局势推演";
    });
  }

  function buildMonthlyWorldSummary(core, entries, changedRegions) {
    const military = entries.filter((entry) => entry.type === "military").length;
    const threats = entries.filter((entry) => entry.type === "threat").length;
    const courtReach = calculateCourtReach(core);
    if (threats >= 2) return `僭越与割据风险上升，${changedRegions.size}处地区出现变化；朝廷辐射为${courtReach}。`;
    if (military >= 2) return `诸侯军事活动频繁，${changedRegions.size}处地区出现变化；朝廷辐射为${courtReach}。`;
    return `各镇以整军、守土和试探为主，${changedRegions.size}处地区出现变化；朝廷辐射为${courtReach}。`;
  }

  function calculateCourtReach(core = lastCoreState) {
    if (!core) return "仅存名义";
    const score = Number(core.stats.prestige || 0) * 0.42 + Number(core.stats.authority || 0) * 0.28 + Number(core.hidden.externalBalance || 0) * 0.3;
    if (score >= 72) return "可影响外镇";
    if (score >= 55) return "诏令尚有分量";
    if (score >= 38) return "名义号令";
    return "仅存名义";
  }

  function installNavButtons() {
    const nav = document.querySelector(".utility-nav");
    if (!nav || document.getElementById("world-map-btn")) return;
    const buttons = [["world-map-btn", "天下", "world"], ["world-people-btn", "人物志", "people"], ["world-timeline-btn", "时间线", "timeline"], ["world-sources-btn", "史料", "sources"]];
    const resetButton = document.getElementById("reset-btn");
    buttons.forEach(([id, label, tab]) => {
      const button = document.createElement("button");
      button.id = id;
      button.type = "button";
      button.textContent = label;
      button.dataset.worldTab = tab;
      button.addEventListener("click", () => openOverlay(tab));
      nav.insertBefore(button, resetButton || null);
    });
  }

  function installWorldBrief() {
    const stats = document.getElementById("stats-grid");
    if (!stats || document.getElementById("world-brief")) return;
    const section = document.createElement("section");
    section.id = "world-brief";
    section.className = "world-brief panel";
    section.innerHTML = `<div class="world-brief-head"><div><span class="section-kicker">全国态势</span><h2>天下急递</h2></div><div class="world-brief-actions"><span id="court-reach-chip" class="world-status-chip">名义号令</span><button id="world-brief-open" class="text-button" type="button">展开舆图</button></div></div><div id="world-brief-list" class="world-brief-list"></div>`;
    stats.insertAdjacentElement("afterend", section);
    section.querySelector("#world-brief-open")?.addEventListener("click", () => openOverlay("world"));
  }

  function installEventSourceButton() {
    const eventHead = document.querySelector(".event-head");
    if (!eventHead || document.getElementById("event-source-btn")) return;
    const button = document.createElement("button");
    button.id = "event-source-btn";
    button.className = "event-source-button hidden";
    button.type = "button";
    button.textContent = "史料依据";
    button.addEventListener("click", () => openOverlay("sources", { sourceFilter: getCurrentEventSourceIds() }));
    eventHead.appendChild(button);
  }

  function installOverlay() {
    if (document.getElementById("xian-world-overlay")) return;
    const overlay = document.createElement("div");
    overlay.id = "xian-world-overlay";
    overlay.className = "xian-world-overlay hidden";
    overlay.innerHTML = `<section class="xian-world-window" role="dialog" aria-modal="true" aria-labelledby="xian-world-title"><header class="xian-world-header"><div><span class="section-kicker">汉末天下档案</span><h2 id="xian-world-title">全国局势与诸侯动态</h2><p id="xian-world-date">尚未载入本局</p></div><button id="xian-world-close" class="xian-world-close" type="button" aria-label="关闭">×</button></header><nav class="xian-world-tabs" aria-label="天下档案栏目"><button type="button" data-world-panel="world">天下舆图</button><button type="button" data-world-panel="people">人物四维</button><button type="button" data-world-panel="timeline">历史时间线</button><button type="button" data-world-panel="sources">史料库</button></nav><div id="xian-world-content" class="xian-world-content"></div></section>`;
    document.body.appendChild(overlay);
    overlay.querySelector("#xian-world-close")?.addEventListener("click", closeOverlay);
    overlay.addEventListener("click", (event) => { if (event.target === overlay) closeOverlay(); });
    overlay.querySelectorAll("[data-world-panel]").forEach((button) => button.addEventListener("click", () => openOverlay(button.dataset.worldPanel)));
  }

  function installUiObservers() {
    const characterList = document.getElementById("character-list");
    if (characterList) new MutationObserver(() => augmentCharacterCards()).observe(characterList, { childList: true, subtree: true });
    const eventTitle = document.getElementById("event-title");
    if (eventTitle) new MutationObserver(() => updateEventSourceButton()).observe(eventTitle, { childList: true, characterData: true, subtree: true });
  }

  function installDelegatedEvents() {
    document.addEventListener("click", (event) => {
      const card = event.target.closest?.("[data-character-id]");
      if (card) setTimeout(() => augmentCharacterModal(card.dataset.characterId), 10);
    }, true);
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape" && !document.getElementById("xian-world-overlay")?.classList.contains("hidden")) closeOverlay();
    });
  }

  function refreshUi() {
    renderWorldBrief();
    augmentCharacterCards();
    updateEventSourceButton();
    if (!document.getElementById("xian-world-overlay")?.classList.contains("hidden")) renderOverlay();
  }

  function renderWorldBrief() {
    const list = document.getElementById("world-brief-list");
    const chip = document.getElementById("court-reach-chip");
    if (!list) return;
    if (chip) chip.textContent = calculateCourtReach(lastCoreState);
    const entries = worldState?.worldLog?.slice(0, 4) || [];
    list.innerHTML = entries.length ? entries.map((entry) => `<button class="world-brief-item ${entry.type}" type="button" data-world-entry-region="${entry.regionId || ""}"><span>${entry.mode === "historical-anchor" ? "史" : worldEntryIcon(entry.type)}</span><strong>${escapeHtml(entry.date)}</strong><p>${escapeHtml(entry.text)}</p></button>`).join("") : '<p class="empty-state">开启新局后，尚书台会汇总各地急递。</p>';
    list.querySelectorAll("[data-world-entry-region]").forEach((button) => button.addEventListener("click", () => openOverlay("world", { regionId: button.dataset.worldEntryRegion })));
  }

  function worldEntryIcon(type) {
    return { military: "兵", diplomacy: "使", threat: "警", administration: "政", court: "诏" }[type] || "报";
  }

  function augmentCharacterCards() {
    if (!worldState) return;
    document.querySelectorAll("#character-list [data-character-id]").forEach((card) => {
      const metrics = worldState.characters[card.dataset.characterId];
      const copy = card.querySelector(".character-copy");
      if (!metrics || !copy) return;
      let row = copy.querySelector(".four-metric-mini");
      if (!row) { row = document.createElement("span"); row.className = "four-metric-mini"; copy.appendChild(row); }
      row.innerHTML = `<i title="忠诚">忠 ${Math.round(metrics.loyalty)}</i><i title="恐惧">惧 ${Math.round(metrics.fear)}</i><i title="野心">志 ${Math.round(metrics.ambition)}</i><i title="利益">利 ${Math.round(metrics.interest)}</i>`;
    });
  }

  function augmentCharacterModal(characterId) {
    if (!worldState || !characterId) return;
    const modalBody = document.getElementById("modal-body");
    if (!modalBody || document.getElementById("character-four-dim-panel")) return;
    const profile = DATA.characterProfiles[characterId];
    const metrics = worldState.characters[characterId];
    if (!profile || !metrics) return;
    const panel = document.createElement("section");
    panel.id = "character-four-dim-panel";
    panel.className = "character-four-dim-panel";
    panel.innerHTML = `<div class="four-dim-title"><div><span class="section-kicker">政治人格</span><h4>忠诚 · 恐惧 · 野心 · 利益</h4></div><span class="archetype-chip">${escapeHtml(classifyCharacter(metrics, profile))}</span></div><div class="four-dim-grid">${Object.keys(DATA.metricMeta).map((key) => renderMetricBar(key, metrics[key])).join("")}</div><p class="political-assessment">${escapeHtml(buildCharacterAssessment(characterId, metrics, profile))}</p><div class="character-source-row"><span>最近变化：${escapeHtml(metrics.lastReason || "暂无")}</span><button type="button" data-character-sources="${characterId}">查阅人物史料</button></div>`;
    modalBody.appendChild(panel);
    panel.querySelector("[data-character-sources]")?.addEventListener("click", () => openOverlay("sources", { sourceFilter: profile.sourceIds || [], characterId }));
  }

  function renderMetricBar(key, value) {
    const meta = DATA.metricMeta[key];
    return `<div class="four-dim-metric ${key}"><div><span>${meta.short}</span><strong>${meta.name}</strong><b>${Math.round(value)}</b></div><div class="four-dim-track"><i style="width:${clamp(value, 0, 100)}%"></i></div><small>${escapeHtml(metricInterpretation(key, value))}</small></div>`;
  }

  function metricInterpretation(key, value) {
    const labels = { loyalty: ["可能背离", "有限认同", "愿意合作", "可托大事"], fear: ["无所畏惧", "保持警惕", "顾虑很深", "近乎噤声"], ambition: ["无意进取", "求稳自保", "有所图谋", "志在天下"], interest: ["合作无利", "利益有限", "合作有益", "高度依赖"] }[key];
    if (value < 25) return labels[0];
    if (value < 50) return labels[1];
    if (value < 75) return labels[2];
    return labels[3];
  }

  function classifyCharacter(metrics, profile) {
    if (metrics.loyalty >= 75 && metrics.fear < 55) return "可托大事";
    if (metrics.loyalty >= 70 && metrics.fear >= 55) return "忠而畏祸";
    if (metrics.ambition >= 85 && metrics.interest >= 70) return "借汉自重";
    if (metrics.ambition >= 85 && metrics.loyalty < 25) return "危险雄主";
    if (metrics.interest >= 75 && metrics.loyalty < 50) return "利益盟友";
    if (metrics.fear >= 75) return "谨慎观望";
    return profile.archetype || "立场复杂";
  }

  function buildCharacterAssessment(id, metrics, profile) {
    const parts = [profile.assessment];
    if (metrics.loyalty >= 75 && metrics.fear >= 65) parts.push("此人心向汉室，但若无安全保证，未必愿意执行高风险命令。");
    if (metrics.interest >= 75 && metrics.loyalty < 45) parts.push("当前合作主要建立在官爵、合法性或现实资源上，不宜误判为忠心。");
    if (metrics.ambition >= 85) parts.push("其个人政治目标极强，任何授权都可能同时扩大未来威胁。");
    if (id === "cao_cao" && metrics.interest >= 80) parts.push("汉廷威望越高，他越需要朝廷名义，但也会更警惕皇权独立。");
    return parts.join(" ");
  }

  function updateEventSourceButton() {
    const button = document.getElementById("event-source-btn");
    if (!button) return;
    const sourceIds = getCurrentEventSourceIds();
    button.classList.toggle("hidden", sourceIds.length === 0);
    button.textContent = sourceIds.length ? `史料依据 ${sourceIds.length}` : "史料依据";
  }

  function getCurrentEventSourceIds() {
    const core = lastCoreState || safeParse(localStorage.getItem(GAME_SAVE_KEY));
    return core?.currentEventId ? DATA.eventSourceMap[core.currentEventId] || [] : [];
  }

  function openOverlay(tab = "world", options = {}) {
    overlayState = { tab, sourceFilter: options.sourceFilter || null, characterId: options.characterId || null, regionId: options.regionId || null };
    const overlay = document.getElementById("xian-world-overlay");
    if (!overlay) return;
    overlay.classList.remove("hidden");
    document.body.classList.add("world-overlay-open");
    renderOverlay();
  }

  function closeOverlay() {
    document.getElementById("xian-world-overlay")?.classList.add("hidden");
    document.body.classList.remove("world-overlay-open");
  }

  function renderOverlay() {
    const content = document.getElementById("xian-world-content");
    const title = document.getElementById("xian-world-title");
    const date = document.getElementById("xian-world-date");
    if (!content || !title || !date) return;
    document.querySelectorAll("[data-world-panel]").forEach((button) => button.classList.toggle("active", button.dataset.worldPanel === overlayState.tab));
    date.textContent = lastCoreState ? `${formatTurnDate(lastCoreState.turn)} · 第 ${lastCoreState.turn}/${lastCoreState.maxTurns || 24} 月` : "尚未载入本局；以下为汉末历史基础态势";
    const renderers = { world: renderWorldPanel, people: renderPeoplePanel, timeline: renderTimelinePanel, sources: renderSourcesPanel };
    const titles = { world: "全国局势与诸侯动态", people: "人物政治人格四维模型", timeline: "汉末历史与本局时间线", sources: "史料库与事件依据" };
    title.textContent = titles[overlayState.tab] || titles.world;
    content.innerHTML = (renderers[overlayState.tab] || renderWorldPanel)();
    bindOverlayContentEvents();
  }

  function renderWorldPanel() {
    const regions = worldState?.regions || Object.fromEntries(DATA.regions.map((r) => [r.id, r]));
    const strongestLord = getStrongestLord();
    const unstable = getMostUnstableRegion();
    const latest = worldState?.worldLog?.slice(0, 12) || [];
    return `<section class="world-summary-grid"><article><span>朝廷辐射</span><strong>${escapeHtml(calculateCourtReach(lastCoreState))}</strong><small>由皇权、威望与外部制衡综合计算</small></article><article><span>最强诸侯</span><strong>${escapeHtml(strongestLord?.name || "未定")}</strong><small>综合军政实力 ${Math.round(strongestLord?.runtime?.power || 0)}</small></article><article><span>最不稳定地区</span><strong>${escapeHtml(unstable?.name || "未定")}</strong><small>稳定 ${Math.round(unstable?.runtime?.stability || 0)}</small></article><article><span>天下总趋势</span><strong>${escapeHtml(buildWorldTrend())}</strong><small>所有结果均为本局动态推演</small></article></section><section class="world-main-grid"><div class="schematic-map-card"><div class="world-section-head"><div><span class="section-kicker">政治态势示意</span><h3>全国局势地图</h3></div><small>点击地区审阅详情</small></div><div class="schematic-map" aria-label="汉末全国局势示意图">${DATA.regions.map((region) => renderRegionTile(region, regions[region.id])).join("")}</div><p class="map-disclaimer">注：本图用于表现势力与局势，不代表精确疆界、比例或古代行政区测绘。</p></div><div class="world-dynamics-card"><div class="world-section-head"><div><span class="section-kicker">月度急递</span><h3>诸侯动态</h3></div><small>${latest.length} 条</small></div><div class="world-log-list">${latest.length ? latest.map(renderWorldLogEntry).join("") : '<p class="empty-state">结束一个月份后，各镇动态将在此汇总。</p>'}</div></div></section><section class="lords-card"><div class="world-section-head"><div><span class="section-kicker">外镇评估</span><h3>主要诸侯</h3></div><small>实力 · 对朝廷需求 · 扩张倾向</small></div><div class="lord-grid">${DATA.lords.map(renderLordCard).join("")}</div></section>`;
  }

  function renderRegionTile(region, runtime) {
    const controller = DATA.controllers[runtime?.controller || region.controller] || DATA.controllers.fragmented;
    return `<button class="map-region ${region.area}${overlayState.regionId === region.id ? " selected" : ""}" type="button" data-region-id="${region.id}" style="--controller:${controller.color};--controller-text:${controller.text}"><span class="region-short">${region.short}</span><strong>${region.name}</strong><small>${controller.name}</small><i title="地区稳定">稳 ${Math.round(runtime?.stability ?? region.stability)}</i></button>`;
  }

  function renderWorldLogEntry(entry) {
    const lord = DATA.lords.find((item) => item.id === entry.lordId);
    const region = DATA.regions.find((item) => item.id === entry.regionId);
    return `<article class="world-log-entry ${entry.type}"><span class="world-log-icon">${entry.mode === "historical-anchor" ? "史" : worldEntryIcon(entry.type)}</span><div><div><strong>${escapeHtml(lord?.name || (entry.lordId === "court" ? "汉廷" : "天下"))}</strong><time>${escapeHtml(entry.date)}</time></div><p>${escapeHtml(entry.text)}</p><small>${escapeHtml(region?.name || "全国")} · ${entry.mode === "historical-anchor" ? "历史锚点" : "本局推演"}</small></div></article>`;
  }

  function renderLordCard(lord) {
    const runtime = worldState?.lords?.[lord.id] || lord;
    return `<article class="lord-card" data-lord-id="${lord.id}"><div class="lord-card-head"><div><strong>${lord.name}</strong><small>${lord.title} · ${lord.seat}</small></div><b>${Math.round(runtime.power)}</b></div>${renderCompactGauge("军政实力", runtime.power)}${renderCompactGauge("朝廷需求", runtime.courtNeed)}${renderCompactGauge("扩张倾向", runtime.expansion)}<p>${escapeHtml(runtime.lastAction || lord.agenda.join("、"))}</p></article>`;
  }

  function renderCompactGauge(label, value) { return `<div class="compact-gauge"><span>${label}</span><i><b style="width:${clamp(value, 0, 100)}%"></b></i><em>${Math.round(value)}</em></div>`; }

  function renderPeoplePanel() {
    const characters = window.GAME_DATA?.characters || [];
    return `<div class="people-intro"><p>旧版单一“关系值”仍用于兼容核心规则；本页增加忠诚、恐惧、野心、利益四维政治人格。四项数值会随召见、封赏、密令、曹氏警戒与天下威望变化。</p></div><div class="political-character-grid">${Object.entries(DATA.characterProfiles).filter(([id]) => id !== "liu_xie").map(([id, profile]) => { const character = characters.find((item) => item.id === id); const metrics = worldState?.characters?.[id] || profile; return `<button class="political-character-card" type="button" data-world-character="${id}"><div class="political-character-head"><span>${escapeHtml(character?.initials || character?.name?.slice(0, 1) || "人")}</span><div><strong>${escapeHtml(character?.name || id)}</strong><small>${escapeHtml(character?.title || profile.archetype)}</small></div><b>${escapeHtml(classifyCharacter(metrics, profile))}</b></div><div class="political-mini-bars">${Object.keys(DATA.metricMeta).map((key) => `<div><span>${DATA.metricMeta[key].short}</span><i><b style="width:${clamp(metrics[key], 0, 100)}%"></b></i><em>${Math.round(metrics[key])}</em></div>`).join("")}</div><p>${escapeHtml(buildCharacterAssessment(id, metrics, profile))}</p></button>`; }).join("")}</div>`;
  }

  function renderTimelinePanel() {
    const playerChronicle = lastCoreState?.chronicle || [];
    const currentYear = lastCoreState?.year || 196;
    const currentMonth = lastCoreState?.month || 10;
    return `<div class="timeline-legend"><span><i class="historical-dot"></i>正史时间线</span><span><i class="player-dot"></i>本局御前实录</span><p>史料条目是历史背景；玩家决策不会被强行改回历史结果。</p></div><div class="dual-timeline"><section><div class="world-section-head"><div><span class="section-kicker">史实背景</span><h3>汉末纪年</h3></div><small>${DATA.timeline.length} 项</small></div><div class="historical-timeline">${DATA.timeline.map((item) => renderHistoricalTimelineItem(item, currentYear, currentMonth)).join("")}</div></section><section><div class="world-section-head"><div><span class="section-kicker">你的历史</span><h3>本局时间线</h3></div><small>${playerChronicle.length} 项</small></div><div class="player-timeline">${playerChronicle.length ? [...playerChronicle].reverse().map((entry, index) => `<article><span>${String(playerChronicle.length - index).padStart(2, "0")}</span><div><time>${escapeHtml(entry.date)}</time><p>${escapeHtml(entry.text)}</p></div></article>`).join("") : '<p class="empty-state">开启新局后，本局决策将与正史时间线并列保存。</p>'}</div></section></div>`;
  }

  function renderHistoricalTimelineItem(item, currentYear, currentMonth) {
    const past = item.year < currentYear || (item.year === currentYear && item.month <= currentMonth);
    const current = item.year === currentYear && item.month === currentMonth;
    return `<article class="historical-timeline-item ${past ? "past" : "future"} ${current ? "current" : ""}"><time>${item.year}年${item.month ? `${item.month}月` : ""}</time><div><h4>${escapeHtml(item.title)}</h4><p>${escapeHtml(item.summary)}</p><small>${escapeHtml(item.gameNote)}</small></div><button type="button" data-timeline-sources="${item.id}">史料</button></article>`;
  }

  function renderSourcesPanel() {
    let sources = DATA.sources;
    if (Array.isArray(overlayState.sourceFilter) && overlayState.sourceFilter.length > 0) { const filter = new Set(overlayState.sourceFilter); sources = DATA.sources.filter((source) => filter.has(source.id)); }
    const event = [...(window.GAME_DATA?.fixedEvents || []), ...(window.GAME_DATA?.randomEvents || []), ...Object.values(window.GAME_DATA?.scenarioEvents || {})].find((item) => item.id === lastCoreState?.currentEventId);
    return `${overlayState.sourceFilter ? `<div class="source-context"><strong>${event ? `当前事件：${escapeHtml(event.title)}` : "筛选史料"}</strong><p>以下资料用于提供历史背景；游戏的数值、对话与具体因果属于设计性推演。</p><button type="button" data-clear-source-filter>查看全部史料</button></div>` : `<div class="source-context"><strong>引用原则</strong><p>正史与编年史用于确定人物、时间与大势；存在分歧或细节不足之处，游戏会明确标注“游戏化综合”。</p></div>`}<div class="source-grid">${sources.map((source) => `<article class="source-card"><div><span>${escapeHtml(source.reliability)}</span><h3>${escapeHtml(source.work)}</h3><h4>${escapeHtml(source.chapter)}</h4></div><p>${escapeHtml(source.scope)}</p><footer><small>${escapeHtml(source.author)}</small><a href="${source.url}" target="_blank" rel="noopener noreferrer">打开原文 ↗</a></footer></article>`).join("")}</div>`;
  }

  function bindOverlayContentEvents() {
    document.querySelectorAll("[data-region-id]").forEach((button) => button.addEventListener("click", () => showRegionDetail(button.dataset.regionId)));
    document.querySelectorAll("[data-world-character]").forEach((button) => button.addEventListener("click", () => showWorldCharacterDetail(button.dataset.worldCharacter)));
    document.querySelectorAll("[data-timeline-sources]").forEach((button) => button.addEventListener("click", () => { const item = DATA.timeline.find((entry) => entry.id === button.dataset.timelineSources); openOverlay("sources", { sourceFilter: item?.sourceIds || [] }); }));
    document.querySelector("[data-clear-source-filter]")?.addEventListener("click", () => openOverlay("sources"));
  }

  function showRegionDetail(regionId) {
    const region = DATA.regions.find((item) => item.id === regionId);
    const runtime = worldState?.regions?.[regionId] || region;
    if (!region) return;
    const controller = DATA.controllers[runtime.controller || region.controller] || DATA.controllers.fragmented;
    const relatedLogs = worldState?.worldLog?.filter((entry) => entry.regionId === regionId).slice(0, 6) || [];
    const content = document.getElementById("xian-world-content");
    if (!content) return;
    content.innerHTML = `<button class="world-back-button" type="button" data-world-back>← 返回全国舆图</button><section class="region-detail-card" style="--controller:${controller.color}"><header><span>${region.short}</span><div><p>${escapeHtml(region.importance)}</p><h3>${escapeHtml(region.name)}</h3><small>${escapeHtml(region.capital)} · ${escapeHtml(controller.name)}</small></div></header><p class="region-summary">${escapeHtml(region.summary)}</p><div class="region-metrics">${renderRegionGauge("地方稳定", runtime.stability)}${renderRegionGauge("军事压力", runtime.military)}${renderRegionGauge("对朝廷态度", runtime.courtAttitude)}</div><div class="region-last-change"><strong>最近变化</strong><p>${escapeHtml(runtime.lastChange || "暂无")}</p></div></section><section class="region-log-card"><div class="world-section-head"><div><span class="section-kicker">地方档案</span><h3>近期急递</h3></div></div>${relatedLogs.length ? relatedLogs.map(renderWorldLogEntry).join("") : '<p class="empty-state">暂无该地区动态。</p>'}</section><section class="region-source-card"><button type="button" data-region-sources>查阅此地区史料依据</button></section>`;
    content.querySelector("[data-world-back]")?.addEventListener("click", () => openOverlay("world"));
    content.querySelector("[data-region-sources]")?.addEventListener("click", () => openOverlay("sources", { sourceFilter: region.sourceIds || [] }));
  }

  function renderRegionGauge(label, value) { return `<div><span>${label}</span><strong>${Math.round(value)}</strong><i><b style="width:${clamp(value, 0, 100)}%"></b></i></div>`; }

  function showWorldCharacterDetail(id) {
    const character = window.GAME_DATA?.characters?.find((item) => item.id === id);
    const profile = DATA.characterProfiles[id];
    const metrics = worldState?.characters?.[id] || profile;
    const content = document.getElementById("xian-world-content");
    if (!profile || !metrics || !content) return;
    content.innerHTML = `<button class="world-back-button" type="button" data-world-back>← 返回人物志</button><section class="world-character-detail"><header><span>${escapeHtml(character?.initials || character?.name?.slice(0, 1) || "人")}</span><div><p>${escapeHtml(character?.title || "")}</p><h3>${escapeHtml(character?.name || id)}</h3><small>${escapeHtml(classifyCharacter(metrics, profile))}</small></div></header><div class="world-character-metrics">${Object.keys(DATA.metricMeta).map((key) => renderMetricBar(key, metrics[key])).join("")}</div><article><h4>御前判断</h4><p>${escapeHtml(buildCharacterAssessment(id, metrics, profile))}</p></article><article><h4>最近变化依据</h4><p>${escapeHtml(metrics.lastReason || "暂无记录")}</p></article><button class="source-open-button" type="button" data-world-character-sources>查阅人物史料</button></section>`;
    content.querySelector("[data-world-back]")?.addEventListener("click", () => openOverlay("people"));
    content.querySelector("[data-world-character-sources]")?.addEventListener("click", () => openOverlay("sources", { sourceFilter: profile.sourceIds || [], characterId: id }));
  }

  function getStrongestLord() { return DATA.lords.map((lord) => ({ ...lord, runtime: worldState?.lords?.[lord.id] || lord })).sort((a, b) => b.runtime.power - a.runtime.power)[0]; }
  function getMostUnstableRegion() { return DATA.regions.map((region) => ({ ...region, runtime: worldState?.regions?.[region.id] || region })).sort((a, b) => a.runtime.stability - b.runtime.stability)[0]; }

  function buildWorldTrend() {
    if (!worldState) return "等待开局";
    const values = Object.values(worldState.regions);
    const averageStability = values.reduce((sum, region) => sum + Number(region.stability || 0), 0) / Math.max(1, values.length);
    const threatCount = worldState.worldLog.slice(0, 12).filter((entry) => entry.type === "threat").length;
    const militaryCount = worldState.worldLog.slice(0, 12).filter((entry) => entry.type === "military").length;
    if (threatCount >= 3) return "名分危机";
    if (militaryCount >= 5 || averageStability < 42) return "战云密布";
    if (averageStability >= 64) return "诸镇暂稳";
    return "群雄试探";
  }

  function seededRandom(seedText) {
    let seed = 2166136261;
    for (let index = 0; index < seedText.length; index += 1) { seed ^= seedText.charCodeAt(index); seed = Math.imul(seed, 16777619); }
    return () => { seed += 0x6d2b79f5; let value = seed; value = Math.imul(value ^ (value >>> 15), value | 1); value ^= value + Math.imul(value ^ (value >>> 7), value | 61); return ((value ^ (value >>> 14)) >>> 0) / 4294967296; };
  }

  function getScenario(id) { return (window.GAME_DATA?.scenarios || []).find(item => item.id === id) || window.GAME_DATA?.scenario || {}; }
  function dateFromTurn(turn) { const scenario = getScenario(lastCoreState?.scenarioId || "jianan_196"); const total = Number(scenario.startYear || 196) * 12 + Number(scenario.startMonth || 10) - 1 + Math.max(0, turn - 1); return { year: Math.floor(total / 12), month: (total % 12) + 1 }; }
  function formatTurnDate(turn) { const { year, month } = dateFromTurn(turn); let era; let eraYear; if(year===189){era="中平";eraYear=6;}else if(year>=190&&year<=193){era="初平";eraYear=year-189;}else if(year>=194&&year<=195){era="兴平";eraYear=year-193;}else if(year>=196&&year<=219){era="建安";eraYear=year-195;}else if(year===220){era="延康";eraYear=1;}else{return `公元${year}年${toChineseMonth(month)}`;} return `${era}${eraYear===1?"元":toChineseNumber(eraYear)}年${toChineseMonth(month)}`; }
  function toChineseNumber(value) { const map = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"]; if (value <= 10) return value === 10 ? "十" : map[value]; if (value < 20) return `十${map[value - 10]}`; return String(value); }
  function toChineseMonth(month) { return ["正月", "二月", "三月", "四月", "五月", "六月", "七月", "八月", "九月", "十月", "十一月", "十二月"][month - 1] || `${month}月`; }
  function formatSigned(value) { return value > 0 ? `+${Math.round(value)}` : String(Math.round(value)); }
  function clamp(value, min, max) { return Math.min(max, Math.max(min, Number(value) || 0)); }
  function escapeHtml(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
})();
