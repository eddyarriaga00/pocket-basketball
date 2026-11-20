/* Random things done in the park for a few minutes (Safari's engine): walking, shooting, moves, the menu and every
   tile in it, fast travel, doors, games started and left by every way out. Any page error, a screen with nothing to
   press, or text reading undefined/NaN is reported.   node tools/parkmonkey.js [steps] [seed] */
const { webkit, devices } = require('playwright');
const STEPS = +(process.argv[2] || 120); let seed = +(process.argv[3] || 7);
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647, pick = a => a[Math.floor(rnd() * a.length)];
(async () => {
  const b = await webkit.launch(); const ctx = await b.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 1 }); const pg = await ctx.newPage();
  const errs = [], odd = []; let last = '';
  pg.on('pageerror', e => errs.push(`[${last}] ${e.message} | ${String(e.stack).split('\n').slice(0, 2).join(' < ')}`)); pg.on('dialog', d => d.accept());
  const srv = await require('./serve-test').serve(); await pg.goto(srv.url);
  await pg.waitForFunction(() => window.PB && PB.R && PB.R.modelReady && PB.R.modelReady(), null, { timeout: 60000 }); await pg.waitForTimeout(500);
  const W = ms => pg.waitForTimeout(ms), has = s => pg.$(s).then(Boolean);
  const click = async s => { if (!(await has(s))) return false; await pg.evaluate(q => { const e = document.querySelector(q); if (e && !e.disabled) e.click(); }, s); await W(300); return true; };
  const inPark = () => pg.evaluate(() => !!(PB.Game.active && PB.Game.dbg.state() && PB.Game.dbg.state().park && !document.querySelector('#game').hidden));
  const inGame = () => pg.evaluate(() => !!(PB.Game.active && !PB.Game.dbg.state().park));
  await click('#newc'); await pg.fill('#fn', 'Park'); await pg.fill('#ln', 'Monkey'); for (let i = 0; i < 4 && await has('#go'); i++) await click('#go');
  await pg.waitForFunction(() => PB.Game.active && PB.Game.dbg.state() && PB.Game.dbg.state().park, null, { timeout: 60000 });
  await pg.evaluate(() => PB.Game.dbg.parkGo('career')); await W(500); await click('#skip'); for (let i = 0; i < 4 && await has('.ans'); i++) { await click('.ans'); await click('#go'); } await click('#go'); await click('#menu');
  /* get back to the park from wherever this is, the way a player would: whatever button is there */
  const home = async () => { for (let i = 0; i < 40 && !(await inPark()); i++) {
      if (await inGame()) { const how = pick(['sim', 'sim', 'pause']); await pg.evaluate(h => { const D = PB.Game.dbg, G = D.state(); if (h === 'sim') { D.auto(true); G.paused = true; let k = 0; while (k++ < 120000 && PB.Game.active && D.state().phase !== 'end') D.run(0.05); } else { document.querySelector('#pz').click(); } }, how); await W(how === 'sim' ? 2500 : 400); if (how === 'pause') await click('#ps'); await W(1500); continue; }
      const btns = await pg.evaluate(() => { const s = document.querySelector('#screen'); return s.hidden ? [] : [...s.querySelectorAll('button')].filter(x => x.offsetParent && !x.disabled).map(x => x.id).filter(Boolean); });
      const want = ['back', 'bk', 'menu', 'done', 'start'].find(x => btns.includes(x)) || (btns.includes('go') ? 'go' : btns[0]);
      if (!want) { if (!(await click('#screen button')) ) { odd.push(`[${last}] a screen with nothing to press: ${(await pg.evaluate(() => document.querySelector('#screen').innerText)).slice(0, 80).replace(/\s+/g, ' ')}`); await pg.evaluate(() => PB.Career.title()); } }
      else await click('#' + want); await W(500); }
    return inPark(); };
  for (let n = 0; n < STEPS; n++) {
    if (!(await home())) { odd.push(`[${last}] could not get back to the park`); break; }
    const act = pick(['walk', 'walk', 'shoot', 'move', 'menu', 'menu', 'travel', 'travel', 'door', 'door', 'regular', 'wheel', 'keys']); last = `${n}:${act}`;
    if (act === 'walk') { await pg.evaluate(([x, y]) => PB.Game.dbg.stick(x, y), [rnd() * 2 - 1, rnd() * 2 - 1]); await W(300 + rnd() * 900); await pg.evaluate(() => PB.Game.dbg.stick(0, 0)); }
    else if (act === 'shoot') { await pg.evaluate(() => PB.Game.dbg.press('A', true)); await W(100 + rnd() * 600); await pg.evaluate(() => PB.Game.dbg.press('A', false)); await W(400); }
    else if (act === 'move') { await pg.evaluate(k => PB.Game.dbg.press('C', true, k, 0), pick(['cross', 'step', 'spin'])); await W(400); }
    else if (act === 'keys') { for (let i = 0; i < 6; i++) await pg.keyboard.press(pick(['k', 'j', 'l', 'u', 'i', 'o', 'Escape', 'p', 'w', 'a', 's', 'd'])); await W(200); if (await pg.evaluate(() => !document.querySelector('#pause').hidden)) await pg.keyboard.press('Escape'); }
    else if (act === 'menu') { await click('#pz'); const ids = await pg.evaluate(() => [...document.querySelectorAll('#pause [data-go], #pause #pmtut, #pause #pmx, #pause #pmres')].map(e => e.dataset.go ? `[data-go="${e.dataset.go}"]` : '#' + e.id)); const s = pick(ids); last += ' ' + s; await pg.evaluate(q => document.querySelector('#pause ' + q).click(), s); await W(900); if (await has('#tutx')) await click('#tutx'); }
    else if (act === 'travel' || act === 'door' || act === 'wheel') { await click('#pz'); const ids = await pg.evaluate(() => [...new Set([...document.querySelectorAll('#pause [data-tr]')].map(e => e.dataset.tr))]); const id = act === 'wheel' ? 'wheel' : pick(ids); last += ' ' + id;
      await pg.evaluate(i => document.querySelector(`#pause [data-tr="${i}"]`).dispatchEvent(new MouseEvent('click', { bubbles: true })), id); await W(800);
      if (act !== 'travel') { await click(rnd() < 0.3 && await has('#parknx') ? '#parknx' : '#parkgo'); await W(900); if (await has('#spin') && rnd() < 0.7) { await click('#spin'); await W(rnd() < 0.5 ? 300 : 3800); } if (await has('#wx')) await click('#wx'); } }
    else if (act === 'regular') { await pg.evaluate(() => { const G = PB.Game.dbg.state(), ps = G.pl.filter(q => q.npc), p = ps[Math.floor(Math.random() * ps.length)], u = G.user; u.x = p.x; u.z = p.z - 3; G.parkAt = 'x'; }); await W(700); await click(rnd() < 0.5 ? '#parkhs' : '#parkgo'); await W(1200); }
    const t = await pg.evaluate(() => [document.querySelector('#screen').hidden ? '' : document.querySelector('#screen').innerText, document.querySelector('#pause').hidden ? '' : document.querySelector('#pause').innerText, document.querySelector('#parkcard').hidden ? '' : document.querySelector('#parkcard').innerText].join(' '));
    const bad = t.match(/undefined|NaN|\[object/); if (bad) odd.push(`[${last}] text: …${t.slice(Math.max(0, bad.index - 40), bad.index + 25).replace(/\s+/g, ' ')}`);
  }
  console.log('steps', STEPS, 'odd', JSON.stringify(odd, null, 1)); console.log('errors', JSON.stringify(errs.slice(0, 12), null, 1)); await b.close(); process.exit(0);
})();
