/* PocketBasketball: the 3D arena (three.js). Exposes PB.R.
   World units are feet. x runs across the court (-25..25), z along it (-47..47), y is up.
   Rim centers sit at z = ±41.75, ten feet up. The camera looks toward +z so the team attacking +z goes up the screen. */
(() => {
  'use strict';
  const PB = window.PB;
  const T = window.THREE;
  const R = PB.R = {};
  let renderer, scene, cam, W = 1, H = 1, DPR = 1;
  const camPos = new T.Vector3(0, 60, -50), camLook = new T.Vector3(0, 0, 0);
  let zoom = 1, camMode = 'lock', lockDir = 1, yaw = 0;
  const anchor = new T.Vector3();
  const meshes = new Map();
  let board = null, ribbons = [];
  let passArrow = null, manRing = null, defArrow = null, guideArrow = null, flash = null, flashT = 0, passTarget = null, manTarget = null;
  R.marks = (pass, man) => { passTarget = pass; manTarget = man; };
  /* a tag floating over a player (your rival) */
  let tag = null, tagP = null;
  R.tag = (p, text, color) => {
    if (tag) { scene.remove(tag); tag = null; } tagP = p; if (!p) return;
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64; const g = cv.getContext('2d');
    g.fillStyle = color || '#ff4d5e'; g.beginPath(); g.roundRect ? g.roundRect(28, 8, 200, 48, 14) : g.rect(28, 8, 200, 48); g.fill();
    g.fillStyle = '#fff'; g.font = '900 30px Archivo, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 128, 34);
    const t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace;
    tag = new T.Sprite(new T.SpriteMaterial({ map: t, depthTest: false, transparent: true })); tag.scale.set(5.6, 1.4, 1); tag.renderOrder = 6; scene.add(tag);
  };
  /* name tags: over you, and over whoever has the ball. Black and white, small, the name and the number */
  const tags = { me: null, ball: null };
  function nameSprite(text, num, mine) {
    const cv = document.createElement('canvas'); cv.width = 320; cv.height = 72; const g = cv.getContext('2d');
    g.font = '900 30px Archivo, Arial'; const w = Math.min(300, g.measureText(text).width + 70);
    g.fillStyle = mine ? '#ffffff' : 'rgba(10,10,12,.82)'; g.beginPath(); g.roundRect ? g.roundRect(160 - w / 2, 10, w, 50, 25) : g.rect(160 - w / 2, 10, w, 50); g.fill();
    g.fillStyle = mine ? '#000' : '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '800 22px Archivo, Arial'; g.globalAlpha = 0.55; g.fillText(String(num), 160 - w / 2 + 26, 36); g.globalAlpha = 1;
    g.font = '900 28px Archivo, Arial'; g.fillText(text, 160 + 12, 36);
    const t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace;
    const sp = new T.Sprite(new T.SpriteMaterial({ map: t, depthTest: false, transparent: true })); sp.scale.set(5.4, 1.21, 1); sp.renderOrder = 6; return sp;
  }
  /* a speech bubble over a park regular's head: what he says, for a few seconds */
  const says = new Map(), parkBalls = [];
  function bubbleSprite(text) {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 120; const g = cv.getContext('2d');
    let fs = 40; g.font = `800 ${fs}px Archivo, Arial`; while (g.measureText(text).width > 440 && fs > 22) { fs -= 2; g.font = `800 ${fs}px Archivo, Arial`; }
    const w = Math.min(500, g.measureText(text).width + 56);
    g.fillStyle = '#ffffff'; g.beginPath(); g.roundRect ? g.roundRect(256 - w / 2, 8, w, 84, 30) : g.rect(256 - w / 2, 8, w, 84); g.fill();
    g.beginPath(); g.moveTo(240, 90); g.lineTo(256, 114); g.lineTo(272, 90); g.fill();
    g.fillStyle = '#0b0b0d'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 256, 51);
    const t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace;
    const sp = new T.Sprite(new T.SpriteMaterial({ map: t, depthTest: false, transparent: true })); sp.scale.set(7.2, 1.69, 1); sp.renderOrder = 7; return sp;
  }
  const unsay = p => { const o = says.get(p); if (!o) return; scene.remove(o.sp); o.sp.material.map.dispose(); o.sp.material.dispose(); says.delete(p); };
  R.say = (p, text, secs) => { unsay(p); const sp = bubbleSprite(text); scene.add(sp); says.set(p, { sp, until: performance.now() + (secs || 2.6) * 1000 }); };
  function placeTag(k, p, mine) {
    const want = p ? `${p.name}|${p.num}` : '';
    if (tags[k] && tags[k].key !== want) { scene.remove(tags[k].sp); tags[k].sp.material.map.dispose(); tags[k].sp.material.dispose(); tags[k] = null; }
    if (!p) return;
    if (!tags[k]) { tags[k] = { key: want, sp: nameSprite(String(p.name).toUpperCase(), p.num, mine) }; scene.add(tags[k].sp); }
    /* under his feet, a step toward the camera: it reads below the ring and never sits on the man behind him */
    const dx = cam.position.x - p.x, dz = cam.position.z - p.z, L = Math.hypot(dx, dz) || 1;
    tags[k].sp.position.set(p.x + dx / L * 2.6, 0.2, p.z + dz / L * 2.6);
  }
  R.nameTags = G => {
    const mode = (PB.settings && PB.settings.tags) || 'You and the ball';
    const u = G && !G.drill && !G.replay && mode !== 'Off' ? G.user : null, h = G && G.ball && G.ball.holder;
    placeTag('me', u, true);
    placeTag('ball', mode === 'You and the ball' && h && h !== u && !G.replay ? h : null, false);
    /* the park: everyone's handle over his head, the way a park shows who is out there (the near ones only) */
    if (G && G.park) { const me = G.user; placeTag('pme', me, true); G.pl.forEach((p, i) => { if (p.npc) placeTag('npc' + i, me && Math.hypot(p.x - me.x, p.z - me.z) < 30 ? p : null, false); }); }
    const now = performance.now();
    for (const [p, o] of says) { if (now > o.until || !G || !G.park || !G.pl.includes(p)) { unsay(p); continue; } o.sp.position.set(p.x, 9.4 + (p.y || 0), p.z); }
  };
  R._marks = () => ({ def: defArrow && defArrow.visible ? defArrow.material.color.getHexString() : null, pass: passTarget && passTarget.num, man: manTarget && manTarget.num, arrow: passArrow && passArrow.visible && R.toScreen(passArrow.position.x, passArrow.position.y, passArrow.position.z) });
  R.flash = color => { if (!flash) return; flash.material.color.set(color); flashT = 0.6; };
  /* ball racks for the shooting drills: a stand at each spot, a row of balls that empties as you shoot; the last
     ball of a rack (the money ball, when there is one) in white and black */
  let racks = [];
  R.setRacks = (spots, n, money) => {
    for (const r of racks) scene.remove(r.g); racks = [];
    if (!spots || !scene || !ballMesh) return;
    const stand = new T.MeshLambertMaterial({ color: 0x1b1d22 }), mon = new T.MeshLambertMaterial({ color: 0xf2f2f2 });
    for (const sp of spots) {
      const g = new T.Group(), out = Math.atan2(sp.x, sp.z - sp.hz);   // away from the rim
      g.position.set(sp.x + Math.sin(out) * 0.8 + Math.cos(out) * 3.4, 0, sp.z + Math.cos(out) * 0.8 - Math.sin(out) * 3.4); g.rotation.y = out;
      const top = new T.Mesh(new T.BoxGeometry(3.2, 0.12, 0.8), stand); top.position.y = 2.2; g.add(top);
      for (const sx of [-1.4, 1.4]) { const leg = new T.Mesh(new T.BoxGeometry(0.12, 2.2, 0.7), stand); leg.position.set(sx, 1.1, 0); g.add(leg); }
      const balls = [];
      for (let i = 0; i < n; i++) { const b = new T.Mesh(ballMesh.geometry, money && i === n - 1 ? mon : ballMesh.material); b.position.set(-1.25 + i * (2.5 / Math.max(1, n - 1)), 2.65, 0); g.add(b); balls.push(b); }
      scene.add(g); racks.push({ g, balls });
    }
  };
  R.rackLeft = (rack, used) => racks.forEach((r, i) => r.balls.forEach((b, j) => { b.visible = i > rack || (i === rack && j >= used); }));
  /* a shockwave: a white ring racing out across the floor (a slam, an ankle-breaker); a few at a time */
  const shocks = [];
  R.shock = (x, z, size) => {
    if (!scene) return;
    let r = shocks.find(o => o.t <= 0);
    if (!r) { if (shocks.length > 3) return; const m = new T.Mesh(new T.RingGeometry(0.86, 1, 48), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, side: T.DoubleSide }));
      m.rotation.x = -Math.PI / 2; r = { m, t: 0 }; shocks.push(r); }
    if (r.m.parent !== scene) scene.add(r.m);
    r.m.position.set(x, 0.06, z); r.t = 0.55; r.size = size || 9; r.m.visible = true;
  };
  /* a puff at the feet: dust off the asphalt, a scuff of light off the hardwood (a hard cut, a landing) */
  const puffs = []; let puffTex = null;
  R.puff = (x, z, k) => {
    if (!scene) return;
    if (!puffTex) { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 2, 32, 32, 32);
      gr.addColorStop(0, 'rgba(255,255,255,.9)'); gr.addColorStop(0.5, 'rgba(255,255,255,.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); puffTex = new T.CanvasTexture(c); puffTex.userData.keep = true; }
    let r = puffs.find(o => o.t <= 0);
    if (!r) { if (puffs.length > 9) return; const mt = new T.SpriteMaterial({ map: puffTex, transparent: true, depthWrite: false, opacity: 0 }); mt.userData.shared = true; r = { m: new T.Sprite(mt), t: 0 }; puffs.push(r); }
    if (r.m.parent !== scene) scene.add(r.m);
    r.m.material.color.setHex(scene.background ? 0xb9b2a6 : 0xfff3df); r.m.position.set(x + (Math.random() - 0.5) * 0.5, 0.35, z + (Math.random() - 0.5) * 0.5); r.t = r.T = 0.45; r.k = k || 1; r.m.visible = true;
  };
  function puffTick(dt) { for (const r of puffs) { if (r.t <= 0) { r.m.visible = false; continue; } r.t -= dt; const k = 1 - r.t / r.T; r.m.scale.setScalar((0.8 + k * 2.2) * r.k); r.m.position.y = 0.35 + k * 0.5; r.m.material.opacity = Math.min(0.7, 0.55 * (1 - k) * r.k); } }
  function shockTick(dt) { for (const r of shocks) { if (r.t <= 0) { r.m.visible = false; continue; } r.t -= dt; const k = 1 - r.t / 0.55; r.m.scale.setScalar(1 + k * r.size); r.m.material.opacity = 0.8 * (1 - k) * (1 - k); } }
  let crowdMaps = [], hype = 0, shake = 0, trail = null, trailPts = [];
  /* the building jumps: the crowd bounces for a moment, the camera shakes on the biggest plays */
  let boardMsg = null;
  R.board = (text, secs) => { boardMsg = { text, t: secs || 3 }; };   // the scoreboard shows a message for a few seconds
  R.hype = (power, shk) => { hype = Math.max(hype, 1.6 * (power || 1)); if (shk) shake = Math.max(shake, shk); if ((power || 1) >= 0.9) camFlash = Math.max(camFlash, 0.9 * (power || 1)); };
  /* small things an arena does: the backboards light red at a horn; cameras flash in the stands after a big play */
  const leds = []; let hornT = 0, camFlash = 0, flashPts = null;
  R.horn = sec => { hornT = Math.max(hornT, sec || 1.5); };
  /* a title won: paper in the winners' colors comes down over the floor */
  let confPts = null, confV = null;
  R.confetti = (c1, c2) => { if (confPts || !T.Points) return; const N = 420, pos = new Float32Array(N * 3), col = new Float32Array(N * 3), cs = [new T.Color(c1 || '#ffffff'), new T.Color(c2 || '#ffffff'), new T.Color('#ffffff')]; confV = new Float32Array(N * 2);
    for (let i = 0; i < N; i++) { pos[i * 3] = (Math.random() * 2 - 1) * 30; pos[i * 3 + 1] = 14 + Math.random() * 40; pos[i * 3 + 2] = (Math.random() * 2 - 1) * 50; confV[i * 2] = 5 + Math.random() * 5; confV[i * 2 + 1] = Math.random() * 6.28; const c = cs[i % 3]; col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('color', new T.BufferAttribute(col, 3));
    confPts = new T.Points(g, new T.PointsMaterial({ size: 0.55, vertexColors: true, transparent: true, opacity: 0.95, depthWrite: false })); confPts.frustumCulled = false; scene.add(confPts); };
  function arenaBits(dt) {
    if (confPts) { const a = confPts.geometry.attributes.position; for (let i = 0; i < a.count; i++) { let y = a.getY(i) - confV[i * 2] * dt; if (y < 0.1) y = 0.1; else { const ph = confV[i * 2 + 1] += dt * 3; a.setX(i, a.getX(i) + Math.sin(ph) * dt * 2.2); } a.setY(i, y); } a.needsUpdate = true; }
    if (hornT > 0 || (leds[0] && leds[0].material.opacity > 0)) { hornT = Math.max(0, hornT - dt); for (const l of leds) l.material.opacity = hornT > 0 ? 0.9 : 0; }
    if (!flashPts && T.Points) { const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(new Float32Array(14 * 3), 3));
      flashPts = new T.Points(g, new T.PointsMaterial({ color: 0xffffff, size: 1.5, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending })); flashPts.frustumCulled = false; scene.add(flashPts); }
    if (flashPts) { if (camFlash > 0) { camFlash = Math.max(0, camFlash - dt); const a = flashPts.geometry.attributes.position;
        for (let i = 0; i < a.count; i++) { if (Math.random() < 0.35) { const side = Math.random() < 0.5, sg = Math.random() < 0.5 ? 1 : -1, u = Math.random() * 2 - 1, up = 7 + Math.random() * 16;
          if (side) a.setXYZ(i, sg * (33 + up * 0.9), up, u * 55); else a.setXYZ(i, u * 34, up, sg * (54 + up * 0.9)); } else if (Math.random() < 0.5) a.setY(i, -50); }
        a.needsUpdate = true; flashPts.material.opacity = Math.min(1, camFlash * 2); } else if (flashPts.material.opacity > 0) flashPts.material.opacity = 0; }
  }
  let staRing = null;
  let ballMesh, ballShadow, userRing, handRing, courtMat, nets = [], tkoBeam = null, tkoSparks = null;

  const PX = 20;  // court texture pixels per foot

  function courtTexture(home) {
    const cv = document.createElement('canvas');
    cv.width = 50 * PX; cv.height = 94 * PX;
    const g = cv.getContext('2d');
    const X = x => (x + 25) * PX, Z = z => (z + 47) * PX;
    /* hardwood: planks run the length of the court */
    /* every building's own wood: pale maple, honey, a darker stain, a reddish one */
    let hh = 0; for (const ch of String(home.id)) hh = (hh * 31 + ch.charCodeAt(0)) >>> 0;
    const tone = [[1, 1, 1], [1.08, 1.08, 1.12], [0.82, 0.8, 0.78], [1.02, 0.9, 0.82], [1.05, 1.02, 0.95]][hh % 5];
    if (home.street) {
      /* the blacktop: asphalt, worn lighter where the games are played, flecked with grit */
      g.fillStyle = '#2c2e33'; g.fillRect(0, 0, cv.width, cv.height);
      for (let i = 0; i < 9000; i++) { const l = 30 + PB.rand() * 40; g.fillStyle = `rgba(${l + 20},${l + 22},${l + 26},${0.25 + PB.rand() * 0.4})`; g.fillRect(PB.rand() * cv.width, PB.rand() * cv.height, 1 + PB.rand() * 2.5, 1 + PB.rand() * 2.5); }
      const wear = g.createRadialGradient(cv.width / 2, cv.height * 0.06, 10, cv.width / 2, cv.height * 0.06, cv.width * 0.7); wear.addColorStop(0, 'rgba(255,255,255,0.07)'); wear.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = wear; g.fillRect(0, 0, cv.width, cv.height); g.fillStyle = wear; g.save(); g.translate(0, cv.height); g.scale(1, -1); g.fillRect(0, 0, cv.width, cv.height); g.restore();
    } else {
    g.fillStyle = `rgb(${Math.round(201 * tone[0])},${Math.round(149 * tone[1])},${Math.round(97 * tone[2])})`; g.fillRect(0, 0, cv.width, cv.height);
    for (let i = 0; i < 50 * 3; i++) {
      const x = i * PX / 3;
      for (let z = 0; z < cv.height;) {
        const len = 80 + PB.rand() * 260;
        const l = 0.86 + PB.rand() * 0.2;
        g.fillStyle = `rgb(${Math.min(255, Math.round(201 * l * tone[0]))},${Math.min(255, Math.round(149 * l * tone[1]))},${Math.min(255, Math.round(97 * l * tone[2]))})`;
        g.fillRect(x, z, PX / 3 - 1, len - 1);
        z += len;
      }
    }
    g.globalAlpha = 0.06; g.fillStyle = '#000';
    for (let i = 0; i < 3000; i++) g.fillRect(PB.rand() * cv.width, PB.rand() * cv.height, 1 + PB.rand() * 2, 4 + PB.rand() * 18);
    g.globalAlpha = 1;
    }
    /* every floor its own design too: 0 the classic (a solid key), 1 a darker stain inside the three-point line,
       2 a two-tone key (the second color in the circle and under the rim), 3 an open key (wood, edged in the color) */
    const design = home.court !== undefined ? home.court : (hh >>> 3) % 4;
    const arcPath = s2 => { const rz = 41.75 * s2, bz = 47 * s2, cz = rz - s2 * Math.sqrt(23.75 * 23.75 - 22 * 22), a0 = Math.atan2(cz - rz, -22), a1 = Math.atan2(cz - rz, 22);
      g.beginPath(); g.moveTo(X(-22), Z(bz)); g.lineTo(X(-22), Z(cz)); if (s2 > 0) g.arc(X(0), Z(rz), 23.75 * PX, a0, a1, false); else g.arc(X(0), Z(rz), 23.75 * PX, a0, a1, true); g.lineTo(X(22), Z(bz)); g.closePath(); };
    if (design === 1) { g.fillStyle = 'rgba(70,36,8,0.20)'; for (const s2 of [-1, 1]) { arcPath(s2); g.fill(); } }
    /* the paint and the center circle in the home team's color */
    g.fillStyle = home.c1;
    g.globalAlpha = design === 3 ? 0.16 : 0.88;
    g.fillRect(X(-8), Z(-47), 16 * PX, 19 * PX);
    g.fillRect(X(-8), Z(28), 16 * PX, 19 * PX);
    g.globalAlpha = 0.88;
    g.beginPath(); g.arc(X(0), Z(0), 6 * PX, 0, 7); g.fill();
    if (design === 3) { g.lineWidth = 0.75 * PX; g.strokeStyle = home.c1; for (const s2 of [-1, 1]) g.strokeRect(X(-8) + g.lineWidth / 2, Z(s2 > 0 ? 28 : -47) + g.lineWidth / 2, 16 * PX - g.lineWidth, 19 * PX - g.lineWidth); }
    if (design === 2) { g.fillStyle = home.c2; g.globalAlpha = 0.8;
      for (const s2 of [-1, 1]) { g.beginPath(); g.arc(X(0), Z(28 * s2), 6 * PX, 0, 7); g.fill(); g.beginPath(); g.arc(X(0), Z(41.75 * s2), 4 * PX, s2 > 0 ? Math.PI : 0, s2 > 0 ? 2 * Math.PI : Math.PI, false); g.lineTo(X(s2 > 0 ? 4 : -4), Z(47 * s2)); g.lineTo(X(s2 > 0 ? -4 : 4), Z(47 * s2)); g.closePath(); g.fill(); }
      g.fillStyle = home.c1; g.globalAlpha = 0.88; g.fillRect(X(-8), Z(-47), 16 * PX, 13 * PX - 0); g.fillRect(X(-8), Z(34), 16 * PX, 13 * PX); }
    g.globalAlpha = 1;
    /* sideline and baseline band */
    g.fillStyle = home.c1; g.globalAlpha = 0.9;
    g.fillRect(0, 0, cv.width, 0.6 * PX); g.fillRect(0, cv.height - 0.6 * PX, cv.width, 0.6 * PX);
    g.globalAlpha = 1;
    g.strokeStyle = '#fbfbf6'; g.lineWidth = 0.17 * PX * 1.4;
    const line = (pts) => { g.beginPath(); pts.forEach(([x, z], i) => i ? g.lineTo(X(x), Z(z)) : g.moveTo(X(x), Z(z))); g.stroke(); };
    g.strokeRect(g.lineWidth / 2, g.lineWidth / 2, cv.width - g.lineWidth, cv.height - g.lineWidth);
    line([[-25, 0], [25, 0]]);
    g.beginPath(); g.arc(X(0), Z(0), 6 * PX, 0, 7); g.stroke();
    g.beginPath(); g.arc(X(0), Z(0), 2 * PX, 0, 7); g.stroke();
    for (const s of [-1, 1]) {
      const bz = 47 * s, rz = 41.75 * s, fz = 28 * s;
      line([[-8, bz], [-8, fz], [8, fz], [8, bz]]);
      line([[-6, bz], [-6, fz]]); line([[6, bz], [6, fz]]);
      g.beginPath(); g.arc(X(0), Z(fz), 6 * PX, 0, 7); g.stroke();
      /* three-point line: straight in the corners at 22 feet, then the 23.75-foot arc */
      const cz = rz - s * Math.sqrt(23.75 * 23.75 - 22 * 22);
      line([[-22, bz], [-22, cz]]); line([[22, bz], [22, cz]]);
      const a0 = Math.atan2(cz - rz, -22), a1 = Math.atan2(cz - rz, 22);
      g.beginPath();
      if (s > 0) g.arc(X(0), Z(rz), 23.75 * PX, a0, a1, false); else g.arc(X(0), Z(rz), 23.75 * PX, a1, a0, false);
      g.stroke();
      /* restricted area */
      g.beginPath(); g.arc(X(0), Z(rz), 4 * PX, s > 0 ? Math.PI : 0, s > 0 ? 2 * Math.PI : Math.PI, false); g.stroke();
      /* lane hash marks */
      for (const d of [7, 8, 11, 14]) for (const sx of [-1, 1]) line([[sx * 8, bz - s * d], [sx * 8.7, bz - s * d]]);
    }
    /* center logo, readable from behind the team attacking +z (player lock, the default camera); the baseline names
       each read the right way up as you attack toward them */
    g.save(); g.translate(X(0), Z(0)); g.rotate(Math.PI);
    g.fillStyle = home.c2; g.font = `900 ${3 * PX}px Archivo, Arial`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(home.ab || home.id, 0, 0); g.restore();
    for (const [z, rot, txt] of [[44.9, Math.PI, home.name], [-44.9, 0, home.city]]) {
      g.save(); g.fillStyle = 'rgba(255,255,255,.85)'; g.font = `800 ${2.2 * PX}px Archivo, Arial`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.translate(X(0), Z(z)); g.rotate(rot); g.fillText(txt.toUpperCase(), 0, 0); g.restore();
    }
    const tex = new T.CanvasTexture(cv);
    tex.colorSpace = T.SRGBColorSpace;   // the canvas is drawn in sRGB: say so, or the floor comes out washed pale
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return tex;
  }

  function crowdTexture(home) {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128;
    const g = cv.getContext('2d');
    g.fillStyle = '#1b2231'; g.fillRect(0, 0, 512, 128);
    const cols = ['#d9d9d9', '#30343c', '#b22a2a', '#2b4f9e', '#e0c070', '#6e7c8c', '#1d1d1d', '#8d5a3a'];
    for (let r = 0; r < 8; r++) for (let c = 0; c < 64; c++) {
      if (PB.rand() < 0.12) continue;
      const fan = home && PB.rand() < 0.4;   // a good share of the building in the home team's colors
      g.fillStyle = fan ? (PB.rand() < 0.7 ? home.c1 : home.c2) : cols[Math.floor(PB.rand() * cols.length)];
      const x = c * 8 + 2 + PB.rand() * 2, y = r * 16 + 4;
      g.fillRect(x, y + 5, 5, 8);
      g.fillStyle = PB.SKIN[Math.floor(PB.rand() * 6)];
      g.beginPath(); g.arc(x + 2.5, y + 3, 2.4, 0, 7); g.fill();
    }
    const t = new T.CanvasTexture(cv); t.wrapS = T.RepeatWrapping; t.colorSpace = T.SRGBColorSpace; return t;
  }

  function hoop(s, home) {
    const g = new T.Group();
    const white = new T.MeshLambertMaterial({ color: 0xffffff });
    const steel = new T.MeshLambertMaterial({ color: 0x2a2f38 });
    const pad = new T.MeshLambertMaterial({ color: home && home.c1 ? new T.Color(home.c1).multiplyScalar(0.8) : 0x16181d });   // the stanchion pad in the home team's color
    /* stanchion behind the baseline */
    const base = new T.Mesh(new T.BoxGeometry(4, 3, 5), pad); base.position.set(0, 1.5, s * 52); g.add(base);
    const pole = new T.Mesh(new T.BoxGeometry(0.7, 11, 0.7), steel); pole.position.set(0, 8, s * 51.5); g.add(pole);
    const arm = new T.Mesh(new T.BoxGeometry(0.5, 0.5, 8.5), steel); arm.position.set(0, 12.5, s * 47.6); g.add(arm);
    /* backboard: clear glass with a white border and shooter's square */
    const glass = new T.Mesh(new T.BoxGeometry(6, 3.5, 0.1), new T.MeshLambertMaterial({ color: 0xcfe6ff, transparent: true, opacity: 0.25 }));
    glass.position.set(0, 11.25, s * 43); g.add(glass);
    const edge = (w, h, x, y) => { const m = new T.Mesh(new T.BoxGeometry(w, h, 0.14), white); m.position.set(x, y, s * 43); g.add(m); };
    edge(6, 0.12, 0, 13); edge(6, 0.12, 0, 9.5); edge(0.12, 3.5, -3, 11.25); edge(0.12, 3.5, 3, 11.25);
    edge(2, 0.1, 0, 11.5); edge(2, 0.1, 0, 10.0); edge(0.1, 1.5, -1, 10.75); edge(0.1, 1.5, 1, 10.75);
    /* rim */
    const rim = new T.Mesh(new T.TorusGeometry(0.75, 0.055, 8, 28), new T.MeshLambertMaterial({ color: 0xff5a1f }));
    rim.rotation.x = Math.PI / 2; rim.position.set(0, 10, s * 41.75); g.add(rim);
    const neck = new T.Mesh(new T.BoxGeometry(0.25, 0.1, 0.6), rim.material); neck.position.set(0, 10, s * 42.75); g.add(neck);
    /* net */
    const net = new T.Mesh(new T.CylinderGeometry(0.75, 0.42, 1.5, 12, 3, true),
      new T.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.8 }));
    net.position.set(0, 9.25, s * 41.75); g.add(net);
    nets.push({ mesh: net, s, swish: 0, rim, snap: 0 });
    /* the red light round the backboard: on at the horn */
    { const lm = new T.MeshBasicMaterial({ color: 0xff2020, transparent: true, opacity: 0, depthWrite: false }), led = new T.Group(); led.material = lm;
      for (const [w, h, x, y] of [[6.3, 0.16, 0, 1.83], [6.3, 0.16, 0, -1.83], [0.16, 3.82, 3.07, 0], [0.16, 3.82, -3.07, 0]]) { const e = new T.Mesh(new T.BoxGeometry(w, h, 0.14), lm); e.position.set(x, y, 0); led.add(e); }
      led.position.set(0, 11.25, s * 43); g.add(led); leds.push(led); }
    return g;
  }

  /* A player: legs, shorts, torso with the number, arms and a head, built at 6.1 ft and scaled to his height. */
  function wordTex(word, color, edge) {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
    const g = cv.getContext('2d');
    g.font = '900 44px Archivo, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    const w = g.measureText(word.toUpperCase()).width, sc = Math.min(1, 236 / Math.max(1, w));
    g.save(); g.translate(128, 34); g.scale(sc, 1);
    if (edge) { g.lineWidth = 7; g.strokeStyle = edge; g.strokeText(word.toUpperCase(), 0, 0); }
    g.fillStyle = color; g.fillText(word.toUpperCase(), 0, 0); g.restore();
    const t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace; return t;
  }
  function numberTex(num, c1, c2, edge) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const g = cv.getContext('2d');
    if (c1) { g.fillStyle = c1; g.fillRect(0, 0, 128, 128); }   // no background: printed straight on the jersey
    g.font = '900 78px Archivo, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.lineJoin = 'round';
    g.lineWidth = edge ? 12 : 8; g.strokeStyle = edge || 'rgba(0,0,0,.35)'; g.strokeText(String(num), 64, 70);
    g.fillStyle = c2; g.fillText(String(num), 64, 70);
    const t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace; return t;
  }
  function playerMesh(p, kit) {
    const root = new T.Group(), body = new T.Group();
    root.add(body);
    const skin = new T.MeshLambertMaterial({ color: PB.SKIN[(p.d || p).skin || 0] });
    const jer = new T.MeshLambertMaterial({ color: kit.c1 });
    const trim = new T.MeshLambertMaterial({ color: kit.c2 });
    const shoe = new T.MeshLambertMaterial({ color: kit.shoe || 0xf4f4f4 });
    const legs = [], arms = [];
    for (const sx of [-1, 1]) {
      const hip = new T.Group(); hip.position.set(sx * 0.32, 3.0, 0); body.add(hip);
      const thigh = new T.Mesh(new T.CylinderGeometry(0.25, 0.2, 2.9, 7), skin); thigh.position.y = -1.45; hip.add(thigh);
      const shorts = new T.Mesh(new T.CylinderGeometry(0.36, 0.33, 1.25, 8), jer); shorts.position.y = -0.5; hip.add(shorts);
      const band = new T.Mesh(new T.CylinderGeometry(0.335, 0.335, 0.12, 8), trim); band.position.y = -1.1; hip.add(band);
      const sh = new T.Mesh(new T.BoxGeometry(0.42, 0.3, 0.85), shoe); sh.position.set(0, -2.95, 0.15); hip.add(sh);
      legs.push(hip);
      const sho = new T.Group(); sho.position.set(sx * 0.82, 4.85, 0); body.add(sho);
      const arm = new T.Mesh(new T.CylinderGeometry(0.15, 0.12, 2.35, 6), skin); arm.position.y = -1.15; sho.add(arm);
      const hand = new T.Mesh(new T.SphereGeometry(0.17, 6, 5), skin); hand.position.y = -2.35; sho.add(hand);
      arms.push(sho);
    }
    const torso = new T.Mesh(new T.CylinderGeometry(0.68, 0.5, 2.05, 9), jer); torso.position.y = 4.0; body.add(torso);
    const neckband = new T.Mesh(new T.CylinderGeometry(0.3, 0.38, 0.14, 9), trim); neckband.position.y = 5.05; body.add(neckband);
    const tex = numberTex(p.num, kit.c1, kit.c2);
    const numMat = new T.MeshBasicMaterial({ map: tex, transparent: false });
    const back = new T.Mesh(new T.PlaneGeometry(0.85, 0.85), numMat); back.position.set(0, 4.25, -0.62); back.rotation.y = Math.PI; body.add(back);
    const front = new T.Mesh(new T.PlaneGeometry(0.6, 0.6), numMat); front.position.set(0, 4.3, 0.64); body.add(front);
    const head = new T.Mesh(new T.SphereGeometry(0.42, 10, 8), skin); head.position.y = 5.62; body.add(head);
    const hair = new T.Mesh(new T.SphereGeometry(0.44, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2.4), new T.MeshLambertMaterial({ color: 0x1b1410 }));
    hair.position.y = 5.66; body.add(hair);
    const sc = (p.ht || 78) / 12 / 6.1;
    body.scale.setScalar(sc);
    const shadow = new T.Mesh(new T.CircleGeometry(1.1, 16), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.02; root.add(shadow);
    return { root, body, legs, arms, head, shadow, phase: PB.rand() * 6 };
  }


  /* ---------- skinned players: models/player.glb (Quaternius's CC0 mannequin and animations, tools/model.mjs) ----------
     One body for everyone, scaled to each player's height. The kit is painted on by region (which bone moves each
     part of the body: the spine wears the jersey, the hips and upper thighs the shorts, the feet the shoes), so one
     shared mesh can wear any team's colors. Running, jumping and the stance come from the animation clips, blended by
     speed; the basketball arms (the dribble, the jumper, the contest, the reach) are set in code on top, each arm bone
     turned to point where the pose wants it. */
  let TPL = null, tplLoading = null;
  R.loadModel = () => {
    const A = window.THREE_ADDONS;
    if (TPL || !A) return Promise.resolve(TPL);
    if (!tplLoading) tplLoading = Promise.all([new A.GLTFLoader().loadAsync('models/player.glb'), PB.oldBody ? null : new A.GLTFLoader().loadAsync('models/body.glb').catch(e => { console.warn('body model', e); return null; })]).then(([g, gb]) => (TPL = R._tpl = template(g, gb))).catch(e => { console.warn('player model', e); return null; });
    return tplLoading;
  };
  R.modelReady = () => !!TPL;
  R._tpl = () => TPL;
  const V3 = (x, y, z) => new T.Vector3(x, y, z), Q4 = () => new T.Quaternion();
  const bk = n => n.replace(/[.\[\]:/]/g, '');
  function template(g, gb) {
    const scene = g.scene;
    scene.updateMatrixWorld(true);
    const meshes = []; scene.traverse(o => { if (o.isSkinnedMesh) meshes.push(o); });
    /* the pocket player (models/body.glb, built by tools/body.py) stands on this skeleton with longer legs: the
       skeleton takes the model's rest pose, bone by bone, before anything is measured from it */
    let model = null, legK = 1;
    if (gb) try {
      const src = {}; gb.scene.updateMatrixWorld(true); gb.scene.traverse(o => { if (o.isBone) src[bk(o.name)] = o; });
      const th = meshes[0].skeleton.bones.find(b => bk(b.name) === 'DEF-thighL'), y0 = th.getWorldPosition(new T.Vector3()).y;
      for (const b of meshes[0].skeleton.bones) { const q = src[bk(b.name)]; if (q) b.position.copy(q.position); }
      scene.updateMatrixWorld(true);
      for (const m of meshes) m.skeleton.calculateInverses();
      legK = th.getWorldPosition(new T.Vector3()).y / y0;
      /* the hips ride higher by the same amount in every clip */
      for (const c of g.animations) for (const tr of c.tracks) if (/DEF-hips\.position$/.test(tr.name)) { const v = tr.values, r0 = [v[0], v[1], v[2]], hb = meshes[0].skeleton.bones.find(b => bk(b.name) === 'DEF-hips');
        for (let i = 0; i < v.length; i += 3) { v[i] = hb.position.x + (v[i] - r0[0]); v[i + 1] = hb.position.y + (v[i + 1] - r0[1]) * legK; v[i + 2] = hb.position.z + (v[i + 2] - r0[2]); } }
      gb.scene.traverse(o => { if (o.isSkinnedMesh && !model) model = o; });
    } catch (e) { console.warn('body model', e); model = null; }
    for (const m of meshes) m.skeleton.update();
    /* three.js drops the dots from node names as it loads them (DEF-shin.L becomes DEF-shinL): look bones up that way */
    const bones = {}; meshes[0].skeleton.bones.forEach(b => { bones[bk(b.name)] = b; });
    const at = n => bones[bk(n)].getWorldPosition(V3());
    const box = new T.Box3();
    for (const m of meshes) { m.geometry.computeBoundingBox(); box.union(m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld)); }
    const H = box.max.y - box.min.y, knee = at('DEF-shin.L').y, ankle = at('DEF-foot.L').y, hip = at('DEF-thigh.L').y;
    const shortsTo = knee + (hip - knee) * 0.22, sockTo = ankle + (knee - ankle) * 0.28;
    /* region of every vertex, from its heaviest bone: 0 skin, 1 jersey, 2 shorts, 3 shoe, 4 sock, 6 head */
    const hb = new T.Box3();
    for (const m of meshes) {
      const gm = m.geometry, si = gm.attributes.skinIndex, sw = gm.attributes.skinWeight, pos = gm.attributes.position, n = pos.count;
      const reg = new Float32Array(n), kp = new Float32Array(n * 3), v = V3();
      for (let i = 0; i < n; i++) {
        let best = 0, bw = -1;
        const ws = [sw.getX(i), sw.getY(i), sw.getZ(i), sw.getW(i)], is = [si.getX(i), si.getY(i), si.getZ(i), si.getW(i)];
        for (let k = 0; k < 4; k++) if (ws[k] > bw) { bw = ws[k]; best = is[k]; }
        const name = m.skeleton.bones[best].name;
        /* the vertex where it really is: through the skin (the quantized mesh's raw positions are in a squeezed space) */
        v.fromBufferAttribute(pos, i);
        if (m.applyBoneTransform) m.applyBoneTransform(i, v); else m.boneTransform(i, v);
        const y = v.applyMatrix4(m.matrixWorld).y;
        kp[i * 3] = v.x / H; kp[i * 3 + 1] = (y - box.min.y) / H; kp[i * 3 + 2] = v.z / H;   // where it sits on the body, for jersey designs
        let r = 0;
        if (/head/.test(name)) { r = 6; hb.expandByPoint(V3(v.x, y, v.z)); }   // the mannequin's head: hidden, a drawn head goes on the bone
        else if (/spine|shoulder/.test(name)) r = 1;
        else if (/hips/.test(name)) r = 2;
        else if (/thigh/.test(name)) r = y > shortsTo ? 2 : 0;
        else if (/shin/.test(name)) r = y < sockTo ? 4 : 0;
        else if (/foot|toe/.test(name)) r = 3;
        reg[i] = r;
      }
      /* the region one-hot (0-3, 4-7), so a triangle between two regions splits cleanly at its middle instead of
         passing through the colors of the regions numbered in between */
      const ra = new Float32Array(n * 4), rb = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) { const r = reg[i]; if (r < 4) ra[i * 4 + r] = 1; else rb[i * 4 + r - 4] = 1; }
      gm.setAttribute('region', new T.BufferAttribute(reg, 1));
      gm.setAttribute('rA', new T.BufferAttribute(ra, 4)); gm.setAttribute('rB', new T.BufferAttribute(rb, 4));
      gm.setAttribute('kpos', new T.BufferAttribute(kp, 3));
    }
    /* where the number, the small chest number and the hair sit, relative to their bones */
    const fwd = new T.Vector3(0, 0, 1);
    const spine = bones[bk('DEF-spine.003')], head = bones[bk('DEF-head')];
    const chestY = at('DEF-spine.003').y, headP = at('DEF-head');
    const local = (bone, worldPos, worldQuat) => ({ pos: bone.worldToLocal(worldPos.clone()), quat: bone.getWorldQuaternion(Q4()).invert().multiply(worldQuat) });
    const torsoZ = box.max.z * 0.6;
    const backQ = new T.Quaternion().setFromAxisAngle(new T.Vector3(0, 1, 0), Math.PI);
    const decals = {
      back: local(spine, new T.Vector3(0, chestY - H * 0.02, -torsoZ - H * 0.012), backQ),
      nameBack: local(spine, new T.Vector3(0, chestY + H * 0.052, -torsoZ - H * 0.03), backQ),
      front: local(spine, new T.Vector3(0, chestY - H * 0.035, torsoZ + H * 0.022), new T.Quaternion()),
      /* the feet stand at y = 0, so the top of the head is the height (the quantized mesh's own box is centered on zero) */
      hair: local(head, new T.Vector3(headP.x, H * 0.945, headP.z - H * 0.01), new T.Quaternion()),
      face: local(head, new T.Vector3(headP.x, H * 0.885, headP.z + H * 0.052), new T.Quaternion()),
      chest: local(spine, new T.Vector3(0, chestY + H * 0.02, torsoZ + H * 0.024), new T.Quaternion()),
    };
    /* the drawn head: an ellipsoid as wide as the mannequin's, its chin a little under the old jaw (it covers the neck) */
    const headR = (hb.max.x - hb.min.x) / 2 * 1.1, hc = hb.getCenter(V3());
    decals.headC = local(head, V3(hc.x, hb.min.y + headR * HS.y * 0.9, hc.z + headR * 0.06), new T.Quaternion());
        const sideR = Math.sign(at('DEF-hand.R').x - at('DEF-hips').x) || -1;
    /* real shorts: a flared shell on each thigh and a band around the hips, built in the rest pose and handed to the
       bones (so they swing with the legs). kc per vertex: 0 the shorts' color, 1 the side stripe, 2 the hem */
    const hipsC = at('DEF-hips');
    const toBone = (g, bone) => { bone.updateMatrixWorld(true); g.applyMatrix4(bone.matrixWorld.clone().invert()); return g; };
    const shell = side => {
      const hj = at(`DEF-thigh.${side}`), kn = at(`DEF-shin.${side}`), dir = kn.clone().sub(hj), L = dir.length(); dir.normalize();
      const len = L * 0.9, r1 = H * 0.068, r2 = H * 0.066, out = Math.sign(hj.x - hipsC.x) || 1;
      const g = new T.CylinderGeometry(r1, r2, len, 24, 6, true).toNonIndexed(); g.translate(0, -len / 2, 0);
      const kc = new Float32Array(g.attributes.position.count);
      /* one color per triangle, from its middle: sharp stripes */
      const P = g.attributes.position;
      for (let t = 0; t < kc.length; t += 6) {   // two triangles make each quad: one color for both, so the stripe edges are clean
        let x = 0, y = 0; for (let j = 0; j < 6; j++) { x += P.getX(t + j); y += P.getY(t + j); } x /= 6; y /= 6;
        const c = y < -len * 0.86 ? 2 : x * out > r1 * 0.76 ? 1 : 0; for (let j = 0; j < 6; j++) kc[t + j] = c;
      }
      g.setAttribute('kc', new T.BufferAttribute(kc, 1));
      g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0, -1, 0), dir)); g.translate(hj.x, hj.y + H * 0.03, hj.z);
      return g;
    };
    const hipBand = (() => {
      const top = hipsC.y + H * 0.045, bot = at('DEF-thigh.L').y - H * 0.04, h = top - bot;
      const g = new T.CylinderGeometry(H * 0.094, H * 0.108, h, 28, 1, true).toNonIndexed(); g.scale(1, 1, 0.74); g.translate(hipsC.x, bot + h / 2, hipsC.z);
      const kc = new Float32Array(g.attributes.position.count), P = g.attributes.position;
      for (let t = 0; t < kc.length; t += 6) { let x = 0; for (let j = 0; j < 6; j++) x += P.getX(t + j); const c = Math.abs(x / 6 - hipsC.x) > H * 0.088 ? 1 : 0; for (let j = 0; j < 6; j++) kc[t + j] = c; }
      g.setAttribute('kc', new T.BufferAttribute(kc, 1));
      return g;
    })();
    /* one skinned mesh for all three, each part riding its own bone: one draw per player */
    const parts = [[shell('L'), 'DEF-thigh.L'], [shell('R'), 'DEF-thigh.R'], [hipBand, 'DEF-hips']];
    const sk = meshes[0].skeleton, idxOf = n => sk.bones.findIndex(b => bk(b.name) === bk(n));
    let nv = 0; for (const [g] of parts) nv += g.attributes.position.count;
    const pos = new Float32Array(nv * 3), kcA = new Float32Array(nv), sI = new Uint16Array(nv * 4), sW = new Float32Array(nv * 4);
    let o = 0; const m0 = meshes[0];
    for (const [g, bn] of parts) {
      /* this model's raw vertices are not its rest pose: the skin carries them there. Undo what the skin will do for
         this bone (mesh world · bind⁻¹ · bone world · bone inverse · bind) so the part lands where it was built */
      const bi = idxOf(bn), n = g.attributes.position.count;
      const A = m0.matrixWorld.clone().multiply(m0.bindMatrixInverse).multiply(sk.bones[bi].matrixWorld).multiply(sk.boneInverses[bi]).multiply(m0.bindMatrix);
      g.applyMatrix4(A.invert());
      pos.set(g.attributes.position.array, o * 3); kcA.set(g.attributes.kc.array, o);
      for (let i = 0; i < n; i++) { sI[(o + i) * 4] = bi; sW[(o + i) * 4] = 1; }
      o += n;
    }
    const sg = new T.BufferGeometry();
    sg.setAttribute('position', new T.BufferAttribute(pos, 3)); sg.setAttribute('kc', new T.BufferAttribute(kcA, 1));
    sg.setAttribute('skinIndex', new T.Uint16BufferAttribute(sI, 4)); sg.setAttribute('skinWeight', new T.BufferAttribute(sW, 4));
    sg.computeVertexNormals();
    const shortsGeo = sg;
    /* a small number on the front of the shorts' left leg */
    { const hj = at('DEF-thigh.L'), kn = at('DEF-shin.L'), r1 = H * 0.068, o = Math.sign(hj.x - hipsC.x) || 1, nrm = V3(0.55 * o, 0, 0.83).normalize();
      decals.shorts = local(bones[bk('DEF-thigh.L')], V3(hj.x + nrm.x * r1 * 1.04, hj.y + H * 0.03 - (hj.y - kn.y) * 0.45, hj.z + nrm.z * r1 * 1.04), new T.Quaternion().setFromUnitVectors(V3(0, 0, 1), nrm)); }
    let simpleGeo = null;
    let faceGeo = null, Hs = 0;
    if (model) try { const r = modelBody(model); simpleGeo = r.body; faceGeo = r.face; Hs = r.height; } catch (e) { console.warn('body model', e); simpleGeo = null; }
    if (!simpleGeo) { model = null; try { simpleGeo = simpleBody(); } catch (e) { console.warn('simple body', e); } }
    if (simpleGeo && model) {
      /* the lettering sits on the modelled jersey: its front and back are near flat there */
      const put2 = (y, front, q) => local(spine, new T.Vector3(0, y, front ? 0.166 : -0.162), q);
      decals.back = put2(chestY - H * 0.02, false, backQ); decals.nameBack = put2(chestY + H * 0.052, false, backQ);
      decals.front = put2(chestY - H * 0.035, true, new T.Quaternion()); decals.chest = put2(chestY + H * 0.02, true, new T.Quaternion());
    } else if (simpleGeo) {
      /* the lettering sits on the simple torso's surface */
      const zAt = (y, front) => { const R = simpleBody.ring; for (let i = 1; i < R.length; i++) if (y <= R[i][0]) { const f = (y - R[i - 1][0]) / (R[i][0] - R[i - 1][0]), k = front ? 2 : 3; return -0.012 + (front ? 1 : -1) * (R[i - 1][k] + (R[i][k] - R[i - 1][k]) * f); } return 0; };
      const put2 = (y, front, q) => local(spine, new T.Vector3(0, y, zAt(y, front) + (front ? 0.022 : -0.012)), q);
      decals.back = put2(chestY - H * 0.02, false, backQ); decals.nameBack = put2(chestY + H * 0.052, false, backQ);
      decals.front = put2(chestY - H * 0.035, true, new T.Quaternion()); decals.chest = put2(chestY + H * 0.02, true, new T.Quaternion());
    }
    /* A simple body, pocket style (smooth and rounded, no muscles or wooden joints), on the mannequin's own skeleton
       so every animation still drives it. Built in the rest pose (a T-pose, feet at y = 0) from a lofted torso, tapered
       capsules for the limbs, mitten hands and chunky shoes; each vertex rides one bone (the torso blends along the
       spine). Carries the same attributes as the mannequin (rA/rB regions, kpos) so the kit shader paints it. */
    /* The pocket player from models/body.glb: its vertices carry their layer as a color (red = the region / 8: 0 skin,
       1 jersey, 2 shorts, 3 shoe, 4 sock, 5 hair, 6 the whites of the eyes, 7 the dark of the face). The body goes to
       the kit shader (rB.w = 1 says the kit is modelled, so nothing is cut by formula); the hair and face are their own
       small mesh, colored per player. */
    function modelBody(src) {
      const g0 = src.geometry, p = g0.attributes.position, nr = g0.attributes.normal, col = g0.attributes.color, sj = g0.attributes.skinIndex, sw = g0.attributes.skinWeight, ix = g0.index.array;
      const map = src.skeleton.bones.map(b => Math.max(0, idxOf(b.name)));
      const Mx = m0.matrixWorld.clone().invert().multiply(src.matrixWorld), nm = new T.Matrix3().getNormalMatrix(Mx), Wm = src.matrixWorld, v = V3(), n = V3(), w = V3();
      const A = { P: [], N: [], SI: [], SW: [], RA: [], RB: [], KP: [], IX: [], id: new Int32Array(p.count).fill(-1) }, F = { P: [], N: [], SI: [], SW: [], KC: [], IX: [], TV: [], id: new Int32Array(p.count).fill(-1) };
      let top = -1e9, bot = 1e9; const reg = new Uint8Array(p.count);
      for (let i = 0; i < p.count; i++) { reg[i] = Math.round(col.getX(i) * 8); w.fromBufferAttribute(p, i).applyMatrix4(Wm); if (w.y > top) top = w.y; if (w.y < bot) bot = w.y; }
      /* how far down an arm a skin vertex sits (shoulder 0, wrist 1), signed by the arm: a sleeve and tattoos are painted from it */
      const bw = n => { const b = src.skeleton.bones.find(b => b.name === n || b.name === n.replace('.', '')); return b ? b.getWorldPosition(V3()) : null; };
      const ARM = ['R', 'L'].map(S => ({ a: bw('DEF-upper_arm.' + S), b: bw('DEF-hand.' + S), ids: src.skeleton.bones.map((b, k) => /upper_arm|forearm|hand|f_|thumb|palm/.test(b.name) && new RegExp('[._]?' + S + '(\\.\\d+)?$').test(b.name) ? k : -1).filter(k => k >= 0) }));
      const armRaw = (i, w) => { for (let s = 0; s < 2; s++) { const A = ARM[s]; if (!A.a || !A.b) continue; let ws = 0; for (let c = 0; c < 4; c++) if (A.ids.includes(sj.getComponent(i, c))) ws += sw.getComponent(i, c);
        if (ws > 0.5) { const dx = A.b.x - A.a.x, dy = A.b.y - A.a.y, dz = A.b.z - A.a.z; return [s, ((w.x - A.a.x) * dx + (w.y - A.a.y) * dy + (w.z - A.a.z) * dz) / (dx * dx + dy * dy + dz * dz)]; } } return null; };
      const ext = [[1e9, -1e9], [1e9, -1e9]];   // the mesh's own arm, shoulder to fingertips (the bones are not to its scale)
      for (let i = 0; i < p.count; i++) if (reg[i] === 0) { w.fromBufferAttribute(p, i).applyMatrix4(Wm); const r = armRaw(i, w); if (r) { if (r[1] < ext[r[0]][0]) ext[r[0]][0] = r[1]; if (r[1] > ext[r[0]][1]) ext[r[0]][1] = r[1]; } }
      const armT = (i, w) => { const r = armRaw(i, w); if (!r) return 0; const e = ext[r[0]]; return (r[0] ? -1 : 1) * (0.05 + Math.max(0, Math.min(1, (r[1] - e[0]) / ((e[1] - e[0]) || 1)))); };
      const push = (D, i) => { if (D.id[i] >= 0) return D.id[i]; const k = D.P.length / 3; D.id[i] = k;
        v.fromBufferAttribute(p, i).applyMatrix4(Mx); n.fromBufferAttribute(nr, i).applyMatrix3(nm).normalize(); w.fromBufferAttribute(p, i).applyMatrix4(Wm);
        D.P.push(v.x, v.y, v.z); D.N.push(n.x, n.y, n.z);
        let ws = 0; for (let c = 0; c < 4; c++) ws += sw.getComponent(i, c);
        for (let c = 0; c < 4; c++) { D.SI.push(map[sj.getComponent(i, c)] || 0); D.SW.push(ws > 0 ? sw.getComponent(i, c) / ws : c ? 0 : 1); }
        if (D === A) { const r = reg[i]; for (let c = 0; c < 4; c++) D.RA.push(r === c ? 1 : 0); D.RB.push(r === 4 ? 1 : 0, r === 0 ? armT(i, w) : 0, 0, 1); D.KP.push(w.x / H, (w.y - box.min.y) / H, w.z / H); }
        else D.KC.push(reg[i] - 5);
        return k; };
      for (let t = 0; t < ix.length; t += 3) { const D = reg[ix[t]] >= 5 ? F : A; D.IX.push(push(D, ix[t]), push(D, ix[t + 1]), push(D, ix[t + 2])); if (D === F) F.TV.push(Math.round(col.getY(ix[t]) * 32) + 32 * Math.round(col.getZ(ix[t]) * 8)); }   // which hairstyle, beard, face or accessory a triangle belongs to
      /* is the body rigged? A model whose body hangs off one or two bones would stand stiff with its arms out: better
         the old body than that (the catch above falls back to it), and loud enough for the tests to see */
      { const lead = new Set(); for (let k = 0; k < A.SI.length; k += 4) { let b = 0; for (let c = 1; c < 4; c++) if (A.SW[k + c] > A.SW[k + b]) b = c; lead.add(A.SI[k + b]); }
        R._rig = lead.size; if (lead.size < 12) { console.error('PocketBasketball: models/body.glb is badly rigged (' + lead.size + ' bones move the body); using the old body'); throw new Error('body.glb rig'); } }
      const mk = D => { const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(D.P, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(D.N, 3));
        g.setAttribute('skinIndex', new T.Uint16BufferAttribute(D.SI, 4)); g.setAttribute('skinWeight', new T.Float32BufferAttribute(D.SW, 4)); g.setIndex(D.IX); g.userData.shared = true; return g; };
      const body = mk(A); body.setAttribute('rA', new T.Float32BufferAttribute(A.RA, 4)); body.setAttribute('rB', new T.Float32BufferAttribute(A.RB, 4)); body.setAttribute('kpos', new T.Float32BufferAttribute(A.KP, 3));
      const face = mk(F); face.setAttribute('kc', new T.Float32BufferAttribute(F.KC, 1)); face.userData.tv = F.TV; face.userData.sets = {};
      return { body, face, height: top - bot };
    }
    function simpleBody() {
      const P = [], N = [], SI = [], SW = [], RA = [], RB = [], KP = [], IX = [];
      const bi = n => idxOf(n), Am = {};
      const Aof = b => Am[b] || (Am[b] = m0.matrixWorld.clone().multiply(m0.bindMatrixInverse).multiply(sk.bones[b].matrixWorld).multiply(sk.boneInverses[b]).multiply(m0.bindMatrix).invert());
      const nm = new T.Matrix3(), vv = V3(), nn = V3();
      /* add a geometry already in the rest pose; reg(x, y, z) gives each vertex its region, bw(y) its bones */
      const add = (g, reg, bw) => {
        if (!g.index) { const U = window.THREE_ADDONS && window.THREE_ADDONS.BufferGeometryUtils; if (U) g = U.mergeVertices(g); }
        g.computeVertexNormals();
        const p = g.attributes.position, nr = g.attributes.normal, o = P.length / 3;
        for (let i = 0; i < p.count; i++) {
          const x = p.getX(i), y = p.getY(i), z = p.getZ(i), r = reg(x, y, z), w = bw(x, y, z);
          const Ai = Aof(w[0][0]); vv.set(x, y, z).applyMatrix4(Ai); nm.getNormalMatrix(Ai); nn.fromBufferAttribute(nr, i).applyMatrix3(nm).normalize();
          P.push(vv.x, vv.y, vv.z); N.push(nn.x, nn.y, nn.z);
          SI.push(w[0][0], w[1] ? w[1][0] : 0, 0, 0); SW.push(w[0][1], w[1] ? w[1][1] : 0, 0, 0);
          for (let k = 0; k < 4; k++) RA.push(r === k ? 1 : 0); for (let k = 4; k < 8; k++) RB.push(r === k ? 1 : 0);
          KP.push(x / H, (y - box.min.y) / H, z / H);
        }
        const ix = g.index.array; for (let i = 0; i < ix.length; i++) IX.push(ix[i] + o);
      };
      const one = n => () => [[bi(n), 1]];
      const V = (x, y, z) => new T.Vector3(x, y, z);
      /* a tapered capsule from a to b, radius r0 at a and r1 at b */
      const capsule = (a, b, r0, r1, seg) => {
        const pts = [], L = a.distanceTo(b);
        for (let i = 0; i <= 6; i++) { const t = -Math.PI / 2 + i / 6 * Math.PI / 2; pts.push(new T.Vector2(Math.max(1e-4, r0 * Math.cos(t)), r0 * Math.sin(t))); }
        for (let i = 1; i <= 6; i++) { const t = i / 6 * Math.PI / 2; pts.push(new T.Vector2(Math.max(1e-4, r1 * Math.cos(t)), L + r1 * Math.sin(t))); }
        const g = new T.LatheGeometry(pts, seg || 14);
        g.applyQuaternion(new T.Quaternion().setFromUnitVectors(V(0, 1, 0), b.clone().sub(a).normalize())); g.translate(a.x, a.y, a.z);
        return g;
      };
      const ellip = (c, rx, ry, rz, seg) => { const g = new T.SphereGeometry(1, seg || 14, 10); g.scale(rx, ry, rz); g.translate(c.x, c.y, c.z); return g; };
      /* the torso: elliptical rings up the body (a touch boxy), wider at the chest and shoulders than the waist */
      const ring = [[0.86, 0.150, 0.095, 0.150], [0.98, 0.142, 0.100, 0.135], [1.10, 0.132, 0.108, 0.125], [1.22, 0.150, 0.128, 0.118],
        [1.33, 0.168, 0.138, 0.122], [1.42, 0.176, 0.118, 0.12], [1.475, 0.155, 0.075, 0.100], [1.505, 0.10, 0.035, 0.06], [1.515, 0.02, 0.01, 0.02]];
      simpleBody.ring = ring;
      { const NA = 32, pos = [], idx = [], cz = -0.012, ex = 2 / 2.6;
        ring.forEach(([y, hw, zf, zb]) => { for (let i = 0; i < NA; i++) { const t = i / NA * Math.PI * 2, c = Math.cos(t), s = Math.sin(t);
          pos.push(hw * Math.sign(c) * Math.abs(c) ** ex, y, cz + (s > 0 ? zf : zb) * Math.sign(s) * Math.abs(s) ** ex); } });
        for (let r = 0; r < ring.length - 1; r++) for (let i = 0; i < NA; i++) { const a = r * NA + i, b = r * NA + (i + 1) % NA, c = a + NA, d = b + NA; idx.push(a, c, b, b, c, d); }
        const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
        const sp = [['DEF-hips', 0.917], ['DEF-spine.001', 1.051], ['DEF-spine.002', 1.174], ['DEF-spine.003', 1.315]].map(([n, y]) => [bi(n), at(n).y]);
        add(g, (x, y) => y < 0.97 ? 2 : 1, (x, y) => {
          if (y <= sp[0][1]) return [[sp[0][0], 1]]; if (y >= sp[3][1]) return [[sp[3][0], 1]];
          for (let k = 0; k < 3; k++) if (y <= sp[k + 1][1]) { const f = (y - sp[k][1]) / (sp[k + 1][1] - sp[k][1]); return [[sp[k][0], 1 - f], [sp[k + 1][0], f]]; }
        });
      }
      const nk = at('DEF-neck'), hd = at('DEF-head');
      add(capsule(V(0, nk.y - 0.06, nk.z), V(0, hd.y + 0.02, hd.z), 0.058, 0.055), () => 0, one('DEF-neck'));
      for (const sd of ['L', 'R']) {
        const sh = at(`DEF-upper_arm.${sd}`), el = at(`DEF-forearm.${sd}`), wr = at(`DEF-hand.${sd}`), o = Math.sign(sh.x);
        add(capsule(V(sh.x - o * 0.035, sh.y, sh.z), el, 0.066, 0.054), () => 0, one(`DEF-upper_arm.${sd}`));
        add(capsule(el, wr, 0.053, 0.043), () => 0, one(`DEF-forearm.${sd}`));
        /* a mitten hand with a thumb */
        add(ellip(V(wr.x + o * 0.07, wr.y, wr.z + 0.005), 0.072, 0.034, 0.05), () => 0, one(`DEF-hand.${sd}`));
        add(ellip(V(wr.x + o * 0.035, wr.y + 0.004, wr.z + 0.055), 0.04, 0.024, 0.022, 10), () => 0, one(`DEF-hand.${sd}`));
        const hp = at(`DEF-thigh.${sd}`), kn = at(`DEF-shin.${sd}`), an = at(`DEF-foot.${sd}`), to = at(`DEF-toe.${sd}`);
        add(capsule(V(hp.x, hp.y - 0.02, hp.z - 0.01), kn, 0.074, 0.066, 16), () => 0, one(`DEF-thigh.${sd}`));
        add(capsule(kn, V(an.x, an.y + 0.02, an.z), 0.07, 0.052, 16), (x, y) => y < sockTo ? 4 : 0, one(`DEF-shin.${sd}`));
        /* a chunky shoe: heel and body on the foot, the front on the toe */
        const sw = 0.072, sb = new T.BoxGeometry(1, 1, 1, 6, 4, 8);
        { const p = sb.attributes.position, q = V();
          for (let i = 0; i < p.count; i++) { q.fromBufferAttribute(p, i);   // round the box: push corners in, a superellipsoid look
            const ux = q.x * 2, uy = q.y * 2, uz = q.z * 2, k = Math.sqrt(ux * ux + uy * uy + uz * uz) || 1, f = 0.35 + 0.65 / k * Math.max(Math.abs(ux), Math.abs(uy), Math.abs(uz));
            p.setXYZ(i, q.x * f, q.y * f, q.z * f * (q.y > 0 && q.z > 0 ? 1 - 0.25 * q.y : 1)); } }
        sb.scale(sw * 2, 0.13, 0.3); sb.translate(an.x, 0.062, (an.z + to.z) / 2 - 0.015);
        add(sb, () => 3, (x, y, z) => z > to.z - 0.03 ? [[bi(`DEF-toe.${sd}`), 1]] : [[bi(`DEF-foot.${sd}`), 1]]);
        /* the high-top collar round the ankle */
        add(capsule(V(an.x, 0.07, an.z - 0.02), V(an.x, 0.15, an.z - 0.025), 0.066, 0.06, 16), () => 3, one(`DEF-foot.${sd}`));
      }
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new T.Float32BufferAttribute(N, 3));
      g.setAttribute('skinIndex', new T.Uint16BufferAttribute(SI, 4)); g.setAttribute('skinWeight', new T.Float32BufferAttribute(SW, 4));
      g.setAttribute('rA', new T.Float32BufferAttribute(RA, 4)); g.setAttribute('rB', new T.Float32BufferAttribute(RB, 4)); g.setAttribute('kpos', new T.Float32BufferAttribute(KP, 3));
      g.setIndex(IX); g.userData.shared = true;
      return g;
    }
    const clips = {}; for (const c of g.animations) clips[c.name] = c;
    /* the sole's normal in each foot bone's own frame, to keep planted shoes flat on the floor */
    const footUp = {}; for (const sd of ['L', 'R']) { const fb = bones[bk(`DEF-foot.${sd}`)]; if (fb) footUp[sd] = V3(0, 1, 0).applyQuaternion(fb.getWorldQuaternion(Q4()).invert()); }
    { const d = at('DEF-toe.L').sub(at('DEF-foot.L')); footUp.slope = d.y / Math.hypot(d.x, d.z); }   // the foot bone runs down from the ankle to the ball of the foot
    return { scene, clips, H, decals, sideR, torsoZ, box, headP, shortsGeo, headR, simpleGeo, footUp, model: !!model, faceGeo, Hs: model ? Hs : 0 };
  }
  /* the kit: colors by body region, and a design on the jersey and shorts. Designs (cols.pat):
     0 plain, 1 side panels (down the jersey and the shorts), 2 pinstripes, 3 a chest band, 4 a fade to dark,
     5 shoulder yokes, 6 a diagonal sash. cAlt is the design's color. */
  function kitMaterial(cols) {
    const m = new T.MeshLambertMaterial({ color: 0xffffff });
    const u = { cTrim: { value: new T.Color(cols.trim || cols.jersey) }, cSkin: { value: new T.Color(cols.skin) }, cJersey: { value: new T.Color(cols.jersey) }, cShorts: { value: new T.Color(cols.shorts) },
      cShoe: { value: new T.Color(cols.shoe) }, cSock: { value: new T.Color(cols.sock) }, cAlt: { value: new T.Color(cols.alt || cols.trim || cols.jersey) }, kPat: { value: cols.pat || 0 }, kTat: { value: cols.tat || 0 }, kSlv: { value: cols.sleeve ? 1 : 0 }, kRef: { value: +cols.ref || 0 }, kTights: { value: cols.tights ? 1 : 0 }, kSock: { value: cols.socks === 'high' ? 1 : cols.socks === 'low' ? 2 : 0 }, kShoe: { value: +cols.shoeStyle || 0 }, kBic: { value: cols.bicep ? 1 : 0 }, cBic: { value: new T.Color(cols.bicep || '#f2f2f2') }, kTee: { value: cols.tee ? 1 : 0 }, cTee: { value: new T.Color(cols.tee || '#f2f2f2') }, cSlv: { value: new T.Color(cols.sleeve || '#111111') } };
    m.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, u);
      sh.vertexShader = 'attribute vec4 rA;\nattribute vec4 rB;\nattribute vec3 kpos;\nvarying vec4 vRA;\nvarying vec4 vRB;\nvarying vec3 vK;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vRA = rA; vRB = rB; vK = kpos;');
      /* a rim light: the edge of the body catches light, so players pop off the floor */
      sh.fragmentShader = sh.fragmentShader.replace('#include <dithering_fragment>', '#include <dithering_fragment>\n  { vec3 vd = normalize(vViewPosition); float rim = pow(1.0 - clamp(abs(dot(normalize(vNormal), vd)), 0.0, 1.0), 3.0); gl_FragColor.rgb += rim * 0.28; }');
      sh.fragmentShader = 'uniform vec3 cSkin;\nuniform vec3 cJersey;\nuniform vec3 cShorts;\nuniform vec3 cShoe;\nuniform vec3 cSock;\nuniform vec3 cTrim;\nuniform vec3 cAlt;\nuniform float kPat;\nuniform float kTat;\nuniform float kSlv;\nuniform float kRef;\nuniform float kTee;\nuniform float kTights;\nuniform float kSock;\nuniform float kShoe;\nuniform float kBic;\nuniform vec3 cBic;\nuniform vec3 cTee;\nuniform vec3 cSlv;\nvarying vec4 vRA;\nvarying vec4 vRB;\nvarying vec3 vK;\n' +
        sh.fragmentShader.replace('vec4 diffuseColor = vec4( diffuse, opacity );', `
  /* the strongest region here wins */
  float vRegion = 0.0, rbest = vRA.x;
  if (vRA.y > rbest) { rbest = vRA.y; vRegion = 1.0; } if (vRA.z > rbest) { rbest = vRA.z; vRegion = 2.0; } if (vRA.w > rbest) { rbest = vRA.w; vRegion = 3.0; }
  if (vRB.x > rbest) { rbest = vRB.x; vRegion = 4.0; } if (vRB.z > rbest) { rbest = vRB.z; vRegion = 6.0; }
  if (vRegion > 5.5) discard;   // the mannequin's head: a drawn one sits on the bone
  /* a referee: short sleeves (the shirt runs down the upper arm) and long pants (the legs take the shorts' color) */
  if (kRef > 0.5 && vRB.w > 0.5 && vRegion < 0.5) { if (abs(vRB.y) > 0.05) { if (abs(vRB.y) - 0.05 < (kRef > 1.5 ? 0.80 : 0.34)) vRegion = 1.0; } else if (vK.y < 0.95) vRegion = 2.0; else if (vK.y < 1.392) vRegion = 1.0; }
  /* a tank top cut by formula, not by the mesh: armholes (ellipses at each shoulder) and a neckline (deeper in front),
     each with a band of the trim color, so the edges are smooth curves at any distance */
  if (vRB.w < 0.5 && vRegion < 0.5 && abs(vK.x) < 0.05 && vK.y > 1.365) discard;   // the top of the neck: inside the drawn head
  bool neckSkin = false;   // the mannequin's neck reaches down into the jersey
  if (vRB.w < 0.5 && ((vRegion > 0.5 && vRegion < 1.5) || neckSkin)) {
    float ax0 = abs(vK.x), arm = length(vec2((ax0 - 0.108) / 0.04, (vK.y - 1.30) / 0.09));
    float nk = length(vec2(vK.x / 0.04, (vK.y - 1.335) / (vK.z > 0.0 ? 0.05 : 0.03)));
    float cut = min(arm - 1.0, nk - 1.0);
    if (cut < 0.0) vRegion = 0.0; else if (cut < 0.2) vRegion = 5.0; else if (neckSkin) vRegion = 1.0;
  }
  vec3 rc = vRegion < 0.5 ? cSkin : vRegion < 1.5 ? cJersey : vRegion < 2.5 ? cShorts : vRegion < 3.5 ? cShoe : vRegion < 4.5 ? cSock : cTrim;
  bool top = vRegion > 0.5 && vRegion < 1.5, bot = vRegion > 1.5 && vRegion < 2.5;
  float ax = abs(vK.x);
  if (top || bot) {
    if (kPat > 0.5 && kPat < 1.5 && ax > (top ? 0.07 : 0.066)) rc = cAlt;
    else if (kPat > 1.5 && kPat < 2.5 && fract(vK.x * 70.0) < 0.13) rc = mix(rc, cAlt, 0.6);
    else if (kPat > 2.5 && kPat < 3.5 && top && vK.y > 1.195 && vK.y < 1.222) rc = cAlt;
    else if (kPat > 3.5 && kPat < 4.5) rc = rc * mix(0.55, 1.0, smoothstep(0.9, 1.28, vK.y));
    else if (kPat > 4.5 && kPat < 5.5 && top && vK.y > 1.262) rc = cAlt;
    else if (kPat > 6.5 && top) { if (fract(vK.x * 26.0 + 0.25) < 0.5) rc = cAlt; }   // a referee's stripes
    else if (kPat > 5.5 && kPat < 6.5 && top && abs(vK.x + (vK.y - 1.18) * 0.85) < 0.016) rc = cAlt;
    if (bot && kPat > 2.5 && kPat < 3.5 && vK.y < 0.918) rc = cAlt;   // the chest band's partner: a hem band on the shorts
  }
  /* tattoos (kTat: 1 a band on the right arm, 2 a sleeve on the left, 3 both, 4 a forearm piece): in the rest pose the
     arms lie along x, the right one on -x */
  if (vRegion < 0.5 && vRB.w > 0.5 && abs(vRB.y) > 0.05) {   // the model: the arm's own coordinate
    float at = abs(vRB.y) - 0.05; bool rgt = vRB.y > 0.0; float ink = 0.0;
    if ((kTat > 0.5 && kTat < 1.5 || kTat > 2.5 && kTat < 3.5) && rgt && at > 0.29 && at < 0.43) ink = step(0.5, fract(at * 60.0 + vK.z * 40.0)) * 0.6 + (abs(at - 0.36) < 0.03 ? 0.9 : 0.0);
    if (kTat > 1.5 && kTat < 3.5 && !rgt && at > 0.12 && at < 0.76) ink = max(ink, step(0.55, fract(sin(floor(at * 34.0) * 12.9 + floor((vK.y + vK.z) * 70.0) * 78.2) * 437.5)) * 0.9);
    if (kTat > 3.5 && rgt && at > 0.52 && at < 0.70) ink = step(0.35, fract(at * 26.0 + vK.y * 30.0)) * 0.8;
    rc = mix(rc, vec3(0.06, 0.07, 0.1), clamp(ink, 0.0, 1.0) * 0.55);
    if (kTee > 0.5 && at < 0.27) rc = cTee;   // a T-shirt under the jersey: its sleeves
    if (kSlv > 0.5 && rgt && at > 0.24 && at < 0.77) rc = cSlv;   // a shooting sleeve, upper arm to wrist
    if (kBic > 0.5 && !rgt && at > 0.30 && at < 0.355) rc = cBic;   // a band round the other bicep
  }
  else if (vRegion < 0.5 && vRB.w > 0.5 && kTee > 0.5 && vK.y > 0.95 && vK.y < 1.392) rc = cTee;
  if (vRegion < 0.5 && vRB.w > 0.5 && kTights > 0.5 && abs(vRB.y) < 0.05 && vK.y < 0.95) rc = vec3(0.006, 0.006, 0.008);   // compression tights: the legs under the shorts, down to the socks   // and its chest and shoulders, where the tank top is cut away
  else if (vRegion < 0.5 && kTat > 0.5 && abs(vK.y - 1.266) < 0.045) {
    float ax1 = abs(vK.x); bool rgt = vK.x < 0.0;
    float ink = 0.0;
    if ((kTat < 1.5 || kTat > 2.5 && kTat < 3.5) && rgt && ax1 > 0.13 && ax1 < 0.165) ink = step(0.5, fract(ax1 * 120.0 + vK.z * 40.0)) * 0.5 + (abs(ax1 - 0.147) < 0.012 ? 0.5 : 0.0);
    if (kTat > 1.5 && kTat < 3.5 && !rgt && ax1 > 0.11 && ax1 < 0.36) ink = max(ink, step(0.55, fract(sin(floor(ax1 * 90.0) * 12.9 + floor((vK.y + vK.z) * 70.0) * 78.2) * 437.5)) * 0.9);
    if (kTat > 3.5 && rgt && ax1 > 0.27 && ax1 < 0.34) ink = step(0.35, fract(ax1 * 60.0 + vK.y * 30.0)) * 0.8;
    rc = mix(rc, vec3(0.06, 0.07, 0.1), clamp(ink, 0.0, 1.0) * 0.55);
  }
  if (vRegion > 2.5 && vRegion < 3.5) {
    /* a sneaker: a swoop down each side in the team's second color, a dark heel tab, a toe cap line */
    float side = abs(abs(vK.x) - 0.0473), yy = vK.y - 0.5, zz = vK.z;
    if (side > 0.026 && abs(yy - 0.036 + zz * 0.22) < 0.0085 && zz > -0.04 && zz < 0.075 && yy < 0.055) rc = cTrim;
    if (yy > 0.074) rc = mix(rc, cTrim, 0.85);   // the collar's top edge
    if (zz < -0.042 && yy > 0.03) rc = vec3(0.08);
    if (zz > 0.068 && zz < 0.073 && yy > 0.018) rc = rc * 0.72;
  }
  /* the cut of the shoe: 1 a high top (the collar comes up over the ankle), 2 two-tone (the toe box in the second
     color), 3 a gum sole */
  if (vRB.w > 0.5 && kShoe > 0.5 && kShoe < 1.5 && vRegion > 3.5 && vRegion < 4.5 && vK.y < 0.615) rc = vK.y > 0.609 ? cTrim : cShoe;
  if (kShoe > 1.5 && kShoe < 2.5 && vRegion > 2.5 && vRegion < 3.5 && vK.z > 0.028 && vK.y - 0.5 > 0.02 && vK.y - 0.5 < 0.052) rc = cTrim;
  if (vRegion > 2.5 && vRegion < 3.5 && vK.y < 0.512) rc = kShoe > 2.5 ? vec3(0.42, 0.24, 0.09) : vec3(0.96);                    // the sole
  else if (vRegion > 2.5 && vRegion < 3.5 && vK.y < 0.522) rc = cTrim;                  // a midsole in the team's second color
  /* socks pulled up to the calf, or cut low at the ankle (the crew sock is the one that is modelled) */
  if (vRB.w > 0.5 && kSock > 0.5 && kSock < 1.5 && vRegion < 0.5 && abs(vRB.y) < 0.05 && vK.y < 0.735) rc = vK.y > 0.722 ? cAlt : cSock;
  if (vRB.w > 0.5 && kSock > 1.5 && vRegion > 3.5 && vRegion < 4.5 && vK.y > 0.575) rc = cSkin;
  if (vRegion > 3.5 && vRegion < 4.5 && vK.y > 0.596 && vK.y < 0.607 && kSock < 0.5) rc = cAlt;           // a stripe at the top of the sock
  /* soft shading painted in: a little darker low on the jersey and shorts and at the torso's sides, so the cloth has
     some form under flat light */
  if (top) rc *= mix(0.86, 1.04, smoothstep(1.0, 1.28, vK.y)) * (1.0 - 0.14 * smoothstep(0.055, 0.095, abs(vK.x)));
  if (bot) rc *= mix(0.84, 1.0, smoothstep(0.86, 0.98, vK.y));
  vec4 diffuseColor = vec4( rc, opacity );`);
    };
    m.customProgramCacheKey = () => 'pb-kit15';
    return m;
  }
  const orphans = [];   // face geometries of players substituted out, freed with the arena
  let lite = false;   // set when a slow phone has had its outlines and bench taken away (see R.render)
  const OUTLINE_MAT = (() => { const m = new T.MeshBasicMaterial({ color: 0x0a0a0d, side: T.BackSide });
    m.onBeforeCompile = sh => { sh.vertexShader = sh.vertexShader.replace('#include <begin_vertex>', 'vec3 transformed = vec3( position ) + normal * 0.011;'); };
    m.customProgramCacheKey = () => 'pb-outline'; m.userData.shared = true; return m; })();
  const MOUTH_MAT = Object.assign(new T.MeshBasicMaterial({ color: 0x2a0d0a }), { userData: { shared: true } });
  const HEAD = 1.22, ABD = 0.16;
  const _ax = V3(), _up = V3(0, 1, 0);
  const LOCO = [['Idle_Loop', 0], ['Walk_Loop', 4.5], ['Jog_Fwd_Loop', 11], ['Sprint_Loop', 18]];
  /* the face as one geometry with vertex colors: two eyes, two pupils, two brows */
  const FACE_MAT = new T.MeshBasicMaterial({ vertexColors: true });
  function faceGeometry(H) {
    const parts = [];
    const add = (g, color, x, y, z, rz) => { g.rotateZ(rz || 0); g.translate(x, y, z); const c = new T.Color(color), n = g.attributes.position.count, col = new Float32Array(n * 3); for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; } g.setAttribute('color', new T.BufferAttribute(col, 3)); parts.push(g.index ? g.toNonIndexed() : g); };
    for (const sx of [-1, 1]) {
      add(new T.SphereGeometry(H * 0.0105, 8, 6), 0xf2efe8, sx * H * 0.019, 0, 0);
      add(new T.SphereGeometry(H * 0.0062, 8, 6), 0x120c08, sx * H * 0.019, -H * 0.001, H * 0.0075);
      add(new T.BoxGeometry(H * 0.024, H * 0.0055, H * 0.005), 0x120c08, sx * H * 0.02, H * 0.0165, H * 0.003, -sx * 0.12);
    }
    add(new T.BoxGeometry(H * 0.022, H * 0.0035, H * 0.004), 0x3a1d14, 0, -H * 0.03, H * 0.002);         // the mouth
    const nose = new T.ConeGeometry(H * 0.006, H * 0.014, 5); nose.rotateX(Math.PI / 2); add(nose, 0x2a1810, 0, -H * 0.012, H * 0.008);   // the nose
    let n = 0; for (const g of parts) n += g.attributes.position.count;
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3); let o = 0;
    for (const g of parts) { pos.set(g.attributes.position.array, o * 3); col.set(g.attributes.color.array, o * 3); o += g.attributes.position.count; }
    const out = new T.BufferGeometry(); out.setAttribute('position', new T.BufferAttribute(pos, 3)); out.setAttribute('color', new T.BufferAttribute(col, 3));
    return out;
  }
  /* The drawn head, pocket style: a round head a touch taller than wide, ears, a nose, and a face fitted to its surface.
     Everything in the head's own frame (+z out of the face, +y up), in units of R, the head's half width. */
  const HS = { x: 1, y: 1.12, z: 1.02 };
  const surfZ = (R, x, y) => HS.z * R * Math.sqrt(Math.max(0, 1 - (x / (HS.x * R)) ** 2 - (y / (HS.y * R)) ** 2));
  const SKIN_MATS = [];
  const skinMat = i => SKIN_MATS[i] || (SKIN_MATS[i] = Object.assign(new T.MeshLambertMaterial({ color: new T.Color(PB.SKIN[i] || PB.SKIN[3]) }), { userData: { shared: true } }));
  /* hair that hugs the head: a cap cut at a slant (higher at the brow than at the neck), every point pushed out onto an
     ellipsoid k times the head, so it never dips under the scalp. Shared by everyone with the same cut. */
  const CAPS = {};
  function capGeo(k, theta, tilt, R) {
    const key = [k, theta, tilt].join();
    if (CAPS[key]) return CAPS[key];
    const g = new T.SphereGeometry(1, 28, 16, 0, Math.PI * 2, 0, theta); g.rotateX(tilt);
    const p = g.attributes.position, v = V3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).normalize();
      const f = 1 / Math.sqrt((v.x / HS.x) ** 2 + (v.y / HS.y) ** 2 + (v.z / HS.z) ** 2);
      v.multiplyScalar(f * k * R); p.setXYZ(i, v.x, v.y, v.z);
    }
    g.computeVertexNormals(); g.userData.shared = true;
    return (CAPS[key] = g);
  }
  /* hair with a real hairline: a shell over the head whose edge follows the line a barber cuts (straight across the
     forehead, square at the temples, up and over the ears, down to the nape). th0 is how far down from the crown the
     front edge sits, in radians; deeper cuts come lower. Shared per style. */
  /* other cuts: a fade (high and tight on the sides), long (down to the jaw at the sides and the neck at the back) */
  const HAIRLINES = {
    fade: th0 => [[0, th0], [0.5, th0 + 0.04], [0.72, th0 + 0.12], [1.0, 1.08], [1.6, 1.12], [2.4, 1.3], [Math.PI, 1.35]],
    long: th0 => [[0, th0], [0.45, th0 + 0.05], [0.7, 1.35], [1.0, 1.95], [1.6, 2.3], [2.4, 2.55], [Math.PI, 2.6]],
  };
  function hairGeo(k, th0, R, cut) {
    const key = 'h' + [k, th0, cut || ''].join();
    if (CAPS[key]) return CAPS[key];
    const NU = 48, NV = 10, pos = [], idx = [];
    const L = cut ? HAIRLINES[cut](th0) : [[0, th0], [0.5, th0 + 0.04], [0.72, th0 + 0.3], [0.95, 1.3], [1.25, 1.34], [1.6, 1.55], [2.2, 1.95], [Math.PI, 2.05]];
    const tmax = a => { a = Math.abs(a); for (let i = 1; i < L.length; i++) if (a <= L[i][0]) { const [a0, t0] = L[i - 1], [a1, t1] = L[i], f = (a - a0) / (a1 - a0), e = f * f * (3 - 2 * f); return t0 + (t1 - t0) * e; } return L[L.length - 1][1]; };
    for (let i = 0; i <= NU; i++) {
      const ph = i / NU * Math.PI * 2 - Math.PI, tm = tmax(ph);
      for (let j = 0; j <= NV; j++) {
        const th = j / NV * tm, x = Math.sin(th) * Math.sin(ph), y = Math.cos(th), z = Math.sin(th) * Math.cos(ph);
        const f = 1 / Math.sqrt((x / HS.x) ** 2 + (y / HS.y) ** 2 + (z / HS.z) ** 2) * k * R;
        pos.push(x * f, y * f, z * f);
      }
    }
    for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) { const a = i * (NV + 1) + j, b = a + NV + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx);
    g.computeVertexNormals(); g.userData.shared = true;
    return (CAPS[key] = g);
  }
  const jawLo = yn => Math.max(0, -yn) * Math.max(0, 1 + yn * 0.3);   // how much fuller the jaw is at this height (y over the head's half height)
  /* faces: eye size, how far the lids come down, brow weight and angle, nose size; one geometry each, shared */
  const FACES = [
    { eye: 1, lid: 0.8, brow: 0.085, tilt: 0.05, nose: 1 },
    { eye: 0.88, lid: 0.95, brow: 0.11, tilt: 0.16, nose: 1.15 },    // focused, heavy brows
    { eye: 1.08, lid: 0.62, brow: 0.07, tilt: 0.03, nose: 0.9 },    // bright-eyed
    { eye: 0.95, lid: 1.05, brow: 0.095, tilt: 0.0, nose: 1.25 },    // calm, a bigger nose
    { eye: 1.0, lid: 0.75, brow: 0.12, tilt: 0.1, nose: 0.95 },      // thick brows
  ];
  function headGeometries(R, F) {
    F = F || FACES[0];
    const merge = (parts, colored) => {
      let n = 0; for (const g of parts) n += g.attributes.position.count;
      const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = colored ? new Float32Array(n * 3) : null; let o = 0;
      for (const g of parts) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); if (col) col.set(g.attributes.color.array, o * 3); o += g.attributes.position.count; }
      const out = new T.BufferGeometry(); out.setAttribute('position', new T.BufferAttribute(pos, 3)); out.setAttribute('normal', new T.BufferAttribute(nor, 3));
      if (col) out.setAttribute('color', new T.BufferAttribute(col, 3));
      out.userData.shared = true; return out;
    };
    const prep = (g, sx, sy, sz, x, y, z, rz, color) => {
      g = g.index ? g.toNonIndexed() : g; g.scale(sx, sy, sz); if (rz) g.rotateZ(rz); g.translate(x, y, z);
      if (color != null) { const c = new T.Color(color), n = g.attributes.position.count, col = new Float32Array(n * 3); for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; } g.setAttribute('color', new T.BufferAttribute(col, 3)); }
      return g;
    };
    const skin = [
      /* one smooth head, a little fuller at the cheeks and jaw than an egg (no second sphere, so no seam) */
      (() => { const g = new T.SphereGeometry(R, 28, 20); g.scale(HS.x, HS.y, HS.z); const p = g.attributes.position;
        for (let i = 0; i < p.count; i++) { const y = p.getY(i) / (HS.y * R), z = p.getZ(i), lo = jawLo(y);
          p.setX(i, p.getX(i) * (1 + 0.1 * lo)); p.setZ(i, z * (1 + (z > 0 ? 0.1 : 0) * lo)); }
        g.computeVertexNormals(); return prep(g, 1, 1, 1, 0, 0, 0); })(),
      prep(new T.SphereGeometry(R * 0.13 * F.nose, 10, 8), 0.85, 0.95, 0.9, 0, -R * 0.2, surfZ(R, 0, -R * 0.2) + R * 0.03 * F.nose),   // the nose
    ];
    for (const sx of [-1, 1]) skin.push(prep(new T.SphereGeometry(R * 0.24, 10, 8), 0.42, 1, 0.75, sx * HS.x * R * 0.98, -R * 0.08, -R * 0.04));   // ears
    /* upper lids over the top of each eye: a calmer, cooler look than a full round eye */
    for (const sx of [-1, 1]) { const ex = sx * R * 0.37, ey = R * 0.02, ez = surfZ(R, ex, ey);
      const lid = new T.SphereGeometry(R * 0.215 * F.eye, 14, 8, 0, Math.PI * 2, 0, F.lid); lid.rotateX(0.2); lid.rotateZ(-sx * 0.12);
      skin.push(prep(lid, 1, 1.08, 0.62, ex, ey + R * 0.005, ez - R * 0.02)); }
    const face = [];
    for (const sx of [-1, 1]) {
      const ex = sx * R * 0.37, ey = R * 0.02, ez = surfZ(R, ex, ey);
      face.push(prep(new T.SphereGeometry(R * 0.2 * F.eye, 12, 10), 1, 1.08, 0.55, ex, ey, ez - R * 0.02, 0, 0xf4f1ea));
      face.push(prep(new T.SphereGeometry(R * 0.115 * F.eye, 10, 8), 1, 1.1, 0.5, ex + sx * -R * 0.01, ey - R * 0.015, ez + R * 0.075, 0, 0x120c08));
      face.push(prep(new T.SphereGeometry(R * 0.035, 6, 5), 1, 1, 0.5, ex + sx * -R * 0.045, ey + R * 0.03, ez + R * 0.115, 0, 0xffffff));   // a glint
      const by = R * (0.27 + 0.03 * F.eye); face.push(prep(new T.BoxGeometry(R * 0.38, R * F.brow, R * 0.08), 1, 1, 1, sx * R * 0.37, by, surfZ(R, sx * R * 0.37, by) + R * 0.0, sx * F.tilt, 0x120c08));
    }
    const my = -R * 0.5;
    /* a slight smile: a short arc, lower in the middle */
    const sm = new T.TorusGeometry(R * 0.32, R * 0.045, 5, 12, 0.95); sm.rotateZ(-Math.PI / 2 - 0.475);
    { const yy = my + R * 0.16; face.push(prep(sm, 1, 0.55, 1, 0, yy, surfZ(R, 0, yy) * (1 + 0.1 * jawLo(yy / (HS.y * R))) - R * 0.005, 0, 0x4a2219)); }
    /* closed lids for a blink: shown for a moment every few seconds */
    const blink = [];
    for (const sx of [-1, 1]) { const ex = sx * R * 0.37, ey = R * 0.02, ez = surfZ(R, ex, ey); blink.push(prep(new T.SphereGeometry(R * 0.215 * F.eye, 12, 8), 1, 1.1, 0.82, ex, ey, ez + R * 0.01)); }
    return { skin: merge(skin, false), face: merge(face, true), blink: merge(blink, false) };
  }
    const HAIRS = ['short', 'short', 'high', 'afro', 'buzz', 'bald', 'buzz', 'short', 'twists', 'short', 'fade', 'fade', 'cornrows', 'bun', 'locs', 'fade', 'mohawk', 'curly', 'curly', 'ponytail', 'long', 'braids', 'spiky'];
  const HAIRC = ['#17110d', '#17110d', '#2b1d12', '#17110d', '#4a3020', '#c9a46a', '#17110d', '#6b4a2b'];
  function autoLook(d) {
    let h = 0; const id = String(d.id || d.last || 'x'); for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    const sk = d.skin == null ? 3 : d.skin;
    let hair = HAIRS[h % HAIRS.length], hairColor = HAIRC[(h >> 3) % HAIRC.length];
    if (sk >= 3 && hairColor !== '#17110d' && hairColor !== '#2b1d12') hairColor = '#17110d';   /* blond and light brown on fair skin only */
    if (sk <= 1 && (hair === 'afro' || hair === 'twists' || hair === 'cornrows' || hair === 'locs')) hair = 'short';
    if (sk >= 4 && (hair === 'long' || hair === 'ponytail' || hair === 'spiky')) hair = 'curly';
    if (sk <= 1 && hair === 'braids') hair = 'spiky';
    if (d.org === 'jp' || d.org === 'gr' || d.org === 'es') hairColor = (h >> 5) % 3 ? '#17110d' : '#2b1d12';
    const big = d.pos === 'C' || d.pos === 'PF', bd = (h >> 4) % 8;   // builds: bigs run strong, guards run slim, most are regular
    return { build: big ? [null, null, 'strong', 'strong', 'big', null, 'strong', 'slim'][bd] : [null, null, null, 'slim', 'slim', null, 'strong', null][bd], hair, hairColor, band: (h >> 6) % 7 === 0 ? '#f2f2f2' : null, sleeve: (h >> 9) % 6 === 0 ? '#111111' : null, shoe: null,
      beard: [null, null, null, 'full', 'stubble', 'goatee', null, null, 'mustache', 'chinstrap', null][(h >> 12) % 11],
      wrist: [null, null, null, '#f2f2f2', null, '#111111', null][(h >> 15) % 7], legs: [null, null, null, null, 'one', null, 'pads', null, 'both', null][(h >> 18) % 10], tat: [0, 0, 0, 1, 0, 2, 0, 3, 0, 4, 0][(h >> 21) % 11], face: (h >> 24) % 8, goggles: (h >> 27) % 23 === 0 ? 'black' : null, tee: (h >> 13) % 11 === 0 ? ((h >> 7) % 2 ? '#f2f2f2' : '#111111') : null, socks: [null, null, null, 'high', null, 'low', null][(h >> 5) % 7], shoeStyle: [0, 0, 1, 2, 0, 3, 1, 0][(h >> 10) % 8], bicep: (h >> 16) % 13 === 0 ? '#f2f2f2' : null };
  }
  function skinnedPlayer(p, kit) {
    const A = window.THREE_ADDONS;
    const root = new T.Group(), body = A.SkeletonUtils.clone(TPL.scene);
    const sc = (p.ht || 78) / 12 / (TPL.Hs || TPL.H);
    /* builds: bigs carry more width, guards less */
    const bld = ((p.d || p).look || {}).build, wide = ({ PG: 0.95, SG: 0.97, SF: 1.0, PF: 1.06, C: 1.11 }[(p.d || p).pos] || 1) * (TPL.model && !PB.mannequin ? 1.06 : 1) * (bld === 'slim' ? 0.92 : bld === 'strong' ? 1.1 : bld === 'big' ? 1.2 : 1);   // the model is tall and lean: a little more of him at game size
    body.scale.set(sc * wide, sc, sc * wide);
    root.add(body);
    const d = p.d || p;
    const shorts = kit.shorts || new T.Color(kit.c1).multiplyScalar(0.9).getStyle();
    const lk = d.look || autoLook(d);
    const mat = kitMaterial({ skin: PB.SKIN[d.skin || 0], jersey: kit.c1, shorts, shoe: lk.shoe || kit.shoe || '#f2f2f2', sock: kit.sock || '#f7f7f7', trim: kit.c2, alt: kit.alt || kit.c2, pat: kit.pat || 0, tat: +lk.tat || 0, ref: kit.ref === true ? 1 : +kit.ref || 0, tee: lk.tee === 'team' ? kit.c2 : lk.tee || null, tights: lk.legs === 'tights', socks: lk.socks || null, shoeStyle: +lk.shoeStyle || 0, bicep: lk.bicep === 'team' ? kit.c2 : lk.bicep || null, sleeve: TPL.model && !PB.mannequin && !PB.oldBody ? lk.sleeve : null });
    const bones = {};
    body.traverse(o => { if (o.isSkinnedMesh) { o.material = mat; o.frustumCulled = false; } if (o.isBone) bones[bk(o.name)] = o; });
    /* the shorts over the legs: the shorts' color, a side stripe in the design color, a hem in the trim color */
    let faceM = null;   // the model's face and hair mesh, for the blink
    if (TPL.shortsGeo) {
      const cs = [new T.Color(shorts), new T.Color(kit.alt || kit.c2), new T.Color(kit.c2)];
      const sm = new T.MeshLambertMaterial({ vertexColors: true, side: T.DoubleSide });
      const paint = g => { g = g.clone(); const kc = g.attributes.kc, col = new Float32Array(kc.count * 3); for (let i = 0; i < kc.count; i++) { const c = cs[kc.getX(i)]; col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; } g.setAttribute('color', new T.BufferAttribute(col, 3)); return g; };
      let bodyMesh = null; body.traverse(o => { if (o.isSkinnedMesh && !bodyMesh) bodyMesh = o; });
      /* the simple body in place of the mannequin's */
      if (bodyMesh && TPL.simpleGeo && !PB.mannequin) {
        body.traverse(o => { if (o.isSkinnedMesh && o !== bodyMesh) o.visible = false; });
        const sb = new T.SkinnedMesh(TPL.simpleGeo, mat); sb.frustumCulled = false; bodyMesh.parent.add(sb);
        sb.position.copy(bodyMesh.position); sb.quaternion.copy(bodyMesh.quaternion); sb.scale.copy(bodyMesh.scale); sb.bind(bodyMesh.skeleton, bodyMesh.bindMatrix);
        bodyMesh.visible = false;
        /* a thin dark outline (the inside of a slightly fatter copy): players read clearly against the floor */
        if (!(PB.settings && PB.settings.gfx === 'Low')) { const ol = new T.SkinnedMesh(TPL.simpleGeo, OUTLINE_MAT); ol.frustumCulled = false; ol.visible = !lite; bodyMesh.parent.add(ol);
          ol.position.copy(bodyMesh.position); ol.quaternion.copy(bodyMesh.quaternion); ol.scale.copy(bodyMesh.scale); ol.bind(bodyMesh.skeleton, bodyMesh.bindMatrix); }
      }
      if (bodyMesh && TPL.model && TPL.faceGeo && !PB.mannequin) {
        /* the model's hair, beard, face, headband and goggles: the parts this player's look asks for, in his colors */
        const dd = p.d || p, lk = dd.look || autoLook(dd), F0 = TPL.faceGeo, tv = F0.userData.tv;
        const HV = { short: 1, buzz: 2, high: 3, afro: 4, twists: 5, fade: 6, cornrows: 7, bun: 8, mohawk: 9, locs: 10, curly: 14, ponytail: 15, long: 22, spiky: 34, braids: 35 }, BV = { stubble: 11, goatee: 12, full: 13, mustache: 32, chinstrap: 33 };
        const fN = +lk.face || 0, eyeV = fN < 5 ? 16 + fN : 31 + fN, mouthV = fN < 5 ? 26 + fN : 41 + fN;   // faces 0 to 4, then 5 on (parts 36 and up)
        const base = [HV[lk.hair] || 0, lk.hair === 'cornrows' ? 21 : 0, BV[lk.beard] || 0, mouthV, lk.band ? 24 : 0, lk.goggles ? 25 : 0].filter(Boolean);
        const setOf = want => { const key = want.join(','); let ixs = F0.userData.sets[key];
          if (!ixs) { const src = F0.index.array, out = []; for (let t = 0; t < tv.length; t++) if (want.includes(tv[t])) out.push(src[t * 3], src[t * 3 + 1], src[t * 3 + 2]); ixs = F0.userData.sets[key] = F0.attributes.position.count > 65535 ? new T.Uint32BufferAttribute(out, 1) : new T.Uint16BufferAttribute(out, 1); }
          return ixs; };
        let ixs = setOf(base.concat(eyeV)); const shutIx = setOf(base.concat(31));   // eyes open, and shut for a blink
        const fg = new T.BufferGeometry(); for (const a of ['position', 'normal', 'skinIndex', 'skinWeight']) fg.setAttribute(a, F0.attributes[a]); fg.setIndex(ixs); fg.userData.own = true;
        const team = kit.c1, pick = v => v === 'team' ? team : v, hairC = new T.Color(lk.hairColor || '#17110d'), skinC = new T.Color(PB.SKIN[dd.skin == null ? 3 : dd.skin] || '#8d5a3b');
        const cOf = { 2: hairC.clone().lerp(skinC, 0.32), 7: hairC.clone().lerp(skinC, 0.5), 11: hairC.clone().lerp(skinC, 0.55), 24: new T.Color(pick(lk.band) || '#f2f2f2'), 25: new T.Color(lk.goggles === 'team' ? team : /^#/.test(lk.goggles || '') ? lk.goggles : '#141414') }, white = new T.Color('#f4f4f4'), dark = new T.Color('#141011');
        /* a color a vertex: by the part it belongs to (its triangles' variant), else by its layer */
        const kc = F0.attributes.kc, vv = new Uint8Array(kc.count), src = F0.index.array; for (let t = 0; t < tv.length; t++) { vv[src[t * 3]] = tv[t]; vv[src[t * 3 + 1]] = tv[t]; vv[src[t * 3 + 2]] = tv[t]; }
        const cl = new Float32Array(kc.count * 3);
        for (let i = 0; i < kc.count; i++) { const r = kc.getX(i), c = cOf[vv[i]] || (r < 0.5 ? hairC : r < 1.5 ? white : dark); cl[i * 3] = c.r; cl[i * 3 + 1] = c.g; cl[i * 3 + 2] = c.b; }
        fg.setAttribute('color', new T.BufferAttribute(cl, 3));
        const fm = new T.SkinnedMesh(fg, new T.MeshLambertMaterial({ vertexColors: true })); fm.frustumCulled = false; bodyMesh.parent.add(fm); faceM = fm; fm.userData.open = ixs; fm.userData.shut = shutIx; fm.userData.yell = setOf(base.concat(eyeV, 23));
        /* how he feels shows on his face: a grin, a scowl, heavy eyes (the happy, stern and sleepy faces, worn for a moment) */
        { const rest = base.filter(v => v !== mouthV); fm.userData.happy = setOf(rest.concat(46, 36)); fm.userData.stern = setOf(rest.concat(47, 37)); fm.userData.tired = setOf(rest.concat(48, 38)); }
        fm.position.copy(bodyMesh.position); fm.quaternion.copy(bodyMesh.quaternion); fm.scale.copy(bodyMesh.scale); fm.bind(bodyMesh.skeleton, bodyMesh.bindMatrix); }
      if (bodyMesh && !(TPL.model && !PB.mannequin)) { const ms = new T.SkinnedMesh(paint(TPL.shortsGeo), sm); ms.frustumCulled = false; bodyMesh.parent.add(ms); ms.position.copy(bodyMesh.position); ms.quaternion.copy(bodyMesh.quaternion); ms.scale.copy(bodyMesh.scale); if (ms.isSkinnedMesh) ms.bind(bodyMesh.skeleton, bodyMesh.bindMatrix); }
    }
    /* the number on the back and front, and hair */
    /* lettering that reads on any design: on a dark jersey the numbers are white (or a light second color) edged in
       the team color; on a light one they are the team color */
    const lum = c => { const n = parseInt(String(c).slice(1), 16); return (n >> 16) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11; };
    const jl = lum(kit.c1) > 170, ink = jl ? kit.c2 : lum(kit.c2) > 150 ? kit.c2 : '#ffffff', edge = jl ? null : (lum(kit.alt || kit.c2) < 120 ? kit.alt || kit.c2 : '#0c0c0e');
    const tex = numberTex(p.num, null, ink, edge);
    const numMat = new T.MeshLambertMaterial({ map: tex, transparent: true, alphaTest: 0.4, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    const H = TPL.H;
    const put = (bone, dcl, obj) => { obj.position.copy(dcl.pos); obj.quaternion.copy(dcl.quat); bone.add(obj); };
    put(bones[bk('DEF-spine.003')], TPL.decals.back, new T.Mesh(new T.PlaneGeometry(H * 0.13, H * 0.13), numMat));
    put(bones[bk('DEF-spine.003')], TPL.decals.front, new T.Mesh(new T.PlaneGeometry(H * 0.08, H * 0.08), numMat));
    if (TPL.decals.shorts && !(TPL.model && !PB.mannequin)) put(bones[bk('DEF-thigh.L')], TPL.decals.shorts, new T.Mesh(new T.PlaneGeometry(H * 0.045, H * 0.045), numMat));
    /* the team's name across the chest, over the number */
    const wm = new T.Mesh(new T.PlaneGeometry(H * 0.15, H * 0.04), new T.MeshLambertMaterial({ map: wordTex(kit.name || '', ink, edge), transparent: true, alphaTest: 0.35, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    /* and his name across the back, over the number */
    if (TPL.decals.nameBack && d.last) put(bones[bk('DEF-spine.003')], TPL.decals.nameBack, new T.Mesh(new T.PlaneGeometry(H * 0.12, H * 0.032), new T.MeshLambertMaterial({ map: wordTex(d.last, ink, edge), transparent: true, alphaTest: 0.35, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 })));
    put(bones[bk('DEF-spine.003')], TPL.decals.chest, wm);
    /* the look: hair (style and color), a headband, an arm sleeve; yours from the Look card, everyone else's picked
       once from his id so the floor is not ten identical heads */
    const look = d.look || autoLook(d);
    const hairMat = new T.MeshLambertMaterial({ color: new T.Color(look.hairColor || '#17110d') });
    const head = bones[bk('DEF-head')];
    /* the head: drawn, not the mannequin's (pocket style: round, big eyes), one skin material per tone, shared */
    const R = TPL.headR;
    const fi = (d.look && d.look.face != null ? +d.look.face : look.face || 0) % FACES.length; TPL.headGeos = TPL.headGeos || [];
    const HG = TPL.headGeos[fi] || (TPL.headGeos[fi] = headGeometries(R, FACES[fi]));
    const hg = new T.Group(); put(head, TPL.decals.headC, hg); hg.userData.faceM = faceM; if (TPL.model && !PB.mannequin) hg.visible = false;   // the model has its own head
    hg.add(new T.Mesh(HG.skin, skinMat(d.skin || 0)));
    hg.add(new T.Mesh(HG.face, FACE_MAT));
    { const bl = new T.Mesh(HG.blink, skinMat(d.skin || 0)); bl.visible = false; hg.add(bl); hg.userData.blink = bl; hg.userData.bph = Math.random() * 4; }
    /* an open mouth for a yell after a big play (hidden until then) */
    if (!TPL.mouthGeo) { const yy = -R * 0.5; TPL.mouthGeo = new T.SphereGeometry(R * 0.21, 14, 10); TPL.mouthGeo.scale(1.05, 1, 0.4); TPL.mouthGeo.translate(0, yy, surfZ(R, 0, yy) * (1 + 0.1 * jawLo(yy / (HS.y * R))) - R * 0.03); TPL.mouthGeo.userData.shared = true; }
    const yell = new T.Mesh(TPL.mouthGeo, MOUTH_MAT); yell.visible = false; hg.add(yell); hg.userData.yell = yell;
    const cap = (r, theta, tilt, y) => { const m = new T.Mesh(capGeo(r / R, theta, tilt, R), hairMat); m.position.y = y || 0; return m; };
    const hair = (k, th0, y, cut, mat) => { const m = new T.Mesh(hairGeo(k, th0, R, cut), mat || hairMat); m.position.y = y || 0; return m; };
    /* a faded side: the full hairline, faint */
    const fadeMat = () => new T.MeshLambertMaterial({ color: hairMat.color, transparent: true, opacity: 0.45, depthWrite: false });
    /* a raised row over the head from the hairline to the nape, x across (in R) */
    const row = (x, r, mat) => { const pts = []; for (let i = 0; i <= 14; i++) { const u = 0.95 - i / 14 * 2.95, q = Math.sqrt(Math.max(0.05, 1 - x * x));
      const v = V3(x, Math.cos(u) * q, Math.sin(u) * q), f = 1 / Math.sqrt((v.x / HS.x) ** 2 + (v.y / HS.y) ** 2 + (v.z / HS.z) ** 2) * 1.035 * R; pts.push(v.multiplyScalar(f)); }
      return new T.Mesh(new T.TubeGeometry(new T.CatmullRomCurve3(pts), 24, r, 6, false), mat || hairMat); };
    if (look.hair === 'short') hg.add(hair(1.07, 0.95, R * 0.02));
    else if (look.hair === 'buzz') hg.add(hair(1.03, 1.0, 0));
    else if (look.hair === 'fade') { hg.add(hair(1.075, 0.92, R * 0.03, 'fade')); hg.add(hair(1.02, 1.0, 0, null, fadeMat())); }
    else if (look.hair === 'cornrows') { hg.add(hair(1.02, 0.98, 0)); for (const x of [-0.6, -0.3, 0, 0.3, 0.6]) hg.add(row(x, R * 0.075)); }
    else if (look.hair === 'bun') { hg.add(hair(1.05, 0.95, R * 0.02)); const bn = new T.Mesh(new T.SphereGeometry(R * 0.34, 14, 10), hairMat); bn.position.set(0, R * 0.85, -R * 0.62); hg.add(bn); }
    else if (look.hair === 'mohawk') { hg.add(hair(1.02, 1.0, 0, 'fade', fadeMat())); const mh = new T.Mesh(new T.SphereGeometry(R, 20, 14), hairMat); mh.scale.set(0.2, 0.42, 1.0); mh.position.set(0, R * 0.92, -R * 0.12); hg.add(mh); }
    else if (look.hair === 'locs') { hg.add(hair(1.08, 0.95, R * 0.03, 'long')); for (let i = 0; i < 15; i++) { const a = -1.75 + i / 14 * 3.5, x = Math.sin(a) * R * 1.02, z = -Math.cos(a) * R * 0.98;
        const t = new T.Mesh(new T.CylinderGeometry(R * 0.085, R * 0.07, R * 0.9, 6), hairMat); t.position.set(x * 1.02, -R * 0.55, z * 1.02 - R * 0.05); t.rotation.z = -x / R * 0.12; hg.add(t); } }
    else if (look.hair === 'high') {
      hg.add(hair(1.05, 0.95, R * 0.02));
      const top = new T.Mesh(new T.LatheGeometry([[0, R * 0.32], [R * 0.72, R * 0.32], [R * 0.86, R * 0.26], [R * 0.93, R * 0.12], [R * 0.95, -R * 0.31]].map(([x, y]) => new T.Vector2(x, y)), 24), hairMat); top.position.set(0, R * 1.0, -R * 0.08); top.rotation.x = -0.12; hg.add(top);
    } else if (look.hair === 'afro') {
      const af = new T.Mesh(new T.SphereGeometry(R * 1.36, 20, 14), hairMat); af.scale.set(1.06, 0.95, 1); af.position.set(0, R * 0.42, -R * 0.32); hg.add(af);
    } else if (look.hair === 'twists') {
      hg.add(hair(1.04, 0.95, R * 0.02));
      for (let i = 0; i < 26; i++) { const a = i * 2.39996, rr = Math.sqrt((i + 0.5) / 26), th = rr * 1.25, x = Math.sin(th) * Math.cos(a), z = Math.sin(th) * Math.sin(a), y = Math.cos(th);
        if (z > 0.55 && y < 0.6) continue;   // not over the face
        const t = new T.Mesh(new T.CylinderGeometry(R * 0.085, R * 0.11, R * 0.42, 6), hairMat); t.position.set(x * R * 1.04 * HS.x, y * R * 1.06 * HS.y + R * 0.06, z * R * 1.0 * HS.z - R * 0.12); t.quaternion.setFromUnitVectors(V3(0, 1, 0), V3(x, y, z).normalize()); hg.add(t); }
    }
    /* sports goggles: two lenses on a strap round the head */
    if (look.goggles) {
      const fr = new T.MeshLambertMaterial({ color: new T.Color(look.goggles === 'team' ? kit.c1 : String(look.goggles)[0] === '#' ? look.goggles : '#141416') }), ln = new T.MeshBasicMaterial({ color: 0xbfe6ff, transparent: true, opacity: 0.28, depthWrite: false });
      for (const sx of [-1, 1]) { const ex = sx * R * 0.37, ey = R * 0.03, ez = surfZ(R, ex, ey) + R * 0.06;
        const rim = new T.Mesh(new T.TorusGeometry(R * 0.25, R * 0.045, 6, 18), fr); rim.position.set(ex, ey, ez); rim.rotation.y = sx * 0.25; hg.add(rim);
        const lens = new T.Mesh(new T.CircleGeometry(R * 0.24, 18), ln); lens.position.set(ex, ey, ez + R * 0.01); lens.rotation.y = sx * 0.25; hg.add(lens); }
      const strap = new T.Mesh(new T.TorusGeometry(R * 1.03, R * 0.05, 5, 30), fr); strap.scale.set(HS.x, HS.z, 1); strap.rotation.x = Math.PI / 2; strap.position.y = R * 0.04; hg.add(strap);
    }
    if (look.band) {
      const band = new T.Mesh(new T.TorusGeometry(R * 0.97, R * 0.1, 6, 26), new T.MeshLambertMaterial({ color: new T.Color(look.band) }));
      band.scale.set(HS.x, HS.z, 1); band.rotation.x = Math.PI / 2 - 0.3; band.position.set(0, R * 0.42, -R * 0.02); hg.add(band);
    }
    /* facial hair: a full beard along the jaw with a mustache, stubble is the same but faint, a goatee on the chin */
    if (look.beard) {
      const bm = new T.MeshLambertMaterial({ color: new T.Color(look.hairColor || '#17110d'), transparent: look.beard === 'stubble', opacity: look.beard === 'stubble' ? 0.5 : 1 });
      /* a shell on the face itself (the same jaw as the head), k a little out from the skin: from angle -W to W round
         the face (0 the front), between top(a) and the bottom of the chin, in the head's own height units */
      const shell = (k, W, top, bot) => {
        const NU = 30, NV = 10, pos = [], idx = [];
        for (let i = 0; i <= NU; i++) { const a = -W + 2 * W * i / NU, t = top(a);
          for (let j = 0; j <= NV; j++) { const yn = t + (bot - t) * j / NV, r = Math.sqrt(Math.max(0, 1 - yn * yn)), lo = jawLo(yn);
            const z = Math.cos(a) * r * HS.z * R;
            pos.push(Math.sin(a) * r * HS.x * R * (1 + 0.1 * lo) * k, yn * HS.y * R * k, z * (1 + (z > 0 ? 0.1 : 0) * lo) * k); } }
        for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) { const a = i * (NV + 1) + j, b = a + NV + 1; idx.push(a, a + 1, b, b, a + 1, b + 1); }
        const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
        return new T.Mesh(g, bm);
      };
      const muY = -R * 0.36, mu = new T.Mesh(new T.CapsuleGeometry(R * 0.045, R * 0.3, 3, 8), bm); mu.rotation.z = Math.PI / 2;
      mu.position.set(0, muY, surfZ(R, 0, muY) * (1 + 0.1 * jawLo(muY / (HS.y * R))) + R * 0.01);
      if (look.beard === 'goatee') { hg.add(shell(1.03, 0.42, () => -0.66, -0.97)); hg.add(mu); }
      else {
        /* the full beard: up the jaw to the sideburns, under the mouth in front */
        hg.add(shell(1.035, 1.62, a => { const f = Math.min(1, Math.abs(a) / 1.25); return -0.62 + (0.12 + 0.62) * f * f; }, -0.99));
        hg.add(mu);
      }
    }
    if (look.sleeve && !(TPL.model && !PB.mannequin && !PB.oldBody)) {
      const fore = bones[bk('DEF-forearm.R')], hand = bones[bk('DEF-hand.R')];
      const len = hand.position.length();
      const sl = new T.Mesh(new T.CylinderGeometry(H * 0.033, H * 0.027, len * 0.8, 10), new T.MeshLambertMaterial({ color: new T.Color(look.sleeve) }));
      const g3 = new T.Group(); g3.add(sl); sl.position.y = len * 0.42;
      g3.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), hand.position.clone().normalize());
      fore.add(g3);
    }
    /* wristbands on both wrists, leg sleeves from the knee down, or knee pads */
    const limb = (b0, b1, r0, r1, from, to, color) => {
      const a = bones[bk(b0)], e = bones[bk(b1)]; if (!a || !e) return;
      const len = e.position.length(), L = len * (to - from);
      const m = new T.Mesh(new T.CylinderGeometry(r1, r0, L, 12), new T.MeshLambertMaterial({ color: new T.Color(color) }));
      const g = new T.Group(); g.add(m); m.position.y = len * (from + to) / 2;
      g.quaternion.setFromUnitVectors(V3(0, 1, 0), e.position.clone().normalize()); a.add(g);
    };
    if (look.wrist) for (const sd of ['L', 'R']) limb(`DEF-forearm.${sd}`, `DEF-hand.${sd}`, H * 0.032, H * 0.031, 0.8, 0.97, look.wrist);
    if (look.legs === 'one' || look.legs === 'both') for (const sd of look.legs === 'one' ? ['L'] : ['L', 'R']) limb(`DEF-shin.${sd}`, `DEF-foot.${sd}`, H * 0.0405, H * 0.031, 0.02, 0.72, '#111111');
    if (look.legs === 'pads') for (const sd of ['L', 'R']) limb(`DEF-shin.${sd}`, `DEF-foot.${sd}`, H * 0.044, H * 0.042, -0.04, 0.16, '#111111');
    const shadow = new T.Mesh(new T.CircleGeometry(1.1, 16), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.02; root.add(shadow);
    const mixer = new T.AnimationMixer(body), act = {};
    for (const name of ['Idle_Loop', 'Walk_Loop', 'Jog_Fwd_Loop', 'Sprint_Loop', 'Crouch_Idle_Loop', 'Crouch_Fwd_Loop', 'Jump_Loop', 'Dance_Loop']) {
      const c = TPL.clips[name]; if (!c) continue;
      const a = mixer.clipAction(c); a.play(); a.setEffectiveWeight(0); a.time = PB.rand() * c.duration; act[name] = a;
    }
    act.Idle_Loop.setEffectiveWeight(1);
    const arm = s => ({ up: bones[bk(`DEF-upper_arm.${s}`)], fore: bones[bk(`DEF-forearm.${s}`)], hand: bones[bk(`DEF-hand.${s}`)], fing: bones[bk(`DEF-f_middle.01.${s}`)] });
    const headS = TPL.model && !PB.mannequin ? Math.max(0.9, Math.min(1.1, ((78 / 12) / (TPL.Hs || TPL.H)) / sc)) : HEAD;   // the model's head is its own size; a seven-footer's is no bigger than a guard's
    const headB = bones[bk('DEF-head')]; if (headB) headB.scale.setScalar(headS);
    const chest = bones[bk('DEF-spine.002')];
    const idle = { chest, base: new T.Quaternion(), applied: false, still: 0, breath: 0, phase: act.Idle_Loop.time * 3 };
    return { kind: 'skin', idle, headS, root, body, mixer, act, bones, head: headB, hg, R: arm('R'), L: arm('L'), shadow, sc, pw: 0, pose: '', poseW: 0, phase: 0 };
  }

  /* turn a bone so the segment from it to `tip` points along `dir` (world), by `w` of the way */
  const _a = V3(), _b = V3(), _q = Q4(), _qw = Q4(), _qp = Q4();
  function abduct(m, face, k) {
    if (!TPL.simpleGeo || PB.mannequin) return;
    _ax.set(Math.sin(face), 0, Math.cos(face));
    for (const [arm, sd] of [[m.R, 1], [m.L, -1]]) { const b = arm.up; b.getWorldQuaternion(_qw); _q.setFromAxisAngle(_ax, -k * sd * (TPL.sideR < 0 ? 1 : -1)).multiply(_qw); b.parent.getWorldQuaternion(_qp).invert().multiply(_q); b.quaternion.copy(_qp); b.updateMatrixWorld(true); }
  }
  function aim(bone, tip, dir, w) {
    bone.getWorldPosition(_a); tip.getWorldPosition(_b);
    _b.sub(_a).normalize();
    _q.setFromUnitVectors(_b, dir);
    bone.getWorldQuaternion(_qw);
    _q.multiply(_qw);                                  // the world rotation it should have
    bone.parent.getWorldQuaternion(_qp).invert().multiply(_q);
    bone.quaternion.slerp(_qp, w);
    bone.updateMatrixWorld(true);
  }
  const _d = V3();
  /* a direction given in the player's own frame (x to his right, y up, z ahead) into the world */
  function dirOf(face, x, y, z, side) {
    const fx = Math.sin(face), fz = Math.cos(face), rx = -fz, rz = fx;
    return _d.set(rx * x * side + fx * z, y, rz * x * side + fz * z).normalize();
  }
  /* one dribble, twelve steps from the hand's lowest point (the push ends): the upper arm and forearm of the ball hand.
     The upper arm leans a little more forward than the walking subject's, for a player on the move. */
  const DRIB = [
    [[0, -0.97, 0.25], [0.36, -0.9, 0.23]], [[-0.03, -0.99, 0.18], [0.43, -0.89, 0.16]], [[-0.03, -1, 0.08], [0.58, -0.8, 0.18]],
    [[-0.03, -1, -0.02], [0.72, -0.61, 0.3]], [[0, -0.99, -0.07], [0.8, -0.36, 0.38]], [[0.03, -0.99, -0.07], [0.8, -0.02, 0.5]],
    [[0.09, -0.99, -0.04], [0.7, 0.27, 0.62]], [[0.15, -0.99, 0], [0.55, 0.33, 0.77]], [[0.17, -0.98, 0.02], [0.4, 0.15, 0.91]],
    [[0.15, -0.98, 0.08], [0.31, -0.26, 0.91]], [[0.11, -0.97, 0.21], [0.3, -0.61, 0.74]], [[0.05, -0.97, 0.21], [0.37, -0.93, -0.02]],
  ];
  /* each pose: right arm [upper, forearm] and left arm, in the player's frame; x is outward for each arm */
  const POSES = {
    /* the dribbling arm from motion capture (CMU 06_02, two cycles averaged); k is where the bounce is, 0 to 1 */
    dribble: (k) => { const u = (1 + 12 * k) % 12, i = Math.floor(u), f = u - i, a = DRIB[i], b = DRIB[(i + 1) % 12];
      const L = (x, y) => x.map((v, j) => v + (y[j] - v) * f);
      const up = L(a[0], b[0]); up[0] += 0.12;   // a little off the hip: this body is wider than the subject's
      return [up, L(a[1], b[1]), [0.5, -0.62, 0.42], [-0.12, 0.18, 0.95]]; },   // the off arm: a bar in front of him
    /* the jump shot, keyed: the dip (ball at the waist, both hands), up past the chest, the set point (ball over the
       forehead, the elbow under it, the guide hand on the side), the release (the arm goes up and out, the guide hand
       comes off), and the follow-through held. k runs 0 to 1 at the release */
    shoot: (k) => keyed(SHOT, k),
    follow: () => SHOT[SHOT.length - 1][1],
    contest: () => [[0.25, 0.96, 0.15], [0.12, 0.99, 0.05], [0.25, 0.96, 0.15], [0.12, 0.99, 0.05]],
    celebrate: () => [[0.5, 0.86, 0.1], [0.3, 0.95, 0.05], [0.5, 0.86, 0.1], [0.3, 0.95, 0.05]],
    /* celebrations; k is the clock, for the beat of a chest thump or a pump of the fist */
    flex: (k) => { const b = 0.08 * Math.sin(k * 9); return [[0.97, 0.05 + b, 0.15], [0.15, 0.97, 0.2], [0.97, 0.05 + b, 0.15], [0.15, 0.97, 0.2]]; },
    roar: (k) => { const b = 0.1 * Math.sin(k * 7); return [[0.75, -0.55 + b, 0.35], [0.35, 0.3 + b, 0.9], [0.75, -0.55 + b, 0.35], [0.35, 0.3 + b, 0.9]]; },
    thump: (k) => { const b = Math.max(0, Math.sin(k * 10)) * 0.35; return [[0.45, -0.35, 0.82], [-0.85, 0.2, 0.45 + b], [0.75, -0.6, 0.25], [0.3, -0.6, 0.75]]; },
    goggles: () => [[0.6, 0.4, 0.7], [-0.8, 0.55, -0.05], [0.6, 0.4, 0.7], [-0.8, 0.55, -0.05]],   // the three goggles: a hand ringed over each eye, elbows out
    three: (k) => { const b = 0.05 * Math.sin(k * 8); return [[0.3, 0.94 + b, 0.15], [0.12, 0.99, 0.05], [0.2, -0.97, 0.1], [0.15, -0.95, 0.25]]; },
    point: () => [[0.35, 0.75, 0.55], [0.25, 0.8, 0.55], [0.25, -0.9, 0.3], [0.2, -0.6, 0.75]],
    ugh: () => [[0.62, 0.52, 0.42], [-0.72, 0.66, -0.12], [0.62, 0.52, 0.42], [-0.72, 0.66, -0.12]],   // a miss he should have made, a pass thrown away: both hands to the head
    call: (k) => { const b = 0.07 * Math.sin(k * 8); return [[0.28, 0.9, 0.3], [0.12 + b, 0.98, 0.12], [0.35, -0.7, 0.6], [0.0, 0.3, 0.95]]; },   // open: a hand up for the ball, the other ready to catch
    /* more of them: the shrug (palms up), too small (a hand held low and patted down), night night (both hands a pillow by the
       head), the shush (a finger to the lips), ice in the veins (two fingers tapped on the forearm) */
    shrug: (k) => { const b = 0.06 * Math.sin(k * 6); return [[0.55, -0.72 + b, 0.32], [0.86, 0.32 + b, 0.38], [0.55, -0.72 + b, 0.32], [0.86, 0.32 + b, 0.38]]; },
    toosmall: (k) => { const b = 0.12 * Math.sin(k * 9); return [[0.30, -0.55, 0.78], [0.12, -0.52 + b, 0.85], [0.62, -0.72, 0.3], [-0.55, -0.45, 0.7]]; },
    nightnight: () => [[0.55, 0.42, 0.72], [-0.62, 0.72, -0.18], [-0.30, 0.34, 0.89], [-0.25, 0.93, -0.15]],
    shh: () => [[0.28, -0.42, 0.86], [-0.64, 0.74, 0.2], [0.3, -0.93, 0.12], [0.15, -0.9, 0.4]],
    ice: (k) => { const b = Math.max(0, Math.sin(k * 10)) * 0.12; return [[0.32, -0.5, 0.8], [-0.35, 0.12, 0.93], [0.12, -0.52 + b, 0.85], [-0.62, 0.2 - b, 0.76]]; },
    /* the dunk: the ball cocked back behind the head on the way up, then thrown down through the rim; k is the way there */
    dunk1: (k) => { const e = smooth(0.45, 0.8, k), L = (a, b) => a.map((v, j) => v + (b[j] - v) * e);
      return [L([0.2, 0.95, -0.12], [0.12, 0.88, 0.45]), L([0.1, 0.99, 0.02], [0.05, 0.8, 0.6]), L([0.7, 0.1, 0.4], [0.75, -0.35, 0.2]), L([0.4, 0.6, 0.6], [0.6, -0.5, 0.4])]; },
    hang: () => [[0.12, 0.98, 0.12], [0.04, 0.99, 0.12], [0.12, 0.98, 0.12], [0.04, 0.99, 0.12]],   // on the rim
    bpass: () => [[0.22, -0.55, 0.8], [0.05, -0.6, 0.8], [0.22, -0.55, 0.8], [0.05, -0.6, 0.8]],   // a bounce pass, pushed down
    sad: () => [[0.2, -0.75, 0.62], [0.05, -0.85, 0.5], [0.2, -0.75, 0.62], [0.05, -0.85, 0.5]],   // hands on knees
    chestPass: () => [[0.22, -0.12, 0.97], [0.0, 0.02, 1], [0.22, -0.12, 0.97], [0.0, 0.02, 1]],   // a chest pass, arms out
    catch: () => [[0.32, 0.05, 0.94], [0.12, 0.25, 0.96], [0.32, 0.05, 0.94], [0.12, 0.25, 0.96]],   // hands up for the ball
    reach: () => [[0.1, -0.15, 0.98], [0.05, -0.2, 0.98], [0.6, -0.6, 0.4], [0.3, -0.5, 0.8]],
    /* active hands: one up in the ball's face (it mirrors the dribble), the other low and wide in the passing lane */
    guard: (k) => { const b = 0.05 * Math.sin(k * 4.3), c = 0.05 * Math.sin(k * 3.1 + 1);
      return [[0.45, -0.75 + b, 0.48], [0.3, -0.1 + b * 2, 0.95], [0.86, -0.36 + c, 0.36], [0.72, 0.42 + c * 2, 0.55]]; },
    ready: (k) => { const b = 0.03 * Math.sin(k * 2.2); return [[0.42, -0.72 + b, 0.5], [0.12, 0.28 + b, 0.95], [0.42, -0.72 - b, 0.5], [0.12, 0.28 - b, 0.95]]; },   // hands out in front, a target
    box: (k) => { const b = 0.04 * Math.sin(k * 5); return [[0.8, 0.25 + b, 0.45], [0.35, 0.9, 0.25], [0.8, 0.25 - b, 0.45], [0.35, 0.9, 0.25]]; },   // boxing out: wide, hands up for the board
    sig3: () => [[0.25, 0.96, 0.12], [0.1, 0.99, 0.05], [0.25, 0.96, 0.12], [0.1, 0.99, 0.05]],   // the officials: a three is good
    sigf: () => [[0.22, 0.96, 0.14], [0.06, 0.99, 0.08], [0.2, -0.95, 0.2], [0.12, -0.95, 0.28]],   // a foul: the fist goes up
    hold: () => [[0.3, -0.6, 0.6], [-0.35, -0.05, 0.95], [0.3, -0.6, 0.6], [-0.35, -0.05, 0.95]],
    screen: (k) => { const b = 0.02 * Math.sin(k * 3); return [[0.3, -0.8 + b, 0.52], [-0.82, -0.14, 0.55], [0.3, -0.8 - b, 0.52], [-0.82, -0.14, 0.55]]; },   // a screen: forearms crossed low in front, elbows in
    /* the inbounder: the ball over his head in both hands, looking one way and then the other for a man */
    over: (k) => { const s = 0.16 * Math.sin(k * 2.3); return [[0.3 + s, 0.72, 0.5], [-0.3 + s, 0.9, 0.12], [0.3 - s, 0.72, 0.5], [-0.3 - s, 0.9, 0.12]]; },
    /* the windmill: the ball arm goes down, back, over the top and through; k is the time in the air */
    windmill: (k) => { const a = Math.min(1, k * 1.15) * Math.PI * 1.7, d = [0.25, -Math.cos(a), -Math.sin(a)];
      return [d, d, [0.45, 0.5, 0.6], [0.3, 0.7, 0.6]]; },
  };
  const SHOT = [
    [0.00, [[0.26, -0.74, 0.62], [-0.26, 0.10, 0.96], [0.30, -0.70, 0.65], [-0.30, 0.16, 0.94]]],
    [0.38, [[0.20, -0.18, 0.96], [-0.10, 0.86, 0.50], [0.34, -0.14, 0.93], [-0.30, 0.82, 0.48]]],
    [0.76, [[0.12, 0.56, 0.82], [-0.02, 0.97, -0.22], [0.34, 0.50, 0.80], [-0.30, 0.92, 0.10]]],
    [0.89, [[0.09, 0.72, 0.69], [0.01, 0.98, 0.19], [0.34, 0.51, 0.79], [-0.28, 0.93, 0.14]]],
    [1.00, [[0.07, 0.83, 0.55], [0.04, 0.83, 0.56], [0.35, 0.52, 0.79], [-0.25, 0.94, 0.16]]]];
  /* the layup, keyed: the gather (two hands on the ball at the hip on the ball side), carried up past the shoulder,
     the reach (the knee and that elbow go up together), the release at full stretch off the fingers; the off arm
     comes off the ball and bars the defender */
  const LAYUP = [
    [0.00, [[0.30, -0.80, 0.50], [-0.10, -0.10, 0.99], [0.20, -0.75, 0.62], [-0.50, 0.00, 0.86]]],
    [0.40, [[0.30, -0.10, 0.95], [0.00, 0.80, 0.60], [0.30, -0.20, 0.93], [-0.42, 0.60, 0.68]]],
    [0.74, [[0.16, 0.74, 0.65], [0.08, 0.95, 0.30], [0.42, -0.74, 0.50], [-0.05, 0.30, 0.95]]],
    [1.00, [[0.12, 0.93, 0.34], [0.06, 0.98, 0.20], [0.40, -0.82, 0.38], [0.02, 0.36, 0.93]]]];
  /* a pass is a snap: the ball loaded at the chest, the arms shot straight out, then the hands turned out and held */
  const PASSK = [
    [0.00, [[0.34, -0.72, 0.42], [-0.05, 0.30, 0.95], [0.34, -0.72, 0.42], [-0.05, 0.30, 0.95]]],
    [0.32, [[0.20, -0.10, 0.97], [0.00, 0.04, 1.00], [0.20, -0.10, 0.97], [0.00, 0.04, 1.00]]],
    [1.00, [[0.30, -0.22, 0.93], [0.12, -0.10, 0.99], [0.30, -0.22, 0.93], [0.12, -0.10, 0.99]]]];
  const BPASSK = [
    [0.00, [[0.34, -0.72, 0.42], [-0.05, 0.30, 0.95], [0.34, -0.72, 0.42], [-0.05, 0.30, 0.95]]],
    [0.32, [[0.22, -0.55, 0.80], [0.03, -0.62, 0.78], [0.22, -0.55, 0.80], [0.03, -0.62, 0.78]]],
    [1.00, [[0.30, -0.60, 0.74], [0.14, -0.66, 0.74], [0.30, -0.60, 0.74], [0.14, -0.66, 0.74]]]];
  /* a pose between the keys of a keyed move, eased */
  function keyed(K, k) {
    let i = 0; while (i < K.length - 2 && k > K[i + 1][0]) i++;
    const a = K[i], b = K[i + 1], u = Math.min(1, Math.max(0, (k - a[0]) / (b[0] - a[0]))), e = u * u * (3 - 2 * u);
    return a[1].map((v, j) => v.map((x, c) => x + (b[1][j][c] - x) * e));
  }
  /* dribble moves: [upper, forearm] of the hand the ball leaves (F) and the other arm (O), at the start, middle and end */
  const GD = [[0.5, -0.62, 0.42], [-0.12, 0.18, 0.95]], DR = [[0.36, -0.9, 0.23], [0.4, -0.85, 0.2]];
  const MOVES = {
    cross: { F: [DR, [[0.02, -0.92, 0.4], [-0.7, -0.6, 0.4]], GD], O: [GD, [[0.12, -0.9, 0.4], [-0.45, -0.8, 0.4]], DR] },
    btb: { F: [DR, [[0.15, -0.82, -0.55], [-0.65, -0.45, -0.6]], GD], O: [GD, [[0.2, -0.85, -0.45], [-0.35, -0.75, -0.55]], DR] },
    legs: { F: [DR, [[0.05, -0.95, 0.28], [-0.5, -0.82, 0.25]], GD], O: [GD, [[0.08, -0.95, 0.25], [-0.4, -0.9, 0.15]], DR] },
    hesi: { F: [DR, [[0.35, -0.7, 0.6], [0.2, -0.25, 0.95]], DR], O: [GD, [[0.55, -0.4, 0.72], [0.35, 0.05, 0.94]], GD] },
    spin: { F: [DR, [[0.3, -0.75, 0.55], [-0.15, -0.4, 0.9]], DR], O: [GD, [[0.9, -0.15, 0.2], [0.85, 0.05, 0.3]], GD] },
  };
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  /* Planted feet. Each foot has a place on the floor; when the body has moved far enough from it the foot steps (never
     both at once) to where the body is going. Then the hips sit at `hk` of a leg's length and each leg is solved, hip to
     knee to ankle, with the knee out over the toe. `wide` is half the stance in leg lengths. */
  const _H = V3(), _A = V3(), _K = V3(), _u = V3(), _pl = V3(), _t3 = V3(), _fq = Q4();
  function plant(p, m, G, dt, w, wide, hk) {
    const B = m.bones, f = p.face + (p.spinA || 0), fx = Math.sin(f), fz = Math.cos(f), rx = -fz, rz = fx;
    const legs = m.legs || (m.legs = ['L', 'R'].map(sd => ({ sd, s: (sd === 'R') === (TPL.sideR < 0) ? 1 : -1, th: B[bk(`DEF-thigh.${sd}`)], sh: B[bk(`DEF-shin.${sd}`)], ft: B[bk(`DEF-foot.${sd}`)], toe: B[bk(`DEF-toe.${sd}`)] })));
    if (!legs[0].th || !legs[0].toe) return;
    if (!m.legL) { legs[0].th.getWorldPosition(_H); legs[0].sh.getWorldPosition(_K); legs[0].ft.getWorldPosition(_A); m.legL = [_H.distanceTo(_K), _K.distanceTo(_A)]; }
    const l1 = m.legL[0], l2 = m.legL[1], L = l1 + l2, W = wide * L, ank = 0.105 * L, sp = Math.hypot(p.vx, p.vz);
    const thr = 0.2 * L, vx = sp > 0.5 ? p.vx / sp : 0, vz = sp > 0.5 ? p.vz / sp : 0, lead = Math.min(1, sp / 5);
    if (!m.ft || Math.hypot(m.ft[0].x - p.x, m.ft[0].z - p.z) > 6) m.ft = legs.map(l => ({ x: p.x + rx * l.s * W, z: p.z + rz * l.s * W, t: -1, y: 0 }));
    const F = m.ft, home = legs.map(l => [p.x + rx * l.s * W + fx * l.s * 0.06 * L, p.z + rz * l.s * W + fz * l.s * 0.06 * L]);
    let far = -1, fe = 0;
    for (let i = 0; i < 2; i++) { const q = F[i];
      if (q.t >= 0) {   // in the air: it lands ahead of its place, where the body will be
        q.t += dt / q.T; const e = Math.min(1, q.t), k = e * e * (3 - 2 * e), tx = home[i][0] + vx * thr * 0.9 * lead, tz = home[i][1] + vz * thr * 0.9 * lead;
        q.x = q.fx + (tx - q.fx) * k; q.z = q.fz + (tz - q.fz) * k; q.y = Math.sin(Math.PI * e) * 0.1 * L;
        if (q.t >= 1) { q.t = -1; q.y = 0; }
      } else { const e = Math.hypot(q.x - home[i][0], q.z - home[i][1]) + (vx * (home[i][0] - q.x) + vz * (home[i][1] - q.z)) * 0.3; if (e > fe) { fe = e; far = i; } }
    }
    if (far >= 0 && fe > (sp < 0.5 ? thr * 0.45 : thr) && (F[1 - far].t < 0 || fe > thr * 2.4)) { const q = F[far]; q.t = 0; q.fx = q.x; q.fz = q.z; q.T = Math.max(0.1, 0.2 - sp * 0.008); }
    /* the hips: down in the stance, lower still if a foot is out of reach; a little dip as a foot comes down */
    const bob = (F[0].t >= 0 ? Math.sin(Math.PI * Math.min(1, F[0].t)) : 0) + (F[1].t >= 0 ? Math.sin(Math.PI * Math.min(1, F[1].t)) : 0);
    let hipY = ank + L * (hk + 0.025 * bob);
    for (let i = 0; i < 2; i++) { legs[i].th.getWorldPosition(_H); const hd = Math.hypot(F[i].x - _H.x, F[i].z - _H.z), reach = 0.985 * L;
      hipY = Math.max(hipY - 0.07 * L, Math.min(hipY, ank + F[i].y + Math.sqrt(Math.max(0.2, reach * reach - hd * hd)))); }
    legs[0].th.getWorldPosition(_H);
    m.body.position.y += (p.y + hipY - _H.y) * w; m.body.updateMatrixWorld(true);
    for (let i = 0; i < 2; i++) { const l = legs[i], q = F[i];
      l.th.getWorldPosition(_H); _A.set(q.x, p.y + ank + q.y, q.z);
      _u.copy(_A).sub(_H); let d = _u.length(); const dm = 0.985 * L; if (d > dm) { _u.multiplyScalar(dm / d); _A.copy(_H).add(_u); d = dm; }
      _u.multiplyScalar(1 / d);
      const a = (l1 * l1 - l2 * l2 + d * d) / (2 * d), h = Math.sqrt(Math.max(0, l1 * l1 - a * a));
      _pl.set(fx * 0.8 + rx * l.s * 0.6, 0.1, fz * 0.8 + rz * l.s * 0.6); _pl.addScaledVector(_u, -_pl.dot(_u)).normalize();   // the knee: forward and out
      _K.copy(_H).addScaledVector(_u, a).addScaledVector(_pl, h);
      aim(l.th, l.sh, _t3.copy(_K).sub(_H).normalize(), w);
      aim(l.sh, l.ft, _t3.copy(_A).sub(_K).normalize(), w);
      /* the shoe: toes a little out, flat on the floor (heel up as it steps) */
      const out = 0.3 * l.s; _t3.set(fx + rx * out, 0, fz + rz * out).normalize(); _t3.y = (TPL.footUp.slope || 0) - q.y * 1.6 / L; _t3.normalize();
      aim(l.ft, l.toe, _t3, w);
      const up = TPL.footUp && TPL.footUp[l.sd];
      if (up) { l.ft.getWorldQuaternion(_qw); _a.copy(up).applyQuaternion(_qw); _a.addScaledVector(_t3, -_a.dot(_t3)).normalize();
        _b.set(0, 1, 0).addScaledVector(_t3, -_t3.y).normalize();
        _fq.setFromUnitVectors(_a, _b); _q.copy(_fq).multiply(_qw); l.ft.parent.getWorldQuaternion(_qp).invert().multiply(_q); l.ft.quaternion.slerp(_qp, w); l.ft.updateMatrixWorld(true); }
    }
  }
  function updateSkinned(p, m, G, dt) {
    if (dt <= 0 && m.posed) return; m.posed = 1;   // paused: the pose holds (the turns added on top of the clip would pile up frame after frame)
    m.root.position.set(p.x, 0, p.z); m.py = p.y;
    const mv = p.mv && G.ball.holder === p && !p.shoot ? p.mv : null, ms = mv ? (G.t - mv.t0) / mv.T : 2;
    const drib = G.ball.holder === p && !p.shoot && !p.inb && G.phase !== 'ft', prot = drib ? p.prot || 0 : 0;
    /* shielding the ball: the shoulder turns toward the man, the ball hand away from him */
    m.shield = (m.shield || 0) + ((drib ? -(p.dribHand || 1) * 0.42 * prot : 0) - (m.shield || 0)) * Math.min(1, dt * 7);
    m.root.rotation.y = p.face + m.shield + (p.spinA || 0) + (ms < 1 && mv.k === 'spin' ? mv.side * Math.PI * 2 * smooth(0, 1, ms) : 0);   // the turn of a reverse or a 360 in the air, or a spin move
    m.body.position.y = p.y;
    // Load the outside leg on the ball side, then drive the hips across as the other hand receives.
    const crossing = ms < 1 && (mv.k === 'cross' || mv.k === 'legs' || mv.k === 'btb');
    const shift = crossing ? mv.a * (0.28 * Math.sin(Math.PI * smooth(0, 0.44, ms))
      - 0.52 * Math.sin(Math.PI * smooth(0.28, 1, ms))) : 0;
    m.sway = (m.sway || 0) + (shift - (m.sway || 0)) * Math.min(1, dt * 18);
    m.body.position.x = -m.sway * (TPL.sideR < 0 ? 1 : -1);
    /* a fadeaway leans back in the air */
    const lean = p.shoot && p.shoot.kind === 'dunk' && p.y > 0.3 ? (p.shoot.t / p.shoot.T < 0.6 ? -0.16 : 0.16) : p.fadeT !== undefined && G.t - p.fadeT < 1.5 && p.y > 0.05 ? -0.34 : ms < 1 && mv.k === 'hesi' ? (ms < 0.55 ? -0.12 : 0.22) : ms < 1 && mv.k !== 'spin' ? 0.12 : 0;   // a fadeaway leans back; a hesitation rises, then goes
    const plean = p.passT0 !== undefined && G.t - p.passT0 < 0.3 ? 0.16 * Math.sin(Math.PI * (G.t - p.passT0) / 0.3) : 0;
    const jk = p.shoot && p.shoot.kind === 'jumper' && !p.shoot.fade ? Math.min(1, p.shoot.t / (p.shoot.T * 0.82)) : -1, slean = jk < 0 ? 0 : jk < 0.4 ? 0.12 * (1 - jk / 0.4) + 0.02 : jk < 0.8 ? 0.02 : -0.05;
    // Sit into the stop, then extend through the set point.
    const plantPhase = p.shoot && p.shoot.gather ? p.shoot.t / p.shoot.gather : 2;
    const load = smooth(0, 0.72, plantPhase) * (1 - smooth(0.72, 1.6, plantPhase));
    const dlean = 0.13 * load + slean + plean + (drib && lean === 0 ? 0.07 + 0.11 * (p.runD || 0) + 0.06 * prot : 0);   // over the ball; more at a run
    /* a runner leans into it: forward as he takes off, back as he stops, and banked into a cut */
    if (dt > 0) { const ax = (p.vx - (m.pvx === undefined ? p.vx : m.pvx)) / dt, az = (p.vz - (m.pvz === undefined ? p.vz : m.pvz)) / dt, f = p.face; m.pvx = p.vx; m.pvz = p.vz;
      const run = smooth(4, 9, Math.hypot(p.vx, p.vz)) * (p.y > 0.2 ? 0 : 1), fw = ax * Math.sin(f) + az * Math.cos(f), lat = ax * -Math.cos(f) + az * Math.sin(f);
      m.bank = (m.bank || 0) + (Math.max(-0.2, Math.min(0.2, lat * 0.009)) * run - (m.bank || 0)) * Math.min(1, dt * 5);
      m.pitch = (m.pitch || 0) + (Math.max(-0.1, Math.min(0.13, fw * 0.007)) * Math.max(run, 0.4) * (p.y > 0.2 ? 0 : 1) - (m.pitch || 0)) * Math.min(1, dt * 5); }
    m.lean = (m.lean || 0) + (lean + dlean - (m.lean || 0)) * Math.min(1, dt * 10); m.body.rotation.x = m.lean + (m.pitch || 0); m.body.rotation.z = (m.bank || 0) * (TPL.sideR < 0 ? 1 : -1);
    if (drib && p.y <= 0 && p.dph !== undefined) m.body.position.y = p.y - 0.11 * (1 - Math.abs(Math.sin(p.dph))) * (0.6 + 0.4 * prot);   // the body rides the bounce
    /* ankles broken: down on the seat of his shorts, then back up */
    const ft = p.fallT !== undefined ? G.t - p.fallT : 9, fall = ft < 1.5 ? smooth(0, 0.22, ft) * (1 - smooth(1.05, 1.5, ft)) : 0;
    if (fall > 0) { m.body.rotation.x = m.lean - 1.25 * fall; m.body.position.y = p.y - 0.25 * fall; }
    /* how fast he is really moving: a man held up by a body in his way does not run in place */
    if (dt > 0) { const rs = m.lx === undefined ? 0 : Math.hypot(p.x - m.lx, p.z - m.lz) / dt; m.rs = (m.rs || 0) + (Math.min(rs, 30) - (m.rs || 0)) * Math.min(1, dt * 9); m.lx = p.x; m.lz = p.z; }
    const sp = Math.min(Math.hypot(p.vx, p.vz), (m.rs || 0) * 1.2 + 1.5), air = p.y > 0.3;
    /* legs: idle, walk, jog and sprint blended by speed; the stance on defense; the jump in the air */
    const ws = {};
    for (let i = 0; i < LOCO.length; i++) {
      const [n, v] = LOCO[i], lo = i ? LOCO[i - 1][1] : -1, hi = i < LOCO.length - 1 ? LOCO[i + 1][1] : 1e9;
      ws[n] = sp <= v ? (i ? smooth(lo, v, sp) : 1 - smooth(v, hi, sp)) : (i < LOCO.length - 1 ? 1 - smooth(v, hi, sp) : 1);
    }
    let crouch = 0;   // (the stance is its own thing: plant(), below)
    if (p.shoot && p.y < 0.6 && p.shoot.t < p.shoot.T * 0.3) crouch = 0.55;
    crouch = Math.max(crouch, 0.85 * load);
    if (fall > 0) crouch = 1;
    if (p.pose === 'sad') crouch = 0.55;
    if (drib) crouch = Math.max(crouch, 0.12 + 0.3 * prot);   // an athletic base with the ball, lower with a man on you
    if (G.ball.holder === p && !p.shoot && p.d && p.d.look && p.d.look.drib === 'low') crouch = Math.max(crouch, 0.3);   // a low dribbler gets down
    if (ms < 1 && (mv.k === 'legs' || mv.k === 'cross' || mv.k === 'btb')) crouch = Math.max(crouch, mv.k === 'legs' ? 0.55 : 0.35);   // low on a move   // the gather: down into the legs before the jump
    const dance = p.pose === 'celebrate' && !air && sp < 3 ? 1 : 0;   // (and the losers at the horn bend over: 'sad')
    const shooting = p.shoot || p.pose === 'shoot';
    const jump = air ? (shooting ? 0.3 : 1) : 0;   // a jumper goes up with straight legs, not the tuck of a leap
    const rest = Math.max(0, 1 - jump - dance);
    m.crouch = (m.crouch || 0) + (crouch - (m.crouch || 0)) * Math.min(1, dt * 8);
    const k = dt ? Math.min(1, dt * 10) : 1;
    const set = (n, w) => { const a = m.act[n]; if (!a) return; a.weight = a.weight + (w - a.weight) * k; a.setEffectiveWeight(a.weight); };
    for (const [n] of LOCO) set(n, ws[n] * rest * (1 - m.crouch) + (air && shooting && n === 'Idle_Loop' ? 0.7 : 0));
    { const fw = smooth(2, 6, sp) * (p.pose === 'guard' ? 0.25 : 1);   // sliding in a stance is a shuffle, not a crouched walk
      set('Crouch_Idle_Loop', rest * m.crouch * (1 - fw)); set('Crouch_Fwd_Loop', rest * m.crouch * fw); }
    set('Jump_Loop', jump); set('Dance_Loop', dance);
    /* the clips' feet match the ground at about these speeds (feet a second, at this player's size) */
    const scl = (p.ht || 78) / 12 / 6.1;
    m.act.Walk_Loop.timeScale = Math.min(1.6, Math.max(0.6, sp / (4.5 * scl)));
    m.act.Jog_Fwd_Loop.timeScale = Math.min(1.5, Math.max(0.7, sp / (11 * scl)));
    m.act.Sprint_Loop.timeScale = Math.min(1.3, Math.max(0.8, sp / (18 * scl)));
    if (m.act.Crouch_Fwd_Loop) m.act.Crouch_Fwd_Loop.timeScale = 1.6;
    if (m.head) { if (!m.headRest) m.headRest = m.head.quaternion.clone(); else m.head.quaternion.copy(m.headRest); }   // the turn below is fresh each frame
    const idle = m.idle;
    if (idle.applied) idle.chest.quaternion.copy(idle.base);
    m.mixer.update(dt);
    const resting = !G.show && !G.replay && !p.ref && !p.shoot && !p.inb && p.y === 0 && fall === 0
      && (!p.pose || p.pose === 'ready' || p.pose === 'dribble') && ms >= 1
      && !(p.fakeT !== undefined && G.t - p.fakeT < 0.36) && !(G.ball.state === 'pass' && G.ball.to === p)
      && Math.hypot(p.vx, p.vz) < 1;
    idle.still = resting ? Math.min(3, idle.still + dt) : 0;
    const settle = smooth(0.5, 2.5, idle.still);
    idle.applied = !!idle.chest && settle > 0;
    if (idle.applied) {
      idle.base.copy(idle.chest.quaternion);
      idle.breath += dt * (1.6 + 0.7 * (1 - (p.energy ?? 1)));
      idle.chest.rotateX(0.035 * settle * Math.sin(idle.breath + idle.phase));
      idle.chest.rotateZ(0.045 * settle * Math.sin(G.t * 0.78 + idle.phase));
    }
    if (m.head) m.head.scale.setScalar(m.headS || HEAD);
    /* down in a stance: the back flat and leaning in from the hips, the head up */
    { const bl = G.ball, rb = bl.state === 'loose' && bl.y > 5 && !p.ref && p.team !== undefined && Math.hypot(bl.x - p.x, bl.z - p.z) < 11 && G.phase === 'live'; m.rb = (m.rb || 0) + ((rb && !air ? 1 : 0) - (m.rb || 0)) * Math.min(1, dt * 8);
      const g = (p.pose === 'guard' || p.pose === 'reach' || p.pose === 'contest' || rb) && !air && G.ball.holder !== p ? 1 : 0; m.gw = (m.gw || 0) + (g - (m.gw || 0)) * Math.min(1, dt * 9);
      /* on the ball he sits all the way down; away from it, a lighter stance with the hands ready */
      const h = G.ball.holder, on = h && h.team !== p.team && Math.hypot(h.x - p.x, h.z - p.z) < 8 ? 1 : 0; if (m.gd === undefined) m.gd = on; m.gd += (on - m.gd) * Math.min(1, dt * 5);
      /* chest to chest he stands taller and walls up, arms wide, instead of leaning through his man */
      const cl = on ? Math.min(1, Math.max(0, (3.5 - Math.hypot(h.x - p.x, h.z - p.z)) / 1.1)) : 0; m.gc = (m.gc || 0) + (cl - (m.gc || 0)) * Math.min(1, dt * 8); }
    /* over the ball: a dribbler who is standing or walking has his feet set and his knees bent too */
    /* the same for the dip before a jumper, and for every landing: the knees take it */
    { if (p.y > 0.12) m.airT = G.t;
      m.land = !air && m.airT !== undefined && p.y <= 0.12 ? (G.t - m.airT) / 0.34 : 9; m.gath = p.shoot && p.y <= 0.02 && !p.inb && G.phase !== 'ft' ? 1 : 0;
      const g = !air && fall <= 0 ? Math.max(drib ? 1 - smooth(5, 9, sp) : 0, m.gath, m.land < 1 ? 1 - smooth(8, 13, sp) : 0) : 0;
      m.dw = (m.dw || 0) + (g - (m.dw || 0)) * Math.min(1, dt * (m.land < 1 ? 30 : 8));
      /* off the ball on offense, standing: on the balls of his feet, hands ready for the pass */
      const h = G.ball.holder, rd = h && h !== p && h.team === p.team && p.team !== undefined && !p.ref && !air && !p.pose && G.phase === 'live' && fall <= 0 ? 1 - smooth(2.5, 5, sp) : 0;
      m.rw = (m.rw || 0) + (rd - (m.rw || 0)) * Math.min(1, dt * 5); }
    m.tilt = (0.16 + 0.14 * m.gd + (p.pose === 'reach' ? 0.14 : 0)) * (1 - 0.7 * m.gc) * m.gw + 0.08 * m.dw * (1 - m.gw);
    if (m.tilt > 0.01 && m.bones[bk('DEF-hips')]) { const hb = m.bones[bk('DEF-hips')], f = p.face + (p.spinA || 0); m.body.updateMatrixWorld(true);
      _ax.set(Math.cos(f), 0, -Math.sin(f)); hb.getWorldQuaternion(_qw); _q.setFromAxisAngle(_ax, m.tilt).multiply(_qw); hb.parent.getWorldQuaternion(_qp).invert().multiply(_q); hb.quaternion.copy(_qp);
      if (m.head) { m.body.updateMatrixWorld(true); m.head.getWorldQuaternion(_qw); _q.setFromAxisAngle(_ax, -m.tilt * 0.85).multiply(_qw); m.head.parent.getWorldQuaternion(_qp).invert().multiply(_q); m.head.quaternion.copy(_qp); } }
    /* eyes on the ball: the head turns toward it (within a comfortable range), smoothly */
    if (m.head && G.ball && G.ball.holder !== p && !p.shoot && !G.show) {
      const bx = G.ball.x - p.x, bz = G.ball.z - p.z;
      let d = Math.atan2(bx, bz) - (p.face + (p.spinA || 0)); while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      const want = Math.abs(d) < 2.2 ? Math.max(-0.75, Math.min(0.75, d)) : 0;
      m.lookY = (m.lookY || 0) + (want - (m.lookY || 0)) * Math.min(1, dt * 6);
    } else {
      // An idle ball handler occasionally looks to either side between dribbles.
      const glance = settle && G.ball.holder === p ? 0.28 * settle * Math.sin(G.t * 0.82 + idle.phase)
        * smooth(0.25, 0.85, Math.sin(G.t * 0.95 + idle.phase)) : 0;
      m.lookY = (m.lookY || 0) + (glance - (m.lookY || 0)) * Math.min(1, dt * 6);
    }
    /* his close-up before the tip: he looks into the camera, not off at the ball */
    if (introFocus === p && intro > 0 && intro < 2.4) { let d = Math.atan2(cam.position.x - p.x, cam.position.z - p.z) - p.face; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      m.introL = (m.introL === undefined ? d : m.introL) + (d - (m.introL === undefined ? d : m.introL)) * Math.min(1, dt * 8); m.lookY = Math.max(-0.75, Math.min(0.75, m.introL)); } else m.introL = undefined;
    if (m.head && Math.abs(m.lookY || 0) > 0.01) { m.body.updateMatrixWorld(true); m.head.getWorldQuaternion(_qw); _q.setFromAxisAngle(_up, m.lookY).multiply(_qw); m.head.parent.getWorldQuaternion(_qp).invert().multiply(_q); m.head.quaternion.copy(_qp); }
    if (m.hg && m.hg.userData.blink) m.hg.userData.blink.visible = (G.t + m.hg.userData.bph) % 3.8 < 0.13;
    if (m.hg && m.hg.userData.faceM) { const fm = m.hg.userData.faceM, sh = (G.t + (m.bph2 || (m.bph2 = Math.random() * 3.8))) % 3.8 < 0.13, yl = /^(roar|flex|celebrate|dunk1|windmill|hang)$/.test(p.pose) || (p.fallT !== undefined && G.t - p.fallT < 1.2), mood = p.celebT > 0 ? (p.celebK === 'ugh' ? 'stern' : p.celebK === 'call' ? '' : 'happy') : p.pose === 'sad' ? (p.tiredP ? 'tired' : 'stern') : '', ix = yl ? fm.userData.yell : sh ? fm.userData.shut : (mood && fm.userData[mood]) || fm.userData.open; if (fm.geometry.index !== ix) fm.geometry.setIndex(ix); }   // the model blinks
    if (m.hg && m.hg.userData.yell) m.hg.userData.yell.visible = /^(roar|flex|chest|celebrate|dunk1|windmill|hang)$/.test(p.pose) || (p.fallT !== undefined && G.t - p.fallT < 1.2);   // a little bigger head: more character at phone size
    m.body.updateMatrixWorld(true);
    /* the arms a little away from the body, so the hands swing clear of the baggy shorts */
    abduct(m, p.face + (p.spinA || 0), ABD);
    /* planted feet: in a defensive stance (and standing over a dribble) the feet are set on the floor and step, one
       at a time, as he moves; the legs are solved to reach them. sw eases in and out so he drops into it */
    { const gs = m.gw * (1 - smooth(13, 17, sp)), rdy = m.rw > m.dw && m.rw > gs, sw = Math.max(gs, m.dw, m.rw), k = sw > 0 ? gs / (gs + m.dw + 1e-6) : 0, low = crossing ? (mv.k === 'legs' ? 0.10 : 0.065) * Math.sin(ms * Math.PI) : ms < 1 && mv.k === 'spin' ? 0.05 : 0;
      if (sw > 0.02 && TPL.simpleGeo && !PB.mannequin) plant(p, m, G, dt, sw, rdy ? 0.21 : 0.25 + (0.05 + 0.08 * m.gd) * k, rdy ? 0.93 : 0.87 - (0.01 + 0.06 * m.gd) * k - 0.04 * prot * (1 - k) - 0.06 * (p.brakeD || 0) - low - 0.07 * m.gath - 0.08 * load - (m.land < 1 ? 0.06 * Math.sin(Math.PI * m.land) : 0)); else m.ft = null; }
    /* a dunk: the knees tuck under him as he rises */
    if ((p.pose === 'dunk1' || p.pose === 'windmill') && p.y > 0.5 && m.bones[bk('DEF-thigh.L')]) { const w = Math.min(1, (p.y - 0.5) * 1.6), f = p.face + (p.spinA || 0);
      for (const sd of ['L', 'R']) { const th = m.bones[bk(`DEF-thigh.${sd}`)], sh = m.bones[bk(`DEF-shin.${sd}`)], ft = m.bones[bk(`DEF-foot.${sd}`)], k = sd === 'L' ? 0.5 : 0.72;
        aim(th, sh, _t3.set(Math.sin(f) * k, -0.8, Math.cos(f) * k).normalize(), w); aim(sh, ft, _t3.set(-Math.sin(f) * 0.75, -0.66, -Math.cos(f) * 0.75).normalize(), w); } }
    /* a fadeaway: the lead knee comes up and the foot kicks out at the defender, the other leg hangs back under him */
    if (p.fadeT !== undefined && G.t - p.fadeT < 1.5 && p.y > 0.15 && m.bones[bk('DEF-thigh.L')]) { const w = Math.min(1, (p.y - 0.15) * 2.2), f = p.face + (p.spinA || 0), sx = Math.sin(f), cz = Math.cos(f);
      const lead = (p.dribHand || 1) > 0 === (TPL.sideR < 0) ? 'R' : 'L', trail = lead === 'R' ? 'L' : 'R';
      { const th = m.bones[bk(`DEF-thigh.${lead}`)], sh = m.bones[bk(`DEF-shin.${lead}`)], ft = m.bones[bk(`DEF-foot.${lead}`)];
        aim(th, sh, _t3.set(sx * 0.82, -0.57, cz * 0.82).normalize(), w); aim(sh, ft, _t3.set(sx * 0.45, -0.89, cz * 0.45).normalize(), w); }
      { const th = m.bones[bk(`DEF-thigh.${trail}`)], sh = m.bones[bk(`DEF-shin.${trail}`)], ft = m.bones[bk(`DEF-foot.${trail}`)];
        aim(th, sh, _t3.set(sx * 0.1, -0.99, cz * 0.1).normalize(), w * 0.8); aim(sh, ft, _t3.set(-sx * 0.3, -0.95, -cz * 0.3).normalize(), w * 0.8); } }
    /* a layup goes up off one foot: the knee on the ball side drives */
    if (m.lay === 1 && p.y > 0.25 && m.bones[bk('DEF-thigh.L')]) { const right = (p.dribHand || 1) > 0, sd = right === (TPL.sideR < 0) ? 'R' : 'L', w = Math.min(1, (p.y - 0.25) * 2.5), f = p.face + (p.spinA || 0);
      const th = m.bones[bk(`DEF-thigh.${sd}`)], sh = m.bones[bk(`DEF-shin.${sd}`)], ft = m.bones[bk(`DEF-foot.${sd}`)];
      aim(th, sh, _t3.set(Math.sin(f) * 0.9, -0.42, Math.cos(f) * 0.9).normalize(), w); aim(sh, ft, _t3.set(-Math.sin(f) * 0.25, -0.97, -Math.cos(f) * 0.25).normalize(), w); }
    /* the arms */
    const has = G.ball.holder === p;
    let pose = p.pose === 'lobPass' ? 'chestPass' : p.pose;
    if (pose === 'shoot' && !p.shoot) pose = 'follow';
    if (has && !p.shoot && (pose !== 'dribble' || p.inb)) pose = G.phase === 'ft' ? 'hold' : p.inb ? (p.inbW ? 'hold' : 'over') : 'dribble';   // (carried at the waist on the jog out to the line, overhead once he is there)
    if (pose === 'chest') pose = 'thump';
    if (has && !p.shoot && !p.inb && p.y > 0.25 && p.pose !== 'hang') pose = 'contest';   // he came down with a rebound: the ball stays up in both hands until his feet are back on the floor
    const fk = has && !p.shoot && p.fakeT !== undefined && G.t - p.fakeT < 0.36 ? (G.t - p.fakeT) / 0.36 : -1;   // a pump fake: the ball shown, then pulled back
    if (fk >= 0) pose = 'shoot';
    /* at the line: the ball comes up from the routine to the set point as he gets ready (your meter filling, or the
       last beat of the computer's wait), and the follow-through is held while it is in the air */
    let ftk = -1;
    if (G.ftq && G.ftq.shooter === p && !p.shoot) {
      if (G.phase === 'ft' && has) ftk = G.ftMeter > 0 ? Math.min(0.74, G.ftMeter * 0.9) : (!p.isUser || G.auto) && G.ftWait !== undefined && G.ftWait <= 0.35 ? Math.min(0.74, (1 - Math.max(0, G.ftWait) / 0.35) * 0.74) : -1;
      if (ftk >= 0) pose = 'shoot'; else if (G.phase === 'ftflight') pose = 'follow'; }
    if ((pose === 'guard' || pose === 'ready' || !pose) && !has && p.y > 0.35 && !p.shoot && p.pose !== 'hang') pose = 'contest';   // off the floor without the ball: the hands go up (a block try, a rebound)
    if (pose === 'guard' && !has) { const h = G.ball.holder; if (Math.hypot(p.vx, p.vz) > 10 && (!h || Math.hypot(h.x - p.x, h.z - p.z) > 9)) pose = ''; }   // sprinting back, far from the ball: he runs, arms pumping, not spread like wings
    if (!pose && m.rw > 0.3 && !has) pose = 'ready';
    /* setting a screen: planted, arms crossed in front of him, braced for the bump */
    if ((!pose || pose === 'ready') && !has && p.screen > 1.4 && p.y <= 0 && Math.hypot(p.vx, p.vz) < 4.5) pose = 'screen';
    if ((!pose || pose === 'guard' || pose === 'ready') && m.rb > 0.3 && !has) pose = 'box';
    if (pose !== m.pose) { m.pose = pose; }
    m.poseW = Math.min(1, (m.poseW || 0) + dt * (POSES[pose] ? 9 : -6));
    if (!POSES[pose]) { m.poseW = Math.max(0, m.poseW - dt * 6); return; }
    let kk = 0;
    const dsf = (ds => ds === 'low' ? 1.25 : ds === 'high' ? 0.85 : 1)(p.d && p.d.look && p.d.look.drib);
    if (pose === 'dribble') kk = ((p.dph !== undefined ? p.dph : G.t * 7.4 * dsf) / Math.PI) % 1;   // the ball's own bounce (game.js), so hand and ball agree
    else if (pose === 'shoot' && p.shoot) kk = Math.min(1, p.shoot.t / (p.shoot.T * 0.82));
    else if (pose === 'shoot' && fk >= 0) kk = 0.16 + 0.34 * Math.sin(Math.PI * Math.min(1, fk * 1.15));
    else if (pose === 'shoot' && ftk >= 0) kk = ftk;
    else if (pose === 'windmill') kk = p.spin ? p.spin.t / p.spin.T : 1;
    else if (pose === 'dunk1') kk = p.shoot ? Math.min(1, p.shoot.t / p.shoot.T) : 1;
    else if (pose === 'flex' || pose === 'roar' || pose === 'thump' || pose === 'three' || pose === 'call' || pose === 'shrug' || pose === 'toosmall' || pose === 'ice' || pose === 'guard' || pose === 'ready' || pose === 'box' || pose === 'screen') kk = G.t + (m.gph0 || (m.gph0 = Math.random() * 6));
    const hi = pose === 'shoot' && p.shoot && p.shoot.js === 'high' ? 0.14 : 0;   // a high release: the ball goes up above the head
    /* dirOf's x is to the player's right when the model's right hand sits on -x facing +z (TPL.sideR < 0); each pose
       gives x as outward for that arm, so the left arm mirrors it */
    let P = POSES[pose](kk);
    /* the off arm of a dribbler: loose at his side when nobody is on him, pumping a little at a run, and up as a bar
       across his body only when a defender crowds him (it used to be held out stiff all the time) */
    if (pose === 'dribble') { const pr = smooth(0.12, 0.6, p.prot || 0), rn = Math.min(1, p.runD || 0), sw = Math.sin(kk * Math.PI * 2);
      const up = [0.32 - 0.04 * rn, -0.88, 0.22 + 0.22 * rn * sw], fo = [0.08, -0.45 + 0.5 * rn + 0.2 * rn * sw, 0.88], L = (a, b) => a.map((v, j) => v + (b[j] - v) * pr);
      P = [P[0], P[1], L(up, P[2]), L(fo, P[3])]; }
    if (pose === 'chestPass' || pose === 'bpass') {
      const elapsed = 0.32 - p.reachT;
      P = keyed(pose === 'bpass' ? BPASSK : PASSK, Math.min(1, elapsed / 0.3));
      if (p.pose === 'lobPass') P = P.map(v => [v[0], v[1] + 0.5, v[2]]);
    }
    /* a reach goes at the ball: down for a low dribble, up for one held high */
    if (pose === 'reach' && G.ball.holder && G.ball.holder !== p) { const b = G.ball, d = Math.hypot(b.x - p.x, b.z - p.z) || 1, vy = Math.max(-0.75, Math.min(0.5, ((b.y || 0) - ((p.ht || 78) / 12 * 0.70 + (p.y || 0))) / Math.max(2, d)));
      P = [[0.10, vy * 0.8, 0.98], [0.04, vy * 1.1, 0.98], P[2], P[3]]; }
    if (pose === 'catch' && G.ball.state === 'pass') {
      const b = G.ball, dx = b.x - p.x, dz = b.z - p.z, distance = Math.max(3, Math.hypot(dx, dz));
      const height = PB.clamp((b.y - (p.y + p.ht / 12 * 0.78)) / distance, -0.7, 0.9);
      const side = TPL.sideR < 0 ? 1 : -1;
      const across = side * PB.clamp((-dx * Math.cos(p.face) + dz * Math.sin(p.face)) / distance, -0.7, 0.7);
      // The arms use mirrored local axes. Both hands reach toward the incoming side.
      P = [[0.30 + across * 0.5, height * 0.5 - 0.1, 0.90], [0.10 + across, height + 0.15, 0.95],
           [0.30 - across * 0.5, height * 0.5 - 0.1, 0.90], [0.10 - across, height + 0.15, 0.95]];
    }
    /* off one hand: a layup reaches up for the glass, the off arm keeping the defender away; a hook sweeps up from the side */
    { const sk = p.shoot && p.shoot.kind; m.lay = p.shoot ? (sk === 'layup' || sk === 'floater' ? 1 : sk === 'hook' ? 2 : 0) : (p.y > 0.2 ? m.lay : 0);
      if (m.lay && (pose === 'shoot' || pose === 'follow')) { const e = pose === 'follow' ? 1 : smooth(0, 1, kk), L = (a, b) => a.map((v, j) => v + (b[j] - v) * e);
        P = m.lay === 2 ? [L([0.9, -0.1, 0.3], [0.35, 0.93, 0.1]), L([0.85, 0.3, 0.3], [0.15, 0.98, 0.1]), [0.6, -0.1, 0.7], [-0.2, 0.25, 0.9]]
          : pose === 'follow' ? [[0.12, 0.93, 0.34], [0.06, 0.92, 0.38], [0.40, -0.82, 0.38], [0.02, 0.36, 0.93]] : keyed(LAYUP, kk); } }
    if (pose === 'dribble' && p.sigT !== undefined && G.t - p.sigT < 1.3 && !(ms < 1)) { const e = Math.sin(Math.PI * Math.min(1, (G.t - p.sigT) / 1.3)); const L = (a, b) => a.map((v, j) => v + (b[j] - v) * Math.min(1, e * 1.6)); P = [P[0], P[1], L(P[2], [0.3, 0.86, 0.35]), L(P[3], [0.12, 0.97, 0.2])]; }   // calling the set: the off hand goes up
    /* at a run the ball is pushed out in front at the waist, not carried up by the shoulder */
    if (pose === 'dribble' && p.runD > 0.05) {
      const run = p.runD, height = Math.sin(kk * Math.PI);
      // Reach forward on the push and bend the elbow again as the ball climbs back to the hand.
      const vx = p.dribVX ?? p.vx, vz = p.dribVZ ?? p.vz;
      const speed = Math.max(1, Math.hypot(vx, vz)), fx = Math.sin(p.face), fz = Math.cos(p.face);
      const ahead = (vx * fx + vz * fz) / speed;
      const across = (-vx * fz + vz * fx) / speed * (p.dribHand || 1);
      const reach = run * (0.2 + 0.22 * (1 - height));
      P[0][2] += reach * ahead;
      P[0][0] += reach * across;
      P[1][2] += 0.28 * run * ahead;
      P[1][0] += 0.28 * run * across;
      P[1][1] += run * (0.38 * height - 0.18);
    }
    if (pose === 'dribble') {
      // Change bounce height at the elbow so the returning ball still meets the palm.
      const style = p.d && p.d.look && p.d.look.drib;
      const lift = (style === 'high' ? 0.2 : style === 'low' ? -0.38 : 0) - 0.32 * prot - 0.35 * (p.brakeD || 0);
      P[1][1] += lift * Math.sin(Math.PI * kk);
    }
    if (pose === 'guard' && m.gd < 0.98) { const R0 = [[0.42, -0.8, 0.42], [0.4, -0.3, 0.86]], e = 1 - m.gd, L = (a, b) => a.map((v, j) => v + (b[j] - v) * e); P = [L(P[0], R0[0]), L(P[1], R0[1]), L(P[2], R0[0]), L(P[3], R0[1])]; }
    if (pose === 'guard' && m.gc > 0.02) { const W0 = [[0.92, -0.3, 0.2], [0.82, 0.3, 0.45]], e = m.gc, L = (a, b) => a.map((v, j) => v + (b[j] - v) * e); P = [L(P[0], W0[0]), L(P[1], W0[1]), L(P[2], W0[0]), L(P[3], W0[1])]; }
    /* in the air at a shooter: one long arm to the ball, the other down for balance (both go up for a rebound) */
    if (pose === 'contest' && air && G.ball.state !== 'loose' && G.phase === 'live' && G.pl && G.pl.some(o => o.team !== p.team && (o.shoot || G.ball.state === 'shot') && Math.hypot(o.x - p.x, o.z - p.z) < 7)) P = [[0.18, 0.95, 0.26], [0.06, 0.98, 0.2], [0.6, -0.55, 0.3], [0.5, -0.7, 0.25]];
    if (pose === 'contest' && !air && p.y <= 0.05) P = [[0.3, 0.93, 0.22], [0.1, 0.98, 0.16], [0.8, -0.2, 0.55], [0.6, 0.45, 0.66]];   // feet on the floor: one hand up in the shooter's eyes
    const w = m.poseW, s = TPL.sideR < 0 ? 1 : -1;
    if (pose === 'dribble' && ms < 1 && MOVES[mv.k]) {
      /* a dribble move: the ball arm (F) and the other arm (O) from three keyframes; F is the hand it leaves */
      const K = MOVES[mv.k], u = ms < 0.5 ? ms / 0.5 : (ms - 0.5) / 0.5, i = ms < 0.5 ? 0 : 1, e = u * u * (3 - 2 * u);
      const L = (a, b) => a.map((v, j) => v + (b[j] - v) * e);
      const F = [L(K.F[i][0], K.F[i + 1][0]), L(K.F[i][1], K.F[i + 1][1])], O = [L(K.O[i][0], K.O[i + 1][0]), L(K.O[i][1], K.O[i + 1][1])];
      /* POSES are written right-hand first and swapped below for a left-hand dribbler (dribHand < 0, now the new hand) */
      const fromR = mv.a > 0;
      const movePose = (p.dribHand < 0) === fromR ? [O[0], O[1], F[0], F[1]] : [F[0], F[1], O[0], O[1]];
      // Open the receiving arm into its ordinary dribble position as the ball returns.
      const receive = smooth(0.65, 1, ms);
      P = receive ? movePose.map((arm, j) => arm.map((v, i) => v + (P[j][i] - v) * receive)) : movePose;
    }
    /* dribbling with the left hand: the arms trade jobs */
    /* the high hand goes to the side the ball is on */
    if (pose === 'guard' || pose === 'contest') { const bx = G.ball.x - p.x, bz = G.ball.z - p.z, side = bx * -Math.cos(p.face) + bz * Math.sin(p.face); if (Math.abs(side) > 0.35) m.gsw = side < 0; }
    const sw = (pose === 'dribble' && p.dribHand < 0) || (m.lay && p.dribHand < 0 && (pose === 'shoot' || pose === 'follow')) || ((pose === 'guard' || pose === 'contest') && m.gsw), A = sw ? P[2] : P[0], Af = sw ? P[3] : P[1], Bu = sw ? P[0] : P[2], Bf = sw ? P[1] : P[3];
    aim(m.R.up, m.R.fore, dirOf(p.face, A[0], A[1] + hi, A[2] - hi, s), w);
    aim(m.R.fore, m.R.hand, dirOf(p.face, Af[0], Af[1] + hi, Af[2] - hi, s), w);
    aim(m.L.up, m.L.fore, dirOf(p.face, Bu[0], Bu[1], Bu[2], -s), w);
    aim(m.L.fore, m.L.hand, dirOf(p.face, Bf[0], Bf[1], Bf[2], -s), w);
    if (pose === 'dribble') {
      // Let the wrist give on the rise and flex through the push. On a crossover the
      // outgoing wrist finishes across the body while the receiving hand opens to the ball.
      const side = crossing && ms < 0.5 ? mv.a : (p.dribHand || 1);
      const arm = side < 0 ? m.L : m.R;
      if (arm.fing) {
        const flex = crossing ? Math.cos(ms * Math.PI) : Math.cos(kk * 2 * Math.PI);
        aim(arm.hand, arm.fing, dirOf(p.face, crossing ? -0.32 : 0.12,
          -0.4 - 0.42 * flex, 0.85, side * s), w);
      }
    }
    /* the shooter's wrists: cocked back under the ball at the set point, snapped through at the release and left
       hanging on the follow-through; the guide hand's fingers point up */
    if ((pose === 'shoot' || pose === 'follow') && m.lay === 1 && m.R.fing && m.L.fing) { const hd = sw ? m.L : m.R, fr = pose === 'follow' ? [0, 0.15, 0.99] : [0, 0.55 + 0.2 * kk, 0.83 - 0.3 * kk];   // the finger roll: the palm under the ball, then the fingers through it
      aim(hd.hand, hd.fing, dirOf(p.face, fr[0], fr[1], fr[2], sw ? -s : s), w); }
    if ((pose === 'shoot' || pose === 'follow') && !m.lay && m.R.fing && m.L.fing) {
      // Cock the wrist as the ball rises, then roll the fingers forward through extension.
      const phase = pose === 'follow' ? 1 : kk;
      const wristAngle = 0.55 + 1.65 * smooth(0, 0.76, phase) - 2.85 * smooth(0.82, 1, phase);
      const wr = [0, Math.sin(wristAngle), Math.cos(wristAngle)];
      aim(m.R.hand, m.R.fing, dirOf(p.face, wr[0], wr[1], wr[2], s), w);
      aim(m.L.hand, m.L.fing, dirOf(p.face, -0.25, 0.94, 0.22, -s), w);
    }
  }
  /* where a player's hands are, in feet, for the ball (null for the simple figures) */
  const _h = V3();
  R.hands = p => {
    const m = meshes.get(p);
    if (!m || m.kind !== 'skin') return null;
    /* the hands as drawn last frame, carried along by how far he has moved since (the ball used to trail a frame behind a
       fast hand: a dunk's ball hung under the arm on the way up) */
    const dx = p.x - m.root.position.x, dz = p.z - m.root.position.z, dy = m.py === undefined ? 0 : (p.y || 0) - m.py;
    m.R.hand.getWorldPosition(_h); const r = { x: _h.x + dx, y: _h.y + dy, z: _h.z + dz };
    m.L.hand.getWorldPosition(_h); const l = { x: _h.x + dx, y: _h.y + dy, z: _h.z + dz };
    return { r, l };
  };

  /* a portrait: head and shoulders in the team's jersey, rendered once off screen to an image for the hub */
  /* a picture of a player, drawn once off screen: a head-and-shoulders portrait, or (o.body) the whole player from the
     front or (o.back) the back, in any of the team's uniforms (o.kit: 'icon', 'assoc', 'city') */
  R.portrait = (player, team, size, o) => {
    if (!TPL) return null;
    o = o || {};
    try {
      const W = size || 192, Hh = o.body ? Math.round(W * 1.6) : W;
      /* one off-screen renderer for every picture (a roster of ten would run out of WebGL contexts otherwise) */
      if (!R._pr) { const cv = document.createElement('canvas'); R._pr = new T.WebGLRenderer({ canvas: cv, antialias: true, preserveDrawingBuffer: true, alpha: true }); R._pr.setPixelRatio(1); }
      const rr = R._pr, cv = rr.domElement; rr.setSize(W, Hh, false); rr.setClearColor(0x000000, 0);
      const sc = new T.Scene();
      sc.add(new T.HemisphereLight(0xffffff, 0x303034, 1.15)); const k = new T.DirectionalLight(0xffffff, 0.85); k.position.set(3, 6, o.back ? -8 : 8); sc.add(k);
      const rim = new T.DirectionalLight(0xffffff, 0.35); rim.position.set(-4, 3, o.back ? 6 : -6); sc.add(rim);
      const p = { d: player, team: 0, slot: 0, r: player.r, ht: player.ht, num: player.num, x: 0, z: 0, vx: 0, vz: 0, y: 0, vy: 0, face: 0, pose: '' };
      const m = skinnedPlayer(p, o.kitObj || (PB.kit ? PB.kit(team, o.kit || 'icon') : { c1: team.c1, c2: team.c2, name: team.name }));
      sc.add(m.root); m.shadow.visible = false; if (o.yell && m.hg && m.hg.userData.yell) m.hg.userData.yell.visible = true; if (o.yell && m.hg && m.hg.userData.faceM) m.hg.userData.faceM.geometry.setIndex(m.hg.userData.faceM.userData.yell); if (o.blink && m.hg && m.hg.userData.blink) m.hg.userData.blink.visible = true;
      m.mixer.update(0.3); m.body.updateMatrixWorld(true); abduct(m, 0, ABD);
      const H = (player.ht || 78) / 12;
      const c = new T.PerspectiveCamera(28, W / Hh, 0.1, 60);
      if (o.body) { const z = o.back ? -1 : 1, d = o.tight ? 12 : 14.5; c.position.set(0.6 * z, H * 0.55, d * z); c.lookAt(0, H * 0.5, 0); }
      else { const mdl = TPL.model && !PB.mannequin && m.head, hp = mdl ? m.head.getWorldPosition(V3()) : m.hg.getWorldPosition(V3()); if (mdl) hp.y += 0.218 * (m.sc || 1) + 0.22;   // the model's head sits above its bone
        hp.y -= 0.22; const dz = (o.close ? 3.15 : 4.1) * (mdl ? 1.22 : 1); hp.y += mdl ? (o.close ? 0.06 : -0.05) : o.close ? 0.3 : 0.12; c.position.set(hp.x + dz * 0.1, hp.y + 0.12, hp.z + dz); c.lookAt(hp); }
      rr.render(sc, c);
      const url = cv.toDataURL('image/png');
      freeTree(m.root, true);   // nobody else is being drawn by the picture renderer
      return url;
    } catch (e) { return null; }
  };
  R.init = (canvas) => {
    renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setClearColor(0x0b0f17);
    scene = new T.Scene();
    scene.fog = new T.Fog(0x0b0f17, 120, 260);
    cam = new T.PerspectiveCamera(46, 1, 1, 500);
    /* an arena rig: a warm fill, and two key lights high over the floor that put a sheen on the hardwood */
    scene.add(new T.HemisphereLight(0xfff6e8, 0x3a3028, 0.78));
    const sun = new T.DirectionalLight(0xffffff, 0.7); sun.position.set(20, 80, -30); scene.add(sun);
    const key2 = new T.DirectionalLight(0xfff2dd, 0.35); key2.position.set(-25, 70, 40); scene.add(key2);
    R.resize();
    R.loadModel();
  };

  /* indexed geometries with the same attributes, end to end in one */
  function mergeGeo(list) {
    const names = Object.keys(list[0].attributes), out = new T.BufferGeometry(), idx = [];
    let base = 0;
    for (const n of names) {
      const sz = list[0].attributes[n].itemSize, arr = new Float32Array(list.reduce((a, g) => a + g.attributes[n].array.length, 0));
      let o = 0; for (const g of list) { arr.set(g.attributes[n].array, o); o += g.attributes[n].array.length; }
      out.setAttribute(n, new T.BufferAttribute(arr, sz));
    }
    for (const g of list) { for (const i of g.index.array) idx.push(i + base); base += g.attributes.position.count; g.dispose(); }
    out.setIndex(idx);
    return out;
  }
  /* Build the arena for a game: home team's floor, both hoops, the stands. */
  /* ---------- the park: the court under a dusk sky, a chain-link fence, trees and lights, benches, and the rings you
     walk into (a pick-up game, the gym, the closet, the way back to your career) ---------- */
  let stations = [];
  function signTex(txt, sub, col) {
    const c = document.createElement('canvas'); c.width = 512; c.height = 160; const g = c.getContext('2d');
    g.fillStyle = 'rgba(10,10,14,.82)'; g.beginPath(); g.roundRect ? g.roundRect(6, 6, 500, 148, 26) : g.rect(6, 6, 500, 148); g.fill();
    g.strokeStyle = col; g.lineWidth = 6; g.stroke();
    g.fillStyle = '#fff'; g.textAlign = 'center'; let fs = 62; g.font = `900 ${fs}px Archivo, Arial, sans-serif`; while (g.measureText(txt).width > 460 && fs > 24) { fs -= 4; g.font = `900 ${fs}px Archivo, Arial, sans-serif`; } g.fillText(txt, 256, sub ? 82 : 100);
    if (sub) { g.fillStyle = 'rgba(255,255,255,.7)'; g.font = '600 32px Arial, sans-serif'; g.fillText(sub, 256, 128); }
    const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
  }
  function parkDressing(home) {
    /* the sky: a gradient from the last of the sun to night */
    const sc = document.createElement('canvas'); sc.width = 4; sc.height = 256; const sg = sc.getContext('2d'), gr = sg.createLinearGradient(0, 0, 0, 256);
    /* the hour on your own clock: a bright day, the last of the sun, or night (PB.parkTime forces one, for the test tools) */
    const hr = new Date().getHours(), tod = PB.parkTime || (hr >= 7 && hr < 17 ? 'day' : hr >= 17 && hr < 20 ? 'dusk' : 'night'), day = tod === 'day', night = tod === 'night';
    const stops = day ? ['#3f8fdc', '#7fbdf0', '#c4e4fa', '#e9f6ff'] : night ? ['#070b1a', '#10183a', '#1c2450', '#2b2f5c'] : ['#1b2440', '#5a4a78', '#e0876a', '#f2b66d'];
    gr.addColorStop(0, stops[0]); gr.addColorStop(0.55, stops[1]); gr.addColorStop(0.8, stops[2]); gr.addColorStop(1, stops[3]);
    scene.fog = day ? new T.Fog(0xbfe0f5, 140, 320) : night ? new T.Fog(0x161a36, 80, 220) : scene.fog;
    if (day) { const al = new T.AmbientLight(0xffffff, 0.55); scene.add(al); }
    sg.fillStyle = gr; sg.fillRect(0, 0, 4, 256); const st = new T.CanvasTexture(sc); st.colorSpace = T.SRGBColorSpace; scene.background = st; orphans.push(st);   // (a background is not in the scene: it is let go of with the next build)
    /* the city beyond the park: a skyline with lit windows, a few stars, the moon */
    { const kc = document.createElement('canvas'); kc.width = 1024; kc.height = 256; const k = kc.getContext('2d');
      let sd = 7; const rnd = () => (sd = (sd * 16807) % 2147483647) / 2147483647;
      if (!day) for (let i = 0; i < (night ? 130 : 45); i++) { k.fillStyle = `rgba(255,255,255,${0.35 + rnd() * 0.5})`; k.fillRect(rnd() * 1024, rnd() * 110, 2, 2); }
      if (day) { const sg2 = k.createRadialGradient(790, 50, 6, 790, 50, 46); sg2.addColorStop(0, 'rgba(255,252,230,1)'); sg2.addColorStop(0.35, 'rgba(255,246,200,.55)'); sg2.addColorStop(1, 'rgba(255,246,200,0)'); k.fillStyle = sg2; k.fillRect(740, 0, 100, 100);
        for (let i = 0; i < 7; i++) { const cx0 = rnd() * 1024, cy0 = 30 + rnd() * 70; k.fillStyle = 'rgba(255,255,255,.75)'; for (let j = 0; j < 4; j++) { k.beginPath(); k.ellipse(cx0 + j * 16 - 24, cy0 + (j % 2) * 5, 20, 9, 0, 0, 7); k.fill(); } } }
      else { k.fillStyle = '#f4ecd2'; k.beginPath(); k.arc(790, 46, 17, 0, 7); k.fill(); k.globalCompositeOperation = 'destination-out'; k.beginPath(); k.arc(798, 40, 15, 0, 7); k.fill(); k.globalCompositeOperation = 'source-over'; }
      for (let x = 0; x < 1024;) { const w = 26 + rnd() * 46, h = 50 + rnd() * 130; const sh = rnd() * 10 | 0; k.fillStyle = day ? `rgb(${128 + sh * 3},${146 + sh * 3},${170 + sh * 3})` : `rgb(${18 + sh},${20 + sh},${34 + sh})`; k.fillRect(x, 256 - h, w, h);
        for (let wy = 256 - h + 8; wy < 246; wy += 11) for (let wx = x + 5; wx < x + w - 6; wx += 9) if (rnd() < (day ? 0.5 : night ? 0.4 : 0.26)) { k.fillStyle = day ? 'rgba(70,96,128,.55)' : rnd() < 0.8 ? 'rgba(255,214,140,.85)' : 'rgba(170,210,255,.8)'; k.fillRect(wx, wy, 4, 5); }
        x += w + 2 + rnd() * 6; }
      const kt = new T.CanvasTexture(kc); kt.colorSpace = T.SRGBColorSpace; kt.wrapS = T.RepeatWrapping; kt.repeat.set(3, 1); orphans.push(kt);
      const ring = new T.Mesh(new T.CylinderGeometry(175, 175, 78, 40, 1, true), new T.MeshBasicMaterial({ map: kt, transparent: true, side: T.BackSide, fog: false, depthWrite: false }));
      ring.position.y = 37; ring.renderOrder = -1; scene.add(ring); }
    /* grass beyond the concrete */
    const grass = new T.Mesh(new T.PlaneGeometry(420, 420), new T.MeshLambertMaterial({ color: 0x2c4a2a })); grass.rotation.x = -Math.PI / 2; grass.position.y = -0.05; scene.add(grass);
    /* the fence: posts and a see-through chain-link panel on all four sides */
    const fc = document.createElement('canvas'); fc.width = fc.height = 64; const fg = fc.getContext('2d'); fg.strokeStyle = 'rgba(210,214,220,.75)'; fg.lineWidth = 2;
    fg.beginPath(); fg.moveTo(0, 32); fg.lineTo(32, 0); fg.lineTo(64, 32); fg.lineTo(32, 64); fg.closePath(); fg.stroke();
    const ft = new T.CanvasTexture(fc); ft.wrapS = ft.wrapT = T.RepeatWrapping;
    const FX = 36, FZ = 62, FH = 12; orphans.push(ft);
    const panel = (w, x, z, ry) => { const t = ft.clone(); t.needsUpdate = true; t.repeat.set(w / 1.6, FH / 1.6); const m = new T.Mesh(new T.PlaneGeometry(w, FH), new T.MeshBasicMaterial({ map: t, transparent: true, side: T.DoubleSide, depthWrite: false })); m.position.set(x, FH / 2, z); m.rotation.y = ry; scene.add(m); orphans.push(t); };
    panel(FX * 2, 0, FZ, 0); panel(FX * 2, 0, -FZ, 0); panel(FZ * 2, -FX, 0, Math.PI / 2);
    const pm = new T.MeshLambertMaterial({ color: 0x7c8088 });
    for (let x = -FX; x <= FX; x += 12) for (const z of [-FZ, FZ]) { const m = new T.Mesh(new T.CylinderGeometry(0.25, 0.25, FH, 6), pm); m.position.set(x, FH / 2, z); scene.add(m); }
    for (let z = -FZ; z <= FZ; z += 12.4) { const m = new T.Mesh(new T.CylinderGeometry(0.25, 0.25, FH, 6), pm); m.position.set(-FX, FH / 2, z); scene.add(m); }
    /* the other side is a wall: painted brick the length of the park, a door in it for every mode (the doors, their
       lights and their signs come with the rings), lamps between them, a sidewalk along it */
    { const bc = document.createElement('canvas'); bc.width = 256; bc.height = 128; const b = bc.getContext('2d');
      b.fillStyle = '#3a2f33'; b.fillRect(0, 0, 256, 128);
      for (let r = 0; r < 8; r++) for (let c = -1; c < 5; c++) { const x = c * 64 + (r % 2) * 32, y = r * 16, k = 70 + ((r * 7 + c * 13) % 5) * 9;
        b.fillStyle = `rgb(${k + 32},${k - 6},${k - 2})`; b.fillRect(x + 2, y + 2, 60, 12); }
      const bt = new T.CanvasTexture(bc); bt.colorSpace = T.SRGBColorSpace; bt.wrapS = bt.wrapT = T.RepeatWrapping; bt.repeat.set(FZ * 2 / 16, 18 / 8); orphans.push(bt);
      const wall = new T.Mesh(new T.BoxGeometry(1.4, 18, FZ * 2 + 1.4), new T.MeshLambertMaterial({ map: bt, color: 0x9a8f96 })); wall.position.set(FX + 0.7, 9, 0); scene.add(wall);
      const cap = new T.Mesh(new T.BoxGeometry(2, 0.8, FZ * 2 + 2), new T.MeshLambertMaterial({ color: 0x55585e })); cap.position.set(FX + 0.7, 18.3, 0); scene.add(cap);
      const walk = new T.Mesh(new T.PlaneGeometry(9, FZ * 2), new T.MeshLambertMaterial({ color: 0x6a6d74 })); walk.rotation.x = -Math.PI / 2; walk.position.set(FX - 4.5, 0.01, 0); scene.add(walk);
      const lampM = new T.MeshBasicMaterial({ color: day ? 0x8a8d92 : 0xfff1c8 });
      for (let z = -54; z <= 54; z += 12) { const l = new T.Mesh(new T.BoxGeometry(0.6, 1.2, 1.2), lampM); l.position.set(FX - 0.3, 13.5, z); scene.add(l); } }
    /* trees outside the fence */
    const tm = new T.MeshLambertMaterial({ color: 0x4a3426 }), lm = [0x2f5b2c, 0x3b6a33, 0x28502a].map(c => new T.MeshLambertMaterial({ color: c }));
    for (let i = 0; i < 22; i++) { const a = i / 22 * Math.PI * 2, rx = 48 + (i % 3) * 7, rz = 76 + (i % 4) * 6, x = Math.sin(a) * rx, z = Math.cos(a) * rz;
      const tr = new T.Mesh(new T.CylinderGeometry(0.8, 1.1, 10, 6), tm); tr.position.set(x, 5, z); scene.add(tr);
      const cn = new T.Mesh(new T.IcosahedronGeometry(6 + (i % 3) * 1.5, 0), lm[i % 3]); cn.position.set(x, 13 + (i % 2) * 2, z); scene.add(cn); }
    /* light poles at the corners, lamps lit */
    for (const [x, z] of [[-34, -60], [33, -60], [-34, 60], [33, 60], [-34, 0]]) {
      const pl = new T.Mesh(new T.CylinderGeometry(0.35, 0.45, 30, 6), pm); pl.position.set(x, 15, z); scene.add(pl);
      const lamp = new T.Mesh(new T.BoxGeometry(4, 1, 2), new T.MeshBasicMaterial({ color: day ? 0x8a8d92 : 0xfff1c8 })); lamp.position.set(x - Math.sign(x) * 1.5, 30, z); scene.add(lamp); }
    /* pools of lamplight on the ground: under the poles, and along the wall under its lamps */
    { const lc = document.createElement('canvas'); lc.width = lc.height = 128; const lg = lc.getContext('2d'), gr2 = lg.createRadialGradient(64, 64, 4, 64, 64, 64);
      gr2.addColorStop(0, 'rgba(255,236,200,.42)'); gr2.addColorStop(0.5, 'rgba(255,230,190,.14)'); gr2.addColorStop(1, 'rgba(255,230,190,0)'); lg.fillStyle = gr2; lg.fillRect(0, 0, 128, 128);
      const lt = new T.CanvasTexture(lc); orphans.push(lt);
      const lm2 = new T.MeshBasicMaterial({ map: lt, transparent: true, blending: T.AdditiveBlending, depthWrite: false });
      const pool2 = (x, z, r) => { if (day) return; const m = new T.Mesh(new T.PlaneGeometry(r * 2, r * 2), lm2); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.03, z); scene.add(m); };
      for (const [x, z] of [[-34, -60], [33, -60], [-34, 60], [33, 60], [-34, 0]]) pool2(x - Math.sign(x) * 4, z, 18);
      for (let z = -54; z <= 54; z += 12) pool2(FX - 3, z, 7); }
    /* a glow round every lamp, and the park's furniture: a boombox on a bench, trash cans, a rack of balls by the gym */
    { const hc = document.createElement('canvas'); hc.width = hc.height = 64; const hg = hc.getContext('2d'), gr3 = hg.createRadialGradient(32, 32, 1, 32, 32, 32);
      gr3.addColorStop(0, 'rgba(255,240,205,.95)'); gr3.addColorStop(0.25, 'rgba(255,232,180,.4)'); gr3.addColorStop(1, 'rgba(255,230,180,0)'); hg.fillStyle = gr3; hg.fillRect(0, 0, 64, 64);
      const ht = new T.CanvasTexture(hc); orphans.push(ht);
      const hm = new T.SpriteMaterial({ map: ht, transparent: true, opacity: 0.75, depthWrite: false, blending: T.AdditiveBlending, fog: false });
      const halo = (x, y, z, sz) => { if (day) return; const sp = new T.Sprite(hm); sp.position.set(x, y, z); sp.scale.setScalar(sz); scene.add(sp); };
      for (const [x, z] of [[-34, -60], [33, -60], [-34, 60], [33, 60], [-34, 0]]) halo(x - Math.sign(x) * 1.5, 29.6, z, 13);
      for (let z = -54; z <= 54; z += 12) halo(FX - 0.7, 13.5, z, 4);
      const dark = new T.MeshLambertMaterial({ color: 0x1b1c20 }), grey = new T.MeshLambertMaterial({ color: 0x4d5158 }), ballM = new T.MeshLambertMaterial({ color: 0xd4682a });
      const box = (w, h, d, x, y, z, m) => { const o = new T.Mesh(new T.BoxGeometry(w, h, d), m); o.position.set(x, y, z); scene.add(o); return o; };
      box(1.1, 1.3, 2.6, -32, 2.95, 21.5, dark); for (const dz of [-0.75, 0.75]) { const sp = new T.Mesh(new T.CylinderGeometry(0.42, 0.42, 0.1, 14), grey); sp.rotation.z = Math.PI / 2; sp.position.set(-31.42, 2.95, 21.5 + dz); scene.add(sp); }
      for (const [x, z] of [[-33.5, -48], [-33.5, 48], [33.2, -57.5]]) { const c = new T.Mesh(new T.CylinderGeometry(1.1, 0.9, 3, 10), grey); c.position.set(x, 1.5, z); scene.add(c); }
      box(0.5, 3.2, 5, 34.4, 1.6, -17.5, dark); for (let i = 0; i < 6; i++) { const bl = new T.Mesh(new T.SphereGeometry(0.39, 10, 8), ballM); bl.position.set(34.2, 1.05 + Math.floor(i / 3) * 1.15, -18.6 + (i % 3) * 1.1); scene.add(bl); } }
    /* benches along the sidelines */
    const bm = new T.MeshLambertMaterial({ color: 0x6b4a32 });
    for (const z of [-24, 24]) for (const x of [-32]) { const b = new T.Mesh(new T.BoxGeometry(2, 1.4, 10), bm); b.position.set(x, 1.6, z); scene.add(b); const b2 = new T.Mesh(new T.BoxGeometry(0.4, 2.4, 10), bm); b2.position.set(x + Math.sign(x) * 1, 2.6, z); scene.add(b2); }
    /* the park's name painted over the far fence */
    const nm = new T.Mesh(new T.PlaneGeometry(26, 5), new T.MeshBasicMaterial({ map: signTex(`${(home.city || 'THE').toUpperCase()} PARK`, 'run it back', home.c1), transparent: true }));
    nm.position.set(0, 19, FZ + 0.5); nm.rotation.y = Math.PI; scene.add(nm);
  }
  /* the rings you walk into: a glowing circle on the ground, a column of light and a sign over it */
  R.setStations = list => {
    for (const s0 of stations) { scene.remove(s0.g); freeTree(s0.g, true); }
    stations = [];
    for (const st of list || []) {
      const g = new T.Group(), col = new T.Color(st.color || '#4cffb0');
      const ring = new T.Mesh(new T.RingGeometry(st.r - 0.35, st.r, 40), new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.9, side: T.DoubleSide, depthWrite: false }));
      ring.rotation.x = -Math.PI / 2; ring.position.y = 0.06; g.add(ring);
      const disc = new T.Mesh(new T.CircleGeometry(st.r - 0.35, 40), new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.12, depthWrite: false })); disc.rotation.x = -Math.PI / 2; disc.position.y = 0.05; g.add(disc);
      const beam = new T.Mesh(new T.CylinderGeometry(st.r, st.r, 9, 32, 1, true), new T.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.1, side: T.DoubleSide, depthWrite: false, blending: T.AdditiveBlending })); beam.position.y = 4.5; g.add(beam);
      const sign = new T.Mesh(new T.PlaneGeometry(6.6, 2.05), new T.MeshBasicMaterial({ map: signTex(st.label, st.sub, st.color || '#4cffb0'), transparent: true, depthWrite: false })); sign.position.y = 8.6; sign.renderOrder = 6; g.add(sign);
      if (st.wall) {
        /* its door: dark, framed in light the ring's color, its name lit over it */
        const wx = 36 - st.x - 0.05, fr = new T.MeshBasicMaterial({ color: col });
        const door = new T.Mesh(new T.PlaneGeometry(5.2, 8.6), new T.MeshBasicMaterial({ color: 0x0c0c10 })); door.rotation.y = -Math.PI / 2; door.position.set(wx - 0.02, 4.3, 0); g.add(door);
        for (const [w, h, y, z] of [[0.35, 9, 4.5, -2.75], [0.35, 9, 4.5, 2.75], [5.85, 0.35, 9, 0]]) { const m = new T.Mesh(new T.BoxGeometry(0.3, h, w), fr); m.position.set(wx - 0.1, y, z); g.add(m); }
        const mq = new T.Mesh(new T.PlaneGeometry(9.6, 3), new T.MeshBasicMaterial({ map: signTex(st.label, st.sub, st.color || '#ffffff'), transparent: true })); mq.rotation.y = -Math.PI / 2; mq.position.set(wx - 0.15, 10.7, 0); g.add(mq);
        sign.visible = false;   // one sign a door: its name and what is behind it, over the frame
      }
      g.position.set(st.x, 0, st.z); scene.add(g); stations.push({ g, ring, beam, sign, id: st.id });
    }
  };
  R.stationLit = id => { for (const s0 of stations) { const on = s0.id === id; s0.beam.material.opacity = on ? 0.28 : 0.1; s0.ring.scale.setScalar(on ? 1.08 : 1); } };
  R.build = (home) => {
    stations = [];
    drillYaw = null;
    /* things made once, the first time they are needed, and hung in the arena: a new arena clears them out, so they
       are forgotten here and made again (the shot's trail and the cameras flashing in the stands used to be gone
       from the second game of a sitting on) */
    trail = null; trailPts = []; flashPts = null; confPts = null; leds.length = 0; shocks.length = 0;
    /* the last game's players, floor, stands, hoops and benches are let go of first: what they held in graphics
       memory (the floor alone is a seven-megabyte picture) used to stay there, game after game, until the phone gave up */
    for (const m of meshes.values()) { scene.remove(m.root); freeTree(m.root, true); }
    for (const g of orphans) g.dispose(); orphans.length = 0;
    meshes.clear(); refs = []; benchMesh = []; for (const k in tags) tags[k] = null; says.clear(); parkBalls.length = 0;
    while (scene.children.length > 2) { const o = scene.children[2]; scene.remove(o); freeTree(o, true); }
    /* every player's shadow, one instanced mesh */
    const sg = new T.CircleGeometry(1.1, 16); sg.rotateX(-Math.PI / 2);
    shadowIM = new T.InstancedMesh(sg, new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }), 32);
    shadowIM.count = 0; shadowIM.frustumCulled = false; scene.add(shadowIM);
    nets = [];
    const apron = new T.Mesh(new T.PlaneGeometry(90, 140), new T.MeshLambertMaterial({ color: home.park ? 0x55585e : 0x1c2333 }));
    apron.rotation.x = -Math.PI / 2; apron.position.y = -0.02; scene.add(apron);
    courtMat = new T.MeshPhongMaterial({ map: courtTexture(home), shininess: 38, specular: 0x2a2620 });   // a polished floor: the lights glint off it
    const court = new T.Mesh(new T.PlaneGeometry(50, 94), courtMat);
    court.rotation.x = -Math.PI / 2; scene.add(court);
    scene.add(hoop(1, home)); scene.add(hoop(-1, home));
    /* a pool of light on the floor, brightest at center court, fading toward the stands */
    const lc = document.createElement('canvas'); lc.width = lc.height = 256;
    const lg = lc.getContext('2d'), grd = lg.createRadialGradient(128, 128, 10, 128, 128, 128);
    grd.addColorStop(0, 'rgba(255,240,220,0.09)'); grd.addColorStop(0.6, 'rgba(255,240,220,0.03)'); grd.addColorStop(1, 'rgba(255,248,235,0)');
    lg.fillStyle = grd; lg.fillRect(0, 0, 256, 256);
    const pool = new T.Mesh(new T.PlaneGeometry(80, 130), new T.MeshBasicMaterial({ map: new T.CanvasTexture(lc), transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
    pool.rotation.x = -Math.PI / 2; pool.position.y = 0.015; scene.add(pool);
    /* the arena lights in the polish of the floor: long pale streaks, brightest down the middle */
    if (!home.park && !home.street) { const rc = document.createElement('canvas'); rc.width = 64; rc.height = 256; const rg = rc.getContext('2d'), g2 = rg.createRadialGradient(32, 128, 2, 32, 128, 128);
      g2.addColorStop(0, 'rgba(255,250,240,.5)'); g2.addColorStop(0.4, 'rgba(255,250,240,.14)'); g2.addColorStop(1, 'rgba(255,250,240,0)'); rg.save(); rg.translate(32, 128); rg.scale(0.25, 1); rg.translate(-32, -128); rg.fillStyle = g2; rg.fillRect(-200, 0, 464, 256); rg.restore();
      const rt = new T.CanvasTexture(rc), rm = new T.MeshBasicMaterial({ map: rt, transparent: true, blending: T.AdditiveBlending, depthWrite: false, opacity: 0.5 });
      for (const [x, z, k] of [[-9, -24, 1], [9, -24, 1], [-9, 24, 1], [9, 24, 1], [0, 0, 1.25], [-18, 0, 0.7], [18, 0, 0.7]]) { const m = new T.Mesh(new T.PlaneGeometry(7 * k, 30 * k), rm); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.018, z); scene.add(m); } }
    renderer.setClearColor(home.park ? 0x24304a : 0x0b0f17); scene.fog = home.park ? new T.Fog(0x3a3550, 90, 230) : new T.Fog(0x0b0f17, 120, 260); scene.background = null;
    if (home.park) parkDressing(home); else {
    /* stands: tiers on all four sides */
    const crowd = crowdTexture(home);
    /* all 44 tiers of each kind in one mesh: two draws for the whole crowd instead of eighty-eight */
    const sideM = crowd.clone(), endM = crowd.clone();
    sideM.needsUpdate = endM.needsUpdate = true; sideM.repeat.set(6, 1); endM.repeat.set(3, 1);
    crowdMaps = [sideM, endM];
    const sides = [], ends = [];
    for (let i = 0; i < 11; i++) {
      const h = 3 + i * 3.2, d = 8 + i * 5;
      for (const side of [-1, 1]) {
        sides.push(new T.BoxGeometry(5, 3.2, 150).translate(side * (25 + d), h - 1.6, 0));
        ends.push(new T.BoxGeometry(80 + d * 2, 3.2, 5).translate(0, h - 1.6, side * (47 + 10 + d)));
      }
    }
    scene.add(new T.Mesh(mergeGeo(sides), new T.MeshLambertMaterial({ map: sideM, color: 0xa9a7b0, emissive: 0x4a4852, emissiveMap: sideM })));
    scene.add(new T.Mesh(mergeGeo(ends), new T.MeshLambertMaterial({ map: endM, color: 0xa9a7b0, emissive: 0x4a4852, emissiveMap: endM })));
    /* the center-hung scoreboard: four screens over center court showing the score and the clock, and a ring of light */
    const jc = document.createElement('canvas'); jc.width = 512; jc.height = 256;
    board = { cv: jc, g: jc.getContext('2d'), tex: new T.CanvasTexture(jc), key: '' }; board.tex.colorSpace = T.SRGBColorSpace;
    const jm = new T.MeshBasicMaterial({ map: board.tex });
    const frame = new T.MeshLambertMaterial({ color: 0x15181f });
    const jb = new T.Group();
    const body = new T.Mesh(new T.BoxGeometry(17, 9, 17), frame); jb.add(body);
    for (let i = 0; i < 4; i++) {
      const sc = new T.Mesh(new T.PlaneGeometry(15.4, 7.7), jm);
      const a = i * Math.PI / 2; sc.position.set(Math.sin(a) * 8.55, 0, Math.cos(a) * 8.55); sc.rotation.y = a; jb.add(sc);
    }
    const ring = new T.Mesh(new T.CylinderGeometry(10, 10, 1.4, 32, 1, true), new T.MeshBasicMaterial({ color: new T.Color(home.c1), side: T.DoubleSide }));
    ring.position.y = -5.4; jb.add(ring);
    const ringT = new T.Mesh(new T.CylinderGeometry(9.2, 10, 0.5, 32, 1, true), new T.MeshBasicMaterial({ color: 0xffffff, side: T.DoubleSide, transparent: true, opacity: 0.7 }));
    ringT.position.y = -6.3; jb.add(ringT);
    const cable = new T.Mesh(new T.CylinderGeometry(0.15, 0.15, 30, 4), frame); cable.position.y = 19; jb.add(cable);
    jb.position.set(0, 44, 0); scene.add(jb);
    /* banners in the rafters over both ends: the titles won and the jerseys retired on this floor (kept on the device) */
    let bn = []; try { bn = (JSON.parse(localStorage.getItem('pbb.banners') || '{}')[home.id] || []).slice(-8); } catch (e) { bn = []; }
    if (PB.settings && PB.settings.gfx === 'Low') bn = [];
    bn.forEach((b, i) => {
      const cv = document.createElement('canvas'); cv.width = 128; cv.height = 224;
      const g = cv.getContext('2d');
      g.fillStyle = home.c1; g.fillRect(0, 0, 128, 224);
      g.fillStyle = home.c2; g.fillRect(6, 6, 116, 4); g.fillRect(6, 214, 116, 4);
      g.beginPath(); g.moveTo(0, 224); g.lineTo(64, 200); g.lineTo(128, 224); g.fill();
      g.textAlign = 'center'; g.fillStyle = home.c2;
      if (b.kind === 'jersey') {
        g.font = '900 72px Archivo, Arial'; g.fillText(String(b.num), 64, 110);
        g.font = '800 17px Archivo, Arial'; g.fillText(String(b.name || '').toUpperCase().slice(0, 11), 64, 150);
      } else {
        g.font = '900 15px Archivo, Arial'; g.fillText('LEAGUE', 64, 52); g.fillText('CHAMPIONS', 64, 72);
        g.font = '900 54px Archivo, Arial'; g.fillText('★', 64, 135);
        g.font = '800 16px Archivo, Arial'; g.fillText(String(b.text || '').toUpperCase(), 64, 172);
      }
      const tx = new T.CanvasTexture(cv); tx.colorSpace = T.SRGBColorSpace;
      const off = (i - (bn.length - 1) / 2) * 6.5, mat = new T.MeshBasicMaterial({ map: tx, side: T.DoubleSide });
      for (const side of [-1, 1]) {
        const m = new T.Mesh(new T.PlaneGeometry(5, 8.75), mat);
        m.position.set(off, 33, side * 64); m.rotation.y = side > 0 ? Math.PI : 0; scene.add(m);
      }
      /* and over the far sideline, where the broadcast camera sees them */
      const w = new T.Mesh(new T.PlaneGeometry(5, 8.75), mat);
      w.position.set(44, 19, off); w.rotation.y = -Math.PI / 2; scene.add(w);
    });
    /* LED ribbons along the front of the stands, in the home colors, scrolling */
    const rc = document.createElement('canvas'); rc.width = 512; rc.height = 32;
    const rg = rc.getContext('2d');
    rg.fillStyle = home.c1; rg.fillRect(0, 0, 512, 32);
    rg.fillStyle = home.c2; rg.font = '900 22px Archivo, Arial'; rg.textBaseline = 'middle';
    for (let x = 0; x < 512; x += 256) { rg.fillText(home.name.toUpperCase(), x + 10, 17); rg.fillRect(x + 200, 12, 40, 8); }
    const rt = new T.CanvasTexture(rc); rt.wrapS = T.RepeatWrapping; rt.colorSpace = T.SRGBColorSpace;
    ribbons = [];
    for (const side of [-1, 1]) {
      const t1 = rt.clone(); t1.needsUpdate = true; t1.repeat.set(10, 1);
      const m = new T.Mesh(new T.PlaneGeometry(150, 1.6), new T.MeshBasicMaterial({ map: t1 }));
      m.position.set(side * 30.45, 1.6, 0); m.rotation.y = -side * Math.PI / 2; scene.add(m); ribbons.push(t1);
      const t2 = rt.clone(); t2.needsUpdate = true; t2.repeat.set(6, 1);
      const e = new T.Mesh(new T.PlaneGeometry(90, 1.6), new T.MeshBasicMaterial({ map: t2 }));
      e.position.set(0, 1.6, side * 62.45); e.rotation.y = side > 0 ? Math.PI : 0; scene.add(e); ribbons.push(t2);
    }
    /* scorer's table */
    const table = new T.Mesh(new T.BoxGeometry(2.5, 3, 24), new T.MeshLambertMaterial({ color: new T.Color(home.c1) }));
    table.position.set(29, 1.5, 0); scene.add(table);   // across from the broadcast camera, between the benches
    }
    /* the ball and the rings under you and the ball handler */
    const bc = document.createElement('canvas'); bc.width = 128; bc.height = 64;
    const bg = bc.getContext('2d'); bg.fillStyle = '#d4682a'; bg.fillRect(0, 0, 128, 64);
    bg.strokeStyle = '#2a140a'; bg.lineWidth = 2.4;
    for (const x of [0, 32, 64, 96]) { bg.beginPath(); bg.moveTo(x, 0); bg.lineTo(x, 64); bg.stroke(); }
    bg.beginPath(); bg.moveTo(0, 32); bg.lineTo(128, 32); bg.stroke();
    const btx = new T.CanvasTexture(bc); btx.colorSpace = T.SRGBColorSpace;
    ballMesh = new T.Mesh(new T.SphereGeometry(0.39, 16, 12), new T.MeshLambertMaterial({ map: btx }));
    scene.add(ballMesh);
    ballShadow = new T.Mesh(new T.CircleGeometry(0.4, 12), new T.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.3, depthWrite: false }));
    ballShadow.rotation.x = -Math.PI / 2; scene.add(ballShadow);
    userRing = new T.Mesh(new T.RingGeometry(1.35, 1.75, 28), new T.MeshBasicMaterial({ color: 0x4cffb0, transparent: true, opacity: 0.9, depthWrite: false }));
    userRing.rotation.x = -Math.PI / 2; userRing.position.y = 0.04; scene.add(userRing);
    /* your legs, as an arc round your ring: full when fresh, shorter as you tire, red when you are spent */
    staRing = new T.Mesh(new T.RingGeometry(1.95, 2.12, 48, 1, Math.PI / 2, Math.PI * 2), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false }));
    staRing.rotation.x = -Math.PI / 2; staRing.position.y = 0.045; scene.add(staRing);
    /* Takeover: a column of white light around you, fading up from the floor */
    { const cv = document.createElement('canvas'); cv.width = 4; cv.height = 64; const g = cv.getContext('2d'), gr = g.createLinearGradient(0, 64, 0, 0);
      gr.addColorStop(0, 'rgba(255,255,255,0.55)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.18)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 4, 64);
      tkoBeam = new T.Mesh(new T.CylinderGeometry(1.5, 1.7, 7, 24, 1, true), new T.MeshBasicMaterial({ map: new T.CanvasTexture(cv), transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide }));
      tkoBeam.position.y = 3.5; tkoBeam.visible = false; scene.add(tkoBeam);
      /* and an aura: white sparks rising round you */
      const N = 36, pa = new Float32Array(N * 3), sc2 = document.createElement('canvas'); sc2.width = sc2.height = 32;
      { const g = sc2.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 32, 32); }
      tkoSparks = new T.Points(new T.BufferGeometry().setAttribute('position', new T.BufferAttribute(pa, 3)), new T.PointsMaterial({ size: 0.7, map: new T.CanvasTexture(sc2), transparent: true, depthWrite: false, blending: T.AdditiveBlending, color: 0xffffff }));
      tkoSparks.frustumCulled = false; tkoSparks.visible = false; tkoSparks.userData.seed = Array.from({ length: N }, () => [Math.random() * 6.283, Math.random(), 1.1 + Math.random() * 0.9]); scene.add(tkoSparks); }
    handRing = new T.Mesh(new T.RingGeometry(1.15, 1.35, 24), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false }));
    handRing.rotation.x = -Math.PI / 2; handRing.position.y = 0.03; scene.add(handRing);
    /* the pass preview (an arrow over the teammate your pass would go to), your man's ring on defense, a release flash */
    passArrow = new T.Mesh(new T.ConeGeometry(0.55, 1.1, 4), new T.MeshBasicMaterial({ color: 0x4cffb0, transparent: true, opacity: 0.9, depthTest: false }));
    passArrow.rotation.x = Math.PI; passArrow.renderOrder = 5; scene.add(passArrow);
    manRing = new T.Mesh(new T.RingGeometry(1.25, 1.5, 28), new T.MeshBasicMaterial({ color: 0xff4d5e, transparent: true, opacity: 0.75, depthWrite: false }));
    manRing.rotation.x = -Math.PI / 2; manRing.position.y = 0.035; scene.add(manRing);
    /* which way your man is going: a chevron on the floor in front of him when he has the ball, green while you are
       between him and the rim, red once he has a step on you */
    { const sh = new T.Shape(); sh.moveTo(0, 1.0); sh.lineTo(0.95, -0.25); sh.lineTo(0.42, -0.25); sh.lineTo(0, 0.42); sh.lineTo(-0.42, -0.25); sh.lineTo(-0.95, -0.25); sh.closePath();
      const g = new T.ShapeGeometry(sh); g.rotateX(Math.PI / 2);   // flat on the floor, pointing down +z
      defArrow = new T.Mesh(g, new T.MeshBasicMaterial({ color: 0x4cffb0, transparent: true, opacity: 0.8, depthWrite: false, side: T.DoubleSide }));
      defArrow.position.y = 0.04; defArrow.scale.setScalar(1.35); defArrow.visible = false; scene.add(defArrow);
      /* in the park, the way to where you are headed: the same chevron, in front of you, pointing there */
      guideArrow = new T.Mesh(g, new T.MeshBasicMaterial({ color: 0x4cffb0, transparent: true, opacity: 0.85, depthWrite: false, depthTest: false, side: T.DoubleSide }));
      guideArrow.renderOrder = 5; guideArrow.position.y = 0.05; guideArrow.scale.setScalar(1.3); guideArrow.visible = false; scene.add(guideArrow); }
    flash = new T.Mesh(new T.RingGeometry(1.6, 2.3, 32), new T.MeshBasicMaterial({ color: 0x4cffb0, transparent: true, opacity: 0, depthWrite: false }));
    flash.rotation.x = -Math.PI / 2; flash.position.y = 0.04; scene.add(flash);
  };

  /* the officials: two of them, gray shirts and black slacks. The lead works the baseline at the ball's end, the
     trail the far sideline a step behind the play. They are not players: nothing in the game touches them. */
  let refs = [], shadowIM = null;
  const _sm = new T.Matrix4();
  R._refs = () => refs.map(p => ({ x: p.x, z: p.z }));   // for the test tools
  R.addRefs = () => {
    refs = [];
    if (!TPL || (PB.settings && PB.settings.gfx === 'Low')) return;
    for (let i = 0; i < 2; i++) {
      const p = { id: 'ref' + i, x: 26.5, z: i ? 30 : -10, y: 0, vx: 0, vz: 0, face: -Math.PI / 2, pose: '', ht: 75, num: [14, 37][i], pos: 'SG', skin: [1, 4][i],
        look: { hair: i ? 'buzz' : 'bald', hairColor: '#2a2a2a', shoe: '#111111' } };
      const m = skinnedPlayer(p, { c1: '#f2f2f2', c2: '#16181b', alt: '#16181b', pat: 7, name: '', shorts: '#15171a', sock: '#15171a', shoe: '#111111', ref: true });
      if (shadowIM) { m.shadow.visible = false; m.inst = true; }
      scene.add(m.root); meshes.set(p, m); refs.push(p);
    }
  };
  R._refs = () => refs;
  /* an official's signal: 'sig3' both arms up for a three, 'sigf' a fist in the air for a foul */
  R.refSignal = (pose, sec) => { for (const r of refs) { r.pose = pose; r.sigU = performance.now() + (sec || 1.2) * 1000; } };
  function moveRefs(G, dt) {
    if (!refs.length || !G.ball) return;
    const b = G.ball, end = G.poss === 0 ? 1 : G.poss === 1 ? -1 : Math.sign(b.z) || 1;
    const tg = [{ x: 11, z: end * 48.6 }, { x: 26.3, z: Math.max(-38, Math.min(38, b.z - end * 13)) }];
    /* on a change of ends the lead becomes the trail and the trail the lead, the way crews work: whoever is nearer */
    const D = (r, t) => Math.hypot(r.x - t.x, r.z - t.z);
    if (D(refs[0], tg[0]) + D(refs[1], tg[1]) > D(refs[0], tg[1]) + D(refs[1], tg[0])) tg.reverse();
    refs.forEach((r, i) => {
      if (r.sigU && performance.now() > r.sigU) { r.sigU = 0; r.pose = ''; }
      const dx = tg[i].x - r.x, dz = tg[i].z - r.z, d = Math.hypot(dx, dz), top = d > 12 ? 17 : d > 3 ? 9 : 0;
      const tvx = d > 0.5 ? dx / d * top : 0, tvz = d > 0.5 ? dz / d * top : 0, k = Math.min(1, dt * 3);
      r.vx += (tvx - r.vx) * k; r.vz += (tvz - r.vz) * k;
      r.x += r.vx * dt; r.z += r.vz * dt;
      const want = Math.atan2(b.x - r.x, b.z - r.z); let da = want - r.face; da = Math.atan2(Math.sin(da), Math.cos(da)); r.face += da * Math.min(1, dt * 5);
    });
  }

  /* the benches: five seated reserves in warmups on each side of the scorer's table, and a coach standing at the end
     of each. Simple shapes in one mesh with vertex colors: one draw for both benches. */
  let benchMesh = [], benchJ = [0, 0], benchT = 0;
  R.benchJump = team => { benchJ[team] = 1.4; };   // a big play: that bench is up on its feet
  /* a man on the bench: the real model, sat down (or left standing: a coach), then baked into plain meshes. Nothing
     about him moves again, so there are no bones to work every frame */
  function baked(d, kit, x, z, faceY, sit) {
    const p = { d, team: 0, slot: 0, r: d.r || {}, ht: d.ht || 78, num: d.num, x: 0, z: 0, vx: 0, vz: 0, y: 0, vy: 0, face: 0, pose: '' };
    const m = skinnedPlayer(p, kit), grp = new T.Group(), B = n => m.bones[bk(n)], dir = (y, z) => V3().set(0, y, z).normalize();
    m.root.position.set(0, 0, 0); m.root.rotation.set(0, 0, 0); m.mixer.update(0.3 + (d.num || 0) * 0.37); m.root.updateMatrixWorld(true);
    let dy = 0;
    if (sit) {
      for (const S of ['L', 'R']) { const th = B(`DEF-thigh.${S}`), sh = B(`DEF-shin.${S}`), ft = B(`DEF-foot.${S}`);
        if (th && sh && ft) { aim(th, sh, dir(-0.10, 1), 1); m.root.updateMatrixWorld(true); aim(sh, ft, dir(-1, 0.10), 1); m.root.updateMatrixWorld(true); } }
      for (const A of [m.R, m.L]) if (A.up && A.fore && A.hand) { aim(A.up, A.fore, dir(-0.80, 0.55), 1); m.root.updateMatrixWorld(true); aim(A.fore, A.hand, dir(-0.30, 0.95), 1); m.root.updateMatrixWorld(true); }
      const th = B('DEF-thigh.L'); if (th) dy = 1.95 - th.getWorldPosition(V3()).y;
    }
    const v = V3(), M = new T.Matrix4().makeRotationY(faceY); M.setPosition(x, dy, z);
    m.root.traverse(o => { if (!o.isSkinnedMesh || o.material === OUTLINE_MAT || !o.visible || !o.geometry.attributes.skinIndex) return;
      const g0 = o.geometry, n = g0.attributes.position.count, P = new Float32Array(n * 3);
      const used = new Uint8Array(n), ia = g0.index ? g0.index.array : null; if (ia) for (let k = 0; k < ia.length; k++) used[ia[k]] = 1;   // only what is drawn (one hairstyle of many)
      for (let i = 0; i < n; i++) { if (ia && !used[i]) continue; o.getVertexPosition(i, v); v.applyMatrix4(o.matrixWorld).applyMatrix4(M); P[i * 3] = v.x; P[i * 3 + 1] = v.y; P[i * 3 + 2] = v.z; }
      const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(P, 3));
      for (const k of ['rA', 'rB', 'kpos', 'color']) if (g0.attributes[k]) g.setAttribute(k, g0.attributes[k]);
      g.setIndex(g0.index); g.computeVertexNormals(); grp.add(new T.Mesh(g, o.material)); });
    /* the player he was baked from is done with: free what was his alone (his number's texture, his shadow, his
       sleeves), keeping the two materials the baked meshes wear */
    { const keep = new Set(grp.children.map(c => c.material));
      m.root.traverse(o => { if (o.isSkinnedMesh) return;
        if (o.material) for (const mt of [].concat(o.material)) { if (keep.has(mt) || mt.userData.shared || mt === FACE_MAT) continue; if (mt.map && mt.map !== (TPL && TPL.sharedMap)) mt.map.dispose(); mt.dispose(); }
        if (o.geometry && !o.geometry.userData.shared && o.geometry !== (TPL && TPL.faceGeo)) o.geometry.dispose(); });
      if (m.mixer) { m.mixer.stopAllAction(); m.mixer.uncacheRoot(m.mixer.getRoot()); } }
    return grp;
  }
  R.setBenches = (kits, rosters) => {
    for (const m of benchMesh) { scene.remove(m); m.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o !== m && o.material && !o.material.userData.shared) o.material.dispose(); }); }
    benchMesh = [];
    const real = !!(TPL && TPL.model && !PB.mannequin && !PB.oldBody);
    if (!kits || (PB.settings && PB.settings.gfx === 'Low')) return;
    let parts = [];
    const col = new T.Color();
    const add = (g, x, y, z, c) => {
      g.translate(x, y, z); col.set(c);
      const n = g.attributes.position.count, a = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { a[i * 3] = col.r; a[i * 3 + 1] = col.g; a[i * 3 + 2] = col.b; }
      g.setAttribute('color', new T.BufferAttribute(a, 3)); g.deleteAttribute('uv'); parts.push(g);
    };
    kits.forEach((k, t) => {
      const side = t === 0 ? -1 : 1, warm = new T.Color(k.c1).multiplyScalar(0.85).getStyle();
      for (let i = 0; i < 5; i++) {
        const z = side * (15 + i * 2.1), x = 28.4, skin = PB.SKIN[(i * 3 + t * 2) % 6];
        add(new T.BoxGeometry(1.6, 1.5, 1.7), x + 0.5, 0.75, z, '#202530');                      // the chair
        add(new T.BoxGeometry(1.5, 0.5, 1.8), x + 0.6, 2.2, z, '#202530');
        if (real) continue;
        add(new T.CylinderGeometry(0.55, 0.62, 2.2, 10), x + 0.45, 2.75, z, warm);              // in warmups
        add(new T.SphereGeometry(0.58, 12, 9), x + 0.35, 4.5, z, skin);                          // a pocket-size head
        if (i % 4 !== 2) { const hc = new T.SphereGeometry(0.62, 12, 6, 0, Math.PI * 2, 0, Math.PI * 0.42); hc.rotateZ(0.35); add(hc, x + 0.4, 4.55, z, i % 3 ? '#17110d' : '#2b1d12'); }   // hair
        for (const sz of [-0.62, 0.62]) { const a = new T.CylinderGeometry(0.19, 0.17, 1.5, 6); a.rotateZ(0.75); add(a, x - 0.05, 2.75, z + sz, warm); }   // arms on the knees
        add(new T.BoxGeometry(1.8, 0.55, 1.05), x - 0.35, 1.75, z, warm);                    // thighs toward the floor
        add(new T.BoxGeometry(0.45, 1.6, 0.9), x - 1.15, 0.85, z, '#f2f2f2');                 // shins
        add(new T.BoxGeometry(0.9, 0.3, 0.9), x - 1.3, 0.15, z, '#e9e9e9');                   // shoes
      }
      /* the coach, standing at the end of the bench nearest half court */
      const cz = side * 12.6, cx = real ? 28.3 : 27.6;
      if (!real) { add(new T.BoxGeometry(0.7, 3, 1.1), cx, 1.5, cz, '#1d1f24');
        add(new T.CylinderGeometry(0.55, 0.6, 2.4, 8), cx, 4.2, cz, '#2b2e36');
        add(new T.SphereGeometry(0.42, 8, 6), cx, 5.85, cz, PB.SKIN[(t * 4 + 1) % 6]); }
      const m = new T.Mesh(mergeGeo(parts), new T.MeshLambertMaterial({ vertexColors: true }));
      if (real) { const ro = (rosters && rosters[t]) || [], pg = new T.Group(); pg.visible = !lite; m.add(pg); m.userData.pl = pg;   // the reserves get up on a big play; the chairs and the coach stay put
        for (let i = 0; i < 5; i++) { const d = ro[i] || { id: 'bench' + t + i + (k.name || ''), last: 'B' + i, pos: ['PG', 'SG', 'SF', 'PF', 'C'][i], ht: 75 + i * 2, skin: (i * 3 + t * 2) % 6, num: 20 + i * 3 + t };
          try { pg.add(baked(d, k, 28.15, side * (15 + i * 2.1), -Math.PI / 2, true)); } catch (e) { console.warn('bench', e); } }
        try { m.add(baked({ id: 'coach' + t + (k.name || ''), last: 'Coach', pos: 'SF', ht: 74, skin: (t * 4 + 1) % 6, look: { hair: t ? 'short' : 'buzz', hairColor: t ? '#17110d' : '#8d8d8d', beard: t ? null : 'stubble', face: 1 + t } },
          { c1: '#23262d', c2: '#23262d', alt: '#23262d', pat: 0, name: '', shorts: '#1b1d22', sock: '#15171a', shoe: '#111111', ref: 2 }, cx, cz, -Math.PI / 2, false)); } catch (e) { console.warn('coach', e); } }
      scene.add(m); benchMesh.push(m); parts = [];
    });
  };

  /* all: nobody else is on the floor (a new game, a picture just taken), so a player's own face geometry can go too
     (it shares its vertex data with everyone's: while others are being drawn it is left alone) */
  function freeTree(root, all) {
    root.traverse(o => {
      if (o.material) for (const mt of [].concat(o.material)) { if (mt.userData.shared) continue; if (mt.map && mt.map !== (TPL && TPL.sharedMap)) mt.map.dispose(); if (mt !== FACE_MAT) mt.dispose(); }
      if (o.geometry && !o.geometry.userData.shared && o.geometry !== (TPL && TPL.faceGeo) && o.geometry !== (TPL && TPL.simpleGeo) && (!o.isSkinnedMesh || (all && o.geometry.userData.own))) o.geometry.dispose();
      if (o.isInstancedMesh && o.dispose) o.dispose();
      if (o.isSkinnedMesh && o.skeleton && o.skeleton.boneTexture) o.skeleton.dispose();   // each player's skeleton holds a texture of its own
    });
  }
  R.removePlayer = p => {
    const m = meshes.get(p); if (!m) return;
    scene.remove(m.root); meshes.delete(p);
    /* free what was his alone: materials and their textures, and his own small geometries (the body and the face are shared).
       His face geometry waits for the next arena (others are still drawn from the vertex data it shares) */
    m.root.traverse(o => { if (o.isSkinnedMesh && o.geometry && o.geometry.userData.own) orphans.push(o.geometry); });
    freeTree(m.root);
  };
  R.addPlayer = (p, kit) => {
    const m = TPL ? skinnedPlayer(p, kit) : playerMesh(p, kit);
    if (m.kind === 'skin' && shadowIM) { m.shadow.visible = false; m.inst = true; }   // drawn with everyone else's, in one go
    scene.add(m.root);
    meshes.set(p, m);
  };

  R.setZoom = z => { zoom = PB.clamp(z, 0.7, 1.5); };
  let replay = false, replayA = 0;
  let drillYaw = null;
  let intro = 0, introT = 3.2;   // seconds left of the opening flyover, and its length
  /* the showcase: you alone at center court in your team's uniform, the camera circling slowly; draft night and
     awards night draw it behind their cards */
  let show = null;
  R.showcase = (player, team) => {
    const el = document.getElementById('game');
    if (!player) { if (show) { cancelAnimationFrame(show.raf); show = null; el.classList.remove('show'); if (!PB.Game.active) el.hidden = true; } return; }
    el.hidden = false; el.classList.add('show'); R.resize();
    R.build(team);
    const p = { d: player, team: 0, slot: 0, r: player.r, ht: player.ht, num: player.num, x: 0, z: 0, vx: 0, vz: 0, y: 0, vy: 0, face: Math.PI, pose: '' };
    R.addPlayer(p, PB.kit ? PB.kit(team, "icon") : { c1: team.c1, c2: team.c2, name: team.name });
    let a = Math.PI;   // start in front of him
    const g = { t: 0, ball: { x: 0, y: -5, z: 0, state: 'show', holder: null }, user: null, pl: [p], teams: [team, team], score: [0, 0], q: 1, clock: 0, shotClock: 0, poss: null, show: true };
    let last = performance.now();
    show = { p, g };
    const loop = now => {
      show.raf = requestAnimationFrame(loop);
      if (now - last < 31) return;   // thirty frames a second is plenty behind a menu, and kinder to the battery
      const dt = Math.max(0, Math.min(0.05, (now - last) / 1000)); last = now; g.t += dt; a += dt * 0.25;
      /* he works the ball: a dribble, and every couple of seconds a move (crossover, between the legs, behind the back) */
      const b = g.ball;
      if (!p.mv || g.t - p.mv.t0 > 2.4) { const k = ['cross', 'legs', 'btb', 'cross', 'hesi'][Math.floor(g.t / 2.4) % 5], from = p.dribHand || 1, to = k === 'hesi' ? from : -from;
        p.mv = { k, t0: g.t, T: { cross: 0.32, btb: 0.4, legs: 0.38, hesi: 0.5 }[k], a: from, b: to }; p.dribHand = to; }
      p.dph = Math.PI / 2 + Math.max(0, g.t - p.mv.t0 - p.mv.T) * 8.5;
      R.update(g, dt);
      const H = R.hands(p);
      if (H) { b.state = 'held'; b.holder = p;
        const mv = p.mv, ms = (g.t - mv.t0) / mv.T, A0 = mv.a < 0 ? H.l : H.r;
        if (ms < 1 && mv.k !== 'hesi') PB.crossBounce(b, p, mv, ms, H);
        else if (ms < 1) { b.x = A0.x; b.y = Math.max(1.2, A0.y - 0.15); b.z = A0.z; }
        else { const hh = p.dribHand < 0 ? H.l : H.r; b.x = hh.x; b.z = hh.z; b.y = 0.4 + Math.abs(Math.sin(p.dph)) * (Math.max(1.2, hh.y - 0.35) - 0.4); } }
      cam.position.set(Math.sin(a) * 14.5, 4.4 + Math.sin(a * 0.7) * 0.6, Math.cos(a) * 14.5);
      cam.lookAt(0, 2.5, 0);
      R.render(true);
    };
    show.raf = requestAnimationFrame(loop);
  };
  let introFocus = null;
  let cine = null;
  R.cine = (shots, done) => { const was = cine; cine = shots && shots.length ? { shots, i: 0, t: 0, done } : null; if (!cine && was) { snap = true; if (was.done) was.done(); } };
  R.cineOn = () => !!cine;
  R.setIntro = (sec, focus) => { intro = sec; if (sec > 0) introT = sec; introFocus = sec > 0 ? focus || null : null; };
  let replayD = 1;
  const hidNear = [];
  R.setReplay = on => { replay = on; replayA = null; replayD = PB.rand() < 0.5 ? -1 : 1; };
  /* cameras: 'lock' (player lock, behind you toward the rim in play), 'broadcast' (the sideline), 'overhead' */
  R.CAMS = { lock: 'Player lock', broadcast: 'Broadcast', overhead: 'Overhead' };
  let snap = false; R.snap = () => { snap = true; };
  let parkYaw = null; R.parkYaw = y => { parkYaw = y; };
  R.setCam = m => { camMode = R.CAMS[m] ? m : 'lock'; R.resize(); };
  R.getCam = () => camMode;
  /* player lock framing: how far behind you, how high, how far ahead it looks, the lens */
  R.lock = { back: 42, up: 32, ahead: 8, fov: 52 };   // high and wide: you, the lane and the rim, and most of the floor
  R.getZoom = () => zoom;

  /* Pose every player from the game state. */
  R.update = (G, dt) => {
    shockTick(dt); puffTick(dt);
    if (!G.replay) moveRefs(G, dt);
    benchT += dt;
    benchMesh.forEach((m0, t) => { const m = m0.userData.pl || m0; if (benchJ[t] > 0) { benchJ[t] = Math.max(0, benchJ[t] - dt); m.position.y = Math.abs(Math.sin(benchT * 11 + t)) * 0.7 * Math.min(1, benchJ[t]); } else m.position.y = 0; });
    let si = 0;
    for (const [p, m] of meshes) {
      if (m.kind === 'skin') {
        updateSkinned(p, m, G, dt);
        const k = 1 - Math.min(p.y / 8, 0.5);
        if (!m.root.visible) { /* stepped out of a replay's shot: no shadow either */ }
        else if (m.inst && shadowIM && si < shadowIM.instanceMatrix.count) { _sm.makeScale(k, 1, k).setPosition(p.x, 0.02, p.z); shadowIM.setMatrixAt(si++, _sm); }
        else { m.shadow.position.set(0, 0.02, 0); m.shadow.scale.setScalar(k); }
        continue;
      }
      m.root.position.set(p.x, 0, p.z); m.py = p.y;
      const sp = Math.hypot(p.vx, p.vz);
      m.body.position.y = p.y;
      m.root.rotation.y = p.face;
      m.phase += dt * (2 + sp * 0.55);
      const swing = Math.min(sp / 16, 1) * 0.85;
      const s = Math.sin(m.phase);
      const air = p.y > 0.05;
      m.legs[0].rotation.x = air ? -0.5 : s * swing;
      m.legs[1].rotation.x = air ? -0.2 : -s * swing;
      let a0 = -s * swing * 0.8, a1 = s * swing * 0.8, z0 = 0.08, z1 = -0.08;
      if (p.pose === 'shoot') { a0 = a1 = -2.9; z0 = 0.15; z1 = -0.15; }
      else if (p.pose === 'contest') { a0 = a1 = -3.0; z0 = 0.35; z1 = -0.35; }
      else if (p.pose === 'chestPass' || p.pose === 'catch') { a0 = a1 = -1.5; }
      else if (p.pose === 'bpass') { a0 = a1 = -0.85; }
      else if (p.pose === 'lobPass') { a0 = a1 = -2.1; }
      else if (p.pose === 'reach') { a0 = -1.4; }
      else if (p.pose === 'dribble') { a1 = -0.55 + Math.abs(Math.sin(G.t * 9)) * 0.35; }
      else if (p.pose === 'guard') { a0 = a1 = -0.5; z0 = 0.5; z1 = -0.5; }
      else if (p.pose === 'celebrate') { a0 = a1 = -3.0; z0 = 0.5; z1 = -0.5; }
      m.arms[0].rotation.x += (a0 - m.arms[0].rotation.x) * Math.min(1, dt * 14);
      m.arms[1].rotation.x += (a1 - m.arms[1].rotation.x) * Math.min(1, dt * 14);
      m.arms[0].rotation.z = -z0; m.arms[1].rotation.z = -z1;
      m.body.rotation.x = p.pose === 'guard' ? 0.18 : air ? 0 : Math.min(sp / 20, 1) * 0.15;
      m.shadow.position.set(0, 0.02 - p.y, 0);
      m.shadow.scale.setScalar(1 - Math.min(p.y / 8, 0.5));
    }
    const b = G.ball;
    ballMesh.position.set(b.x, b.y, b.z);
    /* the ball turns the way it travels: backspin on a shot and a pass, forward off the dribble or rolling loose, and
       it sits still in the hands of a man holding it */
    { const dx = b.x - (ballMesh.userData.px ?? b.x), dz = b.z - (ballMesh.userData.pz ?? b.z), sp = dt > 0 ? Math.hypot(dx, dz) / dt : 0; ballMesh.userData.px = b.x; ballMesh.userData.pz = b.z;
      ballMesh.rotation.order = 'YXZ'; if (sp > 2) ballMesh.rotation.y = Math.atan2(dx, dz);
      const h = b.holder, drib = b.state === 'held' && h && !h.shoot && !h.inb && G.phase !== 'ft' && h.pose !== 'hold' && !(h.fakeT !== undefined && G.t - h.fakeT < 0.4);
      ballMesh.rotation.x += dt * (b.state === 'shot' ? -9 : b.state === 'pass' ? (b.bounce ? 7 : -5) : b.state === 'held' ? (drib ? 6 : 0) : Math.min(14, 3 + sp * 0.5)); }
    ballShadow.position.set(b.x, 0.03, b.z);
    /* the park regulars' own balls */
    { let n = 0;
      if (G.park) for (const p of G.pl) if (p.pb) {
        let m = parkBalls[n]; if (!m) { m = new T.Mesh(ballMesh.geometry, ballMesh.material); scene.add(m); parkBalls[n] = m; }
        m.visible = true; m.position.set(p.pb.x, p.pb.y, p.pb.z); m.rotation.x += dt * (p.pb.st === 'air' ? -9 : 6); n++; }
      for (let i = n; i < parkBalls.length; i++) parkBalls[i].visible = false; }
    const u = G.user;
    userRing.visible = !!u;
    if (staRing) { const e = u && u.energy !== undefined && !G.drill ? Math.max(0, Math.min(1, u.energy)) : -1; staRing.visible = e >= 0 && e < 0.995;
      if (staRing.visible) { staRing.position.x = u.x; staRing.position.z = u.z; staRing.geometry.setDrawRange(0, 6 * Math.max(1, Math.round(48 * e))); staRing.material.color.setHex(e < 0.3 ? 0xff5a6b : 0xffffff); } }
    if (u) { userRing.position.x = u.x; userRing.position.z = u.z; userRing.material.opacity = 0.65 + 0.3 * Math.sin(G.t * 5); }
    const tk = !!(u && G.tko && G.tko.on);
    if (tkoSparks) { tkoSparks.visible = tk; if (tk) { const P = tkoSparks.geometry.attributes.position, S = tkoSparks.userData.seed;
      for (let i = 0; i < S.length; i++) { const [a, ph, r] = S[i], f = (G.t * 0.7 + ph) % 1, aa = a + G.t * 1.2; P.setXYZ(i, u.x + Math.cos(aa) * r * (1 - f * 0.4), u.y + f * 7.5, u.z + Math.sin(aa) * r * (1 - f * 0.4)); }
      P.needsUpdate = true; tkoSparks.material.opacity = 0.75 + 0.25 * Math.sin(G.t * 7); } }
    if (tkoBeam) { tkoBeam.visible = tk; if (tk) { tkoBeam.position.set(u.x, 3.5 + u.y, u.z); const k = 1 + 0.06 * Math.sin(G.t * 9); tkoBeam.scale.set(k, 1, k); tkoBeam.rotation.y += dt * 1.5; } }
    if (u) { userRing.material.color.set(tk ? 0xffffff : 0x4cffb0); userRing.scale.setScalar(tk ? 1.12 + 0.08 * Math.sin(G.t * 9) : 1); }
    const h = b.state === 'held' && b.holder !== u ? b.holder : null;
    handRing.visible = !!h;
    if (h) { handRing.position.x = h.x; handRing.position.z = h.z; handRing.material.color.set(h.team === 0 ? 0xffffff : 0xff6a6a); }
    if (shadowIM) { shadowIM.count = si; shadowIM.instanceMatrix.needsUpdate = true; }
    if (board && G.teams) {
      const fmt = c => c >= 60 ? `${Math.floor(c / 60)}:${String(Math.floor(c % 60)).padStart(2, '0')}` : Math.max(0, c).toFixed(1);
      const q = G.q <= 4 ? ['1ST', '2ND', '3RD', '4TH'][G.q - 1] : 'OT';
      if (boardMsg && boardMsg.t > 0) boardMsg.t -= dt;
      const msg = boardMsg && boardMsg.t > 0 ? boardMsg : null, blink = msg ? Math.floor(boardMsg.t * 3) % 2 : 0;
      const key = msg ? `m|${msg.text}|${blink}` : `${G.score[0]}|${G.score[1]}|${q}|${fmt(G.clock)}|${Math.ceil(G.shotClock)}`;
      if (key !== board.key) {
        board.key = key;
        const g = board.g, W2 = 512;
        g.fillStyle = '#05070b'; g.fillRect(0, 0, W2, 256);
        if (msg) {   // a message for the building, in the home colors
          const h = G.teams[G.home === 1 ? 1 : 0];
          g.fillStyle = blink ? h.c1 : '#05070b'; g.fillRect(0, 0, W2, 256);
          g.fillStyle = blink ? (PB.ink ? PB.ink(h.c1, h.c2) : '#fff') : h.c1 === '#000000' ? '#fff' : h.c1;
          g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `900 ${msg.text.length > 12 ? 52 : 72}px Archivo, Arial`;
          const lines = msg.text.split('\n'); lines.forEach((ln, i) => g.fillText(ln, 256, 128 + (i - (lines.length - 1) / 2) * 70));
          board.tex.needsUpdate = true;
        } else {
        for (const [i, t] of [[0, G.teams[0]], [1, G.teams[1]]]) {
          const x = i ? 384 : 128;
          g.fillStyle = t.c1; g.fillRect(x - 118, 18, 236, 44);
          g.fillStyle = '#fff'; g.font = '900 34px Archivo, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t.ab || t.id, x, 41);
          g.fillStyle = '#ffffff'; g.font = '900 96px Archivo, Arial'; g.fillText(String(G.score[i]), x, 132);
        }
        g.fillStyle = '#fff'; g.font = '800 40px Archivo, Arial'; g.fillText(fmt(G.clock), 256, 212);
        g.fillStyle = '#8d99b0'; g.font = '800 26px Archivo, Arial'; g.fillText(q, 256, 176);
        g.fillStyle = '#ff5a6b'; g.font = '900 30px Archivo, Arial'; g.fillText(String(Math.max(0, Math.ceil(G.shotClock))), 460, 212);
        board.tex.needsUpdate = true;
        }
      }
    }
    for (const r of ribbons) r.offset.x = (r.offset.x + dt * 0.05) % 1;
    if (tag && tagP) tag.position.set(tagP.x, (tagP.ht || 78) / 12 + 3.9 + tagP.y, tagP.z);
    if (G.pl && !G.show) R.nameTags(G);
    if (guideArrow) { const gx = G.park && G.user && G.guideXZ, u0 = G.user;
      const d = gx ? Math.hypot(gx.x - u0.x, gx.z - u0.z) : 0; guideArrow.visible = !!gx && d > 4;
      if (guideArrow.visible) { const dx = (gx.x - u0.x) / d, dz = (gx.z - u0.z) / d, bob = 3.4 + Math.sin(G.t * 5) * 0.45;
        guideArrow.position.x = u0.x + dx * bob; guideArrow.position.z = u0.z + dz * bob; guideArrow.rotation.y = Math.atan2(dx, dz); } }
    if (passArrow) {
      passArrow.visible = !!passTarget;
      if (passTarget) { passArrow.position.set(passTarget.x, (passTarget.ht || 78) / 12 + 2.4 + Math.sin(G.t * 6) * 0.25 + passTarget.y, passTarget.z); passArrow.rotation.y += dt * 2; }
      manRing.visible = !!manTarget;
      if (manTarget) { manRing.position.x = manTarget.x; manRing.position.z = manTarget.z; }
      { const h = manTarget, uu = G.user, on = !!(h && uu && G.ball.holder === h && !h.shoot && !h.inb && G.phase === 'live' && Math.hypot(h.x - uu.x, h.z - uu.z) < 16);
        if (defArrow) defArrow.visible = on;
        if (on) { const rz = G.half || h.team === 0 ? 41.75 : -41.75, hx = -h.x, hz = rz - h.z, hl = Math.hypot(hx, hz) || 1, sp = Math.hypot(h.vx, h.vz);
          const dx = sp > 2.5 ? h.vx / sp : hx / hl, dz = sp > 2.5 ? h.vz / sp : hz / hl;
          /* in front: you are nearer the rim than he is, along his line to it, and close enough to matter */
          const ahead = ((uu.x - h.x) * hx + (uu.z - h.z) * hz) / hl, off = Math.abs((uu.x - h.x) * -hz + (uu.z - h.z) * hx) / hl, good = ahead > 0.4 && ahead < 6.5 && off < 2.6;
          defArrow.position.x = h.x + dx * 2.3; defArrow.position.z = h.z + dz * 2.3; defArrow.rotation.y = Math.atan2(dx, dz);
          defArrow.material.color.setHex(good ? 0x4cffb0 : 0xff4d5e); defArrow.material.opacity = 0.55 + 0.3 * Math.min(1, sp / 8); } }
      if (flashT > 0 && G.user) { flashT -= dt; const k = 1 - flashT / 0.6; flash.position.x = G.user.x; flash.position.z = G.user.z; flash.scale.setScalar(1 + k * 1.2); flash.material.opacity = 0.85 * (1 - k); } else flash.material.opacity = 0;
    }
    arenaBits(dt);
    if (hype > 0) { hype = Math.max(0, hype - dt); const j = Math.abs(Math.sin(G.t * 14)) * 0.035 * Math.min(1, hype); for (const m of crowdMaps) m.offset.y = j; }
    /* a glowing trail behind the ball on your shots */
    if (!trail) {
      trail = new T.Line(new T.BufferGeometry().setFromPoints(Array.from({ length: 24 }, () => new T.Vector3())), new T.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 }));
      trail.frustumCulled = false; scene.add(trail);
    }
    const mine = b.state === 'shot' && b.shot && b.shot.shooter === G.user;
    if (mine) { trailPts.push(new T.Vector3(b.x, b.y, b.z)); if (trailPts.length > 24) trailPts.shift(); }
    else if (trailPts.length) trailPts.shift();
    trail.visible = trailPts.length > 1;
    if (trail.visible) trail.material.color.setHex(G.greenShot ? 0x4cffb0 : 0xffffff);
    if (trail.visible) { const pos = trail.geometry.attributes.position; for (let i = 0; i < 24; i++) { const q = trailPts[Math.min(i, trailPts.length - 1)]; pos.setXYZ(i, q.x, q.y, q.z); } pos.needsUpdate = true; trail.geometry.computeBoundingSphere(); }
    for (const n of nets) {
      n.swish = Math.max(0, n.swish - dt * 2.2);
      n.mesh.scale.set(1 - n.swish * 0.25, 1 + n.swish * 0.35, 1 - n.swish * 0.25);
      /* a dunk pulls the rim down and lets it go: it springs back, the net with it */
      if (n.snap > 0 || n.bent) { n.snap = Math.max(0, n.snap - dt * 1.9); const bend = n.snap * n.snap * Math.cos((1 - n.snap) * 21) * 0.15; n.bent = n.snap > 0;
        n.rim.rotation.x = Math.PI / 2 + bend * n.s; n.rim.position.y = 10 - Math.abs(bend) * 0.9; n.mesh.position.y = 9.25 - n.swish * 0.26 - Math.abs(bend) * 0.9; }
      else n.mesh.position.y = 9.25 - n.swish * 0.26;
    }
    if (G.show) return;
    if (cine) {
      /* a cut scene: one camera move after another, each circling what it is watching */
      const sh = cine.shots[cine.i]; cine.t += dt; const k0 = Math.min(1, cine.t / sh.dur), e = k0 * k0 * (3 - 2 * k0), mix = v => v[0] + (v[1] - v[0]) * e;
      const f = sh.focus, fx = f ? f.x : 0, fz = f ? f.z : 0, a = mix(sh.a), r = mix(sh.r);
      cam.position.set(fx + Math.sin(a) * r, mix(sh.h), fz + Math.cos(a) * r); cam.lookAt(fx, sh.ly === undefined ? 4 : sh.ly, fz);
      camPos.copy(cam.position); camLook.set(fx, 2, fz);
      if (k0 >= 1) { cine.t = 0; if (++cine.i >= cine.shots.length) { const done = cine.done; cine = null; snap = true; if (done) done(); } }
      return;
    }
    if (intro > 0) {
      /* the opening: high over the arena, sweeping down toward center court */
      intro = G && G.phase === 'tip' && G.tipT > 0 ? Math.max(0, G.tipT - 0.4) : Math.max(0, intro - dt);   // in step with the tip
      const k = 1 - intro / introT, a = 2.4 - k * 2.4;
      cam.position.set(Math.sin(a) * (70 - k * 30), 48 - k * 26, Math.cos(a) * (70 - k * 30) - 10 * k);
      cam.lookAt(0, 6 - k * 4, 0);
      /* the last stretch: close on your player, slowly circling */
      if (introFocus && intro < 2.4) { const f = introFocus, H = (f.ht || 78) / 12;
        /* from in front of him, on whichever side nobody stands in the way */
        if (f.introA === undefined) { let best = -1; f.introA = f.face || 0;
          for (const da of [0.35, -0.35, 0, 0.7, -0.7]) { const a0 = (f.face || 0) + da, cx = f.x + Math.sin(a0) * 8, cz = f.z + Math.cos(a0) * 8; let m = 99;
            for (const o of G.pl) { if (o === f) continue; const vx = cx - f.x, vz = cz - f.z, L2 = vx * vx + vz * vz, t = Math.max(0, Math.min(1, ((o.x - f.x) * vx + (o.z - f.z) * vz) / L2)); m = Math.min(m, Math.hypot(f.x + vx * t - o.x, f.z + vz * t - o.z)); }
            if (m > best + 0.3) { best = m; f.introA = a0; } } }
        const aa = f.introA + (2.4 - intro) * 0.12;
        cam.position.set(f.x + Math.sin(aa) * 8, H * 0.9, f.z + Math.cos(aa) * 8); cam.lookAt(f.x, H * 0.72, f.z); }
      camPos.copy(cam.position); camLook.set(0, 2, 0);
      if (intro === 0) R.snap();
      return;
    }
    if (hidNear.length) { for (const m of hidNear) m.root.visible = true; hidNear.length = 0; }
    if (replay) {
      /* replay: low, close, circling the ball */
      const bx = PB.clamp(b.x, -20, 20), bz = PB.clamp(b.z, -44, 44);
      /* it starts from the rim's side of the play, so the scorer comes at the camera and nobody's back is in the way,
         a little above the heads, then drifts round */
      if (replayA === null) replayA = Math.atan2(-bx, (bz >= 0 ? 41.75 : -41.75) - bz) + (PB.rand() - 0.5) * 1.1;
      replayA += dt * 0.3 * replayD;
      const rr = 18, cx = PB.clamp(bx + Math.sin(replayA) * rr, -29, 29), cz = PB.clamp(bz + Math.cos(replayA) * rr, -52, 52);
      cam.position.set(cx, 9, cz);
      cam.lookAt(bx, Math.max(4.5, b.y * 0.6), bz);
      /* a bystander standing right in front of the lens (the back of his head filled the picture) steps out of the shot */
      for (const [p, m] of meshes) if (p !== b.holder && !p.shoot && p !== b.shooter && Math.hypot(p.x - cx, p.z - cz) < 12 && Math.hypot(p.x - bx, p.z - bz) > 6) { m.root.visible = false; hidNear.push(m); }
      return;
    }
    if (G.park && G.user) {
      const u = G.user, sp = Math.hypot(u.vx, u.vz);
      if (parkYaw !== null) { yaw = parkYaw; parkYaw = null; snap = true; }
      else if (yaw === undefined || yaw === null) { yaw = Math.atan2(0 - u.x, 41.75 - u.z); }
      if (sp > 4) { const want = Math.atan2(u.vx, u.vz); let dy = want - yaw; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI; if (Math.abs(dy) < 2.6) yaw += dy * Math.min(1, dt * 1.1); }
      anchor.lerp(new T.Vector3(u.x, 0, u.z), Math.min(1, dt * 6)); if (!dt || snap) { anchor.set(u.x, 0, u.z); snap = false; }
      const fx = Math.sin(yaw), fz = Math.cos(yaw), back = 24 * zoom, up = 13 * zoom;
      /* the camera stays inside the fence: against it, it rises a little instead of going through */
      const cx = anchor.x - fx * back, cz = anchor.z - fz * back, over = Math.max(0, Math.abs(cx) - 32) + Math.max(0, Math.abs(cz) - 58);
      /* never behind a backboard or inside its stanchion: in line with a hoop the camera stops in front of the board */
      const px = PB.clamp(cx, -32, 32), zl = 39.5 + PB.clamp((Math.abs(px) - 5) / 4, 0, 1) * 18.5, pz = PB.clamp(cz, -zl, zl);
      /* squeezed against a fence, the wall or a hoop, the camera rises and looks down at you instead of losing you under the frame */
      const sq = Math.hypot(cx - px, cz - pz), sk = PB.clamp(sq / 16, 0, 1), la = 8 * (1 - sk * 0.8);
      /* and it swings round to the open side (the middle of the park behind it), the way a camera slides along a wall */
      if (sk > 0.2 && dt) { let dy = Math.atan2(u.x, u.z) - yaw; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI; yaw += dy * Math.min(1, dt * 2.2 * sk); }
      cam.position.set(px, up + sq * 0.36, pz); cam.lookAt(anchor.x + fx * la, 3.7 - sk * 1.2, anchor.z + fz * la);   // you a little above the middle: the controls are below
      /* a regular standing between the lens and you steps out of the picture */
      for (const [p, m] of meshes) if (p !== u && p.npc) { const ax = u.x - px, az = u.z - pz, L = Math.hypot(ax, az) || 1, t = ((p.x - px) * ax + (p.z - pz) * az) / L;
        if (t > 0 && t < L - 1 && Math.abs(((p.x - px) * az - (p.z - pz) * ax) / L) < 3.2) { m.root.visible = false; hidNear.push(m); } }
      for (let i = 0; i < stations.length; i++) { const s0 = stations[i]; s0.sign.quaternion.copy(cam.quaternion);   // the signs face you, and the rings breathe
        const w = 0.5 + 0.5 * Math.sin(G.t * 2.2 + i * 1.3); s0.ring.material.opacity = 0.62 + 0.33 * w; s0.sign.position.y = (s0.signY || (s0.signY = s0.sign.position.y)) + Math.sin(G.t * 1.6 + i) * 0.12; }
      camPos.copy(cam.position); camLook.set(anchor.x + fx * 8, 3.7, anchor.z + fz * 8);
      return;
    }
    if (camMode === 'lock') {
      /* player lock, the way career modes on consoles play it: low behind your own player, looking down the floor
         at the rim being attacked. The view swings around (it doesn't cut) when the ball changes hands. */
      if (G.half) lockDir = 1; else if (G.poss === 0) lockDir = 1; else if (G.poss === 1) lockDir = -1;
      const me0 = (G.horse && G.drill && G.drill.shooter) || G.user || b.holder || b;   // H-O-R-S-E: whoever is shooting
      /* in a drill the camera stands behind you facing the rim, wherever you are on the arc */
      /* (close to the rim, or past it, that angle would spin: there it keeps the last one it had from farther out) */
      if (G.drill && (Math.hypot(me0.x, 41.75 - me0.z) > 8 || drillYaw === null)) drillYaw = Math.atan2(0 - me0.x, 41.75 - Math.min(me0.z, 41));
      const want = G.drill ? drillYaw : lockDir > 0 ? 0 : Math.PI;
      let dy = want - yaw; while (dy > Math.PI) dy -= 2 * Math.PI; while (dy < -Math.PI) dy += 2 * Math.PI;
      if (Math.abs(Math.abs(dy) - Math.PI) < 0.01) dy = Math.PI * 0.999;   // a half turn always swings the same way
      yaw += dy * Math.min(1, dt * 4);
      const me = G.user || b.holder || b;
      const ax = me.x + (b.x - me.x) * 0.25, az = me.z + (b.z - me.z) * 0.25;
      anchor.lerp(new T.Vector3(ax, 0, az), Math.min(1, dt * 5));
      if (!dt || snap) { anchor.set(ax, 0, az); yaw = want; snap = false; }
      const fx = Math.sin(yaw), fz = Math.cos(yaw);
      const L = R.lock, back = L.back * zoom, up = L.up * zoom;
      /* never behind a backboard: near your own baseline the camera stops at the baseline and rises a little instead */
      const cz = anchor.z - fz * back, lim = 45.5, over = Math.max(0, Math.abs(cz) - lim);
      cam.position.set(PB.clamp(anchor.x - fx * back, -40, 40), up + over * 0.5, PB.clamp(cz, -lim, lim));
      cam.lookAt(anchor.x + fx * L.ahead, 3, anchor.z + fz * L.ahead);
      if (R.studio) { cam.position.set(R.studio[0], R.studio[1], R.studio[2]); cam.lookAt(R.studio[3], R.studio[4], R.studio[5]); return; }   // a fixed camera, for looking at animation
      camPos.copy(cam.position); camLook.set(anchor.x + fx * L.ahead, 3, anchor.z + fz * L.ahead);
      applyShake(dt);
      return;
    }
    let tPos, tLook;
    if (camMode === 'overhead') {
      /* high behind the +z direction: the half court reads top to bottom on a tall screen */
      const fx = PB.clamp(b.x * 0.7, -11, 11), fz = PB.clamp(b.z + 5, -30, 33);
      tPos = new T.Vector3(fx * 0.9, 60 * zoom, fz - 34 * zoom);
      tLook = new T.Vector3(fx, 0, fz + 2);
    } else {
      /* broadcast: low on the scorer's-table side (-x), panning along the court with the ball and leading toward
         the rim the ball is going to; it stops short of the baselines so the rim stays in the picture */
      const dir = G.poss === 0 ? 1 : G.poss === 1 ? -1 : 0;
      const fz = PB.clamp(b.z + dir * 10, -35, 35);
      const fx = PB.clamp(b.x * 0.35, -6, 7) + 4;
      const D = 60 * zoom, pitch = 0.4;
      tPos = new T.Vector3(fx - D * Math.cos(pitch), D * Math.sin(pitch) + 2, fz);
      tLook = new T.Vector3(fx, 2.5, fz);
    }
    const k = snap ? 1 : Math.min(1, dt * 3.2); snap = false;
    camPos.lerp(tPos, k); camLook.lerp(tLook, k);
    cam.position.copy(camPos); cam.lookAt(camLook);
    applyShake(dt);
  };
  function applyShake(dt) {
    if (shake <= 0) return;
    shake = Math.max(0, shake - dt * 2.5);
    cam.position.x += (Math.random() - 0.5) * shake; cam.position.y += (Math.random() - 0.5) * shake * 0.6;
  }

  R.swish = s => { for (const n of nets) if (n.s === s) n.swish = 1; };
  R.rimSnap = (s, k) => { for (const n of nets) if (n.s === s) n.snap = Math.max(n.snap, k || 1); };   // k: how hard (a dunk 1, a ball off the iron about half)
  /* adaptive quality: if the phone cannot hold about 45 frames a second, draw fewer pixels (2x, then 1.5x, then 1x),
     then drop the outlines and the men on the bench (about half the triangles). If none of that buys anything, the
     frame rate is being held down from outside (a phone in Low Power Mode draws thirty frames a second whatever
     you ask of it): everything goes back to full quality and stays there. */
  let ftAcc = 0, ftN = 0, ftLast = 0, prCap = 2, qLvl = 0, avg0 = 0, slow0 = 0, qLock = false;
  R.quality = () => ({ level: qLvl, locked: qLock, base: Math.round(avg0) });
  R._qReset = () => { qLock = false; slow0 = 0; avg0 = 0; ftAcc = 0; ftN = 0; ftLast = 0; setQuality(0); };   // for the tests
  R.lite = () => lite;
  function setQuality(n) {
    qLvl = n; prCap = n === 0 ? 2 : n === 1 ? 1.5 : 1;
    const lt = n >= 3;
    if (lt !== lite) { lite = lt; scene.traverse(o => { if (o.material === OUTLINE_MAT) o.visible = !lite; }); for (const m of benchMesh) if (m.userData.pl) m.userData.pl.visible = !lite; }
    R.resize();
  }
  R.render = menu => {
    const now = performance.now();
    /* a scene behind a menu runs at thirty frames a second on purpose: it says nothing about the phone, so it is not
       measured (it used to be, and a few seconds on the title screen cost the whole session its sharpness) */
    if (menu) { ftLast = 0; ftAcc = 0; ftN = 0; renderer.render(scene, cam); return; }
    if (ftLast) { ftAcc += Math.min(100, now - ftLast); ftN++; }
    ftLast = now;
    if (ftN >= 90) {
      const avg = ftAcc / ftN; ftAcc = 0; ftN = 0;
      if (!qLock && avg > 22) {
        /* two slow stretches in a row at full quality before anything is given up (the first seconds of a game hitch
           while it loads), and the better of the two is what the reductions have to beat */
        if (qLvl === 0 && !slow0) { slow0 = avg; }
        else if (qLvl === 0) { avg0 = Math.min(slow0, avg); setQuality(1); }
        else if (qLvl < 3) setQuality(qLvl + 1);
        else { if (avg > avg0 * 0.85) setQuality(0); qLock = true; }   // nothing helped: it was never the drawing
      } else if (qLvl === 0) slow0 = 0;
    }
    renderer.render(scene, cam);
  };
  R.pixelCap = () => prCap;
  R.info = () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, geos: renderer.info.memory.geometries, tex: renderer.info.memory.textures });
  R._scene = () => scene;   // for the test tools
  R.resize = () => {
    const el = renderer.domElement.parentElement;
    if (!el.clientWidth) return;   // the game view is hidden (a menu is up): size it when it shows
    W = el.clientWidth; H = el.clientHeight;
    const low = PB.settings && PB.settings.gfx === 'Low';
    DPR = Math.min(window.devicePixelRatio || 1, low ? 1 : prCap);
    renderer.setPixelRatio(DPR); renderer.setSize(W, H, false);
    cam.aspect = W / H;
    /* a narrow portrait screen gets a wider lens so the court's width still fits */
    const tall = W / H < 0.6;
    cam.fov = camMode === 'overhead' ? (tall ? 50 : 42) : camMode === 'lock' ? (tall ? R.lock.fov : R.lock.fov - 16) : (tall ? 56 : 40);
    cam.updateProjectionMatrix();
  };
  const v = new T.Vector3();
  R.toScreen = (x, y, z) => { v.set(x, y, z).project(cam); return { x: (v.x + 1) / 2 * W, y: (1 - v.y) / 2 * H, on: v.z < 1 }; };
  /* the screen's right and up, flattened onto the floor: the stick's frame */
  R.basis = () => {
    const f = new T.Vector3(); cam.getWorldDirection(f); f.y = 0; f.normalize();
    return { fx: f.x, fz: f.z, rx: -f.z, rz: f.x };
  };
})();
