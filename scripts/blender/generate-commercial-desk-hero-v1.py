#!/usr/bin/env python3
"""Generate a standalone commercial-quality desk candidate for the QA room.

This pass deliberately focuses on the desk only.  The room already has enough
desktop props; the weak link is the table asset itself reading like stacked
blocks instead of a product-grade desk with real construction details.
"""

from __future__ import annotations

import argparse
import json
import math
import random
import shutil
import struct
import sys
from pathlib import Path

import bpy
from mathutils import Vector


ASSET_KEY = "p2s_commercial_desk_hero_v1"
REVIEW_DATE = "2026-05-20"
IMAGEGEN_WALNUT_SOURCE = Path(
    "assets/references/blender-authored/commercial-desk-hero-v1/imagegen/walnut-desktop-source-imagegen-20260520.png"
)


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
    world.color = (0.015, 0.017, 0.022)


def to_blender_loc(loc: tuple[float, float, float]) -> tuple[float, float, float]:
    return (loc[0], -loc[2], loc[1])


def to_blender_size(size: tuple[float, float, float]) -> tuple[float, float, float]:
    return (size[0], size[2], size[1])


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


def image_pixels(image: bpy.types.Image) -> tuple[int, int, list[float]]:
    width, height = image.size
    pixels = [0.0] * (width * height * 4)
    image.pixels.foreach_get(pixels)
    return width, height, pixels


def sample_luma(source: tuple[int, int, list[float]], u: float, v: float) -> float:
    width, height, pixels = source
    sx = max(0, min(width - 1, int(u * (width - 1))))
    sy = max(0, min(height - 1, int(v * (height - 1))))
    index = (sy * width + sx) * 4
    r, g, b = pixels[index], pixels[index + 1], pixels[index + 2]
    return max(0.0, min(1.0, r * 0.2126 + g * 0.7152 + b * 0.0722))


def sample_rgb(source: tuple[int, int, list[float]], u: float, v: float) -> tuple[float, float, float]:
    width, height, pixels = source
    sx = max(0, min(width - 1, int(u * (width - 1))))
    sy = max(0, min(height - 1, int(v * (height - 1))))
    index = (sy * width + sx) * 4
    return pixels[index], pixels[index + 1], pixels[index + 2]


def imagegen_basecolor_painter(source: tuple[int, int, list[float]]):
    def painter(u: float, v: float, x: int, y: int) -> tuple[float, float, float, float]:
        r, g, b = sample_rgb(source, u, v)
        micro_variation = (hash2(x, y) - 0.5) * 0.012
        # The raw generated texture is honey-colored. Grade it toward a quieter
        # oiled walnut so it can sit under warm/cool room lighting without glowing.
        graded_r = min(0.47, max(0.11, r * 0.62 + 0.045 + micro_variation))
        graded_g = min(0.27, max(0.055, g * 0.49 + 0.03 + micro_variation * 0.55))
        graded_b = min(0.16, max(0.025, b * 0.38 + 0.02 + micro_variation * 0.28))
        return (graded_r, graded_g, graded_b, 1.0)

    return painter


def imagegen_height_painter(source: tuple[int, int, list[float]]):
    def painter(u: float, v: float, x: int, y: int) -> tuple[float, float, float, float]:
        luma = sample_luma(source, u, v)
        left = sample_luma(source, max(0.0, u - 0.002), v)
        right = sample_luma(source, min(1.0, u + 0.002), v)
        local_contrast = abs(right - left)
        pore = (hash2(x, y) - 0.5) * 0.018
        height = 0.36 + luma * 0.45 + local_contrast * 0.72 + pore
        height = max(0.0, min(1.0, height))
        return (height, height, height, 1.0)

    return painter


def imagegen_roughness_painter(source: tuple[int, int, list[float]]):
    def painter(u: float, v: float, x: int, y: int) -> tuple[float, float, float, float]:
        luma = sample_luma(source, u, v)
        grain_variation = sample_luma(source, min(1.0, u + 0.004), v) - sample_luma(source, max(0.0, u - 0.004), v)
        rough = 0.72 - (luma - 0.45) * 0.18 + abs(grain_variation) * 0.2 + (hash2(x, y) - 0.5) * 0.018
        rough = max(0.52, min(0.86, rough))
        return (rough, rough, rough, 1.0)

    return painter


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
        frequency *= 2.03
    return value / max(total, 0.0001)


