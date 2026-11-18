# Play the whole game by script and report what happened.  usage: flow.py <page.html>
import sys, os, json
from playwright.sync_api import sync_playwright
page_path = sys.argv[1]
JS = r"""
(async () => {
  const W = window.WWB, out = {}; const $ = id => document.getElementById(id);
  const close = () => { document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape'})); ['poemClose','studioClose','journalClose','doneClose','menuClose','mapClose','restClose'].forEach(id => { const b=$(id); if (b && b.offsetParent) b.click(); }); };
  W.start(); W.pause(true); W.tick(3);
  const grab = () => { let n = 0; W.items.forEach(f => { if (W.available(f)) { const o = W.findObj[f.id]; W.teleport(o.x + 0.3, o.z + 0.3); W.pickUp(f); W.tick(4); close(); W.tick(4); n++; } }); return n; };
  out.wave1 = grab();
  out.poems = 0; W.poems.forEach(pm => { const s = W.world.spots.poems[pm.id]; W.teleport(s.x + 0.4, s.z + 0.4); W.tick(0.5); W.act(); W.tick(2); if (!$('poemVeil').hidden) out.poems++; close(); W.tick(1); });
  W.openStudio(); W.tick(1); close(); W.tick(1);
  W.startStorm(); W.tick(20); W.endStorm(); W.setHour(8); W.tick(5);
  out.wave2 = grab();
  W.setHour(22); W.tick(3); out.night = grab();
  W.openStudio(); W.tick(1); out.studio = $('sCount').textContent; close(); W.tick(2); close(); W.tick(2);
  // skip a stone, see some creatures
  const s = W.skips[0]; W.setHour(10); W.teleport(s.x + 0.4, s.z + 0.4); W.tick(1); W.act(); W.tick(8); out.skip = JSON.stringify(W.save.skip);
  W.journal(); out.journal = [...document.querySelectorAll('#jBook summary')].map(e => e.textContent).join(' | '); close();
  out.counts = [$('nFind').textContent, $('nSolid').textContent, $('nPoem').textContent].join(' ');
  // the ending
  const c = W.world.spots.cave; W.teleport(c.x, c.z); W.tick(1); out.caveReady = W.ending.ready(); W.ending.start();
  let t = 0; while (t < 200 && $('endVeil').hidden) { W.tick(1); t++; }
  out.endingSeconds = t; out.lastPage = !$('endVeil').hidden; out.done = !!W.save.done;
  out.seen = Object.keys(W.save.seen).length + ' of ' + W.field.length;
  return out;
})()
"""
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'])
    pg = b.new_context(viewport={'width': 960, 'height': 540}).new_page()
    errs = []
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text else None)
    pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
    pg.route('**/*', lambda r: r.continue_() if r.request.url.startswith('file:') else r.abort())
    pg.goto('file://' + os.path.abspath(page_path) + '?fresh&q=low')
    pg.wait_for_function('window.WWB && window.WWB.ready', timeout=120000)
    r = pg.evaluate(JS)
    print(json.dumps(r, indent=1)); print('ERRORS', errs[:6] if errs else 'none')
    b.close()
