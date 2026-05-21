#!/usr/bin/env python3
"""Generate workstation candidate v5 with corrected UVAtlas sampling.

V4 created the right package artifacts, but the material did not explicitly
sample the generated UVAtlas channel. That made surfaces read from unrelated
UVs and produced a patchwork look. V5 keeps the UV/PBR/AO/internal-detail work
while making the visible material sample UVAtlas intentionally.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import math
import sys
from pathlib import Path

import bpy


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-root", required=True)
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else sys.argv[1:]
    return parser.parse_args(argv)


def load_script(name: str, path: Path):
    spec = importlib.util.spec_from_file_location(name, path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to import script: {path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


v4 = load_script("premium_workstation_v4", Path(__file__).with_name("generate-premium-workstation-asset-v4.py"))
v3 = v4.v3
v2 = v4.v2
base = v4.base


def refined_color_for_region(region: str, u: float, v: float) -> tuple[float, float, float, float]:
    if region == "wood":
        grain = 0.5 + 0.5 * math.sin((u * 18 + v * 34 + math.sin(u * 9) * 0.18) * math.pi)
        plank = 0.92 + (int(v * 8) % 3) * 0.018
        return (0.47 * plank + grain * 0.075, 0.285 * plank + grain * 0.04, 0.155 * plank + grain * 0.026, 1)
    if region == "deskmat":
        weave = 0.018 * (math.sin(u * math.tau * 60) > 0) + 0.012 * (math.sin(v * math.tau * 42) > 0)
        return (0.018 + weave, 0.026 + weave, 0.033 + weave, 1)
    if region == "case_white":
        edge = min(u, v, 1 - u, 1 - v)
        panel = 0.81 + edge * 0.08 + 0.012 * math.sin((u + v) * math.tau * 4)
        return (panel, panel * 1.01, panel * 0.985, 1)
    if region == "graphite_mesh":
        hole = 0.055 if (int(u * 34) + int(v * 24)) % 2 == 0 else 0.01
        return (0.025 + hole, 0.029 + hole, 0.035 + hole, 1)
    if region == "screen":
        if 0.11 < u < 0.9 and 0.15 < v < 0.2:
            return (0.78, 0.54, 0.34, 1)
        if 0.12 < u < 0.46 and 0.64 < v < 0.71:
            return (0.22, 0.48, 0.62, 1)
        if 0.52 < u < 0.78 and 0.43 < v < 0.5:
            return (0.68, 0.42, 0.4, 1)
        return (0.02 + v * 0.045, 0.035 + u * 0.026, 0.05 + v * 0.055, 1)
    if region == "pcb":
        trace = 0.035 if abs((u * 16) % 1 - 0.5) < 0.035 or abs((v * 13) % 1 - 0.5) < 0.03 else 0
        return (0.78 + trace, 0.8 + trace, 0.765 + trace * 0.45, 1)
    if region == "rubber":
        return (0.018 + u * 0.011, 0.02 + v * 0.011, 0.024 + u * 0.012, 1)
    if region == "paper":
        fiber = 0.016 * math.sin(u * math.tau * 13) + 0.012 * math.sin(v * math.tau * 19)
        return (0.82 + fiber, 0.775 + fiber, 0.685 + fiber, 1)
    # label: keep the accent band subtle; V4 was too graphic when sampled incorrectly.
    stripe = int(u * 10) % 5
    palette = [
        (0.64, 0.45, 0.28, 1),
        (0.34, 0.52, 0.62, 1),
        (0.63, 0.42, 0.44, 1),
        (0.74, 0.71, 0.62, 1),
        (0.2, 0.24, 0.27, 1),
    ]
    return palette[stripe]


def create_uv_atlas_material(basecolor: bpy.types.Image, orm: bpy.types.Image) -> bpy.types.Material:
    material = bpy.data.materials.new("premium_workstation_v5_shared_uv_pbr_atlas")
    material.use_nodes = True
    nodes = material.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")
    if not bsdf:
        return material

    uv = nodes.new(type="ShaderNodeUVMap")
    uv.name = "v5_use_explicit_uv_atlas"
    uv.uv_map = "UVAtlas"

    color_tex = nodes.new(type="ShaderNodeTexImage")
    color_tex.name = "v5_basecolor_atlas_texture"
    color_tex.image = basecolor
    material.node_tree.links.new(uv.outputs["UV"], color_tex.inputs["Vector"])
    material.node_tree.links.new(color_tex.outputs["Color"], bsdf.inputs["Base Color"])

    orm_tex = nodes.new(type="ShaderNodeTexImage")
    orm_tex.name = "v5_orm_atlas_texture"
    orm_tex.image = orm
    material.node_tree.links.new(uv.outputs["UV"], orm_tex.inputs["Vector"])
    sep = nodes.new(type="ShaderNodeSeparateColor")
    material.node_tree.links.new(orm_tex.outputs["Color"], sep.inputs["Color"])
    if "Roughness" in bsdf.inputs:
        material.node_tree.links.new(sep.outputs["Green"], bsdf.inputs["Roughness"])
    if "Metallic" in bsdf.inputs:
        material.node_tree.links.new(sep.outputs["Blue"], bsdf.inputs["Metallic"])
    return material


def enforce_uv_atlas_active() -> int:
    count = 0
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH":
            continue
        uv_layer = obj.data.uv_layers.get("UVAtlas")
        if not uv_layer:
            continue
        obj.data.uv_layers.active = uv_layer
        if hasattr(uv_layer, "active_render"):
            uv_layer.active_render = True
        count += 1
    return count


def save_and_render(repo_root: Path, atlas_count: int, active_uv_count: int, ao_count: int, atlas_paths: dict[str, str]) -> None:
    public_dir = repo_root / "apps/web/public/assets/models/p2s_premium_workstation_hero_v5"
    blend_dir = repo_root / "assets/blender/deskterior"
    review_dir = repo_root / "assets/references/blender-authored/premium-workstation-hero"
    preview_dir = review_dir / "v5-previews"
    public_dir.mkdir(parents=True, exist_ok=True)
    blend_dir.mkdir(parents=True, exist_ok=True)
    preview_dir.mkdir(parents=True, exist_ok=True)

    blend_path = blend_dir / "p2s_premium_workstation_hero_v5.blend"
    glb_path = public_dir / "p2s_premium_workstation_hero_v5.glb"
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
    bpy.ops.export_scene.gltf(
        filepath=str(glb_path),
        export_format="GLB",
        export_yup=True,
        export_materials="EXPORT",
        export_apply=True,
        export_animations=False,
    )

    v2.setup_render_scene()
    bpy.context.scene.view_settings.exposure = -0.04
    v2.render_preview(preview_dir / "workstation-v5-isometric.png", "preview_v5_iso_camera", (2.55, 1.25, 2.05), (0.02, 0.08, 0.0), 3.35)
    v2.render_preview(preview_dir / "workstation-v5-pc-internals-closeup.png", "preview_v5_pc_internals_camera", (0.58, 0.78, 0.68), (1.08, 0.44, 0.055), 0.86)
    v2.render_preview(preview_dir / "workstation-v5-tabletop-closeup.png", "preview_v5_tabletop_camera", (0.75, 0.82, 1.05), (-0.42, 0.22, 0.02), 1.36)

    stats = base.mesh_stats()
    stats["textureImages"] = len([image for image in bpy.data.images if image.packed_file or image.filepath])
    stats["glbBytes"] = glb_path.stat().st_size
    stats["atlasAssignedMeshObjects"] = atlas_count
    stats["activeUvAtlasMeshObjects"] = active_uv_count
    stats["bakedContactAoDecals"] = ao_count
    stats["lightmapUv2ReadyMeshObjects"] = sum(
        1 for obj in bpy.context.scene.objects if obj.type == "MESH" and obj.data.uv_layers.get("LightmapUV2")
    )

    review = {
        "asset": "p2s_premium_workstation_hero_v5",
        "status": "standalone-generated-review-required",
        "sourceBlend": str(blend_path.relative_to(repo_root)),
        "publicGlb": str(glb_path.relative_to(repo_root)),
        "previewImages": [
            str((preview_dir / "workstation-v5-isometric.png").relative_to(repo_root)),
            str((preview_dir / "workstation-v5-pc-internals-closeup.png").relative_to(repo_root)),
            str((preview_dir / "workstation-v5-tabletop-closeup.png").relative_to(repo_root)),
        ],
        "atlasArtifacts": atlas_paths,
        "metrics": stats,
        "iterationNotes": {
            "v4DefectTargeted": "V4 generated UV/PBR artifacts but did not force the shader to sample UVAtlas, causing visible atlas patchwork.",
            "v5Changes": [
                "Shader now uses an explicit UV Map node bound to UVAtlas.",
                "UVAtlas is marked active/render-active on all assigned meshes.",
                "Atlas palette was reduced to product-like white, graphite, oak, paper, and subtle UI tones.",
                "V4 PC internals, LightmapUV2 coverage, and baked-style AO decals are preserved.",
            ],
        },
        "stillRequires": [
            "human visual approval against commercial references",
            "true hand-authored texture polish beyond generated atlas",
            "real renderer-baked lightmap if promotion requires static GI",
            "LOD/proxy/collider/support metadata before catalog promotion",
            "scene integration only after standalone approval",
        ],
    }
    (review_dir / "asset-review-v5-2026-05-20.json").write_text(json.dumps(review, indent=2), encoding="utf-8")


def main() -> None:
    args = parse_args()
    repo_root = Path(args.repo_root)
    review_dir = repo_root / "assets/references/blender-authored/premium-workstation-hero"
    review_dir.mkdir(parents=True, exist_ok=True)

    base.clear_scene()
    base.build_scene()
    base.add_preview_lights()
    materials = v3.safe_materials()
    v2.add_case_detail(materials)
    v2.add_desk_and_tabletop_detail(materials)
    v2.add_monitor_arm_and_lighting_detail(materials)
    v3.add_screen_ui(materials)
    v3.add_color_correction_detail(materials)
    v4.add_product_accurate_pc_internals(materials)
    v2.add_scene_floor()

    basecolor = v4.make_atlas_image("premium_workstation_v5_basecolor_atlas_1024", refined_color_for_region, 1024)
    orm = v4.make_atlas_image("premium_workstation_v5_orm_atlas_1024", v4.orm_for_region, 1024)
    basecolor_path = review_dir / "workstation-v5-basecolor-atlas.png"
    orm_path = review_dir / "workstation-v5-orm-atlas.png"
    v4.save_image(basecolor, basecolor_path)
    v4.save_image(orm, orm_path)

    atlas_material = create_uv_atlas_material(basecolor, orm)
    atlas_count = v4.apply_atlas(atlas_material)
    active_uv_count = enforce_uv_atlas_active()
    ao_count = v4.add_baked_contact_occlusion(materials)

    save_and_render(
        repo_root,
        atlas_count,
        active_uv_count,
        ao_count,
        {
            "basecolor": str(basecolor_path.relative_to(repo_root)),
            "orm": str(orm_path.relative_to(repo_root)),
        },
    )


if __name__ == "__main__":
    main()
