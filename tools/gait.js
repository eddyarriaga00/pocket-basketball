/* The walk and the run measured: a player is moved in a straight line at a set speed and his feet are followed.
   For each speed: steps a second, the length of a step, and how fast a foot slides over the floor while it is down
   (a planted foot should not move). Human reference, for a man about 6'6": a walk at 4.5 ft/s is about 1.8 steps/s
   with 2.5 ft steps; a jog at 11 ft/s about 2.8 steps/s with 4 ft steps; a sprint at 18 ft/s about 3.8 steps/s with
   4.7 ft steps.   node tools/gait.js */
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const pg = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true }); const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('dialog', d => d.accept());
  const srv = await require('./serve-test').serve(); await pg.goto(srv.url);
  await pg.waitForFunction(() => window.PB && PB.R && PB.R.modelReady && PB.R.modelReady(), null, { timeout: 60000 });
  await pg.click('#qg'); await pg.waitForTimeout(400); await pg.click('#go');
  await pg.waitForFunction(() => PB.Game.active && PB.Game.dbg.state() && PB.Game.dbg.state().phase === 'live', null, { timeout: 90000 });
  const out = await pg.evaluate(() => {
    const G = PB.Game.dbg.state(), u = G.user, res = []; G.paused = true;
    const modes = [['fwd', 0, false], ['ball', 0, true], ['back', Math.PI, false], ['side', Math.PI / 2, false]];
    for (const [mode, off, ball] of modes) for (const v of mode === 'fwd' || mode === 'ball' ? [2.5, 4.5, 7.5, 11, 14.5, 18] : [4.5, 9]) {
      for (const p of G.pl) if (p !== u) { p.x = 40 + G.pl.indexOf(p); p.z = -44; p.vx = p.vz = 0; }
      G.phase = 'live'; G.ball.holder = ball ? u : G.pl.find(p => p !== u); G.ball.state = 'held'; u.shoot = null; u.mv = null; u.y = 0; u.pose = ball ? 'dribble' : ''; u.x = 0; u.z = -30; u.face = off; u.vx = 0; u.vz = v;
      const N = 60 * 5, ser = [];
      for (let i = 0; i < N; i++) { let wrap = false; u.z += v / 60; if (u.z > 30) { u.z -= 60; wrap = true; } u.vx = 0; u.vz = v; u.face = off; G.t += 1 / 60; PB.R.update(G, 1 / 60);
        const f = PB.R.feet(u); if (!f) return 'no feet'; if (i >= 60) ser.push({ f, wrap, z: u.z }); }
      let lo = 9, hi = -9; for (const q of ser) for (const sd of ['L', 'R']) { lo = Math.min(lo, q.f[sd].y); hi = Math.max(hi, q.f[sd].y); }
      const thr = lo + Math.max(0.06, (hi - lo) * 0.18), st = { L: false, R: false }, slide = [], steps = [], rel = []; let fwdMax = 0, backMax = 0;
      for (let i = 1; i < ser.length; i++) { const q = ser[i], pv = ser[i - 1]; if (q.wrap) continue;
        for (const sd of ['L', 'R']) { const down = q.f[sd].y < thr;
          if (down && pv.f[sd].y < thr) rel.push(((q.f[sd].z - q.z) - (pv.f[sd].z - pv.z)) * 60);
          if (down && pv.f[sd].y < thr) slide.push(Math.hypot(q.f[sd].x - pv.f[sd].x, q.f[sd].z - pv.f[sd].z) * 60);
          if (down && !st[sd]) steps.push(i); st[sd] = down; fwdMax = Math.max(fwdMax, q.f[sd].z - q.z); backMax = Math.min(backMax, q.f[sd].z - q.z); } }
      /* steps a second from the swing itself: how often the left foot passes under the hips going forward */
      let cyc = 0; { const rz = ser.map(q => (q.f.L.x - 0) * Math.sin(0) + (q.f.L.z - q.z)), mean = rz.reduce((a, c) => a + c, 0) / rz.length; let below = rz[0] < mean - 0.1;
        for (const r of rz) { if (below && r > mean + 0.1) { cyc++; below = false; } else if (!below && r < mean - 0.1) below = true; } }
      const cad2 = +(cyc * 2 / (ser.length / 60)).toFixed(2), step2 = cad2 ? +(v / cad2).toFixed(2) : 0;
      const dur = ser.length / 60, cad = steps.length / dur, mean = slide.length ? slide.reduce((a, c) => a + c, 0) / slide.length : -1, lift = +(hi - lo).toFixed(2), reach = +(fwdMax - backMax).toFixed(2);
      res.push({ mode, v, cadence: +cad.toFixed(2), step: cad ? +(v / cad).toFixed(2) : 0, slide: +mean.toFixed(2), slidePct: Math.round(mean / v * 100), downPct: Math.round(slide.length / (ser.length * 2) * 100), cad2, step2, lift, reach, footSpeed: +(-rel.reduce((a, c) => a + c, 0) / (rel.length || 1)).toFixed(2) });
    }
    return res; });
  if (typeof out === 'string') console.log(out); else for (const r of out) console.log(JSON.stringify(r));
  console.log('errors', errs); await b.close(); process.exit(0);
})();
