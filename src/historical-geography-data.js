/*
 * 天子蒙尘：献帝模拟器 v2.6.1 · 郡国全图
 *
 * 海岸线轮廓由 Natural Earth 1:110m 公有领域数据简化、裁切并投影而来。
 * 汉末州郡范围、山川线位与文字标注服务于策略阅读，不构成精确历史测绘。
 * Source: https://www.naturalearthdata.com/
 */
(() => {
  "use strict";

  const WIDTH = 1200;
  const HEIGHT = 720;
  const ORIGIN_LONGITUDE = 108;
  const ORIGIN_LATITUDE = 20;
  const SCALE = 30;

  function project(point) {
    const longitude = Number(point?.[0]) || ORIGIN_LONGITUDE;
    const latitude = Number(point?.[1]) || ORIGIN_LATITUDE;
    return [
      Math.round((600 + (longitude - ORIGIN_LONGITUDE) * SCALE) * 10) / 10,
      Math.round((700 - (latitude - ORIGIN_LATITUDE) * SCALE) * 10) / 10,
    ];
  }

  function path(points, close = true) {
    if (!Array.isArray(points) || !points.length) return "";
    return `${points.map((point, index) => {
      const [x, y] = project(point);
      return `${index ? "L" : "M"}${x} ${y}`;
    }).join(" ")}${close ? " Z" : ""}`;
  }

  const cityCoordinates = Object.freeze({
    wuwei: [102.64, 37.93],
    changan: [108.95, 34.27],
    luoyang: [112.45, 34.62],
    xudu: [113.85, 34.04],
    nanzheng: [107.03, 33.07],
    chengdu: [104.07, 30.67],
    xiangyang: [112.14, 32.04],
    wan: [112.53, 33.00],
    shouchun: [116.80, 32.57],
    wujun: [120.62, 31.30],
    xiapi: [117.96, 34.31],
    linzi: [118.30, 36.82],
    ye: [114.62, 36.34],
    jinyang: [112.55, 37.87],
    ji: [116.40, 39.90],
    guangxin: [111.30, 23.50],
  });

  const regionCoordinates = Object.freeze({
    liangzhou: [[88.2, 39.8], [94, 42.6], [103, 42], [107, 39], [106, 35], [102, 32], [96, 34], [91, 37]],
    guanzhong: [[103, 36.8], [108, 37.2], [112, 35.7], [110.5, 32.8], [106, 32.5], [103, 34]],
    yizhou: [[96, 32], [103, 33], [109, 31.7], [110, 27], [106.5, 23], [100.5, 22], [96, 26]],
    hanzhong: [[104.5, 34], [109.5, 34.2], [111, 32], [108.5, 30.8], [104, 31.5]],
    jingzhou: [[108.8, 33.5], [114.8, 34], [116, 30], [114.5, 27], [109, 27.5], [107, 30.5]],
    jiaozhou: [[103.5, 26], [113.5, 26.2], [116, 22], [112, 18.4], [105, 19], [101, 22]],
    jiangdong: [[115, 31.5], [121.5, 32.8], [123.2, 28], [120.5, 24], [115.5, 26]],
    huainan: [[113.2, 34], [119.5, 34.6], [121, 31], [117.5, 29.2], [113, 30.5]],
    sili_yuzhou: [[108.5, 36.5], [115.5, 36.5], [117, 33.2], [114, 31.2], [110, 32]],
    xuzhou: [[116, 35.5], [121.6, 36], [122, 32.5], [118.5, 31], [116, 32]],
    qingzhou: [[116.5, 38.2], [122.8, 39], [123, 35.5], [120, 34.5], [116.8, 35.5]],
    jizhou: [[111.5, 40.5], [119, 40.5], [121, 36.5], [117.5, 34.5], [112.5, 35.5]],
    bingzhou: [[107.5, 41.5], [114, 42], [115, 37], [112.5, 34.8], [109, 36]],
    youzhou: [[114, 42.8], [123.5, 43], [124, 38.3], [120, 36.8], [115, 38]],
  });

  const landPaths = Object.freeze([
    {
      id: "china_mainland",
      d: "M0 10 L242.3 10 L250.5 18.2 L283.6 17.5 L345.5 24.3 L385.4 20.1 L415 24.6 L459.4 42.8 L495.7 42.7 L508.9 52.1 L543.9 36 L592.3 25.6 L637.3 24.4 L672.4 13.9 L677.5 10 L1170 10 L1170 48.1 L1166.1 45.5 L1145.5 66.8 L1112.4 82.9 L1088 102.1 L1046 110.9 L1023.9 124.9 L991.6 133.1 L1007.6 119.2 L1001.3 107.5 L1025.1 87.3 L1009.2 71.6 L983.1 82.2 L949.2 103.1 L930.7 122.4 L901.3 123.9 L886 137.9 L901.8 158.2 L926.3 163.1 L927.3 176.5 L951.1 185.3 L984.7 163.9 L1011.3 175.6 L1030.7 176.4 L1035.6 192.1 L993.1 200.5 L979.1 216.7 L949.9 231.7 L934.5 252.7 L966.8 269.2 L978.6 298.7 L996.9 326.2 L1017.2 349.2 L1016.8 371.5 L997.9 379.7 L1005.1 395.7 L1022.8 405 L1018.2 429.5 L1010.5 453.2 L993.8 455.9 L971.9 488.4 L947.6 527.8 L919.7 563.6 L878.4 591.3 L836.7 616.5 L802.9 620 L784.6 633.3 L774.2 623.5 L757.2 638.5 L715.3 653.5 L683.6 658.1 L673.3 689.8 L656.7 691.5 L648.8 669.8 L655.9 658.1 L615.7 648.5 L601.5 653.4 L571.3 645.6 L557 633.5 L561.8 616.2 L534.3 610.7 L519.9 599.4 L494.3 615.4 L465.1 618.9 L441.2 618.7 L425.1 626.1 L409.6 630.5 L414.1 664.8 L398.1 664 L395.4 656.9 L394.5 644.5 L372.5 653.2 L359.5 647.7 L337.2 636.5 L346 611.5 L327 605.7 L319.8 578.1 L288.1 583.1 L291.7 547.5 L320.2 522.4 L321.4 497.7 L320.5 474.7 L307.4 467.6 L297.4 449.9 L279.8 452.2 L247.5 447.7 L257.6 435.1 L243.5 416.4 L222.1 429 L197 421.7 L162.4 440.8 L135.1 463.1 L110.9 466.8 L97.8 458.8 L81.9 458.1 L60.5 451.1 L44.3 458.7 L24.4 481 L21.9 457.4 L3.6 463.7 L0 463.4 Z",
    },
    { id: "hainan", d: "M644.3 754.1 L619.7 744.8 L618.8 719 L633.6 705.4 L666.3 697 L683.6 697.7 L690.3 709.1 L677.1 722.3 L670.2 739.6 Z" },
    { id: "taiwan", d: "M1013.3 568.2 L995.3 616.3 L982.4 640.9 L966.6 615.6 L963.2 593.3 L980.8 563.8 L1004.9 541.1 L1018.5 550.1 Z" },
  ]);

  const rivers = Object.freeze([
    { id: "yellow", name: "黄河", points: [[96, 35], [101, 35.2], [103.5, 36.2], [105, 38], [107, 40], [109, 40], [110.5, 36.8], [112.5, 35], [114.5, 35.2], [116.5, 36.5], [119.3, 37.6]] },
    { id: "yangtze", name: "长江", points: [[92, 33], [97, 32], [101, 30.8], [104.1, 30.7], [106.5, 29.6], [110.3, 30.7], [112.5, 30.5], [115.5, 30.7], [118, 31.2], [121.6, 31.3]] },
    { id: "han", name: "汉水", points: [[106.8, 33.2], [109.2, 32.8], [112.1, 32], [112.5, 30.6]] },
    { id: "huai", name: "淮水", points: [[112.2, 33], [115, 32.8], [118, 33], [120.6, 33.5]] },
    { id: "pearl", name: "郁水", points: [[104, 24.2], [107, 24], [110, 23.5], [113.3, 23.1]] },
  ]);

  const ranges = Object.freeze([
    { id: "himalaya", name: "西南群山", points: [[88.5, 28], [92, 28.5], [96, 29], [100, 29.2]] },
    { id: "qilian", name: "祁连山", points: [[94, 39.2], [98, 39], [102, 38]] },
    { id: "qinling", name: "秦岭", points: [[103.5, 34], [107, 34.1], [110.5, 33.8]] },
    { id: "taihang", name: "太行山", points: [[111, 40.5], [112, 38], [113.2, 35.8]] },
    { id: "daba", name: "大巴山", points: [[105, 32], [108, 31.5], [110, 31.2]] },
    { id: "nanling", name: "南岭", points: [[107, 25.4], [111, 25], [115, 25.2]] },
  ]);

  const labels = Object.freeze([
    { text: "河 西", point: [98.5, 38.5], kind: "region" },
    { text: "关 中", point: [108.2, 35.2], kind: "region" },
    { text: "巴 蜀", point: [102.5, 28.5], kind: "region" },
    { text: "荆 襄", point: [111, 29.2], kind: "region" },
    { text: "中 原", point: [114.2, 34.1], kind: "region" },
    { text: "河 北", point: [115.5, 38.3], kind: "region" },
    { text: "江 东", point: [119.1, 29], kind: "region" },
    { text: "东 海", point: [124, 29.3], kind: "sea" },
    { text: "南 海", point: [116, 20.2], kind: "sea" },
  ]);

  const regionLabels = Object.freeze([
    { id: "liangzhou", text: "凉 州", point: [96.3, 39.4] },
    { id: "guanzhong", text: "雍 州", point: [106.8, 35.8] },
    { id: "yizhou", text: "益 州", point: [101.1, 27.2] },
    { id: "hanzhong", text: "汉 中", point: [106.6, 32.1] },
    { id: "jingzhou", text: "荆 州", point: [111.2, 28.3] },
    { id: "jiaozhou", text: "交 州", point: [107.3, 21.9] },
    { id: "jiangdong", text: "扬 州", point: [119.6, 27.2] },
    { id: "huainan", text: "淮 南", point: [117.2, 30.8] },
    { id: "sili_yuzhou", text: "司 隶 · 豫 州", point: [113.6, 33.8] },
    { id: "xuzhou", text: "徐 州", point: [119.6, 33.3] },
    { id: "qingzhou", text: "青 州", point: [120.2, 37.1] },
    { id: "jizhou", text: "冀 州", point: [116.2, 38.1] },
    { id: "bingzhou", text: "并 州", point: [111.2, 39.2] },
    { id: "youzhou", text: "幽 州", point: [120.5, 40.9] },
  ]);

  const minorPlaces = Object.freeze([
    { name: "敦煌", point: [94.66, 40.14] }, { name: "张掖", point: [100.45, 38.93] },
    { name: "金城", point: [103.83, 36.06] }, { name: "天水", point: [105.72, 34.58] },
    { name: "安定", point: [106.68, 35.55] }, { name: "弘农", point: [110.88, 34.52] },
    { name: "河内", point: [113.80, 35.45] }, { name: "陈留", point: [114.35, 34.80] },
    { name: "汝南", point: [114.35, 33.00] }, { name: "谯", point: [115.78, 33.85] },
    { name: "河东", point: [110.98, 35.03] }, { name: "上党", point: [113.10, 36.20] },
    { name: "常山", point: [114.56, 38.05] }, { name: "渤海", point: [117.48, 38.32] },
    { name: "辽西", point: [119.55, 40.05] }, { name: "辽东", point: [123.25, 41.25] },
    { name: "平原", point: [116.43, 37.17] }, { name: "北海", point: [119.10, 36.70] },
    { name: "彭城", point: [117.18, 34.26] }, { name: "广陵", point: [119.42, 32.39] },
    { name: "庐江", point: [117.28, 31.25] }, { name: "丹阳", point: [118.75, 31.95] },
    { name: "会稽", point: [120.58, 29.99] }, { name: "豫章", point: [115.86, 28.68] },
    { name: "江夏", point: [114.30, 30.58] }, { name: "江陵", point: [112.24, 30.34] },
    { name: "长沙", point: [112.94, 28.23] }, { name: "零陵", point: [111.61, 26.42] },
    { name: "巴郡", point: [106.55, 29.57] }, { name: "梓潼", point: [105.17, 31.64] },
    { name: "南海", point: [113.27, 23.13] }, { name: "合浦", point: [109.12, 21.48] },
  ]);

  window.XIAN_HISTORICAL_GEOGRAPHY = Object.freeze({
    version: "2.6.1",
    width: WIDTH,
    height: HEIGHT,
    source: "Natural Earth 1:110m · public domain",
    disclaimer: "海岸山河按真实方位简化；汉末州郡与势力范围为策略近似。",
    project,
    path,
    cityCoordinates,
    cityPositions: Object.freeze(Object.fromEntries(Object.entries(cityCoordinates).map(([id, point]) => [id, project(point)]))),
    regionCoordinates,
    regionPaths: Object.freeze(Object.fromEntries(Object.entries(regionCoordinates).map(([id, points]) => [id, path(points)]))),
    landPaths,
    rivers,
    ranges,
    labels,
    regionLabels,
    minorPlaces,
  });
})();
