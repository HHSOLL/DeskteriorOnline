#!/usr/bin/env python3
"""Generate a Blender-authored wall/decor detail kit for the PC room QA scene.

The asset is a deliberately small authored kit: a bevelled pegboard, shelves,
books, plant, camera, art tiles, and practical RGB bars. It is intended to raise
scene density and material depth without copying Bruno Simon's room assets.
"""

from __future__ import annotations

import argparse
import json
import math
import sys
from pathlib import Path

import bpy
from mathutils import Vector


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-root", required=True)
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else sys.argv[1:]
    return parser.parse_args(argv)


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    bpy.context.scene.unit_settings.system = "METRIC"
    bpy.context.scene.unit_settings.scale_length = 1.0
    bpy.context.scene.render.engine = "BLENDER_EEVEE_NEXT"
    world = bpy.context.scene.world or bpy.data.worlds.new("World")
    bpy.context.scene.world = world
    world.color = (0.74, 0.69, 0.67)


def mat(name: str, color: tuple[float, float, float, float], roughness: float, metallic: float = 0.0, emissive: tuple[float, float, float] | None = None, strength: float = 0.0) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = color
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Metallic"].default_value = metallic
        if emissive and "Emission Color" in bsdf.inputs:
            bsdf.inputs["Emission Color"].default_value = (emissive[0], emissive[1], emissive[2], 1.0)
            bsdf.inputs["Emission Strength"].default_value = strength
    return material


def rounded_cube(name: str, size: tuple[float, float, float], loc: tuple[float, float, float], material: bpy.types.Material, bevel: float = 0.012) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    if bevel > 0:
        bevel_mod = obj.modifiers.new(f"{name}_edge_bevel", "BEVEL")
        bevel_mod.width = bevel
        bevel_mod.segments = 3
        bevel_mod.affect = "EDGES"
        normal_mod = obj.modifiers.new(f"{name}_weighted_normals", "WEIGHTED_NORMAL")
        normal_mod.keep_sharp = True
    return obj


def cylinder(name: str, radius: float, depth: float, loc: tuple[float, float, float], material: bpy.types.Material, vertices: int = 32, rotation: tuple[float, float, float] = (0, 0, 0)) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(material)
    bevel_mod = obj.modifiers.new(f"{name}_rim_softness", "BEVEL")
    bevel_mod.width = min(radius * 0.08, 0.006)
    bevel_mod.segments = 2
    obj.modifiers.new(f"{name}_weighted_normals", "WEIGHTED_NORMAL")
    return obj


def uv_leaf(name: str, loc: tuple[float, float, float], rot: tuple[float, float, float], scale: tuple[float, float, float], material: bpy.types.Material) -> bpy.types.Object:
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=10, radius=1, location=loc, rotation=rot)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    obj.data.materials.append(material)
    obj.modifiers.new(f"{name}_weighted_normals", "WEIGHTED_NORMAL")
    return obj


def make_poly_curve(name: str, points: list[tuple[float, float, float]], material: bpy.types.Material, bevel_depth: float) -> bpy.types.Object:
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 12
    curve.bevel_depth = bevel_depth
    curve.bevel_resolution = 4
    spline = curve.splines.new("POLY")
    spline.points.add(len(points) - 1)
    for point, co in zip(spline.points, points):
        point.co = (co[0], co[1], co[2], 1.0)
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    return obj


def mesh_objects() -> list[bpy.types.Object]:
    return [obj for obj in bpy.context.scene.objects if obj.type in {"MESH", "CURVE"}]


def apply_modifiers() -> None:
    for obj in list(bpy.context.scene.objects):
        if obj.type != "MESH":
            continue
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        for modifier in list(obj.modifiers):
            try:
                bpy.ops.object.modifier_apply(modifier=modifier.name)
            except Exception:
                pass
        obj.select_set(False)


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
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH":
            continue
        total += sum(max(len(poly.vertices) - 2, 1) for poly in obj.data.polygons)
    return total


def configure_thumbnail(objects: list[bpy.types.Object]) -> None:
    min_v, max_v = world_bounds(objects)
    size = max_v - min_v
    radius = max(size.x, size.y, size.z, 0.8)
    bpy.ops.object.light_add(type="AREA", location=(0.4, -1.6, 1.5))
    key = bpy.context.object
    key.name = "review_key_softbox"
    key.data.energy = 220
    key.data.size = 2.2
    bpy.ops.object.light_add(type="AREA", location=(-1.2, 0.9, 0.8))
    fill = bpy.context.object
    fill.name = "review_cool_fill"
    fill.data.energy = 55
    fill.data.size = 1.8
    fill.data.color = (0.65, 0.78, 1.0)
    target = Vector((0, 0.0, size.z * 0.45))
    location = Vector((radius * 0.45, -radius * 1.9, radius * 0.72))
    rotation = (target - location).to_track_quat("-Z", "Y").to_euler()
    bpy.ops.object.camera_add(location=location, rotation=rotation)
    camera = bpy.context.object
    camera.name = "review_camera"
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 1.72
    bpy.context.scene.camera = camera


