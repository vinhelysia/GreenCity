# m13_fix_hinge.py  -  Fix the door clipping the frame when fully open.
# Cause: the pivot sat in the MIDDLE of the door's thickness, so everything
# behind the pivot swept backwards into the jamb. Real doors pivot on the
# outer corner of the face they open toward. Moves the hinge to the back edge.
import os, math
from mathutils import Vector, Matrix
BASE = r"C:\Stuff\GreenCity\blender\bunker_door"
exec(open(os.path.join(BASE, "m00_common.py")).read())

hinge = bpy.data.objects["BunkerDoor_Hinge"]
sc = bpy.context.scene
sc.frame_set(1)                      # hinge rotation = 0 (rest)
bpy.context.view_layer.update()

# ---- frame collision volumes = AABB of each connected island of the frame ----
def islands_aabb(ob):
    me = ob.data
    adj = {i: set() for i in range(len(me.vertices))}
    for e in me.edges:
        a, b = e.vertices; adj[a].add(b); adj[b].add(a)
    seen, boxes = set(), []
    mw = ob.matrix_world
    for start in range(len(me.vertices)):
        if start in seen: continue
        stack, comp = [start], []
        seen.add(start)
        while stack:
            v = stack.pop(); comp.append(v)
            for n in adj[v]:
                if n not in seen:
                    seen.add(n); stack.append(n)
        pts = [mw @ me.vertices[i].co for i in comp]
        mn = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
        mx = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
        boxes.append((mn, mx))
    return boxes

FRAME_BOXES = islands_aabb(bpy.data.objects["BunkerDoor_Frame"])

# ---- moving points (exclude dogs: they are retracted before the swing) ----
MOVING = ["BunkerDoor_Leaf", "BunkerDoor_Back", "BunkerDoor_Wheel"]
pts = []
for n in MOVING:
    o = bpy.data.objects[n]; mw = o.matrix_world
    pts += [mw @ v.co for v in o.data.vertices]

def penetrations(pivot, deg_max=-105.0, steps=22, margin=0.004):
    px, py = pivot
    worst = 0
    for s in range(steps + 1):
        th = math.radians(deg_max * s / steps)
        c, si = math.cos(th), math.sin(th)
        cnt = 0
        for p in pts:
            dx, dy = p.x - px, p.y - py
            x = px + dx * c - dy * si
            y = py + dx * si + dy * c
            for mn, mx in FRAME_BOXES:
                if (mn.x + margin < x < mx.x - margin and
                    mn.y + margin < y < mx.y - margin and
                    mn.z + margin < p.z < mx.z - margin):
                    cnt += 1; break
        worst = max(worst, cnt)
    return worst

OLD = (hinge.location.x, hinge.location.y)
NEW = (-0.50, -0.185)                 # door's back-outer corner
before = penetrations(OLD)
after = penetrations(NEW)

# ---- move the pivot, keeping every child exactly in place ----
# child_world = hinge.matrix_world @ parent_inverse @ basis ; setting
# parent_inverse to the new rest inverse keeps basis (and keyframes) valid.
children = [o for o in bpy.data.objects if o.parent == hinge]
hinge.location.x, hinge.location.y = NEW
bpy.context.view_layer.update()
for c in children:
    c.matrix_parent_inverse = hinge.matrix_world.inverted()
bpy.context.view_layer.update()

result = {"frame_boxes": len(FRAME_BOXES), "pivot_old": OLD, "pivot_new": NEW,
          "verts_penetrating_before": before, "verts_penetrating_after": after}
print("m13:", result)
