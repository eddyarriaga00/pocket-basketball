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
  const parkSide = () => (G.user && G.user.z < 0 ? -1 : 1);
  const hoopZ = team => G && G.park ? RIM * parkSide() : G && (G.half || G.horse) ? RIM : team === 0 ? RIM : -RIM;      // the hoop a team attacks (on the blacktop both attack the same one)
  const dirOf = team => G && G.park ? parkSide() : G && (G.half || G.horse) ? 1 : team === 0 ? 1 : -1;
  const hyp = Math.hypot;
  const AU = () => PB.audio || { play() {}, crowd: { react() {}, level() {}, on() {} }, muffle() {}, music() {} };
  const home = t => G && t === G.home;   // the crowd is the home team's
  const B = (k, o) => { if (PB.booth) PB.booth.say(k, o); };   // the booth
  const CH = (k, p) => { if (PB.booth && PB.booth.chat && p && !G.drill) PB.booth.chat(k, p.x, p); };   // a player talking on the floor
  const bt = (p, k) => (p && p.d && p.d.badges && p.d.badges[k]) || 0;   // a badge's tier, 0 to 3
  /* a short buzz in the hand, where the phone allows it (Android; iPhones do not let web pages vibrate) */
  const buzz = ms => { if (PB.settings && PB.settings.vibrate === false) return; if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;   // (a browser refuses, loudly, before the first touch)
    try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) { /* not allowed */ } };
  /* Settings › Shot timing: how wide the green band is */
  const timingEase = () => ({ Easy: 1.6, Normal: 1, Hard: 0.7 }[(PB.settings && PB.settings.timing) || 'Normal'] || 1) * (PB.settings && PB.settings.meterOn === 'Off' ? 1.15 : 1);   // no meter on screen: shooting by the look of the jump earns a wider window
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

  /* ---------- the play book ----------
     A play is data: where the five stand (a formation), who it is for, who screens, and what happens (the kind:
     an isolation, a ball screen, a post-up, a shot off a screen, a cut, a handoff, a drive, a tempo). You call one from
     the pause menu for three trips; when you have called nothing the benches call their own. */
  const mir = F => F.map(k => [-k[0], k[1]]);
  const FORM = {
    five: [[0, 27], [-17.5, 21.5], [17.5, 21.5], [-22.5, 3.5], [22.5, 3.5]],
    four1: [[0, 27], [-18, 20], [18, 20], [-22.5, 3.5], [6, 6]],
    horns: [[0, 28], [-22, 4], [22, 4], [-8, 17], [8, 17]],
    high14: [[0, 29], [-20, 17], [20, 17], [-7, 17], [7, 17]],
    low14: [[0, 29], [-22, 3.5], [22, 3.5], [-7, 4], [7, 4]],
    box: [[0, 28], [-7, 5], [7, 5], [-7, 16], [7, 16]],
    tri: [[-8, 26], [17, 20], [22, 4], [-15, 17], [8, 7]],
    three2: [[0, 27], [-18, 20], [18, 20], [-7, 6], [7, 6]],
    spread: [[0, 28], [-21, 12], [21, 12], [-22.5, 3.5], [22.5, 3.5]],
    stack: [[0, 28], [8, 5], [18, 20], [8, 8.5], [-7, 6]],
    overR: [[6, 27], [19, 19], [22.5, 4], [-16, 20], [8, 7]],
    corners: [[0, 30], [-22, 22], [22, 22], [-22, 4], [22, 4]],
    awayR: [[8, 27], [19, 20], [22.5, 4], [12, 10], [6, 5]],
    sideR: [[16, 21], [-18, 20], [-22.5, 4], [0, 27], [9, 14]],
    emptyR: [[14, 23], [-18, 20], [-22.5, 4], [-5, 27], [8, 16]],
    drag: [[0, 30], [-22.5, 4], [22.5, 4], [-5, 25], [5, 25]],
    spain: [[0, 29], [-22.5, 4], [0, 14], [22.5, 4], [4, 24]],
    pistol: [[-14, 24], [-21, 14], [22.5, 4], [18, 20], [-4, 26]],
    chicago: [[0, 28], [-22, 5], [22, 4], [-14, 12], [6, 24]],
    hilo: [[0, 28], [-22, 5], [22, 5], [0, 16], [6, 5]],
  };
  FORM.overL = mir(FORM.overR); FORM.awayL = mir(FORM.awayR); FORM.sideL = mir(FORM.sideR); FORM.emptyL = mir(FORM.emptyR);
  const BOOK = [], CATS = ['Isolation', 'Pick-and-roll', 'Post', 'Shooters', 'Cuts', 'Handoffs', 'Sets', 'Drives', 'Tempo'];
  { const a = (cat, id, name, hint, kind, o) => BOOK.push(Object.assign({ cat, id, name, hint, kind }, o));
    const POS = ['the point', 'the two', 'the three', 'the four', 'the five'];
    a('Quick', 'iso', 'Get me the ball', 'Everyone clears out. It is yours', 'iso');
    a('Quick', 'pnr', 'Pick-and-roll', 'The big screens, then rolls to the rim', 'pnr');
    a('Quick', 'pnp', 'Pick-and-pop', 'The big screens, then steps out for the jumper', 'pnp');
    a('Quick', 'post', 'Feed the post', 'The ball goes down to the big on the block', 'post');
    a('Quick', 'five', 'Five out', 'All five behind the arc. The lane is empty', 'five');
    a('Quick', 'cut', 'Cutters', 'Teammates keep cutting to the rim. Hit them', 'cut');
    a('Quick', 'shoot', 'Find the shooter', 'Your best shooter runs free. Get it to him', 'shoot');
    a('Quick', 'hand', 'Handoff', 'A wing comes to the ball and takes it going downhill', 'hand');
    a('Quick', 'screen', 'Screen for me', 'Off the ball, a big frees you from your man', 'screen');
    a('Quick', 'drive', 'Drive and kick', 'Shooters in the corners, a big by the rim', 'drive');
    a('Quick', 'fast', 'Push the pace', 'Run. Early shots, early drives', 'fast');
    a('Quick', 'slow', 'Slow it down', 'Work the clock, then go late', 'slow');
    /* isolation */
    a('Isolation', 'iso_top', 'Iso up top', 'You at the top, four flat along the baseline', 'iso', { who: 'u', f: 'low14', at: [0, 25] });
    a('Isolation', 'iso_lw', 'Iso left wing', 'The left side is yours. Everyone else goes right', 'iso', { who: 'u', f: 'awayR', at: [-16, 20] });
    a('Isolation', 'iso_rw', 'Iso right wing', 'The right side is yours. Everyone else goes left', 'iso', { who: 'u', f: 'awayL', at: [16, 20] });
    a('Isolation', 'iso_le', 'Iso left elbow', 'You at the left elbow with room to work', 'iso', { who: 'u', f: 'awayR', at: [-8, 15] });
    a('Isolation', 'iso_re', 'Iso right elbow', 'You at the right elbow with room to work', 'iso', { who: 'u', f: 'awayL', at: [8, 15] });
    [[0, 25], [-16, 20], [16, 20], [-8, 15], [8, 15]].forEach((at, i) => a('Isolation', 'iso_' + (i + 1), 'Iso ' + POS[i], 'Clear out for ' + POS[i] + '. He goes one on one', 'iso', { who: i, f: i === 0 ? 'low14' : at[0] < 0 ? 'awayR' : 'awayL', at }));
    a('Isolation', 'iso_star', 'Iso the scorer', 'The hot hand gets it with the floor cleared', 'iso', { who: 'x', f: 'low14', at: [0, 25] });
    a('Isolation', 'iso_hold', 'Hold for one', 'Run the clock down, then it is yours', 'iso', { who: 'u', f: 'low14', at: [0, 27], slow: true });
    /* the ball screen */
    a('Pick-and-roll', 'pnr_high', 'High pick-and-roll', 'The five screens up top with four spread around', 'pnr', { scr: 4, f: 'four1' });
    a('Pick-and-roll', 'pnr_hpop', 'High pick-and-pop', 'The five screens up top and pops to the line', 'pnp', { scr: 4, f: 'five' });
    a('Pick-and-roll', 'pnr_sl', 'Side pick, left', 'The ball goes to the left wing and the big comes over', 'pnr', { who: 0, scr: 4, f: 'sideL', at: [-16, 21] });
    a('Pick-and-roll', 'pnr_sr', 'Side pick, right', 'The ball goes to the right wing and the big comes over', 'pnr', { who: 0, scr: 4, f: 'sideR', at: [16, 21] });
    a('Pick-and-roll', 'pnr_horns', 'Horns', 'Both bigs at the elbows. The five screens and rolls', 'pnr', { scr: 4, f: 'horns' });
    a('Pick-and-roll', 'pnr_hornp', 'Horns pop', 'Both bigs at the elbows. The four screens and pops', 'pnp', { scr: 3, f: 'horns' });
    a('Pick-and-roll', 'pnr_spread', 'Spread pick', 'Shooters wide, the lane open for the roll', 'pnr', { scr: 4, f: 'spread' });
    a('Pick-and-roll', 'pnr_el', 'Empty corner, left', 'Pick on the left with nobody in that corner to help', 'pnr', { who: 0, scr: 4, f: 'emptyL', at: [-14, 23] });
    a('Pick-and-roll', 'pnr_er', 'Empty corner, right', 'Pick on the right with nobody in that corner to help', 'pnr', { who: 0, scr: 4, f: 'emptyR', at: [14, 23] });
    a('Pick-and-roll', 'pnr_4', 'Pick with the four', 'The power forward sets it and rolls', 'pnr', { scr: 3 });
    a('Pick-and-roll', 'pnp_4', 'Pop with the four', 'The power forward sets it and steps out', 'pnp', { scr: 3 });
    a('Pick-and-roll', 'pnr_drag', 'Double drag', 'Both bigs wait up top as the ball comes up', 'pnr', { scr: 4, f: 'drag', fast: true });
    a('Pick-and-roll', 'pnr_step', 'Step-up screen', 'The big steps up on the wing, toward the baseline', 'pnr', { who: 0, scr: 4, f: 'sideR', at: [17, 17] });
    a('Pick-and-roll', 'pnr_slip', 'Slip the screen', 'The big shows the screen and dives early', 'pnr', { scr: 4, slip: true });
    a('Pick-and-roll', 'pnr_spain', 'Spain pick', 'A shooter waits behind the roll, then pops up top', 'pnr', { scr: 4, f: 'spain' });
    a('Pick-and-roll', 'pnr_14', '1-4 high pick', 'Four across the foul line, then the five screens', 'pnr', { scr: 4, f: 'high14' });
    a('Pick-and-roll', 'pnr_2', 'Pick for the two', 'The shooting guard gets it and the screen', 'pnr', { who: 1, scr: 4, at: [-15, 22] });
    a('Pick-and-roll', 'pnr_3', 'Pick for the three', 'The small forward gets it and the screen', 'pnr', { who: 2, scr: 4, at: [15, 22] });
    a('Pick-and-roll', 'pnr_gg', 'Guard screen', 'The two screens for the point, then pops', 'pnp', { who: 0, scr: 1 });
    a('Pick-and-roll', 'pnr_me', 'Pick-and-roll for me', 'You get the ball, then the screen', 'pnr', { who: 'u' });
    a('Pick-and-roll', 'pnp_me', 'Pick-and-pop for me', 'You get the ball, the big screens and pops', 'pnp', { who: 'u' });
    a('Pick-and-roll', 'pnr_early', 'Early drag', 'A screen in transition before the defense is set', 'pnr', { scr: 4, fast: true });
    /* the post */
    a('Post', 'post_l', 'Post the five, left', 'The center on the left block', 'post', { who: 4, at: [-7, 6] });
    a('Post', 'post_r', 'Post the five, right', 'The center on the right block', 'post', { who: 4, at: [7, 6] });
    a('Post', 'post_4l', 'Post the four, left', 'The power forward on the left block', 'post', { who: 3, at: [-7, 6] });
    a('Post', 'post_4r', 'Post the four, right', 'The power forward on the right block', 'post', { who: 3, at: [7, 6] });
    a('Post', 'post_3', 'Post the three', 'The small forward takes his man down low', 'post', { who: 2, at: [7, 6] });
    a('Post', 'post_2', 'Post the two', 'The shooting guard takes his man down low', 'post', { who: 1, at: [-7, 6] });
    a('Post', 'post_1', 'Post the point', 'The point guard backs his man down', 'post', { who: 0, at: [7, 7] });
    a('Post', 'post_me', 'Post me up', 'Get to the block. The ball finds you there', 'post', { who: 'u', at: [7, 6] });
    a('Post', 'post_high', 'High post', 'The five catches at the elbow', 'post', { who: 4, at: [7, 15] });
    a('Post', 'post_41', 'Four around one', 'The five inside, four shooters around him', 'post', { who: 4, f: 'four1', at: [6, 6] });
    a('Post', 'post_tri', 'Triangle', 'Corner, wing and post on one side', 'post', { who: 4, f: 'tri', at: [8, 7] });
    a('Post', 'post_hilo', 'High-low', 'The four at the foul line feeds the five under', 'post', { who: 4, f: 'hilo', at: [6, 5] });
    a('Post', 'post_duck', 'Duck in', 'Your best big seals in front of the rim', 'post', { who: 'b', at: [0, 6] });
    /* shots off screens */
    a('Shooters', 'sh_pin2', 'Pin-down, two', 'The five screens down for the shooting guard', 'shoot', { who: 1, scr: 4, at: [-17, 20] });
    a('Shooters', 'sh_pin3', 'Pin-down, three', 'The five screens down for the small forward', 'shoot', { who: 2, scr: 4, at: [17, 20] });
    a('Shooters', 'sh_fl2', 'Flare, two', 'The two fades to the left side off the four', 'shoot', { who: 1, scr: 3, at: [-21, 12] });
    a('Shooters', 'sh_fl3', 'Flare, three', 'The three fades to the right side off the four', 'shoot', { who: 2, scr: 3, at: [21, 12] });
    a('Shooters', 'sh_floppy', 'Floppy', 'Your shooter starts under the rim and runs off a big', 'shoot', { who: 's', scr: 4, f: 'box', at: [18, 19] });
    a('Shooters', 'sh_elev', 'Elevator doors', 'The shooter runs up the middle between two bigs', 'shoot', { who: 's', scr: 4, f: 'box', at: [0, 26] });
    a('Shooters', 'sh_hammer', 'Hammer', 'A back screen frees the three in the far corner', 'shoot', { who: 2, scr: 3, at: [22.5, 3.5] });
    a('Shooters', 'sh_stag', 'Stagger', 'The shooter comes off two screens to the wing', 'shoot', { who: 's', scr: 3, f: 'stack', at: [-18, 20] });
    a('Shooters', 'sh_cl', 'Corner three, left', 'Your shooter in the left corner', 'shoot', { who: 's', f: 'four1', at: [-22.5, 3.5] });
    a('Shooters', 'sh_cr', 'Corner three, right', 'Your shooter in the right corner', 'shoot', { who: 's', f: 'four1', at: [22.5, 3.5] });
    a('Shooters', 'sh_top', 'Shooter up top', 'Your shooter lifts to the top of the arc', 'shoot', { who: 's', at: [0, 26.5] });
    a('Shooters', 'sh_mepin', 'Pin-down for me', 'A big screens your man. Come up to the wing', 'screen', { who: 'u', scr: 4 });
    a('Shooters', 'sh_mefl', 'Flare for me', 'The four screens your man. Fade to the side', 'screen', { who: 'u', scr: 3 });
    a('Shooters', 'sh_4', 'Stretch four', 'The power forward spots up in the corner', 'shoot', { who: 3, at: [-22.5, 3.5] });
    a('Shooters', 'sh_5', 'Trail three', 'The five trails the play to the top of the arc', 'shoot', { who: 4, at: [0, 26.5] });
    a('Shooters', 'sh_zip', 'Zipper', 'The two comes straight up the lane off the five', 'shoot', { who: 1, scr: 4, f: 'box', at: [0, 25] });
    a('Shooters', 'sh_iver', 'Iverson cut', 'The two runs over both elbows to the far wing', 'shoot', { who: 1, scr: 3, f: 'high14', at: [18, 20] });
    /* cuts */
    a('Cuts', 'cut_gng', 'Give and go', 'Pass, then cut hard for the return', 'gng');
    a('Cuts', 'cut_bl', 'Backdoor, two', 'The shooting guard goes behind his man', 'cut', { who: 1 });
    a('Cuts', 'cut_br', 'Backdoor, three', 'The small forward goes behind his man', 'cut', { who: 2 });
    a('Cuts', 'cut_ucla', 'UCLA cut', 'The point passes to the wing and cuts off the high post', 'cut', { who: 0, f: 'high14' });
    a('Cuts', 'cut_flex', 'Flex', 'The three cuts along the baseline off a screen', 'cut', { who: 2, f: 'box' });
    a('Cuts', 'cut_prin', 'Princeton', 'Bigs high, and the two cuts backdoor', 'cut', { who: 1, f: 'high14' });
    a('Cuts', 'cut_5', 'Five to the rim', 'The center dives. Throw it up to him', 'cut', { who: 4 });
    a('Cuts', 'cut_4', 'Four dives', 'The power forward dives from the wing', 'cut', { who: 3 });
    a('Cuts', 'cut_base', 'Baseline cut', 'The three slides along the baseline from the corner', 'cut', { who: 2, f: 'four1' });
    a('Cuts', 'cut_split', 'Split cuts', 'Out of the triangle, everybody cuts off the post', 'cut', { f: 'tri' });
    a('Cuts', 'cut_motion', 'Motion', 'Pass, cut, fill. Nobody stands still', 'cut', { f: 'three2' });
    /* handoffs */
    a('Handoffs', 'hand_2', 'Handoff, two', 'The shooting guard comes to take it', 'hand', { who: 1 });
    a('Handoffs', 'hand_3', 'Handoff, three', 'The small forward comes to take it', 'hand', { who: 2 });
    a('Handoffs', 'hand_4', 'Handoff, four', 'The power forward comes to take it', 'hand', { who: 3 });
    a('Handoffs', 'hand_me', 'Handoff for me', 'Run to the ball. It is handed to you', 'hand', { who: 'u' });
    a('Handoffs', 'hand_pistol', 'Pistol', 'A quick handoff on the left wing', 'hand', { who: 1, f: 'pistol' });
    a('Handoffs', 'hand_chi', 'Chicago', 'A screen down, then a handoff on the move', 'hand', { who: 1, f: 'chicago' });
    a('Handoffs', 'hand_weave', 'Weave', 'Handoff after handoff until someone turns the corner', 'hand', { again: true });
    /* formations */
    a('Sets', 'set_41', 'Four out, one in', 'Four on the arc, the five by the rim', 'set', { f: 'four1' });
    a('Sets', 'set_horns', 'Horns set', 'Bigs at the elbows, wings in the corners', 'set', { f: 'horns' });
    a('Sets', 'set_14h', '1-4 high', 'Four across the foul line', 'set', { f: 'high14' });
    a('Sets', 'set_14l', '1-4 low', 'Four flat along the baseline', 'set', { f: 'low14' });
    a('Sets', 'set_box', 'Box', 'Two on the blocks, two at the elbows', 'set', { f: 'box' });
    a('Sets', 'set_tri', 'Triangle set', 'Corner, wing and post on the right', 'set', { f: 'tri' });
    a('Sets', 'set_32', 'Three out, two in', 'Three on the arc, both bigs inside', 'set', { f: 'three2' });
    a('Sets', 'set_spread', 'Spread', 'Everyone wide, as far from the lane as it gets', 'set', { f: 'spread' });
    a('Sets', 'set_ol', 'Overload left', 'Four on the left side of the floor', 'set', { f: 'overL' });
    a('Sets', 'set_or', 'Overload right', 'Four on the right side of the floor', 'set', { f: 'overR' });
    a('Sets', 'set_stack', 'Stack', 'Two stacked on the right block', 'set', { f: 'stack' });
    /* drives */
    a('Drives', 'dr_1', 'Downhill, point', 'The point guard puts his head down and goes', 'drive', { who: 0 });
    a('Drives', 'dr_2', 'Downhill, two', 'The shooting guard attacks from the wing', 'drive', { who: 1, at: [-16, 21] });
    a('Drives', 'dr_3', 'Downhill, three', 'The small forward attacks from the wing', 'drive', { who: 2, at: [16, 21] });
    a('Drives', 'dr_me', 'Clear the lane', 'You get it with all four behind the line', 'drive', { who: 'u', f: 'five' });
    a('Drives', 'dr_ddm', 'Dribble drive', 'Four out, attack the gaps, the five waits for the dump-off', 'drive', { f: 'four1' });
    a('Drives', 'dr_swing', 'Drive, kick, swing', 'Five out. Drive, kick it, and keep it moving', 'drive', { f: 'five' });
    /* tempo */
    a('Tempo', 't_7', 'Seven seconds', 'Five out and the first good look goes up', 'fast', { f: 'five' });
    a('Tempo', 't_241', 'Two for one', 'Shoot early so you get the ball back before the horn', 'fast');
    a('Tempo', 't_4c', 'Four corners', 'Spread to the corners and make them chase', 'slow', { f: 'corners' });
    a('Tempo', 't_last', 'Last shot', 'Hold it high, then go with the clock nearly gone', 'slow', { f: 'high14' });
  }
  const PLAYS = {}; for (const b of BOOK) PLAYS[b.id] = [b.name, b.hint];
  const ZONES = { z23: [[-9, 17], [9, 17], [-14, 6], [14, 6], [0, 4.5]], z32: [[0, 21], [-14, 16], [14, 16], [-7, 5], [7, 5]], z131: [[0, 23], [-14, 13], [14, 13], [0, 13], [0, 4.5]], box: [[-7, 15], [7, 15], [-7, 5], [7, 5]] };
  const DBOOK = {
    tight: { name: 'Press up', hint: 'Everybody up in their man. Risky against drivers', on: 0.86, off: 'tight' },
    sag: { name: 'Pack the paint', hint: 'Sag off and wall the lane. Gives up jumpers', on: 1.25, off: 'sag' },
    dbl: { name: 'Double the ball', hint: 'A second man goes at the handler. Someone is open', dbl: 'all' },
    press: { name: 'Full-court press', hint: 'Pick them up as soon as they have it', on: 0.86, off: 'tight', press: true },
    z23: { name: '2-3 zone', hint: 'Two up top, three along the baseline. Guards the paint', zone: 'z23' },
    z32: { name: '3-2 zone', hint: 'Three on the arc, two under. Guards the line', zone: 'z32' },
    z131: { name: '1-3-1 zone', hint: 'Long arms in every passing lane. Weak in the corners', zone: 'z131' },
    box1: { name: 'Box and one', hint: 'Four in a box, one man glued to their scorer', zone: 'box', one: true, deny: true },
    deny: { name: 'Deny the scorer', hint: 'Their best scorer does not catch it easily', deny: true },
    dblstar: { name: 'Double the scorer', hint: 'Two go at their best scorer whenever he has it', dbl: 'star' },
    trap: { name: 'Half-court trap', hint: 'Two jump the ball as it crosses half court', dbl: 'trap' },
    ptrap: { name: 'Full-court trap', hint: 'Press, and trap the ball wherever it is', on: 0.86, off: 'tight', press: true, dbl: 'full' },
    gamble: { name: 'Gamble for steals', hint: 'Hands in every lane. More steals, more fouls', steal: 1.6, foul: 1.5, on: 0.9 },
    nofoul: { name: 'No fouls', hint: 'Hands back and feet set. Fewer fouls, softer defense', foul: 0.45, on: 1.12 },
    nothree: { name: 'No threes', hint: 'Stay attached to everyone behind the line', off3: true },
    wall: { name: 'Wall the rim', hint: 'Your five never leaves the lane', wall: true },
  };
  const DPLAYS = {}; for (const k in DBOOK) DPLAYS[k] = [DBOOK[k].name, DBOOK[k].hint];
  const NOPLAY = {};
  const CPUPLAYS = BOOK.filter(b => b.kind !== 'slow' && !b.slow && b.id !== 'iso' && b.id !== 'screen').map(b => b.id);
  const mkPlay = (id, left) => ({ id, kind: BOOK.find(b => b.id === id).kind, def: BOOK.find(b => b.id === id), left, done: false });
  const playOf = team => !G || G.drill ? null : team === 0 && G.play ? G.play : !G.half && G.cp && G.cp.team === team ? G.cp : null;
  const dplayOf = team => G && team === 0 && G.dplay && !G.drill ? DBOOK[G.dplay.kind] || NOPLAY : NOPLAY;
  const pFast = P => !!P && (P.kind === 'fast' || !!(P.def && P.def.fast));
  const pSlow = P => !!P && (P.kind === 'slow' || !!(P.def && P.def.slow));
  /* a team's scorer: the points on the board tonight, then the ratings */
  function star(team) { let best = null, bs = -1; for (const o of G.pl) if (o.team === team) { const s = (o.st ? o.st.pts : 0) * 2 + (o.r.three + o.r.close) / 20; if (s > bs) { bs = s; best = o; } } return best; }
  function bigOf(team, not) { let best = null; for (const o of G.pl) { if (o.team !== team || o === not || o.slot < 3) continue; if (!best || o.r.close > best.r.close) best = o; } return best; }
  /* who a play is for */
  function playWho(P, team, h) {
    const w = P.def ? P.def.who : undefined;
    if (typeof w === 'number') return G.pl.find(o => o.team === team && o.slot === w) || null;
    if (w === 'u') return team === 0 && G.user ? G.user : star(team);
    if (w === 'x') return star(team);
    if (w === 'b') return bigOf(team, null);
    if (P.kind === 'iso' || P.kind === 'screen') return team === 0 ? G.user : null;
    if (w === 's' || P.kind === 'shoot') { let best = null; for (const o of teamOf(team)) if (o !== h && (!best || o.r.three > best.r.three)) best = o; return best; }
    if (P.kind === 'hand') { let best = null, bd = 1e9; for (const o of teamOf(team)) if (o !== h && o.slot < 3) { const d = hyp(o.x - h.x, o.z - h.z); if (d < bd) { bd = d; best = o; } } return best; }
    return null;
  }
  /* who screens: the man the play names, or the big nearest the one it is for */
  function playScr(P, team, h, u) {
    const sl = P.def ? P.def.scr : undefined, at = u || h;
    let s = typeof sl === 'number' ? G.pl.find(o => o.team === team && o.slot === sl) : null;
    if (!s || s === h || s === u || s.isUser) s = teamOf(team).filter(o => o.slot >= 3 && o !== h && o !== u && !o.isUser).sort((a, c) => hyp(a.x - at.x, a.z - at.z) - hyp(c.x - at.x, c.z - at.z))[0];
    return s || null;
  }

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
      if (o.y > 0.5 || (o.pose === 'contest' && !(o.handOnly !== undefined && G.t - o.handOnly < 0.2))) f -= (o.isUser ? 0.13 : 0.06) * clamp((o.r.perD + o.r.block) / 160, 0.4, 1);   // (a hand you get up yourself bothers the shot twice as much)
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
      spot: 0, drive: 0, move: 0, moveCd: 0, reachT: 0, shoot: null, isUser: false,
      st: { pts: 0, reb: 0, oreb: 0, ast: 0, stl: 0, blk: 0, tov: 0, fga: 0, fgm: 0, tpa: 0, tpm: 0, fta: 0, ftm: 0, pf: 0, cs3: 0, mid: 0, lay: 0, dunk: 0, shake: 0, cmiss: 0, clutch: 0, fade: 0, hookm: 0 } };
  }
  const maxSpeed = p => (12 + p.r.speed * 0.078) * (G.ball.holder === p ? 0.9 : 1) * (p.isUser && G.tko && G.tko.on ? 1.05 : 1) * (p.energy !== undefined ? 0.82 + 0.18 * Math.min(1, p.energy * 2) : 1);
  const teamOf = t => G.pl.filter(p => p.team === t);

  /* ---------- HUD and feedback ---------- */
  function toast(txt, cls) {
    const t = $('#toast'); t.textContent = txt; t.className = 'on ' + (cls || ''); clearTimeout(toast.h);
    t.style.fontSize = (!cls || cls === 'make' || cls === 'blk') && txt.length > 11 ? (txt.length > 16 ? '22px' : '27px') : '';   // a long call stays on one line
    toast.h = setTimeout(() => t.classList.remove('on'), 1500);   // (its kind stays on while it fades: it used to snap back to the big letters on the way out)
  }
  /* your phone, in the corner of the screen: a name and a line, one at a time, a few seconds each. In the park one
     that points somewhere can be tapped: the arrow on the floor takes you there. */
  const noteQ = []; let noteBusy = false;
  function notify(who, text, o) {
    if (noteQ.length > 2) return; noteQ.push({ who, text, o: o || {}, g: G }); if (!noteBusy) noteNext();
  }
  function noteNext() {
    const n = noteQ.shift(); if (!n || n.g !== G || !G || G.phase === 'end') { noteBusy = false; noteQ.length = 0; const e0 = $('#notif'); if (e0) e0.classList.remove('on'); return; }
    noteBusy = true; let e = $('#notif');
    if (!e) { e = document.createElement('button'); e.id = 'notif'; $('#game').appendChild(e); }
    e.innerHTML = `<i></i><div><b></b><span></span>${n.o.go ? '<u>Tap: show me the way</u>' : ''}</div>`; e.querySelector('b').textContent = n.who; e.querySelector('span').textContent = n.text;
    e.classList.toggle('go', !!n.o.go);
    e.onclick = () => { if (n.o.go && G === n.g && G.park) { const st = PARK.find(x => x.id === n.o.go); if (st) { G.guideXZ = { x: st.x, z: st.z, id: st.id }; toast('Follow the arrow', 'call'); } } e.classList.remove('on'); };
    void e.offsetWidth; e.classList.add('on');
    clearTimeout(noteNext.h); noteNext.h = setTimeout(() => { e.classList.remove('on'); noteNext.h = setTimeout(noteNext, 700); }, n.o.go ? 5200 : 3800);
  }
  /* the timeline, live: people watching react to what you just did (not after every play) */
  const HANDLES = ['@hoopsdad_22', '@courtside_kay', '@bucketsonly', '@nightcapnation', '@section_214', '@midrange_mary', '@film_room_fred', '@ankle_tax', '@sixth_man_sam', '@nosebleed_nate', '@tipoff_tess', '@highlight_reel'];
  const REACT = {
    three: ['From DEEP', 'He is not missing tonight', 'Hand down, man down', 'Splash. Again.', 'Somebody guard him', 'That is a bad shot for anyone else', 'Logo range', 'String music', 'He pulled from the parking lot', 'Net never moved'],
    dunk: ['OH MY', 'He put him in the rim', 'Rim is still shaking', 'Clip that. Clip it now', 'Sheesh', 'Check the stanchion', 'He was up there a while', 'Somebody get the rim a doctor', 'Gravity took the night off', 'Two hands, no doubt'],
    Steal: ['Cookies!', 'Pick-pocket', 'Hands everywhere tonight', 'Took his lunch', 'Clean as it gets', 'He never saw him'], 'Picked it off': ['Read it the whole way', 'Free safety out there', 'Jumped the lane', 'He knew where that was going'],
    Block: ['Get that out of here', 'Not in his house', 'Sent it to row five', 'Return to sender', 'Wrong address', 'He timed that perfectly', 'Do not bring that in here'], 'Chase-down block': ['Chased him DOWN', 'Never give up on a play', 'Came from nowhere', 'Off the glass, from behind'],
    Assist: ['What a dime', 'He sees everything', 'Everybody eats', 'Eyes in the back of his head', 'On a platter', 'That pass had a bow on it'], 'Alley-oop': ['LOB CITY', 'Threw it to the moon', 'Up top, and down hard', 'Just throw it near the rim'],
    'Poster dunk': ['POSTER. Frame it', 'Somebody call his family', 'That man has a family'], 'Beat your man': ['Too quick', 'Left him standing there', 'He is still looking for him', 'That is a combo', 'Shook him out of his shoes'],
    pts: ['is cooking', 'has it going', 'cannot be stopped right now', 'is feeling it', 'is putting on a show', 'has the whole building watching', 'is in a different gear tonight'],
  };
  function social(kind, extra) {
    if (!G || G.drill || G.park || !G.user || G.auto || G.switching || G.phase === 'end') return;
    if (G.t - (G.noteAt || -99) < 9) return; const L = REACT[kind]; if (!L) return;
    G.noteAt = G.t; const u = G.user, line = L[Math.floor(rand() * L.length)];
    notify(HANDLES[Math.floor(rand() * HANDLES.length)], kind === 'pts' ? `#${u.num} ${line}: ${extra} points` : line, { quiet: true });
  }
  function feed(txt) {
    const f = $('#feed'); const e = document.createElement('div'); e.textContent = txt; f.prepend(e);
    while (f.children.length > 3) f.lastChild.remove();
    setTimeout(() => e.classList.add('old'), 3500);
  }
  const LETTERS = ['F', 'D-', 'D', 'D+', 'C-', 'C', 'C+', 'B-', 'B', 'B+', 'A-', 'A', 'A+'];
  const gradeLetter = s => LETTERS[clamp(Math.round(6 + s / 4), 0, 12)];
  /* somebody says something about what you just did: the coach, or a teammate by name. One short line under the call,
     now and then, never two on top of each other */
  const QUIP = {
    'Made three': ['Keep shooting', 'That is your shot', 'He cannot leave you', 'Automatic', 'Again. Same shot', 'They have to come out on you now', 'Let it fly all night'],
    Scored: ['Good bucket', 'Easy money', 'That is how you finish', 'Take that every time', 'Strong move', 'Nice touch', 'Keep going at him'],
    Assist: ['Great look', 'I owe you one', 'Good eyes', 'Keep finding me', 'That is the right play', 'Ball movement', 'You see the floor'],
    Steal: ['Great hands', 'Go, go, go', 'He never saw you', 'That is a pick six', 'Active hands'],
    'Picked it off': ['Read it the whole way', 'Jumped the lane', 'Great anticipation', 'Run with it'],
    Block: ['Not in here', 'Great timing', 'Send it back', 'He will think twice now', 'Protect the rim'],
    'Chase-down block': ['Never quit on a play', 'Where did you come from?', 'That is effort'],
    'Smothered the shot': ['Clamps', 'He had nothing', 'That is defense', 'Lock him up'],
    'Contested the shot': ['Good contest', 'Hand up every time', 'Make him work'],
    'Contested miss': ['Good contest', 'He felt you there', 'That is a stop'],
    'Poster dunk': ['Oh my', 'Put him on a poster', 'He will see that one tomorrow', 'Somebody check on him'],
    'Alley-oop': ['Up top', 'Lob city', 'Throw it anywhere near the rim'],
    'Beat your man': ['He cannot stay with you', 'Go at him again', 'Left him standing', 'Good move'],
    'Cut him off': ['Good feet', 'Wall him off', 'Stay in front'],
    'Pump fake': ['Got him in the air', 'He bites every time', 'Patience'],
    'Free throw': ['Knock them down', 'Free points'],
    'Lost the ball': ['Take care of it', 'Strong with the ball', 'Shake it off', 'Too loose'],
    'Lost it on the spin': ['Not in traffic', 'Keep it simple', 'They were waiting for that'],
    Intercepted: ['See the defender', 'Fake a pass to make a pass', 'Do not telegraph it'],
    'Your man scored': ['Stay with him', 'That is your man', 'Get a hand up', 'Move your feet'],
    'Left your man open': ['Find your man', 'Stay home', 'Do not lose him'],
    'Got crossed': ['Shake it off', 'Stay down, do not reach', 'Watch his hips'],
    'Got blocked': ['Go up strong', 'Use the pump fake', 'He was waiting on that'],
    'Tough shot early': ['Better shot than that', 'Work for a good one', 'We have time. Move it'],
    'Forced a bad shot': ['Better shot than that', 'Somebody was open', 'Not that one'],
    'Shooting foul': ['Hands straight up', 'Do not bail him out', 'Stay down on the fake'],
    Foul: ['Smart, not reckless', 'Watch the fouls', 'Move your feet, not your hands'],
    Charge: ['See the defender set', 'Under control', 'Pull up next time'],
    'Missed free throw': ['Take your time', 'Same routine every time'],
    'Beaten off the dribble': ['Stay in front', 'Give him a step', 'Slide, slide'],
    'Bit on a pump fake': ['Stay down', 'Feet on the floor', 'Make him shoot over you'],
    Goaltending: ['On the way up, not down', 'Let it come off'],
    Hot: ['Feed him', 'Get him the ball', 'Do not cool off now', 'He is feeling it'],
    Rebound: ['Good board', 'Go get it', 'Clean the glass', 'Now run'],
    'Offensive board': ['Second chance', 'Great effort', 'Go back up with it', 'Keep it alive'],
  };
  let quipT = -9;
  function quip(why, always) {
    const L = QUIP[why]; if (!L || !G || !G.user || G.drill || G.park || G.replay || G.t - quipT < 4.5 || (!always && rand() > 0.6)) return;
    let e = $('#quip'); if (!e) { e = document.createElement('div'); e.id = 'quip'; $('#toast').after(e); }
    quipT = G.t;
    const mates = G.pl.filter(p => p.team === G.user.team && !p.isUser), m = mates[Math.floor(rand() * mates.length)];
    const who = !m || rand() < 0.5 ? 'Coach' : m.name, line = L[Math.floor(rand() * L.length)];
    clearTimeout(quip.h); quip.h = setTimeout(() => { if (!G) return; e.innerHTML = `<b>${who}</b>${line}`; e.classList.remove('on'); void e.offsetWidth; e.classList.add('on'); clearTimeout(quip.h2); quip.h2 = setTimeout(() => e.classList.remove('on'), 2400); }, 650);
  }
  /* a comic word where it happened (only for what you did or what was done to you, so the floor is not covered in them) */
  const powAt = (word, p, size, dark, up) => { if (R.pow && p && !G.replay) R.pow(word, p.x, (p.ht || 78) / 12 * 0.62 + (p.y || 0) + (up || 0.6), p.z, size || 0.85, dark); };
  const pickOf = a => a[Math.floor(rand() * a.length)];
  function grade(delta, why) {
    if (!G.user || G.switching) return;
    quip(why);
    const before = gradeLetter(G.grade);
    G.grade = clamp(G.grade + delta, -26, 26);
    G.gradeLog.push([delta, why]);
    if (delta >= 1 && REACT[why] && rand() < 0.7) social(why);
    tkoAdd(delta > 0 ? delta * 0.05 : delta * 0.025);
    const g = $('#grade'); g.innerHTML = `<b>${gradeLetter(G.grade)}</b><span class="${delta >= 0 ? 'up' : 'dn'}">${delta >= 0 ? '+' : '−'} ${why}</span>`;
    g.classList.remove('flash'); void g.offsetWidth; g.classList.add('flash', 'why');
    if (before !== gradeLetter(G.grade)) g.classList.add('chg');
    /* the reason has the row to itself for a moment (it used to be squeezed to "+ Cut hi…" beside the stat line), then the stat line is back */
    clearTimeout(grade.t); grade.t = setTimeout(() => { g.classList.remove('why'); const sp = g.querySelector('span'); if (sp) sp.remove(); }, 2600);
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
    toast('Takeover', 'make'); powAt('HEAT!', G.user, 1.15, false, 1.8); if (R.burst && G.user) R.burst(G.user.x, 4, G.user.z, 8, 0.8); B('hot', { prio: 6 }); AU().crowd.react('roar', 1); R.flash(0xffffff); buzz([30, 50, 30]);
    tkoHud();
  }
  /* a celebration after a big play: a flex, a roar, the three goggles, a chest thump, a point to the crowd */
  function celebrate(p, kinds) { const sig = p.d && p.d.look && p.d.look.celeb; p.celebK = sig || kinds[Math.floor(rand() * kinds.length)]; p.celebT = p.celebK === 'chest' || p.celebK === 'roar' ? 1.4 : 1.2; }
  function tkoEnd(why) { const k = G.tko; if (!k) return; k.on = false; k.m = 0; if (why) toast(why); tkoHud(); }
  function tkoTick() { const k = G.tko; if (k && k.on) { if (G.t > k.until) tkoEnd(); else tkoHud(); } }
  /* ---------- first-game tips: shown once each, the first time the moment comes up ---------- */
  const TIPS = {
    ball: 'You have the ball. Hold SHOOT, let go at the top of the jump (green band). PASS finds the open man, or tap a teammate; swipe MOVE to break your man down.',
    def: 'Defense. Stay between your man and the rim. STEAL when the button lights up. JUMP as he shoots.',
    mate: 'A teammate has it. CALL asks for the ball, CUT runs you to the rim.',
    ft: 'Free throw: hold SHOOT and let go in the green band.',
    pick: 'PICK brings your big over to screen your man. Pause (top left) to call a play from the playbook, three trips each.',
    fake: 'A man right on you? Tap SHOOT quickly: a pump fake. If he jumps at it, go by him or shoot when he lands.',
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
    const on = !(PB.settings && PB.settings.radar === false) && (!G.drill || G.park);
    setHidden(cv, !on); if (!on) return;
    /* in the park it is the park's map: the wall of doors, the rings, the regulars, and you */
    if (G.park) {
      const g = cv.getContext('2d'), W = cv.width, Hh = cv.height, sx = x => W / 2 - x / 76 * W, sz = z => Hh / 2 - z / 128 * Hh;
      g.clearRect(0, 0, W, Hh); g.fillStyle = 'rgba(8,11,18,.78)'; g.fillRect(0, 0, W, Hh);
      g.strokeStyle = 'rgba(255,255,255,.3)'; g.lineWidth = 1; g.strokeRect(sx(25), sz(47), sx(-25) - sx(25), sz(-47) - sz(47));
      g.fillStyle = 'rgba(255,255,255,.55)'; g.fillRect(sx(36.5), sz(62), 3, sz(-62) - sz(62));
      for (const s0 of PARK) { g.fillStyle = s0.color; g.globalAlpha = s0.id === G.parkAt ? 1 : 0.75; g.beginPath(); g.arc(sx(s0.x), sz(s0.z), 2.3, 0, 7); g.fill(); }
      g.globalAlpha = 1; g.fillStyle = 'rgba(255,255,255,.45)';
      for (const p of G.pl) if (p.npc) { g.beginPath(); g.arc(sx(p.x), sz(p.z), 1.6, 0, 7); g.fill(); }
      const u = G.user; if (u) { const x = sx(u.x), z = sz(u.z); g.fillStyle = '#4cffb0'; g.beginPath(); g.arc(x, z, 3.2, 0, 7); g.fill();
        g.strokeStyle = '#4cffb0'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(x, z); g.lineTo(x - Math.sin(u.face) * 6, z - Math.cos(u.face) * 6); g.stroke(); }
      return;
    }
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
  // The HUD is checked every frame. Only replace a label or attribute when it changes.
  function setLabel(element, text) {
    if (element.textContent !== text) element.textContent = text;
  }
  function setHidden(element, hidden) {
    if (element.hidden !== hidden) element.hidden = hidden;
  }
  function hud() {
    highCheck(); radar();
    $('#game').classList.toggle('drill', !!(G && G.drill));
    $('#game').classList.toggle('dunk', !!(G && G.drill && (G.drill.kind === 'dunk' || G.drill.kind === 'free' || G.drill.kind === 'horse')));
    $('#game').classList.toggle('lefty', !!(PB.settings && PB.settings.hand === 'Left-handed'));
    $('#game').classList.toggle('bigbtn', !!(PB.settings && PB.settings.btnSize === 'Large'));
    const en = $('#energy'); setHidden(en, !G.user || G.user.energy === undefined);
    if (!en.hidden) { en.firstChild.style.width = `${Math.round(G.user.energy * 100)}%`; en.classList.toggle('low', G.user.energy < 0.3); }
    const fmt = s => s >= 60 ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : s.toFixed(1);
    for (const i of [0, 1]) { const e = $('#s' + i); if (e.textContent !== String(G.score[i])) { e.textContent = G.score[i]; e.classList.remove('pop'); void e.offsetWidth; e.classList.add('pop'); } }
    const period = G.half ? (G.ones ? '1s & 2s' : 'Blacktop')
      : G.q <= 4 ? ['1st', '2nd', '3rd', '4th'][G.q - 1] : (G.q === 5 ? 'OT' : `${G.q - 4}OT`);
    setLabel($('#qt'), period);
    setLabel($('#clk'), G.half ? `To ${G.target}` : fmt(Math.max(0, G.clock)));
    const sc = $('#sc'); setLabel(sc, String(Math.ceil(Math.max(0, G.shotClock)))); sc.classList.toggle('low', G.shotClock < 5);
    sc.style.visibility = G.phase === 'live' && G.poss !== null ? 'visible' : 'hidden';
    $('#sd0').classList.toggle('poss', G.poss === 0); $('#sd1').classList.toggle('poss', G.poss === 1);
    { const e = $('#line'), st = G.user && !G.drill && !G.switching && G.user.st, v = st ? `<b>${st.pts}</b> PTS <b>${st.reb}</b> REB <b>${st.ast}</b> AST` : ''; if (e && e._v !== v) { e._v = v; e.innerHTML = v; } }   // your line, live
    if (G.to && $('#t0')) for (const i of [0, 1]) { const e = $('#t' + i), v = '•'.repeat(Math.max(0, G.to[i])); if (e.textContent !== v) e.textContent = v; }
    /* in the bonus: the other side has five fouls this quarter, every foul now is two shots */
    if (G.tf) { $('#sd0').classList.toggle('bonus', G.tf[1] >= 5); $('#sd1').classList.toggle('bonus', G.tf[0] >= 5); }
    /* the buttons read what they do right now */
    const u = G.user; if (!u) return;
    const off = G.poss === 0 || (G.poss === null && G.ball.holder && G.ball.holder.team === 0);
    const has = G.ball.holder === u;
    const ft = G.phase === 'ft' && G.ftq && G.ftq.shooter === u;
    { const ct = !G.drill && clutchTime(); document.querySelector('.bug').classList.toggle('clutch', ct); if (ct && !G.clutchSaid) { G.clutchSaid = true; toast('Clutch time', 'call'); }
      const mt = $('#meter'); if (mt) mt.classList.toggle('away', !!(ft && u && !home(u.team))); }   // the last two minutes of a close game; a road crowd behind the basket at the line
    if (G.phase === 'live' && G.t > 2) { if (has) tip('ball'); else if (!off && G.ball.holder) tip('def'); else if (off && G.ball.holder) tip('mate'); }
    if (ft) tip('ft');
    const dunk = G.drill && G.drill.kind === 'dunk';
    const shoot = ft || has || G.drill;
    const a = $('#bA'), buttonClass = shoot ? 'btn a shoot' : 'btn a jump';
    setLabel(a, dunk ? 'Dunk' : shoot ? 'Shoot' : 'Jump');
    if (a.className !== buttonClass) a.className = buttonClass;
    const b = $('#bB');
    setLabel(b, has ? 'Pass' : off ? 'Call' : 'Steal');
    b.classList.toggle('lit', !has && (off ? G.callT > 0 : G.phase === 'live' && exposed(u, G.ball.holder) > 0));
    setLabel($('#bC'), dunk ? 'Style' : has ? 'Move' : off ? 'Cut' : G.switching ? 'Switch' : 'Help');
    const pk = has && !u.inb && !G.drill && G.phase === 'live' && along(u.z, u.team) < RIM;
    $('#bD').classList.toggle('on', pk);
    if (pk && G.t > 12 && seenTips && seenTips.ball && $('#tipcard').hidden) tip('pick');   // after the ball tip has had its moment
    if (has && G.t > 30 && seenTips && seenTips.ball && $('#tipcard').hidden && !G.user.shoot && nearestDef(G.user).d < 3.6 && distHoop(G.user.x, G.user.z, G.user.team) > 12) tip('fake');
  }
  /* call for a pick: the nearest big comes to set a screen on your man, then rolls to the rim */
  function pressD() {
    const u = G.user; if (!u || G.phase !== 'live' || G.ball.holder !== u || u.inb || G.drill) return;
    if (G.t < (G.pickCd || 0)) return;
    const bigs = teamOf(u.team).filter(o => o !== u && o.slot >= 3).sort((a, b) => hyp(a.x - u.x, a.z - u.z) - hyp(b.x - u.x, b.z - u.z));
    const s = bigs[0] || teamOf(u.team).filter(o => o !== u)[0]; if (!s) return;
    s.screen = 3.2; s.screenFor = u; s.pickUntil = G.t + 3.2; G.pickCd = G.t + 4;
    toast('Pick called', 'call'); buzz(8);
  }

  /* ---------- ball helpers ---------- */
  function give(p, why) {
    const b = G.ball;
    const changed = G.poss !== p.team;
    if (G.half) { if (G.hadBall !== undefined && G.hadBall !== p.team && !G.checking && G.phase === 'live') { G.clr = p.team; if (p.isUser || (G.user && G.user.team === p.team)) toast('Take it back past the arc', 'call'); } G.hadBall = p.team; }
    if (G.inb) { G.inb.p.inb = false; G.inb = null; }
    b.state = 'held'; b.holder = p; p.hold = 0; p.think = 0.2 + rand() * 0.2; delete p.post;
    p.dph = Math.PI / 2; b.bk = 0; b.pushCycle = null;
    p.dribX = p.x; p.dribZ = p.z; p.dribVX = p.dribVZ = p.brakeD = 0;
    b.lastTouch = p.team;
    if (changed) { G.poss = p.team; G.shotClock = 24; G.callT = 0; G.possN = (G.possN || 0) + 1;
      if (G.phase === 'live' && !p.inb) G.transT = G.t;   // a live-ball change of hands (a steal, a board): the break is on
      if (G.play && p.team === 0) { G.play.left--; G.play.done = false; G.play.near = 0; if (G.play.left < 0) { G.play = null; } }
      if (G.dplay && p.team === 1) { G.dplay.left--; if (G.dplay.left < 0) G.dplay = null; }
      /* nobody called one: the bench does, about every other trip */
      G.cp = null;
      if (!G.drill && !G.half && !G.park && !(p.team === 0 && G.play) && rand() < 0.5) { const k = CPUPLAYS[Math.floor(rand() * CPUPLAYS.length)]; G.cp = mkPlay(k, 0); G.cp.team = p.team;
        if (p.team === 0 && G.user && !G.auto && rand() < 0.5) feed(`Coach calls ${PLAYS[k][0].toLowerCase()}`); } }
    if (why === 'oreb') G.shotClock = Math.max(G.shotClock, 14);
  }
  /* the blacktop: the ball checked at the top of the key. The offense walks out to its spots above the arc and the defense
     picks its men up (on foot: a cut only if someone is still far off when the check comes) */
  function checkBall(t) {
    if (!G || G.phase === 'end') return;
    G.checking = true; G.clr = null; G.phase = 'check'; G.checkT = 2.6; G.poss = t; G.inb = null; G.ftq = null; G.shotClock = G.scLen || 24;
    const h = teamOf(t).find(o => o.isUser && !G.auto) || teamOf(t).sort((a, c) => a.slot - c.slot)[0];
    give(h); G.checking = false; G.hadBall = t;
    for (const p of G.pl) { p.shoot = null; p.drive = 0; p.pose = ''; delete p.post; p.cutT = 0; p.move = 0;
      const own = p.team === t, sp = SPOTS[p.slot][0];
      if (own) { const c = p === h ? toCourt(t, 0, 27) : toCourt(t, sp[0] * 1.05, Math.max(sp[1], p.slot === 4 ? 8 : 20)); p.ckx = c.x; p.ckz = c.z; }
    }
    for (const p of G.pl) if (p.team !== t) { const m = G.pl.find(o => o.team === t && o.slot === p.slot) || h, rz = hoopZ(t), dx = 0 - m.ckx, dz = rz - m.ckz, L = hyp(dx, dz) || 1; p.ckx = m.ckx + dx / L * 3.4; p.ckz = m.ckz + dz / L * 3.4; }
  }
  function checkStep(dt) {
    G.checkT -= dt; let far = 0;
    for (const p of G.pl) { const d = hyp(p.ckx - p.x, p.ckz - p.z); if (d > 1.2) far = Math.max(far, d); }
    if (far < 1.2 || G.checkT <= 0) {
      if (far > 4) { cut(); for (const p of G.pl) { p.x = p.ckx; p.z = p.ckz; } }
      for (const p of G.pl) { p.vx = p.vz = 0; p.face = Math.atan2(0 - p.x, hoopZ(G.poss) - p.z); }
      G.phase = 'live'; AU().play('bounce', { vol: 0.5 });
      if (!G.ckSaid) { G.ckSaid = true; toast('Check', 'call'); }
    }
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
    if (G.half) { checkBall(team); return; }
    const mates = teamOf(team), pool = mates.filter(o => !o.isUser || G.switching);
    let best = null, bd = 1e9;
    for (const p of (pool.length ? pool : mates)) { const d = hyp(p.x - at.x, p.z - at.z); if (d < bd) { bd = d; best = p; } }
    const sz = Math.sign(at.z) || 1;
    /* he goes out there on his feet: the ball in his hands, a jog to the line (he used to be there all at once) */
    let wx, wz;
    if (baseline || Math.abs(at.z) > 43) { wx = clamp(at.x, -12, 12) || (rand() < 0.5 ? -5 : 5); wz = sz * 48.2; }
    else { const sx = Math.sign(at.x) || (rand() < 0.5 ? -1 : 1); wx = sx * 26.4; wz = clamp(at.z, -42, 42); }
    best.vx = best.vz = 0; best.shoot = null; best.drive = 0;
    give(best);
    G.ball.passer = null;
    /* after a basket the game clock keeps running, except in the last two minutes of the fourth and overtime */
    const stop = !baseline || (G.q >= 4 && G.clock < 120);
    best.inb = true; G.inb = { p: best, t: 0, wait: rr(0.7, 1.25) * (stop ? 1 : 0.7), stop, walk: { x: wx, z: wz, t: 0 } };
  }
  function inboundStep(dt) {
    const I = G.inb, p = I.p;
    if (G.ball.holder !== p) { p.inb = false; p.inbW = false; G.inb = null; return; }
    if (I.walk) { const W = I.walk, dx = W.x - p.x, dz = W.z - p.z, d = hyp(dx, dz); W.t += dt;
      if (d > 0.6 && W.t < 3.2) { const sp = Math.min(17, 5 + d * 3); p.vx = dx / d * sp; p.vz = dz / d * sp; p.face = Math.atan2(dx, dz); p.pose = 'hold'; p.inbW = true; return; }
      I.walk = null; p.inbW = false; p.vx = p.vz = 0; }
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
    if (R.refSignal) R.refSignal('sigp', 1.3);   // whose ball: an arm out
    if (p && rand() < 0.4) { const m = G.pl.find(o => o.team === p.team && o !== p && !o.isUser); if (m) setTimeout(() => CH('ch_back', m), 500); }
    if (p) { p.st.tov++; if (p === G.user) grade(-3, why); }
    feed(`${why}${p ? ' · ' + p.name : ''}`);
    G.poss = null;
    const spot = at || { x: G.ball.x, z: G.ball.z };
    dead(0.9, () => inboundOut(giveTo, { x: clamp(spot.x, -24, 24), z: clamp(spot.z, -46, 46) }));
  }
  /* a cut, the way a broadcast goes to another camera: the picture dips to black for a moment. Used whenever players
     have to be somewhere else at once (lining up for a free throw, a substitution, the start of a period, your
     check-in), so nobody is seen jumping from one place to another. */
  function cut() {
    if (!G || G.cutT === G.t) return; G.cutT = G.t;
    let e = document.getElementById('cut');
    if (!e) { e = document.createElement('div'); e.id = 'cut'; e.style.cssText = 'position:absolute;inset:0;background:#000;opacity:0;pointer-events:none;z-index:0'; const cv = $('#gl'); cv.parentNode.insertBefore(e, cv.nextSibling); }
    e.style.transition = 'none'; e.style.opacity = '1'; void e.offsetWidth;
    clearTimeout(cut.h); cut.h = setTimeout(() => { e.style.transition = 'opacity .3s ease-out'; e.style.opacity = '0'; }, 170);
  }
  /* a timeout: the camera drifts in low over the floor */
  function timeoutCine(tc, why) {
    if (!R.cine || G.drill) { toast(why ? 'Timeout: ' + why.toLowerCase() : 'Timeout', 'call'); return; }
    const sd = rand() < 0.5 ? 1 : -1; G.deadT = Math.max(G.deadT || 0, 2.6); if (R.refSignal) R.refSignal('sigt', 3);
    /* both fives walk to their benches and stand round the coach (the cut covers the walk); the camera goes to the
       huddle of the side that called it */
    if (!G.half && !G.park) { cut(); const g0 = G, was = G.pl.map(p => [p, p.x, p.z, p.face]); let back = () => { back = () => {}; if (G !== g0) return; cut(); for (const [p, x, z, f] of was) { p.x = x; p.z = z; p.face = f; p.vx = p.vz = 0; p.y = 0; p.vy = 0; } };   // and are back where they stood when it ends
      for (const t of [0, 1]) { const zc = (t === 0 ? -1 : 1) * 19; teamOf(t).forEach((p, i, a) => { const an = (i - (a.length - 1) / 2) * 0.8; p.x = 22.2 - Math.cos(an) * 3.6; p.z = zc + Math.sin(an) * 3.6; p.vx = p.vz = 0; p.y = 0; p.vy = 0; p.hangT = 0; p.shoot = null; p.pose = ''; p.face = Math.atan2(25.5 - p.x, zc - p.z); }); }
      const zc = (tc === 0 ? -1 : 1) * 19, s0 = tc === 0 ? 1 : -1;
      cine([{ focus: { x: 21.6, z: zc }, a: [-Math.PI / 2 + s0 * 0.75, -Math.PI / 2 + s0 * 0.2], r: [27, 20], h: [12, 8.5], ly: 4, dur: 2.4 }], 'Timeout', why || G.teams[tc].name, { skip: () => back(), done: () => back() }); return; }
    cine([{ a: [sd * 0.5, sd * 0.15], r: [40, 30], h: [16, 9], ly: 4, dur: 2.4 }], 'Timeout', why || G.teams[tc].name);
  }
  /* a cut scene: the camera leaves the play for a few moves of its own, black bars top and bottom, a line of type.
     A tap skips it. (In the park there are no bars and the controls stay: walking off ends it.) */
  let parkCine = false;
  function cine(shots, kick, title, o) {
    if (!R.cine) return; o = o || {};
    const el = $('#game'); let e = $('#cine');
    if (!e) { e = document.createElement('div'); e.id = 'cine'; e.innerHTML = '<i></i><i></i><p><small></small><b></b></p>'; el.appendChild(e); }
    e.querySelector('small').textContent = kick || ''; e.querySelector('b').textContent = title || '';
    e.onclick = () => { if (o.skip) o.skip(); R.cine(null); };
    el.classList.remove('cine', 'cinepark'); void e.offsetWidth; el.classList.add(o.park ? 'cinepark' : 'cine');
    const g = G; R.cine(shots, () => { el.classList.remove('cine', 'cinepark'); if (G === g && o.done) o.done(); });
  }
  function dead(t, then) { G.phase = 'dead'; G.deadT = t <= 1.5 ? t * 0.8 : t; G.then = then; subs();
    /* a coach stops a run: a timeout called from the bench (yours or theirs). Legs come back, and the run is over */
    if (G.coachTO !== undefined && !G.ftq && G.q <= 4) { const tc = G.coachTO; G.coachTO = undefined;
      if (G.to[tc] > 0) { G.to[tc]--; G.deadT = Math.max(t, 3.4); G.run = null;
        for (const p of G.pl) { if (p.energy !== undefined) p.energy = Math.min(1, p.energy + 0.35); }
        AU().play('whistle'); timeoutCine(tc, tc === 0 && G.user ? 'Your coach stops the run' : null); feed(`Timeout · ${G.teams[tc].name}`);
        B('timeout', { prio: 3, follow: 0.4 }); if (AU().organ) setTimeout(() => AU().organ('walk'), 800); } }
    if (stintOver() && !G.ftq) G.then = () => sitDown(); }
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
        /* he checks in at the scorer's table and runs on (he used to appear where the other man stood) */
        cut();
        if (G.phase !== 'live') { p.x = 24.4; p.z = clamp(p.z * 0.3, -9, 9) + n * 2.6 + (t ? 1.3 : -1.3); p.vx = p.vz = 0; p.face = -Math.PI / 2; }   // (two at once stand side by side)
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
    if (H && p.shoot && p.shoot.kind === 'dunk') { const h = H.r.y > H.l.y ? H.r : H.l; return { x: h.x, y: h.y + 0.25, z: h.z }; }   // a dunk: the ball rides in the hand that is up
    if (H && p.shoot && p.shoot.gather) {
      // As the guide hand comes away, carry the ball out on the shooting fingertips.
      const phase = p.shoot.t / (p.shoot.T * 0.82);
      const t = clamp((phase - 0.72) / 0.28, 0, 1);
      const guide = 0.5 * (1 - t * t * (3 - 2 * t));
      return { x: H.r.x + (H.l.x - H.r.x) * guide, y: Math.max(H.r.y, H.l.y) + 0.35,
        z: H.r.z + (H.l.z - H.r.z) * guide };
    }
    if (H) return p.shoot || p.pose === 'shoot' ? { x: (H.r.x + H.l.x) / 2, y: Math.max(H.r.y, H.l.y) + 0.35, z: (H.r.z + H.l.z) / 2 } : p.dribHand < 0 ? { x: H.l.x, y: H.l.y, z: H.l.z } : { x: H.r.x, y: H.r.y, z: H.r.z };
    const fx = Math.sin(p.face), fz = Math.cos(p.face);
    return { x: p.x + fx * 0.6 + fz * 0.5, y: p.ht / 12 * 0.95 + p.y + 1.5, z: p.z + fz * 0.6 - fx * 0.5 };
  }

  /* ---------- shooting ---------- */
  function startShot(p, forUser, force) {
    if (p.shoot || G.ball.holder !== p) return;
    if (p.y > 0.05) return;   // still coming down with a rebound: a shot from here was a second jump off thin air
    const d = distHoop(p.x, p.z, p.team);
    const sp = hyp(p.vx, p.vz);
    let kind = 'jumper';
    if (G.drill && G.drill.kind === 'dunk') return dunkJump(p, d);
    if (d < 9) {
      /* a leaper takes off from further out; yours goes up to dunk whenever he has a run at the rim */
      const dunkOk = p.r.dunk >= 55 && d < 7.5 + clamp(((p.r.vert || 70) - 70) * 0.05, 0, 1.4) && (sp > 5 || p.ht >= 82) && rand() < 0.35 + (p.r.dunk - 55) / 60 + 0.12 * bt(p, 'poster') + (forUser && sp > 5 ? 0.3 : 0);
      kind = dunkOk ? 'dunk' : 'layup';
      /* yours: at the rim, Shoot is a dunk every time (standing under it too), not a roll of the dice. Only a player with
         next to no dunking in him (under 35) lays it in */
      if (forUser && !(G.drill && G.drill.kind !== 'free') && (p.r.dunk || 0) >= 35 && d < (sp > 5 ? 7.5 + clamp(((p.r.vert || 70) - 70) * 0.05, 0, 1.4) : 5.5)) kind = 'dunk';
    } else if (d < 13 && sp > 7 && !isThree(p.x, p.z, p.team)) kind = 'floater';   // a runner on the move: lofted over the bigs
    if (force) kind = force;
    /* yours: a big who goes up contested in the paint shoots a hook; a jumper drifting away from the rim is a fadeaway */
    let fade = false;
    if (forUser && !force) {
      if (kind !== 'dunk' && ['PF', 'C'].includes(p.d.pos) && d > 4 && d < 15 && (nearestDef(p).d < 4 || p.postUp > 0)) kind = 'hook';
      /* the stick pulled away from the rim as you go up is a fadeaway, even from a standstill; out of a post-up it is
         the turnaround instead of the hook */
      const hx = 0 - p.x, hz = hoopZ(p.team) - p.z, L = hyp(hx, hz) || 1, w = stickWorld(), pull = w && w.m > 0.45 && (w.x * hx + w.z * hz) / L < -0.55;
      if (p.postUp > 0) { p.postUp = 0; if (pull && d > 5 && d < 20 && kind !== 'dunk') { kind = 'jumper'; fade = 'turn'; } else p.postHookT = G.t; }
      else if (kind === 'jumper' && d > 6 && d < 23.5 && (pull || (p.vx * hx + p.vz * hz) / L < -3.5)) fade = true;
    }
    /* the league's shot-makers fade too, with a hand in their face */
    else if (!forUser && !force && !G.drill && kind === 'jumper' && d > 8 && d < 21 && p.y === 0 && (p.r.mid >= 62 || bt(p, 'fade') > 0) && nearestDef(p).d < 5.5 && rand() < 0.55) fade = true;
    const js = kind === 'jumper' && p.d.look ? p.d.look.jumper : null;   // your jump shot: quick or high
    const T = (kind === 'jumper' ? 0.82 - p.r.mid * 0.0012 : kind === 'dunk' ? 0.58 : kind === 'floater' || kind === 'hook' ? 0.5 : 0.55) * (js === 'quick' ? 0.84 : js === 'high' ? 1.1 : 1);
    const peak = kind === 'jumper' ? 1.4 + p.r.vert * 0.014 : kind === 'dunk' ? 3.0 + p.r.vert * 0.022 + Math.max(0, (p.r.dunk || 55) - 55) * 0.008 : 1.8 + p.r.vert * 0.012;
    // A moving jumper uses the first beat of the meter to plant before rising to the same release point.
    const gather = kind === 'jumper' && !fade && p.y === 0 ? T * 0.21 * clamp((sp - 4) / 5, 0, 1) : 0;
    const tp = T * 0.82 - gather;
    p.jg = 2 * peak / (tp * tp); p.vy = p.jg * tp;
    if (js === 'high') p.highT = G.t;
    p.shoot = { t: 0, T, kind, gather, user: !!forUser, three: isThree(p.x, p.z, p.team), d, fade, js,
      /* AI: when it lets go (near the top, a little early or late) */
      aiRel: clamp(0.82 + PB.gauss() * (0.09 - p.r.mid * 0.0006), 0.55, 1.1) };
    if (gather) p.shoot.pickup = { x: G.ball.x - p.x, y: G.ball.y, z: G.ball.z - p.z };
    p.pose = kind === 'dunk' ? ((p.d.look && p.d.look.dunk) || (rand() < 0.55 ? 'dunk1' : 'dunk2')) : 'shoot';
    if (p.pose === 'windmill') { p.spin = { total: 0, t: 0, T: 2 * T * 0.82 }; p.spinA = 0; }
    /* a breakaway with nobody near: a flier shows off (a windmill, a reverse, a 360) */
    p.showoff = null;
    if (kind === 'dunk' && nearestDef(p).d > 8 && (p.r.dunk || 0) + (p.r.vert || 0) >= 140 && rand() < 0.6) {
      const st = STYLES[1 + Math.floor(rand() * 4)];
      p.pose = st[1]; p.spin = { total: st[4], t: 0, T: 2 * T * 0.82 }; p.spinA = 0; p.showoff = st[0];
    }
    if (kind === 'jumper' && !fade) { p.vx *= 0.2; p.vz *= 0.2; }
    /* a fadeaway hops back off the floor, away from the rim (and a little away from the hand in his face) */
    if (fade) { p.fadeT = G.t; const hx = 0 - p.x, hz = hoopZ(p.team) - p.z, L = hyp(hx, hz) || 1, back = clamp(-(p.vx * hx + p.vz * hz) / L * 0.5, 3.4, 4.8);
      p.vx = -hx / L * back + p.vx * 0.15; p.vz = -hz / L * back + p.vz * 0.15; p.fadeV = { x: p.vx, z: p.vz };
      if (forUser) toast(fade === 'turn' ? 'Turnaround' : 'Fadeaway', 'call'); }
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
    if (G.drill || G.half || t === null || t === undefined || (b.state !== 'held' && b.state !== 'pass')) { if (G.user) G.user.lane = 0; return false; }
    const V = G.vio && G.vio.n === G.possN ? G.vio : (G.vio = { n: G.possN, crossed: false, start: G.shotClock });
    const h = b.state === 'held' ? b.holder : null;
    const a = h ? along(h.z, t) : along(b.z, t);   // the holder, not the ball: the ball is still where it was the moment he gets it
    if (!V.crossed && a < HALF - 0.5 && (!h || h.team === t)) V.crossed = true;
    /* you have it in the backcourt and the count is half gone: say so once a trip */
    if (!V.crossed && h && h.isUser && !G.auto && !V.told && V.start - G.shotClock > 4) { V.told = true; toast('Get it over half court', 'call'); }
    /* still standing there with six of the eight seconds gone and no hand on the stick: you give it to the nearest
       teammate, who brings it up (someone learning the controls is not whistled every trip; a player who is moving
       keeps the ball and the count) */
    if (!V.crossed && h && h.isUser && !G.auto && !G.switching && !V.bail && V.start - G.shotClock > 6 && !stickWorld() && !h.shoot && G.phase === 'live' && !(G.q >= 4 && G.clock < 45 && G.score[h.team] > G.score[1 - h.team])) {   // (not while you are ahead late and running the clock down on purpose)
      const r = teamOf(h.team).filter(o => o !== h && !o.inb).sort((a, c) => hyp(a.x - h.x, a.z - h.z) - hyp(c.x - h.x, c.z - h.z))[0];
      if (r) { V.bail = true; passTo(h, r); toast(`To ${r.name}`, ''); }
    }
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
    if (s.gather) p.pullFollowUntil = G.t + 0.32;
    p.shoot = null;
    G.possN = (G.possN || 0) + 1;   // a shot ends team control: a long rebound may be taken in the backcourt
    const b = G.ball;
    const hp = b.state === 'held' && b.holder === p && p.pose !== 'windmill' ? { x: b.x, y: b.y, z: b.z } : handPos(p);   // from where the ball is: up and in front (ballStep keeps it there)
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
      showRelease(timing, meter, w); buzz(timing === 'Excellent' ? [12, 40, 12] : 10); G.greenShot = timing === 'Excellent';   // a perfect release leaves a green trail
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
    /* one of your hot zones: a spot you have shot well from all season is a spot you shoot a little better from */
    const hotZ = !!(s.user && !s.ft && opts.hot && PB.zoneOf && opts.hot.includes(PB.zoneOf(p.x, along(p.z, p.team))));
    if (hotZ) prob = clamp(prob * 1.06 + 0.01, 0.01, 0.985);
    if (p.isUser && tkoOn()) prob = clamp(prob + (1 - prob) * 0.2, 0.01, 0.985);   // Takeover: hot hands
    if (timing === 'Excellent') prob = 1;   // a perfect release goes in: only a block stops it
    const nd = nearestDef(p);
    if (R.pow && !s.ft && s.kind !== 'dunk' && nd.who && nd.d < 4.2 && (nd.who.y > 0.3 || nd.who.pose === 'contest')) R.pow('', (p.x + nd.who.x) / 2, (p.ht || 78) / 12 + p.y + 1.4, (p.z + nd.who.z) / 2, nd.d < 2.4 ? 0.62 : 0.42);   // a hand in it
    /* how covered you were, next to the timing: a miss explains itself */
    if (s.user && timing) { const cov = nd.d > 6 ? 'Wide open' : nd.d > 3.5 ? 'Open' : nd.d > 2 ? 'Contested' : 'Smothered'; $('#rel').textContent = `${timing === 'Excellent' ? 'Perfect' : timing} · ${cov}${s.fade ? ' · Fadeaway' : s.kind === 'hook' ? ' · Hook' : ''}${hotZ ? ' · Hot zone' : ''}`; }
    /* your defense on the shot, said out loud: it is how you learn what a good contest is */
    { const u = G.user;
      if (u && p.team !== u.team && !G.drill && s.kind !== 'dunk' && !s.oop && (nd.who === u || u.slot === p.slot)) {
        const du = hyp(u.x - p.x, u.z - p.z), up = u.y > 0.3 || u.pose === 'contest';
        if (du < 2.4 && up) { toast(pickOf(['Smothered', 'Clamped', 'Nothing there']), 'make'); powAt('CLAMPS!', G.user, 0.95, false, 1.5); grade(1.5, 'Smothered the shot'); }
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
      const ch = (o.r.block / 99) * (s.kind === 'jumper' ? 0.05 : s.kind === 'dunk' ? 0.07 : 0.33) * (1 - d / 4.5) * (o.ht >= p.ht ? 1.15 : 0.8) * (o.isUser ? (s.kind === 'jumper' ? 2.2 : 1.2) + 0.9 * clamp(o.y / 2.2, 0, 1) : 1) * (1 + 0.2 * bt(o, 'rim'));   // yours is a matter of timing: up near the top of the jump as he lets it go
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
    if (s.kind === 'dunk') p.dunkRel = G.t;   // the arm comes down through the rim from here
    if (made && s.kind === 'dunk' && !G.drill && rand() < 0.75) p.hangPlan = true;
    const pts = G.half && G.ones ? (s.three ? 2 : 1) : s.three ? 3 : 2;   // (the blacktop can be played by ones and twos)
    b.state = 'shot'; b.holder = null; b.lastTouch = p.team;
    b.sx = hp.x; b.sy = hp.y; b.sz = hp.z; b.t = 0;
    /* a shot for the tie or the lead in the last seconds hangs in the air: time slows until it comes down */
    { const lead = G.score[p.team] - G.score[1 - p.team]; G.slowT = !G.drill && !s.ft && s.kind !== 'dunk' && G.q >= 4 && G.clock < 4 && lead <= 0 && lead >= -pts ? 1 : 0; }
    const rz = hoopZ(p.team);
    if (made) { b.ex = 0; b.ez = rz; b.ey = 10.3; }
    else { const a = rand() * 6.28, m = rr(0.55, 1.0); b.ex = Math.sin(a) * m; b.ez = rz + Math.cos(a) * m - dirOf(p.team) * 0.2; b.ey = 10.1; }
    const d = s.d;
    b.dur = s.kind === 'dunk' ? 0.22 : 0.42 + d * 0.026;
    b.apex = s.kind === 'dunk' ? 0.2 : s.kind === 'layup' ? 2 : s.kind === 'floater' || s.kind === 'hook' ? 5.5 : 3.5 + d * 0.2;
    G.shotLog[G.shotLog.length - 1].made = made;
    b.shot = { oop: !!s.oop, shooter: p, made, pts, three: !!s.three, foul, kind: s.kind, timing, prob, d: s.d, style: s.style, fade: !!s.fade, caught: p.caughtT !== undefined && G.t - p.caughtT < 1.5 };
    if (foul) { foul.st.pf++; foul.celebK = 'call'; foul.celebT = 1.5; G.tf[foul.team]++; if (foul.isUser) grade(-1, 'Shooting foul'); AU().play('whistle'); if (R.refSignal) R.refSignal('sigf', 1.4); checkFoulOut(foul); }
  }

  function blockShot(o, p, at) {
    const b = G.ball;
    if (o.isUser) reelMark('block', 2.6, 'Block');
    o.st.blk++; if (o.isUser) { grade(3, 'Block'); buzz(30); badgePop(o, 'rim'); }
    if (!G.drill && !G.replay) G.hitT = 0.13;
    if (p.isUser) grade(-1, 'Got blocked');
    /* from behind at a run: the chase-down */
    { const hx = 0 - p.x, hz = hoopZ(p.team) - p.z, hl = hyp(hx, hz) || 1, behind = ((o.x - p.x) * hx + (o.z - p.z) * hz) / hl < -0.6, chase = behind && hyp(o.vx, o.vz) > 9;
      if (R.pow) { R.pow(chase ? 'SWAT!' : pickOf(['BLOCK!', 'NOPE!', 'DENIED!', 'GET OUT!']), at.x, at.y + 0.9, at.z, 1.15, G.user && o.team !== G.user.team); if (R.burst) R.burst(at.x, at.y, at.z, 5, 0.7); } if (R.shock) R.shock(o.x, o.z, 7);
      toast(chase ? 'CHASE-DOWN BLOCK' : 'BLOCKED', 'blk'); feed(`${chase ? 'Chase-down block' : 'Block'} · ${o.name}`); if (chase) { R.benchJump && R.benchJump(o.team); if (o.isUser) grade(1, 'Chase-down block'); }
      if (!G.drill && rand() < 0.6) { o.celebK = 'wag'; o.celebT = 1.7; } }   // not in here: the finger wagged once he is down
    AU().play('block', { x: o.x }); AU().crowd.react(home(o.team) ? 'roar' : 'ooh', home(o.team) ? 1 : 0.8); R.hype(1, 0.5); B('block', { prio: 4, follow: 0.4 });
    b.state = 'loose'; b.holder = null; b.lastTouch = o.team; b.shot = null;
    G.reb = { team: p.team, t: G.t };   // a blocked shot is a missed shot: whoever comes up with it gets the rebound
    b.x = at.x; b.y = at.y; b.z = at.z;
    const ang = rand() * 6.28;
    b.vx = Math.sin(ang) * 13; b.vz = -dirOf(p.team) * rr(9, 17); b.vy = rr(4, 9);   // swatted, not tipped
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
    /* around the world: a make from each spot in order before the clock runs out; a miss stays at that spot */
    world: { secs: 60, spots: [[-22, 3], [-16, 6], [-8, 9], [0, 10], [8, 9], [16, 6], [22, 3], [-15.5, 18], [0, 25], [15.5, 18]], balls: 1, money: false, mustMake: true, title: 'Around the World' },
    combine: { secs: 45, spots: [[-22, 3], [-9, 14], [0, 25], [9, 14], [22, 3]], balls: 3, money: false, title: 'Combine · spot-up shooting' },
    dunk: { secs: 0, spots: [[17, 24], [0, 32], [-17, 24], [23, 5]], dunks: 2, title: 'Dunk Contest' },
    free: { secs: 0, spots: [[0, 18]], title: 'Shoot-around' },
    horse: { secs: 0, spots: [[0, 18]], title: 'H-O-R-S-E' },
  };
  /* the dunk contest: [name, arms, how hard (the judges' bonus), how often it goes down, the turn in the air] */
  const STYLES = [['Two-hand', 'dunk2', 0, 1, 0], ['Tomahawk', 'dunk1', 0.45, 0.96, 0], ['Reverse', 'dunk1', 0.75, 0.92, Math.PI],
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
    if (G.park) parkSay(s.made ? (s.kind === 'dunk' ? 'dunk' : 'make') : 'miss');
    D.att++; if (s.made) { D.made++; D.score += s.pts; D.streak = (D.streak || 0) + 1; D.best = Math.max(D.best || 0, D.streak); R.swish(hoopZ(0) > 0 ? 1 : -1); AU().play(s.prob > 0.55 || rand() < 0.6 ? 'swish' : 'rimin', { x: b.x }); if (D.streak >= 5 && D.streak % 5 === 0) toast(`${D.streak} straight`, 'make'); if (G.park && D.streak >= 3 && D.streak % 3 === 0 && G.user) { celebrate(G.user, ['three', 'point', 'flex']); setTimeout(() => G && G.park && parkSay('streak', 40), 500); } }
    else { D.streak = 0; AU().play('rim', { x: b.ex, power: 0.6 }); }
    b.state = 'drop'; b.t = 0; D.next = 0.9;
  }
  /* ---------- the park ----------
     Your home: you spawn here. Your player walks it with the stick; Shoot puts one up at the nearer rim. One side is a
     wall with a door for every mode (your career, a quick game, a season, the gym, the closet...); along the other
     sideline are the pick-up games and Pro-Am. The regulars wander, stop, shoot one into the air, talk. Walk into a
     ring and its card comes up: tap it to go. Menu (top left) has everything too, and a map to get anywhere. */
  const PARK = [
    { id: 'players', label: 'MY PLAYER', sub: 'switch or build one', x: 31, z: -48, r: 2.8, color: '#ffffff', wall: 1 },
    { id: 'season', label: 'SEASON', sub: 'run a whole team', x: 31, z: -36, r: 2.8, color: '#ffffff', wall: 1 },
    { id: 'quick', label: 'QUICK GAME', sub: 'two teams, one game', x: 31, z: -24, r: 2.8, color: '#ffffff', wall: 1 },
    { id: 'gym', label: 'GYM', sub: 'drills and contests', x: 31, z: -12, r: 2.8, color: '#ffffff', wall: 1 },
    { id: 'career', label: 'MY CAREER', sub: 'your season', x: 31, z: 0, r: 3.0, color: '#4cffb0', wall: 1 },
    { id: 'closet', label: 'CLOSET', sub: 'your look and gear', x: 31, z: 12, r: 2.8, color: '#ff8fd1', wall: 1 },
    { id: 'blacktop', label: 'BLACKTOP', sub: 'pick the teams, 1v1 to 3v3', x: 31, z: 24, r: 2.8, color: '#ffffff', wall: 1 },
    { id: 'classics', label: 'CLASSICS', sub: 'the great nights', x: 31, z: 36, r: 2.8, color: '#ffffff', wall: 1 },
    { id: 'daily', label: 'DAILY', sub: 'today\'s challenge', x: 31, z: 48, r: 2.8, color: '#ffffff', wall: 1 },
    { id: 'pick1', label: '1 ON 1', sub: 'pick-up to 11', x: -30, z: -36, r: 3.2, color: '#4cffb0' },
    { id: 'pick2', label: '2 ON 2', sub: 'pick-up to 21', x: -30, z: -12, r: 3.2, color: '#4cffb0' },
    { id: 'pick3', label: '3 ON 3', sub: 'pick-up to 21', x: -30, z: 12, r: 3.2, color: '#4cffb0' },
    { id: 'court', label: 'PRO-AM', sub: '5 on 5, full court', x: -30, z: 36, r: 3.2, color: '#7cc4ff' },
    { id: 'wheel', label: 'PRIZE WHEEL', sub: 'a spin a day', x: -14, z: -55, r: 3.0, color: '#ffffff', here: 1 },
  ];
  /* the first visit: a walk-through, one thing at a time, each step done by doing it */
  const TUT = [
    ['Walk', 'Put your left thumb down anywhere on the lower left of the screen and drag.'],
    ['Sprint', 'Push the stick all the way to the edge to run. It drains your stamina; walking brings it back.'],
    ['Shoot', 'Hold Shoot and let go at the top of your jump, when the meter is in the green.'],
    ['Knock one down', 'Make a shot. Closer is easier: walk in toward the rim and try a layup.'],
    ['Dunk it', 'Walk right up to the rim and hold Shoot. At the rim, Shoot is a dunk.'],
    ['Dribble moves', 'Tap Move for a crossover. Swipe it down for a step-back, up for a spin.'],
    ['String them together', 'Do two moves back to back, the second right after the first. A combo is harder to guard, and beating your man gives you a burst of speed.'],
    ['The menu', 'Tap Menu at the top left. Every mode, your career and the settings are in there, and the map takes you anywhere in the park.'],
    ['Around the park', 'Each ring on the floor is something to do: pick-up games to 21, a shooting contest, the dunk contest, drills. The regulars will play you 1 on 1 or a game of HORSE: walk up to one. The doors on the wall are the modes: your career, the blacktop, the classic nights, the daily challenge, the closet for your look.', 1],
    ['On defense', 'In a game, stay between your man and the rim. Jump as he shoots: a hand up bothers the shot, and a block is timing, near the top of your jump as he lets it go. Steal when the button lights up. Lift your thumb and you stay in front by yourself.', 1],
    ['The wall', 'Every door on the wall is a mode. Walk into the green MY CAREER ring.'],
  ];
  function tutStep(dt) {
    const T0 = G.tut, u = G.user, D = G.drill; if (!T0 || T0.done) return;
    let el = $('#tut');
    if (!el) { el = document.createElement('div'); el.id = 'tut'; $('#game').appendChild(el); }
    const ok = [
      () => (T0.dist = (T0.dist || 0) + hyp(u.vx, u.vz) * dt) > 16,
      () => { const w = stickWorld(); if (w && w.m > 0.82) T0.run = (T0.run || 0) + dt; return T0.run > 0.8; },
      () => D.att > T0.att0,
      () => D.made > T0.made0 || D.att - T0.att0 >= 7,
      () => (u.shoot && u.shoot.kind === 'dunk') || D.att - T0.att0 >= 6,
      () => !!T0.moved,
      () => (u.comboN || 0) >= 2 && G.t - (u.comboT || -9) < 0.5,
      () => !!T0.menu && !G.paused,
      () => !!T0.next,
      () => !!T0.next,
      () => G.parkAt === 'career',
    ][T0.i];
    if (T0.i !== T0.shown) {
      T0.shown = T0.i; T0.att0 = D.att; T0.made0 = D.made; T0.moved = false; T0.next = false; u.comboN = 0;
      const [t, d] = TUT[T0.i];
      el.innerHTML = `<small>Tutorial · ${T0.i + 1} of ${TUT.length}</small><b>${t}</b><span>${d}</span>${TUT[T0.i][2] ? '<button id="tutn">Next</button>' : ''}<button id="tutx">Skip</button>`; el.hidden = false; if ($('#tutn')) $('#tutn').onclick = () => { T0.next = true; }; el.classList.remove('ok'); placeCard();
      $('#tutx').onclick = () => { T0.done = true; el.hidden = true; placeCard(); if (opts.onTut) opts.onTut(false); };
      R.stationLit && R.stationLit(T0.i === TUT.length - 1 ? 'career' : G.parkAt);
      if (T0.i === TUT.length - 1) { const c0 = PARK.find(x => x.id === 'career'); G.guideXZ = { x: c0.x, z: c0.z, id: 'career' }; }
    }
    if (T0.wait > 0) { T0.wait -= dt; if (T0.wait <= 0) { T0.i++; if (opts.onTutStep) opts.onTutStep(T0.i); if (T0.i >= TUT.length) { T0.done = true; el.hidden = true; placeCard(); toast('Tutorial done', 'make'); if (opts.onTut) opts.onTut(true); } } return; }
    if (ok && ok()) { T0.wait = 0.9; el.classList.add('ok'); buzz(12); AU().play('swish'); if (T0.i === 3 && D.made <= T0.made0) el.querySelector('span').textContent = 'Close enough. It comes with reps.'; }
  }
  /* what the regulars say: hello when you come by, something when you score (or don't) near them */
  const PARKSAY = {
    hi: ['You got next?', 'Run it?', 'Who\'s this?', 'New face', 'You hoop?', '1 on 1 me', 'Let\'s get a run', 'Need one more', 'Nice kicks', 'You play for real?', 'Yo, {n}!', 'What\'s good, {n}', '{n} is here', 'Look who showed up', 'You staying a while?', 'Winner stays', 'Court\'s open', 'I got next after you', 'Been here since noon', 'Hot out here today'],
    make: ['Cash!', 'Wet', 'Too easy', 'Cookin\'', 'Splash', 'Okay okay', 'That\'s good', 'Bottoms', 'Net didn\'t move', 'Shooter!', 'Do it again', 'All day'],
    miss: ['Brick!', 'Front rim', 'Airball? Nah', 'Shoot it again', 'Keep shooting', 'Short', 'Left', 'Legs, {n}, legs', 'Off the back iron', 'Next one\'s good'],
    move: ['Ooh!', 'Handles', 'Stop it', 'Ankles!', 'Yo chill', 'He got a bag', 'Shifty', 'Combo!', 'Too smooth', 'Slow down, {n}', 'Where\'d he go?'],
    streak: ['He can\'t miss!', 'Somebody guard {n}', 'That\'s three straight', 'Heat check!', 'Get him a contract'],
    dunk: ['OHHH!', 'Put it DOWN', 'Rim\'s gonna break', 'He\'s got bounce', 'Do that in a game', 'Hang on it!', '{n} got hops', 'That rim owe you money?', 'Again! Again!'],
  };
  /* the regulars talk to each other too: one says something, another answers */
  const BANTER = [['You see the game last night?', 'Don\'t remind me'], ['I\'m nice from the corner', 'You\'re nice from the bench'], ['Who\'s got ball?', 'Shoot for it'], ['That was a foul', 'Call your own'], ['Run it back', 'After water'],
    ['My knees, man', 'Stretch first, old head'], ['Next point wins', 'It was next point ten minutes ago'], ['You owe me a drink', 'Double or nothing'], ['I had 30 in high school', 'Against who?'], ['Pass the ball sometimes', 'Get open sometimes'],
    ['These rims are tight', 'It\'s not the rims'], ['Who\'s the new kid?', 'He can play a little'], ['Lights come on at eight', 'Then we go till eight'], ['New shoes?', 'Don\'t step on them'], ['You hooping tomorrow?', 'Every day'],
    ['I\'m taking {n} first', 'Then I got {n} next'], ['Shirts or skins?', 'Shirts. Always shirts'], ['Check ball', 'Ball\'s in'], ['That boombox still work?', 'Louder than you'], ['Somebody sweep the court', 'Not it'], ['Those kids on the boards again', 'Better than you on a board'], ['You see that kickflip?', 'I saw him fall after'], ['Cart guy got the good pretzels', 'After this game'], ['{n} been dunking on everybody', 'Not on me'], ['Hand down, man down', 'You never have a hand up'], ['First to 21?', 'Win by two']];
  /* walk up and talk to one: he has a tip, or something on his mind */
  const TALK = ['Pull the stick away from the rim when you shoot. Fadeaway. Can\'t block it', 'Let go at the top of the jump. That\'s the whole secret', 'Swipe Move down for a step-back. Works on me every time', 'Don\'t sprint everywhere. Legs go, the jumper goes',
    'Big men: back him down, then turn. Hook or the turnaround', 'The gym door resets every day. Do your workouts', 'Spin the wheel by the far fence. Free stuff, every day', 'Daily\'s different every day. I never miss it',
    'You get followers out here, you know. People watch', 'Win a few in a row at this park and everybody knows your name', 'Pump fake first. They all jump', 'Throw the lob when your man cuts. Crowd goes crazy',
    'I played two-way for a year. Don\'t waste your shot, {n}', 'My cousin says you\'re the real thing. We\'ll see', 'Pro-Am runs are on the far side. Bring your best', 'Stay in front of your man. Don\'t reach, slide'];
  const fill = t => t.replace('{n}', (opts && opts.userName) || 'rook');
  function parkSay(kind, near) {
    const u = G.user; if (!R.say || !u) return;
    const who = G.pl.filter(p => p.npc && hyp(p.x - u.x, p.z - u.z) < (near || 26) && G.t - (p.saidT || -99) > 5).sort(() => rand() - 0.5)[0];
    if (!who) return; who.saidT = G.t; const L = PARKSAY[kind]; R.say(who, fill(L[Math.floor(rand() * L.length)]), 2.4);
    if (kind === 'make' || kind === 'move' || kind === 'streak' || kind === 'dunk') { who.npcPose = rand() < 0.5 ? 'point' : 'call'; who.npcW = 0; who.npcT = 1.6; }
  }
  /* two regulars shoot around, one at each rim, with balls of their own: a spot, a jumper, the ball chased down
     (through the net, or off the iron and away), again */
  function parkShooters(dt) {
    const u = G.user;
    for (const p of G.pl) if (p.npc && p.pb) {
      const b = p.pb, s = p.pbRim, rz = s * RIM;
      if (b.st === 'hold') {
        if (!p.spot) { const a = rr(-1.25, 1.25), d = rr(7, 23); p.spot = { x: Math.sin(a) * d, z: rz - s * Math.cos(a) * d }; p.pbWait = 0; }
        const near = hyp(u.x - p.x, u.z - p.z) < 5.5;
        if (p.pbUp === undefined) {
          if (hyp(p.spot.x - p.x, p.spot.z - p.z) > 1.2 && !near) { p.tx = p.spot.x; p.tz = p.spot.z; seek(p, dt, 0.3); p.pose = ''; }
          else { steer(p, dt, 0, 0); if (!near) { p.face = Math.atan2(0 - p.x, rz - p.z); p.pbWait += dt; } else p.face += (Math.atan2(u.x - p.x, u.z - p.z) - p.face) * Math.min(1, dt * 3); }
          if (p.pbWait > rr(0.5, 1.4)) { p.pbUp = 0; p.jg = GRAV * 1.5; p.vy = Math.sqrt(2 * p.jg * 1.4); p.pose = 'shoot'; }
          /* the dribble, in his right hand */
          const ph = (G.t * 7 + p.slot) % Math.PI, f = p.face, sp = hyp(p.vx, p.vz) > 2;
          b.x = p.x + Math.cos(f) * 0.9 + Math.sin(f) * (sp ? 1.2 : 0.6); b.z = p.z - Math.sin(f) * 0.9 + Math.cos(f) * (sp ? 1.2 : 0.6); b.y = sp || !p.pbWait ? 0.4 + Math.sin(ph) * 2.6 : 4.2;
        } else {
          /* up, and let go at the top */
          p.pbUp += dt; steer(p, dt, 0, 0); p.face = Math.atan2(0 - p.x, rz - p.z);
          b.x = p.x + Math.sin(p.face) * 0.6; b.z = p.z + Math.cos(p.face) * 0.6; b.y = p.y + 8.2;
          if (p.vy <= 0 && p.pbUp > 0.15) {
            const d = hyp(0 - b.x, rz - b.z), make = rand() < clamp(0.62 - d * 0.012, 0.32, 0.58), off = make ? 0 : rr(0.9, 1.6), oa = rand() * 6.28;
            const tx = Math.sin(oa) * off, tz = rz + Math.cos(oa) * off, T = clamp(0.62 + d * 0.022, 0.7, 1.3), g = 32;
            Object.assign(b, { st: 'air', vx: (tx - b.x) / T, vz: (tz - b.z) / T, vy: (10.2 - b.y + 0.5 * g * T * T) / T, T, make, t: 0 });
            p.pbUp = undefined; p.spot = null;
          }
        }
      } else if (b.st === 'air') {
        b.t += dt; b.vy -= 32 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
        if (b.t >= b.T) {
          const far = hyp(b.x - u.x, b.z - u.z) > 40 ? 0.25 : 0.5;
          if (b.make) { b.x = 0; b.z = rz; b.vx = rr(-1, 1); b.vz = -s * rr(0.5, 2); b.vy = -6; R.swish && R.swish(s); AU().play('swish', { x: b.x, vol: far }); }
          else { const a = Math.atan2(b.x, b.z - rz); b.vx = Math.sin(a) * rr(5, 9); b.vz = Math.cos(a) * rr(5, 9) - s * 3; b.vy = rr(5, 9); R.rimSnap && R.rimSnap(s, 0.3); AU().play('rim', { x: b.x, power: 0.3, vol: far }); }
          b.st = 'loose';
        }
      } else {
        /* loose: it bounces, rolls, and he goes and gets it */
        b.vy -= 32 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
        if (b.y < 0.39) { b.y = 0.39; b.vy = Math.abs(b.vy) > 3 ? -b.vy * 0.55 : 0; b.vx *= 0.82; b.vz *= 0.82; }
        if (b.y <= 0.4) { b.vx *= 1 - Math.min(1, dt * 0.9); b.vz *= 1 - Math.min(1, dt * 0.9); }
        if (Math.abs(b.x) > 33) { b.x = Math.sign(b.x) * 33; b.vx *= -0.5; } if (Math.abs(b.z) > 59) { b.z = Math.sign(b.z) * 59; b.vz *= -0.5; }
        p.tx = b.x; p.tz = b.z; seek(p, dt, 0.42); p.pose = '';
        if (hyp(b.x - p.x, b.z - p.z) < 1.9 && b.y < 4) { b.st = 'hold'; p.spot = null; }
      }
    }
  }
  /* through a door: the picture fades out, then the page behind it */
  function leavePark(id) {
    if (G.leaving) return; G.leaving = true; G.parkGo = id; buzz(8);
    const g = $('#game'); g.style.transition = 'opacity .26s ease-in'; g.style.opacity = '0';
    setTimeout(() => { finish(); g.style.transition = 'none'; g.style.opacity = ''; }, 280);
  }
  /* the ring's card sits at the top, under the walk-through when that is up: the player and the controls stay clear */
  function placeCard() {
    const c = $('#parkcard'), t = $('#tut'); if (!c) return;
    c.style.top = t && !t.hidden ? `${t.offsetTop + t.offsetHeight + 8}px` : '';
  }
  function parkStep(dt) {
    if (R.cineOn && R.cineOn() && G.user && Math.hypot(G.user.vx || 0, G.user.vz || 0) > 2) R.cine(null);   // walking off ends the arrival shot
    const u = G.user;
    /* the stanchions are solid */
    for (const s of [1, -1]) if (Math.abs(u.x) < 2.7 && Math.abs(u.z - s * 52) < 3) { const dz = u.z - s * 52; if (Math.abs(u.x) / 2.7 > Math.abs(dz) / 3) u.x = Math.sign(u.x || 1) * 2.7; else u.z = s * 52 + Math.sign(dz || -s) * 3; }
    let near = null; for (const s0 of PARK) if (hyp(u.x - s0.x, u.z - s0.z) < s0.r) near = s0;
    if (G.guideXZ && near && near.id === G.guideXZ.id) G.guideXZ = null;
    /* or a regular: walk right up to one and you can challenge him */
    let guy = null;
    if (!near) { let bd = 4.2; for (const p of G.pl) if (p.npc) { const d = hyp(p.x - u.x, p.z - u.z); if (d < bd) { bd = d; guy = p; } } }
    const key = near ? near.id : guy ? 'npc:' + guy.d.id : undefined;
    if (key !== G.parkAt && guy && !near) {
      G.parkAt = key; R.stationLit && R.stationLit(null); const c = $('#parkcard');
      c.innerHTML = `<div class="pci" style="--sc:#4cffb0"><b>${guy.name}</b><span>park regular · ${guy.d.pos} · ${guy.d.ovr} overall</span></div><div class="pcb"><button class="big" id="parkgo">1 on 1</button><div class="pc2"><button class="ghost" id="parkhs">HORSE</button><button class="ghost" id="parktk">Talk</button></div></div>`;
      c.hidden = false; placeCard(); $('#parkgo').onclick = () => leavePark(key); $('#parkhs').onclick = () => leavePark('horse:' + guy.d.id);
      $('#parktk').onclick = () => { const li = (guy.talkI = guy.talkI === undefined ? Math.floor(rand() * TALK.length) : (guy.talkI + 1) % TALK.length), line = fill(TALK[li]);
        guy.saidT = G.t + 3; guy.npcW = 0; guy.npcT = 4; guy.npcPose = 'call'; if (R.say) R.say(guy, line.length > 34 ? line.slice(0, line.lastIndexOf(' ', 34)) + '…' : line, 3.4); notify(guy.name, line, { quiet: true });
        if (!guy.talked) { guy.talked = true; if (opts.onParkTalk) { const m = opts.onParkTalk(guy.d.id); if (m) setTimeout(() => toast(m, 'call'), 900); } } };
      guy.npcW = 0; guy.npcT = 3; if (R.say && G.t - (guy.saidT || -99) > 3) { guy.saidT = G.t; R.say(guy, ['You want this smoke?', 'Check it up', 'First to 11?', 'You sure?', 'Bet. Let\'s go'][Math.floor(rand() * 5)], 2.4); }
    }
    else if (key !== G.parkAt) { G.parkAt = key; R.stationLit && R.stationLit(G.parkAt); const c = $('#parkcard');
      if (near) {
        const info = (opts.parkInfo || {})[near.id], nx = near.id === 'career' && opts.parkNext;
        c.innerHTML = `<div class="pci" style="--sc:${near.color}"><b>${near.label}</b><span>${info || near.sub}</span></div><div class="pcb">${nx ? `<button class="big" id="parknx">${nx}</button><button class="ghost" id="parkgo">Career menu</button>` : `<button class="big" id="parkgo">${near.id.startsWith('pick') || near.id === 'court' ? 'Play' : near.id === 'daily' || near.id === 'quick' || near.id === 'blacktop' ? 'Set it up' : 'Go in'}</button>`}</div>`;
        c.hidden = false; placeCard(); $('#parkgo').onclick = () => leavePark(near.id);
        /* some rings open right here, over the park */
        if (near.here && opts.inPark && opts.inPark[near.id]) { const b0 = $('#parkgo'); b0.textContent = (opts.parkInfo || {})[near.id + 'Btn'] || 'Open';
          b0.onclick = () => { const ov = $('#pause'); G.paused = true; ov.hidden = false; ov.classList.add('pmenu');
            opts.inPark[near.id](ov, info => { ov.hidden = true; ov.classList.remove('pmenu'); G.paused = false; AU().muffle(false); if (info) Object.assign(opts.parkInfo || (opts.parkInfo = {}), info); G.parkAt = undefined; }); }; }
        if ($('#parknx')) $('#parknx').onclick = () => leavePark('next');
      }
      else c.hidden = true; }
    if (G.t - (G.hiT || 0) > rr(7, 12)) { G.hiT = G.t; parkSay('hi', 14); }
    /* two of the regulars, talking */
    if (R.say && G.t - (G.banT || 4) > (G.banGap || 7)) { G.banT = G.t; G.banGap = rr(6, 11);
      const ns = G.pl.filter(p => p.npc && hyp(p.x - u.x, p.z - u.z) < 34 && G.t - (p.saidT || -99) > 4).sort(() => rand() - 0.5);
      if (ns.length >= 2) { const a = ns[0], b2 = ns.slice(1).sort((x, y) => hyp(x.x - a.x, x.z - a.z) - hyp(y.x - a.x, y.z - a.z))[0], pr = BANTER[Math.floor(rand() * BANTER.length)], g = G;
        a.saidT = b2.saidT = G.t + 2; R.say(a, fill(pr[0]), 2.3); setTimeout(() => { if (G === g && G.park && !G.paused) R.say(b2, fill(pr[1]), 2.4); }, 1700); } }
    /* your phone */
    if (opts.parkNotes && opts.parkNotes.length && !G.tut && G.t - (G.phoneT || -12) > (G.phoneGap || 20)) { G.phoneT = G.t; G.phoneGap = rr(16, 28);
      G.phoneI = G.phoneI === undefined ? Math.floor(rand() * opts.parkNotes.length) : (G.phoneI + 1) % opts.parkNotes.length; const n = opts.parkNotes[G.phoneI]; notify(n.who, n.text, { go: n.go, quiet: true }); }
    parkShooters(dt);
    for (const p of G.pl) if (p.npc && !p.pb) {
      if (hyp(p.x - u.x, p.z - u.z) < 5.5) { p.npcW = 0; p.npcT = Math.max(p.npcT || 0, 1); }
      p.npcT = (p.npcT || 0) - dt;
      if (p.npcT <= 0) { const r = rand(); if (r < 0.55) { p.tx = rr(-24, 24); p.tz = rr(-52, 52); p.npcW = 1; p.npcT = rr(4, 9); } else { p.npcW = 0; p.npcT = rr(2, 6); p.npcPose = ['call', 'shrug', '', '', 'flex', 'point'][Math.floor(rand() * 6)]; } }
      if (p.npcW && hyp(p.tx - p.x, p.tz - p.z) > 1.5) { seek(p, dt, 0.32); p.pose = ''; } else { steer(p, dt, 0, 0); if (p.npcPose && p.y === 0) { p.pose = p.npcPose; } const h = G.user; if (!p.npcW && hyp(h.x - p.x, h.z - p.z) < 14) p.face += (Math.atan2(h.x - p.x, h.z - p.z) - p.face) * Math.min(1, dt * 2); }
    }
    tutStep(dt);
  }
  /* the map in the menu: tap a ring and you are there (a cut, the way the broadcast changes camera) */
  function parkTravel(id) {
    const s0 = PARK.find(s => s.id === id); if (!s0 || !G.user) return;
    const u = G.user;   // in the ring, facing out of the park (the door, or the fence): the camera stays on the court side
    cut(); u.x = s0.x; u.z = s0.z; u.vx = u.vz = 0; u.face = s0.x > 0 ? Math.PI / 2 : -Math.PI / 2;
    if (R.parkYaw) R.parkYaw(u.face); G.parkAt = undefined;
  }
  function freeStep(dt) {
    const D = G.drill, u = G.user;
    if (G.park) parkStep(dt);
    G.clock = 0; G.shotClock = 24; G.score[0] = D.made; G.score[1] = D.att;
    if (D.next > 0) { D.next -= dt; if (D.next <= 0) { D.next = 0; give(u); } }
    $('#ftmsg').hidden = !!(G.park && G.tut && !G.tut.done);
    $('#ftmsg').textContent = G.park ? (D.att ? `${D.made} of ${D.att}${D.streak > 1 ? ` · ${D.streak} straight` : ''}` : 'Walk into a ring') : `${D.made} of ${D.att}${D.att ? ` · ${Math.round(D.made / D.att * 100)}%` : ''} · streak ${D.streak || 0} (best ${D.best || 0}) · pause to finish`;
  }
  function dunkLands(s) {
    const D = G.drill, b = G.ball, p = s.shooter, st = STYLES[s.style || 0];
    const r = p.r, rate = ((r.dunk || 70) + (r.vert || 70)) / 2;
    const tm = s.timing === 'Excellent' ? 0.7 : /Slightly/.test(s.timing || '') ? 0.2 : -0.5;
    const base = s.made ? 7.1 + st[2] + clamp((s.d - 8) * 0.24, 0, 1.4) + tm + (rate - 75) / 45 : 5.6;
    const judges = [0, 1, 2, 3, 4].map(() => clamp(Math.round(base + PB.gauss() * 0.45), s.made ? 6 : 5, s.made ? 10 : 7));
    const sum = judges.reduce((a, x) => a + x, 0);
    D.scores.push(sum); D.score += sum; D.att++; if (s.made) D.made++;
    if (s.made) { R.swish(1); if (R.rimSnap) R.rimSnap(1); AU().play('dunk', { x: b.x }); AU().crowd.react(sum >= 45 ? 'roar' : 'applause', sum >= 45 ? 1.2 : 0.7); R.hype(sum >= 45 ? 1.4 : 0.8, sum >= 47 ? 0.8 : 0); buzz([20, 30, 30]); if (sum >= 46) wantReplay('dunk'); }
    else { AU().play('rim', { x: b.ex, power: 0.8 }); AU().crowd.react('aww', 0.8); }
    toast(`${judges.join(' ')} · ${sum}`, s.made ? 'judge' : 'judge miss');
    B(sum === 50 ? 'dk_fifty' : s.made ? 'dk_good' : 'dk_miss', { prio: 4, follow: s.made && sum < 50 ? 0.45 : 0 });
    feed(`${st[0]}${s.made ? '' : ' (missed)'} · ${sum}`);
    if (sum === 50) setTimeout(() => toast('FIFTY!', 'make'), 1400);
    b.state = 'drop'; b.t = 0;
    D.n++;
    if (D.n >= D.def.dunks) D.over = true; else D.next = 2.8;
  }
  /* ---------- H-O-R-S-E, against a park regular ----------
     Take turns setting a shot from anywhere. Make it and he has to make the same one, from the same spot; miss the
     match and it is a letter. The one setting keeps going until he misses; then the other one sets. Five letters,
     H-O-R-S-E, and you are out. Your shots are your own (walk anywhere to set one; to match, you are walked to the spot). */
  const HORSE = 'HORSE';
  const letters = n => n ? HORSE.slice(0, n).split('').join('-') : '–';
  function horseStart() {
    const D = G.drill, foe = G.pl.find(p => p.team === 1);
    Object.assign(D, { foe, lead: G.user, shooter: G.user, mode: 'set', spot: null, L: [0, 0], next: 0.6, ready: false, free: true });
    foe.npc = true; foe.x = 18; foe.z = 30; foe.face = -Math.PI / 2;
  }
  const other = p => p === G.user ? G.drill.foe : G.user;
  function horseLands(s) {
    const D = G.drill, b = G.ball, p = s.shooter, me = p === G.user;
    if (s.made) { R.swish(1); AU().play(s.prob > 0.55 || rand() < 0.6 ? 'swish' : 'rimin', { x: b.x }); } else AU().play('rim', { x: b.ex, power: 0.6 });
    b.state = 'drop'; b.t = 0;
    if (D.mode === 'set') {
      if (s.made) { D.spot = D.from; D.mode = 'match'; D.shooter = other(p); toast(me ? 'Match that' : `${p.name} hits. Match it`, me ? 'make' : 'call'); }
      else { D.lead = other(p); D.shooter = D.lead; D.spot = null; toast(me ? 'Missed: his turn to set one' : `${p.name} misses: your shot`, me ? 'opp' : 'make'); }
    } else {
      const k = me ? 0 : 1;
      if (s.made) toast(me ? 'Matched' : `${p.name} matches it`, me ? 'make' : 'opp');
      else { D.L[k]++; celebrate(other(p), ['point', 'flex', 'three']); p.celebK = 'ugh'; p.celebT = 1.2; toast(me ? `Letter: ${letters(D.L[0])}` : `${p.name} takes a letter: ${letters(D.L[1])}`, me ? 'opp' : 'make'); buzz(me ? [30, 40, 30] : 12); }
      D.mode = 'set'; D.shooter = D.lead; D.spot = null;
      if (D.L[k] >= 5) { D.over = true; D.won = !me; }
    }
    D.next = 1.2; D.ready = false; D.from = null;
  }
  function horseStep(dt) {
    const D = G.drill, u = G.user, f = D.foe, b = G.ball;
    G.score[0] = D.L[1]; G.score[1] = D.L[0]; G.clock = 0; G.shotClock = 24;
    if (D.over) { if (b.state !== 'shot') { D.endT = (D.endT || 0) + dt; if (D.endT > 1.8) finish(); } }
    const sh = D.shooter, wait = other(sh);
    /* the one not shooting stands off to the side, out of the way */
    const wx = sh.x > 0 ? -16 : 16;
    if (!wait.shoot) { wait.tx = wx; wait.tz = 30; if (hyp(wait.tx - wait.x, wait.tz - wait.z) > 1) seek(wait, dt, 0.5); else { steer(wait, dt, 0, 0); wait.face = Math.atan2(sh.x - wait.x, sh.z - wait.z); } }
    D.free = sh === u && D.mode === 'set';
    if (D.next > 0) { D.next -= dt; return msg(); }
    if (D.over) return msg();
    /* the shooter gets to his spot, then the ball */
    if (!D.ready && b.state !== 'shot' && !sh.shoot) {
      let to = D.spot;
      if (!to && sh === f) { if (!D.pick) { const a = rr(-1.3, 1.3), d = rr(6, 24); D.pick = { x: Math.sin(a) * d, z: RIM - Math.cos(a) * d }; } to = D.pick; }
      if (to && hyp(to.x - sh.x, to.z - sh.z) > 0.8) { sh.tx = to.x; sh.tz = to.z; seek(sh, dt, 0.6); }
      else { steer(sh, dt, 0, 0); give(sh); sh.hold = 0; D.ready = true; D.pick = null; D.aimT = rr(0.6, 1.2); }
    }
    /* his shot: a beat to square up, then up */
    if (D.ready && sh === f && b.holder === f && !f.shoot) { f.face = Math.atan2(0 - f.x, RIM - f.z); D.aimT -= dt; if (D.aimT <= 0) { D.from = { x: f.x, z: f.z }; startShot(f); } }
    if (D.ready && sh === u && u.shoot && !D.from) D.from = { x: u.x, z: u.z };
    msg();
    function msg() {
      $('#ftmsg').hidden = false;
      $('#ftmsg').textContent = D.over ? (D.won ? 'You win' : `${f.name} wins`) : `You ${letters(D.L[0])} · ${f.name} ${letters(D.L[1])}\n${sh === u ? (D.mode === 'set' ? 'Your shot: from anywhere' : 'Match it') : (D.mode === 'set' ? 'His shot' : 'He has to match it')}`;
    }
  }
  function drillSpot() { const D = G.drill, sp = D.def.spots[D.rack]; return toCourt(0, sp[0], sp[1]); }
  function drillLands(s) {
    if (G.drill.kind === 'dunk') { dunkLands(s); return; }
    if (G.drill.kind === 'free') { freeLands(s); return; }
    if (G.drill.kind === 'horse') { horseLands(s); return; }
    const D = G.drill, b = G.ball, money = D.def.money && D.ball === D.def.balls - 1;
    D.att++;
    if (s.made) { D.made++; D.score += money ? 2 : 1; if (D.def.mustMake && D.rack + 1 >= D.def.spots.length) { D.score += Math.floor(D.t); toast(`Around the world! +${Math.floor(D.t)} for the time left`, 'make'); } R.swish(1); AU().play(s.prob > 0.55 || rand() < 0.6 ? 'swish' : 'rimin', { x: b.x }); AU().crowd.react(money ? 'roar' : 'applause', money ? 0.9 : 0.5); if (money) { toast('MONEY BALL', 'make'); B('moneyball', { prio: 3 }); } buzz([15, 30, 15]); }
    else { AU().play('rim', { x: b.ex, power: 0.6 }); }
    b.state = 'drop'; b.t = 0;
    if (!(D.def.mustMake && !s.made)) { D.ball++; if (D.ball >= D.def.balls) { D.ball = 0; D.rack++; } }
    D.next = D.rack >= D.def.spots.length ? -1 : 0.45;
    if (D.next < 0) D.over = true;
  }
  function drillStep(dt) {
    if (G.drill.kind === 'dunk') { dunkStep(dt); return; }
    if (G.drill.kind === 'free') { freeStep(dt); return; }
    if (G.drill.kind === 'horse') { horseStep(dt); return; }
    const D = G.drill, u = G.user;
    if (!D.over) { D.t -= dt; if (D.t <= 0) { D.t = 0; D.over = true; } }
    G.clock = D.t; G.shotClock = 24; G.score[0] = D.score; G.score[1] = D.att;
    const sp = D.rack < D.def.spots.length ? drillSpot() : { x: u.x, z: u.z };
    if (!u.shoot) { u.tx = sp.x; u.tz = sp.z; seek(u, dt, 1); }
    if (D.next > 0) { D.next -= dt; if (D.next <= 0 && !D.over) { D.next = 0; give(u); u.hold = 0; } }
    const left = D.rack < D.def.spots.length ? (D.def.mustMake ? `Spot ${D.rack + 1} of ${D.def.spots.length} · ${Math.ceil(D.t)}s` : `Rack ${D.rack + 1} · ball ${D.ball + 1}${D.def.money && D.ball === D.def.balls - 1 ? ' (money)' : ''}`) : 'Done';
    $('#ftmsg').hidden = false; $('#ftmsg').textContent = `${left} · ${D.score} pts`;
    if (R.rackLeft) R.rackLeft(D.rack, D.ball + (G.ball.holder === u || G.ball.state === 'shot' ? 1 : 0));
    if (D.over && G.ball.state !== 'shot') { D.endT = (D.endT || 0) + dt; if (D.endT > 1.2) finish(); }
  }

  function shotLands() {
    const b = G.ball, s = b.shot, p = s.shooter;
    if (G.drill) { drillLands(s); return; }
    if (s.made && G.half && G.clr === p.team) {
      /* it went in, but the ball was never taken back past the arc: no basket, and it is their ball */
      b.state = 'drop'; b.t = 0; toast(p.team === (G.user ? G.user.team : 0) ? 'Take it back: no basket' : 'No basket: not taken back', p.team === 0 ? 'opp' : 'make'); AU().play('whistle', { vol: 0.6 });
      feed(`No basket · ${p.name} did not take it back`); G.poss = null; dead(1.2, () => checkBall(1 - p.team)); return;
    }
    if (s.made) {
      G.score[p.team] += s.pts;
      p.st.pts += s.pts; p.st.fgm++; if (s.three) p.st.tpm++;
      if (s.kind === 'dunk') p.st.dunk++; else if (s.kind === 'layup' || s.kind === 'floater' || s.kind === 'hook') p.st.lay++; else if (!s.three) p.st.mid++;
      if (s.three && s.caught) p.st.cs3++;
      if (s.fade) p.st.fade++; if (s.kind === 'hook') p.st.hookm++;
      if (clutchTime()) p.st.clutch += s.pts;
      R.swish(hoopZ(p.team) > 0 ? 1 : -1);
      AU().play(s.kind === 'dunk' ? 'dunk' : s.prob > 0.55 || rand() < 0.62 ? 'swish' : 'rimin', { x: b.x });
      if (s.kind === 'dunk' && !G.replay && !G.drill) G.hitT = 0.1;
      if (s.kind === 'dunk' && R.rimSnap) R.rimSnap(hoopZ(p.team) > 0 ? 1 : -1);
      if (s.kind === 'dunk' && R.pow && !G.drill) R.pow(s.oop ? 'OOP!' : rand() < 0.5 ? 'SLAM!' : 'BOOM!', rr(-1.5, 1.5), 12.4, hoopZ(p.team) - dirOf(p.team) * 0.5, 1.2);
      if (home(p.team)) AU().crowd.react('roar', s.kind === 'dunk' ? 1.2 : s.three ? 1 : 0.65);
      if (home(p.team) || s.kind === 'dunk') R.hype(s.kind === 'dunk' ? 1.4 : s.three ? 1 : 0.6, s.kind === 'dunk' ? 0.9 : 0); else AU().crowd.react(rand() < 0.5 ? 'groan' : 'aww', s.three ? 0.8 : 0.5);
      if (s.foul) { AU().crowd.react('roar', 1.1); }
      /* the call: a buzzer-beater, a hot hand, an and-one, or the shot itself */
      if (p.isUser) { G.streak = (G.streak || 0) + 1; if (tkoOn()) G.tko.miss = 0;
        if (G.streak === 3) setTimeout(() => toast('Heating up', 'make'), 900); else if (G.streak === 5) setTimeout(() => toast('On fire', 'make'), 900); }
      /* the officials: both arms up on a three */
      if (s.three && R.refSignal) R.refSignal('sig3', 1.3);
      /* a dunk on somebody: said out loud */
      if (s.kind === 'dunk' && !G.drill) { const v = nearestDef(p); if (v.who && v.d < 3.4) { R.benchJump && R.benchJump(p.team); feed(`${p.name} dunks on ${v.who.name}`); v.who.celebK = 'hips'; v.who.celebT = 1.5;
        if (!v.who.isUser && v.who.y === 0 && rand() < 0.4) { const dx = v.who.x - p.x, dz = v.who.z - p.z, L = hyp(dx, dz) || 1; ankles(v.who); v.who.vx = dx / L * 5; v.who.vz = dz / L * 5; }   // put on the floor
        if (p.isUser) { setTimeout(() => toast('POSTERIZED', 'make'), 500); grade(1, 'Poster dunk'); buzz([30, 40, 30]); } else if (v.who.isUser) { setTimeout(() => toast('Dunked on', 'opp'), 500); powAt('OUCH!', v.who, 0.95, true); } } }
      if (p.isUser && !G.drill) { const was = p.st.pts - s.pts, th = [10, 20, 30, 40, 50].find(v => was < v && p.st.pts >= v);
        if (th) { G.noteAt = -99; social('pts', p.st.pts); } else if (s.kind === 'dunk' && rand() < 0.6) social('dunk'); else if (s.three && rand() < 0.4) social('three'); }
      /* your badges at work, shown as they fire */
      if (p.isUser && !G.drill) { const k = s.kind === 'dunk' ? 'poster' : s.fade ? 'fade' : s.kind === 'hook' ? 'post' : s.kind === 'layup' || s.kind === 'floater' ? 'acro' : s.three ? (s.caught && bt(p, 'catch') ? 'catch' : 'deep') : 'mid';
        badgePop(p, clutchTime() && bt(p, 'clutch') ? 'clutch' : k); }
      /* the broadcast's graphic: a scorer's line when he reaches ten, twenty, thirty... or his third three */
      { const full = p.st.pts * 12 / (G.qlen || 3), was = (p.st.pts - s.pts) * 12 / (G.qlen || 3), step = Math.floor(full / 10);
        if (!G.drill && ((step > Math.floor(was / 10) && step >= 1) || (s.three && p.st.tpm === 3))) statPop(p, s.three && p.st.tpm === 3 && !(step > Math.floor(was / 10)) ? `${p.st.tpm} threes` : null); }
      const run = G.run && G.run.team === p.team ? G.run : (G.run = { team: p.team, pts: 0, said: false });
      run.pts += s.pts;
      if ((s.kind === 'dunk' || s.three) && home(p.team) && R.board) R.board(s.kind === 'dunk' ? 'SLAM!' : 'SPLASH!', 2.2);
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
      else if (s.three && p.stepT !== undefined && G.t - p.stepT < 2) B('stepback', { prio: 4 });
      else if (s.foul) B('and1', { prio: 4 });
      else if (s.fade) B('fade', { prio: 4 });
      else if (s.kind === 'hook') B('hookshot', { prio: 3 });
      else if (s.kind === 'dunk' && p.showoff) B('showoff', { prio: 5 });
      else B(s.kind === 'dunk' ? 'dunk' : s.three ? 'three' : s.kind === 'layup' ? 'layup' : 'jumper', { prio: s.kind === 'dunk' || s.three ? 3 : 2, follow: s.three ? 0.3 : s.kind === 'dunk' ? 0.35 : 0.15 });
      if (run.pts >= 8 && !run.said) { run.said = true; if (!G.drill && G.to && G.to[1 - p.team] > 0 && !(G.q >= 4 && G.clock < 20)) G.coachTO = 1 - p.team;   /* the other bench has seen enough: a timeout at the next whistle */ setTimeout(() => B('run', { prio: 1 }), 2600); const tm = G.teams[p.team], n = run.pts; setTimeout(() => { const e = $('#statpop'); if (!e || G.drill) return; e.innerHTML = `<i style="background:${tm.c1}"></i><div><b>${tm.name}</b><span>on a ${n}-0 run</span></div>`; e.classList.remove('on'); void e.offsetWidth; e.classList.add('on'); clearTimeout(statPop.h); statPop.h = setTimeout(() => e.classList.remove('on'), 3200); }, 4200); }
      /* assist: a pass that set it up in the last few seconds */
      let ast = null;
      if (b.passer && b.passer.team === p.team && b.passer !== p && G.t - b.passT < 3.2 && (p.hold || 0) < 2.4) { ast = b.passer; ast.st.ast++; }
      if (s.kind === 'dunk' && R.shock) R.shock(0, hoopZ(p.team) - dirOf(p.team) * 1.5, 10);
      const call = !p.isUser ? (s.kind === 'dunk' ? 'SLAM' : s.three ? 'SPLASH' : 'BUCKET')
        : G.clock <= 0.05 ? 'AT THE BUZZER' : s.kind === 'dunk' ? pickOf(['SLAM', 'THROWN DOWN', 'FLUSH', 'HAMMER']) : s.three && s.d > 28 ? pickOf(['FROM DEEP', 'WAY DOWNTOWN', 'LIMITLESS'])
        : s.three && s.fade ? 'STEP-BACK THREE' : s.three ? pickOf(['SPLASH', 'CASH', 'BANG', 'MONEY', 'WET', 'NOTHING BUT NET']) : s.fade ? pickOf(['FADEAWAY', 'OVER HIM']) : s.kind === 'hook' ? 'HOOK SHOT'
        : s.kind === 'floater' ? pickOf(['FLOATER', 'TEARDROP']) : s.kind === 'layup' ? pickOf(['LAYUP', 'AT THE RIM', 'FINISHED']) : s.prob < 0.3 ? pickOf(['TOUGH SHOT', 'HOW?']) : pickOf(['BUCKET', 'COUNT IT', 'PURE', 'GOOD', 'MID-RANGE']);
      /* the cartoon of it: the points float up off the rim; your threes, and-ones and assists get a word of their own */
      if (R.pow && !G.drill && !G.replay && (p.team === 0 || p.isUser)) { const hz = hoopZ(p.team) - dirOf(p.team) * 1.2;
        R.pow('+' + s.pts, rr(-0.8, 0.8), 10.6, hz, 0.8);
        if (p.isUser && s.foul) R.pow('AND 1!', 3.2, 12.6, hz, 1.05);
        else if (p.isUser && G.clock <= 0.05) R.pow('CLUTCH!', 3.2, 12.6, hz, 1.2);
        else if (p.isUser && s.three) R.pow(pickOf(['SPLASH!', 'CASH!', 'WET!', 'SWISH!']), 3.2, 12.6, hz, 1.05);
        else if (p.isUser && s.kind !== 'dunk' && s.prob > 0.55 && rand() < 0.5) R.pow(pickOf(['SWISH!', 'PURE!', 'SMOOTH!']), 3.2, 12.4, hz, 0.9);
        if (ast && ast.isUser) powAt('DIME!', p, 0.95);
        if (s.kind === 'dunk' && R.burst) R.burst(0, 10.2, hoopZ(p.team) - dirOf(p.team) * 0.6, 9, 1); }
      if (p.isUser && (G.streak === 3 || G.streak === 5)) { setTimeout(() => { if (G && G.user) powAt(G.streak >= 5 ? 'FIRE!' : 'HOT!', G.user, 1, false, 1.4); }, 900); quip('Hot', true); }
      if (p.team === 0) toast(call + (s.foul ? ' · AND ONE' : ''), 'make'); else toast(`${p.name} scores`, 'opp');
      feed(`${p.name} ${s.oop ? 'alley-oop' : s.kind === 'dunk' ? 'dunk' : s.three ? 'three' : s.kind === 'layup' ? 'layup' : s.kind === 'hook' ? 'hook shot' : s.kind === 'floater' ? 'floater' : 'jumper'}${ast ? ` (${ast.name} ast)` : ''}`);
      if (p.isUser) { grade(s.three ? 4 : 3, s.three ? 'Made three' : 'Scored'); buzz([20, 30, 30]); }
      /* the league celebrates too: a big shot late, an and-one, a dunk now and then */
      if (!p.isUser && !G.drill && (s.three || s.kind === 'dunk' || s.foul) && rand() < (clutchTime() ? 0.6 : s.foul ? 0.35 : 0.14)) celebrate(p, s.foul ? ['chest', 'flex'] : s.kind === 'dunk' ? ['roar', 'flex', 'toosmall'] : clutchTime() ? ['ice', 'nightnight', 'shh'] : ['three', 'shrug', 'point', 'goggles']);
      if (p.isUser && (s.three || s.kind === 'dunk' || s.foul)) { celebrate(p, s.foul ? ['chest', 'flex', 'toosmall'] : s.kind === 'dunk' ? ['roar', 'flex', 'chest', 'toosmall'] : clutchTime() ? ['ice', 'nightnight', 'shh', 'three'] : ['goggles', 'three', 'point', 'shrug', 'ice']); for (const m of G.pl) if (m.team === p.team && m !== p && hyp(m.x - p.x, m.z - p.z) < 20 && rand() < 0.6) { m.pose = 'celebrate'; setTimeout(() => { if (m.pose === 'celebrate') m.pose = ''; }, 1100); } if (rand() < 0.5) { const m = G.pl.find(o => o.team === p.team && !o.isUser); if (m) setTimeout(() => CH('ch_nice', m), 900); } }
      else if (!p.isUser && (s.kind === 'dunk' || s.foul || (s.three && p.r.three > 80)) && rand() < 0.35) celebrate(p, s.kind === 'dunk' ? ['roar', 'flex'] : s.foul ? ['chest'] : ['three', 'goggles']);
      /* a bucket off a pass: a finger for the man who found him, on the way back */
      if (ast && !(p.celebT > 0) && !G.drill && rand() < 0.45) { p.celebK = 'point'; p.celebT = 0.75; }
      if ((s.three || s.kind === 'dunk' || s.foul || G.clock <= 0.05) && R.benchJump) R.benchJump(p.team);
      if (p.isUser || (ast && ast.isUser)) {
        const v = (s.kind === 'dunk' ? 3 : s.three ? 2.5 : 1) + (s.foul ? 1 : 0) + (s.oop ? 1 : 0) + (G.clock <= 0.05 ? 4 : clutchTime() ? 1 : 0) + (p.isUser ? 0 : -0.8);
        const what = !p.isUser ? 'Your assist' : s.oop ? 'Alley-oop' : s.kind === 'dunk' ? 'Dunk' : s.three ? 'Three' : s.kind === 'layup' ? 'Layup' : 'Bucket';
        if (v >= 2) reelMark(s.kind, v, what + (s.foul ? ' and one' : '') + (G.clock <= 0.05 ? ' at the buzzer' : ''));
      }
      if (ast && ast.isUser) grade(3, 'Assist');
      /* the man you guard scored */
      if (G.user && p.team === 1 && G.user.slot === p.slot && hyp(G.user.x - p.x, G.user.z - p.z) < 9) grade(-2, 'Your man scored');
      b.state = 'drop'; b.t = 0;
      if (G.half) {
        /* first to the number wins (by two, when that is the rule) */
        const me = G.score[p.team], them = G.score[1 - p.team];
        if (me >= G.target && (!G.by2 || me - them >= 2)) { G.poss = null; b.state = 'drop'; G.phase = 'dead'; G.deadT = 0.9; G.then = () => { G.q = 4; G.clock = 0; endPeriod(); }; return; }
        if (me === G.target - 1 && !G.gpSaid) { G.gpSaid = true; setTimeout(() => toast('Game point', 'call'), 900); }
        G.poss = null; dead(1.1, () => checkBall(G.mitt ? p.team : 1 - p.team));
      }
      else if (s.foul) { G.ftq = { shooter: p, n: 1, total: 1, and1: true }; dead(1.3, startFT); }
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
      if (s.foul && G.half) { b.state = 'drop'; b.t = 0; b.shot.made = false; toast('Foul: ball back', ''); G.poss = null; dead(1.1, () => checkBall(p.team)); return; }   // no free throws on the blacktop
      if (s.foul) {
        G.ftq = { shooter: p, n: s.pts, total: s.pts };
        b.state = 'drop'; b.t = 0; b.shot.made = false;
        dead(1.1, startFT);
        return;
      }
      AU().play(rand() < 0.3 ? 'board' : 'rim', { x: b.ex, power: rr(0.5, 1) });
      if (R.rimSnap) R.rimSnap(hoopZ(p.team) > 0 ? 1 : -1, 0.5);   // the iron shivers
      if (G.lastShot && G.lastShot.prob > 0.72 && !G.drill && rand() < 0.7) { p.celebK = 'ugh'; p.celebT = 1.1; }   // he had that one: hands to the head
      if (s.kind === 'dunk' && !G.drill) { AU().crowd.react('ooh', 1); if (R.rimSnap) R.rimSnap(hoopZ(p.team) > 0 ? 1 : -1, 0.85); b.vy = Math.max(b.vy || 0, 9); }   // a missed dunk: off the back iron and up, and the building lets him hear it
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
    const was = G.pl.map(o => [o.x, o.z]);   // the line-up: a cut to the free-throw camera whenever anyone has to be moved to his place
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
    if (G.pl.some((o, i) => hyp(o.x - was[i][0], o.z - was[i][1]) > 1.2)) cut();
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
      R.swish(hoopZ(p.team) > 0 ? 1 : -1);
      AU().play('swish', { x: b.x }); if (home(p.team)) AU().crowd.react('applause', 0.8);
      if (p.isUser) grade(0.6, 'Free throw');
    } else { AU().play('rim', { x: b.ex, power: 0.6 }); if (home(p.team)) AU().crowd.react('aww', 0.6); else AU().crowd.react('roar', 0.4); if (p.isUser) grade(-0.6, 'Missed free throw'); }
    if (q.n > 0) { b.state = 'drop'; b.t = 0;
      /* between the two: the nearest teammates step in for a hand slap, make or miss */
      if (!G.drill) { const near = G.pl.filter(m => m.team === p.team && m !== p && hyp(m.x - p.x, m.z - p.z) < 13).sort((a, c) => hyp(a.x - p.x, a.z - p.z) - hyp(c.x - p.x, c.z - p.z)).slice(0, 2);
        for (const m of near) { const dx = p.x - m.x, dz = p.z - m.z, L = hyp(dx, dz) || 1, st = Math.max(0, L - 3.4) * 0.8; m.slap = { t0: G.t, x: m.x, z: m.z, dx: dx / L * st, dz: dz / L * st }; m.face = Math.atan2(dx, dz); m.celebK = 'five'; m.celebT = 0.85; }
        if (near.length) { p.celebK = near.length > 1 ? 'five2' : 'five'; p.celebT = 0.85; setTimeout(() => { if (G && G.active !== false) AU().play('catch', { vol: 0.5 }); }, 380); } }
      dead(0.9, startFT); return; }
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
  const passingPose = pose => pose === 'chestPass' || pose === 'bpass' || pose === 'lobPass';
  function passTo(p, r) {
    const b = G.ball;
    if (b.holder !== p || p.shoot) return;
    const PS = 58;   // feet a second: a pass with some zip on it (it was 46, and floated)
    const T0 = hyp(r.x - p.x, r.z - p.z) / PS + 0.1;
    const lx = clamp(r.x + r.vx * T0 * 0.8, -24, 24), lz = clamp(r.z + r.vz * T0 * 0.8, -46, 46);
    const hp = handPos(p);
    b.state = 'pass'; b.holder = null; b.from = p; b.to = r; b.t = 0;
    p.pose = 'chestPass'; p.reachT = 0.32;   // both arms push the ball out
    p.passA = Math.atan2(lx - p.x, lz - p.z); p.passT0 = G.t;   // he turns and steps into it
    b.sx = hp.x; b.sy = hp.y - 1; b.sz = hp.z; b.ex = lx; b.ez = lz; b.ey = r.ht / 12 * 0.6 + 1.2;
    b.dur = hyp(lx - p.x, lz - p.z) / PS + 0.1; b.apex = 0.35 + b.dur * 0.9; b.wild = false;
    b.passer = p; b.passT = G.t + b.dur;
    /* the alley-oop: a cutter heading for the rim who can finish above it gets the ball thrown up there */
    b.lob = false;
    /* a short pass past a defender's hands: bounced off the floor about two thirds of the way */
    b.bounce = b.dur < 0.5 && rand() < 0.4;
    if (b.bounce) { p.pose = 'bpass'; b.bn = false; }
    const toRim = (0 - r.x) * r.vx + (hoopZ(r.team) - r.z) * r.vz;
    if ((r.cutT > 0 || r.cutUser > 0) && distHoop(lx, lz, r.team) < 13 && toRim > 0 && hyp(r.vx, r.vz) > 7 && r.r.dunk + r.r.vert > 125 && nearestDef(r).d > 3.5 && rand() < (r.isUser ? 0.8 : 0.3) * (0.5 + p.r.pass / 200)) {
      b.lob = true; b.bounce = false; p.pose = 'lobPass';
      b.ex = clamp(lx * 0.5, -6, 6); b.ez = hoopZ(r.team) - dirOf(r.team) * 3; b.ey = 11.2;
      b.dur = hyp(b.ex - p.x, b.ez - p.z) / 34 + 0.35; b.apex = 4.5; b.passT = G.t + b.dur;
      r.oopT = b.dur + 0.4;
    }
    /* now and then a pass sails: high, behind him, off his hands */
    if (!p.isUser && rand() < clamp(0.018 + (62 - p.r.pass) * 0.0006, 0.006, 0.04)) { const a = rand() * 6.28, m = rr(6, 11); b.ex = clamp(b.ex + Math.sin(a) * m, -26, 26); b.ez = clamp(b.ez + Math.cos(a) * m, -48, 48); b.ey += 2; b.wild = true; }
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
      if (p.isUser) ch *= off < 1.1 ? 0.8 : 0.35;   // your pass is picked by a man standing in its path, rarely by one a step to the side
      if (rand() < ch) { b.pick = { who: o, f: t / L }; break; }
    }
    r.wantBall = 1.2;
  }
  function passObstruction(p, dx, dz, length) {
    let blocked = 0;
    for (const o of G.pl) {
      if (o.team === p.team) continue;
      const rx = o.x - p.x, rz = o.z - p.z, along = (rx * dx + rz * dz) / length;
      if (along < 3 || along > length - 2) continue;
      const across = Math.abs(rx * dz - rz * dx) / length;
      blocked = Math.max(blocked, 1 - across / 1.6);
    }
    return blocked;
  }
  function entryOpen(p, r) {
    const dx = r.x - p.x, dz = r.z - p.z, length = hyp(dx, dz);
    return length > 3 && length < 36 && passObstruction(p, dx, dz, length) < 0.35;
  }
  function postTarget(handler, P) {
    if (P && P.def && P.def.who !== undefined) return playWho(P, handler.team, handler);
    let best = null;
    for (const o of G.pl) {
      if (o.team !== handler.team || o === handler || o.slot < 3) continue;
      if (!best || o.r.close > best.r.close) best = o;
    }
    return best;
  }
  function bestPass(p, aim) {
    const aimLength = aim ? hyp(aim.x, aim.z) : 0;
    let best = null, bs = -1e9;
    const over = along(p.z, p.team) < RIM;   // over half court: never back to a trailer behind it
    for (const r of teamOf(p.team)) {
      if (r === p || (over && along(r.z, r.team) > RIM - 1.5)) continue;
      const dx = r.x - p.x, dz = r.z - p.z, L = hyp(dx, dz) || 1;
      const open = Math.min(nearestDef(r).d, 9);
      let s = open * 0.8 - L * 0.03 + (distHoop(r.x, r.z, p.team) < 12 ? 1.5 : 0) + (r.cutUser > 0 ? 2.5 : 0);
      /* a man standing in the passing lane makes that teammate a worse choice */
      s -= 3 * passObstruction(p, dx, dz, L);
      /* bringing it up is the point guard's job: the computer does not hand the ball to you in the backcourt unless you
         play the point (a new player standing still there was given it, and whistled for eight seconds, trip after trip) */
      if (r.isUser && !G.auto && !p.isUser && r.slot !== 0 && along(r.z, r.team) > RIM - 1.5) s -= 8;
      /* with the stick held, the pass goes where the stick points: the teammate nearest that line, and nobody behind you */
      if (aimLength) {
        const alignment = (dx * aim.x + dz * aim.z) / (L * aimLength);
        s = alignment > 0.3 ? s * 0.35 + alignment * alignment * 22 : s - 30;
      }
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
    if (G.half && G.clr === p.team) {   // the blacktop: take it back past the arc before anything else
      p.drive = 0; delete p.post; const c = toCourt(p.team, clamp(p.x * 0.6, -14, 14), 25.5); p.tx = c.x; p.tz = c.z;
      if (p.think > 0) return; p.think = 0.3;
      const r = teamOf(p.team).find(o => o !== p && distHoop(o.x, o.z, o.team) > 23 && nearestDef(o).d > 5); if (r && p.hold > 0.6 && rand() < 0.4) passTo(p, r);
      return; }
    // Start the shooting motion before time expires, including from the backcourt.
    if (Math.min(G.clock, G.shotClock) < 1.6) { startShot(p); return; }
    /* the play you called */
    const P = G.phase === 'live' && !p.inb ? playOf(p.team) : null;
    if (P && along(p.z, p.team) < RIM - 2) {
      const u = playWho(P, p.team, p), D = P.def || NOPLAY;
      /* the play is for somebody: the ball goes to him first */
      if ((P.kind === 'iso' || P.kind === 'screen' || (D.who !== undefined && (P.kind === 'pnr' || P.kind === 'pnp' || P.kind === 'drive'))) && u && u !== p && p.hold > 0.35 && nearestDef(u).d > 2.4 && entryOpen(p, u)) { passTo(p, u); return; }
      if (P.kind === 'post') {
        const big = postTarget(p, P);
        if (big === p) { const dh = distHoop(p.x, p.z, p.team); if (p.post === undefined && p.hold > 0.4 && dh < 16 && dh > 6.5) p.post = 1.8 + rand(); }   // it is his own post-up: he backs his man down
        else if (p.think <= 0 && (D.who !== undefined || p.slot < 3) && p.hold > 0.5 && big && distHoop(big.x, big.z, p.team) < 17 && nearestDef(big).d > 1.8 && entryOpen(p, big)) {
          passTo(p, big); return;
        }
      }
      /* give and go (and a cut called for the man with the ball): pass it, cut, and look for it back */
      if ((P.kind === 'gng' || (P.kind === 'cut' && u === p)) && !P.done && p.hold > 0.5 && p.think <= 0) {
        const r = bestPass(p); if (r && nearestDef(r).d > 3) { P.done = true; passTo(p, r); p.cutT = 2.4; p.cut = 6; return; }
      }
      /* the shooter has come free: it goes to him, and he lets it go */
      if (P.kind === 'shoot' && u && u !== p && p.think <= 0 && p.hold > 0.4 && nearestDef(u).d > 4 && distHoop(u.x, u.z, p.team) < 27 && entryOpen(p, u)) { u.playShot = G.t; passTo(p, u); return; }
      /* the handoff: the wing arrives, takes it, and goes */
      if (P.kind === 'hand' && !P.done && !(P.cd > G.t) && u && u !== p && p.hold > 0.5 && hyp(u.x - p.x, u.z - p.z) < 6.5) { P.done = !D.again; P.cd = G.t + 1.6; passTo(p, u); if ((!u.isUser || G.auto) && !D.again) u.driveNext = G.t + 1; return; }
      /* a cutter open at the rim */
      if ((P.kind === 'cut' || P.kind === 'gng') && p.think <= 0 && p.hold > 0.3) {
        const c = teamOf(p.team).find(o => o !== p && (o.cutT > 0 || o.cutUser > 0) && distHoop(o.x, o.z, p.team) < 11 && nearestDef(o).d > 3.2 && entryOpen(p, o));
        if (c) { c.playShot = G.t; passTo(p, c); return; }
      }
      /* the big has popped out behind the screen */
      if (P.kind === 'pnp' && p.think <= 0) {
        const pop = teamOf(p.team).find(o => o.screenFor === p && o.screen > 0 && o.screen <= 1.4 && nearestDef(o).d > 4.5 && entryOpen(p, o));
        if (pop) { pop.playShot = G.t; passTo(p, pop); return; }
      }
    }
    if (p.driveNext) { if (G.t < p.driveNext && lane(p) > 2) p.drive = 1.5; delete p.driveNext; }

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
    p.think = 0.23 + rand() * 0.1;
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
    /* a play called for him a moment ago: open, he shoots it on the catch */
    if (p.playShot) { if (G.t - p.playShot > 1.3) delete p.playShot; else if (p.hold > 0.16 && (d < 6 ? nd > 2 : nd > 3.4 && ev > 0.8 && !(three && p.r.three < 58))) { delete p.playShot; startShot(p); return; } }
    /* slow it down: nothing until the shot clock is under nine, unless it is a layup */
    if (pSlow(P) && G.shotClock > 9 && !(d < 5 && nd > 4)) { p.drive = 0; p.tx = 0; p.tz = hoopZ(p.team) - dirOf(p.team) * 29; return; }
    if (P && (pFast(P) || P.kind === 'drive' || P.kind === 'five' || (P.kind === 'iso' && P.def && P.def.who !== undefined)) && p.drive <= 0 && p.hold > 0.25 && d < 32 && d > 8 && lane(p) > (pFast(P) ? 3 : 2.6) && rand() < 0.5) { p.drive = 1.6; return; }
    /* the last shot: shot clock off, the quarter's clock running down: hold it, then go with about six seconds left */
    if ((G.q < 4 || G.score[p.team] >= G.score[1 - p.team]) && G.clock < G.shotClock && G.clock > 6.5 && !(d < 5 && nd > 4)) { p.tx = 0; p.tz = hoopZ(p.team) - dirOf(p.team) * 28; return; }
    if (G.clock < G.shotClock && G.clock <= 6.5 && G.clock > 1.2 && p.drive <= 0 && lane(p) > 3) p.drive = 1.4;
    const roller = G.pl.find(o => o.team === p.team && o.screenFor === p && o.screen > 0 && o.screen <= 1.4);
    if (roller && d > 9 && distHoop(roller.x, roller.z, p.team) < 12 && nearestDef(roller).d > 3 && entryOpen(p, roller)) {
      passTo(p, roller); return;
    }
    if (G.shotClock < 2.5 || (d < 5.5 && p.hold > 0.15)) { startShot(p); return; }
    const need = ((p.team === 1 ? G.diff.oppShootEV : 0.98) - (three ? 0.01 : 0)) * (pFast(P) ? 0.94 : 1);
    /* your pass found him open: he lets it fly on the catch instead of holding it until his man recovers */
    const userAssist = p.caughtFrom && p.caughtFrom.isUser && !G.auto;
    if (p.caughtFrom && G.t - p.caughtT < 0.9 && p.hold > 0.16 && nd > (userAssist ? 4.2 : 7)
      && d < 27 && ev > need * (userAssist ? 0.9 : 1.08) && !(three && p.r.three < 62)) { p.caughtFrom = null; startShot(p); return; }
    /* drive and kick: the lane has closed on a driver, and a teammate stands open: the ball goes out to him (or down to the big on the baseline) */
    if (p.drive > 0 && d < 15 && d > 5 && p.hold > 0.35 && lane(p) < 1.8 && rand() < (P && P.kind === 'drive' ? 0.85 : 0.4)) {
      const r = bestPass(p); if (r && nearestDef(r).d > 6 && (distHoop(r.x, r.z, p.team) < 8 || r.r.three >= 68 || r.isUser)) { p.drive = 0; tally('kick'); passTo(p, r); return; }
    }
    if (p.hold > 0.5 && ev > need && nd > 4.2 && rand() < 0.62) { startShot(p); return; }
    /* with you on him he may show the ball first: jump at the fake and he goes by you or shoots over you coming down */
    { const u = G.user; if (u && !G.auto && u.team !== p.team && d > 9 && p.hold > 0.7 && !(p.fakeCd > G.t) && u.y === 0 && hyp(u.x - p.x, u.z - p.z) < 5 && rand() < 0.004) { p.fakeT = G.t; p.fakeCd = G.t + 6; p.hold = 0.45; return; } }
    if (p.hold > 0.9 && ev > need * 1.08 && nd > 3.2 && rand() < 0.35) { startShot(p); return; }
    /* bigs on the block back their man down, then turn for the hook */
    if (p.slot >= 3 && !three && d > 5 && d < 16 && p.post === undefined && p.hold > 0.6 && p.r.close >= 60 && rand() < 0.065) { p.post = 1.6 + rand(); return; }
    if (p.post !== undefined && (p.post <= 0 || d < 7.5)) { delete p.post; startShot(p, false, 'hook'); return; }
    if (p.hold > 0.5 && d < 10 && q > 0.48 && rand() < 0.7) { startShot(p); return; }
    if (p.hold > 0.4 && p.drive <= 0 && d < 30 && lane(p) > 3.5 && rand() < 0.28 + (p.r.close + p.r.dunk + p.r.handle) / 99 / 5) { p.drive = 1.6; return; }
    const pr = p.hold > 3.2 ? 0.6 : p.hold > 1 ? 0.32 : 0.07;
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
        if (def.isUser) { grade(-1, 'Got crossed'); toast('Crossed up', 'opp'); powAt('?', def, 0.8, true, 1.6); AU().crowd.react('ooh', 0.8); }
        if (rand() < 0.15) ankles(def);
      }
    }
  }
  function spotOf(p) {
    const s = SPOTS[p.slot][p.spot % SPOTS[p.slot].length];
    let x = s[0], d = s[1];
    /* the floor shrinks toward the ball a little */
    const bh = G.ball.holder, P = playOf(p.team), D = P && P.def || NOPLAY, F = D.f && FORM[D.f], mine = bh && bh.team === p.team, wide = P && !F && (P.kind === 'five' || P.kind === 'drive');
    if (p.cutT > 0 && !wide) { x = p.slot === 4 ? -s[0] * 0.5 : Math.sign(s[0] || 1) * 3; d = 4; }
    if (bh && bh.team === p.team && bh !== p) x += clamp(bh.x * 0.15, -3, 3);
    /* the play called for you: everyone else clears out to the corners and the wings */
    if (P && P.kind === 'iso' && !F && mine && bh !== p && bh === playWho(P, p.team, bh)) { const k = [[-22, 3], [22, 3], [-17, 21], [17, 21], [0, 26]][p.slot]; x = k[0]; d = k[1]; }
    /* five out: everybody behind the line. Drive and kick: the same, with the center on the baseline by the rim */
    if (wide && bh && bh.team === p.team) { const k = [[0, 27], [-17.5, 21.5], [17.5, 21.5], [-22.5, 3.5], P.kind === 'drive' ? [6.5, 3.5] : [22.5, 3.5]][p.slot]; x = k[0]; d = k[1]; }
    /* slow it down: stand high and wide while the clock runs */
    if (P && P.kind === 'slow' && !F && G.shotClock > 9 && mine) { const k = [[0, 30], [-19, 23], [19, 23], [-22, 6], [8, 14]][p.slot]; x = k[0]; d = k[1]; }
    /* the play's formation, and the spot of the man it is for */
    if (F && mine && !(p.cutT > 0)) { x = F[p.slot][0]; d = F[p.slot][1]; }
    if (D.at && mine && !(p.cutT > 0) && p === playWho(P, p.team, bh)) { x = D.at[0]; d = D.at[1]; }
    /* in transition, run with the play */
    const c = toCourt(p.team, x, d);
    return c;
  }
  /* The pick-and-roll: now and then the big walks up and sets a screen on the ball handler's man. A defender who runs
     into it is caught for a moment; the handler turns the corner and the big rolls to the rim. */
  function screenAI(p, dt) {
    const h = G.ball.holder;
    if (!h || h.team !== p.team || h === p) return false;
    const P = playOf(p.team), pick = P && (P.kind === 'pnr' || P.kind === 'pnp'), D = P && P.def || NOPLAY;
    if (P && !pick && !(p.pickUntil > G.t && p.screenFor === h && p.screen > 0)) { p.screen = 0; return false; }
    if (p.screenFor && p.screenFor !== h) p.screen = 0;
    if (p.screen === undefined) p.screen = 0;
    /* the pick-and-roll you called: the best big comes up to set it once each trip */
    if (pick && !P.done && along(h.z, p.team) < 32 && (D.who === undefined || h === playWho(P, p.team, h))) {
      if (playScr(P, p.team, h, null) === p) { p.screen = D.slip ? 2.1 : 3.2; P.done = true; }
    }
    p.screen -= dt;
    if (p.screen <= 0) {
      if (p.slot === 4 && along(h.z, p.team) > 18 && along(h.z, p.team) < 34 && G.shotClock > 6 && rand() < dt * 0.25) p.screen = 3.2;
      else return false;
    }
    p.screenFor = h;
    const d = G.pl.find(o => o.team !== p.team && o.slot === h.slot);
    if (!d) return false;
    if (p.screen > 1.4) {
      /* set it: on the defender's hip, on the side away from the rim's middle */
      const side = h.x > 0 ? -1 : 1;
      p.tx = d.x + side * 2.2; p.tz = d.z + dirOf(p.team) * 0.4;
      if (hyp(d.x - p.x, d.z - p.z) < 2.8 && !d.isUser && d.stun <= 0 && p.screen < 2.6) {
        d.stun = 0.55 * (1.2 - d.r.perD / 160); p.screen = 1.4;
        /* the screener's man switches onto the ball for a moment */
        const sw = G.pl.find(o => o.team !== p.team && o.slot === p.slot); if (sw && !sw.isUser) {
          sw.switchOn = h; d.switchOn = p;
          sw.switchUntil = d.switchUntil = G.t + 1.8;
          sw.switchPoss = d.switchPoss = G.possN;
        }
        if (!h.isUser && lane(h) > 2.5) h.drive = 1.4;
        if (h.isUser || rand() < 0.15) B('pick_ana', { prio: 1 });
        if (rand() < 0.6) { if (sw && !sw.isUser && rand() < 0.5) CH('ch_switch', sw); else CH('ch_screen', d); }
      }
    } else if (P && P.kind === 'pnp') { const c = toCourt(p.team, (h.x > 0 ? -1 : 1) * 9, p.r.three >= 62 ? 25.5 : 17); p.tx = c.x; p.tz = c.z; }   // the pop
    else { p.tx = 0; p.tz = hoopZ(p.team) - dirOf(p.team) * 5; }   // the roll
    return true;
  }
  function offBallAI(p, dt) {
    const holder = G.ball.holder;
    const P = holder && holder.team === p.team ? playOf(p.team) : null, D = P && P.def || NOPLAY;
    const stay = () => { const spot = spotOf(p); p.tx = spot.x; p.tz = spot.z; p.screen = 0; if (G.ball.state === 'pass' && G.ball.to === p) { p.tx = G.ball.ex; p.tz = G.ball.ez; } };
    if (P && !(p.pickUntil > G.t && p.screenFor === holder && p.screen > 0) && along(holder.z, p.team) < RIM - 2) {
      const who = playWho(P, p.team, holder), pick = P.kind === 'pnr' || P.kind === 'pnp';
      if (P.kind === 'iso' && holder === who) { stay(); return; }
      if (P.kind === 'post' && (D.who !== undefined || holder.slot < 3) && p === postTarget(holder, P)) {
        const side = Math.abs(holder.x) > 3 ? Math.sign(holder.x) : Math.sign(p.x) || 1;
        const block = D.at ? toCourt(p.team, D.at[0], D.at[1]) : toCourt(p.team, side * 7, 6);
        p.tx = block.x; p.tz = block.z; p.screen = 0; return;
      }
      if (P.kind === 'five' || P.kind === 'drive' || P.kind === 'set' || (pSlow(P) && G.shotClock > 9)) {
        if (!attacking(holder)) { stay(); return; }
      }
      /* the handoff: the wing runs to the ball, just outside the handler's shoulder */
      if (P.kind === 'hand' && !P.done && !(P.cd > G.t) && p === who && along(holder.z, p.team) < 36) {
        const sd = Math.sign(p.x - holder.x) || 1; p.tx = holder.x + sd * 2.6; p.tz = holder.z - dirOf(p.team) * 1.5; p.screen = 0;
        if (holder.isUser && !G.auto && hyp(p.x - holder.x, p.z - holder.z) < 4.5 && (P.near = (P.near || 0) + dt) > 1.6) P.done = true;   // you kept it: he goes back to his spot
        return;
      }
      /* a screen away from the ball (screen for me, a pin-down, a flare): the screener walks into the man guarding
         the one the play is for; caught on it, that defender is a step behind */
      if ((P.kind === 'screen' || (P.kind === 'shoot' && D.scr !== undefined)) && !P.done && who && who !== holder && who !== p) {
        const dm = G.pl.find(o => o.team !== p.team && o.slot === who.slot);
        if (dm && playScr(P, p.team, holder, who) === p) {
          p.tx = dm.x + (dm.x - who.x) * 0.2; p.tz = dm.z + (dm.z - who.z) * 0.2 + dirOf(p.team) * 1.2; p.screen = 0;
          if (hyp(dm.x - p.x, dm.z - p.z) < 2.8) { P.done = true; if (!dm.isUser && dm.stun <= 0) dm.stun = 0.8 * (1.2 - dm.r.perD / 160); if (who.isUser && !G.auto) toast('You are free', 'call'); CH('ch_screen', dm); }
          return;
        }
      }
      /* a cut called for one man: he goes once the ball has settled */
      if (P.kind === 'cut' && D.who !== undefined && p === who && !P.done && (holder.hold || 0) > 0.5) { P.done = true; p.cutT = 2.4; p.cut = 6; }
      /* the man a play sends to a spot goes there and waits for it */
      if (D.at && p === who && !(p.cutT > 0) && P.kind !== 'cut') { stay(); return; }
      /* everyone else holds the formation (until somebody drives: then the usual spacing takes over) */
      if (D.f && !(p.cutT > 0) && !attacking(holder) && !(P.kind === 'cut' && D.who === undefined) && !(pick && (p.screen > 0 || (!P.done && playScr(P, p.team, holder, null) === p)))) { stay(); return; }
    }
    if (screenAI(p, dt)) return;
    p.cut -= dt; p.cutT -= dt;
    if (p.cut < 0) {
      p.cut = rr(4, 9);
      if (P && P.kind === 'cut' && D.who === undefined) { p.cut = rr(3, 6); p.cutT = rr(1.3, 2); }
      else if (P && P.kind === 'shoot' && p === playWho(P, p.team, holder)) { p.cut = rr(1.3, 2.2); p.spot = (p.spot + 1 + Math.floor(rand() * 2)) % 3; }
      else if (rand() < 0.45) p.cutT = rr(1.2, 2); else p.spot = (p.spot + 1 + Math.floor(rand() * 2)) % 3;
    }
    const s = spotOf(p);
    p.tx = s.x; p.tz = s.z;
    const b = G.ball;
    /* on the break the wings fill the lanes: wide and ahead of the ball, toward the corners */
    const h = b.holder;
    if (h && h.team === p.team && h.drive > 0 && G.t < (G.breakUntil || 0) && along(h.z, p.team) > 10 && p.slot !== 4) { const c = toCourt(p.team, (p.slot % 2 ? 1 : -1) * 20, Math.max(4, along(h.z, p.team) - 12)); p.tx = c.x; p.tz = c.z; }
    /* a teammate is going at the rim: get out of his way and give him somewhere to throw it. The big man slides to
       the baseline on the far side of the drive (the dump-off), everyone else spaces to the corners and the wings,
       each to the nearest spot nobody has taken (they used to stand where they were, and the help had no one to leave) */
    if (h && h.team === p.team && h !== p && attacking(h) && distHoop(h.x, h.z, h.team) < 24 && !(G.t < (G.breakUntil || 0))) {
      if (p.slot === 4) { const c = toCourt(p.team, h.x >= 0 ? -6.5 : 6.5, 3.5); p.tx = c.x; p.tz = c.z; }
      else {
        const K = G.kick && G.kick.n === G.possN && G.t - G.kick.t < 0.5 && G.kick.team === p.team ? G.kick : (G.kick = { n: G.possN, t: G.t, team: p.team, map: new Map() });
        if (!K.map.size) { const free = [[-21.5, 5], [21.5, 5], [-16.5, 21], [16.5, 21], [0, 26.5]].map(k => toCourt(p.team, k[0], k[1])).filter(c => hyp(c.x - h.x, c.z - h.z) > 9);
          for (const m of teamOf(p.team).filter(o => o !== h && o.slot !== 4).sort((a, c) => a.slot - c.slot)) { let bi = -1, bd = 1e9; free.forEach((c, i) => { const d = hyp(c.x - m.x, c.z - m.z); if (d < bd) { bd = d; bi = i; } }); if (bi >= 0) { K.map.set(m, free[bi]); free.splice(bi, 1); } } }
        const c = K.map.get(p); if (c) { p.tx = c.x; p.tz = c.z; }
      }
    }
    /* covered while a teammate looks for someone: a few steps along the arc, away from his man, to get open */
    else if (h && h.team === p.team && h !== p && !(p.cutT > 0) && (h.hold || 0) > 1.2 && p.slot !== 4) {
      if (p.reloT > 0) { p.reloT -= dt; p.tx += p.reloX; p.tz += p.reloZ; }
      else if ((p.reloCd = (p.reloCd || 0) - dt) <= 0) { const nd = nearestDef(p);
        if (nd.who && nd.d < 3.6) { const hx = 0 - p.x, hz = hoopZ(p.team) - p.z, L = hyp(hx, hz) || 1, side = ((nd.who.x - p.x) * -hz + (nd.who.z - p.z) * hx) > 0 ? -1 : 1;
          p.reloX = -hz / L * side * 6; p.reloZ = hx / L * side * 6; p.reloT = 1.6; p.reloCd = 4 + rand() * 3; } }
    }
    if (b.state === 'pass' && b.to === p) { p.tx = b.ex; p.tz = b.ez; }
  }
  /* a hand on a driver, a bump in the lane: a non-shooting foul. The fifth team foul of a quarter puts the other
     side in the bonus: every foul after it is two free throws. */
  /* six fouls and you are done for the night: the rest of the game is played out */
  function checkFoulOut(p) {
    if (!p || !p.isUser || G.switching || G.drill || G.half || G.fouledOut) return;
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
    for (const t of [0, 1]) { const str = ((opts.strength && opts.strength[t]) || 75), pts = Math.max(0, Math.round(poss / 2 * (1.08 + (str - 75) * 0.012) + PB.gauss() * 1.2)); G.score[t] += pts; spread(t, pts, left, false); }
    (G.satQ = G.satQ || []).push(G.q); G.sitQ = 0;
    if (G.inb) { G.inb.p.inb = false; G.inb = null; }
    toast('Foul trouble: you sit', 'opp'); B('sit', { prio: 4 }); feed(`Foul trouble · you sit the rest of the ${['', '1st', '2nd', '3rd'][G.q]} quarter`);
    G.clock = 0; endPeriod();
    setTimeout(() => { if (PB.Game.active && G) toast('You check back in', 'call'); }, 3200);
  }
  function contactFoul(def, off) {
    if (R.refSignal) R.refSignal('sigf', 1.4);   // the fist goes up
    def.st.pf++; def.celebK = 'call'; def.celebT = 1.5;   // a hand up: that one is on him
    G.tf[def.team]++;
    checkFoulOut(def);
    AU().play('whistle'); B('foul', { prio: 2 });
    feed(`Foul · ${def.name}${G.tf[def.team] >= 5 ? ' (bonus)' : ''}`);
    if (def.isUser) grade(-1, 'Foul');
    for (const o of G.pl) { o.shoot = null; o.drive = 0; }
    if (G.tf[def.team] >= 5 && !G.half) { G.ftq = { shooter: off, n: 2, total: 2 }; dead(1.0, startFT); }
    else { G.poss = null; dead(0.9, () => { give(off); G.shotClock = Math.max(G.shotClock, 14); }); }
  }
  /* going at the rim: the computer's drive, or you with the ball coming downhill inside 20 feet (or already up for a layup or a dunk).
     The help, the bump and the charge used to answer only the computer's drives: nobody ever stepped in front of yours. */
  function attacking(h) {
    if (!h) return false;
    if (h.drive > 0) return true;
    if (!h.isUser || G.auto || G.ball.holder !== h) return false;
    if (h.shoot) return h.shoot.kind !== 'jumper';
    const d = distHoop(h.x, h.z, h.team);
    return d < 20 && hyp(h.vx, h.vz) > maxSpeed(h) * 0.5 && (0 - h.x) * h.vx + (hoopZ(h.team) - h.z) * h.vz > 0;
  }
  function defAI(p, dt) {
    const offT = 1 - p.team;
    if (p.helping > 0) p.helping -= dt * 0.1;   // slow on purpose: one "help!" from a man every several seconds
    let man = p.switchUntil > G.t && p.switchPoss === G.possN && G.pl.includes(p.switchOn) ? p.switchOn : G.pl.find(o => o.team === offT && o.slot === p.slot);
    /* help: a driver who has beaten his man into the paint draws the nearest defender, who steps in front of him */
    const drv = G.ball.holder;
    if (!p.isUser && drv && drv.team === offT && drv !== man && attacking(drv) && distHoop(drv.x, drv.z, offT) < 15) {
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
    /* the rim protector: with the ball coming downhill at the basket, the big man leaves his own man and stands in the
       lane between the ball and the rim, so a drive ends against a body and not at an empty basket */
    if (!p.isUser && p.slot === 4 && drv && drv.isUser && !G.auto && drv.team === offT && drv !== man && G.phase === 'live' && attacking(drv) && distHoop(drv.x, drv.z, offT) < 19 && p.contestT === undefined) {
      const hz = hoopZ(offT), dx = drv.x - 0, dz = drv.z - hz, L = hyp(dx, dz) || 1, out = Math.min(4.5, L * 0.5);
      p.tx = dx / L * out; p.tz = hz + dz / L * out; p.pose = 'guard'; p.protT = G.t;
      return;
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
    const DD = dplayOf(p.team), st = DD.dbl === 'star' || DD.deny || DD.one ? star(offT) : null;
    /* a called double or trap: the nearest man who is not guarding the ball leaves his own and goes at the handler */
    if (DD.dbl && !p.isUser && hh && hh.team === offT && man !== hh && G.phase === 'live' && !hh.shoot) {
      const dh = distHoop(hh.x, hh.z, offT);
      if (DD.dbl === 'all' ? dh < 30 : DD.dbl === 'star' ? hh === st && dh < 30 : DD.dbl === 'trap' ? dh > 22 && dh < 50 : true) {
        let near = null, nd = 1e9;
        for (const o of G.pl) if (o.team === p.team && !o.isUser && o.slot !== hh.slot) { const d = hyp(o.x - hh.x, o.z - hh.z); if (d < nd) { nd = d; near = o; } }
        if (near === p && nd < 24) { const dx = H.x - hh.x, dz = H.z - hh.z, L = hyp(dx, dz) || 1, sd = hh.x > 0 ? -1 : 1; p.tx = hh.x + dx / L * 2.2 + sd * 1.8; p.tz = hh.z + dz / L * 2.2; p.pose = 'guard'; return; }
      }
    }
    /* a zone: each man has a piece of the floor that leans toward the ball; the one nearest the ball takes it.
       Box and one: four in the zone, and the fifth stays man to man on their scorer */
    let zs = null;
    if (DD.zone && !p.isUser && !(DD.one && st && p.slot === st.slot) && b.state !== 'shot') {
      const mates = teamOf(p.team).filter(o => !(DD.one && st && o.slot === st.slot)).sort((a, c) => a.slot - c.slot), Z = ZONES[DD.zone], i = mates.indexOf(p);
      if (i >= 0 && Z[i]) {
        zs = toCourt(offT, Z[i][0], Z[i][1]); zs.x += clamp(bx - zs.x, -8, 8) * 0.35; zs.z += clamp(bz - zs.z, -6, 6) * 0.25;
        if (hh && hh.team === offT && distHoop(hh.x, hh.z, offT) < 28) {
          let near = null, nd = 1e9; for (const o of mates) if (!o.isUser) { const d = hyp(o.x - hh.x, o.z - hh.z); if (d < nd) { nd = d; near = o; } }
          if (near === p) { man = hh; zs = null; }
        }
      }
    }
    if (zs) { p.tx = zs.x; p.tz = zs.z; p.pose = ''; if (G.phase === 'live') p.offD = G.t; }
    else if (man === b.holder) {
      /* he guards where the ball is going, not where it was: a good defender reads the first step and is already
         sliding there (he used to aim at the dribbler's feet, a step late on every drive) */
      const lead = p.isUser || p.stun > 0 || !man.isUser || G.auto ? 0 : 0.12 + p.r.perD / 99 * 0.2, mx = man.x + man.vx * lead, mz = man.z + man.vz * lead;
      const dx = H.x - mx, dz = H.z - mz, L = hyp(dx, dz) || 1;
      const gap = clamp(3.2 + (L > 28 && !DD.press ? (L - 28) * 0.3 : 0), 3, 9) * (1.12 - p.r.perD / 400) * (p.isUser ? 1 : DD.on || 1);
      p.tx = mx + dx / L * gap; p.tz = mz + dz / L * gap;
      p.pose = 'guard';
      /* down by a few with the clock running out: foul to stop it */
      const behind = G.score[1 - p.team] - G.score[p.team];
      if (!p.isUser && G.q >= 4 && G.clock < 40 && G.clock > 2 && behind >= 3 && behind <= 9 && hyp(man.x - p.x, man.z - p.z) < 3.5 && G.phase === 'live' && !man.shoot && rand() < dt * 2) {
        G.tf[p.team] = Math.max(G.tf[p.team], 5);   // late in a quarter every team is in the penalty
        toast('Foul to stop the clock', ''); contactFoul(p, man); return;
      }
      if (!p.isUser && (man.drive > 0 || attacking(man) && !man.shoot) && hyp(man.x - p.x, man.z - p.z) < 2.6 && G.phase === 'live' && rand() < dt * (man.drive > 0 ? 1.05 : 0.45) * (1.3 - p.r.perD / 140) * (DD.foul || 1)) { contactFoul(p, man); return; }
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
        const ch = clamp(0.02 + (p.r.steal - man.r.handle) * 0.0012, 0.005, 0.06) * G.diff.oppSteal * (man.move > 0 ? 1.6 : 1) * (DD.steal || 1);
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
      const off = p.isUser ? '' : DD.deny && man === st ? 'deny' : DD.off3 ? (L > 21 ? 'tight' : '') : DD.off || '';
      const gap = off === 'deny' ? 2.3 : off === 'tight' ? clamp(2.6 + db * 0.07, 2.6, 6) : off === 'sag' ? clamp(5.5 + db * 0.26, 5.5, 15) : clamp(3.5 + db * 0.18, 3.5, 11);
      let tx = man.x + dx / L * gap, tz = man.z + dz / L * gap;
      tx += (bx - tx) * (off === 'sag' ? 0.26 : off === 'deny' ? 0.05 : 0.18); tz += (bz - tz) * (off === 'deny' ? 0.04 : 0.12);
      /* wall the rim: the five stays in the lane, between the ball and the basket */
      if (DD.wall && p.slot === 4 && !p.isUser) { const c = toCourt(offT, clamp(bx * 0.2, -3, 3), 4.5); tx = c.x; tz = c.z; }
      p.tx = tx; p.tz = tz; p.pose = '';
      if (L < 32 && G.phase === 'live' && b.state !== 'shot') p.offD = G.t;   // off the ball in the half court: down in a stance, seeing ball and man (the look only: it is not the on-ball stance that stops a drive)
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
    const max = maxSpeed(p) * (speedMul || 1) * (p.stun > 0 ? 0.25 : 1) * (p.move > 0 ? 1.45 : 1) * (p.burstT > G.t ? 1.14 : 1);
    let vx = wantX, vz = wantZ;
    const L = hyp(vx, vz);
    if (L > max) { vx *= max / L; vz *= max / L; }
    p.wvx = vx; p.wvz = vz; p.wvT = G.t;   // where he means to go (the dribble is pushed that way, ahead of his feet)
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
      else if (!passingPose(u.pose)) u.pose = '';
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
    if (mv && !h.mv.idle) return mv === 'cross' || mv === 'legs' || mv === 'hesi' ? 1 : 0;
    return ((d.x - h.x) * -Math.cos(h.face) + (d.z - h.z) * Math.sin(h.face)) * (h.dribHand || 1) > 0.6 ? 0.6 : 0;
  }
  /* a badge you own, flashed as it helps: its name and tier on a small chip */
  function badgePop(p, k) {
    const tier = bt(p, k), e = $('#badgepop'); if (!tier || !e || !PB.BADGES) return;
    const b = PB.BADGES.find(x => x.k === k); if (!b) return;
    e.innerHTML = `<i>${'◆'.repeat(tier)}</i>${b.name}`; e.classList.remove('on'); void e.offsetWidth; e.classList.add('on'); clearTimeout(badgePop.h); badgePop.h = setTimeout(() => e.classList.remove('on'), 2200);
  }
  /* a lower-third for a player having a night: his team's color, his name, his line */
  function statPop(p, lead) {
    const e = $('#statpop'); if (!e) return;
    const t = G.teams[p.team], st = p.st;
    /* his face next to his line, drawn the first time he earns one and kept for the game */
    let hd = '';
    if (!(PB.settings && PB.settings.gfx === 'Low') && R.portrait && !PB.noGL) { const H = G.heads || (G.heads = {}); if (!(p.d.id in H)) { const ready = R._shots && R._shots.get([p.d.id || p.name, t.id, p.team, JSON.stringify(p.d.look || '')].join('|'));   // the starting lineups already drew the starters: no second picture, no hitch
        try { H[p.d.id] = ready || R.portrait(p.d, t, 96, { close: true, kitObj: G.kits && G.kits[p.team] }) || ''; } catch (err) { H[p.d.id] = ''; } } hd = H[p.d.id]; }
    e.innerHTML = `${hd ? `<img alt="" src="${hd}" style="background:${t.c1}">` : ''}<i style="background:${t.c1}"></i><div><b>${p.num !== undefined ? '#' + p.num + ' ' : ''}${p.name}</b><span>${lead ? lead + ' · ' : ''}${st.pts} PTS · ${st.fgm}/${st.fga} FG${st.tpa ? ` · ${st.tpm}/${st.tpa} 3PT` : ''}${st.ast >= 3 ? ` · ${st.ast} AST` : ''}</span></div>`;
    e.classList.remove('on'); void e.offsetWidth; e.classList.add('on'); clearTimeout(statPop.h); statPop.h = setTimeout(() => e.classList.remove('on'), 3600);
  }
  function handsUp(u) {
    if (u.y > 0) return;
    const sh = G.pl.find(o => o.team !== u.team && o.shoot && o.shoot.kind !== 'dunk');
    if (sh && hyp(sh.x - u.x, sh.z - u.z) < 6) u.pose = 'contest';
  }
  /* H-O-R-S-E: while he shoots, you watch (no jumping at his shot, no reaching for his ball) */
  const sidelined = () => !!(G.horse && G.drill && G.drill.shooter !== G.user);
  function pressA(down) {
    const u = G.user; if (!u || sidelined()) return;
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
        { const h = G.ball.holder; if (h && h.team !== u.team && !h.shoot && h.fakeT !== undefined && G.t - h.fakeT < 0.5 && hyp(h.x - u.x, h.z - u.z) < 6) { toast('You bit on the fake', 'opp'); grade(-0.3, 'Bit on a pump fake'); } }
      }
    } else if (u.shoot && u.shoot.user) {
      if (u.shoot.kind === 'jumper' && u.shoot.t < 0.14 && !G.drill && !(u.fakeCd > G.t) && !(PB.settings && PB.settings.tapShoot === 'Shoot')) pumpFake(u);   // a quick tap is a pump fake
      else release(u, u.shoot.t / u.shoot.T);
    }
  }
  /* a pump fake: the shot is shown and pulled back. A defender who was going up with it may leave his feet (the
     better the defender, and the more fakes in a row, the less he bites); in the air he can do nothing about a drive */
  function pumpFake(p) {
    p.shoot = null; if (p.y > 0 || p.vy > 0) p.vy = -5; p.pose = ''; p.fakeN = p.fakeT !== undefined && G.t - p.fakeT < 5 ? (p.fakeN || 1) + 1 : 1; p.fakeT = G.t; p.fakeCd = G.t + 0.55;
    let bit = null;
    for (const o of G.pl) { if (o.team === p.team || o.contestT === undefined) continue; delete o.contestT;
      if (o.isUser || o.y > 0 || hyp(o.x - p.x, o.z - p.z) > 6.5) continue;
      const ch = clamp(0.62 - (o.r.perD || 60) * 0.005 + ((p.r.three || 60) + (p.r.mid || 60) - 120) * 0.002, 0.12, 0.6) / p.fakeN;
      if (rand() < ch) { o.jg = GRAV * 1.6; o.vy = Math.sqrt(2 * o.jg * (1.5 + o.r.vert * 0.02)); o.pose = 'contest'; o.bitT = G.t; bit = o; } }
    if (p.isUser) { if (bit) { toast(pickOf(['He bit on the fake', 'Got him in the air', 'He jumped at it']), 'make'); { const v = nearestDef(p).who; if (v) powAt('!?', v, 0.8, false, 1.6); } grade(0.3, 'Pump fake'); buzz(10); if (home(p.team)) AU().crowd.react('ooh', 0.5); }
      else { /* the first few times, say what just happened: a tap is a fake, a hold is a shot */
        let n = 0; try { n = +localStorage.getItem('pbb.fakes') || 0; if (n < 5) localStorage.setItem('pbb.fakes', n + 1); } catch (e) { /* fine */ }
        toast(n < 5 ? 'Pump fake · hold Shoot to shoot' : 'Pump fake', 'call'); }
      AU().play('squeak', { x: p.x, vol: 0.5 }); }
  }
  /* icon passing, the pocket way: tap a teammate on the floor and the ball goes to him */
  function tapPass(cx, cy) {
    const u = G && G.user; if (!u || G.paused || G.phase !== 'live' || G.ball.holder !== u || u.shoot || G.drill || !R.toScreen) return false;
    let best = null, bd = 54;
    for (const m of G.pl) { if (m.team !== u.team || m === u) continue; const q = R.toScreen(m.x, m.y + 3.4, m.z); if (!q) continue; const d = Math.hypot(q.x - cx, q.y - cy); if (d < bd) { bd = d; best = m; } }
    if (!best) return false;
    if (u.inb) { u.inb = false; G.inb = null; } passTo(u, best); buzz(8); return true;
  }
  function pressB() {
    const u = G.user; if (!u || G.phase !== 'live' || sidelined()) return;
    const b = G.ball;
    if (b.holder === u) {
      if (u.shoot) return;
      const r = bestPass(u, stickWorld());
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
        u.st.stl++; h.st.tov++; grade(3, 'Steal'); buzz(25); toast('STOLEN', 'make'); badgePop(u, 'pick'); feed(`Steal · ${u.name}`); give(u);
        if (R.pow) R.pow('STEAL!', u.x, 5.2, u.z, 0.9);
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
    const u = G.user; if (!u || G.phase !== 'live' || u.inb || sidelined()) return;
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
        dx = -hx / hl; dz = -hz / hl; sp = maxSpeed(u) * 1.25; u.move = 0.3; u.moveCd = 0.8; u.stepT = G.t; shake = 0.12; lbl = 'Step-back'; startMv(u, 'hesi', u.dribHand || 1, u.dribHand || 1);
      } else if (kind === 'spin') {
        /* a spin: around the defender and on toward the rim */
        const side = rand() < 0.5 ? 1 : -1;
        dx = hx / hl * 0.8 + Bs.rx * side * 0.6; dz = hz / hl * 0.8 + Bs.rz * side * 0.6; u.move = 0.45; u.moveCd = 0.9; u.spinT = G.t; shake = 0.24; lbl = 'Spin'; startMv(u, 'spin', u.dribHand || 1, u.dribHand || 1, side);
        u.drive = 1.0;
      } else {
        const w = stickWorld();
        if (dir) { dx = Bs.rx * dir + Bs.fx * 0.35; dz = Bs.rz * dir + Bs.fz * 0.35; }
        else if (w) { dx = w.x; dz = w.z; }
        else { const side = rand() < 0.5 ? 1 : -1; dx = Bs.rx * side + Bs.fx * 0.4; dz = Bs.rz * side + Bs.fz * 0.4; }
        u.move = 0.38; u.moveCd = 0.55; lbl = 'Crossover';
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
      /* moves strung together: each one inside a second and a half of the last is harder to stay in front of */
      u.comboN = u.comboT !== undefined && G.t - u.comboT < 1.5 ? Math.min(4, (u.comboN || 1) + 1) : 1; u.comboT = G.t; shake += 0.05 * (u.comboN - 1);
      if (u.comboN >= 2) { toast(`Combo x${u.comboN}`, 'call'); if (R.puff) R.puff(u.x, u.z, 0.9); }
      if (nd.who && nd.d < 6) {
        const ch = clamp(shake + (u.r.handle - nd.who.r.perD) * 0.008, 0.05, 0.62) + 0.05 * bt(u, 'handles') + (tkoOn() ? 0.15 : 0);
        if (rand() < ch) { nd.who.stun = kind === 'spin' ? 0.9 : 0.75; u.st.shake++; u.burstT = G.t + 1.1;   /* past him: a second of extra speed to make it count */ if (rand() < (tkoOn() ? 0.5 : 0.28)) { ankles(nd.who); toast('Ankles!', 'make'); powAt('ANKLES!', nd.who, 1.05, false, 1.5); if (R.burst) R.burst(nd.who.x, 1.2, nd.who.z, 6, 0.6); AU().crowd.react('roar', 1); buzz([20, 40, 20]); } else { toast(kind === 'step' ? pickOf(['Created space', 'Room to shoot', 'Stepped back']) : pickOf(['Shook him', 'Lost him', 'Left him there', 'Got by him']), 'make'); powAt(kind === 'step' ? 'SPACE!' : pickOf(['SHOOK!', 'BYE!', 'LATER!']), nd.who, 0.8); } grade(1, 'Beat your man'); B('shake', { prio: 4 }); AU().crowd.react('ooh', 0.9); }
        else if (kind === 'spin' && rand() < clamp(0.08 + (nd.who.r.steal - u.r.handle) * 0.003, 0.02, 0.18)) {
          /* a spin into a set defender can cost you the ball */
          nd.who.st.stl++; u.st.tov++; grade(-3, 'Lost it on the spin'); toast('Stripped', 'opp'); AU().play('steal', { x: u.x }); give(nd.who); return;
        } else feedMove(lbl);
      } else feedMove(lbl);
      AU().play('squeak', { x: u.x }); if (G.tut) G.tut.moved = true; if (G.park && rand() < 0.5) parkSay('move', 18);
      return;
    }
    const off = b.holder ? b.holder.team === 0 : G.poss === 0;
    if (!off && G.switching) { switchNearest(); return; }
    if (off) { u.cutUser = 1.6; toast('Cutting', 'call'); G.callT = 2; }
  }
  /* a dribble move the body and ball act out: the ball's path from hand to hand (court.js poses the arms from p.mv) */
  const MV_T = { cross: 0.32, btb: 0.4, legs: 0.38, hesi: 0.5, spin: 0.5 };
  /* an ankle-breaker: the beaten defender goes down and needs a moment to get up */
  function ankles(d) { if (!G.replay) G.hitT = 0.07; d.fallT = G.t; d.stun = 1.5; d.vx *= 0.3; d.vz *= 0.3; if (R.shock) R.shock(d.x, d.z, 5); if (R.dizzy) R.dizzy(d, 1.5); }
  function startMv(p, k, a, b, side) {
    const ball = G.ball;
    p.mv = { k, t0: G.t, T: MV_T[k], a, b, side: side || 1, bn: false };
    if (ball.holder === p && k !== 'spin' && k !== 'hesi') {
      p.mv.pickup = { x: ball.x - p.x, y: ball.y, z: ball.z - p.z };
    }
  }
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
  /* plus/minus: every point scored goes to the ten men on the floor, for or against */
  function plusMinus() {
    const L = G.pmLast || (G.pmLast = G.score.slice()), d0 = G.score[0] - L[0], d1 = G.score[1] - L[1];
    if (!d0 && !d1) return;
    for (const p of G.pl) p.st.pm = (p.st.pm || 0) + (p.team === 0 ? d0 - d1 : d1 - d0);
    G.pmLast = G.score.slice();
  }
  function step(dt) {
    if (G && !G.drill) plusMinus();
    G.t += dt;
    /* the game's flow: the margin every few seconds, for the chart after the game */
    if (G.phase === 'live' && !G.drill && G.t - (G.flowT || 0) > 4) { G.flowT = G.t; (G.flow = G.flow || []).push([Math.round((G.q - 1) * G.qlen * 60 + (G.qlen * 60 - G.clock)), G.score[0] - G.score[1]]); }
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
      if (G.tipT < 0.64 && !G.tipJump) { G.tipJump = true; for (const p of G.pl) if (p.slot === 4) { p.jg = GRAV * 1.4; p.vy = Math.sqrt(2 * p.jg * (2.4 + p.r.vert * 0.02)); p.pose = 'contest'; } }
      for (const p of G.pl) if (p.y > 0 || p.vy) { p.y += p.vy * dt; p.vy -= p.jg * dt; if (p.y <= 0) { p.y = 0; p.vy = 0; p.pose = ''; } }
      if (G.tipT <= 0.28) {   // the ball is at their fingertips, the two of them at the top of the jump: one of them gets a hand on it
        const t = rand() < 0.5 ? 0 : 1;
        G.tipWinner = t; G.phase = 'live';
        const pg = teamOf(t).find(o => o.slot === 0);
        /* the winner taps it back to his point guard (the ball used to jump into the guard's hands from mid-air) */
        { const c = teamOf(t).find(o => o.slot === 4); if (c && pg && c !== pg) { give(c); passTo(c, pg); if (b.state !== 'pass') give(pg); else { c.pose = 'contest'; b.pick = null; } } else give(pg); }   // (a tip is not a pass anyone picks off)
        feed(`${G.teams[t].name} win the tip`); AU().play('whistle', { vol: 0.7 }); B('tip', { prio: 1 });
      }
      b.x = 0; b.z = 0; b.y = 7 + Math.max(0, Math.sin((1.3 - G.tipT) * 2.5)) * 6;
      return;
    }
    if (G.phase === 'check') checkStep(dt);
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
      if (!G.inb || !G.inb.stop) { G.clock = Math.max(0, G.clock - dt); if (!G.drill) for (const p of G.pl) p.st.secs = (p.st.secs || 0) + dt; }   // it stops at zero while a shot is still in the air
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
        const t = G.poss; toast('SHOT CLOCK', 'opp'); AU().play('buzzer'); if (R.horn) R.horn(1.2); AU().play('whistle', { delay: 0.5 }); B('shotclock', { prio: 3 });
        turnover(b.holder || b.from, 'Shot clock violation', 1 - t);
      }
      if (G.half && G.clr !== null && G.clr !== undefined && b.state === 'held' && b.holder && b.holder.team === G.clr && distHoop(b.holder.x, b.holder.z, G.clr) > 22.4) { G.clr = null; if (b.holder.isUser) toast('Cleared', ''); }
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
        const tight = nd.who && nd.d < 5.5 ? 1 - Math.max(0, nd.d - 2.5) / 3 : 0;
        // Measure ground travel so leaning on the stick against a defender does not start a speed dribble.
        const vx = p.dribX === undefined ? p.vx : clamp((p.x - p.dribX) / dt, -top, top);
        const vz = p.dribZ === undefined ? p.vz : clamp((p.z - p.dribZ) / dt, -top, top);
        p.dribX = p.x; p.dribZ = p.z;
        const blend = Math.min(1, dt * 12);
        p.dribVX = (p.dribVX || 0) + (vx - (p.dribVX || 0)) * blend;
        p.dribVZ = (p.dribVZ || 0) + (vz - (p.dribVZ || 0)) * blend;
        const speed = hyp(p.dribVX, p.dribVZ);
        const forwardSpeed = (vx * p.dribVX + vz * p.dribVZ) / Math.max(1, speed);
        p.brakeD = clamp((speed - forwardSpeed) / (top * 0.55), 0, 1);
        p.prot = (p.prot || 0) + (tight - (p.prot || 0)) * Math.min(1, dt * 6);
        p.runD = clamp(speed / top, 0, 1) * (1 - p.prot);
        /* the push goes where he is headed: on a cut the stick turns before his feet do, and a ball sent the old way was
           left behind him. And a ball he is running away from comes back up quicker */
        { const fresh = p.wvT !== undefined && G.t - p.wvT < 0.1, wx = fresh ? p.wvx : p.dribVX, wz = fresh ? p.wvz : p.dribVZ;
          p.leadVX = p.dribVX * 0.4 + wx * 0.6; p.leadVZ = p.dribVZ * 0.4 + wz * 0.6;
          { const L = hyp(p.leadVX, p.leadVZ), cap = Math.max(2, speed); if (L > cap) { p.leadVX *= cap / L; p.leadVZ *= cap / L; } }   // (his direction, not a head start: no farther ahead than his feet can follow)
          const gap = b.floorX !== undefined && b.pushCycle !== null && b.pushCycle !== undefined ? hyp(b.floorX - p.x, b.floorZ - p.z) : 0;
          p.chaseD = (p.chaseD || 0) + (clamp((gap - 3.2) / 2.5, 0, 1) - (p.chaseD || 0)) * Math.min(1, dt * 14); }
        p.dribRate = 7.4 * (1 + 0.28 * p.prot + 0.16 * p.brakeD - 0.2 * p.runD + 0.7 * p.chaseD) * (ds === 'low' ? 1.25 : ds === 'high' ? 0.85 : 1);
        p.dph = (p.dph === undefined ? G.t * 7.4 : p.dph) + dt * p.dribRate;
        if (p.handCd > 0) p.handCd -= dt;
        if (G.sigN !== G.possN && Math.abs(p.z) < 7 && spd > 3 && tight < 0.3 && G.phase === 'live' && !G.drill) { G.sigN = G.possN; p.sigT = G.t; }   // calling the set: a hand up as he crosses half court
        const busy = p.mv && G.t - p.mv.t0 < p.mv.T + 0.15;
        if (nd.who && nd.d < 5 && !busy && !(p.handCd > 0) && !(p.move > 0) && !(p.postUp > 0)) {
          const fx = Math.sin(p.face), fz = Math.cos(p.face), side = (nd.who.x - p.x) * -fz + (nd.who.z - p.z) * fx;   // > 0: he is on my right
          const want = Math.abs(side) < 0.7 ? 0 : side > 0 ? -1 : 1, cur = p.dribHand || 1;
          if (want && want !== cur) { p.dribHand = want; startMv(p, nd.d < 3 && spd < 6 ? 'legs' : 'cross', cur, want); p.handCd = 0.9; }
        }
        /* sizing him up: standing with the ball and room to work, he keeps it moving (between the legs, behind the
           back, a crossover). Rhythm only: it opens nothing, and it is no more open to a steal than a plain dribble */
        if (!busy && spd < 1.2 && G.phase === 'live' && !G.drill && !p.inb && !(p.postUp > 0) && !(p.move > 0) && nd.d > 4.6 && nd.d < 15) {
          p.sizeT = (p.sizeT || 0) + dt;
          if (p.sizeT > (p.sizeN || 1.2)) { const cur = p.dribHand || 1; p.dribHand = -cur; startMv(p, ['legs', 'btb', 'cross', 'legs'][Math.floor(rand() * 4)], cur, -cur); p.mv.idle = true; p.sizeT = 0; p.sizeN = rr(0.8, 2.0); p.handCd = 0.6; }
        } else p.sizeT = 0;
      } else { p.prot = 0; p.runD = 0; p.brakeD = 0; p.dribX = undefined; }
      if (p.moveCd > 0) p.moveCd -= dt;
      if (p.reachCd > 0) p.reachCd -= dt;
      if (p.reachT > 0) { p.reachT -= dt; if (p.reachT <= 0 && (p.pose === 'reach' || passingPose(p.pose))) p.pose = ''; }
      if (p.holdPoseT > 0) { p.holdPoseT -= dt; if (p.holdPoseT <= 0 && p.pose === 'hold') p.pose = ''; }
      /* going up for a rebound: the ball coming down near you, above your reach */
      if (b.state === 'loose' && !p.isUser && p.y === 0 && b.vy < 0 && b.y > 8 && b.y < 13 && hyp(b.x - p.x, b.z - p.z) < 3.2 && rand() < dt * 6) {
        p.jg = GRAV * 1.5; p.vy = Math.sqrt(2 * p.jg * (1.6 + p.r.vert * 0.022)); p.pose = 'contest';
      }
      if (p.slap) { const k = (G.t - p.slap.t0) / 0.86, e = k >= 1 ? 0 : Math.sin(Math.PI * k); p.x = p.slap.x + p.slap.dx * e; p.z = p.slap.z + p.slap.dz * e; if (k >= 1) p.slap = null; }   // in for the slap and back to his spot on the lane
      if (p.celebT > 0) { p.celebT -= dt; if (!p.shoot && G.ball.holder !== p && p.y === 0) p.pose = p.celebT > 0 ? p.celebK || 'celebrate' : ''; }
      /* heavy legs at a stoppage: hands on the knees (you, when your stamina is low; one or two of the others late in a game) */
      if (!live) { if ((G.phase === 'ft' || G.phase === 'dead') && !G.drill && p.y === 0 && !p.pose && b.holder !== p && !(G.ftq && G.ftq.shooter === p) && (p.isUser && !G.switching ? p.energy < 0.3 : G.q >= 3 && ((p.num || 0) + G.q + (G.possN || 0)) % 6 === 0)) { p.pose = ['sad', 'hips', 'wipe'][((p.num || 0) + (G.possN || 0)) % 3]; p.tiredP = true; } }
      else if (p.tiredP) { p.tiredP = false; if (p.pose === 'sad' || p.pose === 'hips' || p.pose === 'wipe') p.pose = ''; }
      if (p.wantBall > 0) p.wantBall -= dt;
      if (p.shoot) {
        p.shoot.t += dt;
        const s = p.shoot;
        if (s.kind === 'layup') { p.tx = 0; p.tz = hoopZ(p.team) - dirOf(p.team) * 2.2; seek(p, dt, 0.8); }
        else if (s.kind === 'dunk') { const dx = 0 - p.x, dz = hoopZ(p.team) - dirOf(p.team) * 1.0 - p.z, d = hyp(dx, dz), v = d > 0.05 ? Math.min(21, d / Math.max(0.05, s.T * 0.85 - s.t)) : 0; p.vx = d > 0.05 ? dx / d * v : 0; p.vz = d > 0.05 ? dz / d * v : 0; }   // a dunk is carried all the way to the rim: he arrives as the ball goes down
        if (s.user && s.t / s.T > 1.12) release(p, s.t / s.T);
        else if (!s.user && s.t / s.T >= s.aiRel) release(p, s.aiRel);
      }
      if (p.npc) { /* a park regular: parkStep moves him */ }
      else if (!live) { if (G.phase === 'check' && p.ckx !== undefined) { p.tx = p.ckx; p.tz = p.ckz; seek(p, dt, 0.7); if (b.holder === p) p.pose = 'dribble'; } else if (G.phase === 'dead' || G.phase === 'ftflight') { p.vx *= 0.9; p.vz *= 0.9; } }
      else if (p.inb) { /* out of bounds with the ball: inboundStep has him */ }
      else if (p.isUser && G.drill) { if ((G.drill.kind === 'dunk' || G.drill.kind === 'free' || (G.drill.kind === 'horse' && G.drill.free)) && !p.shoot && p.y <= 0 && !G.auto) userStep(p, dt); /* else the drill moves you */ }
      else if (p.isUser && !G.auto) {
        userStep(p, dt);
        if (p.cutUser > 0) { p.cutUser -= dt; if (!stickWorld()) { p.tx = 0; p.tz = hoopZ(0) - 6; seek(p, dt, 1); } }
      } else if (!p.shoot) {
        if (b.holder === p) { handlerAI(p, dt); seek(p, dt, p.drive > 0 ? 1 : p.post !== undefined ? 0.3 : 0.7); if (b.holder === p) p.pose = 'dribble'; }
        else if (b.state === 'loose') { reboundAI(p); seek(p, dt, 1); if (p.pose !== 'contest') p.pose = ''; }
        else {
          const offTeam = b.holder ? b.holder.team : G.poss;
          if (offTeam === p.team) { offBallAI(p, dt); seek(p, dt, b.state === 'pass' && b.to === p ? 1 : 0.8); if (!(p.reachT > 0)) p.pose = p.callT > G.t ? 'call' : '';
            /* open, standing still, in his range: a hand goes up for the ball (now and then, and it shows you who is open) */
            if (b.state === 'held' && b.holder && b.holder !== p && !(p.callCd > G.t) && G.phase === 'live') { p.callCd = G.t + rr(0.5, 1.1);
              if (hyp(p.vx, p.vz) < 2.5 && nearestDef(p).d > 7 && distHoop(p.x, p.z, p.team) < 26 && (b.holder.hold || 0) > 0.8 && rand() < 0.45) { p.callT = G.t + rr(0.9, 1.5); p.callCd = G.t + rr(3, 6); } } }
          else {
            defAI(p, dt);
            /* a hand up. A man near a shooter who is not leaving his feet still puts a hand in his face, and one
               closing out on a man who has just caught it in range comes at him with a hand high. (How it looks only:
               `handOnly` keeps it out of the contest, so nobody's shot gets harder for it.) */
            if (p.y === 0 && p.contestT === undefined && !(p.reachT > 0)) { const sh = G.pl.find(o => o.shoot && o.team !== p.team && o.shoot.kind !== 'dunk' && o.shoot.kind !== 'layup'), h = G.ball.holder;
              const dS = sh ? hyp(sh.x - p.x, sh.z - p.z) : 99, dH = h && h.team !== p.team && !h.shoot ? hyp(h.x - p.x, h.z - p.z) : 99;
              if (dS < 6.5 || (dH > 3.5 && dH < 13 && h.caughtT !== undefined && G.t - h.caughtT < 0.9 && h.slot === p.slot && distHoop(h.x, h.z, h.team) < 27 && distHoop(h.x, h.z, h.team) > 9)) { p.pose = 'contest'; p.handOnly = G.t; } }
            /* closing out on a shooter who just caught it: a sprint, then short choppy steps */
            const gap = hyp(p.tx - p.x, p.tz - p.z), man = G.ball.holder;
            const close = man && man.team !== p.team && hyp(man.x - p.x, man.z - p.z) > 6 && hyp(man.x - p.x, man.z - p.z) < 26 && (man.caughtT !== undefined && G.t - man.caughtT < 1.2);
            seek(p, dt, (0.92 + p.r.perD * 0.0012) * (close || gap > 9 ? 1.12 : 1));
          }
        }
      }
      // Both the controlled player and his teammates show their hands as the pass arrives.
      if (live && b.state === 'pass' && b.to === p && b.dur - b.t < 0.45 && !p.shoot && !(p.reachT > 0)) p.pose = 'catch';
      else if (p.pose === 'catch') p.pose = '';
      if (p.shoot && p.shoot.kind === 'jumper') p.pose = 'shoot';
      else if (p.pullFollowUntil > G.t && !p.shoot && p.y > 0 && b.holder !== p && !(b.state === 'pass' && b.to === p) && live) p.pose = 'shoot';
      /* jump */
      if (p.spin) {
        const S = p.spin; S.t += dt; const k = Math.min(1, S.t / (S.T * 0.85)); p.spinA = S.total * k * k * (3 - 2 * k);
        if (S.t > S.T * 0.5 && p.y <= 0) { p.face += S.total; p.spinA = 0; p.spin = null; }
      }
      /* after a made dunk: a moment hanging on the rim, then the drop */
      if (p.hangPlan && p.vy <= 0 && p.y > 1 && !p.shoot && G.t - (p.dunkRel || 0) > 0.13) { p.hangPlan = false; p.hangT = 0.72; p.pose = 'hang'; if (R.rimSnap) R.rimSnap(hoopZ(p.team) > 0 ? 1 : -1, 0.7); }
      if (p.hangT > 0) {
        p.hangT -= dt; p.vx = p.vz = 0; p.vy = 0; p.pose = 'hang';
        const hy = Math.max(0.6, 10.25 - p.ht / 12 * 1.3); p.y += (hy - p.y) * Math.min(1, dt * 12);   // hands on the rim
        if (p.hangT <= 0) { p.vy = -2; p.pose = ''; if (R.rimSnap) R.rimSnap(hoopZ(p.team) > 0 ? 1 : -1, 0.6); }   // he lets go: the rim springs up
      } else if (p.vy !== 0 || p.y > 0) {
        const flightDt = p.shoot && p.shoot.gather ? clamp(p.shoot.t - p.shoot.gather, 0, dt) : dt;
        p.y += p.vy * flightDt; p.vy -= p.jg * flightDt;
        if (p.y <= 0 && p.vy < -9 && R.puff) { R.puff(p.x, p.z, clamp(-p.vy / 14, 0.7, 1.5)); if (p.vy < -13) AU().play('squeak', { x: p.x, vol: 0.45 }); }   // down hard: a puff where he lands
        if (p.y <= 0 && p.vy <= 0) { p.y = 0; p.vy = 0; if (p.pose === 'contest' || p.pose === 'shoot' || p.pose === 'celebrate' || p.pose === 'dunk1' || p.pose === 'dunk2' || p.pose === 'windmill' || p.pose === 'hang') p.pose = ''; }
      }
      if (p.fadeV) { if (p.y > 0 && G.t - p.fadeT < 1.6) { p.vx = p.fadeV.x; p.vz = p.fadeV.z; } else if (G.t - p.fadeT > 0.1) p.fadeV = null; }   // a fadeaway's hop carries him while he is in the air
      p.x += p.vx * dt; p.z += p.vz * dt;
      /* a hard cut squeaks the sneakers */
      if (live) {
        const acc = hyp(p.vx - (p.pvx || 0), p.vz - (p.pvz || 0)) / dt, spd = hyp(p.vx, p.vz);
        if (acc > 70 && spd > 6 && G.t > G.squeakT && rand() < 0.35) { G.squeakT = G.t + rr(0.12, 0.35); AU().play('squeak', { x: p.x, vol: p.isUser ? 1 : 0.7 }); if (R.puff && p.y <= 0) R.puff(p.x, p.z, 0.8); }
      }
      if (p.burstT > G.t && p.y <= 0 && R.puff && G.t > (p.burstP || 0)) { p.burstP = G.t + 0.09; R.puff(p.x - p.vx * 0.06, p.z - p.vz * 0.06, 0.6); }   // dust at his heels while it lasts
      p.pvx = p.vx; p.pvz = p.vz;
      /* face: where you run, else the ball or the rim */
      const sp = hyp(p.vx, p.vz);
      let want;
      if (p.passA !== undefined && G.t - p.passT0 < 0.4) want = p.passA;
      else if (!p.shoot && b.holder === p && (p.postUp > 0 || p.post !== undefined)) want = Math.atan2(p.x - 0, p.z - hoopZ(p.team));   // backing his man down: his back is to the basket (this used to pull him round to face it, against the post-up turning him away, and he shook)
      else if (p.shoot || b.holder === p && sp < 3) want = Math.atan2(0 - p.x, hoopZ(p.team) - p.z);
      else if (p.pose === 'guard' && sp < maxSpeed(p) * 0.92) {
        /* in a stance you face your man and slide, you don't turn and run (until he is gone) */
        const h = b.holder && b.holder.team !== p.team ? b.holder : null, tgt = h && hyp(h.x - p.x, h.z - p.z) < 14 ? h : b;
        want = Math.atan2(tgt.x - p.x, tgt.z - p.z);
      }
      else if (p.offD !== undefined && G.t - p.offD < 0.1 && sp < 7 && b.holder && b.holder.team !== p.team) {
        /* off the ball he opens up: chest to a point between the ball and his man, so he sees both */
        const mn = G.pl.find(o => o.team !== p.team && o.slot === p.slot) || b.holder, qx = b.holder.x * 0.65 + mn.x * 0.35, qz = b.holder.z * 0.65 + mn.z * 0.35;
        want = Math.atan2(qx - p.x, qz - p.z);
      }
      else if ((p.pose === 'contest' || p.y > 0.3) && b.holder !== p && !p.shoot) want = Math.atan2(b.x - p.x, b.z - p.z);   // up for a block or a board: he faces the ball, whichever way he was drifting
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
              if (d.isUser) { grade(0.5, 'Cut him off'); toast(pickOf(['Cut off', 'Walled off', 'Nowhere to go']), 'make'); powAt('WALL!', d, 0.75); buzz(12); } else if (h.isUser) toast('Bumped', 'opp');
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
      const dx = c.x - a.x, dz = c.z - a.z, d = hyp(dx, dz), m = a.team !== c.team ? 2.65 : 2.3;   // a defender's arms and chest need a little more room than a teammate's shoulder
      if (d < m && d > 0.001) {
        const push = (m - d) / 2, ux = dx / d, uz = dz / d;
        a.x -= ux * push; a.z -= uz * push; c.x += ux * push; c.z += uz * push;
      }
    }
    /* (a man who is outside the lines, the inbounder after his pass, steps back in: he is not put back in) */
    const BX = G.park ? 33.5 : 24.6, BZ = G.park ? 60 : 46.6;
    for (const p of G.pl) if (!p.inb) { const cx = clamp(p.x, -BX, BX), cz = clamp(p.z, G.half ? 0.5 : -BZ, BZ);
      if (p.wasInb && (cx !== p.x || cz !== p.z)) { const m = dt * 13; p.x += clamp(cx - p.x, -m, m); p.z += clamp(cz - p.z, -m, m); } else { p.wasInb = false; p.x = cx; p.z = cz; } }
      else p.wasInb = true;
    /* once the ball is over half court, the computer's players on offense stay over it: no drifting (or being
       pushed) back across the line for a violation of their own making */
    if (G.vio && G.vio.crossed && G.vio.n === G.possN && G.phase === 'live' && G.poss !== null && G.poss !== undefined && !G.drill && b.state !== 'loose')
    {
      const held = [];
      const ovr = G.vio.over || (G.vio.over = new Set());   /* (only a man who has crossed is kept across: a trailer still coming up the floor runs there, he is not moved there) */
      for (const p of G.pl) if (p.team === G.poss && (!p.isUser || G.auto) && !p.inb) { if (along(p.z, p.team) <= HALF - 1.2) { ovr.add(p); continue; } if (!ovr.has(p)) continue; p.z = hoopZ(p.team) - (HALF - 1.2) * dirOf(p.team); if (p.vz * dirOf(p.team) < 0) p.vz = 0; held.push(p); }
      /* two of them held on the line at once would stand inside each other: slide them apart along it */
      for (const a of held) for (const c of G.pl) { if (c === a || c.inb || (held.includes(c) && G.pl.indexOf(c) < G.pl.indexOf(a))) continue;
        const dx = c.x - a.x, dz = c.z - a.z, d = hyp(dx, dz); if (d >= 2.3) continue;
        const need = Math.sqrt(2.3 * 2.3 - dz * dz) - Math.abs(dx), sg = dx < 0 ? -1 : 1;
        const mv = Math.min(need, dt * 18); if (held.includes(c)) { a.x -= sg * mv / 2; c.x += sg * mv / 2; } else c.x += sg * mv; }
    }
    ballStep(dt);
  }

  function ballStep(dt) {
    const b = G.ball;
    if (b.state === 'held') {
      const p = b.holder, hp = handPos(p);
      const H = R.hands && R.hands(p);
      if (p.shoot) { b.pushCycle = null; b.x = hp.x; b.z = hp.z; b.y = hp.y + (p.shoot.kind === 'dunk' ? (H ? 0.1 : 0.6) : H ? 0 : 0.2); }
      /* a shot goes up, in front of the shooter: the ball is never carried down by his knees or behind him on the way
         (the hands lag the pose by a frame, and an arm may swing through a wind-up; a windmill is the one exception) */
      if (p.shoot && p.pose !== 'windmill') { const fx = Math.sin(p.face), fz = Math.cos(p.face), ht = (p.ht || 78) / 12, k = Math.min(1, p.shoot.t / 0.12);
        const cx = p.x + fx * 0.9, cz = p.z + fz * 0.9, cy = p.y + ht * 0.62;   // out in front at the chest, where a shot starts
        b.x = cx + (b.x - cx) * k; b.z = cz + (b.z - cz) * k; b.y = cy + (b.y - cy) * k;
        const fwd = (b.x - p.x) * fx + (b.z - p.z) * fz; if (fwd < 0.25) { b.x += fx * (0.25 - fwd); b.z += fz * (0.25 - fwd); }
        if (b.y < p.y + ht * 0.5) b.y = p.y + ht * 0.5; }
      if (p.shoot && p.shoot.pickup && p.shoot.t < p.shoot.gather) {
        const from = p.shoot.pickup, t = p.shoot.t / p.shoot.gather, w = t * t * (3 - 2 * t);
        b.x = p.x + from.x + (b.x - p.x - from.x) * w;
        b.z = p.z + from.z + (b.z - p.z - from.z) * w;
        b.y = from.y + (b.y - from.y) * w;
      }
      /* stuffed: a jumping defender's hand on the ball while the shooter still has it up in the air is a block too */
      if (p.shoot) { if (p.shoot.kind !== 'dunk' && p.y > 0.4 && G.phase === 'live' && !G.drill) for (const o of G.pl) {
        if (o.team === p.team || o.y < 0.4) continue;
        const Ho = R.hands && R.hands(o); if (!Ho) continue;
        if ([Ho.r, Ho.l].some(hd => hyp(hd.x - o.x, hd.z - o.z) < 4 && Math.hypot(hd.x - b.x, hd.y - b.y, hd.z - b.z) < 1.0)) {
          p.st.fga++; if (p.shoot.three) p.st.tpa++; p.shoot = null; p.pose = ''; G.possN = (G.possN || 0) + 1;
          blockShot(o, p, { x: b.x, y: b.y, z: b.z }); return; }
      } }   // (a shot never falls through to the dribble below: the ball stays in the hands)
      else if (H && ((G.phase === 'ft' && p.pose !== 'dribble') || p.inb || (p.fakeT !== undefined && G.t - p.fakeT < 0.36) || p.y > 0.25 /* in the air with it (a rebound): it stays in his hands until he lands */)) { b.pushCycle = null; b.x = (H.r.x + H.l.x) / 2; b.z = (H.r.z + H.l.z) / 2; b.y = (H.r.y + H.l.y) / 2 + 0.2; }
      else {
        const mv = p.mv, ms = mv && H ? (G.t - mv.t0) / mv.T : 2;
        if (ms < 1) {
          // The ordinary bounce resumes from the receiving palm after the move.
          p.dph = Math.PI / 2; b.bk = 0; b.pushCycle = null;
          const A = mv.a < 0 ? H.l : H.r;
          if (mv.k === 'spin' || mv.k === 'hesi') {   // palmed through the spin; held at the hip on the hesitation
            b.x = A.x; b.z = A.z; b.y = Math.max(1.2, A.y - (mv.k === 'hesi' ? 0.15 : 0.3)); return;
          }
          /* hand, floor, other hand: in front for a crossover, under you through the legs, behind the back */
          PB.crossBounce(b, p, mv, ms, H);
          if (ms >= 0.5 && !mv.bn) { mv.bn = true; if (G.phase === 'live') AU().play('bounce', { x: b.x, vol: p.isUser ? 1 : 0.5 }); }
          return;
        }
        /* the dribble: from the hand to the floor and back, under the hand */
        b.x = hp.x; b.z = hp.z;
        const ds = p.d && p.d.look && p.d.look.drib;
        const top = H ? Math.max(1.2, hp.y - 0.35) : 3 * (ds === 'low' ? 0.78 : ds === 'high' ? 1.06 : 1) * (1 - 0.18 * (p.prot || 0) + 0.08 * (p.runD || 0));
        const ph = p.dph !== undefined ? p.dph : G.t * 7.4, sn = Math.abs(Math.sin(ph));
        b.y = 0.4 + sn * (top - 0.4);
        if (p.dribRate && !p.inb && G.phase !== 'ft') {
          PB.movingBounce(b, { runD: p.runD, dribVX: p.leadVX !== undefined ? p.leadVX : p.dribVX, dribVZ: p.leadVZ !== undefined ? p.leadVZ : p.dribVZ }, hp, ph, p.dribRate);
          /* never through his legs or his body on the way back to the hand: it goes round, on the side of the hand it is in */
          /* and never out of his reach: past a long stride and a half, the rest of the way is squeezed in */
          { const ex = b.x - p.x, ez = b.z - p.z, e = hyp(ex, ez), lim = 4.3; if (e > lim) { const k = (lim + (e - lim) * 0.3) / e; b.x = p.x + ex * k; b.z = p.z + ez * k; } }
          const dx = b.x - p.x, dz = b.z - p.z, d = hyp(dx, dz), R0 = 1.0;
          if (d < R0 && b.y < 4.7) { const fx = Math.sin(p.face), fz = Math.cos(p.face), sd = (p.dribHand || 1) >= 0 ? 1 : -1, w = (R0 - d) / R0;
            let ox = dx + fz * sd * w * 0.6, oz = dz - fx * sd * w * 0.6; const ol = hyp(ox, oz) || 1; ox /= ol; oz /= ol;
            const k = (R0 - d) * (1 - clamp((b.y - 4.1) / 0.6, 0, 1));
            b.x += ox * k; b.z += oz * k; }
        }
        /* the bounce: one each time the ball meets the floor, quieter the farther it is from you */
        const k = Math.floor(ph / Math.PI);
        if (k !== b.bk) { b.bk = k; if (G.phase === 'live') { const d = G.user ? hyp(b.x - G.user.x, b.z - G.user.z) : 20; AU().play('bounce', { x: b.x, vol: clamp(1.1 - d / 45, 0.25, 1) }); } }
      }
      return;
    }
    if (b.state === 'pass') {
      b.t += dt;
      const u = Math.min(1, b.t / b.dur);
      /* thrown to a man, not to a spot on the floor: the pass bends to where he is as it comes (it used to land where he
         was headed when it left, so a receiver who changed his mind watched it go by); a pass that sails is the exception */
      if (b.to && !b.wild) { const r = b.to, rem = Math.max(0, b.dur - b.t), k = Math.min(1, dt * 9);
        const gx = b.lob ? clamp(r.x + r.vx * rem * 0.6, -8, 8) : clamp(r.x + r.vx * rem * 0.5, -25, 25), gz = b.lob ? b.ez : clamp(r.z + r.vz * rem * 0.5, -47, 47);
        b.ex += (gx - b.ex) * k; b.ez += (gz - b.ez) * k; if (!b.lob) b.ey += ((r.ht || 78) / 12 * 0.6 + 1.2 + r.y - b.ey) * k; }
      /* the man going up for a lob leaves the floor as it arrives (he used to be lifted to it) */
      if (b.lob && b.to && !b.to.oopJ && b.dur - b.t < 0.34 && b.to.y <= 0.05) { const r = b.to; r.oopJ = true; r.jg = GRAV * 1.2; r.vy = Math.sqrt(2 * r.jg * 3.1); r.pose = 'celebrate'; }
      b.x = b.sx + (b.ex - b.sx) * u; b.z = b.sz + (b.ez - b.sz) * u; b.y = b.sy + (b.ey - b.sy) * u + 4 * b.apex * u * (1 - u);
      if (b.bounce) { const f = 0.62; b.y = u < f ? b.sy + (0.4 - b.sy) * (u / f) : 0.4 + (b.ey - 0.4) * ((u - f) / (1 - f)) + 2.2 * ((u - f) / (1 - f)) * (1 - (u - f) / (1 - f));
        if (u >= f && !b.bn) { b.bn = true; AU().play('bounce', { x: b.x, vol: 0.6 }); } }
      if (b.pick && u >= b.pick.f) {
        const o = b.pick.who, p = b.from;
        o.st.stl++; p.st.tov++; G.picks = (G.picks || 0) + 1; p.celebK = 'ugh'; p.celebT = 1.2;
        if (o.isUser) grade(3, 'Picked it off'); if (p.isUser) grade(-3, 'Intercepted');
        toast(o.team === 0 ? 'PICKED OFF' : 'Intercepted', o.team === 0 ? 'make' : 'opp'); feed(`Steal · ${o.name}`);
        give(o); if (R.pow && o.isUser) R.pow('PICKED!', o.x, 6, o.z, 0.9); AU().play('steal', { x: o.x }); AU().crowd.react(home(o.team) ? 'roar' : 'groan', 0.7); B('steal', { prio: 3, follow: 0.35 }); return;
      }
      if (u >= 1) {
        const r = b.to;
        if (b.lob && hyp(r.x - b.x, r.z - b.z) < 6) {
          /* caught above the rim: thrown down in one motion */
          give(r); r.caughtT = G.t; r.caughtFrom = b.from; r.oopJ = false;
          if (r.y < 1) { r.jg = GRAV * 1.2; r.vy = Math.max(r.vy || 0, 9); } r.pose = 'celebrate';
          r.shoot = { t: 0, T: 0.14, kind: 'dunk', user: false, three: false, d: distHoop(r.x, r.z, r.team), aiRel: 0.82, oop: true };
          toast('ALLEY-OOP', r.team === 0 ? 'make' : 'opp'); AU().crowd.react('ooh', 1);
        }
        else if (hyp(r.x - b.x, r.z - b.z) < 5) { r.oopJ = false; give(r); r.caughtT = G.t; r.caughtFrom = b.from;
          { const PP = playOf(r.team); if (PP && PP.kind === 'post' && (PP.def && PP.def.who !== undefined ? r === playWho(PP, r.team, r) : r.slot >= 3) && (!r.isUser || G.auto) && distHoop(r.x, r.z, r.team) < 17) r.post = 1.8 + rand(); }
          r.pose = 'hold'; r.holdPoseT = 0.3; AU().play('catch', { x: r.x, vol: 0.7 }); }
        else { b.state = 'loose'; b.vx = (b.ex - b.sx) / b.dur * 0.5; b.vz = (b.ez - b.sz) / b.dur * 0.5; b.vy = 0; b.lastTouch = b.from.team; G.reb = null; }
      }
      return;
    }
    if (b.state === 'shot') {
      b.t += dt;
      const u = Math.min(1, b.t / b.dur);
      b.x = b.sx + (b.ex - b.sx) * u; b.z = b.sz + (b.ez - b.sz) * u; b.y = b.sy + (b.ey - b.sy) * u + 4 * b.apex * u * (1 - u);
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
      b.y = Math.max(0.4, b.y - (14 + 20 * b.t + 10 * dt) * dt);
      b.t += dt;
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
      if (Math.abs(b.x) > 25.3 || Math.abs(b.z) > 47.3 || (G.half && b.z < -0.3)) {
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
          if (got.isUser && !G.drill && !G.park) powAt(off ? 'MINE!' : 'BOARD!', got, 0.8, false, 1.6);
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
      AU().play('horn', { len: 2 }); if (R.horn) R.horn(2.2); AU().crowd.react(g.score[g.home] > g.score[1 - g.home] ? 'roar' : 'applause', 1);
      const w = g.score[0] > g.score[1] ? 0 : 1, kinds = ['celebrate', 'flex', 'roar', 'three', 'point', 'chest'];
      for (const p of g.pl) { p.shoot = null; p.drive = 0; p.vx *= 0.3; p.vz *= 0.3; p.pose = p.team === w ? (p.d && p.d.look && p.d.look.celeb) || kinds[Math.floor(rand() * kinds.length)] : ['sad', 'hips', 'sad', 'ugh', 'hips'][p.slot || 0]; }
      if (R.benchJump) R.benchJump(w);
      /* the cameras find the winners: close on their best player, then up and away over the floor */
      { const on = g.pl.filter(p => p.team === w), star = g.user && g.user.team === w ? g.user : on.slice().sort((a, b) => b.st.pts - a.st.pts)[0];
        if (star && R.cine) { const fa = star.face || 0, ab = t => g.teams[t].ab || g.teams[t].id, title = !!(opts.clinch && opts.clinch[w]);
          /* the night a title is won: paper falls, the cameras stay longer, the flashes do not stop */
          if (title) { if (R.confetti) R.confetti(g.teams[w].c1, g.teams[w].c2); if (R.hype) { R.hype(1.4); setTimeout(() => G === g && R.hype(1.2), 1500); setTimeout(() => G === g && R.hype(1.2), 3200); } AU().crowd.react('roar', 1); }
          g.buzzT = title ? 9.2 : 5.0;
          cine((title ? [{ focus: star, a: [fa + 0.9, fa - 0.5], r: [9, 7], h: [2.4, 4.4], ly: 4.6, dur: 3.2 }, { focus: star, a: [fa - 1.2, fa + 0.3], r: [17, 13], h: [5, 8], ly: 4.5, dur: 2.8 }] : [{ focus: star, a: [fa - 0.7, fa + 0.45], r: [10, 7.5], h: [3, 4.6], ly: 4.4, dur: 2.6 }])
            .concat([{ a: [0.7, 1.35], r: [58, 72], h: [18, 36], ly: 3, dur: title ? 3.0 : 2.3 }]),
            title ? 'Champions' : 'Final', title ? g.teams[w].name : `${ab(0)} ${g.score[0]} · ${ab(1)} ${g.score[1]}`, { skip: () => { if (G === g && g.phase === 'buzzer') g.buzzT = Math.min(g.buzzT, 0.25); } }); } }
      return;
    }
    (g.qsc = g.qsc || []).push(g.score.slice());   // the score at the end of each period, for the line score
    g.q++;
    g.clock = g.q > 4 ? Math.max(60, g.qlen * 60 * 5 / 12) : g.qlen * 60;
    if (g.q !== 3 && !g.drill && R.cine) { const sd = rand() < 0.5 ? 1 : -1, ab = t => g.teams[t].ab || g.teams[t].id;   // the break: a slow pass along the sideline (the half has its own card)
      cine([{ a: [sd * (Math.PI / 2 - 0.55), sd * (Math.PI / 2 + 0.35)], r: [33, 29], h: [8, 12], ly: 4, dur: 1.75 }], g.q > 4 ? 'Overtime' : `End of the ${['', '1st', '2nd', '3rd'][g.q - 1]}`, `${ab(0)} ${g.score[0]} · ${ab(1)} ${g.score[1]}`); }
    else toast(g.q > 4 ? 'Overtime' : `End of the ${['', '1st', '2nd', '3rd'][g.q - 1]}`, '');
    AU().play('horn'); if (R.horn) R.horn(1.6); AU().crowd.react('applause', 0.7);
    setTimeout(() => AU().organ && AU().organ(g.q === 3 ? 'walk' : 'letsgo'), 2200);
    setTimeout(() => B(g.q === 3 ? 'half' : g.q > 4 ? 'ot' : 'end_q', { prio: 3, follow: g.q === 3 ? 0.6 : 0 }), 900);
    /* between quarters, the broadcast's graphic: the leading scorer on each side */
    if (g.q !== 3 && g.q <= 4 && !g.drill) setTimeout(() => { const e = $('#statpop'); if (!e || !G || G !== g) return;
      const top = t => g.pl.concat((g.bench && g.bench[t]) || []).filter(p => p.team === t || (p.team === undefined && g.bench && g.bench[t].includes(p))).sort((a, b) => b.st.pts - a.st.pts)[0];
      const a0 = top(0), a1 = top(1); if (!a0 || !a1) return;
      e.innerHTML = `<i style="background:${g.teams[g.score[0] >= g.score[1] ? 0 : 1].c1}"></i><div><b>After ${g.q - 1 === 1 ? 'one' : 'three'} · ${g.teams[0].ab || g.teams[0].id} ${g.score[0]}, ${g.teams[1].ab || g.teams[1].id} ${g.score[1]}</b><span>${a0.name} ${a0.st.pts} PTS · ${a1.name} ${a1.st.pts} PTS</span></div>`;
      e.classList.remove('on'); void e.offsetWidth; e.classList.add('on'); clearTimeout(statPop.h); statPop.h = setTimeout(() => e.classList.remove('on'), 4200); }, 1400);
    if (g.q === 3 && !g.drill) halftime();
    g.poss = null;
    const t = g.q === 2 || g.q === 3 ? 1 - g.tipWinner : g.tipWinner;
    for (const p of g.pl) { p.shoot = null; p.drive = 0; p.pose = ''; }
    g.tf = [0, 0];
    if (g.q === 3 || g.q === 5) g.to = [2, 2];
    for (const p of g.pl) if (p.energy !== undefined) p.energy = Math.min(1, p.energy + 0.35);
    dead(1.8, () => {
      /* the team with the ball starts in its backcourt, the defense back in front of its rim */
      cut();
      for (const p of g.pl) { const c = toCourt(t, SPOTS[p.slot][0][0] * 0.8, p.team === t ? 58 : 40); p.x = c.x; p.z = c.z; p.vx = p.vz = 0; }
      inboundTo(t, toCourt(t, 0, 70));
    });
  }

  /* halftime: the score and how each side is shooting, your line; it waits for a tap */
  function halftime() {
    const tot = t => { const r = { pts: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, reb: 0, tov: 0 }; for (const p of G.pl.filter(p => p.team === t).concat((G.bench && G.bench[t]) || [])) if (p.st) for (const k in r) r[k] += p.st[k] || 0; return r; };   // everyone who has played, the bench too
    const a = tot(0), c = tot(1), pc = (m, n) => n ? Math.round(m / n * 100) + '%' : '–', u = G.user && G.user.st;
    G.replayAt = 0; if (G.replay) endReplay();   // the halftime card is not shown under a replay: tapping it would only skip the replay
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
    if (R.cine) R.cine(null);
    G.phase = 'end';
    $('#game').classList.remove('park'); { const pc = $('#parkcard'); if (pc) pc.hidden = true; const tu = $('#tut'); if (tu) tu.hidden = true; }
    cancelAnimationFrame(raf);
    const quiet = G.park;   // walking out of the park is not the end of a game: no horn, no crowd, no call
    if (!G.buzzed && !quiet) { AU().play('horn', { len: 2 }); if (R.horn) R.horn(2.2); AU().crowd.react(G.score[G.home] > G.score[1 - G.home] ? 'roar' : 'applause', 1); }
    if (AU().pulse) AU().pulse(false);
    if (PB.booth) PB.booth.stop(); if (!quiet) setTimeout(() => B('final', { prio: 6, follow: 0.7 }), 600); setTimeout(() => AU().crowd.on(false), quiet ? 0 : 2500);
    const box = G.played ? G.playedBy.map((x, i) => ({ d: x.d, team: x.team, st: G.played[i], user: !!(G.user && x.d === G.user.d) })) : G.pl.map(p => ({ d: p.d, team: p.team, st: p.st, user: p.isUser }));
    const line = (G.qsc || []).concat([G.score.slice()]), flow = (G.flow || []).concat([[Math.round(G.q * G.qlen * 60), G.score[0] - G.score[1]]]);
    const res = { line, flow, qlen: G.qlen, drill: G.drill ? { kind: G.drill.kind, score: G.drill.score, made: G.drill.made, att: G.drill.att, scores: G.drill.scores } : null, reels: G.reels || [], score: G.score.slice(), box, grade: G.user ? gradeLetter(G.grade) : null, gradeScore: G.grade,
      gradeLog: G.gradeLog, parkGo: G.parkGo || null, user: G.user ? { ...G.user.st } : null, teams: G.teams, q: G.q, winner: !!G.userWinner, half: G.half ? { target: G.target, ones: G.ones, n: G.pl.length / 2 } : null,
      shots: (G.shotLog || []).filter(x => x.user).map(x => [Math.round(x.x * 10) / 10, Math.round(x.a * 10) / 10, x.made ? 1 : 0]) };
    PB.Game.active = false;
    $('#game').hidden = true;
    if (opts.onEnd) opts.onEnd(res);
  }

  /* ---------- time you do not play: on the bench between your stints, or a game simmed to the end ----------
     The score moves by both teams' strength, and every point, rebound and assist of it is given to a player: the
     scorers by their ratings and minutes, so the box score reads like a game and not like one man's night. */
  const elapsed = () => { const Q = G.qlen * 60; return ((Math.min(G.q, 4) - 1) * Q + (Q - Math.max(0, G.clock))) / (4 * Q) + (G.q > 4 ? 1 : 0); };
  function spread(t, pts, secs, withUser) {
    const floor = G.pl.filter(p => p.team === t && (withUser || !p.isUser)), bench = (G.bench && G.bench[t]) || [];
    /* who would have been out there: the five on the floor most of it, the reserves a share */
    const cand = floor.map(p => ({ st: p.st, r: p.r, d: p.d, w: 1 })).concat(bench.filter(x => !(G.user && x.d === G.user.d)).slice(0, 4).map((x, i) => ({ st: x.st, r: x.r, d: x.d, w: i < 2 ? 0.45 : 0.2 })));
    if (!cand.length) return;
    for (const c of cand) { const isU = G.user && c.st === G.user.st; if (!isU) c.st.secs = (c.st.secs || 0) + secs * (c.w === 1 ? 0.78 : c.w > 0.3 ? 0.4 : 0.15); }
    const mark = c => { if (G.played && !G.played.includes(c.st)) { G.played.push(c.st); G.playedBy.push({ d: c.d, team: t }); } };
    const pickBy = f => { let tot = 0; const w = cand.map(c => { const v = Math.max(0.01, f(c)) * c.w; tot += v; return v; }); let x = rand() * tot; for (let i = 0; i < cand.length; i++) { x -= w[i]; if (x <= 0) return cand[i]; } return cand[cand.length - 1]; };
    const off = c => Math.pow(Math.max(40, (c.r.close + c.r.mid + c.r.three) / 3 + ((c.d && c.d.ovr) || 70) * 0.6) / 100, 4);
    let left = Math.max(0, Math.round(pts)), guard = 0;
    while (left > 0 && guard++ < 400) {
      const c = pickBy(off), st = c.st, u = rand(); mark(c);
      if (left >= 3 && u < 0.2 + Math.max(0, c.r.three - 60) / 160) { st.pts += 3; st.fgm++; st.fga++; st.tpm++; st.tpa++; left -= 3; }
      else if (u > 0.86 || left === 1) { const n = Math.min(left, 2); st.pts += n; st.ftm += n; st.fta += 2; left -= n; continue; }
      else { st.pts += 2; st.fgm++; st.fga++; left -= 2; if (c.r.dunk > 75 && rand() < 0.15) st.dunk++; else st.lay += rand() < 0.4 ? 1 : 0; }
      if (rand() < 0.6) { let a = pickBy(x => x === c ? 0 : Math.pow(Math.max(30, x.r.pass) / 100, 3)); if (a !== c) { a.st.ast++; mark(a); } }
    }
    /* the misses that go with those makes (about 46% from the floor), then the boards, steals, blocks and turnovers of that much time */
    const poss = secs / 14 / 2;
    for (let i = Math.round(poss * 0.5 + rand()); i > 0; i--) { const c = pickBy(off); c.st.fga++; if (rand() < 0.38) c.st.tpa++; mark(c); }
    const n = (per, f, k) => { for (let i = Math.floor(poss * per + rand()); i > 0; i--) { const c = pickBy(f); c.st[k]++; mark(c); } };
    n(0.46, c => Math.pow(Math.max(30, c.r.reb) / 100, 3), 'reb'); n(0.08, c => c.r.steal / 100, 'stl'); n(0.05, c => Math.pow(Math.max(20, c.r.block) / 100, 3), 'blk'); n(0.14, c => 1, 'tov');
  }
  /* run the clock ahead by this many seconds of game time, quarter by quarter (never past the end of regulation) */
  function skipTime(secs, withUser) {
    const Q = G.qlen * 60; let left = secs;
    while (left > 0.01 && G.q <= 4) {
      const c = Math.min(left, G.clock);
      const got = [0, 0];
      for (const t of [0, 1]) { const str = ((opts.strength && opts.strength[t]) || 75), pts = Math.max(0, Math.round(c / 14 / 2 * (1.08 + (str - 75) * 0.012) + PB.gauss() * Math.min(2, Math.sqrt(c / 40)))); G.score[t] += pts; got[t] = pts; spread(t, pts, c, withUser); }
      for (const p of G.pl) if (withUser || !p.isUser) p.st.pm = (p.st.pm || 0) + Math.round((p.team === 0 ? got[0] - got[1] : got[1] - got[0]) * 0.8);
      G.pmLast = G.score.slice();
      left -= c; G.clock -= c;
      if (G.flow) G.flow.push([Math.round((G.q - 1) * Q + Q - G.clock), G.score[0] - G.score[1]]);
      if (G.clock <= 0.01) { if (G.q >= 4) { G.clock = 0; break; } (G.qsc = G.qsc || []).push(G.score.slice()); G.q++; G.clock = Q; G.tf = [0, 0]; }
    }
  }
  const clockTxt = () => `${['', '1st', '2nd', '3rd', '4th'][Math.min(G.q, 4)]} quarter, ${Math.floor(G.clock / 60)}:${String(Math.floor(G.clock % 60)).padStart(2, '0')}`;
  /* your minutes, the way a coach hands them out: a starter opens and closes, a sixth man is first off the bench,
     a reserve gets a run in each half. opts.stints is a list of [from, to] in fractions of regulation. */
  function stintOver() {
    const S = opts.stints; if (!S || !G.user || G.auto || G.drill || G.switching || G.q > 4 || G.stint === undefined) return false;
    const cur = S[G.stint]; if (!cur || cur[1] >= 0.999) return false;
    return elapsed() >= cur[1] - 0.003;
  }
  function checkIn(first) {
    cut();
    G.phase = 'dead'; G.deadT = 1.6; G.poss = null;
    const t = G.score[0] > G.score[1] ? 1 : 0;
    for (const p of G.pl) { p.shoot = null; p.drive = 0; p.pose = ''; p.vx = p.vz = 0; p.y = 0; p.inb = false; const c = toCourt(p.team, SPOTS[p.slot][0][0] * 0.8, p.team === 0 ? 40 : 55); p.x = c.x; p.z = c.z; p.energy = p.isUser ? Math.min(1, (p.energy ?? 1) + 0.5) : 1; }
    if (G.user) { G.user.x = 24.4; G.user.z = clamp(G.user.z * 0.3, -8, 8); }   // you come on from the scorer's table
    G.inb = null; G.ftq = null; G.shotClock = 24;
    G.then = () => { inboundTo(t, toCourt(t, 0, 70)); };
    setTimeout(() => toast(first ? (elapsed() < 0.01 ? 'You check in' : 'Off the bench: you check in') : 'Back in the game', 'call'), 300);
  }
  function sitDown() {
    const S = opts.stints, from = clockTxt(), sc0 = G.score.slice(), Q4 = G.qlen * 60 * 4, nx = S[G.stint + 1];
    if (!nx) { feed(`You sit for the rest of the night · ${from}`); toast('Your night is done: the bench watches the finish', 'call'); G.stintDone = true; G.phase = 'dead'; G.deadT = 2.2; G.then = () => simRest(); return; }
    G.stint++;
    skipTime(Math.max(0, (nx[0] - elapsed()) * Q4), false);
    feed(`You sat from the ${from}: ${G.teams[0].ab || G.teams[0].id} ${G.score[0] - sc0[0]}, ${G.teams[1].ab || G.teams[1].id} ${G.score[1] - sc0[1]} while you rested`);
    feed(`You check back in · ${clockTxt()}`);
    checkIn(false);
    /* the broadcast's card: when you are back, and what happened while you sat */
    { const e = $('#statpop'), a = G.teams[0], c = G.teams[1]; if (e) { e.innerHTML = `<i style="background:${G.teams[G.user.team].c1}"></i><div><b>Back in · ${clockTxt()}</b><span>While you sat: ${a.ab || a.id} ${G.score[0] - sc0[0]}, ${c.ab || c.id} ${G.score[1] - sc0[1]} · now ${G.score[0]}-${G.score[1]}</span></div>`;
      e.classList.remove('on'); void e.offsetWidth; e.classList.add('on'); clearTimeout(statPop.h); statPop.h = setTimeout(() => e.classList.remove('on'), 4600); } }
  }
  /* simulate the rest of a game you leave early (or the minutes after your last stint) */
  function simRest() {
    const Q4 = G.qlen * 60 * 4, S = opts.stints;
    if (G.q <= 4) {
      /* the minutes you would still have played count for you too: stint by stint */
      if (S && G.user && !G.stintDone && G.stint !== undefined) {
        let e = elapsed(), i = G.stint;
        while (e < 1 && G.q <= 4) { const cur = S[i]; let to, on;
          if (cur && e < cur[0]) { to = cur[0]; on = false; } else if (cur && e < cur[1]) { to = cur[1]; on = true; i++; } else if (cur) { i++; continue; } else { to = 1; on = false; }
          const before = G.user.st.secs || 0; skipTime((Math.min(1, to) - e) * Q4, on); if (on) G.user.st.secs = before + (Math.min(1, to) - e) * Q4; e = Math.min(1, to); if (to >= 1) break; }
      }
      else skipTime(Math.max(0, G.clock) + Math.max(0, 4 - G.q) * G.qlen * 60, !G.stintDone && !!G.user && !S);
    }
    if (G.score[0] === G.score[1]) { const t = rand() < 0.5 ? 0 : 1; G.score[t] += 2; spread(t, 2, 20, false); }
    G.q = Math.max(G.q, 4); G.clock = 0;
    finish();
  }

  /* ---------- frame ---------- */
  /* ---------- replays ----------
     The last few seconds are kept as snapshots (positions, poses, the ball) thirty times a second. A dunk, an
     and-one of yours or a shot at the buzzer plays back at half speed from a camera circling the play, in the pause
     before the inbound; a tap skips it. Settings can turn them off. */
  const SNAP = ['x', 'y', 'z', 'vx', 'vz', 'face', 'pose', 'jg', 'vy', 'spinA', 'reachT'];
  let tape = [], snapT = 0, replayCd = 0;
  function record(dt) {
    snapT += dt;
    if (snapT < 1 / 30) return;
    snapT = 0;
    tape.push({ t: G.t, pl: G.pl.map(p => SNAP.map(k => p[k])), shoot: G.pl.map(p => p.shoot ? { t: p.shoot.t, T: p.shoot.T, kind: p.shoot.kind, js: p.shoot.js, fade: p.shoot.fade, gather: p.shoot.gather } : null),
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
    if (G.park) return;   // the park has no broadcast
    if (PB.settings && PB.settings.replays === false) return;
    if (G.t < replayCd || G.replay || tape.length < 40) return;
    replayCd = G.t + 25;
    G.replayAt = G.t + 0.9; G.replayKind = kind;
  }
  function startReplay() {
    if (R.cineOn && R.cineOn()) return;   // a cut scene is on (a timeout's huddle): the replay would move everyone out from under its camera
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
      const sh = f.shoot[i]; p.shoot = sh ? { ...sh, kind: sh.kind || 'jumper' } : null;
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
    if (G.hitT > 0) { G.hitT -= dt; dt = 0; }   // the beat a big play lands on: a block, a dunk, broken ankles hold for a few frames
    if (G.slowT) { if (G.ball.state === 'shot' && !G.replay) { dt *= 0.4; if (G.slowT === 1) { G.slowT = 2; AU().muffle(true); } } else { G.slowT = 0; if (!G.paused) AU().muffle(false); } }
    if (G.replay) {
      if (!G.paused) replayFrame(dt);
      R.update(G, G.paused || !G.replay ? 0 : dt * 0.5);
      R.render(); hud(); setHidden($('#meter'), true);
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
      if (G.ball.holder === u && !u.shoot) R.marks(bestPass(u, stickWorld()), null);
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
    setHidden(m, (!s && !ftm) || (!ftm && !(G.drill && G.drill.kind !== 'free') && PB.settings && PB.settings.meterOn === 'Off'));   // (the meter stays for free throws and the contests)
    if (m.hidden) return;
    const v = s ? s.t / s.T : ftm;
    const w = (s ? 0.045 + (s.kind === 'jumper' ? (s.three ? u.r.three : u.r.mid) : u.r.close) * 0.0006 : 0.05 + u.r.ft * 0.0007) * timingEase();
    const p = R.toScreen(u.x, u.ht / 12 + u.y + 1.2, u.z);
    m.style.transform = `translate(${Math.round(p.x + 26)}px, ${Math.round(p.y - 70)}px)`;
    $('#mfill').style.height = `${Math.min(1, v) * 100}%`;
    $('#mzone').style.bottom = `${(0.82 - w) * 100}%`; $('#mzone').style.height = `${w * 200}%`;
    $('#mfill').classList.toggle('g', Math.abs(v - 0.82) <= w);
  }

  /* ---------- controls ---------- */
  function bindControls() {
    const zone = $('#stickzone'), knob = $('#knob'), base = $('#stickbase');
    let sid = null, ox = 0, oy = 0;
    { const cv = $('#gl'); if (cv) cv.addEventListener('pointerdown', e => { const r = cv.getBoundingClientRect(); if (tapPass(e.clientX - r.left, e.clientY - r.top)) e.preventDefault(); }); }
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
      el.addEventListener('pointerdown', e => { e.preventDefault(); id = e.pointerId; sx = e.clientX; sy = e.clientY; el.classList.add('press'); try { el.setPointerCapture(id); } catch (err) { /* a pointer the browser no longer has */ } });
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
    /* the view's own size changing (a phone's bar sliding away changes it without a window resize) */
    if (window.ResizeObserver) new ResizeObserver(() => R.resize()).observe($('#game'));
    document.addEventListener('visibilitychange', () => { if (document.hidden && PB.Game.active && !G.paused) pause(true); });
  }
  /* the box score as it stands, for the pause menu: everyone who has played, the five on the floor first */
  function liveBox() {
    const mm = s => { const m = Math.floor((s || 0) / 60); return `${m}:${String(Math.floor((s || 0) % 60)).padStart(2, '0')}`; };
    return [0, 1].map(t => { const on = G.pl.filter(p => p.team === t).sort((a, b) => a.slot - b.slot).map(p => ({ name: p.name, st: p.st, on: true, user: p.isUser }));
      const off = ((G.bench && G.bench[t]) || []).filter(x => (x.st.secs || 0) > 0 || x.st.pts || x.st.fga).map(x => ({ name: x.name, st: x.st }));
      const rows = on.concat(off).map(r => `<tr class="${r.user ? 'me' : ''}"><td>${r.on ? '' : '<small>'}${r.name}${r.on ? '' : '</small>'}</td><td>${mm(r.st.secs)}</td><td><b>${r.st.pts}</b></td><td>${r.st.reb}</td><td>${r.st.ast}</td><td>${r.st.fgm}-${r.st.fga}</td><td>${r.st.pf || 0}</td><td>${(r.st.pm || 0) > 0 ? '+' : ''}${r.st.pm || 0}</td></tr>`).join('');
      return `<h4>${G.teams[t].name} <small>${G.score[t]}</small></h4><table class="std pbx"><tr><th></th><th>MIN</th><th>PTS</th><th>REB</th><th>AST</th><th>FG</th><th>PF</th><th>+/-</th></tr>${rows}</table>`; }).join('');
  }
  function pause(on) {
    G.paused = on;
    AU().muffle(on);
    const ov = $('#pause');
    ov.hidden = !on;
    ov.classList.toggle('pmenu', !!(on && G.park && opts.menu));
    /* in the park, pause is the menu: every mode, your career, settings, and the map */
    if (on && G.park && opts.menu) {
      if (G.tut) G.tut.menu = true;
      opts.menu(ov, { close: () => pause(false), go: id => { ov.hidden = true; G.paused = false; leavePark(id); },
        travel: id => { pause(false); parkTravel(id); }, stations: PARK, me: { x: G.user.x, z: G.user.z }, at: G.parkAt,
        tutorial: () => { pause(false); G.tut = { i: 0 }; const e = $('#tut'); if (e) e.hidden = false; } });
      return;
    }
    if (on) {
      ov.innerHTML = `<div class="card"><h2>Paused</h2>
        <div class="pmatch">${[0, 1].map(i => { const t = G.teams[i]; return `<div><i style="background:${t.c1};color:${PB.ink ? PB.ink(t.c1, t.c2) : '#fff'}">${t.ab || t.id}</i><b>${G.score[i]}</b><s>${'•'.repeat(Math.max(0, G.to ? G.to[i] : 0))}</s></div>`; }).join(`<span><small>${$('#qt').textContent}</small>${$('#clk').textContent}</span>`)}</div>
        <p class="mute pc">${G.user ? `Your grade ${gradeLetter(G.grade)}` : ''}</p>
        ${G.user && !G.drill ? (() => { const st = G.user.st; return `<p class="pline"><b>${st.pts}</b> pts · <b>${st.reb}</b> reb · <b>${st.ast}</b> ast · ${st.fgm}/${st.fga} FG · ${st.tpm}/${st.tpa} 3PT${st.pf ? ` · ${st.pf} PF` : ''}</p>`; })() : ''}
        ${opts.goals && G.user ? `<div class="pgoals"><b>Your goals</b>${opts.goals.map(g => { const v = g.k === 'grade' ? null : G.user.st[g.k] || 0; const ok = g.k === 'grade' ? LETTERS.indexOf(gradeLetter(G.grade)) >= g.n : g.k === 'tov' ? v <= g.n : v >= g.n;
          return `<span class="${ok ? 'w' : ''}">${ok ? '✓' : '○'} ${g.text}${g.k !== 'grade' ? ` <small>(${v})</small>` : ''}</span>`; }).join('')}</div>` : ''}
        <button class="big" id="pr">Resume</button>
        ${G.user && !G.drill && (G.poss === 0 || G.phase === 'dead') && G.to[0] > 0 ? `<button class="ghost" id="pto">Timeout <small>${G.to[0]} left this half</small></button>` : ''}
        ${G.user && !G.drill && !G.switching ? (() => {
          const cur = G.play && (G.play.id || G.play.kind), dc = G.dplay && G.dplay.kind, dk = Object.keys(DBOOK);
          const bt = o => `<button class="ghost sm${cur === o.id ? ' on' : ''}" data-play="${o.id}">${o.name}</button>`, db = k => `<button class="ghost sm${dc === k ? ' on' : ''}" data-dplay="${k}">${DBOOK[k].name}</button>`;
          return `<div class="plays"><b>Offense <small>${G.play && PLAYS[cur] ? `${PLAYS[cur][0]} · ${G.play.left + 1} more trip${G.play.left ? 's' : ''}` : 'call a play for the next three trips'}</small></b>
          <div class="row3">${BOOK.filter(o => o.cat === 'Quick').map(bt).join('')}</div>
          <b>Playbook <small>${BOOK.length} plays · ${dk.length} defenses</small></b>
          ${CATS.map(c => { const L = BOOK.filter(o => o.cat === c); return `<details class="help pcat"${L.some(o => o.id === cur) ? ' open' : ''}><summary>${c}<small>${L.length}</small></summary><div class="row3">${L.map(bt).join('')}</div></details>`; }).join('')}
          <b class="pdh">Defense <small>${G.dplay ? `${DPLAYS[dc][0]} · ${G.dplay.left + 1} more trip${G.dplay.left ? 's' : ''}` : 'for their next three trips'}</small></b>
          <div class="row3 r2">${dk.slice(0, 4).map(db).join('')}</div>
          <details class="help pcat"${dk.indexOf(dc) >= 4 ? ' open' : ''}><summary>Zones, traps and more<small>${dk.length - 4}</small></summary><div class="row3 r2">${dk.slice(4).map(db).join('')}</div></details></div>`; })() : ''}
        <button class="ghost" id="pc">Camera: ${R.CAMS[R.getCam()]}</button>
        ${PB.settings ? `<div class="card set">${[['psnd', 'Sound', PB.settings.sound !== false], ['pcom', 'Commentary', PB.settings.commentary !== false]].map(([id, n, on]) => `<div class="srow"><label>${n}</label><div class="seg sw"><button class="tog${on ? ' on' : ''}" id="${id}" role="switch" aria-checked="${on}" aria-label="${n}"><i></i></button></div></div>`).join('')}</div>` : ''}
        ${G.drill ? '' : `<details class="help pbox"><summary>Box score</summary>${liveBox()}</details>`}
        <button class="ghost" id="ps">${G.drill ? 'Finish' : 'Sim to the end'}</button>
        <details class="help"><summary>Controls</summary><p><b>Move</b><span>Left thumb. Push to the edge to sprint.</span></p><p><b>Shoot</b><span>Hold, and let go at the top of the jump (the green band). A quick tap is a pump fake. A perfect release goes in unless it is blocked.</span></p><p><b>Fadeaway</b><span>Pull the stick away from the rim as you shoot: you hop back and it is harder to contest. Out of a post-up it is a turnaround.</span></p><p><b>Pass</b><span>To the open man, or the one your stick points at. Or tap a teammate on the floor: the ball goes to him.</span></p><p><b>Move button</b><span>Tap for a crossover. Swipe left or right to cross that way, down for a step-back, up to spin to the rim.</span></p><p><b>Pick</b><span>With the ball: your big comes over to screen your man.</span></p><p><b>Off the ball</b><span>Call asks for it. Cut runs you to the rim.</span></p><p><b>Defense</b><span>Slide to stay between your man and the rim: get set in front and you cut him off. Steal when the button lights up. Jump as he shoots. Lift your thumb and you stay in front by yourself.</span></p><p><b>Keyboard</b><span>WASD, J or Space to shoot or jump, K pass or steal, L crossover, U step-back, I spin, O pick.</span></p></details></div>`;
      $('#pr').onclick = () => pause(false);
      if ($('#pto')) $('#pto').onclick = () => {
        /* a timeout: a breather, and late in the game the ball comes up to the frontcourt */
        G.to[0]--; ov.hidden = true; G.paused = false; AU().muffle(false);
        for (const p of G.pl) { if (p.energy !== undefined) p.energy = Math.min(1, p.energy + 0.4); p.shoot = null; p.drive = 0; }
        AU().play('whistle'); timeoutCine(0); B('timeout', { prio: 3, follow: 0.4 }); if (AU().organ) setTimeout(() => AU().organ('walk'), 800);
        const late = G.q >= 4 && G.clock < 120;
        G.poss = null;
        dead(2.4, () => {
          if (late) cut();
          if (late) for (const p of G.pl) { const c = toCourt(0, SPOTS[p.slot][0][0] * 0.9, p.team === 0 ? 30 : 24); p.x = c.x; p.z = c.z; p.vx = p.vz = 0; }
          const h = G.ball.holder && G.ball.holder.team === 0 ? G.ball.holder : G.pl.find(p => p.team === 0 && p.slot === 0);
          give(h); G.shotClock = Math.max(G.shotClock, late ? 14 : G.shotClock);
        });
      };
      ov.querySelectorAll('[data-play]').forEach(bt => bt.onclick = () => {
        const k = bt.dataset.play;
        if (G.play && (G.play.id || G.play.kind) === k) { G.play = null; pause(false); toast('Play off', 'call'); return; }
        G.play = mkPlay(k, G.poss === 0 ? 2 : 3); if (G.cp && G.cp.team === 0) G.cp = null;
        pause(false); toast(`${PLAYS[k][0]}: ${PLAYS[k][1]}`, 'call'); feed(`You call ${PLAYS[k][0].toLowerCase()}`);
      });
      ov.querySelectorAll('[data-dplay]').forEach(bt => bt.onclick = () => {
        const k = bt.dataset.dplay;
        if (G.dplay && G.dplay.kind === k) { G.dplay = null; pause(false); toast('Back to straight man', 'call'); return; }
        G.dplay = { kind: k, left: G.poss === 1 ? 2 : 3 };
        pause(false); toast(`${DPLAYS[k][0]}: ${DPLAYS[k][1]}`, 'call'); feed(`You call ${DPLAYS[k][0].toLowerCase()}`);
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
    toast: (t, k) => { if (G && PB.Game.active) toast(t, k); },
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
      /* a menu's 3D showcase (the start screen's player) hides the controls while it is up: never carry it into a game */
      if (R.showcase) R.showcase(null);
      if (R.cine) R.cine(null); $('#game').classList.remove('show', 'replaying', 'cine', 'cinepark');
      $('#game').hidden = false;
      { const g = $('#game'); g.style.animation = 'none'; void g.offsetWidth; g.style.animation = 'gamein .45s ease-out'; }   // every game and the park come up out of black
      if (!bound) { bindControls(); bound = true; }
      R.setCam(Object.keys(R.CAMS).find(k => R.CAMS[k] === (PB.settings && PB.settings.cam)) || 'lock');
      /* Player lock's distance, from Settings */
      { const L = { Closer: [34, 25, 6], Default: [42, 32, 8], Farther: [50, 39, 10] }[(PB.settings && PB.settings.camDist) || 'Default'] || [42, 32, 8]; R.lock.back = L[0]; R.lock.up = L[1]; R.lock.ahead = L[2]; R.lock.fov = 52; }
      R.resize();
      R.build(o.floor || o.teams[0]);
      const pl = [];
      o.rosters.forEach((ro, t) => ro.forEach((d, i) => {
        const p = mkOnCourt(d, t, o.slots ? o.slots[i] : i);
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
      /* the blacktop: half court, one rim, first to the target; no quarters, no free throws, no bench */
      if (o.half) { G.half = true; G.target = o.target || 21; G.ones = !!o.ones; G.mitt = !!o.mitt; G.by2 = o.by2 !== false; G.scLen = 20; G.shotClock = 20; G.qlen = 99; G.clock = 99 * 60; G.to = [0, 0]; }
      G.user = pl.find(p => p.isUser) || null;
      { const rp = $('#rp'); if (rp) rp.hidden = true; $('#game').classList.remove('replaying'); }   // nothing of the last game's replay is left on screen
      $('#game').classList.toggle('watching', !G.user && !o.drill); $('#game').classList.remove('park', 'horse'); { const pc = $('#parkcard'); if (pc) pc.hidden = true; const tu = $('#tut'); if (tu) tu.hidden = true; } if (R.setStations) R.setStations([]);   // spectating: the broadcast without the controls
      G.tko = !o.drill && !o.switching && G.user ? { m: 0, on: false, until: 0, miss: 0 } : null; tkoHud();
      G.home = o.floor && o.floor === o.teams[1] ? 1 : 0; G.squeakT = 0; G.organT = 20;
      G.switching = !!o.switching; if (G.switching) { $('#grade').hidden = true; }
      AU().music(false); AU().crowd.on(true); AU().crowd.level(0.3); AU().muffle(false);
      if (o.park) { AU().music(true); AU().crowd.level(0.05); }   // the park: the beat on, a few voices around the court
      if (PB.booth && (o.drill === 'dunk' || o.drill === 'contest')) { const L = PB.booth.load(); if (L) L.then(() => PB.booth.pa(o.drill === 'dunk' ? 'dk_intro' : 'contest_intro')); }
      if (PB.booth && !o.drill && !o.half) {
        /* the home city's own opening when it is recorded, the general one otherwise */
        const fl = o.floor || o.teams[0], has = k => k && PB.VO && PB.VO[k] && PB.VO[k].length;
        /* the night's own opening (a Game 7, a rival, a debut) when there is one, else the city's, else the general one */
        const ck = has(o.callIntro) ? o.callIntro : has('city_' + fl.id) ? 'city_' + fl.id : 'intro';
        const L = PB.booth.load(); if (L) L.then(() => { PB.booth.warm(); B(ck, { prio: 2 }); setTimeout(() => PB.booth.pa('pa_home_' + fl.id), 2600); }); else B(ck, { prio: 2 });
      }
      /* jump ball setup: everyone around the center circle */
      for (const p of pl) {
        const d = dirOf(p.team);
        const lay = [[0, -4], [-10, -8], [10, -8], [-6, -16], [6, -16]][p.slot] || [0, -12];
        p.x = lay[0] * (p.slot === 0 ? 1 : 1) + (p.slot === 0 ? 0 : 0); p.z = lay[1] * d;
        if (p.slot === 4) { p.x = 0; p.z = -2 * d; }
        if (p.slot === 0) { p.x = -4 * d; p.z = -6 * d; }
        p.face = p.team === 0 ? 0 : Math.PI;
      }
      G.ball.state = 'tip';
      /* the blacktop: no tip. Both sides stand above the arc, and one of them checks it up (a shot for first ball) */
      if (o.half) {
        const first = rand() < 0.5 ? 0 : 1;
        for (const p of pl) { const sp = SPOTS[p.slot][0], c = toCourt(p.team, sp[0] * 1.05, Math.max(sp[1], 22) + (p.team === first ? 0 : -3)); p.x = c.x; p.z = c.z; p.face = 0; }
        G.phase = 'dead'; G.deadT = 1.2; G.then = () => { checkBall(first); feed(`${G.teams[first].name} ball first`); };
        setTimeout(() => toast(`First to ${G.target}${G.by2 ? ', win by 2' : ''}`, 'call'), 400);
      }
      /* the opening: a sweep over the arena with the matchup on screen; a tap skips it */
      else if (!o.drill && !o.enterAt && !(o.stints && o.stints[0][0] > 0) && !o.scenario) {
        G.tipT = 8.4; R.setIntro(8.0, G.user);
        const iv = $('#intro');
        iv.innerHTML = `<div><i style="background:${o.teams[0].c1}"></i><b>${o.teams[0].city}</b><span>${o.teams[0].name}</span></div><em>vs</em><div><i style="background:${o.teams[1].c1}"></i><b>${o.teams[1].city}</b><span>${o.teams[1].name}</span></div><p>${(o.floor || o.teams[0]).city} · ${o.playoff ? 'Playoffs' : 'Tip-off'}</p>`;
        iv.className = ''; iv.hidden = false; clearTimeout(iv.h);
        /* then the starting lineups, the way the broadcast shows them */
        const shot = (p, t) => { try { if (!R.modelReady || !R.modelReady() || PB.noGL) return null;
          const key = [p.d.id || p.name, o.teams[t].id, t, JSON.stringify(p.d.look || '')].join('|'), C = R._shots || (R._shots = new Map());
          if (!C.has(key)) { if (C.size > 120) C.clear(); C.set(key, R.portrait(p.d, o.teams[t], 64, { close: true, kit: t === 0 ? 'icon' : 'assoc' })); }
          return C.get(key); } catch (e) { return null; } };
        /* coming off the bench, you are not in the starting five: the man who starts at your position is */
        const benched = !!(o.stints && o.stints[0][0] > 0 && G.user);
        const five = t => pl.filter(p => p.team === t).sort((a, b) => a.slot - b.slot).map(p0 => { let p = p0;
          if (benched && p0.isUser) { const st = ((G.bench && G.bench[t]) || []).filter(x => x.d && x.d.pos === p0.d.pos).sort((a, b) => (b.d.ovr || 0) - (a.d.ovr || 0))[0] || ((G.bench && G.bench[t]) || [])[0]; if (st) p = { d: st.d, name: st.name, num: st.num, isUser: false }; }
          const im = shot(p, t); return `<li class="${p.isUser ? 'me' : ''}">${im ? `<img alt="" src="${im}">` : ''}<u>${p.num}</u>${p.name}<small>${p.d.pos || ''}</small></li>`; }).join('');
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
      if (PB.kit && cd(kh.c1, ka.c1) < 120) ka = ['statement', 'city', 'icon'].map(k => PB.kit(awayT, k)).sort((a, c) => cd(kh.c1, c.c1) - cd(kh.c1, a.c1))[0];   // white looks like the home side too (a pale home kit): whichever of their others is furthest from it
      const k0 = hi === 0 ? kh : ka, k1 = hi === 0 ? ka : kh;
      for (const p of pl) R.addPlayer(p, o.park && p.team === 1 ? PB.kit(PB.TEAMS[(p.slot * 7 + 3) % PB.TEAMS.length], ['icon', 'assoc', 'city'][p.slot % 3]) : p.team === 0 ? k0 : k1);
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
      if (R.setBenches) R.setBenches(o.drill ? null : [k0, k1], o.bench);
      R.tag(o.rivalId ? pl.find(p => p.d.id === o.rivalId) || null : null, 'RIVAL');
      $('#a0').textContent = o.teams[0].ab || o.teams[0].id; $('#a1').textContent = o.teams[1].ab || o.teams[1].id;
      $('#sd0 i').style.background = o.teams[0].c1; $('#sd1 i').style.background = o.teams[1].c1;
      $('#feed').innerHTML = ''; $('#grade').innerHTML = G.user ? '<b>C+</b><span>Grade</span>' : '';
      $('#grade').hidden = !G.user || !!o.switching; $('#grade').classList.remove('why'); $('#ftmsg').hidden = true; $('#pause').hidden = true;
      if (o.drill) {
        const def = DRILLS[o.drill];
        G.drill = { kind: o.drill, def: o.drill === 'dunk' ? { ...def, dunks: o.dunks || def.dunks } : def, rack: 0, ball: 0, score: 0, made: 0, att: 0, t: def.secs, next: 0, over: false, n: 0, scores: [], style: 0 };
        if (R.setRacks) R.setRacks(def.balls ? def.spots.map(sp => Object.assign(toCourt(0, sp[0], sp[1]), { hz: hoopZ(0) })) : null, def.balls || 0, def.money);
        G.phase = 'live'; G.poss = 0; G.clock = def.secs;
        if (o.drill === 'dunk') { G.drill.next = 0.4; const sp = dunkSpot(); G.user.x = sp.x; G.user.z = sp.z; G.user.face = Math.atan2(-sp.x, hoopZ(0) - sp.z); }
        else if (o.drill === 'free') { const sp = toCourt(0, 0, 18); G.user.x = sp.x; G.user.z = sp.z; G.user.face = 0; give(G.user);
          if (o.park) { G.park = true; G.user.x = 8; G.user.z = -5; G.user.face = 1.2; R.setStations && R.setStations(PARK);   // looking over at the wall of doors
            /* back from a door: you come out of it, a step in front of its ring, facing the park */
            const from = o.parkAt && PARK.find(s => s.id === o.parkAt);
            if (from) { const sd = from.x > 0 ? -1 : 1; G.user.x = from.x + sd * (from.r + 3); G.user.z = from.z; G.user.face = -sd * Math.PI / 2; }   // turned back toward the door, the camera on the park side
            if (R.parkYaw) R.parkYaw(G.user.face);
            G.parkAt = undefined; G.tut = o.tutorial ? { i: Math.min(o.tutAt || 0, TUT.length - 1) } : null;
            { const gs = o.guide && PARK.find(x => x.id === o.guide); G.guideXZ = gs && !G.tut ? { x: gs.x, z: gs.z, id: gs.id } : null; } { const e = $('#tut'); if (e) e.hidden = !G.tut; }
            const HANDLES = ['SPLASHZONE', 'GLASSCLEANER', 'LOCKDOWN', 'FADEKING', 'DOWNTOWN', 'NOLOOK', 'BIGSHOT', 'BOARDMAN', 'HOOPDREAMS', 'ANKLES', 'MIDRANGE', 'BUCKETS'];
            for (const p of pl) if (p.team === 1) { p.npc = true; p.x = rr(-24, 24); p.z = rr(-48, 48); p.face = rand() * 6.28; p.name = p.d.handle || (p.d.handle = HANDLES[Math.floor(rand() * HANDLES.length)] + (Math.floor(rand() * 90) + 10)); }
            /* two of them have a ball and a rim each */
            pl.filter(p => p.npc).slice(0, 2).forEach((p, i) => { p.pbRim = i ? -1 : 1; p.z = p.pbRim * rr(22, 34); p.pb = { st: 'hold', x: p.x, y: 2, z: p.z, vx: 0, vy: 0, vz: 0 }; });
            $('#game').classList.add('park'); } }
        else if (o.drill === 'horse') { G.horse = true; G.user.x = 0; G.user.z = 20; G.user.face = 0; horseStart(); }
        else { const sp = drillSpot(); G.user.x = sp.x; G.user.z = sp.z - 3; G.user.face = 0; give(G.user); }
        $('#a0').textContent = 'PTS'; $('#a1').textContent = o.drill === 'dunk' ? 'DUNK' : 'SHOTS';
        $('#game').classList.toggle('horse', o.drill === 'horse');
        $('#grade').hidden = true;
        if (o.park && !parkCine && G.user && R.cine) { parkCine = true; const u = G.user, bk = (u.face || 0) + Math.PI;   // the first time in: down out of the sky to your shoulder
          cine([{ focus: u, a: [bk - 1.5, bk], r: [52, 17], h: [40, 10], ly: 4, dur: 3.2 }], 'Welcome to', `${(o.floor || o.teams[0]).city} Park`, { park: true }); }
        else setTimeout(() => toast(o.park ? `${(o.floor || o.teams[0]).city} Park` : def.title, 'call'), 200);
      }
      /* the second night of a back-to-back: your legs start heavier */
      if (o.tired && G.user) { G.user.energy = 0.78; setTimeout(() => feed('Second night of a back-to-back: heavy legs'), 600); }
      /* your minutes: the game before you check in is played out by the teams' strength, every point of it someone's */
      if (!o.stints && o.enterAt) opts.stints = o.stints = [[o.enterAt, 1]];
      if (o.stints && G.user && !o.drill && !o.scenario) {
        G.stint = 0;
        if (o.stints[0][0] > 0) {
          skipTime(o.stints[0][0] * G.qlen * 60 * 4, false); G.tipWinner = 0;
          checkIn(true);
          feed(`You start on the bench · ${clockTxt()}`);
        }
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
      { const sp = $('#statpop'); if (sp) sp.classList.remove('on'); }   // a stat card left over from the game's last seconds is not part of the reel
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
    resetTips: () => { seenTips = {}; },
    dbg: { plays: () => ({ PLAYS, DPLAYS, book: BOOK.map(o => o.id), dbook: Object.keys(DBOOK) }), call: id => { G.play = mkPlay(id, 9); return G.play; }, dcall: id => { G.dplay = id ? { kind: id, left: 9 } : null; }, state: () => G, opts: () => opts, hoopZ, parkGo: id => { if (G && G.park) { G.parkGo = id; finish(); } }, ft: n => { for (const p of G.pl) p.shoot = null; G.ftq = { shooter: G.user, n: n || 2, total: n || 2 }; startFT(); }, reelNow: label => { G.reelPend = { kind: 'dunk', val: 9, label: label || 'Test', at: G.t, q: G.q, clock: G.clock }; },
      auto: on => { G.auto = on; },
      replay: k => { replayCd = 0; wantReplay(k || 'dunk'); },
      /* run the simulation ahead without drawing: sec seconds of game time */
      run: sec => { for (let t = 0; t < sec && G.phase !== 'end'; t += 1 / 60) step(1 / 60); return G && { score: G.score, q: G.q, clock: G.clock, phase: G.phase }; }, simRest: () => simRest(), press: (b, down, k, d) => b === 'A' ? pressA(down) : b === 'B' ? pressB() : pressC(k, d), stick: (x, y) => { input.sx = x; input.sy = y; } },
  };
})();
