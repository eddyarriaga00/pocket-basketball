"""The pocket body: one smooth, simple figure built round the game's own skeleton, skinned to it, and saved as
models/body.glb. No muscles: soft chunky limbs, a tapered torso, mitten hands with a thumb, round sneakers. The head is
not here: the game draws its own.

  /Applications/Blender.app/Contents/MacOS/Blender --background --python tools/body.py -- models/player.glb models/body.glb [preview.png]

The figure is a stick drawing of the skeleton (a vertex at each joint) given thickness by Blender's Skin modifier and
smoothed, so its joints sit exactly on the bones; the shoes are rounded blocks. Weights come from Blender's automatic
(bone heat) skinning, fingers and toes folded into the hand and foot."""
import bpy, bmesh, sys, math, os
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
    # the leg: a full thigh that narrows to the knee, a calf that sits behind the shin, a slim ankle. Under the shorts the
    # thigh is slimmer on the inside, so it stays inside its leg of the shorts and the two legs of the shorts can part
    parts.append(loft('leg' + S, capped([
        (lg(-0.06, hp, kn, 0.010, 0.008), 0.068, 0.090), (lg(0.12, hp, kn, 0.010, 0.010), 0.068, 0.094), (lg(0.38, hp, kn, 0.008, 0.010), 0.066, 0.088),
        (lg(0.70, hp, kn, 0.004, 0.004), 0.064, 0.074), (lg(0.93, hp, kn), 0.060, 0.063), (lg(0.03, kn, an), 0.058, 0.061),
        (lg(0.18, kn, an, 0.010), 0.060, 0.066), (lg(0.36, kn, an, 0.014), 0.058, 0.066), (lg(0.62, kn, an, 0.010), 0.047, 0.052),
        (lg(0.86, kn, an, 0.004), 0.038, 0.041), (lg(1.06, kn, an), 0.037, 0.040)]), X, Y, seg=20, k=LIMB))

# ---- the kit, as layers of its own over the body (what the reference games do: clothes are shapes, not paint):
# a loose jersey with a hem, baggy shorts to the knee, crew socks, sneakers with a sole, a toe cap and a tongue
G = {'skin': parts, 'jersey': [], 'shorts': [], 'sock': [], 'shoe': []}
jersey = loft('jersey', capped([
    ((0, 0.014, hz - 0.006), 0.199, 0.128), ((0, 0.012, hz + 0.03), 0.200, 0.129), ((0, 0.008, s1 + 0.05), 0.198, 0.128),
    ((0, 0.004, s2 + 0.03), 0.208, 0.132), ((0, 0.002, s2 + 0.12), 0.216, 0.134), ((0, 0.006, s3 + 0.045), 0.220, 0.134),
    ((0, 0.012, shz - 0.045), 0.216, 0.128), ((0, 0.014, shz + 0.008), 0.190, 0.114), ((0, 0.012, shz + 0.034), 0.128, 0.092)]), X, Y, seg=36, power=2.7)
def cut(o, cutter):
    bpy.context.view_layer.objects.active = o
    m = o.modifiers.new('Cut', 'BOOLEAN'); m.operation = 'DIFFERENCE'; m.object = cutter; m.solver = 'EXACT'
    bpy.ops.object.modifier_apply(modifier='Cut'); bpy.data.objects.remove(cutter, do_unlink=True)
cut(jersey, ball('neckcut', (0, -0.040, shz + 0.062), (0.094, 0.166, 0.100), seg=32))                 # the scoop of the neck
for sg in (1, -1): cut(jersey, ball('armcut', (sg * 0.232, 0.030, shz - 0.030), (0.086, 0.170, 0.118), seg=24))   # the armholes
G['jersey'].append(jersey)
G['shorts'].append(loft('shortsTop', capped([
    ((0, 0.018, hz - 0.128), 0.120, 0.100), ((0, 0.016, hz - 0.090), 0.180, 0.124), ((0, 0.014, hz - 0.045), 0.212, 0.134), ((0, 0.012, hz + 0.010), 0.208, 0.134),
    ((0, 0.010, hz + 0.060), 0.196, 0.128)]), X, Y, seg=32, power=2.6))
