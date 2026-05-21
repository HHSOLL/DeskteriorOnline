#!/usr/bin/env python3
"""Build a compact review board for the v2 workstation candidate."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
REVIEW_DIR = ROOT / "assets/references/blender-authored/premium-workstation-hero"
PREVIEW_DIR = REVIEW_DIR / "v2-previews"
OUT = REVIEW_DIR / "workstation-v2-review-board.png"


def font(size: int) -> ImageFont.FreeTypeFont | ImageFont.ImageFont:
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


def fit(img: Image.Image, size: tuple[int, int]) -> Image.Image:
    copy = img.convert("RGB")
    copy.thumbnail(size, Image.Resampling.LANCZOS)
    canvas = Image.new("RGB", size, (18, 20, 24))
    canvas.paste(copy, ((size[0] - copy.width) // 2, (size[1] - copy.height) // 2))
    return canvas


def draw_wrapped(draw: ImageDraw.ImageDraw, xy: tuple[int, int], text: str, max_width: int, line_height: int, fill: tuple[int, int, int], fnt) -> int:
    x, y = xy
    line = ""
    for word in text.split():
        candidate = f"{line} {word}".strip()
        if draw.textlength(candidate, font=fnt) <= max_width:
            line = candidate
            continue
        draw.text((x, y), line, fill=fill, font=fnt)
        y += line_height
        line = word
    if line:
        draw.text((x, y), line, fill=fill, font=fnt)
        y += line_height
    return y


def main() -> None:
    images = [
        ("V2 isometric preview", PREVIEW_DIR / "workstation-v2-isometric.png"),
        ("V2 PC close-up", PREVIEW_DIR / "workstation-v2-pc-closeup.png"),
        ("V2 tabletop close-up", PREVIEW_DIR / "workstation-v2-tabletop-closeup.png"),
    ]
    board = Image.new("RGB", (1800, 1350), (12, 14, 18))
    draw = ImageDraw.Draw(board)
    title = font(42)
    heading = font(26)
    body = font(21)
    small = font(18)

    draw.text((44, 34), "Premium Workstation V2 - Asset Review Board", fill=(244, 238, 226), font=title)
    draw.text((46, 90), "Purpose: compare this standalone Blender candidate before any room-scene promotion.", fill=(174, 183, 194), font=body)

    tile_w, tile_h = 560, 430
    for idx, (label, path) in enumerate(images):
        x = 44 + idx * 588
        y = 145
        draw.rounded_rectangle((x - 2, y - 2, x + tile_w + 2, y + tile_h + 54), radius=12, fill=(30, 34, 42))
        if path.exists():
            board.paste(fit(Image.open(path), (tile_w, tile_h)), (x, y))
        else:
            draw.rectangle((x, y, x + tile_w, y + tile_h), fill=(50, 20, 20))
            draw.text((x + 30, y + 190), f"Missing: {path.name}", fill=(255, 180, 180), font=body)
        draw.text((x + 18, y + tile_h + 14), label, fill=(232, 234, 236), font=heading)

    left_x, right_x = 64, 940
    y = 675
    draw.text((left_x, y), "Reference Targets Used", fill=(244, 238, 226), font=heading)
    y += 42
    refs = [
        "Bruno Simon My Room in 3D: stylized room density, warm/cool mood, readable small props.",
        "Sketchfab game-ready desk setup (~52k triangles): dense web-ready desk/PC/prop cluster.",
        "Sketchfab modern PC desk setup (~125k triangles): clean PC tower and workstation proportions.",
        "CGTrader commercial gaming setup: UV/material/render expectation, not a web budget target.",
    ]
    for item in refs:
        y = draw_wrapped(draw, (left_x, y), f"- {item}", 780, 28, (197, 204, 214), body) + 8

    y = 675
    draw.text((right_x, y), "V2 Self-Assessment", fill=(244, 238, 226), font=heading)
    y += 42
    notes = [
        "Improved: PC tower now has layered frame/glass/mesh/internal GPU/RAM/AIO/fan detail.",
        "Improved: tabletop has cable tray, monitor arm, stitched mat, labels, cards, cable clips.",
        "Still weak: not a true authored UV atlas; material texture depth remains procedural.",
        "Still weak: needs baked AO/GI/lightmap and manual art pass before scene activation.",
    ]
    for item in notes:
        y = draw_wrapped(draw, (right_x, y), f"- {item}", 790, 28, (197, 204, 214), body) + 8

    draw.rounded_rectangle((44, 1135, 1756, 1288), radius=14, fill=(26, 29, 36))
    draw.text((68, 1158), "Promotion Gate", fill=(255, 210, 125), font=heading)
    gate = (
        "Do not activate this GLB in the room scene until human visual review approves the standalone previews. "
        "Build/type/QA pass only proves load behavior; it does not prove Bruno/commercial-level asset quality."
    )
    draw_wrapped(draw, (68, 1198), gate, 1620, 30, (226, 226, 222), body)
    draw.text((68, 1258), "Output: assets/references/blender-authored/premium-workstation-hero/workstation-v2-review-board.png", fill=(136, 148, 164), font=small)

    board.save(OUT)
    print(OUT.relative_to(ROOT))


if __name__ == "__main__":
    main()
