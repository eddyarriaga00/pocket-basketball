/* Online test: two windows of one browser on the page-only backend (no network). The park online (each sees the
   other walk in), a challenge and its answer, a 1 on 1 where the guest's stick moves him on the host and both phones
   agree on the score, a shot by whoever has the ball, then the guest leaves and the host's computer takes him over.
   node tools/online.js (KIND=3 or KIND=5 for 3 on 3 or a full game). Prints FAILS and page errors. */
const { chromium } = require('playwright');
(async () => {
  const { serve } = require('./serve-test'); const s = await serve();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows'] });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  await ctx.addInitScript(() => { window.PB_NET_LOCAL = 'pbtest'; });
  const A = await ctx.newPage(), B = await ctx.newPage();
  const errs = [], fails = [], ok = (c, m) => { if (!c) fails.push(m); };
  for (const [n, pg] of [['A', A], ['B', B]]) { pg.on('pageerror', e => errs.push(n + ' ' + e.message)); pg.on('dialog', d => d.accept()); }
  await A.goto(s.url); await A.evaluate(() => { localStorage.clear(); localStorage.setItem('pbb.tut', '1'); }); await A.reload();
  await A.waitForFunction(() => window.PB && PB.Career && document.querySelector('#newc'), { timeout: 120000 });
  await A.click('#newc'); await A.fill('#fn', 'Alpha'); await A.fill('#ln', 'One'); for (let k = 0; k < 4 && (await A.$('#go')); k++) await A.click('#go');
  await A.waitForFunction(() => PB.Game.active && PB.G && PB.G.park, null, { timeout: 90000 });
  await B.goto(s.url); await B.waitForFunction(() => window.PB && PB.Career && PB.Career.park, null, { timeout: 120000 });
  await B.evaluate(() => PB.Career.park()); await B.waitForFunction(() => PB.Game.active && PB.G && PB.G.park, null, { timeout: 90000 });
  /* the sheet opens from the Online button */
  await A.click('#netchip'); ok(await A.$('#netsheet:not([hidden]) #nspub'), 'the online sheet did not open'); await A.click('#nsx');
  await A.evaluate(() => PB.Career.net.go('TEST1')); await B.evaluate(() => PB.Career.net.go('TEST1'));
  await A.waitForFunction(() => PB.G.netP && Object.keys(PB.G.netP).length === 1, null, { timeout: 20000 }).catch(() => fails.push('A never saw B'));
  await B.waitForFunction(() => PB.G.netP && Object.keys(PB.G.netP).length === 1, null, { timeout: 20000 }).catch(() => fails.push('B never saw A'));
  await B.evaluate(() => { const u = PB.G.user; u.x = 2; u.z = -8; }); await A.waitForTimeout(2500);
  const seen = await A.evaluate(() => { const p = Object.values(PB.G.netP)[0]; return p && Math.hypot(p.x - 2, p.z + 8); });
  ok(seen !== undefined && seen < 2, 'B is not where he walked to on A: ' + seen);
  ok((await A.evaluate(() => document.querySelector('#netchip').textContent)).includes('1 here'), 'the chip does not count B');
  const bid = await A.evaluate(() => Object.keys(PB.G.netP)[0]);
  await A.evaluate(([id, k]) => PB.Career.net.challenge(id, k, 'B'), [bid, +(process.env.KIND || 1)]);
  await B.waitForSelector('#netask:not([hidden])', { timeout: 10000 }).catch(() => fails.push('the challenge never came'));
  await B.click('#nay');
  await A.waitForFunction(() => PB.G && PB.G.net && PB.G.net.role === 'host', null, { timeout: 30000 }).catch(() => fails.push('A did not start hosting'));
  await B.waitForFunction(() => PB.G && PB.G.net && PB.G.net.role === 'guest', null, { timeout: 30000 }).catch(() => fails.push('B did not join'));
  await A.waitForFunction(() => PB.G.phase === 'live', null, { timeout: 30000 });
  let moved = 0;   // (an inbound or a dead ball can hold him: up to three tries, the stick one way then the other)
  for (let k = 0; k < 3 && moved <= 2; k++) {
    await A.waitForFunction(() => PB.G.phase === 'live' && !PB.G.net.remote.inb, null, { timeout: 20000 }).catch(() => {});
    const g0 = await A.evaluate(() => { const p = PB.G.net.remote; return [p.x, p.z]; }), key = k % 2 ? 'ArrowRight' : 'ArrowLeft';
    await B.keyboard.down(key); await B.waitForTimeout(1500); await B.keyboard.up(key); await B.waitForTimeout(600);
    const g1 = await A.evaluate(() => { const p = PB.G.net.remote; return [p.x, p.z]; }); moved = Math.hypot(g1[0] - g0[0], g1[1] - g0[1]);
  }
  ok(moved > 2, 'the guest\'s stick did not move him on the host');
  const size = await A.evaluate(() => PB.Game.net.frameSize ? PB.Game.net.frameSize() : 0);
  for (let i = 0; i < 20; i++) {   // a shot by whoever has it
    const who = await A.evaluate(() => PB.G.ball.holder ? (PB.G.ball.holder.remote ? 'B' : PB.G.ball.holder.isUser ? 'A' : '') : '');
    if (who) { const pg = who === 'A' ? A : B; await pg.keyboard.down(' '); await pg.waitForTimeout(700); await pg.keyboard.up(' '); await A.waitForTimeout(4000); break; }
    await A.waitForTimeout(700);
  }
  const sa = await A.evaluate(() => PB.G.score.join('-')), sb = await B.evaluate(() => PB.G.score.join('-'));
  ok(sa === sb, `the score differs: host ${sa}, guest ${sb}`);
  /* the guest leaves: his phone shows a result, the host's computer takes him */
  await B.click('#pz'); await B.waitForTimeout(300); await B.click('#pq'); await B.click('#pq');
  await B.waitForFunction(() => !PB.Game.active, null, { timeout: 10000 }).catch(() => fails.push('the guest could not leave'));
  ok((await B.evaluate(() => document.querySelector('#screen').innerText)).includes('does not count'), 'the guest\'s result is wrong');
  await A.waitForFunction(() => PB.G.net.remote && PB.G.net.remote.remote === false, null, { timeout: 10000 }).catch(() => fails.push('the host never heard the guest left'));
  console.log('frame bytes', size, 'score', sa);
  console.log('FAILS', fails.length, fails);
  console.log('errors', errs);
  await b.close(); s.close(); process.exit(0);
})().catch(e => { console.log('FAILS 1 [' + e.message + ']'); process.exit(1); });
