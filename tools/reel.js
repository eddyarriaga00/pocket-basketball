/* The highlight reel saved as a video: two test highlights, then "Save as video", and the file that comes back.
   node tools/reel.js [webkit|chromium] */
const pw = require('playwright'); const ENG = process.argv[2] || 'webkit';
(async () => {
  const b = await pw[ENG].launch(ENG === 'chromium' ? { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } : {});
  const pg = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true }); const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('console', m => { if (m.type() === 'error') errs.push('console ' + m.text().slice(0, 160)); }); pg.on('dialog', d => d.accept());
  const srv = await require('./serve-test').serve(); await pg.goto(srv.url);
  await pg.waitForFunction(() => window.PB && PB.R && PB.R.modelReady && PB.R.modelReady(), null, { timeout: 60000 });
  await pg.evaluate(() => { localStorage.setItem('pbb.settings.v1', JSON.stringify({ qlen: 2, replays: false })); }); await pg.reload(); await pg.waitForTimeout(900);
  await pg.click('#qg'); await pg.waitForTimeout(400); await pg.click('#go');
  await pg.waitForFunction(() => PB.Game.active && PB.Game.dbg.state() && PB.Game.dbg.state().phase === 'live', null, { timeout: 90000 });
  await pg.evaluate(() => PB.Game.dbg.auto(true)); await pg.waitForTimeout(5000); await pg.evaluate(() => PB.Game.dbg.reelNow('Test one')); await pg.waitForTimeout(4500); await pg.evaluate(() => PB.Game.dbg.reelNow('Test two')); await pg.waitForTimeout(1500);
  await pg.evaluate(() => { const G = PB.Game.dbg.state(); let n = 0; while (G.phase !== 'end' && n++ < 30000) PB.Game.dbg.run(0.25); });
  await pg.waitForTimeout(4000);
  console.log('has reel button', !!(await pg.$('#reel')), 'save button', !!(await pg.$('#reelsave')), 'MediaRecorder', await pg.evaluate(() => !!window.MediaRecorder), 'types', await pg.evaluate(() => window.MediaRecorder ? ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'].filter(t => MediaRecorder.isTypeSupported(t)) : []));
  if (await pg.$('#reelsave')) { await pg.click('#reelsave'); await pg.waitForTimeout(3000); await pg.screenshot({ path: `.shots/reel-${ENG}.png` });
    const ok = await pg.waitForFunction(() => window.__lastVideo || (document.querySelector('#reelsave') && /Could not/.test(document.querySelector('#reelsave').textContent)), null, { timeout: 150000 }).then(() => 1).catch(() => 0);
    console.log('finished', ok, JSON.stringify(await pg.evaluate(() => window.__lastVideo ? { size: window.__lastVideo.size, type: window.__lastVideo.type } : { text: document.querySelector('#reelsave') && document.querySelector('#reelsave').textContent }))); }
  console.log('errors', errs.slice(0, 6)); await b.close(); process.exit(0);
})();
