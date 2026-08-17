/* 天子蒙尘：献帝模拟器 v2.9.0 · 朝局相因 */
(() => {
  "use strict";

  const VERSION = "2.9.0";
  const MAX_HISTORY = 36;
  const MAX_PENDING = 16;
  const MAX_PROCESSED = 80;
  let renderTimer = null;

  document.addEventListener("DOMContentLoaded", init, { once: true });
  document.addEventListener("xian:core-saved", queueRender);
  document.addEventListener("xian:decision-resolved", event => recordDecision(event.detail || {}));
  document.addEventListener("xian:external-action-completed", event => recordExternal(event.detail || {}, "行动"));
  document.addEventListener("xian:external-package-applied", event => recordExternal(event.detail || {}, "朝局"));
  document.addEventListener("xian:battle-report", event => recordBattle(event.detail || {}));
  document.addEventListener("xian:city-captured", event => recordCapture(event.detail || {}));
  document.addEventListener("xian:decree-world-impact", event => recordWorldImpact(event.detail || {}));
  document.addEventListener("xian:before-month-end", resolveMonth);

  function init() {
    document.getElementById("causal-court-panel")?.addEventListener("click", handlePanelClick);
    render();
  }

  function queueRender() {
    window.clearTimeout(renderTimer);
    renderTimer = window.setTimeout(render, 0);
  }

  function emptyCausality() {
    return {
      version: 290,
      pending: [],
      history: [],
      processedEventIds: [],
      metrics: {
        battles: 0,
        courtVictories: 0,
        courtDefeats: 0,
        citiesTaken: 0,
        citiesLost: 0,
        lastBattleTurn: 0,
        lastCaptureTurn: 0,
      },
      lastMonthResolved: 0,
      updatedAt: null,
    };
  }

  function normalize(value) {
    const base = emptyCausality();
    const current = value && typeof value === "object" ? value : {};
    return {
      ...base,
      ...current,
      version: 290,
      pending: Array.isArray(current.pending) ? current.pending.slice(0, MAX_PENDING) : [],
      history: Array.isArray(current.history) ? current.history.slice(0, MAX_HISTORY) : [],
      processedEventIds: Array.isArray(current.processedEventIds) ? current.processedEventIds.slice(-MAX_PROCESSED) : [],
      metrics: { ...base.metrics, ...(current.metrics || {}) },
    };
  }

  function commit(mutator) {
    const game = window.XianEmperorGame;
    const core = game?.getState?.();
    if (!core || core.ended || !game?.updateCausality) return null;
    const next = normalize(core.causality);
    const changed = mutator(next, core);
    if (changed === false) return null;
    next.updatedAt = new Date().toISOString();
    game.updateCausality(next);
    return next;
  }

  function addHistory(next, item) {
    next.history.unshift({
      id: item.id || `cause-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      turn: Number(item.turn || 1),
      type: item.type || "decision",
      title: item.title || "朝局变化",
      text: item.text || "一项御前处置改变了后续局势。",
      tags: Array.isArray(item.tags) ? item.tags : [],
      createdAt: new Date().toISOString(),
    });
    next.history = next.history.slice(0, MAX_HISTORY);
  }

  function markProcessed(next, id) {
    if (!id || next.processedEventIds.includes(id)) return false;
    next.processedEventIds.push(id);
    next.processedEventIds = next.processedEventIds.slice(-MAX_PROCESSED);
    return true;
  }

  function recordDecision(detail) {
    const id = `decision-${detail.createdAt || "game"}-${detail.turn || 0}-${detail.eventId || "event"}`;
    const tags = tagsFromPackage(detail);
    const saved = commit((next, core) => {
      if (!markProcessed(next, id)) return false;
      addHistory(next, {
        id,
        turn: detail.turn,
        type: "decision",
        title: detail.eventTitle || "御前裁决",
        text: `裁为“${detail.choiceLabel || "既定方案"}”，${describePackage(detail)}。`,
        tags,
      });
      scheduleDelayed(next, core, detail, id);
      return true;
    });
    if (!saved) return;
    applyChoiceLinks(detail);
    applyDerivedFactionEffects(detail, detail.eventTitle || "御前裁决");
    queueRender();
  }

  function recordExternal(detail, prefix) {
    const id = detail.id || `${prefix}-${detail.createdAt || "game"}-${detail.turn || 0}-${detail.title || "change"}`;
    const saved = commit(next => {
      if (!markProcessed(next, id)) return false;
      addHistory(next, {
        id,
        turn: detail.turn,
        type: prefix === "行动" ? "action" : "politics",
        title: detail.title || `${prefix}变化`,
        text: `${detail.text || "朝局受到影响"}${describePackage(detail) ? `；${describePackage(detail)}` : ""}。`,
        tags: tagsFromPackage(detail),
      });
      return true;
    });
    if (!saved) return;
    applyDerivedFactionEffects(detail, detail.title || prefix);
    queueRender();
  }

  function recordBattle(report) {
    const id = report.id || `battle-${report.turn || 0}-${report.cityId || "field"}`;
    const courtInvolved = [report.attackerOwner, report.defenderOwner].includes("court");
    const courtWon = report.victor === "court";
    const courtLost = courtInvolved && Boolean(report.victor) && report.victor !== "court";
    const losses = Number(report.attackerLosses || 0) + Number(report.defenderLosses || 0);
    const saved = commit(next => {
      if (!markProcessed(next, id)) return false;
      next.metrics.battles += 1;
      next.metrics.lastBattleTurn = Number(report.turn || 0);
      if (courtWon) next.metrics.courtVictories += 1;
      if (courtLost) next.metrics.courtDefeats += 1;
      addHistory(next, {
        id,
        turn: report.turn,
        type: "battle",
        title: report.title || "前线交兵",
        text: `${report.result || "战事未决"}，两军合计折损约${Math.round(losses).toLocaleString("zh-CN")}人；伤亡、军粮与抚恤将回到朝堂。`,
        tags: ["war", "finance", "people"],
      });
      next.pending.unshift({
        id: `war-debt-${id}`,
        kind: "war_debt",
        dueTurn: Number(report.turn || 0) + 1,
        source: report.title || "前线战事",
        text: "阵亡抚恤与伤兵转运将在下月继续消耗朝廷。",
      });
      next.pending = next.pending.slice(0, MAX_PENDING);
      return true;
    });
    if (!saved || !courtInvolved) return;
    const effects = courtWon
      ? { treasury: -2, prestige: 2 }
      : courtLost
        ? { treasury: -2, prestige: -3, officials: -1 }
        : { treasury: -1 };
    window.XianEmperorGame?.applyExternalPackage?.({
      effects,
      hidden: { peopleStability: losses >= 5000 ? -2 : -1 },
      report: {
        title: `战事入朝·${report.title || "前线"}`,
        text: courtWon ? "汉军得胜，但军费与抚恤已经记入度支。" : courtLost ? "败报入朝，国库、威望与官心同时受损。" : "两军相持，粮饷仍在持续消耗。",
        type: courtLost ? "danger" : "military",
      },
      causal: false,
    });
  }

  function recordCapture(capture) {
    const id = capture.id || `capture-${capture.turn || 0}-${capture.cityId || "city"}`;
    const taken = capture.newOwner === "court" && capture.previousOwner !== "court";
    const lost = capture.previousOwner === "court" && capture.newOwner !== "court";
    const saved = commit(next => {
      if (!markProcessed(next, id)) return false;
      if (taken) next.metrics.citiesTaken += 1;
      if (lost) next.metrics.citiesLost += 1;
      next.metrics.lastCaptureTurn = Number(capture.turn || 0);
      addHistory(next, {
        id,
        turn: capture.turn,
        type: "territory",
        title: taken ? "城池新附" : lost ? "州郡失守" : "城池易帜",
        text: taken ? "城池奉汉廷号令，但接管、安民和征赋尚待处置。" : lost ? "朝廷失去一处立足点，军心与名望随之动摇。" : "诸侯之间的控制权变化正在重排天下局势。",
        tags: ["territory", "war", taken ? "opportunity" : "danger"],
      });
      if (taken) {
        next.pending.unshift({
          id: `territory-revenue-${id}`,
          kind: "territory_revenue",
          dueTurn: Number(capture.turn || 0) + 2,
          cityId: capture.cityId,
          source: "新附州郡",
          text: "若城池仍归朝廷且民间尚稳，两月后将提供首批税粮。",
        });
      }
      next.pending = next.pending.slice(0, MAX_PENDING);
      return true;
    });
    if (!saved || (!taken && !lost)) return;
    window.XianEmperorGame?.applyExternalPackage?.({
      effects: taken ? { authority: 2, prestige: 3, treasury: -2 } : { authority: -2, prestige: -4, security: -2 },
      hidden: { peopleStability: capture.stance === "assault" ? -3 : -1 },
      report: {
        title: taken ? "新附州郡入朝" : "州郡失守入朝",
        text: taken ? "旗帜易换之后，朝廷必须为接管与安民先付代价。" : "失城不只改变舆图，也动摇朝廷威望与宫中安全感。",
        type: lost ? "danger" : "important",
      },
      causal: false,
    });
  }

  function recordWorldImpact(impact) {
    const id = impact.id || `world-${impact.reportTimestamp || Date.now()}`;
    commit(next => {
      if (!markProcessed(next, id)) return false;
      addHistory(next, {
        id,
        turn: impact.turn,
        type: "edict",
        title: impact.title || "诏令传于天下",
        text: impact.summary || impact.text || "诏令已经越过宫门，开始改变州郡态势。",
        tags: ["edict", "territory"],
      });
      return true;
    });
  }

  function scheduleDelayed(next, core, detail, sourceId) {
    const effects = detail.effects || {};
    const hidden = detail.hidden || {};
    let pending = null;
    if (Number(effects.treasury || 0) <= -4) {
      pending = { kind: "fiscal_drag", text: "这笔支出将在下月继续挤压俸给与日常度支。" };
    } else if (Number(hidden.peopleStability || 0) <= -4) {
      pending = { kind: "public_unrest", text: "民间代价尚未结束，下月可能形成新的流言与治安压力。" };
    } else if (Number(effects.officials || 0) <= -4 || Object.values(detail.relations || {}).some(value => Number(value) <= -6)) {
      pending = { kind: "official_resistance", text: "受损的官心与人物关系会在下月拖慢政令。" };
    }
    if (!pending) return;
    next.pending.unshift({
      id: `pending-${sourceId}`,
      ...pending,
      dueTurn: Number(core.turn || detail.turn || 1) + 1,
      source: detail.eventTitle || detail.title || "御前裁决",
    });
    next.pending = next.pending.slice(0, MAX_PENDING);
  }

  function resolveMonth() {
    const game = window.XianEmperorGame;
    const core = game?.getState?.();
    if (!core || core.ended) return;
    const current = normalize(core.causality);
    if (Number(current.lastMonthResolved || 0) >= Number(core.turn || 0)) return;
    const monthly = buildMonthlyConsequences(core, readSubsystems());
    const due = current.pending.filter(item => Number(item.dueTurn || 0) <= Number(core.turn || 0));
    const stillPending = current.pending.filter(item => Number(item.dueTurn || 0) > Number(core.turn || 0));
    due.forEach(item => mergePackage(monthly, resolvePending(item, core)));

    commit(next => {
      next.lastMonthResolved = Number(core.turn || 0);
      next.pending = stillPending;
      if (due.length || monthly.notes.length) {
        addHistory(next, {
          turn: core.turn,
          type: "monthly",
          title: "月末因果结算",
          text: [...due.map(item => item.text), ...monthly.notes].join("；") || "本月各系统未形成额外牵动。",
          tags: ["monthly"],
        });
      }
      return true;
    });

    if (!hasPackageChanges(monthly)) return;
    game.applyExternalPackage?.({
      effects: monthly.effects,
      hidden: monthly.hidden,
      report: {
        title: "朝局相因·月末结算",
        text: monthly.notes.join("；") || "旧事与当前局势在月末汇成新的结果。",
        type: monthly.danger ? "danger" : "neutral",
      },
      causal: false,
    });
  }

  function buildMonthlyConsequences(core, systems = {}) {
    const result = { effects: {}, hidden: {}, notes: [], danger: false };
    const factions = Object.values(systems.court?.factions || {});
    const maxTension = factions.length ? Math.max(...factions.map(item => Number(item.tension || 0))) : 0;
    if (maxTension >= 75) {
      result.effects.officials = -1;
      result.effects.security = -1;
      result.notes.push("派系张力过高，封驳与猜疑拖慢朝政");
      result.danger = true;
    }

    const courtArmies = Object.values(systems.army?.armies || {}).filter(army => army.owner === "court" && army.status !== "destroyed");
    const averageSupply = average(courtArmies.map(army => Number(army.supply || 0)), 100);
    if (courtArmies.length && averageSupply < 30) {
      result.effects.treasury = (result.effects.treasury || 0) - 1;
      result.effects.officials = (result.effects.officials || 0) - 1;
      result.notes.push("汉军平均粮秣不足三成，临时转运继续挤压度支");
      result.danger = true;
    }

    const courtCities = Object.values(systems.strategy?.cities || {}).filter(city => city.controller === "court");
    if (Number(core.turn || 0) % 3 === 0 && courtCities.length > 1 && Number(core.hidden?.peopleStability || 0) >= 40) {
      const revenue = Math.min(2, courtCities.length - 1);
      result.effects.treasury = (result.effects.treasury || 0) + revenue;
      result.notes.push(`${courtCities.length}处朝廷城池按季输送税粮，国库增加${revenue}`);
    }
    return result;
  }

  function resolvePending(item, core) {
    if (item.kind === "territory_revenue") {
      const city = readSubsystems().strategy?.cities?.[item.cityId];
      return city?.controller === "court" && Number(core.hidden?.peopleStability || 0) >= 35
        ? { effects: { treasury: 3 }, notes: [`${item.source}送来首批税粮`] }
        : { effects: {}, notes: [`${item.source}因控制不稳或民生不靖，未能如期输粮`] };
    }
    if (item.kind === "war_debt") return { effects: { treasury: -1 }, hidden: { peopleStability: -1 }, notes: [`${item.source}的抚恤与伤兵转运继续发生支出`], danger: true };
    if (item.kind === "fiscal_drag") return Number(core.stats?.treasury || 0) < 35
      ? { effects: { officials: -1, prestige: -1 }, notes: [`${item.source}留下的度支缺口开始拖欠俸给`], danger: true }
      : { effects: {}, notes: [`${item.source}留下的度支缺口已被补足`] };
    if (item.kind === "public_unrest") return Number(core.hidden?.peopleStability || 0) < 45
      ? { effects: { prestige: -1, security: -1 }, notes: [`${item.source}引发的民间不满继续发酵`], danger: true }
      : { effects: {}, notes: [`${item.source}造成的民间不满已经缓和`] };
    if (item.kind === "official_resistance") return Number(core.stats?.officials || 0) < 48
      ? { effects: { authority: -1 }, notes: [`${item.source}留下的官心裂痕使政令受阻`], danger: true }
      : { effects: {}, notes: [`${item.source}留下的官心裂痕已获修补`] };
    return { effects: {}, hidden: {}, notes: [] };
  }

  function deriveIssues(core, systems = readSubsystems()) {
    if (!core?.stats || !core?.hidden) return [];
    const causes = normalize(core.causality);
    const issues = [];
    const courtArmies = Object.values(systems.army?.armies || {}).filter(army => army.owner === "court" && army.status !== "destroyed");
    const averageSupply = average(courtArmies.map(army => Number(army.supply || 0)), 100);
    const courtCities = Object.values(systems.strategy?.cities || {}).filter(city => city.controller === "court");
    const routes = Object.values(systems.strategy?.routes || {});
    const strainedRoutes = routes.filter(route => Number(route.supply || 0) < 35 || Number(route.pressure || 0) > 70).length;
    const factions = Object.entries(systems.court?.factions || {});
    const hottestFaction = factions.sort((a, b) => Number(b[1].tension || 0) - Number(a[1].tension || 0))[0];
    const maxTension = Number(hottestFaction?.[1]?.tension || 0);
    const courtCharacterIds = new Set(["empress_fu", "dong_cheng", "yang_biao", "xun_yu", "cao_cao"]);
    const relations = Object.entries(core.relations || {}).filter(([id]) => courtCharacterIds.has(id));
    const coldest = relations.sort((a, b) => Number(a[1]) - Number(b[1]))[0];
    const coldestName = characterName(coldest?.[0]);

    if (Number(core.stats.treasury || 0) < 58 || averageSupply < 48) {
      const severity = clamp(Math.max(100 - Number(core.stats.treasury || 0), 100 - averageSupply), 20, 96);
      issues.push(issue("finance", "度支与军粮", severity,
        Number(core.stats.treasury || 0) < 35 ? "国库已经接近无法维持朝廷日常。" : averageSupply < 40 ? "前线粮秣不足正在反向挤压国库。" : "俸给、赈济与军运争夺同一笔钱粮。",
        `国库 ${Math.round(core.stats.treasury)} · 汉军平均粮秣 ${Math.round(averageSupply)}`,
        severity >= 70 ? "下月容易触发欠俸、断粮或加征奏报。" : "继续行军或大额支出会迅速放大压力。",
        "筹措钱粮", "revenue"));
    }

    if (Number(core.stats.caoAlert || 0) >= 52 || maxTension >= 55) {
      const severity = clamp(Math.max(Number(core.stats.caoAlert || 0), maxTension), 25, 98);
      issues.push(issue("court", "台府角力", severity,
        maxTension >= Number(core.stats.caoAlert || 0) ? `${factionName(hottestFaction?.[0])}张力最高，政令开始遭遇封驳。` : "曹氏警戒正在压缩天子的政治空间。",
        `曹氏警戒 ${Math.round(core.stats.caoAlert)} · 最高派系张力 ${Math.round(maxTension)}`,
        severity >= 72 ? "若不调停，下月可能出现尚书台封驳。" : "强硬诏令会提高阻力，妥协则损耗自主。",
        "查看政议", "court"));
    }

    if (Number(core.hidden.peopleStability || 0) < 55 || strainedRoutes > 0) {
      const severity = clamp(Math.max(100 - Number(core.hidden.peopleStability || 0), 42 + strainedRoutes * 8), 25, 96);
      issues.push(issue("people", "州郡民生", severity,
        strainedRoutes ? `${strainedRoutes}条军路正承受缺粮或高压，流民与盗乱风险上升。` : "征调与物价正在消耗民间稳定。",
        `民间稳定 ${Math.round(core.hidden.peopleStability)} · 紧张军路 ${strainedRoutes}`,
        severity >= 68 ? "下月可能出现流民、粮价或治安奏报。" : "赈济可缓解压力，但会消耗国库。",
        "赈济减赋", "relief"));
    }

    const recentWar = Number(core.turn || 0) - Number(causes.metrics.lastBattleTurn || 0) <= 2 && Number(causes.metrics.battles || 0) > 0;
    const activeSieges = Object.values(systems.army?.sieges || {}).filter(siege => siege.status === "active").length;
    if (recentWar || activeSieges || Number(causes.metrics.courtDefeats || 0) > 0) {
      const severity = clamp(48 + activeSieges * 14 + (recentWar ? 12 : 0) + Number(causes.metrics.courtDefeats || 0) * 4, 35, 95);
      issues.push(issue("war", "战事入朝", severity,
        activeSieges ? `${activeSieges}处围城仍在持续消耗兵员与粮秣。` : "近期战事的伤亡、抚恤和论功尚未结清。",
        `累计战事 ${causes.metrics.battles} · 汉军胜 ${causes.metrics.courtVictories} / 负 ${causes.metrics.courtDefeats}`,
        "战果会继续影响国库、民心、威望与人物忠诚。",
        "打开舆图", "map"));
    }

    if (coldest && Number(coldest[1]) < 45) {
      const severity = clamp(95 - Number(coldest[1]), 35, 88);
      issues.push(issue("person", "君臣旧隙", severity,
        `${coldestName}对天子的关系仅为 ${Math.round(coldest[1])}，旧事可能影响办事意愿。`,
        `最低关系 ${coldestName} ${Math.round(coldest[1])}`,
        "继续忽视时，人物可能拒绝差遣或在奏议中形成阻力。",
        "召见人物", "audience"));
    }

    if (courtCities.length > 1 || Number(causes.metrics.citiesTaken || 0) > 0) {
      const severity = clamp(45 + courtCities.length * 5 + Number(causes.metrics.citiesTaken || 0) * 3, 40, 80);
      issues.push(issue("territory", "新附州郡", severity,
        `朝廷直接控制${courtCities.length}处城池，城防、征税与安民开始进入同一账簿。`,
        `朝廷城池 ${courtCities.length} · 累计新附 ${causes.metrics.citiesTaken}`,
        "民稳足够时每季可得税粮，过度征收则会降低忠诚。",
        "查看舆图", "map"));
    }

    if (issues.length < 3) {
      const severity = clamp(100 - Math.min(Number(core.stats.authority || 0), Number(core.stats.officials || 0)), 30, 78);
      issues.push(issue("governance", "政令执行", severity,
        "皇权决定命令能否越过宫门，百官支持决定命令能否落到簿册。",
        `皇权 ${Math.round(core.stats.authority)} · 百官 ${Math.round(core.stats.officials)}`,
        "两者失衡时，自由诏令和人物差遣都会层层折损。",
        "任免封赏", "appointment"));
    }
    if (issues.length < 3) {
      const balance = Number(core.hidden.externalBalance || 0);
      issues.push(issue("balance", "外镇制衡", clamp(90 - balance, 30, 75),
        "汉廷仍需借外镇声势，牵制许都单一权力来源。",
        `外部制衡 ${Math.round(balance)} · 汉室威望 ${Math.round(core.stats.prestige)}`,
        "封爵能换来名义支持，也会稀释官爵并刺激曹氏。",
        "结交外镇", "regional"));
    }
    if (issues.length < 3) {
      issues.push(issue("security", "宫禁安危", clamp(100 - Number(core.stats.security || 0), 25, 76),
        "宫门、密使和宿卫仍是天子能够行动的底线。",
        `宫廷安全 ${Math.round(core.stats.security)} · 泄密风险 ${Math.round(core.hidden.leakRisk)}`,
        "泄密与低安全叠加时，已有布局可能提前暴露。",
        "安抚曹氏", "appease"));
    }
    return issues.sort((a, b) => b.severity - a.severity).slice(0, 3);
  }

  function selectEventId(core) {
    if (!core || Number(core.turn || 0) <= 1 || core.ended) return null;
    const map = {
      finance: "causal_grain_and_army",
      war: "causal_war_aftermath",
      court: "causal_faction_deadlock",
      people: "causal_refugees",
      person: "causal_personal_appeal",
      territory: "causal_new_territory",
    };
    const recent = new Set(core.recentEventIds || []);
    const candidate = deriveIssues(core).find(item => map[item.id] && !recent.has(map[item.id]));
    if (!candidate) return null;
    if (candidate.severity < 58 && Number(core.turn || 0) % 3 !== 0) return null;
    return map[candidate.id];
  }

  function applyChoiceLinks(detail) {
    const event = (window.GAME_DATA?.causalEvents || []).find(item => item.id === detail.eventId);
    const choice = event?.choices?.[Number(detail.choiceIndex || 0)];
    const links = choice?.causalLinks;
    if (!links) return;
    if (links.army) window.XianArmySystem?.applyCausalEffects?.({ ...links.army, reason: `${event.title}·${choice.label}` });
    if (links.factions) window.XianCourtPolitics?.applyCausalEffects?.({ factions: links.factions, reason: `${event.title}·${choice.label}` });
    if (links.strategy) applyStrategyLinks(links.strategy, `${event.title}·${choice.label}`);
  }

  function applyStrategyLinks(links, reason) {
    const state = window.XianStrategyNetwork?.getState?.();
    if (!state) return;
    const cities = {};
    const routes = {};
    if (links.courtCities) {
      Object.entries(state.cities || {}).filter(([, city]) => city.controller === "court").forEach(([id]) => {
        cities[id] = { ...links.courtCities, reason };
      });
    }
    if (links.strainedRoutes) {
      Object.entries(state.routes || {})
        .filter(([, route]) => Number(route.supply || 0) < 50 || Number(route.pressure || 0) > 55)
        .slice(0, 6)
        .forEach(([id]) => { routes[id] = { ...links.strainedRoutes, reason }; });
    }
    if (Object.keys(cities).length || Object.keys(routes).length) {
      window.XianStrategyNetwork?.applyCampaignEffects?.({ cities, routes, reason, log: `${reason}改变了州郡与军路态势。` });
    }
  }

  function applyDerivedFactionEffects(detail, reason) {
    const effects = detail.effects || {};
    const hidden = detail.hidden || {};
    const factions = {};
    if (Number(effects.authority || 0) >= 4) factions.imperial = { support: 2 };
    if (Number(effects.caoAlert || 0) >= 4) factions.cao = { ...(factions.cao || {}), tension: 2, support: -1 };
    if (Number(effects.caoAlert || 0) <= -3) factions.cao = { ...(factions.cao || {}), tension: -2, support: 1 };
    if (Number(hidden.peopleStability || 0) >= 4) factions.gentry = { support: 2, tension: -1 };
    if (Number(hidden.peopleStability || 0) <= -4) factions.gentry = { support: -2, tension: 2 };
    if (Object.keys(factions).length) window.XianCourtPolitics?.applyCausalEffects?.({ factions, reason: `${reason}牵动派系态度` });
  }

  function render() {
    const root = document.getElementById("causal-court-panel");
    const core = window.XianEmperorGame?.getState?.();
    if (!root) return;
    if (!core || core.ended) {
      root.innerHTML = "";
      root.classList.add("hidden");
      return;
    }
    root.classList.remove("hidden");
    const issues = deriveIssues(core);
    const pending = normalize(core.causality).pending.filter(item => Number(item.dueTurn || 0) > Number(core.turn || 0));
    root.innerHTML = `
      <header class="causal-court-heading">
        <div><span class="section-kicker">朝局相因</span><h2>当前三件大事</h2><p>每一项都来自真实数值、人物、派系或战场；处理结果会进入后续奏报。</p></div>
        <div class="causal-court-legend"><span><i class="stable"></i>可控</span><span><i class="tense"></i>紧张</span><span><i class="critical"></i>危急</span></div>
      </header>
      <div class="causal-issue-grid">
        ${issues.map((item, index) => renderIssue(item, index)).join("")}
      </div>
      <footer class="causal-court-footer">
        <span>${pending.length ? `${pending.length}项后果将在以后月份兑现` : "当前没有等待兑现的延迟后果"}</span>
        <button type="button" data-causal-history>查看因果记录</button>
      </footer>`;
  }

  function renderIssue(item, index) {
    const level = item.severity >= 74 ? "critical" : item.severity >= 55 ? "tense" : "stable";
    return `<article class="causal-issue ${level}">
      <header><span>${String(index + 1).padStart(2, "0")}</span><div><small>${level === "critical" ? "危急" : level === "tense" ? "紧张" : "可控"}</small><h3>${escapeHtml(item.title)}</h3></div><b>${Math.round(item.severity)}</b></header>
      <p class="causal-origin"><strong>起因</strong>${escapeHtml(item.cause)}</p>
      <p><strong>牵动</strong>${escapeHtml(item.impact)}</p>
      <p><strong>后续</strong>${escapeHtml(item.next)}</p>
      <button type="button" data-causal-remedy="${escapeHtml(item.remedyTarget)}">${escapeHtml(item.remedyLabel)}<span>→</span></button>
    </article>`;
  }

  function handlePanelClick(event) {
    const remedy = event.target.closest?.("[data-causal-remedy]");
    if (remedy) return openRemedy(remedy.dataset.causalRemedy);
    if (event.target.closest?.("[data-causal-history]")) showHistory();
  }

  function openRemedy(target) {
    if (target === "map") {
      document.getElementById("world-map-btn")?.click();
      return;
    }
    if (target === "court") {
      document.getElementById("court-politics-btn")?.click();
      return;
    }
    const action = document.querySelector(`[data-action-id="${target}"]`);
    document.querySelector(`[data-action-category-tab="${action?.closest("[data-action-category-group]")?.dataset.actionCategoryGroup || "domestic"}"]`)?.click();
    document.querySelector(".action-panel")?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => action?.click(), 220);
  }

  function showHistory() {
    const core = window.XianEmperorGame?.getState?.();
    const history = normalize(core?.causality).history.slice(0, 12);
    const body = history.length
      ? `<section class="causal-history-list">${history.map(item => `<article><span>第 ${item.turn} 月</span><div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.text)}</p></div></article>`).join("")}</section>`
      : '<p class="empty-state">本局尚未形成可追溯的跨系统因果。</p>';
    let overlay = document.getElementById("causal-history-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "causal-history-overlay";
      overlay.className = "causal-history-overlay hidden";
      document.body.appendChild(overlay);
      overlay.addEventListener("click", event => {
        if (event.target === overlay || event.target.closest?.("[data-causal-history-close]")) overlay.classList.add("hidden");
      });
    }
    overlay.innerHTML = `<section class="causal-history-window" role="dialog" aria-modal="true" aria-labelledby="causal-history-title"><header><div><span class="section-kicker">前因后果</span><h2 id="causal-history-title">朝局因果记录</h2></div><button type="button" data-causal-history-close aria-label="关闭">×</button></header>${body}</section>`;
    overlay.classList.remove("hidden");
  }

  function readSubsystems() {
    return {
      army: window.XianArmySystem?.getState?.() || null,
      strategy: window.XianStrategyNetwork?.getState?.() || null,
      court: window.XianCourtPolitics?.diagnostics?.() || null,
    };
  }

  function tagsFromPackage(pkg = {}) {
    const tags = new Set();
    const effects = pkg.effects || {};
    const hidden = pkg.hidden || {};
    const relations = pkg.relations || {};
    if (Number(effects.treasury || 0)) tags.add("finance");
    if (Number(effects.authority || 0) || Number(effects.officials || 0) || Number(effects.caoAlert || 0)) tags.add("court");
    if (Number(effects.security || 0) || Number(hidden.leakRisk || 0)) tags.add("security");
    if (Number(hidden.peopleStability || 0)) tags.add("people");
    if (Number(hidden.externalBalance || 0)) tags.add("diplomacy");
    if (Object.values(relations).some(value => Number(value))) tags.add("person");
    return [...tags];
  }

  function describePackage(pkg = {}) {
    const labels = { authority: "皇权", prestige: "威望", security: "宫禁", treasury: "国库", officials: "百官", caoAlert: "曹氏警戒", peopleStability: "民稳", externalBalance: "制衡", leakRisk: "泄密" };
    const values = [];
    Object.entries(pkg.effects || {}).forEach(([key, value]) => { if (Number(value)) values.push(`${labels[key] || key}${signed(value)}`); });
    Object.entries(pkg.hidden || {}).forEach(([key, value]) => { if (Number(value)) values.push(`${labels[key] || key}${signed(value)}`); });
    const relationCount = Object.values(pkg.relations || {}).filter(value => Number(value)).length;
    if (relationCount) values.push(`${relationCount}段人物关系改变`);
    return values.join("、");
  }

  function mergePackage(target, source = {}) {
    Object.entries(source.effects || {}).forEach(([key, value]) => { target.effects[key] = (target.effects[key] || 0) + Number(value || 0); });
    Object.entries(source.hidden || {}).forEach(([key, value]) => { target.hidden[key] = (target.hidden[key] || 0) + Number(value || 0); });
    target.notes.push(...(source.notes || []));
    target.danger = target.danger || Boolean(source.danger);
    return target;
  }

  function hasPackageChanges(pkg) {
    return Object.values(pkg.effects || {}).some(value => Number(value)) || Object.values(pkg.hidden || {}).some(value => Number(value)) || pkg.notes.length;
  }

  function issue(id, title, severity, cause, impact, next, remedyLabel, remedyTarget) {
    return { id, title, severity: clamp(severity, 0, 100), cause, impact, next, remedyLabel, remedyTarget };
  }

  function factionName(id) {
    return { imperial: "帝后近臣", loyalists: "汉室旧臣", cao: "曹氏幕府", regional: "地方诸侯", gentry: "州郡士族" }[id] || "朝中派系";
  }

  function characterName(id) {
    return window.GAME_DATA?.characters?.find(item => item.id === id)?.name || id || "关键人物";
  }

  function average(values, fallback = 0) {
    return values.length ? values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length : fallback;
  }

  function signed(value) { return Number(value) > 0 ? `+${Number(value)}` : String(Number(value)); }
  function clamp(value, min, max) { return Math.min(max, Math.max(min, Number(value) || 0)); }
  function escapeHtml(value) { return String(value ?? "").replace(/[&<>'"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char])); }

  window.XianCausalCourt = Object.freeze({
    version: VERSION,
    deriveIssues,
    selectEventId,
    buildMonthlyConsequences,
    getState: () => normalize(window.XianEmperorGame?.getState?.()?.causality),
  });
})();
