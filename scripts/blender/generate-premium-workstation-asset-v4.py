#!/usr/bin/env python3
"""Generate workstation candidate v4 with atlas UVs, packed PBR maps, and richer PC internals."""

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


v3 = load_script("premium_workstation_v3", Path(__file__).with_name("generate-premium-workstation-asset-v3.py"))
v2 = v3.v2
base = v3.base


Region = tuple[float, float, float, float]


ATLAS_REGIONS: dict[str, Region] = {
    "wood": (0.02, 0.02, 0.47, 0.47),
    "deskmat": (0.52, 0.02, 0.96, 0.22),
    "case_white": (0.52, 0.26, 0.73, 0.47),
    "graphite_mesh": (0.76, 0.26, 0.96, 0.47),
    "screen": (0.02, 0.52, 0.47, 0.72),
    "pcb": (0.52, 0.52, 0.72, 0.72),
    "rubber": (0.76, 0.52, 0.96, 0.72),
    "paper": (0.02, 0.78, 0.26, 0.96),
    "label": (0.3, 0.78, 0.96, 0.96),
}


def color_for_region(region: str, u: float, v: float) -> tuple[float, float, float, float]:
    if region == "wood":
        grain = 0.5 + 0.5 * math.sin((u * 16 + v * 42 + math.sin(u * 11) * 0.25) * math.pi)
        plank = 0.9 + (int(v * 10) % 4) * 0.025
        return (0.46 * plank + grain * 0.12, 0.27 * plank + grain * 0.06, 0.14 * plank + grain * 0.04, 1)
    if region == "deskmat":
        weave = 0.035 * (math.sin(u * math.tau * 55) > 0) + 0.025 * (math.sin(v * math.tau * 38) > 0)
        return (0.025 + weave, 0.048 + weave, 0.065 + weave, 1)
    if region == "case_white":
        edge = min(u, v, 1 - u, 1 - v)
        shade = 0.76 + edge * 0.1
        return (shade, shade * 1.01, shade * 0.98, 1)
    if region == "graphite_mesh":
        hole = 0.12 if (int(u * 28) + int(v * 20)) % 2 == 0 else 0.02
        return (0.02 + hole, 0.025 + hole, 0.032 + hole, 1)
    if region == "screen":
        if 0.08 < u < 0.92 and 0.12 < v < 0.18:
            return (0.75, 0.52, 0.32, 1)
        if 0.14 < u < 0.48 and 0.62 < v < 0.7:
            return (0.23, 0.47, 0.62, 1)
        if 0.52 < u < 0.86 and 0.42 < v < 0.5:
            return (0.7, 0.42, 0.4, 1)
        return (0.035 + v * 0.08, 0.055 + u * 0.04, 0.075 + v * 0.08, 1)
    if region == "pcb":
        trace = 0.08 if abs((u * 18) % 1 - 0.5) < 0.05 or abs((v * 14) % 1 - 0.5) < 0.04 else 0
        return (0.76 + trace, 0.78 + trace, 0.73 + trace * 0.5, 1)
    if region == "rubber":
        return (0.014 + u * 0.018, 0.016 + v * 0.018, 0.019 + u * 0.02, 1)
    if region == "paper":
        fiber = 0.025 * math.sin(u * math.tau * 11) + 0.018 * math.sin(v * math.tau * 17)
        return (0.78 + fiber, 0.72 + fiber, 0.62 + fiber, 1)
    # label
    stripe = int(u * 12) % 4
    palette = [(0.74, 0.49, 0.28, 1), (0.28, 0.52, 0.66, 1), (0.72, 0.38, 0.4, 1), (0.84, 0.8, 0.68, 1)]
    return palette[stripe]


def orm_for_region(region: str, u: float, v: float) -> tuple[float, float, float, float]:
    # R = AO, G = roughness, B = metallic.
    edge_ao = min(1.0, min(u, v, 1 - u, 1 - v) * 8)
    if region in {"wood", "paper", "deskmat"}:
        return (0.45 + edge_ao * 0.45, 0.82, 0.02, 1)
    if region in {"graphite_mesh", "rubber"}:
        return (0.35 + edge_ao * 0.4, 0.72, 0.18, 1)
    if region == "case_white":
        return (0.55 + edge_ao * 0.35, 0.58, 0.06, 1)
    if region == "screen":
        return (0.65 + edge_ao * 0.25, 0.32, 0.0, 1)
    if region == "pcb":
        return (0.48 + edge_ao * 0.42, 0.64, 0.08, 1)
    return (0.55 + edge_ao * 0.35, 0.7, 0.04, 1)


