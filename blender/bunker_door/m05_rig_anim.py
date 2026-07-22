# m05_rig_anim.py  -  Parent hierarchy + keyframed open animation.
# WheelPivot (spins) -> under Hinge (swings). Frame parts stay static.
import os, math
exec(open(os.path.join(r"C:\Stuff\GreenCity\blender\bunker_door",
                       "m00_common.py")).read())

coll = get_coll()

def empty(name, loc):
    e = bpy.data.objects.get(name)
    if not e:
        e = bpy.data.objects.new(name, None)
        coll.objects.link(e)
    e.empty_display_type = 'ARROWS'; e.empty_display_size = 0.25
    e.location = loc
    return e

def parent_keep(child, par):
    child.parent = par
    child.matrix_parent_inverse = par.matrix_world.inverted()

# ensure matrices are current
bpy.context.view_layer.update()

hinge = empty("BunkerDoor_Hinge", (-0.52, 0.02, 1.15))
wheel = empty("BunkerDoor_WheelPivot", (0.10, 0.225, 1.20))
bpy.context.view_layer.update()

wheel_parts, leaf_parts = [], []
for ob in coll.objects:
    if ob.type != 'MESH' or not ob.name.startswith("BunkerDoor_"):
        continue
    if ob.name.startswith("BunkerDoor_Frame_"):
        continue                       # static frame
    if "Wheel_" in ob.name:
        wheel_parts.append(ob)
    else:
        leaf_parts.append(ob)

for ob in wheel_parts:
    parent_keep(ob, wheel)
parent_keep(wheel, hinge)              # wheel pivot rides on the leaf
for ob in leaf_parts:
    parent_keep(ob, hinge)

# ---- Timeline ----
sc = bpy.context.scene
sc.render.fps = 24
sc.frame_start = 1
sc.frame_end = 120

def key(ob, path, index, frames_vals):
    for f, v in frames_vals:
        cur = list(getattr(ob, path))
        cur[index] = v
        setattr(ob, path, cur)
        ob.keyframe_insert(path, index=index, frame=f)

# wheel spins ~3 turns to unlock (frames 1-45), then holds
key(wheel, "rotation_euler", 1, [(1, 0.0), (45, math.radians(-1080)),
                                 (120, math.radians(-1080))])
# door stays shut while wheel turns, then swings open ~105 deg (frames 55-115)
key(hinge, "rotation_euler", 2, [(1, 0.0), (55, 0.0),
                                 (115, math.radians(-105)),
                                 (120, math.radians(-105))])

# smooth easing on the swing
for fc in hinge.animation_data.action.fcurves:
    for kp in fc.keyframe_points:
        kp.interpolation = 'BEZIER'
        kp.handle_left_type = kp.handle_right_type = 'AUTO_CLAMPED'

result = {"wheel_parts": len(wheel_parts), "leaf_parts": len(leaf_parts),
          "frame_range": [sc.frame_start, sc.frame_end]}
print("m05: rigged", len(wheel_parts), "wheel +", len(leaf_parts), "leaf parts")
