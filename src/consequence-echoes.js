/* 天子蒙尘：献帝模拟器 v2.2.0 · 旧事重提 */
(() => {
  "use strict";

  const CORE_KEY = "xian_emperor_simulator_v01";
  const STORE_KEY = "xian_emperor_consequence_echoes_v220";
  const MAX_RECORDS = 48;
  const PROMISE_WORDS = /许|诺|允|援|赈|封|授|安抚|保全|接纳|支持|开仓/;
  const STAT_NAMES = { authority: "皇权", prestige: "汉室威望", security: "宫廷安全", treasury: "国库", officials: "百官支持", caoAlert: "曹氏警戒" };
  const CHARACTER_PACKAGES = {
    cao_cao: { support: { effects: { security: 2, caoAlert: -2 } }, resentment: { effects: { caoAlert: 3 } } },
    yuan_shao: { support: { effects: { prestige: 2 }, hidden: { externalBalance: 2 } }, resentment: { effects: { prestige: -1 }, hidden: { externalBalance: -2 } } },
    yuan_shu: { support: { effects: { treasury: 2 } }, resentment: { effects: { prestige: -2 } } },
    liu_biao: { support: { effects: { prestige: 1 }, hidden: { escapeRoute: 2 } }, resentment: { hidden: { escapeRoute: -2 } } },
    sun_ce: { support: { effects: { prestige: 2 } }, resentment: { hidden: { externalBalance: -2 } } },
    empress_fu: { support: { effects: { security: 2 } }, resentment: { effects: { security: -2 } } },
    dong_cheng: { support: { hidden: { loyalNetwork: 2, leakRisk: -1 } }, resentment: { hidden: { loyalNetwork: -2, leakRisk: 2 } } },
  };

  let store = loadStore();
  let resolving = false;

  document.addEventListener("DOMContentLoaded", init, { once: true });
  document.addEventListener("xian:decision-resolved", event => recordDecision(event.detail || {}));
  document.addEventListener("xian:before-month-end", () => resolveDueRecord());

  function init() {
    window.XianCommandCenter?.registerTab?.({
      id: "echoes",
      label: "旧事重提",
      kicker: "v2.2.0 · 因果回响",
      title: "承诺有期限，选择有回声",
      render: renderTab,
    });
  }

  function recordDecision(detail) {
    const core = window.XianEmperorGame?.getState?.() || readCore();
    if (!core || detail.createdAt !== core.createdAt) return;
    const relations = Object.entries(detail.relations || {}).filter(([, value]) => Number(value));
    const dominant = [...relations].sort((a, b) => Math.abs(Number(b[1])) - Math.abs(Number(a[1])))[0];
    const direction = relations.reduce((sum, [, value]) => sum + Number(value || 0), 0) >= 0 ? "support" : "resentment";
    const delay = 2 + stableHash(`${detail.eventId}:${detail.choiceIndex}`) % 3;
    const record = {
      id: `echo-${Date.now()}-${stableHash(detail.eventId || "event")}`,
      type: "echo",
      gameCreatedAt: core.createdAt,
      createdTurn: Number(detail.turn || core.turn),
      dueTurn: Number(detail.turn || core.turn) + delay,
      status: "pending",
      eventTitle: detail.eventTitle || "朝堂裁决",
      choiceLabel: detail.choiceLabel || "御前裁决",
      characterId: dominant?.[0] || null,
      direction,
      date: detail.date || "御前",
    };
    store.records.unshift(record);

    if (dominant && Number(dominant[1]) > 0 && PROMISE_WORDS.test(`${detail.choiceLabel || ""}${detail.chronicle || ""}`)) {
      const [statKey, statValue] = selectPromiseStat(detail.effects || {}, core.stats || {});
      store.records.unshift({
        id: `promise-${Date.now()}-${stableHash(detail.choiceLabel || "promise")}`,
        type: "promise",
        gameCreatedAt: core.createdAt,
        createdTurn: Number(detail.turn || core.turn),
        dueTurn: Number(detail.turn || core.turn) + 3,
        status: "pending",
        eventTitle: detail.eventTitle || "朝堂承诺",
        choiceLabel: detail.choiceLabel || "御前承诺",
        characterId: dominant[0],
        relationTarget: Math.max(35, Number(core.relations?.[dominant[0]] || 50) - 3),
        statKey,
        statTarget: statValue,
        date: detail.date || "御前",
      });
    }
    trimAndSave();
    window.XianCommandCenter?.refresh?.();
  }

  function selectPromiseStat(effects, stats) {
    const positive = Object.entries(effects).filter(([key, value]) => key !== "caoAlert" && Number(value) > 0).sort((a, b) => Number(b[1]) - Number(a[1]))[0];
    const key = positive?.[0] || "prestige";
    return [key, Math.max(20, Math.round(Number(stats[key] || 0) - 5))];
  }

  function resolveDueRecord() {
    if (resolving) return;
    const core = readCore();
    if (!core || core.ended) return;
    const due = store.records
      .filter(item => item.status === "pending" && item.gameCreatedAt === core.createdAt && Number(item.dueTurn) <= Number(core.turn))
      .sort((a, b) => (a.type === "promise" ? -1 : 1) - (b.type === "promise" ? -1 : 1) || a.dueTurn - b.dueTurn)[0];
    if (!due) return;
    resolving = true;
    const outcome = due.type === "promise" ? evaluatePromise(due, core) : evaluateEcho(due, core);
    const character = characterById(due.characterId);
    due.status = outcome.success ? "fulfilled" : "broken";
    due.resolvedTurn = core.turn;
    due.outcome = outcome.text;
    window.XianEmperorGame?.applyExternalPackage?.({
      ...(outcome.package || {}),
      report: { title: due.type === "promise" ? "旧诺有验" : "旧事重提", text: outcome.text, type: outcome.success ? "important" : "warning" },
      chronicle: `${character?.name || "朝野"}因旧日“${due.choiceLabel}”而有后续。`,
    });
    trimAndSave();
    window.XianCommandCenter?.refresh?.();
    resolving = false;
  }

  function evaluatePromise(record, core) {
    const relation = Number(core.relations?.[record.characterId] || 0);
    const stat = Number(core.stats?.[record.statKey] || 0);
    const success = relation >= record.relationTarget && stat >= record.statTarget;
    const name = characterById(record.characterId)?.name || "旧臣";
    return success
      ? { success: true, text: `${name}见天子并未在承诺后转身相弃，旧诺兑现，君臣更愿彼此托付。`, package: { effects: { prestige: 1 }, relations: { [record.characterId]: 2 } } }
      : { success: false, text: `${name}重提旧诺，却发现朝局已无法维持当时的许诺，信任因此受损。`, package: { effects: { officials: -1 }, relations: { [record.characterId]: -3 } } };
  }

  function evaluateEcho(record, core) {
    const name = characterById(record.characterId)?.name || "朝野之人";
    const relation = Number(core.relations?.[record.characterId] || 50);
    const recovered = record.direction === "resentment" && relation >= 58;
    if (recovered) return { success: true, text: `${name}本欲追究旧事，但后来的往来缓和了芥蒂，此事终于没有再起波澜。`, package: { relations: record.characterId ? { [record.characterId]: 1 } : {} } };
    const mood = record.direction === "support" ? "support" : "resentment";
    const packageData = CHARACTER_PACKAGES[record.characterId]?.[mood] || (mood === "support" ? { effects: { prestige: 1 } } : { effects: { officials: -1 } });
    return mood === "support"
      ? { success: true, text: `${name}记得天子曾作出的“${record.choiceLabel}”，在今日朝局中回以一份有限的支持。`, package: { ...packageData, relations: record.characterId ? { [record.characterId]: 1 } : {} } }
      : { success: false, text: `${name}没有忘记“${record.choiceLabel}”留下的芥蒂，旧事在今日重新成为阻力。`, package: { ...packageData, relations: record.characterId ? { [record.characterId]: -1 } : {} } };
  }

  function renderTab() {
    const core = readCore();
    if (!core) return '<div class="command-empty">开始一局后，重要承诺与延迟回响会记录在这里。</div>';
    const visible = store.records.filter(item => item.gameCreatedAt === core.createdAt).slice(0, 16);
    const pending = visible.filter(item => item.status === "pending");
    return `
      <div class="echo-summary"><div><span>尚未落定</span><strong>${pending.length}</strong></div><p>每月最多处理一项旧事；回响只产生小幅影响，不会形成倍率滚雪球。</p></div>
      <section class="echo-list">${visible.length ? visible.map(item => renderRecord(item, core)).join("") : '<div class="command-empty">尚无足以留下回声的决定。</div>'}</section>`;
  }

  function renderRecord(item, core) {
    const character = characterById(item.characterId);
    const pending = item.status === "pending";
    const condition = item.type === "promise" ? `${STAT_NAMES[item.statKey] || item.statKey}≥${item.statTarget}，${character?.name || "相关人物"}关系≥${item.relationTarget}` : `预计第 ${item.dueTurn} 月出现后续`;
    return `<article class="echo-record ${item.status}"><header><div><span>${item.type === "promise" ? "御前承诺" : "因果回响"}</span><strong>${escapeHtml(item.eventTitle)}</strong></div><b>${pending ? `第 ${Math.max(0, item.dueTurn - Number(core.turn || 0))} 月后` : item.status === "fulfilled" ? "已兑现" : "已失信"}</b></header><p>“${escapeHtml(item.choiceLabel)}”</p><small>${escapeHtml(pending ? condition : item.outcome || "此事已经落定。")}</small></article>`;
  }

  function trimAndSave() { store.records = store.records.slice(0, MAX_RECORDS); saveStore(); }
  function stableHash(value) { return [...String(value || "")].reduce((sum, char) => (sum * 31 + char.charCodeAt(0)) >>> 0, 7); }
  function characterById(id) { return window.GAME_DATA?.characters?.find(item => item.id === id); }
  function defaultStore() { return { version: 1, records: [] }; }
  function loadStore() { try { const value = JSON.parse(localStorage.getItem(STORE_KEY) || "null"); return { ...defaultStore(), ...(value || {}), records: Array.isArray(value?.records) ? value.records : [] }; } catch (_) { return defaultStore(); } }
  function saveStore() { try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch (error) { console.warn("旧事回响保存失败", error); } }
  function readCore() { try { const value = JSON.parse(localStorage.getItem(CORE_KEY) || "null"); return value?.stats ? value : null; } catch (_) { return null; } }
  function escapeHtml(value) { return window.XianCommandCenter?.escapeHtml?.(value) || String(value ?? ""); }

  window.XianConsequenceEchoes = Object.freeze({
    evaluatePromise,
    selectPromiseStat,
    getState: () => JSON.parse(JSON.stringify(store)),
  });
})();
