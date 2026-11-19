/* The way into the park with real touches (Safari's engine, an iPhone): a player exists, the page opens on the start
   screen, Tap to start; the controls must be on screen, a drag on the stick must move him and a tap on Menu must open
   it. Then the same from the career's Park button and from a page's back button.
   (The start screen's 3D player once left the controls hidden in the park: scripted clicks never noticed.)
   node tools/start.js [device] */
const { webkit, devices } = require('playwright');
(async () => {
  const b = await webkit.launch(); const ctx = await b.newContext({ ...devices[process.argv[2] || 'iPhone 13'] }); const pg = await ctx.newPage();
  const errs = [], fails = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('dialog', d => d.accept());
  const ok = (c, w) => { console.log((c ? 'PASS ' : 'FAIL ') + w); if (!c) fails.push(w); };
  const srv = await require('./serve-test').serve(); await pg.goto(srv.url);
  await pg.waitForFunction(() => window.PB && PB.R && PB.R.modelReady && PB.R.modelReady(), null, { timeout: 60000 }); await pg.waitForTimeout(500);
  const click = async sel => { if (await pg.$(sel)) { await pg.evaluate(s => document.querySelector(s).click(), sel); await pg.waitForTimeout(300); return true; } return false; };
  const waitPark = () => pg.waitForFunction(() => PB.Game.active && PB.Game.dbg.state() && PB.Game.dbg.state().park && !document.querySelector('#game').hidden, null, { timeout: 60000 }).then(() => true).catch(() => false);
  /* the controls are really there: shown, opaque, and the thing under their middle */
  const controls = () => pg.evaluate(() => ['#stickzone', '#bA', '#bC', '#pz', '#radar'].map(s => { const e = document.querySelector(s), r = e.getBoundingClientRect(), cs = getComputedStyle(e); const top = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
    let op = 1; for (let n = e; n && n !== document.body; n = n.parentElement) op *= +getComputedStyle(n).opacity; const touch = cs.pointerEvents === 'none' || top === e || e.contains(top);   // (the minimap takes no touches: only its looks count)
    return `${s}:${r.width > 0 && cs.display !== 'none' && cs.visibility !== 'hidden' && op > 0.9 && touch ? 'ok' : 'HIDDEN'}`; }).join(' '));
  const realMove = async () => { const z = await (await pg.$('#stickzone')).boundingBox(); const u0 = await pg.evaluate(() => { const u = PB.Game.dbg.state().user; return [u.x, u.z]; });
    await pg.mouse.move(z.x + 80, z.y + z.height - 120); await pg.mouse.down(); await pg.mouse.move(z.x + 80, z.y + z.height - 200, { steps: 6 }); await pg.waitForTimeout(1200); await pg.mouse.up(); await pg.waitForTimeout(300);
    const u1 = await pg.evaluate(() => { const u = PB.Game.dbg.state().user; return [u.x, u.z]; }); return Math.hypot(u1[0] - u0[0], u1[1] - u0[1]); };
  /* a player, then a reload: the start screen */
  await click('#newc'); await pg.fill('#fn', 'Start'); await pg.fill('#ln', 'Screen'); for (let i = 0; i < 4 && (await pg.$('#go')); i++) await click('#go');
  await waitPark();
  for (const via of ['start screen', 'start screen again', 'hub Park button', 'a page back button']) {
    if (via.startsWith('start')) { await pg.reload(); await pg.waitForFunction(() => window.PB && PB.R && PB.R.modelReady && PB.R.modelReady(), null, { timeout: 60000 }); await pg.waitForTimeout(1500); await pg.tap('#start'); }
    else if (via === 'hub Park button') { await pg.evaluate(() => PB.Game.dbg.parkGo('career')); await pg.waitForTimeout(800); await pg.tap('#bk'); }
    else { await pg.evaluate(() => PB.Game.dbg.parkGo('how')); await pg.waitForTimeout(800); await pg.tap('#bk'); }
    ok(await waitPark(), `${via}: in the park`); await pg.waitForTimeout(1500);
    const c = await controls(); ok(!c.includes('HIDDEN'), `${via}: controls on screen (${c})`);
    ok(await pg.evaluate(() => !document.querySelector('#game').classList.contains('show')), `${via}: no leftover showcase`);
    if (await pg.$('#tutx:not([hidden])')) { try { await pg.tap('#tutx', { timeout: 2000 }); } catch (e) { /* none */ } }
    const d = await realMove(); ok(d > 4, `${via}: a real drag on the stick moves him (${d.toFixed(1)} ft)`);
    await pg.tap('#pz'); await pg.waitForTimeout(400); ok(await pg.evaluate(() => !document.querySelector('#pause').hidden), `${via}: a real tap on Menu opens it`);
    await pg.tap('#pmx'); await pg.waitForTimeout(400);
  }
  console.log('FAILS', fails.length, JSON.stringify(fails)); console.log('errors', errs); await b.close(); process.exit(0);
})();
