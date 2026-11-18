# Check the music player against a real (headless) browser, served over http so the mixer path is used.
import sys, os, json, time, subprocess
from playwright.sync_api import sync_playwright
root = os.path.abspath(sys.argv[1]); mode = sys.argv[2] if len(sys.argv) > 2 else 'http'
srv = subprocess.Popen([sys.executable, '-m', 'http.server', '8765', '--bind', '127.0.0.1'], cwd=root, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL) if mode == 'http' else None
time.sleep(1)
STATE = "(() => { const M = WWB.music; return { scene: M.scene, cur: M.cur, rest: Math.round(M.rest), decks: M.decks.map(d => ({ name: d.name, goal: d.goal, vol: +d.vol.toFixed(2), gain: d.g ? +d.g.gain.value.toFixed(3) : 'vol ' + d.a.volume.toFixed(3), t: +d.a.currentTime.toFixed(1), paused: d.a.paused })) }; })()"
try:
    with sync_playwright() as p:
        b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'])
        pg = b.new_context(viewport={'width': 640, 'height': 360}).new_page()
        errs = []
        pg.on('pageerror', lambda e: errs.append('PAGEERROR ' + str(e)))
        url = 'http://127.0.0.1:8765/index.html?fresh&q=low' if mode == 'http' else 'file://' + os.path.join(root, 'index.html') + '?fresh&q=low'
        pg.route('**/*', lambda r: r.continue_() if (r.request.url.startswith('http://127.0.0.1') or r.request.url.startswith('file:')) else r.abort())
        pg.goto(url); pg.wait_for_function('window.WWB && window.WWB.ready', timeout=120000)
        def show(label): print(label.ljust(34), json.dumps(pg.evaluate(STATE)))
        pg.mouse.click(20, 340); pg.evaluate('WWB.pause(true); WWB.tick(2)'); pg.wait_for_timeout(1500); pg.evaluate('WWB.tick(3)'); show('title, after the first touch')
        pg.evaluate('WWB.start(); WWB.pause(true); WWB.tick(6)'); show('6 s into play')
        pg.evaluate('WWB.tick(18)'); pg.wait_for_timeout(1500); pg.evaluate('WWB.tick(3)'); show('about 27 s into play')
        pg.evaluate('(() => { const d = WWB.music.decks.find(d => d.goal > 0); d.a.currentTime = d.a.duration - 1.5; })()'); pg.wait_for_timeout(3500); pg.evaluate('WWB.tick(1)'); show('after that song ends')
        pg.evaluate('WWB.tick(WWB.music.rest + 1)'); pg.wait_for_timeout(1500); pg.evaluate('WWB.tick(3)'); show('after the rest: next day song')
        pg.evaluate('WWB.setHour(18.6); WWB.tick(8)'); show('evening falls, 8 s on')
        pg.evaluate('WWB.tick(4)'); pg.wait_for_timeout(1500); pg.evaluate('WWB.tick(3)'); show('evening song')
        pg.evaluate('WWB.startStorm(); WWB.tick(6)'); show('storm, 6 s on')
        pg.evaluate('WWB.tick(60)'); show('storm, a minute on')
        pg.evaluate('WWB.endStorm(); WWB.setHour(22); WWB.tick(50)'); pg.wait_for_timeout(1500); pg.evaluate('WWB.tick(3)'); show('night, 53 s after the storm')
        print('ERRORS', errs[:5] if errs else 'none')
        b.close()
finally:
    if srv: srv.terminate()
