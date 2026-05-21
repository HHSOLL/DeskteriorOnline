#!/usr/bin/env python3
"""Generate prototype-only DeskteriorOnline assets for the So Ong desk setup video.

The output is intentionally marked as a reference/prototype pack in the app
catalog. It uses procedural geometry so the products are recognizable in the
editor, but it is not a manufacturer-licensed commercial asset set.
"""

from __future__ import annotations

import math
import json
import shutil
import subprocess
from pathlib import Path

import bpy
from mathutils import Vector


REPO_ROOT = Path(__file__).resolve().parents[1]
MODELS_ROOT = REPO_ROOT / "apps/web/public/assets/models"
THUMB_ROOT = REPO_ROOT / "apps/web/public/assets/catalog/thumbnails"
PREVIEW_ROOT = REPO_ROOT / "assets/references/video-scenes/so-ong-space-2026-05-desk-setup"
FIDELITY_REPORT_PATH = PREVIEW_ROOT / "visual-fidelity-report.json"


ASSETS = [
    ("p2s_video_so_ong_tfg40q14wp_monitor", "TFG40Q14WP", (0.944, 0.287, 0.596), "monitor_ultrawide"),
    ("p2s_video_so_ong_cpm1610iq_portable_monitor", "CPM1610IQ", (0.358, 0.04, 0.235), "portable_monitor"),
    ("p2s_video_so_ong_empathist_stand", "디 엠파시스트", (0.28, 0.18, 0.12), "riser_stand"),
    ("p2s_video_so_ong_ivy_planter", "IVY", (0.11, 0.09, 0.115), "ivy_planter"),
    ("p2s_video_so_ong_sml_spacecraft", "SML SS 001", (0.16, 0.115, 0.13), "spacecraft"),
    ("p2s_video_so_ong_divoom_times_gate", "Times Gate", (0.283, 0.047, 0.097), "times_gate"),
    ("p2s_video_so_ong_charging_reel_cable", "Reel cable", (0.075, 0.075, 0.028), "reel_cable"),
    ("p2s_video_so_ong_square1_power_cube", "Square1", (0.076, 0.076, 0.076), "power_cube"),
    ("p2s_video_so_ong_ecolor_power_strip", "Ecolor", (0.27, 0.08, 0.058), "power_strip"),
    ("p2s_video_so_ong_hue_infuse_ceiling_light", "Hue Infuse", (0.381, 0.381, 0.09), "ceiling_light"),
    ("p2s_video_so_ong_movlabs_stand", "Movlabs stand", (0.52, 0.52, 1.35), "mobile_stand"),
    ("p2s_video_so_ong_s32dg800_monitor", "S32DG800", (0.72, 0.264, 0.585), "monitor_32"),
    ("p2s_video_so_ong_bookshelf_planter", "Bookshelf plant", (0.11, 0.11, 0.19), "bookshelf_plant"),
    ("p2s_video_so_ong_arachne_wood_blind", "Arachne blind", (1.2, 0.04, 1.0), "wood_blind"),
    ("p2s_video_so_ong_jekca_cat_block", "JEKCA cat", (0.22, 0.105, 0.26), "block_cat"),
    ("p2s_video_so_ong_gravastar_mars_pro", "Mars Pro", (0.201, 0.18, 0.191), "mars_pro"),
    ("p2s_video_so_ong_plant_guardian_spray", "Plant spray", (0.07, 0.055, 0.21), "spray"),
    ("p2s_video_so_ong_sanro_switch_cover", "SANRO cover", (0.12, 0.015, 0.12), "switch_cover"),
    ("p2s_video_so_ong_diecast_car", "Diecast", (0.12, 0.055, 0.045), "diecast"),
    ("p2s_video_so_ong_arturia_minifuse2", "MiniFuse 2", (0.2, 0.1, 0.043), "audio_interface"),
    ("p2s_video_so_ong_offrame_dual_monitor_riser", "OFFRAME riser", (1.0, 0.25, 0.12), "offrame_riser"),
    ("p2s_video_so_ong_razer_cobra_pro_white", "Cobra Pro White", (0.1196, 0.0625, 0.0381), "cobra_mouse"),
    ("p2s_video_so_ong_zionworks_synchronize_mat", "SYNCHRONIZE mat", (0.9, 0.4, 0.004), "synchronize_mat"),
    ("p2s_video_so_ong_angry_miao_am_hatsu", "AM HATSU", (0.36, 0.22, 0.075), "am_hatsu_keyboard"),
    ("p2s_video_so_ong_elgato_stream_deck_neo", "Stream Deck Neo", (0.107, 0.078, 0.026), "stream_deck_neo"),
    ("p2s_video_so_ong_reproducer_epic5", "Epic 5", (0.19, 0.24, 0.31), "epic5_speaker"),
    ("p2s_video_so_ong_hyte_y70_snow_white", "HYTE Y70", (0.47, 0.32, 0.47), "hyte_y70_case"),
    ("p2s_video_so_ong_atom_60th_figure", "Atom 60th", (0.16, 0.12, 0.28), "atom_figure"),
]

VISIBLE_ASSET_KEYS = {
    "p2s_video_so_ong_tfg40q14wp_monitor",
    "p2s_video_so_ong_cpm1610iq_portable_monitor",
    "p2s_video_so_ong_empathist_stand",
    "p2s_video_so_ong_ivy_planter",
    "p2s_video_so_ong_sml_spacecraft",
    "p2s_video_so_ong_divoom_times_gate",
    "p2s_video_so_ong_charging_reel_cable",
    "p2s_video_so_ong_square1_power_cube",
    "p2s_video_so_ong_gravastar_mars_pro",
    "p2s_video_so_ong_diecast_car",
    "p2s_video_so_ong_arturia_minifuse2",
    "p2s_video_so_ong_offrame_dual_monitor_riser",
    "p2s_video_so_ong_razer_cobra_pro_white",
    "p2s_video_so_ong_zionworks_synchronize_mat",
    "p2s_video_so_ong_angry_miao_am_hatsu",
    "p2s_video_so_ong_reproducer_epic5",
    "p2s_video_so_ong_hyte_y70_snow_white",
}

ASSETS_TO_GENERATE = [asset for asset in ASSETS if asset[0] in VISIBLE_ASSET_KEYS]


# Product-detail and reference-still driven acceptance hints. These are not a
# legal/commercial release gate; they make the private prototype factory fail
# visibly when a hero item collapses back into a generic box.
REFERENCE_STILL_SIGNATURES = {
    "monitor_ultrawide": {
        "target": "Huge white ultrawide display, black flip-clock wallpaper, thin silver lower bezel, black light bar clipped on top.",
        "required": [
            "thin_display_shell",
            "black_screen_glass",
            "flip_clock_card",
            "screen_clock_digits",
            "thin_bottom_bezel",
            "top_monitor_light_bar",
            "light_bar_clip",
        ],
    },
    "hyte_y70_case": {
        "target": "Snow-white panoramic glass PC case with white frame, visible RGB fan stacks, vertical GPU, AIO tubes, and side/front glass.",
        "required": [
            "hyte_front_glass",
            "hyte_side_glass",
            "hyte_front_stack_fan_ring",
            "hyte_side_fan_ring",
            "hyte_bottom_fan_ring",
            "hyte_vertical_gpu",
            "hyte_white_aio_tube",
            "hyte_motherboard",
            "hyte_corner_seam_black",
        ],
    },
    "epic5_speaker": {
        "target": "White studio monitor with black recessed baffle, small tweeter, large woofer, blue status LED, and black spike feet.",
        "required": [
            "epic5_tapered_white_cabinet",
            "epic5_black_recessed_front",
            "epic5_tweeter",
            "epic5_woofer",
            "epic5_status_led",
            "epic5_spike_foot",
        ],
    },
    "times_gate": {
        "target": "Divoom Times Gate: five separate LCD windows inside a long black cyberpunk capsule with smoked side caps.",
        "required": [
            "times_gate_body",
            "times_gate_clear_side_cap",
            "ips_screen",
            "digit_",
            "screen_separator",
            "tiny_clock_foot",
        ],
    },
    "am_hatsu_keyboard": {
        "target": "Two separated organic white 3D keyboard halves with dark sculpted keys and white palm rests on the mat.",
        "required": [
            "hatsu_left_organic_cnc_body",
            "hatsu_right_organic_cnc_body",
            "hatsu_left_key",
            "hatsu_right_key",
            "hatsu_left_floating_white_palm_rest",
            "hatsu_right_floating_white_palm_rest",
            "hatsu_left_white_light_strip",
            "hatsu_right_white_light_strip",
        ],
    },
    "synchronize_mat": {
        "target": "Large black woven SYNCHRONIZE desk mat with white stitched border, visible weave, label patch, and wordmark.",
        "required": [
            "synchronize_rubber_base",
            "synchronize_white_edge",
            "woven_vertical_thread",
            "woven_horizontal_thread",
            "synchronize_wordmark",
            "synchronize_label_patch",
        ],
    },
    "portable_monitor": {
        "target": "Small angled portable monitor in front of the main screen with black display and bright FINE text.",
        "required": [
            "portable_screen_body",
            "portable_screen_face",
            "portable_screen_word",
            "folding_kickstand",
            "lower_tablet_lip",
        ],
    },
    "mars_pro": {
        "target": "Small black GravaStar Mars Pro speaker in front of the left speaker, with robot shell, yellow driver core, tripod feet, and side pods.",
        "required": [
            "mars_spherical_body",
            "mars_outer_cage",
            "mars_flat_front_plate",
            "speaker_core_ring",
            "speaker_yellow_core",
            "tripod_leg",
            "mars_side_pod",
        ],
    },
    "audio_interface": {
        "target": "White Arturia MiniFuse 2 under the portable monitor with black front panel, two combo inputs, silver knobs, blue LEDs, and front label.",
        "required": [
            "minifuse_body",
            "minifuse_dark_front_panel",
            "combo_input",
            "silver_knob",
            "blue_status_led",
            "arturia_mark",
        ],
    },
    "ivy_planter": {
        "target": "Small white IVY robot planter at the right of the portable display with black face, two eyes, smile, rim, and green plant leaves.",
        "required": [
            "rounded_ai_planter",
            "planter_rim",
            "black_face_display",
            "left_eye",
            "right_eye",
            "ivy_smile",
            "ivy_leaf",
        ],
    },
}

