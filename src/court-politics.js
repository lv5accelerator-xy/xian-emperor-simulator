/* 天子蒙尘：献帝模拟器 v0.6.0 · 人物奏请、政治派系与动态谈判 */
(() => {
  "use strict";

  const CORE_KEY = "xian_emperor_simulator_v01";
  const STORAGE_KEY = "xian_emperor_court_politics_v060";
  const VERSION = "0.6.0";
  const MAX_HISTORY = 40;
  let state = null;
  let coreState = null;
  let activeTab = "petitions";
  let processTimer = null;
  let initialized = false;

  const FACTIONS = [
    { id: "imperial", name: "帝后近臣", color: "#ba6e93", influence: 38, support: 68, tension: 24, note: "优先保全宗庙、后宫与天子自主。" },
    { id: "loyalists", name: "汉室旧臣", color: "#b66d55", influence: 49, support: 72, tension: 31, note: "重名分与礼制，但对冒险复权意见不一。" },
    { id: "cao", name: "曹氏幕府", color: "#718698", influence: 84, support: 42, tension: 48, note: "掌握许都军政，要求稳定与可执行的诏令。" },
    { id: "regional", name: "地方诸侯", color: "#5c8f78", influence: 70, support: 36, tension: 45, note: "服从取决于利益、路途与彼此牵制。" },
    { id: "gentry", name: "州郡士族", color: "#a28a57", influence: 57, support: 51, tension: 28, note: "在意秩序、赋役与本地任官权。" },
  ];

  const PETITIONS = [
    { id: "fu_guard", type: "petition", speaker: "伏皇后", title: "宫禁宿卫之请", body: "伏皇后奏请从旧臣家兵中补充宫禁宿卫；此举能保护天家，也会让曹氏认为宫中另立武备。", faction: "imperial", relation: "empress_fu", minTurn: 1,
      choices: { accept: choice("准奏扩充", "安全、帝党支持上升", { security: 7, treasury: -4, caoAlert: 5 }, { loyalNetwork: 3 }, 7, 1, 5), compromise: choice("只补仪仗", "小幅增防，避免刺激", { security: 3, treasury: -2, caoAlert: 1 }, {}, 3, 0, 2), refuse: choice("暂缓其议", "节省国库，帝党失望", { treasury: 1, security: -2 }, {}, -5, 3, -3) } },
    { id: "dong_network", type: "petition", speaker: "董承", title: "联络旧臣", body: "董承请以宴饮为名联络散居许都的旧臣。若准其秘密经营，朝廷可得耳目，也必须承担泄露的风险。", faction: "loyalists", relation: "dong_cheng", minTurn: 2,
      choices: { accept: choice("密许联络", "忠臣网增强，泄密上升", { authority: 3, caoAlert: 4 }, { loyalNetwork: 6, leakRisk: 5 }, 6, 4, 6), compromise: choice("限定名册", "收效较小但更稳妥", { authority: 2, caoAlert: 1 }, { loyalNetwork: 3, leakRisk: 1 }, 3, 1, 3), refuse: choice("严禁私联", "降低风险，旧臣寒心", { caoAlert: -3, officials: -2 }, { leakRisk: -3 }, -6, -2, -4) } },
    { id: "yang_ritual", type: "petition", speaker: "杨彪", title: "重修朝仪", body: "杨彪认为朝仪是汉廷仍能支配的秩序，请拨国库修订礼册并恢复月朔大朝。", faction: "loyalists", relation: "yang_biao", minTurn: 1,
      choices: { accept: choice("悉依旧典", "威望与百官支持上升", { prestige: 6, officials: 4, treasury: -5 }, {}, 7, -1, 5), compromise: choice("先复月朔", "较少耗费，稳步恢复", { prestige: 3, officials: 2, treasury: -2 }, {}, 3, -1, 3), refuse: choice("国困从简", "保存财力但折损名分", { treasury: 2, prestige: -3 }, {}, -5, 1, -3) } },
    { id: "xun_register", type: "petition", speaker: "荀彧", title: "整饬户籍与漕运", body: "荀彧请由尚书台与曹氏吏员共同核定许都户籍、转运粮秣。执行有效，却会进一步加深幕府对朝政的介入。", faction: "cao", relation: "xun_yu", minTurn: 3,
      choices: { accept: choice("共同推行", "国库与安定上升", { treasury: 7, security: 3, caoAlert: -3 }, { peopleStability: 3 }, 6, -3, 6), compromise: choice("汉官覆核", "保留监督，收益适中", { treasury: 4, authority: 2, caoAlert: 1 }, {}, 2, 1, 3), refuse: choice("维持旧制", "避免介入但效率下降", { treasury: -2, officials: -2, caoAlert: 3 }, { peopleStability: -2 }, -5, 4, -3) } },
    { id: "cao_campaign", type: "petition", speaker: "曹操", title: "借天子名义整军", body: "曹操请以朝廷名义征发州郡粮秣，整备东征。诏令若出，曹军更强；若拒，许都的军政合作将迅速恶化。", faction: "cao", relation: "cao_cao", minTurn: 5,
      choices: { accept: choice("诏令州郡", "换取保护，诸侯警惕", { security: 6, prestige: -2, caoAlert: -5 }, { externalBalance: -4 }, 7, -4, 6), compromise: choice("限额征调", "维持合作与名分", { security: 3, authority: 2, caoAlert: -1 }, { externalBalance: -1 }, 3, -1, 3), refuse: choice("不许借名", "维护名分，激化幕府", { prestige: 5, security: -5, caoAlert: 9 }, {}, -8, 8, -7) } },
    { id: "yuan_titles", type: "negotiation", speaker: "袁绍使者", title: "河北求授节钺", body: "袁绍使者愿奉表输粮，但求朝廷正式加授节钺，并要求诏书不得同时褒奖曹操。", faction: "regional", relation: "yuan_shao", minTurn: 4,
      choices: { accept: choice("加授节钺", "获得外援，曹氏警戒", { treasury: 5, prestige: 3, caoAlert: 7 }, { externalBalance: 7 }, 8, 5, 7), compromise: choice("只加官号", "保留余地，援助减半", { treasury: 3, prestige: 2, caoAlert: 3 }, { externalBalance: 4 }, 4, 2, 4), refuse: choice("不许要挟", "权威上升，河北疏远", { authority: 4, treasury: -2 }, { externalBalance: -3 }, -7, 2, -6) } },
    { id: "liu_relief", type: "negotiation", speaker: "刘表使者", title: "荆州输粮条件", body: "刘表愿从襄阳转运粮食，却希望朝廷承认荆州自行任官三年，以免地方士族不安。", faction: "regional", relation: "liu_biao", minTurn: 6,
      choices: { accept: choice("许其自任", "大量粮援，中央权威受损", { treasury: 9, authority: -4, prestige: 2 }, { externalBalance: 5 }, 7, -1, 7), compromise: choice("名册报备", "粮援与任官权折中", { treasury: 5, authority: 1 }, { externalBalance: 3 }, 4, 0, 4), refuse: choice("坚持朝命", "维护权威，失去粮援", { authority: 5, treasury: -3 }, { externalBalance: -2 }, -6, 2, -5) } },
    { id: "sun_marriage", type: "negotiation", speaker: "孙策使者", title: "江东通聘", body: "江东愿遣质子通聘并贡珍物，条件是朝廷承认其对吴郡的实际节制。这既是礼物，也是一场名分交易。", faction: "regional", relation: "sun_ce", minTurn: 8,
      choices: { accept: choice("受聘授官", "威望与平衡上升", { prestige: 5, treasury: 4, caoAlert: 5 }, { externalBalance: 6 }, 7, 3, 7), compromise: choice("受贡缓授", "保留谈判空间", { prestige: 3, treasury: 2, caoAlert: 2 }, { externalBalance: 3 }, 3, 1, 4), refuse: choice("退还贡物", "彰显谨慎，江东疏远", { authority: 2, treasury: -1, caoAlert: -1 }, { externalBalance: -3 }, -6, -1, -5) } },
  ];

  function choice(label, hint, effects, hidden, support, tension, relation) {
    return { label, hint, effects, hidden, support, tension, relation };
  }

  installStorageWatcher();
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();

  function installStorageWatcher() {
    if (window.__xianCourtWatcherInstalled) return;
    window.__xianCourtWatcherInstalled = true;
    const previousSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function courtAwareSetItem(key, value) {
      previousSetItem.apply(this, arguments);
      if (this !== localStorage || key !== CORE_KEY || window.__xianFullSaveImporting || window.__xianCourtWriting) return;
      window.clearTimeout(processTimer);
      processTimer = window.setTimeout(() => processCoreSave(value), 280);
    };
  }

  function init() {
    if (initialized) return;
    initialized = true;
    installNavButton();
    installBrief();
    installOverlay();
    processCoreSave(localStorage.getItem(CORE_KEY), true);
  }

  function processCoreSave(raw, firstLoad = false) {
    const core = safeParse(raw);
    if (!isValidCore(core)) { coreState = null; state = loadState(); renderAll(); return; }
    coreState = core;
    const loaded = loadState();
    state = !loaded || loaded.gameCreatedAt !== core.createdAt ? createState(core) : migrateState(loaded, core);
    if (core.turn > state.lastProcessedTurn || firstLoad) generatePetition(core);
    state.lastProcessedTurn = Math.max(state.lastProcessedTurn, core.turn);
    state.updatedAt = new Date().toISOString();
    saveState();
    renderAll();
  }

  function createState(core) {
    return { version: VERSION, gameCreatedAt: core.createdAt, lastProcessedTurn: 0, factions: Object.fromEntries(FACTIONS.map(item => [item.id, { influence: item.influence, support: item.support, tension: item.tension }])), petitions: [], history: [], resolvedCount: 0, updatedAt: new Date().toISOString() };
  }

  function migrateState(current, core) {
    const factions = { ...(current.factions || {}) };
    FACTIONS.forEach(item => { factions[item.id] = { influence: item.influence, support: item.support, tension: item.tension, ...(factions[item.id] || {}) }; });
    return { ...current, version: VERSION, gameCreatedAt: core.createdAt, lastProcessedTurn: Number(current.lastProcessedTurn || 0), factions, petitions: Array.isArray(current.petitions) ? current.petitions : [], history: Array.isArray(current.history) ? current.history : [], resolvedCount: Number(current.resolvedCount || 0) };
  }

  function generatePetition(core) {
    const pending = state.petitions.filter(item => item.status === "pending");
    if (pending.length >= 2 || pending.some(item => item.turn === core.turn)) return;
    const eligible = PETITIONS.filter(template => core.turn >= template.minTurn && !state.history.some(item => item.templateId === template.id));
    const pool = eligible.length ? eligible : PETITIONS.filter(template => core.turn >= template.minTurn);
    if (!pool.length) return;
    const pick = pool[Math.floor(seededRandom(`${core.createdAt}-${core.turn}-court`)() * pool.length) % pool.length];
    state.petitions.unshift({ id: `petition-${core.turn}-${pick.id}`, templateId: pick.id, turn: core.turn, status: "pending", createdAt: new Date().toISOString() });
    state.petitions = state.petitions.slice(0, 8);
  }

  function previewResponse(templateId, responseId, currentState = null) {
    const template = PETITIONS.find(item => item.id === templateId);
    const response = template?.choices?.[responseId];
    if (!template || !response) return null;
    const faction = currentState?.factions?.[template.faction] || FACTIONS.find(item => item.id === template.faction);
    return { ...response, factionId: template.faction, supportAfter: clamp(Number(faction?.support || 50) + response.support, 0, 100), tensionAfter: clamp(Number(faction?.tension || 30) + response.tension, 0, 100) };
  }

  function resolvePetition(id, responseId) {
    const petition = state?.petitions?.find(item => item.id === id && item.status === "pending");
    const template = PETITIONS.find(item => item.id === petition?.templateId);
    const response = previewResponse(template?.id, responseId, state);
    if (!petition || !template || !response) return false;
    const faction = state.factions[template.faction];
    faction.support = response.supportAfter;
    faction.tension = response.tensionAfter;
    faction.influence = clamp(faction.influence + Math.round(Math.abs(response.support) / 3) * (response.support >= 0 ? 1 : -1), 10, 100);
    petition.status = "resolved";
    petition.responseId = responseId;
    petition.responseLabel = response.label;
    petition.resolvedAt = new Date().toISOString();
    state.petitions = state.petitions.filter(item => item.status === "pending");
    state.history.unshift({ ...petition, speaker: template.speaker, title: template.title, type: template.type, text: `${template.speaker}所请，天子裁为“${response.label}”。` });
    state.history = state.history.slice(0, MAX_HISTORY);
    state.resolvedCount += 1;
    saveState();
    window.XianEmperorGame?.applyExternalPackage({
      effects: response.effects,
      hidden: response.hidden,
      relations: template.relation ? { [template.relation]: response.relation } : undefined,
      report: { title: `${template.type === "negotiation" ? "使节谈判" : "御前奏请"}·${template.speaker}`, text: `${template.title}：${response.label}。${response.hint}`, type: template.type === "negotiation" ? "diplomacy" : "decision" },
      chronicle: `${template.speaker}奏${template.title}，诏以“${response.label}”处置。`,
    });
    renderAll();
    return true;
  }

  function installNavButton() {
    const nav = document.querySelector(".utility-nav");
    if (!nav || document.getElementById("court-politics-btn")) return;
    const button = document.createElement("button"); button.id = "court-politics-btn"; button.type = "button"; button.textContent = "政议"; button.addEventListener("click", openOverlay);
    nav.insertBefore(button, document.getElementById("reset-btn") || null);
  }

  function installBrief() {
    if (document.getElementById("court-politics-brief")) return;
    const section = document.createElement("section"); section.id = "court-politics-brief"; section.className = "court-politics-brief panel";
    section.innerHTML = '<div class="court-brief-head"><div><span class="section-kicker">朝议与使节</span><h2>人物奏请·政治派系</h2></div><button id="court-brief-open" class="text-button" type="button">进入政议</button></div><div id="court-brief-content" class="court-brief-content"></div>';
    const armyBrief = document.getElementById("army-system-brief"); const stats = document.getElementById("stats-grid");
    if (armyBrief) armyBrief.insertAdjacentElement("afterend", section); else stats?.insertAdjacentElement("afterend", section);
    section.querySelector("#court-brief-open")?.addEventListener("click", openOverlay);
  }

  function installOverlay() {
    if (document.getElementById("court-politics-overlay")) return;
    const overlay = document.createElement("div"); overlay.id = "court-politics-overlay"; overlay.className = "court-politics-overlay hidden";
    overlay.innerHTML = '<section class="court-politics-window" role="dialog" aria-modal="true" aria-labelledby="court-politics-title"><header><div><span class="section-kicker">尚书台政议</span><h2 id="court-politics-title">奏请、派系与外交谈判</h2><p id="court-politics-date">尚未载入本局</p></div><button id="court-politics-close" type="button" aria-label="关闭">×</button></header><nav class="court-politics-tabs"><button type="button" data-court-tab="petitions">待议奏请</button><button type="button" data-court-tab="factions">政治派系</button><button type="button" data-court-tab="history">议决记录</button></nav><div id="court-politics-content"></div></section>';
    document.body.appendChild(overlay);
    overlay.querySelector("#court-politics-close")?.addEventListener("click", closeOverlay);
    overlay.addEventListener("click", event => { if (event.target === overlay) closeOverlay(); });
    overlay.querySelectorAll("[data-court-tab]").forEach(button => button.addEventListener("click", () => { activeTab = button.dataset.courtTab; renderOverlay(); }));
    document.addEventListener("keydown", event => { if (event.key === "Escape" && !overlay.classList.contains("hidden")) closeOverlay(); });
  }

  function openOverlay() { document.getElementById("court-politics-overlay")?.classList.remove("hidden"); document.body.classList.add("court-politics-open"); renderOverlay(); }
  function closeOverlay() { document.getElementById("court-politics-overlay")?.classList.add("hidden"); document.body.classList.remove("court-politics-open"); }
  function renderAll() { renderBrief(); if (!document.getElementById("court-politics-overlay")?.classList.contains("hidden")) renderOverlay(); }

  function renderBrief() {
    const content = document.getElementById("court-brief-content"); if (!content) return;
    if (!state) { content.innerHTML = '<p class="empty-state">开启新局后，人物奏请与使节谈判将随月份出现。</p>'; return; }
    const pending = state.petitions.filter(item => item.status === "pending");
    const hottest = FACTIONS.map(item => ({ ...item, ...(state.factions[item.id] || {}) })).sort((a,b) => b.tension - a.tension)[0];
    content.innerHTML = `<button type="button" data-court-brief-tab="petitions"><span>等待御裁</span><strong>${pending.length} 件奏请</strong><small>${escapeHtml(pending.length ? petitionTemplate(pending[0])?.title : "本月政议已清")}</small></button><button type="button" data-court-brief-tab="factions"><span>派系张力</span><strong>${escapeHtml(hottest.name)} ${Math.round(hottest.tension)}</strong><small>${hottest.tension >= 65 ? "需要尽快安抚或制衡" : "仍在可控范围"}</small></button><button type="button" data-court-brief-tab="history"><span>已作裁决</span><strong>${state.resolvedCount} 次</strong><small>${escapeHtml(state.history[0]?.responseLabel || "尚无议决记录")}</small></button>`;
    content.querySelectorAll("[data-court-brief-tab]").forEach(button => button.addEventListener("click", () => { activeTab = button.dataset.courtBriefTab; openOverlay(); }));
  }

  function renderOverlay() {
    const content = document.getElementById("court-politics-content"); const date = document.getElementById("court-politics-date"); if (!content || !date) return;
    document.querySelectorAll("[data-court-tab]").forEach(button => button.classList.toggle("active", button.dataset.courtTab === activeTab));
    date.textContent = coreState ? `第 ${coreState.turn}/${coreState.maxTurns || 24} 月 · 每项选择都会改变人物关系与派系态度` : "尚未载入本局";
    if (!state) { content.innerHTML = '<p class="empty-state">请先开启或读取一局游戏。</p>'; return; }
    const values = Object.values(state.factions); const avgSupport = Math.round(values.reduce((sum,item) => sum + item.support,0) / values.length); const avgTension = Math.round(values.reduce((sum,item) => sum + item.tension,0) / values.length);
    content.innerHTML = `<section class="court-summary"><article><span>待议</span><strong>${state.petitions.length}</strong><small>最多同时保留两件</small></article><article><span>平均支持</span><strong>${avgSupport}</strong><small>各派对汉廷态度</small></article><article><span>平均张力</span><strong>${avgTension}</strong><small>高张力会放大冲突</small></article><article><span>累计议决</span><strong>${state.resolvedCount}</strong><small>奏请与谈判共计</small></article></section>${activeTab === "factions" ? renderFactions() : activeTab === "history" ? renderHistory() : renderPetitions()}`;
    content.querySelectorAll("[data-petition-response]").forEach(button => button.addEventListener("click", () => resolvePetition(button.dataset.petitionId, button.dataset.petitionResponse)));
  }

  function renderPetitions() {
    return `<section><div class="petition-list">${state.petitions.length ? state.petitions.map(item => { const template = petitionTemplate(item); return `<article class="petition-card ${template.type}"><div class="petition-head"><div><span>第 ${item.turn} 月 · ${template.type === "negotiation" ? "使节交涉" : "人物奏请"}</span><strong>${escapeHtml(template.title)}</strong><small>${escapeHtml(template.speaker)}</small></div><b>${template.type === "negotiation" ? "外交" : "朝议"}</b></div><p>${escapeHtml(template.body)}</p><div class="petition-choices">${Object.entries(template.choices).map(([id, choiceItem]) => `<button type="button" data-petition-id="${escapeHtml(item.id)}" data-petition-response="${id}"><strong>${escapeHtml(choiceItem.label)}</strong><span>${escapeHtml(choiceItem.hint)}</span></button>`).join("")}</div></article>`; }).join("") : '<p class="empty-state">本月没有等待裁决的奏请。结束本月后，朝臣或使节可能提出新的请求。</p>'}</div></section>`;
  }

  function renderFactions() {
    return `<section class="faction-board">${FACTIONS.map(def => { const item = { ...def, ...(state.factions[def.id] || {}) }; return `<article class="court-faction-card" style="--faction:${def.color}"><div><strong>${escapeHtml(def.name)}</strong><b>${attitudeLabel(item.support,item.tension)}</b></div><p>${escapeHtml(def.note)}</p>${factionMeter("影响",item.influence,def.color)}${factionMeter("支持",item.support,def.color)}${factionMeter("张力",item.tension,def.color)}</article>`; }).join("")}</section>`;
  }

  function renderHistory() {
    return `<section class="court-history">${state.history.length ? state.history.map(item => `<article><strong>第 ${item.turn} 月</strong><p>${escapeHtml(item.text)}</p><small>${escapeHtml(item.responseLabel)}</small></article>`).join("") : '<p class="empty-state">尚无政议归档。</p>'}</section>`;
  }

  function factionMeter(label,value,color) { return `<div class="faction-meter" style="--faction:${color}"><span>${label}</span><i><b style="width:${clamp(value,0,100)}%"></b></i><em>${Math.round(value)}</em></div>`; }
  function attitudeLabel(support,tension) { return tension >= 70 ? "冲突将起" : support >= 70 ? "鼎力相助" : support >= 48 ? "谨慎观望" : "渐行渐远"; }
  function petitionTemplate(item) { return PETITIONS.find(template => template.id === item?.templateId); }
  function loadState() { return safeParse(localStorage.getItem(STORAGE_KEY)); }
  function saveState() { if (!state) return; try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (error) { console.warn("政议系统保存失败", error); } }
  function isValidCore(core) { return Boolean(core && typeof core === "object" && Number.isFinite(core.turn) && core.stats && core.hidden); }
  function safeParse(raw) { try { return raw ? JSON.parse(raw) : null; } catch (_) { return null; } }
  function clamp(value,min,max) { return Math.min(max,Math.max(min,Number(value)||0)); }
  function escapeHtml(value) { return String(value ?? "").replace(/[&<>'"]/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", "'":"&#39;", '"':"&quot;" }[char])); }
  function seededRandom(seed) { let hash=2166136261; for(let index=0;index<seed.length;index+=1){hash^=seed.charCodeAt(index);hash=Math.imul(hash,16777619);} return()=>{hash+=0x6d2b79f5;let value=hash;value=Math.imul(value^(value>>>15),value|1);value^=value+Math.imul(value^(value>>>7),value|61);return((value^(value>>>14))>>>0)/4294967296;}; }

  window.XianCourtPolitics = Object.freeze({ version: VERSION, factions: FACTIONS.map(item => ({ ...item })), petitions: PETITIONS.map(item => ({ id:item.id,type:item.type,speaker:item.speaker,title:item.title })), previewResponse, resolvePetition, diagnostics: () => state ? JSON.parse(JSON.stringify(state)) : null });
})();
