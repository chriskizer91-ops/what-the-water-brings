/* =====================================================================================================================
   PKNature: the valley's own sounds (Nov 19 2026)
   Every animal, insect, frog, the water, the wind and the weather, made from tones and noise, so that the game needs
   no recordings and every sound is made the same way. Used by the game and by the sound board (soundboard.html), so
   what is heard on the board is exactly what is heard in the valley.

   The one thing that keeps them sounding like one place: every sound goes through the same chain:
     the sound -> air (a low-pass that closes with distance) -> level (falls 6 dB each time the distance doubles past 8 m)
               -> left/right -> the valley, plus a share sent to one shared valley echo (more of it the farther away)
   and each sound's level is set from measurement (LEVEL, in dB), so none stands out from the rest.

   PKNature.make(ctx, dest) -> N
     N.call(id, { dist, pan, when, gain })    one call or event (a cardinal's song, a deer's snort, a clap of thunder)
     N.bed(id).set(level, params)            a sound that goes on (the creek, the wind, rain, crickets, katydids, fire)
     N.amb.update(dt, state)                 the valley left to itself: which sounds, how often, by the hour and place
     N.user[id] = { gain, on }               the board's settings (gain 0 to 2, on or off)
     N.legacy(id)                            the old version of a sound, as the game had it before (for comparing)
   PKNature.META lists every sound: id, name, group, where, kind ('call' or 'bed'), old (has an old version).
   ===================================================================================================================== */
