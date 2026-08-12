/* 天子蒙尘：献帝模拟器 v1.7.0 · 人心如棋 */
(() => {
  "use strict";

  const CORE_KEY = "xian_emperor_simulator_v01";
  const STORE_KEY = "xian_emperor_character_memory_v170";
  const MAX_MEMORIES = 42;
  const CHARACTER_IDS = ["empress_fu", "dong_cheng", "yang_biao", "xun_yu", "cao_cao", "yuan_shao", "yuan_shu", "liu_biao", "sun_ce"];
  const CHARACTER_TONES = {
    empress_fu: ["愿与陛下共守宫门。", "宫中人心最怕反复，请陛下珍惜可信之人。"],
    dong_cheng: ["臣记得陛下曾以国士待我。", "密谋可以救急，却不能代替长久之计。"],
    yang_biao: ["名分要靠每一次不失体统的选择维持。", "百官会记得陛下是否守住了制度。"],
    xun_yu: ["复兴秩序比争一时意气更难。", "政令若能落地，名分自然有分量。"],
    cao_cao: ["陛下的每一次封赏，臣都看在眼里。", "朝廷若求安定，便须有人承担兵粮。"],
    yuan_shao: ["河北在看朝廷是否仍能主持天下。", "一纸诏书的分量，取决于陛下是否守信。"],
    yuan_shu: ["官爵既可授人，也会因滥授而轻。", "天下人都在估量汉廷还能给出什么。"],
    liu_biao: ["荆州愿奉汉，但不愿卷入无望之争。", "陛下若守信，宗亲自有相助之日。"],
    sun_ce: ["江东敬的是有分量的诏命。", "朝廷若只索取而不回应，远方终会沉默。"],
  };

  let state = loadState();
  let core = readCore();

  document.addEventListener("DOMContentLoaded", init, { once: true });
  document.addEventListener("xian:decision-resolved", event => recordDecision(event.detail || {}));
  document.addEventListener("xian:core-saved", () => { core = readCore(); });

  function init() {
    core = readCore();
    window.XianCommandCenter?.registerTab?.({
      id: "people",
      label: "人心如棋",
      kicker: "v1.7.0 · 人物记忆",
      title: "君臣会记得恩义与背弃",
      render: renderTab,
      onMount: mountTab,
    });
  }

  function recordDecision(detail) {
    if (!detail.createdAt || detail.createdAt !== readCore()?.createdAt) return;
    const entries = Object.entries(detail.relations || {}).filter(([id, delta]) => CHARACTER_IDS.includes(id) && Number(delta));
    if (!entries.length) return;
    entries.forEach(([characterId, delta]) => addMemory({
      characterId,
      gameCreatedAt: detail.createdAt,
      kind: delta > 0 ? "favor" : "grievance",
      weight: Math.max(-3, Math.min(3, Math.round(Number(delta) / 3))),
      date: detail.date || "御前",
      title: detail.eventTitle || "朝堂裁决",
      text: detail.choiceLabel || detail.chronicle || "天子作出了一项影响此人的选择。",
      turn: detail.turn || 0,
    }));
  }

  function addMemory(memory) {
    state.memories.unshift({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, gameCreatedAt: core?.createdAt || readCore()?.createdAt || null, ...memory });
    state.memories = state.memories.slice(0, MAX_MEMORIES);
    saveState();
    window.XianCommandCenter?.refresh?.();
  }

  function renderTab() {
    core = readCore();
    if (!core) return '<div class="command-empty">开启或读取一局后，人物才会留下记忆。</div>';
    const people = window.GAME_DATA?.characters?.filter(item => CHARACTER_IDS.includes(item.id)) || [];
    const visible = visibleMemories();
    return `
      <div class="memory-summary"><div><span>被记住的选择</span><strong>${visible.length}</strong></div><p>单章只读取本局记忆；汉祚长卷会让人物旧事跨章延续，但不会新增好感货币。</p></div>
      <div class="memory-people">${people.map(person => renderPerson(person, visible)).join("")}</div>`;
  }

  function renderPerson(person, visible = visibleMemories()) {
    const relation = Number(core?.relations?.[person.id] ?? person.relation ?? 50);
    const memories = visible.filter(item => item.characterId === person.id);
    const balance = memories.reduce((sum, item) => sum + Number(item.weight || 0), 0);
    const attitude = relation >= 72 ? "深信" : relation >= 55 ? "愿意合作" : relation >= 36 ? "观望" : "心存芥蒂";
    return `<article class="memory-person">
      <header><div class="memory-avatar">${escapeHtml(person.initials || person.name.slice(0, 1))}</div><div><strong>${escapeHtml(person.name)}</strong><span>${attitude} · 记忆 ${memories.length}</span></div><button type="button" data-memory-consult="${person.id}" ${Number(core?.actionPoints || 0) <= 0 || !core?.eventResolved ? "disabled" : ""}>问策</button></header>
      <div class="memory-balance"><i style="--memory:${Math.max(4, Math.min(96, 50 + balance * 7))}%"></i></div>
      ${memories.length ? `<div class="memory-latest"><span>${escapeHtml(memories[0].date)}</span><strong>${escapeHtml(memories[0].title)}</strong><p>${escapeHtml(memories[0].text)}</p></div>` : '<p class="memory-none">尚无足以被此人记住的裁决。</p>'}
    </article>`;
  }

  function mountTab(root) {
    root.querySelectorAll("[data-memory-consult]").forEach(button => button.addEventListener("click", () => consult(button.dataset.memoryConsult)));
  }

  function consult(characterId) {
    core = readCore();
    const person = window.GAME_DATA?.characters?.find(item => item.id === characterId);
    if (!person || !core || Number(core.actionPoints || 0) <= 0 || !core.eventResolved) return;
    const memories = visibleMemories().filter(item => item.characterId === characterId);
    const balance = memories.reduce((sum, item) => sum + Number(item.weight || 0), 0);
    const tone = CHARACTER_TONES[characterId] || ["臣会记得陛下今日之问。", "朝局无常，惟选择不可追回。"];
    const favorable = balance >= 0;
    const advice = favorable ? tone[0] : tone[1];
    const packageData = buildAdvicePackage(characterId, favorable);
    const accepted = window.XianEmperorGame?.performExternalAction?.({
      title: `问策·${person.name}`,
      text: `${person.name}回顾此前君臣往来后奏道：“${advice}”`,
      chronicle: `天子问策于${person.name}，其以往事相答。`,
      effects: packageData.effects,
      hidden: packageData.hidden,
      relations: { [characterId]: favorable ? 2 : 1 },
    });
    if (!accepted) return;
    addMemory({ characterId, kind: "consult", weight: 1, date: currentDate(), title: "御前问策", text: "天子没有忘记旧事，再次询问此人的判断。", turn: core.turn });
    setTimeout(() => window.XianCommandCenter?.open?.("people"), 80);
  }

  function buildAdvicePackage(characterId, favorable) {
    if (characterId === "cao_cao") return { effects: { caoAlert: favorable ? -5 : -2, security: 2 }, hidden: {} };
    if (["yuan_shao", "yuan_shu", "liu_biao", "sun_ce"].includes(characterId)) return { effects: { prestige: favorable ? 3 : 1, caoAlert: 1 }, hidden: { externalBalance: favorable ? 4 : 2 } };
    if (["empress_fu", "dong_cheng"].includes(characterId)) return { effects: { security: favorable ? 3 : 1 }, hidden: { loyalNetwork: favorable ? 3 : 1, leakRisk: favorable ? -1 : 1 } };
    return { effects: { authority: favorable ? 2 : 1, officials: favorable ? 3 : 1 }, hidden: {} };
  }

  function currentDate() {
    return document.getElementById("date-label")?.textContent || "御前";
  }

  function visibleMemories() {
    const currentId = core?.createdAt || readCore()?.createdAt;
    const saga = window.XianDynastySaga?.getProfile?.();
    const allowed = new Set(saga?.active ? (saga.chapterGameIds || []) : [currentId]);
    return state.memories.filter(item => !item.gameCreatedAt || allowed.has(item.gameCreatedAt));
  }

  function defaultState() { return { version: 1, memories: [] }; }
  function loadState() {
    try {
      const value = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
      return { ...defaultState(), ...(value && typeof value === "object" ? value : {}), memories: Array.isArray(value?.memories) ? value.memories : [] };
    } catch (_) { return defaultState(); }
  }
  function saveState() { try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (error) { console.warn("人物记忆保存失败", error); } }
  function readCore() { try { const value = JSON.parse(localStorage.getItem(CORE_KEY) || "null"); return value?.stats ? value : null; } catch (_) { return null; } }
  function escapeHtml(value) { return window.XianCommandCenter?.escapeHtml?.(value) || String(value ?? ""); }

  window.XianCharacterMemory = Object.freeze({
    getState: () => JSON.parse(JSON.stringify(state)),
    recordDecision,
    buildAdvicePackage,
  });
})();
