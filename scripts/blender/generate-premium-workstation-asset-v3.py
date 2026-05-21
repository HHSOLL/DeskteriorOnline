#!/usr/bin/env python3
"""Generate workstation candidate v3 after rejecting v2's over-saturated pass."""

from __future__ import annotations

import argparse
import importlib.util
import json
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


ROOT = Path(__file__).resolve().parents[2]
v2 = load_script("premium_workstation_v2", Path(__file__).with_name("generate-premium-workstation-asset-v2.py"))
base = v2.base


def safe_materials() -> dict[str, bpy.types.Material]:
    return {
        "pc_perforated_texture": base.mat("premium_workstation_v3_graphite_perforated_mesh", (0.025, 0.03, 0.036, 1), 0.68, 0.18),
        "woven_mat_texture": base.mat("premium_workstation_v3_charcoal_woven_mat", (0.025, 0.045, 0.06, 1), 0.92),
        "screen_texture": base.mat("premium_workstation_v3_dark_screen_glass", (0.035, 0.052, 0.07, 1), 0.36, 0.0, 1.0, (0.08, 0.16, 0.22), 0.22),
        "rubber": base.mat("premium_workstation_v3_soft_black_rubber", (0.012, 0.014, 0.016, 1), 0.88),
        "shadow_gap": base.mat("premium_workstation_v3_deep_shadow_gap", (0.002, 0.003, 0.004, 1), 0.82),
        "frosted": base.mat("premium_workstation_v3_low_saturation_cyan_diffuser", (0.42, 0.68, 0.78, 1), 0.32, 0.0, 0.62, (0.12, 0.34, 0.46), 0.22),
        "warm_label": base.mat("premium_workstation_v3_warm_paper_label", (0.82, 0.63, 0.36, 1), 0.72),
        "blue_label": base.mat("premium_workstation_v3_desaturated_blue_print", (0.25, 0.47, 0.62, 1), 0.66),
        "magenta_label": base.mat("premium_workstation_v3_muted_coral_print", (0.72, 0.36, 0.39, 1), 0.68),
        "brushed_edge": base.mat("premium_workstation_v3_brushed_dark_edge_metal", (0.038, 0.041, 0.047, 1), 0.34, 0.52),
        "glass_edge": base.mat("premium_workstation_v3_smoked_glass_edge", (0.34, 0.55, 0.58, 1), 0.2, 0.02, 0.32),
    }


def add_screen_ui(materials: dict[str, bpy.types.Material]) -> None:
    # Explicit geometry for screen content avoids magenta texture fallbacks.
    for idx, (x, y, w, mat_name) in enumerate(
        [
            (-0.82, 0.75, 0.2, "warm_label"),
            (-0.55, 0.68, 0.28, "blue_label"),
            (-0.27, 0.61, 0.16, "magenta_label"),
            (-0.72, 0.54, 0.32, "blue_label"),
        ]
    ):
        base.rounded_block(
            f"premium_workstation_v3_main_screen_muted_ui_{idx}",
            (w, 0.006, 0.014),
            (x, y, -0.184),
            materials[mat_name],
            0.002,
            1,
        )
    for idx, (z, mat_name) in enumerate([(-0.09, "blue_label"), (-0.01, "warm_label"), (0.07, "magenta_label")]):
        base.rounded_block(
            f"premium_workstation_v3_side_screen_muted_ui_{idx}",
            (0.28, 0.005, 0.014),
            (0.32, 0.52 + idx * 0.05, z),
            materials[mat_name],
            0.002,
            1,
            -0.1,
        )


def add_color_correction_detail(materials: dict[str, bpy.types.Material]) -> None:
    # Tone down the broad PC and mat planes after v2 failed from high saturation.
    base.rounded_block("premium_workstation_v3_pc_front_outer_white_frame", (0.565, 0.73, 0.032), (1.24, 0.39, 0.188), base.mat("premium_workstation_v3_satin_white_case_frame", (0.78, 0.79, 0.76, 1), 0.58, 0.05), 0.018, 4)
    base.rounded_block("premium_workstation_v3_pc_front_deep_mesh_insert", (0.47, 0.63, 0.038), (1.24, 0.39, 0.208), materials["pc_perforated_texture"], 0.012, 4)
    for y in [0.58, 0.4, 0.22]:
        base.sphere(f"premium_workstation_v3_pc_fan_subtle_outer_{y}", (1.24, y, 0.232), (0.073, 0.073, 0.006), materials["frosted"], 32)
        base.sphere(f"premium_workstation_v3_pc_fan_dark_hub_{y}", (1.24, y, 0.238), (0.024, 0.024, 0.006), materials["shadow_gap"], 24)
    for row in range(8):
        for col in range(4):
            base.rounded_block(
                f"premium_workstation_v3_pc_mesh_pinhole_{row}_{col}",
                (0.024, 0.006, 0.006),
                (1.125 + col * 0.075, 0.205 + row * 0.052, 0.244),
                materials["shadow_gap"],
                0.002,
                1,
            )
    base.rounded_block("premium_workstation_v3_deskmat_top_charcoal_overlay", (1.56, 0.008, 0.47), (-0.28, 0.171, 0.12), materials["woven_mat_texture"], 0.024, 7)
    for z in [-0.105, 0.345]:
        base.rounded_block("premium_workstation_v3_deskmat_edge_stitch_" + str(z), (1.44, 0.006, 0.009), (-0.28, 0.18, z), materials["blue_label"], 0.002, 1)


