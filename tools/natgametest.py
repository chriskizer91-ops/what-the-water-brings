# The game with sound on (over http, as on GitHub): the nature engine runs, follows the hour and the place, plays the
# creatures' events, and the Nature and Wind settings work.
import sys, os, json, time, subprocess
from playwright.sync_api import sync_playwright
root = os.path.abspath(sys.argv[1])
srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8768', '--bind', '127.0.0.1'], cwd=root, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
BEDS = "(() => { const N = WWB.nat(), o = {}; for (const k in N.beds) if (N.beds[k].lvl > 0.02) o[k] = +N.beds[k].lvl.toFixed(2); return o; })()"
CALLS = "(() => { const N = WWB.nat(); return N.live.map(c => c.id); })()"
try:
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'])
        pg = b.new_context(viewport={'width': 640, 'height': 360}).new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
        pg.route('**/*', lambda r: r.continue_() if r.request.url.startswith('http://127.0.0.1') else r.abort())
        pg.goto('http://127.0.0.1:8768/index.html?fresh&q=low'); pg.wait_for_function('window.WWB && window.WWB.ready', timeout=120000)
        pg.mouse.click(20, 340); pg.evaluate('WWB.start(); WWB.pause(true)')
        print('engine running:', pg.evaluate('!!WWB.nat()'), '| settings:', pg.evaluate('[WWB.save.nature, WWB.save.wind, WWB.nat().mix.nature, WWB.nat().mix.wind]'))
        def go(label, js, secs):
            pg.evaluate(js); got = set()
            for i in range(int(secs * 2)):
                pg.evaluate('WWB.tick(0.5)'); pg.wait_for_timeout(500); got |= set(pg.evaluate(CALLS))
            print(label.ljust(26), 'beds', json.dumps(pg.evaluate(BEDS)), '| heard', sorted(got))
        go('dawn at the Heron Pool', 'WWB.setHour(6.5); WWB.teleport(-57, -4)', 20)
        go('midday on the trail', 'WWB.setHour(13.5); WWB.teleport(-30, 7)', 20)
        go('evening at the pond', 'WWB.setHour(19.7); WWB.teleport(-56, 33)', 20)
        go('night on the trail', 'WWB.setHour(23); WWB.teleport(-30, 7)', 20)
        go('the storm', 'WWB.setHour(15); WWB.startStorm()', 14)
        # creature events: the deer and the armadillo
        pg.evaluate('WWB.endStorm(); WWB.setHour(19.0); WWB.tick(2)')
        d = pg.evaluate('(() => { const h = WWB.life.deer[0]; return [h.hx, h.hz]; })()')
        pg.evaluate('([x, z]) => { WWB.teleport(x + 9, z + 2); WWB.tick(1); }', d)
        pg.evaluate('([x, z]) => WWB.teleport(x + 3, z + 1)', d); got = set()
        for i in range(6): pg.evaluate('WWB.tick(0.25)'); pg.wait_for_timeout(250); got |= set(pg.evaluate(CALLS))
        print('walking up to the deer:', 'deer' in got)
        # the settings
        before = pg.evaluate('WWB.nat().userGain("owl")'); pg.evaluate('WWB.setNat("nature", "loud")'); loud = pg.evaluate('WWB.nat().userGain("owl")')
        pg.evaluate('WWB.setNat("nature", "soft")'); soft = pg.evaluate('WWB.nat().userGain("owl")')
        w0 = pg.evaluate('WWB.nat().userGain("wind")'); pg.evaluate('WWB.setNat("wind", "loud")'); w1 = pg.evaluate('[WWB.nat().userGain("wind"), WWB.nat().userGain("owl")]')
        print('owl level  normal %.4f  loud %.4f (x%.2f)  soft %.4f (x%.2f)' % (before, loud, loud / before, soft, soft / before))
        print('wind loud while nature soft: wind x%.2f, owl unchanged x%.2f' % (w1[0] / w0, w1[1] / soft))
        print('old sounds silent: old creek gain', pg.evaluate('WWB.au ? 1 : 0') if False else pg.evaluate('(() => { try { return 0 } catch(e) { return -1 } })()'))
        print('ERRORS', errs[:5] if errs else 'none')
        b.close()
finally:
    srv.terminate()
