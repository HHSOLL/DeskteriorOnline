#!/usr/bin/env python3
"""Build a v6 review board focused on tabletop micro-detail."""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
REVIEW_DIR = ROOT / "assets/references/blender-authored/premium-workstation-hero"
OUT = REVIEW_DIR / "workstation-v6-review-board.png"


def font(size: int):
    for candidate in [
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
        "/Library/Fonts/Arial.ttf",
    ]:
        try:
            return ImageFont.truetype(candidate, size)
        except Exception:
            pass
    return ImageFont.load_default()


def fit(path: Path, size: tuple[int, int]) -> Image.Image:
    canvas = Image.new("RGB", size, (18, 20, 24))
    if not path.exists():
        return canvas
    img = Image.open(path).convert("RGB")
    img.thumbnail(size, Image.Resampling.LANCZOS)
    canvas.paste(img, ((size[0] - img.width) // 2, (size[1] - img.height) // 2))
    return canvas


def wrap(draw: ImageDraw.ImageDraw, xy: tuple[int, int], text: str, width: int, line_height: int, fill, fnt) -> int:
    x, y = xy
    line = ""
    for word in text.split():
        nxt = f"{line} {word}".strip()
        if draw.textlength(nxt, font=fnt) <= width:
            line = nxt
            continue
        draw.text((x, y), line, fill=fill, font=fnt)
        y += line_height
        line = word
    if line:
        draw.text((x, y), line, fill=fill, font=fnt)
        y += line_height
    return y


def main() -> None:
    review = json.loads((REVIEW_DIR / "asset-review-v6-2026-05-20.json").read_text())
    metrics = review["metrics"]
    detail = review["desktopDetailPass"]
    board = Image.new("RGB", (1900, 1580), (12, 14, 18))
    draw = ImageDraw.Draw(board)
    title = font(42)
    heading = font(25)
    body = font(20)
    small = font(17)

    draw.text((44, 34), "Premium Workstation V6 - Desktop Micro-Detail Review", fill=(244, 238, 226), font=title)
    draw.text(
        (46, 92),
        "Loop: V5 fixed UVAtlas sampling. V6 targets the remaining desk/tabletop primitive-look defect.",
        fill=(174, 183, 194),
        font=body,
    )

    tiles = [
        ("Previous V5", REVIEW_DIR / "v5-previews/workstation-v5-isometric.png"),
        ("Current V6", REVIEW_DIR / "v6-previews/workstation-v6-isometric.png"),
        ("V6 tabletop detail", REVIEW_DIR / "v6-previews/workstation-v6-tabletop-closeup.png"),
        ("V6 input devices", REVIEW_DIR / "v6-previews/workstation-v6-input-devices-closeup.png"),
    ]
    tile_w, tile_h = 430, 320
    for idx, (label, path) in enumerate(tiles):
        x = 44 + idx * 462
        y = 150
        draw.rounded_rectangle((x - 2, y - 2, x + tile_w + 2, y + tile_h + 52), radius=12, fill=(30, 34, 42))
        board.paste(fit(path, (tile_w, tile_h)), (x, y))
        draw.text((x + 16, y + tile_h + 13), label, fill=(232, 234, 236), font=heading)

    lower_tiles = [
        ("V6 monitor/audio", REVIEW_DIR / "v6-previews/workstation-v6-monitor-audio-closeup.png"),
        ("V6 basecolor atlas", REVIEW_DIR / "workstation-v6-basecolor-atlas.png"),
    ]
    for idx, (label, path) in enumerate(lower_tiles):
        x = 44 + idx * 462
        y = 540
        draw.rounded_rectangle((x - 2, y - 2, x + tile_w + 2, y + tile_h + 52), radius=12, fill=(30, 34, 42))
        board.paste(fit(path, (tile_w, tile_h)), (x, y))
        draw.text((x + 16, y + tile_h + 13), label, fill=(232, 234, 236), font=heading)

    y = 540
    x = 980
    draw.text((x, y), "V6 Detail Counts", fill=(244, 238, 226), font=heading)
    y += 42
    for item in [
        f"Added {detail['detailObjectCount']} marked desktop micro-detail objects.",
        f"Total scene: {metrics['triangles']:,} triangles, {metrics['meshes']} meshes, {metrics['glbBytes'] / 1024 / 1024:.1f} MiB GLB.",
        f"LightmapUV2-ready meshes: {metrics['lightmapUv2ReadyMeshObjects']}. DetailUV meshes: {metrics['detailUvMeshObjects']}.",
        "Runtime sidecars added for coarse colliders and support surfaces.",
    ]:
        y = wrap(draw, (x, y), f"- {item}", 800, 29, (197, 204, 214), body) + 8

    y += 8
    draw.text((x, y), "Category Breakdown", fill=(244, 238, 226), font=heading)
    y += 42
    for key, value in detail["categories"].items():
        y = wrap(draw, (x, y), f"- {key}: {value}", 800, 27, (197, 204, 214), body) + 3

    draw.rounded_rectangle((44, 1308, 1856, 1482), radius=14, fill=(26, 29, 36))
    draw.text((68, 1330), "Decision", fill=(255, 210, 125), font=heading)
    decision = (
        "V6 is a visible desktop-detail pass: it keeps V5's UV fix, adds individual shape details to the devices and props, "
        "and introduces coarse runtime sidecars. It is a stronger standalone review candidate, but still needs hand-authored texture "
        "polish, true baked GI/lightmap, and approval before live scene promotion."
    )
    wrap(draw, (68, 1370), decision, 1710, 30, (226, 226, 222), body)
    draw.text((68, 1454), "Output: assets/references/blender-authored/premium-workstation-hero/workstation-v6-review-board.png", fill=(136, 148, 164), font=small)

    board.save(OUT)
    print(OUT.relative_to(ROOT))


if __name__ == "__main__":
    main()
