/* A monkey at the controls: random input (stick, shoot, pass, moves, takeover) through whole quick games in simulated
   time, one of each control mode. Flags thrown errors, NaNs, players or the ball leaving the building, a stuck clock.
   node tools/monkey.js [games] */
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const pg = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const errs = []; pg.on('pageerror', e => errs.push('PAGE ' + e.message + ' @ ' + (e.stack || '').split('\n')[1])); pg.on('console', m => { if (m.type() === 'error' && !/GL Driver|GPU stall|favicon|404/.test(m.text())) errs.push('CON ' + m.text()); });
  pg.on('dialog', d => d.accept());
  const srv = await require('./serve-test').serve();
  await pg.goto(srv.url);
  await pg.waitForFunction(() => window.PB && PB.R && PB.R.modelReady && PB.R.modelReady(), { timeout: 30000 });
  const GAMES = +(process.argv[2] || 4);
  for (let g = 0; g < GAMES; g++) {
    await pg.goto(srv.url); await pg.waitForFunction(() => window.PB && PB.R && PB.R.modelReady && PB.R.modelReady(), { timeout: 30000 });
    await pg.click('#qg'); await pg.waitForTimeout(200);
    const who = ['0', '2', '4', 'team'][g % 4]; const bt = await pg.$(`#qp button[data-v="${who}"]`); if (bt) await bt.click();
    await pg.click('#go'); await pg.waitForTimeout(800);
    await pg.evaluate(() => { const iv = document.querySelector('#intro'); if (iv && !iv.hidden) iv.click(); });
    const res = await pg.evaluate(async (seed) => {
      let s = seed; const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
      const D = PB.Game.dbg, issues = []; let lastClock = null, lastQ = 0, stuck = 0, steps = 0, phases = {};
      const G0 = D.state(); G0.paused = true;   // we drive time ourselves
      const bad = v => typeof v !== 'number' || !isFinite(v);
      while (steps++ < 60000) {
        const G = D.state(); if (!G || G.phase === 'end' || !PB.Game.active) break;
        if (G.paused && document.querySelector('#pause') && !document.querySelector('#pause').hidden) { const h2 = document.querySelector('#h2'); if (h2) h2.click(); G.paused = true; }
        const r = rnd();
        if (r < 0.5) D.stick(rnd() * 2 - 1, rnd() * 2 - 1); else if (r < 0.56) D.stick(0, 0);
        const a = rnd();
        if (a < 0.10) D.press('A', true); else if (a < 0.2) D.press('A', false);
        else if (a < 0.27) D.press('B');
        else if (a < 0.37) D.press('C', undefined, [undefined, 'cross', 'step', 'spin'][Math.floor(rnd() * 4)], [-1, 0, 1][Math.floor(rnd() * 3)]);
        else if (a < 0.39 && document.querySelector('#tko') && !document.querySelector('#tko').hidden) document.querySelector('#tko').click();
        else if (a < 0.4 && document.querySelector('#bD')) document.querySelector('#bD').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        try { D.run(0.05 + rnd() * 0.25); } catch (e) { issues.push('THROW ' + e.message + ' | ' + String(e.stack).split('\\n')[1]); break; }
        const G2 = D.state(); phases[G2.phase] = (phases[G2.phase] || 0) + 1;
        for (const p of G2.pl) if (bad(p.x) || bad(p.z) || bad(p.y) || bad(p.vx) || bad(p.vz) || bad(p.face)) { issues.push('NaN player ' + p.name + ' phase ' + G2.phase); break; }
        if (bad(G2.ball.x) || bad(G2.ball.y) || bad(G2.ball.z)) issues.push('NaN ball state ' + G2.ball.state);
        for (const p of G2.pl) if (!p.inb && (Math.abs(p.x) > 30 || Math.abs(p.z) > 52 || p.y > 9 || p.y < -0.5)) { issues.push(`out of range ${p.name} ${p.x.toFixed(1)},${p.y.toFixed(1)},${p.z.toFixed(1)} ${G2.phase}`); break; }
        if (G2.ball.y > 40 || G2.ball.y < -2 || Math.abs(G2.ball.x) > 60 || Math.abs(G2.ball.z) > 80) issues.push(`ball away ${G2.ball.state} ${G2.ball.x.toFixed(1)},${G2.ball.y.toFixed(1)},${G2.ball.z.toFixed(1)}`);
        if (G2.clock === lastClock && G2.q === lastQ) { stuck++; if (stuck === 400) issues.push(`clock stuck q${G2.q} ${G2.clock.toFixed(1)} phase ${G2.phase} ball ${G2.ball.state} holder ${G2.ball.holder && G2.ball.holder.name} inb ${!!G2.inb} ft ${!!G2.ftq}`); } else stuck = 0;
        lastClock = G2.clock; lastQ = G2.q;
        if (issues.length > 12) break;
      }
      const G = D.state();
      return { steps, phase: G && G.phase, q: G && G.q, score: G && G.score, active: PB.Game.active, issues: [...new Set(issues)].slice(0, 12), phases, user: G && G.user && { pts: G.user.st.pts, fga: G.user.st.fga, tov: G.user.st.tov, pf: G.user.st.pf } };
    }, 1234 + g * 77);
    await pg.waitForTimeout(400);
    const post = await pg.evaluate(() => ({ screen: !document.querySelector('#screen').hidden, text: (document.querySelector('#screen').innerText || '').slice(0, 60).replace(/\n/g, ' ') }));
    console.log(`game ${g} (${who})`, JSON.stringify(res), JSON.stringify(post));
  }
  console.log('errors', errs.slice(0, 10));
  await b.close(); process.exit(0);
})();
