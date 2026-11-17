/* PocketBasketball: Season mode. Exposes PB.Season.
   One team, the whole team under your thumbs (you are whoever has the ball, or the man guarding it), through a
   season of 10, 20, 41 or 82 games, the standings, team leaders, and an eight-team playoff (the top four in each
   conference) in series (best of one, three, five or seven by the season's length) to a champion and a Finals MVP. Saved on the device under its own key, apart from careers. */
(() => {
  'use strict';
  const PB = window.PB;
  const $ = s => document.querySelector(s);
  const KEY = 'pbb.season.v1';
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } };
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(Z)); } catch (e) { /* fine */ } };
  const badge = t => `<i class="tb" style="background:${t.c1};color:${PB.ink(t.c1, t.c2)}">${esc(t.ab || t.id)}</i>`;
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
    if (!m) return null;
    const gn = (m.wa || 0) + (m.wb || 0) + 1, top = m.a === Z.team, home = [1, 2, 5, 7].includes(gn) ? top : !top;
    const mine = top ? m.wa || 0 : m.wb || 0, theirs = top ? m.wb || 0 : m.wa || 0;
    return { opp: top ? m.b : m.a, home, label: `Playoffs · ${['Quarterfinal', 'Semifinal', 'Final'][Z.po.r]}${m.bo > 1 ? ` · Game ${gn} (${mine}-${theirs})` : ''}`, m };
  }
  function hub() {
    if (PB.audio) PB.audio.music(true);
    const t = PB.team(Z.team), st = Z.st[Z.team], nx = nextGame();
    const conf = c => rank(c).map((id, i) => `<tr class="${id === Z.team ? 'me' : ''} ${i === 4 ? 'cut' : ''}"><td>${i + 1}</td><td>${badge(PB.team(id))} ${esc(PB.team(id).name)}</td><td>${Z.st[id].w}</td><td>${Z.st[id].l}</td></tr>`).join('');
    const L = Object.values(Z.lead).filter(x => x.gp).map(x => ({ ...x, ppg: x.pts / x.gp, rpg: (x.reb || 0) / x.gp, apg: (x.ast || 0) / x.gp })).sort((a, b) => b.ppg - a.ppg).slice(0, 5);
    let card;
    if (Z.champ) card = `<div class="next"><p class="kick">Champions</p><h3>The ${esc(PB.team(Z.champ).city)} ${esc(PB.team(Z.champ).name)}</h3><p>${Z.champ === Z.team ? 'You did it. A title.' : 'Not this year.'}</p><button class="big" id="again">New season</button></div>`;
    else if (nx) { const o = PB.team(nx.opp); card = `<div class="next"><p class="kick">${nx.label}</p><div class="vs"><div>${badge(t)}<b>${esc(t.name)}</b><span>${st.w}-${st.l} · ${strength(Z.team)}</span></div><em>vs</em><div>${badge(o)}<b>${esc(o.name)}</b><span>${Z.st[o.id].w}-${Z.st[o.id].l} · ${strength(o.id)}</span></div></div>
      <button class="big" id="play">Play game</button><button class="ghost" id="sim">Sim game</button></div>`; }
    else card = `<div class="next"><p class="kick">Playoffs</p><p>${Z.po ? 'You are out. The playoffs go on.' : 'The regular season is over.'}</p><button class="big" id="po">${Z.po ? 'Sim the rest' : 'To the playoffs'}</button></div>`;
    show(`<div class="hub" style="--c1:${t.c1};--c2:${t.c2}"><div class="hubtop"><div class="me">${badge(t)}<div><b>${esc(t.city)} ${esc(t.name)}</b><span>Season mode · ${st.w}-${st.l}</span></div></div><button class="ic" id="menu" aria-label="Menu">⌂</button></div>
      ${card}
      ${Z.po ? `<div class="card bracket"><h3>Playoffs</h3>${Z.po.round.map(m => `<div class="sr ${m.a === Z.team || m.b === Z.team ? 'me' : ''}">${badge(PB.team(m.a))}<b>${m.bo > 1 ? m.wa || 0 : m.w ? (m.w === m.a ? 'W' : 'L') : ''}</b><em>–</em><b>${m.bo > 1 ? m.wb || 0 : m.w ? (m.w === m.b ? 'W' : 'L') : ''}</b>${badge(PB.team(m.b))}<span>${m.w ? esc(PB.team(m.w).name) : ''}</span></div>`).join('')}</div>` : ''}
      ${L.length ? `<div class="card"><h3>Your leaders <small>a game</small></h3><table class="std"><tr><th></th><th>PTS</th><th>REB</th><th>AST</th></tr>${L.map(x => `<tr><td>${esc(x.name)}</td><td>${x.ppg.toFixed(1)}</td><td>${x.rpg.toFixed(1)}</td><td>${x.apg.toFixed(1)}</td></tr>`).join('')}</table></div>` : ''}
      ${Z.mvp ? `<div class="card earn"><b>${esc(Z.mvp.title)}</b><span>${esc(Z.mvp.name)} · ${Z.mvp.line}</span></div>` : ''}
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
    const of5 = five(o.id), rest = (id, f) => Z.rosters[id].filter(p => !f.includes(p)).sort((a, b) => b.ovr - a.ovr).slice(0, 4);
    PB.Game.start({ teams: [t, o], rosters: [me, of5], bench: [rest(Z.team, me), rest(o.id, of5)], userId: me[0].id, switching: true, qlen: S().qlen, level: S().level,
      floor: nx.home ? t : o, strength: [strength(t.id), strength(o.id)], playoff: !!nx.m,
      onEnd: r => result(nx, r.score[0] > r.score[1], r) });
  }
  function result(nx, win, r) {
    const sc = 12 / (S().qlen || 3);
    if (r) for (const b of r.box.filter(x => x.team === 0)) { const e = Z.lead[b.d.id] || (Z.lead[b.d.id] = { name: PB.full(b.d), gp: 0, pts: 0, reb: 0, ast: 0 }); e.gp++; e.pts += b.st.pts * sc; e.reb = (e.reb || 0) + b.st.reb * sc; e.ast = (e.ast || 0) + b.st.ast * sc; if (nx.m) { e.ppts = (e.ppts || 0) + b.st.pts * sc; e.pgp = (e.pgp || 0) + 1; } }
    if (!nx.m) {
      const g = nx.g; g.done = true; g.win = win;
      Z.st[Z.team][win ? 'w' : 'l']++; Z.st[g.opp][win ? 'l' : 'w']++;
      leagueDay([Z.team, g.opp]); Z.gi++;
    } else {
      const m = nx.m; if (win === (m.a === Z.team)) m.wa = (m.wa || 0) + 1; else m.wb = (m.wb || 0) + 1;
      decide(m);
      for (const o of Z.po.round) if (o !== m && !o.w) { simOne(o); decide(o); }   // the other series play a game too
      advance();
    }
    save();
    const o = PB.team(nx.opp);
    show(`<div class="page post"><p class="kick">${r ? 'Final' : 'Simulated'}</p>
      <div class="final"><div>${badge(PB.team(Z.team))}<b>${r ? r.score[0] : win ? 'W' : ''}</b></div><em>${win ? 'WIN' : 'LOSS'}</em><div><b>${r ? r.score[1] : win ? '' : 'L'}</b>${badge(o)}</div></div>
      ${r ? `<div class="card"><h3>${esc(PB.team(Z.team).name)}</h3><table class="std"><tr><th></th><th>PTS</th><th>REB</th><th>AST</th></tr>${r.box.filter(x => x.team === 0).map(b => `<tr><td>${esc(b.d.last)}</td><td>${b.st.pts}</td><td>${b.st.reb}</td><td>${b.st.ast}</td></tr>`).join('')}</table></div>` : ''}
      ${r && r.reels && r.reels.length ? `<button class="ghost" id="reel">▶ Your highlights <small>${r.reels.length} from tonight</small></button>` : ''}
      <button class="big" id="go">Continue</button></div>`);
    $('#go').onclick = hub;
    if ($('#reel')) $('#reel').onclick = () => PB.Game.reel(r.reels, () => { $('#screen').hidden = false; });
  }
  /* series: best of one, three, five or seven by the season's length; the higher seed is home in games 1, 2, 5 and 7 */
  const BO = () => ({ 10: 1, 20: 3, 41: 5, 82: 7 }[Z.games.length] || 3);
  const mk = (a, b) => ({ a, b, wa: 0, wb: 0, bo: BO() });
  function simOne(m) { const gn = m.wa + m.wb + 1, aHome = [1, 2, 5, 7].includes(gn); if (PB.rand() < winP(m.a, m.b, aHome)) m.wa++; else m.wb++; }
  function decide(m) { const need = Math.ceil((m.bo || 1) / 2); if ((m.wa || 0) >= need) m.w = m.a; else if ((m.wb || 0) >= need) m.w = m.b; }
  function startPO() {
    const seeds = c => rank(c).slice(0, 4);
    const e = seeds('East'), w = seeds('West');
    Z.po = { r: 0, round: [mk(e[0], e[3]), mk(e[1], e[2]), mk(w[0], w[3]), mk(w[1], w[2])] };
    if (![...e, ...w].includes(Z.team)) while (!Z.champ) simRound();
  }
  function simRound() { for (const m of Z.po.round) while (!m.w) { simOne(m); decide(m); } advance(); }
  function advance() {
    if (Z.po.round.some(m => !m.w)) return;
    const ws = Z.po.round.map(m => m.w);
    if (ws.length === 1) { Z.champ = ws[0]; seasonMVP(); return; }
    Z.po.r++; Z.po.round = []; for (let i = 0; i < ws.length; i += 2) Z.po.round.push(mk(ws[i], ws[i + 1]));
    if (!Z.po.round.some(m => m.a === Z.team || m.b === Z.team) && !Z.champ) { /* out: the rest plays on when asked */ }
  }
  /* the season's honor for your team: Finals MVP if you won it, else your team's MVP */
  function seasonMVP() {
    const won = Z.champ === Z.team, L = Object.values(Z.lead).filter(x => x.gp);
    if (!L.length) return;
    const by = won ? (x => (x.ppts || 0) / Math.max(1, x.pgp || 0)) : (x => (x.pts + (x.reb || 0) * 0.7 + (x.ast || 0)) / x.gp);
    const b = L.sort((a, c) => by(c) - by(a))[0];
    Z.mvp = { title: won ? 'Finals MVP' : 'Team MVP', name: b.name, line: `${(b.pts / b.gp).toFixed(1)} pts, ${((b.reb || 0) / b.gp).toFixed(1)} reb, ${((b.ast || 0) / b.gp).toFixed(1)} ast` };
  }
  PB.Season = { start };
})();
