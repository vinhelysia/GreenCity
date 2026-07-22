# m11_door_back.py  -  Detailed back of the door: gearbox hub, cross-brace ribs,
# radial linkage, hinge barrels, rubber gasket seal. Joined into BunkerDoor_Back.
import os, math
BASE = r"C:\Stuff\GreenCity\blender\bunker_door"
exec(open(os.path.join(BASE, "m00_common.py")).read())

# ---- flat, export-friendly materials for the machinery ----
def flatmat(name, rgb, metallic, rough):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True; nt = m.node_tree; nt.nodes.clear()
    o = nt.nodes.new("ShaderNodeOutputMaterial"); b = nt.nodes.new("ShaderNodeBsdfPrincipled")
    b.inputs["Base Color"].default_value = (*rgb, 1)
    b.inputs["Metallic"].default_value = metallic
    b.inputs["Roughness"].default_value = rough
    nt.links.new(b.outputs["BSDF"], o.inputs["Surface"]); return m
flatmat("BD_BackMetal", (0.045, 0.062, 0.048), 0.4, 0.62)
flatmat("BD_Steel",     (0.070, 0.070, 0.075), 0.6, 0.42)
flatmat("BD_Gasket",    (0.010, 0.010, 0.010), 0.0, 0.95)

YB = -0.09          # back working plane (behind the leaf's -0.07 face)
CX, CZ = 0.10, 1.15  # mechanism centre (aligned to the wheel rod)

parts = []
def P(o): parts.append(o); return o

# gearbox hub where the wheel rod meets the linkage
P(new_cyl("bk_hub", 0.11, 0.12, (CX, YB - 0.02, CZ), rot=(math.pi/2, 0, 0),
          verts=14, mat_name="BD_Steel", bevel=0.006))
P(new_box("bk_hubbox", (0.20, 0.10, 0.20), (CX, YB, CZ),
          mat_name="BD_BackMetal", bevel=0.01))

# cross-brace ribs (vertical + horizontal) acting as linkage covers
P(new_box("bk_ribV", (0.09, 0.05, 1.78), (CX, YB, CZ), mat_name="BD_BackMetal", bevel=0.006))
P(new_box("bk_ribH", (0.92, 0.05, 0.09), (0.0, YB, CZ), mat_name="BD_BackMetal", bevel=0.006))
# diagonal gussets
for a in (1, -1):
    P(new_box("bk_diag_%d" % a, (0.055, 0.045, 1.15), (CX, YB, CZ),
              rot=(0, math.radians(38) * a, 0), mat_name="BD_BackMetal", bevel=0.005))

# radial linkage rods hub -> each dog (thin steel)
for nm, sz, lo in [
    ("lk_L", (0.34, 0.035, 0.035), (-0.25, YB - 0.01, CZ)),
    ("lk_R", (0.34, 0.035, 0.035), (0.42, YB - 0.01, CZ)),
    ("lk_T", (0.035, 0.035, 0.34), (CX, YB - 0.01, 1.78)),
    ("lk_B", (0.035, 0.035, 0.34), (CX, YB - 0.01, 0.52)),
]:
    P(new_box("bk_" + nm, sz, lo, mat_name="BD_Steel", bevel=0.004))

# dog guide housings at the 4 edge mid-points
for nm, lo in [("gL", (-0.46, YB, CZ)), ("gR", (0.46, YB, CZ)),
               ("gT", (0.0, YB, 2.02)), ("gB", (0.0, YB, 0.28))]:
    P(new_box("bk_house_" + nm, (0.12, 0.11, 0.12), lo,
              mat_name="BD_BackMetal", bevel=0.006))

# hinge barrels on the back of the hinge edge
for i, z in enumerate((0.55, 1.15, 1.75)):
    P(new_cyl("bk_hinge_%d" % i, 0.05, 0.22, (-0.5, YB + 0.03, z),
              verts=10, mat_name="BD_Steel", bevel=0.005))

# rubber gasket seal ring around the perimeter (hermetic seal)
YG = -0.075
for nm, sz, lo in [
    ("gk_L", (0.03, 0.03, 1.86), (-0.45, YG, CZ)),
    ("gk_R", (0.03, 0.03, 1.86), (0.45, YG, CZ)),
    ("gk_T", (0.93, 0.03, 0.03), (0.0, YG, 2.08)),
    ("gk_B", (0.93, 0.03, 0.03), (0.0, YG, 0.22)),
]:
    P(new_box("bk_" + nm, sz, lo, mat_name="BD_Gasket", bevel=0.003))

# ---- join static back parts into one mesh, parent to the door (Hinge) ----
vl = bpy.context.view_layer
if bpy.context.object:
    bpy.ops.object.mode_set(mode='OBJECT')
bpy.ops.object.select_all(action='DESELECT')
for o in parts:
    o.select_set(True)
vl.objects.active = parts[0]
bpy.ops.object.join()
back = parts[0]
back.name = "BunkerDoor_Back"; back.data.name = "BunkerDoor_Back_mesh"

hinge = bpy.data.objects["BunkerDoor_Hinge"]
vl.update()
back.parent = hinge
back.matrix_parent_inverse = hinge.matrix_world.inverted()

result = {"back_tris": tris(back), "parent": back.parent.name}
print("m11: built BunkerDoor_Back,", tris(back), "tris")