def render_thumbnail(path: Path) -> None:
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
    bpy.context.scene.render.resolution_x = 768
    bpy.context.scene.render.resolution_y = 768
    bpy.context.scene.eevee.taa_render_samples = 64
    bpy.context.scene.render.image_settings.file_format = "WEBP"
    bpy.context.scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


def export_glb(path: Path) -> None:
    bpy.ops.export_scene.gltf(
        filepath=str(path),
        export_format="GLB",
        export_yup=True,
        export_apply=True,
        export_animations=False,
        export_cameras=False,
        export_lights=False,
        export_extras=True,
    )


def build_asset() -> None:
    walnut = mat("kit_walnut_warm_rough", (0.57, 0.34, 0.22, 1), 0.78)
    dark_walnut = mat("kit_dark_endgrain", (0.23, 0.13, 0.09, 1), 0.84)
    cream = mat("kit_warm_white_lacquer", (0.92, 0.86, 0.8, 1), 0.62)
    graphite = mat("kit_soft_graphite", (0.055, 0.07, 0.085, 1), 0.58, 0.12)
    paper = mat("kit_offwhite_paper", (0.86, 0.79, 0.68, 1), 0.9)
    blue = mat("kit_rgb_cool_blue", (0.5, 0.83, 1.0, 1), 0.34, 0.0, (0.25, 0.75, 1.0), 0.85)
    pink = mat("kit_rgb_soft_pink", (1.0, 0.38, 0.62, 1), 0.38, 0.0, (1.0, 0.16, 0.45), 0.78)
    amber = mat("kit_book_amber", (0.94, 0.62, 0.34, 1), 0.68)
    mint = mat("kit_book_mint", (0.44, 0.78, 0.58, 1), 0.72)
    lavender = mat("kit_book_lavender", (0.48, 0.43, 0.78, 1), 0.7)
    leaf_mat = mat("kit_plant_leaf_variegated", (0.26, 0.58, 0.38, 1), 0.82)
    pot_mat = mat("kit_ceramic_plant_pot", (0.82, 0.77, 0.7, 1), 0.72)

    rounded_cube("pegboard_back_panel", (1.72, 0.045, 1.08), (0, 0, 0.54), walnut, 0.018)
    rounded_cube("pegboard_shadow_inset", (1.56, 0.018, 0.9), (0, -0.028, 0.55), dark_walnut, 0.012)
    rounded_cube("pegboard_top_frame", (1.86, 0.075, 0.07), (0, 0.02, 1.11), cream, 0.02)
    rounded_cube("pegboard_bottom_frame", (1.86, 0.075, 0.07), (0, 0.02, -0.03), cream, 0.02)
    rounded_cube("pegboard_left_frame", (0.07, 0.075, 1.16), (-0.93, 0.02, 0.54), cream, 0.02)
    rounded_cube("pegboard_right_frame", (0.07, 0.075, 1.16), (0.93, 0.02, 0.54), cream, 0.02)

    for row in range(5):
        for col in range(8):
            x = -0.64 + col * 0.18
            z = 0.17 + row * 0.16
            cylinder(f"peg_hole_{row}_{col}", 0.018, 0.012, (x, -0.055, z), graphite, 20, (math.pi / 2, 0, 0))

    for index, z in enumerate([0.34, 0.78]):
        rounded_cube(f"floating_display_shelf_{index}", (1.18, 0.22, 0.055), (-0.08, -0.13, z), cream, 0.018)
        rounded_cube(f"shelf_walnut_lip_{index}", (1.08, 0.035, 0.035), (-0.08, -0.26, z + 0.032), walnut, 0.01)
        rounded_cube(f"shelf_soft_shadow_{index}", (1.18, 0.012, 0.018), (-0.08, -0.247, z - 0.048), graphite, 0.006)

    book_mats = [pink, blue, amber, mint, lavender, paper]
    for index, x in enumerate([-0.55, -0.42, -0.29, -0.14, 0.03, 0.17]):
        height = 0.22 + (index % 3) * 0.04
        rounded_cube(f"upper_book_{index}", (0.085, 0.12, height), (x, -0.24, 0.83 + height / 2), book_mats[index % len(book_mats)], 0.008)
        rounded_cube(f"upper_book_label_{index}", (0.055, 0.01, 0.012), (x, -0.305, 0.89 + index * 0.006), paper, 0.003)

    for index, x in enumerate([-0.46, -0.3, -0.13]):
        rounded_cube(f"lower_stacked_book_{index}", (0.26, 0.14, 0.036), (x, -0.25, 0.39 + index * 0.042), book_mats[(index + 2) % len(book_mats)], 0.009)

    cylinder("plant_pot", 0.075, 0.13, (0.48, -0.23, 0.43), pot_mat, 28)
    cylinder("plant_soil", 0.064, 0.012, (0.48, -0.23, 0.5), graphite, 28)
    for index in range(10):
        angle = index * 0.63
        uv_leaf(
            f"plant_leaf_{index}",
            (0.48 + math.cos(angle) * 0.09, -0.23 + math.sin(angle) * 0.022, 0.56 + (index % 3) * 0.035),
            (0.34, angle, 0.24),
            (0.065, 0.015, 0.026),
            leaf_mat,
        )

    rounded_cube("mini_camera_body", (0.18, 0.09, 0.13), (0.61, -0.24, 0.91), graphite, 0.018)
    cylinder("mini_camera_lens", 0.044, 0.03, (0.61, -0.302, 0.91), graphite, 28, (math.pi / 2, 0, 0))
    cylinder("mini_camera_glass", 0.03, 0.012, (0.61, -0.325, 0.91), blue, 24, (math.pi / 2, 0, 0))

    for index, (x, z, material) in enumerate([(-0.68, 0.58, blue), (-0.5, 0.56, pink), (0.32, 0.62, amber), (0.68, 0.68, mint)]):
        rounded_cube(f"tiny_art_tile_{index}", (0.12, 0.018, 0.09), (x, -0.062, z), material, 0.012)

    rounded_cube("cool_led_bar", (0.78, 0.018, 0.022), (-0.42, -0.068, 0.12), blue, 0.006)
    rounded_cube("warm_led_bar", (0.62, 0.018, 0.022), (0.38, -0.068, 1.0), pink, 0.006)
    make_poly_curve(
        "soft_rgb_cable_s_curve",
        [(-0.72, -0.265, 0.28), (-0.48, -0.29, 0.2), (-0.2, -0.275, 0.28), (0.05, -0.295, 0.22)],
        graphite,
        0.008,
    )
    make_poly_curve(
        "pink_patch_cable",
        [(0.22, -0.27, 0.87), (0.38, -0.29, 0.77), (0.52, -0.27, 0.83)],
        pink,
        0.006,
    )


