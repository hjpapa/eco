#!/usr/bin/env python3
"""One-time asset processor for 드래곤마운틴 시티.

Takes the raw pixel-art PNGs (white background, RGB) and produces
trimmed, white-keyed-to-transparent RGBA PNGs under public/assets/.

Usage:
    python3 scripts/process-assets.py <source_dir>

The processed PNGs are committed to the repo; this script is kept only
so the transform can be re-run if new source art arrives.
"""
import sys
import os
from PIL import Image

# source filename -> (category, output name)
MAP = {
    "building_startup_office.png": ("buildings", "office"),
    "building_manufacturing_factory.png": ("buildings", "factory"),
    "building_rd_lab.png": ("buildings", "rnd"),
    "building_retail_store.png": ("buildings", "store"),
    "building_logistics_warehouse.png": ("buildings", "warehouse"),
    "character_student_ceo.png": ("characters", "ceo"),
    "character_engineer_researcher.png": ("characters", "engineer"),
    "character_secretary_advisor.png": ("characters", "secretary"),
    "icon_stock_dashboard.png": ("icons", "stock"),
    "icon_breaking_news.png": ("icons", "news"),
}

SIZES = {"buildings": 256, "characters": 256, "icons": 128}
WHITE_THRESHOLD = 238  # pixels brighter than this on all channels become transparent


def key_white_to_alpha(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if r >= WHITE_THRESHOLD and g >= WHITE_THRESHOLD and b >= WHITE_THRESHOLD:
                px[x, y] = (r, g, b, 0)
    return im


def trim(im: Image.Image) -> Image.Image:
    bbox = im.getbbox()  # bbox of non-zero (non-transparent) region
    return im.crop(bbox) if bbox else im


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else "."
    out_root = os.path.join(os.getcwd(), "public", "assets")
    for fname, (cat, name) in MAP.items():
        path = os.path.join(src, fname)
        if not os.path.exists(path):
            print(f"!! missing source: {fname}")
            continue
        im = Image.open(path)
        im = key_white_to_alpha(im)
        im = trim(im)
        size = SIZES[cat]
        im.thumbnail((size, size), Image.NEAREST)
        out_dir = os.path.join(out_root, cat)
        os.makedirs(out_dir, exist_ok=True)
        dest = os.path.join(out_dir, f"{name}.png")
        im.save(dest)
        print(f"ok {cat}/{name}.png  {im.size}")


if __name__ == "__main__":
    main()
