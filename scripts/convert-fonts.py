from pathlib import Path
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
FONT_DIR = ROOT / "public" / "assets" / "font"

FONTS = [
    (FONT_DIR / "Apple-Regular.ttf", FONT_DIR / "pawcream-en.woff2"),
    (FONT_DIR / "AaZiTiGuanJiaWanWanTi-2.ttf", FONT_DIR / "pawcream-cn.woff2"),
]


def fmt(size: int) -> str:
    units = ["B", "KiB", "MiB"]
    value = float(size)
    unit = 0
    while value >= 1024 and unit < len(units) - 1:
        value /= 1024
        unit += 1
    return f"{value:.1f} {units[unit]}"


for source, output in FONTS:
    if not source.exists():
        raise SystemExit(f"Missing font source: {source}")

    font = TTFont(str(source), recalcTimestamp=False)
    font.flavor = "woff2"
    font.save(str(output))

    before = source.stat().st_size
    after = output.stat().st_size
    saved = (1 - after / before) * 100 if before else 0
    print(f"{source.name}: {fmt(before)} -> {output.name}: {fmt(after)} ({saved:.1f}% smaller)")
