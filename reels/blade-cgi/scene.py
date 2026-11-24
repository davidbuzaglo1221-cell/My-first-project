"""The Blade — 8 s vertical CGI film. Builds the scene with bpy and saves blade.blend.

Darkness -> one warm overhead beam clicks on -> straight razor on black slate,
steam drifting through the light -> the blade swings open -> a line of light
runs along the edge.  Three cameras, cut at 2.6 s and 5.6 s (24 fps, 192 frames).
"""
import math, sys, bpy, bmesh
from mathutils import Vector

OUT = sys.argv[sys.argv.index("--") + 1] if "--" in sys.argv else "blade.blend"
FPS, END = 24, 192
C1, C2 = 63, 135  # first frame of shot 2 and shot 3

bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
sc.render.fps = FPS
sc.frame_start, sc.frame_end = 1, END


# ---------- helpers ----------
def node_mat(name):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    for n in list(nt.nodes):
        nt.nodes.remove(n)
    out = nt.nodes.new("ShaderNodeOutputMaterial")
    return m, nt, out


def principled(nt, out, **kw):
    b = nt.nodes.new("ShaderNodeBsdfPrincipled")
    for k, v in kw.items():
        b.inputs[k].default_value = v
    nt.links.new(b.outputs[0], out.inputs["Surface"])
    return b


def link_obj(ob):
    sc.collection.objects.link(ob)
    return ob


def box(name, size, loc, mat=None, bevel=0.0, seg=3):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2]))
    bm.to_mesh(me)
    bm.free()
    ob = link_obj(bpy.data.objects.new(name, me))
    ob.location = loc
    if bevel:
        md = ob.modifiers.new("bev", "BEVEL")
        md.width, md.segments = bevel, seg
        md.limit_method = "NONE"
    if mat:
        me.materials.append(mat)
    for p in me.polygons:
        p.use_smooth = True
    return ob


def ease(fc_owner, path, idx, keys, interp="BEZIER"):
    for f, v in keys:
        if idx is None:
            setattr(fc_owner, path, v)
            fc_owner.keyframe_insert(path, frame=f)
        else:
            getattr(fc_owner, path)[idx] = v
            fc_owner.keyframe_insert(path, index=idx, frame=f)


# ---------- materials ----------
steel, nt, out = node_mat("steel")
b = principled(nt, out, **{"Base Color": (0.78, 0.78, 0.8, 1), "Metallic": 1.0,
                           "Roughness": 0.09, "Anisotropic": 0.5})
tc = nt.nodes.new("ShaderNodeTexCoord")
nz = nt.nodes.new("ShaderNodeTexNoise")
nz.inputs["Scale"].default_value = 900.0
mp = nt.nodes.new("ShaderNodeMapping")
mp.inputs["Scale"].default_value = (1.0, 60.0, 1.0)  # brushed streaks along the blade
bp = nt.nodes.new("ShaderNodeBump")
bp.inputs["Strength"].default_value = 0.05
nt.links.new(tc.outputs["Object"], mp.inputs[0])
nt.links.new(mp.outputs[0], nz.inputs["Vector"])
nt.links.new(nz.outputs["Fac"], bp.inputs["Height"])
nt.links.new(bp.outputs[0], b.inputs["Normal"])

walnut, nt, out = node_mat("walnut")
b = principled(nt, out, **{"Roughness": 0.35, "Coat Weight": 1.0, "Coat Roughness": 0.05})
tc = nt.nodes.new("ShaderNodeTexCoord")
wv = nt.nodes.new("ShaderNodeTexWave")
wv.inputs["Scale"].default_value = 6.0
wv.inputs["Distortion"].default_value = 9.0
wv.inputs["Detail"].default_value = 6.0
ramp = nt.nodes.new("ShaderNodeValToRGB")
ramp.color_ramp.elements[0].color = (0.012, 0.007, 0.005, 1)
ramp.color_ramp.elements[1].color = (0.04, 0.022, 0.014, 1)
nt.links.new(tc.outputs["Object"], wv.inputs["Vector"])
nt.links.new(wv.outputs["Fac"], ramp.inputs["Fac"])
nt.links.new(ramp.outputs["Color"], b.inputs["Base Color"])

brass, nt, out = node_mat("brass")
principled(nt, out, **{"Base Color": (0.8, 0.55, 0.25, 1), "Metallic": 1.0, "Roughness": 0.25})