for S, sg in (('L', 1), ('R', -1)):
    hp, kn, an = head(f'DEF-thigh.{S}'), head(f'DEF-shin.{S}'), head(f'DEF-foot.{S}')
    lg = lambda t, a, b, dy=0.0, dx=0.0: Vector((a.x + (b.x - a.x) * t + sg * dx, a.y + (b.y - a.y) * t + dy, a.z + (b.z - a.z) * t))
    # a leg of the shorts: round, around its own thigh, a little wider at the hem, ending just above the knee. The two
    # legs part at the crotch with a clear gap (they used to overlap across the middle and fused into one block, a skirt,
    # and a narrower gap was filled in by the dark outline the game draws round each): between them, the inner thighs
    G['shorts'].append(loft('shortsLeg' + S, [
        (lg(-0.04, hp, kn, 0.010, 0.026), 0.098, 0.122), (lg(0.20, hp, kn, 0.010, 0.030), 0.094, 0.124), (lg(0.50, hp, kn, 0.008, 0.034), 0.094, 0.126),
        (lg(0.80, hp, kn, 0.006, 0.036), 0.098, 0.130), (lg(0.84, hp, kn, 0.006, 0.036), 0.088, 0.116)], X, Y, seg=24, power=2.1))
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
    G['shoe'].append(loft('ankle' + S, [((an.x, an.y + 0.016, 0.100), 0.066, 0.078), ((an.x, an.y + 0.014, 0.160), 0.066, 0.074), ((an.x, an.y + 0.012, 0.182), 0.061, 0.068)], X, Y, seg=18))
    G['shoe'].append(ball('tongue' + S, (an.x, an.y - 0.056, 0.136), (0.040, 0.030, 0.046)))   # low and soft: it stood up over the collar like an ear
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
# ---- what a player can change: hair, a beard, the set of his face, a headband, goggles. Each is its own part, tagged
# with a variant number (the green of its vertex color / 32); the game draws the ones a player's look asks for
VAR = {}
def part(name, region, variant, objs):
    G[name] = objs; REGION[name] = region; VAR[name] = variant
REGION = {'skin': 0, 'jersey': 1, 'shorts': 2, 'shoe': 3, 'sock': 4, 'head': 0}
cap = lambda n, kx, ky, start=3, dz=0.044, dy=0.022: loft(n, [(hv(0, dy, z + dz), rx * HS * kx, ry * HS * ky) for z, rx, ry in PROFILE[start:]], X, Y, seg=40, power=2.35)
back = lambda n, ry=0.078: hb(0, 0.080, -0.010, 0.128, ry, 0.110, n)
skz = lambda y, x=0.0: 0.150 * max(0.0, 1 - (y / 0.142) ** 2 - (x / 0.140) ** 2) ** 0.5     # the top of the skull over a point
part('hair_short', 5, 1, [cap('h1', 1.09, 1.075), back('h1b')])
part('hair_buzz', 5, 2, [cap('h2', 1.04, 1.035), back('h2b', 0.070)])
part('hair_high', 5, 3, [cap('h3', 1.08, 1.07), back('h3b'), loft('h3t', capped([(hv(0, 0.012, 0.105), 0.118 * HS, 0.126 * HS), (hv(0, 0.012, 0.165), 0.122 * HS, 0.130 * HS), (hv(0, 0.012, 0.215), 0.118 * HS, 0.126 * HS)]), X, Y, seg=28, power=3.4)])
part('hair_afro', 5, 4, [hb(0, 0.030, 0.095, 0.172, 0.168, 0.150, 'h4')])
part('hair_twists', 5, 5, [cap('h5', 1.04, 1.035), back('h5b', 0.070)] + [hb(x, y, skz(y, x) + 0.020, 0.026, 0.026, 0.040, 'tw') for x in (-0.084, -0.042, 0, 0.042, 0.084) for y in (-0.070, -0.022, 0.026, 0.074) if abs(x) + abs(y) < 0.15])
part('hair_fade', 5, 6, [cap('h6', 1.07, 1.06, start=5, dz=0.030, dy=0.010), hb(0, 0.0, 0.118, 0.112, 0.118, 0.050, 'h6t')])
part('hair_cornrows', 5, 7, [cap('h7', 1.035, 1.03), back('h7b', 0.068)])   # the scalp between the rows: the game draws it lighter
part('hair_rows', 5, 21, [loft('row', capped([(hv(x, y, skz(y, x) + 0.052), 0.0105 * HS, 0.012 * HS) for y in (-0.104, -0.060, -0.010, 0.040, 0.085, 0.122)]), X, Z, seg=8) for x in (-0.090, -0.060, -0.030, 0, 0.030, 0.060, 0.090)])
part('hair_bun', 5, 8, [cap('h8', 1.07, 1.06), back('h8b'), hb(0, 0.108, 0.122, 0.052, 0.050, 0.050, 'bun')])
part('hair_mohawk', 5, 9, [loft('h9', capped([(hv(0, y, skz(y) + 0.020), 0.030 * HS, 0.034 * HS) for y in (-0.112, -0.070, -0.020, 0.030, 0.080, 0.120)]), X, Z, seg=12)])
import math as _m
part('hair_locs', 5, 10, [cap('h10', 1.07, 1.06), back('h10b')] + [loft('loc', capped([(hv(_m.sin(a) * 0.128, _m.cos(a) * 0.134 + 0.012, 0.070), 0.017 * HS, 0.017 * HS), (hv(_m.sin(a) * 0.140, _m.cos(a) * 0.146 + 0.014, -0.030), 0.016 * HS, 0.016 * HS), (hv(_m.sin(a) * 0.138, _m.cos(a) * 0.144 + 0.016, -0.130), 0.013 * HS, 0.013 * HS)]), X, Y, seg=8) for a in [_m.radians(d) for d in range(-110, 111, 20)]])
# three more: tight curls (a cap of small bumps all over), a ponytail (pulled back, a tail off the crown), long hair (a curtain to the neck)
part('hair_curly', 5, 14, [cap('h14', 1.05, 1.045), back('h14b', 0.074)] + [hb(x, y, skz(y, x) + 0.030, 0.030, 0.030, 0.034, 'cu') for x in (-0.105, -0.07, -0.035, 0, 0.035, 0.07, 0.105) for y in (-0.095, -0.055, -0.015, 0.025, 0.065, 0.105) if (x / 0.125) ** 2 + (y / 0.125) ** 2 < 1.0]
     + [hb(_m.sin(a) * 0.118, _m.cos(a) * 0.118 + 0.02, 0.045, 0.030, 0.030, 0.032, 'cs') for a in [_m.radians(d) for d in range(60, 301, 24)]])
