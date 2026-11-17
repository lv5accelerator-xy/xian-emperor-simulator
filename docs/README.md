# 文档索引

文件名带版本号的文档记录的是该版本引入时的规则与验证；规则后来又改过的，以“当前规则”为准。

## 当前版本 v2.30 规则

| 文档 | 内容 |
| --- | --- |
| [RULES_V230.md](RULES_V230.md) | 战后议和、遣使修好与长期外交记忆的规则 |
| [VALIDATION_V230.md](VALIDATION_V230.md) | v2.30 的失败用例、修复与验证记录 |
| [BALANCE_V230.md](BALANCE_V230.md) | 五个剧本固定种子的外交关系对照 |
| [HANDOFF_V230.md](HANDOFF_V230.md) | 入口、规则、对照与验证的交接摘要 |

## 设计与系统说明

| 文档 | 内容 |
| --- | --- |
| [GAME_DESIGN.md](GAME_DESIGN.md) | 核心游戏设计：资源、数值、行动、圣旨与终局 |
| [AUDIENCE_V225.md](AUDIENCE_V225.md) | 召见的国家收益与人物交往计次 |
| [CEASEFIRE_V225.md](CEASEFIRE_V225.md) | 停战、围城与军事实据 |
| [CHARACTERS_V225.md](CHARACTERS_V225.md) | 人物可用年份、势力代表与显示身份 |
| [SCENARIO_220_STORY.md](SCENARIO_220_STORY.md) | 延康元年剧本的四幕主线 |
| [MONTHLY_SAFETY.md](MONTHLY_SAFETY.md) | 月末预检与完整备份 |
| [SETTLEMENT_AUDIT.md](SETTLEMENT_AUDIT.md) | 结算对账、具体推荐与备份差异 |
| [SHORT_REVIEW.md](SHORT_REVIEW.md) | 短局复盘与一键重试 |
| [DECISION_COMPARISON.md](DECISION_COMPARISON.md) | 方案比较、目标转折与两局对比 |
| [READING_COMFORT.md](READING_COMFORT.md) | 三档字号与月报重点 |
| [TYPOGRAPHY.md](TYPOGRAPHY.md) | 古风／清晰两种字风 |
| [MAP_DATA.md](MAP_DATA.md) | 舆图海岸线来源与历史疆界的近似方式 |
| [AI_INTEGRATION.md](AI_INTEGRATION.md) | 将来接入大语言模型时的职责边界（尚未实现） |

## 工程与维护

| 文档 | 内容 |
| --- | --- |
| [ENGINEERING_NOTES.md](ENGINEERING_NOTES.md) | 现行工程约定：输出转义、只读快照、分帧结算、玩法等价、字体子集、缓存参数 |
| [SAVE_ARCHITECTURE.md](SAVE_ARCHITECTURE.md) | 全部存储键、导入兼容、容量风险与迁移候选方案 |
| [MODULE_REFACTOR_PLAN.md](MODULE_REFACTOR_PLAN.md) | 模块化评估：加载顺序、全局依赖与保留双击运行的取舍（仅方案） |
| [EDICT_CASES.md](EDICT_CASES.md) | 48 条圣旨解析行为快照与已知误判 |
| [BALANCE_SUMMARY.md](BALANCE_SUMMARY.md) | 历史 720 局平衡采样及统计口径 |
| [A11Y_AUDIT.md](A11Y_AUDIT.md) | 可访问性快检：键盘焦点、名称、对比度 |
| [MODAL_FOCUS.md](MODAL_FOCUS.md) | v2.30.2 通用弹窗焦点修复与验证 |

## 发布与协作

| 文档 | 内容 |
| --- | --- |
| [参与维护](../CONTRIBUTING.md) | 测试要求、提交约定、版本与素材规则 |
| [DEPLOY_GITHUB_PAGES.md](DEPLOY_GITHUB_PAGES.md) | 部署到 GitHub Pages |
| [RELEASE_MIGRATION.md](RELEASE_MIGRATION.md) | 历史 ZIP 清单与校验值、tag 与 Release 迁移建议（尚未执行） |
| [REPOSITORY_PROFILE.md](REPOSITORY_PROFILE.md) | 仓库简介、网站与主题标签（已设置） |
| [更新记录](../CHANGELOG.md) · [逐版说明](../patch-notes/README.md) | 全部版本记录 |
| [素材授权](../CREDITS.md) · [项目许可证](../LICENSE) | 素材来源与待确认事项；项目许可证尚待选择 |

## 快照（只记录当时状态）

| 文档 | 内容 |
| --- | --- |
| [AUDIT_2026-11.md](AUDIT_2026-11.md) | 2026 年 11 月仓库盘点，基线 v2.30.0 |
| [VERSION_INVENTORY.md](VERSION_INVENTORY.md) | 手写版本号位置清单，基线 v2.30.0；现以 `scripts/read-version.cjs` 为准 |

## 历史版本记录

以下是当时版本的规则、验证、平衡与交接记录，不能当作当前规则。

| 版本 | 规则 | 验证 | 平衡 | 交接 |
| --- | --- | --- | --- | --- |
| v2.29 | [RULES](archive/RULES_V229.md) | [VALIDATION](archive/VALIDATION_V229.md) | [BALANCE](archive/BALANCE_V229.md) | [HANDOFF](archive/HANDOFF_V229.md) |
| v2.28 | [RULES](archive/RULES_V228.md) | [VALIDATION](archive/VALIDATION_V228.md) | [BALANCE](archive/BALANCE_V228.md) | [HANDOFF](archive/HANDOFF_V228.md) |
| v2.27 | [RULES](archive/RULES_V227.md) | [VALIDATION](archive/VALIDATION_V227.md) | [BALANCE](archive/BALANCE_V227.md) | [HANDOFF](archive/HANDOFF_V227.md) |
| v2.26 | [RULES](archive/RULES_V226.md) | [VALIDATION](archive/VALIDATION_V226.md) | [BALANCE](archive/BALANCE_V226.md) | [HANDOFF](archive/HANDOFF_V226.md) |
| v2.25 | [RULES](archive/RULES_V225.md) | [VALIDATION](archive/VALIDATION_V225.md) | [BALANCE](archive/BALANCE_V225.md) | [HANDOFF](archive/HANDOFF_V225.md) |
| v2.24 | [RULES](archive/RULES_V224.md) | [VALIDATION](archive/VALIDATION_V224.md) | [BALANCE](archive/BALANCE_V224.md) | — |
| v2.16 | — | — | [BALANCE](archive/BALANCE_V216.md) | — |

数据文件：[`data/a11y-summary.json`](data/a11y-summary.json)、[`data/balance-paired-summary.json`](data/balance-paired-summary.json)；README 截图在 `images/`。
