/* 天子蒙尘 v2.19.0：完整留档、恢复对比与单份导出。 */
(() => {
  "use strict";
  const CORE_KEY = "xian_emperor_simulator_v01";
  const STORE_KEY = "xian_emperor_save_backups_v2180";
  const api = () => window.XianEmperorGame;
  const clone = value => JSON.parse(JSON.stringify(value));
  const keyFor = core => `${core.createdAt}:${core.turn}`;
  const escape = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  let timer = null, preparedGameId = null, problem = "";
  let lastMonth = null;

  function readStore() {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw === null) return { version: 1, months: [], replacement: null };
    const value = JSON.parse(raw);
    if (!value || !Array.isArray(value.months)) throw new Error("Invalid backup index");
    return { version: 1, months: value.months.slice(0, 3), replacement: value.replacement || null };
  }
  function writeStore(store) { localStorage.setItem(STORE_KEY, JSON.stringify(store)); problem = ""; }
  function fail() {
    problem = "备份未能保存：请检查浏览器存储空间或先导出完整存档。";
    api().notify(problem, "error");
    return false;
  }
  function makeEntry(bundle, label) {
    const core = bundle.stores[CORE_KEY];
    const short = bundle.stores.xian_emperor_short_challenges_v230;
    return { id: keyFor(core), label, capturedAt: new Date().toISOString(), scenarioId: core.scenarioId,
      turn: core.turn, year: core.year, month: core.month, ended: Boolean(core.ended),
      challengeId: short?.active?.gameCreatedAt === core.createdAt ? short.active.challengeId : null, bundle };
  }

  function captureMonth() {
    timer = null;
    if (window.__xianFullSaveImporting) return;
    try {
      const bundle = api().captureFullSave();
      if (!bundle) return;
      const core = bundle.stores[CORE_KEY], id = keyFor(core), store = readStore();
      // Refreshing or saving an action does not overwrite this month's checkpoint.
      if (lastMonth === id && store.months.some(entry => entry.id === id)) return;
      store.months = [makeEntry(bundle, "月度自动留档"), ...store.months.filter(entry => entry.id !== id)].slice(0, 3);
      writeStore(store);
      lastMonth = id;
    } catch (_) { fail(); }
  }
  function queueCapture() {
    if (window.__xianFullSaveImporting) return;
    clearTimeout(timer);
    // Let world, army, short-review and delayed chapter setup finish their save handlers.
    timer = setTimeout(captureMonth, 500);
  }
  function captureBeforeReplacement(label = "重开前") {
    clearTimeout(timer); timer = null;
    try {
      const bundle = api().captureFullSave();
      if (!bundle) return true;
      const store = readStore();
      store.replacement = makeEntry(bundle, label);
      writeStore(store);
      return true;
    } catch (_) { return fail(); }
  }
  function prepareReplacement(label) {
    try {
      const core = api().captureFullSave()?.stores[CORE_KEY];
      if (preparedGameId && preparedGameId === core?.createdAt) return true;
      if (!captureBeforeReplacement(label)) return false;
      preparedGameId = core?.createdAt || null;
      return true;
    } catch (_) { return fail(); }
  }
  function beforeNewGame() {
    try {
      const core = api().captureFullSave()?.stores[CORE_KEY];
      if (preparedGameId && preparedGameId === core?.createdAt) { preparedGameId = null; return true; }
      preparedGameId = null;
      return captureBeforeReplacement("开启新局前");
    } catch (_) { return fail(); }
  }

  function list() {
    const store = readStore();
    return [store.replacement && { ...store.replacement, slot: "replacement" }, ...store.months.map((entry, index) => ({ ...entry, slot: `month-${index}` }))].filter(Boolean);
  }
  function describe(bundle) {
    const core = bundle?.stores?.[CORE_KEY];
    if (!core) return { name: "尚无当前存档", version: "—" };
    const short = bundle.stores.xian_emperor_short_challenges_v230;
    const result = short?.results?.find(item => item.gameCreatedAt === core.createdAt);
    const id = short?.active?.gameCreatedAt === core.createdAt ? short.active.challengeId : result?.challengeId;
    const challenge = short?.customDefinitions?.[id] || window.XianShortChallenges?.getChallenges?.().find(item => item.id === id);
    const scenario = window.GAME_DATA.scenarios.find(item => item.id === core.scenarioId);
    return { name: challenge?.name || result?.name || scenario?.name || core.scenarioId, version: bundle.version || core.version || "未知" };
  }
  function compare(bundle, current) {
    const saved = bundle.stores[CORE_KEY], live = current?.stores?.[CORE_KEY];
    const fields = [["turn", "月份"], ["actionPoints", "剩余行动"], ["stats.authority", "皇权"], ["stats.prestige", "汉室威望"],
      ["stats.security", "宫廷安全"], ["stats.treasury", "国库"], ["stats.officials", "百官支持"], ["stats.caoAlert", "曹氏警戒"],
      ["hidden.leakRisk", "泄密风险"], ["hidden.loyalNetwork", "忠汉网络"], ["random.draws", "固定随机进度"]];
    const value = (core, path) => path.split(".").reduce((item, key) => item?.[key], core);
    return { differentGame: Boolean(live && live.createdAt !== saved.createdAt), current: describe(current), saved: describe(bundle),
      rows: fields.map(([path, label]) => ({ path, label, current: value(live, path) ?? null, saved: value(saved, path) ?? null })) };
  }
  function open() {
    let entries = [];
    try { entries = list(); } catch (_) { fail(); }
    api().openUtilityModal({ title: "完整存档备份", confirmText: "关闭", cancelHidden: true, wide: true,
      body: `<div class="save-backups"><p>每月首次稳定存档自动留档，保留最近三个。开启新局、重开、导入或恢复前另留一份完整备份。</p><p>恢复包含核心数值、军团、人物、随机进度、短局复盘与收藏；恢复后重新加载全部系统。</p>
        ${problem ? `<p role="alert" class="backup-error">${escape(problem)}</p>` : ""}
        ${entries.length ? entries.map(entry => {
          const info = describe(entry.bundle);
          const core = entry.bundle.stores[CORE_KEY];
          return `<article><div><small>${escape(entry.label)}</small><h3>${escape(info.name)} · 第 ${entry.turn} 月${entry.ended ? " · 已终局" : ""}</h3><p>${escape(api().formatReignDate(entry.year, entry.month))} · ${core.eventResolved ? "奏报已决" : "奏报待决"} · 行动 ${core.actionPoints}</p><p>国库 ${Math.round(core.stats.treasury)} · 安全 ${Math.round(core.stats.security)}${core.random ? ` · 随机进度 ${core.random.draws}` : ""}</p><p>备份时间 ${escape(new Date(entry.capturedAt).toLocaleString("zh-CN", { hour12: false }))} · 存档 v${escape(info.version)}</p></div><div class="backup-actions"><button type="button" class="secondary-button" data-backup-restore="${entry.slot}">恢复此完整备份</button><button type="button" class="secondary-button" data-backup-export="${entry.slot}">导出此完整备份</button></div></article>`;
        }).join("") : "<p>尚无完整备份。继续御览或开启新局后会自动留档。</p>"}
        <p class="backup-note">备份保存在本浏览器。清理网站数据会删除备份；换设备前请导出完整存档包。</p></div>`, onConfirm: api().closeUtilityModal });
    document.getElementById("modal-body").querySelectorAll("[data-backup-restore]").forEach(button => button.addEventListener("click", () => {
      const entry = entries.find(item => item.slot === button.dataset.backupRestore);
      let current = null;
      try { current = api().captureFullSave(); } catch (_) { api().notify("当前存档读取异常，请先检查或导出。", "warning"); }
      const difference = compare(entry.bundle, current);
      api().openUtilityModal({ title: "恢复完整备份", confirmText: "确认恢复并重新加载", wide: true,
        body: `<div class="backup-compare"><p>当前：${escape(difference.current.name)} · v${escape(difference.current.version)}<br>备份：${escape(difference.saved.name)} · v${escape(difference.saved.version)}</p>${difference.differentGame ? '<p class="backup-error">这是另一局的备份，确认后会切换到该局。</p>' : ""}<p>恢复至${escape(api().formatReignDate(entry.year, entry.month))}第 ${entry.turn} 月，${entry.ended ? "本局已终局" : "继续原局"}。军团、人物、随机进度与复盘将一起恢复。</p><table><thead><tr><th>项目</th><th>当前</th><th>恢复后</th></tr></thead><tbody>${difference.rows.map(row => `<tr class="${row.current !== row.saved ? "changed" : ""}"><th>${escape(row.label)}</th><td>${row.current == null ? "—" : Math.round(row.current * 100) / 100}</td><td>${row.saved == null ? "—" : Math.round(row.saved * 100) / 100}</td></tr>`).join("")}</tbody></table><p>恢复前会保留当前完整存档。确认后页面重新加载，请点击“继续御览”。</p></div>`,
        onConfirm: () => { if (api().restoreFullSave(entry.bundle)) api().closeUtilityModal(); } });
    }));
    document.getElementById("modal-body").querySelectorAll("[data-backup-export]").forEach(button => button.addEventListener("click", () => {
      const entry = entries.find(item => item.slot === button.dataset.backupExport);
      api().downloadFullSave(entry.bundle, `xian-emperor-backup-turn-${entry.turn}-${entry.slot}.json`);
    }));
  }

  const keys = new Set(api().getPortableStorageKeys());
  const previousSet = Storage.prototype.setItem, previousRemove = Storage.prototype.removeItem;
  Storage.prototype.setItem = function(key, value) {
    if (this === localStorage && keys.has(key) && window.__xianFullSaveImporting && !window.__xianFullSaveWriting) return;
    const result = previousSet.call(this, key, value);
    if (this === localStorage && keys.has(key)) queueCapture();
    return result;
  };
  Storage.prototype.removeItem = function(key) {
    if (this === localStorage && keys.has(key) && window.__xianFullSaveImporting && !window.__xianFullSaveWriting) return;
    const result = previousRemove.call(this, key);
    if (this === localStorage && keys.has(key)) queueCapture();
    return result;
  };
  document.addEventListener("xian:core-saved", queueCapture);
  document.addEventListener("DOMContentLoaded", () => {
    try { const core = JSON.parse(localStorage.getItem(CORE_KEY) || "null"); lastMonth = core ? keyFor(core) : null; } catch (_) {}
    ["backups-btn", "start-backups-btn", "ending-backups-btn"].forEach(id => document.getElementById(id)?.addEventListener("click", open));
    queueCapture();
  }, { once: true });
  window.XianSaveBackups = Object.freeze({ open, prepareReplacement, beforeNewGame, captureBeforeReplacement,
    compare: (bundle, current) => clone(compare(bundle, current)), getEntries: () => clone(list()), getProblem: () => problem });
})();