part('hair_ponytail', 5, 15, [cap('h15', 1.07, 1.06), back('h15b'), loft('tail', capped([(hv(0, 0.118, 0.070), 0.040 * HS, 0.040 * HS), (hv(0, 0.185, 0.045), 0.036 * HS, 0.036 * HS), (hv(0, 0.222, -0.040), 0.028 * HS, 0.028 * HS), (hv(0, 0.214, -0.135), 0.014 * HS, 0.014 * HS)]), X, Z, seg=12)])
part('hair_long', 5, 22, [cap('h22', 1.08, 1.07), back('h22b', 0.084)] + [loft('lg', capped([(hv(_m.sin(a) * 0.126, _m.cos(a) * 0.132 + 0.012, 0.080), 0.030 * HS, 0.026 * HS), (hv(_m.sin(a) * 0.140, _m.cos(a) * 0.146 + 0.016, -0.040), 0.030 * HS, 0.024 * HS), (hv(_m.sin(a) * 0.142, _m.cos(a) * 0.150 + 0.020, -0.150), 0.022 * HS, 0.018 * HS)]), X, Y, seg=8) for a in [_m.radians(d) for d in range(-118, 119, 14)]])
# past 31 the variant number spills into the blue channel: spiky hair, long braids, a mustache, a chinstrap
part('hair_spiky', 5, 34, [cap('h34', 1.04, 1.035), back('h34b', 0.070)] + [loft('sp', capped([(hv(x, y, skz(y, x) + 0.030), 0.024 * HS, 0.024 * HS), (hv(x * 1.10, y * 1.10 - 0.006, skz(y, x) + 0.075), 0.014 * HS, 0.014 * HS), (hv(x * 1.18, y * 1.18 - 0.012, skz(y, x) + 0.112), 0.004 * HS, 0.004 * HS)]), X, Y, seg=8) for x in (-0.085, -0.043, 0, 0.043, 0.085) for y in (-0.085, -0.040, 0.005, 0.050, 0.095) if (x / 0.12) ** 2 + (y / 0.125) ** 2 < 1.0])
part('hair_braids', 5, 35, [cap('h35', 1.06, 1.05), back('h35b')] + [loft('br', capped([(hv(_m.sin(a) * 0.126, _m.cos(a) * 0.132 + 0.012, 0.070), 0.013 * HS, 0.013 * HS), (hv(_m.sin(a) * 0.142, _m.cos(a) * 0.148 + 0.016, -0.040), 0.012 * HS, 0.012 * HS), (hv(_m.sin(a) * 0.146, _m.cos(a) * 0.152 + 0.020, -0.150), 0.011 * HS, 0.011 * HS), (hv(_m.sin(a) * 0.150, _m.cos(a) * 0.150 + 0.024, -0.235), 0.008 * HS, 0.008 * HS)]), X, Y, seg=8) for a in [_m.radians(d) for d in range(-116, 117, 13)]])
part('beard_mustache', 5, 32, [loft('b32', capped([(hv(-0.046, -0.119, -0.070), 0.007 * HS, 0.007 * HS), (hv(-0.022, -0.131, -0.060), 0.010 * HS, 0.009 * HS), (hv(0, -0.135, -0.058), 0.010 * HS, 0.009 * HS), (hv(0.022, -0.131, -0.060), 0.010 * HS, 0.009 * HS), (hv(0.046, -0.119, -0.070), 0.007 * HS, 0.007 * HS)]), Y, Z, seg=8)])
part('beard_chinstrap', 5, 33, [loft('b33', [(hv(0, -0.005, z), rx * HS * 1.03, ry * HS * 1.03) for z, rx, ry in PROFILE[:2]] + [(hv(0, -0.002, -0.112), 0.104 * HS, 0.110 * HS)], X, Y, seg=40, power=2.35)])
part('beard_stubble', 5, 11, [loft('b11', [(hv(0, -0.004, z), rx * HS * 1.025, ry * HS * 1.025) for z, rx, ry in PROFILE[:3]] + [(hv(0, 0.004, -0.070), 0.126 * HS, 0.130 * HS)], X, Y, seg=40, power=2.35)])
part('beard_goatee', 5, 12, [hb(0, -0.090, -0.128, 0.040, 0.034, 0.030, 'b12'), loft('b12m', capped([(hv(-0.040, -0.122, -0.066), 0.007 * HS, 0.006 * HS), (hv(0, -0.134, -0.060), 0.008 * HS, 0.007 * HS), (hv(0.040, -0.122, -0.066), 0.007 * HS, 0.006 * HS)]), Y, Z, seg=8)])
part('beard_full', 5, 13, [loft('b13', [(hv(0, -0.006, z), rx * HS * 1.06, ry * HS * 1.06) for z, rx, ry in PROFILE[:3]] + [(hv(0, 0.000, -0.064), 0.129 * HS, 0.130 * HS)], X, Y, seg=40, power=2.35)]
     + [hb(sg * 0.122, 0.0, -0.040, 0.016, 0.050, 0.060, 'burn') for sg in (1, -1)] + [loft('b13m', capped([(hv(-0.044, -0.120, -0.064), 0.008 * HS, 0.007 * HS), (hv(0, -0.134, -0.058), 0.009 * HS, 0.008 * HS), (hv(0.044, -0.120, -0.064), 0.008 * HS, 0.007 * HS)]), Y, Z, seg=8)])
