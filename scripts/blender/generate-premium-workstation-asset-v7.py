#!/usr/bin/env python3
"""Generate workstation candidate v7 by fixing V6's overdrawn desktop seams."""

from __future__ import annotations

import argparse
import importlib.util
import json
import struct
import sys
from collections import Counter
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


v6 = load_script("premium_workstation_v6", Path(__file__).with_name("generate-premium-workstation-asset-v6.py"))
v5 = v6.v5
v4 = v6.v4
v3 = v6.v3
v2 = v6.v2
base = v6.base


def detail_materials_v7() -> dict[str, bpy.types.Material]:
    mats = v6.detail_materials()
    mats["edge_oak"] = base.mat("premium_workstation_v7_subtle_oak_seam", (0.24, 0.135, 0.065, 1), 0.82, 0.0)
    mats["paper_edge"] = base.mat("premium_workstation_v7_muted_key_legend", (0.42, 0.39, 0.34, 1), 0.84, 0.0)
    mats["shadow"] = base.mat("premium_workstation_v7_micro_shadow", (0.004, 0.0035, 0.003, 1), 0.94, 0.0, 0.34)
    return mats


def add_desk_surface_and_cable_detail_v7(mats: dict[str, bpy.types.Material]) -> None:
    # V6 overcorrected: the desktop read as a graphic grid. V7 keeps wood plank
    # depth but removes cross-grid lines and lowers seam contrast.
    for i, z in enumerate([-0.21, -0.055, 0.1, 0.255, 0.395]):
        v6.rb("desk", f"premium_workstation_v7_desktop_subtle_plank_shadow_{i}", (2.05, 0.0035, 0.0045), (-0.18, 0.184, z), mats["edge_oak"], 0.0008, 1)
    v6.rb("desk", "premium_workstation_v7_desk_front_oak_roundover", (2.2, 0.022, 0.026), (-0.18, 0.162, 0.452), mats["edge_oak"], 0.006, 3)
    for i, y in enumerate([0.035, -0.06, -0.155]):
        v6.rb("desk", f"premium_workstation_v7_drawer_gap_shadow_{i}", (0.38, 0.006, 0.01), (-1.17, y + 0.21, 0.428), mats["shadow"], 0.0015, 1)
        v6.rb("desk", f"premium_workstation_v7_drawer_slim_pull_{i}", (0.16, 0.01, 0.014), (-1.17, y + 0.22, 0.445), mats["silver"], 0.003, 2)
    v6.rb("cables", "premium_workstation_v7_underdesk_cable_tray_front_rail", (1.1, 0.028, 0.042), (-0.18, 0.045, 0.5), mats["metal"], 0.005, 2)
    for i, x in enumerate([-0.62, -0.28, 0.06, 0.4]):
        v6.rb("cables", f"premium_workstation_v7_underdesk_cable_tray_slat_{i}", (0.022, 0.028, 0.17), (x, 0.046, 0.395), mats["metal"], 0.003, 2)
    for i, x in enumerate([-0.9, -0.38, 0.25, 0.9]):
        v6.rb("cables", f"premium_workstation_v7_adhesive_cable_clip_{i}", (0.046, 0.022, 0.022), (x, 0.165, -0.42), mats["matte_white"], 0.005, 3)
        v6.cable("cables", f"premium_workstation_v7_managed_rear_cable_{i}", [(x, 0.17, -0.405), (x + 0.06, 0.12, -0.52), (x + 0.18, 0.08, -0.56)], mats["soft_black"], 0.004)


def rename_v6_detail_prefix() -> None:
    remapped: dict[str, str] = {}
    for obj in bpy.context.scene.objects:
        if not obj.name.startswith("premium_workstation_v6_"):
            continue
        old = obj.name
        obj.name = old.replace("premium_workstation_v6_", "premium_workstation_v7_", 1)
        remapped[old] = obj.name
    if remapped:
        v6.DETAIL_CATEGORY = {remapped.get(name, name): category for name, category in v6.DETAIL_CATEGORY.items()}


def ensure_detail_uvs_v7() -> int:
    count = 0
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH" or not obj.name.startswith("premium_workstation_v7_"):
            continue
        mesh = obj.data
        uv_layer = mesh.uv_layers.get("DetailUV") or mesh.uv_layers.new(name="DetailUV")
        lightmap = mesh.uv_layers.get("LightmapUV2") or mesh.uv_layers.new(name="LightmapUV2")
        min_x = min(v.co.x for v in mesh.vertices)
        max_x = max(v.co.x for v in mesh.vertices)
        min_y = min(v.co.y for v in mesh.vertices)
        max_y = max(v.co.y for v in mesh.vertices)
        for poly in mesh.polygons:
            for loop_index in poly.loop_indices:
                co = mesh.vertices[mesh.loops[loop_index].vertex_index].co
                u = (co.x - min_x) / max(max_x - min_x, 0.0001)
                v = (co.y - min_y) / max(max_y - min_y, 0.0001)
                uv_layer.data[loop_index].uv = (u, v)
                lightmap.data[loop_index].uv = (u * 0.92 + 0.04, v * 0.92 + 0.04)
        count += 1
    return count


