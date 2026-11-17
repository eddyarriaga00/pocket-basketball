"""The dribbling arm for js/court.js (DRIB): two dribble cycles of CMU subject 06, trial 02, averaged into twelve steps.
Usage: python tools/mocap/dribble.py 06_02.bvh   (from https://github.com/sfd158/cmu-mocap, data/006)
Prints, per step, the upper arm and forearm of each arm in the body frame: x outward for that arm, y up, z ahead."""
import sys, numpy as np
from bvh import BVH
b = BVH(sys.argv[1]); I = b.idx
nz = lambda v: v / np.linalg.norm(v)
cycles = [(2.78, 3.65), (3.65, 4.58)]
N = 12
acc = np.zeros((N, 4, 3))
for t0, t1 in cycles:
    for k in range(N):
        t = t0 + (t1 - t0) * k / N
        P = b.fk(int(round(t / b.dt)))[0]; g = lambda j: P[I[j]]
        r = g('RightArm') - g('LeftArm'); r[1] = 0; r = nz(r); up = np.array([0., 1, 0]); f = np.cross(r, up)
        toe = g('LeftToeBase') - g('LeftFoot'); toe[1] = 0
        if f @ toe < 0: f = -f
        i = 0
        for S, sg in (('Right', 1), ('Left', -1)):
            for a, c in ((S + 'Arm', S + 'ForeArm'), (S + 'ForeArm', S + 'Hand')):
                d = nz(g(c) - g(a)); acc[k, i] += [sg * d @ r, d @ up, d @ f]; i += 1
for k in range(N):
    print([[round(float(x), 2) for x in nz(v)] for v in acc[k]])
