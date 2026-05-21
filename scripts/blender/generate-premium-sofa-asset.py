#!/usr/bin/env python3
"""Generate a standalone dark lounge sofa GLB for the PC room QA scene."""

from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path

import bpy


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-root", required=True)
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else sys.argv[1:]
    return parser.parse_args(argv)


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    bpy.context.scene.unit_settings.system = "METRIC"
    bpy.context.scene.render.engine = "BLENDER_EEVEE_NEXT"
    world = bpy.context.scene.world or bpy.data.worlds.new("World")
    bpy.context.scene.world = world
    world.color = (0.02, 0.022, 0.03)


def to_blender_loc(loc: tuple[float, float, float]) -> tuple[float, float, float]:
    return (loc[0], -loc[2], loc[1])


def to_blender_size(size: tuple[float, float, float]) -> tuple[float, float, float]:
    return (size[0], size[2], size[1])


def mat(name: str, color: tuple[float, float, float, float], roughness: float, metallic: float = 0.0) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = color
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Metallic"].default_value = metallic
    return material


def rounded_block(
    name: str,
    size: tuple[float, float, float],
    loc: tuple[float, float, float],
    material: bpy.types.Material,
    bevel: float,
    segments: int = 8,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=to_blender_loc(loc))
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = to_blender_size(size)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel > 0:
        modifier = obj.modifiers.new(name=f"{name}_soft_bevel", type="BEVEL")
        modifier.width = bevel
        modifier.segments = segments
        modifier.affect = "EDGES"
        obj.modifiers.new(name=f"{name}_weighted_normals", type="WEIGHTED_NORMAL")
    obj.data.materials.append(material)
    return obj