slate, nt, out = node_mat("slate")
b = principled(nt, out, **{"Base Color": (0.022, 0.021, 0.023, 1)})
tc = nt.nodes.new("ShaderNodeTexCoord")
n1 = nt.nodes.new("ShaderNodeTexNoise")
n1.inputs["Scale"].default_value = 14.0
n1.inputs["Detail"].default_value = 12.0
n1.inputs["Roughness"].default_value = 0.65
r1 = nt.nodes.new("ShaderNodeMapRange")
r1.inputs["To Min"].default_value = 0.38
r1.inputs["To Max"].default_value = 0.8
n2 = nt.nodes.new("ShaderNodeTexNoise")
n2.inputs["Scale"].default_value = 45.0
n2.inputs["Detail"].default_value = 8.0
bp = nt.nodes.new("ShaderNodeBump")
bp.inputs["Strength"].default_value = 0.22
bp.inputs["Distance"].default_value = 0.002
mp2 = nt.nodes.new("ShaderNodeMapping")
mp2.inputs["Scale"].default_value = (1.0, 7.0, 1.0)
nt.links.new(tc.outputs["Object"], n1.inputs["Vector"])
nt.links.new(n1.outputs["Fac"], r1.inputs["Value"])
nt.links.new(r1.outputs["Result"], b.inputs["Roughness"])
nt.links.new(tc.outputs["Object"], mp2.inputs[0])
nt.links.new(mp2.outputs[0], n2.inputs["Vector"])
nt.links.new(n2.outputs["Fac"], bp.inputs["Height"])
nt.links.new(bp.outputs[0], b.inputs["Normal"])

towel, nt, out = node_mat("towel")
b = principled(nt, out, **{"Base Color": (0.3, 0.28, 0.25, 1), "Roughness": 0.95,
                           "Sheen Weight": 0.6})
tc = nt.nodes.new("ShaderNodeTexCoord")
n3 = nt.nodes.new("ShaderNodeTexNoise")
n3.inputs["Scale"].default_value = 600.0
bp = nt.nodes.new("ShaderNodeBump")
bp.inputs["Strength"].default_value = 0.5
nt.links.new(tc.outputs["Object"], n3.inputs["Vector"])
nt.links.new(n3.outputs["Fac"], bp.inputs["Height"])
nt.links.new(bp.outputs[0], b.inputs["Normal"])

wall, nt, out = node_mat("wall")
principled(nt, out, **{"Base Color": (0.03, 0.025, 0.02, 1), "Roughness": 0.9})

# ---------- set ----------
box("slate", (1.2, 0.9, 0.04), (0, 0.15, -0.02), slate, bevel=0.004)
box("wall", (2.0, 0.05, 1.2), (0, 0.9, 0.4), wall)
tw = box("towel", (0.13, 0.075, 0.032), (-0.21, 0.21, 0.016), towel, bevel=0.012, seg=5)
tw.rotation_euler.z = math.radians(-12)
# strop hanging at the right edge of the beam, far behind
box("strop", (0.05, 0.006, 0.5), (0.26, 0.42, 0.2), walnut, bevel=0.003)

# far warm points for bokeh depth (brass fittings / bulbs in the dark shop)
emis, nt, out = node_mat("bulb")
em = nt.nodes.new("ShaderNodeEmission")
em.inputs["Color"].default_value = (1.0, 0.62, 0.3, 1)
em.inputs["Strength"].default_value = 6.0
nt.links.new(em.outputs[0], out.inputs["Surface"])
for i, (x, z) in enumerate([(-0.55, 0.45), (0.5, 0.62), (-0.2, 0.75), (0.75, 0.3)]):
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.012, location=(x, 0.86, z))
    o = bpy.context.active_object
    o.data.materials.append(emis)

# ---------- razor ----------
root = link_obj(bpy.data.objects.new("razor", None))
root.location = (0.01, -0.01, 0.0046)
root.rotation_euler.z = math.radians(28)

