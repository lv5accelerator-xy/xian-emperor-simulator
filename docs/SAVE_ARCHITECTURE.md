# 存档与存储架构评估

基线：v2.30.0，核心schemaVersion=103、rulesVersion=230；盘点后、存储代码修改前形成此评估。键名、白名单、核心结构、迁移判断和结算次序均保持。

## 所有存储键

下表共31键。函数位置按文件及函数名定位，避免后续插入提示代码使行号过期；部分ensure/read函数承担默认值归一化，并非跨版本迁移。实测版本来自68份测试完整包，不代表每个模块都有统一schema。

| 键 | 结构 | 版本/体积依据 | 读取、归一化或迁移位置 |
| --- | --- | --- | --- |
| xian_emperor_armies_v050 | 军团、将领、任务、战报和调遣记录 | version=1.5.1；schema=未带；UTF-16样本最大599092字节 | src/army-system.js loadState / migrateState |
| xian_emperor_audio_v022 | 旧版音频偏好，仅兼容读取 | 未采样；源码结构估算见现状盘点 | src/audio.js loadSettings；不在完整导出白名单 |
| xian_emperor_audio_v023 | JSON对象：音量、静音、场景音乐偏好 | 未采样；源码结构估算见现状盘点 | src/audio.js loadSettings（含旧键回退） |
| xian_emperor_campaign_evolution_v150 | 战役阶段、目标、战果历史 | version=1.5.1；schema=未带；UTF-16样本最大6684字节 | src/campaign-evolution.js migrateState |
| xian_emperor_character_memory_v170 | version=1；人物记忆/交往记录 | version=1；schema=未带；UTF-16样本最大10418字节 | src/character-memory.js loadState / blankState或defaultState |
| xian_emperor_command_center_v160 | 总览设置、指引完成状态 | 未采样；源码结构估算见现状盘点 | src/command-center.js loadStore / saveStore |
| xian_emperor_consequence_echoes_v220 | version=1；旧事回响与回执 | version=1；schema=未带；UTF-16样本最大16766字节 | src/consequence-echoes.js loadStore / defaultStore |
| xian_emperor_council_advice_v2110 | 建议周期、历史与回执 | 未采样；源码结构估算见现状盘点 | src/council-advice.js loadState / blankState或defaultState |
| xian_emperor_court_politics_v060 | 朝议、派系、参与者、历史；schemaVersion=2 | version=0.6.0；schema=2；UTF-16样本最大14414字节 | src/court-politics.js loadState / migrateState；causal-court.js migrateParticipation |
| xian_emperor_decree_world_v030 | 圣旨扩展对象、执行记录 | version=0.3.0；schema=未带；UTF-16样本最大2698字节 | src/decree-world.js loadExtensionState / createInitialExtensionState |
| xian_emperor_dynasty_saga_v200 | 长卷收藏、章节、累计状态 | 未采样；源码结构估算见现状盘点 | src/dynasty-saga.js loadProfile / defaultProfile |
| xian_emperor_final_verdict_v250 | version=1；verdicts终评集合 | version=1；schema=未带；UTF-16样本最大10874字节 | src/final-verdict.js loadStore / defaultStore |
| xian_emperor_historian_v190 | version=2；runs与currentDecisions | version=2；schema=未带；UTF-16样本最大8316字节 | src/historian.js loadState / blankState或defaultState |
| xian_emperor_imperial_paths_v2130 | version=1；路线选择和进度 | version=1；schema=未带；UTF-16样本最大294字节 | src/imperial-paths.js loadState / blankState或defaultState |
| xian_emperor_map_guide_v261 | 纯字符串seen | 未采样；源码结构估算见现状盘点 | src/grand-map.js finishGuide；无迁移、不导出 |
| xian_emperor_month_snapshot_v011 | 月初核心快照对象 | version=未带；schema=未带；UTF-16样本最大752字节 | src/monthly-report.js readMonthSnapshot / writeMonthSnapshot |
| xian_emperor_monthly_flow_v210 | version=1；月度提示/流程偏好 | version=1；schema=未带；UTF-16样本最大282字节 | src/monthly-flow.js loadStore / defaultStore |
| xian_emperor_monthly_reports_v011 | 对象：gameCreatedAt及reports月报数组，含时间、事件、变化和军略摘要 | version=未带；schema=未带；UTF-16样本最大74258字节 | src/monthly-report.js readReportStore / writeReportStore |
| xian_emperor_progression_v100 | version=1；profile收藏与session本局进度 | version=1；schema=未带；UTF-16样本最大938字节 | src/imperial-progress.js loadProgress / defaultProgress |
| xian_emperor_quarterly_agenda_v2100 | version=1；季度目标与历史 | version=1；schema=未带；UTF-16样本最大510字节 | src/quarterly-agenda.js loadState / blankState或defaultState |
| xian_emperor_regional_echoes_v2120 | version=2；地区回响与记录 | version=2；schema=未带；UTF-16样本最大15852字节 | src/regional-echoes.js loadState / blankState或defaultState |
| xian_emperor_save_backups_v2180 | version=1；months最近3份全包、replacement替换前1份 | 未采样；源码结构估算见现状盘点 | src/save-backups.js readStore / writeStore；索引不导出，避免递归 |
| xian_emperor_scenario_records_v070 | 按剧本记录的最佳/累计结果集合 | version=未带；schema=未带；UTF-16样本最大248字节 | src/game.js loadScenarioRecords / recordScenarioResult |
| xian_emperor_short_challenges_v230 | active挑战定义、reviewLog、results成绩 | 未采样；源码结构估算见现状盘点 | src/short-challenges.js loadStore / defaultStore |
| xian_emperor_simulator_v01 | 核心对象：剧本、月份、stats/hidden/relations、chronicle、random、操作回执 | version=2.30.0；schema=103；UTF-16样本最大85578字节 | src/game.js migrateSave / planLegacyImport / restoreFullSave |
| xian_emperor_strategy_network_v040 | 城池、路线、诸侯、盟约、外交关系、军令/战果历史 | version=1.5.1；schema=未带；UTF-16样本最大770536字节 | src/strategy-network.js loadState / migrateState / migrateLegacyOrderedRoutes；alliance-diplomacy.js migrate；diplomatic-relations.js normalize |
| xian_emperor_weekly_challenge_v240 | 每周挑战定义、参与/成绩记录 | 未采样；源码结构估算见现状盘点 | src/weekly-challenge.js loadStore / defaultStore |
| xian_emperor_world_marks_v180 | version=1；天下纪事、标记、历史 | version=1；schema=未带；UTF-16样本最大5090字节 | src/world-marks.js loadState / blankState或defaultState |
| xian_emperor_world_v020 | 天下势力、地区、上次结算月份、历史 | version=0.2.0；schema=未带；UTF-16样本最大47350字节 | src/world-system.js migrateWorldState |
| xian_font_mode_v1 | 纯字符串：字体模式枚举 | 未采样；源码结构估算见现状盘点 | src/typography.js 初始化读取 / normalize；不导出 |
| xian_reading_size_v1 | 纯字符串：字号枚举 | 未采样；源码结构估算见现状盘点 | src/reading-settings.js 初始化读取 / normalize；不导出 |

