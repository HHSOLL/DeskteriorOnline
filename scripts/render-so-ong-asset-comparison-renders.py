#!/usr/bin/env python3
"""Render per-asset previews for the So Ong Meshy/prototype comparison board."""

from __future__ import annotations

import json
import math
from pathlib import Path

import bpy
from mathutils import Vector


REPO_ROOT = Path(__file__).resolve().parents[1]
REPORT_PATH = REPO_ROOT / "assets/references/video-scenes/so-ong-space-2026-05-desk-setup/meshy-generation-report.json"
MODELS_ROOT = REPO_ROOT / "apps/web/public/assets/models"
OUTPUT_ROOT = REPO_ROOT / "assets/references/video-scenes/so-ong-space-2026-05-desk-setup/asset-comparison-renders"


def reset_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    bpy.context.scene.unit_settings.system = "METRIC"
    bpy.context.scene.render.engine = "BLENDER_EEVEE_NEXT"
    bpy.context.scene.render.resolution_x = 640
    bpy.context.scene.render.resolution_y = 420
    bpy.context.scene.eevee.taa_render_samples = 48
    bpy.context.scene.view_settings.view_transform = "Filmic"
    bpy.context.scene.view_settings.look = "Medium High Contrast"
    bpy.context.scene.view_settings.exposure = -0.6
    bpy.context.scene.view_settings.gamma = 1.0


def make_material(name: str, color: tuple[float, float, float, float], roughness: float = 0.72) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = color
        bsdf.inputs["Roughness"].default_value = roughness
    return material


def world_bounds(objects: list[bpy.types.Object]) -> tuple[Vector, Vector]:
    points: list[Vector] = []
    for obj in objects:
        for corner in obj.bound_box:
            points.append(obj.matrix_world @ Vector(corner))
    return (
        Vector((min(point.x for point in points), min(point.y for point in points), min(point.z for point in points))),
        Vector((max(point.x for point in points), max(point.y for point in points), max(point.z for point in points))),
    )


def look_at(obj: bpy.types.Object, target: Vector) -> None:
    direction = target - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def add_preview_stage(center: Vector, size: float, z_min: float) -> None:
    stage_mat = make_material("comparison_stage_warm_grey", (0.82, 0.82, 0.78, 1), 0.78)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(center.x, center.y, z_min - 0.012))
    stage = bpy.context.object
    stage.name = "comparison_preview_stage"
    stage.dimensions = (size * 1.45, size * 1.1, 0.018)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    stage.data.materials.append(stage_mat)


def render_asset(asset_id: str) -> Path:
    reset_scene()
    path = MODELS_ROOT / asset_id / f"{asset_id}.glb"
    if not path.exists():
        raise FileNotFoundError(path)

    before = set(bpy.context.scene.objects)
    bpy.ops.import_scene.gltf(filepath=str(path))
    imported = [obj for obj in set(bpy.context.scene.objects) - before if obj.type == "MESH"]
    if not imported:
        raise RuntimeError(f"No mesh objects imported for {asset_id}")

    min_v, max_v = world_bounds(imported)
    center = (min_v + max_v) * 0.5
    span = max(max_v.x - min_v.x, max_v.y - min_v.y, max_v.z - min_v.z, 0.08)
    add_preview_stage(center, span, min_v.z)

    bpy.ops.object.light_add(type="AREA", location=(center.x - span * 0.6, center.y - span * 0.95, center.z + span * 1.45))
    key = bpy.context.object
    key.name = "asset_preview_key"
    key.data.energy = 420
    key.data.size = span * 1.5

    bpy.ops.object.light_add(type="POINT", location=(center.x + span * 0.6, center.y + span * 0.35, center.z + span * 0.7))
    fill = bpy.context.object
    fill.name = "asset_preview_lavender_fill"
    fill.data.energy = 75
    fill.data.color = (0.72, 0.66, 1.0)

    bpy.ops.object.camera_add(location=(center.x + span * 0.8, center.y - span * 1.6, center.z + span * 0.78))
    camera = bpy.context.object
    look_at(camera, center)
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = span * 1.38
    bpy.context.scene.camera = camera

    bpy.context.scene.world.color = (0.74, 0.72, 0.86)
    OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
    output_path = OUTPUT_ROOT / f"{asset_id}.png"
    bpy.context.scene.render.filepath = str(output_path)
    bpy.ops.render.render(write_still=True)
    return output_path


def main() -> None:
    report = json.loads(REPORT_PATH.read_text(encoding="utf-8"))
    for item in report["items"]:
        output = render_asset(item["catalogItemId"])
        print(f"rendered {item['catalogItemId']} -> {output}")


if __name__ == "__main__":
    main()
