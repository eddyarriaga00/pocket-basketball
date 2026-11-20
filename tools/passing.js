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
      PB.seed(56);
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
    const motion = await page.evaluate(() => {
      const dbg = PB.Game.dbg, game = dbg.state(), user = game.user, ball = game.ball;
      const mate = ball.to;
      game.pl.filter(p => p.team !== user.team).forEach(p => Object.assign(p, { x: -22, z: -36 }));
      ball.pick = null;
      const releasePose = user.pose;
      dbg.run(0.1); // the stick is still held after the pass
      const followsThrough = user.pose === releasePose;
      const teammateReaches = mate.pose === 'catch';

      // Run the existing isolation play. The teammate passes back to the controlled player.
      Object.assign(user, { x: 0, z: 20, vx: 0, vz: 0, reachT: 0, pose: '' });
      Object.assign(mate, { x: 12, z: 20, vx: 0, vz: 0, hold: 1, shoot: null });
      Object.assign(ball, { state: 'held', holder: mate });
      dbg.stick(0, 0);
      game.play = { kind: 'iso', left: 1 };
      dbg.run(1 / 60);
      const aiRelease = ball.state === 'pass' && ball.to === user && ['chestPass', 'bpass'].includes(mate.pose);
      dbg.run(0.1);
      const userReaches = user.pose === 'catch';
      for (let i = 0; i < 60 && ball.state === 'pass'; i++) dbg.run(1 / 60);
      const caught = ball.holder === user;
      dbg.press('B');
      const immediatePass = ball.state === 'pass' && ball.from === user;
      // Compare the rendered wrists for incoming passes on opposite sides of a stationary receiver.
      Object.assign(user, { pose: 'catch', face: 0, vx: 0, vz: 0 });
      Object.assign(ball, { to: user, z: user.z + 3, y: user.ht / 12 * 0.75 });
      const handsAt = offset => {
        ball.x = user.x + offset;
        for (let i = 0; i < 8; i++) PB.R.update(game, 1 / 60);
        return PB.R.hands(user);
      };
      const left = handsAt(-5), right = handsAt(5);
      const handsTrackBall = right.r.x > left.r.x + 0.25 && right.l.x > left.l.x + 0.25;
      return { followsThrough, teammateReaches, aiRelease, userReaches, caught, immediatePass, handsTrackBall };
    });
    for (const [action, observed] of Object.entries(motion)) assert.ok(observed, action);
    assert.deepEqual(errors, []);
    console.log('Pass targeting, follow-through, catches and immediate return passes passed.');
  } finally {
    await browser.close();
    server.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
