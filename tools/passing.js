/* The arrow and the pass button should agree at every stick strength. Run with node tools/passing.js [webkit]. */
const assert = require('node:assert/strict');
const { chromium, webkit } = require('playwright');
const { serve } = require('./serve-test');

(async () => {
  const browser = process.argv[2] === 'webkit' ? await webkit.launch()
    : await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const server = await serve();
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(server.url);
    await page.waitForFunction(() => window.PB?.R.modelReady());
    const trials = await page.evaluate(async () => {
      document.querySelector('#qg').click();
      document.querySelector('#go').click();
      const dbg = PB.Game.dbg, game = dbg.state(), user = game.user;
      const mates = game.pl.filter(p => p.team === user.team && p !== user);
      const [wing, cutter] = mates;
      game.paused = true;
      game.phase = 'live';
      game.poss = user.team;
      Object.assign(user, { x: 0, z: 18, y: 0, shoot: null });
      // The open cutter wins an unaimed pass. The guarded wing is directly to the right in court coordinates.
      [[15, 18], [-10, 35], [-14, 10], [-12, 22]].forEach(([x, z], i) => Object.assign(mates[i], { x, z }));
      cutter.cutUser = 2;
      game.pl.filter(p => p.team !== user.team).forEach(p => Object.assign(p, { x: 16, z: 18 }));
      PB.R.setIntro(0);
      PB.R.studio = [0, 24, -18, 0, 3, 18];
      PB.R.update(game, 0);
      const basis = PB.R.basis(), results = [];
      for (const strength of [0, 0.08, 0.13, 0.25, 0.65, 1]) {
        game.ball.state = 'held';
        game.ball.holder = user;
        dbg.stick(strength * basis.rx, -strength * basis.fx);
        await new Promise(requestAnimationFrame);
        const marker = PB.R._marks().pass;
        dbg.press('B');
        const expected = strength < 0.12 ? cutter : wing;
        results.push({ strength, marker, target: game.ball.to.num, expected: expected.num });
      }
      return results;
    });
    for (const { strength, marker, target, expected } of trials) {
      assert.equal(marker, expected, `Pass arrow at ${strength} stick travel`);
      assert.equal(target, expected, `Receiver at ${strength} stick travel`);
    }
    assert.deepEqual(errors, []);
    console.log('Pass arrow and receiver matched at all six stick strengths.');
  } finally {
    await browser.close();
    server.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
