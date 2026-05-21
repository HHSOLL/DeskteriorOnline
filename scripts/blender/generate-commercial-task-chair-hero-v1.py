#!/usr/bin/env python3
"""Generate a commercial-reference generic ergonomic task chair for the QA room.

The model is self-authored and deliberately generic.  Commercial chair product
pages are used only to study proportions, material layers, and construction
signals: breathable mesh back, thin perimeter frame, adjustable arms, gas lift,
five-star base, and casters.
"""

from __future__ import annotations

import argparse
import json
import math
import random
import shutil
import sys
from pathlib import Path

import bpy
from mathutils import Vector


ASSET_KEY = "p2s_commercial_task_chair_hero_v1"
REVIEW_DATE = "2026-05-21"


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
    try:
        bpy.context.scene.eevee.taa_render_samples = 96
    except Exception:
        pass
    world = bpy.context.scene.world or bpy.data.worlds.new("World")
    bpy.context.scene.world = world
    world.color = (0.012, 0.014, 0.018)


def fract(value: float) -> float:
    return value - math.floor(value)


def smoothstep(value: float) -> float:
    return value * value * (3.0 - 2.0 * value)


def hash2(ix: int, iy: int) -> float:
    return fract(math.sin(ix * 127.1 + iy * 311.7) * 43758.5453123)


def value_noise(x: float, y: float) -> float:
    ix = math.floor(x)
    iy = math.floor(y)
    fx = smoothstep(x - ix)
    fy = smoothstep(y - iy)
    a = hash2(ix, iy)
    b = hash2(ix + 1, iy)
    c = hash2(ix, iy + 1)
    d = hash2(ix + 1, iy + 1)
    return (a * (1 - fx) + b * fx) * (1 - fy) + (c * (1 - fx) + d * fx) * fy


def fbm(x: float, y: float, octaves: int = 5) -> float:
    value = 0.0
    amplitude = 0.5
    frequency = 1.0
    total = 0.0
    for _ in range(octaves):
        value += value_noise(x * frequency, y * frequency) * amplitude
        total += amplitude
        amplitude *= 0.52
        frequency *= 2.05
    return value / max(total, 0.0001)


def make_image_file(path: Path, name: str, width: int, height: int, painter) -> bpy.types.Image:
    image = bpy.data.images.new(name, width=width, height=height, alpha=True)
    pixels: list[float] = []
    for y in range(height):
        v = y / max(height - 1, 1)
        for x in range(width):
            u = x / max(width - 1, 1)
            pixels.extend(painter(u, v, x, y))
    image.pixels.foreach_set(pixels)
    image.filepath_raw = str(path)
    image.file_format = "PNG"
    image.save()
    image.pack()
    return image


def fabric_base_painter(u: float, v: float, x: int, y: int) -> tuple[float, float, float, float]:
    weave = 0.5 + 0.5 * math.sin(u * math.tau * 58.0) * math.sin(v * math.tau * 72.0)
    diagonal = 0.5 + 0.5 * math.sin((u + v * 0.78) * math.tau * 34.0)
    noise = fbm(u * 18.0, v * 18.0, 4)
    lift = weave * 0.025 + diagonal * 0.012 + noise * 0.018
    return (0.034 + lift, 0.043 + lift * 0.9, 0.052 + lift * 0.78, 1.0)


def fabric_height_painter(u: float, v: float, x: int, y: int) -> tuple[float, float, float, float]:
    warp = 0.5 + 0.5 * math.sin(u * math.tau * 58.0)
    weft = 0.5 + 0.5 * math.sin(v * math.tau * 72.0)
    diagonal = 0.5 + 0.5 * math.sin((u + v * 0.8) * math.tau * 34.0)
    pore = (hash2(x, y) - 0.5) * 0.02
    height = max(0.0, min(1.0, 0.28 + warp * 0.24 + weft * 0.22 + diagonal * 0.13 + pore))
    return (height, height, height, 1.0)


