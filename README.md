# 天子蒙尘：献帝模拟器

扮演汉献帝刘协，在汉末危局中以奏报、诏令、外交与军略维系汉室的纯前端游戏。

## 在线试玩

[开始游玩](https://lv5accelerator-xy.github.io/xian-emperor-simulator/)

<!-- TODO: 截图 -->

## 核心玩法

- 五个历史剧本，持续12至24个月，每月裁决奏报并使用有限行动。
- 自由拟旨，在用玺前复核人物、动作、城池顺序和军路；使用本地关键词规则。
- 处理人物与派系关系，选择御前方略和三月施政目标。
- 调遣军团，经历行军、野战、围城与战后裁决。
- 诸侯军议、结盟协战、议和及修好，以实际军务与长期履约决定外交后果。
- 短局、同题挑战与汉祚长卷提供复玩目标，终局可导出帝纪与千秋定论。

## 当前版本

<!-- CURRENT_VERSION_START -->
**v2.30.1**
补齐素材来源与许可证待决清单，保留history及全部授权TODO。
整理文档、贡献规范和版本工具；完整导出包增加只读结构版本，存储失败显示导出提醒。
规则、数值、随机序列和原存档迁移保持；验证覆盖固定种子、完整存档与全部回归。
<!-- CURRENT_VERSION_END -->

## 开始游玩

无需安装依赖、无需构建，双击根目录的 `index.html` 即可运行。
也可使用任意静态服务器，例如安装Python后执行 `python -m http.server 8000`，访问 http://localhost:8000/。
游戏不调用付费AI API；数据保存在当前浏览器，不会自动上传。

## 存档与兼容

- 支持完整JSON存档与旧版单一核心档导入，迁移保留旧结局及已有历史凭据。
- 完整包按系统白名单导出；备份索引、字体/字号与地图引导偏好不随包导出。
- 最近三个月与替换前备份可在“存档备份”查看；换设备或清理网站数据前先导出。
- 存档及备份使用浏览器localStorage，容量和浏览器权限会影响保存。

## 项目结构

| 路径 | 内容 |
| --- | --- |
| index.html、styles.css | 入口、经典脚本加载顺序与基础样式 |
| src/ | 数据、系统、模块样式与内嵌人物立绘 |
| assets/ | 本地字体、场景图、音乐与第三方许可附件 |
| scripts/、tests/ | Node.js维护脚本及自动发现的回归测试 |
| docs/、docs/archive/ | 当前规则、维护说明与历史版本文档 |
| CHANGELOG.md、patch-notes/ | 完整版本记录与逐版说明 |
| history/ | 历史ZIP，尚未删除或迁出Git历史 |
| .github/ | 发布检查与协作配置 |

## 测试

维护测试使用Node.js 24，不是游玩前提。

### 完整验证

```bash
node scripts/check.cjs
node scripts/check.cjs --regression-only
node scripts/check-doc-links.cjs
```

统一检查自动发现 `src/**/*.js` 语法与全部 `tests/*-regression.js`，无需维护手工测试列表。
日志默认写入仓库相邻的validation/；可用VALIDATION_OUTPUT指定目录。
单独运行发布测试时，预期版本应对应 `src/data.js`；手工覆盖写作 `EXPECTED_VERSION=<当前版本>`，须替换占位值。
浏览器检查另需Playwright与浏览器，可设置PLAYWRIGHT_MODULE指向现有安装；不影响游戏运行。

## 部署

GitHub Pages从main根目录直接发布，没有构建步骤。
发布元数据可用scripts/bump-version.cjs同步，先使用--dry-run审查；每次更新应先验证，再核对发布记录与普通网址；流程见[部署说明](docs/DEPLOY_GITHUB_PAGES.md)。

## 相关文档

- [文档索引](docs/README.md)与[完整更新记录](CHANGELOG.md)
- [游戏设计](docs/GAME_DESIGN.md)与[独立版本说明](patch-notes/README.md)
- [仓库盘点](docs/AUDIT_2026-11.md)与[AI接入边界](docs/AI_INTEGRATION.md)

## 授权

项目许可证待所有者选择，见[LICENSE](LICENSE)；逐项素材及待确认项见[CREDITS.md](CREDITS.md)。
Natural Earth原始轮廓的仓内公有领域说明见[地图数据](docs/MAP_DATA.md)，历史边界为游戏化近似。
本地字体及OFL附件见[字体说明](assets/fonts/README.md)；Noto Serif SC署名对应关系待核对。
音乐、立绘等仍有授权缺项，不能由公开可见或“原创”字样推定再分发许可。
