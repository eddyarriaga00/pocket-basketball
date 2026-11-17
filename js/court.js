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
  let passArrow = null, manRing = null, flash = null, flashT = 0, passTarget = null, manTarget = null;
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
  R._marks = () => ({ pass: passTarget && passTarget.num, man: manTarget && manTarget.num, arrow: passArrow && passArrow.visible && R.toScreen(passArrow.position.x, passArrow.position.y, passArrow.position.z) });
  R.flash = color => { if (!flash) return; flash.material.color.set(color); flashT = 0.6; };
  let crowdMaps = [], hype = 0, shake = 0, trail = null, trailPts = [];
  /* the building jumps: the crowd bounces for a moment, the camera shakes on the biggest plays */
  R.hype = (power, shk) => { hype = Math.max(hype, 1.6 * (power || 1)); if (shk) shake = Math.max(shake, shk); };
  let ballMesh, ballShadow, userRing, handRing, courtMat, nets = [];

  const PX = 20;  // court texture pixels per foot

  function courtTexture(home) {
    const cv = document.createElement('canvas');
    cv.width = 50 * PX; cv.height = 94 * PX;
    const g = cv.getContext('2d');
    const X = x => (x + 25) * PX, Z = z => (z + 47) * PX;
    /* hardwood: planks run the length of the court */
    g.fillStyle = '#c99561'; g.fillRect(0, 0, cv.width, cv.height);
    for (let i = 0; i < 50 * 3; i++) {
      const x = i * PX / 3;
      for (let z = 0; z < cv.height;) {
        const len = 80 + PB.rand() * 260;
        const l = 0.86 + PB.rand() * 0.2;
        g.fillStyle = `rgb(${Math.round(201 * l)},${Math.round(149 * l)},${Math.round(97 * l)})`;
        g.fillRect(x, z, PX / 3 - 1, len - 1);
        z += len;
      }
    }
    g.globalAlpha = 0.06; g.fillStyle = '#000';
    for (let i = 0; i < 3000; i++) g.fillRect(PB.rand() * cv.width, PB.rand() * cv.height, 1 + PB.rand() * 2, 4 + PB.rand() * 18);
    g.globalAlpha = 1;
    /* the paint and the center circle in the home team's color */
    g.fillStyle = home.c1;
    g.globalAlpha = 0.88;
    g.fillRect(X(-8), Z(-47), 16 * PX, 19 * PX);
    g.fillRect(X(-8), Z(28), 16 * PX, 19 * PX);
    g.beginPath(); g.arc(X(0), Z(0), 6 * PX, 0, 7); g.fill();
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
    g.fillStyle = '#141a26'; g.fillRect(0, 0, 512, 128);
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

  function hoop(s) {
    const g = new T.Group();
    const white = new T.MeshLambertMaterial({ color: 0xffffff });
    const steel = new T.MeshLambertMaterial({ color: 0x2a2f38 });
    const pad = new T.MeshLambertMaterial({ color: 0x1a3a7a });
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
    nets.push({ mesh: net, s, swish: 0 });
    return g;
  }

  /* A player: legs, shorts, torso with the number, arms and a head, built at 6.1 ft and scaled to his height. */
  function wordTex(word, color) {
    const cv = document.createElement('canvas'); cv.width = 256; cv.height = 64;
    const g = cv.getContext('2d');
    g.font = '900 44px Archivo, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
    const w = g.measureText(word.toUpperCase()).width, sc = Math.min(1, 240 / Math.max(1, w));
    g.save(); g.translate(128, 34); g.scale(sc, 1); g.fillStyle = color; g.fillText(word.toUpperCase(), 0, 0); g.restore();
    const t = new T.CanvasTexture(cv); t.colorSpace = T.SRGBColorSpace; return t;
  }
  function numberTex(num, c1, c2) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const g = cv.getContext('2d');
    if (c1) { g.fillStyle = c1; g.fillRect(0, 0, 128, 128); }   // no background: printed straight on the jersey
    g.font = '900 78px Archivo, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 8; g.strokeStyle = 'rgba(0,0,0,.35)'; g.strokeText(String(num), 64, 70);
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
    if (!tplLoading) tplLoading = new A.GLTFLoader().loadAsync('models/player.glb').then(g => (TPL = template(g))).catch(e => { console.warn('player model', e); return null; });
    return tplLoading;
  };
  R.modelReady = () => !!TPL;
  R._tpl = () => TPL;
  const V3 = () => new T.Vector3(), Q4 = () => new T.Quaternion();
  const bk = n => n.replace(/[.\[\]:/]/g, '');
  function template(g) {
    const scene = g.scene;
    scene.updateMatrixWorld(true);
    const meshes = []; scene.traverse(o => { if (o.isSkinnedMesh) meshes.push(o); });
    for (const m of meshes) m.skeleton.update();
    /* three.js drops the dots from node names as it loads them (DEF-shin.L becomes DEF-shinL): look bones up that way */
    const bones = {}; meshes[0].skeleton.bones.forEach(b => { bones[bk(b.name)] = b; });
    const at = n => bones[bk(n)].getWorldPosition(V3());
    const box = new T.Box3();
    for (const m of meshes) { m.geometry.computeBoundingBox(); box.union(m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld)); }
    const H = box.max.y - box.min.y, knee = at('DEF-shin.L').y, ankle = at('DEF-foot.L').y, hip = at('DEF-thigh.L').y;
    const shortsTo = knee + (hip - knee) * 0.22, sockTo = ankle + (knee - ankle) * 0.28;
    /* region of every vertex, from its heaviest bone: 0 skin, 1 jersey, 2 shorts, 3 shoe, 4 sock */
    for (const m of meshes) {
      const gm = m.geometry, si = gm.attributes.skinIndex, sw = gm.attributes.skinWeight, pos = gm.attributes.position, n = pos.count;
      const reg = new Float32Array(n), v = V3();
      for (let i = 0; i < n; i++) {
        let best = 0, bw = -1;
        const ws = [sw.getX(i), sw.getY(i), sw.getZ(i), sw.getW(i)], is = [si.getX(i), si.getY(i), si.getZ(i), si.getW(i)];
        for (let k = 0; k < 4; k++) if (ws[k] > bw) { bw = ws[k]; best = is[k]; }
        const name = m.skeleton.bones[best].name;
        /* the vertex where it really is: through the skin (the quantized mesh's raw positions are in a squeezed space) */
        v.fromBufferAttribute(pos, i);
        if (m.applyBoneTransform) m.applyBoneTransform(i, v); else m.boneTransform(i, v);
        const y = v.applyMatrix4(m.matrixWorld).y;
        let r = 0;
        if (/spine|shoulder/.test(name)) r = 1;
        else if (/hips/.test(name)) r = 2;
        else if (/thigh/.test(name)) r = y > shortsTo ? 2 : 0;
        else if (/shin/.test(name)) r = y < sockTo ? 4 : 0;
        else if (/foot|toe/.test(name)) r = 3;
        reg[i] = r;
      }
      /* trim: jersey or shorts vertices that share a triangle with skin get the team's second color (5) */
      const idx = gm.index ? gm.index.array : null;
      if (idx) {
        const trim = new Uint8Array(n);
        for (let t = 0; t < idx.length; t += 3) {
          const a = idx[t], b = idx[t + 1], c = idx[t + 2], ra = reg[a], rb = reg[b], rc = reg[c];
          const hasSkin = ra === 0 || rb === 0 || rc === 0;
          if (!hasSkin) continue;
          for (const v of [a, b, c]) if (reg[v] === 1 || reg[v] === 2) trim[v] = 1;
        }
        for (let i = 0; i < n; i++) if (trim[i]) reg[i] = 5;
      }
      gm.setAttribute('region', new T.BufferAttribute(reg, 1));
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
      front: local(spine, new T.Vector3(0, chestY - H * 0.035, torsoZ + H * 0.022), new T.Quaternion()),
      /* the feet stand at y = 0, so the top of the head is the height (the quantized mesh's own box is centered on zero) */
      hair: local(head, new T.Vector3(headP.x, H * 0.945, headP.z - H * 0.01), new T.Quaternion()),
      face: local(head, new T.Vector3(headP.x, H * 0.885, headP.z + H * 0.052), new T.Quaternion()),
      chest: local(spine, new T.Vector3(0, chestY + H * 0.02, torsoZ + H * 0.024), new T.Quaternion()),
    };
    const sideR = Math.sign(at('DEF-hand.R').x - at('DEF-hips').x) || -1;
    const clips = {}; for (const c of g.animations) clips[c.name] = c;
    return { scene, clips, H, decals, sideR, torsoZ, box, headP };
  }
  function kitMaterial(cols) {
    const m = new T.MeshLambertMaterial({ color: 0xffffff });
    const u = { cTrim: { value: new T.Color(cols.trim || cols.jersey) }, cSkin: { value: new T.Color(cols.skin) }, cJersey: { value: new T.Color(cols.jersey) }, cShorts: { value: new T.Color(cols.shorts) },
      cShoe: { value: new T.Color(cols.shoe) }, cSock: { value: new T.Color(cols.sock) } };
    m.onBeforeCompile = sh => {
      Object.assign(sh.uniforms, u);
      sh.vertexShader = 'attribute float region;\nvarying float vRegion;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  vRegion = region;');
      sh.fragmentShader = 'uniform vec3 cSkin;\nuniform vec3 cJersey;\nuniform vec3 cShorts;\nuniform vec3 cShoe;\nuniform vec3 cSock;\nuniform vec3 cTrim;\nvarying float vRegion;\n' +
        sh.fragmentShader.replace('vec4 diffuseColor = vec4( diffuse, opacity );',
          'vec3 rc = vRegion < 0.5 ? cSkin : vRegion < 1.5 ? cJersey : vRegion < 2.5 ? cShorts : vRegion < 3.5 ? cShoe : vRegion < 4.5 ? cSock : cTrim;\n  vec4 diffuseColor = vec4( rc, opacity );');
    };
    m.customProgramCacheKey = () => 'pb-kit';
    return m;
  }
  const LOCO = [['Idle_Loop', 0], ['Walk_Loop', 4.5], ['Jog_Fwd_Loop', 11], ['Sprint_Loop', 18]];
  /* the face as one geometry with vertex colors: two eyes, two pupils, two brows */
  const FACE_MAT = new T.MeshBasicMaterial({ vertexColors: true });
  function faceGeometry(H) {
    const parts = [];
    const add = (g, color, x, y, z, rz) => { g.rotateZ(rz || 0); g.translate(x, y, z); const c = new T.Color(color), n = g.attributes.position.count, col = new Float32Array(n * 3); for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; } g.setAttribute('color', new T.BufferAttribute(col, 3)); parts.push(g.index ? g.toNonIndexed() : g); };
    for (const sx of [-1, 1]) {
      add(new T.SphereGeometry(H * 0.0085, 6, 4), 0xf2efe8, sx * H * 0.018, 0, 0);
      add(new T.SphereGeometry(H * 0.0048, 6, 4), 0x120c08, sx * H * 0.018, 0, H * 0.006);
      add(new T.BoxGeometry(H * 0.022, H * 0.004, H * 0.004), 0x120c08, sx * H * 0.019, H * 0.014, H * 0.002, -sx * 0.12);
    }
    add(new T.BoxGeometry(H * 0.022, H * 0.0035, H * 0.004), 0x3a1d14, 0, -H * 0.03, H * 0.002);         // the mouth
    const nose = new T.ConeGeometry(H * 0.006, H * 0.014, 5); nose.rotateX(Math.PI / 2); add(nose, 0x2a1810, 0, -H * 0.012, H * 0.008);   // the nose
    let n = 0; for (const g of parts) n += g.attributes.position.count;
    const pos = new Float32Array(n * 3), col = new Float32Array(n * 3); let o = 0;
    for (const g of parts) { pos.set(g.attributes.position.array, o * 3); col.set(g.attributes.color.array, o * 3); o += g.attributes.position.count; }
    const out = new T.BufferGeometry(); out.setAttribute('position', new T.BufferAttribute(pos, 3)); out.setAttribute('color', new T.BufferAttribute(col, 3));
    return out;
  }
  const HAIRS = ['short', 'short', 'high', 'afro', 'buzz', 'bald', 'buzz', 'short'];
  const HAIRC = ['#17110d', '#17110d', '#2b1d12', '#17110d', '#4a3020', '#c9a46a', '#17110d', '#6b4a2b'];
  function autoLook(d) {
    let h = 0; const id = String(d.id || d.last || 'x'); for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
    return { hair: HAIRS[h % HAIRS.length], hairColor: HAIRC[(h >> 3) % HAIRC.length], band: (h >> 6) % 7 === 0 ? '#f2f2f2' : null, sleeve: (h >> 9) % 6 === 0 ? '#111111' : null, shoe: null };
  }
  function skinnedPlayer(p, kit) {
    const A = window.THREE_ADDONS;
    const root = new T.Group(), body = A.SkeletonUtils.clone(TPL.scene);
    const sc = (p.ht || 78) / 12 / TPL.H;
    /* builds: bigs carry more width, guards less */
    const wide = { PG: 0.95, SG: 0.97, SF: 1.0, PF: 1.06, C: 1.11 }[(p.d || p).pos] || 1;
    body.scale.set(sc * wide, sc, sc * wide);
    root.add(body);
    const d = p.d || p;
    const shorts = kit.shorts || new T.Color(kit.c1).multiplyScalar(0.9).getStyle();
    const lk = d.look || autoLook(d);
    const mat = kitMaterial({ skin: PB.SKIN[d.skin || 0], jersey: kit.c1, shorts, shoe: lk.shoe || kit.shoe || '#f2f2f2', sock: kit.sock || '#f7f7f7', trim: kit.c2 });
    const bones = {};
    body.traverse(o => { if (o.isSkinnedMesh) { o.material = mat; o.frustumCulled = false; } if (o.isBone) bones[bk(o.name)] = o; });
    /* the number on the back and front, and hair */
    const tex = numberTex(p.num, null, kit.c2);
    const numMat = new T.MeshLambertMaterial({ map: tex, transparent: true, alphaTest: 0.4, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
    const H = TPL.H;
    const put = (bone, dcl, obj) => { obj.position.copy(dcl.pos); obj.quaternion.copy(dcl.quat); bone.add(obj); };
    put(bones[bk('DEF-spine.003')], TPL.decals.back, new T.Mesh(new T.PlaneGeometry(H * 0.13, H * 0.13), numMat));
    put(bones[bk('DEF-spine.003')], TPL.decals.front, new T.Mesh(new T.PlaneGeometry(H * 0.08, H * 0.08), numMat));
    /* a face: eyes and brows on the front of the head, so nobody is a blank egg */
    if (!TPL.faceGeo) TPL.faceGeo = faceGeometry(H);   // one mesh, one draw, shared by everyone
    const face = new T.Mesh(TPL.faceGeo, FACE_MAT);
    put(bones[bk('DEF-head')], TPL.decals.face, face);
    /* the team's name across the chest, over the number */
    const wm = new T.Mesh(new T.PlaneGeometry(H * 0.15, H * 0.04), new T.MeshLambertMaterial({ map: wordTex(kit.name || '', kit.c2), transparent: true, alphaTest: 0.35, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }));
    put(bones[bk('DEF-spine.003')], TPL.decals.chest, wm);
    /* the look: hair (style and color), a headband, an arm sleeve; yours from the Look card, everyone else's picked
       once from his id so the floor is not ten identical heads */
    const look = d.look || autoLook(d);
    const hairMat = new T.MeshLambertMaterial({ color: new T.Color(look.hairColor || '#17110d') });
    const head = bones[bk('DEF-head')];
    if (look.hair !== 'bald') {
      let hair;
      if (look.hair === 'high') { hair = new T.Mesh(new T.CylinderGeometry(H * 0.062, H * 0.066, H * 0.07, 14), hairMat); hair.position.y = H * 0.022; }
      else if (look.hair === 'afro') { hair = new T.Mesh(new T.SphereGeometry(H * 0.088, 14, 10), hairMat); hair.position.y = -H * 0.005; }
      else if (look.hair === 'buzz') { hair = new T.Mesh(new T.SphereGeometry(H * 0.067, 14, 9, 0, Math.PI * 2, 0, Math.PI / 2.1), hairMat); hair.scale.set(1.02, 0.85, 1.06); hair.position.y = -H * 0.004; }
      else { hair = new T.Mesh(new T.SphereGeometry(H * 0.07, 14, 9, 0, Math.PI * 2, 0, Math.PI / 1.9), hairMat); hair.scale.set(1.04, 0.98, 1.1); }
      const holder = new T.Group(); holder.add(hair); put(head, TPL.decals.hair, holder);
    }
    if (look.band) {
      const band = new T.Mesh(new T.TorusGeometry(H * 0.066, H * 0.011, 6, 18), new T.MeshLambertMaterial({ color: new T.Color(look.band) }));
      band.rotation.x = Math.PI / 2; band.scale.set(1, 1.1, 1); const g2 = new T.Group(); g2.add(band); band.position.y = -H * 0.02;
      put(head, TPL.decals.hair, g2);
    }
    if (look.sleeve) {
      const fore = bones[bk('DEF-forearm.R')], hand = bones[bk('DEF-hand.R')];
      const len = hand.position.length();
      const sl = new T.Mesh(new T.CylinderGeometry(H * 0.03, H * 0.027, len * 0.8, 10), new T.MeshLambertMaterial({ color: new T.Color(look.sleeve) }));
      const g3 = new T.Group(); g3.add(sl); sl.position.y = len * 0.42;
      g3.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), hand.position.clone().normalize());
      fore.add(g3);
    }
    const shadow = new T.Mesh(new T.CircleGeometry(1.1, 16), new T.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.28, depthWrite: false }));
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.02; root.add(shadow);
    const mixer = new T.AnimationMixer(body), act = {};
    for (const name of ['Idle_Loop', 'Walk_Loop', 'Jog_Fwd_Loop', 'Sprint_Loop', 'Crouch_Idle_Loop', 'Crouch_Fwd_Loop', 'Jump_Loop', 'Dance_Loop']) {
      const c = TPL.clips[name]; if (!c) continue;
      const a = mixer.clipAction(c); a.play(); a.setEffectiveWeight(0); a.time = PB.rand() * c.duration; act[name] = a;
    }
    act.Idle_Loop.setEffectiveWeight(1);
    const arm = s => ({ up: bones[bk(`DEF-upper_arm.${s}`)], fore: bones[bk(`DEF-forearm.${s}`)], hand: bones[bk(`DEF-hand.${s}`)] });
    return { kind: 'skin', root, body, mixer, act, bones, R: arm('R'), L: arm('L'), shadow, sc, pw: 0, pose: '', poseW: 0, phase: 0 };
  }

  /* turn a bone so the segment from it to `tip` points along `dir` (world), by `w` of the way */
  const _a = V3(), _b = V3(), _q = Q4(), _qw = Q4(), _qp = Q4();
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
      return [up, L(a[1], b[1]), [0.35, -0.6, 0.55], [0.05, -0.15, 1]]; },
    shoot: (k) => [[0.12, 0.62 + 0.3 * k, 0.7 - 0.4 * k], [0.02, 0.75 + 0.2 * k, 0.55 - 0.3 * k], [0.32, 0.6 + 0.25 * k, 0.6], [-0.35, 0.85, 0.35]],
    follow: () => [[0.08, 0.9, 0.42], [0.02, 0.35, 0.95], [0.32, 0.8, 0.4], [-0.2, 0.7, 0.6]],
    contest: () => [[0.25, 0.96, 0.15], [0.12, 0.99, 0.05], [0.25, 0.96, 0.15], [0.12, 0.99, 0.05]],
    celebrate: () => [[0.5, 0.86, 0.1], [0.3, 0.95, 0.05], [0.5, 0.86, 0.1], [0.3, 0.95, 0.05]],
    dunk1: () => [[0.15, 0.97, 0.2], [0.05, 0.99, 0.1], [0.55, -0.55, 0.35], [0.3, -0.6, 0.6]],
    reach: () => [[0.1, -0.15, 0.98], [0.05, -0.2, 0.98], [0.6, -0.6, 0.4], [0.3, -0.5, 0.8]],
    guard: () => [[0.85, -0.3, 0.42], [0.65, 0.15, 0.7], [0.85, -0.3, 0.42], [0.65, 0.15, 0.7]],
    hold: () => [[0.3, -0.6, 0.6], [-0.35, -0.05, 0.95], [0.3, -0.6, 0.6], [-0.35, -0.05, 0.95]],
    /* the windmill: the ball arm goes down, back, over the top and through; k is the time in the air */
    windmill: (k) => { const a = Math.min(1, k * 1.15) * Math.PI * 1.7, d = [0.25, -Math.cos(a), -Math.sin(a)];
      return [d, d, [0.45, 0.5, 0.6], [0.3, 0.7, 0.6]]; },
  };
  const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  function updateSkinned(p, m, G, dt) {
    m.root.position.set(p.x, 0, p.z);
    m.root.rotation.y = p.face + (p.spinA || 0);   // the turn of a reverse or a 360 in the air
    m.body.position.y = p.y;
    const sp = Math.hypot(p.vx, p.vz), air = p.y > 0.3;
    /* legs: idle, walk, jog and sprint blended by speed; the stance on defense; the jump in the air */
    const ws = {};
    for (let i = 0; i < LOCO.length; i++) {
      const [n, v] = LOCO[i], lo = i ? LOCO[i - 1][1] : -1, hi = i < LOCO.length - 1 ? LOCO[i + 1][1] : 1e9;
      ws[n] = sp <= v ? (i ? smooth(lo, v, sp) : 1 - smooth(v, hi, sp)) : (i < LOCO.length - 1 ? 1 - smooth(v, hi, sp) : 1);
    }
    let crouch = p.pose === 'guard' ? 0.5 : 0;
    if (p.shoot && p.y < 0.6 && p.shoot.t < p.shoot.T * 0.3) crouch = 0.55;   // the gather: down into the legs before the jump
    const dance = p.pose === 'celebrate' && !air && sp < 3 ? 1 : 0;
    const shooting = p.shoot || p.pose === 'shoot';
    const jump = air ? (shooting ? 0.3 : 1) : 0;   // a jumper goes up with straight legs, not the tuck of a leap
    const rest = Math.max(0, 1 - jump - dance);
    m.crouch = (m.crouch || 0) + (crouch - (m.crouch || 0)) * Math.min(1, dt * 8);
    const k = dt ? Math.min(1, dt * 10) : 1;
    const set = (n, w) => { const a = m.act[n]; if (!a) return; a.weight = a.weight + (w - a.weight) * k; a.setEffectiveWeight(a.weight); };
    for (const [n] of LOCO) set(n, ws[n] * rest * (1 - m.crouch) + (air && shooting && n === 'Idle_Loop' ? 0.7 : 0));
    set('Crouch_Idle_Loop', rest * m.crouch * (1 - smooth(2, 6, sp)));
    set('Crouch_Fwd_Loop', rest * m.crouch * smooth(2, 6, sp));
    set('Jump_Loop', jump); set('Dance_Loop', dance);
    /* the clips' feet match the ground at about these speeds (feet a second, at this player's size) */
    const scl = (p.ht || 78) / 12 / 6.1;
    m.act.Walk_Loop.timeScale = Math.min(1.6, Math.max(0.6, sp / (4.5 * scl)));
    m.act.Jog_Fwd_Loop.timeScale = Math.min(1.5, Math.max(0.7, sp / (11 * scl)));
    m.act.Sprint_Loop.timeScale = Math.min(1.3, Math.max(0.8, sp / (18 * scl)));
    if (m.act.Crouch_Fwd_Loop) m.act.Crouch_Fwd_Loop.timeScale = 1.6;
    m.mixer.update(dt);
    m.body.updateMatrixWorld(true);
    /* the arms */
    const has = G.ball.holder === p;
    let pose = p.pose;
    if (pose === 'shoot' && !p.shoot) pose = 'follow';
    if (has && !p.shoot && (pose !== 'dribble' || p.inb)) pose = G.phase === 'ft' || p.inb ? 'hold' : 'dribble';
    if (pose !== m.pose) { m.pose = pose; }
    m.poseW = Math.min(1, (m.poseW || 0) + dt * (POSES[pose] ? 9 : -6));
    if (!POSES[pose]) { m.poseW = Math.max(0, m.poseW - dt * 6); return; }
    let kk = 0;
    if (pose === 'dribble') kk = (G.t * 8.5 / Math.PI) % 1;   // the ball's own bounce (game.js), so hand and ball agree
    else if (pose === 'shoot' && p.shoot) kk = Math.min(1, p.shoot.t / (p.shoot.T * 0.82));
    else if (pose === 'windmill') kk = p.spin ? p.spin.t / p.spin.T : 1;
    /* dirOf's x is to the player's right when the model's right hand sits on -x facing +z (TPL.sideR < 0); each pose
       gives x as outward for that arm, so the left arm mirrors it */
    const P = POSES[pose](kk), w = m.poseW, s = TPL.sideR < 0 ? 1 : -1;
    aim(m.R.up, m.R.fore, dirOf(p.face, P[0][0], P[0][1], P[0][2], s), w);
    aim(m.R.fore, m.R.hand, dirOf(p.face, P[1][0], P[1][1], P[1][2], s), w);
    aim(m.L.up, m.L.fore, dirOf(p.face, P[2][0], P[2][1], P[2][2], -s), w);
    aim(m.L.fore, m.L.hand, dirOf(p.face, P[3][0], P[3][1], P[3][2], -s), w);
  }
  /* where a player's hands are, in feet, for the ball (null for the simple figures) */
  const _h = V3();
  R.hands = p => {
    const m = meshes.get(p);
    if (!m || m.kind !== 'skin') return null;
    m.R.hand.getWorldPosition(_h); const r = { x: _h.x, y: _h.y, z: _h.z };
    m.L.hand.getWorldPosition(_h); const l = { x: _h.x, y: _h.y, z: _h.z };
    return { r, l };
  };

  /* a portrait: head and shoulders in the team's jersey, rendered once off screen to an image for the hub */
  R.portrait = (player, team, size) => {
    if (!TPL) return null;
    try {
      const cv = document.createElement('canvas'); cv.width = cv.height = size || 192;
      const rr = new T.WebGLRenderer({ canvas: cv, antialias: true, preserveDrawingBuffer: true, alpha: true });
      const sc = new T.Scene();
      sc.add(new T.HemisphereLight(0xfff6e8, 0x3a3028, 1.1)); const k = new T.DirectionalLight(0xffffff, 0.8); k.position.set(3, 6, 8); sc.add(k);
      const p = { d: player, team: 0, slot: 0, r: player.r, ht: player.ht, num: player.num, x: 0, z: 0, vx: 0, vz: 0, y: 0, vy: 0, face: 0, pose: '' };
      const m = skinnedPlayer(p, { c1: team.c1, c2: team.c2, name: team.name });
      sc.add(m.root); m.shadow.visible = false;
      m.mixer.update(0.3); m.body.updateMatrixWorld(true);
      const H = (player.ht || 78) / 12;
      const c = new T.PerspectiveCamera(28, 1, 0.1, 50); c.position.set(0.35, H * 0.9, 3.1); c.lookAt(0, H * 0.86, 0);
      rr.render(sc, c);
      const url = cv.toDataURL('image/png');
      rr.dispose(); rr.forceContextLoss && rr.forceContextLoss();
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
  R.build = (home) => {
    for (const m of meshes.values()) scene.remove(m.root);
    meshes.clear(); refs = []; benchMesh = [];
    while (scene.children.length > 2) scene.remove(scene.children[2]);
    nets = [];
    const apron = new T.Mesh(new T.PlaneGeometry(90, 140), new T.MeshLambertMaterial({ color: 0x1c2333 }));
    apron.rotation.x = -Math.PI / 2; apron.position.y = -0.02; scene.add(apron);
    courtMat = new T.MeshPhongMaterial({ map: courtTexture(home), shininess: 38, specular: 0x2a2620 });   // a polished floor: the lights glint off it
    const court = new T.Mesh(new T.PlaneGeometry(50, 94), courtMat);
    court.rotation.x = -Math.PI / 2; scene.add(court);
    scene.add(hoop(1)); scene.add(hoop(-1));
    /* a pool of light on the floor, brightest at center court, fading toward the stands */
    const lc = document.createElement('canvas'); lc.width = lc.height = 256;
    const lg = lc.getContext('2d'), grd = lg.createRadialGradient(128, 128, 10, 128, 128, 128);
    grd.addColorStop(0, 'rgba(255,240,220,0.09)'); grd.addColorStop(0.6, 'rgba(255,240,220,0.03)'); grd.addColorStop(1, 'rgba(255,248,235,0)');
    lg.fillStyle = grd; lg.fillRect(0, 0, 256, 256);
    const pool = new T.Mesh(new T.PlaneGeometry(80, 130), new T.MeshBasicMaterial({ map: new T.CanvasTexture(lc), transparent: true, blending: T.AdditiveBlending, depthWrite: false }));
    pool.rotation.x = -Math.PI / 2; pool.position.y = 0.015; scene.add(pool);
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
    scene.add(new T.Mesh(mergeGeo(sides), new T.MeshLambertMaterial({ map: sideM, color: 0x8a8890 })));
    scene.add(new T.Mesh(mergeGeo(ends), new T.MeshLambertMaterial({ map: endM, color: 0x8a8890 })));
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
    handRing = new T.Mesh(new T.RingGeometry(1.15, 1.35, 24), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false }));
    handRing.rotation.x = -Math.PI / 2; handRing.position.y = 0.03; scene.add(handRing);
    /* the pass preview (an arrow over the teammate your pass would go to), your man's ring on defense, a release flash */
    passArrow = new T.Mesh(new T.ConeGeometry(0.55, 1.1, 4), new T.MeshBasicMaterial({ color: 0x4cffb0, transparent: true, opacity: 0.9, depthTest: false }));
    passArrow.rotation.x = Math.PI; passArrow.renderOrder = 5; scene.add(passArrow);
    manRing = new T.Mesh(new T.RingGeometry(1.25, 1.5, 28), new T.MeshBasicMaterial({ color: 0xff4d5e, transparent: true, opacity: 0.75, depthWrite: false }));
    manRing.rotation.x = -Math.PI / 2; manRing.position.y = 0.035; scene.add(manRing);
    flash = new T.Mesh(new T.RingGeometry(1.6, 2.3, 32), new T.MeshBasicMaterial({ color: 0x4cffb0, transparent: true, opacity: 0, depthWrite: false }));
    flash.rotation.x = -Math.PI / 2; flash.position.y = 0.04; scene.add(flash);
  };

  /* the officials: two of them, gray shirts and black slacks. The lead works the baseline at the ball's end, the
     trail the far sideline a step behind the play. They are not players: nothing in the game touches them. */
  let refs = [];
  R.addRefs = () => {
    refs = [];
    if (!TPL) return;
    for (let i = 0; i < 2; i++) {
      const p = { id: 'ref' + i, x: 26.5, z: i ? 30 : -10, y: 0, vx: 0, vz: 0, face: -Math.PI / 2, pose: '', ht: 75, num: [14, 37][i], pos: 'SG', skin: [1, 4][i],
        look: { hair: i ? 'buzz' : 'bald', hairColor: '#2a2a2a', shoe: '#111111' } };
      const m = skinnedPlayer(p, { c1: '#a3a8ad', c2: '#16181b', name: '', shorts: '#15171a', sock: '#15171a', shoe: '#111111' });
      scene.add(m.root); meshes.set(p, m); refs.push(p);
    }
  };
  R._refs = () => refs;
  function moveRefs(G, dt) {
    if (!refs.length || !G.ball) return;
    const b = G.ball, end = G.poss === 0 ? 1 : G.poss === 1 ? -1 : Math.sign(b.z) || 1;
    const tg = [{ x: 11, z: end * 48.6 }, { x: 26.3, z: Math.max(-38, Math.min(38, b.z - end * 13)) }];
    /* on a change of ends the lead becomes the trail and the trail the lead, the way crews work: whoever is nearer */
    const D = (r, t) => Math.hypot(r.x - t.x, r.z - t.z);
    if (D(refs[0], tg[0]) + D(refs[1], tg[1]) > D(refs[0], tg[1]) + D(refs[1], tg[0])) tg.reverse();
    refs.forEach((r, i) => {
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
  R.setBenches = (kits) => {
    for (const m of benchMesh) { scene.remove(m); m.geometry.dispose(); }
    benchMesh = [];
    if (!kits) return;
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
        add(new T.CylinderGeometry(0.5, 0.58, 2.3, 8), x + 0.45, 2.7, z, warm);                // in warmups
        add(new T.SphereGeometry(0.4, 8, 6), x + 0.4, 4.25, z, skin);
        add(new T.BoxGeometry(1.8, 0.55, 1.05), x - 0.35, 1.75, z, warm);                    // thighs toward the floor
        add(new T.BoxGeometry(0.45, 1.6, 0.9), x - 1.15, 0.85, z, '#f2f2f2');                 // shins
        add(new T.BoxGeometry(0.9, 0.3, 0.9), x - 1.3, 0.15, z, '#e9e9e9');                   // shoes
      }
      /* the coach, standing at the end of the bench nearest half court */
      const cz = side * 12.6, cx = 27.6;
      add(new T.BoxGeometry(0.7, 3, 1.1), cx, 1.5, cz, '#1d1f24');
      add(new T.CylinderGeometry(0.55, 0.6, 2.4, 8), cx, 4.2, cz, '#2b2e36');
      add(new T.SphereGeometry(0.42, 8, 6), cx, 5.85, cz, PB.SKIN[(t * 4 + 1) % 6]);
      const m = new T.Mesh(mergeGeo(parts), new T.MeshLambertMaterial({ vertexColors: true }));
      scene.add(m); benchMesh.push(m); parts = [];
    });
  };

  R.removePlayer = p => {
    const m = meshes.get(p); if (!m) return;
    scene.remove(m.root); meshes.delete(p);
    /* free what was his alone: materials and their textures, and his own small geometries (the body and the face are shared) */
    m.root.traverse(o => {
      if (o.material) for (const mt of [].concat(o.material)) { if (mt.map && mt.map !== (TPL && TPL.sharedMap)) mt.map.dispose(); if (mt !== FACE_MAT) mt.dispose(); }
      if (o.geometry && !o.isSkinnedMesh && o.geometry !== (TPL && TPL.faceGeo)) o.geometry.dispose();
    });
  };
  R.addPlayer = (p, kit) => {
    const m = TPL ? skinnedPlayer(p, kit) : playerMesh(p, kit);
    scene.add(m.root);
    meshes.set(p, m);
  };

  R.setZoom = z => { zoom = PB.clamp(z, 0.7, 1.5); };
  let replay = false, replayA = 0;
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
    R.addPlayer(p, { c1: team.c1, c2: team.c2, name: team.name });
    let a = Math.PI;   // start in front of him
    const g = { t: 0, ball: { x: 0, y: -5, z: 0, state: 'show', holder: null }, user: null, pl: [p], teams: [team, team], score: [0, 0], q: 1, clock: 0, shotClock: 0, poss: null, show: true };
    let last = performance.now();
    show = { p, g };
    const loop = now => {
      show.raf = requestAnimationFrame(loop);
      const dt = Math.min(0.05, (now - last) / 1000); last = now; g.t += dt; a += dt * 0.25;
      if (Math.sin(g.t * 0.5) > 0.98 && p.pose !== 'celebrate') { p.pose = 'celebrate'; setTimeout(() => { p.pose = ''; }, 1600); }
      R.update(g, dt);
      cam.position.set(Math.sin(a) * 17, 4.6 + Math.sin(a * 0.7) * 0.8, Math.cos(a) * 17);
      cam.lookAt(0, 3.3, 0);
      R.render();
    };
    show.raf = requestAnimationFrame(loop);
  };
  R.setIntro = sec => { intro = sec; if (sec > 0) introT = sec; };
  R.setReplay = on => { replay = on; replayA = PB.rand() * Math.PI * 2; };
  /* cameras: 'lock' (player lock, behind you toward the rim in play), 'broadcast' (the sideline), 'overhead' */
  R.CAMS = { lock: 'Player lock', broadcast: 'Broadcast', overhead: 'Overhead' };
  let snap = false; R.snap = () => { snap = true; };
  R.setCam = m => { camMode = R.CAMS[m] ? m : 'lock'; R.resize(); };
  R.getCam = () => camMode;
  /* player lock framing: how far behind you, how high, how far ahead it looks, the lens */
  R.lock = { back: 42, up: 32, ahead: 8, fov: 52 };   // high and wide: you, the lane and the rim, and most of the floor
  R.getZoom = () => zoom;

  /* Pose every player from the game state. */
  R.update = (G, dt) => {
    if (!G.replay) moveRefs(G, dt);
    benchT += dt;
    benchMesh.forEach((m, t) => { if (benchJ[t] > 0) { benchJ[t] = Math.max(0, benchJ[t] - dt); m.position.y = Math.abs(Math.sin(benchT * 11 + t)) * 0.7 * Math.min(1, benchJ[t]); } else m.position.y = 0; });
    for (const [p, m] of meshes) {
      if (m.kind === 'skin') { updateSkinned(p, m, G, dt); m.shadow.position.set(0, 0.02, 0); m.shadow.scale.setScalar(1 - Math.min(p.y / 8, 0.5)); continue; }
      m.root.position.set(p.x, 0, p.z);
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
    ballMesh.rotation.x += dt * (b.state === 'held' ? 8 : 12);
    ballShadow.position.set(b.x, 0.03, b.z);
    const u = G.user;
    userRing.visible = !!u;
    if (u) { userRing.position.x = u.x; userRing.position.z = u.z; userRing.material.opacity = 0.65 + 0.3 * Math.sin(G.t * 5); }
    const h = b.state === 'held' && b.holder !== u ? b.holder : null;
    handRing.visible = !!h;
    if (h) { handRing.position.x = h.x; handRing.position.z = h.z; handRing.material.color.set(h.team === 0 ? 0xffffff : 0xff6a6a); }
    if (board && G.teams) {
      const fmt = c => c >= 60 ? `${Math.floor(c / 60)}:${String(Math.floor(c % 60)).padStart(2, '0')}` : Math.max(0, c).toFixed(1);
      const q = G.q <= 4 ? ['1ST', '2ND', '3RD', '4TH'][G.q - 1] : 'OT';
      const key = `${G.score[0]}|${G.score[1]}|${q}|${fmt(G.clock)}|${Math.ceil(G.shotClock)}`;
      if (key !== board.key) {
        board.key = key;
        const g = board.g, W2 = 512;
        g.fillStyle = '#05070b'; g.fillRect(0, 0, W2, 256);
        for (const [i, t] of [[0, G.teams[0]], [1, G.teams[1]]]) {
          const x = i ? 384 : 128;
          g.fillStyle = t.c1; g.fillRect(x - 118, 18, 236, 44);
          g.fillStyle = '#fff'; g.font = '900 34px Archivo, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(t.ab || t.id, x, 41);
          g.fillStyle = '#ffb02e'; g.font = '900 96px Archivo, Arial'; g.fillText(String(G.score[i]), x, 132);
        }
        g.fillStyle = '#fff'; g.font = '800 40px Archivo, Arial'; g.fillText(fmt(G.clock), 256, 212);
        g.fillStyle = '#8d99b0'; g.font = '800 26px Archivo, Arial'; g.fillText(q, 256, 176);
        g.fillStyle = '#ff5a6b'; g.font = '900 30px Archivo, Arial'; g.fillText(String(Math.max(0, Math.ceil(G.shotClock))), 460, 212);
        board.tex.needsUpdate = true;
      }
    }
    for (const r of ribbons) r.offset.x = (r.offset.x + dt * 0.05) % 1;
    if (tag && tagP) tag.position.set(tagP.x, (tagP.ht || 78) / 12 + 2.6 + tagP.y, tagP.z);
    if (passArrow) {
      passArrow.visible = !!passTarget;
      if (passTarget) { passArrow.position.set(passTarget.x, (passTarget.ht || 78) / 12 + 2.4 + Math.sin(G.t * 6) * 0.25 + passTarget.y, passTarget.z); passArrow.rotation.y += dt * 2; }
      manRing.visible = !!manTarget;
      if (manTarget) { manRing.position.x = manTarget.x; manRing.position.z = manTarget.z; }
      if (flashT > 0 && G.user) { flashT -= dt; const k = 1 - flashT / 0.6; flash.position.x = G.user.x; flash.position.z = G.user.z; flash.scale.setScalar(1 + k * 1.2); flash.material.opacity = 0.85 * (1 - k); } else flash.material.opacity = 0;
    }
    if (hype > 0) { hype = Math.max(0, hype - dt); const j = Math.abs(Math.sin(G.t * 14)) * 0.035 * Math.min(1, hype); for (const m of crowdMaps) m.offset.y = j; }
    /* a glowing trail behind the ball on your shots */
    if (!trail) {
      trail = new T.Line(new T.BufferGeometry().setFromPoints(Array.from({ length: 24 }, () => new T.Vector3())), new T.LineBasicMaterial({ color: 0xffb02e, transparent: true, opacity: 0.75 }));
      trail.frustumCulled = false; scene.add(trail);
    }
    const mine = b.state === 'shot' && b.shot && b.shot.shooter === G.user;
    if (mine) { trailPts.push(new T.Vector3(b.x, b.y, b.z)); if (trailPts.length > 24) trailPts.shift(); }
    else if (trailPts.length) trailPts.shift();
    trail.visible = trailPts.length > 1;
    if (trail.visible) { const pos = trail.geometry.attributes.position; for (let i = 0; i < 24; i++) { const q = trailPts[Math.min(i, trailPts.length - 1)]; pos.setXYZ(i, q.x, q.y, q.z); } pos.needsUpdate = true; trail.geometry.computeBoundingSphere(); }
    for (const n of nets) {
      n.swish = Math.max(0, n.swish - dt * 2.2);
      n.mesh.scale.set(1 - n.swish * 0.25, 1 + n.swish * 0.35, 1 - n.swish * 0.25);
      n.mesh.position.y = 9.25 - n.swish * 0.26;
    }
    if (G.show) return;
    if (intro > 0) {
      /* the opening: high over the arena, sweeping down toward center court */
      intro = Math.max(0, intro - dt);
      const k = 1 - intro / introT, a = 2.4 - k * 2.4;
      cam.position.set(Math.sin(a) * (70 - k * 30), 48 - k * 26, Math.cos(a) * (70 - k * 30) - 10 * k);
      cam.lookAt(0, 6 - k * 4, 0);
      camPos.copy(cam.position); camLook.set(0, 2, 0);
      if (intro === 0) R.snap();
      return;
    }
    if (replay) {
      /* replay: low, close, circling the ball */
      replayA += dt * 0.35;
      const bx = PB.clamp(b.x, -20, 20), bz = PB.clamp(b.z, -44, 44);
      cam.position.set(bx + Math.sin(replayA) * 22, 7.5, bz + Math.cos(replayA) * 22);
      cam.lookAt(bx, Math.max(4, b.y * 0.6), bz);
      return;
    }
    if (camMode === 'lock') {
      /* player lock, the way career modes on consoles play it: low behind your own player, looking down the floor
         at the rim being attacked. The view swings around (it doesn't cut) when the ball changes hands. */
      if (G.poss === 0) lockDir = 1; else if (G.poss === 1) lockDir = -1;
      const me0 = G.user || b.holder || b;
      /* in a drill the camera stands behind you facing the rim, wherever you are on the arc */
      const want = G.drill ? Math.atan2(0 - me0.x, 41.75 - me0.z) : lockDir > 0 ? 0 : Math.PI;
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
  /* adaptive resolution: if the phone cannot hold about 45 frames a second, draw fewer pixels (2x, then 1.5x, then 1x) */
  let ftAcc = 0, ftN = 0, ftLast = 0, prCap = 2;
  R.render = () => {
    const now = performance.now();
    if (ftLast) { ftAcc += Math.min(100, now - ftLast); ftN++; }
    ftLast = now;
    if (ftN >= 90) {
      const avg = ftAcc / ftN; ftAcc = 0; ftN = 0;
      if (avg > 22 && prCap > 1) { prCap = prCap > 1.5 ? 1.5 : 1; R.resize(); }
    }
    renderer.render(scene, cam);
  };
  R.pixelCap = () => prCap;
  R.info = () => ({ calls: renderer.info.render.calls, tris: renderer.info.render.triangles, geos: renderer.info.memory.geometries, tex: renderer.info.memory.textures });
  R.resize = () => {
    const el = renderer.domElement.parentElement;
    if (!el.clientWidth) return;   // the game view is hidden (a menu is up): size it when it shows
    W = el.clientWidth; H = el.clientHeight;
    DPR = Math.min(window.devicePixelRatio || 1, prCap);
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
