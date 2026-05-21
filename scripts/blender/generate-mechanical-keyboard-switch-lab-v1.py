#!/usr/bin/env python3
"""Generate a self-authored mechanical keyboard and switch sampler asset.

The asset is not a branded product copy. It uses public switch construction and
official MX-style switch data as proportion/reference input, then creates a
generic compact mechanical keyboard with exposed linear/clicky/tactile switch
samples for the Deskterior QA scene.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


ASSET_KEY = "p2s_mechanical_keyboard_switch_lab_v1"
REVIEW_DATE = "2026-05-21"
ASSET_REVISION = "mechanical-keyboard-switch-lab-v1"

SWITCH_PROFILES = {
    "linear-red": {
        "label": "Linear Red",
        "stemColor": "#d3413f",
        "forceCN": 45,
        "preTravelMm": 2.0,
        "totalTravelMm": 4.0,
        "sound": "soft linear bottom-out, no click leaf",
    },
    "clicky-blue": {
        "label": "Clicky Blue",
        "stemColor": "#3c7edb",
        "forceCN": 60,
        "preTravelMm": 2.2,
        "totalTravelMm": 4.0,
        "sound": "sharp click jacket plus bottom-out",
    },
    "tactile-brown": {
        "label": "Tactile Brown",
        "stemColor": "#a96e43",
        "forceCN": 55,
        "preTravelMm": 2.0,
        "totalTravelMm": 4.0,
        "sound": "soft tactile bump with muted bottom-out",
    },
}


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
    world.color = (0.012, 0.014, 0.018)


def to_blender_loc(loc: tuple[float, float, float]) -> tuple[float, float, float]:
    return (loc[0], -loc[2], loc[1])


def to_blender_size(size: tuple[float, float, float]) -> tuple[float, float, float]:
    return (size[0], size[2], size[1])


def fract(value: float) -> float:
    return value - math.floor(value)


def hash2(ix: int, iy: int) -> float:
    return fract(math.sin(ix * 127.1 + iy * 311.7) * 43758.5453123)


def smoothstep(value: float) -> float:
    return value * value * (3.0 - 2.0 * value)


def value_noise(x: float, y: float) -> float:
    ix = math.floor(x)
    iy = math.floor(y)
    fx = smoothstep(x - ix)
    fy = smoothstep(y - iy)
    a = hash2(ix, iy)
    b = hash2(ix + 1, iy)
    c = hash2(ix, iy + 1)
    d = hash2(ix + 1, iy + 1)
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy


def fbm(x: float, y: float, octaves: int = 5) -> float:
    value = 0.0
    amplitude = 0.5
    frequency = 1.0
    total = 0.0
    for _ in range(octaves):
        value += value_noise(x * frequency, y * frequency) * amplitude
        total += amplitude
        amplitude *= 0.52
        frequency *= 2.03
    return value / max(total, 0.0001)


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


def keycap_base(u: float, v: float, x: int, y: int) -> tuple[float, float, float, float]:
    speckle = (hash2(x, y) - 0.5) * 0.018
    edge_wear = 0.026 * (abs(u - 0.5) + abs(v - 0.5))
    dish = 0.035 * max(0.0, 1.0 - ((u - 0.5) ** 2 + (v - 0.5) ** 2) * 7.0)
    value = 0.78 + speckle - edge_wear + dish
    return (value, value + 0.018, value + 0.035, 1.0)


def pbt_roughness(u: float, v: float, x: int, y: int) -> tuple[float, float, float, float]:
    rough = max(0.0, min(1.0, 0.73 + fbm(u * 56.0, v * 56.0, 4) * 0.14 + (hash2(x, y) - 0.5) * 0.02))
    return (rough, rough, rough, 1.0)


def brushed_aluminum_base(u: float, v: float, x: int, y: int) -> tuple[float, float, float, float]:
    grain = 0.035 * math.sin(u * math.tau * 110.0) + fbm(u * 24.0, v * 8.0, 4) * 0.035
    return (0.54 + grain, 0.58 + grain * 0.82, 0.61 + grain * 0.72, 1.0)


def switch_polycarbonate_base(u: float, v: float, x: int, y: int) -> tuple[float, float, float, float]:
    micro = fbm(u * 42.0, v * 42.0, 3) * 0.018
    return (0.78 + micro, 0.86 + micro, 0.93 + micro, 0.36)


def material_with_maps(
    name: str,
    base_image: bpy.types.Image,
    roughness_image: bpy.types.Image,
    *,
    roughness: float,
    metalness: float = 0.0,
    alpha: float = 1.0,
    bump_image: bpy.types.Image | None = None,
    bump_strength: float = 0.025,
) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.blend_method = "BLEND" if alpha < 1.0 else "OPAQUE"
    material.show_transparent_back = False
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Metallic"].default_value = metalness
        bsdf.inputs["Alpha"].default_value = alpha
        tex_base = material.node_tree.nodes.new("ShaderNodeTexImage")
        tex_base.image = base_image
        tex_base.image.colorspace_settings.name = "sRGB"
        material.node_tree.links.new(tex_base.outputs["Color"], bsdf.inputs["Base Color"])
        tex_rough = material.node_tree.nodes.new("ShaderNodeTexImage")
        tex_rough.image = roughness_image
        tex_rough.image.colorspace_settings.name = "Non-Color"
        material.node_tree.links.new(tex_rough.outputs["Color"], bsdf.inputs["Roughness"])
        if bump_image:
            tex_bump = material.node_tree.nodes.new("ShaderNodeTexImage")
            tex_bump.image = bump_image
            tex_bump.image.colorspace_settings.name = "Non-Color"
            bump = material.node_tree.nodes.new("ShaderNodeBump")
            bump.inputs["Strength"].default_value = bump_strength
            bump.inputs["Distance"].default_value = 0.008
            material.node_tree.links.new(tex_bump.outputs["Color"], bump.inputs["Height"])
            material.node_tree.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    return material


def mat(
    name: str,
    color: tuple[float, float, float, float],
    roughness: float,
    metalness: float = 0.0,
    alpha: float = 1.0,
    emissive: tuple[float, float, float, float] | None = None,
    emissive_strength: float = 0.0,
) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.blend_method = "BLEND" if alpha < 1.0 else "OPAQUE"
    material.show_transparent_back = False
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = color
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Metallic"].default_value = metalness
        bsdf.inputs["Alpha"].default_value = alpha
        if emissive:
            bsdf.inputs["Emission Color"].default_value = emissive
            bsdf.inputs["Emission Strength"].default_value = emissive_strength
    return material


def enable_shadow(obj: bpy.types.Object) -> None:
    if hasattr(obj, "visible_shadow"):
        obj.visible_shadow = True
    if hasattr(obj, "cast_shadow"):
        obj.cast_shadow = True
    if hasattr(obj, "receive_shadow"):
        obj.receive_shadow = True


def create_materials(texture_dir: Path) -> dict[str, bpy.types.Material]:
    texture_dir.mkdir(parents=True, exist_ok=True)
    key_base = make_image_file(texture_dir / "keyboard_pbt_keycap_base.png", "keyboard_pbt_keycap_base", 512, 512, keycap_base)
    key_rough = make_image_file(texture_dir / "keyboard_pbt_keycap_roughness.png", "keyboard_pbt_keycap_roughness", 512, 512, pbt_roughness)
    aluminum_base = make_image_file(texture_dir / "keyboard_brushed_aluminum_base.png", "keyboard_brushed_aluminum_base", 512, 256, brushed_aluminum_base)
    aluminum_rough = make_image_file(texture_dir / "keyboard_brushed_aluminum_roughness.png", "keyboard_brushed_aluminum_roughness", 512, 256, lambda u, v, x, y: (0.42, 0.42, 0.42, 1.0))
    pc_base = make_image_file(texture_dir / "keyboard_switch_polycarbonate_base.png", "keyboard_switch_polycarbonate_base", 256, 256, switch_polycarbonate_base)
    pc_rough = make_image_file(texture_dir / "keyboard_switch_polycarbonate_roughness.png", "keyboard_switch_polycarbonate_roughness", 256, 256, lambda u, v, x, y: (0.22, 0.22, 0.22, 1.0))
    return {
        "aluminum": material_with_maps("keyboard_pbr_brushed_cool_aluminum", aluminum_base, aluminum_rough, roughness=0.42, metalness=0.74),
        "plate": mat("keyboard_pbr_black_anodized_switch_plate", (0.018, 0.021, 0.026, 1.0), 0.48, 0.48),
        "pcb": mat("keyboard_pbr_dark_green_pcb_with_soldermask", (0.012, 0.09, 0.07, 1.0), 0.54, 0.0),
        "keycap": material_with_maps("keyboard_pbr_warm_white_pbt_micro_grain", key_base, key_rough, roughness=0.75),
        "accent": mat("keyboard_pbr_muted_peach_accent_keycap", (0.86, 0.58, 0.48, 1.0), 0.72, 0.0),
        "legend": mat("keyboard_pbr_dark_grey_dye_sub_legend", (0.11, 0.13, 0.15, 1.0), 0.8, 0.0),
        "rubber": mat("keyboard_pbr_soft_black_rubber_feet", (0.01, 0.012, 0.014, 1.0), 0.82, 0.0),
        "polycarbonate": material_with_maps(
            "keyboard_pbr_clear_switch_polycarbonate_housing",
            pc_base,
            pc_rough,
            roughness=0.22,
            alpha=0.42,
        ),
        "spring": mat("keyboard_pbr_stainless_switch_spring", (0.82, 0.82, 0.78, 1.0), 0.28, 0.78),
        "contact": mat("keyboard_pbr_gold_leaf_contact", (1.0, 0.68, 0.22, 1.0), 0.32, 0.86),
        "stem_red": mat("keyboard_switch_linear_red_stem", (0.72, 0.08, 0.07, 1.0), 0.46, 0.0),
        "stem_blue": mat("keyboard_switch_clicky_blue_stem", (0.08, 0.26, 0.78, 1.0), 0.44, 0.0),
        "stem_brown": mat("keyboard_switch_tactile_brown_stem", (0.48, 0.24, 0.1, 1.0), 0.48, 0.0),
        "rgb": mat("keyboard_low_level_rgb_diffuser", (0.55, 0.74, 1.0, 1.0), 0.38, 0.0, emissive=(0.4, 0.65, 1.0, 1.0), emissive_strength=0.45),
    }


def rounded_block(
    name: str,
    size: tuple[float, float, float],
    loc: tuple[float, float, float],
    material: bpy.types.Material,
    radius: float,
    segments: int = 4,
    rotation_y: float = 0.0,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=to_blender_loc(loc), rotation=(0.0, -rotation_y, 0.0))
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = to_blender_size(size)
    obj.data.materials.append(material)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if radius > 0:
        bevel = obj.modifiers.new(name="controlled small bevels", type="BEVEL")
        bevel.width = radius
        bevel.segments = segments
        bevel.affect = "EDGES"
        obj.modifiers.new(name="weighted normals", type="WEIGHTED_NORMAL")
    enable_shadow(obj)
    return obj


def keycap_mesh(
    name: str,
    size: tuple[float, float, float],
    loc: tuple[float, float, float],
    material: bpy.types.Material,
    *,
    pressed: bool = False,
    rotation_y: float = -0.035,
) -> bpy.types.Object:
    width, height, depth = size
    top_inset_x = min(width * 0.17, 0.004)
    top_inset_z = min(depth * 0.16, 0.004)
    bottom_y = -height / 2
    top_y = height / 2
    verts_runtime = [
        (-width / 2, bottom_y, -depth / 2),
        (width / 2, bottom_y, -depth / 2),
        (width / 2, bottom_y, depth / 2),
        (-width / 2, bottom_y, depth / 2),
        (-width / 2 + top_inset_x, top_y, -depth / 2 + top_inset_z),
        (width / 2 - top_inset_x, top_y, -depth / 2 + top_inset_z),
        (width / 2 - top_inset_x, top_y, depth / 2 - top_inset_z),
        (-width / 2 + top_inset_x, top_y, depth / 2 - top_inset_z),
    ]
    verts = [to_blender_loc((loc[0] + x, loc[1] + y - (0.004 if pressed else 0.0), loc[2] + z)) for x, y, z in verts_runtime]
    faces = [(0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.rotation_euler = (0.0, -rotation_y, 0.0)
    obj.data.materials.append(material)
    bevel = obj.modifiers.new(name="rounded pbt edges", type="BEVEL")
    bevel.width = 0.0018
    bevel.segments = 3
    obj.modifiers.new(name="weighted normals", type="WEIGHTED_NORMAL")
    enable_shadow(obj)
    return obj


def add_key_legend(name: str, label: str, loc: tuple[float, float, float], material: bpy.types.Material, size: float = 0.006) -> None:
    bpy.ops.object.text_add(location=to_blender_loc(loc), rotation=(0.0, 0.0, 0.0))
    obj = bpy.context.object
    obj.name = name
    obj.data.body = label
    obj.data.align_x = "CENTER"
    obj.data.align_y = "CENTER"
    obj.data.size = size
    obj.data.extrude = 0.00008
    obj.data.materials.append(material)


def cylinder_y(name: str, radius: float, depth: float, loc: tuple[float, float, float], material: bpy.types.Material, vertices: int = 40) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=to_blender_loc(loc), rotation=(math.pi / 2, 0.0, 0.0))
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(material)
    obj.modifiers.new(name="weighted normals", type="WEIGHTED_NORMAL")
    enable_shadow(obj)
    return obj


def cable_curve(name: str, points: list[tuple[float, float, float]], material: bpy.types.Material, bevel_depth: float) -> bpy.types.Object:
    curve = bpy.data.curves.new(name, type="CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 16
    curve.bevel_depth = bevel_depth
    curve.bevel_resolution = 3
    spline = curve.splines.new("POLY")
    spline.points.add(len(points) - 1)
    for point, src in zip(spline.points, points):
        point.co = (*to_blender_loc(src), 1.0)
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    enable_shadow(obj)
    return obj


def switch_spring(name: str, loc: tuple[float, float, float], material: bpy.types.Material) -> None:
    points: list[tuple[float, float, float]] = []
    radius = 0.0046
    height = 0.014
    turns = 5.2
    steps = 96
    for idx in range(steps + 1):
        t = idx / steps
        angle = t * math.tau * turns
        points.append((loc[0] + math.cos(angle) * radius, loc[1] - height / 2 + t * height, loc[2] + math.sin(angle) * radius))
    cable_curve(name, points, material, 0.00055)


def add_switch_sample(
    slug: str,
    loc: tuple[float, float, float],
    stem_material: bpy.types.Material,
    materials: dict[str, bpy.types.Material],
    *,
    pressed: bool = False,
) -> None:
    x, y, z = loc
    rounded_block(f"keyboard_switch_{slug}_bottom_housing_frosted_base", (0.019, 0.008, 0.019), (x, y, z), materials["polycarbonate"], 0.0022, 3)
    rounded_block(f"keyboard_switch_{slug}_transparent_top_housing", (0.0205, 0.011, 0.0205), (x, y + 0.009, z), materials["polycarbonate"], 0.0024, 3)
    stem_y = y + 0.019 - (0.0035 if pressed else 0.0)
    rounded_block(f"keyboard_switch_{slug}_stem_cross_horizontal", (0.014, 0.0038, 0.0042), (x, stem_y, z), stem_material, 0.0009, 1)
    rounded_block(f"keyboard_switch_{slug}_stem_cross_vertical", (0.0042, 0.0038, 0.014), (x, stem_y, z), stem_material, 0.0009, 1)
    rounded_block(f"keyboard_switch_{slug}_center_slider", (0.007, 0.011, 0.007), (x, y + 0.010, z), stem_material, 0.0012, 1)
    switch_spring(f"keyboard_switch_{slug}_visible_coil_spring", (x, y + 0.005, z), materials["spring"])
    rounded_block(f"keyboard_switch_{slug}_gold_contact_leaf_left", (0.0012, 0.013, 0.004), (x - 0.0064, y + 0.006, z + 0.005), materials["contact"], 0.0002, 1)
    rounded_block(f"keyboard_switch_{slug}_gold_contact_leaf_right", (0.0012, 0.013, 0.004), (x + 0.0064, y + 0.006, z + 0.005), materials["contact"], 0.0002, 1)


def build_keyboard(materials: dict[str, bpy.types.Material]) -> list[dict[str, object]]:
    keyboard_x = -0.26
    keyboard_z = 0.155
    targets: list[dict[str, object]] = []

    rounded_block("mechanical_keyboard_shadow_under_case", (0.348, 0.010, 0.158), (keyboard_x, 0.182, keyboard_z + 0.004), materials["rubber"], 0.018, 8)
    rounded_block("mechanical_keyboard_cnc_aluminum_bottom_tray", (0.342, 0.024, 0.154), (keyboard_x, 0.194, keyboard_z), materials["aluminum"], 0.018, 8)
    rounded_block("mechanical_keyboard_black_gasket_gap", (0.324, 0.006, 0.136), (keyboard_x, 0.209, keyboard_z), materials["rubber"], 0.009, 4)
    rounded_block("mechanical_keyboard_dark_pcb_layer_visible_between_switches", (0.315, 0.004, 0.126), (keyboard_x, 0.214, keyboard_z), materials["pcb"], 0.006, 3)
    rounded_block("mechanical_keyboard_anodized_switch_plate", (0.309, 0.005, 0.120), (keyboard_x, 0.218, keyboard_z), materials["plate"], 0.005, 3)

    row_specs = [
        {"labels": ["Esc", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "-", "=", "Bk"], "z": -0.051, "offset": -0.141, "w": 0.0172, "d": 0.0152, "gap": 0.0044},
        {"labels": ["Tab", "Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P", "[", "]", "\\"], "z": -0.029, "offset": -0.141, "w": 0.0172, "d": 0.0164, "gap": 0.0044},
        {"labels": ["Caps", "A", "S", "D", "F", "G", "H", "J", "K", "L", ";", "'", "Ent"], "z": -0.006, "offset": -0.132, "w": 0.0172, "d": 0.0164, "gap": 0.0044},
        {"labels": ["Shift", "Z", "X", "C", "V", "B", "N", "M", ",", ".", "/", "Shift"], "z": 0.017, "offset": -0.121, "w": 0.0172, "d": 0.0164, "gap": 0.0046},
        {"labels": ["Ctrl", "Fn", "Alt", "Cmd", "Space", "Alt", "Fn", "Menu", "←", "↓", "→"], "z": 0.040, "offset": -0.109, "w": 0.0172, "d": 0.0164, "gap": 0.0046},
    ]
    for row_index, row in enumerate(row_specs):
        cursor_x = keyboard_x + row["offset"]
        for i, label in enumerate(row["labels"]):
            width = row["w"]
            if label in {"Tab", "Caps", "Ent", "Shift"}:
                width = 0.024 if label != "Ent" else 0.03
            if label == "Space":
                width = 0.083
            key_x = cursor_x + width / 2
            pressed = label in {"A", "Space"} if row_index in {2, 4} else False
            key_material = materials["accent"] if label in {"Esc", "Ent", "Space"} else materials["keycap"]
            keycap_mesh(
                f"mechanical_keyboard_keycap_r{row_index}_{i}_{label.lower().replace(' ', '_').replace('←', 'left').replace('↓', 'down').replace('→', 'right')}",
                (width, 0.0084, row["d"]),
                (key_x, 0.226, keyboard_z + row["z"]),
                key_material,
                pressed=pressed,
            )
            add_key_legend(
                f"mechanical_keyboard_legend_r{row_index}_{i}_{label.lower().replace(' ', '_')}",
                label,
                (key_x, 0.2315 - (0.004 if pressed else 0.0), keyboard_z + row["z"]),
                materials["legend"],
                size=0.0046 if len(label) > 2 else 0.0054,
            )
            targets.append(
                {
                    "id": f"key-r{row_index}-{i}",
                    "label": label,
                    "position": [round(key_x, 5), round(0.236, 5), round(keyboard_z + row["z"], 5)],
                    "size": [round(width, 5), 0.024, round(row["d"], 5)],
                }
            )
            cursor_x += width + row["gap"]

    # Spacebar stabilizer and long-key hardware are deliberately visible through
    # the front gap so the model reads as a real mechanical keyboard rather than
    # a flat grid of blocks.
    cylinder_y("mechanical_keyboard_spacebar_stabilizer_wire_polished_steel", 0.0013, 0.071, (keyboard_x - 0.018, 0.219, keyboard_z + 0.056), materials["spring"], 24)
    for x_offset in [-0.048, 0.013]:
        rounded_block(f"mechanical_keyboard_spacebar_stabilizer_white_insert_{x_offset}", (0.009, 0.006, 0.012), (keyboard_x + x_offset, 0.222, keyboard_z + 0.049), materials["keycap"], 0.0016, 2)
    rounded_block("mechanical_keyboard_rear_usb_c_recess", (0.031, 0.006, 0.0055), (keyboard_x + 0.121, 0.208, keyboard_z - 0.077), materials["rubber"], 0.0016, 1)

    switch_y = 0.239
    sample_z = keyboard_z - 0.083
    add_switch_sample("linear_red", (keyboard_x - 0.106, switch_y, sample_z), materials["stem_red"], materials)
    add_switch_sample("clicky_blue", (keyboard_x - 0.066, switch_y, sample_z), materials["stem_blue"], materials, pressed=True)
    add_switch_sample("tactile_brown", (keyboard_x - 0.026, switch_y, sample_z), materials["stem_brown"], materials)
    for idx, (slug, label, x_offset) in enumerate([
        ("linear_red", "RED", -0.106),
        ("clicky_blue", "BLUE", -0.066),
        ("tactile_brown", "BROWN", -0.026),
    ]):
        add_key_legend(
            f"mechanical_keyboard_switch_label_{slug}",
            label,
            (keyboard_x + x_offset, 0.224, sample_z - 0.024),
            materials["legend"],
            size=0.0042,
        )
        targets.append(
            {
                "id": f"sample-{slug.replace('_', '-')}",
                "label": label,
                "position": [round(keyboard_x + x_offset, 5), round(switch_y + 0.024, 5), round(sample_z, 5)],
                "size": [0.026, 0.034, 0.026],
            }
        )

    for led_x in [-0.125, -0.055, 0.015, 0.085, 0.135]:
        rounded_block(f"mechanical_keyboard_under_key_rgb_diffuser_{led_x}", (0.012, 0.0015, 0.004), (keyboard_x + led_x, 0.221, keyboard_z + 0.067), materials["rgb"], 0.0014, 1)

    return targets


def set_metadata() -> None:
    for obj in bpy.context.scene.objects:
        if obj.type not in {"MESH", "CURVE", "FONT"}:
            continue
        obj["source"] = "blender_authored_generic"
        obj["assetKey"] = ASSET_KEY
        obj["license"] = "self-authored-prototype-review-required"
        if obj.type == "MESH":
            obj.select_set(True)


def add_preview_lights() -> None:
    bpy.ops.object.light_add(type="AREA", location=to_blender_loc((-1.5, 1.4, -0.6)))
    key = bpy.context.object
    key.name = "mechanical_keyboard_preview_large_softbox"
    key.data.energy = 360
    key.data.size = 2.3
    bpy.ops.object.light_add(type="POINT", location=to_blender_loc((0.62, 0.64, -0.28)))
    warm = bpy.context.object
    warm.name = "mechanical_keyboard_preview_warm_desk_reflection"
    warm.data.color = (1.0, 0.64, 0.42)
    warm.data.energy = 42
    bpy.ops.object.light_add(type="POINT", location=to_blender_loc((-0.85, 0.6, 0.44)))
    cool = bpy.context.object
    cool.name = "mechanical_keyboard_preview_cool_rgb_reflection"
    cool.data.color = (0.45, 0.68, 1.0)
    cool.data.energy = 34


def look_at(obj: bpy.types.Object, target: tuple[float, float, float]) -> None:
    direction = Vector(to_blender_loc(target)) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def render_preview(path: Path, camera_loc: tuple[float, float, float], target: tuple[float, float, float]) -> None:
    bpy.context.scene.render.resolution_x = 1800
    bpy.context.scene.render.resolution_y = 1200
    bpy.context.scene.render.film_transparent = True
    if "Camera" not in bpy.data.objects:
        bpy.ops.object.camera_add(location=to_blender_loc(camera_loc))
    camera = bpy.context.scene.camera or bpy.context.object
    camera.location = to_blender_loc(camera_loc)
    look_at(camera, target)
    camera.data.lens = 58
    camera.data.dof.use_dof = False
    bpy.context.scene.camera = camera
    bpy.context.scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


def export_glb(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format="GLB",
        export_apply=True,
        export_yup=True,
        export_materials="EXPORT",
        export_image_format="AUTO",
    )


def write_runtime_package(path: Path, targets: list[dict[str, object]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "assetKey": ASSET_KEY,
        "revision": ASSET_REVISION,
        "model": f"/assets/models/{ASSET_KEY}/{ASSET_KEY}.glb",
        "unit": "meters",
        "runtime": {
            "pressTargets": targets,
            "switchProfiles": SWITCH_PROFILES,
            "defaultSwitchProfile": "linear-red",
            "pressTravelMeters": {"linear-red": 0.0038, "clicky-blue": 0.004, "tactile-brown": 0.0039},
        },
        "license": {
            "kind": "self-authored",
            "notice": "Generic procedural model. No trademarked keyboard or switch geometry copied.",
        },
    }
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def write_review(path: Path, public_glb: Path, targets: list[dict[str, object]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {
        "schemaVersion": "deskterior-blender-authored-asset-review-v1",
        "assetKey": ASSET_KEY,
        "revision": ASSET_REVISION,
        "reviewDate": REVIEW_DATE,
        "sourcePolicy": {
            "license": "self-authored procedural model",
            "referenceOnlyUrls": [
                "https://kbddiary.tistory.com/50",
                "https://www.cherry.de/en-us/product/mx2a-red",
                "https://www.cherry.de/en-us/product/mx2a-blue",
                "https://www.cherry.de/en-us/product/mx2a-brown",
            ],
            "brandUse": "No logo, no trademarked product silhouette, no vendor CAD data.",
        },
        "qualityTargets": [
            "Individual keycap geometry, not a flat keyboard texture",
            "Visible PCB/plate/gasket layer stack",
            "Spacebar stabilizer wire and inserts",
            "Three exposed switch samples with housing, stem, spring, and contacts",
            "PBR keycap/aluminum/polycarbonate materials",
            "Runtime press target metadata and switch audio profiles",
        ],
        "switchProfiles": SWITCH_PROFILES,
        "runtimePressTargetCount": len(targets),
        "outputs": {
            "publicGlb": str(public_glb),
            "runtimePackage": f"apps/web/public/assets/models/{ASSET_KEY}/runtime-package.json",
        },
        "knownGaps": [
            "Procedural geometry still approximates injection-molded switch internals; manufacturer-accurate mold parting lines are intentionally omitted.",
            "Per-key sound is synthesized in WebAudio; later pass should support recorded WAV layers for commercial audio realism.",
        ],
    }
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def main() -> None:
    args = parse_args()
    repo_root = Path(args.repo_root)
    public_dir = repo_root / "apps/web/public/assets/models" / ASSET_KEY
    texture_dir = public_dir / "textures"
    review_dir = repo_root / "assets/references/blender-authored/mechanical-keyboard-switch-lab-v1"
    preview_dir = review_dir / "previews"
    blend_dir = repo_root / "assets/blender/deskterior"
    public_dir.mkdir(parents=True, exist_ok=True)
    review_dir.mkdir(parents=True, exist_ok=True)
    preview_dir.mkdir(parents=True, exist_ok=True)
    blend_dir.mkdir(parents=True, exist_ok=True)

    clear_scene()
    materials = create_materials(texture_dir)
    targets = build_keyboard(materials)
    set_metadata()
    add_preview_lights()

    render_preview(preview_dir / "mechanical-keyboard-v1-isometric.png", (-0.56, 0.52, 0.57), (-0.22, 0.22, 0.13))
    render_preview(preview_dir / "mechanical-keyboard-v1-switch-closeup.png", (-0.49, 0.35, -0.02), (-0.326, 0.24, 0.072))

    blend_path = blend_dir / f"{ASSET_KEY}.blend"
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
    public_glb = public_dir / f"{ASSET_KEY}.glb"
    export_glb(public_glb)
    write_runtime_package(public_dir / "runtime-package.json", targets)
    write_review(review_dir / f"asset-review-{REVIEW_DATE}.json", public_glb, targets)


if __name__ == "__main__":
    main()
