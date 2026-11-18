/* PocketBasketball: the game on the floor. 5-on-5, one player is yours. Exposes PB.Game.
   Feet, seconds. Team 0 is always your team and attacks +z (up the screen); team 1 attacks -z.
   Ball states: held (a holder), pass, shot (in the air to the rim), drop (through the net), loose (bouncing, a rebound
   or a deflection). Phases: tip, live, dead (a pause before the next thing), ft (free throws), end. */
(() => {
  'use strict';
  const PB = window.PB, R = PB.R;
  const { clamp, rand, rr } = PB;
  const $ = s => document.querySelector(s);
  const RIM = 41.75, GRAV = 32;
  const hoopZ = team => team === 0 ? RIM : -RIM;      // the hoop a team attacks
  const dirOf = team => team === 0 ? 1 : -1;
  const hyp = Math.hypot;
  const AU = () => PB.audio || { play() {}, crowd: { react() {}, level() {}, on() {} }, muffle() {}, music() {} };
  const home = t => G && t === G.home;   // the crowd is the home team's
  const B = (k, o) => { if (PB.booth) PB.booth.say(k, o); };   // the booth
  const CH = (k, p) => { if (PB.booth && PB.booth.chat && p && !G.drill) PB.booth.chat(k, p.x, p); };   // a player talking on the floor
  const bt = (p, k) => (p && p.d && p.d.badges && p.d.badges[k]) || 0;   // a badge's tier, 0 to 3
  /* a short buzz in the hand, where the phone allows it (Android; iPhones do not let web pages vibrate) */
  const buzz = ms => { if (PB.settings && PB.settings.vibrate === false) return; try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* not allowed */ } };
  /* Settings › Shot timing: how wide the green band is */
  const timingEase = () => ({ Easy: 1.6, Normal: 1, Hard: 0.7 }[(PB.settings && PB.settings.timing) || 'Normal'] || 1);
  const clutchTime = () => G.q >= 4 && G.clock < 120 && Math.abs(G.score[0] - G.score[1]) <= 6;

  let G = null, raf = 0, last = 0, opts = null;
  const input = { sx: 0, sy: 0, active: false, A: false, Adown: 0, B: 0, C: 0, keys: {} };

  /* ---------- geometry ---------- */
  const distHoop = (x, z, team) => hyp(x, z - hoopZ(team));
  const along = (z, team) => (hoopZ(team) - z) * dirOf(team);    // feet in front of the rim, toward midcourt
  const isThree = (x, z, team) => (Math.abs(x) >= 22 && along(z, team) <= 8.95) || distHoop(x, z, team) >= 23.75;
  const toCourt = (team, x, d) => ({ x, z: hoopZ(team) - dirOf(team) * d });   // a spot given across and depth from the rim

  /* Where each slot spaces on offense: point, two wings, a corner, the dunker spot. */
  const SPOTS = [
    [[0, 26], [-5, 25], [5, 25]],
    [[-17, 19], [-21.5, 4], [-12, 22]],
    [[17, 19], [21.5, 4], [12, 22]],
    [[-22, 4], [-9, 13], [-18, 17]],
    [[5, 5], [-5, 5], [0, 15]],
  ];

  /* ---------- the shot model ---------- */
  /* Open-look make rate for this shooter from here, before the defense and the release. Rim ~.45-.75, mid .28-.52,
     three .20-.44 (an 80 shooter: about .39 wide open from three, the league's catch-and-shoot rate is about .36). */
  function baseProb(p, x, z, kind) {
    const d = distHoop(x, z, p.team), r = p.r;
    /* badges: a few points where each belongs */
    const caught = p.caughtT !== undefined && G.t - p.caughtT < 1.5, cl = clutchTime() ? 0.025 * bt(p, 'clutch') : 0;
    if (kind === 'dunk') return 0.86 + r.dunk * 0.0012;
    if (kind === 'layup' || d < 5) return 0.6 + r.close / 99 * 0.3 + 0.025 * bt(p, 'acro') + cl;
    if (kind === 'floater') return 0.36 + r.close / 99 * 0.22 + 0.025 * bt(p, 'acro') + cl;
    if (kind === 'hook') return 0.4 + r.close / 99 * 0.24 + 0.02 * bt(p, 'acro') + cl;
    if (isThree(x, z, p.team)) return Math.max(0.03, 0.25 + r.three / 99 * 0.22 - Math.max(0, d - 26) * 0.014 * (1 - 0.25 * bt(p, 'deep')) + 0.015 * bt(p, 'deep') + (caught ? 0.02 * bt(p, 'catch') : 0) + cl);
    if (d < 14) return 0.34 + (r.close * 0.4 + r.mid * 0.6) / 99 * 0.22 + 0.02 * bt(p, 'mid') + cl;
    return 0.32 + r.mid / 99 * 0.22 + 0.02 * bt(p, 'mid') + (caught ? 0.02 * bt(p, 'catch') : 0) + cl;
  }
  /* How much the nearest defender takes away: 0 ft roughly halves it, 6 ft or more takes nothing. Defenders
     in the air in front of the shot take more. Distance to the defender matters more than distance to the rim. */
  function contest(p) {
    let best = 1;
    for (const o of G.pl) {
      if (o.team === p.team) continue;
      const d = hyp(o.x - p.x, o.z - p.z);
      if (d > 7) continue;
      const toHoopX = 0 - p.x, toHoopZ = hoopZ(p.team) - p.z, L = hyp(toHoopX, toHoopZ) || 1;
      const front = ((o.x - p.x) * toHoopX + (o.z - p.z) * toHoopZ) / (L * (d || 1));   // 1: right between him and the rim
      let f = clamp(0.6 + 0.07 * d, 0.6, 1);
      if (front < 0) f = 1 - (1 - f) * 0.35;              // a chaser from behind barely bothers the shot
      if (o.y > 0.5 || o.pose === 'contest') f -= 0.06 * clamp((o.r.perD + o.r.block) / 160, 0.4, 1);
      f -= 0.025 * bt(o, 'lock') * (d < 5 ? 1 : 0);
      best = Math.min(best, f);
    }
    if (p.stepT !== undefined && G.t - p.stepT < 1.1) best = 1 - (1 - best) * 0.55;   // the step-back bought room
    if (p.euroT !== undefined && G.t - p.euroT < 1.2) best = 1 - (1 - best) * 0.5;   // the euro step went around the shot-blocker
    if (p.fadeT !== undefined && G.t - p.fadeT < 1.2) best = 1 - (1 - best) * 0.6;   // the fadeaway leans away from the hand
    if (p.postHookT !== undefined && G.t - p.postHookT < 1.2) best = 1 - (1 - best) * 0.7;
    if (p.highT !== undefined && G.t - p.highT < 1.2) best = 1 - (1 - best) * 0.85;   // a high release goes up over the hand   // backed him down first: the hook goes over him
    return clamp(best, 0.5, 1);
  }
  const nearestDef = p => {
    let b = 99, who = null;
    for (const o of G.pl) if (o.team !== p.team) { const d = hyp(o.x - p.x, o.z - p.z); if (d < b) { b = d; who = o; } }
    return { d: b, who };
  };

  /* ---------- players ---------- */
  function mkOnCourt(d, team, slot) {
    return { d, team, slot, r: d.r, ht: d.ht, name: d.last, num: d.num, x: 0, z: 0, vx: 0, vz: 0, y: 0, vy: 0, jg: GRAV,
      face: team === 0 ? 0 : Math.PI, pose: '', stun: 0, think: rr(0, 0.3), hold: 0, tx: 0, tz: 0, cut: rr(3, 8), cutT: 0,
      spot: 0, drive: 0, move: 0, moveCd: 0, shoot: null, isUser: false,
      st: { pts: 0, reb: 0, oreb: 0, ast: 0, stl: 0, blk: 0, tov: 0, fga: 0, fgm: 0, tpa: 0, tpm: 0, fta: 0, ftm: 0, pf: 0, cs3: 0, mid: 0, lay: 0, dunk: 0, shake: 0, cmiss: 0, clutch: 0, fade: 0, hookm: 0 } };
  }
  const maxSpeed = p => (11.5 + p.r.speed * 0.075) * (G.ball.holder === p ? 0.9 : 1) * (p.isUser && G.tko && G.tko.on ? 1.05 : 1) * (p.energy !== undefined ? 0.82 + 0.18 * Math.min(1, p.energy * 2) : 1);
  const teamOf = t => G.pl.filter(p => p.team === t);

  /* ---------- HUD and feedback ---------- */
  function toast(txt, cls) {
    const t = $('#toast'); t.textContent = txt; t.className = 'on ' + (cls || ''); clearTimeout(toast.h);
    toast.h = setTimeout(() => t.className = '', 1500);
  }
  function feed(txt) {
    const f = $('#feed'); const e = document.createElement('div'); e.textContent = txt; f.prepend(e);
    while (f.children.length > 3) f.lastChild.remove();
    setTimeout(() => e.classList.add('old'), 3500);
  }
  const LETTERS = ['F', 'D-', 'D', 'D+', 'C-', 'C', 'C+', 'B-', 'B', 'B+', 'A-', 'A', 'A+'];
  const gradeLetter = s => LETTERS[clamp(Math.round(6 + s / 4), 0, 12)];
  function grade(delta, why) {
    if (!G.user || G.switching) return;
    const before = gradeLetter(G.grade);
    G.grade = clamp(G.grade + delta, -26, 26);
    G.gradeLog.push([delta, why]);
    tkoAdd(delta > 0 ? delta * 0.05 : delta * 0.025);
    const g = $('#grade'); g.innerHTML = `<b>${gradeLetter(G.grade)}</b><span class="${delta >= 0 ? 'up' : 'dn'}">${delta >= 0 ? '+' : '−'} ${why}</span>`;
    g.classList.remove('flash'); void g.offsetWidth; g.classList.add('flash');
    if (before !== gradeLetter(G.grade)) g.classList.add('chg');
  }
  /* ---------- Takeover: good plays fill the meter (your grade's gains, a little back for its losses); full, tap it
     (or T) for 25 seconds of hot hands: a wider green window, better looks, a quicker first step, moves that land.
     Two misses in a row cool you off. ---------- */
  const TKO_LEN = 25;
  const tkoOn = () => !!(G.tko && G.tko.on);
  function tkoHud() {
    const e = $('#tko'); if (!e) return;
    const k = G.tko; e.hidden = !k || !G.user; if (e.hidden) return;
    e.className = k.on ? 'on' : k.m >= 1 ? 'ready' : '';
    e.style.setProperty('--f', (k.on ? Math.max(0, (k.until - G.t) / TKO_LEN) : k.m).toFixed(3));
  }
  function tkoAdd(x) {
    const k = G.tko; if (!k || k.on) return;
    const was = k.m >= 1; k.m = clamp(k.m + x, 0, 1);
    if (!was && k.m >= 1) { toast('Takeover ready', 'make'); buzz([20, 40, 20]); }
    tkoHud();
  }
  function tkoGo() {
    const k = G.tko; if (!k || k.on || k.m < 1 || !G.user || G.paused) return;
    k.on = true; k.until = G.t + TKO_LEN; k.miss = 0; k.n = (k.n || 0) + 1; if (G.ball.holder !== G.user && !G.user.shoot) celebrate(G.user, ['flex', 'roar']);
    toast('Takeover', 'make'); B('hot', { prio: 6 }); AU().crowd.react('roar', 1); R.flash(0xffffff); buzz([30, 50, 30]);
    tkoHud();
  }
  /* a celebration after a big play: a flex, a roar, the three goggles, a chest thump, a point to the crowd */
  function celebrate(p, kinds) { const sig = p.d && p.d.look && p.d.look.celeb; p.celebK = sig || kinds[Math.floor(rand() * kinds.length)]; p.celebT = p.celebK === 'chest' || p.celebK === 'roar' ? 1.4 : 1.2; }
  function tkoEnd(why) { const k = G.tko; if (!k) return; k.on = false; k.m = 0; if (why) toast(why); tkoHud(); }
  function tkoTick() { const k = G.tko; if (k && k.on) { if (G.t > k.until) tkoEnd(); else tkoHud(); } }
  /* ---------- first-game tips: shown once each, the first time the moment comes up ---------- */
  const TIPS = {
    ball: 'You have the ball. Hold SHOOT, let go at the top of the jump (green band). PASS finds the open man; swipe MOVE to break your man down.',
    def: 'Defense. Stay between your man and the rim. STEAL when the button lights up. JUMP as he shoots.',
    mate: 'A teammate has it. CALL asks for the ball, CUT runs you to the rim.',
    ft: 'Free throw: hold SHOOT and let go in the green band.',
    pick: 'PICK brings your big over to screen your man. Pause (top left) to call a play for the next three trips.',
  };
  let seenTips = null;
  function tip(k) {
    if (!G.user || G.drill || G.auto) return;
    if (!seenTips) { try { seenTips = JSON.parse(localStorage.getItem('pbb.tips') || '{}'); } catch (e) { seenTips = {}; } }
    if (seenTips[k]) return;
    seenTips[k] = 1; try { localStorage.setItem('pbb.tips', JSON.stringify(seenTips)); } catch (e) { /* fine */ }
    const t = $('#tipcard'); t.textContent = TIPS[k]; t.hidden = false; clearTimeout(tip.h); tip.h = setTimeout(() => { t.hidden = true; }, 6500);
  }
  /* passing your career high, live */
  function highCheck() {
    const u = G.user, h = opts.highs; if (!u || !h || G.switching) return;
    G.highSaid = G.highSaid || {};
    for (const [k, n] of [['pts', 'points'], ['reb', 'rebounds'], ['ast', 'assists']]) {
      if (h[k] !== undefined && u.st[k] > h[k] && !G.highSaid[k]) { G.highSaid[k] = true; toast(`Career high: ${u.st[k]} ${n}`, 'make'); feed(`Career high · ${u.st[k]} ${n}`); AU().crowd.react('applause', 0.7); B('high', { prio: 5, follow: 0.5 }); }
    }
  }
  /* the radar: the whole floor at a glance, top right (Settings can turn it off) */
  function radar() {
    const cv = $('#radar'); if (!cv) return;
    const on = !(PB.settings && PB.settings.radar === false) && !G.drill;
    cv.hidden = !on; if (!on) return;
    const g = cv.getContext('2d'), W = cv.width, Hh = cv.height, sx = x => W / 2 - x / 50 * W, sz = z => Hh / 2 - z / 94 * Hh;
    g.clearRect(0, 0, W, Hh);
    g.fillStyle = 'rgba(8,11,18,.72)'; g.fillRect(0, 0, W, Hh);
    g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1; g.strokeRect(1, 1, W - 2, Hh - 2);
    g.beginPath(); g.moveTo(0, Hh / 2); g.lineTo(W, Hh / 2); g.stroke();
    for (const z of [41.75, -41.75]) { g.beginPath(); g.arc(sx(0), sz(z), 2.5, 0, 7); g.stroke(); }
    for (const p of G.pl) {
      g.fillStyle = p.isUser ? '#4cffb0' : p.team === 0 ? G.teams[0].c1 === '#f2f2f2' ? '#ddd' : '#ffffff' : '#ff6a6a';
      g.beginPath(); g.arc(sx(p.x), sz(p.z), p.isUser ? 3.6 : 2.6, 0, 7); g.fill();
    }
    g.fillStyle = '#ffb02e'; g.beginPath(); g.arc(sx(G.ball.x), sz(G.ball.z), 2, 0, 7); g.fill();
  }
  function hud() {
    highCheck(); radar();
    $('#game').classList.toggle('drill', !!(G && G.drill));
    $('#game').classList.toggle('dunk', !!(G && G.drill && (G.drill.kind === 'dunk' || G.drill.kind === 'free')));
    $('#game').classList.toggle('lefty', !!(PB.settings && PB.settings.hand === 'Left-handed'));
    $('#game').classList.toggle('bigbtn', !!(PB.settings && PB.settings.btnSize === 'Large'));
    const en = $('#energy'); if (G.user && G.user.energy !== undefined) { en.hidden = false; en.firstChild.style.width = `${Math.round(G.user.energy * 100)}%`; en.classList.toggle('low', G.user.energy < 0.3); } else en.hidden = true;
    const fmt = s => s >= 60 ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : s.toFixed(1);
    for (const i of [0, 1]) { const e = $('#s' + i); if (e.textContent !== String(G.score[i])) { e.textContent = G.score[i]; e.classList.remove('pop'); void e.offsetWidth; e.classList.add('pop'); } }
    $('#qt').textContent = G.q <= 4 ? ['1st', '2nd', '3rd', '4th'][G.q - 1] : (G.q === 5 ? 'OT' : `${G.q - 4}OT`);
    $('#clk').textContent = fmt(Math.max(0, G.clock));
    const sc = $('#sc'); sc.textContent = Math.ceil(Math.max(0, G.shotClock)); sc.classList.toggle('low', G.shotClock < 5);
    sc.style.visibility = G.phase === 'live' && G.poss !== null ? 'visible' : 'hidden';
    $('#sd0').classList.toggle('poss', G.poss === 0); $('#sd1').classList.toggle('poss', G.poss === 1);
    if (G.to && $('#t0')) for (const i of [0, 1]) { const e = $('#t' + i), v = '•'.repeat(Math.max(0, G.to[i])); if (e.textContent !== v) e.textContent = v; }
    /* in the bonus: the other side has five fouls this quarter, every foul now is two shots */
    if (G.tf) { $('#sd0').classList.toggle('bonus', G.tf[1] >= 5); $('#sd1').classList.toggle('bonus', G.tf[0] >= 5); }
    /* the buttons read what they do right now */
    const u = G.user; if (!u) return;
    const off = G.poss === 0 || (G.poss === null && G.ball.holder && G.ball.holder.team === 0);
    const has = G.ball.holder === u;
    const ft = G.phase === 'ft' && G.ftq && G.ftq.shooter === u;
    if (G.phase === 'live' && G.t > 2) { if (has) tip('ball'); else if (!off && G.ball.holder) tip('def'); else if (off && G.ball.holder) tip('mate'); }
    if (ft) tip('ft');
    $('#bA').textContent = ft || has || G.drill ? 'Shoot' : 'Jump';
    $('#bA').className = 'btn a ' + (has || ft || G.drill ? 'shoot' : 'jump');
    $('#bB').textContent = has ? 'Pass' : off ? 'Call' : 'Steal';
    $('#bB').classList.toggle('lit', !has && (off ? G.callT > 0 : G.phase === 'live' && exposed(u, G.ball.holder) > 0));
    $('#bC').textContent = has ? 'Move' : off ? 'Cut' : G.switching ? 'Switch' : 'Help';
    if (G.drill && G.drill.kind === 'dunk') { $('#bA').textContent = 'Dunk'; $('#bC').textContent = 'Style'; }
    const pk = has && !u.inb && !G.drill && G.phase === 'live' && along(u.z, u.team) < RIM;
    $('#bD').classList.toggle('on', pk);
    if (pk && G.t > 12 && seenTips && seenTips.ball && $('#tipcard').hidden) tip('pick');   // after the ball tip has had its moment
  }
  /* call for a pick: the nearest big comes to set a screen on your man, then rolls to the rim */
  function pressD() {
    const u = G.user; if (!u || G.phase !== 'live' || G.ball.holder !== u || u.inb || G.drill) return;
    if (G.t < (G.pickCd || 0)) return;
    const bigs = teamOf(u.team).filter(o => o !== u && o.slot >= 3).sort((a, b) => hyp(a.x - u.x, a.z - u.z) - hyp(b.x - u.x, b.z - u.z));
    const s = bigs[0] || teamOf(u.team).filter(o => o !== u)[0]; if (!s) return;
    s.screen = 3.2; G.pickCd = G.t + 4;
    toast('Pick called', 'call'); buzz(8);
  }

  /* ---------- ball helpers ---------- */
  function give(p, why) {
    const b = G.ball;
    const changed = G.poss !== p.team;
    if (G.inb) { G.inb.p.inb = false; G.inb = null; }
    b.state = 'held'; b.holder = p; p.hold = 0; p.think = 0.2 + rand() * 0.2; delete p.post;
    b.lastTouch = p.team;
    if (changed) { G.poss = p.team; G.shotClock = 24; G.callT = 0; G.possN = (G.possN || 0) + 1;
      if (G.phase === 'live' && !p.inb) G.transT = G.t;   // a live-ball change of hands (a steal, a board): the break is on
      if (G.play && p.team === 0) { G.play.left--; G.play.done = false; if (G.play.left < 0) { G.play = null; } } }
    if (why === 'oreb') G.shotClock = Math.max(G.shotClock, 14);
  }
  function inboundTo(team, at) {
    /* the man of that team nearest the spot takes it (after a basket: whoever is under the rim) */
    let best = null, bd = 1e9;
    for (const p of teamOf(team)) { const d = hyp(p.x - at.x, p.z - at.z); if (d < bd) { bd = d; best = p; } }
    give(best);
    G.ball.passer = null;
  }
  /* a dead ball taken out of bounds: a teammate steps out on the line (the baseline after a basket, else the nearest
     sideline) and passes it in. Neither clock runs until the pass; the computer looks for the open man after a beat,
     and if you are the one out there, Pass throws it (it goes on its own after four seconds). */
  function inboundOut(team, at, baseline) {
    const mates = teamOf(team), pool = mates.filter(o => !o.isUser || G.switching);
    let best = null, bd = 1e9;
    for (const p of (pool.length ? pool : mates)) { const d = hyp(p.x - at.x, p.z - at.z); if (d < bd) { bd = d; best = p; } }
    const sz = Math.sign(at.z) || 1;
    if (baseline || Math.abs(at.z) > 43) { best.x = clamp(at.x, -12, 12) || (rand() < 0.5 ? -5 : 5); best.z = sz * 48.2; best.face = sz > 0 ? Math.PI : 0; }
    else { const sx = Math.sign(at.x) || (rand() < 0.5 ? -1 : 1); best.x = sx * 26.4; best.z = clamp(at.z, -42, 42); best.face = sx > 0 ? -Math.PI / 2 : Math.PI / 2; }
    best.vx = best.vz = 0; best.shoot = null; best.drive = 0;
    give(best);
    G.ball.passer = null;
    /* after a basket the game clock keeps running, except in the last two minutes of the fourth and overtime */
    const stop = !baseline || (G.q >= 4 && G.clock < 120);
    best.inb = true; G.inb = { p: best, t: 0, wait: rr(0.9, 1.6) * (stop ? 1 : 0.7), stop };
    G.ball.x = best.x; G.ball.z = best.z;
  }
  function inboundStep(dt) {
    const I = G.inb, p = I.p;
    if (G.ball.holder !== p) { p.inb = false; G.inb = null; return; }
    I.t += dt; p.vx = p.vz = 0; p.pose = 'hold';
    p.face = Math.atan2(0 - p.x, 0 - p.z * 0.4);   // toward the floor
    const manual = p.isUser && !G.auto;
    if ((!manual && I.t > I.wait) || I.t > 4) {
      let r = bestPass(p);
      if (!r || hyp(r.x - p.x, r.z - p.z) > 50) r = teamOf(p.team).filter(o => o !== p).sort((a, c) => hyp(a.x - p.x, a.z - p.z) - hyp(c.x - p.x, c.z - p.z))[0];
      if (r) { p.inb = false; G.inb = null; passTo(p, r); }
    }
  }
  function turnover(p, why, giveTo, at) {
    for (const o of G.pl) { o.shoot = null; o.drive = 0; }
    if (p && rand() < 0.4) { const m = G.pl.find(o => o.team === p.team && o !== p && !o.isUser); if (m) setTimeout(() => CH('ch_back', m), 500); }
    if (p) { p.st.tov++; if (p === G.user) grade(-3, why); }
    feed(`${why}${p ? ' · ' + p.name : ''}`);
    G.poss = null;
    const spot = at || { x: G.ball.x, z: G.ball.z };
    dead(0.9, () => inboundOut(giveTo, { x: clamp(spot.x, -24, 24), z: clamp(spot.z, -46, 46) }));
  }
  function dead(t, then) { G.phase = 'dead'; G.deadT = t; G.then = then; subs(); }
  /* ---------- the bench: computer players tire as they play and rest on the bench; at a dead ball a tired man comes
     out for a fresh one, and a rested starter goes back in for his reserve. You never come out. ---------- */
  const IDENT = ['d', 'r', 'ht', 'name', 'num', 'st', 'energy'];
  function subs() {
    if (!G.bench || G.drill || G.phase === 'end') return;
    const Q = (G.qlen || 3) * 60;
    for (const t of [0, 1]) {
      let n = 0;
      for (const p of G.pl) {
        if (p.team !== t || p.isUser || (G.user && p.d.id === G.user.d.id) || n >= 2) continue;
        if (G.ftq && G.ftq.shooter === p) continue;
        const bench = G.bench[t], st = G.starters[t][p.slot];
        let inn = null;
        if (p.d !== st.d && st.energy > 0.88 && bench.includes(st)) inn = st;                 // the starter, rested, back in
        else if ((p.energy ?? 1) < 0.45) {                                                      // tired: the freshest man who fits
          const c = bench.filter(b => b.energy > 0.7).sort((a, b) => (b.d.pos === p.d.pos) - (a.d.pos === p.d.pos) || b.energy - a.energy || b.d.ovr - a.d.ovr)[0];
          inn = c || null;
        }
        if (!inn) continue;
        const out = {}; for (const k of IDENT) out[k] = p[k];
        bench.splice(bench.indexOf(inn), 1); bench.push(out);
        for (const k of IDENT) p[k] = inn[k];
        p.shoot = null; p.drive = 0; p.pose = ''; delete p.post;
        if (G.starters[t][p.slot].d === out.d) G.starters[t][p.slot] = out; else if (G.starters[t][p.slot].d === p.d) G.starters[t][p.slot] = inn;
        if (!G.played.includes(p.st)) G.played.push(p.st), G.playedBy.push({ d: p.d, team: t });
        R.removePlayer && R.removePlayer(p); R.addPlayer(p, G.kits[t]);
        if (t === 0 || rand() < 0.3) feed(`${t === 0 ? '' : G.teams[1].name + ': '}${p.name} in for ${out.name}`);
        if (t === 0 && n === 0 && rand() < 0.3) B('subs_ana', { prio: 1 });
        n++;
      }
    }
  }
  /* tiring and resting, on the floor and on the bench */
  function fatigue(dt) {
    if (!G.bench) return;
    const Q = (G.qlen || 3) * 60, drain = 0.55 / (0.75 * Q), rest = 0.45 / (0.3 * Q);   // a starter's stint: most of a quarter
    for (const p of G.pl) if (!p.isUser && !(G.user && p.d.id === G.user.d.id)) { const sp = hyp(p.vx, p.vz); p.energy = Math.max(0, (p.energy ?? 1) - dt * drain * (sp > 12 ? 1.4 : sp > 4 ? 1 : 0.6)); }
    for (const t of [0, 1]) for (const b of G.bench[t]) b.energy = Math.min(1, (b.energy ?? 1) + dt * rest);
  }

  function handPos(p) {
    /* the model's real hand when there is one: the ball leaves from where it is */
    const H = R.hands && R.hands(p);
    /* a layup, a floater or a hook goes up off one hand */
    if (H && p.shoot && (p.shoot.kind === 'layup' || p.shoot.kind === 'floater' || p.shoot.kind === 'hook')) { const h = p.dribHand < 0 ? H.l : H.r; return { x: h.x, y: h.y + 0.3, z: h.z }; }
    if (H) return p.shoot || p.pose === 'shoot' ? { x: (H.r.x + H.l.x) / 2, y: Math.max(H.r.y, H.l.y) + 0.35, z: (H.r.z + H.l.z) / 2 } : p.dribHand < 0 ? { x: H.l.x, y: H.l.y, z: H.l.z } : { x: H.r.x, y: H.r.y, z: H.r.z };
    const fx = Math.sin(p.face), fz = Math.cos(p.face);
    return { x: p.x + fx * 0.6 + fz * 0.5, y: p.ht / 12 * 0.95 + p.y + 1.5, z: p.z + fz * 0.6 - fx * 0.5 };
  }

  /* ---------- shooting ---------- */
  function startShot(p, forUser, force) {
    if (p.shoot || G.ball.holder !== p) return;
    const d = distHoop(p.x, p.z, p.team);
    const sp = hyp(p.vx, p.vz);
    let kind = 'jumper';
    if (G.drill && G.drill.kind === 'dunk') return dunkJump(p, d);
    if (d < 9) {
      const dunkOk = p.r.dunk >= 55 && d < 7.5 && (sp > 5 || p.ht >= 82) && rand() < 0.35 + (p.r.dunk - 55) / 60 + 0.12 * bt(p, 'poster');
      kind = dunkOk ? 'dunk' : 'layup';
    } else if (d < 13 && sp > 7 && !isThree(p.x, p.z, p.team)) kind = 'floater';   // a runner on the move: lofted over the bigs
    if (force) kind = force;
    /* yours: a big who goes up contested in the paint shoots a hook; a jumper drifting away from the rim is a fadeaway */
    let fade = false;
    if (forUser && !force) {
      if (kind !== 'dunk' && ['PF', 'C'].includes(p.d.pos) && d > 4 && d < 15 && (nearestDef(p).d < 4 || p.postUp > 0)) kind = 'hook';
      if (p.postUp > 0) { p.postUp = 0; p.postHookT = G.t; }
      else if (kind === 'jumper' && d > 8 && d < 22) { const hx = 0 - p.x, hz = hoopZ(p.team) - p.z, L = hyp(hx, hz) || 1; if ((p.vx * hx + p.vz * hz) / L < -3.5) fade = true; }
    }
    const js = kind === 'jumper' && p.d.look ? p.d.look.jumper : null;   // your jump shot: quick or high
    const T = (kind === 'jumper' ? 0.82 - p.r.mid * 0.0012 : kind === 'dunk' ? 0.5 : kind === 'floater' || kind === 'hook' ? 0.5 : 0.55) * (js === 'quick' ? 0.84 : js === 'high' ? 1.1 : 1);
    const peak = kind === 'jumper' ? 1.4 + p.r.vert * 0.014 : kind === 'dunk' ? 2.6 + p.r.vert * 0.02 : 1.8 + p.r.vert * 0.012;
    const tp = T * 0.82;
    p.jg = 2 * peak / (tp * tp); p.vy = p.jg * tp;
    if (js === 'high') p.highT = G.t;
    p.shoot = { t: 0, T, kind, user: !!forUser, three: isThree(p.x, p.z, p.team), d, fade, js,
      /* AI: when it lets go (near the top, a little early or late) */
      aiRel: clamp(0.82 + PB.gauss() * (0.09 - p.r.mid * 0.0006), 0.55, 1.1) };
    p.pose = kind === 'dunk' ? (rand() < 0.55 ? 'dunk1' : 'celebrate') : 'shoot';
    /* a breakaway with nobody near: a flier shows off (a windmill, a reverse, a 360) */
    p.showoff = null;
    if (kind === 'dunk' && nearestDef(p).d > 12 && (p.r.dunk || 0) + (p.r.vert || 0) >= 150 && rand() < 0.55) {
      const st = STYLES[1 + Math.floor(rand() * 4)];
      p.pose = st[1]; p.spin = { total: st[4], t: 0, T: 2 * T * 0.82 }; p.spinA = 0; p.showoff = st[0];
    }
    if (kind === 'jumper') { const k = fade ? 0.45 : 0.2; p.vx *= k; p.vz *= k; }   // a fadeaway keeps drifting back
    if (fade) p.fadeT = G.t;
    /* a defender close by goes up with him */
    for (const o of G.pl) if (o.team !== p.team && !o.isUser && hyp(o.x - p.x, o.z - p.z) < 7 && rand() < 0.75) o.contestT = rr(0.05, 0.25);
    if (kind === 'jumper' && rand() < 0.3) { const o = nearestDef(p).who; if (o && !o.isUser) CH('ch_shot', o); }
  }

  /* the contest dunk: up from wherever you are inside the free-throw line, carried to the rim, the dunk you picked */
  function dunkJump(p, d) {
    if (d > 16) { toast('Closer: inside the free-throw line', ''); return; }
    const st = STYLES[G.drill.style], T = 0.62, tp = T * 0.82, peak = 2.8 + (p.r.vert || 70) * 0.02 + Math.max(0, d - 8) * 0.06;
    p.jg = 2 * peak / (tp * tp); p.vy = p.jg * tp;
    const hx = 0 - p.x, hz = hoopZ(p.team) - dirOf(p.team) * 1.1 - p.z, L = hyp(hx, hz) || 1, v = Math.max(0, L - 0.4) / tp;
    p.vx = hx / L * v; p.vz = hz / L * v; p.face = Math.atan2(hx, hz);
    p.shoot = { t: 0, T, kind: 'dunk', user: true, three: false, d, style: G.drill.style, aiRel: 0.82 };
    p.pose = st[1]; p.spin = { total: st[4], t: 0, T: 2 * tp }; p.spinA = 0;
  }

  /* Release: timing grade for you, then a block, a foul, then make or miss. */
  /* violations: eight seconds to get it over half court, never back over once there, and (you) three seconds in the lane */
  const tally = k => { const T = G.tally || (G.tally = {}); T[k] = (T[k] || 0) + 1; };   // for tools/balance.js
  const HALF = RIM;   // along() at the half-court line
  function violations(dt) {
    const b = G.ball, t = G.poss;
    if (G.drill || t === null || t === undefined || (b.state !== 'held' && b.state !== 'pass')) { if (G.user) G.user.lane = 0; return false; }
    const V = G.vio && G.vio.n === G.possN ? G.vio : (G.vio = { n: G.possN, crossed: false, start: G.shotClock });
    const h = b.state === 'held' ? b.holder : null;
    const a = h ? along(h.z, t) : along(b.z, t);   // the holder, not the ball: the ball is still where it was the moment he gets it
    if (!V.crossed && a < HALF - 0.5 && (!h || h.team === t)) V.crossed = true;
    if (!V.crossed && V.start - G.shotClock > 8) {
      toast('8 SECONDS', t === 0 ? 'opp' : ''); AU().play('whistle'); feed('Eight-second violation'); tally('8 sec'); B('eight', { prio: 3 });
      turnover(h || b.from, '8-second violation', 1 - t, { x: b.x, z: 0 }); return true;
    }
    if (V.crossed && h && h.team === t && along(h.z, t) > HALF + 0.5 && b.lastTouch === t) {
      toast('BACKCOURT', t === 0 ? 'opp' : ''); AU().play('whistle'); feed('Backcourt violation'); tally('backcourt'); B('backcourt', { prio: 3 });
      turnover(h, 'Backcourt violation', 1 - t, { x: h.x, z: 0 }); return true;
    }
    const u = G.user;
    if (u && !G.auto && u.team === t && !u.shoot && !(h === u && u.drive > 0)) {
      const al = along(u.z, t);
      u.lane = Math.abs(u.x) < 8 && al < 13.75 && al > -5 ? (u.lane || 0) + dt : 0;
      if (u.lane > 2 && !u.laneWarn) { u.laneWarn = true; toast('Out of the lane', ''); buzz(8); }
      if (u.lane < 1) u.laneWarn = false;
      if (u.lane > 3.2) {
        u.lane = 0; toast('3 SECONDS', 'opp'); AU().play('whistle'); feed('Three seconds in the lane'); tally('3 sec'); B('three_sec', { prio: 3 });
        turnover(u, '3 seconds in the lane', 1 - t, { x: 25 * Math.sign(u.x || 1), z: u.z }); return true;
      }
    } else if (u) u.lane = 0;
    return false;
  }

  function release(p, meter) {
    const s = p.shoot; if (!s) return;
    p.shoot = null;
    G.possN = (G.possN || 0) + 1;   // a shot ends team control: a long rebound may be taken in the backcourt
    const b = G.ball;
    const hp = handPos(p);
    let prob = baseProb(p, p.x, p.z, s.kind) * (s.js === 'quick' ? 0.97 : 1) * (s.fade ? 0.9 + 0.025 * bt(p, 'fade') : 1) * (s.kind === 'hook' ? 1 + 0.025 * bt(p, 'post') : 1);
    let timing = '';
    if (s.user) {
      const w = (0.045 + (s.kind === 'jumper' ? (s.three ? p.r.three : p.r.mid) : p.r.close) * 0.0006) * timingEase() * (tkoOn() ? 1.4 : 1);
      const err = meter - 0.82;
      const ae = Math.abs(err);
      if (ae <= w) { timing = 'Excellent'; prob = prob + (1 - prob) * 0.62; }
      else if (ae <= w * 2.2) { timing = err < 0 ? 'Slightly early' : 'Slightly late'; }
      else if (ae <= w * 4) { timing = err < 0 ? 'Early' : 'Late'; prob *= 0.72; }
      else { timing = err < 0 ? 'Very early' : 'Very late'; prob *= 0.35; }
      showRelease(timing, meter, w); buzz(timing === 'Excellent' ? [12, 40, 12] : 10);
      R.flash(timing === 'Excellent' ? 0x4cffb0 : /Slightly/.test(timing) ? 0xffffff : 0xff5a6b);
    } else {
      const err = Math.abs(s.aiRel - 0.82);
      prob *= err < 0.05 ? 1.08 : err < 0.12 ? 1 : 0.8;
      prob *= p.team === 1 ? G.diff.oppShot : G.diff.mateShot;
    }
    if (p.energy !== undefined && p.energy < 0.35) prob *= 0.88 + p.energy * 0.34;   // tired legs, short shots
    if (G.drill && G.drill.kind === 'dunk') prob = clamp(0.97 * STYLES[s.style || 0][3] * (0.82 + ((p.r.dunk || 70) - 60) / 220) - Math.max(0, s.d - 9) * 0.035, 0.2, 0.99) * (timing === 'Excellent' ? 1.06 : /Slightly/.test(timing) ? 1 : /Very/.test(timing) ? 0.55 : 0.8);
    let cf = contest(p);
    if (s.kind === 'dunk') cf = 1 - (1 - cf) * 0.3;   // a hand in the face barely matters above the rim
    else if (s.kind === 'hook') cf = 1 - (1 - cf) * 0.6;   // the hook goes up over the defender
    prob = clamp(prob * cf, 0.01, 0.985);
    if (p.isUser && tkoOn()) prob = clamp(prob + (1 - prob) * 0.2, 0.01, 0.985);   // Takeover: hot hands
    if (timing === 'Excellent') prob = 1;   // a perfect release goes in: only a block stops it
    const nd = nearestDef(p);
    /* how covered you were, next to the timing: a miss explains itself */
    if (s.user && timing) { const cov = nd.d > 6 ? 'Wide open' : nd.d > 3.5 ? 'Open' : nd.d > 2 ? 'Contested' : 'Smothered'; $('#rel').textContent = `${timing === 'Excellent' ? 'Perfect' : timing} · ${cov}${s.fade ? ' · Fadeaway' : s.kind === 'hook' ? ' · Hook' : ''}`; }
    /* your defense on the shot, said out loud: it is how you learn what a good contest is */
    { const u = G.user;
      if (u && p.team !== u.team && !G.drill && s.kind !== 'dunk' && !s.oop && (nd.who === u || u.slot === p.slot)) {
        const du = hyp(u.x - p.x, u.z - p.z), up = u.y > 0.3 || u.pose === 'contest';
        if (du < 2.4 && up) { toast('Smothered', 'make'); grade(1.5, 'Smothered the shot'); }
        else if (du < 4.2 && up) { toast('Good contest', 'make'); grade(1, 'Contested the shot'); }
        else if (du < 4.2) toast('Hand down', 'call');
        else if (du < 8) toast('Late contest', 'call');
        else if (u.slot === p.slot) { toast('Left him open', 'opp'); grade(-1, 'Left your man open'); }
      } }
    p.st.fga++; if (s.three) p.st.tpa++;
    G.lastShot = { shooter: p, three: s.three, open: nd.d, prob, guard: nd.who };
    (G.shotLog = G.shotLog || []).push({ kind: s.three ? 'three' : s.oop ? 'oop' : s.kind, prob, d: s.d, x: p.x, a: along(p.z, p.team), user: p.isUser, team: p.team });
    /* block: a defender in the air in front of the shot */
    for (const o of G.pl) {
      if (o.team === p.team) continue;
      const d = hyp(o.x - p.x, o.z - p.z);
      if (d > 4.5 || (o.y < 0.4 && o.pose !== 'contest')) continue;
      const ch = (o.r.block / 99) * (s.kind === 'jumper' ? 0.05 : s.kind === 'dunk' ? 0.07 : 0.33) * (1 - d / 4.5) * (o.ht >= p.ht ? 1.15 : 0.8) * (o.isUser ? 1.3 : 1) * (1 + 0.2 * bt(o, 'rim'));
      if (rand() < ch) { blockShot(o, p, { x: hp.x, y: hp.y + 0.6, z: hp.z }); return; }
    }
    /* foul on the shot */
    let foul = null;
    /* contact on a drive that is not on the shot: a team foul; in the bonus (five in the quarter) it is two shots */
    if (nd.d < (s.kind === 'jumper' ? 3.4 : 5)) {
      const fp = s.kind === 'jumper' ? 0.07 : s.kind === 'dunk' ? 0.3 : 0.34;
      if (rand() < fp) foul = nd.who;
    }
    const made = rand() < prob;
    if (made && s.kind === 'dunk' && !G.drill && rand() < 0.6) p.hangPlan = true;
    const pts = s.three ? 3 : 2;
    b.state = 'shot'; b.holder = null; b.lastTouch = p.team;
    b.sx = hp.x; b.sy = hp.y; b.sz = hp.z; b.t = 0;
    const rz = hoopZ(p.team);
    if (made) { b.ex = 0; b.ez = rz; b.ey = 10.3; }
    else { const a = rand() * 6.28, m = rr(0.55, 1.0); b.ex = Math.sin(a) * m; b.ez = rz + Math.cos(a) * m - dirOf(p.team) * 0.2; b.ey = 10.1; }
    const d = s.d;
    b.dur = s.kind === 'dunk' ? 0.22 : 0.42 + d * 0.026;
    b.apex = s.kind === 'dunk' ? 0.2 : s.kind === 'layup' ? 2 : s.kind === 'floater' || s.kind === 'hook' ? 5.5 : 3.5 + d * 0.2;
    G.shotLog[G.shotLog.length - 1].made = made;
    b.shot = { oop: !!s.oop, shooter: p, made, pts, foul, kind: s.kind, timing, prob, d: s.d, style: s.style, fade: !!s.fade, caught: p.caughtT !== undefined && G.t - p.caughtT < 1.5 };
    if (foul) { foul.st.pf++; G.tf[foul.team]++; if (foul.isUser) grade(-1, 'Shooting foul'); AU().play('whistle'); checkFoulOut(foul); }
  }

  function blockShot(o, p, at) {
    const b = G.ball;
    if (o.isUser) reelMark('block', 2.6, 'Block');
    o.st.blk++; if (o.isUser) { grade(3, 'Block'); buzz(30); }
    if (p.isUser) grade(-1, 'Got blocked');
    toast('BLOCKED', 'blk'); feed(`Block · ${o.name}`);
    AU().play('block', { x: o.x }); AU().crowd.react(home(o.team) ? 'roar' : 'ooh', home(o.team) ? 1 : 0.8); R.hype(1, 0.5); B('block', { prio: 4, follow: 0.4 });
    b.state = 'loose'; b.holder = null; b.lastTouch = o.team; b.shot = null;
    G.reb = { team: p.team, t: G.t };   // a blocked shot is a missed shot: whoever comes up with it gets the rebound
    b.x = at.x; b.y = at.y; b.z = at.z;
    const ang = rand() * 6.28;
    b.vx = Math.sin(ang) * 10; b.vz = -dirOf(p.team) * rr(6, 14); b.vy = rr(2, 7);
    G.shotClockStop = false;
  }
  /* a hand on the ball in flight: your jump timed on the way up is a block; any hand on it on the way down, over the
     rim, is goaltending and the basket counts. Computer defenders mostly pull their hands away in time. */
  function inFlight(u) {
    const b = G.ball, s = b.shot, p = s.shooter;
    if (s.kind === 'dunk' || s.ft) return;
    for (const o of G.pl) {
      if (o.team === p.team || o.y < 0.3) continue;
      /* what you see is what happens: a defender's hand on the ball on its way up is a block, every time */
      if (u < 0.45 && !(s.seen && s.seen.includes(o))) { const H = R.hands(o);
        if (H) for (const hd of [H.r, H.l]) if (hyp(hd.x - o.x, hd.z - o.z) < 4 && Math.hypot(hd.x - b.x, hd.y - b.y, hd.z - b.z) < 1.15) {
          if (G.shotLog && G.shotLog.length) G.shotLog[G.shotLog.length - 1].made = false;
          blockShot(o, p, { x: b.x, y: b.y, z: b.z }); tally('air block'); return; } }
      const reach = o.ht / 12 * 1.33 + o.y + 0.7;
      if (hyp(o.x - b.x, o.z - b.z) > 2 || b.y > reach) continue;
      const seen = s.seen || (s.seen = []);
      if (seen.includes(o)) continue;
      seen.push(o);
      if (u > 0.55 && b.y > 10 && hyp(b.x, b.z - hoopZ(p.team)) < 5) {
        if (!o.isUser && rand() > 0.2) continue;
        s.made = true; s.gt = true;
        if (G.shotLog && G.shotLog.length) G.shotLog[G.shotLog.length - 1].made = true;
        if (o.isUser) grade(-2, 'Goaltending');
        AU().play('whistle'); shotLands(); B('goaltend', { prio: 5 }); toast('GOALTENDING', o.team === 0 ? 'opp' : 'make'); feed(`Goaltending · ${o.name}`); tally('goaltend');
        return;
      }
      if (u < 0.4 && o.isUser && rand() < 0.15 + o.r.block / 300) {
        if (G.shotLog && G.shotLog.length) G.shotLog[G.shotLog.length - 1].made = false;
        blockShot(o, p, { x: b.x, y: b.y, z: b.z }); tally('air block');
        return;
      }
    }
  }

  let relT = 0;
  function showRelease(txt, m, w) {
    const r = $('#rel'); r.textContent = txt === 'Excellent' ? 'Perfect' : txt; r.className = 'on ' + (txt === 'Excellent' ? 'g' : /Slightly/.test(txt) ? 'y' : 'r');
    relT = 1.4;
  }

  /* ---------- drills: the pre-draft combine and the 3-point contest ----------
     You alone on the floor, a rack of balls at each spot, a clock. A rebounder feeds you the next ball; after the last
     ball of a rack you jog to the next spot. In the contest the last ball of each rack is the money ball, worth two. */
  const DRILLS = {
    contest: { secs: 60, spots: [[-22, 3], [-15.5, 18], [0, 25], [15.5, 18], [22, 3]], balls: 5, money: true, title: '3-Point Contest' },
    combine: { secs: 45, spots: [[-22, 3], [-9, 14], [0, 25], [9, 14], [22, 3]], balls: 3, money: false, title: 'Combine · spot-up shooting' },
    dunk: { secs: 0, spots: [[17, 24], [0, 32], [-17, 24], [23, 5]], dunks: 2, title: 'Dunk Contest' },
    free: { secs: 0, spots: [[0, 18]], title: 'Shoot-around' },
  };
  /* the dunk contest: [name, arms, how hard (the judges' bonus), how often it goes down, the turn in the air] */
  const STYLES = [['Two-hand', 'celebrate', 0, 1, 0], ['Tomahawk', 'dunk1', 0.45, 0.96, 0], ['Reverse', 'dunk1', 0.75, 0.92, Math.PI],
    ['Windmill', 'windmill', 1.05, 0.88, 0], ['360', 'celebrate', 1.4, 0.8, Math.PI * 2]];
  /* each dunk: from a spot, with the ball; drive and jump (from as far as the free-throw line). Move changes the dunk.
     Five judges score it, six to ten each. */
  function dunkSpot() { const D = G.drill, sp = D.def.spots[D.n % D.def.spots.length]; return toCourt(0, sp[0], sp[1]); }
  function dunkStep(dt) {
    const D = G.drill, u = G.user;
    G.clock = 0; G.score[0] = D.score; G.score[1] = Math.min(D.n + 1, D.def.dunks);
    if (D.next > 0) {
      D.next -= dt;
      if (D.next <= 0 && !D.over) {
        D.next = 0; const sp = dunkSpot(); u.x = sp.x; u.z = sp.z; u.vx = u.vz = 0; u.y = 0; u.vy = 0;
        u.face = Math.atan2(0 - u.x, hoopZ(0) - u.z); give(u); u.pose = 'dribble'; D.clock = 24;
      }
    }
    /* 24 seconds to go up, on the shot clock; standing there is a miss */
    if (G.ball.holder === u && !u.shoot && !D.over) {
      D.clock = (D.clock === undefined ? 24 : D.clock) - dt;
      if (D.clock <= 0) { D.clock = 24; G.ball.holder = null; dunkLands({ shooter: u, made: false, d: 0, style: D.style, timing: '' }); }
    }
    G.shotClock = Math.max(0, D.clock === undefined ? 24 : D.clock);
    const st = STYLES[D.style];
    $('#ftmsg').hidden = false;
    $('#ftmsg').textContent = D.over ? `Total ${D.score}` : `Dunk ${D.n + 1} of ${D.def.dunks} · ${st[0]} · Style changes it`;
    if (D.over && G.ball.state !== 'shot') { D.endT = (D.endT || 0) + dt; if (D.endT > 2.6) finish(); }
  }
  /* the shoot-around: shoot from anywhere, the ball comes back to you; no clock. Pause to finish. */
  function freeLands(s) {
    const D = G.drill, b = G.ball;
    D.att++; if (s.made) { D.made++; D.score += s.pts; D.streak = (D.streak || 0) + 1; D.best = Math.max(D.best || 0, D.streak); R.swish(1); AU().play(s.prob > 0.55 || rand() < 0.6 ? 'swish' : 'rimin', { x: b.x }); if (D.streak >= 5 && D.streak % 5 === 0) toast(`${D.streak} straight`, 'make'); }
    else { D.streak = 0; AU().play('rim', { x: b.ex, power: 0.6 }); }
    b.state = 'drop'; b.t = 0; D.next = 0.9;
  }
  function freeStep(dt) {
    const D = G.drill, u = G.user;
    G.clock = 0; G.shotClock = 24; G.score[0] = D.made; G.score[1] = D.att;
    if (D.next > 0) { D.next -= dt; if (D.next <= 0) { D.next = 0; give(u); } }
    $('#ftmsg').hidden = false;
    $('#ftmsg').textContent = `${D.made} of ${D.att}${D.att ? ` · ${Math.round(D.made / D.att * 100)}%` : ''} · streak ${D.streak || 0} (best ${D.best || 0}) · pause to finish`;
  }
  function dunkLands(s) {
    const D = G.drill, b = G.ball, p = s.shooter, st = STYLES[s.style || 0];
    const r = p.r, rate = ((r.dunk || 70) + (r.vert || 70)) / 2;
    const tm = s.timing === 'Excellent' ? 0.7 : /Slightly/.test(s.timing || '') ? 0.2 : -0.5;
    const base = s.made ? 7.1 + st[2] + clamp((s.d - 8) * 0.24, 0, 1.4) + tm + (rate - 75) / 45 : 5.6;
    const judges = [0, 1, 2, 3, 4].map(() => clamp(Math.round(base + PB.gauss() * 0.45), s.made ? 6 : 5, s.made ? 10 : 7));
    const sum = judges.reduce((a, x) => a + x, 0);
    D.scores.push(sum); D.score += sum; D.att++; if (s.made) D.made++;
    if (s.made) { R.swish(1); AU().play('dunk', { x: b.x }); AU().crowd.react(sum >= 45 ? 'roar' : 'applause', sum >= 45 ? 1.2 : 0.7); R.hype(sum >= 45 ? 1.4 : 0.8, sum >= 47 ? 0.8 : 0); buzz([20, 30, 30]); if (sum >= 46) wantReplay('dunk'); }
    else { AU().play('rim', { x: b.ex, power: 0.8 }); AU().crowd.react('aww', 0.8); }
    toast(`${judges.join(' ')} · ${sum}`, s.made ? 'judge' : 'judge miss');
    B(sum === 50 ? 'dk_fifty' : s.made ? 'dk_good' : 'dk_miss', { prio: 4, follow: s.made && sum < 50 ? 0.45 : 0 });
    feed(`${st[0]}${s.made ? '' : ' (missed)'} · ${sum}`);
    if (sum === 50) setTimeout(() => toast('FIFTY!', 'make'), 1400);
    b.state = 'drop'; b.t = 0;
    D.n++;
    if (D.n >= D.def.dunks) D.over = true; else D.next = 2.8;
  }
  function drillSpot() { const D = G.drill, sp = D.def.spots[D.rack]; return toCourt(0, sp[0], sp[1]); }
  function drillLands(s) {
    if (G.drill.kind === 'dunk') { dunkLands(s); return; }
    if (G.drill.kind === 'free') { freeLands(s); return; }
    const D = G.drill, b = G.ball, money = D.def.money && D.ball === D.def.balls - 1;
    D.att++;
    if (s.made) { D.made++; D.score += money ? 2 : 1; R.swish(1); AU().play(s.prob > 0.55 || rand() < 0.6 ? 'swish' : 'rimin', { x: b.x }); AU().crowd.react(money ? 'roar' : 'applause', money ? 0.9 : 0.5); if (money) { toast('MONEY BALL', 'make'); B('moneyball', { prio: 3 }); } buzz([15, 30, 15]); }
    else { AU().play('rim', { x: b.ex, power: 0.6 }); }
    b.state = 'drop'; b.t = 0;
    D.ball++;
    if (D.ball >= D.def.balls) { D.ball = 0; D.rack++; }
    D.next = D.rack >= D.def.spots.length ? -1 : 0.45;
    if (D.next < 0) D.over = true;
  }
  function drillStep(dt) {
    if (G.drill.kind === 'dunk') { dunkStep(dt); return; }
    if (G.drill.kind === 'free') { freeStep(dt); return; }
    const D = G.drill, u = G.user;
    if (!D.over) { D.t -= dt; if (D.t <= 0) { D.t = 0; D.over = true; } }
    G.clock = D.t; G.shotClock = 24; G.score[0] = D.score; G.score[1] = D.att;
    const sp = D.rack < D.def.spots.length ? drillSpot() : { x: u.x, z: u.z };
    if (!u.shoot) { u.tx = sp.x; u.tz = sp.z; seek(u, dt, 1); }
    if (D.next > 0) { D.next -= dt; if (D.next <= 0 && !D.over) { D.next = 0; give(u); u.hold = 0; } }
    const left = D.rack < D.def.spots.length ? `Rack ${D.rack + 1} · ball ${D.ball + 1}${D.def.money && D.ball === D.def.balls - 1 ? ' (money)' : ''}` : 'Done';
    $('#ftmsg').hidden = false; $('#ftmsg').textContent = `${left} · ${D.score} pts`;
    if (R.rackLeft) R.rackLeft(D.rack, D.ball + (G.ball.holder === u || G.ball.state === 'shot' ? 1 : 0));
    if (D.over && G.ball.state !== 'shot') { D.endT = (D.endT || 0) + dt; if (D.endT > 1.2) finish(); }
  }

  function shotLands() {
    const b = G.ball, s = b.shot, p = s.shooter;
    if (G.drill) { drillLands(s); return; }
    if (s.made) {
      G.score[p.team] += s.pts;
      p.st.pts += s.pts; p.st.fgm++; if (s.pts === 3) p.st.tpm++;
      if (s.kind === 'dunk') p.st.dunk++; else if (s.kind === 'layup' || s.kind === 'floater' || s.kind === 'hook') p.st.lay++; else if (s.pts === 2) p.st.mid++;
      if (s.pts === 3 && s.caught) p.st.cs3++;
      if (s.fade) p.st.fade++; if (s.kind === 'hook') p.st.hookm++;
      if (clutchTime()) p.st.clutch += s.pts;
      R.swish(p.team === 0 ? 1 : -1);
      AU().play(s.kind === 'dunk' ? 'dunk' : s.prob > 0.55 || rand() < 0.62 ? 'swish' : 'rimin', { x: b.x });
      if (home(p.team)) AU().crowd.react('roar', s.kind === 'dunk' ? 1.2 : s.pts === 3 ? 1 : 0.65);
      if (home(p.team) || s.kind === 'dunk') R.hype(s.kind === 'dunk' ? 1.4 : s.pts === 3 ? 1 : 0.6, s.kind === 'dunk' ? 0.9 : 0); else AU().crowd.react(rand() < 0.5 ? 'groan' : 'aww', s.pts === 3 ? 0.8 : 0.5);
      if (s.foul) { AU().crowd.react('roar', 1.1); }
      /* the call: a buzzer-beater, a hot hand, an and-one, or the shot itself */
      if (p.isUser) { G.streak = (G.streak || 0) + 1; if (tkoOn()) G.tko.miss = 0; }
      const run = G.run && G.run.team === p.team ? G.run : (G.run = { team: p.team, pts: 0, said: false });
      run.pts += s.pts;
      if ((s.kind === 'dunk' || s.pts === 3) && home(p.team) && R.board) R.board(s.kind === 'dunk' ? 'SLAM!' : 'SPLASH!', 2.2);
      if (s.kind === 'dunk' && p.showoff) { toast(p.showoff.toUpperCase() + '!', p.team === 0 ? 'make' : 'opp'); AU().crowd.react('roar', 1.3); if (p.isUser) reelMark('dunk', 5, p.showoff + ' dunk'); }
      p.showoff = null;
      if (s.kind === 'dunk' || G.clock <= 0.05 || (p.isUser && s.foul)) wantReplay(s.kind);
      if (s.oop && p.isUser) grade(1, 'Alley-oop');
      if (p.isUser && G.q >= 4 && G.clock < 5 && G.score[p.team] > G.score[1 - p.team] && G.score[p.team] - s.pts <= G.score[1 - p.team]) G.userWinner = true;
      if (G.clock <= 0.05) B('buzzer', { prio: 6 });
      else if (p.isUser && G.streak === 3) B('hot', { prio: 5, follow: 0.6 });
      /* the home crowd starts the chant when you are rolling */
      if (p.isUser && home(p.team) && !G.mvpSaid && (G.streak >= 3 || p.st.pts * 12 / G.qlen >= 20)) { G.mvpSaid = true; setTimeout(() => AU().crowd.react('mvp', 1), 1500); }
      else if (s.oop) B('oop', { prio: 5 });
      else if (s.pts === 3 && p.stepT !== undefined && G.t - p.stepT < 2) B('stepback', { prio: 4 });
      else if (s.foul) B('and1', { prio: 4 });
      else if (s.fade) B('fade', { prio: 4 });
      else if (s.kind === 'hook') B('hookshot', { prio: 3 });
      else if (s.kind === 'dunk' && p.showoff) B('showoff', { prio: 5 });
      else B(s.kind === 'dunk' ? 'dunk' : s.pts === 3 ? 'three' : s.kind === 'layup' ? 'layup' : 'jumper', { prio: s.kind === 'dunk' || s.pts === 3 ? 3 : 2, follow: s.pts === 3 ? 0.3 : s.kind === 'dunk' ? 0.35 : 0.15 });
      if (run.pts >= 8 && !run.said) { run.said = true; setTimeout(() => B('run', { prio: 1 }), 2600); }
      /* assist: a pass that set it up in the last few seconds */
      let ast = null;
      if (b.passer && b.passer.team === p.team && b.passer !== p && G.t - b.passT < 3.2 && (p.hold || 0) < 2.4) { ast = b.passer; ast.st.ast++; }
      if (s.kind === 'dunk' && R.shock) R.shock(0, hoopZ(p.team) - (p.team === 0 ? 1 : -1) * 1.5, 10);
      const call = s.kind === 'dunk' ? 'SLAM' : s.pts === 3 ? 'SPLASH' : 'BUCKET';
      if (p.team === 0) toast(call + (s.foul ? ' · AND ONE' : ''), 'make'); else toast(`${p.name} scores`, 'opp');
      feed(`${p.name} ${s.oop ? 'alley-oop' : s.kind === 'dunk' ? 'dunk' : s.pts === 3 ? 'three' : s.kind === 'layup' ? 'layup' : s.kind === 'hook' ? 'hook shot' : s.kind === 'floater' ? 'floater' : 'jumper'}${ast ? ` (${ast.name} ast)` : ''}`);
      if (p.isUser) { grade(s.pts === 3 ? 4 : 3, s.pts === 3 ? 'Made three' : 'Scored'); buzz([20, 30, 30]); }
      if (p.isUser && (s.pts === 3 || s.kind === 'dunk' || s.foul)) { celebrate(p, s.foul ? ['chest', 'flex'] : s.kind === 'dunk' ? ['roar', 'flex', 'chest'] : ['goggles', 'three', 'point']); for (const m of G.pl) if (m.team === p.team && m !== p && hyp(m.x - p.x, m.z - p.z) < 20 && rand() < 0.6) { m.pose = 'celebrate'; setTimeout(() => { if (m.pose === 'celebrate') m.pose = ''; }, 1100); } if (rand() < 0.5) { const m = G.pl.find(o => o.team === p.team && !o.isUser); if (m) setTimeout(() => CH('ch_nice', m), 900); } }
      else if (!p.isUser && (s.kind === 'dunk' || s.foul || (s.pts === 3 && p.r.three > 80)) && rand() < 0.35) celebrate(p, s.kind === 'dunk' ? ['roar', 'flex'] : s.foul ? ['chest'] : ['three', 'goggles']);
      if ((s.pts === 3 || s.kind === 'dunk' || s.foul || G.clock <= 0.05) && R.benchJump) R.benchJump(p.team);
      if (p.isUser || (ast && ast.isUser)) {
        const v = (s.kind === 'dunk' ? 3 : s.pts === 3 ? 2.5 : 1) + (s.foul ? 1 : 0) + (s.oop ? 1 : 0) + (G.clock <= 0.05 ? 4 : clutchTime() ? 1 : 0) + (p.isUser ? 0 : -0.8);
        const what = !p.isUser ? 'Your assist' : s.oop ? 'Alley-oop' : s.kind === 'dunk' ? 'Dunk' : s.pts === 3 ? 'Three' : s.kind === 'layup' ? 'Layup' : 'Bucket';
        if (v >= 2) reelMark(s.kind, v, what + (s.foul ? ' and one' : '') + (G.clock <= 0.05 ? ' at the buzzer' : ''));
      }
      if (ast && ast.isUser) grade(3, 'Assist');
      /* the man you guard scored */
      if (G.user && p.team === 1 && G.user.slot === p.slot && hyp(G.user.x - p.x, G.user.z - p.z) < 9) grade(-2, 'Your man scored');
      b.state = 'drop'; b.t = 0;
      if (s.foul) { G.ftq = { shooter: p, n: 1, total: 1, and1: true }; dead(1.3, startFT); }
      else { G.poss = null; dead(1.1, () => inboundOut(1 - p.team, { x: 0, z: hoopZ(p.team) }, true)); }
    } else {
      /* off the rim */
      if (rand() < 0.3) { const o = G.pl.filter(q => q.team !== p.team && !q.isUser).sort((a, c) => distHoop(a.x, a.z, p.team) - distHoop(c.x, c.z, p.team))[0]; if (o) CH('ch_box', o); }
      if (p.isUser) {
        if (G.lastShot.prob < 0.22) grade(-2, 'Forced a bad shot');
        else if (G.lastShot.prob < 0.32 && G.shotClock > 10) grade(-1, 'Tough shot early');
      }
      if (G.lastShot.guard && G.lastShot.open < 4) G.lastShot.guard.st.cmiss++;
      if (G.user && p.team === 1 && G.lastShot.guard === G.user && G.lastShot.open < 4) grade(1.5, 'Contested miss');
      if (s.foul) {
        G.ftq = { shooter: p, n: s.pts, total: s.pts };
        b.state = 'drop'; b.t = 0; b.shot.made = false;
        dead(1.1, startFT);
        return;
      }
      AU().play(rand() < 0.3 ? 'board' : 'rim', { x: b.ex, power: rr(0.5, 1) });
      if (p.isUser) G.streak = 0;
      if (p.isUser && tkoOn() && ++G.tko.miss >= 2) tkoEnd('Cooled off');
      if (rand() < 0.22) B('miss', { prio: 1, follow: 0.3 });
      if (home(p.team) && G.lastShot.prob > 0.4) AU().crowd.react('aww', 0.6); else if (!home(p.team) && rand() < 0.4) AU().crowd.react('roar', 0.35);
      /* close misses rattle: a hop or two on the rim before it falls off */
      if (rand() < 0.35 && s.kind !== 'dunk') { b.state = 'rattle'; b.t = 0; b.rim = { cx: 0, cz: hoopZ(p.team), hops: 1 + Math.floor(rand() * 2), team: p.team }; G.reb = { team: p.team, t: G.t }; return; }
      b.state = 'loose'; b.x = b.ex; b.y = b.ey; b.z = b.ez;
      const out = hyp(b.ex, b.ez - hoopZ(p.team)) || 1;
      const dx = b.ex / out, dz = (b.ez - hoopZ(p.team)) / out;
      const sp = rr(4, 12);
      b.vx = dx * sp + rr(-3, 3); b.vz = dz * sp - dirOf(p.team) * rr(2, 6); b.vy = rr(6, 13);
      G.shotClock = Math.max(G.shotClock, 0.01);
      G.reb = { team: p.team, t: G.t };
    }
  }

  /* ---------- free throws ---------- */
  function startFT() {
    const q = G.ftq, p = q.shooter, t = p.team;
    G.phase = 'ft'; G.ftWait = p.isUser && !G.auto ? 0 : 1.1; G.ftT0 = G.t;
    G.poss = t;
    /* line everyone up: shooter at the line, two from each side on the lane, the rest behind the arc */
    const lane = [[-8.7, 7], [8.7, 7], [-8.7, 11], [8.7, 11], [-8.7, 14], [8.7, 14]];
    let li = 0;
    for (const o of G.pl) {
      o.vx = o.vz = 0; o.y = 0; o.shoot = null; o.pose = '';
      if (o === p) { const s = toCourt(t, 0, 13.75); o.x = s.x; o.z = s.z; o.face = t === 0 ? 0 : Math.PI; continue; }
      const own = o.team === t;
      if ((own && li < 6 && o.slot >= 3) || (!own && li < 6 && o.slot >= 2)) {
        const s = toCourt(t, lane[li][0], lane[li][1]); li++; o.x = s.x; o.z = s.z;
      } else { const s = toCourt(t, (o.slot - 2) * 9 + (own ? 2 : -2), 27 + (own ? 3 : 0)); o.x = s.x; o.z = s.z; }
      o.face = Math.atan2(0 - o.x, hoopZ(t) - o.z);
    }
    G.ball.state = 'held'; G.ball.holder = p;
    $('#ftmsg').textContent = `Free throw ${q.total - q.n + 1} of ${q.total}`; $('#ftmsg').hidden = false;
    AU().play('whistle', { vol: 0.6 });
  }
  function shootFT(meter) {
    const q = G.ftq, p = q.shooter, b = G.ball;
    let prob = 0.5 + p.r.ft / 99 * 0.42;
    if (p.isUser && !G.auto) {
      const w = (0.05 + p.r.ft * 0.0007) * timingEase(), err = meter - 0.82, ae = Math.abs(err);
      let txt;
      if (ae <= w) { txt = 'Excellent'; prob = 1; }   // a perfect free throw is good
      else if (ae <= w * 2.2) txt = err < 0 ? 'Slightly early' : 'Slightly late';
      else { txt = err < 0 ? 'Early' : 'Late'; prob *= 0.55; }
      showRelease(txt, meter, w);
    }
    const made = rand() < prob;
    p.st.fta++;
    const hp = handPos(p);
    b.state = 'shot'; b.holder = null; b.sx = hp.x; b.sy = hp.y; b.sz = hp.z; b.t = 0;
    const rz = hoopZ(p.team);
    if (made) { b.ex = 0; b.ez = rz; b.ey = 10.3; } else { const a = rr(-1, 1); b.ex = Math.sin(a) * 0.8; b.ez = rz + Math.cos(a) * 0.7 * (rand() < 0.5 ? 1 : -1); b.ey = 10.1; }
    b.dur = 0.85; b.apex = 4.5;
    b.shot = { shooter: p, made, pts: 1, ft: true };
    p.pose = 'shoot';
    q.n--;
    G.phase = 'ftflight';
  }
  function ftLands() {
    const b = G.ball, s = b.shot, p = s.shooter, q = G.ftq;
    if (s.made) {
      G.score[p.team]++; p.st.pts++; p.st.ftm++;
      R.swish(p.team === 0 ? 1 : -1);
      AU().play('swish', { x: b.x }); if (home(p.team)) AU().crowd.react('applause', 0.8);
      if (p.isUser) grade(0.6, 'Free throw');
    } else { AU().play('rim', { x: b.ex, power: 0.6 }); if (home(p.team)) AU().crowd.react('aww', 0.6); else AU().crowd.react('roar', 0.4); if (p.isUser) grade(-0.6, 'Missed free throw'); }
    if (q.n > 0) { b.state = 'drop'; b.t = 0; dead(0.9, startFT); return; }
    $('#ftmsg').hidden = true;
    G.ftq = null;
    if (s.made) { b.state = 'drop'; b.t = 0; G.poss = null; dead(1.0, () => { G.phase = 'live'; inboundOut(1 - p.team, { x: 0, z: hoopZ(p.team) }, true); }); }
    else {
      G.phase = 'live';
      b.state = 'loose'; b.x = b.ex; b.y = b.ey; b.z = b.ez;
      b.vx = rr(-6, 6); b.vz = -dirOf(p.team) * rr(3, 9); b.vy = rr(6, 11);
      G.reb = { team: p.team, t: G.t };
    }
  }

  /* ---------- passing ---------- */
  function passTo(p, r) {
    const b = G.ball;
    if (b.holder !== p || p.shoot) return;
    const T0 = hyp(r.x - p.x, r.z - p.z) / 46 + 0.12;
    const lx = clamp(r.x + r.vx * T0 * 0.8, -24, 24), lz = clamp(r.z + r.vz * T0 * 0.8, -46, 46);
    const hp = handPos(p);
    b.state = 'pass'; b.holder = null; b.from = p; b.to = r; b.t = 0;
    p.pose = 'chest'; p.reachT = 0.32;   // both arms push the ball out
    p.passA = Math.atan2(lx - p.x, lz - p.z); p.passT0 = G.t;   // he turns and steps into it
    b.sx = hp.x; b.sy = hp.y - 1; b.sz = hp.z; b.ex = lx; b.ez = lz; b.ey = r.ht / 12 * 0.6 + 1.2;
    b.dur = hyp(lx - p.x, lz - p.z) / 46 + 0.12; b.apex = 0.6 + b.dur * 1.4;
    b.passer = p; b.passT = G.t + b.dur;
    /* the alley-oop: a cutter heading for the rim who can finish above it gets the ball thrown up there */
    b.lob = false;
    /* a short pass past a defender's hands: bounced off the floor about two thirds of the way */
    b.bounce = b.dur < 0.5 && rand() < 0.4;
    if (b.bounce) { p.pose = 'bpass'; b.bn = false; }
    const toRim = (0 - r.x) * r.vx + (hoopZ(r.team) - r.z) * r.vz;
    if ((r.cutT > 0 || r.cutUser > 0) && distHoop(lx, lz, r.team) < 13 && toRim > 0 && hyp(r.vx, r.vz) > 7 && r.r.dunk + r.r.vert > 125 && nearestDef(r).d > 3.5 && rand() < (r.isUser ? 0.8 : 0.3) * (0.5 + p.r.pass / 200)) {
      b.lob = true; b.bounce = false; p.pose = 'chest';
      b.ex = clamp(lx * 0.5, -6, 6); b.ez = hoopZ(r.team) - dirOf(r.team) * 3; b.ey = 11.2;
      b.dur = hyp(b.ex - p.x, b.ez - p.z) / 34 + 0.35; b.apex = 4.5; b.passT = G.t + b.dur;
      r.oopT = b.dur + 0.4;
    }
    /* now and then a pass sails: high, behind him, off his hands */
    if (!p.isUser && rand() < clamp(0.018 + (62 - p.r.pass) * 0.0006, 0.006, 0.04)) { const a = rand() * 6.28, m = rr(6, 11); b.ex = clamp(b.ex + Math.sin(a) * m, -26, 26); b.ez = clamp(b.ez + Math.cos(a) * m, -48, 48); b.ey += 2; }
    /* a defender in the lane may jump it */
    b.pick = null;
    if (b.lob) { r.wantBall = 1.2; return; }
    const L = hyp(lx - hp.x, lz - hp.z) || 1, ux = (lx - hp.x) / L, uz = (lz - hp.z) / L;
    for (const o of G.pl) {
      if (o.team === p.team) continue;
      const rx = o.x - hp.x, rz = o.z - hp.z, t = rx * ux + rz * uz;
      if (t < 4 || t > L - 2) continue;
      const off = Math.abs(rx * uz - rz * ux);
      if (off > 1.8) continue;
      /* a lazy pass through a man in the lane: the league picks off about one pass in forty */
      let ch = clamp(0.035 + (o.r.steal - p.r.pass) * 0.002, 0.01, 0.14) * (1 - off / 1.8) * (o.isUser ? 1.5 : G.diff.oppSteal) * (1 - 0.15 * bt(p, 'general'));
      if (p.isUser) ch *= 1.0;
      if (rand() < ch) { b.pick = { who: o, f: t / L }; break; }
    }
    r.wantBall = 1.2;
  }
  function bestPass(p, dirx, dirz) {
    let best = null, bs = -1e9;
    const over = along(p.z, p.team) < RIM;   // over half court: never back to a trailer behind it
    for (const r of teamOf(p.team)) {
      if (r === p || (over && along(r.z, r.team) > RIM - 1.5)) continue;
      const dx = r.x - p.x, dz = r.z - p.z, L = hyp(dx, dz) || 1;
      const open = Math.min(nearestDef(r).d, 9);
      let s = open * 0.8 - L * 0.03 + (distHoop(r.x, r.z, p.team) < 12 ? 1.5 : 0) + (r.cutUser > 0 ? 2.5 : 0);
      if (dirx !== undefined) s += ((dx * dirx + dz * dirz) / L) * 9;
      if (s > bs) { bs = s; best = r; }
    }
    return best;
  }

  /* ---------- the AI ---------- */
  function lane(p) {
    /* is the way to the rim open? no defender near the line in the next 14 feet */
    const hx = 0 - p.x, hz = hoopZ(p.team) - p.z, L = hyp(hx, hz) || 1, ux = hx / L, uz = hz / L;
    let worst = 99;
    for (const o of G.pl) {
      if (o.team === p.team) continue;
      const rx = o.x - p.x, rz = o.z - p.z, t = rx * ux + rz * uz;
      if (t < 0 || t > Math.min(L, 14)) continue;
      worst = Math.min(worst, Math.abs(rx * uz - rz * ux));
    }
    return worst;
  }
  function handlerAI(p, dt) {
    const b = G.ball;
    p.hold += dt;
    p.think -= dt;
    /* the play you called */
    const P = p.team === 0 && G.play && G.phase === 'live' && !p.inb ? G.play : null;
    if (P && along(p.z, p.team) < RIM - 2) {
      const u = G.user;
      if (P.kind === 'iso' && u && u !== p && p.hold > 0.35 && nearestDef(u).d > 2.4) { passTo(p, u); return; }
      if (P.kind === 'post' && p.slot < 3 && p.hold > 0.5) {
        const big = teamOf(0).filter(o => o.slot >= 3 && !o.isUser).sort((a, c) => c.r.close - a.r.close)[0];
        if (big && distHoop(big.x, big.z, 0) < 17 && nearestDef(big).d > 1.8) { big.postNext = true; passTo(p, big); return; }
      }
    }
    if (p.postNext && p.post === undefined) { p.postNext = false; p.post = 1.8 + rand(); }
    /* the break: right after a steal or a board, with the defense not back, push it at the rim */
    if (G.transT !== undefined && G.t - G.transT < 3.5 && p.drive <= 0 && G.phase === 'live' && !p.inb) {
      const a = along(p.z, p.team);
      if (a > 26) {
        const back = G.pl.filter(o => o.team !== p.team && along(o.z, p.team) < a - 3).length;
        if (back <= 1 && lane(p) > 4) { p.drive = 1.6; G.transT = -99; G.breakUntil = G.t + 2.2; tally('break'); if (rand() < 0.4) feed('On the break'); }
      }
    }
    /* pressure: a man in his face now and then makes him travel or lose it off his foot */
    if (G.phase === 'live' && !G.drill && !p.inb) {
      const nd = nearestDef(p);
      if (nd.d < 3 && rand() < dt * 0.019 * (1.25 - p.r.handle / 99) * (p.drive > 0 ? 1.6 : 1)) {
        const why = rand() < 0.5 ? 'Traveling' : 'Lost it out of bounds';
        toast(why, p.team === 0 ? 'opp' : ''); AU().play('whistle'); B(why === 'Traveling' ? 'travel' : 'turnover', { prio: 2, follow: 0.3 }); tally('lost');
        turnover(p, why, 1 - p.team, { x: p.x, z: p.z }); return;
      }
    }
    const tgt = spotOf(p);
    p.tx = tgt.x; p.tz = tgt.z;
    if (p.drive > 0) { p.drive -= dt; p.tx = 0; p.tz = hoopZ(p.team) - dirOf(p.team) * 3; }
    if (p.post !== undefined) { p.post -= dt; p.tx = p.x * 0.8; p.tz = hoopZ(p.team) - dirOf(p.team) * 5; }
    if (p.think > 0 || p.shoot) return;
    p.think = 0.28 + rand() * 0.12;
    const d = distHoop(p.x, p.z, p.team), nd = nearestDef(p).d;
    const back = along(p.z, p.team) > 44;      // still in the backcourt
    const q = baseProb(p, p.x, p.z, d < 6 ? 'layup' : 'jumper') * contest(p);
    const three = isThree(p.x, p.z, p.team);
    /* bigs who can't shoot it don't take threes */
    const ev = three && p.r.three < 58 ? 0 : q * (three ? 3 : 2);
    /* the user called for it */
    const u = G.user;
    if (u && u.team === p.team && u !== p && G.callT > 0 && p.hold > 0.3 && nearestDef(u).d > 3 && rand() < 0.85) { passTo(p, u); G.callT = 0; return; }
    if (back) {
      const pg = teamOf(p.team).find(o => o.slot === 0);
      if (pg !== p && pg && !pg.isUser && p.hold > 0.4 && hyp(pg.x - p.x, pg.z - p.z) < 40) { passTo(p, pg); return; }
      if (u && u.slot === 0 && u.team === p.team && u !== p && p.hold > 0.6 && nearestDef(u).d > 4) { passTo(p, u); return; }
      return;
    }
    /* the last shot: shot clock off, the quarter's clock running down: hold it, then go with about six seconds left */
    if (G.clock < G.shotClock && G.clock > 6.5 && !(d < 5 && nd > 4)) { p.tx = 0; p.tz = hoopZ(p.team) - dirOf(p.team) * 28; return; }
    if (G.clock < G.shotClock && G.clock <= 6.5 && G.clock > 1.2 && p.drive <= 0 && lane(p) > 3) p.drive = 1.4;
    if (G.clock < 1.6) { startShot(p); return; }
    if (G.shotClock < 2.5 || (d < 5.5 && p.hold > 0.15)) { startShot(p); return; }
    const need = (p.team === 1 ? G.diff.oppShootEV : 0.98) - (three ? 0.01 : 0);
    if (p.hold > 0.5 && ev > need && nd > 4.2 && rand() < 0.62) { startShot(p); return; }
    if (p.hold > 0.9 && ev > need * 1.08 && nd > 3.2 && rand() < 0.35) { startShot(p); return; }
    /* bigs on the block back their man down, then turn for the hook */
    if (p.slot >= 3 && !three && d > 5 && d < 16 && p.post === undefined && p.hold > 0.6 && p.r.close >= 60 && rand() < 0.065) { p.post = 1.6 + rand(); return; }
    if (p.post !== undefined && (p.post <= 0 || d < 7.5)) { delete p.post; startShot(p, false, 'hook'); return; }
    if (p.hold > 0.5 && d < 10 && q > 0.48 && rand() < 0.7) { startShot(p); return; }
    if (p.hold > 0.4 && p.drive <= 0 && d < 30 && lane(p) > 3.5 && rand() < 0.28 + (p.r.close + p.r.dunk + p.r.handle) / 99 / 5) { p.drive = 1.6; return; }
    const pr = p.hold > 4 ? 0.6 : p.hold > 1.2 ? 0.3 : 0.06;
    if (rand() < pr) {
      const r = bestPass(p);
      if (r && (!r.isUser || nearestDef(r).d > 5)) { passTo(p, r); return; }
    }
    if (G.shotClock < 6 && rand() < 0.3) startShot(p);
    /* the computer has moves too: a crossover at a defender in his face, which can leave him (or you) stumbling */
    if (p.moveCd <= 0 && p.hold > 0.6 && nd < 4 && rand() < 0.04 + p.r.handle / 2500) {
      const def = nearestDef(p).who, Bs = R.basis(), side = rand() < 0.5 ? 1 : -1;
      p.move = 0.35; p.moveCd = 1.6;
      const sp = maxSpeed(p) * 1.3; p.vx = (Bs.rx * side) * sp; p.vz = (Bs.rz * side) * sp;
      { const from = p.dribHand || 1, fx = Math.sin(p.face), fz = Math.cos(p.face); p.dribHand = (p.vx * -fz + p.vz * fx) >= 0 ? 1 : -1;
        startMv(p, p.dribHand === from ? 'hesi' : ['cross', 'btb', 'legs'][Math.floor(rand() * 3)], from, p.dribHand); }
      if (def && rand() < clamp(0.12 + (p.r.handle - def.r.perD) * 0.006, 0.03, 0.4)) {
        def.stun = 0.6; p.drive = 1.2;
        if (def.isUser) { grade(-1, 'Got crossed'); toast('Crossed up', 'opp'); AU().crowd.react('ooh', 0.8); }
        if (rand() < 0.15) ankles(def);
      }
    }
  }
  function spotOf(p) {
    const s = SPOTS[p.slot][p.spot % SPOTS[p.slot].length];
    let x = s[0], d = s[1];
    /* the floor shrinks toward the ball a little */
    if (p.cutT > 0) { x = p.slot === 4 ? -s[0] * 0.5 : Math.sign(s[0] || 1) * 3; d = 4; }
    const bh = G.ball.holder;
    if (bh && bh.team === p.team && bh !== p) x += clamp(bh.x * 0.15, -3, 3);
    /* the play called for you: everyone else clears out to the corners and the wings */
    if (G.play && G.play.kind === 'iso' && p.team === 0 && bh && bh.isUser && !p.isUser) { const k = [[-22, 3], [22, 3], [-17, 21], [17, 21], [0, 26]][p.slot]; x = k[0]; d = k[1]; }
    /* in transition, run with the play */
    const c = toCourt(p.team, x, d);
    return c;
  }
  /* The pick-and-roll: now and then the big walks up and sets a screen on the ball handler's man. A defender who runs
     into it is caught for a moment; the handler turns the corner and the big rolls to the rim. */
  function screenAI(p, dt) {
    const h = G.ball.holder;
    if (!h || h.team !== p.team || h === p) return false;
    if (p.screen === undefined) p.screen = 0;
    /* the pick-and-roll you called: the best big comes up to set it once each trip */
    if (p.team === 0 && G.play && G.play.kind === 'pnr' && !G.play.done && p.slot >= 3 && along(h.z, 0) < 32) {
      const big = teamOf(0).filter(o => o.slot >= 3 && o !== h && !o.isUser).sort((a, c) => hyp(a.x - h.x, a.z - h.z) - hyp(c.x - h.x, c.z - h.z))[0];
      if (big === p) { p.screen = 3.2; G.play.done = true; }
    }
    p.screen -= dt;
    if (p.screen <= 0) {
      if (p.slot === 4 && along(h.z, p.team) > 18 && along(h.z, p.team) < 34 && G.shotClock > 6 && rand() < dt * 0.25) p.screen = 3.2;
      else return false;
    }
    const d = G.pl.find(o => o.team !== p.team && o.slot === h.slot);
    if (!d) return false;
    if (p.screen > 1.4) {
      /* set it: on the defender's hip, on the side away from the rim's middle */
      const side = h.x > 0 ? -1 : 1;
      p.tx = d.x + side * 2.2; p.tz = d.z + dirOf(p.team) * 0.4;
      if (hyp(d.x - p.x, d.z - p.z) < 2.8 && !d.isUser && d.stun <= 0 && p.screen < 2.6) {
        d.stun = 0.55 * (1.2 - d.r.perD / 160); p.screen = 1.4;
        /* the screener's man switches onto the ball for a moment */
        const sw = G.pl.find(o => o.team !== p.team && o.slot === p.slot); if (sw && !sw.isUser) { sw.switchOn = h; sw.switchT = 1.8; }
        if (!h.isUser && lane(h) > 2.5) h.drive = 1.4;
        if (h.isUser || rand() < 0.15) B('pick_ana', { prio: 1 });
        if (rand() < 0.6) { if (sw && !sw.isUser && rand() < 0.5) CH('ch_switch', sw); else CH('ch_screen', d); }
      }
    } else { p.tx = 0; p.tz = hoopZ(p.team) - dirOf(p.team) * 5; }   // the roll
    return true;
  }
  function offBallAI(p, dt) {
    if (screenAI(p, dt)) return;
    p.cut -= dt; p.cutT -= dt;
    if (p.cut < 0) {
      p.cut = rr(4, 9);
      if (rand() < 0.45) p.cutT = rr(1.2, 2); else p.spot = (p.spot + 1 + Math.floor(rand() * 2)) % 3;
    }
    const s = spotOf(p);
    p.tx = s.x; p.tz = s.z;
    const b = G.ball;
    /* on the break the wings fill the lanes: wide and ahead of the ball, toward the corners */
    const h = b.holder;
    if (h && h.team === p.team && h.drive > 0 && G.t < (G.breakUntil || 0) && along(h.z, p.team) > 10 && p.slot !== 4) { const c = toCourt(p.team, (p.slot % 2 ? 1 : -1) * 20, Math.max(4, along(h.z, p.team) - 12)); p.tx = c.x; p.tz = c.z; }
    if (b.state === 'pass' && b.to === p) { p.tx = b.ex; p.tz = b.ez; }
  }
  /* a hand on a driver, a bump in the lane: a non-shooting foul. The fifth team foul of a quarter puts the other
     side in the bonus: every foul after it is two free throws. */
  /* six fouls and you are done for the night: the rest of the game is played out */
  function checkFoulOut(p) {
    if (!p || !p.isUser || G.switching || G.drill || G.fouledOut) return;
    /* foul trouble: two in the first quarter, three in the second, four in the third, and the coach sits you for the
       rest of that quarter (at the next dead ball) */
    const lim = [0, 2, 3, 4][G.q];
    if (p.st.pf < 6) { if (lim && p.st.pf >= lim && G.sitQ !== G.q && !(G.satQ || []).includes(G.q)) { G.sitQ = G.q; toast(`${p.st.pf} fouls`, 'opp'); } return; }
    G.fouledOut = true; toast('Fouled out', 'opp'); feed('You fouled out'); grade(-2, 'Fouled out'); B('fouledout', { prio: 6 });
    setTimeout(() => { if (PB.Game.active && G && !G.replay) simRest(); }, 2200);
  }
  /* the rest of the quarter on the bench: played out by the teams' strength, then you check back in */
  function sitOut() {
    const left = Math.max(0, G.clock), poss = left / 14;
    for (const t of [0, 1]) { const str = ((opts.strength && opts.strength[t]) || 75); G.score[t] += Math.max(0, Math.round(poss / 2 * (1.08 + (str - 75) * 0.012) + PB.gauss() * 1.2)); }
    (G.satQ = G.satQ || []).push(G.q); G.sitQ = 0;
    if (G.inb) { G.inb.p.inb = false; G.inb = null; }
    toast('Foul trouble: you sit', 'opp'); B('sit', { prio: 4 }); feed(`Foul trouble · you sit the rest of the ${['', '1st', '2nd', '3rd'][G.q]} quarter`);
    G.clock = 0; endPeriod();
    setTimeout(() => { if (PB.Game.active && G) toast('You check back in', 'call'); }, 3200);
  }
  function contactFoul(def, off) {
    def.st.pf++;
    G.tf[def.team]++;
    checkFoulOut(def);
    AU().play('whistle'); B('foul', { prio: 2 });
    feed(`Foul · ${def.name}${G.tf[def.team] >= 5 ? ' (bonus)' : ''}`);
    if (def.isUser) grade(-1, 'Foul');
    for (const o of G.pl) { o.shoot = null; o.drive = 0; }
    if (G.tf[def.team] >= 5) { G.ftq = { shooter: off, n: 2, total: 2 }; dead(1.0, startFT); }
    else { G.poss = null; dead(0.9, () => { give(off); G.shotClock = Math.max(G.shotClock, 14); }); }
  }
  function defAI(p, dt) {
    const offT = 1 - p.team;
    if (p.switchT > 0) p.switchT -= dt;
    if (p.helping > 0) p.helping -= dt * 0.1;   // slow on purpose: one "help!" from a man every several seconds
    const man = p.switchT > 0 && p.switchOn && G.ball.holder === p.switchOn ? p.switchOn : G.pl.find(o => o.team === offT && o.slot === p.slot);
    /* help: a driver who has beaten his man into the paint draws the nearest defender, who steps in front of him */
    const drv = G.ball.holder;
    if (!p.isUser && drv && drv.team === offT && drv !== man && drv.drive > 0 && distHoop(drv.x, drv.z, offT) < 15) {
      const own = G.pl.find(o => o.team === p.team && o.slot === drv.slot);
      const beaten = own && distHoop(own.x, own.z, offT) > distHoop(drv.x, drv.z, offT) + 1;
      if (beaten) {
        let near = null, nd = 1e9;
        for (const o of G.pl) if (o.team === p.team && o !== own && !o.isUser) { const d = hyp(o.x - drv.x, o.z - drv.z); if (d < nd) { nd = d; near = o; } }
        if (near === p && nd < 16) {
          const hz = hoopZ(offT);
          if (!(p.helping > 0) && rand() < 0.35) CH('ch_help', p);
          p.tx = drv.x * 0.6; p.tz = drv.z + (hz - drv.z) * 0.45; p.pose = 'guard'; p.helping = 0.4;
          return;
        }
      }
    }
    const H = { x: 0, z: hoopZ(offT) };
    const b = G.ball;
    const bx = b.x, bz = b.z;
    /* the double team: when you are hot (three straight, or a big night), a second defender comes at you once you
       have held it a moment in the half court; the man he left is open */
    const hh = b.holder;
    if (!p.isUser && hh && hh.isUser && hh.team === offT && man !== hh && G.phase === 'live' && !hh.shoot && !G.switching) {
      const hot = (G.streak || 0) >= 3 || hh.st.pts * 12 / (G.qlen || 3) >= 26;
      if (hot && (hh.hold || 0) > 0.6 && distHoop(hh.x, hh.z, offT) < 26 && (!G.dbl || G.t > G.dbl.until + 9) && G.t > (G.dblNext || 0)) {
        let near = null, nd = 1e9;
        for (const o of G.pl) if (o.team === p.team && !o.isUser && o.slot !== hh.slot) { const d = hyp(o.x - hh.x, o.z - hh.z); if (d < nd) { nd = d; near = o; } }
        if (near && nd < 18) { G.dbl = { who: near, on: hh, until: G.t + 2.6 }; feed(`Double team on ${hh.name}`); B('double', { prio: 3 }); if (!G.dblSaid) { G.dblSaid = true; toast('Double team: find the open man', 'call'); } }
        else G.dblNext = G.t + 2;
      }
      if (G.dbl && G.dbl.who === p && G.dbl.on === hh && G.t < G.dbl.until) {
        const dx = H.x - hh.x, dz = H.z - hh.z, L = hyp(dx, dz) || 1, sd = hh.x > 0 ? -1 : 1;
        p.tx = hh.x + dx / L * 2.2 + sd * 1.6; p.tz = hh.z + dz / L * 2.2; p.pose = 'guard';
        return;
      }
    }
    if (man === b.holder) {
      const dx = H.x - man.x, dz = H.z - man.z, L = hyp(dx, dz) || 1;
      const gap = clamp(3.2 + (L > 28 ? (L - 28) * 0.3 : 0), 3, 9) * (1.12 - p.r.perD / 400);
      p.tx = man.x + dx / L * gap; p.tz = man.z + dz / L * gap;
      p.pose = 'guard';
      /* down by a few with the clock running out: foul to stop it */
      const behind = G.score[1 - p.team] - G.score[p.team];
      if (!p.isUser && G.q >= 4 && G.clock < 40 && G.clock > 2 && behind >= 3 && behind <= 9 && hyp(man.x - p.x, man.z - p.z) < 3.5 && G.phase === 'live' && !man.shoot && rand() < dt * 2) {
        G.tf[p.team] = Math.max(G.tf[p.team], 5);   // late in a quarter every team is in the penalty
        toast('Foul to stop the clock', ''); contactFoul(p, man); return;
      }
      if (!p.isUser && man.drive > 0 && hyp(man.x - p.x, man.z - p.z) < 2.6 && G.phase === 'live' && rand() < dt * 1.05 * (1.3 - p.r.perD / 140)) { contactFoul(p, man); return; }
      /* a driver who runs into a defender set in his path: the charge */
      if (!p.isUser && man.drive > 0 && p.stun <= 0 && hyp(p.vx, p.vz) < 3 && hyp(man.x - p.x, man.z - p.z) < 2.4 && G.phase === 'live' && rand() < dt * 0.35) {
        man.st.tov++; man.st.pf++; if (man.isUser) grade(-2, 'Charge'); checkFoulOut(man);
        AU().play('whistle'); toast('Offensive foul', man.team === 0 ? 'opp' : ''); feed(`Charge · ${man.name}`); B('turnover', { prio: 2 });
        for (const o of G.pl) { o.shoot = null; o.drive = 0; }
        G.poss = null; dead(0.9, () => give(p)); return;
      }
      /* tight on the ball, a poor handle loses it */
      if (!p.isUser && !man.shoot && hyp(man.x - p.x, man.z - p.z) < 3.2 && G.phase === 'live' && rand() < dt * clamp(0.006 + (p.r.perD - man.r.handle) * 0.0002, 0.002, 0.015) * G.diff.oppSteal) {
        p.st.stl++; man.st.tov++; if (man.isUser) grade(-3, 'Lost the ball');
        AU().play('steal', { x: p.x }); AU().crowd.react(home(p.team) ? 'roar' : 'groan', 0.7); B('steal', { prio: 3, follow: 0.3 }); if (rand() < 0.5) CH('ch_run', p);
        toast(p.team === 0 ? 'STRIPPED' : 'Stripped', p.team === 0 ? 'make' : 'opp'); feed(`Steal · ${p.name}`);
        give(p); return;
      }
      /* reach for it now and then */
      p.stealCd = (p.stealCd || rr(1, 3)) - dt;
      if (!p.isUser && p.stealCd < 0 && L < 30 && hyp(man.x - p.x, man.z - p.z) < 4.2 && !man.shoot) {
        p.stealCd = rr(1.5, 4);
        p.pose = 'reach'; p.reachT = 0.3;
        const ch = clamp(0.02 + (p.r.steal - man.r.handle) * 0.0012, 0.005, 0.06) * G.diff.oppSteal * (man.move > 0 ? 1.6 : 1);
        if (rand() < ch) {
          p.st.stl++; feed(`Steal · ${p.name}`); toast(p.team === 0 ? 'STOLEN' : 'Picked off', p.team === 0 ? 'make' : 'opp');
          AU().play('steal', { x: p.x }); AU().crowd.react(home(p.team) ? 'roar' : 'groan', 0.8); B('steal', { prio: 3, follow: 0.35 }); if (rand() < 0.5) CH('ch_run', p);
          man.st.tov++; if (man.isUser) grade(-3, 'Lost the ball'); if (p.isUser) grade(3, 'Steal');
          give(p);
        }
      }
    } else {
      const dx = H.x - man.x, dz = H.z - man.z, L = hyp(dx, dz) || 1;
      const db = hyp(bx - man.x, bz - man.z);
      const gap = clamp(3.5 + db * 0.18, 3.5, 11);
      let tx = man.x + dx / L * gap, tz = man.z + dz / L * gap;
      tx += (bx - tx) * 0.18; tz += (bz - tz) * 0.12;
      p.tx = tx; p.tz = tz; p.pose = '';
      if (b.state === 'shot') {
        /* box out: between your man and the rim */
        p.tx = man.x + dx / L * 3; p.tz = man.z + dz / L * 3;
      }
    }
    if (p.contestT !== undefined) {
      p.contestT -= dt;
      const sh = G.pl.find(o => o.shoot && o.team !== p.team);
      if (sh) { p.tx = sh.x + (H.x - sh.x) * 0.08; p.tz = sh.z + (H.z - sh.z) * 0.08; }
      if (p.contestT <= 0) {
        if (sh && hyp(sh.x - p.x, sh.z - p.z) < 6 && p.y === 0) { p.jg = GRAV * 1.6; p.vy = Math.sqrt(2 * p.jg * (1.5 + p.r.vert * 0.02)); p.pose = 'contest'; }
        delete p.contestT;
      }
    }
  }
  function reboundAI(p) {
    const b = G.ball;
    /* chase where the ball is coming down */
    let lx = b.x, lz = b.z;
    if (b.state === 'loose' && b.y > 3) {
      const tL = (b.vy + Math.sqrt(Math.max(0, b.vy * b.vy + 2 * GRAV * (b.y - 3)))) / GRAV;
      lx = b.x + b.vx * tL; lz = b.z + b.vz * tL;
    }
    const d = hyp(lx - p.x, lz - p.z);
    const shooterTeam = G.reb ? G.reb.team : -1;
    /* the offense's guards get back; everyone near goes for it */
    if (p.team === shooterTeam && p.slot <= 1 && d > 10) { const s = toCourt(p.team, (p.slot - 0.5) * 16, 34); p.tx = s.x; p.tz = s.z; return; }
    if (d < 26 || p.slot >= 3) { p.tx = lx; p.tz = lz; } else { const s = spotOf(p); p.tx = s.x; p.tz = s.z; }
  }

  /* ---------- movement ---------- */
  function steer(p, dt, wantX, wantZ, speedMul) {
    const max = maxSpeed(p) * (speedMul || 1) * (p.stun > 0 ? 0.25 : 1) * (p.move > 0 ? 1.45 : 1);
    let vx = wantX, vz = wantZ;
    const L = hyp(vx, vz);
    if (L > max) { vx *= max / L; vz *= max / L; }
    const acc = (p.move > 0 ? 110 : 62) * dt;
    const dx = vx - p.vx, dz = vz - p.vz, dl = hyp(dx, dz);
    if (dl > acc) { p.vx += dx / dl * acc; p.vz += dz / dl * acc; } else { p.vx = vx; p.vz = vz; }
  }
  function seek(p, dt, mul) {
    const dx = p.tx - p.x, dz = p.tz - p.z, d = hyp(dx, dz);
    const sp = Math.min(maxSpeed(p) * (mul || 1), d * 3.2);
    steer(p, dt, d > 0.01 ? dx / d * sp : 0, d > 0.01 ? dz / d * sp : 0, mul);
  }

  /* ---------- the user ---------- */
  function stickWorld() {
    let sx = input.sx, sy = input.sy;
    const k = input.keys;
    if (k.left || k.right || k.up || k.down) { sx = (k.right ? 1 : 0) - (k.left ? 1 : 0); sy = (k.down ? 1 : 0) - (k.up ? 1 : 0); const L = hyp(sx, sy) || 1; sx /= L; sy /= L; }
    const m = hyp(sx, sy);
    if (m < 0.12) return null;
    const B = R.basis();
    return { x: B.rx * sx + B.fx * -sy, z: B.rz * sx + B.fz * -sy, m: Math.min(1, m) };
  }
  function userStep(u, dt) {
    if (G.ball.holder === u) u.hold = (u.hold || 0) + dt;   // how long you have had it (doubles, assists)
    if (u.postUp > 0) {
      if (!u.postSaid) { u.postSaid = true; B('postup_ana', { prio: 1 }); }
      u.postUp -= dt;
      if (G.ball.holder !== u || u.shoot) u.postUp = 0;
      else {
        /* backing him down: slow steps toward the rim, back to the basket, the defender pushed back a little */
        const hx = 0 - u.x, hz = hoopZ(u.team) - u.z, hl = hyp(hx, hz) || 1, w = stickWorld();
        const sp = maxSpeed(u) * 0.26;
        const tx = w ? w.x * 0.5 + hx / hl * 0.5 : hx / hl, tz = w ? w.z * 0.5 + hz / hl * 0.5 : hz / hl;
        steer(u, dt, tx * sp, tz * sp); u.face = Math.atan2(-hx, -hz); u.pose = 'dribble';
        const d = nearestDef(u).who; if (d && hyp(d.x - u.x, d.z - u.z) < 3.2 && hl > 5) { d.x += hx / hl * dt * 1.6 * (1.1 - d.r.inD / 160); d.z += hz / hl * dt * 1.6 * (1.1 - d.r.inD / 160); }
        return;
      }
    }
    const w = stickWorld();
    const off = G.ball.holder ? G.ball.holder.team === 0 : G.poss === 0;
    if (w) {
      G.idle = 0;
      const sprint = w.m > 0.82 ? 1 : 0.72;
      const sp = maxSpeed(u) * sprint * (u.shoot && u.shoot.kind === 'jumper' ? 0.1 : 1);
      let ax = 0, az = 0;
      /* on the ball: a little help staying in front. Your slide is pulled toward the line between him and the rim
         (sideways only: how tight you play him is yours), unless you are pushing the other way */
      { const h = G.ball.holder;
        if (!off && h && h !== u && !h.shoot && hyp(h.x - u.x, h.z - u.z) < 8) {
          const hx = 0 - h.x, hz = hoopZ(h.team) - h.z, hl = hyp(hx, hz) || 1, px = -hz / hl, pz = hx / hl;
          const e = (h.x - u.x) * px + (h.z - u.z) * pz, k = clamp(e * 2.4, -6, 6);
          if ((w.x * px + w.z * pz) * Math.sign(e) > -0.35 && (u.x - h.x) * hx + (u.z - h.z) * hz > -hl) { ax = px * k; az = pz * k; }
        } }
      steer(u, dt, w.x * sp + ax, w.z * sp + az);
      if (G.ball.holder === u) u.pose = 'dribble';
      else if (!off) { const h = G.ball.holder, mn = G.pl.find(o => o.team !== u.team && o.slot === u.slot);   // a stance near the ball or your man; a run when you are getting back
        u.pose = (h && hyp(h.x - u.x, h.z - u.z) < 17) || (mn && hyp(mn.x - u.x, mn.z - u.z) < 9) ? 'guard' : ''; }
      else u.pose = '';
      if (!off) handsUp(u);
    } else {
      G.idle += dt;
      /* thumb off the stick: on defense the game keeps you in front of your man; on offense you stand */
      if (!off && G.idle > 0.6 && G.ball.state !== 'loose') { defAI(u, dt); seek(u, dt, 0.9); handsUp(u); }
      else if (G.ball.state === 'loose' && G.idle > 0.4) { reboundAI(u); seek(u, dt, 0.95); }
      else steer(u, dt, 0, 0);
    }
  }
  /* on defense, both hands go up by themselves when the man in front of you rises to shoot (a jump is better) */
  /* is the ball there to be taken? Yes while he crosses over, goes between the legs or hesitates in front of you
     (1), and when he is dribbling on your side of his body (0.6); not when it is behind his back or his body */
  function exposed(d, h) {
    if (!h || h.team === d.team || h.shoot || h.inb || G.ball.state !== 'held' || hyp(h.x - d.x, h.z - d.z) > 5) return 0;
    const mv = h.mv && G.t - h.mv.t0 < h.mv.T ? h.mv.k : null;
    if (mv) return mv === 'cross' || mv === 'legs' || mv === 'hesi' ? 1 : 0;
    return ((d.x - h.x) * -Math.cos(h.face) + (d.z - h.z) * Math.sin(h.face)) * (h.dribHand || 1) > 0.6 ? 0.6 : 0;
  }
  function handsUp(u) {
    if (u.y > 0) return;
    const sh = G.pl.find(o => o.team !== u.team && o.shoot && o.shoot.kind !== 'dunk');
    if (sh && hyp(sh.x - u.x, sh.z - u.z) < 6) u.pose = 'contest';
  }
  function pressA(down) {
    const u = G.user; if (!u) return;
    if (G.phase === 'ft' && G.ftq && G.ftq.shooter === u) {
      if (down) { G.ftMeter = 0.0001; } else if (G.ftMeter > 0) { const m = G.ftMeter; G.ftMeter = 0; shootFT(m); }
      return;
    }
    if (G.phase !== 'live') return;
    if (down) {
      if (G.ball.holder === u && !u.shoot && !u.inb) startShot(u, true);
      else if (G.ball.holder !== u && u.y === 0) {
        /* jump: contest, block, rebound */
        u.jg = GRAV * 1.6; u.vy = Math.sqrt(2 * u.jg * (1.6 + u.r.vert * 0.022)); u.pose = 'contest';
      }
    } else if (u.shoot && u.shoot.user) {
      release(u, u.shoot.t / u.shoot.T);
    }
  }
  function pressB() {
    const u = G.user; if (!u || G.phase !== 'live') return;
    const b = G.ball;
    if (b.holder === u) {
      if (u.shoot) return;
      const w = stickWorld();
      const r = bestPass(u, w ? w.x : undefined, w ? w.z : undefined);
      if (r) { if (u.inb) { u.inb = false; G.inb = null; } passTo(u, r); }
      return;
    }
    const off = b.holder ? b.holder.team === 0 : G.poss === 0;
    if (off) { G.callT = 2.5; toast('Calling for it', 'call'); CH('ch_ball', u); return; }
    /* steal */
    if (u.reachCd > 0) return;
    u.reachCd = 0.9; u.pose = 'reach'; u.reachT = 0.3;
    const h = b.holder;
    if (h && hyp(h.x - u.x, h.z - u.z) < 5 && !h.shoot) {
      /* a reach is about timing: at an exposed ball it is a real chance, at a protected one mostly a foul */
      const ex = exposed(u, h), ch = clamp((0.06 + (u.r.steal - h.r.handle) * 0.003) * (1 + ex * 3), 0.03, 0.55) + 0.025 * bt(u, 'pick');
      if (rand() < ch) {
        u.st.stl++; h.st.tov++; grade(3, 'Steal'); buzz(25); toast('STOLEN', 'make'); feed(`Steal · ${u.name}`); give(u);
        AU().play('steal', { x: u.x }); AU().crowd.react(home(0) ? 'roar' : 'ooh', 0.9); B('steal', { prio: 4, follow: 0.4 });
      } else if (rand() < (ex > 0 ? 0.05 : 0.2)) {
        toast('Reach-in foul', 'opp'); contactFoul(u, h);
      } else if (!ex && !G.reachSaid) { G.reachSaid = true; toast('He kept it away: reach when Steal lights up', 'call'); }
    } else if (b.state === 'pass' && hyp(b.x - u.x, b.z - u.z) < 4.5 && rand() < 0.35 + u.r.steal * 0.003) {
      b.pick = { who: u, f: b.t / b.dur + 0.05 };
    }
  }
  /* The Move button: tap for a crossover; swipe it for the move you want. kind: 'cross' (dir -1 left, 1 right on
     screen, 0 any), 'step' (step-back: room for the jumper), 'spin' (spin toward the rim). */
  function pressC(kind, dir) {
    const u = G.user; if (!u || G.phase !== 'live' || u.inb) return;
    if (G.drill && G.drill.kind === 'dunk') { if (!u.shoot && u.y <= 0) { const D = G.drill; D.style = (D.style + (kind === 'step' ? STYLES.length - 1 : 1)) % STYLES.length; toast(STYLES[D.style][0], 'call'); buzz(8); } return; }
    const b = G.ball;
    if (b.holder === u) {
      if (u.moveCd > 0 || u.shoot) return;
      kind = kind || 'cross';
      const nd = nearestDef(u), Bs = R.basis();
      const hx = 0 - u.x, hz = hoopZ(0) - u.z, hl = hyp(hx, hz) || 1;
      /* a big inside sixteen feet: down on Move posts up instead of stepping back */
      if (kind === 'step' && ['PF', 'C'].includes(u.d.pos) && hl < 16 && !u.postUp) { u.postSaid = false; u.postUp = 2.6; u.moveCd = 0.6; toast('Post up', 'call'); buzz(10); return; }
      let dx, dz, sp = maxSpeed(u) * 1.4, shake = 0.18, lbl = '';
      if (kind === 'step') {
        /* back, away from the man in front of you; the next jumper gets the room */
        dx = -hx / hl; dz = -hz / hl; sp = maxSpeed(u) * 1.25; u.move = 0.3; u.moveCd = 1.2; u.stepT = G.t; shake = 0.12; lbl = 'Step-back'; startMv(u, 'hesi', u.dribHand || 1, u.dribHand || 1);
      } else if (kind === 'spin') {
        /* a spin: around the defender and on toward the rim */
        const side = rand() < 0.5 ? 1 : -1;
        dx = hx / hl * 0.8 + Bs.rx * side * 0.6; dz = hz / hl * 0.8 + Bs.rz * side * 0.6; u.move = 0.45; u.moveCd = 1.3; u.spinT = G.t; shake = 0.24; lbl = 'Spin'; startMv(u, 'spin', u.dribHand || 1, u.dribHand || 1, side);
        u.drive = 1.0;
      } else {
        const w = stickWorld();
        if (dir) { dx = Bs.rx * dir + Bs.fx * 0.35; dz = Bs.rz * dir + Bs.fz * 0.35; }
        else if (w) { dx = w.x; dz = w.z; }
        else { const side = rand() < 0.5 ? 1 : -1; dx = Bs.rx * side + Bs.fx * 0.4; dz = Bs.rz * side + Bs.fz * 0.4; }
        u.move = 0.38; u.moveCd = 1.1; lbl = 'Crossover';
        /* which hand it goes to (the side you cross to), and the flavour: going fast it goes behind the back, from a
           standstill (or the second move of a combo) through the legs, and toward the hand it is already in it is a
           hesitation, an in-and-out */
        const from = u.dribHand || 1, sp0 = hyp(u.vx, u.vz);
        { const fx = Math.sin(u.face), fz = Math.cos(u.face); u.dribHand = (dx * -fz + dz * fx) >= 0 ? 1 : -1; }
        let mk = 'cross';
        if (u.dribHand === from) { mk = 'hesi'; lbl = rand() < 0.5 ? 'Hesitation' : 'In-and-out'; shake = 0.2; }
        else if (u.mv && G.t - u.mv.t0 < 2.2 && u.mv.k !== 'legs') { mk = 'legs'; lbl = 'Between the legs'; shake = 0.22; }
        else if (sp0 > maxSpeed(u) * 0.7) { mk = 'btb'; lbl = 'Behind the back'; shake = 0.2; }
        else if (sp0 < 4) { mk = 'legs'; lbl = 'Between the legs'; shake = 0.2; }
        startMv(u, mk, from, u.dribHand);
        /* on a drive near the rim a sideways swipe is a euro step: one step across, one toward the rim */
        const toRim = (hx * u.vx + hz * u.vz) / hl;
        if (hl < 15 && toRim > 6) { dx = dx * 0.7 + hx / hl * 0.7; dz = dz * 0.7 + hz / hl * 0.7; u.euroT = G.t; lbl = 'Euro step'; shake = 0.3; }
      }
      const L = hyp(dx, dz) || 1;
      u.vx = dx / L * sp; u.vz = dz / L * sp;
      if (nd.who && nd.d < 6) {
        const ch = clamp(shake + (u.r.handle - nd.who.r.perD) * 0.008, 0.05, 0.62) + 0.05 * bt(u, 'handles') + (tkoOn() ? 0.15 : 0);
        if (rand() < ch) { nd.who.stun = kind === 'spin' ? 0.9 : 0.75; u.st.shake++; if (rand() < (tkoOn() ? 0.5 : 0.28)) { ankles(nd.who); toast('Ankles!', 'make'); AU().crowd.react('roar', 1); buzz([20, 40, 20]); } else toast(kind === 'step' ? 'Created space' : 'Shook him', 'make'); grade(1, 'Beat your man'); B('shake', { prio: 4 }); AU().crowd.react('ooh', 0.9); }
        else if (kind === 'spin' && rand() < clamp(0.08 + (nd.who.r.steal - u.r.handle) * 0.003, 0.02, 0.18)) {
          /* a spin into a set defender can cost you the ball */
          nd.who.st.stl++; u.st.tov++; grade(-3, 'Lost it on the spin'); toast('Stripped', 'opp'); AU().play('steal', { x: u.x }); give(nd.who); return;
        } else feedMove(lbl);
      } else feedMove(lbl);
      AU().play('squeak', { x: u.x });
      return;
    }
    const off = b.holder ? b.holder.team === 0 : G.poss === 0;
    if (!off && G.switching) { switchNearest(); return; }
    if (off) { u.cutUser = 1.6; toast('Cutting', 'call'); G.callT = 2; }
  }
  /* a dribble move the body and ball act out: the ball's path from hand to hand (court.js poses the arms from p.mv) */
  const MV_T = { cross: 0.32, btb: 0.4, legs: 0.38, hesi: 0.5, spin: 0.5 };
  /* an ankle-breaker: the beaten defender goes down and needs a moment to get up */
  function ankles(d) { d.fallT = G.t; d.stun = 1.5; d.vx *= 0.3; d.vz *= 0.3; if (R.shock) R.shock(d.x, d.z, 5); }
  function startMv(p, k, a, b, side) { p.mv = { k, t0: G.t, T: MV_T[k], a, b, side: side || 1, bn: false }; }
  function feedMove(lbl) { const r = $('#rel'); r.textContent = lbl; r.className = 'on y'; relT = 0.6; }

  /* ---------- whole-team control: you are whoever has the ball, or the man guarding it ---------- */
  function setUser(p) {
    if (!p || p === G.user) return;
    if (G.user) { G.user.isUser = false; G.user.cutUser = 0; }
    p.isUser = true; G.user = p; G.idle = 9;
  }
  function autoSwitch() {
    const b = G.ball, mine = G.pl.filter(o => o.team === 0);
    if (b.holder && b.holder.team === 0) { setUser(b.holder); return; }
    if (b.state === 'pass' && b.to && b.to.team === 0) return;     // the switch comes on the catch
    if (b.holder && b.holder.team === 1 && (!G.user || G.user.team !== 0 || G.swPoss !== G.poss)) {
      G.swPoss = G.poss;
      setUser(mine.find(o => o.slot === b.holder.slot) || mine[0]);
    }
  }
  function switchNearest() {
    const b = G.ball; let best = null, bd = 1e9;
    for (const o of G.pl) if (o.team === 0 && o !== G.user) { const d = hyp(o.x - b.x, o.z - b.z); if (d < bd) { bd = d; best = o; } }
    setUser(best); toast('Switched', 'call');
  }

  /* ---------- main step ---------- */
  function step(dt) {
    G.t += dt;
    if (G.phase === 'buzzer') {
      G.buzzT -= dt;
      for (const p of G.pl) { p.vx *= Math.max(0, 1 - dt * 4); p.vz *= Math.max(0, 1 - dt * 4); p.x += p.vx * dt; p.z += p.vz * dt; if (p.y > 0 || p.vy) { p.y = Math.max(0, p.y + p.vy * dt); p.vy -= (p.jg || 60) * dt; if (p.y <= 0) p.vy = 0; } }
      if (G.ball.state === 'held' && G.ball.holder) { G.ball.state = 'loose'; G.ball.holder = null; G.ball.vx = G.ball.vz = 0; G.ball.vy = 4; }
      if (G.ball.state !== 'held') { const b = G.ball; b.vy = (b.vy || 0) - 32 * dt; b.y += b.vy * dt; if (b.y < 0.4) { b.y = 0.4; b.vy = Math.abs(b.vy) * 0.55; } }
      if (G.buzzT <= 0) finish();
      return;
    }
    if (G.tko && G.tko.on) tkoTick();
    if (G.switching && G.phase === 'live') autoSwitch();
    const b = G.ball;
    if (relT > 0) { relT -= dt; if (relT <= 0) $('#rel').className = ''; }
    if (G.spotFn && G.phase === 'tip' && G.tipT < 2.85) { const f = G.spotFn; G.spotFn = null; f(); }   // the starter's close-up, in step with the camera
    /* the routine at the line: a few bounces, then the ball comes up to shoot */
    if (G.phase === 'ft' && G.ftq && G.ftq.shooter && G.ball.holder === G.ftq.shooter && !G.ftMeter) G.ftq.shooter.pose = G.t - (G.ftT0 || 0) < 0.95 ? 'dribble' : '';
    if (G.phase === 'tip') {
      G.tipT -= dt;
      /* the two centers go up for it */
      if (G.tipT < 0.5 && !G.tipJump) { G.tipJump = true; for (const p of G.pl) if (p.slot === 4) { p.jg = GRAV * 1.4; p.vy = Math.sqrt(2 * p.jg * (2.4 + p.r.vert * 0.02)); p.pose = 'contest'; } }
      for (const p of G.pl) if (p.y > 0 || p.vy) { p.y += p.vy * dt; p.vy -= p.jg * dt; if (p.y <= 0) { p.y = 0; p.vy = 0; p.pose = ''; } }
      if (G.tipT <= 0) {
        const t = rand() < 0.5 ? 0 : 1;
        G.tipWinner = t; G.phase = 'live';
        const pg = teamOf(t).find(o => o.slot === 0);
        give(pg); feed(`${G.teams[t].name} win the tip`); AU().play('whistle', { vol: 0.7 }); B('tip', { prio: 1 });
      }
      b.x = 0; b.z = 0; b.y = 7 + Math.max(0, Math.sin((1.3 - G.tipT) * 2.5)) * 6;
      return;
    }
    if (G.phase === 'dead') {
      G.deadT -= dt;
      if (G.deadT <= 0) { G.phase = 'live'; const f = G.then; G.then = null; if (f) f(); }
    }
    if (G.phase === 'ft') {
      AU().crowd.level(0.08);
      if (G.ftq.shooter.isUser && !G.auto) {
        if (G.ftMeter > 0) { G.ftMeter += dt / 0.9; if (G.ftMeter > 1.15) { const m = G.ftMeter; G.ftMeter = 0; shootFT(m); } }
      } else { G.ftWait -= dt; if (G.ftWait <= 0) shootFT(0); }
      /* the routine: a couple of bounces before the shot */
      const sh = G.ftq.shooter; if (!sh.isUser || G.auto) { if (G.ftWait > 0.35) { G.ball.state = 'held'; G.ball.holder = sh; sh.pose = 'dribble'; } else sh.pose = 'hold'; }
    }
    /* clocks */
    if (G.drill) drillStep(dt);
    else if (G.phase === 'live') {
      fatigue(dt);
      if (G.sitQ === G.q && G.inb && !G.auto) { sitOut(); return; }
      if (G.inb) inboundStep(dt);
      if (!G.inb || !G.inb.stop) G.clock -= dt;
      if (G.poss !== null && !G.inb && (b.state === 'held' || b.state === 'pass')) G.shotClock -= dt;
      if (G.callT > 0) G.callT -= dt;
      /* the building: louder late in a close game, hushed at the line, and the home crowd chants on defense */
      const late = G.q >= 4 ? clamp(1 - G.clock / (G.qlen * 60), 0, 1) : 0, close = clamp(1 - Math.abs(G.score[0] - G.score[1]) / 12, 0, 1);
      AU().crowd.level(0.3 + 0.15 * (G.q - 1) / 3 + 0.5 * late * close);
      if (G.q >= 4 && G.clock < 60 && Math.abs(G.score[0] - G.score[1]) <= 5 && !G.clutchSaid) { G.clutchSaid = true; B('clutch', { prio: 2, follow: 0.5 }); }
      if (AU().pulse) AU().pulse(G.q >= 4 && G.clock < 30 && Math.abs(G.score[0] - G.score[1]) <= 3 && !G.drill);
      /* the arena announcer and the clock */
      if (PB.booth && G.qlen >= 3) {
        const qk = 'q' + G.q;
        if (G.clock < 120 && G.clock > 110 && G.paTwo !== qk) { G.paTwo = qk; PB.booth.pa('pa_two'); }
        if (G.clock < 60 && G.clock > 50 && G.paLast !== qk && G.q >= 4) { G.paLast = qk; PB.booth.pa('pa_last'); }
      }
      if (G.poss === 1 - G.home && G.q >= 2 && close > 0.5 && G.t > (G.chantT || 25) && G.ball.state === 'held') { G.chantT = G.t + rr(35, 60); AU().crowd.react('chant', 0.8); if (R.board) R.board('DE-FENSE!', 4); if (PB.booth) PB.booth.pa(rand() < 0.5 ? 'pa_defense' : 'pa_noise'); }
      if (G.poss === 1 - G.home && G.t > G.organT && G.ball.state === 'held' && along(G.ball.z, 1 - G.home) > 40) { G.organT = G.t + rr(45, 80); if (R.board) R.board(rand() < 0.5 ? 'MAKE SOME\nNOISE!' : 'GET LOUD!', 3.5); if (AU().organ) AU().organ(rand() < 0.5 ? 'charge' : 'letsgo'); }
      /* the clock is running down on you: say so, once a possession */
      if (G.shotClock < 6 && G.shotClock > 0 && b.holder && b.holder.isUser && !b.holder.shoot && G.scWarn !== G.possN && !G.auto && !G.drill) { G.scWarn = G.possN; toast('Shot clock: shoot or pass', 'opp'); buzz([20, 40, 20]); }
      if (G.shotClock <= 0 && (b.state === 'held' || b.state === 'pass')) {
        const t = G.poss; toast('SHOT CLOCK', 'opp'); AU().play('buzzer'); AU().play('whistle', { delay: 0.5 }); B('shotclock', { prio: 3 });
        turnover(b.holder || b.from, 'Shot clock violation', 1 - t);
      }
      if (violations(dt)) return;
      if (G.clock <= 0 && b.state !== 'shot') { endPeriod(); return; }
    }
    /* players */
    const live = G.phase === 'live';
    for (const p of G.pl) {
      if (p.stun > 0) p.stun -= dt;
      /* stamina (yours): sprinting drains it, walking and stoppages bring it back; empty legs are slow and short */
      if (p.isUser && !G.switching && !G.drill) {
        if (p.energy === undefined) p.energy = 1;
        const spd = hyp(p.vx, p.vz), top = (11.5 + p.r.speed * 0.075);
        if (G.phase !== 'live') p.energy = Math.min(1, p.energy + dt * 0.06);
        else if (spd > top * 0.8) p.energy = Math.max(0, p.energy - dt * (0.05 - p.r.speed * 0.00015));
        else if (spd < 6) p.energy = Math.min(1, p.energy + dt * 0.025);
      }
      if (p.move > 0) p.move -= dt;
      /* the dribble's own rhythm and hand: quick and low with a man on you, long and high at a sprint, the ball kept on
         the side away from the defender (changing hands with a crossover, or through the legs when he is right there) */
      if (b.holder === p && b.state === 'held' && !p.shoot && !p.inb && G.phase !== 'ft') {
        const nd = nearestDef(p), spd = hyp(p.vx, p.vz), top = maxSpeed(p), ds = p.d && p.d.look && p.d.look.drib;
        const tight = nd.who && nd.d < 5.5 ? 1 - Math.max(0, nd.d - 2.5) / 3 : 0, run = clamp((spd - top * 0.6) / (top * 0.4), 0, 1) * (1 - tight);
        p.prot = (p.prot || 0) + (tight - (p.prot || 0)) * Math.min(1, dt * 6); p.runD = (p.runD || 0) + (run - (p.runD || 0)) * Math.min(1, dt * 5);
        const rate = (1 + 0.28 * p.prot - 0.2 * p.runD) * (ds === 'low' ? 1.25 : ds === 'high' ? 0.85 : 1);
        p.dph = (p.dph === undefined ? G.t * 7.4 : p.dph) + dt * 7.4 * rate;
        if (p.handCd > 0) p.handCd -= dt;
        const busy = p.mv && G.t - p.mv.t0 < p.mv.T + 0.15;
        if (nd.who && nd.d < 5 && !busy && !(p.handCd > 0) && !(p.move > 0) && !(p.postUp > 0)) {
          const fx = Math.sin(p.face), fz = Math.cos(p.face), side = (nd.who.x - p.x) * -fz + (nd.who.z - p.z) * fx;   // > 0: he is on my right
          const want = Math.abs(side) < 0.7 ? 0 : side > 0 ? -1 : 1, cur = p.dribHand || 1;
          if (want && want !== cur) { p.dribHand = want; startMv(p, nd.d < 3 && spd < 6 ? 'legs' : 'cross', cur, want); p.handCd = 0.9; }
        }
      } else { p.prot = 0; p.runD = 0; }
      if (p.moveCd > 0) p.moveCd -= dt;
      if (p.reachCd > 0) p.reachCd -= dt;
      if (p.reachT > 0) { p.reachT -= dt; if (p.reachT <= 0 && (p.pose === 'reach' || p.pose === 'chest' || p.pose === 'bpass')) p.pose = ''; }
      if (p.holdPoseT > 0) { p.holdPoseT -= dt; if (p.holdPoseT <= 0 && p.pose === 'hold') p.pose = ''; }
      /* going up for a rebound: the ball coming down near you, above your reach */
      if (b.state === 'loose' && !p.isUser && p.y === 0 && b.vy < 0 && b.y > 8 && b.y < 13 && hyp(b.x - p.x, b.z - p.z) < 3.2 && rand() < dt * 6) {
        p.jg = GRAV * 1.5; p.vy = Math.sqrt(2 * p.jg * (1.6 + p.r.vert * 0.022)); p.pose = 'contest';
      }
      if (p.celebT > 0) { p.celebT -= dt; if (!p.shoot && G.ball.holder !== p && p.y === 0) p.pose = p.celebT > 0 ? p.celebK || 'celebrate' : ''; }
      if (p.wantBall > 0) p.wantBall -= dt;
      if (p.shoot) {
        p.shoot.t += dt;
        const s = p.shoot;
        if (s.kind === 'layup' || s.kind === 'dunk') { p.tx = 0; p.tz = hoopZ(p.team) - dirOf(p.team) * 2.2; seek(p, dt, 0.8); }
        if (s.user && s.t / s.T > 1.12) release(p, s.t / s.T);
        else if (!s.user && s.t / s.T >= s.aiRel) release(p, s.aiRel);
      }
      if (!live) { if (G.phase === 'dead' || G.phase === 'ftflight') { p.vx *= 0.9; p.vz *= 0.9; } }
      else if (p.inb) { /* out of bounds with the ball: inboundStep has him */ }
      else if (p.isUser && G.drill) { if ((G.drill.kind === 'dunk' || G.drill.kind === 'free') && !p.shoot && p.y <= 0 && !G.auto) userStep(p, dt); /* else the drill moves you */ }
      else if (p.isUser && !G.auto) {
        userStep(p, dt);
        if (p.cutUser > 0) { p.cutUser -= dt; if (!stickWorld()) { p.tx = 0; p.tz = hoopZ(0) - 6; seek(p, dt, 1); } }
      } else if (!p.shoot) {
        if (b.holder === p) { handlerAI(p, dt); seek(p, dt, p.drive > 0 ? 1 : p.post !== undefined ? 0.3 : 0.7); p.pose = 'dribble'; }
        else if (b.state === 'loose') { reboundAI(p); seek(p, dt, 1); if (p.pose !== 'contest') p.pose = ''; }
        else {
          const offTeam = b.holder ? b.holder.team : G.poss;
          if (offTeam === p.team) { offBallAI(p, dt); seek(p, dt, b.state === 'pass' && b.to === p ? 1 : 0.8); if (!(p.reachT > 0)) p.pose = b.state === 'pass' && b.to === p && b.dur - b.t < 0.45 ? 'catch' : ''; }
          else {
            defAI(p, dt);
            /* closing out on a shooter who just caught it: a sprint, then short choppy steps */
            const gap = hyp(p.tx - p.x, p.tz - p.z), man = G.ball.holder;
            const close = man && man.team !== p.team && hyp(man.x - p.x, man.z - p.z) > 6 && hyp(man.x - p.x, man.z - p.z) < 26 && (man.caughtT !== undefined && G.t - man.caughtT < 1.2);
            seek(p, dt, (0.92 + p.r.perD * 0.0012) * (close || gap > 9 ? 1.12 : 1));
          }
        }
      }
      /* jump */
      if (p.spin) {
        const S = p.spin; S.t += dt; const k = Math.min(1, S.t / (S.T * 0.85)); p.spinA = S.total * k * k * (3 - 2 * k);
        if (S.t > S.T * 0.5 && p.y <= 0) { p.face += S.total; p.spinA = 0; p.spin = null; }
      }
      /* after a made dunk: a moment hanging on the rim, then the drop */
      if (p.hangPlan && p.vy <= 0 && p.y > 1 && !p.shoot) { p.hangPlan = false; p.hangT = 0.55; p.pose = 'hang'; }
      if (p.hangT > 0) {
        p.hangT -= dt; p.vx = p.vz = 0; p.vy = 0; p.pose = 'hang';
        const hy = Math.max(0.6, 10.25 - p.ht / 12 * 1.3); p.y += (hy - p.y) * Math.min(1, dt * 12);   // hands on the rim
        if (p.hangT <= 0) { p.vy = -2; p.pose = ''; }
      } else if (p.vy !== 0 || p.y > 0) {
        p.y += p.vy * dt; p.vy -= p.jg * dt;
        if (p.y <= 0) { p.y = 0; p.vy = 0; if (p.pose === 'contest' || p.pose === 'shoot' || p.pose === 'celebrate' || p.pose === 'dunk1' || p.pose === 'windmill' || p.pose === 'hang') p.pose = ''; }
      }
      p.x += p.vx * dt; p.z += p.vz * dt;
      /* a hard cut squeaks the sneakers */
      if (live) {
        const acc = hyp(p.vx - (p.pvx || 0), p.vz - (p.pvz || 0)) / dt, spd = hyp(p.vx, p.vz);
        if (acc > 70 && spd > 6 && G.t > G.squeakT && rand() < 0.35) { G.squeakT = G.t + rr(0.12, 0.35); AU().play('squeak', { x: p.x, vol: p.isUser ? 1 : 0.7 }); }
      }
      p.pvx = p.vx; p.pvz = p.vz;
      /* face: where you run, else the ball or the rim */
      const sp = hyp(p.vx, p.vz);
      let want;
      if (p.passA !== undefined && G.t - p.passT0 < 0.4) want = p.passA;
      else if (p.shoot || b.holder === p && sp < 3) want = Math.atan2(0 - p.x, hoopZ(p.team) - p.z);
      else if (p.pose === 'guard' && sp < maxSpeed(p) * 0.92) {
        /* in a stance you face your man and slide, you don't turn and run (until he is gone) */
        const h = b.holder && b.holder.team !== p.team ? b.holder : null, tgt = h && hyp(h.x - p.x, h.z - p.z) < 14 ? h : b;
        want = Math.atan2(tgt.x - p.x, tgt.z - p.z);
      }
      else if (sp > 2.5) want = Math.atan2(p.vx, p.vz);
      else want = Math.atan2(b.x - p.x, b.z - p.z);
      let da = want - p.face; while (da > Math.PI) da -= 6.2832; while (da < -Math.PI) da += 6.2832;
      p.face += da * Math.min(1, dt * 10);
    }
    /* the body-up: a ball handler who runs into a defender set in front of him (in his stance, between him and the
       rim) is cut off: most of his speed toward the rim is gone and he is pushed off line */
    { const h = b.holder;
      if (h && b.state === 'held' && !h.shoot && G.phase === 'live' && !h.inb && !G.drill) {
        const hx = 0 - h.x, hz = hoopZ(h.team) - h.z, hl = hyp(hx, hz) || 1, ux = hx / hl, uz = hz / hl;
        const vin = h.vx * ux + h.vz * uz;
        /* your man going by you: said once, so you know to get back in front (or call for help) */
        { const u = G.user;
          if (u && !G.auto && h.team !== u.team && vin > 5 && hl < 30 && hl > 5 && u.slot === h.slot && hyp(u.x - h.x, u.z - h.z) < 6 && (u.x - h.x) * ux + (u.z - h.z) * uz < -1 && !(G.t - (u.beatT || -9) < 6)) {
            u.beatT = G.t; toast('Beaten: get back in front', 'opp'); grade(-0.5, 'Beaten off the dribble'); } }
        if (vin > 3) for (const d of G.pl) {
          if (d.team === h.team || d.pose !== 'guard' || d.y > 0.2 || d.stun > 0) continue;
          const rx = d.x - h.x, rz = d.z - h.z, ahead = rx * ux + rz * uz, side = Math.abs(rx * -uz + rz * ux);
          if (ahead > 0.6 && ahead < 3.0 && side < 1.7) {
            const k = clamp(0.55 + (d.r.perD - h.r.handle) * 0.008 + (h.move > 0 ? -0.25 : 0), 0.15, 0.8);
            h.vx -= ux * vin * k; h.vz -= uz * vin * k;
            const sd = (rx * -uz + rz * ux) > 0 ? -1 : 1; h.vx += -uz * sd * vin * k * 0.35; h.vz += ux * sd * vin * k * 0.35;
            if (!(h.bumpT > G.t)) { h.bumpT = G.t + 0.9; d.bodyT = G.t;
              if (d.isUser) { grade(0.5, 'Cut him off'); toast('Cut off', 'make'); buzz(12); } else if (h.isUser) toast('Bumped', 'opp');
              AU().play('squeak', { x: d.x, vol: 0.7 }); }
            break;
          }
        }
      }
    }
    /* bodies don't overlap */
    const n = G.pl.length;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const a = G.pl[i], c = G.pl[j];
      const dx = c.x - a.x, dz = c.z - a.z, d = hyp(dx, dz), m = 2.3;
      if (d < m && d > 0.001) {
        const push = (m - d) / 2, ux = dx / d, uz = dz / d;
        a.x -= ux * push; a.z -= uz * push; c.x += ux * push; c.z += uz * push;
      }
    }
    for (const p of G.pl) if (!p.inb) { p.x = clamp(p.x, -24.6, 24.6); p.z = clamp(p.z, -46.6, 46.6); }
    ballStep(dt);
  }

  function ballStep(dt) {
    const b = G.ball;
    if (b.state === 'held') {
      const p = b.holder, hp = handPos(p);
      const H = R.hands && R.hands(p);
      if (p.shoot) { b.x = hp.x; b.z = hp.z; b.y = hp.y + (p.shoot.kind === 'dunk' ? 0.6 : H ? 0 : 0.2); }
      else if (H && ((G.phase === 'ft' && p.pose !== 'dribble') || p.inb)) { b.x = (H.r.x + H.l.x) / 2; b.z = (H.r.z + H.l.z) / 2; b.y = (H.r.y + H.l.y) / 2 + 0.2; }
      else {
        const mv = p.mv, ms = mv && H ? (G.t - mv.t0) / mv.T : 2;
        if (ms < 1) {
          const A = mv.a < 0 ? H.l : H.r;
          if (mv.k === 'spin' || mv.k === 'hesi') {   // palmed through the spin; held at the hip on the hesitation
            b.x = A.x; b.z = A.z; b.y = Math.max(1.2, A.y - (mv.k === 'hesi' ? 0.15 : 0.3)); return;
          }
          /* hand, floor, other hand: in front for a crossover, under you through the legs, behind the back */
          const Bh = mv.b < 0 ? H.l : H.r, fx = Math.sin(p.face), fz = Math.cos(p.face);
          const off = mv.k === 'btb' ? -1.0 : mv.k === 'legs' ? 0.15 : 1.2, M = { x: p.x + fx * off, y: 0.35, z: p.z + fz * off };
          let P0, P1, t;
          if (ms < 0.5) { P0 = A; P1 = M; t = (ms / 0.5) ** 2; } else { P0 = M; P1 = Bh; t = 1 - (1 - (ms - 0.5) / 0.5) ** 2; }
          b.x = P0.x + (P1.x - P0.x) * t; b.y = P0.y + (P1.y - P0.y) * t - (ms < 0.5 ? 0.35 : 0); b.z = P0.z + (P1.z - P0.z) * t;
          if (ms >= 0.5 && !mv.bn) { mv.bn = true; if (G.phase === 'live') AU().play('bounce', { x: b.x, vol: p.isUser ? 1 : 0.5 }); }
          return;
        }
        /* the dribble: from the hand to the floor and back, under the hand */
        b.x = hp.x; b.z = hp.z;
        const ds = p.d && p.d.look && p.d.look.drib, top = (H ? Math.max(1.2, (p.dribHand < 0 ? H.l.y : H.r.y) - 0.35) : 3.0) * (ds === 'low' ? 0.78 : ds === 'high' ? 1.06 : 1) * (1 - 0.18 * (p.prot || 0) + 0.08 * (p.runD || 0));
        const ph = p.dph !== undefined ? p.dph : G.t * 7.4, sn = Math.abs(Math.sin(ph));
        b.y = 0.4 + sn * (top - 0.4);
        /* at a run the ball is pushed out ahead and comes back to the hand */
        if (p.runD > 0.05) { const f = (1 - sn) * 1.5 * p.runD, sp1 = hyp(p.vx, p.vz) || 1; b.x += p.vx / sp1 * f; b.z += p.vz / sp1 * f; }
        /* the bounce: one each time the ball meets the floor, quieter the farther it is from you */
        const k = Math.floor(ph / Math.PI);
        if (k !== b.bk) { b.bk = k; if (G.phase === 'live') { const d = G.user ? hyp(b.x - G.user.x, b.z - G.user.z) : 20; AU().play('bounce', { x: b.x, vol: clamp(1.1 - d / 45, 0.25, 1) }); } }
      }
      return;
    }
    if (b.state === 'pass') {
      b.t += dt;
      const u = Math.min(1, b.t / b.dur);
      b.x = b.sx + (b.ex - b.sx) * u; b.z = b.sz + (b.ez - b.sz) * u; b.y = b.sy + (b.ey - b.sy) * u + 4 * b.apex * u * (1 - u);
      if (b.bounce) { const f = 0.62; b.y = u < f ? b.sy + (0.4 - b.sy) * (u / f) : 0.4 + (b.ey - 0.4) * ((u - f) / (1 - f)) + 2.2 * ((u - f) / (1 - f)) * (1 - (u - f) / (1 - f));
        if (u >= f && !b.bn) { b.bn = true; AU().play('bounce', { x: b.x, vol: 0.6 }); } }
      if (b.pick && u >= b.pick.f) {
        const o = b.pick.who, p = b.from;
        o.st.stl++; p.st.tov++; G.picks = (G.picks || 0) + 1;
        if (o.isUser) grade(3, 'Picked it off'); if (p.isUser) grade(-3, 'Intercepted');
        toast(o.team === 0 ? 'PICKED OFF' : 'Intercepted', o.team === 0 ? 'make' : 'opp'); feed(`Steal · ${o.name}`);
        give(o); AU().play('steal', { x: o.x }); AU().crowd.react(home(o.team) ? 'roar' : 'groan', 0.7); B('steal', { prio: 3, follow: 0.35 }); return;
      }
      if (u >= 1) {
        const r = b.to;
        if (b.lob && hyp(r.x - b.x, r.z - b.z) < 6) {
          /* caught above the rim: thrown down in one motion */
          give(r); r.caughtT = G.t; r.x += (b.x - r.x) * 0.6; r.z += (b.z - r.z) * 0.6;
          r.jg = GRAV * 1.2; r.vy = 6; r.y = Math.max(r.y, 2.6); r.pose = 'celebrate';
          r.shoot = { t: 0, T: 0.14, kind: 'dunk', user: false, three: false, d: distHoop(r.x, r.z, r.team), aiRel: 0.82, oop: true };
          toast('ALLEY-OOP', r.team === 0 ? 'make' : 'opp'); AU().crowd.react('ooh', 1);
        }
        else if (hyp(r.x - b.x, r.z - b.z) < 4) { give(r); r.caughtT = G.t; r.pose = 'hold'; r.holdPoseT = 0.3; AU().play('catch', { x: r.x, vol: 0.7 }); }
        else { b.state = 'loose'; b.vx = (b.ex - b.sx) / b.dur * 0.5; b.vz = (b.ez - b.sz) / b.dur * 0.5; b.vy = 0; b.lastTouch = b.from.team; G.reb = null; }
      }
      return;
    }
    if (b.state === 'shot') {
      b.t += dt;
      const u = Math.min(1, b.t / b.dur);
      b.x = b.sx + (b.ex - b.sx) * u; b.z = b.sz + (b.ez - b.sz) * u; b.y = b.sy + (b.ey - b.sy) * u + 4 * b.apex * u * (1 - u);
      if (b.bounce) { const f = 0.62; b.y = u < f ? b.sy + (0.4 - b.sy) * (u / f) : 0.4 + (b.ey - 0.4) * ((u - f) / (1 - f)) + 2.2 * ((u - f) / (1 - f)) * (1 - (u - f) / (1 - f));
        if (u >= f && !b.bn) { b.bn = true; AU().play('bounce', { x: b.x, vol: 0.6 }); } }
      if (G.phase === 'live' && !G.drill && u < 1) { inFlight(u); if (b.state !== 'shot') return; }
      if (u >= 1) { if (b.shot.ft) ftLands(); else shotLands(); }
      return;
    }
    if (b.state === 'rattle') {
      /* around the rim: small hops along the iron, a clank on each, then off */
      const R0 = b.rim; b.t += dt;
      const hopT = 0.32, k = Math.floor(b.t / hopT), u = (b.t % hopT) / hopT;
      const ang = (b.ang = b.ang ?? rand() * 6.28) + b.t * 2.2;
      b.x = R0.cx + Math.sin(ang) * 0.7; b.z = R0.cz + Math.cos(ang) * 0.7; b.y = 10.35 + Math.sin(u * Math.PI) * 1.1;
      if (k !== b.lastHop) { b.lastHop = k; if (k <= R0.hops) AU().play('rim', { x: b.x, power: 0.35 }); }
      if (k > R0.hops) {
        b.state = 'loose'; delete b.ang; delete b.lastHop;
        const dx = Math.sin(ang), dz = Math.cos(ang);
        b.vx = dx * rr(4, 9); b.vz = dz * rr(4, 9) - dirOf(R0.team) * rr(1, 4); b.vy = rr(3, 6);
      }
      return;
    }
    if (b.state === 'drop') {
      b.t += dt;
      b.y = Math.max(0.4, 10 - b.t * 14 - b.t * b.t * 10);
      return;
    }
    if (b.state === 'loose') {
      b.vy -= GRAV * dt;
      b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
      /* the backboard */
      for (const s of [1, -1]) if (Math.abs(b.x) < 3 && b.y > 9.5 && b.y < 13 && (b.z - s * 42.6) * s > 0 && (b.z - s * 42.6) * s < 0.6 && b.vz * s > 0) b.vz = -b.vz * 0.6;
      if (b.y < 0.39) { b.y = 0.39; b.vy = Math.abs(b.vy) > 2 ? -b.vy * 0.6 : 0; b.vx *= 0.86; b.vz *= 0.86; }
      if (b.vy === 0) { b.vx *= 1 - dt * 1.5; b.vz *= 1 - dt * 1.5; }
      /* play is stopped: the ball stays in the building (it dies against the boards round the floor) */
      if (G.phase !== 'live') { if (Math.abs(b.x) > 28) { b.x = Math.sign(b.x) * 28; b.vx *= -0.3; } if (Math.abs(b.z) > 50.5) { b.z = Math.sign(b.z) * 50.5; b.vz *= -0.3; } return; }
      if (Math.abs(b.x) > 25.3 || Math.abs(b.z) > 47.3) {
        const to = 1 - (b.lastTouch === undefined ? 0 : b.lastTouch);
        toast('Out of bounds', ''); G.reb = null; AU().play('whistle'); B('turnover', { prio: 2, follow: 0.3 });
        turnover(null, 'Out of bounds', to, { x: b.x, z: b.z });
        return;
      }
      /* who gets it: anyone in reach, the better rebounder more often */
      let got = null, gs = 0;
      for (const p of G.pl) {
        const d = hyp(p.x - b.x, p.z - b.z);
        const reach = p.ht / 12 * 1.33 + p.y + (p.y > 0 ? 0.8 : 0);
        if (d < 2.8 && b.y < reach && b.y > 0) {
          const s = rand() * (0.6 + p.r.reb / 99 + (p.y > 0 ? 0.3 : 0) + (p.isUser ? 0.15 : 0) + 0.12 * bt(p, 'glass')) * (p.team === 1 ? G.diff.oppReb : 1);
          if (s > gs) { gs = s; got = p; }
        }
      }
      if (got && rand() < dt * 9) {
        const fromShot = G.reb && G.t - G.reb.t < 9;
        if (fromShot) {
          got.st.reb++;
          const off = got.team === G.reb.team;
          if (off) got.st.oreb++;
          if (got.isUser) grade(off ? 2 : 1.5, off ? 'Offensive board' : 'Rebound');
          feed(`${off ? 'Offensive rebound' : 'Rebound'} · ${got.name}`);
          G.reb = null;
          give(got, off ? 'oreb' : ''); AU().play('catch', { x: got.x, vol: 0.6 });
          if (!off) G.transT = G.t;   // a defensive board: a chance to run
          if (off && home(got.team)) AU().crowd.react('roar', 0.5);
          if (off && rand() < 0.4) B('oreb', { prio: 2 });
        } else give(got);
      }
    }
  }

  function endPeriod() {
    const g = G;
    if (G.replayAt) { G.replayAt = 0; startReplay(); }
    if (g.q >= 4 && g.score[0] !== g.score[1]) {
      /* the final horn: a moment on the floor first, the winners celebrating, the losers hands on knees */
      if (g.drill) { finish(); return; }
      g.phase = 'buzzer'; g.buzzT = 2.8; g.buzzed = true;
      AU().play('horn', { len: 2 }); AU().crowd.react(g.score[g.home] > g.score[1 - g.home] ? 'roar' : 'applause', 1);
      const w = g.score[0] > g.score[1] ? 0 : 1, kinds = ['celebrate', 'flex', 'roar', 'three', 'point', 'chest'];
      for (const p of g.pl) { p.shoot = null; p.drive = 0; p.vx *= 0.3; p.vz *= 0.3; p.pose = p.team === w ? (p.d && p.d.look && p.d.look.celeb) || kinds[Math.floor(rand() * kinds.length)] : 'sad'; }
      if (R.benchJump) R.benchJump(w);
      return;
    }
    g.q++;
    g.clock = g.q > 4 ? Math.max(60, g.qlen * 60 * 5 / 12) : g.qlen * 60;
    toast(g.q > 4 ? 'Overtime' : `End of the ${['', '1st', '2nd', '3rd'][g.q - 1]}`, '');
    AU().play('horn'); AU().crowd.react('applause', 0.7);
    setTimeout(() => AU().organ && AU().organ(g.q === 3 ? 'walk' : 'letsgo'), 2200);
    setTimeout(() => B(g.q === 3 ? 'half' : g.q > 4 ? 'ot' : 'end_q', { prio: 3, follow: g.q === 3 ? 0.6 : 0 }), 900);
    if (g.q === 3 && !g.drill) halftime();
    g.poss = null;
    const t = g.q === 2 || g.q === 3 ? 1 - g.tipWinner : g.tipWinner;
    for (const p of g.pl) { p.shoot = null; p.drive = 0; p.pose = ''; }
    g.tf = [0, 0];
    if (g.q === 3 || g.q === 5) g.to = [2, 2];
    for (const p of g.pl) if (p.energy !== undefined) p.energy = Math.min(1, p.energy + 0.35);
    dead(1.8, () => {
      /* the team with the ball starts in its backcourt, the defense back in front of its rim */
      for (const p of g.pl) { const c = toCourt(t, SPOTS[p.slot][0][0] * 0.8, p.team === t ? 58 : 40); p.x = c.x; p.z = c.z; p.vx = p.vz = 0; }
      inboundTo(t, toCourt(t, 0, 70));
    });
  }

  /* halftime: the score and how each side is shooting, your line; it waits for a tap */
  function halftime() {
    const tot = t => { const r = { pts: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, reb: 0, tov: 0 }; for (const p of G.pl) if (p.team === t) for (const k in r) r[k] += p.st[k]; return r; };
    const a = tot(0), c = tot(1), pc = (m, n) => n ? Math.round(m / n * 100) + '%' : '–', u = G.user && G.user.st;
    G.paused = true; AU().muffle(true);
    const ov = $('#pause'); ov.hidden = false;
    ov.innerHTML = `<div class="card half"><p class="kick">Halftime</p>
      <div class="pscore"><span>${G.teams[0].ab || G.teams[0].id}</span><b>${G.score[0]} – ${G.score[1]}</b><span>${G.teams[1].ab || G.teams[1].id}</span></div>
      <table class="std"><tr><th></th><th>${G.teams[0].ab || G.teams[0].id}</th><th>${G.teams[1].ab || G.teams[1].id}</th></tr>
      <tr><td>Field goals</td><td>${a.fgm}-${a.fga} (${pc(a.fgm, a.fga)})</td><td>${c.fgm}-${c.fga} (${pc(c.fgm, c.fga)})</td></tr>
      <tr><td>Threes</td><td>${a.tpm}-${a.tpa}</td><td>${c.tpm}-${c.tpa}</td></tr>
      <tr><td>Rebounds</td><td>${a.reb}</td><td>${c.reb}</td></tr><tr><td>Turnovers</td><td>${a.tov}</td><td>${c.tov}</td></tr></table>
      ${u && !G.switching ? `<p class="mute">You: ${u.pts} pts, ${u.reb} reb, ${u.ast} ast · grade ${gradeLetter(G.grade)}</p>` : ''}
      <button class="big" id="h2">Second half</button></div>`;
    $('#h2').onclick = () => { ov.hidden = true; G.paused = false; AU().muffle(false); };
  }
  function finish() {
    G.phase = 'end';
    cancelAnimationFrame(raf);
    if (!G.buzzed) { AU().play('horn', { len: 2 }); AU().crowd.react(G.score[G.home] > G.score[1 - G.home] ? 'roar' : 'applause', 1); }
    if (AU().pulse) AU().pulse(false);
    if (PB.booth) PB.booth.stop(); setTimeout(() => B('final', { prio: 6, follow: 0.7 }), 600); setTimeout(() => AU().crowd.on(false), 2500);
    const box = G.played ? G.playedBy.map((x, i) => ({ d: x.d, team: x.team, st: G.played[i], user: !!(G.user && x.d === G.user.d) })) : G.pl.map(p => ({ d: p.d, team: p.team, st: p.st, user: p.isUser }));
    const res = { drill: G.drill ? { kind: G.drill.kind, score: G.drill.score, made: G.drill.made, att: G.drill.att, scores: G.drill.scores } : null, reels: G.reels || [], score: G.score.slice(), box, grade: G.user ? gradeLetter(G.grade) : null, gradeScore: G.grade,
      gradeLog: G.gradeLog, user: G.user ? { ...G.user.st } : null, teams: G.teams, q: G.q, winner: !!G.userWinner,
      shots: (G.shotLog || []).filter(x => x.user).map(x => [Math.round(x.x * 10) / 10, Math.round(x.a * 10) / 10, x.made ? 1 : 0]) };
    PB.Game.active = false;
    $('#game').hidden = true;
    if (opts.onEnd) opts.onEnd(res);
  }

  /* simulate the rest of a game you leave early: the score moves by both teams' strength */
  function simRest() {
    const left = Math.max(0, G.clock) + Math.max(0, 4 - G.q) * G.qlen * 60;
    const poss = left / 14;
    for (const t of [0, 1]) {
      const str = ((opts.strength && opts.strength[t]) || 75);
      const ppp = 1.08 + (str - 75) * 0.012;
      G.score[t] += Math.round(poss / 2 * ppp + PB.gauss() * 2);
    }
    if (G.score[0] === G.score[1]) G.score[rand() < 0.5 ? 0 : 1] += 2;
    G.q = Math.max(G.q, 4);
    finish();
  }

  /* ---------- frame ---------- */
  /* ---------- replays ----------
     The last few seconds are kept as snapshots (positions, poses, the ball) thirty times a second. A dunk, an
     and-one of yours or a shot at the buzzer plays back at half speed from a camera circling the play, in the pause
     before the inbound; a tap skips it. Settings can turn them off. */
  const SNAP = ['x', 'y', 'z', 'vx', 'vz', 'face', 'pose', 'jg', 'vy', 'spinA'];
  let tape = [], snapT = 0, replayCd = 0;
  function record(dt) {
    snapT += dt;
    if (snapT < 1 / 30) return;
    snapT = 0;
    tape.push({ t: G.t, pl: G.pl.map(p => SNAP.map(k => p[k])), shoot: G.pl.map(p => p.shoot ? { t: p.shoot.t, T: p.shoot.T } : null),
      ball: [G.ball.x, G.ball.y, G.ball.z, G.ball.state, G.ball.holder ? G.pl.indexOf(G.ball.holder) : -1] });
    if (tape.length > 150) tape.shift();
  }
  /* your highlights: a few seconds of tape kept after your best plays, the top five shown after the game */
  function reelMark(kind, val, label) {
    if (G.drill || (G.auto && !G.reelTest) || !G.user) return;   // (reelTest: tools/ can film the autopilot)
    G.reelPend = { kind, val, label, at: G.t + 0.8, q: G.q, clock: G.clock };
  }
  function reelTake() {
    const P = G.reelPend; G.reelPend = null;
    const R5 = G.reels || (G.reels = []);
    R5.push({ kind: P.kind, val: P.val, label: P.label, q: P.q, clock: P.clock, frames: tape.slice(-95) });
    if (R5.length > 5) R5.splice(R5.indexOf(R5.reduce((a, b) => (b.val < a.val ? b : a))), 1);
  }
  const reelSnd = {};
  function wantReplay(kind) {
    if (PB.settings && PB.settings.replays === false) return;
    if (G.t < replayCd || G.replay || tape.length < 40) return;
    replayCd = G.t + 25;
    G.replayAt = G.t + 0.9; G.replayKind = kind;
  }
  function startReplay() {
    const n = Math.min(tape.length, 80);      // the last two and a half seconds or so
    const live = { pl: G.pl.map(p => ({ ...p })), ball: { ...G.ball } };
    G.replay = { frames: tape.slice(-n), i: 0, live, kind: G.replayKind };
    $('#rp').hidden = false; $('#game').classList.add('replaying'); R.setReplay(true);
  }
  function endReplay() {
    const r = G.replay; if (!r) return;
    if (r.onEnd) { G.replay = null; r.onEnd(); return; }
    G.pl.forEach((p, i) => Object.assign(p, r.live.pl[i]));
    Object.assign(G.ball, r.live.ball);
    G.replay = null; $('#rp').hidden = true; $('#game').classList.remove('replaying'); R.setReplay(false);
  }
  function replayFrame(dt) {
    const r = G.replay;
    r.i += dt * 30 * 0.5;                     // half speed
    const k = Math.floor(r.i);
    if (k >= r.frames.length - 1) { endReplay(); return; }
    const f = r.frames[k], g = r.frames[k + 1], u = r.i - k;
    G.pl.forEach((p, i) => {
      SNAP.forEach((key, j) => { const a = f.pl[i][j], c = g.pl[i][j]; p[key] = typeof a === 'number' ? a + (c - a) * u : a; });
      const sh = f.shoot[i]; p.shoot = sh ? { t: sh.t, T: sh.T, kind: 'jumper' } : null;
    });
    G.ball.x = f.ball[0] + (g.ball[0] - f.ball[0]) * u; G.ball.y = f.ball[1] + (g.ball[1] - f.ball[1]) * u; G.ball.z = f.ball[2] + (g.ball[2] - f.ball[2]) * u;
    G.ball.state = f.ball[3] === 'held' ? 'replay' : f.ball[3]; G.ball.holder = f.ball[4] >= 0 ? G.pl[f.ball[4]] : null;
  }

  /* ---------- game controllers (the Gamepad API: Xbox, PlayStation, most Bluetooth pads) ----------
     Left stick moves (the d-pad too); A shoots or jumps, B passes, calls or steals, X is the crossover or a cut, Y a
     step-back, the right bumper a spin, Start pauses. */
  const padPrev = {};
  function pollPad() {
    const gp = navigator.getGamepads ? [...navigator.getGamepads()].find(g => g && g.connected) : null;
    if (!gp) return;
    const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0, bt = i => !!(gp.buttons[i] && gp.buttons[i].pressed);
    let sx = Math.abs(ax) > 0.15 ? ax : 0, sy = Math.abs(ay) > 0.15 ? ay : 0;
    if (bt(14)) sx = -1; if (bt(15)) sx = 1; if (bt(12)) sy = -1; if (bt(13)) sy = 1;
    if (sx || sy || padPrev.moving) { input.sx = sx; input.sy = sy; padPrev.moving = !!(sx || sy); }
    const edge = (i, f, up) => { const now = bt(i); if (now && !padPrev[i]) f(); else if (!now && padPrev[i] && up) up(); padPrev[i] = now; };
    if (G.paused) { edge(9, () => pause(false)); return; }
    edge(0, () => pressA(true), () => pressA(false));
    edge(1, () => pressB()); edge(2, () => pressC()); edge(3, () => pressC('step')); edge(5, () => pressC('spin')); edge(4, () => pressD());
    edge(9, () => pause(!G.paused)); edge(10, tkoGo); edge(11, tkoGo); edge(7, tkoGo);
  }

  /* ---------- frame ---------- */
  function frame(now) {
    pollPad();
    raf = requestAnimationFrame(frame);
    let dt = Math.max(0, Math.min(0.05, (now - last) / 1000 || 0.016)); last = now;   // a frame's timestamp can come before the clock we read
    if (G.replay) {
      if (!G.paused) replayFrame(dt);
      R.update(G, G.paused || !G.replay ? 0 : dt * 0.5);
      R.render(); hud(); $('#meter').hidden = true;
      return;
    }
    if (!G.paused) {
      const n = Math.ceil(dt / 0.017);
      for (let i = 0; i < n && G.phase !== 'end'; i++) step(dt / n);
      if (G.phase === 'end') return;
      record(dt);
      if (G.reelPend && G.t >= G.reelPend.at) reelTake();
      if (G.replayAt && G.t >= G.replayAt) { G.replayAt = 0; startReplay(); }
    }
    /* what the screen marks for you: who your pass goes to, the man you guard */
    const u = G.user;
    if (u && !G.drill && G.phase === 'live') {
      if (G.ball.holder === u && !u.shoot) { const w = stickWorld(); R.marks(bestPass(u, w ? w.x : undefined, w ? w.z : undefined), null); }
      else if (G.ball.holder && G.ball.holder.team !== u.team) R.marks(null, G.pl.find(o => o.team !== u.team && o.slot === u.slot));
      else R.marks(null, null);
    } else R.marks(null, null);
    R.update(G, G.paused ? 0 : dt);
    R.render();
    hud();
    meterUI();
  }
  function meterUI() {
    const m = $('#meter');
    const u = G.user;
    const s = u && u.shoot && u.shoot.user ? u.shoot : null;
    const ftm = G.phase === 'ft' && G.ftq && G.ftq.shooter === u ? (G.ftMeter || 0.0001) : 0;
    if (!s && !ftm) { m.hidden = true; return; }
    const v = s ? s.t / s.T : ftm;
    const w = (s ? 0.045 + (s.kind === 'jumper' ? (s.three ? u.r.three : u.r.mid) : u.r.close) * 0.0006 : 0.05 + u.r.ft * 0.0007) * timingEase();
    const p = R.toScreen(u.x, u.ht / 12 + u.y + 1.2, u.z);
    m.hidden = false;
    m.style.transform = `translate(${Math.round(p.x + 26)}px, ${Math.round(p.y - 70)}px)`;
    $('#mfill').style.height = `${Math.min(1, v) * 100}%`;
    $('#mzone').style.bottom = `${(0.82 - w) * 100}%`; $('#mzone').style.height = `${w * 200}%`;
    $('#mfill').className = Math.abs(v - 0.82) <= w ? 'g' : '';
  }

  /* ---------- controls ---------- */
  function bindControls() {
    const zone = $('#stickzone'), knob = $('#knob'), base = $('#stickbase');
    let sid = null, ox = 0, oy = 0;
    zone.addEventListener('pointerdown', e => {
      if (sid !== null) return;
      sid = e.pointerId; zone.setPointerCapture(sid);
      const r = zone.getBoundingClientRect();
      ox = e.clientX - r.left; oy = e.clientY - r.top;
      base.style.left = ox + 'px'; base.style.top = oy + 'px'; base.classList.add('on');
      knob.style.transform = 'translate(-50%,-50%)';
    });
    zone.addEventListener('pointermove', e => {
      if (e.pointerId !== sid) return;
      const r = zone.getBoundingClientRect();
      let dx = e.clientX - r.left - ox, dy = e.clientY - r.top - oy;
      const L = hyp(dx, dy), M = 52;
      if (L > M) { dx *= M / L; dy *= M / L; }
      input.sx = dx / M; input.sy = dy / M;
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    });
    const up = e => { if (e.pointerId !== sid) return; sid = null; input.sx = input.sy = 0; base.classList.remove('on'); };
    zone.addEventListener('pointerup', up); zone.addEventListener('pointercancel', up);
    const btn = (id, down, upf) => {
      const el = $(id);
      el.addEventListener('pointerdown', e => { e.preventDefault(); el.classList.add('press'); if (!G.paused) down(); });
      const u = e => { el.classList.remove('press'); if (upf && !G.paused) upf(); };
      el.addEventListener('pointerup', u); el.addEventListener('pointercancel', u); el.addEventListener('pointerleave', e => { if (el.classList.contains('press')) u(e); });
    };
    btn('#bA', () => pressA(true), () => pressA(false));
    btn('#bB', pressB);
    btn('#bD', pressD);
    btn('#tko', tkoGo);
    /* the Move button reads a swipe: left or right is a crossover that way, down a step-back, up a spin; a tap is a
       crossover */
    { const el = $('#bC'); let sx = 0, sy = 0, id = null;
      el.addEventListener('pointerdown', e => { e.preventDefault(); id = e.pointerId; sx = e.clientX; sy = e.clientY; el.classList.add('press'); el.setPointerCapture(id); });
      const end = e => {
        if (e.pointerId !== id) return; id = null; el.classList.remove('press');
        if (G.paused) return;
        const dx = e.clientX - sx, dy = e.clientY - sy;
        if (hyp(dx, dy) < 18) pressC();
        else if (Math.abs(dx) > Math.abs(dy)) pressC('cross', dx > 0 ? 1 : -1);
        else pressC(dy > 0 ? 'step' : 'spin');
      };
      el.addEventListener('pointerup', end); el.addEventListener('pointercancel', e => { id = null; el.classList.remove('press'); }); }
    $('#rp').onclick = () => endReplay();
    $('#pz').onclick = () => pause(true);
    $('#zi').onclick = () => R.setZoom(R.getZoom() - 0.12);
    $('#zo').onclick = () => R.setZoom(R.getZoom() + 0.12);
    const map = { ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right', ArrowUp: 'up', w: 'up', ArrowDown: 'down', s: 'down' };
    /* a phone turned on its side gets the rotate screen (css); the game waits under it */
    if (window.matchMedia) { const mq = matchMedia('(orientation: landscape) and (max-height: 500px) and (pointer: coarse)'); const f = () => { if (mq.matches && PB.Game.active && G && !G.paused && !G.replay && G.phase !== 'end') pause(true); }; if (mq.addEventListener) mq.addEventListener('change', f); }
    window.addEventListener('keydown', e => {
      if (!PB.Game.active) return;
      const k = map[e.key] || map[e.key.toLowerCase && e.key.toLowerCase()];
      if (k) { input.keys[k] = true; e.preventDefault(); return; }
      if (e.repeat) return;
      if (e.key === ' ' || e.key === 'j' || e.key === 'J') { pressA(true); e.preventDefault(); }
      else if (e.key === 'k' || e.key === 'K') pressB();
      else if (e.key === 'o' || e.key === 'O') pressD();
      else if (e.key === 'l' || e.key === 'L') pressC();
      else if (e.key === 'u' || e.key === 'U') pressC('step');
      else if (e.key === 'i' || e.key === 'I') pressC('spin');
      else if (e.key === 't' || e.key === 'T') tkoGo();
      else if (e.key === 'Escape' || e.key === 'p') pause(!G.paused);
    });
    window.addEventListener('keyup', e => {
      const k = map[e.key] || map[e.key.toLowerCase && e.key.toLowerCase()];
      if (k) input.keys[k] = false;
      if (e.key === ' ' || e.key === 'j' || e.key === 'J') pressA(false);
    });
    window.addEventListener('resize', () => R.resize());
    document.addEventListener('visibilitychange', () => { if (document.hidden && PB.Game.active && !G.paused) pause(true); });
  }
  function pause(on) {
    G.paused = on;
    AU().muffle(on);
    const ov = $('#pause');
    ov.hidden = !on;
    if (on) {
      ov.innerHTML = `<div class="card"><h2>Paused</h2>
        <div class="pmatch">${[0, 1].map(i => { const t = G.teams[i]; return `<div><i style="background:${t.c1};color:${PB.ink ? PB.ink(t.c1, t.c2) : '#fff'}">${t.ab || t.id}</i><b>${G.score[i]}</b><s>${'•'.repeat(Math.max(0, G.to ? G.to[i] : 0))}</s></div>`; }).join(`<span><small>${$('#qt').textContent}</small>${$('#clk').textContent}</span>`)}</div>
        <p class="mute pc">${G.user ? `Your grade ${gradeLetter(G.grade)}` : ''}</p>
        ${G.user && !G.drill ? (() => { const st = G.user.st; return `<p class="pline"><b>${st.pts}</b> pts · <b>${st.reb}</b> reb · <b>${st.ast}</b> ast · ${st.fgm}/${st.fga} FG · ${st.tpm}/${st.tpa} 3PT${st.pf ? ` · ${st.pf} PF` : ''}</p>`; })() : ''}
        ${opts.goals && G.user ? `<div class="pgoals"><b>Your goals</b>${opts.goals.map(g => { const v = g.k === 'grade' ? null : G.user.st[g.k] || 0; const ok = g.k === 'grade' ? LETTERS.indexOf(gradeLetter(G.grade)) >= g.n : g.k === 'tov' ? v <= g.n : v >= g.n;
          return `<span class="${ok ? 'w' : ''}">${ok ? '✓' : '○'} ${g.text}${g.k !== 'grade' ? ` <small>(${v})</small>` : ''}</span>`; }).join('')}</div>` : ''}
        <button class="big" id="pr">Resume</button>
        ${G.user && !G.drill && (G.poss === 0 || G.phase === 'dead') && G.to[0] > 0 ? `<button class="ghost" id="pto">Timeout <small>${G.to[0]} left this half</small></button>` : ''}
        ${G.user && !G.drill && !G.switching ? `<div class="plays"><b>Call a play <small>${G.play ? `${({ iso: 'Get me the ball', pnr: 'Pick-and-roll', post: 'Feed the post' })[G.play.kind]} · ${G.play.left + 1} more trip${G.play.left ? 's' : ''}` : 'for the next three trips'}</small></b>
          <div class="row3"><button class="ghost sm" data-play="iso">Get me the ball</button><button class="ghost sm" data-play="pnr">Pick-and-roll</button><button class="ghost sm" data-play="post">Feed the post</button></div></div>` : ''}
        <button class="ghost" id="pc">Camera: ${R.CAMS[R.getCam()]}</button>
        ${PB.settings ? `<div class="card set">${[['psnd', 'Sound', PB.settings.sound !== false], ['pcom', 'Commentary', PB.settings.commentary !== false]].map(([id, n, on]) => `<div class="srow"><label>${n}</label><div class="seg sw"><button class="tog${on ? ' on' : ''}" id="${id}" role="switch" aria-checked="${on}" aria-label="${n}"><i></i></button></div></div>`).join('')}</div>` : ''}
        <button class="ghost" id="ps">${G.drill ? 'Finish' : 'Sim to the end'}</button>
        <details class="help"><summary>Controls</summary><p><b>Move</b><span>Left thumb. Push to the edge to sprint.</span></p><p><b>Shoot</b><span>Hold, and let go at the top of the jump (the green band). A perfect release goes in unless it is blocked.</span></p><p><b>Pass</b><span>To the open man, or the one your stick points at.</span></p><p><b>Move button</b><span>Tap for a crossover. Swipe left or right to cross that way, down for a step-back, up to spin to the rim.</span></p><p><b>Pick</b><span>With the ball: your big comes over to screen your man.</span></p><p><b>Off the ball</b><span>Call asks for it. Cut runs you to the rim.</span></p><p><b>Defense</b><span>Slide to stay between your man and the rim: get set in front and you cut him off. Steal when the button lights up. Jump as he shoots. Lift your thumb and you stay in front by yourself.</span></p><p><b>Keyboard</b><span>WASD, J or Space to shoot or jump, K pass or steal, L crossover, U step-back, I spin, O pick.</span></p></details></div>`;
      $('#pr').onclick = () => pause(false);
      if ($('#pto')) $('#pto').onclick = () => {
        /* a timeout: a breather, and late in the game the ball comes up to the frontcourt */
        G.to[0]--; ov.hidden = true; G.paused = false; AU().muffle(false);
        for (const p of G.pl) { if (p.energy !== undefined) p.energy = Math.min(1, p.energy + 0.4); p.shoot = null; p.drive = 0; }
        AU().play('whistle'); toast('Timeout', 'call'); B('timeout', { prio: 3, follow: 0.4 }); if (AU().organ) setTimeout(() => AU().organ('walk'), 800);
        const late = G.q >= 4 && G.clock < 120;
        G.poss = null;
        dead(2.4, () => {
          if (late) for (const p of G.pl) { const c = toCourt(0, SPOTS[p.slot][0][0] * 0.9, p.team === 0 ? 30 : 24); p.x = c.x; p.z = c.z; p.vx = p.vz = 0; }
          const h = G.ball.holder && G.ball.holder.team === 0 ? G.ball.holder : G.pl.find(p => p.team === 0 && p.slot === 0);
          give(h); G.shotClock = Math.max(G.shotClock, late ? 14 : G.shotClock);
        });
      };
      ov.querySelectorAll('[data-play]').forEach(bt => bt.onclick = () => {
        G.play = { kind: bt.dataset.play, left: G.poss === 0 ? 2 : 3, done: false };
        pause(false); toast(`Play: ${bt.textContent}`, 'call');
      });
      /* sound and the booth, without leaving the game */
      if ($('#psnd')) $('#psnd').onclick = () => {
        const S = PB.settings, on = S.sound === false; S.sound = on; S.soundOn = on ? 'On' : 'Off'; PB.saveSettings();
        if (AU().crowd) AU().crowd.on(on && !G.drill); if (!on && PB.booth) PB.booth.stop(); pause(true);
      };
      if ($('#pcom')) $('#pcom').onclick = () => {
        const S = PB.settings, on = S.commentary === false; S.commentary = on; S.commentaryOn = on ? 'On' : 'Off'; PB.saveSettings();
        if (!on && PB.booth) PB.booth.stop(); pause(true);
      };
      $('#pc').onclick = () => {
        const ks = Object.keys(R.CAMS), m = ks[(ks.indexOf(R.getCam()) + 1) % ks.length];
        R.setCam(m);
        if (PB.settings) { PB.settings.cam = R.CAMS[m]; PB.saveSettings(); }
        pause(true);
      };
      $('#ps').onclick = () => { ov.hidden = true; G.paused = false; if (G.drill) finish(); else simRest(); };
    }
  }

  /* ---------- start ---------- */
  let bound = false;
  PB.Game = {
    active: false,
    /* o: { teams:[userTeam, oppTeam], rosters:[[5],[5]], userId, qlen, floor, strength:[a,b], diff, onEnd } */
    start(o) {
      /* the players' model may still be on its way on a slow connection: wait for it (up to eight seconds) */
      if (!PB.noGL && R.modelReady && !R.modelReady() && !o._waited) {
        const sc = $('#screen'); sc.hidden = false; sc.innerHTML = '<div class="page post loading"><div class="spin"></div><p class="mute">Loading the arena…</p></div>';
        let done = false; const go = () => { if (done) return; done = true; sc.hidden = true; this.start(Object.assign(o, { _waited: true })); };
        R.loadModel().then(go); setTimeout(go, 8000);
        return;
      }
      if (PB.noGL) { alert('This browser cannot draw the 3D court (WebGL is off or unavailable). Try another browser, or turn on hardware acceleration.'); if (o.onEnd) setTimeout(() => PB.Career.title(), 0); return; }
      opts = o;
      $('#game').hidden = false;
      if (!bound) { bindControls(); bound = true; }
      R.setCam(Object.keys(R.CAMS).find(k => R.CAMS[k] === (PB.settings && PB.settings.cam)) || 'lock');
      /* Player lock's distance, from Settings */
      { const L = { Closer: [34, 25, 6], Default: [42, 32, 8], Farther: [50, 39, 10] }[(PB.settings && PB.settings.camDist) || 'Default'] || [42, 32, 8]; R.lock.back = L[0]; R.lock.up = L[1]; R.lock.ahead = L[2]; R.lock.fov = 52; }
      R.resize();
      R.build(o.floor || o.teams[0]);
      const pl = [];
      o.rosters.forEach((ro, t) => ro.forEach((d, i) => {
        const p = mkOnCourt(d, t, i);
        if (d.id === o.userId) p.isUser = true;
        pl.push(p);
      }));
      const lvl = o.level || 'Pro';
      const D = { Rookie: [0.8, 1.3, 0.6, 0.85], Pro: [0.92, 1.12, 0.85, 0.95], 'All-Star': [1.0, 1.0, 1.0, 1.0], Legend: [1.08, 0.92, 1.25, 1.08] }[lvl] || [0.92, 1.12, 0.85, 0.95];
      G = PB.G = { t: 0, q: 1, qlen: o.qlen || 3, clock: (o.qlen || 3) * 60, shotClock: 24, score: [0, 0], phase: 'tip', tipT: 1.3,
        pl, teams: o.teams, poss: null, paused: false, tf: [0, 0], to: [2, 2], callT: 0, idle: 9, grade: 0, gradeLog: [],
        diff: { oppShot: D[0], oppShootEV: D[1], oppSteal: D[2], oppReb: D[3], mateShot: 1.0 },
        ball: { state: 'held', holder: null, x: 0, y: 7, z: 0, vx: 0, vy: 0, vz: 0, lastTouch: 0 } };
      tape = []; replayCd = 0;
      G.user = pl.find(p => p.isUser) || null;
      G.tko = !o.drill && !o.switching && G.user ? { m: 0, on: false, until: 0, miss: 0 } : null; tkoHud();
      G.home = o.floor && o.floor === o.teams[1] ? 1 : 0; G.squeakT = 0; G.organT = 20;
      G.switching = !!o.switching; if (G.switching) { $('#grade').hidden = true; }
      AU().music(false); AU().crowd.on(true); AU().crowd.level(0.3); AU().muffle(false);
      if (PB.booth && (o.drill === 'dunk' || o.drill === 'contest')) { const L = PB.booth.load(); if (L) L.then(() => PB.booth.pa(o.drill === 'dunk' ? 'dk_intro' : 'contest_intro')); }
      if (PB.booth && !o.drill) {
        /* the home city's own opening when it is recorded, the general one otherwise */
        const fl = o.floor || o.teams[0], has = k => k && PB.VO && PB.VO[k] && PB.VO[k].length;
        /* the night's own opening (a Game 7, a rival, a debut) when there is one, else the city's, else the general one */
        const ck = has(o.callIntro) ? o.callIntro : has('city_' + fl.id) ? 'city_' + fl.id : 'intro';
        const L = PB.booth.load(); if (L) L.then(() => { PB.booth.warm(); B(ck, { prio: 2 }); setTimeout(() => PB.booth.pa('pa_home_' + fl.id), 2600); }); else B(ck, { prio: 2 });
      }
      /* jump ball setup: everyone around the center circle */
      for (const p of pl) {
        const d = dirOf(p.team);
        const lay = [[0, -4], [-10, -8], [10, -8], [-6, -16], [6, -16]][p.slot];
        p.x = lay[0] * (p.slot === 0 ? 1 : 1) + (p.slot === 0 ? 0 : 0); p.z = lay[1] * d;
        if (p.slot === 4) { p.x = 0; p.z = -2 * d; }
        if (p.slot === 0) { p.x = -4 * d; p.z = -6 * d; }
        p.face = p.team === 0 ? 0 : Math.PI;
      }
      G.ball.state = 'tip';
      /* the opening: a sweep over the arena with the matchup on screen; a tap skips it */
      if (!o.drill && !o.enterAt && !o.scenario) {
        G.tipT = 8.4; R.setIntro(8.0, G.user);
        const iv = $('#intro');
        iv.innerHTML = `<div><i style="background:${o.teams[0].c1}"></i><b>${o.teams[0].city}</b><span>${o.teams[0].name}</span></div><em>vs</em><div><i style="background:${o.teams[1].c1}"></i><b>${o.teams[1].city}</b><span>${o.teams[1].name}</span></div><p>${(o.floor || o.teams[0]).city} · ${o.playoff ? 'Playoffs' : 'Tip-off'}</p>`;
        iv.className = ''; iv.hidden = false; clearTimeout(iv.h);
        /* then the starting lineups, the way the broadcast shows them */
        const shot = (p, t) => { try { if (!R.modelReady || !R.modelReady() || PB.noGL) return null;
          const key = [p.d.id || p.name, o.teams[t].id, t, JSON.stringify(p.d.look || '')].join('|'), C = R._shots || (R._shots = new Map());
          if (!C.has(key)) { if (C.size > 120) C.clear(); C.set(key, R.portrait(p.d, o.teams[t], 64, { close: true, kit: t === 0 ? 'icon' : 'assoc' })); }
          return C.get(key); } catch (e) { return null; } };
        const five = t => pl.filter(p => p.team === t).sort((a, b) => a.slot - b.slot).map(p => { const im = shot(p, t); return `<li class="${p.isUser ? 'me' : ''}">${im ? `<img alt="" src="${im}">` : ''}<u>${p.num}</u>${p.name}<small>${p.d.pos || ''}</small></li>`; }).join('');
        iv.h = setTimeout(() => {
          iv.className = 'lineups';
          iv.innerHTML = `<p>Starting lineups</p><div class="lu"><ol style="--c:${o.teams[0].c1}"><h4>${o.teams[0].name}</h4>${five(0)}</ol><ol style="--c:${o.teams[1].c1}"><h4>${o.teams[1].name}</h4>${five(1)}</ol></div>`;
          /* then you, up close, the way the broadcast introduces a starter */
          iv.h = setTimeout(() => { if (iv.className === 'lineups') iv.hidden = true; }, 3000);
          G.spotFn = () => {
            const u = G.user; if (!u) return;
            clearTimeout(iv.h); iv.hidden = false;
            iv.className = 'spot';
            iv.innerHTML = `<div class="lt" style="--c:${o.teams[u.team].c1}"><u>${u.num}</u><div><small>${({ PG: 'Point guard', SG: 'Shooting guard', SF: 'Small forward', PF: 'Power forward', C: 'Center' })[u.d.pos] || ''} · ${o.teams[u.team].name}</small><b>${u.d.first || ''} ${u.d.last || u.name}</b></div></div>`;
            iv.h = setTimeout(() => { iv.hidden = true; }, 2300);
          };
        }, 2600);
        iv.onclick = () => { clearTimeout(iv.h); iv.hidden = true; G.spotFn = null; R.setIntro(0); G.tipT = Math.min(G.tipT, 1.0); };
      }
      /* the other team wears white when its color is too close to yours */
      const rgb = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
      const cd = (a, c) => { const x = rgb(a), y = rgb(c); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); };
      /* the home side in its colors (now and then its black City edition), the visitors in theirs, or in white when the
         two would look alike */
      const hi = G.home, homeT = o.teams[hi], awayT = o.teams[1 - hi];
      const kh = PB.kit ? PB.kit(homeT, o.homeKit || (o.drill ? 'icon' : (r => r < 0.15 ? 'city' : r < 0.27 ? 'statement' : 'icon')(rand()))) : { c1: homeT.c1, c2: homeT.c2, name: homeT.name };
      let ka = PB.kit ? PB.kit(awayT, 'icon') : { c1: awayT.c1, c2: awayT.c2, name: awayT.name };
      if (cd(kh.c1, ka.c1) < 120) ka = PB.kit ? PB.kit(awayT, 'assoc') : { c1: '#f2f2f2', c2: awayT.c1, name: awayT.name };
      const k0 = hi === 0 ? kh : ka, k1 = hi === 0 ? ka : kh;
      for (const p of pl) R.addPlayer(p, p.team === 0 ? k0 : k1);
      G.kits = [k0, k1];
      /* the bench: identities that can trade places with the men on the floor */
      if (o.bench && !o.drill) {
        const ident = d => ({ d, r: d.r, ht: d.ht, name: d.last, num: d.num, st: mkOnCourt(d, 0, 0).st, energy: 1 });
        G.bench = [0, 1].map(t => (o.bench[t] || []).filter(d => d && !pl.some(p => p.d === d)).slice(0, 5).map(ident));
        G.starters = [0, 1].map(t => pl.filter(p => p.team === t).sort((a, b) => a.slot - b.slot).map(p => ({ d: p.d, r: p.r, ht: p.ht, name: p.name, num: p.num, st: p.st, energy: 1 })));
        for (const p of pl) p.energy = p.energy ?? 1;
        G.played = pl.map(p => p.st); G.playedBy = pl.map(p => ({ d: p.d, team: p.team }));
      }
      if (!o.drill && R.addRefs) R.addRefs();
      if (R.setBenches) R.setBenches(o.drill ? null : [k0, k1]);
      R.tag(o.rivalId ? pl.find(p => p.d.id === o.rivalId) || null : null, 'RIVAL');
      $('#a0').textContent = o.teams[0].ab || o.teams[0].id; $('#a1').textContent = o.teams[1].ab || o.teams[1].id;
      $('#sd0 i').style.background = o.teams[0].c1; $('#sd1 i').style.background = o.teams[1].c1;
      $('#feed').innerHTML = ''; $('#grade').innerHTML = G.user ? '<b>C+</b><span>Teammate grade</span>' : '';
      $('#grade').hidden = !G.user || !!o.switching; $('#ftmsg').hidden = true; $('#pause').hidden = true;
      if (o.drill) {
        const def = DRILLS[o.drill];
        G.drill = { kind: o.drill, def: o.drill === 'dunk' ? { ...def, dunks: o.dunks || def.dunks } : def, rack: 0, ball: 0, score: 0, made: 0, att: 0, t: def.secs, next: 0, over: false, n: 0, scores: [], style: 0 };
        if (R.setRacks) R.setRacks(def.balls ? def.spots.map(sp => Object.assign(toCourt(0, sp[0], sp[1]), { hz: hoopZ(0) })) : null, def.balls || 0, def.money);
        G.phase = 'live'; G.poss = 0; G.clock = def.secs;
        if (o.drill === 'dunk') { G.drill.next = 0.4; const sp = dunkSpot(); G.user.x = sp.x; G.user.z = sp.z; G.user.face = Math.atan2(-sp.x, hoopZ(0) - sp.z); }
        else if (o.drill === 'free') { const sp = toCourt(0, 0, 18); G.user.x = sp.x; G.user.z = sp.z; G.user.face = 0; give(G.user); }
        else { const sp = drillSpot(); G.user.x = sp.x; G.user.z = sp.z - 3; G.user.face = 0; give(G.user); }
        $('#a0').textContent = 'PTS'; $('#a1').textContent = o.drill === 'dunk' ? 'DUNK' : 'SHOTS';
        $('#grade').hidden = true;
        setTimeout(() => toast(def.title, 'call'), 200);
      }
      /* the second night of a back-to-back: your legs start heavier */
      if (o.tired && G.user) { G.user.energy = 0.78; setTimeout(() => feed('Second night of a back-to-back: heavy legs'), 600); }
      /* off the bench: the game before you check in is played out by the teams' strength */
      if (o.enterAt) {
        const secs = o.enterAt * G.qlen * 60 * 4;
        const poss = secs / 14;
        for (const t of [0, 1]) { const str = ((o.strength && o.strength[t]) || 75); G.score[t] += Math.max(0, Math.round(poss / 2 * (1.08 + (str - 75) * 0.012) + PB.gauss() * 1.5)); }
        let left = secs; while (left >= G.clock) { left -= G.clock; G.q++; G.clock = G.qlen * 60; }
        G.clock -= left;
        G.phase = 'dead'; G.deadT = 1.6; G.tipWinner = 0;
        G.then = () => { inboundTo(G.score[0] > G.score[1] ? 1 : 0, toCourt(G.score[0] > G.score[1] ? 1 : 0, 0, 70)); };
        for (const p of pl) { const c = toCourt(p.team, SPOTS[p.slot][0][0] * 0.8, p.team === 0 ? 40 : 55); p.x = c.x; p.z = c.z; }
        setTimeout(() => toast(o.enterAt < 0.2 ? 'You check in' : 'Off the bench: you check in', 'call'), 300);
        feed(`You start on the bench · ${G.q === 1 ? '1st' : '2nd'} quarter, ${Math.floor(G.clock / 60)}:${String(Math.floor(G.clock % 60)).padStart(2, '0')}`);
      }
      /* a scenario: a set score, quarter and clock, one side with the ball out of bounds in its frontcourt */
      if (o.scenario) {
        const sc = o.scenario; G.q = sc.q || 4; G.clock = sc.clock; G.score = sc.score.slice(); G.tf = sc.tf || [3, 3]; G.to = sc.to || [1, 1];
        G.phase = 'dead'; G.deadT = 1.4; G.tipWinner = 0;
        for (const p of pl) { const c = toCourt(sc.poss, SPOTS[p.slot][0][0], p.team === sc.poss ? 24 : 18); p.x = c.x; p.z = c.z; }
        G.then = () => inboundOut(sc.poss, toCourt(sc.poss, 25, 30));
        setTimeout(() => toast(sc.title || 'Go', 'call'), 300);
        if (PB.booth) { const L = PB.booth.load(); if (L) L.then(() => setTimeout(() => B('daily_intro', { prio: 3 }), 600)); }
      }
      this.active = true;
      last = performance.now();
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(frame);
    },
    /* after the game: your highlights, one after another at half speed from the replay camera; a tap skips one */
    reel(list, done, o) {
      if (!G || !list || !list.length) { if (done) done(); return; }
      const el = $('#game'), rp = $('#rp');
      /* o.record: film the canvas while it plays and hand back a video file */
      let rec = null, chunks = [], comp = null, cg = null;
      if (o && o.record && window.MediaRecorder && $('#gl').captureStream) {
        const types = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'];
        const type = types.find(t => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t));
        /* each frame goes onto a 2D canvas with a caption (the page's own overlays are not in the picture) */
        /* 1080 by 1920, vertical: ready for a phone feed */
        comp = document.createElement('canvas'); comp.width = 1080; comp.height = 1920; cg = comp.getContext('2d');
        const vs = comp.captureStream(30), as = AU().stream && AU().stream();
        const ms = as && as.getAudioTracks().length ? new MediaStream([...vs.getVideoTracks(), ...as.getAudioTracks()]) : vs;
        try { rec = new MediaRecorder(ms, type ? { mimeType: type, videoBitsPerSecond: 8e6 } : undefined); rec.ondataavailable = e => { if (e.data && e.data.size) chunks.push(e.data); }; rec.start(250); } catch (e) { rec = null; }
      }
      const caption = () => {
        if (!cg) return;
        const gl = $('#gl'), W = comp.width, H = comp.height, sc = W / 390, r = G.replay;
        /* cover: fill the frame, crop what spills over */
        const k = Math.max(W / gl.width, H / gl.height), dw = gl.width * k, dh = gl.height * k;
        cg.fillStyle = '#05070b'; cg.fillRect(0, 0, W, H); cg.drawImage(gl, (W - dw) / 2, (H - dh) / 2, dw, dh);
        const t0 = G.teams[0], t1 = G.teams[1], lab = r ? r.label : '', sub = r ? r.sub : '';
        cg.fillStyle = 'rgba(8,10,16,.72)'; cg.fillRect(0, H - 92 * sc, W, 92 * sc);
        cg.fillStyle = t0.c1; cg.fillRect(0, H - 92 * sc, 6 * sc, 92 * sc);
        cg.fillStyle = '#fff'; cg.font = `900 ${26 * sc}px Archivo, Arial`; cg.textBaseline = 'alphabetic';
        cg.fillText(lab.toUpperCase(), 20 * sc, H - 54 * sc);
        cg.fillStyle = '#c9d0de'; cg.font = `600 ${14 * sc}px Inter, Arial`; cg.fillText(sub, 20 * sc, H - 30 * sc);
        cg.fillStyle = '#ffffff'; cg.font = `800 ${12 * sc}px Archivo, Arial`; cg.textAlign = 'right';
        cg.fillText('POCKETBASKETBALL', W - 16 * sc, H - 30 * sc); cg.textAlign = 'left';
        cg.fillStyle = 'rgba(8,10,16,.72)'; cg.fillRect(0, 0, W, 40 * sc);
        cg.fillStyle = '#fff'; cg.font = `800 ${16 * sc}px Archivo, Arial`;
        cg.fillText(`${t0.ab || t0.id} ${G.score[0]}  ·  ${G.score[1]} ${t1.ab || t1.id}`, 16 * sc, 26 * sc);
      };
      const finishRec = () => new Promise(res => { if (!rec) { res(null); return; } rec.onstop = () => res(new Blob(chunks, { type: rec.mimeType || 'video/webm' })); rec.stop(); });
      $('#screen').hidden = true; $('#pause').hidden = true; $('#intro').hidden = true; $('#tipcard').hidden = true; G.paused = false;
      el.hidden = false; el.classList.add('replaying', 'show');
      const ordered = list.slice().sort((a, b) => a.q - b.q || b.clock - a.clock);
      let i = 0;
      const next = () => {
        if (i >= ordered.length) {
          cancelAnimationFrame(raf); G.replay = null; R.setReplay(false); el.classList.remove('replaying', 'show'); el.hidden = true; rp.hidden = true;
          clearTimeout(reelSnd.a); clearTimeout(reelSnd.b); AU().crowd.on(false); if (PB.booth) PB.booth.stop();
          rp.innerHTML = '<i></i>REPLAY<small>tap to skip</small>';
          if (rec) finishRec().then(blob => { if (done) done(blob); }); else if (done) done(); return;
        }
        const r = ordered[i++];
        /* the sound of it: the building back up, the roar on the make, the booth's call */
        const call = r.kind === 'block' ? 'block' : r.kind === 'dunk' ? 'dunk' : /Three/.test(r.label) ? 'three' : r.kind === 'layup' ? 'layup' : 'jumper';
        clearTimeout(reelSnd.a); clearTimeout(reelSnd.b);
        reelSnd.a = setTimeout(() => B(call, { prio: 6 }), 3600); reelSnd.b = setTimeout(() => { AU().crowd.react('roar', 1.2); AU().play(r.kind === 'dunk' ? 'dunk' : r.kind === 'block' ? 'block' : 'swish'); }, 4300);
        G.replay = { frames: r.frames, i: 0, kind: r.kind, onEnd: next, label: r.label, sub: `${['', '1st quarter', '2nd quarter', '3rd quarter', '4th quarter'][r.q] || 'Overtime'} · ${G.user ? G.user.d.first + ' ' + G.user.d.last : ''}` };
        rp.innerHTML = `<i></i>${r.label.toUpperCase()}<small>${['', '1st', '2nd', '3rd', '4th'][r.q] || 'OT'} · highlight ${i} of ${ordered.length} · tap to skip</small>`;
        rp.hidden = false; R.setReplay(true);
      };
      AU().crowd.on(true); AU().crowd.level(0.45); AU().muffle(false);
      next();
      cancelAnimationFrame(raf); last = performance.now();
      const loop = now => { raf = requestAnimationFrame(loop); const dt = Math.max(0, Math.min(0.05, (now - last) / 1000 || 0.016)); last = now; if (!G.replay) return; replayFrame(dt); R.update(G, dt * 0.5); R.render(); if (G.replay) caption(); };
      raf = requestAnimationFrame(loop);
    },
    /* test hooks */
    dbg: { state: () => G, ft: n => { for (const p of G.pl) p.shoot = null; G.ftq = { shooter: G.user, n: n || 2, total: n || 2 }; startFT(); }, reelNow: label => { G.reelPend = { kind: 'dunk', val: 9, label: label || 'Test', at: G.t, q: G.q, clock: G.clock }; },
      auto: on => { G.auto = on; },
      replay: k => { replayCd = 0; wantReplay(k || 'dunk'); },
      /* run the simulation ahead without drawing: sec seconds of game time */
      run: sec => { for (let t = 0; t < sec && G.phase !== 'end'; t += 1 / 60) step(1 / 60); return G && { score: G.score, q: G.q, clock: G.clock, phase: G.phase }; }, simRest: () => simRest(), press: (b, down, k, d) => b === 'A' ? pressA(down) : b === 'B' ? pressB() : pressC(k, d), stick: (x, y) => { input.sx = x; input.sy = y; } },
  };
})();
