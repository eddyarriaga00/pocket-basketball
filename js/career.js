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
  const S = Object.assign({ qlen: 3, level: 'Pro', season: 20, cam: 'Player lock', sound: true, music: true, soundOn: 'On', musicOn: 'On', commentaryOn: 'On', commentary: true, replaysOn: 'On', replays: true, vibrateOn: 'On', vibrate: true, timing: 'Normal', hand: 'Right-handed', radarOn: 'On', radar: true, offOn: 'On', gfx: 'High', camDist: 'Default', btnSize: 'Normal', tapShoot: 'Pump fake', ball: 'Classic', fxOn: 'On', shakeOn: 'On', meterOn: 'On', speed: 'Normal', fouls: 'Normal', fatigueOn: 'On', coachPlays: 'On', introOn: 'On', warmOn: 'On', freezeOn: 'On', slowOn: 'On', callsOn: 'On', quipsOn: 'On', feedOn: 'On', volCrowd: 'Normal', volMusic: 'Normal', volSfx: 'Normal', volBooth: 'Normal' }, load(SET) || {});
  PB.settings = S; PB.saveSettings = () => saveSettings();
  const saveSettings = () => store(SET, S);
  /* careers: up to six kept on this device, one of them current. A career saved by an older build (one slot) moves
     into the first. */
  const IDX = 'pbb.careers', CUR = 'pbb.current';
  const slots = () => load(IDX) || [];
  const curId = () => { try { return localStorage.getItem(CUR); } catch (e) { return null; } };
  const setCur = id => { try { localStorage.setItem(CUR, id); } catch (e) { /* fine */ } };
  (function migrate() {
    const old = load(KEY);
    if (old && !slots().length) { store('pbb.career.c1', old); store(IDX, [{ id: 'c1' }]); setCur('c1'); try { localStorage.removeItem(KEY); } catch (e) { /* fine */ } }
  })();
  const loadCur = () => { const id = curId(); return id ? load('pbb.career.' + id) : null; };
  /* a save can come from anywhere (an imported file, an edited one): before it is played its text loses anything that
     could be markup, numbers that are not numbers become zero, and the player's ratings, skill points and money are
     held to what the game itself can give */
  const clean = (v, d) => { d = d || 0; if (d > 14) return null;
    if (typeof v === 'string') return v.replace(/[<>]/g, '').slice(0, 6000);
    if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
    if (Array.isArray(v)) { for (let i = 0; i < v.length; i++) v[i] = clean(v[i], d + 1); return v; }
    if (v && typeof v === 'object') { for (const k of Object.keys(v)) { if (k === '__proto__' || k === 'constructor' || k === 'prototype' || /[<>]/.test(k)) { delete v[k]; continue; } v[k] = clean(v[k], d + 1); } return v; }
    return v; };
  const guard = c => { if (!c || typeof c !== 'object' || Array.isArray(c)) return null; clean(c);
    const m = c.me; if (!m || typeof m !== 'object' || !c.rosters || typeof c.rosters !== 'object') return c;
    const num = (o, k, lo, hi, d) => { if (o[k] === undefined) return; const v = +o[k]; o[k] = Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : d; };
    if (m.r && typeof m.r === 'object') for (const k of Object.keys(m.r)) num(m.r, k, 1, 99, 50);
    if (m.perks && typeof m.perks === 'object') { const ok = a => (Array.isArray(a) ? a : []).filter((id, i, l) => typeof id === 'string' && PB.PERKS && PB.PERKS[id] && l.indexOf(id) === i); m.perks.own = ok(m.perks.own); m.perks.on = ok(m.perks.on).filter(id => m.perks.own.includes(id)).slice(0, 3); } else if (m.perks !== undefined) delete m.perks;
    num(m, 'ovr', 1, 99, 60); num(m, 'sp', 0, 400, 0); num(m, 'age', 17, 50, 19); num(m, 'num', 0, 99, 0);
    num(c, 'fans', 0, 2e9, 0); num(c, 'earnings', 0, 5000, 0); num(c, 'trust', 0, 100, 50); num(c, 'year', 1, 60, 1); num(c, 'vc', 0, 1e7, 0); num(c, 'coins', 0, 1e7, 0);
    for (const k of ['first', 'last', 'from']) if (typeof m[k] === 'string') m[k] = m[k].slice(0, 24);
    /* rosters of ten from before: filled out to fifteen */
    for (const id of Object.keys(c.rosters)) { const ro = c.rosters[id]; if (Array.isArray(ro) && ro.length && ro.length < 15) { const top = ro.map(p => +p.ovr || 60).sort((a, b) => b - a); PB.fillRoster(ro, top[Math.min(2, top.length - 1)], c.rosters); } }
    return c; };
  const openCur = () => guard(loadCur());
  /* your name outside a career: your career player's, or one of your own kept on the device */
  const youName = () => { const c = loadCur(); if (c && c.me) return [c.me.first, c.me.last]; let n = load('pbb.you'); if (!n) { n = PB.randName().split(' '); store('pbb.you', n); } return n; };
  /* achievements: across every career on this device, kept even when a career is deleted */
  const ACH = [
    ['drafted', 'Welcome to the league', 'Get drafted', C => !!C.team],
    ['lottery', 'Lottery pick', 'Go in the top five', C => C.pick && C.pick <= 5],
    ['undrafted', 'Nobody called', 'Make a roster undrafted', C => C.path === 'undrafted' && !!C.team],
    ['converted', 'Earned it', 'Turn a two-way deal into a real contract', C => C.path === 'undrafted' && C.contract && C.contract.kind !== 'Two-way deal'],
    ['starter', 'Starting five', 'Earn a starting role', C => (C.trust || 0) >= 70],
    ['g30', 'Thirty-piece', 'Score 30 in a game', C => (C.highs || {}).pts >= 30],
    ['g40', 'Forty-burger', 'Score 40 in a game', C => (C.highs || {}).pts >= 40],
    ['g50', 'Fifty', 'Score 50 in a game', C => (C.highs || {}).pts >= 50],
    ['td', 'Triple-double', 'Double figures in three stats', C => !!(C.miles || {}).td],
    ['winner', 'Ice in the veins', 'Hit a game-winner', C => !!(C.miles || {}).winner],
    ['allstar', 'All-Star', 'Make an All-Star team', C => C.trophies.some(t => /^All-Star,/.test(t))],
    ['cup', 'Cup winner', 'Win the in-season tournament', C => C.trophies.some(t => /^Cup champion/.test(t))],
    ['potw', 'Player of the Week', 'Win a Player of the Week', C => C.trophies.some(t => /Player of the Week/.test(t))],
    ['three', 'From way downtown', 'Win the 3-Point Contest', C => C.trophies.some(t => /3-Point Contest champion/.test(t))],
    ['dunk', 'Above the rim', 'Win the Dunk Contest', C => C.trophies.some(t => /Dunk Contest champion/.test(t))],
    ['roy', 'Rookie of the Year', 'Win Rookie of the Year', C => C.trophies.some(t => /Rookie of the Year/.test(t))],
    ['mvp', 'Most Valuable', 'Win an MVP', C => C.trophies.some(t => /^MVP/.test(t))],
    ['title', 'Champion', 'Win a title', C => C.trophies.some(t => /^Champion,/.test(t))],
    ['fmvp', 'Finals MVP', 'Win Finals MVP', C => C.trophies.some(t => /Finals MVP/.test(t))],
    ['rival', 'Bragging rights', 'Lead your rival by five head to head', C => C.rival && C.rival.h2h && C.rival.h2h[0] - C.rival.h2h[1] >= 5],
    ['ovr80', 'Eighty club', 'Reach 80 overall', C => C.me.ovr >= 80],
    ['ovr90', 'Superstar', 'Reach 90 overall', C => C.me.ovr >= 90],
    ['rich', 'Max money', 'Earn $100M in a career', C => (C.earnings || 0) >= 100],
    ['shoe', 'Signature shoe', 'Land a shoe deal', C => !!(C.endorse && C.endorse.brand)],
    ['hof', 'Hall of Famer', 'Make the Hall of Fame', C => !!(C.retired && C.retired.hof)],
    ['rimrock', 'Rim rocker', 'Throw down your first dunk', C => !!(C.miles || {}).firstdunk],
    ['dd', 'Double-double', 'Double figures in two stats', C => !!(C.miles || {}).dd],
    ['glass', 'Glass eater', 'Grab 15 rebounds in a game', C => (C.highs || {}).reb >= 15],
    ['general', 'Floor general', 'Hand out 10 assists in a game', C => (C.highs || {}).ast >= 10],
    ['pickpocket', 'Pickpocket', 'Five steals in a game', C => (C.highs || {}).stl >= 5],
    ['nofly', 'No-fly zone', 'Five blocks in a game', C => (C.highs || {}).blk >= 5],
    ['flame', 'Flamethrower', 'Seven threes in a game', C => (C.highs || {}).tpm >= 7],
    ['powin', 'Second season', 'Win a playoff game', C => !!(C.miles || {}).playoffwin],
    ['ovr70', 'On the rise', 'Reach 70 overall', C => C.me.ovr >= 70],
    ['vet', 'Veteran', 'Play five seasons', C => C.year >= 6],
    ['decade', 'A decade in', 'Play ten seasons', C => C.year >= 11],
    ['m25', 'Set for life', 'Earn $25M in a career', C => (C.earnings || 0) >= 25],
    ['fanfav', 'Fan favorite', 'Reach the Fan favorite rank', C => rankOf(C.fans).i >= 3],
    ['goat', 'The conversation', 'Reach the GOAT rank', C => rankOf(C.fans).i >= RANKS.length - 1],
    ['badges5', 'Decorated', 'Own five badges', C => Object.values(C.me.badges || {}).filter(t => t > 0).length >= 5],
    ['case5', 'Trophy case', 'Collect five trophies', C => C.trophies.length >= 5],
  ];
  function achCheck() {
    const got = load('pbb.ach') || {}, fresh = [];
    for (const [k, n, , ok] of ACH) { let v = false; try { v = !!ok(C); } catch (e) { v = false; } if (v && !got[k]) { got[k] = { t: Date.now(), who: PB.full(C.me) }; fresh.push(n); } }
    if (fresh.length) { store('pbb.ach', got); C.me.sp = (C.me.sp || 0) + fresh.length;   /* each one is worth a skill point */ for (const n of fresh) C.news.unshift(`Achievement: ${n} (+1 skill point)`); achToast(fresh); }
  }
  /* paper in the team's colors over whatever screen is up: a title is worth it */
  PB.confetti = (colors, sec) => {
    if (document.getElementById('confetti') || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches)) return;
    const cv = document.createElement('canvas'); cv.id = 'confetti'; cv.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;z-index:80;pointer-events:none';
    document.body.appendChild(cv); const W = cv.width = innerWidth, H = cv.height = innerHeight, x = cv.getContext('2d'), cs = (colors || []).concat(['#ffffff', '#ffffff']);
    const P = []; for (let i = 0; i < 150; i++) P.push({ x: Math.random() * W, y: Math.random() * H * 1.25 - H, vx: (Math.random() - 0.5) * 60, vy: 150 + Math.random() * 200, w: 6 + Math.random() * 6, h: 9 + Math.random() * 9, a: Math.random() * 6.28, va: (Math.random() - 0.5) * 9, c: cs[i % cs.length], ph: Math.random() * 6.28 });
    const T = (sec || 5) * 1000, t0 = performance.now(); let last = t0;
    const tick = now => { const dt = Math.min(0.05, (now - last) / 1000); last = now; x.clearRect(0, 0, W, H); x.globalAlpha = Math.max(0, Math.min(1, (T - (now - t0)) / 900));
      for (const p of P) { p.x += (p.vx + Math.sin(now / 400 + p.ph) * 40) * dt; p.y += p.vy * dt; p.a += p.va * dt; if (p.y > H + 20) { p.y = -20; p.x = Math.random() * W; }
        x.save(); x.translate(p.x, p.y); x.rotate(p.a); x.fillStyle = p.c; x.fillRect(-p.w / 2, -p.h / 2 * Math.abs(Math.cos(p.a * 1.7)), p.w, p.h * Math.abs(Math.cos(p.a * 1.7)) + 1); x.restore(); }
      if (now - t0 < T) requestAnimationFrame(tick); else cv.remove(); };
    requestAnimationFrame(tick);
  };
  function achToast(list) {
    let el = document.getElementById('achtoast');
    if (!el) { el = document.createElement('div'); el.id = 'achtoast'; document.body.appendChild(el); }
    el.innerHTML = `<b>Achievement</b>${list.map(esc).join(' · ')}`; el.className = 'on';
    clearTimeout(achToast.h); achToast.h = setTimeout(() => { el.className = ''; }, 3200);
  }
  function save() {
    if (!C) return;
    keepAsk();
    if (C.me && C.trophies) achCheck();
    let id = curId();
    const list = slots();
    if (!id || !list.find(x => x.id === id)) { id = 'c' + Date.now().toString(36); list.push({ id }); setCur(id); }
    const e = list.find(x => x.id === id);
    Object.assign(e, { name: PB.full(C.me), team: C.team, year: C.year, ovr: C.me.ovr, pos: C.me.pos, t: Date.now() });
    store('pbb.career.' + id, C); store(IDX, list);
    try { localStorage.setItem('pbb.acct.changed', String(Date.now())); } catch (e) { /* fine */ }
    if (PB.account && PB.account.saved) PB.account.saved();   // an account copies it up a moment later
  }

  /* the hub drawn again in place after a tap that changes one thing (an attribute, a badge, a jersey): where you had
     scrolled to stays put and nothing fades in again */
  const stay = () => { const s = scr(), y = s.scrollTop, wy = window.scrollY; s.classList.add('still'); hub(); s.scrollTop = y; window.scrollTo(0, wy); clearTimeout(stay.h); stay.h = setTimeout(() => s.classList.remove('still'), 600); };
  function show(html) { const s = scr(); s.classList.remove('over3d'); if (PB.R && PB.R.showcase) PB.R.showcase(null); s.innerHTML = html; s.hidden = false; s.scrollTop = 0; const f = s.firstElementChild; if (f) f.classList.add('enter'); }
  const badge = t => `<i class="tb" style="background:${t.c1};color:${PB.ink(t.c1, t.c2)}">${esc(t.ab || t.id)}</i>`;
  const tname = t => `${t.city} ${t.name}`;

  /* ---------- home ----------
     With a player and a 3D view, home is the park: every back button and the hub's home button lead there. Without a
     player (a first visit) or without 3D, the classic menu. */
  function title() {
    C = openCur();
    if (C && C.me && !PB.noGL) { park(); return; }
    classicTitle();
  }
  /* the first screen: the logo over your player, a tap to start (which also lets the sound in), and the park */
  /* ---------- the title's parts ----------
     The wordmark (letters that rise in, a ball that spins, a shine that crosses it now and then), a top bar with the
     version and your account, a ticker of headlines along the bottom, and the links as a grid of icons. */
  const LOGO = `<div class="logo2"><svg class="lball" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="18"/><path d="M2 20h36M20 2v36M7 7c7 6 7 20 0 26M33 7c-7 6-7 20 0 26"/></svg>
    <p class="lsmall">${[...'POCKET'].map((c, i) => `<span style="--i:${i}">${c}</span>`).join('')}</p><h1 class="lbig">${[...'BASKETBALL'].map((c, i) => `<span style="--i:${i + 3}">${c}</span>`).join('')}</h1><i class="lshine"></i></div>`;
  function topBar() {
    const u = PB.account && PB.account.user(), nm = u && (u.name || u.email || '');
    return `<div class="tbar"><span class="tver">v${esc(PB.VERSION)}</span><button class="tacct" id="tacct">${u ? `<i data-st="${esc(PB.account.status ? PB.account.status() : '')}">${esc(PB.account.initials ? PB.account.initials(nm) : nm.slice(0, 2).toUpperCase())}</i>${esc(nm.split('@')[0].slice(0, 14))}` : `${MIC.career}Sign in`}</button></div>`;
  }
  function ticker() {
    const cur = openCur(), lines = (cur && cur.news ? cur.news.slice(0, 8) : []).filter(Boolean);
    const day = new Date(), t1 = PB.TEAMS[(day.getDate() * 3) % PB.TEAMS.length], t2 = PB.TEAMS[(day.getDate() * 5 + 7) % PB.TEAMS.length], dd = dailySpec();
    const extra = [`Today's daily challenge: ${dd.title}`, `Tonight: the ${t1.name} host the ${t2.name}`, 'Every team and player is fictional', dailyDone() ? 'Daily challenge done today' : 'A new daily challenge every day'];
    const all = lines.concat(extra).map(x => esc(String(x).slice(0, 90)));
    const row = all.map(x => `<span>${x}</span>`).join('<b>•</b>');
    return `<div class="ticker" aria-hidden="true"><div style="--n:${all.length}">${row}<b>•</b>${row}<b>•</b></div></div>`;
  }
  function iconLinks(items) {
    return `<div class="tgrid">${items.filter(Boolean).map(([id, ic, label]) => `<button id="${id}">${ic}<span>${label}</span></button>`).join('')}</div>`;
  }
  function wireTop(back) { if ($('#tacct')) $('#tacct').onclick = () => PB.account && PB.account.open(back); }

  function splash() {
    C = openCur();
    if (!C || !C.me || PB.noGL) { classicTitle(); return; }
    if (PB.audio) PB.audio.music(true);
    const t = C.team ? PB.team(C.team) : null;
    const face = !PB.noGL && PB.R.modelReady && PB.R.modelReady() ? (() => { try { return portrait(); } catch (e) { return null; } })() : null;
    show(`<div class="title splash v2" style="--tc:${t ? t.c1 : '#333'}">${topBar()}${LOGO}
      <div class="spacer"></div>
      <div class="pchip">${face ? `<img alt="" src="${face}">` : ''}<div><b>${esc(PB.full(C.me))}</b><span>${t ? esc(t.city + ' ' + t.name) : 'Pre-draft'} · ${esc(C.me.pos)} · Season ${C.year}</span></div><em>${C.me.ovr}<small>OVR</small></em></div>
      <button class="big tstart" id="start"><span>Tap to start</span></button>
      ${iconLinks([['sw', MIC.list, 'Players'], ['set', MIC.target, 'Settings'], ['about', MIC.day, 'News'], ['chat', MIC.chat, 'Chat']])}
      ${ticker()}</div>`);
    whatsNew(); wireTop(splash);
    $('#about').onclick = about; $('#chat').onclick = () => { PB.R.showcase(null); if (PB.online) PB.online.open(); };
    title3d(C.me, t);
    $('#start').onclick = () => { PB.R.showcase(null); scr().classList.remove('over3d'); park(); };
    $('#sw').onclick = myPlayers; $('#set').onclick = settings;
  }
  function recordBook() {
    const hall = load('pbb.hall') || [], RB = load('pbb.records') || {};
    const rec = (o, list) => list.filter(([k]) => o && o[k]).map(([k, l]) => `<div class="card rec"><span>${l}</span><b>${o[k].v}</b><small>${esc(o[k].name)} · ${esc(PB.team(o[k].team).ab)} · season ${o[k].year}</small></div>`).join('');
    show(`<div class="page"><button class="back" id="bk">‹ Back</button><h2>Record book</h2><p class="mute">The best by any career on this device.</p>
      ${RB.game ? `<h3>One game</h3>${rec(RB.game, [['pts', 'Points'], ['reb', 'Rebounds'], ['ast', 'Assists'], ['tpm', 'Threes'], ['stl', 'Steals'], ['blk', 'Blocks']])}` : ''}
      ${RB.season ? `<h3>One season</h3>${rec(RB.season, [['ppg', 'Points a game'], ['rpg', 'Rebounds a game'], ['apg', 'Assists a game']])}` : ''}
      ${!RB.game && !RB.season && !hall.length ? '<p class="mute">Nothing yet. Records are set in the games you play.</p>' : ''}
      ${hall.length ? '<h3>Retired careers</h3>' : ''}
      ${hall.map(h => `<div class="card slot"><div><b>${h.hof ? '🏛 ' : ''}${esc(h.name)}</b><span>${h.pos} · ${h.seasons} seasons · ${h.pts} points (${h.ppg} a game) · ${h.trophies} trophies · last with the ${esc(PB.team(h.team).name)}</span>
        <span>${h.hof ? 'Hall of Fame' : 'Hall score ' + h.score + ' of 22'}</span></div></div>`).join('')}</div>`);
    $('#bk').onclick = title;
  }
  function achievements() {
    const got = load('pbb.ach') || {};
    show(`<div class="page"><button class="back" id="bk">‹ Back</button><h2>Achievements</h2><p class="mute">${Object.keys(got).length} of ${ACH.length}, across every career on this device. Each one is worth a skill point to the player who earns it.</p>
      <div class="achbar"><i style="width:${Math.round(Object.keys(got).length / ACH.length * 100)}%"></i></div>
      <div class="achgrid">${ACH.map(([k, n, d]) => `<div class="card ach ${got[k] ? 'got' : ''}"><i>${got[k] ? '★' : '☆'}</i><div><b>${n}</b><span>${d}</span><em>${got[k] ? esc(got[k].who) : 'Not yet'}</em></div></div>`).join('')}</div></div>`);
    $('#bk').onclick = title;
  }
  /* art for the menu: a player from the game on every tile, rendered once and kept. Each tile gets a different man in
     a different club's colors (the first is yours, if you have a player) */
  const artCache = {};
  function artTiles() {
    const tiles = [...scr().querySelectorAll('[data-art]')];
    if (!tiles.length || PB.noGL || !PB.R.modelReady) return;
    const paint = () => { if (!PB.R.modelReady()) { setTimeout(paint, 400); return; }
      const step = () => { const el = tiles.shift(); if (!el || !el.isConnected) return; const i = +el.dataset.art, t = PB.TEAMS[(i * 7 + 3) % PB.TEAMS.length];
        el.style.setProperty('--tc', t.c1);
        try { if (!artCache[i]) { const tk = new Set(), p = PB.makeRoster(86, tk)[(i * 2) % 5]; artCache[i] = PB.R.portrait(p, t, 150, { body: true, tight: true, back: i % 3 === 2 }); }
          if (artCache[i]) { const im = document.createElement('img'); im.alt = ''; im.src = artCache[i]; el.prepend(im); el.classList.add('has'); } } catch (e) { /* no picture: the tile still works */ }
        setTimeout(step, 30); };
      step(); };
    setTimeout(paint, 60);
  }
  /* ---------- the classic menu ---------- */
  function classicTitle() {
    if (PB.audio) PB.audio.music(true);
    C = openCur();
    const list = slots();
    const live = C && C.me;
    show(`<div class="title v2">${topBar()}
      ${LOGO}<p class="ltag">Your career, from draft night to the Hall of Fame.</p>
      ${live ? `<button class="mode pri" id="cont">${(() => { try { const f = !PB.noGL && PB.R.modelReady && PB.R.modelReady() ? portrait() : null; return f ? `<img class="cface" alt="" src="${f}">` : MIC.career; } catch (e) { return MIC.career; } })()}<span><b>My Career</b><small>Continue as ${esc(PB.full(C.me))}${C.team ? ' · ' + esc(PB.team(C.team).name) : ' · pre-draft'} · Season ${C.year}</small></span><em>›</em></button>` : ''}
      ${list.length ? `<button class="mode ${live ? '' : 'pri'}" id="careers">${MIC.list}<span><b>My Player</b><small>${list.length} player${list.length > 1 ? 's' : ''} on this device · switch, or build another</small></span><em>›</em></button>` : `<button class="mode pri" id="newc">${MIC.career}<span><b>My Career</b><small>Build your My Player and take him from draft night to the Hall of Fame.</small></span><em>›</em></button>`}
      <div class="modes art">
        <button class="tile art" id="qg" data-art="0" style="--i:0"><b>Quick game<small>one game</small></b></button>
        <button class="tile art" id="seas" data-art="1" style="--i:1"><b>Season<small>run a team</small></b></button>
        <button class="tile art" id="prac" data-art="2" style="--i:2"><b>Practice<small>the gym</small></b></button>
        <button class="tile art" id="daily" data-art="3" style="--i:3"><b>Daily${dailyDone() ? ' ✓' : ''}<small>${dailyDone() ? 'done today' : 'new today'}</small></b></button>
        <button class="tile art" id="btop" data-art="4" style="--i:4"><b>Blacktop<small>1v1 to 3v3</small></b></button>
        <button class="tile art" id="clsc" data-art="5" style="--i:5"><b>Classics<small>great nights</small></b></button>
      </div>
      ${iconLinks([['h2h', MIC.vs, 'Head to head'], ['chat', MIC.chat, 'Chat'], ['prof', MIC.career, 'Profile'], ['about', MIC.day, 'News'], ['how', MIC.target, 'How to play'], ['set', MIC.list, 'Settings'],
        ['hall', MIC.clock, 'Records'], ['achv', MIC.cup, load('pbb.ach') ? `Awards <small>${Object.keys(load('pbb.ach')).length}/${ACH.length}</small>` : 'Awards']])}
      ${ticker()}</div>`);
    whatsNew(); artTiles(); wireTop(title);
    if (live) $('#cont').onclick = () => { tab = 'home'; hub(); };
    title3d(live ? C.me : null, live && C.team ? PB.team(C.team) : null);
    if ($('#newc')) $('#newc').onclick = () => { setCur(''); C = null; create(); };
    if ($('#careers')) $('#careers').onclick = careers;
    $('#qg').onclick = quick;
    $('#prac').onclick = practice;
    $('#daily').onclick = daily;
    if ($('#h2h')) $('#h2h').onclick = () => headToHead();
    $('#btop').onclick = () => blacktop();
    $('#clsc').onclick = () => classics();
    $('#seas').onclick = () => PB.Season.start();
    $('#how').onclick = how; $('#prof').onclick = profile; $('#about').onclick = about;
    if ($('#chat')) $('#chat').onclick = () => { if (PB.online) PB.online.open(); };
    if ($('#hall')) $('#hall').onclick = recordBook;
    $('#set').onclick = settings;
    if ($('#achv')) $('#achv').onclick = achievements;
  }
  /* what changed since you last played: once per update, over the title */
  const NEW_V = '2026-11-24a';
  function whatsNew() {
    if (load('pbb.seen') === NEW_V || (navigator.webdriver && !window.PBforceCut)) return;   // (the test tools drive the title by its buttons)
    if (!load('pbb.careers') && !load('pbb.settings.v1')) { store('pbb.seen', NEW_V); return; }   // a first visit has nothing to compare with
    const items = [['Sign in with Google', 'Or GitHub, or email: a cleaner sign in, a password reset screen and your sync status'], ['Four ways in', 'Top prospect, first round, second round or undrafted, each with its own story and cutscenes'],
      ['Social', 'Posts, callouts, polls, media day, and partners who follow your hype'], ['Chemistry and abilities', 'A bond with your running mate, and abilities you equip'], ['Head to head', 'Send a late-game challenge to a friend by link'], ['Dunks', 'Hold Shoot through them: no timing']];
    const el = document.createElement('div'); el.className = 'wnsheet';
    el.innerHTML = `<div class="wnbox"><p class="kick">What's new · v${esc(PB.VERSION)}</p><h3>New in Pocket Basketball</h3>${items.map(([a, b], i) => `<div class="wni" style="--i:${i}"><b>${a}</b><span>${b}</span></div>`).join('')}
      <button class="big" id="newok">Let's go</button><button class="ghost sm" id="newall">Everything that changed</button></div>`;
    document.body.appendChild(el);
    const close = () => { store('pbb.seen', NEW_V); el.classList.add('out'); setTimeout(() => el.remove(), 250); };
    el.querySelector('#newok').onclick = close; el.querySelector('#newall').onclick = () => { close(); PB.R && PB.R.showcase && PB.R.showcase(null); about(); };
    el.onclick = e => { if (e.target === el) close(); };
  }
  /* the title over the arena: your player at center court (or tonight's featured player), the camera circling */
  let featured = null;
  function title3d(me, team, tries) {
    if (PB.noGL) return;
    const el = scr().querySelector('.title'); if (!el) return;
    if (!PB.R.modelReady || !PB.R.modelReady()) { if ((tries || 0) < 40) setTimeout(() => title3d(me, team, (tries || 0) + 1), 250); return; }
    if (!me) {
      if (!featured) { const d = new Date(), t = PB.TEAMS[(d.getDate() * 7 + d.getMonth()) % PB.TEAMS.length]; featured = { p: PB.makePlayer(PB.pick(['PG', 'SG', 'SF']), 86, 26), t }; }
      me = featured.p; team = featured.t;
    }
    if (!team) team = PB.team('SF');
    scr().classList.add('over3d'); el.classList.add('t3d'); PB.R.showcase(me, team);
  }
  /* the careers on this device: play one, back it up to a file, bring one in from a file, delete one */
  /* ---------- My Player: every player you have built, each with his own career, the way the console game keeps them ----------
     A card for each (in his uniform, his overall, his team and his season), tap to play him; a slot to build another. */
  const MAXP = 10;
  const shots = {};
  function playerShot(id, d) {
    const key = id + '|' + JSON.stringify(d.me.look || {}) + '|' + (d.team || '');
    if (shots[key] !== undefined) return shots[key];
    let url = null; try { if (!PB.noGL && PB.R.modelReady && PB.R.modelReady()) url = PB.R.portrait(d.me, d.team ? PB.team(d.team) : { id: 'prospect', c1: '#f2f2f2', c2: '#141416', name: 'PROSPECT', city: 'Prospect' }, 260, { body: true }); } catch (e) { url = null; }
    return (shots[key] = url);
  }
  function myPlayers() {
    const list = slots().sort((a, b) => (b.t || 0) - (a.t || 0)), cur = curId();
    const card = x => { const d = load('pbb.career.' + x.id); if (!d || !d.me) return '';
      const t = d.team ? PB.team(d.team) : null, st = d.team && d.standings && d.standings[d.team], im = playerShot(x.id, d), m = d.me;
      return `<div class="pcard ${x.id === cur ? 'cur' : ''}" style="--tc:${t ? t.c1 : '#3a3a40'}"><button class="pplay" data-play="${x.id}">${im ? `<img alt="" src="${im}">` : '<div class="noimg"></div>'}
        <b>${esc(PB.full(m))}</b><em>${m.ovr}</em><span>${m.pos} · ${esc(m.arch || '')} · ${PB.fmtH(m.ht)}${m.wt ? ` · ${m.wt} lb` : ''}</span>
        <small>${t ? esc(t.name) : 'Pre-draft'} · season ${d.year || 1}${st ? ` · ${st.w}-${st.l}` : ''}${d.retired ? ' · retired' : ''}</small></button>
        <div class="pman"><button class="ghost sm" data-exp="${x.id}">Back up</button><button class="ghost sm" data-del="${x.id}">Delete</button></div></div>`; };
    show(`<div class="page players"><button class="back" id="bk">‹ Main menu</button><h2>My Player</h2>
      <p class="mute">Every player you build has his own career. Pick one, or build another (up to ${MAXP}).</p>
      <div class="pgrid">${list.map(card).join('')}${list.length < MAXP ? `<button class="pcard pnew" id="newc"><div class="plus">+</div><b>New My Player</b><span>Build him from scratch</span></button>` : ''}</div>
      <label class="ghost sm imp">Bring in a backup file<input type="file" id="imp" accept=".json,application/json" hidden></label>
      <p class="fine">A backup is a small file you can keep, or open on another phone or computer to carry the player over.</p></div>`);
    $('#bk').onclick = title;
    if ($('#newc')) $('#newc').onclick = () => { setCur(''); C = null; create(); };
    scr().querySelectorAll('[data-play]').forEach(b => b.onclick = () => { setCur(b.dataset.play); C = openCur(); tab = 'home'; hub(); });
    scr().querySelectorAll('[data-exp]').forEach(b => b.onclick = () => {
      const data = load('pbb.career.' + b.dataset.exp); if (!data) return;
      const blob = new Blob([JSON.stringify({ pocketbasketball: 1, career: data })], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = `pocketbasketball-${(data.me.last || 'career').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-season${data.year}.json`;
      document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    });
    scr().querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
      if (!confirm('Delete this player and his career?') || !confirm('Really delete him? This cannot be undone.')) return;
      const id = b.dataset.del; store(IDX, slots().filter(x => x.id !== id));
      try { localStorage.removeItem('pbb.career.' + id); } catch (e) { /* fine */ }
      if (curId() === id) { setCur(''); C = null; }
      myPlayers();
    });
    $('#imp').onchange = e => {
      const f = e.target.files[0]; if (!f) return;
      f.text().then(txt => {
        let d; try { d = JSON.parse(txt); } catch (err) { alert('That file is not a PocketBasketball backup.'); return; }
        const c = d && d.pocketbasketball && d.career;
        if (!c || !c.me || !c.rosters) { alert('That file is not a PocketBasketball backup.'); return; }
        if (slots().length >= MAXP) { alert(`${MAXP} players is the most this device keeps. Delete one first.`); return; }
        if (txt.length > 6e6) { alert('That file is too large to be a PocketBasketball backup.'); return; }
        setCur(''); C = guard(c); save(); myPlayers();
      });
    };
  }
  const careers = myPlayers;
  /* the daily challenge: today's late-game situation, the same for everyone on this date; a streak on the device */
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
  const dailyDone = () => { const D = load('pbb.daily') || {}; return D.last === today() && D.won; };
  function dailySpec(seed) {
    let h = 0; if (seed !== undefined) h = seed >>> 0; else for (const ch of today()) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const R = n => { h = (h * 1103515245 + 12345) >>> 0; return h % n; };
    const kinds = [
      { k: 'win', title: 'Down two, your ball', text: 'Down 2 with 14 seconds left. Win it, in regulation or in overtime.', clock: 14, diff: -2, poss: 0 },
      { k: 'win', title: 'Down three, your ball', text: 'Down 3 with 18 seconds left. Win it: a three ties, a stop and a score wins.', clock: 18, diff: -3, poss: 0 },
      { k: 'hold', title: 'Hold the lead', text: 'Up 2 with 20 seconds left, their ball. Get the stop and close it out.', clock: 20, diff: 2, poss: 1 },
      { k: 'win', title: 'The comeback', text: 'Down 8 with 2:00 left, your ball. Pull it off.', clock: 120, diff: -8, poss: 0 },
      { k: 'win', title: 'Tied, last shot', text: 'Tied with 9 seconds left, your ball. Win it.', clock: 9, diff: 0, poss: 0 },
      { k: 'score', title: 'Twelve in two', text: 'Score 12 points yourself in the last two minutes (down 4, your ball), and win.', clock: 120, diff: -4, poss: 0, pts: 12 },
    ];
    const sp = kinds[R(kinds.length)], ids = PB.TEAMS.map(t => t.id), a = ids[R(ids.length)];
    let b = ids[R(ids.length)]; if (b === a) b = ids[(ids.indexOf(a) + 7) % ids.length];
    return { ...sp, a, b, pos: ['PG', 'SG', 'SF', 'PF', 'C'][R(5)], base: 98 + R(14) };
  }
  /* a late-game situation, set up and played: the two rosters, you at 85 overall at the spec's position, the score and the clock */
  function playSpec(sp, onEnd, o) {
    const A = PB.team(sp.a), B = PB.team(sp.b), tk = new Set(), fa = PB.makeRoster(80, tk), fb = PB.makeRoster(80, tk), ra = fa.slice(0, 5), rb = fb.slice(0, 5);
    const me = ra[PB.POS.indexOf(sp.pos)]; me.r = PB.makeRatings(sp.pos, 85); me.ovr = PB.ovr(me.r, sp.pos); { const n = youName(); me.first = n[0]; me.last = n[1]; }
    const score = [sp.base + Math.max(0, sp.diff), sp.base + Math.max(0, -sp.diff)];
    scr().hidden = true;
    PB.Game.start(Object.assign({ teams: [A, B], rosters: [ra, rb], bench: [fa.slice(5, 9), fb.slice(5, 9)], userId: me.id, qlen: S.qlen, level: 'All-Star', floor: A,
      scenario: { q: 4, clock: sp.clock, score, poss: sp.poss, title: sp.title }, onEnd }, o || {}));
  }

  /* ---------- head to head, by link ----------
     No server and no account: a challenge is a late-game situation picked by a number, and the link carries the number,
     your name and how you did. Your friend opens it, plays the same situation with the same teams, and the two results
     are set side by side; he can send his back. Winning beats losing, then the margin, then your own points. A record
     of the ones you have won and lost is kept on this device. */
  const b64u = t => btoa(unescape(encodeURIComponent(t))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const ub64 = t => { try { return decodeURIComponent(escape(atob(String(t).replace(/-/g, '+').replace(/_/g, '/')))); } catch (e) { return null; } };
  const h2hLink = d => `${location.origin}${location.pathname}?vs=${b64u(JSON.stringify(d))}`;
  /* a link is something a stranger wrote: every part of it is checked before it is used, and the name loses anything that could be markup */
  function h2hRead(code) {
    const t = ub64(code); if (!t || t.length > 400) return null; let d; try { d = JSON.parse(t); } catch (e) { return null; }
    const run = r => Array.isArray(r) && r.length === 4 && typeof r[0] === 'string' && [1, 2, 3].every(i => Number.isFinite(r[i]) && Math.abs(r[i]) < 200) ? { n: r[0].replace(/[<>&"'`]/g, '').slice(0, 24) || 'A friend', w: r[1] ? 1 : 0, m: Math.round(r[2]), p: Math.max(0, Math.round(r[3])) } : null;
    if (!Array.isArray(d) || !Number.isFinite(d[0])) return null; const a = run(d[1]), b = d[2] ? run(d[2]) : null; if (!a) return null;
    return { seed: d[0] >>> 0, a, b };
  }
  const h2hBeats = (x, y) => x.w !== y.w ? x.w > y.w : x.m !== y.m ? x.m > y.m : x.p > y.p;
  const h2hLine = r => `${r.w ? 'won' : 'lost'} by ${Math.abs(r.m)}, with ${r.p} point${r.p === 1 ? '' : 's'} of ${r.n === 'You' ? 'your' : 'his'} own`;
  function h2hSend(link, text) {
    if (navigator.share) { navigator.share({ title: 'Pocket Basketball', text, url: link }).catch(() => {}); return; }
    const done = () => { const b = $('#h2send'); if (b) b.textContent = 'Link copied'; };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(link).then(done).catch(() => prompt('Copy this link and send it:', link)); else prompt('Copy this link and send it:', link);
  }
  function headToHead(inc) {
    const H = load('pbb.h2h') || { w: 0, l: 0, seen: [] }, me = youName().join(' ');
    /* an answer to one of yours: the two results, and who took it */
    if (inc && inc.b) {
      const mineWon = h2hBeats(inc.a, inc.b), key = inc.seed + ':' + inc.b.n; if (!H.seen.includes(key)) { H.seen.push(key); H.seen = H.seen.slice(-40); if (mineWon) H.w++; else H.l++; store('pbb.h2h', H); }
      const sp = dailySpec(inc.seed);
      show(`<div class="page post"><p class="kick">Head to head · the answer</p><h2>${mineWon ? 'You took it' : esc(inc.b.n) + ' took it'}</h2>
        <div class="card"><h3>${esc(sp.title)}</h3><p><b>${esc(inc.a.n)}</b> ${h2hLine(inc.a)}.</p><p><b>${esc(inc.b.n)}</b> ${h2hLine(inc.b)}.</p></div>
        <p class="mute">Your head-to-head record: ${H.w}-${H.l}</p><button class="big" id="go">Start another</button><button class="ghost" id="done">Main menu</button></div>`);
      $('#go').onclick = () => headToHead(); $('#done').onclick = title; return; }
    const seed = inc ? inc.seed : (Math.floor(Math.random() * 4294967295) >>> 0), sp = dailySpec(seed), A = PB.team(sp.a), B = PB.team(sp.b);
    show(`<div class="page"><button class="back" id="bk">‹ Back</button><h2>Head to head</h2><p class="mute">${inc ? `${esc(inc.a.n)} sent you a challenge` : 'Play a situation, then send it to a friend: same teams, same clock, best result wins'} · your record ${H.w}-${H.l}</p>
      <div class="card"><h3>${esc(sp.title)}</h3><p>${esc(sp.text)}</p><p class="fine">You: the ${PB.POS_NAME[sp.pos].toLowerCase()} of the ${esc(tname(A))} (85 overall), against the ${esc(tname(B))}. Fourth quarter.</p>
      ${inc ? `<p><b>${esc(inc.a.n)}</b> ${h2hLine(inc.a)}. Beat that.</p>` : ''}
      <button class="big" id="go">${inc ? 'Take the challenge' : 'Play it'}</button>${inc ? '' : '<button class="ghost" id="other">A different one</button>'}</div>
      <p class="fine">No account and no server: the link itself carries the challenge and the result. Winning beats losing, then the margin, then your own points.</p></div>`);
    $('#bk').onclick = title; if ($('#other')) $('#other').onclick = () => headToHead();
    $('#go').onclick = () => playSpec(sp, r => {
      const mine = { n: me, w: r.score[0] > r.score[1] ? 1 : 0, m: r.score[0] - r.score[1], p: (r.user && r.user.pts) || 0 }, arr = x => [x.n, x.w, x.m, x.p];
      let verdict = '';
      if (inc) { const won = h2hBeats(mine, inc.a), key = inc.seed + ':' + inc.a.n; if (!H.seen.includes(key)) { H.seen.push(key); H.seen = H.seen.slice(-40); if (won) H.w++; else H.l++; store('pbb.h2h', H); }
        verdict = `<div class="card"><h3>${won ? 'You win the head to head' : esc(inc.a.n) + ' wins this one'}</h3><p><b>You</b> ${h2hLine(Object.assign({}, mine, { n: 'You' }))}.</p><p><b>${esc(inc.a.n)}</b> ${h2hLine(inc.a)}.</p><p class="mute">Your record: ${H.w}-${H.l}</p></div>`; }
      const link = h2hLink(inc ? [seed, arr(inc.a), arr(mine)] : [seed, arr(mine)]);
      show(`<div class="page post"><p class="kick">Head to head</p><div class="final"><div>${badge(A)}<b>${r.score[0]}</b></div><em>${mine.w ? 'WIN' : 'LOSS'}</em><div><b>${r.score[1]}</b>${badge(B)}</div></div>
        <p class="mute">${esc(sp.title)} · you ${mine.w ? 'won' : 'lost'} by ${Math.abs(mine.m)} with ${mine.p} point${mine.p === 1 ? '' : 's'}</p>${verdict}
        <button class="big" id="h2send">${inc ? 'Send your result back' : 'Send the challenge'}</button><button class="ghost" id="again">${inc ? 'Start one of your own' : 'A new one'}</button><button class="ghost" id="done">Main menu</button></div>`);
      $('#h2send').onclick = () => h2hSend(link, inc ? `I ${mine.w ? 'won' : 'lost'} by ${Math.abs(mine.m)}. Here is how it came out.` : `${sp.title}: I ${mine.w ? 'won' : 'lost'} by ${Math.abs(mine.m)} with ${mine.p}. Beat that.`);
      $('#again').onclick = () => headToHead(); $('#done').onclick = title;
    });
  }

  /* ---------- a whole save: everything of this game's in the browser ----------
     Used by the file export and import and by an account's cloud copy. A save from outside (a file, the cloud) is
     something a stranger may have written: only this game's own keys, only text that parses, careers passed through the
     same checks as a loaded one. The account's own bookkeeping (pbb.acct*) stays with the device. */
  const SAVE_SKIP = /^pbb\.(acct|backup)/;
  function saveCollect() { const o = {}; for (const k of Object.keys(localStorage)) if (k.startsWith('pbb.') && !SAVE_SKIP.test(k)) o[k] = localStorage.getItem(k); return o; }
  function saveCheck(o) {
    if (!o || !o.pocketBasketball || !o.data || typeof o.data !== 'object') return null;
    const okKey = k => /^pbb\.[a-zA-Z0-9_.-]{1,60}$/.test(k) && !SAVE_SKIP.test(k), data = {};
    for (const k in o.data) { const v = o.data[k]; if (!okKey(k) || typeof v !== 'string') continue;
      if (k === 'pbb.current') { if (/^[a-zA-Z0-9]{0,24}$/.test(v)) data[k] = v; continue; }
      let j; try { j = JSON.parse(v); } catch (e) { continue; }
      data[k] = JSON.stringify(k.startsWith('pbb.career.') ? guard(j) : clean(j)); }
    return Object.keys(data).length ? data : null;
  }
  function saveApply(data) {
    for (const k of Object.keys(localStorage)) if (k.startsWith('pbb.') && !SAVE_SKIP.test(k)) localStorage.removeItem(k);
    try { for (const k in data) localStorage.setItem(k, data[k]); return true; } catch (e) { return false; }
  }
  const saveSummary = () => { const L = slots(); return { players: L.length, names: L.slice(0, 3).map(x => x.name).filter(Boolean) }; };
  PB.saves = { collect: saveCollect, check: saveCheck, apply: saveApply, summary: saveSummary, changed: () => +(localStorage.getItem('pbb.acct.changed') || 0) };

  /* ---------- keeping your saves ----------
     Everything is kept in this browser. Two things make that safer: the browser is asked to treat the game's storage as
     something to keep (it then does not clear it to make room), and after every few games of a career you are offered
     a copy of everything as a file, through the share sheet, so it can go to Files, iCloud or Drive. */
  const saveBlob = () => { const o = saveCollect(); return new Blob([JSON.stringify({ pocketBasketball: 1, at: new Date().toISOString(), data: o })], { type: 'application/json' }); };
  function keepAsk() { if (keepAsk.done) return; keepAsk.done = true; try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist().then(ok => { PB.kept = !!ok; }).catch(() => {}); } catch (e) { /* not offered here */ } }
  function backupNow() { shareFile(saveBlob(), 'pocket-basketball-save.json', 'Pocket Basketball save'); store('pbb.backup', { at: new Date().toISOString(), gp: (C && C.totals && C.totals.gp) || 0 }); }
  function backupCard() {
    if (!C || !C.totals) return ''; const B = load('pbb.backup') || {}, gp = C.totals.gp || 0, since = gp - (B.gp || 0), snooze = (B.snooze || 0);
    if (gp < 3 || since < 8 || gp < snooze) return '';
    return `<div class="next backup"><p class="kick">Your save</p><p class="q">${B.at ? `${since} games since your last copy.` : 'This career is kept on this phone only.'} Save a copy to Files, iCloud or Drive, and a cleared browser cannot take it.</p><button class="ghost" id="bkup">Save a copy now</button><button class="ghost sm" id="bklater">Later</button></div>`;
  }

  function daily() {
    const sp = dailySpec(), D = load('pbb.daily') || {}, A = PB.team(sp.a), B = PB.team(sp.b);
    show(`<div class="page"><button class="back" id="bk">‹ Back</button><h2>Daily challenge</h2><p class="mute">${today()} · a new one every day${D.streak ? ` · streak ${D.streak}` : ''}${D.best ? ` · best ${D.best}` : ''}</p>
      <div class="card"><h3>${esc(sp.title)}</h3><p>${esc(sp.text)}</p><p class="fine">You: the ${PB.POS_NAME[sp.pos].toLowerCase()} of the ${esc(tname(A))} (85 overall), against the ${esc(tname(B))}. Fourth quarter, ${sp.clock >= 60 ? Math.floor(sp.clock / 60) + ':' + String(sp.clock % 60).padStart(2, '0') : sp.clock + ' seconds'} left.</p></div>
      ${dailyDone() ? '<p class="mute">Done for today. Come back tomorrow, or play it again.</p>' : ''}
      <button class="big" id="go">Play it</button></div>`);
    $('#bk').onclick = title;
    $('#go').onclick = () => {
      playSpec(sp, r => {
          const won = r.score[0] > r.score[1], ok = won && (!sp.pts || (r.user && r.user.pts >= sp.pts));
          const D2 = load('pbb.daily') || {};
          if (D2.last !== today() || !D2.won) {
            const yest = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; })();
            if (ok) { D2.streak = D2.lastWin === yest ? (D2.streak || 0) + 1 : 1; D2.best = Math.max(D2.best || 0, D2.streak); D2.lastWin = today(); }
            D2.last = today(); D2.won = ok; store('pbb.daily', D2);
          }
          show(`<div class="page post"><p class="kick">Daily challenge</p><div class="final"><div>${badge(A)}<b>${r.score[0]}</b></div><em>${ok ? 'DONE' : 'NOT TODAY'}</em><div><b>${r.score[1]}</b>${badge(B)}</div></div>
            <p class="mute">${ok ? `Challenge complete. Streak: ${(load('pbb.daily') || {}).streak || 1}.` : sp.pts && won ? `You won, but you needed ${sp.pts} points yourself (you had ${(r.user || {}).pts || 0}).` : 'So close. Try it again.'}</p>
            ${potg(r)}<button class="big" id="again">Try again</button><button class="ghost" id="done">Main menu</button></div>`);
          $('#again').onclick = daily; $('#done').onclick = title;
        });
    };
  }
  /* practice: the contests on your own, with your career player if you have one */
  function practice(back) {
    const cur = loadCur(), done = typeof back === 'function' ? back : title;
    const me = cur && cur.me ? cur.me : { id: 'me', first: 'Practice', last: 'Shooter', pos: 'SG', ht: 77, skin: 2, num: 30, r: PB.makeRatings('SG', 80), badges: {} };
    const t = cur && cur.team ? PB.team(cur.team) : PB.team('SF');
    show(`<div class="page"><button class="back" id="bk">‹ ${typeof back === 'function' ? 'The park' : 'Back'}</button><h2>${typeof back === 'function' ? 'The gym' : 'Practice'}</h2>${typeof back === 'function' && C && C.me ? '<p class="mute">Each drill you finish is a workout: one skill point a day for each.</p>' : ''}
      <p class="mute">${cur && cur.me ? `As ${esc(PB.full(me))}, with your ratings and badges.` : 'As a practice shooter (80 overall).'}</p>
      <button class="big" id="p3">3-Point Contest<small>five racks, money balls, 60 seconds</small></button>
      <button class="ghost" id="pc">Spot-up drill<small>the combine's fifteen shots in 45 seconds</small></button>
      <button class="ghost" id="pw">Around the World<small>make one from each of ten spots before 60 seconds run out</small></button>
      <button class="ghost" id="pd">Dunk Contest<small>three dunks, five judges; Style picks the dunk</small></button>
      <button class="ghost" id="pf">Shoot-around<small>shoot from anywhere, no clock; pause to finish</small></button></div>`);
    $('#bk').onclick = done;
    const go = kind => { scr().hidden = true; PB.Game.start({ teams: [t, t], rosters: [[me], []], userId: me.id, drill: kind, dunks: 3, qlen: 1, level: S.level, floor: t,
      onEnd: r => { const d = r.drill || { score: 0, made: 0, att: 0 };
        const best = load('pbb.best') || {}; const k = kind; const nb = !best[k] || d.score > best[k]; if (nb) { best[k] = d.score; store('pbb.best', best); }
        /* in your career, the gym is a workout: once a day for each drill, a finished one is worth a skill point */
        let wk = ''; if (typeof back === 'function' && C && C.me && d.att > 0) { const G2 = C.gym || (C.gym = {}); if (G2[kind] !== today()) { G2[kind] = today(); C.me.sp += 1; save(); wk = '<p class="mute">Workout done: +1 skill point (one a day for each drill).</p>'; } }
        show(`<div class="page post"><p class="kick">${kind === 'contest' ? '3-Point Contest' : kind === 'dunk' ? 'Dunk Contest' : kind === 'free' ? 'Shoot-around' : kind === 'world' ? 'Around the World' : 'Spot-up drill'}</p><div class="gradebig"><b>${d.score}</b><span>${kind === 'dunk' ? (d.scores || []).join(' · ') : `${d.made} of ${d.att} made`}</span></div>
          <p class="mute">${nb ? 'A new best on this device.' : `Your best: ${best[k]}`}</p>${wk}<button class="big" id="again">Again</button><button class="ghost" id="done">Done</button></div>`);
        $('#again').onclick = () => go(kind); $('#done').onclick = done; } }); };
    $('#p3').onclick = () => go('contest');
    $('#pc').onclick = () => go('combine');
    $('#pw').onclick = () => go('world');
    $('#pd').onclick = () => go('dunk');
    $('#pf').onclick = () => go('free');
  }
  function how() {
    show(`<div class="page howto"><button class="back" id="bk">‹ Back</button><h2>How to play</h2>
      <div class="card"><h3>Moving</h3><p>Put your left thumb anywhere on the lower left and drag: the stick appears under it. Push to the edge to sprint (it drains your stamina bar; walking brings it back).</p></div>
      <div class="card"><h3>Shooting</h3><p>Hold <b>Shoot</b> and let go at the top of your jump, when the meter crosses the green band. A quick tap of <b>Shoot</b> is a pump fake: a defender who jumps at it is out of the play. The text after tells you how the release was and how covered you were. Close to the rim it is a layup, a dunk or a floater on the run; a big who goes up contested in the paint shoots a hook, and a jumper drifting away from the rim is a fadeaway (harder to make, harder to contest). Settings › Shot timing makes the band wider or narrower.</p></div>
      <div class="card"><h3>Dunking</h3><p>At the rim, <b>Shoot</b> is a dunk: standing within a step or two of it, or from further out with a run. A good leaper takes off from further still. With nobody near on a breakaway a flier throws down a windmill, a reverse or a 360. Player › Look picks your dunk (tomahawk, two-hand, windmill) and your celebration.</p></div>
      <div class="card"><h3>Passing and moves</h3><p><b>Pass</b> goes to the teammate under the green arrow: the open man, or the one your stick points at. You can also tap a teammate on the floor to pass straight to him.<br>
      <b>Move</b>: tap for a crossover, or swipe the button: left or right to cross that way, down for a step-back (room for the jumper), up for a spin to the rim. Near the rim, a sideways swipe is a euro step. A big inside sixteen feet who swipes down posts up instead: back your man down, then shoot a hook over him. Moves chain: one inside a second and a half of the last builds a combo that is harder to guard, and beating your man gives you a second of extra speed. <b>Pick</b> (over half court with the ball) calls your big to set a screen on your man, then roll.</p></div>
      <div class="card"><h3>Without the ball</h3><p><b>Call</b> asks for it. <b>Cut</b> runs you to the rim and calls for it; a big enough leaper gets the alley-oop thrown up for him.</p></div>
      <div class="card"><h3>Defense</h3><p>Slide to stay between your man and the rim: get set in front of a driver and you cut him off. <b>Steal</b> when the button lights up (the ball is on your side, or he is crossing over); a reach at a protected ball is mostly a foul. Every shot you guard is called, from Smothered to Left him open. A hand you get up yourself bothers a shot twice as much, and a block is timing: be near the top of your jump as he lets it go. Lift your thumb and you stay in front of your man by yourself (the red ring). The arrow on the floor in front of him shows where he is going: green while you are between him and the rim, red once he has a step on you. When he shows the ball without going up, it is a fake: stay down. <b>Jump</b> to contest, block and rebound; time it on a shot's way up and you can block it in the air, but touch it on the way down and it is goaltending. <b>Steal</b> to reach (too many reaches is a foul).</p></div>
      <div class="card"><h3>Calling plays</h3><p>Pause and call a play for the next three trips. Tap it again to call it off. The twelve you will use most are on top; under them is the whole playbook, more than a hundred, filed by kind.</p><p><b>Isolation:</b> the floor cleared for you, or for any position, at the top, a wing or an elbow.</p><p><b>Pick-and-roll:</b> high, side, Horns, Spread, Spain, double drag, with either big, rolling, popping or slipping.</p><p><b>Post:</b> any position on either block, the high post, high-low, the triangle.</p><p><b>Shooters:</b> pin-downs, flares, Floppy, Elevator doors, Hammer: a screen away from the ball and a shot on the catch.</p><p><b>Cuts and handoffs:</b> backdoors, the give and go, UCLA, Flex, Pistol, the weave.</p><p><b>Sets, drives, tempo:</b> eleven formations, a drive for any guard, Seven seconds, Four corners.</p><p><b>On defense:</b> press up, pack the paint, zones (2-3, 3-2, 1-3-1), box and one, traps, deny or double their scorer. Each gives something up.</p><p>Call nothing and the coach calls plays himself, as theirs does. Get hot and the defense will send two at you: pass to the open man.</p></div>
      <div class="card"><h3>The rules</h3><p>Eight seconds to cross half court, no going back over it, three seconds in the lane (a warning comes first), the shot clock. Two fouls in the first quarter, three in the second or four in the third and the coach sits you for the rest of it; six and you are out.</p></div>
      <div class="card"><h3>Your grade and growth</h3><p>Every play moves your teammate grade. The grade, your goals, practice and badges earn skill points; the Player tab spends them (Auto-upgrade does it for you). The coach's trust decides whether you start.</p></div>
      <div class="card"><h3>Controller</h3><p>Left stick or d-pad to move, A to shoot or jump, B to pass, call or steal, X for a crossover or a cut, Y for a step-back, the right bumper for a spin, the left bumper to call a pick, Start to pause.</p></div>
      <div class="card"><h3>Keyboard</h3><p>WASD or arrows to move, J or Space to shoot or jump, K to pass, call or steal, L for a crossover or a cut, U for a step-back, I for a spin, O to call a pick, P to pause.</p></div>
      <p class="fine">Left-handed? Settings › Buttons puts them on the left.</p></div>`);
    /* one topic open at a time, the first to begin with */
    scr().querySelectorAll('.howto > .card').forEach((c, i) => { const d = document.createElement('details'); d.className = 'help how'; d.open = !i;
      const sm = document.createElement('summary'); sm.textContent = c.querySelector('h3').textContent; c.querySelector('h3').remove(); d.append(sm, ...c.childNodes); c.replaceWith(d);
      d.addEventListener('toggle', () => { if (d.open) scr().querySelectorAll('details.how').forEach(o => { if (o !== d) o.open = false; }); }); });
    $('#bk').onclick = title;
  }

  /* ---------- your profile: every real game you have played, in any mode ---------- */
  function profile() {
    const L = load('pbb.life') || { games: 0, wins: 0, streak: 0, bestStreak: 0, sum: {}, best: {} }, s = L.sum || {}, b = L.best || {}, g = Math.max(1, L.games);
    const per = k => ((s[k] || 0) / g).toFixed(1), pct = (m, a) => s[a] ? Math.round((s[m] || 0) / s[a] * 100) + '%' : '–';
    const tile = (v, l) => `<div class="pft"><b>${v}</b><small>${l}</small></div>`;
    const ach = load('pbb.ach') || {}, achN = Array.isArray(ach) ? ach.length : Object.keys(ach.got || ach).length;
    show(`<div class="page"><button class="back" id="bk">‹ Back</button><h2>Profile</h2>
      ${L.games ? `<p class="kick">Every game you have played</p>
      <div class="pfg">${tile(L.games, 'games')}${tile(`${L.wins}-${L.games - L.wins}`, 'record')}${tile(Math.round(L.wins / g * 100) + '%', 'won')}${tile(L.bestStreak || 0, 'best win streak')}</div>
      <p class="kick">A game</p>
      <div class="pfg">${tile(per('pts'), 'points')}${tile(per('reb'), 'rebounds')}${tile(per('ast'), 'assists')}${tile(per('stl'), 'steals')}${tile(per('blk'), 'blocks')}${tile(pct('fgm', 'fga'), 'field goals')}${tile(pct('tpm', 'tpa'), 'threes')}${tile(pct('ftm', 'fta'), 'free throws')}</div>
      <p class="kick">All time</p>
      <div class="pfg">${tile(s.pts || 0, 'points')}${tile(s.tpm || 0, 'threes made')}${tile(s.dunk || 0, 'dunks')}${tile(s.ast || 0, 'assists')}${tile(s.shake || 0, 'defenders beaten')}${tile(s.stl || 0, 'steals')}${tile(s.blk || 0, 'blocks')}${tile(L.street || 0, 'blacktop games')}</div>
      <p class="kick">Best game</p>
      <div class="pfg">${tile(b.pts || 0, 'points')}${tile(b.reb || 0, 'rebounds')}${tile(b.ast || 0, 'assists')}${tile(b.tpm || 0, 'threes')}${tile(b.dunk || 0, 'dunks')}${tile(b.stl || 0, 'steals')}${tile(b.blk || 0, 'blocks')}${tile(achN || 0, 'achievements')}</div>`
      : '<div class="card"><p>Nothing here yet. Play a game in any mode and your numbers start adding up: your record, what you average, your best night.</p></div>'}
      <p class="fine">Counted from full games and blacktop runs, in every mode. Kept on this device.</p></div>`);
    $('#bk').onclick = title;
  }
  /* ---------- what's new: the top of the changelog, as shipped ---------- */
  function about() {
    show(`<div class="page"><button class="back" id="bk">‹ Back</button><h2>What's new</h2><div class="card" id="wn"><p class="mute">Loading…</p></div>
      <div class="card"><h3>About</h3><p>Pocket Basketball is a career game for your phone: one player, from draft night to the Hall of Fame. Every team and player is fictional. Nothing is sold here. Nothing leaves your device but the chat, if you use it, and your saves, if you make an account.</p><p class="mute">Without an account your careers are kept on this device only, and clearing this site's data in your browser erases them: Settings, More has an export to keep a copy. With an account (Sign in, on the main menu) a copy is kept with it, along with your email address, and you can play on any phone. Deleting the account deletes both.</p><p class="fine">Version ${PB.VERSION}</p></div></div>`);
    $('#bk').onclick = title;
    fetch('CHANGELOG.md').then(r => r.ok ? r.text() : Promise.reject()).then(t => { const e = $('#wn'); if (!e) return;
      const items = t.split('\n').filter(l => l.startsWith('- ')).slice(0, 14).map(l => l.slice(2).replace(/[<>&]/g, ''));
      e.innerHTML = items.length ? `<ul class="wn">${items.map(i => { const k = i.search(/[.:] /); return `<li>${k > 0 && k < 70 ? `<b>${i.slice(0, k + 1)}</b>${i.slice(k + 1)}` : i}</li>`; }).join('')}</ul>` : '<p class="mute">Nothing to show.</p>'; })
      .catch(() => { const e = $('#wn'); if (e) e.innerHTML = '<p class="mute">The list of changes could not be loaded. Check your connection.</p>'; });
  }
  function settings() {
    /* a row: the name on the left; a switch for on/off, a short run of choices otherwise */
    const opt = (k, vals, lab, sub) => { const sw = vals.length === 2 && vals[0] === 'On';
      return `<div class="srow${sw ? '' : ' wide'}"><label>${lab}${sub ? `<small>${sub}</small>` : ''}</label>${sw
        ? `<div class="seg sw" data-k="${k}"><button class="tog${S[k] !== 'Off' ? ' on' : ''}" role="switch" aria-checked="${S[k] !== 'Off'}" aria-label="${lab}" data-v="${S[k] !== 'Off' ? 'Off' : 'On'}"><i></i></button></div>`
        : `<div class="seg sm" data-k="${k}">${vals.map(v => `<button class="${S[k] == v ? 'on' : ''}" data-v="${v}">${typeof v === 'number' && k === 'qlen' ? v + ' min' : v}</button>`).join('')}</div>`}</div>`; };
    const GROUPS = {
      Game: [opt('level', ['Rookie', 'Pro', 'All-Star', 'Legend'], 'Difficulty'), opt('qlen', [2, 3, 5, 12], 'Quarter length'), opt('timing', ['Easy', 'Normal', 'Hard'], 'Shot timing', 'how wide the green band is'),
        opt('speed', ['Normal', 'Fast', 'Faster'], 'Game speed', 'how fast everything on the floor moves'), opt('fouls', ['Fewer', 'Normal', 'More'], 'Fouls', 'how often the whistle blows'),
        opt('fatigueOn', ['On', 'Off'], 'Fatigue', 'legs go as the game goes on'), opt('coachPlays', ['On', 'Off'], 'Coach calls plays', 'when you have not called one'),
        opt('warmOn', ['On', 'Off'], 'Pre-game shootaround', 'a minute to find your shot before the tip'),
        opt('season', [10, 20, 41, 82], 'Games in a career season', 'from next season on'), opt('replaysOn', ['On', 'Off'], 'Replays'), opt('introOn', ['On', 'Off'], 'Opening and lineups', 'the camera work before the tip')],
      Controls: [opt('hand', ['Right-handed', 'Left-handed'], 'Buttons'), opt('btnSize', ['Normal', 'Large'], 'Button size'), opt('meterOn', ['On', 'Off'], 'Shot meter', 'off: shoot by the look of the jump, with a wider green window'),
        opt('tapShoot', ['Pump fake', 'Shoot'], 'A quick tap on Shoot', 'a fake, or the shot let go at once'), opt('vibrateOn', ['On', 'Off'], 'Vibration', 'Android')],
      Camera: [opt('cam', ['Player lock', 'Broadcast', 'Overhead'], 'Camera'), opt('camDist', ['Closer', 'Default', 'Farther'], 'Player lock distance'), opt('shakeOn', ['On', 'Off'], 'Camera shake', 'on dunks and blocks'), opt('freezeOn', ['On', 'Off'], 'Freeze on big plays', 'the beat a block or a dunk lands on'), opt('slowOn', ['On', 'Off'], 'Slow motion', 'on a shot to tie or win it'),
        opt('tags', ['You and the ball', 'You', 'Off'], 'Name tags over players'), opt('radarOn', ['On', 'Off'], 'Radar', 'the whole floor, top right'), opt('offOn', ['On', 'Off'], 'Off-screen arrows', 'where an opponent off the screen is')],
      Look: [opt('gfx', ['High', 'Low'], 'Graphics', 'Low for older phones'), opt('ball', ['Classic', 'Black', 'White', 'Street'], 'Ball', 'from your next game'), opt('fxOn', ['On', 'Off'], 'Comic hit effects', 'BLOCK!, SLAM!, stars'), opt('callsOn', ['On', 'Off'], 'Big calls on screen', 'SPLASH, BLOCKED, STOLEN'),
        opt('quipsOn', ['On', 'Off'], 'Coach and teammate comments'), opt('feedOn', ['On', 'Off'], 'Play-by-play', 'the lines under the scoreboard')],
      Sound: [opt('soundOn', ['On', 'Off'], 'Sound'), opt('musicOn', ['On', 'Off'], 'Menu music'), opt('commentaryOn', ['On', 'Off'], 'Commentary'), opt('volCrowd', ['Low', 'Normal', 'High'], 'Crowd volume'), opt('volBooth', ['Low', 'Normal', 'High'], 'Commentary volume'),
        opt('volSfx', ['Low', 'Normal', 'High'], 'Effects volume', 'the ball, the rim, sneakers'), opt('volMusic', ['Low', 'Normal', 'High'], 'Music volume')],
    };
    if (!GROUPS[settings.tab] && settings.tab !== 'More') settings.tab = 'Game';
    show(`<div class="page"><button class="back" id="bk">‹ Back</button><h2>Settings</h2>
      <div class="stabs">${Object.keys(GROUPS).map(k => `<button data-tab="${k}" class="${k === settings.tab ? 'on' : ''}">${k}</button>`).join('')}<button data-tab="More" class="${settings.tab === 'More' ? 'on' : ''}">More</button></div>
      ${GROUPS[settings.tab] ? `<div class="card set">${GROUPS[settings.tab].join('')}</div>` : ''}
      ${settings.tab === 'More' ? `<button class="ghost" id="retips">Show the first-game tips again<small>the cards that explain each moment the first time it comes up</small></button>
      <button class="ghost" id="edteams">Edit teams<small>city, nickname, short name, colors and the court</small></button>
      <p class="kick">Your save</p>
      <button class="ghost" id="setacct">${PB.account && PB.account.user() ? 'Your account' : 'Create an account or sign in'}<small>${PB.account && PB.account.user() ? 'your saves are kept in it' : 'keep your saves in an account, and play on any phone'}</small></button>
      <button class="ghost" id="svout">Export my save<small>a file with your careers, records and settings</small></button>
      <button class="ghost" id="svin">Import a save<small>replaces what is on this device with a file you exported</small></button>
      <button class="ghost" id="setdef">Put settings back to default</button>
      <button class="ghost" id="svwipe">Erase everything<small>careers, records, achievements, settings. It cannot be undone</small></button>` : ''}
      <p class="fine">Settings are kept on this device. Version ${PB.VERSION}</p></div>`);
    scr().querySelectorAll('.stabs button').forEach(b => b.onclick = () => { settings.tab = b.dataset.tab; settings(); });
    $('#bk').onclick = () => C && !scr().dataset.fromTitle ? title() : title();
    if ($('#edteams')) $('#edteams').onclick = () => editTeams();
    if ($('#setacct')) $('#setacct').onclick = () => PB.account && PB.account.open(settings);
    if ($('#svout')) {
      const keys = () => Object.keys(localStorage).filter(k => k.startsWith('pbb.'));
      $('#svout').onclick = () => { const o = {}; for (const k of keys()) o[k] = localStorage.getItem(k);
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify({ pocketBasketball: 1, at: new Date().toISOString(), data: o })], { type: 'application/json' })); a.download = 'pocket-basketball-save.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); };
      $('#svin').onclick = () => { const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json,application/json';
        inp.onchange = () => { const f = inp.files && inp.files[0]; if (!f) return; f.text().then(t => { let o = null; try { o = JSON.parse(t); } catch (e) { /* not a save */ }
          const data = t.length > 3e7 ? null : saveCheck(o);
          if (!data) { alert('That file is not a Pocket Basketball save.'); return; }
          if (!confirm('Replace everything on this device with the save in this file?')) return;
          if (!saveApply(data)) alert('This device ran out of room for the save.'); location.reload(); }); };
        inp.click(); };
      $('#setdef').onclick = () => { if (!confirm('Put every setting back to its default?')) return; localStorage.removeItem(SET); location.reload(); };
      $('#svwipe').onclick = () => { if (!confirm('Erase every career, record, achievement and setting on this device? This cannot be undone.')) return; if (!confirm('Last check: erase everything?')) return; for (const k of keys()) localStorage.removeItem(k); location.reload(); };
    }
    if ($('#retips')) $('#retips').onclick = () => { try { localStorage.removeItem('pbb.tips'); } catch (e) { /* fine */ } if (PB.Game && PB.Game.resetTips) PB.Game.resetTips(); $('#retips').firstChild.textContent = 'Tips are back on'; };
    scr().querySelectorAll('.seg button').forEach(b => b.onclick = () => {
      const k = b.parentElement.dataset.k, v = b.dataset.v;
      S[k] = isNaN(+v) ? v : +v;
      S.sound = S.soundOn !== 'Off'; S.music = S.musicOn !== 'Off'; S.commentary = S.commentaryOn !== 'Off'; S.replays = S.replaysOn !== 'Off'; S.vibrate = S.vibrateOn !== 'Off'; S.radar = S.radarOn !== 'Off';
      saveSettings(); if (PB.audio) { PB.audio.music(true); if (PB.audio.mix) PB.audio.mix(); } if (k === 'gfx' && PB.R && PB.R.resize) PB.R.resize(); settings();
    });
  }

  /* ---------- edit teams: renames and colors, on this device only ---------- */
  function editTeams(sel) {
    if (!sel) {
      show(`<div class="page"><button class="back" id="bk">‹ Back</button><h2>Edit teams</h2>
        <p class="fine">Rename any team or change its colors. The changes stay on this device. Every team and player is fictional.</p>
        ${['East', 'West'].map(c => `<div class="card"><h3>${c}</h3>${PB.TEAMS.filter(t => t.conf === c).map(t => `<button class="trow" data-id="${t.id}">${badge(t)}<span>${esc(t.city)} ${esc(t.name)}</span></button>`).join('')}</div>`).join('')}
        <button class="ghost sm" id="reset">Put every team back the way it was</button></div>`);
      $('#bk').onclick = settings;
      scr().querySelectorAll('.trow').forEach(b => b.onclick = () => editTeams(b.dataset.id));
      $('#reset').onclick = () => { if (!confirm('Undo every team edit?')) return; try { localStorage.removeItem('pbb.teams'); } catch (e) { /* fine */ } PB.applyTeamEdits(); editTeams(); };
      return;
    }
    const t = PB.team(sel);
    show(`<div class="page"><button class="back" id="bk">‹ All teams</button><h2>${badge(t)} ${esc(t.city)} ${esc(t.name)}</h2>
      <div class="field"><label>City</label><input id="ec" maxlength="18" value="${esc(t.city)}"></div>
      <div class="field"><label>Nickname</label><input id="en" maxlength="16" value="${esc(t.name)}"></div>
      <div class="field"><label>Short name (2 to 4 letters)</label><input id="ea" maxlength="4" value="${esc(t.ab)}"></div>
      <div class="row2"><div class="field"><label>Main color</label><input id="e1" type="color" value="${t.c1}"></div><div class="field"><label>Second color</label><input id="e2" type="color" value="${t.c2}"></div></div>
      <div class="field"><label>Court design</label><div class="seg" id="ect">${[['', 'Auto'], ['0', 'Classic'], ['1', 'Stained arc'], ['2', 'Two-tone key'], ['3', 'Open key']].map(([v, n]) => `<button data-v="${v}" class="${String(t.court ?? '') === v ? 'on' : ''}">${n}</button>`).join('')}</div></div>
      <button class="big" id="sv">Save</button></div>`);
    $('#bk').onclick = () => editTeams();
    scr().querySelectorAll('#ect button').forEach(b => b.onclick = () => scr().querySelectorAll('#ect button').forEach(x => x.classList.toggle('on', x === b)));
    $('#sv').onclick = () => {
      let ed = {}; try { ed = JSON.parse(localStorage.getItem('pbb.teams') || '{}'); } catch (e) { ed = {}; }
      const v = id => $(id).value.trim();
      ed[t.id] = { city: v('#ec') || t.city, name: v('#en') || t.name, ab: (v('#ea') || t.ab).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) || t.ab, c1: v('#e1'), c2: v('#e2') };
      { const cd = (scr().querySelector('#ect button.on') || { dataset: { v: '' } }).dataset.v; if (cd !== '') ed[t.id].court = +cd; }
      try { localStorage.setItem('pbb.teams', JSON.stringify(ed)); } catch (e) { /* fine */ }
      PB.applyTeamEdits(); editTeams();
    };
  }

  /* ---------- quick game ---------- */
  /* ---------- the blacktop: half court, 1v1 / 2v2 / 3v3, first to 11, 15 or 21 ----------
     The best of each team by position (a guard; a guard and a big; a guard, a wing and a big), or your own career
     player at the front of yours. Scored by 2s and 3s or by 1s and 2s, win by two; after a basket the other side
     checks it up, or the scorer keeps it (make it, take it). */
  /* ---------- Classics: the league's great nights, replayed (the console game's Paragon, the phone game's Rewind) ----------
     Each one drops you into the last minutes of a famous game in this league's own history: the score, the clock and
     the ball as they were, and a goal on top of the win. One star for the win, two for the goal, three for the goal and
     a B+ or better. */
  const CLASSICS = [
    { id: 'c1', era: 'Finals, Game 7', title: 'The Shot in the Fog', a: 'SF', b: 'BOS', pos: 'SG', ovr: 88, q: 4, clock: 24, score: [101, 103], poss: 0, goal: ['win', 0], text: 'Down two, 24 seconds left, the title on the line. The Fog have never won one.' },
    { id: 'c2', era: 'Conference Finals', title: 'Twelve in Ninety', a: 'IND', b: 'MIL', pos: 'PG', ovr: 86, q: 4, clock: 90, score: [88, 97], poss: 0, goal: ['win', 0], text: 'Nine points down with a minute and a half to play in Milwaukee. Nobody comes back from this. Do it.' },
    { id: 'c3', era: 'Regular season', title: 'Fifty in the Garden', a: 'NY', b: 'BKN', pos: 'SF', ovr: 87, q: 4, clock: 150, score: [104, 104], poss: 0, goal: ['pts', 8], text: 'The crosstown game, tied, two and a half minutes left, and the Empire\'s star on 42. Get him to fifty: score 8.' },
    { id: 'c4', era: 'Finals, Game 5', title: 'The Block', a: 'MIA', b: 'LAK', pos: 'C', ovr: 86, q: 4, clock: 45, score: [96, 95], poss: 1, goal: ['hold', 0], text: 'Up one, 45 seconds left, and the Knights have the ball. Win it without letting them score again.' },
    { id: 'c5', era: 'First round, Game 6', title: 'Rattlers Rising', a: 'SA', b: 'DEN', pos: 'PF', ovr: 85, q: 4, clock: 120, score: [89, 93], poss: 0, goal: ['reb', 3], text: 'Four down at altitude with two minutes left. The Rattlers\' big man did it on the glass: grab 3 boards and win.' },
    { id: 'c6', era: 'All-Star Game', title: 'East Beats West', a: 'CHI', b: 'PHX', pos: 'PG', ovr: 90, q: 4, clock: 60, score: [154, 156], poss: 0, goal: ['ast', 3], text: 'The one All-Star Game anyone remembers. Down two, a minute left: hand out 3 assists and win it.' },
    { id: 'c7', era: 'Play-in', title: 'The Monuments\' Night', a: 'WAS', b: 'CHA', pos: 'SG', ovr: 84, q: 4, clock: 35, score: [97, 100], poss: 0, goal: ['three', 1], text: 'Down three, 35 seconds left, the season on the line. They needed a three. Hit one, and win.' },
    { id: 'c8', era: 'Finals, Game 6', title: 'Peaks Over the Top', a: 'SLC', b: 'ORL', pos: 'SF', ovr: 87, q: 4, clock: 180, score: [92, 99], poss: 0, goal: ['margin', 3], text: 'Seven down, three minutes left. The Peaks didn\'t just come back, they ran away with it: win by 3 or more.' },
    { id: 'c9', era: 'Western semifinals', title: 'The Krewe\'s Comeback', a: 'NO', b: 'OKC', pos: 'PG', ovr: 85, q: 3, clock: 120, score: [68, 82], poss: 0, goal: ['win', 0], text: 'Fourteen down late in the third. The building had started to empty. It came back.' },
    { id: 'c10', era: 'Regular season', title: 'Double Overtime in Detroit', a: 'DET', b: 'CLE', pos: 'C', ovr: 86, q: 4, clock: 18, score: [113, 113], poss: 1, goal: ['win', 0], text: 'Tied, 18 seconds left, the Ironmen with the ball. Get the stop and finish it, however long it takes.' },
    { id: 'c11', era: 'Finals, Game 4', title: 'Gold Rush', a: 'SAC', b: 'ATL', pos: 'SG', ovr: 88, q: 4, clock: 240, score: [90, 94], poss: 0, goal: ['pts', 12], text: 'The night the Gold\'s shooter caught fire: four minutes, four points down. Score 12 and win.' },
    { id: 'c12', era: 'Conference Finals, Game 7', title: 'Wranglers at the Buzzer', a: 'DAL', b: 'HOU', pos: 'PF', ovr: 87, q: 4, clock: 9, score: [97, 98], poss: 0, goal: ['win', 0], text: 'Down one, nine seconds left, the ball at half court. The rodeo city still talks about it.' },
  ];
  const CGOAL = { win: () => 'Win the game', pts: n => `Score ${n}+ points`, reb: n => `Grab ${n}+ rebounds`, ast: n => `Hand out ${n}+ assists`, three: n => `Make ${n}+ three${n > 1 ? 's' : ''}`, margin: n => `Win by ${n}+`, hold: () => 'Do not let them score' };
  function classics() {
    const R0 = load('pbb.classics') || {}, stars = Object.values(R0).reduce((a, x) => a + (x || 0), 0);
    show(`<div class="page"><button class="back" id="bk">‹ Back</button><h2>Classics</h2>
      <p class="mute">The league's great nights, replayed from the last minutes. ${stars} of ${CLASSICS.length * 3} stars.</p>
      ${CLASSICS.map((c, i) => { const A = PB.team(c.a), B = PB.team(c.b), st = R0[c.id] || 0;
        return `<button class="mode clsc" data-i="${i}" style="--tc:${A.c1}">${badge(A)}<span><b>${esc(c.title)}</b><small>${esc(c.era)} · ${A.ab} vs ${B.ab} · ${CGOAL[c.goal[0]](c.goal[1])}</small></span><em class="stars">${'★'.repeat(st)}<i>${'★'.repeat(3 - st)}</i></em></button>`; }).join('')}
      <p class="fine">One star for the win, two for the goal too, three for the goal and a B+ or better.</p></div>`);
    $('#bk').onclick = title;
    scr().querySelectorAll('.clsc').forEach(b => b.onclick = () => classic(CLASSICS[+b.dataset.i]));
  }
  function classic(c) {
    const A = PB.team(c.a), B = PB.team(c.b);
    const fmt = c.clock >= 60 ? `${Math.floor(c.clock / 60)}:${String(c.clock % 60).padStart(2, '0')}` : `${c.clock} seconds`;
    show(`<div class="page"><button class="back" id="bk">‹ Classics</button><p class="kick">${esc(c.era)}</p><h2>${esc(c.title)}</h2>
      <div class="final"><div>${badge(A)}<b>${c.score[0]}</b></div><em>${['', '1st', '2nd', '3rd', '4th'][c.q]} · ${fmt}</em><div><b>${c.score[1]}</b>${badge(B)}</div></div>
      <div class="card"><p>${esc(c.text)}</p><p class="fine">You: the ${PB.POS_NAME[c.pos].toLowerCase()} of the ${esc(tname(A))} (${c.ovr} overall), ${c.poss === 0 ? 'with the ball' : 'on defense'}.</p>
      <p><b>Goal:</b> ${CGOAL[c.goal[0]](c.goal[1])}${c.goal[0] !== 'win' && c.goal[0] !== 'margin' && c.goal[0] !== 'hold' ? ', and win' : ''}</p></div>
      <button class="big" id="go">Play it</button></div>`);
    $('#bk').onclick = classics;
    $('#go').onclick = () => {
      const tk = new Set(), fa = PB.makeRoster(84, tk), fb = PB.makeRoster(84, tk), ra = fa.slice(0, 5), rb = fb.slice(0, 5);
      const me = ra[PB.POS.indexOf(c.pos)]; me.r = PB.makeRatings(c.pos, c.ovr); me.ovr = PB.ovr(me.r, c.pos); { const n = youName(); me.first = n[0]; me.last = n[1]; }
      scr().hidden = true;
      PB.Game.start({ teams: [A, B], rosters: [ra, rb], bench: [fa.slice(5, 9), fb.slice(5, 9)], userId: me.id, qlen: Math.max(S.qlen || 3, Math.ceil(c.clock / 60) + 1), level: 'All-Star', floor: A,
        scenario: { q: c.q, clock: c.clock, score: c.score.slice(), poss: c.poss, title: c.title },
        onEnd: r => {
          const u = r.user || {}, won = r.score[0] > r.score[1], them = r.score[1] - c.score[1];
          const g = c.goal[0], n = c.goal[1], met = won && (g === 'win' || (g === 'pts' && u.pts >= n) || (g === 'reb' && u.reb >= n) || (g === 'ast' && u.ast >= n) || (g === 'three' && u.tpm >= n) || (g === 'margin' && r.score[0] - r.score[1] >= n) || (g === 'hold' && them <= 0));
          const top = met && ['A+', 'A', 'A-', 'B+'].includes(r.grade), st = !won ? 0 : top ? 3 : met ? 2 : 1;
          const R1 = load('pbb.classics') || {}; const was = R1[c.id] || 0; if (st > was) { R1[c.id] = st; store('pbb.classics', R1); }
          show(`<div class="page post"><p class="kick">Classics · ${esc(c.title)}</p><div class="final"><div>${badge(A)}<b>${r.score[0]}</b></div><em>${won ? 'WIN' : 'LOSS'}</em><div><b>${r.score[1]}</b>${badge(B)}</div></div>
            <div class="gradebig"><b class="stars">${'★'.repeat(st)}<i>${'★'.repeat(3 - st)}</i></b><span>${st > was ? 'New best' : st ? 'Stars' : 'Not this time'}</span></div>
            <p class="mute">${!won ? 'History says otherwise. Try it again.' : met ? (top ? 'Goal met, and played the right way.' : `Goal met. A B+ or better earns the third star (you had ${r.grade || '–'}).`) : `You won, but the goal was: ${CGOAL[g](n)}.`}</p>
            <div class="tiles"><div><b>${u.pts || 0}</b><span>PTS</span></div><div><b>${u.reb || 0}</b><span>REB</span></div><div><b>${u.ast || 0}</b><span>AST</span></div></div>
            ${potg(r)}${reelBtn()}<button class="big" id="again">Play it again</button><button class="ghost" id="done">Classics</button></div>`);
          $('#again').onclick = () => classic(c); $('#done').onclick = classics; reelWire();
        } });
    };
  }
  /* ---------- your rank: the console game's rep, by followers. Each rank pays skill points and unlocks gear ---------- */
  const RANKS = [['Rookie', 0], ['Rotation', 1e4], ['Starter', 2.5e4], ['Fan favorite', 6e4], ['All-Star', 1.5e5], ['Superstar', 4e5], ['MVP', 1e6], ['Legend', 2.5e6], ['GOAT', 6e6]];
  const RANK_GIFT = ['', 'Volt shoes', 'Gold headband, sleeve and wristbands', 'Royal shoes', 'Infrared shoes and sleeve', 'Chrome shoes and headband', 'MVP purple shoes', 'Platinum hair', 'Diamond shoes'];
  const rankOf = f => { let i = 0; for (let k = 0; k < RANKS.length; k++) if ((f || 0) >= RANKS[k][1]) i = k; const nx = RANKS[i + 1]; return { i, name: RANKS[i][0], next: nx ? nx[0] : null, frac: nx ? Math.min(1, ((f || 0) - RANKS[i][1]) / (nx[1] - RANKS[i][1])) : 1, need: nx ? nx[1] : 0 }; };
  function rankUp() {
    const r = rankOf(C.fans), was = C.rank ?? r.i; C.rank = Math.max(was, r.i);
    for (let i = was + 1; i <= r.i; i++) { const sp = 2 + Math.floor(i / 2); C.me.sp += sp; C.news.unshift(`Rank up: ${RANKS[i][0]}. +${sp} skill points, and ${RANK_GIFT[i]} in your Look card`); C.feed.unshift({ who: '@league', text: `${PB.full(C.me)} is now a ${RANKS[i][0]}` }); C.rankNew = i; }
  }
  /* ---------- quests (the Neighborhood's, the daily ones): three at a time, over the next few games ----------
     Counted as you play them (or sim them), sized to your minutes and the quarter length; one done, another comes */
  const QUESTS = [
    ['pts', 'Score {n} points', 26, 3], ['reb', 'Grab {n} rebounds', 12, 2], ['ast', 'Hand out {n} assists', 9, 2], ['tpm', 'Make {n} threes', 5, 3], ['stl', 'Get {n} steals', 4, 2],
    ['blk', 'Block {n} shots', 3, 2], ['win', 'Win {n} games', 3, 3], ['road', 'Win {n} on the road', 2, 3], ['grade', 'Earn a B+ or better {n} times', 2, 3], ['dd', 'Have {n} big scoring nights', 2, 3],
  ];
  function newQuest(skip) {
    const f = Math.max(0.12, Math.pow((S.qlen || 3) / 12, 0.85)) * ({ Starter: 1, 'Sixth man': 0.7, Bench: 0.45 }[role()] || 1);
    const have = (C.quests || []).map(q => q.k).concat(skip || []), pool = QUESTS.filter(q => !have.includes(q[0])), q = pool[Math.floor(PB.rand() * pool.length)] || QUESTS[0];
    const scaled = ['pts', 'reb', 'ast', 'tpm', 'stl', 'blk'].includes(q[0]), n = Math.max(1, Math.round(q[2] * (scaled ? f * 4 : 1) / (scaled ? 4 : 1)));
    return { k: q[0], n, got: 0, text: q[1].replace('{n}', n).replace(/ 1 (\w+)s\b/, ' 1 $1'), sp: q[3], fans: 600 + q[3] * 400 };
  }
  const dedupeQuests = () => { const seen = []; C.quests = C.quests.filter(q => !seen.includes(q.k) && seen.push(q.k)); while (C.quests.length < 3) C.quests.push(newQuest(C.quests.map(x => x.k))); };
  /* three quests, no two the same */
  function freshQuests() { const q = []; while (q.length < 3) q.push(newQuest(q.map(x => x.k))); return q; }
  function questTick(res, g) {
    C.quests = C.quests || freshQuests();
    const l = res.line || {}, done = [];
    for (const q of C.quests) {
      const add = { pts: l.pts, reb: l.reb, ast: l.ast, tpm: l.tpm, stl: l.stl, blk: l.blk, win: res.win ? 1 : 0, road: res.win && !g.home ? 1 : 0, grade: res.gscore >= 9 ? 1 : 0, dd: l.pts >= Math.max(4, Math.round(10 * Math.max(0.25, (S.qlen || 3) / 12))) ? 1 : 0 }[q.k] || 0;
      q.got = Math.min(q.n, q.got + add); if (q.got >= q.n) done.push(q);
    }
    for (const q of done) { C.me.sp += q.sp; C.fans = Math.round(C.fans + q.fans); C.news.unshift(`Quest done: ${q.text}. +${q.sp} skill points, +${q.fans.toLocaleString()} followers`); C.questsDone = (C.questsDone || 0) + 1; }
    if (done.length) { const keep = C.quests.filter(q => !done.includes(q)); C.quests = keep; while (C.quests.length < 3) C.quests.push(newQuest(done.map(q => q.k))); }
  }
  function questsCard() {
    C.quests = C.quests || freshQuests(); dedupeQuests();
    const r = rankOf(C.fans);
    return `<div class="card quests"><h3>Rank <small>${C.questsDone || 0} quests done</small></h3>
      <div class="rank"><b>${r.name}</b><i><u style="width:${Math.round(r.frac * 100)}%"></u></i><span>${r.next ? `${fmtFans(C.fans)} of ${fmtFans(r.need)} followers to ${r.next}: ${RANK_GIFT[r.i + 1]}` : 'The top of the ladder'}</span></div>
      <h3>Quests</h3>${C.quests.map(q => `<div class="qst"><span>${esc(q.text)}</span><i><u style="width:${Math.round(q.got / q.n * 100)}%"></u></i><b>${q.got}/${q.n}</b><small>+${q.sp} SP</small></div>`).join('')}</div>`;
  }
  /* ---------- the daily reward: come back each day, a little more each day of a seven-day run ---------- */
  function loginReward() {
    const d = new Date(), key = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; const L = C.login || (C.login = { last: null, day: 0 });
    if (L.last === key) return null;
    const y = new Date(d); y.setDate(d.getDate() - 1); const yk = `${y.getFullYear()}-${y.getMonth() + 1}-${y.getDate()}`;
    L.day = L.last === yk ? L.day % 7 + 1 : 1; L.last = key;
    const sp = L.day === 7 ? 4 : L.day >= 4 ? 2 : 1, fans = 250 * L.day; C.me.sp += sp; C.fans = Math.round(C.fans + fans);
    return { day: L.day, sp, fans };
  }
  /* ---------- the park: home ----------
     You spawn here: your My Player, on foot, in his city's park. A wall down one side has a door for every mode (your
     career, a quick game, a season, the gym, the closet, Blacktop, Classics, the daily challenge, My Player); along the
     other sideline are the pick-up games and Pro-Am. The Menu button is all of it as a list, with a map: tap a ring and
     you are there. The first visit walks you through the controls. Park games are exhibitions: they build your
     followers and your park record, not your season line. */
  const parkTeam = () => C && C.team ? PB.team(C.team) : PB.team('LAK');
  const parkFloor = () => Object.assign({}, parkTeam(), { street: true, park: true, court: 0 });
  const parkGuy = (pos, ovr) => { const p = PB.makePlayer(pos, PB.clamp(Math.round(ovr + PB.gauss() * 3), 55, 92), PB.ri(19, 31)); return p; };
  let parkFrom = null, parkNpcs = [];
  const careerLine = () => {
    if (C.phase === 'combine') return 'the draft combine is waiting';
    if (C.phase === 'awards') return 'awards night';
    if (C.phase === 'offseason') return 'the offseason';
    if (C.phase === 'retired') return 'retired';
    const nx = nextGame(); if (!nx) return C.phase === 'playoffs' ? 'the playoffs' : `season ${C.year}`;
    return `${nx.label.split(' · ').slice(0, 2).join(' · ')} · vs ${PB.team(nx.opp).name}`;
  };
  const nextLive = () => (C.phase === 'regular' || C.phase === 'playoffs') && C.team ? nextGame() : null;
  /* what the career's home page has waiting (the same cards it shows over the next game): the park points you there */
  const waiting = () => {
    if (!C || !C.team || (C.phase !== 'regular' && C.phase !== 'playoffs')) return [];
    const w = [], nx = nextLive();
    if (C.endorse && C.endorse.offer !== undefined && C.endorse.offer >= C.endorse.tier) w.push('A shoe deal offer');
    if (C.event) w.push('Something came up');
    if (C.coachTalk) w.push('The coach wants a word');
    if (C.season && C.season.allstar && !C.asg) w.push('The All-Star Game');
    if (C.contest === 'invited') w.push('The 3-Point Contest');
    if (C.dunk === 'invited') w.push('The Dunk Contest');
    if (C.rising === 'invited') w.push('Rising Stars');
    const rvx = C.rival && rivalP(); if (nx && rvx && nx.opp === C.rival.team && C.talk !== `${C.year}-${C.gi}-${C.phase}`) w.push('Your rival posted about you');
    return w;
  };
  function park(at) { try { parkDraw(at); } catch (err) { wontOpen(err); } }
  function parkDraw(at) {
    C = C || loadCur();
    if (!C || !C.me) { classicTitle(); return; }
    if (PB.noGL) { tab = 'home'; hub(); return; }
    statsV2();
    const from = at || parkFrom; parkFrom = null;
    const lr = C.team && C.phase !== 'retired' ? loginReward() : null; if (lr) { C.loginShow = lr; rankUp(); save(); setTimeout(() => PB.Game.toast(`Daily reward · day ${lr.day}: +${lr.sp} SP, +${lr.fans} followers`, 'make'), 2600); }
    const P = C.park || { w: 0, l: 0 }, streak = P.streak > 1 ? ` · ${P.streak} wins in a row` : '';
    const o = C.me.ovr, npcs = parkNpcs = ['PG', 'SG', 'SF', 'PF', 'C'].map(pos => parkGuy(pos, o));
    const nx = nextLive(), gymLeft = ['contest', 'combine', 'world', 'dunk', 'free'].filter(k => (C.gym || {})[k] !== today()).length;
    const wt = waiting();
    const info = { career: wt.length ? `${wt[0]}${wt.length > 1 ? ` and ${wt.length - 1} more` : ''} · go in` : careerLine(), players: `${slots().length} player${slots().length === 1 ? '' : 's'} on this device`, daily: dailyDone() ? 'done today ✓' : 'today\'s late-game spot',
      gym: gymLeft ? `${gymLeft} workout${gymLeft > 1 ? 's' : ''} left today` : 'all of today\'s workouts done', court: `park record ${(C.park || { w: 0 }).w}-${(C.park || { l: 0 }).l}`,
      pick1: `pick-up to 11${streak}`, pick2: `pick-up to 21${streak}`, pick3: `pick-up to 21${streak}`,
      wheel: C.wheel === today() ? 'spun today: back tomorrow' : 'a spin a day: skill points or followers', wheelBtn: C.wheel === today() ? 'See it' : 'Spin' };
    /* what comes up on your phone while you are out here: the timeline, the league, who followed you, what is open */
    const notes = [];
    for (const f of (C.feed || []).slice(0, 4)) notes.push({ who: f.who, text: f.text });
    for (const n of (C.news || []).slice(0, 2)) notes.push({ who: 'League news', text: n });
    for (let i = 0; i < 3; i++) notes.push({ who: '@' + FANS[Math.floor(PB.rand() * FANS.length)], text: say('started following you', 'liked your highlight', 'mentioned you: "who is this kid at the park?"', 'shared your last game', 'wants to run 1 on 1') });
    if (!dailyDone()) notes.push({ who: 'Daily challenge', text: 'Today\'s late-game spot is open', go: 'daily' });
    if (gymLeft) notes.push({ who: 'Gym', text: `${gymLeft} workout${gymLeft > 1 ? 's' : ''} left today`, go: 'gym' });
    if (C.wheel !== today()) notes.push({ who: 'Prize wheel', text: 'Your free spin is waiting', go: 'wheel' });
    if (wt.length) notes.push({ who: 'My Career', text: wt[0], go: 'career' });
    notes.push({ who: 'Pro-Am', text: say('A five is looking for one more', 'Run starting in the next few minutes'), go: 'court' });
    scr().hidden = true;
    PB.Game.start({ teams: [parkTeam(), PB.TEAMS[(PB.TEAMS.indexOf(parkTeam()) + 7) % PB.TEAMS.length]], rosters: [[C.me], npcs], userId: C.me.id, drill: 'free', park: true, qlen: 1, level: S.level,
      floor: parkFloor(), parkAt: from, guide: C.phase === 'combine' ? 'career' : null, tutorial: !load('pbb.tut'), tutAt: load('pbb.tutAt') || 0, parkInfo: info, parkNotes: notes, userName: C.me.first, onParkTalk: id => { if (C.talkDay !== today()) { C.talkDay = today(); C.talked = []; } if (C.talked.includes(id) || C.talked.length >= 4) return null; C.talked.push(id); C.fans = (C.fans || 0) + 10; save(); return '+10 followers: word gets around'; }, parkNext: nx ? `Play: vs ${PB.team(nx.opp).name}` : null,
      menu: parkMenu, inPark: { wheel: prizeWheel }, onTut: done => { store('pbb.tut', done ? 1 : 2); store('pbb.tutAt', 0); }, onTutStep: i => store('pbb.tutAt', i), onEnd: r => parkGo(r.parkGo) });
  }
  function parkGo(id) {
    id = id || 'career';
    parkFrom = id === 'next' || id.startsWith('hub:') ? 'career' : id.startsWith('npc:') || id.startsWith('horse:') ? 'pick1' : id;
    if (id === 'pick1' || id === 'pick2' || id === 'pick3') { pickup(+id.slice(-1)); return; }
    if (id.startsWith('npc:')) { const d = parkNpcs.find(x => x.id === id.slice(4)); pickup(1, d || null); return; }
    if (id.startsWith('horse:')) { const d = parkNpcs.find(x => x.id === id.slice(6)); if (d) { horse(d); return; } }
    if (id === 'court') { proAm(); return; }
    if (id === 'gym') { practice(() => park()); return; }
    if (id === 'closet') { tab = 'player'; hub(); setTimeout(() => { const e = scr().querySelector('.lookh') || scr().querySelector('[data-look]'); if (e) e.scrollIntoView({ block: 'start' }); }, 60); return; }
    if (id === 'next') { if (nextLive()) { C.goals = C.goals || makeGoals(); playGame(); } else { tab = 'home'; hub(); } return; }
    if (id.startsWith('hub:')) { tab = id.slice(4); hub(); return; }
    const pages = { quick, season: () => PB.Season.start(), blacktop: () => blacktop(), classics, daily, h2h: () => headToHead(), acct: () => PB.account ? PB.account.open(park) : park(), players: myPlayers, ach: achievements, hall: recordBook,
      how, settings, chat: () => { if (PB.online) PB.online.open(); else park(); } };
    if (pages[id]) { pages[id](); return; }
    tab = 'home'; hub();
  }
  /* the menu's Today: what the day still has in it (quests, the wheel, the daily challenge, the gym's workouts) */
  function todayCard() {
    if (!C.team) return '';
    C.quests = C.quests || freshQuests(); dedupeQuests();
    const L = C.login || {}, gym = ['contest', 'combine', 'world', 'dunk', 'free'].filter(k => (C.gym || {})[k] === today()).length, wh = C.wheel === today(), dd = dailyDone();
    const chip = (on, t, go) => `<button class="pmc ${on ? 'on' : ''}" ${go ? `data-${go}` : ''}><i>${on ? '✓' : '○'}</i>${t}</button>`;
    return `<h4>Today</h4><div class="pmtoday">
      ${C.quests.map(q => `<div class="qst"><span>${esc(q.text)}</span><i><u style="width:${Math.round(q.got / q.n * 100)}%"></u></i><b>${q.got}/${q.n}</b><small>+${q.sp} SP</small></div>`).join('')}
      <div class="pmchips">${chip(L.last === today(), `Daily reward · day ${L.day || 1}`)}${chip(wh, 'Prize wheel', 'tr="wheel"')}${chip(dd, 'Daily challenge', 'go="daily"')}${chip(gym >= 5, `Gym ${gym}/5`, 'go="gym"')}</div></div>`;
  }
  /* the prize wheel by the park's gate: one spin a day */
  const PRIZES = [['+1 SP', 'sp', 1, 26], ['+500', 'fans', 500, 18], ['+2 SP', 'sp', 2, 18], ['+2,000', 'fans', 2000, 12], ['+3 SP', 'sp', 3, 10], ['+5,000', 'fans', 5000, 8], ['+5 SP', 'sp', 5, 5], ['+20,000', 'fans', 20000, 3]];
  function prizeWheel(ov, done) {
    const spun = C.wheel === today(), n = PRIZES.length, seg = 360 / n;
    ov.innerHTML = `<div class="card wheel"><p class="kick">The park</p><h2>Prize wheel</h2><p class="mute">${spun ? `You spun today: ${esc(C.wheelWon || '')}. Back tomorrow.` : 'One spin a day: skill points or followers.'}</p>
      <div class="whl"><i class="ptr"></i><div class="wd" id="wd" style="--n:${n}">${PRIZES.map(([l, k], i) => `<span style="--a:${i * seg + seg / 2}deg" class="${k}">${l}${k === 'fans' ? '<small>followers</small>' : ''}</span>`).join('')}</div><b class="hub0"></b></div>
      <p class="won" id="won"></p>
      ${spun ? '' : '<button class="big" id="spin">Spin</button>'}<button class="ghost" id="wx">Back to the park</button></div>`;
    $('#wx').onclick = () => done(C.wheel === today() ? { wheel: 'spun today: back tomorrow', wheelBtn: 'See it' } : null);
    if (spun) return;
    $('#spin').onclick = () => {
      if (C.wheel === today()) return;
      let r = PB.rand() * PRIZES.reduce((a, x) => a + x[3], 0), i = 0; while (r > PRIZES[i][3]) { r -= PRIZES[i][3]; i++; }
      const [l, k, v] = PRIZES[i];
      C.wheel = today(); C.wheelWon = k === 'sp' ? `${l}` : `${l} followers`;
      if (k === 'sp') C.me.sp += v; else C.fans = Math.round(C.fans + v);
      rankUp(); save();
      $('#spin').disabled = true; $('#spin').textContent = 'Spinning…';
      const wd = $('#wd'), end = 360 * 5 + (360 - (i * seg + seg / 2)) + (PB.rand() - 0.5) * seg * 0.6;
      wd.style.transition = 'transform 3.4s cubic-bezier(.12,.62,.16,1)'; wd.style.transform = `rotate(${end}deg)`;
      if (PB.audio) PB.audio.play('squeak');
      setTimeout(() => { $('#won').innerHTML = `<b>${esc(C.wheelWon)}</b>${k === 'sp' ? 'Spend them in the Player tab.' : 'They count toward your rank.'}`; $('#spin').remove(); if (PB.audio) PB.audio.play('swish'); }, 3500);
    };
  }
  /* the menu, over the park: you, your next game, your career's pages, the park's map (tap a ring to go there),
     every mode, and the rest */
  function parkMenu(ov, ctl) {
    const me = C.me, t = C.team ? PB.team(C.team) : null, rk = rankOf(C.fans), P = C.park || { w: 0, l: 0 }, nx = nextLive();
    const tile = (id, ic, n, sub, dot) => `<button class="pmt" data-go="${id}">${ic}<b>${n}</b>${sub ? `<small>${sub}</small>` : ''}${dot ? '<i class="dot"></i>' : ''}</button>`;
    const nav = k => `<svg viewBox="0 0 24 24" aria-hidden="true">${NAVIC[k]}</svg>`;
    const W = 220, H = 360, mx = x => W / 2 - x / 76 * W, mz = z => H / 2 - z / 128 * H;
    const map = `<svg class="pmmap" viewBox="0 0 ${W} ${H}" role="img" aria-label="Map of the park">
      <rect x="${mx(36)}" y="${mz(62)}" width="${mx(-36) - mx(36)}" height="${mz(-62) - mz(62)}" rx="6" class="gr"/>
      <rect x="${mx(25)}" y="${mz(47)}" width="${mx(-25) - mx(25)}" height="${mz(-47) - mz(47)}" class="ct"/>
      <line x1="${mx(25)}" x2="${mx(-25)}" y1="${mz(0)}" y2="${mz(0)}" class="ct"/><circle cx="${mx(0)}" cy="${mz(0)}" r="10" class="ct"/>
      <circle cx="${mx(0)}" cy="${mz(41.75)}" r="3" class="ct"/><circle cx="${mx(0)}" cy="${mz(-41.75)}" r="3" class="ct"/>
      <rect x="${mx(37.4) - 1}" y="${mz(62)}" width="7" height="${mz(-62) - mz(62)}" class="wl"/>
      ${ctl.stations.map(s => `<g class="st${s.id === ctl.at ? ' at' : ''}" data-tr="${s.id}" role="button" aria-label="Go to ${esc(s.label)}" transform="translate(${mx(s.x).toFixed(1)},${mz(s.z).toFixed(1)})">
        <circle r="13" class="hit"/><circle r="6.5" style="fill:${s.color}"/><text x="${s.x > 0 ? 11 : -11}" y="3.5" text-anchor="${s.x > 0 ? 'start' : 'end'}">${esc(s.label)}</text></g>`).join('')}
      <g class="you" transform="translate(${mx(ctl.me.x).toFixed(1)},${mz(ctl.me.z).toFixed(1)})"><circle r="7"/><text y="-11" text-anchor="middle">YOU</text></g></svg>`;
    const done = dailyDone(), up = canUpgrade();
    ov.innerHTML = `<div class="card pm">
      <div class="pmtop">${portrait() ? `<img class="face" src="${portrait()}" alt="" style="background:${t ? t.c1 : '#2a2a2e'}">` : ''}<div><b>${esc(PB.full(me))}</b><span>#${me.num} · ${me.pos} · ${me.ovr} OVR · ${t ? esc(t.name) : 'pre-draft'} · season ${C.year}</span></div>
        <button class="pmx" id="pmx" aria-label="Close the menu">✕</button></div>
      <div class="pmstats"><div><b>${rk.name}</b><span>Rank</span></div><div><b>${fmtFans(C.fans)}</b><span>Followers</span></div><div><b>${me.sp}</b><span>Skill pts</span></div><div><b>${P.w}-${P.l}</b><span>Park</span></div></div>
      ${nx ? `<button class="big" data-go="next">Play next game<small>${esc(nx.label)} · vs ${esc(PB.team(nx.opp).name)}</small></button>` : `<button class="big" data-go="career">My Career<small>${esc(careerLine())}</small></button>`}
      ${(w => w.length ? `<h4>Waiting in My Career</h4><div class="pmwait">${w.map(t => `<button class="pmc" data-go="hub:home"><i>●</i>${esc(t)}</button>`).join('')}</div>` : '')(waiting())}
      ${todayCard()}
      ${C.phase === 'combine' ? '' : `<h4>My Career</h4>
      <div class="pmrow">${[['home', 'Home'], ['team', 'Team'], ['player', 'Player'], ['league', 'League'], ['log', 'Log']].map(([k, n]) => `<button class="pmn" data-go="hub:${k}">${nav(k)}<span>${n}</span>${k === 'player' && up ? '<i class="dot"></i>' : ''}</button>`).join('')}</div>`}
      <h4>The park <small>tap a ring to go there</small></h4>
      ${map}
      <h4>Play</h4>
      <div class="pmgrid">${tile('quick', MIC.vs, 'Quick game', 'two teams, one game')}${tile('season', MIC.cup, 'Season', 'run a whole team')}${tile('blacktop', MIC.street, 'Blacktop', '1v1 to 3v3, your teams')}
        ${tile('classics', MIC.clock, 'Classics', 'the great nights')}${tile('daily', MIC.day, 'Daily' + (done ? ' ✓' : ''), done ? 'done today' : 'a new one every day')}${tile('gym', MIC.target, 'Gym', 'drills and contests')}
        ${tile('pick1', MIC.career, '1 on 1', 'pick-up to 11')}${tile('pick3', MIC.list, '3 on 3', 'pick-up to 21')}${tile('court', MIC.vs, 'Pro-Am', '5 on 5')}</div>
      <h4>More</h4>
      <div class="pmgrid sm">${tile('closet', MIC.career, 'Closet')}${tile('players', MIC.list, 'My Player')}${tile('ach', MIC.cup, 'Achievements')}${tile('hall', MIC.clock, 'Record book')}
        ${tile('acct', MIC.career, PB.account && PB.account.user() ? 'Account' : 'Sign in')}${tile('h2h', MIC.vs, 'Head to head')}${tile('chat', MIC.chat, 'Chat')}${tile('how', MIC.target, 'How to play')}<button class="pmt" id="pmtut">${MIC.day}<b>Tutorial</b></button>${tile('settings', MIC.list, 'Settings')}</div>
      <button class="ghost" id="pmres">Back to the park</button></div>`;
    $('#pmx').onclick = ctl.close; $('#pmres').onclick = ctl.close; $('#pmtut').onclick = () => { store('pbb.tut', 0); store('pbb.tutAt', 0); ctl.tutorial(); };
    ov.querySelectorAll('[data-go]').forEach(b => b.onclick = () => ctl.go(b.dataset.go));
    ov.querySelectorAll('[data-tr]').forEach(g => g.addEventListener('click', () => ctl.travel(g.dataset.tr)));
    ov.scrollTop = 0;
  }
  function parkResult(r, again, label) {
    const u = r.user || {}, win = r.score[0] > r.score[1], P = C.park || (C.park = { w: 0, l: 0 });
    if (win) P.w++; else P.l++;
    P.streak = win ? (P.streak || 0) + 1 : 0; P.best = Math.max(P.best || 0, P.streak);
    const fans = win ? 450 : 120; C.fans = Math.round(C.fans + fans); if (win && P.w % 3 === 0) C.me.sp += 1;
    rankUp(); save();
    show(`<div class="page post"><p class="kick">${esc(label)} · the park</p>
      <div class="final"><div>${badge(r.teams[0])}<b>${r.score[0]}</b></div><em>${win ? 'WIN' : 'LOSS'}</em><div><b>${r.score[1]}</b>${badge(r.teams[1])}</div></div>
      <p class="mute">Park record ${P.w}-${P.l}${P.streak > 1 ? ` · ${P.streak} wins in a row` : ''}${P.best > 2 ? ` (best ${P.best})` : ''} · +${fans} followers${win && P.w % 3 === 0 ? ' · +1 skill point (every third win)' : ''}</p>
      <div class="tiles"><div><b>${u.pts || 0}</b><span>PTS</span></div><div><b>${u.reb || 0}</b><span>REB</span></div><div><b>${u.ast || 0}</b><span>AST</span></div></div>
      ${potg(r)}${boxScore(r)}
      <button class="big" id="again">Run it back</button><button class="ghost" id="back">Back to the park</button></div>`);
    $('#again').onclick = again; $('#back').onclick = park;
  }
  /* H-O-R-S-E against a regular you walked up to: a shot each, match it or take a letter */
  function horse(foe) {
    const f = Object.assign({}, foe, { first: '', last: foe.handle || foe.last }), opp = PB.TEAMS[(PB.TEAMS.indexOf(parkTeam()) + 7) % PB.TEAMS.length];
    scr().hidden = true;
    PB.Game.start({ teams: [parkTeam(), opp], rosters: [[C.me], [f]], userId: C.me.id, drill: 'horse', qlen: 1, level: S.level, floor: parkFloor(),
      onEnd: r => {
        const his = r.score[0], mine = r.score[1], done = his >= 5 || mine >= 5, win = his >= 5, P = C.park || (C.park = { w: 0, l: 0 }), L = n => n ? 'HORSE'.slice(0, n).split('').join('-') : 'no letters';
        let line = 'Called off before anybody spelled it.';
        if (done) { if (win) P.w++; else P.l++; P.streak = win ? (P.streak || 0) + 1 : 0; P.best = Math.max(P.best || 0, P.streak); const fans = win ? 300 : 80; C.fans = Math.round(C.fans + fans); rankUp(); save(); line = `Park record ${P.w}-${P.l} · +${fans} followers`; }
        show(`<div class="page post"><p class="kick">H-O-R-S-E · the park</p>
          <div class="gradebig"><b>${done ? (win ? 'WIN' : 'LOSS') : '–'}</b><span>vs ${esc(f.last)}</span></div>
          <div class="tiles"><div><b>${L(mine)}</b><span>YOU</span></div><div><b>${L(his)}</b><span>${esc(f.last)}</span></div></div>
          <p class="mute">${line}</p>
          <button class="big" id="again">Run it back</button><button class="ghost" id="back">Back to the park</button></div>`);
        $('#again').onclick = () => horse(foe); $('#back').onclick = () => park();
      } });
  }
  /* foe: a regular you walked up to in the park (1 on 1 against him, under his handle) */
  function pickup(n, foe) {
    const o = C.me.ovr, mine = { 1: [], 2: [C.me.pos === 'C' || C.me.pos === 'PF' ? 'PG' : 'C'], 3: [['SF', 'C'], ['PG', 'C'], ['PG', 'C'], ['PG', 'SF'], ['PG', 'SF']][PB.POS.indexOf(C.me.pos)] }[n];
    const ra = [C.me].concat(mine.map(pos => parkGuy(pos, o - 2))), rb = foe ? [Object.assign({}, foe, { first: '', last: foe.handle || foe.last })] : ({ 1: [C.me.pos], 2: ['PG', 'C'], 3: ['PG', 'SF', 'C'] })[n].map(pos => parkGuy(pos, o));
    const opp = PB.TEAMS[Math.floor(PB.rand() * PB.TEAMS.length)];
    scr().hidden = true;
    PB.Game.start({ teams: [parkTeam(), opp === parkTeam() ? PB.TEAMS[0] : opp], rosters: [ra, rb], slots: [[0], [0, 4], [0, 1, 4]][n - 1], userId: C.me.id, half: true, target: n === 1 ? 11 : 21, ones: false, mitt: false,
      level: S.level, floor: parkFloor(), strength: [78, 78], onEnd: r => parkResult(r, () => pickup(n, foe), foe ? `1 on 1 vs ${foe.handle || foe.last}` : `${n} on ${n}`) });
  }
  function proAm() {
    const o = C.me.ovr, ra = PB.POS.map(pos => pos === C.me.pos ? C.me : parkGuy(pos, o - 2)), rb = PB.POS.map(pos => parkGuy(pos, o));
    const opp = PB.TEAMS[Math.floor(PB.rand() * PB.TEAMS.length)];
    scr().hidden = true;
    PB.Game.start({ teams: [parkTeam(), opp === parkTeam() ? PB.TEAMS[0] : opp], rosters: [ra, rb], userId: C.me.id, qlen: S.qlen, level: S.level, floor: parkFloor(),
      strength: [PB.teamOvr(ra), PB.teamOvr(rb)], onEnd: r => parkResult(r, proAm, 'Pro-Am') });
  }
  function blacktop(again) {
    const B = Object.assign({ n: 3, target: 21, ones: false, mitt: false, a: 'LAK', b: 'BOS', mine: true }, load('pbb.blacktop') || {});
    const cur = loadCur(), me = cur && cur.me && cur.team ? cur.me : null;
    const pickN = (ro, n) => { const by = f => ro.filter(p => f.includes(p.pos)).sort((a, b) => b.ovr - a.ovr), used = new Set(), take = f => { const p = by(f).find(x => !used.has(x.id)) || ro.filter(x => !used.has(x.id)).sort((a, b) => b.ovr - a.ovr)[0]; used.add(p.id); return p; };
      return n === 1 ? [ro.slice().sort((a, b) => b.ovr - a.ovr)[0]] : n === 2 ? [take(['PG', 'SG']), take(['PF', 'C'])] : [take(['PG', 'SG']), take(['SF', 'SG', 'PF']), take(['C', 'PF'])]; };
    const rosterOf = id => (cur && cur.rosters && cur.rosters[id]) ? cur.rosters[id] : (B.cache && B.cache[id]) || PB.makeRoster(78);
    const go = () => {
      const a = PB.team(B.a), b = PB.team(B.b); if (a === b) { alert('Pick two different teams.'); return; }
      const ra = pickN(rosterOf(a.id).filter(p => !(p.out > 0)), B.n).map(p => Object.assign({}, p)), rb = pickN(rosterOf(b.id).filter(p => !(p.out > 0)), B.n).map(p => Object.assign({}, p));
      let userId;
      if (me && B.mine) { ra[0] = me; userId = me.id; } else { const n = youName(); ra[0].first = n[0]; ra[0].last = n[1]; userId = ra[0].id; }
      store('pbb.blacktop', { n: B.n, target: B.target, ones: B.ones, mitt: B.mitt, a: B.a, b: B.b, mine: B.mine });
      scr().hidden = true;
      PB.Game.start({ teams: [a, b], rosters: [ra, rb], slots: [[0], [0, 4], [0, 1, 4]][B.n - 1], userId, half: true, target: B.target, ones: B.ones, mitt: B.mitt, level: S.level,
        floor: Object.assign({}, a, { street: true, court: 0 }), strength: [PB.teamOvr(ra.concat(ra)), PB.teamOvr(rb.concat(rb))], onEnd: r => result(r, null) });
    };
    if (again) { go(); return; }
    const seg = (k, vals, lbl) => `<div class="seg sm bt" data-k="${k}">${vals.map(([v, t]) => `<button data-v="${v}" class="${String(B[k]) === String(v) ? 'on' : ''}">${t}</button>`).join('')}</div>`;
    show(`<div class="page"><button class="back" id="bk">‹ Back</button><h2>Blacktop</h2>
      <p class="mute">Half court, one rim. Take it back past the arc after a stop; no free throws, win by two.</p>
      <div class="qvs">${['a', 'b'].map((k, i) => `<div class="qt" data-s="${k}"><span class="kick">${i ? 'Opponent' : 'Your side'}</span><div class="qc"><button class="ar" data-d="-1" aria-label="Previous team">‹</button><i class="qb"></i><button class="ar" data-d="1" aria-label="Next team">›</button></div><b></b><small></small></div>`).join('')}</div>
      <div class="field"><label>Format</label>${seg('n', [[1, '1 on 1'], [2, '2 on 2'], [3, '3 on 3']])}</div>
      <div class="field"><label>First to</label>${seg('target', [[11, '11'], [15, '15'], [21, '21']])}</div>
      <div class="field"><label>Scoring</label>${seg('ones', [[false, '2s and 3s'], [true, '1s and 2s']])}</div>
      <div class="field"><label>After a basket</label>${seg('mitt', [[false, 'Their ball'], [true, 'Make it, take it']])}</div>
      ${me ? `<div class="field"><label>You play as</label>${seg('mine', [[true, esc(PB.full(me))], [false, 'Your side\'s best']])}</div>` : ''}
      <div class="field"><label>Difficulty</label><div class="seg sm qo" data-k="level">${['Rookie', 'Pro', 'All-Star', 'Legend'].map(v => `<button class="${S.level === v ? 'on' : ''}" data-v="${v}">${v}</button>`).join('')}</div></div>
      <div class="card" id="btlu"></div>
      <button class="big" id="go">Check it up</button></div>`);
    const paint = () => { for (const k of ['a', 'b']) { const q = scr().querySelector(`.qt[data-s="${k}"]`), t = PB.team(B[k]); q.style.setProperty('--tc', t.c1); const bd = q.querySelector('.qb'); bd.textContent = t.ab || t.id; bd.style.background = t.c1; bd.style.color = PB.ink(t.c1, t.c2); q.querySelector('b').textContent = t.name; q.querySelector('small').textContent = t.city; }
      const lu = id => pickN(rosterOf(id), B.n);
      B.cache = B.cache || {}; for (const id of [B.a, B.b]) if (!(cur && cur.rosters) && !B.cache[id]) B.cache[id] = PB.makeRoster(78);
      const la = lu(B.a), lb = lu(B.b); if (me && B.mine) la[0] = me;
      $('#btlu').innerHTML = `<h3>The matchup</h3>${la.map((p, i) => `<p class="news">${i === 0 ? '<b>You</b> · ' : ''}${esc(PB.full(p))} <small>${p.pos} · ${p.ovr}</small> <em class="mute">vs</em> ${esc(PB.full(lb[i]))} <small>${lb[i].pos} · ${lb[i].ovr}</small></p>`).join('')}`; };
    scr().querySelectorAll('.qt .ar').forEach(x => x.onclick = () => { const k = x.closest('.qt').dataset.s, i = PB.TEAMS.findIndex(t => t.id === B[k]), n = PB.TEAMS.length; B[k] = PB.TEAMS[(i + +x.dataset.d + n) % n].id; paint(); });
    scr().querySelectorAll('.bt button').forEach(x => x.onclick = () => { const k = x.parentElement.dataset.k, v = x.dataset.v; B[k] = v === 'true' ? true : v === 'false' ? false : +v; x.parentElement.querySelectorAll('button').forEach(y => y.classList.toggle('on', y === x)); paint(); });
    scr().querySelectorAll('.qo button').forEach(x => x.onclick = () => { S.level = x.dataset.v; saveSettings(); x.parentElement.querySelectorAll('button').forEach(y => y.classList.toggle('on', y === x)); });
    $('#bk').onclick = title; $('#go').onclick = go;
    paint();
  }
  function quick() {
    const opts = PB.TEAMS.map(t => `<option value="${t.id}">${tname(t)}</option>`).join('');
    show(`<div class="page"><button class="back" id="bk">‹ Back</button><h2>Quick game</h2>
      <div class="qvs">${['qa', 'qb'].map((id, i) => `<div class="qt" data-s="${id}"><span class="kick">${i ? 'Opponent' : 'Your team'}</span><div class="qc"><button class="ar" data-d="-1" aria-label="Previous team">‹</button><i class="qb"></i><button class="ar" data-d="1" aria-label="Next team">›</button></div><b></b><small></small><select id="${id}" aria-label="${i ? 'Opponent' : 'Your team'}">${opts}</select></div>`).join('<em>vs</em>')}</div>
      <div class="field"><label>You play</label><div class="seg" id="qp">${PB.POS.map((p, i) => `<button data-v="${i}" class="${i === 0 ? 'on' : ''}">${p}</button>`).join('')}<button data-v="team">Whole team</button><button data-v="watch">Watch</button></div></div>
      <p class="fine">One player with your teammates around you, the whole team (whoever has the ball, and on defense the man guarding it), or sit back and watch the two of them play it.</p>
      <div class="field"><label>Difficulty</label><div class="seg sm qo" data-k="level">${['Rookie', 'Pro', 'All-Star', 'Legend'].map(v => `<button class="${S.level === v ? 'on' : ''}" data-v="${v}">${v}</button>`).join('')}</div></div>
      <div class="field"><label>Quarter length</label><div class="seg sm qo" data-k="qlen">${[2, 3, 5, 12].map(v => `<button class="${S.qlen == v ? 'on' : ''}" data-v="${v}">${v} min</button>`).join('')}</div></div>
      <button class="big" id="go">Tip off</button>
      <p class="fine" id="qhint"></p>${PB.teamGrid()}</div>`);
    $('#qb').value = 'BOS'; $('#qa').value = 'LAK';
    /* each side of the matchup: the badge, arrows to flick through the league, the name (tap it for the whole list) */
    const paintQ = () => scr().querySelectorAll('.qt').forEach(q => { const t = PB.team(q.querySelector('select').value);
      q.style.setProperty('--tc', t.c1); const bd = q.querySelector('.qb'); bd.textContent = t.ab || t.id; bd.style.background = t.c1; bd.style.color = PB.ink(t.c1, t.c2);
      q.querySelector('b').textContent = t.name; q.querySelector('small').textContent = t.city; });
    scr().querySelectorAll('.qt').forEach(q => { const sel = q.querySelector('select'); sel.onchange = paintQ;
      q.querySelectorAll('.ar').forEach(a => a.onclick = () => { const n = PB.TEAMS.length; sel.selectedIndex = (sel.selectedIndex + +a.dataset.d + n) % n; paintQ(); }); });
    scr().querySelectorAll('.qo button').forEach(b => b.onclick = () => { const k = b.parentElement.dataset.k; S[k] = k === 'qlen' ? +b.dataset.v : b.dataset.v; saveSettings(); b.parentElement.querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); });
    /* or pick from the whole league below: tap a side, then a team */
    let side = 'qa';
    const setSide = k => { side = k; scr().querySelectorAll('.qt').forEach(q => q.classList.toggle('on', q.dataset.s === k)); $('#qhint').textContent = `Tap a team below to set ${k === 'qa' ? 'your team' : 'the opponent'}.`;
      scr().querySelectorAll('.tt').forEach(b => b.classList.toggle('on', b.dataset.id === $('#' + k).value)); };
    scr().querySelectorAll('.qt').forEach(q => q.addEventListener('click', () => setSide(q.dataset.s)));
    scr().querySelectorAll('.tt').forEach(b => b.onclick = () => { $('#' + side).value = b.dataset.id; paintQ(); setSide(side === 'qa' ? 'qb' : 'qa'); scr().scrollTo({ top: 0, behavior: 'smooth' }); });
    setSide('qa');
    paintQ();
    let slot = 0;
    scr().querySelectorAll('#qp button').forEach(b => b.onclick = () => { slot = b.dataset.v === 'team' || b.dataset.v === 'watch' ? b.dataset.v : +b.dataset.v; scr().querySelectorAll('#qp button').forEach(x => x.classList.toggle('on', x === b)); });
    $('#bk').onclick = title;
    $('#go').onclick = () => {
      const a = PB.team($('#qa').value), b = PB.team($('#qb').value);
      if (a === b) { alert('Pick two different teams.'); return; }
      const tk = new Set(), fa = PB.makeRoster(78, tk), fb = PB.makeRoster(78, tk), ra = fa.slice(0, 5), rb = fb.slice(0, 5);
      const team = slot === 'team', watch = slot === 'watch'; if (!team && !watch) { const n = youName(); ra[slot].first = n[0]; ra[slot].last = n[1]; }
      scr().hidden = true;
      PB.Game.start({ teams: [a, b], rosters: [ra, rb], bench: [fa.slice(5, 9), fb.slice(5, 9)], userId: watch ? null : ra[team ? 0 : slot].id, switching: team, watch, qlen: S.qlen, level: S.level,
        strength: [PB.teamOvr(fa), PB.teamOvr(fb)], onEnd: r => result(r, null) });
    };
  }

  /* ---------- new career ---------- */
  /* ---------- the My Player builder, in the console game's steps: who you are, your body, your build, your look ----------
     Weight and wingspan trade like height does: heavier is stronger inside and slower; a long wingspan blocks, steals
     and rebounds better and shoots it a little worse. */
  const WEIGHT = { PG: [165, 215], SG: [175, 225], SF: [195, 245], PF: [215, 265], C: [230, 290] };
  const STEPS = ['Profile', 'Body', 'Build', 'Look'];
  function create() {
    const st = { pos: 'SG', arch: 'Sharpshooter', ht: 77, skin: 2, path: 'draft', step: 0, look: { hair: 'short', hairColor: '#17110d', band: null, sleeve: null, shoe: null } };
    const draw = () => {
      const archs = Object.keys(PB.ARCH).filter(a => PB.ARCH[a].pos.includes(st.pos));
      if (!archs.includes(st.arch)) st.arch = archs[0];
      const hr = PB.HEIGHT[st.pos]; st.ht = PB.clamp(st.ht, hr[0], hr[1]);
      const wr = WEIGHT[st.pos]; if (st.wt === undefined || st.wt < wr[0] || st.wt > wr[1]) st.wt = Math.round((wr[0] + wr[1]) / 2 / 5) * 5;
      if (st.ws === undefined) st.ws = 3;
      const A = PB.ARCH[st.arch];
      const r = startRatings(st);
      const bars = PB.ATTRS.map(([k, n]) => `<div class="bar"><span>${n}</span><i><u style="width:${r[k]}%"></u><s style="left:${A.cap[k]}%"></s></i><b>${r[k]}</b></div>`).join('');
      /* you, as you build him: in a plain practice jersey */
      /* two pictures that stay on screen while you scroll the choices: all of him (tap to turn him around) and his
         face up close, where the hair, the beard and the face you pick can actually be seen */
      const ok3d = !PB.noGL && PB.R.modelReady && PB.R.modelReady(), pd = { id: 'me', first: st.first || 'You', last: st.last || '', pos: st.pos, ht: st.ht, skin: st.skin, num: st.num ?? 1, r: {}, look: st.look }, pt = { id: 'prospect', c1: '#f2f2f2', c2: '#141416', name: 'PROSPECT', city: 'Prospect' };
      const pv = ok3d ? PB.R.portrait(pd, pt, 400, { body: true, refH: 7.4, back: !!st.back }) : null, pvh = ok3d ? PB.R.portrait(pd, pt, 320, { close: true }) : null;
      const S0 = st.step, last = S0 === STEPS.length - 1;
      const body = [
        /* 1. who you are */
        `<div class="field"><label>Name</label><div class="row2"><input id="fn" maxlength="14" placeholder="First" value="${esc(st.first || '')}"><input id="ln" maxlength="16" placeholder="Last" value="${esc(st.last || '')}"></div></div>
        <div class="field"><label>Hometown <small>optional</small></label><input id="ht" maxlength="26" placeholder="Houston, TX" value="${esc(st.from || '')}"></div>
        <div class="field"><label>Jersey number</label><input id="num" type="number" min="0" max="99" value="${st.num ?? 1}"></div>
        <div class="field"><label>Position</label><div class="seg" id="pos">${PB.POS.map(p => `<button class="${p === st.pos ? 'on' : ''}" data-v="${p}">${p}</button>`).join('')}</div></div>
        <div class="field"><label>Your story</label><div class="arch paths">${PATHS.map(([k, n, d]) => `<button class="${k === st.path ? 'on' : ''}" data-path="${k}"><b>${n}</b><span>${d}</span></button>`).join('')}</div></div>`,
        /* 2. the body */
        `<div class="field"><label>Height · ${PB.fmtH(st.ht)}</label><input type="range" id="hgt" min="${hr[0]}" max="${hr[1]}" value="${st.ht}"><p class="fine">Taller: better at the rim, on the glass and blocking. Shorter: quicker, a tighter handle.</p></div>
        <div class="field"><label>Weight · ${st.wt} lb</label><input type="range" id="wgt" min="${wr[0]}" max="${wr[1]}" step="5" value="${st.wt}"><p class="fine">Heavier: stronger inside, a better finisher through contact. Lighter: faster, higher off the floor.</p></div>
        <div class="field"><label>Wingspan · ${PB.fmtH(st.ht + st.ws)} (${st.ws >= 0 ? '+' : ''}${st.ws}")</label><input type="range" id="wsp" min="-2" max="8" value="${st.ws}"><p class="fine">Longer arms: blocks, steals and boards. Shorter: a cleaner jumper and handle.</p></div>
        <div class="field"><label>Frame</label><div class="seg" data-cl="build">${LOOK.build.map(([v, n]) => `<button data-v="${v === null ? '' : v}" class="${(st.look.build ?? '') === (v === null ? '' : v) ? 'on' : ''}">${n}</button>`).join('')}</div></div>`,
        /* 3. the build */
        `<div class="field"><label>Build</label><div class="arch">${archs.map(a => `<button class="${a === st.arch ? 'on' : ''}" data-v="${a}"><b>${a}</b><span>${PB.ARCH[a].tag}</span>${[['Shoot', ['three', 'mid']], ['Finish', ['close', 'dunk']], ['Handle', ['handle', 'pass']], ['Defend', ['perD', 'inD', 'steal', 'block']]].map(([n, ks]) => `<u><em>${n}</em><i><s style="width:${Math.round(ks.reduce((x, k) => x + PB.ARCH[a].cap[k], 0) / ks.length)}%"></s></i></u>`).join('')}</button>`).join('')}</div></div>
        <div class="card"><h3>Starting ratings <small>overall ${PB.ovr(r, st.pos)} · the tick is how far each can grow</small></h3>${bars}</div>`,
        /* 4. the look */
        `<div class="field"><label>Skin tone</label><div class="skins">${PB.SKIN.map((c, i) => `<button class="${i === st.skin ? 'on' : ''}" data-v="${i}" style="background:${c}"></button>`).join('')}</div></div>
        ${['face', 'hair', 'hairColor', 'beard'].map(k => `<div class="field"><label>${{ face: 'Face', hair: 'Hair', hairColor: 'Hair color', beard: 'Facial hair' }[k]}</label><div class="seg" data-cl="${k}">${LOOK[k].filter(o => !o[2]).map(([v, n]) => `<button data-v="${v === null ? '' : v}" class="${(st.look[k] ?? '') === (v === null ? '' : v) ? 'on' : ''}">${n}</button>`).join('')}</div></div>`).join('')}
        <p class="fine">Gear, tattoos and the rest are in the Look card once you are in the league.</p>`][S0];
      show(`<div class="page builder"><button class="back" id="bk">‹ ${S0 ? STEPS[S0 - 1] : 'Back'}</button><h2>Create your My Player</h2>
        <div class="steps">${STEPS.map((n, i) => `<button data-step="${i}" class="${i === S0 ? 'on' : i < S0 ? 'done' : ''}"><i>${i + 1}</i>${n}</button>`).join('')}</div>
        ${pv ? `<div class="createpv"><div class="pvrow"><button class="pvb" id="turn" aria-label="Turn him around"><img alt="" src="${pv}"><span>${st.back ? 'Front' : 'Back'} ↻</span></button>${pvh ? `<img class="hd" alt="" src="${pvh}">` : ''}</div><p>${esc(st.first || 'Your')} ${esc(st.last || 'player')} · ${PB.fmtH(st.ht)} · ${st.wt} lb · ${st.pos} · ${esc(st.arch)} · ${PB.ovr(r, st.pos)} OVR</p></div>` : ''}
        ${body}
        <button class="big" id="go">${last ? (st.path === 'undrafted' ? 'Start your career' : 'Enter the draft') : `Next: ${STEPS[S0 + 1]}`}</button></div>`);
      const keep = () => { if ($('#fn')) { const tx = id => $(id).value.replace(/[<>]/g, '').trim().slice(0, 24); st.first = tx('#fn'); st.last = tx('#ln'); st.from = tx('#ht'); st.num = PB.clamp(+$('#num').value || 0, 0, 99); } };
      const stay = f => { keep(); const y = scr().scrollTop, wy = window.scrollY; f(); draw(); scr().scrollTop = y; window.scrollTo(0, wy); };
      $('#bk').onclick = () => { keep(); if (st.step) { st.step--; draw(); } else myPlayers(); };
      if ($('#turn')) $('#turn').onclick = () => stay(() => { st.back = !st.back; });
      scr().querySelectorAll('[data-step]').forEach(b => b.onclick = () => { keep(); const to = +b.dataset.step; if (to > 0 && (!st.first || !st.last)) { alert('Give your player a first and last name.'); return; } st.step = to; draw(); scr().scrollTop = 0; });
      scr().querySelectorAll('#pos button').forEach(b => b.onclick = () => stay(() => { st.pos = b.dataset.v; st.ht = Math.round((PB.HEIGHT[st.pos][0] + PB.HEIGHT[st.pos][1]) / 2); st.wt = undefined; }));
      scr().querySelectorAll('.arch button[data-v]').forEach(b => b.onclick = () => stay(() => { st.arch = b.dataset.v; }));
      scr().querySelectorAll('[data-path]').forEach(b => b.onclick = () => stay(() => { st.path = b.dataset.path; }));
      scr().querySelectorAll('.skins button').forEach(b => b.onclick = () => stay(() => { st.skin = +b.dataset.v; }));
      scr().querySelectorAll('[data-cl] button').forEach(b => b.onclick = () => stay(() => { st.look[b.parentElement.dataset.cl] = b.dataset.v || null; if (b.parentElement.dataset.cl === 'build') st.frameSet = true; }));
      /* the sliders redraw the preview when you let go (dragging only moves the label) */
      const slide = (id, k, lbl) => { const e = $('#' + id); if (!e) return; e.oninput = () => { st[k] = +e.value; const l = e.previousElementSibling; if (l) l.textContent = lbl(); }; e.onchange = () => stay(() => {}); };
      slide('hgt', 'ht', () => `Height · ${PB.fmtH(st.ht)}`); slide('wgt', 'wt', () => `Weight · ${st.wt} lb`);
      /* the frame follows the weight until you pick one yourself */
      if ($('#wgt')) $('#wgt').addEventListener('change', () => { if (st.frameSet) return; const f = (st.wt - wr[0]) / (wr[1] - wr[0]); st.look.build = f < 0.2 ? 'slim' : f > 0.85 ? 'big' : f > 0.6 ? 'strong' : null; draw(); }, { capture: true }); slide('wsp', 'ws', () => `Wingspan · ${PB.fmtH(st.ht + st.ws)} (${st.ws >= 0 ? '+' : ''}${st.ws}")`);
      $('#go').onclick = () => { keep(); if (!st.first || !st.last) { alert('Give your player a first and last name.'); return; } if (!last) { st.step++; draw(); scr().scrollTop = 0; return; } begin(st); };
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
      const wr = WEIGHT[st.pos], w = st.wt === undefined ? 0 : (st.wt - (wr[0] + wr[1]) / 2) / ((wr[1] - wr[0]) / 2 || 1), ws = st.ws === undefined ? 0 : (st.ws - 3) / 5;
      if (['inD', 'close', 'reb'].includes(k)) v += Math.round(w * 3); if (['speed', 'vert'].includes(k)) v -= Math.round(w * 3);
      if (['block', 'steal', 'reb', 'inD'].includes(k)) v += Math.round(ws * 3); if (['three', 'handle'].includes(k)) v -= Math.round(ws * 2);
      r[k] = PB.clamp(v, 25, A.cap[k]);
    }
    /* every build and position starts near 60 overall: shifted evenly, so the build's strengths stay its strengths */
    for (let i = 0; i < 6; i++) {
      const d = (st.path === 'top' ? 65 : st.path === 'undrafted' ? 56 : st.path === 'second' ? 58 : 60) - PB.ovr(r, st.pos);   // a top prospect starts near 65, an undrafted man near 56
      if (Math.abs(d) < 1) break;
      for (const k in r) r[k] = PB.clamp(Math.round(r[k] + d * 0.6), 25, A.cap[k]);
    }
    return r;
  }

  function begin(st) {
    const strengths = {};
    const rosters = {};
    { const taken = new Set(); for (const t of PB.TEAMS) { strengths[t.id] = Math.round(PB.rr(70, 82)); rosters[t.id] = PB.makeRoster(strengths[t.id], taken); } }
    const r = startRatings(st);
    const me = { id: 'me', first: st.first, last: st.last, from: st.from || '', pos: st.pos, arch: st.arch, ht: st.ht, wt: st.wt, ws: st.ws, skin: st.skin, num: st.num, age: 19, r, sp: 0, me: true, badges: {}, look: Object.assign({}, st.look) };
    me.ovr = PB.ovr(r, st.pos);
    /* the draft order: lottery teams (the weakest) pick first */
    const order = PB.TEAMS.slice().sort((a, b) => strengths[a.id] - strengths[b.id] + PB.gauss() * 3).map(t => t.id);
    C = { v: 2, statV: 2, me, team: null, pick: 0, year: 1, rosters, standings: {}, games: [], gi: 0, news: [], seasons: [], totals: zero(), awards: [], trophies: [],
      trust: st.path === 'top' ? 56 : st.path === 'undrafted' ? 28 : st.path === 'second' ? 34 : 42, agent: PB.randName(), fans: 0, ct: {}, feed: [], phase: 'combine', streak: 0, order, path: st.path || 'draft' };
    save(); parkFrom = null;
    if (PB.noGL) { playScene('prologue', () => { if (C.path === 'undrafted') undrafted(); else combine(); }); return; }
    playScene('prologue', () => { park();
    setTimeout(() => { if (PB.Game.active) PB.Game.toast && PB.Game.toast(C.path === 'undrafted' ? 'Your agent: the MY CAREER door' : 'Your draft: the MY CAREER door', 'call'); }, 3500); });
  }
  /* how a career starts */
  const PATHS = [
    ['top', 'Top prospect', 'A lottery lock: rated higher, a top-six pick, a starter\'s chance from day one. First overall is there for you, but only if you earn it at the combine. The city expects a star, and bad nights get loud.'],
    ['draft', 'First-round prospect', 'The combine and your interviews decide where you go: a great day puts you in the lottery, a bad one drops you out of the first round.'],
    ['second', 'Second-round pick', 'Your name is called on day two. No guaranteed money, a seat on the bench and a chip on your shoulder: you start a little lower and grow a little faster.'],
    ['undrafted', 'Undrafted', 'Nobody calls your name. A two-way deal at the end of a bench and lower ratings; you grow fastest of all, and every good night gets noticed. The long road: this is how the best stories start.'],
  ];
  /* The undrafted road: draft night with no call, then a choice of training-camp invites, a two-way deal, the end of
     the bench. A real contract comes when the coach trusts you. */
  function undrafted() {
    const me = C.me;
    /* three teams thin at your position will give you a look */
    const need = PB.TEAMS.map(t => ({ t, best: Math.max(...C.rosters[t.id].filter(p => p.pos === me.pos).map(p => p.ovr), 50) })).sort((a, b) => a.best - b.best + PB.gauss() * 2).slice(0, 3);
    show(`<div class="page post">${PB.noGL ? '' : '<button class="back" id="bk">‹ The park</button>'}<p class="kick">Draft night</p><h2>Sixty names. Not yours.</h2>
      <div class="card"><p>You watch both rounds from your couch. The phone stays face down on the table. A little after midnight, it buzzes: your agent.</p>
      <p>“Three teams want you in camp. No promises. A two-way deal, the last seat on the bench, and whatever you make of it.”</p></div>
      ${need.map((x, i) => `<button class="ghost ans" data-i="${i}">${badge(x.t)} <b>${esc(tname(x.t))}</b><small> · their best ${me.pos} is a ${x.best}</small></button>`).join('')}
      <p class="fine">Undrafted: you start lower and at the end of the bench. Each goal you hit is worth an extra skill point, good nights win fans fast, and when the coach trusts you the team turns the two-way into a real contract.</p></div>`);
    if ($('#bk')) $('#bk').onclick = title;
    scr().querySelectorAll('.ans').forEach(b => b.onclick = () => {
      const t = need[+b.dataset.i].t;
      C.pick = 0; C.team = t.id; C.combine = null; C.phase = 'regular';
      C.contract = { years: 1, salary: 0.58, kind: 'Two-way deal' }; C.earnings = 0; C.fans = 400;
      C.news.unshift(`${me.last} goes undrafted, signs a two-way deal with the ${t.name}`);
      C.feed.unshift({ who: '@draftnerd', text: `${PB.full(me)} to ${t.city} on a two-way. Somebody is going to regret passing on him. Or not.` });
      C.cs = ['coach']; C.draftTale = 'undrafted'; makeRival(null, PB.ri(2, 6)); newSeason(); save();
      const rv = rivalP(), rt = PB.team(C.rival.team), in3d = !PB.noGL && PB.R.modelReady && PB.R.modelReady();
      show(`<div class="draft ${in3d ? 'over3d' : ''}" style="--c1:${t.c1};--c2:${t.c2}"><p class="kick">Training camp</p>
        <div class="podium"><p>Undrafted, the ${esc(tname(t))} sign</p><h1>${esc(PB.full(me))}</h1><p class="mute">${PB.POS_NAME[me.pos]} · ${me.arch} · ${PB.fmtH(me.ht)} · overall ${me.ovr}</p></div>
        ${in3d ? '<div class="spacer"></div>' : ''}
        <p class="fine">A two-way deal. You are the last man on the bench: earn the coach's trust and the minutes come.</p>
        <div class="card rival"><h3>The one they took</h3><p>${badge(rt)} <b>${esc(PB.full(rv))}</b>, ${PB.POS_NAME[rv.pos].toLowerCase()}, went ${ordinal(C.rival.pick)} to the ${esc(rt.name)}, in your division. Overall ${rv.ovr}. Same position, same class. Everybody will compare you.</p></div>
        <button class="big" id="go">Go to the team</button></div>`);
      if (in3d) { scr().classList.add('over3d'); PB.R.showcase(me, t); }
      $('#go').onclick = () => { PB.R.showcase(null); scr().classList.remove('over3d'); hub(); };
    });
  }
  /* The pre-draft combine: fifteen spot-up shots in 45 seconds with the scouts watching. A good day moves you up
     the board, a bad one down. Skipping it sends the scouts your college numbers instead (an average day). */
  function combine() {
    const me = C.me;
    show(`<div class="page post">${PB.noGL ? '' : '<button class="back" id="bk">‹ The park</button>'}<p class="kick">Pre-draft combine</p><h2>The scouts are watching</h2>
      <div class="card"><p>Fifteen spot-up shots from five spots, three balls each, in 45 seconds: the corners, the elbows, the top of the key.
      Hold Shoot and let go at the top of your jump, in the green band.</p>
      <p class="fine">Your stock now: about pick ${projected()} of ${C.path === 'second' ? 60 : 30}.${C.path === 'top' ? ' First overall takes ten makes.' : C.path === 'second' ? ' Twelve makes and a team may trade into the first round for you.' : ''} Each make above an average day moves you up the board; each below moves you down.</p></div>
      <button class="big" id="go">Take the floor</button><button class="ghost" id="skip">Skip (send them my tape)</button></div>`);
    $('#go').onclick = () => {
      scr().hidden = true;
      const t = PB.team(C.order[(projected() - 1) % 30]);
      PB.Game.start({ teams: [t, t], rosters: [[me], []], userId: 'me', drill: 'combine', qlen: 1, level: S.level, floor: t,
        onEnd: r => interviews(() => finishDraft(r.drill ? r.drill.score : 6)) });
    };
    $('#skip').onclick = () => interviews(() => finishDraft(null));
    if ($('#bk')) $('#bk').onclick = title;
  }
  /* team interviews: two teams picking near you sit you down for a question each. Win one over and, if your stock is
     close to its pick, that team takes you there. */
  const IQ = [
    ['Why should we take you over the man we already have at your position?', [['I\'ll outwork him every single day.', 2], ['Because I\'m already better.', 1], ['I don\'t really compare myself to anyone.', -1]]],
    ['What part of your game needs the most work?', [['My defense. I want to guard the other team\'s best player.', 2], ['My jumper off the dribble.', 1], ['Nothing, really. I just need minutes.', -1]]],
    ['How do you handle a bad night?', [['Watch the film, then get back in the gym.', 2], ['Shake it off. Next game.', 1], ['Bad nights happen when the coach sits me.', -2]]],
    ['Would you come off the bench for us?', [['Whatever helps us win.', 2], ['If that\'s the role, sure.', 1], ['I\'m a starter.', -1]]],
    ['What do you do the night before a game?', [['Film, a good meal, sleep.', 2], ['Video games with my teammates.', 1], ['Whatever I feel like.', -1]]],
  ];
  function interviews(done) {
    const pj = projected(), lo = C.path === 'second' ? 31 : C.path === 'top' ? 1 : 2, hi = C.path === 'second' ? 60 : 30, slots = [PB.clamp(pj - PB.ri(2, 3), lo, hi), PB.clamp(pj + PB.ri(1, 2), lo, hi)].filter((v, i, a) => a.indexOf(v) === i);
    const qs = IQ.slice().sort(() => PB.rand() - 0.5);
    C.liked = null;
    const ask = i => {
      if (i >= slots.length) { save(); done(); return; }
      const t = PB.team(C.order[(slots[i] - 1) % 30]), [q, ans] = qs[i], opts = ans.slice().sort(() => PB.rand() - 0.5);
      show(`<div class="page post"><p class="kick">Team interviews · ${i + 1} of ${slots.length}</p>
        <div class="card" style="border-top:4px solid ${t.c1}"><p class="mute">${badge(t)} The ${esc(tname(t))} front office · they pick ${ordinal(slots[i])}</p><h3>“${esc(q)}”</h3></div>
        ${opts.map((a, k) => `<button class="ghost ans" data-k="${k}">${esc(a[0])}</button>`).join('')}</div>`);
      scr().querySelectorAll('.ans').forEach(b => b.onclick = () => {
        const v = opts[+b.dataset.k][1];
        if (v >= 2 && (!C.liked || slots[i] < C.liked.slot)) C.liked = { slot: slots[i], team: t.id };
        show(`<div class="page post"><p class="kick">Team interviews</p><div class="card"><p>${v >= 2 ? `The ${esc(t.name)} liked that. You can tell.` : v >= 1 ? 'Polite nods. Hard to read.' : 'A long pause. Somebody writes something down.'}</p></div>
          <button class="big" id="go">${i + 1 < slots.length ? 'Next interview' : 'On to the results'}</button></div>`);
        $('#go').onclick = () => ask(i + 1);
      });
    };
    ask(0);
  }
  const projected = () => C.path === 'top' ? PB.clamp(Math.round(3 - (C.me.ovr - 65) * 0.4), 2, 5) : C.path === 'second' ? PB.clamp(Math.round(44 - (C.me.ovr - 58) * 1.5), 33, 56) : PB.clamp(Math.round(14 - (C.me.ovr - 62) * 1.6), 3, 30);
  function finishDraft(score) {
    const me = C.me;
    const avg = 6.5;   // an ordinary day: about 43% from these spots
    /* the measurements: what your body and your build say, a little noise on the day */
    const ath = (me.r.vert + me.r.speed) / 2, g = () => PB.gauss();
    const M8 = { ht: me.ht + 1.25, wing: me.ht + PB.clamp(Math.round(3 + g() * 2), -1, 8), vert: +(27 + me.r.vert * 0.12 + g() * 1.2).toFixed(1),
      lane: +(12.3 - me.r.speed * 0.016 + g() * 0.15).toFixed(2), sprint: +(3.6 - me.r.speed * 0.0045 + g() * 0.03).toFixed(2) };
    C.measure = M8;
    const moved = score === null ? 0 : Math.round((score - avg) * 1.6) + (ath >= 80 ? 1 : ath <= 55 ? -1 : 0);
    /* Where you go. First overall is never given: a top prospect has to shoot it at the combine (ten of fifteen, or nine
       with a team that loved him), and a first-round prospect needs the workout of the decade (fourteen). Short of that a
       top prospect goes second to sixth. A first-round prospect who has a bad enough day slides out of the first round;
       a day-two prospect who has a great one hears his name late in the first. */
    let pick, tale;
    if (C.path === 'top') {
      const earned = score !== null && (score >= 10 || (score >= 9 && !!C.liked));
      pick = earned ? 1 : PB.clamp(projected() - Math.sign(moved) + Math.round(PB.gauss() * 0.8), 2, 6); tale = earned ? 'first' : 'top';
    } else if (C.path === 'second') {
      pick = PB.clamp(projected() - moved * 2 + Math.round(PB.gauss() * 3), 31, 60); tale = 'second';
      if (score !== null && score >= 12) { pick = PB.ri(26, 30); tale = 'jumped'; }
    } else {
      pick = PB.clamp(projected() - moved + Math.round(PB.gauss() * 2), 2, 38); tale = pick > 30 ? 'slid' : pick <= 5 ? 'lottery' : 'round1';
      if (score !== null && score >= 14) { pick = 1; tale = 'first'; }
      else if (score !== null && score <= 2 && !C.liked) { pick = PB.ri(31, 38); tale = 'slid'; }
    }
    /* a team that loved your interview takes you at its pick, if you are still close to it on the board */
    let loved = false;
    if (C.liked && pick > 1 && C.liked.slot > 1 && (pick > 30) === (C.liked.slot > 30) && Math.abs(C.liked.slot - pick) <= 3) { loved = C.liked.slot !== pick; pick = C.liked.slot; if (tale === 'slid') tale = 'round1'; }
    C.pick = pick; C.round = pick > 30 ? 2 : 1; C.draftTale = tale; C.team = C.order[(pick - 1) % 30]; C.combine = score; C.phase = 'regular';
    C.contract = pick > 30 ? { years: 2, salary: 1.1, kind: 'Second-round deal' } : { years: 4, salary: rookieScale(pick), kind: 'Rookie deal' }; C.earnings = 0;
    C.fans = 1500 + Math.max(0, 31 - pick) * 400 + (C.path === 'top' ? 22000 : 0) + (pick === 1 ? 30000 : 0);
    C.cs = ['coach'];
    if (C.path === 'top') C.news.unshift(`${me.last}, the top prospect, is ${PB.team(C.team).city}'s now`);
    C.news.unshift(score === null ? `${me.last} skips the combine shooting drills` : `${me.last} makes ${score} of 15 at the combine${moved > 0 ? ', and climbs draft boards' : moved < 0 ? ', and slides on draft boards' : ''}`);
    if (loved) C.news.unshift(`The ${PB.team(C.team).name} loved ${me.last} in his interview`);
    /* the man the league will measure you against: taken right ahead of the pick you wanted, or right behind you */
    makeRival(null, pick, tale === 'top' ? 1 : pick === 1 ? 2 : tale === 'slid' || tale === 'second' ? PB.ri(12, 24) : undefined);
    newSeason();
    save();
    if (score !== null) {
      show(`<div class="page post"><p class="kick">Combine results</p><div class="gradebig"><b>${score}/15</b><span>spot-up shooting</span></div>
        <div class="card"><p>${moved > 1 ? 'Scouts loved it. You are moving up.' : moved < -1 ? 'Not your day. Some teams cooled on you.' : 'About what they expected.'}</p>
        <p class="fine">${C.path === 'top' ? (score >= 10 ? 'That is a number-one workout.' : 'First overall needed ten of fifteen. It is somebody else\'s to lose now.') : 'Projected before: pick ' + projected() + '.'} Now, draft night.</p></div>
        <div class="card"><h3>Measurements</h3><table class="std">
          <tr><td>Height in shoes</td><td>${PB.fmtH(Math.round(M8.ht))}</td></tr><tr><td>Wingspan</td><td>${PB.fmtH(M8.wing)}</td></tr>
          <tr><td>Max vertical</td><td>${M8.vert}"</td></tr><tr><td>Lane agility</td><td>${M8.lane} s</td></tr><tr><td>Three-quarter sprint</td><td>${M8.sprint} s</td></tr></table>
          <p class="fine">${ath >= 80 ? 'The athletic testing turned heads.' : ath <= 55 ? 'The athletic testing was a concern for some teams.' : 'Athletic testing about average for the class.'}</p></div>
        <button class="big" id="go">Draft night</button></div>`);
      $('#go').onclick = () => playScene('draftnight', draft);
    } else playScene('draftnight', draft);
  }
  const zero = () => ({ gp: 0, min: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, fga: 0, fgm: 0, tpa: 0, tpm: 0, fta: 0, ftm: 0, w: 0, l: 0, grades: 0 });

  /* Your rival: same position, same draft class, picked a few spots from you by a team in your division. You see
     each other twice or more a season, and the league keeps score. */
  function makeRival(order, pick, exact) {
    const div = PB.team(C.team).div;
    const opts = PB.TEAMS.filter(t => t.div === div && t.id !== C.team);
    const rt = opts[Math.floor(PB.rand() * opts.length)].id;
    const p = PB.makePlayer(C.me.pos, C.me.ovr + PB.ri(0, 3) + (C.path === 'undrafted' ? 7 : 0), 19);
    p.rookie = true;
    C.rosters[rt].push(p); PB.freshName(p, C.rosters[rt], C.rosters);
    C.rival = { id: p.id, team: rt, pick: exact || PB.clamp(Math.min(pick, 30) + PB.ri(-4, 4), 2, 30), season: zero(), totals: zero(), h2h: [0, 0] };
  }
  const rivalP = () => C.rival && C.rosters[C.rival.team].find(p => p.id === C.rival.id);

  /* older saves get the new parts of a career */
  function upgrade() {
    if (!C) return;
    C.trust = C.trust ?? 45; C.fans = C.fans ?? 2000; C.ct = C.ct || {}; C.feed = C.feed || []; C.phase = C.phase || 'regular';
    C.me.badges = C.me.badges || {}; C.streak = C.streak || 0;
    if (!C.contract && C.team) { C.contract = { years: Math.max(1, 4 - (C.year - 1)), salary: rookieScale(C.pick || 15), kind: 'Rookie deal' }; C.earnings = C.earnings || 0; }
    if (!C.rival && C.team) makeRival(null, C.pick || 15);
    C.v = 2;
  }

  function newSeason() {
    C.standings = {}; for (const t of PB.TEAMS) C.standings[t.id] = { w: 0, l: 0 };
    const n = S.season;
    const others = PB.TEAMS.filter(t => t.id !== C.team).map(t => t.id);
    const sched = [];
    /* the rival's team twice, then everyone else */
    if (C.rival) sched.push(C.rival.team);
    /* like the real league: the division most often, then the conference, then the rest */
    const me = PB.team(C.team), wt = id => { const t = PB.team(id); return t.div === me.div ? 3 : t.conf === me.conf ? 2 : 1.2; };
    const seen = {};
    while (sched.length < n) {
      let pick = null, best = -1;
      for (const o of others) { const v = wt(o) / (1 + (seen[o] || 0) * 2.2) * (0.6 + PB.rand()); if (v > best) { best = v; pick = o; } }
      seen[pick] = (seen[pick] || 0) + 1; sched.push(pick);
    }
    if (C.rival && n >= 10) { const k = Math.floor(n * 0.6); sched.splice(k, 0, C.rival.team); sched.length = n; }
    sched.sort(() => PB.rand() - 0.5);
    C.games = sched.map((o, i) => ({ opp: o, home: i % 2 === 0, done: false }));
    setupCup(n);
    /* back-to-backs: about one game in seven is the second of two nights; your legs start the game heavier */
    for (let i = 1; i < C.games.length; i++) if (!C.games[i - 1].b2b && PB.rand() < 0.15) C.games[i].b2b = true;
    /* primetime: three nights a season (two in a short one) are on national television, a quarter more skill points
       and more eyes on you; a game against your rival is always one of them */
    { const want = n >= 10 ? 3 : 2, open = C.games.map((g, i) => i).filter(i => !C.games[i].cup && i > 0), rv = C.rival ? open.filter(i => C.games[i].opp === C.rival.team) : [];
      const picks = rv.slice(0, 1); while (picks.length < want && open.length) { const i = open.splice(Math.floor(PB.rand() * open.length), 1)[0]; if (!picks.includes(i)) picks.push(i); }
      for (const i of picks) C.games[i].prime = true; }
    for (const id in C.rosters) for (const p of C.rosters[id]) p.out = 0;
    C.gi = 0; C.season = zero(); C.len = n; C.phase = 'regular'; C.po = null; C.allstar = false;
    if (C.contract) C.earnings = (C.earnings || 0) + C.contract.salary;
    if (C.endorse && C.endorse.pay) C.earnings = (C.earnings || 0) + C.endorse.pay;
    C.ls = {}; C.adj = { gp: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tpm: 0 }; C.vote = null; C.wk = null; C.mo = null; C.scores = []; C.streaks = {}; C.zones = {}; C.rising = null; if (C.contest === 'invited') C.contest = 'done'; if (C.dunk === 'invited') C.dunk = 'done';   // last year's All-Star invitations do not carry over
    C.startOvr = C.me.ovr;
    if (C.rival) C.rival.season = zero();
    C.news.unshift(`Season ${C.year} begins: ${n} games, ${PB.TEAMS.length} teams.`);
  }

  /* ---------- the Cup: the in-season tournament ----------
     Early in the season a handful of your games are cup nights: group games against the four teams drawn with you (three
     groups of five in each conference), played on a painted floor, counting in the standings like any other. Win the
     group, or be the best second-place team in the conference, and the next games on your schedule become the
     knockout rounds: a quarterfinal, a semifinal, the final. Lose once and it is over. */
  const CUP_ROUNDS = { QF: 'Cup quarterfinal', SF: 'Cup semifinal', F: 'Cup final' };
  function setupCup(n) {
    C.cup = null;
    if (n < 10) return;
    const groups = [];
    for (const conf of ['East', 'West']) { const ids = PB.TEAMS.filter(t => t.conf === conf).map(t => t.id).sort(() => PB.rand() - 0.5); for (let i = 0; i < 3; i++) groups.push({ conf, name: `${conf} ${'ABC'[i]}`, ids: ids.slice(i * 5, i * 5 + 5) }); }
    const mine = groups.findIndex(g => g.ids.includes(C.team)), opps = groups[mine].ids.filter(id => id !== C.team).sort(() => PB.rand() - 0.5).slice(0, n >= 20 ? 4 : 3);
    const first = Math.max(1, Math.floor(n * 0.12)), gap = Math.max(1, Math.floor(n * 0.07)), at = opps.map((o, i) => first + i * gap);
    opps.forEach((o, i) => { const g = C.games[at[i]]; if (g) { g.opp = o; g.cup = 'group'; g.b2b = false; } });
    const rec = {}; for (const g of groups) for (const id of g.ids) rec[id] = { w: 0, l: 0, pd: 0 };
    C.cup = { groups, mine, rec, need: opps.length, played: 0, stage: 'group', last: at[at.length - 1] };
  }
  /* the other groups' nights, as yours are played: every other team gets as many cup games as you have had */
  function cupSimOthers() {
    const K = C.cup; if (!K) return;
    for (const g of K.groups) { const ids = g.ids.filter(id => id !== C.team);
      for (const id of ids) { const r = K.rec[id]; while (r.w + r.l < K.played) { const o = ids.filter(x => x !== id)[Math.floor(PB.rand() * (ids.length - 1))] || ids[0], win = PB.rand() < winP(id, o, true), m = 3 + Math.floor(PB.rand() * 14); if (win) r.w++; else r.l++; r.pd += win ? m : -m; } } }
  }
  const cupRank = g => g.ids.slice().sort((a, b) => (C.cup.rec[b].w - C.cup.rec[a].w) || (C.cup.rec[b].pd - C.cup.rec[a].pd) || strength(b) - strength(a));
  /* after a cup night of yours: the tables move, and at the end of the group stage the eight are named */
  function cupAfter(g, res) {
    const K = C.cup; if (!K || !g.cup) return;
    const t = PB.team(C.team), margin = Math.abs(res.us - res.them);
    if (g.cup === 'group') {
      const r = K.rec[C.team], ro = K.rec[g.opp]; if (res.win) { r.w++; if (ro) ro.l++; } else { r.l++; if (ro) ro.w++; } r.pd += res.win ? margin : -margin; if (ro) ro.pd += res.win ? -margin : margin;
      K.played++; cupSimOthers();
      if (K.played < K.need) return;
      /* the eight: three group winners and the best runner-up in each conference */
      const qual = {};
      for (const conf of ['East', 'West']) { const gs = K.groups.filter(x => x.conf === conf), wins = gs.map(x => cupRank(x)[0]), seconds = gs.map(x => cupRank(x)[1]).sort((a, b) => (K.rec[b].w - K.rec[a].w) || (K.rec[b].pd - K.rec[a].pd));
        qual[conf] = wins.concat(seconds[0]).sort((a, b) => (K.rec[b].w - K.rec[a].w) || (K.rec[b].pd - K.rec[a].pd)); }
      K.qual = qual; const conf = t.conf, seed = qual[conf].indexOf(C.team);
      if (seed < 0) { K.stage = 'out'; K.note = `Out in the group stage (${r.w}-${r.l})`; C.news.unshift(`The Cup: the ${t.name} go ${r.w}-${r.l} in ${K.groups[K.mine].name} and miss the knockout rounds`); cupFinish(); return; }
      K.stage = 'QF'; K.seed = seed + 1; K.opp = qual[conf][3 - seed]; K.other = qual[conf].filter(id => id !== C.team && id !== K.opp);   // (the other quarterfinal in your half)
      const nx = C.games[C.gi + 1]; if (nx) { nx.opp = K.opp; nx.cup = 'QF'; nx.home = seed < 2; nx.b2b = false; }
      C.news.unshift(`The Cup: the ${t.name} are through to the quarterfinals (${r.w}-${r.l}) and draw the ${PB.team(K.opp).name}`);
      return;
    }
    /* a knockout night */
    if (!res.win) { K.stage = 'out'; K.note = `Lost the ${CUP_ROUNDS[g.cup].toLowerCase()} to the ${PB.team(g.opp).name}`; C.news.unshift(`The Cup: the ${t.name} go out in the ${g.cup === 'F' ? 'final' : g.cup === 'SF' ? 'semifinals' : 'quarterfinals'}`);
      if (g.cup === 'F') { C.me.sp += 2; C.news.unshift('Cup runners-up: +2 skill points'); } cupFinish(); return; }
    const pickW = (a, b) => (a && b) ? (PB.rand() < winP(a, b, true) ? a : b) : (a || b);
    if (g.cup === 'QF') { K.stage = 'SF'; K.opp = pickW(K.other[0], K.other[1]); C.me.sp += 1; }
    else if (g.cup === 'SF') { K.stage = 'F'; const oc = t.conf === 'East' ? 'West' : 'East', q = K.qual[oc]; K.opp = pickW(pickW(q[0], q[3]), pickW(q[1], q[2])); C.me.sp += 1; }
    else { K.stage = 'won'; K.note = `Cup champions, beating the ${PB.team(g.opp).name}`; C.trophies.push(`Cup champion, season ${C.year}`); C.me.sp += 5; C.fans = Math.round((C.fans || 0) * 1.08 + 5000); C.earnings = (C.earnings || 0) + 0.5;
      setTimeout(() => PB.confetti([t.c1, t.c2, '#ffffff'], 7), 700); C.news.unshift(`THE CUP IS YOURS. The ${t.name} win the in-season tournament: +5 skill points, a $500K bonus for every player`); cupFinish(); return; }
    const nx = C.games[C.gi + 1]; if (nx) { nx.opp = K.opp; nx.cup = K.stage; nx.home = false; nx.neutral = true; nx.b2b = false; C.news.unshift(`The Cup: on to the ${K.stage === 'F' ? 'final' : 'semifinals'} against the ${PB.team(K.opp).name}`); }
    else { K.stage = 'out'; cupFinish(); }
  }
  /* the rest of the bracket, played out so the season has a cup winner either way */
  function cupFinish() {
    const K = C.cup; if (!K || K.champ) return;
    if (K.stage === 'won') { K.champ = C.team; return; }
    if (!K.qual) return;
    const pickW = (a, b) => a === b ? a : PB.rand() < winP(a, b, true) ? a : b, fin = conf => { const q4 = K.qual[conf].filter(id => id !== C.team), a = q4[0], b2 = q4[1] || a, c2 = q4[2] || a, d2 = q4[3] || b2; return pickW(pickW(a, d2), pickW(b2, c2)); };
    K.champ = pickW(fin('East'), fin('West'));
    C.news.unshift(`The ${PB.team(K.champ).name} win the Cup`);
  }
  function cupCard() {
    const K = C.cup; if (!K) return '';
    const g = K.groups[K.mine], rows = cupRank(g), t = PB.team(C.team);
    const head = K.stage === 'group' ? `Group stage · ${K.played} of ${K.need} played` : K.stage === 'won' ? 'Champions' : K.stage === 'out' ? (K.note || 'Out') : `${CUP_ROUNDS[K.stage]} next`;
    return `<div class="card cup" style="--c1:${t.c1}"><h3>The Cup <small>${head}</small></h3>
      <p class="mute">Group ${esc(g.name)}: win it, or be the best runner-up in the ${g.conf}, and you play for the trophy.</p>
      ${rows.map((id, i) => { const r = K.rec[id], x = PB.team(id); return `<p class="cuprow${id === C.team ? ' me' : ''}"><span>${i + 1}</span>${badge(x)}<i>${esc(x.name)}</i><em>${r.w}-${r.l}</em><small>${r.pd > 0 ? '+' : ''}${r.pd}</small></p>`; }).join('')}
      ${K.stage !== 'group' && K.qual ? `<p class="kick">The last eight</p><p class="mute">${['East', 'West'].map(cf => K.qual[cf].map(id => PB.team(id).ab).join(' · ')).join('<br>')}</p>` : ''}
      ${K.champ ? `<p class="cupwin">${K.champ === C.team ? 'The Cup is yours' : `Cup winners: ${esc(tname(PB.team(K.champ)))}`}</p>` : ''}</div>`;
  }

  function draft() {
    const t = PB.team(C.team), me = C.me, rv = rivalP(), rt = PB.team(C.rival.team);
    const ord = n => n + (['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : n % 10] || 'th');
    const in3d = !PB.noGL && PB.R.modelReady && PB.R.modelReady();
    show(`<div class="draft ${in3d ? 'over3d' : ''}" style="--c1:${t.c1};--c2:${t.c2}">
      <p class="kick">Draft night</p>
      <div class="podium"><p>${C.pick === 1 ? 'With the first pick in the draft' : C.pick > 30 ? `Round two · with the ${ord(C.pick)} pick` : `With the ${ord(C.pick)} pick`}, the ${esc(tname(t))} select</p>
      <h1>${esc(PB.full(me))}</h1><p class="mute">${PB.POS_NAME[me.pos]} · ${me.arch} · ${PB.fmtH(me.ht)} · overall ${me.ovr}</p></div>
      ${in3d ? '<div class="spacer"></div>' : `<div class="cap" style="background:${t.c1};color:${t.c2}">${esc(t.ab)}<b>#${me.num}</b></div>`}
      <p class="fine">${C.pick > 30 ? 'A two-year deal, none of it guaranteed.' : 'A four-year rookie deal.'} ${roleLine()}${C.pick === 1 ? ' First overall: the whole league is watching.' : C.path === 'top' ? ' The city expects a star.' : ''}</p>
      <div class="card rival"><h3>Your rival</h3><p>${badge(rt)} <b>${esc(PB.full(rv))}</b>, ${PB.POS_NAME[rv.pos].toLowerCase()}, went ${ord(C.rival.pick)} to the ${esc(rt.name)}, in your division. Overall ${rv.ovr}. ${C.draftTale === 'top' ? 'He went first. You were supposed to.' : C.pick > 30 ? 'A first-rounder at your position. Everybody will say they got it right.' : 'The league will compare you all career.'}</p></div>
      <button class="big" id="go">Go to the team</button></div>`);
    if (in3d) { scr().classList.add('over3d'); PB.R.showcase(me, t); }
    $('#go').onclick = () => { PB.R.showcase(null); scr().classList.remove('over3d'); hub(); };
  }

  /* ---------- team helpers ---------- */
  const myRoster = () => C.rosters[C.team];
  function starters(teamId) {
    const ro = C.rosters[teamId].filter(p => !(p.out > 0)), used = new Set();
    const five = PB.POS.map(pos => { const p = ro.filter(q => q.pos === pos && !used.has(q)).sort((a, b) => b.ovr - a.ovr)[0]; if (p) used.add(p); return p; });
    /* a position with everyone hurt: the best healthy man left plays it */
    for (let i = 0; i < 5; i++) if (!five[i]) { const p = ro.filter(q => !used.has(q)).sort((a, b) => b.ovr - a.ovr)[0] || C.rosters[teamId][i]; used.add(p); five[i] = p; }
    return five;
  }
  /* your role: your overall against the best at your position, moved by how much the coach trusts you */
  function role() {
    const same = myRoster().filter(p => p.pos === C.me.pos).sort((a, b) => b.ovr - a.ovr)[0];
    const d = C.me.ovr - same.ovr + ((C.trust ?? 50) - 50) / 8;
    return d >= -1 ? 'Starter' : d >= -6 ? 'Sixth man' : 'Bench';
  }
  /* your minutes by role, in fractions of regulation: a starter opens both halves and closes the game (about 35 of 48
     minutes), a sixth man is the first off the bench in each half and plays into the fourth (about 24), a reserve gets a
     run late in the first half and another in the second (about 13). The coach's trust buys a reserve a little more. */
  function stintsFor(rl) {
    if (rl === 'Starter') return [[0, 0.19], [0.31, 0.69], [0.83, 1]];
    if (rl === 'Sixth man') return [[0.14, 0.35], [0.56, 0.72], [0.8, 0.93]];
    const x = PB.clamp(((C.trust ?? 50) - 50) / 400, 0, 0.06);
    return [[0.2, 0.33 + x], [0.68, 0.81 + x]];
  }
  const roleMin = rl => stintsFor(rl).reduce((a, x) => a + x[1] - x[0], 0);
  const roleLine = () => { const r = role(); return r === 'Starter' ? 'The coach has you in the starting five.' : r === 'Sixth man' ? 'You are the first man off the bench in each half, about half the game.' : 'You start on the bench: a run in each half, about a quarter of the game. Play well and the minutes come.'; };
  const strength = id => { const ro = C.rosters[id].filter(p => !(p.out > 0)).concat(id === C.team && !C.injury ? [C.me] : []);
    while (ro.length < 8) ro.push({ ovr: 60 });
    return PB.teamOvr(ro); };
  function liveFive() {
    const five = starters(C.team).map(p => p);
    five[PB.POS.indexOf(C.me.pos)] = C.me;
    return five;
  }
  const winP = (a, b, homeA) => 1 / (1 + Math.exp(-(strength(a) - strength(b) + (homeA ? 2 : -2)) / 4));
  const binom = (n, p) => { let k = 0; for (let i = 0; i < n; i++) if (PB.rand() < p) k++; return k; };
  /* a stat line from ratings, a role and a result: used for your simmed games, your rival's, the league's stars */
  /* everyone's numbers are at the length your games are played (the quarter length in Settings): a 3-minute quarter is a
     quarter of a real one, so the league's lines are a quarter of real ones and yours are never scaled up to match */
  const QF = () => (S.qlen || 3) / 12;
  function simLine(pl, rl, win) {
    const r = pl.r, q = QF(), sq = Math.sqrt(q);
    const mins = rl === 'Starter' ? 35 : rl === 'Sixth man' ? 24 : 13;
    const usage = Math.max(0.15, (pl.ovr - 40) / 50) * mins / 32;
    /* shaped to the real league: a scoring champion in the low thirties and a middling starter near fifteen; the best rebounder about fourteen, the best passer about eleven, two and a half steals, three and a half blocks */
    const u2 = Math.pow(usage, 1.75), uc = Math.min(usage, 1.05), pw = (v, lo, span, e) => Math.pow(PB.clamp((v - lo) / span, 0, 1), e);
    const tpa = Math.round(Math.max(0, (r.three - 38) / 7 * usage * q + PB.gauss() * sq)), fga2 = Math.round(Math.max(q >= 0.5 ? 1 : 0, (8.9 * u2 + (r.close + r.mid - 100) / 24) * q + PB.gauss() * 2 * sq));
    const tpm = binom(tpa, 0.2 + r.three / 99 * 0.2), fgm2 = binom(fga2, 0.38 + (r.close + r.mid) / 198 * 0.2);
    const fta = Math.round(Math.max(0, (r.close + r.dunk) / 34 * u2 * q + PB.gauss() * sq)), ftm = binom(fta, 0.45 + r.ft / 99 * 0.45);
    const line = { pts: fgm2 * 2 + tpm * 3 + ftm, reb: Math.max(0, Math.round(14.4 * pw(r.reb, 35, 60, 1.9) * uc * q + PB.gauss() * 1.5 * sq)), ast: Math.max(0, Math.round(11.2 * pw(r.pass, 35, 61, 2) * uc * q + PB.gauss() * 1.5 * sq)),
      stl: binom(5, PB.clamp(pw(r.steal, 35, 60, 2.3) * 0.44, 0.02, 0.6) * q * mins / 32), blk: binom(6, PB.clamp(pw(r.block, 40, 58, 2.8) * 0.62, 0.01, 0.62) * q * mins / 32), tov: binom(4, 0.25 * q * mins / 32), fga: tpa + fga2, fgm: tpm + fgm2, tpa, tpm, fta, ftm, min: Math.round(mins * q * 10) / 10 };
    /* the badge counters a simmed game earns, roughly */
    line.ct = { tpm, cs3: Math.round(tpm * 0.6), mid: Math.round(fgm2 * (r.mid / (r.mid + r.close))), lay: Math.round(fgm2 * 0.5), dunk: binom(fgm2, Math.max(0, r.dunk - 50) / 120),
      shake: binom(2, Math.max(0, r.handle - 55) / 200), ast: line.ast, reb: line.reb, stl: line.stl, blk: line.blk, cmiss: binom(4, r.perD / 250), clutch: PB.rand() < 0.15 ? binom(3, 0.5) * 2 : 0 };
    line.gs = PB.clamp(Math.round(6 + (line.pts / q - 10 * mins / 32) / 6 + (line.ast + line.reb) / q / 8 + (win ? 0.5 : -0.5) + PB.gauss() * 0.8), 0, 12);
    return line;
  }

  /* ---------- the league around you ---------- */
  function simLeagueDay(myOpp) {
    const ids = PB.TEAMS.map(t => t.id).filter(id => id !== C.team && id !== myOpp).sort(() => PB.rand() - 0.5);
    C.dayBest = null; C.scores = [];
    for (let i = 0; i + 1 < ids.length; i += 2) {
      const a = ids[i], b = ids[i + 1];
      const w = PB.rand() < winP(a, b, true) ? a : b, l = w === a ? b : a;
      C.standings[w].w++; C.standings[l].l++;
      { const base = (106 + PB.gauss() * 9) * QF(), mar = Math.max(1, Math.round(Math.abs(PB.gauss() * 9) * QF())), lo = Math.max(4, Math.round(base - mar / 2)); C.scores.push([w, lo + mar, l, lo, w === a]); }   // the night's finals, for the scores page
      /* streaks around the league */
      C.streaks = C.streaks || {};
      C.streaks[w] = (C.streaks[w] || 0) >= 0 ? (C.streaks[w] || 0) + 1 : 1; C.streaks[l] = (C.streaks[l] || 0) <= 0 ? (C.streaks[l] || 0) - 1 : -1;
      if (C.streaks[w] === 7) C.news.unshift(`The ${PB.team(w).name} have won seven straight`);
      if (C.streaks[l] === -7) C.news.unshift(`The ${PB.team(l).name} have lost seven in a row`);
      leagueLines(a, w === a); leagueLines(b, w === b);
      if (C.rival && (a === C.rival.team || b === C.rival.team)) rivalGame(w === C.rival.team);
    }
    if (C.dayBest) C.news.unshift(`${C.dayBest.name} drops ${C.dayBest.pts} for the ${PB.team(C.dayBest.team).name}`);
    leagueInjuries();
    if (C.phase === 'regular' && PB.rand() < 0.03) leagueTrade();
    coachFirings();
  }
  /* past the midway point a team losing badly may fire its coach; yours brings in someone who has not seen you play */
  function coachFirings() {
    if (C.phase !== 'regular' || C.gi < (C.len || 20) * 0.4) return;
    C.fired = C.fired || {};
    for (const t of PB.TEAMS) {
      const st = C.standings[t.id], gp = st.w + st.l;
      if (gp < 6 || st.w / gp > 0.28 || C.fired[t.id] === C.year || PB.rand() > 0.06) continue;
      C.fired[t.id] = C.year;
      C.news.unshift(`The ${t.name} fire their coach at ${st.w}-${st.l}`);
      if (t.id === C.team) { C.trust = 50; C.news.unshift(`New coach in ${t.city}: everybody starts over, ${C.me.last} included`); C.feed.unshift({ who: '@' + t.id.toLowerCase() + '_insider', text: `Coaching change. The new staff says every job is open.` }); }
    }
  }
  /* every seven games the league names a Player of the Week in each conference; your week can be it. About a third
     of the way in, the first All-Star fan-voting returns come out. */
  function weekly(res, k) {
    const W = C.wk || (C.wk = { n: 0, pts: 0, reb: 0, ast: 0, w: 0 });
    W.n++; W.pts += res.line.pts * k; W.reb += res.line.reb * k; W.ast += res.line.ast * k; if (res.win) W.w++;
    if (W.n >= 7) {
      const me = C.me, conf = PB.team(C.team).conf, sc = ((W.pts + W.reb * 0.6 + W.ast * 0.8) / W.n) / QF() + W.w * 1.4;
      if (sc >= 33) {
        C.trophies.push(`${conf} Player of the Week, season ${C.year}`); C.fans = Math.round(C.fans * 1.05);
        C.news.unshift(`${me.last} is the ${conf} Player of the Week: ${(W.pts / W.n).toFixed(1)} points a game, ${W.w}-${W.n - W.w}`);
        C.feed.unshift({ who: '@league', text: `${PB.full(me)} is your ${conf} Player of the Week` });
      } else {
        const L = leaders().filter(r => !r.me && PB.team(r.team).conf === conf).sort((a, b) => (b.ptspg + b.rebpg * 0.6 + b.astpg * 0.8) * (0.7 + PB.rand() * 0.6) - (a.ptspg + a.rebpg * 0.6 + a.astpg * 0.8) * (0.7 + PB.rand() * 0.6));
        if (L[0]) C.news.unshift(`${L[0].name} (${PB.team(L[0].team).ab}) is the ${conf} Player of the Week`);
      }
      C.wk = { n: 0, pts: 0, reb: 0, ast: 0, w: 0 };
    }
    /* the league's month: Player of the Month in your conference, and Rookie of the Month in your first year */
    { const M2 = C.mo || (C.mo = { n: 0, pts: 0, reb: 0, ast: 0, w: 0 }), per = PB.clamp(Math.round((C.len || 20) / 4), 5, 14);
      M2.n++; M2.pts += res.line.pts; M2.reb += res.line.reb; M2.ast += res.line.ast; if (res.win) M2.w++;
      if (M2.n >= per) { const me = C.me, conf = PB.team(C.team).conf, sc = ((M2.pts + M2.reb * 0.6 + M2.ast * 0.8) / M2.n) / QF() + M2.w / M2.n * 8, mon = `the month (games ${C.gi - per + 2}-${C.gi + 1})`;
        if (sc >= 34) { C.trophies.push(`${conf} Player of the Month, season ${C.year}`); C.fans = Math.round(C.fans * 1.08); me.sp += 2; C.news.unshift(`${me.last} is the ${conf} Player of the Month: ${(M2.pts / M2.n).toFixed(1)} points a game`); C.feed.unshift({ who: '@league', text: `${PB.full(me)}: ${conf} Player of the Month` }); }
        else { const L = leaders().filter(r => !r.me && PB.team(r.team).conf === conf).sort((a, b) => (b.ptspg + b.rebpg * 0.6 + b.astpg * 0.8) - (a.ptspg + a.rebpg * 0.6 + a.astpg * 0.8))[Math.floor(PB.rand() * 3)]; if (L) C.news.unshift(`${L.name} (${PB.team(L.team).ab}) is the ${conf} Player of the Month`); }
        if (C.year === 1) { if (sc >= 15) { C.trophies.push(`${conf} Rookie of the Month, season ${C.year}`); me.sp += 1; C.news.unshift(`${me.last} is the ${conf} Rookie of the Month`); }
          else { const R2 = leaders().filter(r => !r.me && r.rookie && PB.team(r.team).conf === conf).sort((a, b) => b.ptspg - a.ptspg)[0]; if (R2) C.news.unshift(`${R2.name} (${PB.team(R2.team).ab}) is the ${conf} Rookie of the Month`); } }
        C.mo = { n: 0, pts: 0, reb: 0, ast: 0, w: 0 }; } }
    /* the first returns of the fan vote */
    if (!C.vote && C.len >= 20 && C.gi >= Math.round(C.len * 0.33)) {
      const conf = PB.team(C.team).conf, guard = ['PG', 'SG'].includes(C.me.pos), grp = guard ? ['PG', 'SG'] : ['SF', 'PF', 'C'];
      const val = r => r.ptspg + r.rebpg * 0.5 + r.astpg * 0.7;
      const rows = leaders().filter(r => PB.team(r.team).conf === conf);
      const pos = id => { for (const t of PB.TEAMS) { const p = C.rosters[t.id].find(q => PB.full(q) === id); if (p) return p.pos; } return null; };
      const mine = rows.find(r => r.me); if (!mine) return;
      const fanBoost = Math.log10(Math.max(1000, C.fans)) - 4;
      const others = rows.filter(r => !r.me && grp.includes(pos(r.name))).map(r => val(r));
      const rank = 1 + others.filter(v => v > val(mine) + fanBoost * 3 * QF()).length;
      C.vote = { rank, grp: guard ? 'guards' : 'frontcourt players', conf, year: C.year };
      C.news.unshift(`All-Star voting, first returns: ${C.me.last} is ${ordinal(rank)} among ${conf} ${C.vote.grp}`);
    }
  }
  /* the league's summer: veterans retire and a rookie class takes their places, free agents change teams */
  function leagueSummer() {
    const rv = C.rival && C.rival.id, gone = [], moves = [];
    for (const t of PB.TEAMS) {
      const ro = C.rosters[t.id], nums = new Set(ro.map(p => p.num));
      for (let i = 0; i < ro.length; i++) {
        const p = ro[i];
        if (p.id === rv) continue;
        const go = p.age >= 39 || (p.age >= 35 && PB.rand() < 0.45 + (p.age - 35) * 0.2) || (p.age >= 32 && p.ovr < 60 && PB.rand() < 0.5);
        if (!go) continue;
        gone.push([p, t.id]);
        const r = PB.makePlayer(p.pos, Math.round(PB.rr(60, 74)), PB.ri(19, 22)); r.rookie = true;
        while (nums.has(r.num)) r.num = PB.ri(0, 55);
        nums.add(r.num); ro[i] = r; PB.freshName(r, ro, C.rosters);
      }
    }
    /* free agency around the league: good players trade places between teams (yours keeps its men) */
    const ids = PB.TEAMS.map(t => t.id).filter(id => id !== C.team);
    for (let k = 0; k < 8; k++) {
      const a = PB.pick(ids), b = PB.pick(ids); if (a === b) continue;
      const pa = PB.pick(C.rosters[a]), pb = C.rosters[b].filter(q => q.pos === pa.pos && q.id !== rv && Math.abs(q.ovr - pa.ovr) <= 4)[0];
      if (!pb || pa.id === rv) continue;
      C.rosters[a][C.rosters[a].indexOf(pa)] = pb; C.rosters[b][C.rosters[b].indexOf(pb)] = pa;
      moves.push([pa, b], [pb, a]);
    }
    gone.sort((x, y) => y[0].ovr - x[0].ovr).slice(0, 3).forEach(([p, tid]) => C.news.unshift(`${PB.full(p)} retires at ${p.age} (${PB.team(tid).ab})`));
    moves.filter(([p]) => p.ovr >= 78).slice(0, 3).forEach(([p, tid]) => C.news.unshift(`Free agency: ${PB.full(p)} signs with the ${PB.team(tid).name}`));
    if (gone.length) C.news.unshift(`${gone.length} players retire this summer; a new rookie class arrives`);
  }
  /* a trade now and then between two other teams, a like-for-like swap at one position */
  function leagueTrade() {
    const ids = PB.TEAMS.map(t => t.id).filter(id => id !== C.team), rv = C.rival && C.rival.id;
    const a = PB.pick(ids), b = PB.pick(ids); if (a === b) return;
    const pa = C.rosters[a].filter(q => q.id !== rv && !(q.out > 0)).sort((x, y) => y.ovr - x.ovr)[PB.ri(1, 6)];
    if (!pa) return;
    const pb = C.rosters[b].find(q => q.pos === pa.pos && q.id !== rv && Math.abs(q.ovr - pa.ovr) <= 3);
    if (!pb) return;
    C.rosters[a][C.rosters[a].indexOf(pa)] = pb; C.rosters[b][C.rosters[b].indexOf(pb)] = pa;
    C.news.unshift(`Trade: the ${PB.team(a).name} send ${PB.full(pa)} to the ${PB.team(b).name} for ${PB.full(pb)}`);
  }
  /* injuries around the league: a day off to a few weeks, scaled to the season's length; a star's is news */
  function leagueInjuries() {
    const len = C.len || 20;
    for (const t of PB.TEAMS) for (const p of C.rosters[t.id]) {
      if (p.out > 0) { p.out--; if (!p.out && p.ovr >= 80 && p.outN >= 3) C.news.unshift(`${PB.full(p)} returns for the ${PB.team(t.id).name}`); continue; }
      if (PB.rand() < 0.005) {
        p.out = Math.max(1, Math.round(PB.pick([1, 1, 2, 3, 5, 8, 12]) * len / 41));
        const tm = PB.team(t.id), weeks = p.out >= 4; p.outN = p.out;
        if ((p.ovr >= 80 || t.id === C.team) && p.out >= 2) C.news.unshift(`${PB.full(p)} (${tm.ab}) is out ${p.out} games${weeks ? ` with ${PB.pick(['a sprained ankle', 'a hamstring strain', 'a bone bruise in his knee', 'back spasms', 'a sprained wrist'])}` : ''}`);
      }
    }
  }
  /* every starter's line from a simmed game, for the league leaders and the awards */
  const LS = ['gp', 'pts', 'reb', 'ast', 'stl', 'blk', 'tpm'];
  function leagueLines(tid, win) {
    C.ls = C.ls || {};
    for (const p of starters(tid)) {
      if (!p || (C.rival && p.id === C.rival.id)) continue;   // the rival keeps his own line
      const ln = simLine(p, 'Starter', win), e = C.ls[p.id] || (C.ls[p.id] = { name: PB.full(p), team: tid, rookie: !!p.rookie, gp: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tpm: 0 });
      e.gp++; for (const k of LS.slice(1)) e[k] += ln[k]; e.team = tid;
      if (ln.pts >= 33 * QF() && (!C.dayBest || ln.pts > C.dayBest.pts)) C.dayBest = { name: PB.full(p), pts: ln.pts, team: tid };
    }
  }
  function rivalGame(win, vsMe) {
    const rv = rivalP(); if (!rv) return null;
    const rl = rv.ovr >= starters(C.rival.team)[PB.POS.indexOf(rv.pos)].ovr ? 'Starter' : 'Sixth man';
    const ln = simLine(rv, rl, win);
    for (const k of ['pts', 'reb', 'ast', 'stl', 'blk', 'fga', 'fgm', 'tpa', 'tpm']) { C.rival.season[k] += ln[k]; C.rival.totals[k] += ln[k]; }
    C.rival.season.gp++; C.rival.totals.gp++;
    if (ln.pts >= 28 * QF()) C.news.unshift(`Your rival ${PB.full(rv)} scores ${ln.pts} for the ${PB.team(C.rival.team).name}`);
    return ln;
  }
  const confRank = conf => PB.TEAMS.filter(x => x.conf === conf).map(x => x.id)
    .sort((a, b) => (C.standings[b].w - C.standings[b].l) - (C.standings[a].w - C.standings[a].l) || strength(b) - strength(a));

  /* ---------- the hub ---------- */
  let tab = 'home';
  /* saves from before: your season line was kept scaled up to full length, and the league's at full length; both now
     stand at the length your games are played */
  function statsV2() {
    if (!C || C.statV === 2) return; const q = QF();
    if (C.season && C.season.gp !== undefined && C.adj) { const z = C.season; C.adj = { gp: C.adj.gp, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tpm: 0 }; const f = z.gp ? C.adj.gp / z.gp : 0; for (const k of ['pts', 'reb', 'ast', 'stl', 'blk', 'tpm']) C.adj[k] = (z[k] || 0) * f; }
    for (const id in C.ls || {}) for (const k of ['pts', 'reb', 'ast', 'stl', 'blk', 'tpm']) C.ls[id][k] *= q;
    if (C.rival && C.rival.season) for (const k of ['pts', 'reb', 'ast', 'stl', 'blk', 'fga', 'fgm', 'tpa', 'tpm']) if (C.rival.season[k]) C.rival.season[k] = Math.round(C.rival.season[k] * q);
    C.statV = 2;
  }
  /* a career that will not open (a save damaged by hand, or by a browser that ran out of room mid-write) never leaves a
     blank page: it says so, changes nothing, and offers the way out and a copy of the save */
  function wontOpen(err) {
    if (PB.DEV) console.error(err);
    if (PB.Game && PB.Game.active && PB.Game.stop) { try { PB.Game.stop(); } catch (e) { /* nothing running */ } }
    show(`<div class="page post"><p class="kick">Career</p><h2>This career would not open</h2><p class="mute">Something in its save could not be read. Nothing has been changed or deleted.</p>
      <button class="big" id="go">Main menu</button><button class="ghost" id="hubx">Save a copy of it<small>a file you can keep or send for help</small></button></div>`);
    const bad = C;
    $('#go').onclick = () => { C = null; setCur(''); title(); };
    $('#hubx').onclick = () => { try { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify({ pocketbasketball: 1, career: bad })], { type: 'application/json' })); a.download = 'pocket-basketball-career.json'; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); } catch (e) { /* nothing to save */ } };
  }
  function hub() { try { hubDraw(); } catch (err) { wontOpen(err); } }
  function hubDraw() {
    statsV2();
    if (PB.audio) PB.audio.music(true);
    if (!C) { title(); return; }
    upgrade();
    if (C.phase === 'regular' && C.gi >= C.games.length) { startPlayoffs(); }
    if (C.phase === 'combine') { (C.path === 'undrafted' ? undrafted : combine)(); return; }
    /* a scene that is waiting to be seen (the coach's office, your first start, a new contract) plays before the hub */
    if (C.team && C.phase === 'regular') { const F = C.flags || (C.flags = {});
      if (!(C.cs && C.cs.length) && !F.csStart) { const nx0 = nextGame(), st0 = nx0 && nx0.g ? story(nx0.g) : null; if (st0 && st0.k === 'first_start') { F.csStart = true; (C.cs = C.cs || []).push('firststart'); } } }
    if (C.cs && C.cs.length && C.team) { const k = C.cs.shift(); save(); playScene(k, hub); return; }
    if (C.phase === 'retired') { hallOfFame(); return; }
    if (C.phase === 'awards') { awardsNight(); return; }
    if (C.phase === 'offseason') { seasonEnd(C.lastGot); return; }
    const t = PB.team(C.team), me = C.me;
    if (C.phase === 'regular' || C.phase === 'playoffs') { const lr = loginReward(); if (lr) { rankUp(); save(); C.loginShow = lr; } }
    const s = C.season, gp = s.gp || 1;
    const avg = k => (s[k] / gp).toFixed(1);
    const tabs = ['home', 'team', 'player', 'social', 'league', 'log'];
    let body = '';
    if (tab === 'home') {
      const nx = nextGame();
      let card;
      if (nx) {
        const o = PB.team(nx.opp), st = C.standings[C.team], os = C.standings[nx.opp];
        const them = starters(o.id)[PB.POS.indexOf(me.pos)];
        const rivalGame = C.rival && nx.opp === C.rival.team;
        const dn = C.games.filter(x => x.done), tot = C.games.length || 1, l5 = dn.slice(-5);
        card = `<div class="next">
        <p class="kick">${nx.label}</p>${(() => { const st = nx.g ? story(nx.g) : null; return st ? `<p class="tale"><b>${esc(st.title)}</b> ${esc(st.sub)}</p>` : ''; })()}
        <div class="prog"><i><u style="width:${Math.round(dn.length / tot * 100)}%"></u></i>${l5.length ? `<span>${l5.map(x => `<b class="${x.res && x.res.win ? 'w' : 'l'}">${x.res && x.res.win ? 'W' : 'L'}</b>`).join('')}</span>` : ''}</div>
        <div class="vs"><div>${badge(t)}<b>${t.name}</b><span>${st.w}-${st.l} · ${strength(C.team)}</span></div><em>vs</em>
        <div>${badge(o)}<b>${o.name}</b><span>${os.w}-${os.l} · ${strength(o.id)}</span></div></div>
        ${(() => { muOpp = [them, o]; const mh = matchShot(them, o), yh = portrait(); return mh && yh ? `<div class="matchup"><div><img alt="" src="${yh}" style="--tc:${t.c1}"><b>${esc(me.last)}</b><span>${me.ovr}</span></div><em>guards</em><div id="mopp" role="button" tabindex="0"><img alt="" src="${mh}" style="--tc:${o.c1}"><b>${esc(them.last)}</b><span>${them.ovr} · scout ›</span></div></div>` : ''; })()}
        ${rivalGame ? `<p class="rivaltag">Rival game: ${esc(PB.full(rivalP()))} is on the other side</p>` : `<p class="fine">Their ${me.pos}: ${esc(PB.full(them))} (${them.ovr}). You guard him.</p>`}
        ${(() => { const out = (id, who) => C.rosters[id].filter(p => p.out > 0 && p.ovr >= 72).sort((a, b) => b.ovr - a.ovr).slice(0, 2).map(p => `${esc(p.last)} (${p.ovr})`).join(', '); const a = out(nx.opp), b = out(C.team);
          return a || b ? `<p class="fine">Injured: ${[a && `${esc(PB.team(nx.opp).name)} without ${a}`, b && `you are without ${b}`].filter(Boolean).join(' · ')}</p>` : ''; })()}
        ${(C.goals = C.goals || makeGoals()) && `<div class="goals"><b>Your goals</b>${C.goals.map(g => `<span>${esc(g.text)}</span>`).join('')}<em>+2 skill points each</em></div>`}
        <button class="big" id="play">Play game</button><button class="ghost" id="sim">Sim game</button>
        ${C.phase === 'regular' ? '<div class="row2"><button class="ghost sm" id="sim5">Sim 5 games</button><button class="ghost sm" id="simall">Sim to the playoffs</button></div>' : ''}
        ${C.practiced !== C.gi + (C.phase === 'playoffs' ? 1000 : 0) ? '<button class="ghost sm" id="practice">Team practice first: spot-up drill, up to +5 skill points</button>' : ''}</div>`;
      } else if (C.phase === 'playoffs' && !C.po.champ && alive()) {
        card = C.po.round < 2 ? `<div class="next"><p class="kick">Playoffs</p><p>You're the ${ordinal(C.po.seeds[PB.team(C.team).conf].indexOf(C.team) + 1)} seed, waiting on the play-in.</p>
        <button class="big" id="simpi">Sim the play-in</button></div>` : `<div class="next"><p class="kick">Playoffs</p><p>You're through. The rest of the round is still being played.</p>
        <button class="big" id="simrd">Finish the round</button></div>`;
      } else {
        card = `<div class="next"><p class="kick">${C.po && C.po.champ ? 'The playoffs are over' : 'Playoffs'}</p>
        <p>${C.po && C.po.champ ? `The ${esc(tname(PB.team(C.po.champ)))} are champions.` : `Your season is over. The playoffs go on without you.`}</p>
        <button class="big" id="simpo">${C.po && C.po.champ ? 'Go to awards night' : 'Sim the rest of the playoffs'}</button></div>`;
      }
      if (C.endorse && C.endorse.offer !== undefined && C.endorse.offer >= C.endorse.tier) {
        const BR = [['Apex', '#e63946'], ['Stride', '#2b6cff'], ['Vanta', '#111111'], ['Hoopla', '#ffd23f']];
        const i = C.endorse.offer, amt = [0.4, 1.2, 4, 10][i];
        C.endorse.brands = C.endorse.brands || BR.slice().sort(() => PB.rand() - 0.5).slice(0, 2);
        card = `<div class="next endorse"><p class="kick">Endorsement</p><h3>${fmtFans(C.fans)} followers and counting</h3>
          <p>Two shoe companies want you in their sneakers: ${M(amt)} a year, and a signature colorway.</p>
          ${C.endorse.brands.map((b, j) => `<button class="ghost" data-brand="${j}"><i class="sw" style="background:${b[1]}"></i>Sign with ${b[0]}</button>`).join('')}
          <button class="ghost sm" id="nobrand">Not now</button></div>` + card;
      }
      if (C.event) card = eventCard() + card;
      card = (PB.account && PB.account.card ? PB.account.card() : '') + (PB.account && PB.account.user() ? '' : backupCard()) + card;
      if (C.coachTalk) {
        const s5 = C.games.filter(x => x.done).slice(-5), avgG = s5.reduce((a, x) => a + (x.res.gscore || 6), 0) / Math.max(1, s5.length);
        const r = role(), tr = C.trust;
        const msg = avgG >= 9 ? `You've been great. ${r === 'Starter' ? 'Keep doing what you are doing; this is your spot.' : 'Keep this up and the starting job is yours.'}`
          : avgG >= 6.5 ? `Solid. ${r === 'Bench' ? 'I need to see more before you get more minutes.' : 'Now give me more on defense: contest everything.'}`
          : `I need better from you. Smart shots, take care of the ball, and run back on defense${r === 'Starter' ? ', or somebody else starts' : ''}.`;
        card = `<div class="next coach"><p class="kick">A word from the coach</p><p class="q">“${msg}”</p>
          <p class="fine">Last five games: average grade ${gradeAvg(avgG)} · trust ${Math.round(tr)}</p>
          <button class="ghost" id="coachok">Got it, coach</button><button class="ghost" id="coachmore">“I want more minutes”</button></div>` + card;
      }
      if (C.season.allstar && !C.asg) card = `<div class="next"><p class="kick">All-Star weekend</p><h3>The All-Star Game</h3><p>East against West, the best player at every position, and you in the ${esc(PB.team(C.team).conf)} lineup.</p>
        <button class="big" id="asg">Play the All-Star Game</button><button class="ghost" id="asgsim">Sim it</button></div>` + card;
      if (C.contest === 'invited') card = `<div class="next"><p class="kick">All-Star weekend</p><h3>3-Point Contest</h3><p>Five racks, five balls each, 60 seconds; the last ball of every rack is the money ball, worth two. Seven of the league's best shooters are waiting.</p>
        <button class="big" id="contest">Take the floor</button><button class="ghost" id="nocontest">Pass this year</button></div>` + card;
      if (C.dunk === 'invited' && C.contest !== 'invited') card = `<div class="next"><p class="kick">All-Star weekend</p><h3>Dunk Contest</h3><p>Two dunks in the first round, the top two go to the final for two more. Five judges, ten points each. Pick the dunk with the Style button; take off from as far out as you dare.</p>
        <button class="big" id="dunk">Take the floor</button><button class="ghost" id="nodunk">Pass this year</button></div>` + card;
      /* the night before a rival game, he posts about you; answer him or let the game do it */
      const rvx = rivalP();
      if (nx && rvx && nx.opp === C.rival.team && C.talk !== `${C.year}-${C.gi}-${C.phase}`) {
        const h2h = C.rival.h2h || [0, 0];
        const lines = [`Same draft class. Different levels. See you tomorrow, ${C.me.last}.`, `Heard ${C.me.last} has been talking. Bring it.`, `Tomorrow I'm going at ${C.me.last} every time down.`, `They keep comparing us. Tomorrow settles it.`,
          `Circle it, ${C.me.last}. I have had tomorrow on my calendar for a month.`, `${PB.team(C.team).city} tomorrow. I already know who is guarding who.`, `Somebody tell ${C.me.last} to get his rest tonight.`, `No friends on the floor tomorrow. Dinner after, maybe.`]
          /* what he says depends on who has been winning */
          .concat(h2h[0] > h2h[1] ? [`${h2h[0]}-${h2h[1]} for ${C.me.last}. I can count. That changes tomorrow.`, `You have had my number, ${C.me.last}. Enjoy it tonight.`] : h2h[1] > h2h[0] ? [`${h2h[1]}-${h2h[0]} against ${C.me.last}. Make it interesting this time.`, `I own this matchup and everybody knows it.`] : []);
        const said = lines[(C.gi * 7 + C.year * 3) % lines.length];
        card = `<div class="next talk"><p class="kick">Rival on social</p><p class="q">@${esc(rvx.first.toLowerCase())}${esc(rvx.last.toLowerCase())}: “${esc(said)}”</p>
          <button class="ghost" id="clap">Clap back<small>more followers; the coach would rather you didn't</small></button><button class="ghost" id="quiet">Let the game talk<small>the coach likes it</small></button></div>` + card;
      }
      { const nxm = nextGame(), rvm = rivalP(); if (nxm && rvm && C.rival && nxm.opp === C.rival.team && social().mday !== gameNo()) card = `<div class="next talk"><p class="kick">Media day · rival game</p><p class="q">The cameras are set up before you play ${esc(PB.full(rvm))} and the ${esc(PB.team(C.rival.team).name)}. Three questions.</p><button class="ghost" id="mday">Sit down with the media<small>your answers move the coach's trust, your hype and your following</small></button></div>` + card; }
      if (C.rising === 'invited' && C.contest !== 'invited' && C.dunk !== 'invited') card = `<div class="next"><p class="kick">All-Star weekend</p><h3>Rising Stars</h3><p>The league's rookies against its second-year players. You are on the ${C.year === 1 ? 'rookies' : 'sophomores'}.</p>
        <button class="big" id="rise">Play the Rising Stars game</button><button class="ghost" id="risesim">Sim it</button></div>` + card;
      const rv = rivalP(), rs = C.rival.season, rg = rs.gp || 1;
      const voteCard = C.vote && C.vote.year === C.year && C.phase === 'regular' && C.gi < Math.round(C.len * 0.5) ? `<div class="card"><h3>All-Star voting</h3><p>${ordinal(C.vote.rank)} among ${esc(C.vote.conf)} ${C.vote.grp} in the first returns. ${C.vote.rank <= 2 ? 'Right now you would start.' : C.vote.rank <= 6 ? 'In the mix: the coaches pick the reserves.' : 'A long way back: big games move the vote.'}</p></div>` : '';
      /* you, the way MyCareer opens: in your uniform on your team's color, your rating big */
      const fb = bodyShot();
      const hero = fb ? `<div class="card potg hero" style="--tc:${t.c1}"><img alt="" src="${fb}"><div class="pi"><p class="kick">${esc(t.name)} · ${me.pos} · ${esc(me.arch || '')}</p>
        <b class="nm">${esc(me.first || '')}<br>${esc(me.last || '')}</b><div class="ovr"><b>${me.ovr}</b><span>OVR</span></div>
        <span class="fg">${role()} · ${s.gp ? `${s.min ? (s.min / s.gp).toFixed(1) + ' min · ' : ''}${avg('pts')} pts · ${avg('reb')} reb · ${avg('ast')} ast` : 'no games yet'}</span></div></div>` : '';
      body = hero + card + voteCard + roadCard() + (C.phase === 'playoffs' ? bracketCard() : '') + `
        <div class="tiles">
          <div><b>${avg('pts')}</b><span>PTS</span></div><div><b>${avg('reb')}</b><span>REB</span></div><div><b>${avg('ast')}</b><span>AST</span></div>
          <div><b>${s.fga ? Math.round(s.fgm / s.fga * 100) : 0}%</b><span>FG</span></div><div><b>${s.tpa ? Math.round(s.tpm / s.tpa * 100) : 0}%</b><span>3PT</span></div><div><b>${s.gp ? gradeAvg(s.grades / s.gp) : '–'}</b><span>GRADE</span></div></div>
        <div class="card meters"><div><span>Coach trust</span><i><u style="width:${C.trust}%"></u></i><b>${Math.round(C.trust)}</b></div>
          ${C.injury ? `<div class="wide"><span>Questionable</span><b class="inj">${esc(C.injury.what)} · ${C.injury.games} game${C.injury.games > 1 ? 's' : ''}</b></div>` : ''}
          <div><span>Role</span><b class="tag">${role()}</b></div><div><span>Followers</span><b>${fmtFans(C.fans)}</b></div>
          ${C.contract ? `<div class="wide"><span>Contract</span><b>${C.contract.years} yr${C.contract.years === 1 ? '' : 's'} · ${M(C.contract.salary)}</b></div>` : ''}</div>
        ${C.loginShow ? `<div class="card login"><b>Daily reward · day ${C.loginShow.day} of 7</b><span>+${C.loginShow.sp} skill point${C.loginShow.sp > 1 ? 's' : ''}, +${C.loginShow.fans} followers. Come back tomorrow for day ${C.loginShow.day % 7 + 1}${C.loginShow.day === 6 ? ' (the big one)' : ''}.</span></div>` : ''}
        ${C.rankNew ? `<div class="card login rk"><b>Rank up: ${RANKS[C.rankNew][0]}</b><span>${RANK_GIFT[C.rankNew]} unlocked in your Look card (Player tab).</span></div>` : ''}
        <button class="mode park" id="parkbtn">${MIC.street}<span><b>The Park</b><small>Walk it, shoot around, pick-up games, Pro-Am, the gym and the closet · park record ${(C.park || { w: 0 }).w}-${(C.park || { l: 0 }).l}</small></span><em>›</em></button>
        ${questsCard()}
        <div class="card rival"><h3>Rival <small>${esc(PB.team(C.rival.team).name)}</small></h3>
          <div class="rv"><div><b>${esc(PB.full(me))}</b><span>${avg('pts')} / ${avg('reb')} / ${avg('ast')}</span></div><em>${C.rival.h2h[0]}–${C.rival.h2h[1]}</em>
          <div><b>${esc(PB.full(rv))}</b><span>${(rs.pts / rg).toFixed(1)} / ${(rs.reb / rg).toFixed(1)} / ${(rs.ast / rg).toFixed(1)}</span></div></div>
          <p class="fine">Points, rebounds, assists a game this season; the middle is your record head to head.</p></div>
        <div class="card"><h3>Feed <small>${fmtFans(C.fans || 0)} followers · hype ${social().hype}</small></h3><div class="feedl">${C.feed.slice(0, 3).map((f, i) => postCard(f, i)).join('') || '<p class="mute">Nothing yet. Play a game.</p>'}</div><button class="ghost fmore" id="tosoc">Open Social</button></div>
        <div class="card"><h3>News</h3>${C.news.slice(0, 5).map(n => `<p class="news">${esc(n)}</p>`).join('')}</div>`;
    } else if (tab === 'team') {
      const st = C.standings[C.team] || { w: 0, l: 0 };
      const five = role() === 'Starter' ? liveFive() : starters(C.team);
      const bench = myRoster().concat([me]).filter(p => !five.includes(p)).sort((a, b) => b.ovr - a.ovr);
      const row = (p, i) => `<div class="ros ${p.me ? 'me' : ''}" data-pid="${esc(p.id)}" role="button" tabindex="0"><img alt="" data-head="${esc(p.id)}"><b class="no">${p.num}</b>
        <div><b>${esc(PB.full(p))}${p.me ? ' <small>you</small>' : ''}${p.out > 0 ? ` <small class="out">out ${p.out}</small>` : ''}</b>
        <span>${i < 5 ? PB.POS[i] : p.pos} · ${PB.fmtH(p.ht)} · ${p.age}${p.from ? ' · ' + esc(p.from) : ''}</span></div><em>${p.ovr}</em></div>`;
      body = `<div class="teamban" style="--c1:${t.c1};--c2:${t.c2}">${badge(t)}<div><small>${esc(t.city)}</small><b>${esc(t.name)}</b><span>${st.w}-${st.l} · team overall ${strength(C.team)}</span></div></div>
        ${chemCard()}
        <div class="card roster">
        <p class="kick">Starting five</p>${five.map(row).join('')}
        <p class="kick">Bench</p>${bench.map(p => row(p, 9)).join('')}</div>`;
    } else if (tab === 'player') {
      const A = PB.ARCH[me.arch];
      body = `<div class="card"><h3>${esc(PB.full(me))} <small>${me.pos} · ${me.arch} · age ${me.age} · ${role()}</small></h3>
        <div class="ovr"><b>${me.ovr}</b><span>overall</span><em>${me.sp} skill points</em></div>
        ${PB.ATTRS.map(([k, n, d]) => { const c = cost(me.r[k]); const can = me.r[k] < A.cap[k] && me.sp >= c;
          const G0 = { close: ['Scoring', ['close', 'dunk', 'mid', 'three', 'ft']], handle: ['Playmaking', ['handle', 'pass']], speed: ['Athleticism', ['speed', 'vert']], perD: ['Defense', ['perD', 'inD', 'steal', 'block', 'reb']] }[k];
          return `${G0 ? `<p class="kick grp">${G0[0]}<b>${Math.round(G0[1].reduce((a, x) => a + me.r[x], 0) / G0[1].length)}</b></p>` : ''}<div class="bar up"><span>${n}<small>${d}</small></span><i><u style="width:${me.r[k]}%"></u><s style="left:${A.cap[k]}%"></s></i><b>${me.r[k]}</b>
          <button data-k="${k}" ${can ? '' : 'disabled'}>+1<small>${me.r[k] >= A.cap[k] ? 'max' : c + ' SP'}</small></button></div>`; }).join('')}
        <p class="fine">Skill points come from your teammate grade after every game, more for a win. Each point higher costs more.</p>
        ${me.sp > 0 ? '<button class="ghost sm" id="auto">Auto-upgrade: spend my points on what my build needs</button>' : ''}</div>
        <div class="card locker"><h3>Locker room <small>what your team wears at home</small></h3><div class="kits">${['icon', 'assoc', 'statement', 'city'].map(k => `<button class="kitpick ${(C.homeKit || 'icon') === k ? 'on' : ''}" data-k="${k}"><img alt="" data-kit="${k}"><span>${{ icon: 'Icon', assoc: 'Assoc.', statement: 'Statement', city: 'City' }[k]}</span></button>`).join('')}</div></div>
        <div class="card look"><h3>Look</h3>${(() => { const f = bodyShot(true), h = portrait(); return f || h ? `<div class="lookpv">${f ? `<button class="pvb" id="lturn" aria-label="Turn him around" style="--tc:${t.c1}"><img alt="" src="${f}"><span>${lookBack ? 'Front' : 'Back'} ↻</span></button>` : ''}${h ? `<img class="hd" alt="" src="${h}" style="--tc:${t.c1}">` : ''}</div>` : ''; })()}${lookEditor(me)}</div>
        ${perkCard()}
        <div class="card"><h3>Badges <small>earned in games, never lost</small></h3>${badgeList()}</div>
        <div class="card"><h3>Business</h3><p class="fine">${C.endorse && C.endorse.brand ? `Shoe deal: ${C.endorse.brand}, ${M(C.endorse.pay)} a year. ` : ''}${C.contract ? `${C.contract.kind}: ${C.contract.years} season${C.contract.years === 1 ? '' : 's'} left at ${M(C.contract.salary)}. ` : ''}Career earnings ${M(C.earnings || 0)}.</p>
        ${C.tradeReq ? '<p class="rivaltag">Trade requested: you will be moved this summer.</p>' : '<button class="ghost sm" id="trade">Request a trade</button>'}</div>
        <button class="ghost" id="pcard">Share your player card<small>an image of you, your numbers and your trophies</small></button>`;
      body += zonesCard();
    } else if (tab === 'league') {
      const conf = c => confRank(c).map((id, i) => { const x = PB.team(id), st = C.standings[id];
        const top = C.standings[confRank(c)[0]], gb = ((top.w - st.w) + (st.l - top.l)) / 2;
        return `<tr class="${id === C.team ? 'me' : ''} ${i === 6 ? 'cut' : i === 10 ? 'cut2' : ''}"><td>${i + 1}</td><td>${badge(x)} ${x.name}${C.rival && id === C.rival.team ? ' <small class="rv-dot">rival</small>' : ''}</td><td>${st.w}</td><td>${st.l}</td><td>${gb ? gb : '–'}</td><td>${(k => k ? (k > 0 ? 'W' : 'L') + Math.abs(k) : '–')((C.streaks || {})[id] || 0)}</td><td>${strength(id)}</td></tr>`; }).join('');
      /* your conference first; the standings and the leaders a tap apart */
      const mine = PB.team(C.team).conf, confs = mine === 'West' ? ['West', 'East'] : ['East', 'West'];
      body = (C.phase === 'playoffs' ? bracketCard() : '') + (C.cup && ltab === 'stand' && C.phase === 'regular' ? cupCard() : '') + `<div class="seg sm ltabs"><button data-l="stand" class="${ltab === 'stand' ? 'on' : ''}">Standings</button><button data-l="lead" class="${ltab === 'lead' ? 'on' : ''}">Leaders</button><button data-l="awards" class="${ltab === 'awards' ? 'on' : ''}">Awards</button><button data-l="sched" class="${ltab === 'sched' ? 'on' : ''}">Schedule</button></div>`
        + (ltab === 'lead' ? leadersCard() : ltab === 'awards' ? awardsCard() : ltab === 'sched' ? scheduleCard() : confs.map(c => `<div class="card"><h3>${c}${c === mine ? ' <small>your conference</small>' : ''}</h3><table class="std"><tr><th></th><th>Team</th><th>W</th><th>L</th><th>GB</th><th>STRK</th><th>OVR</th></tr>${conf(c)}</table></div>`).join('')
        + `<p class="fine">The top six in each conference make the playoffs (the solid line); seven to ten play in for the last two places (the dashed line).</p>`);
    } else if (tab === 'social') {
      body = `<div class="card soc">${tabSocial()}</div>`;
    } else {
      body = seasonCard() + `<div class="card"><h3>Season ${C.year} game log</h3>${C.games.filter(x => x.done).map((x, i) => glog(x, i + 1)).join('') || '<p class="mute">No games yet.</p>'}</div>
        ${C.po && C.po.games.length ? `<div class="card"><h3>Playoffs</h3>${C.po.games.map((x, i) => glog(x, 'P' + (i + 1))).join('')}</div>` : ''}
        ${C.seasons.length ? `<div class="card"><h3>Career</h3>${C.seasons.map(z => `<div class="glog"><span>Y${z.year}</span>${badge(PB.team(z.team))}<b>${z.w}-${z.l}</b><em>${z.ppg} / ${z.rpg} / ${z.apg}</em><i>${z.awards.join(', ') || '–'}</i></div>`).join('')}</div>
        <div class="card"><h3>Career stats <small>a game, as you played them</small></h3><div class="bxw"><table class="std bx"><tr><th></th><th>GP</th><th>MIN</th><th>PTS</th><th>REB</th><th>AST</th><th>STL</th><th>BLK</th><th>FG%</th><th>3P%</th><th>FT%</th></tr>
        ${C.seasons.map(z => { const d = v => v === null || v === undefined ? '–' : v; return `<tr><td>Y${z.year} <small>${PB.team(z.team).ab}</small></td><td>${d(z.gp)}</td><td>${d(z.mpg)}</td><td><b>${z.ppg}</b></td><td>${z.rpg}</td><td>${z.apg}</td><td>${d(z.spg)}</td><td>${d(z.bpg)}</td><td>${d(z.fg)}</td><td>${d(z.tp)}</td><td>${d(z.ft)}</td></tr>`; }).join('')}
        ${(T2 => T2 && T2.gp ? `<tr class="tot"><td>Career</td><td>${T2.gp}</td><td>${T2.min ? (T2.min / T2.gp).toFixed(1) : '–'}</td><td><b>${(T2.pts / T2.gp).toFixed(1)}</b></td><td>${(T2.reb / T2.gp).toFixed(1)}</td><td>${(T2.ast / T2.gp).toFixed(1)}</td><td>${(T2.stl / T2.gp).toFixed(1)}</td><td>${(T2.blk / T2.gp).toFixed(1)}</td><td>${T2.fga ? Math.round(T2.fgm / T2.fga * 100) : '–'}</td><td>${T2.tpa ? Math.round(T2.tpm / T2.tpa * 100) : '–'}</td><td>${T2.fta ? Math.round(T2.ftm / T2.fta * 100) : '–'}</td></tr>` : '')(C.totals)}</table></div></div>` : ''}
        <div class="card"><h3>Career highs <small>in the games you play</small></h3><div class="tiles">${[['pts', 'PTS'], ['reb', 'REB'], ['ast', 'AST'], ['stl', 'STL'], ['blk', 'BLK'], ['tpm', '3PM']].map(([k, l]) => `<div><b>${(C.highs || {})[k] || 0}</b><span>${l}</span></div>`).join('')}</div>
          <h3>Milestones <small>${Object.keys(C.miles || {}).length} of 12</small></h3>${['First points', 'First dunk', 'First three', '20-point game', '30-point game', 'Double-double', 'Triple-double', '10 assists', '5 blocks', 'A game-winner', 'A playoff win', 'A championship'].map((n, i) => { const k = ['firstpts', 'firstdunk', 'firstthree', 'twenty', 'thirty', 'dd', 'td', 'ten_ast', 'five_blk', 'winner', 'playoffwin', 'title'][i]; const y = (C.miles || {})[k]; return `<p class="mile ${y ? 'got' : ''}">${y ? '★' : '☆'} ${n}${y ? ` <small>season ${y}</small>` : ''}</p>`; }).join('')}</div>
        ${C.trophies.length ? `<div class="card"><h3>Trophy case</h3>${C.trophies.map(x => `<p class="news">🏆 ${esc(x)}</p>`).join('')}</div>` : ''}`;
    }
    show(`<div class="hub" style="--c1:${t.c1};--c2:${t.c2}">
      <div class="hubtop"><div class="me">${portrait() ? `<img class="face" src="${portrait()}" alt="" style="background:${t.c1}">` : badge(t)}<div><b>${esc(PB.full(me))}</b><span>#${me.num} · ${me.pos} · ${me.ovr} OVR · Season ${C.year}${C.phase === 'playoffs' ? ' · Playoffs' : ''}</span></div></div>
      <button class="ic pk" id="menu" aria-label="Back to the park">${PB.noGL ? '⌂' : '⌂<small>Park</small>'}</button></div>
      <div class="hubbody">${body}</div>
      <nav class="tabs">${tabs.map(x => `<button class="${x === tab ? 'on' : ''}" data-t="${x}"><svg viewBox="0 0 24 24" aria-hidden="true">${NAVIC[x]}</svg><span>${{ home: 'Home', team: 'Team', player: 'Player', social: 'Social', league: 'League', log: 'Log' }[x]}</span>${x === 'player' && canUpgrade() ? '<i class="dot"></i>' : ''}</button>`).join('')}</nav></div>`);
    scr().querySelectorAll('.tabs button').forEach(b => b.onclick = () => { tab = b.dataset.t; hub(); });
    scr().querySelectorAll('.ltabs button').forEach(b => b.onclick = () => { ltab = b.dataset.l; hub(); });
    if ($('#parkbtn')) $('#parkbtn').onclick = park;
    scr().querySelectorAll('[data-pick]').forEach(b => b.onclick = () => { const sr = C.po && C.po.series[+b.dataset.pick]; if (sr && !sr.pick) { sr.pick = b.dataset.t; save(); const y = scr().scrollTop; hub(); scr().scrollTop = y; } });
    if ($('#mopp')) $('#mopp').onclick = () => { if (muOpp) rosterCard(muOpp[0], muOpp[1], true); };
    scr().querySelectorAll('.ros[data-pid]').forEach(r => r.onclick = () => { const p = r.dataset.pid === 'me' ? C.me : myRoster().find(x => x.id === r.dataset.pid); if (p) rosterCard(p, PB.team(C.team)); });
    fillHeads();
    $('#menu').onclick = title;
    if ($('#play')) $('#play').onclick = playGame;
    if ($('#sim')) $('#sim').onclick = simGame;
    if ($('#contest')) $('#contest').onclick = () => {
      scr().hidden = true;
      PB.Game.start({ teams: [t, t], rosters: [[C.me], []], userId: 'me', drill: 'contest', qlen: 1, level: S.level, floor: t, onEnd: r => contestResult(r.drill ? r.drill.score : 0) });
    };
    if ($('#nocontest')) $('#nocontest').onclick = () => { C.contest = 'done'; save(); hub(); };
    if ($('#dunk')) $('#dunk').onclick = () => dunkRound(1);
    if ($('#nodunk')) $('#nodunk').onclick = () => { C.dunk = 'done'; save(); hub(); };
    /* the feed: a like is yours to give; the first few each day get you noticed */
    document.querySelectorAll('[data-like]').forEach(e => e.onclick = () => { const f = C.feed[+e.dataset.like]; if (!f) return; f.liked = !f.liked;
      if (f.liked && !f.likedOnce) { f.likedOnce = true; if (C.likeDay !== today()) { C.likeDay = today(); C.likeN = 0; } if ((C.likeN = (C.likeN || 0) + 1) <= 3) { C.fans = (C.fans || 0) + 5; } }
      const st = scr().scrollTop; save(); hub(); scr().scrollTop = st; });
    if ($('#tosoc')) $('#tosoc').onclick = () => { tab = 'social'; hub(); };
    scr().querySelectorAll('[data-sp]').forEach(b => b.onclick = () => socialPost(b.dataset.sp));
    scr().querySelectorAll('[data-co]').forEach(b => b.onclick = () => callOut(b.dataset.co));
    scr().querySelectorAll('[data-perk]').forEach(b => b.onclick = () => perkTap(b.dataset.perk));
    scr().querySelectorAll('[data-of]').forEach(b => b.onclick = () => dealAnswer(b.dataset.of === 'y'));
    scr().querySelectorAll('[data-vote]').forEach(b => b.onclick = () => { const f = C.feed[+b.dataset.vote]; if (!f || !f.poll || f.poll.v != null) return; f.poll.v = +b.dataset.o; f.poll.n++; C.fans = (C.fans || 0) + 3; save(); const y = scr().scrollTop; hub(); scr().scrollTop = y; });
    scr().querySelectorAll('[data-st]').forEach(b => b.onclick = () => { socTab = b.dataset.st; const so = social(); if (so.lastCall) so.lastCall.shown = gameNo(); const y = scr().scrollTop; hub(); scr().scrollTop = y; });
    if ($('#socall')) $('#socall').onclick = () => { socAll = !socAll; const y = scr().scrollTop; hub(); scr().scrollTop = y; };
    const talked = () => { C.talk = `${C.year}-${C.gi}-${C.phase}`; };
    if ($('#mday')) $('#mday').onclick = mediaDay;
    if (PB.account && PB.account.wire) PB.account.wire(hub);
    if ($('#bkup')) $('#bkup').onclick = () => { backupNow(); const y = scr().scrollTop; hub(); scr().scrollTop = y; };
    if ($('#bklater')) $('#bklater').onclick = () => { const B = load('pbb.backup') || {}; B.snooze = ((C.totals && C.totals.gp) || 0) + 10; store('pbb.backup', B); const y = scr().scrollTop; hub(); scr().scrollTop = y; };
    if ($('#clap')) $('#clap').onclick = () => { talked(); C.fans = Math.round(C.fans * 1.04); C.trust = Math.max(0, C.trust - 1); C.clapped = true; C.feed.unshift({ who: '@' + (C.me.first + C.me.last).toLowerCase(), text: `See you tomorrow. Bring your best.` }); C.news.unshift(`${C.me.last} fires back at his rival`); save(); hub(); };
    if ($('#quiet')) $('#quiet').onclick = () => { talked(); C.trust = Math.min(100, C.trust + 1); C.clapped = false; save(); hub(); };
    if ($('#trade')) $('#trade').onclick = requestTrade;
    if ($('#pcard')) $('#pcard').onclick = playerCard;
    scr().querySelectorAll('img[data-kit]').forEach(img => { const k = img.dataset.kit, key = `${C.team}|${k}|${C.me.num}|${JSON.stringify(C.me.look || {})}`;
      kitCache[key] = kitCache[key] || (!PB.noGL && PB.R.modelReady && PB.R.modelReady() ? PB.R.portrait(C.me, PB.team(C.team), 300, { body: true, kit: k, back: k === 'assoc' }) : null); if (kitCache[key]) img.src = kitCache[key]; });
    scr().querySelectorAll('.kitpick').forEach(b => b.onclick = () => { C.homeKit = b.dataset.k; save(); stay(); });
    if ($('#sim5')) $('#sim5').onclick = () => simMany(5);
    if ($('#simall')) $('#simall').onclick = () => simMany(999);
    if ($('#asg')) $('#asg').onclick = () => allStarGame(true);
    if ($('#asgsim')) $('#asgsim').onclick = () => allStarGame(false);
    if ($('#rise')) $('#rise').onclick = () => risingStars(true);
    if ($('#risesim')) $('#risesim').onclick = () => risingStars(false);
    scr().querySelectorAll('[data-ev]').forEach(b => b.onclick = () => eventPick(+b.dataset.ev));
    scr().querySelectorAll('[data-brand]').forEach(b => b.onclick = () => {
      const br = C.endorse.brands[+b.dataset.brand], i = C.endorse.offer, amt = [0.4, 1.2, 4, 10][i];
      C.endorse = { tier: i + 1, brand: br[0], color: br[1], pay: amt };
      me.look = me.look || {}; me.look.shoe = br[1]; me.look.shoePick = '';
      C.news.unshift(`${me.last} signs a shoe deal with ${br[0]}: ${M(amt)} a year`);
      C.feed.unshift({ who: '@' + br[0].toLowerCase(), text: `Welcome to the family, ${PB.full(me)}. Your colorway drops next week.` });
      save(); stay();
    });
    if ($('#nobrand')) $('#nobrand').onclick = () => { C.endorse.tier = (C.endorse.offer || 0) + 1; delete C.endorse.offer; delete C.endorse.brands; save(); hub(); };
    if ($('#lturn')) $('#lturn').onclick = () => { lookBack = !lookBack; const y0 = scr().scrollTop, y1 = window.scrollY; hub(); scr().scrollTop = y0; window.scrollTo(0, y1); };
    scr().querySelectorAll('[data-look] button').forEach(b => b.onclick = () => {
      const k = b.parentElement.dataset.look, v = b.dataset.v || null, tm = PB.team(C.team);
      me.look[k + 'Pick'] = v || '';
      me.look[k] = v === 'team' ? (k === 'shoe' ? tm.c1 : tm.c2 === '#f2f2f2' ? tm.c1 : tm.c2) : v;
      /* redraw in place: the preview changes, the page stays where it was */
      const y0 = scr().scrollTop, y1 = window.scrollY;
      save(); hub(); scr().scrollTop = y0; window.scrollTo(0, y1);
    });
    if ($('#practice')) $('#practice').onclick = () => {
      scr().hidden = true;
      const tm = PB.team(C.team);
      PB.Game.start({ teams: [tm, tm], rosters: [[C.me], []], userId: 'me', drill: 'combine', qlen: 1, level: S.level, floor: tm, onEnd: r => {
        const sc = r.drill ? r.drill.score : 0, sp = Math.round(Math.min(5, Math.floor(sc / 3)) * PB.clamp(20 / (C.len || 20), 0.3, 1.5));
        C.practiced = C.gi + (C.phase === 'playoffs' ? 1000 : 0); C.me.sp += sp;
        if (sc >= 8) C.trust = Math.min(100, C.trust + 1);
        save();
        show(`<div class="page post"><p class="kick">Team practice</p><div class="gradebig"><b>${sc}/15</b><span>spot-up shooting</span></div>
          <div class="card earn"><b>+${sp} skill points</b><span>${sc >= 8 ? 'The coach noticed. Trust +1.' : 'Get to eight makes and the coach takes notice.'}</span></div>
          <button class="big" id="go">Back to the team</button></div>`);
        $('#go').onclick = hub;
      } });
    };
    if ($('#coachok')) $('#coachok').onclick = () => { C.coachTalk = false; C.trust = Math.min(100, C.trust + 1); save(); hub(); };
    if ($('#coachmore')) $('#coachmore').onclick = () => {
      /* asking works when you've earned it, and costs you when you haven't */
      const s5 = C.games.filter(x => x.done).slice(-5), avgG = s5.reduce((a, x) => a + (x.res.gscore || 6), 0) / Math.max(1, s5.length);
      C.coachTalk = false;
      if (avgG >= 8.5) { C.trust = Math.min(100, C.trust + 8); C.news.unshift(`${C.me.last} asks the coach for more minutes, and gets them`); }
      else { C.trust = Math.max(0, C.trust - 6); C.news.unshift(`${C.me.last} asks for more minutes; the coach is not convinced`); }
      save(); stay();
    };
    if ($('#auto')) $('#auto').onclick = () => {
      /* spend on the attributes that count most at your position, cheapest first among those, up to each ceiling */
      const A = PB.ARCH[me.arch];
      const w = { PG: ['handle', 'pass', 'three', 'speed', 'mid', 'close'], SG: ['three', 'mid', 'close', 'speed', 'handle', 'perD'], SF: ['three', 'close', 'perD', 'dunk', 'mid', 'vert'],
        PF: ['close', 'reb', 'inD', 'dunk', 'block', 'mid'], C: ['close', 'reb', 'inD', 'block', 'dunk', 'vert'] }[me.pos];
      let spent = true;
      while (spent) {
        spent = false;
        const opts = w.filter(k => me.r[k] < A.cap[k] && cost(me.r[k]) <= me.sp).sort((a, b) => cost(me.r[a]) - cost(me.r[b]) || w.indexOf(a) - w.indexOf(b));
        if (opts.length) { const k = opts[0]; me.sp -= cost(me.r[k]); me.r[k]++; spent = true; }
      }
      me.ovr = PB.ovr(me.r, me.pos); save(); stay();
    };
    if ($('#simpi')) $('#simpi').onclick = () => { while (C.po.round < 2) simPlayoffRound(); hub(); };
    if ($('#simrd')) $('#simrd').onclick = () => { simPlayoffRound(); hub(); };
    if ($('#simpo')) $('#simpo').onclick = () => { while (!C.po.champ) simPlayoffRound(true); C.phase = 'awards'; save(); hub(); };
    scr().querySelectorAll('.bar.up button').forEach(b => b.onclick = () => {
      const k = b.dataset.k, c = cost(me.r[k]);
      if (me.sp < c) return;
      me.sp -= c; me.r[k]++; me.ovr = PB.ovr(me.r, me.pos); save(); stay();
    });
  }
  const kitCache = {};
  /* roster headshots: drawn a few at a time after the screen is up, then kept for the session */
  const headCache = {};
  function fillHeads() {
    const imgs = [...scr().querySelectorAll('img[data-head]')];
    if (!imgs.length || PB.noGL || !PB.R.modelReady || !PB.R.modelReady()) return;
    const who = id => id === 'me' ? C.me : myRoster().find(p => p.id === id);
    const step = () => {
      const img = imgs.shift(); if (!img) return;
      const p = who(img.dataset.head); if (!p) { step(); return; }
      const key = C.team + p.id + (p.me ? JSON.stringify(p.look || {}) + p.skin + p.num : '');
      if (!(key in headCache)) headCache[key] = PB.R.portrait(p, PB.team(C.team), 96, { close: true });
      if (headCache[key]) img.src = headCache[key];
      setTimeout(step, 0);
    };
    step();
  }
  /* your portrait, kept until your team or your look changes (not saved: it is quick to draw again) */
  let portraitCache = { key: '', url: null };
  function portrait() {
    if (PB.noGL || !PB.R.modelReady || !PB.R.modelReady()) return null;
    const key = C.team + JSON.stringify(C.me.look || {}) + C.me.skin + C.me.num;
    if (portraitCache.key !== key) portraitCache = { key, url: PB.R.portrait(C.me, PB.team(C.team), 320, { close: true }) };
    return portraitCache.url;
  }
  const matchCache = new Map();
  function matchShot(p, team) {
    if (PB.noGL || !PB.R.modelReady || !PB.R.modelReady() || !p) return null;
    const key = (p.id || p.last) + '|' + team.id;
    if (!matchCache.has(key)) { if (matchCache.size > 40) matchCache.clear(); matchCache.set(key, PB.R.portrait(p, team, 120, { close: true })); }
    return matchCache.get(key);
  }
  let bodyCache = { key: '', url: null }, lookBack = false;   // lookBack: the Look card is showing him from behind
  function bodyShot(look) {   // look: for the Look card, head to shoes (the shoes and socks are things you pick there), from the side you turned him to
    if (PB.noGL || !PB.R.modelReady || !PB.R.modelReady()) return null;
    const key = C.team + JSON.stringify(C.me.look || {}) + C.me.skin + C.me.num + (C.homeKit || '') + (look ? (lookBack ? 'b' : 'f') : '');
    if (bodyCache.key !== key) bodyCache = { key, url: PB.R.portrait(C.me, PB.team(C.team), 340, { body: true, tight: !look, kit: C.homeKit || 'icon', back: !!look && lookBack }) };
    return bodyCache.url;
  }
  /* your player card: a 1080 by 1350 image for a feed, in your team's colors */
  function playerCard() {
    const me = C.me, t = PB.team(C.team), A = C.adj && C.adj.gp ? C.adj : null, T = C.totals || {}, gp = A ? A.gp : 0;
    const cv = document.createElement('canvas'); cv.width = 1080; cv.height = 1350; const g = cv.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 0, 1350); grd.addColorStop(0, t.c1); grd.addColorStop(0.62, '#0b0e15'); grd.addColorStop(1, '#07090e');
    g.fillStyle = grd; g.fillRect(0, 0, 1080, 1350);
    g.fillStyle = 'rgba(255,255,255,.05)'; g.font = '900 420px Archivo, Arial'; g.textAlign = 'center'; g.fillText(String(me.num), 540, 560);
    const draw = img => {
      if (img) g.drawImage(img, 240, 90, 600, 600);
      g.textAlign = 'left'; g.fillStyle = '#fff';
      g.font = '900 92px Archivo, Arial'; g.fillText(me.first.toUpperCase(), 80, 800); g.fillText(me.last.toUpperCase(), 80, 892);
      g.font = '600 38px Inter, Arial'; g.fillStyle = '#c9d0de'; g.fillText(`#${me.num} · ${PB.POS_NAME[me.pos]} · ${t.city} ${t.name}`, 80, 952);
      g.textAlign = 'center'; g.fillStyle = '#ffffff'; g.beginPath(); g.arc(920, 820, 92, 0, 7); g.fill();
      g.fillStyle = '#000000'; g.font = '900 90px Archivo, Arial'; g.fillText(String(me.ovr), 920, 850); g.font = '800 24px Archivo, Arial'; g.fillText('OVERALL', 920, 884);
      const tile = (x, v, l) => { g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(x, 1010, 290, 150); g.fillStyle = '#fff'; g.font = '900 70px Archivo, Arial'; g.fillText(v, x + 145, 1092); g.fillStyle = '#c9d0de'; g.font = '700 26px Inter, Arial'; g.fillText(l, x + 145, 1136); };
      tile(80, gp ? (A.pts / gp).toFixed(1) : '–', 'POINTS'); tile(395, gp ? (A.reb / gp).toFixed(1) : '–', 'REBOUNDS'); tile(710, gp ? (A.ast / gp).toFixed(1) : '–', 'ASSISTS');
      g.fillStyle = '#c9d0de'; g.font = '600 30px Inter, Arial';
      g.fillText(`Season ${C.year} · ${C.trophies.length} trophies · ${T.pts || 0} career points · ${(C.fans || 0).toLocaleString()} followers`, 540, 1225);
      g.fillStyle = '#ffffff'; g.font = '900 34px Archivo, Arial'; g.fillText('POCKETBASKETBALL', 540, 1300);
      cv.toBlob(b => shareFile(b, 'my-player-card.png', 'My player'), 'image/png');
    };
    const url = !PB.noGL && PB.R.modelReady && PB.R.modelReady() ? PB.R.portrait(me, t, 600) : null;
    if (url) { const im = new Image(); im.onload = () => draw(im); im.onerror = () => draw(null); im.src = url; } else draw(null);
  }
  function shareFile(blob, name, title) {
    if (!blob) return;
    const file = window.File ? new File([blob], name, { type: blob.type }) : null;
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) { navigator.share({ files: [file], title }).catch(() => {}); return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  }
  const glog = (x, n) => `<div class="glog"><span>${n}</span>${badge(PB.team(x.opp))}
        <b class="${x.res.win ? 'w' : 'l'}">${x.res.win ? 'W' : 'L'} ${x.res.us}-${x.res.them}</b><em>${x.res.line.pts} pts · ${x.res.line.reb} reb · ${x.res.line.ast} ast</em><i>${x.res.grade}${x.res.sim ? ' · sim' : ''}</i></div>`;
  const fmtFans = n => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : String(Math.round(n));
  /* every team, by conference and division, two to a row: a stripe in its color, the city over the nickname */
  PB.teamGrid = () => ['East', 'West'].map(c => { const ts = PB.TEAMS.filter(t => t.conf === c), divs = [...new Set(ts.map(t => t.div))];
    return `<p class="kick conf">${c}ern Conference</p>` + divs.map(d => `<p class="kick dv">${esc(d || '')}</p><div class="tgrid">${ts.filter(t => t.div === d).map(t =>
      `<button class="trow tt" data-id="${t.id}" style="--tc:${t.c1}"><i></i><span><small>${esc(t.city)}</small><b>${esc(t.name)}</b></span><em>${esc(t.ab || t.id)}</em></button>`).join('')}</div>`).join(''); }).join('');
  let ltab = 'stand';   // the League tab's own two pages
  let muOpp = null;   // the man you guard next, for his card
  /* a player's card: a sheet from the bottom with the player standing in his uniform, what he is and what he is good at */
  function rosterCard(p, t, scout) {
    const old = document.querySelector('#plcard'); if (old) old.remove();
    const G4 = [['Scoring', ['close', 'dunk', 'mid', 'three', 'ft']], ['Playmaking', ['handle', 'pass']], ['Athleticism', ['speed', 'vert']], ['Defense', ['perD', 'inD', 'steal', 'block', 'reb']]];
    const avg = ks => Math.round(ks.reduce((a, k) => a + ((p.r || {})[k] || 0), 0) / ks.length);
    const best = PB.ATTRS.slice().sort((a, b) => ((p.r || {})[b[0]] || 0) - ((p.r || {})[a[0]] || 0)).slice(0, 3);
    let img = null; try { img = !PB.noGL && PB.R.modelReady && PB.R.modelReady() ? PB.R.portrait(p, t, 360, { body: true }) : null; } catch (e) { img = null; }
    const d = document.createElement('div'); d.id = 'plcard';
    d.innerHTML = `<div class="sheet" style="--tc:${t.c1}" role="dialog" aria-label="${esc(PB.full(p))}"><button class="x" aria-label="Close">×</button>
      <div class="top">${img ? `<img src="${img}" alt="">` : ''}<div><span>${esc(t.name)} · #${p.num}</span><h3>${esc(PB.full(p))}</h3>
        <p>${p.pos}${p.arch ? ' · ' + esc(p.arch) : ''} · ${PB.fmtH(p.ht)} · age ${p.age}</p>${p.from ? `<p>${esc(p.from)}</p>` : ''}<b>${p.ovr}<small>OVR</small></b></div></div>
      ${G4.map(([n, ks]) => `<div class="bar"><span>${n}</span><i><u style="width:${avg(ks)}%"></u></i><b>${avg(ks)}</b></div>`).join('')}
      <p class="kick">Best at</p><div class="chips">${best.map(([k, n]) => `<span>${n} <b>${(p.r || {})[k] || 0}</b></span>`).join('')}</div>
      ${scout ? (() => { const r = p.r || {}, tips = [];
        if (r.three >= 78) tips.push('Stay attached: he will shoot the three if you sag.');
        if (r.close >= 78 || r.dunk >= 78 || r.speed >= 82) tips.push('He wants the rim: get set in front of him early and cut him off.');
        if (r.handle < 66) tips.push('A loose handle: reach when Steal lights up.'); else if (r.handle >= 84) tips.push('He protects the ball: do not reach, slide.');
        if (r.mid >= 80 && tips.length < 3) tips.push('Jump on his pull-up: he is dangerous from the elbow.');
        if (!tips.length) tips.push('No one thing to take away: stay in front and contest.');
        return `<p class="kick">How to guard him</p>${tips.slice(0, 3).map(x => `<p class="tip">${x}</p>`).join('')}`; })() : ''}</div>`;
    document.body.appendChild(d);
    const close = () => { d.classList.remove('on'); setTimeout(() => d.remove(), 220); };
    d.onclick = e => { if (e.target === d || e.target.classList.contains('x')) close(); };
    requestAnimationFrame(() => d.classList.add('on'));
  }
  /* the title's mode cards: a line icon each */
  const mic = d => `<i class="mi"><svg viewBox="0 0 24 24" aria-hidden="true">${d}</svg></i>`;
  const MIC = { career: mic('<circle cx="12" cy="8" r="3.500"/><path d="M5 20c0-3.600 3.100-6 7-6s7 2.400 7 6"/>'), plus: mic('<path d="M12 5v14M5 12h14"/>'), list: mic('<path d="M8 7h11M8 12h11M8 17h11M4.500 7h.01M4.500 12h.01M4.500 17h.01"/>'),
    vs: mic('<path d="M4 7l3.500 10L11 7M20 8.500c-.700-1-1.800-1.500-3-1.500-1.700 0-3 1-3 2.400 0 3.100 6 1.600 6 4.900 0 1.500-1.400 2.700-3.200 2.700-1.400 0-2.600-.600-3.300-1.700"/>'),
    street: mic('<circle cx="12" cy="12" r="8"/><path d="M4 12h16M12 4c-2.400 2.200-3.600 4.900-3.600 8s1.200 5.800 3.600 8M12 4c2.400 2.200 3.600 4.900 3.600 8s-1.200 5.800-3.600 8"/>'),
    clock: mic('<circle cx="12" cy="12" r="8"/><path d="M12 7.500V12l3 2M4.500 5.500l2 2M19.500 5.500l-2 2"/>'),
    cup: mic('<path d="M7 4h10v4a5 5 0 0 1-10 0zM7 6H4c0 3 1.500 4.500 3.500 4.500M17 6h3c0 3-1.500 4.500-3.500 4.500M12 13v4M8.500 20h7"/>'),
    chat: mic('<path d="M5 6h14a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-7l-4 3.500V17H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2z"/>'),
    target: mic('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".800"/>'), day: mic('<rect x="4" y="5.500" width="16" height="14" rx="2.500"/><path d="M8 3.500v4M16 3.500v4M4 10.500h16M9 15l2 2 4-4"/>') };
  /* the hub's bottom bar: one line icon a tab */
  const NAVIC = { social: '<path d="M4 5h16v10h-7.500L8 19.500V15H4z"/>', home: '<path d="M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6h-6v6H5a1 1 0 0 1-1-1z"/>', team: '<circle cx="9" cy="9" r="3"/><circle cx="17" cy="10" r="2.3"/><path d="M3 19c0-3 2.7-5 6-5s6 2 6 5M15.5 14.2c2.800 0 5.500 1.500 5.500 4.300"/>',
    player: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-3.600 3.100-6 7-6s7 2.400 7 6"/>', league: '<path d="M7 4h10v4a5 5 0 0 1-10 0zM7 6H4c0 3 1.500 4.500 3.500 4.500M17 6h3c0 3-1.500 4.500-3.500 4.500M12 13v4M8.500 20h7"/>', log: '<path d="M5 19V9M10 19V5M15 19v-7M20 19v-11"/>' };
  const canUpgrade = () => { const A = PB.ARCH[C.me.arch]; return PB.ATTRS.some(([k]) => C.me.r[k] < A.cap[k] && cost(C.me.r[k]) <= C.me.sp); };
  const cost = v => v < 60 ? 1 : v < 70 ? 2 : v < 80 ? 3 : v < 90 ? 4 : 6;
  const LET = ['F', 'D-', 'D', 'D+', 'C-', 'C', 'C+', 'B-', 'B', 'B+', 'A-', 'A', 'A+'];
  const gradeAvg = v => LET[PB.clamp(Math.round(v), 0, 12)];
  const LOOK = {
    hair: [['short', 'Short'], ['fade', 'Fade'], ['high', 'High-top'], ['afro', 'Afro'], ['twists', 'Twists'], ['cornrows', 'Cornrows'], ['locs', 'Locs'], ['bun', 'Bun'], ['mohawk', 'Mohawk'], ['curly', 'Curly'], ['ponytail', 'Ponytail'], ['long', 'Long'], ['braids', 'Braids'], ['spiky', 'Spiky'], ['buzz', 'Buzz'], ['bald', 'Bald']],
    face: [[null, 'Classic'], ['1', 'Focused'], ['2', 'Bright'], ['3', 'Calm'], ['4', 'Bold'], ['5', 'Happy'], ['6', 'Stern'], ['7', 'Sleepy']],
    build: [[null, 'Regular'], ['slim', 'Slim'], ['strong', 'Strong'], ['big', 'Big']],
    hairColor: [['#17110d', 'Black'], ['#4a3020', 'Brown'], ['#c9a46a', 'Blond'], ['#9a3b1c', 'Red'], ['#d8d8d8', 'Silver'], ['#2f6bd8', 'Blue'], ['#e0489a', 'Pink'], ['#2fa56b', 'Green'], ['#f2efe6', 'Platinum', 7]],
    band: [[null, 'None'], ['#f2f2f2', 'White'], ['#111111', 'Black'], ['team', 'Team'], ['#ffd23f', 'Gold', 2], ['#c9ced6', 'Chrome', 5]],
    sleeve: [[null, 'None'], ['#111111', 'Black'], ['#f2f2f2', 'White'], ['team', 'Team'], ['#ffd23f', 'Gold', 2], ['#ff3b5c', 'Infrared', 4]],
    tee: [[null, 'None'], ['#f2f2f2', 'White'], ['#111111', 'Black'], ['team', 'Team']],
    bicep: [[null, 'None'], ['#f2f2f2', 'White'], ['#111111', 'Black'], ['team', 'Team']],
    socks: [[null, 'Crew'], ['high', 'High'], ['low', 'Low']],
    shoeStyle: [[null, 'Low'], ['1', 'High-top'], ['2', 'Two-tone'], ['3', 'Gum sole']],
    shoe: [[null, 'White'], ['#111111', 'Black'], ['team', 'Team'], ['#e63946', 'Red'], ['#ffd23f', 'Gold'], ['#c6f432', 'Volt', 1], ['#2f4fd8', 'Royal', 3], ['#ff3b5c', 'Infrared', 4], ['#c9ced6', 'Chrome', 5], ['#6b3fd8', 'MVP purple', 6], ['#9fe7ff', 'Diamond', 8]],
    beard: [[null, 'None'], ['stubble', 'Stubble'], ['goatee', 'Goatee'], ['full', 'Beard'], ['mustache', 'Mustache'], ['chinstrap', 'Chinstrap']],
    jumper: [[null, 'Standard'], ['quick', 'Quick'], ['high', 'High']],
    wrist: [[null, 'None'], ['#f2f2f2', 'White'], ['#111111', 'Black'], ['team', 'Team'], ['#ffd23f', 'Gold', 2]],
    legs: [[null, 'None'], ['one', 'Leg sleeve'], ['both', 'Both legs'], ['pads', 'Knee pads'], ['tights', 'Tights']],
    goggles: [[null, 'None'], ['black', 'Black'], ['team', 'Team']],
    tat: [[null, 'None'], [1, 'Arm band'], [2, 'Sleeve'], [3, 'Both'], [4, 'Forearm']],
    celeb: [[null, 'Mixed'], ['flex', 'Flex'], ['roar', 'Roar'], ['goggles', 'Goggles'], ['three', 'Three up'], ['point', 'Point'], ['chest', 'Chest'], ['shrug', 'Shrug'], ['toosmall', 'Too small'], ['ice', 'Ice veins'], ['nightnight', 'Night night'], ['shh', 'Shush'], ['wag', 'Finger wag'], ['thump', 'Chest thump']],
    dunk: [[null, 'Mixed'], ['dunk1', 'Tomahawk'], ['dunk2', 'Two-hand'], ['windmill', 'Windmill', 3]],
    drib: [[null, 'Standard'], ['low', 'Low, quick'], ['high', 'High, loose']],
  };
  function lookEditor(me) {
    me.look = me.look || { hair: 'short', hairColor: '#17110d', band: null, sleeve: null, shoe: null };
    const rk = C && C.me === me ? rankOf(C.fans).i : 9;   // (rank rewards unlock in a career; anywhere else everything is open)
    const row = (k, lbl) => `<div class="field"><label>${lbl}</label><div class="seg" data-look="${k}">${LOOK[k].map(([v, n, need]) => need && rk < need ? `<button class="lock" disabled title="Rank ${RANKS[need][0]}">🔒 ${n}<small>${RANKS[need][0]}</small></button>` : `<button data-v="${v === null ? '' : v}" class="${String(me.look[k + 'Pick'] ?? me.look[k] ?? '') === String(v === null ? '' : v) ? 'on' : ''}">${n}</button>`).join('')}</div></div>`;
    const head = t => `<p class="kick lookh">${t}</p>`;   // the card is long: it reads in four parts
    return head('Head') + row('face', 'Face') + row('hair', 'Hair') + row('hairColor', 'Hair color') + row('beard', 'Facial hair') + row('band', 'Headband') + row('goggles', 'Goggles')
      + head('Body') + row('build', 'Build') + row('tat', 'Tattoos')
      + head('Gear') + row('sleeve', 'Arm sleeve') + row('tee', 'Undershirt') + row('bicep', 'Bicep band') + row('wrist', 'Wristbands') + row('legs', 'Legs') + row('socks', 'Socks') + row('shoe', 'Shoes') + row('shoeStyle', 'Shoe cut')
      + head('Your game') + row('jumper', 'Jump shot (Quick: faster, a little less true · High: slower, harder to contest)') + row('drib', 'Dribble style') + row('dunk', 'Dunk') + row('celeb', 'Signature celebration') + '<p class="fine">Your look on the floor from your next game.</p>';
  }
  function badgeList() {
    return PB.BADGES.map(b => {
      const n = C.ct[b.stat] || 0, t = C.me.badges[b.k] || 0, nextAt = b.tiers[t];
      const pct = t >= 3 ? 100 : Math.min(100, Math.round(n / nextAt * 100));
      return `<div class="badge t${t}"><i>${t ? PB.TIER[t][0] : '·'}</i><div><b>${b.name}${t ? ` <small>${PB.TIER[t]}</small>` : ''}</b><span>${b.eff}</span>
        <u><s style="width:${pct}%"></s></u><em>${b.desc}: ${n}${t < 3 ? ` / ${nextAt}` : ' · maxed'}</em></div></div>`;
    }).join('');
  }

  /* ---------- social ----------
     Your account, the way the football game keeps one. Followers are C.fans. C.social holds your hype (0 to 100: it
     rises with good nights, posts and callouts you back up, and cools a little every game; the more of it you have,
     the faster your following grows), the followers game by game for the line on the page, the one post you may make
     each game, a callout of your next opponent that is still open, how many you have backed up and how many you have
     eaten, what you have said at the podium, and your messages. Made on first use, so older careers get it. */
  const gameNo = () => (C.totals && C.totals.gp) || 0;
  function social() {
    if (!C.social) C.social = { hype: PB.clamp(10 + Math.round(Math.log10(Math.max(1000, C.fans || 1000)) * 6 - 18), 5, 45), posted: -1, callout: null, backed: 0, ate: 0, quotes: [], hist: [], dms: [], dmKey: -1 };
    return C.social;
  }
  const handle = () => (C.me.last || 'rookie').toLowerCase().replace(/[^a-z]/g, '') + C.me.num;
  const OFFICIAL = /^@(league|local_scribe|highlight_reel|draftnerd|hoopstalk)$/;
  const isOfficial = w => OFFICIAL.test(w) || PB.TEAMS.some(t => w === '@' + t.name.toLowerCase()) || (C.endorse && C.endorse.brand && w === '@' + C.endorse.brand.toLowerCase());
  /* one post, drawn the way a timeline draws it: a face, a name, the words, and what it drew */
  function postCard(f, i, reply) {
    if (f.kind === 'trend') return `<div class="tpost trend"><b>${esc(f.text)}</b><small>${esc(f.sub || '')}</small></div>`;
    const mine = f.kind === 'me', tm = mine ? PB.team(C.team) : PB.TEAMS.find(t => f.who === '@' + t.name.toLowerCase()), ver = mine ? (C.fans || 0) >= 10000 : !!f.ver || isOfficial(f.who);
    const name = mine ? PB.full(C.me) : f.name || f.who.replace(/^@/, ''), at = mine ? '@' + handle() : f.name ? f.who : '', face = mine ? portrait() : null;
    let h = 0; for (const ch of f.who) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const av = face ? `<span class="pav pic" style="--c:${tm.c1}"><img alt="" src="${face}"></span>` : `<span class="pav" style="--c:${tm ? tm.c1 : f.col || `hsl(${h % 360} 8% ${22 + h % 16}%)`};color:${tm ? PB.ink(tm.c1, tm.c2) : '#fff'}">${esc((tm ? tm.ab || tm.id : name.replace(/[^A-Za-z]/g, '').slice(0, 2)).toUpperCase())}</span>`;
    const likes = (f.likes || 0) + (f.liked ? 1 : 0);
    return `<div class="tpost${reply ? ' re' : ''}${mine ? ' mine' : ''}${f.hot ? ' hot' : ''}">${av}<div class="pbody"><div class="phd"><b>${esc(name)}</b>${ver ? '<i class="ver" aria-label="verified"></i>' : ''}${at ? `<span>${esc(at)}</span>` : ''}</div>
      <p>${esc(f.text)}</p>${f.poll ? (f.poll.v == null ? `<div class="poll">${f.poll.o.map((o, k) => `<button data-vote="${i}" data-o="${k}">${esc(o[0])}</button>`).join('')}<small>${kfmt(f.poll.n)} votes · tap to vote</small></div>` : `<div class="poll done">${f.poll.o.map((o, k) => `<div class="${k === f.poll.v ? 'me' : ''}"><i style="width:${o[1]}%"></i><span>${esc(o[0])}</span><b>${o[1]}%</b></div>`).join('')}<small>${kfmt(f.poll.n)} votes</small></div>`) : ''}${reply ? '' : `<div class="pmeta"><span>↩ ${kfmt(f.re || 0)}</span><span>⇄ ${kfmt(f.rt ?? Math.round((f.likes || 0) * 0.14))}</span><button class="flike${f.liked ? ' on' : ''}" data-like="${i}" aria-label="Like"><i>${f.liked ? '♥' : '♡'}</i>${kfmt(likes)}</button>${f.hot ? '<em>viral</em>' : ''}</div>`}
      ${f.replies && f.replies.length && !reply ? `<div class="reps">${f.replies.map(r => postCard(r, -1, true)).join('')}</div>` : ''}</div></div>`;
  }
  /* a post from your own account; k scales the attention it gets */
  function myPost(text, k) {
    const f = C.fans || 0;
    return { who: '@' + handle(), kind: 'me', text, likes: Math.round(f * 0.07 * k) + 20, rt: Math.round(f * 0.012 * k) + 3, re: Math.round(f * 0.006 * k) + 2 };
  }
  const fanHandle = () => '@' + FANS[Math.floor(PB.rand() * FANS.length)];
  const mateOf = () => { const L = myRoster().filter(p => p.id !== C.me.id).sort((a, b) => b.ovr - a.ovr); return L[Math.floor(PB.rand() * Math.min(5, L.length))] || null; };
  const mateHandle = m => '@' + (m.last || '').toLowerCase().replace(/[^a-z]/g, '') + m.num;
  /* once a game: thanks to the fans (followers), talking up the next one (hype), a word for a teammate (the coach
     likes it), or a picture; two replies come under it */
  function socialPost(kind) {
    const so = social(), t = PB.team(C.team), nx = nextGame(), next = nx ? PB.team(nx.opp) : null, last = C.games.slice(0, C.gi).filter(x => x.done && x.res).pop(), won = last && last.res.win, mate = mateOf();
    if (so.posted === gameNo()) return;
    const text = kind === 'pic' ? say('Locked in.', 'Office hours.', next ? `${next.name} next.` : 'Back to work.', `${t.city}.`, 'Dressed for it.', won ? 'Good night at the office.' : 'Back to it.')
      : kind === 'fans' ? say(`${t.city}, I hear you every single night. Thank you.`, 'Best fans in the league. Not close.', won ? 'That one was for everybody in the building.' : 'We owe you a better one. You will get it.')
      : kind === 'hype' ? say(next ? `${next.name} next. Circle it.` : 'The work does not stop.', next ? `Cannot wait for ${next.city}. Bring the noise.` : 'Offseason? What offseason.', 'Locked in. That is the post.')
      : mate ? say(`Nobody works like #${mate.num}. ${PB.full(mate)}, that is my guy.`, `Shout out ${PB.full(mate)}. Makes my job easy.`, `${PB.full(mate)} does the dirty work every night. Put some respect on it.`) : 'Love this locker room.';
    const up = Math.round((C.fans || 0) * (kind === 'fans' ? 0.02 : kind === 'pic' ? 0.015 : 0.01)) + (kind === 'fans' ? 40 : 25);
    C.fans = (C.fans || 0) + up; so.hype = PB.clamp(so.hype + (kind === 'hype' ? 7 : kind === 'fans' || kind === 'pic' ? 3 : 1), 0, 100);
    if (kind === 'mate') C.trust = PB.clamp((C.trust ?? 50) + 1, 0, 100);
    const fan = { who: fanHandle(), text: kind === 'hype' ? say('LET US GO', 'Inject this into my veins.', 'Tip-off cannot come soon enough.') : kind === 'fans' ? say('We ride with you.', 'This is why he is my favorite player.', 'Class act.') : kind === 'pic' ? say('Hardest fit in the league.', 'Wallpaper. Done.', 'HIM.') : say('Good teammate. Love to see it.', 'The locker room is right.', 'That is leadership.') };
    const reply = mate ? { who: mateHandle(mate), name: PB.full(mate), ver: true, col: t.c1, text: kind === 'mate' ? say('Right back at you.', 'Appreciate you, brother.', 'Just doing my job.') : say('Facts.', 'Say it louder.', 'Let us work.') } : null;
    C.feed.unshift(Object.assign(myPost(text, kind === 'pic' ? 1.4 : 1), { replies: reply ? [fan, reply] : [fan] })); C.feed = C.feed.slice(0, 30);
    so.posted = gameNo(); save();
    achToast && PB.Game && PB.Game.toast; PB.audio && PB.audio.play && PB.audio.play('click');
    const y = scr().scrollTop; hub(); scr().scrollTop = y;
  }
  /* ---------- abilities ----------
     Bought with skill points, kept for good, and equipped a few at a time: one slot to start, a second at 70 overall,
     a third at 80. Most make one kind of badge count for more; three have an effect of their own (data.js PB.PERKS). */
  const perks = () => { const me = C.me; if (!me.perks) me.perks = { own: [], on: [] }; const n = PB.perkSlots(me); me.perks.on = me.perks.on.filter(id => PB.PERKS[id] && me.perks.own.includes(id)).slice(0, n); return me.perks; };
  function perkCard() {
    const K = perks(), me = C.me, n = PB.perkSlots(me), cost = PB.PERK_COST;
    return `<div class="card perks"><h3>Abilities <small>${K.on.length} of ${n} equipped · ${me.sp} SP</small></h3>
      <p class="fine">${n < 3 ? `A ${n === 1 ? 'second' : 'third'} slot opens at ${n === 1 ? 70 : 80} overall. ` : ''}Each costs ${cost} skill points once and is yours for good. Tap one you own to equip it or take it off.</p>
      <div class="perkg">${Object.keys(PB.PERKS).map(id => { const m = PB.PERKS[id], own = K.own.includes(id), on = K.on.includes(id);
        return `<button class="perk${on ? ' on' : own ? ' own' : ''}" data-perk="${id}"${!own && me.sp < cost ? ' disabled' : ''}><b>${esc(m.name)}</b><span>${esc(m.desc)}</span><em>${on ? 'Equipped' : own ? 'Tap to equip' : `Unlock · ${cost} SP`}</em></button>`; }).join('')}</div></div>`;
  }
  function perkTap(id) {
    const K = perks(), me = C.me, n = PB.perkSlots(me); if (!PB.PERKS[id]) return;
    if (!K.own.includes(id)) { if (me.sp < PB.PERK_COST) return; me.sp -= PB.PERK_COST; K.own.push(id); if (K.on.length < n) K.on.push(id); C.news.unshift(`${me.last} learns a new ability: ${PB.PERKS[id].name}`); }
    else if (K.on.includes(id)) K.on = K.on.filter(x => x !== id);
    else { if (K.on.length >= n) K.on.shift(); K.on.push(id); }   // the slots are full: the one equipped longest makes way
    save(); const y = scr().scrollTop; hub(); scr().scrollTop = y;
  }

  /* ---------- chemistry ----------
     With the teammate you work with most: a point guard and his best big, everybody else and the point guard. 0 to 100,
     50 when you meet. It grows with baskets one of you makes off the other's pass, with winning, and with what you
     do between games, and slips a little when a game goes by without the two of you connecting. In a game he looks
     for you sooner the higher it is, and a shot off each other's pass goes in a little more often above 50. A new
     partner, at 50, after a trade or when he leaves. */
  function partner() {
    if (!C.team) return null;
    const me = C.me, ro = myRoster().filter(p => p.id !== me.id), K = C.chem || (C.chem = { id: null, v: 50, team: C.team });
    let p = K.team === C.team ? ro.find(x => x.id === K.id) : null;
    if (!p) { const five = starters(C.team).filter(x => x.id !== me.id), want = me.pos === 'PG' ? ['C', 'PF'] : ['PG'];
      p = five.filter(x => want.includes(x.pos)).sort((a, b) => b.ovr - a.ovr)[0] || five.sort((a, b) => b.ovr - a.ovr)[0] || ro[0]; if (!p) return null;
      K.id = p.id; K.v = 50; K.team = C.team; }
    return p;
  }
  const chemTier = v => v >= 80 ? 'Elite' : v >= 62 ? 'In sync' : v >= 40 ? 'Building' : 'Off';
  function chemAdd(n) { if (!partner()) return 0; const was = C.chem.v; C.chem.v = PB.clamp(Math.round(C.chem.v + n), 0, 100); return C.chem.v - was; }
  function chemCard() {
    const p = partner(); if (!p) return ''; const v = C.chem.v, t = PB.team(C.team);
    return `<div class="card chem" style="--tc:${t.c1}"><h3>Chemistry <small>${chemTier(v)}</small></h3><div class="chemrow"><img alt="" data-head="${esc(p.id)}"><div><b>${esc(PB.full(p))}</b><span>${p.pos} · ${p.ovr} OVR · ${C.me.pos === 'PG' ? 'your big' : p.pos === 'PG' ? 'your point guard' : 'your running mate'}</span></div><em>${v}</em></div>
      <div class="hypebar"><i style="width:${v}%"></i></div><p class="fine">It grows with baskets one of you makes off the other's pass, and with winning. The higher it is, the sooner he looks for you; above 50 a shot off each other's pass goes in a little more often.</p></div>`;
  }

  /* ---------- media day ----------
     Before a game against your rival the cameras are set up: three questions, three ways to answer each (humble: the
     coach likes it; confident: a little of everything; brash: hype and followers, and the coach winces). What you
     say goes on the record, and your rival answers the loudest of it. Once for each rival game. */
  function mediaDay() {
    const so = social(), rv = rivalP(), rt = PB.team(C.rival.team), me = C.me, h = C.rival.h2h || [0, 0];
    const QS = [
      [`${PB.full(rv)} went ${ordinal(C.rival.pick)} in your draft. ${C.pick ? `You went ${ordinal(C.pick)}.` : 'You were not drafted.'} Who is the better player today?`,
        [['He is a great player. I worry about my own team.', 2, 1, 0, 'humble'], ['Ask me after the game.', 0, 5, 1, 'confident'], [C.pick && C.pick < C.rival.pick ? 'They picked me first for a reason.' : 'Draft night was a long time ago. Watch the game.', -3, 10, 3, 'brash']]],
      [h[0] + h[1] ? `You are ${h[0]}-${h[1]} against him. What does that record tell you?` : 'First time you two meet as pros. What should people expect?',
        [['Nothing. Every game is new.', 2, 0, 0, 'humble'], ['That it is a good matchup. I like those.', 1, 4, 1, 'confident'], [h[0] > h[1] ? 'It tells you what it looks like.' : 'That the next one is mine.', -2, 9, 3, 'brash']]],
      [`Anything to say to the fans in ${rt.city}?`,
        [['They love their team. I respect that.', 1, 1, 1, 'humble'], ['Come early. It will be worth the ticket.', 0, 6, 2, 'confident'], ['Bring earplugs. It gets quiet when I get going.', -3, 11, 4, 'brash']]]];
    const picks = [], fans0 = C.fans || 0, trust0 = C.trust, hype0 = so.hype;
    const ask = i => {
      if (i >= QS.length) {
        so.mday = gameNo();
        const loud = picks.slice().sort((a, b) => b[2] - a[2])[0];
        C.feed.unshift({ who: '@local_scribe', text: `${me.last} at media day: "${loud[0]}"`, likes: Math.round(fans0 * 0.01) + 20, re: 9 });
        if (loud[4] === 'brash') C.feed.unshift({ who: '@' + (rv.first + rv.last).toLowerCase().replace(/[^a-z]/g, ''), name: PB.full(rv), ver: true, col: rt.c1, text: say('Noted.', 'Talk is free. See you on the floor.', 'Saving this one.'), likes: Math.round(fans0 * 0.02) + 40, re: 22, hot: true });
        save();
        show(`<div class="page post"><p class="kick">Media day</p><h2>On the record</h2><div class="card">${picks.map(a => `<p class="q">“${esc(a[0])}”</p><p class="fine">the ${a[4]} answer</p>`).join('')}</div>
          <div class="card earn"><b>Coach trust ${C.trust - trust0 >= 0 ? '+' : '−'}${Math.abs(Math.round(C.trust - trust0))} · hype ${so.hype - hype0 >= 0 ? '+' : '−'}${Math.abs(so.hype - hype0)} · followers +${fmtFans(Math.max(0, (C.fans || 0) - fans0))}</b><span>Now go and play the game.</span></div><button class="big" id="go">Back to the team</button></div>`);
        $('#go').onclick = hub; return; }
      const [q, ans] = QS[i];
      show(`<div class="page post"><p class="kick">Media day · ${i + 1} of ${QS.length}</p><div class="card" style="border-top:4px solid ${rt.c1}"><p class="mute">${badge(rt)} Before the ${esc(rt.name)}</p><h3>“${esc(q)}”</h3></div>
        ${ans.map((a, k) => `<button class="ghost ans" data-k="${k}">${esc(a[0])}<small>${a[4]}</small></button>`).join('')}</div>`);
      scr().querySelectorAll('.ans').forEach(b => b.onclick = () => { const a = ans[+b.dataset.k]; picks.push(a);
        C.trust = PB.clamp((C.trust ?? 50) + a[1], 0, 100); so.hype = PB.clamp(so.hype + a[2], 0, 100); C.fans = Math.round((C.fans || 0) * (1 + a[3] / 100));
        so.quotes.unshift({ q: a[0], tone: a[4], wk: `Season ${C.year} · media day, ${rt.name}` }); so.quotes = so.quotes.slice(0, 20); ask(i + 1); });
    };
    ask(0);
  }

  /* ---------- partners ----------
     Two games in a row that end with your hype at 55 or more bring an offer from a brand: skill points to sign, and one
     more every game while the deal lasts. Two deals at most. An offer left alone is gone after two games, and a brand
     walks away when your hype falls under 25. The brands are invented. (The shoe deal is its own thing: it follows
     your following, and is kept on the same page.) */
  const BRANDS = [['Tipoff Energy', 'sports drinks', '#1f8a5b', 'Fuel for four quarters.'], ['Northfield Motors', 'trucks', '#8a3b3b', 'Tough enough for the long haul.'], ['Crisp Co.', 'chips', '#b4531a', 'Game night tastes better.'],
    ['Volt Mobile', 'phones', '#6b3fd4', 'Never miss a moment.'], ['Ironhouse Gym', 'gyms', '#475569', 'Earned, not given.'], ['Ridgeline Watches', 'watches', '#0f766e', 'Every second counts.'], ['Bluepeak Insurance', 'insurance', '#1d4ed8', 'Protection you can count on.'], ['Hardwood Audio', 'headphones', '#27272a', 'Tune the noise out.']];
  const brandPost = (b, text) => ({ who: '@' + b.name.toLowerCase().replace(/[^a-z]/g, ''), name: b.name, ver: true, col: b.col, text, likes: Math.round((C.fans || 0) * 0.02) + 30, re: 6 });
  function dealsAfter() {
    const so = social(); so.deals = so.deals || [];
    for (const d of so.deals) C.me.sp += 1;
    if (so.deals.length && so.hype < 25) { const d = so.deals.pop(); C.news.unshift(`${d.name} ends its deal with ${C.me.last}`); C.feed.unshift(brandPost(d, `${d.name} and ${PB.full(C.me)} have parted ways. We wish him well.`)); }
    so.hot = so.hype >= 55 ? (so.hot || 0) + 1 : 0;
    if (so.offer && ++so.offer.age > 2) so.offer = null;
    if (!so.offer && so.hot >= 2 && so.deals.length < 2) { const left = BRANDS.filter(b => !so.deals.some(d => d.name === b[0])), b = left[Math.floor(PB.rand() * left.length)]; so.offer = { name: b[0], kind: b[1], col: b[2], line: b[3], age: 0, sign: 3 }; so.hot = 0; C.news.unshift(`${b[0]} wants ${C.me.last}`); }
  }
  function dealAnswer(yes) {
    const so = social(), o = so.offer; if (!o) return;
    if (yes) { (so.deals = so.deals || []).push({ name: o.name, kind: o.kind, col: o.col }); C.me.sp += o.sign; C.fans = Math.round((C.fans || 0) * 1.02) + 200;
      C.feed.unshift(brandPost(o, `Welcome to the ${o.name} family, ${PB.full(C.me)}. ${o.line}`), Object.assign(myPost(`Proud to be with ${o.name}.`, 1.2), {})); C.news.unshift(`${C.me.last} signs with ${o.name} (+${o.sign} skill points, and one more every game)`); }
    so.offer = null; save(); const y = scr().scrollTop; hub(); scr().scrollTop = y;
  }
  const offerHtml = () => { const o = social().offer; return o ? `<div class="callout offer"><small>An offer · ${esc(o.kind)}</small><b><i class="sw" style="background:${o.col}"></i>${esc(o.name)}</b> wants you. “${esc(o.line)}”<br>+${o.sign} skill points to sign, and +1 every game while it lasts. They walk if your hype falls under 25.${o.age ? ' Last chance: the offer is gone after your next game.' : ''}<div class="seg wrapseg"><button data-of="y">Sign</button><button data-of="n">Pass</button></div></div>` : ''; };

  /* calling out the next opponent: talk (win and play well) or a guarantee (win). Backed up, it pays in skill points,
     followers and hype; eaten, it costs you the coach's trust and your hype, and the internet does not forget */
  const CALL_SP = { trash: 2, guarantee: 3 };
  function callOut(kind) {
    const so = social(), nx = nextGame(); if (!nx || so.callout) return;
    const o = PB.team(nx.opp), quote = kind === 'guarantee' ? say(`We are beating ${o.city}. Write it down.`, `${o.name}? That is a win. I guarantee it.`) : say(`${o.city} has not seen me yet.`, `Tell the ${o.name} I am coming.`, `I like our chances against anybody. Especially them.`);
    so.callout = { kind, opp: nx.opp, quote, at: gameNo() }; so.hype = PB.clamp(so.hype + (kind === 'guarantee' ? 9 : 6), 0, 100); C.fans = Math.round((C.fans || 0) * 1.015) + 60;
    C.feed.unshift(Object.assign(myPost(quote, 1.8), { hot: true, replies: [{ who: '@' + o.name.toLowerCase(), text: say('Noted.', 'See you on the floor.', 'Bulletin board material. Thank you.') }, { who: fanHandle(), text: say('He said WHAT', 'Oh this is going to be good.', 'Screenshotting this.') }] }));
    so.quotes.unshift({ q: quote, tone: kind === 'guarantee' ? 'guarantee' : 'brash', wk: `Season ${C.year}, before the ${o.name}` }); so.quotes = so.quotes.slice(0, 20);
    save(); const y = scr().scrollTop; hub(); scr().scrollTop = y;
  }
  /* after any game of yours: the callout settled, hype moved, the following counted, messages waiting */
  function socialAfter(g, res) {
    const so = social(), me = C.me, o = PB.team(g.opp), c = so.callout;
    if (c && c.opp === g.opp) {
      const ok = c.kind === 'guarantee' ? res.win : res.win && res.gscore >= 8;
      if (ok) { so.backed++; me.sp += CALL_SP[c.kind]; C.fans = Math.round((C.fans || 0) * (c.kind === 'guarantee' ? 1.08 : 1.05)) + 300; so.hype = PB.clamp(so.hype + 12, 0, 100);
        C.news.unshift(`${me.last} backs it up against the ${o.name} (+${CALL_SP[c.kind]} skill points)`);
        C.feed.unshift({ who: fanHandle(), text: say(`${me.last} said it, then did it.`, `He CALLED it. And then he went and did it.`), likes: Math.round((C.fans || 0) * 0.02) + 30, re: 12, hot: true }, { who: '@hoopstalk', text: `"${c.quote}" He was right.`, likes: Math.round((C.fans || 0) * 0.012) + 18, re: 6 }); }
      else { so.ate++; C.trust = PB.clamp((C.trust ?? 50) - 4, 0, 100); so.hype = PB.clamp(so.hype - 14, 0, 100); C.fans = Math.round((C.fans || 0) * 0.985);
        C.news.unshift(`${me.last} talked before the ${o.name} game, and it did not go his way`);
        C.feed.unshift({ who: '@' + o.name.toLowerCase(), text: `"${c.quote}"`, likes: Math.round((C.fans || 0) * 0.03) + 60, re: 40, hot: true }, { who: fanHandle(), text: say('This aged like milk.', 'Maybe do the talking after next time.', 'Screenshot was worth it.'), likes: Math.round((C.fans || 0) * 0.01) + 20, re: 5 }); }
      so.lastCall = { ok, kind: c.kind, opp: g.opp }; so.callout = null;
    } else if (c && gameNo() - c.at > 3) so.callout = null;
    /* hype: a good night adds, a bad one costs, and it cools a little every game; a loud following grows faster */
    so.hype = PB.clamp(so.hype + (res.sim ? 0 : res.gscore >= 10 ? 7 : res.gscore >= 8 ? 4 : res.gscore <= 3 ? -6 : 0) + (res.win ? 1 : 0) + ((res.line.pts || 0) >= 30 ? 5 : 0) - 2, 0, 100);
    C.fans = Math.round((C.fans || 0) * (1 + so.hype / 100 * 0.012));
    so.hist = (so.hist || []).concat(C.fans).slice(-14);
    dealsAfter();
    C.feed = C.feed.slice(0, 30);
  }
  /* three messages about your last game: from home, from your agent, from a teammate; your rival before you meet him */
  function dms() {
    const so = social(); if (so.dmKey === gameNo()) return so.dms || [];
    const last = C.games.slice(0, C.gi).filter(x => x.done && x.res).pop(), nx = nextGame(), mate = mateOf(), wk = `Season ${C.year} · game ${C.gi + 1}`, out = [], ag = C.agent || (C.agent = PB.randName()), P = C.path;
    if (last) { const won = last.res.win, good = last.res.gscore >= 8, pts = last.res.line.pts || 0;
      out.push({ from: 'Mom', text: won ? say('We watched the whole thing. Your father yelled at the television all fourth quarter. So proud of you.', 'A win! Call me when you are home. And eat something.') : say('Tough one, honey. You will get them next time. Call your mother.', 'Do not read the comments tonight. We love you.') });
      out.push({ from: ag, role: 'Your agent', text: good ? say(`Grade ${last.res.grade} on the film. Nights like that are how the next contract gets written.`, pts >= 20 ? `${pts} points. My phone has not stopped.` : 'Phones are ringing after that one. Keep stacking them.') : P === 'undrafted' && C.contract && C.contract.kind === 'Two-way deal' ? 'Two-way players do not get many bad nights. Give me one to sell.' : say('Flush it. One game does not change what teams think of you.', 'Quiet night on my end. Give me something to sell next time.') });
      if (mate) out.push({ from: PB.full(mate), text: won ? say('Told you we had them. Film at eight, do not be late.', 'That is how it is supposed to look. Same thing next game.') : say('We are better than that. Extra work tomorrow, you in?', 'On to the next. I got your back.') });
    } else {
      out.push({ from: 'Mom', text: P === 'undrafted' ? 'They did not call your name. I do not care. You made a team. We will be watching every minute you play.' : 'First game this week! We will be watching. Drink water.' });
      out.push({ from: ag, role: 'Your agent', text: P === 'top' ? 'Everybody is watching the top pick. Good. Give them something to watch.' : P === 'undrafted' ? 'You are on a roster. That was the hard part. Now make it impossible to cut you.' : 'Welcome to the league. Play well and the rest takes care of itself.' });
      if (mate) out.push({ from: PB.full(mate), text: 'Rookie. Playbook. Tonight. See you at the gym.' });
    }
    const rv = rivalP(); if (nx && rv && C.rival && nx.opp === C.rival.team) out.unshift({ from: PB.full(rv), rival: true, text: say('See you on the floor. Bring your best, you will need it.', 'Hope you are ready. I am.') });
    for (const m of out) m.wk = wk;
    so.dms = out.concat(so.dms || []).slice(0, 12); so.dmKey = gameNo(); save();
    return so.dms;
  }
  /* followers over the last games, as a line: drawn once there are a few to join */
  function folTrend(so) {
    const h = (so.hist || []).slice(-13).concat(C.fans || 0); if (h.length < 3) return '';
    const lo = Math.min(...h), hi = Math.max(...h), W = 300, H = 40, pt = (v, i) => `${(i / (h.length - 1) * W).toFixed(1)},${(H - 4 - (hi > lo ? (v - lo) / (hi - lo) : 0.5) * (H - 8)).toFixed(1)}`;
    return `<div class="ftr"><small>Followers · last ${h.length - 1} games</small><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Followers from ${fmtFans(h[0])} to ${fmtFans(h[h.length - 1])}"><polyline points="${h.map(pt).join(' ')}"/></svg><span>${fmtFans(h[0])}</span><span>${fmtFans(h[h.length - 1])}</span></div>`;
  }
  let socTab = 'feed', socAll = false;
  function tabSocial() {
    const so = social(), me = C.me, t = PB.team(C.team), ver = (C.fans || 0) >= 10000, nx = nextGame(), next = nx ? PB.team(nx.opp) : null, face = portrait(), c = so.callout;
    const partners = [C.endorse && C.endorse.brand ? [C.endorse.brand, 'Signature shoe', C.endorse.color || '#fff', `${M(C.endorse.pay)} a year`] : null].concat((so.deals || []).map(d => [d.name, d.kind, d.col, '+1 skill point a game'])).filter(Boolean);
    const st = (k, l, n) => `<button data-st="${k}" class="${socTab === k ? 'on' : ''}">${l}${n ? `<i>${n}</i>` : ''}</button>`;
    const list = socAll ? C.feed : C.feed.slice(0, 8);
    let body;
    if (socTab === 'feed') body = C.feed.length ? `<div class="feedl">${list.map(f => postCard(f, C.feed.indexOf(f))).join('')}</div>${C.feed.length > 8 ? `<button class="ghost fmore" id="socall">${socAll ? 'Show fewer' : `Show all ${C.feed.length} posts`}</button>` : ''}` : '<p class="fine">Play a game and the internet will have something to say.</p>';
    else if (socTab === 'dm') body = `<div class="chat">${dms().map(m => `<div class="msg${m.rival ? ' rv' : ''}"><span class="pav" style="--c:${m.from === 'Mom' ? '#5a3a4a' : m.rival && C.rival ? PB.team(C.rival.team).c1 : m.role ? '#3a3f4a' : t.c1}">${esc(m.role ? 'AG' : m.from.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase())}</span><div><b>${esc(m.from)}${m.role ? ` <u>${esc(m.role)}</u>` : m.rival ? ' <u>Your rival</u>' : ''}<small>${esc(m.wk || '')}</small></b><p>${esc(m.text)}</p></div></div>`).join('')}</div>`;
    else if (socTab === 'rec') body = so.quotes.length ? `<ul class="quotes">${so.quotes.map(q => `<li><span class="tone">${esc(q.tone || '')}</span>“${esc(q.q)}”<small>${esc(q.wk || '')}</small></li>`).join('')}</ul>` : '<p class="fine">What you say at the podium, and every callout, is kept here.</p>';
    else body = (partners.length ? partners.map(x => `<div class="deal"><span><i class="sw" style="background:${x[2]}"></i>${esc(x[0])} · ${esc(x[1])}</span><b>${esc(x[3])}</b></div>`).join('') : '<p class="fine">No partners yet.</p>') + '<p class="fine">Two games in a row with your hype at 55 or more bring an offer from a brand: it pays a skill point every game until your hype falls under 25. Two at most. A shoe deal is separate: it comes as your following grows.</p>';
    return `<div class="sprof" style="--c:${t.c1}">${face ? `<span class="pav pic big" style="--c:${t.c1}"><img alt="" src="${face}"></span>` : `<span class="pav big" style="--c:${t.c1};color:${PB.ink(t.c1, t.c2)}">${esc(me.last.slice(0, 2).toUpperCase())}</span>`}<div><b>${esc(PB.full(me))}${ver ? '<i class="ver" aria-label="verified"></i>' : ''}</b><span>@${esc(handle())} · ${esc(t.name)} ${me.pos} #${me.num}</span></div></div>
      <div class="sstats"><div><b>${fmtFans(C.fans || 0)}</b><span>Followers</span></div><div><b>${so.hype}</b><span>Hype</span></div><div><b>${so.backed}–${so.ate}</b><span>Callouts</span></div><div><b>${partners.length}</b><span>Partners</span></div></div>
      <div class="hypebar"><i style="width:${so.hype}%"></i></div><div class="hypek"><span style="left:25%">25 · partners stay</span><span style="left:55%">55 · offers come</span></div><p class="fine hypen">Hype rises with good nights, posts and callouts you back up, and cools a little every game. The more you have, the faster your following grows.</p>
      ${folTrend(so)}
      ${offerHtml()}
      ${c ? `<p class="callout"><small>${c.kind === 'guarantee' ? 'Your guarantee' : 'Your callout'} · ${esc(PB.team(c.opp).name)}</small>“${esc(c.quote)}”<br>${c.kind === 'guarantee' ? 'Win that game' : 'Win and play well (a B or better)'}: +${CALL_SP[c.kind]} skill points. Lose and it costs you the coach's trust and your hype.</p>` : so.lastCall && so.lastCall.shown !== gameNo() ? `<p class="callout ${so.lastCall.ok ? 'ok' : 'no'}"><small>${so.lastCall.ok ? 'Backed it up' : 'Ate it'}</small>${so.lastCall.ok ? `You called out the ${esc(PB.team(so.lastCall.opp).name)} and delivered.` : `You called out the ${esc(PB.team(so.lastCall.opp).name)}. They saved the screenshot.`}</p>` : ''}
      ${so.posted !== gameNo() ? `<div class="spost"><small>Post something · once a game</small><div class="seg wrapseg"><button data-sp="fans">Thank the fans</button><button data-sp="hype">${next ? 'Hype the next game' : 'Stay hungry'}</button><button data-sp="mate">Shout out a teammate</button><button data-sp="pic">Post a photo</button></div></div>` : '<p class="fine posted">Posted. Your next post is after your next game.</p>'}
      ${next && !c ? `<div class="spost"><small>Call out the ${esc(next.name)}</small><div class="seg wrapseg"><button data-co="trash">Talk a little</button><button data-co="guarantee">Guarantee the win</button></div></div>` : ''}
      <div class="stabs soct">${st('feed', 'Mentions')}${st('dm', 'Messages')}${st('rec', 'On the record')}${st('deals', 'Partners')}</div>${body}`;
  }

  /* ---------- cutscenes ----------
     A scene is a list of beats. A beat has a line across the top (k), sometimes a headline (big), somebody speaking
     (who) and what is said (t), and may stand a player on the floor behind the words (model, in team's colors). The
     words type themselves out; a tap finishes the line, the next tap moves on; Skip ends the scene. */
  function cut(beats, done, o) {
    beats = beats.filter(Boolean); o = o || {};
    if (navigator.webdriver && !window.PBforceCut) { done(); return; }   // the test tools drive the menus by their buttons: no scenes for them unless they ask
    const can = !PB.noGL && PB.R && PB.R.modelReady && PB.R.modelReady(), shots = {};
    const PROSPECT = { id: 'prospect', c1: '#f2f2f2', c2: '#141416', name: 'PROSPECT', city: 'Prospect' }, SUIT = { c1: '#23262d', c2: '#23262d', alt: '#23262d', pat: 0, name: '', shorts: '#1b1d22', sock: '#15171a', shoe: '#111111', ref: 2 };
    /* the people who are not players (your agent, the coach, the commissioner): a figure in a dark suit, the same one every time that name speaks */
    const suit = name => { let h = 0; for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return { id: 'suit' + h, first: '', last: name, pos: 'SF', ht: 73 + h % 5, skin: h % 6, num: 0, r: {},
      look: { hair: ['short', 'buzz', 'fade', 'bald', 'short', 'curly'][(h >> 3) % 6], hairColor: ['#17110d', '#2b1d12', '#8d8d8d', '#17110d'][(h >> 6) % 4], beard: [null, 'stubble', null, 'goatee', 'full'][(h >> 9) % 5], face: (h >> 12) % 5 } }; };
    const figure = b => { if (!can || b.fig === null) return null;
      let pl, kit = null, tm = null, key;
      if (b.fig && b.fig.player) { pl = b.fig.player; tm = b.fig.team; key = 'p' + pl.id + tm.id; }
      else if (b.who && !b.model) { pl = suit(b.who); kit = SUIT; tm = PROSPECT; key = pl.id; }
      else { pl = C.me; tm = b.model && C.team ? (b.team || PB.team(C.team)) : o.pre || !C.team ? PROSPECT : PB.team(C.team); key = 'me' + tm.id; }
      if (!(key in shots)) { try { shots[key] = PB.R.portrait(pl, tm, 420, kit ? { body: true, kitObj: kit } : { body: true }); } catch (e) { shots[key] = null; } }
      return shots[key]; };
    let i = 0, timer = 0;
    const AUD = PB.audio, snd = k => { try { if (!AUD) return; if (k === 'tick') { if (AUD.play) AUD.play('click'); } else if (AUD.crowd) { AUD.crowd.on(true); if (AUD.crowd.level) AUD.crowd.level(0.12); AUD.crowd.react(k, 1); clearTimeout(snd.off); snd.off = setTimeout(() => { try { AUD.crowd.on(false); } catch (e) { /* fine */ } }, 3800); } } catch (e) { /* no sound yet: the page has not been touched */ } };
    try { if (AUD && AUD.music) AUD.music(true); } catch (e) { /* fine */ }
    const end = () => { clearInterval(timer); clearTimeout(snd.off); try { if (AUD && AUD.crowd) AUD.crowd.on(false); } catch (e) { /* fine */ } scr().classList.remove('over3d'); scr().innerHTML = ''; done(); };
    const draw = () => {
      clearInterval(timer);
      const b = beats[i]; if (!b) { end(); return; }
      const t = b.team || (C && C.team && !(o.pre && !b.model) ? PB.team(C.team) : null), img = figure(b);
      const sc = scr(); sc.classList.remove('over3d'); if (PB.R && PB.R.showcase && !PB.Game.active) PB.R.showcase(null);
      sc.innerHTML = `<div class="cut" style="--c1:${t ? t.c1 : '#3a3a42'}"><div class="cbar"><span>${esc(b.k || '')}</span><button id="cskip">Skip ›</button></div>
        ${b.big ? `<h1 class="cbig">${esc(b.big)}</h1>` : ''}
        <div class="cstage">${b.bg ? `<span class="cbg">${esc(b.bg)}</span>` : ''}${img ? `<img class="cfig${b.who && !b.model ? ' sp' : ''}" alt="" src="${img}">` : ''}<i class="cspot"></i></div>
        <div class="cbox">${b.who ? `<b class="cwho">${esc(b.who)}</b>` : ''}<p id="ctxt"></p><em class="cnext" id="cnext">${i + 1 < beats.length ? 'Tap to continue' : 'Tap to go on'} ›</em></div></div>`;
      sc.hidden = false; sc.scrollTop = 0;
      const el = $('#ctxt'), full = b.t || ''; let n = 0;
      snd(b.snd || 'tick');
      const typed = () => n >= full.length;
      timer = setInterval(() => { n = Math.min(full.length, n + 2); el.textContent = full.slice(0, n); if (typed()) clearInterval(timer); }, 22);
      $('#cskip').onclick = e => { e.stopPropagation(); end(); };
      sc.firstElementChild.onclick = () => { if (!typed()) { n = full.length; el.textContent = full; clearInterval(timer); return; } i++; draw(); };
    };
    draw();
  }
  /* the scenes of a career, each written for the road you chose */
  function playScene(k, done) {
    const me = C.me, P = C.path || 'draft', t = C.team ? PB.team(C.team) : null, ag = C.agent || (C.agent = PB.randName()), home = me.from ? me.from : 'home';
    const coach = t ? coachOf(C.team) : '', vet = t ? myRoster().filter(p => p.pos === me.pos && p.id !== me.id).sort((a, b) => b.ovr - a.ovr)[0] : null, rv = C.rival ? rivalP() : null, rt = C.rival ? PB.team(C.rival.team) : null;
    const N = (k2, t2, o) => Object.assign({ k: k2, t: t2 }, o || {}), ME = { model: me }, tale = C.draftTale;
    let B = [];
    if (k === 'prologue') {
      B = P === 'top' ? [
        N('Three weeks before the draft', `Every mock draft has the same name near the top: ${PB.full(me)}. The gym in ${home} has not had an empty seat since March.`, { big: 'The top prospect', bg: 'DRAFT' }),
        N('Your agent', `"Top six is done. Nobody is passing on you." ${ag} does not look up from the phone. "But first overall is not a gift. It is one workout, with thirty teams in the building."`, { who: ag }),
        N('Your agent', '"Shoot it at the combine and they call your name first. Ten of fifteen, and nobody argues. Anything less, and somebody else walks up those steps before you do."', { who: ag }),
        N('The combine', 'Fifteen shots. One of them could be worth the first pick in the draft.', { big: 'Earn it' })]
      : P === 'second' ? [
        N('Three weeks before the draft', `Nobody is writing about ${PB.full(me)}. The lists stop at thirty, and you are not on them.`, { big: 'Day two', bg: 'DRAFT' }),
        N('Your agent', `"I will be straight with you." ${ag} slides a sheet across the table. "Second round. Forty, maybe fifty. No guaranteed money. You make the team in camp or you do not."`, { who: ag }),
        N('Your agent', '"There is one way off that list. Have the day of your life at the combine, and somebody trades back into the first round to get you. It has happened."', { who: ag }),
        N('The combine', 'Thirty names will be called on night one. Yours is not supposed to be one of them.', { big: 'Prove them wrong' })]
      : P === 'undrafted' ? [
        N('Draft week', `No workouts. No interviews. The scouts who came through ${home} came to see somebody else.`, { big: 'Nobody is coming', bg: 'DRAFT' }),
        N('Your agent', `"Sixty picks, and I do not have one team telling me they will use theirs on you." ${ag} lets that sit. "So here is what we do. We watch. And when it is over, I start calling."`, { who: ag }),
        N('Your agent', '"Camp invite. Two-way deal. End of the bench. That is the offer if we are lucky. Every great undrafted story started in exactly that seat."', { who: ag }),
        N('Draft night', 'They will all tell this story one day. It starts with a phone that does not ring.', { big: 'The long road' })]
      : [
        N('Three weeks before the draft', `${PB.full(me)} is a first-round name: somewhere between the lottery and the last pick of the night, depending on who you ask.`, { big: 'The prospect', bg: 'DRAFT' }),
        N('Your agent', `"You are a first-rounder today," ${ag} says. "Where in the first round is up to you. The combine, then the interviews. Teams remember both."`, { who: ag }),
        N('Your agent', '"Shoot the lights out and you are a lottery pick. Have a bad day and answer badly, and you could be sitting in that room when night one ends. It happens every year."', { who: ag }),
        N('The combine', 'Fifteen shots, two interviews, one night that decides where your career begins.', { big: 'Your move' })];
    }
    if (k === 'draftnight' && t) {
      const ord = ordinal(C.pick), first = C.pick === 1;
      B = tale === 'first' ? [
        N('Draft night', 'The green room. Your family at the table, a camera a few feet from your face, and a card the commissioner has not read yet.', { big: 'Draft night' }),
        N('The commissioner', `"With the first pick in the draft, the ${tname(t)} select..."`, { who: 'The commissioner' }),
        N('The commissioner', `"...${PB.full(me)}."`, Object.assign({ who: 'The commissioner', big: 'First overall', bg: '#1', snd: 'roar' }, ME)),
        N('Your agent', `"You earned that," ${ag} says into your ear over the noise. "Nobody gave it to you. Remember that when it gets hard."`, { who: ag })]
      : tale === 'top' ? [
        N('Draft night', 'The green room. Everybody in the building thinks they know the first name on the card.', { big: 'Draft night' }),
        N('The commissioner', `"With the first pick in the draft..." The camera swings to your table.`, { who: 'The commissioner' }),
        N('The commissioner', `"...${rv ? PB.full(rv) : 'another name'}."`, { who: 'The commissioner', big: 'Not you', bg: '#1', snd: 'ooh', fig: rv && rt ? { player: rv, team: rt } : undefined }),
        N('Draft night', `You clap. You keep your face still. The combine cost you this: ${rv ? rv.last : 'he'} shot it better on the one day it counted.`),
        N('The commissioner', `"With the ${ord} pick, the ${tname(t)} select ${PB.full(me)}."`, Object.assign({ who: 'The commissioner', bg: '#' + C.pick, snd: 'applause' }, ME)),
        N('Your agent', `"${ord} is a long way from a tragedy," ${ag} says. "And now you have somebody to chase."`, { who: ag })]
      : tale === 'slid' ? [
        N('Draft night', 'Thirty picks. You counted every one of them from a chair in the green room.', { big: 'Night one' }),
        N('Draft night', 'The room empties table by table. Yours is one of the last. Then the lights come up, and they are stacking chairs.'),
        N('Your agent', `"Tomorrow," ${ag} says. "It is still the league. And every team that passed tonight just did you a favor."`, { who: ag }),
        N('Day two', `"With the ${ord} pick, the ${tname(t)} select ${PB.full(me)}."`, Object.assign({ who: 'The deputy commissioner', big: 'Round two', bg: '#' + C.pick, snd: 'applause' }, ME))]
      : tale === 'second' ? [
        N('Draft night', 'No green room for you. A couch, a television, and thirty names that are not yours.', { big: 'Night one' }),
        N('Day two', `It is the middle of the afternoon when the phone rings. Not ${ag}. A number you do not know.`),
        N('The general manager', `"This is the ${t.name}. We are on the clock, and we are taking you. Welcome to ${t.city}."`, { who: `${t.city} front office` }),
        N('Day two', `"With the ${ord} pick, the ${tname(t)} select ${PB.full(me)}."`, Object.assign({ who: 'The deputy commissioner', big: 'Round two', bg: '#' + C.pick, snd: 'applause' }, ME))]
      : tale === 'jumped' ? [
        N('Draft night', 'You were supposed to be watching this from a couch. After that combine, they found you a seat in the building.', { big: 'Draft night' }),
        N('Your agent', `"Somebody is trading back into the first round," ${ag} says, reading. "They are doing it for you."`, { who: ag }),
        N('The commissioner', `"With the ${ord} pick, the ${tname(t)} select ${PB.full(me)}."`, Object.assign({ who: 'The commissioner', big: 'First round', bg: '#' + C.pick, snd: 'roar' }, ME)),
        N('Draft night', 'A day-two prospect three weeks ago. A first-round pick tonight. One good day did that.', ME)]
      : [
        N('Draft night', first ? 'The green room, and a card with your name on it.' : 'The green room. Names come off the board. Tables empty around you.', { big: 'Draft night' }),
        N('Your agent', C.pick <= 5 ? `"Lottery," ${ag} whispers. "That combine did it."` : C.pick <= 14 ? `"You are next. I can feel it," ${ag} says, for the third time tonight.` : `"Still good," ${ag} says. "The right team, not the first team."`, { who: ag }),
        N('The commissioner', `"With the ${ord} pick, the ${tname(t)} select ${PB.full(me)}."`, Object.assign({ who: 'The commissioner', big: C.pick <= 5 ? 'Lottery pick' : 'First round', bg: '#' + C.pick, snd: C.pick <= 5 ? 'roar' : 'applause' }, ME)),
        N('Draft night', `The hat, the handshake, the walk. ${rv ? `Somewhere behind you, ${PB.full(rv)} is hearing his name too: same position, same class.` : ''}`, ME)];
    }
    if (k === 'coach' && t) {
      B = [N(`${t.city} · the practice floor`, `Day one. The gym smells like floor wax and somebody else's sweat.`, Object.assign({ big: `Welcome to ${t.city}`, bg: t.ab || t.id }, ME)),
        N('Head coach', P === 'top' ? (C.pick === 1 ? `"First pick in the draft." Coach ${coach.split(' ').pop()} looks you over. "That gets you a locker and a lot of cameras. Minutes you earn in here."` : `"They told me you are special." Coach ${coach.split(' ').pop()} does not smile. "Special shows up in March. Show me October first."`)
          : P === 'undrafted' ? `"I have fifteen men and one of them is you, on a two-way." Coach ${coach.split(' ').pop()} shrugs. "I do not care how you got here. I care what you do with four minutes."`
          : C.pick > 30 ? `"Second-round pick. Nothing guaranteed." Coach ${coach.split(' ').pop()} taps the clipboard. "Good. Hungry players defend."`
          : `"I asked for you," Coach ${coach.split(' ').pop()} says. "Do not make me look stupid."`, { who: `Coach ${coach}` }),
        vet ? N('The locker room', role() === 'Starter' ? `${PB.full(vet)} has played your position here for years. He shakes your hand, slowly. "Take care of my spot, rook."` : `That is ${PB.full(vet)}'s spot: a ${vet.ovr}, your position. He nods at you from across the room. It is not unfriendly. It is not an invitation either.`, { fig: { player: vet, team: t } }) : null,
        N('Head coach', role() === 'Starter' ? '"You start. Do not confuse that with being ready."' : role() === 'Sixth man' ? '"First man off my bench. Change the game when you come in, and we will talk about more."' : '"You sit until I call you. Be ready every single time I look down that bench."', { who: `Coach ${coach}` }),
        N('Your road', P === 'top' ? 'They expect a star. Become one.' : P === 'undrafted' ? 'Make the roster. Earn a real contract. Then make them all remember passing on you.' : C.pick > 30 ? 'Crack the rotation. Then the starting five. Then make thirty teams explain themselves.' : 'Prove the pick right.', { big: P === 'top' ? 'Live up to it' : P === 'undrafted' ? 'Nobody called' : C.pick > 30 ? 'Day-two pick' : 'First-rounder' })];
    }
    if (k === 'firststart' && t) {
      B = [N(`${t.city} · shootaround`, `Coach ${coach.split(' ').pop()} waves you over before the others are out of the tunnel.`, ME),
        N('Head coach', P === 'undrafted' ? '"You are starting tonight." A beat. "Nobody drafted you, and you are starting in this league. Think about that for exactly ten seconds, then go guard somebody."' : C.pick > 30 ? '"You are in the five tonight. Second-rounders do not usually hear that from me. You earned it."' : '"You are starting tonight. It is yours until you give it back."', { who: `Coach ${coach}`, big: 'Your first start', snd: 'applause' }),
        vet ? N('The locker room', `${PB.full(vet)} is lacing up for the second unit. "Do not look at me like that," he says. "Go play."`, { fig: { player: vet, team: t } }) : null];
    }
    if (k === 'converted' && t) {
      B = [N(`${t.city} · the front office`, 'You are called upstairs after practice. Nobody is called upstairs for good news on a two-way.', { big: 'Upstairs' }),
        N('The general manager', '"We are tearing up the two-way." A folder comes across the desk. "Three years. A real contract. You are not at the end of anybody\'s bench anymore."', { who: `${t.city} front office` }),
        N('Your agent', `${ag} calls before you reach the parking lot. "Sixty picks. Sixty. And you just got paid anyway."`, { who: ag }),
        N('Your road', 'Chapter one is over. You made the league. Now find out how good you can be.', { big: 'Earned it' })];
    }
    if (k === 'first20' && t) {
      B = [N('After the game', 'The locker room is loud. Somebody has written a 20 on the whiteboard and circled it twice.', ME),
        N('Head coach', P === 'undrafted' ? '"Twenty. From the man nobody drafted." He almost smiles. "They will have a scouting report on you by Friday. Good. Beat it."' : P === 'top' ? '"Twenty. That is what they drafted you for. Now do it when they are ready for you."' : '"Twenty tonight. The league noticed. That is the easy part. Now they game-plan for you."', { who: `Coach ${coach}`, big: 'Twenty' })];
    }
    if (k === 'allstar' && t) {
      B = [N('The call', `${ag} never calls this early.`, ME),
        N('Your agent', P === 'undrafted' ? '"All-Star." Then nothing, for a long time. "Undrafted. All-Star. I am going to frame the draft board from your year and hang it in my office."' : C.pick > 30 ? '"You are an All-Star. A second-round pick. Do you know how short that list is?"' : P === 'top' ? '"All-Star. On schedule." A laugh. "Do not tell them I said on schedule."' : '"All-Star. First time. Not the last."', { who: ag, big: 'All-Star', snd: 'applause' }),
        rv ? N('Around the league', `${PB.full(rv)} posts a single word: "Deserved." ${rt ? `The ${rt.name} are on the schedule soon.` : ''}`, { fig: rt ? { player: rv, team: rt } : undefined }) : null];
    }
    if (k === 'champ' && t) {
      B = [N('The last buzzer', 'Confetti in your hair. Somebody is crying on your shoulder and you are not sure who.', Object.assign({ big: 'Champion', snd: 'roar' }, ME)),
        N('Head coach', P === 'undrafted' ? '"Go find the sixty men they took instead of you," he shouts over the noise, "and ask them what this feels like."' : P === 'top' ? '"This is what they saw in you. All of it."' : C.pick > 30 ? '"Day two of the draft. And now this. Nobody can take it back."' : '"You earned every minute of this."', { who: `Coach ${coach}` }),
        N('Your road', P === 'undrafted' ? 'From a phone that did not ring to the top of the league.' : 'A champion. There is more of the road ahead.', { big: `${t.city} is yours` })];
    }
    if (!B.length) { done(); return; }
    cut(B, done, { pre: k === 'prologue' || k === 'draftnight' });
  }
  /* the road: the chapters of the career you chose, ticked off as you live them, and the one in front of you */
  function roadCard() {
    if (!C.team) return '';
    const P = C.path || 'draft', M = memOf(), T = C.trophies || [], has = re => T.some(x => re.test(x));
    const ch = [[P === 'undrafted' ? 'Make a roster, undrafted' : C.pick === 1 ? 'Go first overall' : C.pick > 30 ? 'Hear your name on day two' : 'Get drafted in the first round', true]];
    if (P === 'undrafted') ch.push(['Turn the two-way into a real contract', !!(C.contract && C.contract.kind !== 'Two-way deal')]);
    if (P === 'undrafted' || C.pick > 30) ch.push(['Crack the rotation: sixth man or better', (M.sixth || 0) + (M.starts || 0) > 0 || role() !== 'Bench']);
    ch.push(['Start a game', (M.starts || 0) > 0 || (M.old && role() === 'Starter')], ['Score twenty in a game', ((C.highs || {}).pts || 0) >= 20], ['Make an All-Star team', has(/^All-Star, /)], ['Win a championship', has(/^Champion, /)], ['Win the MVP', has(/^MVP, /)],
      [P === 'undrafted' ? 'The Hall of Fame: the greatest undrafted story ever told' : P === 'top' ? 'The Hall of Fame: everything they said you would be' : 'The Hall of Fame', !!(C.retired && C.retired.hof)]);
    const next = ch.find(c => !c[1]), n = ch.filter(c => c[1]).length;
    return `<div class="card road"><h3>${P === 'top' ? 'Live up to it' : P === 'undrafted' ? 'Nobody called' : C.pick > 30 ? 'Day-two pick' : 'Prove them right'} <small>${n} of ${ch.length}</small></h3>
      ${ch.map(c => `<p class="${c[1] ? 'd' : c === next ? 'n' : ''}"><i>${c[1] ? '✓' : c === next ? '›' : '·'}</i>${esc(c[0])}</p>`).join('')}</div>`;
  }

  /* ---------- what tonight is about ----------
     The career remembers a little of what has happened (how many games you have started and how many you have come
     off the bench, the role you had last time, the team you were on before, whether you are just back from being hurt
     or coming off a career night), and from that and the season so far it works out the one thing tonight is about.
     The booth opens with it, the card before the tip names it, the feed says it, your first minutes and first points
     are called for what they are, and the news afterwards tells how it went. */
  const memOf = () => C.mem || (C.mem = { played: C.totals && C.totals.gp ? 1 : (C.games || []).some(x => x.done) || C.year > 1 ? 1 : 0, starts: 0, sixth: 0, bench: 0, lastRole: null, prevTeam: null, teamGames: 1, old: C.year > 1 || (C.games || []).some(x => x.done) });
  function story(g) {
    if (!g || g.po || (g.cup && g.cup !== 'group')) return null;   // the playoffs and the Cup's knockout rounds have their own billing
    const M = memOf(), rl = role(), bench = rl !== 'Starter', t = PB.team(C.team), o = PB.team(g.opp);
    const S = (k, title, sub, feed) => ({ k, title, sub, feed: feed || `${title} · ${sub}` });
    const done = C.games.slice(0, C.gi).filter(x => x.done && x.res), last = done[done.length - 1], l3 = done.slice(-3);
    const meet = done.filter(x => x.opp === g.opp).pop(), ws = (C.streaks || {})[C.team] || 0;
    if (!M.played) return bench ? S('debut_bench', 'Your debut', 'You start on the bench: be ready when your number is called') : S('debut', 'Your debut', 'Your first game in the league, and you start');
    if (M.prevTeam && !M.teamGames) return S('newteam', 'New team', `Your first game for the ${t.name}`);
    if (M.prevTeam && g.opp === M.prevTeam && !M.facedOld) return S('former', 'Your old team', `First time against the ${o.name} since you left`);
    if (M.back) return S('return', 'Back healthy', 'Your first game back at full strength');
    if (bench && M.lastRole === 'Starter') return S('benched', 'Off the bench', 'You lost your starting spot: go and win it back');
    if (M.old) { /* a career from before the game kept this memory: no firsts to call, the rest still apply */ }
    else if (rl === 'Starter' && !M.starts) return S('first_start', 'Your first start', 'The coach has you in the starting five for the first time');
    else if (rl === 'Sixth man' && !M.sixth && M.lastRole === 'Bench') return S('sixth_first', 'Sixth man', 'First man off the bench tonight: you have earned more minutes');
    else if (bench && !M.bench && !M.sixth) return S('first_bench', 'Off the bench', 'For the first time you do not start: make the minutes count');
    if (!bench && M.lastRole && M.lastRole !== 'Starter') return S('promoted', 'Back in the five', 'You start again tonight');
    if (C.year > 1 && C.gi === 0) return S('opener', 'Opening night', `Season ${C.year} begins`);
    if (M.high) return S('afterhigh', 'Coming off a career night', 'Everybody saw the last one: do it again');
    if (l3.length === 3 && l3.every(x => (x.res.line.pts || 0) >= 20)) return S('rolling', 'On a roll', 'Twenty or more in three straight games');
    if (last && last.res.gscore !== undefined && last.res.gscore <= 3 && (last.res.line.min || 9) >= 5) return S('bounce', 'Bounce back', 'A rough one last time out: answer it');
    if (ws >= 4) return S('streak_w', 'Winning streak', `${ws} in a row for the ${t.name}`);
    if (ws <= -4) return S('streak_l', 'Losing streak', `${-ws} straight losses: somebody has to stop it`);
    if (meet && !meet.res.win) return S('rematch', 'Rematch', `The ${o.name} beat you ${meet.res.them}-${meet.res.us} last time`);
    if (meet && meet.res.win && (meet.res.line.pts || 0) >= 25) return S('again', 'They remember you', `You had ${meet.res.line.pts} on the ${o.name} last time`);
    if (g.prime) return S('prime', 'Primetime', 'National television tonight: a quarter more skill points, and everybody watching');
    if (g.b2b) return S('b2b', 'Back-to-back', 'Second night in a row: heavy legs');
    return null;
  }
  /* after any game of yours, played or simmed: what the next one will remember */
  function remember(res) {
    const M = memOf(), rl = role();
    M.played = (M.played || 0) + 1; M.teamGames = (M.teamGames || 0) + 1; M[rl === 'Starter' ? 'starts' : rl === 'Sixth man' ? 'sixth' : 'bench'] = (M[rl === 'Starter' ? 'starts' : rl === 'Sixth man' ? 'sixth' : 'bench'] || 0) + 1;
    M.lastRole = rl; M.back = false; M.high = !!(res && res.highs && res.highs.length && !res.sim);
  }
  /* how the night it was billed as went, for the news */
  function storyNews(k, res, g) {
    const me = C.me, l = res.line, o = PB.team(g.opp), w = res.win, line = `${l.pts} point${l.pts === 1 ? '' : 's'}${l.reb >= 6 ? `, ${l.reb} rebounds` : ''}${l.ast >= 5 ? `, ${l.ast} assists` : ''}`, r = w ? `a win over the ${o.name}` : `a loss to the ${o.name}`;
    const good = l.pts >= 15 || res.gscore >= 9;
    return ({ debut: `${me.last}'s debut: ${line} in ${r}`, debut_bench: `${me.last}'s debut, off the bench: ${line} in ${r}`, first_start: `A first start for ${me.last}: ${line} in ${r}`,
      sixth_first: `${me.last} as the sixth man: ${line} in ${r}`, first_bench: `${me.last} comes off the bench for the first time: ${line}`, benched: good ? `Sent to the bench, ${me.last} answers: ${line}` : `${me.last} off the bench: ${line} in ${r}`,
      promoted: `${me.last} back in the starting five: ${line}`, newteam: `${me.last}'s first game in new colors: ${line} in ${r}`, former: w ? `${me.last} beats his old team: ${line}` : `${me.last}'s old team gets the better of him: ${line}`,
      return: `${me.last} back at full strength: ${line}`, afterhigh: good ? `${me.last} follows the career night with ${line}` : `${me.last} comes back to earth: ${line}`, rolling: l.pts >= 20 ? `${me.last} makes it four straight with twenty: ${line}` : `${me.last}'s run of twenty-point games ends at three`,
      bounce: good ? `${me.last} bounces back: ${line}` : `Another quiet night for ${me.last}: ${line}`, rematch: w ? `Payback: the ${PB.team(C.team).name} get the ${o.name} this time` : `The ${o.name} do it again`, streak_w: w ? `The streak goes on for the ${PB.team(C.team).name}` : `The ${o.name} end the ${PB.team(C.team).name} winning streak`,
      streak_l: w ? `The ${PB.team(C.team).name} stop the slide` : `The ${PB.team(C.team).name} slide goes on` })[k] || null;
  }

  /* ---------- the next game: the schedule, or a playoff series ---------- */
  /* what the booth opens with tonight */
  function introCall(g) {
    if (g.cup === 'F') return 'cup_intro';
    if (g.po) {
      const sr = mySeries(); if (!sr || sr.bo === 1) return 'po_intro';
      if (sr.conf === 'Finals' && sr.wa + sr.wb === 0) return 'finals_intro';
      const need = Math.ceil(sr.bo / 2), mine = sr.a === C.team ? sr.wa : sr.wb, theirs = sr.a === C.team ? sr.wb : sr.wa;
      return mine + theirs === 6 ? 'g7' : theirs === need - 1 ? 'elim' : mine === need - 1 ? 'closeout' : 'po_intro';
    }
    const st = story(g), firsts = { debut: 1, debut_bench: 1, first_start: 1, sixth_first: 1, first_bench: 1, benched: 1, promoted: 1, newteam: 1, former: 1, return: 1 };
    if (st && firsts[st.k]) return st.k === 'debut' ? 'debut' : 'st_' + st.k;   // a first of yours is the night's story, even against your rival
    if (C.rival && g.opp === C.rival.team) return 'rival';
    return st ? 'st_' + st.k : null;
  }
  function nextGame() {
    if (C.phase === 'regular') {
      const g = C.games[C.gi];
      return g && { opp: g.opp, home: g.home, label: `${g.cup ? (g.cup === 'group' ? 'Cup night · ' + (C.cup ? 'Group ' + C.cup.groups[C.cup.mine].name : 'Group stage') : CUP_ROUNDS[g.cup]) + ' · ' : ''}Game ${C.gi + 1} of ${C.games.length} · ${g.neutral ? 'Neutral floor' : g.home ? 'Home' : 'Away'}${g.b2b ? ' · Back-to-back' : ''}${g.prime ? ' · Primetime' : ''}`, g };
    }
    if (C.phase === 'playoffs') {
      const sr = mySeries();
      if (!sr) return null;
      const opp = sr.a === C.team ? sr.b : sr.a, n = sr.wa + sr.wb + 1;
      const homeHigh = [1, 2, 5, 7].includes(n) || sr.bo === 1;
      const home = (sr.a === C.team) === homeHigh;
      const mine = sr.a === C.team ? sr.wa : sr.wb, theirs = sr.a === C.team ? sr.wb : sr.wa;
      const lbl = sr.bo === 1 ? `${sr.tag} · one game` : `${sr.tag} · Game ${n} · series ${mine}-${theirs}`;
      return { opp, home, label: `${lbl} · ${home ? 'Home' : 'Away'}`, g: { opp, home, done: false, po: true } };
    }
    return null;
  }

  /* ---------- game goals: three a game, by position, scaled to the game's length and your minutes ---------- */
  const GOALS = {
    pts: [8, 'Score {n}+ points'], ast: [3, 'Hand out {n}+ assists'], reb: [4, 'Grab {n}+ rebounds'], stl: [1, 'Get {n}+ steal{s}'],
    blk: [1, 'Block {n}+ shot{s}'], tpm: [2, 'Make {n}+ three{s}'], tov: [2, 'Keep turnovers to {n} or fewer'], grade: [7, 'Earn a B- or better'],
  };
  const BY_POS = { PG: ['pts', 'ast', 'tov', 'stl', 'grade'], SG: ['pts', 'tpm', 'stl', 'grade', 'ast'], SF: ['pts', 'reb', 'stl', 'tpm', 'grade'],
    PF: ['reb', 'pts', 'blk', 'grade', 'stl'], C: ['reb', 'blk', 'pts', 'grade', 'ast'] };
  function makeGoals() {
    const f = Math.pow(S.qlen / 3, 0.85) * ({ Starter: 1, 'Sixth man': 0.7, Bench: 0.42 }[role()] || 1);   // by the minutes the role plays
    const pool = BY_POS[C.me.pos].slice();
    const pick3 = [pool[0], pool[1], pool[2 + Math.floor(PB.rand() * 3)]];
    return pick3.map(k => {
      const n = k === 'grade' ? 7 : k === 'tov' ? Math.max(1, Math.round(GOALS[k][0] * Math.max(1, f))) : Math.max(1, Math.round(GOALS[k][0] * f));
      return { k, n, text: GOALS[k][1].replace('{n}', n).replace('{s}', n === 1 ? '' : 's') };
    });
  }
  function goalMet(g, line, gs) {
    if (g.k === 'grade') return gs >= g.n;
    if (g.k === 'tov') return (line.tov || 0) <= g.n;
    return (line[g.k] || 0) >= g.n;
  }
  function playGame() {
    const nx = nextGame(); if (!nx) return;
    const g = nx.g, t = PB.team(C.team), o = PB.team(g.opp);
    scr().hidden = true;
    C.me.badges = C.me.badges || {};
    /* in a rival game he starts, at his position (yours): you guard each other */
    const opp5 = starters(o.id);
    if (C.rival && o.id === C.rival.team && rivalP()) opp5[PB.POS.indexOf(rivalP().pos)] = rivalP();
    /* the two nights that are not like the others: the Finals, and the final of the Cup */
    const fsr = g.po && mySeries(), bigNight = fsr && fsr.conf === 'Finals' ? { kind: 'finals', title: 'The Finals', sub: (() => { const m = fsr.a === C.team ? fsr.wa : fsr.wb, th = fsr.a === C.team ? fsr.wb : fsr.wa; return `Game ${m + th + 1} · ${m === th ? 'Series tied ' + m + '-' + th : m > th ? 'You lead ' + m + '-' + th : 'You trail ' + m + '-' + th}`; })() }
      : g.cup === 'F' ? { kind: 'cupfinal', title: 'The Cup Final', sub: 'One game for the trophy' } : null;
    const tale = story(g); g.st = tale ? tale.k : undefined; if (tale && tale.k === 'former') memOf().facedOld = true;
    const mine5 = liveFive(), benchOf = (id, five) => C.rosters[id].filter(p => !(p.out > 0) && !five.includes(p) && p.id !== C.me.id).sort((a, b) => b.ovr - a.ovr).slice(0, 4);
    PB.Game.start({ teams: [t, o], rosters: [mine5, opp5], bench: [benchOf(C.team, mine5), benchOf(o.id, opp5)], userId: 'me', qlen: S.qlen, level: S.level,
      floor: bigNight ? Object.assign({}, g.home || g.neutral ? t : o, { cup: !!g.cup, stage: bigNight.kind, stageText: bigNight.title }) : g.cup ? Object.assign({}, g.home || g.neutral ? t : o, { cup: true }) : g.home ? t : o, stage: bigNight || (g.cup ? { title: g.cup === 'group' ? 'Cup night' : CUP_ROUNDS[g.cup], sub: g.cup === 'group' && C.cup ? 'Group ' + C.cup.groups[C.cup.mine].name : 'Win or go home' } : null),
      strength: [strength(C.team), strength(o.id)], playoff: !!g.po || (!!g.cup && g.cup !== 'group'), clinch: (() => { if (g.cup === 'F') return [true, true]; const sr = g.po && mySeries(); if (!sr || sr.conf !== 'Finals') return null; const m = sr.a === C.team ? sr.wa : sr.wb, th = sr.a === C.team ? sr.wb : sr.wa; return [m + 1 > sr.bo / 2, th + 1 > sr.bo / 2]; })(), onEnd: r => result(r, g),
      stints: stintsFor(role()), hot: hotZones(), tired: !!g.b2b, callIntro: introCall(g), story: tale, prime: !!g.prime, chem: partner() ? { id: C.chem.id, v: C.chem.v } : null, walkout: true, career: true, rivalH2H: C.rival && g.opp === C.rival.team ? (C.rival.h2h || [0, 0]) : null, homeKit: g.home ? C.homeKit : null, goals: C.goals, highs: C.highs, rivalId: C.rival && g.opp === C.rival.team ? C.rival.id : null });
  }
  /* several games at once: it stops for All-Star weekend and the playoffs; a word from the coach, life and offers
     wait on the hub. The run shows as a list. */
  function simMany(n) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const nx = nextGame(); if (!nx || C.phase !== 'regular') break;
      simOne(nx);
      out.push(nx.g);
      if (C.contest === 'invited' || C.dunk === 'invited' || C.rising === 'invited' || (C.season.allstar && !C.asg) || C.gi >= C.games.length) break;   // the rest (talks, life, offers) waits on the hub
    }
    const w = out.filter(g => g.res.win).length;
    show(`<div class="page post"><p class="kick">Simulated ${out.length} game${out.length === 1 ? '' : 's'}</p><h2>${w}-${out.length - w}</h2>
      <div class="card">${out.map((g, i) => glog(g, C.gi - out.length + i + 1)).join('')}</div>
      <div class="card earn"><b>${C.me.sp} skill points to spend</b><span>Coach trust ${Math.round(C.trust)} · ${role()}</span></div>
      <button class="big" id="go">Continue</button></div>`);
    $('#go').onclick = () => { tab = 'home'; hub(); };
  }
  function simOne(nx) {
    const g = nx.g;
    const win = PB.rand() < winP(C.team, g.opp, g.home);
    const base = (104 + PB.gauss() * 9) * QF(), margin = Math.abs(PB.gauss() * 9) * QF() + 1;
    const us = Math.round(win ? base + margin / 2 : base - margin / 2), them = Math.round(win ? base - margin / 2 : base + margin / 2);
    const line = simLine(C.me, role(), win);
    record(g, { us, them, win, line, grade: LET[line.gs], gscore: line.gs, sim: true, ct: line.ct });
  }
  function simGame() {
    const nx = nextGame(); if (!nx) return;
    const g = nx.g;
    const win = PB.rand() < winP(C.team, g.opp, g.home);
    const base = (104 + PB.gauss() * 9) * QF(), margin = Math.abs(PB.gauss() * 9) * QF() + 1;
    const us = Math.round(win ? base + margin / 2 : base - margin / 2), them = Math.round(win ? base - margin / 2 : base + margin / 2);
    const line = simLine(C.me, role(), win);
    record(g, { us, them, win, line, grade: LET[line.gs], gscore: line.gs, sim: true, ct: line.ct });
    after(g, true);
  }

  function record(g, res) {
    g.done = true; g.res = res;
    const s = g.po ? (C.poStats = C.poStats || zero()) : C.season, T = C.totals;
    for (const k of ['pts', 'reb', 'ast', 'stl', 'blk', 'tov', 'fga', 'fgm', 'tpa', 'tpm', 'fta', 'ftm']) { s[k] += res.line[k]; T[k] += res.line[k]; }
    /* where your shots come from: the season's makes and attempts in each zone of the floor */
    if (res.shots && res.shots.length) { const Z1 = C.zones || (C.zones = {}), Z2 = C.zonesAll || (C.zonesAll = {}); for (const [x, a, m] of res.shots) { const k = PB.zoneOf(x, a); for (const Z of [Z1, Z2]) { const e = Z[k] || (Z[k] = [0, 0]); e[1]++; if (m) e[0]++; } } }
    { const K = C.streaks || (C.streaks = {}), w = res.win ? C.team : g.opp, l = res.win ? g.opp : C.team; if (!g.po) { K[w] = (K[w] || 0) >= 0 ? (K[w] || 0) + 1 : 1; K[l] = (K[l] || 0) <= 0 ? (K[l] || 0) - 1 : -1; } }
    C.loginShow = null; C.rankNew = null;
    questTick(res, g);
    s.gp++; T.gp++; s.grades += res.gscore; T.grades += res.gscore; s.min = (s.min || 0) + (res.line.min || 0); T.min = (T.min || 0) + (res.line.min || 0);
    const o = PB.team(g.opp), me = C.me;
    if (g.po) {
      if (res.win) s.w++; else s.l++;
      C.po.games.push(g);
      playoffResult(res.win);
    } else {
      if (res.win) { s.w++; T.w++; C.standings[C.team].w++; C.standings[g.opp].l++; } else { s.l++; T.l++; C.standings[C.team].l++; C.standings[g.opp].w++; }
      simLeagueDay(g.opp);
    }
    /* the other starters in your game, and your own line as you played it (never scaled up), for the leaders, the
       awards and your market value */
    if (!g.po) { leagueLines(g.opp, !res.win); }
    const k = 1, A = C.adj || (C.adj = { gp: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tpm: 0 });
    if (!g.po) { A.gp++; for (const x of LS.slice(1)) A[x] += (res.line[x] || 0) * k; weekly(res, k); }
    /* your rival, when it is his team */
    if (C.rival && g.opp === C.rival.team) {
      const rl = rivalGame(!res.win);
      if (rl) { const meWon = res.line.pts + res.line.reb + res.line.ast >= rl.pts + rl.reb + rl.ast; C.rival.h2h[meWon ? 0 : 1]++; res.rival = rl;
        /* you talked: now it counts double, one way or the other */
        if (C.clapped) { C.fans = Math.round(C.fans * (meWon ? 1.06 : 0.97)); C.news.unshift(meWon ? `${C.me.last} backs up the talk against his rival` : `${C.me.last} talked, and his rival got the better of him`); C.clapped = false; } }
    }
    /* the game's goals */
    if (C.goals) {
      res.goals = C.goals.map(g => ({ text: g.text, met: goalMet(g, res.line, res.gscore) }));
      const met = res.goals.filter(g => g.met).length;
      me.sp += Math.round(met * 2 * PB.clamp(20 / (C.len || 20), 0.3, 1.5)); C.trust = PB.clamp((C.trust ?? 45) + met * 1.5, 0, 100);
      if (C.path === 'undrafted' && C.year <= 3) me.sp += met; else if (C.path === 'second' && C.year <= 2) me.sp += Math.ceil(met / 2);   // a day-two pick has a chip on his shoulder too   // the chip on the shoulder: an undrafted man grows faster
      C.goals = null;
    }
    /* the story you chose: a top pick lives with the noise, an undrafted man earns everything */
    if (C.path === 'top' && C.year <= 2) {
      if (res.gscore <= 4) { C.fans = Math.round(C.fans * 0.97); if (PB.rand() < 0.35) C.feed.unshift({ who: '@hoopstalk', text: `${PB.full(me)} went top five for THAT? Asking for a city.` }); }
      else if (res.gscore >= 9) { C.fans = Math.round(C.fans * 1.03); if (PB.rand() < 0.3) C.feed.unshift({ who: '@hoopstalk', text: `${me.last} looks every bit the pick. Franchise player.` }); }
    }
    if (C.path === 'undrafted') {
      if (res.gscore >= 8 && C.year <= 3) { C.fans = Math.round(C.fans * 1.06 + 200); if (PB.rand() < 0.35) C.feed.unshift({ who: '@draftnerd', text: `Thirty teams passed on ${PB.full(me)}. Twice. Look at him now.` }); }
      if (C.contract && C.contract.kind === 'Two-way deal' && (C.trust ?? 0) >= 55 && C.season.gp >= 4) {
        C.contract = { years: 3, salary: 2.1, kind: 'Standard deal' };
        C.news.unshift(`The ${PB.team(C.team).name} turn ${me.last}'s two-way into a three-year contract`);
        C.feed.unshift({ who: '@' + PB.team(C.team).name.toLowerCase(), text: `He earned it. ${PB.full(me)} is staying.` });
        res.converted = true; (C.cs = C.cs || []).push('converted');
      }
    }
    /* career highs (games you play) and milestones */
    if (!res.sim) {
      C.highs = C.highs || {}; res.highs = [];
      for (const [k, n] of [['pts', 'points'], ['reb', 'rebounds'], ['ast', 'assists'], ['stl', 'steals'], ['blk', 'blocks'], ['tpm', 'threes']]) {
        const v = res.line[k] || 0;
        if (v > 0 && v > (C.highs[k] || 0)) { if (C.highs[k] !== undefined) res.highs.push(`${v} ${n}`); C.highs[k] = v; }
      }
      /* the device's record book: the best single games by any career here */
      const RB = load('pbb.records') || {}; RB.game = RB.game || {}; res.records = [];
      for (const [k, n] of [['pts', 'points'], ['reb', 'rebounds'], ['ast', 'assists'], ['stl', 'steals'], ['blk', 'blocks'], ['tpm', 'threes']]) {
        const v = res.line[k] || 0;
        if (v > 0 && v > ((RB.game[k] || {}).v || 0)) { if (RB.game[k]) res.records.push(`${v} ${n}`); RB.game[k] = { v, name: PB.full(C.me), team: C.team, opp: res.opp || null, year: C.year }; }
      }
      store('pbb.records', RB);
    }
    C.miles = C.miles || {}; res.miles = [];
    const L2 = res.line, dd = ['pts', 'reb', 'ast', 'stl', 'blk'].filter(k => (L2[k] || 0) >= 10).length;
    const MS = [['firstpts', 'First points', L2.pts > 0], ['firstdunk', 'First dunk', ((res.ct || {}).dunk || 0) > 0], ['firstthree', 'First three', (L2.tpm || 0) > 0],
      ['twenty', '20-point game', L2.pts >= 20], ['thirty', '30-point game', L2.pts >= 30], ['dd', 'Double-double', dd >= 2], ['td', 'Triple-double', dd >= 3],
      ['ten_ast', '10 assists', L2.ast >= 10], ['five_blk', '5 blocks', L2.blk >= 5], ['winner', 'A game-winner', !!(C.flags && C.flags.winner)],
      ['playoffwin', 'A playoff win', g.po && res.win], ['title', 'A championship', C.po && C.po.champ === C.team]];
    for (const [k, name, ok] of MS) if (ok && !C.miles[k]) { C.miles[k] = C.year; res.miles.push(name); C.news.unshift(`Milestone: ${name}`); }
    /* trust, skill points, followers */
    C.trust = PB.clamp((C.trust ?? 45) + (res.gscore - 6) * 1.3 + (res.win ? 1 : -0.5), 0, 100);
    /* points scale with the season's length, so a long season grows you about as fast in seasons as a short one */
    const spScale = PB.clamp(20 / (C.len || 20), 0.3, 1.5);
    const sp = Math.max(1, Math.round((res.gscore * 0.9 + (res.win ? 2 : 0) + (g.po ? 2 : 0)) * spScale * (g.prime ? 1.25 : 1)));
    if (g.prime) { res.prime = true; C.fans = Math.round(C.fans * 1.012) + 150; }
    res.sp = sp; me.sp += sp;
    C.fans = Math.round(C.fans * (1 + Math.max(-0.01, (res.line.pts - 8) * 0.002 + (res.win ? 0.004 : 0) + (res.gscore - 6) * 0.002)) + res.line.pts * 15);
    /* badge counters, and any new tier */
    const ct = res.ct || {};
    for (const k of ['tpm', 'ast', 'reb', 'stl', 'blk']) ct[k] = ct[k] ?? res.line[k];
    for (const k in ct) C.ct[k] = (C.ct[k] || 0) + (ct[k] || 0);
    res.newBadges = [];
    for (const b of PB.BADGES) {
      const have = me.badges[b.k] || 0; let t = have;
      while (t < 3 && (C.ct[b.stat] || 0) >= b.tiers[t]) t++;
      if (t > have) { me.badges[b.k] = t; res.newBadges.push(`${b.name} (${PB.TIER[t]})`); C.news.unshift(`${me.last} earns the ${b.name} badge, ${PB.TIER[t].toLowerCase()}`); }
    }
    /* headlines and the feed */
    const hl = res.line.pts >= 30 ? `${me.last} drops ${res.line.pts} on the ${o.name}` :
      res.line.pts >= 20 ? `${me.last} scores ${res.line.pts} as the ${PB.team(C.team).name} ${res.win ? 'beat' : 'fall to'} ${o.city}` :
      `${PB.team(C.team).name} ${res.win ? 'win' : 'lose'} ${res.us}-${res.them} against ${o.city}`;
    C.news.unshift(hl);
    C.news = C.news.slice(0, 30);
    feedAfter(g, res);
    rankUp();
    /* endorsements: past a following, a shoe company calls */
    const tiers = [[25e3, 0.4], [1e5, 1.2], [5e5, 4], [2e6, 10]];
    C.endorse = C.endorse || { tier: 0 };
    for (let i = C.endorse.tier; i < tiers.length; i++) if (C.fans >= tiers[i][0]) { C.endorse.offer = i; break; }
    /* between games, now and then, life happens: a choice with a cost and a payoff */
    if (!g.po && !C.event && PB.rand() < 0.28) { const seen = C.evSeen || (C.evSeen = []), pool = EVENTS.filter(e => !seen.includes(e.k)), e = (pool.length ? pool : EVENTS)[Math.floor(PB.rand() * (pool.length || EVENTS.length))]; C.event = e.k; seen.push(e.k); if (seen.length > 16) seen.shift(); }   // not one you have had lately
    /* now and then the body pays for it: a sore ankle or a tight hamstring, a few points for a game or two */
    if (C.injury) { C.injury.games--; if (C.injury.games <= 0) { for (const k in C.injury.r) me.r[k] = Math.min(99, me.r[k] + C.injury.r[k]); me.ovr = PB.ovr(me.r, me.pos); C.news.unshift(`${me.last} is back to full health`); C.injury = null; memOf().back = true; } }
    else if (PB.rand() < 0.045) {
      const kinds = [['a sore ankle', { speed: 4, vert: 3 }], ['a tight hamstring', { speed: 5 }], ['a jammed finger', { three: 3, mid: 3, handle: 2 }], ['a bruised knee', { vert: 4, dunk: 3 }]];
      const [what, r] = kinds[Math.floor(PB.rand() * kinds.length)], games = 1 + Math.floor(PB.rand() * 2);
      for (const k in r) me.r[k] -= r[k];
      me.ovr = PB.ovr(me.r, me.pos);
      C.injury = { what, r, games };
      C.news.unshift(`${me.last} is listed as questionable with ${what} (${games} game${games > 1 ? 's' : ''})`);
    }
    /* every fifth game the coach has a word: where you stand and what he wants */
    if (!g.po && (C.gi + 1) % 5 === 0) C.coachTalk = true;
    if (!g.po && g.cup) cupAfter(g, res);
    if (!g.po) {
      C.gi++;
      /* the All-Star picks come out at the halfway mark */
      if (!C.allstar && C.gi === Math.floor(C.games.length / 2)) allStarPick();
    }
    save();
  }

  /* ---------- life between games: small choices ---------- */
  const EVENTS = [
    { k: 'camp', q: 'A youth league asks you to run a free camp on your day off.', a: [['Run the camp', { fans: 6, sp: -1, trust: 1 }, 'The kids loved it. So did the local news.'], ['Rest instead', { sp: 1 }, 'Fresh legs for the next one.']] },
    { k: 'film', q: 'The assistant coach offers extra film sessions this week.', a: [['Watch film', { sp: 2, trust: 3 }, 'You see things you were missing. The staff noticed you showed up.'], ['Skip it', { trust: -2 }, 'Nobody said anything. Somebody noticed.']] },
    { k: 'party', q: 'A teammate is throwing a birthday party the night before a game.', a: [['Go, leave early', { trust: 1, fans: 1 }, 'Team chemistry is real. You were home by eleven.'], ['Go, stay late', { trust: -4, fans: 3 }, 'Great photos. Rough morning.'], ['Stay in', { sp: 1 }, 'Sleep is a skill.']] },
    { k: 'podcast', q: 'A popular basketball podcast wants an interview.', a: [['Be humble', { fans: 3, trust: 1 }, 'Nice clip going around: team first.'], ['Talk big', { fans: 9, trust: -3 }, 'Every show is talking about you now. Your coach too.']] },
    { k: 'trainer', q: 'A private trainer offers an off-day shooting session.', a: [['Book it', { sp: 3, fans: -1 }, 'Two hundred makes. Your shot feels pure.'], ['Not now', {}, 'Maybe next week.']] },
    { k: 'charity', q: 'The team foundation asks you to visit the children\'s hospital.', a: [['Go', { fans: 5, trust: 2 }, 'A day you will remember. The fans will too.'], ['Send a signed jersey', { fans: 1 }, 'A nice gesture.']] },
    { k: 'viral', q: 'A clip of you missing a wide-open dunk in warmups is going around.', a: [['Post it yourself with a joke', { fans: 5, hype: 6 }, 'You got there first. Now it is your joke.'], ['Say nothing', { hype: -3 }, 'It ran for three days without you.'], ['Ask the team to take it down', { trust: -2, hype: -5 }, 'That made it a story.']] },
    { k: 'latenight', q: 'A late-night show wants you on the couch the night before a game.', a: [['Do the show', { fans: 8, hype: 9, trust: -3 }, 'Good segment. Short night.'], ['Tape it on an off day', { fans: 4, hype: 4 }, 'Same couch, more sleep.'], ['Pass', { trust: 1 }, 'The coach heard you said no.']] },
    { k: 'dinner', q: 'Your point guard wants to get dinner and talk through how the two of you play together.', a: [['Go, and bring the film', { chem: 8, trust: 1 }, 'Two hours, one tablet. You are seeing the same game now.'], ['Go, keep it light', { chem: 4, fans: 1 }, 'Good night out.'], ['Another time', { chem: -3 }, 'He ate alone.']] },
    { k: 'beef', q: 'A fan account keeps posting that you are overrated. It has a hundred thousand followers.', a: [['Reply once, with your numbers', { fans: 3, hype: 7, trust: -1 }, 'The reply did better than the post.'], ['Let the game talk', { trust: 2 }, 'The coach noticed what you did not say.'], ['Like the post', { fans: 2, hype: 4 }, 'The internet lost its mind.']] },
    { k: 'slump', q: 'A veteran teammate is in a shooting slump and asks you to stay after practice with him.', a: [['Stay and rebound for him', { trust: 3, sp: -1 }, 'He found his stroke. The locker room noticed who helped.'], ['Head home', { sp: 1 }, 'Rest matters too.']] },
    { k: 'sneaker', q: 'A sneaker blog wants to feature your game-day shoes.', a: [['Do the shoot', { fans: 4 }, 'Your kicks are trending.'], ['Keep it low-key', { trust: 1 }, 'All business.']] },
    { k: 'vet', q: 'The team\'s oldest player offers to show you his pregame routine.', a: [['Learn it', { sp: 2, trust: 2 }, 'Stretch, film, quiet. It works.'], ['Keep your own', {}, 'You know what works for you.']] },
    { k: 'festival', q: 'The city\'s summer festival asks you to throw the first pitch at a ballgame.', a: [['Throw it', { fans: 4 }, 'A strike, somehow. Highlight of the week.'], ['Pass', {}, 'Maybe next year.']] },
    { k: 'gaming', q: 'A streamer invites you to play online with his audience.', a: [['Stream for an hour', { fans: 7, trust: -1 }, 'Twenty thousand people watched you lose at a video game.'], ['Sleep', { sp: 1 }, 'Early night.']] },
    { k: 'diet', q: 'The team nutritionist has a new meal plan for you.', a: [['Follow it', { sp: 2 }, 'Lighter on your feet already.'], ['Ignore it', { trust: -1 }, 'Pizza, again.']] },
    { k: 'rookie', q: 'A younger teammate keeps getting lost on defense. He asks you to walk him through the coverages.', a: [['Stay and teach him', { trust: 4, sp: -1 }, 'He was in the right spot all night. The coach knows why.'], ['Tell him to ask the coaches', { trust: -1 }, 'He figured it out. Eventually.']] },
    { k: 'school', q: 'Your old school wants to retire your number at halftime of their rivalry game. It is the night before a road trip.', a: [['Be there', { fans: 6, sp: -1 }, 'A full gym chanting your name. Worth the red-eye.'], ['Send a video', { fans: 2 }, 'They played it on the big screen.']] },
    { k: 'weights', q: 'The strength coach wants you in for an extra lift twice a week.', a: [['Commit to it', { sp: 2, trust: 1 }, 'Stronger through contact already.'], ['Stick to the usual', {}, 'Your legs thank you, for now.']] },
    { k: 'commercial', q: 'A local car dealer offers you a commercial. The script is terrible.', a: [['Do it anyway', { fans: 5, trust: -1 }, 'Everyone in town can do your line now.'], ['Ask for a rewrite', { fans: 3 }, 'Still not good. Better.'], ['Pass', { trust: 1 }, 'The front office appreciates the quiet.']] },
    { k: 'fine', q: 'You were five minutes late to shootaround. The veterans run a players\' fine jar.', a: [['Pay double and bring breakfast', { trust: 3, fans: 1 }, 'The bagels were a hit. Nobody is late twice.'], ['Pay the fine', { trust: 1 }, 'Lesson learned.'], ['Argue about it', { trust: -4 }, 'You lost the argument and paid anyway.']] },
    { k: 'sleep', q: 'The team offers a sleep study: no phone after ten for two weeks.', a: [['Do the two weeks', { sp: 2 }, 'You forgot what mornings could feel like.'], ['No chance', { fans: 1 }, 'You were online at two in the morning. People noticed the likes.']] },
    { k: 'fan', q: 'A kid has been at every home game holding a sign with your name on it.', a: [['Bring him onto the floor for warmups', { fans: 7, trust: 1 }, 'The clip has two million views. He made a layup.'], ['Sign the sign after the game', { fans: 3 }, 'He will keep it forever.']] },
    { k: 'shootout', q: 'A teammate bets you dinner he can beat you in a three-point shootout after practice.', a: [['Take the bet', { sp: 1, trust: 2 }, 'It went to a tiebreak. Dinner was on him.'], ['Not today', {}, 'He is telling everyone you ducked him.']] },
    { k: 'media', q: 'The league wants you for an all-day media shoot on your one day off this week.', a: [['Do every station', { fans: 6, sp: -1 }, 'You are on the side of a bus now.'], ['Do an hour and leave', { fans: 2 }, 'Enough to keep the league happy.']] },
    { k: 'mentor', q: 'A retired great from your position offers to work with you for a week in the summer.', a: [['Clear the week', { sp: 3, fans: 1 }, 'One week. Three things you will use for ten years.'], ['Thank him and decline', { trust: -1 }, 'He told a reporter he was surprised.']] },
  ];
  function eventCard() {
    const ev = EVENTS.find(e => e.k === C.event); if (!ev) return '';
    /* what each answer does is written under it, before you pick */
    const fxTxt = fx => [fx.fans && `${fx.fans > 0 ? '+' : '−'}${Math.abs(fx.fans)}% followers`, fx.hype && `${fx.hype > 0 ? '+' : '−'}${Math.abs(fx.hype)} hype`, fx.trust && `${fx.trust > 0 ? '+' : '−'}${Math.abs(fx.trust)} trust`, fx.sp && `${fx.sp > 0 ? '+' : '−'}${Math.abs(fx.sp)} skill point${Math.abs(fx.sp) === 1 ? '' : 's'}`, fx.chem && `${fx.chem > 0 ? '+' : '−'}${Math.abs(fx.chem)} chemistry`].filter(Boolean).join(' · ') || 'nothing changes';
    return `<div class="next event"><p class="kick">Between games</p><p class="q">${esc(ev.q)}</p>${ev.a.map((a, i) => `<button class="ghost" data-ev="${i}">${esc(a[0])}<small>${fxTxt(a[1])}</small></button>`).join('')}</div>`;
  }
  function eventPick(i) {
    const ev = EVENTS.find(e => e.k === C.event); if (!ev) return;
    const [lbl, fx, txt] = ev.a[i];
    if (fx.fans) C.fans = Math.round(C.fans * (1 + fx.fans / 100));
    if (fx.sp) C.me.sp = Math.max(0, C.me.sp + fx.sp);
    if (fx.trust) C.trust = PB.clamp(C.trust + fx.trust, 0, 100);
    if (fx.hype) { const so = social(); so.hype = PB.clamp(so.hype + fx.hype, 0, 100); }
    if (fx.chem && typeof chemAdd === 'function') chemAdd(fx.chem);
    C.news.unshift(`${C.me.last}: ${txt}`);
    C.event = null; save(); hub();
  }

  const kfmt = n => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e4 ? Math.round(n / 1e3) + 'K' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : String(n);
  /* ---------- the social feed ---------- */
  const FANS = ['hoopsdad_22', 'courtside_kay', 'bucketsonly', 'the_real_ref', 'nightcapnation', 'bench_mob', 'stat_nerd', 'local_scribe', 'section_214', 'midrange_mary', 'film_room_fred', 'tipoff_tess', 'ankle_tax', 'glasscleaner99', 'sixth_man_sam', 'nosebleed_nate'];
  const say = (...v) => v[Math.floor(PB.rand() * v.length)];
  function feedAfter(g, res) {
    const l = res.line, me = C.me, o = PB.team(g.opp), t = PB.team(C.team);
    const posts = [];
    const who = () => '@' + FANS[Math.floor(PB.rand() * FANS.length)];
    if (l.pts >= 40) posts.push([who(), say(`FORTY. ${me.last} had ${l.pts}. I need to sit down.`, `${l.pts} points. Put ${me.last} in the conversation. All of them.`)]);
    else if (l.pts >= 30) posts.push([who(), say(`${me.last} just put ${l.pts} on ${o.city}. Somebody check on their defense.`, `${l.pts} for ${me.last}. ${o.city} tried three different guys on him.`, `That was a ${l.pts}-point clinic from #${me.num}.`)]);
    else if (l.pts >= 20) posts.push([who(), say(`${l.pts} for ${me.last} tonight. This kid is for real.`, `Another ${l.pts} from ${me.last}. Getting used to this.`, `${me.last}: ${l.pts} and it looked easy.`)]);
    else if (res.gscore <= 3) posts.push([who(), say(`Rough one for #${me.num}. Shake it off.`, `Not ${me.last}'s night. It happens to everybody.`, `${me.last} will want that one back.`)]);
    if (l.reb >= 10 && l.pts >= 10) posts.push([who(), say(`A double-double for ${me.last}: ${l.pts} and ${l.reb}. Quietly does everything.`, `${l.pts} points, ${l.reb} boards. ${me.last} worked tonight.`)]);
    else if (l.reb >= 10) posts.push(['@glasscleaner99', `${l.reb} rebounds for ${me.last}. Every one of them was his.`]);
    if (l.fga >= 6 && l.fgm === l.fga) posts.push(['@stat_nerd', `${me.last} went ${l.fgm}-for-${l.fga}. He did not miss. I checked twice.`]);
    if (l.ast >= 8) posts.push([who(), say(`${l.ast} dimes. ${me.last} sees the whole floor.`, `${l.ast} assists. Everybody eats when ${me.last} has the ball.`)]);
    if (l.blk >= 3) posts.push([who(), `${l.blk} blocks?! Stay out of the paint when ${me.last} is home.`]);
    if (l.tpm >= 4) posts.push([who(), say(`${l.tpm} threes for #${me.num}. Range for days.`, `${l.tpm} from deep. Do not leave ${me.last} open. Do not.`)]);
    if (l.stl >= 3) posts.push([who(), `${me.last} with ${l.stl} steals. Hands everywhere.`]);
    if (res.gscore >= 11) posts.push(['@stat_nerd', `${me.last}'s teammate grade tonight: ${res.grade}. That is winning basketball.`]);
    if (!res.win && l.pts >= 20) posts.push([who(), `${me.last} did everything he could. Need more help.`]);
    if (res.rival) posts.push([`@${o.name.toLowerCase()}_insider`, `${me.last} vs ${rivalP().last}: ${l.pts} to ${res.rival.pts}. ${l.pts >= res.rival.pts ? 'Round to the rookie from ' + t.city + '.' : 'This one goes to ' + rivalP().last + '.'}`]);
    if (res.win) posts.push([`@${t.name.toLowerCase()}`, `FINAL: ${t.name} ${res.us}, ${o.name} ${res.them}. ${g.po ? 'Playoff basketball!' : 'Big win.'}`]);
    else posts.push([`@${t.name.toLowerCase()}`, `FINAL: ${o.name} ${res.them}, ${t.name} ${res.us}. On to the next one.`]);
    /* and the rest of the timeline: people who watched, people who did not, people with opinions */
    const extra = [
      [who(), say(`Watching ${t.name} from section 214 again. Worth every dollar.`, `${t.city} basketball is fun right now.`, `Arena was loud tonight.`, `Got my #${me.num} jersey in the mail today.`)],
      [who(), say(`Is ${me.last} a top-five ${me.pos} yet? Asking for my group chat.`, `Start ${me.last} more minutes. That is the post.`, `${me.last} needs the ball in his hands late.`, `Who taught ${me.last} that footwork?`)],
      [`@${o.name.toLowerCase()}_fan`, say(`${me.last} is not that guy. Relax.`, `We will see ${t.city} again. Circle it.`, `Refs helped ${t.city} tonight. I said what I said.`, `Okay, fine, ${me.last} can play a little.`)],
      ['@fantasy_guru', say(`${me.last}: ${l.pts} pts, ${l.reb} reb, ${l.ast} ast. ${l.pts + l.reb + l.ast >= 25 ? 'Start him everywhere.' : 'Hold, do not drop.'}`, `Fantasy managers: ${me.last} is ${l.pts >= 15 ? 'a must-start' : 'a bench stash'} this week.`)],
      ['@film_room_fred', say(`Watch ${me.last} off the ball on that last possession. Smart cut.`, `${me.last}'s closeouts are getting better. Film does not lie.`, `Three clips from tonight on ${me.last}'s screen navigation. Thread.`)],
      ['@kicks_daily', say(`What is ${me.last} wearing on his feet? Need those.`, `${me.last}'s pregame fit: 9 out of 10.`)],
      [who(), say(`My kid wants to be ${me.last} for Halloween.`, `Met ${me.last} at the grocery store once. Nice guy. Tall.`, `${me.last} signed my hat after the game. Never washing it.`)],
      [who(), say(`${t.city} is a basketball town again.`, `Told my boss I am leaving early for the next ${t.name} game.`, `Season tickets were the best decision I made this year.`, `That building was shaking tonight.`)],
      [who(), say(`${me.last} plays the right way. No wasted dribbles.`, `Nobody talks about ${me.last}'s defense. They should.`, `The way ${me.last} moves without the ball. Chef's kiss.`, `${me.last} makes everybody around him better.`)],
      ['@stat_nerd', say(`${me.last}: ${l.fgm}-for-${l.fga} from the field. ${l.fga && l.fgm / l.fga >= 0.5 ? 'Efficient.' : 'He has had better nights.'}`, `Plus-minus says ${t.name} are a different team with ${me.last} on the floor.`, `${me.last} is averaging more than I predicted in October. I was wrong. Screenshot it.`)],
      ['@local_scribe', say(`Postgame: ${me.last} says the team is "just getting started."`, `Asked ${me.last} about the ${o.name}. He smiled and said "next question."`, `${me.last} was the last one out of the gym tonight. Again.`, `Coach on ${me.last}: "He does what we ask, and then a little more."`)],
      ['@the_real_ref', say(`For the record, that was a clean block in the third.`, `Yes, I saw the travel. No, I am not telling you which one.`, `Good game to work. Both teams competed.`)],
      [`@${o.name.toLowerCase()}_fan`, say(`Our defense on ${me.last} was a rumor tonight.`, `We do not have anybody who can guard #${me.num}. There, I said it.`, `Rematch. Our building. Bring ${me.last}.`, `I respect ${me.last}'s game. I do not have to like it.`)],
      ['@bench_mob', say(`Bench celebrations were elite tonight.`, `Towel waving: 10 out of 10.`, `We see you, end of the bench. Great energy.`)],
      ['@hoops_abuela', say(`My grandson says ${me.last} is "him." I agree.`, `I made tamales and watched ${me.last}. Perfect night.`, `${me.last} needs to eat more. Somebody feed that boy.`)],
      ['@coach_in_my_head', say(`I would have called timeout two possessions earlier.`, `Run the offense through ${me.last}. It is not complicated.`, `Zone would have won that quarter. Nobody asked me.`)],
      ['@swish_kid_07', say(`Practiced ${me.last}'s move in the driveway for two hours.`, `${me.last} waved at me!!!`, `Getting #${me.num} on my jersey for my birthday.`)],
      ['@late_tip_lou', say(`Stayed up for the whole thing. No regrets.`, `West coast tips are ruining my sleep and I love it.`)],
      ['@jumbotron_jay', say(`They showed ${me.last}'s highlight on the big screen and the place lost it.`, `Crowd was chanting for #${me.num} in the fourth.`)],
      [who(), say(l.pts >= 15 ? `${me.last} got whatever he wanted out there.` : `${me.last} did the little things tonight.`, res.win ? `Winning looks good on ${t.city}.` : `Tough loss. We go again.`, `${t.name} in ${res.win ? 'four' : 'seven'}. Calling it now.`)],
    ];
    if (l.pts >= 25) extra.unshift(['@highlight_reel', `Every ${me.last} bucket from tonight in 40 seconds. Sound on.`]);
    if (res.win && g.po) extra.unshift(['@league', `${t.name} take one in the playoffs. ${me.last}: ${l.pts} points.`]);
    for (let i = extra.length - 1; i > 0; i--) { const j = Math.floor(PB.rand() * (i + 1)); [extra[i], extra[j]] = [extra[j], extra[i]]; }
    for (const e of extra.slice(0, 3)) posts.push(e);
    /* a poll now and then, and a tag that trends after a night worth one */
    const special = [];
    if (PB.rand() < 0.3) { const yes = PB.clamp(Math.round(38 + (res.gscore - 6) * 6 + (l.pts - 12) * 0.8 + PB.gauss() * 6), 8, 93);
      const Q = l.pts >= 25 ? [`Is ${me.last} an All-Star this season?`, 'Yes', 'Not yet'] : C.year === 1 ? [`${me.last}: rookie of the year?`, 'Lock it in', 'Too early'] : res.win ? [`Best player on the ${t.name} tonight?`, me.last, 'Somebody else'] : [`Whose fault was that loss?`, 'Not ' + me.last, me.last];
      const y2 = Q[1] === 'Not ' + me.last ? yes : Q[2] === me.last ? 100 - yes : yes;
      special.push({ who: '@hoopstalk', text: Q[0], poll: { o: [[Q[1], y2], [Q[2], 100 - y2]], n: Math.round((C.fans || 2000) * (0.05 + PB.rand() * 0.1)) + 120, v: null }, likes: Math.round((C.fans || 2000) / 300) + 9, re: 14 }); }
    if (l.pts >= 30 || (res.win && g.po) || res.gscore >= 11) { const tag = say(`#${me.last.replace(/[^A-Za-z]/g, '')}SZN`, `#${t.name.replace(/[^A-Za-z]/g, '')}Rising`, `#The${me.last.replace(/[^A-Za-z]/g, '')}Effect`, `#${(t.ab || t.id)}vs${(o.ab || o.id)}`);
      special.push({ who: '#', kind: 'trend', text: tag, sub: `Trending in basketball · ${kfmt(Math.round((C.fans || 2000) * (0.6 + PB.rand())) + 900)} posts` }); }
    const big = Math.max(1, Math.round((C.fans || 2000) / 400));
    for (const [w, x] of posts.slice(0, 5)) C.feed.unshift({ who: w, text: x, likes: Math.round(big * (0.2 + PB.rand() * 1.4)) + Math.floor(PB.rand() * 9), re: Math.floor(PB.rand() * 4) });
    for (const sp of special) C.feed.unshift(sp);
    C.feed = C.feed.slice(0, 30);
  }

  /* ---------- after a game: the result, a press question now and then ---------- */
  const PRESS = {
    big: { q: n => `${n} points tonight. Was that the best you've felt out there?`, a: [
      ['Just took what the defense gave me. The guys found me.', 3, 2, 'humble'],
      ["I've been putting the work in. That's what I do.", -1, 6, 'confident'],
      ['Honestly? I could have had 40.', -4, 10, 'brash']] },
    bad: { q: () => 'Tough night shooting. What happened?', a: [
      ['That one is on me. I will be better on Thursday.', 4, 1, 'accountable'],
      ['Shots will fall. I am not worried.', 0, 2, 'calm'],
      ['The refs were not giving us anything.', -5, 4, 'blame']] },
    rival: { q: n => `How does it feel going up against ${n} again?`, a: [
      ['Great player. We push each other.', 2, 2, 'respect'],
      ['I do not think about him. I think about winning.', 1, 3, 'focused'],
      ['Ask him how it felt.', -2, 9, 'trash talk']] },
    losing: { q: () => 'That is several losses in a row now. What is going wrong?', a: [
      ['We have to look in the mirror. Me first.', 4, 1, 'accountable'],
      ['It is a long season. We will be fine.', 0, 1, 'calm'],
      ['Some guys are not bought in.', -6, 5, 'finger-pointing']] },
    winning: { q: () => 'This team is rolling. How good can you be?', a: [
      ['One game at a time. Stay humble.', 2, 2, 'humble'],
      ['Nobody wants to see us in the playoffs.', 0, 5, 'confident'],
      ['Championship. Write it down.', -2, 8, 'bold']] },
    contract: { q: () => 'It is a contract year. Is that on your mind?', a: [
      ['Just playing for my teammates.', 3, 1, 'team-first'],
      ['I know what I am worth.', -1, 4, 'business'],
      ['I want to be here long term.', 4, 2, 'loyal']] },
    playoff: { q: () => 'First taste of playoff basketball. Is it different?', a: [
      ['Every possession matters. You feel it.', 2, 2, 'measured'],
      ['This is what I came here for.', 1, 5, 'fired up'],
      ['Same game. Same me.', 0, 3, 'cool']] },
    tripdub: { q: () => 'A triple-double. When did you know it was going to be that kind of night?', a: [
      ['When the guys kept cutting and the ball kept finding them.', 4, 3, 'generous'],
      ['I look at the scoreboard, not the box score.', 2, 2, 'focused'],
      ['Around the second quarter. I told the bench to start counting.', -2, 9, 'showman']] },
    close: { q: () => 'That one came down to the last possession. What was going through your head?', a: [
      ['Next play. That is all there is at that point.', 2, 2, 'steady'],
      ['I wanted the ball. I always want the ball there.', 0, 6, 'clutch'],
      ['Honestly, my heart was pounding. That is why we play.', 1, 4, 'honest']] },
    routed: { q: () => 'That got away from you early tonight. What do you say in that locker room?', a: [
      ['Nothing tonight. We watch the film and we own it tomorrow.', 4, 0, 'accountable'],
      ['One game. Flush it.', 0, 2, 'short memory'],
      ['Some of us need to look in the mirror.', -5, 6, 'pointed']] },
    stopper: { q: () => 'You were everywhere on defense tonight. Is that where your game starts?', a: [
      ['Defense travels. Shots come and go.', 4, 2, 'old school'],
      ['I take it personally when my man scores.', 1, 5, 'proud'],
      ['I would rather talk about the win.', 2, 1, 'team first']] },
    dimes: { q: n => `${n} assists. Are you a scorer or a playmaker?`, a: [
      ['Whatever the game asks for that night.', 3, 2, 'complete'],
      ['A playmaker. Making the right read is the best feeling in the game.', 4, 3, 'unselfish'],
      ['A scorer who happens to see everything.', -1, 7, 'confident']] },
  };
  function pressFor(g, r) {
    if (r.sim) return null;
    const last = C.games.filter(x => x.done).slice(-4);
    if (!g.po && last.length === 4 && last.every(x => !x.res.win) && PB.rand() < 0.6) return ['losing', ''];
    if (!g.po && last.length === 4 && last.every(x => x.res.win) && PB.rand() < 0.5) return ['winning', ''];
    if (C.contract && C.contract.years === 1 && PB.rand() < 0.15) return ['contract', ''];
    if (C.rival && g.opp === C.rival.team && PB.rand() < 0.8) return ['rival', PB.full(rivalP())];
    if (g.po && C.po.games.length === 1) return ['playoff', ''];
    { const L = r.line;
      if (L.pts >= 10 && L.reb >= 10 && L.ast >= 10) return ['tripdub', ''];
      if (Math.abs(r.us - r.them) <= 3 && PB.rand() < 0.45) return ['close', ''];
      if (!r.win && r.them - r.us >= 18 && PB.rand() < 0.6) return ['routed', ''];
      if ((L.stl || 0) + (L.blk || 0) >= 5 && PB.rand() < 0.7) return ['stopper', ''];
      if (L.ast >= 9 && PB.rand() < 0.6) return ['dimes', L.ast]; }
    if (r.line.pts >= 22 || r.gscore >= 10) return ['big', r.line.pts];
    if (r.gscore <= 3) return ['bad', ''];
    return null;
  }
  function after(g, sim) {
    /* the night it was billed as, in the news; then what the next game will remember of this one */
    if (g.st && !sim && g.res) { const n = storyNews(g.st, g.res, g); if (n) C.news.unshift(n); }
    { const F = C.flags || (C.flags = {}); if (!sim && g.res && !F.cs20 && (g.res.line.pts || 0) >= 20) { F.cs20 = true; (C.cs = C.cs || []).push('first20'); } }
    remember(g.res);
    socialAfter(g, g.res);
    /* chemistry: every basket between the two of you, a little for a win, and a point lost when a game goes by without one */
    { const cr = g.res; if (partner()) { if (!sim && cr.chem) { const n = cr.chem.toMe + cr.chem.fromMe; cr.chemD = chemAdd(n * 2.5 + (cr.win ? 1 : 0) - (n ? 0 : 1)); cr.chemN = n; } else if (sim && PB.rand() < 0.4) chemAdd(1); } }
    const r = g.res, o = PB.team(g.opp), t = PB.team(C.team), l = r.line;
    const pr = pressFor(g, r);
    const P = pr && PRESS[pr[0]];
    show(`<div class="page post"><p class="kick">${sim ? 'Simulated' : 'Final'}${r.ot ? ' · ' + (r.ot > 1 ? r.ot : '') + 'OT' : ''}${g.po ? ' · Playoffs' : ''}</p>
      <div class="final"><div>${badge(t)}<b>${r.us}</b></div><em>${r.win ? 'WIN' : 'LOSS'}</em><div><b>${r.them}</b>${badge(o)}</div></div>
      <div class="night${r.win ? ' w' : ''}" style="--tc:${t.c1}">${portrait() ? `<img src="${portrait()}" alt="">` : ''}<div><span>${esc(PB.full(C.me))}</span><b>${l.pts} <small>PTS</small></b><p>${l.min ? l.min.toFixed(1) + ' min · ' : ''}${l.reb} reb · ${l.ast} ast · ${l.fgm}/${l.fga} FG</p></div><em>${r.grade}<i>Teammate grade</i></em></div>
      <div class="tiles"><div><b>${l.pts}</b><span>PTS</span></div><div><b>${l.reb}</b><span>REB</span></div><div><b>${l.ast}</b><span>AST</span></div>
      <div><b>${l.fgm}/${l.fga}</b><span>FG</span></div><div><b>${l.tpm}/${l.tpa}</b><span>3PT</span></div><div><b>${l.stl}/${l.blk}</b><span>STL/BLK</span></div></div>
      ${sim ? '' : reelBtn()}
      ${r.rival ? `<div class="card rival"><h3>Rival</h3><p>${esc(rivalP().last)}: ${r.rival.pts} pts, ${r.rival.reb} reb, ${r.rival.ast} ast. Head to head, you're ${C.rival.h2h[0]}-${C.rival.h2h[1]}.</p></div>` : ''}
      ${!sim && r.chemD !== undefined && partner() ? `<div class="card earn"><b>Chemistry with ${esc(partner().last)} ${r.chemD >= 0 ? '+' : '−'}${Math.abs(r.chemD)}</b><span>${r.chemN} basket${r.chemN === 1 ? '' : 's'} between you tonight · now ${C.chem.v}, ${chemTier(C.chem.v).toLowerCase()}</span></div>` : ''}
      ${r.goals ? `<div class="card goalsdone"><h3>Goals <small>${r.goals.filter(g => g.met).length} of ${r.goals.length} · +${r.goals.filter(g => g.met).length * 2} SP</small></h3>${r.goals.map(g => `<p class="${g.met ? 'w' : 'l'}">${g.met ? '✓' : '✗'} ${esc(g.text)}</p>`).join('')}</div>` : ''}
      ${r.records && r.records.length ? `<div class="card earn"><b>Record book</b><span>A new best on this device: ${r.records.map(esc).join(' · ')}</span></div>` : ''}
      ${(r.highs && r.highs.length) || (r.miles && r.miles.length) ? `<div class="card earn"><b>${r.highs && r.highs.length ? 'New career high' + (r.highs.length > 1 ? 's' : '') : 'Milestone'}</b><span>${[...(r.highs || []), ...(r.miles || [])].map(esc).join(' · ')}</span></div>` : ''}
      ${r.newBadges && r.newBadges.length ? `<div class="card earn"><b>Badge earned</b><span>${r.newBadges.map(esc).join(' · ')}</span></div>` : ''}
      ${P ? `<div class="card press" id="press"><h3>Press conference</h3><p class="q">“${esc(P.q(pr[1]))}”</p>${P.a.map((a, i) => `<button class="ans" data-i="${i}">${esc(a[0])}</button>`).join('')}</div>` : ''}
      ${r.log && r.log.length ? `<div class="card"><h3>What moved your grade</h3>${summarize(r.log)}</div>` : ''}
      ${r.shots && r.shots.length ? shotChart(r.shots) : ''}
      ${r.boxHtml || ''}
      <div class="card earn"><b>+${r.sp} skill points${r.prime ? ' · primetime' : ''}</b><span>${C.me.sp} to spend on the Player tab · coach trust ${Math.round(C.trust)}</span></div>
      <button class="big" id="go">Continue</button></div>`);
    if (P) scr().querySelectorAll('#press .ans').forEach(b => b.onclick = () => {
      const a = P.a[+b.dataset.i];
      C.trust = PB.clamp(C.trust + a[1], 0, 100); C.fans = Math.round(C.fans * (1 + a[2] / 100));
      C.news.unshift(`${C.me.last} at the podium: "${a[0]}"`);
      C.feed.unshift({ who: '@local_scribe', text: `${C.me.last}, after the game: "${a[0]}"` });
      { const so = social(); so.quotes.unshift({ q: a[0], tone: a[3] || '', wk: `Season ${C.year} · game ${C.gi}` }); so.quotes = so.quotes.slice(0, 20); }
      $('#press').innerHTML = `<h3>Press conference</h3><p class="q">“${esc(a[0])}”</p><p class="fine">Coach trust ${a[1] >= 0 ? '+' : ''}${a[1]} · followers ${a[2] >= 0 ? '+' : ''}${a[2]}% · the ${a[3]} answer</p>`;
      save();
    });
    $('#go').onclick = () => { delete r.boxHtml; lastReels = []; tab = 'home'; hub(); };
    if (!sim) reelWire();
  }
  /* your shots on a half court: green made, red missed */
  function shotChart(shots) {
    const X = x => 150 + x * 5.6, Y = a => 20 + a * 5.6;   // 50 ft across, the rim near the top
    const arc = []; for (let t = -1.18; t <= 1.18; t += 0.04) arc.push(`${X(Math.sin(t) * 23.75).toFixed(1)},${Y(Math.cos(t) * 23.75).toFixed(1)}`);
    const made = shots.filter(s => s[2]).length;
    return `<div class="card"><h3>Shot chart <small>${made} of ${shots.length}</small></h3><svg viewBox="0 0 300 200" class="chart">
      <rect x="10" y="0" width="280" height="200" rx="6" class="floor"/>
      <rect x="${X(-8)}" y="0" width="${16 * 5.6}" height="${Y(13.75) + 0}" class="paint"/>
      <line x1="${X(-22)}" y1="0" x2="${X(-22)}" y2="${Y(8.95)}" class="ln"/><line x1="${X(22)}" y1="0" x2="${X(22)}" y2="${Y(8.95)}" class="ln"/>
      <polyline points="${arc.join(' ')}" class="ln" fill="none"/>
      <circle cx="${X(0)}" cy="${Y(0)}" r="4.5" class="rim"/>
      ${shots.map(s => s[2] ? `<circle cx="${X(s[0]).toFixed(1)}" cy="${Y(Math.max(-3, s[1])).toFixed(1)}" r="5" class="mk"/>` : `<g class="ms" transform="translate(${X(s[0]).toFixed(1)},${Y(Math.max(-3, s[1])).toFixed(1)})"><line x1="-4" y1="-4" x2="4" y2="4"/><line x1="4" y1="-4" x2="-4" y2="4"/></g>`).join('')}
    </svg></div>`;
  }
  function summarize(log) {
    const m = new Map();
    for (const [d, w] of log) { const e = m.get(w) || { n: 0, d: 0 }; e.n++; e.d += d; m.set(w, e); }
    return [...m].sort((a, b) => Math.abs(b[1].d) - Math.abs(a[1].d)).slice(0, 8)
      .map(([w, e]) => `<div class="gl"><span>${esc(w)}${e.n > 1 ? ` ×${e.n}` : ''}</span><b class="${e.d >= 0 ? 'w' : 'l'}">${e.d >= 0 ? '+' : ''}${e.d.toFixed(1)}</b></div>`).join('');
  }

  /* a played game comes back here */
  let lastReels = [];   // the tape of your best plays in the game just played (not saved)
  const reelBtn = () => lastReels.length ? `<div class="row2"><button class="ghost" id="reel">▶ Your highlights <small>${lastReels.length} play${lastReels.length > 1 ? 's' : ''} from tonight</small></button>${window.MediaRecorder ? '<button class="ghost" id="reelsave">Save as video<small>to share</small></button>' : ''}</div>` : '';
  /* the highlights as a video file: the phone's share sheet when it has one, else a download */
  function shareVideo(blob) {
    if (!blob || !blob.size) { alert('This browser could not record the video.'); return; }
    const ext = /mp4/.test(blob.type) ? 'mp4' : 'webm', name = `pocketbasketball-highlights.${ext}`;
    const file = window.File ? new File([blob], name, { type: blob.type }) : null;
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) { navigator.share({ files: [file], title: 'My highlights' }).catch(() => {}); return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  }
  const reelWire = () => {
    if ($('#reel')) $('#reel').onclick = () => PB.Game.reel(lastReels, () => { $('#screen').hidden = false; });
    if ($('#reelsave')) $('#reelsave').onclick = () => PB.Game.reel(lastReels, blob => {
      $('#screen').hidden = false;
      const b = $('#reelsave'); if (!b) return;
      if (!blob || !blob.size) { b.innerHTML = 'Could not record<small>this browser</small>'; b.disabled = true; return; }
      window.__lastVideo = blob;   // (tests read it)
      b.innerHTML = 'Share the video<small>ready</small>'; b.classList.add('lit'); b.onclick = () => shareVideo(blob);   // a tap of your own: share sheets need one
    }, { record: true });
  };
  function result(res, g) {
    lastReels = res.reels || [];
    if (!g) {   // quick game
      const u = res.user || {};
      show(`<div class="page post"><p class="kick">${res.half ? `Blacktop · ${res.half.n}v${res.half.n} to ${res.half.target}${res.half.ones ? ' by 1s and 2s' : ''}` : 'Final' + (res.line && res.line.length > 4 ? ' · ' + (res.line.length > 5 ? res.line.length - 4 : '') + 'OT' : '')}</p>
        <div class="final"><div>${badge(res.teams[0])}<b>${res.score[0]}</b></div><em>${res.score[0] > res.score[1] ? 'WIN' : 'LOSS'}</em><div><b>${res.score[1]}</b>${badge(res.teams[1])}</div></div>
        ${res.user ? `<div class="gradebig"><b>${res.grade || '–'}</b><span>Teammate grade</span></div>
        <div class="tiles"><div><b>${u.pts || 0}</b><span>PTS</span></div><div><b>${u.reb || 0}</b><span>REB</span></div><div><b>${u.ast || 0}</b><span>AST</span></div>
        <div><b>${u.fgm || 0}/${u.fga || 0}</b><span>FG</span></div><div><b>${u.tpm || 0}/${u.tpa || 0}</b><span>3PT</span></div><div><b>${u.stl || 0}/${u.blk || 0}</b><span>STL/BLK</span></div></div>` : ''}
        ${potg(res)}${reelBtn()}
        ${gameStats(res)}${boxScore(res)}
        ${res.half ? '<button class="big" id="again">Run it back</button><button class="ghost" id="go">Main menu</button>' : '<button class="big" id="go">Main menu</button>'}</div>`);
      $('#go').onclick = title; reelWire(); if ($('#again')) $('#again').onclick = () => blacktop(true);
      return;
    }
    const gi = LET.indexOf(res.grade);
    const u = res.user || {};
    const line = Object.assign({ pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, fga: 0, fgm: 0, tpa: 0, tpm: 0, fta: 0, ftm: 0 }, u);
    line.min = Math.round((u.secs || 0) / 6) / 10;   // the minutes you were on the floor
    if (res.winner) (C.flags = C.flags || {}).winner = true;
    const ct = { tpm: u.tpm || 0, cs3: u.cs3 || 0, mid: u.mid || 0, lay: u.lay || 0, dunk: u.dunk || 0, shake: u.shake || 0, cmiss: u.cmiss || 0, clutch: u.clutch || 0, fade: u.fade || 0, hookm: u.hookm || 0 };
    record(g, { us: res.score[0], them: res.score[1], win: res.score[0] > res.score[1], line, grade: res.grade, gscore: gi < 0 ? 6 : gi, sim: false, log: res.gradeLog, ct, shots: res.shots, chem: res.chem || null, ot: res.line && res.line.length > 4 ? res.line.length - 4 : 0 });
    g.res.boxHtml = potg(res) + gameStats(res) + boxScore(res);
    after(g, false);
  }
  /* the player of the game: the best line on the winning side (points, boards and assists, efficiency) */
  function potg(res) {
    if (!res.box || !res.box.length) return '';
    const w = res.score[0] >= res.score[1] ? 0 : 1, v = b => b.st.pts + b.st.reb * 0.8 + b.st.ast + (b.st.stl + b.st.blk) * 1.5 - (b.st.fga - b.st.fgm) * 0.4;
    const b = res.box.filter(x => x.team === w).sort((a, c) => v(c) - v(a))[0]; if (!b || v(b) < 6) return '';   // nobody had a game: no award
    /* a card the way the console games do it: the player in his uniform, his line in big numbers */
    const tm = res.teams[w], img = !PB.noGL && PB.R.modelReady && PB.R.modelReady() ? PB.R.portrait(b.d, tm, 300, { body: true, tight: true, yell: true, kit: w === 0 ? 'icon' : 'assoc' }) : null;
    return `<div class="card potg" style="--tc:${tm.c1}">${img ? `<img alt="" src="${img}">` : ''}<div class="pi"><p class="kick">Player of the game${b.user ? ' · you' : ''}</p>
      <b class="nm">${esc(b.d.first || '')}<br>${esc(b.d.last || '')}</b><span class="tm">${esc(tm.name)} · #${b.d.num ?? ''}</span>
      <div class="ln"><div><b>${b.st.pts}</b><span>PTS</span></div><div><b>${b.st.reb}</b><span>REB</span></div><div><b>${b.st.ast}</b><span>AST</span></div></div>
      <span class="fg">${b.st.fgm}-${b.st.fga} FG${b.st.tpa ? ` · ${b.st.tpm}-${b.st.tpa} 3PT` : ''}</span></div></div>`;
  }
  /* the game in numbers, the way a stats app lays it out: the score by quarter, the lead through the night, and the two
     teams side by side */
  /* your season the way a stats app shows a player: his averages with where they rank in the league, and his points
     game by game (white for a win) */
  function seasonCard() {
    const dn = C.games.filter(x => x.done && x.res && x.res.line); if (!dn.length) return '';
    const rows = leaders(), mine = rows.filter(r => r.me)[0];
    const ord = n => n + (n % 100 > 10 && n % 100 < 14 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
    const tile = (k, lbl) => { if (!mine) return ''; const rank = rows.slice().sort((a, b) => b[k] - a[k]).indexOf(mine) + 1; return `<div><b>${mine[k].toFixed(1)}</b><span>${lbl}</span><em>${ord(rank)}</em></div>`; };
    const last = dn.slice(-20), mx = Math.max(10, ...last.map(x => x.res.line.pts)), W = 320, H = 84, bw = W / Math.max(last.length, 8), avg = last.reduce((a, x) => a + x.res.line.pts, 0) / last.length;
    return `<div class="card season"><h3>This season <small>${dn.length} game${dn.length > 1 ? 's' : ''}${mine ? ' · league rank under each' : ''}</small></h3>
      ${mine ? `<div class="tiles rk">${tile('ptspg', 'PPG')}${tile('rebpg', 'RPG')}${tile('astpg', 'APG')}</div>` : ''}
      <p class="kick">Points by game</p><svg viewBox="0 0 ${W} ${H + 14}" class="pbg" aria-label="Your points in each game">
      <line x1="0" x2="${W}" y1="${(H - avg / mx * (H - 12)).toFixed(1)}" y2="${(H - avg / mx * (H - 12)).toFixed(1)}" class="av"/>
      ${last.map((x, i) => { const v = x.res.line.pts, h = Math.max(2, v / mx * (H - 12)); return `<rect x="${(i * bw + bw * 0.18).toFixed(1)}" y="${(H - h).toFixed(1)}" width="${(bw * 0.64).toFixed(1)}" height="${h.toFixed(1)}" rx="2" class="${x.res.win ? 'w' : 'l'}"/><text x="${(i * bw + bw / 2).toFixed(1)}" y="${(H - h - 3).toFixed(1)}">${v}</text>`; }).join('')}
      <text x="${W}" y="${H + 12}" class="lg">white: a win · line: your average ${avg.toFixed(1)}</text></svg></div>`;
  }
  function gameStats(res) {
    if (!res || !res.box || !res.teams) return '';
    const T = res.teams, ab = t => esc(T[t].ab || T[t].id || T[t].name.slice(0, 3).toUpperCase());
    /* a team's color to draw with on the dark page: its second color when the first is too dark to see */
    const lum = h => { const m = /^#?([0-9a-f]{6})$/i.exec(h || ''); if (!m) return 1; const n = parseInt(m[1], 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; };
    const col = t => lum(T[t].c1) < 0.16 ? (lum(T[t].c2) < 0.16 ? '#d8d8de' : T[t].c2) : T[t].c1;
    let out = '';
    if (res.line && res.line.length > 1) { const q = res.line.map((v, i) => [v[0] - (i ? res.line[i - 1][0] : 0), v[1] - (i ? res.line[i - 1][1] : 0)]);
      out += `<div class="card"><h3>By quarter</h3><table class="std lsc"><tr><th></th>${q.map((_, i) => `<th>${q.length < 4 && i === q.length - 1 ? (i + 1) + '–4' : i < 4 ? i + 1 : 'OT'}</th>`).join('')}<th>T</th></tr>${[0, 1].map(t => `<tr class="${res.score[t] > res.score[1 - t] ? 'me' : ''}"><td>${badge(T[t])} ${ab(t)}</td>${q.map(v => `<td>${v[t]}</td>`).join('')}<td><b>${res.score[t]}</b></td></tr>`).join('')}</table></div>`; }
    if (res.flow && res.flow.length > 3) { const F = res.flow, W = 320, H = 96, tot = F[F.length - 1][0] || 1, pk = Math.max(6, ...F.map(p => Math.abs(p[1]))), X = t => (t / tot * W).toFixed(1), Y = m => (H / 2 - m / pk * (H / 2 - 6)).toFixed(1);
      const d = F.map((p, i) => `${i ? 'L' : 'M'}${X(p[0])} ${Y(p[1])}`).join(' '), big = F.reduce((a, p) => Math.abs(p[1]) > Math.abs(a[1]) ? p : a, F[0]);
      let ch = 0, ties = 0; for (let i = 1; i < F.length; i++) { if (Math.sign(F[i][1]) && Math.sign(F[i - 1][1]) && Math.sign(F[i][1]) !== Math.sign(F[i - 1][1])) ch++; if (F[i][1] === 0 && F[i - 1][1] !== 0) ties++; }
      const qn = Math.max(4, res.line ? res.line.length : 4);
      out += `<div class="card flow"><h3>Game flow</h3><div class="fl"><span>${ab(0)}</span><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-label="The lead through the game"><defs><clipPath id="fa"><rect x="0" y="0" width="${W}" height="${H / 2}"/></clipPath><clipPath id="fb"><rect x="0" y="${H / 2}" width="${W}" height="${H / 2}"/></clipPath></defs>
        ${Array.from({ length: qn - 1 }, (_, i) => `<line x1="${(W * (i + 1) / qn).toFixed(1)}" y1="0" x2="${(W * (i + 1) / qn).toFixed(1)}" y2="${H}" class="q"/>`).join('')}<line x1="0" y1="${H / 2}" x2="${W}" y2="${H / 2}" class="z"/>
        <path d="${d} L${W} ${H / 2} L0 ${H / 2} Z" clip-path="url(#fa)" fill="${col(0)}" opacity=".55"/><path d="${d} L${W} ${H / 2} L0 ${H / 2} Z" clip-path="url(#fb)" fill="${col(1)}" opacity=".55"/><path d="${d}" class="ln"/></svg><span>${ab(1)}</span></div>
        <div class="tiles t3"><div><b>${Math.abs(big[1])}</b><span>Biggest lead · ${big[1] === 0 ? '–' : ab(big[1] > 0 ? 0 : 1)}</span></div><div><b>${ch}</b><span>Lead changes</span></div><div><b>${ties}</b><span>Times tied</span></div></div></div>`; }
    const sum = (t, k) => res.box.filter(b => b.team === t).reduce((a, b) => a + (b.st[k] || 0), 0), pct = (m, a) => a ? Math.round(m / a * 100) : 0;
    const rows = [['FG%', t => pct(sum(t, 'fgm'), sum(t, 'fga')), '%'], ['3P%', t => pct(sum(t, 'tpm'), sum(t, 'tpa')), '%'], ['Rebounds', t => sum(t, 'reb')], ['Assists', t => sum(t, 'ast')], ['Steals', t => sum(t, 'stl')], ['Blocks', t => sum(t, 'blk')], ['Turnovers', t => sum(t, 'tov'), '', true]];
    out += `<div class="card cmp"><h3>Team stats</h3><div class="ch"><span>${badge(T[0])} ${ab(0)}</span><span>${ab(1)} ${badge(T[1])}</span></div>${rows.map(([n, f, u, low]) => { const a = f(0), b = f(1), m = Math.max(a, b, 1), wa = low ? a < b : a > b, wb = low ? b < a : b > a;
      return `<div class="cr"><b class="${wa ? 'w' : ''}">${a}${u || ''}</b><i><u style="width:${Math.round(a / m * 100)}%;background:${col(0)}"></u></i><em>${n}</em><i class="r"><u style="width:${Math.round(b / m * 100)}%;background:${col(1)}"></u></i><b class="${wb ? 'w' : ''}">${b}${u || ''}</b></div>`; }).join('')}</div>`;
    return out;
  }
  function boxScore(res) {
    /* the whole line for every man who played: minutes, the counting stats, the shooting splits, plus/minus; the
       table slides sideways under the names on a phone */
    const mm = v => { const m = Math.floor((v || 0) / 60); return `${m}:${String(Math.floor((v || 0) % 60)).padStart(2, '0')}`; };
    const sg = v => (v > 0 ? '+' : '') + (v || 0);
    const cols = b => `<td>${mm(b.st.secs)}</td><td><b>${b.st.pts}</b></td><td>${b.st.reb}</td><td>${b.st.ast}</td><td>${b.st.stl || 0}</td><td>${b.st.blk || 0}</td><td>${b.st.tov || 0}</td><td>${b.st.pf || 0}</td><td>${b.st.fgm}-${b.st.fga}</td><td>${b.st.tpm}-${b.st.tpa}</td><td>${b.st.ftm || 0}-${b.st.fta || 0}</td><td>${sg(b.st.pm)}</td>`;
    const tot = t => { const L = res.box.filter(b => b.team === t), S = k => L.reduce((a, b) => a + (b.st[k] || 0), 0);
      return `<tr class="tot"><td>Team</td><td></td><td><b>${S('pts')}</b></td><td>${S('reb')}</td><td>${S('ast')}</td><td>${S('stl')}</td><td>${S('blk')}</td><td>${S('tov')}</td><td>${S('pf')}</td><td>${S('fgm')}-${S('fga')}</td><td>${S('tpm')}-${S('tpa')}</td><td>${S('ftm')}-${S('fta')}</td><td></td></tr>`; };
    const rows = t => res.box.filter(b => b.team === t).sort((a, b) => (b.st.secs || 0) - (a.st.secs || 0)).map(b => `<tr class="${b.user ? 'me' : ''}"><td>${esc(b.d.last)} <small>${b.d.pos || ''}</small></td>${cols(b)}</tr>`).join('');
    return [0, 1].map(t => `<div class="card"><h3>${res.teams[t].name}</h3><div class="bxw"><table class="std bx"><tr><th></th><th>MIN</th><th>PTS</th><th>REB</th><th>AST</th><th>STL</th><th>BLK</th><th>TO</th><th>PF</th><th>FG</th><th>3P</th><th>FT</th><th>+/-</th></tr>${rows(t)}${tot(t)}</table></div></div>`).join('');
  }

  /* ---------- All-Star ---------- */
  function allStarPick() {
    C.allstar = true;
    if (C.year <= 2) { C.rising = 'invited'; C.news.unshift(`${C.me.last} is in the Rising Stars game`); }
    const s = C.season, gp = s.gp || 1, A = C.adj && C.adj.gp ? C.adj : null, ppg = (A ? A.pts / A.gp : s.pts / gp) / QF(), score = ppg + (A ? (A.reb + A.ast) / A.gp : (s.reb + s.ast) / gp) / QF() * 0.5 + (s.grades / gp - 6);
    if (score >= 21 || (ppg >= 17 && C.trust > 70)) {
      C.trophies.push(`All-Star, season ${C.year}`); C.me.sp += 5; C.fans = Math.round(C.fans * 1.15);
      if (C.trophies.filter(x => /^All-Star, /.test(x)).length === 1) (C.cs = C.cs || []).push('allstar');
      C.news.unshift(`${C.me.last} is an All-Star! First-time selection for the ${PB.team(C.team).name}`);
      C.feed.unshift({ who: '@league', text: `Your All-Stars are here. Congrats to ${PB.full(C.me)} of the ${PB.team(C.team).name}!` });
      C.season.allstar = true;
    } else C.news.unshift('All-Star rosters are out. Not this year for the rookie. Keep stacking games.');
    /* the 3-point contest wants shooters */
    if (C.season.allstar || C.me.r.three >= 72 || (C.season.tpm / Math.max(1, C.season.gp)) >= 2) {
      C.contest = 'invited'; C.news.unshift(`${C.me.last} is in the 3-Point Contest at All-Star weekend`);
    }
    /* the dunk contest wants fliers */
    if (C.me.r.dunk >= 76 || (C.season.allstar && C.me.r.dunk >= 64) || (C.me.r.dunk >= 68 && C.me.r.vert >= 78)) {
      C.dunk = 'invited'; C.news.unshift(`${C.me.last} enters the Dunk Contest`);
    }
  }
  /* the All-Star Game: each conference's best at every position; you in yours */
  function allStarGame(play) {
    const mine = PB.team(C.team).conf, other = mine === 'East' ? 'West' : 'East';
    const best = conf => PB.POS.map(pos => { let b = null; for (const t of PB.TEAMS) if (t.conf === conf) for (const p of C.rosters[t.id]) if (p.pos === pos && (!b || p.ovr > b.ovr)) b = p; return b; });
    const us = best(mine); us[PB.POS.indexOf(C.me.pos)] = C.me;
    const them = best(other);
    const T = conf => ({ id: conf === 'East' ? 'EAS' : 'WES', ab: conf.toUpperCase(), city: conf, name: 'All-Stars', c1: conf === 'East' ? '#1d4e9e' : '#c8102e', c2: '#ffffff', conf });
    const done = (us_, them_, line, sim) => {
      C.asg = true;
      const win = us_ > them_, mvp = line && line.pts / QF() >= 18 && win;
      if (mvp) { C.trophies.push(`All-Star Game MVP, season ${C.year}`); C.fans = Math.round(C.fans * 1.12); }
      C.news.unshift(`All-Star Game: ${win ? mine : other} ${Math.max(us_, them_)}-${Math.min(us_, them_)}${mvp ? `; ${C.me.last} is the MVP` : ''}`);
      save();
      show(`<div class="page post"><p class="kick">All-Star Game</p><div class="final"><div><b>${us_}</b></div><em>${win ? 'WIN' : 'LOSS'}</em><div><b>${them_}</b></div></div>
        <p class="mute">${mine} vs ${other}</p>${line ? `<div class="tiles"><div><b>${line.pts}</b><span>PTS</span></div><div><b>${line.reb}</b><span>REB</span></div><div><b>${line.ast}</b><span>AST</span></div></div>` : ''}
        ${mvp ? '<div class="card earn"><b>All-Star Game MVP</b><span>The trophy and the spotlight are yours.</span></div>' : ''}${sim ? '' : reelBtn()}<button class="big" id="go">Back to the season</button></div>`);
      $('#go').onclick = () => { lastReels = []; hub(); }; if (!sim) reelWire();
    };
    if (!play) { const ln = simLine(C.me, 'Starter', PB.rand() < 0.5); const a = Math.round((140 + PB.gauss() * 10) * QF()), b0 = Math.round((140 + PB.gauss() * 10) * QF()), b = b0 + (a === b0 ? 1 : 0); done(a, b, ln, true); return; }
    scr().hidden = true;
    PB.Game.start({ teams: [T(mine), T(other)], rosters: [us, them], userId: 'me', qlen: S.qlen, level: 'All-Star', callIntro: 'allstar', floor: PB.team(C.team), strength: [90, 90],
      onEnd: r => { lastReels = r.reels || []; done(r.score[0], r.score[1], r.user, false); } });
  }
  /* Rising Stars: the rookies against the sophomores, the best at every position on each side, you on yours */
  function risingStars(play) {
    const all = []; for (const t of PB.TEAMS) for (const p of C.rosters[t.id]) if (p.id !== C.me.id) all.push(p);
    const roo = all.filter(p => p.rookie || p.age <= 20), soph = all.filter(p => !p.rookie && p.age >= 21 && p.age <= 23);
    const best = pool => PB.POS.map(pos => pool.filter(p => p.pos === pos).sort((a, b) => b.ovr - a.ovr)[0] || pool.sort((a, b) => b.ovr - a.ovr)[0]);
    const mineRook = C.year === 1, us = best(mineRook ? roo : soph), them = best(mineRook ? soph : roo);
    us[PB.POS.indexOf(C.me.pos)] = C.me;
    const T = rook => ({ id: rook ? 'ROO' : 'SOP', ab: rook ? 'ROOK' : 'SOPH', city: rook ? 'Team' : 'Team', name: rook ? 'Rookies' : 'Sophomores', c1: rook ? '#ff7a1a' : '#2f8f6b', c2: '#ffffff', conf: 'East' });
    const done = (a, b, line, sim) => {
      C.rising = 'done';
      const win = a > b, big = line && line.pts / QF() >= 20 && win;
      if (big) { C.trophies.push(`Rising Stars MVP, season ${C.year}`); C.fans = Math.round(C.fans * 1.08); }
      C.news.unshift(`Rising Stars: the ${win === mineRook ? 'rookies' : 'sophomores'} win ${Math.max(a, b)}-${Math.min(a, b)}${big ? `; ${C.me.last} is the MVP` : ''}`);
      save();
      show(`<div class="page post"><p class="kick">Rising Stars</p><div class="final"><div><b>${a}</b><span>${mineRook ? 'Rookies' : 'Sophomores'}</span></div><em>${win ? 'WIN' : 'LOSS'}</em><div><b>${b}</b><span>${mineRook ? 'Sophomores' : 'Rookies'}</span></div></div>
        ${line ? `<div class="tiles"><div><b>${line.pts}</b><span>PTS</span></div><div><b>${line.reb}</b><span>REB</span></div><div><b>${line.ast}</b><span>AST</span></div></div>` : ''}
        ${big ? '<div class="card earn"><b>Rising Stars MVP</b><span>The league noticed.</span></div>' : ''}${sim ? '' : reelBtn()}<button class="big" id="go">Back to the season</button></div>`);
      $('#go').onclick = () => { lastReels = []; hub(); }; if (!sim) reelWire();
    };
    if (!play) { const ln = simLine(C.me, 'Starter', PB.rand() < 0.5); const a = Math.round((135 + PB.gauss() * 10) * QF()), b0 = Math.round((135 + PB.gauss() * 10) * QF()), b = b0 + (a === b0 ? 1 : 0); done(a, b, ln, true); return; }
    scr().hidden = true;
    PB.Game.start({ teams: [T(mineRook), T(!mineRook)], rosters: [us, them], userId: 'me', qlen: S.qlen, level: 'Pro', floor: PB.team(C.team), strength: [75, 75],
      onEnd: r => { lastReels = r.reels || []; done(r.score[0], r.score[1], r.user, false); } });
  }
  /* the 3-Point Contest: you and seven of the league's shooters, five racks, a money ball at the end of each */
  function contestField() {
    const field = [];
    const all = []; for (const t of PB.TEAMS) for (const p of C.rosters[t.id]) all.push([p, t.id]);
    all.sort((a, b) => b[0].r.three - a[0].r.three);
    for (const [p, tid] of all.slice(0, 7)) {
      let sc = 0; const pr = 0.3 + p.r.three / 99 * 0.32;
      for (let r = 0; r < 5; r++) for (let k = 0; k < 5; k++) if (PB.rand() < pr) sc += k === 4 ? 2 : 1;
      field.push({ name: PB.full(p), team: tid, score: sc });
    }
    return field;
  }
  function contestResult(score) {
    const field = contestField().concat([{ name: PB.full(C.me), team: C.team, score, me: true }]).sort((a, b) => b.score - a.score);
    const won = field[0].me;
    C.contest = 'done';
    if (won) { C.trophies.push(`3-Point Contest champion, season ${C.year}`); C.fans = Math.round(C.fans * 1.1); C.me.sp += 5; C.news.unshift(`${C.me.last} wins the 3-Point Contest with ${score}!`); }
    else C.news.unshift(`${field[0].name} wins the 3-Point Contest; ${C.me.last} finishes ${ordinal(field.indexOf(field.find(x => x.me)) + 1)} with ${score}`);
    save();
    show(`<div class="page post awards"><p class="kick">All-Star weekend · 3-Point Contest</p>
      ${field.map((x, i) => `<div class="card aw ${x.me ? 'mine' : ''}"><span>${ordinal(i + 1)}</span><b>${esc(x.name)} <small>${PB.team(x.team).ab} · ${x.score} pts</small></b></div>`).join('')}
      <button class="big" id="go">Back to the season</button></div>`);
    $('#go').onclick = hub;
  }

  /* the Dunk Contest: you and three of the league's fliers; two dunks, the top two to a final of two more */
  function dunkScore(p) {
    const k = ((p.r.dunk || 70) + (p.r.vert || 70)) / 2;
    if (PB.rand() > 0.72 + (k - 70) / 150) return 25 + Math.floor(PB.rand() * 6);
    return PB.clamp(Math.round(5 * (7.6 + (k - 80) / 14 + PB.gauss() * 0.75)), 30, 50);
  }
  function dunkField() {
    const all = []; for (const t of PB.TEAMS) for (const p of C.rosters[t.id]) all.push([p, t.id]);
    all.sort((a, b) => (b[0].r.dunk + b[0].r.vert) - (a[0].r.dunk + a[0].r.vert));
    return all.slice(0, 3).map(([p, tid]) => ({ p, name: PB.full(p), team: tid, r1: dunkScore(p) + dunkScore(p) }));
  }
  function dunkRound(n, D) {
    scr().hidden = true;
    const t = PB.team(C.team);
    PB.Game.start({ teams: [t, t], rosters: [[C.me], []], userId: 'me', drill: 'dunk', dunks: 2, qlen: 1, level: S.level, floor: t,
      onEnd: r => (n === 1 ? dunkAfter1 : dunkFinal)((r.drill && r.drill.score) || 0, D) });
  }
  function dunkAfter1(mine) {
    const field = dunkField().concat([{ name: PB.full(C.me), team: C.team, r1: mine, me: true }]).sort((a, b) => b.r1 - a.r1);
    const on = field.slice(0, 2).some(x => x.me);
    const row = (x, i, k) => `<div class="card aw ${x.me ? 'mine' : ''}"><span>${ordinal(i + 1)}</span><b>${esc(x.name)} <small>${PB.team(x.team).ab} · ${x[k]}</small></b></div>`;
    if (!on) {
      const [a, b] = field.slice(0, 2); a.f = dunkScore(a.p) + dunkScore(a.p); b.f = dunkScore(b.p) + dunkScore(b.p); const w = a.f >= b.f ? a : b;
      C.dunk = 'done'; C.news.unshift(`${w.name} wins the Dunk Contest; ${C.me.last} goes out in the first round with ${mine}`); save();
      show(`<div class="page post awards"><p class="kick">Dunk Contest · first round</p>${field.map((x, i) => row(x, i, 'r1')).join('')}
        <p class="mute">The top two go on. ${esc(w.name)} wins the final, ${Math.max(a.f, b.f)} to ${Math.min(a.f, b.f)}.</p><button class="big" id="go">Back to the season</button></div>`);
      $('#go').onclick = hub; return;
    }
    const other = field.slice(0, 2).find(x => !x.me);
    show(`<div class="page post awards"><p class="kick">Dunk Contest · first round</p>${field.map((x, i) => row(x, i, 'r1')).join('')}
      <p class="mute">You are in the final against ${esc(other.name)}. Two more dunks; the scores start over.</p><button class="big" id="fin">The final</button></div>`);
    $('#fin').onclick = () => dunkRound(2, other);
  }
  function dunkFinal(mine, other) {
    other.f = dunkScore(other.p) + dunkScore(other.p);
    if (other.f === mine) other.f--;
    const won = mine > other.f;
    C.dunk = 'done';
    if (won) { C.trophies.push(`Dunk Contest champion, season ${C.year}`); C.fans = Math.round(C.fans * 1.12); C.me.sp += 5; C.news.unshift(`${C.me.last} wins the Dunk Contest, ${mine} to ${other.f}!`); C.feed.unshift({ who: '@league', text: `${PB.full(C.me)} is your Dunk Contest champion` }); }
    else C.news.unshift(`${other.name} beats ${C.me.last} in the Dunk Contest final, ${other.f} to ${mine}`);
    save();
    show(`<div class="page post awards"><p class="kick">Dunk Contest · the final</p>
      <div class="final"><div><b>${mine}</b><span>You</span></div><em>${won ? 'CHAMPION' : 'SECOND'}</em><div><b>${other.f}</b><span>${esc(other.p.last)}</span></div></div>
      ${won ? '<div class="card earn"><b>Dunk Contest champion</b><span>+5 skill points, and a lot more followers.</span></div>' : ''}<button class="big" id="go">Back to the season</button></div>`);
    $('#go').onclick = hub;
  }

  /* ---------- the playoffs ---------- */
  const ROUNDS = ['Play-In', 'Play-In', 'First round', 'Conference semifinals', 'Conference finals', 'Finals'];
  function startPlayoffs() {
    const bo = { 10: 1, 20: 3, 41: 5, 82: 7 }[C.len] || 3;
    const seeds = { East: confRank('East'), West: confRank('West') };
    C.phase = 'playoffs';
    C.poStats = zero();
    C.po = { round: 0, bo, seeds, series: [], games: [], champ: null, seed8: {}, seed7: {} };
    for (const c of ['East', 'West']) {
      const s = seeds[c];
      C.po.series.push(mkSeries(s[6], s[7], 1, c, 'Play-In · 7 vs 8'), mkSeries(s[8], s[9], 1, c, 'Play-In · 9 vs 10'));
    }
    const mine = seeds[PB.team(C.team).conf].indexOf(C.team) + 1;
    C.news.unshift(mine <= 6 ? `Playoffs! The ${PB.team(C.team).name} are the ${ordinal(mine)} seed.` : mine <= 10 ? `The ${PB.team(C.team).name} are in the play-in as the ${ordinal(mine)} seed.` : `The season is over for the ${PB.team(C.team).name}: ${ordinal(mine)} in the ${PB.team(C.team).conf}.`);
    save();
  }
  const mkSeries = (a, b, bo, conf, tag) => ({ a, b, wa: 0, wb: 0, bo, conf, tag });
  const done = sr => sr.wa > sr.bo / 2 || sr.wb > sr.bo / 2;
  const winner = sr => sr.wa > sr.wb ? sr.a : sr.b, loser = sr => sr.wa > sr.wb ? sr.b : sr.a;
  /* still in it: a top-six seed during the play-in, or in a series this round that is not lost */
  function alive() {
    const P = C.po; if (!P) return false;
    if (P.round < 2 && P.seeds[PB.team(C.team).conf].indexOf(C.team) < 6) return true;
    return P.series.some(sr => (sr.a === C.team || sr.b === C.team) && (!done(sr) || winner(sr) === C.team));
  }
  function mySeries() { return C.po && C.po.series.find(sr => !done(sr) && (sr.a === C.team || sr.b === C.team)); }
  function simSeriesGame(sr) {
    const n = sr.wa + sr.wb + 1, homeHigh = [1, 2, 5, 7].includes(n);
    if (PB.rand() < winP(sr.a, sr.b, homeHigh)) sr.wa++; else sr.wb++;
  }
  /* your game counts in your series; every other series in the round plays one game; the round ends when all are done */
  function playoffResult(win) {
    const sr = mySeries();
    if (sr) { if ((sr.a === C.team) === win) sr.wa++; else sr.wb++; }
    for (const o of C.po.series) if (o !== sr && !done(o) && o.a !== C.team && o.b !== C.team) simSeriesGame(o);
    if (sr && done(sr)) C.news.unshift(winner(sr) === C.team ? `${PB.team(C.team).name} win the ${sr.tag.toLowerCase()} ${sr.bo > 1 ? Math.max(sr.wa, sr.wb) + '-' + Math.min(sr.wa, sr.wb) : ''}` : `Eliminated: the ${PB.team(winner(sr)).name} end the ${PB.team(C.team).name}' run`);
    if (C.po.series.every(done)) nextRound();
  }
  function simPlayoffRound() {
    for (const sr of C.po.series) while (!done(sr)) simSeriesGame(sr);
    nextRound();
  }
  function nextRound() {
    const P = C.po, S2 = P.series;
    const r = P.round;
    { const picked = S2.filter(sr => sr.pick && done(sr)), right = picked.filter(sr => winner(sr) === sr.pick).length;
      if (picked.length) { const K = C.picker || (C.picker = { n: 0, right: 0 }); K.n += picked.length; K.right += right; C.me.sp += right; C.fans = Math.round(C.fans + right * 300);
        C.news.unshift(`Playoff Picker: ${right} of ${picked.length} right this round${right ? `, +${right} skill point${right > 1 ? 's' : ''}` : ''}`); } }
    if (r === 0) {
      P.series = [];
      for (const c of ['East', 'West']) {
        const s78 = S2.find(x => x.conf === c && /7 vs 8/.test(x.tag)), s910 = S2.find(x => x.conf === c && /9 vs 10/.test(x.tag));
        P.seed7[c] = winner(s78);
        P.series.push(mkSeries(loser(s78), winner(s910), 1, c, 'Play-In · for the 8th seed'));
      }
    } else if (r === 1) {
      P.series = [];
      for (const c of ['East', 'West']) {
        P.seed8[c] = winner(S2.find(x => x.conf === c));
        const s = P.seeds[c], seed = [s[0], s[1], s[2], s[3], s[4], s[5], P.seed7[c], P.seed8[c]];
        for (const [i, j] of [[0, 7], [3, 4], [2, 5], [1, 6]]) P.series.push(mkSeries(seed[i], seed[j], P.bo, c, ROUNDS[2]));
      }
    } else if (r === 2 || r === 3) {
      P.series = [];
      for (const c of ['East', 'West']) {
        const w = S2.filter(x => x.conf === c).map(winner);
        for (let i = 0; i + 1 < w.length; i += 2) P.series.push(mkSeries(w[i], w[i + 1], P.bo, c, ROUNDS[r + 1]));
      }
    } else if (r === 4) {
      const e = winner(S2.find(x => x.conf === 'East')), w = winner(S2.find(x => x.conf === 'West'));
      const better = (C.standings[e].w - C.standings[e].l) >= (C.standings[w].w - C.standings[w].l);
      P.series = [mkSeries(better ? e : w, better ? w : e, P.bo, 'Finals', ROUNDS[5])];
      C.news.unshift(`The Finals: ${PB.team(e).name} vs ${PB.team(w).name}`);
    } else {
      P.champ = winner(S2[0]);
      C.news.unshift(`The ${tname(PB.team(P.champ))} are champions!`);
      if (P.champ === C.team) { PB.confetti([PB.team(C.team).c1, PB.team(C.team).c2], 7); C.trophies.push(`Champion, season ${C.year}`); if (C.trophies.filter(x => /^Champion, /.test(x)).length === 1) (C.cs = C.cs || []).push('champ'); C.fans = Math.round(C.fans * 1.4); C.me.sp += 10; banner(C.team, { kind: 'title', text: `Season ${C.year}` }); }
    }
    P.round++;
    save();
  }
  function bracketCard() {
    const P = C.po; if (!P) return '';
    /* the Playoff Picker: before a series starts, pick who wins it; every right pick pays when the round is over */
    const pk = (sr, i, side) => { const id = side ? sr.b : sr.a, open = !done(sr) && sr.wa + sr.wb === 0 && !sr.pick; return open ? `<button class="pick" data-pick="${i}" data-t="${id}">${badge(PB.team(id))}</button>` : `<span class="pk ${sr.pick === id ? (done(sr) ? (winner(sr) === id ? 'ok' : 'no') : 'on') : ''}">${badge(PB.team(id))}</span>`; };
    const row = (sr, i) => `<div class="sr ${sr.a === C.team || sr.b === C.team ? 'me' : ''}">${pk(sr, i, 0)}<b>${sr.wa}</b><em>–</em><b>${sr.wb}</b>${pk(sr, i, 1)}<span>${done(sr) ? PB.team(winner(sr)).name + (sr.bo > 1 ? ' win' : ' advance') : sr.bo > 1 ? 'best of ' + sr.bo : 'one game'}</span></div>`;
    const open = !P.champ && P.series.some(sr => !done(sr) && sr.wa + sr.wb === 0 && !sr.pick);
    return `<div class="card bracket"><h3>${P.champ ? 'Champions: ' + esc(tname(PB.team(P.champ))) : esc(P.series[0] ? P.series[0].tag : 'Playoffs')}${C.picker ? ` <small>Picker ${C.picker.right} of ${C.picker.n}</small>` : ''}</h3>${P.series.map(row).join('')}
      ${open ? '<p class="fine">Playoff Picker: tap the team you think wins each series. A right pick is worth a skill point when the round ends.</p>' : ''}</div>`;
  }

  /* ---------- awards night and the end of a season ---------- */
  /* the league's best: two from every team, with a season line from their ratings */
  function leagueStars() {
    const out = [];
    for (const t of PB.TEAMS) {
      const ro = C.rosters[t.id].slice().sort((a, b) => b.ovr - a.ovr).slice(0, 2);
      const wp = C.standings[t.id].w / Math.max(1, C.standings[t.id].w + C.standings[t.id].l);
      for (const p of ro) {
        const ppg = Math.max(4, 6 + (p.ovr - 62) * 0.85 + PB.gauss() * 2.5);
        const rpg = Math.max(1, (p.r.reb - 35) / 7 + PB.gauss()), apg = Math.max(0.5, (p.r.pass - 35) / 8 + PB.gauss());
        out.push({ name: PB.full(p), team: t.id, ppg, rpg, apg, dpg: (p.r.perD + p.r.block + p.r.steal + p.r.inD) / 160 + PB.gauss() * 0.3, score: ppg + (rpg + apg) * 0.5 + wp * 12, rookie: !!p.rookie, wp });
      }
    }
    return out;
  }
  /* the season's leaders: everyone with enough games, you at full-length equivalents */
  function leaders() {
    const min = Math.max(1, Math.floor(C.gi * 0.4));
    const rows = Object.values(C.ls || {}).filter(e => e.gp >= min);
    const A = C.adj;
    if (A && A.gp) rows.push({ name: PB.full(C.me), team: C.team, gp: A.gp, pts: A.pts, reb: A.reb, ast: A.ast, stl: A.stl, blk: A.blk, tpm: A.tpm, me: true, rookie: C.year === 1 });
    const rv = rivalP(), rs = C.rival && C.rival.season;
    if (rs && rs.gp >= min) rows.push({ name: PB.full(rv), team: C.rival.team, gp: rs.gp, pts: rs.pts, reb: rs.reb, ast: rs.ast, stl: rs.stl, blk: rs.blk, tpm: rs.tpm, rival: true, rookie: C.year === 1 });
    for (const r of rows) for (const k of LS.slice(1)) r[k + 'pg'] = r[k] / r.gp;
    return rows;
  }
  function leadersCard() {
    const rows = leaders();
    if (!rows.length) return '';
    /* what is shown: the league's players at full length (the numbers a real box score would have); yours exactly as you
       played them, not scaled up or down. The order is by what is shown */
    const val = (r, k) => r.me ? r[k] : r[k] / QF();
    const cat = (k, lbl) => { const ord = rows.slice().sort((a, b) => val(b, k) - val(a, k)), top = ord.slice(0, 5);
      const mine = rows.filter(r => r.me)[0], rank = mine ? ord.indexOf(mine) + 1 : 0;
      return `<div class="lcat"><b>${lbl}</b>${top.map((r, i) => `<p class="${r.me ? 'me' : r.rival ? 'rv' : ''}" style="--w:${(val(r, k) / (val(top[0], k) || 1)).toFixed(2)}"><span>${i + 1}</span><i>${esc(r.name)} <small>${PB.team(r.team).ab}</small></i><em>${val(r, k).toFixed(1)}</em></p>`).join('')}${mine && rank > 5 ? `<p class="me"><span>${rank}</span><i>You</i><em>${val(mine, k).toFixed(1)}</em></p>` : ''}</div>`; };
    return `<div class="card leaders"><h3>League leaders <small>per game · yours exactly as you played them</small></h3>${cat('ptspg', 'Points')}${cat('rebpg', 'Rebounds')}${cat('astpg', 'Assists')}${cat('stlpg', 'Steals')}${cat('blkpg', 'Blocks')}${cat('tpmpg', 'Threes made')}</div>`;
  }
  /* a coach for every bench: the same name all career (kept on the save) */
  function coachOf(tid) { const K = C.coaches || (C.coaches = {}); if (!K[tid]) K[tid] = PB.randName(); return K[tid]; }
  /* hot zones: a spot where you have made a living this season (at least four tries, and six points over what the
     league shoots there). The shot goes in a little more often from one, the way a shooter trusts his spots. */
  const zoneHeat = (k, Z) => { const e = (Z || {})[k]; if (!e || e[1] < 4) return 0; const pct = e[0] / e[1] * 100, lg = PB.ZONES[k][2]; return pct >= lg + 6 ? 1 : pct <= lg - 9 ? -1 : 0; };
  const hotZones = () => Object.keys(PB.ZONES).filter(k => zoneHeat(k, C.zones) > 0);
  function zonesCard() {
    const Z = C.zones && Object.keys(C.zones).length ? C.zones : null, ZA = C.zonesAll || {};
    const X = x => 150 + x * 5.6, Y = a => 20 + a * 5.6;
    const arc = []; for (let t = -1.18; t <= 1.18; t += 0.04) arc.push(`${X(Math.sin(t) * 23.75).toFixed(1)},${Y(Math.cos(t) * 23.75).toFixed(1)}`);
    const src = Z || ZA, any = Object.keys(src).length;
    const lab = k => { const e = src[k], [x, a] = PB.ZONES[k], h = zoneHeat(k, src); if (!e) return `<text x="${X(x)}" y="${Y(a)}" class="zt none">–</text>`;
      return `<g class="zt ${h > 0 ? 'hot' : h < 0 ? 'cold' : ''}"><circle cx="${X(x)}" cy="${Y(a) - 1}" r="15"/><text x="${X(x)}" y="${Y(a) - 2}">${Math.round(e[0] / e[1] * 100)}%</text><text x="${X(x)}" y="${Y(a) + 8}" class="sm">${e[0]}/${e[1]}</text></g>`; };
    return `<div class="card"><h3>Hot zones <small>${Z ? 'this season' : any ? 'career' : 'no shots yet'}</small></h3><svg viewBox="0 0 300 200" class="chart zones">
      <rect x="10" y="0" width="280" height="200" rx="6" class="floor"/><rect x="${X(-8)}" y="0" width="${16 * 5.6}" height="${Y(13.75)}" class="paint"/>
      <line x1="${X(-22)}" y1="0" x2="${X(-22)}" y2="${Y(8.95)}" class="ln"/><line x1="${X(22)}" y1="0" x2="${X(22)}" y2="${Y(8.95)}" class="ln"/><polyline points="${arc.join(' ')}" class="ln" fill="none"/><circle cx="${X(0)}" cy="${Y(0)}" r="4.5" class="rim"/>
      ${Object.keys(PB.ZONES).map(lab).join('')}</svg>
      <p class="fine">Green is a hot zone (well above what the league shoots there, on four tries or more): your shot is a little better from it. Red is a cold one, and costs you nothing.</p></div>`;
  }
  /* the League tab's Schedule page: last night's scores around the league, and your season game by game */
  function scheduleCard() {
    const rec = id => { const x = C.standings[id]; return x ? `${x.w}-${x.l}` : ''; };
    const sc = (C.scores || []).length ? `<div class="card awteam"><h3>Around the league <small>last night</small></h3>${C.scores.map(([w, sw, l, sl, wHome]) => `<p><i>${PB.team(w).ab} <b>${sw}</b>, ${PB.team(l).ab} ${sl}</i><small>${wHome ? 'home win' : 'road win'}</small><em>${rec(w)} · ${rec(l)}</em></p>`).join('')}</div>` : '';
    const rows = (C.games || []).map((g, i) => { const o = PB.team(g.opp), r = g.res;
      return `<p class="${i === C.gi && !g.done ? 'me' : ''}"><i>${i + 1}. ${g.home ? 'vs' : 'at'} ${o.name}${C.rival && g.opp === C.rival.team ? ' <small class="rv-dot">rival</small>' : ''}</i><small>${g.done && r ? '' : rec(g.opp) + (g.b2b ? ' · b2b' : '')}</small><em>${g.done && r ? `${r.win ? 'W' : 'L'} ${r.us}-${r.them}${r.ot ? ' OT' : ''}${r.sim ? '' : ' · ' + (r.line ? r.line.pts : 0) + ' pts'}` : i === C.gi ? 'next' : ''}</em></p>`; }).join('');
    return sc + `<div class="card awteam"><h3>${PB.team(C.team).name} schedule <small>${rec(C.team)}</small></h3>${rows || '<p class="mute">The schedule comes out with the season.</p>'}</div>`;
  }
  /* the League tab's Awards page: who is leading each race right now, and who won what in the seasons behind you */
  function awardsCard() {
    const q = (S.qlen || 3) / 12, rows = leaders(), wpOf = t => { const x = C.standings[t]; return x.w / Math.max(1, x.w + x.l); };
    for (const r of rows) { r.mv = r.ptspg + (r.rebpg + r.astpg) * 0.5 + (r.stlpg + r.blkpg) * 0.8 + wpOf(r.team) * 12 * q; r.df = (r.stlpg + r.blkpg) * 2.2 + r.rebpg * 0.15 + wpOf(r.team) * 3 * q; }
    const ladder = (title, list, k, fmt) => { const top = list.slice().sort((a, b) => b[k] - a[k]), five = top.slice(0, 5), mine = top.find(r => r.me), rk = mine ? top.indexOf(mine) + 1 : 0;
      if (!five.length) return '';
      return `<div class="card awteam"><h3>${title}</h3>${five.map((r, i) => `<p class="${r.me ? 'me' : ''}"><i>${i + 1}. ${esc(r.name)}</i><small>${PB.team(r.team).ab}</small><em>${fmt(r)}</em></p>`).join('')}${mine && rk > 5 ? `<p class="me"><i>${rk}. You</i><small></small><em>${fmt(mine)}</em></p>` : ''}</div>`; };
    const pq = r => r.me ? 1 : q, pra = r => `${(r.ptspg / pq(r)).toFixed(1)} / ${(r.rebpg / pq(r)).toFixed(1)} / ${(r.astpg / pq(r)).toFixed(1)}`, sb = r => `${(r.stlpg / pq(r)).toFixed(1)} stl · ${(r.blkpg / pq(r)).toFixed(1)} blk`;
    const race = rows.length ? ladder('MVP race', rows, 'mv', pra) + ladder('Defensive Player of the Year race', rows, 'df', sb) + ladder('Rookie of the Year race', rows.filter(r => r.rookie), 'mv', pra)
      : '<div class="card"><p class="mute">The races take shape once a few games are played.</p></div>';
    const past = (C.awardsLog || []).map(z => `<div class="card awteam"><h3>Season ${z.year}${z.champ ? ` <small>champions: ${PB.team(z.champ).name}</small>` : ''}</h3>${z.list.map(([t, n, tm]) => `<p class="${n === PB.full(C.me) ? 'me' : ''}"><i>${t}</i><small>${esc(n)} · ${PB.team(tm).ab}</small></p>`).join('')}
      ${(z.teams || []).filter(x => /First/.test(x[0])).map(([t, l]) => `<p><i>${t}</i></p><p class="fine">${l.map(([n, tm]) => `${esc(n)} (${PB.team(tm).ab})`).join(', ')}</p>`).join('')}</div>`).join('');
    return race + past + '<p class="fine">Voted at the end of the regular season: Most Valuable Player, Defensive Player, Rookie, Sixth Man, Most Improved and Clutch Player of the Year, Coach of the Year, three All-League teams, two All-Defensive teams and the All-Rookie team.</p>';
  }
  function awardsNight() {
    const s = C.season, gp = s.gp || 1, me = C.me, q = (S.qlen || 3) / 12;   // every line here is at the length your games are played
    const wpOf = t => { const x = C.standings[t]; return x.w / Math.max(1, x.w + x.l); };
    const find = (name, team) => (C.rosters[team] || []).find(p => PB.full(p) === name);
    const dr = p => p ? (p.r.perD + p.r.inD + p.r.block + p.r.steal) / 4 : 60;
    const A = C.adj && C.adj.gp ? C.adj : null, mg = A ? A.gp : gp, src = A || s;
    const mine = { name: PB.full(me), team: C.team, gp: mg, ppg: src.pts / mg, rpg: src.reb / mg, apg: src.ast / mg, spg: (src.stl || 0) / mg, bpg: (src.blk || 0) / mg, tpg: (src.tpm || 0) / mg, me: true, rookie: C.year === 1, p: me };
    const lr = leaders().filter(r => !r.me);
    let pool = lr.length > 20 ? lr.map(r => ({ name: r.name, team: r.team, gp: r.gp, ppg: r.ptspg, rpg: r.rebpg, apg: r.astpg, spg: r.stlpg, bpg: r.blkpg, tpg: r.tpmpg || 0, rookie: r.rookie, rival: r.rival, p: r.rival ? rivalP() : find(r.name, r.team) }))
      : leagueStars().map(x => ({ name: x.name, team: x.team, gp, ppg: x.ppg * q, rpg: x.rpg * q, apg: x.apg * q, spg: x.dpg * 0.6 * q, bpg: x.dpg * 0.4 * q, tpg: 0, rookie: x.rookie, p: find(x.name, x.team) }));
    pool = pool.concat([mine]);
    for (const x of pool) { x.dpg = x.spg + x.bpg; x.wp = wpOf(x.team);
      x.score = x.ppg + (x.rpg + x.apg) * 0.5 + x.dpg * 0.8 + x.wp * 12 * q + (x.me ? (s.grades / gp - 6) * 0.6 * q : 0);
      x.dscore = x.dpg * 2.2 + x.rpg * 0.15 + (dr(x.p) - 60) / 14 * q + x.wp * 3 * q; }
    const by = (list, k) => list.slice().sort((a, b) => b[k] - a[k]);
    const stars = by(pool, 'score'), defs = by(pool, 'dscore');
    const aw = [], got = [], teams = [];
    const give = (title, w, note) => { if (!w) return false; aw.push([title, w, note]); if (w.me) got.push(title); return !!w.me; };
    give('Most Valuable Player', stars[0]);
    give('Defensive Player of the Year', defs[0]);
    /* rookies: the league's first-year starters, your rival and you in your first season */
    const rooks = by(pool.filter(x => x.rookie), 'score');
    while (rooks.length < 5) { const t = PB.pick(PB.TEAMS).id, pl = (C.rosters[t] || []).filter(p => p.rookie && !rooks.some(r => r.name === PB.full(p)))[0];
      rooks.push({ name: pl ? PB.full(pl) : PB.randName(), team: t, ppg: (7 + PB.rand() * 6) * q, rpg: (2 + PB.rand() * 4) * q, apg: (1 + PB.rand() * 3) * q, spg: 0.6 * q, bpg: 0.4 * q, dpg: q, rookie: true, score: 0, p: pl }); { const z = rooks[rooks.length - 1]; z.wp = wpOf(t); z.score = z.ppg + (z.rpg + z.apg) * 0.5 + z.dpg * 0.8 + z.wp * 12 * q; } }
    rooks.sort((a, b) => b.score - a.score);
    give('Rookie of the Year', rooks[0]);
    /* the sixth men: the best reserve on each of the better teams, a season off the bench from his ratings */
    const sixth = [];
    for (const t of PB.TEAMS) { const five = starters(t.id).map(p => p && p.id), res = (C.rosters[t.id] || []).filter(p => !five.includes(p.id) && !(C.rival && p.id === C.rival.id)).sort((a, b) => b.ovr - a.ovr)[0]; if (!res) continue;
      let pts = 0, reb = 0, ast = 0; const n = 6; for (let i = 0; i < n; i++) { const ln = simLine(res, 'Sixth man', PB.rand() < wpOf(t.id)); pts += ln.pts; reb += ln.reb; ast += ln.ast; }
      const x = { name: PB.full(res), team: t.id, ppg: pts / n, rpg: reb / n, apg: ast / n, p: res }; x.score = x.ppg + (x.rpg + x.apg) * 0.4 + wpOf(t.id) * 6 * q; sixth.push(x); }
    if (role() !== 'Starter') { const x = Object.assign({}, mine); x.score = x.ppg + (x.rpg + x.apg) * 0.4 + x.wp * 6 * q; sixth.push(x); }
    give('Sixth Man of the Year', by(sixth, 'score')[0]);
    /* most improved: this season's scoring against last season's (kept from the year before) */
    const prev = C.lsPrev || {}, imp = pool.filter(x => !x.rookie && (x.me ? C.prevPpg !== undefined : x.p && prev[x.p.id] !== undefined) && x.ppg >= 10 * q)
      .map(x => Object.assign({}, x, { score: x.ppg - (x.me ? C.prevPpg : prev[x.p.id]), was: x.me ? C.prevPpg : prev[x.p.id] }));
    if (imp.length) { const w = by(imp, 'score')[0]; if (w.score > 1.5 * q) give('Most Improved Player', w, `from ${w.was.toFixed(1)} a game`); }
    /* clutch: scorers who close games, by their shooting and their team's record */
    const cl = pool.map(x => Object.assign({}, x, { score: x.ppg * 0.6 + ((x.p ? (x.p.r.mid + x.p.r.three + x.p.r.ft) / 3 : 70) - 60) / 6 * q + x.wp * 6 * q + (x.me ? (s.clutch || 0) / gp * 1.5 : PB.gauss() * 1.2 * q) }));
    give('Clutch Player of the Year', by(cl, 'score')[0]);
    /* the coach whose team did the most with what it had */
    { const rows = PB.TEAMS.map(t => ({ t: t.id, over: wpOf(t.id) - 1 / (1 + Math.exp(-(strength(t.id) - 76) / 4)) + wpOf(t.id) * 0.25 })).sort((a, b) => b.over - a.over)[0];
      aw.push(['Coach of the Year', { name: coachOf(rows.t), team: rows.t, coach: true, rec: C.standings[rows.t] }]); }
    /* the teams */
    const five = (title, list, from, key) => { const t = list.slice(from, from + 5); if (t.length < 5) return; teams.push([title, t]); if (t.some(x => x.me)) got.push(title); };
    five('All-League First Team', stars, 0); five('All-League Second Team', stars, 5); five('All-League Third Team', stars, 10);
    five('All-Defensive First Team', defs, 0); five('All-Defensive Second Team', defs, 5);
    five('All-Rookie First Team', rooks, 0);
    /* the titles: the league's leaders, with enough games played */
    const titles = [['Scoring champion', 'ppg', 'points'], ['Rebounding leader', 'rpg', 'rebounds'], ['Assists leader', 'apg', 'assists'], ['Steals leader', 'spg', 'steals'], ['Blocks leader', 'bpg', 'blocks']]
      .map(([t, k, w]) => { const l = by(pool.filter(x => x.gp === undefined || x.gp >= Math.max(1, Math.floor(C.gi * 0.4))), k)[0]; if (l && l.me) got.push(t); return [t, l, k, w]; }).filter(x => x[1]);
    const rank = stars.indexOf(mine);
    if (C.po && C.po.champ === C.team && C.poStats && C.poStats.gp && C.poStats.pts / C.poStats.gp >= Math.max(mine.ppg * 0.9, 14 * q)) got.push('Finals MVP');
    if (s.allstar) got.unshift('All-Star');
    if (C.po && C.po.champ === C.team) got.unshift('Champion');
    for (const g of got) if (!/Champion|All-Star$/.test(g)) C.trophies.push(`${/^MVP|Most Valuable/.test(g) ? 'MVP' : g}, season ${C.year}`);
    C.me.sp += got.length * 3;
    /* kept: next year's most improved needs this year's scoring, and the League tab shows who won what */
    C.lsPrev = {}; for (const x of pool) if (x.p && !x.me) C.lsPrev[x.p.id] = x.ppg; C.prevPpg = mine.ppg;
    (C.awardsLog = C.awardsLog || []).unshift({ year: C.year, champ: C.po && C.po.champ, list: aw.map(([t, w]) => [t, w.name, w.team]), teams: teams.map(([t, l]) => [t, l.map(x => [x.name, x.team])]) }); C.awardsLog.length = Math.min(C.awardsLog.length, 12);
    C.lastGot = got; C.phase = 'offseason'; save();   // awards are handed out once, even if the page is reloaded
    const f1 = v => v.toFixed(1);
    const line = x => x.coach ? `${esc(x.name)} <small>${PB.team(x.team).ab} · ${x.rec.w}-${x.rec.l}</small>` : `${esc(x.name)} <small>${PB.team(x.team).ab} · ${f1(x.ppg)} / ${f1(x.rpg)} / ${f1(x.apg)}</small>`;
    const in3d = got.length && !PB.noGL && PB.R.modelReady && PB.R.modelReady();
    show(`<div class="page post awards ${in3d ? 'draft over3d' : ''}"><p class="kick">Awards night · Season ${C.year}</p>
      ${in3d ? `<h2>${esc(got[0])}</h2><div class="spacer"></div>` : ''}
      ${aw.map(([t, w, note]) => { const im = w.coach ? null : w.me ? portrait() : w.p ? matchShot(w.p, PB.team(w.team)) : null;
        return `<div class="card aw ${w.me ? 'mine' : ''} ${im ? 'withimg' : ''}">${im ? `<img alt="" src="${im}" style="--tc:${PB.team(w.team).c1}">` : ''}<div><span>${t}</span><b>${line(w)}</b>${note ? `<small class="mute">${esc(note)}</small>` : ''}</div></div>`; }).join('')}
      ${teams.map(([t, l]) => `<div class="card awteam ${l.some(x => x.me) ? 'mine' : ''}"><h3>${t}</h3>${l.map(x => `<p class="${x.me ? 'me' : ''}"><i>${esc(x.name)}</i><small>${PB.team(x.team).ab}</small><em>${f1(x.ppg)} / ${f1(x.rpg)} / ${f1(x.apg)}</em></p>`).join('')}</div>`).join('')}
      <div class="card awteam"><h3>The titles</h3>${titles.map(([t, l, k, w]) => `<p class="${l.me ? 'me' : ''}"><i>${t}</i><small>${esc(l.name)} · ${PB.team(l.team).ab}</small><em>${f1(l[k])}</em></p>`).join('')}</div>
      <div class="card"><h3>Your honors</h3>${got.length ? got.map(a => `<p class="news">🏆 ${esc(a)}</p>`).join('') : '<p class="mute">None this year. Next year.</p>'}
      ${rank < 15 ? '' : `<p class="fine">The voters had you ${ordinal(rank + 1)} in the league; the top fifteen make an All-League team.</p>`}</div>
      <button class="big" id="go">Season review</button></div>`);
    if (in3d) { scr().classList.add('over3d'); PB.R.showcase(C.me, PB.team(C.team)); }
    $('#go').onclick = () => seasonEnd(got);
  }
  function seasonEnd(got) {
    const s = C.season, gp = s.gp || 1, me = C.me;
    const ppg = s.pts / gp, rpg = s.reb / gp, apg = s.ast / gp;
    const st = C.standings[C.team];
    const rank = confRank(PB.team(C.team).conf).indexOf(C.team) + 1;
    const aw = (got || []).slice();
    const how = C.po && C.po.champ === C.team ? 'Champions' : C.po && C.po.games.length ? `Playoffs: ${C.poStats.w}-${C.poStats.l}` : 'No playoffs';
    if (!C.seasons.find(z => z.year === C.year)) C.seasons.push({ year: C.year, team: C.team, w: st.w, l: st.l, ppg: ppg.toFixed(1), rpg: rpg.toFixed(1), apg: apg.toFixed(1), awards: aw,
      gp: s.gp, mpg: s.min ? +(s.min / gp).toFixed(1) : null, spg: +((s.stl || 0) / gp).toFixed(1), bpg: +((s.blk || 0) / gp).toFixed(1), fg: s.fga ? Math.round(s.fgm / s.fga * 100) : null, tp: s.tpa ? Math.round(s.tpm / s.tpa * 100) : null, ft: s.fta ? Math.round(s.ftm / s.fta * 100) : null });
    if (s.gp >= Math.min(10, C.len || 10)) {   // a full season's line, for the record book
      const RB = load('pbb.records') || {}; RB.season = RB.season || {};
      for (const [k, v] of [['ppg', ppg], ['rpg', rpg], ['apg', apg]]) if (v > ((RB.season[k] || {}).v || 0)) RB.season[k] = { v: +v.toFixed(1), name: PB.full(me), team: C.team, year: C.year };
      store('pbb.records', RB);
    }
    C.phase = 'offseason'; save();
    show(`<div class="page post"><p class="kick">Season ${C.year} is over</p>
      <h2>${st.w}-${st.l} · ${ordinal(rank)} in the ${PB.team(C.team).conf}</h2><p class="mute">${how}</p>
      <div class="tiles"><div><b>${ppg.toFixed(1)}</b><span>PPG</span></div><div><b>${rpg.toFixed(1)}</b><span>RPG</span></div><div><b>${apg.toFixed(1)}</b><span>APG</span></div></div>
      <div class="card"><h3>Honors</h3>${aw.length ? aw.map(a => `<p class="news">🏆 ${esc(a)}</p>`).join('') : '<p class="mute">None this year. Next year.</p>'}</div>
      <div class="card"><h3>Contract</h3><p>${C.contract ? `${C.contract.kind}: ${C.contract.years - 1 > 0 ? (C.contract.years - 1) + ' more season' + (C.contract.years - 1 > 1 ? 's' : '') : 'it ends now'} at ${M(C.contract.salary)} a year.` : ''} Career earnings ${M(C.earnings || 0)}.</p></div>
      <p class="fine">Young players grow over the summer, players past thirty slow down; you get 6 skill points.</p>
      <button class="big" id="go">The offseason</button>${me.age >= 33 ? '<button class="ghost" id="retire">Retire</button>' : ''}</div>`);
    if ($('#retire')) $('#retire').onclick = () => { if (confirm('Retire now? Your career ends here and the Hall of Fame votes.')) hallOfFame(); };
    $('#go').onclick = () => offseason(() => camp(() => {
      C.year++; me.age++;
      /* past thirty the legs go first */
      if (me.age >= 30) for (const k of ['speed', 'vert', 'dunk', 'perD', 'steal', 'block']) me.r[k] = PB.clamp(me.r[k] - PB.ri(me.age >= 33 ? 2 : 1, me.age >= 33 ? 5 : 3), 25, 99);
      me.ovr = PB.ovr(me.r, me.pos);
      for (const id in C.rosters) for (const p of C.rosters[id]) {
        const d = p.age < 24 ? 2 : p.age < 29 ? 0.5 : p.age < 32 ? -1 : -3;
        p.age++; p.rookie = false; for (const k in p.r) p.r[k] = PB.clamp(Math.round(p.r[k] + d + PB.gauss()), 25, 99); p.ovr = PB.ovr(p.r, p.pos);
      }
      me.sp += 6;
      leagueSummer();
      newSeason(); save(); tab = 'home'; hub();
    }));
  }
  /* training camp: one thing to work on all summer. Shooting and finishing have a drill that sets how much you gain;
     the rest is the work itself. Past thirty the gains come slower. */
  const CAMP = [
    { k: 'shoot', name: 'Shooting', what: 'Three-point, mid-range, free throws', attrs: ['three', 'mid', 'ft'], drill: 'combine' },
    { k: 'finish', name: 'Finishing', what: 'Close shots, dunks, your vertical', attrs: ['close', 'dunk', 'vert'], drill: 'dunk' },
    { k: 'play', name: 'Playmaking', what: 'Handle, passing, speed', attrs: ['handle', 'pass', 'speed'] },
    { k: 'def', name: 'Defense', what: 'Perimeter and interior D, steals, blocks', attrs: ['perD', 'inD', 'steal', 'block'] },
    { k: 'glass', name: 'The glass', what: 'Rebounding, strength inside, vertical', attrs: ['reb', 'inD', 'vert'] },
  ];
  function camp(next) {
    const me = C.me;
    show(`<div class="page post"><p class="kick">Training camp</p><h2>What do you work on this summer?</h2>
      <p class="mute">One focus. Shooting and finishing come with a drill: the better you do, the more you gain.</p>
      ${CAMP.map(c => `<button class="ghost camp" data-k="${c.k}">${c.name}<small>${c.what}${c.drill ? ' · drill' : ''}</small></button>`).join('')}
      <button class="ghost sm" id="skipcamp">Rest this summer</button></div>`);
    $('#skipcamp').onclick = next;
    scr().querySelectorAll('.camp').forEach(b => b.onclick = () => {
      const c = CAMP.find(x => x.k === b.dataset.k);
      if (!c.drill) { campResult(c, PB.rand() < 0.5 ? 1 : 2, next); return; }
      scr().hidden = true;
      const t = PB.team(C.team);
      PB.Game.start({ teams: [t, t], rosters: [[me], []], userId: 'me', drill: c.drill, dunks: 3, qlen: 1, level: S.level, floor: t,
        onEnd: r => { const d = r.drill || { score: 0 }; const g = c.drill === 'dunk' ? (d.score >= 132 ? 3 : d.score >= 112 ? 2 : 1) : (d.score >= 10 ? 3 : d.score >= 7 ? 2 : 1); campResult(c, g, next, d.score); } });
    });
  }
  function campResult(c, g, next, score) {
    const me = C.me, A = PB.ARCH[me.arch], old = me.age >= 31;
    const got = [];
    for (const k of c.attrs) {
      const add = old ? Math.max(0, g - 1 - (PB.rand() < 0.5 ? 1 : 0)) : g - (c.attrs.length > 3 && PB.rand() < 0.5 ? 1 : 0);
      const v = PB.clamp(me.r[k] + add, 25, A.cap[k]), d = v - me.r[k];
      if (d > 0) { me.r[k] = v; got.push(`+${d} ${PB.ATTRS.find(a => a[0] === k)[1]}`); }
    }
    me.ovr = PB.ovr(me.r, me.pos);
    C.news.unshift(`${me.last} spends the summer on ${c.name.toLowerCase()}`);
    save();
    show(`<div class="page post"><p class="kick">Training camp · ${c.name}</p>
      ${score !== undefined ? `<div class="gradebig"><b>${score}</b><span>${c.drill === 'dunk' ? 'judges\' points' : 'made'}</span></div>` : ''}
      <div class="card"><h3>${got.length ? 'The work shows' : 'No gains this time'}</h3>${got.map(x => `<p class="news">${esc(x)}</p>`).join('') || `<p class="mute">${old ? 'Past thirty, holding on is the work.' : 'You are at your ceiling there.'}</p>`}
      <p class="fine">Overall ${me.ovr}</p></div><button class="big" id="go">On to the season</button></div>`);
    $('#go').onclick = next;
  }

  /* ---------- contracts: the rookie deal, an extension, free agency, a trade request ---------- */
  const M = n => '$' + (n >= 10 ? n.toFixed(1) : n.toFixed(2)) + 'M';
  const rookieScale = pick => +(10.5 - (pick - 1) * 0.28).toFixed(2);
  /* what the league would pay you a year, in millions: your overall, last season, your honors, your age */
  function marketValue() {
    const me = C.me, s = C.season, gp = s.gp || 1;
    const A = C.adj && C.adj.gp ? C.adj : null;
    const prod = (A ? A.pts / A.gp + (A.reb + A.ast) / A.gp * 0.6 : s.pts / gp + (s.reb + s.ast) / gp * 0.6) / QF();   // (weighed as a full-length line, shown nowhere)
    let v = 1.2 + Math.max(0, me.ovr - 60) * 1.25 + Math.max(0, prod - 8) * 0.8 + C.trophies.length * 0.6;
    if (me.age >= 31) v *= 0.85;
    if (me.age >= 34) v *= 0.7;
    return Math.min(52, Math.max(1.2, v));
  }
  function projectedRole(tid) {
    const best = C.rosters[tid].filter(p => p.pos === C.me.pos).sort((a, b) => b.ovr - a.ovr)[0];
    const d = C.me.ovr - (best ? best.ovr : 0);
    return d >= -1 ? 'Starter' : d >= -6 ? 'Sixth man' : 'Bench';
  }
  function offseason(next) {
    const c = C.contract;
    if (!c) { next(); return; }
    if (c.decYear !== C.year) { c.years--; c.decYear = C.year; }   // once a summer, even after a reload
    if (C.tradeReq) {
      const opts = PB.TEAMS.filter(t => t.id !== C.team);
      const to = opts[Math.floor(PB.rand() * opts.length)];
      C.news.unshift(`Trade: ${C.me.last} heads to the ${tname(to)}`);
      C.tradeReq = false; moveTo(to.id); C.trust = 50;
      show(`<div class="page post"><p class="kick">Trade</p><h2>You've been traded</h2><div class="cap" style="background:${to.c1};color:${to.c2};width:120px;height:120px;border-radius:24px;display:flex;align-items:center;justify-content:center;margin:16px auto;font-family:var(--display);font-weight:900;font-size:22px">${esc(to.ab)}</div>
        <p>The ${esc(tname(to))} take on your contract: ${c.years} season${c.years === 1 ? '' : 's'} at ${M(c.salary)}.</p><button class="big" id="go">Report to camp</button></div>`);
      $('#go').onclick = () => offseasonContract(next);
      return;
    }
    offseasonContract(next);
  }
  function offseasonContract(next) {
    const c = C.contract;
    if (c.years <= 0) { freeAgency(next); return; }
    if (c.years === 1 && !c.extOffered && C.trust >= 30) { extension(next); return; }
    next();
  }
  function moveTo(tid) { if (tid !== C.team) { const M = memOf(); M.prevTeam = C.team; M.teamGames = 0; M.facedOld = false; } C.team = tid; }
  function extension(next) {
    const c = C.contract; c.extOffered = true;
    const v = marketValue(), yrs = C.me.age < 27 ? 4 : 3, sal = +(v * 0.95).toFixed(2);
    show(`<div class="page post"><p class="kick">Contract extension</p><h2>The ${esc(PB.team(C.team).name)} want to keep you</h2>
      <div class="card"><p>One season left on your deal at ${M(c.salary)}. They offer ${yrs} more years at <b>${M(sal)}</b> a year, starting after this season.</p>
      <p class="fine">Turn it down and you play out the year, then hit free agency with offers from around the league. Your market value today: about ${M(v)}.</p></div>
      <button class="big" id="yes">Sign the extension</button><button class="ghost" id="no">Bet on yourself</button></div>`);
    $('#yes').onclick = () => { c.ext = { years: yrs, salary: sal }; C.news.unshift(`${C.me.last} signs a ${yrs}-year extension worth ${M(sal * yrs)}`); C.trust = Math.min(100, C.trust + 6); save(); next(); };
    $('#no').onclick = () => { C.news.unshift(`${C.me.last} turns down an extension; free agency awaits`); save(); next(); };
  }
  function freeAgency(next) {
    const c = C.contract;
    if (c.ext) {   // the extension starts
      C.contract = { years: c.ext.years, salary: c.ext.salary, kind: 'Extension' };
      next(); return;
    }
    const v = marketValue();
    const teams = new Set();
    if (C.trust >= 35) teams.add(C.team);
    const pool = PB.TEAMS.map(t => t.id).filter(id => id !== C.team).sort(() => PB.rand() - 0.5);
    while (teams.size < 4) teams.add(pool.pop());
    const ranked = PB.TEAMS.map(t => t.id).sort((a, b) => strength(b) - strength(a));
    const offers = [...teams].map(id => {
      const yrs = PB.clamp(Math.round(PB.rr(1, C.me.age < 28 ? 5 : 3)), 1, 5);
      const sal = +(v * PB.rr(0.8, 1.2) * (id === C.team ? 1.05 : 1)).toFixed(2);
      const rank = ranked.indexOf(id) + 1;
      return { id, yrs, sal, role: projectedRole(id), rank };
    }).sort((a, b) => b.sal - a.sal);
    show(`<div class="page post"><p class="kick">Free agency</p><h2>The offers are in</h2>
      <p class="mute">Your market value: about ${M(v)} a year</p>
      ${offers.map((o, i) => { const t = PB.team(o.id); return `<div class="card offer"><div class="of">${badge(t)}<div><b>${esc(tname(t))}${o.id === C.team ? ' <small>(your team)</small>' : ''}</b>
        <span>${o.yrs} yr${o.yrs > 1 ? 's' : ''} · ${M(o.sal)} a year · ${M(o.sal * o.yrs)} total</span><span>Projected role: ${o.role} · team strength ${ordinal(o.rank)} of 30</span></div></div>
        <button class="big" data-i="${i}">Sign</button></div>`; }).join('')}</div>`);
    scr().querySelectorAll('.offer button').forEach(b => b.onclick = () => {
      const o = offers[+b.dataset.i];
      const moved = o.id !== C.team;
      C.contract = { years: o.yrs, salary: o.sal, kind: moved ? 'Free-agent deal' : 'New deal' };
      C.news.unshift(moved ? `${C.me.last} signs with the ${tname(PB.team(o.id))}: ${o.yrs} years, ${M(o.sal * o.yrs)}` : `${C.me.last} re-signs with the ${PB.team(o.id).name}: ${o.yrs} years, ${M(o.sal * o.yrs)}`);
      if (moved) { moveTo(o.id); C.trust = 45; }
      save();
      if (moved && !PB.noGL && PB.R.modelReady && PB.R.modelReady()) {
        const t = PB.team(o.id);
        show(`<div class="draft over3d" style="--c1:${t.c1};--c2:${t.c2}"><p class="kick">Free agency</p><div class="podium"><p>Welcome to ${esc(t.city)}</p><h1>${esc(PB.full(C.me))}</h1>
          <p class="mute">${o.yrs} year${o.yrs > 1 ? 's' : ''} · ${M(o.sal * o.yrs)} with the ${esc(t.name)}</p></div><div class="spacer"></div><button class="big" id="go">Report to camp</button></div>`);
        scr().classList.add('over3d'); PB.R.showcase(C.me, t);
        $('#go').onclick = () => { PB.R.showcase(null); next(); };
      } else next();
    });
  }
  function requestTrade() {
    if (!confirm('Ask for a trade? Your coach and the fans will not like it, and you will be moved this summer.')) return;
    C.tradeReq = true; C.trust = Math.max(0, C.trust - 15); C.fans = Math.round(C.fans * 0.95);
    C.news.unshift(`${C.me.last} asks out: a trade request this summer`);
    save(); hub();
  }

  /* ---------- retirement and the Hall of Fame ---------- */
  /* a banner for a team's arena: kept on the device, hung in the rafters in every mode */
  function banner(team, b) {
    const all = load('pbb.banners') || {}; const list = all[team] || (all[team] = []);
    if (!list.some(x => x.kind === b.kind && x.text === b.text && x.num === b.num && x.name === b.name)) list.push(b);
    store('pbb.banners', all);
  }
  function hallOfFame() {
    const T = C.totals, gp = T.gp || 1;
    const fq = QF();   // the voters weigh a career as full-length games (your totals are shown as you put them up)
    const score = T.pts / fq / 1000 * 2 + T.reb / fq / 1000 + T.ast / fq / 1000 * 1.3 + C.trophies.filter(t => /MVP/.test(t)).length * 4 + C.trophies.filter(t => /Champion,/.test(t)).length * 3
      + C.trophies.filter(t => /All-Star/.test(t)).length * 1.2 + C.trophies.filter(t => /All-League/.test(t)).length * 1.5 + C.trophies.filter(t => /Defensive Player of the Year|Finals MVP/.test(t)).length * 2 + C.trophies.filter(t => /All-Defensive|Sixth Man|Clutch Player|Scoring champion/.test(t)).length * 0.8 + C.seasons.length * 0.3;
    const inHall = score >= 22, jersey = inHall || score >= 14;
    C.retired = { year: C.year, hof: inHall, score: +score.toFixed(1) };
    if (jersey) banner(C.team, { kind: 'jersey', num: C.me.num, name: C.me.last });
    /* the device's hall: every career that ends is kept here */
    const hall = load('pbb.hall') || [];
    if (!hall.find(h => h.id === C.me.id + C.year + C.me.last)) {
      hall.unshift({ id: C.me.id + C.year + C.me.last, name: PB.full(C.me), pos: C.me.pos, team: C.team, seasons: C.seasons.length, pts: T.pts, ppg: +(T.pts / gp).toFixed(1), trophies: C.trophies.length, hof: inHall, score: +score.toFixed(1) });
      store('pbb.hall', hall.slice(0, 40));
    }
    C.phase = 'retired'; save();
    const in3d = !PB.noGL && PB.R.modelReady && PB.R.modelReady();
    show(`<div class="page post ${in3d ? 'awards draft over3d' : ''}"><p class="kick">Retirement</p><h2>${esc(PB.full(C.me))} hangs them up</h2>${in3d ? '<div class="spacer"></div>' : ''}
      <div class="tiles"><div><b>${C.seasons.length}</b><span>SEASONS</span></div><div><b>${(T.pts / gp).toFixed(1)}</b><span>PPG</span></div><div><b>${T.pts}</b><span>POINTS</span></div></div>
      <div class="card"><h3>${inHall ? 'Hall of Fame: inducted' : 'Hall of Fame: not this time'}</h3><p>${inHall ? (C.path === 'undrafted' ? 'First ballot. Sixty picks went by without your name, and now it hangs in the Hall: the greatest undrafted story the league has told.' : C.pick > 30 ? 'First ballot. A day-two pick in the Hall of Fame.' : C.pick === 1 ? 'First ballot. First overall, and everything they said you would be.' : C.path === 'top' ? 'First ballot. They expected a star and got one.' : 'First ballot.') : 'A fine career. The voters wanted more hardware.'}${jersey ? ` The ${esc(PB.team(C.team).name)} retire your #${C.me.num}: it hangs in their rafters from tonight.` : ''}</p>
      <p class="fine">Hall score ${score.toFixed(1)} (22 gets you in): points, boards and assists, MVPs, titles, All-Star and All-League nods, seasons played.</p></div>
      <div class="card"><h3>Trophy case</h3>${C.trophies.map(x => `<p class="news">🏆 ${esc(x)}</p>`).join('') || '<p class="mute">Empty.</p>'}</div>
      <button class="big" id="go">Main menu</button></div>`);
    if (in3d) { scr().classList.add('over3d'); PB.R.showcase(C.me, PB.team(C.team)); }   // one last time at center court; your banner overhead
    $('#go').onclick = title;
  }
  const ordinal = n => n + (['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : n % 10] || 'th');

  PB.Career = { title, hub, park, get: () => C, gameStats, dbg: PB.DEV ? { simLine, binom, story: () => { const nx = nextGame(); return nx && nx.g ? story(nx.g) : null; }, storyOf: g => story(g), intro: () => { const nx = nextGame(); return nx && nx.g ? introCall(nx.g) : null; }, mem: () => memOf(), role, moveTo, storyNews, draftWith: sc => finishDraft(sc), scene: (k, done) => playScene(k, done || hub) } : undefined };
  PB.boot = () => {
    if (navigator.webdriver) document.documentElement.classList.add('driven');   // a test tool: nothing on the title moves forever, so its buttons hold still to be pressed
    /* without WebGL the menus and the career still work; only the court cannot be drawn */
    try { PB.R.init($('#gl')); } catch (e) { PB.noGL = true; console.warn('3D unavailable', e); }
    /* opened from a head-to-head link: the challenge (or the answer to yours) comes up first, and the link is taken out of the address */
    let vs = null; try { const q = new URLSearchParams(location.search).get('vs'); if (q) { vs = h2hRead(q); history.replaceState(null, '', location.pathname); } } catch (e) { /* no address to read */ }
    if (vs) { C = openCur(); headToHead(vs); return; }
    splash();
  };
})();
