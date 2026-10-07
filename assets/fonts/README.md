# v2.22.0 本地字体包

游戏运行时使用五个经过字符裁剪的 WOFF2 文件，全部随仓库发布，不调用 Google Fonts 或其他在线字体服务。

| 文件 | 原字体 | 用途 | 许可证 |
| --- | --- | --- | --- |
| `zcool-xiaowei-game.woff2` | ZCOOL XiaoWei / 站酷小薇体 | 开场、章节与终局题名 | SIL OFL 1.1 |
| `noto-serif-sc-game.woff2` | Noto Serif SC / 思源系宋体 | 原宋体样式与回退 | SIL OFL 1.1 |
| `noto-sans-sc-game.woff2` | Noto Sans SC / 思源系黑体 | 清晰主题、拉丁数字与回退 | SIL OFL 1.1 |
| `wenkai-game-regular.woff2` | LXGW WenKai Regular / 霞鹜文楷 | 古风奏报、诏令与界面 | SIL OFL 1.1 |
| `wenkai-game-medium.woff2` | LXGW WenKai Medium / 霞鹜文楷 | 古风强调文字与按钮 | SIL OFL 1.1 |

完整许可证保存在 `licenses/`。裁剪后的字体仍按原字体的 OFL 许可证分发。

霞鹜文楷是现代开源楷体，并非钟繇等历史书家原作。其许可允许仅供网页加载的子集 / WOFF2 保留原名称；本仓库只分发游戏使用的 WOFF2，不提供修改后的桌面安装字体。

## 重新生成

从 Google Fonts 官方仓库下载：

- `ofl/zcoolxiaowei/ZCOOLXiaoWei-Regular.ttf`
- `ofl/notoserifsc/NotoSerifSC[wght].ttf`
- `ofl/notosanssc/NotoSansSC[wght].ttf`

本次来源固定为 [google/fonts@5e8a3ba](https://github.com/google/fonts/tree/5e8a3ba899557829a76cfdac30fa512bda91d7ca)。

从 [lxgw/LxgwWenKai@a22e2a0](https://github.com/lxgw/LxgwWenKai/tree/a22e2a064f471fffd194af2a69072944bbe218dc) 下载：

- `fonts/TTF/LXGWWenKai-Regular.ttf`，Git blob `3e050e87caa5ce47f9c873079183e31f88fb8ce5`
- `fonts/TTF/LXGWWenKai-Medium.ttf`，Git blob `bc6e9fe500ef11c5f89089786b517b0a049437d6`
- `OFL.txt`，原文保存为 `licenses/LXGW-WenKai-OFL.txt`

安装 `fonttools` 和 `brotli` 后运行：

```powershell
python scripts/build-font-subsets.py `
  --display ZCOOLXiaoWei-Regular.ttf `
  --serif NotoSerifSC-VF.ttf `
  --sans NotoSansSC-VF.ttf `
  --kai LXGWWenKai-Regular.ttf `
  --kai-medium LXGWWenKai-Medium.ttf
```

各个参数可单独使用，但至少提供一份来源字体。脚本会从 `index.html`、`styles.css` 和 `src/` 的运行时代码中提取字符。玩家自行输入的罕见字符若未包含在字体子集中，将按照 CSS 字体栈回退到设备字体。

新增运行时汉字后应重新构建，并更新字体 URL 的缓存版本。古风长文与系统文字使用文楷，题名保持小薇；清晰模式改用黑体。数字不使用文楷，以免概率与资源数值难读。

