from pathlib import Path

import cv2
import numpy as np
from PIL import Image

SRC = Path("public/assets/instax/粉白横.png")
DST = Path("public/assets/instax-transparent/粉白横.png")

DARK_THRESHOLD = 45
MIN_COMPONENT_RATIO = 0.004
MIN_COMPONENT_PIXELS = 3000


def main() -> None:
    if not SRC.exists():
        raise FileNotFoundError(SRC)

    with Image.open(SRC) as original:
        original_size = original.size
        rgba = original.convert("RGBA")
        arr = np.array(rgba)

        rgb = arr[:, :, :3]
        alpha = arr[:, :, 3]
        dark_mask = ((rgb.max(axis=2) <= DARK_THRESHOLD) & (alpha > 0)).astype(np.uint8)

        count, labels, stats, _ = cv2.connectedComponentsWithStats(dark_mask, connectivity=8)

        h, w = dark_mask.shape
        min_area = max(MIN_COMPONENT_PIXELS, int(h * w * MIN_COMPONENT_RATIO))

        remove_mask = np.zeros((h, w), dtype=bool)
        removed = []

        for label_id in range(1, count):
            area = int(stats[label_id, cv2.CC_STAT_AREA])
            if area >= min_area:
                x = int(stats[label_id, cv2.CC_STAT_LEFT])
                y = int(stats[label_id, cv2.CC_STAT_TOP])
                cw = int(stats[label_id, cv2.CC_STAT_WIDTH])
                ch = int(stats[label_id, cv2.CC_STAT_HEIGHT])
                remove_mask |= labels == label_id
                removed.append((area, x, y, cw, ch))

        if not removed:
            raise RuntimeError("No large black photo area found")

        arr[remove_mask, 3] = 0

        DST.parent.mkdir(parents=True, exist_ok=True)
        result = Image.fromarray(arr, mode="RGBA")

        save_kwargs = {"compress_level": 9}
        if original.info.get("icc_profile") is not None:
            save_kwargs["icc_profile"] = original.info["icc_profile"]
        if original.info.get("dpi") is not None:
            save_kwargs["dpi"] = original.info["dpi"]

        result.save(DST, format="PNG", **save_kwargs)

        with Image.open(DST) as check:
            if check.size != original_size:
                raise RuntimeError(
                    f"Dimension changed: {original_size} -> {check.size}"
                )

        print(
            f"{SRC.name}: size={original_size}; "
            f"removed_components={len(removed)}; "
            f"removed_pixels={int(remove_mask.sum())}; "
            f"components={removed}"
        )


if __name__ == "__main__":
    main()
