# m14_collision.py  -  Primitive collision shapes (boxes + cylinder).
# Named with Godot's glTF suffix "-convcolonly" => convex collision, not rendered.
# Rename to UCX_* for Unreal, or just use them as plain meshes in Unity.
import os, math
BASE = r"C:\Stuff\GreenCity\blender\bunker_door"
exec(open(os.path.join(BASE, "m00_common.py")).read())

sc = bpy.context.scene
sc.frame_set(1)
bpy.context.view_layer.update()
hinge = bpy.data.objects["BunkerDoor_Hinge"]
wpivot = bpy.data.objects["BunkerDoor_WheelPivot"]

# wipe any previous collision objects so this module is re-runnable
for o in [o for o in bpy.data.objects if o.name.startswith("BD_Col_")]:
    bpy.data.objects.remove(o, do_unlink=True)

made = []

def col_box(name, size, loc, parent=None):
    o = new_box(name, size, loc, mat_name=None, bevel=0.0)
    if parent:
        o.parent = parent
        o.matrix_parent_inverse = parent.matrix_world.inverted()
    o.display_type = 'WIRE'
    o.hide_render = True
    made.append(o.name)
    return o

# ---- static frame: 3 boxes (jambs + lintel); sill was removed ----
col_box("BD_Col_FrameJambL-convcolonly", (0.30, 0.52, 2.00), (-0.69, 0.0, 1.15))
col_box("BD_Col_FrameJambR-convcolonly", (0.30, 0.52, 2.00), (0.69, 0.0, 1.15))
col_box("BD_Col_FrameLintel-convcolonly", (1.68, 0.52, 0.32), (0.0, 0.0, 2.31))

# ---- door leaf: one box covering slab + slats + back mechanism (swings) ----
col_box("BD_Col_Door-convcolonly", (1.00, 0.34, 1.94), (0.0, -0.04, 1.15),
        parent=hinge)

# ---- red hand wheel: cylinder (spins with the wheel) ----
w = new_cyl("BD_Col_Wheel-convcolonly", 0.23, 0.09, (0.10, 0.225, 1.20),
            rot=(math.pi / 2, 0, 0), verts=12, mat_name=None, bevel=0.0)
w.parent = wpivot
w.matrix_parent_inverse = wpivot.matrix_world.inverted()
w.display_type = 'WIRE'; w.hide_render = True
made.append(w.name)

# ---- re-export ----
bpy.context.view_layer.update()
bpy.ops.object.select_all(action='DESELECT')
for o in get_coll().objects:
    o.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(BASE, "bunker_door.glb"),
    export_format='GLB', use_selection=True, export_animations=True,
    export_apply=False, export_yup=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(BASE, "bunker_door.blend"))

result = {"colliders": made, "tris": {n: tris(bpy.data.objects[n]) for n in made}}
print("m14:", made)
