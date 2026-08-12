<h1 align="center">天子蒙尘：献帝模拟器</h1>

<p align="center">
  一款以汉献帝刘协为主角的汉末政治与军略模拟游戏。
</p>

<p align="center">
  <a href="https://lv5accelerator-xy.github.io/xian-emperor-simulator/"><strong>▶ 在线试玩</strong></a>
  ·
  <a href="CHANGELOG.md">更新记录</a>
  ·
  <a href="docs/README.md">维护文档</a>
  ·
  <a href="patch-notes/README.md">独立版本说明</a>
</p>

<p align="center">
  <a href="https://github.com/lv5accelerator-xy/xian-emperor-simulator/actions/workflows/release-check.yml">
    <img alt="版本检查状态" src="https://github.com/lv5accelerator-xy/xian-emperor-simulator/actions/workflows/release-check.yml/badge.svg">
  </a>
</p>

## 游戏简介

《天子蒙尘：献帝模拟器》使用原生 HTML、CSS 与 JavaScript 制作，无框架、无构建步骤。玩家扮演汉献帝刘协，在法统最高、实权最低的处境中，通过奏报裁决、诏令、人物关系、外交承诺、军团和州郡网络维持汉室，并尝试走向不同终局。

游戏提供五段汉末历史剧本，每局持续 12 至 24 个月。所有规则均在浏览器本地运行；自由拟写圣旨使用关键词规则解析，不调用付费 AI API。

## 核心玩法

- **朝堂裁决**：每月处理奏报，在皇权、威望、宫廷安全、国库与百官支持之间取舍。
- **自由诏令**：拟写圣旨并在用玺前核对受命者、动作、城池顺序、军路与外交承诺。
- **御前方略**：潜结忠汉、借力制衡、掌控宿卫三条路线各有阶段目标、专属行动与终局。
- **人物与派系**：连续人物事件、政治奏请、派系张力和动态谈判共同影响朝局。
- **九州舆图**：14 个区域、16 座城池、18 条军路和 14 支初始军团实时变化。
- **军团与攻城**：逐月行军、野战、围城、城池易手、俘虏归降和战后裁决形成完整战役链。
- **战役演进**：剧本阶段、人物差遣、季节天气和动态战线集中在统一战役台。
- **御前总览**：本月要务、人物记忆、山河印记、史官复盘与长卷进度集中在同一入口。
- **汉祚长卷**：五个历史剧本可以按年代连续游玩，前章留下有限历史印记影响后章。
- **跨局收藏**：保存方略记录、人物遗物、终局、称号、挑战成绩与朝仪外观。

## 当前版本

当前版本为 **v2.0.0「汉祚长卷」**。

- **v2.0.0**：五个历史剧本组成连续大 campaign，前章以有限历史印记影响后章。
- **v1.9.0**：自动整理关键转折、政治路线与历次终卷，支持导出史官复盘。
- **v1.8.0**：民政、礼制、外交等重要选择会形成有期限的山河印记。
- **v1.7.0**：人物记住影响关系的裁决，并可根据旧事提供御前问策。
- **v1.6.0**：统一御前总览、动态建议、行动后果与分阶段新手指引。

完整变化见 [CHANGELOG.md](CHANGELOG.md)，逐版本说明见 [patch-notes/](patch-notes/README.md)。

## 开始游玩

在线地址：<https://lv5accelerator-xy.github.io/xian-emperor-simulator/>

本地运行无需安装依赖：

```bash
git clone https://github.com/lv5accelerator-xy/xian-emperor-simulator.git
cd xian-emperor-simulator
python -m http.server 8000
```

随后打开 <http://localhost:8000/>。直接双击根目录的 `index.html` 也可以运行游戏。

## 存档与兼容

- 游戏数据保存在当前浏览器的 `localStorage` 中，不会自动上传服务器。
- 支持完整 JSON 存档导入与导出，也支持旧版单一核心存档。
- 完整存档覆盖核心游戏、月报、天下、诏令、军略、军团、政议、音频、剧本、御前档案、战役演进、人物记忆、山河印记、史官档案和汉祚长卷。
- 新系统使用独立存储键；旧存档加载时会自动补齐正式版字段。
- 换设备前应先导出存档；清除网站数据会删除未导出的本地进度。

## 项目结构

```text
xian-emperor-simulator/
├─ index.html                 # 游戏入口与模块加载顺序
├─ styles.css                 # 全局基础样式
├─ src/                       # 游戏数据、系统模块与模块样式
│  └─ portraits/             # 原创人物立绘数据
├─ assets/audio/bgm/          # 场景音乐与未启用备选曲
├─ docs/                      # 设计、部署与 AI 接入文档
├─ patch-notes/               # 每个正式版本的独立说明
├─ history/                   # 可独立运行的历史版本 ZIP
├─ tests/                     # 进度、地图、战役与发布回归测试
├─ CHANGELOG.md               # 累计版本记录
├─ .nojekyll                  # GitHub Pages 静态发布标记
└─ .github/workflows/         # 自动版本检查
```

## 测试

测试只需要 Node.js：

```bash
node tests/progression-regression.js
node tests/grand-map-regression.js
node tests/campaign-evolution-regression.js
node tests/legacy-systems-regression.js
```

发布检查还需要设置当前预期版本：

```bash
EXPECTED_VERSION=2.0.0 node tests/release-regression.js
```

GitHub Actions 会额外检查脚本语法、音频资源、圣旨目标顺序、军团计算、页面资源引用和独立版本说明。

## 部署

GitHub Pages 从 `main` 分支根目录直接发布。每次正式更新应同步修改游戏版本、资源缓存参数、`CHANGELOG.md`、对应 Patch Note 和发布检查中的预期版本。详细步骤见 [部署说明](docs/DEPLOY_GITHUB_PAGES.md)。

## 相关文档

- [文档索引](docs/README.md)
- [游戏设计文档](docs/GAME_DESIGN.md)
- [GitHub Pages 部署说明](docs/DEPLOY_GITHUB_PAGES.md)
- [后续 AI 接入边界](docs/AI_INTEGRATION.md)
- [场景音乐清单](assets/audio/bgm/README.md)

## 音乐与授权

游戏包含原创人物立绘、操作音效和五首场景背景音乐；三首备选曲仅归档，不进入运行时清单。仓库当前未附带开源许可证，公开可见不代表内容可被任意复制、修改或再发布。
