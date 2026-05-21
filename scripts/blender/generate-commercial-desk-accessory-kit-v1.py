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


ASSET_KEY = "p2s_commercial_desk_accessory_kit_v1"
REVIEW_DATE = "2026-05-21"


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
    rounded_block("accessory_primary_monitor_graphite_back_shell", (1.18, 0.62, 0.055), (-0.34, 0.76, -0.34), materials["graphite"], 0.026, 10)
    curved_monitor_panel("accessory_primary_monitor_curved_oled_screen_surface", (-0.34, 0.76, -0.305), (1.09, 0.54), materials["screen"])
    rounded_block("accessory_primary_monitor_bottom_sensor_bar", (0.72, 0.018, 0.018), (-0.34, 0.49, -0.27), materials["black_plastic"], 0.006, 3)
    rounded_block("accessory_primary_monitor_lightbar_body", (0.74, 0.032, 0.036), (-0.34, 1.09, -0.31), materials["black_metal"], 0.014, 5)
    rounded_block("accessory_primary_monitor_lightbar_warm_diffuser", (0.68, 0.012, 0.014), (-0.34, 1.072, -0.272), materials["warm_emissive"], 0.005, 2)
    rounded_block("accessory_primary_monitor_satin_neck", (0.055, 0.38, 0.045), (-0.34, 0.31, -0.35), materials["black_metal"], 0.014, 5)
    rounded_block("accessory_primary_monitor_weighted_base", (0.52, 0.045, 0.3), (-0.34, 0.18, -0.2), materials["black_metal"], 0.03, 8)
    rounded_block("accessory_primary_monitor_base_rubber_inset", (0.42, 0.006, 0.21), (-0.34, 0.206, -0.2), materials["rubber"], 0.018, 5)
    for index, x in enumerate([-0.65, -0.42, -0.18, 0.1]):
        rounded_block(f"accessory_primary_monitor_refined_ui_tile_{index}", (0.12, 0.015, 0.018), (x, 0.86 - index * 0.06, -0.268), materials["soft_screen_emissive"], 0.006, 2)

    rounded_block("accessory_secondary_display_silver_back", (0.54, 0.34, 0.036), (0.42, 0.58, -0.18), materials["silver"], 0.018, 6, rotation_y=-0.16)
    rounded_block("accessory_secondary_display_glass", (0.49, 0.29, 0.011), (0.42, 0.58, -0.156), materials["screen"], 0.01, 4, rotation_y=-0.16)
    rounded_block("accessory_secondary_display_low_stand", (0.44, 0.024, 0.22), (0.42, 0.18, -0.06), materials["silver"], 0.014, 5, rotation_y=-0.16)


def build_keyboard_mouse(materials: dict[str, bpy.types.Material]) -> None:
    rounded_block("accessory_full_desk_mat_stitched_black_fabric", (1.66, 0.018, 0.58), (-0.05, 0.168, 0.17), materials["desk_mat"], 0.04, 10)
    rounded_block("accessory_keyboard_aluminum_low_profile_case", (0.78, 0.052, 0.235), (-0.25, 0.207, 0.12), materials["silver"], 0.022, 7, rotation_y=-0.05)
    rows = [
        (10, 0.056, -0.345),
        (11, 0.052, -0.36),
        (10, 0.056, -0.34),
        (8, 0.064, -0.285),
        (5, 0.09, -0.18),
    ]
    z_positions = [0.028, 0.081, 0.135, 0.188, 0.241]
    for row_index, ((count, key_w, start_x), z) in enumerate(zip(rows, z_positions)):
        for i in range(count):
            width = 0.17 if row_index == 4 and i == 2 else key_w
            x = -0.25 + start_x + i * (key_w + 0.014)
            mat_key = materials["keycap"] if not (row_index == 0 and i in {0, 9}) else materials["accent_key"]
            rounded_block(
                f"accessory_keyboard_individual_sculpted_keycap_r{row_index}_{i}",
                (width, 0.018, 0.04),
                (x, 0.245, z),
                mat_key,
                0.009,
                4,
                rotation_y=-0.05,
            )
    for idx, (x, z, width) in enumerate([(-0.59, 0.033, 0.026), (-0.61, 0.084, 0.034), (-0.46, 0.242, 0.03), (-0.26, 0.242, 0.075), (0.16, 0.188, 0.03)]):
        add_key_mark(f"accessory_keyboard_subtle_inset_mark_{idx}", (x, 0.257, z), materials["legend"], width)

    uv_sphere("accessory_mouse_sculpted_white_shell", (0.58, 0.22, 0.13), (0.105, 0.038, 0.17), materials["mouse_shell"], 48, 18)
    rounded_block("accessory_mouse_center_seam", (0.012, 0.009, 0.25), (0.58, 0.259, 0.13), materials["rubber"], 0.004, 2)
    cylinder_x("accessory_mouse_knurled_scroll_wheel", 0.018, 0.045, (0.58, 0.268, 0.03), materials["black_metal"], 28)
    rounded_block("accessory_mouse_side_button_1", (0.015, 0.011, 0.075), (0.505, 0.245, 0.04), materials["silver"], 0.004, 2)
    rounded_block("accessory_mouse_side_button_2", (0.015, 0.011, 0.06), (0.505, 0.242, 0.116), materials["silver"], 0.004, 2)