FIDELITY_REPORTS = []


def reset_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    bpy.context.scene.unit_settings.system = "METRIC"
    bpy.context.scene.render.engine = "BLENDER_EEVEE_NEXT"


def material(
    name: str,
    color: tuple[float, float, float, float],
    roughness: float = 0.55,
    metallic: float = 0.0,
    emission: tuple[float, float, float, float] | None = None,
    emission_strength: float = 0.0,
):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = color
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Metallic"].default_value = metallic
        if emission and "Emission Color" in bsdf.inputs:
            bsdf.inputs["Emission Color"].default_value = emission
        if emission_strength and "Emission Strength" in bsdf.inputs:
            bsdf.inputs["Emission Strength"].default_value = emission_strength
        if "Alpha" in bsdf.inputs:
            bsdf.inputs["Alpha"].default_value = color[3]
    mat.diffuse_color = color
    if color[3] < 1:
        mat.blend_method = "BLEND"
        mat.use_screen_refraction = True
    return mat


MAT = {}


def ensure_materials() -> None:
    MAT.clear()
    MAT.update(
        {
            "warm_white": material("warm_white_powder_coat", (0.92, 0.91, 0.88, 1), 0.68),
            "cool_white": material("cool_white_plastic", (0.94, 0.95, 0.96, 1), 0.58),
            "ceramic_white": material("slightly_warm_ceramic_white", (0.86, 0.85, 0.81, 1), 0.72),
            "black": material("soft_black_plastic", (0.015, 0.016, 0.018, 1), 0.48),
            "screen": material("glossy_black_screen", (0.001, 0.002, 0.005, 1), 0.12),
            "screen_raised": material("raised_charcoal_screen_glass", (0.007, 0.009, 0.015, 1), 0.16),
            "screen_card": material("slightly_lifted_clock_card", (0.018, 0.021, 0.031, 1), 0.18),
            "screen_reflection": material("soft_screen_reflection", (0.22, 0.24, 0.31, 0.22), 0.08),
            "glass": material("soft_blue_glass", (0.55, 0.72, 0.95, 0.24), 0.1),
            "lavender": material("lavender_screen_glow", (0.55, 0.48, 0.9, 1), 0.22),
            "wall_lavender": material("soft_lavender_wall_paint", (0.52, 0.48, 0.8, 1), 0.78),
            "white_lit": material(
                "soft_off_white_desktop_laminate",
                (0.78, 0.775, 0.74, 1),
                0.82,
                emission=(0.78, 0.76, 0.72, 1),
                emission_strength=0.0,
            ),
            "desk_white_clean": material("clean_satin_white_desk", (0.88, 0.875, 0.84, 1), 0.78),
            "grey": material("warm_grey_rubber", (0.45, 0.46, 0.48, 1), 0.62),
            "silver": material("brushed_silver", (0.78, 0.77, 0.72, 1), 0.34, 0.55),
            "chrome": material("polished_chrome", (0.88, 0.88, 0.84, 1), 0.18, 0.9),
            "dark_metal": material("gunmetal_anodized", (0.08, 0.085, 0.095, 1), 0.38, 0.45),
            "black_anodized": material("black_anodized_metal", (0.012, 0.013, 0.017, 1), 0.28, 0.55),
            "wood": material("pale_oak_slats", (0.72, 0.61, 0.48, 1), 0.7),
            "green": material("plant_leaf_green", (0.08, 0.34, 0.17, 1), 0.72),
            "skin": material("figure_warm_skin", (0.98, 0.72, 0.55, 1), 0.5),
            "hair": material("figure_black_hair", (0.0, 0.0, 0.002, 1), 0.42),
            "yellow": material("small_warm_led", (1.0, 0.76, 0.28, 1), 0.25, emission=(1.0, 0.62, 0.18, 1), emission_strength=0.7),
            "red": material("small_red_detail", (0.68, 0.08, 0.05, 1), 0.45),
            "blue_led": material("cool_status_led", (0.25, 0.52, 1.0, 1), 0.2, emission=(0.2, 0.45, 1.0, 1), emission_strength=0.8),
            "rgb": material("soft_rgb_underglow", (0.7, 0.78, 1.0, 1), 0.14, emission=(0.58, 0.7, 1.0, 1), emission_strength=2.05),
            "rgb_white": material("white_rgb_fan_glow", (0.96, 0.98, 1.0, 1), 0.12, emission=(0.9, 0.95, 1.0, 1), emission_strength=2.8),
            "lavender_glow": material("lavender_area_glow", (0.56, 0.49, 0.96, 1), 0.25, emission=(0.44, 0.34, 1.0, 1), emission_strength=0.55),
            "strong_lavender_glow": material("strong_lavender_wall_wash", (0.58, 0.52, 0.92, 1), 0.3, emission=(0.48, 0.38, 0.9, 1), emission_strength=1.25),
            "transparent_wall_bloom": material("transparent_lavender_wall_bloom", (0.72, 0.68, 1.0, 0.18), 0.35, emission=(0.5, 0.44, 0.9, 1), emission_strength=0.75),
            "screen_white": material("screen_bright_white_pixels", (0.95, 0.95, 0.92, 1), 0.14, emission=(0.96, 0.96, 0.9, 1), emission_strength=1.35),
            "rubber": material("matte_black_rubber", (0.006, 0.006, 0.007, 1), 0.82),
            "woven_dark": material("woven_dark_cloth", (0.026, 0.028, 0.034, 1), 0.92),
            "thread_grey": material("subtle_woven_thread", (0.075, 0.08, 0.095, 1), 0.94),
            "dark_glass": material("smoked_dark_glass", (0.03, 0.04, 0.055, 0.55), 0.12),
            "smoked_glass": material("clear_smoked_tempered_glass", (0.24, 0.3, 0.38, 0.26), 0.07),
            "mesh_shadow": material("black_perforated_mesh", (0.009, 0.01, 0.012, 1), 0.72),
            "keycap_black": material("slightly_glossy_black_keycap", (0.018, 0.018, 0.02, 1), 0.36),
            "cable_white": material("soft_white_cable_rubber", (0.78, 0.79, 0.78, 1), 0.62),
            "cable_black": material("black_cable_rubber", (0.005, 0.005, 0.006, 1), 0.72),
        }
    )


def apply_scale(obj):
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.select_set(False)
    return obj


