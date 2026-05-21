#!/usr/bin/env python3
"""Finalize a provider-generated product GLB for DeskteriorOnline runtime use.

This script is intentionally conservative. It normalizes origin, floor contact,
official dimensions, material names, and thumbnail/QA output. It does not claim
that a raw provider mesh is visually identical to the product; the worker uses
the report as one input to its private-asset quality gate.
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
    parser.add_argument("--input", required=True)
    parser.add_argument("--reference-pack", required=True)
    parser.add_argument("--category-profile", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--thumbnail", required=True)
    parser.add_argument("--qa-report", required=True)
    parser.add_argument("--file-name", default="product-asset")
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else sys.argv[1:]
    return parser.parse_args(argv)


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    bpy.context.scene.unit_settings.system = "METRIC"
    bpy.context.scene.render.engine = "BLENDER_EEVEE_NEXT"
    world = bpy.context.scene.world or bpy.data.worlds.new("World")
    bpy.context.scene.world = world
    world.color = (0.78, 0.73, 0.66)


def set_view_setting(name: str, candidates: list[str]) -> None:
    for value in candidates:
        try:
            setattr(bpy.context.scene.view_settings, name, value)
            return
        except Exception:
            continue


def configure_thumbnail_color() -> None:
    set_view_setting("view_transform", ["AgX", "Filmic", "Standard"])
    set_view_setting("look", ["Medium High Contrast", "None"])
    bpy.context.scene.view_settings.exposure = -0.55
    bpy.context.scene.view_settings.gamma = 1.0


def read_json(path: str) -> dict:
    with open(path, "r", encoding="utf-8") as handle:
        return json.load(handle)


def get_mesh_objects() -> list[bpy.types.Object]:
    return [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]


def world_bounds(objects: list[bpy.types.Object]) -> tuple[Vector, Vector]:
    points: list[Vector] = []
    for obj in objects:
        for corner in obj.bound_box:
            points.append(obj.matrix_world @ Vector(corner))
    if not points:
        return Vector((0, 0, 0)), Vector((0, 0, 0))
    min_v = Vector((min(point.x for point in points), min(point.y for point in points), min(point.z for point in points)))
    max_v = Vector((max(point.x for point in points), max(point.y for point in points), max(point.z for point in points)))
    return min_v, max_v


def dimensions_from_pack(reference_pack: dict) -> dict | None:
    product = reference_pack.get("product") if isinstance(reference_pack.get("product"), dict) else {}
    dimensions = product.get("dimensionsMm") if isinstance(product.get("dimensionsMm"), dict) else None
    if not dimensions:
        return None
    try:
        width = float(dimensions["width"])
        depth = float(dimensions["depth"])
        height = float(dimensions["height"])
    except Exception:
        return None
    if min(width, depth, height) <= 0:
        return None
    return {"width": width, "depth": depth, "height": height}


def apply_dimensions(objects: list[bpy.types.Object], dimensions_mm: dict | None) -> None:
    min_v, max_v = world_bounds(objects)
    size = max_v - min_v
    if not dimensions_mm or min(size.x, size.y, size.z) <= 0:
        return

    target = Vector((dimensions_mm["width"] / 1000.0, dimensions_mm["depth"] / 1000.0, dimensions_mm["height"] / 1000.0))
    scale = Vector((target.x / size.x, target.y / size.y, target.z / size.z))
    for obj in objects:
        obj.scale = (obj.scale.x * scale.x, obj.scale.y * scale.y, obj.scale.z * scale.z)
    bpy.ops.object.select_all(action="DESELECT")
    for obj in objects:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = objects[0]
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)


def center_on_floor(objects: list[bpy.types.Object]) -> None:
    min_v, max_v = world_bounds(objects)
    center = (min_v + max_v) * 0.5
    offset = Vector((-center.x, -center.y, -min_v.z))
    for obj in objects:
        obj.location += offset
    bpy.context.view_layer.update()


def normalize_materials(category_profile: dict) -> None:
    material_targets = category_profile.get("materialTargets", [])
    target_prefix = category_profile.get("key", "product")
    for index, material in enumerate(bpy.data.materials):
        material.name = f"{target_prefix}_material_{index:02d}"
        material.use_nodes = True
        bsdf = material.node_tree.nodes.get("Principled BSDF")
        if bsdf:
            if "Roughness" in bsdf.inputs and bsdf.inputs["Roughness"].default_value < 0.18:
                bsdf.inputs["Roughness"].default_value = 0.28
            if "Metallic" in bsdf.inputs and "metal" not in " ".join(material_targets).lower():
                bsdf.inputs["Metallic"].default_value = min(bsdf.inputs["Metallic"].default_value, 0.35)


def add_lights_and_camera(objects: list[bpy.types.Object]) -> None:
    min_v, max_v = world_bounds(objects)
    size = max_v - min_v
    radius = max(size.x, size.y, size.z, 0.1)

    bpy.ops.object.light_add(type="AREA", location=(0, -radius * 1.6, radius * 1.8))
    key = bpy.context.object
    key.name = "thumbnail_key_softbox"
    key.data.energy = 115
    key.data.size = radius * 2.6

    bpy.ops.object.light_add(type="AREA", location=(-radius * 1.4, radius * 1.2, radius * 1.15))
    fill = bpy.context.object
    fill.name = "thumbnail_cool_fill"
    fill.data.energy = 22
    fill.data.size = radius * 3.2
    fill.data.color = (0.72, 0.8, 1.0)

    bpy.ops.object.camera_add(location=(radius * 1.15, -radius * 1.75, radius * 0.95), rotation=(math.radians(62), 0, math.radians(34)))
    camera = bpy.context.object
    camera.name = "thumbnail_camera"
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = radius * 1.68
    bpy.context.scene.camera = camera


def render_thumbnail(path: str) -> None:
    configure_thumbnail_color()
    bpy.context.scene.render.resolution_x = 512
    bpy.context.scene.render.resolution_y = 512
    bpy.context.scene.eevee.taa_render_samples = 64
    bpy.context.scene.render.film_transparent = False
    bpy.context.scene.render.image_settings.file_format = "WEBP"
    bpy.context.scene.render.filepath = path
    bpy.ops.render.render(write_still=True)


def output_dimensions_mm(objects: list[bpy.types.Object]) -> dict:
    min_v, max_v = world_bounds(objects)
    size = max_v - min_v
    return {
        "width": round(size.x * 1000, 3),
        "depth": round(size.y * 1000, 3),
        "height": round(size.z * 1000, 3),
    }


def max_error_percent(input_mm: dict | None, output_mm: dict) -> float | None:
    if not input_mm:
        return None
    values = []
    for key in ["width", "depth", "height"]:
        reference = float(input_mm[key])
        if reference <= 0:
            continue
        values.append(abs(float(output_mm[key]) - reference) / reference * 100)
    return round(max(values), 4) if values else None


def export_glb(path: str) -> None:
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format="GLB",
        export_yup=True,
        export_apply=True,
        export_animations=False,
        export_cameras=False,
        export_lights=False,
    )


def main() -> None:
    args = parse_args()
    reference_pack = read_json(args.reference_pack)
    category_profile = read_json(args.category_profile)

    clear_scene()
    bpy.ops.import_scene.gltf(filepath=args.input)
    objects = get_mesh_objects()
    warnings: list[str] = []
    if not objects:
        raise RuntimeError("No mesh objects found in generated GLB.")

    dimensions_mm = dimensions_from_pack(reference_pack)
    if not dimensions_mm:
        warnings.append("OFFICIAL_DIMENSIONS_MISSING")

    for _ in range(6):
        apply_dimensions(objects, dimensions_mm)
        bpy.context.view_layer.update()
    center_on_floor(objects)
    normalize_materials(category_profile)
    add_lights_and_camera(objects)
    render_thumbnail(args.thumbnail)
    export_glb(args.output)

    output_mm = output_dimensions_mm(objects)
    report = {
        "status": "finalized",
        "fileName": args.file_name,
        "category": category_profile.get("key", "generic"),
        "warnings": warnings,
        "dimensions": {
            "inputMm": dimensions_mm,
            "outputMm": output_mm,
            "maxErrorPercent": max_error_percent(dimensions_mm, output_mm),
        },
        "runtime": {
            "pivot": {"x": "center", "y": "floor", "z": "center"},
            "scaleLocked": True,
            "preferredPlacement": category_profile.get("preferredPlacement", "surface"),
        },
        "repairDirectives": category_profile.get("repairDirectives", []),
    }
    Path(args.qa_report).write_text(json.dumps(report, indent=2), encoding="utf-8")


if __name__ == "__main__":
    main()
