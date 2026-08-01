/*
 * 天子蒙尘：献帝模拟器 v0.3.0
 * 自由圣旨对具体州郡与诸侯战略的直接影响层。
 */
(() => {
  "use strict";

  const DATA = window.XIAN_WORLD_DATA;
  if (!DATA) return;

  const GAME_SAVE_KEY = "xian_emperor_simulator_v01";
  const WORLD_SAVE_KEY = "xian_emperor_world_v020";
  const EXTENSION_KEY = "xian_emperor_decree_world_v030";
  const VERSION = "0.3.0";
  const MAX_HISTORY = 36;

  const REGION_ALIASES = {
    liangzhou: ["凉州", "西凉", "武威"],
    guanzhong: ["关中", "长安", "雍州", "西京"],
    yizhou: ["益州", "成都", "蜀中", "巴蜀"],
    hanzhong: ["汉中", "南郑", "秦蜀栈道"],
    jingzhou: ["荆州", "襄阳", "荆襄"],
    jiaozhou: ["交州", "广信", "岭南"],
    jiangdong: ["江东", "吴郡", "扬州", "江左"],
    huainan: ["淮南", "寿春"],
    sili_yuzhou: ["司隶", "豫州", "许都", "许县", "颍川", "中原朝廷"],
    xuzhou: ["徐州", "下邳", "彭城"],
    qingzhou: ["青州", "临淄"],
    jizhou: ["冀州", "河北", "邺城", "邺"],
    bingzhou: ["并州", "晋阳"],
    youzhou: ["幽州", "蓟城", "蓟", "北疆"],
  };

  let extensionState = null;
  let processTimer = null;
  let initialized = false;

  installStorageWatcher();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }

  function installStorageWatcher() {
    if (window.__xianDecreeWorldWatcherInstalled) return;
    window.__xianDecreeWorldWatcherInstalled = true;

    const previousSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function decreeAwareSetItem(key, value) {
      previousSetItem.apply(this, arguments);
      if (this === localStorage && key === GAME_SAVE_KEY) queueProcess(value);
    };
  }

  function init() {
    if (initialized) return;
    initialized = true;

    const core = safeParse(localStorage.getItem(GAME_SAVE_KEY));
    extensionState = loadExtensionState();
    if (!extensionState || extensionState.gameCreatedAt !== core?.createdAt) {
      extensionState = createExtensionState(core);
      saveExtensionState();
    }

    installImpactPanel(0);
    renderLatestImpact();
  }

  function queueProcess(raw) {
    window.clearTimeout(processTimer);
    processTimer = window.setTimeout(() => processCoreSave(raw, 0), 60);
  }

  function processCoreSave(raw, attempt) {
    const core = safeParse(raw);
    if (!isValidCore(core)) return;

    if (!extensionState || extensionState.gameCreatedAt !== core.createdAt) {
      extensionState = createExtensionState(core);
      saveExtensionState();
      renderLatestImpact();
      return;
    }

    const reports = Array.isArray(core.reports) ? [...core.reports] : [];
    const latestTimestamp = getLatestTimestamp(reports);
    const newReports = reports
      .filter(report => (Number(report.timestamp) || 0) > (extensionState.lastReportTimestamp || 0))
      .sort((a, b) => (Number(a.timestamp) || 0) - (Number(b.timestamp) || 0));

    if (newReports.length === 0) {
      extensionState.lastReportTimestamp = Math.max(extensionState.lastReportTimestamp || 0, latestTimestamp);
      saveExtensionState();
      return;
    }

    const edictReports = newReports.filter(report => /^圣旨·/.test(report.title || ""));
    if (edictReports.length === 0) {
      extensionState.lastReportTimestamp = latestTimestamp;
      saveExtensionState();
      return;
    }

    const world = safeParse(localStorage.getItem(WORLD_SAVE_KEY));
    if (!isValidWorld(world, core)) {
      if (attempt < 4) {
        window.setTimeout(() => processCoreSave(raw, attempt + 1), 80 * (attempt + 1));
      }
      return;
    }

    let changed = false;
    let latestImpact = null;
    edictReports.forEach(report => {
      const impact = applyEdictToWorld(report, core, world);
      if (!impact) return;
      changed = true;
      latestImpact = impact;
      extensionState.history.unshift(impact);
    });

    extensionState.history = extensionState.history.slice(0, MAX_HISTORY);
    extensionState.lastReportTimestamp = latestTimestamp;
    extensionState.updatedAt = new Date().toISOString();

    if (changed) {
      try {
        localStorage.setItem(WORLD_SAVE_KEY, JSON.stringify(world));
      } catch (error) {
        console.warn("诏令天下影响保存失败。", error);
      }
    }
    saveExtensionState();

    if (latestImpact) {
      renderLatestImpact();
      showImpactToast(latestImpact);
      document.dispatchEvent(new CustomEvent("xian:decree-world-impact", { detail: latestImpact }));
    }
  }

  function applyEdictToWorld(report, core, world) {
    const parsed = parseEdictReport(report);
    if (parsed.regionIds.length === 0 && parsed.lordIds.length === 0) return null;

    const regionIds = new Set(parsed.regionIds);
    parsed.lordIds.forEach(lordId => {
      const lord = DATA.lords.find(item => item.id === lordId);
      lord?.regions?.forEach(regionId => regionIds.add(regionId));
    });

    const lordIds = new Set(parsed.lordIds);
    regionIds.forEach(regionId => {
      const region = DATA.regions.find(item => item.id === regionId);
      if (region && DATA.lords.some(lord => lord.id === region.controller)) lordIds.add(region.controller);
    });

    const regionChanges = [];
    regionIds.forEach(regionId => {
      const runtime = world.regions?.[regionId];
      const definition = DATA.regions.find(item => item.id === regionId);
      if (!runtime || !definition) return;

      const delta = calculateRegionDelta(parsed);
      const actual = applyNumericChanges(runtime, delta);
      runtime.lastChange = `玩家诏令：${shorten(report.title || "圣旨", 24)}`;
      if (Object.keys(actual).length > 0) {
        regionChanges.push({ id: regionId, name: definition.name, changes: actual });
      }
    });

    const lordChanges = [];
    lordIds.forEach(lordId => {
      const runtime = world.lords?.[lordId];
      const definition = DATA.lords.find(item => item.id === lordId);
      if (!runtime || !definition) return;

      const delta = calculateLordDelta(parsed);
      const actual = applyNumericChanges(runtime, delta);
      runtime.lastAction = parsed.negative
        ? `对朝廷诏令提高戒备：${shorten(report.title || "圣旨", 22)}`
        : `回应朝廷诏令：${shorten(report.title || "圣旨", 22)}`;
      if (Object.keys(actual).length > 0) {
        lordChanges.push({ id: lordId, name: definition.name, changes: actual });
      }
    });

    if (regionChanges.length === 0 && lordChanges.length === 0) return null;

    const impact = {
      id: `edict-impact-${Number(report.timestamp) || Date.now()}`,
      reportTimestamp: Number(report.timestamp) || Date.now(),
      gameCreatedAt: core.createdAt,
      date: report.date || "本月",
      title: report.title || "圣旨",
      categories: parsed.categories,
      negative: parsed.negative,
      efficiency: parsed.efficiency,
      regionChanges,
      lordChanges,
      summary: buildImpactSummary(regionChanges, lordChanges),
      createdAt: new Date().toISOString(),
    };

    world.worldLog = Array.isArray(world.worldLog) ? world.worldLog : [];
    world.worldLog.unshift({
      id: impact.id,
      date: impact.date,
      lordId: lordChanges[0]?.id || "court",
      regionId: regionChanges[0]?.id || "sili_yuzhou",
      type: parsed.negative ? "threat" : parsed.categories.includes("military") ? "military" : parsed.categories.includes("diplomacy") ? "diplomacy" : "court",
      mode: "player-edict",
      text: `诏令落地：${impact.summary}`,
      sourceIds: [],
    });
    world.worldLog = world.worldLog.slice(0, 72);
    world.updatedAt = new Date().toISOString();

    return impact;
  }

  function parseEdictReport(report) {
    const combined = `${report.title || ""} ${report.text || ""}`;
    const categories = [];
    const categoryPatterns = [
      ["relief", /(赈济|开仓|救灾|灾民|流民)/],
      ["tax", /(减赋|免税|减税|免赋|赋役)/],
      ["investigation", /(察吏|彻查|查办|御史|贪腐|整顿吏治)/],
      ["military", /(整军|练兵|军队|武备|宿卫|兵权|讨伐)/],
      ["ritual", /(礼制|宗庙|祭祀|朝仪|经筵|大朝会)/],
      ["secret", /(密令|密诏|秘密|暗中|心腹|衣带)/],
      ["appointment", /(任官|任命|加封|封爵|拜为|授官|罢免|黜)/],
      ["diplomacy", /(外交|遣使|结盟|外援|牵制|贡赋|奉表)/],
      ["appease", /(安抚|嘉奖|褒奖|信任|赐宴|军务便宜)/],
    ];

    categoryPatterns.forEach(([category, pattern]) => {
      if (pattern.test(combined)) categories.push(category);
    });
    if (categories.length === 0) categories.push("generic");

    const regionIds = detectRegions(combined);
    const lordIds = detectLords(combined);
    const efficiencyMatch = combined.match(/[（(](\d{1,3})%[）)]/);
    const efficiency = efficiencyMatch
      ? clamp(Number(efficiencyMatch[1]) / 100, 0.28, 0.94)
      : 0.58;
    const negative = /(讨伐|罢免|黜|问罪|斥责|削爵|追责|征讨|平叛)/.test(combined);

    return { categories, regionIds, lordIds, efficiency, negative };
  }

  function detectRegions(text) {
    const matches = new Set();
    DATA.regions.forEach(region => {
      const terms = [region.name, region.capital, ...(REGION_ALIASES[region.id] || [])]
        .filter(term => typeof term === "string" && term.length >= 2);
      if (terms.some(term => text.includes(term))) matches.add(region.id);
    });
    return [...matches];
  }

  function detectLords(text) {
    const matches = new Set();
    DATA.lords.forEach(lord => {
      const terms = [lord.name, lord.seat].filter(term => typeof term === "string" && term.length >= 2);
      if (terms.some(term => text.includes(term))) matches.add(lord.id);
    });
    return [...matches];
  }

  function calculateRegionDelta(parsed) {
    const delta = { stability: 0, military: 0, courtAttitude: 0 };
    parsed.categories.forEach(category => {
      const map = {
        relief: { stability: 5, military: 0, courtAttitude: 3 },
        tax: { stability: 4, military: 0, courtAttitude: 2 },
        investigation: { stability: 2, military: 0, courtAttitude: 2 },
        military: { stability: -1, military: 4, courtAttitude: 1 },
        ritual: { stability: 1, military: 0, courtAttitude: 5 },
        secret: { stability: 0, military: 0, courtAttitude: 1 },
        appointment: { stability: 1, military: 0, courtAttitude: 3 },
        diplomacy: { stability: 1, military: 0, courtAttitude: 5 },
        appease: { stability: 1, military: 0, courtAttitude: 3 },
        generic: { stability: 0, military: 0, courtAttitude: 1 },
      }[category];
      addDelta(delta, map);
    });

    if (parsed.negative) {
      addDelta(delta, { stability: -2, military: 3, courtAttitude: -8 });
    }

    return scaleAndCap(delta, parsed.efficiency, {
      stability: [-8, 10],
      military: [-6, 10],
      courtAttitude: [-12, 12],
    });
  }

  function calculateLordDelta(parsed) {
    const delta = { power: 0, courtNeed: 0, expansion: 0, caution: 0 };
    parsed.categories.forEach(category => {
      const map = {
        relief: { power: 0, courtNeed: 2, expansion: 0, caution: 0 },
        tax: { power: 0, courtNeed: 2, expansion: 0, caution: 0 },
        investigation: { power: 0, courtNeed: 1, expansion: 0, caution: 2 },
        military: { power: 1, courtNeed: 0, expansion: 3, caution: 2 },
        ritual: { power: 0, courtNeed: 4, expansion: 0, caution: 0 },
        secret: { power: 0, courtNeed: 1, expansion: 0, caution: 5 },
        appointment: { power: 1, courtNeed: 5, expansion: 0, caution: 1 },
        diplomacy: { power: 0, courtNeed: 5, expansion: 0, caution: 1 },
        appease: { power: 0, courtNeed: 3, expansion: 0, caution: -2 },
        generic: { power: 0, courtNeed: 1, expansion: 0, caution: 0 },
      }[category];
      addDelta(delta, map);
    });

    if (parsed.negative) {
      addDelta(delta, { power: 0, courtNeed: -6, expansion: 3, caution: 6 });
    }

    return scaleAndCap(delta, parsed.efficiency, {
      power: [-5, 6],
      courtNeed: [-10, 12],
      expansion: [-6, 10],
      caution: [-8, 12],
    });
  }

  function addDelta(target, source) {
    if (!source) return;
    Object.entries(source).forEach(([key, value]) => {
      target[key] = (target[key] || 0) + value;
    });
  }

  function scaleAndCap(delta, efficiency, limits) {
    const factor = 0.55 + efficiency * 0.75;
    return Object.fromEntries(Object.entries(delta).map(([key, value]) => {
      if (!value) return [key, 0];
      const scaled = Math.sign(value) * Math.max(1, Math.round(Math.abs(value) * factor));
      const [minimum, maximum] = limits[key] || [-12, 12];
      return [key, clamp(scaled, minimum, maximum)];
    }));
  }

  function applyNumericChanges(target, delta) {
    const actual = {};
    Object.entries(delta).forEach(([key, value]) => {
      if (!value || !Number.isFinite(Number(target[key]))) return;
      const before = Number(target[key]);
      target[key] = clamp(before + value, 0, 100);
      const difference = Math.round(target[key] - before);
      if (difference !== 0) actual[key] = difference;
    });
    return actual;
  }

  function buildImpactSummary(regionChanges, lordChanges) {
    const parts = [];
    regionChanges.slice(0, 2).forEach(item => {
      parts.push(`${item.name}${formatChanges(item.changes, {
        stability: "稳定",
        military: "军压",
        courtAttitude: "朝廷态度",
      })}`);
    });
    lordChanges.slice(0, 2).forEach(item => {
      parts.push(`${item.name}${formatChanges(item.changes, {
        power: "实力",
        courtNeed: "名分需求",
        expansion: "扩张",
        caution: "戒备",
      })}`);
    });
    const omitted = Math.max(0, regionChanges.length + lordChanges.length - parts.length);
    return `${parts.join("；")}${omitted ? `；另有${omitted}项变化` : ""}`;
  }

  function formatChanges(changes, labels) {
    const text = Object.entries(changes)
      .map(([key, value]) => `${labels[key] || key}${value > 0 ? "+" : ""}${value}`)
      .join("、");
    return text ? `：${text}` : "";
  }

  function installImpactPanel(attempt) {
    if (document.getElementById("decree-world-impact")) return;
    const brief = document.getElementById("world-brief");
    if (!brief) {
      if (attempt < 8) window.setTimeout(() => installImpactPanel(attempt + 1), 80);
      return;
    }

    const panel = document.createElement("section");
    panel.id = "decree-world-impact";
    panel.className = "decree-world-impact hidden";
    panel.innerHTML = `
      <div class="decree-world-impact-head">
        <span>诏令落地</span>
        <strong id="decree-world-impact-title">尚无定向诏令</strong>
      </div>
      <p id="decree-world-impact-summary"></p>`;
    brief.appendChild(panel);
    renderLatestImpact();
  }

  function renderLatestImpact() {
    const panel = document.getElementById("decree-world-impact");
    const impact = extensionState?.history?.[0];
    if (!panel) return;
    if (!impact) {
      panel.classList.add("hidden");
      return;
    }

    panel.classList.remove("hidden");
    const title = panel.querySelector("#decree-world-impact-title");
    const summary = panel.querySelector("#decree-world-impact-summary");
    if (title) title.textContent = `${impact.date} · ${impact.title}`;
    if (summary) summary.textContent = impact.summary;
  }

  function showImpactToast(impact) {
    const container = document.getElementById("toast-container");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = "toast success decree-impact-toast";
    toast.textContent = `诏令已影响天下态势：${impact.summary}`;
    container.appendChild(toast);
    window.setTimeout(() => toast.remove(), 5200);
  }

  function loadExtensionState() {
    const state = safeParse(localStorage.getItem(EXTENSION_KEY));
    if (!state || typeof state !== "object") return null;
    return {
      version: VERSION,
      gameCreatedAt: state.gameCreatedAt || null,
      lastReportTimestamp: Number(state.lastReportTimestamp) || 0,
      history: Array.isArray(state.history) ? state.history : [],
      updatedAt: state.updatedAt || null,
    };
  }

  function createExtensionState(core) {
    return {
      version: VERSION,
      gameCreatedAt: core?.createdAt || null,
      lastReportTimestamp: getLatestTimestamp(core?.reports),
      history: [],
      updatedAt: new Date().toISOString(),
    };
  }

  function saveExtensionState() {
    if (!extensionState) return;
    try {
      localStorage.setItem(EXTENSION_KEY, JSON.stringify(extensionState));
    } catch (error) {
      console.warn("诏令天下扩展保存失败。", error);
    }
  }

  function getLatestTimestamp(reports) {
    if (!Array.isArray(reports) || reports.length === 0) return 0;
    return Math.max(0, ...reports.map(report => Number(report.timestamp) || 0));
  }

  function isValidCore(core) {
    return Boolean(core && typeof core === "object" && core.createdAt && Array.isArray(core.reports));
  }

  function isValidWorld(world, core) {
    return Boolean(
      world
      && typeof world === "object"
      && world.gameCreatedAt === core.createdAt
      && world.regions
      && world.lords
    );
  }

  function safeParse(raw) {
    if (!raw) return null;
    try {
      return JSON.parse(raw);
    } catch (_) {
      return null;
    }
  }

  function shorten(text, length) {
    const value = String(text || "");
    return value.length > length ? `${value.slice(0, length)}…` : value;
  }

  function clamp(value, minimum, maximum) {
    return Math.min(maximum, Math.max(minimum, Number(value) || 0));
  }

  window.XianDecreeWorld = Object.freeze({
    processCurrentSave: () => processCoreSave(localStorage.getItem(GAME_SAVE_KEY), 0),
    getState: () => extensionState ? JSON.parse(JSON.stringify(extensionState)) : null,
    detectTargets: text => ({ regions: detectRegions(String(text || "")), lords: detectLords(String(text || "")) }),
  });
})();
