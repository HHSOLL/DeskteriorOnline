#!/usr/bin/env python3
"""Generate an ABKO AR108G sage-green reference prototype keyboard asset.

This is a private reference prototype for Deskterior QA.  It is authored from
primitive geometry using the Compuzone product page/reference images supplied by
the user; it is not licensed as a public catalog clone.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


ASSET_KEY = "p2s_abko_ar108g_sage_green_keyboard_v1"
REVIEW_DATE = "2026-05-21"
ASSET_REVISION = "abko-ar108g-sage-green-keyboard-v1"
PRODUCT_URL = (
    "https://www.compuzone.co.kr/product/product_detail.htm?"
    "ProductNo=1297630&BigDivNo=8&MediumDivNo=1018&DivNo=4425"
)
REFERENCE_IMAGES = [
    "https://image3.compuzone.co.kr/img/product_img/2025/1117/1297630/1297630_600.jpg",
    "https://image3.compuzone.co.kr/img/product_img/2025/1117/1297630/1297630_2_600.jpg",
    "https://image3.compuzone.co.kr/img/product_img/2025/1117/1297630/1297630_3_600.jpg",
    "https://image3.compuzone.co.kr/img/product_img/2025/1117/1297630/1297630_4_600.jpg",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-root", required=True)
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else sys.argv[1:]
    return parser.parse_args(argv)


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    bpy.context.scene.unit_settings.system = "METRIC"
    bpy.context.scene.render.engine = "BLENDER_EEVEE_NEXT"
    try:
        bpy.context.scene.eevee.taa_render_samples = 96
        bpy.context.scene.eevee.use_raytracing = True
    except Exception:
        pass
    world = bpy.context.scene.world or bpy.data.worlds.new("World")
    bpy.context.scene.world = world
    world.color = (0.018, 0.018, 0.018)


def to_blender_loc(loc: tuple[float, float, float]) -> tuple[float, float, float]:
    # R3F/Three convention in the QA scene is x/y-up/z-depth.
    # Blender is x/y-depth/z-up.
    return (loc[0], -loc[2], loc[1])


def to_blender_size(size: tuple[float, float, float]) -> tuple[float, float, float]:
    return (size[0], size[2], size[1])


def hex_to_rgba(hex_color: str, alpha: float = 1.0) -> tuple[float, float, float, float]:
    value = hex_color.strip().lstrip("#")
    return (
        int(value[0:2], 16) / 255.0,
        int(value[2:4], 16) / 255.0,
        int(value[4:6], 16) / 255.0,
        alpha,
    )


def mat(
    name: str,
    color: str,
    *,
    roughness: float,
    metalness: float = 0.0,
    alpha: float = 1.0,
    emissive: str | None = None,
    emissive_strength: float = 0.0,
) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.blend_method = "BLEND" if alpha < 1.0 else "OPAQUE"
    material.show_transparent_back = False
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = hex_to_rgba(color, alpha)
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Metallic"].default_value = metalness
        bsdf.inputs["Alpha"].default_value = alpha
        if emissive:
            bsdf.inputs["Emission Color"].default_value = hex_to_rgba(emissive, 1.0)
            bsdf.inputs["Emission Strength"].default_value = emissive_strength
    return material


def make_image_file(path: Path, name: str, width: int, height: int, painter) -> bpy.types.Image:
    image = bpy.data.images.new(name, width=width, height=height, alpha=True)
    pixels: list[float] = []
    for y in range(height):
        v = y / max(height - 1, 1)
        for x in range(width):
            u = x / max(width - 1, 1)
            pixels.extend(painter(u, v, x, y))
    image.pixels.foreach_set(pixels)
    image.filepath_raw = str(path)
    image.file_format = "PNG"
    image.save()
    image.pack()
    return image


def material_with_texture(
    name: str,
    base_image: bpy.types.Image,
    *,
    roughness: float,
    metalness: float,
) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Metallic"].default_value = metalness
        tex_base = material.node_tree.nodes.new("ShaderNodeTexImage")
        tex_base.image = base_image
        tex_base.image.colorspace_settings.name = "sRGB"
        material.node_tree.links.new(tex_base.outputs["Color"], bsdf.inputs["Base Color"])
    return material


def create_materials(texture_dir: Path, repo_root: Path) -> dict[str, bpy.types.Material]:
    texture_dir.mkdir(parents=True, exist_ok=True)

    def aluminum_painter(u: float, v: float, x: int, y: int) -> tuple[float, float, float, float]:
        grain = 0.018 * math.sin(u * math.tau * 150.0) + 0.010 * math.sin((u + v * 0.18) * math.tau * 42.0)
        base = (0.54 + grain, 0.525 + grain * 0.78, 0.495 + grain * 0.62)
        return (base[0], base[1], base[2], 1.0)

    def pbt_painter(u: float, v: float, x: int, y: int) -> tuple[float, float, float, float]:
        speckle = ((math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1.0 - 0.5) * 0.028
        edge = 0.036 * (abs(u - 0.5) + abs(v - 0.5))
        value = 0.625 + speckle - edge
        return (value, value * 0.982, value * 0.915, 1.0)

    aluminum = make_image_file(
        texture_dir / "abko_ar108g_brushed_champagne_aluminum_base.png",
        "abko_ar108g_brushed_champagne_aluminum_base",
        1024,
        256,
        aluminum_painter,
    )
    pbt = make_image_file(
        texture_dir / "abko_ar108g_pbt_warm_cream_micrograin_base.png",
        "abko_ar108g_pbt_warm_cream_micrograin_base",
        512,
        512,
        pbt_painter,
    )
    return {
        "case": material_with_texture("abko_ar108g_pbr_brushed_sage_champagne_aluminum", aluminum, roughness=0.38, metalness=0.38),
        "case_edge": mat("abko_ar108g_pbr_polished_chamfer_highlight", "#aca49a", roughness=0.38, metalness=0.42),
        "plate_shadow": mat("abko_ar108g_pbr_deep_recess_shadow", "#181b1d", roughness=0.62, metalness=0.1),
        "key_cream": material_with_texture("abko_ar108g_pbr_warm_cream_pbt_keycaps", pbt, roughness=0.76, metalness=0.0),
        "key_sage": mat("abko_ar108g_pbr_sage_green_modifier_pbt", "#515d57", roughness=0.82),
        "key_pink": mat("abko_ar108g_pbr_coral_pink_accent_pbt", "#c66d78", roughness=0.81),
        "legend": mat("abko_ar108g_pbr_dye_sub_dark_legend", "#202326", roughness=0.88),
        "sub_legend": mat("abko_ar108g_pbr_light_secondary_legend", "#f3eee8", roughness=0.88),
        "rubber": mat("abko_ar108g_pbr_soft_white_rubber_feet", "#e7e5de", roughness=0.88),
        "dark_rubber": mat("abko_ar108g_pbr_dark_rubber_switch_pad", "#2c2f2f", roughness=0.86),
        "usb": mat("abko_ar108g_pbr_black_usb_c_cutout", "#101214", roughness=0.52),
        "led_cover": mat("abko_ar108g_pbr_frosted_rgb_lightbar_cover", "#eef8f8", roughness=0.18, alpha=0.44),
        "led_red": mat("abko_ar108g_rgb_segment_coral", "#ff8fa1", roughness=0.25, emissive="#ff7992", emissive_strength=1.9),
        "led_yellow": mat("abko_ar108g_rgb_segment_warm_yellow", "#ffe18a", roughness=0.25, emissive="#ffd267", emissive_strength=1.8),
        "led_green": mat("abko_ar108g_rgb_segment_green", "#8ff2a5", roughness=0.25, emissive="#67e58b", emissive_strength=1.8),
        "led_cyan": mat("abko_ar108g_rgb_segment_cyan", "#81e7f1", roughness=0.25, emissive="#5ad8e6", emissive_strength=1.8),
        "led_blue": mat("abko_ar108g_rgb_segment_blue", "#9cb4ff", roughness=0.25, emissive="#7898ff", emissive_strength=1.8),
        "led_pink": mat("abko_ar108g_rgb_segment_pink", "#f8a2e4", roughness=0.25, emissive="#ef75d8", emissive_strength=1.8),
    }


def enable_shadow(obj: bpy.types.Object) -> None:
    if hasattr(obj, "visible_shadow"):
        obj.visible_shadow = True
    if hasattr(obj, "cast_shadow"):
        obj.cast_shadow = True
    if hasattr(obj, "receive_shadow"):
        obj.receive_shadow = True


def cube(
    name: str,
    loc: tuple[float, float, float],
    size: tuple[float, float, float],
    material: bpy.types.Material,
    *,
    bevel: float = 0.0,
    segments: int = 5,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(size=1, location=to_blender_loc(loc))
    obj = bpy.context.object
    obj.name = name
    obj.scale = to_blender_size(size)
    obj.data.materials.append(material)
    if bevel > 0:
        mod = obj.modifiers.new(name="soft bevel", type="BEVEL")
        mod.width = bevel
        mod.segments = segments
        mod.affect = "EDGES"
        obj.modifiers.new(name="weighted normals", type="WEIGHTED_NORMAL")
    enable_shadow(obj)
    return obj


def add_text(
    name: str,
    text: str,
    loc: tuple[float, float, float],
    size: float,
    material: bpy.types.Material,
    *,
    align: str = "CENTER",
    rotate_z: float = 0.0,
) -> bpy.types.Object:
    bpy.ops.object.text_add(location=to_blender_loc(loc), rotation=(0.0, 0.0, rotate_z))
    obj = bpy.context.object
    obj.name = name
    obj.data.body = text
    obj.data.align_x = align
    obj.data.align_y = "CENTER"
    obj.data.size = size
    obj.data.extrude = 0.00005
    obj.data.resolution_u = 3
    obj.data.materials.append(material)
    return obj


def keycap_mesh(
    name: str,
    loc: tuple[float, float, float],
    width: float,
    depth: float,
    height: float,
    material: bpy.types.Material,
    *,
    top_scale: float = 0.76,
    bevel: float = 0.0016,
) -> bpy.types.Object:
    bottom_x = width / 2.0
    bottom_y = depth / 2.0
    top_x = bottom_x * top_scale
    top_y = bottom_y * top_scale
    verts = [
        (-bottom_x, -bottom_y, 0.0),
        (bottom_x, -bottom_y, 0.0),
        (bottom_x, bottom_y, 0.0),
        (-bottom_x, bottom_y, 0.0),
        (-top_x, -top_y, height),
        (top_x, -top_y, height),
        (top_x, top_y, height),
        (-top_x, top_y, height),
    ]
    faces = [
        (0, 1, 2, 3),
        (4, 7, 6, 5),
        (0, 4, 5, 1),
        (1, 5, 6, 2),
        (2, 6, 7, 3),
        (3, 7, 4, 0),
    ]
    mesh = bpy.data.meshes.new(name + "Mesh")
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    obj.location = to_blender_loc(loc)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    if bevel > 0:
        mod = obj.modifiers.new(name="real keycap edge bevel", type="BEVEL")
        mod.width = bevel
        mod.segments = 5
        mod.affect = "EDGES"
        obj.modifiers.new(name="weighted normals", type="WEIGHTED_NORMAL")
    enable_shadow(obj)
    return obj


def build_keyboard(materials: dict[str, bpy.types.Material]) -> list[dict[str, object]]:
    press_targets: list[dict[str, object]] = []
    center_x = -0.285
    center_y = 0.214
    center_z = 0.155

    # Product-like low-profile aluminum body.
    cube("ABKO_AR108G_rounded_champagne_aluminum_body", (center_x, center_y, center_z), (0.468, 0.026, 0.148), materials["case"], bevel=0.0095, segments=12)
    cube("ABKO_AR108G_soft_polished_front_chamfer", (center_x, center_y + 0.009, center_z - 0.0735), (0.456, 0.006, 0.004), materials["case_edge"], bevel=0.0025, segments=6)
    cube("ABKO_AR108G_dark_recess_between_keycaps", (center_x, center_y + 0.014, center_z), (0.442, 0.004, 0.126), materials["plate_shadow"], bevel=0.0045, segments=8)
    cube("ABKO_AR108G_top_inner_beveled_lip", (center_x, center_y + 0.018, center_z), (0.456, 0.005, 0.136), materials["case_edge"], bevel=0.005, segments=8)

    # Front RGB lightbar segments under the low front edge.
    led_mats = [materials["led_red"], materials["led_yellow"], materials["led_green"], materials["led_cyan"], materials["led_blue"], materials["led_pink"]]
    led_width = 0.392 / len(led_mats)
    led_start = center_x - 0.196 + led_width / 2.0
    for index, led_mat in enumerate(led_mats):
        cube(
            f"ABKO_AR108G_front_rgb_segment_{index + 1}",
            (led_start + led_width * index, center_y + 0.003, center_z - 0.0753),
            (led_width * 0.96, 0.0022, 0.0042),
            led_mat,
            bevel=0.0014,
            segments=4,
        )
    cube("ABKO_AR108G_frosted_front_rgb_lightbar_lens", (center_x, center_y + 0.0042, center_z - 0.0755), (0.402, 0.0024, 0.005), materials["led_cover"], bevel=0.002, segments=5)

    # Top/back controls and connection details.
    cube("ABKO_AR108G_usb_c_recess_top_back_center", (center_x + 0.012, center_y + 0.0305, center_z + 0.0715), (0.034, 0.004, 0.010), materials["usb"], bevel=0.0012, segments=3)
    cube("ABKO_AR108G_2_4g_bt_status_dot", (center_x - 0.206, center_y + 0.032, center_z + 0.046), (0.003, 0.0012, 0.003), materials["led_green"], bevel=0.001, segments=3)
    add_text("ABKO_AR108G_status_text_24g_bt", "2.4G  BT", (center_x - 0.196, center_y + 0.034, center_z + 0.047), 0.0042, materials["legend"], align="LEFT")

    # Underside signature details from reference: feet, fold-out legs, receiver bay, switch strip.
    bottom_y = center_y - 0.015
    for sx in (-0.195, 0.195):
        for sz in (-0.050, 0.050):
            cube(f"ABKO_AR108G_under_soft_rubber_foot_{sx}_{sz}", (center_x + sx, bottom_y, center_z + sz), (0.030, 0.004, 0.007), materials["rubber"], bevel=0.0025, segments=6)
    cube("ABKO_AR108G_under_magnetic_receiver_bay", (center_x + 0.005, bottom_y - 0.003, center_z + 0.000), (0.044, 0.006, 0.022), materials["rubber"], bevel=0.0022, segments=5)
    cube("ABKO_AR108G_left_fold_out_tilt_leg", (center_x - 0.170, bottom_y - 0.006, center_z + 0.053), (0.034, 0.009, 0.018), materials["rubber"], bevel=0.0022, segments=5)
    cube("ABKO_AR108G_right_fold_out_tilt_leg", (center_x + 0.170, bottom_y - 0.006, center_z + 0.053), (0.034, 0.009, 0.018), materials["rubber"], bevel=0.0022, segments=5)
    cube("ABKO_AR108G_under_mode_slider_track", (center_x + 0.138, bottom_y - 0.003, center_z - 0.055), (0.080, 0.0035, 0.006), materials["dark_rubber"], bevel=0.0013, segments=3)
    cube("ABKO_AR108G_under_mode_slider_knob", (center_x + 0.116, bottom_y - 0.006, center_z - 0.055), (0.014, 0.006, 0.010), materials["key_sage"], bevel=0.0014, segments=4)

    # Key layout.  Unit sizes are physical-ish and intentionally leave cluster gaps
    # visible like the AR108G reference photos.
    unit = 0.0172
    pitch = 0.0192
    row_pitch = 0.0202
    key_bottom_y = center_y + 0.021
    key_h = 0.0105
    top_label_y = key_bottom_y + key_h + 0.00065
    x0 = center_x - 0.215
    z0 = center_z + 0.049

    accent = {"ESC", "SPACE", "UP", "LEFT", "DOWN", "RIGHT", "NUMENTER", "ENTER"}
    sage = {
        "F5", "F6", "F7", "F8", "MUTE", "VOL-", "VOL+",
        "CAPS", "LSHIFT", "RSHIFT", "LCTRL", "LWIN", "LALT", "RALT", "FN", "MENU", "RCTRL",
        "BACKSPACE", "PRT", "SCR", "PAUSE", "INS", "HOME", "PGUP", "DEL", "END", "PGDN", "NUM",
        "/", "*", "-", "+",
    }

    def material_for(code: str) -> bpy.types.Material:
        if code in accent:
            return materials["key_pink"]
        if code in sage:
            return materials["key_sage"]
        return materials["key_cream"]

    def add_key(
        code: str,
        label: str,
        col: float,
        row: float,
        *,
        w_units: float = 1.0,
        d_units: float = 1.0,
        label_size: float = 0.0051,
    ) -> None:
        w = unit * w_units + (w_units - 1.0) * (pitch - unit)
        d = unit * d_units + (d_units - 1.0) * (row_pitch - unit)
        x = x0 + col * pitch + w / 2.0 - unit / 2.0
        z = z0 - row * row_pitch
        obj = keycap_mesh(f"ABKO_AR108G_keycap_{code}", (x, key_bottom_y, z), w, d, key_h, material_for(code))
        press_targets.append({"id": f"abko-ar108g-key-{code.lower()}", "label": label, "position": [round(x, 4), round(top_label_y, 4), round(z, 4)], "size": [round(max(w * 0.82, 0.012), 4), 0.020, round(max(d * 0.82, 0.012), 4)]})
        legend_color = materials["sub_legend"] if material_for(code) in {materials["key_sage"], materials["key_pink"]} else materials["legend"]
        if label:
            add_text(f"ABKO_AR108G_legend_{code}", label, (x, top_label_y + 0.0003, z), label_size, legend_color)
        # Small front skirt shadow, visible in low camera close-ups.
        cube(f"ABKO_AR108G_keycap_front_skirt_shadow_{code}", (x, key_bottom_y + 0.0022, z - d * 0.43), (w * 0.74, 0.001, 0.0012), materials["plate_shadow"], bevel=0.0005, segments=2)
        obj["abkoAr108gPressTarget"] = f"abko-ar108g-key-{code.lower()}"

    # Function row.
    add_key("ESC", "Esc", 0, 0, label_size=0.0047)
    for i, code in enumerate(["F1", "F2", "F3", "F4"]):
        add_key(code, code, 2 + i, 0, label_size=0.0044)
    for i, code in enumerate(["F5", "F6", "F7", "F8"]):
        add_key(code, code, 7 + i, 0, label_size=0.0044)
    for i, code in enumerate(["F9", "F10", "F11", "F12"]):
        add_key(code, code, 12 + i, 0, label_size=0.0042)
    for i, code in enumerate(["PRT", "SCR", "PAUSE"]):
        add_key(code, ["Prt", "Scr", "Pause"][i], 17 + i, 0, label_size=0.0038)
    for i, code in enumerate(["MUTE", "VOL-", "VOL+"]):
        add_key(code, ["Mute", "-", "+"][i], 21 + i, 0, label_size=0.0037)

    # Main rows.
    for i, label in enumerate(["`", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-", "=", "Backspace"]):
        add_key("BACKSPACE" if label == "Backspace" else f"NUMROW_{i}", label, i if label != "Backspace" else 13, 1, w_units=2.0 if label == "Backspace" else 1.0, label_size=0.0038 if label == "Backspace" else 0.005)
    for i, label in enumerate(["Tab", "Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P", "[", "]", "\\"]):
        add_key("TAB" if label == "Tab" else f"QROW_{label}", label, 0 if label == "Tab" else 1.5 + (i - 1), 2, w_units=1.5 if label == "Tab" else 1.0, label_size=0.0045 if label == "Tab" else 0.0052)
    for i, label in enumerate(["Caps", "A", "S", "D", "F", "G", "H", "J", "K", "L", ";", "'", "Enter"]):
        add_key("CAPS" if label == "Caps" else "ENTER" if label == "Enter" else f"AROW_{label}", label, 0 if label == "Caps" else 1.75 + (i - 1), 3, w_units=1.75 if label == "Caps" else 2.25 if label == "Enter" else 1.0, label_size=0.0043 if label in {"Caps", "Enter"} else 0.0052)
    for i, label in enumerate(["Shift", "Z", "X", "C", "V", "B", "N", "M", ",", ".", "/", "Shift"]):
        add_key("LSHIFT" if i == 0 else "RSHIFT" if i == 11 else f"ZROW_{label}", label, 0 if i == 0 else 2.25 + (i - 1), 4, w_units=2.25 if i == 0 else 2.75 if i == 11 else 1.0, label_size=0.0041 if label == "Shift" else 0.0052)
    bottom_row = [
        ("LCTRL", "Ctrl", 0, 1.25),
        ("LWIN", "Win", 1.25, 1.25),
        ("LALT", "Alt", 2.5, 1.25),
        ("SPACE", "", 3.75, 6.25),
        ("RALT", "Alt", 10.0, 1.25),
        ("FN", "Fn", 11.25, 1.25),
        ("MENU", "Menu", 12.5, 1.25),
        ("RCTRL", "Ctrl", 13.75, 1.25),
    ]
    for code, label, col, w_units in bottom_row:
        add_key(code, label, col, 5, w_units=w_units, label_size=0.0042)
    add_text("ABKO_AR108G_spacebar_front_subtle_mark", "AR108G", (x0 + 6.7 * pitch, top_label_y + 0.0003, z0 - 5 * row_pitch), 0.0048, materials["sub_legend"])

    # Nav cluster.
    nav_x = 16.2
    for row, labels in enumerate([["Ins", "Home", "PgUp"], ["Del", "End", "PgDn"]]):
        for i, label in enumerate(labels):
            add_key(label.upper(), label, nav_x + i, 1 + row, label_size=0.0038)
    add_key("UP", "↑", nav_x + 1, 4, label_size=0.006)
    add_key("LEFT", "←", nav_x, 5, label_size=0.006)
    add_key("DOWN", "↓", nav_x + 1, 5, label_size=0.006)
    add_key("RIGHT", "→", nav_x + 2, 5, label_size=0.006)

    # Numpad cluster.
    num_x = 20.05
    for i, label in enumerate(["Num", "/", "*", "-"]):
        add_key("NUM" if label == "Num" else label, label, num_x + i, 1, label_size=0.0037)
    for row_offset, labels in enumerate([["7", "8", "9"], ["4", "5", "6"], ["1", "2", "3"]]):
        for i, label in enumerate(labels):
            add_key(f"NP{label}", label, num_x + i, 2 + row_offset, label_size=0.0051)
    add_key("+", "+", num_x + 3, 2, d_units=2.0, label_size=0.006)
    add_key("NUMENTER", "Enter", num_x + 3, 4, d_units=2.0, label_size=0.0038)
    add_key("NP0", "0", num_x, 5, w_units=2.0, label_size=0.0051)
    add_key("NPDOT", ".", num_x + 2, 5, label_size=0.0051)

    # Subtle Korean-layout secondary legend impression using small pale ticks.
    secondary_positions = ["QROW_Q", "QROW_W", "QROW_E", "QROW_R", "AROW_A", "AROW_S", "AROW_D", "AROW_F", "ZROW_Z", "ZROW_X", "ZROW_C", "ZROW_V"]
    for idx, code in enumerate(secondary_positions):
        x = x0 + (1.5 + (idx % 4 if idx < 4 else idx % 4)) * pitch
        row = 2 if idx < 4 else 3 if idx < 8 else 4
        z = z0 - row * row_pitch - 0.0047
        cube(f"ABKO_AR108G_secondary_hangul_stroke_{code}", (x + 0.004, top_label_y + 0.00035, z), (0.005, 0.00018, 0.0008), materials["sub_legend"], bevel=0.0002, segments=1)

    # Brand/safety labeling as prototype metadata, small enough to read in close-up.
    add_text("ABKO_AR108G_front_brand_wordmark_private_reference", "ABKO  AR108G", (center_x - 0.211, center_y + 0.011, center_z - 0.082), 0.0062, materials["sub_legend"], align="LEFT")
    add_text("ABKO_AR108G_under_mode_labels", "OFF   2.4G   BT", (center_x + 0.080, bottom_y - 0.007, center_z - 0.055), 0.0036, materials["legend"], align="LEFT")
    return press_targets


def add_lights_and_cameras(repo_root: Path, preview_dir: Path) -> None:
    def look_at(obj: bpy.types.Object, target: tuple[float, float, float]) -> None:
        direction = Vector(target) - obj.location
        obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()

    preview_target = to_blender_loc((-0.285, 0.238, 0.155))

    bpy.ops.object.light_add(type="AREA", location=(-0.35, -0.48, 0.72))
    key = bpy.context.object
    key.name = "preview_large_softbox_reflection"
    key.data.energy = 9
    key.data.size = 0.62
    bpy.ops.object.light_add(type="POINT", location=(0.05, 0.22, 0.18))
    rgb = bpy.context.object
    rgb.name = "preview_low_rgb_lightbar_bloom_hint"
    rgb.data.energy = 1.6
    rgb.data.color = (0.55, 0.88, 1.0)

    bpy.ops.object.camera_add(location=(-0.86, -0.56, 0.48))
    camera = bpy.context.object
    bpy.context.scene.camera = camera
    camera.name = "preview_camera_three_quarter_abko_ar108g"
    look_at(camera, preview_target)
    camera.data.lens = 34
    camera.data.dof.use_dof = False
    bpy.context.scene.render.resolution_x = 1600
    bpy.context.scene.render.resolution_y = 1000
    bpy.context.scene.view_settings.view_transform = "Filmic"
    bpy.context.scene.view_settings.look = "Medium High Contrast"
    bpy.context.scene.view_settings.exposure = -1.55
    bpy.context.scene.view_settings.gamma = 1
    bpy.context.scene.render.film_transparent = True
    bpy.context.scene.render.filepath = str(preview_dir / "abko-ar108g-v1-isometric.png")
    bpy.ops.render.render(write_still=True)

    camera.location = (-0.56, -0.30, 0.35)
    look_at(camera, preview_target)
    camera.data.lens = 58
    bpy.context.scene.render.filepath = str(preview_dir / "abko-ar108g-v1-keycap-closeup.png")
    bpy.ops.render.render(write_still=True)

    camera.location = (-0.30, 0.34, 0.42)
    look_at(camera, to_blender_loc((-0.285, 0.200, 0.155)))
    camera.data.lens = 42
    bpy.context.scene.render.filepath = str(preview_dir / "abko-ar108g-v1-underside.png")
    bpy.ops.render.render(write_still=True)


def export_glb(output_glb: Path) -> None:
    bpy.ops.export_scene.gltf(
        filepath=str(output_glb),
        export_format="GLB",
        export_apply=True,
        export_texcoords=True,
        export_normals=True,
        export_materials="EXPORT",
    )


def write_metadata(
    repo_root: Path,
    output_glb: Path,
    runtime_package: Path,
    review_path: Path,
    press_targets: list[dict[str, object]],
) -> None:
    runtime = {
        "assetKey": ASSET_KEY,
        "revision": ASSET_REVISION,
        "product": {
            "brand": "ABKO",
            "model": "AR108G",
            "variant": "Sage Green / frog keycap theme",
            "productNo": "1297630",
            "productUrl": PRODUCT_URL,
            "referenceDate": REVIEW_DATE,
            "source": "Compuzone product page reference images",
            "releaseEligible": False,
            "legalUse": "private_reference_only_until_brand_or_model_license_is_cleared",
        },
        "dimensionsMm": {"width": 468, "depth": 148, "height": 36},
        "placement": {
            "unit": "meters",
            "supportSurface": "desk_top",
            "pivot": "center_bottom",
            "recommendedDeskOffset": {"x": -0.285, "y": 0.214, "z": 0.155},
        },
        "switchProfiles": {
            "clicky-blue": {
                "label": "청축 Clicky",
                "forceG": 50,
                "sound": "high click jacket with plastic bottom-out",
                "defaultForThisSku": True,
            },
            "linear-red": {"label": "적축 Linear", "defaultForThisSku": False},
            "tactile-brown": {"label": "갈축 Tactile", "defaultForThisSku": False},
        },
        "pressTargets": press_targets,
        "materialSlots": [
            "brushed_sage_champagne_aluminum_body",
            "warm_cream_pbt_keycaps",
            "sage_green_modifier_pbt",
            "coral_pink_accent_pbt",
            "frosted_front_rgb_lightbar",
            "soft_white_rubber_feet",
        ],
    }
    runtime_package.write_text(json.dumps(runtime, ensure_ascii=False, indent=2), encoding="utf-8")

    review = {
        "assetKey": ASSET_KEY,
        "reviewDate": REVIEW_DATE,
        "productUrl": PRODUCT_URL,
        "referenceImages": REFERENCE_IMAGES,
        "referenceSummary": {
            "title": "[ABKO] 유,무선,블루투스 기계식, 앱코 AR108G 알루미늄 [세이지 그린]개구리",
            "spec": "유선/무선/블루투스, 키압 50G, 기계식(청축), Type-C, RGB LED 백라이트",
            "observedVisualFeatures": [
                "full-size 108-key layout with separate function/nav/arrow/numpad clusters",
                "cream/champagne rounded aluminum chassis",
                "sage green modifier keycaps and coral-pink accent keycaps",
                "low front RGB lightbar",
                "underside rubber feet, fold-out tilt legs, receiver bay, mode slider",
            ],
        },
        "qualityTargets": [
            "replace the old exposed-switch demo with a product-specific full-size keyboard silhouette",
            "close-up keycap proportions should use tapered keycap geometry rather than flat cubes",
            "procedural keycap color map and raised legend geometry should keep the sage/cream/coral ABKO AR108G identity visible without relying on a flat product-photo decal",
            "runtime press targets should cover actual keys rather than floating exposed switch samples",
            "asset remains private/prototype until manufacturer/license clearance",
        ],
        "knownGaps": [
            "exact official dimensions were not available from the product page HTML; dimensions are inferred from full-size keyboard norms and reference proportions",
            "top legends are procedural raised text rather than licensed production UV decals, so exact font/spacing is still approximate",
            "brand/model markings are prototype metadata and must be disabled or licensed before public catalog release",
            "sound is still WebAudio synthesized until recorded switch samples are licensed",
        ],
        "files": {
            "glb": str(output_glb.relative_to(repo_root)),
            "runtimePackage": str(runtime_package.relative_to(repo_root)),
        },
    }
    review_path.write_text(json.dumps(review, ensure_ascii=False, indent=2), encoding="utf-8")


def main() -> None:
    args = parse_args()
    repo_root = Path(args.repo_root).resolve()
    model_dir = repo_root / "apps/web/public/assets/models" / ASSET_KEY
    texture_dir = model_dir / "textures"
    blend_dir = repo_root / "assets/blender/deskterior"
    review_dir = repo_root / "assets/references/blender-authored/abko-ar108g-sage-green-keyboard-v1"
    preview_dir = review_dir / "previews"
    model_dir.mkdir(parents=True, exist_ok=True)
    blend_dir.mkdir(parents=True, exist_ok=True)
    review_dir.mkdir(parents=True, exist_ok=True)
    preview_dir.mkdir(parents=True, exist_ok=True)

    clear_scene()
    materials = create_materials(texture_dir, repo_root)
    press_targets = build_keyboard(materials)
    add_lights_and_cameras(repo_root, preview_dir)

    blend_path = blend_dir / f"{ASSET_KEY}.blend"
    output_glb = model_dir / f"{ASSET_KEY}.glb"
    runtime_package = model_dir / "runtime-package.json"
    review_path = review_dir / f"asset-review-{REVIEW_DATE}.json"
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
    export_glb(output_glb)
    write_metadata(repo_root, output_glb, runtime_package, review_path, press_targets)
    print(
        json.dumps(
            {
                "assetKey": ASSET_KEY,
                "blend": str(blend_path),
                "glb": str(output_glb),
                "runtimePackage": str(runtime_package),
                "review": str(review_path),
                "pressTargets": len(press_targets),
                "previews": sorted(str(path) for path in preview_dir.glob("*.png")),
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