def cube(name, loc, scale, mat_name="warm_white", bevel=0.0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = scale
    apply_scale(obj)
    if mat_name:
        obj.data.materials.append(MAT[mat_name])
    if bevel > 0:
        mod = obj.modifiers.new("small_radius_edges", "BEVEL")
        mod.width = bevel
        mod.segments = 4
        obj.modifiers.new("weighted_normals", "WEIGHTED_NORMAL")
    return obj


def cyl(name, loc, radius, depth, mat_name="warm_white", vertices=48, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc, rotation=rot)
    obj = bpy.context.object
    obj.name = name
    if mat_name:
        obj.data.materials.append(MAT[mat_name])
    obj.modifiers.new("weighted_normals", "WEIGHTED_NORMAL")
    return obj


def cone(name, loc, radius1, radius2, depth, mat_name="warm_white", vertices=32, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cone_add(
        vertices=vertices,
        radius1=radius1,
        radius2=radius2,
        depth=depth,
        location=loc,
        rotation=rot,
    )
    obj = bpy.context.object
    obj.name = name
    if mat_name:
        obj.data.materials.append(MAT[mat_name])
    obj.modifiers.new("weighted_normals", "WEIGHTED_NORMAL")
    return obj


def torus(name, loc, major_radius, minor_radius, mat_name="warm_white", rot=(0, 0, 0), segments=72):
    bpy.ops.mesh.primitive_torus_add(
        major_segments=segments,
        minor_segments=12,
        major_radius=major_radius,
        minor_radius=minor_radius,
        location=loc,
        rotation=rot,
    )
    obj = bpy.context.object
    obj.name = name
    if mat_name:
        obj.data.materials.append(MAT[mat_name])
    obj.modifiers.new("weighted_normals", "WEIGHTED_NORMAL")
    return obj


def cable_curve(name, points, mat_name="cable_white", bevel=0.006):
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 2
    curve.bevel_depth = bevel
    curve.bevel_resolution = 4
    poly = curve.splines.new("POLY")
    poly.points.add(len(points) - 1)
    for point, coord in zip(poly.points, points):
        point.co = (coord[0], coord[1], coord[2], 1.0)
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(MAT[mat_name])
    return obj


def sphere(name, loc, radius, mat_name="warm_white", scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=48, ring_count=24, radius=radius, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    apply_scale(obj)
    if mat_name:
        obj.data.materials.append(MAT[mat_name])
    obj.modifiers.new("weighted_normals", "WEIGHTED_NORMAL")
    return obj


def text_label(name, text, loc, size=0.06, mat_name="cool_white", rot=(math.radians(90), 0, 0)):
    bpy.ops.object.text_add(location=loc, rotation=rot)
    obj = bpy.context.object
    obj.name = name
    obj.data.body = text
    obj.data.align_x = "CENTER"
    obj.data.align_y = "CENTER"
    obj.data.size = size
    obj.data.extrude = 0.001
    obj.data.materials.append(MAT[mat_name])
    return obj


def look_at(obj, target: tuple[float, float, float]) -> None:
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def add_monitor(width, height, depth, label="FINE", ultrawide=False):
    panel_h = height * (0.72 if ultrawide else 0.68)
    panel_w = width
    z = height * 0.62
    shell_mat = "cool_white" if ultrawide else "silver"
    cube("thin_display_shell", (0, 0, z), (panel_w, depth * 0.12, panel_h), shell_mat, 0.012)
    cube("inner_black_bezel_shadow", (0, -depth * 0.104, z), (panel_w * 0.965, depth * 0.018, panel_h * 0.89), "black", 0.006)
    screen_w = panel_w * (0.975 if ultrawide else 0.935)
    screen_h = panel_h * (0.88 if ultrawide else 0.82)
    cube("black_screen_glass", (0, -depth * 0.11, z + panel_h * 0.01), (screen_w, 0.006, screen_h), "screen", 0.006)
    cube("screen_upper_soft_reflection", (-panel_w * 0.18, -depth * 0.116, z + panel_h * 0.25), (screen_w * 0.46, 0.003, screen_h * 0.12), "screen_reflection", 0.008)
    cube("thin_bottom_bezel", (0, -depth * 0.118, z - panel_h * 0.455), (panel_w * 0.985, 0.01, panel_h * 0.04), "silver", 0.003)
    cube("rear_white_shell", (0, depth * 0.065, z), (panel_w * 0.88, depth * 0.035, panel_h * 0.7), "cool_white", 0.01)
    if label:
        if ultrawide and " " in label:
            parts = label.split(" ")
            x_positions = [-panel_w * 0.285, 0.0, panel_w * 0.285]
            for i, (part, x) in enumerate(zip(parts, x_positions)):
                cube(f"flip_clock_card_{i}", (x, -depth * 0.117, z + panel_h * 0.025), (panel_w * 0.22, 0.004, panel_h * 0.48), "screen_card", 0.018)
                cube(f"flip_clock_card_highlight_{i}", (x - panel_w * 0.025, -depth * 0.121, z + panel_h * 0.17), (panel_w * 0.15, 0.002, panel_h * 0.035), "screen_reflection", 0.006)
                text_label(f"screen_clock_digits_{i}", part, (x, -depth * 0.128, z + panel_h * 0.01), panel_h * 0.39, "screen_white")
            text_label("screen_pm_label", "PM", (-panel_w * 0.42, -depth * 0.128, z - panel_h * 0.15), panel_h * 0.09, "screen_white")
        else:
            text_label("screen_label", label, (0, -depth * 0.13, z + panel_h * 0.02), panel_h * 0.22, "screen_white")
    cyl("height_adjust_column", (0, depth * 0.04, height * 0.28), width * 0.014, height * 0.36, "warm_white", vertices=28)
    cube("stand_neck_cover", (0, depth * 0.018, height * 0.39), (width * 0.055, depth * 0.14, height * 0.22), "warm_white", 0.012)
    cube("low_monitor_base", (0, 0, height * 0.035), (width * 0.22, depth * 0.66, height * 0.06), "warm_white", 0.014)
    cube("rear_vesa_plate", (0, depth * 0.105, z), (width * 0.15, 0.016, panel_h * 0.2), "silver", 0.005)


def build(kind: str, dims: tuple[float, float, float]) -> None:
    w, d, h = dims
    if kind == "monitor_ultrawide":
        add_monitor(w, h, d, "3 26 36", ultrawide=True)
        cyl("top_monitor_light_bar", (0, -d * 0.12, h * 0.985), h * 0.018, w * 0.42, "black", 32, rot=(0, math.radians(90), 0))
        cube("light_bar_clip", (0, -d * 0.08, h * 0.93), (w * 0.08, d * 0.08, h * 0.04), "black", 0.006)
        cube("white_lower_logo_bar", (0, -d * 0.112, h * 0.33), (w * 0.28, 0.006, h * 0.018), "cool_white", 0.003)
        for x in (-w * 0.22, w * 0.22):
            cube("clock_card_vertical_gap", (x, -d * 0.151, h * 0.63), (w * 0.008, 0.004, h * 0.38), "screen_reflection", 0.003)
    elif kind == "monitor_32":
        add_monitor(w, h, d, "OLED", ultrawide=False)
        cube("odyssey_slim_neck", (0, d * 0.03, h * 0.38), (w * 0.045, d * 0.08, h * 0.28), "silver", 0.01)
        for x in (-w * 0.16, w * 0.16):
            cube("split_stand_foot", (x, -d * 0.03, h * 0.035), (w * 0.22, d * 0.65, h * 0.032), "silver", 0.01)
    elif kind == "portable_monitor":
        cube("portable_screen_body", (0, 0, h * 0.55), (w, d * 0.22, h * 0.82), "black", 0.006)
        cube("portable_screen_face", (0, -d * 0.13, h * 0.56), (w * 0.93, 0.005, h * 0.69), "screen", 0.006)
        text_label("portable_screen_word", "FINE", (0, -d * 0.19, h * 0.57), h * 0.2, "cool_white")
        cube("folding_kickstand", (0, d * 0.28, h * 0.18), (w * 0.82, d * 0.08, h * 0.32), "grey", 0.004)
        cube("lower_tablet_lip", (0, -d * 0.16, h * 0.12), (w * 0.72, 0.006, h * 0.035), "silver", 0.003)
    elif kind == "riser_stand":
        cube("riser_top_plate", (0, 0, h * 0.9), (w, d, h * 0.1), "cool_white", 0.012)
        for i in range(5):
            x = -w * 0.36 + i * w * 0.18
            cube("riser_wire_slot", (x, 0, h * 0.955), (w * 0.03, d * 0.82, h * 0.01), "silver", 0.002)
        for x in (-w * 0.42, w * 0.42):
            cyl("wire_leg", (x, -d * 0.38, h * 0.45), h * 0.035, h * 0.82, "silver", 18)
            cyl("wire_leg_back", (x, d * 0.38, h * 0.45), h * 0.035, h * 0.82, "silver", 18)
    elif kind == "ivy_planter":
        sphere("rounded_ai_planter", (0, 0, h * 0.45), w * 0.43, "cool_white", (1.0, 0.8, 0.82))
        torus("planter_rim", (0, 0, h * 0.77), w * 0.29, w * 0.014, "cool_white", segments=64)
        cube("black_face_display", (0, -d * 0.41, h * 0.47), (w * 0.42, 0.006, h * 0.25), "screen", 0.008)
        sphere("left_eye", (-w * 0.08, -d * 0.415, h * 0.49), w * 0.025, "cool_white")
        sphere("right_eye", (w * 0.08, -d * 0.415, h * 0.49), w * 0.025, "cool_white")
        text_label("ivy_smile", "•", (0, -d * 0.421, h * 0.41), h * 0.1, "cool_white")
        for i in range(8):
            angle = i * math.tau / 8
            leaf = cube("ivy_leaf", (math.cos(angle) * w * 0.12, math.sin(angle) * d * 0.08, h * 0.9), (w * 0.06, d * 0.02, h * 0.22), "green", 0.006)
            leaf.rotation_euler[2] = angle
    elif kind == "spacecraft":
        sphere("capsule_body", (0, 0, h * 0.55), w * 0.38, "cool_white", (1.0, 0.72, 0.78))
        cyl("viewport_ring", (0, -d * 0.39, h * 0.7), w * 0.13, 0.01, "grey", 40, rot=(math.radians(90), 0, 0))
        cyl("viewport_glass", (0, -d * 0.405, h * 0.7), w * 0.09, 0.01, "glass", 40, rot=(math.radians(90), 0, 0))
        cube("front_hatch", (0, -d * 0.41, h * 0.38), (w * 0.22, 0.012, h * 0.22), "black", 0.006)
        text_label("pilot_face", "▣", (0, -d * 0.418, h * 0.37), h * 0.13, "cool_white")
        cyl("top_sensor_dome", (0, 0, h * 0.96), w * 0.095, h * 0.045, "dark_glass", 40)
        for x in (-w * 0.22, w * 0.22):
            cyl("stubby_leg", (x, 0, h * 0.12), w * 0.035, h * 0.24, "grey", 16)
            sphere("round_foot", (x, -d * 0.16, h * 0.04), w * 0.04, "grey", (1, 0.8, 0.35))
    elif kind == "times_gate":
        cube("times_gate_body", (0, 0, h * 0.5), (w, d, h), "black", 0.012)
        cube("times_gate_back_rail", (0, d * 0.54, h * 0.7), (w * 0.9, d * 0.09, h * 0.24), "dark_metal", 0.005)
        for x in (-w * 0.47, w * 0.47):
            cyl("times_gate_clear_side_cap", (x, -d * 0.02, h * 0.55), h * 0.42, d * 0.88, "smoked_glass", 40, rot=(math.radians(90), 0, 0))
            cyl("times_gate_side_ring", (x, -d * 0.02, h * 0.55), h * 0.42, d * 0.035, "dark_metal", 40, rot=(math.radians(90), 0, 0))
        for i, char in enumerate(["3", "2", "6", "3", "6"]):
            x = (i - 2) * w * 0.18
            cube("ips_screen", (x, -d * 0.52, h * 0.55), (w * 0.14, 0.005, h * 0.62), "screen", 0.006)
            text_label(f"digit_{i}", char, (x, -d * 0.532, h * 0.55), h * 0.42, "cool_white")
            cube(f"screen_separator_{i}", (x + w * 0.075, -d * 0.527, h * 0.55), (w * 0.008, 0.006, h * 0.55), "dark_metal", 0.001)
        for x in (-w * 0.38, w * 0.38):
            cube("tiny_clock_foot", (x, -d * 0.14, h * 0.035), (w * 0.12, d * 0.45, h * 0.055), "dark_metal", 0.004)
    elif kind == "reel_cable":
        cyl("circular_reel_shell", (0, 0, h * 0.5), w * 0.43, h, "cool_white", 64)
        cyl("dark_inner_spool", (0, 0, h * 0.52), w * 0.25, h * 1.08, "grey", 64)
        cyl("coiled_cable_ring", (0, 0, h * 0.56), w * 0.36, h * 0.12, "black", 64)
        torus("visible_cable_coil", (0, 0, h * 0.62), w * 0.255, w * 0.012, "rubber", segments=72)
        torus("outer_cable_coil", (0, 0, h * 0.65), w * 0.335, w * 0.01, "rubber", segments=72)
        cube("usb_c_tail", (w * 0.46, 0, h * 0.52), (w * 0.22, d * 0.12, h * 0.16), "black", 0.004)
    elif kind == "power_cube":
        cube("square1_cube_body", (0, 0, h * 0.5), (w, d, h), "cool_white", 0.012)
        for x, z in [(-0.018, 0.065), (0.018, 0.065), (0, 0.035)]:
            cyl("socket_round", (x, -d * 0.51, z), w * 0.12, 0.006, "grey", 32, rot=(math.radians(90), 0, 0))
        for y, z in [(-d * 0.18, h * 0.68), (d * 0.18, h * 0.68)]:
            cyl("side_socket_round", (-w * 0.51, y, z), w * 0.1, 0.006, "grey", 32, rot=(0, math.radians(90), 0))
        cube("fabric_cable_exit", (0, d * 0.55, h * 0.5), (w * 0.16, d * 0.16, h * 0.16), "rubber", 0.004)
    elif kind == "power_strip":
        cube("ecolor_strip_body", (0, 0, h * 0.5), (w, d, h), "cool_white", 0.01)
        for i in range(4):
            x = (i - 1.5) * w * 0.2
            cyl("socket", (x, -d * 0.51, h * 0.56), d * 0.19, 0.006, "grey", 32, rot=(math.radians(90), 0, 0))
            cube("child_safety_slot", (x, -d * 0.515, h * 0.56), (d * 0.18, 0.004, h * 0.04), "dark_metal", 0.001)
        cube("red_switch", (w * 0.42, -d * 0.52, h * 0.55), (w * 0.08, 0.006, h * 0.18), "red", 0.003)
        cube("power_cable_tail", (-w * 0.56, 0, h * 0.5), (w * 0.18, d * 0.18, h * 0.16), "rubber", 0.004)
    elif kind == "ceiling_light":
        cyl("infuse_outer_disc", (0, 0, h * 0.55), w * 0.5, h * 0.56, "cool_white", 96)
        cyl("infuse_glow_lens", (0, 0, h * 0.22), w * 0.42, h * 0.12, "lavender_glow", 96)
        torus("infuse_shadow_gap", (0, 0, h * 0.52), w * 0.42, w * 0.018, "dark_glass", segments=96)
        cyl("infuse_ceiling_cap", (0, 0, h * 0.94), w * 0.33, h * 0.16, "cool_white", 96)
    elif kind == "mobile_stand":
        cyl("rolling_base_disc", (0, 0, h * 0.03), w * 0.42, h * 0.035, "cool_white", 64)
        cyl("stand_pole", (0, 0, h * 0.5), w * 0.035, h * 0.86, "cool_white", 32)
        cube("screen_mount_plate", (0, -d * 0.08, h * 0.82), (w * 0.42, d * 0.055, h * 0.11), "grey", 0.01)
        for x, y, rz in [(0.28, 0, 0), (-0.28, 0, 0), (0, 0.28, math.radians(90)), (0, -0.28, math.radians(90))]:
            cube("star_base_arm", (x * w * 0.5, y * d * 0.5, h * 0.055), (w * 0.42 if y else w * 0.1, d * 0.1 if x else d * 0.42, h * 0.035), "cool_white", 0.012)
            sphere("small_castor", (x * w, y * d, h * 0.03), w * 0.025, "grey")
        cube("height_adjust_collar", (0, 0, h * 0.63), (w * 0.12, d * 0.12, h * 0.035), "grey", 0.008)
    elif kind == "bookshelf_plant":
        cyl("ribbed_planter", (0, 0, h * 0.25), w * 0.35, h * 0.42, "cool_white", 48)
        for i in range(10):
            angle = i * math.tau / 10
            cube("planter_vertical_rib", (math.cos(angle) * w * 0.355, math.sin(angle) * d * 0.355, h * 0.25), (w * 0.018, d * 0.018, h * 0.39), "warm_white", 0.002)
        for i in range(12):
            angle = i * math.tau / 12
            leaf = cube("long_leaf", (math.cos(angle) * w * 0.08, math.sin(angle) * d * 0.08, h * 0.62), (w * 0.045, d * 0.018, h * 0.56), "green", 0.004)
            leaf.rotation_euler[2] = angle
    elif kind == "wood_blind":
        cube("blind_top_header", (0, -d * 0.15, h * 0.98), (w, d * 0.65, h * 0.04), "wood", 0.004)
        count = 24
        for i in range(count):
            z = h * (0.08 + i * 0.84 / (count - 1))
            slat = cube("wooden_blind_slat", (0, -d * 0.35, z), (w, d * 0.5, h * 0.012), "wood", 0.004)
            slat.rotation_euler[0] = math.radians(3)
        for x in (-w * 0.42, w * 0.42):
            cyl("blind_pull_cord", (x, -d * 0.58, h * 0.5), h * 0.0025, h * 0.72, "rubber", 8)
    elif kind == "block_cat":
        cube("blocky_cat_body", (0, 0, h * 0.38), (w * 0.68, d * 0.82, h * 0.56), "cool_white", 0.003)
        cube("blocky_cat_head", (0, -d * 0.12, h * 0.78), (w * 0.48, d * 0.52, h * 0.34), "cool_white", 0.006)
        for x in (-w * 0.15, w * 0.15):
            cube("cat_ear", (x, -d * 0.12, h * 0.99), (w * 0.14, d * 0.12, h * 0.12), "grey", 0.003)
            cube("cat_leg", (x, -d * 0.24, h * 0.1), (w * 0.12, d * 0.16, h * 0.2), "grey", 0.003)
        for x, z in [(-w * 0.08, h * 0.82), (w * 0.11, h * 0.55), (-w * 0.18, h * 0.33)]:
            cube("tabby_pixel_patch", (x, -d * 0.43, z), (w * 0.11, d * 0.025, h * 0.09), "grey", 0.001)
        cyl("tail", (w * 0.36, d * 0.18, h * 0.5), w * 0.035, h * 0.42, "grey", 16)
    elif kind == "mars_pro":
        sphere("mars_spherical_body", (0, 0, h * 0.56), w * 0.38, "black", (1.0, 0.95, 1.02))
        torus("mars_outer_cage", (0, -d * 0.02, h * 0.56), w * 0.39, w * 0.015, "dark_metal", rot=(math.radians(90), 0, 0), segments=72)
        cube("mars_flat_front_plate", (0, -d * 0.405, h * 0.55), (w * 0.5, d * 0.045, h * 0.44), "screen", 0.028)
        cyl("speaker_core_ring", (0, -d * 0.39, h * 0.56), w * 0.2, 0.012, "grey", 48, rot=(math.radians(90), 0, 0))
        cyl("speaker_yellow_core", (0, -d * 0.405, h * 0.56), w * 0.11, 0.014, "yellow", 48, rot=(math.radians(90), 0, 0))
        for i in range(10):
            angle = i * math.tau / 10
            cyl("grille_pin", (math.cos(angle) * w * 0.12, -d * 0.412, h * 0.56 + math.sin(angle) * h * 0.09), w * 0.006, 0.012, "dark_metal", 10, rot=(math.radians(90), 0, 0))
        for angle in (math.radians(90), math.radians(225), math.radians(315)):
            x = math.cos(angle) * w * 0.25
            y = math.sin(angle) * d * 0.25
            leg = cyl("tripod_leg", (x, y, h * 0.18), w * 0.025, h * 0.36, "grey", 16)
            leg.rotation_euler[0] = math.radians(12)
            sphere("claw_foot", (x * 1.15, y * 1.15, h * 0.035), w * 0.035, "dark_metal", (1.2, 0.7, 0.45))
        for x in (-w * 0.31, w * 0.31):
            sphere("mars_side_pod", (x, -d * 0.18, h * 0.61), w * 0.075, "dark_metal", (0.85, 0.65, 1.0))
    elif kind == "spray":
        cyl("spray_bottle_body", (0, 0, h * 0.38), w * 0.32, h * 0.68, "cool_white", 40)
        cube("green_label", (0, -d * 0.33, h * 0.38), (w * 0.42, 0.006, h * 0.28), "green", 0.004)
        cyl("spray_neck", (0, 0, h * 0.78), w * 0.12, h * 0.16, "cool_white", 24)
        cube("spray_trigger_head", (w * 0.08, -d * 0.04, h * 0.9), (w * 0.5, d * 0.38, h * 0.12), "grey", 0.006)
        cube("spray_nozzle_tip", (w * 0.32, -d * 0.17, h * 0.91), (w * 0.14, d * 0.09, h * 0.05), "dark_metal", 0.003)
        text_label("guardian_label", "PLANT", (0, -d * 0.337, h * 0.38), h * 0.11, "cool_white")
    elif kind == "switch_cover":
        cube("sanro_cover_plate", (0, 0, h * 0.5), (w, d, h), "cool_white", 0.008)
        cube("switch_rocker", (0, -d * 0.55, h * 0.5), (w * 0.34, d * 0.18, h * 0.5), "grey", 0.004)
        for x in (-w * 0.28, w * 0.28):
            cyl("cover_screw_cap", (x, -d * 0.61, h * 0.5), w * 0.035, 0.004, "silver", 20, rot=(math.radians(90), 0, 0))
        text_label("sanro_mark", "SANRO", (0, -d * 0.615, h * 0.16), h * 0.07, "grey")
    elif kind == "diecast":
        cube("diecast_car_body", (0, 0, h * 0.48), (w * 0.86, d * 0.82, h * 0.42), "cool_white", 0.008)
        cube("diecast_cabin", (-w * 0.03, -d * 0.02, h * 0.78), (w * 0.38, d * 0.7, h * 0.28), "glass", 0.004)
        cube("front_bumper", (w * 0.45, 0, h * 0.38), (w * 0.045, d * 0.78, h * 0.09), "silver", 0.003)
        cube("rear_bumper", (-w * 0.45, 0, h * 0.38), (w * 0.045, d * 0.78, h * 0.09), "silver", 0.003)
        for y in (-d * 0.22, d * 0.22):
            cube("headlight", (w * 0.48, y, h * 0.48), (w * 0.012, d * 0.12, h * 0.05), "yellow", 0.002)
        for x in (-w * 0.3, w * 0.3):
            for y in (-d * 0.38, d * 0.38):
                cyl("tiny_wheel", (x, y, h * 0.22), h * 0.16, d * 0.16, "black", 24, rot=(math.radians(90), 0, 0))
    elif kind == "audio_interface":
        cube("minifuse_body", (0, 0, h * 0.5), (w, d, h), "cool_white", 0.008)
        cube("minifuse_dark_front_panel", (0, -d * 0.515, h * 0.55), (w * 0.92, 0.006, h * 0.54), "dark_metal", 0.004)
        for x in (-w * 0.32, -w * 0.14):
            cyl("combo_input", (x, -d * 0.51, h * 0.55), h * 0.22, 0.006, "grey", 32, rot=(math.radians(90), 0, 0))
        for x in (w * 0.12, w * 0.32):
            cyl("silver_knob", (x, -d * 0.52, h * 0.57), h * 0.18, 0.01, "silver", 32, rot=(math.radians(90), 0, 0))
        for x in (w * 0.0, w * 0.42):
            cyl("blue_status_led", (x, -d * 0.526, h * 0.28), h * 0.045, 0.005, "blue_led", 16, rot=(math.radians(90), 0, 0))
        cube("usb_hub_slot", (w * 0.43, d * 0.51, h * 0.53), (w * 0.13, 0.006, h * 0.12), "dark_metal", 0.002)
        text_label("arturia_mark", "MiniFuse 2", (0, -d * 0.525, h * 0.22), h * 0.22, "grey")
    elif kind == "offrame_riser":
        cube("offrame_top_shelf", (0, 0, h * 0.92), (w, d, h * 0.12), "cool_white", 0.012)
        cube("offrame_lower_shadow_slot", (0, -d * 0.42, h * 0.82), (w * 0.86, h * 0.035, h * 0.045), "screen", 0.004)
        for x in (-w * 0.45, w * 0.45):
            cube("offrame_side_leg", (x, 0, h * 0.44), (w * 0.045, d * 0.86, h * 0.82), "cool_white", 0.008)
        for x in (-w * 0.28, 0, w * 0.28):
            cyl("offrame_round_bar", (x, -d * 0.47, h * 0.38), h * 0.045, d * 0.72, "silver", 20, rot=(math.radians(90), 0, 0))
        for x in (-w * 0.38, w * 0.38):
            cube("offrame_rubber_foot", (x, -d * 0.32, h * 0.04), (w * 0.1, d * 0.12, h * 0.08), "rubber", 0.004)
    elif kind == "cobra_mouse":
        sphere("cobra_white_shell", (0, 0, h * 0.48), w * 0.42, "cool_white", (0.74, 1.0, 0.34))
        sphere("cobra_black_gloss_top_shell", (0, -d * 0.05, h * 0.58), w * 0.32, "screen", (0.58, 0.74, 0.18))
        cube("cobra_front_split", (0, -d * 0.39, h * 0.55), (w * 0.06, d * 0.26, h * 0.18), "screen", 0.002)
        cyl("cobra_scroll_wheel", (0, -d * 0.42, h * 0.72), w * 0.045, d * 0.14, "rubber", 20, rot=(math.radians(90), 0, 0))
        for x in (-w * 0.2, w * 0.2):
            cube("cobra_side_grip", (x, 0, h * 0.38), (w * 0.06, d * 0.78, h * 0.2), "grey", 0.006)
        for x in (-w * 0.17, w * 0.17):
            cube("cobra_front_button", (x, -d * 0.22, h * 0.78), (w * 0.22, d * 0.46, h * 0.08), "cool_white", 0.006)
            cube("cobra_bright_button_slot", (x, -d * 0.35, h * 0.825), (w * 0.12, d * 0.08, h * 0.022), "rgb_white", 0.002)
        for x in (-w * 0.17, 0, w * 0.17):
            cube("cobra_reference_light_cut", (x, -d * 0.04, h * 0.79), (w * 0.055, d * 0.13, h * 0.026), "rgb_white", 0.003)
        torus("cobra_rgb_underglow", (0, 0, h * 0.2), w * 0.31, w * 0.008, "rgb", segments=72)
        cube("razer_logo_mark", (0, d * 0.3, h * 0.7), (w * 0.12, 0.004, h * 0.035), "rgb", 0.001)
    elif kind == "synchronize_mat":
        cube("synchronize_rubber_base", (0, 0, h * 0.45), (w, d, h), "woven_dark", 0.015)
        cube("synchronize_white_edge_front", (0, -d * 0.49, h * 1.08), (w * 0.98, d * 0.022, h * 0.45), "ceramic_white", 0.002)
        cube("synchronize_white_edge_back", (0, d * 0.49, h * 1.08), (w * 0.98, d * 0.022, h * 0.45), "ceramic_white", 0.002)
        cube("synchronize_white_edge_left", (-w * 0.49, 0, h * 1.08), (w * 0.022, d * 0.98, h * 0.45), "ceramic_white", 0.002)
        cube("synchronize_white_edge_right", (w * 0.49, 0, h * 1.08), (w * 0.022, d * 0.98, h * 0.45), "ceramic_white", 0.002)
        for i in range(44):
            x = -w * 0.43 + i * w * 0.026
            cube("woven_vertical_thread", (x, 0, h * 1.18), (w * 0.0013, d * 0.74, h * 0.18), "thread_grey", 0)
        for i in range(20):
            y = -d * 0.35 + i * d * 0.05
            cube("woven_horizontal_thread", (0, y, h * 1.2), (w * 0.84, d * 0.0014, h * 0.18), "thread_grey", 0)
        for i in range(26):
            x = -w * 0.4 + i * w * 0.047
            y = -d * 0.31 + (i % 6) * d * 0.105
            cube("woven_highlight_pixel", (x, y, h * 1.24), (w * 0.006, d * 0.006, h * 0.18), "silver", 0)
        text_label("synchronize_wordmark", "SYNCHRONIZE", (w * 0.24, -d * 0.42, h * 1.35), d * 0.09, "ceramic_white")
        cube("synchronize_label_patch", (-w * 0.38, -d * 0.38, h * 1.25), (w * 0.13, d * 0.07, h * 0.28), "ceramic_white", 0.003)
        cube("synchronize_label_inner", (-w * 0.38, -d * 0.38, h * 1.36), (w * 0.095, d * 0.043, h * 0.16), "woven_dark", 0.002)
    elif kind == "am_hatsu_keyboard":
        for side, x_center, yaw in (("left", -w * 0.24, math.radians(-10)), ("right", w * 0.24, math.radians(10))):
            sphere(f"hatsu_{side}_organic_cnc_body", (x_center, 0, h * 0.34), w * 0.22, "cool_white", (1.1, 0.78, 0.28))
            cube(f"hatsu_{side}_front_chamfer", (x_center, -d * 0.32, h * 0.22), (w * 0.36, d * 0.15, h * 0.18), "cool_white", 0.02)
            cube(f"hatsu_{side}_floating_white_palm_rest", (x_center, -d * 0.45, h * 0.18), (w * 0.27, d * 0.13, h * 0.12), "ceramic_white", 0.024)
            cube(f"hatsu_{side}_inner_black_seam", (x_center + (0.12 if side == "left" else -0.12), -d * 0.04, h * 0.47), (w * 0.025, d * 0.52, h * 0.06), "screen", 0.006)
            for row in range(4):
                for col in range(6):
                    x = x_center - w * 0.13 + col * w * 0.052
                    y = -d * 0.22 + row * d * 0.13
                    z = h * (0.56 + row * 0.045 + (2 - abs(col - 2.5)) * 0.01)
                    key = cube(f"hatsu_{side}_key_{row}_{col}", (x, y, z), (w * 0.04, d * 0.08, h * 0.13), "keycap_black", 0.006)
                    key.rotation_euler[2] = yaw
                    if row == 1 and col in (1, 3, 5):
                        cube(f"hatsu_{side}_key_legend_{row}_{col}", (x, y - d * 0.001, z + h * 0.068), (w * 0.018, d * 0.018, h * 0.018), "ceramic_white", 0.001)
            for col in range(3):
                key = cube(f"hatsu_{side}_thumb_key_{col}", (x_center + (col - 1) * w * 0.055, -d * 0.42, h * 0.48), (w * 0.055, d * 0.09, h * 0.12), "keycap_black", 0.006)
                key.rotation_euler[2] = yaw * 0.75
            cube(f"hatsu_{side}_white_light_strip", (x_center, d * 0.36, h * 0.48), (w * 0.22, d * 0.018, h * 0.035), "lavender_glow", 0.003)
    elif kind == "stream_deck_neo":
        cube("stream_deck_wedge_body", (0, 0, h * 0.42), (w, d, h * 0.76), "cool_white", 0.01)
        cube("stream_deck_rear_lift", (0, d * 0.34, h * 0.58), (w * 0.9, d * 0.18, h * 0.35), "cool_white", 0.008)
        cube("stream_deck_black_top_face", (0, -d * 0.05, h * 0.86), (w * 0.88, d * 0.72, h * 0.09), "screen", 0.006)
        for row in range(2):
            for col in range(4):
                x = -w * 0.31 + col * w * 0.205
                y = -d * 0.18 + row * d * 0.21
                cube(f"stream_deck_lcd_key_{row}_{col}", (x, y, h * 0.94), (w * 0.15, d * 0.16, h * 0.07), "dark_glass", 0.003)
                cube(f"neo_key_icon_{row}_{col}", (x, y, h * 0.985), (w * 0.045, d * 0.035, h * 0.025), "blue_led", 0.001)
        cube("stream_deck_infobar", (0, d * 0.28, h * 0.97), (w * 0.46, d * 0.05, h * 0.05), "blue_led", 0.003)
        for x in (-w * 0.34, w * 0.34):
            cyl("stream_deck_touch_dot", (x, d * 0.28, h * 0.995), h * 0.055, h * 0.018, "grey", 16)
        cable_curve(
            "stream_deck_fixed_usb_cable",
            [(0, d * 0.46, h * 0.5), (0, d * 0.72, h * 0.42), (-w * 0.22, d * 0.95, h * 0.36)],
            "cable_white",
            h * 0.08,
        )
    elif kind == "epic5_speaker":
        cube("epic5_tapered_white_cabinet", (0, 0, h * 0.48), (w, d, h * 0.86), "ceramic_white", 0.02)
        cube("epic5_left_side_shadow_bevel", (-w * 0.46, -d * 0.04, h * 0.5), (w * 0.055, d * 0.82, h * 0.78), "warm_white", 0.014)
        cube("epic5_right_side_shadow_bevel", (w * 0.46, -d * 0.04, h * 0.5), (w * 0.055, d * 0.82, h * 0.78), "warm_white", 0.014)
        cube("epic5_black_recessed_front", (0, -d * 0.505, h * 0.5), (w * 0.72, 0.008, h * 0.66), "screen", 0.014)
        cyl("epic5_tweeter", (0, -d * 0.515, h * 0.72), w * 0.12, 0.012, "dark_metal", 48, rot=(math.radians(90), 0, 0))
        cyl("epic5_tweeter_dome", (0, -d * 0.523, h * 0.72), w * 0.065, 0.012, "chrome", 48, rot=(math.radians(90), 0, 0))
        cyl("epic5_woofer_outer", (0, -d * 0.515, h * 0.41), w * 0.28, 0.012, "screen", 64, rot=(math.radians(90), 0, 0))
        cyl("epic5_woofer_cone", (0, -d * 0.525, h * 0.41), w * 0.2, 0.012, "dark_metal", 64, rot=(math.radians(90), 0, 0))
        cyl("epic5_center_cap", (0, -d * 0.533, h * 0.41), w * 0.075, 0.012, "rubber", 48, rot=(math.radians(90), 0, 0))
        for radius in (0.31, 0.23):
            torus("epic5_woofer_trim_ring", (0, -d * 0.536, h * 0.41), w * radius, w * 0.006, "dark_metal", rot=(math.radians(90), 0, 0), segments=72)
        cyl("epic5_status_led", (0, -d * 0.53, h * 0.18), w * 0.025, 0.006, "blue_led", 18, rot=(math.radians(90), 0, 0))
        for x in (-w * 0.34, w * 0.34):
            sphere("epic5_spike_foot", (x, -d * 0.2, h * 0.035), w * 0.055, "dark_metal", (0.65, 0.65, 1.0))
        cube("epic5_rear_silver_plate_hint", (0, d * 0.5, h * 0.5), (w * 0.42, 0.008, h * 0.38), "silver", 0.006)
    elif kind == "hyte_y70_case":
        cube("hyte_bottom_frame", (0, 0, h * 0.07), (w, d, h * 0.14), "cool_white", 0.018)
        cube("hyte_top_frame", (0, 0, h * 0.94), (w, d, h * 0.12), "cool_white", 0.018)
        cube("hyte_left_rear_post", (-w * 0.47, d * 0.42, h * 0.5), (w * 0.08, d * 0.11, h * 0.86), "cool_white", 0.014)
        cube("hyte_right_rear_post", (w * 0.47, d * 0.42, h * 0.5), (w * 0.08, d * 0.11, h * 0.86), "cool_white", 0.014)
        cube("hyte_left_front_post", (-w * 0.47, -d * 0.46, h * 0.5), (w * 0.08, d * 0.08, h * 0.82), "cool_white", 0.012)
        cube("hyte_right_front_post", (w * 0.47, -d * 0.46, h * 0.5), (w * 0.08, d * 0.08, h * 0.82), "cool_white", 0.012)
        cube("hyte_rear_panel", (0, d * 0.48, h * 0.52), (w * 0.9, 0.018, h * 0.76), "cool_white", 0.012)
        cube("hyte_dark_interior", (0, -d * 0.11, h * 0.52), (w * 0.78, d * 0.035, h * 0.72), "screen", 0.004)
        cube("hyte_front_glass", (0, -d * 0.515, h * 0.52), (w * 0.86, 0.01, h * 0.78), "smoked_glass", 0.01)
        cube("hyte_side_glass", (w * 0.515, -d * 0.05, h * 0.52), (0.01, d * 0.74, h * 0.78), "smoked_glass", 0.01)
        cube("hyte_corner_seam_black", (w * 0.51, -d * 0.515, h * 0.52), (w * 0.025, 0.018, h * 0.78), "screen", 0.003)
        cube("hyte_front_white_outline_top", (0, -d * 0.526, h * 0.92), (w * 0.92, 0.014, h * 0.035), "cool_white", 0.004)
        cube("hyte_front_white_outline_bottom", (0, -d * 0.526, h * 0.12), (w * 0.92, 0.014, h * 0.035), "cool_white", 0.004)
        cube("hyte_front_white_outline_left", (-w * 0.47, -d * 0.526, h * 0.52), (w * 0.035, 0.014, h * 0.8), "cool_white", 0.004)
        cube("hyte_front_white_outline_right", (w * 0.47, -d * 0.526, h * 0.52), (w * 0.035, 0.014, h * 0.8), "cool_white", 0.004)
        cube("hyte_vertical_front_display", (-w * 0.38, -d * 0.536, h * 0.52), (w * 0.12, 0.008, h * 0.62), "screen_raised", 0.006)
        for row in range(6):
            cube(
                "hyte_front_display_tick",
                (-w * 0.38, -d * 0.542, h * (0.28 + row * 0.08)),
                (w * 0.075, 0.004, h * 0.012),
                "rgb",
                0.001,
            )
        cube("hyte_vertical_gpu", (-w * 0.08, -d * 0.32, h * 0.26), (w * 0.46, 0.018, h * 0.11), "cool_white", 0.006)
        cube("hyte_gpu_black_fan_strip", (-w * 0.08, -d * 0.335, h * 0.26), (w * 0.36, 0.01, h * 0.055), "screen", 0.003)
        cube("hyte_motherboard", (-w * 0.22, -d * 0.345, h * 0.52), (w * 0.26, 0.012, h * 0.45), "dark_metal", 0.005)
        for slot in range(5):
            cube("hyte_motherboard_slot_detail", (-w * 0.24 + slot * w * 0.045, -d * 0.356, h * 0.41), (w * 0.02, 0.006, h * 0.12), "silver", 0.001)
        torus("hyte_cpu_aio_ring", (-w * 0.22, -d * 0.358, h * 0.56), w * 0.07, w * 0.009, "cool_white", rot=(math.radians(90), 0, 0), segments=48)
        cyl("hyte_cpu_lcd_face", (-w * 0.22, -d * 0.367, h * 0.56), w * 0.048, 0.012, "screen", 48, rot=(math.radians(90), 0, 0))
        for i in range(3):
            z = h * (0.24 + i * 0.19)
            torus("hyte_side_fan_ring", (w * 0.33, -d * 0.356, z), w * 0.085, w * 0.009, "cool_white", rot=(math.radians(90), 0, 0), segments=48)
            cyl("hyte_side_fan_glow", (w * 0.33, -d * 0.366, z), w * 0.058, 0.012, "rgb", 48, rot=(math.radians(90), 0, 0))
            for blade in range(5):
                blade_obj = cube("hyte_side_fan_blade", (w * 0.33, -d * 0.376, z), (w * 0.075, 0.004, h * 0.014), "ceramic_white", 0.001)
                blade_obj.rotation_euler[2] = blade * math.tau / 5
        for i in range(3):
            x = -w * 0.2 + i * w * 0.18
            torus("hyte_bottom_fan_ring", (x, -d * 0.365, h * 0.18), w * 0.055, w * 0.007, "cool_white", rot=(math.radians(90), 0, 0), segments=44)
            cyl("hyte_bottom_fan_glow", (x, -d * 0.372, h * 0.18), w * 0.037, 0.01, "rgb", 36, rot=(math.radians(90), 0, 0))
        for i in range(3):
            z = h * (0.32 + i * 0.18)
            torus("hyte_front_stack_fan_ring", (w * 0.23, -d * 0.535, z), w * 0.074, w * 0.008, "cool_white", rot=(math.radians(90), 0, 0), segments=52)
            cyl("hyte_front_stack_fan_glow", (w * 0.23, -d * 0.543, z), w * 0.05, 0.011, "rgb", 48, rot=(math.radians(90), 0, 0))
            for blade in range(4):
                blade_obj = cube("hyte_front_stack_fan_blade", (w * 0.23, -d * 0.551, z), (w * 0.06, 0.004, h * 0.012), "ceramic_white", 0.001)
                blade_obj.rotation_euler[2] = blade * math.tau / 4 + i * 0.2
        cable_curve(
            "hyte_white_aio_tube_a",
            [(-w * 0.22, -d * 0.37, h * 0.59), (-w * 0.08, -d * 0.38, h * 0.72), (w * 0.18, -d * 0.37, h * 0.72)],
            "cable_white",
            w * 0.012,
        )
        cable_curve(
            "hyte_white_aio_tube_b",
            [(-w * 0.23, -d * 0.37, h * 0.53), (-w * 0.06, -d * 0.39, h * 0.63), (w * 0.2, -d * 0.38, h * 0.62)],
            "cable_white",
            w * 0.01,
        )
        for x in (-w * 0.1, w * 0.0, w * 0.1):
            cable_curve("hyte_vertical_white_cable", [(x, -d * 0.37, h * 0.35), (x + w * 0.04, -d * 0.37, h * 0.56)], "cable_white", w * 0.006)
        for x in (-w * 0.34, w * 0.34):
            cube("hyte_case_foot", (x, -d * 0.22, h * 0.035), (w * 0.18, d * 0.14, h * 0.07), "cool_white", 0.006)
    elif kind == "atom_figure":
        sphere("atom_head", (0, 0, h * 0.72), w * 0.22, "skin", (0.95, 0.85, 1.05))
        sphere("atom_body", (0, 0, h * 0.42), w * 0.18, "black", (0.82, 0.65, 1.2))
        for angle in (math.radians(70), math.radians(95), math.radians(120)):
            spike = cyl("atom_hair_spike", (math.cos(angle) * w * 0.09, math.sin(angle) * d * 0.08, h * 0.94), w * 0.035, h * 0.22, "hair", 12)
            spike.rotation_euler[1] = math.radians(55)
            spike.rotation_euler[2] = angle
        for x in (-w * 0.075, w * 0.075):
            sphere("atom_eye", (x, -d * 0.22, h * 0.75), w * 0.03, "cool_white", (1.0, 0.72, 1.0))
            sphere("atom_pupil", (x, -d * 0.245, h * 0.75), w * 0.014, "screen")
        cyl("atom_mouth_smile", (0, -d * 0.24, h * 0.66), w * 0.055, 0.004, "red", 24, rot=(math.radians(90), 0, 0))
        for x in (-w * 0.17, w * 0.17):
            cyl("atom_arm", (x, 0, h * 0.48), w * 0.035, h * 0.34, "skin", 16, rot=(math.radians(22), 0, 0))
            sphere("atom_hand", (x, -d * 0.1, h * 0.3), w * 0.045, "skin")
        for x in (-w * 0.08, w * 0.08):
            cyl("atom_leg", (x, 0, h * 0.18), w * 0.04, h * 0.28, "skin", 16)
            cube("atom_boot", (x, -d * 0.08, h * 0.045), (w * 0.12, d * 0.2, h * 0.09), "red", 0.006)


def export_asset(asset_key: str, label: str, dims: tuple[float, float, float], kind: str) -> None:
    reset_scene()
    ensure_materials()
    build(kind, dims)
    object_names = sorted(obj.name for obj in bpy.context.scene.objects if obj.type not in {"CAMERA", "LIGHT"})
    signature = REFERENCE_STILL_SIGNATURES.get(kind)
    if signature:
        matched = [
            fragment
            for fragment in signature["required"]
            if any(fragment in name for name in object_names)
        ]
        signature_score = round(len(matched) / len(signature["required"]), 3)
    else:
        matched = []
        signature_score = None
    out_dir = MODELS_ROOT / asset_key
    out_dir.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(out_dir / f"{asset_key}.glb"),
        export_format="GLB",
        export_apply=True,
        check_existing=False,
    )
    shutil.copyfile(out_dir / f"{asset_key}.glb", out_dir / f"{asset_key}.proxy.glb")
    render_thumbnail(asset_key, dims)
    model_size = (out_dir / f"{asset_key}.glb").stat().st_size
    FIDELITY_REPORTS.append(
        {
            "assetKey": asset_key,
            "label": label,
            "kind": kind,
            "dimensionsM": {"width": dims[0], "depth": dims[1], "height": dims[2]},
            "objectCount": len(object_names),
            "modelSizeBytes": model_size,
            "referenceTarget": signature["target"] if signature else "listed/reference-only asset",
            "requiredSignatureFragments": signature["required"] if signature else [],
            "matchedSignatureFragments": matched,
            "signatureScore": signature_score,
            "prototypeStatus": "private_reference_rebuild_v2",
        }
    )


def render_thumbnail(asset_key: str, dims: tuple[float, float, float]) -> None:
    THUMB_ROOT.mkdir(parents=True, exist_ok=True)
    max_dim = max(dims)
    bpy.context.scene.world.color = (0.92, 0.92, 0.94)
    bpy.ops.object.light_add(type="AREA", location=(0, -max_dim * 2.1, max_dim * 1.55))
    key = bpy.context.object
    key.name = "thumbnail_large_softbox"
    key.data.energy = 260
    key.data.size = max(max_dim * 2.2, 0.6)
    bpy.ops.object.light_add(type="POINT", location=(max_dim * 0.65, -max_dim * 1.2, max_dim * 0.85))
    rim = bpy.context.object
    rim.name = "thumbnail_small_rim_light"
    rim.data.energy = 42
    rim.data.color = (0.72, 0.68, 1.0)
    bpy.ops.object.camera_add(location=(max_dim * 0.82, -max_dim * 2.1, max_dim * 0.82))
    camera = bpy.context.object
    look_at(camera, (0, 0, dims[2] * 0.48))
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = max(max_dim * 1.35, dims[2] * 1.2, 0.18)
    bpy.context.scene.camera = camera
    bpy.context.scene.render.resolution_x = 640
    bpy.context.scene.render.resolution_y = 480
    bpy.context.scene.eevee.taa_render_samples = 32
    bpy.context.scene.view_settings.view_transform = "Filmic"
    bpy.context.scene.view_settings.look = "Medium High Contrast"
    bpy.context.scene.view_settings.exposure = -0.25
    bpy.ops.render.render(write_still=True)
    bpy.data.images["Render Result"].save_render(str(THUMB_ROOT / f"{asset_key}.png"))


def convert_thumbnails_to_webp() -> None:
    script = """
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('./apps/web/node_modules/sharp');
const thumbDir = path.join(process.cwd(), 'apps/web/public/assets/catalog/thumbnails');
const sources = fs.readdirSync(thumbDir).filter((name) => name.startsWith('p2s_video_so_ong_') && (name.endsWith('.png') || name.endsWith('.svg')));
(async () => {
  for (const source of sources) {
    const sourcePath = path.join(thumbDir, source);
    await sharp(sourcePath).resize(640, 480).webp({ quality: 86 }).toFile(path.join(thumbDir, source.replace(/\\.(svg|png)$/, '.webp')));
    fs.unlinkSync(sourcePath);
  }
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
"""
    subprocess.run(["node", "-e", script], cwd=REPO_ROOT, check=True)


def build_preview() -> None:
    reset_scene()
    ensure_materials()
    PREVIEW_ROOT.mkdir(parents=True, exist_ok=True)
    bpy.context.scene.world.color = (0.38, 0.35, 0.62)
    if hasattr(bpy.context.scene, "eevee"):
        eevee = bpy.context.scene.eevee
        if hasattr(eevee, "use_gtao"):
            eevee.use_gtao = True
        if hasattr(eevee, "gtao_distance"):
            eevee.gtao_distance = 2.0
        if hasattr(eevee, "gtao_factor"):
            eevee.gtao_factor = 1.45

    def place_kind(kind: str, loc: tuple[float, float, float], yaw: float = 0.0, scale: float = 1.0) -> None:
        before = set(bpy.context.scene.objects)
        dims = next(d for _, _, d, k in ASSETS if k == kind)
        build(kind, dims)
        for obj in set(bpy.context.scene.objects) - before:
            obj.location.x = obj.location.x * scale + loc[0]
            obj.location.y = obj.location.y * scale + loc[1]
            obj.location.z = obj.location.z * scale + loc[2]
            obj.scale.x *= scale
            obj.scale.y *= scale
            obj.scale.z *= scale
            obj.rotation_euler[2] += yaw

    cube("white_desktop", (0, -0.18, 0.02), (3.0, 1.08, 0.045), "desk_white_clean", 0.018)
    cube("subtle_front_shadow_line", (0, -0.705, 0.047), (2.86, 0.012, 0.012), "warm_white", 0.002)
    cube("white_front_apron", (0, -0.735, -0.08), (3.0, 0.035, 0.22), "desk_white_clean", 0.012)
    cube("lavender_wall", (0, 0.43, 0.72), (3.12, 0.035, 1.38), "wall_lavender", 0.0)
    cube("soft_left_wall_return", (-1.56, -0.08, 0.68), (0.035, 1.04, 1.28), "wall_lavender", 0.0)
    cube("soft_right_wall_return", (1.56, -0.08, 0.68), (0.035, 1.04, 1.28), "wall_lavender", 0.0)
    cube("thin_black_back_edge", (0, 0.065, 0.065), (3.0, 0.018, 0.035), "black", 0.001)
    cube("left_wall_wash_strip", (-1.12, 0.405, 0.75), (0.18, 0.008, 1.28), "strong_lavender_glow", 0.012)
    place_kind("synchronize_mat", (0.08, -0.265, 0.048), 0, 1.06)
    # Main display composition.
    before_monitor = set(bpy.context.scene.objects)
    add_monitor(1.48, 0.65, 0.24, "3 26 40", ultrawide=True)
    for obj in set(bpy.context.scene.objects) - before_monitor:
        obj.location.x += 0.31
        obj.location.y += 0.073
        obj.location.z += 0.0
    cyl("preview_light_bar", (0.31, -0.068, 0.675), 0.014, 0.70, "black_anodized", 32, rot=(0, math.radians(90), 0))
    cube("preview_light_bar_clip", (0.31, -0.039, 0.642), (0.1, 0.045, 0.035), "black_anodized", 0.006)
    # Product-specific tower/shelf/speaker layer.
    place_kind("offrame_riser", (-0.93, 0.005, 0.042), 0, 0.95)
    place_kind("hyte_y70_case", (-0.93, -0.024, 0.083), 0, 0.98)
    place_kind("epic5_speaker", (-0.43, -0.155, 0.055), math.radians(-2), 0.92)
    place_kind("epic5_speaker", (1.14, -0.15, 0.055), math.radians(2), 0.92)
    # Product accents.
    locs = {
        "times_gate": (-0.68, -0.045, 0.548),
        "spacecraft": (-1.12, -0.038, 0.545),
        "mars_pro": (-0.58, -0.36, 0.058),
        "portable_monitor": (0.27, -0.32, 0.064),
        "ivy_planter": (0.78, -0.27, 0.058),
        "audio_interface": (-0.16, -0.37, 0.066),
        "diecast": (-0.02, -0.265, 0.118),
        "reel_cable": (-0.44, -0.405, 0.055),
    }
    for kind, loc in locs.items():
        scale = {
            "times_gate": 0.96,
            "spacecraft": 1.02,
            "mars_pro": 0.7,
            "portable_monitor": 1.12,
            "ivy_planter": 0.88,
            "audio_interface": 1.2,
            "diecast": 0.95,
            "reel_cable": 0.82,
        }.get(kind, 1.0)
        place_kind(kind, loc, 0, scale)

    # Front work surface details from the reference still: split keyboard,
    # black gaming mouse, and the printed desk mat composition.
    place_kind("am_hatsu_keyboard", (0.04, -0.405, 0.058), 0, 1.08)
    place_kind("cobra_mouse", (0.59, -0.405, 0.058), math.radians(6), 0.98)
    place_kind("power_cube", (-1.17, -0.42, 0.054), 0, 0.86)

    bpy.ops.object.light_add(type="AREA", location=(0, -0.95, 1.08))
    light = bpy.context.object
    light.name = "large_softbox_reflection"
    light.data.energy = 128
    light.data.size = 2.35
    bpy.ops.object.light_add(type="AREA", location=(0, -0.8, 0.35))
    fill = bpy.context.object
    fill.name = "desk_front_fill"
    fill.data.energy = 12
    fill.data.size = 2.2
    bpy.ops.object.light_add(type="POINT", location=(-0.55, 0.22, 0.75))
    accent = bpy.context.object
    accent.name = "lavender_pc_wall_bounce"
    accent.data.energy = 260
    accent.data.color = (0.62, 0.56, 1.0)
    bpy.ops.object.light_add(type="POINT", location=(0.58, 0.16, 0.62))
    right_accent = bpy.context.object
    right_accent.name = "lavender_monitor_right_bounce"
    right_accent.data.energy = 82
    right_accent.data.color = (0.58, 0.52, 1.0)
    bpy.ops.object.camera_add(location=(-0.035, -1.64, 0.62))
    camera = bpy.context.object
    look_at(camera, (-0.02, -0.08, 0.39))
    bpy.context.scene.camera = camera
    camera.data.lens = 20.8
    bpy.context.scene.render.resolution_x = 2048
    bpy.context.scene.render.resolution_y = 1152
    bpy.context.scene.eevee.taa_render_samples = 64
    bpy.context.scene.view_settings.view_transform = "Filmic"
    bpy.context.scene.view_settings.look = "Medium High Contrast"
    bpy.context.scene.view_settings.exposure = -1.05
    bpy.context.scene.view_settings.gamma = 1.0
    bpy.ops.render.render(write_still=True)
    bpy.data.images["Render Result"].save_render(str(PREVIEW_ROOT / "so-ong-space-reference-preview.png"))
    FIDELITY_REPORT_PATH.write_text(
        json.dumps(
            {
                "scene": "so-ong-space-2026-05-desk-setup",
                "target": "Reference-still visible-crop prototype render with product-specific hero silhouettes, lavender wall wash, white desktop, and only the products visible in the supplied crop placed in the scene.",
                "legalBoundary": "private/prototype only; not release eligible without licensed CAD/material references.",
                "assetCount": len(FIDELITY_REPORTS),
                "heroAssetCount": sum(1 for report in FIDELITY_REPORTS if report["requiredSignatureFragments"]),
                "minimumHeroSignatureScore": min(
                    report["signatureScore"]
                    for report in FIDELITY_REPORTS
                    if report["signatureScore"] is not None
                ),
                "assets": FIDELITY_REPORTS,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )


def main() -> None:
    for asset in ASSETS_TO_GENERATE:
        export_asset(*asset)
    convert_thumbnails_to_webp()
    build_preview()
    print(f"Generated {len(ASSETS_TO_GENERATE)} visible-crop So Ong prototype assets and preview.")


if __name__ == "__main__":
    main()
