# m12_dogs_anim.py  -  4 locking dogs that retract after the wheel crank,
# just before the door swings. Then re-export GLB + blend.
import os
BASE = r"C:\Stuff\GreenCity\blender\bunker_door"
exec(open(os.path.join(BASE, "m00_common.py")).read())

prefs = bpy.context.preferences.edit
prefs.keyframe_new_interpolation_type = 'BEZIER'
prefs.keyframe_new_handle_type = 'AUTO_CLAMPED'

hinge = bpy.data.objects["BunkerDoor_Hinge"]
vl = bpy.context.view_layer
YB = -0.09

# (name, size, locked_loc, slide_axis, unlocked_value)
dogs = [
    ("BunkerDoor_Dog_L", (0.16, 0.06, 0.11), (-0.47, YB, 1.15), 0, -0.40),
    ("BunkerDoor_Dog_R", (0.16, 0.06, 0.11), (0.47, YB, 1.15), 0, 0.40),
    ("BunkerDoor_Dog_T", (0.11, 0.06, 0.16), (0.0, YB, 2.08), 2, 2.01),
    ("BunkerDoor_Dog_B", (0.11, 0.06, 0.16), (0.0, YB, 0.22), 2, 0.29),
]

# unlock window: wheel finishes at f79, door starts moving at f90
F_LOCK_END, F_UNLOCKED = 79, 88

made = []
for name, size, loc, axis, unval in dogs:
    d = new_box(name, size, loc, mat_name="BD_Steel", bevel=0.005)
    vl.update()
    d.parent = hinge
    d.matrix_parent_inverse = hinge.matrix_world.inverted()
    locked = loc[axis]
    for f, v in [(1, locked), (F_LOCK_END, locked), (F_UNLOCKED, unval), (185, unval)]:
        cur = list(d.location); cur[axis] = v; d.location = cur
        d.keyframe_insert("location", index=axis, frame=f)
    made.append(name)

# ---- re-export ----
sc = bpy.context.scene
sc.frame_set(1)
bpy.ops.object.select_all(action='DESELECT')
for o in get_coll().objects:
    o.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(BASE, "bunker_door.glb"),
    export_format='GLB', use_selection=True, export_animations=True,
    export_apply=False, export_yup=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(BASE, "bunker_door.blend"))
result = {"dogs": made}
print("m12: added + animated dogs", made)
