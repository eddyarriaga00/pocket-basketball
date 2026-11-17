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
  const S = Object.assign({ qlen: 3, level: 'Pro', season: 20, cam: 'Player lock', sound: true, music: true, soundOn: 'On', musicOn: 'On', commentaryOn: 'On', commentary: true, replaysOn: 'On', replays: true, vibrateOn: 'On', vibrate: true, timing: 'Normal', hand: 'Right-handed', radarOn: 'On', radar: true }, load(SET) || {});
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
  /* achievements: across every career on this device, kept even when a career is deleted */
  const ACH = [
    ['drafted', 'Welcome to the league', 'Get drafted', C => !!C.team],
    ['lottery', 'Lottery pick', 'Go in the top five', C => C.pick && C.pick <= 5],
    ['starter', 'Starting five', 'Earn a starting role', C => (C.trust || 0) >= 70],
    ['g30', 'Thirty-piece', 'Score 30 in a game', C => (C.highs || {}).pts >= 30],
    ['g40', 'Forty-burger', 'Score 40 in a game', C => (C.highs || {}).pts >= 40],
    ['g50', 'Fifty', 'Score 50 in a game', C => (C.highs || {}).pts >= 50],
    ['td', 'Triple-double', 'Double figures in three stats', C => !!(C.miles || {}).td],
    ['winner', 'Ice in the veins', 'Hit a game-winner', C => !!(C.miles || {}).winner],
    ['allstar', 'All-Star', 'Make an All-Star team', C => C.trophies.some(t => /^All-Star,/.test(t))],
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
  ];
  function achCheck() {
    const got = load('pbb.ach') || {}, fresh = [];
    for (const [k, n, , ok] of ACH) { let v = false; try { v = !!ok(C); } catch (e) { v = false; } if (v && !got[k]) { got[k] = { t: Date.now(), who: PB.full(C.me) }; fresh.push(n); } }
    if (fresh.length) { store('pbb.ach', got); for (const n of fresh) C.news.unshift(`Achievement: ${n}`); achToast(fresh); }
  }
  function achToast(list) {
    let el = document.getElementById('achtoast');
    if (!el) { el = document.createElement('div'); el.id = 'achtoast'; document.body.appendChild(el); }
    el.innerHTML = `<b>Achievement</b>${list.map(esc).join(' · ')}`; el.className = 'on';
    clearTimeout(achToast.h); achToast.h = setTimeout(() => { el.className = ''; }, 3200);
  }
  function save() {
    if (!C) return;
    if (C.me && C.trophies) achCheck();
    let id = curId();
    const list = slots();
    if (!id || !list.find(x => x.id === id)) { id = 'c' + Date.now().toString(36); list.push({ id }); setCur(id); }
    const e = list.find(x => x.id === id);
    Object.assign(e, { name: PB.full(C.me), team: C.team, year: C.year, ovr: C.me.ovr, pos: C.me.pos, t: Date.now() });
    store('pbb.career.' + id, C); store(IDX, list);
  }

  function show(html) { const s = scr(); s.classList.remove('over3d'); if (PB.R && PB.R.showcase) PB.R.showcase(null); s.innerHTML = html; s.hidden = false; s.scrollTop = 0; }
  const badge = t => `<i class="tb" style="background:${t.c1};color:${PB.ink(t.c1, t.c2)}">${esc(t.ab || t.id)}</i>`;
  const tname = t => `${t.city} ${t.name}`;

  /* ---------- title ---------- */
  function title() {
    if (PB.audio) PB.audio.music(true);
    C = loadCur();
    const list = slots();
    const live = C && C.me;
    show(`<div class="title">
      <div class="logo"><div class="ball"></div><h1>Pocket<br>Basketball</h1><p>Your career, from draft night to the Hall of Fame.</p></div>
      ${live ? `<button class="big" id="cont">Continue career<small>${esc(PB.full(C.me))}${C.team ? ' · ' + esc(PB.team(C.team).name) : ' · pre-draft'} · Season ${C.year}</small></button>` : ''}
      <button class="${live ? 'ghost' : 'big'}" id="newc">New career</button>
      ${list.length > 1 || (list.length && !live) ? `<button class="ghost" id="careers">Careers <small>${list.length} on this device</small></button>` : ''}
      <div class="row2"><button class="ghost" id="qg">Quick game</button><button class="ghost" id="seas">Season</button></div>
      <button class="ghost sm" id="prac">Practice: 3-point and dunk contests, the drill</button>
      <div class="row2"><button class="ghost sm" id="how">How to play</button><button class="ghost sm" id="set">Settings</button></div>
      ${(load('pbb.hall') || []).length || load('pbb.records') ? '<button class="ghost sm" id="hall">Record book and the Hall of Fame</button>' : ''}
      ${load('pbb.ach') ? `<button class="ghost sm" id="achv">Achievements <small>${Object.keys(load('pbb.ach')).length} of ${ACH.length}</small></button>` : ''}
      <p class="fine">Every team and player is fictional.</p></div>`);
    if (live) $('#cont').onclick = hub;
    title3d(live ? C.me : null, live && C.team ? PB.team(C.team) : null);
    $('#newc').onclick = () => { if (slots().length >= 6) { alert('Six careers is the most this device keeps. Delete one under Careers first.'); return; } setCur(''); C = null; create(); };
    if ($('#careers')) $('#careers').onclick = careers;
    $('#qg').onclick = quick;
    $('#prac').onclick = practice;
    $('#seas').onclick = () => PB.Season.start();
    $('#how').onclick = how;
    if ($('#hall')) $('#hall').onclick = () => {
      const hall = load('pbb.hall') || [], RB = load('pbb.records') || {};
      const rec = (o, list) => list.filter(([k]) => o && o[k]).map(([k, l]) => `<div class="card rec"><span>${l}</span><b>${o[k].v}</b><small>${esc(o[k].name)} · ${esc(PB.team(o[k].team).ab)} · season ${o[k].year}</small></div>`).join('');
      show(`<div class="page"><button class="back" id="bk">‹ Back</button><h2>Record book</h2><p class="mute">The best by any career on this device.</p>
        ${RB.game ? `<h3>One game</h3>${rec(RB.game, [['pts', 'Points'], ['reb', 'Rebounds'], ['ast', 'Assists'], ['tpm', 'Threes'], ['stl', 'Steals'], ['blk', 'Blocks']])}` : ''}
        ${RB.season ? `<h3>One season</h3>${rec(RB.season, [['ppg', 'Points a game'], ['rpg', 'Rebounds a game'], ['apg', 'Assists a game']])}` : ''}
        ${hall.length ? '<h3>Retired careers</h3>' : ''}
        ${hall.map(h => `<div class="card slot"><div><b>${h.hof ? '🏛 ' : ''}${esc(h.name)}</b><span>${h.pos} · ${h.seasons} seasons · ${h.pts} points (${h.ppg} a game) · ${h.trophies} trophies · last with the ${esc(PB.team(h.team).name)}</span>
          <span>${h.hof ? 'Hall of Fame' : 'Hall score ' + h.score + ' of 22'}</span></div></div>`).join('')}</div>`);
      $('#bk').onclick = title;
    };
    $('#set').onclick = settings;
    if ($('#achv')) $('#achv').onclick = () => {
      const got = load('pbb.ach') || {};
      show(`<div class="page"><button class="back" id="bk">‹ Back</button><h2>Achievements</h2><p class="mute">${Object.keys(got).length} of ${ACH.length}, across every career on this device.</p>
        ${ACH.map(([k, n, d]) => `<div class="card ach ${got[k] ? 'got' : ''}"><i>${got[k] ? '★' : '☆'}</i><div><b>${n}</b><span>${d}${got[k] ? ` · ${esc(got[k].who)}` : ''}</span></div></div>`).join('')}</div>`);
      $('#bk').onclick = title;
    };
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
  function careers() {
    const list = slots().sort((a, b) => (b.t || 0) - (a.t || 0)), cur = curId();
    show(`<div class="page"><button class="back" id="bk">‹ Back</button><h2>Careers</h2>
      ${list.map(x => `<div class="card slot ${x.id === cur ? 'cur' : ''}"><div><b>${esc(x.name || 'Unnamed')}</b><span>${x.pos || ''} · ${x.ovr || ''} OVR · ${x.team ? esc(PB.team(x.team).name) : 'pre-draft'} · season ${x.year || 1}</span></div>
        <div class="row3"><button class="ghost sm" data-play="${x.id}">Play</button><button class="ghost sm" data-exp="${x.id}">Back up</button><button class="ghost sm" data-del="${x.id}">Delete</button></div></div>`).join('') || '<p class="mute">No careers yet.</p>'}
      <label class="ghost sm imp">Bring in a backup file<input type="file" id="imp" accept=".json,application/json" hidden></label>
      <p class="fine">A backup is a small file you can keep, or open on another phone or computer to carry the career over.</p></div>`);
    $('#bk').onclick = title;
    scr().querySelectorAll('[data-play]').forEach(b => b.onclick = () => { setCur(b.dataset.play); C = loadCur(); hub(); });
    scr().querySelectorAll('[data-exp]').forEach(b => b.onclick = () => {
      const data = load('pbb.career.' + b.dataset.exp); if (!data) return;
      const blob = new Blob([JSON.stringify({ pocketbasketball: 1, career: data })], { type: 'application/json' });
      const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = `pocketbasketball-${(data.me.last || 'career').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-season${data.year}.json`;
      document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
    });
    scr().querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
      if (!confirm('Delete this career?') || !confirm('Really delete it? This cannot be undone.')) return;
      const id = b.dataset.del; store(IDX, slots().filter(x => x.id !== id));
      try { localStorage.removeItem('pbb.career.' + id); } catch (e) { /* fine */ }
      if (curId() === id) setCur('');
      careers();
    });
    $('#imp').onchange = e => {
      const f = e.target.files[0]; if (!f) return;
      f.text().then(txt => {
        let d; try { d = JSON.parse(txt); } catch (err) { alert('That file is not a PocketBasketball backup.'); return; }
        const c = d && d.pocketbasketball && d.career;
        if (!c || !c.me || !c.rosters) { alert('That file is not a PocketBasketball backup.'); return; }
        if (slots().length >= 6) { alert('Six careers is the most this device keeps. Delete one first.'); return; }
        setCur(''); C = c; save(); careers();
      });
    };
  }
  /* practice: the contests on your own, with your career player if you have one */
  function practice() {
    const cur = loadCur();
    const me = cur && cur.me ? cur.me : { id: 'me', first: 'Practice', last: 'Shooter', pos: 'SG', ht: 77, skin: 2, num: 30, r: PB.makeRatings('SG', 80), badges: {} };
    const t = cur && cur.team ? PB.team(cur.team) : PB.team('SF');
    show(`<div class="page"><button class="back" id="bk">‹ Back</button><h2>Practice</h2>
      <p class="mute">${cur && cur.me ? `As ${esc(PB.full(me))}, with your ratings and badges.` : 'As a practice shooter (80 overall).'}</p>
      <button class="big" id="p3">3-Point Contest<small>five racks, money balls, 60 seconds</small></button>
      <button class="ghost" id="pc">Spot-up drill<small>the combine's fifteen shots in 45 seconds</small></button>
      <button class="ghost" id="pd">Dunk Contest<small>three dunks, five judges; Style picks the dunk</small></button>
      <button class="ghost" id="pf">Shoot-around<small>shoot from anywhere, no clock; pause to finish</small></button></div>`);
    $('#bk').onclick = title;
    const go = kind => { scr().hidden = true; PB.Game.start({ teams: [t, t], rosters: [[me], []], userId: me.id, drill: kind, dunks: 3, qlen: 1, level: S.level, floor: t,
      onEnd: r => { const d = r.drill || { score: 0, made: 0, att: 0 };
        const best = load('pbb.best') || {}; const k = kind; const nb = !best[k] || d.score > best[k]; if (nb) { best[k] = d.score; store('pbb.best', best); }
        show(`<div class="page post"><p class="kick">${kind === 'contest' ? '3-Point Contest' : kind === 'dunk' ? 'Dunk Contest' : kind === 'free' ? 'Shoot-around' : 'Spot-up drill'}</p><div class="gradebig"><b>${d.score}</b><span>${kind === 'dunk' ? (d.scores || []).join(' · ') : `${d.made} of ${d.att} made`}</span></div>
          <p class="mute">${nb ? 'A new best on this device.' : `Your best: ${best[k]}`}</p><button class="big" id="again">Again</button><button class="ghost" id="done">Done</button></div>`);
        $('#again').onclick = () => go(kind); $('#done').onclick = title; } }); };
    $('#p3').onclick = () => go('contest');
    $('#pc').onclick = () => go('combine');
    $('#pd').onclick = () => go('dunk');
    $('#pf').onclick = () => go('free');
  }
  function how() {
    show(`<div class="page"><button class="back" id="bk">‹ Back</button><h2>How to play</h2>
      <div class="card"><h3>Moving</h3><p>Put your left thumb anywhere on the lower left and drag: the stick appears under it. Push to the edge to sprint (it drains your stamina bar; walking brings it back).</p></div>
      <div class="card"><h3>Shooting</h3><p>Hold <b>Shoot</b> and let go at the top of your jump, when the meter crosses the green band. The text after tells you how the release was and how covered you were. Close to the rim it is a layup, a dunk or a floater on the run. Settings › Shot timing makes the band wider or narrower.</p></div>
      <div class="card"><h3>Passing and moves</h3><p><b>Pass</b> goes to the teammate under the green arrow: the open man, or the one your stick points at.<br>
      <b>Move</b>: tap for a crossover, or swipe the button: left or right to cross that way, down for a step-back (room for the jumper), up for a spin to the rim. Near the rim, a sideways swipe is a euro step. <b>Pick</b> (over half court with the ball) calls your big to set a screen on your man, then roll.</p></div>
      <div class="card"><h3>Without the ball</h3><p><b>Call</b> asks for it. <b>Cut</b> runs you to the rim and calls for it; a big enough leaper gets the alley-oop thrown up for him.</p></div>
      <div class="card"><h3>Defense</h3><p>Lift your thumb and you stay in front of your man by yourself (the red ring). <b>Jump</b> to contest, block and rebound. <b>Steal</b> to reach (too many reaches is a foul; six fouls and you are out).</p></div>
      <div class="card"><h3>Your grade and growth</h3><p>Every play moves your teammate grade. The grade, your goals, practice and badges earn skill points; the Player tab spends them (Auto-upgrade does it for you). The coach's trust decides whether you start.</p></div>
      <div class="card"><h3>Controller</h3><p>Left stick or d-pad to move, A to shoot or jump, B to pass, call or steal, X for a crossover or a cut, Y for a step-back, the right bumper for a spin, Start to pause.</p></div>
      <div class="card"><h3>Keyboard</h3><p>WASD or arrows to move, J or Space to shoot or jump, K to pass, call or steal, L for a crossover or a cut, U for a step-back, I for a spin, P to pause.</p></div>
      <p class="fine">Left-handed? Settings › Buttons puts them on the left.</p></div>`);
    $('#bk').onclick = title;
  }

  function settings() {
    const opt = (k, vals, lab) => `<div class="field"><label>${lab}</label><div class="seg" data-k="${k}">${vals.map(v => `<button class="${S[k] == v ? 'on' : ''}" data-v="${v}">${typeof v === 'number' && k === 'qlen' ? v + ' min' : v}</button>`).join('')}</div></div>`;
    show(`<div class="page"><button class="back" id="bk">‹ Back</button><h2>Settings</h2>
      ${opt('soundOn', ['On', 'Off'], 'Sound')}
      ${opt('musicOn', ['On', 'Off'], 'Menu music')}
      ${opt('commentaryOn', ['On', 'Off'], 'Commentary')}
      ${opt('replaysOn', ['On', 'Off'], 'Replays')}
      ${opt('vibrateOn', ['On', 'Off'], 'Vibration (Android)')}
      ${opt('cam', ['Player lock', 'Broadcast', 'Overhead'], 'Camera')}
      ${opt('timing', ['Easy', 'Normal', 'Hard'], 'Shot timing (how wide the green band is)')}
      ${opt('hand', ['Right-handed', 'Left-handed'], 'Buttons')}
      ${opt('radarOn', ['On', 'Off'], 'Radar (the whole floor, top right)')}
      ${opt('qlen', [2, 3, 5, 12], 'Quarter length')}
      ${opt('level', ['Rookie', 'Pro', 'All-Star', 'Legend'], 'Difficulty')}
      ${opt('season', [10, 20, 41, 82], 'Games in a career season (next season on)')}
      <button class="ghost" id="edteams">Edit teams<small>city, nickname, short name and colors</small></button>
      <p class="fine">Settings are kept on this device.</p></div>`);
    $('#bk').onclick = () => C && !scr().dataset.fromTitle ? title() : title();
    $('#edteams').onclick = () => editTeams();
    scr().querySelectorAll('.seg button').forEach(b => b.onclick = () => {
      const k = b.parentElement.dataset.k, v = b.dataset.v;
      S[k] = isNaN(+v) ? v : +v;
      S.sound = S.soundOn !== 'Off'; S.music = S.musicOn !== 'Off'; S.commentary = S.commentaryOn !== 'Off'; S.replays = S.replaysOn !== 'Off'; S.vibrate = S.vibrateOn !== 'Off'; S.radar = S.radarOn !== 'Off';
      saveSettings(); if (PB.audio) PB.audio.music(true); settings();
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
      <button class="big" id="sv">Save</button></div>`);
    $('#bk').onclick = () => editTeams();
    $('#sv').onclick = () => {
      let ed = {}; try { ed = JSON.parse(localStorage.getItem('pbb.teams') || '{}'); } catch (e) { ed = {}; }
      const v = id => $(id).value.trim();
      ed[t.id] = { city: v('#ec') || t.city, name: v('#en') || t.name, ab: (v('#ea') || t.ab).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4) || t.ab, c1: v('#e1'), c2: v('#e2') };
      try { localStorage.setItem('pbb.teams', JSON.stringify(ed)); } catch (e) { /* fine */ }
      PB.applyTeamEdits(); editTeams();
    };
  }

  /* ---------- quick game ---------- */
  function quick() {
    const opts = PB.TEAMS.map(t => `<option value="${t.id}">${tname(t)}</option>`).join('');
    show(`<div class="page"><button class="back" id="bk">‹ Back</button><h2>Quick game</h2>
      <div class="field"><label>Your team</label><select id="qa">${opts}</select></div>
      <div class="field"><label>Opponent</label><select id="qb">${opts}</select></div>
      <div class="field"><label>You play</label><div class="seg" id="qp">${PB.POS.map((p, i) => `<button data-v="${i}" class="${i === 0 ? 'on' : ''}">${p}</button>`).join('')}<button data-v="team">Whole team</button></div></div>
      <p class="fine">Pick a position to play one player while your teammates play around you, or Whole team to control whoever has the ball (and, on defense, the man guarding it; Switch moves you to the defender nearest the ball). ${S.qlen}-minute quarters, ${S.level}.</p>
      <button class="big" id="go">Tip off</button></div>`);
    $('#qb').value = 'BOS'; $('#qa').value = 'LAK';
    let slot = 0;
    scr().querySelectorAll('#qp button').forEach(b => b.onclick = () => { slot = b.dataset.v === 'team' ? 'team' : +b.dataset.v; scr().querySelectorAll('#qp button').forEach(x => x.classList.toggle('on', x === b)); });
    $('#bk').onclick = title;
    $('#go').onclick = () => {
      const a = PB.team($('#qa').value), b = PB.team($('#qb').value);
      if (a === b) { alert('Pick two different teams.'); return; }
      const fa = PB.makeRoster(78), fb = PB.makeRoster(78), ra = fa.slice(0, 5), rb = fb.slice(0, 5);
      const team = slot === 'team'; if (!team) { ra[slot].first = 'You'; ra[slot].last = 'You'; }
      scr().hidden = true;
      PB.Game.start({ teams: [a, b], rosters: [ra, rb], bench: [fa.slice(5, 9), fb.slice(5, 9)], userId: ra[team ? 0 : slot].id, switching: team, qlen: S.qlen, level: S.level,
        strength: [PB.teamOvr(fa), PB.teamOvr(fb)], onEnd: r => result(r, null) });
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
    /* every build and position starts near 60 overall: shifted evenly, so the build's strengths stay its strengths */
    for (let i = 0; i < 6; i++) {
      const d = 60 - PB.ovr(r, st.pos);
      if (Math.abs(d) < 1) break;
      for (const k in r) r[k] = PB.clamp(Math.round(r[k] + d * 0.6), 25, A.cap[k]);
    }
    return r;
  }

  function begin(st) {
    const strengths = {};
    const rosters = {};
    for (const t of PB.TEAMS) { strengths[t.id] = Math.round(PB.rr(70, 82)); rosters[t.id] = PB.makeRoster(strengths[t.id]); }
    const r = startRatings(st);
    const me = { id: 'me', first: st.first, last: st.last, pos: st.pos, arch: st.arch, ht: st.ht, skin: st.skin, num: st.num, age: 19, r, sp: 0, me: true, badges: {} };
    me.ovr = PB.ovr(r, st.pos);
    /* the draft order: lottery teams (the weakest) pick first */
    const order = PB.TEAMS.slice().sort((a, b) => strengths[a.id] - strengths[b.id] + PB.gauss() * 3).map(t => t.id);
    C = { v: 2, me, team: null, pick: 0, year: 1, rosters, standings: {}, games: [], gi: 0, news: [], seasons: [], totals: zero(), awards: [], trophies: [],
      trust: 42, fans: 0, ct: {}, feed: [], phase: 'combine', streak: 0, order };
    combine();
  }
  /* The pre-draft combine: fifteen spot-up shots in 45 seconds with the scouts watching. A good day moves you up
     the board, a bad one down. Skipping it sends the scouts your college numbers instead (an average day). */
  function combine() {
    const me = C.me;
    show(`<div class="page post"><p class="kick">Pre-draft combine</p><h2>The scouts are watching</h2>
      <div class="card"><p>Fifteen spot-up shots from five spots, three balls each, in 45 seconds: the corners, the elbows, the top of the key.
      Hold Shoot and let go at the top of your jump, in the green band.</p>
      <p class="fine">Your stock now: about pick ${projected()} of 30. Each make above an average day moves you up the board; each below moves you down.</p></div>
      <button class="big" id="go">Take the floor</button><button class="ghost" id="skip">Skip (send them my tape)</button></div>`);
    $('#go').onclick = () => {
      scr().hidden = true;
      const t = PB.team(C.order[projected() - 1]);
      PB.Game.start({ teams: [t, t], rosters: [[me], []], userId: 'me', drill: 'combine', qlen: 1, level: S.level, floor: t,
        onEnd: r => interviews(() => finishDraft(r.drill ? r.drill.score : 6)) });
    };
    $('#skip').onclick = () => interviews(() => finishDraft(null));
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
    const pj = projected(), slots = [PB.clamp(pj - PB.ri(2, 3), 1, 30), PB.clamp(pj + PB.ri(1, 2), 1, 30)].filter((v, i, a) => a.indexOf(v) === i);
    const qs = IQ.slice().sort(() => PB.rand() - 0.5);
    C.liked = null;
    const ask = i => {
      if (i >= slots.length) { save(); done(); return; }
      const t = PB.team(C.order[slots[i] - 1]), [q, ans] = qs[i], opts = ans.slice().sort(() => PB.rand() - 0.5);
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
  const projected = () => PB.clamp(Math.round(14 - (C.me.ovr - 62) * 1.6), 1, 30);
  function finishDraft(score) {
    const me = C.me;
    const avg = 6.5;   // an ordinary day: about 43% from these spots
    /* the measurements: what your body and your build say, a little noise on the day */
    const ath = (me.r.vert + me.r.speed) / 2, g = () => PB.gauss();
    const M8 = { ht: me.ht + 1.25, wing: me.ht + PB.clamp(Math.round(3 + g() * 2), -1, 8), vert: +(27 + me.r.vert * 0.12 + g() * 1.2).toFixed(1),
      lane: +(12.3 - me.r.speed * 0.016 + g() * 0.15).toFixed(2), sprint: +(3.6 - me.r.speed * 0.0045 + g() * 0.03).toFixed(2) };
    C.measure = M8;
    const moved = score === null ? 0 : Math.round((score - avg) * 1.6) + (ath >= 80 ? 1 : ath <= 55 ? -1 : 0);
    let pick = PB.clamp(projected() - moved + Math.round(PB.gauss() * 2), 1, 30);
    /* a team that loved your interview takes you at its pick, if you are still close to it on the board */
    let loved = false;
    if (C.liked && Math.abs(C.liked.slot - pick) <= 3) { loved = C.liked.slot !== pick; pick = C.liked.slot; }
    C.pick = pick; C.team = C.order[pick - 1]; C.combine = score; C.phase = 'regular';
    C.contract = { years: 4, salary: rookieScale(pick), kind: 'Rookie deal' }; C.earnings = 0;
    C.fans = 1500 + (31 - pick) * 400;
    C.news.unshift(score === null ? `${me.last} skips the combine shooting drills` : `${me.last} makes ${score} of 15 at the combine${moved > 0 ? ', and climbs draft boards' : moved < 0 ? ', and slides on draft boards' : ''}`);
    if (loved) C.news.unshift(`The ${PB.team(C.team).name} loved ${me.last} in his interview`);
    makeRival(null, pick);
    newSeason();
    save();
    if (score !== null) {
      show(`<div class="page post"><p class="kick">Combine results</p><div class="gradebig"><b>${score}/15</b><span>spot-up shooting</span></div>
        <div class="card"><p>${moved > 1 ? 'Scouts loved it. You are moving up.' : moved < -1 ? 'Not your day. Some teams cooled on you.' : 'About what they expected.'}</p>
        <p class="fine">Projected before: pick ${projected()} · now heading to draft night.</p></div>
        <div class="card"><h3>Measurements</h3><table class="std">
          <tr><td>Height in shoes</td><td>${PB.fmtH(Math.round(M8.ht))}</td></tr><tr><td>Wingspan</td><td>${PB.fmtH(M8.wing)}</td></tr>
          <tr><td>Max vertical</td><td>${M8.vert}"</td></tr><tr><td>Lane agility</td><td>${M8.lane} s</td></tr><tr><td>Three-quarter sprint</td><td>${M8.sprint} s</td></tr></table>
          <p class="fine">${ath >= 80 ? 'The athletic testing turned heads.' : ath <= 55 ? 'The athletic testing was a concern for some teams.' : 'Athletic testing about average for the class.'}</p></div>
        <button class="big" id="go">Draft night</button></div>`);
      $('#go').onclick = draft;
    } else draft();
  }
  const zero = () => ({ gp: 0, min: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, fga: 0, fgm: 0, tpa: 0, tpm: 0, fta: 0, ftm: 0, w: 0, l: 0, grades: 0 });

  /* Your rival: same position, same draft class, picked a few spots from you by a team in your division. You see
     each other twice or more a season, and the league keeps score. */
  function makeRival(order, pick) {
    const div = PB.team(C.team).div;
    const opts = PB.TEAMS.filter(t => t.div === div && t.id !== C.team);
    const rt = opts[Math.floor(PB.rand() * opts.length)].id;
    const p = PB.makePlayer(C.me.pos, C.me.ovr + PB.ri(0, 3), 19);
    p.rookie = true;
    C.rosters[rt].push(p);
    C.rival = { id: p.id, team: rt, pick: PB.clamp(pick + PB.ri(-4, 4), 1, 30), season: zero(), totals: zero(), h2h: [0, 0] };
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
    /* back-to-backs: about one game in seven is the second of two nights; your legs start the game heavier */
    for (let i = 1; i < C.games.length; i++) if (!C.games[i - 1].b2b && PB.rand() < 0.15) C.games[i].b2b = true;
    for (const id in C.rosters) for (const p of C.rosters[id]) p.out = 0;
    C.gi = 0; C.season = zero(); C.len = n; C.phase = 'regular'; C.po = null; C.allstar = false;
    if (C.contract) C.earnings = (C.earnings || 0) + C.contract.salary;
    if (C.endorse && C.endorse.pay) C.earnings = (C.earnings || 0) + C.endorse.pay;
    C.ls = {}; C.adj = { gp: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tpm: 0 }; C.vote = null; C.wk = null;
    C.startOvr = C.me.ovr;
    if (C.rival) C.rival.season = zero();
    C.news.unshift(`Season ${C.year} begins: ${n} games, ${PB.TEAMS.length} teams.`);
  }

  function draft() {
    const t = PB.team(C.team), me = C.me, rv = rivalP(), rt = PB.team(C.rival.team);
    const ord = n => n + (['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : n % 10] || 'th');
    const in3d = !PB.noGL && PB.R.modelReady && PB.R.modelReady();
    show(`<div class="draft ${in3d ? 'over3d' : ''}" style="--c1:${t.c1};--c2:${t.c2}">
      <p class="kick">Draft night</p>
      <div class="podium"><p>With the ${ord(C.pick)} pick, the ${esc(tname(t))} select</p>
      <h1>${esc(PB.full(me))}</h1><p class="mute">${PB.POS_NAME[me.pos]} · ${me.arch} · ${PB.fmtH(me.ht)} · overall ${me.ovr}</p></div>
      ${in3d ? '<div class="spacer"></div>' : `<div class="cap" style="background:${t.c1};color:${t.c2}">${esc(t.ab)}<b>#${me.num}</b></div>`}
      <p class="fine">A four-year rookie deal. ${roleLine()}</p>
      <div class="card rival"><h3>Your rival</h3><p>${badge(rt)} <b>${esc(PB.full(rv))}</b>, ${PB.POS_NAME[rv.pos].toLowerCase()}, went ${ord(C.rival.pick)} to the ${esc(rt.name)}, in your division. Overall ${rv.ovr}. The league will compare you all career.</p></div>
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
  const roleLine = () => { const r = role(); return r === 'Starter' ? 'The coach has you in the starting five.' : r === 'Sixth man' ? 'You come off the bench as the first man in, and you start when the starter rests.' : 'You start on the bench: play well and the minutes come.'; };
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
  function simLine(pl, rl, win) {
    const r = pl.r;
    const mins = rl === 'Starter' ? 32 : rl === 'Sixth man' ? 24 : 14;
    const usage = Math.max(0.15, (pl.ovr - 40) / 50) * mins / 32;
    const tpa = Math.round(Math.max(0, (r.three - 40) / 10 * usage + PB.gauss())), fga2 = Math.round(Math.max(1, 9 * usage + (r.close + r.mid - 100) / 20 + PB.gauss() * 2));
    const tpm = binom(tpa, 0.2 + r.three / 99 * 0.2), fgm2 = binom(fga2, 0.38 + (r.close + r.mid) / 198 * 0.2);
    const fta = Math.round(Math.max(0, (r.close + r.dunk) / 40 * usage + PB.gauss())), ftm = binom(fta, 0.45 + r.ft / 99 * 0.45);
    const line = { pts: fgm2 * 2 + tpm * 3 + ftm, reb: Math.max(0, Math.round(Math.max(0, r.reb - 35) / 4.2 * usage + PB.gauss() * 1.5)), ast: Math.max(0, Math.round(Math.max(0, r.pass - 35) / 5.5 * usage + PB.gauss() * 1.5)),
      stl: binom(3, r.steal / 250), blk: binom(3, r.block / 250), tov: binom(4, 0.25), fga: tpa + fga2, fgm: tpm + fgm2, tpa, tpm, fta, ftm };
    /* the badge counters a simmed game earns, roughly */
    line.ct = { tpm, cs3: Math.round(tpm * 0.6), mid: Math.round(fgm2 * (r.mid / (r.mid + r.close))), lay: Math.round(fgm2 * 0.5), dunk: binom(fgm2, Math.max(0, r.dunk - 50) / 120),
      shake: binom(2, Math.max(0, r.handle - 55) / 200), ast: line.ast, reb: line.reb, stl: line.stl, blk: line.blk, cmiss: binom(4, r.perD / 250), clutch: PB.rand() < 0.15 ? binom(3, 0.5) * 2 : 0 };
    line.gs = PB.clamp(Math.round(6 + (line.pts - 10) / 6 + (line.ast + line.reb) / 8 + (win ? 0.5 : -0.5) + PB.gauss() * 0.8), 0, 12);
    return line;
  }

  /* ---------- the league around you ---------- */
  function simLeagueDay(myOpp) {
    const ids = PB.TEAMS.map(t => t.id).filter(id => id !== C.team && id !== myOpp).sort(() => PB.rand() - 0.5);
    C.dayBest = null;
    for (let i = 0; i + 1 < ids.length; i += 2) {
      const a = ids[i], b = ids[i + 1];
      const w = PB.rand() < winP(a, b, true) ? a : b, l = w === a ? b : a;
      C.standings[w].w++; C.standings[l].l++;
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
  }
  /* every seven games the league names a Player of the Week in each conference; your week can be it. About a third
     of the way in, the first All-Star fan-voting returns come out. */
  function weekly(res, k) {
    const W = C.wk || (C.wk = { n: 0, pts: 0, reb: 0, ast: 0, w: 0 });
    W.n++; W.pts += res.line.pts * k; W.reb += res.line.reb * k; W.ast += res.line.ast * k; if (res.win) W.w++;
    if (W.n >= 7) {
      const me = C.me, conf = PB.team(C.team).conf, sc = (W.pts + W.reb * 0.6 + W.ast * 0.8) / W.n + W.w * 1.4;
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
    /* the first returns of the fan vote */
    if (!C.vote && C.len >= 20 && C.gi >= Math.round(C.len * 0.33)) {
      const conf = PB.team(C.team).conf, guard = ['PG', 'SG'].includes(C.me.pos), grp = guard ? ['PG', 'SG'] : ['SF', 'PF', 'C'];
      const val = r => r.ptspg + r.rebpg * 0.5 + r.astpg * 0.7;
      const rows = leaders().filter(r => PB.team(r.team).conf === conf);
      const pos = id => { for (const t of PB.TEAMS) { const p = C.rosters[t.id].find(q => PB.full(q) === id); if (p) return p.pos; } return null; };
      const mine = rows.find(r => r.me); if (!mine) return;
      const fanBoost = Math.log10(Math.max(1000, C.fans)) - 4;
      const others = rows.filter(r => !r.me && grp.includes(pos(r.name))).map(r => val(r));
      const rank = 1 + others.filter(v => v > val(mine) + fanBoost * 3).length;
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
        nums.add(r.num); ro[i] = r;
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
      if (ln.pts >= 33 && (!C.dayBest || ln.pts > C.dayBest.pts)) C.dayBest = { name: PB.full(p), pts: ln.pts, team: tid };
    }
  }
  function rivalGame(win, vsMe) {
    const rv = rivalP(); if (!rv) return null;
    const rl = rv.ovr >= starters(C.rival.team)[PB.POS.indexOf(rv.pos)].ovr ? 'Starter' : 'Sixth man';
    const ln = simLine(rv, rl, win);
    for (const k of ['pts', 'reb', 'ast', 'stl', 'blk', 'fga', 'fgm', 'tpa', 'tpm']) { C.rival.season[k] += ln[k]; C.rival.totals[k] += ln[k]; }
    C.rival.season.gp++; C.rival.totals.gp++;
    if (ln.pts >= 28) C.news.unshift(`Your rival ${PB.full(rv)} scores ${ln.pts} for the ${PB.team(C.rival.team).name}`);
    return ln;
  }
  const confRank = conf => PB.TEAMS.filter(x => x.conf === conf).map(x => x.id)
    .sort((a, b) => (C.standings[b].w - C.standings[b].l) - (C.standings[a].w - C.standings[a].l) || strength(b) - strength(a));

  /* ---------- the hub ---------- */
  let tab = 'home';
  function hub() {
    if (PB.audio) PB.audio.music(true);
    if (!C) { title(); return; }
    upgrade();
    if (C.phase === 'regular' && C.gi >= C.games.length) { startPlayoffs(); }
    if (C.phase === 'combine') { combine(); return; }
    if (C.phase === 'retired') { hallOfFame(); return; }
    if (C.phase === 'awards') { awardsNight(); return; }
    if (C.phase === 'offseason') { seasonEnd(C.lastGot); return; }
    const t = PB.team(C.team), me = C.me;
    const s = C.season, gp = s.gp || 1;
    const avg = k => (s[k] / gp).toFixed(1);
    const tabs = ['home', 'player', 'league', 'log'];
    let body = '';
    if (tab === 'home') {
      const nx = nextGame();
      let card;
      if (nx) {
        const o = PB.team(nx.opp), st = C.standings[C.team], os = C.standings[nx.opp];
        const them = starters(o.id)[PB.POS.indexOf(me.pos)];
        const rivalGame = C.rival && nx.opp === C.rival.team;
        card = `<div class="next">
        <p class="kick">${nx.label}</p>
        <div class="vs"><div>${badge(t)}<b>${t.name}</b><span>${st.w}-${st.l} · ${strength(C.team)}</span></div><em>vs</em>
        <div>${badge(o)}<b>${o.name}</b><span>${os.w}-${os.l} · ${strength(o.id)}</span></div></div>
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
      const rv = rivalP(), rs = C.rival.season, rg = rs.gp || 1;
      const voteCard = C.vote && C.vote.year === C.year && C.phase === 'regular' && C.gi < Math.round(C.len * 0.5) ? `<div class="card"><h3>All-Star voting</h3><p>${ordinal(C.vote.rank)} among ${esc(C.vote.conf)} ${C.vote.grp} in the first returns. ${C.vote.rank <= 2 ? 'Right now you would start.' : C.vote.rank <= 6 ? 'In the mix: the coaches pick the reserves.' : 'A long way back: big games move the vote.'}</p></div>` : '';
      body = card + voteCard + (C.phase === 'playoffs' ? bracketCard() : '') + `
        <div class="tiles">
          <div><b>${avg('pts')}</b><span>PTS</span></div><div><b>${avg('reb')}</b><span>REB</span></div><div><b>${avg('ast')}</b><span>AST</span></div>
          <div><b>${s.fga ? Math.round(s.fgm / s.fga * 100) : 0}%</b><span>FG</span></div><div><b>${s.tpa ? Math.round(s.tpm / s.tpa * 100) : 0}%</b><span>3PT</span></div><div><b>${s.gp ? gradeAvg(s.grades / s.gp) : '–'}</b><span>GRADE</span></div></div>
        <div class="card meters"><div><span>Coach trust</span><i><u style="width:${C.trust}%"></u></i><b>${Math.round(C.trust)}</b></div>
          ${C.injury ? `<div class="wide"><span>Questionable</span><b class="inj">${esc(C.injury.what)} · ${C.injury.games} game${C.injury.games > 1 ? 's' : ''}</b></div>` : ''}
          <div><span>Role</span><b class="tag">${role()}</b></div><div><span>Followers</span><b>${fmtFans(C.fans)}</b></div>
          ${C.contract ? `<div class="wide"><span>Contract</span><b>${C.contract.years} yr${C.contract.years === 1 ? '' : 's'} · ${M(C.contract.salary)}</b></div>` : ''}</div>
        <div class="card rival"><h3>Rival <small>${esc(PB.team(C.rival.team).name)}</small></h3>
          <div class="rv"><div><b>${esc(PB.full(me))}</b><span>${avg('pts')} / ${avg('reb')} / ${avg('ast')}</span></div><em>${C.rival.h2h[0]}–${C.rival.h2h[1]}</em>
          <div><b>${esc(PB.full(rv))}</b><span>${(rs.pts / rg).toFixed(1)} / ${(rs.reb / rg).toFixed(1)} / ${(rs.ast / rg).toFixed(1)}</span></div></div>
          <p class="fine">Points, rebounds, assists a game this season; the middle is your record head to head.</p></div>
        <div class="card"><h3>Feed</h3>${C.feed.slice(0, 4).map(f => `<div class="fpost"><b>${esc(f.who)}</b><span>${esc(f.text)}</span></div>`).join('') || '<p class="mute">Nothing yet. Play a game.</p>'}</div>
        <div class="card"><h3>News</h3>${C.news.slice(0, 5).map(n => `<p class="news">${esc(n)}</p>`).join('')}</div>`;
    } else if (tab === 'player') {
      const A = PB.ARCH[me.arch];
      body = `<div class="card"><h3>${esc(PB.full(me))} <small>${me.pos} · ${me.arch} · age ${me.age} · ${role()}</small></h3>
        <div class="ovr"><b>${me.ovr}</b><span>overall</span><em>${me.sp} skill points</em></div>
        ${PB.ATTRS.map(([k, n, d]) => { const c = cost(me.r[k]); const can = me.r[k] < A.cap[k] && me.sp >= c;
          return `<div class="bar up"><span>${n}<small>${d}</small></span><i><u style="width:${me.r[k]}%"></u><s style="left:${A.cap[k]}%"></s></i><b>${me.r[k]}</b>
          <button data-k="${k}" ${can ? '' : 'disabled'}>+1<small>${me.r[k] >= A.cap[k] ? 'max' : c + ' SP'}</small></button></div>`; }).join('')}
        <p class="fine">Skill points come from your teammate grade after every game, more for a win. Each point higher costs more.</p>
        ${me.sp > 0 ? '<button class="ghost sm" id="auto">Auto-upgrade: spend my points on what my build needs</button>' : ''}</div>
        <div class="card look"><h3>Look</h3>${lookEditor(me)}</div>
        <div class="card"><h3>Badges <small>earned in games, never lost</small></h3>${badgeList()}</div>
        <div class="card"><h3>Business</h3><p class="fine">${C.endorse && C.endorse.brand ? `Shoe deal: ${C.endorse.brand}, ${M(C.endorse.pay)} a year. ` : ''}${C.contract ? `${C.contract.kind}: ${C.contract.years} season${C.contract.years === 1 ? '' : 's'} left at ${M(C.contract.salary)}. ` : ''}Career earnings ${M(C.earnings || 0)}.</p>
        ${C.tradeReq ? '<p class="rivaltag">Trade requested: you will be moved this summer.</p>' : '<button class="ghost sm" id="trade">Request a trade</button>'}</div>
        <button class="ghost" id="pcard">Share your player card<small>an image of you, your numbers and your trophies</small></button>`;
    } else if (tab === 'league') {
      const conf = c => confRank(c).map((id, i) => { const x = PB.team(id), st = C.standings[id];
        return `<tr class="${id === C.team ? 'me' : ''} ${i === 6 ? 'cut' : i === 10 ? 'cut2' : ''}"><td>${i + 1}</td><td>${badge(x)} ${x.name}${C.rival && id === C.rival.team ? ' <small class="rv-dot">rival</small>' : ''}</td><td>${st.w}</td><td>${st.l}</td><td>${strength(id)}</td></tr>`; }).join('');
      body = (C.phase === 'playoffs' ? bracketCard() : '') + leadersCard() + ['East', 'West'].map(c => `<div class="card"><h3>${c}</h3><table class="std"><tr><th></th><th>Team</th><th>W</th><th>L</th><th>OVR</th></tr>${conf(c)}</table></div>`).join('')
        + `<p class="fine">The top six in each conference make the playoffs; seven to ten play in for the last two places.</p>`;
    } else {
      body = `<div class="card"><h3>Season ${C.year} game log</h3>${C.games.filter(x => x.done).map((x, i) => glog(x, i + 1)).join('') || '<p class="mute">No games yet.</p>'}</div>
        ${C.po && C.po.games.length ? `<div class="card"><h3>Playoffs</h3>${C.po.games.map((x, i) => glog(x, 'P' + (i + 1))).join('')}</div>` : ''}
        ${C.seasons.length ? `<div class="card"><h3>Career</h3>${C.seasons.map(z => `<div class="glog"><span>Y${z.year}</span>${badge(PB.team(z.team))}<b>${z.w}-${z.l}</b><em>${z.ppg} / ${z.rpg} / ${z.apg}</em><i>${z.awards.join(', ') || '–'}</i></div>`).join('')}</div>` : ''}
        <div class="card"><h3>Career highs</h3><div class="tiles">${[['pts', 'PTS'], ['reb', 'REB'], ['ast', 'AST'], ['stl', 'STL'], ['blk', 'BLK'], ['tpm', '3PM']].map(([k, l]) => `<div><b>${(C.highs || {})[k] || 0}</b><span>${l}</span></div>`).join('')}</div>
          <h3>Milestones <small>${Object.keys(C.miles || {}).length} of 12</small></h3>${['First points', 'First dunk', 'First three', '20-point game', '30-point game', 'Double-double', 'Triple-double', '10 assists', '5 blocks', 'A game-winner', 'A playoff win', 'A championship'].map((n, i) => { const k = ['firstpts', 'firstdunk', 'firstthree', 'twenty', 'thirty', 'dd', 'td', 'ten_ast', 'five_blk', 'winner', 'playoffwin', 'title'][i]; const y = (C.miles || {})[k]; return `<p class="mile ${y ? 'got' : ''}">${y ? '★' : '☆'} ${n}${y ? ` <small>season ${y}</small>` : ''}</p>`; }).join('')}</div>
        ${C.trophies.length ? `<div class="card"><h3>Trophy case</h3>${C.trophies.map(x => `<p class="news">🏆 ${esc(x)}</p>`).join('')}</div>` : ''}`;
    }
    show(`<div class="hub" style="--c1:${t.c1};--c2:${t.c2}">
      <div class="hubtop"><div class="me">${portrait() ? `<img class="face" src="${portrait()}" alt="" style="background:${t.c1}">` : badge(t)}<div><b>${esc(PB.full(me))}</b><span>#${me.num} · ${me.pos} · ${me.ovr} OVR · Season ${C.year}${C.phase === 'playoffs' ? ' · Playoffs' : ''}</span></div></div>
      <button class="ic" id="menu" aria-label="Menu">⌂</button></div>
      <nav class="tabs">${tabs.map(x => `<button class="${x === tab ? 'on' : ''}" data-t="${x}">${{ home: 'Home', player: 'Player', league: 'League', log: 'Log' }[x]}${x === 'player' && canUpgrade() ? '<i class="dot"></i>' : ''}</button>`).join('')}</nav>
      <div class="hubbody">${body}</div></div>`);
    scr().querySelectorAll('.tabs button').forEach(b => b.onclick = () => { tab = b.dataset.t; hub(); });
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
    if ($('#trade')) $('#trade').onclick = requestTrade;
    if ($('#pcard')) $('#pcard').onclick = playerCard;
    if ($('#sim5')) $('#sim5').onclick = () => simMany(5);
    if ($('#simall')) $('#simall').onclick = () => simMany(999);
    if ($('#asg')) $('#asg').onclick = () => allStarGame(true);
    if ($('#asgsim')) $('#asgsim').onclick = () => allStarGame(false);
    scr().querySelectorAll('[data-ev]').forEach(b => b.onclick = () => eventPick(+b.dataset.ev));
    scr().querySelectorAll('[data-brand]').forEach(b => b.onclick = () => {
      const br = C.endorse.brands[+b.dataset.brand], i = C.endorse.offer, amt = [0.4, 1.2, 4, 10][i];
      C.endorse = { tier: i + 1, brand: br[0], color: br[1], pay: amt };
      me.look = me.look || {}; me.look.shoe = br[1]; me.look.shoePick = '';
      C.news.unshift(`${me.last} signs a shoe deal with ${br[0]}: ${M(amt)} a year`);
      C.feed.unshift({ who: '@' + br[0].toLowerCase(), text: `Welcome to the family, ${PB.full(me)}. Your colorway drops next week.` });
      save(); hub();
    });
    if ($('#nobrand')) $('#nobrand').onclick = () => { C.endorse.tier = (C.endorse.offer || 0) + 1; delete C.endorse.offer; delete C.endorse.brands; save(); hub(); };
    scr().querySelectorAll('[data-look] button').forEach(b => b.onclick = () => {
      const k = b.parentElement.dataset.look, v = b.dataset.v || null, tm = PB.team(C.team);
      me.look[k + 'Pick'] = v || '';
      me.look[k] = v === 'team' ? (k === 'shoe' ? tm.c1 : tm.c2 === '#f2f2f2' ? tm.c1 : tm.c2) : v;
      save(); hub();
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
      save(); hub();
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
      me.ovr = PB.ovr(me.r, me.pos); save(); hub();
    };
    if ($('#simpi')) $('#simpi').onclick = () => { while (C.po.round < 2) simPlayoffRound(); hub(); };
    if ($('#simrd')) $('#simrd').onclick = () => { simPlayoffRound(); hub(); };
    if ($('#simpo')) $('#simpo').onclick = () => { while (!C.po.champ) simPlayoffRound(true); C.phase = 'awards'; save(); hub(); };
    scr().querySelectorAll('.bar.up button').forEach(b => b.onclick = () => {
      const k = b.dataset.k, c = cost(me.r[k]);
      if (me.sp < c) return;
      me.sp -= c; me.r[k]++; me.ovr = PB.ovr(me.r, me.pos); save(); hub();
    });
  }
  /* your portrait, kept until your team or your look changes (not saved: it is quick to draw again) */
  let portraitCache = { key: '', url: null };
  function portrait() {
    if (PB.noGL || !PB.R.modelReady || !PB.R.modelReady()) return null;
    const key = C.team + JSON.stringify(C.me.look || {}) + C.me.skin + C.me.num;
    if (portraitCache.key !== key) portraitCache = { key, url: PB.R.portrait(C.me, PB.team(C.team)) };
    return portraitCache.url;
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
      g.textAlign = 'center'; g.fillStyle = '#ffb02e'; g.beginPath(); g.arc(920, 820, 92, 0, 7); g.fill();
      g.fillStyle = '#1b0d03'; g.font = '900 90px Archivo, Arial'; g.fillText(String(me.ovr), 920, 850); g.font = '800 24px Archivo, Arial'; g.fillText('OVERALL', 920, 884);
      const tile = (x, v, l) => { g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(x, 1010, 290, 150); g.fillStyle = '#fff'; g.font = '900 70px Archivo, Arial'; g.fillText(v, x + 145, 1092); g.fillStyle = '#c9d0de'; g.font = '700 26px Inter, Arial'; g.fillText(l, x + 145, 1136); };
      tile(80, gp ? (A.pts / gp).toFixed(1) : '–', 'POINTS'); tile(395, gp ? (A.reb / gp).toFixed(1) : '–', 'REBOUNDS'); tile(710, gp ? (A.ast / gp).toFixed(1) : '–', 'ASSISTS');
      g.fillStyle = '#c9d0de'; g.font = '600 30px Inter, Arial';
      g.fillText(`Season ${C.year} · ${C.trophies.length} trophies · ${T.pts || 0} career points · ${(C.fans || 0).toLocaleString()} followers`, 540, 1225);
      g.fillStyle = '#ffb02e'; g.font = '900 34px Archivo, Arial'; g.fillText('POCKETBASKETBALL', 540, 1300);
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
  const canUpgrade = () => { const A = PB.ARCH[C.me.arch]; return PB.ATTRS.some(([k]) => C.me.r[k] < A.cap[k] && cost(C.me.r[k]) <= C.me.sp); };
  const cost = v => v < 60 ? 1 : v < 70 ? 2 : v < 80 ? 3 : v < 90 ? 4 : 6;
  const LET = ['F', 'D-', 'D', 'D+', 'C-', 'C', 'C+', 'B-', 'B', 'B+', 'A-', 'A', 'A+'];
  const gradeAvg = v => LET[PB.clamp(Math.round(v), 0, 12)];
  const LOOK = {
    hair: [['short', 'Short'], ['high', 'High-top'], ['afro', 'Afro'], ['buzz', 'Buzz'], ['bald', 'Bald']],
    hairColor: [['#17110d', 'Black'], ['#4a3020', 'Brown'], ['#c9a46a', 'Blond'], ['#9a3b1c', 'Red'], ['#d8d8d8', 'Silver']],
    band: [[null, 'None'], ['#f2f2f2', 'White'], ['#111111', 'Black'], ['team', 'Team']],
    sleeve: [[null, 'None'], ['#111111', 'Black'], ['#f2f2f2', 'White'], ['team', 'Team']],
    shoe: [[null, 'White'], ['#111111', 'Black'], ['team', 'Team'], ['#e63946', 'Red'], ['#ffd23f', 'Gold']],
  };
  function lookEditor(me) {
    me.look = me.look || { hair: 'short', hairColor: '#17110d', band: null, sleeve: null, shoe: null };
    const row = (k, lbl) => `<div class="field"><label>${lbl}</label><div class="seg" data-look="${k}">${LOOK[k].map(([v, n]) => `<button data-v="${v === null ? '' : v}" class="${(me.look[k + 'Pick'] ?? me.look[k] ?? '') === (v === null ? '' : v) ? 'on' : ''}">${n}</button>`).join('')}</div></div>`;
    return row('hair', 'Hair') + row('hairColor', 'Hair color') + row('band', 'Headband') + row('sleeve', 'Arm sleeve') + row('shoe', 'Shoes') + '<p class="fine">Your look on the floor from your next game.</p>';
  }
  function badgeList() {
    return PB.BADGES.map(b => {
      const n = C.ct[b.stat] || 0, t = C.me.badges[b.k] || 0, nextAt = b.tiers[t];
      const pct = t >= 3 ? 100 : Math.min(100, Math.round(n / nextAt * 100));
      return `<div class="badge t${t}"><i>${t ? PB.TIER[t][0] : '·'}</i><div><b>${b.name}${t ? ` <small>${PB.TIER[t]}</small>` : ''}</b><span>${b.eff}</span>
        <u><s style="width:${pct}%"></s></u><em>${b.desc}: ${n}${t < 3 ? ` / ${nextAt}` : ' · maxed'}</em></div></div>`;
    }).join('');
  }

  /* ---------- the next game: the schedule, or a playoff series ---------- */
  /* what the booth opens with tonight */
  function introCall(g) {
    if (g.po) {
      const sr = mySeries(); if (!sr || sr.bo === 1) return 'po_intro';
      const need = Math.ceil(sr.bo / 2), mine = sr.a === C.team ? sr.wa : sr.wb, theirs = sr.a === C.team ? sr.wb : sr.wa;
      return mine + theirs === 6 ? 'g7' : theirs === need - 1 ? 'elim' : mine === need - 1 ? 'closeout' : 'po_intro';
    }
    if (C.year === 1 && C.gi === 0) return 'debut';
    if (C.rival && g.opp === C.rival.team) return 'rival';
    return null;
  }
  function nextGame() {
    if (C.phase === 'regular') {
      const g = C.games[C.gi];
      return g && { opp: g.opp, home: g.home, label: `Game ${C.gi + 1} of ${C.games.length} · ${g.home ? 'Home' : 'Away'}${g.b2b ? ' · Back-to-back' : ''}`, g };
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
    const f = Math.pow(S.qlen / 3, 0.85) * ({ Starter: 1, 'Sixth man': 0.8, Bench: 0.65 }[role()] || 1);
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
    const mine5 = liveFive(), benchOf = (id, five) => C.rosters[id].filter(p => !(p.out > 0) && !five.includes(p) && p.id !== C.me.id).sort((a, b) => b.ovr - a.ovr).slice(0, 4);
    PB.Game.start({ teams: [t, o], rosters: [mine5, opp5], bench: [benchOf(C.team, mine5), benchOf(o.id, opp5)], userId: 'me', qlen: S.qlen, level: S.level,
      floor: g.home ? t : o, strength: [strength(C.team), strength(o.id)], playoff: !!g.po, onEnd: r => result(r, g),
      enterAt: { Starter: 0, 'Sixth man': 0.125, Bench: 0.25 }[role()] || 0, tired: !!g.b2b, callIntro: introCall(g), goals: C.goals, highs: C.highs, rivalId: C.rival && g.opp === C.rival.team ? C.rival.id : null });
  }
  /* several games at once: it stops for All-Star weekend and the playoffs; a word from the coach, life and offers
     wait on the hub. The run shows as a list. */
  function simMany(n) {
    const out = [];
    for (let i = 0; i < n; i++) {
      const nx = nextGame(); if (!nx || C.phase !== 'regular') break;
      simOne(nx);
      out.push(nx.g);
      if (C.contest === 'invited' || C.dunk === 'invited' || (C.season.allstar && !C.asg) || C.gi >= C.games.length) break;   // the rest (talks, life, offers) waits on the hub
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
    const base = 104 + PB.gauss() * 9, margin = Math.abs(PB.gauss() * 9) + 1;
    const us = Math.round(win ? base + margin / 2 : base - margin / 2), them = Math.round(win ? base - margin / 2 : base + margin / 2);
    const line = simLine(C.me, role(), win);
    record(g, { us, them, win, line, grade: LET[line.gs], gscore: line.gs, sim: true, ct: line.ct });
  }
  function simGame() {
    const nx = nextGame(); if (!nx) return;
    const g = nx.g;
    const win = PB.rand() < winP(C.team, g.opp, g.home);
    const base = 104 + PB.gauss() * 9, margin = Math.abs(PB.gauss() * 9) + 1;
    const us = Math.round(win ? base + margin / 2 : base - margin / 2), them = Math.round(win ? base - margin / 2 : base + margin / 2);
    const line = simLine(C.me, role(), win);
    record(g, { us, them, win, line, grade: LET[line.gs], gscore: line.gs, sim: true, ct: line.ct });
    after(g, true);
  }

  function record(g, res) {
    g.done = true; g.res = res;
    const s = g.po ? (C.poStats = C.poStats || zero()) : C.season, T = C.totals;
    for (const k of ['pts', 'reb', 'ast', 'stl', 'blk', 'tov', 'fga', 'fgm', 'tpa', 'tpm', 'fta', 'ftm']) { s[k] += res.line[k]; T[k] += res.line[k]; }
    s.gp++; T.gp++; s.grades += res.gscore; T.grades += res.gscore;
    const o = PB.team(g.opp), me = C.me;
    if (g.po) {
      if (res.win) s.w++; else s.l++;
      C.po.games.push(g);
      playoffResult(res.win);
    } else {
      if (res.win) { s.w++; T.w++; C.standings[C.team].w++; C.standings[g.opp].l++; } else { s.l++; T.l++; C.standings[C.team].l++; C.standings[g.opp].w++; }
      simLeagueDay(g.opp);
    }
    /* the other starters in your game, and your own line at full length (a short-quarter game scaled up) for the
       leaders, the awards and your market value */
    if (!g.po) { leagueLines(g.opp, !res.win); }
    const k = res.sim ? 1 : 12 / S.qlen, A = C.adj || (C.adj = { gp: 0, pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tpm: 0 });
    if (!g.po) { A.gp++; for (const x of LS.slice(1)) A[x] += (res.line[x] || 0) * k; weekly(res, k); }
    /* your rival, when it is his team */
    if (C.rival && g.opp === C.rival.team) {
      const rl = rivalGame(!res.win);
      if (rl) { const meWon = res.line.pts + res.line.reb + res.line.ast >= rl.pts + rl.reb + rl.ast; C.rival.h2h[meWon ? 0 : 1]++; res.rival = rl; }
    }
    /* the game's goals */
    if (C.goals) {
      res.goals = C.goals.map(g => ({ text: g.text, met: goalMet(g, res.line, res.gscore) }));
      const met = res.goals.filter(g => g.met).length;
      me.sp += Math.round(met * 2 * PB.clamp(20 / (C.len || 20), 0.3, 1.5)); C.trust = PB.clamp((C.trust ?? 45) + met * 1.5, 0, 100);
      C.goals = null;
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
    const sp = Math.max(1, Math.round((res.gscore * 0.9 + (res.win ? 2 : 0) + (g.po ? 2 : 0)) * spScale));
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
    /* endorsements: past a following, a shoe company calls */
    const tiers = [[25e3, 0.4], [1e5, 1.2], [5e5, 4], [2e6, 10]];
    C.endorse = C.endorse || { tier: 0 };
    for (let i = C.endorse.tier; i < tiers.length; i++) if (C.fans >= tiers[i][0]) { C.endorse.offer = i; break; }
    /* between games, now and then, life happens: a choice with a cost and a payoff */
    if (!g.po && !C.event && PB.rand() < 0.28) C.event = EVENTS[Math.floor(PB.rand() * EVENTS.length)].k;
    /* now and then the body pays for it: a sore ankle or a tight hamstring, a few points for a game or two */
    if (C.injury) { C.injury.games--; if (C.injury.games <= 0) { for (const k in C.injury.r) me.r[k] = Math.min(99, me.r[k] + C.injury.r[k]); me.ovr = PB.ovr(me.r, me.pos); C.news.unshift(`${me.last} is back to full health`); C.injury = null; } }
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
    { k: 'slump', q: 'A veteran teammate is in a shooting slump and asks you to stay after practice with him.', a: [['Stay and rebound for him', { trust: 3, sp: -1 }, 'He found his stroke. The locker room noticed who helped.'], ['Head home', { sp: 1 }, 'Rest matters too.']] },
    { k: 'sneaker', q: 'A sneaker blog wants to feature your game-day shoes.', a: [['Do the shoot', { fans: 4 }, 'Your kicks are trending.'], ['Keep it low-key', { trust: 1 }, 'All business.']] },
    { k: 'vet', q: 'The team\'s oldest player offers to show you his pregame routine.', a: [['Learn it', { sp: 2, trust: 2 }, 'Stretch, film, quiet. It works.'], ['Keep your own', {}, 'You know what works for you.']] },
    { k: 'festival', q: 'The city\'s summer festival asks you to throw the first pitch at a ballgame.', a: [['Throw it', { fans: 4 }, 'A strike, somehow. Highlight of the week.'], ['Pass', {}, 'Maybe next year.']] },
    { k: 'gaming', q: 'A streamer invites you to play online with his audience.', a: [['Stream for an hour', { fans: 7, trust: -1 }, 'Twenty thousand people watched you lose at a video game.'], ['Sleep', { sp: 1 }, 'Early night.']] },
    { k: 'diet', q: 'The team nutritionist has a new meal plan for you.', a: [['Follow it', { sp: 2 }, 'Lighter on your feet already.'], ['Ignore it', { trust: -1 }, 'Pizza, again.']] },
  ];
  function eventCard() {
    const ev = EVENTS.find(e => e.k === C.event); if (!ev) return '';
    return `<div class="next event"><p class="kick">Between games</p><p class="q">${esc(ev.q)}</p>${ev.a.map((a, i) => `<button class="ghost" data-ev="${i}">${esc(a[0])}</button>`).join('')}</div>`;
  }
  function eventPick(i) {
    const ev = EVENTS.find(e => e.k === C.event); if (!ev) return;
    const [lbl, fx, txt] = ev.a[i];
    if (fx.fans) C.fans = Math.round(C.fans * (1 + fx.fans / 100));
    if (fx.sp) C.me.sp = Math.max(0, C.me.sp + fx.sp);
    if (fx.trust) C.trust = PB.clamp(C.trust + fx.trust, 0, 100);
    C.news.unshift(`${C.me.last}: ${txt}`);
    C.event = null; save(); hub();
  }

  /* ---------- the social feed ---------- */
  const FANS = ['hoopsdad_22', 'courtside_kay', 'bucketsonly', 'the_real_ref', 'nightcapnation', 'bench_mob', 'stat_nerd', 'local_scribe'];
  function feedAfter(g, res) {
    const l = res.line, me = C.me, o = PB.team(g.opp), t = PB.team(C.team);
    const posts = [];
    const who = () => '@' + FANS[Math.floor(PB.rand() * FANS.length)];
    if (l.pts >= 30) posts.push([who(), `${me.last} just put ${l.pts} on ${o.city}. Somebody check on their defense.`]);
    else if (l.pts >= 20) posts.push([who(), `${l.pts} for ${me.last} tonight. This kid is for real.`]);
    else if (res.gscore <= 3) posts.push([who(), `Rough one for #${me.num}. Shake it off.`]);
    if (l.ast >= 8) posts.push([who(), `${l.ast} dimes. ${me.last} sees the whole floor.`]);
    if (l.blk >= 3) posts.push([who(), `${l.blk} blocks?! Stay out of the paint when ${me.last} is home.`]);
    if (l.tpm >= 4) posts.push([who(), `${l.tpm} threes for #${me.num}. Range for days.`]);
    if (l.stl >= 3) posts.push([who(), `${me.last} with ${l.stl} steals. Hands everywhere.`]);
    if (res.gscore >= 11) posts.push(['@stat_nerd', `${me.last}'s teammate grade tonight: ${res.grade}. That is winning basketball.`]);
    if (!res.win && l.pts >= 20) posts.push([who(), `${me.last} did everything he could. Need more help.`]);
    if (res.rival) posts.push([`@${o.name.toLowerCase()}_insider`, `${me.last} vs ${rivalP().last}: ${l.pts} to ${res.rival.pts}. ${l.pts >= res.rival.pts ? 'Round to the rookie from ' + t.city + '.' : 'This one goes to ' + rivalP().last + '.'}`]);
    if (res.win) posts.push([`@${t.name.toLowerCase()}`, `FINAL: ${t.name} ${res.us}, ${o.name} ${res.them}. ${g.po ? 'Playoff basketball!' : 'Big win.'}`]);
    else posts.push([`@${t.name.toLowerCase()}`, `FINAL: ${o.name} ${res.them}, ${t.name} ${res.us}. On to the next one.`]);
    for (const [w, x] of posts.slice(0, 3)) C.feed.unshift({ who: w, text: x });
    C.feed = C.feed.slice(0, 20);
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
  };
  function pressFor(g, r) {
    if (r.sim) return null;
    const last = C.games.filter(x => x.done).slice(-4);
    if (!g.po && last.length === 4 && last.every(x => !x.res.win) && PB.rand() < 0.6) return ['losing', ''];
    if (!g.po && last.length === 4 && last.every(x => x.res.win) && PB.rand() < 0.5) return ['winning', ''];
    if (C.contract && C.contract.years === 1 && PB.rand() < 0.15) return ['contract', ''];
    if (C.rival && g.opp === C.rival.team && PB.rand() < 0.8) return ['rival', PB.full(rivalP())];
    if (g.po && C.po.games.length === 1) return ['playoff', ''];
    if (r.line.pts >= 22 || r.gscore >= 10) return ['big', r.line.pts];
    if (r.gscore <= 3) return ['bad', ''];
    return null;
  }
  function after(g, sim) {
    const r = g.res, o = PB.team(g.opp), t = PB.team(C.team), l = r.line;
    const pr = pressFor(g, r);
    const P = pr && PRESS[pr[0]];
    show(`<div class="page post"><p class="kick">${sim ? 'Simulated' : 'Final'}${g.po ? ' · Playoffs' : ''}</p>
      <div class="final"><div>${badge(t)}<b>${r.us}</b></div><em>${r.win ? 'WIN' : 'LOSS'}</em><div><b>${r.them}</b>${badge(o)}</div></div>
      <div class="gradebig"><b>${r.grade}</b><span>Teammate grade</span></div>
      <div class="tiles"><div><b>${l.pts}</b><span>PTS</span></div><div><b>${l.reb}</b><span>REB</span></div><div><b>${l.ast}</b><span>AST</span></div>
      <div><b>${l.fgm}/${l.fga}</b><span>FG</span></div><div><b>${l.tpm}/${l.tpa}</b><span>3PT</span></div><div><b>${l.stl}/${l.blk}</b><span>STL/BLK</span></div></div>
      ${sim ? '' : reelBtn()}
      ${r.rival ? `<div class="card rival"><h3>Rival</h3><p>${esc(rivalP().last)}: ${r.rival.pts} pts, ${r.rival.reb} reb, ${r.rival.ast} ast. Head to head, you're ${C.rival.h2h[0]}-${C.rival.h2h[1]}.</p></div>` : ''}
      ${r.goals ? `<div class="card goalsdone"><h3>Goals <small>${r.goals.filter(g => g.met).length} of ${r.goals.length} · +${r.goals.filter(g => g.met).length * 2} SP</small></h3>${r.goals.map(g => `<p class="${g.met ? 'w' : 'l'}">${g.met ? '✓' : '✗'} ${esc(g.text)}</p>`).join('')}</div>` : ''}
      ${r.records && r.records.length ? `<div class="card earn"><b>Record book</b><span>A new best on this device: ${r.records.map(esc).join(' · ')}</span></div>` : ''}
      ${(r.highs && r.highs.length) || (r.miles && r.miles.length) ? `<div class="card earn"><b>${r.highs && r.highs.length ? 'New career high' + (r.highs.length > 1 ? 's' : '') : 'Milestone'}</b><span>${[...(r.highs || []), ...(r.miles || [])].map(esc).join(' · ')}</span></div>` : ''}
      ${r.newBadges && r.newBadges.length ? `<div class="card earn"><b>Badge earned</b><span>${r.newBadges.map(esc).join(' · ')}</span></div>` : ''}
      ${P ? `<div class="card press" id="press"><h3>Press conference</h3><p class="q">“${esc(P.q(pr[1]))}”</p>${P.a.map((a, i) => `<button class="ans" data-i="${i}">${esc(a[0])}</button>`).join('')}</div>` : ''}
      ${r.log && r.log.length ? `<div class="card"><h3>What moved your grade</h3>${summarize(r.log)}</div>` : ''}
      ${r.shots && r.shots.length ? shotChart(r.shots) : ''}
      ${r.boxHtml || ''}
      <div class="card earn"><b>+${r.sp} skill points</b><span>${C.me.sp} to spend on the Player tab · coach trust ${Math.round(C.trust)}</span></div>
      <button class="big" id="go">Continue</button></div>`);
    if (P) scr().querySelectorAll('#press .ans').forEach(b => b.onclick = () => {
      const a = P.a[+b.dataset.i];
      C.trust = PB.clamp(C.trust + a[1], 0, 100); C.fans = Math.round(C.fans * (1 + a[2] / 100));
      C.news.unshift(`${C.me.last} at the podium: "${a[0]}"`);
      C.feed.unshift({ who: '@local_scribe', text: `${C.me.last}, after the game: "${a[0]}"` });
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
      show(`<div class="page post"><p class="kick">Final</p>
        <div class="final"><div>${badge(res.teams[0])}<b>${res.score[0]}</b></div><em>${res.score[0] > res.score[1] ? 'WIN' : 'LOSS'}</em><div><b>${res.score[1]}</b>${badge(res.teams[1])}</div></div>
        <div class="gradebig"><b>${res.grade || '–'}</b><span>Teammate grade</span></div>
        <div class="tiles"><div><b>${u.pts || 0}</b><span>PTS</span></div><div><b>${u.reb || 0}</b><span>REB</span></div><div><b>${u.ast || 0}</b><span>AST</span></div>
        <div><b>${u.fgm || 0}/${u.fga || 0}</b><span>FG</span></div><div><b>${u.tpm || 0}/${u.tpa || 0}</b><span>3PT</span></div><div><b>${u.stl || 0}/${u.blk || 0}</b><span>STL/BLK</span></div></div>
        ${potg(res)}${reelBtn()}
        ${boxScore(res)}
        <button class="big" id="go">Main menu</button></div>`);
      $('#go').onclick = title; reelWire();
      return;
    }
    const gi = LET.indexOf(res.grade);
    const u = res.user || {};
    const line = Object.assign({ pts: 0, reb: 0, ast: 0, stl: 0, blk: 0, tov: 0, fga: 0, fgm: 0, tpa: 0, tpm: 0, fta: 0, ftm: 0 }, u);
    if (res.winner) (C.flags = C.flags || {}).winner = true;
    const ct = { tpm: u.tpm || 0, cs3: u.cs3 || 0, mid: u.mid || 0, lay: u.lay || 0, dunk: u.dunk || 0, shake: u.shake || 0, cmiss: u.cmiss || 0, clutch: u.clutch || 0 };
    record(g, { us: res.score[0], them: res.score[1], win: res.score[0] > res.score[1], line, grade: res.grade, gscore: gi < 0 ? 6 : gi, sim: false, log: res.gradeLog, ct, shots: res.shots });
    g.res.boxHtml = potg(res) + boxScore(res);
    after(g, false);
  }
  /* the player of the game: the best line on the winning side (points, boards and assists, efficiency) */
  function potg(res) {
    if (!res.box || !res.box.length) return '';
    const w = res.score[0] >= res.score[1] ? 0 : 1, v = b => b.st.pts + b.st.reb * 0.8 + b.st.ast + (b.st.stl + b.st.blk) * 1.5 - (b.st.fga - b.st.fgm) * 0.4;
    const b = res.box.filter(x => x.team === w).sort((a, c) => v(c) - v(a))[0]; if (!b) return '';
    return `<div class="card earn"><b>Player of the game${b.user ? ': you' : ''}</b><span>${esc(PB.full(b.d))} · ${b.st.pts} pts, ${b.st.reb} reb, ${b.st.ast} ast · ${b.st.fgm}-${b.st.fga} FG</span></div>`;
  }
  function boxScore(res) {
    const rows = t => res.box.filter(b => b.team === t).map(b => `<tr class="${b.user ? 'me' : ''}"><td>${esc(b.d.last)}</td><td>${b.st.pts}</td><td>${b.st.reb}</td><td>${b.st.ast}</td><td>${b.st.fgm}-${b.st.fga}</td><td>${b.st.tpm}-${b.st.tpa}</td></tr>`).join('');
    return [0, 1].map(t => `<div class="card"><h3>${res.teams[t].name}</h3><table class="std"><tr><th></th><th>PTS</th><th>REB</th><th>AST</th><th>FG</th><th>3P</th></tr>${rows(t)}</table></div>`).join('');
  }

  /* ---------- All-Star ---------- */
  function allStarPick() {
    C.allstar = true;
    const s = C.season, gp = s.gp || 1, A = C.adj && C.adj.gp ? C.adj : null, ppg = A ? A.pts / A.gp : s.pts / gp, score = ppg + (A ? (A.reb + A.ast) / A.gp : (s.reb + s.ast) / gp) * 0.5 + (s.grades / gp - 6);
    if (score >= 21 || (ppg >= 17 && C.trust > 70)) {
      C.trophies.push(`All-Star, season ${C.year}`); C.me.sp += 5; C.fans = Math.round(C.fans * 1.15);
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
      const win = us_ > them_, mvp = line && line.pts * (sim ? 1 : 12 / S.qlen) >= 18 && win;
      if (mvp) { C.trophies.push(`All-Star Game MVP, season ${C.year}`); C.fans = Math.round(C.fans * 1.12); }
      C.news.unshift(`All-Star Game: ${win ? mine : other} ${Math.max(us_, them_)}-${Math.min(us_, them_)}${mvp ? `; ${C.me.last} is the MVP` : ''}`);
      save();
      show(`<div class="page post"><p class="kick">All-Star Game</p><div class="final"><div><b>${us_}</b></div><em>${win ? 'WIN' : 'LOSS'}</em><div><b>${them_}</b></div></div>
        <p class="mute">${mine} vs ${other}</p>${line ? `<div class="tiles"><div><b>${line.pts}</b><span>PTS</span></div><div><b>${line.reb}</b><span>REB</span></div><div><b>${line.ast}</b><span>AST</span></div></div>` : ''}
        ${mvp ? '<div class="card earn"><b>All-Star Game MVP</b><span>The trophy and the spotlight are yours.</span></div>' : ''}${sim ? '' : reelBtn()}<button class="big" id="go">Back to the season</button></div>`);
      $('#go').onclick = () => { lastReels = []; hub(); }; if (!sim) reelWire();
    };
    if (!play) { const ln = simLine(C.me, 'Starter', PB.rand() < 0.5); const a = 140 + Math.round(PB.gauss() * 10), b = 140 + Math.round(PB.gauss() * 10) + (a === 140 ? 1 : 0); done(a, b, ln, true); return; }
    scr().hidden = true;
    PB.Game.start({ teams: [T(mine), T(other)], rosters: [us, them], userId: 'me', qlen: S.qlen, level: 'All-Star', callIntro: 'allstar', floor: PB.team(C.team), strength: [90, 90],
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
      if (P.champ === C.team) { C.trophies.push(`Champion, season ${C.year}`); C.fans = Math.round(C.fans * 1.4); C.me.sp += 10; banner(C.team, { kind: 'title', text: `Season ${C.year}` }); }
    }
    P.round++;
    save();
  }
  function bracketCard() {
    const P = C.po; if (!P) return '';
    const row = sr => `<div class="sr ${sr.a === C.team || sr.b === C.team ? 'me' : ''}">${badge(PB.team(sr.a))}<b>${sr.wa}</b><em>–</em><b>${sr.wb}</b>${badge(PB.team(sr.b))}<span>${done(sr) ? PB.team(winner(sr)).name + (sr.bo > 1 ? ' win' : ' advance') : sr.bo > 1 ? 'best of ' + sr.bo : 'one game'}</span></div>`;
    return `<div class="card bracket"><h3>${P.champ ? 'Champions: ' + esc(tname(PB.team(P.champ))) : esc(P.series[0] ? P.series[0].tag : 'Playoffs')}</h3>${P.series.map(row).join('')}</div>`;
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
    const cat = (k, lbl) => { const top = rows.slice().sort((a, b) => b[k] - a[k]).slice(0, 5);
      const mine = rows.filter(r => r.me)[0], rank = mine ? rows.slice().sort((a, b) => b[k] - a[k]).indexOf(mine) + 1 : 0;
      return `<div class="lcat"><b>${lbl}</b>${top.map((r, i) => `<p class="${r.me ? 'me' : r.rival ? 'rv' : ''}"><span>${i + 1}</span><i>${esc(r.name)} <small>${PB.team(r.team).ab}</small></i><em>${r[k].toFixed(1)}</em></p>`).join('')}${mine && rank > 5 ? `<p class="me"><span>${rank}</span><i>You</i><em>${mine[k].toFixed(1)}</em></p>` : ''}</div>`; };
    return `<div class="card leaders"><h3>League leaders <small>a game, full-length</small></h3>${cat('ptspg', 'Points')}${cat('rebpg', 'Rebounds')}${cat('astpg', 'Assists')}${cat('stlpg', 'Steals')}${cat('blkpg', 'Blocks')}</div>`;
  }
  function awardsNight() {
    const s = C.season, gp = s.gp || 1, me = C.me;
    const mine = { name: PB.full(me), team: C.team, ppg: s.pts / gp, rpg: s.reb / gp, apg: s.ast / gp, dpg: (s.stl + s.blk) / gp, me: true };
    const wp = C.standings[C.team].w / Math.max(1, C.standings[C.team].w + C.standings[C.team].l);
    mine.score = mine.ppg + (mine.rpg + mine.apg) * 0.5 + wp * 12 + (s.grades / gp - 6) * 0.6;
    const A = C.adj && C.adj.gp ? C.adj : null;
    if (A) { mine.ppg = A.pts / A.gp; mine.rpg = A.reb / A.gp; mine.apg = A.ast / A.gp; mine.dpg = (A.stl + A.blk) / A.gp; mine.score = mine.ppg + (mine.rpg + mine.apg) * 0.5 + wp * 12 + (s.grades / gp - 6) * 0.6; }
    const lr = leaders().filter(r => !r.me);
    const pool = lr.length > 20 ? lr.map(r => { const tw = C.standings[r.team], twp = tw.w / Math.max(1, tw.w + tw.l);
      return { name: r.name, team: r.team, ppg: r.ptspg, rpg: r.rebpg, apg: r.astpg, dpg: r.stlpg + r.blkpg, score: r.ptspg + (r.rebpg + r.astpg) * 0.5 + twp * 12, rookie: r.rookie }; }) : leagueStars();
    const stars = pool.concat([mine]).sort((a, b) => b.score - a.score);
    const rv = rivalP(), rs = C.rival.season, rg = rs.gp || 1;
    const rook = [mine, { name: PB.full(rv), team: C.rival.team, ppg: rs.pts / rg, rpg: rs.reb / rg, apg: rs.ast / rg }]
      .concat([0, 1].map(() => ({ name: PB.randName(), team: PB.pick(PB.TEAMS).id, ppg: 9 + PB.rand() * 8, rpg: 2 + PB.rand() * 5, apg: 1 + PB.rand() * 4 })));
    rook.forEach(x => { x.score = x.ppg + (x.rpg + x.apg) * 0.5; });
    const aw = [];
    const win = (title, list, key) => { const w = list.slice().sort((a, b) => b[key || 'score'] - a[key || 'score'])[0]; aw.push([title, w]); return w.me; };
    const got = [];
    if (win('Most Valuable Player', stars)) got.push('MVP');
    if (C.year === 1 && win('Rookie of the Year', rook)) got.push('Rookie of the Year');
    const def = stars.map(x => Object.assign({}, x, { score: x.dpg }));
    if (win('Defensive Player of the Year', def)) got.push('Defensive Player of the Year');
    if (role() === 'Sixth man' && mine.ppg >= 12) { aw.push(['Sixth Man of the Year', mine]); got.push('Sixth Man of the Year'); }
    if (C.year > 1 && me.ovr - (C.startOvr || me.ovr) >= 6) { aw.push(['Most Improved Player', mine]); got.push('Most Improved Player'); }
    const rank = stars.indexOf(mine);
    const team = rank < 5 ? 'First' : rank < 10 ? 'Second' : rank < 15 ? 'Third' : null;
    if (team) got.push(`All-League ${team} Team`);
    if (C.po && C.po.champ === C.team && C.poStats && C.poStats.gp && C.poStats.pts / C.poStats.gp >= 14) got.push('Finals MVP');
    if (s.allstar) got.unshift('All-Star');
    if (C.po && C.po.champ === C.team) got.unshift('Champion');
    for (const g of got) if (!/Champion|All-Star/.test(g)) C.trophies.push(`${g}, season ${C.year}`);
    C.me.sp += got.length * 3;
    C.lastGot = got; C.phase = 'offseason'; save();   // awards are handed out once, even if the page is reloaded
    const line = x => `${esc(x.name)} <small>${PB.team(x.team).ab} · ${x.ppg.toFixed(1)} / ${x.rpg.toFixed(1)} / ${x.apg.toFixed(1)}</small>`;
    const in3d = got.length && !PB.noGL && PB.R.modelReady && PB.R.modelReady();
    show(`<div class="page post awards ${in3d ? 'draft over3d' : ''}"><p class="kick">Awards night · Season ${C.year}</p>
      ${in3d ? `<h2>${esc(got[0])}</h2><div class="spacer"></div>` : ''}
      ${aw.map(([t, w]) => `<div class="card aw ${w.me ? 'mine' : ''}"><span>${t}</span><b>${line(w)}</b></div>`).join('')}
      <div class="card"><h3>Your honors</h3>${got.length ? got.map(a => `<p class="news">🏆 ${esc(a)}</p>`).join('') : '<p class="mute">None this year. Next year.</p>'}
      ${team ? '' : `<p class="fine">You ranked ${ordinal(rank + 1)} in the league by the voters' formula; the top fifteen make an All-League team.</p>`}</div>
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
    if (!C.seasons.find(z => z.year === C.year)) C.seasons.push({ year: C.year, team: C.team, w: st.w, l: st.l, ppg: ppg.toFixed(1), rpg: rpg.toFixed(1), apg: apg.toFixed(1), awards: aw });
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
    const prod = A ? A.pts / A.gp + (A.reb + A.ast) / A.gp * 0.6 : s.pts / gp + (s.reb + s.ast) / gp * 0.6;
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
  function moveTo(tid) { C.team = tid; }
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
    const score = T.pts / 1000 * 2 + T.reb / 1000 + T.ast / 1000 * 1.3 + C.trophies.filter(t => /MVP/.test(t)).length * 4 + C.trophies.filter(t => /Champion,/.test(t)).length * 3
      + C.trophies.filter(t => /All-Star/.test(t)).length * 1.2 + C.trophies.filter(t => /All-League/.test(t)).length * 1.5 + C.seasons.length * 0.3;
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
      <div class="card"><h3>${inHall ? 'Hall of Fame: inducted' : 'Hall of Fame: not this time'}</h3><p>${inHall ? 'First ballot.' : 'A fine career. The voters wanted more hardware.'}${jersey ? ` The ${esc(PB.team(C.team).name)} retire your #${C.me.num}: it hangs in their rafters from tonight.` : ''}</p>
      <p class="fine">Hall score ${score.toFixed(1)} (22 gets you in): points, boards and assists, MVPs, titles, All-Star and All-League nods, seasons played.</p></div>
      <div class="card"><h3>Trophy case</h3>${C.trophies.map(x => `<p class="news">🏆 ${esc(x)}</p>`).join('') || '<p class="mute">Empty.</p>'}</div>
      <button class="big" id="go">Main menu</button></div>`);
    if (in3d) { scr().classList.add('over3d'); PB.R.showcase(C.me, PB.team(C.team)); }   // one last time at center court; your banner overhead
    $('#go').onclick = title;
  }
  const ordinal = n => n + (['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : n % 10] || 'th');

  PB.Career = { title, hub, get: () => C };
  PB.boot = () => {
    /* without WebGL the menus and the career still work; only the court cannot be drawn */
    try { PB.R.init($('#gl')); } catch (e) { PB.noGL = true; console.warn('3D unavailable', e); }
    title();
  };
})();
