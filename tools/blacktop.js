/* The blacktop, simulated: 1v1, 2v2 and 3v3, by 2s and 3s and by 1s and 2s, the computer on both sides and random input: every
   game must end at its target, the box score must add up, nobody leaves the half court or jumps across it. node tools/blacktop.js */
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const pg = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true }); const errs = []; pg.on('pageerror', e => errs.push(e.message + ' ' + (e.stack || '').split('\n')[1])); pg.on('dialog', d => d.accept());
  const srv = await require('./serve-test').serve(); await pg.goto(srv.url);
  await pg.waitForFunction(() => window.PB && PB.R && PB.R.modelReady && PB.R.modelReady(), null, { timeout: 60000 });
  for (const [n, mode, ones] of [[1, 'auto', false], [2, 'input', false], [3, 'auto', false], [3, 'input', true]]) {
    await pg.evaluate(([n, ones]) => { const A = PB.team('LAK'), B = PB.team('BOS'), tk = new Set(), fa = PB.makeRoster(78, tk), fb = PB.makeRoster(78, tk), slots = [[0], [0, 4], [0, 1, 4]][n - 1];
      window._end = null; PB.Game.start({ teams: [A, B], rosters: [slots.map(s => fa[s]), slots.map(s => fb[s])], slots, userId: fa[0].id, half: true, target: 21, ones, level: 'Pro', strength: [78, 78], onEnd: r => { window._end = r; } }); }, [n, ones]);
    await pg.waitForTimeout(3000); console.log('state', await pg.evaluate(() => [PB.Game.active, !!PB.Game.dbg.state(), PB.Game.dbg.state() && PB.Game.dbg.state().phase].join(' '))); if (errs.length) { console.log(errs); break; }
    const r = await pg.evaluate((mode) => { const D = PB.Game.dbg, G = D.state(), bad = {}, lastP = new Map(); let lastCut = -9; let k = 0, seed = 3, maxZ = 99, poss = 0, last = null, waved = 0, checks = 0; const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
      if (mode === 'auto') D.auto(true); G.paused = true;
      while (k++ < 60 * 60 * 30 && PB.Game.active && D.state().phase !== 'end') {
        if (mode === 'input' && k % 30 === 0) { D.stick(rnd() * 2 - 1, rnd() * 2 - 1); const c = rnd(); if (c < 0.1) D.press('A', true); else if (c < 0.3) D.press('A', false); else if (c < 0.4) D.press('B'); }
        const ph = G.phase; D.run(1 / 60); if (ph !== 'check' && G.phase === 'check') checks++;
        if (G.cutT !== undefined && G.t - G.cutT < 0.05) lastCut = G.t; for (const p of G.pl) { maxZ = Math.min(maxZ, p.z); if (![p.x, p.z].every(Number.isFinite)) bad.nan = 1; const l = lastP.get(p); if (l && Math.hypot(p.x - l[0], p.z - l[1]) > 1.4 && G.t - lastCut > 0.1) bad.jump = (bad.jump || 0) + 1; lastP.set(p, [p.x, p.z]); }
        if (G.phase === 'live' && G.ball.state === 'loose') { last = (last || 0) + 1 / 60; if (last > 8) bad.looseLong = (bad.looseLong || 0) + 1; } else last = 0; }
      const tot = t => G.pl.filter(p => p.team === t).reduce((a, p) => a + p.st.pts, 0);
      return { mode, phase: G.phase, score: G.score, box: [tot(0), tot(1)], secs: Math.round(G.t), minZ: +maxZ.toFixed(1), checks, bad }; }, mode);
    await pg.waitForTimeout(500);
    console.log(n + 'v' + n, ones ? '1s&2s' : '2s&3s', JSON.stringify(r), 'ended:', !!(await pg.evaluate(() => window._end)), JSON.stringify(await pg.evaluate(() => window._end && window._end.score)));
  }
  console.log('errors', errs.slice(0, 5)); await b.close(); process.exit(0);
})();
