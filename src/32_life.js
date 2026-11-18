     deer         white-tailed deer in the meadows at dusk and dawn; up go the white tails and away they bound
     cardinal     a red cardinal hopping about the trailhead, off into the bushes when he comes near
   const L = PKValleyLife.create(world, scene);  L.update(t, dt, { x, z, wading });  L.events -> things that just happened */
(function (global) {
  'use strict';
  var THREE = global.THREE;
  var LF = {};
  global.PKValleyLife = LF;
  var W = global.PKValley, PAINT = W.PAINT;
  PAINT.heron = ['#5d6c7c', '#8494a4', '#aab7c4']; PAINT.heronW = ['#c8c6c0', '#e8e6e0', '#f6f4ee']; PAINT.heronK = ['#2a2a2e', '#2a2a2e', '#3a3a40'];
  PAINT.beak = ['#b2761c', '#e0a030', '#f0c060']; PAINT.leg = ['#4a4238', '#5a5040', '#6a6050'];
  PAINT.shell = ['#2f4a30', '#4a6a3e', '#6a8a4e']; PAINT.tskin = ['#4a5a30', '#5a6a3a', '#7a8a4a']; PAINT.tstripe = ['#a89030', '#c8b040', '#e0c860'];
  PAINT.frog = ['#3f6b2f', '#5f8f3f', '#8fb85f']; PAINT.fish = ['#3f5a64', '#5d7c86', '#8d9a9a'];
  PAINT.dfly = ['#24508f', '#2f6fb8', '#5d93d8']; PAINT.dwing = ['#b8d4dc', '#d4e9ec', '#eef6f6'];
  PAINT.bfly = ['#b2561c', '#ea7a2a', '#ff9a45']; PAINT.bflyK = ['#231d1a', '#231d1a', '#3a2f2a'];
  // blue-winged teal: a warm brown speckled body, a slate-blue head with a white crescent, a pale blue wing patch
  PAINT.vult = ['#1e1a18', '#2c2622', '#3e3630']; PAINT.vultG = ['#6a645e', '#8a847c', '#a8a29a']; PAINT.vultH = ['#8a2a20', '#b0402e', '#c86048'];
  PAINT.owl = ['#4a3828', '#6e5238', '#927050']; PAINT.owlL = ['#9a8466', '#bfa883', '#d8c4a0']; PAINT.owlE = ['#f0c040', '#ffd860', '#ffe890'];
  PAINT.deer = ['#6e4a2e', '#946a42', '#b08458']; PAINT.deerW = ['#d8d2c4', '#f0ece2', '#fbf9f4']; PAINT.card = ['#8a1a16', '#c42a20', '#e84a36'];
  ['vult', 'vultG', 'vultH', 'owl', 'owlL', 'owlE', 'deer', 'deerW', 'card'].forEach(function (k) { PAINT[k].forEach(W.note); });
  PAINT.duck = ['#6a4a30', '#8a6440', '#a88058']; PAINT.duckH = ['#3e4a5e', '#56667e', '#76869c']; PAINT.duckW = ['#cfd8de', '#eef2f4', '#fbfdfe']; PAINT.duckB = ['#5d8fb8', '#7aaed6', '#9ac8ea'];
  ['heron', 'heronW', 'heronK', 'beak', 'leg', 'shell', 'tskin', 'tstripe', 'frog', 'fish', 'dfly', 'dwing', 'bfly', 'bflyK', 'duck', 'duckH', 'duckW', 'duckB'].forEach(function (k) { PAINT[k].forEach(W.note); });

  function mergeTwo(a, b) { var g = new THREE.BufferGeometry(), pa = a.attributes.position.array, pb = b.attributes.position.array, na = a.attributes.normal.array, nb = b.attributes.normal.array, P = new Float32Array(pa.length + pb.length), N = new Float32Array(na.length + nb.length); P.set(pa); P.set(pb, pa.length); N.set(na); N.set(nb, na.length); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.BufferAttribute(N, 3)); return g; }
  function mesh(geo, key, flat) { var m = new THREE.Mesh(geo, W.paint(key, { flat: flat })); m.castShadow = true; m.receiveShadow = true; return m; }
  function ell(rx, ry, rz, seg) { var g = new THREE.SphereGeometry(1, seg || 10, Math.max(6, Math.round((seg || 10) * 0.6))); g.scale(rx, ry, rz); return g; }
  function rnd(seed) { return function () { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function sst(a, b, x) { var t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function turnTo(cur, want, k) { var d = Math.atan2(Math.sin(want - cur), Math.cos(want - cur)); return cur + d * k; }

  LF.create = function (world, scene) {
    var R = rnd(91), grp = new THREE.Group(); grp.name = 'ValleyLife'; scene.add(grp);
    var events = [], S = world.spots;
    function waterAt(x, z) { var w = world.water(x, z); return w == null ? world.height(x, z) : w; }
    // which way is the water from a point on the bank (for frogs)
    function toWater(x, z) { var best = 0, bd = -1; for (var k = 0; k < 12; k++) { var a = k / 12 * 6.283, n = 0; for (var r = 0.3; r < 1.6; r += 0.3) if (world.water(x + Math.sin(a) * r, z + Math.cos(a) * r) != null) n++; if (n > bd) { bd = n; best = a; } } return best; }

    // ---------------- the great blue heron
    var heron = (function () {
      var g = new THREE.Group(); g.name = 'Heron';
      var body = new THREE.Group(); body.position.y = 0.62; g.add(body);
      body.add(mesh(ell(0.13, 0.11, 0.24), 'heron'));
      var tail = mesh(new THREE.ConeGeometry(0.07, 0.18, 5), 'heron', true); tail.rotation.x = -Math.PI / 2 - 0.3; tail.position.set(0, -0.02, -0.26); body.add(tail);
      var neck = new THREE.Group(); neck.position.set(0, 0.05, 0.16); body.add(neck);
      var n1 = mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.22, 7), 'heronW'); n1.position.set(0, 0.1, 0.02); n1.rotation.x = 0.35; neck.add(n1);
      var n2g = new THREE.Group(); n2g.position.set(0, 0.2, 0.06); neck.add(n2g);
      var n2 = mesh(new THREE.CylinderGeometry(0.03, 0.035, 0.2, 7), 'heronW'); n2.position.set(0, 0.09, -0.02); n2.rotation.x = -0.35; n2g.add(n2);
      var head = new THREE.Group(); head.position.set(0, 0.2, -0.03); n2g.add(head);
      head.add(mesh(ell(0.045, 0.045, 0.07), 'heronW'));
      var crest = mesh(new THREE.BoxGeometry(0.03, 0.02, 0.12), 'heronK'); crest.position.set(0, 0.03, -0.06); crest.rotation.x = 0.3; head.add(crest);
      var beak = mesh(new THREE.ConeGeometry(0.018, 0.16, 5), 'beak', true); beak.rotation.x = Math.PI / 2; beak.position.set(0, -0.005, 0.12); head.add(beak);
      var legs = [];
      [-1, 1].forEach(function (s) { var l = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.6, 5), 'leg'); l.position.set(s * 0.05, 0.31, 0.02); g.add(l); legs.push(l); });
      var wings = [];
      [-1, 1].forEach(function (s) {
        var wg = new THREE.Group(); wg.position.set(s * 0.1, 0.04, 0); body.add(wg);
        var w = mesh(new THREE.BoxGeometry(0.5, 0.02, 0.26), 'heron', true); w.position.set(s * 0.25, 0, 0); wg.add(w);
        var tip = mesh(new THREE.BoxGeometry(0.16, 0.022, 0.2), 'heronK', true); tip.position.set(s * 0.52, 0, -0.02); wg.add(tip);
        wg.visible = false; wings.push(wg);
      });
      grp.add(g);
      var h = { g: g, body: body, neck: neck, n2g: n2g, head: head, legs: legs, wings: wings, state: 'stand', t: 0, perch: 0, yaw: R() * 6, from: null, to: null, dur: 3, dip: 3 + R() * 4, startled: 0 };
      function place(i) { var p = S.perches[i]; h.perch = i; g.position.set(p[0], world.height(p[0], p[1]), p[1]); }
      place(0);
      return h;
    })();
    function heronUpdate(t, dt, k) {
      var h = heron, g = h.g, d = Math.hypot(g.position.x - k.x, g.position.z - k.z);
      h.t += dt;
      if (h.state === 'stand') {
        g.position.y = world.height(g.position.x, g.position.z);
        h.dip -= dt; var dipA = 0;
        if (h.dip < 0) { var u = -h.dip; dipA = Math.sin(Math.min(1, u / 0.9) * Math.PI); if (u > 0.9) h.dip = 4 + R() * 5; }
        h.neck.rotation.x = 0.6 * dipA; h.n2g.rotation.x = 0.9 * dipA; h.head.rotation.x = 0.3 * dipA;
        g.rotation.y = turnTo(g.rotation.y, h.yaw, dt * 1.5);
        if (d < 4.2) { h.state = 'alert'; h.t = 0; }
      } else if (h.state === 'alert') {
        h.neck.rotation.x *= 0.85; h.n2g.rotation.x = -0.25 * sst(0, 0.4, h.t); h.head.rotation.x = 0;
        g.rotation.y = turnTo(g.rotation.y, Math.atan2(k.x - g.position.x, k.z - g.position.z) + Math.PI * 0.4, dt * 3);
        if (d < 2.9 || h.t > 6) takeOff(k); else if (d > 5.2) { h.state = 'stand'; h.t = 0; }
      } else if (h.state === 'fly') {
        var u2 = clamp(h.t / h.dur, 0, 1), e = u2 * u2 * (3 - 2 * u2);
        var x = h.from.x + (h.to.x - h.from.x) * e, z = h.from.z + (h.to.z - h.from.z) * e;
        var y0 = h.from.y + (h.to.y - h.from.y) * e, lift = 3.2 * Math.sin(Math.PI * u2) * (u2 < 0.15 ? u2 / 0.15 : 1);
        g.position.set(x, y0 + lift, z);
        g.rotation.y = turnTo(g.rotation.y, Math.atan2(h.to.x - h.from.x, h.to.z - h.from.z), dt * 4);
        var flap = Math.sin(h.t * (u2 < 0.2 ? 13 : 8)) * (u2 > 0.88 ? 0.4 : 1);
        h.wings[0].rotation.z = 0.9 * flap; h.wings[1].rotation.z = -0.9 * flap;
        h.body.rotation.x = -0.15; h.n2g.rotation.x = 0.9; h.neck.rotation.x = 0.6;
        h.legs.forEach(function (l) { l.rotation.x = -1.2 * (1 - sst(0.8, 1, u2)); l.position.z = -0.15 * (1 - sst(0.8, 1, u2)) + 0.02; });
        if (u2 >= 1) { h.state = 'stand'; h.t = 0; h.wings.forEach(function (w) { w.visible = false; }); h.body.rotation.x = 0; h.yaw = R() * 6; h.dip = 2 + R() * 3; h.legs.forEach(function (l) { l.rotation.x = 0; l.position.z = 0.02; }); world.splash(g.position.x, g.position.z, 0.8); }
      }
    }
    function takeOff(k) {
      var h = heron, best = -1, bd = -1e9;
      S.perches.forEach(function (p, i) { if (i === h.perch) return; var dk = Math.hypot(p[0] - k.x, p[1] - k.z), dh = Math.hypot(p[0] - h.g.position.x, p[1] - h.g.position.z); var score = Math.min(dk, 18) - Math.abs(dh - 24) * 0.15 + R() * 3; if (dk > 9 && score > bd) { bd = score; best = i; } });
      if (best < 0) best = (h.perch + 1) % S.perches.length;
      var p = S.perches[best];
      h.from = { x: h.g.position.x, y: h.g.position.y, z: h.g.position.z }; h.to = { x: p[0], y: world.height(p[0], p[1]), z: p[1] };
      h.dur = 2.4 + Math.hypot(h.to.x - h.from.x, h.to.z - h.from.z) / 7; h.perch = best; h.state = 'fly'; h.t = 0;
      h.wings.forEach(function (w) { w.visible = true; });
      world.splash(h.from.x, h.from.z, 1.2);
      events.push({ type: 'heron', first: !h.startled++ });
    }

    // ---------------- turtles on the log at the pond's edge
    var TL = S.turtleLog, turtles = [];
    for (var i = 0; i < 3; i++) {
      var tg = new THREE.Group(); tg.name = 'Turtle' + i;
      tg.add(mesh(ell(0.11, 0.055, 0.13), 'shell', true));
      var rim = mesh(ell(0.12, 0.02, 0.14), 'tstripe'); rim.position.y = -0.02; tg.add(rim);
      var hd = mesh(ell(0.035, 0.03, 0.05), 'tskin'); hd.position.set(0, 0.0, 0.15); tg.add(hd);
      [[-1, 1], [1, 1], [-1, -1], [1, -1]].forEach(function (q) { var l = mesh(new THREE.BoxGeometry(0.04, 0.02, 0.05), 'tskin'); l.position.set(q[0] * 0.09, -0.025, q[1] * 0.08); tg.add(l); });
      var off = (i - 1) * 0.72, la = -TL.ang, ux = Math.cos(la), uz = Math.sin(la);
      var home = { x: TL.x + ux * off, z: TL.z + uz * off, y: TL.y + 0.18, yaw: Math.atan2(ux, uz) + (i % 2 ? Math.PI / 2 : -Math.PI / 2) + (R() - 0.5) * 0.6 };
      tg.position.set(home.x, home.y, home.z); tg.rotation.y = home.yaw; grp.add(tg);
      turtles.push({ g: tg, home: home, state: 'bask', t: 0, wait: 0, head: hd });
    }
    var turtleTold = false;
    function turtlesUpdate(t, dt, k) {
      turtles.forEach(function (tu, idx) {
        var d = Math.hypot(tu.home.x - k.x, tu.home.z - k.z); tu.t += dt;
        if (tu.state === 'bask') {
          tu.g.visible = true; tu.g.position.set(tu.home.x, tu.home.y, tu.home.z); tu.head.position.z = 0.15 + 0.02 * Math.sin(t * 0.7 + idx);
          if (d < 3.0 + idx * 0.4) { tu.state = 'plop'; tu.t = 0; if (!turtleTold) { turtleTold = true; events.push({ type: 'turtles' }); } }
        } else if (tu.state === 'plop') {
          var u = clamp(tu.t / 0.45, 0, 1), fw = Math.sin(tu.home.yaw), fz = Math.cos(tu.home.yaw);
          tu.g.position.set(tu.home.x + fw * 0.3 * u, tu.home.y - 0.35 * u * u, tu.home.z + fz * 0.3 * u); tu.g.rotation.x = 0.6 * u;
          if (u >= 1) { tu.state = 'under'; tu.t = 0; tu.wait = 7 + R() * 6; tu.g.visible = false; tu.g.rotation.x = 0; world.splash(tu.g.position.x, tu.g.position.z, 0.7); }
        } else if (tu.state === 'under') {
          if (tu.t > tu.wait && d > 5.5) { tu.state = 'climb'; tu.t = 0; tu.g.visible = true; }
        } else if (tu.state === 'climb') {
          var v = clamp(tu.t / 1.2, 0, 1), fw2 = Math.sin(tu.home.yaw), fz2 = Math.cos(tu.home.yaw);
          tu.g.position.set(tu.home.x + fw2 * 0.3 * (1 - v), tu.home.y - 0.12 * (1 - v), tu.home.z + fz2 * 0.3 * (1 - v));
          if (d < 3) { tu.state = 'plop'; tu.t = 0.3; }
          if (v >= 1) { tu.state = 'bask'; tu.t = 0; }
        }
      });
    }

    // ---------------- minnows in the pools
    var schools = [];
    S.pools.forEach(function (pl) {
      var fish = [];
      for (var q = 0; q < 9; q++) {
        var fg = new THREE.BoxGeometry(0.03, 0.012, 0.1).toNonIndexed(), tg2 = new THREE.BoxGeometry(0.045, 0.008, 0.03).toNonIndexed(); tg2.translate(0, 0, -0.062);
        var f = new THREE.Mesh(mergeTwo(fg, tg2), W.paint('fish')); f.castShadow = false; f.receiveShadow = false; grp.add(f);
        fish.push({ g: f, a: R() * 6.28, r: pl.r * (0.3 + R() * 0.7), sp: (0.6 + R() * 0.5) * (R() < 0.5 ? 1 : -1), ph: R() * 6, fx: 0, fz: 0 });
      }
      schools.push({ pool: pl, fish: fish, scared: 0, wl: null, wlT: 0 });
    });
    var minnowTold = false;
    function minnowsUpdate(t, dt, k) {
      schools.forEach(function (sc) {
        var pl = sc.pool, dk = Math.hypot(pl.x - k.x, pl.z - k.z);
        if (dk > 30) { sc.fish.forEach(function (f) { f.g.visible = false; }); return; }
        sc.wlT -= dt; if (sc.wlT <= 0 || sc.wl == null) { sc.wl = world.water(pl.x, pl.z); sc.wlT = 1; }
        var vis = sc.wl != null;
        if (k.wading > 0 && dk < pl.r + 1.6) { if (sc.scared <= 0 && !minnowTold) { minnowTold = true; events.push({ type: 'minnows' }); } sc.scared = 1.6; }
        sc.scared -= dt;
        sc.fish.forEach(function (f) {
          f.g.visible = vis; if (!vis) return;
          f.a += f.sp * dt * (sc.scared > 0 ? 3.2 : 1) / Math.max(0.3, f.r);
          var x = pl.x + Math.cos(f.a) * f.r, z = pl.z + Math.sin(f.a) * f.r * 0.7;
          if (sc.scared > 0) { var ax = x - k.x, az = z - k.z, L = Math.hypot(ax, az) || 1; f.fx += (ax / L * 0.8 - f.fx) * dt * 4; f.fz += (az / L * 0.8 - f.fz) * dt * 4; }
          else { f.fx *= 1 - dt * 1.5; f.fz *= 1 - dt * 1.5; }
          x += f.fx; z += f.fz;
          var px = f.g.position.x, pz = f.g.position.z; f.g.position.set(x, sc.wl + 0.012, z);
          if (Math.hypot(x - px, z - pz) > 1e-4) f.g.rotation.y = Math.atan2(x - px, z - pz);
          f.g.rotation.z = 0.25 * Math.sin(t * 14 + f.ph);
        });
      });
    }

    // ---------------- frogs at the water's edge
    var frogs = S.frogs.map(function (p, fi) {
      var g = new THREE.Group(); g.name = 'Frog' + fi;
      g.add(mesh(ell(0.05, 0.035, 0.06), 'frog', true));
      var hd = mesh(ell(0.035, 0.025, 0.035), 'frog', true); hd.position.set(0, 0.02, 0.045); g.add(hd);
      [-1, 1].forEach(function (s) { var e = mesh(new THREE.BoxGeometry(0.018, 0.018, 0.018), 'heronK'); e.position.set(s * 0.022, 0.042, 0.05); g.add(e); var lg = mesh(new THREE.BoxGeometry(0.03, 0.02, 0.07), 'frog'); lg.position.set(s * 0.05, -0.02, -0.03); g.add(lg); });
      var h = world.height(p[0], p[1]), toward = toWater(p[0], p[1]);
      g.position.set(p[0], h + 0.03, p[1]); g.rotation.y = toward; grp.add(g);
      return { g: g, home: { x: p[0], y: h + 0.03, z: p[1] }, state: 'sit', t: 0, wait: 0, yaw: toward };
    });
    var frogTold = false;
    function frogsUpdate(t, dt, k) {
      frogs.forEach(function (f) {
        var d = Math.hypot(f.home.x - k.x, f.home.z - k.z); f.t += dt;
        if (f.state === 'sit') {
          f.g.visible = true; f.g.position.set(f.home.x, f.home.y + 0.004 * Math.sin(t * 9 + f.home.x), f.home.z);
          if (d < 1.9) { f.state = 'hop'; f.t = 0; f.to = { x: f.home.x + Math.sin(f.yaw) * 0.9, z: f.home.z + Math.cos(f.yaw) * 0.9 }; f.g.rotation.y = f.yaw; if (!frogTold) { frogTold = true; events.push({ type: 'frog' }); } }
        } else if (f.state === 'hop') {
          var u = clamp(f.t / 0.5, 0, 1), wl = waterAt(f.to.x, f.to.z);
          f.g.position.set(f.home.x + (f.to.x - f.home.x) * u, f.home.y + (wl - f.home.y) * u + 0.45 * Math.sin(Math.PI * u), f.home.z + (f.to.z - f.home.z) * u);
          f.g.rotation.x = -0.5 + u;
          if (u >= 1) { f.state = 'gone'; f.t = 0; f.wait = 8 + R() * 8; f.g.visible = false; f.g.rotation.x = 0; world.splash(f.g.position.x, f.g.position.z, 0.5); }
        } else if (f.state === 'gone') {
          if (f.t > f.wait && d > 4) { f.state = 'sit'; f.t = 0; f.g.rotation.y = f.yaw; }
        }
      });
    }

    // ---------------- dragonflies
    var dflies = S.dragon.map(function (p, di) {
      var g = new THREE.Group(); g.name = 'Dragonfly' + di;
      g.add(mesh(new THREE.BoxGeometry(0.02, 0.02, 0.16), 'dfly'));
      var wings = new THREE.Group(); g.add(wings);
      var w1 = mesh(new THREE.BoxGeometry(0.22, 0.004, 0.035), 'dwing'); w1.position.z = 0.02; wings.add(w1);
      var w2 = mesh(new THREE.BoxGeometry(0.2, 0.004, 0.03), 'dwing'); w2.position.z = -0.02; wings.add(w2);
      g.traverse(function (o) { if (o.isMesh) o.castShadow = false; });
      grp.add(g);
      return { g: g, wings: wings, home: { x: p[0], z: p[1] }, pos: { x: p[0], z: p[1] }, tgt: { x: p[0], z: p[1] }, t: R() * 2, y: 0.5, follow: 0, cool: 0 };
    });
    function dfliesUpdate(t, dt, k) {
      dflies.forEach(function (d, di) {
        var near = Math.hypot(d.pos.x - k.x, d.pos.z - k.z);
        if (near > 40 && d.follow <= 0) { d.g.visible = false; return; } d.g.visible = true;
        d.t -= dt; d.cool -= dt;
        if (d.follow <= 0 && d.cool <= 0 && near < 2.2 && di % 2 === 0) d.follow = 5 + R() * 3;
        if (d.follow > 0) { d.follow -= dt; if (d.follow <= 0) d.cool = 12; }
        if (d.t <= 0) {
          d.t = 0.4 + R() * 1.3;
          if (d.follow > 0) { var a = R() * 6.28; d.tgt = { x: k.x + Math.cos(a) * 0.7, z: k.z + Math.sin(a) * 0.7 }; d.y = 1.3 + R() * 0.5; }
          else { var a2 = R() * 6.28, rr = R() * 2.4; d.tgt = { x: d.home.x + Math.cos(a2) * rr * 1.5, z: d.home.z + Math.sin(a2) * rr * 0.8 }; d.y = 0.25 + R() * 0.45; }
        }
        var kk = 1 - Math.exp(-dt * 6), px = d.pos.x, pz = d.pos.z;
        d.pos.x += (d.tgt.x - d.pos.x) * kk; d.pos.z += (d.tgt.z - d.pos.z) * kk;
        d.g.position.set(d.pos.x, waterAt(d.pos.x, d.pos.z) + d.y + 0.03 * Math.sin(t * 5 + di), d.pos.z);
        if (Math.hypot(d.pos.x - px, d.pos.z - pz) > 0.002) d.g.rotation.y = Math.atan2(d.pos.x - px, d.pos.z - pz);
        d.wings.scale.x = 0.6 + 0.4 * Math.abs(Math.sin(t * 40 + di));
      });
    }

    // ---------------- butterflies over the meadows
    var bflies = S.butterflies.map(function (p, bi) {
      var g = new THREE.Group(), wings = []; g.name = 'Butterfly' + bi;
      [-1, 1].forEach(function (s) { var wg = new THREE.Group(); g.add(wg); var w = mesh(new THREE.BoxGeometry(0.09, 0.006, 0.08), 'bfly'); w.position.x = s * 0.048; wg.add(w); var e = mesh(new THREE.BoxGeometry(0.02, 0.008, 0.08), 'bflyK'); e.position.x = s * 0.09; wg.add(e); wings.push(wg); });
      g.add(mesh(new THREE.BoxGeometry(0.014, 0.014, 0.06), 'bflyK'));
      g.traverse(function (o) { if (o.isMesh) o.castShadow = false; });
      grp.add(g);
      return { g: g, wings: wings, home: { x: p[0], z: p[1] }, ph: R() * 6, sp: 0.18 + R() * 0.1 };
    });
    function bfliesUpdate(t, dt, k) {
      bflies.forEach(function (b, bi) {
        if (Math.hypot(b.home.x - k.x, b.home.z - k.z) > 40) { b.g.visible = false; return; } b.g.visible = true;
        var a = t * b.sp + b.ph, x = b.home.x + Math.cos(a) * 2.6 + Math.sin(a * 2.3) * 0.8, z = b.home.z + Math.sin(a * 1.3) * 1.8;
        var dk = Math.hypot(x - k.x, z - k.z); if (dk < 1.2) { x += (x - k.x) / (dk || 1) * (1.2 - dk); z += (z - k.z) / (dk || 1) * (1.2 - dk); }
        var y = world.height(x, z) + 0.8 + 0.25 * Math.sin(t * 2.1 + bi) + 0.12 * Math.sin(t * 5.3), px = b.g.position.x, pz = b.g.position.z;
        b.g.position.set(x, y, z); b.g.rotation.y = Math.atan2(x - px, z - pz);
        var f = Math.sin(t * 18 + bi * 2); b.wings[0].rotation.z = 0.9 * f; b.wings[1].rotation.z = -0.9 * f;
      });
    }

    // ---------------- blue-winged teal
    function duck() {
      var g = new THREE.Group(); g.name = 'Teal';
      var body = mesh(ell(0.11, 0.065, 0.17), 'duck'); body.position.y = 0.035; g.add(body);
      var tail = mesh(new THREE.ConeGeometry(0.05, 0.1, 4), 'duck', true); tail.rotation.x = -Math.PI / 2 - 0.4; tail.position.set(0, 0.06, -0.17); g.add(tail);
      [-1, 1].forEach(function (s) { var wp = mesh(new THREE.BoxGeometry(0.02, 0.035, 0.08), 'duckB'); wp.position.set(s * 0.1, 0.06, -0.02); g.add(wp); });
      var head = new THREE.Group(); head.position.set(0, 0.13, 0.12); g.add(head);
      head.add(mesh(ell(0.055, 0.055, 0.065), 'duckH'));
      var cres = mesh(new THREE.BoxGeometry(0.075, 0.035, 0.012), 'duckW'); cres.position.set(0, 0.0, 0.06); cres.rotation.x = 0.4; head.add(cres);
      var bill = mesh(new THREE.BoxGeometry(0.035, 0.018, 0.06), 'heronK'); bill.position.set(0, -0.012, 0.085); head.add(bill);
      var neck = mesh(new THREE.CylinderGeometry(0.03, 0.04, 0.08, 6), 'duckH'); neck.position.set(0, 0.09, 0.1); neck.rotation.x = 0.3; g.add(neck);
      grp.add(g); return { g: g, head: head };
    }
    var ducks = [];
    S.ducks.forEach(function (sp, si) {
      var n = si === 0 ? 2 : 4;
      for (var q = 0; q < n; q++) { var d = duck(); d.home = sp; d.a = R() * 6.28; d.r = sp.r * (0.4 + R() * 0.6); d.sp = (0.14 + R() * 0.08) * (si === 0 ? 1 : (q % 2 ? 1 : -1)); d.flee = 0; d.ph = R() * 6; d.si = si; ducks.push(d); }
    });
    var duckTold = false;
    function ducksUpdate(t, dt, k) {
      ducks.forEach(function (d, di) {
        var h = d.home, dk = Math.hypot(h.x - k.x, h.z - k.z);
        if (dk > 36) { d.g.visible = false; return; }
        var wl = world.water(h.x, h.z); d.g.visible = wl != null; if (wl == null) return;
        var px = d.g.position.x, pz = d.g.position.z;
        if (Math.hypot(px - k.x, pz - k.z) < 2.0) { if (!d.flee && !duckTold) { duckTold = true; events.push({ type: 'teal' }); } d.flee = 2.5; }
        d.flee = Math.max(0, d.flee - dt);
        d.a += d.sp * dt * (d.flee > 0 ? 3 : 1) / Math.max(0.3, d.r);
        var x = h.x + Math.cos(d.a) * d.r, z = h.z + Math.sin(d.a) * d.r * (d.si === 0 ? 1.1 : 0.7);
        if (d.flee > 0) { var ax = x - k.x, az = z - k.z, L = Math.hypot(ax, az) || 1; x += ax / L * 0.4; z += az / L * 0.4; }
        d.g.position.set(x, wl + 0.004 * Math.sin(t * 3 + di), z);
        if (Math.hypot(x - px, z - pz) > 1e-4) d.g.rotation.y = Math.atan2(x - px, z - pz);
        d.head.rotation.x = Math.max(0, Math.sin(t * 0.7 + d.ph) - 0.85) * 4;
      });
    }

    // a skein of teal going over at dawn (the ending): a loose V, wings beating fast, the pale blue patch on each forewing showing
    var flock = null;
    // a flat wing panel from an outline (x out from the body, z forward), a little thickness so it draws from below too
    function wingGeo(pts, th) { var sh = new THREE.Shape(); pts.forEach(function (p, i) { if (i) sh.lineTo(p[0], p[1]); else sh.moveTo(p[0], p[1]); }); var g = new THREE.ExtrudeGeometry(sh, { depth: th, bevelEnabled: false }); g.rotateX(Math.PI / 2); g.translate(0, th / 2, 0); return g; }
    function flyer() {
      var g = new THREE.Group(); g.name = 'TealFlying';
      var body = mesh(ell(0.085, 0.07, 0.2, 10), 'duck'); g.add(body);
      var neck = mesh(new THREE.CylinderGeometry(0.035, 0.05, 0.12, 6), 'duckH'); neck.rotation.x = Math.PI / 2 - 0.15; neck.position.set(0, 0.02, 0.2); g.add(neck);
      var head = mesh(ell(0.045, 0.045, 0.06, 8), 'duckH'); head.position.set(0, 0.035, 0.28); g.add(head);
      var cres = mesh(new THREE.BoxGeometry(0.06, 0.03, 0.01), 'duckW'); cres.position.set(0, 0.035, 0.335); g.add(cres);
      var bill = mesh(new THREE.BoxGeometry(0.03, 0.014, 0.05), 'heronK'); bill.position.set(0, 0.03, 0.36); g.add(bill);
      var tail = mesh(new THREE.ConeGeometry(0.05, 0.12, 4), 'duck', true); tail.rotation.x = -Math.PI / 2; tail.position.set(0, 0.0, -0.22); g.add(tail);
      // each wing in two parts: the inner wing (with the pale blue forewing patch on top) and the pointed outer wing, which lags behind it
      var wings = [-1, 1].map(function (s) {
        var w = new THREE.Group(); w.position.set(s * 0.06, 0.03, 0.04); g.add(w);
        w.add(mesh(wingGeo([[0, 0.07], [s * 0.2, 0.05], [s * 0.2, -0.06], [0, -0.1]], 0.012), 'duck'));
        var patch = mesh(wingGeo([[s * 0.02, 0.055], [s * 0.18, 0.04], [s * 0.18, 0.0], [s * 0.02, 0.005]], 0.006), 'duckB'); patch.position.y = 0.01; w.add(patch);
        var outer = new THREE.Group(); outer.position.x = s * 0.2; w.add(outer);
        outer.add(mesh(wingGeo([[0, 0.05], [s * 0.24, -0.04], [s * 0.26, -0.07], [0, -0.06]], 0.01), 'duck'));
        w.side = s; w.outer = outer; return w;
      });
      g.scale.setScalar(1.5); g.traverse(function (o) { if (o.isMesh) o.castShadow = false; });
      grp.add(g); return { g: g, wings: wings };
    }
    // flyOver(x0, z0, x1, z1, y, dur): a straight pass; or flyOver(points, dur), points [[x, y, z], ...] for a curved one, with the
    // flock banking into its turns (so the blue on their wings shows as they turn) and each bird keeping its place in a loose V
    function flyOver(x0, z0, x1, z1, y, dur) {
      if (!flock) { flock = []; for (var i = 0; i < 11; i++) flock.push(flyer()); }
      var pts = Array.isArray(x0) ? x0 : [[x0, y, z0], [x1, y, z1]], d = Array.isArray(x0) ? z0 : dur;
      var curve = new THREE.CatmullRomCurve3(pts.map(function (p) { return new THREE.Vector3(p[0], p[1], p[2]); }), false, 'centripetal');
      flock.forEach(function (b, i) {
        var row = Math.ceil(i / 2), side = i === 0 ? 0 : (i % 2 ? -1 : 1);
        b.row = row; b.side = side; b.lag = row * 0.012 + (R() - 0.5) * 0.004; b.dy = (R() - 0.5) * 0.35; b.ph = R() * 6; b.g.visible = true;
      });
      flock.run = { curve: curve, dur: d, t: 0, prevYaw: null, bank: 0 };
    }
    var _fp = new THREE.Vector3(), _ft = new THREE.Vector3(), _ft2 = new THREE.Vector3();
    function flockUpdate(t, dt) {
      if (!flock || !flock.run) return;
      var r = flock.run; r.t += dt; var u = r.t / r.dur;
      if (u >= 1.08) { flock.forEach(function (b) { b.g.visible = false; }); flock.run = null; return; }
      flock.forEach(function (b, i) {
        var ub = Math.max(0, Math.min(1, u - b.lag));
        r.curve.getPointAt(ub, _fp); r.curve.getTangentAt(ub, _ft); r.curve.getTangentAt(Math.min(1, ub + 0.02), _ft2);
        var yaw = Math.atan2(_ft.x, _ft.z), yaw2 = Math.atan2(_ft2.x, _ft2.z), turn = Math.atan2(Math.sin(yaw2 - yaw), Math.cos(yaw2 - yaw));
        // the V: each bird sits back and to one side of the leader, across the line of flight
        var bx = -_ft.x * b.row * 0.0 + _ft.z * b.side * b.row * 0.8, bz = -_ft.z * b.row * 0.0 - _ft.x * b.side * b.row * 0.8;
        b.g.position.set(_fp.x + bx, _fp.y + b.dy + 0.1 * Math.sin(t * 1.3 + i), _fp.z + bz);
        b.g.rotation.set(-_ft.y * 0.8, yaw, Math.max(-0.9, Math.min(0.9, -turn * 14)), 'YXZ');
        b.g.visible = u - b.lag < 1;
        var f = Math.sin(t * 13 + b.ph), f2 = Math.sin(t * 13 + b.ph - 0.9);
        b.wings.forEach(function (w) { w.rotation.z = w.side * (0.15 + f * 0.6); w.outer.rotation.z = w.side * f2 * 0.45; });
      });
    }

    // ---------------- turkey vultures: three, circling on the warm air by day; k.hour and k.storm come from the game
    function vulture() {
      var g = new THREE.Group(); g.name = 'Vulture';
      g.add(mesh(ell(0.12, 0.09, 0.32, 8), 'vult'));
      var head = mesh(ell(0.05, 0.05, 0.07, 6), 'vultH'); head.position.set(0, 0.02, 0.33); g.add(head);
      var tail = mesh(new THREE.BoxGeometry(0.2, 0.02, 0.22), 'vult'); tail.position.set(0, 0, -0.38); g.add(tail);
      var wings = [-1, 1].map(function (s) {
        var w = new THREE.Group(); w.position.set(s * 0.1, 0.03, 0.02); g.add(w);
        var a = mesh(new THREE.BoxGeometry(0.95, 0.025, 0.36), 'vult'); a.position.x = s * 0.48; w.add(a);
        var under = mesh(new THREE.BoxGeometry(0.85, 0.012, 0.16), 'vultG'); under.position.set(s * 0.5, -0.02, -0.1); w.add(under);
        for (var f = 0; f < 4; f++) { var p = mesh(new THREE.BoxGeometry(0.2, 0.015, 0.05), 'vult'); p.position.set(s * (0.98 + f * 0.02), 0, 0.12 - f * 0.08); p.rotation.y = s * (0.15 - f * 0.12); w.add(p); }
        w.rotation.z = s * 0.22; w.side = s; return w;
      });
      g.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = false; } }); g.visible = false; grp.add(g);
      g.scale.setScalar(1.25);
      return { g: g, wings: wings, a: R() * 6.28, r: 6 + R() * 5, hgt: 3.8 + R() * 2.2, sp: 0.16 + R() * 0.06, ph: R() * 6, cx: 0, cz: 0 };
    }
    var vultures = [vulture(), vulture(), vulture()], vcx = null;
    function vulturesUpdate(t, dt, k) {
      var h = k.hour == null ? 12 : ((k.hour % 24) + 24) % 24, on = h > 9.2 && h < 17.6 && !k.storm;
      var cd = k.camDir || [0, 1], ox = k.x + cd[0] * 5.5, oz = k.z + cd[1] * 5.5;
      if (vcx == null || Math.hypot(vcx[0] - ox, vcx[1] - oz) > 30) vcx = [ox, oz];
      vcx[0] += (ox + 4 * Math.sin(t * 0.02) - vcx[0]) * dt * 0.1; vcx[1] += (oz - vcx[1]) * dt * 0.1;
      vultures.forEach(function (v, i) {
        v.g.visible = on; if (!on) return;
        v.a += v.sp * dt * (i % 2 ? -1 : 1);
        var x = vcx[0] + Math.cos(v.a) * v.r + 3 * Math.sin(t * 0.05 + i * 2), z = vcx[1] + Math.sin(v.a) * v.r, y = world.height(x, z) + v.hgt + 0.8 * Math.sin(t * 0.3 + v.ph);
        // heading along the circle (the odd ones circle the other way), banked into the turn
        var dir = i % 2 ? -1 : 1, yaw = dir > 0 ? -v.a : Math.PI - v.a;
        v.g.position.set(x, y, z); v.g.rotation.set(0.05 * Math.sin(t * 0.7 + v.ph), yaw, -0.3 * dir, 'YXZ');
        // the teeter: a turkey vulture rocks side to side as it soars, wings held up in a shallow V
        v.g.rotation.z += 0.18 * Math.sin(t * 0.9 + v.ph);
        v.wings.forEach(function (w) { w.rotation.z = w.side * (0.24 + 0.04 * Math.sin(t * 0.9 + v.ph)); });
      });
    }
    // ---------------- a great horned owl on the trestle, only at night
    var owl = (function () {
      var g = new THREE.Group(); g.name = 'Owl';
      g.add(at(mesh(ell(0.16, 0.24, 0.14, 10), 'owl'), 0, 0.24, 0)); g.add(at(mesh(ell(0.1, 0.15, 0.06, 8), 'owlL'), 0, 0.2, 0.09));
      var head = new THREE.Group(); head.position.set(0, 0.5, 0.01); g.add(head);
      head.add(mesh(ell(0.13, 0.11, 0.11, 10), 'owl'));
      head.add(at(mesh(ell(0.09, 0.07, 0.03, 8), 'owlL'), 0, -0.01, 0.085));
      [-1, 1].forEach(function (s) { var eye = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.035, 0.02), W.paint('owlE', { glow: true })); eye.position.set(s * 0.045, 0.01, 0.105); head.add(eye); var t = mesh(new THREE.ConeGeometry(0.03, 0.1, 4), 'owl', true); t.position.set(s * 0.07, 0.11, 0); t.rotation.z = -s * 0.35; head.add(t); });
      head.add(at(mesh(new THREE.ConeGeometry(0.015, 0.04, 4), 'heronK', true), 0, -0.035, 0.11, Math.PI, 0, 0));
      g.scale.setScalar(1.35); g.traverse(function (o) { if (o.isMesh) { o.castShadow = true; } });
      g.visible = false; grp.add(g); return { g: g, head: head, gone: 0, hoot: 6, look: 0, lookT: 2 };
    })();
    function at(m, x, y, z, rx, ry, rz) { m.position.set(x || 0, y || 0, z || 0); m.rotation.set(rx || 0, ry || 0, rz || 0); return m; }
    var OWLAT = S.trestle ? { x: S.trestle.x + 1.05, z: S.trestle.z - 1.5 } : null;
    function owlUpdate(t, dt, k) {
      if (!OWLAT) return; var h = k.hour == null ? 12 : ((k.hour % 24) + 24) % 24, night = h > 20.4 || h < 5.6, d = Math.hypot(OWLAT.x - k.x, OWLAT.z - k.z);
      if (owl.gone > 0) owl.gone -= dt;
      owl.g.visible = night && owl.gone <= 0 && !k.storm && d < 40; if (!owl.g.visible) return;
      owl.g.position.set(OWLAT.x, world.height(OWLAT.x, OWLAT.z, 99) + 0.06, OWLAT.z);
      if (d < 3.2) { owl.gone = 90; events.push({ type: 'owl' }); return; }
      owl.g.rotation.y = Math.atan2(k.x - OWLAT.x, k.z - OWLAT.z) * 0.3 + Math.PI * 0.5;
      owl.lookT -= dt; if (owl.lookT <= 0) { owl.lookT = 2 + Math.random() * 4; owl.look = (Math.random() - 0.5) * 2.6; }
      owl.head.rotation.y += (owl.look - owl.head.rotation.y) * Math.min(1, dt * 3);
      owl.hoot -= dt; if (owl.hoot <= 0 && d < 28) { owl.hoot = 9 + Math.random() * 12; events.push({ type: 'hoot', near: d }); }
    }
    // ---------------- white-tailed deer at dusk and dawn, grazing in the meadow; they bound off when he comes near
    function deerMesh(sc) {
      var g = new THREE.Group(); g.name = 'Deer';
      var body = new THREE.Group(); g.add(body);
      body.add(at(mesh(ell(0.2, 0.22, 0.5, 10), 'deer'), 0, 0.85, 0));
      body.add(at(mesh(ell(0.12, 0.08, 0.3, 8), 'deerW'), 0, 0.72, 0.02));
      var neck = new THREE.Group(); neck.position.set(0, 0.95, 0.38); body.add(neck);
      neck.add(at(mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.42, 6), 'deer'), 0, 0.15, 0.06, 0.5, 0, 0));
      var head = new THREE.Group(); head.position.set(0, 0.36, 0.18); neck.add(head);
      head.add(at(mesh(ell(0.08, 0.08, 0.16, 8), 'deer'), 0, 0, 0.05)); head.add(at(mesh(new THREE.BoxGeometry(0.05, 0.04, 0.06), 'heronK'), 0, -0.02, 0.2));
      [-1, 1].forEach(function (s) { var e = mesh(ell(0.03, 0.08, 0.02, 6), 'deer'); e.position.set(s * 0.08, 0.09, -0.02); e.rotation.z = s * 0.5; head.add(e); });
      var tail = mesh(ell(0.06, 0.12, 0.04, 6), 'deerW'); tail.position.set(0, 0.95, -0.5); body.add(tail);
      var legs = [[-0.1, 0.32], [0.1, 0.32], [-0.1, -0.34], [0.1, -0.34]].map(function (q) { var l = new THREE.Group(); l.position.set(q[0], 0.72, q[1]); body.add(l); l.add(at(mesh(new THREE.BoxGeometry(0.045, 0.72, 0.05), 'deer'), 0, -0.36, 0)); return l; });
      g.scale.setScalar(sc); g.traverse(function (o) { if (o.isMesh) o.castShadow = true; }); g.visible = false; grp.add(g);
      return { g: g, neck: neck, tail: tail, legs: legs, body: body };
    }
    var HERD = S.herd || { x: -30, z: 33 };
    var deer = [0, 1, 2].map(function (i) { var d = deerMesh(i === 0 ? 1.05 : 0.85 + R() * 0.1); d.hx = HERD.x + (R() - 0.5) * 6; d.hz = HERD.z + (R() - 0.5) * 5; d.yaw = R() * 6.28; d.graze = R() * 4; d.flee = 0; d.away = 0; d.ph = R() * 6; return d; });
    var deerTold = false;
    function deerUpdate(t, dt, k) {
      var h = k.hour == null ? 12 : ((k.hour % 24) + 24) % 24, on = (h > 17.6 && h < 20.8) || (h > 5.8 && h < 8.6);
      deer.forEach(function (d, i) {
        if (!on || k.storm) { d.g.visible = false; d.flee = 0; d.away = 0; return; }
        if (d.away > 0) { d.away -= dt; if (d.away <= 0) { d.hx = HERD.x + (R() - 0.5) * 6; d.hz = HERD.z + (R() - 0.5) * 5; } d.g.visible = false; return; }
        d.g.visible = true;
        var dk = Math.hypot(d.hx - k.x, d.hz - k.z);
        if (dk < 5.5 && !d.flee) { d.flee = 2.6; d.fx = (d.hx - k.x) / (dk || 1); d.fz = (d.hz - k.z) / (dk || 1); d.yaw = Math.atan2(d.fx, d.fz); if (!deerTold) { deerTold = true; events.push({ type: 'deer' }); } }
        if (d.flee > 0) {
          // bounding: a leap every half second, tail up and white
          d.flee -= dt; d.hx += d.fx * dt * 6.5; d.hz += d.fz * dt * 6.5;
          var u = (t * 2.2 + i * 0.3) % 1, hop = Math.sin(u * Math.PI) * 0.55;
          d.g.position.set(d.hx, world.height(d.hx, d.hz) + hop, d.hz); d.g.rotation.set(0, d.yaw, 0);
          d.body.rotation.x = -0.25 * Math.cos(u * Math.PI * 2); d.tail.rotation.x = -1.4; d.tail.position.y = 1.05; d.neck.rotation.x = -0.2;
          d.legs.forEach(function (l, q) { l.rotation.x = (q < 2 ? -1 : 1) * 0.9 * Math.sin(u * Math.PI); });
          if (d.flee <= 0) d.away = 50 + R() * 30;
          return;
        }
        // grazing: head down for a while, then up, looking about; a slow step now and then
        d.graze -= dt; if (d.graze <= 0) { d.graze = 3 + R() * 6; d.up = !d.up; if (!d.up) { d.yaw += (R() - 0.5) * 1.4; } }
        if (!d.up) { d.hx += Math.sin(d.yaw) * dt * 0.08; d.hz += Math.cos(d.yaw) * dt * 0.08; }
        d.g.position.set(d.hx, world.height(d.hx, d.hz), d.hz); d.g.rotation.set(0, d.yaw, 0); d.body.rotation.x = 0;
        d.neck.rotation.x += ((d.up ? -0.15 : 1.05) - d.neck.rotation.x) * Math.min(1, dt * 2.5);
        d.tail.rotation.x = 0.2 * Math.max(0, Math.sin(t * 3 + d.ph) - 0.6); d.tail.position.y = 0.95;
        d.legs.forEach(function (l, q) { l.rotation.x = d.up ? 0 : 0.12 * Math.sin(t * 2 + q * 1.6); });
      });
    }
    // ---------------- a cardinal about the trailhead by day: hops, pecks, and flits off to the bushes
    var CARDAT = S.studio ? { x: S.studio.x + 5.5, z: S.studio.z - 3.5 } : null;
    var card = (function () {
      var g = new THREE.Group(); g.name = 'Cardinal';
      g.add(at(mesh(ell(0.045, 0.045, 0.07, 8), 'card'), 0, 0.06, 0)); g.add(at(mesh(ell(0.035, 0.035, 0.035, 6), 'card'), 0, 0.11, 0.05));
      var crest = mesh(new THREE.ConeGeometry(0.02, 0.06, 4), 'card', true); crest.position.set(0, 0.155, 0.03); crest.rotation.x = -0.5; g.add(crest);
      g.add(at(mesh(new THREE.ConeGeometry(0.016, 0.035, 4), 'fyel', true), 0, 0.105, 0.09, Math.PI / 2, 0, 0));
      g.add(at(mesh(new THREE.BoxGeometry(0.04, 0.012, 0.08), 'card'), 0, 0.07, -0.08, 0.3, 0, 0));
      g.scale.setScalar(1.6); g.traverse(function (o) { if (o.isMesh) o.castShadow = true; }); g.visible = false; grp.add(g);
      return { g: g, x: 0, z: 0, hopT: 1, away: 0 };
    })();
    if (CARDAT) { card.x = CARDAT.x; card.z = CARDAT.z; }
    function cardUpdate(t, dt, k) {
      if (!CARDAT) return; var h = k.hour == null ? 12 : ((k.hour % 24) + 24) % 24, on = h > 6.5 && h < 19 && !k.storm;
      if (card.away > 0) { card.away -= dt; card.g.visible = false; return; }
      card.g.visible = on; if (!on) return;
      var dk = Math.hypot(card.x - k.x, card.z - k.z); if (dk < 2.2) { card.away = 25; card.x = CARDAT.x + (R() - 0.5) * 4; card.z = CARDAT.z + (R() - 0.5) * 3; events.push({ type: 'cardinal' }); return; }
      card.hopT -= dt; var hop = 0;
      if (card.hopT <= 0) { card.hopT = 0.6 + R() * 1.8; var a = R() * 6.28; card.tx = card.x + Math.cos(a) * 0.35; card.tz = card.z + Math.sin(a) * 0.35; card.hs = 0; }
      if (card.tx != null && card.hs < 1) { card.hs = Math.min(1, card.hs + dt * 4); var px = card.x, pz = card.z; card.x += (card.tx - card.x) * card.hs; card.z += (card.tz - card.z) * card.hs; hop = Math.sin(card.hs * Math.PI) * 0.08; if (Math.hypot(card.x - px, card.z - pz) > 1e-4) card.g.rotation.y = Math.atan2(card.x - px, card.z - pz); }
      card.g.position.set(card.x, world.height(card.x, card.z) + hop, card.z);
      card.g.rotation.x = card.hopT > 0.4 && Math.sin(t * 5) > 0.7 ? 0.5 : 0;   // a peck
    }

    return {
      group: grp, heron: heron, turtles: turtles, frogs: frogs, ducks: ducks, events: events, flyOver: flyOver, vultures: vultures, owl: owl, deer: deer, cardinal: card,
      flying: function () { return !!(flock && flock.run); },
      update: function (t, dt, k) { heronUpdate(t, dt, k); turtlesUpdate(t, dt, k); minnowsUpdate(t, dt, k); frogsUpdate(t, dt, k); dfliesUpdate(t, dt, k); bfliesUpdate(t, dt, k); ducksUpdate(t, dt, k); flockUpdate(t, dt); vulturesUpdate(t, dt, k); owlUpdate(t, dt, k); deerUpdate(t, dt, k); cardUpdate(t, dt, k); }
    };
  };
})(typeof window !== 'undefined' ? window : globalThis);

;
/* What the Water Brings: the Philosopher King (the Sheet king pixel model) walks a creek valley the morning after a storm.