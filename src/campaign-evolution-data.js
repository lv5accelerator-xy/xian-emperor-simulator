/* 天子蒙尘：献帝模拟器 v1.5.0 · 战役阶段、人物差遣与动态战线数据 */
window.XIAN_CAMPAIGN_DATA = Object.freeze({
  version: "1.5.0",
  scenarioStages: {
    zhongping_189: [
      { id: "189-palace", title: "保全宫禁", summary: "先让洛阳朝廷撑过最危险的混乱。", goals: [{ type: "statMin", key: "security", target: 35, label: "宫廷安全达到 35" }, { type: "statMin", key: "officials", target: 35, label: "百官支持达到 35" }], reward: { effects: { security: 2, prestige: 1 } } },
      { id: "189-road", title: "预备东出", summary: "为天子与百官留下一条可以实际使用的道路。", goals: [{ type: "turnMin", target: 4, label: "坚持至第 4 月" }, { type: "hiddenMin", key: "escapeRoute", target: 18, label: "退路准备达到 18" }], reward: { effects: { treasury: 2 }, hidden: { escapeRoute: 2 } } },
      { id: "189-court", title: "衣冠不散", summary: "流离之际，朝廷的骨架不能先散。", goals: [{ type: "statMin", key: "officials", target: 45, label: "百官支持达到 45" }, { type: "statMin", key: "treasury", target: 20, label: "国库保持 20" }], reward: { effects: { officials: 2, prestige: 2 } } },
      { id: "189-refuge", title: "重建行在", summary: "让逃亡不只是苟活，而是一次朝廷重组。", goals: [{ type: "statMin", key: "authority", target: 42, label: "皇权达到 42" }, { type: "statMin", key: "prestige", target: 55, label: "汉室威望达到 55" }], reward: { effects: { authority: 3, security: 2 } } },
    ],
    xingping_195: [
      { id: "195-carriage", title: "整顿车驾", summary: "让东归队伍重新有粮、有序、有护卫。", goals: [{ type: "statMin", key: "security", target: 32, label: "宫廷安全达到 32" }, { type: "statMin", key: "treasury", target: 15, label: "国库达到 15" }], reward: { effects: { treasury: 2, security: 1 } } },
      { id: "195-route", title: "打通东归路", summary: "关中至河洛的通道必须先恢复最低运力。", goals: [{ type: "routeSupplyMin", key: "luoyang_changan", target: 35, label: "洛阳—长安军路补给达到 35" }, { type: "turnMin", target: 4, label: "坚持至第 4 月" }], reward: { effects: { prestige: 2 }, hidden: { escapeRoute: 2 } } },
      { id: "195-officials", title: "收拢百官", summary: "把离散的官署重新编回朝廷。", goals: [{ type: "statMin", key: "officials", target: 45, label: "百官支持达到 45" }, { type: "statMin", key: "prestige", target: 50, label: "汉室威望达到 50" }], reward: { effects: { officials: 2, authority: 1 } } },
      { id: "195-court", title: "重立朝廷", summary: "从流亡车驾恢复为能发出并执行命令的朝廷。", goals: [{ type: "statMin", key: "authority", target: 45, label: "皇权达到 45" }, { type: "statMin", key: "security", target: 50, label: "宫廷安全达到 50" }], reward: { effects: { authority: 3, prestige: 2 } } },
    ],
    jianan_196: [
      { id: "196-capital", title: "许都立足", summary: "先把新朝廷安顿下来，再谈恢复权力。", goals: [{ type: "statMin", key: "security", target: 55, label: "宫廷安全达到 55" }, { type: "statMin", key: "treasury", target: 35, label: "国库保持 35" }], reward: { effects: { treasury: 2, officials: 1 } } },
      { id: "196-edict", title: "诏令出京", summary: "让第一道真正影响天下的诏令离开许都。", goals: [{ type: "edictMin", target: 1, label: "至少颁布 1 道诏令" }, { type: "hiddenMin", key: "externalBalance", target: 25, label: "外部制衡达到 25" }], reward: { effects: { authority: 2, prestige: 1 } } },
      { id: "196-network", title: "建立制衡", summary: "让汉廷重新拥有曹氏之外的可用关系。", goals: [{ type: "hiddenMin", key: "externalBalance", target: 35, label: "外部制衡达到 35" }, { type: "assignmentCount", target: 1, label: "完成 1 次人物差遣" }], reward: { effects: { officials: 2 }, hidden: { loyalNetwork: 2 } } },
      { id: "196-independent", title: "朝廷自立", summary: "把名分转换成能够独立运作的权力。", goals: [{ type: "statMin", key: "authority", target: 55, label: "皇权达到 55" }, { type: "statMax", key: "caoAlert", target: 82, label: "曹氏警戒不高于 82" }], reward: { effects: { authority: 3, prestige: 2 } } },
    ],
    jianan_200: [
      { id: "200-name", title: "守住官渡名分", summary: "曹袁争胜，朝廷先不能失去裁决天下的资格。", goals: [{ type: "statMin", key: "prestige", target: 55, label: "汉室威望达到 55" }, { type: "statMin", key: "security", target: 45, label: "宫廷安全达到 45" }], reward: { effects: { prestige: 2, treasury: 1 } } },
      { id: "200-balance", title: "维持曹袁制衡", summary: "不让任何一方轻易独占朝廷名义。", goals: [{ type: "hiddenMin", key: "externalBalance", target: 40, label: "外部制衡达到 40" }, { type: "statMax", key: "caoAlert", target: 78, label: "曹氏警戒不高于 78" }], reward: { effects: { authority: 2 }, hidden: { externalBalance: 1 } } },
      { id: "200-supply", title: "畅通中原粮路", summary: "战线越紧，越要保住许都至邺城的粮道。", goals: [{ type: "routeSupplyMin", key: "xudu_ye", target: 50, label: "许都—邺城军路补给达到 50" }, { type: "assignmentCount", target: 1, label: "完成 1 次人物差遣" }], reward: { effects: { treasury: 3, security: 1 } } },
      { id: "200-settle", title: "战后定局", summary: "无论官渡胜负，都让朝廷留有自己的落子。", goals: [{ type: "statMin", key: "authority", target: 55, label: "皇权达到 55" }, { type: "statMin", key: "officials", target: 50, label: "百官支持达到 50" }], reward: { effects: { authority: 3, prestige: 2 } } },
    ],
    yankang_220: [
      { id: "220-seal", title: "保全玺绶", summary: "大势逼近时，先保住天子名位与宫禁。", goals: [{ type: "statMin", key: "security", target: 38, label: "宫廷安全达到 38" }, { type: "statMin", key: "authority", target: 32, label: "皇权达到 32" }], reward: { effects: { security: 2, prestige: 1 } } },
      { id: "220-ministers", title: "召集旧臣", summary: "在沉默的朝堂里找到仍愿意承担风险的人。", goals: [{ type: "statMin", key: "officials", target: 45, label: "百官支持达到 45" }, { type: "hiddenMin", key: "loyalNetwork", target: 30, label: "忠汉网络达到 30" }], reward: { effects: { officials: 2 }, hidden: { loyalNetwork: 2 } } },
      { id: "220-edict", title: "留下诏令", summary: "哪怕无法改变大势，也要让史书留下天子的声音。", goals: [{ type: "edictMin", target: 1, label: "至少颁布 1 道诏令" }, { type: "statMin", key: "prestige", target: 50, label: "汉室威望达到 50" }], reward: { effects: { prestige: 3, authority: 1 } } },
      { id: "220-dignity", title: "不失天子之名", summary: "用最后的政治空间，为汉廷争得体面终局。", goals: [{ type: "statMin", key: "prestige", target: 60, label: "汉室威望达到 60" }, { type: "statMin", key: "authority", target: 45, label: "皇权达到 45" }], reward: { effects: { prestige: 3, authority: 3 } } },
    ],
  },
  assignments: [
    { id: "governor", name: "巡抚州郡", targetType: "city", duration: 3, description: "每月提高目标城池防御与朝廷向心。" },
    { id: "envoy", name: "持节出使", targetType: "lord", duration: 3, description: "每月提高目标诸侯对朝廷的信任。" },
    { id: "supervisor", name: "监军劳师", targetType: "army", duration: 3, description: "每月整顿目标军团士气、训练与补给。" },
  ],
  seasons: {
    spring: { name: "春汛", note: "道路解冻，山道仍然泥泞。" },
    summer: { name: "盛夏", note: "水运兴盛，也须提防暴雨冲毁漕路。" },
    autumn: { name: "秋收", note: "转运效率上升，是修复粮线的最好时机。" },
    winter: { name: "隆冬", note: "山道与关道行军成本提高。" },
  },
});
