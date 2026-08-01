/*
 * 天子蒙尘：献帝模拟器 v0.4.0
 * 城池、战争路线与外交承诺基础数据。
 *
 * 说明：本系统服务于策略推演，路线与数值均为游戏化表达，不是精确历史交通测绘。
 */
window.XIAN_STRATEGY_DATA = Object.freeze({
  version: "0.4.0",

  cities: [
    { id: "xudu", name: "许都", aliases: ["许都", "许县", "颍川"], regionId: "sili_yuzhou", controller: "cao_cao", controllerName: "曹操", defense: 78, supply: 82, courtLoyalty: 88, importance: "朝廷中枢" },
    { id: "luoyang", name: "洛阳", aliases: ["洛阳", "雒阳", "东都"], regionId: "sili_yuzhou", controller: "fragmented", controllerName: "残破郡县", defense: 33, supply: 24, courtLoyalty: 73, importance: "故都与河洛门户" },
    { id: "changan", name: "长安", aliases: ["长安", "西京"], regionId: "guanzhong", controller: "fragmented", controllerName: "关中诸将", defense: 51, supply: 36, courtLoyalty: 58, importance: "关中旧都" },
    { id: "wuwei", name: "武威", aliases: ["武威", "西凉"], regionId: "liangzhou", controller: "ma_han", controllerName: "马腾·韩遂", defense: 61, supply: 48, courtLoyalty: 43, importance: "凉州军镇" },
    { id: "nanzheng", name: "南郑", aliases: ["南郑", "汉中治所"], regionId: "hanzhong", controller: "zhang_lu", controllerName: "张鲁", defense: 72, supply: 65, courtLoyalty: 35, importance: "秦蜀咽喉" },
    { id: "chengdu", name: "成都", aliases: ["成都", "蜀郡"], regionId: "yizhou", controller: "liu_zhang", controllerName: "刘璋", defense: 76, supply: 86, courtLoyalty: 49, importance: "益州府库" },
    { id: "xiangyang", name: "襄阳", aliases: ["襄阳", "荆襄"], regionId: "jingzhou", controller: "liu_biao", controllerName: "刘表", defense: 74, supply: 79, courtLoyalty: 64, importance: "南北枢纽" },
    { id: "wan", name: "宛城", aliases: ["宛城", "宛", "南阳"], regionId: "jingzhou", controller: "zhang_xiu", controllerName: "张绣", defense: 68, supply: 57, courtLoyalty: 34, importance: "许都南屏" },
    { id: "shouchun", name: "寿春", aliases: ["寿春", "淮南治所"], regionId: "huainan", controller: "yuan_shu", controllerName: "袁术", defense: 69, supply: 72, courtLoyalty: 15, importance: "淮南核心" },
    { id: "wujun", name: "吴郡", aliases: ["吴郡", "吴县", "江东"], regionId: "jiangdong", controller: "sun_ce", controllerName: "孙策", defense: 63, supply: 71, courtLoyalty: 51, importance: "江东根基" },
    { id: "xiapi", name: "下邳", aliases: ["下邳", "徐州治所"], regionId: "xuzhou", controller: "lu_bu", controllerName: "吕布", defense: 57, supply: 49, courtLoyalty: 31, importance: "徐州要冲" },
    { id: "linzi", name: "临淄", aliases: ["临淄", "青州治所"], regionId: "qingzhou", controller: "yuan_shao", controllerName: "袁绍", defense: 58, supply: 62, courtLoyalty: 47, importance: "河北东翼" },
    { id: "ye", name: "邺城", aliases: ["邺城", "邺", "魏郡"], regionId: "jizhou", controller: "yuan_shao", controllerName: "袁绍", defense: 83, supply: 88, courtLoyalty: 55, importance: "河北中枢" },
    { id: "jinyang", name: "晋阳", aliases: ["晋阳", "太原"], regionId: "bingzhou", controller: "fragmented", controllerName: "并州诸部", defense: 59, supply: 45, courtLoyalty: 41, importance: "北地兵源" },
    { id: "ji", name: "蓟城", aliases: ["蓟城", "蓟", "幽州治所"], regionId: "youzhou", controller: "gongsun_zan", controllerName: "公孙瓒", defense: 67, supply: 52, courtLoyalty: 38, importance: "幽州门户" },
    { id: "guangxin", name: "广信", aliases: ["广信", "交州治所", "岭南"], regionId: "jiaozhou", controller: "shi_family", controllerName: "士氏", defense: 46, supply: 68, courtLoyalty: 57, importance: "远南通道" }
  ],

  routes: [
    { id: "xudu_luoyang", name: "许都—洛阳官道", from: "xudu", to: "luoyang", type: "官道", terrain: "河洛平原", supply: 66, pressure: 34 },
    { id: "luoyang_changan", name: "洛阳—长安关道", from: "luoyang", to: "changan", type: "关道", terrain: "潼关·崤函", supply: 42, pressure: 58 },
    { id: "changan_wuwei", name: "长安—武威西道", from: "changan", to: "wuwei", type: "驿道", terrain: "陇坂·河西", supply: 38, pressure: 49 },
    { id: "changan_nanzheng", name: "长安—南郑栈道", from: "changan", to: "nanzheng", type: "栈道", terrain: "秦岭", supply: 33, pressure: 46 },
    { id: "nanzheng_chengdu", name: "南郑—成都蜀道", from: "nanzheng", to: "chengdu", type: "栈道", terrain: "剑阁·蜀道", supply: 47, pressure: 35 },
    { id: "xudu_wan", name: "许都—宛城南道", from: "xudu", to: "wan", type: "官道", terrain: "颍川·南阳", supply: 64, pressure: 63 },
    { id: "wan_xiangyang", name: "宛城—襄阳荆襄道", from: "wan", to: "xiangyang", type: "官道", terrain: "南阳盆地", supply: 58, pressure: 52 },
    { id: "xudu_shouchun", name: "许都—寿春淮道", from: "xudu", to: "shouchun", type: "水陆", terrain: "颍水·淮河", supply: 61, pressure: 57 },
    { id: "xiangyang_shouchun", name: "襄阳—寿春江淮道", from: "xiangyang", to: "shouchun", type: "水陆", terrain: "汉水·淮西", supply: 49, pressure: 44 },
    { id: "shouchun_wujun", name: "寿春—吴郡江东水道", from: "shouchun", to: "wujun", type: "水路", terrain: "长江下游", supply: 69, pressure: 61 },
    { id: "xiangyang_wujun", name: "襄阳—吴郡长江线", from: "xiangyang", to: "wujun", type: "水路", terrain: "长江中游", supply: 57, pressure: 42 },
    { id: "xudu_xiapi", name: "许都—下邳徐州道", from: "xudu", to: "xiapi", type: "官道", terrain: "陈留·彭城", supply: 60, pressure: 66 },
    { id: "xiapi_linzi", name: "下邳—临淄青徐道", from: "xiapi", to: "linzi", type: "官道", terrain: "沂水·齐地", supply: 52, pressure: 48 },
    { id: "linzi_ye", name: "临淄—邺城河北道", from: "linzi", to: "ye", type: "官道", terrain: "平原·冀南", supply: 72, pressure: 39 },
    { id: "xudu_ye", name: "许都—邺城中原线", from: "xudu", to: "ye", type: "官道", terrain: "官渡·黄河", supply: 70, pressure: 68 },
    { id: "ye_ji", name: "邺城—蓟城幽冀道", from: "ye", to: "ji", type: "官道", terrain: "河北平原", supply: 63, pressure: 71 },
    { id: "ye_jinyang", name: "邺城—晋阳太行道", from: "ye", to: "jinyang", type: "山道", terrain: "太行山", supply: 40, pressure: 55 },
    { id: "chengdu_guangxin", name: "成都—广信南方通道", from: "chengdu", to: "guangxin", type: "远道", terrain: "牂牁·岭南", supply: 28, pressure: 22 }
  ],

  lords: [
    { id: "cao_cao", name: "曹操", aliases: ["曹操", "司空", "曹公"], seatCity: "xudu", defaultObjective: "整合中枢并控制许都外线" },
    { id: "yuan_shao", name: "袁绍", aliases: ["袁绍", "袁本初", "冀州牧"], seatCity: "ye", defaultObjective: "兼并幽州并争夺中原名分" },
    { id: "yuan_shu", name: "袁术", aliases: ["袁术", "袁公路", "后将军"], seatCity: "shouchun", defaultObjective: "据淮南扩张并挑战汉廷正统" },
    { id: "liu_biao", name: "刘表", aliases: ["刘表", "刘景升", "荆州牧"], seatCity: "xiangyang", defaultObjective: "保境荆襄并观望中原" },
    { id: "sun_ce", name: "孙策", aliases: ["孙策", "孙伯符", "讨逆将军"], seatCity: "wujun", defaultObjective: "平定江东并取得朝廷承认" },
    { id: "liu_zhang", name: "刘璋", aliases: ["刘璋", "益州牧"], seatCity: "chengdu", defaultObjective: "守住益州府库与蜀道" },
    { id: "zhang_lu", name: "张鲁", aliases: ["张鲁", "汉中张鲁"], seatCity: "nanzheng", defaultObjective: "控制汉中与秦蜀通道" },
    { id: "ma_han", name: "马腾·韩遂", aliases: ["马腾", "韩遂", "马腾韩遂", "凉州诸将"], seatCity: "wuwei", defaultObjective: "经营凉州并伺机进入关中" },
    { id: "lu_bu", name: "吕布", aliases: ["吕布", "温侯"], seatCity: "xiapi", defaultObjective: "保住徐州并寻求外援" },
    { id: "gongsun_zan", name: "公孙瓒", aliases: ["公孙瓒", "白马将军"], seatCity: "ji", defaultObjective: "抵御袁绍并控制幽州" }
  ],

  orderRules: [
    { id: "attack", label: "进攻", pattern: "讨伐|征讨|进兵|攻取|攻城|北伐|南征|东征|西征|击破" },
    { id: "support", label: "驰援", pattern: "援军|驰援|救援|增援|协防|救应" },
    { id: "defend", label: "守备", pattern: "坚守|固守|守备|布防|屯兵|设防|保境" },
    { id: "supply", label: "转运", pattern: "运粮|输粮|漕运|军粮|补给|屯粮|转饷" },
    { id: "ceasefire", label: "停战", pattern: "停战|罢兵|休兵|议和|停攻|止戈" },
    { id: "trade", label: "互市", pattern: "互市|通商|商路|市易|贸易" },
    { id: "advance", label: "调兵", pattern: "出兵|移兵|调兵|进驻|移驻" }
  ],

  promiseRules: [
    { id: "tribute", label: "贡赋承诺", pattern: "奉表|朝贡|贡赋|进贡|输贡|纳贡", deadline: 3, direction: "lord_to_court" },
    { id: "military_aid", label: "出兵承诺", pattern: "援军|出兵相助|勤王|协防|救援", deadline: 3, direction: "lord_to_court" },
    { id: "alliance", label: "盟约承诺", pattern: "结盟|盟约|会盟|共讨|同盟", deadline: 4, direction: "mutual" },
    { id: "ceasefire", label: "停战承诺", pattern: "停战|罢兵|休兵|议和|止戈", deadline: 2, direction: "mutual" },
    { id: "trade", label: "互市承诺", pattern: "互市|通商|市易|商路", deadline: 4, direction: "mutual" },
    { id: "hostage", label: "质子承诺", pattern: "送质|质子|人质|入侍", deadline: 3, direction: "lord_to_court" },
    { id: "title", label: "官爵承诺", pattern: "授官|加封|赐爵|封为|拜为|增秩", deadline: 1, direction: "court_to_lord" }
  ]
});