## 完整包与兼容路径

- 原完整包只有format、产品version、exportedAt、stores，stores是26键白名单；核心103与各模块自己的版本并不能标识整个包。
- 本阶段计划给新导出包增加只读、可枚举的saveSchemaVersion=1。JSON本身不表达只读；运行时属性不可写。导入器只在内存诊断中记录其存在和值，不据此拒绝、分支或选择迁移。未知值与缺字段仍沿原路径处理。不会给核心JSON增加此字段。
- 完整包：game.js restoreFullSave → validateSave → migrateSave；先保存替换前完整备份，再写各系统，最后写核心；任一步失败沿原路径回滚，仍保留原有导入锁/监听器协议。
- 旧核心JSON：importSave → planLegacyImport → restoreFullSave。标记core-only/missingHistory；不伪造旧档没有的军团、世界或月初历史。保留旧有收藏/偏好处理。
- 读档：loadGame → migrateSave；系统各自load/ensure/migrate。没有以包级版本分发的集中迁移器，本阶段不引入。
- captureFullSave只读取当前已提交存储；导出按钮先调用saveGame(true)提交。同步commit边界仍负责玩法，不能改成依赖定时器。

## 写入故障评估与改动边界

基线44个setItem/removeItem调用位于28个源文件；部分已有catch但只记录控制台或直接吞掉，核心提交及备份写入等仍可能抛出。计划在每个写入文件的局部storageWrite中捕获、报告、重抛原错误，保留原有外层处理、调用次数/参数/顺序和Storage.prototype监听器。新增最先加载的storage-feedback.js只在故障时显示role=alert提示：

> 存储空间不足或被浏览器禁用,请先导出存档

不新增localStorage键、不写探测数据、不修改随机源；启动只读探测length以提示浏览器完全禁用存储。提示并不承诺失败后已安全落盘。若浏览器完全禁止读写，原导出提交也可能失败，需使用此前下载的完整包恢复；不把弹出提示当作成功保存。

## 容量与最坏情况

68个测试包各键独立最大UTF-16近似体积合计1,670,950字节。当前存档加最近3个月与替换前1份，即约5倍=8,354,750字节（7.97 MiB），尚未计键名、备份索引元数据、未采样的偏好/收藏及序列化开销。该数是跨样本的保守组合估算，不是某一份实际同时达到的包，也不是数学上界。实际浏览器配额/计量方式依实现和来源而异。

因此存在超过4 MB的明确风险。部分导入历史/累计集合没有全局硬上限，无法给出可靠有限最坏值；不可仅凭当前短局包小便承诺容量安全。备份索引不包含自身，故不存在递归膨胀。当前阶段只提示故障，保留现有存储与备份策略。

## IndexedDB候选迁移方案（未实施）

1. 经所有者决定后，在独立分支增加异步存储适配层；以单个事务写core、systems、backupManifest、backupBundles，按gameCreatedAt/turn索引。将完整备份对象分离，避免每月重写整串备份索引。
2. 首次迁移只读31个旧键，将原始JSON及校验摘要复制到新库；完成后重新读取逐项比对，失败则继续使用旧库，旧键不删除。备份导出仍为现有完整包。
3. 同步玩法结算仍在内存原commit中完成；事务只持久化该次已冻结的快照。必须定义关闭页面时尚未完成事务的可见状态和恢复边界，不能让异步返回更改规则或随机进度。
4. 遵守同源隔离，分别验证GitHub Pages与file://（各浏览器对本地来源支持可能不同）；无法使用IndexedDB时保留localStorage回退，提供下载导出。不可宣称两个来源自动共享数据。
5. 建立双读验证、旧档/故障注入/事务中断/满额/固定种子对照，再选择切换。保留完整导出与回退开关；待另行批准后才能清除旧键。

## 回归门槛

新增纯Node全包往返、真实历史ZIP构造核心旧档升级、缺字段/未来包头兼容，以及quota/security故障可见性测试。原有save-backups、replacement-failure-matrix、settlement-replay和所有回归继续执行；固定种子结果须与修改前一致。测试结果另见各阶段交付记录。