def wood_height_value(u: float, v: float, x: int, y: int) -> float:
    pore = (hash2(x, y) - 0.5) * 0.035
    flow = u + fbm(u * 2.2, v * 5.5, 4) * 0.045 + math.sin(v * 8.0) * 0.006
    long_grain = fbm(flow * 24.0, v * 3.0, 5)
    fine_grain = fbm(flow * 105.0, v * 9.0, 3)
    pore_line = 0.5 + 0.5 * math.sin((flow * 78.0 + fbm(u * 12.0, v * 4.0, 3) * 1.6) * math.tau)
    knot_a = math.exp(-(((u - 0.34) / 0.075) ** 2 + ((v - 0.63) / 0.045) ** 2))
    knot_b = math.exp(-(((u - 0.79) / 0.06) ** 2 + ((v - 0.3) / 0.055) ** 2))
    height = 0.34 + long_grain * 0.32 + fine_grain * 0.115 + pore_line * 0.055 + pore + knot_a * 0.085 + knot_b * 0.065
    return max(0.0, min(1.0, height))


def wood_base_painter(u: float, v: float, x: int, y: int) -> tuple[float, float, float, float]:
    height = wood_height_value(u, v, x, y)
    plank = 0.96 + (hash2(int(v * 7.0), 12) - 0.5) * 0.045
    end_tone = 1.0 - 0.02 * (abs(v - 0.5) * 2.0)
    fine_pore = (0.5 + 0.5 * math.sin((u * 132.0 + fbm(u * 9.0, v * 3.0, 3) * 2.2) * math.tau)) * 0.026
    return (
        min(0.53, (0.235 + height * 0.225 + fine_pore) * plank * end_tone),
        min(0.31, (0.115 + height * 0.12 + fine_pore * 0.48) * plank * end_tone),
        min(0.18, (0.052 + height * 0.066 + fine_pore * 0.22) * plank),
        1.0,
    )


def wood_roughness_painter(u: float, v: float, x: int, y: int) -> tuple[float, float, float, float]:
    height = wood_height_value(u, v, x, y)
    rough = max(0.48, min(0.86, 0.76 - height * 0.12 + 0.03 * math.sin(u * 47.0)))
    return (rough, rough, rough, 1.0)


def wood_height_painter(u: float, v: float, x: int, y: int) -> tuple[float, float, float, float]:
    height = wood_height_value(u, v, x, y)
    return (height, height, height, 1.0)


def mat(
    name: str,
    color: tuple[float, float, float, float],
    roughness: float,
    metallic: float = 0.0,
    alpha: float = 1.0,
    emissive: tuple[float, float, float] | None = None,
    emissive_strength: float = 0.0,
) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.blend_method = "BLEND" if alpha < 1.0 else "OPAQUE"
    material.use_screen_refraction = alpha < 0.42
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        if "Base Color" in bsdf.inputs:
            bsdf.inputs["Base Color"].default_value = color
        if "Roughness" in bsdf.inputs:
            bsdf.inputs["Roughness"].default_value = roughness
        if "Metallic" in bsdf.inputs:
            bsdf.inputs["Metallic"].default_value = metallic
        if "Alpha" in bsdf.inputs:
            bsdf.inputs["Alpha"].default_value = alpha
        if emissive and "Emission Color" in bsdf.inputs:
            bsdf.inputs["Emission Color"].default_value = (emissive[0], emissive[1], emissive[2], 1.0)
        if emissive and "Emission Strength" in bsdf.inputs:
            bsdf.inputs["Emission Strength"].default_value = emissive_strength
    return material


