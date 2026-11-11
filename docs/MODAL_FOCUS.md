# 通用弹窗焦点修复

v2.30.2修复A11Y-01/02。范围为game.js的通用弹窗与openUtilityModal/closeUtilityModal；独立舆图、军团、月报等窗口继续使用其原有控制器。

## 行为

- 弹窗打开后保持原有“确定”初始焦点；Tab和Shift+Tab在当前可用控件之间循环。隐藏、原生禁用、负tabindex控件跳过，同名radio组遵守已选项的Tab停靠。
- 控件动态变化时重新查询；没有可用控件时聚焦dialog本身。原生焦点滚动确保长内容中的目标可见。
- 背景使用inert暂时隔离，另有focusin守卫；关闭时只撤回本控制器添加的inert。既有inert和全局live提示保留。
- Escape、取消、确认及点击遮罩都走原关闭函数，结束本次控制器监听，再在确认逻辑完成重绘或切换页面后恢复焦点。
- 入口仍可用时回到入口；工具菜单收起后回到可见“更多”；行动入口被替换时按稳定的data-action-id找回。入口禁用时优先返回其所属区域，切换开局/终局后使用该页面可操作的入口。
- 连续通用弹窗继承外层入口，取消过期焦点任务；接续月报等独立modal出现时，通用弹窗不会抢回焦点。

代码分工：src/modal-focus.js只持有DOM引用、监听和界面任务，通过window.XianModalFocus的activate/deactivate接入；game.js仅接入打开/关闭生命周期，index.html保持经典script加载，不改变双击运行方式。控制器不读取游戏数据、存储、Date时间值或随机源，零延迟任务仅用于焦点交接，不参与行动、资源和结算。

## 验证

```text
node tests/modal-focus-regression.js
node scripts/check.cjs
node scripts/check-doc-links.cjs
```

使用现有Playwright和Chrome安装可复跑原生浏览器检查（测试依赖，不是游玩前提）：

```text
node scripts/browser-modal-focus.cjs
```

PLAYWRIGHT_MODULE可指向现有Playwright模块；MODAL_BROWSER_URL可改为HTTP或公开网址，默认file://直接打开；MODAL_BROWSER_OUTPUT指定证据目录。脚本使用隔离上下文，共44项检查，不访问玩家已有浏览器存档。

纯Node焦点回归包含16组行为及真实核心生命周期接入；浏览器另用原生指针、Tab/Shift+Tab/Escape检查1366和390宽度，覆盖取消/确认/遮罩、长内容、单控件/无控件、入口替换、开局切换和月报接续。测试中的额外UI夹具仅存在于隔离浏览器上下文，不进入产品或存档。

本轮以v2.30.1冻结副本作基线，执行五剧本、三种子、四策略的60组配对和维护前后完整存档安装/重载/重复提交对照。产品版本字段与开局身份时间单独归一，规则、数值、随机状态、有序行动和实际支出逐项比较。最终数量和远端发布身份在本轮交付报告记录。

参考[W3C模态对话框模式](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/)的焦点循环及关闭返回说明。这一修复不代表完成全站读屏、缩放、对比度或其他窗口的无障碍认证；原审计中的A11Y-03/04继续保留。
