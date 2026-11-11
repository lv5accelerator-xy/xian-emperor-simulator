# v2.24.0 玩法规则、提交边界与存档迁移

本文描述本轮已落入源码的行为与字段，不替代最终发布验证报告。产品版本为 v2.24.0，核心存档结构版本为 `schemaVersion: 102`，新局玩法规则身份为 `rulesVersion: 224`；三者承担不同职责。现有 localStorage 键继续沿用，避免仅因键名更换而丢失旧档。

## 一次操作何时完成

`XianEmperorGame.commit(kind)` 是同步玩法边界。裁决与行动先完成核心变化和同步事件，随后依序同步：天下 → 圣旨地方落实 → 天下复核 → 州郡军略 → 军团 → 外交事实核验 → 政议 → 因果 → 地方回响 → 战役阶段 → 御前方略 → 帝业。每轮保存核心、发出 `xian:core-saved`，再保存同步监听产生的奖励和回执；如果这些变化又满足了更早系统的条件，则继续下一轮，直到核心状态（忽略 `updatedAt`）前后相同。最多检查32轮，收敛后才发出 `xian:commit-completed`；超限会抛错，不发布完成事件。此判据比较核心状态，各外围系统仍依靠自己的状态与回执保证重复同步不重奖。

`operationDepth` 防止一项尚未完成的操作发布中间核心状态，`commitRunning` 防止提交递归。会改变玩法的旧保存监听在核心支持 commit 时不再依靠 debounce 驱动；计时器继续承担界面刷新、提示和重载。月内短暂达标会在那次已提交操作之后即时判定，不必维持到月末。

月末仍分阶段执行：旧事与地方回响、固定用度与泄密检验、世界/军略/军团、季度与后续回响、终值核验。`monthlySettledTurn`、`pendingSettlement`、`lastSettlement` 保留固定结算与中断续接依据，不把读取当作再次月末。正常操作返回后，保存与完整导出取得的是包含本次同步玩法结果的存档。

收敛过程每轮都会写入核心，并非最后一次才写入；超限或写入异常不会自动撤销之前的每轮写入。这不是跨浏览器标签页的数据库事务协议，也不宣称所有 localStorage 写入故障都具备通用事务回滚。新局替换和完整恢复有专门的备份与回滚流程；覆盖范围由相应故障注入回归界定。

## 持久化字段与默认值