def wood_material(texture_dir: Path, repo_root: Path) -> tuple[bpy.types.Material, dict[str, str]]:
    texture_dir.mkdir(parents=True, exist_ok=True)
    base_path = texture_dir / "commercial_desk_walnut_basecolor_2k.png"
    roughness_path = texture_dir / "commercial_desk_walnut_roughness_1k.png"
    height_path = texture_dir / "commercial_desk_walnut_height_1k.png"
    imagegen_source = repo_root / IMAGEGEN_WALNUT_SOURCE
    texture_source = "procedural"
    if imagegen_source.exists():
        source_image = bpy.data.images.load(str(imagegen_source), check_existing=True)
        sampled_source = image_pixels(source_image)
        base_image = make_image_file(
            base_path,
            "commercial_desk_walnut_basecolor_imagegen_graded_2k",
            2048,
            1024,
            imagegen_basecolor_painter(sampled_source),
        )
        roughness_image = make_image_file(
            roughness_path,
            "commercial_desk_walnut_roughness_from_imagegen_1k",
            1024,
            512,
            imagegen_roughness_painter(sampled_source),
        )
        height_image = make_image_file(
            height_path,
            "commercial_desk_walnut_height_from_imagegen_1k",
            1024,
            512,
            imagegen_height_painter(sampled_source),
        )
        texture_source = str(imagegen_source)
    else:
        base_image = make_image_file(base_path, "commercial_desk_walnut_basecolor_2k", 2048, 1024, wood_base_painter)
        roughness_image = make_image_file(roughness_path, "commercial_desk_walnut_roughness_1k", 1024, 512, wood_roughness_painter)
        height_image = make_image_file(height_path, "commercial_desk_walnut_height_1k", 1024, 512, wood_height_painter)
    try:
        base_image.colorspace_settings.name = "sRGB"
        roughness_image.colorspace_settings.name = "Non-Color"
        height_image.colorspace_settings.name = "Non-Color"
    except Exception:
        pass

    material = mat("commercial_desk_oiled_walnut_pbr_texture", (0.55, 0.31, 0.17, 1), 0.68, 0.0)
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    bsdf = nodes.get("Principled BSDF")
    if bsdf:
        base_tex = nodes.new(type="ShaderNodeTexImage")
        base_tex.name = "Walnut Base Color"
        base_tex.image = base_image
        rough_tex = nodes.new(type="ShaderNodeTexImage")
        rough_tex.name = "Walnut Roughness"
        rough_tex.image = roughness_image
        height_tex = nodes.new(type="ShaderNodeTexImage")
        height_tex.name = "Walnut Height"
        height_tex.image = height_image
        bump = nodes.new(type="ShaderNodeBump")
        bump.inputs["Strength"].default_value = 0.035
        bump.inputs["Distance"].default_value = 0.009
        links.new(base_tex.outputs["Color"], bsdf.inputs["Base Color"])
        links.new(rough_tex.outputs["Color"], bsdf.inputs["Roughness"])
        links.new(height_tex.outputs["Color"], bump.inputs["Height"])
        links.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
    return material, {
        "baseColor": str(base_path),
        "roughness": str(roughness_path),
        "height": str(height_path),
        "source": texture_source,
    }


