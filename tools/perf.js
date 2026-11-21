/* What a frame costs: draw calls, triangles, geometries and the time PB.R.render takes (software GL, so only compare
   runs against each other) in the park and in an arena game.   node tools/perf.js [day|dusk|night] */
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const srv = await require('./serve-test').serve();
  const measure = pg => pg.evaluate(() => { const G = PB.Game.dbg.state(); const was = G.paused; G.paused = true; const t0 = performance.now(); let n = 0; for (; n < 40; n++) PB.R.render(); const ms = (performance.now() - t0) / n; G.paused = was; return Object.assign({ ms: +ms.toFixed(1) }, PB.R.info()); });
  for (const gfx of ['High', 'Low']) {
    const pg = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true }); pg.on('dialog', d => d.accept()); pg.on('pageerror', e => console.log('PAGE', e.message));
    await pg.goto(srv.url); await pg.waitForFunction(() => window.PB && PB.R && PB.R.modelReady && PB.R.modelReady(), null, { timeout: 60000 });
    await pg.evaluate(([g, t]) => { localStorage.setItem('pbb.tut', '2'); PB.settings.gfx = g; if (t) PB.parkTime = t; }, [gfx, process.argv[2]]);
    const click = async s => { if (await pg.$(s)) { await pg.evaluate(q => document.querySelector(q).click(), s); await pg.waitForTimeout(300); } };
    await click('#newc'); await pg.fill('#fn', 'Perf'); await pg.fill('#ln', 'Check'); for (let i = 0; i < 4 && (await pg.$('#go')); i++) await click('#go');
    await pg.waitForFunction(() => PB.Game.active && PB.Game.dbg.state() && PB.Game.dbg.state().park, null, { timeout: 60000 }); await pg.waitForTimeout(1500);
    for (const [x, z, f] of [[0, -20, 0], [-12, 14, -1.57], [14, -16, 1.57], [0, 25, 3.14]]) { await pg.evaluate(([x, z, f]) => { const u = PB.Game.dbg.state().user; u.x = x; u.z = z; u.face = f; PB.R.parkYaw(f); }, [x, z, f]); await pg.waitForTimeout(1500);
      console.log(gfx.padEnd(5), 'park ', JSON.stringify(await measure(pg))); }
    await pg.evaluate(() => PB.Game.stop && PB.Game.stop()); await pg.close();
    const p2 = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true }); p2.on('dialog', d => d.accept()); p2.on('pageerror', e => console.log('PAGE', e.message));
    await p2.goto(srv.url); await p2.waitForFunction(() => window.PB && PB.R && PB.R.modelReady && PB.R.modelReady(), null, { timeout: 60000 });
    await p2.evaluate(g => { PB.settings.gfx = g; }, gfx);
    await p2.click('#qg'); await p2.waitForTimeout(400); await p2.click('#go');
    await p2.waitForFunction(() => PB.Game.active && PB.Game.dbg.state() && PB.Game.dbg.state().phase === 'live', null, { timeout: 90000 }); await p2.waitForTimeout(1000);
    console.log(gfx.padEnd(5), 'arena', JSON.stringify(await measure(p2))); await p2.close();
  }
  await b.close(); process.exit(0);
})();
