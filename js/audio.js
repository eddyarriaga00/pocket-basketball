/* PocketBasketball: sound. Exposes PB.audio.
   Half of it is recorded and half made in code (the same approach as PocketFootball, which makes everything in code):
   - recorded, from public-domain (CC0) clips packed into audio/sfx.m4a by tools/sfx.py: sneaker squeaks, the net, the
     ball on the floor and on the board, the referee's whistle;
   - made with the Web Audio API: the crowd (a murmur and a roar built from a few hundred synthesized voices, applause,
     oohs, groans and the "DE-FENSE" chant, rendered once off the main thread into loops), the steel of the rim, the
     horn, the shot-clock buzzer, catches and slaps, the menu clicks and the menu beat.
   Everything runs through buses (sfx, crowd, music, ui, booth) into an arena echo, a glue compressor and a limiter.

   PB.audio.unlock()            on the first tap (browsers start sound only after one)
   PB.audio.play(name, o)       one effect; o.x pans by court position (-25..25), o.vol scales it
   PB.audio.crowd.level(v)      the murmur, 0 (hushed) .. 1 (on its feet)
   PB.audio.crowd.react(kind)   roar, groan, ooh, aww, applause, chant
   PB.audio.music(on)           the menu beat
   PB.audio.muffle(on)          everything dull and far away while paused
   PB.audio.voice(buf, o)       a recorded line through the booth bus (the commentary uses it) */
