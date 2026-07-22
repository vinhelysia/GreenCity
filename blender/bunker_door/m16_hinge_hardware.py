# m16_hinge_hardware.py  -  Put real hinge hardware ON the rotation axis.
# The pivot sits at the door's back-outer corner (required, or the 0.42 m thick
# door sweeps through the jamb). Without hardware there, the door looked like it
# detached from the frame. Adds frame-mounted barrels + door-mounted straps,
# and removes the old barrels that were modelled at the door's mid-thickness.
import os, math, bmesh
from mathutils import Vector
BASE = r"C:\Stuff\GreenCity\blender\bunker_door"
exec(open(os.path.join(BASE, "m00_common.py")).read())

sc = bpy.context.scene
sc.frame_set(1)
bpy.context.view_layer.update()

PX, PY = -0.50, -0.185          # rotation axis (matches m13)
ZS = (0.55, 1.15, 1.75)

# ---------- 1. delete the old, misplaced hinge islands ----------
def delete_islands(name, keep_test):
    ob = bpy.data.objects[name]; me = ob.data; mw = ob.matrix_world
    bm = bmesh.new(); bm.from_mesh(me); bm.verts.ensure_lookup_table()
    seen, kill = set(), []
    for v in bm.verts:
        if v.index in seen: continue
        st, comp = [v], []
        seen.add(v.index)
        while st:
            cur = st.pop(); comp.append(cur)
            for e in cur.link_edges:
                o = e.other_vert(cur)
                if o.index not in seen:
                    seen.add(o.index); st.append(o)
        pts = [mw @ x.co for x in comp]
        mn = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
        mx = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
        if not keep_test((mn + mx) / 2, mx - mn, len(comp)):
            kill += comp
    n = len(kill)
    if kill:
        bmesh.ops.delete(bm, geom=kill, context='VERTS')
    bm.to_mesh(me); bm.free(); me.update()
    return n

# leaf: drop small islands on the hinge edge (old barrels + plates), keep EdgeL strip
removed_leaf = delete_islands("BunkerDoor_Leaf",
    lambda c, s, n: not (c.x < -0.44 and s.z <= 0.30))
# back: drop the 3 old barrels (x <= -0.47, short in Z)
removed_back = delete_islands("BunkerDoor_Back",
    lambda c, s, n: not (c.x < -0.47 and s.z <= 0.30))

# ---------- 2. frame-mounted hinge barrels (STATIC) ----------
barrel_parts = []
for i, z in enumerate(ZS):
    barrel_parts.append(new_cyl(f"hb_barrel_{i}", 0.062, 0.30, (PX, PY, z),
                                verts=12, mat_name="BD_Steel", bevel=0.005))
    # bracket tying the barrel back into the jamb
    barrel_parts.append(new_box(f"hb_bracket_{i}", (0.11, 0.09, 0.11),
                                (PX - 0.055, PY, z), mat_name="BD_BackMetal",
                                bevel=0.006))
vl = bpy.context.view_layer
bpy.ops.object.select_all(action='DESELECT')
for o in barrel_parts: o.select_set(True)
vl.objects.active = barrel_parts[0]
bpy.ops.object.join()
barrel = barrel_parts[0]
barrel.name = "BunkerDoor_HingeBarrel"; barrel.data.name = "BunkerDoor_HingeBarrel_mesh"
barrel.parent = None                      # stays with the frame

# ---------- 3. door-mounted hinge straps (MOVE WITH DOOR) ----------
strap_parts = []
for i, z in enumerate(ZS):
    # strap reaching from the barrel onto the door's back plate
    strap_parts.append(new_box(f"hs_strap_{i}", (0.30, 0.12, 0.13),
                               (PX + 0.15, PY + 0.025, z),
                               mat_name="BD_Steel", bevel=0.006))
    # knuckle wrapping the pin
    strap_parts.append(new_cyl(f"hs_knuckle_{i}", 0.075, 0.11, (PX, PY, z),
                               verts=12, mat_name="BD_BackMetal", bevel=0.005))
bpy.ops.object.select_all(action='DESELECT')
for o in strap_parts: o.select_set(True)
vl.objects.active = strap_parts[0]
bpy.ops.object.join()
strap = strap_parts[0]
strap.name = "BunkerDoor_HingeStrap"; strap.data.name = "BunkerDoor_HingeStrap_mesh"
hinge = bpy.data.objects["BunkerDoor_Hinge"]
vl.update()
strap.parent = hinge
strap.matrix_parent_inverse = hinge.matrix_world.inverted()

# ---------- 4. re-export ----------
bpy.context.view_layer.update()
bpy.ops.object.select_all(action='DESELECT')
for o in get_coll().objects: o.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(BASE, "bunker_door.glb"),
    export_format='GLB', use_selection=True, export_animations=True,
    export_animation_mode='ACTIVE_ACTIONS', export_apply=False, export_yup=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(BASE, "bunker_door.blend"))

result = {"verts_removed_leaf": removed_leaf, "verts_removed_back": removed_back,
          "barrel_tris": tris(barrel), "strap_tris": tris(strap)}
print("m16:", result)
