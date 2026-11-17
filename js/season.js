/* PocketBasketball: Season mode. Exposes PB.Season.
   One team, the whole team under your thumbs (you are whoever has the ball, or the man guarding it), through a
   season of 10, 20, 41 or 82 games, the standings, team leaders, and an eight-team playoff (the top four in each
   conference) to a champion. Saved on the device under its own key, apart from careers. */
(() => {
  'use strict';
  const PB = window.PB;
  const $ = s => document.querySelector(s);
  const KEY = 'pbb.season.v1';
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(Z)); } catch (e) { /* fine */ } };
  const badge = t => `<i class="tb" style="background:${t.c1};color:${t.c2}">${esc(t.ab || t.id)}</i>`;
  let Z = null;
  const show = html => { const s = $('#screen'); s.classList.remove('over3d'); s.innerHTML = html; s.hidden = false; s.scrollTop = 0; };
  const S = () => PB.settings || { qlen: 3, level: 'Pro', season: 20 };
  const strength = id => PB.teamOvr(Z.rosters[id]);
  const winP = (a, b, home) => 1 / (1 + Math.exp(-(strength(a) - strength(b) + (home ? 2 : -2)) / 4));
  const five = id => PB.POS.map(pos => Z.rosters[id].filter(p => p.pos === pos).sort((a, b) => b.ovr - a.ovr)[0]);
  const rank = conf => PB.TEAMS.filter(t => !conf || t.conf === conf).map(t => t.id)
    .sort((a, b) => (Z.st[b].w - Z.st[b].l) - (Z.st[a].w - Z.st[a].l) || strength(b) - strength(a));

  function start() {
    Z = load();
    if (Z && Z.team) { hub(); return; }
    pick();
  }
  function pick() {
    show(`<div class="page"><button class="back" id="bk">‹ Back</button><h2>Season</h2>
      <p class="mute">Pick a team. You control the whole team: whoever has the ball, and on defense the man guarding it (Switch moves you to the defender nearest the ball).</p>
      ${['East', 'West'].map(c => `<div class="card"><h3>${c}</h3>${PB.TEAMS.filter(t => t.conf === c).map(t => `<button class="trow" data-id="${t.id}">${badge(t)}<span>${esc(t.city)} ${esc(t.name)}</span></button>`).join('')}</div>`).join('')}</div>`);
    $('#bk').onclick = () => PB.Career.title();
    document.querySelectorAll('.trow').forEach(b => b.onclick = () => begin(b.dataset.id));
  }
  function begin(team) {
    const rosters = {}, st = {};
    for (const t of PB.TEAMS) { rosters[t.id] = PB.makeRoster(Math.round(PB.rr(70, 82))); st[t.id] = { w: 0, l: 0 }; }
    const n = S().season || 20, others = PB.TEAMS.map(t => t.id).filter(id => id !== team), sched = [];
    while (sched.length < n) for (const o of others.slice().sort(() => PB.rand() - 0.5)) if (sched.length < n) sched.push(o);
    Z = { team, rosters, st, games: sched.map((o, i) => ({ opp: o, home: i % 2 === 0, done: false })), gi: 0, lead: {}, po: null, champ: null };
    save(); hub();
  }
  /* one day of the league: every other team plays someone */
  function leagueDay(skip) {
    const ids = PB.TEAMS.map(t => t.id).filter(id => !skip.includes(id)).sort(() => PB.rand() - 0.5);
    for (let i = 0; i + 1 < ids.length; i += 2) { const w = PB.rand() < winP(ids[i], ids[i + 1], true) ? ids[i] : ids[i + 1]; Z.st[w].w++; Z.st[w === ids[i] ? ids[i + 1] : ids[i]].l++; }
  }
  function nextGame() {
    if (!Z.po) { const g = Z.games[Z.gi]; return g && { opp: g.opp, home: g.home, label: `Game ${Z.gi + 1} of ${Z.games.length} · ${g.home ? 'Home' : 'Away'}`, g }; }
    const m = Z.po.round.find(x => !x.w && (x.a === Z.team || x.b === Z.team));
    return m && { opp: m.a === Z.team ? m.b : m.a, home: m.a === Z.team, label: `Playoffs · ${['Quarterfinal', 'Semifinal', 'Final'][Z.po.r]}`, m };
  }
  function hub() {
    if (PB.audio) PB.audio.music(true);
    const t = PB.team(Z.team), st = Z.st[Z.team], nx = nextGame();
    const conf = c => rank(c).map((id, i) => `<tr class="${id === Z.team ? 'me' : ''} ${i === 4 ? 'cut' : ''}"><td>${i + 1}</td><td>${badge(PB.team(id))} ${esc(PB.team(id).name)}</td><td>${Z.st[id].w}</td><td>${Z.st[id].l}</td></tr>`).join('');
    const L = Object.values(Z.lead).filter(x => x.gp).map(x => ({ ...x, ppg: x.pts / x.gp })).sort((a, b) => b.ppg - a.ppg).slice(0, 5);
    let card;
    if (Z.champ) card = `<div class="next"><p class="kick">Champions</p><h3>The ${esc(PB.team(Z.champ).city)} ${esc(PB.team(Z.champ).name)}</h3><p>${Z.champ === Z.team ? 'You did it. A title.' : 'Not this year.'}</p><button class="big" id="again">New season</button></div>`;
    else if (nx) { const o = PB.team(nx.opp); card = `<div class="next"><p class="kick">${nx.label}</p><div class="vs"><div>${badge(t)}<b>${esc(t.name)}</b><span>${st.w}-${st.l} · ${strength(Z.team)}</span></div><em>vs</em><div>${badge(o)}<b>${esc(o.name)}</b><span>${Z.st[o.id].w}-${Z.st[o.id].l} · ${strength(o.id)}</span></div></div>
      <button class="big" id="play">Play game</button><button class="ghost" id="sim">Sim game</button></div>`; }
    else card = `<div class="next"><p class="kick">Playoffs</p><p>${Z.po ? 'You are out. The playoffs go on.' : 'The regular season is over.'}</p><button class="big" id="po">${Z.po ? 'Sim the rest' : 'To the playoffs'}</button></div>`;
    show(`<div class="hub" style="--c1:${t.c1};--c2:${t.c2}"><div class="hubtop"><div class="me">${badge(t)}<div><b>${esc(t.city)} ${esc(t.name)}</b><span>Season mode · ${st.w}-${st.l}</span></div></div><button class="ic" id="menu" aria-label="Menu">⌂</button></div>
      ${card}
      ${Z.po ? `<div class="card bracket"><h3>Playoffs</h3>${Z.po.round.map(m => `<div class="sr ${m.a === Z.team || m.b === Z.team ? 'me' : ''}">${badge(PB.team(m.a))}<b>${m.w ? (m.w === m.a ? 'W' : 'L') : ''}</b><em>–</em><b>${m.w ? (m.w === m.b ? 'W' : 'L') : ''}</b>${badge(PB.team(m.b))}<span>${m.w ? esc(PB.team(m.w).name) : ''}</span></div>`).join('')}</div>` : ''}
      ${L.length ? `<div class="card leaders"><h3>Your leaders <small>points a game</small></h3>${L.map((x, i) => `<p><span>${i + 1}</span>${esc(x.name)}<em>${x.ppg.toFixed(1)}</em></p>`).join('')}</div>` : ''}
      ${['East', 'West'].map(c => `<div class="card"><h3>${c}</h3><table class="std"><tr><th></th><th>Team</th><th>W</th><th>L</th></tr>${conf(c)}</table></div>`).join('')}
      <button class="ghost sm" id="quit">Start over with another team</button></div>`);
    $('#menu').onclick = () => PB.Career.title();
    if ($('#play')) $('#play').onclick = () => play(nx);
    if ($('#sim')) $('#sim').onclick = () => { const w = PB.rand() < winP(Z.team, nx.opp, nx.home); result(nx, w, null); };
    if ($('#po')) $('#po').onclick = () => { if (!Z.po) startPO(); else { while (!Z.champ) simRound(); } save(); hub(); };
    if ($('#again')) $('#again').onclick = () => { localStorage.removeItem(KEY); pick(); };
    $('#quit').onclick = () => { if (confirm('Leave this season and pick another team?')) { localStorage.removeItem(KEY); pick(); } };
  }
  function play(nx) {
    const t = PB.team(Z.team), o = PB.team(nx.opp), me = five(Z.team);
    $('#screen').hidden = true;
    PB.Game.start({ teams: [t, o], rosters: [me, five(o.id)], userId: me[0].id, switching: true, qlen: S().qlen, level: S().level,
      floor: nx.home ? t : o, strength: [strength(t.id), strength(o.id)], playoff: !!nx.m,
      onEnd: r => result(nx, r.score[0] > r.score[1], r) });
  }
  function result(nx, win, r) {
    if (r) for (const b of r.box.filter(x => x.team === 0)) { const e = Z.lead[b.d.id] || (Z.lead[b.d.id] = { name: PB.full(b.d), gp: 0, pts: 0 }); e.gp++; e.pts += b.st.pts * 12 / (S().qlen || 3); }
    if (!nx.m) {
      const g = nx.g; g.done = true; g.win = win;
      Z.st[Z.team][win ? 'w' : 'l']++; Z.st[g.opp][win ? 'l' : 'w']++;
      leagueDay([Z.team, g.opp]); Z.gi++;
    } else { nx.m.w = win ? Z.team : nx.opp; for (const m of Z.po.round) if (!m.w) m.w = PB.rand() < winP(m.a, m.b, true) ? m.a : m.b; advance(); }
    save();
    const o = PB.team(nx.opp);
    show(`<div class="page post"><p class="kick">${r ? 'Final' : 'Simulated'}</p>
      <div class="final"><div>${badge(PB.team(Z.team))}<b>${r ? r.score[0] : win ? 'W' : ''}</b></div><em>${win ? 'WIN' : 'LOSS'}</em><div><b>${r ? r.score[1] : win ? '' : 'L'}</b>${badge(o)}</div></div>
      ${r ? `<div class="card"><h3>${esc(PB.team(Z.team).name)}</h3><table class="std"><tr><th></th><th>PTS</th><th>REB</th><th>AST</th></tr>${r.box.filter(x => x.team === 0).map(b => `<tr><td>${esc(b.d.last)}</td><td>${b.st.pts}</td><td>${b.st.reb}</td><td>${b.st.ast}</td></tr>`).join('')}</table></div>` : ''}
      <button class="big" id="go">Continue</button></div>`);
    $('#go').onclick = hub;
  }
  function startPO() {
    const seeds = c => rank(c).slice(0, 4);
    const e = seeds('East'), w = seeds('West');
    Z.po = { r: 0, round: [{ a: e[0], b: e[3] }, { a: e[1], b: e[2] }, { a: w[0], b: w[3] }, { a: w[1], b: w[2] }] };
    if (![...e, ...w].includes(Z.team)) while (!Z.champ) simRound();
  }
  function simRound() { for (const m of Z.po.round) if (!m.w) m.w = PB.rand() < winP(m.a, m.b, true) ? m.a : m.b; advance(); }
  function advance() {
    if (Z.po.round.some(m => !m.w)) return;
    const ws = Z.po.round.map(m => m.w);
    if (ws.length === 1) { Z.champ = ws[0]; return; }
    Z.po.r++; Z.po.round = []; for (let i = 0; i < ws.length; i += 2) Z.po.round.push({ a: ws[i], b: ws[i + 1] });
    if (!Z.po.round.some(m => m.a === Z.team || m.b === Z.team) && !Z.champ) { /* out: the rest plays on when asked */ }
  }
  PB.Season = { start };
})();