def build_speakers(materials: dict[str, bpy.types.Material]) -> None:
    for side, x, yaw in [("left", -1.0, 0.08), ("right", 0.88, -0.1)]:
        rounded_block(f"accessory_{side}_compact_speaker_white_cabinet", (0.24, 0.43, 0.26), (x, 0.385, -0.26), materials["white_lacquer"], 0.026, 8, rotation_y=yaw)
        rounded_block(f"accessory_{side}_speaker_black_front_baffle", (0.19, 0.34, 0.014), (x, 0.395, -0.12), materials["speaker_fabric"], 0.018, 6, rotation_y=yaw)
        for driver, y, radius in [("woofer", 0.33, 0.071), ("tweeter", 0.49, 0.037)]:
            cylinder_y(f"accessory_{side}_speaker_{driver}_outer_ring", radius, 0.014, (x, y, -0.106), materials["black_metal"], 48)
            cylinder_y(f"accessory_{side}_speaker_{driver}_soft_dome", radius * 0.62, 0.018, (x, y, -0.094), materials["rubber"], 48)
        rounded_block(f"accessory_{side}_speaker_short_decoupling_stand", (0.22, 0.035, 0.22), (x, 0.185, -0.25), materials["black_metal"], 0.018, 5, rotation_y=yaw)
        for foot_x in [-0.07, 0.07]:
            rounded_block(f"accessory_{side}_speaker_rubber_foot_{foot_x}", (0.035, 0.011, 0.035), (x + foot_x, 0.159, -0.16), materials["rubber"], 0.009, 3)


def build_lamp_and_mic(materials: dict[str, bpy.types.Material]) -> None:
    rounded_block("accessory_desk_lamp_weighted_disc_base", (0.25, 0.035, 0.2), (-1.16, 0.185, 0.1), materials["black_metal"], 0.034, 10)
    cylinder_y("accessory_desk_lamp_rear_pivot_hinge", 0.035, 0.065, (-1.16, 0.24, 0.1), materials["black_metal"], 32)
    cable_curve("accessory_desk_lamp_lower_arm_tube", [(-1.16, 0.25, 0.1), (-1.08, 0.48, 0.02), (-0.96, 0.62, -0.08)], materials["black_metal"], 0.014)
    cable_curve("accessory_desk_lamp_upper_arm_tube", [(-0.96, 0.62, -0.08), (-0.8, 0.74, -0.2), (-0.67, 0.76, -0.29)], materials["black_metal"], 0.014)
    rounded_block("accessory_desk_lamp_thin_rectangular_led_head", (0.38, 0.035, 0.09), (-0.62, 0.76, -0.31), materials["white_lacquer"], 0.02, 6, rotation_y=-0.16)
    rounded_block("accessory_desk_lamp_warm_diffuser_panel", (0.31, 0.011, 0.052), (-0.62, 0.735, -0.275), materials["warm_emissive"], 0.012, 4, rotation_y=-0.16)

    rounded_block("accessory_broadcast_mic_clamp", (0.12, 0.12, 0.09), (-1.31, 0.23, 0.39), materials["black_metal"], 0.016, 5)
    cable_curve("accessory_broadcast_mic_lower_boom", [(-1.27, 0.28, 0.37), (-1.12, 0.56, 0.28), (-0.92, 0.66, 0.22)], materials["black_metal"], 0.014)
    cable_curve("accessory_broadcast_mic_upper_boom", [(-0.92, 0.66, 0.22), (-0.78, 0.58, 0.14), (-0.7, 0.45, 0.11)], materials["black_metal"], 0.012)
    cylinder_y("accessory_broadcast_mic_capsule_body", 0.055, 0.17, (-0.68, 0.39, 0.09), materials["black_plastic"], 40)
    rounded_block("accessory_broadcast_mic_grille_highlight", (0.084, 0.12, 0.012), (-0.68, 0.41, 0.012), materials["speaker_fabric"], 0.009, 3)


