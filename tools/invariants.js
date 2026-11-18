/* computer-played games stepped fast, the game's state checked every twentieth of a second for things that must never
   happen (the ball under the floor, a player stuck in the air, a score that goes down, a box score that does not add up ...).
   node tools/invariants.js [games]  ->  one line a game; "bad" should be empty but for a tick or two of "two players in one spot" */
const { chromium } = require('playwright');
const GAMES = +(process.argv[2] || 2);
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const pg = await b.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true }); const errs = []; pg.on('pageerror', e => errs.push(e.message)); pg.on('dialog', d => d.accept());
  const srv = await require('./serve-test').serve();
  for (let g = 0; g < GAMES; g++) {
    await pg.goto(srv.url); await pg.waitForFunction(() => window.PB && PB.R && PB.R.modelReady && PB.R.modelReady(), null, { timeout: 60000 });
    await pg.evaluate(() => { localStorage.setItem('pbb.settings.v1', JSON.stringify({ qlen: 6, replays: false })); }); await pg.reload(); await pg.waitForTimeout(900);
    await pg.click('#qg'); await pg.waitForTimeout(400); await pg.click('#go');
    await pg.waitForFunction(() => PB.Game.active && PB.Game.dbg.state() && PB.Game.dbg.state().phase === 'live', null, { timeout: 90000 });
    const r = await pg.evaluate(() => {
      PB.Game.dbg.auto(true); const G = PB.Game.dbg.state(), bad = {}, note = (k, d) => { const e = bad[k] || (bad[k] = { n: 0, first: d }); e.n++; };
      const air = new Map(), still = new Map(); let lastFeed = '', blockBy = -1; let prevState = '', lastBlk = 0, blockT = -9, lastScore = [0, 0], held = 0, deadT = 0, n = 0, loose = 0, lastT = G.t;
      for (; n < 60000 && G.phase !== 'end'; n++) {
        PB.Game.dbg.run(0.05); PB.R.update(G, 0.05);   // the bones too: the ball leaves from the model's hands
        const bl = G.ball, t = +G.t.toFixed(1), q = G.q, ph = G.phase;
        if (![bl.x, bl.y, bl.z].every(Number.isFinite)) note('ball not a number', { t, q, st: bl.state });
        if (bl.y < -0.5) note('ball under the floor', { t, q, y: +bl.y.toFixed(1), st: bl.state });
        if (bl.y > 40) note('ball in the rafters', { t, q, y: +bl.y.toFixed(1), st: bl.state });
        if (Math.abs(bl.x) > 40 || Math.abs(bl.z) > 62) note('ball out of the building', { t, q, x: +bl.x.toFixed(0), z: +bl.z.toFixed(0), st: bl.state });
        for (const p of G.pl) {
          if (![p.x, p.y, p.z, p.vx, p.vz].every(Number.isFinite)) note('player not a number', { t, q, who: p.name });
          if (p.y < -0.01) note('player under the floor', { t, who: p.name });
          if (p.y > 0.05) { const a = (air.get(p) || 0) + 0.05; air.set(p, a); if (a > 2.5 && !(p.pose === 'hang')) note('in the air over 2.5 s', { t, q, who: p.name, pose: p.pose, y: +p.y.toFixed(1), ph }); } else air.set(p, 0);
          if (!p.inb && ph === 'live' && (Math.abs(p.x) > 26 || Math.abs(p.z) > 48)) note('player off the floor in live play', { t, q, who: p.name, x: +p.x.toFixed(0), z: +p.z.toFixed(0) });
          if (p.shoot && bl.holder !== p && bl.state === 'held') note('shooting without the ball', { t, q, who: p.name, kind: p.shoot.kind });
          if (p.st.fgm > p.st.fga || p.st.tpm > p.st.tpa || p.st.ftm > p.st.fta) note('more makes than attempts', { t, who: p.name });
        }
        for (let i = 0; i < G.pl.length; i++) for (let j = i + 1; j < G.pl.length; j++) { const a = G.pl[i], c = G.pl[j]; if (ph === 'live' && a.y === 0 && c.y === 0 && Math.hypot(a.x - c.x, a.z - c.z) < 0.6) note('two players in one spot', { t, q, a: a.name, b: c.name }); }
        /* a shot leaves from the hands, up high and in front: never from the knees, never from behind the shooter */
        if (bl.state === 'shot' && prevState !== 'shot' && bl.sy !== undefined) { const sh = G.lastShot && G.lastShot.shooter;
          if (sh) { const fwd = (bl.sx - sh.x) * Math.sin(sh.face) + (bl.sz - sh.z) * Math.cos(sh.face); if (bl.sy < sh.y + (sh.ht || 78) / 12 * 0.45) note('shot released low', { t, q, who: sh.name, y: +bl.sy.toFixed(1), py: +sh.y.toFixed(1) }); if (fwd < -0.6) note('shot released behind the shooter', { t, q, who: sh.name, fwd: +fwd.toFixed(1) }); } }
        prevState = bl.state;
        /* a blocked shot does not count */
        { const top = (document.querySelector('#feed').firstChild || {}).textContent || ''; if (top !== lastFeed) { lastFeed = top; const m = /^(?:Chase-down block|Block) · (.+)$/.exec(top); if (m) { const who = G.pl.find(p => p.name === m[1]); if (who) { blockT = G.t; blockBy = who.team; } } }   // the play-by-play says who blocked it (the stat lines swap on a substitution)
          const sc = G.score[0] > lastScore[0] ? 0 : G.score[1] > lastScore[1] ? 1 : -1; if (sc >= 0 && sc !== blockBy && G.t - blockT < 0.6) note('the blocked team scored right after the block', { t, q }); }
        if (G.score[0] < lastScore[0] || G.score[1] < lastScore[1]) note('score went down', { t, q }); if (G.score[0] - lastScore[0] > 4 || G.score[1] - lastScore[1] > 4) note('more than 4 points at once', { t, q, from: lastScore.join('-'), to: G.score.join('-') }); lastScore = G.score.slice();
        if (bl.state === 'held' && ph === 'live') { held += 0.05; if (bl.holder && held > 26) note('one hold over 26 s', { t, q, who: bl.holder.name }); if (!bl.holder) note('held by nobody', { t, q }); } else held = 0;
        if (bl.state === 'loose' && ph === 'live') { loose += 0.05; if (loose > 6) note('loose ball over 6 s', { t, q, x: +bl.x.toFixed(0), y: +bl.y.toFixed(1), z: +bl.z.toFixed(0) }); } else loose = 0;
        if (ph !== 'live') { deadT += 0.05; if (deadT > 25) note('not live for 25 s', { t, q, ph }); } else deadT = 0;
        if (G.shotClock < -0.5 && ph === 'live') note('shot clock below zero', { t, q, sc: +G.shotClock.toFixed(1) });
        if (G.clock < -0.5) note('clock below zero', { t, q });
        if (G.t === lastT && ph !== 'end') note('time stood still', { t, q, ph }); lastT = G.t;
      }
      const tot = t => G.pl.filter(p => p.team === t).concat((G.bench && G.bench[t]) || []).reduce((a, p) => a + ((p.st && p.st.pts) || 0), 0);
      if (tot(0) !== G.score[0] || tot(1) !== G.score[1]) note('box score does not add up', { score: G.score, box: [tot(0), tot(1)] });
      return { steps: n, score: G.score, q: G.q, phase: G.phase, bad };
    });
    console.log(`game ${g + 1}`, JSON.stringify(r));
  }
  console.log('errors', errs); await b.close(); process.exit(0);
})();
