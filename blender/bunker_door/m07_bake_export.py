# m07_bake_export.py  -  UV unwrap, bake procedural rust/moss to image textures,
# assign baked materials, export animated GLB, save .blend.
import os
exec(open(os.path.join(r"C:\Stuff\GreenCity\blender\bunker_door",
                       "m00_common.py")).read())

BASE = r"C:\Stuff\GreenCity\blender\bunker_door"
TEX = os.path.join(BASE, "textures")
try: os.makedirs(TEX)
except FileExistsError: pass

sc = bpy.context.scene
sc.render.engine = 'CYCLES'
try: sc.cycles.samples = 24
except Exception: pass
sc.render.bake.margin = 6

targets = ["BunkerDoor_Frame", "BunkerDoor_Leaf", "BunkerDoor_Wheel"]
RES = 1024

def bake_one(name):
    ob = bpy.data.objects[name]
    bpy.ops.object.select_all(action='DESELECT')
    ob.select_set(True); bpy.context.view_layer.objects.active = ob
    # UV unwrap
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=1.2, island_margin=0.015)
    bpy.ops.object.mode_set(mode='OBJECT')
    # target image + image node in every material slot
    img = bpy.data.images.new(name + "_BAKE", RES, RES)
    for slot in ob.material_slots:
        m = slot.material
        if not m or not m.use_nodes:
            continue
        nt = m.node_tree
        node = nt.nodes.new("ShaderNodeTexImage")
        node.image = img
        for n in nt.nodes:
            n.select = False
        node.select = True
        nt.nodes.active = node
    # bake albedo only
    bpy.ops.object.bake(type='DIFFUSE', pass_filter={'COLOR'},
                        use_selected_to_active=False, margin=6)
    # save png
    path = os.path.join(TEX, name + "_albedo.png")
    img.filepath_raw = path; img.file_format = 'PNG'; img.save()
    # new simple baked material
    bm = bpy.data.materials.new(name + "_Baked"); bm.use_nodes = True
    bnt = bm.node_tree; bnt.nodes.clear()
    out = bnt.nodes.new("ShaderNodeOutputMaterial"); out.location = (300, 0)
    bsdf = bnt.nodes.new("ShaderNodeBsdfPrincipled"); bsdf.location = (0, 0)
    bsdf.inputs["Roughness"].default_value = 0.8
    tex = bnt.nodes.new("ShaderNodeTexImage"); tex.location = (-350, 0)
    tex.image = img
    bnt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    bnt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    ob.data.materials.clear(); ob.data.materials.append(bm)
    for p in ob.data.polygons:
        p.material_index = 0
    return path

baked = [bake_one(n) for n in targets]

# ---- Export animated GLB ----
sc.frame_set(1)
bpy.ops.object.select_all(action='DESELECT')
for o in get_coll().objects:
    o.select_set(True)
glb = os.path.join(BASE, "bunker_door.glb")
bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB',
    use_selection=True, export_animations=True, export_apply=False,
    export_yup=True)

# ---- Save .blend ----
blend = os.path.join(BASE, "bunker_door.blend")
bpy.ops.wm.save_as_mainfile(filepath=blend)

result = {"glb": glb, "blend": blend, "textures": baked}
print("m07: exported", glb)