def rounded_block(
    name: str,
    size: tuple[float, float, float],
    loc: tuple[float, float, float],
    material: bpy.types.Material,
    bevel: float,
    segments: int = 6,
    rotation_y: float = 0.0,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(size=1.0, location=to_blender_loc(loc), rotation=(0.0, -rotation_y, 0.0))
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = to_blender_size(size)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if bevel > 0:
        bevel_mod = obj.modifiers.new(name=f"{name}_beveled_real_edges", type="BEVEL")
        bevel_mod.width = bevel
        bevel_mod.segments = segments
        bevel_mod.affect = "EDGES"
        obj.modifiers.new(name=f"{name}_weighted_normals", type="WEIGHTED_NORMAL")
    obj.data.materials.append(material)
    obj["deskterior_category"] = "commercial_desk"
    return obj


def assign_planar_desktop_uv(obj: bpy.types.Object, repeat_u: float = 1.0, repeat_v: float = 1.0) -> None:
    """Keep image-model wood continuous across the desktop instead of smart-project islands."""
    uv_layer = obj.data.uv_layers.get("UVMap") or obj.data.uv_layers.new(name="UVMap")
    obj.data.uv_layers.active = uv_layer
    min_x = min(vertex.co.x for vertex in obj.data.vertices)
    max_x = max(vertex.co.x for vertex in obj.data.vertices)
    min_y = min(vertex.co.y for vertex in obj.data.vertices)
    max_y = max(vertex.co.y for vertex in obj.data.vertices)
    width = max(max_x - min_x, 0.0001)
    depth = max(max_y - min_y, 0.0001)
    for poly in obj.data.polygons:
        for loop_index in poly.loop_indices:
            vertex = obj.data.vertices[obj.data.loops[loop_index].vertex_index]
            uv_layer.data[loop_index].uv = (
                ((vertex.co.x - min_x) / width) * repeat_u,
                ((vertex.co.y - min_y) / depth) * repeat_v,
            )
    obj["preserve_authored_uv"] = True


def vertical_cylinder(
    name: str,
    radius: float,
    depth: float,
    loc: tuple[float, float, float],
    material: bpy.types.Material,
    vertices: int = 32,
    bevel: bool = True,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=to_blender_loc(loc))
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(material)
    if bevel:
        bevel_mod = obj.modifiers.new(name=f"{name}_small_edge_radius", type="BEVEL")
        bevel_mod.width = radius * 0.08
        bevel_mod.segments = 2
        obj.modifiers.new(name=f"{name}_weighted_normals", type="WEIGHTED_NORMAL")
    obj["deskterior_category"] = "commercial_desk"
    return obj


def screw_head(name: str, loc: tuple[float, float, float], material: bpy.types.Material, radius: float = 0.014) -> None:
    vertical_cylinder(name, radius, 0.007, loc, material, 18)
    rounded_block(f"{name}_slot", (radius * 1.35, 0.003, radius * 0.18), (loc[0], loc[1] + 0.005, loc[2]), material, 0.001, 1, 0.4)


def cable_curve(name: str, points: list[tuple[float, float, float]], material: bpy.types.Material, bevel: float = 0.008) -> bpy.types.Object:
    curve = bpy.data.curves.new(name, "CURVE")
    curve.dimensions = "3D"
    curve.resolution_u = 18
    curve.bevel_depth = bevel
    curve.bevel_resolution = 3
    spline = curve.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for point, src in zip(spline.bezier_points, points):
        point.co = to_blender_loc(src)
        point.handle_left_type = "AUTO"
        point.handle_right_type = "AUTO"
    obj = bpy.data.objects.new(name, curve)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    obj["deskterior_category"] = "commercial_desk"
    return obj


def smart_uv_meshes() -> int:
    count = 0
    previous_active = bpy.context.view_layer.objects.active
    for obj in bpy.context.scene.objects:
        if obj.type != "MESH":
            continue
        if obj.get("preserve_authored_uv"):
            lightmap = obj.data.uv_layers.get("LightmapUV2") or obj.data.uv_layers.new(name="LightmapUV2")
            uv = obj.data.uv_layers.active
            if uv:
                for i, item in enumerate(uv.data):
                    lightmap.data[i].uv = (item.uv.x * 0.92 + 0.04, item.uv.y * 0.92 + 0.04)
            count += 1
            continue
        bpy.ops.object.select_all(action="DESELECT")
        obj.select_set(True)
        bpy.context.view_layer.objects.active = obj
        try:
            bpy.ops.object.mode_set(mode="EDIT")
            bpy.ops.mesh.select_all(action="SELECT")
            bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.018)
            bpy.ops.object.mode_set(mode="OBJECT")
            lightmap = obj.data.uv_layers.get("LightmapUV2") or obj.data.uv_layers.new(name="LightmapUV2")
            uv = obj.data.uv_layers.active
            if uv:
                for i, item in enumerate(uv.data):
                    lightmap.data[i].uv = (item.uv.x * 0.92 + 0.04, item.uv.y * 0.92 + 0.04)
            count += 1
        except Exception:
            try:
                bpy.ops.object.mode_set(mode="OBJECT")
            except Exception:
                pass
    bpy.ops.object.select_all(action="DESELECT")
    if previous_active:
        bpy.context.view_layer.objects.active = previous_active
    return count


def make_materials(texture_dir: Path, repo_root: Path) -> tuple[dict[str, bpy.types.Material], dict[str, str]]:
    wood, texture_paths = wood_material(texture_dir, repo_root)
    materials = {
        "wood": wood,
        "endgrain": mat("commercial_desk_darker_endgrain_band", (0.12, 0.055, 0.026, 1), 0.84, 0.0),
        "wood_wear": mat("commercial_desk_subtle_edge_wear", (0.32, 0.16, 0.075, 1), 0.78, 0.02),
        "black_metal": mat("commercial_desk_black_powder_coated_steel", (0.014, 0.017, 0.021, 1), 0.48, 0.52),
        "shadow_metal": mat("commercial_desk_recess_shadow_metal", (0.006, 0.008, 0.011, 1), 0.74, 0.26),
        "rubber": mat("commercial_desk_matte_black_rubber_feet", (0.01, 0.012, 0.014, 1), 0.86, 0.02),
        "brass": mat("commercial_desk_muted_brass_fasteners", (0.62, 0.49, 0.29, 1), 0.46, 0.48),
        "label": mat("commercial_desk_tiny_embossed_service_labels", (0.64, 0.66, 0.61, 1), 0.82, 0.0),
    }
    return materials, texture_paths


