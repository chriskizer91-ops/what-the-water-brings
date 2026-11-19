# Check the sound board in a browser, served over http (as on GitHub): every sound plays, scenes run, settings text works.
import sys, os, json, time, subprocess
from playwright.sync_api import sync_playwright
root = os.path.abspath(sys.argv[1]); outdir = sys.argv[2]; os.makedirs(outdir, exist_ok=True)
srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8767', '--bind', '127.0.0.1'], cwd=root, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
try:
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox', '--autoplay-policy=no-user-gesture-required'])
        ctx = b.new_context(viewport={'width': 412, 'height': 915}, device_scale_factor=2, is_mobile=True, has_touch=True)
        pg = ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        pg.route('**/*', lambda r: r.continue_() if r.request.url.startswith('http://127.0.0.1') or 'fonts.g' in r.request.url else r.abort())
        pg.goto('http://127.0.0.1:8767/soundboard.html'); pg.wait_for_timeout(800)
        pg.screenshot(path=os.path.join(outdir, 'b0_start.png'))
        pg.click('#go'); pg.wait_for_timeout(500); pg.screenshot(path=os.path.join(outdir, 'b1_top.png'))
        # every sound's play button
        ids = pg.evaluate('PKNature.META.map(m => m.id)'); played = {}
        for i in ids:
            pg.evaluate("id => SB.rows[id].querySelector('.play').click()", i); pg.wait_for_timeout(120)
            played[i] = pg.evaluate("id => (SB.N.live.some(c => c.id === id) || !!SB.bedOn[id] || (SB.user[id] && SB.user[id].on === false) || (PKNature.META.find(m=>m.id===id).off))", i)
            if pg.evaluate("id => !!SB.bedOn[id]", i): pg.evaluate("id => SB.rows[id].querySelector('.play').click()", i)
        print('every play button:', sum(played.values()), 'of', len(ids), [k for k, v in played.items() if not v])
        # the coyotes are left out by default: turn them on, play, check
        pg.evaluate("SB.rows.coyote.querySelector('.name').click(); SB.rows.coyote.querySelector('.seg [data-v=on]').click(); SB.rows.coyote.querySelector('.play').click()"); pg.wait_for_timeout(150)
        print('coyote after turning on:', pg.evaluate("SB.N.live.some(c => c.id === 'coyote')"))
        # the owl: open its panel and set 80%
        pg.evaluate("SB.rows.owl.querySelector('.name').click(); const r = SB.rows.owl.querySelector('input'); r.value = 80; r.dispatchEvent(new Event('input'))")
        print('settings text:', pg.evaluate("document.getElementById('txt').textContent"))
        # scenes: each runs and things call
        for sc in ['dawn', 'day', 'evening', 'night', 'storm', 'cave']:
            pg.evaluate("s => SB.playScene(s)", sc); pg.wait_for_timeout(9000)
            st = pg.evaluate("(() => { const N = SB.N, beds = {}; for (const k in N.beds) if (N.beds[k].lvl > 0.02) beds[k] = +N.beds[k].lvl.toFixed(2); return { beds, now: document.getElementById('now').textContent }; })()")
            print(sc.ljust(8), json.dumps(st))
            if sc == 'night': pg.evaluate("SB.rows.owl.scrollIntoView({block:'center'})"); pg.wait_for_timeout(200); pg.screenshot(path=os.path.join(outdir, 'b2_owl.png'))
        pg.evaluate("document.getElementById('narr').click(); document.getElementById('mus').click()"); pg.evaluate("SB.playScene('evening')"); pg.wait_for_timeout(4000)
        print('narration and music:', pg.evaluate("(() => { const a = [...document.querySelectorAll('audio')]; return { narr: document.getElementById('narr').getAttribute('aria-pressed'), mus: document.getElementById('mus').textContent }; })()"))
        pg.evaluate("window.scrollTo(0,0)"); pg.wait_for_timeout(200); pg.screenshot(path=os.path.join(outdir, 'b3_playing.png'))
        print('ERRORS', errs[:6] if errs else 'none')
        b.close()
finally:
    srv.terminate()
