# v2.29 回归记录

基线为 main `cdbc10e4552765e8eae66a62a72fa6794fbad447`（v2.28.0）。先在原实现运行六组相关回归，全部通过；再新增失败用例，真实朝廷背盟仍得到“诸侯共奉”、只有国家数值而无履约仍可共奉、外镇方略绕过凭据均在修改前复现。只读预览接口在原版不存在。

新增三套行为回归：

- `diplomatic-ending-regression.js`：8类基本终局、两条共奉路线、只读预览、方略入口、旧终局兼容和快照冻结。
- `diplomatic-evidence-regression.js`：13组，包括纸面与远端支援不计战果、v2.28物理贡献佐证、历史裁剪、未知旧档、自主背盟、两期修复、真实止战、期满月承接、最后一月背盟、外部入口和终评一致、身份转义与背盟低分仍夺首维度的拟谥边界。
- `diplomatic-ending-persistence-regression.js`：20条完整存储轨迹，覆盖四种策略各自0/50/500ms、恢复及插入次序变化；比较完整核心、策略、军团、世界、方略及终评存储，核验多次提交不补算。

原有盟约30条完整轨迹、付费中断恢复、时间线恢复以及全部既有回归继续运行。固定种子自然对照与浏览器证据见本轮交付包；完成结果在交付报告与PR中逐项列明。

执行入口：`node scripts/check.cjs`、`node scripts/workflow-inline-check.cjs`、`node scripts/diplomatic-ending-balance.cjs` 和 `node scripts/browser-diplomatic-endings.cjs`。浏览器使用真实按钮、月末确认及文件导入导出，分别检查桌面与手机宽度、页面错误、越界和重载后的终局快照。
