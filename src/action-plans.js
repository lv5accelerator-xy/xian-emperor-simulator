/* v2.19.0 · Recommended options and executed actions share these rules. */
(() => {
  "use strict";
  const clamp = value => Math.max(0, Math.min(100, value));
  const people = () => window.GAME_DATA.characters.filter(person => person.id !== "liu_xie");
  const fieldNames = { audience: "audience-mode", appointment: "modal-appointment-type", secret: "modal-secret-type",
    revenue: "revenue-method", relief: "relief-level", ritual: "ritual-type", appease: "appease-type", regional: "regional-type" };
  const variants = { audience: ["public", "private"], appointment: ["praise", "office", "title"], secret: ["intelligence", "support", "escape"],
    revenue: ["audit", "tribute", "borrow"], relief: ["small", "medium", "large"], ritual: ["court", "temple", "lecture"],
    appease: ["praise", "military", "banquet"], regional: ["edict", "envoy", "tribute"] };
  function targets(actionId) {
    if (!["audience", "appointment", "secret", "regional"].includes(actionId)) return [null];
    return people().filter(person => actionId === "appointment" ? person.id !== "cao_cao"
      : actionId === "secret" ? ["empress_fu", "dong_cheng", "yang_biao", "yuan_shao", "liu_biao", "sun_ce"].includes(person.id)
      : actionId === "regional" ? person.faction === "regional_lords" : true);
  }
  function build(actionId, fields, state) {
    const type = fields[fieldNames[actionId]], person = targets(actionId).find(item => item?.id === fields["modal-character-select"]);
    if (!variants[actionId]?.includes(type) || (targets(actionId)[0] && !person)) return null;
    let label, effects = {}, hidden = {}, relations = {};
    if (actionId === "audience") {
      label = `${type === "public" ? "公开召见" : "私下召见"}${person.name}`;
      effects = type === "public" ? { authority: 2, officials: 2 } : { security: -1, caoAlert: 2 };
      if (type === "private") hidden.leakRisk = 2;
      if (person.faction === "cao_group") { effects.caoAlert = (effects.caoAlert || 0) - 3; effects.security = (effects.security || 0) + 2; }
      else if (person.faction === "regional_lords") { effects.prestige = 2; effects.caoAlert = (effects.caoAlert || 0) + 2; }
      else if (person.faction === "han_loyalists" && type === "private") hidden.loyalNetwork = 3;
      relations[person.id] = type === "public" ? 4 : 7;
    } else if (actionId === "appointment") {
      const map = { praise: ["下诏褒奖", { authority: 2, prestige: 2, treasury: -1, caoAlert: 1 }, 5],
        office: ["加授官职", { authority: 4, officials: 2, treasury: -3, caoAlert: 4 }, 9], title: ["赐爵增秩", { prestige: 4, authority: 3, treasury: -5, caoAlert: 6 }, 13] };
      const item = map[type]; label = `${item[0]}·${person.name}`; effects = { ...item[1] }; relations[person.id] = item[2];
      if (person.faction === "cao_group") effects.caoAlert -= 6;
      if (person.faction === "regional_lords") { effects.prestige = (effects.prestige || 0) + 1; effects.caoAlert += 2; }
    } else if (actionId === "secret") {
      label = `${{ intelligence: "建立情报线", support: "争取支持", escape: "筹备退路" }[type]}·${person.name}`;
      effects = { security: -3, caoAlert: 7 }; hidden = { loyalNetwork: 7, leakRisk: 8 }; relations[person.id] = 7;
      if (type === "intelligence") { hidden.loyalNetwork += 2; hidden.leakRisk += 1; }
      if (type === "support") { effects.authority = 2; hidden.loyalNetwork += 4; hidden.leakRisk += 3; }
      if (type === "escape") { hidden.escapeRoute = 9; hidden.externalBalance = 3; effects.security -= 1; }
      if (person.faction === "regional_lords") { hidden.externalBalance = (hidden.externalBalance || 0) + 6; effects.caoAlert += 3; }
    } else if (actionId === "revenue") {
      const bonus = state.stats.treasury <= 18 ? 2 : 0;
      const map = { audit: ["核减宫中冗费", { treasury: 4 + bonus, officials: -2 }, {}],
        tribute: ["催办州郡贡赋", { treasury: 7 + bonus, prestige: -3, officials: -1, caoAlert: 1 }, { peopleStability: -4 }],
        borrow: ["向司空府借调", { treasury: 10 + bonus, authority: -5, officials: -2, caoAlert: -5 }, { externalBalance: -3 }] };
      [label, effects, hidden] = map[type];
    } else if (actionId === "relief") {
      const efficiency = Math.max(.45, Math.min(1.15, (state.stats.authority + state.stats.officials) / 160));
      const item = { small: ["局部赈济", 4, 3, 1, 4], medium: ["州郡减赋", 8, 6, 3, 8], large: ["大开仓廪", 13, 10, 4, 13] }[type];
      label = item[0]; effects = { treasury: -item[1], prestige: Math.round(item[2] * efficiency), officials: item[3], caoAlert: type === "large" ? 3 : 1 };
      hidden = { peopleStability: Math.round(item[4] * efficiency) };
    } else if (actionId === "ritual") {
      [label, effects] = { court: ["恢复大朝会", { authority: 5, officials: 4, treasury: -4, caoAlert: 3 }],
        temple: ["祭告宗庙", { prestige: 7, authority: 3, treasury: -5, caoAlert: 2 }], lecture: ["开设经筵", { officials: 6, authority: 3, treasury: -3, caoAlert: 2 }] }[type];
    } else if (actionId === "appease") {
      const item = { praise: ["公开褒奖司空", { caoAlert: -7, prestige: 1, authority: -1 }, 6],
        military: ["暂授军务便宜", { caoAlert: -11, security: 6, authority: -6 }, 8], banquet: ["赐宴修好", { caoAlert: -8, security: 3, treasury: -5, officials: 1 }, 7] }[type];
      [label, effects] = item; relations = { cao_cao: item[2], dong_cheng: -2 };
    } else if (actionId === "regional") {
      const item = { edict: ["颁诏慰劳", { prestige: 3, authority: 1, caoAlert: 3, treasury: -1 }, { externalBalance: 4 }, 6],
        envoy: ["派遣密使", { security: -2, caoAlert: 7, treasury: -3 }, { externalBalance: 8, leakRisk: 5 }, 9],
        tribute: ["以官爵换取贡赋", { treasury: 7, authority: -1, prestige: 2, caoAlert: 5 }, { externalBalance: 5 }, 7] }[type];
      label = `${item[0]}·${person.name}`; effects = item[1]; hidden = item[2]; relations[person.id] = item[3];
    }
    const cost = Math.max(0, -Number(effects.treasury || 0));
    return { actionId, fields: { ...fields }, label, cost, affordable: state.stats.treasury >= cost,
      effects: { ...effects }, hidden: { ...hidden }, relations: { ...relations } };
  }
  function list(state) {
    return Object.keys(variants).flatMap(actionId => targets(actionId).flatMap(person => variants[actionId].map(type =>
      build(actionId, { [fieldNames[actionId]]: type, ...(person ? { "modal-character-select": person.id } : {}) }, state))));
  }
  function project(state, plan) {
    const next = { ...state, stats: { ...state.stats }, hidden: { ...state.hidden } };
    for (const [group, changes] of [["stats", plan.effects], ["hidden", plan.hidden]]) {
      for (const [key, delta] of Object.entries(changes)) next[group][key] = clamp(Number(next[group][key] || 0) + delta);
    }
    next.actionPoints = Math.max(0, next.actionPoints - 1);
    return next;
  }
  window.XianActionPlans = Object.freeze({ build, list, project });
})();