# faces: (eye half-width, half-height, brow inner height, brow outer height, brow thickness, the mouth's corners up, its width)
FACE = {16: (0.021, 0.033, 0.046, 0.047, 0.007, 0.008, 0.030), 17: (0.020, 0.027, 0.036, 0.054, 0.008, 0.000, 0.026), 18: (0.024, 0.039, 0.058, 0.056, 0.006, 0.014, 0.038),
        19: (0.022, 0.019, 0.044, 0.044, 0.006, 0.004, 0.022), 20: (0.021, 0.031, 0.040, 0.050, 0.011, 0.006, 0.030),
        # three more: happy (wide eyes, a big smile), stern (brows down, a flat frown), sleepy (half-shut eyes)
        36: (0.023, 0.036, 0.060, 0.060, 0.006, 0.020, 0.044), 37: (0.021, 0.024, 0.030, 0.054, 0.010, -0.006, 0.028), 38: (0.022, 0.014, 0.040, 0.041, 0.006, 0.002, 0.024)}
for vid, (ew, eh, bi, bo, bt, up, mw) in FACE.items():
    part(f'eyes{vid}', 7, vid, [hb(sg * 0.052, -0.129, -0.006, ew, 0.010, eh, 'eye') for sg in (1, -1)])
    dk = []
    for sg in (1, -1): dk.append(loft('brow', capped([(hv(sg * 0.026, -0.134, bi), bt * HS, 0.005 * HS), (hv(sg * 0.054, -0.132, (bi + bo) / 2 + 0.006), bt * HS, 0.005 * HS), (hv(sg * 0.080, -0.120, bo), bt * 0.85 * HS, 0.004 * HS)]), Y, Z, seg=8))
    sm = 0.004 if vid == 20 else 0.0     # the bold face smirks: one corner higher
    dk.append(loft('mouth', capped([(hv(-mw, -0.124, -0.086 + up - sm), 0.006 * HS, 0.004 * HS), (hv(-mw * 0.45, -0.130, -0.086), 0.006 * HS, 0.004 * HS), (hv(mw * 0.45, -0.130, -0.086), 0.006 * HS, 0.004 * HS), (hv(mw, -0.124, -0.086 + up + sm), 0.006 * HS, 0.004 * HS)]), Y, Z, seg=8))
    part(f'face{vid}', 7, vid + 10, dk)   # brows and mouth: 26 to 30
    part(f'glint{vid}', 6, vid, [hb(sg * 0.052 + 0.008, -0.138, min(0.008, eh * 0.4 - 0.004), 0.0065, 0.004, 0.009 if eh > 0.022 else 0.005, 'glint') for sg in (1, -1)])
part('shut', 7, 31, [loft('lid', capped([(hv(sg * 0.052 - 0.020, -0.131, -0.010), 0.005 * HS, 0.004 * HS), (hv(sg * 0.052, -0.134, -0.014), 0.005 * HS, 0.004 * HS), (hv(sg * 0.052 + 0.020, -0.131, -0.010), 0.005 * HS, 0.004 * HS)]), Y, Z, seg=8) for sg in (1, -1)])   # a blink: the eyes as two short lines
part('band', 5, 24, [loft('band', [(hv(0, 0.004, z), 0.1385 * HS * k, 0.1425 * HS * k) for z, k in ((0.034, 1.0), (0.040, 1.045), (0.078, 1.045), (0.084, 1.0))], X, Y, seg=40, power=2.35)])
part('goggles', 5, 25, [hb(sg * 0.052, -0.126, -0.004, 0.036, 0.016, 0.038, 'lens') for sg in (1, -1)] + [loft('strap', [(hv(0, 0.004, z), 0.1385 * HS * k, 0.1425 * HS * k) for z, k in ((-0.014, 1.0), (-0.010, 1.03), (0.008, 1.03), (0.012, 1.0))], X, Y, seg=40, power=2.35)])

