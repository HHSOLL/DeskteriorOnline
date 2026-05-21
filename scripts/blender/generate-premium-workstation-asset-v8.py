#!/usr/bin/env python3
"""Generate workstation candidate v8 with product-surface micro-detail.

V7 fixed the obvious tabletop seam regression. V8 targets the next visible
quality gap: desk objects still read as schematic props when viewed close-up.
"""

from __future__ import annotations

import argparse
import importlib.util
import json
import math
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


v7 = load_script("premium_workstation_v7", Path(__file__).with_name("generate-premium-workstation-asset-v7.py"))
v6 = v7.v6
v5 = v7.v5
v4 = v7.v4
v3 = v7.v3
v2 = v7.v2
base = v7.base


def color_for_region_v8(region: str, u: float, v: float) -> tuple[float, float, float, float]:
    if region == "wood":
        soft_grain = 0.5 + 0.5 * math.sin((u * 13.0 + v * 31.0 + math.sin(u * 17.0) * 0.12) * math.pi)
        pore = 0.016 * math.sin((u * 67.0 + v * 9.0) * math.tau)
        plank = 0.95 + (int(v * 7.0) % 3) * 0.012
        return (0.43 * plank + soft_grain * 0.06 + pore, 0.255 * plank + soft_grain * 0.035 + pore * 0.5, 0.142 * plank + soft_grain * 0.022, 1)
    if region == "screen":
        if 0.06 < u < 0.94 and 0.08 < v < 0.92:
            if abs(v - 0.82) < 0.008 or abs(u - 0.12) < 0.006:
                return (0.12, 0.18, 0.22, 1)
            if 0.16 < u < 0.42 and 0.58 < v < 0.64:
                return (0.22, 0.5, 0.63, 1)
            if 0.52 < u < 0.83 and 0.42 < v < 0.48:
                return (0.68, 0.43, 0.39, 1)
            if 0.18 < u < 0.86 and 0.18 < v < 0.24:
                return (0.72, 0.5, 0.31, 1)
        return (0.017 + v * 0.035, 0.029 + u * 0.024, 0.042 + v * 0.045, 1)
    return v5.refined_color_for_region(region, u, v)


def detail_materials_v8() -> dict[str, bpy.types.Material]:
    mats = v7.detail_materials_v7()
    mats.update(
        {
            "etched_label": base.mat("premium_workstation_v8_etched_label", (0.58, 0.58, 0.53, 1), 0.88, 0.0),
            "screen_glow": base.mat("premium_workstation_v8_screen_glow", (0.07, 0.13, 0.17, 1), 0.5, 0.0, 1.0, (0.08, 0.18, 0.24), 0.22),
            "status_cyan": base.mat("premium_workstation_v8_cyan_indicator", (0.2, 0.62, 0.72, 1), 0.45, 0.0, 1.0, (0.02, 0.34, 0.44), 0.35),
            "status_warm": base.mat("premium_workstation_v8_warm_indicator", (0.9, 0.58, 0.24, 1), 0.45, 0.0, 1.0, (0.52, 0.2, 0.04), 0.35),
            "case_shadow": base.mat("premium_workstation_v8_case_shadow_line", (0.015, 0.017, 0.018, 1), 0.9, 0.0),
            "rubber_edge": base.mat("premium_workstation_v8_rubber_edge", (0.012, 0.014, 0.016, 1), 0.86, 0.0),
            "brushed_trim": base.mat("premium_workstation_v8_brushed_trim", (0.38, 0.4, 0.39, 1), 0.32, 0.52),
        }
    )
    return mats


