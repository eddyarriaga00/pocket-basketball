/* Drill test: a new career's pre-draft combine and an All-Star 3-point contest, shot by shot with the Shoot button.
   node tools/drill.js   (prints both results and any page errors) */
const { chromium } = require('playwright');
(async () => {
  const { serve } = require('./serve-test'); const s = await serve();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; pg.on('pageerror', e => errs.push('PAGE ' + e.message)); pg.on('dialog', d => d.accept());
  await pg.goto(s.url); await pg.evaluate(() => localStorage.clear()); await pg.reload();
  await pg.waitForFunction(() => window.PB && PB.R && PB.R.modelReady && PB.R.modelReady(), { timeout: 30000 });
  await pg.click('#newc'); await pg.fill('#fn', 'Drill'); await pg.fill('#ln', 'Tester'); await pg.click('#go');
  await pg.screenshot({ path: require('os').tmpdir() + '/d0.png' });
  const shootLoop = async (tag) => {
    let shots = 0;
    for (let i = 0; i < 400; i++) {
      const st = await pg.evaluate(() => { const G = PB.Game.dbg.state(); return { act: PB.Game.active, held: G.ball.holder === G.user && !G.user.shoot && G.ball.state === 'held' }; });
      if (!st.act) break;
      if (st.held) { await pg.evaluate(() => PB.Game.dbg.press('A', true)); await pg.waitForTimeout(560); await pg.evaluate(() => PB.Game.dbg.press('A', false)); shots++; if (shots === 3) await pg.screenshot({ path: require('os').tmpdir() + `/${tag}.png` }); }
      await pg.waitForTimeout(120);
    }
    return shots;
  };
  await pg.click('#go');
  console.log('combine shots', await shootLoop('d1'));
  await pg.waitForSelector('#go'); console.log('combine result:', (await pg.textContent('#screen')).replace(/\s+/g, ' ').slice(0, 420));
  await pg.click('#go'); await pg.click('#go');   // draft night -> hub
  await pg.evaluate(() => { const C = PB.Career.get(); C.contest = 'invited'; PB.Career.hub(); });
  await pg.click('#contest');
  console.log('contest shots', await shootLoop('d2'));
  await pg.waitForSelector('#go'); console.log('contest result:', (await pg.textContent('#screen')).replace(/\s+/g, ' ').slice(0, 220));
  await pg.click('#go');
  console.log('errors', errs);
  s.close(); await b.close();
})();
