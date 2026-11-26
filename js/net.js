/* PocketBasketball: online play. Exposes PB.net.
   The park, online: everyone in the same park (the public one, or a private one by a code you share) walks around in
   it, and anyone can challenge anyone there to a game. The challenger's phone runs the game (the host); the other
   phone sends its stick and buttons and draws what the host sends back, the way a replay is drawn.
   It runs on the same Firebase project as the chat (Realtime Database, anonymous sign-in), under three paths the
   rules in docs/firebase-rules.json allow:
     bpark/<ROOM>/<uid>   who is in a park: a name, what he looks like (k), where he is (s), when (at)
     bchal/<to>/<from>    a challenge, and the answer to one
     bgame/<gid>          a game: who hosts and who plays (m), the host's frames (s), the guest's stick and buttons (i)
   Nothing connects until the park goes online, and the connection closes when it is left. A second backend runs in
   the page alone (BroadcastChannel) for the tests: two windows of one browser play each other with no network. */
(function () {
  const PB = window.PB;
  const ROOM_RE = /^[A-Z0-9]{4,8}$/;
  const now = () => Date.now();

  /* ---------- backends: start() -> uid; child(path, cb(key, val|null)); value(path, cb(val)); set; remove; leaveWith ---------- */
  function firebaseBackend() {
    let app = null, db = null, uid = null;
    const offs = [];
    return {
      async start() {
        await PB.online.libs('fb');
        const F = window.firebase, e = PB.online.emu();
        app = F.apps.find(a => a.name === 'pb');
        const first = !app;
        if (first) app = F.initializeApp(PB.online.config(), 'pb');
        db = app.database();
        if (first && e) { app.auth().useEmulator(e.auth, { disableWarnings: true }); db.useEmulator(e.host, e.port); }
        db.goOnline();
        const auth = app.auth();
        let user = await new Promise(r => { const off = auth.onAuthStateChanged(u => { off(); r(u); }); });
        if (!user) user = (await auth.signInAnonymously()).user;
        return (uid = user.uid);
      },
      child(path, cb) {
        const r = db.ref(path), a = s => cb(s.key, s.val()), c = s => cb(s.key, s.val()), d = s => cb(s.key, null);
        r.on('child_added', a); r.on('child_changed', c); r.on('child_removed', d);
        const off = () => { r.off('child_added', a); r.off('child_changed', c); r.off('child_removed', d); };
        offs.push(off); return off;
      },
      value(path, cb) { const r = db.ref(path), f = s => cb(s.val()); r.on('value', f); const off = () => r.off('value', f); offs.push(off); return off; },
      get: path => db.ref(path).once('value').then(s => s.val()),
      set: (path, val) => db.ref(path).set(val),
      update: (path, val) => db.ref(path).update(val),
      remove: path => db.ref(path).remove(),
      leaveWith: path => db.ref(path).onDisconnect().remove(),
      stamp: () => window.firebase.database.ServerValue.TIMESTAMP,
      stop() { while (offs.length) offs.pop()(); if (db) db.goOffline(); }
    };
  }
  /* the page-only backend: a tree kept in each window, every write told to the others */
  function localBackend(name) {
    const ch = new BroadcastChannel(name || 'pbnet'), tree = {}, subs = [];
    const uid = 'u' + Math.random().toString(36).slice(2, 10);
    const getP = p => p.split('/').reduce((o, k) => (o == null ? undefined : o[k]), tree);
    const parent = p => p.split('/').slice(0, -1).join('/'), last = p => p.split('/').pop();
    function apply(path, val) {
      const ks = path.split('/'); let o = tree;
      for (let i = 0; i < ks.length - 1; i++) o = o[ks[i]] || (o[ks[i]] = {});
      const k = ks[ks.length - 1];
      if (val == null) delete o[k]; else o[k] = JSON.parse(JSON.stringify(val));
      for (const s of subs.slice()) {
        if (s.kind === 'child' && s.path === parent(path)) s.cb(last(path), val == null ? null : getP(path));
        else if (s.kind === 'child' && path.startsWith(s.path + '/') && path !== s.path) { const k2 = path.slice(s.path.length + 1).split('/')[0]; s.cb(k2, getP(s.path + '/' + k2) ?? null); }
        else if (s.kind === 'value' && (s.path === path || s.path.startsWith(path + '/') || path.startsWith(s.path + '/'))) s.cb(getP(s.path) ?? null);
      }
    }
    const mine = new Set();
    ch.onmessage = e => { const m = e.data; if (m.op === 'set') apply(m.path, m.val); else if (m.op === 'hello') { for (const p of mine) { const v = getP(p); if (v != null) ch.postMessage({ op: 'set', path: p, val: v }); } } };
    const set = (path, val) => { apply(path, val); if (val == null) mine.delete(path); else mine.add(path); ch.postMessage({ op: 'set', path, val: val == null ? null : val }); return Promise.resolve(); };
    return {
      async start() { ch.postMessage({ op: 'hello' }); await new Promise(r => setTimeout(r, 60)); return uid; },
      child(path, cb) { const s = { kind: 'child', path, cb }; subs.push(s); const v = getP(path); if (v) for (const k of Object.keys(v)) cb(k, v[k]); return () => subs.splice(subs.indexOf(s), 1); },
      value(path, cb) { const s = { kind: 'value', path, cb }; subs.push(s); cb(getP(path) ?? null); return () => subs.splice(subs.indexOf(s), 1); },
      get: path => Promise.resolve(getP(path) ?? null),
      set,
      update: (path, val) => { for (const k of Object.keys(val)) set(path + '/' + k, val[k]); return Promise.resolve(); },
      remove: path => set(path, null),
      leaveWith: path => { addEventListener('pagehide', () => set(path, null)); return Promise.resolve(); },
      stamp: () => now(),
      stop() { for (const p of [...mine]) if (p.startsWith('bpark/')) set(p, null); subs.length = 0; ch.close(); }
    };
  }

  /* ---------- who you are online: a name, and what the others need to draw you (and to put you in a game) ---------- */
  const KEEP = ['id', 'kitT', 'first', 'last', 'num', 'ht', 'wt', 'skin', 'look', 'pos', 'ovr', 'r', 'hand', 'org', 'badges', 'handle'];
  function card(d) {
    const o = {}; for (const k of KEEP) if (d[k] !== undefined) o[k] = d[k];
    if (o.badges) { const b = {}; for (const k in o.badges) if (o.badges[k]) b[k] = o.badges[k]; o.badges = b; }
    let s = JSON.stringify(o);
    if (s.length > 1800) { delete o.badges; s = JSON.stringify(o); }
    return s;
  }
  const cleanName = n => { const p = PB.online && PB.online.plain ? PB.online.plain(n, 16) : String(n || '').slice(0, 16); return (PB.online && PB.online.clean ? PB.online.clean(p) : p) || 'Hooper'; };
  const readCard = s => { try { const d = JSON.parse(s); if (!d || typeof d !== 'object' || !d.r) return null; return d; } catch (e) { return null; } };

  let be = null, uid = null, room = null, meRef = null, hooks = null, lastS = '', lastT = 0, offs = [];
  const backend = () => be || (be = (window.PB_NET_LOCAL ? localBackend(window.PB_NET_LOCAL) : firebaseBackend()));
  const roomOk = r => ROOM_RE.test(String(r || ''));
  const newRoom = () => { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for (let i = 0; i < 5; i++) s += A[Math.floor(Math.random() * A.length)]; return s; };

  /* into a park: h = { join(uid, name, d), move(uid, state), leave(uid), challenge(from, c), answer(from, a), state(text) } */
  async function joinPark(r, d, name, h) {
    await leavePark();
    if (!roomOk(r)) throw new Error('bad room');
    hooks = h; room = r;
    h.state && h.state('connecting');
    uid = await backend().start();
    meRef = `bpark/${room}/${uid}`;
    await backend().set(meRef, { n: cleanName(name), k: card(d), s: '', at: backend().stamp() });
    backend().leaveWith(meRef);
    const seen = {};
    offs.push(backend().child(`bpark/${room}`, (k, v) => {
      if (k === uid || !hooks) return;
      if (!v) { if (seen[k]) { delete seen[k]; hooks.leave(k); } return; }
      if (!seen[k]) { const dd = readCard(v.k); if (!dd) return; seen[k] = true; hooks.join(k, cleanName(v.n), dd); }
      if (v.s) hooks.move(k, v.s);
    }));
    offs.push(backend().child(`bchal/${uid}`, (k, v) => { if (!v || !hooks) return; if (v.go || v.ok !== undefined) hooks.answer && hooks.answer(k, v); else hooks.challenge && hooks.challenge(k, v); }));
    h.state && h.state('live');
    return uid;
  }
  /* where you are, a few times a second (only when it changed) */
  function move(s) {
    if (!meRef) return;
    const t = now();
    if (s === lastS || t - lastT < 220) return;
    lastS = s; lastT = t;
    backend().update(meRef, { s }).catch(() => {});
  }
  async function leavePark() {
    while (offs.length) offs.pop()();
    if (meRef && be) { try { await be.remove(meRef); } catch (e) { /* gone already */ } }
    meRef = null; room = null; hooks = null; lastS = '';
  }
  function stop() { leavePark(); if (be) { be.stop(); be = null; } uid = null; }

  /* ---------- challenges ---------- */
  const challenge = (to, kind, name) => backend().set(`bchal/${to}/${uid}`, { n: cleanName(name), kind: +kind || 1, room, at: backend().stamp() });
  const answer = (to, ok, name) => backend().set(`bchal/${to}/${uid}`, { n: cleanName(name), ok: ok ? 1 : 0, at: backend().stamp() });
  const sendGo = (to, gid, name) => backend().set(`bchal/${to}/${uid}`, { n: cleanName(name), go: gid, at: backend().stamp() });
  const clearChal = from => backend().remove(`bchal/${uid}/${from}`).catch(() => {});

  /* ---------- a game: the host writes m (the setup) and s (frames), the guest writes i (stick and buttons) ---------- */
  function hostGame(guest, setup) {
    const gid = uid + '_' + now().toString(36);
    const base = `bgame/${gid}`;
    return backend().set(`${base}/m`, { h: uid, g: guest, at: backend().stamp(), r: JSON.stringify(setup) }).then(() => ({
      gid,
      send: s => backend().set(`${base}/s`, s).catch(() => {}),
      onInput: cb => { const off = backend().value(`${base}/i`, v => { if (v) cb(v); }); offs.push(off); return off; },
      end: () => backend().remove(base).catch(() => {})
    }));
  }
  async function joinGame(gid) {
    const base = `bgame/${gid}`, m = await backend().get(`${base}/m`);
    if (!m || m.g !== uid) throw new Error('no such game');
    return {
      gid, host: m.h, setup: JSON.parse(m.r),
      send: i => backend().set(`${base}/i`, i).catch(() => {}),
      onFrame: cb => { const off = backend().value(`${base}/s`, v => { if (v) cb(v); }); offs.push(off); return off; },
      end: () => {}
    };
  }

  PB.net = {
    joinPark, leavePark, move, stop, challenge, answer, sendGo, clearChal, hostGame, joinGame, newRoom, roomOk, card, readCard,
    get uid() { return uid; }, get room() { return room; },
    ready: () => !!window.PB_NET_LOCAL || !!(PB.online && PB.online.ready && PB.online.ready()),
    test: { localBackend }
  };
})();
