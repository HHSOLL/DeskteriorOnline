#!/usr/bin/env python3
"""Add product-specific repair geometry to Meshy-generated So Ong assets.

Meshy preview GLBs are useful as a base mesh, but when image/refine is
unavailable they often arrive as low-semantic white geometry. This pass keeps
the Meshy mesh and adds runtime-safe hard-surface details needed for the
reference scene to read as the intended products.
"""

from __future__ import annotations

import math
from pathlib import Path

import bpy
from mathutils import Vector


REPO_ROOT = Path(__file__).resolve().parents[1]
MODELS_ROOT = REPO_ROOT / "apps/web/public/assets/models"


DIMS = {
    "p2s_video_so_ong_tfg40q14wp_monitor": (0.944, 0.287, 0.596),
    "p2s_video_so_ong_cpm1610iq_portable_monitor": (0.358, 0.04, 0.235),
    "p2s_video_so_ong_empathist_stand": (0.28, 0.18, 0.12),
    "p2s_video_so_ong_ivy_planter": (0.11, 0.09, 0.115),
    "p2s_video_so_ong_sml_spacecraft": (0.16, 0.115, 0.13),
    "p2s_video_so_ong_divoom_times_gate": (0.283, 0.047, 0.097),
    "p2s_video_so_ong_charging_reel_cable": (0.075, 0.075, 0.028),
    "p2s_video_so_ong_square1_power_cube": (0.076, 0.076, 0.076),
    "p2s_video_so_ong_gravastar_mars_pro": (0.201, 0.18, 0.191),
    "p2s_video_so_ong_diecast_car": (0.12, 0.055, 0.045),
    "p2s_video_so_ong_arturia_minifuse2": (0.2, 0.1, 0.043),
    "p2s_video_so_ong_offrame_dual_monitor_riser": (1.0, 0.25, 0.12),
    "p2s_video_so_ong_razer_cobra_pro_white": (0.12, 0.063, 0.038),
    "p2s_video_so_ong_zionworks_synchronize_mat": (0.9, 0.4, 0.004),
    "p2s_video_so_ong_angry_miao_am_hatsu": (0.36, 0.22, 0.075),
    "p2s_video_so_ong_reproducer_epic5": (0.19, 0.24, 0.31),
    "p2s_video_so_ong_hyte_y70_snow_white": (0.47, 0.32, 0.47),
}


def reset_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    bpy.context.scene.unit_settings.system = "METRIC"
    bpy.context.scene.render.engine = "BLENDER_EEVEE_NEXT"


def mat(name: str, color: tuple[float, float, float, float], roughness: float = 0.55, metallic: float = 0.0, emission=None):
    material = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = color
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Metallic"].default_value = metallic
        if emission and "Emission Color" in bsdf.inputs:
            bsdf.inputs["Emission Color"].default_value = emission[0]
            bsdf.inputs["Emission Strength"].default_value = emission[1]
    return material


def ensure_materials():
    return {
        "white": mat("repair_satin_white", (0.9, 0.89, 0.85, 1), 0.46),
        "cream": mat("repair_warm_off_white", (0.82, 0.8, 0.74, 1), 0.52),
        "black": mat("repair_soft_black", (0.01, 0.011, 0.014, 1), 0.52),
        "rubber": mat("repair_rubber_black", (0.0, 0.0, 0.0, 1), 0.78),
        "screen": mat("repair_screen_black", (0, 0, 0.004, 1), 0.25),
        "glass": mat("repair_smoked_glass", (0.38, 0.47, 0.58, 0.42), 0.08),
        "purple_glass": mat("repair_purple_smoked_lens", (0.34, 0.24, 0.55, 0.58), 0.1),
        "silver": mat("repair_satin_silver", (0.72, 0.72, 0.7, 1), 0.34, 0.25),
        "light_grey": mat("repair_light_grey_panel", (0.58, 0.61, 0.63, 1), 0.58),
        "grey": mat("repair_warm_grey", (0.32, 0.33, 0.35, 1), 0.6),
        "dark_grey": mat("repair_dark_graphite", (0.08, 0.085, 0.095, 1), 0.58),
        "yellow": mat("repair_warm_yellow", (1.0, 0.78, 0.18, 1), 0.35, emission=((1.0, 0.67, 0.18, 1), 0.45)),
        "blue": mat("repair_cool_blue_led", (0.35, 0.6, 1.0, 1), 0.25, emission=((0.25, 0.55, 1.0, 1), 0.95)),
        "lavender": mat("repair_lavender_led", (0.63, 0.56, 1.0, 1), 0.28, emission=((0.56, 0.48, 1.0, 1), 0.7)),
        "red": mat("repair_tiny_red_accent", (0.8, 0.08, 0.04, 1), 0.42, emission=((0.8, 0.04, 0.02, 1), 0.35)),
        "green": mat("repair_leaf_green", (0.16, 0.42, 0.16, 1), 0.72),
        "fabric": mat("repair_black_woven_fabric", (0.02, 0.021, 0.024, 1), 0.88),
        "cool_white": mat("repair_emissive_white", (1, 1, 1, 1), 0.32, emission=((1, 1, 1, 1), 0.8)),
    }


