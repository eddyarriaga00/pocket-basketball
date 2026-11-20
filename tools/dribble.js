/* Sample hand changes in both directions, including a pickup near the floor. */
const assert = require('node:assert/strict');
global.window = {};
require('../js/data.js');

const hands = { l: { x: -1, y: 3, z: 0 }, r: { x: 1, y: 4, z: 0 } };
const player = { x: 0, z: 0, face: 0 };
for (const [kind, floorZ] of [['cross', 1.2], ['legs', 0.15], ['btb', -1]]) {
  for (const side of [1, -1]) {
    const move = { k: kind, a: side, b: -side, pickup: { x: side, y: 0.6, z: 0 } };
    const receiving = side > 0 ? hands.l : hands.r;
    let previous;
    for (let frame = 0; frame <= 100; frame++) {
      const ball = {};
      window.PB.crossBounce(ball, player, move, frame / 100, hands);
      assert(ball.y >= 0.4);
      if (frame === 0) assert(Math.abs(ball.y - move.pickup.y) < 1e-8);
      if (frame === 50) assert.deepEqual(ball, { x: 0, y: 0.4, z: floorZ });
      if (frame === 100) assert.deepEqual(ball, { ...receiving, y: receiving.y - 0.35 });
      if (previous) assert(Math.hypot(ball.x - previous.x, ball.y - previous.y, ball.z - previous.z) < 0.3);
      previous = ball;
    }
  }
}
console.log('All six hand changes met the floor and returned to the receiving hand.');

// A change of direction after the push must leave the floor contact in place.
const movingPlayer = { runD: 1, dribVX: 14, dribVZ: 0 };
const ball = {}, hand = { x: 1, z: 0 }, rate = 7;
const bounce = progress => window.PB.movingBounce(ball, movingPlayer, hand, (0.5 + progress) * Math.PI, rate);
bounce(0);
const target = ball.floorX;
assert(target > hand.x + 4);
movingPlayer.dribVX = -10;
hand.x = 0;
bounce(0.5);
assert.equal(ball.x, target);
bounce(1);
assert.equal(ball.x, hand.x);
assert(ball.floorX < hand.x);
console.log('The push stays on its line through a cut and the next bounce follows the new direction.');