| 所属状态 | 字段与默认值 | 用途及迁移 |
|---|---|---|
| 核心 | `schemaVersion: 102`、`rulesVersion: 224` | 分开标识存档结构与玩法规则。旧核心由 `migrateSave` 补齐。 |
| 核心 | `operationSequence: 0`、`appliedReceipts: []` | 操作计数及已兑现效果凭据；旧档保留已有数组，缺失时为空，不伪造历史。 |
| 核心 | `actionRepetitions: { turn, counts: {} }` | 当前月重复键的成功次数；记录月份与当前月不一致时清空。旧档没有记录时从空计数继续，不猜测旧操作。 |
| 核心 | `deadline` | 普通新局为剧本期限；短局和同题开局保存实际时长。读取入口同时检查活动挑战和剧本上限。 |
| 核心 | `ruleMigration: { from, to: 224, turn, comparisonEligible: false }` | 从其他规则身份读取时保留迁移事实；不改写旧成绩。 |
| 核心 | `importMigration: { source: "core-only", turn, rebuiltSystems: true, missingHistory: true }` | 明确旧核心缺少外围历史，供重建流程保守处理。 |
| 政议 | `schemaVersion: 2`、`generatedTurns: []`、`resolutionReceipts: {}` | 生成资格与待决列表分离。迁移综合待决、历史模板月份及旧 `lastProcessedTurn`，恢复当月资格与裁决凭据。 |
| 圣旨地方落实 | `processedReportIds: []` | 保存已落实的核心报告身份；仍保留原报告游标。 |
| 因果 | `metrics.courtBattles: 0`、`battleReceipts: {}`、`participationVersion: 1`、`participationMigration` | 天下战事与汉军参战分开记录；仅从明确参战方证据迁移。 |
| 地方回响 | `version: 2`、`resolutionReceipts: {}`、`conclusionReceipts: {}` | 玩家处分和延迟后报分别去重；显示历史裁剪不删除本局凭据。 |
| 战役阶段 | `skippedStages: []` | 旧核心缺史时，已达到的历史基线仅跳过，不记完成、不补奖。具有明确核心阶段回执的项目可恢复已完成身份。 |
| 汉祚长卷 | `pendingScenarioId: null`、`chapterGameIds: []` | 保存待接续章节与已处理的本局身份；初始化仅看到存储中的核心时保留待办，等待“继续游戏”安装可接收效果的实时核心。 |
| 月初快照 | `partial`、`capturedPhase` | 同一身份和月份的原始快照保持稳定；缺失且只能月中重建时标注部分基线。月报显示“载入后净变”。 |
| 季度记录 | `scheduledEndTurn`、`endReason` | 区分正常三月结算 `quarter-completed` 与本局结束归档 `campaign-ended`。 |
| 群臣主议 | `chosen.alignedActions`、`processed` | 当前季已用修正次数与消费操作身份；沿用已存计数，不给旧操作补发修正。新季归零。 |
| 军团 | `orderSequence: 0`、`promiseAttempts: {}`；军令的 `sourcePromiseId`、`targetOwner`、`arrivedTurn` | 绑定援军任务、记录真实到达与命令签发时敌对对象。旧军令序号可从原订单长度补齐；缺失到达证据不伪造。 |
| 外交承诺 | `contract.version: 1`、`receipts: []`、`delivered: 0` 等 | 保存责任方、数量、期限、任务和实际履约证据，详见下节。 |

`appliedReceipts` 是效果包的去重接口，不表示每个界面事件都自动进入此数组。不同系统还通过本局业务身份、已决状态和各自回执防止重复。主要凭据为：

- 阶段奖励：`stage:<gameCreatedAt>:<stageId>`。
- 长卷继承：`saga-legacy:<gameCreatedAt>`；成功应用或确认核心已有回执后，才登记章节身份并清除待继承标记。
- 贡赋到账：`tribute:<promiseId>:<turn>`，同时记录地方粮秣扣减和国库实际到账。
- 地方处分/后报：`regional-resolution:<echoId>`、`regional-conclusion:<echoId>`。
- 主议消费：核心的 `action-<createdAt>-<turn>-<totalActions>` 操作身份保存在主议 `processed` 中。
- 政议裁决：待决条目的稳定 ID 和 `resolutionReceipts`；生成月份另存于 `generatedTurns`。
- 战报：`processedEventIds`、`battleReceipts` 在整局保留，显示用历史裁剪不再重置参战计数资格。
- 占领：围城已 captured 的状态及 `conquest-<siegeId>` 身份共同阻止重复占领、战后待决与后续事件。

## 军事、主动付费与实际期限

军队抵达后按当前控制权、敌对野战军和城防重新判断：敌对野战军存在时进入野战；没有野战军但城防有效时建立围城；城防已失效并满足接管条件时走统一占领出口；友方目标完成驻防或相关命令。没有敌对野战军不再让进攻永久停留在 engaged。占领出口继续更新控制权、战后裁决、因果和地方回响。

`canAffordEffects` 依据确认时最新国库计算 `cost = max(0, -effects.treasury)` 和 shortfall。明确付费的主动入口在派系、城池、俘虏、章节等状态变化及随机检定前核验。预算不足保留待决事项并显示缺额；恰好足够时完整扣款。核心行动、战后汉官接掌、政议、地方回响、主议采纳和御前人物篇章均遵循这一边界。月末用度与战争损失仍是强制结算，不能套用主动费用拒绝规则。已结束局不能新增主动处分。

