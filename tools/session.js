/* the second and third game played without reloading the page: do they still look right? node second.js <games> -> .shots/second-<n>.png */
const { chromium } = require('playwright');
const N = +(process.argv[2] || 3); require('fs').mkdirSync('.shots', { recursive: true });
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const pg = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true }); const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ' ' + m.text().slice(0, 140)); }); pg.on('dialog', d => d.accept());
  const srv = await require('./serve-test').serve(); await pg.goto(srv.url);
  await pg.waitForFunction(() => window.PB && PB.R && PB.R.modelReady && PB.R.modelReady(), null, { timeout: 60000 });
  await pg.evaluate(() => { localStorage.setItem('pbb.settings.v1', JSON.stringify({ qlen: 1, replays: false })); }); await pg.reload(); await pg.waitForTimeout(900);
  for (let g = 0; g < N; g++) {
    await pg.waitForFunction(() => document.querySelector('#qg'), null, { timeout: 60000 }); await pg.evaluate(() => document.querySelector('#qg').click()); await pg.waitForTimeout(500); await pg.evaluate(() => document.querySelector('#go').click());
    await pg.waitForFunction(() => PB.Game.active && PB.Game.dbg.state() && PB.Game.dbg.state().phase === 'live', null, { timeout: 120000 });
    await pg.evaluate(() => { const st = document.getElementById('hidehud') || document.createElement('style'); st.id = 'hidehud'; st.textContent = '#game > *:not(canvas){visibility:hidden!important}'; document.head.appendChild(st);
      const G = PB.Game.dbg.state(); PB.Game.dbg.auto(true); PB.R.lock.fov = 60; PB.R.resize(); window._iv = setInterval(() => { const h = G.ball.holder || G.ball, s = h.z > 0 ? 1 : -1; PB.R.studio = [h.x * 0.5 + 9, 7, h.z - s * 17, h.x, 3, h.z + s * 1]; }, 8); });
    await pg.waitForTimeout(3500); await pg.screenshot({ path: `.shots/second-${g}.png`, clip: { x: 0, y: 222, width: 390, height: 400 } });
    console.log('game', g + 1, JSON.stringify(await pg.evaluate(() => PB.R.info())));
    await pg.evaluate(() => { clearInterval(window._iv); PB.R.studio = null; document.getElementById('hidehud').remove(); PB.Game.dbg.simRest(); }); await pg.waitForTimeout(1500);
    await pg.evaluate(() => PB.Career.title()); await pg.waitForTimeout(1200);
  }
  console.log('errors', [...new Set(errs)].slice(0, 6)); await b.close(); process.exit(0);
})();
