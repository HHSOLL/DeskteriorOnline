#!/usr/bin/env python3
"""Generate the V3 furniture art-pass candidate for the Bruno-inspired room.

V3 keeps the V2 authored coverage but fixes the biggest art-direction problem:
over-readable grid/stitch marks that made the furniture feel schematic instead
of like a polished stylized room asset. This pass suppresses those noisy marks
and adds quieter construction detail across every large furniture group.
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


ASSET_KEY = "p2s_bruno_furniture_hero_kit_v3"
ASSET_SLUG = "p2s-bruno-furniture-hero-kit-v3"
REVIEW_DATE = "2026-05-20"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-root", required=True)
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else sys.argv[1:]
    return parser.parse_args(argv)


def load_v2_generator(repo_root: Path):
    script_path = repo_root / "scripts/blender/generate-bruno-furniture-hero-kit-v2.py"
    spec = importlib.util.spec_from_file_location("bruno_furniture_hero_v2", script_path)
    if not spec or not spec.loader:
        raise RuntimeError(f"Unable to load V2 furniture generator at {script_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.ASSET_KEY = ASSET_KEY
    module.ASSET_SLUG = ASSET_SLUG
    module.REVIEW_DATE = REVIEW_DATE
    return module


def muted_material(name: str, color: tuple[float, float, float, float], roughness: float, base, metallic: float = 0.0):
    existing = bpy.data.materials.get(name)
    if existing:
        return existing
    return base.mat(name, color, roughness, metallic)


def make_v3_materials(base) -> dict[str, bpy.types.Material]:
    return {
        "shadow": muted_material("hero_v3_soft_contact_shadow", (0.018, 0.021, 0.026, 1), 0.78, base, 0.04),
        "edge": muted_material("hero_v3_subtle_worn_wood_edge", (0.62, 0.39, 0.22, 1), 0.76, base, 0.02),
        "dark": muted_material("hero_v3_near_black_hardware", (0.032, 0.038, 0.045, 1), 0.58, base, 0.28),
        "fabricLine": muted_material("hero_v3_embossed_fabric_line", (0.075, 0.105, 0.155, 1), 0.96, base, 0.0),
        "fabricLift": muted_material("hero_v3_soft_fabric_highlight", (0.22, 0.31, 0.42, 1), 0.94, base, 0.0),
        "brass": muted_material("hero_v3_dulled_brass_detail", (0.68, 0.52, 0.31, 1), 0.52, base, 0.42),
        "glass": muted_material("hero_v3_smoked_glass_edge", (0.05, 0.06, 0.075, 1), 0.2, base, 0.05),
        "rubber": muted_material("hero_v3_matte_rubber", (0.02, 0.024, 0.028, 1), 0.72, base, 0.02),
        "paper": muted_material("hero_v3_warm_paper_edges", (0.82, 0.76, 0.66, 1), 0.9, base, 0.0),
        "greenDark": muted_material("hero_v3_leaf_shadow_green", (0.14, 0.34, 0.2, 1), 0.86, base, 0.0),
        "screen": muted_material("hero_v3_dead_screen_glass", (0.025, 0.03, 0.04, 1), 0.34, base, 0.08),
    }


def hide_noisy_v2_marks() -> list[str]:
    noisy_fragments = (
        "felt_mat_raised_stitch",
        "felt_mat_cross_stitch",
        "rug_diagonal_weave",
        "rug_bound_edge",
        "sofa_throw_cross_thread",
        "sofa_throw_horizontal_thread",
    )
    hidden: list[str] = []
    for obj in bpy.context.scene.objects:
        if any(fragment in obj.name for fragment in noisy_fragments):
            obj.hide_render = True
            obj.hide_viewport = True
            obj["deskterior_v3_suppressed_noisy_mark"] = True
            hidden.append(obj.name)
    return hidden


def add_panel_gap(base, name: str, size: tuple[float, float, float], loc: tuple[float, float, float], mat, rot: float = 0.0):
    base.cube(name, size, loc, mat, rot, 0.001)


def add_v3_desk_pass(base, mats: dict[str, bpy.types.Material], v2_mats: dict[str, bpy.types.Material]) -> None:
    rounded = base.rounded_rect_slab
    cube = base.cube
    sphere = base.sphere
    cylinder_y = base.cylinder_y
    dark = mats["dark"]
    shadow = mats["shadow"]
    edge = mats["edge"]
    brass = mats["brass"]
    rubber = mats["rubber"]
    paper = mats["paper"]

    rounded("hero_v3_desk_single_slab_front_beveled_lip", (2.98, 0.035, 0.044), (-0.72, 0.902, -0.405), edge, 0, 0.02, 6, "table")
    rounded("hero_v3_desk_single_slab_back_shadow_lip", (2.88, 0.028, 0.034), (-0.72, 0.824, -1.33), shadow, 0, 0.014, 5, "table")
    for x in [-2.17, 0.73]:
        rounded(f"hero_v3_desk_side_beveled_endgrain_{x}", (0.036, 0.034, 0.9), (x, 0.899, -0.865), edge, 0, 0.018, 6, "table")
    for x in [-1.96, 0.52]:
        for z in [-1.18, -0.54]:
            rounded(f"hero_v3_desk_leg_top_mounting_plate_{x}_{z}", (0.22, 0.014, 0.16), (x, 0.807, z), dark, 0, 0.012, 4, "table")
            sphere(f"hero_v3_desk_mounting_bolt_{x}_{z}_a", (x - 0.064, 0.821, z - 0.042), (0.011, 0.004, 0.011), brass, (0, 0, 0), 10)
            sphere(f"hero_v3_desk_mounting_bolt_{x}_{z}_b", (x + 0.064, 0.821, z + 0.042), (0.011, 0.004, 0.011), brass, (0, 0, 0), 10)
            sphere(f"hero_v3_desk_floor_glide_shadow_{x}_{z}", (x, 0.032, z), (0.055, 0.006, 0.055), rubber, (0, 0, 0), 12)

    rounded("hero_v3_desk_under_cable_tray_deep_shadow", (1.18, 0.04, 0.12), (-0.22, 0.67, -1.28), shadow, 0, 0.016, 4, "table")
    rounded("hero_v3_desk_under_cable_tray_front_edge", (1.2, 0.024, 0.026), (-0.22, 0.692, -1.2), dark, 0, 0.01, 4, "table")
    for x in [-0.72, 0.28]:
        rounded(f"hero_v3_desk_cable_tray_hanger_{x}", (0.035, 0.16, 0.018), (x, 0.755, -1.25), dark, 0, 0.006, 3, "table")
    rounded("hero_v3_desk_leather_mat_with_beveled_edge", (1.28, 0.011, 0.46), (-0.92, 0.909, -0.78), v2_mats["dark_fabric"], 0.01, 0.018, 5, "table")
    for z in [-1.0, -0.56]:
        rounded(f"hero_v3_desk_mat_bound_edge_{z}", (1.2, 0.006, 0.01), (-0.92, 0.918, z), mats["fabricLine"], 0.01, 0.004, 3, "table")
    for x in [-1.76, -1.55]:
        rounded(f"hero_v3_notebook_layered_page_edge_{x}", (0.28, 0.01, 0.185), (x, 0.949, -1.04), paper, -0.08, 0.006, 4, "table")
        for i in range(3):
            cube(f"hero_v3_notebook_page_line_{x}_{i}", (0.24, 0.002, 0.004), (x, 0.958 + i * 0.006, -0.948), shadow, -0.08, 0)
    cylinder_y("hero_v3_monitor_arm_clamp_pressure_knob", 0.026, 0.036, (-1.74, 0.86, -1.31), dark, 16, math.pi * 0.5)
    rounded("hero_v3_monitor_arm_clamp_plate", (0.18, 0.035, 0.09), (-1.74, 0.83, -1.305), dark, 0, 0.01, 4, "table")


def add_v3_shelf_pass(base, mats: dict[str, bpy.types.Material], v2_mats: dict[str, bpy.types.Material]) -> None:
    rounded = base.rounded_rect_slab
    cube = base.cube
    sphere = base.sphere
    sx, sy, sz = -2.75, 0.72, -1.52
    shadow = mats["shadow"]
    edge = mats["edge"]
    brass = mats["brass"]
    dark = mats["dark"]
    paper = mats["paper"]

    for y in [sy + 0.02, sy + 0.56, sy + 1.1, sy + 1.64]:
        rounded(f"hero_v3_shelf_rounded_front_lip_{y}", (1.34, 0.032, 0.034), (sx, y + 0.015, sz + 0.27), edge, 0, 0.015, 5, "table")
        cube(f"hero_v3_shelf_back_panel_contact_shadow_{y}", (1.18, 0.015, 0.014), (sx, y + 0.018, sz - 0.23), shadow, 0, 0)
    for x in [sx - 0.62, sx + 0.62]:
        rounded(f"hero_v3_shelf_post_inner_shadow_strip_{x}", (0.024, 1.8, 0.018), (x, sy + 0.81, sz + 0.205), shadow, 0, 0.006, 4, "table")
    for index, x in enumerate([-0.49, -0.36, -0.23, -0.1, 0.04, 0.18, 0.33, 0.47]):
        h = 0.22 + (index % 5) * 0.035
        rounded(
            f"hero_v3_shelf_recessed_book_depth_{index}",
            (0.054, h, 0.18 + (index % 3) * 0.012),
            (sx + x, sy + 1.18 + h * 0.28, sz + 0.13 - (index % 2) * 0.015),
            [v2_mats["amber"], v2_mats["mint"], v2_mats["lavender"], v2_mats["blue"]][index % 4],
            0.015 * ((index % 3) - 1),
            0.006,
            3,
            "table",
        )
        cube(f"hero_v3_shelf_tiny_spine_label_{index}", (0.032, 0.006, 0.006), (sx + x, sy + 1.18 + h * 0.53, sz + 0.236), paper, 0, 0)
    for x in [sx - 0.31, sx + 0.31]:
        rounded(f"hero_v3_shelf_cabinet_door_panel_gap_{x}", (0.018, 0.44, 0.012), (x, sy + 0.47, sz + 0.246), shadow, 0, 0.003, 2, "table")
        sphere(f"hero_v3_shelf_cabinet_round_pull_{x}", (x + 0.08, sy + 0.47, sz + 0.257), (0.017, 0.006, 0.017), brass, (0, 0, 0), 10)
    for i in range(6):
        x = sx - 0.49 + i * 0.058
        cube(f"hero_v3_shelf_woven_basket_vertical_shadow_{i}", (0.007, 0.18, 0.009), (x, sy + 0.37, sz + 0.22), dark, 0, 0)


def add_v3_media_pass(base, mats: dict[str, bpy.types.Material]) -> None:
    rounded = base.rounded_rect_slab
    cube = base.cube
    sphere = base.sphere
    cx, cy, cz = 1.92, 0.45, -1.72
    shadow = mats["shadow"]
    edge = mats["edge"]
    dark = mats["dark"]
    brass = mats["brass"]
    glass = mats["glass"]

    rounded("hero_v3_media_top_slab_beveled_edge", (1.56, 0.035, 0.38), (cx + 0.02, cy + 0.602, cz + 0.05), edge, 0, 0.018, 5, "table")
    cube("hero_v3_media_back_panel_recess_shadow", (1.42, 0.22, 0.018), (cx, cy + 0.33, cz - 0.205), shadow, 0, 0.001)
    for index, x in enumerate([-0.62, -0.5, -0.38, -0.26, -0.14, -0.02, 0.1, 0.22, 0.34, 0.46, 0.58]):
        rounded(f"hero_v3_media_real_slat_rounded_face_{index}", (0.045, 0.18, 0.022), (cx + x, cy + 0.205, cz + 0.242), edge, 0, 0.006, 3, "table")
        cube(f"hero_v3_media_slat_dark_gap_{index}", (0.012, 0.17, 0.011), (cx + x + 0.034, cy + 0.205, cz + 0.257), shadow, 0, 0)
    for x in [cx - 0.58, cx + 0.56]:
        rounded(f"hero_v3_media_cable_grommet_black_insert_{x}", (0.13, 0.026, 0.018), (x, cy + 0.49, cz - 0.218), dark, 0, 0.008, 4, "table")
    rounded("hero_v3_tv_screen_beveled_black_glass_insert", (1.42, 0.74, 0.018), (cx + 0.04, cy + 1.08, cz - 0.155), glass, 0, 0.014, 5, "table")
    rounded("hero_v3_tv_lower_soundbar_shadow_gap", (1.1, 0.04, 0.035), (cx + 0.02, cy + 0.62, cz - 0.12), shadow, 0, 0.01, 4, "table")
    sphere("hero_v3_media_remote_power_button", (cx - 0.28, cy + 0.642, cz + 0.225), (0.012, 0.005, 0.012), brass, (0, 0, 0), 10)


def add_v3_lounge_pass(base, mats: dict[str, bpy.types.Material], v2_mats: dict[str, bpy.types.Material]) -> None:
    rounded = base.rounded_rect_slab
    cube = base.cube
    sphere = base.sphere
    vertical_cylinder = base.vertical_cylinder
    shadow = mats["shadow"]
    fabric_line = mats["fabricLine"]
    fabric_lift = mats["fabricLift"]
    dark = mats["dark"]
    rubber = mats["rubber"]
    edge = mats["edge"]
    glass = mats["glass"]

    rounded("hero_v3_rug_single_soft_bound_plane", (2.72, 0.016, 1.38), (-1.12, 0.106, 1.08), v2_mats["fabric"], 0.015, 0.04, 8, "table")
    for z in [0.42, 1.75]:
        rounded(f"hero_v3_rug_low_bound_edge_{z}", (2.58, 0.014, 0.022), (-1.12, 0.121, z), fabric_line, 0.015, 0.008, 5, "table")
    for x in [-2.31, 0.05]:
        rounded(f"hero_v3_rug_side_bound_edge_{x}", (0.022, 0.014, 1.2), (x, 0.122, 1.08), fabric_line, 0.015, 0.008, 5, "table")
    for x in [-2.33, -0.78]:
        rounded(f"hero_v3_sofa_arm_soft_outer_roll_{x}", (0.07, 0.46, 0.58), (x, 0.64, 1.17), fabric_lift, 0, 0.026, 7, "arm")
        rounded(f"hero_v3_sofa_arm_inner_shadow_groove_{x}", (0.02, 0.36, 0.48), (x + (0.035 if x < -1.5 else -0.035), 0.61, 1.17), shadow, 0, 0.008, 4, "arm")
    for x in [-2.03, -1.72, -1.41, -1.1]:
        rounded(f"hero_v3_sofa_back_cushion_vertical_break_{x}", (0.015, 0.36, 0.035), (x, 0.705, 1.45), fabric_line, 0, 0.006, 3, "table")
        sphere(f"hero_v3_sofa_low_button_shadow_{x}", (x, 0.62, 1.175), (0.022, 0.004, 0.022), shadow, (0, 0, 0), 12)
    for x in [-2.18, -0.94]:
        for z in [0.84, 1.49]:
            sphere(f"hero_v3_sofa_short_tapered_leg_{x}_{z}", (x, 0.12, z), (0.045, 0.055, 0.045), rubber, (0, 0, 0), 12)
    for x in [-1.9, -1.48, -1.06]:
        rounded(f"hero_v3_sofa_seat_front_piping_{x}", (0.28, 0.018, 0.018), (x, 0.505, 0.845), fabric_line, 0, 0.006, 4, "table")

    rounded("hero_v3_coffee_table_smoked_glass_top", (1.08, 0.018, 0.64), (0.28, 0.586, 1.02), glass, -0.08, 0.028, 6, "table")
    rounded("hero_v3_coffee_table_wood_frame_front", (1.12, 0.045, 0.046), (0.28, 0.55, 0.69), edge, -0.08, 0.016, 5, "table")
    rounded("hero_v3_coffee_table_wood_frame_back", (1.12, 0.045, 0.046), (0.28, 0.55, 1.36), edge, -0.08, 0.016, 5, "table")
    rounded("hero_v3_coffee_table_under_shelf_real_shadow", (0.96, 0.026, 0.48), (0.28, 0.34, 1.02), shadow, -0.08, 0.014, 4, "table")
    for x in [-0.18, 0.74]:
        for z in [0.72, 1.32]:
            vertical_cylinder(f"hero_v3_coffee_table_rounded_foot_{x}_{z}", 0.028, 0.055, (x, 0.082, z), dark, 12, 0, 0.016)


def mark_v3_objects(hidden_v2: list[str]) -> None:
    for obj in bpy.context.scene.objects:
        if obj.type not in {"MESH", "CURVE"}:
            continue
        obj["deskterior_asset_slug"] = ASSET_SLUG
        obj["deskterior_runtime_role"] = "whole_room_furniture_art_pass_v3"
        if obj.name.startswith("hero_v3_"):
            obj["deskterior_detail_pass"] = "commercial-art-pass-v3"
    bpy.context.scene["deskterior_v3_suppressed_v2_noise_count"] = len(hidden_v2)


def mesh_and_curve_objects() -> list[bpy.types.Object]:
    return [obj for obj in bpy.context.scene.objects if obj.type in {"MESH", "CURVE"}]


def world_bounds(objects: list[bpy.types.Object]) -> tuple[Vector, Vector]:
    points: list[Vector] = []
    for obj in objects:
        if obj.hide_render:
            continue
        for corner in obj.bound_box:
            points.append(obj.matrix_world @ Vector(corner))
    return (
        Vector((min(point.x for point in points), min(point.y for point in points), min(point.z for point in points))),
        Vector((max(point.x for point in points), max(point.y for point in points), max(point.z for point in points))),
    )


def triangle_count() -> int:
    total = 0
    for obj in bpy.context.scene.objects:
        if obj.hide_render or obj.type != "MESH":
            continue
        total += sum(max(len(poly.vertices) - 2, 1) for poly in obj.data.polygons)
    return total


def main() -> int:
    args = parse_args()
    repo_root = Path(args.repo_root).resolve()
    v2 = load_v2_generator(repo_root)
    base = v2.load_v1_generator(repo_root)

    runtime_dir = repo_root / "assets/runtime-candidates/blender-authored/bruno-furniture-hero-kit-v3"
    public_dir = repo_root / f"apps/web/public/assets/models/{ASSET_KEY}"
    reference_dir = repo_root / "assets/references/blender-authored/bruno-furniture-hero-kit-v3"
    blend_path = repo_root / f"assets/blender/deskterior/{ASSET_KEY}.blend"
    for path in [runtime_dir, public_dir, reference_dir, blend_path.parent]:
        path.mkdir(parents=True, exist_ok=True)

    base.clear_scene()
    texture_package_dir = runtime_dir / "textures"
    asset_metadata = base.build_asset(texture_package_dir)
    v2_mats = v2.make_detail_materials(base)
    v2.add_desk_commercial_pass(base, v2_mats)
    v2.add_shelf_commercial_pass(base, v2_mats)
    v2.add_media_console_commercial_pass(base, v2_mats)
    v2.add_lounge_commercial_pass(base, v2_mats)
    hidden_v2 = hide_noisy_v2_marks()
    v3_mats = make_v3_materials(base)
    add_v3_desk_pass(base, v3_mats, v2_mats)
    add_v3_shelf_pass(base, v3_mats, v2_mats)
    add_v3_media_pass(base, v3_mats)
    add_v3_lounge_pass(base, v3_mats, v2_mats)
    mark_v3_objects(hidden_v2)
    v2.convert_curves_to_meshes()
    base.apply_modifiers()
    v2.setup_preview_lighting()

    runtime_glb = runtime_dir / f"{ASSET_KEY}.glb"
    public_glb = public_dir / f"{ASSET_KEY}.glb"
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
    base.export_glb(runtime_glb)
    shutil.copy2(runtime_glb, public_glb)

    preview_overall = reference_dir / "furniture-v3-overall.png"
    preview_desk_shelf = reference_dir / "furniture-v3-desk-shelf-closeup.png"
    preview_lounge_media = reference_dir / "furniture-v3-lounge-media-closeup.png"
    v2.render_preview(preview_overall, v2.setup_camera("furniture_v3_camera_overall", (3.15, -5.05, 3.1), (-0.42, -0.45, 0.9), 4.9))
    v2.render_preview(preview_desk_shelf, v2.setup_camera("furniture_v3_camera_desk_shelf", (-2.72, -3.85, 2.5), (-1.35, 0.45, 0.85), 2.75))
    v2.render_preview(preview_lounge_media, v2.setup_camera("furniture_v3_camera_lounge_media", (3.5, -3.15, 2.32), (0.28, -1.0, 0.74), 3.2))

    texture_package, public_texture_package = v2.copy_texture_package(repo_root, asset_metadata, runtime_dir, public_dir)
    objects = mesh_and_curve_objects()
    min_v, max_v = world_bounds(objects)
    dimensions = max_v - min_v
    v2_detail_count = sum(1 for obj in objects if obj.name.startswith("hero_v2_") and not obj.hide_render)
    v3_detail_count = sum(1 for obj in objects if obj.name.startswith("hero_v3_"))
    unmaterialed = [
        obj.name
        for obj in objects
        if not obj.hide_render and hasattr(obj.data, "materials") and len(obj.data.materials) == 0
    ]
    missing_external_images = [
        image.filepath
        for image in bpy.data.images
        if image.filepath and not image.packed_file and not Path(bpy.path.abspath(image.filepath)).exists()
    ]
    tri_count = triangle_count()
    report = {
        "schemaVersion": "deskterior-blender-authored-asset-review-v3",
        "asset": {
            "slug": ASSET_SLUG,
            "assetKey": ASSET_KEY,
            "intent": "whole-room furniture art-pass candidate with quieter commercial-grade construction detail",
            "source": "Project-owned Blender procedural authoring layered over V1/V2; no Bruno Simon asset or paid asset copied",
            "license": "project-owned prototype asset pending commercial catalog approval",
            "currentGrade": "commercial art-pass candidate, still not final approved catalog asset",
            "promotionBoundary": [
                "visible noisy V2 grid/stitch marks are suppressed",
                "all large furniture groups receive quieter construction details",
                "final claim still requires human art approval, split SKUs, LOD/collider package, meshopt, and final UV/light bake",
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
            "objectCount": len([obj for obj in objects if not obj.hide_render]),
            "meshObjectCount": len([obj for obj in objects if obj.type == "MESH" and not obj.hide_render]),
            "curveObjectCount": len([obj for obj in objects if obj.type == "CURVE" and not obj.hide_render]),
            "materialCount": len(bpy.data.materials),
            "textureCount": len(bpy.data.images),
            "triangleCount": tri_count,
            "triangleBudget": 150000,
            "triangleBudgetStatus": "pass" if tri_count <= 150000 else "review-needed",
            "v2DetailObjectCountAfterNoiseSuppression": v2_detail_count,
            "v3DetailObjectCount": v3_detail_count,
            "suppressedNoisyV2ObjectCount": len(hidden_v2),
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
                "quiet beveled slab edge, side endgrain, leg mounting plates, cable tray, clamp plate, subdued mat, layered paper edges",
            ],
            "shelf": [
                "rounded shelf lips, post shadow strips, varied book depths, tiny spine labels, cabinet gaps/pulls, basket shadows",
            ],
            "mediaConsole": [
                "beveled top slab, recessed back panel, rounded slats with dark gaps, cable grommets, smoked TV glass, soundbar shadow",
            ],
            "lounge": [
                "single bound rug plane replacing diagram grid",
                "sofa roll arms, cushion breaks, button shadows, tapered feet, seat piping",
                "smoked glass coffee top, wood frame, under-shelf shadow, rounded feet",
            ],
        },
        "comparisonReview": {
            "removedRegression": {
                "issue": "V2 had bright/thick grid-like stitch and rug lines that read as schematic annotation",
                "action": "suppressed noisy V2 line objects and replaced them with lower-contrast edge binding/panel construction details",
                "suppressedObjects": hidden_v2[:40],
            },
            "remainingGap": [
                "still procedurally-authored stylized furniture, not a hand-modeled marketplace furniture pack",
                "needs final split into selectable furniture SKUs with colliders/LODs before catalog promotion",
                "runtime route still needs a clean hydration/performance check after asset swap",
            ],
        },
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