def make_atlas_image(name: str, painter, size: int = 1024) -> bpy.types.Image:
    reverse: list[tuple[str, Region]] = list(ATLAS_REGIONS.items())
    pixels: list[float] = []
    for y in range(size):
        v = y / max(1, size - 1)
        for x in range(size):
            u = x / max(1, size - 1)
            hit_name = "label"
            local_u = u
            local_v = v
            for region_name, (u0, v0, u1, v1) in reverse:
                if u0 <= u <= u1 and v0 <= v <= v1:
                    hit_name = region_name
                    local_u = (u - u0) / max(u1 - u0, 0.0001)
                    local_v = (v - v0) / max(v1 - v0, 0.0001)
                    break
            pixels.extend(painter(hit_name, local_u, local_v))
    image = bpy.data.images.new(name, width=size, height=size, alpha=True)
    image.pixels.foreach_set(pixels)
    image.pack()
    try:
        image.colorspace_settings.name = "sRGB" if "basecolor" in name else "Non-Color"
    except Exception:
        pass
    return image


def save_image(image: bpy.types.Image, path: Path) -> None:
    image.filepath_raw = str(path)
    image.file_format = "PNG"
    image.save()


def create_atlas_material(basecolor: bpy.types.Image, orm: bpy.types.Image) -> bpy.types.Material:
    material = bpy.data.materials.new("premium_workstation_v4_shared_uv_pbr_atlas")
    material.use_nodes = True
    nodes = material.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")
    if not bsdf:
        return material
    color_tex = nodes.new(type="ShaderNodeTexImage")
    color_tex.name = "v4_basecolor_atlas_texture"
    color_tex.image = basecolor
    material.node_tree.links.new(color_tex.outputs["Color"], bsdf.inputs["Base Color"])
    orm_tex = nodes.new(type="ShaderNodeTexImage")
    orm_tex.name = "v4_orm_atlas_texture"
    orm_tex.image = orm
    sep = nodes.new(type="ShaderNodeSeparateColor")
    material.node_tree.links.new(orm_tex.outputs["Color"], sep.inputs["Color"])
    if "Roughness" in bsdf.inputs:
        material.node_tree.links.new(sep.outputs["Green"], bsdf.inputs["Roughness"])
    if "Metallic" in bsdf.inputs:
        material.node_tree.links.new(sep.outputs["Blue"], bsdf.inputs["Metallic"])
    return material


def assign_atlas(obj: bpy.types.Object, material: bpy.types.Material, region: str) -> bool:
    if obj.type != "MESH":
        return False
    mesh = obj.data
    mesh.materials.clear()
    mesh.materials.append(material)
    uv_layer = mesh.uv_layers.get("UVAtlas") or mesh.uv_layers.new(name="UVAtlas")
    uv2_layer = mesh.uv_layers.get("LightmapUV2") or mesh.uv_layers.new(name="LightmapUV2")
    bounds = [obj.bound_box[i] for i in range(8)]
    min_x, max_x = min(v[0] for v in bounds), max(v[0] for v in bounds)
    min_y, max_y = min(v[1] for v in bounds), max(v[1] for v in bounds)
    min_z, max_z = min(v[2] for v in bounds), max(v[2] for v in bounds)
    region_u0, region_v0, region_u1, region_v1 = ATLAS_REGIONS[region]
    pad = 0.012
    for poly in mesh.polygons:
        normal = poly.normal
        axis = max(range(3), key=lambda idx: abs(normal[idx]))
        for loop_index in poly.loop_indices:
            co = mesh.vertices[mesh.loops[loop_index].vertex_index].co
            if axis == 0:
                uu = (co.y - min_y) / max(max_y - min_y, 0.0001)
                vv = (co.z - min_z) / max(max_z - min_z, 0.0001)
            elif axis == 1:
                uu = (co.x - min_x) / max(max_x - min_x, 0.0001)
                vv = (co.z - min_z) / max(max_z - min_z, 0.0001)
            else:
                uu = (co.x - min_x) / max(max_x - min_x, 0.0001)
                vv = (co.y - min_y) / max(max_y - min_y, 0.0001)
            u = region_u0 + pad + uu * max(region_u1 - region_u0 - pad * 2, 0.001)
            v = region_v0 + pad + vv * max(region_v1 - region_v0 - pad * 2, 0.001)
            uv_layer.data[loop_index].uv = (u, v)
            uv2_layer.data[loop_index].uv = (u * 0.96 + 0.02, v * 0.96 + 0.02)
    return True


