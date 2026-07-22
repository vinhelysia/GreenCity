# m09_retime_anim.py  -  Realistic, Bezier-eased open animation.
# Slower hand-crank + heavy door swing with ease-in/out and a small settle.
import os, math
BASE = r"C:\Stuff\GreenCity\blender\bunker_door"
exec(open(os.path.join(BASE, "m00_common.py")).read())

# make every newly inserted key smooth Bezier by default (Blender 5 safe)
prefs = bpy.context.preferences.edit
prefs.keyframe_new_interpolation_type = 'BEZIER'
prefs.keyframe_new_handle_type = 'AUTO_CLAMPED'

sc = bpy.context.scene
sc.render.fps = 24
sc.frame_start = 1
sc.frame_end = 185

hinge = bpy.data.objects["BunkerDoor_Hinge"]
wheel = bpy.data.objects["BunkerDoor_WheelPivot"]
hinge.animation_data_clear()
wheel.animation_data_clear()

def key(ob, index, frames_vals):
    for f, v in frames_vals:
        cur = list(ob.rotation_euler)
        cur[index] = v
        ob.rotation_euler = cur
        ob.keyframe_insert("rotation_euler", index=index, frame=f)

R = math.radians
# --- Wheel: grab (hold), crank ~2.5 turns over ~3s, ease in + ease out, hold ---
key(wheel, 1, [(1, 0.0), (7, 0.0), (79, R(-900)), (185, R(-900))])
# --- Door: stays shut through the crank, then heavy swing 0..107 with settle to 105 ---
key(hinge, 2, [(1, 0.0), (90, 0.0), (170, R(-107)), (185, R(-105))])

# best-effort: flatten the rest holds so nothing drifts (works on any API)
def fcurves(ob):
    try:
        return list(ob.animation_data.action.fcurves)          # legacy
    except Exception:
        fcs = []
        ad = ob.animation_data
        for lay in ad.action.layers:
            for st in lay.strips:
                try:
                    cb = st.channelbag(ad.action_slot)
                    if cb: fcs += list(cb.fcurves)
                except Exception:
                    pass
        return fcs

# ease the very first key out of rest a touch harder (heavier feel)
for ob, idx, fr in [(hinge, 2, 90)]:
    for fc in fcurves(ob):
        for kp in fc.keyframe_points:
            if abs(kp.co.x - fr) < 0.5:
                kp.handle_right_type = 'FREE'
                kp.handle_right = (fr + 26, kp.co.y)   # long flat = slow start

# ---- re-export ----
sc.frame_set(1)
bpy.ops.object.select_all(action='DESELECT')
for o in get_coll().objects:
    o.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(BASE, "bunker_door.glb"),
    export_format='GLB', use_selection=True, export_animations=True,
    export_apply=False, export_yup=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(BASE, "bunker_door.blend"))

result = {"fps": sc.render.fps, "end": sc.frame_end,
          "wheel_turns": 2.5, "swing_deg": 105,
          "seconds": round(sc.frame_end / sc.render.fps, 1)}
print("m09: retimed to", result["seconds"], "s")
