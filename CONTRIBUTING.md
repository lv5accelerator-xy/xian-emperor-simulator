# 参与维护

游戏使用原生HTML/CSS/JS，双击index.html即可运行。可以使用静态服务器调试；不要引入框架、打包器或npm构建链作为游玩前提。

维护测试需要Node.js 24：

~~~text
node scripts/check.cjs
node scripts/check-doc-links.cjs
~~~

统一检查自动发现全部语法与tests/*-regression.js。新增回归使用Node内置模块和最小桩，不给运行时增加测试依赖。用固定种子和完整存档往返验证涉及状态的改动。

每个阶段使用独立分支和提交。提交信息采用“类型: 说明”，例如“修复: 补齐存储失败提示”“文档: 更新外交规则说明”。说明变更、验证结果、已知限制。

规则、数值、随机或存档变更必须同步CHANGELOG与对应patch-notes，明确兼容边界；不把产品版本、规则版本、存档schema及模块键名混为一谈。先保留失败用例，再实现修复。

发布号以src/data.js的GAME_DATA.version为准，维护工具自动读取。更新发布元数据时先运行scripts/bump-version.cjs的--dry-run，再检查差异；历史文档、存储键和规则版本不会自动升级。

新增素材须登记CREDITS.md并附可核验的许可；项目LICENSE尚待所有者决定。不要自行认定“原创”或公开可见即代表再分发授权。

history/目前保留。历史包迁移、许可证选择、IndexedDB和模块化等决策由所有者确认；不要将这些建议当作已经授权的删除、历史重写或上线动作。
