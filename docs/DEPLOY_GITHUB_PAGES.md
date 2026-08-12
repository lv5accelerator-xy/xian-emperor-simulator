# 部署到 GitHub Pages

## 1. 解压项目

解压后进入：

```text
xian-emperor-simulator-v2.0.0
```

确认里面直接有：

```text
index.html
styles.css
src
```

## 2. 上传正确内容

进入 GitHub 仓库：

```text
Add file → Upload files
```

打开本项目文件夹，按 `Ctrl + A` 选中里面的全部文件与文件夹，再拖进上传页面。

不要只拖最外层文件夹，否则会多套一层目录。

正确仓库结构：

```text
仓库根目录/
├─ index.html
├─ styles.css
├─ src/
│  ├─ data.js
│  ├─ game.js
│  ├─ imperial-progress-data.js
│  ├─ imperial-progress.js
│  └─ imperial-progress.css
├─ patch-notes/
└─ .nojekyll
```

## 3. 开启 Pages

```text
Settings → Pages
```

选择：

```text
Source: Deploy from a branch
Branch: main
Folder: /(root)
```

点击 `Save`。

## 4. 等待部署

进入：

```text
Actions
```

看到 `pages build and deployment` 变成绿色对勾后，网站即可访问。

## 5. 更新游戏

修改本地文件后推送到 `main`，GitHub Pages会自动重新部署。每次正式更新应同步修改：

- `src/data.js` 内的版本号
- `index.html` 的标题、页脚和资源查询参数（例如 `?v=1.0.0`）
- `CHANGELOG.md` 与对应的 `patch-notes/v版本号.txt`
- `.github/workflows/release-check.yml` 的预期版本号

资源查询参数用于让浏览器及时获取新文件；若玩家仍看到旧页面，可先强制刷新一次。

## 6. 常见问题

### 打开是404

检查 `index.html` 是否位于仓库根目录，而不是某个子文件夹内。

### 页面有样式但按钮不工作

检查：

```text
src/data.js
src/game.js
```

是否都上传成功，并保持原目录结构。

### 朋友没有你的存档

这是正常的。每个玩家的存档保存在自己的浏览器中，互相独立。

玩家可以用顶部“导出”生成完整 JSON 存档包，再在另一台设备使用“导入”。v1.0.0 以来的完整存档会连同军团、政议、御前方略和收藏一起迁移。

