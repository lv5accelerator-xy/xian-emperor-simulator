/*
 * 天子蒙尘：献帝模拟器 v0.5.2
 * 军团、将领与战役推演基础数据。
 */
window.XIAN_ARMY_DATA = Object.freeze({
  version: "0.5.2",

  taskLabels: {
    idle: "驻军整顿",
    attack: "进攻",
    support: "驰援",
    defend: "守城",
    supply: "转运粮秣",
    advance: "调兵进驻",
    retreat: "撤退",
    siege: "围城",
  },

  statusLabels: {
    idle: "驻扎",
    marching: "行军",
    defending: "守备",
    supplying: "转运",
    engaged: "交战",
    besieging: "围城",
    routing: "败退",
    recovering: "休整",
    destroyed: "溃散",
  },

  commanders: [
    { id: "cao_cao", name: "曹操", command: 91, caution: 78, logistics: 87 },
    { id: "xiahou_dun", name: "夏侯惇", command: 78, caution: 66, logistics: 70 },
    { id: "yuan_shao", name: "袁绍", command: 79, caution: 58, logistics: 75 },
    { id: "yan_liang", name: "颜良", command: 82, caution: 42, logistics: 57 },
    { id: "yuan_shu", name: "袁术", command: 61, caution: 49, logistics: 64 },
    { id: "cai_mao", name: "蔡瑁", command: 68, caution: 74, logistics: 72 },
    { id: "sun_ce", name: "孙策", command: 90, caution: 55, logistics: 69 },
    { id: "wu_yi", name: "吴懿", command: 72, caution: 76, logistics: 74 },
    { id: "zhang_wei", name: "张卫", command: 64, caution: 65, logistics: 61 },
    { id: "ma_teng", name: "马腾", command: 79, caution: 63, logistics: 60 },
    { id: "lu_bu", name: "吕布", command: 94, caution: 38, logistics: 48 },
    { id: "gongsun_zan", name: "公孙瓒", command: 84, caution: 57, logistics: 55 },
    { id: "zhang_xiu", name: "张绣", command: 77, caution: 72, logistics: 64 },
    { id: "dong_cheng", name: "董承", command: 55, caution: 69, logistics: 58 }
  ],

  armies: [
    { id: "cao_central", name: "司空中军", owner: "cao_cao", ownerName: "曹操", commander: "cao_cao", cityId: "xudu", troops: 14500, morale: 78, supply: 86, training: 82, loyalty: 91 },
    { id: "cao_yingchuan", name: "颍川军", owner: "cao_cao", ownerName: "曹操", commander: "xiahou_dun", cityId: "xudu", troops: 8800, morale: 73, supply: 79, training: 76, loyalty: 89 },
    { id: "yuan_main", name: "河北中军", owner: "yuan_shao", ownerName: "袁绍", commander: "yuan_shao", cityId: "ye", troops: 17800, morale: 75, supply: 88, training: 72, loyalty: 84 },
    { id: "yuan_vanguard", name: "河北前军", owner: "yuan_shao", ownerName: "袁绍", commander: "yan_liang", cityId: "linzi", troops: 11200, morale: 79, supply: 72, training: 79, loyalty: 86 },
    { id: "yuan_shu_guard", name: "淮南禁军", owner: "yuan_shu", ownerName: "袁术", commander: "yuan_shu", cityId: "shouchun", troops: 12600, morale: 58, supply: 76, training: 61, loyalty: 68 },
    { id: "jingzhou_navy", name: "荆州水陆军", owner: "liu_biao", ownerName: "刘表", commander: "cai_mao", cityId: "xiangyang", troops: 10800, morale: 69, supply: 82, training: 68, loyalty: 82 },
    { id: "jiangdong_vanguard", name: "江东先锋", owner: "sun_ce", ownerName: "孙策", commander: "sun_ce", cityId: "wujun", troops: 9800, morale: 86, supply: 73, training: 84, loyalty: 93 },
    { id: "yizhou_guard", name: "益州州军", owner: "liu_zhang", ownerName: "刘璋", commander: "wu_yi", cityId: "chengdu", troops: 11800, morale: 67, supply: 89, training: 65, loyalty: 81 },
    { id: "hanzhong_guard", name: "汉中军", owner: "zhang_lu", ownerName: "张鲁", commander: "zhang_wei", cityId: "nanzheng", troops: 7200, morale: 72, supply: 77, training: 66, loyalty: 88 },
    { id: "liangzhou_riders", name: "凉州骑军", owner: "ma_han", ownerName: "马腾·韩遂", commander: "ma_teng", cityId: "wuwei", troops: 10100, morale: 80, supply: 64, training: 78, loyalty: 76 },
    { id: "xuzhou_flying", name: "徐州飞将军", owner: "lu_bu", ownerName: "吕布", commander: "lu_bu", cityId: "xiapi", troops: 8400, morale: 82, supply: 58, training: 86, loyalty: 62 },
    { id: "youzhou_cavalry", name: "幽州白马军", owner: "gongsun_zan", ownerName: "公孙瓒", commander: "gongsun_zan", cityId: "ji", troops: 9200, morale: 77, supply: 61, training: 80, loyalty: 85 },
    { id: "wan_defenders", name: "宛城军", owner: "zhang_xiu", ownerName: "张绣", commander: "zhang_xiu", cityId: "wan", troops: 7600, morale: 76, supply: 69, training: 74, loyalty: 87 },
    { id: "han_palace_guard", name: "汉廷宿卫", owner: "court", ownerName: "汉廷", commander: "dong_cheng", cityId: "xudu", troops: 2400, morale: 71, supply: 66, training: 58, loyalty: 96 }
  ]
});