# blade: rows along x, spine thick at +y, edge sharp at -y, hollow-ground facet
me = bpy.data.meshes.new("blade")
bm = bmesh.new()
T = 0.0034
rows = []
N = 40
for i in range(N + 1):
    x = -0.004 + 0.112 * i / N
    if x < 0.02:            # tang
        yt, yb = 0.0055, -0.0055
    else:                   # blade with rounded tip in the last 9 mm
        yt, yb = 0.0065, -0.0165
        u = (x - 0.099) / 0.009
        if u > 0:
            yb = yb + (yt - yb) * (1 - math.sqrt(max(0.0, 1 - u * u))) * 0.92
    t = T if x < 0.02 else T * (1.0 - 0.15 * max(0, x - 0.02) / 0.09)
    ym = yb + (yt - yb) * 0.42
    ring = [bm.verts.new((x, yt, t / 2)), bm.verts.new((x, ym, t * 0.18)),
            bm.verts.new((x, yb, 0.0)), bm.verts.new((x, ym, -t * 0.18)),
            bm.verts.new((x, yt, -t / 2))]
    rows.append(ring)
for a, c in zip(rows, rows[1:]):
    for j in range(5):
        k = (j + 1) % 5
        bm.faces.new((a[j], c[j], c[k], a[k]))
bm.faces.new(rows[0][::-1])
bm.faces.new(rows[-1])
bm.normal_update()
bm.to_mesh(me)
bm.free()
blade = link_obj(bpy.data.objects.new("blade", me))
me.materials.append(steel)
blade.parent = root
md = blade.modifiers.new("bev", "BEVEL")
md.width, md.segments, md.limit_method = 0.0004, 2, "ANGLE"

for s in (1, -1):
    sc_ = box("scale", (0.158, 0.023, 0.0026), (-0.077, -0.003, s * 0.003), walnut,
              bevel=0.0095, seg=6)
    sc_.parent = root
for x in (0.0, -0.15):
    bpy.ops.mesh.primitive_cylinder_add(radius=0.0024, depth=0.0095, location=(x, 0, 0))
    p = bpy.context.active_object
    p.data.materials.append(brass)
    bpy.ops.object.shade_smooth()
    p.parent = root

# blade swings open during shot 2: closed (180 deg, inside the scales) -> open, tiny settle
blade.rotation_mode = "XYZ"
ease(blade, "rotation_euler", 2, [(1, math.radians(180)), (C1 + 10, math.radians(180)),
                                    (C1 + 46, math.radians(-4)), (C1 + 54, math.radians(1.2)),
                                    (C1 + 60, 0.0), (END, 0.0)])

# ---------- light ----------
bpy.ops.object.light_add(type="SPOT", location=(0.03, -0.02, 0.95))
key = bpy.context.active_object
key.data.color = (1.0, 0.71, 0.42)
key.data.spot_size = math.radians(19)
key.data.spot_blend = 0.75
key.data.shadow_soft_size = 0.06
E = 140.0
# old tungsten switching on: dark, catch, flicker, settle
prefs = bpy.context.preferences.edit
prefs.keyframe_new_interpolation_type = "LINEAR"
ease(key.data, "energy", None, [(1, 0.0), (7, 0.0), (8, E * 0.55), (9, E * 0.25),
                                (11, E * 0.85), (13, E * 0.7), (17, E), (END, E)])
prefs.keyframe_new_interpolation_type = "BEZIER"

# glint strip: thin area light invisible to camera, slides over the blade in shot 3
bpy.ops.object.light_add(type="AREA", location=(0.0, 0.0, 0.3))
gl = bpy.context.active_object
gl.data.shape = "RECTANGLE"
gl.data.size, gl.data.size_y = 0.4, 0.012
gl.data.color = (1.0, 0.85, 0.65)
gl.visible_camera = False
gl.visible_volume_scatter = False
gl.visible_diffuse = False
glc = bpy.data.collections.new("glint_receivers")
glc.objects.link(blade)
gl.light_linking.receiver_collection = glc
ease(gl.data, "energy", None, [(1, 0.0), (C2 + 4, 0.0), (C2 + 10, 30.0), (C2 + 44, 30.0), (END, 8.0)])
ease(gl, "location", 1, [(C2, 0.12), (C2 + 44, 0.78)])
ease(gl, "rotation_euler", 2, [(1, math.radians(28))])

# strip softbox seen only in reflections: gives the steel something to mirror
card, nt, out = node_mat("card")
em = nt.nodes.new("ShaderNodeEmission")
em.inputs["Color"].default_value = (1.0, 0.78, 0.55, 1)
em.inputs["Strength"].default_value = 0.0
em.inputs["Strength"].keyframe_insert("default_value", frame=7)
em.inputs["Strength"].default_value = 1.6
em.inputs["Strength"].keyframe_insert("default_value", frame=12)
nt.links.new(em.outputs[0], out.inputs["Surface"])
for loc, sca, rot in (((0.03, 0.45, 0.58), (0.9, 0.25, 1), (math.radians(-35), 0, 0)),
                      ((-0.32, 0.34, 0.12), (0.12, 0.5, 1), (math.radians(90), 0, math.radians(-45)))):
    bpy.ops.mesh.primitive_plane_add(size=1, location=loc)
    cd_ = bpy.context.active_object
    cd_.scale, cd_.rotation_euler = sca, rot
    cd_.data.materials.append(card)
    cd_.visible_camera = False
    cd_.visible_diffuse = False
    cd_.visible_shadow = False

