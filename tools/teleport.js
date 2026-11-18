/* Nobody jumps from one place to another in plain view: games are stepped a tick at a time, and any player (or the
   held ball) who moves more than a stride in one tick, with no cut covering it, is reported with what was going on.
   node tools/teleport.js [games] */
const { chromium } = require('playwright');
const GAMES = +(process.argv[2] || 2);
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const pg = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true }); const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('dialog', d => d.accept());
  const srv = await require('./serve-test').serve();
  for (let g = 0; g < GAMES; g++) {
    await pg.goto(srv.url); await pg.waitForFunction(() => window.PB && PB.R && PB.R.modelReady && PB.R.modelReady(), null, { timeout: 60000 });
    await pg.evaluate(() => { localStorage.setItem('pbb.settings.v1', JSON.stringify({ qlen: 3, replays: false })); }); await pg.reload(); await pg.waitForTimeout(900);
    await pg.click('#qg'); await pg.waitForTimeout(400); await pg.click('#go');
    await pg.waitForFunction(() => PB.Game.active && PB.Game.dbg.state() && PB.Game.dbg.state().phase === 'live', null, { timeout: 90000 });
    const r = await pg.evaluate((mode) => { const D = PB.Game.dbg, G = D.state(), found = {}, last = new Map(); let n = 0, seed = 11; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
      if (mode === 'auto') D.auto(true); G.paused = true; let lastCut = -9, prevPh = G.phase;
      while (n++ < 60 * 60 * 13 && D.state().phase !== 'end' && PB.Game.active) { const ov = document.querySelector('#pause'); if (ov && !ov.hidden) { const h2 = document.querySelector('#h2'); if (h2) h2.click(); G.paused = true; }
        if (mode !== 'auto' && n % 30 === 0) { const a = rnd(); if (a < 0.6) D.stick(rnd() * 2 - 1, rnd() * 2 - 1); else D.stick(0, 0); const c = rnd(); if (c < 0.1) D.press('A', true); else if (c < 0.3) D.press('A', false); else if (c < 0.45) D.press('B'); }
        const ph0 = G.phase; D.run(1 / 60); if (G.cutT === G.t || (G.cutT !== undefined && G.t - G.cutT < 0.05)) lastCut = G.t;
        for (const p of G.pl) { const l = last.get(p); if (l && l.d === p.d) { const d = Math.hypot(p.x - l.x, p.z - l.z);
            if (d > 1.4 && G.t - lastCut > 0.1) { const k = `${ph0}>${G.phase}${p.inb ? ' inbounder' : ''}${G.ball.holder === p ? ' has ball' : ''}${p.isUser ? ' user' : ''}${G.ftq ? ' ft' : ''}`; const e = found[k] || (found[k] = { n: 0, max: 0, t: +G.t.toFixed(1) }); e.n++; e.max = Math.max(e.max, +d.toFixed(1)); if (!e.ex) e.ex = []; if (e.ex.length < 5) e.ex.push([+G.t.toFixed(2), p.name, p.slot, p.team, [+l.x.toFixed(0), +l.z.toFixed(0)], [+p.x.toFixed(0), +p.z.toFixed(0)], p.pose, G.ball.state, G.q, Math.round(G.clock), !!G.inb].join(' ')); } }
          last.set(p, { x: p.x, z: p.z, d: p.d }); } }
      return { mode, t: Math.round(G.t), found }; }, g % 2 ? 'auto' : 'input');
    console.log(`game ${g + 1}`, JSON.stringify(r));
  }
  console.log('errors', errs); await b.close(); process.exit(0);
})();
