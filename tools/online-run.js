/* Online run test: three windows of one browser on the page-only backend. A gets a run going (3 on 3, or a full game
   with KIND=5), asks everyone; B and C say they're in; A moves C to his own side and starts it. Then: everyone is in
   one game with the right man under his thumbs, both guests' sticks move their men on the host, the three phones
   agree on the score, and when C leaves the computer takes him and the others play on.
   node tools/online-run.js. Prints FAILS and page errors. */
const { chromium } = require('playwright');
(async () => {
  const { serve } = require('./serve-test'); const s = await serve();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => { window.PB_NET_LOCAL = 'pbrun'; });
  const errs = [], fails = [], ok = (c, m) => { if (!c) fails.push(m); };
  const kind = +(process.env.KIND || 3);
  const pages = {};
  for (const n of ['A', 'B', 'C']) {
    const pg = pages[n] = await ctx.newPage();
    pg.on('pageerror', e => errs.push(n + ' ' + e.message)); pg.on('dialog', d => d.accept());
  }
  const { A, B, C } = pages;
  await A.goto(s.url); await A.evaluate(lo => { localStorage.clear(); localStorage.setItem('pbb.tut', '1'); if (lo) localStorage.setItem('pbb.settings.v1', JSON.stringify({ gfx: 'Low' })); }, !!process.env.LOW); await A.reload();
  await A.waitForFunction(() => window.PB && PB.Career && document.querySelector('#newc'), { timeout: 120000 });
  await A.click('#newc'); await A.fill('#fn', 'Alpha'); await A.fill('#ln', 'One'); for (let k = 0; k < 4 && (await A.$('#go')); k++) await A.click('#go');
  await A.waitForFunction(() => PB.Game.active && PB.G && PB.G.park, null, { timeout: 90000 });
  await A.waitForFunction(() => PB.Career.net.state().on, null, { timeout: 15000 }).catch(() => fails.push('A did not start online'));
  for (const pg of [B, C]) {
    await pg.goto(s.url); await pg.waitForFunction(() => window.PB && PB.Career && PB.Career.park, null, { timeout: 120000 });
    await pg.evaluate(() => PB.Career.park()); await pg.waitForFunction(() => PB.Game.active && PB.G && PB.G.park, null, { timeout: 90000 });
  }
  for (const pg of [B, C]) await pg.waitForFunction(() => PB.Career.net.state().on, null, { timeout: 45000 }).catch(() => fails.push('a guest did not go online'));
  await A.waitForFunction(() => Object.keys(PB.Career.net.state().people).length === 2, null, { timeout: 25000 }).catch(() => fails.push('A does not see both'));
  const ids = await A.evaluate(() => PB.Career.net.state().people);
  const uidOf = async pg => pg.evaluate(() => PB.net.uid);
  const bU = await uidOf(B), cU = await uidOf(C);
  ok(ids[bU] && ids[cU], 'A sees the wrong people');
  /* the run: ask everyone, both say yes */
  await A.evaluate(k => PB.Career.net.run(k), kind);
  await A.click('#rall');
  for (const pg of [B, C]) { await pg.waitForSelector('#netask:not([hidden])', { timeout: 10000 }).catch(() => fails.push('a run invite never came')); ok((await pg.textContent('#netask')).includes('together'), 'the invite does not read as a run'); await pg.click('#nay'); }
  await A.waitForFunction(() => Object.keys(PB.Career.net.state().run.in).length === 2, null, { timeout: 10000 }).catch(() => fails.push('A never got both answers'));
  /* C to A's side (whichever side he landed on, the other way round from B) */
  const sides = await A.evaluate(() => PB.Career.net.state().run.in);
  if (sides[cU].side !== 0) await A.click(`[data-rs="${cU}"]`);
  if ((await A.evaluate(() => PB.Career.net.state().run.in))[bU].side !== 1) await A.click(`[data-rs="${bU}"]`);
  const s2 = await A.evaluate(() => PB.Career.net.state().run.in);
  ok(s2[cU].side === 0 && s2[bU].side === 1, 'could not set the sides: ' + JSON.stringify(s2));
  await A.click('#rgo');
  await A.waitForFunction(() => PB.G && PB.G.net && PB.G.net.role === 'host', null, { timeout: 30000 }).catch(() => fails.push('A did not start hosting'));
  for (const [n, pg] of [['B', B], ['C', C]]) await pg.waitForFunction(() => PB.G && PB.G.net && PB.G.net.role === 'guest', null, { timeout: 30000 }).catch(() => fails.push(n + ' did not join'));
  const host = await A.evaluate(() => ({ n: PB.G.net.remotes.length, teams: PB.G.net.remotes.map(p => [p.netName, p.team]), me: PB.G.user.team, size: PB.G.pl.length }));
  ok(host.n === 2, 'the host has ' + host.n + ' remote players');
  ok(host.size === (kind === 5 ? 10 : 6), 'wrong number on the floor: ' + host.size);
  const bTeam = await B.evaluate(() => PB.G.user && PB.G.user.team), cTeam = await C.evaluate(() => PB.G.user && PB.G.user.team);
  ok(bTeam === 1 && cTeam === 0 && host.me === 0, `teams: A ${host.me}, B ${bTeam}, C ${cTeam}`);
  const sameMan = await A.evaluate(() => PB.G.net.remotes.map(p => p.d.id));
  const bId = await B.evaluate(() => PB.G.user.d.id), cId = await C.evaluate(() => PB.G.user.d.id);
  ok(sameMan.includes(bId) && sameMan.includes(cId) && bId !== cId, 'the guests are not playing their own men');
  await A.waitForFunction(() => PB.G.phase === 'live', null, { timeout: 60000 }).catch(() => fails.push('the game never went live'));
  if (process.env.FPS) { const f = async pg => pg.evaluate(() => new Promise(r => { let n = 0; const t0 = performance.now(); const k = () => { n++; if (performance.now() - t0 < 3000) requestAnimationFrame(k); else r(n / 3); }; requestAnimationFrame(k); })); console.log('fps', await f(A), await f(B), await f(C), 'game secs per 3s', await A.evaluate(async () => { const t = PB.G.t; await new Promise(r => setTimeout(r, 3000)); return PB.G.t - t; })); }
  /* each guest's stick moves his man on the host */
  for (const [n, pg, id] of [['B', B, bId], ['C', C, cId]]) {
    let moved = 0;
    for (let k = 0; k < 3 && moved <= 2; k++) {
      await A.waitForFunction(id => { const p = PB.G.pl.find(q => q.d.id === id); return PB.G.phase === 'live' && !p.inb; }, id, { timeout: 20000 }).catch(() => {});
      const g0 = await A.evaluate(id => { const p = PB.G.pl.find(q => q.d.id === id); return [p.x, p.z]; }, id), key = k % 2 ? 'ArrowRight' : 'ArrowLeft';
      await pg.keyboard.down(key); await pg.waitForTimeout(1500); await pg.keyboard.up(key); await pg.waitForTimeout(600);
      const g1 = await A.evaluate(id => { const p = PB.G.pl.find(q => q.d.id === id); return [p.x, p.z]; }, id); moved = Math.hypot(g1[0] - g0[0], g1[1] - g0[1]);
    }
    ok(moved > 2, n + '\'s stick did not move him on the host');
  }
  await A.waitForTimeout(4000);
  const sc = []; for (const pg of [A, B, C]) sc.push(await pg.evaluate(() => PB.G.score.join('-')));
  await A.waitForTimeout(800);
  const sc2 = []; for (const pg of [A, B, C]) sc2.push(await pg.evaluate(() => PB.G.score.join('-')));
  ok(sc2[0] === sc2[1] && sc2[1] === sc2[2], 'the scores differ: ' + sc2.join(' / '));
  /* C leaves: the computer takes his man, A and B play on */
  await C.click('#pz'); await C.waitForTimeout(300); await C.click('#pq'); await C.click('#pq');
  await C.waitForFunction(() => !PB.Game.active, null, { timeout: 10000 }).catch(() => fails.push('C could not leave'));
  await A.waitForFunction(id => { const p = PB.G.pl.find(q => q.d.id === id); return p && p.remote === false; }, cId, { timeout: 10000 }).catch(() => fails.push('the host never heard C left'));
  ok(await A.evaluate(() => PB.G.net.remotes.some(p => p.remote) && !PB.G.net.left), 'B was dropped with C');
  ok(await B.evaluate(() => PB.Game.active && PB.G.net && !PB.G.net.over), 'B\'s game ended when C left');
  console.log('score', sc2.join(' / '), 'remotes', JSON.stringify(host.teams));
  console.log('FAILS', fails.length, fails);
  console.log('errors', errs);
  await b.close(); s.close(); process.exit(0);
})().catch(e => { console.log('FAILS 1 [' + e.message + ']'); process.exit(1); });
