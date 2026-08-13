# v2.7.1 本地字体包

游戏运行时使用三个经过字符裁剪的 WOFF2 字体，全部随仓库发布，不调用 Google Fonts 或其他在线字体服务。

| 文件 | 原字体 | 用途 | 许可证 |
| --- | --- | --- | --- |
| `zcool-xiaowei-game.woff2` | ZCOOL XiaoWei / 站酷小薇体 | 开场、章节与终局题名 | SIL OFL 1.1 |
| `noto-serif-sc-game.woff2` | Noto Serif SC / 思源系宋体 | 奏报、诏令、史书与叙事正文 | SIL OFL 1.1 |
| `noto-sans-sc-game.woff2` | Noto Sans SC / 思源系黑体 | 操作按钮、数值、地图与系统界面 | SIL OFL 1.1 |

完整许可证保存在 `licenses/`。裁剪后的字体仍按原字体的 OFL 许可证分发。

## 重新生成

从 Google Fonts 官方仓库下载：

- `ofl/zcoolxiaowei/ZCOOLXiaoWei-Regular.ttf`
- `ofl/notoserifsc/NotoSerifSC[wght].ttf`
- `ofl/notosanssc/NotoSansSC[wght].ttf`

安装 `fonttools` 和 `brotli` 后运行：

```powershell
python scripts/build-font-subsets.py `
  --display ZCOOLXiaoWei-Regular.ttf `
  --serif NotoSerifSC-VF.ttf `
  --sans NotoSansSC-VF.ttf
```

脚本会从 `index.html`、`styles.css` 和 `src/` 的运行时代码中提取字符。玩家自行输入的罕见字符若未包含在字体子集中，将按照 CSS 字体栈回退到设备字体。
