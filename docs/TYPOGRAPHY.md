# 字体主题与维护

v2.22.0 提供两种字风，默认古风楷书。开局页与结局页选择“古风楷书 / 清晰阅读”；桌面游戏在“更多”内切换，手机版在主界面状态条上方切换。

| 内容 | 古风楷书 | 清晰阅读 |
| --- | --- | --- |
| 奏报、圣旨、系统文字与按钮 | 霞鹜文楷 Regular / Medium | Noto Sans SC |
| 开场与终局题名 | 站酷小薇 | Noto Sans SC |
| 拉丁数字、百分比及主要资源数值 | Noto Sans SC | Noto Sans SC |

`src/typography.js` 在 head 中恢复 `xian_font_mode_v1`。偏好独立于游戏存档，切换不触发保存、不消耗资源，也不改变评分或随机序列。浏览器拒绝存储时，当前页面仍可切换；刷新后可能回到默认值。其他标签页的偏好变更会同步到当前页面。

古风模式适当增大长文行距与手机字号。字风按钮使用原生 button 和 aria-pressed，支持键盘操作。切换不重建游戏或弹窗，保持玩家当前操作。

v2.23.0 增加独立的标准／大字／特大字号设置，并让月报沿用所选字风。操作与回归见 [阅读字号与月报](READING_COMFORT.md)。

## 来源与历史风格

- 本版使用 [霞鹜文楷](https://github.com/lxgw/LxgwWenKai)，它是基于 Klee One 的现代开源中文字体，并非钟繇小楷或其他历史书家原作。
- 本版并未包含方正钟繇小楷、蔡邕或张芝署名字库。取得覆盖公开网页游戏嵌入及字体分发的对应授权后，才可接入商业字库。
- 当前可分发字体与完整许可见 [本地字体说明](../assets/fonts/README.md)。

## 维护与验证

运行时汉字变化后，从官方来源重新生成五份 WOFF2 子集，并更新字体 URL、样式 URL 的缓存版本。`src/typography.css` 的 unicode-range 将拉丁数字交给后续清晰字体；勿把数字字体变量改成书法字体。

```sh
node tests/typography-regression.js
EXPECTED_VERSION=2.23.0 node tests/release-regression.js
```

浏览器核对：切换两种字风并刷新；继续原有存档，确认日期与行动点未变；手机窄屏核对奏报、拟旨、弹窗和结局，不应出现横向溢出。`tests/narrow-screen.html` 只检查 390 像素网页排版，不代表真实 iPhone Safari 验证。
