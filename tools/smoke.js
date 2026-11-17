/* Smoke test: a whole career loop with real input (create, draft, hub, a played game with a stick drag and a held
   shot, upgrades, a simmed season, the league and log tabs). Prints page errors; screenshots go to the temp folder.
   node tools/smoke.js */
const { chromium } = require('playwright');
const OUT = require('os').tmpdir();  /* screenshots go to the temp folder */
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  const pg = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const errs = []; pg.on('pageerror', e => errs.push('PAGE ' + e.message)); pg.on('console', m => { if (m.type() === 'error') errs.push('CON ' + m.text()); });
  pg.on('dialog', d => d.accept());
  const srv = await require('./serve-test').serve();
  await pg.goto(srv.url);
  await pg.evaluate(() => localStorage.clear()); await pg.reload(); await pg.waitForTimeout(500);
  await pg.click('#newc'); await pg.waitForTimeout(200);
  await pg.fill('#fn', 'Eddy'); await pg.fill('#ln', 'Arriaga');
  await pg.click('#pos button[data-v="PG"]'); await pg.waitForTimeout(100);
  await pg.click('.arch button[data-v="Playmaker"]'); await pg.waitForTimeout(100);
  await pg.screenshot({ path: OUT + '/c1-create.png', fullPage: false });
  await pg.click('#go'); await pg.waitForTimeout(300);
  await pg.screenshot({ path: OUT + '/c2-draft.png' });
  await pg.click('#go'); await pg.waitForTimeout(300);
  await pg.screenshot({ path: OUT + '/c3-hub.png' });
  // play a game: test the user's own shot with the stick and the A button
  await pg.click('#play'); await pg.waitForTimeout(2600);
  const st = await pg.evaluate(() => { const G = PB.Game.dbg.state(); return { user: G.user && G.user.d.last, holder: G.ball.holder && G.ball.holder.d.last, phase: G.phase }; });
  console.log('in game', JSON.stringify(st));
  // give the user the ball and shoot with real input
  await pg.evaluate(() => { const G = PB.Game.dbg.state(); G.ball.state = 'held'; G.ball.holder = G.user; G.poss = 0; G.user.hold = 0; G.user.x = 0; G.user.z = 18; });
  await pg.waitForTimeout(400);
  const A = await pg.$('#bA'); const bb = await A.boundingBox();
  await pg.mouse.move(bb.x + 40, bb.y + 40); await pg.mouse.down();
  await pg.waitForTimeout(450);
  await pg.screenshot({ path: OUT + '/c4-meter.png' });
  await pg.waitForTimeout(150);
  await pg.mouse.up();
  await pg.waitForTimeout(200);
  await pg.screenshot({ path: OUT + '/c5-release.png' });
  console.log('rel', await pg.evaluate(() => document.querySelector('#rel').textContent), await pg.evaluate(() => PB.Game.dbg.state().ball.state));
  // stick drag
  const z = await pg.$('#stickzone'); const zb = await z.boundingBox();
  await pg.mouse.move(zb.x + 100, zb.y + 220); await pg.mouse.down(); await pg.mouse.move(zb.x + 150, zb.y + 170, { steps: 5 });
  await pg.waitForTimeout(500);
  await pg.screenshot({ path: OUT + '/c6-stick.png' });
  await pg.mouse.up();
  // finish quickly
  await pg.evaluate(() => { PB.Game.dbg.auto(true); PB.Game.dbg.run(3000); });
  await pg.waitForTimeout(500);
  await pg.screenshot({ path: OUT + '/c7-post.png', fullPage: false });
  await pg.click('#go'); await pg.waitForTimeout(200);
  await pg.click('.tabs button[data-t="player"]'); await pg.waitForTimeout(200);
  await pg.screenshot({ path: OUT + '/c8-player.png' });
  const up = await pg.$('.bar.up button:not([disabled])'); if (up) await up.click();
  await pg.click('.tabs button[data-t="home"]');
  for (let i = 0; i < 25; i++) { const s = await pg.$('#sim'); if (!s) break; await s.click(); await pg.waitForTimeout(60); await pg.click('#go'); await pg.waitForTimeout(60); }
  await pg.screenshot({ path: OUT + '/c9-season.png' });
  await pg.click('#go'); await pg.waitForTimeout(200);
  await pg.click('.tabs button[data-t="league"]'); await pg.waitForTimeout(200);
  await pg.screenshot({ path: OUT + '/c10-league.png' });
  await pg.click('.tabs button[data-t="log"]'); await pg.waitForTimeout(200);
  await pg.screenshot({ path: OUT + '/c11-log.png' });
  console.log('errors', errs.slice(0, 8));
  srv.close(); await b.close();
})();
