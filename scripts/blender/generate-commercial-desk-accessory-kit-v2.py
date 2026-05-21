#!/usr/bin/env python3
"""Generate a self-authored commercial-reference desktop accessory kit.

The output deliberately avoids copying branded products. Public product pages
are used as proportion/material references only: thin OLED monitor, low-profile
keyboard, sculpted mouse, compact desktop speakers, monitor light bar, task
lamp, microphone arm, and cable dressing.
"""

from __future__ import annotations

import argparse
import json
import math
import random
import shutil
import sys
from pathlib import Path

import bpy
from mathutils import Vector


ASSET_KEY = "p2s_commercial_desk_accessory_kit_v2"
REVIEW_DATE = "2026-05-21"
ASSET_REVISION = "real-scale-v2"

REAL_SCALE_SPEC_MM = {
    "monitor32WithStand": [718, 579, 274],
    "monitor32Panel": [718, 430, 74],
    "screenbarHalo": [500, 95, 97],
    "mxMechanicalMini": [312.6, 131.55, 26.1],
    "mxMaster3s": [84.3, 124.9, 51.0],
    "kantoOraEach": [100, 141, 175],
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


def smoothstep(value: float) -> float:
    return value * value * (3.0 - 2.0 * value)


def hash2(ix: int, iy: int) -> float:
    return fract(math.sin(ix * 127.1 + iy * 311.7) * 43758.5453123)


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


def speaker_fabric_base(u: float, v: float, x: int, y: int) -> tuple[float, float, float, float]:
    warp = 0.5 + 0.5 * math.sin(u * math.tau * 86.0)
    weft = 0.5 + 0.5 * math.sin(v * math.tau * 92.0)
    noise = fbm(u * 34.0, v * 34.0, 4)
    lift = warp * 0.012 + weft * 0.014 + noise * 0.022
    return (0.022 + lift, 0.026 + lift, 0.03 + lift * 0.9, 1.0)


def speaker_fabric_height(u: float, v: float, x: int, y: int) -> tuple[float, float, float, float]:
    warp = 0.5 + 0.5 * math.sin(u * math.tau * 86.0)
    weft = 0.5 + 0.5 * math.sin(v * math.tau * 92.0)
    pin = (hash2(x, y) - 0.5) * 0.018
    height = max(0.0, min(1.0, 0.24 + warp * 0.28 + weft * 0.24 + pin))
    return (height, height, height, 1.0)


def rubber_mat_base(u: float, v: float, x: int, y: int) -> tuple[float, float, float, float]:
    fine = fbm(u * 90.0, v * 90.0, 3) * 0.028
    stitch = 0.0
    if u < 0.035 or u > 0.965 or v < 0.04 or v > 0.96:
        stitch = (0.5 + 0.5 * math.sin((u + v) * math.tau * 76.0)) * 0.04
    return (0.025 + fine + stitch, 0.029 + fine * 0.8 + stitch, 0.034 + fine * 0.6 + stitch * 0.8, 1.0)


def keycap_base(u: float, v: float, x: int, y: int) -> tuple[float, float, float, float]:
    speckle = (hash2(x, y) - 0.5) * 0.018
    side_wear = 0.02 * (abs(u - 0.5) + abs(v - 0.5))
    return (0.78 + speckle - side_wear, 0.81 + speckle - side_wear, 0.84 + speckle - side_wear, 1.0)


def screen_smudge_base(u: float, v: float, x: int, y: int) -> tuple[float, float, float, float]:
    grad = 0.16 + 0.11 * u + 0.08 * (1 - v)
    smudge = fbm(u * 8.0, v * 8.0, 5) * 0.07
    scan = 0.012 * math.sin(v * math.tau * 42.0)
    return (0.02 + grad * 0.15 + smudge, 0.032 + grad * 0.25 + smudge * 0.8, 0.052 + grad * 0.42 + smudge + scan, 1.0)


def roughness_painter(base: float):
    def painter(u: float, v: float, x: int, y: int) -> tuple[float, float, float, float]:
        rough = max(0.0, min(1.0, base + fbm(u * 40.0, v * 40.0, 3) * 0.08 + (hash2(x, y) - 0.5) * 0.018))
        return (rough, rough, rough, 1.0)

    return painter


def material_with_maps(
    name: str,
    base_image: bpy.types.Image,
    roughness_image: bpy.types.Image,
    height_image: bpy.types.Image | None,
    *,
    roughness: float,
    metalness: float = 0.0,
    alpha: float = 1.0,
    bump_strength: float = 0.04,
    emissive: tuple[float, float, float, float] | None = None,
    emissive_strength: float = 0.0,
) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.blend_method = "BLEND" if alpha < 1.0 else "OPAQUE"
    material.show_transparent_back = False
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        try:
            bsdf.inputs["Roughness"].default_value = roughness
            bsdf.inputs["Metallic"].default_value = metalness
            bsdf.inputs["Alpha"].default_value = alpha
            if emissive:
                bsdf.inputs["Emission Color"].default_value = emissive
                bsdf.inputs["Emission Strength"].default_value = emissive_strength
        except Exception:
            pass
        tex_base = material.node_tree.nodes.new("ShaderNodeTexImage")
        tex_base.image = base_image
        tex_base.image.colorspace_settings.name = "sRGB"
        material.node_tree.links.new(tex_base.outputs["Color"], bsdf.inputs["Base Color"])
        tex_rough = material.node_tree.nodes.new("ShaderNodeTexImage")
        tex_rough.image = roughness_image
        tex_rough.image.colorspace_settings.name = "Non-Color"
        material.node_tree.links.new(tex_rough.outputs["Color"], bsdf.inputs["Roughness"])
        if height_image:
            tex_height = material.node_tree.nodes.new("ShaderNodeTexImage")
            tex_height.image = height_image
            tex_height.image.colorspace_settings.name = "Non-Color"
            bump = material.node_tree.nodes.new("ShaderNodeBump")
            bump.inputs["Strength"].default_value = bump_strength
            bump.inputs["Distance"].default_value = 0.014
            material.node_tree.links.new(tex_height.outputs["Color"], bump.inputs["Height"])
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
    material.diffuse_color = color
    material.use_nodes = True
    material.blend_method = "BLEND" if alpha < 1.0 else "OPAQUE"
    material.use_screen_refraction = alpha < 0.55
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        try:
            bsdf.inputs["Base Color"].default_value = color
            bsdf.inputs["Roughness"].default_value = roughness
            bsdf.inputs["Metallic"].default_value = metalness
            bsdf.inputs["Alpha"].default_value = alpha
            if emissive:
                bsdf.inputs["Emission Color"].default_value = emissive
                bsdf.inputs["Emission Strength"].default_value = emissive_strength
        except Exception:
            pass
    return material


def rounded_block(
    name: str,
    size: tuple[float, float, float],
    loc: tuple[float, float, float],
    material: bpy.types.Material,
    bevel: float,
    segments: int = 6,
    rotation_y: float = 0.0,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=to_blender_loc(loc), rotation=(0.0, -rotation_y, 0.0))
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = to_blender_size(size)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel > 0:
        bevel_mod = obj.modifiers.new(name=f"{name}_beveled_edges", type="BEVEL")
        bevel_mod.width = bevel
        bevel_mod.segments = segments
        bevel_mod.affect = "EDGES"
        obj.modifiers.new(name=f"{name}_weighted_normals", type="WEIGHTED_NORMAL")
    obj.data.materials.append(material)
    obj["deskterior_category"] = "commercial_desk_accessory_kit"
    return obj


def cylinder_y(
    name: str,
    radius: float,
    depth: float,
    loc: tuple[float, float, float],
    material: bpy.types.Material,
    vertices: int = 36,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=to_blender_loc(loc))
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(material)
    bevel = obj.modifiers.new(name=f"{name}_soft_rim", type="BEVEL")
    bevel.width = radius * 0.045
    bevel.segments = 2
    obj.modifiers.new(name=f"{name}_weighted_normals", type="WEIGHTED_NORMAL")
    obj["deskterior_category"] = "commercial_desk_accessory_kit"
    return obj


def cylinder_x(
    name: str,
    radius: float,
    depth: float,
    loc: tuple[float, float, float],
    material: bpy.types.Material,
    vertices: int = 36,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=to_blender_loc(loc), rotation=(0, math.pi / 2, 0))
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(material)
    obj.modifiers.new(name=f"{name}_weighted_normals", type="WEIGHTED_NORMAL")
    obj["deskterior_category"] = "commercial_desk_accessory_kit"
    return obj


def cylinder_z(
    name: str,
    radius: float,
    depth: float,
    loc: tuple[float, float, float],
    material: bpy.types.Material,
    vertices: int = 36,
    rotation_y: float = 0.0,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=depth,
        location=to_blender_loc(loc),
        rotation=(math.pi / 2, -rotation_y, 0),
    )
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(material)
    bevel = obj.modifiers.new(name=f"{name}_chamfered_round_edge", type="BEVEL")
    bevel.width = radius * 0.035
    bevel.segments = 2
    obj.modifiers.new(name=f"{name}_weighted_normals", type="WEIGHTED_NORMAL")
    obj["deskterior_category"] = "commercial_desk_accessory_kit"
    return obj


def cable_curve(name: str, points: list[tuple[float, float, float]], material: bpy.types.Material, bevel: float = 0.007) -> bpy.types.Object:
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 18
    curve.bevel_depth = bevel
    curve.bevel_resolution = 3
    spline = curve.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for point, src in zip(spline.bezier_points, points):
        point.co = to_blender_loc(src)
        point.handle_left_type = "AUTO"
        point.handle_right_type = "AUTO"
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    obj["deskterior_category"] = "commercial_desk_accessory_kit"
    return obj


def uv_sphere(
    name: str,
    loc: tuple[float, float, float],
    scale: tuple[float, float, float],
    material: bpy.types.Material,
    segments: int = 48,
    rings: int = 18,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, radius=1.0, location=to_blender_loc(loc))
    obj = bpy.context.object
    obj.name = name
    obj.scale = to_blender_size(scale)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    obj.modifiers.new(name=f"{name}_weighted_normals", type="WEIGHTED_NORMAL")
    obj["deskterior_category"] = "commercial_desk_accessory_kit"
    return obj


def curved_monitor_panel(name: str, loc: tuple[float, float, float], size: tuple[float, float], material: bpy.types.Material, depth: float = 0.035) -> bpy.types.Object:
    width, height = size
    cols = 28
    rows = 8
    curve_amount = 0.075
    verts: list[tuple[float, float, float]] = []
    faces: list[tuple[int, int, int, int]] = []
    for iy in range(rows + 1):
        y = -height / 2 + height * iy / rows
        for ix in range(cols + 1):
            x = -width / 2 + width * ix / cols
            z = -depth / 2 - math.cos((x / width) * math.pi) * curve_amount + curve_amount
            verts.append(to_blender_loc((loc[0] + x, loc[1] + y, loc[2] + z)))
    for iy in range(rows):
        for ix in range(cols):
            a = iy * (cols + 1) + ix
            faces.append((a, a + 1, a + cols + 2, a + cols + 1))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(verts, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    obj.modifiers.new(name=f"{name}_screen_weighted_normals", type="WEIGHTED_NORMAL")
    obj["deskterior_category"] = "commercial_desk_accessory_kit"
    return obj


def add_key_mark(name: str, loc: tuple[float, float, float], material: bpy.types.Material, width: float = 0.034) -> None:
    rounded_block(name, (width, 0.003, 0.005), loc, material, 0.0015, 1, rotation_y=-0.05)


def build_monitor(materials: dict[str, bpy.types.Material]) -> None:
    monitor_x = -0.24
    monitor_y = 0.71
    monitor_z = -0.33
    rounded_block("accessory_v2_monitor_32inch_graphite_rear_shell", (0.718, 0.43, 0.074), (monitor_x, monitor_y, monitor_z - 0.022), materials["graphite"], 0.018, 10)
    curved_monitor_panel("accessory_v2_monitor_32inch_subtle_oled_glass_panel", (monitor_x, monitor_y, monitor_z + 0.021), (0.69, 0.388), materials["screen"], depth=0.018)
    rounded_block("accessory_v2_monitor_ultra_thin_top_bezel", (0.704, 0.011, 0.012), (monitor_x, monitor_y + 0.201, monitor_z + 0.042), materials["black_plastic"], 0.004, 2)
    rounded_block("accessory_v2_monitor_ultra_thin_bottom_bezel", (0.704, 0.018, 0.014), (monitor_x, monitor_y - 0.204, monitor_z + 0.04), materials["black_plastic"], 0.004, 2)
    rounded_block("accessory_v2_monitor_left_bezel", (0.012, 0.39, 0.012), (monitor_x - 0.356, monitor_y, monitor_z + 0.041), materials["black_plastic"], 0.004, 2)
    rounded_block("accessory_v2_monitor_right_bezel", (0.012, 0.39, 0.012), (monitor_x + 0.356, monitor_y, monitor_z + 0.041), materials["black_plastic"], 0.004, 2)
    rounded_block("accessory_v2_monitor_rear_vesa_plate_100mm", (0.13, 0.105, 0.018), (monitor_x, monitor_y - 0.035, monitor_z - 0.073), materials["black_metal"], 0.012, 4)
    for i, y in enumerate([monitor_y + 0.105, monitor_y + 0.075, monitor_y + 0.045]):
        rounded_block(f"accessory_v2_monitor_rear_heat_vent_slit_{i}", (0.42, 0.006, 0.006), (monitor_x, y, monitor_z - 0.116), materials["rubber"], 0.002, 1)
    rounded_block("accessory_v2_monitor_satin_height_adjust_neck", (0.042, 0.315, 0.032), (monitor_x, 0.365, monitor_z - 0.09), materials["black_metal"], 0.011, 5)
    rounded_block("accessory_v2_monitor_hinge_block", (0.122, 0.052, 0.038), (monitor_x, 0.51, monitor_z - 0.084), materials["black_metal"], 0.012, 5)
    rounded_block("accessory_v2_monitor_realistic_weighted_base", (0.332, 0.031, 0.245), (monitor_x, 0.183, -0.205), materials["black_metal"], 0.026, 8)
    rounded_block("accessory_v2_monitor_base_rubber_foot_inset", (0.255, 0.006, 0.172), (monitor_x, 0.204, -0.205), materials["rubber"], 0.014, 4)
    rounded_block("accessory_v2_monitor_lightbar_50cm_aluminum_body", (0.5, 0.028, 0.036), (monitor_x, 0.943, monitor_z + 0.012), materials["black_metal"], 0.012, 5)
    rounded_block("accessory_v2_monitor_lightbar_warm_linear_diffuser", (0.462, 0.009, 0.012), (monitor_x, 0.925, monitor_z + 0.047), materials["warm_emissive"], 0.004, 2)
    rounded_block("accessory_v2_monitor_lightbar_counterweight_clamp", (0.082, 0.065, 0.052), (monitor_x, 0.946, monitor_z - 0.052), materials["graphite"], 0.011, 4)
    for index, (x, y, width) in enumerate([(-0.445, 0.79, 0.068), (-0.315, 0.742, 0.105), (-0.13, 0.825, 0.13), (0.015, 0.675, 0.095)]):
        rounded_block(f"accessory_v2_monitor_subtle_reflection_tile_{index}", (width, 0.008, 0.006), (x, y, monitor_z + 0.055), materials["soft_screen_emissive"], 0.003, 1)

    rounded_block("accessory_v2_portable_side_display_aluminum_back", (0.36, 0.225, 0.024), (0.33, 0.49, -0.175), materials["silver"], 0.012, 5, rotation_y=-0.12)
    rounded_block("accessory_v2_portable_side_display_black_glass", (0.334, 0.198, 0.009), (0.33, 0.49, -0.153), materials["screen"], 0.008, 4, rotation_y=-0.12)
    rounded_block("accessory_v2_portable_display_slim_folio_stand", (0.305, 0.014, 0.13), (0.33, 0.182, -0.083), materials["silver"], 0.009, 4, rotation_y=-0.12)


def build_keyboard_mouse(materials: dict[str, bpy.types.Material]) -> None:
    rounded_block("accessory_v2_real_scale_xl_desk_mat_stitched_edge", (0.94, 0.014, 0.39), (-0.08, 0.168, 0.155), materials["desk_mat"], 0.026, 9)
    keyboard_x = -0.26
    keyboard_z = 0.155
    rounded_block("accessory_v2_keyboard_312mm_aluminum_top_case", (0.318, 0.026, 0.137), (keyboard_x, 0.196, keyboard_z), materials["silver"], 0.012, 6, rotation_y=-0.035)
    rounded_block("accessory_v2_keyboard_black_shadow_plate_between_keys", (0.302, 0.006, 0.118), (keyboard_x, 0.213, keyboard_z), materials["black_plastic"], 0.006, 3, rotation_y=-0.035)
    row_specs = [
        {"count": 14, "z": -0.051, "offset": -0.141, "w": 0.0172, "d": 0.0152, "gap": 0.0044},
        {"count": 14, "z": -0.029, "offset": -0.141, "w": 0.0172, "d": 0.0164, "gap": 0.0044},
        {"count": 13, "z": -0.006, "offset": -0.132, "w": 0.0172, "d": 0.0164, "gap": 0.0044},
        {"count": 12, "z": 0.017, "offset": -0.121, "w": 0.0172, "d": 0.0164, "gap": 0.0046},
        {"count": 11, "z": 0.040, "offset": -0.109, "w": 0.0172, "d": 0.0164, "gap": 0.0046},
    ]
    for row_index, row in enumerate(row_specs):
        for i in range(row["count"]):
            width = row["w"]
            if row_index == 4 and i in {0, 10}:
                width = 0.026
            if row_index == 4 and i == 4:
                width = 0.077
            if row_index == 3 and i in {0, 11}:
                width = 0.024
            x = keyboard_x + row["offset"] + i * (row["w"] + row["gap"])
            if row_index == 4 and i > 4:
                x += 0.06
            mat_key = materials["accent_key"] if (row_index == 0 and i in {0, 13}) or (row_index == 4 and i == 10) else materials["keycap"]
            rounded_block(
                f"accessory_v2_keyboard_real_scale_pbt_key_r{row_index}_{i}",
                (width, 0.0075, row["d"]),
                (x, 0.219, keyboard_z + row["z"]),
                mat_key,
                0.0034,
                3,
                rotation_y=-0.035,
            )
    for idx, (x, z, width) in enumerate([
        (keyboard_x - 0.136, keyboard_z - 0.051, 0.008),
        (keyboard_x - 0.026, keyboard_z - 0.051, 0.01),
        (keyboard_x + 0.123, keyboard_z - 0.051, 0.008),
        (keyboard_x - 0.038, keyboard_z + 0.04, 0.047),
        (keyboard_x + 0.12, keyboard_z + 0.041, 0.009),
    ]):
        add_key_mark(f"accessory_v2_keyboard_micro_legend_mark_{idx}", (x, 0.227, z), materials["legend"], width)
    rounded_block("accessory_v2_keyboard_rear_usb_c_slot", (0.028, 0.007, 0.006), (keyboard_x + 0.12, 0.209, keyboard_z - 0.075), materials["rubber"], 0.002, 1, rotation_y=-0.035)

    mouse_x = 0.24
    mouse_z = 0.155
    rounded_block("accessory_v2_mouse_underbody_black_shadow_gap", (0.075, 0.012, 0.112), (mouse_x + 0.002, 0.189, mouse_z + 0.006), materials["rubber"], 0.018, 5)
    uv_sphere("accessory_v2_mouse_125mm_asymmetric_white_palm_shell", (mouse_x + 0.003, 0.212, mouse_z + 0.01), (0.039, 0.022, 0.056), materials["mouse_shell"], 64, 24)
    uv_sphere("accessory_v2_mouse_left_thumb_rest_integrated_wing", (mouse_x - 0.037, 0.203, mouse_z + 0.02), (0.021, 0.01, 0.045), materials["mouse_shell"], 40, 14)
    rounded_block("accessory_v2_mouse_left_click_low_separate_plate", (0.029, 0.0038, 0.044), (mouse_x - 0.016, 0.233, mouse_z - 0.029), materials["mouse_shell"], 0.005, 3)
    rounded_block("accessory_v2_mouse_right_click_low_separate_plate", (0.029, 0.0038, 0.044), (mouse_x + 0.017, 0.233, mouse_z - 0.029), materials["mouse_shell"], 0.005, 3)
    rounded_block("accessory_v2_mouse_center_recessed_channel", (0.006, 0.0045, 0.053), (mouse_x + 0.001, 0.236, mouse_z - 0.031), materials["rubber"], 0.0018, 1)
    cylinder_x("accessory_v2_mouse_knurled_metal_scroll_wheel", 0.0068, 0.021, (mouse_x + 0.001, 0.238, mouse_z - 0.052), materials["black_metal"], 28)
    rounded_block("accessory_v2_mouse_side_forward_button", (0.007, 0.0048, 0.025), (mouse_x - 0.043, 0.223, mouse_z - 0.004), materials["silver"], 0.0025, 2)
    rounded_block("accessory_v2_mouse_side_back_button", (0.007, 0.0048, 0.023), (mouse_x - 0.044, 0.221, mouse_z + 0.027), materials["silver"], 0.0025, 2)
    rounded_block("accessory_v2_mouse_front_black_charging_slot", (0.018, 0.0035, 0.004), (mouse_x + 0.001, 0.207, mouse_z - 0.065), materials["rubber"], 0.0015, 1)


def build_speakers(materials: dict[str, bpy.types.Material]) -> None:
    for side, x in [("left", -0.72), ("right", 0.47)]:
        rounded_block(f"accessory_v2_{side}_speaker_ora_scale_white_cabinet_100x175x141", (0.102, 0.175, 0.142), (x, 0.285, -0.255), materials["white_lacquer"], 0.012, 7)
        rounded_block(f"accessory_v2_{side}_speaker_recessed_black_baffle", (0.082, 0.145, 0.009), (x, 0.291, -0.181), materials["speaker_fabric"], 0.009, 5)
        cylinder_z(f"accessory_v2_{side}_speaker_3inch_woofer_outer_bezel", 0.035, 0.01, (x, 0.258, -0.171), materials["black_metal"], 56)
        cylinder_z(f"accessory_v2_{side}_speaker_woofer_paper_cone", 0.028, 0.012, (x, 0.258, -0.163), materials["rubber"], 56)
        cylinder_z(f"accessory_v2_{side}_speaker_woofer_dust_cap", 0.011, 0.014, (x, 0.258, -0.154), materials["black_plastic"], 36)
        cylinder_z(f"accessory_v2_{side}_speaker_silk_tweeter_outer_ring", 0.019, 0.009, (x, 0.325, -0.171), materials["black_metal"], 48)
        cylinder_z(f"accessory_v2_{side}_speaker_silk_tweeter_dome", 0.013, 0.012, (x, 0.325, -0.158), materials["graphite"], 48)
        cylinder_z(f"accessory_v2_{side}_speaker_tiny_status_led", 0.004, 0.004, (x + 0.031, 0.208, -0.172), materials["soft_screen_emissive"], 20)
        rounded_block(f"accessory_v2_{side}_speaker_rear_bass_port", (0.044, 0.028, 0.006), (x, 0.321, -0.331), materials["rubber"], 0.006, 3)
        rounded_block(f"accessory_v2_{side}_speaker_low_decoupling_stand", (0.116, 0.025, 0.105), (x, 0.183, -0.255), materials["black_metal"], 0.01, 5)
        for foot_x, foot_z in [(-0.036, -0.212), (0.036, -0.212), (-0.036, -0.298), (0.036, -0.298)]:
            rounded_block(f"accessory_v2_{side}_speaker_rubber_foot_{foot_x}_{foot_z}", (0.018, 0.006, 0.018), (x + foot_x, 0.166, foot_z), materials["rubber"], 0.005, 2)


def build_lamp_and_mic(materials: dict[str, bpy.types.Material]) -> None:
    rounded_block("accessory_v2_desk_lamp_slim_weighted_base", (0.172, 0.028, 0.142), (-0.86, 0.185, 0.095), materials["black_metal"], 0.022, 8)
    cylinder_y("accessory_v2_desk_lamp_rear_pivot_hinge", 0.021, 0.045, (-0.86, 0.235, 0.095), materials["black_metal"], 32)
    cable_curve("accessory_v2_desk_lamp_lower_twin_arm", [(-0.86, 0.25, 0.095), (-0.8, 0.42, 0.02), (-0.7, 0.54, -0.09)], materials["black_metal"], 0.0055)
    cable_curve("accessory_v2_desk_lamp_upper_twin_arm", [(-0.7, 0.54, -0.09), (-0.58, 0.62, -0.18), (-0.48, 0.635, -0.268)], materials["black_metal"], 0.0055)
    rounded_block("accessory_v2_desk_lamp_thin_linear_led_head", (0.218, 0.018, 0.044), (-0.45, 0.638, -0.29), materials["black_metal"], 0.011, 5, rotation_y=-0.11)
    rounded_block("accessory_v2_desk_lamp_soft_warm_diffuser_panel", (0.176, 0.006, 0.025), (-0.45, 0.623, -0.269), materials["warm_emissive"], 0.005, 3, rotation_y=-0.11)

    rounded_block("accessory_broadcast_mic_clamp", (0.12, 0.12, 0.09), (-1.31, 0.23, 0.39), materials["black_metal"], 0.016, 5)
    cable_curve("accessory_broadcast_mic_lower_boom", [(-1.27, 0.28, 0.37), (-1.12, 0.56, 0.28), (-0.92, 0.66, 0.22)], materials["black_metal"], 0.014)
    cable_curve("accessory_broadcast_mic_upper_boom", [(-0.92, 0.66, 0.22), (-0.78, 0.58, 0.14), (-0.7, 0.45, 0.11)], materials["black_metal"], 0.012)
    cylinder_y("accessory_broadcast_mic_capsule_body", 0.055, 0.17, (-0.68, 0.39, 0.09), materials["black_plastic"], 40)
    rounded_block("accessory_broadcast_mic_grille_highlight", (0.084, 0.12, 0.012), (-0.68, 0.41, 0.012), materials["speaker_fabric"], 0.009, 3)


def build_small_clutter(materials: dict[str, bpy.types.Material]) -> None:
    rounded_block("accessory_v2_oak_tray_low_rounded_rect", (0.265, 0.026, 0.165), (0.77, 0.187, 0.19), materials["warm_wood"], 0.017, 6, rotation_y=-0.16)
    rounded_block("accessory_v2_tray_recess_shadow", (0.222, 0.006, 0.12), (0.77, 0.204, 0.19), materials["shadow"], 0.012, 4, rotation_y=-0.16)
    cylinder_y("accessory_v2_ceramic_mug_body", 0.043, 0.082, (-0.65, 0.228, 0.18), materials["white_lacquer"], 40)
    cylinder_y("accessory_v2_ceramic_mug_inner_coffee_shadow", 0.034, 0.007, (-0.65, 0.274, 0.18), materials["shadow"], 40)
    cable_curve("accessory_v2_visible_usb_c_cable_black", [(0.06, 0.19, 0.28), (0.2, 0.198, 0.235), (0.31, 0.199, 0.21), (0.41, 0.192, 0.24)], materials["rubber"], 0.0045)
    cable_curve("accessory_v2_speaker_cable_left", [(-0.72, 0.176, -0.33), (-0.56, 0.17, -0.1), (-0.39, 0.17, -0.02)], materials["rubber"], 0.004)
    cable_curve("accessory_v2_speaker_cable_right", [(0.47, 0.176, -0.33), (0.36, 0.17, -0.1), (0.26, 0.17, -0.02)], materials["rubber"], 0.004)
    cable_curve("accessory_v2_monitor_power_cable_to_rear", [(-0.22, 0.22, -0.31), (-0.26, 0.18, -0.45), (-0.43, 0.17, -0.48)], materials["rubber"], 0.005)


def build_accessory_kit(materials: dict[str, bpy.types.Material]) -> None:
    build_monitor(materials)
    build_keyboard_mouse(materials)
    build_speakers(materials)
    build_lamp_and_mic(materials)
    build_small_clutter(materials)


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
    bpy.ops.object.light_add(type="AREA", location=to_blender_loc((-2.0, 2.6, 1.2)))
    key = bpy.context.object
    key.name = "commercial_accessory_preview_large_softbox"
    key.data.energy = 420
    key.data.size = 4.5
    bpy.ops.object.light_add(type="POINT", location=to_blender_loc((1.3, 1.4, -0.35)))
    warm = bpy.context.object
    warm.name = "commercial_accessory_preview_warm_practical"
    warm.data.color = (1.0, 0.66, 0.42)
    warm.data.energy = 64
    bpy.ops.object.light_add(type="POINT", location=to_blender_loc((-1.5, 1.3, -0.85)))
    cool = bpy.context.object
    cool.name = "commercial_accessory_preview_cool_screen_rim"
    cool.data.color = (0.45, 0.68, 1.0)
    cool.data.energy = 74


def look_at(obj: bpy.types.Object, target: tuple[float, float, float]) -> None:
    direction = Vector(to_blender_loc(target)) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def render_preview(path: Path, camera_name: str, camera_loc: tuple[float, float, float], target: tuple[float, float, float], ortho_scale: float) -> None:
    bpy.ops.object.camera_add(location=to_blender_loc(camera_loc))
    camera = bpy.context.object
    camera.name = camera_name
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = ortho_scale
    look_at(camera, target)
    bpy.context.scene.camera = camera
    bpy.context.scene.render.resolution_x = 1600
    bpy.context.scene.render.resolution_y = 1200
    bpy.context.scene.view_settings.view_transform = "Filmic"
    bpy.context.scene.view_settings.look = "Medium High Contrast"
    bpy.context.scene.view_settings.exposure = -0.08
    bpy.context.scene.view_settings.gamma = 1.0
    bpy.context.scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


def mesh_stats() -> dict[str, int]:
    depsgraph = bpy.context.evaluated_depsgraph_get()
    triangles = 0
    objects = 0
    materials = {material.name for material in bpy.data.materials}
    textures = {image.name for image in bpy.data.images}
    for obj in bpy.context.scene.objects:
        if obj.type not in {"MESH", "CURVE", "FONT"}:
            continue
        objects += 1
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        if mesh:
            triangles += sum(max(0, len(poly.vertices) - 2) for poly in mesh.polygons)
            evaluated.to_mesh_clear()
    return {
        "objectCount": objects,
        "materialCount": len(materials),
        "textureCount": len(textures),
        "triangles": triangles,
    }


def write_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def export_asset(repo_root: Path, texture_paths: dict[str, str]) -> None:
    public_dir = repo_root / "apps/web/public/assets/models" / ASSET_KEY
    blend_dir = repo_root / "assets/blender/deskterior"
    review_dir = repo_root / "assets/references/blender-authored/commercial-desk-accessory-kit-v2"
    preview_dir = review_dir / "previews"
    public_dir.mkdir(parents=True, exist_ok=True)
    blend_dir.mkdir(parents=True, exist_ok=True)
    preview_dir.mkdir(parents=True, exist_ok=True)

    set_metadata()
    add_preview_lights()
    render_preview(preview_dir / "commercial-desk-accessory-kit-v2-isometric.png", "commercial_accessory_preview_iso", (1.18, 1.18, 1.1), (-0.1, 0.45, -0.06), 1.45)
    render_preview(preview_dir / "commercial-desk-accessory-kit-v2-keyboard-mouse-closeup.png", "commercial_accessory_preview_keys", (0.48, 0.52, 0.48), (-0.08, 0.22, 0.16), 0.54)
    render_preview(preview_dir / "commercial-desk-accessory-kit-v2-monitor-speaker-closeup.png", "commercial_accessory_preview_speaker", (0.66, 0.64, 0.2), (0.22, 0.42, -0.25), 0.72)

    bpy.ops.wm.save_as_mainfile(filepath=str(blend_dir / f"{ASSET_KEY}.blend"))
    glb_path = public_dir / f"{ASSET_KEY}.glb"
    bpy.ops.export_scene.gltf(
        filepath=str(glb_path),
        export_format="GLB",
        export_apply=True,
        export_texcoords=True,
        export_normals=True,
        export_tangents=True,
        export_materials="EXPORT",
        export_yup=True,
    )

    stats = mesh_stats()
    stats["glbBytes"] = glb_path.stat().st_size

    sidecar = {
        "assetKey": ASSET_KEY,
        "version": f"{REVIEW_DATE}-{ASSET_REVISION}",
        "source": {
            "kind": "blender_authored_generic",
            "license": "self-authored; official product pages used only for non-copied dimensions and material hierarchy",
            "releaseEligible": False,
            "reviewRequired": True
        },
        "dimensionsMm": {"width": 1430, "depth": 620, "height": 980},
        "pivot": {"origin": "desk-center-authored", "unit": "meters"},
        "collisionProxy": {"type": "box", "sizeMm": [1430, 620, 980]},
        "realScaleReferenceMm": REAL_SCALE_SPEC_MM,
        "textureSet": {
            "authored": "procedural_pbr_from_blender",
            "maps": texture_paths,
            "imageModelStatus": "procedural-pbr-used; built-in image texture generation still needs project-local extraction before runtime consumption"
        },
        "lodProfile": {"complexity": "medium-high", "maxTriangleCount": 120000, "targetDrawCalls": 22},
        "runtimeUrl": f"/assets/models/{ASSET_KEY}/{ASSET_KEY}.glb"
    }
    write_json(public_dir / "runtime-package.json", sidecar)

    prompt_pack = {
        "status": "review_pending_no_meshy_post_sent",
        "reason": "User requested prompt/reference review before Meshy text-to-3D or image-to-3D generation.",
        "textTo3dPromptCandidate": (
            "Generic real-scale premium desktop accessory kit for a cozy 3D deskterior room, no logos, no exact product copy. "
            "Use measured proportions only: 32 inch thin OLED monitor with real stand, 50cm monitor light bar, 312mm compact low-profile keyboard with individual keycaps, "
            "125mm asymmetric white productivity mouse with side buttons and scroll wheel, compact 100x175x141mm white desktop speakers with black fabric baffles, "
            "slim task lamp, broadcast microphone arm, small tray, mug, routed cables, PBR lacquer, graphite metal, rubber, woven fabric, smudged screen glass, optimized GLB topology."
        ),
        "negativePrompt": "brand logos, exact replica, exaggerated scale, toy-like proportions, melted keys, warped rows, illegible text labels, watermark, overdecorated sci-fi panels",
        "intendedUse": "comparison candidate only before any public catalog promotion",
        "referencePolicy": "Use public product pages for proportion and material study only; do not upload protected product imagery without review.",
        "meshApiPreflight": {
            "balanceEndpointReachable": False,
            "balanceAvailable": False,
            "providerPostSent": False,
            "reason": "not attempted inside Blender export; balance-only preflight may be recorded by a separate local command"
        }
    }
    write_json(review_dir / "meshy-prompt-pack-2026-05-21.json", prompt_pack)

    review = {
        "assetKey": ASSET_KEY,
        "status": "generic-desk-accessory-v2-real-scale-candidate-review-required",
        "generatedAt": f"{REVIEW_DATE}-{ASSET_REVISION}",
        "output": {
            "glb": str(glb_path.relative_to(repo_root)),
            "blend": str((blend_dir / f"{ASSET_KEY}.blend").relative_to(repo_root)),
            "runtimePackage": str((public_dir / "runtime-package.json").relative_to(repo_root)),
            "previews": [
                str((preview_dir / "commercial-desk-accessory-kit-v2-isometric.png").relative_to(repo_root)),
                str((preview_dir / "commercial-desk-accessory-kit-v2-keyboard-mouse-closeup.png").relative_to(repo_root)),
                str((preview_dir / "commercial-desk-accessory-kit-v2-monitor-speaker-closeup.png").relative_to(repo_root))
            ],
            "textures": texture_paths
        },
        "realScaleReferenceMm": REAL_SCALE_SPEC_MM,
        "metrics": stats,
        "referenceStudy": [
            {
                "label": "BenQ ScreenBar Halo specs",
                "url": "https://www.benq.com/en-us/lighting/monitor-light/screenbar-halo/spec.html",
                "usedFor": ["500mm light bar width", "warm diffuser material split", "counterweight clamp hierarchy"],
                "copied": False
            },
            {
                "label": "Logitech MX Mechanical Mini support specifications",
                "url": "https://support.logi.com/hc/en-ph/articles/5216756778647-Specification-MX-Mechanical-Mini",
                "usedFor": ["312.6mm keyboard width", "131.55mm depth", "26.1mm height", "compact low-profile key density"],
                "copied": False
            },
            {
                "label": "Logitech MX Master 3S product page",
                "url": "https://www.logitech.com/en-us/products/mice/mx-master-3s.910-006556.html",
                "usedFor": ["124.9mm mouse length", "84.3mm width", "51mm height", "thumb wing and side button hierarchy"],
                "copied": False
            },
            {
                "label": "Kanto ORA desktop speakers manual/spec page",
                "url": "https://www.kantoaudio.com/wp-content/uploads/ORA_EngManual_2023-11-08-linear.pdf",
                "usedFor": ["100x175x141mm speaker footprint", "white cabinet and black grille contrast", "driver face hierarchy"],
                "copied": False
            },
            {
                "label": "ASUS ROG OLED monitor product family page",
                "url": "https://rog.asus.com/monitors/32-to-34-inches/rog-swift-oled-pg32ucdm/",
                "usedFor": ["32-inch panel massing", "thin OLED display depth", "real monitor stand and rear VESA detail"],
                "copied": False
            }
        ],
        "commercialComparisonChecklist": [
            "v2 corrects v1's oversized keyboard, mouse, speakers, and monitor to measured product-class dimensions",
            "keyboard is now a 312mm-class compact layout with individual low-profile keycaps, rear USB-C slot, shadow plate, and micro legends",
            "mouse is now a 125mm-class asymmetric productivity shell with thumb wing, split click plates, side buttons, scroll wheel, and PTFE shadow",
            "speakers are now 100x175x141mm-class compact monitors with front-facing woofer/tweeter geometry, fabric baffle, status LED, port, feet, and stands",
            "monitor includes thin bezels, rear VESA plate, heat vent slits, hinge block, realistic base, screen smudge material, and 50cm light bar",
            "procedural PBR maps are packed into the GLB and runtime package; no third-party model or image is copied",
            "still requires human art review, Meshy candidate comparison after prompt approval, and final browser framing review"
        ],
        "licenseReview": {
            "selfAuthored": True,
            "thirdPartyModelCopied": False,
            "thirdPartyImageCopied": False,
            "releaseEligible": False,
            "notes": "Public product pages are references only. The GLB is generic prototype QA content."
        },
        "meshApi": prompt_pack
    }
    write_json(review_dir / "asset-review-2026-05-21.json", review)


def main() -> None:
    args = parse_args()
    repo_root = Path(args.repo_root).resolve()
    public_dir = repo_root / "apps/web/public/assets/models" / ASSET_KEY
    texture_dir = public_dir / "textures"
    if public_dir.exists():
        shutil.rmtree(public_dir)
    texture_dir.mkdir(parents=True, exist_ok=True)

    clear_scene()
    random.seed(47)

    speaker_base_path = texture_dir / "desk_accessory_speaker_fabric_basecolor_1k.png"
    speaker_rough_path = texture_dir / "desk_accessory_speaker_fabric_roughness_1k.png"
    speaker_height_path = texture_dir / "desk_accessory_speaker_fabric_height_1k.png"
    mat_base_path = texture_dir / "desk_accessory_black_deskmat_basecolor_1k.png"
    mat_rough_path = texture_dir / "desk_accessory_black_deskmat_roughness_1k.png"
    mat_height_path = texture_dir / "desk_accessory_black_deskmat_height_1k.png"
    keycap_base_path = texture_dir / "desk_accessory_pbt_keycap_basecolor_1k.png"
    keycap_rough_path = texture_dir / "desk_accessory_pbt_keycap_roughness_1k.png"
    screen_base_path = texture_dir / "desk_accessory_screen_glass_basecolor_1k.png"
    screen_rough_path = texture_dir / "desk_accessory_screen_glass_roughness_1k.png"

    speaker_base = make_image_file(speaker_base_path, "desk_accessory_speaker_fabric_basecolor_1k", 1024, 1024, speaker_fabric_base)
    speaker_rough = make_image_file(speaker_rough_path, "desk_accessory_speaker_fabric_roughness_1k", 1024, 1024, roughness_painter(0.86))
    speaker_height = make_image_file(speaker_height_path, "desk_accessory_speaker_fabric_height_1k", 1024, 1024, speaker_fabric_height)
    mat_base_img = make_image_file(mat_base_path, "desk_accessory_black_deskmat_basecolor_1k", 1024, 1024, rubber_mat_base)
    mat_rough_img = make_image_file(mat_rough_path, "desk_accessory_black_deskmat_roughness_1k", 1024, 1024, roughness_painter(0.82))
    mat_height_img = make_image_file(mat_height_path, "desk_accessory_black_deskmat_height_1k", 1024, 1024, speaker_fabric_height)
    keycap_base_img = make_image_file(keycap_base_path, "desk_accessory_pbt_keycap_basecolor_1k", 1024, 1024, keycap_base)
    keycap_rough_img = make_image_file(keycap_rough_path, "desk_accessory_pbt_keycap_roughness_1k", 1024, 1024, roughness_painter(0.68))
    screen_base_img = make_image_file(screen_base_path, "desk_accessory_screen_glass_basecolor_1k", 1024, 1024, screen_smudge_base)
    screen_rough_img = make_image_file(screen_rough_path, "desk_accessory_screen_glass_roughness_1k", 1024, 1024, roughness_painter(0.36))

    materials = {
        "speaker_fabric": material_with_maps("accessory_black_woven_speaker_fabric_pbr", speaker_base, speaker_rough, speaker_height, roughness=0.88, bump_strength=0.038),
        "desk_mat": material_with_maps("accessory_stitched_black_desk_mat_pbr", mat_base_img, mat_rough_img, mat_height_img, roughness=0.84, bump_strength=0.028),
        "keycap": material_with_maps("accessory_warm_white_pbt_keycap_pbr", keycap_base_img, keycap_rough_img, None, roughness=0.7),
        "screen": material_with_maps("accessory_subtle_smudged_oled_glass_pbr", screen_base_img, screen_rough_img, None, roughness=0.34, metalness=0.0, emissive=(0.05, 0.12, 0.2, 1), emissive_strength=0.18),
        "graphite": mat("accessory_satin_graphite_metal", (0.025, 0.029, 0.034, 1), 0.46, 0.42),
        "black_metal": mat("accessory_black_anodized_metal", (0.011, 0.013, 0.016, 1), 0.4, 0.58),
        "black_plastic": mat("accessory_matte_black_polymer", (0.012, 0.014, 0.017, 1), 0.62, 0.06),
        "silver": mat("accessory_brushed_aluminum_silver", (0.72, 0.76, 0.78, 1), 0.36, 0.45),
        "white_lacquer": mat("accessory_soft_white_lacquered_shell", (0.86, 0.88, 0.88, 1), 0.48, 0.08),
        "rubber": mat("accessory_soft_black_rubber", (0.007, 0.008, 0.01, 1), 0.84, 0.02),
        "mouse_shell": mat("accessory_satin_white_mouse_shell", (0.82, 0.86, 0.89, 1), 0.44, 0.12),
        "legend": mat("accessory_tiny_keycap_legend_dark_gray", (0.05, 0.055, 0.06, 1), 0.66, 0.0),
        "accent_key": mat("accessory_muted_sage_accent_key", (0.5, 0.66, 0.58, 1), 0.65, 0.0),
        "warm_emissive": mat("accessory_warm_led_diffuser_emissive", (1.0, 0.75, 0.45, 1), 0.36, 0.0, emissive=(1.0, 0.54, 0.26, 1), emissive_strength=1.2),
        "soft_screen_emissive": mat("accessory_soft_screen_ui_emissive", (0.3, 0.65, 0.9, 1), 0.5, 0.0, emissive=(0.2, 0.58, 0.94, 1), emissive_strength=0.72),
        "warm_wood": mat("accessory_small_oak_tray_satin_finish", (0.52, 0.31, 0.17, 1), 0.62, 0.02),
        "shadow": mat("accessory_deep_recess_shadow", (0.005, 0.006, 0.008, 1), 0.92, 0.0),
    }

    build_accessory_kit(materials)
    texture_paths = {
        "speakerFabricBaseColor": str(speaker_base_path.relative_to(repo_root)),
        "speakerFabricRoughness": str(speaker_rough_path.relative_to(repo_root)),
        "speakerFabricHeight": str(speaker_height_path.relative_to(repo_root)),
        "deskMatBaseColor": str(mat_base_path.relative_to(repo_root)),
        "deskMatRoughness": str(mat_rough_path.relative_to(repo_root)),
        "deskMatHeight": str(mat_height_path.relative_to(repo_root)),
        "keycapBaseColor": str(keycap_base_path.relative_to(repo_root)),
        "keycapRoughness": str(keycap_rough_path.relative_to(repo_root)),
        "screenGlassBaseColor": str(screen_base_path.relative_to(repo_root)),
        "screenGlassRoughness": str(screen_rough_path.relative_to(repo_root)),
    }
    export_asset(repo_root, texture_paths)


if __name__ == "__main__":
    main()
