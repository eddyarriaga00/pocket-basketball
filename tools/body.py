"""The pocket body: one smooth, simple figure built round the game's own skeleton, skinned to it, and saved as
models/body.glb. No muscles: soft chunky limbs, a tapered torso, mitten hands with a thumb, round sneakers. The head is
not here: the game draws its own.

  /Applications/Blender.app/Contents/MacOS/Blender --background --python tools/body.py -- models/player.glb models/body.glb [preview.png]

The figure is a stick drawing of the skeleton (a vertex at each joint) given thickness by Blender's Skin modifier and
smoothed, so its joints sit exactly on the bones; the shoes are rounded blocks. Weights come from Blender's automatic
(bone heat) skinning, fingers and toes folded into the hand and foot."""
import bpy, bmesh, sys, math
from mathutils import Vector

args = sys.argv[sys.argv.index('--') + 1:]
SRC, OUT = args[0], args[1]
PREVIEW = args[2] if len(args) > 2 else None

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
arm = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
for o in list(bpy.data.objects):
    if o.type == 'MESH':
        bpy.data.objects.remove(o, do_unlink=True)
# ---- taller: a ballplayer's legs. The skeleton's rest pose is stretched below the hips (and everything above rides up
# with it); the game applies the same stretch to its skeleton (LEGK is printed, and kept in the file's extras)
LEGK = 1.16
M = arm.matrix_world
hipz0 = (M @ arm.data.bones['DEF-thigh.L'].head_local).z
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode='EDIT')
Mi = M.inverted()
def tall(co):
    w = M @ co; w.z = w.z * LEGK if w.z <= hipz0 else w.z + hipz0 * (LEGK - 1); return Mi @ w
for eb in arm.data.edit_bones:
    eb.head = tall(eb.head.copy()); eb.tail = tall(eb.tail.copy())
bpy.ops.object.mode_set(mode='OBJECT')
arm['legk'] = LEGK
print('LEGK', LEGK, 'hip height', round(hipz0, 3), '->', round(hipz0 * LEGK, 3))
J = {b.name: (M @ b.head_local, M @ b.tail_local) for b in arm.data.bones}
head = lambda n: J[n][0].copy()
tail = lambda n: J[n][1].copy()

