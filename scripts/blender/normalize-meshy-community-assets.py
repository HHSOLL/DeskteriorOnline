#!/usr/bin/env python3
"""Normalize Meshy community GLBs into Deskterior candidate runtime packages.

This pass is deliberately conservative: it does not rescale the source asset to
invent commercial dimensions. It centers the mesh on a floor-contact pivot,
stabilizes object/material names, renders a review thumbnail, exports GLB, and
writes sidecar metadata for a later human promotion gate.
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
    parser.add_argument("--registry", required=True)
    parser.add_argument("--output-root", required=True)
    parser.add_argument("--report", required=True)
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else sys.argv[1:]
    return parser.parse_args(argv)


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2), encoding="utf-8")


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    bpy.context.scene.unit_settings.system = "METRIC"
    bpy.context.scene.unit_settings.scale_length = 1.0
    bpy.context.scene.render.engine = "BLENDER_EEVEE_NEXT"
    world = bpy.context.scene.world or bpy.data.worlds.new("World")
    bpy.context.scene.world = world
    world.color = (0.76, 0.74, 0.71)


def set_view_setting(name: str, candidates: list[str]) -> None:
    for value in candidates:
        try:
            setattr(bpy.context.scene.view_settings, name, value)
            return
        except Exception:
            continue


def configure_color() -> None:
    set_view_setting("view_transform", ["AgX", "Filmic", "Standard"])
    set_view_setting("look", ["Medium High Contrast", "None"])
    bpy.context.scene.view_settings.exposure = -0.45
    bpy.context.scene.view_settings.gamma = 1.0


def mesh_objects() -> list[bpy.types.Object]:
    return [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]


def world_bounds(objects: list[bpy.types.Object]) -> tuple[Vector, Vector]:
    points: list[Vector] = []
    for obj in objects:
        for corner in obj.bound_box:
            points.append(obj.matrix_world @ Vector(corner))
    if not points:
        return Vector((0, 0, 0)), Vector((0, 0, 0))
    return (
        Vector((min(point.x for point in points), min(point.y for point in points), min(point.z for point in points))),
        Vector((max(point.x for point in points), max(point.y for point in points), max(point.z for point in points))),
    )


def dimensions_mm(objects: list[bpy.types.Object]) -> dict:
    min_v, max_v = world_bounds(objects)
    size = max_v - min_v
    return {
        "width": round(size.x * 1000, 3),
        "depth": round(size.y * 1000, 3),
        "height": round(size.z * 1000, 3),
    }


def center_on_floor(objects: list[bpy.types.Object]) -> None:
    min_v, max_v = world_bounds(objects)
    center = (min_v + max_v) * 0.5
    offset = Vector((-center.x, -center.y, -min_v.z))
    for obj in objects:
        obj.location += offset
    bpy.context.view_layer.update()


def normalize_names(asset: dict, objects: list[bpy.types.Object]) -> None:
    slug = asset["slug"].replace("-", "_")
    for index, obj in enumerate(objects):
        obj.name = f"meshy_cc0_{slug}_mesh_{index:02d}"
        obj.data.name = f"meshy_cc0_{slug}_geometry_{index:02d}"
        obj["deskterior_source_slug"] = asset["slug"]
        obj["deskterior_source_license"] = asset.get("license", "CC0-1.0")

    for index, material in enumerate(bpy.data.materials):
        material.name = f"meshy_cc0_{slug}_mat_{index:02d}"
        material.use_nodes = True
        bsdf = material.node_tree.nodes.get("Principled BSDF") if material.node_tree else None
        if not bsdf:
            continue
        if "Roughness" in bsdf.inputs:
            bsdf.inputs["Roughness"].default_value = max(float(bsdf.inputs["Roughness"].default_value), 0.36)
        if "Metallic" in bsdf.inputs:
            bsdf.inputs["Metallic"].default_value = min(float(bsdf.inputs["Metallic"].default_value), 0.45)


def triangle_count(objects: list[bpy.types.Object]) -> int:
    total = 0
    for obj in objects:
        mesh = obj.data
        total += sum(max(len(poly.vertices) - 2, 1) for poly in mesh.polygons)
    return total


def vertex_count(objects: list[bpy.types.Object]) -> int:
    return sum(len(obj.data.vertices) for obj in objects)


def material_count(objects: list[bpy.types.Object]) -> int:
    names: set[str] = set()
    for obj in objects:
        for slot in obj.material_slots:
            if slot.material:
                names.add(slot.material.name)
    return len(names)


def image_summary() -> list[dict]:
    images: list[dict] = []
    for image in bpy.data.images:
        if image.name == "Render Result":
            continue
        width = int(image.size[0]) if image.size else 0
        height = int(image.size[1]) if image.size else 0
        images.append({"name": image.name, "width": width, "height": height})
    return images


def add_review_lighting_and_camera(objects: list[bpy.types.Object]) -> None:
    min_v, max_v = world_bounds(objects)
    size = max_v - min_v
    radius = max(size.x, size.y, size.z, 0.25)

    bpy.ops.object.light_add(type="AREA", location=(radius * 0.7, -radius * 1.8, radius * 1.5))
    key = bpy.context.object
    key.name = "review_key_softbox"
    key.data.energy = 160
    key.data.size = radius * 2.5

    bpy.ops.object.light_add(type="AREA", location=(-radius * 1.2, radius * 1.1, radius * 1.0))
    fill = bpy.context.object
    fill.name = "review_cool_fill"
    fill.data.energy = 42
    fill.data.size = radius * 3.0
    fill.data.color = (0.72, 0.82, 1.0)

    target = Vector((0, 0, max(size.z * 0.45, 0.12)))
    location = Vector((radius * 1.15, -radius * 1.85, radius * 0.9))
    direction = target - location
    rotation = direction.to_track_quat("-Z", "Y").to_euler()
    bpy.ops.object.camera_add(location=location, rotation=rotation)
    camera = bpy.context.object
    camera.name = "review_camera"
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = max(radius * 1.62, 0.4)
    bpy.context.scene.camera = camera


def render_thumbnail(path: Path) -> None:
    configure_color()
    bpy.context.scene.render.resolution_x = 512
    bpy.context.scene.render.resolution_y = 512
    bpy.context.scene.eevee.taa_render_samples = 64
    bpy.context.scene.render.film_transparent = False
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


def normalize_one(repo_root: Path, output_root: Path, registry: dict, asset: dict) -> dict:
    clear_scene()
    source_path = repo_root / registry["sourceRoot"] / asset["file"]
    if not source_path.exists():
        raise FileNotFoundError(f"Missing source GLB: {source_path}")

    bpy.ops.import_scene.gltf(filepath=str(source_path))
    objects = mesh_objects()
    if not objects:
        raise RuntimeError(f"No mesh objects found in {source_path}")

    before_dimensions = dimensions_mm(objects)
    center_on_floor(objects)
    normalize_names(asset, objects)
    after_dimensions = dimensions_mm(objects)

    out_dir = output_root / asset["slug"]
    out_dir.mkdir(parents=True, exist_ok=True)
    output_glb = out_dir / f"{asset['slug']}.normalized.glb"
    thumbnail = out_dir / f"{asset['slug']}.thumbnail.webp"
    sidecar = out_dir / f"{asset['slug']}.runtime-candidate.json"

    add_review_lighting_and_camera(objects)
    render_thumbnail(thumbnail)
    export_glb(output_glb)

    tri_count = triangle_count(objects)
    vert_count = vertex_count(objects)
    mat_count = material_count(objects)
    warnings: list[str] = []
    if tri_count > 20000:
        warnings.append("TRIANGLE_COUNT_OVER_REVIEW_BUDGET")
    if mat_count > 8:
        warnings.append("MATERIAL_COUNT_OVER_REVIEW_BUDGET")

    output_bytes = output_glb.stat().st_size
    thumbnail_bytes = thumbnail.stat().st_size if thumbnail.exists() else 0
    candidate = {
        "schemaVersion": "deskterior-runtime-candidate-v1",
        "assetPack": registry["assetPack"],
        "slug": asset["slug"],
        "label": asset["slug"].replace("-", " ").title(),
        "source": {
            "kind": "meshy_community_public_cc0",
            "sourceGlb": str(source_path.relative_to(repo_root)),
            "pageUrl": asset.get("pageUrl"),
            "publicTaskApi": asset.get("publicTaskApi"),
            "license": asset.get("license", "CC0-1.0"),
        },
        "files": {
            "normalizedGlb": str(output_glb.relative_to(repo_root)),
            "thumbnail": str(thumbnail.relative_to(repo_root)),
            "sidecar": str(sidecar.relative_to(repo_root)),
        },
        "dimensionsMm": after_dimensions,
        "scaleLocked": True,
        "contractMetadata": {
            "pivot": {"x": "center", "y": "floor", "z": "center"},
            "collisionProxy": {"kind": "box", "derivesFrom": "dimensionsMm"},
            "textureSet": {
                "workflow": "pbr_metallic_roughness",
                "authored": "image_based",
                "ktx2Ready": False,
            },
            "lodProfile": {
                "strategy": "single_mesh",
                "levelCount": 1,
                "maxDrawCalls": max(mat_count, 1),
                "maxTriangleCount": tri_count,
            },
        },
        "qa": {
            "status": "candidate_requires_human_visual_review",
            "warnings": warnings,
            "beforeDimensionsMm": before_dimensions,
            "afterDimensionsMm": after_dimensions,
            "triangles": tri_count,
            "vertices": vert_count,
            "materials": mat_count,
            "images": image_summary(),
            "normalizedExportBytesBeforeMeshopt": output_bytes,
            "thumbnailBytes": thumbnail_bytes,
        },
    }
    write_json(sidecar, candidate)
    return candidate


def main() -> None:
    args = parse_args()
    repo_root = Path(args.repo_root).resolve()
    registry_path = Path(args.registry).resolve()
    output_root = Path(args.output_root).resolve()
    report_path = Path(args.report).resolve()
    registry = read_json(registry_path)

    candidates = []
    errors = []
    for asset in registry.get("assets", []):
        try:
            candidates.append(normalize_one(repo_root, output_root, registry, asset))
        except Exception as error:
            errors.append({"slug": asset.get("slug", asset.get("file", "unknown")), "error": str(error)})

    report = {
        "schemaVersion": "deskterior-meshy-community-normalization-report-v1",
        "sourceRegistry": str(registry_path.relative_to(repo_root)),
        "outputRoot": str(output_root.relative_to(repo_root)),
        "candidateCount": len(candidates),
        "errorCount": len(errors),
        "candidates": candidates,
        "errors": errors,
        "promotionStatus": "not-published",
        "nextRequiredChecks": [
            "Run glTF Transform meshopt/dedup/prune on normalized outputs.",
            "Review thumbnails and final room screenshot for visual fit.",
            "Create production catalog metadata only after human QA accepts style, scale, and material response.",
        ],
    }
    write_json(report_path, report)
    if errors:
        raise RuntimeError(json.dumps(errors, indent=2))


if __name__ == "__main__":
    main()
