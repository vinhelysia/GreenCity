# m08_remove_sill.py  -  Remove the grey concrete sill from the joined frame,
# then rejoin and re-export the GLB / blend.
import os
from mathutils import Vector
exec(open(os.path.join(r"C:\Stuff\GreenCity\blender\bunker_door",
                       "m00_common.py")).read())

frame = bpy.data.objects["BunkerDoor_Frame"]
vl = bpy.context.view_layer
bpy.ops.object.mode_set(mode='OBJECT') if bpy.context.object else None
bpy.ops.object.select_all(action='DESELECT')
frame.select_set(True); vl.objects.active = frame

# split into loose pieces (the original boxes)
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.mesh.separate(type='LOOSE')
bpy.ops.object.mode_set(mode='OBJECT')

pieces = [o for o in get_coll().objects
          if o.type == 'MESH' and o.name.startswith("BunkerDoor_Frame")]

def world_center_z(o):
    zs = [(o.matrix_world @ Vector(c)).z for c in o.bound_box]
    return sum(zs) / 8.0

# sill = lowest-sitting piece
sill = min(pieces, key=world_center_z)
keep = [o for o in pieces if o is not sill]
removed = sill.name
bpy.data.objects.remove(sill, do_unlink=True)

# rejoin remaining frame pieces
bpy.ops.object.select_all(action='DESELECT')
for o in keep:
    o.select_set(True)
vl.objects.active = keep[0]
bpy.ops.object.join()
keep[0].name = "BunkerDoor_Frame"
keep[0].data.name = "BunkerDoor_Frame_mesh"

# ---- re-export ----
BASE = r"C:\Stuff\GreenCity\blender\bunker_door"
bpy.context.scene.frame_set(1)
bpy.ops.object.select_all(action='DESELECT')
for o in get_coll().objects:
    o.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(BASE, "bunker_door.glb"),
    export_format='GLB', use_selection=True, export_animations=True,
    export_apply=False, export_yup=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(BASE, "bunker_door.blend"))

result = {"removed": removed, "frame_center_z_removed": round(world_center_z(keep[0]),2)}
print("m08: removed sill piece", removed)