(function (global) {
  'use strict';
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function db(x) { return Math.pow(10, x / 20); }

  // what each sound is, where it lives, and how it is grouped on the board
  var META = [
    // birds by day
    { id: 'cardinal', name: 'Northern cardinal', group: 'Birds by day', where: 'In the trees about the trailhead, all day; most at dawn.', old: true },
    { id: 'wren', name: 'Carolina wren', group: 'Birds by day', where: 'In the brush, all day. Small bird, very loud song.', old: true },
    { id: 'chickadee', name: 'Carolina chickadee', group: 'Birds by day', where: 'In the trees, all day.', old: true },
    { id: 'dove', name: 'Mourning dove', group: 'Birds by day', where: 'Far off, morning and evening.', old: true },
    { id: 'swallows', name: 'Swallows', group: 'Birds by day', where: 'Low over the meadow and the water, now and then.' },
    { id: 'roadrunner', name: 'Greater roadrunner', group: 'Birds by day', where: 'Down the county road, now and then by day.' },
    { id: 'teal', name: 'Blue-winged teal', group: 'Birds by day', where: 'On the stock pond and the spring pool.' },
    { id: 'heron', name: 'Great blue heron', group: 'Birds by day', where: 'When the heron takes off from a pool.' },
    { id: 'hawk', name: 'Red-tailed hawk', group: 'Birds by day', where: 'High over the valley, rarely.' },
    // insects and frogs
    { id: 'cicada', name: 'Cicadas', group: 'Insects and frogs', where: 'Up in the trees on the hot afternoons.' },
    { id: 'crickets', name: 'Field crickets', group: 'Insects and frogs', where: 'In the grass, evening and all night.', kind: 'bed', old: true },
    { id: 'katydids', name: 'Katydids', group: 'Insects and frogs', where: 'In the trees at night.', kind: 'bed' },
    { id: 'cricketfrog', name: 'Cricket frogs', group: 'Insects and frogs', where: 'Along the creek banks; most in the evening.' },
    { id: 'treefrog', name: 'Green tree frog', group: 'Insects and frogs', where: 'By the water, evening and night; many after the storm.', old: true },
    { id: 'leopard', name: 'Leopard frog', group: 'Insects and frogs', where: 'On the banks, close to the water, by day.' },
    { id: 'bullfrog', name: 'Bullfrog', group: 'Insects and frogs', where: 'At the stock pond, evening and night.' },
    // at night
    { id: 'owl', name: 'Great horned owl', group: 'At night', where: 'On the trestle and in the far trees; sometimes a second one answers.', old: true },
    { id: 'chuck', name: "Chuck-will's-widow", group: 'At night', where: 'Far off, after dark and before dawn.' },
    { id: 'coyote', name: 'Coyotes', group: 'At night', where: 'Very far off, once in a long while. Off in the game unless you turn it on.', off: true },
    // animals moving
    { id: 'deer', name: 'Deer snort and bound away', group: 'Animals moving', where: 'When the deer see him coming.' },
    { id: 'armadillo', name: 'Armadillo in the leaves', group: 'Animals moving', where: 'Along the trail, evening and night.' },
    { id: 'splash', name: 'Bass jumping', group: 'Animals moving', where: 'In the Blue Hole.' },
    { id: 'plop', name: 'Turtle slides in', group: 'Animals moving', where: 'Off the log at the stock pond, and a skipped stone sinking.' },
    // water, wind and weather
    { id: 'creek', name: 'The creek', group: 'Water, wind and weather', where: 'Whenever he is near the water; louder and wilder in the flood.', kind: 'bed', old: true },
    { id: 'wind', name: 'Wind in the leaves', group: 'Water, wind and weather', where: 'Always, softly; hard in the storm.', kind: 'bed' },
    { id: 'rain', name: 'Rain', group: 'Water, wind and weather', where: 'The storm.', kind: 'bed', old: true },
    { id: 'thunder', name: 'Thunder', group: 'Water, wind and weather', where: 'The storm: near, then farther off.', old: true },
    { id: 'falls', name: 'The Dry Falls running', group: 'Water, wind and weather', where: 'After the storm, when the Dry Fork pours over the falls.', kind: 'bed' },
    { id: 'fire', name: 'The fire in the cave', group: 'Water, wind and weather', where: 'The ending.', kind: 'bed' }
  ];
  var BYID = {}; META.forEach(function (m) { m.kind = m.kind || 'call'; BYID[m.id] = m; });

  // each sound's level, in dB, set from measuring them all (tools/nature_measure.py) so that, at the distance it is usually
  // heard from, none stands out from the rest. Raise or lower one here, or with the board's slider.
  var LEVEL = {
    cardinal: -15.2, wren: -14.2, chickadee: -15.9, dove: -16.7, swallows: -15.8, roadrunner: -13.6, teal: -8.4, heron: -9.9,
    hawk: -7.9, cicada: -10.3, crickets: -30.2, katydids: -12.9, cricketfrog: -16.5, treefrog: -13.4, leopard: -18.1, bullfrog: -20.9,
    owl: -17.0, chuck: -12.8, coyote: -12.2, deer: -19.1, armadillo: -19.0, splash: -14.9, plop: -14.8, creek: -16.1,
    wind: -7.5, rain: -15.1, thunder: -13.1, falls: -16.3, fire: -20.0
  };
  // how far away each is usually heard from in the valley, in metres: [nearest, farthest]
  var RANGE = {
    cardinal: [14, 45], wren: [10, 40], chickadee: [12, 40], dove: [35, 90], swallows: [8, 25], roadrunner: [30, 80], teal: [15, 45], heron: [10, 30], hawk: [90, 180],
    cicada: [20, 70], cricketfrog: [6, 25], treefrog: [10, 35], leopard: [4, 14], bullfrog: [15, 50],
    owl: [25, 70], chuck: [70, 160], coyote: [400, 800], deer: [8, 16], armadillo: [3, 7], splash: [6, 18], plop: [6, 16], thunder: [300, 3000]
  };

  function curveOf(pts, n, log) {
    var c = new Float32Array(n), j = 0;
    for (var i = 0; i < n; i++) {
      var u = n === 1 ? 0 : i / (n - 1);
      while (j < pts.length - 2 && u > pts[j + 1][0]) j++;
      var a = pts[j], b = pts[j + 1] || a, f = b[0] === a[0] ? 0 : clamp((u - a[0]) / (b[0] - a[0]), 0, 1);
      c[i] = log ? Math.exp(Math.log(Math.max(1e-4, a[1])) + (Math.log(Math.max(1e-4, b[1])) - Math.log(Math.max(1e-4, a[1]))) * f) : a[1] + (b[1] - a[1]) * f;
    }
    return c;
  }
  function scaled(c, k) { var o = new Float32Array(c.length); for (var i = 0; i < c.length; i++) o[i] = c[i] * k; return o; }

  function noiseBuf(ctx, kind, sec) {
    var n = Math.round(ctx.sampleRate * sec), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    var b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0, last = 0;
    for (var i = 0; i < n; i++) {
      var w = Math.random() * 2 - 1;
      if (kind === 'white') d[i] = w * 0.5;
      else if (kind === 'pink') {   // Paul Kellet's filter
        b0 = 0.99886 * b0 + w * 0.0555179; b1 = 0.99332 * b1 + w * 0.0750759; b2 = 0.969 * b2 + w * 0.153852; b3 = 0.8665 * b3 + w * 0.3104856;
        b4 = 0.55 * b4 + w * 0.5329522; b5 = -0.7616 * b5 - w * 0.016898; d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11; b6 = w * 0.115926;
      } else { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
    }
    // smooth the loop point
    var m = Math.min(2000, n >> 3); for (var k = 0; k < m; k++) { var f = k / m; d[n - m + k] = d[n - m + k] * (1 - f) + d[k] * f; }
    return b;
  }
  // the valley's echo: a short, soft, darkening tail with a few reflections off the bluff
  function makeIR(ctx, sec) {
    var n = Math.round(ctx.sampleRate * sec), b = ctx.createBuffer(2, n, ctx.sampleRate);
    for (var ch = 0; ch < 2; ch++) {
      var d = b.getChannelData(ch), y = 0;
      for (var i = 0; i < n; i++) {
        var t = i / ctx.sampleRate, x = (Math.random() * 2 - 1) * Math.exp(-t / 0.5) * (t < 0.015 ? t / 0.015 : 1);
        var a = 0.15 + 0.8 * Math.min(1, t / 1.6); y = y + (1 - a) * (x - y); d[i] = y;
      }
      [[0.07, 0.35], [0.13, 0.22], [0.21, 0.14], [0.34, 0.08]].forEach(function (r) { var k = Math.round((r[0] + (ch ? 0.006 : 0)) * ctx.sampleRate); for (var q = 0; q < 220 && k + q < n; q++) d[k + q] += r[1] * (Math.random() * 2 - 1) * (1 - q / 220); });
    }
    return b;
  }

  function make(ctx, dest) {
    var N = { ctx: ctx, user: {}, META: META, LEVEL: LEVEL, RANGE: RANGE, beds: {}, live: [] };
    var out = ctx.createGain(); out.gain.value = 1;
    var lim = ctx.createDynamicsCompressor(); lim.threshold.value = -12; lim.knee.value = 8; lim.ratio.value = 6; lim.attack.value = 0.004; lim.release.value = 0.3;
    out.connect(lim); lim.connect(dest || ctx.destination);
    var verb = ctx.createConvolver(); verb.buffer = makeIR(ctx, 2.4); var vg = ctx.createGain(); vg.gain.value = 1.0; verb.connect(vg); vg.connect(out);
    var legacyOut = ctx.createGain(); legacyOut.gain.value = 1; legacyOut.connect(dest || ctx.destination);
    N.out = out; N.legacyOut = legacyOut;
    var NB = { white: noiseBuf(ctx, 'white', 4), pink: noiseBuf(ctx, 'pink', 4), brown: noiseBuf(ctx, 'brown', 4) };

    function userGain(id) { var u = N.user[id], m = BYID[id]; if (u && u.on === false) return 0; if (!u && m && m.off) return 0; return (u && u.gain != null ? u.gain : 1) * db(LEVEL[id] || 0); }
    N.userGain = userGain;
    // the one chain every sound goes through
    function chain(o) {
      var d = Math.max(1, o.dist == null ? 12 : o.dist), base = (o.gain == null ? 1 : o.gain) * (o.raw ? 1 : userGain(o.id)), near = Math.min(1, 8 / d);
      var inp = ctx.createGain();
      var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = Math.max(1400, 17000 * Math.exp(-d / 70)); lp.Q.value = 0.5;
      var g = ctx.createGain(); g.gain.value = base * near;
      var wet = ctx.createGain(); wet.gain.value = base * 0.3 * Math.pow(near, 0.4);
      inp.connect(lp); lp.connect(g); lp.connect(wet); wet.connect(verb);
      if (ctx.createStereoPanner) { var pn = ctx.createStereoPanner(); pn.pan.value = clamp(o.pan || 0, -1, 1); g.connect(pn); pn.connect(out); } else g.connect(out);
      return inp;
    }
    N.chain = chain;

    // ---------------------------------------------------------------- the two building blocks
    // a voice: a tone (with overtones if wanted) whose pitch follows a curve and whose loudness follows an envelope
    function tonal(dst, t, dur, o) {
      var rate = o.jit ? o.jit[0] : 0, n = Math.max(24, Math.min(6000, Math.round(dur * Math.max(150, rate * 2))));
      var fc = Array.isArray(o.f) ? curveOf(o.f, n, true) : null;
      var ac = curveOf(o.a || [[0, 0], [0.12, 1], [0.75, 1], [1, 0]], n, false);
      if (o.jit) { var hold = 1, step = Math.max(1, Math.round(n / (dur * rate))); for (var i = 0; i < n; i++) { if (i % step === 0) hold = 1 - o.jit[1] * Math.random(); ac[i] *= hold; } }
      var env = ctx.createGain(); env.gain.value = 0; env.gain.setValueCurveAtTime(scaled(ac, o.amp == null ? 1 : o.amp), t, dur);
      var tail = env;
      if (o.am) { var amg = ctx.createGain(); amg.gain.value = 1 - o.am[1] / 2; var lfo = ctx.createOscillator(); lfo.frequency.value = o.am[0]; var lg = ctx.createGain(); lg.gain.value = o.am[1] / 2; lfo.connect(lg); lg.connect(amg.gain); lfo.start(t); lfo.stop(t + dur + 0.05); env.connect(amg); tail = amg; }
      if (o.filt) o.filt.forEach(function (fl) { var bq = ctx.createBiquadFilter(); bq.type = fl[0]; bq.frequency.value = fl[1]; bq.Q.value = fl[2] == null ? 0.7 : fl[2]; tail.connect(bq); tail = bq; });
      tail.connect(dst);
      [[1, 1]].concat(o.harm || []).forEach(function (h) {
        var os = ctx.createOscillator(); os.type = h[2] || o.type || 'sine';
        if (fc) os.frequency.setValueCurveAtTime(scaled(fc, h[0]), t, dur); else os.frequency.value = o.f * h[0];
        var hg = ctx.createGain(); hg.gain.value = h[1]; os.connect(hg); hg.connect(env);
        if (o.vib) { var vl = ctx.createOscillator(); vl.frequency.value = o.vib[0]; var vgn = ctx.createGain(); vgn.gain.value = (fc ? fc[0] : o.f) * h[0] * o.vib[1]; vl.connect(vgn); vgn.connect(os.frequency); vl.start(t); vl.stop(t + dur + 0.05); }
        os.start(t); os.stop(t + dur + 0.05);
      });
      return t + dur;
    }
    // a breath of noise, shaped by filters (whose pitch may follow a curve) and an envelope
    function hiss(dst, t, dur, o) {
      var rate = o.jit ? o.jit[0] : 0, n = Math.max(24, Math.min(6000, Math.round(dur * Math.max(150, rate * 2))));
      var s = ctx.createBufferSource(); s.buffer = NB[o.buf || 'white']; s.loop = true;
      var ac = curveOf(o.a || [[0, 0], [0.1, 1], [0.7, 0.8], [1, 0]], n, false);
      if (o.jit) { var hold = 1, step = Math.max(1, Math.round(n / (dur * rate))); for (var i = 0; i < n; i++) { if (i % step === 0) hold = 1 - o.jit[1] * Math.random(); ac[i] *= hold; } }
      var env = ctx.createGain(); env.gain.value = 0; env.gain.setValueCurveAtTime(scaled(ac, o.amp == null ? 1 : o.amp), t, dur);
      var node = s;
      (o.filt || []).forEach(function (fl) { var bq = ctx.createBiquadFilter(); bq.type = fl[0]; if (Array.isArray(fl[1])) { bq.frequency.value = fl[1][0][1]; bq.frequency.setValueCurveAtTime(curveOf(fl[1], 64, true), t, dur); } else bq.frequency.value = fl[1]; bq.Q.value = fl[2] == null ? 0.7 : fl[2]; node.connect(bq); node = bq; });
      node.connect(env); var tail = env;
      if (o.am) { var amg = ctx.createGain(); amg.gain.value = 1 - o.am[1] / 2; var lfo = ctx.createOscillator(); lfo.frequency.value = o.am[0]; var lg = ctx.createGain(); lg.gain.value = o.am[1] / 2; lfo.connect(lg); lg.connect(amg.gain); lfo.start(t); lfo.stop(t + dur + 0.05); env.connect(amg); tail = amg; }
      tail.connect(dst);
      s.start(t, Math.random() * 3); s.stop(t + dur + 0.05);
      return t + dur;
    }
    N.tonal = tonal; N.hiss = hiss;

    // ---------------------------------------------------------------- the calls: each takes (t, where to, options) and returns when it ends
    var R = {};
    R.cardinal = function (t, d) {   // "cheer cheer cheer", sometimes "birdy birdy birdy" after
      var n = 3 + (Math.random() * 4 | 0), hi = rnd(3600, 4100), lo = rnd(1900, 2200), e = t;
      for (var i = 0; i < n; i++) e = tonal(d, t + i * 0.31, 0.23, { f: [[0, hi * 0.82], [0.14, hi], [1, lo]], a: [[0, 0], [0.12, 1], [0.6, 0.85], [1, 0]], harm: [[2, 0.06]], amp: 0.32 });
      if (Math.random() < 0.5) { var t2 = t + n * 0.31 + 0.1; for (var q = 0; q < 6; q++) e = tonal(d, t2 + q * 0.11, 0.08, { f: [[0, 2100], [1, 3300]], a: [[0, 0], [0.2, 1], [1, 0]], harm: [[2, 0.05]], amp: 0.25 }); }
      return e;
    };
    R.wren = function (t, d) {   // "teakettle teakettle teakettle", loud and rich
      var n = 3 + (Math.random() * 3 | 0), k = rnd(0.95, 1.08), e = t;
      for (var i = 0; i < n; i++) {
        var p = t + i * 0.34;
        tonal(d, p, 0.075, { f: [[0, 2600 * k], [1, 4300 * k]], a: [[0, 0], [0.2, 1], [1, 0]], harm: [[2, 0.12]], amp: 0.34 });
        tonal(d, p + 0.09, 0.08, { f: [[0, 4400 * k], [1, 2800 * k]], a: [[0, 0], [0.15, 1], [1, 0]], harm: [[2, 0.12]], amp: 0.34 });
        e = tonal(d, p + 0.19, 0.1, { f: [[0, 3000 * k], [0.4, 3700 * k], [1, 2600 * k]], a: [[0, 0], [0.2, 1], [1, 0]], harm: [[2, 0.1]], amp: 0.3 });
      }
      return e;
    };
    R.chickadee = function (t, d) {   // Carolina chickadee: "fee-bee fee-bay", four clear notes
      var k = rnd(0.96, 1.04), notes = [4100, 3150, 3800, 2850], e = t;
      notes.forEach(function (f, i) { e = tonal(d, t + i * 0.3, 0.22, { f: [[0, f * k * 1.01], [1, f * k * 0.98]], a: [[0, 0], [0.15, 1], [0.8, 0.9], [1, 0]], amp: 0.22 }); });
      return e;
    };
    R.dove = function (t, d) {   // "coo-OO-oo, oo, oo": low and breathy
      var k = rnd(0.95, 1.05), e = t;
      function coo(p, dur, f0, f1, a) { hiss(d, p, dur, { buf: 'pink', filt: [['bandpass', f0 * 2, 3]], a: [[0, 0], [0.25, 1], [0.7, 0.7], [1, 0]], amp: a * 0.25 }); return tonal(d, p, dur, { f: [[0, f0], [1, f1]], a: [[0, 0], [0.22, 1], [0.7, 0.85], [1, 0]], harm: [[2, 0.14]], vib: [5, 0.006], amp: a }); }
      coo(t, 0.34, 470 * k, 560 * k, 0.5); coo(t + 0.4, 0.46, 600 * k, 540 * k, 0.62);
      [1.15, 1.75, 2.35].forEach(function (p) { e = coo(t + p, 0.4, 525 * k, 480 * k, 0.5); });
      return e;
    };
    R.swallows = function (t, d) {   // quick twitters as a few go over
      var n = 9 + (Math.random() * 8 | 0), e = t;
      for (var i = 0; i < n; i++) { var p = t + rnd(0, 1.7), f0 = rnd(2800, 6200), f1 = f0 * rnd(0.7, 1.4); e = Math.max(e, tonal(d, p, rnd(0.03, 0.07), { f: [[0, f0], [1, f1]], a: [[0, 0], [0.25, 1], [1, 0]], amp: rnd(0.08, 0.2) })); }
      return e;
    };
    R.roadrunner = function (t, d) {   // a run of falling coos; sometimes a clatter of the bill first
      var p = t, e = t;
      if (Math.random() < 0.4) { for (var c = 0; c < 14; c++) hiss(d, p + c * 0.045, 0.008, { filt: [['bandpass', 2300, 3]], a: [[0, 1], [1, 0]], amp: rnd(0.3, 0.5) }); p += 0.9; }
      var f = rnd(540, 580);
      for (var i = 0; i < 6; i++) { e = tonal(d, p + i * 0.55, 0.32, { f: [[0, f * 1.03], [1, f * 0.97]], a: [[0, 0], [0.25, 1], [0.7, 0.8], [1, 0]], harm: [[2, 0.1]], amp: 0.42 }); f *= 0.94; }
      return e;
    };
    R.teal = function (t, d) {   // the drake's thin "peep", and sometimes the hen's soft quacks
      var e = t, n = 2 + (Math.random() * 3 | 0);
      for (var i = 0; i < n; i++) e = tonal(d, t + i * rnd(0.24, 0.32), 0.12, { f: [[0, 4300], [1, 3700]], a: [[0, 0], [0.2, 1], [1, 0]], harm: [[2, 0.05]], amp: 0.14 });
      if (Math.random() < 0.45) { var p = e + 0.35; for (var q = 0; q < 3; q++) e = tonal(d, p + q * 0.24, 0.13, { type: 'sawtooth', f: [[0, 430 - q * 15], [1, 380 - q * 15]], a: [[0, 0], [0.1, 1], [1, 0]], jit: [60, 0.3], filt: [['bandpass', 1100, 2.5]], amp: 0.5 - q * 0.1 }); }
      return e;
    };
    R.heron = function (t, d) {   // "frahnk": a hoarse croak or three as it lifts off
      var n = 1 + (Math.random() * 3 | 0), e = t;
      for (var i = 0; i < n; i++) { var dur = i === n - 1 ? 0.4 : 0.55; e = tonal(d, t + i * 0.75, dur, { type: 'sawtooth', f: [[0, 150], [0.3, 168], [1, 118]], a: [[0, 0], [0.08, 1], [0.6, 0.8], [1, 0]], jit: [45, 0.7], filt: [['bandpass', 900, 1.3]], amp: 0.9 }); hiss(d, t + i * 0.75, dur, { filt: [['bandpass', 1600, 1.5]], a: [[0, 0], [0.1, 1], [1, 0]], jit: [45, 0.6], amp: 0.25 }); }
      return e;
    };
    R.hawk = function (t, d) {   // the long, hoarse "kee-eeeer" from high up
      var dur = rnd(1.8, 2.3);
      tonal(d, t, dur, { type: 'sawtooth', f: [[0, 2400], [0.15, 3100], [1, 2000]], a: [[0, 0], [0.1, 1], [0.6, 0.8], [1, 0]], jit: [80, 0.6], filt: [['bandpass', 2800, 0.9]], amp: 0.5 });
      return hiss(d, t, dur, { filt: [['bandpass', [[0, 2800], [1, 2200]], 2]], a: [[0, 0], [0.1, 1], [0.6, 0.8], [1, 0]], jit: [80, 0.5], amp: 0.3 });
    };
    R.cicada = function (t, d) {   // a long swell of buzzing that rises and falls away
      var dur = rnd(7, 11), r = rnd(95, 130), sh = rnd(-200, 200);
      hiss(d, t, dur, { filt: [['bandpass', [[0, 4300 + sh], [0.6, 5000 + sh], [1, 4600 + sh]], 6]], am: [r, 0.9], a: [[0, 0], [0.3, 1], [0.7, 0.95], [1, 0]], amp: 1.6 });
      return hiss(d, t, dur, { filt: [['bandpass', [[0, 6200 + sh], [1, 6600 + sh]], 6]], am: [r, 0.9], a: [[0, 0], [0.3, 1], [0.7, 0.9], [1, 0]], amp: 0.8 });
    };
    R.cricketfrog = function (t, d) {   // clicks like two pebbles knocked together, speeding up
      var n = 12 + (Math.random() * 16 | 0), p = t, gap = 0.55, f = rnd(3300, 3800);
      for (var i = 0; i < n; i++) { tonal(d, p, 0.025, { f: [[0, f], [1, f * 0.86]], a: [[0, 0], [0.05, 1], [1, 0]], amp: 0.3 }); hiss(d, p, 0.015, { filt: [['bandpass', 3000, 4]], a: [[0, 1], [1, 0]], amp: 0.35 }); p += gap; gap = Math.max(0.15, gap * 0.9); }
      return p;
    };
    R.treefrog = function (t, d) {   // "quonk, quonk, quonk": nasal, like a far-off bell
      var n = 5 + (Math.random() * 6 | 0), gap = rnd(0.6, 0.8), f = rnd(840, 940), e = t;
      for (var i = 0; i < n; i++) e = tonal(d, t + i * gap, 0.14, { type: 'sawtooth', f: [[0, f], [0.3, f * 1.05], [1, f * 0.97]], a: [[0, 0], [0.1, 1], [0.6, 0.7], [1, 0]], filt: [['bandpass', 1800, 2.2]], amp: 0.7 });
      return e;
    };
    R.leopard = function (t, d) {   // a low rattling snore, then a few chuckles
      var e = hiss(d, t, 1.5, { buf: 'pink', filt: [['bandpass', 1100, 1.4]], am: [rnd(14, 20), 1], a: [[0, 0], [0.05, 1], [0.8, 0.8], [1, 0]], amp: 1.4 });
      var n = 3 + (Math.random() * 3 | 0); for (var i = 0; i < n; i++) e = tonal(d, t + 1.7 + i * 0.18, 0.08, { type: 'sawtooth', f: [[0, 360], [1, 330]], a: [[0, 0], [0.15, 1], [1, 0]], jit: [50, 0.4], filt: [['bandpass', 1000, 2]], amp: 0.5 });
      return e;
    };
    R.bullfrog = function (t, d) {   // "jug-o-rum", deep
      var n = 3 + (Math.random() * 2 | 0), e = t, f = rnd(115, 130);
      for (var i = 0; i < n; i++) { var dur = rnd(0.55, 0.75); e = tonal(d, t + i * (dur + 0.35), dur, { type: 'sawtooth', f: [[0, f], [0.3, f * 1.12], [1, f * 0.92]], a: [[0, 0], [0.12, 1], [0.7, 0.85], [1, 0]], jit: [28, 0.5], filt: [['lowpass', 520, 5]], amp: 1.0 }); }
      return e;
    };
    function hootRun(d, t, f, k) {   // the great horned owl's rhythm: hoo, h'hoo, hoooo, hoo, hoo
      var e = t;
      [[0, 0.34], [0.46, 0.13], [0.64, 0.32], [1.42, 0.34], [1.98, 0.38]].forEach(function (q) {
        tonal(d, t + q[0] * k, q[1], { buf: 'pink', f: [[0, f * 0.96], [0.25, f], [1, f * 0.93]], a: [[0, 0], [0.2, 1], [0.7, 0.85], [1, 0]], harm: [[2, 0.07], [3, 0.02]], amp: 0.6 });
        e = hiss(d, t + q[0] * k, q[1], { buf: 'pink', filt: [['bandpass', f * 2.2, 2]], a: [[0, 0], [0.2, 1], [1, 0]], amp: 0.08 });
      });
      return e;
    }
    R.owl = function (t, d, o) {   // and sometimes his mate answers, higher and from somewhere else
      var e = hootRun(d, t, rnd(255, 280), 1);
      if (Math.random() < 0.45) { var d2 = chain({ id: 'owl', dist: (o.dist || 40) * rnd(1.2, 1.8), pan: -(o.pan || 0) * 0.8, gain: o.gain }); e = hootRun(d2, e + rnd(1.2, 2.4), rnd(320, 350), 0.9); }
      return e;
    };
    R.chuck = function (t, d) {   // "chuck-will's-WID-ow", over and over, then quiet
      var n = 6 + (Math.random() * 7 | 0), gap = rnd(1.05, 1.2), k = rnd(0.95, 1.05), e = t;
      for (var i = 0; i < n; i++) {
        var p = t + i * gap;
        tonal(d, p, 0.04, { f: [[0, 900 * k], [1, 800 * k]], a: [[0, 0], [0.3, 1], [1, 0]], amp: 0.12 });
        tonal(d, p + 0.12, 0.18, { f: [[0, 1100 * k], [0.6, 2500 * k], [1, 2300 * k]], a: [[0, 0], [0.2, 1], [1, 0.6]], harm: [[2, 0.08]], amp: 0.4 });
        tonal(d, p + 0.31, 0.13, { f: [[0, 2350 * k], [1, 1500 * k]], a: [[0, 0.6], [0.2, 1], [1, 0.4]], harm: [[2, 0.08]], amp: 0.42 });
        e = tonal(d, p + 0.45, 0.16, { f: [[0, 1500 * k], [1, 1100 * k]], a: [[0, 0.4], [0.3, 0.8], [1, 0]], harm: [[2, 0.06]], amp: 0.35 });
      }
      return e;
    };
    R.coyote = function (t, d) {   // a few voices at once: yips that turn to wavering howls, far off
      var e = t, voices = 3 + (Math.random() * 2 | 0);
      for (var v = 0; v < voices; v++) {
        var p = t + rnd(0, 1.2), k = rnd(0.85, 1.2);
        var yips = 2 + (Math.random() * 5 | 0); for (var y = 0; y < yips; y++) { tonal(d, p, 0.08, { f: [[0, 650 * k], [1, 1250 * k]], a: [[0, 0], [0.2, 1], [1, 0]], harm: [[2, 0.3], [3, 0.1]], amp: 0.25 }); p += rnd(0.12, 0.22); }
        var h = rnd(1.2, 2.2); e = Math.max(e, tonal(d, p, h, { f: [[0, 520 * k], [0.3, 950 * k], [0.7, 880 * k], [1, 600 * k]], a: [[0, 0], [0.15, 1], [0.8, 0.8], [1, 0]], harm: [[2, 0.28], [3, 0.1]], vib: [5.5, 0.025], amp: 0.3 }));
        if (Math.random() < 0.6) e = Math.max(e, tonal(d, p + h + 0.2, rnd(0.8, 1.4), { f: [[0, 800 * k], [0.5, 1000 * k], [1, 650 * k]], a: [[0, 0], [0.2, 1], [1, 0]], harm: [[2, 0.25]], vib: [6, 0.03], amp: 0.22 }));
      }
      return e;
    };
    R.deer = function (t, d) {   // a sharp snort through the nose, then the bounds going away
      var e = hiss(d, t, 0.4, { filt: [['bandpass', [[0, 1500], [1, 700]], 1.1]], a: [[0, 0], [0.04, 1], [0.3, 0.5], [1, 0]], amp: 1.0 });
      if (Math.random() < 0.6) e = hiss(d, t + 0.6, 0.35, { filt: [['bandpass', [[0, 1300], [1, 700]], 1.1]], a: [[0, 0], [0.05, 1], [0.3, 0.4], [1, 0]], amp: 0.6 });
      var n = 4 + (Math.random() * 3 | 0); for (var i = 0; i < n; i++) { var p = t + 0.5 + i * 0.33, a = 0.9 * Math.pow(0.75, i); tonal(d, p, 0.12, { f: [[0, 95], [1, 55]], a: [[0, 0], [0.04, 1], [1, 0]], amp: a }); e = hiss(d, p, 0.06, { filt: [['highpass', 2000]], a: [[0, 1], [1, 0]], amp: a * 0.35 }); }
      return e;
    };
    R.armadillo = function (t, d) {   // rooting and rustling in dry leaves, with a sniff now and then
      var dur = rnd(1.4, 2.2), n = 25 + (Math.random() * 35 | 0), e = t;
      for (var i = 0; i < n; i++) { var p = t + Math.pow(Math.random(), 0.8) * dur; e = Math.max(e, hiss(d, p, rnd(0.003, 0.012), { filt: [['highpass', rnd(1800, 3200)]], a: [[0, 1], [1, 0]], amp: 0.2 + 0.8 * Math.pow(Math.random(), 2) })); }
      for (var s = 0; s < 3; s++) hiss(d, t + rnd(0, dur), 0.06, { buf: 'pink', filt: [['bandpass', 1200, 1]], a: [[0, 0], [0.3, 1], [1, 0]], amp: 0.3 });
      return e;
    };
    R.splash = function (t, d) {   // a bass clearing the water and going back in
      hiss(d, t, 0.35, { filt: [['lowpass', [[0, 4000], [1, 800]], 0.7]], a: [[0, 0], [0.03, 1], [0.4, 0.4], [1, 0]], amp: 1.0 });
      tonal(d, t + 0.02, 0.12, { f: [[0, 260], [1, 140]], a: [[0, 0], [0.1, 1], [1, 0]], amp: 0.4 });
      var e = t + 0.4; for (var i = 0; i < 7; i++) e = Math.max(e, tonal(d, t + rnd(0.1, 0.6), 0.03, { f: [[0, rnd(1300, 2600)], [1, rnd(2600, 3800)]], a: [[0, 0], [0.1, 1], [1, 0]], amp: rnd(0.08, 0.2) }));
      return e;
    };
    R.plop = function (t, d) {   // something small going into still water
      hiss(d, t, 0.09, { filt: [['lowpass', 1800, 0.7]], a: [[0, 0], [0.05, 1], [1, 0]], amp: 0.6 });
      return tonal(d, t + 0.01, 0.09, { f: [[0, 300], [1, 720]], a: [[0, 0], [0.05, 1], [1, 0]], amp: 0.5 });
    };
    R.thunder = function (t, d, o) {   // near: a crack and a roll; far off: a long low grumble
      var km = (o.km != null ? o.km : (o.dist || 1500) / 1000), e = t;
      if (km < 1.3) e = hiss(d, t, 0.3, { filt: [['highpass', 900]], a: [[0, 0], [0.01, 1], [0.2, 0.3], [1, 0]], amp: 1.2 * (1 - km / 1.3) });
      var dur = rnd(4, 8) * (0.7 + 0.3 * Math.min(2, km)), pts = [[0, 0], [0.03, 0.6]], u = 0.03;
      while (u < 0.85) { u += rnd(0.06, 0.18); pts.push([Math.min(0.9, u), rnd(0.35, 1) * (1 - u * 0.75)]); }
      pts.push([1, 0]);
      return Math.max(e, hiss(d, t + (km < 1.3 ? 0.08 : 0), dur, { buf: 'brown', filt: [['lowpass', 150 + 900 * Math.exp(-km / 2.5), 0.7]], a: pts, jit: [9, 0.35], amp: 2.6 * Math.min(1.3, Math.pow(0.8 / Math.max(0.3, km), 0.8)) }));
    };
    N.R = R;

    // play one call: N.call('owl', { dist: 40, pan: -0.3, when: 0 })
    N.call = function (id, o) {
      o = o || {}; if (!R[id]) return 0;
      var rg = RANGE[id] || [10, 30], dist = o.dist != null ? o.dist : rnd(rg[0], rg[1]);
      if (id === 'thunder') dist = 8;     // thunder carries its own distance (o.km)
      if (userGain(id) <= 0 && !o.raw) return 0;
      var d = chain({ id: id, dist: dist, pan: o.pan != null ? o.pan : rnd(-0.85, 0.85), gain: o.gain, raw: o.raw });
      var t = ctx.currentTime + (o.when || 0) + 0.03;
      var end = R[id](t, d, { dist: dist, pan: o.pan, gain: o.gain, km: o.km });
      N.live.push({ id: id, end: end });
      return end - ctx.currentTime;
    };

    // ---------------------------------------------------------------- the sounds that go on
    function loop(kind) { var s = ctx.createBufferSource(); s.buffer = NB[kind]; s.loop = true; s.start(ctx.currentTime, Math.random() * 3); return s; }
    function bq(type, f, Q) { var b = ctx.createBiquadFilter(); b.type = type; b.frequency.value = f; b.Q.value = Q == null ? 0.7 : Q; return b; }
    function gn(v) { var g = ctx.createGain(); g.gain.value = v || 0; return g; }
    function ramp(p, v, tau) { p.setTargetAtTime(v, ctx.currentTime, tau == null ? 0.4 : tau); }
    var BEDS = {};
    BEDS.creek = function (b) {   // babble in three bands that wander, little bubbles, and in the flood a deep rush
      var L = chain({ id: 'creek', dist: 6, pan: -0.35, raw: true }), Rr = chain({ id: 'creek', dist: 6, pan: 0.35, raw: true });
      b.mix = gn(0); b.mix.connect(L); var mR = gn(0); b.mix2 = mR; mR.connect(Rr);
      var p = loop('pink'), w = loop('white'), br = loop('brown');
      b.bands = [[bq('bandpass', 450, 0.8), 0.9, p, b.mix], [bq('bandpass', 1300, 1.1), 0.6, p, mR], [bq('bandpass', 700, 0.9), 0.6, p, mR], [bq('highpass', 3500), 0.12, w, b.mix]].map(function (q) { var g = gn(q[1]); q[2].connect(q[0]); q[0].connect(g); g.connect(q[3]); return { f: q[0], g: g, base: q[1], fc: q[0].frequency.value }; });
      b.rush = gn(0); var lp = bq('lowpass', 320, 0.7); br.connect(lp); lp.connect(b.rush); b.rush.connect(b.mix); b.rush.connect(mR);
      b.next = 0; b.bt = ctx.currentTime;
      b.update = function () {
        var now = ctx.currentTime, lv = b.lvl, flow = b.params.flow == null ? 0.3 : b.params.flow, ug = userGain('creek');
        ramp(b.mix.gain, lv * ug * 0.55, 0.6); ramp(mR.gain, lv * ug * 0.55, 0.6); ramp(b.rush.gain, 1.6 * Math.max(0, flow - 0.4), 1);
        if (now >= b.next) { b.next = now + rnd(0.25, 0.6); b.bands.forEach(function (q) { ramp(q.g.gain, q.base * rnd(0.55, 1.05) * (q.fc > 3000 ? 0.6 + flow : 1), 0.3); ramp(q.f.frequency, q.fc * rnd(0.85, 1.15) * (1 + 0.3 * flow), 0.4); }); }
        if (lv * ug < 0.01) { b.bt = now; return; }
        var rate = 6 + 26 * flow; if (b.bt < now) b.bt = now;
        while (b.bt < now + 0.25) { b.bt += -Math.log(1 - Math.random()) / rate; var f0 = rnd(350, 1400) * (0.9 + 0.4 * flow); tonal(Math.random() < 0.5 ? b.mix : mR, b.bt, rnd(0.015, 0.05), { f: [[0, f0], [1, f0 * rnd(1.4, 2.4)]], a: [[0, 0], [0.08, 1], [1, 0]], amp: rnd(0.03, 0.14) }); }
      };
    };
    BEDS.wind = function (b) {   // a soft wash that comes in gusts, and the leaves answering each gust
      var c = chain({ id: 'wind', dist: 10, pan: 0, raw: true }); b.mix = gn(0); b.mix.connect(c);
      var p = loop('pink'), w = loop('white');
      b.bp = bq('bandpass', 700, 0.6); b.body = gn(0); p.connect(b.bp); b.bp.connect(b.body); b.body.connect(b.mix);
      var hp = bq('highpass', 2600); b.leaves = gn(0); w.connect(hp); hp.connect(b.leaves); b.leaves.connect(b.mix);
      b.next = 0; b.gust = 0.5;
      b.update = function () {
        var now = ctx.currentTime, s = b.params.strength == null ? 0.3 : b.params.strength;
        ramp(b.mix.gain, b.lvl * userGain('wind'), 0.8);
        if (now >= b.next) { b.next = now + rnd(0.8, 3); b.gust = clamp(rnd(0.3, 1.3) * (0.4 + 0.6 * s), 0.05, 1.4); var tau = rnd(0.5, 1.4); ramp(b.body.gain, (0.25 + 0.35 * s) * b.gust, tau); ramp(b.leaves.gain, 0.22 * Math.pow(b.gust, 1.6) * (0.3 + 0.5 * s), tau); ramp(b.bp.frequency, 450 + 700 * b.gust * (0.5 + 0.5 * s), tau); }
      };
    };
    BEDS.rain = function (b) {   // the hiss of it, the roar on the ground, and drops close by on leaves
      var c = chain({ id: 'rain', dist: 5, pan: 0, raw: true }); b.mix = gn(0); b.mix.connect(c);
      var w = loop('white'), p = loop('pink'), f1 = bq('bandpass', 3200, 0.5), f2 = bq('lowpass', 900), g1 = gn(0.5), g2 = gn(0.7);
      w.connect(f1); f1.connect(g1); g1.connect(b.mix); p.connect(f2); f2.connect(g2); g2.connect(b.mix); b.bt = ctx.currentTime;
      b.update = function () {
        var now = ctx.currentTime, it = b.params.intensity == null ? 1 : b.params.intensity, ug = userGain('rain');
        ramp(b.mix.gain, b.lvl * ug * (0.3 + 0.7 * it), 0.8);
        if (b.lvl * ug < 0.01) { b.bt = now; return; }
        var rate = 20 + 90 * it; if (b.bt < now) b.bt = now;
        while (b.bt < now + 0.25) { b.bt += -Math.log(1 - Math.random()) / rate; var big = Math.random() < 0.15; tonal(b.mix, b.bt, big ? 0.03 : rnd(0.006, 0.014), { f: big ? [[0, rnd(1200, 2400)], [1, rnd(900, 1600)]] : rnd(2500, 6000), a: [[0, 1], [1, 0]], amp: big ? rnd(0.05, 0.12) : rnd(0.02, 0.07) }); }
      };
    };
    BEDS.falls = function (b) {   // the Dry Falls pouring: a deep rumble and a broad hiss
      var c = chain({ id: 'falls', dist: 20, pan: 0.2, raw: true }); b.mix = gn(0); b.mix.connect(c);
      var br = loop('brown'), w = loop('white'), f1 = bq('lowpass', 500), f2 = bq('bandpass', 1800, 0.4), g1 = gn(1.2), g2 = gn(0.35);
      br.connect(f1); f1.connect(g1); g1.connect(b.mix); w.connect(f2); f2.connect(g2); g2.connect(b.mix);
      b.update = function () { ramp(b.mix.gain, b.lvl * userGain('falls'), 0.8); };
    };
    BEDS.fire = function (b) {   // a low roar, a soft hiss, crackles, and now and then a pop
      var c = chain({ id: 'fire', dist: 3, pan: -0.15, raw: true }); b.mix = gn(0); b.mix.connect(c);
      var br = loop('brown'), w = loop('white'), f1 = bq('lowpass', 250), f2 = bq('bandpass', 2500, 0.7), g1 = gn(0.9), g2 = gn(0.05);
      br.connect(f1); f1.connect(g1); g1.connect(b.mix); w.connect(f2); f2.connect(g2); g2.connect(b.mix); b.bt = ctx.currentTime;
      b.update = function () {
        var now = ctx.currentTime, ug = userGain('fire'); ramp(b.mix.gain, b.lvl * ug, 0.5);
        if (b.lvl * ug < 0.01) { b.bt = now; return; }
        if (b.bt < now) b.bt = now;
        while (b.bt < now + 0.25) { b.bt += -Math.log(1 - Math.random()) / 9; if (Math.random() < 0.06) { tonal(b.mix, b.bt, 0.05, { f: rnd(700, 1400), a: [[0, 1], [1, 0]], amp: 0.25 }); hiss(b.mix, b.bt, 0.03, { filt: [['highpass', 1200]], a: [[0, 1], [1, 0]], amp: 0.8 }); } else hiss(b.mix, b.bt, rnd(0.004, 0.012), { filt: [['highpass', 1500]], a: [[0, 1], [1, 0]], amp: 0.15 + 0.6 * Math.pow(Math.random(), 3) }); }
      };
    };
    BEDS.crickets = function (b) {   // a field of crickets, each at its own pitch and pace, some near, most farther off
      b.bugs = []; for (var i = 0; i < 7; i++) {
        var dist = i < 2 ? rnd(5, 12) : rnd(12, 45), c = chain({ id: 'crickets', dist: dist, pan: rnd(-0.9, 0.9), raw: true });
        var os = ctx.createOscillator(), h = ctx.createOscillator(), g = gn(0), hg = gn(0.05); os.frequency.value = rnd(4300, 4900); h.frequency.value = os.frequency.value * 2;
        os.connect(g); h.connect(hg); hg.connect(g); var mix = gn(0); g.connect(mix); mix.connect(c); os.start(); h.start();
        b.bugs.push({ g: g, mix: mix, per: rnd(0.38, 0.62), next: ctx.currentTime + rnd(0, 0.6), rest: 0, on: i < 4 });
      }
      b.update = function () {
        var now = ctx.currentTime, dens = b.params.density == null ? 1 : b.params.density, ug = userGain('crickets'), lv = b.lvl * ug;
        b.bugs.forEach(function (k, i) {
          var want = i < Math.round(2 + 5 * dens); ramp(k.mix.gain, want ? lv * 0.5 : 0, 0.8);
          if (lv < 0.01 || !want) { k.next = Math.max(k.next, now); return; }
          while (k.next < now + 0.3) {
            if (k.next < now) k.next = now;
            if (Math.random() < 0.02) { k.next += rnd(2, 7); continue; }   // a cricket stops a while
            for (var q = 0; q < 3; q++) { var p = k.next + q * 0.028; k.g.gain.setValueAtTime(0, p); k.g.gain.linearRampToValueAtTime(1, p + 0.003); k.g.gain.setValueAtTime(1, p + 0.012); k.g.gain.linearRampToValueAtTime(0, p + 0.015); }
            k.next += k.per * rnd(0.97, 1.03);
          }
        });
      };
    };
    BEDS.katydids = function (b) {   // two or three in the trees, calling back and forth: "ka-ty-did", "ka-ty"
      b.bugs = []; for (var i = 0; i < 3; i++) {
        var c = chain({ id: 'katydids', dist: rnd(15, 35), pan: [-0.7, 0.6, 0.05][i], raw: true }), s = loop('white'), f = bq('bandpass', rnd(5500, 7800), 3), g = gn(0), mix = gn(0);
        s.connect(f); f.connect(g); g.connect(mix); mix.connect(c); b.bugs.push({ g: g, mix: mix, next: ctx.currentTime + 0.3 + i * 0.45, per: rnd(1.1, 1.5) });
      }
      b.update = function () {
        var now = ctx.currentTime, lv = b.lvl * userGain('katydids');
        b.bugs.forEach(function (k, i) {
          ramp(k.mix.gain, i < 2 || (b.params.density || 0.6) > 0.7 ? lv * 1.2 : 0, 0.8);
          if (lv < 0.01) { k.next = Math.max(k.next, now); return; }
          while (k.next < now + 0.4) {
            if (k.next < now) k.next = now;
            var rasps = Math.random() < 0.6 ? 3 : 2;
            for (var r = 0; r < rasps; r++) for (var q = 0; q < 7; q++) { var p = k.next + r * 0.14 + q * 0.011; k.g.gain.setValueAtTime(0, p); k.g.gain.linearRampToValueAtTime(1, p + 0.002); k.g.gain.linearRampToValueAtTime(0, p + 0.007); }
            k.next += k.per * rnd(0.95, 1.08);
          }
        });
      };
    };
    N.bed = function (id) {
      if (N.beds[id]) return N.beds[id];
      var b = { id: id, lvl: 0, params: {} }; BEDS[id](b);
      b.set = function (lvl, params) { b.lvl = Math.max(0, lvl || 0); if (params) for (var k in params) b.params[k] = params[k]; b.update(); return b; };
      N.beds[id] = b; return b;
    };
    N.tick = function () { for (var k in N.beds) N.beds[k].update(); var now = ctx.currentTime; N.live = N.live.filter(function (q) { return q.end > now; }); };
    N.stopAll = function () { for (var k in N.beds) N.beds[k].set(0); };

    // ---------------------------------------------------------------- the valley left to itself
    // state: { hour, storm (0 to 1), flood (0 to 1), water (m to the nearest water), pond (m to the stock pond), falls (m to the Dry Falls,
    //          when they are running), fire (0 to 1), quiet (0 to 1: how much to hush everything, e.g. under a poem), wet (0 to 1: just after rain) }
    // rates are calls per minute
    function hourParts(h) {
      return {
        dawn: h > 5.2 && h < 9 ? Math.min(1, (h - 5.2) / 0.6) * Math.min(1, (9 - h) / 1.2) : 0,
        day: h >= 8 && h < 18 ? Math.min(1, (h - 8) / 1) * Math.min(1, (18 - h) / 1) : 0,
        dusk: h > 17.3 && h < 21.2 ? Math.min(1, (h - 17.3) / 0.8) * Math.min(1, (21.2 - h) / 0.8) : 0,
        night: h >= 20.4 || h < 5.6 ? 1 : 0,
        hot: h > 10.5 && h < 18.5 ? Math.min(1, (h - 10.5) / 1.5) * Math.min(1, (18.5 - h) / 1) : 0
      };
    }
    var RATES = {
      cardinal: function (p) { return 2.6 * p.dawn + 1.1 * p.day + 0.8 * p.dusk; },
      wren: function (p) { return 2.0 * p.dawn + 0.9 * p.day + 0.6 * p.dusk; },
      chickadee: function (p) { return 1.4 * p.dawn + 0.9 * p.day + 0.4 * p.dusk; },
      dove: function (p) { return 1.2 * p.dawn + 0.6 * p.day + 1.0 * p.dusk; },
      swallows: function (p, s) { return 0.45 * p.day * (s.water < 40 ? 1 : 0.4); },
      roadrunner: function (p) { return 0.15 * (p.dawn + p.day); },
      teal: function (p, s) { return (s.pond < 45 || s.spring < 30 ? 0.8 : 0) * (p.dawn + p.day * 0.6 + p.dusk * 0.5); },
      heron: function (p, s) { return s.water < 30 ? 0.08 * (p.dawn + p.day) : 0; },
      hawk: function (p) { return 0.07 * p.day; },
      cicada: function (p) { return 3.2 * p.hot; },
      cricketfrog: function (p, s) { return s.water < 30 ? 0.5 * p.day + 1.6 * p.dusk + 0.9 * p.night : 0; },
      treefrog: function (p, s) { return (s.water < 50 ? 1 : 0.35) * (1.2 * p.dusk + 1.0 * p.night) * (1 + 1.5 * (s.wet || 0)); },
      leopard: function (p, s) { return s.water < 18 ? 0.6 * (p.day + p.dawn) : 0; },
      bullfrog: function (p, s) { return s.pond < 60 ? 0.5 * p.dusk + 0.9 * p.night : 0; },
      owl: function (p) { return 0.15 * p.dusk + 0.35 * p.night; },
      chuck: function (p, s) { var h = s.hour; return (h > 20.3 && h < 23.6) || (h > 3.8 && h < 5.6) ? 0.3 : 0; },
      coyote: function (p) { return 0.06 * p.night; }
    };
    var GROUP = { cardinal: 'bird', wren: 'bird', chickadee: 'bird', dove: 'bird', swallows: 'bird', roadrunner: 'bird', teal: 'bird', heron: 'bird', hawk: 'bird', owl: 'night', chuck: 'night', coyote: 'night', cricketfrog: 'frog', treefrog: 'frog', leopard: 'frog', bullfrog: 'frog', cicada: 'bug' };
    var MAXAT = { bird: 2, night: 1, frog: 2, bug: 2 };
    var amb = { t: {}, until: {}, state: null };
    amb.update = function (dt, s) {
      s = s || {}; amb.state = s;
      var h = ((s.hour == null ? 12 : s.hour) % 24 + 24) % 24, p = hourParts(h), st = s.storm || 0, calm = 1 - Math.min(1, st * 1.5), q = 1 - (s.quiet || 0) * 0.7;
      var water = s.water == null ? 30 : s.water;
      N.bed('creek').set(q * (0.05 + 0.95 * Math.pow(clamp(1 - water / 26, 0, 1), 1.5)), { flow: Math.max(s.flood || 0, 0.25 + 0.2 * st) });
      N.bed('wind').set(q * (0.5 + 0.5 * st) * (s.cave ? 0.3 : 1), { strength: Math.max(st, 0.15 + 0.15 * p.dusk + 0.1 * p.day - 0.05 * p.night) });
      N.bed('rain').set(st > 0.02 ? Math.min(1, st * 1.2) : 0, { intensity: st });
      N.bed('falls').set(s.falls != null && s.falls < 120 ? q * Math.min(1, 20 / Math.max(10, s.falls)) * (s.fallsOn == null ? 1 : s.fallsOn) : 0);
      N.bed('fire').set(s.fire || 0);
      N.bed('crickets').set(q * calm * Math.max(p.night, p.dusk * 0.7) * (s.cave ? 0.25 : 1), { density: 0.4 + 0.6 * p.night });
      N.bed('katydids').set(q * calm * (h >= 20.8 || h < 4.6 ? 1 : 0) * (s.cave ? 0.2 : 1), { density: 0.6 });
      N.tick();
      if (s.cave || s.quiet >= 1) return;
      var now = ctx.currentTime, busy = {};
      N.live.forEach(function (c) { var g = GROUP[c.id]; if (g) busy[g] = (busy[g] || 0) + 1; });
      for (var id in RATES) {
        var r = RATES[id](p, s) * calm * q; if (r <= 0) { amb.t[id] = null; continue; }
        if (amb.t[id] == null) amb.t[id] = now + -Math.log(1 - Math.random()) * 60 / r * 0.5;
        if (now < amb.t[id]) continue;
        amb.t[id] = now + -Math.log(1 - Math.random()) * 60 / r;
        var g = GROUP[id]; if (g && (busy[g] || 0) >= MAXAT[g]) continue;   // keep it calm: not too many at once
        N.call(id); if (g) busy[g] = (busy[g] || 0) + 1;
      }
    };
    N.amb = amb;

    // ---------------------------------------------------------------- the old sounds, exactly as the game made them before Nov 19, for comparing
    function oTone(freq, t0, dur, vol, type, pan) { var o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime + t0; o.type = type || 'sine'; o.frequency.value = freq; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); if (pan != null && ctx.createStereoPanner) { var sp = ctx.createStereoPanner(); sp.pan.value = pan; g.connect(sp); sp.connect(legacyOut); } else g.connect(legacyOut); o.start(t); o.stop(t + dur + 0.05); }
    function oNoise(dur, freq, vol) { var n = Math.round(ctx.sampleRate * dur), b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0); for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2); var s = ctx.createBufferSource(); s.buffer = b; var f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq; var g = ctx.createGain(); g.gain.value = vol; s.connect(f); f.connect(g); g.connect(legacyOut); s.start(); }
    function sweep(f0, f1, t0, dur, vol, pan, type) { var o = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime + t0; o.type = type || 'sine'; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f1, t + dur); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + Math.min(0.03, dur * 0.3)); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); if (ctx.createStereoPanner) { var sp = ctx.createStereoPanner(); sp.pan.value = pan || 0; g.connect(sp); sp.connect(legacyOut); } else g.connect(legacyOut); o.start(t); o.stop(t + dur + 0.05); }
    var OLD = {
      cardinal: function (v, p) { var n = 3 + (Math.random() * 3 | 0); for (var i = 0; i < n; i++) sweep(4200, 2100, i * 0.32, 0.24, v, p); return n * 0.32; },
      wren: function (v, p) { for (var i = 0; i < 3; i++) { sweep(3400, 4100, i * 0.42, 0.11, v, p); sweep(4300, 3000, i * 0.42 + 0.13, 0.13, v, p); sweep(2900, 3300, i * 0.42 + 0.27, 0.1, v * 0.8, p); } return 1.3; },
      chickadee: function (v, p) { sweep(3950, 3900, 0, 0.32, v, p); sweep(3450, 3400, 0.4, 0.38, v * 0.9, p); return 0.8; },
      dove: function (v, p) { sweep(520, 600, 0, 0.42, v, p, 'triangle'); sweep(620, 540, 0.5, 0.5, v * 1.1, p, 'triangle'); [1.25, 1.85, 2.45].forEach(function (d) { sweep(540, 500, d, 0.45, v * 0.9, p, 'triangle'); }); return 2.9; },
      crickets: function (v, p) { for (var i = 0; i < 4; i++) for (var q = 0; q < 3; q++) sweep(4600, 4600, i * 0.55 + q * 0.045, 0.03, v, p, 'square'); return 2.2; },
      treefrog: function (v, p) { for (var i = 0; i < 2; i++) sweep(1700, 1500, i * 0.7, 0.18, v, p, 'sawtooth'); return 0.9; },
      owl: function () { var v = 0.05 * Math.max(0.25, 1 - 20 / 30); [[0, 0.3], [0.45, 0.22], [0.75, 0.55], [1.5, 0.35], [2.0, 0.35]].forEach(function (q) { sweep(330, 300, q[0], q[1], v, 0.3, 'triangle'); }); return 2.4; },
      thunder: function () { oNoise(2.2, 160, 0.5); oNoise(0.5, 700, 0.12); return 2.2; }
    };
    // the old creek and rain went on and on: these play 8 seconds of each, at the levels the game used
    function oldBed(kind) {
      var len = ctx.sampleRate * 3, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0), last = 0;
      for (var i = 0; i < len; i++) { var wv = Math.random() * 2 - 1; if (kind === 'creek') { last = (last + 0.02 * wv) / 1.02; d[i] = last * 3.5; } else d[i] = wv; }
      var s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; var f = ctx.createBiquadFilter();
      if (kind === 'creek') { f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 0.6; } else { f.type = 'lowpass'; f.frequency.value = 2200; }
      var g = ctx.createGain(), t = ctx.currentTime, v = kind === 'creek' ? 0.02 + 0.07 * 0.6 * 0.6 : 0.16;
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + 0.5); g.gain.setValueAtTime(v, t + 7.5); g.gain.linearRampToValueAtTime(0, t + 8);
      s.connect(f); f.connect(g); g.connect(legacyOut); s.start(t); s.stop(t + 8.1); return 8;
    }
    N.legacy = function (id) {
      var v = 0.012 + Math.random() * 0.01, p = Math.random() * 1.6 - 0.8;
      if (id === 'creek' || id === 'rain') return oldBed(id);
      if (id === 'crickets') return OLD.crickets(v * 0.45, p);
      if (id === 'treefrog') return OLD.treefrog(v * 0.5, p);
      if (id === 'dove') return OLD.dove(v * 1.3, p);
      return OLD[id] ? OLD[id](v, p) : 0;
    };
    N.hasLegacy = function (id) { return id === 'creek' || id === 'rain' || !!OLD[id]; };

    // the board's settings, as a short line of text Chris can send back ("owl 80, crickets 120, coyote on")
    N.settingsText = function () {
      var parts = [];
      META.forEach(function (m) { var u = N.user[m.id]; if (!u) return; var on = u.on == null ? !m.off : u.on, g = Math.round((u.gain == null ? 1 : u.gain) * 100); if (on !== !m.off) parts.push(m.id + ' ' + (on ? 'on' : 'off')); if (on && g !== 100) parts.push(m.id + ' ' + g); });
      return 'WWB sounds: ' + (parts.length ? parts.join(', ') : 'all as they are');
    };
    return N;
  }

  global.PKNature = { make: make, META: META, LEVEL: LEVEL, RANGE: RANGE };
})(typeof window !== 'undefined' ? window : this);
