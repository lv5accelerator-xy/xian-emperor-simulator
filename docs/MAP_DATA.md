# 山河舆图数据说明

v2.31.0 起，舆图底图改用实测地形，并可在“地形”与“州界”之间切换；v2.32.0 起州制随剧本年份变化，州界沿山川走向。游戏运行时不请求任何在线地图、瓦片或第三方脚本；底图与矢量数据都随仓库发布，双击 `index.html` 即可离线使用。

## 两种底图

| 底图 | 内容 |
| --- | --- |
| 地形（默认） | 实测地形与山体阴影、汉代水系与湖泽、主要山名与当时的州名；玩法用的 14 个策略区域淡色叠加，“势力”图层下着色，点击区域在信息栏显示其名称 |
| 州界 | 地形退为浅底，当时的州部着色；点击州域可查看所领郡国；策略区域与地带名隐藏 |

选择保存在本机 `localStorage` 的 `xian_map_basemap_v1`，不随存档导出。

## 数据来源

| 内容 | 来源 | 许可 |
| --- | --- | --- |
| 地形底图 `assets/images/map/terrain.webp` | Natural Earth 10m 栅格 `HYP_HR_SR`（分层设色地形）、`GRAY_HR_SR`（灰度山体阴影） | 公有领域 |
| 陆地、河流、湖泊轮廓 | Natural Earth 10m 矢量 `ne_10m_land`、`ne_10m_rivers_lake_centerlines`、`ne_10m_lakes`（5.2.0-pre） | 公有领域 |
| 汉代修订与十三州界 | `scripts/map-data/eastern-han.json`，本仓库整理 | 见 [CREDITS.md](../CREDITS.md) |

Natural Earth 的使用条款见 <https://www.naturalearthdata.com/about/terms-of-use/>。

## 汉代修订

Natural Earth 是今天的地理。以下几处与汉末差别显著，按汉代修订；坐标都是近似，地图不用于学术测绘。

- **黄河**：荥阳以东不用今河道，改为东汉王景治河（69 年）后的河道，经濮阳、东阿、平原一带至千乘入海。
- **淮水**：正阳关以东不用今河道（今经洪泽湖入江），改为汉代独流入海的河道，经盱眙、淮阴、涟水入海。
- **长江口**：镇江以东取汉代喇叭形河口，今崇明、海门、启东一带尚未成陆。
- **补汉代河流**：济水（荥阳至千乘入海）、泗水、汝水。
- **湖泽**：保留太湖（震泽）、巢湖、青海湖（西海），补巨野泽、大陆泽、云梦泽、彭蠡泽、洞庭、滇池、叶榆泽的示意轮廓；不画汉代尚未形成的鄱阳湖、洪泽湖、高邮湖、微山湖。
- **海岸**：后世新淤的陆地还原为海，包括黄河三角洲（1855 年后）、苏北海岸（1128 年黄河夺淮后东移）、长江口冈身以东、渤海西岸贝壳堤以东。

手绘的汉代故道（东汉黄河与淮水下游、长江口、济水、泗水、汝水）在地图上用**虚线**表示，与 Natural Earth 实测的河道区分开。黄河、长江、汉水沿用游戏其他界面的通称，其余河流用汉代名称（渭水、汾水、湘水、汶江、郁水等）。

## 州界

### 随剧本年份变化的州制

舆图按当前游戏年份显示当时的州制，州界模式与地形模式的州名都随之变化：

| 时期 | 适用年份 | 州数 | 变动 |
| --- | --- | --- | --- |
| 东汉十三州 | 至 193 年 | 13 | 顺帝永和五年（140）前后建制，中平、初平年间未变 |
| 兴平元年分置雍州 | 194–212 年 | 14 | 分凉州河西四郡（武威、张掖、酒泉、敦煌及张掖、居延二属国）另置雍州 |
| 建安十八年复九州 | 213 年起 | 9 | 并十四州为九州：幽、并入冀州，司隶与凉州入雍州，交州入荆州；河东、河内属魏国十郡，归冀州 |

