# 山河舆图数据说明

## 数据来源

v2.6.0 的海岸线与岛屿轮廓由 [Natural Earth](https://www.naturalearthdata.com/) 1:110m 数据简化、裁切和等距经纬投影而来。Natural Earth 地图数据属于公有领域。

游戏运行时不会请求在线地图、定位服务、瓦片服务器或第三方脚本。所需矢量路径已经写入 `src/historical-geography-data.js`，可随静态网页完全离线运行。

## 坐标与历史边界

- 16 座战略城池使用古城对应地点的近似经纬度，由同一投影函数换算为 SVG 坐标。
- 黄河、长江、汉水、淮水与主要山脉只保留影响战略判断的骨干线位。
- 汉末州郡和势力范围没有使用现代省界；它们是为游戏读图设计的历史近似。
- 地图不用于导航、行政界定或学术测绘。

## 维护方法

- 城池经纬度：修改 `cityCoordinates`。
- 州郡策略多边形：修改 `regionCoordinates`。
- 山川骨干线：修改 `rivers` 与 `ranges`。
- 所有坐标统一由 `project()` 转为 1200 × 720 的 SVG 画布坐标。
- 修改后必须运行 `node tests/grand-map-regression.js`，并在 390 × 844 与桌面视口各测试一次。
