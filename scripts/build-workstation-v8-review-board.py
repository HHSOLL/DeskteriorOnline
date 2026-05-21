#!/usr/bin/env python3
"""Build a V8 review board comparing V7 with the product-detail pass."""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
REVIEW_DIR = ROOT / "assets/references/blender-authored/premium-workstation-hero"
OUT = REVIEW_DIR / "workstation-v8-review-board.png"


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
    review = json.loads((REVIEW_DIR / "asset-review-v8-2026-05-20.json").read_text())
    metrics = review["metrics"]
    detail = review["desktopDetailPass"]
    board = Image.new("RGB", (1900, 1580), (12, 14, 18))
    draw = ImageDraw.Draw(board)
    title = font(42)
    heading = font(25)
    body = font(20)
    small = font(17)

    draw.text((44, 34), "Premium Workstation V8 - Desk Prop Product Detail Pass", fill=(244, 238, 226), font=title)
    draw.text((46, 92), "Loop: V7 fixed tabletop seam noise. V8 adds small product cues across the desk and desktop objects.", fill=(174, 183, 194), font=body)

    tiles = [
        ("V7 tabletop baseline", REVIEW_DIR / "v7-previews/workstation-v7-tabletop-closeup.png"),
        ("V8 tabletop detail", REVIEW_DIR / "v8-previews/workstation-v8-tabletop-closeup.png"),
        ("V8 input devices", REVIEW_DIR / "v8-previews/workstation-v8-input-devices-closeup.png"),
        ("V8 isometric", REVIEW_DIR / "v8-previews/workstation-v8-isometric.png"),
    ]
    tile_w, tile_h = 430, 320
    for idx, (label, path) in enumerate(tiles):
        x = 44 + idx * 462
        y = 150
        draw.rounded_rectangle((x - 2, y - 2, x + tile_w + 2, y + tile_h + 52), radius=12, fill=(30, 34, 42))
        board.paste(fit(path, (tile_w, tile_h)), (x, y))
        draw.text((x + 16, y + tile_h + 13), label, fill=(232, 234, 236), font=heading)

    lower_tiles = [
        ("V8 monitor/audio", REVIEW_DIR / "v8-previews/workstation-v8-monitor-audio-closeup.png"),
        ("V8 basecolor atlas", REVIEW_DIR / "workstation-v8-basecolor-atlas.png"),
    ]
    for idx, (label, path) in enumerate(lower_tiles):
        x = 44 + idx * 462
        y = 540
        draw.rounded_rectangle((x - 2, y - 2, x + tile_w + 2, y + tile_h + 52), radius=12, fill=(30, 34, 42))
        board.paste(fit(path, (tile_w, tile_h)), (x, y))
        draw.text((x + 16, y + tile_h + 13), label, fill=(232, 234, 236), font=heading)

    x = 980
    y = 540
    draw.text((x, y), "V8 Evidence", fill=(244, 238, 226), font=heading)
    y += 42
    for item in [
        f"{detail['detailObjectCount']} marked desktop micro-detail objects after the product-detail pass.",
        f"Scene: {metrics['triangles']:,} triangles, {metrics['meshes']} meshes, {metrics['glbBytes'] / 1024 / 1024:.1f} MiB GLB.",
        f"LightmapUV2-ready meshes: {metrics['lightmapUv2ReadyMeshObjects']}. DetailUV meshes: {metrics['detailUvMeshObjects']}.",
        "Adds product seams, fasteners, screen UI layers, case vents, IO marks, cable grommet, and prop material cues.",
    ]:
        y = wrap(draw, (x, y), f"- {item}", 800, 29, (197, 204, 214), body) + 8

    y += 8
    draw.text((x, y), "Still Not Approval", fill=(244, 238, 226), font=heading)
    y += 42
    for item in [
        "Procedural materials still need hand texture polish or a stronger authored atlas.",
        "The desk asset is standalone; full room lighting/context integration is still pending.",
        "Runtime LOD/proxy packaging is needed before replacing the active QA room scene.",
        "Human review against reference/commercial assets is still required.",
    ]:
        y = wrap(draw, (x, y), f"- {item}", 800, 29, (197, 204, 214), body) + 8

    draw.rounded_rectangle((44, 1308, 1856, 1482), radius=14, fill=(26, 29, 36))
    draw.text((68, 1330), "Decision", fill=(255, 210, 125), font=heading)
    decision = (
        "V8 is the strongest desk/desktop-object candidate in this loop: it keeps the V7 tabletop fix and adds product-scale details "
        "that were missing from the keyboard, mouse, monitor, speakers, PC case, desk, and tabletop props."
    )
    wrap(draw, (68, 1370), decision, 1710, 30, (226, 226, 222), body)
    draw.text((68, 1454), "Output: assets/references/blender-authored/premium-workstation-hero/workstation-v8-review-board.png", fill=(136, 148, 164), font=small)

    board.save(OUT)
    print(OUT.relative_to(ROOT))


if __name__ == "__main__":
    main()
