/* Current cast and faction identities. Historical IDs are never reassigned to successors. */
(() => {
  "use strict";
  const BASE = () => window.GAME_DATA?.characters || [];
  const EXTRAS = [
    { id: "cao_pi", name: "曹丕", title: "魏王", faction: "cao_group", initials: "丕", relation: 50, influence: 85, fromYear: 220, profile: "延康剧本中魏王府的当前代表。个人关系独立建立，不继承曹操的记忆和个人承诺。", publicTraits: ["掌权", "重名分"] },
    { id: "court_secretariat", name: "尚书台使署", title: "机构角色 · 文书与官署", faction: "han_loyalists", initials: "台", relation: 50, influence: 50, institution: true, profile: "游戏化机构角色，代表在任承办官署，不影射一位未经确认的历史人物。", publicTraits: ["成法", "承办"] },
    { id: "palace_office", name: "宫中使署", title: "机构角色 · 宫禁与宗室", faction: "imperial", initials: "宫", relation: 50, influence: 40, institution: true, profile: "游戏化机构角色，承办宫禁与宗室联络，不继承伏皇后的个人经历。", publicTraits: ["持重", "护持"] },
    { id: "hebei_envoy", name: "河北使署", title: "机构角色 · 河北联络", faction: "regional_lords", initials: "冀", relation: 50, influence: 50, institution: true, ownerKey: "yuan_shao" },
    { id: "huainan_envoy", name: "淮南使署", title: "机构角色 · 淮南联络", faction: "regional_lords", initials: "淮", relation: 50, influence: 40, institution: true, ownerKey: "yuan_shu" },
    { id: "jingzhou_envoy", name: "荆州使署", title: "机构角色 · 荆州联络", faction: "regional_lords", initials: "荆", relation: 50, influence: 50, institution: true, ownerKey: "liu_biao" },
    { id: "wu_envoy", name: "江东使署", title: "机构角色 · 江东联络", faction: "regional_lords", initials: "吴", relation: 50, influence: 50, institution: true, ownerKey: "sun_ce" },
  ];
  // Conservative year boundaries, not invented dates of death. Stage casts may persist until year end.
  const LIMITS = { empress_fu: { from: 195, until: 215 }, dong_cheng: { until: 200 }, xun_yu: { until: 213 }, cao_cao: { until: 220 }, yuan_shao: { until: 203 }, yuan_shu: { until: 200 }, liu_biao: { until: 209 }, sun_ce: { until: 201 } };
  const FACTION_NAMES = { cao_cao: "魏王府", yuan_shao: "河北州郡", yuan_shu: "淮南州郡", liu_biao: "荆州州郡", sun_ce: "江东", liu_zhang: "益州州郡", zhang_lu: "汉中州郡", ma_han: "凉州诸镇", lu_bu: "徐州州郡", gongsun_zan: "幽州州郡", court: "汉廷", fragmented: "地方势力" };
  const EXTRA_REPRESENTATIVES = { cao_cao: "cao_pi", yuan_shao: "hebei_envoy", yuan_shu: "huainan_envoy", liu_biao: "jingzhou_envoy", sun_ce: "wu_envoy" };
  function year(core) {
    if (Number.isFinite(Number(core?.year)) && Number(core.year) > 0) return Number(core.year);
    const scenario = window.GAME_DATA?.scenarios?.find(item => item.id === core?.scenarioId);
    return Number(scenario?.startYear || 196) + Math.floor((Number(scenario?.startMonth || 1) - 1 + Math.max(0, Number(core?.turn || 1) - 1)) / 12);
  }
  function allCharacters() {
    return [...BASE(), ...EXTRAS].map(item => ({
      profile: item.institution ? "游戏化地区使署，承办当前往来与奉表；不是某位已故人物的延续，机构关系独立记录。" : "当前剧本人物。",
      ...item,
      publicTraits: Array.isArray(item.publicTraits) ? [...item.publicTraits] : item.institution ? ["机构联络", "有条件合作"] : [],
    }));
  }
  function getCharacter(id) { return allCharacters().find(item => item.id === id) || null; }
  function isAvailable(id, core) {
    const person = getCharacter(id); if (!person) return false;
    const currentYear = year(core), limits = LIMITS[id];
    if (person.institution && currentYear < 220 && !(id === "palace_office" && currentYear < 195) && !(person.ownerKey && !isAvailable(person.ownerKey, core))) return false;
    if (limits && ((limits.from && currentYear < limits.from) || (limits.until && currentYear >= limits.until))) return false;
    if (person.fromYear && currentYear < person.fromYear) return false;
    if (person.ownerKey) return !isAvailable(person.ownerKey, core);
    return true;
  }
  function availableCharacters(core, options = {}) {
    const action = typeof options === "string" ? options : options.action;
    return allCharacters().filter(item => item.id !== "liu_xie" && isAvailable(item.id, core)).filter(item => {
      if (action === "appointment") return !["cao_cao", "cao_pi"].includes(item.id);
      if (action === "secret") return ["empress_fu", "dong_cheng", "yang_biao", "yuan_shao", "liu_biao", "sun_ce", "court_secretariat", "palace_office", "hebei_envoy", "jingzhou_envoy", "wu_envoy"].includes(item.id);
      if (action === "regional") return item.faction === "regional_lords";
      return true;
    });
  }
  function representative(ownerKey, core) {
    if (isAvailable(ownerKey, core)) return getCharacter(ownerKey);
    const def = window.XIAN_STRATEGY_DATA?.lords?.find(item => item.id === ownerKey) || window.XIAN_WORLD_DATA?.lords?.find(item => item.id === ownerKey);
    if (year(core) < 220 && !getCharacter(ownerKey) && def) return { id: ownerKey, name: def.name, title: "地方代表（开局角色池）", faction: "regional_lords", relation: 50 };
    const id = EXTRA_REPRESENTATIVES[ownerKey];
    if (id && isAvailable(id, core)) return getCharacter(id);
    return { id: `mission:${ownerKey}`, name: `${FACTION_NAMES[ownerKey] || def?.name || "地方"}使署`, title: "机构角色 · 地方联络", faction: "regional_lords", institution: true, relation: 50 };
  }
  function faction(ownerKey, core) {
    const def = window.XIAN_STRATEGY_DATA?.lords?.find(item => item.id === ownerKey) || window.XIAN_WORLD_DATA?.lords?.find(item => item.id === ownerKey);
    const person = representative(ownerKey, core);
    const useInstitution = year(core) >= 220 || (getCharacter(ownerKey) && !isAvailable(ownerKey, core));
    return { id: ownerKey, name: useInstitution ? FACTION_NAMES[ownerKey] || def?.name || ownerKey : def?.name || person?.name || ownerKey,
      representativeId: person.id, representativeName: person.name, institution: person.institution === true };
  }
  function commander(id, ownerKey, core) {
    const legacy = window.XIAN_ARMY_DATA?.commanders?.find(item => item.id === id) || { id, name: getCharacter(id)?.name || id };
    if (year(core) < 220 && (!getCharacter(id) || isAvailable(id, core))) return { ...legacy };
    return { ...legacy, id: `military-office:${ownerKey}`, name: `${faction(ownerKey, core).name}军司（机构）`, institution: true, formerId: id };
  }
  function diplomaticTargets(text, core) {
    const source = String(text || "");
    return (window.XIAN_STRATEGY_DATA?.lords || window.XIAN_WORLD_DATA?.lords || []).map(lord => {
      const person = representative(lord.id, core), current = faction(lord.id, core);
      const usesOriginalCast = isAvailable(lord.id, core) || (year(core) < 220 && !getCharacter(lord.id));
      const names = usesOriginalCast ? [lord.name, ...(lord.aliases || [])] : [current.name, person.name, ...(lord.id === "cao_cao" && year(core) >= 220 ? ["曹丕", "魏王", "曹氏"] : [])];
      const positions = names.filter(Boolean).map(name => source.indexOf(name)).filter(index => index >= 0);
      return { id: lord.id, position: positions.length ? Math.min(...positions) : -1 };
    }).filter(item => item.position >= 0).sort((a, b) => a.position - b.position).map(item => item.id);
  }
  function validateTargets(text, core) {
    const source = String(text || ""), unavailable = BASE().filter(person => person.id !== "liu_xie" && !isAvailable(person.id, core) && source.includes(person.name));
    return { ok: !unavailable.length, unavailable: unavailable.map(item => item.id), reason: unavailable.length ? `当前剧本中${unavailable.map(item => item.name).join("、")}不可受命；请改用当前人物或使署。` : "" };
  }
  function initialRelations(core, existing = {}) {
    const result = { ...existing };
    for (const person of availableCharacters(core)) if (!Number.isFinite(result[person.id])) result[person.id] = Number(person.relation || 50);
    return result;
  }
  function presentEvent(event, core) {
    if (!event || event.story220 || !core) return event;
    const roleIds = { empress_fu: "palace_office", dong_cheng: "court_secretariat", xun_yu: "court_secretariat", cao_cao: "cao_pi", yuan_shao: "hebei_envoy", yuan_shu: "huainan_envoy", liu_biao: "jingzhou_envoy", sun_ce: "wu_envoy" };
    const inactive = BASE().filter(person => !isAvailable(person.id, core));
    const serialized = JSON.stringify(event);
    const affected = inactive.filter(person => serialized.includes(person.name) || serialized.includes(`"${person.id}"`));
    if (!affected.length) return event;
    const next = JSON.parse(serialized);
    const copyText = value => affected.reduce((text, person) => {
      const replacement = person.id === "cao_cao" && year(core) >= 220 ? "魏王府" : getCharacter(roleIds[person.id])?.name || "承办使署";
      return text.replaceAll(person.name, replacement);
    }, String(value || ""));
    for (const key of ["title", "text"]) if (next[key]) next[key] = copyText(next[key]);
    for (const choice of next.choices || []) {
      for (const key of ["label", "hint", "chronicle"]) if (choice[key]) choice[key] = copyText(choice[key]);
      const relations = {};
      for (const [id, delta] of Object.entries(choice.relations || {})) {
        const recipient = isAvailable(id, core) ? id : roleIds[id];
        if (recipient && isAvailable(recipient, core)) relations[recipient] = Number(relations[recipient] || 0) + delta;
      }
      choice.relations = relations;
    }
    if (year(core) >= 220 && event.id === "envoy_jiangdong") next.text = "江东使署请求朝廷确认通使与奉表名分。能否合作仍待后续落实；本奏不重演孙策讨袁术的往事。";
    next.text += "（当前使署改编：机构关系另计，不承接旧人物经历。）";
    next.currentCastAdapted = true;
    return next;
  }
  window.XianCharacterAvailability = Object.freeze({ allCharacters, availableCharacters, getCharacter, isAvailable, representative, faction, commander, diplomaticTargets, validateTargets, initialRelations, presentEvent, rules: { version: 1, limits: LIMITS, yearPolicy: "conservative-stage-cast" } });
})();
