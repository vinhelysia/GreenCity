# m02_frame_leaf.py  -  Static door frame (jambs/lintel/sill) + moving door leaf.
# Coord system: Z up, door faces +Y. Opening ~1.0 x 2.0 m. Leaf hinges on left.
import os
exec(open(os.path.join(os.path.dirname(__file__) if "__file__" in dir() else
    r"C:\Stuff\GreenCity\blender\bunker_door", "m00_common.py")).read())

# ---- Static frame: painted-metal jambs + lintel, concrete sill ----
new_box("BunkerDoor_Frame_JambL", (0.30, 0.52, 2.00), (-0.69, 0.0, 1.15),
        mat_name="BD_PaintGreen", bevel=0.012)
new_box("BunkerDoor_Frame_JambR", (0.30, 0.52, 2.00), (0.69, 0.0, 1.15),
        mat_name="BD_PaintGreen", bevel=0.012)
new_box("BunkerDoor_Frame_Lintel", (1.68, 0.52, 0.32), (0.0, 0.0, 2.31),
        mat_name="BD_PaintGreen", bevel=0.012)
new_box("BunkerDoor_Frame_Sill", (1.68, 0.58, 0.16), (0.0, 0.0, 0.07),
        mat_name="BD_Concrete", bevel=0.010)
# inner dark reveal so leaf doesn't read as floating
new_box("BunkerDoor_Frame_Reveal", (1.10, 0.10, 2.02), (0.0, -0.16, 1.15),
        mat_name="BD_Recess", bevel=0.004)
# raised picture-frame lip around the opening (front)
for nm, sz, lo in [
    ("LipL", (0.10, 0.10, 2.06), (-0.55, 0.16, 1.15)),
    ("LipR", (0.10, 0.10, 2.06), (0.55, 0.16, 1.15)),
    ("LipT", (1.20, 0.10, 0.10), (0.0, 0.16, 2.13)),
    ("LipB", (1.20, 0.10, 0.10), (0.0, 0.16, 0.17)),
]:
    new_box("BunkerDoor_Frame_" + nm, sz, lo, mat_name="BD_PaintGreen", bevel=0.008)

# ---- Moving door leaf (backing slab; slats added in m03) ----
leaf = new_box("BunkerDoor_Leaf", (1.00, 0.14, 1.94), (0.0, 0.0, 1.15),
               mat_name="BD_Recess", bevel=0.010)
# hinge-side reinforcement strip (left edge of leaf)
new_box("BunkerDoor_Leaf_EdgeL", (0.08, 0.16, 1.94), (-0.46, 0.0, 1.15),
        mat_name="BD_SlatMetal", bevel=0.008)
new_box("BunkerDoor_Leaf_EdgeR", (0.08, 0.16, 1.94), (0.46, 0.0, 1.15),
        mat_name="BD_SlatMetal", bevel=0.008)

result = {"frame_leaf_objs": [o.name for o in get_coll().objects]}
print("m02:", len(get_coll().objects), "objects so far")
