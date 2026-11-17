/* PocketBasketball: the broadcast booth. Exposes PB.booth.
   Two voices recorded on a Mac by tools/voice.py (Chatterbox, cloned from original synthetic voices) and packed into
   audio/vo.pack; js/vo.js says where each clip sits. The booth loads the pack the first time a game starts, decodes a
   clip only when it is needed, and keeps a few ready.

   PB.booth.say(key, o)   a call ('three', 'dunk', 'block', ...). o.prio: higher cuts in on a lower one already
                          playing; equal or lower is dropped (a call must land on its play, never a second late).
                          o.follow: chance the analyst adds a line from key + '_ana' after it.
   Lines are never repeated until the others for that call have been heard. */
(() => {
  'use strict';
  const PB = window.PB;
  let pack = null, loading = null;
  const decoded = new Map(), recent = {};
  let cur = null, curPrio = 0, busyUntil = 0, followT = 0;
  const on = () => !(PB.settings && PB.settings.commentary === false) && PB.audio && PB.audio.ready();

  function load() {
    if (pack || loading || !PB.VO || !Object.keys(PB.VO).length) return loading;
    loading = fetch('audio/vo.pack').then(r => r.ok ? r.arrayBuffer() : null).then(b => { pack = b; }).catch(() => { pack = null; });
    return loading;
  }
  function decode(clip) {
    const k = clip[0];
    if (decoded.has(k)) return decoded.get(k);
    const ctx = PB.audio.ctx();
    if (!pack || !ctx) return Promise.resolve(null);
    const p = ctx.decodeAudioData(pack.slice(clip[0], clip[0] + clip[1])).catch(() => null);
    decoded.set(k, p);
    return p;
  }
  /* pick a line for a call: one not heard lately */
  function pick(key) {
    const list = PB.VO && PB.VO[key];
    if (!list || !list.length) return null;
    const seen = recent[key] || (recent[key] = []);
    let opts = list.filter(c => !seen.includes(c[0]));
    if (!opts.length) { seen.length = 0; opts = list.slice(); }
    const c = opts[Math.floor(Math.random() * opts.length)];
    seen.push(c[0]);
    return c;
  }
  async function play(key, prio) {
    const c = pick(key);
    if (!c) return false;
    const buf = await decode(c);
    if (!buf || !on()) return false;
    const now = performance.now();
    if (now < busyUntil && prio <= curPrio) return false;
    if (cur) { try { cur.stop(); } catch (e) { /* already done */ } }
    cur = PB.audio.voice(buf);
    curPrio = prio;
    busyUntil = now + buf.duration * 1000 + 250;
    return buf.duration;
  }
  PB.booth = {
    load,
    busy: () => performance.now() < busyUntil,
    async say(key, o) {
      o = o || {};
      if (!on()) return;
      if (!pack) { load(); return; }
      const prio = o.prio || 1;
      if (performance.now() < busyUntil && prio <= curPrio) return;
      const d = await play(key, prio);
      if (d && o.follow && Math.random() < o.follow && PB.VO[key + '_ana']) {
        const t = ++followT;
        setTimeout(() => { if (t === followT && !PB.booth.busy()) play(key + '_ana', 0.5); }, d * 1000 + 450);
      }
    },
    /* warm the clips a game is sure to want, so the first calls are not late */
    warm() {
      if (!pack || !PB.VO) return;
      for (const k of ['intro', 'tip', 'three', 'dunk', 'layup', 'jumper', 'block', 'steal']) for (const c of (PB.VO[k] || []).slice(0, 3)) decode(c);
    },
    /* the arena announcer: his own channel through the arena speakers, never more than one line at a time */
    async pa(key) {
      if (!on() || !pack) return;
      if (performance.now() < (PB.booth._paUntil || 0)) return;
      const c = pick(key); if (!c) return;
      const buf = await decode(c); if (!buf) return;
      PB.booth._paUntil = performance.now() + buf.duration * 1000 + 300;
      PB.audio.voice(buf, { pa: true, vol: 0.85 });
    },
    stop() { followT++; if (cur) { try { cur.stop(); } catch (e) { /* done */ } } busyUntil = 0; },
  };
})();