五个剧本中，189 年剧本用十三州，195、196、200 年剧本用十四州，220 年剧本用九州。剧本进行中跨过 194 或 213 年时，州制随之切换。

建安十八年并州的具体郡国归属，史料只记“省司隶校尉及凉州，以其郡国为雍州”等大略。河东、河内归冀州是据同年魏国所封十郡推定的；其余司隶郡国按史文归雍州。益州是否改称梁州，史料未明，仍称益州。

### 划界方法

- 以《续汉书·郡国志》所载顺帝永和五年（140）前后的 105 个郡国为准，每个郡国记一个治所的近似今址（日南郡在画布以南，只参与划界）。另有 69 个属县或要地作为辅助点，避免郡治分布不均时把大片地域划错，例如福建属会稽郡（扬州）、上庸房陵属汉中郡（益州）。辅助点随与之最近的同州郡国一起改属。
- 州界用**分水岭算法**划分：以各郡治为种子，在由实测地形推算的地势面上按由低到高“灌水”，不同州的水在山脊相遇，州界因此大致落在分水岭上，如秦岭之于益州与司隶、太行之于并州与冀州。平原上加了等距约束（`WATERSHED_COMPACTNESS`），分界不随微小起伏乱跑。
- 外缘取所有点的凹包外扩 1.25 度，再与陆地相交，所以西部、北部的边缘仍是平滑的弧线。
- 州界是**按郡治与地势推算的近似范围**，不是史籍记载的实际界线。没有描摹任何受版权保护的历史地图。

## 投影

等经纬度投影：`x = (经度 − 88) × 30`，`y = (43⅓ − 纬度) × 30`，画布 1200 × 720，经度 88°–128°、纬度 19⅓°–43⅓°。Natural Earth 1 角分栅格同为等经纬度，裁剪后正好是画布的 2 倍（2400 × 1440），无需重新投影。

## 重新生成

需要 Python 3 与 `numpy`、`pillow`、`scipy`、`scikit-image`、`shapely`、`tifffile`：

```bash
pip install numpy pillow scipy scikit-image shapely tifffile
```

下载 Natural Earth 数据。官网 CDN 不可用时，可从维护者在 GitHub 上的仓库取：

- 栅格：[nvkelso/natural-earth-raster](https://github.com/nvkelso/natural-earth-raster) 的 `10m_rasters/HYP_HR_SR/HYP_HR_SR.tif` 与 `10m_rasters/GRAY_HR_SR/GRAY_HR_SR.tif`（仓库约 6 GB，只需这两个目录）。
- 矢量：[nvkelso/natural-earth-vector](https://github.com/nvkelso/natural-earth-vector) 的 `geojson/` 下三个文件。

```bash
python3 scripts/build-map-terrain.py \
  --hyp HYP_HR_SR.tif --gray GRAY_HR_SR.tif \
  --land ne_10m_land.geojson \
  --rivers ne_10m_rivers_lake_centerlines.geojson \
  --lakes ne_10m_lakes.geojson
```

脚本输出 `assets/images/map/terrain.webp`，并改写 `src/historical-geography-data.js` 中 `GENERATED` 标记之间的数据，标记外的城池坐标、策略区域与地名不受影响。

修改后：

1. 更新 `historical-geography-data.js` 中 `terrainImage` 与 `index.html` 中该文件的缓存参数。
2. 新地名用到字体子集之外的字时，`tests/font-coverage-regression.js` 会失败，按[字体说明](../assets/fonts/README.md)重建字体。
3. 运行 `node tests/grand-map-regression.js`，并在 390 × 844 与桌面视口各看一次两种底图。

## 手工维护的部分

`GENERATED` 标记之外的数据仍是手工维护的游戏化近似：

- 城池经纬度：`cityCoordinates`。
- 14 个策略区域多边形：`regionCoordinates`。它们服务玩法（势力、稳定度），与十三州界无关。
- 地带名与海名：`labels`；32 处郡国治所标注：`minorPlaces`。`regionLabels` 已不在地图上显示（策略区域名改在信息栏），保留供将来使用。
