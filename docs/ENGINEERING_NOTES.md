# 工程笔记

v2.30.3 起的工程约定。每条都有对应的回归测试或 CI 任务把关；违反时会在统一检查或 PR 检查里失败。

## 页面输出

- 存档、导入文件和各系统存储里的字段都可能被改写，拼进 HTML 前一律转义，包括 `class`、`data-*`、`value`、`title` 等属性。各模块自带 `escapeHtml` / `escape` / `esc`。
- 只有数值、循环下标和逐条登记的静态值可以不转义；拼给 `querySelector` 的选择器不是 HTML，不要转义。
- 把关：`tests/class-injection-regression.js`（静态扫描加一次恶意存档读档）。
- `validateSave` 只拒收必然无法运行的形状，例如奏报或史书条目为 null；字段缺失交给 `migrateSave` 补齐，不要因此拒收旧档。把关：`tests/save-validation-regression.js`。

## 状态读取

- `getState()` 返回深拷贝，调用方可以随意修改。
- `peekState()`（核心、军团、策略网络）返回**冻结**的共享快照，状态不变时复用同一对象。只读的地方用它，避免一个月末深拷贝上百次。
- 冻结快照被写入会直接抛 `TypeError`。读-改-写的地方必须用 `getState()` 或自行解析存储；军团模块里对应的是 `loadStrategyState()`，而 `readStrategyState()` 是只读缓存。
- 把关：`tests/readonly-snapshot-regression.js`。

## 月末结算

- 结算步骤写在 `settlementSteps()` 生成器里，每个 `yield` 是一个安全点：上一阶段已经提交，产出值是下一阶段的名称。
- 公开的 `endTurn()` 一次同步跑完，测试与脚本用它。
- 界面入口 `runSettlementInFrames()` 先显示“月末结算中”，再按时间预算推进：连续运行超过 250ms 才让出一帧。结算期间拦截键盘与重入；页面隐藏或关闭时同步跑完剩余阶段。
- 新增结算阶段时放在两个 `yield` 之间，不要在阶段中途让出。
- 浏览器脚本在点击“确认结束本月”后，要等 `#settlement-progress` 消失再读取结果。
- 把关：`tests/settlement-frames-regression.js`。

## 玩法等价

- 性能、整理、缓存类改动不应改变任何玩法结果。PR 的 `equivalence` 任务会对照基线跑 15 条固定种子完整对局，比较终局时的全部存储。
- 本地运行 `node scripts/playthrough-equivalence.cjs <基线提交>`；它会忽略时间戳、时钟生成的编号与存档里的产品版本号。
- 确实要改规则、数值或随机序列的 PR，加 `changes-gameplay` 标签跳过该任务，并在说明里写明改变了什么。

## 字体子集

- 五个字体文件只包含游戏运行文件里实际出现的字符。新文案用到子集外的字时，浏览器会逐字回退到系统字体。
- 出现缺字时用 `scripts/build-font-subsets.py` 重建（来源与用法见[字体说明](../assets/fonts/README.md)），再更新样式表与 `index.html` 里字体地址的缓存参数，并同步 [CREDITS.md](../CREDITS.md) 中的 SHA-256。
- 把关：`tests/font-coverage-regression.js`。

## 缓存参数

- 页面资源带 `?v=` 缓存参数。改了某个文件，就把它在 `index.html` 里的参数改成当前发布号；字体地址的参数写在样式表里。
- `tests/release-regression.js` 与 CI 的资源检查对部分参数有固定断言，改参数时一并同步。

## 动效与无障碍

- 不要写死 `behavior: "smooth"`；用 `window.XianMotion?.scrollBehavior() || "smooth"`，系统开启“减少动态效果”时自动改为直接定位。把关：`tests/reduced-motion-regression.js`。
- 全局的 `button:hover` 会把 `transform` 改写成上移 1px。靠 `transform` 定位的元素（如舆图上的城池与军团标记）要用不低于它的优先级保住自己的 `transform`。把关：`tests/map-hover-regression.js`。

## 浏览器回归

- 共用的“真实点击”在 `scripts/browser-tap.cjs`：等元素位置稳定，把指针移过去确认悬停在目标上，再在同一坐标按下。被遮挡、移出视口或仍在移动的控件会像真人操作一样点不中。
- 新脚本直接 `require("./browser-tap.cjs")`，不要再内嵌一份。
- CI 用 Playwright 自带 Chromium；本地设 `BROWSER_CHANNEL=chromium COUNCIL_BROWSER_CHANNEL=chromium` 即可同样运行。
- `browser-diplomatic-relations.cjs` 需要外部提供的旧版完整存档，不在 CI 中。
