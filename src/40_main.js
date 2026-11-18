   Steering: keys, a drag joystick on the left of a touch screen, or tap / click a spot to walk there.
   The valley is streamed in tiles round him (PKValley); creatures in PKValleyLife; finds and poem stops in PKWaterFinds.
   window.WWB exposes the game for tests and for the next steps (see the bottom). */
(function () {
  'use strict';
  var THREE = window.THREE;
  var $ = function (id) { return document.getElementById(id); };
  var Q = location.search;
  var PDPR = Math.min(window.devicePixelRatio || 1, 3);
  var DENS = { medium: 56, fine: 80, extra: 124, ultra: 190 }; // art pixels per metre at the normal zoom
  var WALK = 1.15, RUN = 2.7, WALK_CLIP = 0.67, RUN_CLIP = 2.4; // m/s, and the speeds the clips were made for
  var KEY = 'pk-wwb-v1';
  var FINDS = PKWaterFinds.FINDS, TOOLS = PKWaterFinds.TOOLS, COLLS = PKWaterFinds.COLLS, POEMS = PKWaterFinds.POEMS;
  var ITEMS = FINDS.concat(TOOLS), WALL = FINDS.filter(function (f) { return f.coll !== 'solids'; }), SOLIDS = FINDS.filter(function (f) { return f.coll === 'solids'; });

  // ---------------------------------------------------------------- saved settings and progress (this device only)
  var QUAL = {
    low: { pix: 'ultra', king: 4, creek: 2, note: 'Ultra pixels, the king at 4×, the creek at 2×. The lightest: for phones.' },
    medium: { pix: 'ultra', king: 4, creek: 4, note: 'Ultra pixels, the king at 4×, the creek at 4×. For laptops and the TV.' },
    high: { pix: 'ultra', king: 6, creek: 6, note: 'Ultra pixels, the king and the creek at 6×. For a strong laptop.' }
  };
  function fresh() { return { found: {}, hung: {}, tools: {}, nums: {}, seen: {}, skip: { best: 0, n: 0 }, n: 0, read: {}, wave: 1, quality: null, sound: true, map: true, carry: null, done: false, fog: '' }; }
  var save = fresh();
  try { var raw = localStorage.getItem(KEY); if (raw) Object.assign(save, JSON.parse(raw)); } catch (e) {}
  if (/[?&]fresh/.test(Q)) save = fresh();
  ['hung', 'tools', 'nums', 'seen'].forEach(function (k) { if (!save[k]) save[k] = {}; }); if (!save.skip) save.skip = { best: 0, n: 0 }; if (!save.wave) save.wave = 1; if (!save.n) save.n = 0;
  var phone = matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 900;
  // Easy to see: made for Richard Sale, whose sight is blurry (he knows a face at about a foot and a half), watching on a TV, cast from a laptop.
  // Everything big, bold and high contrast, the voice reading everything out. ?see=easy or ?see=normal in the address chooses it.
  // (the published page only passes a #word through, so #easy, #normal and #watch work there too)
  var HASH = (location.hash || '').toLowerCase();
  if (/[?&]see=easy/.test(Q) || HASH === '#easy' || HASH === '#watch') save.see = true; if (/[?&]see=normal/.test(Q) || HASH === '#normal') save.see = false;
  var EASY = { on: !!save.see, dens: 72 };
  var qq = /[?&]q=(low|medium|high)/.exec(Q); if (qq) save.quality = qq[1];
  if (!QUAL[save.quality]) save.quality = phone ? 'low' : 'medium';
  save.pix = QUAL[save.quality].pix; save.kingDet = QUAL[save.quality].king; save.creekDet = QUAL[save.quality].creek;
  if (EASY.on) save.creekDet = Math.min(save.creekDet, 2);   // lighter, for casting; the small plants are left out anyway
  var qk = /[?&]king=([1-6])/.exec(Q), qc = /[?&]creek=([1-6])/.exec(Q), qp = /[?&]pix=(medium|fine|extra|ultra)/.exec(Q);
  if (qk) save.kingDet = +qk[1]; if (qc) save.creekDet = +qc[1]; if (qp) save.pix = qp[1];
  function persist() { if (WATCH && WATCH.on) return; try { localStorage.setItem(KEY, JSON.stringify(save)); } catch (e) {} }

  // ---------------------------------------------------------------- renderer, scene, world, king
  var canvas = $('view');
  var renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: false, preserveDrawingBuffer: /[?&]shots/.test(Q) }); }
  catch (e) { $('loadline').textContent = 'This browser has WebGL turned off, so the valley cannot be drawn.'; return; }
  renderer.setPixelRatio(PDPR); renderer.outputEncoding = THREE.sRGBEncoding; renderer.toneMapping = THREE.NoToneMapping;
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.BasicShadowMap;
  var scene = new THREE.Scene(); scene.background = new THREE.Color('#a8d0de');
  function visible(o) { while (o) { if (o.visible === false) return false; o = o.parent; } return true; }
  function tris(root) { var n = 0; root.traverse(function (o) { if (o.isMesh && visible(o)) n += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1); }); return Math.round(n); }
  function disposeTree(root) { root.traverse(function (o) { if (o.isMesh) o.geometry.dispose(); }); }
  var world = PKValley.create({ detail: save.creekDet }); scene.add(world.group); world.setPlants(!EASY.on);
  var V = PKToon2.variant('A');
  function makeKing(det) {
    var k = PhilosopherKing.createRig({ dims: V.DIMS, rest: V.REST }); PKToon2.build(k, 'A', { detail: det, merge: true });
    k.root.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    ITEMS.forEach(function (f) { if (f.id !== 'waders' && !k.props[f.id]) k.addHeld(f.id, PKWaterFinds.heldProp(f.id)); });
    k.addHeld('skipstone', PKWaterFinds.skipStone());
    k.detail = det;
    // his own paints carry alpha 0.875: the pixel pass keeps his outline in dark ink and leaves him out of the contact shading
    k.root.traverse(function (o) { if (o.isMesh && o.material && /^Toon2?_/.test(o.material.name || '')) o.material.opacity = 0.875; });
    addHalo(k);
    return k;
  }
  // Easy to see: when something stands between him and the camera (the trestle, a post, the bluff), his shape still shows through
  // it in pale light: each piece is drawn again only where it is hidden (depth test 'greater'), after the valley and before
  // him, in a colour the night does not darken (alpha 0.25). Where he can be seen, his own drawing covers it.
  var HALO_MAT = null;
  function addHalo(k) {
    if (!HALO_MAT) HALO_MAT = new THREE.MeshBasicMaterial({ color: '#fff2c8', opacity: 0.25, depthWrite: false, depthFunc: THREE.GreaterDepth });
    k.halo = [];
    var src = []; k.root.traverse(function (o) { if (o.isMesh && !o.userData.halo) src.push(o); });
    src.forEach(function (o) { o.renderOrder = 2; var h = new THREE.Mesh(o.geometry, HALO_MAT); h.renderOrder = 1; h.userData.halo = true; h.castShadow = false; h.receiveShadow = false; h.visible = !!(typeof EASY !== 'undefined' && EASY.on); o.add(h); k.halo.push(h); });
  }
  function showHalo(on) { king.halo.forEach(function (h) { h.visible = on; }); }
  var king = makeKing(save.kingDet); scene.add(king.root);

  // ---------------------------------------------------------------- the player
  var P = { x: world.spots.start[0], z: world.spots.start[1], y: 0, vy: 0, yaw: world.spots.startYaw, speed: 0, dir: 0, anim: '', lock: null, lockT: 0, jumpT: -1, wade: 0, stepT: 0, target: null, stuck: 0, autoRead: null, blockT: 0 };
  if (save.pos && /[?&]fresh/.test(Q) === false) { P.x = save.pos[0]; P.z = save.pos[1]; P.yaw = save.pos[2] || P.yaw; }
  world.ensure(P.x, P.z);
  P.y = world.height(P.x, P.z);
  var life = PKValleyLife.create(world, scene);

  // finds lying in the valley, each with a glint; poem stops with a floating page
  // what is out there to be found: wave 1 now, wave 2 after the second storm, the dodecahedron only at night
  var WORLD = { night: false };
  function have(f) { return f.coll ? !!save.found[f.id] : !!save.tools[f.id]; }
  function available(f) { if (have(f)) return false; if (f.wave === 2 && save.wave < 2) return false; if (f.night && !WORLD.night) return false; return true; }
  var findObj = {};
  ITEMS.forEach(function (f) {
    var p = world.resolve(f.where, f.deep), g = new THREE.Group(), pr = PKWaterFinds.prop(f.id), gl = PKWaterFinds.glint();
    var y = p[2] != null ? p[2] : world.height(p[0], p[1]);
    g.position.set(p[0], y, p[1]); pr.scale.setScalar(f.id === 'stick' || f.id === 'waders' ? 1 : 1.25); g.add(pr); gl.position.y = f.id === 'stick' ? 1.6 : 0.75; g.add(gl); scene.add(g);
    if (pr.userData.lying) pr.position.y = 0.06;
    if (f.id === 'stick') pr.rotation.z = 0.25;
    findObj[f.id] = { g: g, prop: pr, glint: gl, x: p[0], z: p[1] };
  });
  function showFinds() { ITEMS.forEach(function (f) { findObj[f.id].g.visible = available(f); }); }
  showFinds();
  // skipping stones (the upgrade pass): a stack of flat stones by four of the pools. Standing at one, he can skip a stone across the water.
  // Each spot throws along the longest reach of water in front of it.
  var SKIPS = [];
  PKWaterFinds.SKIP_AT.forEach(function (sp) {
    var p = world.resolve(sp.where), x = p[0], z = p[1];
    for (var tries = 0; tries < 12 && world.water(x, z) != null; tries++) { var q = world.nudge(x + (Math.random() - 0.5) * 2, z + (Math.random() - 0.5) * 2, false); x = q[0]; z = q[1]; }
    if (world.water(x, z) != null) return;
    var best = -1, dir = 0;
    for (var a = 0; a < 32; a++) {
      var an = a / 32 * 6.283, first = -1, run = 0;
      for (var r = 1.0; r <= 14; r += 0.5) { var wet = world.water(x + Math.sin(an) * r, z + Math.cos(an) * r) != null; if (wet) { if (first < 0) first = r; run++; } else if (first >= 0) break; }
      if (first >= 0 && first <= 2.6 && run > best) { best = run; dir = an; }
    }
    if (best < 7) return;
    var g = PKWaterFinds.stonePile(); g.position.set(x, world.height(x, z), z); g.rotation.y = dir; g.scale.setScalar(2.1); g.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); scene.add(g);
    SKIPS.push({ id: sp.id, label: sp.label, x: x, z: z, dir: dir, g: g });
  });
  var STONE = { m: PKWaterFinds.skipStone(), on: false }; STONE.m.visible = false; STONE.m.scale.multiplyScalar(1.5); scene.add(STONE.m);
  function nearSkip() { if (P.wade > 0.03 || save.weather === 'storm') return null; var best = null, bd = 1.5; SKIPS.forEach(function (sp) { var d = Math.hypot(sp.x - P.x, sp.z - P.z); if (d < bd) { bd = d; best = sp; } }); return best; }
  var poemObj = {};
  POEMS.forEach(function (pm) {
    var s = world.spots.poems[pm.id], pg = PKWaterFinds.page(), y = s.y != null ? s.y : world.height(s.x, s.z);
    pg.position.set(s.x, y + 1.25, s.z); scene.add(pg);
    poemObj[pm.id] = { g: pg, x: s.x, z: s.z, face: s.face, base: pg.position.y };
  });

  // lights: soft sky plus a warm sun that follows him (shadows in a box round the view)
  var hemi = new THREE.HemisphereLight(0xfffaf2, 0xe4dccb, 0.45); scene.add(hemi);
  var sun = new THREE.DirectionalLight(0xfff6e8, 0.83); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -0.002;
  var sc = sun.shadow.camera; sc.left = sc.bottom = -14; sc.right = sc.top = 14; sc.near = 0.5; sc.far = 60; scene.add(sun); scene.add(sun.target);

  // the palette every pixel snaps to: the outline ink first, then every designed colour
  var pal = [PKToon.P.ink].concat(Object.keys(PKToon.P).filter(function (k) { return k !== 'ink'; }).map(function (k) { return PKToon.P[k]; }), PKToon2.extraPalette, PKValley.palette(), ['#a8d0de']);
  var seen = {}; pal = pal.filter(function (c) { c = c.toLowerCase(); if (seen[c]) return false; seen[c] = 1; return true; });
  var px = PKPixel3D.create(renderer, { palette: pal, snapLow: true, softInk: true }); px.setThick(EASY.on);

  // ---------------------------------------------------------------- camera
  var cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.5, 90);
  var EL_NORMAL = 0.70, EL_EASY = 0.5, EL0 = EASY.on ? EL_EASY : EL_NORMAL, EL_MIN = 0.05, EL_MAX = 1.48, Z_MIN = 0.07, Z_MAX = 1.7;
  var view = { az: 0.62, azGoal: 0.62, el: EL0, elGoal: EL0, zoom: 1, zoomGoal: 1, hv: 7, base: 7, tgt: new THREE.Vector3(), k: 2, w: 1, h: 1, close: null };
  // metres of view top to bottom: about 7.2 on a wide screen; in Easy to see about 3.2 from a lower camera, so he stands half the height of the TV
  function baseHeight(aspect) { return EASY.on ? Math.max(3.2, 2.3 / aspect) : Math.max(7.2, 4.4 / aspect); }
  function resize() {
    var w = Math.max(1, window.innerWidth), h = Math.max(1, window.innerHeight);
    renderer.setSize(w, h, false);
    var cw = Math.round(w * PDPR), ch = Math.round(h * PDPR);
    view.base = baseHeight(w / h);
    var rows = view.base * (EASY.on ? EASY.dens : DENS[save.pix]), k = Math.max(PDPR >= 1.5 || save.pix === 'extra' || save.pix === 'ultra' || EASY.on ? 1 : 2, Math.round(ch / rows));
    view.k = k; cam.top = view.base / 2; cam.bottom = -view.base / 2; px.setSize(cw, ch, k, cam); view.w = px.w; view.h = px.h;
    applyCam();
  }
  function applyCam() {
    view.hv = view.base * view.zoom;
    cam.top = view.hv / 2; cam.bottom = -view.hv / 2; var a = view.w / view.h; cam.left = -cam.top * a; cam.right = cam.top * a;
    // only draw what lies within a few metres in front of him, so a low or close view is never blocked (the depth range stays 89.5 m)
    var front = Math.max(2.2, view.hv * 1.6, view.front || 0); cam.near = 40 - front; cam.far = cam.near + 89.5;
    cam.updateProjectionMatrix();
  }
  function closeness() { var n = Math.max(0, Math.min(1, (0.6 - view.zoom) / 0.45)); return n * n * (3 - 2 * n); }
  function placeCam() {
    var t = view.tgt, ca = Math.cos(view.el);
    cam.position.set(t.x + Math.sin(view.az) * ca * 40, t.y + Math.sin(view.el) * 40, t.z + Math.cos(view.az) * ca * 40); cam.lookAt(t); cam.updateMatrixWorld();
    // the sun crosses the sky with the hours: low in the east in the morning, high to the south at midday, low in the west in the
    // evening (long shadows); the moon does the same at night. Close in, it swings round to light his face from over the camera's shoulder
    var near = closeness(), hh = ((SKY.hour % 24) + 24) % 24, day = hh > 5.6 && hh < 20.4, f = day ? (hh - 5.6) / 14.8 : ((hh + 24 - 20.4) % 24) / 9.2;
    var sa = Math.PI / 2 - Math.PI * f, sel = (day ? 0.38 : 0.6) + (day ? 0.6 : 0.3) * Math.sin(Math.PI * f), d = view.az + 0.75 - sa, a = sa + Math.atan2(Math.sin(d), Math.cos(d)) * near;
    if (EASY.on) { sel = Math.max(sel, 0.75); a = sa + Math.atan2(Math.sin(d), Math.cos(d)) * Math.max(near, 0.6); }   // Easy to see: high light on his front, short shadows
    var sr = 16.6 * Math.cos(sel);
    sun.position.set(t.x + Math.sin(a) * sr, t.y + 16.6 * Math.sin(sel), t.z + Math.cos(a) * sr); sun.target.position.copy(t); sun.target.updateMatrixWorld();
  }
  function turn(dir) { view.azGoal += dir * Math.PI / 4; }
  function tilt(d) { view.elGoal = Math.max(EL_MIN, Math.min(EL_MAX, view.elGoal + d)); }
  function zoomBy(f) { view.zoomGoal = Math.max(Z_MIN, Math.min(Z_MAX, view.zoomGoal * f)); if (view.close && view.zoomGoal > 0.5) view.close = null; markClose(); }
  function closeUp() {
    if (view.close) { view.azGoal = view.close.az; view.elGoal = view.close.el; view.zoomGoal = view.close.zoom; view.close = null; }
    else {
      view.close = { az: view.azGoal, el: view.elGoal, zoom: view.zoomGoal };
      view.azGoal = view.az + Math.atan2(Math.sin(P.yaw + 0.35 - view.az), Math.cos(P.yaw + 0.35 - view.az)); view.elGoal = 0.14; view.zoomGoal = 0.11;
    }
    markClose();
  }
  var _hd = new THREE.Vector3();
  function camAim(out) {
    if (ENDING.on && !CINE.follow) return out.copy(CINE.aim);
    if (ENDING.on && CINE.lift) { out.set(P.x, P.y + 0.9 + CINE.lift, P.z); return out; }
    var near = closeness();
    var ahead = Math.min(1.2, P.speed * 0.45) * (1 - near);
    out.set(P.x + Math.sin(P.yaw) * ahead, P.y + 0.9, P.z + Math.cos(P.yaw) * ahead);
    if (near > 0) { king.joints.Head.getWorldPosition(_hd); _hd.y += 0.15; _hd.x += Math.sin(P.yaw) * 0.04; _hd.z += Math.cos(P.yaw) * 0.04; out.lerp(_hd, near); }
    return out;
  }
  function resetView() { view.close = null; view.elGoal = EL0; view.zoomGoal = 1; markClose(); }
  function markClose() { var b = document.getElementById('bClose'); if (b) b.setAttribute('aria-pressed', view.close ? 'true' : 'false'); }

  view.tgt.set(P.x, P.y + 0.9, P.z);
  var input = { x: 0, y: 0, run: false, keys: {} };
  function setAnim(name, fade) { if (P.anim === name) return; P.anim = name; king.play(name, fade == null ? 0.2 : fade); }
  // standing about: now and then he looks up at the sky, straightens his crown or rocks on his heels; in the storm he holds his crown on
  var IDLE = { t: 0, next: 6, busy: 0, last: '' };
  function idleMoves(dt) {
    if (save.weather === 'storm' && !inShelter()) { setAnim('storm', 0.3); IDLE.t = 0; return; }
    IDLE.t += dt;
    if (IDLE.busy > 0) { IDLE.busy -= dt; if (IDLE.busy <= 0) { setAnim('idle', 0.4); IDLE.t = 0; } return; }
    if (P.anim !== 'idle') setAnim('idle', 0.3);
    if (IDLE.t > IDLE.next && !PHOTO.on && !(WATCH.on && WATCH.phase === 'walk')) {
      var pick = ['look-up', 'crown', 'rock'].filter(function (n) { return n !== IDLE.last; }); if (isNight()) pick.push('look-up');
      var n = pick[(Math.random() * pick.length) | 0]; IDLE.last = n; IDLE.next = 7 + Math.random() * 8;
      P.anim = ''; setAnim(n, 0.35); IDLE.busy = king.clips[n].duration - 0.3;
    }
  }
  function inShelter() { return typeof inCave === 'function' && inCave(); }
  setAnim('idle', 0);
  if (save.carry && save.found[save.carry]) king.setItem(save.carry);

  // ---------------------------------------------------------------- sound (made in the browser; starts with the Start button)
  var AU = { ctx: null, master: null, creek: null };
  function audioStart() {
    if (AU.ctx || !(window.AudioContext || window.webkitAudioContext)) return;
    try {
      var C = AU.ctx = new (window.AudioContext || window.webkitAudioContext)();
      AU.master = C.createGain(); AU.master.gain.value = save.sound ? 1 : 0; AU.master.connect(C.destination);
      var len = C.sampleRate * 3, buf = C.createBuffer(1, len, C.sampleRate), d = buf.getChannelData(0), last = 0;
      for (var i = 0; i < len; i++) { var wv = Math.random() * 2 - 1; last = (last + 0.02 * wv) / 1.02; d[i] = last * 3.5; }
      var src = C.createBufferSource(); src.buffer = buf; src.loop = true;
      var bp = C.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.6;
      var g = C.createGain(); g.gain.value = 0.0;
      src.connect(bp); bp.connect(g); g.connect(AU.master); src.start();
      AU.creek = g;
    } catch (e) { AU.ctx = null; }
  }
  function tone(freq, t0, dur, vol, type, pan) {
    if (!AU.ctx) return; var C = AU.ctx, o = C.createOscillator(), g = C.createGain(), t = C.currentTime + t0;
    o.type = type || 'sine'; o.frequency.value = freq; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); if (pan != null && C.createStereoPanner) { var sp = C.createStereoPanner(); sp.pan.value = pan; g.connect(sp); sp.connect(AU.master); } else g.connect(AU.master); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, freq, vol) {
    if (!AU.ctx) return; var C = AU.ctx, n = Math.round(C.sampleRate * dur), b = C.createBuffer(1, n, C.sampleRate), d = b.getChannelData(0);
    for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2);
    var s = C.createBufferSource(); s.buffer = b; var f = C.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq; var g = C.createGain(); g.gain.value = vol;
    s.connect(f); f.connect(g); g.connect(AU.master); s.start();
  }
  // ---------------------------------------------------------------- music: songs in files beside the page (music/*.mp3, see MUSIC and SETS).
  // The music is a guest here, not the host (Nov 18): the valley's own sounds and the reading voice come first.
  //   - A song plays once, right through, and then the valley is left to itself for a few minutes before the next one.
  //   - Each part of the day has its own short list (SETS). The two main songs take turns through the day.
  //   - It is kept low, drops right down under the reading voice, and stays out of the storm altogether.
  // A song that is missing is simply not played: the game is complete without any.
  var MUSIC = { pixel: 'music/pastoral-pixel.mp3', unhurried: 'music/unhurried-exploration.mp3', golden: 'music/golden-hour.mp3', quiet: 'music/pastoral-quiet.mp3' };
  var SETS = { title: ['pixel'], day: ['unhurried', 'pixel'], evening: ['golden'], night: ['quiet'], storm: [], ending: ['golden'] };
  // how long the valley is left to itself after a song, in seconds: [least, most]
  var RESTS = { title: [14, 20], day: [150, 270], evening: [130, 240], night: [130, 240], ending: [1e9, 1e9], storm: [1e9, 1e9] };
  var MUS = { decks: [], cur: null, scene: null, idx: {}, rest: 1, bad: {}, level: 0, duck: 1, fade: 2.8, played: 0, direct: location.protocol === 'file:' };
  function musicDeck() {
    var a = new Audio(); a.preload = 'auto';
    var d = { a: a, g: null, name: null, vol: 0, goal: 0 };
    a.addEventListener('error', function () { if (d.name) MUS.bad[d.name] = true; d.goal = 0; d.vol = 0; if (MUS.cur === d.name) { MUS.cur = null; MUS.rest = 2; } });
    a.addEventListener('ended', function () { if (d.goal > 0) musicOver(d); });
    // opened straight from a folder the browser will not pass a file through the mixer, so there the player's own volume is used instead
    if (!MUS.direct) { try { var src = AU.ctx.createMediaElementSource(a); d.g = AU.ctx.createGain(); d.g.gain.value = 0; src.connect(d.g); d.g.connect(AU.master); } catch (e) { d.g = null; } }
    MUS.decks.push(d); return d;
  }
  function musicScene() {
    if (TITLE.on || !playing && !WATCH.on) return 'title';
    if (ENDING.on || modal === 'endVeil' || modal === 'creditsVeil') return 'ending';
    if (save.weather === 'storm') return 'storm';
    var h = ((SKY.hour % 24) + 24) % 24; return h >= 5.4 && h < 16.6 ? 'day' : h >= 16.6 && h < 20.6 ? 'evening' : 'night';
  }
  function musicOver(d) {   // a song has played right through: now the valley has the floor for a while
    d.goal = 0; d.vol = 0; if (MUS.cur === d.name) MUS.cur = null;
    var r = RESTS[MUS.scene] || [150, 270]; MUS.rest = r[0] + Math.random() * (r[1] - r[0]);
  }
  function musicStop(fade) { MUS.decks.forEach(function (d) { if (d.goal > 0) { d.goal = 0; d.out = fade || MUS.fade; } }); MUS.cur = null; }
  function musicPlay(name) {
    if (!AU.ctx || MUS.bad[name] || !MUSIC[name]) return false;
    while (MUS.decks.length < 2) musicDeck();
    var d = MUS.decks[0].goal > 0 || MUS.decks[0].vol > 0.02 ? MUS.decks[1] : MUS.decks[0], o = d === MUS.decks[0] ? MUS.decks[1] : MUS.decks[0];
    o.goal = 0; d.name = name; d.goal = 1; d.vol = 0; d.a.src = MUSIC[name]; try { d.a.currentTime = 0; } catch (e) {} var p = d.a.play(); if (p && p.catch) p.catch(function () {});
    MUS.cur = name; MUS.played++; return true;
  }
  function musicNext(scene) {   // the next song on this part of the day's list, taking turns
    var set = (SETS[scene] || []).filter(function (n) { return !MUS.bad[n] && MUSIC[n]; }); if (!set.length) return false;
    var i = MUS.idx[scene] || 0; MUS.idx[scene] = i + 1; return musicPlay(set[i % set.length]);
  }
  function musicUpdate(dt) {
    if (!AU.ctx) return;
    var lvl = save.music === 'off' || !save.sound ? 0 : (save.music === 'quiet' || EASY.on ? 0.26 : 0.5);
    MUS.level = lvl; MUS.duck += ((speechBusy() ? 0.18 : 1) - MUS.duck) * Math.min(1, dt * 2.5);
    var sc = musicScene();
    if (sc !== MUS.scene) {
      var was = MUS.scene; MUS.scene = sc;
      var fits = MUS.cur && (SETS[sc] || []).indexOf(MUS.cur) >= 0 && sc !== 'title' && sc !== 'ending';
      if (!fits) {
        if (MUS.cur) musicStop(sc === 'storm' ? 4 : sc === 'ending' ? 3 : was === 'title' ? 3.5 : 6);
        // the title and the ending have their song straight away; coming in from the title, or into a new part of the day, the valley is heard first
        MUS.rest = sc === 'title' ? 0.6 : sc === 'ending' ? 2.5 : sc === 'storm' ? 1e9 : was === 'title' ? 22 : was === 'ending' ? 40 : was === 'storm' ? 45 : 9;
      }
    }
    if (lvl <= 0) { if (MUS.cur) musicStop(1.5); }
    else if (!MUS.cur) { MUS.rest -= dt; if (MUS.rest <= 0) { if (!musicNext(sc)) MUS.rest = 30; } }
    MUS.decks.forEach(function (d) {
      var rate = d.goal > 0 ? MUS.fade : (d.out || MUS.fade);
      d.vol += Math.max(-dt / rate, Math.min(dt / rate, d.goal - d.vol));
      var gain = d.vol * lvl * MUS.duck * 0.5;
      if (d.g) d.g.gain.value = gain; else { try { d.a.volume = Math.max(0, Math.min(1, gain)); } catch (e) {} }
      if (d.vol <= 0.001 && d.goal === 0 && !d.a.paused) d.a.pause();
    });
  }
  // sound can only start after a touch, a click or a key: the first one, anywhere (the title too), starts it
  ['pointerdown', 'keydown'].forEach(function (ev) { window.addEventListener(ev, function first() { audioStart(); if (AU.ctx && AU.ctx.state === 'suspended') AU.ctx.resume(); }, { once: true, capture: true }); });
  function setMusic(v) { save.music = v; persist(); [].forEach.call($('segMusic').children, function (b) { b.setAttribute('aria-pressed', b.dataset.v === v ? 'true' : 'false'); }); }
  [].forEach.call($('segMusic').children, function (b) { b.addEventListener('click', function () { audioStart(); setMusic(b.dataset.v); }); });

  // ---------------------------------------------------------------- the valley's voices, made from tones: birdsong by day (busiest at dawn and
  // dusk), a mourning dove now and then, crickets and tree frogs at night, the owl; none in the storm. Quiet, and to one side or the other
  var BIRDS = {
    t: 3, n: 0,
    sweep: function (f0, f1, t0, dur, vol, pan, type) {
      if (!AU.ctx) return; var C = AU.ctx, o = C.createOscillator(), g = C.createGain(), t = C.currentTime + t0;
      o.type = type || 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.03, dur * 0.3)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); if (C.createStereoPanner) { var sp = C.createStereoPanner(); sp.pan.value = pan || 0; g.connect(sp); sp.connect(AU.master); } else g.connect(AU.master); o.start(t); o.stop(t + dur + 0.05);
    },
    cardinal: function (v, p) { var n = 3 + (Math.random() * 3 | 0); for (var i = 0; i < n; i++) BIRDS.sweep(4200, 2100, i * 0.32, 0.24, v, p); },                         // cheer cheer cheer
    wren: function (v, p) { for (var i = 0; i < 3; i++) { BIRDS.sweep(3400, 4100, i * 0.42, 0.11, v, p); BIRDS.sweep(4300, 3000, i * 0.42 + 0.13, 0.13, v, p); BIRDS.sweep(2900, 3300, i * 0.42 + 0.27, 0.1, v * 0.8, p); } },   // teakettle
    chickadee: function (v, p) { BIRDS.sweep(3950, 3900, 0, 0.32, v, p); BIRDS.sweep(3450, 3400, 0.4, 0.38, v * 0.9, p); },                                                  // fee-bee
    dove: function (v, p) { BIRDS.sweep(520, 600, 0, 0.42, v, p, 'triangle'); BIRDS.sweep(620, 540, 0.5, 0.5, v * 1.1, p, 'triangle'); [1.25, 1.85, 2.45].forEach(function (d) { BIRDS.sweep(540, 500, d, 0.45, v * 0.9, p, 'triangle'); }); },
    crickets: function (v, p) { for (var i = 0; i < 4; i++) for (var q = 0; q < 3; q++) BIRDS.sweep(4600, 4600, i * 0.55 + q * 0.045, 0.03, v, p, 'square'); },
    frogs: function (v, p) { for (var i = 0; i < 2; i++) BIRDS.sweep(1700, 1500, i * 0.7, 0.18, v, p, 'sawtooth'); },
    hoot: function (near) { if (!AU.ctx) return; var v = 0.05 * Math.max(0.25, 1 - (near || 0) / 30); [[0, 0.3], [0.45, 0.22], [0.75, 0.55], [1.5, 0.35], [2.0, 0.35]].forEach(function (q) { BIRDS.sweep(330, 300, q[0], q[1], v, 0.3, 'triangle'); }); },
    update: function (dt) {
      if (!AU.ctx || !playing || TITLE.on) return;
      var h = ((SKY.hour % 24) + 24) % 24; if (save.weather === 'storm' || LOOK.st > 0.3 || ENDING.on) return;
      BIRDS.t -= dt; if (BIRDS.t > 0) return;
      var night = h > 20.6 || h < 5.4, busy = night ? 1 : (h < 9 || h > 17.5 ? 1.8 : 1), p = Math.random() * 1.6 - 0.8, v = 0.012 + Math.random() * 0.01;
      BIRDS.t = (night ? 2.5 + Math.random() * 3 : 3 + Math.random() * 7) / busy;
      if (night) { if (Math.random() < 0.7) BIRDS.crickets(v * 0.45, p); else BIRDS.frogs(v * 0.5, p); return; }
      var r = Math.random();
      if (r < 0.32) BIRDS.cardinal(v, p); else if (r < 0.56) BIRDS.wren(v, p); else if (r < 0.78) BIRDS.chickadee(v, p); else BIRDS.dove(v * 1.3, p);
    }
  };
  var SFX = {
    find: function () { tone(784, 0, 0.5, 0.12); tone(988, 0.1, 0.5, 0.11); tone(1175, 0.2, 0.8, 0.1); tone(1568, 0.32, 0.9, 0.05, 'triangle'); },
    page: function () { noise(0.25, 2400, 0.12); tone(523, 0.05, 0.6, 0.05, 'triangle'); },
    splash: function () { noise(0.18, 900, 0.08); },
    plop: function () { tone(320, 0, 0.12, 0.08); tone(180, 0.04, 0.16, 0.06); noise(0.12, 1200, 0.05); },
    done: function () { [523, 659, 784, 1047].forEach(function (f, i) { tone(f, i * 0.14, 0.9, 0.08); }); },
    ponder: function () { tone(392, 0, 1.4, 0.05, 'triangle'); tone(587, 0.18, 1.6, 0.04); tone(784, 0.36, 1.8, 0.03); tone(1175, 0.6, 2.0, 0.015); },
    shutter: function () { noise(0.06, 3000, 0.18); noise(0.09, 1200, 0.12); },
    whip: function () { noise(0.12, 1800, 0.07); },
    skip: function (n) { tone(880 + 70 * Math.min(n, 10), 0, 0.07, 0.05, 'triangle'); noise(0.06, 2600, 0.05); },
    clack: function () { tone(1400, 0, 0.04, 0.06, 'square'); noise(0.05, 3200, 0.06); },
    note: function () { tone(988, 0, 0.25, 0.04, 'triangle'); tone(1319, 0.09, 0.35, 0.035, 'triangle'); }
  };
  function setSound(on) {
    save.sound = on; persist();
    if (AU.master) AU.master.gain.value = on ? 1 : 0;
    [].forEach.call($('segSound').children, function (b) { b.setAttribute('aria-pressed', (b.dataset.v === 'on') === on ? 'true' : 'false'); });
  }

  // ---------------------------------------------------------------- UI: counters, toast, caption, prompt
  var playing = false, modal = null;
  function counts() {
    var nf = WALL.filter(function (f) { return save.found[f.id]; }).length, ns = SOLIDS.filter(function (f) { return save.found[f.id]; }).length, np = POEMS.filter(function (p) { return save.read[p.id]; }).length;
    var nh = WALL.filter(function (f) { return save.hung[f.id]; }).length;
    $('nFind').innerHTML = nf + '<small>/' + WALL.length + '</small>'; $('nSolid').innerHTML = ns + '<small>/' + SOLIDS.length + '</small>'; $('nPoem').innerHTML = np + '<small>/' + POEMS.length + '</small>';
    return { f: nf, s: ns, p: np, h: nh, bag: nf - nh };
  }
  var toastT = 0, toastQ = [];
  function toast(msg, sec) { if (capT > 0 || toastT > 0 || (PON && PON.card > 0)) { if (toastQ.length < 3 && toastQ.every(function (q) { return q[0] !== msg; })) toastQ.push([msg, sec]); return; } var t = $('toast'); t.textContent = msg; t.classList.add('on'); toastT = (sec || 3.6) * (EASY.on ? 1.8 : 1); if ((save.voice || (WATCH && WATCH.on)) && !speechBusy()) { var ts = recFor(msg); if (ts) speak([[null, ts]]); } }
  var capT = 0;
  // the caption card: Tom's specimen label (number, name, what it is, where), the line about it, and its picture
  function caption(f) {
    $('toast').classList.remove('on'); toastT = 0;
    var c = f.coll ? PKWaterFinds.collById[f.coll] : null;
    $('capK').textContent = f.coll ? (f.coll === 'solids' ? 'Found \u00b7 ' + f.element : 'No. ' + save.nums[f.id] + ' \u00b7 ' + c.title) : 'For his kit';
    $('capName').textContent = f.name; $('capTag').textContent = f.tag || ''; $('capText').textContent = f.caption;
    $('capN').textContent = f.coll === 'solids' ? counts().s + ' of 5' : f.coll ? counts().f + ' of ' + WALL.length : '';
    $('capIcon').src = icon(f.id); capFind = f;
    $('caption').classList.add('on'); capT = EASY.on ? 20 : 8;
    autoSay(findText(f), rec('find-' + f.id.toLowerCase()));
  }
  var capFind = null;
  $('caption').addEventListener('click', function () { $('caption').classList.remove('on'); capT = 0; });
  var LINES = {
    heron: 'The heron lifts off, unimpressed, and settles further down the creek.',
    turtles: 'Plop, plop, plop. The turtles leave him the log.',
    minnows: 'The minnows scatter like dropped silver.',
    frog: 'A frog leaves the conversation.',
    teal: 'The teal paddle off without hurry, as if they had somewhere better to be.',
    deer: 'Up go the white tails, and the deer are gone, over the meadow in three long bounds.',
    owl: 'The owl leaves the trestle without a sound. It has heard enough.',
    cardinal: 'A cardinal, red as a stop sign, flits off into the bushes.',
    bat: 'Bats, pouring out of the cave like smoke with somewhere to be.',
    armadillo: 'The armadillo jumps straight up, lands, and leaves at once, in full armour.',
    roadrunner: 'The roadrunner looks him over, finds him slow, and is gone up the road.',
    bassJump: 'A bass clears the water, considers the air, and goes back.',
    luna: 'A luna moth, pale green, has taken the lantern for the moon.'
  };
  var TOOL_LINES = { stick: 'With the stick he can lean against fast water now.', waders: 'With the waders on, the deep pools are his too.', lantern: 'The lantern will make the night a little smaller.' };

  // ---------------------------------------------------------------- modals
  function openModal(id) { closeModal(); $('caption').classList.remove('on'); capT = 0; modal = id; $(id).hidden = false; var f = $(id).querySelector('.x, button'); if (f) f.focus(); stopMoving(); }
  function closeModal() {
    if (!modal) return; var id = modal; modal = null; $(id).hidden = true;
    if (id === 'poemVeil' || id === 'endVeil') hush();
    if (id === 'poemVeil' && P.lock === 'read') { P.lock = null; setAnim('idle'); king.setItem(save.carry && save.found[save.carry] ? save.carry : null); }
    canvas.focus();
  }
  function stopMoving() { input.x = input.y = 0; input.keys = {}; P.target = null; stick.on = false; $('stick').style.display = 'none'; }
  ['menuClose', 'poemClose', 'poemDone', 'journalClose', 'doneClose', 'mapClose', 'studioClose', 'studioDone'].forEach(function (id) { $(id).addEventListener('click', closeModal); });
  $('doneSay').addEventListener('click', function () { say(poemText(PKWaterFinds.OPENING), rec('poem-opening')); });
  ['menu', 'poemVeil', 'journalVeil', 'doneVeil', 'mapVeil', 'studioVeil', 'photoVeil'].forEach(function (id) { $(id).addEventListener('click', function (e) { if (e.target === $(id)) closeModal(); }); });

  var currentPoem = null;
  function poemPage(pm) {
    currentPoem = pm; $('poemRest').hidden = ['bench', 'rock', 'oak', 'lookout'].indexOf(pm.id) < 0 || !!SKY.lapse;
    $('pSpot').textContent = pm.label; $('pTitle').textContent = pm.title || 'A poem for the creek'; $('pBy').textContent = byLine(pm);
    var page = $('pPage'); page.innerHTML = ''; fillPoem(page, pm);
  }
  // ---------------------------------------------------------------- the journal: a commonplace book, one page per shadow box
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function hintFor(f) { if (f.wave === 2 && save.wave < 2) return 'Not yet: the next storm will bring it down.'; return 'Look ' + f.hint + '.'; }
  function journal() {
    var c = counts(), root = $('jBook'); root.innerHTML = '';
    $('jFindN').textContent = c.f + ' of ' + WALL.length + ' finds · ' + c.s + ' of 5 solids';
    var tip = document.createElement('p'); tip.className = 'jtip';
    tip.textContent = clockLabel() + '. ' + (c.s === SOLIDS.length && !save.done ? 'All five solids are with him. Take them to the cave under the bluff and set them on the ledge.' : save.weather === 'storm' ? 'The storm is up: the Dry Fork is running and King\u2019s Creek is in flood. Sit it out anywhere.' : stormDue() ? 'Clouds are building in the west. Rest into the evening and the storm will come.' : !save.stormed ? 'Rest on a bench, the flat rock, the stump or Tom\u2019s chair to let the day go by. Another storm is due in a day or so.' : SOLIDS.some(function (f) { return f.night && !have(f); }) ? 'The storm has brought new things down. Some things only show by starlight.' : 'The storm has brought new things down.');
    root.appendChild(tip);
    if (c.bag > 0) { var bag = document.createElement('p'); bag.className = 'jbag'; bag.textContent = 'In his satchel: ' + c.bag + (c.bag === 1 ? ' thing' : ' things') + ' to hang in Tom’s studio, at the trailhead.'; root.appendChild(bag); }
    COLLS.forEach(function (col) {
      var items = FINDS.filter(function (f) { return f.coll === col.id; }), got = items.filter(have).length;
      var d = document.createElement('details'); d.className = 'jcoll' + (got === items.length ? ' full' : '');
      d.innerHTML = '<summary><b>' + esc(col.title) + '</b><span>' + got + ' of ' + items.length + '</span></summary><p class="jline">“' + esc(col.line.replace(/^“|”$/g, '')) + '” <em>' + esc(col.by) + '</em></p>' + (boxDone(col) ? boxPoemHTML(col) : '');
      d.addEventListener('toggle', function () { if (d.open && save.voice) { var cs = rec('card-' + col.id); if (cs) speak([[null, cs]]); } });
      var ul = document.createElement('ul'); ul.className = 'jlist';
      items.forEach(function (f) {
        var li = document.createElement('li'), g = have(f); li.className = g ? '' : 'no';
        li.innerHTML = (g ? '<img class="ic" alt="" src="' + icon(f.id) + '">' : '<span class="ic">?</span>') + '<div><b></b><span></span></div>';
        li.querySelector('b').textContent = g ? f.name + (save.nums[f.id] ? '  ·  No. ' + save.nums[f.id] : '') : 'Not found yet';
        li.querySelector('div span').textContent = g ? f.caption : hintFor(f);
        if (g) {
          var b = document.createElement('button'); b.type = 'button'; var on = save.carry === f.id;
          b.textContent = on ? 'Carrying' : 'Carry'; b.setAttribute('aria-pressed', on ? 'true' : 'false');
          b.addEventListener('click', function () { save.carry = save.carry === f.id ? null : f.id; persist(); king.setItem(save.carry); journal(); });
          li.appendChild(b);
        } else li.appendChild(document.createElement('span'));
        ul.appendChild(li);
      });
      d.appendChild(ul); root.appendChild(d);
    });
    var kit = document.createElement('details'); kit.className = 'jcoll'; kit.innerHTML = '<summary><b>His kit</b><span>' + TOOLS.filter(have).length + ' of 3</span></summary>';
    var ku = document.createElement('ul'); ku.className = 'jlist';
    TOOLS.forEach(function (f) { var li = document.createElement('li'), g = have(f); li.className = g ? '' : 'no'; li.innerHTML = (g ? '<img class="ic" alt="" src="' + icon(f.id) + '">' : '<span class="ic">?</span>') + '<div><b></b><span></span></div><span></span>'; li.querySelector('b').textContent = g ? f.name : 'Not found yet'; li.querySelector('div span').textContent = g ? f.caption : 'Look ' + f.hint + '.'; ku.appendChild(li); });
    kit.appendChild(ku); root.appendChild(kit);
    // the field notes: who lives along the creek, ticked off as he sees them
    var nSeen = FIELD.filter(function (q) { return save.seen[q.id]; }).length;
    var fn = document.createElement('details'); fn.className = 'jcoll' + (nSeen === FIELD.length ? ' full' : ''); fn.innerHTML = '<summary><b>Seen along the creek</b><span>' + nSeen + ' of ' + FIELD.length + '</span></summary><p class="jline">His field notes: who lives here, written down as he meets them.</p>';
    var fu = document.createElement('ul'); fu.className = 'jlist';
    FIELD.forEach(function (q) { var li = document.createElement('li'), got = !!save.seen[q.id]; li.className = got ? '' : 'no'; li.innerHTML = '<span class="ic">' + (got ? '\u2713' : '?') + '</span><div><b></b><span></span></div><span></span>'; li.querySelector('b').textContent = got ? q.name : 'Not seen yet'; li.querySelector('div span').textContent = got ? q.note : 'Look ' + q.where + '.'; fu.appendChild(li); });
    fn.appendChild(fu);
    var sk = document.createElement('p'); sk.className = 'jline'; var sb = save.skip || { best: 0, n: 0 };
    sk.textContent = sb.n ? 'Skipping stones: his best is ' + PKWaterFinds.NUMS[Math.min(sb.best, 12)].toLowerCase() + (sb.best === 1 ? ' skip' : ' skips') + ', out of ' + sb.n + (sb.n === 1 ? ' throw.' : ' throws.') : 'Flat stones are stacked by the Heron Pool, the Blue Hole, the stock pond and the spring pool. They are for skipping.';
    fn.appendChild(sk); root.appendChild(fn);
    var pc = document.createElement('details'); pc.className = 'jcoll'; pc.open = true; pc.innerHTML = '<summary><b>Poem stops</b><span>' + c.p + ' of ' + POEMS.length + '</span></summary>';
    var up = document.createElement('ul'); up.className = 'jlist';
    POEMS.forEach(function (pm) {
      var li = document.createElement('li'), got = !!save.read[pm.id]; li.className = got ? '' : 'no';
      li.innerHTML = '<span class="ic">' + (got ? '✓' : '?') + '</span><div><b></b><span></span></div>';
      li.querySelector('b').textContent = pm.label; li.querySelector('div span').textContent = got ? (pm.lines.length ? (pm.title || 'A poem for the creek') : 'A page kept for a poem by ' + pm.by + '.') : 'Not visited yet.';
      if (got) { var b = document.createElement('button'); b.type = 'button'; b.textContent = 'Open'; b.addEventListener('click', function () { poemPage(pm); openModal('poemVeil'); }); li.appendChild(b); }
      else li.appendChild(document.createElement('span'));
      up.appendChild(li);
    });
    pc.appendChild(up); root.appendChild(pc);
    // the poems written for the game: the opening one always, each shape's once he has it, the teal once he has seen them go over
    var ours = [PKWaterFinds.OPENING].concat(LEDGE.filter(function (id) { return save.found[id]; }).map(function (id) { return PKWaterFinds.SOLID_POEMS[id]; }))
      .concat(COLLS.filter(function (col) { return boxDone(col) && PKWaterFinds.BOX_POEMS[col.id]; }).map(function (col) { return PKWaterFinds.BOX_POEMS[col.id]; })).concat(save.done ? [PKWaterFinds.TEAL] : []);
    var oc = document.createElement('details'); oc.className = 'jcoll'; oc.innerHTML = '<summary><b>Poems for the game</b><span>' + ours.length + ' of ' + (7 + Object.keys(PKWaterFinds.BOX_POEMS).length) + '</span></summary>';
    var ou = document.createElement('ul'); ou.className = 'jlist';
    ours.forEach(function (pm) {
      var li = document.createElement('li'); li.innerHTML = '<span class="ic">\u270e</span><div><b></b><span></span></div>';
      li.querySelector('b').textContent = pm.title; li.querySelector('div span').textContent = pm.label + ' \u00b7 by ' + pm.by;
      var b = document.createElement('button'); b.type = 'button'; b.textContent = 'Open'; b.addEventListener('click', function () { poemPage(pm); openModal('poemVeil'); }); li.appendChild(b);
      ou.appendChild(li);
    });
    oc.appendChild(ou); root.appendChild(oc);
  }
  function openDone() { var pg = $('donePage'); pg.innerHTML = ''; fillPoem(pg, PKWaterFinds.OPENING); openModal('doneVeil'); SFX.done(); autoSay([['Every box is full.', rec('line-every-box-full')], [poemText(PKWaterFinds.OPENING), rec('poem-opening')]]); }

  // ---------------------------------------------------------------- pictures of the finds: each prop drawn once through the pixel pass
  var ICON = { cache: {}, scene: null };
  function icon(id) {
    if (ICON.cache[id]) return ICON.cache[id];
    var S = 96;
    if (!ICON.scene) {
      ICON.scene = new THREE.Scene(); ICON.scene.background = new THREE.Color('#a8d0de');
      ICON.scene.add(new THREE.HemisphereLight(0xfffaf2, 0xe4dccb, 0.5)); var dl = new THREE.DirectionalLight(0xfff6e8, 0.85); dl.position.set(-1.2, 2.2, 1.6); ICON.scene.add(dl);
      ICON.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 20); ICON.rt = new THREE.WebGLRenderTarget(S, S); ICON.px = PKPixel3D.create(renderer, { palette: pal, snapLow: true });
      ICON.buf = new Uint8Array(S * S * 4); ICON.cv = document.createElement('canvas'); ICON.cv.width = ICON.cv.height = S;
    }
    var pr = PKWaterFinds.prop(id); pr.rotation.set(0, 0, 0); ICON.scene.add(pr); pr.updateMatrixWorld(true);
    var b3 = new THREE.Box3().setFromObject(pr), c = b3.getCenter(new THREE.Vector3()), sz = b3.getSize(new THREE.Vector3()), r = Math.max(sz.x, sz.y, sz.z) * 0.62 + 0.01;
    var cam = ICON.cam; cam.position.set(c.x + 1.2, c.y + 1.4, c.z + 1.8); cam.lookAt(c); cam.near = 0.01; cam.far = 8; cam.updateMatrixWorld();
    var old = renderer.getRenderTarget(); renderer.setRenderTarget(ICON.rt);
    cam.top = r; cam.bottom = -r; ICON.px.setSize(S, S, 2, cam); cam.updateProjectionMatrix(); ICON.px.render(ICON.scene, cam);
    renderer.readRenderTargetPixels(ICON.rt, 0, 0, S, S, ICON.buf); renderer.setRenderTarget(old);
    ICON.scene.remove(pr);
    var g = ICON.cv.getContext('2d'), im = g.createImageData(S, S);
    for (var y = 0; y < S; y++) for (var x = 0; x < S; x++) { var si = ((S - 1 - y) * S + x) * 4, di = (y * S + x) * 4, R = ICON.buf[si], G = ICON.buf[si + 1], B = ICON.buf[si + 2]; im.data[di] = R; im.data[di + 1] = G; im.data[di + 2] = B; im.data[di + 3] = (Math.abs(R - 168) < 4 && Math.abs(G - 208) < 4 && Math.abs(B - 222) < 4) ? 0 : 255; }
    g.putImageData(im, 0, 0);
    return (ICON.cache[id] = ICON.cv.toDataURL());
  }

  // ---------------------------------------------------------------- Tom's studio: the wall of shadow boxes (the finds in his satchel are hung when he comes in)
  var wallProps = {};
  function wallUpdate() {
    COLLS.forEach(function (col, k) {
      var bx = world.studioBoxes[k]; if (!bx) return;
      var items = FINDS.filter(function (f) { return f.coll === col.id; });
      items.forEach(function (f, i) {
        var on = col.id === 'solids' ? !!save.found[f.id] : !!save.hung[f.id];
        if (on && !wallProps[f.id]) {
          var pr = PKWaterFinds.prop(f.id), b3 = new THREE.Box3().setFromObject(pr), sz = b3.getSize(new THREE.Vector3()), c = b3.getCenter(new THREE.Vector3()), big = Math.max(sz.x, sz.y, sz.z) || 0.1;
          var hold = new THREE.Group(); pr.position.set(-c.x, -c.y, -c.z); hold.add(pr); hold.rotation.x = Math.PI / 2; hold.scale.setScalar(0.11 / big);
          var col3 = i % 3, row = Math.floor(i / 3); hold.position.set(bx.x - 0.27 + col3 * 0.27, bx.y + 0.07 - row * 0.15, bx.z + 0.02);
          hold.traverse(function (o) { if (o.isMesh) o.castShadow = false; });
          scene.add(hold); wallProps[f.id] = hold;
        }
      });
    });
  }
  function boxDone(col) { return FINDS.filter(function (f) { return f.coll === col.id; }).every(function (f) { return col.id === 'solids' ? save.found[f.id] : save.hung[f.id]; }); }
  function openStudio() {
    var newly = WALL.filter(function (f) { return save.found[f.id] && !save.hung[f.id]; }), wasFull = {};
    COLLS.forEach(function (col) { wasFull[col.id] = boxDone(col); });
    newly.forEach(function (f) { save.hung[f.id] = true; }); persist(); wallUpdate();
    var grid = $('sGrid'); grid.innerHTML = '';
    COLLS.forEach(function (col) {
      var items = FINDS.filter(function (f) { return f.coll === col.id; }), on = function (f) { return col.id === 'solids' ? !!save.found[f.id] : !!save.hung[f.id]; }, n = items.filter(on).length, full = n === items.length;
      var box = document.createElement('div'); box.className = 'sbox' + (full ? ' full' : '');
      var slots = items.map(function (f) { var isNew = newly.indexOf(f) >= 0; return on(f) ? '<span class="slot' + (isNew ? ' new' : '') + '" title="' + esc(f.name) + '"><img alt="' + esc(f.name) + '" src="' + icon(f.id) + '"></span>' : '<span class="slot empty" title="Not found yet"></span>'; }).join('');
      box.innerHTML = '<div class="frame"><div class="slots">' + slots + '</div></div><h4>' + esc(col.title) + '</h4>' +
        (full ? '<p class="gcard"><i>' + esc(col.title) + '</i>, 2026<br>' + (col.id === 'solids' ? 'Five shapes, kept by the Philosopher King' : 'Found objects in a pine box, from along King’s Creek') + '</p>' + boxPoemHTML(col)
          : '<p class="gcount">' + n + ' of ' + items.length + (col.id === 'solids' ? ' · he keeps these with him' : '') + '</p>');
      grid.appendChild(box);
    });
    var c = counts(), done = COLLS.filter(boxDone).length;
    $('sNote').textContent = newly.length ? 'He hangs ' + newly.length + (newly.length === 1 ? ' new thing' : ' new things') + ' on the wall.' : c.f ? 'Nothing new in his satchel. The wall waits.' : 'The wall is bare. Everything on it will come out of the creek.';
    $('sCount').textContent = c.h + ' of ' + WALL.length + ' hung · ' + done + ' of ' + COLLS.length + ' boxes complete';
    if (newly.length) SFX.page();
    openModal('studioVeil'); checkDone();
    var filled = COLLS.filter(function (col) { return !wasFull[col.id] && boxDone(col) && PKWaterFinds.BOX_POEMS[col.id]; });
    if (filled.length) autoSay(filled.map(function (col) { return ['The ' + col.title.replace(/^The /, '') + ' box is full. ' + poemText(PKWaterFinds.BOX_POEMS[col.id]), rec('box-' + col.id)]; }));
  }
  function boxPoemHTML(col) { var pm = PKWaterFinds.BOX_POEMS[col.id]; if (!pm) return ''; return '<div class="gpoem">' + pm.lines.map(function (l) { return '<span>' + esc(l) + '</span>'; }).join('') + '<em>by ' + esc(pm.by) + '</em></div>'; }
  function nearStudio() { var s = world.spots.studio; return Math.hypot(s.x - P.x, s.z - P.z) < 1.8; }

  $('bJournal').addEventListener('click', function () { journal(); openModal('journalVeil'); });
  $('bMenu').addEventListener('click', function () { $('resetNote').hidden = true; resetArm = false; markDet(); openModal('menu'); });
  $('bMap').addEventListener('click', function () { openMap(); });
  $('map').addEventListener('click', function () { openMap(); });
  function setMap(on) { save.map = on; persist(); $('map').classList.toggle('hidden', !on); }
  function setPix(v) { if (!DENS[v]) return; save.pix = v; resize(); }
  // ---------------------------------------------------------------- quality: Low / Medium / High
  function fmt(n) { return n >= 1000 ? Math.round(n / 1000) + 'k' : String(n); }
  function markDet() {
    [].forEach.call($('segQual').children, function (b) { b.setAttribute('aria-pressed', b.dataset.v === save.quality ? 'true' : 'false'); });
    var kt = tris(king.root), ct = tris(world.group), all = tris(scene);
    $('qualNote').textContent = QUAL[save.quality].note;
    $('detStats').textContent = 'Drawing about ' + fmt(all) + ' triangles near him: the king ' + fmt(kt) + ', the valley ' + fmt(ct) + '.';
  }
  function setQuality(q) {
    var o = QUAL[q]; if (!o) return;
    save.quality = q; setPix(o.pix); setKingDetail(o.king); setCreekDetail(o.creek); persist(); markDet();
  }
  function setKingDetail(d) {
    if (d !== king.detail) {
      scene.remove(king.root); disposeTree(king.root);
      king = makeKing(d); scene.add(king.root);
      king.root.position.set(P.x, P.y, P.z); king.root.rotation.y = P.yaw;
      P.anim = ''; P.jumpT = -1; if (P.lock === 'hold') P.lock = null;
      setAnim(P.lock === 'read' ? 'hold-item' : 'idle', 0);
      king.setItem(P.lock === 'read' ? null : (save.carry && save.found[save.carry] ? save.carry : null));
      if (window.WWB) window.WWB.king = king;
    }
    save.kingDet = d; persist(); markDet();
  }
  function setCreekDetail(d) { if (d !== world.detail) { world.setDetail(d); world.ensure(P.x, P.z); } save.creekDet = d; persist(); markDet(); }
  [].forEach.call($('segQual').children, function (b) {
    b.addEventListener('click', function () {
      if (b.dataset.v === save.quality) return;
      [].forEach.call($('segQual').children, function (c) { c.setAttribute('aria-pressed', c === b ? 'true' : 'false'); });
      $('qualNote').textContent = QUAL[b.dataset.v].note; $('detStats').textContent = 'Rebuilding the valley…';
      PERF.off = true; setTimeout(function () { setQuality(b.dataset.v); }, 40);
    });
  });
  [].forEach.call($('segSound').children, function (b) { b.addEventListener('click', function () { audioStart(); setSound(b.dataset.v === 'on'); }); });
  $('mTurnL').addEventListener('click', function () { turn(-1); }); $('mTurnR').addEventListener('click', function () { turn(1); });
  $('mZoomIn').addEventListener('click', function () { zoomBy(0.8); }); $('mZoomOut').addEventListener('click', function () { zoomBy(1.25); });
  $('mHigher').addEventListener('click', function () { tilt(0.2); }); $('mLower').addEventListener('click', function () { tilt(-0.2); });
  $('mClose').addEventListener('click', function () { closeModal(); closeUp(); }); $('mReset2').addEventListener('click', function () { resetView(); });
  $('bClose').addEventListener('click', function () { closeUp(); });
  var card = PKCard.build();
  $('mCard').addEventListener('click', function () { closeModal(); card.open(); });
  $('mHelp').addEventListener('click', function () { closeModal(); showIntro(true); });
  var resetArm = false;
  $('mReset').addEventListener('click', function () {
    if (!resetArm) { resetArm = true; $('resetNote').hidden = false; return; }
    save.found = {}; save.hung = {}; save.tools = {}; save.nums = {}; save.n = 0; save.wave = 1; save.read = {}; save.carry = null; save.done = false; save.full = false; save.fog = ''; save.pos = null; persist(); ledgeClear(); FOG.fill(0); fogDirty = true;
    showFinds(); Object.keys(wallProps).forEach(function (k) { scene.remove(wallProps[k]); delete wallProps[k]; }); king.setItem(null); counts(); resetArm = false; $('resetNote').hidden = true;
    teleport(world.spots.start[0], world.spots.start[1], world.spots.startYaw); closeModal(); toast('Back at the trailhead.');
  });

  // ---------------------------------------------------------------- title screen
  var touchy = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  function setTouch(on) { touchy = on; document.body.classList.toggle('touch', on); $('keysTouch').classList.toggle('hidden', !on); $('keysDesk').classList.toggle('hidden', on); }
  setTouch(touchy);
  var introFirst = true;
  function showIntro(help) {
    $('bStart').textContent = help ? 'Back to the creek' : (counts().f || counts().p ? 'Carry on' : 'Start');
    $('intro').hidden = false; playing = false; stopMoving(); $('bStart').focus();
    $('ctlBox').open = !!help; if (!help) titleBegin();
  }
  // ---------------------------------------------------------------- the title: at golden hour, the camera comes slowly up King's Creek,
  // past the Heron Pool, to where he stands by the trailhead; the opening poem a stanza at a time. Start fades through to the real hour.
  var TITLE = { on: false, t: 0, i: -1, st: 0 };
  // keyframes: x, z of what the camera looks at, then its turn, its tilt and its zoom; the last is him, seen from the front three-quarters
  var TPATH = { pts: null, k: null, dur: 30 };
  function titlePath() {
    var s = world.spots.start, endAz = P.yaw + 0.55, k;
    if (Math.hypot(P.x - s[0], P.z - s[1]) < 35) k = [[-48, -8.5, 1.9, 0.5, 1.55], [-57, -5.5, 1.75, 0.5, 1.45], [-66, -2.5, 1.6, 0.52, 1.3], [-78, 2.5, 1.35, 0.56, 1.15], [-90, 8.5, 1.05, 0.6, 1.0], [P.x, P.z, endAz, 0.64, 0.82]];
    else { var bx = Math.sin(endAz), bz = Math.cos(endAz); k = [[P.x - bx * 22, P.z - bz * 22, endAz + 0.8, 0.5, 1.4], [P.x - bx * 11, P.z - bz * 11, endAz + 0.4, 0.56, 1.1], [P.x, P.z, endAz, 0.64, 0.82]]; }
    TPATH.k = k; TPATH.pts = new THREE.CatmullRomCurve3(k.map(function (q) { return new THREE.Vector3(q[0], 0, q[1]); }), false, 'centripetal'); TPATH.dur = k.length > 3 ? 30 : 16;
  }
  var TSTANZAS = (function () { var out = [], cur = []; PKWaterFinds.OPENING.lines.forEach(function (l) { if (l) cur.push(l); else if (cur.length) { out.push(cur.join('\n')); cur = []; } }); if (cur.length) out.push(cur.join('\n')); return out; })();
  function titleBegin() { titlePath(); TITLE.on = true; TITLE.t = 0; TITLE.i = -1; TITLE.st = 0; document.body.classList.add('titling'); $('tPoem').classList.remove('on'); }
  function titleEnd() {
    if (!TITLE.on) return; TITLE.on = false; document.body.classList.remove('titling'); $('tPoem').classList.remove('on');
    SKY.hour = save.hour; view.az = view.azGoal = 0.62; view.el = view.elGoal = EL0; view.zoom = view.zoomGoal = 1; camAim(view.tgt); applyCam();
  }
  // fade to dark, do fn, fade back
  function fadeThrough(fn) { var f = $('fade'); f.classList.add('on'); setTimeout(function () { try { fn(); } finally { setTimeout(function () { f.classList.remove('on'); }, 120); } }, 560); }
  var _tp = new THREE.Vector3();
  function titleUpdate(dt) {
    if (!TITLE.on) return;
    TITLE.t += dt; var u = Math.min(1, TITLE.t / TPATH.dur), e = u < 1 ? u * u * (3 - 2 * u) : 1;
    SKY.hour = 18.15;
    TPATH.pts.getPointAt(e, _tp);
    var K = TPATH.k, f = e * (K.length - 1), i0 = Math.min(K.length - 2, Math.floor(f)), w = f - i0, lerp = function (a, b) { return a + (b - a) * w; };
    var hold = Math.max(0, TITLE.t - TPATH.dur);
    view.az = view.azGoal = lerp(K[i0][2], K[i0 + 1][2]) + hold * 0.045; view.el = view.elGoal = lerp(K[i0][3], K[i0 + 1][3]); view.zoom = view.zoomGoal = lerp(K[i0][4], K[i0 + 1][4]);
    var gy = world.height(_tp.x, _tp.z); if (u >= 1) { gy = P.y; _tp.x = P.x; _tp.z = P.z; }
    view.tgt.set(_tp.x, gy + 0.9, _tp.z); applyCam();
    // the poem: a stanza every few seconds, then the title of it and who wrote it; again after a pause
    TITLE.st -= dt;
    if (TITLE.st <= 0) {
      TITLE.i++;
      if (TITLE.i < TSTANZAS.length) { $('tStanza').textContent = TSTANZAS[TITLE.i]; $('tBy').textContent = TITLE.i === TSTANZAS.length - 1 ? PKWaterFinds.OPENING.title + ' \u00b7 by ' + PKWaterFinds.OPENING.by : ''; $('tPoem').classList.add('on'); TITLE.st = Math.max(6.5, TSTANZAS[TITLE.i].split(/\s+/).length / 3.2 + 1.5); }
      else if (TITLE.i === TSTANZAS.length) { $('tPoem').classList.remove('on'); TITLE.st = 14; }
      else { TITLE.i = -1; TITLE.st = 1.5; }
    } else if (TITLE.st < 1.3 && TITLE.i < TSTANZAS.length) $('tPoem').classList.remove('on');
  }
  $('bStart').addEventListener('click', function () {
    if (TITLE.on) { $('intro').hidden = true; fadeThrough(titleEnd); }
    $('intro').hidden = true; playing = true; audioStart(); setSound(save.sound); canvas.focus(); if (save.weather === 'storm') rainStart();
    if (introFirst) { introFirst = false; if (!counts().f) setTimeout(function () { toast('The creek has been up all week. See what it has left behind.', 4.5); toast('Whatever he finds goes to the wall of Tom\u2019s studio, by the truck.', 4.5); }, 900); }
  });

  // ---------------------------------------------------------------- keyboard
  var KEYMAP = { KeyW: 'u', ArrowUp: 'u', KeyS: 'd', ArrowDown: 'd', KeyA: 'l', ArrowLeft: 'l', KeyD: 'r', ArrowRight: 'r' };
  window.addEventListener('keydown', function (e) {
    if (WATCH.on && !modal && $('cardWrap').hidden) { if (e.code === 'Space') { watchPause(); e.preventDefault(); } if (e.code === 'ArrowRight') watchSkip(); if (e.key === 'Escape') watchStop(); return; }
    if (e.key === 'Escape') { if (!$('cardWrap').hidden) return; if (modal) { if (modal !== 'endVeil' && modal !== 'creditsVeil') closeModal(); e.preventDefault(); } else if (PHOTO.on) photoClose(); return; }
    if (PHOTO.on && !modal && playing) {   // photo mode: the keys move the view, Space or Enter takes the picture
      if (e.code === 'Space' || e.code === 'Enter') { shutter(); e.preventDefault(); }
      if (e.code === 'ArrowLeft' || e.code === 'KeyA' || e.code === 'KeyZ') turn(-1); if (e.code === 'ArrowRight' || e.code === 'KeyD' || e.code === 'KeyX') turn(1);
      if (e.code === 'ArrowUp' || e.code === 'KeyW' || e.code === 'KeyR') tilt(0.12); if (e.code === 'ArrowDown' || e.code === 'KeyS' || e.code === 'KeyF') tilt(-0.12);
      if (e.key === '+' || e.key === '=') zoomBy(0.85); if (e.key === '-' || e.key === '_') zoomBy(1.18); if (e.code === 'KeyT') closeUp(); if (e.code === 'KeyP') photoClose();
      return;
    }
    if (modal === 'mapVeil' && (e.code === 'KeyM')) { closeModal(); return; }
    if (!playing || modal || !$('cardWrap').hidden) return;
    if (e.target instanceof HTMLButtonElement && (e.code === 'Space' || e.code === 'Enter')) return;
    if (KEYMAP[e.code]) { input.keys[KEYMAP[e.code]] = true; P.target = null; e.preventDefault(); }
    if (e.key === 'Shift') input.run = true;
    if (e.code === 'Space') { jump(); e.preventDefault(); }
    if (e.code === 'KeyE' || e.code === 'Enter') { act(); e.preventDefault(); }
    if (e.code === 'KeyZ') turn(-1);
    if (e.code === 'KeyQ') ponder();
    if (e.code === 'KeyB') setEasy(!EASY.on);
    if (e.code === 'KeyG') guideGo();
    if (e.code === 'KeyP') photoOpen();
    if (e.code === 'KeyX') turn(1);
    if (e.code === 'KeyR') tilt(0.15);
    if (e.code === 'KeyF') tilt(-0.15);
    if (e.code === 'KeyT') closeUp();
    if (e.code === 'KeyV') resetView();
    if (e.key === '+' || e.key === '=') zoomBy(0.85);
    if (e.key === '-' || e.key === '_') zoomBy(1.18);
    if (e.code === 'KeyJ') { journal(); openModal('journalVeil'); }
    if (e.code === 'KeyM') openMap();
    if (e.code === 'KeyN') setMap(!save.map);
    if (e.code === 'KeyC') card.open();
    if (touchy && e.code !== 'Tab') setTouch(false);
  });
  window.addEventListener('keyup', function (e) { if (KEYMAP[e.code]) input.keys[KEYMAP[e.code]] = false; if (e.key === 'Shift') input.run = false; });
  window.addEventListener('blur', function () { input.keys = {}; input.run = false; });
  canvas.addEventListener('wheel', function (e) { e.preventDefault(); if (playing && !modal) zoomBy(Math.exp(e.deltaY * 0.0012)); }, { passive: false });

  // ---------------------------------------------------------------- pointer: left drag = joystick, right drag = turn, tap / click = walk there, pinch = zoom
  var stick = { on: false, id: null, x0: 0, y0: 0, x: 0, y: 0 }, ptrs = new Map(), pinch0 = 0;
  var ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  function walkTo(cx, cy) {
    var r = canvas.getBoundingClientRect(); ndc.set((cx - r.left) / r.width * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, cam); ray.near = cam.near; ray.far = cam.far;
    var hits = ray.intersectObjects(world.lands(), false); if (!hits.length) return;
    var p = hits[0].point, wl = world.water(p.x, p.z); if (wl != null && p.y < wl) { var t = (wl - ray.ray.origin.y) / ray.ray.direction.y; p = ray.ray.origin.clone().addScaledVector(ray.ray.direction, t); }
    if (GUIDE.route) guideStop();
    P.target = { x: p.x, z: p.z, run: Math.hypot(p.x - P.x, p.z - P.z) > 7 }; P.stuck = 0;
    P.autoRead = null; POEMS.forEach(function (pm) { var o = poemObj[pm.id]; if (Math.hypot(o.x - p.x, o.z - p.z) < 1.6) { P.target.x = o.x; P.target.z = o.z; P.autoRead = pm.id; } });
    var m = $('tapmark'); m.style.left = cx + 'px'; m.style.top = cy + 'px'; m.classList.remove('on'); void m.offsetWidth; m.classList.add('on');
  }
  canvas.addEventListener('pointerdown', function (e) {
    if (!playing || modal) return;
    if (e.pointerType === 'touch' && !touchy) setTouch(true);
    ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t: performance.now(), moved: false, left: e.clientX < window.innerWidth * 0.5 });
    try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
    if (ptrs.size === 2) { var a = Array.from(ptrs.values()); pinch0 = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); stick.on = false; $('stick').style.display = 'none'; }
  });
  canvas.addEventListener('pointermove', function (e) {
    var p = ptrs.get(e.pointerId); if (!p) return;
    var dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
    if (!p.moved && Math.hypot(p.x - p.x0, p.y - p.y0) > 12) p.moved = true;
    if (ptrs.size === 2) { var a = Array.from(ptrs.values()), d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y); if (pinch0) zoomBy(pinch0 / d); pinch0 = d; return; }
    if (!p.moved) return;
    if (p.left && e.pointerType !== 'mouse' && !PHOTO.on && !ENDING.on && !WATCH.on) {
      if (!stick.on) { stick.on = true; stick.id = e.pointerId; stick.x0 = p.x0; stick.y0 = p.y0; P.target = null; var s = $('stick'); s.style.display = 'block'; s.style.left = p.x0 + 'px'; s.style.top = p.y0 + 'px'; }
      if (stick.id === e.pointerId) {
        var vx = p.x - stick.x0, vy = p.y - stick.y0, L = Math.hypot(vx, vy), R = 52, m = Math.min(1, L / R);
        stick.x = L ? vx / L * m : 0; stick.y = L ? -vy / L * m : 0;
        $('stick').querySelector('i').style.transform = 'translate(' + (stick.x * R) + 'px,' + (-stick.y * R) + 'px)';
        $('stick').classList.toggle('run', L > R * 1.25); stick.run = L > R * 1.25;
      }
    } else {
      view.azGoal -= dx * 0.008; view.az -= dx * 0.008;
      view.elGoal = Math.max(EL_MIN, Math.min(EL_MAX, view.elGoal + dy * 0.006)); view.el = view.elGoal;
    }
  });
  function ptrEnd(e) {
    var p = ptrs.get(e.pointerId); if (!p) return; ptrs.delete(e.pointerId);
    if (stick.on && stick.id === e.pointerId) { stick.on = false; stick.x = stick.y = 0; stick.run = false; $('stick').style.display = 'none'; }
    if (!p.moved && ptrs.size === 0 && pinch0 === 0 && performance.now() - p.t < 800 && e.type === 'pointerup' && !PHOTO.on && !ENDING.on && !WATCH.on) walkTo(e.clientX, e.clientY);
    if (ptrs.size < 2) pinch0 = 0;
  }
  canvas.addEventListener('pointerup', ptrEnd); canvas.addEventListener('pointercancel', ptrEnd);
  $('bJump').addEventListener('click', function () { jump(); });
  $('bAct').addEventListener('click', function () { act(); });
  $('prompt').addEventListener('click', function () { act(); });
  $('bTurnL').addEventListener('click', function () { turn(-1); }); $('bTurnR').addEventListener('click', function () { turn(1); });

  // ---------------------------------------------------------------- actions: jump, pick up, read
  function jump() {
    if (!playing || modal || P.lock || P.jumpT >= 0) return;
    P.jumpT = 0; setAnim('jump', 0.12); king.actions.jump.timeScale = 1.25;
  }
  function nearPoem() { var best = null, bd = 1.25; POEMS.forEach(function (pm) { var o = poemObj[pm.id], d = Math.hypot(o.x - P.x, o.z - P.z); if (d < bd) { bd = d; best = pm; } }); return best; }
  function nearFind(r) { var best = null, bd = r; ITEMS.forEach(function (f) { if (!available(f)) return; var o = findObj[f.id], d = Math.hypot(o.x - P.x, o.z - P.z); if (d < bd) { bd = d; best = f; } }); return best; }
  function act() {
    if (!playing || modal || P.lock) return;
    var pm = nearPoem(); if (pm) { read(pm); return; }
    if (nearStudio()) { openStudio(); return; }
    var f = nearFind(1.3); if (f) { pickUp(f); return; }
    if (inCave() && caveReady()) { startEnding(); return; }
    if (save.weather === 'storm') { stormWait(); return; }
    var sk = nearSkip(); if (sk && !WATCH.on && !PHOTO.on && !ENDING.on) skipStone(sk);
  }
  // ---------------------------------------------------------------- skipping a stone: the wind-up, the fling, and the stone going out over the water
  function skipStone(sp) {
    if (STONE.on) return;
    P.target = null; P.speed = 0; P.yaw = sp.dir; var sx = sp.x + Math.cos(sp.dir) * 0.62, sz = sp.z - Math.sin(sp.dir) * 0.62; if (world.water(sx, sz) != null) { sx = sp.x - Math.cos(sp.dir) * 0.62; sz = sp.z + Math.sin(sp.dir) * 0.62; } if (world.water(sx, sz) == null) { P.x = sx; P.z = sz; }   // he stands beside the stack, not on it
    P.lock = 'skip'; P.lockT = 1.9; P.skipT = 0; P.skipAt = sp; P.anim = ''; king.setItem('skipstone'); setAnim('skip', 0.15);
  }
  function stoneThrow(sp) {
    // how many skips he is good for this time (mostly three or four; now and then a beauty), then cut short if the far bank comes first
    var r = Math.random(), want = r < 0.07 ? 1 : r < 0.22 ? 2 : r < 0.44 ? 3 : r < 0.63 ? 4 : r < 0.77 ? 5 : r < 0.86 ? 6 : r < 0.92 ? 7 : r < 0.96 ? 8 : r < 0.98 ? 9 : 10 + Math.floor(Math.random() * 3);
    var dx = Math.sin(sp.dir), dz = Math.cos(sp.dir), x = P.x + dx * 0.45, z = P.z + dz * 0.45, y = P.y + 0.75, legs = [], L = 2.3 + Math.random() * 0.5, hit = 'sink';
    for (var i = 0; i <= want; i++) {
      var nx = x + dx * L, nz = z + dz * L, wl = world.water(nx, nz);
      if (wl == null) {   // short of the water, or over it: it lands on the bank
        if (i === 0) { for (var b = 0.9; b > 0.2 && wl == null; b -= 0.15) { nx = x + dx * L * b; nz = z + dz * L * b; wl = world.water(nx, nz); } }
        if (wl == null) { legs.push({ x0: x, z0: z, y0: y, x1: nx, z1: nz, y1: world.height(nx, nz) + 0.03, T: L / 7.5, H: 0.3 * Math.pow(0.8, i), end: 'bank' }); hit = 'bank'; break; }
      }
      legs.push({ x0: x, z0: z, y0: y, x1: nx, z1: nz, y1: wl + 0.02, T: Math.max(0.12, L / (7.5 - i * 0.25)), H: i === 0 ? 0.12 : 0.34 * Math.pow(0.8, i), end: i === want ? 'sink' : 'skip' });
      x = nx; z = nz; y = wl + 0.02; L *= 0.78;
    }
    STONE.on = true; STONE.legs = legs; STONE.i = 0; STONE.t = 0; STONE.n = 0; STONE.m.visible = true; STONE.hit = hit; STONE.spin = 0;
  }
  function stoneUpdate(dt) {
    if (P.lock === 'skip') {
      P.skipT += dt; P.lockT -= dt;
      if (P.skipAt && P.skipT >= 1.9 * 0.46) { king.setItem(null); stoneThrow(P.skipAt); P.skipAt = null; SFX.whip(); }
      if (P.lockT <= 0) { P.lock = null; P.anim = ''; setAnim('idle', 0.3); king.setItem(carryItem()); }
    }
    if (!STONE.on) return;
    var g = STONE.legs[STONE.i]; STONE.t += dt; STONE.spin += dt * 30;
    var u = Math.min(1, STONE.t / g.T);
    STONE.m.position.set(g.x0 + (g.x1 - g.x0) * u, g.y0 + (g.y1 - g.y0) * u + 4 * g.H * u * (1 - u), g.z0 + (g.z1 - g.z0) * u); STONE.m.rotation.y = STONE.spin;
    if (u < 1) return;
    if (g.end === 'skip') { STONE.n++; world.splash(g.x1, g.z1, 0.55); SFX.skip(STONE.n); STONE.i++; STONE.t = 0; return; }
    STONE.on = false; STONE.m.visible = false;
    if (g.end === 'sink') { world.splash(g.x1, g.z1, 1.0); SFX.plop(); } else SFX.clack();
    var n = STONE.n, best = n > (save.skip.best || 0) && n > 1;
    save.skip.n = (save.skip.n || 0) + 1; if (n > (save.skip.best || 0)) save.skip.best = n; persist();
    toast(PKWaterFinds.skipLine(n) + (g.end === 'bank' && n > 0 ? ' It fetches up on the far bank.' : '') + (best && save.skip.n > 1 ? ' His best yet.' : ''), 3.4);
  }
  // ---------------------------------------------------------------- the field notes: each creature is written down the first time he comes near enough to see it
  var FIELD = PKWaterFinds.FIELD, SIGHT = { t: 1 }; var _sg = new THREE.Vector3();
  function noteSeen(id) {
    if (save.seen[id] || WATCH.on) return; var f = FIELD.filter(function (q) { return q.id === id; })[0]; if (!f) return;
    save.seen[id] = true; persist(); SFX.note();
    var n = FIELD.filter(function (q) { return save.seen[q.id]; }).length;
    toast('In his field notes: ' + f.name.charAt(0).toLowerCase() + f.name.slice(1) + '. ' + n + ' of ' + FIELD.length + '.', 3.4);
    if (n === FIELD.length) toast('Everything that lives along the creek is in his field notes now.', 5);
  }
  function sightUpdate(dt) {
    SIGHT.t -= dt; if (SIGHT.t > 0) return; SIGHT.t = 0.5;
    if (!playing || modal || ENDING.on || PHOTO.on || WATCH.on || SKY.lapse) return;
    life.sight.forEach(function (sg) {
      if (save.seen[sg.id]) return;
      for (var i = 0; i < sg.objs.length; i++) {
        var o = sg.objs[i]; if (!visible(o) || Math.hypot(o.position.x - P.x, o.position.z - P.z) > sg.r) continue;
        _sg.copy(o.position).project(cam); if (Math.abs(_sg.x) < 0.96 && Math.abs(_sg.y) < 0.92) { noteSeen(sg.id); break; }   // and it has to be in the picture
      }
    });
    if (!save.seen.swallow && AMB.birds && AMB.birds.t > 1.2) noteSeen('swallow');
    if (!save.seen.firefly && AMB.fm && AMB.fm.visible && AMB.fm.count > 8) noteSeen('firefly');
  }
  function pickUp(f) {
    var o = findObj[f.id]; if (GUIDE.goal && GUIDE.goal.f === f) guideStop(); if (!f.coll) GUIDE.skip = {};
    if (f.coll) { save.found[f.id] = true; if (f.coll !== 'solids') { save.n = (save.n || 0) + 1; save.nums[f.id] = save.n; } save.carry = f.id; }
    else { save.tools[f.id] = true; if (f.id !== 'waders') save.carry = f.id; }
    persist();
    o.g.visible = false; P.target = null;
    P.yaw = Math.atan2(o.x - P.x, o.z - P.z);
    king.setItem(f.id === 'waders' ? null : f.id); P.anim = ''; setAnim(f.coll === 'solids' || !f.coll ? 'hold-up' : 'look', 0.2); P.lock = 'hold'; P.lockT = 2.4; P.speed = 0;
    var cc = counts(); caption(f); SFX.find();
    if (f.coll === 'solids') { wallUpdate(); if (cc.s === SOLIDS.length && !save.done) toast('All five shapes. There is a ledge in the cave under the bluff that would hold them.', 5.5); if (PKWaterFinds.SOLID_POEMS[f.id]) SOLIDP = { pm: PKWaterFinds.SOLID_POEMS[f.id], t: 3.4 }; }
  }
  // each of the five shapes has a poem (written for the game); it opens a moment after he picks the shape up
  var SOLIDP = null;
  function solidPoemUpdate(dt) {
    if (!SOLIDP) return; SOLIDP.t -= dt; if (SOLIDP.t > 0 || modal || PHOTO.on) return;
    var pm = SOLIDP.pm; SOLIDP = null;
    P.target = null; P.speed = 0; P.lock = 'read'; setAnim('hold-item', 0.25);
    SFX.page(); poemPage(pm); openModal('poemVeil'); autoSay(poemText(pm), poemRec(pm));
  }
  function read(pm) {
    var o = poemObj[pm.id];
    P.target = null; P.autoRead = null; P.speed = 0; P.lock = 'read';
    P.yaw = o.face; king.setItem(null); setAnim('hold-item', 0.25);
    var first = !save.read[pm.id]; save.read[pm.id] = true; persist(); counts();
    SFX.page(); poemPage(pm);
    openModal('poemVeil'); autoSay(poemText(pm), poemRec(pm)); if (first) checkDone();
  }
  function checkDone() {
    var c = counts();
    if (!save.full && c.h === WALL.length && c.p === POEMS.length) { save.full = true; persist(); setTimeout(function () { if (!modal) openDone(); else pendingDone = true; }, 1400); }
  }
  var pendingDone = false, caveTold = false;
  function teleport(x, z, yaw) { P.x = x; P.z = z; world.ensure(x, z); P.y = world.height(x, z); if (yaw != null) P.yaw = yaw; P.target = null; view.tgt.set(P.x, P.y + 0.9, P.z); }

  // ---------------------------------------------------------------- the field map: a sketch of the valley that fills in where he has walked
  var MP = world.map, MPX = 3, MW = Math.round((MP.X1 - MP.X0) * MPX), MH = Math.round((MP.Z1 - MP.Z0) * MPX);
  var FOGC = 2, FNX = Math.ceil((MP.X1 - MP.X0) / FOGC), FNZ = Math.ceil((MP.Z1 - MP.Z0) / FOGC), FOG = new Uint8Array(FNX * FNZ), fogDirty = true;
  function fogLoad() { try { if (save.fog) { var bin = atob(save.fog); for (var i = 0; i < FOG.length && i < bin.length * 8; i++) FOG[i] = (bin.charCodeAt(i >> 3) >> (i & 7)) & 1; } } catch (e) {} }
  fogLoad();
  function fogSave() { var n = Math.ceil(FOG.length / 8), b = new Uint8Array(n); for (var i = 0; i < FOG.length; i++) if (FOG[i]) b[i >> 3] |= 1 << (i & 7); var s = ''; for (var k = 0; k < n; k++) s += String.fromCharCode(b[k]); save.fog = btoa(s); }
  var fogNew = [];
  function reveal(x, z, r) {
    var i0 = Math.max(0, Math.floor((x - r - MP.X0) / FOGC)), i1 = Math.min(FNX - 1, Math.floor((x + r - MP.X0) / FOGC)), j0 = Math.max(0, Math.floor((z - r - MP.Z0) / FOGC)), j1 = Math.min(FNZ - 1, Math.floor((z + r - MP.Z0) / FOGC));
    for (var j = j0; j <= j1; j++) for (var i = i0; i <= i1; i++) { var cx = MP.X0 + (i + 0.5) * FOGC, cz = MP.Z0 + (j + 0.5) * FOGC; if (!FOG[j * FNX + i] && Math.hypot(cx - x, cz - z) < r) { FOG[j * FNX + i] = 1; fogNew.push(i, j); } }
  }
  var MAPC = document.createElement('canvas'); MAPC.width = MW; MAPC.height = MH;
  function mx(x) { return (x - MP.X0) * MPX; } function mz(z) { return (z - MP.Z0) * MPX; }
  function drawField() {
    var g = MAPC.getContext('2d');
    g.fillStyle = '#efe4c8'; g.fillRect(0, 0, MW, MH);
    // paper grain
    var RG = PKValley.rnd(5); g.fillStyle = 'rgba(160,130,90,0.08)'; for (var i = 0; i < 2600; i++) g.fillRect(RG() * MW, RG() * MH, 1 + RG() * 2, 1);
    // woods: a soft dot for every tree
    world.trees.forEach(function (t) { g.fillStyle = t.kind === 'cedar' ? 'rgba(70,104,72,0.55)' : t.kind === 'gold' ? 'rgba(206,150,70,0.55)' : 'rgba(110,140,90,0.45)'; g.beginPath(); g.arc(mx(t.x), mz(t.z), (t.kind === 'cedar' ? 1.4 : 2.2) * MPX * 0.6 * t.sz, 0, 6.3); g.fill(); });
    // the bluff and the hill: hatching down the face
    function hatch(line, out) {
      g.strokeStyle = 'rgba(122,92,62,0.7)'; g.lineWidth = 1.2;
      for (var k = 1; k < line.length; k++) {
        var a = line[k - 1], b = line[k], L = Math.hypot(b[0] - a[0], b[1] - a[1]), nx = (b[1] - a[1]) / L * out, nz = -(b[0] - a[0]) / L * out;
        for (var s = 0; s < L; s += 1.2) { var x = a[0] + (b[0] - a[0]) * s / L, z = a[1] + (b[1] - a[1]) * s / L, ln = 1.6 + 0.9 * Math.abs(Math.sin(s * 1.7 + k)); g.beginPath(); g.moveTo(mx(x), mz(z)); g.lineTo(mx(x + nx * ln), mz(z + nz * ln)); g.stroke(); }
      }
      g.strokeStyle = 'rgba(110,80,52,0.9)'; g.lineWidth = 1.6; g.beginPath(); line.forEach(function (p, k) { if (k) g.lineTo(mx(p[0]), mz(p[1])); else g.moveTo(mx(p[0]), mz(p[1])); }); g.stroke();
    }
    hatch(MP.FACE, 1); hatch(MP.HILLF, 1);
    // the road and the railroad
    g.strokeStyle = '#a89070'; g.lineWidth = 2.4 * MPX; g.beginPath(); for (var z = MP.Z0; z <= MP.Z1; z += 2) { var x = MP.ROADX + 1.2 * Math.sin(z * 0.05); if (z === MP.Z0) g.moveTo(mx(x), mz(z)); else g.lineTo(mx(x), mz(z)); } g.stroke();
    g.strokeStyle = '#efe4c8'; g.lineWidth = 1.6 * MPX; g.stroke();
    g.strokeStyle = '#5a5048'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(mx(MP.RAILX), 0); g.lineTo(mx(MP.RAILX), MH); g.stroke();
    for (z = MP.Z0; z < MP.Z1; z += 2.4) { g.beginPath(); g.moveTo(mx(MP.RAILX - 1.1), mz(z)); g.lineTo(mx(MP.RAILX + 1.1), mz(z)); g.stroke(); }
    // trails: dashed
    g.setLineDash([5, 4]); g.strokeStyle = '#8a6a42'; g.lineWidth = 1.6;
    world.trails.forEach(function (t) { if (t.road || t.rail) return; g.beginPath(); for (var k = 0; k < t.n; k += 2) { if (k) g.lineTo(mx(t.X[k]), mz(t.Z[k])); else g.moveTo(mx(t.X[k]), mz(t.Z[k])); } g.stroke(); });
    g.setLineDash([]);
    // the creeks in blue ink (the Dry Fork dotted: it only runs in a storm), the pond
    world.channels.forEach(function (c) {
      g.strokeStyle = c.id === 'dry' ? '#9ab0bc' : c.id === 'teal' ? '#4aa0aa' : '#4f86ac'; g.lineCap = 'round';
      if (c.id === 'dry') g.setLineDash([3, 3]);
      for (var k = 0; k < c.n - 2; k += 2) { g.lineWidth = Math.max(2, c.HW[k] * 2 * MPX * (c.id === 'dry' ? 0.45 : 0.8)); g.beginPath(); g.moveTo(mx(c.X[k]), mz(c.Z[k])); g.lineTo(mx(c.X[k + 2]), mz(c.Z[k + 2])); g.stroke(); }
      g.setLineDash([]);
    });
    var pd = MP.POND; g.fillStyle = '#7fa8b8'; g.strokeStyle = '#4f86ac'; g.lineWidth = 2; g.beginPath(); g.ellipse(mx(pd.x), mz(pd.z), pd.rx * MPX * 1.02, pd.rz * MPX * 1.02, 0, 0, 6.3); g.fill(); g.stroke();
    // crossings and landmarks
    function dot(x, z, r, fill, stroke) { g.fillStyle = fill; g.strokeStyle = stroke || '#3b2f22'; g.lineWidth = 1.5; g.beginPath(); g.arc(mx(x), mz(z), r, 0, 6.3); g.fill(); g.stroke(); }
    world.crossings.forEach(function (c) { if (c.kind === 'bridge') { g.strokeStyle = '#6a4c34'; g.lineWidth = 4; g.beginPath(); g.moveTo(mx(c.a[0]), mz(c.a[1])); g.lineTo(mx(c.b[0]), mz(c.b[1])); g.stroke(); } if (c.kind === 'log') { g.strokeStyle = '#6b4a33'; g.lineWidth = 3; g.beginPath(); g.moveTo(mx(c.a[0]), mz(c.a[1])); g.lineTo(mx(c.b[0]), mz(c.b[1])); g.stroke(); } if (c.kind === 'stones') { for (var q = 0; q <= 5; q++) dot(c.a[0] + (c.b[0] - c.a[0]) * q / 5, c.a[1] + (c.b[1] - c.a[1]) * q / 5, 1.6, '#dedad0', '#8a8478'); } });
    var S = world.spots;
    g.fillStyle = '#7a6450'; g.fillRect(mx(-106.7), mz(17.6), 4.4 * MPX, 3.2 * MPX);
    g.fillStyle = '#55748a'; g.save(); g.translate(mx(-97.6), mz(20.6)); g.rotate(-0.35); g.fillRect(-0.9 * MPX, -2.4 * MPX, 1.8 * MPX, 4.8 * MPX); g.restore();
    dot(S.windmill.x, S.windmill.z, 3, '#a0a4a6'); g.strokeStyle = '#3b2f22'; g.beginPath(); for (var k2 = 0; k2 < 4; k2++) { var a = k2 * Math.PI / 4; g.moveTo(mx(S.windmill.x) - Math.cos(a) * 6, mz(S.windmill.z) - Math.sin(a) * 6); g.lineTo(mx(S.windmill.x) + Math.cos(a) * 6, mz(S.windmill.z) + Math.sin(a) * 6); } g.stroke();
    g.fillStyle = '#3b2f22'; g.beginPath(); g.arc(mx(world.cave.cx), mz(world.cave.z1 - 0.6), 5, Math.PI, 0); g.fill();
    dot(S.spring.x, S.spring.z, 3.5, '#4aa0aa');
    // labels
    g.textAlign = 'center'; g.textBaseline = 'middle';
    function label(t, x, z, size, ang, color) { g.save(); g.translate(mx(x), mz(z)); g.rotate(ang || 0); g.font = 'italic ' + (size || 13) + 'px Gloock, Georgia, serif'; g.fillStyle = color || '#4a3a28'; g.fillText(t, 0, 0); g.restore(); }
    label("King's Creek", -70, -15, 16, -0.05, '#3f6f8f'); label("King's Creek", 22, -8, 14, 0.05, '#3f6f8f');
    label('Dry Fork', -8, -60, 14, -1.45, '#6a8494'); label('Teal Branch', 44, 36, 13, -1.4, '#2f8890');
    label('Stock Pond', -62, 54, 13, 0, '#3f6f8f'); label('The Bluff', 30, -44, 15); label('Dry Falls', -21, -50, 11);
    label('County Road', 76.5, -12, 11, -1.5); label('Old Railroad', 100.5, -30, 11, -1.5);
    label("Tom's studio", -104.5, 25.6, 11); label('The Cave', 12, -21.6, 11); label('The Spring', 25, 64, 11); label('Windmill', -48.5, 27.6, 10);
    label('Blue Hole', 50, 13.5, 10, 0, '#3f6f8f'); label('Heron Pool', -62, 1.6, 10, 0, '#3f6f8f'); label('Lookout', 46, -36.5, 10); label('Trestle', 104, 6, 10);
    // a frame
    g.strokeStyle = '#8f6d2a'; g.lineWidth = 3; g.strokeRect(2, 2, MW - 4, MH - 4);
    g.font = 'italic 15px Gloock, Georgia, serif'; g.fillStyle = '#4a3a28'; g.textAlign = 'left'; g.fillText('The valley, as walked by the Philosopher King', 14, MH - 14);
    g.textAlign = 'right'; g.font = '11px "IBM Plex Mono", monospace'; g.fillText('N ↑   — 20 m', MW - 14, MH - 14);
  }
  drawField();
  var FOGCV = document.createElement('canvas'); FOGCV.width = MW; FOGCV.height = MH;
  // the map as he knows it: unexplored ground is faded back to bare paper; each newly walked cell is drawn in from the full sketch
  function fogCanvas() {
    var g = FOGCV.getContext('2d'), cw = FOGC * MPX;
    if (fogDirty) {
      fogDirty = false; fogNew = []; g.clearRect(0, 0, MW, MH); g.drawImage(MAPC, 0, 0);
      g.fillStyle = 'rgba(239,228,200,0.88)';
      for (var j = 0; j < FNZ; j++) for (var i = 0; i < FNX; i++) if (!FOG[j * FNX + i]) g.fillRect(i * cw, j * cw, cw, cw);
    }
    for (var q = 0; q < fogNew.length; q += 2) { var x = fogNew[q] * cw, y = fogNew[q + 1] * cw; g.clearRect(x, y, cw, cw); g.drawImage(MAPC, x, y, cw, cw, x, y, cw, cw); }
    fogNew.length = 0;
    return FOGCV;
  }
  var MINI = { c: $('map') }, mapT = 0;
  function drawMini(t) {
    if (!save.map) return;
    var c = MINI.c, W = c.width = 168 * 2, H = c.height = 96 * 2, g = c.getContext('2d'), sc = 2.2;   // a window about 76 x 44 m round him
    var src = fogCanvas(), cx = mx(P.x), cz = mz(P.z), sw = W / sc, sh = H / sc;
    g.fillStyle = '#efe4c8'; g.fillRect(0, 0, W, H);
    g.drawImage(src, cx - sw / 2, cz - sh / 2, sw, sh, 0, 0, W, H);
    var pulse = 0.5 + 0.5 * Math.sin(t * 4);
    function toMini(x, z) { return [(mx(x) - cx) * sc + W / 2, (mz(z) - cz) * sc + H / 2]; }
    ITEMS.forEach(function (f) { if (!available(f)) return; var o = findObj[f.id], q = toMini(o.x, o.z); if (q[0] < -5 || q[1] < -5 || q[0] > W + 5 || q[1] > H + 5) return; if (!FOG[Math.floor((o.z - MP.Z0) / FOGC) * FNX + Math.floor((o.x - MP.X0) / FOGC)]) return; g.fillStyle = '#fff6d0'; g.beginPath(); g.arc(q[0], q[1], 3 + pulse * 2, 0, 6.3); g.fill(); g.fillStyle = '#d29a3a'; g.beginPath(); g.arc(q[0], q[1], 2.5, 0, 6.3); g.fill(); });
    POEMS.forEach(function (pm) { var o = poemObj[pm.id], q = toMini(o.x, o.z); g.fillStyle = save.read[pm.id] ? '#cdbf9e' : '#fffaf0'; g.strokeStyle = '#3b2f22'; g.lineWidth = 1.5; g.fillRect(q[0] - 4, q[1] - 5, 8, 10); g.strokeRect(q[0] - 4, q[1] - 5, 8, 10); });
    var hq = toMini(life.heron.g.position.x, life.heron.g.position.z); g.fillStyle = '#7d8a96'; g.beginPath(); g.arc(hq[0], hq[1], 3, 0, 6.3); g.fill();
    g.save(); g.translate(W / 2, H / 2); g.rotate(-P.yaw + Math.PI);
    g.fillStyle = '#d2402f'; g.strokeStyle = '#231d1a'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 9); g.lineTo(6, -6); g.lineTo(0, -3); g.lineTo(-6, -6); g.closePath(); g.fill(); g.stroke(); g.restore();
    g.strokeStyle = 'rgba(35,29,26,0.45)'; g.lineWidth = 2; var fx = -Math.sin(view.az), fz = -Math.cos(view.az); g.beginPath(); g.moveTo(W / 2, H / 2); g.lineTo(W / 2 + fx * 22, H / 2 + fz * 22); g.stroke();
  }
  function openMap() {
    var c = $('bigMap'), src = fogCanvas(); c.width = MW; c.height = MH; var g = c.getContext('2d'); g.drawImage(src, 0, 0);
    ITEMS.forEach(function (f) { if (!available(f)) return; var o = findObj[f.id]; if (!FOG[Math.floor((o.z - MP.Z0) / FOGC) * FNX + Math.floor((o.x - MP.X0) / FOGC)]) return; g.fillStyle = '#d29a3a'; g.strokeStyle = '#3b2f22'; g.lineWidth = 1.2; g.beginPath(); g.arc(mx(o.x), mz(o.z), 4, 0, 6.3); g.fill(); g.stroke(); });
    POEMS.forEach(function (pm) { var o = poemObj[pm.id]; g.fillStyle = save.read[pm.id] ? '#cdbf9e' : '#fffaf0'; g.strokeStyle = '#3b2f22'; g.lineWidth = 1.5; g.fillRect(mx(o.x) - 4, mz(o.z) - 5, 8, 10); g.strokeRect(mx(o.x) - 4, mz(o.z) - 5, 8, 10); });
    g.save(); g.translate(mx(P.x), mz(P.z)); g.rotate(-P.yaw + Math.PI); g.fillStyle = '#d2402f'; g.strokeStyle = '#231d1a'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, 11); g.lineTo(7, -7); g.lineTo(0, -3.5); g.lineTo(-7, -7); g.closePath(); g.fill(); g.stroke(); g.restore();
    var n = 0; for (var i = 0; i < FOG.length; i++) n += FOG[i];
    $('mapNote').textContent = 'Walked: about ' + Math.round(n / FOG.length * 100) + '% of the valley.';
    openModal('mapVeil');
  }

  // ---------------------------------------------------------------- walking: banks too steep to climb, drops too high, water too deep or too fast
  function blocked(x0, z0, x1, z1, yRef, wadeRef, strict) {
    if (yRef == null) yRef = P.y; if (wadeRef == null) wadeRef = P.wade;
    // look 0.4 m ahead: a rise of up to 0.42 m is a step (onto a stone, a log, a deck); more than that, steeper than 1.35, is a wall
    var step = Math.hypot(x1 - x0, z1 - z0) || 1e-6, ux = (x1 - x0) / step, uz = (z1 - z0) / step, LA = 0.4;
    var h0 = world.height(x0, z0, yRef), hA = world.height(x0 + ux * LA, z0 + uz * LA, yRef), rise = hA - h0;
    if (rise > 0.42 && rise / LA > 1.35) return 'steep';
    if (strict && rise < -0.42 && -rise / LA > 1.35 && !world.onPlatform(x0, z0, yRef + 0.2)) return 'steep';   // the guide never takes him down a bank he could not climb back up
    if (rise < -1.5 && !world.onPlatform(x0, z0, yRef + 0.2)) return 'drop';
    var wd = world.wading(x1, z1, yRef), deepLim = save.tools.waders ? 0.98 : 0.62, fastLim = save.tools.stick ? 0.42 : 0.16;
    if (wd > deepLim && wd > wadeRef + 0.005) return 'deep';
    if (wd > fastLim && world.fast(x1, z1) && wd > wadeRef + 0.005) return 'fast';
    return null;
  }
  var BLOCK_LINES = { steep: 'Too steep for him there. There will be a path.', drop: 'He looks down, and decides against it.', deep: 'Too deep to wade. He would want waders for that.', fast: 'The water is running too hard to wade. A good stick would help.' };
  function blockLine(why) { if (why === 'deep' && save.tools.waders) return 'Too deep, even in waders.'; if (why === 'fast' && save.tools.stick) return 'Too hard and too deep, even with the stick.'; return BLOCK_LINES[why]; }

  // ---------------------------------------------------------------- time of day, rest, and the weather
  // The hour only moves when he rests (on a bench, the flat rock, the stump by the old oak, or Tom's chair). The second storm comes
  // the first time he rests into the evening once he has found enough; it brings the creeks up and new things down with it.
  if (save.hour == null) save.hour = 8.5; if (!save.day) save.day = 1; if (!save.weather) save.weather = 'clear';
  if (!save.flow) save.flow = { main: 'high', dry: 'pools', teal: 'normal', pond: 'normal' };
  Object.keys(save.flow).forEach(function (k) { world.setFlowNow(k, save.flow[k]); });
  world.setStruck(!!save.struck);
  var SKY = { hour: save.hour, storm: save.weather === 'storm' ? 1 : 0, flash: 0, boltT: 4, thunder: [], lapse: null };
  var GRADES = [[0, [0.47, 0.52, 0.74]], [4.8, [0.48, 0.53, 0.75]], [5.9, [0.82, 0.70, 0.78]], [7.0, [0.98, 0.93, 0.90]], [8.5, [1, 1, 1]], [13, [1.03, 1.02, 0.98]],
    [16.2, [1.04, 0.97, 0.86]], [18.0, [1.02, 0.82, 0.66]], [19.4, [0.78, 0.64, 0.70]], [20.6, [0.52, 0.56, 0.78]], [24, [0.47, 0.52, 0.74]]];
  function gradeAt(h) { h = ((h % 24) + 24) % 24; for (var i = 1; i < GRADES.length; i++) if (h <= GRADES[i][0]) { var a = GRADES[i - 1], b = GRADES[i], u = (h - a[0]) / (b[0] - a[0]); u = u * u * (3 - 2 * u); return [0, 1, 2].map(function (k) { return a[1][k] + (b[1][k] - a[1][k]) * u; }); } return GRADES[0][1]; }
  function nightness(h) { h = ((h % 24) + 24) % 24; if (h < 5) return 1; if (h < 7) return 1 - (h - 5) / 2; if (h < 18.5) return 0; if (h < 21) return (h - 18.5) / 2.5; return 1; }
  function isNight() { var h = ((SKY.hour % 24) + 24) % 24; return h >= 20.6 || h < 5.4; }
  function phase(h) { h = ((h % 24) + 24) % 24; return h < 5.4 ? 'night' : h < 7.2 ? 'dawn' : h < 11.5 ? 'morning' : h < 14.5 ? 'midday' : h < 17.5 ? 'afternoon' : h < 20.6 ? 'evening' : 'night'; }
  function clockLabel() { return 'Day ' + (save.day + (SKY.hour >= 24 ? 1 : 0)) + ' · ' + (save.weather === 'storm' ? 'a storm at night' : phase(SKY.hour)); }
  function stormDue() { if (WATCH && WATCH.forceStorm) return save.weather !== 'storm' && !save.stormed; var c = counts(); return !save.stormed && save.weather !== 'storm' && (c.f >= 10 || c.s >= 2 || save.day >= 2); }
  var _gp = new THREE.Vector3();
  function skyUpdate(dt) {
    var st = SKY.storm += ((save.weather === 'storm' ? 1 : 0) - SKY.storm) * Math.min(1, dt * 0.8);
    var g = gradeAt(SKY.hour), n = nightness(SKY.hour), stK = EASY.on ? 0.3 : 1;
    if (EASY.on) g = g.map(function (v) { return v + (1 - v) * 0.7; });   // night and dusk stay readable
    g = g.map(function (v, k) { return v * (1 - st * stK * [0.36, 0.33, 0.26][k] * (1 - 0.6 * n)); });
    var lift = [0.02 * n, 0.026 * n, 0.05 * n];
    if (SKY.flash > 0) { var f = Math.min(1, SKY.flash) * (EASY.on ? 0.15 : 1); g = g.map(function (v) { return v + (1.8 - v) * f; }); lift = [0.1 * f, 0.1 * f, 0.12 * f]; SKY.flash -= dt * 5; }
    // easy to see: more contrast (darks darker, lights lighter, about the middle grey), the edges of the view a little dimmer than the pool round him
    if (EASY.on) { var ck = 1.22; g = g.map(function (v) { return v * ck * 0.9; }); lift = lift.map(function (v) { return v * ck - 0.5 * (ck - 1) * 0.9; }); }
    var tt = tintAt(SKY.hour), sk = EASY.on ? 0.35 : 1 - 0.6 * st;
    px.setGrade2([0, 1, 2].map(function (q) { return g[q] * (1 + (tt[0][q] - 1) * sk); }), [0, 1, 2].map(function (q) { return g[q] * (1 + (tt[1][q] - 1) * sk); }), lift);
    LOOK.st = st; LOOK.n = n;
    // lights: the sun sinks and weakens towards evening; at night a dim blue moon
    var day = 1 - n, h = ((SKY.hour % 24) + 24) % 24, low = h > 15 ? Math.min(1, (h - 15) / 4) : 0;
    sun.intensity = (0.35 + 0.48 * day) * (1 - st * 0.4); hemi.intensity = 0.3 + 0.15 * day;
    sun.color.setRGB(1, 0.96 - low * 0.12 * day, 0.91 - low * 0.25 * day);
    WORLD.sunLow = low * day;
    // light at night: his lantern (or, without it, a little moonlight round him), the fire in the cave, the studio window.
    // Real lights now: they fall on the ground, the trees and the walls in 3D, in dithered steps, and the lantern throws shadows
    px.setGlow(0, 0, 0, 0);
    var lamp = save.tools.lantern, amt = Math.max(n, st * 0.7), LS = [], fl = 0.92 + 0.05 * Math.sin(time * 9.1) + 0.03 * Math.sin(time * 23.7 + 1.3);
    if (amt > 0.05 && !(ENDING.on && FIRE.amt > 0.3)) {
      var hx = P.x + Math.sin(P.yaw) * 0.28 + Math.cos(P.yaw) * 0.18, hz = P.z + Math.cos(P.yaw) * 0.28 - Math.sin(P.yaw) * 0.18;
      LS.push(lamp ? { x: hx, y: P.y + 0.95, z: hz, r: 5.2 * fl, c: [1.22, 1.0, 0.72], a: Math.min(1, amt * 1.15), shadow: save.quality !== 'low' }
                   : { x: P.x, y: P.y + 1.6, z: P.z, r: 2.8, c: [0.82, 0.9, 1.08], a: amt * 0.55, shadow: false });
    }
    if (FIRE.amt > 0.02) { var ff = 0.9 + 0.07 * Math.sin(time * 11.3) + 0.04 * Math.sin(time * 27.1 + 2.1) + 0.03 * Math.sin(time * 5.3); LS.push({ x: FIRE.x, y: FIRE.y + 0.35, z: FIRE.z, r: 7.5 * ff, c: [1.3, 0.88, 0.56], a: Math.min(1, FIRE.amt * 1.1) * ff, shadow: false }); }
    if (n > 0.3 && LS.length < 3) { var stu = world.spots.studio, sd = Math.hypot(stu.x - P.x, stu.z - P.z); if (sd < 30) LS.push({ x: stu.x + 0.6, y: world.height(stu.x, stu.z) + 1.3, z: stu.z + 2.2, r: 4.5, c: [1.2, 1.0, 0.7], a: (n - 0.3) * 1.2, shadow: false }); }
    px.setLights(LS);
    var night = isNight(); if (night !== WORLD.night) { WORLD.night = night; showFinds(); if (night && playing && !save.tools.lantern && !save.lampHint && !WATCH.on && save.weather !== 'storm') { save.lampHint = true; toast('Dark already. Tom keeps a lantern in his studio.', 5); } }
    $('clock').textContent = clockLabel();
    // the storm: rain, lightning and thunder; the first bolt finds the lone oak in the pond meadow
    rainUpdate(dt, st);
    if (save.weather === 'storm') {
      SKY.boltT -= dt;
      if (SKY.boltT <= 0) {
        SKY.boltT = 6 + Math.random() * 9; SKY.flash = 1.2;
        var dist = 1 + Math.random() * 2.5;
        if (!save.struck) { save.struck = true; persist(); world.setStruck(true); var L = world.lightning, d2 = Math.hypot(L.x - P.x, L.z - P.z); dist = Math.min(3, d2 / 30); toast(d2 < 45 ? 'Lightning strikes the lone oak by the pond!' : 'A great crack of lightning, somewhere over by the pond.', 4); }
        SKY.thunder.push(dist);
      }
      for (var q = SKY.thunder.length - 1; q >= 0; q--) { SKY.thunder[q] -= dt; if (SKY.thunder[q] <= 0) { SKY.thunder.splice(q, 1); thunder(); } }
      if (Math.random() < dt * 14) { var a = Math.random() * 6.28, rr = Math.random() * 9; world.splash(P.x + Math.cos(a) * rr, P.z + Math.sin(a) * rr, 0.35); }
    }
    if (AU.rain) AU.rain.gain.value = 0.16 * st;
  }
  // ================================================================ the look of the valley through the day (the polished version)
  // shade and light are tinted apart: cool shade and warm light at the ends of the day, moonlight blue at night
  var TINTS = [[0, [0.94, 0.97, 1.1], [0.96, 0.99, 1.06]], [5.0, [0.94, 0.97, 1.1], [0.96, 0.99, 1.06]], [6.2, [0.86, 0.84, 1.06], [1.12, 0.98, 0.88]],
    [7.6, [0.9, 0.94, 1.07], [1.07, 1.02, 0.93]], [10, [0.95, 0.98, 1.05], [1.02, 1.01, 0.98]], [13.5, [0.96, 0.99, 1.04], [1.01, 1.01, 0.99]],
    [16.5, [0.92, 0.94, 1.07], [1.06, 1.01, 0.92]], [18.3, [0.85, 0.83, 1.05], [1.1, 0.98, 0.84]], [19.6, [0.82, 0.78, 1.0], [1.08, 0.9, 0.86]],
    [20.8, [0.92, 0.94, 1.1], [0.96, 0.98, 1.05]], [24, [0.94, 0.97, 1.1], [0.96, 0.99, 1.06]]];
  // the sky over the valley: the colour high up and at the horizon (in palette space, like everything the pixel pass draws)
  function hx(h) { var n = parseInt(h.slice(1), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; }
  var SKYC = [[0, '#0f1733', '#27304f'], [4.8, '#0f1733', '#27304f'], [5.9, '#3b4a78', '#e09a7c'], [7.0, '#6f9cc8', '#f2d2aa'], [8.5, '#69a5d3', '#bfdcea'],
    [13, '#5d9fd6', '#bbdced'], [16.2, '#69a0cc', '#e2dcc4'], [18.0, '#5a76a8', '#f0b072'], [19.4, '#3a4878', '#de826c'], [20.6, '#1c2448', '#4b4a6c'], [24, '#0f1733', '#27304f']].map(function (r) { return [r[0], hx(r[1]), hx(r[2])]; });
  function tableAt(T, h) { h = ((h % 24) + 24) % 24; for (var i = 1; i < T.length; i++) if (h <= T[i][0]) { var a = T[i - 1], b = T[i], u = (h - a[0]) / (b[0] - a[0]); u = u * u * (3 - 2 * u); return [1, 2].map(function (j) { return a[j].map(function (v, q) { return v + (b[j][q] - v) * u; }); }); } return [T[0][1], T[0][2]]; }
  function tintAt(h) { return tableAt(TINTS, h); }
  // colour strength through the day: fuller in the gold of morning and evening, greyer at night
  var SATS = [[0, 0.78], [5.2, 0.8], [6.6, 1.12], [8.5, 1.04], [13, 1.0], [16.5, 1.06], [18.4, 1.12], [19.8, 1.06], [21, 0.82], [24, 0.78]];
  function satAt(h) { h = ((h % 24) + 24) % 24; for (var i = 1; i < SATS.length; i++) if (h <= SATS[i][0]) { var a = SATS[i - 1], b = SATS[i], u = (h - a[0]) / (b[0] - a[0]); return a[1] + (b[1] - a[1]) * u; } return 1; }
  var LOOK = { st: 0, n: 0, drift: [0, 0], gust: 0, gustT: 0, ao: [1.0, 0.32] };
  var _sv = new THREE.Vector3();
  function lookUpdate(dt) {
    var FX = PKToon.FX, h = ((SKY.hour % 24) + 24) % 24, n = LOOK.n, st = LOOK.st, day = 1 - n;
    FX.uTime.value = time;
    // wind: a breeze that comes and goes, a gale in the storm
    LOOK.gustT -= dt; if (LOOK.gustT <= 0) { LOOK.gustT = 3 + Math.random() * 6; LOOK.gustGoal = Math.random(); }
    LOOK.gust += ((LOOK.gustGoal || 0) - LOOK.gust) * Math.min(1, dt * 0.6);
    var wk = 0.6 + 0.6 * LOOK.gust; FX.uWind.value.set(0.05 * wk, 0.014 * wk, 0.4 + 0.6 * LOOK.gust, st);
    // clouds drift with the wind; their shadows fall in the day, not at night or under the storm's cover
    LOOK.drift[0] -= dt * (0.05 + 0.1 * st) * 1.4; LOOK.drift[1] -= dt * 0.012;
    var cloudy = EASY.on ? 0 : 0.26 * day * (1 - st) * (h > 6.5 && h < 19 ? 1 : 0);
    FX.uCloud.value.set(LOOK.drift[0], LOOK.drift[1], 0.032, cloudy);
    FX.uDay.value.set(day, st);
    var ppm = px.h / Math.max(1e-3, view.hv);
    FX.uDith.value.set(EASY.on ? 0.0 : 0.035, Math.max(2, Math.round(ppm / 60)));
    // the sky, the sun or the moon, stars and haze
    var sc = tableAt(SKYC, h), top = sc[0], hor = sc[1]; LOOK.hor = hor;
    if (st > 0) { var grey = [0.32, 0.35, 0.4]; top = top.map(function (v, q) { return v + (grey[q] * (0.4 + 0.6 * day) - v) * st * 0.85; }); hor = hor.map(function (v, q) { return v + (grey[q] * (0.6 + 0.6 * day) - v) * st * 0.85; }); }
    // the sun and the moon cross the sky east to west; drawn only where the sky shows (a low view, or the far end of the valley)
    var sun = [0, 0, 0, 0], sunC = [1, 0.95, 0.78];
    var isSun = h > 5.6 && h < 20.2, sh = isSun ? (h - 5.6) / 14.6 : ((h + 24 - 20.2) % 24) / 9.4, saz = Math.PI * 0.5 - sh * Math.PI, sel = Math.sin(sh * Math.PI) * 0.9 + 0.05;
    _sv.set(Math.sin(saz) * Math.cos(sel), Math.sin(sel), Math.cos(saz) * Math.cos(sel));
    var cdir = new THREE.Vector3(); cam.getWorldDirection(cdir);
    if (st < 0.5 && _sv.dot(cdir) < 0.2) {
      var sn = LOOK.sunNear || 0, hp = _sv.clone().multiplyScalar(30 - 24 * sn).add(view.tgt).project(cam);
      sun = [(hp.x * 0.5 + 0.5) * view.w, (hp.y * 0.5 + 0.5) * view.h, Math.max(4, (0.32 + 0.22 * sn) * ppm), isSun ? 1 : 2];
      if (isSun) sunC = h < 7.5 || h > 18 ? [1, 0.8, 0.55] : [1, 0.96, 0.82]; else sunC = [0.93, 0.94, 0.98];
    }
    var stars = Math.max(0, n * 1.2 - 0.2) * (1 - st);
    px.setFX({
      ao: save.quality === 'low' ? [0, 0.3] : LOOK.ao, selOut: EASY.on ? 0 : 1, spill: EASY.on || save.quality === 'low' ? 0 : Math.max(0, n - 0.25) * 1.3, sat: satAt(h) * (1 - 0.35 * st), dcell: Math.max(2, Math.round(ppm / 60)),
      skyTop: top, skyHor: hor, skyI: [stars, EASY.on ? 0 : 0.45 + 0.4 * st, time, day], sun: sun, sunC: sunC,
      haze: [hor[0], hor[1], hor[2], EASY.on && !LOOK.skyCut ? 0 : LOOK.skyCut ? 0.95 : 0.5 + 0.25 * st + (h < 9 ? 0.15 : 0)], hazeZ: LOOK.skyCut ? [40, 2, LOOK.skyCut - 1] : [40, 4, 30],
      skyCut: LOOK.skyCut ? 40 + LOOK.skyCut : 0
    });
    if (EASY.on && !PHOTO.on && !ENDING.on) { _sv.set(P.x, P.y + 0.75, P.z).project(cam); px.setFX({ pool: [(_sv.x * 0.5 + 0.5) * view.w, (_sv.y * 0.5 + 0.5) * view.h, 1.45 * ppm, 0.62] }); }
    else px.setFX({ pool: [0, 0, 1, 0] });
  }

  // ================================================================ the air: falling leaves, fireflies at dusk, mist on the water in the morning, swallows
  var AMB = { leaves: [], flies: [], mist: [], birds: null, birdT: 12, t: 0 };
  var _ao = new THREE.Object3D();
  (function () {
    var lg = new THREE.BoxGeometry(0.075, 0.006, 0.05);
    ['gold', 'leafR', 'gold'].forEach(function (key, n) {
      var N = 26, im = new THREE.InstancedMesh(lg, PKValley.paint(key, { soft: true }), N); im.frustumCulled = false; im.castShadow = false; im.name = 'Leaves_' + n; scene.add(im);
      var d = []; for (var i = 0; i < N; i++) d.push({ x: (Math.random() - 0.5) * 18, y: Math.random() * 5, z: (Math.random() - 0.5) * 14, ph: Math.random() * 6.28, sp: 0.35 + Math.random() * 0.3, rx: Math.random() * 6, ry: Math.random() * 6 });
      AMB.leaves.push({ m: im, d: d });
    });
    // fireflies: tiny lights that drift and blink (alpha 0.25: they shine, and the pixel pass spills a glow round them at night)
    var fg = new THREE.BoxGeometry(0.05, 0.05, 0.05), fm = PKValley.paint('lamp', { glow: true });
    var FN = 46, fi = new THREE.InstancedMesh(fg, fm, FN); fi.frustumCulled = false; fi.castShadow = false; fi.name = 'Fireflies'; scene.add(fi);
    for (var i = 0; i < FN; i++) AMB.flies.push({ x: (Math.random() - 0.5) * 22, z: (Math.random() - 0.5) * 16, y: 0.3 + Math.random() * 1.3, ph: Math.random() * 100, per: 2.2 + Math.random() * 3, on: 0.35 + Math.random() * 0.4 });
    AMB.fm = fi;
    // mist: pale sheets a little above the water, see-through by dithering (no blending in the pixel pass)
    var mm = new THREE.MeshBasicMaterial({ color: '#eef6f6', opacity: 0.5, side: THREE.DoubleSide, depthWrite: true });
    AMB.mistU = { uDens: { value: 0 } };
    mm.onBeforeCompile = function (sh) {
      sh.uniforms.uDens = AMB.mistU.uDens; sh.uniforms.uTime = PKToon.FX.uTime; sh.uniforms.uDith = PKToon.FX.uDith;
      sh.vertexShader = 'varying vec3 vMW;\n' + sh.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n  vMW = (modelMatrix * vec4(transformed, 1.0)).xyz;');
      sh.fragmentShader = 'uniform float uDens; uniform float uTime; uniform vec2 uDith; varying vec3 vMW;\n' + PKToon.GLSL_NOISE + '\n' + sh.fragmentShader.replace('void main() {',
        'void main() {\n  float mn = pkNoise(vMW.xz * 0.45 + vec2(uTime * 0.05, uTime * 0.02)) * 0.65 + pkNoise(vMW.xz * 1.3 - vec2(uTime * 0.04, 0.0)) * 0.35;\n  if (pkBayer(floor(gl_FragCoord.xy / max(2.0, uDith.y))) > uDens * smoothstep(0.35, 0.75, mn) * 0.55) discard;');
    };
    mm.customProgramCacheKey = function () { return 'pk-mist'; };
    var mg = new THREE.PlaneGeometry(3.2, 1.9); mg.rotateX(-Math.PI / 2);
    for (var k = 0; k < 10; k++) { var m = new THREE.Mesh(mg, mm); m.visible = false; m.castShadow = false; m.receiveShadow = false; m.renderOrder = 2; m.name = 'Mist' + k; scene.add(m); AMB.mist.push({ m: m, x: 0, z: 0, life: 0, max: 1 }); }
    // swallows: a few dark chevrons that sweep over now and then by day
    var bg = new THREE.BufferGeometry(), bp = [0, 0, 0.06, -0.16, 0, -0.04, 0, 0, -0.02, 0, 0, 0.06, 0.16, 0, -0.04, 0, 0, -0.02];
    bg.setAttribute('position', new THREE.Float32BufferAttribute(bp, 3)); bg.computeVertexNormals();
    var bi = new THREE.InstancedMesh(bg, PKValley.paint('ink', { side: true }), 6); bi.frustumCulled = false; bi.castShadow = true; bi.visible = false; bi.name = 'Swallows'; scene.add(bi);
    AMB.birds = { m: bi, n: 6, t: -1, from: null, dir: null, off: [] };
  })();
  function ambUpdate(dt) {
    var t = view.tgt, h = ((SKY.hour % 24) + 24) % 24, st = LOOK.st, n = LOOK.n, easy = EASY.on, wind = 0.25 + 0.6 * LOOK.gust + 2.2 * st;
    // leaves: fewer in Easy to see (they are clutter there), more in the wind
    AMB.leaves.forEach(function (L, li) {
      var cnt = easy ? 0 : Math.round(L.d.length * Math.min(1, 0.45 + 0.4 * LOOK.gust + st)); L.m.count = cnt;
      for (var i = 0; i < cnt; i++) {
        var d = L.d[i]; d.y -= dt * d.sp * (1 + st); d.x += dt * (wind * 0.9 + Math.sin(time * 1.3 + d.ph) * 0.25); d.z += dt * (wind * 0.15 + Math.cos(time * 1.1 + d.ph) * 0.2);
        var gy = world.height(t.x + d.x, t.z + d.z) - t.y;
        if (d.y < gy || d.x > 9) { d.y = 3.5 + Math.random() * 2.5; d.x = (Math.random() - 0.7) * 16; d.z = (Math.random() - 0.5) * 14; }
        _ao.position.set(t.x + d.x, t.y + d.y, t.z + d.z); _ao.rotation.set(d.rx + time * 2.1 + d.ph, d.ry + time * 0.7, Math.sin(time * 3 + d.ph) * 0.8); _ao.scale.setScalar(1); _ao.updateMatrix(); L.m.setMatrixAt(i, _ao.matrix);
      }
      L.m.instanceMatrix.needsUpdate = true;
    });
    // fireflies from dusk to late evening, not in rain; over the grass round him
    var ff = h > 18.3 && h < 23.8 && st < 0.2 ? Math.min(1, (h - 18.3) / 0.8) * Math.min(1, (23.8 - h) / 0.8) : 0;   // (the upgrade pass: from dusk, so the evening has them too)
    AMB.fm.visible = ff > 0.02 && !ENDING.on;
    if (AMB.fm.visible) {
      var fc = 0;
      AMB.flies.forEach(function (f, i) {
        if (i > AMB.flies.length * ff) return;
        f.x += Math.sin(time * 0.31 + f.ph) * dt * 0.35; f.z += Math.cos(time * 0.27 + f.ph * 1.3) * dt * 0.35;
        var wx = t.x + f.x, wz = t.z + f.z; if (Math.abs(f.x) > 12) f.x *= -0.9; if (Math.abs(f.z) > 9) f.z *= -0.9;
        var ph = ((time + f.ph) % f.per) / f.per, lit = ph < f.on ? Math.sin(ph / f.on * Math.PI) : 0;
        var y = world.height(wx, wz) + f.y + Math.sin(time * 0.9 + f.ph) * 0.15, wl = world.water(wx, wz); if (wl != null) y = Math.max(y, wl + 0.25);
        _ao.position.set(wx, y, wz); _ao.rotation.set(0, 0, 0); _ao.scale.setScalar(lit > 0.15 ? 1 : 0.0001); _ao.updateMatrix(); AMB.fm.setMatrixAt(fc++, _ao.matrix);
      });
      AMB.fm.count = fc; AMB.fm.instanceMatrix.needsUpdate = true;
    }
    // fish rising (the upgrade pass): at dawn and in the evening, small rings open on the still water near him
    AMB.riseT = (AMB.riseT || 2) - dt;
    if (AMB.riseT <= 0 && st < 0.2 && ((h > 5.6 && h < 8.2) || (h > 17.4 && h < 21)) && !ENDING.on) {
      AMB.riseT = 1.2 + Math.random() * 3.2;
      var rx2 = t.x + (Math.random() - 0.5) * 16, rz2 = t.z + (Math.random() - 0.5) * 10;
      if (world.water(rx2, rz2) != null && !world.fast(rx2, rz2) && world.water(rx2, rz2) - world.height(rx2, rz2) > 0.2) world.splash(rx2, rz2, 0.3 + Math.random() * 0.25);
    }
    // mist: early morning, and all the morning after the storm, lying on the water near him
    var after = save.stormed && save.wave >= 2 && save.day >= 2 && h < 12 ? 1 : 0;
    var md = easy ? 0 : Math.max(h > 5 && h < 9.5 ? Math.min(1, (9.5 - h) / 2) * Math.min(1, (h - 5) / 0.8) : 0, after * Math.min(1, (12 - h) / 3)) * (1 - st);
    AMB.mistU.uDens.value = md;
    AMB.mist.forEach(function (M, k) {
      if (md <= 0.02) { M.m.visible = false; return; }
      M.life -= dt;
      if (M.life <= 0) {
        M.m.visible = false;
        for (var tries = 0; tries < 6; tries++) { var x = t.x + (Math.random() - 0.5) * 20, z = t.z + (Math.random() - 0.5) * 14, wl = world.water(x, z); if (wl != null) { M.x = x; M.z = z; M.y = wl + 0.18 + Math.random() * 0.25; M.max = M.life = 8 + Math.random() * 10; M.m.visible = true; M.m.rotation.y = Math.random() * 3; M.m.scale.set(1 + Math.random(), 1, 1 + Math.random() * 0.6); break; } }
        if (!M.m.visible) M.life = 1;
      }
      M.x += dt * 0.12; M.m.position.set(M.x, M.y + Math.sin(time * 0.4 + k) * 0.05, M.z);
    });
    // swallows: every so often in the day a little flock sweeps across, low over the meadow and the water
    var B = AMB.birds; AMB.birdT -= dt;
    if (B.t < 0 && AMB.birdT <= 0 && n < 0.3 && st < 0.3 && !easy) {
      AMB.birdT = 25 + Math.random() * 35; B.t = 0; var a = Math.random() * 6.28; B.dir = [Math.cos(a), Math.sin(a)]; B.from = [t.x - B.dir[0] * 16, t.z - B.dir[1] * 16, t.y];
      B.off = []; for (var q = 0; q < B.n; q++) B.off.push([(Math.random() - 0.5) * 2.4, (Math.random() - 0.5) * 2.4, 2.2 + Math.random() * 1.6, Math.random() * 6]);
    }
    B.m.visible = B.t >= 0;
    if (B.t >= 0) {
      B.t += dt; var dist = B.t * 7;
      for (var q2 = 0; q2 < B.n; q2++) {
        var o = B.off[q2], sw = Math.sin(B.t * 1.7 + o[3]) * 1.2, bx = B.from[0] + B.dir[0] * dist + o[0] - B.dir[1] * sw, bz = B.from[1] + B.dir[1] * dist + o[1] + B.dir[0] * sw;
        _ao.position.set(bx, world.height(bx, bz) + o[2], bz); _ao.rotation.set(0, Math.atan2(B.dir[0], B.dir[1]), Math.sin(B.t * 2 + o[3]) * 0.4); var fl = 0.5 + 0.5 * Math.abs(Math.sin(B.t * 14 + o[3])); _ao.scale.set(fl * 1.4, 1.4, 1.4); _ao.updateMatrix(); B.m.setMatrixAt(q2, _ao.matrix);
      }
      B.m.instanceMatrix.needsUpdate = true; if (dist > 34) B.t = -1;
    }
  }
  // rain: soft streaks falling round the view
  var RAIN = { n: 700, m: null, d: [] };
  (function () {
    PKValley.PAINT.rain = ['#b8d0d8', '#cfe0e6', '#e4f0f2']; PKValley.PAINT.rain.forEach(PKValley.note);
    var g = new THREE.BoxGeometry(0.012, 0.42, 0.012); RAIN.m = new THREE.InstancedMesh(g, PKValley.paint('rain', { soft: true }), RAIN.n);
    RAIN.m.frustumCulled = false; RAIN.m.castShadow = false; RAIN.m.visible = false; RAIN.m.name = 'Rain'; scene.add(RAIN.m);
    for (var i = 0; i < RAIN.n; i++) RAIN.d.push([(Math.random() - 0.5) * 30, Math.random() * 10, (Math.random() - 0.5) * 30]);
  })();
  var _rd = new THREE.Object3D();
  function rainUpdate(dt, st) {
    RAIN.m.visible = st > 0.05; if (!RAIN.m.visible) return;
    var t = view.tgt, cnt = Math.round(RAIN.n * Math.min(1, st)); RAIN.m.count = cnt;
    for (var i = 0; i < cnt; i++) {
      var d = RAIN.d[i]; d[1] -= dt * 10; d[0] += dt * 1.6;
      if (d[1] < -1) { d[1] += 11; d[0] = (Math.random() - 0.5) * 30; d[2] = (Math.random() - 0.5) * 30; }
      if (d[0] > 15) d[0] -= 30;
      _rd.position.set(t.x + d[0], t.y - 1 + d[1], t.z + d[2]); _rd.rotation.set(0, 0, -0.16); _rd.updateMatrix(); RAIN.m.setMatrixAt(i, _rd.matrix);
    }
    RAIN.m.instanceMatrix.needsUpdate = true;
  }
  function thunder() { if (!AU.ctx) return; noise(2.2, 160, 0.5); noise(0.5, 700, 0.12); }
  function rainStart() {
    if (AU.rain || !AU.ctx) return;
    try { var C = AU.ctx, len = C.sampleRate * 2, b = C.createBuffer(1, len, C.sampleRate), d = b.getChannelData(0); for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1; var s = C.createBufferSource(); s.buffer = b; s.loop = true; var f = C.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 2200; var g = C.createGain(); g.gain.value = 0; s.connect(f); f.connect(g); g.connect(AU.master); s.start(); AU.rain = g; } catch (e) {}
  }

  // where he can sit and let the time go by
  function seats() {
    var S = world.spots, b = world.benches, out = [];
    if (b[0]) out.push({ id: 'bench', x: b[0].seat.x, z: b[0].seat.z, y: b[0].seat.y, face: b[0].face, label: 'the bench' });
    if (b[1]) out.push({ id: 'lookout', x: b[1].seat.x, z: b[1].seat.z, y: b[1].seat.y, face: b[1].face, label: 'the lookout bench' });
    out.push({ id: 'rock', x: S.poems.rock.x, z: S.poems.rock.z, y: S.poems.rock.y, face: S.poems.rock.face, label: 'the flat rock' });
    out.push({ id: 'oak', x: S.stumpTop[0], z: S.stumpTop[2], y: S.stumpTop[1], face: S.poems.oak.face, label: 'the stump' });
    out.push({ id: 'studio', x: S.chair.x, z: S.chair.z, y: S.chair.y, face: S.chair.face, label: 'his chair in the studio' });
    return out;
  }
  var SEATS = seats(), restSeat = null;
  function openRest(seat) {
    restSeat = seat;
    var h = SKY.hour, opts = [], box = $('restOpts'); box.innerHTML = '';
    if (save.weather === 'storm') opts.push(['Until the storm has passed', 24 + 7.2]);
    else {
      [['Until the afternoon', 15], ['Until the evening', 18.6], ['Until night', 21.6]].forEach(function (o) { if (o[1] > h + 0.5) opts.push(o); });
      opts.push(['Until morning', 24 + 7.4]);
    }
    opts.forEach(function (o) { var b = document.createElement('button'); b.type = 'button'; b.className = 'btn'; b.textContent = o[0]; b.addEventListener('click', function () { closeModal(); rest(o[1]); }); box.appendChild(b); });
    $('restNote').textContent = save.weather === 'storm' ? 'The rain drums on everything. He can sit it out.' : stormDue() ? 'Clouds are building in the west. If he rests into the evening, the storm will come.' : 'It is ' + phase(h) + '. The creek will keep going while he sits.';
    $('restWhere').textContent = 'On ' + seat.label;
    openModal('restVeil');
  }
  // sit down, let the hours run past in a few seconds (the light changes, the water rises or falls), then get up
  function rest(target) {
    var s = restSeat; if (!s) return; GUIDE.skip = {};
    P.x = s.x; P.z = s.z; P.yaw = s.face; P.target = null; P.speed = 0; P.lock = 'rest'; P.y = world.height(P.x, P.z);
    king.setItem(null); setAnim('sit', 0.3);
    view.zoomGoal = Math.min(view.zoomGoal, 0.8);
    var from = SKY.hour, to = target, stormAt = null;
    if (save.weather !== 'storm' && stormDue() && to >= 18.5) { stormAt = Math.max(from + 0.5, 19.2); to = Math.max(stormAt + 1.2, 21.2); }
    SKY.lapse = { from: from, to: to, t: 0, dur: 3.2 + Math.min(4, (to - from) * 0.25), stormAt: stormAt, endStorm: save.weather === 'storm' };
  }
  function lapseUpdate(dt) {
    var L = SKY.lapse; if (!L) return;
    L.t += dt; var u = Math.min(1, L.t / L.dur), e = u * u * (3 - 2 * u), h = L.from + (L.to - L.from) * e;
    if (L.stormAt != null && !L.stormed && h >= L.stormAt) { L.stormed = true; startStorm(); }
    if (L.endStorm && !L.cleared && h >= 24 + 4.5) { L.cleared = true; endStorm(); }
    if (!L.receded && h >= L.from + 3 && save.weather !== 'storm' && !L.stormAt && !L.endStorm) { L.receded = true; settle(); }
    SKY.hour = h;
    if (u >= 1) {
      SKY.lapse = null;
      while (SKY.hour >= 24) { SKY.hour -= 24; save.day++; }
      save.hour = SKY.hour; persist();
      P.lock = 'getup'; P.lockT = 0.6;
      var ph = phase(SKY.hour);
      toast(save.weather === 'storm' ? 'The storm has come. The creeks are rising fast.' : ph === 'morning' || ph === 'dawn' ? (L.endStorm ? 'Morning. The storm has gone, and the water has brought new things down.' : 'Morning, and a fresh day on the creek.') : ph === 'afternoon' ? 'Afternoon. The shadows begin to lean.' : ph === 'evening' ? 'Evening. The light goes long and gold across the water.' : 'Night. The creek is louder in the dark.', 4.5);
      if (stormDue() && save.weather !== 'storm') toast('Clouds are building in the west.', 4);
    }
  }
  function setFlows(o) { Object.keys(o).forEach(function (k) { save.flow[k] = o[k]; world.setFlow(k, o[k]); }); persist(); }
  function settle() { setFlows({ main: 'normal', dry: save.flow.dry === 'running' ? 'pools' : save.flow.dry, teal: 'normal', pond: 'normal' }); }
  function startStorm() { save.weather = 'storm'; save.stormed = true; rainStart(); SKY.boltT = 2.5; setFlows({ main: 'flood', dry: 'running', teal: 'high', pond: 'high' }); persist(); }
  function endStorm() { save.weather = 'clear'; save.wave = 2; setFlows({ main: 'high', dry: 'pools', teal: 'normal', pond: 'normal' }); showFinds(); persist(); }
  $('poemRest').addEventListener('click', function () { var pm = currentPoem; closeModal(); var s = SEATS.filter(function (q) { return q.id === (pm && pm.id); })[0]; if (s) setTimeout(function () { openRest(s); }, 50); });
  $('studioRest').addEventListener('click', function () { closeModal(); setTimeout(function () { openRest(SEATS.filter(function (q) { return q.id === 'studio'; })[0]); }, 50); });
  $('restClose').addEventListener('click', closeModal); $('restVeil').addEventListener('click', function (e) { if (e.target === $('restVeil')) closeModal(); });
  // in a storm he can sit it out anywhere
  function stormWait() { restSeat = { x: P.x, z: P.z, y: P.y, face: P.yaw, label: 'the ground, under his hat' }; openRest(restSeat); }

  // ================================================================ step 4: read aloud, ponder, photo mode, the cave and the ending
  function carryItem() { var f = save.carry && PKWaterFinds.byId[save.carry]; return f && have(f) && f.id !== 'waders' ? f.id : null; }

  // ---------------------------------------------------------------- read aloud: the browser's own voice, or a recording of Rick where there is one
  var VOICE = { audio: null, voice: null };
  function pickVoice() {
    if (!('speechSynthesis' in window)) return null;
    var vs = speechSynthesis.getVoices().filter(function (v) { return /^en/i.test(v.lang); }); if (!vs.length) return null;
    var pref = [/Daniel/i, /Arthur/i, /UK English Male/i, /Fred/i, /Alex/i, /George/i, /Male/i, /en-GB/i];
    for (var i = 0; i < pref.length; i++) { var re = pref[i], m = vs.filter(function (v) { return re.test(v.name) || re.test(v.lang); })[0]; if (m) return m; }
    return vs[0];
  }
  try { if ('speechSynthesis' in window) { VOICE.voice = pickVoice(); speechSynthesis.onvoiceschanged = function () { VOICE.voice = pickVoice(); }; } } catch (e) {}
  // The recorded voice (Nov 18): build.py lists every MP3 in voice/ as window.WWB_VOICE. A line is spoken from its recording where there
  // is one, and by the computer voice where there is not. rec('find-stick') is that recording, if it is there; recFor(words) finds a
  // recording by the words themselves (the short lines, the Watch lines and the on-screen notes are matched this way).
  var REC = window.WWB_VOICE || { files: {}, text: {} }; VOICE.bad = {}; VOICE.run = 0; VOICE.chain = false;
  function vnorm(t) { return String(t || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
  function rec(stem) { return stem && REC.files[stem] && !VOICE.bad[stem] ? 'voice/' + stem + '.mp3' : null; }
  function recFor(text) { return text ? rec(REC.text[vnorm(text)]) : null; }
  function hush() { VOICE.run++; VOICE.busy = false; VOICE.chain = false; try { if ('speechSynthesis' in window) speechSynthesis.cancel(); } catch (e) {} if (VOICE.audio) { try { VOICE.audio.pause(); } catch (e) {} VOICE.audio = null; } }
  function tts(text, done) {
    if (!text || !('speechSynthesis' in window)) { done(); return false; }
    try { var u = new SpeechSynthesisUtterance(text); VOICE.busy = true; u.onend = u.onerror = function () { VOICE.busy = false; done(); }; if (VOICE.voice) { u.voice = VOICE.voice; u.lang = VOICE.voice.lang; } else u.lang = 'en-US'; u.rate = EASY.on ? 0.8 : 0.9; u.pitch = 0.92; speechSynthesis.speak(u); return true; } catch (e) { VOICE.busy = false; done(); return false; }
  }
  // speak a run of parts, one after another: [[words, recording], ...]. Neighbouring parts with no recording are read as one by the computer voice.
  function speak(parts) {
    hush(); var run = VOICE.run, list = [], i = 0;
    parts.forEach(function (p) { if (!p) return; var src = p[1] || recFor(p[0]), last = list[list.length - 1]; if (!src && !p[0]) return; if (!src && last && !last[1]) last[0] += ' ' + p[0]; else list.push([p[0], src]); });
    if (!list.length) return false; VOICE.chain = true;
    function next() {
      if (run !== VOICE.run) return; if (i >= list.length) { VOICE.chain = false; VOICE.audio = null; return; }
      var p = list[i++]; if (!p[1]) { tts(p[0], next); return; }
      var au, fell = false; function fall() { if (fell || run !== VOICE.run) return; fell = true; VOICE.audio = null; tts(p[0], next); }   // a recording that will not play falls back to the computer voice
      try { au = new Audio(p[1]); } catch (e) { fall(); return; }
      VOICE.audio = au; au.onended = function () { if (run === VOICE.run) next(); }; au.onerror = fall; var pr = au.play(); if (pr && pr.catch) pr.catch(fall);
    }
    next(); return true;
  }
  function say(text, audio) { return speak(typeof text === 'string' || !text ? [[text, audio]] : text); }
  function autoSay(text, audio) { if (save.voice || (WATCH && WATCH.on)) say(text, audio); }
  // the back of the character card: Starworship is read when the card is turned over, if reading aloud is on
  (function () { var tb = $('cardTurn'), bk = $('cardTurnBack'), cl = $('cardClose'); if (!tb) return;
    tb.addEventListener('click', function () { if (save.voice) { var cs = rec('poem-starworship'); if (cs) speak([[null, cs]]); } });
    [bk, cl].forEach(function (b) { if (b) b.addEventListener('click', function () { if (VOICE.audio && /poem-starworship/.test(VOICE.audio.src)) hush(); }); });
  })();
  // which recording goes with a poem page
  function poemRec(pm) {
    var F = PKWaterFinds; if (!pm) return null; if (pm.audio) return pm.audio;
    if (pm === F.ENDING) return rec('poem-ending'); if (pm === F.OPENING) return rec('poem-opening');
    for (var k in F.SOLID_POEMS) if (F.SOLID_POEMS[k] === pm) return rec('poem-solid-' + k);
    return pm.id ? rec('poem-' + pm.id) : null;
  }
  // read aloud: the title, who wrote it (and who put it into English), then the lines, a pause at the end of each
  function poemText(pm) { return (pm.title ? pm.title + '. ' : '') + (pm.lines.length ? (pm.anon ? 'From ' : 'By ') + pm.by + (pm.tr ? ', translated by ' + pm.tr : '') + '. ' + pm.lines.filter(Boolean).map(function (l) { return /[.,;:!?\u2014-]$/.test(l) ? l : l + ','; }).join(' ') : 'This page is kept for a poem by ' + pm.by + '.'); }
  function findText(f) { return f.name + '. ' + (f.tag ? f.tag + ' ' : '') + f.caption; }
  function setVoice(on) { save.voice = !!on; persist(); if (!on) hush(); [].forEach.call($('segVoice').children, function (b) { b.setAttribute('aria-pressed', (b.dataset.v === 'on') === !!on ? 'true' : 'false'); }); }
  [].forEach.call($('segVoice').children, function (b) { b.addEventListener('click', function () { save.voiceSet = true; setVoice(b.dataset.v === 'on'); if (save.voice) say('He will read things out now.'); }); });
  if (!('speechSynthesis' in window)) $('voiceRow').hidden = true;
  $('capSay').addEventListener('click', function (e) { e.stopPropagation(); if (capFind) say(findText(capFind), rec('find-' + capFind.id.toLowerCase())); capT = Math.max(capT, 7); });
  $('poemSay').addEventListener('click', function () { if (currentPoem) say(poemText(currentPoem), poemRec(currentPoem)); });

  // ---------------------------------------------------------------- Ponder: he holds up his wooden icosahedron and the valley answers a little
  var PON = { i: Math.floor(Math.random() * 9), n: 0, t: 0, shimmer: [], card: 0, text: '' };
  var beamMat = PKValley.paint('beam', { glow: true }), beamGeo = new THREE.CylinderGeometry(0.03, 0.03, 1, 6);
  function beam(o) { if (!o.beam) { o.beam = new THREE.Mesh(beamGeo, beamMat); o.beam.castShadow = false; o.beam.visible = false; o.g.add(o.beam); } return o.beam; }
  var COMPASS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
  function compass(dx, dz) { var a = Math.atan2(dx, -dz); return COMPASS[((Math.round(a / (Math.PI / 4)) % 8) + 8) % 8]; }
  var FACES = { icosa: 'twenty faces', octa: 'eight faces', cube: 'six faces', tetra: 'four faces', dodeca: 'twelve faces' };
  function ponderHint() {
    var left = SOLIDS.filter(function (f) { return !have(f); });
    if (!left.length) return save.done ? '' : 'All five shapes are with him now. The cave under the bluff has a ledge that would hold them.';
    var now = left.filter(available);
    if (now.length) {
      var best = null, bd = 1e9; now.forEach(function (f) { var o = findObj[f.id], d = Math.hypot(o.x - P.x, o.z - P.z); if (d < bd) { bd = d; best = f; } });
      var o = findObj[best.id], far = bd < 10 ? 'close by' : bd < 35 ? 'not far off' : 'a long way off';
      var cmp = compass(o.x - P.x, o.z - P.z), farKey = far === 'close by' ? 'close' : far === 'not far off' ? 'not-far' : 'long-way';
      PON.hintParts = [['Something with ' + FACES[best.id] + ' answers,', rec('ponder-faces-' + best.id)]].concat(bd < 4 ? [['close by.', rec('ponder-far-close-end')]] : [[far + ',', rec('ponder-far-' + farKey)], ['to the ' + cmp + '.', rec('ponder-dir-' + cmp)]]);
      return 'Something with ' + FACES[best.id] + ' answers, ' + far + (bd < 4 ? '.' : ', to the ' + cmp + '.');
    }
    var w2 = left.filter(function (f) { return f.wave === 2 && save.wave < 2; }).length;
    if (w2) return w2 > 1 ? 'Two of the shapes are still up the valley somewhere, waiting for the next storm to bring them down.' : 'One of the shapes is waiting for the next storm.';
    if (left.some(function (f) { return f.night; })) return 'One of the shapes only answers by starlight.';
    return '';
  }
  function ponder() {
    if (!playing || modal || P.lock || P.jumpT >= 0) return;
    P.target = null; P.speed = 0; P.lock = 'ponder'; P.lockT = 3.4;
    king.setItem('icosa'); P.anim = ''; setAnim('hold-up', 0.2);
    var lines = PKWaterFinds.PONDER.concat(PKWaterFinds.RICK_LINES), q = lines[PON.i++ % lines.length], note = PKWaterFinds.NOTICE[PON.n++ % PKWaterFinds.NOTICE.length];
    // what is lying out nearby catches the light; an unfound solid within reach sends up a beam
    PON.shimmer.forEach(function (o) { if (o.beam) o.beam.visible = false; });
    PON.shimmer = []; ITEMS.forEach(function (f) { if (!available(f)) return; var o = findObj[f.id], d = Math.hypot(o.x - P.x, o.z - P.z); if (d < (f.coll === 'solids' ? 60 : 16)) PON.shimmer.push(o); });
    PON.t = 7;
    PON.hintParts = null; var hint = ponderHint();
    $('ponNote').textContent = note + (hint ? ' ' + hint : '');
    $('ponLine').textContent = '“' + q.line + '”'; $('ponBy').textContent = q.by;
    $('toast').classList.remove('on'); toastT = 0; $('caption').classList.remove('on'); capT = 0;
    $('ponder').classList.add('on'); PON.card = 10;
    PON.text = note + ' ' + (hint ? hint + ' ' : '') + q.line + ' ' + q.by + '.';
    // the commonplace line's recording is found by how the line begins (the recording goes on to say whose it is)
    var qk = vnorm(q.line), qStem = null; for (var tk in REC.text) if (/^ponder-line-/.test(REC.text[tk]) && tk.indexOf(qk) === 0) { qStem = REC.text[tk]; break; }
    PON.parts = [[note, null]].concat(hint ? (PON.hintParts || [[hint, null]]) : []).concat([[q.line + ' ' + q.by + '.', rec(qStem)]]);
    SFX.ponder(); autoSay(PON.parts);
  }
  function ponderUpdate(dt) {
    if (PON.card > 0) { PON.card -= dt; if (PON.card <= 0) $('ponder').classList.remove('on'); }
    if (PON.t <= 0) return;
    PON.t -= dt; var e = Math.max(0, Math.min(1, PON.t / 1.5, (7 - PON.t) / 0.6));
    PON.shimmer.forEach(function (o, i) {
      var b = beam(o); b.visible = PON.t > 0 && o.g.visible; if (!b.visible) return;
      var hgt = 3.2 * e; b.scale.set(0.6 + 0.4 * Math.sin(time * 9 + i), hgt, 0.6 + 0.4 * Math.sin(time * 9 + i)); b.position.y = 0.4 + hgt / 2;
    });
  }
  $('ponder').addEventListener('click', function () { $('ponder').classList.remove('on'); PON.card = 0; });
  $('ponSay').addEventListener('click', function (e) { e.stopPropagation(); say(PON.parts || PON.text); PON.card = Math.max(PON.card, 8); });
  $('bPonder').addEventListener('click', function () { ponder(); });

  // ---------------------------------------------------------------- photo mode: pose him, crown on or off, turn the view, take the picture
  var PHOTO = { on: false, pose: 'stand', crown: true, frame: 'tag', url: '' };
  var POSES = { stand: ['idle', null], icosa: ['hold-up', 'icosa'], bottle: ['hold-item', 'bottle'], find: ['hold-item', '*'] };
  function marks(seg, v) { [].forEach.call($(seg).children, function (b) { b.setAttribute('aria-pressed', b.dataset.v === String(v) ? 'true' : 'false'); }); }
  function photoPose(id) {
    if (!POSES[id]) return; PHOTO.pose = id; var p = POSES[id], item = p[1] === '*' ? (carryItem() || 'bowl') : p[1];
    P.anim = ''; setAnim(p[0], 0.25); king.setItem(item); marks('segPose', id);
  }
  function setCrown(on) { PHOTO.crown = on; king.setHat(on ? 'crown' : null); marks('segCrown', on ? 'on' : 'off'); }
  function photoOpen() {
    if (!playing || modal || P.lock || P.jumpT >= 0) return;
    PHOTO.on = true; P.lock = 'photo'; P.target = null; P.speed = 0; stopMoving();
    document.body.classList.add('photo'); $('photoBar').hidden = false;
    $('caption').classList.remove('on'); capT = 0; $('toast').classList.remove('on'); toastT = 0; $('ponder').classList.remove('on'); PON.card = 0;
    photoPose(PHOTO.pose); setCrown(PHOTO.crown); marks('segFrame', PHOTO.frame);
    $('bShutter').focus();
  }
  function photoClose() {
    if (!PHOTO.on) return; PHOTO.on = false; if (P.lock === 'photo') P.lock = null;
    document.body.classList.remove('photo'); $('photoBar').hidden = true;
    king.setHat('crown'); P.anim = ''; setAnim('idle', 0.3); king.setItem(carryItem()); canvas.focus();
  }
  function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
  function compose(im) {
    var W = im.width, H = im.height, out = document.createElement('canvas'), g;
    if (PHOTO.frame === 'plain') { out.width = W; out.height = H; g = out.getContext('2d'); g.drawImage(im, 0, 0); return out.toDataURL('image/png'); }
    // a cream mat with a gold rule, and one of Tom's specimen tags tied on at the bottom left
    var u = Math.round(Math.min(W, H) * 0.04), m = u, mb = Math.round(u * 1.2);
    out.width = W + m * 2; out.height = H + m + mb; g = out.getContext('2d');
    g.fillStyle = '#f3e9d2'; g.fillRect(0, 0, out.width, out.height);
    g.drawImage(im, m, m);
    g.strokeStyle = '#8f6d2a'; g.lineWidth = Math.max(2, u * 0.12); g.strokeRect(m - u * 0.25, m - u * 0.25, W + u * 0.5, H + u * 0.5);
    var tw = Math.round(Math.min(W * 0.62, u * 15)), th = Math.round(tw * 0.36), tx = m + u * 0.8, ty = m + H - th - u * 0.4;
    g.save(); g.translate(tx, ty); g.rotate(-0.035);
    g.fillStyle = 'rgba(0,0,0,0.25)'; roundRect(g, u * 0.12, u * 0.16, tw, th, u * 0.3); g.fill();
    g.fillStyle = '#fbf3df'; roundRect(g, 0, 0, tw, th, u * 0.3); g.fill(); g.strokeStyle = '#b89a5e'; g.lineWidth = Math.max(1.5, u * 0.06); g.stroke();
    var hole = th * 0.5; g.fillStyle = '#d9c9a4'; g.beginPath(); g.arc(th * 0.28, hole, th * 0.09, 0, 6.3); g.fill(); g.strokeStyle = '#8f6d2a'; g.stroke();
    g.strokeStyle = '#6a4c34'; g.lineWidth = Math.max(1.5, u * 0.07); g.beginPath(); g.moveTo(th * 0.28, hole); g.quadraticCurveTo(-th * 0.3, hole - th * 0.5, -th * 0.1, -th * 0.6); g.stroke();
    var lx = th * 0.55, fs = th * 0.2;
    var room = tw - lx - th * 0.12;
    function fit(txt, font, px, y, col) { var sz = px; g.font = font.replace('#', sz); while (sz > 6 && g.measureText(txt).width > room) { sz -= 1; g.font = font.replace('#', sz); } g.fillStyle = col; g.fillText(txt, lx, y); }
    g.textBaseline = 'alphabetic';
    fit('SPECIMEN \u00b7 KING\u2019S CREEK', '500 #px "IBM Plex Mono", ui-monospace, monospace', Math.round(fs * 0.62), th * 0.3, '#7a6a52');
    fit('The Philosopher King', '#px Gloock, Georgia, serif', Math.round(fs * 1.25), th * 0.58, '#3b2f22');
    fit('Richard Sale \u00b7 day ' + save.day + ', ' + (save.weather === 'storm' ? 'in the storm' : phase(SKY.hour) === 'night' ? 'by starlight' : phase(SKY.hour)), 'italic #px Georgia, serif', Math.round(fs * 0.8), th * 0.82, '#4a3c2a');
    g.restore();
    return out.toDataURL('image/png');
  }
  function shutter() {
    if (!PHOTO.on || modal) return;
    render(); var src;
    try { src = canvas.toDataURL('image/png'); } catch (e) { toast('This browser would not hand over the picture.'); return; }
    SFX.shutter(); $('flash').classList.remove('on'); void $('flash').offsetWidth; $('flash').classList.add('on');
    var im = new Image(); im.onload = function () { PHOTO.url = compose(im); $('photoImg').src = PHOTO.url; openModal('photoVeil'); }; im.src = src;
  }
  [].forEach.call($('segPose').children, function (b) { b.addEventListener('click', function () { photoPose(b.dataset.v); }); });
  [].forEach.call($('segCrown').children, function (b) { b.addEventListener('click', function () { setCrown(b.dataset.v === 'on'); }); });
  [].forEach.call($('segFrame').children, function (b) { b.addEventListener('click', function () { PHOTO.frame = b.dataset.v; marks('segFrame', PHOTO.frame); }); });
  $('bShutter').addEventListener('click', shutter);
  $('bPhotoX').addEventListener('click', photoClose);
  $('bPhoto').addEventListener('click', photoOpen);
  $('mPhoto').addEventListener('click', function () { closeModal(); photoOpen(); });
  $('photoAgain').addEventListener('click', closeModal);
  $('photoDone').addEventListener('click', function () { closeModal(); photoClose(); });
  $('photoClose').addEventListener('click', closeModal);
  // saving the picture: inside claude.ai the viewer's own save prompt (the downloads capability); in the offline file, a plain download
  var DL = null;
  try { if (window.claude && window.claude.use) window.claude.use('downloads').then(function (d) { DL = d; }, function () {}); } catch (e) {}
  $('photoSave').addEventListener('click', function () {
    var name = 'philosopher-king-day' + save.day + '-' + Date.now().toString(36) + '.png';
    if (DL) {
      var bin = atob(PHOTO.url.split(',')[1]), buf = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
      DL.save({ filename: name, data: new Blob([buf], { type: 'image/png' }) })
        .then(function () {}, function (e) { if (e && e.code !== 'declined' && e.code !== 'rate_limited') $('photoNote').textContent = 'Saving is not available here. Long-press the picture (phone) or right-click it (computer) to keep it.'; });
      return;
    }
    var a = document.createElement('a'); a.href = PHOTO.url; a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(function () { a.remove(); }, 100);
  });

  // ---------------------------------------------------------------- the cave: five solids on the ledge, a fire, and the shadows on the wall
  var CAVE = world.spots.cave, CV = world.cave, LEDGE = ['icosa', 'octa', 'cube', 'tetra', 'dodeca'], ELEMENT_WORD = { icosa: 'Water.', octa: 'Air.', cube: 'Earth.', tetra: 'Fire.', dodeca: 'And the heavens.' };
  var ledgeProps = {};
  function ledgeX(i) { return CAVE.ledge.x - 1.6 + i * 0.8; }
  function ledgePlace(id) {
    if (ledgeProps[id]) return; var i = LEDGE.indexOf(id), pr = PKWaterFinds.prop(id);
    pr.scale.setScalar(1.6); pr.position.set(ledgeX(i), CAVE.ledge.y - 0.01, CAVE.ledge.z + 0.05); pr.rotation.y = i * 0.7;
    scene.add(pr); ledgeProps[id] = pr;
  }
  function ledgeClear() { Object.keys(ledgeProps).forEach(function (k) { scene.remove(ledgeProps[k]); delete ledgeProps[k]; }); }
  if (save.done) LEDGE.forEach(ledgePlace);
  // the fire in the old ring
  var FIRE = { g: new THREE.Group(), amt: 0, want: 0, flames: [], x: CAVE.fire.x, z: CAVE.fire.z, y: world.height(CAVE.fire.x, CAVE.fire.z) };
  (function () {
    var fm = PKValley.paint('flame', { glow: true, flat: true }), em = PKValley.paint('ember', { glow: true, flat: true });
    [[0, 0, 0.5, 0.15], [0.1, 0.05, 0.36, 0.11], [-0.09, 0.06, 0.32, 0.1], [0.02, -0.1, 0.3, 0.1]].forEach(function (q, i) {
      var c = new THREE.Mesh(new THREE.ConeGeometry(q[3], q[2], 5), fm); c.position.set(q[0], q[2] / 2 + 0.05, q[1]); c.castShadow = false; c.userData.h = q[2]; c.userData.k = i; FIRE.g.add(c); FIRE.flames.push(c);
    });
    for (var k = 0; k < 6; k++) { var e = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.04, 0.07), em); var a = k / 6 * 6.28; e.position.set(Math.cos(a) * 0.18, 0.04, Math.sin(a) * 0.14); e.rotation.y = a; FIRE.g.add(e); }
    FIRE.g.position.set(FIRE.x, FIRE.y, FIRE.z); FIRE.g.visible = false; scene.add(FIRE.g);
    // sparks: little bright flecks that rise off the fire, drift and go out
    FIRE.sparks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.03, 0.03, 0.03), fm, 28); FIRE.sparks.frustumCulled = false; FIRE.sparks.castShadow = false; FIRE.g.add(FIRE.sparks);
    FIRE.sp = []; for (var q = 0; q < 28; q++) FIRE.sp.push({ t: Math.random() * 2, life: 1.2 + Math.random() * 1.4, x: 0, z: 0, vx: 0, vz: 0, vy: 0 });
  })();
  var _so = new THREE.Object3D();
  function sparksUpdate(dt) {
    var n = 0;
    FIRE.sp.forEach(function (s) {
      s.t += dt;
      if (s.t > s.life) { s.t = 0; s.life = 1.0 + Math.random() * 1.6; s.x = (Math.random() - 0.5) * 0.25; s.z = (Math.random() - 0.5) * 0.2; s.vx = (Math.random() - 0.5) * 0.25; s.vz = (Math.random() - 0.5) * 0.2; s.vy = 0.5 + Math.random() * 0.6; }
      if (Math.random() > FIRE.amt) return;
      var u = s.t / s.life;
      _so.position.set(s.x + s.vx * s.t + 0.05 * Math.sin(time * 3 + s.life * 9), 0.25 + s.vy * s.t - 0.1 * s.t * s.t, s.z + s.vz * s.t); _so.scale.setScalar(u < 0.8 ? 1 : 0.5); _so.rotation.set(time * 4, time * 3, 0); _so.updateMatrix();
      FIRE.sparks.setMatrixAt(n++, _so.matrix);
    });
    FIRE.sparks.count = n; FIRE.sparks.instanceMatrix.needsUpdate = true;
  }
  function fireUpdate(dt) {
    FIRE.amt += (FIRE.want - FIRE.amt) * Math.min(1, dt * 1.6);
    FIRE.g.visible = FIRE.amt > 0.02;
    if (!FIRE.g.visible) return;
    sparksUpdate(dt);
    FIRE.flames.forEach(function (c) { var k = c.userData.k, f = FIRE.amt * (0.8 + 0.25 * Math.sin(time * (11 + k * 3) + k) + 0.1 * Math.sin(time * 23 + k * 2)); c.scale.set(0.7 + 0.3 * FIRE.amt, Math.max(0.05, f), 0.7 + 0.3 * FIRE.amt); c.position.y = c.userData.h * f / 2 + 0.05; c.rotation.y = time * 0.7 + k; });
  }
  // the shadows: drawn on a sheet laid on the back wall of the cave
  var SH = { c: document.createElement('canvas'), mesh: null, tex: null, W: 352, H: 200 };
  SH.c.width = SH.W; SH.c.height = SH.H; SH.g = SH.c.getContext('2d', { willReadFrequently: true });
  (function () {
    SH.tex = new THREE.CanvasTexture(SH.c); SH.tex.magFilter = THREE.NearestFilter; SH.tex.minFilter = THREE.NearestFilter; SH.tex.generateMipmaps = false;
    var m = new THREE.MeshBasicMaterial({ map: SH.tex, opacity: 0.5, alphaTest: 0.3, depthWrite: false });
    SH.mesh = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 2.5), m); SH.mesh.name = 'CaveShadows';
    SH.mesh.position.set(CV.cx, CAVE.ledge.y + 0.02 + 1.25, CAVE.wall.z + 0.02); SH.mesh.visible = false; scene.add(SH.mesh);
  })();
  // the king's profile (facing the real king), on a 100-unit grid; the paper crown's five points are where the five shadows end up
  var PROF = [[5, 0], [7, 12], [16, 20], [29, 26], [25, 36], [21, 45], [13, 48], [16, 52], [9, 56], [15, 60], [11, 64], [22, 66], [27, 70], [37, 76], [49, 79], [60, 76], [66, 69], [73, 66], [69, 62], [71, 60], [77, 53], [78, 50], [71, 48], [72, 45], [69, 43], [72, 39], [71, 32], [66, 26], [59, 24], [63, 19], [74, 12], [86, 4], [88, 0]];
  var CROWN = { x0: 23, x1: 67, b0: 64, b1: 71, t0: 77, t1: 84, h: 11 };
  function crownTop(x) { return CROWN.t0 + (CROWN.t1 - CROWN.t0) * (x - CROWN.x0) / (CROWN.x1 - CROWN.x0); }
  function crownBot(x) { return CROWN.b0 + (CROWN.b1 - CROWN.b0) * (x - CROWN.x0) / (CROWN.x1 - CROWN.x0); }
  var SIDES = { icosa: [6, Math.PI / 6], octa: [4, 0], cube: [4, Math.PI / 4], tetra: [3, Math.PI / 2], dodeca: [10, 0] };
  function drawShadows(s) {
    var g = SH.g, W = SH.W, H = SH.H; g.clearRect(0, 0, W, H);
    var fl = Math.sin(time * 13) * 1.2 + Math.sin(time * 29) * 0.6, sc = 1.76 * (1 + 0.012 * Math.sin(time * 17));
    var ox = W / 2 - 47 * sc + fl, by = H - 3;
    function gx(x) { return ox + x * sc; } function gy(y) { return by - y * sc; }
    g.fillStyle = '#16120f';
    var rise = Math.max(0, Math.min(1, s / 2.5)), conv = Math.max(0, Math.min(1, (s - 2.5) / 4)), ce = conv * conv * (3 - 2 * conv);
    // the head and shoulders, growing out of the dark as the shapes come together
    if (ce > 0) {
      g.save(); g.translate(W / 2 + fl, by); g.scale(ce, ce); g.translate(-(W / 2 + fl), -by);
      g.beginPath(); PROF.forEach(function (p, i) { g[i ? 'lineTo' : 'moveTo'](gx(p[0]), gy(p[1])); }); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(gx(CROWN.x0), gy(crownBot(CROWN.x0))); g.lineTo(gx(CROWN.x1), gy(crownBot(CROWN.x1))); g.lineTo(gx(CROWN.x1), gy(crownTop(CROWN.x1))); g.lineTo(gx(CROWN.x0), gy(crownTop(CROWN.x0))); g.closePath(); g.fill();
      g.restore();
    }
    // the five solids: their shadows rise off the ledge, then fly to the five points of the crown
    LEDGE.forEach(function (id, i) {
      var sx = (ledgeX(i) - (CV.cx - 2.2)) / 4.4 * W, sy = H - (0.06 + 0.32 * rise + 0.04 * Math.sin(i * 1.9)) * H, r0 = 5 + 17 * rise;
      var bw = (CROWN.x1 - CROWN.x0) / 5, mx = CROWN.x0 + bw * (i + 0.5), tx = gx(mx), ty = gy(crownTop(mx) + CROWN.h * 0.45);
      var x = sx + (tx - sx) * ce, y = sy + (ty - sy) * ce + Math.sin(time * 2 + i) * 2 * (1 - ce), r = r0 + (bw * sc * 0.5 - r0) * ce;
      if (ce >= 1) { g.beginPath(); g.moveTo(gx(mx - bw / 2), gy(crownTop(mx - bw / 2)) + 1); g.lineTo(gx(mx), gy(crownTop(mx) + CROWN.h)); g.lineTo(gx(mx + bw / 2), gy(crownTop(mx + bw / 2)) + 1); g.closePath(); g.fill(); return; }
      if (rise <= 0) return;
      var sd = SIDES[id], rot = sd[1] + (1 - ce) * Math.sin(time * 0.8 + i) * 0.3 + ce * (Math.PI / 2 - sd[1]) * (sd[0] === 3 ? 1 : 0);
      g.beginPath(); for (var k = 0; k < sd[0]; k++) { var a = rot + k * 2 * Math.PI / sd[0]; g[k ? 'lineTo' : 'moveTo'](x + Math.cos(a) * r, y - Math.sin(a) * r); } g.closePath(); g.fill();
    });
    // hard edges, the way a shadow on rough rock reads in pixels (no soft canvas edges)
    var id = g.getImageData(0, 0, W, H), d = id.data; for (var q = 3; q < d.length; q += 4) d[q] = d[q] > 110 ? 255 : 0; g.putImageData(id, 0, 0);
    SH.tex.needsUpdate = true;
  }

  // ---------------------------------------------------------------- the ending: the solids set out, the light goes, the shadows, the turn toward the light, the morning
  var ENDING = { on: false, t: 0, from: 0, said: {} };
  var CINE = { aim: new THREE.Vector3(), follow: false, az: 0, el: 0.24, zoom: 0.6, cut: null, cutR: 0 };
  var EP = { ledge: { x: CV.cx, z: CAVE.ledge.z + 0.75 }, watch: { x: CV.cx + 1.8, z: CAVE.ledge.z + 1.75 }, mouth: { x: CV.cx + 0.6, z: CV.z1 + 0.2 }, out: { x: CV.cx + 2.2, z: CV.z1 + 6.5 } };
  function inCave() { return P.x > CV.x0 - 0.4 && P.x < CV.x1 + 0.4 && P.z > CV.z0 && P.z < CV.z1 + 1.8; }
  function caveReady() { return SOLIDS.every(have); }
  function cineText(t, by) { var c = $('cineText'); if (!t) { c.classList.remove('on'); return; } $('cineLine').textContent = t; $('cineBy').textContent = by || ''; c.classList.remove('on'); void c.offsetWidth; c.classList.add('on'); }
  function startEnding() {
    if (ENDING.on || !caveReady()) return;
    ENDING.on = true; ENDING.paged = false; ENDING.t = 0; ENDING.said = {}; ENDING.from = SKY.hour; ENDING.walk = { x: P.x, z: P.z };
    ENDING.goal = isNight() ? SKY.hour : Math.max(21.9, SKY.hour); ENDING.night = ENDING.goal; ENDING.dawn = ENDING.goal >= 12 ? 30.4 : 6.4;
    ledgeClear(); P.lock = 'cine'; P.target = null; P.speed = 0; stopMoving(); hush();
    document.body.classList.add('cine'); $('bSkip').hidden = false;
    $('caption').classList.remove('on'); capT = 0; $('toast').classList.remove('on'); toastT = 0; toastQ.length = 0; $('ponder').classList.remove('on'); PON.card = 0;
    view.close = null; markClose();
    var a = view.w / view.h, hv = Math.max(4.3, 4.9 / a);
    CINE.follow = false; CINE.az = 0; CINE.el = 0.24; CINE.zoom = hv / view.base; CINE.aim.set(CV.cx + 0.3, CAVE.ledge.y + 1.1, CAVE.ledge.z + 0.9);
    CINE.cut = new THREE.Vector3(CV.cx, CAVE.ledge.y + 1.2, CAVE.wall.z + 0.1); CINE.cutR = 3.2;
    view.azGoal = view.az + Math.atan2(Math.sin(0 - view.az), Math.cos(0 - view.az));
  }
  function walkStep(from, to, u, dur) {
    var e = Math.max(0, Math.min(1, u)); P.x = from.x + (to.x - from.x) * e; P.z = from.z + (to.z - from.z) * e;
    if (e < 1) { P.yaw = Math.atan2(to.x - from.x, to.z - from.z); setAnim('walk', 0.2); king.actions.walk.timeScale = Math.max(0.6, Math.hypot(to.x - from.x, to.z - from.z) / Math.max(0.3, dur) / WALK_CLIP); }
    return e >= 1;
  }
  function endingUpdate(dt) {
    var t = ENDING.t += dt, once = function (k) { if (ENDING.said[k]) return false; ENDING.said[k] = true; return true; };
    view.azGoal = view.az + Math.atan2(Math.sin(CINE.az - view.az), Math.cos(CINE.az - view.az)); view.elGoal = CINE.el; view.zoomGoal = CINE.zoom;
    if (ENDING.paged) return;
    // 0 - 1.4: to the ledge
    if (t < 1.4) { walkStep(ENDING.walk, EP.ledge, t / 1.3, 1.3); if (t >= 1.3) { P.yaw = Math.PI; setAnim('idle', 0.25); } }
    // 1.4 - 7: the five solids set out one by one, from his satchel to the ledge
    else if (t < 7.0) {
      P.x = EP.ledge.x; P.z = EP.ledge.z; P.yaw = Math.PI;
      var i = Math.floor((t - 1.4) / 1.1), u = (t - 1.4) / 1.1 - i;
      if (i < 5) {
        var id = LEDGE[i];
        if (u < 0.55) { if (once('hold' + i)) { king.setItem(id); P.anim = ''; setAnim('hold-item', 0.15); } }
        else if (once('set' + i)) { king.setItem(null); ledgePlace(id); tone([523, 587, 659, 784, 988][i], 0, 1.2, 0.07, 'triangle'); tone([1047, 1175, 1319, 1568, 1976][i], 0.05, 1.4, 0.03); cineText(ELEMENT_WORD[id]); }
      }
    }
    // 7 - 8.2: he steps back; the light goes
    else if (t < 8.4) { if (once('back')) { cineText(''); } if (walkStep(EP.ledge, EP.watch, (t - 7) / 1.1, 1.1)) { P.yaw = Math.PI - 0.15; setAnim('idle', 0.3); } }
    else { if (t < 20.2) { P.x = EP.watch.x; P.z = EP.watch.z; } }
    if (t >= 7 && t < 9.6) { var dk = Math.min(1, (t - 7) / 2.4), dk2 = dk * dk * (3 - 2 * dk); SKY.hour = ENDING.from + (ENDING.goal - ENDING.from) * dk2; }
    if (t >= 8.4 && once('fire')) { FIRE.want = 1; noise(1.2, 900, 0.12); }
    // 9 - 20: the shadow theatre
    if (t >= 9 && t < 26) { SH.mesh.visible = FIRE.amt > 0.3; if (SH.mesh.visible) drawShadows(t - 9); }
    if (t >= 9 && once('sh')) { SH.mesh.visible = true; }
    if (t >= 15.6 && once('cave')) { cineText(PKWaterFinds.CAVE_LINE.line, PKWaterFinds.CAVE_LINE.by); autoSay(PKWaterFinds.CAVE_LINE.line, rec('ending-cave')); }
    // 20.2 - 21.4: he turns round, toward the light
    if (t >= 20.2 && t < 21.4) { var tu = (t - 20.2) / 1.2; P.yaw = Math.PI - 0.15 + (Math.PI + 0.15) * tu * tu * (3 - 2 * tu); if (once('turn')) cineText(''); }
    // 21.4 - 28: out of the cave into the morning; the camera follows him, the fire goes down, the night runs out
    if (t >= 21.4) {
      if (once('out')) { CINE.follow = true; CINE.cut = null; CINE.az = 0; CINE.el = 0.42; CINE.zoom = 0.95; FIRE.want = 0.12; ENDING.night = SKY.hour; }
      if (t < 24.4) walkStep(EP.watch, EP.mouth, (t - 21.4) / 3.0, 3.0);
      else if (t < 28.4) { if (walkStep(EP.mouth, EP.out, (t - 24.4) / 4.0, 4.0)) {} }
      else { P.x = EP.out.x; P.z = EP.out.z; if (once('stop')) { P.yaw = DAWN.yaw; setAnim('idle', 0.4); } }
      // the camera comes down low and round behind him, so he stands against the sunrise
      if (t >= 23.6) { var cu = Math.min(1, (t - 23.6) / 5.5); cu = cu * cu * (3 - 2 * cu); CINE.az = DAWN.az * cu; CINE.el = 0.42 + (DAWN.el - 0.42) * cu; CINE.zoom = 0.95 + (1.15 - 0.95) * cu; CINE.lift = 1.2 * cu; LOOK.sunNear = cu; view.front = 13 * cu; LOOK.skyCut = cu > 0.05 ? 18 + 120 * (1 - cu) : 0; }
      var dn = Math.min(1, (t - 21.4) / 6.5); SKY.hour = ENDING.night + (ENDING.dawn - ENDING.night) * dn * dn * (3 - 2 * dn);
      if (t >= 25.2 && FIRE.amt < 0.32) SH.mesh.visible = false;
    }
    if (t >= 26.6 && once('dawn')) { cineText(PKWaterFinds.DAWN_LINE.line, PKWaterFinds.DAWN_LINE.by); autoSay(PKWaterFinds.DAWN_LINE.line, rec('ending-dawn')); }
    // the teal come over, low and quick, against the sunrise, and turn; the poem, a stanza at a time; on the last, a small wave
    if (t >= 32.6 && once('teal')) { life.flyOver(tealPath(), 22); ENDING.st = { i: -1, t: 0, min: 0 }; }
    if (ENDING.st) {
      var S = ENDING.st; S.t += dt;
      if (S.i < 0 || (S.t > S.min && (!speechBusy() || S.t > S.min + 16))) {
        S.i++; S.t = 0;
        if (S.i < TEALS.length) { cineText(TEALS[S.i], PKWaterFinds.TEAL.title + ' \u00b7 by ' + PKWaterFinds.TEAL.by); autoSay(TEALS[S.i].replace(/\n/g, ' '), rec('ending-teal-' + (S.i + 1))); S.min = Math.max(7, TEALS[S.i].split(/\s+/).length / 3.0 + 2); if (S.i === TEALS.length - 1) ENDING.waveAt = t + 3.2; }
        else { ENDING.st = null; ENDING.pageAt = t + 2.2; cineText(''); }
      }
    }
    if (ENDING.waveAt && t >= ENDING.waveAt) { ENDING.waveAt = 0; P.anim = ''; setAnim('wave', 0.35); }
    if (ENDING.pageAt && t >= ENDING.pageAt && once('page')) { ENDING.pageAt = 0; endingPage(); }
  }
  // the dawn: the sun comes up a little south of east; he faces it, and the camera stands behind him
  var DAWN = (function () { var f = (6.4 - 5.6) / 14.6, a = Math.PI / 2 - Math.PI * f; return { yaw: a, el: 0.2, az: Math.atan2(Math.sin(a + Math.PI - 0.15), Math.cos(a + Math.PI - 0.15)), dx: Math.sin(a), dz: Math.cos(a) }; })();
  var TEALS = (function () { var out = [], cur = []; PKWaterFinds.TEAL.lines.forEach(function (l) { if (l) cur.push(l); else if (cur.length) { out.push(cur.join('\n')); cur = []; } }); if (cur.length) out.push(cur.join('\n')); return out; })();
  // the flock's path, in front of him towards the sun: in from the right, across, a banked turn, and away up into the light
  function tealPath() {
    var d = [DAWN.dx, DAWN.dz], r = [-DAWN.dz, DAWN.dx], B = [P.x + d[0] * 6, P.y, P.z + d[1] * 6];
    function at(rr, up, fw) { return [B[0] + r[0] * rr + d[0] * fw, B[1] + up, B[2] + r[1] * rr + d[1] * fw]; }
    return [at(14, 3.6, -8), at(6, 3.2, -9), at(-1, 3.0, -10), at(-7.5, 3.4, -9), at(-5, 4.0, -7), at(1.5, 4.5, -8), at(9, 5.0, -9), at(16, 5.6, -10)];
  }
  function finishEnding(skipped) {
    if (skipped) {
      LEDGE.forEach(ledgePlace); FIRE.want = 0.12; SH.mesh.visible = false; P.x = EP.out.x; P.z = EP.out.z; P.yaw = 0.2; P.anim = ''; setAnim('idle', 0.2);
      SKY.hour = ENDING.dawn; CINE.follow = true; CINE.cut = null; CINE.az = DAWN.az; CINE.el = DAWN.el; CINE.zoom = 1.15; CINE.lift = 1.2; P.yaw = DAWN.yaw; ENDING.st = null; LOOK.sunNear = 1; view.front = 13; LOOK.skyCut = 18;
    }
    while (SKY.hour >= 24) { SKY.hour -= 24; save.day++; }
    save.hour = SKY.hour; save.done = true; persist();
    cineText(''); $('bSkip').hidden = true;
  }
  function endingPage() {
    if (!ENDING.on || ENDING.paged) return; ENDING.paged = true;
    finishEnding(false);
    var pm = PKWaterFinds.ENDING; currentPoem = pm;
    $('ePage').innerHTML = ''; fillPoem($('ePage'), pm); $('eTitle').textContent = pm.title || 'The last page'; $('eBy').textContent = byLine(pm);
    openModal('endVeil'); SFX.page(); autoSay(poemText(pm), poemRec(pm));
  }
  // 'by Horace · translated by John Conington'; under the poem, where it comes from (pm.src) and, if there is one, a line about it (pm.note)
  function byLine(pm) { return (pm.anon ? 'from ' : 'by ') + pm.by + (pm.tr ? ' \u00b7 translated by ' + pm.tr : ''); }
  function fillPoem(page, pm) {
    if (pm.note) { var nt = document.createElement('p'); nt.className = 'pnote'; nt.textContent = pm.note; page.appendChild(nt); }
    if (pm.lines.length) {
      pm.lines.forEach(function (t) { var p = document.createElement('p'); p.className = t ? 'ln' : 'ln gap'; p.textContent = t || ' '; page.appendChild(p); });
      if (pm.src) { var sc = document.createElement('p'); sc.className = 'kept src'; sc.textContent = pm.src; page.appendChild(sc); }
    }
    else {
      for (var i = 0; i < 10; i++) { var r = document.createElement('p'); r.className = 'ln rule'; r.setAttribute('aria-hidden', 'true'); r.textContent = ' '; page.appendChild(r); }
      var k = document.createElement('p'); k.className = 'kept'; k.textContent = 'This page is kept for a poem by ' + pm.by + '.'; page.appendChild(k);
    }
  }
  function credits() {
    var box = $('creditList'); box.innerHTML = '';
    PKWaterFinds.CREDITS.forEach(function (c, i) {
      var d = document.createElement('div'); d.className = 'cr' + (i === 0 ? ' title' : ''); d.style.animationDelay = (0.25 + i * 0.55) + 's';
      d.innerHTML = (c[0] ? '<span>' + esc(c[0]) + '</span>' : '') + '<b>' + esc(c[1]) + '</b>'; box.appendChild(d);
    });
    openModal('creditsVeil');
  }
  function endEnding() {
    ENDING.on = false; ENDING.paged = false; document.body.classList.remove('cine'); $('bSkip').hidden = true; LOOK.sunNear = 0; LOOK.skyCut = 0; view.front = 0; CINE.lift = 0;
    if (P.lock === 'cine') P.lock = null; P.anim = ''; setAnim('idle', 0.3); king.setItem(carryItem());
    view.elGoal = EL0; view.zoomGoal = 1; cineText('');
    setTimeout(function () { toast('The five solids stay on the ledge. The creek, as usual, has more to bring.', 5); }, 600);
  }
  $('bSkip').addEventListener('click', function () { if (!ENDING.on) return; finishEnding(true); endingPage(); });
  $('eSay').addEventListener('click', function () { var pm = PKWaterFinds.ENDING; say(poemText(pm), poemRec(pm)); });
  $('eNext').addEventListener('click', function () { hush(); credits(); });
  $('creditsDone').addEventListener('click', function () { closeModal(); endEnding(); if (WATCH.on) watchStop(); });
  $('creditsVeil').addEventListener('click', function (e) { if (e.target === $('creditsVeil')) { closeModal(); endEnding(); } });

  // ================================================================ Easy to see: beams over everything worth walking to, a pale disc of light under him, big type
  var EZ = { disc: null, poem: {}, cave: null, studio: null };
  (function () {
    var dm = new THREE.MeshBasicMaterial({ color: '#fff2c8', opacity: 0.25, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -40 });   // opacity 0.25 = shines: no ink, not darkened
    // a disc that lies on the ground: rings of points whose heights follow the slope each frame
    var NR = 6, NS = 28, pos = [], idx = [];
    pos.push(0, 0, 0); for (var r = 1; r <= NR; r++) for (var a = 0; a < NS; a++) { var ang = a / NS * Math.PI * 2, rr = 0.8 * r / NR; pos.push(Math.cos(ang) * rr, 0, Math.sin(ang) * rr); }
    for (var a2 = 0; a2 < NS; a2++) idx.push(0, 1 + (a2 + 1) % NS, 1 + a2);
    for (var r2 = 1; r2 < NR; r2++) for (var a3 = 0; a3 < NS; a3++) { var i0 = 1 + (r2 - 1) * NS + a3, i1 = 1 + (r2 - 1) * NS + (a3 + 1) % NS, j0 = i0 + NS, j1 = i1 + NS; idx.push(i0, i1, j1, i0, j1, j0); }
    var dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); dg.setIndex(idx);
    EZ.disc = new THREE.Mesh(dg, dm); EZ.disc.frustumCulled = false; EZ.disc.name = 'EasyDisc'; EZ.disc.visible = false; EZ.disc.renderOrder = 1; scene.add(EZ.disc);
    function marker(x, y, z) { var g = new THREE.Group(); g.position.set(x, y, z); var b = new THREE.Mesh(beamGeo, beamMat); b.castShadow = false; g.add(b); g.visible = false; scene.add(g); return g; }
    POEMS.forEach(function (pm) { var o = poemObj[pm.id], y = world.spots.poems[pm.id].y != null ? world.spots.poems[pm.id].y : world.height(o.x, o.z); EZ.poem[pm.id] = marker(o.x, y, o.z); });
    EZ.cave = marker(CV.cx, CAVE.y, CV.z1 + 0.3);
    var st = world.spots.studio; EZ.studio = marker(st.x, world.height(st.x, st.z), st.z);
  })();
  function easyBeam(b, i, hgt, wide) { var w = wide * (1 + 0.18 * Math.sin(time * 3 + i)); b.scale.set(w, hgt, w); b.position.y = hgt / 2 + 0.3; }
  function easyUpdate() {
    var on = EASY.on && !ENDING.on && !PHOTO.on;
    EZ.disc.visible = false; var gh = EASY.on && !PHOTO.on; if (king.halo.length && king.halo[0].visible !== gh) showHalo(gh);
    if (false) {
      EZ.disc.position.set(P.x, 0, P.z); var pa = EZ.disc.geometry.attributes.position, arr = pa.array;
      for (var q = 0; q < pa.count; q++) { var x = P.x + arr[q * 3], z = P.z + arr[q * 3 + 2], wl = world.water(x, z), gy = world.height(x, z, P.y + 0.3); arr[q * 3 + 1] = Math.max(gy, wl != null ? wl : -99) + 0.04; }
      pa.needsUpdate = true;
    }
    ITEMS.forEach(function (f, i) { var o = findObj[f.id]; if (!on) { if (o.beam && PON.t <= 0) o.beam.visible = false; return; } var b = beam(o); b.visible = o.g.visible && Math.hypot(o.x - P.x, o.z - P.z) > 1.8; if (b.visible) easyBeam(b, i, f.coll === 'solids' ? 6 : 4.2, f.coll === 'solids' ? 5 : 4); });
    POEMS.forEach(function (pm, i) { var g = EZ.poem[pm.id], po = poemObj[pm.id]; g.visible = on && Math.hypot(po.x - P.x, po.z - P.z) > 1.8; if (g.visible) easyBeam(g.children[0], i + 3, 5, save.read[pm.id] ? 2.5 : 4.5); });
    EZ.cave.visible = on && caveReady(); if (EZ.cave.visible) easyBeam(EZ.cave.children[0], 9, 7, 6);
    EZ.studio.visible = on && counts().bag > 0; if (EZ.studio.visible) easyBeam(EZ.studio.children[0], 11, 5, 4.5);
  }
  // Easy to see: the camera comes round by itself, slowly, so that he is seen from the side as he walks (his profile, crown and
  // nose read best) and from the front three-quarters when he stands, reads or rests (his face). Not while someone is steering.
  EASY.manual = -99; EASY.still = 0;
  function easyCam(dt) {
    if (!EASY.on || PHOTO.on || ENDING.on || view.close || modal && !P.lock) return;
    if (time - EASY.manual < 2.5) return;
    EASY.still = P.speed < 0.12 ? EASY.still + dt : 0;
    var want;
    if (P.speed > 0.2) { var a1 = P.yaw + Math.PI / 2 - 0.3, a2 = P.yaw - Math.PI / 2 + 0.3; want = Math.abs(Math.atan2(Math.sin(a1 - view.azGoal), Math.cos(a1 - view.azGoal))) < Math.abs(Math.atan2(Math.sin(a2 - view.azGoal), Math.cos(a2 - view.azGoal))) ? a1 : a2; }
    else if (EASY.still > 1.2 || P.lock) { var b1 = P.yaw + 0.55, b2 = P.yaw - 0.55; want = Math.abs(Math.atan2(Math.sin(b1 - view.azGoal), Math.cos(b1 - view.azGoal))) < Math.abs(Math.atan2(Math.sin(b2 - view.azGoal), Math.cos(b2 - view.azGoal))) ? b1 : b2; }
    else return;
    var d = Math.atan2(Math.sin(want - view.azGoal), Math.cos(want - view.azGoal));
    view.azGoal += d * Math.min(1, dt * 0.9);
  }
  function easyZoom() { var ez = Math.max(1, Math.min(2.4, Math.min(window.innerWidth / 800, window.innerHeight / 520))); document.documentElement.style.setProperty('--ez', ez.toFixed(2)); }
  function setEasy(on) {
    EASY.on = !!on; save.see = EASY.on; persist();
    document.body.classList.toggle('easy', EASY.on);
    world.setPlants(!EASY.on);
    var cd = QUAL[save.quality].creek; setCreekDetail(EASY.on ? Math.min(cd, 2) : cd);
    px.setThick(EASY.on);
    EL0 = EASY.on ? EL_EASY : EL_NORMAL; view.elGoal = EL0; view.zoomGoal = 1; view.close = null; markClose();
    resize(); easyZoom(); world.ensure(P.x, P.z);
    if (EASY.on && !save.voiceSet) setVoice(true);
    marks('segEasy', EASY.on ? 'on' : 'off'); $('bEasy').setAttribute('aria-pressed', EASY.on ? 'true' : 'false'); $('bEasy').textContent = EASY.on ? 'Easy to see: on' : 'Easy to see: off';
  }
  [].forEach.call($('segEasy').children, function (b) { b.addEventListener('click', function () { setEasy(b.dataset.v === 'on'); }); });
  $('bEasy').addEventListener('click', function () { setEasy(!EASY.on); if (EASY.on) say('Easy to see is on. Everything is bigger, and I will read things out.'); });
  window.addEventListener('resize', easyZoom);

  // ================================================================ the guide: one button walks him to the next thing, along the trails
  // A path graph from the trail samples (about every 1.5 m), joined where trails meet and across the stepping stones, log and bridge.
  var NAV = null;
  function buildNav() {
    var nodes = [], H = {}, C = 3;
    function key(x, z) { return Math.floor(x / C) + ',' + Math.floor(z / C); }
    function add(x, z, tr) { var i = nodes.length; nodes.push({ x: x, z: z, tr: tr, adj: [] }); var k = key(x, z); (H[k] || (H[k] = [])).push(i); return i; }
    function link(a, b, chk) { if (a === b) return; var d = Math.hypot(nodes[a].x - nodes[b].x, nodes[a].z - nodes[b].z); nodes[a].adj.push([b, d, chk]); nodes[b].adj.push([a, d, chk]); }
    function linkC(a, b) { link(a, b, true); }
    world.trails.forEach(function (t, ti) {
      var prev = -1, lx = 1e9, lz = 1e9;
      for (var k = 0; k < t.n; k++) { var x = t.X[k], z = t.Z[k]; if (k < t.n - 1 && Math.hypot(x - lx, z - lz) < 1.5) continue; var i = add(x, z, ti); if (prev >= 0) link(prev, i); prev = i; lx = x; lz = z; }
    });
    function near(x, z, r, fn) { var out = []; for (var gx = Math.floor((x - r) / C); gx <= Math.floor((x + r) / C); gx++) for (var gz = Math.floor((z - r) / C); gz <= Math.floor((z + r) / C); gz++) { var l = H[gx + ',' + gz]; if (l) l.forEach(function (i) { var d = Math.hypot(nodes[i].x - x, nodes[i].z - z); if (d <= r && (!fn || fn(i))) out.push([i, d]); }); } return out.sort(function (a, b) { return a[1] - b[1]; }); }
    var n0 = nodes.length;
    for (var i = 0; i < n0; i++) near(nodes[i].x, nodes[i].z, 2.4, function (j) { return j > i && nodes[j].tr !== nodes[i].tr; }).forEach(function (q) { link(i, q[0]); });
    // the creek beds: he can wade along them where the water lets him (each step is checked when a route is planned)
    world.channels.forEach(function (c, ci) {
      var prev = -1, lx = 1e9, lz = 1e9;
      for (var k = 0; k < c.n; k++) { var x = c.X[k], z = c.Z[k]; if (k < c.n - 1 && Math.hypot(x - lx, z - lz) < 2) continue; var i = add(x, z, -10 - ci); if (prev >= 0) linkC(prev, i); prev = i; lx = x; lz = z; }
    });
    var nb = nodes.length;
    for (var i2 = n0; i2 < nb; i2++) near(nodes[i2].x, nodes[i2].z, 6, function (j) { return nodes[j].tr >= 0; }).slice(0, 3).forEach(function (q) { linkC(i2, q[0]); });
    world.crossings.forEach(function (c) {
      var A = c.a || c.A, B = c.b || c.B; if (!A || !B) return;
      var a = add(A[0], A[1], -1), b = add(B[0], B[1], -1); linkC(a, b);
      [a, b].forEach(function (e) { near(nodes[e].x, nodes[e].z, 5, function (j) { return nodes[j].tr >= 0; }).slice(0, 2).forEach(function (q) { linkC(e, q[0]); }); });
    });
    NAV = { nodes: nodes, near: near };
  }
  // can he walk straight from one point to another? (the same rules as his feet: steep banks, drops, deep and fast water)
  function lineOK(x0, z0, x1, z1) {
    var L = Math.hypot(x1 - x0, z1 - z0), n = Math.max(1, Math.ceil(L / 0.2)), y = world.height(x0, z0, 99), px0 = x0, pz0 = z0, wd = world.wading(x0, z0, y);
    for (var k = 1; k <= n; k++) {
      var x = x0 + (x1 - x0) * k / n, z = z0 + (z1 - z0) * k / n;
      if (blocked(px0, pz0, x, z, y, wd, true)) return false;
      var cp = { x: x, z: z }; world.collide(cp, 0.22); if (Math.hypot(cp.x - x, cp.z - z) > 0.08) return false;
      var y2 = world.height(x, z, y + 0.45), dy = Math.abs(y2 - y), plat = world.onPlatform(px0, pz0, y + 0.2) || world.onPlatform(x, z, y2 + 0.2);
      if (dy > 0.2 && dy / (L / n) > 1.15 && !plat) return false;   // steeper than he should be walked, up or down (a margin under his limit)
      y = y2; wd = world.wading(x, z, y); px0 = x; pz0 = z;
    }
    return true;
  }
  function astar(s, g) {
    var N = NAV.nodes, open = [s], came = {}, gs = {}, fs = {}, closed = {};
    gs[s] = 0; fs[s] = Math.hypot(N[s].x - N[g].x, N[s].z - N[g].z);
    while (open.length) {
      var bi = 0; for (var q = 1; q < open.length; q++) if (fs[open[q]] < fs[open[bi]]) bi = q;
      var c = open.splice(bi, 1)[0]; if (c === g) { var path = [c]; while (came[c] != null) { c = came[c]; path.unshift(c); } return path; }
      closed[c] = 1;
      N[c].adj.forEach(function (e) {
        var j = e[0]; if (closed[j]) return;
        if (e[2]) { var ek = c < j ? c + '-' + j : j + '-' + c; if (EDGE_OK[ek] == null) EDGE_OK[ek] = lineOK(N[c].x, N[c].z, N[j].x, N[j].z) && lineOK(N[j].x, N[j].z, N[c].x, N[c].z); if (!EDGE_OK[ek]) return; }
        var t = gs[c] + e[1];
        if (gs[j] == null || t < gs[j]) { came[j] = c; gs[j] = t; fs[j] = t + Math.hypot(N[j].x - N[g].x, N[j].z - N[g].z); if (open.indexOf(j) < 0) open.push(j); }
      });
    }
    return null;
  }
  // the way from where he stands to (x, z): straight if he can, else to the trail, along it, and off it again
  // a fine search near the ends of a trip: a grid of half-metre cells round both points, stepping round bushes, trunks, steep banks and deep water
  function gridPath(x0, z0, x1, z1, margin) {
    var C = 0.5, m = margin || 6, gx0 = Math.min(x0, x1) - m, gz0 = Math.min(z0, z1) - m, nx = Math.ceil((Math.abs(x1 - x0) + 2 * m) / C) + 1, nz = Math.ceil((Math.abs(z1 - z0) + 2 * m) / C) + 1;
    if (nx * nz > 26000) return null;
    var N = nx * nz, H = new Float32Array(N).fill(NaN), OK = new Int8Array(N), G = new Float32Array(N).fill(1e9), F = new Float32Array(N), from = new Int32Array(N).fill(-1), shut = new Uint8Array(N);
    var deepLim = save.tools.waders ? 0.98 : 0.62, fastLim = save.tools.stick ? 0.42 : 0.16, sW = world.wading(x0, z0, world.height(x0, z0, 99)) + 0.01;   // water no deeper than where he stands is always all right (getting out)
    function cx(i) { return gx0 + (i % nx) * C; } function cz(i) { return gz0 + Math.floor(i / nx) * C; }
    function cell(i) {
      if (OK[i]) return OK[i] > 0; var x = cx(i), z = cz(i), h = world.height(x, z, 99); H[i] = h;
      var wd = world.wading(x, z, h), cp = { x: x, z: z }; world.collide(cp, 0.22);
      var good = !(wd > deepLim && wd > sW) && !(wd > fastLim && wd > sW && world.fast(x, z)) && Math.hypot(cp.x - x, cp.z - z) < 0.08;
      OK[i] = good ? 1 : -1; return good;
    }
    function idx(x, z) { return Math.round((z - gz0) / C) * nx + Math.round((x - gx0) / C); }
    var s = idx(x0, z0), g = idx(x1, z1); if (s < 0 || s >= N || g < 0 || g >= N) return null;
    // the heap of open cells, by F
    var heap = [s]; G[s] = 0; F[s] = Math.hypot(x1 - x0, z1 - z0); OK[s] = 1; H[s] = world.height(x0, z0, 99);
    function push(i) { heap.push(i); var k = heap.length - 1; while (k > 0) { var p2 = (k - 1) >> 1; if (F[heap[p2]] <= F[heap[k]]) break; var t = heap[p2]; heap[p2] = heap[k]; heap[k] = t; k = p2; } }
    function pop() { var top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; var k = 0; for (;;) { var l = 2 * k + 1, r = l + 1, mn = k; if (l < heap.length && F[heap[l]] < F[heap[mn]]) mn = l; if (r < heap.length && F[heap[r]] < F[heap[mn]]) mn = r; if (mn === k) break; var t = heap[mn]; heap[mn] = heap[k]; heap[k] = t; k = mn; } } return top; }
    var D8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]], found = false, guard = 0;
    while (heap.length && guard++ < 40000) {
      var c = pop(); if (shut[c]) continue; shut[c] = 1; if (c === g) { found = true; break; }
      var ci = c % nx, cj = Math.floor(c / nx);
      for (var q = 0; q < 8; q++) {
        var ni = ci + D8[q][0], nj = cj + D8[q][1]; if (ni < 0 || nj < 0 || ni >= nx || nj >= nz) continue;
        var n = nj * nx + ni; if (shut[n] || !cell(n)) continue;
        var dist = q < 4 ? C : C * 1.4142, dh = H[n] - H[c];
        if (Math.abs(dh) > 0.3 && Math.abs(dh) / dist > 1.15) continue;   // too steep, up or down (a margin under his limit)
        var t = G[c] + dist + Math.abs(dh) * 0.5; if (t < G[n]) { G[n] = t; F[n] = t + Math.hypot(cx(n) - x1, cz(n) - z1); from[n] = c; push(n); }
      }
    }
    if (!found) return null;
    var path = [], k2 = g; while (k2 >= 0 && k2 !== s) { path.unshift({ x: cx(k2), z: cz(k2) }); k2 = from[k2]; }
    path[path.length - 1] = { x: x1, z: z1 };
    return path;
  }
  var EDGE_OK = {};
  function planRoute(x, z) {
    if (!NAV) buildNav(); EDGE_OK = {};
    // the spot to walk to: the thing itself, or the nearest place beside it he can stand (a find on a truck bed, in a deep pool, on a ledge)
    var spots = [[x, z]]; [0.5, 0.8, 1.1].forEach(function (r) { for (var a = 0; a < 12; a++) spots.push([x + Math.cos(a / 12 * 6.283) * r, z + Math.sin(a / 12 * 6.283) * r]); });
    var route = null, d0 = Math.hypot(x - P.x, z - P.z);
    for (var q0 = 0; q0 < spots.length && !route; q0++) if (lineOK(P.x, P.z, spots[q0][0], spots[q0][1])) route = [{ x: spots[q0][0], z: spots[q0][1] }];
    if (!route && d0 < 40) for (var q1 = 0; q1 < 13 && !route; q1++) route = gridPath(P.x, P.z, spots[q1][0], spots[q1][1], 8);
    if (!route) {
      // far: a short search to the trails, along them, and a short search off them at the other end
      var N = NAV.nodes, sc = NAV.near(P.x, P.z, 40), gc = NAV.near(x, z, 40), head = null, tail = null, sn = -1, gn = -1;
      if (GUIDE.left != null && N[GUIDE.left]) sc.unshift([GUIDE.left, 0]);
      for (var a1 = 0; a1 < sc.length && a1 < 6 && !head; a1++) { var n1 = N[sc[a1][0]]; if (n1.tr < 0 && n1.tr !== -1) continue; head = lineOK(P.x, P.z, n1.x, n1.z) ? [{ x: n1.x, z: n1.z }] : gridPath(P.x, P.z, n1.x, n1.z, 6); if (head) sn = sc[a1][0]; }
      for (var b1 = 0; b1 < gc.length && b1 < 6 && !tail; b1++) { var n2 = N[gc[b1][0]]; if (n2.tr < 0 && n2.tr !== -1) continue; for (var q2 = 0; q2 < 13 && !tail; q2++) tail = lineOK(n2.x, n2.z, spots[q2][0], spots[q2][1]) ? [{ x: spots[q2][0], z: spots[q2][1] }] : gridPath(n2.x, n2.z, spots[q2][0], spots[q2][1], 6); if (tail) gn = gc[b1][0]; }
      if (!head || !tail) return null;
      var mid = astar(sn, gn); if (!mid) return null;
      GUIDE.left = gn;
      route = head.concat(mid.slice(1).map(function (i) { return { x: N[i].x, z: N[i].z }; }), tail);
    }
    // shortcuts: skip waypoints he can walk past in a straight line
    var pts = [{ x: P.x, z: P.z }].concat(route), out = [], k2 = 0;
    while (k2 < pts.length - 1) { var far = k2 + 1; for (var m = Math.min(pts.length - 1, k2 + 10); m > k2 + 1; m--) if (lineOK(pts[k2].x, pts[k2].z, pts[m].x, pts[m].z)) { far = m; break; } out.push(pts[far]); k2 = far; }
    return out;
  }
  // what to walk to next: the nearest thing still to find or read, the studio when his satchel is heavy, the cave once the solids are all his,
  // or a seat to rest on when nothing more can be found until night or the next storm
  var GUIDE = { goal: null, route: null, t: 0, chime: 0, tries: 0, skip: {} };
  // a find out in deep water wants the waders first, one in fast water the walking stick
  function needsTool(f) {
    var o = findObj[f.id], h = world.height(o.x, o.z, 99), wd = world.wading(o.x, o.z, h);
    if (f.deep || wd > 0.62) return save.tools.waders ? null : 'waders';
    if (wd > 0.16 && world.fast(o.x, o.z)) return save.tools.stick ? null : 'stick';
    return null;
  }
  function goalName(gl) {
    if (gl.kind === 'find') return gl.f.coll ? 'something ' + gl.f.hint : gl.f.name.replace(/^A /, 'a ') + ', ' + gl.f.hint;
    if (gl.kind === 'poem') return 'a poem, at ' + gl.pm.label.replace(/^The /, 'the ');
    if (gl.kind === 'studio') return 'Tom’s studio, to hang what he has found';
    if (gl.kind === 'cave') return 'the cave under the bluff, with the five solids';
    if (gl.kind === 'seat') return gl.seat.label + ', to rest ' + gl.why;
    return '';
  }
  // every reasonable next goal, best first
  function nextGoals(again) {
    var c = counts(), out = [];
    if (caveReady() && !save.done) out.push({ kind: 'cave', x: CV.cx, z: CV.z1 - 0.8 });
    var st = world.spots.studio;
    if (c.bag >= 8) out.push({ kind: 'studio', x: st.x, z: st.z });
    var list = [];
    ITEMS.forEach(function (f) {
      if (!available(f) || GUIDE.skip[f.id] || needsTool(f)) return;      // the waders or the stick come first
      var o = findObj[f.id]; list.push([Math.hypot(o.x - P.x, o.z - P.z), { kind: 'find', f: f, x: o.x, z: o.z }]);
    });
    POEMS.forEach(function (pm) { if (save.read[pm.id] || GUIDE.skip['p:' + pm.id]) return; var o = poemObj[pm.id]; list.push([Math.hypot(o.x - P.x, o.z - P.z) * 0.85, { kind: 'poem', pm: pm, x: o.x, z: o.z }]); });
    if (!list.length && !again && Object.keys(GUIDE.skip).length) { GUIDE.skip = {}; return nextGoals(true); }   // only the awkward ones are left: try them again
    list.sort(function (a, b) { return a[0] - b[0]; }).forEach(function (q) { out.push(q[1]); });
    if (c.bag > 0) out.push({ kind: 'studio', x: st.x, z: st.z });
    var why = save.weather === 'storm' ? 'until the storm has passed' : stormDue() || save.wave < 2 ? 'into the evening' : 'until night';
    SEATS.slice().sort(function (a, b) { return Math.hypot(a.x - P.x, a.z - P.z) - Math.hypot(b.x - P.x, b.z - P.z); }).forEach(function (seat) { out.push({ kind: 'seat', seat: seat, why: why, x: seat.x, z: seat.z }); });
    return out;
  }
  function nextGoal() { return nextGoals()[0]; }
  function guideGo() {
    if (!playing || modal || P.lock) return;
    if (GUIDE.route) { guideStop(); say('Stopped.'); return; }
    var gls = nextGoals(), gl = null, r = null;
    for (var k = 0; k < gls.length && k < 8 && !r; k++) { gl = gls[k]; r = planRoute(gl.x, gl.z); }
    if (!r && rescue()) { for (var k3 = 0; k3 < gls.length && k3 < 8 && !r; k3++) { gl = gls[k3]; r = planRoute(gl.x, gl.z); } }
    if (!r) { toast('He can’t see a way there from here.'); autoSay('He can’t see a way there from here.'); return; }
    GUIDE.goal = gl; GUIDE.route = r; GUIDE.tries = 0; P.target = null; P.autoRead = null;
    var line = 'Walking to ' + goalName(gl) + '.'; showNext(gl, true); autoSay(line);
  }
  // stuck on the way: plan again from here (twice), then give up on that goal for now
  function guideStuck() {
    var gl = GUIDE.goal; if (!gl) { guideStop(); return; }
    GUIDE.tries++;
    if (GUIDE.tries > 3) { skipGoal(gl); guideStop(); toast('He can\u2019t find a way through there.'); return; }
    if (GUIDE.tries >= 2) rescue();     // stuck twice: back up to the path first
    var r = planRoute(gl.x, gl.z); if (r) GUIDE.route = r; else { skipGoal(gl); guideStop(); }
  }
  // stranded (down a bank, on a bar in fast water): he finds his way back to the nearest path, in a short fade
  function rescue() {
    if (!NAV) buildNav();
    var N = NAV.nodes, c = NAV.near(P.x, P.z, 60).filter(function (q) { return N[q[0]].tr >= 0; })[0]; if (!c) return false;
    var n = N[c[0]]; GUIDE.rescues = (GUIDE.rescues || 0) + 1; fadeTo(); teleport(n.x, n.z, P.yaw); toast('He finds his way back up to the path.'); autoSay('He finds his way back up to the path.');
    return true;
  }
  function fadeTo(fn) { var f = $('fade'); f.classList.remove('on'); void f.offsetWidth; f.classList.add('on'); if (fn) setTimeout(fn, 450); }
  function skipGoal(gl) { if (gl.kind === 'find') GUIDE.skip[gl.f.id] = true; if (gl.kind === 'poem') GUIDE.skip['p:' + gl.pm.id] = true; }
  function guideStop() { GUIDE.route = null; GUIDE.goal = null; P.target = null; showNext(null); }
  function guideArrive() {
    var gl = GUIDE.goal; GUIDE.route = null; GUIDE.goal = null; P.target = null;
    if (!gl) return;
    if (gl.kind === 'find' && available(gl.f) && Math.hypot(findObj[gl.f.id].x - P.x, findObj[gl.f.id].z - P.z) < 1.6) { pickUp(gl.f); GUIDE.skip = {}; }
    else if (gl.kind === 'find' && available(gl.f)) skipGoal(gl);   // could not get close enough this time: try the others first
    else if (gl.kind === 'poem' && !save.read[gl.pm.id]) { if (nearPoem() === gl.pm) { read(gl.pm); GUIDE.skip = {}; } else skipGoal(gl); }
    else if (gl.kind === 'studio') openStudio();
    else if (gl.kind === 'cave') startEnding();
    else if (gl.kind === 'seat') { openRest(gl.seat); }
    showNext(null);
  }
  // follow the route: called each frame before the steering is read
  function guideUpdate(dt) {
    if (!GUIDE.route) return;
    if ((modal || P.lock) && !GUIDE.route.length && !P.target) { GUIDE.route = null; GUIDE.goal = null; return; }   // it read the poem or picked the thing up on arrival
    if (modal || P.lock) return;
    var R = GUIDE.route;
    if (!P.target) {
      if (!R.length) { guideArrive(); return; }
      var w = R.shift(), left = R.reduce(function (s, q, i) { return s + Math.hypot(q.x - (i ? R[i - 1].x : w.x), q.z - (i ? R[i - 1].z : w.z)); }, 0);
      P.target = { x: w.x, z: w.z, run: left + Math.hypot(w.x - P.x, w.z - P.z) > 22, guide: true }; P.stuck = 0;
      if (!R.length && GUIDE.goal && GUIDE.goal.kind === 'poem') P.autoRead = GUIDE.goal.pm.id;
    }
    // the guide chime: from the direction of the goal, quicker and higher as he gets close
    GUIDE.chime -= dt;
    if (GUIDE.goal && GUIDE.chime <= 0 && (EASY.on || save.voice)) {
      var gl = GUIDE.goal, d = Math.hypot(gl.x - P.x, gl.z - P.z); _gp.set(gl.x, P.y + 1, gl.z).project(cam);
      GUIDE.chime = 0.6 + Math.min(2.2, d / 12); tone(660 + Math.max(0, 30 - d) * 14, 0, 0.35, 0.05, 'sine', Math.max(-1, Math.min(1, _gp.x)));
    }
  }
  // the "next" card: a big line at the bottom saying where he is going, or what is next if he is standing still
  var NEXT = { t: 0, gl: null };
  function showNext(gl, going) {
    var c = $('nextCard'); NEXT.gl = gl;
    if (!gl) { c.classList.toggle('on', EASY.on && playing && !P.lock); return; }
    $('nextLine').textContent = (going ? 'Walking to ' : 'Next: ') + goalName(gl);
    $('nextKey').textContent = going ? 'G to stop' : 'G to go';
    c.classList.add('on');
  }
  function nextUpdate(dt) {
    NEXT.t -= dt; if (NEXT.t > 0) return; NEXT.t = 0.5;
    var show = playing && !modal && !P.lock && !ENDING.on && !PHOTO.on && !WATCH.on && (EASY.on || GUIDE.route);
    if (!show) { $('nextCard').classList.remove('on'); return; }
    if (GUIDE.route) showNext(GUIDE.goal, true); else showNext(nextGoal(), false);
  }
  $('nextCard').addEventListener('click', function () { guideGo(); });
  $('bGuide').addEventListener('click', function () { guideGo(); });

  // ================================================================ a game controller (for the TV): standard mapping
  // left stick walks (pushed all the way, he hurries), right stick turns and tilts the view; A acts, or walks him to the next thing;
  // B backs out; X ponders; Y photo mode (then Y or A takes the picture); bumpers turn the view; triggers zoom; Back the map; Start the menu;
  // in a card or menu the D-pad moves between the buttons and A presses one.
  var PAD = { prev: [], told: false, on: false };
  function padContainer() {
    if (!$('cardWrap').hidden) return $('cardWrap');
    if (modal) return $(modal);
    if (!$('intro').hidden) return $('intro');
    if (PHOTO.on) return $('photoBar');
    return null;
  }
  function padFocus(dir) {
    var box = padContainer(); if (!box) return;
    var bs = [].filter.call(box.querySelectorAll('button'), function (b) { return !b.disabled && b.offsetParent !== null; }); if (!bs.length) return;
    var i = bs.indexOf(document.activeElement); i = i < 0 ? 0 : (i + dir + bs.length) % bs.length; bs[i].focus();
  }
  function padPress(b) {
    var box = padContainer();
    if (WATCH.on && !modal && $('cardWrap').hidden) { if (b === 0 || b === 9) watchPause(); if (b === 5 || b === 15) watchSkip(); if (b === 1) watchStop(); return; }
    if (b === 0) {   // A
      if (box) { var el = document.activeElement; if (el && box.contains(el) && el.tagName === 'BUTTON') { el.click(); return; } padFocus(0); return; }
      if (!playing) return;
      var before = P.lock; act(); if (!P.lock && !modal && before === P.lock && !nearPoem() && !nearStudio() && !nearFind(1.3)) guideGo();
    }
    if (b === 1) {   // B
      if (!$('cardWrap').hidden) { $('cardClose').click(); return; }
      if (modal) { if (modal !== 'endVeil' && modal !== 'creditsVeil') closeModal(); return; }
      if (PHOTO.on) { photoClose(); return; }
      if (GUIDE.route) { guideStop(); return; }
      if (WATCH.on) { watchStop(); return; }
    }
    if (box && box !== $('photoBar')) { if (b === 12 || b === 14) padFocus(-1); if (b === 13 || b === 15) padFocus(1); return; }
    if (!playing) return;
    if (b === 2) ponder();
    if (b === 3) { if (PHOTO.on) shutter(); else photoOpen(); }
    if (b === 4) turn(-1); if (b === 5) turn(1);
    if (b === 8) openMap(); if (b === 9) $('bMenu').click();
    if (b === 11) closeUp();
    if (PHOTO.on) { if (b === 14) padFocus(-1); if (b === 15) padFocus(1); }
    else { if (b === 14) turn(-1); if (b === 15) turn(1); if (b === 12) tilt(0.12); if (b === 13) tilt(-0.12); }
  }
  function padUpdate(dt) {
    if (!navigator.getGamepads) return;
    var pads = navigator.getGamepads(), gp = null; for (var i = 0; i < pads.length; i++) if (pads[i] && pads[i].connected) { gp = pads[i]; break; }
    if (!gp) { if (PAD.on) { PAD.on = false; stick.on = false; } return; }
    if (!PAD.told) { PAD.told = true; toast('Controller ready: A to act or walk to the next thing, X to ponder, Y for a picture, B to go back.', 6); }
    var bt = gp.buttons.map(function (b) { return b.pressed || b.value > 0.5; });
    for (var k = 0; k < bt.length; k++) if (bt[k] && !PAD.prev[k]) padPress(k);
    PAD.prev = bt;
    var ax = gp.axes, lx = ax[0] || 0, ly = ax[1] || 0, rx = ax[2] || 0, ry = ax[3] || 0, L = Math.hypot(lx, ly);
    if (L > 0.2 && playing && !modal && !P.lock) { PAD.on = true; stick.on = true; stick.x = lx; stick.y = -ly; stick.run = L > 0.92; }
    else if (PAD.on) { PAD.on = false; stick.on = false; stick.x = stick.y = 0; stick.run = false; }
    if (Math.abs(rx) > 0.2 && !modal) { view.azGoal -= rx * dt * 1.8; view.az -= rx * dt * 1.8; }
    if (Math.abs(ry) > 0.25 && !modal) { view.elGoal = Math.max(EL_MIN, Math.min(EL_MAX, view.elGoal + ry * dt * 1.0)); }
    var lt = gp.buttons[6] ? gp.buttons[6].value : 0, rt = gp.buttons[7] ? gp.buttons[7].value : 0;
    if (lt > 0.1 && !modal) zoomBy(1 + lt * dt * 1.2); if (rt > 0.1 && !modal) zoomBy(1 - rt * dt * 1.0);
  }
  window.addEventListener('gamepadconnected', function () { PAD.told = false; });

  // ================================================================ Watch: the game plays the story by itself, reading everything out
  // It runs on a throwaway save (the real one is put aside and never written while watching) and puts everything back at the end.
  var STORY = [
    { chapter: 'What the Water Brings', sub: 'Richard Sale, the Philosopher King', say: 'Richard Sale, the Philosopher King, walks down to Tom’s creek, to see what the water has brought.' },
    { go: 'find', id: 'stick' },
    { go: 'poem', id: 'bench' },
    { go: 'find', id: 'knob' },
    { go: 'find', id: 'bowl' },
    { go: 'find', id: 'glassG' },
    { go: 'studio', say: 'Whatever he finds goes on the wall of Tom’s studio, in a pine box, with a label.' },
    { chapter: 'Up the Dry Fork', say: 'Up under the bluff, the Dry Fork is dry most days. It only runs in a storm.' },
    { go: 'poem', id: 'rock' },
    { chapter: 'The lookout' },
    { go: 'find', id: 'octa' },
    { go: 'poem', id: 'lookout' },
    { chapter: 'The storm', say: 'He sits down on the lookout bench, and the clouds come up from the west.', rest: 'lookout', until: 'storm' },
    { rest: 'here', until: 'passed', say: 'He waits it out.' },
    { chapter: 'The morning after', say: 'The creek is high and brown, and it has brought new things down.' },
    { go: 'find', id: 'cube' },
    { go: 'find', id: 'tetra' },
    { go: 'find', id: 'walden' },
    { go: 'poem', id: 'oak' },
    { go: 'poem', id: 'crossing' },
    { go: 'find', id: 'waders' },
    { go: 'find', id: 'icosa' },
    { go: 'poem', id: 'spring' },
    { chapter: 'By starlight', say: 'He rests until the stars come out. One of the shapes only shows itself at night.', rest: 'near', until: 'night' },
    { go: 'find', id: 'dodeca' },
    { go: 'poem', id: 'trestle' },
    { chapter: 'The cave', say: 'Five shapes, for water, air, earth, fire, and the heavens. There is a ledge in the cave under the bluff that would hold them.' },
    { go: 'cave' }
  ];
  var WATCH = { on: false, i: -1, phase: '', t: 0, paused: false, real: null, min: 0 };
  function watchSave(real) {
    var o = fresh(); ['quality', 'pix', 'kingDet', 'creekDet', 'sound', 'map', 'see', 'voiceSet'].forEach(function (k) { if (real[k] != null) o[k] = real[k]; });
    o.voice = true; o.hour = 8.5; o.day = 1; o.weather = 'clear'; o.flow = { main: 'high', dry: 'pools', teal: 'normal', pond: 'normal' }; o.stormed = false; o.struck = false; o.pos = null;
    return o;
  }
  // put a whole save in place: progress, the time and the water, the wall, the ledge, the map, the finds lying out
  function applySave(o) {
    Object.keys(save).forEach(function (k) { delete save[k]; }); Object.assign(save, o);
    ['found', 'hung', 'tools', 'nums', 'read'].forEach(function (k) { if (!save[k]) save[k] = {}; });
    if (save.hour == null) save.hour = 8.5; if (!save.day) save.day = 1; if (!save.weather) save.weather = 'clear'; if (!save.flow) save.flow = { main: 'high', dry: 'pools', teal: 'normal', pond: 'normal' };
    SKY.hour = save.hour; SKY.lapse = null; SKY.storm = save.weather === 'storm' ? 1 : 0; SKY.flash = 0;
    Object.keys(save.flow).forEach(function (k) { world.setFlowNow(k, save.flow[k]); }); world.setStruck(!!save.struck);
    Object.keys(wallProps).forEach(function (k) { scene.remove(wallProps[k]); delete wallProps[k]; }); wallUpdate();
    ledgeClear(); if (save.done) LEDGE.forEach(ledgePlace);
    FOG.fill(0); fogLoad(); fogDirty = true;
    WORLD.night = isNight(); showFinds(); counts(); P.lock = null; P.anim = ''; setAnim('idle', 0.2); king.setItem(carryItem());
    GUIDE.skip = {}; guideStop();
    if (save.pos) teleport(save.pos[0], save.pos[1], save.pos[2]); else teleport(world.spots.start[0], world.spots.start[1], world.spots.startYaw);
  }
  function watchStart() {
    if (WATCH.on) return;
    if (TITLE.on) { $('fade').classList.add('on'); titleEnd(); setTimeout(function () { $('fade').classList.remove('on'); }, 700); }
    closeModal(); $('intro').hidden = true; playing = true; audioStart(); setSound(save.sound);
    save.pos = [+P.x.toFixed(2), +P.z.toFixed(2), +P.yaw.toFixed(2)]; save.hour = SKY.hour; fogSave(); persist();
    WATCH.real = JSON.parse(JSON.stringify(save));
    WATCH.on = true; WATCH.i = -1; WATCH.phase = 'next'; WATCH.t = 0; WATCH.paused = false; WATCH.forceStorm = false;
    applySave(watchSave(WATCH.real));
    document.body.classList.add('watch'); $('watchBar').hidden = false; $('wPause').textContent = 'Pause';
    toastQ.length = 0; $('toast').classList.remove('on'); toastT = 0;
  }
  function watchStop() {
    if (!WATCH.on) return;
    WATCH.on = false; hush(); chapter(null); closeModal();
    if (ENDING.on) { ENDING.on = false; ENDING.paged = false; document.body.classList.remove('cine'); $('bSkip').hidden = true; FIRE.want = 0; SH.mesh.visible = false; cineText(''); }
    document.body.classList.remove('watch'); $('watchBar').hidden = true;
    applySave(WATCH.real); WATCH.real = null; persist();
    toast('Back to your own walk.', 4);
  }
  function watchPause(on) { WATCH.paused = on == null ? !WATCH.paused : on; $('wPause').textContent = WATCH.paused ? 'Carry on' : 'Pause'; if (WATCH.paused) { hush(); if (GUIDE.route) { WATCH.held = GUIDE.goal; guideStop(); } } }
  function watchSkip() { if (!WATCH.on) return; hush(); chapter(null); if (GUIDE.route) guideStop(); if (modal && modal !== 'endVeil' && modal !== 'creditsVeil') closeModal(); WATCH.phase = 'next'; }
  // the big chapter card in the middle of the screen
  function chapter(title, sub) { var c = $('chapter'); if (!title) { c.classList.remove('on'); return; } $('chTitle').textContent = title; $('chSub').textContent = sub || ''; c.classList.remove('on'); void c.offsetWidth; c.classList.add('on'); }
  function speechBusy() { if (VOICE.chain) return true; var tts = false; try { tts = VOICE.busy && ('speechSynthesis' in window) && (speechSynthesis.speaking || speechSynthesis.pending); } catch (e) {} return tts || !!(VOICE.audio && !VOICE.audio.paused && !VOICE.audio.ended); }
  function waiting() { return WATCH.t < WATCH.min || (speechBusy() && WATCH.t < WATCH.min * 2.5 + 6); }   // never wait for a voice for ever
  function readTime(t) { return 1.5 + (t ? t.split(/\s+/).length / 2.4 : 0); }   // how long a line takes, when there is no voice to listen for
  function storyGoal(st) {
    if (st.go === 'find') { var f = PKWaterFinds.byId[st.id], o = findObj[st.id]; return { kind: 'find', f: f, x: o.x, z: o.z }; }
    if (st.go === 'poem') { var pm = POEMS.filter(function (q) { return q.id === st.id; })[0], po = poemObj[st.id]; return { kind: 'poem', pm: pm, x: po.x, z: po.z }; }
    if (st.go === 'studio') { var s2 = world.spots.studio; return { kind: 'studio', x: s2.x, z: s2.z }; }
    if (st.go === 'cave') return { kind: 'cave', x: CV.cx, z: CV.z1 - 0.8 };
    return null;
  }
  // a long way: a short fade, and he is most of the way there; then he walks the rest
  function watchWalk(gl) {
    var r = planRoute(gl.x, gl.z);
    if (!r) { rescue(); r = planRoute(gl.x, gl.z); }
    if (!r) { if (gl.kind === 'find' || gl.kind === 'poem') { teleport(gl.x + 0.6, gl.z + 0.6, P.yaw); r = [{ x: gl.x, z: gl.z }]; } else return false; }
    var L = 0, pts = [{ x: P.x, z: P.z }].concat(r); for (var k = 1; k < pts.length; k++) L += Math.hypot(pts[k].x - pts[k - 1].x, pts[k].z - pts[k - 1].z);
    if (L > 30) {
      var left = 0, j = pts.length - 1; while (j > 1 && left < 13) { left += Math.hypot(pts[j].x - pts[j - 1].x, pts[j].z - pts[j - 1].z); j--; }
      var at = pts[j]; fadeTo(); teleport(at.x, at.z, Math.atan2(pts[j + 1].x - at.x, pts[j + 1].z - at.z)); view.tgt.set(P.x, P.y + 0.9, P.z);
      r = planRoute(gl.x, gl.z) || pts.slice(j + 1);
    }
    GUIDE.goal = gl; GUIDE.route = r; GUIDE.tries = 0; P.target = null; P.autoRead = null;
    return true;
  }
  function watchUpdate(dt) {
    if (!WATCH.on || WATCH.paused) return;
    WATCH.t += dt;
    var st = STORY[WATCH.i];
    if (WATCH.phase === 'next') {
      WATCH.i++; st = STORY[WATCH.i]; WATCH.t = 0;
      if (P.lock === 'read' && !modal) { P.lock = null; P.anim = ''; setAnim('idle', 0.3); }
      if (!st) { WATCH.phase = 'done'; return; }
      if (st.chapter) chapter(st.chapter, st.sub);
      if (st.say) say(st.say);
      WATCH.min = st.chapter ? 4.5 : 0; if (st.say) WATCH.min = Math.max(WATCH.min, readTime(st.say));
      WATCH.phase = 'intro';
      return;
    }
    if (WATCH.phase === 'intro') {
      if (waiting()) return;
      chapter(null);
      if (st.rest) {
        var seat = st.rest === 'here' ? { x: P.x, z: P.z, y: P.y, face: P.yaw, label: 'here' } : st.rest === 'near' ? SEATS.slice().sort(function (a, b) { return Math.hypot(a.x - P.x, a.z - P.z) - Math.hypot(b.x - P.x, b.z - P.z); })[0] : SEATS.filter(function (q) { return q.id === st.rest; })[0];
        if (st.until === 'storm') WATCH.forceStorm = true;
        restSeat = seat; rest(st.until === 'passed' ? 24 + 7.2 : st.until === 'night' ? Math.max(SKY.hour + 1, 21.6) : 18.6);
        WATCH.phase = 'rest'; WATCH.t = 0; return;
      }
      var gl = storyGoal(st);
      if (!gl) { WATCH.phase = 'next'; return; }
      if (gl.kind === 'find' && !available(gl.f)) { WATCH.phase = 'next'; return; }
      if (!watchWalk(gl)) { WATCH.phase = 'next'; return; }
      WATCH.phase = 'walk'; WATCH.t = 0; return;
    }
    if (WATCH.phase === 'rest') { if (SKY.lapse || P.lock) return; WATCH.forceStorm = false; WATCH.phase = 'next'; return; }
    if (WATCH.phase === 'walk') {
      var still = GUIDE.route && (GUIDE.route.length || P.target) && !modal && P.lock !== 'read' && P.lock !== 'hold';
      if (still) { if (WATCH.t > 150) { guideStop(); WATCH.phase = 'next'; } return; }
      GUIDE.route = null; GUIDE.goal = null;
      // arrived (the guide picks up, reads, opens the studio or starts the ending)
      var g2 = storyGoal(st);
      if (g2 && g2.kind === 'find' && available(g2.f)) pickUp(g2.f);
      if (g2 && g2.kind === 'poem' && !modal) { read(g2.pm); }
      if (g2 && g2.kind === 'studio' && !modal) openStudio();
      if (g2 && g2.kind === 'cave' && !ENDING.on && !save.done) startEnding();
      WATCH.phase = 'linger'; WATCH.t = 0; WATCH.min = g2 && g2.kind === 'poem' ? readTime(poemText(g2.pm)) + 2.5 : g2 && g2.kind === 'studio' ? 6 : g2 && g2.kind === 'find' ? readTime(findText(g2.f)) + 1.5 + (PKWaterFinds.SOLID_POEMS[g2.f.id] ? 3.6 + readTime(poemText(PKWaterFinds.SOLID_POEMS[g2.f.id])) + 2 : 0) : 2;
      return;
    }
    if (WATCH.phase === 'linger') {
      if (ENDING.on) {   // the ending plays itself; then the last page, then the credits
        if (modal === 'endVeil' && WATCH.t > 4 && (!speechBusy() || WATCH.t > 30)) { WATCH.t = -6; $('eNext').click(); }
        return;
      }
      if (waiting() || (P.lock && P.lock !== 'read')) return;
      if (modal === 'poemVeil' || modal === 'studioVeil') closeModal();
      if (P.lock === 'read') { P.lock = null; P.anim = ''; setAnim('idle', 0.3); }
      WATCH.phase = 'next';
    }
  }
  $('bWatch').addEventListener('click', watchStart);
  $('mWatch').addEventListener('click', function () { closeModal(); watchStart(); });
  $('wPause').addEventListener('click', function () { watchPause(); });
  $('wSkip').addEventListener('click', watchSkip);
  $('wStop').addEventListener('click', watchStop);

  // ---------------------------------------------------------------- per frame
  var clock = new THREE.Clock(), time = 0, _v = new THREE.Vector3(), lastLabel = '', fogT = 0, saveT = 0;
  function update(dt) {
    time += dt;
    var ix = 0, iy = 0, run = input.run;
    if (playing && !modal && !P.lock && $('cardWrap').hidden && !WATCH.on) {
      if (input.keys.u) iy += 1; if (input.keys.d) iy -= 1; if (input.keys.l) ix -= 1; if (input.keys.r) ix += 1;
      if (stick.on) { ix = stick.x; iy = stick.y; run = run || stick.run; }
    }
    padUpdate(dt); guideUpdate(dt);
    var mag = Math.min(1, Math.hypot(ix, iy)), wantDir = P.dir;
    if (mag > 0.05 && GUIDE.route && !WATCH.on) guideStop();
    if (mag > 0.05) EASY.manual = time;
    var fx = -Math.sin(view.az), fz = -Math.cos(view.az), rx = Math.cos(view.az), rz = -Math.sin(view.az);
    if (mag > 0.05) { var wx = fx * iy + rx * ix, wz = fz * iy + rz * ix; wantDir = Math.atan2(wx, wz); if (Math.hypot(ix, iy) > 1) mag = 1; }
    else if (P.target && playing && !modal && !P.lock) {
      var dx = P.target.x - P.x, dz = P.target.z - P.z, d = Math.hypot(dx, dz);
      if (d < (P.target.guide && GUIDE.route && GUIDE.route.length ? 0.5 : 0.18)) { P.target = null; mag = 0; if (P.autoRead) { var pm = POEMS.filter(function (q) { return q.id === P.autoRead; })[0]; P.autoRead = null; if (pm) read(pm); } }
      else { wantDir = Math.atan2(dx, dz); mag = Math.min(1, d / 0.6 + 0.2); run = run || P.target.run; }
    } else mag = 0;
    P.wade = world.wading(P.x, P.z, P.y);
    var top = (run ? RUN : WALK) * (P.wade > 0.03 ? (P.wade > 0.35 ? 0.45 : 0.65) : 1), want = mag * top;
    if (P.lock) want = 0;
    P.speed += (want - P.speed) * (1 - Math.exp(-dt * (want > P.speed ? 8 : 12)));
    if (mag > 0.05) { P.dir = wantDir; var dyaw = Math.atan2(Math.sin(wantDir - P.yaw), Math.cos(wantDir - P.yaw)); P.yaw += dyaw * (1 - Math.exp(-dt * 11)); }
    P.blockT -= dt;
    if (P.speed > 0.01) {
      var mvx = Math.sin(P.yaw) * P.speed * dt, mvz = Math.cos(P.yaw) * P.speed * dt, nx = P.x + mvx, nz = P.z + mvz;
      var strict = !!(P.target && P.target.guide), why = blocked(P.x, P.z, nx, nz, null, null, strict);
      if (why) {   // slide along whatever stopped him (when the guide walks him, never down a bank)
        if (!blocked(P.x, P.z, P.x + mvx, P.z, null, null, strict)) { nx = P.x + mvx; nz = P.z; why = null; }
        else if (!blocked(P.x, P.z, P.x, P.z + mvz, null, null, strict)) { nx = P.x; nz = P.z + mvz; why = null; }
      }
      if (why) {
        nx = P.x; nz = P.z;
        if (P.blockT <= 0 && (mag > 0.05 || (P.target && !strict))) { toast(blockLine(why), 3); P.blockT = 6; }
        if (P.target) P.stuck += dt * 3;
      }
      var h0 = world.height(P.x, P.z, P.y), h1 = world.height(nx, nz, P.y), step = Math.hypot(nx - P.x, nz - P.z) || 1e-6, slope = (h1 - h0) / step;
      var slow = slope > 0.7 ? Math.max(0.4, 1 - (slope - 0.7) * 0.6) : 1;
      var p = { x: P.x + (nx - P.x) * slow, z: P.z + (nz - P.z) * slow }; world.collide(p, 0.24);
      if (blocked(P.x, P.z, p.x, p.z, null, null, strict)) { p.x = P.x; p.z = P.z; }
      if (P.target) { var moved = Math.hypot(p.x - P.x, p.z - P.z); P.stuck = moved < P.speed * dt * 0.3 ? P.stuck + dt : 0; if (P.stuck > 0.6) { P.target = null; if (GUIDE.route) guideStuck(); } }
      P.x = p.x; P.z = p.z;
    }
    if (ENDING.on) endingUpdate(dt);
    watchUpdate(dt);
    skyUpdate(dt); lookUpdate(dt); ambUpdate(dt); easyCam(dt); solidPoemUpdate(dt); lapseUpdate(dt); fireUpdate(dt); ponderUpdate(dt); easyUpdate();
    var gy = world.height(P.x, P.z, P.y);
    if (gy < P.y - 0.04) { P.vy -= 9.8 * dt; P.y = Math.max(gy, P.y + P.vy * dt); }
    else { P.vy = 0; P.y += (gy - P.y) * (1 - Math.exp(-dt * 18)); }
    king.root.position.set(P.x, P.y, P.z); king.root.rotation.y = P.yaw;

    if (P.jumpT >= 0) { P.jumpT += dt; if (P.jumpT > 1.25 / 1.25) { P.jumpT = -1; P.anim = ''; } }
    if (P.lock === 'hold') { P.lockT -= dt; if (P.lockT <= 0) { P.lock = null; checkDone(); } }
    if (P.lock === 'getup') { P.lockT -= dt; if (P.lockT <= 0) { P.lock = null; setAnim('idle', 0.4); king.setItem(save.carry && have(PKWaterFinds.byId[save.carry]) ? save.carry : null); } }
    if (P.lock === 'rest') setAnim('sit');
    stoneUpdate(dt); sightUpdate(dt);
    if (P.lock === 'ponder') { P.lockT -= dt; if (P.lockT <= 0) { P.lock = null; P.anim = ''; setAnim('idle', 0.4); king.setItem(carryItem()); } }
    if (P.jumpT < 0 && !P.lock) {
      if (P.speed < 0.08) idleMoves(dt);
      else if (P.wade > 0.22 && P.speed < 1.75) { IDLE.t = IDLE.busy = 0; setAnim('wade'); king.actions.wade.timeScale = Math.max(0.6, P.speed / 0.7); }
      else if (P.speed < 1.75) { IDLE.t = IDLE.busy = 0; setAnim('walk'); king.actions.walk.timeScale = Math.max(0.6, P.speed / WALK_CLIP); }
      else { IDLE.t = IDLE.busy = 0; setAnim('run'); king.actions.run.timeScale = Math.max(0.8, P.speed / RUN_CLIP); }
    } else IDLE.t = IDLE.busy = 0;
    king.mixer.update(dt);

    if (P.wade > 0.03) {
      P.stepT -= dt * (P.speed > 0.1 ? 1 : 0.25);
      if (P.stepT <= 0) { P.stepT = P.speed > 1.8 ? 0.22 : 0.38; world.splash(P.x + Math.sin(P.yaw) * 0.15, P.z + Math.cos(P.yaw) * 0.15, P.speed > 0.1 ? 0.9 : 0.6); if (P.speed > 0.1) SFX.splash(); }
    }

    if (playing && !P.lock && !modal) { var f = nearFind(0.75); if (f) pickUp(f); }
    var free = !P.lock && !modal && $('cardWrap').hidden && playing;
    var pmN = free ? nearPoem() : null, stN = free && !pmN && nearStudio(), fN = free && !pmN && !stN ? nearFind(1.3) : null, cN = free && !pmN && !stN && !fN && inCave() && caveReady(), wN = free && !pmN && !stN && !fN && !cN && save.weather === 'storm' && P.speed < 0.1, kN = free && !pmN && !stN && !fN && !cN && !wN && !WATCH.on && !PHOTO.on && !ENDING.on && !STONE.on ? nearSkip() : null;
    var label = pmN ? 'Read · ' + pmN.label : stN ? 'studio' : fN ? 'Pick up' : cN ? 'cave' : wN ? 'wait' : kN ? 'skip' : '';
    if (free && inCave() && !caveTold && !caveReady()) { caveTold = true; toast('A flat back wall, a ledge, an old fire ring. A room waiting for something.', 5); }
    if (label !== lastLabel) {
      lastLabel = label;
      $('bAct').hidden = !label; $('bAct').textContent = pmN ? 'Read' : stN ? 'Studio' : cN ? (save.done ? 'The fire' : 'Set them out') : wN ? 'Wait it out' : kN ? 'Skip a stone' : 'Pick up';
      $('prompt').classList.toggle('hidden', !label); $('promptText').textContent = pmN ? 'Read the poem · ' + pmN.label : stN ? 'Tom\u2019s studio · hang the finds' : cN ? (save.done ? 'Light the fire again' : 'Set the five solids on the ledge') : wN ? 'Sit out the storm' : kN ? 'Skip a stone across ' + kN.label : 'Pick it up';
    }

    // the valley: stream tiles round where the camera is looking, then ripples and creatures
    world.stream(view.tgt.x, view.tgt.z, STREAM_MS);
    world.update(time, dt, { x: P.x, z: P.z });
    ITEMS.forEach(function (f, i) { var o = findObj[f.id]; if (!o.g.visible) return; o.glint.rotation.y = time * 1.6 + i; o.glint.position.y = 0.72 + 0.08 * Math.sin(time * 2.4 + i); var s = (0.8 + 0.25 * Math.max(0, Math.sin(time * 3 + i * 1.7))) * (PON.t > 0 && PON.shimmer.indexOf(o) >= 0 ? 1.8 : 1) * (EASY.on ? 2.2 : 1); o.glint.scale.setScalar(s); });
    POEMS.forEach(function (pm, i) { var o = poemObj[pm.id]; o.g.rotation.y = time * 0.9 + i; o.g.position.y = o.base + 0.07 * Math.sin(time * 1.8 + i) + (EASY.on ? 0.35 : 0); o.g.scale.setScalar(EASY.on ? 2.2 : 1); o.g.visible = !(P.lock === 'read' && nearPoem() === pm); });
    life.update(time, dt, { x: P.x, z: P.z, y: P.y, lamp: !!save.tools.lantern && isNight() && !ENDING.on, ending: ENDING.on, wading: P.wade, hour: SKY.hour, storm: save.weather === 'storm' || LOOK.st > 0.4, camDir: [Math.sin(view.az), Math.cos(view.az)] });
    while (life.events.length) { var ev = life.events.shift(); if (ev.type === 'hoot') { BIRDS.hoot(ev.near); continue; } if (ev.type === 'bassPlop') { if (ev.near < 14) SFX.plop(); continue; } if (ev.type === 'bassJump' && ev.near < 14) SFX.splash(); if ((ev.type !== 'heron' && ev.type !== 'bassJump' || ev.first) && LINES[ev.type]) toast(LINES[ev.type]); if (ev.type === 'turtles' || ev.type === 'frog') SFX.plop(); }
    BIRDS.update(dt); musicUpdate(dt);
    if (AU.creek) { var near = Math.max(0, 1 - world.waterNear(P.x, P.z) / 10); AU.creek.gain.value = 0.02 + 0.07 * near * near; }

    view.az += (view.azGoal - view.az) * (1 - Math.exp(-dt * 6));
    view.el += (view.elGoal - view.el) * (1 - Math.exp(-dt * 6));
    view.zoom += (view.zoomGoal - view.zoom) * (1 - Math.exp(-dt * 6)); applyCam();
    camAim(_v);
    view.tgt.lerp(_v, 1 - Math.exp(-dt * 4.5));
    if (!playing && !modal && !TITLE.on) { view.azGoal += dt * 0.06; }
    titleUpdate(dt);
    placeCam();
    _v.set(P.x, P.y + 1.0, P.z).project(cam);
    var CUT = PKValley.CUT, cutR = 1.05;
    if (ENDING.on && CINE.cut) { _v.copy(CINE.cut).project(cam); cutR = CINE.cutR; }
    CUT.p.value.set(_v.x, _v.y); CUT.z.value = _v.z * 0.5 + 0.5 - 0.0004; CUT.r.value = cutR / (view.hv / 2); CUT.res.value.set(px.w, px.h); CUT.a.value = px.w / px.h;

    // the map fills in where he walks; his place is kept now and then
    fogT -= dt; if (fogT <= 0) { fogT = 0.4; reveal(P.x, P.z, 17); }
    saveT -= dt; if (saveT <= 0 && playing && !ENDING.on) { saveT = 5; if (!SKY.lapse) save.hour = SKY.hour; save.pos = [+P.x.toFixed(2), +P.z.toFixed(2), +P.yaw.toFixed(2)]; fogSave(); persist(); }

    if (toastT > 0) { toastT -= dt; if (toastT <= 0) { $('toast').classList.remove('on'); toastT = -0.4; } }
    else if (toastT < 0) { toastT = Math.min(0, toastT + dt); }
    else if (toastQ.length && capT <= 0 && PON.card <= 0) { var tq = toastQ.shift(); toast(tq[0], tq[1]); }
    if (capT > 0) { capT -= dt; if (capT <= 0) $('caption').classList.remove('on'); }
    if (pendingDone && !modal) { pendingDone = false; openDone(); }
    mapT -= dt; if (mapT <= 0) { mapT = 0.1; drawMini(time); }
    nextUpdate(dt);
  }
  var STREAM_MS = 5;
  // ---------------------------------------------------------------- reflections: the valley drawn again from a camera mirrored in the
  // water near the middle of the view, into a small target the water samples (not on Low, not in Easy to see, where it would be clutter)
  var REF = { rt: null, w: 0, h: 0, cam: new THREE.OrthographicCamera(-1, 1, 1, -1, 0.5, 90), plane: new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), bg: new THREE.Color(), tm: new THREE.Matrix4(), bias: new THREE.Matrix4().set(0.5, 0, 0, 0.5, 0, 0.5, 0, 0.5, 0, 0, 0.5, 0.5, 0, 0, 0, 1), lv: [], up: new THREE.Vector3(), t2: new THREE.Vector3() };
  function reflRender() {
    var FX = PKToon.FX;
    if (save.quality === 'low' || EASY.on || /[?&]norefl/.test(Q) || (PERF && PERF.noRefl)) { FX.uReflOn.value = 0; return; }
    var t = view.tgt, L = REF.lv; L.length = 0;
    for (var i = 0; i < 9; i++) { var a = i * 0.785, r = i ? 4.5 : 0, wl = world.water(t.x + Math.cos(a) * r, t.z + Math.sin(a) * r); if (wl != null) L.push(wl); }
    if (!L.length) { FX.uReflOn.value = 0; return; }
    L.sort(function (a, b) { return a - b; }); var h = L[L.length >> 1];
    var w = Math.max(1, px.w >> 1), hh = Math.max(1, px.h >> 1);
    if (!REF.rt || REF.w !== w || REF.h !== hh) { if (REF.rt) REF.rt.dispose(); REF.rt = new THREE.WebGLRenderTarget(w, hh, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter }); REF.w = w; REF.h = hh; }
    var c2 = REF.cam; c2.left = cam.left; c2.right = cam.right; c2.top = cam.top; c2.bottom = cam.bottom; c2.near = cam.near; c2.far = cam.far;
    c2.position.set(cam.position.x, 2 * h - cam.position.y, cam.position.z);
    REF.up.set(0, 1, 0).applyQuaternion(cam.quaternion); c2.up.set(REF.up.x, -REF.up.y, REF.up.z);
    REF.t2.set(t.x, 2 * h - t.y, t.z); c2.lookAt(REF.t2); c2.updateMatrixWorld(); c2.updateProjectionMatrix();
    REF.tm.copy(REF.bias).multiply(c2.projectionMatrix).multiply(c2.matrixWorldInverse);
    var ws = world.waters || [], vis = ws.map(function (q) { return q.m.visible; }); ws.forEach(function (q) { q.m.visible = false; });
    var CUT = PKValley.CUT, cr = CUT.r.value, rv = RAIN.m.visible; CUT.r.value = 0; RAIN.m.visible = false;
    REF.bg.setRGB(LOOK.hor ? LOOK.hor[0] : 0.75, LOOK.hor ? LOOK.hor[1] : 0.85, LOOK.hor ? LOOK.hor[2] : 0.9).convertSRGBToLinear();
    var bg0 = scene.background, cc0 = renderer.getClearColor(REF.cc || (REF.cc = new THREE.Color())).clone(), ca0 = renderer.getClearAlpha();
    scene.background = null; renderer.setClearColor(REF.bg, 0); REF.plane.constant = -h + 0.02; renderer.clippingPlanes = [REF.plane];
    FX.uReflOn.value = 0; renderer.setRenderTarget(REF.rt); renderer.clear(); renderer.render(scene, c2); renderer.setRenderTarget(null);
    renderer.clippingPlanes = []; scene.background = bg0; renderer.setClearColor(cc0, ca0); CUT.r.value = cr; RAIN.m.visible = rv; ws.forEach(function (q, k) { q.m.visible = vis[k]; });
    FX.uRefl.value = REF.rt.texture; FX.uReflM.value.copy(REF.tm); FX.uReflOn.value = 1;
  }
  function render() { reflRender(); px.render(scene, cam); }
  var paused = /[?&]paused/.test(Q);
  // if the laptop or the TV cannot keep up, draw a little more simply: first leave out the reflections, then a step down in quality
  // (never when a quality was asked for in the address or chosen in the menu this time, and never under test)
  var PERF = { avg: 0.016, t: 0, noRefl: false, off: navigator.webdriver || /[?&](q|norefl|nowatchdog)\b/.test(Q) };
  function perfWatch(raw) {
    if (PERF.off || document.hidden || raw > 0.25) return;
    PERF.avg += (raw - PERF.avg) * 0.05; PERF.t += raw;
    if (PERF.t < 8 || PERF.avg < 0.045) return;
    PERF.t = 0; PERF.avg = 0.03;
    if (!PERF.noRefl && PKToon.FX.uReflOn.value) { PERF.noRefl = true; return; }
    var down = save.quality === 'high' ? 'medium' : save.quality === 'medium' ? 'low' : null;
    if (!down) { PERF.off = true; return; }
    setQuality(down); if (WATCH.on && WATCH.real) WATCH.real.quality = down; if (!EASY.on && !WATCH.on) toast('Drawing a little more simply, so it runs smoothly.', 4);
  }
  function frame() {
    requestAnimationFrame(frame);
    var raw = clock.getDelta(), dt = Math.min(raw, 0.05);
    if (!paused) { update(dt); render(); perfWatch(raw); }
  }

  // ---------------------------------------------------------------- start
  window.addEventListener('resize', resize);
  document.body.classList.toggle('easy', EASY.on); easyZoom(); marks('segEasy', EASY.on ? 'on' : 'off'); $('bEasy').setAttribute('aria-pressed', EASY.on ? 'true' : 'false'); $('bEasy').textContent = EASY.on ? 'Easy to see: on' : 'Easy to see: off';
  resize(); setMap(save.map); setPix(save.pix); setSound(save.sound); setVoice(!!save.voice); setMusic(save.music || 'normal'); counts(); markDet(); wallUpdate();
  reveal(P.x, P.z, 17);
  $('loadline').textContent = 'Ready when you are.';
  if (!$('intro').hidden) titleBegin();
  $('bStart').disabled = false; $('bStart').textContent = counts().f || counts().p ? 'Carry on' : 'Start';
  if (HASH === '#watch' || /[?&]watch/.test(Q)) $('bWatch').focus(); else $('bStart').focus();   // on the TV: press A, Enter or click, and it begins
  update(0.016); render();
  requestAnimationFrame(frame);

  // ---------------------------------------------------------------- for the next steps and for tests
  window.WWB = {
    ready: true, world: world, life: life, king: king, scene: scene, camera: cam, renderer: renderer, save: save, finds: FINDS, poems: POEMS, P: P, view: view,
    start: function () { titleEnd(); $('bStart').click(); }, title: TITLE, music: MUS, perf: { state: PERF, watch: function (raw) { perfWatch(raw); } },
    teleport: teleport,
    steer: function (x, y, run) { input.keys = {}; stick.on = !!(x || y); stick.x = x || 0; stick.y = y || 0; stick.run = !!run; },
    walkTo: function (x, z) { P.target = { x: x, z: z, run: false }; },
    act: act, jump: jump, turn: turn, zoom: zoomBy, setPix: setPix, tap: walkTo, setQuality: setQuality, quality: function () { return save.quality; },
    tris: function () { return { king: tris(king.root), valley: tris(world.group), all: tris(scene) }; },
    pause: function (on) { paused = on !== false; },
    step: function (sec, fps) { var h = 1 / (fps || 30); for (var t = 0; t < sec - 1e-6; t += h) update(h); render(); },
    tick: function (sec, fps) { var h = 1 / (fps || 30); for (var t = 0; t < sec - 1e-6; t += h) update(h); },
    render: render, openMap: openMap, reveal: reveal, blocked: blocked, sky: SKY, rest: function (seatId, target) { restSeat = SEATS.filter(function (q) { return q.id === seatId; })[0] || { x: P.x, z: P.z, y: P.y, face: P.yaw, label: 'here' }; rest(target); }, seats: SEATS, startStorm: function () { startStorm(); }, endStorm: function () { endStorm(); }, setHour: function (h) { SKY.hour = h; save.hour = h; }, openStudio: openStudio, journal: function () { journal(); openModal('journalVeil'); }, icon: icon, findObj: findObj, available: available, pickUp: pickUp, setWave: function (w) { save.wave = w; showFinds(); }, items: ITEMS,
    closeUp: closeUp, tilt: tilt, resetView: resetView, music: MUS, musicSets: SETS, voiceState: VOICE, rec: rec, recFor: recFor, speak: speak, poemRec: poemRec, speechBusy: speechBusy, musicScene: musicScene, skips: SKIPS, stone: STONE, skipStone: skipStone, nearSkip: nearSkip, noteSeen: noteSeen, field: FIELD, amb: AMB,
    ponder: ponder, say: say, voice: setVoice, PON: PON, easy: setEasy, EASY: EASY,
    watch: { start: watchStart, stop: watchStop, pause: watchPause, skip: watchSkip, state: WATCH, story: STORY },
    guide: { go: guideGo, stop: guideStop, plan: planRoute, next: nextGoal, state: GUIDE, nav: function () { if (!NAV) buildNav(); return NAV; }, lineOK: lineOK },
    photo: { open: photoOpen, close: photoClose, pose: photoPose, crown: setCrown, frame: function (f) { PHOTO.frame = f; marks('segFrame', f); }, shutter: shutter, state: PHOTO },
    ending: { start: startEnding, skip: function () { $('bSkip').click(); }, state: ENDING, cine: CINE, fire: FIRE, shadows: SH, inCave: inCave, ready: caveReady, page: endingPage, credits: credits, finish: endEnding }, ledge: ledgeProps,
    snap: function () { view.az = view.azGoal; view.el = view.elGoal; view.zoom = view.zoomGoal; king.root.updateMatrixWorld(true); camAim(view.tgt); applyCam(); placeCam(); world.ensure(view.tgt.x, view.tgt.z); render(); }
  };
})();
