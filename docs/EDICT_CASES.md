# 圣旨解析行为快照与已知误判

固定上下文：v2.30.0、建安元年、标准难度、种子42424242、第一月。48条只读解析/预览用例分为否定与语境、多目标与多政务、城池顺序各16条；没有实际颁旨，没有消耗行动点或随机状态。

数据见[edict-cases.json](../tests/fixtures/edict-cases.json)，回归见[edict-cases-regression.js](../tests/edict-cases-regression.js)。每条分别保存人工语义预期desired、实际observed和差异字段differences。测试断言现有快照，因此已知误判不冒充测试失败或已修复；修改解析逻辑不在本轮范围。

## 已知误判（12条）

以下只说明这个上下文中解析/路线识别的偏差，不声称都已产生错误军令。完整执行还有复核、资源、关系及军令约束。cityOrder是detectCityTargets输出；倒装句预期按语义起终点，当前实现按首次出现顺序，不能据此当作倒装已获支持。

| 编号 | 输入 | 差异字段 | 说明 |
| --- | --- | --- | --- |
| N09 | 不应出兵邺城 | hasEffectiveOrder | 不应属于否定语义 |
| N10 | 不宜讨伐袁绍 | hasEffectiveOrder | 不宜不能自动变成征讨 |
| N11 | 不得不赈济灾民 | hasEffectiveOrder | 双重否定表达必须赈济 |
| N12 | 未必需要出兵邺城 | hasEffectiveOrder | 不确定建议不应直接视为肯定命令 |
| N13 | 曹操并非要出兵邺城 | hasEffectiveOrder | 并非是否定 |
| N14 | 勿忘赈济灾民 | hasEffectiveOrder | 勿忘表示提醒执行 |
| N15 | 闻曹操欲出兵邺城，暂不下诏 | hasEffectiveOrder | 转述加不下诏不应作为朕的正向军令 |
| N16 | 传言董承密令联络袁绍，并非朕意 | hasEffectiveOrder | 传闻/引语不应自动成为执行命令 |
| M05 | 褒奖荀彧并问罪董承 | blocked | 同句褒贬对象也应区分 |
| C12 | 攻许都，再从邺城出发 | cityOrder | 语义先给目标后给起点；当前首现法不能理解倒装 |
| C13 | 向洛阳进兵，起点是长安 | cityOrder | 目标先述的倒装路线 |
| C15 | 不应从许都向邺城出兵 | cityOrder | 不应否定语义下不应生成路线 |

## 复现

```powershell
node tests/edict-cases-regression.js
node scripts/check.cjs
```

不得在回归运行中重新生成快照；将来若修复误判，应先单独增加期望行为测试，再更改解析器并明确审核快照差异。当前JSON保留解析器来源哈希用于追溯，不把哈希强行作为未来文案/维护更新的失败条件。未穷尽方言、引文、全体人物可用年代与所有城池别名组合。
