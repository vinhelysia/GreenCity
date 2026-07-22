# m03_slats.py  -  Horizontal armored louver slats across the leaf face.
import os, math
exec(open(os.path.join(r"C:\Stuff\GreenCity\blender\bunker_door",
                       "m00_common.py")).read())

N = 12
z0, z1 = 0.34, 1.96          # slat band on the leaf
tilt = math.radians(20)       # louver angle
made = []
for i in range(N):
    z = z0 + (z1 - z0) * i / (N - 1)
    s = new_box(f"BunkerDoor_Slat_{i:02d}", (0.84, 0.07, 0.105),
                (0.0, 0.085, z), rot=(tilt, 0, 0),
                mat_name="BD_SlatMetal", bevel=0.006)
    made.append(s.name)

# thin shadow-gap backing behind the slats (dark) already covered by leaf recess.
# add two vertical retainer strips holding the slat ends
new_box("BunkerDoor_SlatRailL", (0.05, 0.11, 1.74), (-0.41, 0.085, 1.15),
        mat_name="BD_SlatMetal", bevel=0.006)
new_box("BunkerDoor_SlatRailR", (0.05, 0.11, 1.74), (0.41, 0.085, 1.15),
        mat_name="BD_SlatMetal", bevel=0.006)

result = {"slats": len(made)}
print("m03: built", len(made), "slats")
