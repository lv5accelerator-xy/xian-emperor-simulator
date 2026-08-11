/* 天子蒙尘：献帝模拟器 v1.0.0 · 御前方略、人物事件链与收藏数据 */
window.XIAN_IMPERIAL_PROGRESS_DATA = Object.freeze({
  paths: [
    {
      id: "covert",
      icon: "密",
      name: "潜结忠汉",
      summary: "以宫中近臣和旧日汉官为骨架，建立能绕过外府传递诏令的隐秘网络。",
      risk: "网络扩张会同步提高泄密与宫禁风险。",
      recommendation: "优先处理密令、召见与宫禁安全，避免在泄密风险过高时继续扩张。",
      stages: [
        {
          title: "辨认真心",
          description: "先证明朝廷仍能保护愿意效忠的人。",
          objectives: [
            { source: "hidden", key: "loyalNetwork", label: "忠汉网络达到 30", target: 30, mode: "min" },
            { source: "core", key: "edictsIssued", label: "至少颁布 1 道圣旨", target: 1, mode: "min" },
          ],
          reward: "解锁方略行动「密封名册」",
          action: {
            id: "sealed_roster", name: "密封名册", description: "整理可信名册，扩大忠汉网络，但留下更多往来痕迹。",
            effects: { security: -2, caoAlert: 2 }, hidden: { loyalNetwork: 7, leakRisk: 5 }, cooldown: 3,
          },
        },
        {
          title: "内外相应",
          description: "让宫内外联络形成稳定层级，并清理最危险的暴露点。",
          objectives: [
            { source: "hidden", key: "loyalNetwork", label: "忠汉网络达到 46", target: 46, mode: "min" },
            { source: "hidden", key: "leakRisk", label: "泄密风险不高于 55", target: 55, mode: "max" },
          ],
          reward: "解锁方略行动「清理耳目」",
          action: {
            id: "clear_watchers", name: "清理耳目", description: "以钱粮和调任掩护密线，显著降低泄密风险。",
            effects: { treasury: -4, officials: 1 }, hidden: { leakRisk: -12 }, cooldown: 3,
          },
        },
        {
          title: "灯下同盟",
          description: "忠臣之间已经能够彼此印证诏令，最后要确保宫门不先失守。",
          objectives: [
            { source: "hidden", key: "loyalNetwork", label: "忠汉网络达到 62", target: 62, mode: "min" },
            { source: "stats", key: "security", label: "宫廷安全达到 38", target: 38, mode: "min" },
          ],
          reward: "解锁方略行动「合议密诏」与专属终局",
          action: {
            id: "council_edict", name: "合议密诏", description: "让多条密线共同验证诏令，以更高风险换取真实执行力。",
            effects: { authority: 5, prestige: 2, caoAlert: 6 }, hidden: { leakRisk: 5 }, cooldown: 4,
          },
        },
      ],
      ending: {
        title: "灯下同盟",
        text: "宫门之外仍有重兵，灯下却已有一批人能辨认真正出自天子的诏令。你没有凭空得到天下，却让汉廷重新拥有了不可轻易剪断的神经。",
      },
    },
    {
      id: "balance",
      icon: "衡",
      name: "借力制衡",
      summary: "把汉室名分变成各镇都需要的政治资源，使任何一方都无法独占朝廷。",
      risk: "承诺过多会透支威望，也可能同时得罪许都与外镇。",
      recommendation: "优先外交、结交外镇与维护汉室威望，不要让曹氏警戒和外部承诺同时失控。",
      stages: [
        {
          title: "使节复道",
          description: "恢复朝廷与主要外镇之间可被信任的往来。",
          objectives: [
            { source: "hidden", key: "externalBalance", label: "外部制衡达到 30", target: 30, mode: "min" },
            { source: "stats", key: "prestige", label: "汉室威望保持在 60", target: 60, mode: "min" },
          ],
          reward: "解锁方略行动「分授节钺」",
          action: {
            id: "grant_staves", name: "分授节钺", description: "以有限名位换取外镇表态，扩大制衡但提高许都戒心。",
            effects: { prestige: 2, caoAlert: 4 }, hidden: { externalBalance: 8 }, cooldown: 3,
          },
        },
        {
          title: "两表并留",
          description: "让对立诸侯都必须通过尚书台争夺合法性。",
          objectives: [
            { source: "hidden", key: "externalBalance", label: "外部制衡达到 47", target: 47, mode: "min" },
            { source: "stats", key: "authority", label: "皇权达到 42", target: 42, mode: "min" },
          ],
          reward: "解锁方略行动「两表并议」",
          action: {
            id: "dual_memorial", name: "两表并议", description: "同时回应对立双方，强化朝廷仲裁地位。",
            effects: { authority: 4, prestige: 3, caoAlert: 3 }, hidden: { externalBalance: 5 }, cooldown: 3,
          },
        },
        {
          title: "共奉天子",
          description: "建立没有一方能够轻易退出的名分秩序。",
          objectives: [
            { source: "hidden", key: "externalBalance", label: "外部制衡达到 64", target: 64, mode: "min" },
            { source: "stats", key: "prestige", label: "汉室威望达到 68", target: 68, mode: "min" },
          ],
          reward: "解锁方略行动「会盟诏书」与专属终局",
          action: {
            id: "alliance_edict", name: "会盟诏书", description: "以汉廷名义固定诸镇承诺，代价是承担更多朝廷开支。",
            effects: { treasury: -5, prestige: 4, authority: 3 }, hidden: { externalBalance: 6 }, cooldown: 4,
          },
        },
      ],
      ending: {
        title: "天下共奉",
        text: "河北、荆州、江东与许都都仍有自己的军队，却没有一方能把汉廷据为私器。你以一纸纸互相牵制的诏书，换得了真实而脆弱的天下共奉。",
      },
    },
    {
      id: "guard",
      icon: "卫",
      name: "掌控宿卫",
      summary: "从宫门、尚书台和朝廷直属军开始，逐步建立真正服从御前的执行力量。",
      risk: "军政权的任何增长都会直接触动强势外府。",
      recommendation: "优先稳住宫廷安全、国库与皇权，军权增长过快时主动降低曹氏警戒。",
      stages: [
        {
          title: "整饬宫门",
          description: "先让宫门与近卫知道该服从哪一道命令。",
          objectives: [
            { source: "stats", key: "security", label: "宫廷安全达到 62", target: 62, mode: "min" },
            { source: "stats", key: "authority", label: "皇权达到 38", target: 38, mode: "min" },
          ],
          reward: "解锁方略行动「宿卫点名」",
          action: {
            id: "guard_rollcall", name: "宿卫点名", description: "亲自核对宫门名册，提高安全与皇权。",
            effects: { security: 7, authority: 2, caoAlert: 4 }, cooldown: 3,
          },
        },
        {
          title: "军政分理",
          description: "让朝廷直属事务不再完全依附外府粮饷。",
          objectives: [
            { source: "stats", key: "authority", label: "皇权达到 52", target: 52, mode: "min" },
            { source: "stats", key: "treasury", label: "国库保持在 28", target: 28, mode: "min" },
          ],
          reward: "解锁方略行动「御前支应」",
          action: {
            id: "imperial_supply", name: "御前支应", description: "以国库维持直属宿卫，换取更稳定的执行力。",
            effects: { treasury: -5, security: 5, authority: 3 }, cooldown: 3,
          },
        },
        {
          title: "宫门自掌",
          description: "直属力量足以保护诏令和百官，而不是只保护天子的名号。",
          objectives: [
            { source: "stats", key: "authority", label: "皇权达到 66", target: 66, mode: "min" },
            { source: "stats", key: "security", label: "宫廷安全达到 58", target: 58, mode: "min" },
          ],
          reward: "解锁方略行动「御营会操」与专属终局",
          action: {
            id: "imperial_drill", name: "御营会操", description: "公开检阅直属力量，显著提高皇权，也会引来严密监视。",
            effects: { treasury: -4, authority: 6, security: 3, caoAlert: 8 }, cooldown: 4,
          },
        },
      ],
      ending: {
        title: "宫门自掌",
        text: "朝廷直属的力量尚不足以横扫天下，却已足以保护诏书、百官和宫门。强臣仍在殿外，而殿内的命令终于不必先问他人是否许可。",
      },
    },
  ],
  arcs: [
    {
      id: "empress_fu", name: "伏皇后", title: "长秋宫灯", portrait: "伏",
      chapters: [
        {
          title: "宫门夜钥", text: "伏皇后发现夜间宫门钥匙被外府重新编号。她问你，是立即追查，还是先记下所有经手之人。",
          choices: [
            { label: "暗记名册", hint: "稳妥积累证据。", effects: { security: 2 }, hidden: { loyalNetwork: 3 }, relations: { empress_fu: 5 }, affinity: 1, chronicle: "帝后暗记宫门钥匙经手名册，没有惊动外府。" },
            { label: "当廷追问", hint: "维护体面但提高警戒。", effects: { authority: 3, caoAlert: 4 }, relations: { empress_fu: 2 }, affinity: 0, chronicle: "天子当廷追问宫门钥匙更换之事，外府答复恭谨而戒心更深。" },
          ],
        },
        {
          title: "衣带夹层", text: "皇后命人送来一件旧衣，夹层中能藏下一页名录。若使用它，长秋宫也会成为密线的一部分。",
          choices: [
            { label: "共担此险", hint: "强化忠汉网络。", hidden: { loyalNetwork: 6, leakRisk: 4 }, relations: { empress_fu: 7 }, affinity: 1, chronicle: "帝后共用衣带夹层传递名录，长秋宫从此也在局中。" },
            { label: "烧去名录", hint: "保护皇后与宫禁。", effects: { security: 5 }, hidden: { leakRisk: -5 }, relations: { empress_fu: -2 }, affinity: -1, chronicle: "天子烧去衣带名录，不许长秋宫再涉密线。" },
          ],
        },
        {
          title: "同看天明", text: "局势最紧时，皇后问：若汉廷只能保住一件东西，应当是宗庙、百官，还是你们仍能彼此信任。",
          choices: [
            { label: "宗庙与人皆不可弃", hint: "艰难而坚定。", effects: { prestige: 4, security: 2 }, relations: { empress_fu: 8 }, affinity: 1, chronicle: "帝后约定宗庙与人皆不可弃，共待许都天明。" },
            { label: "先保宫中平安", hint: "选择现实的守成。", effects: { security: 6, authority: -2 }, relations: { empress_fu: 1 }, affinity: 0, chronicle: "天子答应先保宫中平安，不再轻许不能兑现之事。" },
          ],
        },
      ],
      memory: "长秋宫旧信", goodTitle: "与后同心",
    },
    {
      id: "dong_cheng", name: "董承", title: "车骑密札", portrait: "董",
      chapters: [
        { title: "旧部名单", text: "董承呈上一份旧部名单，其中既有可信之人，也有急于求进者。", choices: [
          { label: "逐人查验", hint: "进展较慢但更安全。", hidden: { loyalNetwork: 4, leakRisk: -2 }, relations: { dong_cheng: 4 }, affinity: 1, chronicle: "董承奉命逐人查验旧部，不许只凭热血入局。" },
          { label: "尽数联络", hint: "网络扩张更快。", hidden: { loyalNetwork: 8, leakRisk: 7 }, relations: { dong_cheng: 6 }, affinity: 0, chronicle: "董承尽数联络旧部，忠汉声势骤增，耳目也随之而来。" },
        ] },
        { title: "衣带之议", text: "董承请求一份能够证明天子亲命的密诏。此物可聚人，也可能成为定罪铁证。", choices: [
          { label: "只给口谕暗号", hint: "保留回旋余地。", effects: { authority: 2 }, hidden: { loyalNetwork: 3, leakRisk: 2 }, affinity: 1, chronicle: "天子只授口谕暗号，不使完整密诏落于人手。" },
          { label: "亲书密诏", hint: "高风险换取号召力。", effects: { authority: 5, caoAlert: 7 }, hidden: { loyalNetwork: 7, leakRisk: 8 }, relations: { dong_cheng: 5 }, affinity: 0, chronicle: "天子亲书密诏授董承，忠臣得凭，风险亦从此不可收回。" },
        ] },
        { title: "进退之门", text: "董承认为时机将至，请你决定继续积蓄，还是发动一次公开的朝议试探。", choices: [
          { label: "仍以百官为重", hint: "保存人员与制度。", effects: { officials: 4, authority: 2 }, hidden: { leakRisk: -4 }, relations: { dong_cheng: 2 }, affinity: 1, chronicle: "董承奉诏继续积蓄，以保存百官与制度为先。" },
          { label: "公开试探外府", hint: "争取权力但风险很高。", effects: { authority: 7, caoAlert: 9, security: -4 }, affinity: -1, chronicle: "朝议公开试探外府权柄，短暂夺回声势，也暴露了彼此底牌。" },
        ] },
      ], memory: "衣带密札", goodTitle: "汉室孤忠",
    },
    {
      id: "yang_biao", name: "杨彪", title: "旧臣持衡", portrait: "杨",
      chapters: [
        { title: "礼不可废", text: "杨彪请求恢复一项看似无用的朝仪，以证明尚书台仍按汉制运转。", choices: [
          { label: "准复朝仪", hint: "提高威望和百官支持。", effects: { treasury: -3, prestige: 4, officials: 3 }, relations: { yang_biao: 5 }, affinity: 1, chronicle: "天子准复朝仪，残破宫室中再见汉家班次。" },
          { label: "先省虚礼", hint: "保存国库。", effects: { treasury: 3, prestige: -2 }, relations: { yang_biao: -3 }, affinity: -1, chronicle: "朝廷暂省旧仪，以仅存钱粮维持百官俸给。" },
        ] },
        { title: "尚书台笔次", text: "外府要求先阅诏稿，杨彪建议以公文笔次保留尚书台最后一道核验权。", choices: [
          { label: "固守笔次", hint: "争取制度性权力。", effects: { authority: 5, officials: 3, caoAlert: 4 }, relations: { yang_biao: 5 }, affinity: 1, chronicle: "尚书台以笔次旧制保住诏稿最后核验之权。" },
          { label: "暂从外府", hint: "换取安全与缓和。", effects: { security: 4, caoAlert: -5, authority: -3 }, affinity: 0, chronicle: "诏稿暂送外府先阅，朝廷以制度退让换得一时缓和。" },
        ] },
        { title: "名器所系", text: "杨彪请你决定：乱世中的官爵应当坚持旧制，还是成为换取服从的筹码。", choices: [
          { label: "名器不可滥", hint: "维护长期威望。", effects: { prestige: 6, authority: 2 }, relations: { yang_biao: 6 }, affinity: 1, chronicle: "天子诏官爵必经尚书台核议，不以一时利害滥授。" },
          { label: "以爵换时", hint: "立刻获得外部空间。", effects: { authority: 3 }, hidden: { externalBalance: 6 }, relations: { yang_biao: -2 }, affinity: -1, chronicle: "朝廷以官爵换取外镇支持，名器因此更加沉重。" },
        ] },
      ], memory: "太尉旧笏", goodTitle: "汉仪守正",
    },
    {
      id: "xun_yu", name: "荀彧", title: "尚书台兰简", portrait: "荀",
      chapters: [
        { title: "法令归一", text: "荀彧指出许都政令互相冲突，请你允许尚书台撤回三道地方急令。", choices: [
          { label: "准其归一", hint: "提高行政与威望。", effects: { officials: 5, prestige: 2 }, relations: { xun_yu: 5 }, affinity: 1, chronicle: "尚书台撤回冲突急令，许都政务稍归一贯。" },
          { label: "急令不可缓", hint: "提高短期皇权。", effects: { authority: 3, officials: -2 }, affinity: -1, chronicle: "天子不许撤回急令，以即时号令压过行政次序。" },
        ] },
        { title: "奉汉与佐曹", text: "荀彧坦言，奉汉与佐曹眼下仍可并行，但二者终有互相冲突的一日。", choices: [
          { label: "请其守住中枢", hint: "争取长期合作。", effects: { officials: 4, caoAlert: -2 }, relations: { xun_yu: 7 }, affinity: 1, chronicle: "天子请荀彧守住中枢，使奉汉与平乱暂不相悖。" },
          { label: "逼其明言立场", hint: "获得清晰答案但关系恶化。", effects: { authority: 3, caoAlert: 3 }, relations: { xun_yu: -5 }, affinity: -1, chronicle: "天子逼问荀彧立场，殿中一时无言。" },
        ] },
        { title: "留兰台一灯", text: "荀彧请求保留一套不随权臣更替而改变的档案与考功制度。", choices: [
          { label: "制度重于一时胜负", hint: "强化百官和威望。", effects: { officials: 6, prestige: 4, treasury: -2 }, relations: { xun_yu: 6 }, affinity: 1, chronicle: "天子命兰台保存档案与考功制度，为后来者留下一盏灯。" },
          { label: "先服务当前权衡", hint: "转化为现实政治资源。", effects: { authority: 4, treasury: 3 }, relations: { xun_yu: -2 }, affinity: 0, chronicle: "兰台档案被用于眼前权衡，制度之灯仍在，却不再纯粹。" },
        ] },
      ], memory: "尚书台兰简", goodTitle: "兰台守灯",
    },
    {
      id: "cao_cao", name: "曹操", title: "许都对局", portrait: "曹",
      chapters: [
        { title: "同车入朝", text: "曹操请与你同车入朝，以向天下展示君臣相得。拒绝会被视为公开疏远。", choices: [
          { label: "同车而不同席", hint: "接受合作，保留礼制边界。", effects: { security: 3, caoAlert: -3, authority: 1 }, relations: { cao_cao: 4 }, affinity: 1, chronicle: "天子与曹操同车入朝，却仍以礼制分席。" },
          { label: "称疾独行", hint: "维护姿态，提高警戒。", effects: { prestige: 3, caoAlert: 5 }, relations: { cao_cao: -4 }, affinity: -1, chronicle: "天子称疾独行，许都由此看见君臣之间的距离。" },
        ] },
        { title: "军书与诏书", text: "曹操希望前线军书可以直接盖用朝廷印信，省去尚书台复核。", choices: [
          { label: "只授临时节制", hint: "兼顾军务与朝权。", effects: { authority: 2, caoAlert: 1 }, relations: { cao_cao: 3 }, affinity: 1, chronicle: "天子只授前线临时节制，印信仍须事后归档。" },
          { label: "准其便宜行事", hint: "安全提高，皇权受损。", effects: { security: 5, caoAlert: -5, authority: -5 }, relations: { cao_cao: 5 }, affinity: 0, chronicle: "前线得便宜用印，军令畅通，尚书台权柄却更轻。" },
        ] },
        { title: "殿前残局", text: "一次无人旁听的对局中，曹操问你究竟想做明主、守成之君，还是乱世中的胜者。", choices: [
          { label: "朕要留下可用的朝廷", hint: "以制度回答权力。", effects: { authority: 4, officials: 4, caoAlert: 2 }, relations: { cao_cao: 4 }, affinity: 1, chronicle: "天子答要留下可用的朝廷，曹操良久未落下一子。" },
          { label: "先活过这盘棋", hint: "降低当前危险。", effects: { security: 5, caoAlert: -6, prestige: -2 }, affinity: 0, chronicle: "天子答先活过这盘棋，殿前君臣都没有追问以后。" },
        ] },
      ], memory: "许都残局", goodTitle: "殿前执棋",
    },
  ],
  themes: [
    { id: "ink", name: "宫阙墨夜", requirement: "默认外观" },
    { id: "jade", name: "青玉朝仪", requirement: "完成任一御前方略" },
    { id: "frost", name: "霜金实录", requirement: "收录三个不同终局" },
  ],
});
