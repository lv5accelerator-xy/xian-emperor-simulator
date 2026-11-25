/* 尚书台共同解析规则：复核、核心、州郡与军团使用同一份有效诏文。 */
(() => {
  "use strict";
  const labels = { relief: "赈济", tax: "减赋", investigation: "察吏", military: "整军", ritual: "礼制", secret: "密令", appointment: "任官", diplomacy: "外交", appease: "安抚", generic: "一般政令" };
  const patterns = [
    ["relief", /赈|救灾|开仓|放粮|发粮|发放粮食|施粥|救济|接济灾民|安置流民/], ["tax", /免税|减税|减赋|免赋|减免|蠲免|免征|宽免|轻徭薄赋|减轻赋役/],
    ["investigation", /彻查|严查|查办|查处|惩治|肃贪|贪官|贪腐|整顿吏治|问罪|追责/],
    ["military", /练兵|操练|整军|禁军|守住|镇守|保卫|守卫|据守|增兵|支援|援助|策应|运送粮|送粮|押运|撤军|撤兵|退兵|班师|移师|进军|整顿宿卫|武备|讨伐|征讨|出兵|发兵|派兵|起兵|调兵|驰援|增援|协防|坚守|固守|守备|驻防|布防|设防|屯兵|输粮|运粮|补给|攻取|攻城|攻打|进攻|围攻|攻占|夺取|收复|击破|进兵|北伐|南征|东征|西征/],
    ["ritual", /宗庙|太庙|祭祀|祭天|告庙|郊祀|朝仪|礼制|经筵|朝会/], ["secret", /密诏|密令|密使|密信|秘密|暗中|衣带|联络/],
    ["appointment", /任命|加封|册封|封爵|拜为|授官|擢升|擢为|升任|罢免|革除|革职|免职|黜|封为|赐爵/],
    ["diplomacy", /遣使|派使|派遣使者|出使|修好|通好|讲和|求和|结盟|盟约|会盟|同盟|联盟|外援|牵制|贡赋|进贡|朝贡|输贡|纳贡|援军|救援|救应|勤王|奉表|互市|通商|停战|罢兵|休兵|议和|送质|质子/],
    ["appease", /安抚|嘉奖|褒奖|赏赐|犒赏|犒劳|慰劳|抚慰|信任|赐宴|军务便宜/],
  ];
  const negation = /不得|不可|不许|不准|不要|不再|不予|勿|毋|禁止|严禁|无需|不必|停止|暂停|暂缓|取消|拒绝|不应|不宜|不该|未必|并非|并不|暂不|非朕|不(?:练兵|出兵|任命|加封|赈济|进贡|奉表|结盟|驰援|增兵|支援|援助|镇守|守住|保卫|撤军|撤兵|退兵|赏赐|犒赏|册封|擢升|运送)/;
  // 双重否定与提醒是肯定：“不得不赈济”“勿忘赈济”。先去掉这些说法再判断否定。
  const affirmingIdioms = /不得不|不可不|不能不|不敢不|勿忘|毋忘|莫忘|不忘/g;
  // 转述与传闻不是朕的命令：“闻曹操欲出兵”“传言董承密令”。
  const hearsay = /^(?:闻|听闻|据闻|风闻|传闻|传言|有人言|据报|探报)/;
  const ignored = clause => hearsay.test(clause) || negation.test(clause.replace(affirmingIdioms, ""));
  // 同一句里用“并且”“同时”或“并＋褒贬动词”连接的几件事分开判断褒贬，如“褒奖荀彧并问罪董承”。
  // 只在“并”后紧跟褒贬动词时拆开，“并州”“并力讨伐”“并非”都不拆。
  const subClauses = clause => clause.split(/并且|同时|并(?=褒|奖|嘉|赏|赐|拜|任|加封|问罪|罢免|黜|斥责|削|追责|讨伐|征讨)/).filter(Boolean);
  const punitive = /罢免|黜|问罪|讨伐|征讨|斥责|削爵|追责|进攻|攻打|围攻|击破/;
  // 受命出兵的一方不是被讨伐的对象：“令曹操进攻邺城”“与袁绍并力讨伐刘表”中的曹操、袁绍。
  const actor = (part, name) => new RegExp(`(?:令|命|着|遣|派|诏|使)${name}|与${name}(?:并力|合力|协力|共同|一同|会师|联兵|共)`).test(part);

  function analyze(text, characters = window.GAME_DATA?.characters || [], core = (window.XianEmperorGame?.peekState || window.XianEmperorGame?.getState)?.()) {
    const availability = window.XianCharacterAvailability;
    if (availability && core) characters = availability.availableCharacters(core);
    const clauses = String(text || "").split(/[，,；;。.!！?？\n]+/).map(item => item.trim()).filter(Boolean);
    // 否定句不转成正面命令。复合句不能确定否定范围时，要求玩家拆句。
    const ignoredClauses = clauses.filter(ignored);
    const affirmative = clauses.filter(item => !ignored(item));
    const treaty = affirmative.some(item => /结盟|盟约|会盟|同盟|联盟/.test(item));
    const joint = /共讨|合攻|共同进攻|共同攻打|共同防守|协同防守/;
    const policyClauses = affirmative.filter(item => patterns.some(([, pattern]) => pattern.test(item)) || (treaty && joint.test(item)));
    const effectiveText = policyClauses.join("；");
    const categoryText = treaty ? policyClauses.filter(clause => !joint.test(clause)).join("；") : effectiveText;
    const categories = patterns.filter(([, pattern]) => pattern.test(categoryText)).map(([id]) => id);
    const targetText = treaty ? effectiveText.split(joint)[0] : effectiveText;
    const targets = characters.filter(character => targetText.includes(character.name)).map(character => character.id);
    const targetDisposition = Object.fromEntries(characters.filter(character => targets.includes(character.id)).map(character => [character.id,
      policyClauses.flatMap(subClauses).some(part => part.includes(character.name) && punitive.test(part) && !actor(part, character.name)) ? "punitive" : "positive",
    ]));
    const orderRules = window.XIAN_STRATEGY_DATA?.orderRules || [];
    const orders = orderRules.filter(rule => new RegExp(rule.pattern).test(effectiveText)).map(rule => rule.id);
    const substantiveOrders = orders.filter(id => id !== "advance" || !orders.some(other => ["attack", "support", "defend"].includes(other)));
    const warnings = [];
    const currentTargets = availability && core ? availability.validateTargets(effectiveText, core) : { ok: true };
    if (!currentTargets.ok) warnings.push(currentTargets.reason);
    if (ignoredClauses.length) warnings.push(`已排除 ${ignoredClauses.length} 句否定、存疑或转述的话；如需禁止某事，请使用事件或对应行动处理。`);
    if (categories.length > 2) warnings.push("一份圣旨最多办理两类政务，请拆成多次行动。" );
    if (substantiveOrders.length > 1) warnings.push("一份圣旨只指定一种军略行动，请将进攻、补给或停战分开下达。" );
    // 受命出兵的一方记为 positive，但不算“褒奖”，不与被讨伐者构成褒贬混杂。
    const actors = new Set(characters.filter(character => targets.includes(character.id) && policyClauses.some(clause => actor(clause, character.name))).map(character => character.id));
    const dispositions = Object.entries(targetDisposition).filter(([id]) => !actors.has(id)).map(([, value]) => value);
    const mixedTargets = dispositions.includes("positive") && dispositions.includes("punitive");
    if (mixedTargets) warnings.push("褒奖与问罪对象请分开拟旨，避免承办对象混淆。" );
    const maxTargets = treaty ? 3 : 2;
    if (targets.length > maxTargets) warnings.push(treaty ? "共同盟约最多列明三方。" : "一份圣旨最多明确处分两名人物，请将其他对象分开办理。" );
    const blocked = !currentTargets.ok || categories.length > 2 || substantiveOrders.length > 1 || mixedTargets || targets.length > maxTargets || !affirmative.length;
    return { categories: categories.length ? categories : ["generic"], targets, targetDisposition,
      effectiveText, ignoredClauses, warnings, blocked, labels: (categories.length ? categories : ["generic"]).map(id => labels[id]) };
  }

  function effectiveText(text) { const result = analyze(text); return result.blocked ? "" : result.effectiveText; }
  function affirmativeText(text) { return String(text || "").split(/[，,；;。.!！?？\n]+/).map(item => item.trim()).filter(item => item && !ignored(item)).join("；"); }
  function reportText(report) { return report.edict?.effectiveText ?? effectiveText(String(report.text || "").match(/“([^”]+)”/)?.[1] || ""); }
  // 识别不出具体政务时（只会按“中央一般政令”办理），给出能被识别的示范写法。
  // 优先用句中提到的城池与人物造句，其余补常用政务。只给建议，不改动玩家的圣旨。
  function suggest(text, characters = window.GAME_DATA?.characters || [], core = (window.XianEmperorGame?.peekState || window.XianEmperorGame?.getState)?.()) {
    const result = analyze(text, characters, core);
    if (result.blocked || !String(text || "").trim() || !result.categories.includes("generic")) return null;
    const availability = window.XianCharacterAvailability;
    const people = (availability && core ? availability.availableCharacters(core) : characters).filter(character => character.name && text.includes(character.name)).map(character => character.name);
    const cities = (window.XIAN_STRATEGY_DATA?.cities || []).filter(city => (city.aliases || [city.name]).some(alias => text.includes(alias))).map(city => city.name);
    const examples = [];
    const city = cities[0], person = people[0];
    if (city) examples.push(`${person ? `令${person}` : "派兵"}坚守${city}`, `派兵增援${city}`, `向${city}运送粮草`);
    if (person) examples.push(`赏赐${person}`, `任命${person}为侍中`);
    for (const fallback of ["赈济灾民", "减免赋税", "整顿禁军", "彻查贪官污吏", "祭祀宗庙"]) if (examples.length < 5) examples.push(fallback);
    return { message: "未识别出具体政务，这道圣旨会按“中央一般政令”办理，效果较弱。写明要办的事更有效，例如：", examples: [...new Set(examples)].slice(0, 5) };
  }

  window.XianEdictRules = Object.freeze({ analyze, affirmativeText, effectiveText, reportText, suggest, labels });
})();
