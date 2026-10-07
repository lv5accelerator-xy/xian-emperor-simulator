# 天子蒙尘：献帝模拟器 — 开发约定

只使用当前个人 ChatGPT/Codex 账号；各项目环境独立。

- 保留原生 HTML/CSS/JavaScript、无构建步骤的架构，不迁入框架或游戏引擎。开始任务阅读 README.md、CODEX_HANDOFF.md 和 docs/README.md。
- 检查工作区、远端和分支；先运行 `node scripts/check.cjs` 建立基线。使用 Node.js 24。修改后重跑相关回归，发布相关变更执行完整检查。
- src/ 各模块有独立职责；沿用既有保存事件、加载顺序和统一结算，保持旧存档兼容。不要用 DOM 全树观察替代状态事件。
- EXPECTED_VERSION 必须与当前发布版本一致。版本变更同步 README、页面缓存参数、CHANGELOG、Patch Note 与 release-check.yml；不在流程规范化任务中升级游戏版本。
- 存档测试使用内存 mock 或隔离浏览器，不触碰玩家正式 localStorage。行为变更须验证真实交互及 pageerror；Node 回归不等同于浏览器验证。
- 不放入 API 密钥、个人数据或私有素材；现有自由诏令使用本地规则。AI 接入遵守 docs/AI_INTEGRATION.md。
- 使用 `codex/<task>` 分支和 PR；不得自动合并、修改仓库可见性、Pages 设置或部署。main 合并会触发现有 Pages 发布，需由用户决定时机。
- ChatGPT Project 保存产品决策和验收；GitHub 保存实际代码、测试与交接。跨账号用分支、PR、SHA 和 CODEX_HANDOFF.md；不要假设云环境、聊天或凭据共享。
- 交接记录命令、退出码、测试脚本数量、浏览器/云端是否执行，以及已提交/未提交/已推送状态。不得把未执行检查写成通过。