def add_v8_display_surface_details(mats: dict[str, bpy.types.Material]) -> None:
    # Layered interface details so monitors stop reading as flat black panels.
    for i, y in enumerate([0.745, 0.704, 0.663, 0.622]):
        v6.rb("display", f"premium_workstation_v8_main_monitor_timeline_lane_{i}", (0.52 - i * 0.04, 0.004, 0.007), (-0.48, y, -0.166), mats["screen_glow"], 0.001, 1)
        v6.rb("display", f"premium_workstation_v8_main_monitor_timeline_clip_{i}", (0.14, 0.005, 0.01), (-0.78 + i * 0.15, y - 0.018, -0.164), mats["status_cyan"] if i % 2 else mats["status_warm"], 0.001, 1)
    for i, x in enumerate([-0.84, -0.77, -0.7, -0.63, -0.56]):
        v6.rb("display", f"premium_workstation_v8_left_panel_micro_row_{i}", (0.045, 0.003, 0.006), (x, 0.42 + i * 0.022, -0.164), mats["etched_label"], 0.001, 1)
    for i in range(6):
        v6.rb("display", f"premium_workstation_v8_laptop_editor_line_{i}", (0.22 - i * 0.012, 0.003, 0.006), (0.33, 0.49 + i * 0.024, -0.152), mats["status_cyan"] if i in {1, 4} else mats["etched_label"], 0.001, 1, -0.1)
    v6.rb("monitor", "premium_workstation_v8_monitor_power_button_dot", (0.018, 0.006, 0.018), (-0.09, 0.302, -0.171), mats["status_warm"], 0.004, 3)


def add_v8_input_device_details(mats: dict[str, bpy.types.Material]) -> None:
    # Add more product-specific hierarchy on top of V6 legends.
    for col, x in enumerate([-0.89, -0.825, -0.76, -0.695, -0.63, -0.565, -0.5, -0.435, -0.37, -0.305]):
        v6.rb("keyboard", f"premium_workstation_v8_function_key_top_legend_{col}", (0.018, 0.0025, 0.0035), (x, 0.211, 0.0), mats["etched_label"], 0.001, 1, -0.04)
    for i, x in enumerate([-0.52, -0.455, -0.39]):
        v6.rb("keyboard", f"premium_workstation_v8_arrow_key_glyph_{i}", (0.016, 0.0025, 0.004), (x, 0.214, 0.246), mats["status_cyan"], 0.001, 1, -0.04)
    v6.rb("keyboard", "premium_workstation_v8_spacebar_subtle_wear", (0.26, 0.0025, 0.005), (-0.56, 0.216, 0.205), mats["etched_label"], 0.001, 1, -0.04)
    for i, x in enumerate([-0.89, -0.79, -0.69, -0.59, -0.49, -0.39, -0.29, -0.19]):
        v6.rb("keyboard", f"premium_workstation_v8_keyboard_case_fastener_{i}", (0.012, 0.002, 0.012), (x, 0.196, -0.018 if i % 2 == 0 else 0.268), mats["brushed_trim"], 0.004, 6, -0.04)

    v6.rb("mouse", "premium_workstation_v8_mouse_center_split_line", (0.006, 0.003, 0.112), (0.203, 0.221, 0.118), mats["case_shadow"], 0.001, 1, -0.05)
    v6.rb("mouse", "premium_workstation_v8_mouse_logo_inlay", (0.03, 0.0025, 0.026), (0.204, 0.223, 0.18), mats["status_cyan"], 0.004, 2, -0.05)
    v6.rb("mouse", "premium_workstation_v8_mouse_bottom_skate_front", (0.085, 0.002, 0.011), (0.203, 0.188, 0.075), mats["etched_label"], 0.002, 1, -0.05)
    v6.rb("mouse", "premium_workstation_v8_mouse_bottom_skate_back", (0.085, 0.002, 0.011), (0.203, 0.188, 0.205), mats["etched_label"], 0.002, 1, -0.05)


