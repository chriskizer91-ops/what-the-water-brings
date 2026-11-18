import sys, os, json
from playwright.sync_api import sync_playwright
JS = r"""
(async () => {
  const W = window.WWB; W.pause(true); W.watch.start(); const log = [];
  for (let k = 0; k < 40; k++) { W.tick(60, 20); log.push(W.watch.state.i + ':' + W.watch.state.phase); if (!W.watch.state.on) break; await new Promise(r => setTimeout(r, 0)); }
  return { log: log.join(' '), on: W.watch.state.on, credits: !document.getElementById('creditVeil') ? null : !document.getElementById('creditVeil').hidden, seen: Object.keys(W.save.seen).length };
})()
"""
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'])
    pg = b.new_context(viewport={'width': 640, 'height': 360}).new_page()
    errs = []
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' and 'Failed to load resource' not in m.text else None)
    pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
    pg.route('**/*', lambda r: r.continue_() if r.request.url.startswith('file:') else r.abort())
    pg.goto('file://' + os.path.abspath(sys.argv[1]) + '?fresh&q=low')
    pg.wait_for_function('window.WWB && window.WWB.ready', timeout=120000)
    print(json.dumps(pg.evaluate(JS))); print('ERRORS', errs[:6] if errs else 'none')
    b.close()
