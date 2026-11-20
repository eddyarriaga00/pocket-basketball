/* Exercise a jumper with the stick held through the gather, release and landing. */
const assert = require('node:assert/strict');
const { chromium, webkit } = require('playwright');
const { serve } = require('./serve-test');

(async () => {
  const browser = process.argv[2] === 'webkit' ? await webkit.launch()
    : await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const server = await serve();
  try {
    const page = await browser.newPage();
    await page.goto(server.url);
    await page.waitForFunction(() => window.PB?.R.modelReady());
    const trial = await page.evaluate(() => {
      PB.seed(56);
      document.querySelector('#qg').click();
      document.querySelector('#go').click();
      const dbg = PB.Game.dbg, g = dbg.state(), u = g.user;
      Object.assign(g, { phase: 'live', paused: true, poss: u.team });
      Object.assign(u, { x: 0, z: 18, y: 0, vx: 10, vz: 0, dribHand: -1 });
      g.pl.filter(p => p.team !== u.team).forEach(p => Object.assign(p, { x: -20, z: -30 }));
      Object.assign(g.ball, { holder: u, state: 'held', bounce: true, x: -0.8, y: 2, z: 18 });
      dbg.stick(0.9, 0);
      dbg.press('A', true);
      const shot = u.shoot, dt = 1 / 60;
      const frame = () => { dbg.run(dt); PB.R.update(g, dt); };
      frame();
      const pickupY = g.ball.y;
      for (let i = 0; i < 60 && shot.t + dt < shot.gather; i++) frame();
      const plantY = u.y, lowHand = PB.R.hands(u).r.y;
      for (let i = 0; i < 90 && shot.t < shot.T * 0.82; i++) frame();
      const peak = u.y, pose = u.pose, highHand = PB.R.hands(u).r.y;
      dbg.press('A', false);
      frame();
      const follow = u.pose;
      const ball = g.ball;
      let samples = 0;
      while (ball.state === 'shot' && samples < 180) {
        const phase = ball.t / ball.dur;
        const arc = ball.sy + (ball.ey - ball.sy) * phase + 4 * ball.apex * phase * (1 - phase);
        if (Math.abs(ball.y - arc) > 1e-6) throw Error('A jumper inherited the previous bounce pass trajectory');
        samples++;
        dbg.run(dt);
      }
      for (let i = 0; i < 90 && u.y > 0; i++) dbg.run(dt);
      return { samples, gather: shot.gather, pickupY, plantY, peak, pose, highHand, lowHand, follow, landed: u.y === 0 };
    });
    assert(trial.samples > 5);
    assert(trial.gather > 0 && trial.pickupY < 3);
    assert.equal(trial.plantY, 0);
    assert(trial.peak > 1 && trial.highHand - trial.peak > trial.lowHand + 0.5);
    assert.equal(trial.pose, 'shoot');
    assert.equal(trial.follow, 'shoot');
    assert(trial.landed);
    console.log('Moving jumper gathered, planted, rose, released and landed with the stick held.');
  } finally {
    await browser.close();
    server.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
