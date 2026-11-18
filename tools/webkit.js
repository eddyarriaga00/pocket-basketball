/* The game in Safari's engine (WebKit), as an iPhone: title, a new career, the hub tabs, a game, the final screen.
   Needs Playwright's WebKit (playwright install webkit). node tools/webkit.js -> .shots/wk-*.png */
const { webkit, devices } = require('playwright');
(async () => {
  const b = await webkit.launch();
  const ctx = await b.newContext({ ...devices['iPhone 13'] }); const pg = await ctx.newPage(); const errs = [];
  pg.on('pageerror', e => errs.push('PAGE ' + e.message + ' ' + (e.stack || '').split('\n')[0].slice(0, 120))); pg.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ' ' + m.text().slice(0, 200)); }); pg.on('dialog', d => d.accept());
  const srv = await require('./serve-test').serve(); await pg.goto(srv.url);
  const tap = async sel => { if (await pg.$(sel)) { await pg.evaluate(s => document.querySelector(s).click(), sel); await pg.waitForTimeout(400); return true; } return false; };
  let n = 0; const shot = async name => { await pg.waitForTimeout(600); await pg.screenshot({ path: `.shots/wk-${String(n++).padStart(2, '0')}-${name}.png` }); };
  await pg.waitForFunction(() => window.PB && PB.R && PB.R.modelReady && PB.R.modelReady(), null, { timeout: 60000 }).catch(e => errs.push('MODEL NEVER READY'));
  console.log('webgl', await pg.evaluate(() => { const c = document.createElement('canvas'); const g = c.getContext('webgl2') || c.getContext('webgl'); return g ? g.getParameter(g.VERSION) : 'none'; }), 'rig', await pg.evaluate(() => PB.R._rig));
  await pg.waitForTimeout(1500); await shot('title');
  await tap('#newc'); await pg.fill('#fn', 'Web'); await pg.fill('#ln', 'Kit'); await shot('create');
  for (let k = 0; k < 8 && !(await pg.$('#play')); k++) { if (await pg.$('#skip')) await tap('#skip'); if (await pg.$('.ans')) await tap('.ans'); await tap('#go'); }
  await shot('hub');
  for (const t of await pg.$$eval('.tabs button', bs => bs.map(x => x.dataset.t))) { await tap(`.tabs button[data-t="${t}"]`); await shot('tab-' + t); }
  await tap('.tabs button[data-t="home"]'); await tap('#play'); await pg.waitForTimeout(1500); await shot('intro');
  await pg.waitForFunction(() => PB.Game.active && PB.Game.dbg.state() && PB.Game.dbg.state().phase === 'live', null, { timeout: 120000 }).catch(e => errs.push('NEVER LIVE'));
  await pg.waitForTimeout(2500); await shot('game');
  const fps = await pg.evaluate(() => new Promise(res => { let c = 0; const t0 = performance.now(); const f = () => { c++; if (performance.now() - t0 < 3000) requestAnimationFrame(f); else res(Math.round(c / 3)); }; requestAnimationFrame(f); }));
  console.log('fps', fps, 'quality', JSON.stringify(await pg.evaluate(() => PB.R.quality && PB.R.quality())), 'info', JSON.stringify(await pg.evaluate(() => PB.R.info())));
  await pg.evaluate(() => PB.Game.dbg.auto(true)); await pg.waitForTimeout(8000); await shot('game2');
  await tap('#pz'); await shot('pause'); await tap('#h2') || await pg.evaluate(() => { PB.Game.dbg.state().paused = false; const p = document.querySelector('#pause'); if (p) p.hidden = true; });
  await pg.evaluate(() => PB.Game.dbg.simRest()); await pg.waitForTimeout(6000); await shot('final');
  for (let j = 0; j < 6 && !(await pg.$('#play')); j++) { await tap('#go') || await tap('#cont') || await tap('.btn.pri'); await pg.waitForTimeout(500); }
  console.log('back at hub', !!(await pg.$('#play'))); await shot('hub2');
  console.log('errors', [...new Set(errs)].slice(0, 12)); await b.close(); process.exit(0);
})();
