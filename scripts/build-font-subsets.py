"""Build the self-hosted v2.7.1 game font subsets.

The source fonts are intentionally not committed because they are large. Download the
official OFL files described in assets/fonts/README.md, then pass their paths here.
"""

from __future__ import annotations

import argparse
from pathlib import Path

from fontTools import subset
from fontTools.ttLib import TTFont


ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = ROOT / "assets" / "fonts"
RUNTIME_EXTENSIONS = {".html", ".css", ".js"}


def collect_runtime_characters() -> set[int]:
    sources = [ROOT / "index.html", ROOT / "styles.css"]
    sources.extend(
        path
        for path in (ROOT / "src").rglob("*")
        if path.is_file() and path.suffix.lower() in RUNTIME_EXTENSIONS
    )

    characters: set[str] = set()
    for path in sources:
        characters.update(path.read_text(encoding="utf-8"))

    # Always keep ordinary Latin input, Chinese punctuation and full-width symbols.
    characters.update(chr(codepoint) for codepoint in range(0x20, 0x7F))
    characters.update(chr(codepoint) for codepoint in range(0x3000, 0x3040))
    characters.update(chr(codepoint) for codepoint in range(0xFF01, 0xFF5F))
    return {ord(character) for character in characters if not character.isspace()}


def build_subset(source: Path, destination: Path, codepoints: set[int]) -> None:
    options = subset.Options()
    options.flavor = "woff2"
    options.hinting = False
    options.layout_features = ["*"]
    options.name_IDs = [0, 1, 2, 3, 4, 5, 6]
    options.name_languages = [0x409, 0x804]
    options.name_legacy = True
    options.notdef_glyph = True
    options.recommended_glyphs = True
    options.prune_unicode_ranges = True

    font = TTFont(source, recalcTimestamp=False)
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(unicodes=codepoints)
    subsetter.subset(font)
    font.flavor = "woff2"
    destination.parent.mkdir(parents=True, exist_ok=True)
    font.save(destination, reorderTables=False)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--display", required=True, type=Path, help="ZCOOL XiaoWei TTF")
    parser.add_argument("--serif", required=True, type=Path, help="Noto Serif SC variable TTF")
    parser.add_argument("--sans", required=True, type=Path, help="Noto Sans SC variable TTF")
    args = parser.parse_args()

    codepoints = collect_runtime_characters()
    jobs = [
        (args.display, OUTPUT_DIR / "zcool-xiaowei-game.woff2"),
        (args.serif, OUTPUT_DIR / "noto-serif-sc-game.woff2"),
        (args.sans, OUTPUT_DIR / "noto-sans-sc-game.woff2"),
    ]
    for source, destination in jobs:
        build_subset(source, destination, codepoints)
        print(f"{destination.relative_to(ROOT)}: {destination.stat().st_size:,} bytes")
    print(f"Subset character set: {len(codepoints):,} codepoints")


if __name__ == "__main__":
    main()