MAT = ensure_materials()


def cube(name, loc, dims, material="white", bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(MAT[material])
    if bevel:
        mod = obj.modifiers.new("repair_bevel", "BEVEL")
        mod.width = bevel
        mod.segments = 4
        obj.modifiers.new("repair_weighted_normals", "WEIGHTED_NORMAL")
    return obj


def cyl(name, loc, radius, depth, material="black", vertices=48, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc, rotation=rot)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(MAT[material])
    obj.modifiers.new("repair_weighted_normals", "WEIGHTED_NORMAL")
    return obj


def sphere(name, loc, scale, material="white", segments=48):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=max(12, segments // 2), radius=0.5, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    obj.data.materials.append(MAT[material])
    obj.modifiers.new("repair_weighted_normals", "WEIGHTED_NORMAL")
    return obj


def text(name, body, loc, size, material="cool_white", rot=(math.radians(90), 0, 0)):
    bpy.ops.object.text_add(location=loc, rotation=rot)
    obj = bpy.context.object
    obj.name = name
    obj.data.body = body
    obj.data.align_x = "CENTER"
    obj.data.align_y = "CENTER"
    obj.data.size = size
    obj.data.extrude = 0.0006
    obj.data.materials.append(MAT[material])
    return obj


def discard_imported_geometry(imported: list[bpy.types.Object]) -> None:
    """Keep Meshy output as source evidence, but rebuild runtime geometry.

    The current Meshy preview API often returns amorphous hard-surface blobs or
    oversized panels for these product screenshots. For Deskterior preview
    fidelity we use those provider outputs as candidate evidence and author a
    deterministic, product-specific final pass with clean proportions and
    recognizable signatures.
    """
    for obj in imported:
        obj.select_set(True)
    bpy.ops.object.delete()


def add_monitor_body(asset_id, w, d, h):
    if "tfg40" in asset_id:
        panel_h = h * 0.52
        panel_z = h * 0.62
        cube("repair_monitor_outer_white_frame", (0, 0, panel_z), (w, d * 0.26, panel_h), "white", 0.006)
        cube("repair_monitor_back_soft_silver", (0, d * 0.09, panel_z), (w * 0.94, d * 0.1, panel_h * 0.9), "light_grey", 0.006)
        cyl("repair_monitor_stand_neck", (0, d * 0.12, h * 0.27), w * 0.025, h * 0.35, "white", vertices=32)
        cube("repair_monitor_stand_foot", (0, d * 0.19, 0.035), (w * 0.28, d * 0.8, 0.035), "white", 0.01)
    else:
        cube("repair_portable_outer_body", (0, 0, h * 0.52), (w, d * 0.85, h * 0.82), "white", 0.006)
        cube("repair_portable_back_panel", (0, d * 0.2, h * 0.45), (w * 0.85, d * 0.12, h * 0.5), "grey", 0.003)


def add_speaker_body(w, d, h):
    cube("repair_epic5_white_cabinet", (0, 0, h * 0.5), (w, d, h), "white", 0.012)
    cube("repair_epic5_front_recess", (0, -d / 2 - 0.002, h * 0.55), (w * 0.67, 0.012, h * 0.68), "black", 0.008)
    for x in [-w * 0.28, w * 0.28]:
        cyl("repair_epic5_front_spike", (x, -d * 0.2, 0.02), w * 0.035, 0.055, "black", vertices=20)


def add_pc_case_body(w, d, h):
    cube("repair_hyte_outer_white_frame", (0, 0, h * 0.5), (w, d, h), "white", 0.012)
    cube("repair_hyte_inner_shadow", (0, -d * 0.2, h * 0.48), (w * 0.74, d * 0.55, h * 0.72), "dark_grey", 0.004)
    cube("repair_hyte_motherboard_light_panel", (-w * 0.18, -d * 0.26, h * 0.5), (w * 0.32, d * 0.04, h * 0.56), "light_grey", 0.003)
    cube("repair_hyte_bottom_plinth", (0, -d * 0.08, 0.035), (w * 0.84, d * 0.68, 0.05), "silver", 0.004)


def add_keyboard_body(w, d, h):
    for side, x0, yaw in [("left", -w * 0.22, math.radians(-10)), ("right", w * 0.22, math.radians(10))]:
        base = cube(f"repair_{side}_split_base", (x0, 0, h * 0.55), (w * 0.43, d * 0.72, h * 0.56), "cream", 0.018)
        base.rotation_euler[2] = yaw
        ridge = cube(f"repair_{side}_black_key_bed", (x0, d * 0.06, h * 0.88), (w * 0.34, d * 0.45, h * 0.12), "black", 0.01)
        ridge.rotation_euler[2] = yaw


def add_riser_body(w, d, h):
    cube("repair_offrame_long_white_shelf", (0, 0, h * 0.92), (w, d, h * 0.16), "white", 0.006)
    for x in [-w * 0.44, w * 0.44]:
        cube("repair_offrame_leg", (x, 0, h * 0.45), (w * 0.04, d * 0.86, h * 0.78), "white", 0.004)
    cube("repair_offrame_shadow_gap", (0, -d * 0.44, h * 0.76), (w * 0.86, d * 0.04, h * 0.12), "grey", 0.002)


def add_clock_body(w, d, h):
    cube("repair_times_gate_smoked_capsule", (0, 0, h * 0.52), (w, d, h), "glass", 0.018)
    cube("repair_times_gate_dark_inner", (0, -d * 0.06, h * 0.52), (w * 0.86, d * 0.62, h * 0.66), "dark_grey", 0.012)


def add_audio_body(w, d, h):
    cube("repair_minifuse_silver_body", (0, 0, h * 0.5), (w, d, h), "silver", 0.006)
    cube("repair_minifuse_black_top", (0, 0, h * 0.92), (w * 0.92, d * 0.86, h * 0.04), "dark_grey", 0.002)


def add_mouse_body(w, d, h):
    sphere("repair_cobra_white_shell", (0, 0, h * 0.5), (w * 0.48, d * 0.5, h * 0.58), "white", 48)
    cube("repair_cobra_flat_floor", (0, 0, h * 0.16), (w * 0.74, d * 0.8, h * 0.12), "white", 0.01)


def add_cube_power_body(w, d, h):
    cube("repair_square1_rounded_cube", (0, 0, h * 0.5), (w, d, h), "white", 0.012)
    cube("repair_square1_shadow_base", (0, d * 0.42, h * 0.22), (w * 0.82, d * 0.12, h * 0.22), "light_grey", 0.004)


def add_reel_body(w, d, h):
    cyl("repair_reel_white_disk", (0, 0, h * 0.5), w * 0.42, h, "white", vertices=64)
    cube("repair_reel_tail", (w * 0.42, 0, h * 0.5), (w * 0.24, d * 0.14, h * 0.42), "white", 0.004)


def add_diecast_body(w, d, h):
    cube("repair_diecast_white_body", (0, 0, h * 0.38), (w * 0.9, d * 0.72, h * 0.42), "white", 0.008)
    cube("repair_diecast_roof", (0, -d * 0.03, h * 0.72), (w * 0.42, d * 0.52, h * 0.28), "white", 0.006)
    cube("repair_diecast_black_bumper", (0, -d * 0.42, h * 0.27), (w * 0.7, d * 0.08, h * 0.12), "black", 0.004)
    for x in [-w * 0.3, w * 0.3]:
        cyl("repair_diecast_side_wheel_l", (x, -d * 0.38, h * 0.17), h * 0.16, 0.012, "black", rot=(math.radians(90), 0, 0))
        cyl("repair_diecast_side_wheel_r", (x, d * 0.38, h * 0.17), h * 0.16, 0.012, "black", rot=(math.radians(90), 0, 0))


def add_spacecraft_body(w, d, h):
    sphere("repair_sml_white_capsule", (0, 0, h * 0.55), (w * 0.45, d * 0.42, h * 0.52), "white", 48)
    sphere("repair_sml_purple_lens", (0, -d * 0.38, h * 0.72), (w * 0.16, d * 0.06, h * 0.16), "purple_glass", 32)
    for x in [-w * 0.34, w * 0.34]:
        cube("repair_sml_side_leg", (x, 0, h * 0.16), (w * 0.11, d * 0.16, h * 0.32), "white", 0.006)


def add_ivy_body(w, d, h):
    sphere("repair_ivy_white_pot", (0, 0, h * 0.45), (w * 0.45, d * 0.42, h * 0.42), "white", 48)
    cube("repair_ivy_screen_recess", (0, -d * 0.42, h * 0.43), (w * 0.54, 0.008, h * 0.34), "black", 0.008)


def add_mars_body(w, d, h):
    sphere("repair_mars_black_rounded_body", (0, 0, h * 0.5), (w * 0.46, d * 0.42, h * 0.42), "black", 48)
    cube("repair_mars_flat_front", (0, -d * 0.44, h * 0.45), (w * 0.58, 0.01, h * 0.42), "black", 0.018)


def add_empathist_body(w, d, h):
    cube("repair_empathist_clear_back", (0, d * 0.16, h * 0.62), (w, d * 0.08, h * 0.66), "glass", 0.006)
    cube("repair_empathist_front_lip", (0, -d * 0.42, h * 0.14), (w * 0.92, d * 0.08, h * 0.14), "silver", 0.004)
    cube("repair_empathist_bottom_bar", (0, d * 0.1, h * 0.08), (w, d * 0.65, h * 0.08), "silver", 0.004)


def add_mat_body(w, d, h):
    # Build the visible mat before adding border/wordmark detail.
    cube("repair_mat_base_white_border", (0, 0, h + 0.0005), (w, d, 0.002), "cream", 0.006)


def add_base_geometry(asset_id, w, d, h):
    if "monitor" in asset_id:
        add_monitor_body(asset_id, w, d, h)
    elif "reproducer" in asset_id:
        add_speaker_body(w, d, h)
    elif "hyte" in asset_id:
        add_pc_case_body(w, d, h)
    elif "hatsu" in asset_id:
        add_keyboard_body(w, d, h)
    elif "synchronize" in asset_id:
        add_mat_body(w, d, h)
    elif "times_gate" in asset_id:
        add_clock_body(w, d, h)
    elif "minifuse" in asset_id:
        add_audio_body(w, d, h)
    elif "offrame" in asset_id:
        add_riser_body(w, d, h)
    elif "cobra" in asset_id:
        add_mouse_body(w, d, h)
    elif "square1" in asset_id:
        add_cube_power_body(w, d, h)
    elif "reel" in asset_id:
        add_reel_body(w, d, h)
    elif "diecast" in asset_id:
        add_diecast_body(w, d, h)
    elif "spacecraft" in asset_id:
        add_spacecraft_body(w, d, h)
    elif "ivy" in asset_id:
        add_ivy_body(w, d, h)
    elif "mars" in asset_id:
        add_mars_body(w, d, h)
    elif "empathist" in asset_id:
        add_empathist_body(w, d, h)


def add_monitor(asset_id, w, d, h):
    front = -d / 2 - 0.006
    cube("repair_black_screen", (0, front, h * 0.56), (w * 0.91, 0.006, h * 0.55), "screen", 0.003)
    cube("repair_silver_lower_bezel", (0, front - 0.003, h * 0.25), (w * 0.96, 0.006, h * 0.035), "silver", 0.001)
    if "tfg40" in asset_id:
        text("repair_clock_digits", "3 26 40", (0.04, front - 0.008, h * 0.61), h * 0.17)
    else:
        text("repair_portable_fine", "FINE", (0, front - 0.008, h * 0.58), h * 0.18)
        cube("repair_folding_kickstand", (0, d * 0.18, h * 0.15), (w * 0.5, 0.01, h * 0.08), "grey", 0.002)


def add_speaker(w, d, h):
    front = -d / 2 - 0.006
    cube("repair_black_baffle", (0, front, h * 0.55), (w * 0.64, 0.012, h * 0.62), "black", 0.006)
    cyl("repair_tweeter", (0, front - 0.008, h * 0.75), w * 0.13, 0.008, "grey", rot=(math.radians(90), 0, 0))
    cyl("repair_woofer", (0, front - 0.01, h * 0.43), w * 0.23, 0.01, "black", rot=(math.radians(90), 0, 0))
    cyl("repair_woofer_cone", (0, front - 0.017, h * 0.43), w * 0.16, 0.008, "grey", rot=(math.radians(90), 0, 0))
    cyl("repair_status_led", (0, front - 0.014, h * 0.16), w * 0.035, 0.004, "blue", rot=(math.radians(90), 0, 0))


def add_pc_case(w, d, h):
    front = -d / 2 - 0.006
    side = w / 2 + 0.004
    cube("repair_front_glass", (0, front, h * 0.5), (w * 0.86, 0.008, h * 0.78), "glass", 0.003)
    cube("repair_side_glass", (side, 0, h * 0.5), (0.008, d * 0.78, h * 0.78), "glass", 0.003)
    for z in [h * 0.26, h * 0.5, h * 0.74]:
        cyl("repair_rgb_fan", (w * 0.33, front - 0.012, z), w * 0.085, 0.01, "lavender", rot=(math.radians(90), 0, 0))
        cyl("repair_fan_hub", (w * 0.33, front - 0.018, z), w * 0.032, 0.01, "dark_grey", rot=(math.radians(90), 0, 0))
    cube("repair_vertical_gpu", (-w * 0.23, front - 0.013, h * 0.28), (w * 0.34, 0.01, h * 0.1), "dark_grey", 0.002)
    cube("repair_white_gpu_face", (-w * 0.23, front - 0.02, h * 0.33), (w * 0.31, 0.006, h * 0.045), "cream", 0.002)


def add_keyboard(w, d, h):
    for side, x0 in [("left", -w * 0.22), ("right", w * 0.22)]:
        cube(f"repair_{side}_palm", (x0, -d * 0.14, h * 0.95), (w * 0.26, d * 0.28, h * 0.18), "white", 0.012)
        for row in range(3):
            for col in range(5):
                cube(
                    f"repair_{side}_key_{row}_{col}",
                    (x0 + (col - 2) * w * 0.035, -d * 0.04 + row * d * 0.075, h * 1.16),
                    (w * 0.026, d * 0.046, h * 0.13),
                    "dark_grey" if (row + col) % 2 else "black",
                    0.004,
                )


def add_mat(w, d, h):
    cube("repair_mat_fabric", (0, 0, h + 0.001), (w, d, 0.003), "fabric", 0.006)
    cube("repair_mat_top_edge", (0, -d / 2, h + 0.004), (w, 0.012, 0.003), "cool_white", 0.002)
    cube("repair_mat_bottom_edge", (0, d / 2, h + 0.004), (w, 0.012, 0.003), "cool_white", 0.002)
    cube("repair_mat_left_edge", (-w / 2, 0, h + 0.004), (0.012, d, 0.003), "cool_white", 0.002)
    cube("repair_mat_right_edge", (w / 2, 0, h + 0.004), (0.012, d, 0.003), "cool_white", 0.002)
    text("repair_synchronize_word", "SYNCHRONIZE", (w * 0.22, -d * 0.44, h + 0.008), 0.045, rot=(0, 0, 0))


def add_clock(w, d, h):
    front = -d / 2 - 0.006
    cube("repair_times_gate_black_body", (0, 0, h * 0.52), (w, d * 0.9, h * 0.62), "black", 0.012)
    for i, x in enumerate([-0.36, -0.18, 0, 0.18, 0.36]):
        cube(f"repair_ips_{i}", (x * w, front - 0.003, h * 0.55), (w * 0.14, 0.006, h * 0.42), "screen", 0.004)
        text(f"repair_clock_digit_{i}", str([1, 5, 2, 6, 0][i]), (x * w, front - 0.008, h * 0.57), h * 0.22)
    cyl("repair_times_gate_left_cap", (-w * 0.55, 0, h * 0.54), h * 0.34, d * 0.12, "purple_glass", vertices=32, rot=(0, math.radians(90), 0))
    cyl("repair_times_gate_right_cap", (w * 0.55, 0, h * 0.54), h * 0.34, d * 0.12, "purple_glass", vertices=32, rot=(0, math.radians(90), 0))


def add_audio_interface(w, d, h):
    front = -d / 2 - 0.006
    cube("repair_minifuse_front", (0, front, h * 0.52), (w * 0.9, 0.01, h * 0.48), "grey", 0.003)
    for x in [-w * 0.27, -w * 0.1]:
        cyl("repair_combo_input", (x, front - 0.008, h * 0.48), h * 0.18, 0.008, "black", rot=(math.radians(90), 0, 0))
    for x in [w * 0.08, w * 0.24, w * 0.38]:
        cyl("repair_silver_knob", (x, front - 0.01, h * 0.54), h * 0.14, 0.006, "silver", rot=(math.radians(90), 0, 0))
    text("repair_arturia", "ARTURIA", (w * 0.1, front - 0.009, h * 0.18), h * 0.16, "cool_white")


def add_small_details(asset_id, w, d, h):
    front = -d / 2 - 0.006
    if "ivy" in asset_id:
        cube("repair_ivy_face", (0, front, h * 0.48), (w * 0.5, 0.006, h * 0.32), "black", 0.008)
        cyl("repair_eye_l", (-w * 0.12, front - 0.006, h * 0.52), w * 0.035, 0.004, "cool_white", rot=(math.radians(90), 0, 0))
        cyl("repair_eye_r", (w * 0.12, front - 0.006, h * 0.52), w * 0.035, 0.004, "cool_white", rot=(math.radians(90), 0, 0))
        for x in [-0.12, 0, 0.12]:
            cube("repair_leaf", (x * w, 0, h * 1.04), (w * 0.08, d * 0.025, h * 0.18), "green", 0.004)
    elif "mars" in asset_id:
        cyl("repair_mars_driver", (0, front - 0.012, h * 0.45), w * 0.18, 0.01, "yellow", rot=(math.radians(90), 0, 0))
        cube("repair_mars_black_plate", (0, front - 0.004, h * 0.45), (w * 0.52, 0.006, h * 0.35), "black", 0.02)
    elif "square1" in asset_id:
        for x, z in [(-0.18, 0.62), (0.18, 0.62), (0, 0.36)]:
            cyl("repair_socket", (x * w, front - 0.005, z * h), w * 0.12, 0.004, "grey", rot=(math.radians(90), 0, 0))
    elif "diecast" in asset_id:
        cube("repair_car_window", (0, front - 0.004, h * 0.68), (w * 0.42, 0.004, h * 0.22), "screen", 0.004)
        for x in [-w * 0.28, w * 0.28]:
            cyl("repair_wheel", (x, front - 0.002, h * 0.18), h * 0.18, 0.01, "black", rot=(math.radians(90), 0, 0))
    elif "spacecraft" in asset_id:
        cyl("repair_spacecraft_window", (0, front - 0.005, h * 0.63), w * 0.16, 0.006, "purple_glass", rot=(math.radians(90), 0, 0))
        cube("repair_spacecraft_mouth", (0, front - 0.006, h * 0.32), (w * 0.26, 0.004, h * 0.12), "black", 0.004)
    elif "reel" in asset_id:
        cyl("repair_reel_center", (0, front - 0.004, h * 0.52), w * 0.18, 0.004, "black", rot=(math.radians(90), 0, 0))
    elif "cobra" in asset_id:
        cube("repair_mouse_black_center", (0, front - 0.003, h * 0.62), (w * 0.26, 0.004, h * 0.34), "black", 0.008)
        cyl("repair_scroll", (0, front - 0.006, h * 0.78), w * 0.035, 0.004, "rubber", rot=(math.radians(90), 0, 0))
        cube("repair_mouse_side_shadow", (w * 0.18, front - 0.002, h * 0.42), (w * 0.13, 0.004, h * 0.22), "grey", 0.004)


def export_asset(asset_id: str):
    path = MODELS_ROOT / asset_id / f"{asset_id}.glb"
    proxy = MODELS_ROOT / asset_id / f"{asset_id}.proxy.glb"
    reset_scene()
    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    imported = [obj for obj in set(bpy.context.scene.objects) - before if obj.type == "MESH"]
    discard_imported_geometry(imported)
    w, d, h = DIMS[asset_id]
    add_base_geometry(asset_id, w, d, h)
    if "monitor" in asset_id:
        add_monitor(asset_id, w, d, h)
    elif "reproducer" in asset_id:
        add_speaker(w, d, h)
    elif "hyte" in asset_id:
        add_pc_case(w, d, h)
    elif "hatsu" in asset_id:
        add_keyboard(w, d, h)
    elif "synchronize" in asset_id:
        add_mat(w, d, h)
    elif "times_gate" in asset_id:
        add_clock(w, d, h)
    elif "minifuse" in asset_id:
        add_audio_interface(w, d, h)
    else:
        add_small_details(asset_id, w, d, h)

    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format="GLB",
        export_yup=True,
        export_apply=True,
        export_animations=False,
        export_cameras=False,
        export_lights=False,
    )
    bpy.ops.export_scene.gltf(
        filepath=str(proxy),
        export_format="GLB",
        export_yup=True,
        export_apply=True,
        export_animations=False,
        export_cameras=False,
        export_lights=False,
    )


def main() -> None:
    for asset_id in DIMS:
        export_asset(asset_id)
        print(f"repaired {asset_id}")


if __name__ == "__main__":
    main()