# ---------- atmosphere ----------
# fake light shaft (cheap): additive cone, bright in the core, fading at its edges
beam, nt, out = node_mat("beam")
lw = nt.nodes.new("ShaderNodeLayerWeight")
lw.inputs["Blend"].default_value = 0.5
inv = nt.nodes.new("ShaderNodeMath"); inv.operation = "POWER"; inv.inputs[1].default_value = 3.0
one = nt.nodes.new("ShaderNodeMath"); one.operation = "SUBTRACT"; one.inputs[0].default_value = 1.0
em = nt.nodes.new("ShaderNodeEmission"); em.inputs["Color"].default_value = (1.0, 0.7, 0.42, 1)
mul = nt.nodes.new("ShaderNodeMath"); mul.operation = "MULTIPLY"
tr = nt.nodes.new("ShaderNodeBsdfTransparent")
add = nt.nodes.new("ShaderNodeAddShader")
nt.links.new(lw.outputs["Facing"], one.inputs[1])
nt.links.new(one.outputs[0], inv.inputs[0])
nt.links.new(inv.outputs[0], mul.inputs[0])
nt.links.new(mul.outputs[0], em.inputs["Strength"])
nt.links.new(em.outputs[0], add.inputs[0]); nt.links.new(tr.outputs[0], add.inputs[1])
nt.links.new(add.outputs[0], out.inputs["Surface"])
B = 0.025
prefs.keyframe_new_interpolation_type = "LINEAR"
for f, k in [(1, 0), (7, 0), (8, .55), (9, .25), (11, .85), (13, .7), (17, 1), (END, 1)]:
    mul.inputs[1].default_value = B * k
    mul.inputs[1].keyframe_insert("default_value", frame=f)
prefs.keyframe_new_interpolation_type = "BEZIER"
bpy.ops.mesh.primitive_cone_add(vertices=64, radius1=0.17, radius2=0.012, depth=0.93,
                                location=(0.03, -0.02, 0.48))
h = bpy.context.active_object
h.data.materials.append(beam)
bpy.ops.object.shade_smooth()
h.visible_shadow = False
h.visible_glossy = False
h.visible_diffuse = False

steam, nt, out = node_mat("steam")
v = nt.nodes.new("ShaderNodeVolumePrincipled")
v.inputs["Anisotropy"].default_value = 0.4
v.inputs["Color"].default_value = (0.9, 0.9, 0.9, 1)
tc = nt.nodes.new("ShaderNodeTexCoord")
mp = nt.nodes.new("ShaderNodeMapping")
nz = nt.nodes.new("ShaderNodeTexNoise")
nz.noise_dimensions = "4D"
nz.inputs["Scale"].default_value = 5.0
nz.inputs["Detail"].default_value = 6.0
nz.inputs["Distortion"].default_value = 1.2
sep = nt.nodes.new("ShaderNodeSeparateXYZ")
grad = nt.nodes.new("ShaderNodeMapRange")       # fades out with height
grad.inputs["From Min"].default_value = -0.5
grad.inputs["From Max"].default_value = 0.5
grad.inputs["To Min"].default_value = 1.0
grad.inputs["To Max"].default_value = 0.0
ramp = nt.nodes.new("ShaderNodeMapRange")
ramp.inputs["From Min"].default_value = 0.52
ramp.inputs["From Max"].default_value = 0.78
mul = nt.nodes.new("ShaderNodeMath")
mul.operation = "MULTIPLY"
mul2 = nt.nodes.new("ShaderNodeMath")
mul2.operation = "MULTIPLY"
mul2.inputs[1].default_value = 40.0
nt.links.new(tc.outputs["Object"], mp.inputs[0])
nt.links.new(mp.outputs[0], nz.inputs["Vector"])
nt.links.new(tc.outputs["Object"], sep.inputs[0])
nt.links.new(sep.outputs["Z"], grad.inputs["Value"])
nt.links.new(nz.outputs["Fac"], ramp.inputs["Value"])
nt.links.new(ramp.outputs["Result"], mul.inputs[0])
nt.links.new(grad.outputs["Result"], mul.inputs[1])
nt.links.new(mul.outputs[0], mul2.inputs[0])
nt.links.new(mul2.outputs[0], v.inputs["Density"])
nt.links.new(v.outputs[0], out.inputs["Volume"])
# steam rises: drift the noise downward in object space and evolve W
mp.inputs["Location"].default_value = (0, 0, 0)
mp.inputs["Location"].keyframe_insert("default_value", frame=1)
mp.inputs["Location"].default_value = (0.05, 0.0, -0.55)
mp.inputs["Location"].keyframe_insert("default_value", frame=END)
nz.inputs["W"].default_value = 0.0
nz.inputs["W"].keyframe_insert("default_value", frame=1)
nz.inputs["W"].default_value = 1.6
nz.inputs["W"].keyframe_insert("default_value", frame=END)
st = box("steam", (0.24, 0.12, 0.42), (-0.04, 0.13, 0.25), steam)
st.rotation_euler.z = math.radians(-10)
for o in (h, st):
    o.visible_shadow = False

