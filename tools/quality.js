/* the adaptive quality logic against a fake clock: a frame cap from outside (33 ms whatever is drawn) must end back at full
   quality; a phone that speeds up once the outlines go must stay light; a fast phone must never change */
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const srv = await require('./serve-test').serve();
  for (const [name, ms] of [['capped at 30 fps from outside', () => 33.3], ['slow until the outlines go', q => q.level >= 3 ? 15 : 40], ['a little faster at each step', q => [40, 30, 24, 17][q.level]], ['fast phone', () => 16.7], ['hitch at the start, then fast', (q, n) => n < 70 ? 60 : 16.7]]) {
    const pg = await b.newPage({ viewport: { width: 120, height: 260 }, hasTouch: true }); pg.on('dialog', d => d.accept());
    await pg.goto(srv.url); await pg.waitForFunction(() => window.PB && PB.R && PB.R.modelReady && PB.R.modelReady(), null, { timeout: 60000 });
    await pg.click('#qg'); await pg.waitForTimeout(400); await pg.click('#go');
    await pg.waitForFunction(() => PB.Game.active && PB.Game.dbg.state() && PB.Game.dbg.state().phase === 'live', null, { timeout: 90000 });
    const r = await pg.evaluate(src => { const ms = eval(src); PB.Game.dbg.state().paused = true; let fake = 1e6, n = 0; performance.now = () => fake; PB.R._qReset(); const seen = [];
      for (; n < 90 * 7; n++) { fake += ms(PB.R.quality(), n); PB.R.render(); const q = PB.R.quality(); if (!seen.length || seen[seen.length - 1] !== q.level) seen.push(q.level); }
      return { levels: seen.join('>'), end: PB.R.quality(), cap: PB.R.pixelCap(), lite: PB.R.lite() }; }, ms.toString());
    console.log(name.padEnd(34), JSON.stringify(r)); await pg.close();
  }
  await b.close(); process.exit(0);
})();
