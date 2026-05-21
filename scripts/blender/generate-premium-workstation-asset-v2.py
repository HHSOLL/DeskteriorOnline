#!/usr/bin/env python3
"""Generate a second workstation candidate with an explicit visual-review loop.

This script intentionally writes to a v2-only asset path. It does not promote the
asset into the active room scene. Promotion is a separate decision after visual
comparison.
"""

from __future__ import annotations

import argparse
import importlib.util
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


def load_base_module():
    script_path = Path(__file__).with_name("generate-premium-workstation-asset.py")
    spec = importlib.util.spec_from_file_location("premium_workstation_v1", script_path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Unable to import base workstation generator: {script_path}")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


base = load_base_module()


def painter_grid(u: float, v: float, _x: int, _y: int) -> tuple[float, float, float, float]:
    cell_u = int(u * 28)
    cell_v = int(v * 18)
    hole = 0.24 if (cell_u + cell_v) % 2 == 0 else 0.08
    line = 0.18 if abs((u * 28) % 1 - 0.5) < 0.08 or abs((v * 18) % 1 - 0.5) < 0.08 else 0.0
    value = 0.035 + hole + line
    return (value * 0.52, value * 0.72, value * 0.85, 1.0)


def painter_weave(u: float, v: float, _x: int, _y: int) -> tuple[float, float, float, float]:
    warp = 0.5 + 0.5 * math.sin(u * math.tau * 46)
    weft = 0.5 + 0.5 * math.sin(v * math.tau * 32)
    value = 0.065 + warp * 0.035 + weft * 0.03
    return (value * 0.75, value * 1.05, value * 1.28, 1.0)


def painter_screen(u: float, v: float, _x: int, _y: int) -> tuple[float, float, float, float]:
    base_col = (0.03, 0.045, 0.06)
    if 0.08 < u < 0.92 and 0.1 < v < 0.18:
        return (0.95, 0.49, 0.18, 1.0)
    if 0.12 < u < 0.36 and 0.72 < v < 0.82:
        return (0.35, 0.82, 1.0, 1.0)
    if 0.48 < u < 0.86 and 0.56 < v < 0.64:
        return (0.88, 0.78, 0.52, 1.0)
    if int(u * 18) % 5 == 0 and 0.28 < v < 0.92:
        return (0.08, 0.11, 0.15, 1.0)
    return (base_col[0] + v * 0.05, base_col[1] + u * 0.04, base_col[2] + v * 0.07, 1.0)


def textured_material(
    name: str,
    color: tuple[float, float, float, float],
    roughness: float,
    painter,
    width: int = 512,
    height: int = 512,
    metallic: float = 0.0,
    emissive_strength: float = 0.0,
) -> bpy.types.Material:
    material = base.mat(
        name,
        color,
        roughness,
        metallic=metallic,
        emissive=(color[0], color[1], color[2]) if emissive_strength else None,
        emissive_strength=emissive_strength,
    )
    image = base.make_image(f"{name}_basecolor", width, height, painter)
    image.pack()
    try:
        image.colorspace_settings.name = "sRGB"
    except Exception:
        pass
    nodes = material.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")
    if bsdf:
        texture = nodes.new(type="ShaderNodeTexImage")
        texture.name = f"{name}_packed_texture"
        texture.image = image
        material.node_tree.links.new(texture.outputs["Color"], bsdf.inputs["Base Color"])
    return material


def add_materials() -> dict[str, bpy.types.Material]:
    return {
        "pc_perforated_texture": textured_material(
            "premium_workstation_v2_pc_perforated_mesh_texture",
            (0.05, 0.07, 0.085, 1),
            0.7,
            painter_grid,
            512,
            512,
            metallic=0.18,
        ),
        "woven_mat_texture": textured_material(
            "premium_workstation_v2_woven_deskmat_texture",
            (0.03, 0.06, 0.085, 1),
            0.94,
            painter_weave,
            512,
            512,
        ),
        "screen_texture": textured_material(
            "premium_workstation_v2_monitor_screen_texture",
            (0.05, 0.09, 0.13, 1),
            0.35,
            painter_screen,
            1024,
            512,
            emissive_strength=0.55,
        ),
        "rubber": base.mat("premium_workstation_v2_soft_black_rubber", (0.012, 0.014, 0.016, 1), 0.88),
        "shadow_gap": base.mat("premium_workstation_v2_deep_shadow_gap", (0.002, 0.003, 0.004, 1), 0.82),
        "frosted": base.mat("premium_workstation_v2_frosted_diffuser", (0.65, 0.9, 1.0, 1), 0.28, 0.0, 0.52, (0.25, 0.68, 1.0), 0.55),
        "warm_label": base.mat("premium_workstation_v2_warm_label_print", (0.96, 0.68, 0.3, 1), 0.62),
        "blue_label": base.mat("premium_workstation_v2_blue_label_print", (0.33, 0.78, 1.0, 1), 0.58),
        "magenta_label": base.mat("premium_workstation_v2_magenta_label_print", (1.0, 0.35, 0.62, 1), 0.58),
        "brushed_edge": base.mat("premium_workstation_v2_brushed_dark_edge_metal", (0.04, 0.045, 0.052, 1), 0.34, 0.52),
        "glass_edge": base.mat("premium_workstation_v2_thick_glass_green_edge", (0.42, 0.84, 0.86, 1), 0.18, 0.02, 0.36),
    }


def reassign_named_material(name: str, material: bpy.types.Material) -> None:
    obj = bpy.data.objects.get(name)
    if obj and hasattr(obj.data, "materials"):
        obj.data.materials.clear()
        obj.data.materials.append(material)


def add_case_detail(materials: dict[str, bpy.types.Material]) -> None:
    reassign_named_material("premium_workstation_pc_recessed_front_mesh", materials["pc_perforated_texture"])
    reassign_named_material("premium_workstation_wide_felt_desk_mat", materials["woven_mat_texture"])
    reassign_named_material("premium_workstation_main_monitor_inner_screen", materials["screen_texture"])
    reassign_named_material("premium_workstation_side_display_blue_screen", materials["screen_texture"])

    # PC case: convert the previous box into a layered product silhouette.
    for y in [0.09, 0.69]:
        base.rounded_block(
            f"premium_workstation_v2_pc_case_horizontal_frame_{y}",
            (0.61, 0.028, 0.46),
            (1.24, y, -0.08),
            materials["brushed_edge"],
            0.012,
            4,
        )
    for x in [0.94, 1.54]:
        base.rounded_block(
            f"premium_workstation_v2_pc_case_vertical_frame_{x}",
            (0.028, 0.72, 0.45),
            (x, 0.39, -0.08),
            materials["brushed_edge"],
            0.012,
            4,
        )
    for y in [0.2, 0.34, 0.48, 0.62]:
        for x in [1.02, 1.46]:
            base.sphere(f"premium_workstation_v2_pc_thumb_screw_{x}_{y}", (x, y, 0.164), (0.014, 0.014, 0.006), materials["brushed_edge"], 18)
    for row in range(9):
        for col in range(5):
            base.rounded_block(
                f"premium_workstation_v2_pc_front_perforation_{row}_{col}",
                (0.035, 0.012, 0.009),
                (1.09 + col * 0.075, 0.17 + row * 0.055, 0.174),
                materials["shadow_gap"],
                0.002,
                1,
            )
    for fan, y in enumerate([0.58, 0.4, 0.22]):
        for blade in range(7):
            angle = blade * math.tau / 7
            base.rounded_block(
                f"premium_workstation_v2_pc_front_fan_blade_{fan}_{blade}",
                (0.062, 0.012, 0.012),
                (1.24 + math.cos(angle) * 0.034, y + math.sin(angle) * 0.034, 0.181),
                materials["frosted"] if blade % 2 else materials["shadow_gap"],
                0.004,
                2,
                angle,
            )
        base.sphere(f"premium_workstation_v2_pc_front_fan_screw_ring_{fan}", (1.24, y, 0.184), (0.098, 0.098, 0.003), materials["glass_edge"], 32)

    # Side-window internals: motherboard, GPU, pump block, radiator, RAM, cable combs.
    base.rounded_block("premium_workstation_v2_pc_motherboard_white_pcb", (0.22, 0.42, 0.012), (1.075, 0.44, -0.01), materials["glass_edge"], 0.01, 3)
    for slot in range(5):
        base.rounded_block(
            f"premium_workstation_v2_pc_motherboard_slot_{slot}",
            (0.16, 0.012, 0.014),
            (1.08, 0.28 + slot * 0.06, 0.002),
            materials["shadow_gap"],
            0.003,
            1,
        )
    base.rounded_block("premium_workstation_v2_pc_cpu_pump_lcd", (0.1, 0.1, 0.018), (1.065, 0.49, 0.022), materials["screen_texture"], 0.012, 5)
    for tube in range(2):
        base.cable_curve(
            f"premium_workstation_v2_pc_aio_tube_{tube}",
            [(1.07 + tube * 0.018, 0.52, 0.035), (1.02, 0.66, 0.03), (1.28, 0.73, -0.12), (1.46, 0.69, -0.16)],
            materials["rubber"],
            0.009,
        )
    for index in range(3):
        base.sphere(
            f"premium_workstation_v2_pc_gpu_triple_fan_{index}",
            (1.18 + index * 0.08, 0.285, 0.158),
            (0.03, 0.03, 0.007),
            materials["shadow_gap"],
            24,
        )
    for x in [1.1, 1.17, 1.24, 1.31]:
        base.rounded_block(f"premium_workstation_v2_pc_ram_diffuser_{x}", (0.018, 0.18, 0.018), (x, 0.55, 0.037), materials["frosted"], 0.004, 2)
    for cable in range(5):
        x = 1.34 + cable * 0.012
        base.cable_curve(
            f"premium_workstation_v2_pc_cable_comb_line_{cable}",
            [(x, 0.62, 0.07), (1.22, 0.58 - cable * 0.012, 0.12), (1.09, 0.48 - cable * 0.014, 0.09)],
            materials["glass_edge"] if cable % 2 else materials["rubber"],
            0.0045,
        )
    base.rounded_block("premium_workstation_v2_pc_bottom_filter_foot_left", (0.17, 0.025, 0.08), (1.05, -0.02, -0.23), materials["rubber"], 0.012, 4)
    base.rounded_block("premium_workstation_v2_pc_bottom_filter_foot_right", (0.17, 0.025, 0.08), (1.43, -0.02, -0.23), materials["rubber"], 0.012, 4)


def add_desk_and_tabletop_detail(materials: dict[str, bpy.types.Material]) -> None:
    # Real desk details: layered edge, underside tray, cable clips, and drawer shadowing.
    for z in [-0.51, 0.51]:
        base.rounded_block(
            f"premium_workstation_v2_oak_end_grain_band_{z}",
            (3.0, 0.035, 0.028),
            (0, 0.074, z),
            materials["warm_label"],
            0.008,
            2,
        )
    base.rounded_block("premium_workstation_v2_underdesk_mesh_cable_tray", (1.15, 0.06, 0.16), (0.5, -0.19, -0.45), materials["pc_perforated_texture"], 0.013, 3)
    for i in range(7):
        base.cable_curve(
            f"premium_workstation_v2_underdesk_cable_bundle_{i}",
            [(-0.22 + i * 0.09, -0.14, -0.43), (0.28 + i * 0.06, -0.18, -0.47), (0.65, -0.12, -0.38)],
            materials["rubber"] if i % 2 else materials["glass_edge"],
            0.004,
        )
    for x in [-0.72, -0.44, -0.16, 0.12, 0.4]:
        base.rounded_block(f"premium_workstation_v2_deskmat_stitched_edge_{x}", (0.18, 0.006, 0.012), (x, 0.162, 0.365), materials["blue_label"], 0.003, 1)
    for i, x in enumerate([-0.33, -0.13, 0.07]):
        base.rounded_block(
            f"premium_workstation_v2_monitor_riser_slim_drawer_{i}",
            (0.17, 0.035, 0.17),
            (x, 0.18, -0.33),
            materials["shadow_gap"],
            0.009,
            2,
        )
    base.rounded_block("premium_workstation_v2_aluminum_monitor_riser_shelf", (0.78, 0.052, 0.28), (-0.13, 0.155, -0.34), materials["brushed_edge"], 0.018, 5)

    # Keyboard legends as colored inset bars, not text, to keep the asset scalable.
    for row in range(4):
        for col in range(9):
            if (row + col) % 3 == 0:
                base.rounded_block(
                    f"premium_workstation_v2_keyboard_legend_bar_{row}_{col}",
                    (0.022, 0.004, 0.004),
                    (-0.83 + col * 0.066 + (row % 2) * 0.016, 0.223, 0.092 + row * 0.052),
                    materials["warm_label"] if row == 0 else materials["blue_label"],
                    0.001,
                    1,
                    -0.04,
                )
    base.rounded_block("premium_workstation_v2_mouse_left_split", (0.006, 0.005, 0.09), (0.196, 0.233, 0.14), materials["shadow_gap"], 0.002, 1)
    base.rounded_block("premium_workstation_v2_mouse_right_split", (0.006, 0.005, 0.09), (0.244, 0.233, 0.14), materials["shadow_gap"], 0.002, 1)

    # Prop density that matters in close crop.
    for i in range(4):
        base.rounded_block(
            f"premium_workstation_v2_sticky_note_stack_{i}",
            (0.1, 0.006, 0.075),
            (-1.03 + i * 0.038, 0.225 + i * 0.004, 0.02 + i * 0.012),
            materials["warm_label"] if i % 2 else materials["magenta_label"],
            0.005,
            2,
            -0.12 + i * 0.04,
        )
    for i, z in enumerate([-0.09, -0.035, 0.02]):
        base.rounded_block(
            f"premium_workstation_v2_usb_dongle_and_card_{i}",
            (0.075, 0.014, 0.035),
            (0.55 + i * 0.055, 0.184, z),
            materials["brushed_edge"] if i % 2 else materials["glass_edge"],
            0.006,
            2,
            0.15,
        )
    for i in range(10):
        angle = i * math.tau / 10
        base.rounded_block(
            f"premium_workstation_v2_planter_leaf_vein_{i}",
            (0.055, 0.004, 0.006),
            (0.82 + math.cos(angle) * 0.08, 0.338 + (i % 2) * 0.01, 0.27 + math.sin(angle) * 0.062),
            materials["blue_label"] if i % 3 == 0 else materials["rubber"],
            0.002,
            1,
            angle,
        )


def add_monitor_arm_and_lighting_detail(materials: dict[str, bpy.types.Material]) -> None:
    base.rounded_block("premium_workstation_v2_dual_monitor_arm_wall_clamp", (0.12, 0.22, 0.08), (-0.18, 0.36, -0.54), materials["brushed_edge"], 0.014, 4)
    base.rounded_block("premium_workstation_v2_main_monitor_arm_lower", (0.055, 0.42, 0.045), (-0.28, 0.42, -0.45), materials["brushed_edge"], 0.011, 4, -0.46)
    base.rounded_block("premium_workstation_v2_main_monitor_arm_upper", (0.05, 0.46, 0.04), (-0.5, 0.57, -0.36), materials["brushed_edge"], 0.011, 4, -0.2)
    for loc in [(-0.18, 0.36, -0.54), (-0.36, 0.51, -0.41), (-0.5, 0.57, -0.31), (0.29, 0.42, -0.33)]:
        base.sphere(f"premium_workstation_v2_monitor_arm_joint_{loc[0]}_{loc[1]}", loc, (0.035, 0.035, 0.035), materials["brushed_edge"], 20)
    base.rounded_block("premium_workstation_v2_screen_top_light_bar", (0.78, 0.032, 0.035), (-0.48, 0.92, -0.19), materials["shadow_gap"], 0.01, 3)
    base.rounded_block("premium_workstation_v2_screen_top_light_diffuser", (0.7, 0.012, 0.018), (-0.48, 0.902, -0.17), materials["frosted"], 0.006, 2)
    base.cable_curve(
        "premium_workstation_v2_lightbar_usb_cable",
        [(-0.18, 0.9, -0.19), (0.0, 0.7, -0.34), (0.18, 0.42, -0.45), (0.52, 0.12, -0.45)],
        materials["rubber"],
        0.005,
    )


def add_scene_floor() -> None:
    floor_mat = base.textured_wood_mat("premium_workstation_v2_preview_floor_oak")
    base.rounded_block("premium_workstation_v2_preview_floor_shadow_catcher", (3.8, 0.028, 1.55), (0.0, -0.98, 0.0), floor_mat, 0.02, 3)


def setup_render_scene() -> None:
    bpy.context.scene.render.engine = "BLENDER_EEVEE_NEXT"
    try:
        bpy.context.scene.eevee.taa_render_samples = 80
    except Exception:
        pass
    bpy.context.scene.render.resolution_x = 1500
    bpy.context.scene.render.resolution_y = 1000
    bpy.context.scene.view_settings.view_transform = "Filmic"
    bpy.context.scene.view_settings.look = "Medium High Contrast"
    bpy.context.scene.view_settings.exposure = 0.05
    bpy.context.scene.view_settings.gamma = 1.0
    world = bpy.context.scene.world or bpy.data.worlds.new("World")
    bpy.context.scene.world = world
    world.color = (0.018, 0.02, 0.026)


def look_at(camera: bpy.types.Object, target: tuple[float, float, float]) -> None:
    target_vec = Vector(base.to_blender_loc(target))
    direction = target_vec - camera.location
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def render_preview(path: Path, camera_name: str, camera_loc: tuple[float, float, float], target: tuple[float, float, float], ortho_scale: float) -> None:
    bpy.ops.object.camera_add(location=base.to_blender_loc(camera_loc))
    camera = bpy.context.object
    camera.name = camera_name
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = ortho_scale
    look_at(camera, target)
    bpy.context.scene.camera = camera
    bpy.context.scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


def metrics() -> dict[str, int | float]:
    stats = base.mesh_stats()
    stats["textureImages"] = len([image for image in bpy.data.images if image.packed_file or image.filepath])
    stats["glbBytes"] = 0
    return stats


def export_and_review(repo_root: Path) -> None:
    public_dir = repo_root / "apps/web/public/assets/models/p2s_premium_workstation_hero_v2"
    blend_dir = repo_root / "assets/blender/deskterior"
    review_dir = repo_root / "assets/references/blender-authored/premium-workstation-hero"
    preview_dir = review_dir / "v2-previews"
    public_dir.mkdir(parents=True, exist_ok=True)
    blend_dir.mkdir(parents=True, exist_ok=True)
    preview_dir.mkdir(parents=True, exist_ok=True)

    blend_path = blend_dir / "p2s_premium_workstation_hero_v2.blend"
    glb_path = public_dir / "p2s_premium_workstation_hero_v2.glb"
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
    bpy.ops.export_scene.gltf(
        filepath=str(glb_path),
        export_format="GLB",
        export_yup=True,
        export_materials="EXPORT",
        export_apply=True,
        export_animations=False,
    )

    setup_render_scene()
    render_preview(preview_dir / "workstation-v2-isometric.png", "preview_v2_iso_camera", (2.55, 1.25, 2.05), (0.02, 0.08, 0.0), 3.35)
    render_preview(preview_dir / "workstation-v2-pc-closeup.png", "preview_v2_pc_camera", (2.25, 0.96, 0.72), (1.18, 0.36, -0.04), 1.08)
    render_preview(preview_dir / "workstation-v2-tabletop-closeup.png", "preview_v2_tabletop_camera", (0.75, 0.82, 1.05), (-0.42, 0.22, 0.02), 1.36)

    asset_metrics = metrics()
    asset_metrics["glbBytes"] = glb_path.stat().st_size
    review = {
        "asset": "p2s_premium_workstation_hero_v2",
        "status": "standalone-generated-review-required",
        "sourceBlend": str(blend_path.relative_to(repo_root)),
        "publicGlb": str(glb_path.relative_to(repo_root)),
        "previewImages": [
            str((preview_dir / "workstation-v2-isometric.png").relative_to(repo_root)),
            str((preview_dir / "workstation-v2-pc-closeup.png").relative_to(repo_root)),
            str((preview_dir / "workstation-v2-tabletop-closeup.png").relative_to(repo_root)),
        ],
        "metrics": asset_metrics,
        "improvementsOverV1": [
            "separate v2 path, not scene-promoted",
            "more layered PC case frame/glass/mesh/internal component detail",
            "additional packed basecolor textures for screen, desk mat, and perforated mesh",
            "visible cable tray, cable bundle, monitor arm, fan blades, cable combs, keyboard legends, and tabletop micro props",
        ],
        "stillRequires": [
            "human visual approval against references",
            "UV unwrap and authored texture atlas cleanup",
            "baked AO/GI/lightmap",
            "LOD/proxy/collider/support package",
            "runtime material normalization before catalog reuse",
        ],
    }
    (review_dir / "asset-review-v2-2026-05-20.json").write_text(json.dumps(review, indent=2), encoding="utf-8")


def main() -> None:
    args = parse_args()
    repo_root = Path(args.repo_root)
    base.clear_scene()
    base.build_scene()
    base.add_preview_lights()
    materials = add_materials()
    add_case_detail(materials)
    add_desk_and_tabletop_detail(materials)
    add_monitor_arm_and_lighting_detail(materials)
    add_scene_floor()
    export_and_review(repo_root)


if __name__ == "__main__":
    main()