def fabric_roughness_painter(u: float, v: float, x: int, y: int) -> tuple[float, float, float, float]:
    variation = fbm(u * 30.0, v * 30.0, 3) * 0.075 + (hash2(x, y) - 0.5) * 0.018
    rough = max(0.78, min(0.96, 0.88 + variation))
    return (rough, rough, rough, 1.0)


def mesh_base_painter(u: float, v: float, x: int, y: int) -> tuple[float, float, float, float]:
    stripe = 0.5 + 0.5 * math.sin(u * math.tau * 40.0)
    cross = 0.5 + 0.5 * math.sin(v * math.tau * 54.0)
    support_zone = 0.02 * math.sin(v * math.tau * 4.0)
    lift = stripe * 0.018 + cross * 0.016 + support_zone
    return (0.018 + lift, 0.023 + lift, 0.029 + lift * 0.9, 0.82)


def material_with_maps(
    name: str,
    base_image: bpy.types.Image,
    roughness_image: bpy.types.Image,
    height_image: bpy.types.Image,
    *,
    base_color: tuple[float, float, float, float],
    roughness: float,
    metalness: float = 0.0,
    alpha: float = 1.0,
    bump_strength: float = 0.08,
) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.diffuse_color = base_color
    material.blend_method = "BLEND" if alpha < 1.0 else "OPAQUE"
    material.use_screen_refraction = False
    material.show_transparent_back = True
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        try:
            bsdf.inputs["Metallic"].default_value = metalness
            bsdf.inputs["Roughness"].default_value = roughness
            bsdf.inputs["Alpha"].default_value = alpha
        except Exception:
            pass
        tex_base = material.node_tree.nodes.new("ShaderNodeTexImage")
        tex_base.image = base_image
        tex_base.image.colorspace_settings.name = "sRGB"
        material.node_tree.links.new(tex_base.outputs["Color"], bsdf.inputs["Base Color"])

        tex_rough = material.node_tree.nodes.new("ShaderNodeTexImage")
        tex_rough.image = roughness_image
        tex_rough.image.colorspace_settings.name = "Non-Color"
        material.node_tree.links.new(tex_rough.outputs["Color"], bsdf.inputs["Roughness"])

        tex_height = material.node_tree.nodes.new("ShaderNodeTexImage")
        tex_height.image = height_image
        tex_height.image.colorspace_settings.name = "Non-Color"
        bump = material.node_tree.nodes.new("ShaderNodeBump")
        bump.inputs["Strength"].default_value = bump_strength
        bump.inputs["Distance"].default_value = 0.028
        material.node_tree.links.new(tex_height.outputs["Color"], bump.inputs["Height"])
        material.node_tree.links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    return material


def mat(
    name: str,
    color: tuple[float, float, float, float],
    roughness: float,
    metalness: float = 0.0,
    *,
    alpha: float = 1.0,
    emissive: tuple[float, float, float, float] | None = None,
    emissive_strength: float = 0.0,
) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.diffuse_color = color
    material.use_nodes = True
    material.blend_method = "BLEND" if alpha < 1.0 else "OPAQUE"
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        try:
            bsdf.inputs["Base Color"].default_value = color
            bsdf.inputs["Roughness"].default_value = roughness
            bsdf.inputs["Metallic"].default_value = metalness
            bsdf.inputs["Alpha"].default_value = alpha
            if emissive:
                bsdf.inputs["Emission Color"].default_value = emissive
                bsdf.inputs["Emission Strength"].default_value = emissive_strength
        except Exception:
            pass
    return material