def add_v8_audio_and_pc_details(mats: dict[str, bpy.types.Material]) -> None:
    for side, x in [("left", -1.18), ("right", 0.72)]:
        for i, z in enumerate([-0.174, -0.148, -0.122, -0.096]):
            v6.rb("speaker", f"premium_workstation_v8_{side}_speaker_vertical_weave_{i}", (0.004, 0.245, 0.003), (x + z * 0.02, 0.305, z), mats["case_shadow"], 0.001, 1)
        v6.rb("speaker", f"premium_workstation_v8_{side}_speaker_rear_port_slot", (0.075, 0.022, 0.014), (x, 0.415, -0.184), mats["soft_black"], 0.004, 1)
        v6.rb("speaker", f"premium_workstation_v8_{side}_speaker_status_led", (0.018, 0.006, 0.018), (x + 0.035, 0.205, -0.104), mats["status_cyan"], 0.004, 3)

    for i, y in enumerate([0.665, 0.705, 0.745]):
        v6.rb("display", f"premium_workstation_v8_pc_top_vent_slot_{i}", (0.35, 0.005, 0.014), (1.23, y, -0.27), mats["case_shadow"], 0.002, 1)
    for i, z in enumerate([-0.235, -0.12, -0.005, 0.11]):
        v6.rb("display", f"premium_workstation_v8_pc_front_panel_seam_{i}", (0.006, 0.46, 0.018), (0.965, 0.49, z), mats["case_shadow"], 0.0015, 1)
    for i, y in enumerate([0.28, 0.39, 0.5]):
        v6.rb("display", f"premium_workstation_v8_pc_fan_hub_highlight_{i}", (0.048, 0.007, 0.048), (0.962, y, -0.125), mats["brushed_trim"], 0.012, 8)
    for i, (x, y, z) in enumerate([(1.01, 0.205, -0.31), (1.47, 0.205, -0.31), (1.01, 0.755, 0.15), (1.47, 0.755, 0.15)]):
        v6.rb("display", f"premium_workstation_v8_pc_glass_panel_screw_{i}", (0.022, 0.006, 0.022), (x, y, z), mats["brushed_trim"], 0.006, 6)
    v6.rb("display", "premium_workstation_v8_pc_rear_io_cluster", (0.16, 0.17, 0.018), (1.51, 0.57, 0.12), mats["case_shadow"], 0.004, 2)
    for i, y in enumerate([0.52, 0.56, 0.6, 0.64]):
        v6.rb("display", f"premium_workstation_v8_pc_io_port_{i}", (0.065, 0.014, 0.009), (1.51, y, 0.137), mats["status_cyan"] if i == 1 else mats["soft_black"], 0.002, 1)
    v6.rb("display", "premium_workstation_v8_psu_spec_label", (0.16, 0.052, 0.006), (1.5, 0.23, 0.05), mats["etched_label"], 0.002, 1)


def add_v8_desk_and_small_prop_details(mats: dict[str, bpy.types.Material]) -> None:
    v6.rb("desk", "premium_workstation_v8_desktop_rear_cable_grommet_outer", (0.115, 0.008, 0.05), (0.78, 0.193, -0.395), mats["rubber_edge"], 0.018, 8)
    v6.rb("desk", "premium_workstation_v8_desktop_rear_cable_grommet_inner", (0.078, 0.01, 0.026), (0.78, 0.197, -0.395), mats["case_shadow"], 0.012, 6)
    for i, x in enumerate([-1.21, -1.1, -0.99]):
        v6.rb("desk", f"premium_workstation_v8_drawer_pull_mount_screw_{i}_left", (0.01, 0.004, 0.01), (x - 0.055, 0.254 - i * 0.095, 0.458), mats["case_shadow"], 0.003, 5)
        v6.rb("desk", f"premium_workstation_v8_drawer_pull_mount_screw_{i}_right", (0.01, 0.004, 0.01), (x + 0.055, 0.254 - i * 0.095, 0.458), mats["case_shadow"], 0.003, 5)
    for i, z in enumerate([0.24, 0.272, 0.304, 0.336]):
        v6.rb("paper", f"premium_workstation_v8_notebook_ruled_line_{i}", (0.22, 0.002, 0.003), (-0.03, 0.224, z), mats["etched_label"], 0.001, 1, -0.14)
    for i, z in enumerate([0.224, 0.258, 0.292]):
        v6.rb("paper", f"premium_workstation_v8_pen_clip_{i}", (0.048, 0.003, 0.005), (-0.79, 0.22 + i * 0.006, z), mats["brushed_trim"], 0.001, 1)
    for i in range(12):
        angle = i / 12 * math.tau
        x = 0.82 + math.cos(angle) * 0.058
        z = 0.27 + math.sin(angle) * 0.058
        v6.rb("plant", f"premium_workstation_v8_leaf_center_vein_{i}", (0.006, 0.003, 0.055), (x, 0.318 + (i % 3) * 0.018, z), mats["etched_label"], 0.001, 1, angle)
    v6.rb("mug", "premium_workstation_v8_mug_inner_shadow_rim", (0.074, 0.004, 0.074), (-1.18, 0.281, 0.18), mats["case_shadow"], 0.016, 8)


def rename_v7_detail_prefix() -> None:
    remapped: dict[str, str] = {}
    for obj in bpy.context.scene.objects:
        if obj.name.startswith("premium_workstation_v7_"):
            old = obj.name
            obj.name = old.replace("premium_workstation_v7_", "premium_workstation_v8_", 1)
            remapped[old] = obj.name
    if remapped:
        v6.DETAIL_CATEGORY = {remapped.get(name, name): category for name, category in v6.DETAIL_CATEGORY.items()}