def object_region(name: str) -> str | None:
    lowered = name.lower()
    if any(token in lowered for token in ["oak", "wood", "drawer", "floor"]):
        return "wood"
    if any(token in lowered for token in ["deskmat", "stitched", "stitch"]):
        return "deskmat"
    if any(token in lowered for token in ["pc_case", "case_body", "case_frame", "satin_white"]):
        return "case_white"
    if any(token in lowered for token in ["mesh", "slot", "vent", "shadow_gap", "rubber"]):
        return "graphite_mesh"
    if any(token in lowered for token in ["screen", "lcd"]):
        return "screen"
    if any(token in lowered for token in ["motherboard", "pcb", "ram", "m2", "cpu", "gpu"]):
        return "pcb"
    if any(token in lowered for token in ["keyboard", "mouse", "speaker", "mic", "cable", "tube"]):
        return "rubber"
    if any(token in lowered for token in ["notebook", "paper", "sticky", "card", "label"]):
        return "paper"
    return None


def apply_atlas(material: bpy.types.Material) -> int:
    count = 0
    for obj in bpy.context.scene.objects:
        region = object_region(obj.name)
        if region and assign_atlas(obj, material, region):
            count += 1
    return count


def add_baked_contact_occlusion(materials: dict[str, bpy.types.Material]) -> int:
    ao_mat = base.mat("premium_workstation_v4_baked_contact_ao_transparent", (0.015, 0.012, 0.01, 1), 0.96, 0.0, 0.38)
    shadows = [
        ("pc", (1.24, 0.012, -0.08), (0.68, 0.006, 0.52)),
        ("monitor", (-0.38, 0.148, -0.27), (1.05, 0.004, 0.34)),
        ("keyboard", (-0.5, 0.168, 0.17), (0.9, 0.004, 0.29)),
        ("mouse", (0.22, 0.172, 0.16), (0.24, 0.004, 0.18)),
        ("mug", (-1.22, 0.172, 0.18), (0.2, 0.004, 0.18)),
        ("plant", (0.82, 0.176, 0.27), (0.24, 0.004, 0.2)),
        ("speaker_l", (-1.18, 0.16, -0.16), (0.24, 0.004, 0.2)),
        ("speaker_r", (0.72, 0.16, -0.16), (0.24, 0.004, 0.2)),
    ]
    for name, loc, size in shadows:
        base.rounded_block(f"premium_workstation_v4_baked_contact_shadow_{name}", size, loc, ao_mat, 0.025, 8)
    return len(shadows)


