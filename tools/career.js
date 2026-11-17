/* Career test: five short seasons (10 games) by simming: the playoffs, awards, the contest, an extension or free
   agency, then a retirement and the Hall of Fame vote. node tools/career.js */
const { chromium } = require('playwright');
(async () => {
  const { serve } = require('./serve-test'); const s = await serve();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; pg.on('pageerror', e => errs.push('PAGE ' + e.message)); pg.on('dialog', d => d.accept());
  await pg.goto(s.url); await pg.evaluate(() => { localStorage.clear(); localStorage.setItem('pbb.settings.v1', JSON.stringify({ season: 10 })); }); await pg.reload();
  await pg.waitForFunction(() => window.PB && PB.Career && document.querySelector('#newc'), { timeout: 120000 });
  await pg.click('#newc'); await pg.fill('#fn', 'Long'); await pg.fill('#ln', 'Career'); await pg.click('#go'); await pg.click('#skip'); await pg.click('#go');
  const log = [];
  for (let i = 0; i < 2000; i++) {
    const y = await pg.evaluate(() => PB.Career.get().year);
    if (y >= 6) break;
    const click = async sel => { if (await pg.$(sel)) { await pg.click(sel); return true; } return false; };
    if (await click('#sim')) { const p = await pg.$('#press .ans'); if (p) await p.click(); await click('#go'); continue; }
    if (await click('#contest')) { // play no shots: let the clock run out
      await pg.waitForFunction(() => !PB.Game.active, null, { timeout: 150000 }); await click('#go'); continue; }
    if (await click('#simpi') || await click('#simrd') || await click('#simpo')) continue;
    if (await pg.$('.offer button')) { log.push('FA y' + y + ': ' + (await pg.textContent('.offer .of b'))); await pg.click('.offer button'); continue; }
    if (await pg.$('#yes')) { log.push('extension y' + y); await pg.click(y % 2 ? '#yes' : '#no'); continue; }
    if (y === 2 && await pg.$('#trade')) { await pg.click('.tabs button[data-t="player"]').catch(() => {}); }
    if (await click('#trade')) { log.push('trade requested y' + y); continue; }
    if (await click('#go')) continue;
    if (await pg.$('.tabs button[data-t="home"]')) { await pg.click('.tabs button[data-t="home"]'); continue; }
    log.push('stuck: ' + (await pg.textContent('#screen')).replace(/\s+/g, ' ').slice(0, 120)); break;
  }
  const c = await pg.evaluate(() => { const C = PB.Career.get(); return { year: C.year, team: C.team, contract: C.contract, earnings: +C.earnings.toFixed(1), trophies: C.trophies.length, ovr: C.me.ovr, age: C.me.age, news: C.news.slice(0, 6) }; });
  console.log(log.join('\n')); console.log(JSON.stringify(c, null, 0));
  await pg.evaluate(() => { const C = PB.Career.get(); C.me.age = 34; C.phase = 'awards'; PB.Career.hub(); });
  await pg.click('#go'); await pg.click('#retire'); await pg.waitForTimeout(300);
  console.log('retire:', (await pg.textContent('#screen')).replace(/\s+/g, ' ').slice(0, 200));
  console.log('errors', errs);
  s.close(); await b.close();
})();