def setup_and_render(repo_root: Path) -> None:
    public_dir = repo_root / "apps/web/public/assets/models/p2s_premium_workstation_hero_v3"
    blend_dir = repo_root / "assets/blender/deskterior"
    review_dir = repo_root / "assets/references/blender-authored/premium-workstation-hero"
    preview_dir = review_dir / "v3-previews"
    public_dir.mkdir(parents=True, exist_ok=True)
    blend_dir.mkdir(parents=True, exist_ok=True)
    preview_dir.mkdir(parents=True, exist_ok=True)

    blend_path = blend_dir / "p2s_premium_workstation_hero_v3.blend"
    glb_path = public_dir / "p2s_premium_workstation_hero_v3.glb"
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
    bpy.context.scene.view_settings.exposure = -0.08
    bpy.context.scene.view_settings.look = "Medium High Contrast"
    v2.render_preview(preview_dir / "workstation-v3-isometric.png", "preview_v3_iso_camera", (2.55, 1.25, 2.05), (0.02, 0.08, 0.0), 3.35)
    v2.render_preview(preview_dir / "workstation-v3-pc-closeup.png", "preview_v3_pc_camera", (2.25, 0.96, 0.72), (1.18, 0.36, -0.04), 1.08)
    v2.render_preview(preview_dir / "workstation-v3-tabletop-closeup.png", "preview_v3_tabletop_camera", (0.75, 0.82, 1.05), (-0.42, 0.22, 0.02), 1.36)

    stats = base.mesh_stats()
    stats["textureImages"] = len([image for image in bpy.data.images if image.packed_file or image.filepath])
    stats["glbBytes"] = glb_path.stat().st_size
    review = {
        "asset": "p2s_premium_workstation_hero_v3",
        "status": "standalone-generated-review-required",
        "sourceBlend": str(blend_path.relative_to(repo_root)),
        "publicGlb": str(glb_path.relative_to(repo_root)),
        "previewImages": [
            str((preview_dir / "workstation-v3-isometric.png").relative_to(repo_root)),
            str((preview_dir / "workstation-v3-pc-closeup.png").relative_to(repo_root)),
            str((preview_dir / "workstation-v3-tabletop-closeup.png").relative_to(repo_root)),
        ],
        "metrics": stats,
        "iterationNotes": {
            "v2RejectedBecause": [
                "magenta fallback-like large planes",
                "over-saturated toy-like PC front and desk mat",
                "screen texture too dominant",
            ],
            "v3Changes": [
                "removed generated texture materials from large visible planes",
                "switched PC front to satin white frame plus graphite mesh insert",
                "changed desk mat to charcoal with geometry stitch detail",
                "replaced screen texture dependence with explicit muted UI geometry",
            ],
        },
        "stillRequires": [
            "human visual approval against references",
            "true UV atlas and authored PBR texture pass",
            "baked AO/GI/lightmap",
            "LOD/proxy/collider/support package",
            "scene integration only after standalone approval",
        ],
    }
    (review_dir / "asset-review-v3-2026-05-20.json").write_text(json.dumps(review, indent=2), encoding="utf-8")


def main() -> None:
    args = parse_args()
    repo_root = Path(args.repo_root)
    base.clear_scene()
    base.build_scene()
    base.add_preview_lights()
    materials = safe_materials()
    v2.add_case_detail(materials)
    v2.add_desk_and_tabletop_detail(materials)
    v2.add_monitor_arm_and_lighting_detail(materials)
    add_screen_ui(materials)
    add_color_correction_detail(materials)
    v2.add_scene_floor()
    setup_and_render(repo_root)


if __name__ == "__main__":
    main()
