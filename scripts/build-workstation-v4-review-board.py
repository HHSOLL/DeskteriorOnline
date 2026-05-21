#!/usr/bin/env python3
"""Build a v4 review board focused on UV/PBR/AO and PC internals."""

from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
REVIEW_DIR = ROOT / "assets/references/blender-authored/premium-workstation-hero"
OUT = REVIEW_DIR / "workstation-v4-review-board.png"


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
    review = json.loads((REVIEW_DIR / "asset-review-v4-2026-05-20.json").read_text())
    metrics = review["metrics"]
    board = Image.new("RGB", (1900, 1500), (12, 14, 18))
    draw = ImageDraw.Draw(board)
    title = font(42)
    heading = font(25)
    body = font(20)
    small = font(17)

    draw.text((44, 34), "Premium Workstation V4 - UV/PBR/AO/Internal Detail Review", fill=(244, 238, 226), font=title)
    draw.text((46, 92), "Loop: v3 defects targeted directly. This is still a standalone review candidate, not scene-promoted.", fill=(174, 183, 194), font=body)

    tiles = [
        ("Previous V3", REVIEW_DIR / "v3-previews/workstation-v3-isometric.png"),
        ("Current V4", REVIEW_DIR / "v4-previews/workstation-v4-isometric.png"),
        ("V4 PC internals", REVIEW_DIR / "v4-previews/workstation-v4-pc-internals-closeup.png"),
        ("V4 basecolor atlas", REVIEW_DIR / "workstation-v4-basecolor-atlas.png"),
    ]
    tile_w, tile_h = 430, 320
    for idx, (label, path) in enumerate(tiles):
        x = 44 + idx * 462
        y = 150
        draw.rounded_rectangle((x - 2, y - 2, x + tile_w + 2, y + tile_h + 52), radius=12, fill=(30, 34, 42))
        board.paste(fit(path, (tile_w, tile_h)), (x, y))
        draw.text((x + 16, y + tile_h + 13), label, fill=(232, 234, 236), font=heading)

    y = 560
    draw.text((64, y), "V4 Improvements", fill=(244, 238, 226), font=heading)
    y += 42
    for item in [
        f"Shared UV/PBR atlas assigned to {metrics['atlasAssignedMeshObjects']} primary mesh objects.",
        f"LightmapUV2 exists on {metrics['lightmapUv2ReadyMeshObjects']} mesh objects.",
        f"Added {metrics['bakedContactAoDecals']} baked-style contact AO decals for grounding.",
        "PC internals now include AM5 socket, DDR5 slots/RAM, M.2, VRM, RTX-style GPU, AIO pump/tubes/radiator, PSU shroud, and routed cable sleeves.",
    ]:
        y = wrap(draw, (64, y), f"- {item}", 820, 29, (197, 204, 214), body) + 8

    y = 560
    draw.text((980, y), "Remaining Problems", fill=(244, 238, 226), font=heading)
    y += 42
    for item in [
        "Atlas is generated and structured, not hand-painted by a production texture artist.",
        "AO is baked-style/contact authored; a full static GI bake still needs a renderer bake pass if required.",
        "Internals are product-inspired and more accurate, but not exact manufacturer CAD.",
        "LOD/proxy/collider/support metadata still required before catalog promotion.",
    ]:
        y = wrap(draw, (980, y), f"- {item}", 800, 29, (197, 204, 214), body) + 8

    draw.rounded_rectangle((44, 1190, 1856, 1380), radius=14, fill=(26, 29, 36))
    draw.text((68, 1214), "Decision", fill=(255, 210, 125), font=heading)
    decision = (
        f"V4 materially addresses v3's core technical gaps: {metrics['triangles']:,} triangles, "
        f"{metrics['textureImages']} packed/linked texture images, {metrics['glbBytes'] / 1024 / 1024:.1f} MiB GLB, "
        f"and explicit UV/UV2 coverage. It should still remain review-only until visual approval and runtime package work are complete."
    )
    wrap(draw, (68, 1254), decision, 1710, 30, (226, 226, 222), body)
    draw.text((68, 1354), "Output: assets/references/blender-authored/premium-workstation-hero/workstation-v4-review-board.png", fill=(136, 148, 164), font=small)

    board.save(OUT)
    print(OUT.relative_to(ROOT))


if __name__ == "__main__":
    main()
