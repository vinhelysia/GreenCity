# m15_ground_frame.py  -  The frame floated 15 cm above the floor after the
# concrete sill was deleted (the sill used to be the ground contact).
# Extends the jamb/lip bottoms down so the frame stands on z = 0.
import os
BASE = r"C:\Stuff\GreenCity\blender\bunker_door"
exec(open(os.path.join(BASE, "m00_common.py")).read())

sc = bpy.context.scene
sc.frame_set(1)
bpy.context.view_layer.update()

DROP = 0.15        # jamb bottom sits at 0.15 -> bring it to 0.0

def extend_bottom(obj_name, z_thresh, drop=DROP):
    ob = bpy.data.objects[obj_name]
    me = ob.data
    zoff = ob.matrix_world.translation.z      # no rotation/scale on these
    moved = 0
    for v in me.vertices:
        if v.co.z + zoff <= z_thresh:
            v.co.z -= drop
            moved += 1
    me.update()
    return moved

moved = {
    "BunkerDoor_Frame": extend_bottom("BunkerDoor_Frame", 0.17),
    "BD_Col_FrameJambL-convcolonly": extend_bottom("BD_Col_FrameJambL-convcolonly", 0.20),
    "BD_Col_FrameJambR-convcolonly": extend_bottom("BD_Col_FrameJambR-convcolonly", 0.20),
}

# report new lowest points
lows = {}
for o in bpy.data.objects:
    if o.type == 'MESH' and (o.name.startswith("BunkerDoor") or o.name.startswith("BD_Col")):
        mw = o.matrix_world
        lows[o.name] = round(min((mw @ v.co).z for v in o.data.vertices), 3)

# re-export
bpy.ops.object.select_all(action='DESELECT')
for o in get_coll().objects:
    o.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(BASE, "bunker_door.glb"),
    export_format='GLB', use_selection=True, export_animations=True,
    export_animation_mode='ACTIVE_ACTIONS', export_apply=False, export_yup=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(BASE, "bunker_door.blend"))

result = {"verts_moved": moved, "new_min_z": lows}
print("m15:", moved)