def build_desk(materials: dict[str, bpy.types.Material]) -> None:
    rounded_block("commercial_desk_oiled_walnut_core_slab", (3.06, 0.12, 0.98), (0, 0.035, 0), materials["wood"], 0.052, 12)
    top_surface = rounded_block("commercial_desk_thin_clearcoat_top_surface_authored_uv", (2.9, 0.024, 0.82), (0.02, 0.112, 0.02), materials["wood"], 0.028, 10)
    assign_planar_desktop_uv(top_surface, repeat_u=1.74, repeat_v=1.0)
    rounded_block("commercial_desk_rounded_front_bullnose_band", (2.98, 0.07, 0.082), (0, 0.073, 0.492), materials["wood"], 0.026, 8)
    rounded_block("commercial_desk_rear_shadow_end_band", (2.92, 0.052, 0.054), (0.02, 0.047, -0.494), materials["wood"], 0.018, 6)
    for side, x in [("left", -1.535), ("right", 1.535)]:
        rounded_block(f"commercial_desk_{side}_continuous_walnut_side_band", (0.048, 0.062, 0.9), (x, 0.068, 0), materials["wood"], 0.02, 7)

    rounded_block("commercial_desk_rear_integrated_cable_raceway_body", (2.38, 0.07, 0.075), (0.16, -0.035, -0.49), materials["black_metal"], 0.017, 5)
    rounded_block("commercial_desk_cable_raceway_open_front_shadow", (2.12, 0.034, 0.025), (0.14, -0.004, -0.444), materials["shadow_metal"], 0.008, 3)
    for x in [-0.84, -0.28, 0.28, 0.84]:
        rounded_block(f"commercial_desk_cable_tray_perforation_slot_{x}", (0.26, 0.008, 0.02), (x, 0.005, -0.438), materials["label"], 0.004, 2)
    for x in [-0.92, 0.78]:
        rounded_block(f"commercial_desk_cable_tray_hanger_{x}", (0.034, 0.17, 0.026), (x, 0.03, -0.46), materials["black_metal"], 0.008, 4)
        screw_head(f"commercial_desk_cable_tray_hanger_bolt_top_{x}", (x, 0.128, -0.46), materials["brass"], 0.012)

    vertical_cylinder("commercial_desk_black_recessed_wire_grommet_outer", 0.066, 0.016, (0.78, 0.143, -0.36), materials["black_metal"], 40)
    vertical_cylinder("commercial_desk_wire_grommet_inner_shadow", 0.043, 0.02, (0.78, 0.151, -0.36), materials["shadow_metal"], 36)
    rounded_block("commercial_desk_under_top_front_apron", (2.72, 0.06, 0.055), (0.02, -0.05, 0.402), materials["black_metal"], 0.014, 5)
    rounded_block("commercial_desk_under_top_rear_apron", (2.64, 0.052, 0.045), (0.05, -0.07, -0.38), materials["black_metal"], 0.012, 5)
    rounded_block("commercial_desk_left_side_cross_rail", (0.05, 0.052, 0.62), (-1.32, -0.34, 0.0), materials["black_metal"], 0.012, 5)
    rounded_block("commercial_desk_right_side_cross_rail", (0.05, 0.052, 0.62), (1.32, -0.34, 0.0), materials["black_metal"], 0.012, 5)

    for x in [-1.32, 1.32]:
        for z in [-0.36, 0.36]:
            rounded_block(f"commercial_desk_square_tapered_steel_leg_{x}_{z}", (0.075, 0.86, 0.075), (x, -0.43, z), materials["black_metal"], 0.018, 6)
            rounded_block(f"commercial_desk_leg_top_mount_plate_{x}_{z}", (0.23, 0.02, 0.17), (x, -0.01, z), materials["black_metal"], 0.012, 5)
            for sx in [-0.06, 0.06]:
                for sz in [-0.04, 0.04]:
                    screw_head(f"commercial_desk_mount_plate_screw_{x}_{z}_{sx}_{sz}", (x + sx, 0.007, z + sz), materials["brass"], 0.01)
            vertical_cylinder(f"commercial_desk_adjustable_leveling_glide_{x}_{z}", 0.056, 0.018, (x, -0.872, z), materials["rubber"], 24)

    rounded_block("commercial_desk_back_managed_power_strip", (0.72, 0.05, 0.06), (0.52, -0.19, -0.435), materials["shadow_metal"], 0.014, 4)
    for x in [0.28, 0.44, 0.6, 0.76]:
        rounded_block(f"commercial_desk_power_strip_socket_{x}", (0.052, 0.011, 0.022), (x, -0.165, -0.397), materials["label"], 0.005, 2)
    cable_curve("commercial_desk_single_visible_power_lead", [(0.86, -0.17, -0.43), (1.08, -0.26, -0.49), (1.22, -0.55, -0.42)], materials["black_metal"], 0.007)


