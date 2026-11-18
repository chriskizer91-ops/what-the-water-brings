# Check that every recording is reachable from the game, and that speech plays the files.
import sys, os, json, time, subprocess
from playwright.sync_api import sync_playwright
root = os.path.abspath(sys.argv[1])
JS = r"""
(async () => {
  const W = window.WWB, F = window.PKWaterFinds, R = window.WWB_VOICE, used = new Set(), out = {};
  const stem = src => src ? src.replace(/^voice\//, '').replace(/\.mp3$/, '') : null, mark = src => { const s = stem(src); if (s) used.add(s); return !!s; };
  out.finds = W.items.filter(f => mark(W.rec('find-' + f.id.toLowerCase()))).length + ' of ' + W.items.length;
  out.poemStops = F.POEMS.filter(pm => mark(W.poemRec(pm))).length + ' of ' + F.POEMS.length;
  out.shapePoems = Object.keys(F.SOLID_POEMS).filter(k => mark(W.poemRec(F.SOLID_POEMS[k]))).length + ' of 5';
  mark(W.poemRec(F.ENDING)); mark(W.rec('poem-starworship')); mark(W.poemRec(F.OPENING)); mark(W.rec('line-every-box-full')); mark(W.rec('ending-cave')); mark(W.rec('ending-dawn')); [1,2,3].forEach(i => mark(W.rec('ending-teal-' + i)));
  out.boxes = F.COLLS.filter(c => mark(W.rec('box-' + c.id))).length + ' of ' + F.COLLS.length; out.cards = F.COLLS.filter(c => mark(W.rec('card-' + c.id))).length + ' of ' + F.COLLS.length;
  out.notices = F.NOTICE.filter(n => mark(W.recFor(n))).length + ' of ' + F.NOTICE.length;
  const vn = t => String(t).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  out.ponderLines = F.PONDER.filter(q => { const k = vn(q.line); for (const t in R.text) if (/^ponder-line-/.test(R.text[t]) && t.indexOf(k) === 0) { used.add(R.text[t]); return true; } return false; }).length + ' of ' + F.PONDER.length;
  ['icosa','octa','cube','tetra','dodeca'].forEach(k => mark(W.rec('ponder-faces-' + k))); ['close-end','close','not-far','long-way'].forEach(k => mark(W.rec('ponder-far-' + k)));
  ['north','north-east','east','south-east','south','south-west','west','north-west'].forEach(k => mark(W.rec('ponder-dir-' + k)));
  // everything matched by its words (short lines, Watch lines, notes, hints): counted as reachable if the words are in the game (checked by build-side script)
  for (const t in R.text) { const s = R.text[t]; if (/^(watch|line|note|ponder-hint)/.test(s)) used.add(s); }
  out.reachable = used.size + ' of ' + Object.keys(R.files).length; out.notReached = Object.keys(R.files).filter(f => !used.has(f));
  // now really speak: a find, then Ponder (several pieces in a row)
  W.start(); W.pause(true); W.tick(2); W.voice(true); await new Promise(r => setTimeout(r, 300));
  const f = W.items.find(q => q.id === 'stick'); const o = W.findObj.stick; W.teleport(o.x + 0.3, o.z + 0.3); W.pickUp(f); W.tick(1);
  await new Promise(r => setTimeout(r, 1500)); const a = W.voiceState.audio; out.findPlaying = a ? [a.src.split('/').pop(), +a.currentTime.toFixed(1), a.paused, W.speechBusy()] : 'no audio';
  W.tick(1); out.musicDuck = +W.music.duck.toFixed(2);
  document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape'})); W.tick(12);
  const seen = []; W.ponder(); for (let i = 0; i < 40; i++) { await new Promise(r => setTimeout(r, 700)); W.tick(0.2); const b = W.voiceState.audio; const n = b ? b.src.split('/').pop() : (W.speechBusy() ? '(computer voice)' : '(silent)'); if (seen[seen.length - 1] !== n) seen.push(n); if (!W.speechBusy()) break; }
  out.ponderPlayed = seen; out.ponderText = W.PON.text;
  return out;
})()
"""
srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8766', '--bind', '127.0.0.1'], cwd=root, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'])
        pg = b.new_context(viewport={'width': 640, 'height': 360}).new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
        pg.route('**/*', lambda r: r.continue_() if r.request.url.startswith('http://127.0.0.1') else r.abort())
        pg.goto('http://127.0.0.1:8766/index.html?fresh&q=low'); pg.wait_for_function('window.WWB && window.WWB.ready', timeout=120000)
        pg.mouse.click(20, 340)
        print(json.dumps(pg.evaluate(JS), indent=1)); print('ERRORS', errs[:5] if errs else 'none')
        b.close()
finally:
    srv.terminate()
