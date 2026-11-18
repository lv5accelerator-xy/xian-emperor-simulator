"""生成山河舆图的地形底图与矢量数据。

输入均为公有领域的 Natural Earth 数据（不随仓库提交，按 docs/MAP_DATA.md 下载）：
  --hyp    10m_rasters/HYP_HR_SR/HYP_HR_SR.tif   分层设色地形（用于推算高程层级）
  --gray   10m_rasters/GRAY_HR_SR/GRAY_HR_SR.tif 灰度山体阴影
  --land   ne_10m_land.geojson
  --rivers ne_10m_rivers_lake_centerlines.geojson
  --lakes  ne_10m_lakes.geojson
另读 scripts/map-data/eastern-han.json（东汉郡国治所、汉代水系与海岸线修订）。

输出：
  assets/images/map/terrain.webp           2400×1440 地形底图（游戏画布的 2 倍）
  src/historical-geography-data.js         替换 GENERATED 标记之间的陆地、水系、湖泽、州界与山名数据

投影与游戏一致：等经纬度，x = (经度 − 88) × 30，y = (43⅓ − 纬度) × 30，画布 1200×720。
Natural Earth 1 角分栅格与之同为等经纬度，裁剪后正好是画布的 2 倍，无需重新投影。
"""
from __future__ import annotations

import argparse
import json
import re
from pathlib import Path

import numpy as np
import tifffile
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage
from skimage.segmentation import watershed
from skimage.measure import find_contours
from shapely import concave_hull
from shapely.geometry import LineString, MultiLineString, MultiPoint, MultiPolygon, Point, Polygon, box, shape
from shapely.ops import linemerge, polylabel, unary_union

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "scripts" / "map-data" / "eastern-han.json"
TERRAIN_OUT = ROOT / "assets" / "images" / "map" / "terrain.webp"
GEO_JS = ROOT / "src" / "historical-geography-data.js"

WEST, EAST, NORTH, SOUTH = 88.0, 128.0, 43 + 1 / 3, 19 + 1 / 3
SCALE = 30  # 画布像素 / 度
RASTER = 2  # 底图是画布的几倍
PX_PER_DEG = SCALE * RASTER  # 60，与 Natural Earth 1 角分栅格一致
WIDTH, HEIGHT = round((EAST - WEST) * SCALE), round((NORTH - SOUTH) * SCALE)
FRAME = box(WEST, SOUTH, EAST, NORTH)


def canvas(lon: float, lat: float) -> tuple[float, float]:
    return (lon - WEST) * SCALE, (NORTH - lat) * SCALE


def fmt(value: float) -> str:
    text = f"{value:.1f}"
    return text[:-2] if text.endswith(".0") else text


def path_of(geometry, close: bool) -> str:
    """把经纬度几何写成画布坐标下的 SVG path。"""
    parts = []
    if geometry.is_empty:
        return ""
    if geometry.geom_type in ("Polygon", "MultiPolygon"):
        polygons = [geometry] if geometry.geom_type == "Polygon" else list(geometry.geoms)
        rings = [ring for poly in polygons for ring in [poly.exterior, *poly.interiors]]
    elif geometry.geom_type in ("LineString", "MultiLineString"):
        rings = [geometry] if geometry.geom_type == "LineString" else list(geometry.geoms)
    else:
        rings = [g for g in getattr(geometry, "geoms", []) if g.geom_type in ("LineString", "LinearRing")]
    for ring in rings:
        coords = list(ring.coords)
        if close and len(coords) > 1 and coords[0] == coords[-1]:
            coords = coords[:-1]
        if len(coords) < 2:
            continue
        points = [canvas(x, y) for x, y in coords]
        out, last = [], None
        for x, y in points:
            key = (fmt(x), fmt(y))
            if key != last:
                out.append(key)
                last = key
        if len(out) < 2:
            continue
        parts.append("M" + " L".join(f"{x} {y}" for x, y in out) + (" Z" if close else ""))
    return " ".join(parts)