def add_preview_lights() -> None:
    bpy.ops.object.light_add(type="AREA", location=(0.2, -2.8, 3.4))
    key = bpy.context.object
    key.name = "commercial_desk_preview_large_softbox"
    key.data.energy = 520
    key.data.size = 4.8
    bpy.ops.object.light_add(type="AREA", location=(-2.2, 1.6, 1.8))
    warm = bpy.context.object
    warm.name = "commercial_desk_preview_warm_edge_light"
    warm.data.energy = 95
    warm.data.color = (1.0, 0.62, 0.34)
    warm.data.size = 2.2
    bpy.ops.object.light_add(type="POINT", location=(1.8, -0.2, 1.2))
    cool = bpy.context.object
    cool.name = "commercial_desk_preview_cool_reflection_pin"
    cool.data.energy = 45
    cool.data.color = (0.55, 0.8, 1.0)


def look_at(camera: bpy.types.Object, target: tuple[float, float, float]) -> None:
    direction = Vector(to_blender_loc(target)) - camera.location
    camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def render_preview(path: Path, camera_name: str, camera_loc: tuple[float, float, float], target: tuple[float, float, float], ortho_scale: float) -> None:
    bpy.ops.object.camera_add(location=to_blender_loc(camera_loc))
    camera = bpy.context.object
    camera.name = camera_name
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = ortho_scale
    look_at(camera, target)
    bpy.context.scene.camera = camera
    bpy.context.scene.render.resolution_x = 1500
    bpy.context.scene.render.resolution_y = 1000
    bpy.context.scene.view_settings.view_transform = "Filmic"
    bpy.context.scene.view_settings.look = "Medium High Contrast"
    bpy.context.scene.view_settings.exposure = -0.02
    bpy.context.scene.view_settings.gamma = 1.0
    bpy.context.scene.render.filepath = str(path)
    bpy.ops.render.render(write_still=True)


def mesh_stats() -> dict[str, int]:
    depsgraph = bpy.context.evaluated_depsgraph_get()
    exportable = [obj for obj in bpy.context.scene.objects if obj.type in {"MESH", "CURVE"}]
    triangles = 0
    for obj in exportable:
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        try:
            triangles += sum(max(len(poly.vertices) - 2, 1) for poly in mesh.polygons)
        finally:
            evaluated.to_mesh_clear()
    return {
        "nodes": len(bpy.context.scene.objects),
        "meshesAndCurves": len(exportable),
        "materials": len(bpy.data.materials),
        "images": len([image for image in bpy.data.images if image.packed_file or image.filepath]),
        "triangles": triangles,
    }


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


def write_sidecars(public_dir: Path, repo_root: Path, glb_relative: str) -> dict[str, str]:
    colliders = {
        "assetId": ASSET_KEY,
        "model": glb_relative,
        "colliders": [
            {"id": "desktop_surface", "type": "box", "center": [0, 0.105, 0], "size": [3.06, 0.17, 0.98]},
            {"id": "leg_frame", "type": "box", "center": [0, -0.43, 0], "size": [2.74, 0.9, 0.78]},
        ],
    }
    support = {
        "assetId": ASSET_KEY,
        "supportSurfaces": [
            {"id": "desktop", "type": "horizontal", "center": [0.02, 0.132, 0.02], "size": [2.9, 0.82], "normal": [0, 1, 0]},
        ],
    }
    files = {
        "colliders": public_dir / f"{ASSET_KEY}.colliders.json",
        "supportSurfaces": public_dir / f"{ASSET_KEY}.support-surfaces.json",
    }
    for key, path in files.items():
        payload = colliders if key == "colliders" else support
        path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    return {key: str(path.relative_to(repo_root)) for key, path in files.items()}