def write_runtime_sidecars(repo_root: Path, glb_relative: str) -> dict[str, str]:
    public_dir = repo_root / "apps/web/public/assets/models/p2s_premium_workstation_hero_v7"
    colliders = {
        "assetId": "p2s_premium_workstation_hero_v7",
        "model": glb_relative,
        "colliders": [
            {"id": "desk_volume", "type": "box", "center": [-0.18, 0.11, 0.1], "size": [2.32, 0.28, 0.78]},
            {"id": "pc_tower_volume", "type": "box", "center": [1.24, 0.39, -0.08], "size": [0.62, 0.82, 0.48]},
            {"id": "monitor_volume", "type": "box", "center": [-0.48, 0.56, -0.24], "size": [1.18, 0.74, 0.13]},
            {"id": "tabletop_prop_volume", "type": "box", "center": [-0.3, 0.2, 0.12], "size": [1.75, 0.22, 0.58]},
        ],
    }
    support = {
        "assetId": "p2s_premium_workstation_hero_v7",
        "supportSurfaces": [
            {"id": "desktop", "type": "horizontal", "center": [-0.18, 0.188, 0.1], "size": [2.2, 0.66], "normal": [0, 1, 0]},
            {"id": "pc_top", "type": "horizontal", "center": [1.24, 0.8, -0.08], "size": [0.5, 0.38], "normal": [0, 1, 0]},
        ],
    }
    files = {
        "colliders": public_dir / "p2s_premium_workstation_hero_v7.colliders.json",
        "supportSurfaces": public_dir / "p2s_premium_workstation_hero_v7.support-surfaces.json",
    }
    files["colliders"].write_text(json.dumps(colliders, indent=2), encoding="utf-8")
    files["supportSurfaces"].write_text(json.dumps(support, indent=2), encoding="utf-8")
    return {key: str(path.relative_to(repo_root)) for key, path in files.items()}


def glb_audit(path: Path) -> dict[str, object]:
    data = path.read_bytes()
    offset = 12
    json_chunk = None
    while offset < len(data):
        length, chunk_type = struct.unpack_from("<II", data, offset)
        offset += 8
        chunk = data[offset : offset + length]
        offset += length
        if chunk_type == 0x4E4F534A:
            json_chunk = json.loads(chunk.decode("utf-8"))
            break
    if not json_chunk:
        return {}
    return {
        "nodes": len(json_chunk.get("nodes", [])),
        "meshes": len(json_chunk.get("meshes", [])),
        "materials": len(json_chunk.get("materials", [])),
        "images": len(json_chunk.get("images", [])),
        "textures": len(json_chunk.get("textures", [])),
        "extensionsUsed": json_chunk.get("extensionsUsed", []),
    }