def ensure_detail_uvs_v8() -> int:
    count = 0
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH" or not obj.name.startswith("premium_workstation_v8_"):
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
    public_dir = repo_root / "apps/web/public/assets/models/p2s_premium_workstation_hero_v8"
    colliders = {
        "assetId": "p2s_premium_workstation_hero_v8",
        "model": glb_relative,
        "colliders": [
            {"id": "desk_volume", "type": "box", "center": [-0.18, 0.11, 0.1], "size": [2.32, 0.28, 0.78]},
            {"id": "pc_tower_volume", "type": "box", "center": [1.24, 0.39, -0.08], "size": [0.62, 0.82, 0.48]},
            {"id": "monitor_volume", "type": "box", "center": [-0.48, 0.56, -0.24], "size": [1.18, 0.74, 0.13]},
            {"id": "tabletop_prop_volume", "type": "box", "center": [-0.3, 0.2, 0.12], "size": [1.75, 0.22, 0.58]},
        ],
    }
    support = {
        "assetId": "p2s_premium_workstation_hero_v8",
        "supportSurfaces": [
            {"id": "desktop", "type": "horizontal", "center": [-0.18, 0.188, 0.1], "size": [2.2, 0.66], "normal": [0, 1, 0]},
            {"id": "pc_top", "type": "horizontal", "center": [1.24, 0.8, -0.08], "size": [0.5, 0.38], "normal": [0, 1, 0]},
        ],
    }
    files = {
        "colliders": public_dir / "p2s_premium_workstation_hero_v8.colliders.json",
        "supportSurfaces": public_dir / "p2s_premium_workstation_hero_v8.support-surfaces.json",
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
        "samplers": len(json_chunk.get("samplers", [])),
        "extensionsUsed": json_chunk.get("extensionsUsed", []),
    }