def add_product_accurate_pc_internals(materials: dict[str, bpy.types.Material]) -> None:
    white = base.mat("premium_workstation_v4_pc_satin_white_component", (0.8, 0.82, 0.8, 1), 0.56, 0.04)
    graphite = materials["rubber"]
    cyan = materials["frosted"]
    label = materials["blue_label"]
    paper = materials["warm_label"]

    # Micro-ATX motherboard layout: AM5 socket, four DIMM traces, M.2, VRM blocks.
    base.rounded_block("premium_workstation_v4_b850m_motherboard_pcb", (0.25, 0.43, 0.015), (1.045, 0.44, 0.018), white, 0.008, 3)
    base.rounded_block("premium_workstation_v4_am5_cpu_socket_frame", (0.07, 0.08, 0.012), (1.04, 0.5, 0.034), graphite, 0.006, 2)
    base.rounded_block("premium_workstation_v4_am5_retention_arm", (0.012, 0.1, 0.01), (0.995, 0.5, 0.045), label, 0.002, 1)
    for idx, x in enumerate([1.085, 1.115, 1.145, 1.175]):
        base.rounded_block(f"premium_workstation_v4_ddr5_dimm_slot_{idx}", (0.012, 0.23, 0.014), (x, 0.54, 0.042), graphite, 0.003, 1)
    for idx, x in enumerate([1.102, 1.162]):
        base.rounded_block(f"premium_workstation_v4_klevv_white_rgb_ram_{idx}", (0.019, 0.2, 0.022), (x, 0.55, 0.064), white, 0.004, 2)
        base.rounded_block(f"premium_workstation_v4_klevv_ram_diffuser_{idx}", (0.021, 0.16, 0.007), (x, 0.585, 0.08), cyan, 0.003, 1)
    base.rounded_block("premium_workstation_v4_m2_nvme_heatsink", (0.13, 0.024, 0.018), (1.07, 0.35, 0.052), graphite, 0.004, 1)
    for idx, y in enumerate([0.61, 0.66, 0.71]):
        base.rounded_block(f"premium_workstation_v4_vrm_heatsink_{idx}", (0.17, 0.024, 0.026), (1.035, y, 0.054), graphite, 0.004, 1)

    # RTX-style large white GPU with triple fans and support bracket.
    base.rounded_block("premium_workstation_v4_white_rtx_gpu_shroud", (0.34, 0.085, 0.09), (1.19, 0.29, 0.168), white, 0.012, 4)
    for idx, x in enumerate([1.09, 1.19, 1.29]):
        base.sphere(f"premium_workstation_v4_gpu_axial_fan_ring_{idx}", (x, 0.292, 0.222), (0.041, 0.041, 0.005), graphite, 28)
        base.sphere(f"premium_workstation_v4_gpu_axial_fan_hub_{idx}", (x, 0.294, 0.229), (0.015, 0.015, 0.004), cyan, 20)
    base.rounded_block("premium_workstation_v4_gpu_anti_sag_bracket", (0.02, 0.29, 0.02), (1.38, 0.24, 0.16), graphite, 0.004, 1)
    base.rounded_block("premium_workstation_v4_gpu_pcie_latch", (0.042, 0.012, 0.014), (0.99, 0.245, 0.14), paper, 0.003, 1)

    # AIO cooler: LCD pump, tubes, and top radiator hints.
    base.rounded_block("premium_workstation_v4_hydroshift_lcd_pump_face", (0.088, 0.088, 0.02), (1.04, 0.5, 0.078), materials["screen_texture"], 0.012, 5)
    for tube in range(2):
        base.cable_curve(
            f"premium_workstation_v4_aio_sleeved_tube_{tube}",
            [(1.045 + tube * 0.024, 0.52, 0.09), (1.02, 0.68, 0.085), (1.24, 0.75, -0.02), (1.47, 0.72, -0.12)],
            graphite,
            0.008,
        )
    base.rounded_block("premium_workstation_v4_top_360_radiator_block", (0.44, 0.035, 0.12), (1.24, 0.745, -0.12), graphite, 0.006, 2)
    for idx, x in enumerate([1.1, 1.24, 1.38]):
        base.sphere(f"premium_workstation_v4_radiator_fan_visible_{idx}", (x, 0.765, -0.12), (0.045, 0.045, 0.008), cyan, 24)

    # PSU/cable routing.
    base.rounded_block("premium_workstation_v4_edge_gold_psu_shroud", (0.38, 0.1, 0.08), (1.28, 0.13, -0.17), white, 0.009, 2)
    base.rounded_block("premium_workstation_v4_psu_gold_rating_badge", (0.08, 0.012, 0.034), (1.12, 0.165, -0.12), paper, 0.003, 1)
    for idx in range(7):
        base.cable_curve(
            f"premium_workstation_v4_24pin_individual_sleeve_{idx}",
            [(1.38, 0.61 - idx * 0.011, 0.085), (1.24, 0.57 - idx * 0.012, 0.135), (1.1, 0.49 - idx * 0.012, 0.105)],
            white if idx % 2 == 0 else graphite,
            0.0038,
        )


