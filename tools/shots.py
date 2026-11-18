# Take screenshots of the game after scripted steps.  usage: shots.py <page.html> <outdir> <w>x<h> <name:js;...> ...
import sys, os, json, time
from playwright.sync_api import sync_playwright
page_path, outdir, size = sys.argv[1], sys.argv[2], sys.argv[3]
steps = sys.argv[4:]
w, h = [int(v) for v in size.split('x')]
os.makedirs(outdir, exist_ok=True)
q = os.environ.get('WWB_Q', '?fresh&q=medium&shots')
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'])
    ctx = b.new_context(viewport={'width': w, 'height': h}, device_scale_factor=1, has_touch=(os.environ.get('WWB_TOUCH') == '1'), is_mobile=(os.environ.get('WWB_TOUCH') == '1'))
    pg = ctx.new_page()
    errs = []
    pg.on('console', lambda m: errs.append(m.text) if m.type in ('error',) else None)
    pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
    pg.route('**/*', lambda r: r.continue_() if r.request.url.startswith('file:') else r.abort())
    pg.goto('file://' + os.path.abspath(page_path) + q)
    pg.wait_for_function('window.WWB && window.WWB.ready', timeout=120000)
    for s in steps:
        name, js = s.split(':', 1)
        t0 = time.time()
        r = pg.evaluate('(async()=>{' + js + '})()')
        pg.wait_for_timeout(250)
        if not name.startswith('_'):
            pg.screenshot(path=os.path.join(outdir, name + '.png'))
        print(name, round(time.time() - t0, 1), 's', json.dumps(r) if r is not None else '')
    if errs: print('ERRORS', errs[:8])
    b.close()
