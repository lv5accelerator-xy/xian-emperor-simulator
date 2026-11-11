# 素材来源与授权清单

本清单只记录仓库内可核实的说明、许可附件及字体文件元数据。项目许可证尚未选定，见[LICENSE](LICENSE)。第三方许可不随项目许可证自动变更；缺少凭据的项目保留TODO，由所有者确认。没有从曲名、编码器信息或“原创”字样推定作者与再分发权。

## 字体

来源版本与网页子集流程见[字体说明](assets/fonts/README.md)。以下作者取自字体名称表或随附许可的署名；原始文件没有被修改。名称表按[W3C WOFF2格式](https://www.w3.org/TR/WOFF2/)只读提取，文件自述不能替代授权链凭据。

| 文件/字体 | 来源 | 作者或署名 | 许可附件 | 是否允许再分发 |
| --- | --- | --- | --- | --- |
| wenkai-game-regular.woff2 / 霞鹜文楷 | 仓内固定lxgw/LxgwWenKai@a22e2a0；TTF blob 3e050e87caa5ce47f9c873079183e31f88fb8ce5 | LXGW 2021–2026；The Klee Project Authors 2020 | [SIL OFL 1.1及附加许可](assets/fonts/licenses/LXGW-WenKai-OFL.txt) | 按附件条件允许；网页交付子集/WOFF2可保留规定名称，不把该例外扩大到修改后的桌面安装字体 |
| wenkai-game-medium.woff2 / 霞鹜文楷 | 同一固定来源；TTF blob bc6e9fe500ef11c5f89089786b517b0a049437d6 | LXGW 2021–2026；The Klee Project Authors 2020 | 同上 | 同上 |
| zcool-xiaowei-game.woff2 / 站酷小薇体 | 仓内固定google/fonts@5e8a3ba，ofl/zcoolxiaowei | The ZCOOL XiaoWei Project Authors，2018 | [SIL OFL 1.1](assets/fonts/licenses/ZCOOL-XiaoWei-OFL.txt) | 按附件条件允许，保留声明与许可文本 |
| noto-sans-sc-game.woff2 / Noto Sans SC | 仓内固定google/fonts@5e8a3ba，ofl/notosanssc | Adobe，2014–2021；字体与附件署名对应 | [SIL OFL 1.1](assets/fonts/licenses/Noto-Sans-SC-OFL.txt) | 按附件条件允许，保留声明与许可文本 |
| noto-serif-sc-game.woff2 / Noto Serif SC | 仓内说明指向google/fonts@5e8a3ba，ofl/notoserifsc；产物与许可对应关系来源待补充(TODO) | 字体名称表：Adobe 2017–2024；附件：Google Inc. 2012，二者不一致 | [当前随附文本](assets/fonts/licenses/Noto-Serif-SC-OFL.txt)标为SIL OFL 1.1，但署名待核对 | 待确认(TODO)：所有者核对实际来源、正确版权声明及适用许可；本轮不擅自更换附件 |

字体文件SHA-256（用于对应上述证据）：

| 文件 | SHA-256 |
| --- | --- |
| noto-sans-sc-game.woff2 | 78fb94af3ec99d7aab5c09c79c21d99fa9d0c0a51006f1f5cbd2e88d51b1d73d |
| noto-serif-sc-game.woff2 | 34a8b947b3470f0a20dc4f416f58ffc71cdddd2ef2075f878b698a4e7a580eb4 |
| wenkai-game-medium.woff2 | c17fa8854bd63a1905fd14e8908ead3e362c13c968875a2b02ec75f1f08e59ae |
| wenkai-game-regular.woff2 | fc1e40011af356512cffc6036242447f3c2819dfba5d2320d6ab40fb2b30b738 |
| zcool-xiaowei-game.woff2 | 9ec1eb9dbd23c1804d1cb1c194e8777c07c6ec8acf15877018a1d5ab5de56604 |

## 地图数据

| 资源 | 来源 | 作者 | 许可/声明 | 是否允许再分发 |
| --- | --- | --- | --- | --- |
| src/historical-geography-data.js中的海岸线/岛屿轮廓 | [仓内MAP_DATA说明](docs/MAP_DATA.md)：Natural Earth 1:110m简化、裁切、投影 | Natural Earth项目；具体贡献者来源待补充(TODO) | 仓内说明原始数据为公有领域，并列出[上游地址](https://www.naturalearthdata.com/) | 原始数据依仓内公有领域说明；建议所有者保留上游声明证据(TODO) |
| 历史势力边界、州郡位置、山川与游戏化改绘 | 仓内说明为历史近似；制作记录来源待补充(TODO) | 来源待补充(TODO) | 项目许可待选；不能把原始轮廓声明自动套用于所有改绘 | 待所有者确认(TODO) |

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
- 优先核对Noto Serif SC产物与许可署名，补齐八份MP3以及内嵌音频的合法来源。
- 确认人物立绘、场景插图、历史地图改绘的制作人、归属与再分发范围。
- history/中的旧包没有逐个完成素材确权；当前清单不为历史包作统一授权保证。准备公开上传旧ZIP前，需逐包核对。
- 新增素材应同时更新本文件，并保存原始许可文本及来源版本，不用“原创”代替证据。
