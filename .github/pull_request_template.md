## 变更

<!-- 改了什么、为什么。 -->

## 验证

- [ ] `node scripts/check.cjs`
- [ ] 涉及界面时跑了相关的 `scripts/browser-*.cjs`
- [ ] 不应改变玩法结果的改动：`equivalence` 任务通过

## 兼容边界

<!-- 规则版本、核心存档 schema、存储键、随机序列是否变化；旧存档如何处理。 -->

- [ ] 确实改变了规则、数值或随机序列：已加 `changes-gameplay` 标签，并同步 CHANGELOG 与 patch-notes
- [ ] 改了资源文件：`index.html` 中对应的 `?v=` 缓存参数已更新
- [ ] 新增素材：已登记 CREDITS.md 并附可核验的许可
