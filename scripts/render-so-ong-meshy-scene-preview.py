#!/usr/bin/env python3
"""Render the So Ong reference scene using the current catalog GLBs.

This is intentionally separate from `generate-so-ong-video-assets.py`: that
script authors procedural prototype assets, while this one validates that the
current GLB files in `apps/web/public/assets/models` can be placed in the same
reference composition.
"""

from __future__ import annotations

import math
import shutil
from pathlib import Path

import bpy
from mathutils import Vector


REPO_ROOT = Path(__file__).resolve().parents[1]
MODELS_ROOT = REPO_ROOT / "apps/web/public/assets/models"
PREVIEW_ROOT = REPO_ROOT / "assets/references/video-scenes/so-ong-space-2026-05-desk-setup"
OUTPUT_PATH = PREVIEW_ROOT / "so-ong-space-meshy-preview.png"
COLOR_QA_OUTPUT_PATH = PREVIEW_ROOT / "so-ong-space-meshy-preview-color-v2.png"


SCENE_OBJECTS = [
    ("p2s_video_so_ong_zionworks_synchronize_mat", (0.08, -0.265, 0.048), 0.0, 1.06),
    ("p2s_video_so_ong_tfg40q14wp_monitor", (0.31, 0.073, 0.058), 0.0, 1.0),
    ("p2s_video_so_ong_offrame_dual_monitor_riser", (-0.93, 0.005, 0.048), 0.0, 0.95),
    ("p2s_video_so_ong_hyte_y70_snow_white", (-0.93, -0.024, 0.083), 0.0, 0.98),
    ("p2s_video_so_ong_reproducer_epic5", (-0.43, -0.155, 0.055), math.radians(-2), 0.92),
    ("p2s_video_so_ong_reproducer_epic5", (1.14, -0.15, 0.055), math.radians(2), 0.92),
    ("p2s_video_so_ong_divoom_times_gate", (-0.68, -0.045, 0.548), 0.0, 0.96),
    ("p2s_video_so_ong_sml_spacecraft", (-1.12, -0.038, 0.545), 0.0, 1.02),
    ("p2s_video_so_ong_gravastar_mars_pro", (-0.58, -0.36, 0.058), math.radians(-12), 0.7),
    ("p2s_video_so_ong_cpm1610iq_portable_monitor", (0.27, -0.32, 0.064), math.radians(-4), 1.12),
    ("p2s_video_so_ong_empathist_stand", (0.27, -0.282, 0.048), math.radians(-4), 1.0),
    ("p2s_video_so_ong_ivy_planter", (0.78, -0.27, 0.058), 0.0, 0.88),
    ("p2s_video_so_ong_arturia_minifuse2", (-0.16, -0.37, 0.066), 0.0, 1.2),
    ("p2s_video_so_ong_diecast_car", (-0.02, -0.265, 0.118), math.radians(-5), 0.95),
    ("p2s_video_so_ong_charging_reel_cable", (-0.44, -0.405, 0.055), 0.0, 0.82),
    ("p2s_video_so_ong_angry_miao_am_hatsu", (0.04, -0.405, 0.058), 0.0, 1.08),
    ("p2s_video_so_ong_razer_cobra_pro_white", (0.59, -0.405, 0.058), math.radians(6), 0.98),
    ("p2s_video_so_ong_square1_power_cube", (-1.17, -0.42, 0.054), 0.0, 0.86),
]


def reset_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    bpy.context.scene.unit_settings.system = "METRIC"
    bpy.context.scene.render.engine = "BLENDER_EEVEE_NEXT"


def make_material(name: str, color: tuple[float, float, float, float], roughness: float = 0.6) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = color
        bsdf.inputs["Roughness"].default_value = roughness
    return material


def cube(name: str, loc: tuple[float, float, float], scale: tuple[float, float, float], mat: bpy.types.Material) -> None:
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(mat)


def world_bounds(objects: list[bpy.types.Object]) -> tuple[Vector, Vector]:
    points: list[Vector] = []
    for obj in objects:
        for corner in obj.bound_box:
            points.append(obj.matrix_world @ Vector(corner))
    return (
        Vector((min(point.x for point in points), min(point.y for point in points), min(point.z for point in points))),
        Vector((max(point.x for point in points), max(point.y for point in points), max(point.z for point in points))),
    )


