#!/usr/bin/env python3
from __future__ import annotations

import re
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / "public" / "assets"

ASSETS = [
    ("atelier", "background.png", 2560, 82),
    ("atelier", "background2.png", 2560, 82),
    ("atelier", "background3.png", 2560, 82),
    ("atelier", "window.png", 1800, 84),
    ("atelier", "pawcream.png", 1800, 84),
    ("atelier", "wall-mounted cabinet.png", 1200, 84),
    ("atelier", "people.png", 800, 84),
    ("atelier", "light.png", 1200, 84),
    ("atelier", "lighton.png", 1400, 84),
    ("atelier", "instax.png", 1600, 84),
    ("atelier", "letter.png", 1600, 86),
    ("atelier", "sewing machine.png", 2000, 84),
    ("atelier", "bear.png", 700, 84),
    ("atelier", "music.png", 1200, 84),
    ("atelier", "note.png", 1600, 88),
    ("atelier", "message.png", 1600, 88),
    ("atelier", "color.png", 1200, 84),
    ("home", "Home_mobile.png", 2048, 82),
    ("effects", "pawcream-ecg.png", 1600, 84),
    *[
        ("stars", f"star-{number:02d}.png", 512, 84)
        for number in (1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15)
    ],
]


def fmt(size: int) -> str:
    units = ("B", "KiB", "MiB")
    value = float(size)
    unit = 0
    while value >= 1024 and unit < len(units) - 1:
        value /= 1024
        unit += 1
    return f"{value:.1f} {units[unit]}"


def run(*args: str) -> str:
    result = subprocess.run(args, text=True, capture_output=True)
    if result.returncode != 0:
        detail = result.stderr.strip() or result.stdout.strip() or f"exit {result.returncode}"
        raise RuntimeError(f"{args[0]} failed: {detail}")
    return result.stdout


def png_size(path: Path) -> tuple[int, int]:
    description = run("file", "-b", str(path))
    match = re.search(r"(\d+) x (\d+)", description)
    if not match:
        raise RuntimeError(f"Could not read PNG dimensions for {path}: {description.strip()}")
    return int(match.group(1)), int(match.group(2))


def optimize(directory: str, filename: str, max_width: int, quality: int) -> tuple[int, int]:
    source = PUBLIC / directory / filename
    output = source.with_suffix(".webp")

    if not source.exists():
        raise FileNotFoundError(f"Missing source asset: {source}")

    before = source.stat().st_size
    width, height = png_size(source)

    args = [
        "cwebp",
        "-quiet",
        "-mt",
        "-m", "6",
        "-q", str(quality),
        "-alpha_q", "100",
    ]
    if width > max_width:
        args.extend(["-resize", str(max_width), "0"])
    args.extend([str(source), "-o", str(output)])
    run(*args)

    after = output.stat().st_size
    reduction = ((1 - after / before) * 100) if before else 0
    dimensions = (
        f"{width}x{height} -> {max_width}px wide"
        if width > max_width
        else f"{width}x{height} (kept)"
    )
    print(
        f"{directory}/{filename}: {fmt(before)} -> {output.name}: "
        f"{fmt(after)} | -{reduction:.1f}% | {dimensions}"
    )
    return before, after


def main() -> None:
    for command in ("cwebp", "file"):
        if shutil.which(command) is None:
            raise SystemExit(f"Missing required command: {command}")

    total_before = 0
    total_after = 0

    for asset in ASSETS:
        before, after = optimize(*asset)
        total_before += before
        total_after += after

    reduction = ((1 - total_after / total_before) * 100) if total_before else 0
    print()
    print(f"Runtime PNG source total: {fmt(total_before)}")
    print(f"Runtime WebP total: {fmt(total_after)}")
    print(f"Total reduction: {reduction:.1f}%")


if __name__ == "__main__":
    main()
