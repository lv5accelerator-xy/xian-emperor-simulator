# AI 接入方案（后续版本）

## 核心原则

大语言模型只负责：

1. 理解玩家输入
2. 输出结构化意图
3. 根据已经结算的结果生成叙事、奏折和人物对话

大语言模型不负责：

- 直接修改国库或人物属性
- 决定随机概率
- 写入存档
- 绕过规则引擎
- 在客户端保存API密钥

## 推荐流程

```text
玩家输入圣旨
    ↓
安全后端接收文本
    ↓
AI输出严格JSON
    ↓
服务器或前端规则引擎验证
    ↓
JavaScript计算数值变化
    ↓
更新存档
    ↓
AI根据结算结果生成奏折与人物回复
```

## 圣旨解析 JSON 示例

```json
{
  "actions": [
    {
      "type": "tax_reduction",
      "regions": ["颍川"],
      "duration_months": 6,
      "rate": 0.5
    },
    {
      "type": "disaster_relief",
      "regions": ["颍川"],
      "resource": "grain",
      "amount": 3000
    },
    {
      "type": "investigation",
      "target": "relief_corruption",
      "executor": "censorate"
    }
  ],
  "mentioned_characters": [],
  "is_secret": false,
  "risk_notes": ["国库支出较高", "可能触及地方豪强"]
}
```

## 后端安全

GitHub Pages中的JavaScript对所有玩家公开。绝对不要这样写：

```javascript
const apiKey = "sk-xxxxxxxx";
```

应使用：

- Cloudflare Workers
- Vercel Functions
- Supabase Edge Functions
- 自建Node.js服务器

将API密钥放入服务端环境变量，并限制：

- 单个IP调用频率
- 单局调用次数
- 单次输入长度
- 每日总费用
- 可用模型与最大输出长度

## 建议接口

```text
POST /api/parse-edict
POST /api/generate-dialogue
POST /api/generate-chronicle
```

前端只向你自己的后端发送请求，后端再调用模型供应商。

## 降低成本

- 圣旨解析使用小型模型
- 人物对话只在玩家主动召见时调用
- 普通事件继续使用预写文本
- 相同上下文做缓存
- 每次只传递必要状态，不发送整个存档
- 结局史书仅在终局调用一次

## 防止模型胡写

- 使用JSON Schema约束输出
- 只允许白名单行动类型
- 所有数值由代码重新计算
- 人物提示词中只提供当前可知信息
- 对历史事实与游戏架空内容做明确标记
- 失败时自动退回本地规则解析器

