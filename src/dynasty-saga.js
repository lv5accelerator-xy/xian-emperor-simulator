/* 天子蒙尘：献帝模拟器 v2.0.0 · 汉祚长卷 */
(() => {
  "use strict";

  const CORE_KEY = "xian_emperor_simulator_v01";
  const STORE_KEY = "xian_emperor_dynasty_saga_v200";
  const CHAPTERS = ["zhongping_189", "xingping_195", "jianan_196", "jianan_200", "yankang_220"];
  const LEGACIES = {
    ritual: { id: "ritual", name: "朝仪余响", text: "前朝留下的礼法经验让百官更快恢复秩序。", effects: { prestige: 3, officials: 3, caoAlert: 1 } },
    balance: { id: "balance", name: "诸侯旧盟", text: "外镇记得朝廷曾经守信，制衡更容易建立。", effects: { prestige: 2, caoAlert: 1 }, hidden: { externalBalance: 4 } },
    covert: { id: "covert", name: "衣带暗线", text: "旧日忠汉网络尚有余脉，但秘密也带来风险。", effects: { authority: 2 }, hidden: { loyalNetwork: 4, leakRisk: 2 } },
    people: { id: "people", name: "民间口碑", text: "百姓仍传颂旧日赈济，乱局中的秩序恢复更快。", effects: { prestige: 2, treasury: 3 }, hidden: { peopleStability: 4 } },
    survival: { id: "survival", name: "宫禁旧制", text: "一次次危局留下了谨慎守成的经验。", effects: { security: 4, authority: -1, caoAlert: -1 } },
    scar: { id: "scar", name: "败局余烬", text: "前章的失败削弱了朝廷体面，也让残存忠臣更加警醒。", effects: { prestige: -3, security: -2 }, hidden: { loyalNetwork: 2, leakRisk: 1 } },
  };

  let profile = loadProfile();
  let finishing = false;

  document.addEventListener("DOMContentLoaded", init, { once: true });
  document.addEventListener("xian:campaign-concluded", event => concludeChapter(event.detail || {}));

  function init() {
    installLauncher();
    const scenarioSelect = document.getElementById("scenario-select");
    if (scenarioSelect) {
      if (profile.active) {
        scenarioSelect.value = CHAPTERS[profile.currentIndex] || CHAPTERS[0];
        scenarioSelect.dispatchEvent(new Event("change", { bubbles: true }));
      }
      scenarioSelect.disabled = Boolean(profile.active);
    }
    window.XianCommandCenter?.registerTab?.({
      id: "saga",
      label: "汉祚长卷",
      kicker: "v2.0.0 · 连续战役",
      title: "五段危局，一卷汉祚",
      render: renderTab,
      onMount: mountTab,
    });
    if (profile.active && profile.pendingScenarioId) setTimeout(applyPendingLegacy, 120);
  }

  function installLauncher() {
    const copy = document.querySelector("#start-screen .start-copy");
    const scenarioLabel = copy?.querySelector('label[for="scenario-select"]');
    if (!copy || !scenarioLabel || document.getElementById("saga-launcher")) return;
    const launcher = document.createElement("section");
    launcher.id = "saga-launcher";
    launcher.className = "saga-launcher";
    launcher.innerHTML = renderLauncher();
    scenarioLabel.before(launcher);
    bindLauncher(launcher);
  }

  function renderLauncher() {
    const completed = profile.chapters.filter(item => item.completed).length;
    if (profile.active && completed < CHAPTERS.length) {
      const chapter = scenarioById(CHAPTERS[profile.currentIndex]);
      return `<div><span>连续大战役 · ${completed} / ${CHAPTERS.length}</span><strong>汉祚长卷正在进行</strong><p>下一章：${escapeHtml(chapter?.name || "历史危局")}。历史印记会小幅影响开局。</p></div><button type="button" data-saga-launch="continue">继续长卷</button><button type="button" data-saga-launch="abandon" class="saga-text-button">改玩单章</button>`;
    }
    if (profile.completedAt) {
      return `<div><span>连续大作战</span><strong>汉祚长卷已经入史</strong><p>上次完成 ${profile.chapters.length} 章，总评 ${profile.finalScore || 0}。可再次挑战不同路线。</p></div><button type="button" data-saga-launch="new">重启长卷</button>`;
    }
    return `<div><span>v2.0.0 连续大作战</span><strong>汉祚长卷</strong><p>依次经历 189、195、196、200 与 220 年。前章只留下有限历史印记，不会滚雪球。</p></div><button type="button" data-saga-launch="new">开始长卷</button>`;
  }

  function bindLauncher(root) {
    root.querySelectorAll("[data-saga-launch]").forEach(button => button.addEventListener("click", () => {
      const action = button.dataset.sagaLaunch;
      if (action === "new") beginSaga();
      else if (action === "continue") continueSaga();
      else if (action === "abandon") abandonSaga();
    }));
  }

  function beginSaga() {
    profile = defaultProfile();
    profile.active = true;
    profile.startedAt = new Date().toISOString();
    saveProfile();
    startChapter(0);
  }

  function continueSaga() {
    if (!profile.active) return beginSaga();
    const core = readCore();
    const expectedScenario = CHAPTERS[profile.currentIndex];
    if (core && !core.ended && core.scenarioId === expectedScenario) {
      document.getElementById("continue-game-btn")?.click();
      return;
    }
    startChapter(profile.currentIndex);
  }

  function abandonSaga() {
    profile.active = false;
    profile.pendingScenarioId = null;
    saveProfile();
    refreshLauncher();
  }

  function startChapter(index) {
    const scenarioId = CHAPTERS[index];
    if (!scenarioId) return finishSaga();
    profile.active = true;
    profile.currentIndex = index;
    profile.pendingScenarioId = scenarioId;
    saveProfile();
    const select = document.getElementById("scenario-select");
    if (select) {
      select.value = scenarioId;
      select.dispatchEvent(new Event("change", { bubbles: true }));
      select.disabled = true;
    }
    document.getElementById("difficulty-select").value = "standard";
    document.getElementById("new-game-btn")?.click();
    setTimeout(applyPendingLegacy, 90);
  }

  function applyPendingLegacy() {
    if (!profile.active || !profile.pendingScenarioId) return;
    const core = readCore();
    if (!core || core.ended || core.scenarioId !== profile.pendingScenarioId) return;
    if (profile.chapterGameIds.includes(core.createdAt)) {
      profile.pendingScenarioId = null;
      saveProfile();
      return;
    }
    profile.chapterGameIds.push(core.createdAt);
    const inherited = combineLegacies(profile.legacies.slice(-3));
    profile.pendingScenarioId = null;
    saveProfile();
    if (!profile.legacies.length) return;
    const names = profile.legacies.slice(-3).map(item => LEGACIES[item.id]?.name).filter(Boolean);
    window.XianEmperorGame?.applyExternalPackage?.({
      ...inherited,
      report: { title: "长卷继承", text: `${names.join("、")}随车驾进入本章。`, type: "important" },
      chronicle: `前章留下的${names.join("、")}影响了新的开局。`,
    });
  }

  function concludeChapter(detail) {
    if (!profile.active || finishing) return;
    const game = detail.state;
    const expected = CHAPTERS[profile.currentIndex];
    if (!game?.createdAt || game.scenarioId !== expected || profile.chapters.some(item => item.gameCreatedAt === game.createdAt)) return;
    const route = window.XianHistorian?.classifyRoute?.(game) || { id: "survival", name: "乱世存续" };
    const failed = isFailureEnding(game.ending?.title);
    const legacy = failed ? LEGACIES.scar : (LEGACIES[route.id] || LEGACIES.survival);
    const completedIndex = profile.currentIndex;
    profile.chapters.push({
      index: completedIndex,
      scenarioId: game.scenarioId,
      scenarioName: detail.scenario?.name || game.scenarioId,
      gameCreatedAt: game.createdAt,
      ending: game.ending?.title || "未结算",
      routeId: route.id,
      routeName: route.name,
      score: Number(detail.score || 0),
      challengeCompleted: Boolean(detail.challenge?.completed),
      legacyId: legacy.id,
      completed: true,
    });
    profile.legacies.push({ id: legacy.id, sourceScenarioId: game.scenarioId, sourceEnding: game.ending?.title || "未结算" });
    if (completedIndex >= CHAPTERS.length - 1) {
      saveProfile();
      finishSaga();
    } else {
      profile.currentIndex = completedIndex + 1;
      saveProfile();
      installContinueButton();
    }
    window.XianCommandCenter?.refresh?.();
  }

  function installContinueButton() {
    setTimeout(() => {
      const actions = document.querySelector(".ending-actions");
      if (!actions || actions.querySelector("[data-saga-next]")) return;
      const next = scenarioById(CHAPTERS[profile.currentIndex]);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "primary-button saga-next-button";
      button.dataset.sagaNext = "true";
      button.textContent = `续写长卷：${next?.startYear || "下一章"}`;
      button.addEventListener("click", () => startChapter(profile.currentIndex));
      actions.appendChild(button);
    }, 40);
  }

  function finishSaga() {
    finishing = true;
    profile.active = false;
    profile.pendingScenarioId = null;
    profile.completedAt = new Date().toISOString();
    profile.finalScore = profile.chapters.reduce((sum, item) => sum + Number(item.score || 0), 0);
    profile.finalTitle = sagaTitle(profile);
    saveProfile();
    setTimeout(() => {
      const scroll = document.querySelector("#end-screen .ending-scroll");
      if (scroll && !scroll.querySelector(".saga-final-scroll")) {
        const final = document.createElement("section");
        final.className = "saga-final-scroll";
        final.innerHTML = `<span>汉祚长卷 · 五章终卷</span><h2>${escapeHtml(profile.finalTitle)}</h2><p>${escapeHtml(sagaSummary(profile))}</p><div>${profile.chapters.map(item => `<article><b>${escapeHtml(item.scenarioName)}</b><strong>${escapeHtml(item.ending)}</strong><small>${escapeHtml(LEGACIES[item.legacyId]?.name || "历史印记")}</small></article>`).join("")}</div><button type="button" data-saga-open-summary>查看完整长卷</button>`;
        scroll.querySelector(".ending-actions")?.before(final);
        final.querySelector("[data-saga-open-summary]")?.addEventListener("click", () => {
          document.getElementById("end-screen")?.classList.add("hidden");
          window.XianCommandCenter?.open?.("saga");
        });
      }
      refreshLauncher();
      finishing = false;
    }, 60);
  }

  function sagaTitle(value) {
    const completedChallenges = value.chapters.filter(item => item.challengeCompleted).length;
    const scars = value.legacies.filter(item => item.id === "scar").length;
    if (completedChallenges >= 4 && scars === 0) return "汉统未坠，五世成卷";
    if (completedChallenges >= 3) return "风雨五章，正朔犹存";
    if (scars >= 3) return "山河屡折，史笔不绝";
    return "兴亡有迹，汉祚成书";
  }

  function sagaSummary(value) {
    const routes = [...new Set(value.chapters.map(item => item.routeName))];
    return `从洛阳孤灯至禅代前夜，你完成了 ${value.chapters.length} 段历史危局，走过${routes.join("、")}等道路。长卷总评 ${value.finalScore}，每一章的得失都在后一章留下有限而真实的回声。`;
  }

  function renderTab() {
    const chapters = CHAPTERS.map((id, index) => {
      const scenario = scenarioById(id);
      const result = profile.chapters.find(item => item.scenarioId === id);
      const current = profile.active && index === profile.currentIndex;
      return `<article class="saga-chapter ${result ? "complete" : current ? "current" : "locked"}"><div><span>${scenario?.startYear || "—"}</span><i></i></div><section><small>第 ${index + 1} 章</small><strong>${escapeHtml(scenario?.name || id)}</strong><p>${result ? `${escapeHtml(result.ending)} · ${escapeHtml(result.routeName)}` : current ? "正在书写" : "尚未抵达"}</p>${result ? `<b>留下：${escapeHtml(LEGACIES[result.legacyId]?.name || "历史印记")}</b>` : ""}</section></article>`;
    }).join("");
    const legacyList = profile.legacies.map(item => LEGACIES[item.id]).filter(Boolean);
    return `
      <div class="saga-overview"><div><span>${profile.completedAt ? "长卷已完成" : profile.active ? "长卷进行中" : "尚未开始"}</span><strong>${profile.finalTitle || `${profile.chapters.length} / ${CHAPTERS.length} 章`}</strong></div><p>${profile.completedAt ? sagaSummary(profile) : "每章按自身规则重新开局，只继承最近三项小幅历史印记，避免数值滚雪球。"}</p></div>
      <div class="saga-timeline">${chapters}</div>
      <section class="saga-legacies"><h3>历史印记</h3>${legacyList.length ? legacyList.map(item => `<article><span>${item.name}</span><p>${item.text}</p></article>`).join("") : '<p>完成第一章后才会形成印记。</p>'}</section>
      <div class="saga-tab-actions">${profile.active ? '<button type="button" data-saga-tab-action="continue">继续当前长卷</button>' : '<button type="button" data-saga-tab-action="new">开始一轮新长卷</button>'}</div>`;
  }

  function mountTab(root) {
    root.querySelectorAll("[data-saga-tab-action]").forEach(button => button.addEventListener("click", () => {
      window.XianCommandCenter?.close?.();
      button.dataset.sagaTabAction === "continue" ? continueSaga() : beginSaga();
    }));
  }

  function combineLegacies(items) {
    const output = { effects: {}, hidden: {} };
    items.forEach(item => {
      const template = LEGACIES[item.id];
      for (const group of ["effects", "hidden"]) Object.entries(template?.[group] || {}).forEach(([key, delta]) => {
        output[group][key] = Math.max(-8, Math.min(8, (output[group][key] || 0) + Number(delta || 0)));
      });
    });
    return output;
  }

  function refreshLauncher() {
    const launcher = document.getElementById("saga-launcher");
    if (!launcher) return;
    launcher.innerHTML = renderLauncher();
    bindLauncher(launcher);
    const select = document.getElementById("scenario-select");
    if (select) select.disabled = Boolean(profile.active);
  }

  function isFailureEnding(title) { return /幽闭|弃汉|败露|解体|有名无实/.test(String(title || "")); }
  function scenarioById(id) { return window.GAME_DATA?.scenarios?.find(item => item.id === id); }
  function readCore() { try { const value = JSON.parse(localStorage.getItem(CORE_KEY) || "null"); return value?.stats ? value : null; } catch (_) { return null; } }
  function defaultProfile() { return { version: 1, active: false, currentIndex: 0, chapters: [], legacies: [], chapterGameIds: [], pendingScenarioId: null, startedAt: null, completedAt: null, finalScore: 0, finalTitle: "" }; }
  function loadProfile() { try { const value = JSON.parse(localStorage.getItem(STORE_KEY) || "null"); return { ...defaultProfile(), ...(value || {}), chapters: Array.isArray(value?.chapters) ? value.chapters : [], legacies: Array.isArray(value?.legacies) ? value.legacies : [], chapterGameIds: Array.isArray(value?.chapterGameIds) ? value.chapterGameIds : [] }; } catch (_) { return defaultProfile(); } }
  function saveProfile() { try { localStorage.setItem(STORE_KEY, JSON.stringify(profile)); } catch (error) { console.warn("汉祚长卷保存失败", error); } }
  function escapeHtml(value) { return window.XianCommandCenter?.escapeHtml?.(value) || String(value ?? ""); }

  window.XianDynastySaga = Object.freeze({
    chapters: CHAPTERS.slice(),
    legacies: LEGACIES,
    combineLegacies,
    isFailureEnding,
    getProfile: () => JSON.parse(JSON.stringify(profile)),
    isActive: () => Boolean(profile.active),
    begin: beginSaga,
  });
})();