def build_small_clutter(materials: dict[str, bpy.types.Material]) -> None:
    rounded_block("accessory_oak_tray_low_rounded_rect", (0.36, 0.032, 0.23), (0.93, 0.187, 0.2), materials["warm_wood"], 0.022, 6, rotation_y=-0.2)
    rounded_block("accessory_tray_recess_shadow", (0.3, 0.007, 0.17), (0.93, 0.207, 0.2), materials["shadow"], 0.016, 4, rotation_y=-0.2)
    cylinder_y("accessory_ceramic_mug_body", 0.06, 0.095, (-0.98, 0.235, 0.17), materials["white_lacquer"], 40)
    cylinder_y("accessory_ceramic_mug_inner_coffee_shadow", 0.048, 0.009, (-0.98, 0.287, 0.17), materials["shadow"], 40)
    cable_curve("accessory_visible_usb_c_cable_black", [(0.22, 0.195, 0.34), (0.4, 0.202, 0.29), (0.56, 0.202, 0.23), (0.71, 0.198, 0.28)], materials["rubber"], 0.006)
    cable_curve("accessory_speaker_cable_left", [(-0.98, 0.18, -0.1), (-0.72, 0.17, 0.0), (-0.42, 0.17, 0.02)], materials["rubber"], 0.005)
    cable_curve("accessory_speaker_cable_right", [(0.88, 0.18, -0.1), (0.72, 0.17, 0.02), (0.48, 0.17, 0.04)], materials["rubber"], 0.005)


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
    review_dir = repo_root / "assets/references/blender-authored/commercial-desk-accessory-kit-v1"
    preview_dir = review_dir / "previews"
    public_dir.mkdir(parents=True, exist_ok=True)
    blend_dir.mkdir(parents=True, exist_ok=True)
    preview_dir.mkdir(parents=True, exist_ok=True)

    set_metadata()
    add_preview_lights()
    render_preview(preview_dir / "commercial-desk-accessory-kit-v1-isometric.png", "commercial_accessory_preview_iso", (1.65, 1.42, 1.55), (-0.1, 0.48, -0.08), 2.05)
    render_preview(preview_dir / "commercial-desk-accessory-kit-v1-keyboard-closeup.png", "commercial_accessory_preview_keys", (0.72, 0.65, 0.72), (-0.05, 0.22, 0.15), 0.95)
    render_preview(preview_dir / "commercial-desk-accessory-kit-v1-speaker-monitor-closeup.png", "commercial_accessory_preview_speaker", (-1.0, 0.92, 0.56), (-0.58, 0.57, -0.21), 0.95)

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
        "version": REVIEW_DATE,
        "source": {
            "kind": "blender_authored_generic",
            "license": "self-authored; public product pages used only as non-copied references",
            "releaseEligible": False,
            "reviewRequired": True
        },
        "dimensionsMm": {"width": 2350, "depth": 910, "height": 1120},
        "pivot": {"origin": "desk-center-authored", "unit": "meters"},
        "collisionProxy": {"type": "box", "sizeMm": [2350, 910, 1120]},
        "textureSet": {
            "authored": "procedural_pbr_from_blender",
            "maps": texture_paths,
            "imageModelStatus": "not-used-in-this-run-openai-api-key-not-present-in-local-env"
        },
        "lodProfile": {"complexity": "medium-high", "maxTriangleCount": 90000, "targetDrawCalls": 18},
        "runtimeUrl": f"/assets/models/{ASSET_KEY}/{ASSET_KEY}.glb"
    }
    write_json(public_dir / "runtime-package.json", sidecar)

    prompt_pack = {
        "status": "review_pending_no_meshy_post_sent",
        "reason": "User requested prompt/reference review before Meshy text-to-3D or image-to-3D generation.",
        "textTo3dPromptCandidate": (
            "Generic high-end desk accessory kit for a cozy 3D deskterior room, no logos, thin black OLED monitor with light bar, "
            "low profile aluminum keyboard with individual keycaps, sculpted white wireless mouse, compact white desktop speakers with black fabric grilles, "
            "slim adjustable desk lamp, broadcast microphone arm, cable dressing, realistic PBR materials, clean GLB topology."
        ),
        "negativePrompt": "brand logos, exact replica, unreadable melted details, warped keyboard rows, extra monitors, watermark, product text labels",
        "intendedUse": "comparison candidate only before any public catalog promotion",
        "referencePolicy": "Use public product pages for proportion and material study only; do not upload protected product imagery without review.",
        "meshApiPreflight": {
            "balanceEndpointReachable": False,
            "balanceAvailable": False,
            "providerPostSent": False,
            "reason": "not attempted inside Blender export; use separate Meshy preflight command after prompt review"
        }
    }
    write_json(review_dir / "meshy-prompt-pack-2026-05-21.json", prompt_pack)

    review = {
        "assetKey": ASSET_KEY,
        "status": "generic-desk-accessory-commercial-candidate-review-required",
        "generatedAt": REVIEW_DATE,
        "output": {
            "glb": str(glb_path.relative_to(repo_root)),
            "blend": str((blend_dir / f"{ASSET_KEY}.blend").relative_to(repo_root)),
            "runtimePackage": str((public_dir / "runtime-package.json").relative_to(repo_root)),
            "previews": [
                str((preview_dir / "commercial-desk-accessory-kit-v1-isometric.png").relative_to(repo_root)),
                str((preview_dir / "commercial-desk-accessory-kit-v1-keyboard-closeup.png").relative_to(repo_root)),
                str((preview_dir / "commercial-desk-accessory-kit-v1-speaker-monitor-closeup.png").relative_to(repo_root))
            ],
            "textures": texture_paths
        },
        "metrics": stats,
        "referenceStudy": [
            {
                "label": "BenQ ScreenBar Halo product page",
                "url": "https://www.benq.com/en-us/lighting/monitor-light/screenbar-halo.html",
                "usedFor": ["monitor light bar silhouette", "warm diffuser material split", "desk lighting role"],
                "copied": False
            },
            {
                "label": "Logitech MX Mechanical Mini product page",
                "url": "https://www.logitech.com/en-us/products/keyboards/mx-mechanical-mini.920-010550.html",
                "usedFor": ["low-profile keyboard proportion", "individual keycap density", "aluminum keyboard material hierarchy"],
                "copied": False
            },
            {
                "label": "Logitech MX Master 3S product page",
                "url": "https://www.logitech.com/en-us/products/mice/mx-master-3s.910-006556.html",
                "usedFor": ["sculpted productivity mouse proportions", "scroll wheel/detail hierarchy"],
                "copied": False
            },
            {
                "label": "Kanto ORA desktop speakers product page",
                "url": "https://www.kantoaudio.com/powered-speakers/ora/",
                "usedFor": ["compact desktop speaker footprint", "white cabinet and black grille contrast", "driver face hierarchy"],
                "copied": False
            },
            {
                "label": "ASUS ROG OLED monitor product family page",
                "url": "https://rog.asus.com/monitors/32-to-34-inches/rog-swift-oled-pg32ucdm/",
                "usedFor": ["thin black OLED display massing", "large monitor as desk anchor", "subtle screen glass response"],
                "copied": False
            }
        ],
        "commercialComparisonChecklist": [
            "replaces scattered proxy models and rounded block overlays with one scale-consistent authored workstation kit",
            "keyboard uses individual sculpted keycaps plus tiny legends instead of a single keyboard slab",
            "speaker cabinets include separate lacquer body, fabric grille map, driver rings, dome material, stands, and rubber feet",
            "monitor includes curved screen surface, rear shell, light bar, diffuser, stand neck, base inset, and screen smudge PBR material",
            "desk lamp, microphone boom, cables, mouse, tray, and mug add believable work-surface density without copying brand geometry",
            "procedural PBR texture maps are packed into the GLB and surfaced in the runtime package",
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
