# m04_wheel_hardware.py  -  Red valve wheel, vertical locking rod, hinges, bolts.
import os, math
exec(open(os.path.join(r"C:\Stuff\GreenCity\blender\bunker_door",
                       "m00_common.py")).read())

WX, WY, WZ = 0.10, 0.225, 1.20     # wheel centre (on the leaf face)

def new_torus(name, major, minor, loc, mat_name):
    bpy.ops.mesh.primitive_torus_add(major_radius=major, minor_radius=minor,
        major_segments=16, minor_segments=6, location=loc,
        rotation=(math.pi/2, 0, 0))
    ob = bpy.context.active_object
    ob.name = name
    link(ob); flat(ob.data)
    m = mat(mat_name)
    if m: ob.data.materials.append(m)
    return ob

# ---- Red hand wheel: rim + crossed spokes + hub ----
new_torus("BunkerDoor_Wheel_Rim", 0.20, 0.024, (WX, WY, WZ), "BD_WheelRed")
new_box("BunkerDoor_Wheel_SpokeH", (0.40, 0.035, 0.045), (WX, WY, WZ),
        mat_name="BD_WheelRed", bevel=0.006)
new_box("BunkerDoor_Wheel_SpokeV", (0.045, 0.035, 0.40), (WX, WY, WZ),
        mat_name="BD_WheelRed", bevel=0.006)
new_cyl("BunkerDoor_Wheel_Hub", 0.05, 0.10, (WX, WY, WZ),
        rot=(math.pi/2, 0, 0), verts=12, mat_name="BD_WheelRed", bevel=0.006)

# ---- Vertical locking rod running through the wheel ----
new_cyl("BunkerDoor_Rod", 0.028, 1.86, (WX, 0.175, 1.15),
        verts=10, mat_name="BD_Rod", bevel=0.004)
for z in (0.32, 1.98):
    new_box("BunkerDoor_RodBracket_%d" % int(z*100), (0.10, 0.10, 0.06),
            (WX, 0.15, z), mat_name="BD_Bolt", bevel=0.006)
# lock lugs where the rod bites the frame
for z in (0.45, 1.85):
    new_box("BunkerDoor_Lug_%d" % int(z*100), (0.16, 0.09, 0.05),
            (WX, 0.14, z), mat_name="BD_SlatMetal", bevel=0.006)

# ---- Hinges on the left edge ----
for i, z in enumerate((0.55, 1.15, 1.75)):
    new_cyl(f"BunkerDoor_Hinge_{i}", 0.045, 0.24, (-0.52, 0.02, z),
            verts=10, mat_name="BD_Rod", bevel=0.005)
    new_box(f"BunkerDoor_HingePlate_{i}", (0.14, 0.06, 0.16), (-0.47, 0.05, z),
            mat_name="BD_SlatMetal", bevel=0.005)

# ---- Bolt ring around the leaf perimeter ----
bolts = 0
xs = [-0.44, -0.22, 0.0, 0.22, 0.44]
for x in xs:
    for z in (0.30, 2.00):
        new_cyl("BunkerDoor_Bolt_%d_%d" % (int((x+1)*100), int(z*100)),
                0.022, 0.05, (x, 0.11, z), rot=(math.pi/2, 0, 0), verts=6,
                mat_name="BD_Bolt", bevel=0.0)
        bolts += 1

result = {"hardware_done": True, "bolts": bolts,
          "total_objs": len(get_coll().objects)}
print("m04: hardware built, total objects =", len(get_coll().objects))
