/* 天子蒙尘：献帝模拟器 v2.4.0 · 天下同题 */
(() => {
  "use strict";

  const STORE_KEY = "xian_emperor_weekly_challenge_v240";
  const SCENARIOS = ["zhongping_189", "xingping_195", "jianan_196", "jianan_200", "yankang_220"];
  const EVENT_POOLS = [
    ["palace_guard", "palace_rumor", "forged_edict", "old_official_petition", "seal_ceremony", "court_banquet"],
    ["grain_price", "tax_petition", "corruption_case", "scholar_recommendation", "border_bandits", "imperial_tutor"],
    ["northern_envoy", "envoy_jiangdong", "frontier_victory", "cao_gift", "court_debate", "imperial_clan"],
    ["secret_letter", "dong_cheng_plan", "xun_yu_memorial", "imperial_clothing", "forged_edict", "final_pressure"],
  ];
  const CONDITIONS = [
    { name: "仓廪先行", text: "本周国库更加紧张，但民政要求更高。", setup: { effects: { treasury: -7 }, hidden: { peopleStability: -3 } }, goal: { path: "stats.treasury", min: 24, label: "国库≥24" } },
    { name: "宫门多疑", text: "宫禁人心不稳，安全与泄密必须同时照看。", setup: { effects: { security: -8 }, hidden: { leakRisk: 6 } }, goal: { path: "stats.security", min: 38, label: "宫廷安全≥38" } },
    { name: "名分受试", text: "朝廷威仪遭到质疑，需要重新证明诏令仍有分量。", setup: { effects: { authority: -6, prestige: -3 } }, goal: { path: "stats.authority", min: 36, label: "皇权≥36" } },
    { name: "外镇观望", text: "各方都在等待朝廷先表明立场。", setup: { effects: { caoAlert: 4 }, hidden: { externalBalance: -4 } }, goal: { path: "hidden.externalBalance", min: 24, label: "外部制衡≥24" } },
  ];

  let store = loadStore();
  let selectedCode = codeForWeek(getIsoWeek(new Date()));

  document.addEventListener("DOMContentLoaded", init, { once: true });
  document.addEventListener("xian:short-challenge-completed", event => captureResult(event.detail || {}));

  function init() {
    window.XianCommandCenter?.registerTab?.({
      id: "weekly",
      label: "天下同题",
      kicker: "v2.4.0 · 固定周挑战",
      title: "同一诏题，各写一卷",
      render: renderTab,
      onMount: mountTab,
    });
  }

  function getIsoWeek(date) {
    const value = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    value.setUTCDate(value.getUTCDate() + 4 - (value.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(value.getUTCFullYear(), 0, 1));
    const week = Math.ceil((((value - yearStart) / 86400000) + 1) / 7);
    return `${value.getUTCFullYear()}W${String(week).padStart(2, "0")}`;
  }

  function codeForWeek(weekKey) {
    const checksum = stableHash(`XIAN:${weekKey}`).toString(36).toUpperCase().slice(0, 5).padStart(5, "0");
    return `XIAN-${weekKey}-${checksum}`;
  }

  function parseCode(code) {
    const match = String(code || "").trim().toUpperCase().match(/^XIAN-(\d{4}W\d{2})-([0-9A-Z]{5})$/);
    if (!match || codeForWeek(match[1]) !== match[0]) return null;
    return match[1];
  }

  function buildDefinition(code = selectedCode) {
    const weekKey = parseCode(code);
    if (!weekKey) return null;
    const seed = stableHash(weekKey);
    const scenarioId = SCENARIOS[seed % SCENARIOS.length];
    const condition = CONDITIONS[(seed >>> 3) % CONDITIONS.length];
    const sequence = seededShuffle(EVENT_POOLS[(seed >>> 5) % EVENT_POOLS.length], seed).slice(0, 6);
    const sharedGoal = (seed % 2 === 0)
      ? { path: "stats.prestige", min: 52, label: "汉室威望≥52" }
      : { path: "stats.officials", min: 40, label: "百官支持≥40" };
    return {
      id: `weekly_${weekKey}`,
      kind: "weekly",
      code,
      weekKey,
      name: `天下同题·${condition.name}`,
      scenarioId,
      duration: 6,
      difficulty: "standard",
      intro: `${condition.text}所有使用代码 ${code} 的玩家面对相同剧本、事件顺序与初始修正。`,
      sequence,
      setup: condition.setup,
      goals: [condition.goal, sharedGoal, { path: "stats.caoAlert", max: 82, label: "曹氏警戒≤82" }],
      reward: `同题史签·${weekKey}`,
    };
  }

  function startSelected() {
    const definition = buildDefinition(selectedCode);
    if (!definition) return false;
    return window.XianShortChallenges?.startCustom?.(definition) || false;
  }

  function captureResult(result) {
    if (result.kind !== "weekly") return;
    const shortState = window.XianShortChallenges?.getState?.() || {};
    const definition = Object.values(shortState.customDefinitions || {}).find(item => item.id === result.challengeId);
    const code = definition?.code || selectedCode;
    const record = { ...result, code };
    store.results.unshift(record);
    store.results = store.results.slice(0, 32);
    if (!store.best[code] || result.score > store.best[code].score) store.best[code] = record;
    saveStore();
    window.XianCommandCenter?.refresh?.();
  }

  function renderTab() {
    const definition = buildDefinition(selectedCode) || buildDefinition(codeForWeek(getIsoWeek(new Date())));
    const best = store.best[definition.code];
    const currentCode = codeForWeek(getIsoWeek(new Date()));
    return `
      <section class="weekly-hero"><div><span>${definition.code === currentCode ? "本周御题" : "往期同题"}</span><strong>${escapeHtml(definition.name)}</strong><p>${escapeHtml(definition.intro)}</p></div><b>${definition.weekKey}</b></section>
      <div class="weekly-code"><label for="weekly-code-input">分享码</label><input id="weekly-code-input" value="${escapeHtml(definition.code)}" spellcheck="false"><button type="button" data-weekly-load>载入</button><button type="button" data-weekly-copy>复制</button></div>
      <section class="weekly-rules"><article><span>历史剧本</span><strong>${escapeHtml(scenarioName(definition.scenarioId))}</strong></article><article><span>期限</span><strong>${definition.duration}个月</strong></article><article><span>固定事件</span><strong>${definition.sequence.length}件</strong></article></section>
      <section class="weekly-goals"><h3>本题目标</h3>${definition.goals.map(goal => `<span>${escapeHtml(goal.label)}</span>`).join("")}</section>
      ${best ? `<div class="weekly-best"><span>个人最佳</span><strong>${medalName(best.medal)} · ${best.score}分</strong><p>${new Date(best.completedAt).toLocaleDateString("zh-CN")} 完成 ${best.completed}/${best.total} 项</p></div>` : '<div class="weekly-best empty">此分享码尚无本机成绩。</div>'}
      <button class="weekly-start" type="button" data-weekly-start ${window.XianDynastySaga?.isActive?.() ? "disabled" : ""}>开始同题挑战</button>
      <p class="weekly-note">同题结果保存在本浏览器，可将分享码发给其他玩家；本版本不依赖服务器排行榜。</p>`;
  }

  function mountTab(root) {
    const input = root.querySelector("#weekly-code-input");
    root.querySelector("[data-weekly-load]")?.addEventListener("click", () => {
      const weekKey = parseCode(input?.value);
      if (!weekKey) { input?.classList.add("invalid"); return; }
      selectedCode = codeForWeek(weekKey);
      window.XianCommandCenter?.open?.("weekly");
    });
    root.querySelector("[data-weekly-copy]")?.addEventListener("click", async () => {
      input?.select();
      try { await navigator.clipboard?.writeText(selectedCode); } catch (_) { document.execCommand?.("copy"); }
    });
    root.querySelector("[data-weekly-start]")?.addEventListener("click", startSelected);
  }

  function seededShuffle(items, seed) {
    const result = [...items];
    let value = seed >>> 0;
    for (let index = result.length - 1; index > 0; index -= 1) {
      value = (value * 1664525 + 1013904223) >>> 0;
      const swap = value % (index + 1);
      [result[index], result[swap]] = [result[swap], result[index]];
    }
    return result;
  }

  function stableHash(value) { return [...String(value || "")].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 11); }
  function scenarioName(id) { return window.GAME_DATA?.scenarios?.find(item => item.id === id)?.name || id; }
  function medalName(id) { return ({ gold: "金章", silver: "银章", bronze: "铜章", none: "未获章" })[id] || "未获章"; }
  function defaultStore() { return { version: 1, results: [], best: {} }; }
  function loadStore() { try { const value = JSON.parse(localStorage.getItem(STORE_KEY) || "null"); return { ...defaultStore(), ...(value || {}), results: Array.isArray(value?.results) ? value.results : [], best: value?.best || {} }; } catch (_) { return defaultStore(); } }
  function saveStore() { try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (error) { console.warn("天下同题保存失败", error); } }
  function escapeHtml(value) { return window.XianCommandCenter?.escapeHtml?.(value) || String(value ?? ""); }

  window.XianWeeklyChallenge = Object.freeze({
    getIsoWeek,
    codeForWeek,
    parseCode,
    buildDefinition,
    seededShuffle,
    getState: () => JSON.parse(JSON.stringify(store)),
  });
})();
