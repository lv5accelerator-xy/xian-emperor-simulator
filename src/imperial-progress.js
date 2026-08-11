/* 天子蒙尘：献帝模拟器 v1.0.0 · 御前进程整合层 */
(() => {
  "use strict";

  const CORE_KEY = "xian_emperor_simulator_v01";
  const STORE_KEY = "xian_emperor_progression_v100";
  const DATA = window.XIAN_IMPERIAL_PROGRESS_DATA || { paths: [], arcs: [], themes: [] };
  const PATH_BADGES = {
    covert: { seal: "密诏铜印", title: "深宫执灯人" },
    balance: { seal: "合纵玉衡", title: "天下执衡者" },
    guard: { seal: "宿卫虎符", title: "宫门持钥人" },
  };
  const ARC_THRESHOLDS = [0.12, 0.36, 0.65];
  const TUTORIAL_PAGES = [
    {
      kicker: "第一步 · 先看本月",
      title: "每月只需先做三件事",
      text: "先裁决中央的本月奏报，再使用最多两次御前行动，最后结束本月。页面顶部的“本月要务”会始终标出下一步。",
    },
    {
      kicker: "第二步 · 选择方向",
      title: "方略不是额外负担",
      text: "选择潜结忠汉、借力制衡或掌控宿卫之一。方略会把现有的圣旨、政议和军团系统串成三个阶段，并给出明确目标。",
    },
    {
      kicker: "第三步 · 看懂危险",
      title: "红色数值不是越高越好",
      text: "曹氏警戒与泄密风险过高都会带来危机；宫廷安全、国库或汉室威望过低同样危险。简明界面会直接说明原因和建议。",
    },
    {
      kicker: "第四步 · 需要时再展开",
      title: "复杂系统都可以稍后处理",
      text: "默认使用简明视图。天下、军略、军团、政议仍可从顶部打开；点击“界面：简明”即可恢复完整仪表盘。",
    },
  ];

  let progress = loadProgress();
  let core = null;
  let focus = null;
  let overlay = null;
  let archiveTab = "path";
  let tutorialStep = 0;
  let syncQueued = false;
  let announcing = false;

  installStorageBridge();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();

  function defaultProfile() {
    return {
      tutorialSeen: false,
      viewMode: "focus",
      totalRuns: 0,
      seals: [],
      memories: [],
      endings: [],
      scenarios: [],
      completedPaths: [],
      titles: ["无名守灯人"],
      activeTitle: "无名守灯人",
      themes: ["ink"],
      activeTheme: "ink",
    };
  }

  function defaultSession(gameCreatedAt = null) {
    return {
      gameCreatedAt,
      pathId: null,
      pathStage: 0,
      lastUsedTurns: {},
      arcProgress: {},
      pendingArc: null,
      lastArcTurn: 0,
      lastSeenTurn: 0,
      turnActionBaseline: 0,
      endingCollected: false,
    };
  }

  function loadProgress() {
    try {
      const loaded = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
      if (!loaded || typeof loaded !== "object") return { version: 1, profile: defaultProfile(), session: defaultSession() };
      return {
        version: 1,
        profile: { ...defaultProfile(), ...(loaded.profile || {}) },
        session: { ...defaultSession(), ...(loaded.session || {}) },
      };
    } catch (_) {
      return { version: 1, profile: defaultProfile(), session: defaultSession() };
    }
  }

  function saveProgress() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(progress)); }
    catch (error) { console.warn("御前进程保存失败", error); }
  }

  function installStorageBridge() {
    const nativeSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function imperialProgressSetItem(key, value) {
      nativeSetItem.apply(this, arguments);
      if (!window.__xianFullSaveImporting && this === localStorage && key === CORE_KEY) queueSync();
    };
    window.addEventListener?.("storage", event => { if (event.key === CORE_KEY || event.key === STORE_KEY) queueSync(); });
    document.addEventListener("xian:core-saved", queueSync);
  }

  function queueSync() {
    if (syncQueued) return;
    syncQueued = true;
    const run = () => { syncQueued = false; syncFromCore(); };
    if (typeof queueMicrotask === "function") queueMicrotask(run);
    else setTimeout(run, 0);
  }

  function init() {
    installFocusPanel();
    installNavigation();
    installOverlay();
    bindInteractions();
    syncFromCore();
    applyPresentation();
  }

  function installFocusPanel() {
    if (document.getElementById("imperial-focus")) {
      focus = document.getElementById("imperial-focus");
      return;
    }
    focus = document.createElement("section");
    focus.id = "imperial-focus";
    focus.className = "imperial-focus hidden";
    focus.setAttribute("aria-label", "本月要务与御前方略");
    const danger = document.getElementById("danger-banner");
    danger?.insertAdjacentElement("afterend", focus);

    const brand = document.querySelector(".brand-lockup > div");
    if (brand && !document.getElementById("active-title-badge")) {
      const badge = document.createElement("span");
      badge.id = "active-title-badge";
      badge.className = "active-title-badge";
      brand.appendChild(badge);
    }
  }

  function installNavigation() {
    const nav = document.querySelector(".utility-nav");
    if (!nav || document.getElementById("imperial-archive-btn")) return;
    const archive = document.createElement("button");
    archive.id = "imperial-archive-btn";
    archive.type = "button";
    archive.textContent = "御前档案";
    const guide = document.createElement("button");
    guide.id = "imperial-guide-btn";
    guide.type = "button";
    guide.textContent = "引导";
    const view = document.createElement("button");
    view.id = "imperial-view-btn";
    view.type = "button";
    nav.insertBefore(archive, document.getElementById("help-btn") || null);
    nav.insertBefore(guide, document.getElementById("help-btn") || null);
    nav.insertBefore(view, document.getElementById("help-btn") || null);
  }

  function installOverlay() {
    if (document.getElementById("imperial-progress-overlay")) {
      overlay = document.getElementById("imperial-progress-overlay");
      return;
    }
    overlay = document.createElement("div");
    overlay.id = "imperial-progress-overlay";
    overlay.className = "imperial-progress-overlay hidden";
    document.body.appendChild(overlay);
  }

  function bindInteractions() {
    document.getElementById("imperial-archive-btn")?.addEventListener("click", () => openArchive("path"));
    document.getElementById("imperial-guide-btn")?.addEventListener("click", () => openTutorial(0));
    document.getElementById("imperial-view-btn")?.addEventListener("click", toggleViewMode);
    document.addEventListener("click", event => {
      const pathButton = event.target.closest?.("[data-path-select]");
      if (pathButton) return selectPath(pathButton.dataset.pathSelect);
      const actionButton = event.target.closest?.("[data-path-action]");
      if (actionButton) return usePathAction(actionButton.dataset.pathAction);
      if (event.target.closest?.("[data-open-arc]")) return openPendingArc();
      const arcChoice = event.target.closest?.("[data-arc-choice]");
      if (arcChoice) return resolveArcChoice(Number(arcChoice.dataset.arcChoice));
      const tab = event.target.closest?.("[data-archive-tab]");
      if (tab) { archiveTab = tab.dataset.archiveTab; renderArchive(); return; }
      const title = event.target.closest?.("[data-equip-title]");
      if (title) return equipTitle(title.dataset.equipTitle);
      const theme = event.target.closest?.("[data-equip-theme]");
      if (theme) return equipTheme(theme.dataset.equipTheme);
      if (event.target.closest?.("[data-imperial-close]")) return closeOverlay();
      const tutorial = event.target.closest?.("[data-tutorial-move]");
      if (tutorial) return moveTutorial(tutorial.dataset.tutorialMove);
      if (event.target === overlay) closeOverlay();
    });
    document.addEventListener("keydown", event => {
      if (event.key === "Escape" && overlay && !overlay.classList.contains("hidden")) closeOverlay();
    });
  }

  function readCore() {
    try {
      const value = JSON.parse(localStorage.getItem(CORE_KEY) || "null");
      return value && value.stats && value.hidden ? value : null;
    } catch (_) { return null; }
  }

  function syncFromCore() {
    const nextCore = readCore();
    if (!nextCore) {
      core = null;
      focus?.classList.add("hidden");
      applyPresentation();
      return;
    }

    core = nextCore;
    let changed = false;
    if (progress.session.gameCreatedAt !== core.createdAt) {
      progress.session = defaultSession(core.createdAt);
      progress.session.lastSeenTurn = Number(core.turn || 1);
      progress.session.turnActionBaseline = Number(core.totalActions || 0);
      progress.profile.totalRuns = Number(progress.profile.totalRuns || 0) + 1;
      changed = true;
      if (!progress.profile.tutorialSeen) setTimeout(() => openTutorial(0), 420);
    }

    if (progress.session.lastSeenTurn !== Number(core.turn || 0)) {
      progress.session.lastSeenTurn = Number(core.turn || 0);
      progress.session.turnActionBaseline = Number(core.totalActions || 0);
      changed = true;
    }

    if (evaluatePathMilestone()) changed = true;
    if (ensurePendingArc()) changed = true;
    if (updateCollections()) changed = true;
    if (changed) saveProgress();
    renderFocus();
    applyPresentation();
  }

  function selectPath(pathId) {
    if (!core || core.ended || progress.session.pathId) return;
    const path = getPath(pathId);
    if (!path) return;
    progress.session.pathId = path.id;
    progress.session.pathStage = 0;
    addUnique(progress.profile.seals, PATH_BADGES[path.id]?.seal);
    saveProgress();
    announce({
      report: { title: `御前方略·${path.name}`, text: `${path.summary} 当前目标：${path.stages[0].description}`, type: "important" },
      chronicle: `天子定御前方略为“${path.name}”，命近臣按三阶段推进。`,
    });
    renderFocus();
    showToast(`已选择方略：${path.name}`, "success");
  }

  function evaluatePathMilestone() {
    const path = getPath(progress.session.pathId);
    const stageIndex = Number(progress.session.pathStage || 0);
    if (!path || stageIndex >= path.stages.length || !core || core.ended) return false;
    const stage = path.stages[stageIndex];
    if (!stage.objectives.every(objective => objectiveComplete(objective))) return false;
    progress.session.pathStage = stageIndex + 1;
    addUnique(progress.profile.seals, `${path.name}·${stage.title}`);
    if (progress.session.pathStage >= path.stages.length) {
      addUnique(progress.profile.completedPaths, path.id);
      addUnique(progress.profile.titles, PATH_BADGES[path.id]?.title);
      addUnique(progress.profile.themes, "jade");
    }
    saveProgress();
    announce({
      report: { title: `方略进展·${stage.title}`, text: `${stage.description} ${stage.reward}。`, type: "important" },
      chronicle: `御前方略“${path.name}”完成阶段“${stage.title}”。`,
    });
    showToast(`方略阶段完成：${stage.title}`, "success");
    return true;
  }

  function objectiveValue(objective) {
    if (!core) return 0;
    if (objective.source === "stats") return Number(core.stats?.[objective.key] || 0);
    if (objective.source === "hidden") return Number(core.hidden?.[objective.key] || 0);
    return Number(core[objective.key] || 0);
  }

  function objectiveComplete(objective) {
    const value = objectiveValue(objective);
    return objective.mode === "max" ? value <= objective.target : value >= objective.target;
  }

  function usePathAction(actionId) {
    if (!core || core.ended) return;
    const path = getPath(progress.session.pathId);
    if (!path) return;
    const unlockedStages = path.stages.slice(0, Number(progress.session.pathStage || 0));
    const stage = unlockedStages.find(item => item.action?.id === actionId);
    const action = stage?.action;
    if (!action) return;
    const lastTurn = Number(progress.session.lastUsedTurns?.[action.id] || -99);
    if (Number(core.turn || 0) - lastTurn < action.cooldown) {
      showToast(`“${action.name}”尚在整备，本次不可重复使用。`, "warning");
      return;
    }
    const applied = window.XianEmperorGame?.performExternalAction?.({
      title: `方略·${action.name}`,
      text: action.description,
      chronicle: `天子依“${path.name}”方略施行${action.name}。`,
      effects: action.effects,
      hidden: action.hidden,
      relations: action.relations,
    });
    if (!applied) return;
    progress.session.lastUsedTurns[action.id] = Number(core.turn || 0);
    saveProgress();
    showToast(`已施行：${action.name}`, "success");
    queueSync();
  }

  function ensurePendingArc() {
    if (!core || core.ended || progress.session.pendingArc || !progress.session.pathId) return false;
    if (Number(progress.session.lastArcTurn || 0) === Number(core.turn || 0)) return false;
    const fraction = Number(core.turn || 1) / Math.max(1, Number(core.maxTurns || 24));
    const candidates = orderedArcsForPath(progress.session.pathId).filter(arc => {
      const arcState = arcStateFor(arc.id);
      return arcState.stage < arc.chapters.length && fraction >= ARC_THRESHOLDS[arcState.stage];
    });
    const arc = candidates[0];
    if (!arc) return false;
    progress.session.pendingArc = { arcId: arc.id, chapterIndex: arcStateFor(arc.id).stage };
    return true;
  }

  function orderedArcsForPath(pathId) {
    const priority = {
      covert: ["empress_fu", "dong_cheng", "yang_biao", "xun_yu", "cao_cao"],
      balance: ["xun_yu", "yang_biao", "cao_cao", "empress_fu", "dong_cheng"],
      guard: ["cao_cao", "xun_yu", "empress_fu", "yang_biao", "dong_cheng"],
    }[pathId] || [];
    return priority.map(id => getArc(id)).filter(Boolean);
  }

  function arcStateFor(id) {
    if (!progress.session.arcProgress[id]) progress.session.arcProgress[id] = { stage: 0, affinity: 0, choices: [] };
    return progress.session.arcProgress[id];
  }

  function openPendingArc() {
    const pending = progress.session.pendingArc;
    const arc = getArc(pending?.arcId);
    const chapter = arc?.chapters?.[pending?.chapterIndex];
    if (!arc || !chapter || !overlay) return;
    overlay.innerHTML = `
      <section class="imperial-dialog arc-dialog" role="dialog" aria-modal="true" aria-labelledby="arc-dialog-title">
        <header><div><span class="imperial-kicker">人物事件 · ${escapeHtml(arc.title)}</span><h2 id="arc-dialog-title">${escapeHtml(chapter.title)}</h2></div><button type="button" data-imperial-close aria-label="关闭">×</button></header>
        <div class="imperial-dialog-body"><div class="arc-intro"><span>${escapeHtml(arc.portrait)}</span><div><strong>${escapeHtml(arc.name)}</strong><p>${escapeHtml(chapter.text)}</p></div></div><div class="arc-choices">${chapter.choices.map((choice, index) => `<button type="button" data-arc-choice="${index}"><strong>${escapeHtml(choice.label)}</strong><span>${escapeHtml(choice.hint)}</span></button>`).join("")}</div></div>
      </section>`;
    overlay.classList.remove("hidden");
    document.body.classList.add("imperial-overlay-open");
  }

  function resolveArcChoice(choiceIndex) {
    const pending = progress.session.pendingArc;
    const arc = getArc(pending?.arcId);
    const chapter = arc?.chapters?.[pending?.chapterIndex];
    const choice = chapter?.choices?.[choiceIndex];
    if (!arc || !chapter || !choice || !core || core.ended) return;
    const arcState = arcStateFor(arc.id);
    arcState.stage += 1;
    arcState.affinity = Number(arcState.affinity || 0) + Number(choice.affinity || 0);
    arcState.choices.push(choiceIndex);
    progress.session.pendingArc = null;
    progress.session.lastArcTurn = Number(core.turn || 0);
    if (arcState.stage >= arc.chapters.length) {
      addUnique(progress.profile.memories, arc.memory);
      if (arcState.affinity >= 1) addUnique(progress.profile.titles, arc.goodTitle);
      addUnique(progress.profile.themes, "jade");
    }
    saveProgress();
    closeOverlay();
    announce({
      effects: choice.effects,
      hidden: choice.hidden,
      relations: choice.relations,
      report: { title: `${arc.name}·${chapter.title}`, text: choice.chronicle, type: "decision" },
      chronicle: choice.chronicle,
    });
    showToast(`${arc.name}事件已记入史册。`, "success");
    queueSync();
  }

  function updateCollections() {
    if (!core) return false;
    let changed = false;
    if (progress.session.pathId) changed = addUnique(progress.profile.seals, PATH_BADGES[progress.session.pathId]?.seal) || changed;
    for (const arc of DATA.arcs) {
      const arcState = progress.session.arcProgress?.[arc.id];
      if (Number(arcState?.stage || 0) >= arc.chapters.length) {
        changed = addUnique(progress.profile.memories, arc.memory) || changed;
        if (Number(arcState.affinity || 0) >= 1) changed = addUnique(progress.profile.titles, arc.goodTitle) || changed;
      }
    }
    if (core.ended && core.ending && !progress.session.endingCollected) {
      progress.session.endingCollected = true;
      changed = addUnique(progress.profile.endings, core.ending.title) || changed;
      changed = addUnique(progress.profile.scenarios, core.scenarioId || "jianan_196") || changed;
      if (progress.profile.endings.length >= 3) changed = addUnique(progress.profile.themes, "frost") || changed;
    }
    return changed;
  }

  function renderFocus() {
    if (!focus || !core) return;
    focus.classList.toggle("hidden", Boolean(core.ended));
    if (core.ended) return;
    const path = getPath(progress.session.pathId);
    if (!path) {
      focus.innerHTML = `
        <div class="focus-heading"><div><span class="imperial-kicker">v0.8.0 · 御前方略</span><h2>这一局，你准备依靠什么保存汉廷？</h2></div><small>选择后不可更改；它只整理现有玩法，不增加新货币。</small></div>
        <div class="path-selection">${DATA.paths.map(item => `<button type="button" data-path-select="${item.id}"><span class="path-seal">${item.icon}</span><strong>${escapeHtml(item.name)}</strong><p>${escapeHtml(item.summary)}</p><small>风险：${escapeHtml(item.risk)}</small></button>`).join("")}</div>`;
      return;
    }

    const stageIndex = Number(progress.session.pathStage || 0);
    const stage = path.stages[stageIndex];
    const tasks = monthlyTasks(path, stage);
    const pending = progress.session.pendingArc;
    const pendingArc = getArc(pending?.arcId);
    const pendingChapter = pendingArc?.chapters?.[pending?.chapterIndex];
    const actions = path.stages.slice(0, stageIndex).map(item => item.action).filter(Boolean);
    focus.innerHTML = `
      <div class="focus-heading"><div><span class="imperial-kicker">当前方略 · ${escapeHtml(path.name)}</span><h2>${stage ? escapeHtml(stage.title) : "三阶段方略已经完成"}</h2></div><button type="button" data-open-archive="path" class="focus-link">进度 ${stageIndex} / 3</button></div>
      <div class="focus-layout">
        <section class="monthly-brief"><h3>本月要务</h3>${tasks.map(task => `<div class="monthly-task ${task.done ? "done" : ""}"><span>${task.done ? "✓" : "○"}</span><div><strong>${escapeHtml(task.label)}</strong><small>${escapeHtml(task.detail)}</small></div></div>`).join("")}<p class="recommendation"><b>建议</b>${escapeHtml(buildRecommendation(path))}</p></section>
        <section class="path-stage"><div class="stage-track">${path.stages.map((item, index) => `<span class="${index < stageIndex ? "done" : index === stageIndex ? "active" : ""}">${index + 1}</span>`).join("")}</div>${stage ? `<p>${escapeHtml(stage.description)}</p><div class="objective-list">${stage.objectives.map(objective => `<div class="${objectiveComplete(objective) ? "done" : ""}"><span>${objectiveComplete(objective) ? "✓" : "○"}</span><strong>${escapeHtml(objective.label)}</strong><small>当前 ${Math.round(objectiveValue(objective))}</small></div>`).join("")}</div><small class="stage-reward">完成奖励：${escapeHtml(stage.reward)}</small>` : `<div class="path-complete"><strong>方略已成</strong><p>专属终局与青玉朝仪外观已经解锁。</p></div>`}</section>
        <section class="focus-actions"><h3>方略行动</h3>${actions.length ? actions.map(action => renderPathAction(action)).join("") : '<p class="empty-copy">完成第一个阶段后解锁专属行动。</p>'}${pendingArc && pendingChapter ? `<button type="button" class="arc-callout" data-open-arc><span>${escapeHtml(pendingArc.portrait)}</span><div><strong>${escapeHtml(pendingArc.name)}来信</strong><small>${escapeHtml(pendingChapter.title)} · 等候御览</small></div></button>` : ""}</section>
      </div>`;
    focus.querySelector("[data-open-archive]")?.addEventListener("click", () => openArchive("path"));
  }

  function monthlyTasks(path, stage) {
    const actionsThisTurn = Math.max(0, Number(core.totalActions || 0) - Number(progress.session.turnActionBaseline || 0));
    const taskList = [
      { label: "裁决本月奏报", detail: core.eventResolved ? "已裁决，可以施行政令" : "先处理中央奏报的三项选择", done: Boolean(core.eventResolved) },
      { label: "完成一次御前行动", detail: actionsThisTurn ? `本月已执行 ${actionsThisTurn} 次` : "可使用常用行动、圣旨或方略行动", done: actionsThisTurn > 0 },
    ];
    if (stage) {
      const objective = stage.objectives.find(item => !objectiveComplete(item)) || stage.objectives[0];
      taskList.push({ label: objective.label, detail: `方略阶段“${stage.title}”`, done: objectiveComplete(objective) });
    } else taskList.push({ label: "保持方略成果", detail: "控制风险并争取专属终局", done: true });
    return taskList;
  }

  function buildRecommendation(path) {
    if (!core.eventResolved) return "先裁决本月奏报，其他行动随后才会开放。";
    if (core.stats.caoAlert >= 78) return "曹氏警戒偏高，优先安抚外府或避免高风险密令。";
    if (core.stats.security <= 30) return "宫廷安全不足，优先整饬宫门、召见近臣或采取守成选择。";
    if (core.stats.treasury <= 20) return "国库吃紧，暂缓赈济、仪典和高消耗方略行动。";
    if (core.hidden.leakRisk >= 62) return "泄密风险已高，先清理耳目，不要继续扩张密线。";
    if (progress.session.pendingArc) return "有一封人物来信等候御览，它不会消耗本月行动次数。";
    return path.recommendation;
  }

  function renderPathAction(action) {
    const lastTurn = Number(progress.session.lastUsedTurns?.[action.id] || -99);
    const remaining = Math.max(0, action.cooldown - (Number(core.turn || 0) - lastTurn));
    const disabled = remaining > 0 || !core.eventResolved || core.actionPoints <= 0;
    return `<button type="button" data-path-action="${action.id}" ${disabled ? "disabled" : ""}><strong>${escapeHtml(action.name)}</strong><small>${remaining ? `整备还需 ${remaining} 月` : escapeHtml(action.description)}</small></button>`;
  }

  function openArchive(tab = "path") {
    archiveTab = tab;
    renderArchive();
    overlay?.classList.remove("hidden");
    document.body.classList.add("imperial-overlay-open");
  }

  function renderArchive() {
    if (!overlay) return;
    overlay.innerHTML = `
      <section class="imperial-dialog archive-dialog" role="dialog" aria-modal="true" aria-labelledby="archive-title">
        <header><div><span class="imperial-kicker">跨局御前档案</span><h2 id="archive-title">史册、人物与收藏</h2></div><button type="button" data-imperial-close aria-label="关闭">×</button></header>
        <nav class="archive-tabs"><button type="button" data-archive-tab="path" class="${archiveTab === "path" ? "active" : ""}">方略</button><button type="button" data-archive-tab="characters" class="${archiveTab === "characters" ? "active" : ""}">人物</button><button type="button" data-archive-tab="collection" class="${archiveTab === "collection" ? "active" : ""}">收藏</button></nav>
        <div class="imperial-dialog-body">${archiveTab === "characters" ? renderCharacterArchive() : archiveTab === "collection" ? renderCollectionArchive() : renderPathArchive()}</div>
      </section>`;
  }

  function renderPathArchive() {
    const active = getPath(progress.session.pathId);
    return `<div class="archive-summary"><article><span>累计开局</span><strong>${Number(progress.profile.totalRuns || 0)}</strong></article><article><span>完成方略</span><strong>${progress.profile.completedPaths.length} / 3</strong></article><article><span>收录终局</span><strong>${progress.profile.endings.length}</strong></article></div><div class="archive-paths">${DATA.paths.map(path => { const complete = progress.profile.completedPaths.includes(path.id); const current = active?.id === path.id; return `<article class="${complete ? "complete" : ""}"><span class="path-seal">${path.icon}</span><div><strong>${escapeHtml(path.name)}${current ? " · 本局" : ""}</strong><p>${escapeHtml(path.summary)}</p><small>${complete ? "✓ 已完成并解锁专属终局" : current ? `本局进度 ${progress.session.pathStage} / 3` : "尚未完成"}</small></div></article>`; }).join("")}</div>`;
  }

  function renderCharacterArchive() {
    return `<div class="character-archive">${DATA.arcs.map(arc => { const state = progress.session.arcProgress?.[arc.id] || { stage: 0, affinity: 0 }; const collected = progress.profile.memories.includes(arc.memory); return `<article class="${collected ? "complete" : ""}"><span>${escapeHtml(arc.portrait)}</span><div><strong>${escapeHtml(arc.name)}｜${escapeHtml(arc.title)}</strong><p>${state.stage} / ${arc.chapters.length} 章 · 本局倾向 ${Number(state.affinity || 0) >= 1 ? "同道" : Number(state.affinity || 0) < 0 ? "疏离" : "未定"}</p><small>${collected ? `已收藏：${escapeHtml(arc.memory)}` : `完成后收藏：${escapeHtml(arc.memory)}`}</small></div></article>`; }).join("")}</div>`;
  }

  function renderCollectionArchive() {
    const themeCards = DATA.themes.map(theme => { const unlocked = progress.profile.themes.includes(theme.id); return `<button type="button" data-equip-theme="${theme.id}" ${unlocked ? "" : "disabled"} class="${progress.profile.activeTheme === theme.id ? "active" : ""}"><strong>${escapeHtml(theme.name)}</strong><small>${unlocked ? progress.profile.activeTheme === theme.id ? "使用中" : "点击使用" : escapeHtml(theme.requirement)}</small></button>`; }).join("");
    return `<section class="collection-section"><h3>称号</h3><div class="equip-grid">${progress.profile.titles.map(title => `<button type="button" data-equip-title="${escapeHtml(title)}" class="${progress.profile.activeTitle === title ? "active" : ""}"><strong>${escapeHtml(title)}</strong><small>${progress.profile.activeTitle === title ? "使用中" : "点击佩戴"}</small></button>`).join("")}</div></section><section class="collection-section"><h3>朝仪外观</h3><div class="equip-grid">${themeCards}</div></section><section class="collection-section"><h3>印章与遗物</h3><div class="token-grid">${[...progress.profile.seals, ...progress.profile.memories].map(item => `<span>${escapeHtml(item)}</span>`).join("") || "<small>尚无收藏。</small>"}</div></section><section class="collection-section"><h3>已见终局</h3><div class="token-grid">${progress.profile.endings.map(item => `<span>${escapeHtml(item)}</span>`).join("") || "<small>完成一局后开始记录。</small>"}</div></section>`;
  }

  function equipTitle(title) {
    if (!progress.profile.titles.includes(title)) return;
    progress.profile.activeTitle = title;
    saveProgress();
    applyPresentation();
    renderArchive();
  }

  function equipTheme(themeId) {
    if (!progress.profile.themes.includes(themeId)) return;
    progress.profile.activeTheme = themeId;
    saveProgress();
    applyPresentation();
    renderArchive();
  }

  function toggleViewMode() {
    progress.profile.viewMode = progress.profile.viewMode === "focus" ? "full" : "focus";
    saveProgress();
    applyPresentation();
    showToast(progress.profile.viewMode === "focus" ? "已切换为简明视图。" : "已展开完整仪表盘。", "success");
  }

  function applyPresentation() {
    const shell = document.getElementById("game-shell");
    shell?.classList.toggle("focus-view", progress.profile.viewMode === "focus");
    const viewButton = document.getElementById("imperial-view-btn");
    if (viewButton) {
      viewButton.textContent = progress.profile.viewMode === "focus" ? "界面：简明" : "界面：完整";
      viewButton.title = progress.profile.viewMode === "focus" ? "当前隐藏次要仪表盘，点击展开" : "当前显示全部仪表盘，点击简化";
    }
    document.body.dataset.courtTheme = progress.profile.activeTheme || "ink";
    const badge = document.getElementById("active-title-badge");
    if (badge) badge.textContent = progress.profile.activeTitle || "无名守灯人";
  }

  function openTutorial(step = 0) {
    if (!overlay) return;
    tutorialStep = Math.max(0, Math.min(TUTORIAL_PAGES.length - 1, step));
    const page = TUTORIAL_PAGES[tutorialStep];
    overlay.innerHTML = `<section class="imperial-dialog tutorial-dialog" role="dialog" aria-modal="true" aria-labelledby="tutorial-title"><header><div><span class="imperial-kicker">${escapeHtml(page.kicker)}</span><h2 id="tutorial-title">${escapeHtml(page.title)}</h2></div><button type="button" data-tutorial-move="skip" aria-label="关闭">×</button></header><div class="imperial-dialog-body"><div class="tutorial-emblem">汉</div><p>${escapeHtml(page.text)}</p><div class="tutorial-dots">${TUTORIAL_PAGES.map((_, index) => `<span class="${index === tutorialStep ? "active" : ""}"></span>`).join("")}</div></div><footer>${tutorialStep ? '<button type="button" class="secondary-button" data-tutorial-move="back">上一步</button>' : '<button type="button" class="secondary-button" data-tutorial-move="skip">跳过</button>'}<button type="button" class="primary-button" data-tutorial-move="next">${tutorialStep === TUTORIAL_PAGES.length - 1 ? "开始临朝" : "下一步"}</button></footer></section>`;
    overlay.classList.remove("hidden");
    document.body.classList.add("imperial-overlay-open");
  }

  function moveTutorial(direction) {
    if (direction === "back") return openTutorial(tutorialStep - 1);
    if (direction === "next" && tutorialStep < TUTORIAL_PAGES.length - 1) return openTutorial(tutorialStep + 1);
    progress.profile.tutorialSeen = true;
    saveProgress();
    closeOverlay();
  }

  function closeOverlay() {
    overlay?.classList.add("hidden");
    document.body.classList.remove("imperial-overlay-open");
  }

  function getPath(id) { return DATA.paths.find(item => item.id === id) || null; }
  function getArc(id) { return DATA.arcs.find(item => item.id === id) || null; }

  function getPathEnding(gameState) {
    const path = getPath(progress.session.pathId);
    if (!path || progress.session.pathStage < path.stages.length || progress.session.gameCreatedAt !== gameState?.createdAt) return null;
    const s = gameState.stats || {};
    const h = gameState.hidden || {};
    const qualified = path.id === "covert"
      ? h.loyalNetwork >= 58 && s.security >= 30 && s.caoAlert < 98
      : path.id === "balance"
        ? h.externalBalance >= 60 && s.prestige >= 62
        : s.authority >= 62 && s.security >= 52;
    return qualified ? { ...path.ending } : null;
  }

  function announce(pkg) {
    if (announcing || !window.XianEmperorGame?.applyExternalPackage) return;
    announcing = true;
    try { window.XianEmperorGame.applyExternalPackage(pkg); }
    finally { announcing = false; }
  }

  function addUnique(array, value) {
    if (!value || array.includes(value)) return false;
    array.push(value);
    return true;
  }

  function showToast(message, type = "neutral") {
    const container = document.getElementById("toast-container");
    if (!container) return;
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add("show"));
    setTimeout(() => { toast.classList.remove("show"); setTimeout(() => toast.remove(), 250); }, 2600);
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  window.XianImperialProgress = Object.freeze({
    getPathEnding,
    getState: () => JSON.parse(JSON.stringify(progress)),
    sync: syncFromCore,
    data: DATA,
  });
})();
