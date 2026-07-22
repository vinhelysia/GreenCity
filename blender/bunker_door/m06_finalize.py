# m06_finalize.py  -  Join the 51 parts into 3 game-ready meshes:
#   BunkerDoor_Frame (static) | BunkerDoor_Leaf (swings) | BunkerDoor_Wheel (spins)
# Parenting to the Hinge / WheelPivot empties is preserved.
import os
exec(open(os.path.join(r"C:\Stuff\GreenCity\blender\bunker_door",
                       "m00_common.py")).read())

coll = get_coll()
vl = bpy.context.view_layer
bpy.ops.object.mode_set(mode='OBJECT') if bpy.context.object else None

def join_group(names, out_name, keep_active):
    objs = [bpy.data.objects[n] for n in names if n in bpy.data.objects]
    if not objs:
        return None
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs:
        o.select_set(True)
    act = bpy.data.objects[keep_active]
    vl.objects.active = act
    act.select_set(True)
    bpy.ops.object.join()
    act.name = out_name
    act.data.name = out_name + "_mesh"
    return act

frame, leaf, wheel = [], [], []
for ob in list(coll.objects):
    if ob.type != 'MESH':
        continue
    n = ob.name
    if n.startswith("BunkerDoor_Frame_"):
        frame.append(n)
    elif "Wheel_" in n:
        wheel.append(n)
    else:
        leaf.append(n)

join_group(wheel, "BunkerDoor_Wheel", "BunkerDoor_Wheel_Rim")
join_group(leaf, "BunkerDoor_Leaf", "BunkerDoor_Leaf")   # leaf backing already named this
join_group(frame, "BunkerDoor_Frame", frame[0])

bpy.context.view_layer.update()
meshes = [o.name for o in coll.objects if o.type == 'MESH']
tri_total = sum(tris(bpy.data.objects[m]) for m in meshes)
result = {"meshes": meshes, "tri_total": tri_total,
          "empties": [o.name for o in coll.objects if o.type == 'EMPTY']}
print("m06: joined into", meshes, "| total tris:", tri_total)
