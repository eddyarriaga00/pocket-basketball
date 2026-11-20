/* Run the called plays through the live simulation with controlled defensive positions. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { serve } = require('./serve-test');

(async () => {
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const server = await serve();
  try {
    const page = await browser.newPage();
    await page.goto(server.url);
    await page.waitForFunction(() => window.PB?.Game);
    const results = await page.evaluate(() => {
      PB.seed(56);
      document.querySelector('#qg').click();
      document.querySelector('#go').click();
      const dbg = PB.Game.dbg, game = dbg.state();
      const mates = game.pl.filter(p => p.team === 0);
      const guard = mates.find(p => p.slot === 0), center = mates.find(p => p.slot === 4);
      const defense = game.pl.filter(p => p.team === 1);
      Object.assign(game, { paused: true, phase: 'live', poss: 0, clock: 100, shotClock: 20, auto: true });
      const hold = () => {
        Object.assign(game.ball, { state: 'held', holder: guard, x: 8, z: 18 });
        Object.assign(guard, { x: 8, z: 18, hold: 1, think: 0, shoot: null });
      };
      defense.forEach(p => Object.assign(p, { x: -22, z: -34 }));
      hold();
      game.play = { kind: 'post', left: 1 };
      center.r.close = 99;
      Object.assign(center, { x: 18, z: 12 });
      dbg.run(1 / 60);
      const block = { x: center.tx, z: center.tz };
      Object.assign(center, block);
      hold();
      dbg.run(1 / 60);
      const entry = game.ball.state === 'pass' && game.ball.to === center;

      hold();
      game.play = { kind: 'pnr', left: 1, done: true };
      Object.assign(center, { screen: 1, screenFor: guard });
      dbg.run(1 / 60);
      const roll = game.ball.state === 'pass' && game.ball.to === center;

      hold();
      guard.z = -32;
      game.possN = (game.possN || 0) + 1; // A fresh possession starts in the backcourt.
      guard.think = 1;
      game.clock = 0.9;
      dbg.run(1 / 60);
      return { block, entry, roll, lastShot: !!guard.shoot };
    });
    assert.equal(results.block.x, 7);
    assert(results.entry, 'Post entry');
    assert(results.roll, 'Pass to the roll');
    assert(results.lastShot, 'Backcourt shot before the horn');
    console.log('Post positioning, entry pass, roll read and end-of-period shot passed.');
  } finally {
    await browser.close();
    server.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
