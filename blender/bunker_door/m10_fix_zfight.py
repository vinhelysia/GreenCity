# m10_fix_zfight.py  -  Remove coincident/overlapping faces that cause z-fighting,
# weld micro-seams, recalc normals. Fixes the "snapping" texture on the leaf.
import os, bmesh
from collections import defaultdict
BASE = r"C:\Stuff\GreenCity\blender\bunker_door"
exec(open(os.path.join(BASE, "m00_common.py")).read())

def clean(name):
    ob = bpy.data.objects[name]
    me = ob.data
    bm = bmesh.new(); bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0006)
    # bucket faces by (rounded centre + rounded normal); duplicates z-fight
    tol = 0.004
    buck = defaultdict(list)
    for f in bm.faces:
        c = f.calc_center_median()
        key = (round(c.x / tol), round(c.y / tol), round(c.z / tol),
               round(f.normal.x, 1), round(f.normal.y, 1), round(f.normal.z, 1))
        buck[key].append(f)
    to_del = []
    for fs in buck.values():
        if len(fs) > 1:
            fs.sort(key=lambda f: f.calc_area(), reverse=True)
            to_del += fs[1:]                 # keep largest, drop the overlaps
    n = len(to_del)
    if to_del:
        bmesh.ops.delete(bm, geom=to_del, context='FACES')
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(me); bm.free()
    me.update()
    return n

removed = {n: clean(n) for n in
           ["BunkerDoor_Leaf", "BunkerDoor_Frame", "BunkerDoor_Wheel"]}

# re-export
bpy.context.scene.frame_set(1)
bpy.ops.object.select_all(action='DESELECT')
for o in get_coll().objects:
    o.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(BASE, "bunker_door.glb"),
    export_format='GLB', use_selection=True, export_animations=True,
    export_apply=False, export_yup=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(BASE, "bunker_door.blend"))
result = {"faces_removed": removed}
print("m10: removed coincident faces", removed)
