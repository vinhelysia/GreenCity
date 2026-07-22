# m17_backframe_hinge.py
#  A) Back casing / architrave so the frame reads as finished from behind.
#     NOTE: it surrounds the frame OUTSIDE the opening. A border around the
#     opening itself is impossible here - the door opens toward -Y and sweeps
#     that whole volume.
#  B) Bolts the hinge straps properly onto the door (mounting plate + bolts).
import os, math
BASE = r"C:\Stuff\GreenCity\blender\bunker_door"
exec(open(os.path.join(BASE, "m00_common.py")).read())

sc = bpy.context.scene
sc.frame_set(1)
bpy.context.view_layer.update()
vl = bpy.context.view_layer
PX, PY = -0.50, -0.185
ZS = (0.55, 1.15, 1.75)

# flat, export-safe green matching the baked paint
m = bpy.data.materials.get("BD_PaintGreenFlat") or bpy.data.materials.new("BD_PaintGreenFlat")
m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
o = nt.nodes.new("ShaderNodeOutputMaterial"); b = nt.nodes.new("ShaderNodeBsdfPrincipled")
b.inputs["Base Color"].default_value = (0.10, 0.17, 0.085, 1)
b.inputs["Metallic"].default_value = 0.15
b.inputs["Roughness"].default_value = 0.78
nt.links.new(b.outputs["BSDF"], o.inputs["Surface"])

# ---------- A) back casing ----------
for old in [x for x in bpy.data.objects if x.name.startswith("BunkerDoor_BackCasing")]:
    bpy.data.objects.remove(old, do_unlink=True)
cas = []
cas.append(new_box("bc_L", (0.32, 0.08, 2.39), (-0.76, -0.30, 1.195),
                   mat_name="BD_PaintGreenFlat", bevel=0.008))
cas.append(new_box("bc_R", (0.32, 0.08, 2.39), (0.76, -0.30, 1.195),
                   mat_name="BD_PaintGreenFlat", bevel=0.008))
cas.append(new_box("bc_T", (1.84, 0.08, 0.16), (0.0, -0.30, 2.47),
                   mat_name="BD_PaintGreenFlat", bevel=0.008))
# back reveal band lining the jamb returns (sits inside the jamb depth, flush)
cas.append(new_box("bc_JL", (0.30, 0.06, 2.39), (-0.69, -0.29, 1.195),
                   mat_name="BD_PaintGreenFlat", bevel=0.006))
cas.append(new_box("bc_JR", (0.30, 0.06, 2.39), (0.69, -0.29, 1.195),
                   mat_name="BD_PaintGreenFlat", bevel=0.006))
bpy.ops.object.select_all(action='DESELECT')
for x in cas: x.select_set(True)
vl.objects.active = cas[0]
bpy.ops.object.join()
casing = cas[0]
casing.name = "BunkerDoor_BackCasing"; casing.data.name = "BunkerDoor_BackCasing_mesh"
casing.parent = None                      # static, part of the frame

# ---------- B) bolt the hinge straps onto the door ----------
strap = bpy.data.objects["BunkerDoor_HingeStrap"]
add = []
for i, z in enumerate(ZS):
    # mounting plate flush on the door's back plate
    add.append(new_box(f"hp_plate_{i}", (0.22, 0.06, 0.20), (-0.34, -0.135, z),
                       mat_name="BD_Steel", bevel=0.006))
    # gusset tying plate to strap
    add.append(new_box(f"hp_gusset_{i}", (0.24, 0.05, 0.06), (-0.35, -0.175, z),
                       mat_name="BD_Steel", bevel=0.005))
    # bolt heads through the plate into the door
    for dz in (-0.06, 0.06):
        for dx in (-0.07, 0.06):
            add.append(new_cyl(f"hp_bolt_{i}_{dz}_{dx}", 0.017, 0.05,
                               (-0.34 + dx, -0.105, z + dz),
                               rot=(math.pi / 2, 0, 0), verts=6,
                               mat_name="BD_Bolt", bevel=0.0))
bpy.ops.object.select_all(action='DESELECT')
for x in add: x.select_set(True)
strap.select_set(True)
vl.objects.active = strap
bpy.ops.object.join()

# ---------- C) verify nothing collides through the swing ----------
BOX = [("JambL", (-0.84, -0.54), (-0.26, 0.26), (0.0, 2.15)),
       ("JambR", (0.54, 0.84), (-0.26, 0.26), (0.0, 2.15)),
       ("Lintel", (-0.84, 0.84), (-0.26, 0.26), (2.15, 2.47)),
       ("CasL", (-0.92, -0.60), (-0.34, -0.26), (0.0, 2.39)),
       ("CasR", (0.60, 0.92), (-0.34, -0.26), (0.0, 2.39)),
       ("CasT", (-0.92, 0.92), (-0.34, -0.26), (2.39, 2.55)),
       ("CasJL", (-0.84, -0.54), (-0.32, -0.26), (0.0, 2.39)),
       ("CasJR", (0.54, 0.84), (-0.32, -0.26), (0.0, 2.39))]
MOVING = ["BunkerDoor_Leaf", "BunkerDoor_Back", "BunkerDoor_Wheel",
          "BunkerDoor_HingeStrap"]
pts = []
for n in MOVING:
    ob = bpy.data.objects[n]; mw = ob.matrix_world
    pts += [mw @ v.co for v in ob.data.vertices]
M = 0.004
def hit(x, y, z):
    for nm, (x0, x1), (y0, y1), (z0, z1) in BOX:
        if x0 + M < x < x1 - M and y0 + M < y < y1 - M and z0 + M < z < z1 - M:
            return nm
    return None
worst = {}
for s in range(22):
    th = math.radians(-105.0 * s / 21)
    c, si = math.cos(th), math.sin(th)
    for p in pts:
        dx, dy = p.x - PX, p.y - PY
        h = hit(PX + dx * c - dy * si, PY + dx * si + dy * c, p.z)
        if h:
            worst[h] = worst.get(h, 0) + 1

# ---------- export ----------
bpy.ops.object.select_all(action='DESELECT')
for x in get_coll().objects: x.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(BASE, "bunker_door.glb"),
    export_format='GLB', use_selection=True, export_animations=True,
    export_animation_mode='ACTIVE_ACTIONS', export_apply=False, export_yup=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(BASE, "bunker_door.blend"))

result = {"casing_tris": tris(casing), "strap_tris": tris(strap),
          "collisions_during_swing": worst}
print("m17:", result)
