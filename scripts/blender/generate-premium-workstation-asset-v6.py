#!/usr/bin/env python3
"""Generate workstation candidate v6 with desktop micro-detail refinement.

V5 fixed the UVAtlas sampling defect. V6 keeps that package work and targets the
remaining visible desk-quality problem: desktop objects still read too much like
clean primitives when the camera moves close.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import math
import sys
from collections import Counter
from pathlib import Path

import bpy


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-root", required=True)
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else sys.argv[1:]
    return parser.parse_args(argv)


def load_script(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to import script: {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


v5 = load_script("premium_workstation_v5", Path(__file__).with_name("generate-premium-workstation-asset-v5.py"))
v4 = v5.v4
v3 = v5.v3
v2 = v5.v2
base = v5.base


DETAIL_CATEGORY: dict[str, str] = {}


def mark(obj: bpy.types.Object | None, category: str) -> None:
    if obj is not None:
        DETAIL_CATEGORY[obj.name] = category


def rb(
    category: str,
    name: str,
    size: tuple[float, float, float],
    loc: tuple[float, float, float],
    material: bpy.types.Material,
    bevel: float,
    segments: int = 3,
    rotation_y: float = 0.0,
) -> bpy.types.Object:
    obj = base.rounded_block(name, size, loc, material, bevel, segments, rotation_y)
    mark(obj, category)
    return obj


def sp(
    category: str,
    name: str,
    loc: tuple[float, float, float],
    scale: tuple[float, float, float],
    material: bpy.types.Material,
    segments: int = 20,
) -> bpy.types.Object:
    obj = base.sphere(name, loc, scale, material, segments)
    mark(obj, category)
    return obj


def cable(
    category: str,
    name: str,
    points: list[tuple[float, float, float]],
    material: bpy.types.Material,
    bevel: float,
) -> bpy.types.Object:
    obj = base.cable_curve(name, points, material, bevel)
    mark(obj, category)
    return obj


def cyl_y(
    category: str,
    name: str,
    radius: float,
    depth: float,
    loc: tuple[float, float, float],
    material: bpy.types.Material,
    vertices: int = 24,
) -> bpy.types.Object:
    obj = base.vertical_cylinder(name, radius, depth, loc, material, vertices)
    mark(obj, category)
    return obj


def cyl_x(
    category: str,
    name: str,
    radius: float,
    depth: float,
    loc: tuple[float, float, float],
    material: bpy.types.Material,
    vertices: int = 24,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=depth,
        location=base.to_blender_loc(loc),
        rotation=(0.0, math.pi / 2.0, 0.0),
    )
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(material)
    obj.modifiers.new(name=f"{name}_weighted_normals", type="WEIGHTED_NORMAL")
    mark(obj, category)
    return obj


def cyl_z(
    category: str,
    name: str,
    radius: float,
    depth: float,
    loc: tuple[float, float, float],
    material: bpy.types.Material,
    vertices: int = 24,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=depth,
        location=base.to_blender_loc(loc),
        rotation=(math.pi / 2.0, 0.0, 0.0),
    )
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(material)
    obj.modifiers.new(name=f"{name}_weighted_normals", type="WEIGHTED_NORMAL")
    mark(obj, category)
    return obj


def detail_materials() -> dict[str, bpy.types.Material]:
    return {
        "graphite": base.mat("premium_workstation_v6_graphite_detail", (0.014, 0.016, 0.018, 1), 0.78, 0.04),
        "soft_black": base.mat("premium_workstation_v6_soft_black_detail", (0.006, 0.007, 0.008, 1), 0.9, 0.0),
        "warm_oak": base.mat("premium_workstation_v6_warm_oak_detail", (0.52, 0.29, 0.14, 1), 0.66, 0.0),
        "edge_oak": base.mat("premium_workstation_v6_oak_endgrain_detail", (0.38, 0.2, 0.1, 1), 0.72, 0.0),
        "matte_white": base.mat("premium_workstation_v6_matte_white_plastic", (0.82, 0.83, 0.8, 1), 0.6, 0.02),
        "paper": base.mat("premium_workstation_v6_warm_paper_stack", (0.82, 0.76, 0.65, 1), 0.78, 0.0),
        "paper_edge": base.mat("premium_workstation_v6_paper_layer_edge", (0.64, 0.58, 0.5, 1), 0.82, 0.0),
        "blue": base.mat("premium_workstation_v6_muted_blue_accent", (0.28, 0.48, 0.62, 1), 0.62, 0.0, 1.0, (0.04, 0.12, 0.18), 0.08),
        "pink": base.mat("premium_workstation_v6_muted_pink_accent", (0.76, 0.43, 0.48, 1), 0.64, 0.0, 1.0, (0.2, 0.06, 0.08), 0.1),
        "amber": base.mat("premium_workstation_v6_warm_status_led", (0.86, 0.56, 0.28, 1), 0.48, 0.0, 1.0, (0.55, 0.22, 0.05), 0.28),
        "metal": base.mat("premium_workstation_v6_brushed_dark_metal", (0.05, 0.052, 0.056, 1), 0.34, 0.55),
        "silver": base.mat("premium_workstation_v6_soft_silver_metal", (0.62, 0.62, 0.58, 1), 0.38, 0.35),
        "glass": base.mat("premium_workstation_v6_smoked_glass_detail", (0.24, 0.34, 0.38, 1), 0.18, 0.02, 0.35),
        "coffee": base.mat("premium_workstation_v6_coffee_surface", (0.08, 0.045, 0.025, 1), 0.42, 0.0),
        "plant": base.mat("premium_workstation_v6_planter_leaf_green", (0.26, 0.5, 0.34, 1), 0.58, 0.0),
        "soil": base.mat("premium_workstation_v6_dark_soil", (0.055, 0.038, 0.025, 1), 0.88, 0.0),
        "shadow": base.mat("premium_workstation_v6_micro_contact_shadow", (0.005, 0.004, 0.003, 1), 0.92, 0.0, 0.46),
    }


def add_monitor_and_display_detail(mats: dict[str, bpy.types.Material]) -> None:
    for x in [-0.94, -0.02]:
        rb("monitor", f"premium_workstation_v6_monitor_bezel_side_{x}", (0.018, 0.52, 0.012), (x, 0.565, -0.192), mats["graphite"], 0.004, 2)
    for y, name in [(0.836, "top"), (0.293, "bottom")]:
        rb("monitor", f"premium_workstation_v6_monitor_bezel_{name}", (0.98, 0.018, 0.012), (-0.48, y, -0.192), mats["graphite"], 0.004, 2)
    rb("monitor", "premium_workstation_v6_monitor_bottom_sensor_bar", (0.28, 0.018, 0.016), (-0.48, 0.3, -0.178), mats["metal"], 0.005, 2)
    for i, x in enumerate([-0.72, -0.58, -0.44, -0.3, -0.16]):
        rb("monitor", f"premium_workstation_v6_monitor_rear_vent_{i}", (0.08, 0.008, 0.018), (x, 0.61, -0.322), mats["soft_black"], 0.002, 1)
    for i, (x, y) in enumerate([(-0.54, 0.52), (-0.42, 0.52), (-0.54, 0.64), (-0.42, 0.64)]):
        cyl_z("monitor", f"premium_workstation_v6_monitor_vesa_screw_{i}", 0.009, 0.006, (x, y, -0.336), mats["silver"], 16)
    rb("monitor", "premium_workstation_v6_monitor_usb_c_port", (0.052, 0.012, 0.01), (-0.27, 0.36, -0.337), mats["soft_black"], 0.003, 1)
    rb("monitor", "premium_workstation_v6_monitor_hdmi_port", (0.066, 0.016, 0.01), (-0.18, 0.36, -0.337), mats["soft_black"], 0.003, 1)
    cable("cables", "premium_workstation_v6_monitor_power_cable_strain_relief", [(-0.21, 0.36, -0.34), (-0.2, 0.25, -0.43), (-0.06, 0.16, -0.48)], mats["soft_black"], 0.006)

    rb("display", "premium_workstation_v6_laptop_screen_lip_highlight", (0.61, 0.012, 0.012), (0.32, 0.653, -0.177), mats["silver"], 0.003, 1, -0.1)
    for i, x in enumerate([0.12, 0.22, 0.32, 0.42, 0.52]):
        rb("display", f"premium_workstation_v6_laptop_keyboard_row_{i}", (0.052, 0.008, 0.18), (x, 0.186, 0.0), mats["graphite"], 0.004, 1, -0.1)
    rb("display", "premium_workstation_v6_laptop_trackpad_inset", (0.2, 0.008, 0.12), (0.33, 0.188, 0.13), mats["silver"], 0.006, 2, -0.1)


def add_keyboard_mouse_detail(mats: dict[str, bpy.types.Material]) -> None:
    # Keycap legends and stabilizer details, not just key blocks.
    for row in range(4):
        for col in range(12):
            if row == 3 and col in {10, 11}:
                continue
            x = -0.86 + col * 0.066 + (row % 2) * 0.016
            z = 0.038 + row * 0.052
            rb("keyboard", f"premium_workstation_v6_keycap_legend_bar_{row}_{col}", (0.024, 0.0035, 0.004), (x, 0.204, z), mats["paper_edge"] if (row + col) % 7 else mats["blue"], 0.001, 1, -0.04)
    rb("keyboard", "premium_workstation_v6_keyboard_volume_knob_base", (0.048, 0.014, 0.048), (-0.05, 0.205, 0.245), mats["metal"], 0.012, 8)
    cyl_y("keyboard", "premium_workstation_v6_keyboard_volume_knob_cap", 0.022, 0.016, (-0.05, 0.218, 0.245), mats["silver"], 24)
    rb("keyboard", "premium_workstation_v6_keyboard_usb_c_recess", (0.075, 0.008, 0.018), (-0.58, 0.176, -0.025), mats["soft_black"], 0.003, 1, -0.04)
    cable("cables", "premium_workstation_v6_coiled_keyboard_cable", [(-0.58, 0.176, -0.035), (-0.8, 0.18, -0.08), (-1.05, 0.18, -0.18), (-1.18, 0.2, -0.24)], mats["graphite"], 0.006)
    for i in range(7):
        cyl_x("cables", f"premium_workstation_v6_keyboard_coil_segment_{i}", 0.008, 0.046, (-0.72 - i * 0.034, 0.185, -0.078 - i * 0.012), mats["graphite"], 14)

    rb("mouse", "premium_workstation_v6_mouse_left_button", (0.062, 0.009, 0.096), (0.17, 0.205, 0.117), mats["graphite"], 0.012, 4, -0.05)
    rb("mouse", "premium_workstation_v6_mouse_right_button", (0.062, 0.009, 0.096), (0.236, 0.205, 0.117), mats["graphite"], 0.012, 4, -0.05)
    cyl_x("mouse", "premium_workstation_v6_mouse_scroll_wheel", 0.012, 0.036, (0.203, 0.216, 0.064), mats["silver"], 18)
    rb("mouse", "premium_workstation_v6_mouse_side_button_forward", (0.009, 0.015, 0.038), (0.13, 0.203, 0.14), mats["blue"], 0.004, 1, -0.05)
    rb("mouse", "premium_workstation_v6_mouse_side_button_back", (0.009, 0.015, 0.038), (0.13, 0.203, 0.19), mats["pink"], 0.004, 1, -0.05)
    rb("mouse", "premium_workstation_v6_mouse_sensor_shadow", (0.1, 0.004, 0.035), (0.2, 0.188, 0.18), mats["shadow"], 0.008, 2, -0.05)


def add_audio_lighting_detail(mats: dict[str, bpy.types.Material]) -> None:
    for side, x in [("left", -1.18), ("right", 0.72)]:
        rb("speaker", f"premium_workstation_v6_{side}_speaker_cloth_frame", (0.145, 0.285, 0.024), (x, 0.31, -0.14), mats["graphite"], 0.012, 4)
        for i, y in enumerate([0.25, 0.35]):
            sp("speaker", f"premium_workstation_v6_{side}_speaker_driver_outer_{i}", (x, y, -0.118), (0.042, 0.042, 0.008), mats["silver"], 24)
            sp("speaker", f"premium_workstation_v6_{side}_speaker_driver_cone_{i}", (x, y, -0.11), (0.027, 0.027, 0.006), mats["soft_black"], 20)
        for i in range(5):
            rb("speaker", f"premium_workstation_v6_{side}_speaker_grille_thread_{i}", (0.115, 0.003, 0.004), (x, 0.215 + i * 0.045, -0.101), mats["soft_black"], 0.001, 1)

    for i, x in enumerate([-1.04, -0.95, -0.86]):
        cyl_z("lamp", f"premium_workstation_v6_lightbar_led_diffuser_segment_{i}", 0.01, 0.19, (x, 0.74, -0.285), mats["amber"], 18)
    for i, (x, y, z) in enumerate([(-0.98, 0.53, -0.27), (-1.1, 0.42, -0.17), (-1.18, 0.23, -0.08)]):
        sp("lamp", f"premium_workstation_v6_lamp_hinge_screw_{i}", (x, y, z), (0.018, 0.018, 0.006), mats["silver"], 18)
    cable("lamp", "premium_workstation_v6_lamp_visible_power_wire", [(-1.12, 0.25, -0.1), (-1.2, 0.18, -0.18), (-1.32, 0.16, -0.31)], mats["soft_black"], 0.004)

    for i, t in enumerate([0.0, 0.22, 0.44, 0.66, 0.88]):
        x = -1.03 + t * 0.35
        y = 0.29 + math.sin(t * math.pi) * 0.16
        rb("mic", f"premium_workstation_v6_mic_arm_spring_bar_{i}", (0.04, 0.008, 0.008), (x, y, -0.02 - t * 0.12), mats["silver"], 0.002, 1, -0.4)
    rb("mic", "premium_workstation_v6_mic_capsule_grille_front", (0.09, 0.07, 0.018), (-0.72, 0.3, 0.1), mats["soft_black"], 0.01, 5, -0.2)
    for i in range(5):
        rb("mic", f"premium_workstation_v6_mic_grille_line_{i}", (0.072, 0.003, 0.004), (-0.72, 0.276 + i * 0.011, 0.113), mats["silver"], 0.001, 1, -0.2)
    rb("mic", "premium_workstation_v6_mic_desk_clamp_pad", (0.12, 0.045, 0.05), (-1.16, 0.145, -0.08), mats["metal"], 0.008, 3)


def add_desk_surface_and_cable_detail(mats: dict[str, bpy.types.Material]) -> None:
    for i, z in enumerate([-0.23, -0.08, 0.07, 0.22, 0.37]):
        rb("desk", f"premium_workstation_v6_desktop_plank_bevel_line_{i}", (2.16, 0.006, 0.008), (-0.18, 0.184, z), mats["edge_oak"], 0.001, 1)
    for i, x in enumerate([-1.18, -0.68, -0.18, 0.32, 0.82]):
        rb("desk", f"premium_workstation_v6_desktop_endgrain_short_line_{i}", (0.01, 0.005, 0.62), (x, 0.186, 0.08), mats["edge_oak"], 0.001, 1)
    rb("desk", "premium_workstation_v6_desk_front_rounded_edge_highlight", (2.23, 0.025, 0.032), (-0.18, 0.164, 0.452), mats["edge_oak"], 0.008, 3)
    for i, y in enumerate([0.035, -0.06, -0.155]):
        rb("desk", f"premium_workstation_v6_drawer_gap_shadow_{i}", (0.39, 0.009, 0.014), (-1.17, y + 0.21, 0.427), mats["soft_black"], 0.002, 1)
        rb("desk", f"premium_workstation_v6_drawer_slim_pull_{i}", (0.18, 0.012, 0.018), (-1.17, y + 0.22, 0.444), mats["silver"], 0.004, 2)
    rb("cables", "premium_workstation_v6_underdesk_cable_tray_front_rail", (1.18, 0.032, 0.05), (-0.18, 0.045, 0.5), mats["metal"], 0.006, 2)
    for i, x in enumerate([-0.68, -0.32, 0.04, 0.4]):
        rb("cables", f"premium_workstation_v6_underdesk_cable_tray_slat_{i}", (0.028, 0.032, 0.2), (x, 0.046, 0.39), mats["metal"], 0.004, 2)
    for i, x in enumerate([-0.9, -0.38, 0.25, 0.9]):
        rb("cables", f"premium_workstation_v6_adhesive_cable_clip_{i}", (0.052, 0.026, 0.026), (x, 0.165, -0.42), mats["matte_white"], 0.006, 3)
        cable("cables", f"premium_workstation_v6_managed_rear_cable_{i}", [(x, 0.17, -0.405), (x + 0.06, 0.12, -0.52), (x + 0.18, 0.08, -0.56)], mats["soft_black"], 0.0045)


def add_small_props_detail(mats: dict[str, bpy.types.Material]) -> None:
    # Mug rim, coffee surface, handle and coaster.
    cyl_y("mug", "premium_workstation_v6_mug_outer_wall", 0.052, 0.105, (-1.18, 0.22, 0.18), mats["matte_white"], 32)
    cyl_y("mug", "premium_workstation_v6_mug_coffee_disc", 0.042, 0.006, (-1.18, 0.276, 0.18), mats["coffee"], 32)
    cyl_z("mug", "premium_workstation_v6_mug_handle_upper", 0.012, 0.068, (-1.125, 0.25, 0.18), mats["matte_white"], 16)
    rb("mug", "premium_workstation_v6_mug_coaster_cork", (0.13, 0.008, 0.13), (-1.18, 0.185, 0.18), mats["edge_oak"], 0.015, 5)

    # Notebook/paper stack.
    for i in range(6):
        rb("paper", f"premium_workstation_v6_notebook_page_layer_{i}", (0.32, 0.003, 0.22), (-0.03, 0.185 + i * 0.003, 0.29), mats["paper"] if i % 2 else mats["paper_edge"], 0.006, 2, -0.14)
    rb("paper", "premium_workstation_v6_notebook_spine_cloth", (0.026, 0.026, 0.22), (-0.185, 0.205, 0.29), mats["blue"], 0.004, 2, -0.14)
    rb("paper", "premium_workstation_v6_bookmark_ribbon", (0.018, 0.004, 0.18), (-0.03, 0.212, 0.32), mats["pink"], 0.002, 1, -0.14)
    for i, (x, z, mat) in enumerate([(-0.36, 0.34, "amber"), (-0.44, 0.29, "pink"), (-0.53, 0.33, "blue")]):
        rb("paper", f"premium_workstation_v6_sticky_note_layer_{i}", (0.085, 0.004, 0.07), (x, 0.191 + i * 0.004, z), mats[mat], 0.004, 1, -0.08)

    # Planter: pot rim, soil, separated leaves.
    cyl_y("plant", "premium_workstation_v6_planter_pot_rim", 0.058, 0.018, (0.82, 0.245, 0.27), mats["matte_white"], 32)
    cyl_y("plant", "premium_workstation_v6_planter_soil_disc", 0.046, 0.006, (0.82, 0.257, 0.27), mats["soil"], 28)
    for i in range(12):
        angle = i / 12 * math.tau
        x = 0.82 + math.cos(angle) * 0.055
        z = 0.27 + math.sin(angle) * 0.055
        y = 0.292 + (i % 3) * 0.018
        rb("plant", f"premium_workstation_v6_planter_leaf_blade_{i}", (0.018, 0.006, 0.09), (x, y, z), mats["plant"], 0.008, 3, angle)

    # Small tray and pen details.
    rb("paper", "premium_workstation_v6_catchall_tray_base", (0.24, 0.016, 0.13), (-0.86, 0.188, 0.255), mats["metal"], 0.012, 4)
    for i, z in enumerate([0.215, 0.255, 0.295]):
        cyl_x("paper", f"premium_workstation_v6_pen_in_tray_{i}", 0.006, 0.18, (-0.86, 0.207 + i * 0.006, z), mats["paper_edge"] if i == 0 else mats["blue"], 12)


def ensure_detail_uvs() -> int:
    count = 0
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH":
            continue
        if not obj.name.startswith("premium_workstation_v6_"):
            continue
        mesh = obj.data
        uv_layer = mesh.uv_layers.get("DetailUV") or mesh.uv_layers.new(name="DetailUV")
        lightmap = mesh.uv_layers.get("LightmapUV2") or mesh.uv_layers.new(name="LightmapUV2")
        min_x = min(v.co.x for v in mesh.vertices)
        max_x = max(v.co.x for v in mesh.vertices)
        min_y = min(v.co.y for v in mesh.vertices)
        max_y = max(v.co.y for v in mesh.vertices)
        for poly in mesh.polygons:
            for loop_index in poly.loop_indices:
                co = mesh.vertices[mesh.loops[loop_index].vertex_index].co
                u = (co.x - min_x) / max(max_x - min_x, 0.0001)
                v = (co.y - min_y) / max(max_y - min_y, 0.0001)
                uv_layer.data[loop_index].uv = (u, v)
                lightmap.data[loop_index].uv = (u * 0.92 + 0.04, v * 0.92 + 0.04)
        count += 1
    return count


def write_runtime_sidecars(repo_root: Path, glb_relative: str) -> dict[str, str]:
    public_dir = repo_root / "apps/web/public/assets/models/p2s_premium_workstation_hero_v6"
    colliders = {
        "assetId": "p2s_premium_workstation_hero_v6",
        "model": glb_relative,
        "colliders": [
            {"id": "desk_volume", "type": "box", "center": [-0.18, 0.11, 0.1], "size": [2.32, 0.28, 0.78]},
            {"id": "pc_tower_volume", "type": "box", "center": [1.24, 0.39, -0.08], "size": [0.62, 0.82, 0.48]},
            {"id": "monitor_volume", "type": "box", "center": [-0.48, 0.56, -0.24], "size": [1.18, 0.74, 0.13]},
            {"id": "tabletop_prop_volume", "type": "box", "center": [-0.3, 0.2, 0.12], "size": [1.75, 0.22, 0.58]},
        ],
    }
    support = {
        "assetId": "p2s_premium_workstation_hero_v6",
        "supportSurfaces": [
            {"id": "desktop", "type": "horizontal", "center": [-0.18, 0.188, 0.1], "size": [2.2, 0.66], "normal": [0, 1, 0]},
            {"id": "pc_top", "type": "horizontal", "center": [1.24, 0.8, -0.08], "size": [0.5, 0.38], "normal": [0, 1, 0]},
        ],
    }
    files = {
        "colliders": public_dir / "p2s_premium_workstation_hero_v6.colliders.json",
        "supportSurfaces": public_dir / "p2s_premium_workstation_hero_v6.support-surfaces.json",
    }
    files["colliders"].write_text(json.dumps(colliders, indent=2), encoding="utf-8")
    files["supportSurfaces"].write_text(json.dumps(support, indent=2), encoding="utf-8")
    return {key: str(path.relative_to(repo_root)) for key, path in files.items()}


def save_and_render(
    repo_root: Path,
    atlas_count: int,
    active_uv_count: int,
    ao_count: int,
    detail_uv_count: int,
    atlas_paths: dict[str, str],
) -> None:
    public_dir = repo_root / "apps/web/public/assets/models/p2s_premium_workstation_hero_v6"
    blend_dir = repo_root / "assets/blender/deskterior"
    review_dir = repo_root / "assets/references/blender-authored/premium-workstation-hero"
    preview_dir = review_dir / "v6-previews"
    public_dir.mkdir(parents=True, exist_ok=True)
    blend_dir.mkdir(parents=True, exist_ok=True)
    preview_dir.mkdir(parents=True, exist_ok=True)

    blend_path = blend_dir / "p2s_premium_workstation_hero_v6.blend"
    glb_path = public_dir / "p2s_premium_workstation_hero_v6.glb"
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
    bpy.ops.export_scene.gltf(
        filepath=str(glb_path),
        export_format="GLB",
        export_yup=True,
        export_materials="EXPORT",
        export_apply=True,
        export_animations=False,
    )

    glb_relative = str(glb_path.relative_to(repo_root))
    sidecars = write_runtime_sidecars(repo_root, glb_relative)

    v2.setup_render_scene()
    bpy.context.scene.view_settings.exposure = -0.04
    v2.render_preview(preview_dir / "workstation-v6-isometric.png", "preview_v6_iso_camera", (2.55, 1.25, 2.05), (0.02, 0.08, 0.0), 3.35)
    v2.render_preview(preview_dir / "workstation-v6-tabletop-closeup.png", "preview_v6_tabletop_camera", (0.68, 0.78, 0.82), (-0.46, 0.22, 0.15), 1.08)
    v2.render_preview(preview_dir / "workstation-v6-input-devices-closeup.png", "preview_v6_input_camera", (0.2, 0.54, 0.72), (-0.48, 0.2, 0.12), 0.72)
    v2.render_preview(preview_dir / "workstation-v6-monitor-audio-closeup.png", "preview_v6_monitor_audio_camera", (-1.38, 0.77, 0.55), (-0.74, 0.42, -0.17), 0.9)

    stats = base.mesh_stats()
    stats["textureImages"] = len([image for image in bpy.data.images if image.packed_file or image.filepath])
    stats["glbBytes"] = glb_path.stat().st_size
    stats["atlasAssignedMeshObjects"] = atlas_count
    stats["activeUvAtlasMeshObjects"] = active_uv_count
    stats["bakedContactAoDecals"] = ao_count
    stats["detailUvMeshObjects"] = detail_uv_count
    stats["lightmapUv2ReadyMeshObjects"] = sum(
        1 for obj in bpy.context.scene.objects if obj.type == "MESH" and obj.data.uv_layers.get("LightmapUV2")
    )

    review = {
        "asset": "p2s_premium_workstation_hero_v6",
        "status": "standalone-generated-review-required",
        "sourceBlend": str(blend_path.relative_to(repo_root)),
        "publicGlb": glb_relative,
        "previewImages": [
            str((preview_dir / "workstation-v6-isometric.png").relative_to(repo_root)),
            str((preview_dir / "workstation-v6-tabletop-closeup.png").relative_to(repo_root)),
            str((preview_dir / "workstation-v6-input-devices-closeup.png").relative_to(repo_root)),
            str((preview_dir / "workstation-v6-monitor-audio-closeup.png").relative_to(repo_root)),
        ],
        "atlasArtifacts": atlas_paths,
        "runtimeSidecars": sidecars,
        "metrics": stats,
        "desktopDetailPass": {
            "detailObjectCount": len(DETAIL_CATEGORY),
            "categories": dict(sorted(Counter(DETAIL_CATEGORY.values()).items())),
            "focus": [
                "monitor bezels, rear ports, vents, VESA screws, and cable strain relief",
                "keyboard legends, knob, USB-C recess, coiled cable, and mouse buttons/wheel/side buttons",
                "speaker grille threads/driver cones, lamp diffuser/hinges/wire, mic spring bars/grille/clamp",
                "desk plank seams, drawer pulls, underdesk cable tray, adhesive cable clips, routed rear cables",
                "mug rim/coffee/handle, notebook layers/bookmark/sticky notes, planter rim/soil/separate leaves, tray pens",
            ],
        },
        "iterationNotes": {
            "v5DefectTargeted": "Desktop items were structurally correct but still too primitive at close camera distance.",
            "v6Changes": [
                "Added per-object tabletop micro-detail rather than changing the full room composition.",
                "Preserved V5 UVAtlas sampling fix and V4 PC internal detail.",
                "Added simple collider and support-surface sidecars for later runtime packaging.",
            ],
        },
        "stillRequires": [
            "human visual approval against commercial references",
            "hand-authored texture polish beyond generated/procedural maps",
            "true renderer-baked GI/lightmap pass",
            "exact manufacturer CAD/scanned product geometry if product fidelity becomes mandatory",
            "runtime LOD/proxy GLB package before live catalog promotion",
            "scene integration only after standalone approval",
        ],
    }
    (review_dir / "asset-review-v6-2026-05-20.json").write_text(json.dumps(review, indent=2), encoding="utf-8")


def main() -> None:
    args = parse_args()
    repo_root = Path(args.repo_root)
    review_dir = repo_root / "assets/references/blender-authored/premium-workstation-hero"
    review_dir.mkdir(parents=True, exist_ok=True)

    base.clear_scene()
    base.build_scene()
    base.add_preview_lights()
    materials = v3.safe_materials()
    v2.add_case_detail(materials)
    v2.add_desk_and_tabletop_detail(materials)
    v2.add_monitor_arm_and_lighting_detail(materials)
    v3.add_screen_ui(materials)
    v3.add_color_correction_detail(materials)
    v4.add_product_accurate_pc_internals(materials)
    v2.add_scene_floor()

    basecolor = v4.make_atlas_image("premium_workstation_v6_basecolor_atlas_1024", v5.refined_color_for_region, 1024)
    orm = v4.make_atlas_image("premium_workstation_v6_orm_atlas_1024", v4.orm_for_region, 1024)
    basecolor_path = review_dir / "workstation-v6-basecolor-atlas.png"
    orm_path = review_dir / "workstation-v6-orm-atlas.png"
    v4.save_image(basecolor, basecolor_path)
    v4.save_image(orm, orm_path)

    atlas_material = v5.create_uv_atlas_material(basecolor, orm)
    atlas_material.name = "premium_workstation_v6_shared_uv_pbr_atlas"
    atlas_count = v4.apply_atlas(atlas_material)
    active_uv_count = v5.enforce_uv_atlas_active()

    mats = detail_materials()
    add_monitor_and_display_detail(mats)
    add_keyboard_mouse_detail(mats)
    add_audio_lighting_detail(mats)
    add_desk_surface_and_cable_detail(mats)
    add_small_props_detail(mats)
    detail_uv_count = ensure_detail_uvs()

    ao_count = v4.add_baked_contact_occlusion(materials)

    save_and_render(
        repo_root,
        atlas_count,
        active_uv_count,
        ao_count,
        detail_uv_count,
        {
            "basecolor": str(basecolor_path.relative_to(repo_root)),
            "orm": str(orm_path.relative_to(repo_root)),
        },
    )


if __name__ == "__main__":
    main()
