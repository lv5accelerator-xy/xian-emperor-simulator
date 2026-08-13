/* 天子蒙尘：献帝模拟器 v2.5.0 · 千秋定论 */
(() => {
  "use strict";

  const CORE_KEY = "xian_emperor_simulator_v01";
  const STORE_KEY = "xian_emperor_final_verdict_v250";
  const MAX_VERDICTS = 24;
  const DIMENSIONS = [
    { id: "legitimacy", name: "守正", text: "以名分、百官与制度维持汉廷存在。", score: g => avg(g.stats.authority, g.stats.prestige, g.stats.officials) },
    { id: "mercy", name: "仁恤", text: "愿意为民生和秩序承受眼前代价。", score: g => avg(g.stats.prestige, g.stats.treasury, g.hidden.peopleStability) },
    { id: "caution", name: "持重", text: "懂得在宫禁安全与强权警戒之间保存自身。", score: g => avg(g.stats.security, 100 - g.stats.caoAlert, 100 - g.hidden.leakRisk) },
    { id: "balance", name: "制衡", text: "以外镇、官爵和朝廷承认牵制一家独大。", score: g => avg(g.stats.prestige, g.hidden.externalBalance, 100 - g.stats.caoAlert) },
    { id: "resolve", name: "决断", text: "在风险中仍试图建立忠汉网络并收回主动。", score: g => avg(g.stats.authority, g.hidden.loyalNetwork, 100 - g.hidden.leakRisk) },
  ];

  let store = loadStore();

  document.addEventListener("DOMContentLoaded", init, { once: true });
  document.addEventListener("xian:campaign-concluded", event => recordVerdict(event.detail || {}));

  function init() {
    window.XianCommandCenter?.registerTab?.({
      id: "verdict",
      label: "千秋定论",
      kicker: "v2.5.0 · 帝王总评",
      title: "功过不由一个结局写尽",
      render: renderTab,
      onMount: mountTab,
    });
    const core = readCore();
    if (core?.ended && !store.verdicts.some(item => item.gameCreatedAt === core.createdAt)) {
      recordVerdict({ state: core, scenario: scenarioById(core.scenarioId), score: fallbackScore(core), challenge: { completed: false } });
    }
  }

  function recordVerdict(detail) {
    const game = detail.state;
    if (!game?.createdAt || store.verdicts.some(item => item.gameCreatedAt === game.createdAt)) return;
    const verdict = buildVerdict(game, detail);
    store.verdicts.unshift(verdict);
    store.verdicts = store.verdicts.slice(0, MAX_VERDICTS);
    saveStore();
    installEndingVerdict(verdict);
    window.XianCommandCenter?.refresh?.();
  }

  function buildVerdict(game, detail = {}) {
    const normalized = normalizeGame(game);
    const dimensions = DIMENSIONS.map(item => ({ id: item.id, name: item.name, text: item.text, score: Math.round(item.score(normalized)) })).sort((a, b) => b.score - a.score);
    const route = window.XianHistorian?.classifyRoute?.(game) || { id: dimensions[0].id, name: dimensions[0].name, text: dimensions[0].text };
    const failed = /幽闭|弃汉|败露|解体|有名无实|余烬/.test(String(game.ending?.title || ""));
    const posthumous = choosePosthumousName(normalized, dimensions, failed);
    const memoryState = window.XianCharacterMemory?.getState?.() || {};
    const memories = memoryState.memories || [];
    const gameMemories = memories.filter(item => !item.gameCreatedAt || item.gameCreatedAt === game.createdAt);
    const echoState = window.XianConsequenceEchoes?.getState?.() || {};
    const promiseState = echoState.records || [];
    const promises = promiseState.filter(item => item.gameCreatedAt === game.createdAt && item.type === "promise");
    const promiseSummary = {
      fulfilled: promises.filter(item => item.status === "fulfilled").length,
      broken: promises.filter(item => item.status === "broken").length,
      pending: promises.filter(item => item.status === "pending").length,
    };
    const characters = buildCharacterFates(game, gameMemories);
    const controversies = buildControversies(normalized, dimensions, promiseSummary, failed);
    const turningPoints = latestTurningPoints(game);
    return {
      id: `verdict-${Date.now()}`,
      gameCreatedAt: game.createdAt,
      scenarioId: game.scenarioId,
      scenarioName: detail.scenario?.name || scenarioById(game.scenarioId)?.name || game.scenarioId,
      ending: game.ending?.title || "未结算",
      endingText: game.ending?.text || "",
      score: Number(detail.score || fallbackScore(game)),
      posthumous,
      fullTitle: `史家拟谥·汉${posthumous}帝`,
      routeName: route.name,
      dimensions,
      virtues: dimensions.slice(0, 3),
      controversies,
      characters,
      promiseSummary,
      turningPoints,
      worldSummary: buildWorldSummary(normalized),
      finalComment: buildFinalComment(posthumous, route, dimensions, failed, promiseSummary),
      completedAt: new Date().toISOString(),
    };
  }

  function choosePosthumousName(game, dimensions, failed) {
    if (failed && game.stats.security < 25) return "愍";
    if (game.hidden.peopleStability >= 65 && game.stats.prestige >= 62) return "仁";
    if (game.stats.authority >= 62 && game.stats.officials >= 58) return "昭";
    if (game.hidden.loyalNetwork >= 58 && game.stats.authority >= 48) return "烈";
    if (dimensions[0]?.id === "balance" && game.hidden.externalBalance >= 55) return "和";
    if (dimensions[0]?.id === "caution" && game.stats.security >= 58) return "安";
    return failed ? "怀" : "定";
  }

  function buildControversies(game, dimensions, promises, failed) {
    const result = [];
    if (game.stats.caoAlert >= 72) result.push("锐意自振，却屡令掌兵者疑惧；后世争论这是勇决，还是把宫廷置于险地。");
    if (game.stats.authority <= 35) result.push("保存宗庙有功，但诏令常借他人之手；史家因此争论存续是否等同于中兴。");
    if (game.stats.treasury <= 28) result.push("礼义与军政多有施为，却留下财政亏空；仁政究竟能否脱离仓廪，成为本朝未解之问。");
    if (game.hidden.leakRisk >= 55) result.push("忠汉暗线一度壮大，也使宫中秘密频繁外泄；忠诚与轻率只隔一纸密诏。");
    if (promises.broken > 0) result.push(`本局有 ${promises.broken} 项御前承诺未能兑现，受诺者记得的不只是乱世艰难。`);
    if (!result.length && !failed) result.push(`政局大体稳妥，却也少有孤注一掷的功业；“${dimensions[0]?.name || "持重"}”究竟是智慧还是克制，留待后世评说。`);
    if (failed && result.length < 2) result.push("结局虽败，仍有选择保存了人、制度或名分；败局不等于此前一切皆无意义。");
    return result.slice(0, 3);
  }

  function buildCharacterFates(game, memories) {
    const people = (window.GAME_DATA?.characters || []).map(person => {
      const relation = Number(game.relations?.[person.id] ?? person.relation ?? 50);
      const remembered = memories.filter(item => item.characterId === person.id).length;
      return { id: person.id, name: person.name, relation, remembered, fate: characterFate(person, relation, remembered, game) };
    });
    const high = [...people].sort((a, b) => b.relation - a.relation || b.remembered - a.remembered).slice(0, 3);
    const low = [...people].sort((a, b) => a.relation - b.relation || b.remembered - a.remembered).find(item => !high.some(highItem => highItem.id === item.id));
    return low ? [...high, low] : high;
  }

  function characterFate(person, relation, remembered, game) {
    if (relation >= 75) return `${person.name}在终局后仍保存与天子的往来文书，${remembered ? `其中 ${remembered} 件旧事被后世反复提起` : "并以旧日朝议自证其志"}。`;
    if (relation >= 55) return `${person.name}与汉廷保持最后的体面，既未完全托付，也没有公开背弃。`;
    if (relation >= 35) return `${person.name}选择观望局势，把个人与家族安危置于未定的承诺之前。`;
    if (game.stats.caoAlert >= 75) return `${person.name}最终远离御前，并将天子的举动视为会招致清洗的危险信号。`;
    return `${person.name}对御前旧事心存芥蒂，终局之后仍不愿为本朝辩解。`;
  }

  function latestTurningPoints(game) {
    const historian = window.XianHistorian?.getState?.();
    const run = historian?.runs?.find(item => item.gameCreatedAt === game.createdAt);
    if (run?.turningPoints?.length) return run.turningPoints.slice(0, 5);
    const chronicle = Array.isArray(game.chronicle) ? game.chronicle : [];
    return [chronicle[0], chronicle[Math.floor(chronicle.length / 2)], chronicle[chronicle.length - 1]].filter(Boolean).map((item, index) => ({ date: item.date, title: ["开局", "中局", "终卷"][index], choice: item.text }));
  }

  function buildWorldSummary(game) {
    if (game.stats.prestige >= 65 && game.hidden.peopleStability >= 55) return "天下仍把汉廷视为可以调停纷争的正朔，百姓也记得朝廷曾试图恢复秩序。";
    if (game.hidden.externalBalance >= 60) return "外镇之间形成新的制衡，汉廷未能号令天下，却仍是各方不能轻易抹去的名分。";
    if (game.stats.caoAlert >= 80) return "宫廷与掌兵者的猜疑成为终卷底色，朝廷每一次自救都伴随更严密的控制。";
    if (game.hidden.peopleStability <= 35) return "朝堂仍在书写诏令，民间却更多记得粮价、赋役与流离。";
    return "汉廷既未真正重掌天下，也没有完全失去声音；山河在妥协、名分与兵权之间继续演变。";
  }

  function buildFinalComment(posthumous, route, dimensions, failed, promises) {
    const promiseText = promises.broken ? `其失信 ${promises.broken} 次，亦为后世所讥。` : promises.fulfilled ? `其能守御前旧诺，故近臣尚愿相随。` : "其少轻许，亦少得可托生死之人。";
    return `史臣曰：帝行${route.name}之道，以${dimensions[0].name}为长，以${dimensions[dimensions.length - 1].name}为短。${failed ? "虽终于困厄，然乱世之败未必皆由一人。" : "终能在强权与乱世之间留下有限而真实的自主。"}${promiseText}故拟谥“${posthumous}”，非为定论，正因功过仍可再议。`;
  }

  function renderTab() {
    const current = store.verdicts[0];
    if (!current) return '<div class="command-empty">完成任意普通剧本、短局或汉祚长卷章节后，史家才会形成完整定论。</div>';
    return `<div class="verdict-current"><span>${escapeHtml(current.scenarioName)} · ${escapeHtml(current.ending)}</span><strong>${escapeHtml(current.fullTitle)}</strong><p>${escapeHtml(current.finalComment)}</p></div><section class="verdict-virtues">${current.virtues.map(item => `<article><span>${escapeHtml(item.name)}</span><b>${item.score}</b><p>${escapeHtml(item.text)}</p></article>`).join("")}</section><section class="verdict-section"><h3>史家争议</h3>${current.controversies.map(item => `<p>“${escapeHtml(item)}”</p>`).join("")}</section><section class="verdict-section"><h3>人物后记</h3><div class="verdict-people">${current.characters.map(item => `<article><strong>${escapeHtml(item.name)}</strong><span>关系 ${item.relation} · 旧事 ${item.remembered}</span><p>${escapeHtml(item.fate)}</p></article>`).join("")}</div></section><section class="verdict-section"><h3>山河终卷</h3><p>${escapeHtml(current.worldSummary)}</p></section><div class="verdict-actions"><button type="button" data-verdict-export="${current.id}">导出《帝纪终评》</button></div>${store.verdicts.length > 1 ? `<section class="verdict-history"><h3>历次拟谥</h3>${store.verdicts.slice(1, 8).map(item => `<button type="button" data-verdict-select="${item.id}"><span>${escapeHtml(item.scenarioName)}</span><strong>汉${escapeHtml(item.posthumous)}帝</strong><small>${escapeHtml(item.ending)}</small></button>`).join("")}</section>` : ""}`;
  }

  function mountTab(root) {
    root.querySelectorAll("[data-verdict-export]").forEach(button => button.addEventListener("click", () => exportVerdict(button.dataset.verdictExport)));
    root.querySelectorAll("[data-verdict-select]").forEach(button => button.addEventListener("click", () => {
      const index = store.verdicts.findIndex(item => item.id === button.dataset.verdictSelect);
      if (index > 0) { store.verdicts.unshift(...store.verdicts.splice(index, 1)); saveStore(); window.XianCommandCenter?.open?.("verdict"); }
    }));
  }

  function installEndingVerdict(verdict) {
    setTimeout(() => {
      const scroll = document.querySelector("#end-screen .ending-scroll");
      if (!scroll || scroll.querySelector(".final-verdict-card")) return;
      const card = document.createElement("section");
      card.className = "final-verdict-card";
      card.innerHTML = `<span>千秋定论</span><strong>${escapeHtml(verdict.fullTitle)}</strong><p>${escapeHtml(verdict.finalComment)}</p><button type="button">查看完整帝纪</button>`;
      card.querySelector("button")?.addEventListener("click", () => { document.getElementById("end-screen")?.classList.add("hidden"); window.XianCommandCenter?.open?.("verdict"); });
      scroll.querySelector(".ending-actions")?.before(card);
    }, 80);
  }

  function exportVerdict(id) {
    const value = store.verdicts.find(item => item.id === id);
    if (!value) return;
    const lines = [
      "《天子蒙尘：献帝模拟器》帝纪终评", `剧本：${value.scenarioName}`, `结局：${value.ending}`, `史家拟谥：汉${value.posthumous}帝`, `政治路线：${value.routeName}`, "",
      "史臣总评：", value.finalComment, "", "三项长处：", ...value.virtues.map(item => `${item.name}（${item.score}）：${item.text}`), "",
      "史家争议：", ...value.controversies.map((item, index) => `${index + 1}. ${item}`), "", "人物后记：", ...value.characters.map(item => `${item.name}：${item.fate}`), "", "山河终卷：", value.worldSummary,
    ];
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `献帝模拟器-${value.scenarioId}-汉${value.posthumous}帝-终评.txt`;
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 500);
  }

  function normalizeGame(game) { return { stats: { authority: 0, prestige: 0, security: 0, treasury: 0, officials: 0, caoAlert: 0, ...(game.stats || {}) }, hidden: { loyalNetwork: 0, leakRisk: 0, peopleStability: 0, externalBalance: 0, escapeRoute: 0, ...(game.hidden || {}) } }; }
  function avg(...values) { return values.reduce((sum, value) => sum + Number(value || 0), 0) / Math.max(1, values.length); }
  function fallbackScore(game) { const value = normalizeGame(game); return Math.round(value.stats.authority + value.stats.prestige + value.stats.security + value.stats.treasury + value.stats.officials + (100 - value.stats.caoAlert)); }
  function scenarioById(id) { return window.GAME_DATA?.scenarios?.find(item => item.id === id); }
  function defaultStore() { return { version: 1, verdicts: [] }; }
  function loadStore() { try { const value = JSON.parse(localStorage.getItem(STORE_KEY) || "null"); return { ...defaultStore(), ...(value || {}), verdicts: Array.isArray(value?.verdicts) ? value.verdicts : [] }; } catch (_) { return defaultStore(); } }
  function saveStore() { try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (error) { console.warn("帝纪终评保存失败", error); } }
  function readCore() { try { const value = JSON.parse(localStorage.getItem(CORE_KEY) || "null"); return value?.stats ? value : null; } catch (_) { return null; } }
  function escapeHtml(value) { return window.XianCommandCenter?.escapeHtml?.(value) || String(value ?? ""); }

  window.XianFinalVerdict = Object.freeze({
    buildVerdict,
    choosePosthumousName,
    getState: () => JSON.parse(JSON.stringify(store)),
  });
})();