# ---------- cameras (9:16) ----------
target = link_obj(bpy.data.objects.new("focus", None))
target.location = (0.0, -0.02, 0.005)


def cam(name, lens, fstop, keys, focus):
    cd = bpy.data.cameras.new(name)
    cd.lens, cd.sensor_fit, cd.sensor_width = lens, "VERTICAL", 24
    cd.dof.use_dof, cd.dof.aperture_fstop = True, fstop
    cd.dof.focus_object = focus
    o = link_obj(bpy.data.objects.new(name, cd))
    tr = o.constraints.new("TRACK_TO")
    tr.target, tr.track_axis, tr.up_axis = focus, "TRACK_NEGATIVE_Z", "UP_Y"
    for f, loc in keys:
        o.location = loc
        o.keyframe_insert("location", frame=f)
    return o


f1 = link_obj(bpy.data.objects.new("f1", None)); f1.location = (-0.048, -0.042, 0.004)
f2 = link_obj(bpy.data.objects.new("f2", None)); f2.location = (0.02, -0.005, 0.006)
f3 = link_obj(bpy.data.objects.new("f3", None))
f3.parent = root
f3.location = (0.05, -0.004, 0.0)
ca = cam("cam1", 40, 2.4, [(1, (-0.03, -0.37, 0.46)), (C1, (-0.035, -0.31, 0.39))], f1)
cb = cam("cam2", 60, 2.4, [(C1, (0.3, -0.32, 0.12)), (C2, (0.29, -0.31, 0.115))], f2)
cc = cam("cam3", 85, 5.6, [(C2, (0.1, -0.3, 0.24)), (END, (0.09, -0.255, 0.205))], f3)
for fr, c in ((1, ca), (C1, cb), (C2, cc)):
    m = sc.timeline_markers.new(c.name, frame=fr)
    m.camera = c
sc.camera = ca

# ---------- render ----------
sc.render.engine = "CYCLES"
cy = sc.cycles
cy.device = "CPU"
cy.samples = 64
cy.use_adaptive_sampling = True
cy.adaptive_threshold = 0.03
cy.use_denoising = True
cy.max_bounces, cy.diffuse_bounces, cy.glossy_bounces = 4, 2, 3
cy.transmission_bounces, cy.volume_bounces, cy.transparent_max_bounces = 0, 0, 8
cy.caustics_reflective = cy.caustics_refractive = False
cy.volume_step_rate = 4.0
cy.volume_max_steps = 256
sc.render.resolution_x, sc.render.resolution_y = 1080, 1920
sc.render.use_motion_blur = True
sc.render.motion_blur_shutter = 0.5
sc.world = bpy.data.worlds.new("w")
sc.world.use_nodes = True
sc.world.node_tree.nodes["Background"].inputs["Color"].default_value = (0, 0, 0, 1)
try:
    sc.view_settings.view_transform = "AgX"
    sc.view_settings.look = "AgX - Medium High Contrast"
    sc.view_settings.exposure = -0.8
except Exception as e:
    print("color mgmt:", e)
sc.render.image_settings.file_format = "PNG"
bpy.ops.wm.save_as_mainfile(filepath=OUT)
print("saved", OUT)
