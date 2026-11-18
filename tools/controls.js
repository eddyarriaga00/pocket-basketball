/* The controls in Safari's engine with real pointer input: the stick moves you, Shoot held and let go shoots, a quick tap
   fakes, Pass passes. node tools/controls.js */
const { webkit, devices } = require('playwright');
(async () => {
  const b = await webkit.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'] }); const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('dialog', d => d.accept());
  const srv = await require('./serve-test').serve(); await pg.goto(srv.url);
  await pg.waitForFunction(() => window.PB && PB.R && PB.R.modelReady && PB.R.modelReady(), null, { timeout: 60000 }); await pg.waitForTimeout(800);
  await pg.tap('#qg'); await pg.waitForTimeout(500); await pg.tap('#go'); await pg.waitForTimeout(1500); await pg.tap('#game', { position: { x: 195, y: 400 } }).catch(() => {});
  await pg.waitForFunction(() => PB.Game.active && PB.Game.dbg.state() && PB.Game.dbg.state().phase === 'live', null, { timeout: 120000 });
  const st = () => pg.evaluate(() => { const G = PB.Game.dbg.state(), u = G.user; return { has: G.ball.holder === u, x: +u.x.toFixed(1), z: +u.z.toFixed(1), shoot: u.shoot ? u.shoot.kind : null, pose: u.pose, ball: G.ball.state, fake: u.fakeT !== undefined ? +(G.t - u.fakeT).toFixed(2) : null, fga: u.st.fga, phase: G.phase }; });
  const give = () => pg.evaluate(() => { const G = PB.Game.dbg.state(), u = G.user, hz = u.team === 0 ? 1 : -1; for (const p of G.pl) p.shoot = null; G.phase = 'live'; G.ball.holder = u; G.ball.state = 'held'; G.poss = u.team; u.x = 0; u.z = 18 * hz; u.y = 0; u.vx = u.vz = 0; u.inb = false; G.shotClock = 20; G.clock = 100; for (const p of G.pl) if (p.team !== u.team) { p.x = 20; p.z = -30 * hz; } });
  const box = async sel => { const e = await pg.$(sel); return e ? await e.boundingBox() : null; };
  await give(); await pg.waitForTimeout(300); const a = await st();
  const z = await box('#stickzone'); const sx = z.x + z.width * 0.4, sy = z.y + z.height * 0.6;
  await pg.mouse.move(sx, sy); await pg.mouse.down(); await pg.mouse.move(sx + 50, sy - 10, { steps: 4 }); await pg.waitForTimeout(900); const m = await st(); await pg.mouse.up();
  console.log('stick drag right: moved', +(Math.hypot(m.x - a.x, m.z - a.z)).toFixed(1), 'ft', JSON.stringify(m));
  await give(); await pg.waitForTimeout(300); const btns = await pg.$$eval('#game button', bs => bs.filter(x => x.offsetParent).map(x => [x.id, x.textContent.trim().slice(0, 10)])); console.log('buttons', JSON.stringify(btns));
  const shootId = (btns.find(x => /Shoot/.test(x[1])) || [])[0], passId = (btns.find(x => /Pass/.test(x[1])) || [])[0];
  const sb = await box('#' + shootId); const fga0 = (await st()).fga;
  await pg.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2); await pg.mouse.down(); await pg.waitForTimeout(260); const h = await st(); await pg.waitForTimeout(260); await pg.mouse.up(); await pg.waitForTimeout(700); const s2 = await st();
  console.log('hold Shoot: while held', JSON.stringify({ shoot: h.shoot, pose: h.pose }), 'after release', JSON.stringify({ ball: s2.ball, fga: s2.fga - fga0 }));
  await pg.waitForTimeout(1500); await give(); await pg.waitForTimeout(300);
  await pg.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2); await pg.mouse.down(); await pg.waitForTimeout(40); await pg.mouse.up(); await pg.waitForTimeout(150); const f = await st();
  console.log('quick tap on Shoot: fake', f.fake, 'still has ball', f.has, 'shoot', f.shoot);
  await pg.waitForTimeout(900); await give(); await pg.waitForTimeout(300); if (passId) { await pg.tap('#' + passId); await pg.waitForTimeout(250); const p2 = await st(); console.log('Pass: ball', p2.ball, 'has', p2.has); }
  console.log('errors', errs); await b.close(); process.exit(0);
})();
