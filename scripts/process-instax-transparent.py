from pathlib import Path

import cv2
import numpy as np
from PIL import Image

SOURCE_DIR = Path("public/assets/instax")
OUTPUT_DIR = Path("public/assets/instax-transparent")

# Only very dark pixels can belong to the removable black photo area.
# Large connected components are removed; small black/dark decorations remain.
DARK_THRESHOLD = 45
MIN_COMPONENT_RATIO = 0.005
MIN_COMPONENT_PIXELS = 4000


def process_image(src_path: Path, dst_path: Path) -> tuple[int, int]:
    with Image.open(src_path) as original:
        rgba = original.convert("RGBA")
        arr = np.array(rgba)

        rgb = arr[:, :, :3]
        alpha = arr[:, :, 3]
        dark_mask = ((rgb.max(axis=2) <= DARK_THRESHOLD) & (alpha > 0)).astype(np.uint8)

        count, labels, stats, _ = cv2.connectedComponentsWithStats(
            dark_mask, connectivity=8
        )

        h, w = dark_mask.shape
        min_area = max(MIN_COMPONENT_PIXELS, int(h * w * MIN_COMPONENT_RATIO))

        remove_mask = np.zeros((h, w), dtype=bool)
        removed_components = 0

        for label_id in range(1, count):
            area = int(stats[label_id, cv2.CC_STAT_AREA])
            if area >= min_area:
                remove_mask |= labels == label_id
                removed_components += 1

        removed_pixels = int(remove_mask.sum())
        if removed_pixels == 0:
            raise RuntimeError(
                f"No large black photo region found in {src_path.name}; "
                "refusing to alter the image."
            )

        # Change alpha only. RGB values and every non-target pixel stay untouched.
        arr[remove_mask, 3] = 0
        result = Image.fromarray(arr, mode="RGBA")

        save_kwargs = {}
        if original.info.get("icc_profile") is not None:
            save_kwargs["icc_profile"] = original.info["icc_profile"]
        if original.info.get("dpi") is not None:
            save_kwargs["dpi"] = original.info["dpi"]

        dst_path.parent.mkdir(parents=True, exist_ok=True)
        result.save(dst_path, format="PNG", compress_level=9, **save_kwargs)

        # Verify dimensions are identical.
        with Image.open(dst_path) as check:
            if check.size != original.size:
                raise RuntimeError(
                    f"Dimension changed for {src_path.name}: "
                    f"{original.size} -> {check.size}"
                )

        return removed_components, removed_pixels


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    files = sorted(SOURCE_DIR.glob("*.png"))
    if not files:
        raise RuntimeError(f"No PNG files found in {SOURCE_DIR}")

    processed = 0
    for src_path in files:
        dst_path = OUTPUT_DIR / src_path.name
        components, pixels = process_image(src_path, dst_path)
        print(
            f"{src_path.name}: removed {components} large black component(s), "
            f"{pixels} pixel(s); size preserved"
        )
        processed += 1

    print(f"Processed {processed} PNG image(s) into {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
