# 素材来源与授权清单

维护新增素材：`assets/favicon.svg`由本轮维护过程以基本几何图形手写，无外部图片或字体。作者记录为本次仓库维护；权利归属及项目再分发许可仍待所有者决定，见LICENSE中的TODO。本条不替代任何现有素材的授权凭据。

本清单只记录仓库内可核实的说明、许可附件及字体文件元数据。项目许可证尚未选定，见[LICENSE](LICENSE)。第三方许可不随项目许可证自动变更；缺少凭据的项目保留TODO，由所有者确认。没有从曲名、编码器信息或“原创”字样推定作者与再分发权。

## 字体

来源版本与网页子集流程见[字体说明](assets/fonts/README.md)。以下作者取自字体名称表或随附许可的署名；原始文件没有被修改。名称表按[W3C WOFF2格式](https://www.w3.org/TR/WOFF2/)只读提取，文件自述不能替代授权链凭据。

| 文件/字体 | 来源 | 作者或署名 | 许可附件 | 是否允许再分发 |
| --- | --- | --- | --- | --- |
| wenkai-game-regular.woff2 / 霞鹜文楷 | 仓内固定lxgw/LxgwWenKai@a22e2a0；TTF blob 3e050e87caa5ce47f9c873079183e31f88fb8ce5 | LXGW 2021–2026；The Klee Project Authors 2020 | [SIL OFL 1.1及附加许可](assets/fonts/licenses/LXGW-WenKai-OFL.txt) | 按附件条件允许；网页交付子集/WOFF2可保留规定名称，不把该例外扩大到修改后的桌面安装字体 |
| wenkai-game-medium.woff2 / 霞鹜文楷 | 同一固定来源；TTF blob bc6e9fe500ef11c5f89089786b517b0a049437d6 | LXGW 2021–2026；The Klee Project Authors 2020 | 同上 | 同上 |
| zcool-xiaowei-game.woff2 / 站酷小薇体 | 仓内固定google/fonts@5e8a3ba，ofl/zcoolxiaowei | The ZCOOL XiaoWei Project Authors，2018 | [SIL OFL 1.1](assets/fonts/licenses/ZCOOL-XiaoWei-OFL.txt) | 按附件条件允许，保留声明与许可文本 |
| noto-sans-sc-game.woff2 / Noto Sans SC | 仓内固定google/fonts@5e8a3ba，ofl/notosanssc | Adobe，2014–2021；字体与附件署名对应 | [SIL OFL 1.1](assets/fonts/licenses/Noto-Sans-SC-OFL.txt) | 按附件条件允许，保留声明与许可文本 |
| noto-serif-sc-game.woff2 / Noto Serif SC | 仓内固定google/fonts@5e8a3ba，ofl/notoserifsc；v2.30.3由该来源的`NotoSerifSC[wght].ttf`重新生成，产物来源已核实 | 字体名称表：Adobe 2017–2024；附件：Google Inc. 2012，二者不一致 | [随附文本](assets/fonts/licenses/Noto-Serif-SC-OFL.txt)为SIL OFL 1.1，与上游同一提交的`ofl/notoserifsc/OFL.txt`逐字一致；署名不一致来自上游本身 | 按附件条件允许；是否另行补充Adobe版权声明待所有者决定(TODO)，本轮不擅自更换附件 |

字体文件SHA-256（v2.31.0按上述固定来源重新生成后的值，用于对应上述证据）：

| 文件 | SHA-256 |
| --- | --- |
| noto-sans-sc-game.woff2 | 2347f733660633e3e3b55915745e4c8066cd12b5acde6f7165b52737d649c4a2 |
| noto-serif-sc-game.woff2 | 78da81db23b7ab78c92e103a5f1d2cee42f100a9dabd6be9cac338519c77e65a |
| wenkai-game-medium.woff2 | 5fbc9e53775b62e19ba45f1048ea209bf67e193fbe6afc89554ea61436b49d92 |
| wenkai-game-regular.woff2 | f40ec8855cbbac5b078eb734f52cfae2e98db5e3728411c0a5cff45c4fec79d4 |
| zcool-xiaowei-game.woff2 | 6463d874df5d91b46086c1d134b67c57bb2ef6b1b669d20b796d39700c9f3f84 |

## 地图数据

| 资源 | 来源 | 作者 | 许可/声明 | 是否允许再分发 |
| --- | --- | --- | --- | --- |
| assets/images/map/terrain.webp（地形底图） | Natural Earth 10m栅格 HYP_HR_SR（分层设色地形）与 GRAY_HR_SR（灰度山体阴影），取自维护者仓库 [nvkelso/natural-earth-raster](https://github.com/nvkelso/natural-earth-raster)；由scripts/build-map-terrain.py裁切、重新着色并按汉代海岸修订 | Natural Earth项目（Tom Patterson、Nathaniel Vaughn Kelso等） | Natural Earth数据为公有领域，见[上游使用条款](https://www.naturalearthdata.com/about/terms-of-use/) | 允许；SHA-256 `4efd0b353619c1f0e45a677583f93606e0725edee768a8e67e6843e10a46afed` |
| src/historical-geography-data.js 中的陆地、河流与湖泊轮廓 | Natural Earth 10m矢量 ne_10m_land、ne_10m_rivers_lake_centerlines、ne_10m_lakes（[nvkelso/natural-earth-vector](https://github.com/nvkelso/natural-earth-vector) 5.2.0-pre），同一脚本裁切、抽稀、投影 | Natural Earth项目 | 公有领域，同上 | 允许 |
| 汉代修订：东汉黄河与淮水下游、济水泗水汝水、汉代湖泽、汉代海岸、十三州界 | scripts/map-data/eastern-han.json，本仓库维护时依《续汉书·郡国志》郡国建制与通行历史地理常识整理的近似坐标；州界由105个郡国治所推算，未描摹任何受版权保护的历史地图 | 本次仓库维护 | 项目许可待选 | 待所有者确认(TODO) |
| 16座城池、14个策略区域与地名标注 | src/historical-geography-data.js 中手工维护的坐标，游戏化近似 | 来源待补充(TODO) | 项目许可待选 | 待所有者确认(TODO) |

## 五首运行音乐与三首备选

运行映射见[src/audio-tracks.js](src/audio-tracks.js)，用途说明见[音乐清单](assets/audio/bgm/README.md)。仓内只有曲名、文件及用途，未找到作者、下载/生成来源、订单或许可文本。备选曲不在运行映射内，这不等于具有再分发权。

| 文件 | 使用 | 来源 | 作者 | 许可证 | 是否允许再分发 |
| --- | --- | --- | --- | --- | --- |
| assets/audio/bgm/alternates/edict-leaves-capital-alt.mp3 | 归档备选，不启用 | 来源待补充(TODO) | 来源待补充(TODO) | 来源待补充(TODO) | 待确认(TODO) |
| assets/audio/bgm/alternates/han-imperial-afterglow-alt.mp3 | 归档备选，不启用 | 来源待补充(TODO) | 来源待补充(TODO) | 来源待补充(TODO) | 待确认(TODO) |
| assets/audio/bgm/alternates/rivers-and-mountains-remain-alt.mp3 | 归档备选，不启用 | 来源待补充(TODO) | 来源待补充(TODO) | 来源待补充(TODO) | 待确认(TODO) |
| assets/audio/bgm/closing-palace-gates.mp3 | 运行时场景曲 | 来源待补充(TODO) | 来源待补充(TODO) | 来源待补充(TODO) | 待确认(TODO) |
| assets/audio/bgm/edict-leaves-capital.mp3 | 运行时场景曲 | 来源待补充(TODO) | 来源待补充(TODO) | 来源待补充(TODO) | 待确认(TODO) |
| assets/audio/bgm/han-imperial-afterglow.mp3 | 运行时场景曲 | 来源待补充(TODO) | 来源待补充(TODO) | 来源待补充(TODO) | 待确认(TODO) |
| assets/audio/bgm/rivers-and-mountains-remain.mp3 | 运行时场景曲 | 来源待补充(TODO) | 来源待补充(TODO) | 来源待补充(TODO) | 待确认(TODO) |
| assets/audio/bgm/silent-jade-steps.mp3 | 运行时场景曲 | 来源待补充(TODO) | 来源待补充(TODO) | 来源待补充(TODO) | 待确认(TODO) |

## 人物立绘

README称其为项目原创，但未见逐项来源、作者、制作记录或再分发许可。不能由其他目录的插图说明推断本目录的生成来源。

| 资源 | 来源/作者 | 许可证 | 是否允许再分发 |
| --- | --- | --- | --- |
| src/portraits/cao_cao.js（内嵌WebP） | 来源待补充(TODO) | 来源待补充(TODO) | 待确认(TODO) |
| src/portraits/dong_cheng.js（内嵌WebP） | 来源待补充(TODO) | 来源待补充(TODO) | 待确认(TODO) |
| src/portraits/empress_fu.js（内嵌WebP） | 来源待补充(TODO) | 来源待补充(TODO) | 待确认(TODO) |
| src/portraits/liu_biao.js（内嵌WebP） | 来源待补充(TODO) | 来源待补充(TODO) | 待确认(TODO) |
| src/portraits/liu_xie.js（内嵌WebP） | 来源待补充(TODO) | 来源待补充(TODO) | 待确认(TODO) |
| src/portraits/sun_ce.js（内嵌WebP） | 来源待补充(TODO) | 来源待补充(TODO) | 待确认(TODO) |
| src/portraits/xun_yu.js（内嵌WebP） | 来源待补充(TODO) | 来源待补充(TODO) | 待确认(TODO) |
| src/portraits/yang_biao.js（内嵌WebP） | 来源待补充(TODO) | 来源待补充(TODO) | 待确认(TODO) |
| src/portraits/yuan_shao.js（内嵌WebP） | 来源待补充(TODO) | 来源待补充(TODO) | 待确认(TODO) |
| src/portraits/yuan_shu.js（内嵌WebP） | 来源待补充(TODO) | 来源待补充(TODO) | 待确认(TODO) |

## 场景插图

[目录说明](assets/images/illustrations/README.md)明确记载使用OpenAI内置图片生成模式，并保留源图于开发环境。该说明提供生成方式，没有列出具体制作人、权利归属凭据或项目再分发许可。

| 文件 | 来源 | 作者/归属 | 许可证/再分发 |
| --- | --- | --- | --- |
| assets/images/illustrations/army-crossing.webp | 仓内记载OpenAI内置图片生成 | 来源待补充(TODO) | 待所有者确认(TODO) |
| assets/images/illustrations/court-memorial.webp | 仓内记载OpenAI内置图片生成 | 来源待补充(TODO) | 待所有者确认(TODO) |
| assets/images/illustrations/ending-river-mountains.webp | 仓内记载OpenAI内置图片生成 | 来源待补充(TODO) | 待所有者确认(TODO) |
| assets/images/illustrations/granary-relief.webp | 仓内记载OpenAI内置图片生成 | 来源待补充(TODO) | 待所有者确认(TODO) |
| assets/images/illustrations/military-dispatch.webp | 仓内记载OpenAI内置图片生成 | 来源待补充(TODO) | 待所有者确认(TODO) |
| assets/images/illustrations/opening-palace.webp | 仓内记载OpenAI内置图片生成 | 来源待补充(TODO) | 待所有者确认(TODO) |
| assets/images/illustrations/palace-guard.webp | 仓内记载OpenAI内置图片生成 | 来源待补充(TODO) | 待所有者确认(TODO) |
| assets/images/illustrations/regional-envoys.webp | 仓内记载OpenAI内置图片生成 | 来源待补充(TODO) | 待所有者确认(TODO) |
| assets/images/illustrations/secret-edict.webp | 仓内记载OpenAI内置图片生成 | 来源待补充(TODO) | 待所有者确认(TODO) |
| assets/images/illustrations/treasury-crisis.webp | 仓内记载OpenAI内置图片生成 | 来源待补充(TODO) | 待所有者确认(TODO) |

## README截图与社交预览图

| 文件 | 来源 | 作者 | 再分发 |
| --- | --- | --- | --- |
| docs/images/screenshot-start.webp、screenshot-court.webp、screenshot-map.webp | 本仓库游戏画面截图（v2.30.3），仅作README展示 | 本次仓库维护 | 画面包含上表场景插图、字体与人物立绘，再分发条件随这些素材，待所有者确认(TODO) |
| docs/images/social-preview.png（源文件social-preview.html） | GitHub仓库社交预览图，由opening-palace.webp插图与自带字体排版 | 本次仓库维护 | 再分发条件随所用插图与字体，插图部分待所有者确认(TODO) |

## 内嵌操作音效及旧背景音频

资源位于[src/audio-data.js](src/audio-data.js)，为data:audio/ogg嵌入数据。编码器标记不等于作者或许可。

| 数据项 | 用途 | 来源 | 作者 | 许可证/再分发 |
| --- | --- | --- | --- | --- |
| button | 操作音效 | 来源待补充(TODO) | 来源待补充(TODO) | 待确认(TODO) |
| scroll | 操作音效 | 来源待补充(TODO) | 来源待补充(TODO) | 待确认(TODO) |
| seal | 操作音效 | 来源待补充(TODO) | 来源待补充(TODO) | 待确认(TODO) |
| report | 操作音效 | 来源待补充(TODO) | 来源待补充(TODO) | 待确认(TODO) |
| monthEnd | 操作音效 | 来源待补充(TODO) | 来源待补充(TODO) | 待确认(TODO) |
| warning | 操作音效 | 来源待补充(TODO) | 来源待补充(TODO) | 待确认(TODO) |
| bgm | 旧内嵌背景音乐 | 来源待补充(TODO) | 来源待补充(TODO) | 待确认(TODO) |

## 待所有者补齐

- 选择根目录项目许可证；当前LICENSE只作待决策占位。
- 决定Noto Serif SC是否另行补充Adobe版权声明（产物来源与附件已于v2.30.3核实，见上表）；补齐八份MP3以及内嵌音频的合法来源。
- 确认人物立绘、场景插图、历史地图改绘的制作人、归属与再分发范围。
- history/中的旧包没有逐个完成素材确权；当前清单不为历史包作统一授权保证。准备公开上传旧ZIP前，需逐包核对。
- 新增素材应同时更新本文件，并保存原始许可文本及来源版本，不用“原创”代替证据。
