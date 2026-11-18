import sys, os, json
from playwright.sync_api import sync_playwright
JS = r"""
(async () => {
  const W = window.WWB; W.start(); W.pause(true); W.tick(3); const out = {};
  for (const [name, x, z, h] of [['trail, day', -30, 7, 10], ['pond, evening', -53, 35, 18.6], ['creek, night', 12, 3, 22]]) {
    W.setHour(h); W.teleport(x, z); W.tick(2); W.snap(); for (let i = 0; i < 5; i++) W.step(1/30);
    const gl = W.renderer.getContext(); const t0 = performance.now(); for (let i = 0; i < 30; i++) { W.tick(1/30); W.render(); } gl.finish(); out[name] = +((performance.now() - t0) / 30).toFixed(1);
  }
  const t1 = performance.now(); W.tick(20); out['game logic, ms per frame'] = +((performance.now() - t1) / 600).toFixed(3);
  out.triangles = W.tris().all;
  return out;
})()
"""
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox'])
    for path in sys.argv[1:]:
        pg = b.new_context(viewport={'width': 1280, 'height': 720}).new_page()
        pg.route('**/*', lambda r: r.continue_() if r.request.url.startswith('file:') else r.abort())
        pg.goto('file://' + os.path.abspath(path) + '?fresh&q=medium')
        pg.wait_for_function('window.WWB && window.WWB.ready', timeout=120000)
        print(os.path.basename(os.path.dirname(os.path.abspath(path))) + '/' + os.path.basename(path), json.dumps(pg.evaluate(JS)))
        pg.close()
    b.close()
