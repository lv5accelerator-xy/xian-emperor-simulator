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
from shapely import concave_hull, voronoi_polygons
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


def terrain_image(hyp_path: Path, gray_path: Path, land) -> Image.Image:
    hyp, gray = crop_raster(hyp_path), crop_raster(gray_path)
    r, g, b = hyp[..., 0], hyp[..., 1], hyp[..., 2]
    # Natural Earth 设色：低地偏绿、丘陵偏褐、高原偏灰白。由此推回一个 0..1 的“高程层级”。
    level = np.clip(0.5 - 2.2 * (g - r) / 255, 0, 1)
    white = np.clip((np.minimum(np.minimum(r, g), b) - 170) / 50, 0, 1)
    level = level + white * (1 - level) * 0.75
    level = ndimage.gaussian_filter(level, 2.5)
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


def province_features(data: dict, land) -> list[dict]:
    """东汉十三州部：郡治与辅助点的 Voronoi 按州合并，再限定在汉境与陆地内。"""
    seeds = [(item[2], item[3], item[1]) for item in data["commanderies"]] + [(item[2], item[3], item[1]) for item in data["auxiliarySeeds"]["points"]]
    # 等经纬度下经度方向被拉长；按中纬度余弦压缩经度再算距离，使分界更接近等距。
    k = np.cos(np.radians(32))
    to_metric = lambda x, y: (x * k, y)
    from_metric = lambda x, y: (x / k, y)
    points = MultiPoint([to_metric(x, y) for x, y, _ in seeds])
    cells = voronoi_polygons(points, extend_to=box(WEST * k - 10, SOUTH - 10, EAST * k + 10, NORTH + 10))
    by_province: dict[str, list] = {}
    for cell in cells.geoms:
        owner = min(seeds, key=lambda s: Point(to_metric(s[0], s[1])).distance(cell.representative_point()) if cell.contains(Point(to_metric(s[0], s[1]))) else 1e9)
        inside = [s for s in seeds if cell.contains(Point(to_metric(s[0], s[1])))]
        owner = inside[0] if inside else owner
        by_province.setdefault(owner[2], []).append(Polygon([from_metric(x, y) for x, y in cell.exterior.coords]))
    frontier_spec = data["frontier"]
    hull = concave_hull(MultiPoint([(x, y) for x, y, _ in seeds]), ratio=frontier_spec["concaveRatio"])
    frontier = hull.buffer(frontier_spec["bufferDegrees"], quad_segs=12).buffer(-0.3).buffer(0.3)
    realm = frontier.intersection(land).intersection(FRAME)
    out = []
    for pid, meta in data["provinces"].items():
        region = unary_union(by_province.get(pid, [])).intersection(realm)
        if region.is_empty:
            continue
        region = region.simplify(0.03)
        parts = [region] if region.geom_type == "Polygon" else [g for g in region.geoms if g.geom_type == "Polygon"]
        parts = [p for p in parts if p.area > 0.02]
        region = MultiPolygon(parts) if len(parts) > 1 else parts[0]
        main = max(parts, key=lambda g: g.area)
        label = polylabel(main, 0.02)
        out.append({"id": pid, "name": meta["name"], "color": meta["color"], "d": path_of(region, close=True), "label": [round(label.x, 2), round(label.y, 2)]})
    return out


def js_value(value, indent: int = 4) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def write_geo_js(land, rivers, lakes, provinces, ranges, seats) -> None:
    source = GEO_JS.read_text(encoding="utf-8")
    land_parts = [land] if land.geom_type == "Polygon" else list(land.geoms)
    land_parts = sorted([p.simplify(0.025) for p in land_parts if p.area > 0.01], key=lambda p: -p.area)
    land_paths = [{"id": f"land-{i}", "d": path_of(p, close=True)} for i, p in enumerate(land_parts)]
    block = "\n".join([
        "  // <GENERATED by scripts/build-map-terrain.py — 不要手改，改 scripts/map-data/eastern-han.json 后重新生成>",
        f"  const landPaths = Object.freeze({js_value(land_paths)});",
        f"  const rivers = Object.freeze({js_value(rivers)});",
        f"  const lakes = Object.freeze({js_value(lakes)});",
        f"  const provinces = Object.freeze({js_value(provinces)});",
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
    image = terrain_image(args.hyp, args.gray, land)
    TERRAIN_OUT.parent.mkdir(parents=True, exist_ok=True)
    image.save(TERRAIN_OUT, "WEBP", quality=args.quality, method=6)
    print(f"{TERRAIN_OUT.relative_to(ROOT)}: {image.size[0]}×{image.size[1]}, {TERRAIN_OUT.stat().st_size:,} bytes")

    rivers = river_features(args.rivers, data["rivers"], land)
    lakes = lake_features(args.lakes, data["lakes"])
    provinces = province_features(data, land)
    ranges = [{"name": r["name"], "point": r["point"]} for r in data["ranges"]]
    seats = [{"name": c[0], "province": c[1], "point": [c[2], c[3]]} for c in data["commanderies"] if FRAME.contains(Point(c[2], c[3]))]
    write_geo_js(land, rivers, lakes, provinces, ranges, seats)
    print(f"{GEO_JS.relative_to(ROOT)}: {len(rivers)} rivers, {len(lakes)} lakes, {len(provinces)} provinces, {GEO_JS.stat().st_size:,} bytes")


if __name__ == "__main__":
    main()