def import_asset(asset_id: str, loc: tuple[float, float, float], yaw: float, scale: float) -> None:
    path = MODELS_ROOT / asset_id / f"{asset_id}.glb"
    if not path.exists():
        raise FileNotFoundError(path)
    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    imported = [obj for obj in set(bpy.context.scene.objects) - before if obj.type == "MESH"]
    if not imported:
        return
    min_v, max_v = world_bounds(imported)
    center = (min_v + max_v) * 0.5
    offset = Vector((loc[0] - center.x, loc[1] - center.y, loc[2] - min_v.z))
    for obj in imported:
        obj.location += offset
        obj.rotation_euler[2] += yaw
        obj.scale.x *= scale
        obj.scale.y *= scale
        obj.scale.z *= scale


def look_at(obj: bpy.types.Object, target: tuple[float, float, float]) -> None:
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def main() -> None:
    reset_scene()
    PREVIEW_ROOT.mkdir(parents=True, exist_ok=True)
    bpy.context.scene.world.color = (0.38, 0.35, 0.62)

    desk = make_material("desk_white_clean", (0.96, 0.95, 0.92, 1), 0.48)
    wall = make_material("wall_lavender", (0.78, 0.76, 0.96, 1), 0.72)
    black = make_material("thin_black_back_edge", (0.02, 0.02, 0.025, 1), 0.55)
    glow = make_material("lavender_glow_panel", (0.62, 0.56, 1.0, 1), 0.35)
    cube("white_desktop", (0, -0.18, 0.02), (3.0, 1.08, 0.045), desk)
    cube("white_front_apron", (0, -0.735, -0.08), (3.0, 0.035, 0.22), desk)
    cube("lavender_wall", (0, 0.43, 0.72), (3.12, 0.035, 1.38), wall)
    cube("soft_left_wall_return", (-1.56, -0.08, 0.68), (0.035, 1.04, 1.28), wall)
    cube("soft_right_wall_return", (1.56, -0.08, 0.68), (0.035, 1.04, 1.28), wall)
    cube("thin_black_back_edge", (0, 0.065, 0.065), (3.0, 0.018, 0.035), black)
    cube("left_wall_wash_strip", (-1.12, 0.405, 0.75), (0.18, 0.008, 1.28), glow)

    for asset_id, loc, yaw, scale in SCENE_OBJECTS:
        import_asset(asset_id, loc, yaw, scale)

    # Reference still's monitor light bar, kept procedural because it is not a
    # listed product in the current visible-product generation contract.
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=0.014, depth=0.70, location=(0.31, -0.068, 0.675), rotation=(0, math.radians(90), 0))
    bar = bpy.context.object
    bar.name = "preview_light_bar"
    bar.data.materials.append(black)
    cube("preview_light_bar_clip", (0.31, -0.039, 0.642), (0.1, 0.045, 0.035), black)

    bpy.ops.object.light_add(type="AREA", location=(0, -0.95, 1.08))
    key = bpy.context.object
    key.name = "large_softbox_reflection"
    key.data.energy = 128
    key.data.size = 2.35
    bpy.ops.object.light_add(type="POINT", location=(-0.55, 0.22, 0.75))
    accent = bpy.context.object
    accent.name = "lavender_pc_wall_bounce"
    accent.data.energy = 260
    accent.data.color = (0.62, 0.56, 1.0)
    bpy.ops.object.light_add(type="POINT", location=(0.58, 0.16, 0.62))
    right = bpy.context.object
    right.name = "lavender_monitor_right_bounce"
    right.data.energy = 82
    right.data.color = (0.58, 0.52, 1.0)

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
    bpy.context.scene.render.filepath = str(OUTPUT_PATH)
    bpy.ops.render.render(write_still=True)
    shutil.copyfile(OUTPUT_PATH, COLOR_QA_OUTPUT_PATH)


if __name__ == "__main__":
    main()