def rounded_block(
    name: str,
    size: tuple[float, float, float],
    loc: tuple[float, float, float],
    material: bpy.types.Material,
    radius: float,
    segments: int,
    rotation: tuple[float, float, float] = (0, 0, 0),
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bevel = obj.modifiers.new(name=f"{name}_bevel", type="BEVEL")
    bevel.width = radius
    bevel.segments = segments
    bevel.affect = "EDGES"
    obj.modifiers.new(name=f"{name}_weighted_normals", type="WEIGHTED_NORMAL")
    obj.data.materials.append(material)
    obj["deskterior_category"] = "commercial_task_chair"
    return obj


def cylinder(
    name: str,
    radius: float,
    depth: float,
    loc: tuple[float, float, float],
    material: bpy.types.Material,
    vertices: int = 36,
    rotation: tuple[float, float, float] = (0, 0, 0),
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(material)
    obj.modifiers.new(name=f"{name}_weighted_normals", type="WEIGHTED_NORMAL")
    obj["deskterior_category"] = "commercial_task_chair"
    return obj


def curve_tube(name: str, points: list[tuple[float, float, float]], material: bpy.types.Material, radius: float, resolution: int = 3) -> bpy.types.Object:
    curve = bpy.data.curves.new(name, type="CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = resolution
    curve.bevel_depth = radius
    curve.bevel_resolution = 4
    poly = curve.splines.new("POLY")
    poly.points.add(len(points) - 1)
    for point, coords in zip(poly.points, points):
        point.co = (coords[0], coords[1], coords[2], 1.0)
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    obj["deskterior_category"] = "commercial_task_chair"
    return obj


def curved_panel(
    name: str,
    width: float,
    height: float,
    loc: tuple[float, float, float],
    material: bpy.types.Material,
    *,
    x_segments: int = 18,
    z_segments: int = 22,
    back_curve: float = 0.085,
    recline: float = -0.2,
) -> bpy.types.Object:
    vertices: list[tuple[float, float, float]] = []
    faces: list[tuple[int, int, int, int]] = []
    for zi in range(z_segments + 1):
        v = zi / z_segments
        z = (v - 0.5) * height
        z01 = abs(v - 0.5) * 2.0
        for xi in range(x_segments + 1):
            u = xi / x_segments
            x = (u - 0.5) * width
            x01 = abs(u - 0.5) * 2.0
            y = -back_curve * (1.0 - x01 * x01) + 0.025 * math.sin(v * math.pi)
            y += recline * (v - 0.5) * 0.18
            vertices.append((loc[0] + x, loc[1] + y, loc[2] + z + 0.02 * (1 - z01)))
    stride = x_segments + 1
    for zi in range(z_segments):
        for xi in range(x_segments):
            faces.append((zi * stride + xi, zi * stride + xi + 1, (zi + 1) * stride + xi + 1, (zi + 1) * stride + xi))
    mesh = bpy.data.meshes.new(f"{name}_mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    solidify = obj.modifiers.new(name=f"{name}_thin_solidify", type="SOLIDIFY")
    solidify.thickness = 0.012
    obj.modifiers.new(name=f"{name}_weighted_normals", type="WEIGHTED_NORMAL")
    obj["deskterior_category"] = "commercial_task_chair"
    return obj


def add_mesh_weave(materials: dict[str, bpy.types.Material]) -> None:
    mesh_line = materials["mesh_line"]
    for index, x in enumerate([i * 0.052 - 0.312 for i in range(13)]):
        points = []
        for step in range(18):
            t = step / 17
            z = 0.78 + t * 0.66
            y = -0.22 - 0.058 * math.sin(t * math.pi)
            points.append((x + 0.006 * math.sin(t * math.tau), y, z))
        curve_tube(f"commercial_task_chair_mesh_back_vertical_weave_{index:02d}", points, mesh_line, 0.0026, 2)
    for index, z in enumerate([0.81 + i * 0.055 for i in range(12)]):
        points = []
        for step in range(18):
            t = step / 17
            x = (t - 0.5) * 0.68
            y = -0.212 - 0.052 * (1 - abs(t - 0.5) * 2) + 0.006 * math.sin(index * 1.7)
            points.append((x, y, z + 0.004 * math.sin(t * math.tau * 2)))
        curve_tube(f"commercial_task_chair_mesh_back_horizontal_weave_{index:02d}", points, mesh_line, 0.0023, 2)


def build_chair(materials: dict[str, bpy.types.Material]) -> None:
    fabric = materials["fabric"]
    mesh = materials["mesh"]
    frame = materials["frame"]
    metal = materials["metal"]
    shadow = materials["shadow"]
    rubber = materials["rubber"]
    accent = materials["accent"]

    # Floor-contact pivot.  Seat height and total height follow generic task-chair
    # proportions gathered from commercial office chair references.
    rounded_block("commercial_task_chair_waterfall_cushion_pan", (0.72, 0.62, 0.12), (0, -0.03, 0.55), fabric, 0.055, 12)
    rounded_block("commercial_task_chair_front_rolled_waterfall_edge", (0.66, 0.065, 0.078), (0, 0.29, 0.522), fabric, 0.034, 8)
    rounded_block("commercial_task_chair_rear_seat_shadow_gap", (0.62, 0.034, 0.038), (0, -0.355, 0.565), shadow, 0.01, 4)
    rounded_block("commercial_task_chair_left_seat_side_welt", (0.026, 0.54, 0.035), (-0.375, -0.035, 0.61), shadow, 0.008, 4)
    rounded_block("commercial_task_chair_right_seat_side_welt", (0.026, 0.54, 0.035), (0.375, -0.035, 0.61), shadow, 0.008, 4)
    for index, x in enumerate([-0.22, 0.0, 0.22]):
        rounded_block(
            f"commercial_task_chair_subtle_seat_pressure_channel_{index}",
            (0.018, 0.45, 0.012),
            (x, -0.01, 0.622),
            shadow,
            0.004,
            2,
        )

    curved_panel("commercial_task_chair_breathable_curved_mesh_back_panel", 0.72, 0.72, (0, -0.235, 1.12), mesh)
    add_mesh_weave(materials)

    curve_tube("commercial_task_chair_left_continuous_back_perimeter_frame", [(-0.39, -0.21, 0.74), (-0.42, -0.27, 1.0), (-0.36, -0.26, 1.48)], frame, 0.025)
    curve_tube("commercial_task_chair_right_continuous_back_perimeter_frame", [(0.39, -0.21, 0.74), (0.42, -0.27, 1.0), (0.36, -0.26, 1.48)], frame, 0.025)
    curve_tube("commercial_task_chair_top_shouldered_back_frame", [(-0.33, -0.25, 1.49), (-0.12, -0.285, 1.535), (0.12, -0.285, 1.535), (0.33, -0.25, 1.49)], frame, 0.023)
    curve_tube("commercial_task_chair_lower_back_cross_frame", [(-0.35, -0.22, 0.78), (-0.12, -0.265, 0.735), (0.12, -0.265, 0.735), (0.35, -0.22, 0.78)], frame, 0.022)
    rounded_block("commercial_task_chair_adjustable_lumbar_pad_soft_rectangle", (0.42, 0.038, 0.11), (0, -0.318, 1.02), fabric, 0.026, 7)
    rounded_block("commercial_task_chair_lumbar_height_track_shadow", (0.055, 0.03, 0.38), (0, -0.345, 1.02), shadow, 0.012, 5)

    rounded_block("commercial_task_chair_underseat_mechanism_housing", (0.36, 0.31, 0.11), (0, -0.08, 0.42), frame, 0.028, 8)
    rounded_block("commercial_task_chair_tilt_knob_round_shadow_box", (0.13, 0.04, 0.11), (-0.24, 0.01, 0.39), rubber, 0.018, 6)
    curve_tube("commercial_task_chair_right_tilt_lever", [(0.27, -0.05, 0.43), (0.42, 0.02, 0.37)], metal, 0.011)
    cylinder("commercial_task_chair_polished_gas_lift_inner", 0.045, 0.48, (0, -0.06, 0.235), metal, 44)
    cylinder("commercial_task_chair_black_gas_lift_outer", 0.072, 0.22, (0, -0.06, 0.245), frame, 44)

    for side, x in [("left", -0.49), ("right", 0.49)]:
        rounded_block(f"commercial_task_chair_{side}_height_adjustable_arm_post_rear", (0.052, 0.055, 0.42), (x, -0.22, 0.73), frame, 0.014, 5)
        rounded_block(f"commercial_task_chair_{side}_height_adjustable_arm_post_front", (0.046, 0.048, 0.28), (x, 0.2, 0.68), frame, 0.014, 5)
        curve_tube(
            f"commercial_task_chair_{side}_swept_arm_bridge",
            [(x, 0.2, 0.81), (x, 0.02, 0.88), (x, -0.18, 0.9)],
            frame,
            0.02,
        )
        rounded_block(f"commercial_task_chair_{side}_soft_matte_arm_pad", (0.14, 0.48, 0.048), (x, -0.01, 0.92), rubber, 0.025, 8)
        rounded_block(f"commercial_task_chair_{side}_arm_height_button_accent", (0.008, 0.044, 0.038), (x * 1.012, -0.17, 0.77), accent, 0.004, 2)

    for index in range(5):
        angle = index / 5 * math.tau
        mid_x = math.cos(angle) * 0.27
        mid_y = math.sin(angle) * 0.27 - 0.06
        rot_z = angle
        rounded_block(
            f"commercial_task_chair_five_star_base_tapered_spoke_{index}",
            (0.58, 0.078, 0.052),
            (mid_x, mid_y, 0.085),
            metal,
            0.024,
            7,
            rotation=(0, 0, rot_z),
        )
        wheel_x = math.cos(angle) * 0.57
        wheel_y = math.sin(angle) * 0.57 - 0.06
        rounded_block(
            f"commercial_task_chair_caster_fork_{index}",
            (0.12, 0.034, 0.068),
            (wheel_x, wheel_y, 0.052),
            frame,
            0.012,
            5,
            rotation=(0, 0, rot_z),
        )
        cylinder(
            f"commercial_task_chair_dual_soft_caster_wheel_{index}",
            0.052,
            0.052,
            (wheel_x, wheel_y, 0.018),
            rubber,
            28,
            rotation=(math.pi / 2, 0, rot_z),
        )
        cylinder(
            f"commercial_task_chair_caster_side_pin_{index}",
            0.012,
            0.08,
            (wheel_x, wheel_y, 0.038),
            metal,
            18,
            rotation=(math.pi / 2, 0, rot_z),
        )

    # Small branded-looking but generic construction marks help scale without
    # copying any real product logo or protected design language.
    rounded_block("commercial_task_chair_back_frame_tiny_unbranded_badge", (0.11, 0.008, 0.035), (0, -0.374, 1.39), accent, 0.005, 3)
    for x in [-0.22, 0.22]:
        cylinder("commercial_task_chair_visible_back_fastener", 0.014, 0.008, (x, -0.35, 1.32), metal, 24, rotation=(math.pi / 2, 0, 0))


def set_origins_and_metadata() -> None:
    for obj in bpy.context.scene.objects:
        if obj.type not in {"MESH", "CURVE"}:
            continue
        obj["source"] = "blender_authored_generic"
        obj["assetKey"] = ASSET_KEY
        obj["license"] = "self-authored-prototype-review-required"
        obj.select_set(True)


def add_preview_lights() -> None:
    bpy.ops.object.light_add(type="AREA", location=(-2.4, -2.8, 3.4))
    key = bpy.context.object
    key.name = "commercial_task_chair_preview_large_softbox"
    key.data.energy = 380
    key.data.size = 4.0
    bpy.ops.object.light_add(type="POINT", location=(1.65, -1.2, 1.7))
    warm = bpy.context.object
    warm.name = "commercial_task_chair_preview_warm_edge_light"
    warm.data.color = (1.0, 0.62, 0.38)
    warm.data.energy = 70
    bpy.ops.object.light_add(type="POINT", location=(-1.5, 1.6, 1.5))
    cool = bpy.context.object
    cool.name = "commercial_task_chair_preview_cool_mesh_rim"
    cool.data.color = (0.48, 0.74, 1.0)
    cool.data.energy = 48


def look_at(obj: bpy.types.Object, target: tuple[float, float, float]) -> None:
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def render_preview(path: Path, camera_name: str, camera_loc: tuple[float, float, float], target: tuple[float, float, float], ortho_scale: float) -> None:
    bpy.ops.object.camera_add(location=camera_loc)
    camera = bpy.context.object
    camera.name = camera_name
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = ortho_scale
    look_at(camera, target)
    bpy.context.scene.camera = camera
    bpy.context.scene.render.resolution_x = 1400
    bpy.context.scene.render.resolution_y = 1400
    bpy.context.scene.view_settings.view_transform = "Filmic"
    bpy.context.scene.view_settings.look = "Medium High Contrast"
    bpy.context.scene.view_settings.exposure = -0.18
    bpy.context.scene.view_settings.gamma = 1.0
    bpy.context.scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


def mesh_stats() -> dict[str, int]:
    depsgraph = bpy.context.evaluated_depsgraph_get()
    triangles = 0
    meshes = 0
    for obj in bpy.context.scene.objects:
        if obj.type not in {"MESH", "CURVE"}:
            continue
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        if mesh:
            meshes += 1
            triangles += sum(max(0, len(poly.vertices) - 2) for poly in mesh.polygons)
            evaluated.to_mesh_clear()
    return {"meshesAndCurves": meshes, "triangles": triangles}


def write_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def export_asset(repo_root: Path, texture_paths: dict[str, str]) -> None:
    public_dir = repo_root / "apps/web/public/assets/models" / ASSET_KEY
    blend_dir = repo_root / "assets/blender/deskterior"
    review_dir = repo_root / "assets/references/blender-authored/commercial-task-chair-hero-v1"
    preview_dir = review_dir / "previews"
    public_dir.mkdir(parents=True, exist_ok=True)
    blend_dir.mkdir(parents=True, exist_ok=True)
    preview_dir.mkdir(parents=True, exist_ok=True)

    set_origins_and_metadata()
    add_preview_lights()
    render_preview(preview_dir / "commercial-task-chair-v1-isometric.png", "commercial_task_chair_preview_iso", (1.85, -2.4, 1.86), (0, -0.05, 0.82), 1.75)
    render_preview(preview_dir / "commercial-task-chair-v1-back-mesh-closeup.png", "commercial_task_chair_preview_mesh", (0.78, -1.34, 1.34), (0, -0.25, 1.12), 0.86)
    render_preview(preview_dir / "commercial-task-chair-v1-base-caster-closeup.png", "commercial_task_chair_preview_base", (1.0, -1.2, 0.42), (0.12, -0.03, 0.16), 0.92)

    bpy.ops.wm.save_as_mainfile(filepath=str(blend_dir / f"{ASSET_KEY}.blend"))
    glb_path = public_dir / f"{ASSET_KEY}.glb"
    bpy.ops.export_scene.gltf(
        filepath=str(glb_path),
        export_format="GLB",
        export_apply=True,
        export_texcoords=True,
        export_normals=True,
        export_tangents=True,
        export_materials="EXPORT",
        export_yup=True,
    )

    stats = mesh_stats()
    stats["glbBytes"] = glb_path.stat().st_size

    sidecar = {
        "assetKey": ASSET_KEY,
        "version": REVIEW_DATE,
        "source": {
            "kind": "blender_authored_generic",
            "license": "self-authored; third-party pages used only as non-copied visual references",
            "releaseEligible": False,
            "reviewRequired": True
        },
        "dimensionsMm": {"width": 880, "depth": 880, "height": 1540},
        "pivot": {"origin": "floor-center", "unit": "meters"},
        "collisionProxy": {"type": "box", "sizeMm": [880, 880, 1540]},
        "textureSet": {
            "authored": "procedural_pbr_from_blender",
            "baseColor": texture_paths["fabricBaseColor"],
            "roughness": texture_paths["fabricRoughness"],
            "height": texture_paths["fabricHeight"],
            "imageModelStatus": "not-used-in-this-run-openai-api-key-not-present-in-local-env"
        },
        "lodProfile": {"complexity": "medium", "maxTriangleCount": 45000, "targetDrawCalls": 8},
        "runtimeUrl": f"/assets/models/{ASSET_KEY}/{ASSET_KEY}.glb"
    }
    write_json(public_dir / "runtime-package.json", sidecar)

    prompt_pack = {
        "status": "review_pending_no_meshy_post_sent",
        "reason": "User previously requested prompt/reference review before Meshy text-to-3D or image-to-3D generation.",
        "textTo3dPromptCandidate": (
            "Generic ergonomic task chair for a high-end deskterior room, no logos, black graphite mesh back, "
            "charcoal woven fabric cushion, thin matte black perimeter frame, adjustable armrests, gas lift, "
            "five-star caster base, realistic PBR materials, product visualization, clean topology, glb asset."
        ),
        "negativePrompt": "brand logo, exact replica, cartoon, melted geometry, extra legs, text labels, watermark",
        "intendedUse": "generate a comparison candidate only; not direct catalog promotion",
        "referencePolicy": "Use public product pages for proportion study only; do not upload or copy protected product images without review."
    }
    write_json(review_dir / "meshy-prompt-pack-2026-05-21.json", prompt_pack)

    review = {
        "assetKey": ASSET_KEY,
        "status": "generic-chair-commercial-candidate-review-required",
        "generatedAt": REVIEW_DATE,
        "output": {
            "glb": str(glb_path.relative_to(repo_root)),
            "blend": str((blend_dir / f"{ASSET_KEY}.blend").relative_to(repo_root)),
            "runtimePackage": str((public_dir / "runtime-package.json").relative_to(repo_root)),
            "previews": [
                str((preview_dir / "commercial-task-chair-v1-isometric.png").relative_to(repo_root)),
                str((preview_dir / "commercial-task-chair-v1-back-mesh-closeup.png").relative_to(repo_root)),
                str((preview_dir / "commercial-task-chair-v1-base-caster-closeup.png").relative_to(repo_root))
            ],
            "textures": texture_paths
        },
        "metrics": stats,
        "referenceStudy": [
            {
                "label": "Herman Miller Aeron specs",
                "url": "https://www.hermanmiller.com/products/seating/office-chairs/aeron-chair/specs/",
                "usedFor": ["overall width/depth/height envelope", "mesh suspension/back support signals", "adjustable arm and lumbar construction cues"],
                "copied": False
            },
            {
                "label": "Steelcase Gesture product page",
                "url": "https://www.steelcase.com/products/office-chairs/gesture/",
                "usedFor": ["thin ergonomic back silhouette", "arm support concept", "commercial task-chair material hierarchy"],
                "copied": False
            },
            {
                "label": "Kenney Furniture Kit license",
                "url": "https://kenney.nl/assets/furniture-kit",
                "usedFor": ["open-license baseline comparison only"],
                "copied": False
            }
        ],
        "commercialComparisonChecklist": [
            "replaced single-block seat/back with separate waterfall cushion, mesh panel, perimeter frame, lumbar pad, adjustable arms, gas lift, five-star base, and casters",
            "procedural PBR fabric/mesh maps are packed into the GLB and also emitted as runtime texture evidence",
            "mesh back uses surface curvature plus individual weave tubes instead of a flat rectangle",
            "all styling is generic; no brand logos, exact product silhouettes, or third-party model/image data copied",
            "still requires human visual approval and optional Meshy candidate comparison before public catalog promotion"
        ],
        "licenseReview": {
            "selfAuthored": True,
            "thirdPartyModelCopied": False,
            "thirdPartyImageCopied": False,
            "releaseEligible": False,
            "notes": "Commercial pages are references only. The generated GLB is generic prototype QA content."
        },
        "meshApi": prompt_pack
    }
    write_json(review_dir / "asset-review-2026-05-21.json", review)


def main() -> None:
    args = parse_args()
    repo_root = Path(args.repo_root).resolve()
    public_dir = repo_root / "apps/web/public/assets/models" / ASSET_KEY
    texture_dir = public_dir / "textures"
    texture_dir.mkdir(parents=True, exist_ok=True)
    if public_dir.exists():
        for child in list(public_dir.iterdir()):
            if child.is_dir():
                shutil.rmtree(child)
            else:
                child.unlink()
        texture_dir.mkdir(parents=True, exist_ok=True)

    clear_scene()
    random.seed(42)

    fabric_base = texture_dir / "commercial_task_chair_charcoal_fabric_basecolor_1k.png"
    fabric_rough = texture_dir / "commercial_task_chair_charcoal_fabric_roughness_1k.png"
    fabric_height = texture_dir / "commercial_task_chair_charcoal_fabric_height_1k.png"
    mesh_base = texture_dir / "commercial_task_chair_black_mesh_basecolor_1k.png"
    mesh_rough = texture_dir / "commercial_task_chair_black_mesh_roughness_1k.png"
    mesh_height = texture_dir / "commercial_task_chair_black_mesh_height_1k.png"

    fabric_base_image = make_image_file(fabric_base, "commercial_task_chair_fabric_basecolor_1k", 1024, 1024, fabric_base_painter)
    fabric_rough_image = make_image_file(fabric_rough, "commercial_task_chair_fabric_roughness_1k", 1024, 1024, fabric_roughness_painter)
    fabric_height_image = make_image_file(fabric_height, "commercial_task_chair_fabric_height_1k", 1024, 1024, fabric_height_painter)
    mesh_base_image = make_image_file(mesh_base, "commercial_task_chair_mesh_basecolor_1k", 1024, 1024, mesh_base_painter)
    mesh_rough_image = make_image_file(mesh_rough, "commercial_task_chair_mesh_roughness_1k", 1024, 1024, fabric_roughness_painter)
    mesh_height_image = make_image_file(mesh_height, "commercial_task_chair_mesh_height_1k", 1024, 1024, fabric_height_painter)

    materials = {
        "fabric": material_with_maps(
            "commercial_task_chair_charcoal_woven_fabric_pbr",
            fabric_base_image,
            fabric_rough_image,
            fabric_height_image,
            base_color=(0.045, 0.052, 0.06, 1),
            roughness=0.9,
            bump_strength=0.07,
        ),
        "mesh": material_with_maps(
            "commercial_task_chair_translucent_black_mesh_pbr",
            mesh_base_image,
            mesh_rough_image,
            mesh_height_image,
            base_color=(0.025, 0.03, 0.037, 0.82),
            roughness=0.86,
            alpha=0.82,
            bump_strength=0.045,
        ),
        "mesh_line": mat("commercial_task_chair_individual_mesh_weave_threads", (0.055, 0.063, 0.073, 1), 0.82, 0.02),
        "frame": mat("commercial_task_chair_matte_graphite_polymer_frame", (0.013, 0.016, 0.02, 1), 0.58, 0.08),
        "metal": mat("commercial_task_chair_satin_black_metal_hardware", (0.018, 0.019, 0.021, 1), 0.42, 0.55),
        "shadow": mat("commercial_task_chair_deep_seam_shadow", (0.006, 0.008, 0.011, 1), 0.92, 0.0),
        "rubber": mat("commercial_task_chair_matte_soft_touch_rubber", (0.01, 0.011, 0.013, 1), 0.82, 0.02),
        "accent": mat("commercial_task_chair_tiny_brushed_control_badges", (0.32, 0.36, 0.38, 1), 0.44, 0.34),
    }

    build_chair(materials)
    texture_paths = {
        "fabricBaseColor": str(fabric_base.relative_to(repo_root)),
        "fabricRoughness": str(fabric_rough.relative_to(repo_root)),
        "fabricHeight": str(fabric_height.relative_to(repo_root)),
        "meshBaseColor": str(mesh_base.relative_to(repo_root)),
        "meshRoughness": str(mesh_rough.relative_to(repo_root)),
        "meshHeight": str(mesh_height.relative_to(repo_root)),
    }
    export_asset(repo_root, texture_paths)


if __name__ == "__main__":
    main()