def chaikin(points, iterations: int = 3, closed: bool = False):
    """把手绘的折线磨圆：每轮在每段的 1/4 与 3/4 处取点。端点保持不动，以便与今河道接上。"""
    pts = [tuple(p) for p in points]
    for _ in range(iterations):
        out = [] if closed else [pts[0]]
        segments = zip(pts, pts[1:] + pts[:1]) if closed else zip(pts, pts[1:])
        for (x0, y0), (x1, y1) in segments:
            out += [(0.75 * x0 + 0.25 * x1, 0.75 * y0 + 0.25 * y1), (0.25 * x0 + 0.75 * x1, 0.25 * y0 + 0.75 * y1)]
        pts = out if closed else out + [pts[-1]]
    return pts


def load_geojson(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))["features"]


def land_geometry(land_path: Path, han_seas) -> object:
    features = load_geojson(land_path)
    parts = [shape(f["geometry"]).intersection(FRAME.buffer(0.5)) for f in features]
    land = unary_union([p for p in parts if not p.is_empty])
    seas = unary_union([Polygon(points) for points in han_seas])
    return land.difference(seas).intersection(FRAME.buffer(0.2))


def rasterize(geometry, supersample: int = 3) -> np.ndarray:
    """经纬度面 → 底图分辨率的抗锯齿掩膜（0..1）。"""
    w, h = round((EAST - WEST) * PX_PER_DEG), round((NORTH - SOUTH) * PX_PER_DEG)
    scale = PX_PER_DEG * supersample
    image = Image.new("L", (w * supersample, h * supersample), 0)
    draw = ImageDraw.Draw(image)
    polygons = [geometry] if geometry.geom_type == "Polygon" else list(getattr(geometry, "geoms", []))
    for poly in polygons:
        if poly.geom_type != "Polygon":
            continue
        draw.polygon([((x - WEST) * scale, (NORTH - y) * scale) for x, y in poly.exterior.coords], fill=255)
        for hole in poly.interiors:
            draw.polygon([((x - WEST) * scale, (NORTH - y) * scale) for x, y in hole.coords], fill=0)
    return np.asarray(image.resize((w, h), Image.LANCZOS), dtype=np.float32) / 255


def crop_raster(path: Path) -> np.ndarray:
    data = tifffile.memmap(str(path))
    rows, cols = data.shape[:2]
    deg = 360 / cols  # 每像素度数，Natural Earth 10m 为 1/60
    c0, c1 = round((WEST + 180) / deg), round((EAST + 180) / deg)
    r0, r1 = round((90 - NORTH) / deg), round((90 - SOUTH) / deg)
    return np.array(data[r0:r1, c0:c1], dtype=np.float32)


def elevation_level(hyp: np.ndarray) -> np.ndarray:
    """由 Natural Earth 分层设色推回 0..1 的“高程层级”：低地偏绿、丘陵偏褐、高原偏灰白。"""
    r, g, b = hyp[..., 0], hyp[..., 1], hyp[..., 2]
    level = np.clip(0.5 - 2.2 * (g - r) / 255, 0, 1)
    white = np.clip((np.minimum(np.minimum(r, g), b) - 170) / 50, 0, 1)
    level = level + white * (1 - level) * 0.75
    return ndimage.gaussian_filter(level, 2.5)


