#!/usr/bin/env python3
"""Build a v5 review board showing the UVAtlas material fix."""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
REVIEW_DIR = ROOT / "assets/references/blender-authored/premium-workstation-hero"
OUT = REVIEW_DIR / "workstation-v5-review-board.png"


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


def wrap(draw, xy, text, width, line_height, fill, fnt):
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
    review = json.loads((REVIEW_DIR / "asset-review-v5-2026-05-20.json").read_text())
    metrics = review["metrics"]
    board = Image.new("RGB", (1900, 1500), (12, 14, 18))
    draw = ImageDraw.Draw(board)
    title = font(42)
    heading = font(25)
    body = font(20)
    small = font(17)

    draw.text((44, 34), "Premium Workstation V5 - UVAtlas Visual Fix Review", fill=(244, 238, 226), font=title)
    draw.text(
        (46, 92),
        "Loop: V4 solved package metadata but introduced visible atlas patchwork. V5 fixes the shader/UV channel issue.",
        fill=(174, 183, 194),
        font=body,
    )

    tiles = [
        ("V4 defective atlas sampling", REVIEW_DIR / "v4-previews/workstation-v4-isometric.png"),
        ("Current V5", REVIEW_DIR / "v5-previews/workstation-v5-isometric.png"),
        ("V5 PC internals", REVIEW_DIR / "v5-previews/workstation-v5-pc-internals-closeup.png"),
        ("V5 basecolor atlas", REVIEW_DIR / "workstation-v5-basecolor-atlas.png"),
    ]
    tile_w, tile_h = 430, 320
    for idx, (label, path) in enumerate(tiles):
        x = 44 + idx * 462
        y = 150
        draw.rounded_rectangle((x - 2, y - 2, x + tile_w + 2, y + tile_h + 52), radius=12, fill=(30, 34, 42))
        board.paste(fit(path, (tile_w, tile_h)), (x, y))
        draw.text((x + 16, y + tile_h + 13), label, fill=(232, 234, 236), font=heading)

    y = 560
    draw.text((64, y), "Fixed In V5", fill=(244, 238, 226), font=heading)
    y += 42
    for item in [
        "The shared material uses an explicit UV Map node bound to UVAtlas.",
        f"UVAtlas is active/render-active on {metrics['activeUvAtlasMeshObjects']} mesh objects.",
        f"LightmapUV2 remains available on {metrics['lightmapUv2ReadyMeshObjects']} mesh objects.",
        f"{metrics['bakedContactAoDecals']} baked-style contact AO decals and V4's richer PC internals are preserved.",
    ]:
        y = wrap(draw, (64, y), f"- {item}", 820, 29, (197, 204, 214), body) + 8

    y = 560
    draw.text((980, y), "Remaining Problems", fill=(244, 238, 226), font=heading)
    y += 42
    for item in [
        "This is still generated procedural texture work, not a hand-painted commercial atlas.",
        "AO is contact-authored; full scene GI/lightmap baking remains a separate pass.",
        "PC internals are product-inspired, not exact manufacturer CAD or scanned geometry.",
        "LOD/proxy/collider/support metadata still required before promotion into the live room.",
    ]:
        y = wrap(draw, (980, y), f"- {item}", 800, 29, (197, 204, 214), body) + 8

    draw.rounded_rectangle((44, 1190, 1856, 1380), radius=14, fill=(26, 29, 36))
    draw.text((68, 1214), "Decision", fill=(255, 210, 125), font=heading)
    decision = (
        f"V5 fixes the V4 atlas sampling bug while preserving the core package work: {metrics['triangles']:,} triangles, "
        f"{metrics['textureImages']} texture images, {metrics['glbBytes'] / 1024 / 1024:.1f} MiB GLB, "
        f"{metrics['atlasAssignedMeshObjects']} atlas-assigned meshes, and {metrics['activeUvAtlasMeshObjects']} active UVAtlas meshes. "
        "It is improved, but remains standalone review-only until visual approval."
    )
    wrap(draw, (68, 1254), decision, 1710, 30, (226, 226, 222), body)
    draw.text((68, 1354), "Output: assets/references/blender-authored/premium-workstation-hero/workstation-v5-review-board.png", fill=(136, 148, 164), font=small)

    board.save(OUT)
    print(OUT.relative_to(ROOT))


if __name__ == "__main__":
    main()
