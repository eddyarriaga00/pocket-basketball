/* The dribble measured against the movement, in the real game stepped at 60 frames a second: walking, sprinting, sharp
   cuts, a stop, circles. On every frame: where the ball is in the dribbler's own frame (ahead, to the side, up), how far
   it moved since the last frame, how far it is from the palm at the top of each bounce. Flags a ball that jumps, goes
   through his body, gets away from him, or tops out away from the hand.   node tools/dribblemove.js */
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const pg = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true }); const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('dialog', d => d.accept());
  const srv = await require('./serve-test').serve(); await pg.goto(srv.url);
  await pg.waitForFunction(() => window.PB && PB.R && PB.R.modelReady && PB.R.modelReady(), null, { timeout: 60000 });
  await pg.click('#qg'); await pg.waitForTimeout(400); await pg.click('#go');
  await pg.waitForFunction(() => PB.Game.active && PB.Game.dbg.state() && PB.Game.dbg.state().phase === 'live', null, { timeout: 90000 });
  const out = await pg.evaluate(() => {
    const D = PB.Game.dbg, G = D.state(), u = G.user, B = PB.R.basis(); G.paused = true;
    const res = {};
    const scenes = { stand: t => [0, 0], walk: t => [0, -0.45], sprint: t => [0, -1], cuts: t => [Math.floor(t / 0.7) % 2 ? 1 : -1, -0.2], zigzag: t => [Math.sin(t * 3), -0.8], stopgo: t => (Math.floor(t / 0.9) % 2 ? [0, 0] : [0, -1]), circle: t => [Math.cos(t * 1.6), Math.sin(t * 1.6)], back: t => [0, 0.8] };
    for (const name in scenes) {
      for (const p of G.pl) if (p !== u) { p.x = 40 + G.pl.indexOf(p); p.z = -44; p.vx = p.vz = 0; }
      G.phase = 'live'; G.ball.holder = u; G.ball.state = 'held'; G.poss = u.team; u.shoot = null; u.mv = null; u.y = 0; u.vx = u.vz = 0; u.x = 0; u.z = 0; G.clock = 300; G.q = 1; u.energy = 1;
      const r = { n: 0, maxStep: 0, far: 0, through: 0, apexGap: 0, apexN: 0, maxAhead: -9, minAhead: 9, maxSide: 0, low: 9, bounces: 0, wrongSide: 0 }; let prev = null, py = 0, pdy = 0, skip = 0;
      for (let i = 0; i < 60 * 6; i++) {
        const t = i / 60, s = scenes[name](t); D.stick(s[0], s[1]);
        for (const p of G.pl) if (p !== u) { p.x = 40 + G.pl.indexOf(p); p.z = -44; p.vx = p.vz = 0; }
        G.shotClock = 20; G.clock = 300; u.energy = 1; if (G.vio) G.vio.t = 0; if (G.ball.holder !== u && G.ball.state !== 'shot') { G.phase = 'live'; G.ball.holder = u; G.ball.state = 'held'; G.poss = u.team; } if (Math.abs(u.x) > 18 || Math.abs(u.z) > 36) { u.x = 0; u.z = 0; u.dribX = undefined; G.ball.pushCycle = null; prev = null; skip = 30; }   // (brought back to the middle: not measured until the next bounces)
        D.run(1 / 60); PB.R.update(G, 1 / 60);
        if (G.ball.holder !== u || G.ball.state !== 'held' || u.mv && G.t - u.mv.t0 < u.mv.T) { prev = null; continue; }
        const bl = G.ball, fx = Math.sin(u.face), fz = Math.cos(u.face), dx = bl.x - u.x, dz = bl.z - u.z, ahead = dx * fx + dz * fz, side = dx * fz - dz * fx, H = PB.R.hands(u);
        r.n++; if (skip > 0) { skip--; prev = null; py = G.ball.y; continue; } if (i > 30) {
          if (prev) r.maxStep = Math.max(r.maxStep, Math.hypot(bl.x - prev.x - (u.x - prev.ux), bl.y - prev.y, bl.z - prev.z - (u.z - prev.uz)));
          const dist = Math.hypot(dx, dz); r.far = Math.max(r.far, dist); r.maxAhead = Math.max(r.maxAhead, ahead); r.minAhead = Math.min(r.minAhead, ahead); r.maxSide = Math.max(r.maxSide, Math.abs(side)); r.low = Math.min(r.low, bl.y);
          if (dist < 0.45 && bl.y < 4.2) r.through++;
          const dy = bl.y - py; if (pdy > 0 && dy <= 0 && H) { const hd = (u.dribHand || 1) < 0 ? H.l : H.r; r.apexGap += Math.hypot(bl.x - hd.x, bl.y - hd.y, bl.z - hd.z); r.apexN++; }
          if (pdy < 0 && dy >= 0) r.bounces++; pdy = dy;
        }
        py = bl.y; prev = { x: bl.x, y: bl.y, z: bl.z, ux: u.x, uz: u.z };
      }
      r.apexGap = r.apexN ? +(r.apexGap / r.apexN).toFixed(2) : null; for (const k in r) if (typeof r[k] === 'number') r[k] = +r[k].toFixed(2); res[name] = r;
    }
    D.stick(0, 0); return res;
  });
  let bad = 0;
  for (const k in out) { const r = out[k], flags = [r.maxStep > 1.5 && 'JUMPS', (r.far > 5.2 || r.maxSide > 3.2 || r.minAhead < -2.2) && 'GETS AWAY', r.through > 2 && 'THROUGH BODY', r.apexGap !== null && r.apexGap > 0.75 && 'OFF THE HAND', r.bounces < 4 && 'NO BOUNCE'].filter(Boolean); if (flags.length) bad++;
    console.log(k.padEnd(8), JSON.stringify(r), flags.join(' ')); }
  console.log(bad ? `${bad} scene(s) flagged` : 'The ball stayed with the hand and the movement in every scene.'); console.log('errors', errs); await b.close(); process.exit(0);
})();
