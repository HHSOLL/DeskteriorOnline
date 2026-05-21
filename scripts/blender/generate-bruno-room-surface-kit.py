#!/usr/bin/env python3
"""Generate a Blender-authored room surface kit for the PC room QA scene.

The previous QA scene already had dense props, but the largest visible surfaces
still read as simple procedural blocks. This kit adds textured floor planks,
plaster overlays, trim, panel seams, and soft baked-shadow cards as one GLB.
It is project-authored and does not copy Bruno Simon assets.
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


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-root", required=True)
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else sys.argv[1:]
    return parser.parse_args(argv)


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()
    bpy.context.scene.unit_settings.system = "METRIC"
    bpy.context.scene.unit_settings.scale_length = 1.0
    bpy.context.scene.render.engine = "BLENDER_EEVEE_NEXT"
    world = bpy.context.scene.world or bpy.data.worlds.new("World")
    bpy.context.scene.world = world
    world.color = (0.06, 0.055, 0.06)


def make_image(name: str, width: int, height: int, painter) -> bpy.types.Image:
    image = bpy.data.images.new(name, width=width, height=height, alpha=True)
    pixels: list[float] = []
    for y in range(height):
      for x in range(width):
        r, g, b, a = painter(x / max(width - 1, 1), y / max(height - 1, 1), x, y)
        pixels.extend((r, g, b, a))
    image.pixels.foreach_set(pixels)
    image.pack()
    return image


def wood_painter(u: float, v: float, x: int, y: int) -> tuple[float, float, float, float]:
    grain = 0.5 + 0.5 * math.sin((v * 42.0 + math.sin(u * 16.0) * 0.7) * math.pi)
    long_wave = 0.5 + 0.5 * math.sin((u * 5.4 + v * 1.8) * math.pi)
    pores = random.Random(x * 9173 + y * 37).random() * 0.055
    plank_tint = 0.96 + (int(u * 7) % 4) * 0.022
    r = min(0.79, (0.49 + grain * 0.074 + long_wave * 0.032 + pores) * plank_tint)
    g = min(0.52, (0.285 + grain * 0.047 + long_wave * 0.022 + pores * 0.42) * plank_tint)
    b = min(0.35, (0.175 + grain * 0.03 + long_wave * 0.015 + pores * 0.28) * plank_tint)
    return (r, g, b, 1.0)


def plaster_painter(u: float, v: float, x: int, y: int) -> tuple[float, float, float, float]:
    seed = random.Random(x * 131 + y * 733)
    stipple = (seed.random() - 0.5) * 0.06
    cool_wash = 0.08 * max(0.0, 1.0 - abs(u - 0.18) * 3.0)
    warm_wash = 0.08 * max(0.0, 1.0 - abs(u - 0.78) * 3.0)
    vertical = 0.03 * math.sin(v * math.pi * 3.0 + u * 0.5)
    r = 0.62 + warm_wash + stipple + vertical
    g = 0.53 + cool_wash * 0.35 + warm_wash * 0.18 + stipple * 0.7 + vertical * 0.4
    b = 0.6 + cool_wash + stipple * 0.8 + vertical * 0.5
    return (max(0.0, min(1.0, r)), max(0.0, min(1.0, g)), max(0.0, min(1.0, b)), 1.0)


def trim_painter(u: float, v: float, x: int, y: int) -> tuple[float, float, float, float]:
    seed = random.Random(x * 313 + y * 97)
    grain = 0.5 + 0.5 * math.sin((u * 18 + v * 5) * math.pi)
    n = (seed.random() - 0.5) * 0.045
    return (0.78 + grain * 0.035 + n, 0.67 + grain * 0.03 + n * 0.7, 0.58 + grain * 0.025 + n * 0.55, 1.0)


def normal_painter(kind: str):
    def painter(u: float, v: float, x: int, y: int) -> tuple[float, float, float, float]:
        if kind == "wood":
            height = math.sin(v * 42.0 * math.pi + math.sin(u * 11.0) * 0.35) * 0.45
            side = math.sin(u * 14.0 * math.pi) * 0.18
        elif kind == "plaster":
            height = math.sin((u * 4.0 + v * 7.0) * math.pi) * 0.16
            side = (random.Random(x * 71 + y * 419).random() - 0.5) * 0.18
        else:
            height = math.sin((u * 18.0 + v * 4.0) * math.pi) * 0.12
            side = math.sin((u + v) * 12.0 * math.pi) * 0.08
        return (
          max(0.0, min(1.0, 0.5 + side * 0.25)),
          max(0.0, min(1.0, 0.5 + height * 0.25)),
          0.96,
          1.0,
        )

    return painter


def roughness_painter(kind: str):
    def painter(u: float, v: float, x: int, y: int) -> tuple[float, float, float, float]:
        seed = random.Random(x * 257 + y * 421)
        if kind == "wood":
            value = 0.66 + 0.13 * math.sin(v * 31.0 * math.pi) + seed.random() * 0.07
        elif kind == "plaster":
            value = 0.86 + 0.08 * math.sin((u * 2.0 + v * 5.0) * math.pi) + seed.random() * 0.045
        else:
            value = 0.58 + 0.1 * math.sin((u * 12.0 + v * 2.0) * math.pi) + seed.random() * 0.05
        value = max(0.35, min(0.96, value))
        return (value, value, value, 1.0)

    return painter


def ao_painter(kind: str):
    def painter(u: float, v: float, x: int, y: int) -> tuple[float, float, float, float]:
        edge = min(u, v, 1.0 - u, 1.0 - v)
        edge_shadow = max(0.0, 1.0 - edge * 9.0)
        grain_shadow = 0.04 * math.sin((u * 9.0 + v * 13.0) * math.pi)
        if kind == "wood":
            seam_shadow = 0.08 if abs((u * 6.0) % 1.0 - 0.5) > 0.46 else 0.0
            value = 0.88 - edge_shadow * 0.18 - seam_shadow + grain_shadow
        elif kind == "plaster":
            value = 0.91 - edge_shadow * 0.14 + grain_shadow * 0.4
        else:
            value = 0.9 - edge_shadow * 0.12 + grain_shadow * 0.3
        value = max(0.54, min(1.0, value))
        return (value, value, value, 1.0)

    return painter


def orm_painter(kind: str, metallic: float = 0.0):
    roughness = roughness_painter(kind)
    ao = ao_painter(kind)

    def painter(u: float, v: float, x: int, y: int) -> tuple[float, float, float, float]:
        ao_value = ao(u, v, x, y)[0]
        roughness_value = roughness(u, v, x, y)[0]
        return (ao_value, roughness_value, metallic, 1.0)

    return painter


def save_image_png(image: bpy.types.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.filepath_raw = str(path)
    image.file_format = "PNG"
    image.save()


def contact_shadow_lightmap_painter(u: float, v: float, x: int, y: int) -> tuple[float, float, float, float]:
    seed = random.Random(x * 353 + y * 911)
    dx = (u - 0.5) * 2.0
    dy = (v - 0.5) * 2.0
    core = math.exp(-((dx * 1.1) ** 2 + (dy * 2.15) ** 2) * 2.2)
    penumbra = math.exp(-((dx * 0.86) ** 2 + (dy * 1.35) ** 2) * 2.8)
    anisotropic_smear = 0.18 * math.exp(-(((dx + 0.22) * 1.45) ** 2 + ((dy - 0.08) * 3.2) ** 2) * 2.0)
    alpha = min(0.32, core * 0.22 + penumbra * 0.08 + anisotropic_smear + seed.random() * 0.012)
    shade = 0.018 + seed.random() * 0.008
    return (shade, shade * 0.78, shade * 0.68, alpha)


def wall_soft_wash_lightmap_painter(u: float, v: float, x: int, y: int) -> tuple[float, float, float, float]:
    seed = random.Random(x * 1597 + y * 4721)
    left_cool = math.exp(-(((u - 0.22) * 2.6) ** 2 + ((v - 0.58) * 1.55) ** 2) * 1.35)
    right_warm = math.exp(-(((u - 0.78) * 2.35) ** 2 + ((v - 0.46) * 1.75) ** 2) * 1.45)
    lower_occlusion = math.exp(-((v - 0.12) ** 2) * 18.0) * (0.45 + 0.35 * math.sin(u * math.pi))
    stipple = (seed.random() - 0.5) * 0.015
    r = 0.15 + right_warm * 0.34 + left_cool * 0.05 + lower_occlusion * 0.12 + stipple
    g = 0.09 + right_warm * 0.12 + left_cool * 0.19 + lower_occlusion * 0.08 + stipple * 0.6
    b = 0.13 + right_warm * 0.1 + left_cool * 0.32 + lower_occlusion * 0.07 + stipple * 0.8
    alpha = min(0.18, right_warm * 0.05 + left_cool * 0.05 + lower_occlusion * 0.075 + seed.random() * 0.006)
    return (max(0.0, min(1.0, r)), max(0.0, min(1.0, g)), max(0.0, min(1.0, b)), alpha)


def art_directed_bounce_lightmap_painter(u: float, v: float, x: int, y: int) -> tuple[float, float, float, float]:
    seed = random.Random(x * 6211 + y * 4219)
    warm_desk = math.exp(-(((u - 0.36) * 3.1) ** 2 + ((v - 0.42) * 2.4) ** 2) * 1.3)
    sofa_amber = math.exp(-(((u - 0.25) * 2.4) ** 2 + ((v - 0.74) * 2.8) ** 2) * 1.45)
    media_pink = math.exp(-(((u - 0.78) * 3.0) ** 2 + ((v - 0.34) * 2.5) ** 2) * 1.2)
    cool_window = math.exp(-(((u - 0.62) * 2.2) ** 2 + ((v - 0.74) * 1.8) ** 2) * 1.1)
    contact_dimming = math.exp(-((v - 0.08) ** 2) * 24.0) * (0.55 + 0.35 * math.sin(u * math.pi * 1.7))
    stipple = (seed.random() - 0.5) * 0.012
    r = 0.18 + warm_desk * 0.42 + sofa_amber * 0.22 + media_pink * 0.34 + cool_window * 0.05 - contact_dimming * 0.08 + stipple
    g = 0.11 + warm_desk * 0.18 + sofa_amber * 0.13 + media_pink * 0.08 + cool_window * 0.23 - contact_dimming * 0.06 + stipple * 0.65
    b = 0.13 + warm_desk * 0.07 + sofa_amber * 0.06 + media_pink * 0.19 + cool_window * 0.36 - contact_dimming * 0.05 + stipple * 0.8
    alpha = min(
      0.16,
      warm_desk * 0.045
      + sofa_amber * 0.035
      + media_pink * 0.04
      + cool_window * 0.042
      + contact_dimming * 0.04
      + seed.random() * 0.004,
    )
    return (max(0.0, min(1.0, r)), max(0.0, min(1.0, g)), max(0.0, min(1.0, b)), alpha)


def create_cycles_floor_ao_bake(bake_preview_path: Path | None = None) -> tuple[bpy.types.Image, dict[str, object]]:
    previous_engine = bpy.context.scene.render.engine
    previous_samples = getattr(bpy.context.scene.cycles, "samples", 64) if hasattr(bpy.context.scene, "cycles") else 64
    bpy.context.scene.render.engine = "CYCLES"
    bpy.context.scene.cycles.samples = 48
    bpy.context.scene.cycles.use_denoising = True
    raw_image = bpy.data.images.new("surface_cycles_floor_ao_probe_raw_512", 512, 512, alpha=False)
    receiver_material = bpy.data.materials.new("surface_cycles_ao_bake_receiver_temp")
    receiver_material.use_nodes = True
    receiver_nodes = receiver_material.node_tree.nodes
    receiver_tex = receiver_nodes.new(type="ShaderNodeTexImage")
    receiver_tex.name = "surface_cycles_ao_bake_active_target"
    receiver_tex.image = raw_image
    receiver_nodes.active = receiver_tex

    proxy_material = simple_mat("surface_cycles_ao_proxy_shadow_temp", (0.42, 0.4, 0.38, 1), 0.9, 0.0)
    temp_objects: list[bpy.types.Object] = []
    receiver = plane_card("__cycles_floor_ao_receiver", (6.36, 3.98), (-0.08, -0.06, 0.092), receiver_material)
    receiver["deskterior_bake_temp"] = True
    temp_objects.append(receiver)
    proxy_specs = [
      ("desk", (2.72, 0.72, 0.78), (-0.52, -0.92, 0.49)),
      ("pc_tower", (0.58, 0.46, 1.02), (0.92, -0.52, 0.58)),
      ("task_chair", (0.86, 0.78, 0.9), (-0.2, 0.12, 0.52)),
      ("sofa", (2.04, 0.86, 0.72), (-1.58, 1.18, 0.44)),
      ("coffee_table", (1.28, 0.62, 0.42), (0.34, 0.98, 0.28)),
      ("media_console", (1.84, 0.52, 0.6), (2.02, -1.38, 0.38)),
      ("shelf", (1.86, 0.48, 1.92), (-2.36, -1.48, 1.02)),
    ]
    for name, size, loc in proxy_specs:
      proxy = cube(f"__cycles_ao_proxy_{name}", size, loc, proxy_material, 0.0)
      proxy["deskterior_bake_temp"] = True
      temp_objects.append(proxy)

    try:
      bpy.ops.object.select_all(action="DESELECT")
      bpy.context.view_layer.objects.active = receiver
      receiver.select_set(True)
      bpy.ops.object.mode_set(mode="EDIT")
      bpy.ops.mesh.select_all(action="SELECT")
      bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.02)
      bpy.ops.object.mode_set(mode="OBJECT")
      bpy.ops.object.bake(type="AO", margin=8)
      if bake_preview_path:
        raw_image.save_render(str(bake_preview_path))
      raw_pixels = list(raw_image.pixels)
      converted = bpy.data.images.new("surface_cycles_baked_floor_ao_rgba_512", 512, 512, alpha=True)
      converted_pixels: list[float] = []
      for index in range(0, len(raw_pixels), 4):
        ao = (raw_pixels[index] + raw_pixels[index + 1] + raw_pixels[index + 2]) / 3.0
        darkness = max(0.0, min(1.0, 1.0 - ao))
        alpha = min(0.22, darkness * 0.42)
        converted_pixels.extend((0.024 + darkness * 0.018, 0.018 + darkness * 0.012, 0.016 + darkness * 0.01, alpha))
      converted.pixels.foreach_set(converted_pixels)
      converted.pack()
    finally:
      bpy.ops.object.mode_set(mode="OBJECT")
      bpy.ops.object.select_all(action="DESELECT")
      for obj in temp_objects:
        if obj.name in bpy.data.objects:
          obj.select_set(True)
      bpy.ops.object.delete()
      if raw_image.name in bpy.data.images:
        bpy.data.images.remove(raw_image)
      for material in [receiver_material, proxy_material]:
        if material.name in bpy.data.materials:
          bpy.data.materials.remove(material)
      bpy.context.scene.render.engine = previous_engine
      bpy.context.scene.cycles.samples = previous_samples

    return (
      converted,
      {
        "engine": "CYCLES",
        "bakeType": "AO",
        "samples": 48,
        "resolution": [512, 512],
        "receiverSurfaces": ["floor"],
        "blockerProxies": [name for name, _, _ in proxy_specs],
        "uvBakedProxy": True,
        "finalAssetProjection": "single transparent floor lightmap card",
        "physicallyBakedAo": True,
        "pathTracedGi": False,
        "stillRequiresPathTracedGi": True,
        "stillRequiresFinalUvBake": True,
      },
    )


def set_non_color(image: bpy.types.Image) -> bpy.types.Image:
    try:
      image.colorspace_settings.name = "Non-Color"
    except Exception:
      pass
    return image


def textured_mat(name: str, image: bpy.types.Image, roughness: float, metallic: float = 0.0) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")
    tex = nodes.new(type="ShaderNodeTexImage")
    tex.name = f"{name}_base_color"
    tex.image = image
    if bsdf:
      material.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
      bsdf.inputs["Roughness"].default_value = roughness
      bsdf.inputs["Metallic"].default_value = metallic
    return material


def pbr_textured_mat(
    name: str,
    base_image: bpy.types.Image,
    normal_image: bpy.types.Image,
    roughness_image: bpy.types.Image,
    ao_image: bpy.types.Image,
    orm_image: bpy.types.Image | None,
    roughness: float,
    metallic: float = 0.0,
) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")
    tex_base = nodes.new(type="ShaderNodeTexImage")
    tex_base.name = f"{name}_base_color"
    tex_base.image = base_image
    tex_normal = nodes.new(type="ShaderNodeTexImage")
    tex_normal.name = f"{name}_normal"
    tex_normal.image = set_non_color(normal_image)
    tex_roughness = nodes.new(type="ShaderNodeTexImage")
    tex_roughness.name = f"{name}_roughness"
    tex_roughness.image = set_non_color(roughness_image)
    tex_ao = nodes.new(type="ShaderNodeTexImage")
    tex_ao.name = f"{name}_ambient_occlusion"
    tex_ao.image = set_non_color(ao_image)
    tex_orm = nodes.new(type="ShaderNodeTexImage")
    tex_orm.name = f"{name}_packed_orm"
    tex_orm.image = set_non_color(orm_image) if orm_image else None
    separate_orm = nodes.new(type="ShaderNodeSeparateColor")
    normal_node = nodes.new(type="ShaderNodeNormalMap")
    normal_node.inputs["Strength"].default_value = 0.42
    ao_mix = nodes.new(type="ShaderNodeMixRGB")
    ao_mix.blend_type = "MULTIPLY"
    ao_mix.inputs["Fac"].default_value = 0.32
    if bsdf:
      material.node_tree.links.new(tex_base.outputs["Color"], ao_mix.inputs["Color1"])
      if orm_image:
        material.node_tree.links.new(tex_orm.outputs["Color"], separate_orm.inputs["Color"])
        material.node_tree.links.new(separate_orm.outputs["Red"], ao_mix.inputs["Color2"])
        material.node_tree.links.new(separate_orm.outputs["Green"], bsdf.inputs["Roughness"])
      else:
        material.node_tree.links.new(tex_ao.outputs["Color"], ao_mix.inputs["Color2"])
        material.node_tree.links.new(tex_roughness.outputs["Color"], bsdf.inputs["Roughness"])
      material.node_tree.links.new(ao_mix.outputs["Color"], bsdf.inputs["Base Color"])
      material.node_tree.links.new(tex_normal.outputs["Color"], normal_node.inputs["Color"])
      material.node_tree.links.new(normal_node.outputs["Normal"], bsdf.inputs["Normal"])
      bsdf.inputs["Roughness"].default_value = roughness
      bsdf.inputs["Metallic"].default_value = metallic
    return material


def textured_alpha_mat(name: str, image: bpy.types.Image) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.blend_method = "BLEND"
    material.use_screen_refraction = False
    nodes = material.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")
    tex = nodes.new(type="ShaderNodeTexImage")
    tex.name = f"{name}_rgba_lightmap"
    tex.image = image
    if bsdf:
      material.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
      material.node_tree.links.new(tex.outputs["Alpha"], bsdf.inputs["Alpha"])
      bsdf.inputs["Roughness"].default_value = 0.98
      bsdf.inputs["Metallic"].default_value = 0.0
    return material


def simple_mat(
    name: str,
    color: tuple[float, float, float, float],
    roughness: float,
    metallic: float = 0.0,
    alpha: float = 1.0,
    emissive: tuple[float, float, float] | None = None,
    strength: float = 0.0,
) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    material.blend_method = "BLEND" if alpha < 1.0 else "OPAQUE"
    bsdf = material.node_tree.nodes.get("Principled BSDF")
    if bsdf:
      bsdf.inputs["Base Color"].default_value = (color[0], color[1], color[2], alpha)
      bsdf.inputs["Alpha"].default_value = alpha
      bsdf.inputs["Roughness"].default_value = roughness
      bsdf.inputs["Metallic"].default_value = metallic
      if emissive and "Emission Color" in bsdf.inputs:
        bsdf.inputs["Emission Color"].default_value = (emissive[0], emissive[1], emissive[2], 1.0)
        bsdf.inputs["Emission Strength"].default_value = strength
    return material


def cube(
    name: str,
    size: tuple[float, float, float],
    loc: tuple[float, float, float],
    material: bpy.types.Material,
    bevel: float = 0.006,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    if bevel > 0:
      bevel_mod = obj.modifiers.new(f"{name}_beveled_edges", "BEVEL")
      bevel_mod.width = bevel
      bevel_mod.segments = 2
      bevel_mod.affect = "EDGES"
      obj.modifiers.new(f"{name}_weighted_normals", "WEIGHTED_NORMAL")
    return obj


def plane_card(
    name: str,
    size: tuple[float, float],
    loc: tuple[float, float, float],
    material: bpy.types.Material,
    rotation: tuple[float, float, float] = (0, 0, 0),
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_plane_add(size=1, location=loc, rotation=rotation)
    obj = bpy.context.object
    obj.name = name
    obj.scale = (size[0], size[1], 1)
    obj.data.materials.append(material)
    return obj


def apply_modifiers() -> None:
    for obj in list(bpy.context.scene.objects):
      if obj.type != "MESH":
        continue
      bpy.ops.object.select_all(action="DESELECT")
      bpy.context.view_layer.objects.active = obj
      obj.select_set(True)
      for modifier in list(obj.modifiers):
        try:
          bpy.ops.object.modifier_apply(modifier=modifier.name)
        except Exception:
          pass
      obj.select_set(False)


def mesh_objects() -> list[bpy.types.Object]:
    return [obj for obj in bpy.context.scene.objects if obj.type == "MESH"]


def world_bounds(objects: list[bpy.types.Object]) -> tuple[Vector, Vector]:
    points: list[Vector] = []
    for obj in objects:
      for corner in obj.bound_box:
        points.append(obj.matrix_world @ Vector(corner))
    return (
      Vector((min(point.x for point in points), min(point.y for point in points), min(point.z for point in points))),
      Vector((max(point.x for point in points), max(point.y for point in points), max(point.z for point in points))),
    )


def triangle_count() -> int:
    total = 0
    for obj in bpy.context.scene.objects:
      if obj.type != "MESH":
        continue
      total += sum(max(len(poly.vertices) - 2, 1) for poly in obj.data.polygons)
    return total


def build_asset(bake_preview_path: Path | None = None, texture_package_dir: Path | None = None) -> dict[str, object]:
    random.seed(20260519)
    wood_image = make_image("surface_floor_plank_diffuse_1k", 1024, 1024, wood_painter)
    wood_normal = make_image("surface_floor_plank_normal_1k", 1024, 1024, normal_painter("wood"))
    wood_roughness = make_image("surface_floor_plank_roughness_1k", 1024, 1024, roughness_painter("wood"))
    wood_ao = make_image("surface_floor_plank_ao_1k", 1024, 1024, ao_painter("wood"))
    plaster_image = make_image("surface_plaster_warm_cool_diffuse_1k", 1024, 1024, plaster_painter)
    plaster_normal = make_image("surface_plaster_warm_cool_normal_1k", 1024, 1024, normal_painter("plaster"))
    plaster_roughness = make_image("surface_plaster_warm_cool_roughness_1k", 1024, 1024, roughness_painter("plaster"))
    plaster_ao = make_image("surface_plaster_warm_cool_ao_1k", 1024, 1024, ao_painter("plaster"))
    trim_image = make_image("surface_trim_warm_diffuse_512", 512, 512, trim_painter)
    trim_normal = make_image("surface_trim_warm_normal_512", 512, 512, normal_painter("trim"))
    trim_roughness = make_image("surface_trim_warm_roughness_512", 512, 512, roughness_painter("trim"))
    trim_ao = make_image("surface_trim_warm_ao_512", 512, 512, ao_painter("trim"))
    wood_orm = make_image("surface_floor_plank_orm_1k", 1024, 1024, orm_painter("wood", 0.02))
    plaster_orm = make_image("surface_plaster_warm_cool_orm_1k", 1024, 1024, orm_painter("plaster", 0.0))
    trim_orm = make_image("surface_trim_warm_orm_512", 512, 512, orm_painter("trim", 0.02))
    contact_lightmap = make_image("surface_contact_shadow_lightmap_rgba_1k", 1024, 1024, contact_shadow_lightmap_painter)
    wall_soft_wash_lightmap = make_image(
      "surface_wall_reveal_soft_wash_rgba_1k",
      1024,
      1024,
      wall_soft_wash_lightmap_painter,
    )
    bounce_lightmap = make_image(
      "surface_art_directed_bounce_lightmap_rgba_1k",
      1024,
      1024,
      art_directed_bounce_lightmap_painter,
    )
    cycles_ao_lightmap, cycles_ao_metadata = create_cycles_floor_ao_bake(bake_preview_path)
    orm_sidecars = [
      {
        "role": "floorWoodOrm",
        "image": wood_orm,
        "fileName": "surface_floor_plank_orm_1k.png",
        "resolution": [1024, 1024],
        "metallic": 0.02,
      },
      {
        "role": "plasterWallOrm",
        "image": plaster_orm,
        "fileName": "surface_plaster_warm_cool_orm_1k.png",
        "resolution": [1024, 1024],
        "metallic": 0.0,
      },
      {
        "role": "trimOrm",
        "image": trim_orm,
        "fileName": "surface_trim_warm_orm_512.png",
        "resolution": [512, 512],
        "metallic": 0.02,
      },
    ]
    orm_map_records: list[dict[str, object]] = []
    if texture_package_dir:
      texture_package_dir.mkdir(parents=True, exist_ok=True)
      for entry in orm_sidecars:
        image = set_non_color(entry["image"])  # type: ignore[arg-type]
        file_path = texture_package_dir / str(entry["fileName"])
        save_image_png(image, file_path)
        orm_map_records.append(
          {
            "role": entry["role"],
            "path": str(file_path),
            "resolution": entry["resolution"],
            "channels": {
              "r": "ambientOcclusion",
              "g": "roughness",
              "b": "metallic",
              "a": "constantOne",
            },
            "colorSpace": "Non-Color",
            "metallic": entry["metallic"],
          }
        )

    wood = pbr_textured_mat("surface_uv_wood_plank_oiled_pbr", wood_image, wood_normal, wood_roughness, wood_ao, wood_orm, 0.82, 0.02)
    plaster = pbr_textured_mat(
      "surface_uv_plaster_warm_cool_pbr",
      plaster_image,
      plaster_normal,
      plaster_roughness,
      plaster_ao,
      plaster_orm,
      0.94,
      0.0,
    )
    trim = pbr_textured_mat("surface_uv_trim_satin_warm_pbr", trim_image, trim_normal, trim_roughness, trim_ao, trim_orm, 0.7, 0.02)
    seam = simple_mat("surface_warm_recess_shadow", (0.11, 0.068, 0.048, 1), 0.9, 0.0, 0.82)
    floor_gap = simple_mat("surface_floor_gap_substrate_warm_shadow", (0.27, 0.16, 0.105, 1), 0.82, 0.0)
    cutaway_core = simple_mat("surface_cutaway_plywood_layered_core", (0.58, 0.38, 0.23, 1), 0.74, 0.02)
    cutaway_dark = simple_mat("surface_cutaway_dark_reveal_layer", (0.075, 0.062, 0.064, 1), 0.86, 0.0)
    glass = simple_mat("surface_window_glass_deep_blue_runtime_recess", (0.045, 0.075, 0.11, 1), 0.3, 0.0, 0.68, (0.18, 0.46, 0.78), 0.16)
    wall_reveal = simple_mat("surface_subtle_plaster_reveal", (0.34, 0.27, 0.31, 1), 0.92, 0.0, 0.085)
    cool = simple_mat("surface_cool_practical_strip", (0.46, 0.82, 1.0, 1), 0.38, 0.0, 1.0, (0.22, 0.68, 1.0), 0.45)
    warm = simple_mat("surface_warm_practical_strip", (1.0, 0.67, 0.42, 1), 0.42, 0.0, 1.0, (1.0, 0.36, 0.18), 0.35)
    pink = simple_mat("surface_pink_practical_strip", (1.0, 0.42, 0.62, 1), 0.42, 0.0, 1.0, (1.0, 0.18, 0.4), 0.32)
    shadow = textured_alpha_mat("surface_zone_contact_shadow_lightmap_cards", contact_lightmap)
    wall_wash = textured_alpha_mat("surface_wall_reveal_soft_wash_lightmap_cards", wall_soft_wash_lightmap)
    bounce = textured_alpha_mat("surface_art_directed_bounce_lightmap_cards", bounce_lightmap)
    cycles_ao = textured_alpha_mat("surface_cycles_baked_floor_ao_lightmap_cards", cycles_ao_lightmap)

    # Back and side plaster surfaces sit just inside the existing procedural shell.
    cube("surface_back_plaster_textured_panel", (6.28, 0.026, 2.22), (-0.08, 1.955, 1.46), plaster, 0.018)

    # The side wall is authored as segmented plaster around a real window
    # opening. A single slab behind the glass made the room read like a flat
    # overlay instead of a cutaway diorama shell.
    right_window_y_min = -1.42
    right_window_y_max = -0.02
    right_window_z_min = 0.5
    right_window_z_max = 2.38
    cube("surface_right_plaster_segment_front_of_window", (0.026, 0.44, 2.2), (3.055, -1.64, 1.44), plaster, 0.018)
    cube("surface_right_plaster_segment_back_of_window", (0.026, 1.94, 2.2), (3.055, 0.95, 1.44), plaster, 0.018)
    cube("surface_right_plaster_segment_under_window", (0.026, 1.4, 0.16), (3.055, -0.72, 0.42), plaster, 0.014)
    cube("surface_right_plaster_segment_above_window", (0.026, 1.4, 0.16), (3.055, -0.72, 2.46), plaster, 0.014)

    # A warm substrate prevents dark voids between planks and makes the floor
    # read as wood joinery instead of a black grout grid in the final camera.
    floor_substrate = cube("surface_floor_warm_gap_substrate", (6.42, 3.92, 0.018), (-0.06, -0.02, 0.02), floor_gap, 0.006)
    floor_substrate["deskterior_surface_role"] = "floor_gap_substrate"

    # Floor planks with varied lengths and tight micro bevels. The previous
    # spacing produced a tile-like dark grid; this layout keeps the seam lines
    # thin and mostly relies on material variation.
    plank_widths = [0.96, 1.22, 1.48, 0.78, 1.12, 1.34, 0.88]
    for row in range(10):
      y = -1.76 + row * 0.39
      x_cursor = -3.12 + (0.46 if row % 2 else 0.0)
      col = 0
      while x_cursor < 3.12:
        width = plank_widths[(row * 2 + col) % len(plank_widths)]
        center_x = x_cursor + width / 2
        if center_x < 3.12:
          plank = cube(
            f"surface_floor_plank_{row}_{col}",
            (width - 0.012, 0.374, 0.026),
            (center_x, y, 0.043 + (row % 2) * 0.0014),
            wood,
            0.012,
          )
          plank["deskterior_surface_role"] = "floor_plank"
        x_cursor += width
        col += 1

    for y in [-1.565, -1.175, -0.785, -0.395, -0.005, 0.385, 0.775, 1.165, 1.555]:
      cube(f"surface_floor_recess_line_{y:.2f}", (6.18, 0.007, 0.007), (-0.06, y, 0.064), seam, 0.001)
    for x in [-2.62, -1.52, -0.42, 0.68, 1.78, 2.72]:
      cube(f"surface_floor_short_endgrain_{x:.2f}", (0.008, 0.34, 0.008), (x, -0.86, 0.066), seam, 0.001)
      cube(f"surface_floor_short_endgrain_front_{x:.2f}", (0.008, 0.34, 0.008), (x + 0.48, 0.92, 0.066), seam, 0.001)

    # Trim and layered cutaway edges make the room read as an authored diorama.
    cube("surface_back_baseboard_cream_trim", (6.36, 0.072, 0.105), (-0.08, 1.91, 0.34), trim, 0.016)
    cube("surface_right_baseboard_cream_trim", (0.072, 3.86, 0.105), (3.01, 0.04, 0.34), trim, 0.016)
    cube("surface_back_crown_trim", (6.16, 0.06, 0.072), (-0.1, 1.91, 2.49), trim, 0.012)
    cube("surface_right_crown_trim", (0.06, 3.72, 0.072), (3.01, 0.02, 2.49), trim, 0.012)
    cube("surface_left_cutaway_wood_edge", (0.12, 3.92, 0.13), (-3.12, 0.02, 0.1), trim, 0.018)
    cube("surface_front_cutaway_wood_edge", (6.24, 0.12, 0.13), (-0.02, -2.04, 0.1), trim, 0.018)
    cube("surface_front_cutaway_plywood_core", (6.18, 0.055, 0.076), (-0.02, -2.115, 0.16), cutaway_core, 0.01)
    cube("surface_front_cutaway_shadow_reveal", (6.2, 0.018, 0.024), (-0.02, -2.153, 0.235), cutaway_dark, 0.004)
    cube("surface_left_cutaway_plywood_core", (0.055, 3.84, 0.076), (-3.195, 0.0, 0.16), cutaway_core, 0.01)
    cube("surface_left_cutaway_shadow_reveal", (0.018, 3.86, 0.024), (-3.233, 0.0, 0.235), cutaway_dark, 0.004)

    # Window recess geometry belongs in the authored room surface kit so the
    # side wall does not depend only on React fallback blocks for its focal
    # architectural detail.
    cube("surface_right_window_inner_reveal_front_jamb", (0.12, 0.03, 1.82), (3.012, right_window_y_min, 1.44), wall_reveal, 0.006)
    cube("surface_right_window_inner_reveal_back_jamb", (0.12, 0.03, 1.82), (3.012, right_window_y_max, 1.44), wall_reveal, 0.006)
    cube("surface_right_window_inner_reveal_head", (0.12, 1.34, 0.034), (3.012, -0.72, right_window_z_max), wall_reveal, 0.006)
    cube("surface_right_window_inner_reveal_sill", (0.12, 1.34, 0.034), (3.012, -0.72, right_window_z_min), wall_reveal, 0.006)
    cube("surface_right_window_recess_shadow_panel", (0.012, 1.08, 1.52), (3.022, -0.72, 1.44), seam, 0.003)
    cube("surface_right_window_deep_glass", (0.014, 0.78, 1.22), (3.012, -0.72, 1.42), glass, 0.012)
    cube("surface_right_window_outer_trim_left", (0.062, 0.062, 1.72), (3.0, -1.31, 1.45), trim, 0.012)
    cube("surface_right_window_outer_trim_right", (0.062, 0.062, 1.72), (3.0, -0.13, 1.45), trim, 0.012)
    cube("surface_right_window_outer_trim_top", (0.062, 1.2, 0.08), (3.0, -0.72, 2.34), trim, 0.012)
    cube("surface_right_window_outer_trim_bottom", (0.068, 1.24, 0.088), (3.0, -0.72, 0.58), trim, 0.012)
    cube("surface_right_window_sill_layered_front", (0.16, 1.34, 0.092), (2.955, -0.72, 0.46), trim, 0.014)
    for index, z in enumerate([1.02, 1.28, 1.54, 1.8]):
      cube(
        f"surface_right_window_cool_blind_slats_{index}",
        (0.018, 0.66 - index * 0.018, 0.035),
        (2.986, -0.7, z),
        cool,
        0.006,
      )

    for x in [-2.42, -1.18, 0.08, 1.36, 2.56]:
      cube(f"surface_back_plaster_reveal_v_{x:.2f}", (0.012, 0.014, 1.82), (x, 1.935, 1.47), wall_reveal, 0.003)
    for z in [0.78, 1.34, 1.92, 2.34]:
      cube(f"surface_back_plaster_reveal_h_{z:.2f}", (5.92, 0.014, 0.01), (-0.1, 1.934, z), wall_reveal, 0.003)
    for y in [-1.16, -0.28, 0.62, 1.48]:
      if right_window_y_min <= y <= right_window_y_max:
        continue
      cube(f"surface_right_plaster_reveal_depth_{y:.2f}", (0.012, 0.014, 1.78), (3.037, y, 1.44), wall_reveal, 0.003)
    for z in [0.76, 1.36, 1.98]:
      cube(f"surface_right_plaster_reveal_h_front_{z:.2f}", (0.012, 0.38, 0.01), (3.036, -1.63, z), wall_reveal, 0.003)
      cube(f"surface_right_plaster_reveal_h_back_{z:.2f}", (0.012, 1.8, 0.01), (3.036, 0.9, z), wall_reveal, 0.003)

    wall_wash_cards = [
      ("back_lower_material_shadow", (5.8, 1.02), (-0.38, 1.927, 0.82), (math.radians(90), 0, 0)),
      ("back_upper_cool_warm_bounce", (5.25, 1.32), (-0.26, 1.926, 1.84), (math.radians(90), 0, 0)),
      ("right_lower_front_material_shadow", (1.0, 0.36), (3.039, -1.64, 0.78), (0, math.radians(90), 0)),
      ("right_lower_back_material_shadow", (1.0, 1.88), (3.039, 0.92, 0.78), (0, math.radians(90), 0)),
      ("right_upper_front_pink_cool_bounce", (1.22, 0.36), (3.038, -1.64, 1.8), (0, math.radians(90), 0)),
      ("right_upper_back_pink_cool_bounce", (1.22, 1.78), (3.038, 0.86, 1.8), (0, math.radians(90), 0)),
    ]
    for zone, size, loc, rotation in wall_wash_cards:
      card = plane_card(f"surface_wall_soft_reveal_wash_{zone}", size, loc, wall_wash, rotation)
      card["deskterior_wall_cleanup_zone"] = zone
      card["deskterior_surface_role"] = "soft_wall_material_wash"

    cycles_ao_card = plane_card(
      "surface_cycles_baked_floor_ao_probe_full_room",
      (6.28, 3.86),
      (-0.08, -0.06, 0.089),
      cycles_ao,
      (0, 0, 0),
    )
    cycles_ao_card["deskterior_cycles_bake_probe"] = "floor_proxy_ao"
    cycles_ao_card["deskterior_surface_role"] = "cycles_ao_bake_lightmap"

    floor_bounce_zones = [
      ("desk_warm_screen_pool", (2.62, 1.04), (-0.52, -0.88, 0.082), 0.03),
      ("pc_tower_cool_edge", (1.04, 0.62), (0.9, -0.48, 0.083), -0.12),
      ("sofa_amber_low_fill", (2.06, 0.9), (-1.58, 1.18, 0.084), 0.04),
      ("coffee_table_soft_occlusion", (1.28, 0.7), (0.34, 0.98, 0.085), -0.07),
      ("media_pink_floor_spill", (1.82, 0.82), (2.02, -1.28, 0.084), 0.0),
    ]
    for zone, size, loc, rotation_z in floor_bounce_zones:
      card = plane_card(f"surface_art_bounce_floor_{zone}", size, loc, bounce, (0, 0, rotation_z))
      card["deskterior_art_directed_bounce_zone"] = zone
      card["deskterior_surface_role"] = "art_directed_bounce_lightmap"

    wall_bounce_zones = [
      ("desk_screen_back_wall", (2.72, 0.98), (-0.52, 1.925, 1.22), (math.radians(90), 0, 0)),
      ("shelf_low_occlusion_back_wall", (1.84, 0.82), (-2.28, 1.924, 1.04), (math.radians(90), 0, 0)),
      ("window_cool_side_falloff", (1.28, 2.05), (3.034, 0.55, 1.62), (0, math.radians(90), 0)),
      ("media_pink_side_wall", (1.22, 1.62), (3.033, -1.18, 1.2), (0, math.radians(90), 0)),
    ]
    for zone, size, loc, rotation in wall_bounce_zones:
      card = plane_card(f"surface_art_bounce_wall_{zone}", size, loc, bounce, rotation)
      card["deskterior_art_directed_bounce_zone"] = zone
      card["deskterior_surface_role"] = "art_directed_wall_bounce_lightmap"

    cube("surface_back_cove_cool_led", (4.86, 0.02, 0.026), (-0.36, 1.922, 2.54), cool, 0.006)
    cube("surface_right_cove_pink_led", (0.022, 2.8, 0.026), (3.0, -0.28, 2.54), pink, 0.006)
    cube("surface_floor_warm_under_desk_glow", (2.86, 0.018, 0.018), (-0.54, 1.36, 0.12), warm, 0.006)

    # Blender-authored contact-shadow lightmap cards. They remain separate from
    # runtime overlays so QA can verify authored AO/contact evidence in the GLB.
    contact_zones = [
      ("desk", (2.65, 0.66), (-0.52, -1.02, 0.071), 0.02),
      ("desk_accessories", (0.92, 0.36), (-1.74, -0.48, 0.073), 0.1),
      ("pc_tower", (0.82, 0.42), (0.82, -0.5, 0.074), -0.12),
      ("sofa", (1.96, 0.84), (-1.64, 1.18, 0.075), 0.03),
      ("coffee_table", (1.25, 0.55), (0.35, 1.0, 0.076), -0.08),
      ("media_console", (1.74, 0.46), (2.08, -1.43, 0.075), 0.0),
      ("shelf", (1.78, 0.46), (-2.36, -1.5, 0.076), 0.04),
    ]
    for zone, size, loc, rotation_z in contact_zones:
      card = plane_card(f"surface_baked_contact_lightmap_{zone}", size, loc, shadow, (0, 0, rotation_z))
      card["deskterior_baked_lightmap_zone"] = zone
      card["deskterior_surface_role"] = "baked_contact_shadow"

    wall_contact_zones = [
      ("desk_back_wall", (2.45, 0.72), (-0.65, 1.928, 0.9), (math.radians(90), 0, 0)),
      ("shelf_back_wall", (1.72, 0.66), (-2.34, 1.929, 1.16), (math.radians(90), 0, 0)),
      ("media_side_wall", (1.65, 0.7), (3.038, -1.2, 0.92), (0, math.radians(90), 0)),
      ("sofa_side_wall", (1.86, 0.58), (3.039, 0.82, 0.82), (0, math.radians(90), 0)),
    ]
    for zone, size, loc, rotation in wall_contact_zones:
      card = plane_card(f"surface_baked_wall_lightmap_{zone}", size, loc, shadow, rotation)
      card["deskterior_baked_lightmap_zone"] = zone
      card["deskterior_surface_role"] = "baked_wall_contact_shadow"

    for obj in mesh_objects():
      obj["deskterior_asset_slug"] = "p2s-bruno-room-surface-kit"
    return {
      "surfaceTextureRoles": [
        "baseColor",
        "normal",
        "roughness",
        "ambientOcclusion",
        "contactShadowLightmap",
        "artDirectedBounceLightmap",
        "cyclesAoBakeLightmap",
        "packedOrm",
      ],
      "generatedPbrMapCount": 19,
      "bakedContactShadowZones": [zone for zone, _, _, _ in contact_zones],
      "bakedWallContactShadowZones": [zone for zone, _, _, _ in wall_contact_zones],
      "wallRevealCleanupZones": [zone for zone, _, _, _ in wall_wash_cards],
      "artDirectedFloorBounceZones": [zone for zone, _, _, _ in floor_bounce_zones],
      "artDirectedWallBounceZones": [zone for zone, _, _, _ in wall_bounce_zones],
      "cyclesAoBakeMetadata": cycles_ao_metadata,
      "packedOrmMaps": orm_map_records,
      "texturePackaging": {
        "packageStatus": "orm-png-sidecar-ready-ktx2-pending",
        "packedOrmMapCount": len(orm_map_records),
        "packedOrmChannels": {
          "r": "ambientOcclusion",
          "g": "roughness",
          "b": "metallic",
          "a": "constantOne",
        },
        "ormSidecarFormat": "PNG",
        "ktx2Ready": False,
        "ktx2TranscodeAttempted": False,
        "ktx2Blocker": "toktx encoder was not available in the local environment",
        "toktxAvailable": shutil.which("toktx") is not None,
        "stillRequiresRuntimeKtx2Transcode": True,
        "stillRequiresFinalUvBake": True,
      },
      "wallRevealLineOpacityAfter": 0.085,
      "ktx2Ready": False,
      "lightmapMethod": "procedural Blender-authored RGBA contact-shadow cards with zone metadata; not path-traced GI",
      "wallRevealCleanupMethod": "hard plaster reveal lines reduced below 0.1 alpha and softened with four tinted RGBA wall-wash cards",
      "artDirectedGiMethod": "hand-authored RGBA bounce and low-occlusion lightmap cards for desk, sofa, PC, media, shelf, and window-adjacent wall zones; not a path-traced irradiance bake",
    }


def configure_thumbnail(objects: list[bpy.types.Object]) -> None:
    min_v, max_v = world_bounds(objects)
    size = max_v - min_v
    target = (min_v + max_v) * 0.5
    radius = max(size.x, size.y, size.z, 1.0)
    bpy.ops.object.light_add(type="AREA", location=(-1.8, 1.8, 3.5))
    key = bpy.context.object
    key.name = "surface_review_key_softbox"
    key.data.energy = 360
    key.data.size = 4.5
    bpy.ops.object.light_add(type="AREA", location=(2.6, -2.0, 2.3))
    fill = bpy.context.object
    fill.name = "surface_review_cool_fill"
    fill.data.energy = 95
    fill.data.color = (0.62, 0.78, 1.0)
    fill.data.size = 3.0
    camera_location = Vector((radius * 0.52, radius * 0.82, radius * 0.54))
    rotation = (target - camera_location).to_track_quat("-Z", "Y").to_euler()
    bpy.ops.object.camera_add(location=camera_location, rotation=rotation)
    camera = bpy.context.object
    camera.name = "surface_review_camera"
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 6.4
    bpy.context.scene.camera = camera


def render_thumbnail(path: Path) -> None:
    for view_transform in ["AgX", "Filmic", "Standard"]:
      try:
        bpy.context.scene.view_settings.view_transform = view_transform
        break
      except Exception:
        continue
    for look in ["AgX - Medium High Contrast", "Medium High Contrast", "AgX - High Contrast", "None"]:
      try:
        bpy.context.scene.view_settings.look = look
        break
      except Exception:
        continue
    bpy.context.scene.view_settings.exposure = -0.2
    bpy.context.scene.render.resolution_x = 1024
    bpy.context.scene.render.resolution_y = 768
    bpy.context.scene.eevee.taa_render_samples = 64
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


def main() -> int:
    args = parse_args()
    repo_root = Path(args.repo_root).resolve()
    runtime_dir = repo_root / "assets/runtime-candidates/blender-authored/bruno-room-surface-kit"
    public_dir = repo_root / "apps/web/public/assets/models/p2s_bruno_room_surface_kit"
    reference_dir = repo_root / "assets/references/blender-authored/bruno-room-surface-kit"
    blend_path = repo_root / "assets/blender/deskterior/p2s_bruno_room_surface_kit.blend"
    runtime_dir.mkdir(parents=True, exist_ok=True)
    public_dir.mkdir(parents=True, exist_ok=True)
    reference_dir.mkdir(parents=True, exist_ok=True)
    blend_path.parent.mkdir(parents=True, exist_ok=True)

    runtime_glb = runtime_dir / "p2s_bruno_room_surface_kit.glb"
    public_glb = public_dir / "p2s_bruno_room_surface_kit.glb"
    thumbnail = runtime_dir / "p2s_bruno_room_surface_kit.thumbnail.webp"
    cycles_ao_bake_preview = runtime_dir / "p2s_bruno_room_surface_kit.cycles-floor-ao-bake.png"
    texture_package_dir = runtime_dir / "textures"
    texture_package_manifest = runtime_dir / "texture-package-2026-05-19.json"
    review_path = reference_dir / "asset-review-2026-05-19.json"

    clear_scene()
    asset_metadata = build_asset(cycles_ao_bake_preview, texture_package_dir)
    apply_modifiers()
    objects = mesh_objects()
    configure_thumbnail(objects)
    bpy.ops.wm.save_as_mainfile(filepath=str(blend_path))
    render_thumbnail(thumbnail)
    export_glb(runtime_glb)
    shutil.copy2(runtime_glb, public_glb)

    min_v, max_v = world_bounds(objects)
    dimensions = max_v - min_v
    packed_orm_maps = []
    for entry in asset_metadata["packedOrmMaps"]:
      packed_orm_maps.append(
        {
          **entry,
          "path": str(Path(str(entry["path"])).relative_to(repo_root)),
        }
      )
    texture_package = {
      **asset_metadata["texturePackaging"],
      "manifest": str(texture_package_manifest.relative_to(repo_root)),
      "packedOrmMaps": packed_orm_maps,
      "promotionBoundary": "ORM sidecar package evidence only; KTX2 transcode, final UV bake, and release catalog packaging remain blocked",
    }
    texture_package_manifest.write_text(
      json.dumps(
        {
          "schemaVersion": "deskterior-texture-package-v1",
          "assetSlug": "p2s-bruno-room-surface-kit",
          **texture_package,
        },
        indent=2,
      ),
      encoding="utf-8",
    )
    report = {
      "schemaVersion": "deskterior-blender-authored-asset-review-v1",
      "asset": {
        "slug": "p2s-bruno-room-surface-kit",
        "intent": "large-surface material depth kit for Bruno-inspired cutaway room mood",
        "source": "Blender procedural authoring by Codex with generated UV diffuse atlases; no Bruno Simon source asset copied",
        "license": "project-owned prototype asset pending product license review",
        "textureSet": {
          "authoredMaps": asset_metadata["surfaceTextureRoles"],
          "generatedPbrMapCount": asset_metadata["generatedPbrMapCount"],
          "ktx2Ready": asset_metadata["ktx2Ready"],
          "packedOrmMapCount": len(packed_orm_maps),
          "packedOrmReady": len(packed_orm_maps) >= 3,
        },
        "bakedContactShadowPass": {
          "method": asset_metadata["lightmapMethod"],
          "floorZones": asset_metadata["bakedContactShadowZones"],
          "wallZones": asset_metadata["bakedWallContactShadowZones"],
          "runtimeOverlayReplacement": False,
        },
        "wallRevealCleanupPass": {
          "method": asset_metadata["wallRevealCleanupMethod"],
          "lineOpacityBefore": 0.34,
          "lineOpacityAfter": asset_metadata["wallRevealLineOpacityAfter"],
          "softWashZones": asset_metadata["wallRevealCleanupZones"],
          "gridOverlayRisk": "reduced-not-eliminated",
          "stillRequiresBrowserHumanReview": True,
        },
        "artDirectedGiPass": {
          "method": asset_metadata["artDirectedGiMethod"],
          "floorBounceZones": asset_metadata["artDirectedFloorBounceZones"],
          "wallBounceZones": asset_metadata["artDirectedWallBounceZones"],
          "physicallyBaked": False,
          "runtimeOverlayReplacement": False,
          "stillRequiresPathTracedBake": True,
        },
        "cyclesAoBakePass": {
          "method": "Blender Cycles AO bake from temporary room/furniture blocker proxies, converted into a transparent floor lightmap card",
          **asset_metadata["cyclesAoBakeMetadata"],
        },
        "texturePackagingPass": texture_package,
      },
      "outputs": {
        "blend": str(blend_path.relative_to(repo_root)),
        "runtimeGlb": str(runtime_glb.relative_to(repo_root)),
        "publicGlb": str(public_glb.relative_to(repo_root)),
        "thumbnail": str(thumbnail.relative_to(repo_root)),
        "cyclesAoBakePreview": str(cycles_ao_bake_preview.relative_to(repo_root)),
        "texturePackageManifest": str(texture_package_manifest.relative_to(repo_root)),
        "texturePackageDirectory": str(texture_package_dir.relative_to(repo_root)),
      },
      "metrics": {
        "dimensionsM": [round(dimensions.x, 4), round(dimensions.y, 4), round(dimensions.z, 4)],
        "objectCount": len(objects),
        "materialCount": len(bpy.data.materials),
        "textureCount": len(bpy.data.images),
        "triangleCount": triangle_count(),
        "runtimeBytes": runtime_glb.stat().st_size,
        "publicBytes": public_glb.stat().st_size,
      },
      "comparisonReview": {
        "commercialPatternsApplied": [
          "generated baseColor, normal, roughness, and AO helper maps for wood planks, plaster, and trim instead of flat colors",
          "individual bevelled floor planks with staggered seams and endgrain shadow strips",
          "warm floor substrate and tighter plank spacing to avoid black grid artifacts in the final cinematic camera",
          "layered plaster panels, baseboards, crown trim, cove light bars, and cutaway edge trim",
          "layered plywood/dark reveal cutaway edges so the room shell reads as constructed thickness instead of one flat slab",
          "segmented side-wall plaster around a real window opening, with authored recess, glass, sill, trim, and cool blind slats inside the GLB",
          "zone-tagged RGBA contact-shadow lightmap cards under desk, sofa, PC, coffee-table, shelf, and media zones",
          "wall contact-shadow lightmap cards for desk, shelf, media, and sofa adjacency",
          "hard wall reveal grid opacity reduced and replaced with broad tinted wall-wash cards so the wall reads more like plaster depth than UI guide lines",
          "hand-authored colored bounce lightmap cards for desk glow, sofa floor fill, PC edge fill, media wall spill, shelf occlusion, and window-side cool falloff",
          "Cycles AO bake probe rendered from temporary blocker proxies and embedded back into the GLB as a transparent floor lightmap card",
          "packed ORM PNG sidecar package authored for wood, plaster, and trim materials with AO in R, roughness in G, metallic in B, and KTX2 readiness kept false",
        ],
        "knownGapsBeforeCommercialPromotion": [
          "helper normal/roughness/AO/ORM maps are procedural and need real UV unwrap and art-directed texture bake",
          "contact-shadow and colored bounce lightmap cards are authored evidence; the Cycles AO probe is physically baked AO but not a path-traced global-illumination bake",
          "geometry is still stylized and must be compared against commercial diorama room packs",
          "ORM sidecar PNG package exists, but there is still no KTX2 texture transcode, LOD/proxy package, collider sidecar, or release metadata",
        ],
        "currentGrade": "runtime QA candidate, not final commercial catalog asset",
      },
    }
    review_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
