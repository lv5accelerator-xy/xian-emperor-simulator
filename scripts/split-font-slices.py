"""把自带字体切成“常用片”与“其余片”，并生成 src/font-faces.css。

页面上的每种字体原先是一个完整子集（约 400–500 KB），开局即全部下载。这里按
assets/fonts/core-chars.txt（开局、主界面、月报、舆图等画面实际出现的字，由
scripts/collect-core-chars.cjs 收集）把每个字体切成两片，用 @font-face 的
unicode-range 声明：浏览器只在页面真的出现某片里的字时才下载那一片。

完整子集 assets/fonts/<name>.woff2 由 scripts/build-font-subsets.py 生成，仍保留在仓库里，
作为切片来源与缺字检查的依据；页面不再直接引用。

用法：python3 scripts/split-font-slices.py

切片地址的缓存参数取文件内容的短哈希，与发布号无关：发布工具改写发布号时不会动到它，
字形不变时浏览器缓存也继续有效。
"""

from __future__ import annotations

import argparse
import hashlib
import io
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
FONTS = ROOT / "assets" / "fonts"
CSS = ROOT / "src" / "font-faces.css"

# 文楷只负责汉字与中文标点，拉丁字母、数字交给下一个字体（与原 typography.css 的 unicode-range 一致）。
WENKAI_RANGES = [(0x2E80, 0x2FFF), (0x3000, 0x303F), (0x3400, 0x4DBF), (0x4E00, 0x9FFF), (0xF900, 0xFAFF), (0xFF01, 0xFF60), (0x20000, 0x2FA1F)]
FACES = [
    # family, file stem, weight, CJK-only
    ("Xian Display", "zcool-xiaowei-game", "400", False),
    ("Xian Serif SC", "noto-serif-sc-game", "100 900", False),
    ("Xian Sans SC", "noto-sans-sc-game", "100 900", False),
    ("Xian WenKai", "wenkai-game-regular", "100 500", True),
    ("Xian WenKai", "wenkai-game-medium", "600 900", True),
]


def is_cjk(code: int) -> bool:
    return any(start <= code <= end for start, end in WENKAI_RANGES)


def ranges(codes: set[int]) -> str:
    """把码位集合写成紧凑的 unicode-range。"""
    parts, run = [], None
    for code in sorted(codes):
        if run and code == run[1] + 1:
            run[1] = code
            continue
        if run:
            parts.append(run)
        run = [code, code]
    if run:
        parts.append(run)
    return ", ".join(f"U+{a:X}" if a == b else f"U+{a:X}-{b:X}" for a, b in parts)


def write_slice(source: Path, codes: set[int], target: Path) -> None:
    # 不改写 head 表的修改时间，同样的输入每次切出完全相同的文件（缓存参数也就不变）。
    font = TTFont(source, recalcTimestamp=False)
    options = subset.Options()
    options.flavor = "woff2"
    options.layout_features = ["*"]
    options.name_IDs = ["*"]
    options.name_languages = ["*"]
    options.notdef_outline = True
    options.glyph_names = False
    subsetter = subset.Subsetter(options)
    subsetter.populate(unicodes=sorted(codes))
    subsetter.subset(font)
    font.flavor = "woff2"
    buffer = io.BytesIO()
    font.save(buffer)
    target.write_bytes(buffer.getvalue())


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.parse_args()

    core_chars = {ord(c) for c in (FONTS / "core-chars.txt").read_text(encoding="utf-8") if not c.isspace()}
    # 中文标点、全角符号与全角空格体积很小，一律放进常用片，免得一个标点就触发下载整片其余字。
    core_chars |= set(range(0x3000, 0x3040)) | set(range(0xFF01, 0xFF61))
    blocks = [
        "/* 本文件由 scripts/split-font-slices.py 生成，请勿手改。\n"
        " * 每种字体分“常用片”（core）与“其余片”（rest），按 unicode-range 声明：页面出现某片里的字才下载那一片。\n"
        " * 常用字见 assets/fonts/core-chars.txt。 */"
    ]
    summary = []
    for family, stem, weight, cjk_only in FACES:
        source = FONTS / f"{stem}.woff2"
        available = set(TTFont(source).getBestCmap())
        if cjk_only:
            available = {code for code in available if is_cjk(code)}
        core = {code for code in available if not is_cjk(code) or code in core_chars}
        rest = available - core
        for part, codes in (("core", core), ("rest", rest)):
            if not codes:
                continue
            target = FONTS / f"{stem}-{part}.woff2"
            write_slice(source, codes, target)
            digest = hashlib.sha256(target.read_bytes()).hexdigest()[:10]
            blocks.append(
                "@font-face {\n"
                f'  font-family: "{family}";\n'
                f'  src: url("../assets/fonts/{stem}-{part}.woff2?v={digest}") format("woff2");\n'
                "  font-style: normal;\n"
                f"  font-weight: {weight};\n"
                "  font-display: swap;\n"
                f"  unicode-range: {ranges(codes)};\n"
                "}"
            )
            summary.append(f"{stem}-{part}: {len(codes)} 字, {target.stat().st_size // 1024} KB")
    CSS.write_text("\n\n".join(blocks) + "\n", encoding="utf-8")
    print("\n".join(summary))
    print(f"wrote {CSS.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