def save_and_render(
    repo_root: Path,
    atlas_count: int,
    active_uv_count: int,
    ao_count: int,
    detail_uv_count: int,
    atlas_paths: dict[str, str],
) -> None:
    public_dir = repo_root / "apps/web/public/assets/models/p2s_premium_workstation_hero_v7"
    blend_dir = repo_root / "assets/blender/deskterior"
    review_dir = repo_root / "assets/references/blender-authored/premium-workstation-hero"
    preview_dir = review_dir / "v7-previews"
    public_dir.mkdir(parents=True, exist_ok=True)
    blend_dir.mkdir(parents=True, exist_ok=True)
    preview_dir.mkdir(parents=True, exist_ok=True)

    blend_path = blend_dir / "p2s_premium_workstation_hero_v7.blend"
    glb_path = public_dir / "p2s_premium_workstation_hero_v7.glb"
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
    bpy.ops.export_scene.gltf(
        filepath=str(glb_path),
        export_format="GLB",
        export_yup=True,
        export_materials="EXPORT",
        export_apply=True,
        export_animations=False,
    )
    sidecars = write_runtime_sidecars(repo_root, str(glb_path.relative_to(repo_root)))

    v2.setup_render_scene()
    bpy.context.scene.view_settings.exposure = -0.03
    v2.render_preview(preview_dir / "workstation-v7-isometric.png", "preview_v7_iso_camera", (2.55, 1.25, 2.05), (0.02, 0.08, 0.0), 3.35)
    v2.render_preview(preview_dir / "workstation-v7-tabletop-closeup.png", "preview_v7_tabletop_camera", (0.68, 0.78, 0.82), (-0.46, 0.22, 0.15), 1.08)
    v2.render_preview(preview_dir / "workstation-v7-input-devices-closeup.png", "preview_v7_input_camera", (0.2, 0.54, 0.72), (-0.48, 0.2, 0.12), 0.72)
    v2.render_preview(preview_dir / "workstation-v7-monitor-audio-closeup.png", "preview_v7_monitor_audio_camera", (-1.38, 0.77, 0.55), (-0.74, 0.42, -0.17), 0.9)

    stats = base.mesh_stats()
    stats["textureImages"] = len([image for image in bpy.data.images if image.packed_file or image.filepath])
    stats["glbBytes"] = glb_path.stat().st_size
    stats["atlasAssignedMeshObjects"] = atlas_count
    stats["activeUvAtlasMeshObjects"] = active_uv_count
    stats["bakedContactAoDecals"] = ao_count
    stats["detailUvMeshObjects"] = detail_uv_count
    stats["lightmapUv2ReadyMeshObjects"] = sum(
        1 for obj in bpy.context.scene.objects if obj.type == "MESH" and obj.data.uv_layers.get("LightmapUV2")
    )

    review = {
        "asset": "p2s_premium_workstation_hero_v7",
        "status": "standalone-generated-review-required",
        "sourceBlend": str(blend_path.relative_to(repo_root)),
        "publicGlb": str(glb_path.relative_to(repo_root)),
        "previewImages": [
            str((preview_dir / "workstation-v7-isometric.png").relative_to(repo_root)),
            str((preview_dir / "workstation-v7-tabletop-closeup.png").relative_to(repo_root)),
            str((preview_dir / "workstation-v7-input-devices-closeup.png").relative_to(repo_root)),
            str((preview_dir / "workstation-v7-monitor-audio-closeup.png").relative_to(repo_root)),
        ],
        "atlasArtifacts": atlas_paths,
        "runtimeSidecars": sidecars,
        "metrics": stats,
        "glbAudit": glb_audit(glb_path),
        "desktopDetailPass": {
            "detailObjectCount": len(v6.DETAIL_CATEGORY),
            "categories": dict(sorted(Counter(v6.DETAIL_CATEGORY.values()).items())),
        },
        "iterationNotes": {
            "v6DefectTargeted": "V6 improved object detail but made the tabletop seams too bright and grid-like.",
            "v7Changes": [
                "Removed cross-grid desktop seams.",
                "Lowered plank seam contrast and width.",
                "Kept V6 per-object micro-detail, V5 UVAtlas fix, runtime sidecars, and PC internal detail.",
            ],
        },
        "stillRequires": [
            "human visual approval against commercial references",
            "hand-authored texture polish beyond generated/procedural maps",
            "true renderer-baked GI/lightmap pass",
            "runtime LOD/proxy GLB package before live catalog promotion",
            "scene integration only after standalone approval",
        ],
    }
    (review_dir / "asset-review-v7-2026-05-20.json").write_text(json.dumps(review, indent=2), encoding="utf-8")


def main() -> None:
    args = parse_args()
    repo_root = Path(args.repo_root)
    review_dir = repo_root / "assets/references/blender-authored/premium-workstation-hero"
    review_dir.mkdir(parents=True, exist_ok=True)

    v6.DETAIL_CATEGORY.clear()
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

    basecolor = v4.make_atlas_image("premium_workstation_v7_basecolor_atlas_1024", v5.refined_color_for_region, 1024)
    orm = v4.make_atlas_image("premium_workstation_v7_orm_atlas_1024", v4.orm_for_region, 1024)
    basecolor_path = review_dir / "workstation-v7-basecolor-atlas.png"
    orm_path = review_dir / "workstation-v7-orm-atlas.png"
    v4.save_image(basecolor, basecolor_path)
    v4.save_image(orm, orm_path)

    atlas_material = v5.create_uv_atlas_material(basecolor, orm)
    atlas_material.name = "premium_workstation_v7_shared_uv_pbr_atlas"
    atlas_count = v4.apply_atlas(atlas_material)
    active_uv_count = v5.enforce_uv_atlas_active()

    mats = detail_materials_v7()
    v6.add_monitor_and_display_detail(mats)
    v6.add_keyboard_mouse_detail(mats)
    v6.add_audio_lighting_detail(mats)
    add_desk_surface_and_cable_detail_v7(mats)
    v6.add_small_props_detail(mats)
    rename_v6_detail_prefix()
    detail_uv_count = ensure_detail_uvs_v7()

    ao_count = v4.add_baked_contact_occlusion(materials)
    save_and_render(
        repo_root,
        atlas_count,
        active_uv_count,
        ao_count,
        detail_uv_count,
        {
            "basecolor": str(basecolor_path.relative_to(repo_root)),
            "orm": str(orm_path.relative_to(repo_root)),
        },
    )


if __name__ == "__main__":
    main()
