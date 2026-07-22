# m00_common.py  -  Shared helpers for the bunker-door build. exec() this first
# from every geometry module so each module stays small and self-contained.
import bpy, bmesh
from mathutils import Vector

COLL = "BunkerDoor_Asset"

def get_coll():
    c = bpy.data.collections.get(COLL)
    if not c:
        c = bpy.data.collections.new(COLL)
        bpy.context.scene.collection.children.link(c)
    return c

def link(ob):
    for c in list(ob.users_collection):
        c.objects.unlink(ob)
    get_coll().objects.link(ob)

def mat(name):
    return bpy.data.materials.get(name)

def flat(me):
    for p in me.polygons:
        p.use_smooth = False

def _finish(me, ob, loc, rot, mat_name):
    ob.location = loc
    if rot:
        ob.rotation_euler = rot
    link(ob)
    flat(me)
    if mat_name:
        m = mat(mat_name)
        if m:
            me.materials.append(m)
    return ob

def new_box(name, size, loc=(0, 0, 0), rot=None, mat_name=None,
            bevel=0.006, segments=1):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co.x *= size[0]; v.co.y *= size[1]; v.co.z *= size[2]
    if bevel > 0:
        bmesh.ops.bevel(bm, geom=list(bm.verts) + list(bm.edges),
                        offset=bevel, segments=segments, affect='EDGES',
                        clamp_overlap=True)
    bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me)
    return _finish(me, ob, loc, rot, mat_name)

def new_cyl(name, radius, depth, loc=(0, 0, 0), rot=None, verts=10,
            mat_name=None, bevel=0.004, cap=True):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=cap, cap_tris=False, segments=verts,
                          radius1=radius, radius2=radius, depth=depth)
    if bevel > 0:
        bmesh.ops.bevel(bm, geom=list(bm.verts) + list(bm.edges),
                        offset=bevel, segments=1, affect='EDGES',
                        clamp_overlap=True)
    bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me)
    return _finish(me, ob, loc, rot, mat_name)

def new_ncone(name, r1, r2, depth, loc=(0, 0, 0), rot=None, verts=8,
              mat_name=None):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=verts,
                          radius1=r1, radius2=r2, depth=depth)
    bm.to_mesh(me); bm.free()
    ob = bpy.data.objects.new(name, me)
    return _finish(me, ob, loc, rot, mat_name)

def tris(ob):
    return sum(len(p.vertices) - 2 for p in ob.data.polygons)

print("m00 helpers loaded")