def sphere(
    name: str,
    loc: tuple[float, float, float],
    scale: tuple[float, float, float],
    material: bpy.types.Material,
    segments: int = 24,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=max(8, segments // 2), radius=1, location=to_blender_loc(loc))
    obj = bpy.context.object
    obj.name = name
    obj.scale = to_blender_size(scale)
    obj.data.materials.append(material)
    obj.modifiers.new(name=f"{name}_weighted_normals", type="WEIGHTED_NORMAL")
    return obj


def add_scene_lights() -> None:
    bpy.ops.object.light_add(type="AREA", location=(0.5, -3.5, 4.0))
    key = bpy.context.object
    key.name = "preview_warm_softbox"
    key.data.energy = 280
    key.data.size = 4.5
    bpy.ops.object.light_add(type="POINT", location=(-2.2, -1.2, 1.6))
    rim = bpy.context.object
    rim.name = "preview_cool_rim"
    rim.data.energy = 60
    rim.data.color = (0.45, 0.65, 1.0)


def build_sofa() -> None:
    fabric = mat("premium_sofa_deep_navy_fabric", (0.035, 0.055, 0.09, 1), 0.93)
    fabric_lift = mat("premium_sofa_lifted_cushion_fabric", (0.06, 0.09, 0.145, 1), 0.94)
    seam = mat("premium_sofa_shadowed_seam_welt", (0.014, 0.02, 0.032, 1), 0.96)
    throw = mat("premium_sofa_muted_blue_wool_throw", (0.18, 0.27, 0.4, 1), 0.95)
    linen = mat("premium_sofa_warm_linen_pillow", (0.62, 0.56, 0.52, 1), 0.9)
    metal = mat("premium_sofa_blackened_metal_feet", (0.02, 0.022, 0.026, 1), 0.55, 0.32)

    rounded_block("premium_sofa_single_piece_shadow_plinth", (1.64, 0.18, 0.68), (0, 0.13, 0), seam, 0.08, 10)
    rounded_block("premium_sofa_soft_bench_base", (1.58, 0.32, 0.7), (0, 0.3, 0), fabric, 0.13, 12)
    rounded_block("premium_sofa_left_seat_cushion_crowned", (0.72, 0.09, 0.56), (-0.36, 0.5, -0.12), fabric_lift, 0.065, 10)
    rounded_block("premium_sofa_right_seat_cushion_crowned", (0.72, 0.09, 0.56), (0.36, 0.5, -0.12), fabric_lift, 0.065, 10)
    rounded_block("premium_sofa_center_cushion_shadow_gap", (0.026, 0.035, 0.56), (0, 0.56, -0.12), seam, 0.006, 3)

    rounded_block("premium_sofa_rear_wrapped_upholstery_panel", (1.58, 0.56, 0.12), (0, 0.63, 0.42), fabric, 0.075, 12)
    rounded_block("premium_sofa_rear_top_rolled_crown", (1.5, 0.08, 0.13), (0, 0.94, 0.43), fabric_lift, 0.045, 10)
    rounded_block("premium_sofa_rear_bottom_shadow_skirt", (1.52, 0.045, 0.055), (0, 0.37, 0.46), seam, 0.014, 4)
    rounded_block("premium_sofa_left_rolled_arm", (0.28, 0.46, 0.68), (-0.92, 0.43, -0.02), fabric, 0.095, 12)
    rounded_block("premium_sofa_right_rolled_arm", (0.28, 0.46, 0.68), (0.92, 0.43, -0.02), fabric, 0.095, 12)

    for x in (-0.48, 0.0, 0.48):
        rounded_block(f"premium_sofa_rear_vertical_tailored_welt_{x}", (0.018, 0.38, 0.026), (x, 0.66, 0.495), seam, 0.006, 3)
    for y in (0.58, 0.77):
        rounded_block(f"premium_sofa_rear_horizontal_tailored_welt_{y}", (1.22, 0.016, 0.024), (0, y, 0.505), seam, 0.006, 3)
    for x in (-0.35, 0.35):
        for y in (0.63, 0.82):
            sphere(f"premium_sofa_rear_recessed_fabric_button_{x}_{y}", (x, y, 0.525), (0.028, 0.01, 0.018), seam, 18)

    rounded_block("premium_sofa_folded_blue_throw_over_back", (0.76, 0.045, 0.18), (0.12, 0.975, 0.39), throw, 0.035, 8)
    for x in (-0.1, 0.1, 0.3):
        rounded_block(f"premium_sofa_throw_raised_woven_thread_{x}", (0.016, 0.018, 0.16), (x, 1.003, 0.39), seam, 0.004, 2)
    rounded_block("premium_sofa_muted_blue_pillow", (0.48, 0.3, 0.08), (-0.42, 0.73, 0.18), throw, 0.055, 9)
    rounded_block("premium_sofa_warm_linen_pillow", (0.42, 0.27, 0.08), (0.42, 0.7, 0.18), linen, 0.05, 9)

    for x in (-0.64, 0.64):
        for z in (-0.26, 0.36):
            rounded_block(f"premium_sofa_tapered_black_leg_{x}_{z}", (0.055, 0.16, 0.055), (x, 0.04, z), metal, 0.018, 6)
            sphere(f"premium_sofa_round_floor_glide_{x}_{z}", (x, -0.045, z), (0.05, 0.012, 0.05), metal, 16)


def export_asset(repo_root: Path) -> None:
    public_dir = repo_root / "apps/web/public/assets/models/p2s_premium_dark_sofa"
    blend_dir = repo_root / "assets/blender/deskterior"
    public_dir.mkdir(parents=True, exist_ok=True)
    blend_dir.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_dir / "p2s_premium_dark_sofa.blend"))
    bpy.ops.export_scene.gltf(
        filepath=str(public_dir / "p2s_premium_dark_sofa.glb"),
        export_format="GLB",
        export_yup=True,
        export_materials="EXPORT",
        export_apply=True,
        export_animations=False,
    )


def main() -> None:
    args = parse_args()
    clear_scene()
    build_sofa()
    add_scene_lights()
    export_asset(Path(args.repo_root))


if __name__ == "__main__":
    main()
