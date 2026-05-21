#!/usr/bin/env python3
"""Generate a Blender-authored large-furniture hero kit for the PC room QA scene.

This asset raises the quality of the largest visible furniture masses in the
Bruno-inspired cutaway room without copying reference assets. It is still a
prototype QA candidate, but it moves sofa, rug, coffee table, shelf, desk, and
media console surfaces out of pure React block geometry and into an authored
GLB with material variation, bevels, and dense prop detail.
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
    world.color = (0.055, 0.052, 0.06)


def to_blender_loc(loc: tuple[float, float, float]) -> tuple[float, float, float]:
    # Source scene is Three/R3F Y-up. Blender authoring is Z-up before GLB export_yup.
    return (loc[0], -loc[2], loc[1])


def to_blender_size(size: tuple[float, float, float]) -> tuple[float, float, float]:
    return (size[0], size[2], size[1])


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


def set_color_space(image: bpy.types.Image, color_space: str) -> None:
    try:
        image.colorspace_settings.name = color_space
    except Exception:
        pass


def wood_painter(u: float, v: float, x: int, y: int) -> tuple[float, float, float, float]:
    seed = random.Random(x * 1709 + y * 413)
    grain = 0.5 + 0.5 * math.sin((u * 7.0 + v * 31.0 + math.sin(u * 18.0) * 0.42) * math.pi)
    pore = seed.random() * 0.075
    plank = 0.94 + (int(v * 5) % 3) * 0.035
    return (
        min(0.86, (0.5 + grain * 0.12 + pore) * plank),
        min(0.55, (0.29 + grain * 0.07 + pore * 0.45) * plank),
        min(0.36, (0.17 + grain * 0.045 + pore * 0.28) * plank),
        1.0,
    )


def fabric_painter(u: float, v: float, x: int, y: int) -> tuple[float, float, float, float]:
    seed = random.Random(x * 397 + y * 1877)
    weave = 0.5 + 0.5 * math.sin((u * 84.0) * math.pi)
    cross = 0.5 + 0.5 * math.sin((v * 72.0 + 0.4) * math.pi)
    noise = (seed.random() - 0.5) * 0.07
    value = 0.28 + weave * 0.045 + cross * 0.04 + noise
    return (value * 0.7, value * 0.86, min(0.62, value * 1.25), 1.0)


def lacquer_painter(u: float, v: float, x: int, y: int) -> tuple[float, float, float, float]:
    seed = random.Random(x * 631 + y * 919)
    micro = (seed.random() - 0.5) * 0.035
    warm_edge = 0.035 * max(0.0, 1.0 - min(u, 1 - u, v, 1 - v) * 8.0)
    return (0.86 + warm_edge + micro, 0.82 + warm_edge * 0.45 + micro * 0.7, 0.79 + micro * 0.55, 1.0)


def speaker_painter(u: float, v: float, x: int, y: int) -> tuple[float, float, float, float]:
    grille = 0.5 + 0.5 * math.sin(u * math.pi * 42.0) * math.sin(v * math.pi * 42.0)
    base = 0.07 + grille * 0.055
    return (base, base * 1.08, base * 1.18, 1.0)


def height_value(kind: str, u: float, v: float) -> float:
    if kind == "wood":
        return 0.44 + 0.24 * math.sin((u * 7.0 + v * 31.0 + math.sin(u * 18.0) * 0.42) * math.pi)
    if kind == "fabric":
        warp = 0.5 + 0.5 * math.sin(u * 84.0 * math.pi)
        weft = 0.5 + 0.5 * math.sin((v * 72.0 + 0.4) * math.pi)
        return 0.36 + warp * 0.14 + weft * 0.12
    if kind == "lacquer":
        edge = max(0.0, 1.0 - min(u, 1 - u, v, 1 - v) * 10.0)
        ripple = 0.5 + 0.5 * math.sin((u * 9.0 + v * 5.0) * math.pi)
        return 0.48 + edge * 0.12 + ripple * 0.035
    if kind == "speaker":
        grille = 0.5 + 0.5 * math.sin(u * math.pi * 42.0) * math.sin(v * math.pi * 42.0)
        return 0.34 + grille * 0.22
    return 0.5


def normal_painter(kind: str, strength: float):
    def paint(u: float, v: float, x: int, y: int) -> tuple[float, float, float, float]:
        du = 1.0 / 512.0
        dv = 1.0 / 512.0
        h_l = height_value(kind, max(0.0, u - du), v)
        h_r = height_value(kind, min(1.0, u + du), v)
        h_d = height_value(kind, u, max(0.0, v - dv))
        h_u = height_value(kind, u, min(1.0, v + dv))
        nx = -(h_r - h_l) * strength
        ny = -(h_u - h_d) * strength
        nz = 1.0
        length = math.sqrt(nx * nx + ny * ny + nz * nz)
        return (nx / length * 0.5 + 0.5, ny / length * 0.5 + 0.5, nz / length * 0.5 + 0.5, 1.0)

    return paint


def roughness_painter(kind: str, base: float):
    def paint(u: float, v: float, x: int, y: int) -> tuple[float, float, float, float]:
        seed = random.Random(x * 941 + y * 1597 + len(kind) * 37)
        h = height_value(kind, u, v)
        micro = (seed.random() - 0.5) * 0.06
        value = max(0.18, min(0.98, base + (h - 0.5) * 0.18 + micro))
        return (value, value, value, 1.0)

    return paint


def ao_painter(kind: str):
    def paint(u: float, v: float, x: int, y: int) -> tuple[float, float, float, float]:
        edge = max(0.0, 1.0 - min(u, 1 - u, v, 1 - v) * 8.0)
        groove = max(0.0, height_value(kind, u, v) - 0.56)
        value = max(0.56, min(1.0, 1.0 - edge * 0.12 - groove * 0.16))
        return (value, value, value, 1.0)

    return paint


def orm_painter(kind: str, roughness: float, metallic: float = 0.0):
    roughness_map = roughness_painter(kind, roughness)
    ao_map = ao_painter(kind)

    def paint(u: float, v: float, x: int, y: int) -> tuple[float, float, float, float]:
        ao_value = ao_map(u, v, x, y)[0]
        roughness_value = roughness_map(u, v, x, y)[0]
        return (ao_value, roughness_value, metallic, 1.0)

    return paint


def save_image_png(image: bpy.types.Image, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    image.filepath_raw = str(path)
    image.file_format = "PNG"
    image.save()


def make_pbr_texture_set(
    slug: str,
    width: int,
    height: int,
    diffuse_painter,
    kind: str,
    roughness: float,
) -> dict[str, bpy.types.Image]:
    maps = {
        "baseColor": make_image(f"{slug}_basecolor", width, height, diffuse_painter),
        "normal": make_image(f"{slug}_normal", width, height, normal_painter(kind, 7.5 if kind in {"wood", "speaker"} else 4.4)),
        "roughness": make_image(f"{slug}_roughness", width, height, roughness_painter(kind, roughness)),
        "ambientOcclusion": make_image(f"{slug}_ao", width, height, ao_painter(kind)),
    }
    set_color_space(maps["baseColor"], "sRGB")
    for image in [maps["normal"], maps["roughness"], maps["ambientOcclusion"]]:
        set_color_space(image, "Non-Color")
    return maps


def textured_mat(
    name: str,
    maps: dict[str, bpy.types.Image] | bpy.types.Image,
    roughness: float,
    metallic: float = 0.0,
) -> bpy.types.Material:
    material = bpy.data.materials.new(name)
    material.use_nodes = True
    nodes = material.node_tree.nodes
    bsdf = nodes.get("Principled BSDF")
    texture_maps = maps if isinstance(maps, dict) else {"baseColor": maps}
    base_tex = nodes.new(type="ShaderNodeTexImage")
    base_tex.name = f"{name}_base_color"
    base_tex.image = texture_maps["baseColor"]
    if bsdf:
        base_color_output = base_tex.outputs["Color"]
        ao_image = texture_maps.get("ambientOcclusion")
        if ao_image:
            ao_tex = nodes.new(type="ShaderNodeTexImage")
            ao_tex.name = f"{name}_ambient_occlusion"
            ao_tex.image = ao_image
            try:
                mix = nodes.new(type="ShaderNodeMixRGB")
                mix.name = f"{name}_ao_multiply"
                mix.blend_type = "MULTIPLY"
                mix.inputs["Fac"].default_value = 0.34
                material.node_tree.links.new(base_color_output, mix.inputs["Color1"])
                material.node_tree.links.new(ao_tex.outputs["Color"], mix.inputs["Color2"])
                base_color_output = mix.outputs["Color"]
            except Exception:
                pass
        material.node_tree.links.new(base_color_output, bsdf.inputs["Base Color"])
        roughness_image = texture_maps.get("roughness")
        if roughness_image:
            rough_tex = nodes.new(type="ShaderNodeTexImage")
            rough_tex.name = f"{name}_roughness"
            rough_tex.image = roughness_image
            material.node_tree.links.new(rough_tex.outputs["Color"], bsdf.inputs["Roughness"])
        normal_image = texture_maps.get("normal")
        if normal_image:
            normal_tex = nodes.new(type="ShaderNodeTexImage")
            normal_tex.name = f"{name}_normal"
            normal_tex.image = normal_image
            normal_map = nodes.new(type="ShaderNodeNormalMap")
            normal_map.name = f"{name}_normal_map"
            normal_map.inputs["Strength"].default_value = 0.42
            material.node_tree.links.new(normal_tex.outputs["Color"], normal_map.inputs["Color"])
            material.node_tree.links.new(normal_map.outputs["Normal"], bsdf.inputs["Normal"])
        bsdf.inputs["Roughness"].default_value = roughness
        bsdf.inputs["Metallic"].default_value = metallic
    return material


def mat(
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
    yaw: float = 0.0,
    bevel: float = 0.01,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cube_add(size=1, location=to_blender_loc(loc), rotation=(0, 0, yaw))
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = to_blender_size(size)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    obj.data.materials.append(material)
    if bevel > 0:
        bevel_mod = obj.modifiers.new(f"{name}_soft_bevel", "BEVEL")
        bevel_mod.width = bevel
        bevel_mod.segments = 3
        bevel_mod.affect = "EDGES"
        normal_mod = obj.modifiers.new(f"{name}_weighted_normals", "WEIGHTED_NORMAL")
        normal_mod.keep_sharp = True
    return obj


def cylinder_y(
    name: str,
    radius: float,
    depth: float,
    loc: tuple[float, float, float],
    material: bpy.types.Material,
    vertices: int = 32,
    yaw: float = 0.0,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cylinder_add(
        vertices=vertices,
        radius=radius,
        depth=depth,
        location=to_blender_loc(loc),
        rotation=(math.pi / 2, 0, yaw),
    )
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(material)
    bevel_mod = obj.modifiers.new(f"{name}_rim_bevel", "BEVEL")
    bevel_mod.width = min(radius * 0.08, 0.006)
    bevel_mod.segments = 2
    obj.modifiers.new(f"{name}_weighted_normals", "WEIGHTED_NORMAL")
    return obj


def sphere(
    name: str,
    loc: tuple[float, float, float],
    scale: tuple[float, float, float],
    material: bpy.types.Material,
    rotation: tuple[float, float, float] = (0, 0, 0),
    segments: int = 24,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_uv_sphere_add(
        segments=segments,
        ring_count=max(8, segments // 2),
        radius=1,
        location=to_blender_loc(loc),
        rotation=(rotation[0], rotation[2], rotation[1]),
    )
    obj = bpy.context.object
    obj.name = name
    obj.scale = to_blender_size(scale)
    obj.data.materials.append(material)
    obj.modifiers.new(f"{name}_weighted_normals", "WEIGHTED_NORMAL")
    return obj


def rounded_rect_points(width: float, depth: float, radius: float, segments: int) -> list[tuple[float, float]]:
    half_x = width * 0.5
    half_z = depth * 0.5
    radius = max(0.001, min(radius, half_x * 0.92, half_z * 0.92))
    corner_specs = [
        ((half_x - radius, half_z - radius), 0.0, math.pi * 0.5),
        ((-half_x + radius, half_z - radius), math.pi * 0.5, math.pi),
        ((-half_x + radius, -half_z + radius), math.pi, math.pi * 1.5),
        ((half_x - radius, -half_z + radius), math.pi * 1.5, math.pi * 2.0),
    ]
    points: list[tuple[float, float]] = []
    for center, start, end in corner_specs:
        for index in range(segments + 1):
            if points and index == 0:
                continue
            theta = start + (end - start) * (index / segments)
            points.append((center[0] + math.cos(theta) * radius, center[1] + math.sin(theta) * radius))
    return points


def source_vertex_to_blender(
    local: tuple[float, float, float],
    loc: tuple[float, float, float],
    yaw: float,
) -> tuple[float, float, float]:
    cos_yaw = math.cos(yaw)
    sin_yaw = math.sin(yaw)
    x = local[0] * cos_yaw - local[2] * sin_yaw + loc[0]
    z = local[0] * sin_yaw + local[2] * cos_yaw + loc[2]
    return to_blender_loc((x, loc[1] + local[1], z))


def rounded_rect_slab(
    name: str,
    size: tuple[float, float, float],
    loc: tuple[float, float, float],
    material: bpy.types.Material,
    yaw: float = 0.0,
    radius: float = 0.08,
    segments: int = 6,
    profile: str = "cushion",
) -> bpy.types.Object:
    width, height, depth = size
    perimeter = rounded_rect_points(width, depth, radius, segments)
    half_y = height * 0.5
    if profile == "table":
        profile_rings = [
            (-half_y, 0.94, 0.94),
            (-half_y * 0.38, 1.0, 1.0),
            (half_y * 0.62, 1.0, 1.0),
            (half_y, 0.96, 0.96),
        ]
    elif profile == "arm":
        profile_rings = [
            (-half_y, 0.88, 0.94),
            (-half_y * 0.48, 1.0, 1.0),
            (half_y * 0.42, 1.02, 1.0),
            (half_y, 0.82, 0.9),
        ]
    else:
        profile_rings = [
            (-half_y, 0.86, 0.9),
            (-half_y * 0.48, 0.99, 1.0),
            (half_y * 0.28, 1.02, 1.02),
            (half_y * 0.78, 0.98, 0.98),
            (half_y, 0.84, 0.88),
        ]

    vertices: list[tuple[float, float, float]] = []
    for y_offset, scale_x, scale_z in profile_rings:
        for x, z in perimeter:
            vertices.append(source_vertex_to_blender((x * scale_x, y_offset, z * scale_z), loc, yaw))

    ring_size = len(perimeter)
    faces: list[tuple[int, ...]] = []
    for ring_index in range(len(profile_rings) - 1):
        base = ring_index * ring_size
        next_base = (ring_index + 1) * ring_size
        for index in range(ring_size):
            faces.append((base + index, base + (index + 1) % ring_size, next_base + (index + 1) % ring_size, next_base + index))
    faces.append(tuple(reversed(range(ring_size))))
    top_start = (len(profile_rings) - 1) * ring_size
    faces.append(tuple(top_start + index for index in range(ring_size)))

    mesh = bpy.data.meshes.new(f"{name}_mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    obj.modifiers.new(f"{name}_weighted_normals", "WEIGHTED_NORMAL")
    obj["deskterior_curved_topology"] = profile
    return obj


def assign_grid_uv(mesh: bpy.types.Mesh, uvs_by_vertex: list[tuple[float, float]]) -> None:
    uv_layer = mesh.uv_layers.new(name="UVMap")
    for polygon in mesh.polygons:
        for loop_index in polygon.loop_indices:
            vertex_index = mesh.loops[loop_index].vertex_index
            uv_layer.data[loop_index].uv = uvs_by_vertex[vertex_index]


def soft_horizontal_upholstery_surface(
    name: str,
    size: tuple[float, float],
    loc: tuple[float, float, float],
    material: bpy.types.Material,
    yaw: float = 0.0,
    columns: int = 36,
    rows: int = 22,
) -> bpy.types.Object:
    width, depth = size
    vertices: list[tuple[float, float, float]] = []
    uvs: list[tuple[float, float]] = []
    for row in range(rows):
        v = row / max(rows - 1, 1)
        z = (v - 0.5) * depth
        for column in range(columns):
            u = column / max(columns - 1, 1)
            x = (u - 0.5) * width
            edge = min(u, 1.0 - u, v, 1.0 - v)
            edge_roll = max(0.0, 1.0 - edge * 7.5)
            center_crown = math.sin(math.pi * u) * math.sin(math.pi * v)
            center_seam = math.exp(-((u - 0.5) ** 2) / 0.0008) * 0.026
            front_lip = math.exp(-((v - 0.06) ** 2) / 0.004) * 0.024
            rear_settle = math.exp(-((v - 0.92) ** 2) / 0.01) * 0.016
            crease = math.sin(u * math.pi * 4.0 + 0.35) * math.sin(v * math.pi * 2.0) * 0.006
            y = 0.018 + center_crown * 0.035 + front_lip - rear_settle - center_seam - edge_roll * 0.018 + crease
            vertices.append(source_vertex_to_blender((x, y, z), loc, yaw))
            uvs.append((u, v))

    faces: list[tuple[int, int, int, int]] = []
    for row in range(rows - 1):
        for column in range(columns - 1):
            a = row * columns + column
            faces.append((a, a + 1, a + 1 + columns, a + columns))

    mesh = bpy.data.meshes.new(f"{name}_mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    assign_grid_uv(mesh, uvs)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    solidify = obj.modifiers.new(f"{name}_thin_upholstery_shell", "SOLIDIFY")
    solidify.thickness = 0.028
    solidify.offset = -0.55
    obj.modifiers.new(f"{name}_weighted_normals", "WEIGHTED_NORMAL")
    obj["deskterior_curved_topology"] = "soft_horizontal_upholstery_surface"
    return obj


def soft_vertical_upholstery_surface(
    name: str,
    size: tuple[float, float],
    loc: tuple[float, float, float],
    material: bpy.types.Material,
    yaw: float = 0.0,
    columns: int = 36,
    rows: int = 24,
) -> bpy.types.Object:
    width, height = size
    vertices: list[tuple[float, float, float]] = []
    uvs: list[tuple[float, float]] = []
    for row in range(rows):
        v = row / max(rows - 1, 1)
        y = (v - 0.5) * height
        for column in range(columns):
            u = column / max(columns - 1, 1)
            x = (u - 0.5) * width
            edge = min(u, 1.0 - u, v, 1.0 - v)
            crown = math.sin(math.pi * u) * math.sin(math.pi * v)
            vertical_channel = (
                math.exp(-((u - 0.32) ** 2) / 0.0012)
                + math.exp(-((u - 0.66) ** 2) / 0.0012)
            ) * 0.026
            lumbar_settle = math.exp(-((v - 0.34) ** 2) / 0.018) * 0.018
            top_roll = math.exp(-((v - 0.92) ** 2) / 0.008) * 0.04
            lower_shadow = math.exp(-((v - 0.08) ** 2) / 0.006) * 0.02
            edge_tuck = max(0.0, 1.0 - edge * 6.5) * 0.018
            z = 0.018 + crown * 0.035 + top_roll - lower_shadow - lumbar_settle - vertical_channel - edge_tuck
            vertices.append(source_vertex_to_blender((x, y, z), loc, yaw))
            uvs.append((u, v))

    faces: list[tuple[int, int, int, int]] = []
    for row in range(rows - 1):
        for column in range(columns - 1):
            a = row * columns + column
            faces.append((a, a + 1, a + 1 + columns, a + columns))

    mesh = bpy.data.meshes.new(f"{name}_mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    assign_grid_uv(mesh, uvs)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    solidify = obj.modifiers.new(f"{name}_thin_back_shell", "SOLIDIFY")
    solidify.thickness = 0.03
    solidify.offset = -0.45
    obj.modifiers.new(f"{name}_weighted_normals", "WEIGHTED_NORMAL")
    obj["deskterior_curved_topology"] = "soft_vertical_upholstery_surface"
    return obj


def soft_rear_upholstery_shell(
    name: str,
    size: tuple[float, float],
    loc: tuple[float, float, float],
    material: bpy.types.Material,
    yaw: float = 0.0,
    columns: int = 30,
    rows: int = 16,
) -> bpy.types.Object:
    width, height = size
    vertices: list[tuple[float, float, float]] = []
    uvs: list[tuple[float, float]] = []
    for row in range(rows):
        v = row / max(rows - 1, 1)
        y = (v - 0.5) * height
        for column in range(columns):
            u = column / max(columns - 1, 1)
            x = (u - 0.5) * width
            edge = min(u, 1.0 - u, v, 1.0 - v)
            crown = math.sin(math.pi * u) * math.sin(math.pi * v)
            top_cushion_roll = math.exp(-((v - 0.88) ** 2) / 0.014) * 0.034
            lower_settle = math.exp(-((v - 0.14) ** 2) / 0.018) * 0.024
            side_tuck = max(0.0, 1.0 - edge * 7.0) * 0.018
            subtle_channel = (
                math.exp(-((u - 0.36) ** 2) / 0.0022)
                + math.exp(-((u - 0.64) ** 2) / 0.0022)
            ) * 0.012
            cloth_wave = math.sin((u * 3.0 + v * 1.2) * math.pi) * 0.006
            z = 0.012 + crown * 0.026 + top_cushion_roll - lower_settle - side_tuck - subtle_channel + cloth_wave
            vertices.append(source_vertex_to_blender((x, y, z), loc, yaw))
            uvs.append((u, v))

    faces: list[tuple[int, int, int, int]] = []
    for row in range(rows - 1):
        for column in range(columns - 1):
            a = row * columns + column
            faces.append((a, a + 1, a + 1 + columns, a + columns))

    mesh = bpy.data.meshes.new(f"{name}_mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.update()
    assign_grid_uv(mesh, uvs)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.data.materials.append(material)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    solidify = obj.modifiers.new(f"{name}_soft_rear_shell_thickness", "SOLIDIFY")
    solidify.thickness = 0.035
    solidify.offset = -0.5
    obj.modifiers.new(f"{name}_weighted_normals", "WEIGHTED_NORMAL")
    obj["deskterior_curved_topology"] = "soft_rear_upholstery_shell"
    return obj


def vertical_cylinder(
    name: str,
    radius: float,
    height: float,
    loc: tuple[float, float, float],
    material: bpy.types.Material,
    vertices: int = 18,
    yaw: float = 0.0,
    top_radius: float | None = None,
) -> bpy.types.Object:
    bpy.ops.mesh.primitive_cone_add(
        vertices=vertices,
        radius1=radius,
        radius2=top_radius if top_radius is not None else radius,
        depth=height,
        location=to_blender_loc(loc),
        rotation=(0, 0, yaw),
    )
    obj = bpy.context.object
    obj.name = name
    obj.data.materials.append(material)
    for polygon in obj.data.polygons:
        polygon.use_smooth = True
    bevel_mod = obj.modifiers.new(f"{name}_cap_bevel", "BEVEL")
    bevel_mod.width = min(radius * 0.12, 0.01)
    bevel_mod.segments = 2
    obj.modifiers.new(f"{name}_weighted_normals", "WEIGHTED_NORMAL")
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
    for obj in mesh_objects():
        total += sum(max(len(poly.vertices) - 2, 1) for poly in obj.data.polygons)
    return total


def build_desk(materials: dict[str, bpy.types.Material]) -> None:
    wood = materials["wood"]
    dark = materials["dark"]
    metal = materials["metal"]
    mat_fabric = materials["fabric"]
    paper = materials["paper"]
    blue = materials["blue"]
    pink = materials["pink"]
    cream = materials["cream"]

    rounded_rect_slab("hero_desk_rounded_oiled_wood_worktop", (2.92, 0.07, 0.9), (-0.72, 0.84, -0.86), wood, 0, 0.08, 8, "table")
    cube("hero_desk_front_recessed_shadow_line", (2.72, 0.026, 0.026), (-0.72, 0.792, -0.405), dark, 0, 0)
    cube("hero_desk_back_cable_raceway_shadow", (2.24, 0.04, 0.06), (-0.4, 0.78, -1.29), dark, 0, 0)
    vertical_cylinder("hero_desk_round_wire_grommet_black_ring", 0.055, 0.012, (-0.22, 0.892, -1.19), dark, 28, 0, 0.042)
    vertical_cylinder("hero_desk_round_wire_grommet_inner_shadow", 0.034, 0.014, (-0.22, 0.904, -1.19), materials["metal"], 28, 0, 0.024)
    for x in [-1.94, 0.5]:
        for z in [-1.2, -0.52]:
            vertical_cylinder(f"hero_desk_tapered_round_leg_{x}_{z}", 0.038, 0.78, (x, 0.41, z), metal, 18, 0, 0.028)
    for z, name in [(-1.2, "back"), (-0.52, "front")]:
        cube(f"hero_desk_black_stretcher_{name}", (2.18, 0.024, 0.024), (-0.72, 0.33, z), metal, 0, 0)
    cube("hero_desk_left_drawer_carcase", (0.56, 0.58, 0.34), (-1.76, 0.44, -0.5), cream, 0, 0.02)
    for index, y in enumerate([0.31, 0.47, 0.63]):
        rounded_rect_slab(f"hero_desk_soft_lacquer_drawer_front_{index}", (0.48, 0.112, 0.035), (-1.76, y, -0.31), cream, 0, 0.018, 4, "table")
        cube(f"hero_desk_drawer_shadow_pull_{index}", (0.36, 0.014, 0.016), (-1.76, y + 0.006, -0.334), dark, 0, 0)
        cube(f"hero_desk_drawer_top_reveal_{index}", (0.46, 0.008, 0.012), (-1.76, y + 0.06, -0.333), dark, 0, 0)
    cube("hero_desk_felt_mat", (1.58, 0.018, 0.48), (-0.92, 0.872, -0.76), mat_fabric, 0, 0.026)
    for x in [-1.42, -1.18, -0.94, -0.7, -0.46]:
        cube(f"hero_desk_mat_weave_strip_{x}", (0.018, 0.011, 0.42), (x, 0.888, -0.76), dark, 0, 0.004)
    cube("hero_desk_notebook_stack", (0.34, 0.035, 0.24), (-1.68, 0.9, -1.05), paper, -0.08, 0.014)
    cube("hero_desk_notebook_amber_line", (0.26, 0.012, 0.018), (-1.68, 0.926, -1.13), materials["amber"], -0.08, 0.004)
    cube("hero_desk_streamdeck_body", (0.36, 0.045, 0.18), (0.2, 0.895, -1.12), dark, 0.2, 0.02)
    cube("hero_desk_streamdeck_blue_key", (0.22, 0.018, 0.026), (0.15, 0.93, -1.14), blue, 0.2, 0.006)
    cube("hero_desk_streamdeck_pink_key", (0.16, 0.018, 0.026), (0.27, 0.932, -1.06), pink, 0.2, 0.006)
    cube("hero_desk_under_tray_black", (0.62, 0.08, 0.24), (0.4, 0.49, -1.02), dark, 0, 0.016)
    for x, z, yaw in [(-0.12, -1.22, 0.08), (0.12, -1.24, -0.05), (0.34, -1.18, 0.14)]:
        cube(f"hero_desk_loose_cable_segment_{x}_{z}", (0.2, 0.014, 0.018), (x, 0.755, z), dark, yaw, 0)


def build_shelf(materials: dict[str, bpy.types.Material]) -> None:
    cream = materials["cream"]
    wood = materials["wood"]
    dark = materials["dark"]
    metal = materials["metal"]
    leaf = materials["leaf"]
    pot = materials["pot"]
    paper = materials["paper"]
    book_mats = [materials["pink"], materials["blue"], materials["amber"], materials["mint"], materials["lavender"], materials["orange"]]

    sx, sy, sz = -2.75, 0.72, -1.52
    for x in [sx - 0.62, sx + 0.62]:
        rounded_rect_slab(f"hero_shelf_rounded_warm_side_post_{x}", (0.11, 2.18, 0.18), (x, sy + 0.48, sz), wood, 0, 0.035, 5, "arm")
    for offset_y in [0.0, 0.54, 1.08, 1.62]:
        rounded_rect_slab(f"hero_shelf_rounded_lacquer_board_{offset_y}", (1.45, 0.075, 0.42), (sx, sy + offset_y, sz), cream, 0, 0.045, 5, "table")
        cube(f"hero_shelf_shadow_underside_{offset_y}", (1.28, 0.016, 0.032), (sx, sy + offset_y - 0.055, sz + 0.22), dark, 0, 0)
        cube(f"hero_shelf_thin_front_lip_{offset_y}", (1.2, 0.018, 0.018), (sx, sy + offset_y + 0.04, sz + 0.22), wood, 0, 0)
    rounded_rect_slab("hero_shelf_center_soft_lacquer_cabinet", (0.78, 0.48, 0.32), (sx + 0.03, sy + 0.77, sz + 0.02), cream, 0, 0.045, 5, "table")
    cube("hero_shelf_center_cabinet_vertical_reveal", (0.018, 0.36, 0.022), (sx + 0.03, sy + 0.78, sz + 0.19), dark, 0, 0)
    for x in [sx - 0.18, sx + 0.24]:
        cube(f"hero_shelf_cabinet_tiny_pull_{x}", (0.12, 0.016, 0.014), (x, sy + 0.76, sz + 0.205), dark, 0, 0)

    for row, base_y in enumerate([sy + 0.18, sy + 1.27]):
        for i, x in enumerate([-0.45, -0.32, -0.19, -0.06, 0.11, 0.26, 0.4]):
            h = 0.28 + ((i + row) % 3) * 0.075
            cube(
                f"hero_shelf_book_{row}_{i}",
                (0.088, h, 0.22),
                (sx + x, base_y + h * 0.36, sz + 0.06),
                book_mats[(i + row * 2) % len(book_mats)],
                0.01 * ((i % 3) - 1),
                0.01,
            )
            if i % 2 == 0:
                cube(
                    f"hero_shelf_book_top_highlight_{row}_{i}",
                    (0.054, 0.01, 0.018),
                    (sx + x, base_y + h * 0.76, sz + 0.18),
                    paper,
                    0.01 * ((i % 3) - 1),
                    0,
                )
            cube(
                f"hero_shelf_book_label_{row}_{i}",
                (0.05, 0.012, 0.012),
                (sx + x, base_y + h * 0.55, sz + 0.178),
                cream,
                0,
                0.003,
            )

    cube("hero_shelf_camera_body", (0.2, 0.15, 0.16), (sx + 0.43, sy + 0.18, sz + 0.13), dark, 0.18, 0.02)
    cylinder_y("hero_shelf_camera_lens", 0.045, 0.025, (sx + 0.43, sy + 0.18, sz + 0.23), metal, 24, 0.18)
    cylinder_y("hero_shelf_plant_pot", 0.1, 0.16, (sx - 0.46, sy + 1.55, sz + 0.09), pot, 24, 0)
    for i in range(8):
        angle = (i / 8.0) * math.pi * 2
        sphere(
            f"hero_shelf_leaf_{i}",
            (sx - 0.45 + math.cos(angle) * 0.11, sy + 1.67 + (i % 3) * 0.035, sz + 0.08 + math.sin(angle) * 0.07),
            (0.11, 0.026, 0.055),
            leaf,
            (0.35, angle, 0.2),
            18,
        )
    rounded_rect_slab("hero_shelf_woven_storage_box_lower", (0.42, 0.18, 0.3), (sx - 0.34, sy + 0.37, sz + 0.02), materials["amber"], 0, 0.035, 4, "table")
    for x in [-0.48, -0.38, -0.28, -0.18]:
        cube(f"hero_shelf_woven_box_vertical_thread_{x}", (0.012, 0.14, 0.012), (sx + x, sy + 0.37, sz + 0.18), dark, 0, 0)


def build_media_console(materials: dict[str, bpy.types.Material]) -> None:
    cream = materials["cream"]
    wood = materials["wood"]
    dark = materials["dark"]
    glass = materials["glass"]
    blue = materials["blue"]
    pink = materials["pink"]
    speaker = materials["speaker"]
    metal = materials["metal"]
    leaf = materials["leaf"]
    pot = materials["pot"]

    cx, cy, cz = 1.92, 0.45, -1.72
    rounded_rect_slab("hero_media_console_rounded_lacquer_body", (1.62, 0.28, 0.36), (cx, cy, cz), cream, 0, 0.055, 6, "table")
    rounded_rect_slab("hero_media_console_inset_wood_drawer", (0.86, 0.16, 0.28), (cx + 0.18, cy + 0.17, cz + 0.04), wood, 0, 0.035, 5, "table")
    for index, x in enumerate([-0.52, -0.42, -0.32, -0.22, -0.12, -0.02, 0.08, 0.18, 0.28, 0.38, 0.48]):
        cube(f"hero_media_console_fine_slatted_front_{index}", (0.022, 0.13, 0.022), (cx + x, cy + 0.18, cz + 0.195), wood, 0, 0)
    cube("hero_media_console_long_shadow_reveal", (1.24, 0.018, 0.018), (cx + 0.06, cy + 0.29, cz + 0.19), dark, 0, 0)
    for x in [cx - 0.66, cx + 0.66]:
        vertical_cylinder(f"hero_media_console_short_round_leg_{x}", 0.026, 0.22, (x, cy - 0.18, cz - 0.1), metal, 14, 0, 0.018)
        vertical_cylinder(f"hero_media_console_front_round_leg_{x}", 0.026, 0.22, (x, cy - 0.18, cz + 0.12), metal, 14, 0, 0.018)
    cube("hero_media_tv_outer_panel", (1.36, 0.72, 0.055), (cx, cy + 0.72, cz - 0.08), dark, 0, 0.03)
    cube("hero_media_tv_inner_glass", (1.14, 0.52, 0.014), (cx, cy + 0.72, cz - 0.045), glass, 0, 0.01)
    cube("hero_media_tv_blue_screen_mark", (0.44, 0.022, 0.014), (cx - 0.18, cy + 0.76, cz - 0.026), blue, -0.12, 0.004)
    cube("hero_media_tv_pink_screen_mark", (0.32, 0.018, 0.014), (cx + 0.16, cy + 0.58, cz - 0.026), pink, 0.18, 0.004)
    for x in [-0.69, 0.7]:
        cube(f"hero_media_speaker_body_{x}", (0.18, 0.34, 0.16), (cx + x, cy + 0.36, cz + 0.18), speaker, 0, 0.024)
        cylinder_y(f"hero_media_speaker_woofer_{x}", 0.058, 0.018, (cx + x, cy + 0.31, cz + 0.275), dark, 30, 0)
        cylinder_y(f"hero_media_speaker_tweeter_{x}", 0.032, 0.016, (cx + x, cy + 0.43, cz + 0.275), dark, 24, 0)
    cylinder_y("hero_media_planter_pot", 0.12, 0.18, (cx + 0.76, cy + 0.29, cz + 0.1), pot, 24, 0)
    for i in range(7):
        angle = i * 0.92
        sphere(
            f"hero_media_planter_leaf_{i}",
            (cx + 0.76 + math.cos(angle) * 0.11, cy + 0.42 + i * 0.018, cz + 0.1 + math.sin(angle) * 0.07),
            (0.09, 0.024, 0.06),
            leaf,
            (0.34, angle, 0.28),
            18,
        )
    cube("hero_media_game_console", (0.34, 0.18, 0.2), (cx - 0.62, cy + 0.28, cz + 0.08), dark, 0, 0.02)
    cube("hero_media_handheld_blue", (0.08, 0.2, 0.07), (cx - 0.82, cy + 0.31, cz + 0.08), blue, 0, 0.018)
    cube("hero_media_handheld_pink", (0.08, 0.2, 0.07), (cx - 0.42, cy + 0.31, cz + 0.08), pink, 0, 0.018)


def build_lounge(materials: dict[str, bpy.types.Material]) -> None:
    fabric = materials["fabric"]
    dark_fabric = materials["dark_fabric"]
    pillow_light = materials["pillow_light"]
    pillow_blue = materials["pillow_blue"]
    wood = materials["wood"]
    dark = materials["dark"]
    paper = materials["paper"]
    cream = materials["cream"]
    amber = materials["amber"]
    blue = materials["blue"]
    pink = materials["pink"]
    rug = materials["rug"]
    metal = materials["metal"]

    cube("hero_lounge_woven_rug_base", (2.68, 0.024, 1.44), (-0.9, 0.064, 1.08), rug, 0.02, 0.04)
    for x in [-2.05, -1.65, -1.25, -0.85, -0.45, -0.05, 0.35]:
        cube(f"hero_rug_vertical_thread_{x}", (0.018, 0.012, 1.22), (x, 0.085, 1.08), dark_fabric, 0, 0.004)
    for z in [0.48, 0.74, 1.0, 1.26, 1.52, 1.78]:
        cube(f"hero_rug_horizontal_thread_{z}", (2.36, 0.012, 0.018), (-0.9, 0.09, z), fabric, 0, 0.004)
    for x in [-2.1, -1.9, -1.7, -1.5, -1.3, -1.1, -0.9, -0.7, -0.5, -0.3, -0.1, 0.1, 0.3]:
        cube(f"hero_rug_fringe_front_{x}", (0.075, 0.012, 0.018), (x, 0.095, 1.86), pillow_light, 0, 0.004)

    rounded_rect_slab("hero_sofa_recessed_curved_shadow_plinth", (1.42, 0.12, 0.56), (-1.56, 0.22, 1.2), dark, 0, 0.12, 9, "table")
    rounded_rect_slab("hero_sofa_bespoke_curved_base", (1.58, 0.24, 0.66), (-1.56, 0.35, 1.2), fabric, 0, 0.16, 11, "cushion")
    for z in [0.89, 1.2, 1.49]:
        cylinder_y(f"hero_sofa_base_under_shadow_curve_{z}", 0.018, 1.34, (-1.56, 0.315, z), dark, 18, math.pi * 0.5)
    soft_horizontal_upholstery_surface(
        "hero_sofa_continuous_crowned_seat_surface",
        (1.54, 0.66),
        (-1.56, 0.555, 1.08),
        fabric,
        0,
        32,
        18,
    )
    cube("hero_sofa_cushion_center_recessed_welt", (0.024, 0.022, 0.54), (-1.56, 0.592, 1.08), dark, 0, 0.003)
    for x in [-2.24, -1.56, -0.88]:
        cube(f"hero_sofa_seat_front_tailored_piping_{x}", (0.34, 0.018, 0.018), (x, 0.596, 0.775), dark_fabric, 0, 0.003)
    for x in [-2.08, -1.78, -1.34, -1.04]:
        sphere(f"hero_sofa_integrated_seat_soft_button_{x}", (x, 0.606, 1.02), (0.024, 0.008, 0.024), dark, (0, 0, 0), 12)
    soft_vertical_upholstery_surface(
        "hero_sofa_continuous_quilted_back_surface",
        (1.46, 0.58),
        (-1.56, 0.73, 1.52),
        dark_fabric,
        0,
        34,
        20,
    )
    for x in [-1.98, -1.56, -1.14]:
        cube(f"hero_sofa_back_integrated_vertical_welt_{x}", (0.016, 0.43, 0.016), (x, 0.74, 1.556), dark, 0, 0.0025)
    for y in [0.62, 0.78, 0.92]:
        cube(f"hero_sofa_back_integrated_horizontal_welt_{y}", (1.24, 0.014, 0.014), (-1.56, y, 1.56), dark, 0, 0.0025)
    for x in [-1.83, -1.29]:
        for y in [0.7, 0.86]:
            sphere(f"hero_sofa_back_pressed_fabric_button_{x}_{y}", (x, y, 1.565), (0.022, 0.008, 0.014), dark, (0, 0, 0), 10)
    rounded_rect_slab("hero_sofa_left_arm_bespoke_rolled_block", (0.25, 0.42, 0.62), (-2.38, 0.43, 1.18), dark_fabric, 0, 0.11, 10, "arm")
    rounded_rect_slab("hero_sofa_right_arm_bespoke_rolled_block", (0.25, 0.42, 0.62), (-0.74, 0.43, 1.18), dark_fabric, 0, 0.11, 10, "arm")
    for x in [-2.39, -0.73]:
        sphere(f"hero_sofa_arm_front_cap_{x}", (x, 0.56, 0.82), (0.12, 0.17, 0.11), dark_fabric, (0.2, 0, 0), 24)
        sphere(f"hero_sofa_arm_top_soft_roll_{x}", (x, 0.69, 1.18), (0.115, 0.07, 0.32), dark_fabric, (0, 0, 0), 24)
        cube(f"hero_sofa_arm_inner_shadow_line_{x}", (0.018, 0.25, 0.42), (x * 0.98 + (-0.02 if x < -1.5 else 0.02), 0.48, 1.16), dark, 0, 0.004)
        cube(f"hero_sofa_arm_outer_piping_front_{x}", (0.018, 0.32, 0.026), (x, 0.51, 0.87), pillow_blue, 0, 0.004)
        cube(f"hero_sofa_arm_outer_piping_back_{x}", (0.018, 0.32, 0.026), (x, 0.51, 1.48), pillow_blue, 0, 0.004)
        for welt_y in [0.62, 0.72]:
            cube(f"hero_sofa_arm_top_welt_{x}_{welt_y}", (0.19, 0.018, 0.5), (x, welt_y, 1.18), dark, 0, 0.004)
    soft_rear_upholstery_shell(
        "hero_sofa_rear_continuous_wrapped_upholstery_shell",
        (1.72, 0.54),
        (-1.56, 0.64, 1.69),
        dark_fabric,
        0,
        30,
        16,
    )
    cube("hero_sofa_rear_top_single_piece_piped_welt", (1.46, 0.026, 0.022), (-1.56, 0.91, 1.718), dark, 0, 0.004)
    cube("hero_sofa_rear_bottom_shadowed_fabric_skirt", (1.5, 0.038, 0.026), (-1.56, 0.39, 1.704), dark, 0, 0.004)
    for x in [-1.9, -1.22]:
        cube(f"hero_sofa_rear_subtle_vertical_tailored_welt_{x}", (0.018, 0.34, 0.014), (x, 0.65, 1.722), dark, 0, 0.0025)
    for x in [-2.16, -0.96]:
        sphere(f"hero_sofa_rear_soft_corner_pinched_fold_{x}", (x, 0.77, 1.726), (0.028, 0.024, 0.012), dark_fabric, (0, 0, 0), 10)
    for x, z in [(-2.25, 0.84), (-1.9, 0.79), (-1.56, 0.78), (-1.22, 0.79), (-0.9, 0.84)]:
        sphere(f"hero_sofa_front_cushion_corner_bulge_{x}_{z}", (x, 0.53, z), (0.045, 0.026, 0.045), fabric, (0, 0, 0), 10)
    for x in [-2.29, -0.82]:
        for y in [0.44, 0.56, 0.68]:
            cube(f"hero_sofa_side_panel_tailored_stitch_{x}_{y}", (0.014, 0.014, 0.42), (x, y, 1.18), dark, 0, 0.003)
    rounded_rect_slab("hero_sofa_throw_blanket_draped_soft_panel", (1.0, 0.045, 0.54), (-1.48, 0.82, 1.02), pillow_blue, -0.08, 0.055, 9, "cushion")
    for x in [-1.84, -1.58, -1.32, -1.08]:
        cube(f"hero_sofa_throw_thread_{x}", (0.028, 0.018, 0.48), (x, 0.848, 1.02), dark_fabric, -0.08, 0.004)
    for z in [0.78, 1.02, 1.26]:
        cube(f"hero_sofa_throw_weighted_front_hem_{z}", (0.82, 0.018, 0.018), (-1.46, 0.792, z), dark, -0.08, 0.003)
    for x in [-1.88, -1.72, -1.56, -1.4, -1.24, -1.08]:
        sphere(f"hero_sofa_throw_tassel_knot_{x}", (x, 0.782, 0.75), (0.018, 0.018, 0.018), pillow_light, (0, 0, 0), 8)
    rounded_rect_slab("hero_sofa_blue_pillow_soft_sculpt", (0.56, 0.31, 0.08), (-1.98, 0.75, 1.4), pillow_blue, 0.08, 0.055, 9, "cushion")
    rounded_rect_slab("hero_sofa_light_pillow_soft_sculpt", (0.44, 0.27, 0.08), (-1.2, 0.72, 1.38), pillow_light, -0.1, 0.05, 9, "cushion")
    for x, z, mat_name in [(-1.98, 1.4, "pillow_blue"), (-1.2, 1.38, "pillow_light")]:
        cube(f"hero_sofa_pillow_raised_outer_seam_top_{x}", (0.38, 0.014, 0.012), (x, 0.888, z + 0.04), dark, 0.08 if x < -1.5 else -0.1, 0.0025)
        cube(f"hero_sofa_pillow_raised_outer_seam_bottom_{x}", (0.34, 0.014, 0.012), (x, 0.62, z - 0.04), dark, 0.08 if x < -1.5 else -0.1, 0.0025)
        sphere(f"hero_sofa_pillow_corner_pinched_left_{x}", (x - 0.22, 0.73, z), (0.022, 0.018, 0.018), materials[mat_name], (0, 0, 0), 8)
        sphere(f"hero_sofa_pillow_corner_pinched_right_{x}", (x + 0.22, 0.73, z), (0.022, 0.018, 0.018), materials[mat_name], (0, 0, 0), 8)
    for x in [-1.94, -1.72, -1.5, -1.28]:
        sphere(f"hero_sofa_tuft_button_{x}", (x, 0.58, 0.9), (0.026, 0.026, 0.012), dark, (0, 0, 0), 14)
    for x in [-2.2, -0.92]:
        vertical_cylinder(f"hero_sofa_black_front_leg_round_{x}", 0.032, 0.12, (x, 0.11, 0.92), metal, 16, 0, 0.024)
        vertical_cylinder(f"hero_sofa_black_back_leg_round_{x}", 0.032, 0.12, (x, 0.11, 1.5), metal, 16, 0, 0.024)
        sphere(f"hero_sofa_leg_floor_glide_front_{x}", (x, 0.045, 0.92), (0.055, 0.016, 0.055), metal, (0, 0, 0), 16)
        sphere(f"hero_sofa_leg_floor_glide_back_{x}", (x, 0.045, 1.5), (0.055, 0.016, 0.055), metal, (0, 0, 0), 16)

    rounded_rect_slab("hero_coffee_table_bespoke_lower_shadow_shelf", (1.06, 0.055, 0.62), (0.28, 0.255, 1.02), wood, -0.08, 0.11, 9, "table")
    rounded_rect_slab("hero_coffee_table_bespoke_top_satin", (1.1, 0.052, 0.66), (0.28, 0.49, 1.02), wood, -0.08, 0.13, 10, "table")
    rounded_rect_slab("hero_coffee_table_rounded_inset_top_panel", (0.86, 0.018, 0.42), (0.28, 0.526, 1.02), materials["cream"], -0.08, 0.08, 8, "table")
    rounded_rect_slab("hero_coffee_table_smoked_rounded_glass_inlay", (0.72, 0.014, 0.3), (0.28, 0.542, 1.02), materials["glass"], -0.08, 0.06, 8, "table")
    for z, name in [(0.73, "front_inner"), (1.31, "back_inner")]:
        rounded_rect_slab(f"hero_coffee_table_{name}_tray_lip", (0.92, 0.032, 0.026), (0.28, 0.566, z), wood, -0.08, 0.012, 5, "table")
    for x, name in [(-0.21, "left_inner"), (0.77, "right_inner")]:
        rounded_rect_slab(f"hero_coffee_table_{name}_tray_lip", (0.028, 0.032, 0.48), (x, 0.566, 1.02), wood, -0.08, 0.012, 5, "table")
    for z, name in [(0.69, "front"), (1.35, "back")]:
        rounded_rect_slab(f"hero_coffee_table_{name}_rounded_apron", (1.04, 0.062, 0.045), (0.28, 0.39, z), wood, -0.08, 0.02, 5, "table")
    for x, name in [(-0.29, "left"), (0.85, "right")]:
        rounded_rect_slab(f"hero_coffee_table_{name}_side_apron", (0.052, 0.06, 0.56), (x, 0.39, 1.02), wood, -0.08, 0.02, 5, "table")
    for x in [-0.15, 0.71]:
        for z in [0.78, 1.26]:
            vertical_cylinder(f"hero_coffee_table_tapered_round_leg_{x}_{z}", 0.035, 0.22, (x, 0.2, z), metal, 18, -0.08, 0.026)
            sphere(f"hero_coffee_table_rounded_corner_cap_{x}_{z}", (x, 0.49, z), (0.04, 0.018, 0.04), wood, (0, 0, 0), 18)
            sphere(f"hero_coffee_table_foot_leveler_{x}_{z}", (x, 0.075, z), (0.038, 0.012, 0.038), metal, (0, 0, 0), 14)
    for z, name in [(0.78, "front"), (1.26, "back")]:
        cube(f"hero_coffee_table_black_crossbar_{name}", (0.9, 0.026, 0.026), (0.28, 0.22, z), metal, -0.08, 0.006)
    for x, name in [(-0.15, "left"), (0.71, "right")]:
        cube(f"hero_coffee_table_black_side_crossbar_{name}", (0.026, 0.026, 0.48), (x, 0.22, 1.02), metal, -0.08, 0.006)
    for x in [-0.12, 0.18, 0.48, 0.78]:
        cube(f"hero_coffee_table_lower_slatted_shadow_{x}", (0.028, 0.018, 0.48), (x, 0.292, 1.02), dark, -0.08, 0.003)
    for x in [0.02, 0.28, 0.54]:
        cube(f"hero_coffee_table_lower_visible_wood_slat_{x}", (0.055, 0.026, 0.5), (x, 0.318, 1.02), wood, -0.08, 0.008)
    rounded_rect_slab("hero_coffee_table_recessed_drawer_front", (0.76, 0.05, 0.036), (0.24, 0.42, 0.67), wood, -0.08, 0.012, 5, "table")
    cube("hero_coffee_table_drawer_shadow_gap", (0.68, 0.018, 0.014), (0.24, 0.448, 0.64), dark, -0.08, 0.003)
    cube("hero_coffee_table_brushed_pull_highlight", (0.34, 0.018, 0.016), (0.24, 0.458, 0.622), metal, -0.08, 0.004)
    for x in [-0.17, 0.73]:
        for z in [0.79, 1.25]:
            sphere(f"hero_coffee_table_leg_cap_screw_{x}_{z}", (x, 0.335, z), (0.014, 0.006, 0.014), metal, (0, 0, 0), 8)
    for z, color, offset in [(0.94, cream, -0.18), (1.03, pink, 0.02), (1.12, blue, 0.16)]:
        cube(f"hero_coffee_table_glass_reflection_streak_{z}", (0.42, 0.006, 0.012), (0.29 + offset, 0.552, z), color, -0.08, 0.002)
    cube("hero_coffee_table_book_stack", (0.42, 0.035, 0.28), (0.15, 0.52, 1.28), paper, 0.18, 0.014)
    cube("hero_coffee_table_book_line_amber", (0.34, 0.014, 0.022), (0.12, 0.55, 1.2), amber, 0.18, 0.004)
    cube("hero_coffee_table_small_notebook", (0.32, 0.025, 0.2), (-0.05, 0.555, 0.82), pillow_blue, -0.18, 0.01)
    cube("hero_coffee_table_remote", (0.2, 0.022, 0.055), (0.42, 0.555, 1.29), dark, 0.12, 0.012)
    for x, color in [(0.37, blue), (0.43, pink), (0.49, amber)]:
        sphere(f"hero_coffee_table_remote_button_{x}", (x, 0.571, 1.29), (0.016, 0.006, 0.016), color, (0, 0, 0), 12)
    cube("hero_coffee_table_controller", (0.28, 0.045, 0.16), (0.62, 0.53, 0.88), dark, -0.18, 0.024)
    for x in [0.48, 0.76]:
        sphere(f"hero_coffee_table_controller_grip_{x}", (x, 0.535, 0.88), (0.055, 0.022, 0.06), dark, (0, 0, 0), 18)
    for x in [0.57, 0.66]:
        sphere(f"hero_coffee_table_controller_thumbstick_{x}", (x, 0.565, 0.89), (0.026, 0.012, 0.026), metal, (0, 0, 0), 14)
    sphere("hero_coffee_table_mug_body", (0.54, 0.535, 1.28), (0.07, 0.09, 0.07), pillow_light, (0, 0, 0), 20)
    sphere("hero_coffee_table_mug_coffee_surface", (0.54, 0.62, 1.28), (0.05, 0.008, 0.05), dark, (0, 0, 0), 16)
    cylinder_y("hero_coffee_table_mug_handle", 0.026, 0.018, (0.62, 0.54, 1.28), pillow_light, 18, 0)
    sphere("hero_coffee_table_blue_led_dot", (0.72, 0.55, 0.85), (0.026, 0.026, 0.026), blue, (0, 0, 0), 14)


def build_asset(texture_package_dir: Path | None = None) -> dict[str, object]:
    random.seed(20260519)
    texture_sets = {
        "wood": make_pbr_texture_set("hero_uv_oiled_walnut_1k", 1024, 1024, wood_painter, "wood", 0.76),
        "fabric": make_pbr_texture_set("hero_uv_bluegrey_fabric_1k", 1024, 1024, fabric_painter, "fabric", 0.92),
        "cream": make_pbr_texture_set("hero_uv_warm_lacquer_512", 512, 512, lacquer_painter, "lacquer", 0.62),
        "speaker": make_pbr_texture_set("hero_uv_speaker_grille_512", 512, 512, speaker_painter, "speaker", 0.72),
    }
    orm_sidecars = [
        {
            "role": "furnitureWoodOrm",
            "image": make_image("hero_uv_oiled_walnut_orm_1k", 1024, 1024, orm_painter("wood", 0.76, 0.02)),
            "fileName": "hero_uv_oiled_walnut_orm_1k.png",
            "resolution": [1024, 1024],
            "metallic": 0.02,
        },
        {
            "role": "furnitureFabricOrm",
            "image": make_image("hero_uv_bluegrey_fabric_orm_1k", 1024, 1024, orm_painter("fabric", 0.92, 0.0)),
            "fileName": "hero_uv_bluegrey_fabric_orm_1k.png",
            "resolution": [1024, 1024],
            "metallic": 0.0,
        },
        {
            "role": "furnitureLacquerOrm",
            "image": make_image("hero_uv_warm_lacquer_orm_512", 512, 512, orm_painter("lacquer", 0.62, 0.03)),
            "fileName": "hero_uv_warm_lacquer_orm_512.png",
            "resolution": [512, 512],
            "metallic": 0.03,
        },
        {
            "role": "furnitureSpeakerOrm",
            "image": make_image("hero_uv_speaker_grille_orm_512", 512, 512, orm_painter("speaker", 0.72, 0.04)),
            "fileName": "hero_uv_speaker_grille_orm_512.png",
            "resolution": [512, 512],
            "metallic": 0.04,
        },
    ]
    orm_map_records: list[dict[str, object]] = []
    if texture_package_dir:
        texture_package_dir.mkdir(parents=True, exist_ok=True)
        for entry in orm_sidecars:
            image = entry["image"]  # type: ignore[assignment]
            set_color_space(image, "Non-Color")  # type: ignore[arg-type]
            file_path = texture_package_dir / str(entry["fileName"])
            save_image_png(image, file_path)  # type: ignore[arg-type]
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

    materials = {
        "wood": textured_mat("hero_uv_oiled_walnut_pbr_1k", texture_sets["wood"], 0.76, 0.02),
        "fabric": textured_mat("hero_uv_bluegrey_fabric_pbr_1k", texture_sets["fabric"], 0.92, 0.0),
        "cream": textured_mat("hero_uv_warm_lacquer_pbr_512", texture_sets["cream"], 0.62, 0.03),
        "speaker": textured_mat("hero_uv_speaker_grille_pbr_512", texture_sets["speaker"], 0.72, 0.04),
        "dark": mat("hero_soft_black_plastic", (0.055, 0.066, 0.08, 1), 0.56, 0.18),
        "dark_fabric": mat("hero_deep_navy_fabric", (0.08, 0.115, 0.17, 1), 0.92, 0.0),
        "metal": mat("hero_satin_black_metal", (0.08, 0.085, 0.09, 1), 0.48, 0.42),
        "glass": mat("hero_smoky_screen_glass", (0.05, 0.045, 0.065, 1), 0.24, 0.08, 0.58),
        "paper": mat("hero_warm_paper_stack", (0.86, 0.79, 0.68, 1), 0.9, 0.0),
        "pillow_light": mat("hero_linen_pillow_warm", (0.72, 0.67, 0.64, 1), 0.86, 0.0),
        "pillow_blue": mat("hero_muted_blue_throw", (0.34, 0.43, 0.56, 1), 0.9, 0.0),
        "rug": mat("hero_desaturated_blue_rug", (0.17, 0.25, 0.34, 1), 0.96, 0.0),
        "leaf": mat("hero_leaf_satin_green", (0.25, 0.55, 0.34, 1), 0.82, 0.0),
        "pot": mat("hero_matte_ceramic_pot", (0.55, 0.48, 0.42, 1), 0.76, 0.02),
        "blue": mat("hero_rgb_cool_blue", (0.55, 0.86, 1.0, 1), 0.38, 0.0, 1.0, (0.2, 0.68, 1.0), 0.55),
        "pink": mat("hero_rgb_soft_pink", (1.0, 0.42, 0.62, 1), 0.38, 0.0, 1.0, (1.0, 0.14, 0.42), 0.48),
        "amber": mat("hero_book_amber", (0.9, 0.55, 0.3, 1), 0.72, 0.0),
        "mint": mat("hero_book_mint", (0.38, 0.68, 0.48, 1), 0.72, 0.0),
        "lavender": mat("hero_book_lavender", (0.4, 0.38, 0.72, 1), 0.72, 0.0),
        "orange": mat("hero_book_orange", (0.86, 0.42, 0.24, 1), 0.72, 0.0),
    }

    build_desk(materials)
    build_shelf(materials)
    build_media_console(materials)
    build_lounge(materials)

    for obj in mesh_objects():
        obj["deskterior_asset_slug"] = "p2s-bruno-furniture-hero-kit"
        obj["deskterior_runtime_role"] = "large_furniture_quality_layer"

    return {
        "furnitureTextureRoles": ["baseColor", "normal", "roughness", "ambientOcclusion", "packedOrm"],
        "generatedPbrMapCount": 20,
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
            "toktxAvailable": shutil.which("toktx") is not None,
            "basisuAvailable": shutil.which("basisu") is not None,
            "stillRequiresRuntimeKtx2Transcode": True,
            "stillRequiresFinalUvBake": True,
        },
    }


def configure_thumbnail(objects: list[bpy.types.Object]) -> None:
    min_v, max_v = world_bounds(objects)
    size = max_v - min_v
    target = (min_v + max_v) * 0.5
    radius = max(size.x, size.y, size.z, 1.0)
    bpy.ops.object.light_add(type="AREA", location=(-2.4, -2.4, 4.2))
    key = bpy.context.object
    key.name = "furniture_hero_review_warm_key"
    key.data.energy = 480
    key.data.size = 4.8
    bpy.ops.object.light_add(type="AREA", location=(2.8, 2.6, 2.8))
    fill = bpy.context.object
    fill.name = "furniture_hero_review_cool_fill"
    fill.data.energy = 140
    fill.data.color = (0.62, 0.76, 1.0)
    fill.data.size = 3.4
    camera_location = Vector((radius * 0.55, -radius * 0.9, radius * 0.58))
    rotation = (target - camera_location).to_track_quat("-Z", "Y").to_euler()
    bpy.ops.object.camera_add(location=camera_location, rotation=rotation)
    camera = bpy.context.object
    camera.name = "furniture_hero_review_camera"
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = 6.2
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
    bpy.context.scene.view_settings.exposure = -0.35
    bpy.context.scene.render.resolution_x = 1200
    bpy.context.scene.render.resolution_y = 900
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
    runtime_dir = repo_root / "assets/runtime-candidates/blender-authored/bruno-furniture-hero-kit"
    public_dir = repo_root / "apps/web/public/assets/models/p2s_bruno_furniture_hero_kit"
    reference_dir = repo_root / "assets/references/blender-authored/bruno-furniture-hero-kit"
    blend_path = repo_root / "assets/blender/deskterior/p2s_bruno_furniture_hero_kit.blend"
    runtime_dir.mkdir(parents=True, exist_ok=True)
    public_dir.mkdir(parents=True, exist_ok=True)
    reference_dir.mkdir(parents=True, exist_ok=True)
    blend_path.parent.mkdir(parents=True, exist_ok=True)

    runtime_glb = runtime_dir / "p2s_bruno_furniture_hero_kit.glb"
    public_glb = public_dir / "p2s_bruno_furniture_hero_kit.glb"
    thumbnail = runtime_dir / "p2s_bruno_furniture_hero_kit.thumbnail.webp"
    texture_package_dir = runtime_dir / "textures"
    public_texture_dir = public_dir / "textures"
    texture_package_manifest = runtime_dir / "texture-package-2026-05-19.json"
    public_texture_package_manifest = public_dir / "texture-package-2026-05-19.json"
    review_path = reference_dir / "asset-review-2026-05-19.json"

    clear_scene()
    asset_metadata = build_asset(texture_package_dir)
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
    public_maps = []
    public_texture_dir.mkdir(parents=True, exist_ok=True)
    for entry in asset_metadata["packedOrmMaps"]:
        relative_source_path = Path(str(entry["path"])).relative_to(repo_root)
        public_png_path = public_texture_dir / relative_source_path.name
        shutil.copy2(repo_root / relative_source_path, public_png_path)
        packed_orm_maps.append({**entry, "path": str(relative_source_path)})
        public_maps.append(
            {
                "role": entry["role"],
                "sourcePath": str(relative_source_path),
                "publicPath": f"/assets/models/p2s_bruno_furniture_hero_kit/textures/{relative_source_path.name}",
                "ktx2Path": None,
                "required": True,
                "exists": public_png_path.exists(),
                "resolution": entry["resolution"],
                "channels": entry["channels"],
                "colorSpace": entry["colorSpace"],
            }
        )
    texture_package = {
        **asset_metadata["texturePackaging"],
        "manifest": str(texture_package_manifest.relative_to(repo_root)),
        "packedOrmMaps": packed_orm_maps,
        "promotionBoundary": "Furniture ORM sidecar package evidence only; KTX2 transcode, final UV bake, meshopt, collider, and catalog split packaging remain blocked",
    }
    texture_package_manifest.write_text(
        json.dumps(
            {
                "schemaVersion": "deskterior-texture-package-v1",
                "assetSlug": "p2s-bruno-furniture-hero-kit",
                **texture_package,
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    public_texture_package_manifest.write_text(
        json.dumps(
            {
                "schemaVersion": "deskterior-runtime-texture-package-v1",
                "generatedAt": "2026-05-19T00:00:00.000Z",
                "assetKey": "p2s_bruno_furniture_hero_kit",
                "sourceManifestPath": str(texture_package_manifest.relative_to(repo_root)),
                "packageStatus": "orm-png-sidecar-ready-ktx2-pending",
                "ktx2Ready": False,
                "ktx2TranscodeAttempted": False,
                "toktxAvailable": shutil.which("toktx") is not None,
                "basisuAvailable": shutil.which("basisu") is not None,
                "stillRequiresRuntimeKtx2Transcode": True,
                "stillRequiresFinalUvBake": True,
                "channels": {
                    "r": "ambientOcclusion",
                    "g": "roughness",
                    "b": "metallic",
                    "a": "constantOne",
                },
                "maps": public_maps,
                "promotionBoundary": "Furniture ORM PNG sidecars are present; KTX2 transcode, final UV bake, and release catalog approval remain blocked.",
            },
            indent=2,
        ),
        encoding="utf-8",
    )
    report = {
        "schemaVersion": "deskterior-blender-authored-asset-review-v1",
        "asset": {
            "slug": "p2s-bruno-furniture-hero-kit",
            "intent": "large furniture material and silhouette quality layer for the PC assembly room workbench",
            "source": "Blender procedural authoring by Codex with generated PBR helper maps; no Bruno Simon source asset copied",
            "license": "project-owned prototype asset pending catalog release review",
            "textureSet": {
                "authoredMaps": asset_metadata["furnitureTextureRoles"],
                "generatedPbrMapCount": asset_metadata["generatedPbrMapCount"],
                "mapFamilies": ["wood", "fabric", "warm_lacquer", "speaker_grille"],
                "textureResolution": {
                    "wood": "1024x1024",
                    "fabric": "1024x1024",
                    "warmLacquer": "512x512",
                    "speakerGrille": "512x512",
                },
                "ktx2Ready": False,
                "packedOrmMapCount": len(packed_orm_maps),
                "packedOrmReady": len(packed_orm_maps) >= 4,
                "uvStrategy": "procedural object-space atlas candidate; not final hand-unwrapped production UVs",
            },
            "texturePackagingPass": texture_package,
            "bespokeCurvaturePass": {
                "authoredAt": "2026-05-19",
                "meshFamilies": [
                    "rounded_rect_slab",
                    "soft_horizontal_upholstery_surface",
                    "soft_vertical_upholstery_surface",
                    "soft_rear_upholstery_shell",
                    "vertical_tapered_cylinder",
                    "soft_lip_ellipsoid",
                    "under_shadow_curve",
                    "desk_integrated_wire_grommet",
                    "shelf_layered_lacquer_board",
                    "media_console_slatted_front",
                ],
                "sofaMeshes": [
                    "hero_sofa_bespoke_curved_base",
                    "hero_sofa_continuous_crowned_seat_surface",
                    "hero_sofa_continuous_quilted_back_surface",
                    "hero_sofa_cushion_center_recessed_welt",
                    "hero_sofa_back_integrated_*_welt_*",
                    "hero_sofa_integrated_seat_soft_button_*",
                    "hero_sofa_back_pressed_fabric_button_*",
                    "hero_sofa_left_arm_bespoke_rolled_block",
                    "hero_sofa_right_arm_bespoke_rolled_block",
                    "hero_sofa_rear_continuous_wrapped_upholstery_shell",
                    "hero_sofa_rear_*_piped_welt",
                    "hero_sofa_rear_subtle_vertical_tailored_welt_*",
                    "hero_sofa_rear_soft_corner_pinched_fold_*",
                    "hero_sofa_throw_blanket_draped_soft_panel",
                    "hero_sofa_throw_tassel_knot_*",
                    "hero_sofa_*_pillow_soft_sculpt",
                    "hero_sofa_pillow_corner_pinched_*",
                ],
                "coffeeTableMeshes": [
                    "hero_coffee_table_bespoke_top_satin",
                    "hero_coffee_table_bespoke_lower_shadow_shelf",
                    "hero_coffee_table_rounded_inset_top_panel",
                    "hero_coffee_table_smoked_rounded_glass_inlay",
                    "hero_coffee_table_*_tray_lip",
                    "hero_coffee_table_*_rounded_apron",
                    "hero_coffee_table_tapered_round_leg_*",
                    "hero_coffee_table_recessed_drawer_front",
                    "hero_coffee_table_glass_reflection_streak_*",
                ],
                "deskMeshes": [
                    "hero_desk_rounded_oiled_wood_worktop",
                    "hero_desk_round_wire_grommet_black_ring",
                    "hero_desk_tapered_round_leg_*",
                    "hero_desk_soft_lacquer_drawer_front_*",
                    "hero_desk_front_recessed_shadow_line",
                    "hero_desk_back_cable_raceway_shadow",
                    "hero_desk_loose_cable_segment_*",
                ],
                "shelfMeshes": [
                    "hero_shelf_rounded_warm_side_post_*",
                    "hero_shelf_rounded_lacquer_board_*",
                    "hero_shelf_center_soft_lacquer_cabinet",
                    "hero_shelf_book_top_highlight_*",
                    "hero_shelf_woven_storage_box_lower",
                    "hero_shelf_woven_box_vertical_thread_*",
                ],
                "mediaConsoleMeshes": [
                    "hero_media_console_rounded_lacquer_body",
                    "hero_media_console_inset_wood_drawer",
                    "hero_media_console_fine_slatted_front_*",
                    "hero_media_console_short_round_leg_*",
                    "hero_media_console_front_round_leg_*",
                ],
                "commercialIntent": "reduce primitive-box readability across the high-visibility furniture layer by replacing sofa, coffee-table, desk, shelf, and media-console block proxies with named rounded source meshes and localized detail while staying inside the QA triangle budget",
                "stillRequiresHumanArtReview": True,
            },
        },
        "outputs": {
            "blend": str(blend_path.relative_to(repo_root)),
            "runtimeGlb": str(runtime_glb.relative_to(repo_root)),
            "publicGlb": str(public_glb.relative_to(repo_root)),
            "thumbnail": str(thumbnail.relative_to(repo_root)),
            "texturePackageManifest": str(texture_package_manifest.relative_to(repo_root)),
            "publicTexturePackageManifest": str(public_texture_package_manifest.relative_to(repo_root)),
            "texturePackageDirectory": str(texture_package_dir.relative_to(repo_root)),
        },
        "metrics": {
            "dimensionsM": [round(dimensions.x, 4), round(dimensions.y, 4), round(dimensions.z, 4)],
            "objectCount": len(objects),
            "materialCount": len(bpy.data.materials),
            "textureCount": len(bpy.data.images),
            "triangleCount": triangle_count(),
            "triangleBudget": 65000,
            "triangleBudgetStatus": "pass" if triangle_count() <= 65000 else "fail",
            "runtimeBytes": runtime_glb.stat().st_size,
            "publicBytes": public_glb.stat().st_size,
        },
        "comparisonReview": {
            "commercialBenchmarkRubric": [
                {
                    "gate": "PBR material response",
                    "candidateStatus": "partial-pass",
                    "evidence": "baseColor, normal, roughness, AO, and packed ORM helper maps are generated for four major furniture material families",
                    "remainingGap": "helper maps are procedural sidecars and not baked from high-poly sculpt/detail or hand-painted reference passes",
                },
                {
                    "gate": "geometry silhouette and bevel quality",
                    "candidateStatus": "partial-pass",
                    "evidence": "foreground sofa base, continuous crowned seat surface, continuous quilted back surface, continuous wrapped rear shell, pillows, throw blanket, rolled arms, rear tailored welts/folds, front cushion bulges, coffee-table top, inset panels, glass inlay, tray lips, aprons, drawer front, lower shelf, desk rounded wood worktop, wire grommet, round legs, soft drawer fronts, shelf rounded posts/boards/cabinet/storage box, media console rounded body, inset drawer, slatted face, and round legs now use explicit rounded or grid-sculpted mesh topology instead of only bevelled cubes",
                    "remainingGap": "this is a bespoke foreground curvature pass but still not a full high-poly sculpt, hand-retopologized SKU, or UV-unwrapped production furniture pack",
                },
                {
                    "gate": "room-scale composition support",
                    "candidateStatus": "pass-for-qa",
                    "evidence": "desk, shelf, media console, sofa, rug, and coffee table zones ship as one scale-aligned runtime layer",
                    "remainingGap": "needs split package metadata before catalog promotion so individual objects can be selected, swapped, and LOD-managed",
                },
                {
                    "gate": "runtime optimization",
                    "candidateStatus": "partial-pass",
                    "evidence": "triangle budget is tracked, the GLB is embeddable in the QA route, and a furniture packed-ORM PNG sidecar manifest is emitted",
                    "remainingGap": "KTX2 transcode must run after generation, and there is still no meshopt, decimated proxy, collider sidecar, catalog split, or LOD ladder yet",
                },
                {
                    "gate": "lighting and bake parity",
                    "candidateStatus": "fail-for-commercial",
                    "evidence": "thumbnail and workbench screenshot are generated for visual inspection",
                    "remainingGap": "no true baked lightmap/GI pass; current appearance still depends on runtime lighting and post stack",
                },
                {
                    "gate": "license and provenance",
                    "candidateStatus": "pass-for-internal-prototype",
                    "evidence": "asset is project-authored and explicitly not copied from Bruno Simon or paid asset packs",
                    "remainingGap": "commercial promotion still requires a human-reviewed benchmark board against approved licensed/open furniture assets",
                },
            ],
            "commercialPatternsApplied": [
                "large furniture surfaces use authored GLB geometry rather than only React block proxies",
                "wood, lacquer, fabric, and speaker grille use generated baseColor/normal/roughness/AO helper maps with bevelled mesh edges",
                "wood, lacquer, fabric, and speaker grille also emit packed ORM sidecar maps for runtime material response QA",
                "foreground sofa now uses continuous grid-sculpted seat, back, and rear upholstery surfaces with UVs, crown/depression shaping, integrated welts, soft buttons, rounded base, pillow, throw, rolled-arm, rear tailored welt/fold details, side stitch meshes, seam piping, outer welt piping, throw threads, tassel knots, round legs, floor glides, and tufting details",
                "coffee table now uses custom rounded top/lower shelf/inset/glass/tray-lip/apron/drawer-front meshes, tapered round legs, thinner shelf construction, crossbars, foot levelers, visible lower slats, screw caps, glass reflection streaks, books, remote buttons, mug liquid, and controller thumbstick detail",
                "desk now uses a rounded oiled-wood worktop, recessed shadow lines, a black wire grommet, tapered round legs, soft lacquer drawer fronts, a visible under-tray, mat weave strips, and loose cable segments instead of one large rectangular slab",
                "shelf now uses rounded warm side posts, rounded lacquer boards, underside shadow lines, front lips, an inset cabinet, book highlights, a woven lower storage box, plant, and camera detail",
                "media console now uses a rounded lacquer body, inset wood drawer, fine slatted front, long reveal line, and round legs so the TV zone no longer reads as a single white cuboid",
                "object names preserve zone and material role for future split/LOD/catalog promotion",
            ],
            "knownGapsBeforeCommercialPromotion": [
                "PBR maps are procedural helper maps, not baked high-poly detail or hand-authored production texture sets",
                "foreground sofa and coffee table now have bespoke rounded topology, but the full furniture set is still stylized for QA composition and not licensed as final commercial catalog SKU content",
                "no decimated proxy, LOD ladder, final UV bake, meshopt package, or collider sidecar yet; packed ORM sidecars are present but still need KTX2/runtime promotion",
                "needs visual comparison against approved paid/commercial/open room furniture packs before release promotion",
                "not a true baked-lightmap asset; lighting integration is still hybrid runtime/post pass",
            ],
            "currentGrade": "runtime QA candidate, not final commercial catalog asset",
        },
    }
    review_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