B0 = {'hair_spiky': 1600, 'hair_braids': 1700, 'beard_mustache': 160, 'beard_chinstrap': 500, 'hair_twists': 1700, 'hair_rows': 1500, 'hair_curly': 2200, 'hair_long': 1300, 'hair_ponytail': 1000, 'skin': 5200, 'jersey': 5600, 'shorts': 4000, 'shoe': 3200, 'sock': 500, 'head': 3200}
V0 = {'hair_spiky': 0.0055, 'hair_braids': 0.0045, 'beard_mustache': 0.004, 'hair_twists': 0.0055, 'hair_rows': 0.005, 'hair_curly': 0.0055, 'skin': 0.0068, 'jersey': 0.010, 'shorts': 0.010, 'shoe': 0.0065, 'sock': 0.009, 'head': 0.0065}
S0 = {'hair_spiky': 1, 'hair_braids': 1, 'beard_mustache': 1, 'hair_twists': 1, 'hair_rows': 1, 'hair_curly': 1, 'skin': 4, 'jersey': 7, 'shorts': 6, 'shoe': 5, 'sock': 3, 'head': 6}
part('yell', 7, 23, [hb(0, -0.127, -0.093, 0.021, 0.010, 0.019, 'yell')])   # an open mouth for a shout: it covers the small one
kind = lambda g: 'hair' if g.startswith('hair') or g.startswith('beard') or g in ('band', 'goggles') else 'face' if g.startswith('face') or g.startswith('eyes') or g in ('shut', 'yell') else 'glint' if g.startswith('glint') else g
BUDGET = lambda g: B0.get(g) or {'hair': 800, 'face': 420, 'glint': 60}[kind(g)]
VOXEL = lambda g: V0.get(g) or {'hair': 0.0075, 'face': 0.004, 'glint': 0.003}[kind(g)]
SMOOTH = lambda g: S0.get(g) if g in S0 else {'hair': 3, 'face': 1, 'glint': 1}[kind(g)]
SHOW = ('skin', 'jersey', 'shorts', 'shoe', 'sock', 'head', 'hair_short', 'face26', 'eyes16', 'glint16')   # what the preview picture wears
KNEEZ = head('DEF-shin.L').z
layers = []
for g, objs in G.items():
    for o in bpy.data.objects: o.select_set(False)
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    bpy.ops.object.join()
    o = objs[0]; o.name = 'L_' + g
    rm = o.modifiers.new('Fuse', 'REMESH'); rm.mode = 'VOXEL'; rm.voxel_size = VOXEL(g); rm.use_smooth_shade = True
    bpy.ops.object.modifier_apply(modifier='Fuse')
    sm = o.modifiers.new('Smooth', 'SMOOTH'); sm.factor, sm.iterations = 0.5, SMOOTH(g)
    bpy.ops.object.modifier_apply(modifier='Smooth')
    if g == 'jersey':   # the tops of the straps lie flat on the shoulders: cut thin by the neck and the armholes, their tips curled up into points
        for q in o.data.vertices:
            if q.co.z > shz + 0.034: q.co.z = shz + 0.034 + (q.co.z - shz - 0.034) * 0.3
    dc = o.modifiers.new('Light', 'DECIMATE'); dc.ratio = min(1.0, BUDGET(g) / max(1, sum(len(p.vertices) - 2 for p in o.data.polygons)))
    bpy.ops.object.modifier_apply(modifier='Light')
    if g in ('jersey', 'shorts'):   # cutting the triangles down leaves small facets and wavy edges on cloth: one more soft pass irons them out
        sm2 = o.modifiers.new('Iron', 'SMOOTH'); sm2.factor, sm2.iterations = 0.5, 3
        bpy.ops.object.modifier_apply(modifier='Iron')
    # which layer a vertex belongs to rides along as a vertex color (red = the region number / 8): the game reads it
    ca = o.data.color_attributes.new('Col', 'BYTE_COLOR', 'CORNER')
    CUT = KNEEZ + (hz - KNEEZ) * 0.24
    if g == 'skin':   # a clean line where the under-shorts color ends, not a jagged one along the triangles
        import bmesh
        bm = bmesh.new(); bm.from_mesh(o.data)
        bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=(0, 0, CUT), plane_no=(0, 0, 1), clear_inner=False, clear_outer=False)
        # and along where the insides of the thighs stop being painted the shorts' color (a clean edge, not a ragged one)
        for co_, no_ in (((0.045, 0, 0), (1, 0, 0)), ((-0.045, 0, 0), (1, 0, 0)), ((0, 0, hz - 0.14), (0, 0, 1))):
            bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=co_, plane_no=no_, clear_inner=False, clear_outer=False)
        bmesh.ops.triangulate(bm, faces=bm.faces[:]); bm.to_mesh(o.data); bm.free(); o.data.update()
        ca = o.data.color_attributes.get('Col') or ca
    pz, px = {}, {}
    for pl in o.data.polygons:
        for li in pl.loop_indices: pz[li] = pl.center.z; px[li] = pl.center.x
    for li, d in enumerate(ca.data):
        r = REGION[g]
        if g == 'skin':   # the body under the clothes takes their color, so nothing shows through when he bends: the trunk
            co = o.data.vertices[o.data.loops[li].vertex_index].co   # under the jersey, the hips and upper thighs under the shorts
            # (by the triangle's middle, so each is one color; narrower up at the chest, where a wider patch stretched into
            # shards under a raised arm)
            if abs(px[li]) < (0.215 if pz[li] < shz - 0.24 else 0.15) and hz - 0.20 < pz[li] < shz - 0.11: r = 2 if pz[li] < hz + 0.02 else 1
            elif co.z < hz and pz[li] > CUT and abs(co.x) < 0.26 and not (abs(px[li]) < 0.045 and pz[li] < hz - 0.14): r = 2
            # (the insides of the thighs below the crotch stay skin: painted too, they filled the gap between the legs
            # of the shorts and the shorts read as a skirt)
        d.color = (r / 8.0, (VAR.get(g, 0) % 32) / 32.0, (VAR.get(g, 0) // 32) / 8.0, 1.0)   # the variant: green is its low five bits, blue the rest
    mat = bpy.data.materials.new('M_' + g); mat.diffuse_color = {0: (0.62, 0.42, 0.30, 1), 1: (0.93, 0.93, 0.95, 1), 2: (0.10, 0.10, 0.12, 1), 3: (0.95, 0.95, 0.96, 1), 4: (0.85, 0.85, 0.87, 1), 5: (0.06, 0.05, 0.05, 1), 6: (0.97, 0.97, 0.97, 1), 7: (0.05, 0.04, 0.04, 1)}[REGION[g]]
    o['show'] = 1 if g in SHOW else 0
    o.data.materials.append(mat)
    layers.append(o)
# the picture's player: one hairstyle and one face, not all of them at once
pv = []
for o in layers:
    if o.get('show'):
        c = o.copy(); c.data = o.data.copy(); bpy.context.scene.collection.objects.link(c); pv.append(c)
for o in bpy.data.objects: o.select_set(False)
for o in pv: o.select_set(True)
bpy.context.view_layer.objects.active = pv[0]
bpy.ops.object.join()
preview = pv[0]; preview.name = 'Preview'; bpy.ops.object.shade_smooth(); preview.hide_render = True
# ---- skinning. The body (skin, kit, shoes) gets bone heat on the body's own bones; fingers, toes and the root do not
# pull on it. Everything from the neck up (the head, every hairstyle, beard, face and accessory) rides on the head bone
# and nothing else: bone heat is not asked to solve those (with enough loose parts it gives up on the whole mesh and
# says nothing, and the player comes out rigged to one bone).
BODYL = ('L_skin', 'L_jersey', 'L_shorts', 'L_shoe', 'L_sock')
bodyL = [o for o in layers if o.name in BODYL]; headL = [o for o in layers if o.name not in BODYL]
assert len(bodyL) == len(BODYL), [o.name for o in layers]
def joined(objs, name):
    for o in bpy.data.objects: o.select_set(False)
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[0]
    if len(objs) > 1: bpy.ops.object.join()
    objs[0].name = name; bpy.ops.object.shade_smooth(); return objs[0]
for b in arm.data.bones:
    b.use_deform = b.name.startswith('DEF-') and not any(k in b.name for k in ('f_index', 'f_middle', 'f_ring', 'f_pinky', 'thumb'))
# The clothes bend with the body under them: bone heat is run on the bare body alone (one closed surface, which it
# solves well), and every piece of the kit copies its weights from the nearest point of that body. Bone heat on the
# body and the kit together had each loose shell find its own bones: a leg of the shorts hung off the hips and stayed
# put while the thigh inside it swung forward, and the jersey tore where it and the chest picked different bones.
skinO = next(o for o in bodyL if o.name == 'L_skin')
for o in bpy.data.objects: o.select_set(False)
skinO.select_set(True); arm.select_set(True); bpy.context.view_layer.objects.active = arm
bpy.ops.object.parent_set(type='ARMATURE_AUTO')
# what each piece of kit may follow: the jersey the trunk and the shoulders (not the arms: it is a tank top, the arm
# moves inside the armhole), the shorts the hips, the low back and the thighs (never the shins), socks and shoes the
# leg below the knee and the foot
FOLLOW = {'L_jersey': ('DEF-spine', 'DEF-hips', 'DEF-shoulder', 'DEF-breast', 'DEF-neck', 'DEF-pelvis'),
          'L_shorts': ('DEF-hips', 'DEF-spine', 'DEF-thigh', 'DEF-pelvis'),
          'L_sock': ('DEF-shin', 'DEF-foot'), 'L_shoe': ('DEF-shin', 'DEF-foot', 'DEF-toe')}
def smoothW(o, n):
    """soften the weights: cloth does not crease along a single row of triangles"""
    nb = [[] for _ in o.data.vertices]
    for e in o.data.edges: a_, b_ = e.vertices; nb[a_].append(b_); nb[b_].append(a_)
    W = [{o.vertex_groups[g.group].name: g.weight for g in q.groups} for q in o.data.vertices]
    for _ in range(n):
        W2 = []
        for i, w in enumerate(W):
            acc = {k: v * 0.5 for k, v in w.items()}
            if nb[i]:
                f = 0.5 / len(nb[i])
                for j in nb[i]:
                    for k, v in W[j].items(): acc[k] = acc.get(k, 0) + v * f
            else: acc = dict(w)
            s_ = sum(acc.values()) or 1; W2.append({k: v / s_ for k, v in acc.items()})
        W = W2
    for vg in o.vertex_groups: vg.remove(list(range(len(o.data.vertices))))
    for i, w in enumerate(W):
        for k, v in w.items():
            if v > 1e-3: o.vertex_groups[k].add([i], v, 'REPLACE')
SHORTS_UP = float(os.environ.get('SHORTS_UP', '0.12'))
def shortsFromSkin(o):
    """the shorts take the bare body's own weights (bone heat bends the hips and thighs smoothly), from the skin on
    their own side: a leg of the shorts is wider than the thigh, and copied from the nearest skin anywhere its inside
    took the other leg's weights and crumpled. Each point averages the few nearest skin points of its own leg (both
    legs at the middle seam), so the cloth bends as softly as the body under it."""
    from mathutils import kdtree
    xL = head('DEF-thigh.L').x; sgL = 1 if xL > 0 else -1
    allow = ('DEF-hips', 'DEF-spine', 'DEF-thigh', 'DEF-pelvis')
    sv = skinO.data.vertices; names = {g.index: g.name for g in skinO.vertex_groups}
    pts = [q for q in sv if 0.05 < q.co.z < shz and any(names[e.group].startswith(allow) and e.weight > 1e-3 for e in q.groups)]
    trees = {}
    for side in (1, -1, 0):
        sel = [q for q in pts if (side == 0 and abs(q.co.x) < 0.06) or (side != 0 and q.co.x * side > -0.004)]
        t = kdtree.KDTree(len(sel))
        for k_, q in enumerate(sel): t.insert(q.co, k_)
        t.balance(); trees[side] = (t, sel)
    for vg in list(o.vertex_groups): o.vertex_groups.remove(vg)
    out = {}
    for q in o.data.vertices:
        side = 0 if abs(q.co.x) < 0.012 else (1 if q.co.x > 0 else -1)
        t, sel = trees[side]; acc = {}
        # sampled a little above the point: the bend of the cloth sits lower on the leg than the body's own (taken
        # level, the top of a leg of the shorts swung with the thigh and opened a gap at the hip)
        for co, k_, d in t.find_n(q.co + Vector((0, 0, SHORTS_UP)), 10):
            wgt = 1 / (d + 0.01)
            for e in sel[k_].groups:
                n = names[e.group]
                if n.startswith(allow) and not (n.startswith('DEF-thigh') and ((n.endswith('.L')) != (sgL == side) and side != 0)):
                    acc[n] = acc.get(n, 0) + e.weight * wgt
        s_ = sum(acc.values()) or 1
        for n, v in acc.items():
            if v / s_ > 1e-3:
                if n not in out: out[n] = o.vertex_groups.new(name=n)
                out[n].add([q.index], v / s_, 'REPLACE')
        if not acc: (out.get('DEF-hips') or out.setdefault('DEF-hips', o.vertex_groups.new(name='DEF-hips'))).add([q.index], 1.0, 'REPLACE')
def footWeights(o, sock):
    """shoes and socks are weighted by where a point is too: copied from the slim bare foot inside, the sole and the
    upper picked different bones and tore apart (the sole peeled off, the sock spiked out) as soon as the heel came up.
    A shoe is stiff: behind the ball of the foot it rides the foot, in front of it the toe, with a short soft crease
    over the ball; the collar round the ankle eases onto the shin so it does not cut into the leg as the ankle flexes.
    A sock rides the shin and only its bottom follows the foot."""
    xL = head('DEF-thigh.L').x
    for vg in list(o.vertex_groups): o.vertex_groups.remove(vg)
    ss = lambda t: (lambda u: u * u * (3 - 2 * u))(min(1.0, max(0.0, t)))
    for S in ('L', 'R'):
        for n in (f'DEF-shin.{S}', f'DEF-foot.{S}', f'DEF-toe.{S}'): o.vertex_groups.new(name=n)
    for q in o.data.vertices:
        c = q.co; S = 'L' if (c.x > 0) == (xL > 0) else 'R'
        an = head(f'DEF-foot.{S}'); ball_ = head(f'DEF-toe.{S}')
        if sock:
            sh = ss((c.z - (an.z - 0.005)) / 0.08); w = {f'DEF-shin.{S}': sh, f'DEF-foot.{S}': 1 - sh}
        else:
            # the crease runs across the ball of the foot (the toe bone's root), a little behind it at the top
            f = ss((ball_.y + 0.012 - c.y) / 0.045)
            sh = 0.55 * ss((c.z - (an.z - 0.005)) / 0.075) * (1 - f)
            w = {f'DEF-shin.{S}': sh, f'DEF-foot.{S}': (1 - sh) * (1 - f), f'DEF-toe.{S}': (1 - sh) * f}
        for k, v in w.items():
            if v > 1e-3: o.vertex_groups[k].add([q.index], v, 'REPLACE')
for o in bodyL:
    if o is skinO: continue
    if o.name == 'L_shorts': shortsFromSkin(o); smoothW(o, 6); continue
    if o.name in ('L_shoe', 'L_sock'): footWeights(o, o.name == 'L_sock'); continue
    for q in bpy.data.objects: q.select_set(False)
    o.select_set(True); bpy.context.view_layer.objects.active = o
    dt = o.modifiers.new('Weights', 'DATA_TRANSFER'); dt.object = skinO; dt.use_object_transform = True
    dt.use_vert_data = True; dt.data_types_verts = {'VGROUP_WEIGHTS'}; dt.vert_mapping = 'POLYINTERP_NEAREST'
    dt.layers_vgroup_select_src = 'ALL'; dt.layers_vgroup_select_dst = 'NAME'
    bpy.ops.object.datalayout_transfer(modifier='Weights')
    bpy.ops.object.modifier_apply(modifier='Weights')
    keep = FOLLOW[o.name]
    for vg in list(o.vertex_groups):
        if not vg.name.startswith(keep): o.vertex_groups.remove(vg)
    # a vertex left with nothing it may follow (a jersey edge that only knew the arm) takes the nearest trunk bone
    for q in o.data.vertices:
        if not any(e.weight > 1e-4 for e in q.groups):
            best = min((vg for vg in o.vertex_groups), key=lambda vg: (arm.data.bones[vg.name].head_local - q.co).length if vg.name in arm.data.bones else 9)
            best.add([q.index], 1.0, 'REPLACE')
    smoothW(o, 3)
body = joined(bodyL, 'PocketBody'); headO = joined(headL, 'PocketHead')
for o in bpy.data.objects: o.select_set(False)
body.select_set(True); arm.select_set(True)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.parent_set(type='ARMATURE_NAME')   # the weights are already there: this only ties the mesh to the skeleton
for md in list(body.modifiers):
    if md.type == 'ARMATURE' and md.object is not arm: body.modifiers.remove(md)
arms = [md for md in body.modifiers if md.type == 'ARMATURE']
for md in arms[1:]: body.modifiers.remove(md)
bpy.context.view_layer.objects.active = body
bpy.ops.object.vertex_group_limit_total(group_select_mode='ALL', limit=4)
bpy.ops.object.vertex_group_normalize_all(group_select_mode='ALL', lock_active=False)
# did bone heat do its work? A body that came out on one or two bones is not a body: stop here, write nothing
top = {}
for q in body.data.vertices:
    if q.groups: gname = body.vertex_groups[max(q.groups, key=lambda e: e.weight).group].name; top[gname] = top.get(gname, 0) + 1
nob = sum(1 for q in body.data.vertices if not q.groups)
print('BODY rig: bones in charge of some of it', len(top), 'unweighted', nob, 'of', len(body.data.vertices))
if len(top) < 14 or nob > len(body.data.vertices) * 0.02:
    print('Error: bone heat failed (the body is not rigged). Nothing written.'); sys.exit(1)
hg = body.vertex_groups.get('DEF-head') or body.vertex_groups.new(name='DEF-head')
loose = [q.index for q in body.data.vertices if not q.groups]
if loose: hg.add(loose, 1.0, 'REPLACE')
hg2 = headO.vertex_groups.new(name='DEF-head'); hg2.add([q.index for q in headO.data.vertices], 1.0, 'REPLACE')
for o in bpy.data.objects: o.select_set(False)
headO.select_set(True); body.select_set(True); bpy.context.view_layer.objects.active = body
bpy.ops.object.join()
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
        d = preview.copy(); d.data = preview.data; sc.collection.objects.link(d); d.hide_render = False
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