def main() -> None:
    args = parse_args()
    repo_root = Path(args.repo_root).resolve()
    runtime_dir = repo_root / "assets/runtime-candidates/blender-authored/bruno-room-detail-kit"
    public_dir = repo_root / "apps/web/public/assets/models/p2s_bruno_room_detail_kit"
    reference_dir = repo_root / "assets/references/blender-authored/bruno-room-detail-kit"
    for directory in [runtime_dir, public_dir, reference_dir]:
        directory.mkdir(parents=True, exist_ok=True)

    clear_scene()
    build_asset()
    apply_modifiers()
    objects = mesh_objects()
    configure_thumbnail(objects)

    runtime_glb = runtime_dir / "p2s_bruno_room_detail_kit.glb"
    public_glb = public_dir / "p2s_bruno_room_detail_kit.glb"
    thumbnail = runtime_dir / "p2s_bruno_room_detail_kit.thumbnail.webp"
    report_path = reference_dir / "asset-review-2026-05-19.json"
    render_thumbnail(thumbnail)
    export_glb(runtime_glb)
    export_glb(public_glb)

    min_v, max_v = world_bounds(objects)
    size = max_v - min_v
    report = {
        "schemaVersion": "deskterior-blender-authored-asset-review-v1",
        "asset": {
            "slug": "p2s-bruno-room-detail-kit",
            "intent": "wall shelf / pegboard / micro decor density kit for Bruno-inspired cutaway room mood",
            "source": "Blender procedural authoring by Codex; no Bruno Simon source asset copied",
            "license": "project-owned prototype asset pending product license review",
        },
        "outputs": {
            "runtimeGlb": str(runtime_glb.relative_to(repo_root)),
            "publicGlb": str(public_glb.relative_to(repo_root)),
            "thumbnail": str(thumbnail.relative_to(repo_root)),
        },
        "metrics": {
            "dimensionsM": [round(size.x, 4), round(size.y, 4), round(size.z, 4)],
            "objectCount": len(objects),
            "materialCount": len(bpy.data.materials),
            "triangleCount": triangle_count(),
            "runtimeBytes": runtime_glb.stat().st_size,
            "publicBytes": public_glb.stat().st_size,
        },
        "comparisonReview": {
            "commercialPatternsApplied": [
                "bevelled hard edges instead of raw cubes",
                "separate rough wood, lacquer, paper, graphite, ceramic, leaf, and emissive materials",
                "micro-scale shelf labels, peg holes, cables, camera lens, plant leaves, and LED bars",
                "single wall-mounted composition with predictable origin for room placement",
            ],
            "knownGapsBeforeCommercialPromotion": [
                "no baked ambient occlusion texture atlas yet",
                "no hand-painted normal/roughness maps yet",
                "plant leaves are procedural ellipsoids, not botanical mesh scans",
                "needs visual comparison against paid/commercial references before public catalog promotion",
            ],
            "currentGrade": "runtime QA candidate, not final commercial catalog asset",
        },
    }
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
