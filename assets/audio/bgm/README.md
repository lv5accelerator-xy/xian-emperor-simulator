# 场景音乐资源

## 游戏当前调用

| 场景 | 曲名 | 文件 |
| --- | --- | --- |
| 主菜单 | 汉室余晖 | `han-imperial-afterglow.mp3` |
| 朝堂常态 | 玉阶无声 | `silent-jade-steps.mp3` |
| 危机警报 | 宫门将闭 | `closing-palace-gates.mp3` |
| 军团与战事 | 诏令出京 | `edict-leaves-capital.mp3` |
| 终局 | 山河仍在 | `rivers-and-mountains-remain.mp3` |

运行时清单位于 `src/audio-tracks.js`。播放器按需加载当前场景的一首音乐，不会同时下载整套音乐。

## 备选资源（暂不调用）

以下文件仅作为版本资源保存，不在 `src/audio-tracks.js` 中引用，因此游戏不会下载或播放：

- `alternates/han-imperial-afterglow-alt.mp3`
- `alternates/edict-leaves-capital-alt.mp3`
- `alternates/rivers-and-mountains-remain-alt.mp3`
