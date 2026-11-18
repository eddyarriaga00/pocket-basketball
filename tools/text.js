/* Every screen of a career, game after game (simulated), read for text that should never reach a player: undefined, NaN,
   [object ...], null, long decimals, broken pictures. node tools/text.js [games, default 14] */
const { chromium } = require('playwright');
const N = +(process.argv[2] || 14);
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const pg = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true }); const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('dialog', d => d.accept());
  const srv = await require('./serve-test').serve(); await pg.goto(srv.url);
  await pg.waitForFunction(() => window.PB && PB.R && PB.R.modelReady && PB.R.modelReady(), null, { timeout: 60000 });
  await pg.evaluate(() => localStorage.clear()); await pg.reload(); await pg.waitForTimeout(900);
  const tap = async sel => { if (await pg.$(sel)) { await pg.evaluate(s => document.querySelector(s).click(), sel); await pg.waitForTimeout(250); return true; } return false; };
  const found = {}; const scan = async where => { const hits = await pg.evaluate(() => { const t = document.querySelector('#screen') ? document.querySelector('#screen').innerText : document.body.innerText, out = [];
      for (const m of t.matchAll(/.{0,28}(undefined|NaN|\[object|\bnull\b|Infinity|\(\)|\$\{|  ,| ,[a-z]|\b0\.\d{4,}|\d\.\d{5,}).{0,28}/g)) out.push(m[0].replace(/\s+/g, ' '));
      for (const im of document.querySelectorAll('#screen img')) if (im.complete && !im.naturalWidth && im.src) out.push('broken image ' + im.src.slice(0, 60));
      return out; }); for (const h of hits) { const k = where + ': ' + h; found[k] = (found[k] || 0) + 1; } };
  await tap('#newc'); await pg.fill('#fn', 'Text'); await pg.fill('#ln', 'Scan'); await scan('create');
  for (let k = 0; k < 8 && !(await pg.$('#play')); k++) { await scan('setup' + k); if (await pg.$('#skip')) await tap('#skip'); if (await pg.$('.ans')) await tap('.ans'); await tap('#go'); }
  let games = 0;
  for (let g = 0; g < N; g++) {
    for (const t of await pg.$$eval('.tabs button', bs => bs.map(x => x.dataset.t))) { await tap(`.tabs button[data-t="${t}"]`); await scan('tab ' + t);
      for (const d of await pg.$$('#screen details:not([open]) > summary')) { await d.evaluate(e => e.click()).catch(() => {}); } await scan('tab ' + t + ' opened'); }
    await tap('.tabs button[data-t="home"]');
    if (!(await tap('#sim'))) { await scan('no sim button'); }
    await pg.waitForTimeout(500); await scan('after sim');
    for (let j = 0; j < 14 && !(await pg.$('#sim')) ; j++) { await scan('between ' + j); if (await pg.$('.ans')) await tap('.ans'); (await tap('#go')) || (await tap('#cont')) || (await tap('#next')) || (await tap('#screen button.big')) || (await tap('#screen button.pri')) || (await tap('#screen button')); await pg.waitForTimeout(300); }
    if (await pg.$('#sim')) games++;
  }
  console.log('games simmed', games, 'screen now:', (await pg.evaluate(() => document.querySelector('#screen').innerText.slice(0, 80))).replace(/\s+/g, ' '));
  console.log(JSON.stringify(found, null, 1).slice(0, 3000)); console.log('errors', errs.slice(0, 5)); await b.close(); process.exit(0);
})();
