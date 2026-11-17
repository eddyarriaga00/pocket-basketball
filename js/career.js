/* PocketBasketball: menus and the career (the main mode). Exposes PB.Career and PB.boot.
   A career: create a player, draft night, then a season of games you play (your player only) or sim, a teammate
   grade every game, skill points to spend, standings, awards, the next season. Saved on the device. */
(() => {
  'use strict';
  const PB = window.PB;
  const $ = s => document.querySelector(s);
  const scr = () => $('#screen');
  const KEY = 'pbb.career.v1', SET = 'pbb.settings.v1';
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const load = k => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } };
  const store = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* private window: the career lasts the session */ } };
  let C = null;                                   // the career in play
  const S = Object.assign({ qlen: 3, level: 'Pro', season: 20, cam: 'Player lock', sound: true, music: true, soundOn: 'On', musicOn: 'On' }, load(SET) || {});
  PB.settings = S; PB.saveSettings = () => saveSettings();
  const saveSettings = () => store(SET, S);
  const save = () => { if (C) store(KEY, C); };

  function show(html) { const s = scr(); s.innerHTML = html; s.hidden = false; s.scrollTop = 0; }
  const badge = t => `<i class="tb" style="background:${t.c1};color:${t.c2}">${t.id}</i>`;
  const tname = t => `${t.city} ${t.name}`;

  /* ---------- title ---------- */
  function title() {
    if (PB.audio) PB.audio.music(true);
    C = load(KEY);
    show(`<div class="title">
      <div class="logo"><div class="ball"></div><h1>Pocket<br>Basketball</h1><p>Your career, from draft night to the Hall of Fame.</p></div>
      ${C ? `<button class="big" id="cont">Continue career<small>${esc(PB.full(C.me))} · ${esc(PB.team(C.team).name)} · Season ${C.year}</small></button>` : ''}
      <button class="${C ? 'ghost' : 'big'}" id="newc">New career</button>
      <button class="ghost" id="qg">Quick game</button>
      <div class="row2"><button class="ghost sm" id="how">How to play</button><button class="ghost sm" id="set">Settings</button></div>
      <p class="fine">Every team and player is fictional. Prototype build.</p></div>`);
    if (C) $('#cont').onclick = hub;
    $('#newc').onclick = () => { if (!C || confirm('Start a new career? Your current one will be replaced.')) create(); };
    $('#qg').onclick = quick;
    $('#how').onclick = how;
    $('#set').onclick = settings;
  }

  function how() {
    show(`<div class="page"><button class="back" id="bk">‹ Back</button><h2>How to play</h2>
      <div class="card"><h3>Moving</h3><p>Put your left thumb anywhere on the lower left and drag: the stick appears under it. Push to the edge to sprint.</p></div>
      <div class="card"><h3>With the ball</h3><p><b>Shoot</b>: hold, then let go at the top of your jump, when the meter crosses the green band. Close to the rim it is a layup or a dunk.<br>
      <b>Pass</b>: goes to the open man, or the one your stick points at.<br><b>Move</b>: a crossover; it can leave your man stumbling.</p></div>
      <div class="card"><h3>Without the ball</h3><p><b>Call</b> asks the ball handler for it. <b>Cut</b> runs you to the rim and calls for it.</p></div>
      <div class="card"><h3>Defense</h3><p>Lift your thumb and you stay in front of your man by yourself. <b>Jump</b> to contest, block and rebound. <b>Steal</b> to reach (too many reaches is a foul).</p></div>
      <div class="card"><h3>Your grade</h3><p>Every play moves your teammate grade: buckets, assists, boards, stops, and also bad shots, turnovers and your man scoring. The grade earns skill points after the game.</p></div>
      <div class="card"><h3>Keyboard</h3><p>WASD or arrows to move, J or Space to shoot or jump, K to pass, call or steal, L to move or cut, P to pause.</p></div></div>`);
    $('#bk').onclick = title;
  }

  function settings() {
    const opt = (k, vals, lab) => `<div class="field"><label>${lab}</label><div class="seg" data-k="${k}">${vals.map(v => `<button class="${S[k] == v ? 'on' : ''}" data-v="${v}">${typeof v === 'number' && k === 'qlen' ? v + ' min' : v}</button>`).join('')}</div></div>`;
    show(`<div class="page"><button class="back" id="bk">‹ Back</button><h2>Settings</h2>
      ${opt('soundOn', ['On', 'Off'], 'Sound')}
      ${opt('musicOn', ['On', 'Off'], 'Menu music')}
      ${opt('cam', ['Player lock', 'Broadcast', 'Overhead'], 'Camera')}
      ${opt('qlen', [2, 3, 5, 12], 'Quarter length')}
      ${opt('level', ['Rookie', 'Pro', 'All-Star', 'Legend'], 'Difficulty')}
      ${opt('season', [10, 20, 41, 82], 'Games in a career season (next season on)')}
      <p class="fine">Settings are kept on this device.</p></div>`);
    $('#bk').onclick = () => C && !scr().dataset.fromTitle ? title() : title();
    scr().querySelectorAll('.seg button').forEach(b => b.onclick = () => {
      const k = b.parentElement.dataset.k, v = b.dataset.v;
      S[k] = isNaN(+v) ? v : +v;
      S.sound = S.soundOn !== 'Off'; S.music = S.musicOn !== 'Off';
      saveSettings(); if (PB.audio) PB.audio.music(true); settings();
    });
  }

  /* ---------- quick game ---------- */
  function quick() {
    const opts = PB.TEAMS.map(t => `<option value="${t.id}">${tname(t)}</option>`).join('');
    show(`<div class="page"><button class="back" id="bk">‹ Back</button><h2>Quick game</h2>
      <div class="field"><label>Your team</label><select id="qa">${opts}</select></div>
      <div class="field"><label>Opponent</label><select id="qb">${opts}</select></div>
      <div class="field"><label>You play</label><div class="seg" id="qp">${PB.POS.map((p, i) => `<button data-v="${i}" class="${i === 0 ? 'on' : ''}">${p}</button>`).join('')}</div></div>
      <p class="fine">You control one player, your teammates play around you. ${S.qlen}-minute quarters, ${S.level}.</p>
      <button class="big" id="go">Tip off</button></div>`);
    $('#qb').value = 'BOS'; $('#qa').value = 'LAK';
    let slot = 0;
    scr().querySelectorAll('#qp button').forEach(b => b.onclick = () => { slot = +b.dataset.v; scr().querySelectorAll('#qp button').forEach(x => x.classList.toggle('on', x === b)); });
    $('#bk').onclick = title;
    $('#go').onclick = () => {
      const a = PB.team($('#qa').value), b = PB.team($('#qb').value);
      if (a === b) { alert('Pick two different teams.'); return; }
      const ra = PB.makeRoster(78).slice(0, 5), rb = PB.makeRoster(78).slice(0, 5);
      ra[slot].first = 'You'; ra[slot].last = 'You';
      scr().hidden = true;
      PB.Game.start({ teams: [a, b], rosters: [ra, rb], userId: ra[slot].id, qlen: S.qlen, level: S.level,
        strength: [PB.teamOvr(ra), PB.teamOvr(rb)], onEnd: r => result(r, null) });
    };
  }

  /* ---------- new career ---------- */
  function create() {
    const st = { pos: 'SG', arch: 'Sharpshooter', ht: 77, skin: 2 };
    const draw = () => {
      const archs = Object.keys(PB.ARCH).filter(a => PB.ARCH[a].pos.includes(st.pos));
      if (!archs.includes(st.arch)) st.arch = archs[0];
      const hr = PB.HEIGHT[st.pos]; st.ht = PB.clamp(st.ht, hr[0], hr[1]);
      const A = PB.ARCH[st.arch];
      const r = startRatings(st);
      const bars = PB.ATTRS.map(([k, n]) => `<div class="bar"><span>${n}</span><i><u style="width:${r[k]}%"></u><s style="left:${A.cap[k]}%"></s></i><b>${r[k]}</b></div>`).join('');
      show(`<div class="page"><button class="back" id="bk">‹ Back</button><h2>Create your player</h2>
        <div class="field"><label>Name</label><div class="row2"><input id="fn" maxlength="14" placeholder="First" value="${esc(st.first || '')}"><input id="ln" maxlength="16" placeholder="Last" value="${esc(st.last || '')}"></div></div>
        <div class="field"><label>Position</label><div class="seg" id="pos">${PB.POS.map(p => `<button class="${p === st.pos ? 'on' : ''}" data-v="${p}">${p}</button>`).join('')}</div></div>
        <div class="field"><label>Build</label><div class="arch">${archs.map(a => `<button class="${a === st.arch ? 'on' : ''}" data-v="${a}"><b>${a}</b><span>${PB.ARCH[a].tag}</span></button>`).join('')}</div></div>
        <div class="field"><label>Height · ${PB.fmtH(st.ht)}</label><input type="range" id="ht" min="${hr[0]}" max="${hr[1]}" value="${st.ht}"></div>
        <div class="field"><label>Skin tone</label><div class="skins">${PB.SKIN.map((c, i) => `<button class="${i === st.skin ? 'on' : ''}" data-v="${i}" style="background:${c}"></button>`).join('')}</div></div>
        <div class="field"><label>Jersey number</label><input id="num" type="number" min="0" max="99" value="${st.num ?? 1}"></div>
        <div class="card"><h3>Starting ratings <small>overall ${PB.ovr(r, st.pos)} · the tick is how far each can grow</small></h3>${bars}</div>
        <button class="big" id="go">Enter the draft</button></div>`);
      const keep = () => { st.first = $('#fn').value.trim(); st.last = $('#ln').value.trim(); st.num = PB.clamp(+$('#num').value || 0, 0, 99); };
      $('#bk').onclick = title;
      scr().querySelectorAll('#pos button').forEach(b => b.onclick = () => { keep(); st.pos = b.dataset.v; st.ht = Math.round((PB.HEIGHT[st.pos][0] + PB.HEIGHT[st.pos][1]) / 2); draw(); });
      scr().querySelectorAll('.arch button').forEach(b => b.onclick = () => { keep(); st.arch = b.dataset.v; draw(); });
      scr().querySelectorAll('.skins button').forEach(b => b.onclick = () => { keep(); st.skin = +b.dataset.v; draw(); });
      $('#ht').oninput = e => { keep(); st.ht = +e.target.value; draw(); };
      $('#go').onclick = () => { keep(); if (!st.first || !st.last) { alert('Give your player a first and last name.'); return; } begin(st); };
    };
    draw();
  }
  /* height trades a little: taller is better at the rim and on the glass, shorter is quicker with the ball */
  function startRatings(st) {
    const A = PB.ARCH[st.arch], hr = PB.HEIGHT[st.pos];
    const t = (st.ht - (hr[0] + hr[1]) / 2) / ((hr[1] - hr[0]) / 2 || 1);    // -1 short .. +1 tall
    const r = {};
    for (const [k] of PB.ATTRS) {
      let v = A.base[k];
      if (['reb', 'block', 'inD', 'dunk', 'close'].includes(k)) v += Math.round(t * 4);
      if (['speed', 'handle', 'steal', 'perD'].includes(k)) v -= Math.round(t * 4);
      r[k] = PB.clamp(v, 25, A.cap[k]);
    }
    return r;
  }

  function begin(st) {
    const strengths = {};
    const rosters = {};
    for (const t of PB.TEAMS) { strengths[t.id] = Math.round(PB.rr(70, 82)); rosters[t.id] = PB.makeRoster(strengths[t.id]); }
    const r = startRatings(st);
    const me = { id: 'me', first: st.first, last: st.last, pos: st.pos, arch: st.arch, ht: st.ht, skin: st.skin, num: st.num, age: 19, r, sp: 0, me: true };
    me.ovr = PB.ovr(r, st.pos);
    /* draft position: lottery teams (the weakest) pick first; your stock sets the pick */
    const order = PB.TEAMS.slice().sort((a, b) => strengths[a.id] - strengths[b.id] + PB.gauss() * 3);
    const pick = PB.clamp(Math.round(14 - (me.ovr - 62) * 1.6 + PB.gauss() * 3), 1, 30);
    const team = order[pick - 1].id;
    C = { v: 1, me, team, pick, year: 1, rosters, standings: {}, games: [], gi: 0, news: [], seasons: [], totals: zero(), awards: [], trophies: [] };
    newSeason();
    save();
    draft();
  }
  const zero = () => ({ gp: 0, min: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, fga: 0, fgm: 0, tpa: 0, tpm: 0, fta: 0, ftm: 0, w: 0, l: 0, grades: 0 });

  function newSeason() {
    C.standings = {}; for (const t of PB.TEAMS) C.standings[t.id] = { w: 0, l: 0 };
    const n = S.season;
    const others = PB.TEAMS.filter(t => t.id !== C.team).map(t => t.id);
    const sched = [];
    while (sched.length < n) { const sh = others.slice().sort(() => PB.rand() - 0.5); for (const o of sh) if (sched.length < n) sched.push(o); }
    C.games = sched.map((o, i) => ({ opp: o, home: i % 2 === 0, done: false }));
    C.gi = 0; C.season = zero(); C.len = n;
    C.news.unshift(`Season ${C.year} begins: ${n} games, ${PB.TEAMS.length} teams.`);
  }

  function draft() {
    const t = PB.team(C.team), me = C.me;
    const ord = n => n + (['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : n % 10] || 'th');
    show(`<div class="draft" style="--c1:${t.c1};--c2:${t.c2}">
      <p class="kick">Draft night</p>
      <div class="podium"><p>With the ${ord(C.pick)} pick, the</p><h2>${esc(tname(t))}</h2><p>select</p>
      <h1>${esc(PB.full(me))}</h1><p class="mute">${PB.POS_NAME[me.pos]} · ${me.arch} · ${PB.fmtH(me.ht)} · overall ${me.ovr}</p></div>
      <div class="cap" style="background:${t.c1};color:${t.c2}">${t.id}<b>#${me.num}</b></div>
      <p class="fine">A four-year rookie deal. ${roleLine()}</p>
      <button class="big" id="go">Go to the team</button></div>`);
    $('#go').onclick = hub;
  }

  /* ---------- team helpers ---------- */
  const myRoster = () => C.rosters[C.team];
  function starters(teamId) {
    const ro = C.rosters[teamId].slice();
    const five = PB.POS.map(pos => ro.filter(p => p.pos === pos).sort((a, b) => b.ovr - a.ovr)[0]);
    return five;
  }
  function role() {
    const same = myRoster().filter(p => p.pos === C.me.pos).sort((a, b) => b.ovr - a.ovr)[0];
    const d = C.me.ovr - same.ovr;
    return d >= -1 ? 'Starter' : d >= -6 ? 'Sixth man' : 'Bench';
  }
  const roleLine = () => { const r = role(); return r === 'Starter' ? 'The coach has you in the starting five.' : r === 'Sixth man' ? 'You come off the bench as the first man in, and you start when the starter rests.' : 'You start on the bench: play well and the minutes come.'; };
  const strength = id => PB.teamOvr(C.rosters[id].concat(id === C.team ? [C.me] : []));
  function liveFive() {
    /* you take your position's spot in the five */
    const five = starters(C.team).map(p => p);
    five[PB.POS.indexOf(C.me.pos)] = C.me;
    return five;
  }

  /* ---------- the league around you ---------- */
  function simLeagueDay(myOpp) {
    const ids = PB.TEAMS.map(t => t.id).filter(id => id !== C.team && id !== myOpp).sort(() => PB.rand() - 0.5);
    for (let i = 0; i + 1 < ids.length; i += 2) {
      const a = ids[i], b = ids[i + 1];
      const pa = 1 / (1 + Math.exp(-(strength(a) - strength(b)) / 4));
      const w = PB.rand() < pa ? a : b, l = w === a ? b : a;
      C.standings[w].w++; C.standings[l].l++;
    }
  }

  /* ---------- the hub ---------- */
  let tab = 'home';
  function hub() {
    if (PB.audio) PB.audio.music(true);
    if (C.gi >= C.games.length) { seasonEnd(); return; }
    const t = PB.team(C.team), me = C.me, g = C.games[C.gi], o = PB.team(g.opp);
    const st = C.standings[C.team], os = C.standings[g.opp];
    const s = C.season, gp = s.gp || 1;
    const avg = k => (s[k] / gp).toFixed(1);
    const tabs = ['home', 'player', 'league', 'log'];
    let body = '';
    if (tab === 'home') {
      body = `<div class="next">
        <p class="kick">Game ${C.gi + 1} of ${C.games.length} · ${g.home ? 'Home' : 'Away'}</p>
        <div class="vs"><div>${badge(t)}<b>${t.name}</b><span>${st.w}-${st.l} · ${strength(C.team)}</span></div><em>vs</em>
        <div>${badge(o)}<b>${o.name}</b><span>${os.w}-${os.l} · ${strength(o.id)}</span></div></div>
        <p class="fine">Their ${me.pos}: ${esc(PB.full(starters(o.id)[PB.POS.indexOf(me.pos)]))} (${starters(o.id)[PB.POS.indexOf(me.pos)].ovr}). You guard him.</p>
        <button class="big" id="play">Play game</button><button class="ghost" id="sim">Sim game</button></div>
        <div class="tiles">
          <div><b>${avg('pts')}</b><span>PTS</span></div><div><b>${avg('reb')}</b><span>REB</span></div><div><b>${avg('ast')}</b><span>AST</span></div>
          <div><b>${s.fga ? Math.round(s.fgm / s.fga * 100) : 0}%</b><span>FG</span></div><div><b>${s.tpa ? Math.round(s.tpm / s.tpa * 100) : 0}%</b><span>3PT</span></div><div><b>${s.gp ? gradeAvg(s.grades / s.gp) : '–'}</b><span>GRADE</span></div></div>
        <div class="card"><h3>News</h3>${C.news.slice(0, 5).map(n => `<p class="news">${esc(n)}</p>`).join('')}</div>`;
    } else if (tab === 'player') {
      const A = PB.ARCH[me.arch];
      body = `<div class="card"><h3>${esc(PB.full(me))} <small>${me.pos} · ${me.arch} · age ${me.age} · ${role()}</small></h3>
        <div class="ovr"><b>${me.ovr}</b><span>overall</span><em>${me.sp} skill points</em></div>
        ${PB.ATTRS.map(([k, n, d]) => { const c = cost(me.r[k]); const can = me.r[k] < A.cap[k] && me.sp >= c;
          return `<div class="bar up"><span>${n}<small>${d}</small></span><i><u style="width:${me.r[k]}%"></u><s style="left:${A.cap[k]}%"></s></i><b>${me.r[k]}</b>
          <button data-k="${k}" ${can ? '' : 'disabled'}>+1<small>${me.r[k] >= A.cap[k] ? 'max' : c + ' SP'}</small></button></div>`; }).join('')}
        <p class="fine">Skill points come from your teammate grade after every game, more for a win. Each point higher costs more.</p></div>`;
    } else if (tab === 'league') {
      const conf = c => PB.TEAMS.filter(x => x.conf === c).map(x => ({ x, s: C.standings[x.id] }))
        .sort((a, b) => (b.s.w - b.s.l) - (a.s.w - a.s.l) || b.s.w - a.s.w)
        .map((e, i) => `<tr class="${e.x.id === C.team ? 'me' : ''} ${i === 5 ? 'cut' : i === 9 ? 'cut2' : ''}"><td>${i + 1}</td><td>${badge(e.x)} ${e.x.name}</td><td>${e.s.w}</td><td>${e.s.l}</td><td>${strength(e.x.id)}</td></tr>`).join('');
      body = ['East', 'West'].map(c => `<div class="card"><h3>${c}</h3><table class="std"><tr><th></th><th>Team</th><th>W</th><th>L</th><th>OVR</th></tr>${conf(c)}</table></div>`).join('')
        + `<p class="fine">Top six make the playoffs; seven to ten go to the play-in (coming in a later build).</p>`;
    } else {
      body = `<div class="card"><h3>Season ${C.year} game log</h3>${C.games.filter(x => x.done).map((x, i) => `<div class="glog"><span>${i + 1}</span>${badge(PB.team(x.opp))}
        <b class="${x.res.win ? 'w' : 'l'}">${x.res.win ? 'W' : 'L'} ${x.res.us}-${x.res.them}</b><em>${x.res.line.pts} pts · ${x.res.line.reb} reb · ${x.res.line.ast} ast</em><i>${x.res.grade}${x.res.sim ? ' · sim' : ''}</i></div>`).join('') || '<p class="mute">No games yet.</p>'}</div>
        ${C.seasons.length ? `<div class="card"><h3>Career</h3>${C.seasons.map(z => `<div class="glog"><span>Y${z.year}</span>${badge(PB.team(z.team))}<b>${z.w}-${z.l}</b><em>${z.ppg} / ${z.rpg} / ${z.apg}</em><i>${z.awards.join(', ') || '–'}</i></div>`).join('')}</div>` : ''}`;
    }
    show(`<div class="hub" style="--c1:${t.c1};--c2:${t.c2}">
      <div class="hubtop"><div class="me">${badge(t)}<div><b>${esc(PB.full(me))}</b><span>#${me.num} · ${me.pos} · ${me.ovr} OVR · Season ${C.year}</span></div></div>
      <button class="ic" id="menu" aria-label="Menu">⌂</button></div>
      <nav class="tabs">${tabs.map(x => `<button class="${x === tab ? 'on' : ''}" data-t="${x}">${{ home: 'Home', player: 'Player', league: 'League', log: 'Log' }[x]}</button>`).join('')}</nav>
      <div class="hubbody">${body}</div></div>`);
    scr().querySelectorAll('.tabs button').forEach(b => b.onclick = () => { tab = b.dataset.t; hub(); });
    $('#menu').onclick = title;
    if ($('#play')) $('#play').onclick = playGame;
    if ($('#sim')) $('#sim').onclick = simGame;
    scr().querySelectorAll('.bar.up button').forEach(b => b.onclick = () => {
      const k = b.dataset.k, c = cost(me.r[k]);
      if (me.sp < c) return;
      me.sp -= c; me.r[k]++; me.ovr = PB.ovr(me.r, me.pos); save(); hub();
    });
  }
  const cost = v => v < 60 ? 1 : v < 70 ? 2 : v < 80 ? 3 : v < 90 ? 4 : 6;
  const LET = ['F', 'D-', 'D', 'D+', 'C-', 'C', 'C+', 'B-', 'B', 'B+', 'A-', 'A', 'A+'];
  const gradeAvg = v => LET[PB.clamp(Math.round(v), 0, 12)];

  function playGame() {
    const g = C.games[C.gi];
    const t = PB.team(C.team), o = PB.team(g.opp);
    scr().hidden = true;
    PB.Game.start({ teams: [t, o], rosters: [liveFive(), starters(o.id)], userId: 'me', qlen: S.qlen, level: S.level,
      floor: g.home ? t : o, strength: [strength(C.team), strength(o.id)], onEnd: r => result(r, g) });
  }

  /* a simmed game: your line comes from your ratings and role */
  function simGame() {
    const g = C.games[C.gi], me = C.me, r = me.r;
    const pa = 1 / (1 + Math.exp(-(strength(C.team) - strength(g.opp) + (g.home ? 2 : -2)) / 4));
    const win = PB.rand() < pa;
    const base = 104 + PB.gauss() * 9, margin = Math.abs(PB.gauss() * 9) + 1;
    const us = Math.round(win ? base + margin / 2 : base - margin / 2), them = Math.round(win ? base - margin / 2 : base + margin / 2);
    const mins = role() === 'Starter' ? 32 : role() === 'Sixth man' ? 24 : 14;
    const usage = (me.ovr - 40) / 50 * mins / 32;
    const tpa = Math.round(Math.max(0, (r.three - 40) / 10 * usage + PB.gauss())), fga2 = Math.round(Math.max(1, 9 * usage + (r.close + r.mid - 100) / 20 + PB.gauss() * 2));
    const tpm = binom(tpa, 0.2 + r.three / 99 * 0.2), fgm2 = binom(fga2, 0.38 + (r.close + r.mid) / 198 * 0.2);
    const fta = Math.round(Math.max(0, (r.close + r.dunk) / 40 * usage + PB.gauss())), ftm = binom(fta, 0.45 + r.ft / 99 * 0.45);
    const line = { pts: fgm2 * 2 + tpm * 3 + ftm, reb: Math.max(0, Math.round((r.reb - 30) / 10 * usage + PB.gauss() * 1.5)), ast: Math.max(0, Math.round((r.pass - 35) / 9 * usage + PB.gauss() * 1.5)),
      stl: binom(3, r.steal / 250), blk: binom(3, r.block / 250), tov: binom(4, 0.25), fga: tpa + fga2, fgm: tpm + fgm2, tpa, tpm, fta, ftm };
    const gs = PB.clamp(Math.round(6 + (line.pts - 10) / 6 + (line.ast + line.reb) / 8 + (win ? 0.5 : -0.5) + PB.gauss() * 0.8) , 0, 12);
    record(g, { us, them, win, line, grade: LET[gs], gscore: gs, sim: true, mins });
    after(g, true);
  }
  const binom = (n, p) => { let k = 0; for (let i = 0; i < n; i++) if (PB.rand() < p) k++; return k; };

  function record(g, res) {
    g.done = true; g.res = res;
    const s = C.season, T = C.totals;
    for (const k of ['pts', 'reb', 'ast', 'stl', 'blk', 'tov', 'fga', 'fgm', 'tpa', 'tpm', 'fta', 'ftm']) { s[k] += res.line[k]; T[k] += res.line[k]; }
    s.gp++; T.gp++; s.grades += res.gscore; T.grades += res.gscore;
    if (res.win) { s.w++; T.w++; C.standings[C.team].w++; C.standings[g.opp].l++; } else { s.l++; T.l++; C.standings[C.team].l++; C.standings[g.opp].w++; }
    simLeagueDay(g.opp);
    /* skill points from the grade */
    const sp = Math.max(1, Math.round(res.gscore * 0.9 + (res.win ? 2 : 0)));
    res.sp = sp; C.me.sp += sp;
    const o = PB.team(g.opp);
    const hl = res.line.pts >= 30 ? `${C.me.last} drops ${res.line.pts} on the ${o.name}` :
      res.line.pts >= 20 ? `${C.me.last} scores ${res.line.pts} as the ${PB.team(C.team).name} ${res.win ? 'beat' : 'fall to'} ${o.city}` :
      `${PB.team(C.team).name} ${res.win ? 'win' : 'lose'} ${res.us}-${res.them} against ${o.city}`;
    C.news.unshift(hl);
    C.news = C.news.slice(0, 30);
    C.gi++;
    save();
  }

  function after(g, sim) {
    const r = g.res, o = PB.team(g.opp), t = PB.team(C.team), l = r.line;
    show(`<div class="page post"><p class="kick">${sim ? 'Simulated' : 'Final'}</p>
      <div class="final"><div>${badge(t)}<b>${r.us}</b></div><em>${r.win ? 'WIN' : 'LOSS'}</em><div><b>${r.them}</b>${badge(o)}</div></div>
      <div class="gradebig"><b>${r.grade}</b><span>Teammate grade</span></div>
      <div class="tiles"><div><b>${l.pts}</b><span>PTS</span></div><div><b>${l.reb}</b><span>REB</span></div><div><b>${l.ast}</b><span>AST</span></div>
      <div><b>${l.fgm}/${l.fga}</b><span>FG</span></div><div><b>${l.tpm}/${l.tpa}</b><span>3PT</span></div><div><b>${l.stl}/${l.blk}</b><span>STL/BLK</span></div></div>
      ${r.log && r.log.length ? `<div class="card"><h3>What moved your grade</h3>${summarize(r.log)}</div>` : ''}
      <div class="card earn"><b>+${r.sp} skill points</b><span>${C.me.sp} to spend on the Player tab</span></div>
      <button class="big" id="go">Continue</button></div>`);
    $('#go').onclick = () => { tab = 'home'; hub(); };
  }
  function summarize(log) {
    const m = new Map();
    for (const [d, w] of log) { const e = m.get(w) || { n: 0, d: 0 }; e.n++; e.d += d; m.set(w, e); }
    return [...m].sort((a, b) => Math.abs(b[1].d) - Math.abs(a[1].d)).slice(0, 8)
      .map(([w, e]) => `<div class="gl"><span>${esc(w)}${e.n > 1 ? ` ×${e.n}` : ''}</span><b class="${e.d >= 0 ? 'w' : 'l'}">${e.d >= 0 ? '+' : ''}${e.d.toFixed(1)}</b></div>`).join('');
  }

  /* a played game comes back here */
  function result(res, g) {
    if (!g) {   // quick game
      const u = res.user || {};
      show(`<div class="page post"><p class="kick">Final</p>
        <div class="final"><div>${badge(res.teams[0])}<b>${res.score[0]}</b></div><em>${res.score[0] > res.score[1] ? 'WIN' : 'LOSS'}</em><div><b>${res.score[1]}</b>${badge(res.teams[1])}</div></div>
        <div class="gradebig"><b>${res.grade || '–'}</b><span>Teammate grade</span></div>
        <div class="tiles"><div><b>${u.pts || 0}</b><span>PTS</span></div><div><b>${u.reb || 0}</b><span>REB</span></div><div><b>${u.ast || 0}</b><span>AST</span></div>
        <div><b>${u.fgm || 0}/${u.fga || 0}</b><span>FG</span></div><div><b>${u.tpm || 0}/${u.tpa || 0}</b><span>3PT</span></div><div><b>${u.stl || 0}/${u.blk || 0}</b><span>STL/BLK</span></div></div>
        ${boxScore(res)}
        <button class="big" id="go">Main menu</button></div>`);
      $('#go').onclick = title;
      return;
    }
    const gi = LET.indexOf(res.grade);
    const line = Object.assign({ pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, fga: 0, fgm: 0, tpa: 0, tpm: 0, fta: 0, ftm: 0 }, res.user || {});
    record(g, { us: res.score[0], them: res.score[1], win: res.score[0] > res.score[1], line, grade: res.grade, gscore: gi < 0 ? 6 : gi, sim: false, log: res.gradeLog });
    after(g, false);
  }
  function boxScore(res) {
    const rows = t => res.box.filter(b => b.team === t).map(b => `<tr class="${b.user ? 'me' : ''}"><td>${esc(b.d.last)}</td><td>${b.st.pts}</td><td>${b.st.reb}</td><td>${b.st.ast}</td><td>${b.st.fgm}-${b.st.fga}</td><td>${b.st.tpm}-${b.st.tpa}</td></tr>`).join('');
    return [0, 1].map(t => `<div class="card"><h3>${res.teams[t].name}</h3><table class="std"><tr><th></th><th>PTS</th><th>REB</th><th>AST</th><th>FG</th><th>3P</th></tr>${rows(t)}</table></div>`).join('');
  }

  /* ---------- end of a season ---------- */
  function seasonEnd() {
    const s = C.season, gp = s.gp || 1, me = C.me;
    const ppg = s.pts / gp, rpg = s.reb / gp, apg = s.ast / gp;
    const st = C.standings[C.team];
    const rank = PB.TEAMS.filter(x => x.conf === PB.team(C.team).conf).map(x => x.id)
      .sort((a, b) => (C.standings[b].w - C.standings[b].l) - (C.standings[a].w - C.standings[a].l)).indexOf(C.team) + 1;
    const aw = [];
    if (C.year === 1 && ppg >= 13) aw.push('Rookie of the Year');
    if (ppg >= 20 || (ppg >= 15 && (rpg >= 9 || apg >= 7))) aw.push('All-Star');
    if (ppg >= 26 && st.w / Math.max(1, st.w + st.l) > 0.6) aw.push('MVP');
    if (rank <= 6) aw.push('Playoffs');
    C.seasons.push({ year: C.year, team: C.team, w: st.w, l: st.l, ppg: ppg.toFixed(1), rpg: rpg.toFixed(1), apg: apg.toFixed(1), awards: aw });
    show(`<div class="page post"><p class="kick">Season ${C.year} is over</p>
      <h2>${st.w}-${st.l} · ${ordinal(rank)} in the ${PB.team(C.team).conf}</h2>
      <div class="tiles"><div><b>${ppg.toFixed(1)}</b><span>PPG</span></div><div><b>${rpg.toFixed(1)}</b><span>RPG</span></div><div><b>${apg.toFixed(1)}</b><span>APG</span></div></div>
      <div class="card"><h3>Honors</h3>${aw.length ? aw.map(a => `<p class="news">🏆 ${a}</p>`).join('') : '<p class="mute">None this year. Next year.</p>'}</div>
      <p class="fine">The playoffs, the play-in, free agency and contracts come in later builds (see the plan).</p>
      <button class="big" id="go">Start season ${C.year + 1}</button></div>`);
    $('#go').onclick = () => {
      C.year++; me.age++;
      /* the offseason: young players grow, everyone drifts a little */
      for (const id in C.rosters) for (const p of C.rosters[id]) {
        const d = p.age < 24 ? 2 : p.age < 29 ? 0.5 : p.age < 32 ? -1 : -3;
        p.age++; for (const k in p.r) p.r[k] = PB.clamp(Math.round(p.r[k] + d + PB.gauss()), 25, 99); p.ovr = PB.ovr(p.r, p.pos);
      }
      me.sp += 6;
      newSeason(); save(); tab = 'home'; hub();
    };
  }
  const ordinal = n => n + (['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : n % 10] || 'th');

  PB.Career = { title, hub, get: () => C };
  PB.boot = () => {
    PB.R.init($('#gl'));
    title();
  };
})();
