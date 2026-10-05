/* 尚书台共同解析规则：复核、核心、州郡与军团使用同一份有效诏文。 */
(() => {
  "use strict";
  const labels = { relief: "赈济", tax: "减赋", investigation: "察吏", military: "整军", ritual: "礼制", secret: "密令", appointment: "任官", diplomacy: "外交", appease: "安抚", generic: "一般政令" };
  const patterns = [
    ["relief", /赈|救灾|开仓|安置流民/], ["tax", /免税|减税|减赋|免赋|减轻赋役/],
    ["investigation", /彻查|查办|整顿吏治|问罪|追责/],
    ["military", /练兵|整军|整顿宿卫|武备|讨伐|征讨|出兵|调兵|驰援|协防|坚守|守备|驻防|布防|输粮|运粮|补给|攻取|攻城|进兵/],
    ["ritual", /宗庙|祭祀|朝仪|礼制|经筵|大朝会/], ["secret", /密诏|密令|秘密|暗中|衣带|联络/],
    ["appointment", /任命|加封|封爵|拜为|授官|罢免|黜|封为|赐爵/],
    ["diplomacy", /遣使|结盟|外援|牵制|贡赋|奉表|互市|通商|停战|罢兵|休兵|议和|送质|质子/],
    ["appease", /安抚|嘉奖|褒奖|信任|赐宴|军务便宜/],
  ];
  const negation = /不得|不可|不许|不准|不要|不再|不予|勿|毋|禁止|严禁|无需|不必|停止|暂停|暂缓|取消|拒绝|不(?:练兵|出兵|任命|加封|赈济|进贡|奉表|结盟|驰援)/;
  const punitive = /罢免|黜|问罪|讨伐|征讨|斥责|削爵|追责/;

  function analyze(text, characters = window.GAME_DATA?.characters || []) {
    const clauses = String(text || "").split(/[，,；;。.!！?？\n]+/).map(item => item.trim()).filter(Boolean);
    // 否定句不转成正面命令。复合句不能确定否定范围时，要求玩家拆句。
    const ignoredClauses = clauses.filter(item => negation.test(item));
    const affirmative = clauses.filter(item => !negation.test(item));
    const policyClauses = affirmative.filter(item => patterns.some(([, pattern]) => pattern.test(item)));
    const effectiveText = policyClauses.join("；");
    const categories = patterns.filter(([, pattern]) => pattern.test(effectiveText)).map(([id]) => id);
    const targets = characters.filter(character => policyClauses.some(clause => clause.includes(character.name))).map(character => character.id);
    const targetDisposition = Object.fromEntries(characters.filter(character => targets.includes(character.id)).map(character => [character.id,
      policyClauses.some(clause => clause.includes(character.name) && punitive.test(clause)) ? "punitive" : "positive",
    ]));
    const orderRules = window.XIAN_STRATEGY_DATA?.orderRules || [];
    const orders = orderRules.filter(rule => new RegExp(rule.pattern).test(effectiveText)).map(rule => rule.id);
    const substantiveOrders = orders.filter(id => id !== "advance" || !orders.some(other => ["attack", "support", "defend"].includes(other)));
    const warnings = [];
    if (ignoredClauses.length) warnings.push(`已排除 ${ignoredClauses.length} 句否定或停止指令；如需禁止某事，请使用事件或对应行动处理。`);
    if (categories.length > 2) warnings.push("一份圣旨最多办理两类政务，请拆成多次行动。" );
    if (substantiveOrders.length > 1) warnings.push("一份圣旨只指定一种军略行动，请将进攻、补给或停战分开下达。" );
    const dispositions = Object.values(targetDisposition);
    const mixedTargets = dispositions.includes("positive") && dispositions.includes("punitive");
    if (mixedTargets) warnings.push("褒奖与问罪对象请分开拟旨，避免承办对象混淆。" );
    if (targets.length > 2) warnings.push("一份圣旨最多明确处分两名人物，请将其他对象分开办理。" );
    const blocked = categories.length > 2 || substantiveOrders.length > 1 || mixedTargets || targets.length > 2 || !affirmative.length;
    return { categories: categories.length ? categories : ["generic"], targets, targetDisposition,
      effectiveText, ignoredClauses, warnings, blocked, labels: (categories.length ? categories : ["generic"]).map(id => labels[id]) };
  }

  function effectiveText(text) { const result = analyze(text); return result.blocked ? "" : result.effectiveText; }
  function affirmativeText(text) { return String(text || "").split(/[，,；;。.!！?？\n]+/).filter(item => !negation.test(item)).join("；"); }
  function reportText(report) { return report.edict?.effectiveText ?? effectiveText(String(report.text || "").match(/“([^”]+)”/)?.[1] || ""); }
  window.XianEdictRules = Object.freeze({ analyze, affirmativeText, effectiveText, reportText, labels });
})();
