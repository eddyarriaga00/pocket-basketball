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
  let zoom = 1;
  const meshes = new Map();
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
    /* center logo */
    g.save(); g.translate(X(0), Z(0)); g.rotate(Math.PI);
    g.fillStyle = home.c2; g.font = `900 ${3 * PX}px Archivo, Arial`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(home.id, 0, 0); g.restore();
    /* baseline names, readable from the camera side */
    g.save(); g.fillStyle = 'rgba(255,255,255,.85)'; g.font = `800 ${2.2 * PX}px Archivo, Arial`; g.textAlign = 'center';
    g.translate(X(0), Z(45.3)); g.rotate(Math.PI); g.fillText(home.name.toUpperCase(), 0, 0); g.restore();
    g.save(); g.fillStyle = 'rgba(255,255,255,.85)'; g.font = `800 ${2.2 * PX}px Archivo, Arial`; g.textAlign = 'center';
    g.translate(X(0), Z(-45.3)); g.rotate(Math.PI); g.fillText(home.city.toUpperCase(), 0, PX * 0.8); g.restore();
    const tex = new T.CanvasTexture(cv);
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    return tex;
  }

  function crowdTexture() {
    const cv = document.createElement('canvas'); cv.width = 512; cv.height = 128;
    const g = cv.getContext('2d');
    g.fillStyle = '#141a26'; g.fillRect(0, 0, 512, 128);
    const cols = ['#d9d9d9', '#30343c', '#b22a2a', '#2b4f9e', '#e0c070', '#6e7c8c', '#1d1d1d', '#8d5a3a'];
    for (let r = 0; r < 8; r++) for (let c = 0; c < 64; c++) {
      if (PB.rand() < 0.12) continue;
      g.fillStyle = cols[Math.floor(PB.rand() * cols.length)];
      const x = c * 8 + 2 + PB.rand() * 2, y = r * 16 + 4;
      g.fillRect(x, y + 5, 5, 8);
      g.fillStyle = PB.SKIN[Math.floor(PB.rand() * 6)];
      g.beginPath(); g.arc(x + 2.5, y + 3, 2.4, 0, 7); g.fill();
    }
    const t = new T.CanvasTexture(cv); t.wrapS = T.RepeatWrapping; return t;
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
  function numberTex(num, c1, c2) {
    const cv = document.createElement('canvas'); cv.width = cv.height = 128;
    const g = cv.getContext('2d');
    g.fillStyle = c1; g.fillRect(0, 0, 128, 128);
    g.font = '900 78px Archivo, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 8; g.strokeStyle = 'rgba(0,0,0,.35)'; g.strokeText(String(num), 64, 70);
    g.fillStyle = c2; g.fillText(String(num), 64, 70);
    return new T.CanvasTexture(cv);
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

  R.init = (canvas) => {
    renderer = new T.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    renderer.setClearColor(0x0b0f17);
    scene = new T.Scene();
    scene.fog = new T.Fog(0x0b0f17, 120, 260);
    cam = new T.PerspectiveCamera(46, 1, 1, 500);
    scene.add(new T.HemisphereLight(0xfff6e8, 0x40342a, 0.95));
    const sun = new T.DirectionalLight(0xffffff, 0.75); sun.position.set(20, 80, -30); scene.add(sun);
    R.resize();
  };

  /* Build the arena for a game: home team's floor, both hoops, the stands. */
  R.build = (home) => {
    for (const m of meshes.values()) scene.remove(m.root);
    meshes.clear();
    while (scene.children.length > 2) scene.remove(scene.children[2]);
    nets = [];
    const apron = new T.Mesh(new T.PlaneGeometry(90, 140), new T.MeshLambertMaterial({ color: 0x1c2333 }));
    apron.rotation.x = -Math.PI / 2; apron.position.y = -0.02; scene.add(apron);
    courtMat = new T.MeshLambertMaterial({ map: courtTexture(home) });
    const court = new T.Mesh(new T.PlaneGeometry(50, 94), courtMat);
    court.rotation.x = -Math.PI / 2; scene.add(court);
    scene.add(hoop(1)); scene.add(hoop(-1));
    /* stands: tiers on all four sides */
    const crowd = crowdTexture();
    for (let i = 0; i < 6; i++) {
      const h = 3 + i * 3.2, d = 8 + i * 5;
      for (const side of [-1, 1]) {
        const m = new T.Mesh(new T.BoxGeometry(5, 3.2, 150), new T.MeshLambertMaterial({ map: crowd.clone() }));
        m.material.map.needsUpdate = true; m.material.map.repeat.set(6, 1);
        m.position.set(side * (25 + d), h - 1.6, 0); scene.add(m);
        const e = new T.Mesh(new T.BoxGeometry(80 + d * 2, 3.2, 5), new T.MeshLambertMaterial({ map: crowd.clone() }));
        e.material.map.needsUpdate = true; e.material.map.repeat.set(3, 1);
        e.position.set(0, h - 1.6, side * (47 + 10 + d)); scene.add(e);
      }
    }
    /* scorer's table */
    const table = new T.Mesh(new T.BoxGeometry(2.5, 3, 24), new T.MeshLambertMaterial({ color: new T.Color(home.c1) }));
    table.position.set(-29, 1.5, 0); scene.add(table);
    /* the ball and the rings under you and the ball handler */
    const bc = document.createElement('canvas'); bc.width = 128; bc.height = 64;
    const bg = bc.getContext('2d'); bg.fillStyle = '#d4682a'; bg.fillRect(0, 0, 128, 64);
    bg.strokeStyle = '#2a140a'; bg.lineWidth = 2.4;
    for (const x of [0, 32, 64, 96]) { bg.beginPath(); bg.moveTo(x, 0); bg.lineTo(x, 64); bg.stroke(); }
    bg.beginPath(); bg.moveTo(0, 32); bg.lineTo(128, 32); bg.stroke();
    ballMesh = new T.Mesh(new T.SphereGeometry(0.39, 16, 12), new T.MeshLambertMaterial({ map: new T.CanvasTexture(bc) }));
    scene.add(ballMesh);
    ballShadow = new T.Mesh(new T.CircleGeometry(0.4, 12), new T.MeshBasicMaterial({ color: 0, transparent: true, opacity: 0.3, depthWrite: false }));
    ballShadow.rotation.x = -Math.PI / 2; scene.add(ballShadow);
    userRing = new T.Mesh(new T.RingGeometry(1.35, 1.75, 28), new T.MeshBasicMaterial({ color: 0x4cffb0, transparent: true, opacity: 0.9, depthWrite: false }));
    userRing.rotation.x = -Math.PI / 2; userRing.position.y = 0.04; scene.add(userRing);
    handRing = new T.Mesh(new T.RingGeometry(1.15, 1.35, 24), new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false }));
    handRing.rotation.x = -Math.PI / 2; handRing.position.y = 0.03; scene.add(handRing);
  };

  R.addPlayer = (p, kit) => {
    const m = playerMesh(p, kit);
    scene.add(m.root);
    meshes.set(p, m);
  };

  R.setZoom = z => { zoom = PB.clamp(z, 0.7, 1.5); };
  R.getZoom = () => zoom;

  /* Pose every player from the game state. */
  R.update = (G, dt) => {
    for (const [p, m] of meshes) {
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
    for (const n of nets) {
      n.swish = Math.max(0, n.swish - dt * 2.2);
      n.mesh.scale.set(1 - n.swish * 0.25, 1 + n.swish * 0.35, 1 - n.swish * 0.25);
      n.mesh.position.y = 9.25 - n.swish * 0.26;
    }
    /* camera: behind the +z direction, following the ball */
    /* high and behind, steep enough that the half court reads top to bottom on a tall screen; it slides across with
       the ball and stops short of the baselines so the rim never leaves the picture */
    const fx = PB.clamp(b.x * 0.7, -11, 11), fz = PB.clamp(b.z + 5, -30, 33);
    const tPos = new T.Vector3(fx * 0.9, 60 * zoom, fz - 34 * zoom);
    const tLook = new T.Vector3(fx, 0, fz + 2);
    const k = Math.min(1, dt * 3.2);
    camPos.lerp(tPos, k); camLook.lerp(tLook, k);
    cam.position.copy(camPos); cam.lookAt(camLook);
  };

  R.swish = s => { for (const n of nets) if (n.s === s) n.swish = 1; };
  R.render = () => renderer.render(scene, cam);
  R.resize = () => {
    const el = renderer.domElement.parentElement;
    if (!el.clientWidth) return;   // the game view is hidden (a menu is up): size it when it shows
    W = el.clientWidth; H = el.clientHeight;
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(DPR); renderer.setSize(W, H, false);
    cam.aspect = W / H;
    /* a narrow portrait screen gets a wider lens so the court's width still fits */
    cam.fov = W / H < 0.6 ? 50 : 42;
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
