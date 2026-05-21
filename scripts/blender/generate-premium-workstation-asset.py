#!/usr/bin/env python3
"""Generate a standalone workstation desk GLB for the PC room QA scene."""

from __future__ import annotations

import argparse
import json
import math
import random
import sys
from pathlib import Path

import bpy


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
    world = bpy.context.scene.world or bpy.data.worlds.new("World")
    bpy.context.scene.world = world
    world.color = (0.018, 0.019, 0.024)


def to_blender_loc(loc: tuple[float, float, float]) -> tuple[float, float, float]:
    return (loc[0], -loc[2], loc[1])


def to_blender_size(size: tuple[float, float, float]) -> tuple[float, float, float]:
    return (size[0], size[2], size[1])


def make_image(name: str, width: int, height: int, painter) -> bpy.types.Image:
    image = bpy.data.images.new(name, width=width, height=height, alpha=True)
    pixels: list[float] = []
    for y in range(height):
        for x in range(width):
            pixels.extend(painter(x / max(width - 1, 1), y / max(height - 1, 1), x, y))
    image.pixels.foreach_set(pixels)
    image.pack()
    return image


def wood_painter(u: float, v: float, x: int, y: int) -> tuple[float, float, float, float]:
    seed = random.Random(x * 971 + y * 577)
    grain = 0.5 + 0.5 * math.sin((u * 8.5 + v * 24.0 + math.sin(u * 17.0) * 0.28) * math.pi)
    pore = (seed.random() - 0.5) * 0.055
    plank = 0.92 + (int(v * 7.0) % 4) * 0.025
    return (
        min(0.9, (0.54 + grain * 0.13 + pore) * plank),
        min(0.58, (0.31 + grain * 0.08 + pore * 0.65) * plank),
        min(0.38, (0.18 + grain * 0.05 + pore * 0.45) * plank),
        1.0,
    )


def mat(
    name: str,
    color: tuple[float, float, float, float],
    roughness: float,
    metallic: float = 0.0,
    alpha: float = 1.0,
    emissive: tuple[float, float, float] | None = None,
    emissive_strength: float = 0.0,
) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.blend_method = "BLEND" if alpha < 1 else "OPAQUE"
    material.use_screen_refraction = alpha < 0.5
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        if "Base Color" in bsdf.inputs:
            bsdf.inputs["Base Color"].default_value = color
        if "Roughness" in bsdf.inputs:
            bsdf.inputs["Roughness"].default_value = roughness
        if "Metallic" in bsdf.inputs:
            bsdf.inputs["Metallic"].default_value = metallic
        if "Alpha" in bsdf.inputs:
            bsdf.inputs["Alpha"].default_value = alpha
        if emissive and "Emission Color" in bsdf.inputs:
            bsdf.inputs["Emission Color"].default_value = (emissive[0], emissive[1], emissive[2], 1.0)
        if emissive and "Emission Strength" in bsdf.inputs:
            bsdf.inputs["Emission Strength"].default_value = emissive_strength
    return material


def textured_wood_mat(name: str) -> bpy.types.Material:
    material = mat(name, (0.58, 0.34, 0.19, 1), 0.72)
    image = make_image(f"{name}_procedural_oak_basecolor", 512, 512, wood_painter)
    try:
        image.colorspace_settings.name = "sRGB"
    except Exception:
        pass
    nodes = material.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")
    if bsdf:
        texture = nodes.new(type="ShaderNodeTexImage")
        texture.image = image
        material.node_tree.links.new(texture.outputs["Color"], bsdf.inputs["Base Color"])
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
        modifier = obj.modifiers.new(name=f"{name}_soft_bevel", type="BEVEL")
        modifier.width = bevel
        modifier.segments = segments
        modifier.affect = "EDGES"
        obj.modifiers.new(name=f"{name}_weighted_normals", type="WEIGHTED_NORMAL")
    obj.data.materials.append(material)
    return obj