(() => {
  'use strict';
  const PB = window.PB;
  const AC = window.AudioContext || window.webkitAudioContext;
  const rnd = (a, b) => a + Math.random() * (b - a), pick = a => a[Math.floor(Math.random() * a.length)];
  let ctx = null, bus = null, pack = null, stems = {}, crowdNodes = null, musicOn = false, musicTimer = 0, musicStep = 0, musicT = 0;
  const S = () => PB.settings || { sound: true, music: true };

  /* ---------- building blocks ---------- */
  const noiseCache = new WeakMap();
  function noiseBuf(c, kind) {
    let n = noiseCache.get(c);
    if (!n) {
      const mk = (sec, fill) => { const b = c.createBuffer(1, Math.floor(c.sampleRate * sec), c.sampleRate); fill(b.getChannelData(0)); return b; };
      n = {
        white: mk(2, d => { for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }),
        pink: mk(4, d => { let b0 = 0, b1 = 0, b2 = 0; for (let i = 0; i < d.length; i++) { const w = Math.random() * 2 - 1; b0 = 0.99765 * b0 + w * 0.099046; b1 = 0.963 * b1 + w * 0.2965164; b2 = 0.57 * b2 + w * 1.0526913; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.22; } }),
      };
      noiseCache.set(c, n);
    }
    return n[kind];
  }
  const gain = (c, v) => { const g = c.createGain(); g.gain.value = v; return g; };
  const filt = (c, type, f, q) => { const n = c.createBiquadFilter(); n.type = type; n.frequency.value = f; if (q !== undefined) n.Q.value = q; return n; };
  const pan = (c, v) => { if (!c.createStereoPanner) return gain(c, 1); const p = c.createStereoPanner(); p.pan.value = Math.max(-1, Math.min(1, v || 0)); return p; };
  const chain = (...n) => { for (let i = 0; i < n.length - 1; i++) n[i].connect(n[i + 1]); return n[n.length - 1]; };
  function osc(c, type, f, t, dur) { const o = c.createOscillator(); o.type = type; o.frequency.setValueAtTime(f, t); o.start(t); o.stop(t + dur + 0.05); return o; }
  function noise(c, kind, t, dur, rate) { const s = c.createBufferSource(); s.buffer = noiseBuf(c, kind); s.loop = true; if (rate) s.playbackRate.value = rate; s.start(t, Math.random()); s.stop(t + dur + 0.05); return s; }
  function env(c, t, a, peak, d) { const g = gain(c, 0.0001); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a); g.gain.exponentialRampToValueAtTime(0.0001, t + a + d); return g; }

  /* an arena: hard walls close by, a roof far up; a few early slaps, then a darkening tail */
  function impulse(c, sec) {
    const sr = c.sampleRate, n = Math.floor(sr * sec), b = c.createBuffer(2, n, sr);
    for (let ch = 0; ch < 2; ch++) {
      const d = b.getChannelData(ch); let lp = 0;
      for (let i = 0; i < n; i++) { const t = i / sr; lp += ((Math.random() * 2 - 1) - lp) * (0.2 + 0.7 * Math.exp(-t * 3.5)); d[i] = lp * Math.pow(1 - i / n, 2) * Math.exp(-t * 2.6); }
      for (const [ms, g] of [[14, 0.45], [27, 0.35], [41, 0.3], [66, 0.22], [98, 0.15]]) { const k = Math.floor(sr * (ms + ch * 4) / 1000); if (k < n) d[k] += g * (ch ? -1 : 1); }
    }
    return b;
  }
  function comp(c, th, knee, ratio, att, rel) { const k = c.createDynamicsCompressor(); k.threshold.value = th; k.knee.value = knee; k.ratio.value = ratio; k.attack.value = att; k.release.value = rel; return k; }

  function graph(c) {
    const master = gain(c, 1), tone = filt(c, 'lowpass', 20000, 0.5), out = gain(c, 0.85);
    chain(master, tone, comp(c, -18, 12, 2.2, 0.012, 0.25), comp(c, -5, 0, 20, 0.003, 0.1), out, c.destination);
    const meter = c.createAnalyser(); meter.fftSize = 2048; out.connect(meter);
    const verb = c.createConvolver(); verb.buffer = impulse(c, 1.9);
    chain(verb, gain(c, 0.45), master);
    const mk = (lv, send) => { const g = gain(c, lv); g.connect(master); chain(g, gain(c, send), verb); return g; };
    const booth = gain(c, 1.4), pres = filt(c, 'peaking', 3000, 0.9); pres.gain.value = 2.5;
    chain(booth, filt(c, 'highpass', 85, 0.7), pres, comp(c, -20, 8, 2.5, 0.004, 0.18), master);
    /* the arena's speakers: band-limited, with the far wall coming back */
    const pa = gain(c, 1), band = filt(c, 'bandpass', 1300, 0.5), slap = c.createDelay(0.5), fb = gain(c, 0.25);
    slap.delayTime.value = 0.16; chain(pa, band, master); chain(band, slap, fb, slap); chain(slap, gain(c, 0.4), master); chain(band, gain(c, 0.5), verb);
    return { master, tone, out, verb, meter, sfx: mk(1, 0.22), crowd: mk(1, 0.12), music: mk(0.55, 0.05), ui: mk(0.6, 0.02), pa, booth };
  }

  /* ---------- the recorded effects ---------- */
  async function loadPack() {
    if (pack || !ctx) return;
    try {
      const res = await fetch('audio/sfx.m4a');
      const buf = await ctx.decodeAudioData(await res.arrayBuffer());
      /* AAC can carry a little encoder delay at the front: find where the first clip really starts and shift by it */
      const d = buf.getChannelData(0); let first = 0;
      for (let i = 0; i < Math.min(d.length, buf.sampleRate * 0.2); i++) if (Math.abs(d[i]) > 0.02) { first = i; break; }
      const shift = Math.max(0, first / buf.sampleRate - 0.004);
      pack = { buf, shift };
    } catch (e) { pack = null; }
  }
  function clip(name, dest, t, o) {
    const ix = PB.SFXPACK && PB.SFXPACK[name];
    if (!pack || !ix) return false;
    const s = ctx.createBufferSource(); s.buffer = pack.buf;
    s.playbackRate.value = o.rate || 1;
    const g = gain(ctx, o.vol === undefined ? 1 : o.vol);
    chain(s, g, pan(ctx, o.pan), dest);
    s.start(t, ix[0] + pack.shift, ix[1] + 0.02);
    return true;
  }
  const variants = (base, n) => base + Math.floor(Math.random() * n);

  /* ---------- the made effects ---------- */
  /* The rim: steel ringing at a handful of inharmonic modes, each dying at its own rate, over a thud. Front rim, back
     rim, a soft roll; a dunk hangs on it. */
  function rim(c, out, t, power) {
    const modes = [[512, 0.9, 0.5], [1186, 0.55, 0.35], [2093, 0.4, 0.22], [3347, 0.25, 0.15], [4810, 0.15, 0.09]];
    const det = rnd(0.94, 1.06);
    for (const [f, a, d] of modes) chain(osc(c, 'sine', f * det, t, d * (0.6 + power)), env(c, t, 0.001, a * 0.28 * power, d * (0.6 + power)), out);
    chain(noise(c, 'white', t, 0.03), filt(c, 'bandpass', 2400, 1), env(c, t, 0.001, 0.5 * power, 0.03), out);
    chain(osc(c, 'sine', 140, t, 0.12), env(c, t, 0.002, 0.35 * power, 0.1), out);
  }
  function slap(c, out, t, v, tone) {   // a catch, a pass hitting hands, a strip
    chain(noise(c, 'white', t, 0.06), filt(c, 'bandpass', tone || 1800, 1.4), env(c, t, 0.001, 0.6 * v, 0.05), out);
    chain(osc(c, 'sine', 180, t, 0.08), env(c, t, 0.002, 0.25 * v, 0.06), out);
  }
  function horn(c, out, t, len) {         // the arena horn: a fat, slightly sour chord through a speaker
    for (const f of [233, 277, 349, 466]) {
      const o = osc(c, 'sawtooth', f, t, len), g = gain(c, 0.0001);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09, t + 0.03); g.gain.setValueAtTime(0.09, t + len - 0.12); g.gain.exponentialRampToValueAtTime(0.0001, t + len);
      chain(o, filt(c, 'lowpass', 2600, 0.8), g, out);
    }
  }
  function buzzer(c, out, t) {            // the shot clock: thinner, higher
    const o = osc(c, 'square', 880, t, 0.6), g = gain(c, 0.0001);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.06, t + 0.01); g.gain.setValueAtTime(0.06, t + 0.5); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    chain(o, filt(c, 'bandpass', 1500, 0.7), g, out);
  }
  function click(c, out, t, hi) {
    chain(osc(c, 'triangle', hi ? 1800 : 1200, t, 0.05), env(c, t, 0.001, 0.25, 0.04), out);
    chain(noise(c, 'white', t, 0.01), filt(c, 'highpass', 5000), env(c, t, 0.001, 0.12, 0.01), out);
  }

  /* ---------- the crowd ---------- */
  /* One voice in the stands: a buzzy throat through three vowel formants, a pitch that moves, a swell and a fall. */
  const VOW = { a: [730, 1090, 2440], e: [530, 1840, 2480], i: [280, 2250, 2900], o: [570, 840, 2410], u: [320, 870, 2240], uh: [640, 1190, 2390], ae: [660, 1720, 2410] };
  function voice(c, out, t, dur, f0, f1, vow, amp, where, scale) {
    const o = c.createOscillator(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(f0, t); o.frequency.linearRampToValueAtTime(f1, t + dur);
    const g = gain(c, 0); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(amp, t + Math.min(0.06, dur * 0.3)); g.gain.setValueAtTime(amp, t + dur * 0.6); g.gain.linearRampToValueAtTime(0, t + dur);
    const mix = gain(c, 1);
    VOW[vow].forEach((f, k) => chain(o, filt(c, 'bandpass', f * scale, [7, 10, 11][k]), gain(c, [1, 0.8, 0.5][k]), mix));
    chain(mix, g, filt(c, 'highpass', 180), pan(c, where), out);
    o.start(t); o.stop(t + dur + 0.02);
  }
  async function render(sec, fill) {
    const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!OAC) return null;
    const c = new OAC(2, Math.floor(44100 * sec), 44100);
    const out = gain(c, 1); out.connect(c.destination);
    fill(c, out, sec);
    return c.startRendering ? await c.startRendering() : null;
  }
  const vowels = ['a', 'e', 'i', 'o', 'u', 'uh', 'ae'];
  function babble(c, out, sec, perSec, amp, hi) {
    for (let t = 0; t < sec - 0.3; t += rnd(0.3, 1.7) / perSec) {
      const woman = Math.random() < 0.4, f = (woman ? rnd(180, 260) : rnd(95, 150)) * (hi ? 1.35 : 1);
      const d = rnd(0.12, 0.35) * (hi ? 1.8 : 1);
      voice(c, out, t, d, f, f * rnd(0.85, 1.2), pick(vowels), amp * rnd(0.4, 1), rnd(-1, 1), woman ? 1.15 : 1);
    }
  }
  function claps(c, out, sec, perSec, amp) {
    for (let t = 0.02; t < sec - 0.1; t += rnd(0.3, 1.7) / perSec)
      chain(noise(c, 'white', t, 0.03), filt(c, 'bandpass', rnd(900, 2600), rnd(1, 2.5)), env(c, t, 0.001, amp * rnd(0.3, 1), rnd(0.02, 0.05)), pan(c, rnd(-1, 1)), out);
  }
  async function buildCrowd() {
    if (stems.murmur) return;
    /* loops: an 8-second murmur and roar, with the seam crossfaded by rendering twice the length and folding */
    const loop = async (sec, fill) => {
      const b = await render(sec + 1, fill);
      if (!b) return null;
      const n = Math.floor(44100 * sec), x = Math.floor(44100 * 1), out = ctx.createBuffer(2, n, 44100);
      for (let ch = 0; ch < 2; ch++) {
        const s = b.getChannelData(ch), d = out.getChannelData(ch);
        for (let i = 0; i < n; i++) d[i] = s[i];
        for (let i = 0; i < x; i++) { const k = i / x; d[i] = s[i] * k + s[n + i] * (1 - k); }
      }
      return out;
    };
    stems.murmur = await loop(8, (c, o, s) => { babble(c, o, s, 40, 0.06); chain(noise(c, 'pink', 0, s), filt(c, 'lowpass', 900), gain(c, 0.05), o); });
    startCrowd();
    stems.roar = await loop(6, (c, o, s) => { babble(c, o, s, 60, 0.08, true); claps(c, o, s, 50, 0.13); chain(noise(c, 'pink', 0, s), filt(c, 'bandpass', 1200, 0.5), gain(c, 0.12), o); });
    stems.ooh = await render(1.6, (c, o) => { for (let i = 0; i < 70; i++) { const t = rnd(0, 0.15), f = rnd(110, 240); voice(c, o, t, rnd(0.9, 1.3), f, f * 1.25, 'u', 0.045, rnd(-1, 1), 1); } });
    stems.aww = await render(1.7, (c, o) => { for (let i = 0; i < 70; i++) { const t = rnd(0, 0.15), f = rnd(130, 260); voice(c, o, t, rnd(1.0, 1.4), f, f * 0.72, 'a', 0.045, rnd(-1, 1), 1); } });
    stems.groan = await render(1.5, (c, o) => { for (let i = 0; i < 60; i++) { const t = rnd(0, 0.2), f = rnd(90, 160); voice(c, o, t, rnd(0.8, 1.2), f * 1.1, f * 0.8, 'uh', 0.04, rnd(-1, 1), 1); } });
    stems.applause = await render(3, (c, o) => claps(c, o, 3, 140, 0.2));
    /* "M-V-P! M-V-P!": three hits, a breath, three again */
    stems.mvp = await render(4.6, (c, o) => {
      for (let r = 0; r < 3; r++) {
        const t0 = r * 1.5;
        for (let i = 0; i < 45; i++) {
          const f = rnd(110, 220), w = rnd(-1, 1);
          voice(c, o, t0 + rnd(0, 0.04), 0.2, f * 1.1, f, 'e', 0.05, w, 1);
          voice(c, o, t0 + 0.3 + rnd(0, 0.04), 0.2, f * 1.15, f * 1.05, 'i', 0.05, w, 1);
          voice(c, o, t0 + 0.6 + rnd(0, 0.04), 0.3, f * 1.2, f * 1.1, 'i', 0.055, w, 1);
        }
      }
    });
    stems.chant = await render(4.4, (c, o) => {
      /* DE-FENSE, stomp stomp, four times */
      for (let r = 0; r < 4; r++) {
        const t0 = r * 1.1;
        for (let i = 0; i < 40; i++) {
          const f = rnd(110, 200), w = rnd(-1, 1);
          voice(c, o, t0 + rnd(0, 0.04), 0.22, f * 1.15, f * 1.1, 'i', 0.05, w, 1);
          voice(c, o, t0 + 0.3 + rnd(0, 0.04), 0.3, f, f * 0.95, 'e', 0.05, w, 1);
        }
        for (const s of [0.66, 0.88]) chain(noise(c, 'pink', t0 + s, 0.12), filt(c, 'lowpass', 300), env(c, t0 + s, 0.003, 0.9, 0.1), o);
      }
    });
    startCrowd();
  }
  function startCrowd() {
    if (!stems.murmur) return;
    const mk = (buf, v) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; const g = gain(ctx, v); chain(s, g, bus.crowd); s.start(); return { s, g }; };
    if (!crowdNodes) crowdNodes = { murmur: mk(stems.murmur, 0), roar: { g: gain(ctx, 0) } };
    if (stems.roar && !crowdNodes.roar.s) crowdNodes.roar = mk(stems.roar, 0);
    applyCrowd();
  }
  let crowdLevel = 0, crowdOn = false;
  function applyCrowd() {
    if (!crowdNodes) return;
    const t = ctx.currentTime, on = crowdOn && S().sound !== false;
    crowdNodes.murmur.g.gain.setTargetAtTime(on ? 0.7 + crowdLevel * 1.1 : 0, t, 0.6);
    crowdNodes.roar.g.gain.setTargetAtTime(on ? Math.max(0, crowdLevel - 0.55) * 1.4 : 0, t, 0.6);
  }
  function swell(peak, hold) {        // a roar that rises, holds and dies away
    if (!crowdNodes) return;
    const g = crowdNodes.roar.g.gain, t = ctx.currentTime;
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(peak, t + 0.18); g.setValueAtTime(peak, t + hold);
    g.setTargetAtTime(Math.max(0, crowdLevel - 0.55) * 1.4, t + hold, 0.7);
  }

  /* ---------- the arena organ ----------
     A drawbar organ: a stack of sine partials (the 16', 8', 4' and 2 2/3' drawbars) through a little rotary wobble,
     playing the riffs every arena plays: the charge, and the "da-da, da-da-da" the crowd claps along to. */
  function organNote(c, out, t, midi, dur, v) {
    const f = 440 * Math.pow(2, (midi - 69) / 12), g = gain(c, 0.0001);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.034 * v, t + 0.012); g.gain.setValueAtTime(0.034 * v, t + dur * 0.85); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const trem = c.createOscillator(); trem.frequency.value = 6.5; const td = gain(c, 0.25); trem.connect(td); td.connect(g.gain); trem.start(t); trem.stop(t + dur + 0.05);
    for (const [m, a] of [[0.5, 0.7], [1, 1], [2, 0.6], [3, 0.35], [4, 0.2]]) chain(osc(c, 'sine', f * m, t, dur), gain(c, a), g);
    chain(g, filt(c, 'lowpass', 3800, 0.6), out);
  }
  const RIFFS = {
    charge: [[67, 0, 0.16], [72, 0.18, 0.16], [76, 0.36, 0.16], [79, 0.54, 0.34], [76, 0.92, 0.16], [79, 1.1, 0.7]],
    letsgo: [[72, 0, 0.18], [72, 0.24, 0.18], [72, 0.6, 0.14], [72, 0.78, 0.14], [74, 0.96, 0.3], [72, 1.6, 0.18], [72, 1.84, 0.18], [72, 2.2, 0.14], [72, 2.38, 0.14], [74, 2.56, 0.3]],
    walk: [[60, 0, 0.2], [64, 0.25, 0.2], [67, 0.5, 0.2], [69, 0.75, 0.2], [70, 1.0, 0.2], [69, 1.25, 0.2], [67, 1.5, 0.2], [64, 1.75, 0.3]],
  };
  function organ(kind) {
    const r = RIFFS[kind]; if (!r || !ctx || S().sound === false) return;
    const t0 = ctx.currentTime + 0.05;
    for (const [m, at, d] of r) { organNote(ctx, bus.pa, t0 + at, m, d, 1); organNote(ctx, bus.pa, t0 + at, m - 12, d, 0.5); }
    if (kind === 'letsgo') for (const at of [1.25, 2.85]) for (const k of [0, 0.25]) setTimeout(() => A.crowd.react('applause', 0.5), (at + k) * 1000);
  }

  /* ---------- music: a short loop for the menus ---------- */
  /* Kick, snare, hats, a bass line and chord stabs in A minor, 92 bpm, scheduled a little ahead. */
  const BAR = [
    [45, [57, 60, 64]], [45, [57, 60, 64]], [41, [53, 57, 60]], [43, [55, 59, 62]],
  ];
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  function musicTick() {
    if (!musicOn || !ctx) return;
    const spb = 60 / 92 / 4;   // sixteenth
    while (musicT < ctx.currentTime + 0.25) {
      const t = musicT, i = musicStep % 64, bar = BAR[Math.floor(i / 16) % 4], st = i % 16, out = bus.music;
      if (st === 0 || st === 7 || st === 10) { const o = osc(ctx, 'sine', 120, t, 0.25); o.frequency.exponentialRampToValueAtTime(45, t + 0.12); chain(o, env(ctx, t, 0.002, 0.9, 0.22), out); }
      if (st === 4 || st === 12) { chain(noise(ctx, 'white', t, 0.18), filt(ctx, 'bandpass', 1900, 0.8), env(ctx, t, 0.001, 0.5, 0.16), out); chain(osc(ctx, 'triangle', 190, t, 0.1), env(ctx, t, 0.001, 0.3, 0.08), out); }
      if (st % 2 === 0) chain(noise(ctx, 'white', t, 0.04), filt(ctx, 'highpass', 8000), env(ctx, t, 0.001, st % 4 === 2 ? 0.14 : 0.07, 0.03), out);
      if ([0, 3, 6, 8, 11, 14].includes(st)) chain(osc(ctx, 'sawtooth', mtof(bar[0] - 12 + (st === 14 ? 7 : 0)), t, 0.2), filt(ctx, 'lowpass', 500, 4), env(ctx, t, 0.005, 0.22, 0.18), out);
      if (st === 2 || st === 10) for (const n of bar[1]) chain(osc(ctx, 'square', mtof(n), t, 0.2), filt(ctx, 'lowpass', 1800), env(ctx, t, 0.004, 0.035, 0.18), out);
      musicT += spb; musicStep++;
    }
    musicTimer = setTimeout(musicTick, 60);
  }

  /* ---------- the public side ---------- */
  const A = PB.audio = {
    ready: () => !!ctx,
    unlock() {
      if (!AC) return;
      /* iPhones mute web audio with the ring/silent switch unless the page says it plays media */
      try { if (navigator.audioSession && navigator.audioSession.type !== 'playback') navigator.audioSession.type = 'playback'; } catch (e) { /* older Safari */ }
      if (!navigator.audioSession && !A._silent && /iPhone|iPad|iPod/.test(navigator.userAgent)) {
        /* older iOS: a silent media element playing in a loop puts the page in the media category */
        try { const el = document.createElement('audio'); el.setAttribute('playsinline', ''); el.loop = true;
          el.src = 'data:audio/mp4;base64,AAAAHGZ0eXBNNEEgAAACAE00QSBpc29taXNvMgAAAAhmcmVlAAAAGm1kYXQBQAAAAAAAAAAAAAAAAAAAAAAAAAAA';
          el.volume = 0.01; el.play().catch(() => {}); A._silent = el; } catch (e) { /* fine */ }
      }
      if (!ctx) {
        try { ctx = new AC({ latencyHint: 'interactive' }); } catch (e) { ctx = new AC(); }
        bus = graph(ctx);
        loadPack();
        buildCrowd().catch(() => {});
      }
      if (ctx.state === 'suspended') ctx.resume();
      if (musicOn && !musicTimer) { musicT = ctx.currentTime + 0.05; musicTick(); }
    },
    play(name, o) {
      if (!ctx || S().sound === false) return;
      o = o || {};
      const t = ctx.currentTime + (o.delay || 0), p = o.x !== undefined ? Math.max(-0.8, Math.min(0.8, -o.x / 28)) : 0, v = o.vol === undefined ? 1 : o.vol;
      const out = gain(ctx, v); chain(out, pan(ctx, p), bus.sfx);
      switch (name) {
        case 'bounce': clip(variants('bounce', 8), out, t, { vol: 0.3, rate: rnd(0.95, 1.06) }); break;
        case 'squeak': clip(variants('squeak', 8), out, t, { vol: 0.32, rate: rnd(0.92, 1.1) }); break;
        case 'swish': clip(variants('swish', 8), out, t, { vol: 0.85 }); break;
        case 'board': clip(variants('board', 8), out, t, { vol: 0.8, rate: rnd(0.95, 1.05) }); break;
        case 'rim': rim(ctx, out, t, o.power || 0.7); clip(variants('board', 8), out, t, { vol: 0.25, rate: 1.4 }); break;
        case 'rimin': rim(ctx, out, t, 0.35); clip(variants('swish', 8), out, t + 0.06, { vol: 0.6 }); break;
        case 'dunk': rim(ctx, out, t, 1.1); clip(variants('swish', 8), out, t + 0.02, { vol: 0.9 }); clip(variants('board', 8), out, t, { vol: 0.5 }); break;
        case 'block': slap(ctx, out, t, 1.2, 900); clip(variants('board', 8), out, t, { vol: 0.35, rate: 0.8 }); break;
        case 'catch': slap(ctx, out, t, 0.55); break;
        case 'steal': slap(ctx, out, t, 0.9, 1300); break;
        case 'whistle': if (!clip('whistle0', bus.pa, t, { vol: 0.4 * v })) chain(osc(ctx, 'sine', 2900, t, 0.5), env(ctx, t, 0.01, 0.1, 0.45), bus.pa); break;
        case 'horn': horn(ctx, bus.pa, t, o.len || 1.3); break;
        case 'buzzer': buzzer(ctx, bus.pa, t); break;
        case 'click': click(ctx, bus.ui, t, o.hi); break;
      }
    },
    crowd: {
      on(v) { crowdOn = v; if (ctx) applyCrowd(); },
      level(v) { const n = Math.max(0, Math.min(1, v)); if (Math.abs(n - crowdLevel) > 0.02) { crowdLevel = n; if (ctx) applyCrowd(); } },
      react(kind, power) {
        if (!ctx || S().sound === false || !crowdOn) return;
        const k = power === undefined ? 1 : power;
        if (kind === 'roar') { swell((0.55 + 0.45 * k) * 1.7, 0.8 + k); return; }
        const buf = stems[kind]; if (!buf) return;
        const s = ctx.createBufferSource(); s.buffer = buf; s.playbackRate.value = rnd(0.95, 1.05);
        chain(s, gain(ctx, (kind === 'applause' ? 1.2 : kind === 'chant' || kind === 'mvp' ? 1.4 : 1.3) * k), bus.crowd); s.start();
      },
    },
    organ,
    music(on) {
      musicOn = on && S().music !== false;
      if (!ctx) return;
      clearTimeout(musicTimer); musicTimer = 0;
      const g = bus.music.gain, t = ctx.currentTime;
      g.cancelScheduledValues(t); g.setTargetAtTime(musicOn ? 0.55 : 0, t, 0.3);
      if (musicOn) { musicT = Math.max(musicT, t + 0.05); musicTick(); }
    },
    muffle(on) { if (!bus) return; bus.tone.frequency.setTargetAtTime(on ? 700 : 20000, ctx.currentTime, 0.12); },
    /* a decoded line through the booth (commentary), the crowd ducked a little under it */
    voice(buf, o) {
      if (!ctx || !buf) return null;
      /* a voice on the floor: into the arena with the other sounds, panned to where he is, a little pitch for who */
      if (o && o.court) { const s = ctx.createBufferSource(); s.buffer = buf; s.playbackRate.value = o.rate || 1; chain(s, gain(ctx, o.vol || 0.5), pan(ctx, o.x !== undefined ? Math.max(-0.8, Math.min(0.8, -o.x / 28)) : 0), bus.sfx); s.start(); return s; }
      const s = ctx.createBufferSource(); s.buffer = buf; chain(s, gain(ctx, (o && o.vol) || 1), o && o.pa ? bus.pa : bus.booth); s.start();
      if (o && o.pa) return s;   // the arena speakers: no ducking, the crowd is part of it
      if (crowdNodes) { const g = bus.crowd.gain, t = ctx.currentTime; g.setTargetAtTime(0.65, t, 0.08); g.setTargetAtTime(1, t + buf.duration, 0.4); }
      return s;
    },
    ctx: () => ctx,
    /* test hooks: the output level now (dB, RMS and peak over the last 46 ms), and whether the pack and crowd loaded */
    meter() { if (!bus) return null; const d = new Float32Array(bus.meter.fftSize); bus.meter.getFloatTimeDomainData(d); let s = 0, pk = 0; for (const v of d) { s += v * v; pk = Math.max(pk, Math.abs(v)); } return { rms: 10 * Math.log10(s / d.length + 1e-12), peak: 20 * Math.log10(pk + 1e-12) }; },
    out: () => bus && bus.out,
    /* everything you hear, as a stream a recorder can take (the highlight videos) */
    stream() { if (!ctx || !bus || !ctx.createMediaStreamDestination) return null; if (!bus.rec) { bus.rec = ctx.createMediaStreamDestination(); bus.out.connect(bus.rec); } return bus.rec.stream; },
    status: () => ({ pack: !!pack, shift: pack && pack.shift, stems: Object.keys(stems).filter(k => stems[k]), crowd: !!crowdNodes }),
  };

  /* the first touch anywhere starts sound; every button clicks */
  const first = () => A.unlock();
  window.addEventListener('pointerdown', first, true);
  window.addEventListener('keydown', first, true);
  document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('#screen button, #pause button'); if (b) A.play('click', { hi: b.classList.contains('big') }); }, true);
})();
