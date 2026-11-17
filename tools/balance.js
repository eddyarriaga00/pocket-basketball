/* Balance check: plays N full 48-minute games computer against computer (your player on autopilot) without
   drawing, and prints per-team averages next to the real league's. Run after any change to the shot model or the AI.
   Needs Playwright: npm i -g playwright (or run from a folder that has it), then
   node tools/balance.js [games]                                                                                   */
const path = require('path');
const { chromium } = require('playwright');
const REAL = { pts: 114, fga: 89, 'FG%': 47.5, tpa: 35, '3P%': 36, fta: 22, tov: 14, stl: 8, reb: 44, ast: 27 };
(async () => {
  const N = +process.argv[2] || 4;
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  const srv = await require('./serve-test').serve();
  await pg.goto(srv.url);
  await pg.waitForTimeout(500);
  const all = {}, scores = [];
  for (let g = 0; g < N; g++) {
    await pg.evaluate(() => document.querySelector('#qg').click());
    await pg.evaluate(() => document.querySelector('#go').click());
    const r = await pg.evaluate(() => {
      PB.Game.dbg.auto(true);
      const G = PB.Game.dbg.state(); G.qlen = 12; G.clock = 720;
      PB.Game.dbg.run(30000);
      const s = {}; for (const p of G.pl) for (const k in p.st) s[k] = (s[k] || 0) + p.st[k];
      return { score: G.score, s };
    });
    scores.push(r.score.join('-'));
    for (const k in r.s) all[k] = (all[k] || 0) + r.s[k] / N / 2;
    await pg.evaluate(() => { const x = document.querySelector('#go'); if (x) x.click(); });
  }
  const f = x => x.toFixed(1);
  const row = (k, v) => `${k.padEnd(5)} ${f(v).padStart(6)}   real ${String(REAL[k] ?? '').padStart(5)}`;
  console.log('scores:', scores.join('  '));
  for (const k of ['pts', 'fga', 'tpa', 'fta', 'tov', 'stl', 'reb', 'ast']) console.log(row(k, all[k]));
  console.log(row('FG%', all.fgm / all.fga * 100)); console.log(row('3P%', all.tpm / all.tpa * 100));
  if (errs.length) { console.log('page errors:', errs.slice(0, 5)); process.exitCode = 1; }
  srv.close(); await b.close();
})();
