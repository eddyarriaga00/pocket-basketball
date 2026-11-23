/* PocketBasketball: accounts. Exposes PB.account.
   An account is an email address and a password on the game's Firebase project (the same one the chat uses), and it
   keeps a copy of your save, so a cleared browser does not lose a career and a new phone picks up where the old one
   left off. Everything else still works without one.

   - Signing up while the chat has you signed in anonymously links the two: your chat name, mutes and reports stay yours.
   - The copy is the whole save (careers, records, settings), gzipped when the browser can, at saves/<your id>. It goes
     up a few seconds after the game saves and when the app goes to the background. The database's rules let only you
     read or write it, and only signed in with a password (docs/ACCOUNTS.md, docs/firebase-rules.json).
   - Coming down, it is checked the way an imported file is (PB.saves.check): it is data, not code.
   - Two phones that both played since they last agreed: you choose which save to keep, and are told what each holds.
   Nothing touches the network until you open the Account page or an account is already signed in on this phone. */
(function () {
  const PB = window.PB, $ = s => document.querySelector(s);
  const load = (k, d) => { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage full or off */ } };
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const KEY = 'pbb.acct', DEV = 'pbb.acct.dev';   // { uid, email, name, synced: the cloud copy's time this phone last agreed with }
  const dev = () => { let d = load(DEV, null); if (!d) { d = Date.now().toString(36) + Math.floor(Math.random() * 1e9).toString(36); save(DEV, d); } return d; };
  const plain = (s, n) => (PB.online && PB.online.plain ? PB.online.plain(s, n) : String(s || '').replace(/[<>]/g, '').trim().slice(0, n));
  const when = t => { if (!t) return 'never'; const d = new Date(t), now = new Date(), same = d.toDateString() === now.toDateString(); return same ? 'today, ' + d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ', ' + d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); };

  /* ---------- the service: Firebase ----------
     A backend: { init() -> Promise<user|null>, signUp(name, email, pw), signIn(email, pw), signOut(), reset(email),
     verify(), del(pw), pull(uid) -> {at, dev, z, data}|null, push(uid, rec), onUser(fn) }; a user is { uid, email,
     name, verified }. Errors carry a code (auth/..., or 'denied'). Tests swap in their own (PB.DEV only). */
  function firebaseBackend() {
    let app = null, auth = null, db = null;
    const F = () => window.firebase, U = u => u && !u.isAnonymous ? { uid: u.uid, email: u.email || '', name: u.displayName || '', verified: !!u.emailVerified } : null;
    const denied = e => { const c = String((e && (e.code || e.message)) || ''); if (/permission/i.test(c)) { const x = new Error('denied'); x.code = 'denied'; throw x; } throw e; };
    return {
      async init() {
        const cfg = PB.online && PB.online.config(); if (!cfg) { const e = new Error('off'); e.code = 'off'; throw e; }
        await PB.online.libs('fb');
        app = F().apps.find(a => a.name === 'pb'); const first = !app; if (first) app = F().initializeApp(cfg, 'pb');
        auth = app.auth(); db = app.database();
        const em = PB.online.emu && PB.online.emu(); if (first && em) { auth.useEmulator(em.auth, { disableWarnings: true }); db.useEmulator(em.host, em.port); }
        const u = await new Promise(r => { const off = auth.onAuthStateChanged(x => { off(); r(x); }); });
        return U(u);
      },
      async signUp(name, email, pw) {
        const cur = auth.currentUser, cred = F().auth.EmailAuthProvider.credential(email, pw);
        const r = cur && cur.isAnonymous ? await cur.linkWithCredential(cred) : await auth.createUserWithEmailAndPassword(email, pw);
        await r.user.updateProfile({ displayName: name });
        r.user.sendEmailVerification().catch(() => {});
        return U(r.user);
      },
      async signIn(email, pw) { return U((await auth.signInWithEmailAndPassword(email, pw)).user); },
      signOut: () => auth.signOut(),
      reset: email => auth.sendPasswordResetEmail(email),
      verify: () => auth.currentUser && auth.currentUser.sendEmailVerification(),
      async refresh() { if (auth.currentUser) { await auth.currentUser.reload(); return U(auth.currentUser); } return null; },
      async del(pw) {
        const u = auth.currentUser; if (!u) return;
        if (pw) await u.reauthenticateWithCredential(F().auth.EmailAuthProvider.credential(u.email, pw));
        await db.ref().update({ ['saves/' + u.uid]: null, ['accounts/' + u.uid]: null }).catch(denied);
        await u.delete();
      },
      async pull(uid) { db.goOnline(); try { const s = await db.ref('saves/' + uid).once('value'); return s.val(); } catch (e) { return denied(e); } },
      async push(uid, rec) { db.goOnline(); try { await db.ref().update({ ['saves/' + uid]: rec, ['accounts/' + uid]: { name: rec.name, at: rec.at } }); } catch (e) { return denied(e); } },
      onUser(fn) { if (auth) auth.onAuthStateChanged(u => fn(U(u))); }
    };
  }

  /* ---------- packing a save ---------- */
  const b64 = buf => { let s = ''; const a = new Uint8Array(buf); for (let i = 0; i < a.length; i += 0x8000) s += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000)); return btoa(s); };
  const unb64 = t => { const s = atob(t), a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; };
  async function pack(text) {
    if (window.CompressionStream) { try { const buf = await new Response(new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer(); return { z: 1, data: b64(buf) }; } catch (e) { /* plain below */ } }
    return { z: 0, data: text };
  }
  async function unpack(rec) {
    if (!rec || typeof rec.data !== 'string' || rec.data.length > 9e6) return null;
    if (!rec.z) return rec.data;
    if (!window.DecompressionStream) return null;
    try { return await new Response(new Blob([unb64(rec.data)]).stream().pipeThrough(new DecompressionStream('gzip'))).text(); } catch (e) { return null; }
  }

  /* ---------- state ---------- */
  let be = null, ready = null, user = null, busy = false, pushT = 0, lastErr = '', conflict = null, offer = null;
  const A = () => load(KEY, {}) || {};
  const setA = o => save(KEY, Object.assign(A(), o));
  const backend = () => be || (be = firebaseBackend());
  function start() {
    if (!ready) ready = backend().init().then(u => { user = u; if (u) setA({ uid: u.uid, email: u.email, name: u.name }); backend().onUser(x => { user = x; }); return u; }).catch(e => { ready = null; throw e; });
    return ready;
  }

  /* what the cloud holds against what this phone holds: copy up, offer it down, or ask */
  async function sync(why) {
    if (!user || busy) return;
    busy = true; lastErr = '';
    try {
      const rec = await backend().pull(user.uid), a = A(), localAt = PB.saves.changed(), hasLocal = PB.saves.summary().players > 0;
      if (!rec || !rec.at) { await upload(); return; }
      /* a phone that has never agreed with this account counts its careers as new: they are never overwritten without asking */
      const agreed = !!a.synced && a.uid === user.uid, cloudNewer = rec.at > (agreed ? a.synced : 0), localNewer = agreed ? localAt > a.synced : hasLocal;
      if (!cloudNewer) { if (localNewer || why === 'now') await upload(); return; }
      /* the cloud has moved on since this phone last agreed with it */
      if (!hasLocal || (!localNewer && rec.dev !== dev())) { offer = rec; if (!hasLocal || why === 'signin') await take(rec); return; }   // nothing here to lose: it comes down; otherwise it is offered
      if (rec.dev === dev()) { await upload(); return; }
      conflict = rec;
    } catch (e) { lastErr = msg(e); }
    finally { busy = false; }
  }
  async function upload() {
    const o = PB.saves.collect(), text = JSON.stringify({ pocketBasketball: 1, at: new Date().toISOString(), data: o }), p = await pack(text), at = Date.now();
    const sum = PB.saves.summary();
    await backend().push(user.uid, { at, dev: dev(), z: p.z, data: p.data, name: plain(user.name || '', 24), players: sum.players, who: (sum.names || []).slice(0, 3).map(n => plain(n, 30)) });
    setA({ synced: at, up: at }); conflict = null; offer = null;
  }
  /* the cloud copy onto this phone: checked like an imported file, then the page starts over on it */
  async function take(rec) {
    const text = await unpack(rec); let o = null; try { o = JSON.parse(text); } catch (e) { /* not a save */ }
    const data = o && PB.saves.check(o);
    if (!data) { lastErr = 'The copy in your account could not be read.'; return false; }
    if (!PB.saves.apply(data)) { lastErr = 'This phone ran out of room for your save.'; return false; }
    try { localStorage.setItem('pbb.acct.changed', String(rec.at)); } catch (e) { /* fine */ }
    setA({ synced: rec.at, up: rec.at }); conflict = null; offer = null;
    save('pbb.acct.loaded', 1); location.reload(); return true;
  }
  function saved() {
    if (!user) return;
    clearTimeout(pushT); pushT = setTimeout(() => { if (!conflict) sync('save'); }, 4000);
  }

  const MSG = {
    'auth/email-already-in-use': 'That email already has an account. Sign in instead.', 'auth/invalid-email': 'That does not look like an email address.',
    'auth/weak-password': 'Use at least 8 characters for the password.', 'auth/wrong-password': 'The email or password is not right.', 'auth/user-not-found': 'The email or password is not right.',
    'auth/invalid-credential': 'The email or password is not right.', 'auth/invalid-login-credentials': 'The email or password is not right.', 'auth/too-many-requests': 'Too many tries. Wait a few minutes and try again.',
    'auth/network-request-failed': 'No connection. Try again when you are online.', 'auth/requires-recent-login': 'For that, type your password again.',
    'auth/operation-not-allowed': 'Accounts are not switched on for this game yet.', 'auth/credential-already-in-use': 'That email already has an account. Sign in instead.',
    denied: 'Saves in accounts are not switched on for this game yet. Your account works; your save stays on this phone for now.', off: 'Accounts are not set up for this game.'
  };
  const msg = e => MSG[(e && e.code) || ''] || (e && /network|offline|fetch/i.test(String(e.message)) ? MSG['auth/network-request-failed'] : 'Something went wrong. Try again.');

  /* ---------- the Account page ---------- */
  let back = null, mode = 'up';
  function page(html) { const s = $('#screen'); s.classList.remove('over3d'); s.innerHTML = `<div class="page acct"><button class="back" id="bk">‹ Back</button>${html}</div>`; s.hidden = false; s.scrollTop = 0; $('#bk').onclick = () => back && back(); }
  const note = (t, ok) => { const n = $('#anote'); if (n) { n.textContent = t || ''; n.className = 'anote' + (ok ? ' ok' : ''); } };
  const lock = on => { for (const b of document.querySelectorAll('.acct button, .acct input')) if (b.id !== 'bk') b.disabled = !!on; };

  async function open(from) {
    if (from) back = from;
    page('<h2>Account</h2><div class="card"><p class="mute">Connecting…</p></div>');
    try { await start(); } catch (e) { page(`<h2>Account</h2><div class="card"><p>${esc(msg(e))}</p><p class="fine">Everything else in the game works without one. Your careers are kept on this phone.</p></div>`); return; }
    if (user) { draw(); sync('open').then(() => { if ($('.acct') && user) draw(); }); } else draw();
  }

  function draw() {
    if (!user) {
      const up = mode === 'up';
      page(`<h2>${up ? 'Create an account' : 'Sign in'}</h2>
        <div class="stabs"><button data-m="up" class="${up ? 'on' : ''}">Create account</button><button data-m="in" class="${up ? '' : 'on'}">Sign in</button></div>
        <div class="card"><form id="aform" autocomplete="on" novalidate>
          ${up ? `<div class="field"><label for="aname">Name <small>what the chat and your friends see</small></label><input id="aname" maxlength="16" autocomplete="nickname" value="${esc((PB.online && PB.online.profile().name) || '')}"></div>` : ''}
          <div class="field"><label for="aemail">Email</label><input id="aemail" type="email" inputmode="email" autocomplete="email" autocapitalize="off" spellcheck="false"></div>
          <div class="field"><label for="apw">Password ${up ? '<small>8 characters or more</small>' : ''}</label><div class="pwrow"><input id="apw" type="password" autocomplete="${up ? 'new-password' : 'current-password'}"><button type="button" class="ghost sm" id="apeek">Show</button></div></div>
          <button class="big" id="ago" type="submit">${up ? 'Create account' : 'Sign in'}</button>
          ${up ? '' : '<button type="button" class="ghost sm" id="aforgot">Forgot your password?</button>'}
        </form><p id="anote" class="anote"></p></div>
        <p class="fine">${up ? 'An account keeps a copy of your save, so a cleared browser does not lose your careers and you can pick up on another phone. It holds your email address, your name and your save, nothing else. You can delete it whenever you like.' : 'Signing in brings your save to this phone. If this phone has careers of its own that are not in your account, you choose which to keep.'}</p>`);
      document.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { mode = b.dataset.m; draw(); });
      $('#apeek').onclick = () => { const p = $('#apw'); p.type = p.type === 'password' ? 'text' : 'password'; $('#apeek').textContent = p.type === 'password' ? 'Show' : 'Hide'; };
      if ($('#aforgot')) $('#aforgot').onclick = async () => { const em = $('#aemail').value.trim(); if (!em) { note('Type your email above first.'); return; } lock(1); try { await backend().reset(em); note('If that email has an account, a link to reset the password is on its way.', 1); } catch (e) { note(msg(e)); } lock(0); };
      $('#aform').onsubmit = async ev => {
        ev.preventDefault();
        const em = $('#aemail').value.trim(), pw = $('#apw').value, nm = up ? plain($('#aname').value, 16) : '';
        if (up && !nm) { note('Pick a name.'); return; }
        if (up && PB.online && PB.online.dirty && PB.online.dirty(nm)) { note('Pick another name.'); return; }
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) { note(MSG['auth/invalid-email']); return; }
        if (up && pw.length < 8) { note(MSG['auth/weak-password']); return; }
        if (!pw) { note('Type your password.'); return; }
        lock(1); note(up ? 'Creating your account…' : 'Signing in…', 1);
        try {
          user = up ? await backend().signUp(nm, em, pw) : await backend().signIn(em, pw);
          setA({ uid: user.uid, email: user.email, name: user.name, synced: up ? 0 : A().uid === user.uid ? A().synced : 0 });
          if (up && PB.online && PB.online.setName) PB.online.setName(nm);
          if (!up && user.name && PB.online && PB.online.setName && !PB.online.profile().name) PB.online.setName(user.name);
          await sync(up ? 'signup' : 'signin');
          draw();
        } catch (e) { lock(0); note(msg(e)); }
      };
      return;
    }
    const a = A(), sum = PB.saves.summary();
    page(`<h2>Account</h2>
      <div class="card aprof"><span class="pav big">${esc((user.name || user.email).slice(0, 2).toUpperCase())}</span><div><b>${esc(user.name || 'Player')}</b><span>${esc(user.email)}</span>${user.verified ? '<em class="ok">Email confirmed</em>' : '<em>Email not confirmed yet <button class="ghost sm" id="avfy">Send the link again</button></em>'}</div></div>
      ${conflictHtml()}
      <div class="card"><h3>Your save</h3><p>${sum.players ? `${sum.players} player${sum.players === 1 ? '' : 's'} on this phone${sum.names.length ? ': ' + sum.names.map(esc).join(', ') : ''}.` : 'No careers on this phone yet.'}</p>
        <p class="mute">Copied to your account: ${esc(when(a.up || a.synced))}. It is copied again a few seconds after the game saves.</p>
        <button class="ghost" id="async">Copy it now</button><p id="anote" class="anote${lastErr ? '' : ' ok'}">${esc(lastErr)}</p></div>
      <button class="ghost" id="aout">Sign out<small>your careers stay on this phone, and stay in your account</small></button>
      <button class="ghost" id="adel">Delete my account<small>deletes the account and the copy of your save in it; the careers on this phone stay</small></button>
      <div id="adelbox"></div>`);
    if ($('#avfy')) $('#avfy').onclick = async () => { try { await backend().verify(); $('#avfy').outerHTML = 'Sent: check your inbox.'; } catch (e) { note(msg(e)); } };
    $('#async').onclick = async () => { lock(1); note('Copying…', 1); await sync('now'); lock(0); note(lastErr || (conflict ? '' : 'Copied.'), !lastErr); if (conflict) draw(); };
    $('#aout').onclick = async () => { const b = $('#aout'); if (!b.dataset.sure) { b.dataset.sure = 1; b.innerHTML = 'Tap again to sign out<small>anything not yet copied to your account stays on this phone only</small>'; return; }
      clearTimeout(pushT); if (!conflict) { try { await sync('now'); } catch (e) { /* signed out anyway */ } } await backend().signOut(); user = null; setA({ uid: null, email: null, name: null, synced: 0, up: 0 }); mode = 'in'; draw(); };
    $('#adel').onclick = () => {
      $('#adelbox').innerHTML = `<div class="card warnc"><h3>Delete your account?</h3><p>The account, your email address and the copy of your save in it are deleted for good. The careers on this phone stay here.</p>
        <div class="field"><label for="adpw">Type your password to confirm</label><input id="adpw" type="password" autocomplete="current-password"></div><button class="big danger" id="adgo">Delete my account</button><p id="anote2" class="anote"></p></div>`;
      $('#adgo').onclick = async () => { const pw = $('#adpw').value; if (!pw) { $('#anote2').textContent = 'Type your password.'; return; } lock(1);
        try { await backend().del(pw); user = null; save(KEY, {}); mode = 'up'; draw(); note('Your account is deleted.', 1); } catch (e) { lock(0); $('#anote2').textContent = msg(e); } };
      $('#adpw').focus();
    };
    wire(draw);
  }

  /* two phones that both played: what each holds, and a choice */
  function conflictHtml() {
    if (!conflict) return '';
    const sum = PB.saves.summary();
    return `<div class="next aconf"><p class="kick">Two saves</p><p class="q">This phone and your account both have games the other has not seen.</p>
      <div class="aconfg"><div><b>On this phone</b><span>${sum.players} player${sum.players === 1 ? '' : 's'}${sum.names.length ? ': ' + sum.names.map(esc).join(', ') : ''}</span><small>last saved ${esc(when(PB.saves.changed()))}</small></div>
      <div><b>In your account</b><span>${+conflict.players || 0} player${+conflict.players === 1 ? '' : 's'}${Array.isArray(conflict.who) && conflict.who.length ? ': ' + conflict.who.slice(0, 3).map(x => esc(plain(x, 30))).join(', ') : ''}</span><small>saved ${esc(when(conflict.at))}${conflict.dev === dev() ? '' : ', on another phone'}</small></div></div>
      <button class="ghost" id="akeep">Keep this phone's<small>and copy it over the one in your account</small></button><button class="ghost" id="atake">Use the account's<small>and replace what is on this phone</small></button></div>`;
  }
  /* the hub shows a choice that is waiting, or a save from another phone */
  function card() {
    if (conflict) return conflictHtml();
    if (offer && user) return `<div class="next"><p class="kick">Your account</p><p class="q">There is a newer save in your account, from ${esc(when(offer.at))}.</p><button class="ghost" id="atake">Load it onto this phone</button></div>`;
    return '';
  }
  function wire(redraw) {
    if ($('#akeep')) $('#akeep').onclick = async () => { const c = conflict; conflict = null; try { busy = true; await upload(); } catch (e) { conflict = c; lastErr = msg(e); } finally { busy = false; } redraw && redraw(); };
    if ($('#atake')) $('#atake').onclick = async () => { const rec = conflict || offer; if (!rec) return; if (!confirm('Replace the careers on this phone with the save in your account?')) return; if (!(await take(rec)) && redraw) redraw(); };
  }

  /* an account already signed in on this phone: connect quietly at start, and copy up when the app goes to the background */
  if (load('pbb.acct.loaded', 0)) { save('pbb.acct.loaded', 0); setTimeout(() => { const t = document.createElement('div'); t.className = 'acctoast'; t.textContent = 'Your save from your account is on this phone'; document.body.appendChild(t); setTimeout(() => t.remove(), 4200); }, 1800); }
  if (A().uid) setTimeout(() => { start().then(u => { if (u) sync('start'); }).catch(() => {}); }, 2500);
  document.addEventListener('visibilitychange', () => { if (document.hidden && user && !conflict && PB.saves.changed() > (A().synced || 0)) { clearTimeout(pushT); sync('hide'); } });

  PB.account = {
    open, card, wire, saved,
    user: () => user || (A().uid ? { uid: A().uid, email: A().email, name: A().name } : null),
    get conflict() { return conflict; }
  };
  if (PB.DEV) PB.account.test = { backend(b) { be = b; ready = null; user = null; conflict = null; offer = null; }, sync, state: () => ({ user, conflict: !!conflict, offer: !!offer, lastErr, acct: A() }) };
})();