天下 `battles` 继续记录全部战争；帝业“参与战斗”改读 `courtBattles`。汉军明确参战或存在明确朝廷承担费用记录时才形成朝廷抚恤支出。旧档迁移仅承认带参与方的战报；对无证据的待结算 war_debt 做排除记录，不为历史已支付费用补扣或补退款。

`getDeadline(core)` 返回剧本 `maxTurns` 与活动挑战时长/保存的 deadline 中的实际截止月。普通局、短局、同题的月数显示、月末与终局核验使用该入口。季度需有完整三个月：剩余恰好三个月可立题；只有一、两个月时显示最终目标，不再提供新御题。旧档活动季度越界时在终局保存实际进度、原计划到期月与结束原因，不追加不存在月份的失败费用，也不因归档补发季度奖励。人物篇章的进度阈值也按实际期限计算。

## 主议修正和重复行动

主议配置集中在 `council-advice.js` 的 MODIFIERS，初始上限每季两次。采纳前展示即时效果、费用和后续修正；预算变化后再次确认仍重验。修正匹配稳定 `actionId`，不再根据报告中文关键词发放。行动计划同时保留 targetId、type 和 tags 供回执与比较使用。

| 主议 | 匹配常用行动 | 每次基础修正 |
|---|---|---|
| 杨彪 | ritual、appointment、revenue | 百官 +2；原本有费用时国库用度减少1。 |
| 荀彧 | relief、revenue | 百官 +1、民稳 +2。 |
| 曹操 | appease、revenue | 安全 +2；原本有费用时国库用度减少1。 |
| 董承 | secret、regional | 忠汉网络 +2。 |
| 伏皇后 | audience、relief、appease | 安全 +2、泄密风险 −1。 |
| 刘表 | regional、relief | 外部制衡 +2、威望 +1。 |

`XianActionPlans.build` 同时供预览、实际执行、推荐与比较使用。先加入本季可用主议修正，再对本月重复行动计算有利变化：

1. 重复键为 `actionId:targetId`；没有人物对象用 `actionId:none`。同类同对象换方式仍共用次数，换对象则独立。
2. 首次 multiplier=1；第二次及以后 multiplier=0.5。有利值乘系数后 `Math.trunc` 向零取整，警戒/泄密降低也算有利变化，例如 −3 变 −1。
3. 国库费用、行动点和不利变化保持原规则；主议本身的费用减免先计入，减免不会给无费用操作额外送钱。
4. 上下限后的实际变化进入预览。关系99时本来+4，显示与执行均只增加1。
5. 成功操作更新核心次数并以操作身份消费主议额度；预览、推荐、刷新不消费次数、主议或随机数。拒绝或取消不计数，新月重置重复次数，新季重置主议选择和额度。

主议 contribution 继续记录投入（采纳18、匹配执行10），其他相关行为也可记投入。季度完成度仍由真实指标及附加条件计算；投入达到100不代表御题成功。回执与月报依据实际核心净变化，不把主议文本单独当成资源兑现。

## 三类外交承诺的真实履约

三类合同均存责任方 `responsible`、受益方 `beneficiary`、起止月、完成条件和 receipts。预复核显示对象、数量或条件、目标、期限与代价。准备度与信任仍影响可执行性，但不能直接把进度条变成事实。

### 贡赋 tribute

- 默认约定数量6；支持识别的数字数量限制在1–30。受益方为汉廷，支付来源为责任方治所 `payerCityId` 的粮秣；默认期限为创建月+3。
- 每个处理月最多转运3。需责任方仍控制治所、信任至少30、准备度至少20，并受剩余约定量、来源粮秣和国库100上限约束。
- 国库实际增加多少，治所就减少多少；receipts记录 resource、amount、before、after、sourceCityId、sourceSupplySpent 等。国库99时只收1，不能扣地方3。
- 足额实收才 fulfilled；到期部分收到为 partial，零到账为 expired。超过期限不追补往月款项；读取与完整恢复保留每月到账凭据。

