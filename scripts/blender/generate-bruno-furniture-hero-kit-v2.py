#!/usr/bin/env python3
"""Generate the V2 commercial-pass candidate for the Bruno-inspired furniture kit.

This intentionally builds on the existing project-authored furniture kit instead
of replacing it with a static marketplace model. The pass adds furniture-level
micro construction details across the desk, shelf, media console, lounge, rug,
sofa, and coffee table, then exports a versioned GLB that can be reviewed and
loaded independently from the V1 runtime asset.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import math
import shutil
import sys
from pathlib import Path

import bpy
from mathutils import Vector


ASSET_KEY = "p2s_bruno_furniture_hero_kit_v2"
ASSET_SLUG = "p2s-bruno-furniture-hero-kit-v2"
REVIEW_DATE = "2026-05-20"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-root", required=True)
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else sys.argv[1:]
    return parser.parse_args(argv)


def load_v1_generator(repo_root: Path):
    script_path = repo_root / "scripts/blender/generate-bruno-furniture-hero-kit.py"
    spec = importlib.util.spec_from_file_location("bruno_furniture_hero_v1", script_path)
    if not spec or not spec.loader:
        raise RuntimeError(f"Unable to load base furniture generator at {script_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def material(name: str, fallback_color: tuple[float, float, float, float], roughness: float, base, metallic: float = 0.0):
    existing = bpy.data.materials.get(name)
    if existing:
        return existing
    return base.mat(name, fallback_color, roughness, metallic)


def make_detail_materials(base) -> dict[str, bpy.types.Material]:
    return {
        "wood": material("hero_uv_oiled_walnut_pbr_1k", (0.56, 0.32, 0.18, 1), 0.76, base, 0.02),
        "fabric": material("hero_uv_bluegrey_fabric_pbr_1k", (0.18, 0.25, 0.36, 1), 0.92, base),
        "cream": material("hero_uv_warm_lacquer_pbr_512", (0.86, 0.82, 0.79, 1), 0.62, base, 0.03),
        "speaker": material("hero_uv_speaker_grille_pbr_512", (0.06, 0.07, 0.08, 1), 0.72, base, 0.04),
        "dark": material("hero_soft_black_plastic", (0.055, 0.066, 0.08, 1), 0.56, base, 0.18),
        "dark_fabric": material("hero_deep_navy_fabric", (0.08, 0.115, 0.17, 1), 0.92, base),
        "metal": material("hero_satin_black_metal", (0.08, 0.085, 0.09, 1), 0.48, base, 0.42),
        "glass": material("hero_smoky_screen_glass", (0.05, 0.045, 0.065, 1), 0.24, base, 0.08),
        "paper": material("hero_warm_paper_stack", (0.86, 0.79, 0.68, 1), 0.9, base),
        "blue": material("hero_rgb_cool_blue", (0.55, 0.86, 1.0, 1), 0.38, base),
        "pink": material("hero_rgb_soft_pink", (1.0, 0.42, 0.62, 1), 0.38, base),
        "amber": material("hero_book_amber", (0.9, 0.55, 0.3, 1), 0.72, base),
        "mint": material("hero_book_mint", (0.38, 0.68, 0.48, 1), 0.72, base),
        "lavender": material("hero_book_lavender", (0.4, 0.38, 0.72, 1), 0.72, base),
        "shadow": material("hero_v2_contact_shadow_ink", (0.025, 0.028, 0.034, 1), 0.7, base, 0.08),
        "edge": material("hero_v2_worn_edge_highlight", (0.82, 0.57, 0.34, 1), 0.66, base, 0.02),
        "thread": material("hero_v2_raised_thread", (0.26, 0.36, 0.48, 1), 0.96, base),
        "brass": material("hero_v2_warm_brass_fastener", (0.82, 0.62, 0.36, 1), 0.42, base, 0.58),
        "rubber": material("hero_v2_soft_rubber_foot", (0.03, 0.035, 0.04, 1), 0.68, base, 0.05),
        "tag": material("hero_v2_small_canvas_tag", (0.88, 0.78, 0.62, 1), 0.9, base),
        "green": material("hero_leaf_satin_green", (0.25, 0.55, 0.34, 1), 0.82, base),
    }


def curve_path(base, name: str, points: list[tuple[float, float, float]], mat: bpy.types.Material, bevel_depth: float = 0.006) -> bpy.types.Object:
    curve = bpy.data.curves.new(name=f"{name}_curve", type="CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 3
    curve.bevel_depth = bevel_depth
    curve.bevel_resolution = 2
    polyline = curve.splines.new(type="POLY")
    polyline.points.add(len(points) - 1)
    for point, loc in zip(polyline.points, points):
        x, y, z = base.to_blender_loc(loc)
        point.co = (x, y, z, 1.0)
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(mat)
    obj["deskterior_v2_detail"] = True
    return obj


def add_desk_commercial_pass(base, mats: dict[str, bpy.types.Material]) -> None:
    cube = base.cube
    rounded = base.rounded_rect_slab
    cylinder_y = base.cylinder_y
    sphere = base.sphere
    vertical_cylinder = base.vertical_cylinder
    wood = mats["wood"]
    dark = mats["dark"]
    shadow = mats["shadow"]
    metal = mats["metal"]
    paper = mats["paper"]
    thread = mats["thread"]
    brass = mats["brass"]
    rubber = mats["rubber"]

    for z, name in [(-1.325, "back"), (-0.395, "front")]:
        rounded(f"hero_v2_desk_{name}_solid_wood_edge_band", (2.9, 0.032, 0.036), (-0.72, 0.868, z), wood, 0, 0.018, 5, "table")
        cube(f"hero_v2_desk_{name}_underlip_shadow", (2.74, 0.018, 0.018), (-0.72, 0.812, z + (0.035 if name == "front" else -0.035)), shadow, 0, 0)
    for x, name in [(-2.19, "left"), (0.75, "right")]:
        rounded(f"hero_v2_desk_{name}_end_grain_band", (0.034, 0.032, 0.82), (x, 0.867, -0.86), wood, 0, 0.016, 5, "table")
    for x in [-1.94, 0.5]:
        for z in [-1.2, -0.52]:
            sphere(f"hero_v2_desk_leg_adjuster_glide_{x}_{z}", (x, 0.036, z), (0.048, 0.012, 0.048), rubber, (0, 0, 0), 16)
            sphere(f"hero_v2_desk_leg_socket_screw_{x}_{z}", (x, 0.82, z), (0.014, 0.006, 0.014), brass, (0, 0, 0), 10)
    for x in [-1.26, -0.82, -0.38, 0.06, 0.46]:
        cube(f"hero_v2_desk_felt_mat_raised_stitch_x_{x}", (0.006, 0.006, 0.38), (x, 0.897, -0.76), thread, 0, 0.001)
    for z in [-0.99, -0.78, -0.55]:
        cube(f"hero_v2_desk_felt_mat_cross_stitch_z_{z}", (1.26, 0.006, 0.006), (-0.92, 0.9, z), mats["dark_fabric"], 0, 0.001)
    rounded("hero_v2_desk_left_drawer_recessed_shadow_cavity", (0.52, 0.42, 0.028), (-1.76, 0.47, -0.286), shadow, 0, 0.012, 4, "table")
    for y in [0.31, 0.47, 0.63]:
        cylinder_y(f"hero_v2_desk_drawer_pull_endcap_left_{y}", 0.012, 0.012, (-1.96, y + 0.008, -0.348), metal, 12, 0)
        cylinder_y(f"hero_v2_desk_drawer_pull_endcap_right_{y}", 0.012, 0.012, (-1.56, y + 0.008, -0.348), metal, 12, 0)
    curve_path(
        base,
        "hero_v2_desk_visible_cable_arc_to_raceway",
        [(-0.19, 0.9, -1.19), (-0.16, 0.78, -1.25), (0.1, 0.69, -1.28), (0.34, 0.54, -1.09)],
        dark,
        0.009,
    )
    for x in [-1.72, -1.61]:
        rounded(f"hero_v2_desk_notebook_page_stack_{x}", (0.24, 0.012, 0.19), (x, 0.934, -1.05), paper, -0.08, 0.008, 4, "table")
    for x, z in [(-0.48, -0.61), (-0.35, -0.61), (-0.22, -0.61), (-0.09, -0.61), (0.04, -0.61)]:
        vertical_cylinder(f"hero_v2_desk_keyboard_keycap_column_{x}_{z}", 0.018, 0.012, (x, 0.914, z), mats["cream"], 10, 0, 0.016)


def add_shelf_commercial_pass(base, mats: dict[str, bpy.types.Material]) -> None:
    cube = base.cube
    rounded = base.rounded_rect_slab
    sphere = base.sphere
    cylinder_y = base.cylinder_y
    wood = mats["wood"]
    dark = mats["dark"]
    shadow = mats["shadow"]
    paper = mats["paper"]
    brass = mats["brass"]
    green = mats["green"]
    sx, sy, sz = -2.75, 0.72, -1.52

    for y in [sy + 0.0, sy + 0.54, sy + 1.08, sy + 1.62]:
        cube(f"hero_v2_shelf_rear_shadow_backstop_{y}", (1.24, 0.028, 0.022), (sx, y + 0.045, sz - 0.215), shadow, 0, 0)
        for x in [sx - 0.51, sx + 0.51]:
            cylinder_y(f"hero_v2_shelf_visible_pin_{x}_{y}", 0.012, 0.012, (x, y + 0.02, sz + 0.22), brass, 10, 0)
    for index, x in enumerate([-0.52, -0.39, -0.26, -0.13, 0.0, 0.14, 0.29, 0.43]):
        h = 0.24 + (index % 4) * 0.05
        rounded(
            f"hero_v2_shelf_offset_book_spine_{index}",
            (0.068, h, 0.2),
            (sx + x, sy + 1.02 + h * 0.38, sz + 0.12),
            [mats["amber"], mats["mint"], mats["lavender"], mats["blue"]][index % 4],
            0.04 * ((index % 3) - 1),
            0.008,
            3,
            "table",
        )
        cube(f"hero_v2_shelf_book_page_line_{index}", (0.048, 0.006, 0.014), (sx + x, sy + 1.02 + h * 0.66, sz + 0.224), paper, 0, 0)
    for x in [sx - 0.14, sx + 0.2]:
        cube(f"hero_v2_shelf_cabinet_soft_hinge_{x}", (0.018, 0.14, 0.014), (x, sy + 0.78, sz + 0.225), brass, 0, 0.002)
    for x in [-0.48, -0.38, -0.28, -0.18]:
        cube(f"hero_v2_shelf_woven_box_horizontal_thread_top_{x}", (0.11, 0.01, 0.01), (sx + x, sy + 0.43, sz + 0.19), dark, 0, 0)
        cube(f"hero_v2_shelf_woven_box_horizontal_thread_bottom_{x}", (0.11, 0.01, 0.01), (sx + x, sy + 0.32, sz + 0.19), dark, 0, 0)
    for i in range(8):
        angle = (i / 8.0) * math.pi * 2
        curve_path(
            base,
            f"hero_v2_shelf_leaf_midrib_{i}",
            [
                (sx - 0.45, sy + 1.67 + (i % 3) * 0.035, sz + 0.08),
                (sx - 0.45 + math.cos(angle) * 0.12, sy + 1.685 + (i % 3) * 0.035, sz + 0.08 + math.sin(angle) * 0.075),
            ],
            green,
            0.0035,
        )
    sphere("hero_v2_shelf_camera_lens_glass_highlight", (sx + 0.43, sy + 0.18, sz + 0.258), (0.022, 0.006, 0.022), mats["glass"], (0, 0, 0), 12)


def add_media_console_commercial_pass(base, mats: dict[str, bpy.types.Material]) -> None:
    cube = base.cube
    rounded = base.rounded_rect_slab
    sphere = base.sphere
    cylinder_y = base.cylinder_y
    cx, cy, cz = 1.92, 0.45, -1.72
    dark = mats["dark"]
    shadow = mats["shadow"]
    wood = mats["wood"]
    metal = mats["metal"]
    brass = mats["brass"]
    speaker = mats["speaker"]

    rounded("hero_v2_media_console_shadowed_inner_shelf", (1.22, 0.055, 0.24), (cx + 0.04, cy + 0.32, cz + 0.05), shadow, 0, 0.028, 5, "table")
    for index, x in enumerate([-0.58, -0.48, -0.38, -0.28, -0.18, -0.08, 0.02, 0.12, 0.22, 0.32, 0.42, 0.52]):
        cube(f"hero_v2_media_slat_inner_occlusion_{index}", (0.014, 0.12, 0.014), (cx + x, cy + 0.188, cz + 0.221), shadow, 0, 0)
        cube(f"hero_v2_media_slat_edge_highlight_{index}", (0.008, 0.10, 0.011), (cx + x + 0.014, cy + 0.189, cz + 0.236), wood, 0, 0)
    for x in [cx - 0.58, cx + 0.54]:
        rounded(f"hero_v2_media_recessed_cable_port_{x}", (0.16, 0.04, 0.02), (x, cy + 0.39, cz - 0.198), dark, 0, 0.01, 4, "table")
    for x in [-0.69, 0.7]:
        for y in [cy + 0.31, cy + 0.43]:
            for i in range(5):
                cube(f"hero_v2_media_speaker_grille_thread_{x}_{y}_{i}", (0.13, 0.004, 0.006), (cx + x, y + (i - 2) * 0.012, cz + 0.286), speaker, 0, 0)
    sphere("hero_v2_media_console_tiny_power_led", (cx - 0.55, cy + 0.39, cz + 0.192), (0.014, 0.006, 0.014), mats["blue"], (0, 0, 0), 12)
    for x in [cx - 0.66, cx + 0.66]:
        sphere(f"hero_v2_media_leg_leveler_front_{x}", (x, cy - 0.3, cz + 0.12), (0.03, 0.01, 0.03), metal, (0, 0, 0), 12)
        sphere(f"hero_v2_media_leg_leveler_back_{x}", (x, cy - 0.3, cz - 0.1), (0.03, 0.01, 0.03), metal, (0, 0, 0), 12)
    for x in [cx + 0.56, cx + 0.94]:
        for z in [cz + 0.04, cz + 0.16]:
            sphere(f"hero_v2_media_planter_leaf_tip_{x}_{z}", (x, cy + 0.49, z), (0.026, 0.012, 0.026), mats["green"], (0, 0, 0), 10)
    cylinder_y("hero_v2_media_tv_stand_hinge_pin", 0.026, 0.3, (cx, cy + 0.4, cz - 0.05), brass, 18, math.pi * 0.5)


def add_lounge_commercial_pass(base, mats: dict[str, bpy.types.Material]) -> None:
    cube = base.cube
    rounded = base.rounded_rect_slab
    sphere = base.sphere
    cylinder_y = base.cylinder_y
    vertical_cylinder = base.vertical_cylinder
    dark = mats["dark"]
    shadow = mats["shadow"]
    fabric = mats["fabric"]
    dark_fabric = mats["dark_fabric"]
    thread = mats["thread"]
    tag = mats["tag"]
    brass = mats["brass"]
    wood = mats["wood"]
    metal = mats["metal"]

    for z in [0.43, 1.73]:
        cube(f"hero_v2_rug_bound_edge_{z}", (2.48, 0.012, 0.018), (-0.9, 0.105, z), thread, 0.02, 0.002)
    for x in [-2.12, -1.82, -1.52, -1.22, -0.92, -0.62, -0.32, -0.02, 0.28]:
        cube(f"hero_v2_rug_diagonal_weave_{x}", (0.008, 0.006, 1.04), (x, 0.111, 1.08), dark_fabric, 0.25, 0.001)
    for x in [-2.34, -0.78]:
        rounded(f"hero_v2_sofa_rolled_arm_outer_seam_{x}", (0.032, 0.30, 0.48), (x, 0.62, 1.18), dark, 0, 0.012, 5, "arm")
        cube(f"hero_v2_sofa_arm_lower_shadow_tuck_{x}", (0.028, 0.018, 0.5), (x, 0.34, 1.17), shadow, 0, 0.002)
    for x in [-1.99, -1.76, -1.53, -1.3, -1.07]:
        sphere(f"hero_v2_sofa_subtle_button_depression_{x}", (x, 0.607, 1.12), (0.018, 0.006, 0.018), shadow, (0, 0, 0), 12)
    cube("hero_v2_sofa_small_brand_tag", (0.09, 0.038, 0.006), (-0.91, 0.54, 0.86), tag, 0, 0.002)
    for x in [-1.84, -1.62, -1.4, -1.18]:
        cube(f"hero_v2_sofa_throw_cross_thread_{x}", (0.01, 0.007, 0.42), (x, 0.86, 1.04), thread, -0.08, 0.001)
    for z in [0.88, 1.14]:
        cube(f"hero_v2_sofa_throw_horizontal_thread_{z}", (0.72, 0.007, 0.008), (-1.46, 0.864, z), thread, -0.08, 0.001)
    for x in [-1.98, -1.2]:
        for z in [1.34, 1.43]:
            cube(f"hero_v2_sofa_pillow_fabric_edge_{x}_{z}", (0.34, 0.012, 0.01), (x, 0.885, z), dark, 0.06 if x < -1.5 else -0.08, 0.002)

    for x in [-0.18, 0.28, 0.74]:
        for z in [0.74, 1.3]:
            sphere(f"hero_v2_coffee_table_top_fastener_{x}_{z}", (x, 0.56, z), (0.012, 0.005, 0.012), brass, (0, 0, 0), 8)
    for z in [0.84, 0.99, 1.14]:
        cube(f"hero_v2_coffee_table_glass_micro_streak_{z}", (0.54, 0.004, 0.008), (0.28, 0.558, z), mats["cream"], -0.08, 0.001)
    curve_path(
        base,
        "hero_v2_coffee_table_controller_cable",
        [(0.65, 0.555, 0.88), (0.55, 0.56, 0.74), (0.33, 0.54, 0.7)],
        dark,
        0.005,
    )
    for x in [0.48, 0.76]:
        vertical_cylinder(f"hero_v2_controller_thumbstick_rubber_cap_{x}", 0.018, 0.01, (x, 0.584, 0.89), mats["rubber"], 14, 0, 0.016)
    cylinder_y("hero_v2_mug_handle_outer_curve", 0.038, 0.01, (0.628, 0.548, 1.28), mats["tag"], 18, 0)
    cube("hero_v2_coffee_table_lower_shelf_shadow_occlusion", (0.78, 0.018, 0.44), (0.28, 0.282, 1.02), shadow, -0.08, 0.006)
    for x in [-0.15, 0.71]:
        for z in [0.78, 1.26]:
            sphere(f"hero_v2_coffee_table_leg_floor_contact_{x}_{z}", (x, 0.055, z), (0.04, 0.008, 0.04), metal, (0, 0, 0), 12)


def mark_v2_objects() -> None:
    for obj in bpy.context.scene.objects:
        if obj.type not in {"MESH", "CURVE"}:
            continue
        obj["deskterior_asset_slug"] = ASSET_SLUG
        obj["deskterior_runtime_role"] = "whole_room_furniture_commercial_candidate"
        if obj.name.startswith("hero_v2_"):
            obj["deskterior_detail_pass"] = "commercial-pass-v2"


def convert_curves_to_meshes() -> None:
    for obj in list(bpy.context.scene.objects):
        if obj.type != "CURVE":
            continue
        bpy.ops.object.select_all(action="DESELECT")
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        bpy.ops.object.convert(target="MESH")
        bpy.context.object["deskterior_detail_curve_baked"] = True
        obj.select_set(False)


def mesh_and_curve_objects() -> list[bpy.types.Object]:
    return [obj for obj in bpy.context.scene.objects if obj.type in {"MESH", "CURVE"}]


def world_bounds(objects: list[bpy.types.Object]) -> tuple[Vector, Vector]:
    points: list[Vector] = []
    for obj in objects:
        for corner in obj.bound_box:
            points.append(obj.matrix_world @ Vector(corner))
    return (
        Vector((min(point.x for point in points), min(point.y for point in points), min(point.z for point in points))),
        Vector((max(point.x for point in points), max(point.y for point in points), max(point.z for point in points))),
    )


def triangle_count() -> int:
    total = 0
    depsgraph = bpy.context.evaluated_depsgraph_get()
    for obj in bpy.context.scene.objects:
        if obj.type == "MESH":
            total += sum(max(len(poly.vertices) - 2, 1) for poly in obj.data.polygons)
        elif obj.type == "CURVE":
            evaluated = obj.evaluated_get(depsgraph)
            mesh = evaluated.to_mesh()
            try:
                total += sum(max(len(poly.vertices) - 2, 1) for poly in mesh.polygons)
            finally:
                evaluated.to_mesh_clear()
    return total


def setup_camera(name: str, location: tuple[float, float, float], target: tuple[float, float, float], ortho_scale: float):
    loc = Vector(location)
    tgt = Vector(target)
    bpy.ops.object.camera_add(location=loc, rotation=(tgt - loc).to_track_quat("-Z", "Y").to_euler())
    camera = bpy.context.object
    camera.name = name
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = ortho_scale
    return camera


def setup_preview_lighting() -> None:
    bpy.ops.object.light_add(type="AREA", location=(-3.0, -3.6, 4.2))
    key = bpy.context.object
    key.name = "furniture_v2_preview_warm_key"
    key.data.energy = 520
    key.data.size = 4.8
    bpy.ops.object.light_add(type="AREA", location=(3.3, 2.5, 3.2))
    fill = bpy.context.object
    fill.name = "furniture_v2_preview_cool_fill"
    fill.data.energy = 170
    fill.data.color = (0.62, 0.75, 1.0)
    fill.data.size = 3.6


def render_preview(path: Path, camera) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    for view_transform in ["AgX", "Filmic", "Standard"]:
        try:
            bpy.context.scene.view_settings.view_transform = view_transform
            break
        except Exception:
            continue
    for look in ["AgX - Medium High Contrast", "Medium High Contrast", "AgX - High Contrast", "None"]:
        try:
            bpy.context.scene.view_settings.look = look
            break
        except Exception:
            continue
    bpy.context.scene.view_settings.exposure = -0.35
    bpy.context.scene.camera = camera
    bpy.context.scene.render.resolution_x = 1440
    bpy.context.scene.render.resolution_y = 1080
    bpy.context.scene.eevee.taa_render_samples = 96
    bpy.context.scene.render.image_settings.file_format = "PNG"
    bpy.context.scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


def copy_texture_package(
    repo_root: Path,
    asset_metadata: dict[str, object],
    runtime_dir: Path,
    public_dir: Path,
) -> tuple[dict[str, object], dict[str, object]]:
    texture_package_dir = runtime_dir / "textures"
    public_texture_dir = public_dir / "textures"
    texture_package_dir.mkdir(parents=True, exist_ok=True)
    public_texture_dir.mkdir(parents=True, exist_ok=True)
    source_public_texture_dir = repo_root / "apps/web/public/assets/models/p2s_bruno_furniture_hero_kit/textures"
    packed_orm_maps: list[dict[str, object]] = []
    public_maps: list[dict[str, object]] = []
    for entry in asset_metadata["packedOrmMaps"]:  # type: ignore[index]
        relative_source_path = Path(str(entry["path"])).relative_to(repo_root)
        runtime_png_path = runtime_dir / "textures" / relative_source_path.name
        public_png_path = public_texture_dir / relative_source_path.name
        if runtime_png_path.resolve() != (repo_root / relative_source_path).resolve():
            shutil.copy2(repo_root / relative_source_path, runtime_png_path)
        shutil.copy2(repo_root / relative_source_path, public_png_path)
        source_ktx2_path = source_public_texture_dir / f"{relative_source_path.stem}.ktx2"
        public_ktx2_path = public_texture_dir / source_ktx2_path.name
        runtime_ktx2_path = texture_package_dir / source_ktx2_path.name
        if source_ktx2_path.exists():
            shutil.copy2(source_ktx2_path, public_ktx2_path)
            shutil.copy2(source_ktx2_path, runtime_ktx2_path)
        packed_orm_maps.append({**entry, "path": str((runtime_dir / "textures" / relative_source_path.name).relative_to(repo_root))})
        public_maps.append(
            {
                "role": entry["role"],
                "sourcePath": str((runtime_dir / "textures" / relative_source_path.name).relative_to(repo_root)),
                "publicPath": f"/assets/models/{ASSET_KEY}/textures/{relative_source_path.name}",
                "ktx2Path": f"/assets/models/{ASSET_KEY}/textures/{source_ktx2_path.name}" if source_ktx2_path.exists() else None,
                "required": True,
                "exists": public_png_path.exists(),
                "ktx2Exists": public_ktx2_path.exists(),
                "resolution": entry["resolution"],
                "channels": entry["channels"],
                "colorSpace": entry["colorSpace"],
            }
        )
    ktx2_ready = all(bool(entry.get("ktx2Exists")) for entry in public_maps)
    texture_package = {
        **asset_metadata["texturePackaging"],  # type: ignore[index]
        "packageStatus": "orm-sidecar-ready-ktx2-copied" if ktx2_ready else "orm-png-sidecar-ready-ktx2-pending",
        "manifest": str((runtime_dir / f"texture-package-{REVIEW_DATE}.json").relative_to(repo_root)),
        "packedOrmMaps": packed_orm_maps,
        "ktx2Ready": ktx2_ready,
        "stillRequiresRuntimeKtx2Transcode": not ktx2_ready,
        "stillRequiresFinalUvBake": True,
        "promotionBoundary": "V2 furniture pass improves visible geometry/material coverage; final catalog promotion still requires final UV bake, LOD/collider split, and human art approval.",
    }
    runtime_manifest = runtime_dir / f"texture-package-{REVIEW_DATE}.json"
    public_manifest = public_dir / f"texture-package-{REVIEW_DATE}.json"
    runtime_manifest.write_text(
        json.dumps({"schemaVersion": "deskterior-texture-package-v1", "assetSlug": ASSET_SLUG, **texture_package}, indent=2),
        encoding="utf-8",
    )
    public_package = {
        "schemaVersion": "deskterior-runtime-texture-package-v1",
        "generatedAt": "2026-05-20T00:00:00.000Z",
        "assetKey": ASSET_KEY,
        "sourceManifestPath": str(runtime_manifest.relative_to(repo_root)),
        "packageStatus": texture_package["packageStatus"],
        "ktx2Ready": ktx2_ready,
        "ktx2TranscodeAttempted": False,
        "toktxAvailable": shutil.which("toktx") is not None,
        "basisuAvailable": shutil.which("basisu") is not None,
        "stillRequiresRuntimeKtx2Transcode": not ktx2_ready,
        "stillRequiresFinalUvBake": True,
        "channels": {"r": "ambientOcclusion", "g": "roughness", "b": "metallic", "a": "constantOne"},
        "maps": public_maps,
        "promotionBoundary": "Commercial-pass candidate package. KTX2 sidecars are copied when available; final UV bake and catalog approval still required.",
    }
    public_manifest.write_text(json.dumps(public_package, indent=2), encoding="utf-8")
    return texture_package, public_package


def export_glb(base, path: Path) -> None:
    base.export_glb(path)


def main() -> int:
    args = parse_args()
    repo_root = Path(args.repo_root).resolve()
    base = load_v1_generator(repo_root)
    runtime_dir = repo_root / "assets/runtime-candidates/blender-authored/bruno-furniture-hero-kit-v2"
    public_dir = repo_root / f"apps/web/public/assets/models/{ASSET_KEY}"
    reference_dir = repo_root / "assets/references/blender-authored/bruno-furniture-hero-kit-v2"
    blend_path = repo_root / f"assets/blender/deskterior/{ASSET_KEY}.blend"
    for path in [runtime_dir, public_dir, reference_dir, blend_path.parent]:
        path.mkdir(parents=True, exist_ok=True)

    base.clear_scene()
    texture_package_dir = runtime_dir / "textures"
    asset_metadata = base.build_asset(texture_package_dir)
    mats = make_detail_materials(base)
    add_desk_commercial_pass(base, mats)
    add_shelf_commercial_pass(base, mats)
    add_media_console_commercial_pass(base, mats)
    add_lounge_commercial_pass(base, mats)
    mark_v2_objects()
    convert_curves_to_meshes()
    base.apply_modifiers()
    setup_preview_lighting()

    runtime_glb = runtime_dir / f"{ASSET_KEY}.glb"
    public_glb = public_dir / f"{ASSET_KEY}.glb"
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
    export_glb(base, runtime_glb)
    shutil.copy2(runtime_glb, public_glb)

    preview_overall = reference_dir / "furniture-v2-overall.png"
    preview_desk_shelf = reference_dir / "furniture-v2-desk-shelf-closeup.png"
    preview_lounge_media = reference_dir / "furniture-v2-lounge-media-closeup.png"
    render_preview(preview_overall, setup_camera("furniture_v2_camera_overall", (3.2, -5.1, 3.25), (-0.4, -0.45, 0.9), 4.9))
    render_preview(preview_desk_shelf, setup_camera("furniture_v2_camera_desk_shelf", (-2.7, -3.8, 2.55), (-1.35, 0.45, 0.85), 2.75))
    render_preview(preview_lounge_media, setup_camera("furniture_v2_camera_lounge_media", (3.5, -3.1, 2.35), (0.3, -1.0, 0.75), 3.2))

    texture_package, public_texture_package = copy_texture_package(repo_root, asset_metadata, runtime_dir, public_dir)
    objects = mesh_and_curve_objects()
    min_v, max_v = world_bounds(objects)
    dimensions = max_v - min_v
    v2_detail_count = sum(1 for obj in objects if obj.name.startswith("hero_v2_"))
    unmaterialed = [
        obj.name
        for obj in objects
        if hasattr(obj.data, "materials") and len(obj.data.materials) == 0
    ]
    missing_external_images = [
        image.filepath
        for image in bpy.data.images
        if image.filepath and not image.packed_file and not Path(bpy.path.abspath(image.filepath)).exists()
    ]
    report = {
        "schemaVersion": "deskterior-blender-authored-asset-review-v2",
        "asset": {
            "slug": ASSET_SLUG,
            "assetKey": ASSET_KEY,
            "intent": "whole-room large furniture commercial-pass candidate for the Bruno-inspired room QA scene",
            "source": "Blender procedural authoring by Codex layered over the project-owned V1 furniture generator; no Bruno Simon or paid asset copied",
            "license": "project-owned prototype asset pending commercial catalog approval",
            "currentGrade": "commercial-pass review candidate, not final approved catalog asset",
            "promotionBoundary": [
                "geometry and visible detail are improved across all large room furniture groups",
                "final commercial claim still requires human art direction approval, split object catalog metadata, collider/LOD package, and final UV/light bake",
            ],
        },
        "outputs": {
            "blend": str(blend_path.relative_to(repo_root)),
            "runtimeGlb": str(runtime_glb.relative_to(repo_root)),
            "publicGlb": str(public_glb.relative_to(repo_root)),
            "texturePackageManifest": str((runtime_dir / f"texture-package-{REVIEW_DATE}.json").relative_to(repo_root)),
            "publicTexturePackageManifest": str((public_dir / f"texture-package-{REVIEW_DATE}.json").relative_to(repo_root)),
            "previews": {
                "overall": str(preview_overall.relative_to(repo_root)),
                "deskShelf": str(preview_desk_shelf.relative_to(repo_root)),
                "loungeMedia": str(preview_lounge_media.relative_to(repo_root)),
            },
        },
        "metrics": {
            "dimensionsM": [round(dimensions.x, 4), round(dimensions.y, 4), round(dimensions.z, 4)],
            "objectCount": len(objects),
            "meshObjectCount": len([obj for obj in objects if obj.type == "MESH"]),
            "curveObjectCount": len([obj for obj in objects if obj.type == "CURVE"]),
            "materialCount": len(bpy.data.materials),
            "textureCount": len(bpy.data.images),
            "triangleCount": triangle_count(),
            "triangleBudget": 120000,
            "triangleBudgetStatus": "pass" if triangle_count() <= 120000 else "review-needed",
            "v2DetailObjectCount": v2_detail_count,
            "runtimeBytes": runtime_glb.stat().st_size,
            "publicBytes": public_glb.stat().st_size,
            "unmaterialedObjectCount": len(unmaterialed),
            "missingExternalImageCount": len(missing_external_images),
        },
        "texturePackagingPass": {
            "runtime": texture_package,
            "public": public_texture_package,
        },
        "commercialPassCoverage": {
            "desk": [
                "solid wood edge bands and underlip shadow seams",
                "drawer cavity, endcaps, leg sockets, levelers, cable arc, felt mat stitching, keyboard caps",
            ],
            "shelf": [
                "rear backstops, shelf pins, offset book spines, page lines, cabinet hinges, woven basket crosshatch, leaf midribs",
            ],
            "mediaConsole": [
                "shadowed inner shelf, slat occlusion/highlights, cable ports, speaker grille threads, levelers, TV hinge pin",
            ],
            "lounge": [
                "bound rug edges and diagonal weave",
                "visible sofa seams, tag, button depressions, throw threads, pillow edging",
                "coffee table fasteners, glass streaks, cable, controller caps, lower shelf occlusion",
            ],
        },
        "comparisonReview": {
            "commercialBenchmarkRubric": [
                {
                    "gate": "foreground furniture silhouette",
                    "candidateStatus": "pass-candidate",
                    "evidence": "all major furniture groups now include rounded authored geometry plus secondary construction details, not only large cuboids",
                    "remainingGap": "still not hand-sculpted/retopologized individual SKU models",
                },
                {
                    "gate": "material response",
                    "candidateStatus": "partial-pass",
                    "evidence": "V1 PBR helper maps are retained, KTX2 sidecars are copied when present, and V2 adds localized material-specific details",
                    "remainingGap": "final UV bake and high-poly derived normals are still missing",
                },
                {
                    "gate": "runtime visibility",
                    "candidateStatus": "requires-integration-check",
                    "evidence": "versioned public GLB and manifest are emitted",
                    "remainingGap": "QA route must be pointed to V2 and sofa hiding logic must not mask reviewed furniture detail",
                },
                {
                    "gate": "catalog readiness",
                    "candidateStatus": "fail-for-final-commercial",
                    "evidence": "asset provenance, metrics, preview renders, and texture package manifests are emitted",
                    "remainingGap": "needs object split, colliders, LODs, meshopt, final bake, and human art approval",
                },
            ],
        },
        "knownGapsBeforeCommercialPromotion": [
            "not a purchased/photogrammetry commercial furniture pack",
            "not split into individually selectable furniture catalog SKUs",
            "final UV/light bake and meshopt/LOD/collider package are still pending",
            "visual review must compare the rendered candidate against the QA scene after integration",
        ],
        "reopenAuditSeed": {
            "unmaterialedObjects": unmaterialed[:20],
            "missingExternalImages": missing_external_images[:20],
        },
    }
    review_path = reference_dir / f"asset-review-{REVIEW_DATE}.json"
    review_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
