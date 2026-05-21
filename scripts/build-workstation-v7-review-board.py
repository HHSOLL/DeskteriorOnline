#!/usr/bin/env python3
"""Build a v7 review board comparing V6 seam regression with V7."""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
REVIEW_DIR = ROOT / "assets/references/blender-authored/premium-workstation-hero"
OUT = REVIEW_DIR / "workstation-v7-review-board.png"


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
    review = json.loads((REVIEW_DIR / "asset-review-v7-2026-05-20.json").read_text())
    metrics = review["metrics"]
    detail = review["desktopDetailPass"]
    board = Image.new("RGB", (1900, 1580), (12, 14, 18))
    draw = ImageDraw.Draw(board)
    title = font(42)
    heading = font(25)
    body = font(20)
    small = font(17)

    draw.text((44, 34), "Premium Workstation V7 - Desktop Seam Regression Fix", fill=(244, 238, 226), font=title)
    draw.text((46, 92), "Loop: V6 added detail but over-drew the tabletop seams. V7 keeps detail and lowers the seam noise.", fill=(174, 183, 194), font=body)

    tiles = [
        ("V6 seam regression", REVIEW_DIR / "v6-previews/workstation-v6-tabletop-closeup.png"),
        ("V7 tabletop", REVIEW_DIR / "v7-previews/workstation-v7-tabletop-closeup.png"),
        ("V7 input devices", REVIEW_DIR / "v7-previews/workstation-v7-input-devices-closeup.png"),
        ("V7 isometric", REVIEW_DIR / "v7-previews/workstation-v7-isometric.png"),
    ]
    tile_w, tile_h = 430, 320
    for idx, (label, path) in enumerate(tiles):
        x = 44 + idx * 462
        y = 150
        draw.rounded_rectangle((x - 2, y - 2, x + tile_w + 2, y + tile_h + 52), radius=12, fill=(30, 34, 42))
        board.paste(fit(path, (tile_w, tile_h)), (x, y))
        draw.text((x + 16, y + tile_h + 13), label, fill=(232, 234, 236), font=heading)

    lower_tiles = [
        ("V7 monitor/audio", REVIEW_DIR / "v7-previews/workstation-v7-monitor-audio-closeup.png"),
        ("V7 basecolor atlas", REVIEW_DIR / "workstation-v7-basecolor-atlas.png"),
    ]
    for idx, (label, path) in enumerate(lower_tiles):
        x = 44 + idx * 462
        y = 540
        draw.rounded_rectangle((x - 2, y - 2, x + tile_w + 2, y + tile_h + 52), radius=12, fill=(30, 34, 42))
        board.paste(fit(path, (tile_w, tile_h)), (x, y))
        draw.text((x + 16, y + tile_h + 13), label, fill=(232, 234, 236), font=heading)

    x = 980
    y = 540
    draw.text((x, y), "V7 Evidence", fill=(244, 238, 226), font=heading)
    y += 42
    for item in [
        f"Retains {detail['detailObjectCount']} marked desktop micro-detail objects.",
        f"Scene: {metrics['triangles']:,} triangles, {metrics['meshes']} meshes, {metrics['glbBytes'] / 1024 / 1024:.1f} MiB GLB.",
        f"LightmapUV2-ready meshes: {metrics['lightmapUv2ReadyMeshObjects']}. DetailUV meshes: {metrics['detailUvMeshObjects']}.",
        "Cross-grid tabletop seams removed; remaining seams are low-contrast longitudinal lines.",
    ]:
        y = wrap(draw, (x, y), f"- {item}", 800, 29, (197, 204, 214), body) + 8

    y += 8
    draw.text((x, y), "Still Not Approval", fill=(244, 238, 226), font=heading)
    y += 42
    for item in [
        "Texture atlas is still generated/procedural, not hand-painted.",
        "GI/lightmap is not a full renderer bake.",
        "Runtime proxy GLB/LOD package is still pending.",
        "Live scene integration is intentionally blocked until standalone approval.",
    ]:
        y = wrap(draw, (x, y), f"- {item}", 800, 29, (197, 204, 214), body) + 8

    draw.rounded_rectangle((44, 1308, 1856, 1482), radius=14, fill=(26, 29, 36))
    draw.text((68, 1330), "Decision", fill=(255, 210, 125), font=heading)
    decision = (
        "V7 fixes the obvious V6 tabletop seam regression while preserving the per-object desk detail work. "
        "This is the best workstation candidate in this loop, but it remains standalone review-only rather than a live commercial asset."
    )
    wrap(draw, (68, 1370), decision, 1710, 30, (226, 226, 222), body)
    draw.text((68, 1454), "Output: assets/references/blender-authored/premium-workstation-hero/workstation-v7-review-board.png", fill=(136, 148, 164), font=small)

    board.save(OUT)
    print(OUT.relative_to(ROOT))


if __name__ == "__main__":
    main()
