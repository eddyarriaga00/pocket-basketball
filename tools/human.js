/* A sensible player at the controls, through whole quick games in simulated time: he brings the ball up, drives or
   pulls up when open, lets go of the shot near the top, passes when he has held it too long, guards his man, jumps at
   shots, reaches when Steal is lit, and shoots his free throws. Looks for what a person would notice: crashes, bad
   numbers, a clock that will not run, and counts everything the game said (toasts and the feed) so odd totals stand out.
   node tools/human.js [games] */
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const pg = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
  const errs = []; pg.on('pageerror', e => errs.push('PAGE ' + e.message + ' @ ' + (e.stack || '').split('\n')[1]));
  pg.on('console', m => { if (m.type() === 'error' && !/GL Driver|GPU stall|favicon|404/.test(m.text())) errs.push('CON ' + m.text()); });
  pg.on('dialog', d => d.accept());
  const srv = await require('./serve-test').serve();
  const GAMES = +(process.argv[2] || 3);
  for (let g = 0; g < GAMES; g++) {
    await pg.goto(srv.url); await pg.waitForFunction(() => window.PB && PB.R && PB.R.modelReady && PB.R.modelReady(), { timeout: 30000 });
    await pg.click('#qg'); await pg.waitForTimeout(200);
    const who = ['0', '1', '4', 'team'][g % 4]; const bt = await pg.$(`#qp button[data-v="${who}"]`); if (bt) await bt.click();
    await pg.click('#go'); await pg.waitForTimeout(800);
    await pg.evaluate(() => { const iv = document.querySelector('#intro'); if (iv && !iv.hidden) iv.click(); });
    const res = await pg.evaluate(async () => {
      const D = PB.Game.dbg, issues = [], said = {}; let steps = 0, stuck = 0, lastClock = null, lastQ = 0, holdT = 0, shotAt = 0, lastToast = '', lastFeed = '';
      D.state().paused = true;
      const bad = v => typeof v !== 'number' || !isFinite(v), hyp = Math.hypot;
      const go = (u, tx, tz, m) => { const B = PB.R.basis(), dx = tx - u.x, dz = tz - u.z, L = hyp(dx, dz) || 1, x = dx / L, z = dz / L; D.stick((x * B.rx + z * B.rz) * (m || 1), -(x * B.fx + z * B.fz) * (m || 1)); };
      const note = (k) => { said[k] = (said[k] || 0) + 1; };
      while (steps++ < 40000) {
        const G = D.state(); if (!G || G.phase === 'end' || !PB.Game.active) break;
        const ov = document.querySelector('#pause'); if (ov && !ov.hidden) { const h2 = document.querySelector('#h2'); if (h2) h2.click(); G.paused = true; }
        const u = G.user, bl = G.ball, hz = u.team === 0 ? 41.75 : -41.75, dHoop = hyp(u.x, hz - u.z);
        if (G.phase === 'ft' && G.ftq && G.ftq.shooter === u) { if (!G.ftMeter) D.press('A', true); else if (G.ftMeter >= 0.8) D.press('A', false); }
        else if (G.phase === 'live') {
          const opp = G.pl.filter(p => p.team !== u.team), nd = opp.reduce((a, p) => { const d = hyp(p.x - u.x, p.z - u.z); return d < a.d ? { d, p } : a; }, { d: 99, p: null });
          if (bl.holder === u) { holdT += 0.05;
            if (u.shoot) { if (u.shoot.t / u.shoot.T >= 0.8) D.press('A', false); }
            else if (u.inb) D.press('B');
            else if (dHoop < 6.5 || (dHoop < 24 && nd.d > 5.5 && holdT > 1.2) || (holdT > 9 && dHoop < 26)) { D.stick(0, 0); D.press('A', true); shotAt = steps; }
            else if (holdT > 6 && steps % 40 === 0) { D.press('B'); }
            else { go(u, 0, hz, 1); if (nd.d < 3.2 && steps % 25 === 0) D.press('C', undefined, 'cross', 0); }
          } else { holdT = 0;
            const off = bl.holder ? bl.holder.team === u.team : G.poss === u.team;
            if (off) { const spot = [u.slot % 2 ? 17 : -17, hz - (hz > 0 ? 1 : -1) * (14 + (u.slot || 0) * 2)]; if (hyp(spot[0] - u.x, spot[1] - u.z) > 2) go(u, spot[0], spot[1], 0.8); else D.stick(0, 0); if (steps % 160 === 0) D.press('B'); }
            else { const man = bl.holder && bl.holder.team !== u.team && hyp(bl.holder.x - u.x, bl.holder.z - u.z) < 14 ? bl.holder : opp.find(p => p.slot === u.slot) || nd.p;
              if (man) { const oz = man.team === 0 ? 41.75 : -41.75, dx = 0 - man.x, dz = oz - man.z, L = hyp(dx, dz) || 1; go(u, man.x + dx / L * 3, man.z + dz / L * 3, 1);
                if (man.shoot && hyp(man.x - u.x, man.z - u.z) < 5 && u.y === 0) D.press('A', true);
                else if (document.querySelector('#bB').classList.contains('lit') && steps % 9 === 0) D.press('B'); } }
          }
        }
        try { D.run(0.05); } catch (e) { issues.push('THROW ' + e.message + ' | ' + String(e.stack).split('\n')[1]); break; }
        const G2 = D.state(), t = document.querySelector('#toast'), tt = t && t.classList.contains('on') ? t.textContent : '';
        if (tt && tt !== lastToast) note('toast: ' + tt.replace(/\d+/g, '#')); lastToast = tt;
        const f = document.querySelector('#feed'), ft = f && f.lastElementChild ? f.lastElementChild.textContent : ''; if (ft && ft !== lastFeed) note('feed: ' + ft.replace(/ · .*/, '').replace(/\d+/g, '#').replace(/^[A-Z][a-z]+ (jumper|three|layup|dunk|hook shot|floater|alley-oop).*/, 'basket ($1)')); lastFeed = ft;
        for (const p of G2.pl) if (bad(p.x) || bad(p.z) || bad(p.y) || bad(p.vx) || bad(p.vz) || bad(p.face)) { issues.push('NaN player ' + p.name + ' phase ' + G2.phase); break; }
        if (bad(G2.ball.x) || bad(G2.ball.y) || bad(G2.ball.z)) issues.push('NaN ball ' + G2.ball.state);
        if (G2.ball.y < -1 || G2.ball.y > 40) issues.push('ball height ' + G2.ball.y.toFixed(1) + ' ' + G2.ball.state);
        if (G2.clock === lastClock && G2.q === lastQ) { stuck++; if (stuck === 900) issues.push(`clock stuck q${G2.q} ${G2.clock.toFixed(1)} phase ${G2.phase} ball ${G2.ball.state} holder ${G2.ball.holder && G2.ball.holder.name} inb ${!!G2.inb}`); } else stuck = 0;
        lastClock = G2.clock; lastQ = G2.q;
        if (issues.length > 10) break;
      }
      const G = D.state(), st = G.user.st, tm = t => G.pl.concat((G.bench && G.bench[t]) || []).filter(p => p.team === t);
      const top = Object.entries(said).sort((a, b) => b[1] - a[1]).slice(0, 34).map(([k, n]) => `${n}x ${k}`);
      return { steps, phase: G.phase, score: G.score, issues: [...new Set(issues)], user: `${st.pts} pts ${st.fgm}/${st.fga} fg ${st.tpm}/${st.tpa} 3p ${st.ftm || 0}/${st.fta || 0} ft ${st.reb} reb ${st.ast} ast ${st.stl} stl ${st.blk} blk ${st.tov} tov ${st.pf} pf`, grade: G.grade && G.grade.toFixed ? +G.grade.toFixed(1) : G.grade, said: top };
    });
    await pg.waitForTimeout(500);
    const post = await pg.evaluate(() => ({ final: !document.querySelector('#screen').hidden, cards: [...document.querySelectorAll('#screen .card h3')].map(h => h.textContent.trim().slice(0, 18)) }));
    console.log(`\ngame ${g} (you play ${who})  ${res.score}  steps ${res.steps}  ${res.phase}\n  you: ${res.user}  grade ${res.grade}\n  issues: ${JSON.stringify(res.issues)}\n  final screen: ${post.final} ${post.cards.join(' | ')}\n  ${res.said.join('\n  ')}`);
  }
  console.log('\nerrors', errs.slice(0, 10));
  await b.close(); process.exit(0);
})();
