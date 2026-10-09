/* v2.24.0 · 汉祚将尽。纯状态规则；由核心统一保存、裁决与结算。 */
(() => {
  "use strict";

  const NODES = [
    { id: "story220_petition", turn: 3, title: "百官联署", crisis: "魏王府催促百官表态，尚书台要先议禅代是否合法。" },
    { id: "story220_shrine", turn: 6, title: "宗庙与旧臣", crisis: "宗庙、旧臣与皇室家属的安危，已不能只凭一道诏令保证。" },
    { id: "story220_seal", turn: 9, title: "玺绶之争", crisis: "魏王府要求确定传玺礼仪；名册、印玺和退路须作最后取舍。" },
    { id: "story220_council", turn: 11, title: "最后朝议", crisis: "曹丕的使者再催答复，百官面对最后一次实质朝议。" },
  ];
  const STAT_NAMES = { authority: "皇权", prestige: "汉室威望", security: "宫廷安全", treasury: "国库", officials: "百官支持", caoAlert: "曹氏警戒" };
  const HIDDEN_KEYS = ["loyalNetwork", "leakRisk", "peopleStability", "externalBalance", "escapeRoute"];
  const CHOICES = {
    story220_petition: [
      { key: "resist", label: "封止联署，留奏太庙", hint: "维护汉统与皇权；损失宫禁安全、钱粮并激起魏府戒备。", effects: { authority: 5, prestige: 4, security: -5, treasury: -2, officials: -2, caoAlert: 8 }, hidden: { loyalNetwork: 2 }, relations: { yang_biao: 3 }, stance: "resist", echo: "petition_resist" },
      { key: "discuss", label: "许议名分，换取缓期", hint: "暂缓宫门压力；汉廷权威受损，魏府仍未承诺不行禅代。", effects: { authority: -4, prestige: -3, security: 3, caoAlert: -7 }, relations: { yang_biao: -2 }, stance: "negotiate", echo: "petition_discuss" },
      { key: "network", label: "私护旧臣，密存异议", hint: "以钱粮维系忠汉联系；使者往来增加泄密与政治风险。", effects: { authority: 1, treasury: -5, caoAlert: 4 }, hidden: { loyalNetwork: 7, leakRisk: 8 }, relations: { yang_biao: 6 }, stance: "resist", echo: "petition_network" },
    ],
    story220_shrine: [
      { key: "register", label: "交礼权，换宗庙与旧臣名册", hint: "让渡传玺礼仪的主持权，以钱粮争取保护名单；兑现后不能再扣玺阻止礼仪。", effects: { authority: -5, prestige: 2, security: 4, treasury: -5, caoAlert: -5 }, hidden: { loyalNetwork: -1 }, relations: { yang_biao: 3 }, stance: "preserve", echo: "shrine_register", promise: "宗庙与旧臣保护名册" },
      { key: "mandate", label: "托旧臣出面，争留汉廷任命权", hint: "争取实际权柄；须有旧臣信任和忠汉联系，钱粮、宫禁与魏府信任都将受损。", effects: { authority: 5, prestige: 3, security: -6, treasury: -6, officials: -2, caoAlert: 8 }, hidden: { leakRisk: 4 }, relations: { yang_biao: 2 }, stance: "resist", echo: "shrine_mandate" },
      { key: "archive", label: "散旧臣护家属，留汉仪副本", hint: "减少宫中密线，保存家属与礼文；百官支持削弱，此后不能再托这些人争任命权。", effects: { authority: -3, security: 3, treasury: -3, officials: -4 }, hidden: { leakRisk: -3, escapeRoute: 5 }, stance: "preserve", echo: "shrine_archive", promise: "疏散家属与汉仪副本" },
    ],
    story220_seal: [
      { key: "assert", label: "留玺拒授，申明汉统", hint: "把传国礼仪扣在汉廷手中；宫禁收紧、魏府警戒上升，先前已兑现的礼权让渡不能撤回。", effects: { authority: 5, prestige: 6, security: -8, treasury: -3, officials: -3, caoAlert: 10 }, relations: { yang_biao: 2 }, stance: "resist", echo: "seal_assert" },
      { key: "terms", label: "据名册立约，换封邑与汉祀", hint: "用已有保护名册或百官信任争取条款；交出部分皇权与钱粮，旧约仍须后月核验。", effects: { authority: -4, prestige: 2, security: 4, treasury: -4, officials: 1, caoAlert: -5 }, relations: { yang_biao: 2 }, stance: "negotiate", echo: "seal_terms", promise: "汉祀、旧臣与封邑条款" },
      { key: "retreat", label: "以诏作凭，筹备行在退路", hint: "必须已有可议的道路；消耗钱粮、分散忠汉力量，密使未必能获得外镇接应。", effects: { authority: -1, prestige: -2, security: -3, treasury: -8, caoAlert: 5 }, hidden: { escapeRoute: 9, loyalNetwork: -3, leakRisk: 6 }, stance: "retreat", echo: "seal_retreat", promise: "行在通路与接应" },
      { key: "concede", label: "交玺保宫，撤回旧臣署名", hint: "以印玺与旧臣的公开支持换取宫门安静；名分与百官支持都受损。", effects: { authority: -6, prestige: -4, security: 7, officials: -3, caoAlert: -9 }, relations: { yang_biao: -3 }, stance: "preserve", echo: "seal_concede" },
    ],
    story220_council: [
      { key: "resist", label: "联名拒禅，承受宫禁收紧", hint: "须保有玺绶、百官、旧臣与足够安全；提高皇权与名望，宫禁遭重压，泄密可能使全局提前失败。", effects: { authority: 6, prestige: 5, security: -12, treasury: -5, caoAlert: 12 }, hidden: { leakRisk: 5 }, relations: { yang_biao: 3 }, stance: "resist", echo: "final_resist", promise: "联名留奏与汉统声明" },
      { key: "preserve", label: "交代百官，换宗庙奉祀", hint: "牺牲皇权与百官政治空间，争取宫禁安全；没有保护名册时，只能请求有限保全。", effects: { authority: -6, prestige: 2, security: 6, treasury: -3, officials: -2, caoAlert: -8 }, stance: "preserve", echo: "final_preserve", promise: "宗庙奉祀与旧臣免追" },
      { key: "negotiate", label: "援引旧约，留议事与奉祀条款", hint: "须有已核验的旧约、百官与杨彪信任；消耗钱粮、让渡皇权，争取有限议事空间而非中兴保证。", effects: { authority: -3, prestige: 3, security: 2, treasury: -6, officials: -2, caoAlert: 4 }, hidden: { externalBalance: 2 }, relations: { yang_biao: 1 }, stance: "negotiate", echo: "final_negotiate", promise: "奉祀与有限议事条款" },
      { key: "retreat", label: "启行在通路，分护宗室", hint: "须有真实通路、接应和钱粮；冒险分护宗室，不能保证南渡或保住原有朝廷。", effects: { prestige: -4, security: -6, treasury: -6, caoAlert: 8 }, hidden: { escapeRoute: 6, loyalNetwork: -3 }, stance: "retreat", echo: "final_retreat", promise: "分护宗室的行在安排" },
    ],
  };
  // 每项后续都有唯一来源、固定核验时点、有限效果；不使用随机数。
  const ECHOES = {
    petition_resist: { due: 6, title: "封奏之后", test: g => relation(g) >= 60 && g.stats.officials >= 38 && g.stats.caoAlert < 85, yes: { effects: { officials: 3 }, hidden: { loyalNetwork: 2 } }, no: { effects: { security: -3, officials: -2 } }, success: "杨彪援引封存太庙的奏疏，为天子联络到有限的公开支持。", failure: "封奏仍在，愿具名的旧臣却因宫禁压力退缩；留奏没有成为可用的联署。" },
    petition_discuss: { due: 6, title: "缓期答书", test: g => g.stats.caoAlert < 80 && g.stats.security >= 30, yes: { effects: { security: 2, caoAlert: -2 } }, no: { effects: { authority: -2, caoAlert: 2 } }, success: "魏府回书允缓议程，承认尚书台可先列保全条件；这不是停止禅代。", failure: "魏府认为朝局仍不可托付，不肯按先前许议名分的让步缓期。" },
    petition_network: { due: 6, title: "旧臣回牍", test: g => relation(g) >= 60 && g.hidden.loyalNetwork >= 16 && g.hidden.leakRisk <= 40 && g.stats.security >= 30, yes: { effects: { officials: 4, prestige: 2 }, hidden: { loyalNetwork: 2 } }, no: { effects: { security: -4, caoAlert: 4 }, hidden: { loyalNetwork: -3 } }, success: "受暗中保护的旧臣经杨彪递来回牍，愿为宗庙与家属出面，但不肯无条件起兵。", failure: "旧臣记得保护之恩，密线却已不安全；回牍未能成议，魏府反加盘查。" },
    shrine_register: { due: 9, title: "名册入约", test: g => g.stats.security >= 32 && g.stats.caoAlert <= 85 && g.stats.treasury >= 8 && relation(g) >= 55, yes: { effects: { security: 3, officials: 2 } }, no: { effects: { prestige: -2, officials: -2 } }, success: "传玺礼权已让渡，保护名册由双方登记，宗庙与旧臣可以据册谈条件；这是纸面保障，尚待终月核验。", failure: "礼权已经让出，宫禁、钱粮或旧臣信任却不足，魏府未确认完整保护名册。" },
    shrine_mandate: { due: 9, title: "任命权复议", test: g => relation(g) >= 62 && g.stats.officials >= 40 && g.stats.caoAlert < 85 && g.hidden.loyalNetwork >= 20, yes: { effects: { officials: 3 }, hidden: { loyalNetwork: 2 } }, no: { effects: { authority: -3, security: -2 } }, success: "旧臣按前议再请保留汉廷任命权，尚书台仍有愿意具名的人；魏府没有认可全部请求。", failure: "前番争任命权的代价未能换来足够支持，旧臣不敢再署名，魏府收紧宫禁。" },
    shrine_archive: { due: 9, title: "礼文与家属", test: g => g.stats.security >= 32 && g.stats.treasury >= 8, yes: { effects: { security: 2 }, hidden: { escapeRoute: 2 } }, no: { effects: { officials: -2 } }, success: "疏散的家属与汉仪副本抵达暂居之所，朝中却已少了愿联署争权的旧臣。", failure: "疏散安排受宫禁或钱粮所阻，只能确认礼文已经抄出，不能断言家属皆得安置。" },
    seal_assert: { due: 11, title: "留玺的回声", test: g => g.stats.security >= 36 && g.stats.caoAlert < 82 && relation(g) >= 65, yes: { effects: { officials: 3, prestige: 2 } }, no: { effects: { security: -3, caoAlert: 3 } }, success: "留玺声明传至尚书台，杨彪愿在最后朝议中作证；支持仍受宫禁与百官态度约束。", failure: "留玺使魏府加强宫门查验，旧臣不敢把公开支持押在一场孤注一掷上。" },
    seal_terms: { due: 11, title: "旧约答复", test: g => g.stats.security >= 35 && g.stats.officials >= 32 && g.stats.caoAlert < 82 && relation(g) >= 58, yes: { effects: { security: 2, prestige: 2 } }, no: { effects: { prestige: -3, officials: -2 } }, success: "魏府使者确认汉祀、旧臣与封邑的书面条款；能否留下议事空间，仍取决于最后朝议的资本。", failure: "宫禁压力与百官失散使条款无法确认，先前交出的权柄不能因此自动取回。" },
    seal_retreat: { due: 11, title: "行在使者回报", test: g => g.hidden.escapeRoute >= 24 && g.hidden.externalBalance >= 18 && g.hidden.loyalNetwork >= 12 && g.hidden.leakRisk < 45 && g.stats.security >= 25, yes: { effects: { prestige: 2 }, hidden: { escapeRoute: 4 } }, no: { effects: { security: -2 }, hidden: { escapeRoute: -5 } }, success: "行在使者核对了通路与接应文书；外镇仅许接纳部分宗室，没有承诺举兵复汉。", failure: "先前筹备行在未获可靠接应，通路受阻，不能把传闻当作已经完成的南渡。" },
    seal_concede: { due: 11, title: "交玺之后", test: g => g.stats.security >= 35 && g.stats.caoAlert < 80, yes: { effects: { security: 2 } }, no: { effects: { prestige: -2 } }, success: "交玺后宫门暂归平静，魏府仍拒绝恢复旧臣的公开政治地位。", failure: "交玺也未尽消魏府猜疑，天子已经失去凭玺阻止礼仪的余地。" },
    final_resist: { due: 12, title: "联署终月核验", test: g => g.stats.security >= 24 && g.stats.authority >= 40 && g.stats.officials >= 40 && g.stats.caoAlert < 90, yes: { effects: { prestige: 2 }, hidden: { loyalNetwork: 1 } }, no: { effects: { security: -3, officials: -2 } }, success: "联名拒禅之奏留入汉廷档册，尚有官员承担署名；抗争留下名分，并没有凭此夺得魏军。", failure: "宫禁与百官支持已不足以承担联署，拒禅之志有记录，原定政治承诺却未维持。" },
    final_preserve: { due: 12, title: "奉祀终月核验", test: g => fulfilled(g, "shrine_register") && g.stats.security >= 40 && g.stats.caoAlert < 80, yes: { effects: { security: 2, prestige: 1 } }, no: { effects: { prestige: -2 } }, success: "保护名册与终月宫禁相符，汉祀与旧臣免追条款在本局得到确认；皇权的让渡已无法追回。", failure: "朝廷只能证实宫门现状，缺少有效名册或安全基础，不能断言宗庙旧臣已获完整保全。" },
    final_negotiate: { due: 12, title: "议事终月核验", test: g => fulfilled(g, "seal_terms") && g.stats.officials >= 40 && g.stats.authority >= 24 && g.stats.security >= 34 && g.stats.caoAlert <= 80, yes: { effects: { prestige: 2, authority: 1 } }, no: { effects: { authority: -2, officials: -2 } }, success: "旧约、百官与宫禁尚能支撑少数议事席位，汉廷留下有限政治空间，仍未收回兵权。", failure: "最后条件已不足以支撑议事条款；谈判有真实记录，有限自主的承诺未能落实。" },
    final_retreat: { due: 12, title: "行在终月核验", test: g => fulfilled(g, "seal_retreat") && g.hidden.escapeRoute >= 30 && g.stats.security >= 24 && g.stats.treasury >= 8, yes: { hidden: { escapeRoute: 2 } }, no: { hidden: { escapeRoute: -3 }, effects: { prestige: -2 } }, success: "分护宗室的行在安排仍有接应与钱粮；最终是否南渡，仍按全局国势判定。", failure: "通路或钱粮不足以维持分护安排，不能把筹备退路写成车驾已经离京。" },
  };

  function initial(entryTurn = 1, completedNormally = false) {
    return { version: 1, entryTurn, phase: 0, decisions: {}, consequences: [], promises: [], stance: null, completedNormally };
  }
  function relation(g) { return Number(g.relations?.yang_biao ?? 58); }
  function choiceFor(eventId, key) { return CHOICES[eventId]?.find(item => item.key === key); }
  function knownDelta(value, keys) {
    return Object.fromEntries(keys.filter(key => Number.isFinite(value?.[key]) && Math.abs(value[key]) <= 100).map(key => [key, value[key]]));
  }
  function receipt(value) {
    if (!value || typeof value !== "object") return null;
    return { stats: knownDelta(value.stats, Object.keys(STAT_NAMES)), hidden: knownDelta(value.hidden, HIDDEN_KEYS) };
  }
  function normalize(value, core = {}) {
    const turn = Math.max(1, Math.min(12, Number(core.turn) || 1));
    const valid = value?.version === 1;
    const entryTurn = valid && Number.isInteger(value.entryTurn) && value.entryTurn >= 1 && value.entryTurn <= turn ? value.entryTurn : turn;
    const next = initial(entryTurn, valid && value.completedNormally !== null ? value.completedNormally === true : null);
    for (const node of NODES) {
      const record = valid ? value.decisions?.[node.id] : null;
      const choice = choiceFor(node.id, record?.choice);
      if (!choice || record.resolved !== true || !Number.isInteger(record.turn) || record.turn < node.turn || record.turn > turn) continue;
      next.decisions[node.id] = { eventId: node.id, choice: choice.key, turn: record.turn, resolved: true, actual: receipt(record.actual) };
      next.phase += 1;
      next.stance = choice.stance;
    }
    const seen = new Set();
    for (const item of valid && Array.isArray(value.consequences) ? value.consequences.slice(0, 16) : []) {
      const record = next.decisions[item?.sourceId];
      const choice = choiceFor(item?.sourceId, record?.choice);
      const definition = ECHOES[choice?.echo];
      if (!definition || item.id !== choice.echo || seen.has(item.id) || !["pending", "fulfilled", "broken"].includes(item.status)) continue;
      if (item.status !== "pending" && (!Number.isInteger(item.resolvedTurn) || item.resolvedTurn < definition.due || item.resolvedTurn > turn)) continue;
      seen.add(item.id);
      next.consequences.push({ id: item.id, sourceId: item.sourceId, dueTurn: definition.due, status: item.status,
        resolvedTurn: item.status === "pending" ? null : item.resolvedTurn, actual: receipt(item.actual) });
    }
    next.promises = NODES.flatMap(node => {
      const choice = choiceFor(node.id, next.decisions[node.id]?.choice);
      return choice?.promise ? [{ id: choice.echo, sourceId: node.id, status: next.consequences.find(item => item.id === choice.echo)?.status || "unknown" }] : [];
    });
    return next;
  }
  function fulfilled(g, id) { return g.story220?.consequences?.some(item => item.id === id && item.status === "fulfilled") === true; }
  function chosen(g, id) { return g.story220?.decisions?.[`story220_${id}`]?.choice; }
  function enabled(g) { return g?.scenarioId === "yankang_220" && !window.XianShortChallenges?.getActiveStatus?.(g) && !window.XianShortChallenges?.getResultForGame?.(g.createdAt); }
  function selectEvent(g) {
    if (!enabled(g) || g.ended) return null;
    const story = normalize(g.story220, g);
    const node = NODES.find(item => item.turn >= story.entryTurn && item.turn <= g.turn && !story.decisions[item.id]);
    return node ? buildEvent(node.id, g) : null;
  }

  function unavailable(eventId, key, g) {
    const s = g.stats, h = g.hidden, trust = relation(g);
    const choice = choiceFor(eventId, key);
    const cost = Math.max(0, -Number(choice?.effects?.treasury || 0));
    if (s.treasury < cost) return `国库不足，需 ${cost}，现有 ${Math.round(s.treasury)}。`;
    if (eventId === "story220_shrine" && key === "mandate" && (trust < 62 || s.officials < 40 || h.loyalNetwork < 20)) return "须杨彪关系至少 62、百官支持至少 40、忠汉网络达到 20；旧臣当前不愿承担争权。";
    if (eventId === "story220_seal") {
      if (key === "assert" && chosen(g, "shrine") === "register") return "先前已交传玺礼权，不能再以扣玺阻止自己允准的礼仪。";
      if (key === "terms" && !(fulfilled(g, "shrine_register") || (s.officials >= 48 && trust >= 65))) return "须有效保护名册，或百官支持至少 48 且杨彪关系至少 65。";
      if (key === "retreat" && (h.escapeRoute < 16 || s.security < 28)) return "须退路达到 16、宫廷安全至少 28，才能派出持诏使者。";
    }
    if (eventId === "story220_council") {
      if (key === "resist" && (chosen(g, "seal") !== "assert" || chosen(g, "shrine") === "archive" || !fulfilled(g, "seal_assert") || s.authority < 38 || s.officials < 45 || s.security < 36 || h.loyalNetwork < 24 || trust < 65 || s.caoAlert >= 82 || h.leakRisk >= 45)) return "须留玺回声已获支持、未遣散旧臣、皇权 38、百官 45、安全 36、杨彪关系 65、忠汉网络 24；警戒须低于 82，密线仍须安全。";
      if (key === "negotiate" && (chosen(g, "seal") !== "terms" || !fulfilled(g, "seal_terms") || s.officials < 42 || s.authority < 28 || s.prestige < 55 || trust < 65 || s.security < 34 || s.caoAlert > 75)) return "须已确认汉祀旧约、百官 42、皇权 28、威望 55、安全 34、杨彪关系 65，且魏府警戒不高于 75。";
      if (key === "retreat" && (chosen(g, "seal") !== "retreat" || !fulfilled(g, "seal_retreat") || h.escapeRoute < 30 || h.externalBalance < 18 || s.security < 28 || h.loyalNetwork < 20)) return "须已核对通路与接应、退路 30、外部制衡 18、安全 28、忠汉网络 20。";
    }
    return "";
  }
  function buildEvent(id, g) {
    const node = NODES.find(item => item.id === id);
    if (!node || !Number.isInteger(g.turn) || g.turn < node.turn || g.turn > 12 || !enabled(g)) return null;
    const story = normalize(g.story220, g);
    const previous = NODES.filter(item => story.decisions[item.id]).map(item => `第${story.decisions[item.id].turn}月“${choiceFor(item.id, story.decisions[item.id].choice).label}”`);
    const lastEcho = story.consequences.filter(item => item.status !== "pending").slice(-1)[0];
    const context = previous.length ? `此前已裁：${previous.join("；")}。` : "史册没有此前主线的裁决记录，不据此推定天子曾抗争或让步。";
    const support = relation(g) >= 62 && g.stats.officials >= 40 ? "杨彪愿为礼法与旧臣出面，但不许诺兵力。" : "杨彪顾虑家族与宫禁，当前只愿论礼，不愿领百官争权。";
    return { id, title: node.title, category: "延康主线", story220: true,
      text: `${node.crisis} ${context} ${support}${lastEcho ? ` ${echoText(lastEcho)}` : ""}`,
      choices: CHOICES[id].map(choice => {
        const disabledReason = unavailable(id, choice.key, g);
        // Always retain one affordable resolution. With an empty treasury, preservation gives up its expenditure and extra security.
        const fallback = (id === "story220_shrine" && choice.key === "archive") || (id === "story220_council" && choice.key === "preserve");
        const poor = fallback && g.stats.treasury < -Number(choice.effects.treasury || 0);
        const effects = poor ? { ...choice.effects, treasury: 0, security: 1, officials: (choice.effects.officials || 0) - 2 } : { ...choice.effects };
        return { ...choice, effects, disabledReason: poor ? "" : disabledReason,
          hint: poor ? `${choice.hint} 国库不足，只能缩减安置，安全收益减弱，百官另受损。` : choice.hint,
          chronicle: `延康主线·${node.title}：天子裁为“${choice.label}”${poor ? "，钱粮不足，改作缩减安置" : ""}。` };
      }) };
  }
  function difference(before, after) {
    return Object.fromEntries(Object.keys(before || {}).filter(key => Number.isFinite(after?.[key]) && after[key] !== before[key]).map(key => [key, after[key] - before[key]]));
  }
  function actual(before, after) { return { stats: difference(before.stats, after.stats), hidden: difference(before.hidden, after.hidden) }; }
  function record(g, event, choice, before) {
    if (!event.story220) return false;
    const story = normalize(g.story220, g);
    if (story.decisions[event.id] || choice.disabledReason) return false;
    story.decisions[event.id] = { eventId: event.id, choice: choice.key, turn: g.turn, resolved: true, actual: actual(before, g) };
    story.consequences.push({ id: choice.echo, sourceId: event.id, dueTurn: ECHOES[choice.echo].due, status: "pending", resolvedTurn: null, actual: null });
    g.story220 = normalize(story, g);
    return true;
  }
  function settle(g, apply, finalMonth = false) {
    if (!enabled(g) || g.ended) return false;
    g.story220 = normalize(g.story220, g);
    let changed = false;
    for (const item of g.story220.consequences) {
      if (item.status !== "pending" || item.dueTurn > g.turn || (item.dueTurn === 12 && !finalMonth)) continue;
      const definition = ECHOES[item.id];
      const success = definition.test(g);
      const before = { stats: { ...g.stats }, hidden: { ...g.hidden } };
      item.status = success ? "fulfilled" : "broken";
      item.resolvedTurn = g.turn;
      apply(success ? definition.yes : definition.no, definition.title, echoText(item));
      item.actual = actual(before, g);
      changed = true;
    }
    g.story220 = normalize(g.story220, g);
    return changed;
  }
  function echoText(item) { return ECHOES[item.id]?.[item.status === "fulfilled" ? "success" : "failure"] || "此事尚待核验。"; }
  function escape(value) { return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
  function statusHtml(g) {
    if (!enabled(g) || g.ended) return "";
    const story = normalize(g.story220, g);
    const current = NODES.find(item => item.id === g.currentEventId);
    const next = NODES.find(item => item.turn >= story.entryTurn && !story.decisions[item.id]);
    const known = NODES.filter(item => story.decisions[item.id]);
    return `<div class="story220-heading"><strong>汉祚将尽</strong><span>${story.phase} / 4 幕已裁</span></div><p>${escape(current?.crisis || (next ? `下一章：${next.title} · 第${Math.max(next.turn, g.turn)}月。当前仍须处理本月奏报。` : "最后朝议已落定，承诺仍须终月国势核验。"))}</p><details><summary>前因与历史记录${known.length ? ` · ${known.length} 项裁决` : ""}</summary>${known.length ? `<ol>${known.map(node => `<li>第${story.decisions[node.id].turn}月 · ${escape(node.title)}：${escape(choiceFor(node.id, story.decisions[node.id].choice).label)}</li>`).join("")}</ol>` : "<p>尚无可证实的主线裁决；旧档不补造前情。</p>"}${story.consequences.map(item => `<p><b>${escape(ECHOES[item.id].title)}</b> · ${item.status === "pending" ? `第${item.dueTurn}月待核验，不保证兑现` : escape(echoText(item))}</p>`).join("")}</details>`;
  }
  function buildAfterword(g) {
    if (!enabled(g) || !g.ended || g.turn !== 12 || g.monthlySettledTurn < 12) return null;
    const story = normalize(g.story220, g);
    if (story.completedNormally !== true && !(story.completedNormally === null && !/幽闭|弃汉|败露|解体|锁宫/.test(g.ending?.title || ""))) return null;
    const records = NODES.filter(node => story.decisions[node.id]);
    if (!records.length) return { direction: "unknown", title: "延康史臣后记", paragraphs: [`旧档没有可证实的主线裁决，仅据终局“${g.ending?.title || "未载"}”记述：皇权 ${Math.round(g.stats.authority)}、威望 ${Math.round(g.stats.prestige)}、宫廷安全 ${Math.round(g.stats.security)}。不追述未经记录的联署、交玺或旧约。`] };
    const final = story.decisions.story220_council;
    const stance = final ? choiceFor("story220_council", final.choice).stance : story.stance;
    const direction = stance === "resist" ? "resist" : stance === "preserve" ? "preserve" : "negotiate";
    const purpose = { resist: "天子最后所争，是汉廷仍有拒绝与具名留奏的资格。", preserve: "天子最后所护，是宗庙、旧臣与家属仍能承受的生活，而非无代价的皇权。", negotiate: "天子以让步、文书或行在安排争取余地；这份空间不能等同于重掌天下。" }[direction];
    const decisions = records.map(node => `第${story.decisions[node.id].turn}月“${choiceFor(node.id, story.decisions[node.id].choice).label}”`).join("；");
    const costs = records.flatMap(node => Object.entries(story.decisions[node.id].actual?.stats || {}).filter(([key, value]) => key === "caoAlert" ? value > 0 : value < 0).map(([key, value]) => `${STAT_NAMES[key]}${value > 0 ? "+" : ""}${value}`));
    const paid = costs.length ? `各幕直接付出的代价有：${costs.join("、")}；其后行动和月末结算另有变化。` : "既有记录不足以列出各幕实际支出，不把未知代价写作零。";
    const opinion = `杨彪${relation(g) >= 65 ? "仍愿为天子的礼法选择作证" : "把家族安危置于继续争权之前"}；百官支持终为 ${Math.round(g.stats.officials)}，不能将沉默一概写作拥戴。`;
    const promises = story.promises.map(item => `${choiceFor(item.sourceId, story.decisions[item.sourceId].choice).promise}：${item.status === "fulfilled" ? "本局核验已兑现" : item.status === "broken" ? "核验未能兑现" : "缺少兑现证据"}`).join("；");
    return { direction, title: "延康史臣后记", paragraphs: [purpose, `可考之事：${decisions}。${paid}`, opinion, `${promises || "没有另作保全保证。"}。终局仍为“${g.ending?.title || "未载"}”；留下的政治遗产以真实国势为限，不据志向另判中兴。`] };
  }
  function afterwordHtml(g) {
    const word = buildAfterword(g);
    return word ? `<h3>${escape(word.title)}</h3>${word.paragraphs.map(text => `<p>${escape(text)}</p>`).join("")}` : "";
  }
  function afterwordText(g) { const word = buildAfterword(g); return word ? [word.title, ...word.paragraphs].join("\n") : ""; }

  window.XianScenario220Story = Object.freeze({ initial, normalize, enabled, selectEvent, buildEvent, record, settle, statusHtml, buildAfterword, afterwordHtml, afterwordText, nodes: () => NODES.map(node => ({ ...node })) });
})();