### 援军 military_aid

- 默认目标许都，默认期限创建月+3；本轮实现的完成条件为“承接约定支援/守备任务并按期抵达目标”，没有声称所有自然语言参战条件均已实现。
- 绑定实际 `armyId`、`orderId` 与 `sourcePromiseId`。可以绑定已有符合条件的当次诏令任务，避免再发一条军令或重复增加疲劳。
- accepted 回执仅代表接受，不能完成承诺。fulfilled要求军令状态arrived及记录的到达月处于创建月到截止月之间，并保留arrival来源回执。
- 军团覆灭、人数不足、任务撤换/失败形成可追踪失败；未按期承接或抵达为expired。路线/粮秣阻断仍停留在途中并展示原因，99%进度也不能替代到达。
- `promiseAttempts` 保存当前接受条件签名，完全相同的被拒状态重复提交不再反复生成日志。

### 停战 ceasefire

- 默认期限创建月+2，双方为明确识别的诸侯；只有一方时另一方为汉廷。建立合同时保存已有军令/战报ID集合，避免将此前战争追认成新违约。
- 观察区间内双方实际交战，或一方向另一方发出attack军令，即broken。军令保存签发当时的targetOwner，避免后来城池易主改变证据含义。
- 回执明确标记battle或hostile-order，source指向实际记录ID。完整观察期结束且无违约才fulfilled，并记录观察完成凭据。

已有盟约、互市、质子及官爵承诺仍采用原信任/准备度/路线条件推进，影响关系和地方忠诚；即时授官可在诏书颁下时完成。界面明确其不代表钱粮、军团或质子的实际交付，不将这些类型算作本轮三类真实履约。

旧三类承诺没有contract时：已结束记录保留，标注 `legacy-unverified-no-retroactive-reward`，不追发钱粮或编造军令。仍活动的记录建立 `legacy-active-no-historical-credit` 合同，实际进度从0开始，保存观察起点，不把旧进度当作历史到账/到达证据。

## 保存、恢复、旧成绩与本局身份

普通新局、短局、同题和重试须先完成替换备份。仅新局成功提交触发本局月报清理和新基线；取消或备份失败保留核心、快照、月报、活动挑战及其他本局存储。完整导入先校验和备份，写外围存储后最后安装核心，再重新载入模块；失败路径尝试恢复写入前原值。

完整包 `xian-emperor-full-save` 包含核心和 PORTABLE_STORAGE_KEYS 下的系统状态。同月读取不会覆盖有效月初快照。缺少原始快照、只能月中建立时保存partial和采集阶段；不能把载入后的变化称为完整全月净变。

模块初始化可能先读取磁盘核心，此时玩家尚未点击“继续游戏”，核心 API 的实时状态仍为空。战役阶段不会提前登记完成并吞掉奖励；长卷也不会提前清除 `pendingScenarioId` 或写入 `chapterGameIds`。待对应剧本的未结束实时核心安装后，仍待处理的继承通过 `saga-legacy:<createdAt>` 效果回执兑现一次，再清除待办并提交；重复保存、读取与重新初始化不会重复继承，已有随机状态不变。这里恢复的是仍有待办标记的记录，不推测或重建旧档中已经丢失的继承历史。

旧核心JSON先由 `planLegacyImport` 制成迁移包，再走同一个完整恢复安装器：

- 缺失的本局世界、军团、战役、季度、主议和月报等状态重建；第三月回导第一月不能继续保留未来月份的外围进度。重载会替换旧内存实例。
- 保留约定的跨局收藏、历史成绩、音频/界面偏好。御前方略保留profile、重置session；核心导入不增加profile.totalRuns。
- 史官currentDecisions清空。与被回退核心同createdAt的已完成短局/史官/终评记录保留但标注archivedByCoreImport，不再当作该进行中分支的当前终局。
- 缺少战役历史时，已有明确stage回执的完成身份保留而不再奖励；只因当前数值已达标的历史基线写入skippedStages，不计完成、不补奖。迁移不为不存在的历史成果补记录。
- 已存random的seed、state、draws、algorithm沿用；迁移与只读预览不额外抽样。不能用当前时间重新替换已有种子。

