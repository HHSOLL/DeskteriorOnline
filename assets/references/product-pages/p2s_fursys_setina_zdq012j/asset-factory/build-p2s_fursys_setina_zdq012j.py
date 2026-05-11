# Auto-generated DeskteriorOnline private prototype asset rebuild scaffold.
# Source URL: https://fursys-store.com/product/detail.html?product_no=2913&cate_no=118&display_group=1
# Asset key: p2s_fursys_setina_zdq012j
# This scaffold is an instruction-bearing Blender entrypoint. It must be refined by
# a Blender agent/material pass before public or commercial catalog exposure.

import bpy

ASSET_KEY = "p2s_fursys_setina_zdq012j"
SKU = "ZDQ012J"
MANUFACTURER = "FURSYS"
DIMENSIONS_MM = {"width": 1172, "depth": 590, "height": 587}

REQUIRED_COMPONENTS = [
    "dimension-locked desktop slab with bevelled laminate edge band",
    "front modesty/lift fascia panel with satin warm-grey finish",
    "right-side vertical support panel with matching laminate grain",
    "telescoping lift plates and graphite frame rails",
    "sliding rear power channel and black cable duct",
    "collision sensor paddle/control strip under the front edge",
    "two brushed-metal vertical pull handles",
    "black foot pads and levelling details",
]

# - dimension-locked desktop slab with bevelled laminate edge band
# - front modesty/lift fascia panel with satin warm-grey finish
# - right-side vertical support panel with matching laminate grain
# - telescoping lift plates and graphite frame rails
# - sliding rear power channel and black cable duct
# - collision sensor paddle/control strip under the front edge
# - two brushed-metal vertical pull handles
# - black foot pads and levelling details

def clear_scene():
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete()

def mm(value):
    return value / 1000.0

def create_box(name, location, scale, material_name):
    bpy.ops.mesh.primitive_cube_add(size=1, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    material = bpy.data.materials.get(material_name) or bpy.data.materials.new(material_name)
    obj.data.materials.append(material)
    return obj

def build_dimension_proxy():
    if DIMENSIONS_MM is None:
        raise RuntimeError("Official dimensions are required before asset generation.")
    width = mm(DIMENSIONS_MM["width"])
    depth = mm(DIMENSIONS_MM["depth"])
    height = mm(DIMENSIONS_MM["height"])
    create_box("dimension_locked_primary_silhouette", (0, height / 2, 0), (width, height, depth), "Material_Blockout")

def main():
    clear_scene()
    build_dimension_proxy()
    bpy.ops.wm.save_as_mainfile(filepath=f"{ASSET_KEY}.blend")

if __name__ == "__main__":
    main()