def terrain_image(hyp: np.ndarray, gray: np.ndarray, land) -> Image.Image:
    r, g, b = hyp[..., 0], hyp[..., 1], hyp[..., 2]
    level = elevation_level(hyp)
    stops = np.array([0.0, 0.22, 0.42, 0.62, 0.8, 1.0])
    colors = np.array([
        [104, 106, 72],   # 平原：暗橄榄
        [120, 112, 76],
        [142, 117, 80],   # 丘陵：赭
        [154, 126, 88],   # 黄土高原
        [138, 124, 106],  # 高原：灰褐
        [164, 154, 136],  # 雪线以上：灰白，不做成亮斑
    ], dtype=np.float32)
    base = np.stack([np.interp(level, stops, colors[:, i]) for i in range(3)], axis=-1)
    # 高原上阴影的亮面更亮，压低高光，避免雪峰成片发白。
    shade = np.clip((gray / 150.0) ** 1.3, 0.5, 1.3)[..., None]
    land_rgb = np.clip(base * shade * 0.94, 0, 255)

    mask = rasterize(land)
    distance = ndimage.distance_transform_edt(mask < 0.5) / PX_PER_DEG  # 离岸距离（度）
    near, far = np.array([52, 98, 104], np.float32), np.array([22, 62, 78], np.float32)
    t = np.clip(distance / 2.5, 0, 1)[..., None]
    sea_rgb = near * (1 - t) + far * t
    # 近岸一道浅色水线，像旧图的晕线；只沿大块陆地画，小岛周围不画，免得成片光斑。
    big = ndimage.binary_opening(mask > 0.5, iterations=6)
    coast_distance = ndimage.distance_transform_edt(~big) / PX_PER_DEG
    halo = np.exp(-((coast_distance * PX_PER_DEG - 3) ** 2) / 6)[..., None] * (mask < 0.5)[..., None]
    sea_rgb = sea_rgb + halo * 18
    alpha = mask[..., None]
    rgb = land_rgb * alpha + sea_rgb * (1 - alpha)
    # 极轻的纸纹，避免大片平涂
    noise = ndimage.gaussian_filter(np.random.default_rng(196).normal(0, 1, mask.shape), 1.2)[..., None]
    rgb = np.clip(rgb + noise * 4, 0, 255)
    return Image.fromarray(rgb.astype(np.uint8), "RGB")


def river_features(rivers_path: Path, spec: dict, land) -> list[dict]:
    features = load_geojson(rivers_path)
    keep, drop = spec["keep"], set(spec.get("drop", []))
    grouped: dict[str, dict] = {}
    for feature in features:
        name = feature["properties"].get("name")
        if name in drop or name not in keep:
            continue
        rule = keep[name]
        geometry = shape(feature["geometry"]).intersection(FRAME)
        if geometry.is_empty:
            continue
        lines = [geometry] if geometry.geom_type == "LineString" else [g for g in getattr(geometry, "geoms", []) if g.geom_type == "LineString"]
        lon_range = rule.get("lon")
        for line in lines:
            coords = list(line.coords)
            if lon_range:
                coords = [c for c in coords if lon_range[0] <= c[0] <= lon_range[1]]
            cut = rule.get("replaceEastOf")
            if cut is not None:
                coords = [c for c in coords if c[0] <= cut]
            if len(coords) < 2:
                continue
            entry = grouped.setdefault(rule["id"], {"id": rule["id"], "name": "", "rank": rule["rank"], "label": None, "lines": []})
            entry["lines"].append(LineString(coords))
            if rule.get("name"):
                entry["name"] = rule["name"]
            if rule.get("label"):
                entry["label"] = rule["label"]
            entry["rank"] = min(entry["rank"], rule["rank"])
        if rule.get("hanCourse"):
            # 汉代故道单独成条、标为 historic，地图上用虚线表示“示意河道”，不与实测河道混在一起。
            grouped.setdefault(rule["id"] + "-han", {"id": rule["id"] + "-han", "name": "", "rank": rule["rank"], "label": None, "historic": True,
                                                       "lines": [LineString(chaikin(rule["hanCourse"]))]})
    for added in spec.get("added", []):
        grouped[added["id"]] = {"id": added["id"], "name": added["name"], "rank": added["rank"], "label": added.get("label"), "historic": True,
                                "lines": [LineString(chaikin(added["points"]))]}
    out = []
    for entry in grouped.values():
        merged = linemerge(MultiLineString(entry["lines"])) if len(entry["lines"]) > 1 else entry["lines"][0]
        if not entry.get("historic"):  # 手绘故道已经磨圆，不再抽稀
            merged = merged.simplify(0.018 if entry["rank"] <= 2 else 0.03, preserve_topology=False)
        item = {"id": entry["id"], "name": entry["name"], "rank": entry["rank"], "label": entry["label"], "d": path_of(merged, close=False)}
        if entry.get("historic"):
            item["historic"] = True
        out.append(item)
    out.sort(key=lambda item: (item["rank"], item["id"]))
    return out