def save_and_render(repo_root: Path, atlas_count: int, active_uv_count: int, ao_count: int, detail_uv_count: int, atlas_paths: dict[str, str]) -> None:
    public_dir = repo_root / "apps/web/public/assets/models/p2s_premium_workstation_hero_v8"
    blend_dir = repo_root / "assets/blender/deskterior"
    review_dir = repo_root / "assets/references/blender-authored/premium-workstation-hero"
    preview_dir = review_dir / "v8-previews"
    public_dir.mkdir(parents=True, exist_ok=True)
    blend_dir.mkdir(parents=True, exist_ok=True)
    preview_dir.mkdir(parents=True, exist_ok=True)

    blend_path = blend_dir / "p2s_premium_workstation_hero_v8.blend"
    glb_path = public_dir / "p2s_premium_workstation_hero_v8.glb"
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
    bpy.ops.export_scene.gltf(filepath=str(glb_path), export_format="GLB", export_yup=True, export_materials="EXPORT", export_apply=True, export_animations=False)
    sidecars = write_runtime_sidecars(repo_root, str(glb_path.relative_to(repo_root)))

    v2.setup_render_scene()
    bpy.context.scene.view_settings.exposure = -0.03
    v2.render_preview(preview_dir / "workstation-v8-isometric.png", "preview_v8_iso_camera", (2.55, 1.25, 2.05), (0.02, 0.08, 0.0), 3.35)
    v2.render_preview(preview_dir / "workstation-v8-tabletop-closeup.png", "preview_v8_tabletop_camera", (0.68, 0.78, 0.82), (-0.46, 0.22, 0.15), 1.08)
    v2.render_preview(preview_dir / "workstation-v8-input-devices-closeup.png", "preview_v8_input_camera", (0.2, 0.54, 0.72), (-0.48, 0.2, 0.12), 0.72)
    v2.render_preview(preview_dir / "workstation-v8-monitor-audio-closeup.png", "preview_v8_monitor_audio_camera", (-1.38, 0.77, 0.55), (-0.74, 0.42, -0.17), 0.9)

    stats = base.mesh_stats()
    stats["textureImages"] = len([image for image in bpy.data.images if image.packed_file or image.filepath])
    stats["glbBytes"] = glb_path.stat().st_size
    stats["atlasAssignedMeshObjects"] = atlas_count
    stats["activeUvAtlasMeshObjects"] = active_uv_count
    stats["bakedContactAoDecals"] = ao_count
    stats["detailUvMeshObjects"] = detail_uv_count
    stats["lightmapUv2ReadyMeshObjects"] = sum(1 for obj in bpy.context.scene.objects if obj.type == "MESH" and obj.data.uv_layers.get("LightmapUV2"))

    review = {
        "asset": "p2s_premium_workstation_hero_v8",
        "status": "standalone-generated-review-required",
        "sourceBlend": str(blend_path.relative_to(repo_root)),
        "publicGlb": str(glb_path.relative_to(repo_root)),
        "previewImages": [
            str((preview_dir / "workstation-v8-isometric.png").relative_to(repo_root)),
            str((preview_dir / "workstation-v8-tabletop-closeup.png").relative_to(repo_root)),
            str((preview_dir / "workstation-v8-input-devices-closeup.png").relative_to(repo_root)),
            str((preview_dir / "workstation-v8-monitor-audio-closeup.png").relative_to(repo_root)),
        ],
        "atlasArtifacts": atlas_paths,
        "runtimeSidecars": sidecars,
        "metrics": stats,
        "glbAudit": glb_audit(glb_path),
        "desktopDetailPass": {"detailObjectCount": len(v6.DETAIL_CATEGORY), "categories": dict(sorted(Counter(v6.DETAIL_CATEGORY.values()).items()))},
        "iterationNotes": {
            "v7DefectTargeted": "Desk props still read as schematic blocks at close range even after the tabletop seam fix.",
            "v8Changes": [
                "Added denser monitor UI layers, keyboard legends/fasteners, mouse seams/skates/logo, and speaker grille/status detail.",
                "Added PC case top vents, fan hub highlights, glass screws, rear IO cluster, port marks, and PSU label detail.",
                "Added desk cable grommet, drawer fastener detail, notebook ruled lines, pen clips, plant leaf veins, and mug inner rim shadow.",
                "Kept V7 reduced tabletop seam treatment and V5 explicit UVAtlas sampling.",
            ],
        },
        "stillRequires": [
            "human visual approval against commercial references",
            "hand-authored texture polish beyond generated/procedural maps",
            "true renderer-baked GI/lightmap pass",
            "runtime LOD/proxy GLB package before live catalog promotion",
            "room-scale lighting/context integration after standalone approval",
        ],
    }
    (review_dir / "asset-review-v8-2026-05-20.json").write_text(json.dumps(review, indent=2), encoding="utf-8")


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

    basecolor = v4.make_atlas_image("premium_workstation_v8_basecolor_atlas_1024", color_for_region_v8, 1024)
    orm = v4.make_atlas_image("premium_workstation_v8_orm_atlas_1024", v4.orm_for_region, 1024)
    basecolor_path = review_dir / "workstation-v8-basecolor-atlas.png"
    orm_path = review_dir / "workstation-v8-orm-atlas.png"
    v4.save_image(basecolor, basecolor_path)
    v4.save_image(orm, orm_path)

    atlas_material = v5.create_uv_atlas_material(basecolor, orm)
    atlas_material.name = "premium_workstation_v8_shared_uv_pbr_atlas"
    atlas_count = v4.apply_atlas(atlas_material)
    active_uv_count = v5.enforce_uv_atlas_active()

    mats = detail_materials_v8()
    v6.add_monitor_and_display_detail(mats)
    v6.add_keyboard_mouse_detail(mats)
    v6.add_audio_lighting_detail(mats)
    v7.add_desk_surface_and_cable_detail_v7(mats)
    v6.add_small_props_detail(mats)
    v7.rename_v6_detail_prefix()
    add_v8_display_surface_details(mats)
    add_v8_input_device_details(mats)
    add_v8_audio_and_pc_details(mats)
    add_v8_desk_and_small_prop_details(mats)
    rename_v7_detail_prefix()
    detail_uv_count = ensure_detail_uvs_v8()

    ao_count = v4.add_baked_contact_occlusion(materials)
    save_and_render(
        repo_root,
        atlas_count,
        active_uv_count,
        ao_count,
        detail_uv_count,
        {"basecolor": str(basecolor_path.relative_to(repo_root)), "orm": str(orm_path.relative_to(repo_root))},
    )


if __name__ == "__main__":
    main()
