# v2.30 交接

入口：军议与盟约面板的「战后议和／遣使修好」。规则见RULES_V230.md，对照见BALANCE_V230.md，验证见VALIDATION_V230.md。

新增src/diplomatic-relations.js保存双边长期记忆，战略系统负责交涉与展示，军团系统按付费顺序落实停军和后续军令，诸侯意图读取关系偏好，外交终局与千秋定论冻结依据。沿用现有正式盟约与军事事实，不以界面文字或策略名称替代履约。

主要回归：diplomatic-relations-regression.js与diplomatic-relations-persistence-regression.js。统一入口node scripts/check.cjs。原有军议、联军与外交终局回归继续保留。固定种子采样与存档审计脚本随本轮提交，原始日志与全存档放交付包。

发布沿用main分支GitHub Pages。仅在精确PR提交检查通过后合并，分别核验合并提交检查、Pages运行及线上资源与交互。部署事实以交付报告为准。