def export_asset(repo_root: Path, texture_paths: dict[str, str], uv_count: int) -> None:
    public_dir = repo_root / "apps/web/public/assets/models" / ASSET_KEY
    blend_dir = repo_root / "assets/blender/deskterior"
    review_dir = repo_root / "assets/references/blender-authored/commercial-desk-hero-v1"
    preview_dir = review_dir / "previews"
    public_dir.mkdir(parents=True, exist_ok=True)
    blend_dir.mkdir(parents=True, exist_ok=True)
    preview_dir.mkdir(parents=True, exist_ok=True)
    blend_path = blend_dir / f"{ASSET_KEY}.blend"
    glb_path = public_dir / f"{ASSET_KEY}.glb"

    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
    bpy.ops.export_scene.gltf(
        filepath=str(glb_path),
        export_format="GLB",
        export_yup=True,
        export_materials="EXPORT",
        export_apply=True,
        export_animations=False,
    )
    sidecars = write_sidecars(public_dir, repo_root, str(glb_path.relative_to(repo_root)))

    render_preview(preview_dir / "commercial-desk-v1-isometric.png", "commercial_desk_preview_iso", (2.6, 1.35, 1.78), (0, -0.18, 0.02), 3.25)
    render_preview(preview_dir / "commercial-desk-v1-surface-closeup.png", "commercial_desk_preview_surface", (0.95, 0.58, 0.82), (0.28, 0.09, 0.08), 0.95)
    legacy_drawer_preview = preview_dir / "commercial-desk-v1-drawer-frame-closeup.png"
    if legacy_drawer_preview.exists():
        legacy_drawer_preview.unlink()
    render_preview(preview_dir / "commercial-desk-v1-left-frame-closeup.png", "commercial_desk_preview_left_frame", (-1.95, 0.45, 1.0), (-1.06, -0.26, 0.35), 1.05)

    stats = mesh_stats()
    stats["smartUvMeshObjects"] = uv_count
    stats["glbBytes"] = glb_path.stat().st_size
    relative_texture_paths = {}
    for key, value in texture_paths.items():
        path = Path(value)
        if not path.is_absolute():
            path = repo_root / path
        relative_texture_paths[key] = str(path.relative_to(repo_root))

    review = {
        "asset": ASSET_KEY,
        "status": "desk-only-commercial-candidate-review-required",
        "reviewDate": REVIEW_DATE,
        "sourceBlend": str(blend_path.relative_to(repo_root)),
        "publicGlb": str(glb_path.relative_to(repo_root)),
        "previewImages": [
            str((preview_dir / "commercial-desk-v1-isometric.png").relative_to(repo_root)),
            str((preview_dir / "commercial-desk-v1-surface-closeup.png").relative_to(repo_root)),
            str((preview_dir / "commercial-desk-v1-left-frame-closeup.png").relative_to(repo_root)),
        ],
        "textureArtifacts": relative_texture_paths,
        "runtimeSidecars": sidecars,
        "metrics": stats,
        "glbAudit": glb_audit(glb_path),
        "visualChecklist": [
            "single-piece thick wood slab with bevels instead of flat cuboid top",
            "image-model walnut basecolor with derived roughness/height maps packed into GLB when source is available",
            "continuous image-textured walnut bullnose/side bands with surface plank tone variation",
            "black powder-coated metal frame, mounting plates, brass screw heads, rubber leveling feet",
            "integrated cable raceway, grommet, power strip, managed lead",
            "drawer module removed after visual rejection; desk now uses a simpler open frame silhouette",
        ],
        "stillRequires": [
            "human art review against commercial reference imagery",
            "possible second pass after runtime screenshot if scale collides with existing desktop props",
            "LOD/proxy package before global catalog promotion",
        ],
    }
    (review_dir / "asset-review-2026-05-20.json").write_text(json.dumps(review, indent=2), encoding="utf-8")


def main() -> None:
    args = parse_args()
    repo_root = Path(args.repo_root)
    clear_scene()
    public_texture_dir = repo_root / "apps/web/public/assets/models" / ASSET_KEY / "textures"
    materials, texture_paths = make_materials(public_texture_dir, repo_root)
    build_desk(materials)
    add_preview_lights()
    uv_count = smart_uv_meshes()
    export_asset(repo_root, texture_paths, uv_count)


if __name__ == "__main__":
    main()