# ---- the figure, part by part: every part is a run of cross-sections (centre, half-width, half-depth) lofted into a
# closed skin; the parts overlap where they join, and are then fused into one surface and smoothed, like a blocked-out sculpt
def loft(name, rings, u, w, seg=20, power=2.0, k=1.0):
    """rings: [(centre, ru, rw)] along the part; u, w: the two directions across it. power > 2 squares the section off"""
    bm = bmesh.new(); loops = []
    def ring(c, ru, rw):
        vs = []
        for k in range(seg):
            a = 2 * math.pi * k / seg; ca, sa = math.cos(a), math.sin(a)
            x = math.copysign(abs(ca) ** (2 / power), ca); y = math.copysign(abs(sa) ** (2 / power), sa)
            vs.append(bm.verts.new(c + u * (x * ru) + w * (y * rw)))
        return vs
    for c, ru, rw in rings: loops.append(ring(Vector(c), ru * k, rw * k))
    for a, b in zip(loops, loops[1:]):
        for k in range(seg): bm.faces.new((a[k], a[(k + 1) % seg], b[(k + 1) % seg], b[k]))
    bm.faces.new(loops[0][::-1]); bm.faces.new(loops[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces[:])
    m2 = bpy.data.meshes.new(name); bm.to_mesh(m2); bm.free()
    o = bpy.data.objects.new(name, m2); bpy.context.scene.collection.objects.link(o); return o
def ball(name, c, r, seg=16):
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=seg // 2, radius=1.0)
    for q in bm.verts: q.co = Vector(c) + Vector((q.co.x * r[0], q.co.y * r[1], q.co.z * r[2]))
    m2 = bpy.data.meshes.new(name); bm.to_mesh(m2); bm.free()
    o = bpy.data.objects.new(name, m2); bpy.context.scene.collection.objects.link(o); return o
def capped(pts):
    """round both ends of a run of sections off, so a part ends in a dome and not a flat disc"""
    (c0, a0, b0), (c1, a1, b1) = pts[0], pts[-1]
    d0 = (Vector(pts[0][0]) - Vector(pts[1][0])).normalized(); d1 = (Vector(pts[-1][0]) - Vector(pts[-2][0])).normalized()
    out = [(Vector(c0) + d0 * (min(a0, b0) * f), a0 * g, b0 * g) for f, g in ((0.92, 0.30), (0.62, 0.74), (0.28, 0.94))]
    out += pts
    out += [(Vector(c1) + d1 * (min(a1, b1) * f), a1 * g, b1 * g) for f, g in ((0.28, 0.94), (0.62, 0.74), (0.92, 0.30))]
    return out
LIMB = 1.12   # how chunky the arms and legs are: the pocket look, but an athlete's
X, Y, Z = Vector((1, 0, 0)), Vector((0, 1, 0)), Vector((0, 0, 1))
parts = []
hz, s1, s2, s3, nk = head('DEF-hips').z, head('DEF-spine.001').z, head('DEF-spine.002').z, head('DEF-spine.003').z, head('DEF-neck').z
shz = head('DEF-upper_arm.L').z
# the trunk: hips, a waist, a chest that is wide but not deep, sloping shoulders, the base of the neck
parts.append(loft('trunk', capped([
    ((0, 0.016, hz - 0.105), 0.168, 0.104), ((0, 0.014, hz - 0.03), 0.190, 0.116), ((0, 0.010, hz + 0.07), 0.172, 0.110),
    ((0, 0.006, s1 + 0.05), 0.150, 0.098), ((0, 0.002, s2 + 0.02), 0.158, 0.100), ((0, 0.000, s2 + 0.11), 0.176, 0.106),
    ((0, 0.004, s3 + 0.04), 0.196, 0.116), ((0, 0.010, shz - 0.035), 0.198, 0.112), ((0, 0.014, shz + 0.022), 0.150, 0.094),
    ((0, 0.012, nk + 0.012), 0.062, 0.060)]), X, Y, seg=28, power=2.5, k=0.95))   # slimmer than the jersey over it, so it never shows through
parts.append(loft('neck', [((0, 0.010, nk - 0.03), 0.070, 0.068), ((0, 0.004, nk + 0.04), 0.062, 0.062), ((0, -0.004, head('DEF-head').z + 0.045), 0.060, 0.060)], X, Y, seg=16))
for S, sg in (('L', 1), ('R', -1)):
    sh, el, wr = head(f'DEF-upper_arm.{S}'), head(f'DEF-forearm.{S}'), head(f'DEF-hand.{S}')
    ax = lambda t, a, b: Vector((a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t, a.z + (b.z - a.z) * t))
    # the shoulder is a ball the arm hangs from; the arm: a soft upper arm, a clear elbow, a forearm that swells then narrows to the wrist
    parts.append(ball('delt' + S, (sh.x - sg * 0.004, sh.y - 0.004, sh.z - 0.002), (0.090, 0.084, 0.086)))
    parts.append(loft('arm' + S, capped([
        (ax(-0.04, sh, el), 0.068, 0.070), (ax(0.22, sh, el), 0.068, 0.070), (ax(0.55, sh, el), 0.062, 0.064), (ax(0.86, sh, el), 0.053, 0.055),
        (ax(0.0, el, wr), 0.050, 0.052), (ax(0.14, el, wr), 0.054, 0.056), (ax(0.36, el, wr), 0.055, 0.057), (ax(0.66, el, wr), 0.049, 0.050),
        (ax(0.92, el, wr), 0.038, 0.036), (ax(1.02, el, wr), 0.036, 0.033)]), Y, Z, seg=18, k=LIMB))
    # the hand: a palm, the fingers together as one pad curling a little, a thumb
    h0 = Vector((wr.x + sg * 0.015, wr.y, wr.z))
    parts.append(loft('hand' + S, capped([
        (h0, 0.034, 0.022), (h0 + X * sg * 0.035, 0.046, 0.024), (h0 + X * sg * 0.075, 0.050, 0.024), (h0 + X * sg * 0.115 - Z * 0.003, 0.047, 0.021),
        (h0 + X * sg * 0.155 - Z * 0.008, 0.041, 0.018), (h0 + X * sg * 0.185 - Z * 0.015, 0.032, 0.015)]), Y, Z, seg=16, power=2.6, k=1.42))
    parts.append(loft('thumb' + S, capped([(h0 + X * sg * 0.045 - Y * 0.030, 0.019, 0.017), (h0 + X * sg * 0.070 - Y * 0.062 - Z * 0.006, 0.018, 0.016), (h0 + X * sg * 0.092 - Y * 0.082 - Z * 0.012, 0.015, 0.014)]), Vector((sg * 0.7, 0.7, 0)).normalized(), Z, seg=12, k=1.5))
    hp, kn, an = head(f'DEF-thigh.{S}'), head(f'DEF-shin.{S}'), head(f'DEF-foot.{S}')
    lg = lambda t, a, b, dy=0.0, dx=0.0: Vector((a.x + (b.x - a.x) * t + sg * dx, a.y + (b.y - a.y) * t + dy, a.z + (b.z - a.z) * t))
    # the leg: a full thigh that narrows to the knee, a calf that sits behind the shin, a slim ankle
    parts.append(loft('leg' + S, capped([
        (lg(-0.06, hp, kn, 0.010, 0.0), 0.078, 0.090), (lg(0.12, hp, kn, 0.010, 0.0), 0.084, 0.094), (lg(0.38, hp, kn, 0.008), 0.080, 0.088),
        (lg(0.70, hp, kn, 0.004), 0.070, 0.074), (lg(0.93, hp, kn), 0.060, 0.063), (lg(0.03, kn, an), 0.058, 0.061),
        (lg(0.18, kn, an, 0.010), 0.060, 0.066), (lg(0.36, kn, an, 0.014), 0.058, 0.066), (lg(0.62, kn, an, 0.010), 0.047, 0.052),
        (lg(0.86, kn, an, 0.004), 0.038, 0.041), (lg(1.06, kn, an), 0.037, 0.040)]), X, Y, seg=20, k=LIMB))

# ---- the kit, as layers of its own over the body (what the reference games do: clothes are shapes, not paint):
# a loose jersey with a hem, baggy shorts to the knee, crew socks, sneakers with a sole, a toe cap and a tongue
G = {'skin': parts, 'jersey': [], 'shorts': [], 'sock': [], 'shoe': []}
jersey = loft('jersey', capped([
    ((0, 0.014, hz - 0.048), 0.201, 0.129), ((0, 0.012, hz + 0.02), 0.200, 0.129), ((0, 0.008, s1 + 0.05), 0.198, 0.128),
    ((0, 0.004, s2 + 0.03), 0.208, 0.132), ((0, 0.002, s2 + 0.12), 0.216, 0.134), ((0, 0.006, s3 + 0.045), 0.220, 0.134),
    ((0, 0.012, shz - 0.045), 0.216, 0.128), ((0, 0.014, shz + 0.008), 0.190, 0.114), ((0, 0.012, shz + 0.046), 0.130, 0.094)]), X, Y, seg=36, power=2.7)
def cut(o, cutter):
    bpy.context.view_layer.objects.active = o
    m = o.modifiers.new('Cut', 'BOOLEAN'); m.operation = 'DIFFERENCE'; m.object = cutter; m.solver = 'EXACT'
    bpy.ops.object.modifier_apply(modifier='Cut'); bpy.data.objects.remove(cutter, do_unlink=True)
cut(jersey, ball('neckcut', (0, -0.045, shz + 0.062), (0.092, 0.150, 0.098), seg=24))                 # the scoop of the neck
for sg in (1, -1): cut(jersey, ball('armcut', (sg * 0.232, 0.030, shz - 0.030), (0.086, 0.170, 0.118), seg=24))   # the armholes
G['jersey'].append(jersey)
G['shorts'].append(loft('shortsTop', capped([
    ((0, 0.016, hz - 0.150), 0.190, 0.120), ((0, 0.014, hz - 0.070), 0.214, 0.134), ((0, 0.012, hz + 0.010), 0.208, 0.134),
    ((0, 0.010, hz + 0.060), 0.196, 0.128)]), X, Y, seg=32, power=2.6))
for S, sg in (('L', 1), ('R', -1)):
    hp, kn, an = head(f'DEF-thigh.{S}'), head(f'DEF-shin.{S}'), head(f'DEF-foot.{S}')
    lg = lambda t, a, b, dy=0.0, dx=0.0: Vector((a.x + (b.x - a.x) * t + sg * dx, a.y + (b.y - a.y) * t + dy, a.z + (b.z - a.z) * t))
    # a leg of the shorts: wide, a little wider still at the hem, ending just above the knee
    G['shorts'].append(loft('shortsLeg' + S, [
        (lg(-0.04, hp, kn, 0.010, 0.012), 0.108, 0.122), (lg(0.20, hp, kn, 0.010, 0.014), 0.114, 0.126), (lg(0.50, hp, kn, 0.008, 0.016), 0.118, 0.128),
        (lg(0.80, hp, kn, 0.006, 0.018), 0.124, 0.132), (lg(0.84, hp, kn, 0.006, 0.018), 0.110, 0.118)], X, Y, seg=24, power=2.3))
    G['sock'].append(loft('sock' + S, [(lg(0.60, kn, an, 0.010), 0.060, 0.066), (lg(0.63, kn, an, 0.010), 0.064, 0.070), (lg(0.80, kn, an, 0.006), 0.056, 0.060), (lg(1.02, kn, an), 0.052, 0.056)], X, Y, seg=18))
    # the sneaker: a sole that shows all the way round, the upper, a toe cap, a padded collar and a tongue
    tip, heel = tail(f'DEF-toe.{S}').y + 0.030, an.y + 0.092
    sy = lambda t: heel + (tip - heel) * t
    G['shoe'].append(loft('sole' + S, [((an.x, sy(-0.01), 0.004), 0.058, 0.004), ((an.x, sy(0.0), 0.016), 0.066, 0.016), ((an.x, sy(0.30), 0.018), 0.078, 0.018), ((an.x, sy(0.62), 0.016), 0.086, 0.016), ((an.x, sy(0.90), 0.015), 0.078, 0.015), ((an.x, sy(1.01), 0.014), 0.058, 0.012)], X, Z, seg=18, power=3.0))
    G['shoe'].append(loft('upper' + S, capped([
        ((an.x, sy(0.02), 0.078), 0.052, 0.058), ((an.x, sy(0.12), 0.090), 0.064, 0.074), ((an.x, sy(0.28), 0.092), 0.068, 0.078),
        ((an.x, sy(0.44), 0.076), 0.070, 0.062), ((an.x, sy(0.62), 0.066), 0.076, 0.054), ((an.x, sy(0.82), 0.060), 0.074, 0.050),
        ((an.x, sy(0.95), 0.052), 0.060, 0.042)]), X, Z, seg=20, power=2.8))
    G['shoe'].append(ball('toecap' + S, (an.x, sy(0.90), 0.050), (0.070, 0.050, 0.040)))
    G['shoe'].append(loft('ankle' + S, [((an.x, an.y + 0.016, 0.100), 0.066, 0.078), ((an.x, an.y + 0.014, 0.170), 0.066, 0.074), ((an.x, an.y + 0.012, 0.196), 0.060, 0.066)], X, Y, seg=18))
    G['shoe'].append(ball('tongue' + S, (an.x, an.y - 0.060, 0.150), (0.040, 0.026, 0.058)))
    # four fingers on the pad of the hand, a little apart at the tips and curling down
    wr = head(f'DEF-hand.{S}'); h0 = Vector((wr.x + sg * 0.015, wr.y, wr.z))
    for q, dy in enumerate((-0.050, -0.017, 0.017, 0.050)):
        ln = 0.115 - 0.012 * abs(q - 1.4)
        G['skin'].append(loft(f'finger{S}{q}', capped([(h0 + X * sg * 0.125 + Y * dy * 0.92 - Z * 0.004, 0.0150, 0.0150), (h0 + X * sg * (0.125 + ln * 0.55) + Y * dy - Z * 0.012, 0.0145, 0.0140), (h0 + X * sg * (0.125 + ln) + Y * dy * 1.04 - Z * 0.028, 0.0125, 0.0120)]), Y, Z, seg=10, k=1.55))

# ---- the head, after the references (Switch Sports' Sportsmates, pocket and chibi sports games): BIG for the body, one
# smooth shape with no bumps on it, simple dark eyes that sit flat on the face, a small mouth, hair as one chunky volume
HS = 1.22
hc = Vector((0, -0.006, head('DEF-head').z + 0.035 + 0.150 * HS))
hv = lambda dx, dy, dz: hc + Vector((dx, dy, dz)) * HS
hb = lambda dx, dy, dz, rx, ry, rz, n: ball(n, tuple(hv(dx, dy, dz)), (rx * HS, ry * HS, rz * HS), seg=28)
PROFILE = [(-0.150, 0.046, 0.050), (-0.132, 0.086, 0.092), (-0.096, 0.114, 0.120), (-0.046, 0.130, 0.134), (0.006, 0.136, 0.140),
           (0.058, 0.134, 0.138), (0.104, 0.118, 0.124), (0.134, 0.086, 0.092), (0.150, 0.042, 0.046)]
G['head'] = [loft('skull', [(hv(0, 0, z), rx * HS, ry * HS) for z, rx, ry in PROFILE], X, Y, seg=40, power=2.35)]
G['head'] += [hb(sg * 0.134, 0.012, -0.024, 0.014, 0.024, 0.032, 'ear' + str(sg)) for sg in (1, -1)]
G['head'].append(hb(0, -0.137, -0.040, 0.011, 0.009, 0.009, 'nose'))
# hair: a cap a touch bigger than the skull, sitting high and back, so its edge makes a clean hairline across the forehead
G['hair'] = [loft('cap', [(hv(0, 0.022, z + 0.044), rx * HS * 1.09, ry * HS * 1.075) for z, rx, ry in PROFILE[3:]], X, Y, seg=40, power=2.35),
             hb(0, 0.080, -0.010, 0.128, 0.078, 0.110, 'back')]
G['dark'] = [hb(sg * 0.052, -0.129, -0.006, 0.021, 0.010, 0.033, 'eye' + str(sg)) for sg in (1, -1)]
G['eye'] = [hb(sg * 0.052 + 0.008, -0.138, 0.008, 0.0065, 0.004, 0.009, 'glint' + str(sg)) for sg in (1, -1)]
for sg in (1, -1):
    G['dark'].append(loft('brow' + str(sg), capped([(hv(sg * 0.026, -0.134, 0.046), 0.007 * HS, 0.005 * HS), (hv(sg * 0.054, -0.132, 0.053), 0.007 * HS, 0.005 * HS), (hv(sg * 0.080, -0.120, 0.047), 0.006 * HS, 0.004 * HS)]), Y, Z, seg=8))
G['dark'].append(loft('mouth', capped([(hv(-0.030, -0.124, -0.078), 0.006 * HS, 0.004 * HS), (hv(-0.014, -0.130, -0.086), 0.006 * HS, 0.004 * HS), (hv(0.014, -0.130, -0.086), 0.006 * HS, 0.004 * HS), (hv(0.030, -0.124, -0.078), 0.006 * HS, 0.004 * HS)]), Y, Z, seg=8))

REGION = {'skin': 0, 'jersey': 1, 'shorts': 2, 'shoe': 3, 'sock': 4, 'head': 0, 'hair': 5, 'eye': 6, 'dark': 7}
BUDGET = {'skin': 5200, 'jersey': 1500, 'shorts': 1700, 'shoe': 2200, 'sock': 500, 'head': 3200, 'hair': 1100, 'eye': 300, 'dark': 600}
VOXEL = {'skin': 0.0068, 'jersey': 0.010, 'shorts': 0.010, 'shoe': 0.0065, 'sock': 0.009, 'head': 0.0065, 'hair': 0.008, 'eye': 0.003, 'dark': 0.004}
SMOOTH = {'skin': 4, 'jersey': 3, 'shorts': 3, 'shoe': 2, 'sock': 2, 'head': 6, 'hair': 4, 'eye': 1, 'dark': 1}
layers = []
for g, objs in G.items():
    for o in bpy.data.objects: o.select_set(False)
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    o = objs[0]; o.name = 'L_' + g
    rm = o.modifiers.new('Fuse', 'REMESH'); rm.mode = 'VOXEL'; rm.voxel_size = VOXEL[g]; rm.use_smooth_shade = True
    bpy.ops.object.modifier_apply(modifier='Fuse')
    sm = o.modifiers.new('Smooth', 'SMOOTH'); sm.factor, sm.iterations = 0.5, SMOOTH[g]
    bpy.ops.object.modifier_apply(modifier='Smooth')
    dc = o.modifiers.new('Light', 'DECIMATE'); dc.ratio = min(1.0, BUDGET[g] / max(1, sum(len(p.vertices) - 2 for p in o.data.polygons)))
    bpy.ops.object.modifier_apply(modifier='Light')
    # which layer a vertex belongs to rides along as a vertex color (red = the region number / 8): the game reads it
    ca = o.data.color_attributes.new('Col', 'BYTE_COLOR', 'CORNER')
    for d in ca.data: d.color = (REGION[g] / 8.0, 0.0, 0.0, 1.0)
    mat = bpy.data.materials.new('M_' + g); mat.diffuse_color = {'skin': (0.62, 0.42, 0.30, 1), 'jersey': (0.93, 0.93, 0.95, 1), 'shorts': (0.10, 0.10, 0.12, 1), 'shoe': (0.95, 0.95, 0.96, 1), 'sock': (0.85, 0.85, 0.87, 1), 'head': (0.62, 0.42, 0.30, 1), 'hair': (0.06, 0.05, 0.05, 1), 'eye': (0.97, 0.97, 0.97, 1), 'dark': (0.05, 0.04, 0.04, 1)}[g]
    o.data.materials.append(mat)
    layers.append(o)
for o in bpy.data.objects: o.select_set(False)
for o in layers: o.select_set(True)
bpy.context.view_layer.objects.active = layers[0]
bpy.ops.object.join()
body = layers[0]; body.name = 'PocketBody'
bpy.ops.object.shade_smooth()

# ---- skinning: bone heat on the body's own bones; fingers, toes and the root do not pull on it
for b in arm.data.bones:
    b.use_deform = b.name.startswith('DEF-') and not any(k in b.name for k in ('f_index', 'f_middle', 'f_ring', 'f_pinky', 'thumb'))
for o in bpy.data.objects: o.select_set(False)
body.select_set(True); arm.select_set(True)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.parent_set(type='ARMATURE_AUTO')
bpy.context.view_layer.objects.active = body
bpy.ops.object.vertex_group_limit_total(group_select_mode='ALL', limit=4)
bpy.ops.object.vertex_group_normalize_all(group_select_mode='ALL', lock_active=False)
# the small shapes of the face (eyes, brows, mouth) are too small for bone heat to reach: they ride on the head bone
hg = body.vertex_groups.get('DEF-head') or body.vertex_groups.new(name='DEF-head')
loose = [q.index for q in body.data.vertices if not q.groups]
if loose: hg.add(loose, 1.0, 'REPLACE')
unw = sum(1 for q in body.data.vertices if not q.groups)
tris = sum(len(p.vertices) - 2 for p in body.data.polygons)
print('BODY verts', len(body.data.vertices), 'tris', tris, 'unweighted', unw, 'groups', len(body.vertex_groups))

# ---- a picture, to judge the shape by
if PREVIEW:
    sc = bpy.context.scene
    sc.render.engine = 'BLENDER_WORKBENCH'
    sc.display.shading.light = 'STUDIO'; sc.display.shading.color_type = 'MATERIAL'; sc.display.shading.show_cavity = True
    sc.render.resolution_x, sc.render.resolution_y = 1800, 860
    sc.render.film_transparent = False
    sc.world = bpy.data.worlds.new('W'); sc.world.color = (0.03, 0.03, 0.035)
    views = []
    for k, ang in enumerate((0, 40, 90)):
        d = body.copy(); d.data = body.data; sc.collection.objects.link(d)
        d.parent = None; d.matrix_world.identity()
        for mdf in list(d.modifiers): d.modifiers.remove(mdf)
        d.location = ((k - 1) * 1.95 + (0.25 if k == 2 else 0), 0, 0); d.rotation_euler = (0, 0, math.radians(ang)); views.append(d)
    body.hide_render = True; arm.hide_render = True
    cam = bpy.data.objects.new('Cam', bpy.data.cameras.new('Cam')); sc.collection.objects.link(cam); sc.camera = cam
    cam.data.type = 'ORTHO'; cam.data.ortho_scale = 6.9
    cam.location = (0, -8, 1.13); cam.rotation_euler = (math.radians(90), 0, 0)
    sc.render.filepath = PREVIEW
    bpy.ops.render.render(write_still=True)
    cam.data.ortho_scale = 2.9; cam.location = (-0.975, -8, 1.74); sc.render.resolution_x, sc.render.resolution_y = 1500, 900
    sc.render.filepath = PREVIEW.replace('.png', '-head.png'); bpy.ops.render.render(write_still=True)
    for d in views: bpy.data.objects.remove(d, do_unlink=True)
    body.hide_render = False

# ---- out: the body and the skeleton, no animation (the game already has the clips)
for o in bpy.data.objects: o.select_set(False)
body.select_set(True); arm.select_set(True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_animations=False, export_skins=True, export_yup=True, export_apply=False, export_materials='NONE', export_normals=True, export_texcoords=False, export_vertex_color='ACTIVE', export_all_vertex_colors=True)
print('WROTE', OUT)