def lake_features(lakes_path: Path, spec: dict) -> list[dict]:
    out = []
    for feature in load_geojson(lakes_path):
        name = feature["properties"].get("name")
        if name not in spec["keep"]:
            continue
        geometry = shape(feature["geometry"]).intersection(FRAME).simplify(0.01)
        if geometry.is_empty:
            continue
        label = polylabel(max(geometry.geoms, key=lambda g: g.area) if geometry.geom_type == "MultiPolygon" else geometry, 0.01)
        out.append({"name": spec["keep"][name], "d": path_of(geometry, close=True), "label": [round(label.x, 2), round(label.y, 2)]})
    for added in spec.get("added", []):
        poly = Polygon(chaikin(added["points"], closed=True))
        label = polylabel(poly, 0.01)
        out.append({"name": added["name"], "d": path_of(poly, close=True), "label": [round(label.x, 2), round(label.y, 2)], "approximate": True})
    return out


GRID = 20  # 州界计算网格：每度 20 格（0.05°）
WATERSHED_COMPACTNESS = 0.002  # 越大越接近等距划分，越小越贴合山脊


def province_surface(level: np.ndarray) -> np.ndarray:
    """划界用的地势面：高程层级降到 1/20° 网格并适度平滑，只保留大山脊、去掉细碎起伏。"""
    coarse = level.reshape(level.shape[0] // 3, 3, level.shape[1] // 3, 3).mean(axis=(1, 3))  # 1/60° → 1/20°
    return ndimage.gaussian_filter(coarse, 3)


def realm_geometry(data: dict, land):
    """汉境：所有郡治与辅助点的凹包外扩后与陆地相交。"""
    frontier_spec = data["frontier"]
    all_points = [(c[2], c[3]) for c in data["commanderies"]] + [(a[2], a[3]) for a in data["auxiliarySeeds"]["points"]]
    hull = concave_hull(MultiPoint(all_points), ratio=frontier_spec["concaveRatio"])
    frontier = hull.buffer(frontier_spec["bufferDegrees"], quad_segs=12).buffer(-0.3).buffer(0.3)
    return frontier.intersection(land).intersection(FRAME)


def seeds_by_owner(data: dict, owner_of_commandery: dict) -> list[tuple[float, float, str]]:
    """郡治按给定归属；辅助点随与之最近的同州（基础建制）郡国。"""
    commanderies = [(c[0], c[2], c[3], c[1]) for c in data["commanderies"]]
    seeds = [(x, y, owner_of_commandery[name]) for name, x, y, _ in commanderies]
    for _, base, x, y in data["auxiliarySeeds"]["points"]:
        same = [c for c in commanderies if c[3] == base]
        nearest = min(same, key=lambda c: (c[1] - x) ** 2 + (c[2] - y) ** 2)
        seeds.append((x, y, owner_of_commandery[nearest[0]]))
    return seeds


def watershed_partition(seeds, ids, surface, realm) -> dict:
    """以各点为种子在地势面上做分水岭划分，按归属描出轮廓（先略微模糊再取 0.5 等值线，使相邻两区边界重合且平滑），
    再限定在 realm 内。返回 {id: (几何, 标注点)}。"""
    rows, cols = surface.shape
    to_cell = lambda x, y: (min(rows - 1, max(0, int((NORTH - y) * GRID))), min(cols - 1, max(0, int((x - WEST) * GRID))))
    markers = np.zeros(surface.shape, dtype=np.int32)
    for x, y, owner in seeds:
        markers[to_cell(x, y)] = ids.index(owner) + 1
    owner_grid = watershed(surface, markers, compactness=WATERSHED_COMPACTNESS) - 1
    out = {}
    for index, pid in enumerate(ids):
        mask = ndimage.gaussian_filter((owner_grid == index).astype(np.float32), 1.1)
        rings = []
        for contour in find_contours(np.pad(mask, 1), 0.5):
            if len(contour) < 8:
                continue
            ring = Polygon([(WEST + (c - 1 + 0.5) / GRID, NORTH - (r - 1 + 0.5) / GRID) for r, c in contour]).buffer(0)
            if not ring.is_empty:
                rings.append(ring)
        rings.sort(key=lambda g: -g.area)
        region = Polygon()
        for ring in rings:
            region = region.difference(ring) if region.contains(ring.representative_point()) else region.union(ring)
        region = region.intersection(realm)
        if region.is_empty:
            continue
        parts = [region] if region.geom_type == "Polygon" else [g for g in region.geoms if g.geom_type == "Polygon"]
        parts = [p.simplify(0.035) for p in parts if p.area > 0.03]
        if not parts:
            continue
        label = polylabel(max(parts, key=lambda g: g.area), 0.02)
        out[pid] = (MultiPolygon(parts) if len(parts) > 1 else parts[0], [round(label.x, 2), round(label.y, 2)])
    return out


def map_obstacles(data: dict) -> list[tuple[float, float, float]]:
    """地图上已有的文字与图标位置（经纬度, 权重）：城池、郡国标注、河名、山名。州名放置时尽量避开它们。"""
    source = GEO_JS.read_text(encoding="utf-8")
    points = []
    block = source[source.index("const cityCoordinates"):source.index("});", source.index("const cityCoordinates"))]
    points += [(float(x), float(y), 1.0) for x, y in re.findall(r"\[\s*([\d.]+),\s*([\d.]+)\s*\]", block)]  # 城池：图标加名牌，最需避开
    block = source[source.index("const minorPlaces"):source.index("]);", source.index("const minorPlaces"))]
    points += [(float(x), float(y), 0.6) for x, y in re.findall(r"point:\s*\[\s*([\d.]+),\s*([\d.]+)\s*\]", block)]
    points += [(r["label"][0], r["label"][1], 0.5) for r in data["rivers"]["keep"].values() if r.get("label") and r.get("name")]
    points += [(r["label"][0], r["label"][1], 0.5) for r in data["rivers"]["added"] if r.get("label")]
    points += [(r["point"][0], r["point"][1], 0.5) for r in data["ranges"]]
    return points


def place_label(geometry, obstacles) -> list[float]:
    """在区域内找一个既离边界远、又离已有文字远的点。横向按字宽放宽（州名约两个大字宽、一个字高）。"""
    main = max([geometry] if geometry.geom_type == "Polygon" else list(geometry.geoms), key=lambda g: g.area)
    inner = main.buffer(-0.35)
    if inner.is_empty:
        p = polylabel(main, 0.02)
        return [round(p.x, 2), round(p.y, 2)]
    minx, miny, maxx, maxy = inner.bounds
    best, best_score = None, -1.0
    for x in np.arange(minx, maxx, 0.1):
        for y in np.arange(miny, maxy, 0.1):
            point = Point(x, y)
            if not inner.contains(point):
                continue
            edge = main.exterior.distance(point)
            clear = min((np.hypot((x - ox) / 1.8, y - oy) / w for ox, oy, w in obstacles), default=9.0)
            score = min(edge, 0.9) + min(clear, 1.2) * 1.5  # 先保证不压字，再尽量居中
            if score > best_score:
                best, best_score = (x, y), score
    if best is None:
        p = polylabel(main, 0.02)
        return [round(p.x, 2), round(p.y, 2)]
    return [round(best[0], 2), round(best[1], 2)]


def province_features(data: dict, realm, surface: np.ndarray) -> list[dict]:
    """东汉州部：各时期分别以郡治为种子在地势面上做分水岭划分。

    分水岭从各郡治按地势由低到高“灌水”，不同州的水在山脊相遇，州界因此大致落在分水岭上；
    compactness 让平原上的分界仍接近等距，不至于随微小起伏乱跑。
    """
    eras = []
    for era in data["eras"]["list"]:
        move_prov, move_cmd = era.get("moveProvinces", {}), era.get("moveCommanderies", {})
        owner = {c[0]: move_cmd.get(c[0], move_prov.get(c[1], c[1])) for c in data["commanderies"]}
        seeds = seeds_by_owner(data, owner)
        ids = [pid for pid in data["provinces"] if pid in owner.values()]
        shapes = watershed_partition(seeds, ids, surface, realm)
        obstacles = map_obstacles(data)
        provinces = []
        for pid in ids:
            if pid not in shapes:
                continue
            geometry, _ = shapes[pid]
            label = place_label(geometry, obstacles)
            meta = data["provinces"][pid]
            members = [c[0] for c in data["commanderies"] if owner[c[0]] == pid]
            item = {"id": pid, "name": meta["name"], "color": meta["color"], "d": path_of(geometry, close=True), "label": label, "commanderies": members}
            if geometry.area < 9:  # 中原诸州面积小、城池密，州名用小一号的字
                item["compact"] = True
            provinces.append(item)
        eras.append({"id": era["id"], "from": era["from"], "to": era["to"], "label": era["label"], "note": era["note"], "provinces": provinces})
        print(f"  {era['id']}: {len(provinces)} provinces")
    return eras


def strategy_region_paths(data: dict, realm, surface: np.ndarray) -> dict:
    """游戏 14 个策略区域的轮廓：同样做分水岭划分，种子是各区域所含郡国。"""
    members = data["strategyRegions"]["members"]
    owner = {name: rid for rid, names in members.items() for name in names}
    shapes = watershed_partition(seeds_by_owner(data, owner), list(members), surface, realm)
    print(f"  strategy regions: {len(shapes)}")
    return {rid: path_of(shapes[rid][0], close=True) for rid in members if rid in shapes}


def js_value(value, indent: int = 4) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def write_geo_js(land, rivers, lakes, eras, regions, ranges, seats) -> None:
    source = GEO_JS.read_text(encoding="utf-8")
    land_parts = [land] if land.geom_type == "Polygon" else list(land.geoms)
    land_parts = sorted([p.simplify(0.025) for p in land_parts if p.area > 0.01], key=lambda p: -p.area)
    land_paths = [{"id": f"land-{i}", "d": path_of(p, close=True)} for i, p in enumerate(land_parts)]
    block = "\n".join([
        "  // <GENERATED by scripts/build-map-terrain.py — 不要手改，改 scripts/map-data/eastern-han.json 后重新生成>",
        f"  const landPaths = Object.freeze({js_value(land_paths)});",
        f"  const rivers = Object.freeze({js_value(rivers)});",
        f"  const lakes = Object.freeze({js_value(lakes)});",
        f"  const provinceEras = Object.freeze({js_value(eras)});",
        f"  const strategyRegionPaths = Object.freeze({js_value(regions)});",
        f"  const ranges = Object.freeze({js_value(ranges)});",
        f"  const commanderySeats = Object.freeze({js_value(seats)});",
        "  // </GENERATED>",
    ])
    pattern = re.compile(r"  // <GENERATED.*?// </GENERATED>", re.S)
    if not pattern.search(source):
        raise SystemExit("src/historical-geography-data.js 缺少 GENERATED 标记")
    GEO_JS.write_text(pattern.sub(lambda _: block, source), encoding="utf-8")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    for name in ("hyp", "gray", "land", "rivers", "lakes"):
        parser.add_argument(f"--{name}", type=Path, required=True)
    parser.add_argument("--quality", type=int, default=80)
    args = parser.parse_args()
    data = json.loads(DATA.read_text(encoding="utf-8"))

    land = land_geometry(args.land, data["hanSeas"]["polygons"])
    hyp, gray = crop_raster(args.hyp), crop_raster(args.gray)
    image = terrain_image(hyp, gray, land)
    TERRAIN_OUT.parent.mkdir(parents=True, exist_ok=True)
    image.save(TERRAIN_OUT, "WEBP", quality=args.quality, method=6)
    print(f"{TERRAIN_OUT.relative_to(ROOT)}: {image.size[0]}×{image.size[1]}, {TERRAIN_OUT.stat().st_size:,} bytes")

    rivers = river_features(args.rivers, data["rivers"], land)
    lakes = lake_features(args.lakes, data["lakes"])
    realm, surface = realm_geometry(data, land), province_surface(elevation_level(hyp))
    eras = province_features(data, realm, surface)
    regions = strategy_region_paths(data, realm, surface)
    ranges = [{"name": r["name"], "point": r["point"]} for r in data["ranges"]]
    seats = [{"name": c[0], "province": c[1], "point": [c[2], c[3]]} for c in data["commanderies"] if FRAME.contains(Point(c[2], c[3]))]
    write_geo_js(land, rivers, lakes, eras, regions, ranges, seats)
    print(f"{GEO_JS.relative_to(ROOT)}: {len(rivers)} rivers, {len(lakes)} lakes, {len(eras)} eras, {GEO_JS.stat().st_size:,} bytes")


if __name__ == "__main__":
    main()
