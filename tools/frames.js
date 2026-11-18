/* frame by frame: the game is frozen and stepped by hand, a picture after each step.
   node step.js <scene: fake|shot|layup|dunk|pass|steal|block> <view: side|front|back> <frames> <dt seconds> [cols] -> .shots/step-<scene>-<view>.png */
const { chromium } = require('playwright'); const { execFileSync } = require('child_process');
const [SCENE = 'fake', VIEW = 'side', NF = '8', DT = '0.05', COLS = '4'] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const pg = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true }); const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('dialog', d => d.accept());
  const srv = await require('./serve-test').serve(); await pg.goto(srv.url);
  await pg.waitForFunction(() => window.PB && PB.R && PB.R.modelReady && PB.R.modelReady(), null, { timeout: 60000 });
  await pg.click('#qg'); await pg.waitForTimeout(400); await pg.click('#go');
  await pg.waitForFunction(() => PB.Game.active && PB.Game.dbg.state() && PB.Game.dbg.state().phase === 'live', null, { timeout: 90000 });
  await pg.evaluate(([SCENE, VIEW]) => {
    const st = document.createElement('style'); st.textContent = 'body *{visibility:hidden!important} canvas{visibility:visible!important}'; document.head.appendChild(st);
    const G = PB.Game.dbg.state(), u = G.user, hz = u.team === 0 ? 1 : -1; PB.R.lock.fov = 60; PB.R.resize(); PB.settings = PB.settings || {}; PB.settings.replays = false;
    G.paused = true; { const o = PB.R.update; PB.R.update = (g, dt) => { const k = window._dt || 0; window._dt = 0; return o(g, k); }; } const d = G.pl.find(p => p.team !== u.team), m8 = G.pl.find(p => p.team === u.team && p !== u);
    for (const p of G.pl) if (p !== u && p !== d && p !== m8) { p.x = 44; p.z = -44 * hz; }
    G.phase = 'live'; G.ball.holder = u; G.ball.state = 'held'; G.poss = u.team; u.shoot = null; u.y = 0; u.vy = 0; u.vx = u.vz = 0; G.clock = 300; G.shotClock = 20; u.inb = false; u.face = Math.atan2(0, hz);
    const far = SCENE === 'shot' || SCENE === 'fake' || SCENE === 'pass' || SCENE === 'steal';
    u.x = 0; u.z = (far ? 22 : SCENE === 'dunk' ? 34 : 33) * hz; d.x = 0.5; d.z = u.z + 3.2 * hz; d.y = 0; m8.x = -16; m8.z = u.z - 6 * hz;
    if (SCENE === 'layup' || SCENE === 'dunk') { d.x = 30; u.vz = 12 * hz; if (SCENE === 'dunk') { u.r.dunk = 99; u.r.vert = 95; } }
    if (SCENE === 'slide') { G.ball.holder = d; G.poss = d.team; d.x = 0; d.z = -20 * hz; d.vx = d.vz = 0; u.x = 0.3; u.z = -24 * hz; m8.x = -20; m8.z = 0; }
    if (SCENE === 'hands') { G.ball.holder = d; G.poss = d.team; d.x = 0; d.z = -22 * hz; d.vx = d.vz = 0; d.hold = 2; u.x = 0.3; u.z = -25.4 * hz; u.face = Math.atan2(0, hz); m8.x = -20; m8.z = 0; G.shotClock = 1.2; }
    if (SCENE.startsWith('c-')) { G.ball.holder = m8; G.poss = u.team; d.x = 30; m8.x = -25; u.celebK = SCENE.slice(2); u.celebT = 9; u.pose = u.celebK; }
    window._S = { G, u, d, m8, hz, n: 0 };
    PB.Game.dbg.run(0.05);
    window._cam = () => { const a = VIEW === 'front' ? 0 : VIEW === 'back' ? Math.PI : Math.PI / 2, fx = Math.sin(u.face + a), fz = Math.cos(u.face + a), h = (u.ht || 78) / 12;
      PB.R.studio = [u.x + fx * 13, h * 0.8 + 1.5, u.z + fz * 13, u.x, h * 0.62 + u.y * 0.5, u.z]; };
    window._cam();
  }, [SCENE, VIEW]);
  const act = n => pg.evaluate(([SCENE, n, DT]) => { const { G, u, d, m8, hz } = window._S, D = PB.Game.dbg;
    if (n === 1) { if (SCENE === 'fake') { D.press('A', true); D.run(0.08); D.press('A', false); } else if (SCENE === 'shot' || SCENE === 'layup' || SCENE === 'dunk') { D.press('A', true); }
      else if (SCENE.startsWith('m-')) { u.moveCd = 0; D.press('C', true, SCENE.slice(2), SCENE.slice(2) === 'cross' ? 1 : 0); }
      else if (SCENE === 'pass') D.press('B');
      else if (SCENE === 'sizeup') { d.x = 0; d.z = u.z + 8 * hz; u.sizeN = 0.1; }
      else if (SCENE === 'run') D.stick(0, -1); else if (SCENE === 'slide') D.stick(1, 0); else if (SCENE === 'block') { G.ball.holder = d; d.face = Math.atan2(u.x - d.x, u.z - d.z); } }
    if ((SCENE === 'shot' || SCENE === 'layup' || SCENE === 'dunk') && u.shoot && u.shoot.t / u.shoot.T > 0.8) D.press('A', false);
    if (n > 0) D.run(DT); window._dt = DT; window._cam(); if (SCENE.startsWith('c-')) { G.ball.holder = m8; m8.x = -25; d.x = 30; u.vx = u.vz = 0; u.celebT = 9; u.pose = u.celebK; }
    if (SCENE === 'hands') { G.shotClock = Math.min(G.shotClock, 1.2); for (const p of G.pl) if (p !== u && p !== d) { p.x = 44; p.z = 44 * hz; } }
    if (SCENE === 'sizeup') { d.x = 0; d.z = u.z + 8 * hz; d.vx = d.vz = 0; }
    return [n, u.pose, u.shoot ? +(u.shoot.t / u.shoot.T).toFixed(2) : null, +u.y.toFixed(1), G.ball.state, +G.ball.y.toFixed(1), d.pose, +d.y.toFixed(1)]; }, [SCENE, n, +DT]);
  require('fs').mkdirSync('.shots', { recursive: true }); const files = [], log = [];
  for (let n = 0; n < +NF; n++) { log.push(await act(n)); await pg.waitForTimeout(350); const f = `.shots/step-${SCENE}-${VIEW}-${String(n).padStart(2, '0')}.png`; await pg.screenshot({ path: f, clip: { x: 0, y: 222, width: 390, height: 400 } }); files.push(f); }
  console.log(JSON.stringify(log)); console.log('errors', errs); await b.close();
  execFileSync('node', [require('path').join(__dirname, 'montage.js'), `.shots/step-${SCENE}-${VIEW}.png`, COLS, ...files]); console.log(`.shots/step-${SCENE}-${VIEW}.png`); process.exit(0);
})();
