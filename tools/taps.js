/* A new player's first session in Safari's engine, with real touches at the buttons' places: a button that is covered, off the
   screen or still moving fails here (disabled upgrade buttons are expected in the list). node tools/taps.js ["iPhone SE"] */
const { webkit, devices } = require('playwright');
(async () => {
  const b = await webkit.launch(); const ctx = await b.newContext({ ...devices[process.argv[2] || 'iPhone 13'] }); const pg = await ctx.newPage(); const errs = [], fails = [];
  pg.on('pageerror', e => errs.push(e.message)); pg.on('dialog', d => d.accept());
  const srv = await require('./serve-test').serve(); await pg.goto(srv.url);
  const tap = async (sel, name) => { try { await pg.tap(sel, { timeout: 4000 }); await pg.waitForTimeout(450); return true; } catch (e) { fails.push((name || sel) + ': ' + e.message.split('\n').filter(l => /intercepts|not visible|outside|Timeout/.test(l)).slice(0, 2).join(' | ').slice(0, 200)); return false; } };
  await pg.waitForTimeout(700);                         // a new visitor: the page has just appeared
  await tap('#how', 'how to play (early)'); await tap('#bk', 'back'); await tap('#set', 'settings'); await tap('#bk', 'back from settings');
  await tap('#newc', 'new career'); await pg.fill('#fn', 'Tap'); await pg.fill('#ln', 'Test');
  for (const s of await pg.$$eval('#screen .seg button, #screen .opt button, #screen select', es => es.slice(0, 0).map(e => e.id))) await tap('#' + s);
  for (let k = 0; k < 12 && !(await pg.$('#play')); k++) { if (await pg.evaluate(() => PB.Game.active && PB.Game.dbg.state() && PB.Game.dbg.state().park)) { await pg.evaluate(() => PB.Game.dbg.parkGo('career')); await pg.waitForTimeout(400); } if (await pg.$('#skip')) await tap('#skip', 'skip'); if (await pg.$('.ans')) await tap('.ans', 'answer'); await tap('#go', 'go ' + k); }
  for (const t of await pg.$$eval('.tabs button', bs => bs.map(x => x.dataset.t))) await tap(`.tabs button[data-t="${t}"]`, 'tab ' + t);
  await tap('.tabs button[data-t="player"]', 'player tab');
  const ups = await pg.$$('#screen button'); let tried = 0; for (const u of ups.slice(0, 40)) { const box = await u.boundingBox(); if (!box || box.y < 0 || box.y > 760) continue; const tx = (await u.textContent()).trim().slice(0, 16); try { await u.tap({ timeout: 2500, trial: true }); tried++; } catch (e) { fails.push('player tab button "' + tx + '": ' + e.message.split('\n').filter(l => /intercepts/.test(l)).slice(0, 1).join('').slice(0, 160)); } }
  await tap('.tabs button[data-t="home"]', 'home tab'); await tap('#play', 'play'); await pg.waitForTimeout(1500);
  await pg.tap('#game', { position: { x: 195, y: 400 }, timeout: 3000 }).catch(() => {});      // skip the lineups
  await pg.waitForFunction(() => PB.Game.active && PB.Game.dbg.state() && PB.Game.dbg.state().phase === 'live', null, { timeout: 120000 }).catch(() => fails.push('NEVER LIVE'));
  await pg.waitForTimeout(1500);
  for (const id of await pg.$$eval('#game button', bs => bs.filter(x => x.offsetParent && x.id).map(x => x.id))) { try { await pg.tap('#' + id, { timeout: 2500, trial: true }); } catch (e) { fails.push('in-game #' + id + ': ' + e.message.split('\n').filter(l => /intercepts|not visible|outside/.test(l)).slice(0, 1).join('').slice(0, 160)); } }
  await tap('#pz', 'pause'); for (const id of await pg.$$eval('#pause button', bs => bs.filter(x => x.offsetParent && x.id).map(x => x.id))) { try { await pg.tap('#' + id, { timeout: 2500, trial: true }); } catch (e) { fails.push('pause #' + id + ': ' + e.message.split('\n').filter(l => /intercepts|not visible|outside/.test(l)).slice(0, 1).join('').slice(0, 160)); } }
  console.log('trial taps on the player tab', tried); console.log('failed taps', JSON.stringify(fails, null, 1)); console.log('errors', errs.slice(0, 5)); await b.close(); process.exit(0);
})();
