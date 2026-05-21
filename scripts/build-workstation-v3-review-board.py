#!/usr/bin/env python3
"""Build a review board comparing rejected v2 against current v3."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
REVIEW_DIR = ROOT / "assets/references/blender-authored/premium-workstation-hero"
OUT = REVIEW_DIR / "workstation-v3-review-board.png"


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
    board = Image.new("RGB", (1800, 1380), (12, 14, 18))
    draw = ImageDraw.Draw(board)
    title = font(42)
    heading = font(26)
    body = font(21)
    small = font(18)

    draw.text((44, 34), "Premium Workstation V3 - Regeneration Review", fill=(244, 238, 226), font=title)
    draw.text((46, 92), "Loop: v2 rejected -> diagnosed -> v3 regenerated as standalone candidate. Still not scene-promoted.", fill=(174, 183, 194), font=body)

    tiles = [
        ("Rejected V2", REVIEW_DIR / "v2-previews/workstation-v2-isometric.png"),
        ("Current V3", REVIEW_DIR / "v3-previews/workstation-v3-isometric.png"),
        ("V3 PC close-up", REVIEW_DIR / "v3-previews/workstation-v3-pc-closeup.png"),
        ("V3 tabletop close-up", REVIEW_DIR / "v3-previews/workstation-v3-tabletop-closeup.png"),
    ]
    tile_w, tile_h = 410, 310
    for idx, (label, path) in enumerate(tiles):
        x = 44 + idx * 436
        y = 150
        draw.rounded_rectangle((x - 2, y - 2, x + tile_w + 2, y + tile_h + 52), radius=12, fill=(30, 34, 42))
        board.paste(fit(path, (tile_w, tile_h)), (x, y))
        draw.text((x + 16, y + tile_h + 13), label, fill=(232, 234, 236), font=heading)

    y = 560
    draw.text((64, y), "What Changed From V2", fill=(244, 238, 226), font=heading)
    y += 42
    for item in [
        "Removed generated texture materials from large visible planes to avoid magenta fallback-like output.",
        "Rebuilt PC front as satin white frame + graphite mesh insert + subdued cyan fans.",
        "Changed oversized neon desk mat into charcoal mat with geometry stitch lines.",
        "Replaced screen texture dependence with explicit muted UI geometry bars.",
    ]:
        y = wrap(draw, (64, y), f"- {item}", 760, 29, (197, 204, 214), body) + 8

    y = 560
    draw.text((930, y), "Remaining Problems", fill=(244, 238, 226), font=heading)
    y += 42
    for item in [
        "Still too procedural; not yet a hand-authored commercial asset.",
        "Needs real UV atlas, normal/roughness/AO texture pass, and baked lighting.",
        "PC internals are readable but not product-accurate enough for close inspection.",
        "Must pass human side-by-side review before any room integration.",
    ]:
        y = wrap(draw, (930, y), f"- {item}", 780, 29, (197, 204, 214), body) + 8

    draw.rounded_rectangle((44, 1168, 1756, 1308), radius=14, fill=(26, 29, 36))
    draw.text((68, 1190), "Decision", fill=(255, 210, 125), font=heading)
    wrap(
        draw,
        (68, 1230),
        "V3 is materially better than v2 in color discipline and readability, but it remains a review candidate. It should not be active in the user-facing room until texture/bake/detail quality is approved.",
        1620,
        30,
        (226, 226, 222),
        body,
    )
    draw.text((68, 1288), "Output: assets/references/blender-authored/premium-workstation-hero/workstation-v3-review-board.png", fill=(136, 148, 164), font=small)
    board.save(OUT)
    print(OUT.relative_to(ROOT))


if __name__ == "__main__":
    main()