历史成绩继续保留自己的rulesVersion。新成绩取核心规则身份224；旧进行中同题读取会记录ruleMigration，保留其进度及原开局comparisonIdentity。直接同题比较要求同题码、种子、算法、规则、剧本/时长/难度/事件序列/目标、已记录开局国势及关系完全一致；结果规则与开局身份规则也必须一致。旧开局身份216与迁移后结果224不满足条件，因此保留历史但不进入直接同题比较。这里没有将旧分数重算为新规则分数。

## 可运行的验证入口与范围

以下为相应证据的定位，不将文件存在等同于最终全量通过。最终提交应另附具体执行日志、退出码和浏览器结果。

| 回归入口 | 覆盖的实际边界 |
|---|---|
| `node tests/commit-lifecycle-regression.js` | 0/50/500ms月内短暂达标、重复回执、同月基线、替换备份失败。 |
| `node tests/commit-convergence-regression.js` | 帝业奖励触发战役阶段时在同次操作内收敛；保存不再追加延迟奖励；初始化到继续游戏之间保留待发阶段奖励。 |
| `node tests/dynasty-restore-regression.js` | 长卷待继承标记在实时核心安装前保留；继续后兑现一次，保存/读取及重新初始化不重复、随机状态不变。 |
| `node tests/replacement-failure-matrix-regression.js` | 普通、短局、同题、两类终局重试、核心/完整导入的备份失败保护。 |
| `node tests/legacy-core-isolation-regression.js` | 相同/不同身份回导、缺失阶段史、有效奖励凭据、同身份旧档归档、累计开局不增加。 |
| `node tests/court-rule-consistency-regression.js` | 奏请生成/裁决去重、主动费用边界、汉军与纯诸侯参战区别。 |
| `node tests/court-persistence-boundaries-regression.js` | 长期战报回执、参战证据迁移、地方回响付费与延迟后报。 |
| `node tests/military-consistency-regression.js` | 无野战驻军围城、目标变化、统一占领、战后付费0/成本−1/恰好足额。 |
| `node tests/deadline-consistency-regression.js` | 4/5/6月短局、普通末两月、恰好三月、旧越界御题归档与重复终局。 |
| `node tests/decision-depth-regression.js` | 主议预览及真实收益、非匹配、两次上限、重复键、关系上限、完整导入、消费去重、下一季重置、推荐/比较共用规则。 |
| `node tests/action-plans-regression.js` | 84个真实常用行动选项的预览与执行净值。 |
| `node tests/progression-action-consistency-regression.js` | 人物篇章费用、重复选择、方略冷却最终提交、真实短局期限、终局禁止新选帝业。 |
| `node tests/contract-parsing-regression.js` | 贡赋/援军/停战解析及预复核一致性。 |
| `node tests/diplomatic-contracts-regression.js` | 实收/部分/超期、援军到达/阻断/覆灭、停战违约、旧承诺无证据迁移。 |
| `node tests/diplomatic-live-regression.js` | 真实圣旨至到账、国库上限、月末中断、重复读取、完整恢复、军令违约及回执界面文本。 |
| `node tests/diplomatic-replay-regression.js` | 五类履约轨迹×0/50/500ms/固定变化间隔/完整恢复，共25条真实处理器轨迹比较全部存储；只归一化时钟/身份类非玩法字段。 |

平衡与普通剧本原始轨迹、公式及限制另见 [BALANCE_V224.md](BALANCE_V224.md)。真实index.html加载顺序、390×844与1366×768、不同字号、导入导出和替换失败的浏览器验收以浏览器专门脚本和最终报告为准；本文不声称这些界面检查或远程CI已经通过。