def vertical_cylinder(
    name: str,
    radius: float,
    depth: float,
    loc: tuple[float, float, float],
    material: bpy.types.Material,
    vertices: int = 32,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=to_blender_loc(loc))
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(material)
    obj.modifiers.new(name=f"{name}_weighted_normals", type="WEIGHTED_NORMAL")
    return obj


def sphere(
    name: str,
    loc: tuple[float, float, float],
    scale: tuple[float, float, float],
    material: bpy.types.Material,
    segments: int = 24,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=max(8, segments // 2), radius=1.0, location=to_blender_loc(loc))
    obj = bpy.context.object
    obj.name = name
    obj.scale = to_blender_size(scale)
    obj.data.materials.append(material)
    obj.modifiers.new(name=f"{name}_weighted_normals", type="WEIGHTED_NORMAL")
    return obj


def cable_curve(
    name: str,
    points: list[tuple[float, float, float]],
    material: bpy.types.Material,
    bevel: float = 0.01,
) -> bpy.types.Object:
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
    return obj


def build_keyboard(origin: tuple[float, float, float], materials: dict[str, bpy.types.Material]) -> None:
    ox, oy, oz = origin
    rounded_block("premium_workstation_low_profile_keyboard_body", (0.84, 0.045, 0.25), origin, materials["ivory"], 0.025, 8, -0.04)
    key_w = 0.058
    key_d = 0.04
    for row in range(4):
        for col in range(12):
            if row == 3 and col in {10, 11}:
                continue
            x = ox - 0.36 + col * 0.066 + (row % 2) * 0.016
            z = oz - 0.082 + row * 0.052
            width = key_w * (1.6 if row == 3 and col in {4, 5} else 1.0)
            rounded_block(
                f"premium_workstation_keyboard_key_{row}_{col}",
                (width, 0.018, key_d),
                (x, oy + 0.032, z),
                materials["keycap"] if (row + col) % 5 else materials["accent_blue"],
                0.007,
                3,
                -0.04,
            )
    rounded_block("premium_workstation_keyboard_spacebar", (0.32, 0.018, 0.042), (ox + 0.02, oy + 0.035, oz + 0.11), materials["keycap"], 0.008, 3, -0.04)


def build_monitor(materials: dict[str, bpy.types.Material]) -> None:
    rounded_block("premium_workstation_main_monitor_outer_shell", (1.14, 0.68, 0.065), (-0.48, 0.56, -0.26), materials["dark_plastic"], 0.036, 8)
    rounded_block("premium_workstation_main_monitor_inner_screen", (0.98, 0.53, 0.018), (-0.48, 0.565, -0.219), materials["warm_screen"], 0.015, 4)
    for index, x in enumerate([-0.82, -0.56, -0.28, -0.1]):
        rounded_block(f"premium_workstation_main_screen_ui_tile_{index}", (0.16, 0.032, 0.01), (x, 0.72 - index * 0.052, -0.205), materials["paper"], 0.006, 2)
    rounded_block("premium_workstation_monitor_neck_bracket", (0.09, 0.42, 0.07), (-0.48, 0.255, -0.28), materials["black_metal"], 0.016, 5)
    rounded_block("premium_workstation_monitor_heavy_foot", (0.5, 0.055, 0.3), (-0.48, 0.04, -0.2), materials["black_metal"], 0.022, 6)

    rounded_block("premium_workstation_side_display_shell", (0.7, 0.42, 0.05), (0.32, 0.47, -0.22), materials["dark_plastic"], 0.026, 6, -0.1)
    rounded_block("premium_workstation_side_display_blue_screen", (0.61, 0.33, 0.016), (0.32, 0.47, -0.185), materials["cool_screen"], 0.012, 4, -0.1)
    rounded_block("premium_workstation_side_display_keyboard_deck", (0.72, 0.035, 0.42), (0.31, 0.165, -0.02), materials["silver"], 0.022, 6, -0.1)


def build_pc_tower(materials: dict[str, bpy.types.Material]) -> None:
    rounded_block("premium_workstation_white_pc_case_body", (0.56, 0.78, 0.42), (1.24, 0.38, -0.08), materials["pc_white"], 0.048, 10)
    rounded_block("premium_workstation_pc_recessed_front_mesh", (0.5, 0.66, 0.018), (1.24, 0.39, 0.142), materials["pc_mesh"], 0.018, 5)
    rounded_block("premium_workstation_pc_tempered_glass_side", (0.014, 0.66, 0.34), (0.955, 0.39, -0.08), materials["glass"], 0.018, 5)
    rounded_block("premium_workstation_pc_side_black_shadow_cavity", (0.026, 0.58, 0.29), (0.972, 0.39, -0.08), materials["pc_interior"], 0.018, 5)
    rounded_block("premium_workstation_pc_black_inner_chassis", (0.44, 0.61, 0.3), (1.22, 0.39, -0.08), materials["pc_interior"], 0.026, 6)
    rounded_block("premium_workstation_pc_motherboard_plate", (0.24, 0.36, 0.024), (1.14, 0.4, 0.075), materials["dark_plastic"], 0.015, 4)
    rounded_block("premium_workstation_pc_gpu_card", (0.31, 0.062, 0.074), (1.19, 0.29, 0.13), materials["pc_white"], 0.012, 4)
    for index, y in enumerate([0.58, 0.4, 0.22]):
        sphere(f"premium_workstation_pc_front_rgb_fan_{index}", (1.24, y, 0.155), (0.088, 0.088, 0.012), materials["fan_ring"], 32)
        sphere(f"premium_workstation_pc_front_fan_hub_{index}", (1.24, y, 0.168), (0.026, 0.026, 0.008), materials["silver"], 20)
        sphere(f"premium_workstation_pc_side_visible_rgb_fan_{index}", (0.943, y, -0.08), (0.012, 0.082, 0.082), materials["fan_ring"], 32)
    for index, z in enumerate([-0.2, -0.08, 0.04]):
        rounded_block(
            f"premium_workstation_pc_top_vent_slot_{index}",
            (0.36, 0.012, 0.018),
            (1.24, 0.787, z),
            materials["pc_mesh"],
            0.004,
            2,
        )
    rounded_block("premium_workstation_pc_front_vertical_rgb_strip", (0.028, 0.62, 0.014), (0.965, 0.4, 0.145), materials["accent_pink"], 0.007, 3)
    rounded_block("premium_workstation_pc_top_power_button", (0.052, 0.012, 0.052), (1.03, 0.796, -0.19), materials["accent_blue"], 0.012, 5)
    rounded_block("premium_workstation_pc_rear_panel_shadow_line", (0.018, 0.58, 0.3), (1.525, 0.38, -0.06), materials["black_metal"], 0.008, 3)
    for x, mat_name in [(1.1, "accent_blue"), (1.17, "accent_pink"), (1.24, "amber")]:
        rounded_block(f"premium_workstation_pc_rgb_ram_{x}", (0.022, 0.19, 0.024), (x, 0.49, 0.11), materials[mat_name], 0.006, 2)
    cable_curve("premium_workstation_pc_white_sleeved_cable", [(1.36, 0.57, 0.08), (1.22, 0.51, 0.15), (1.12, 0.39, 0.14)], materials["white_cable"], 0.009)
    cable_curve("premium_workstation_pc_pink_sleeved_cable", [(1.35, 0.49, 0.04), (1.24, 0.43, 0.13), (1.18, 0.31, 0.14)], materials["accent_pink"], 0.007)


def build_accessories(materials: dict[str, bpy.types.Material]) -> None:
    rounded_block("premium_workstation_wide_felt_desk_mat", (1.62, 0.018, 0.5), (-0.28, 0.135, 0.12), materials["desk_mat"], 0.027, 8)
    for x in [-0.84, -0.48, -0.12, 0.24]:
        rounded_block(f"premium_workstation_desk_mat_woven_ridge_{x}", (0.018, 0.012, 0.43), (x, 0.154, 0.12), materials["mat_ridge"], 0.004, 2)
    build_keyboard((-0.5, 0.185, 0.17), materials)
    sphere("premium_workstation_wireless_mouse_soft_shell", (0.22, 0.195, 0.16), (0.105, 0.035, 0.068), materials["ivory"], 32)
    rounded_block("premium_workstation_mouse_scroll_wheel", (0.012, 0.018, 0.05), (0.22, 0.232, 0.11), materials["black_metal"], 0.004, 2)
    rounded_block("premium_workstation_streamdeck_body", (0.36, 0.045, 0.18), (0.34, 0.195, -0.18), materials["dark_plastic"], 0.02, 5, 0.18)
    for row in range(2):
        for col in range(4):
            rounded_block(
                f"premium_workstation_streamdeck_lit_key_{row}_{col}",
                (0.054, 0.014, 0.04),
                (0.24 + col * 0.07, 0.229, -0.215 + row * 0.058),
                materials["accent_blue"] if (row + col) % 2 else materials["accent_pink"],
                0.006,
                2,
                0.18,
            )
    rounded_block("premium_workstation_notebook_warm_pages", (0.34, 0.035, 0.24), (-1.06, 0.18, -0.16), materials["paper"], 0.014, 4, -0.08)
    rounded_block("premium_workstation_notebook_leather_band", (0.26, 0.012, 0.018), (-1.06, 0.21, -0.235), materials["warm_leather"], 0.004, 2, -0.08)
    vertical_cylinder("premium_workstation_ceramic_mug_body", 0.07, 0.11, (-1.22, 0.205, 0.18), materials["ceramic"], 32)
    vertical_cylinder("premium_workstation_mug_dark_coffee", 0.052, 0.008, (-1.22, 0.265, 0.18), materials["coffee"], 32)
    rounded_block("premium_workstation_mug_handle", (0.025, 0.065, 0.07), (-1.29, 0.225, 0.18), materials["ceramic"], 0.012, 5)
    vertical_cylinder("premium_workstation_planter_ceramic_pot", 0.085, 0.12, (0.82, 0.21, 0.27), materials["ceramic"], 32)
    for index in range(9):
        angle = index * math.tau / 9
        leaf_x = 0.82 + math.cos(angle) * 0.075
        leaf_z = 0.27 + math.sin(angle) * 0.06
        rounded_block(f"premium_workstation_pilea_leaf_{index}", (0.12, 0.012, 0.045), (leaf_x, 0.31 + (index % 3) * 0.018, leaf_z), materials["leaf"], 0.018, 5, angle)
    for side, x in [("left", -1.18), ("right", 0.72)]:
        rounded_block(f"premium_workstation_{side}_compact_speaker_body", (0.18, 0.36, 0.16), (x, 0.34, -0.16), materials["dark_plastic"], 0.026, 7)
        for y in [0.28, 0.41]:
            sphere(f"premium_workstation_{side}_speaker_cone_{y}", (x, y, -0.075), (0.055, 0.055, 0.014), materials["speaker_cone"], 28)


def build_mic_and_lamp(materials: dict[str, bpy.types.Material]) -> None:
    rounded_block("premium_workstation_mic_clamp", (0.16, 0.08, 0.12), (-1.28, 0.16, 0.34), materials["black_metal"], 0.018, 5)
    rounded_block("premium_workstation_mic_lower_boom_arm", (0.06, 0.58, 0.05), (-1.05, 0.49, 0.22), materials["black_metal"], 0.012, 4, -0.62)
    rounded_block("premium_workstation_mic_upper_boom_arm", (0.052, 0.56, 0.045), (-0.62, 0.77, 0.07), materials["black_metal"], 0.012, 4, -0.22)
    sphere("premium_workstation_mic_arm_joint_a", (-1.21, 0.26, 0.3), (0.045, 0.045, 0.045), materials["black_metal"], 20)
    sphere("premium_workstation_mic_arm_joint_b", (-0.78, 0.68, 0.1), (0.04, 0.04, 0.04), materials["black_metal"], 20)
    vertical_cylinder("premium_workstation_studio_microphone_capsule", 0.07, 0.19, (-0.43, 0.54, 0.02), materials["mic_grille"], 32)
    rounded_block("premium_workstation_microphone_yoke", (0.16, 0.025, 0.11), (-0.43, 0.43, 0.02), materials["black_metal"], 0.01, 4)

    vertical_cylinder("premium_workstation_lamp_round_base", 0.11, 0.026, (-1.24, 0.17, -0.27), materials["white_lacquer"], 36)
    rounded_block("premium_workstation_lamp_lower_stem", (0.045, 0.42, 0.045), (-1.18, 0.39, -0.25), materials["white_lacquer"], 0.012, 5, -0.18)
    rounded_block("premium_workstation_lamp_upper_stem", (0.04, 0.36, 0.04), (-1.0, 0.67, -0.25), materials["white_lacquer"], 0.012, 5, -0.42)
    sphere("premium_workstation_lamp_warm_diffuser", (-0.82, 0.75, -0.22), (0.16, 0.105, 0.13), materials["lamp_glow"], 32)
    rounded_block("premium_workstation_lamp_shade_outer_shell", (0.26, 0.11, 0.18), (-0.82, 0.75, -0.22), materials["lamp_shell"], 0.035, 8, -0.2)


def build_desk(materials: dict[str, bpy.types.Material]) -> None:
    rounded_block("premium_workstation_oiled_oak_waterfall_top", (3.04, 0.13, 0.96), (0, 0.0, 0), materials["wood"], 0.055, 10)
    rounded_block("premium_workstation_oak_front_soft_bullnose", (2.92, 0.052, 0.06), (0, 0.055, 0.49), materials["wood"], 0.022, 6)
    rounded_block("premium_workstation_rear_black_cable_raceway", (2.32, 0.055, 0.065), (0.24, -0.055, -0.48), materials["black_metal"], 0.014, 4)
    vertical_cylinder("premium_workstation_round_black_wire_grommet", 0.056, 0.018, (-0.1, 0.085, -0.36), materials["black_metal"], 36)
    for x in [-1.32, 1.32]:
        for z in [-0.36, 0.36]:
            vertical_cylinder(f"premium_workstation_tapered_black_steel_leg_{x}_{z}", 0.04, 0.88, (x, -0.47, z), materials["black_metal"], 24)
            sphere(f"premium_workstation_leveling_glide_{x}_{z}", (x, -0.93, z), (0.055, 0.014, 0.055), materials["black_metal"], 18)
    rounded_block("premium_workstation_left_lacquer_drawer_carcase", (0.57, 0.6, 0.36), (-1.08, -0.33, 0.36), materials["white_lacquer"], 0.025, 6)
    for index, y in enumerate([-0.52, -0.34, -0.16]):
        rounded_block(f"premium_workstation_lacquer_drawer_front_{index}", (0.49, 0.12, 0.035), (-1.08, y, 0.56), materials["white_lacquer"], 0.016, 4)
        rounded_block(f"premium_workstation_drawer_shadow_pull_{index}", (0.33, 0.016, 0.016), (-1.08, y + 0.02, 0.585), materials["black_metal"], 0.006, 2)


def build_scene() -> dict[str, bpy.types.Material]:
    materials = {
        "wood": textured_wood_mat("premium_workstation_oiled_oak_pbr"),
        "black_metal": mat("premium_workstation_black_powder_coated_metal", (0.015, 0.018, 0.022, 1), 0.48, 0.5),
        "dark_plastic": mat("premium_workstation_soft_black_plastic", (0.025, 0.032, 0.042, 1), 0.66, 0.05),
        "white_lacquer": mat("premium_workstation_warm_white_satin_lacquer", (0.8, 0.8, 0.76, 1), 0.5, 0.04),
        "pc_white": mat("premium_workstation_pc_satin_white_powdercoat", (0.72, 0.74, 0.72, 1), 0.56, 0.08),
        "pc_mesh": mat("premium_workstation_pc_perforated_shadow_mesh", (0.08, 0.095, 0.11, 1), 0.62, 0.16),
        "ivory": mat("premium_workstation_ivory_input_device_plastic", (0.84, 0.88, 0.9, 1), 0.5, 0.02),
        "keycap": mat("premium_workstation_sculpted_grey_keycaps", (0.64, 0.7, 0.74, 1), 0.55, 0.02),
        "silver": mat("premium_workstation_brushed_silver_aluminum", (0.68, 0.72, 0.74, 1), 0.34, 0.45),
        "desk_mat": mat("premium_workstation_woven_deep_blue_deskmat", (0.04, 0.07, 0.1, 1), 0.93),
        "mat_ridge": mat("premium_workstation_raised_deskmat_weave", (0.13, 0.22, 0.31, 1), 0.96),
        "paper": mat("premium_workstation_warm_notebook_paper", (0.82, 0.76, 0.68, 1), 0.82),
        "warm_leather": mat("premium_workstation_cognac_leather_detail", (0.52, 0.27, 0.14, 1), 0.72),
        "ceramic": mat("premium_workstation_warm_ceramic", (0.92, 0.89, 0.84, 1), 0.62),
        "coffee": mat("premium_workstation_dark_coffee_surface", (0.09, 0.045, 0.025, 1), 0.42),
        "leaf": mat("premium_workstation_satin_green_leaf", (0.18, 0.45, 0.28, 1), 0.72),
        "speaker_cone": mat("premium_workstation_speaker_ribbed_cone", (0.08, 0.095, 0.11, 1), 0.62, 0.08),
        "mic_grille": mat("premium_workstation_dark_microphone_grille", (0.065, 0.07, 0.08, 1), 0.42, 0.36),
        "lamp_shell": mat("premium_workstation_cream_lamp_shade_shell", (0.92, 0.86, 0.72, 1), 0.48, 0.02),
        "lamp_glow": mat("premium_workstation_warm_lamp_diffuser_emissive", (1.0, 0.86, 0.55, 1), 0.36, 0.0, 1.0, (1.0, 0.68, 0.28), 1.1),
        "warm_screen": mat("premium_workstation_warm_monitor_screen_emissive", (0.9, 0.45, 0.16, 1), 0.34, 0.0, 1.0, (0.95, 0.36, 0.12), 0.55),
        "cool_screen": mat("premium_workstation_cool_secondary_screen_emissive", (0.1, 0.22, 0.34, 1), 0.42, 0.0, 1.0, (0.12, 0.42, 0.72), 0.45),
        "accent_blue": mat("premium_workstation_rgb_cyan_accent", (0.42, 0.83, 1.0, 1), 0.38, 0.0, 1.0, (0.2, 0.62, 1.0), 0.45),
        "accent_pink": mat("premium_workstation_rgb_pink_accent", (1.0, 0.38, 0.62, 1), 0.4, 0.0, 1.0, (1.0, 0.17, 0.44), 0.42),
        "amber": mat("premium_workstation_amber_indicator_accent", (0.95, 0.68, 0.28, 1), 0.42, 0.0, 1.0, (0.9, 0.42, 0.08), 0.28),
        "glass": mat("premium_workstation_smoked_tempered_glass", (0.62, 0.84, 0.95, 1), 0.18, 0.02, 0.23),
        "pc_interior": mat("premium_workstation_shadowed_pc_interior", (0.018, 0.028, 0.038, 1), 0.68, 0.18),
        "fan_ring": mat("premium_workstation_pc_rgb_fan_diffuser", (0.58, 0.86, 1.0, 1), 0.36, 0.02, 1.0, (0.32, 0.72, 1.0), 0.5),
        "white_cable": mat("premium_workstation_white_sleeved_cable", (0.86, 0.88, 0.88, 1), 0.66),
    }
    build_desk(materials)
    build_monitor(materials)
    build_accessories(materials)
    build_mic_and_lamp(materials)
    build_pc_tower(materials)
    for index, points in enumerate(
        [
            [(-0.1, 0.09, -0.36), (-0.18, 0.13, -0.42), (-0.46, 0.2, -0.28), (-0.48, 0.26, -0.22)],
            [(0.32, 0.17, -0.03), (0.48, 0.12, -0.18), (0.72, 0.1, -0.34), (1.01, 0.18, -0.32)],
            [(-0.43, 0.43, 0.02), (-0.68, 0.28, 0.02), (-0.98, 0.18, 0.22), (-1.22, 0.16, 0.34)],
        ]
    ):
        cable_curve(f"premium_workstation_visible_managed_cable_{index}", points, materials["black_metal"], 0.007)
    return materials


def add_preview_lights() -> None:
    bpy.ops.object.light_add(type="AREA", location=(0.0, -2.6, 3.2))
    key = bpy.context.object
    key.name = "preview_workstation_softbox"
    key.data.energy = 360
    key.data.size = 4.0
    bpy.ops.object.light_add(type="POINT", location=(-2.2, -0.8, 1.4))
    warm = bpy.context.object
    warm.name = "preview_workstation_warm_lamp_bounce"
    warm.data.energy = 70
    warm.data.color = (1.0, 0.58, 0.28)


def mesh_stats() -> dict[str, int]:
    depsgraph = bpy.context.evaluated_depsgraph_get()
    exportable_mesh_objects = [obj for obj in bpy.context.scene.objects if obj.type in {"MESH", "CURVE"}]
    triangles = 0
    for obj in exportable_mesh_objects:
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        try:
            triangles += sum(max(len(poly.vertices) - 2, 1) for poly in mesh.polygons)
        finally:
            evaluated.to_mesh_clear()
    return {
        "nodes": len(bpy.context.scene.objects),
        "meshes": len(exportable_mesh_objects),
        "materials": len(bpy.data.materials),
        "triangles": triangles,
    }


def export_asset(repo_root: Path) -> None:
    public_dir = repo_root / "apps/web/public/assets/models/p2s_premium_workstation_hero"
    blend_dir = repo_root / "assets/blender/deskterior"
    review_dir = repo_root / "assets/references/blender-authored/premium-workstation-hero"
    public_dir.mkdir(parents=True, exist_ok=True)
    blend_dir.mkdir(parents=True, exist_ok=True)
    review_dir.mkdir(parents=True, exist_ok=True)

    blend_path = blend_dir / "p2s_premium_workstation_hero.blend"
    glb_path = public_dir / "p2s_premium_workstation_hero.glb"
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
    bpy.ops.export_scene.gltf(
        filepath=str(glb_path),
        export_format="GLB",
        export_yup=True,
        export_materials="EXPORT",
        export_apply=True,
        export_animations=False,
    )
    review = {
        "asset": "p2s_premium_workstation_hero",
        "status": "standalone-generated-review-required",
        "sourceBlend": str(blend_path.relative_to(repo_root)),
        "publicGlb": str(glb_path.relative_to(repo_root)),
        "metrics": mesh_stats(),
        "visualScope": [
            "desk",
            "monitor",
            "secondary display",
            "keyboard",
            "mouse",
            "microphone arm",
            "desk lamp",
            "desk mat",
            "notebook",
            "mug",
            "planter",
            "speakers",
            "managed cables",
            "white glass PC tower",
        ],
        "stillRequires": [
            "human art review",
            "final UV unwrap and texture atlas",
            "baked AO/GI/lightmap",
            "LOD/proxy/collider package",
            "licensed/open commercial reference comparison",
        ],
    }
    (review_dir / "asset-review-2026-05-20.json").write_text(json.dumps(review, indent=2), encoding="utf-8")


def main() -> None:
    args = parse_args()
    clear_scene()
    build_scene()
    add_preview_lights()
    export_asset(Path(args.repo_root))


if __name__ == "__main__":
    main()
