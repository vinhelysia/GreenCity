# m01_materials.py  -  Weathered material library for the hermetic bunker door
# Low-poly + procedural rust/moss/peeling-paint. Run first.
import bpy

def _mat(name):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    return m, nt

def _noise(nt, scale, detail=8.0, rough=0.6, loc=(-900, 0)):
    n = nt.nodes.new("ShaderNodeTexNoise")
    n.location = loc
    n.inputs["Scale"].default_value = scale
    n.inputs["Detail"].default_value = detail
    n.inputs["Roughness"].default_value = rough
    return n

def _ramp(nt, p0, p1, loc=(-700, 0)):
    r = nt.nodes.new("ShaderNodeValToRGB")
    r.location = loc
    r.color_ramp.elements[0].position = p0
    r.color_ramp.elements[1].position = p1
    return r

def make_weathered(name, base, rust=(0.20, 0.07, 0.03), moss=(0.06, 0.13, 0.04),
                   metallic=0.0, roughness=0.8, rust_amt=0.45, moss_amt=0.35):
    """Base paint blended with rust patches and mossy overgrowth via 2 noise masks."""
    m, nt = _mat(name)
    out = nt.nodes.new("ShaderNodeOutputMaterial"); out.location = (400, 0)
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled"); bsdf.location = (120, 0)
    coord = nt.nodes.new("ShaderNodeTexCoord"); coord.location = (-1150, 0)

    # rust mask (medium noise) and moss mask (finer, biased low = overgrowth)
    n_rust = _noise(nt, 3.0, loc=(-950, 150))
    r_rust = _ramp(nt, 1.0 - rust_amt, 1.0, loc=(-760, 150))
    n_moss = _noise(nt, 6.0, detail=10, loc=(-950, -200))
    r_moss = _ramp(nt, 1.0 - moss_amt, 1.0, loc=(-760, -200))
    for n in (n_rust, n_moss):
        nt.links.new(coord.outputs["Object"], n.inputs["Vector"])

    mix1 = nt.nodes.new("ShaderNodeMixRGB"); mix1.location = (-500, 60)
    mix1.inputs["Color1"].default_value = (*base, 1)
    mix1.inputs["Color2"].default_value = (*rust, 1)
    mix2 = nt.nodes.new("ShaderNodeMixRGB"); mix2.location = (-260, 0)
    mix2.inputs["Color2"].default_value = (*moss, 1)

    nt.links.new(n_rust.outputs["Fac"], r_rust.inputs["Fac"])
    nt.links.new(n_moss.outputs["Fac"], r_moss.inputs["Fac"])
    nt.links.new(r_rust.outputs["Color"], mix1.inputs["Fac"])
    nt.links.new(mix1.outputs["Color"], mix2.inputs["Color1"])
    nt.links.new(r_moss.outputs["Color"], mix2.inputs["Fac"])
    nt.links.new(mix2.outputs["Color"], bsdf.inputs["Base Color"])

    # rust patches read rougher: drive roughness from rust mask
    rr = nt.nodes.new("ShaderNodeMixRGB"); rr.location = (-260, -300)
    rr.inputs["Color1"].default_value = (roughness, roughness, roughness, 1)
    rr.inputs["Color2"].default_value = (0.95, 0.95, 0.95, 1)
    nt.links.new(r_rust.outputs["Color"], rr.inputs["Fac"])
    nt.links.new(rr.outputs["Color"], bsdf.inputs["Roughness"])
    bsdf.inputs["Metallic"].default_value = metallic
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    return m

def make_flat(name, base, metallic=0.0, roughness=0.7):
    m, nt = _mat(name)
    out = nt.nodes.new("ShaderNodeOutputMaterial"); out.location = (300, 0)
    b = nt.nodes.new("ShaderNodeBsdfPrincipled"); b.location = (0, 0)
    b.inputs["Base Color"].default_value = (*base, 1)
    b.inputs["Metallic"].default_value = metallic
    b.inputs["Roughness"].default_value = roughness
    nt.links.new(b.outputs["BSDF"], out.inputs["Surface"])
    return m

# --- Build the palette (linear-ish values tuned for the reference) ---
make_weathered("BD_PaintGreen", base=(0.055, 0.10, 0.05), metallic=0.15,
               roughness=0.78, rust_amt=0.5, moss_amt=0.45)
make_weathered("BD_SlatMetal", base=(0.045, 0.075, 0.045), metallic=0.25,
               roughness=0.7, rust_amt=0.6, moss_amt=0.3)
make_weathered("BD_WheelRed", base=(0.30, 0.03, 0.02), rust=(0.14, 0.05, 0.02),
               moss=(0.05, 0.08, 0.03), metallic=0.2, roughness=0.65,
               rust_amt=0.4, moss_amt=0.12)
make_weathered("BD_Concrete", base=(0.16, 0.16, 0.145), rust=(0.10, 0.09, 0.06),
               moss=(0.07, 0.12, 0.05), metallic=0.0, roughness=0.92,
               rust_amt=0.25, moss_amt=0.4)
make_flat("BD_Rod", base=(0.09, 0.045, 0.02), metallic=0.5, roughness=0.6)
make_flat("BD_Recess", base=(0.008, 0.010, 0.008), metallic=0.1, roughness=0.85)
make_flat("BD_Bolt", base=(0.05, 0.045, 0.035), metallic=0.6, roughness=0.55)

result = {"materials": [m.name for m in bpy.data.materials if m.name.startswith("BD_")]}
print("m01 materials:", result)