def save_and_render(repo_root: Path, atlas_count: int, ao_count: int, atlas_paths: dict[str, str]) -> None:
    public_dir = repo_root / "apps/web/public/assets/models/p2s_premium_workstation_hero_v4"
    blend_dir = repo_root / "assets/blender/deskterior"
    review_dir = repo_root / "assets/references/blender-authored/premium-workstation-hero"
    preview_dir = review_dir / "v4-previews"
    public_dir.mkdir(parents=True, exist_ok=True)
    blend_dir.mkdir(parents=True, exist_ok=True)
    preview_dir.mkdir(parents=True, exist_ok=True)

    blend_path = blend_dir / "p2s_premium_workstation_hero_v4.blend"
    glb_path = public_dir / "p2s_premium_workstation_hero_v4.glb"
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
    v2.render_preview(preview_dir / "workstation-v4-isometric.png", "preview_v4_iso_camera", (2.55, 1.25, 2.05), (0.02, 0.08, 0.0), 3.35)
    v2.render_preview(preview_dir / "workstation-v4-pc-internals-closeup.png", "preview_v4_pc_internals_camera", (0.58, 0.78, 0.68), (1.08, 0.44, 0.055), 0.86)
    v2.render_preview(preview_dir / "workstation-v4-tabletop-closeup.png", "preview_v4_tabletop_camera", (0.75, 0.82, 1.05), (-0.42, 0.22, 0.02), 1.36)

    stats = base.mesh_stats()
    stats["textureImages"] = len([image for image in bpy.data.images if image.packed_file or image.filepath])
    stats["glbBytes"] = glb_path.stat().st_size
    stats["atlasAssignedMeshObjects"] = atlas_count
    stats["bakedContactAoDecals"] = ao_count
    uv2_ready = 0
    for obj in bpy.context.scene.objects:
        if obj.type == "MESH" and obj.data.uv_layers.get("LightmapUV2"):
            uv2_ready += 1
    stats["lightmapUv2ReadyMeshObjects"] = uv2_ready

    review = {
        "asset": "p2s_premium_workstation_hero_v4",
        "status": "standalone-generated-review-required",
        "sourceBlend": str(blend_path.relative_to(repo_root)),
        "publicGlb": str(glb_path.relative_to(repo_root)),
        "previewImages": [
            str((preview_dir / "workstation-v4-isometric.png").relative_to(repo_root)),
            str((preview_dir / "workstation-v4-pc-internals-closeup.png").relative_to(repo_root)),
            str((preview_dir / "workstation-v4-tabletop-closeup.png").relative_to(repo_root)),
        ],
        "atlasArtifacts": atlas_paths,
        "metrics": stats,
        "iterationNotes": {
            "v3RemainingDefectsTargeted": [
                "true UV atlas and packed PBR map",
                "baked AO/GI/lightmap signal",
                "more product-accurate PC internals",
            ],
            "v4Changes": [
                "shared basecolor atlas plus ORM atlas generated and packed",
                "UVAtlas and LightmapUV2 assigned to primary mesh objects",
                "baked-style contact AO decals added under visible desktop objects",
                "PC internals expanded with AM5 socket frame, DDR5 slots, white RGB RAM, M.2 heatsink, VRM blocks, large white RTX-style GPU, LCD pump, AIO tubes/radiator, PSU shroud, and individually routed cable sleeves",
            ],
        },
        "stillRequires": [
            "human visual approval against commercial references",
            "true hand-authored texture polish beyond generated atlas",
            "real renderer-baked lightmap if promotion requires static GI",
            "LOD/proxy/collider/support package",
            "scene integration only after standalone approval",
        ],
    }
    (review_dir / "asset-review-v4-2026-05-20.json").write_text(json.dumps(review, indent=2), encoding="utf-8")


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
    add_product_accurate_pc_internals(materials)
    v2.add_scene_floor()

    basecolor = make_atlas_image("premium_workstation_v4_basecolor_atlas_1024", color_for_region, 1024)
    orm = make_atlas_image("premium_workstation_v4_orm_atlas_1024", orm_for_region, 1024)
    basecolor_path = review_dir / "workstation-v4-basecolor-atlas.png"
    orm_path = review_dir / "workstation-v4-orm-atlas.png"
    save_image(basecolor, basecolor_path)
    save_image(orm, orm_path)
    atlas_material = create_atlas_material(basecolor, orm)
    atlas_count = apply_atlas(atlas_material)
    ao_count = add_baked_contact_occlusion(materials)

    save_and_render(
        repo_root,
        atlas_count,
        ao_count,
        {
            "basecolor": str(basecolor_path.relative_to(repo_root)),
            "orm": str(orm_path.relative_to(repo_root)),
        },
    )


if __name__ == "__main__":
    main()
