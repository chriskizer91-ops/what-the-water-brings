# Render each nature sound offline in a browser and measure it: the loudest moment (momentary loudness, 400 ms), the
# overall loudness and the peak. usage: nature_measure.py <jobs.json> <out.json> [wav dir]
import sys, os, json, base64, re, subprocess, tempfile
from playwright.sync_api import sync_playwright
jobs = json.load(open(sys.argv[1])); outp = sys.argv[2]; wdir = sys.argv[3] if len(sys.argv) > 3 else None
here = os.path.dirname(os.path.abspath(__file__))
def loud(path):
    o = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', path, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
    M = [float(x) for x in re.findall(r' M:\s*(-?[\d.]+)', o)]
    I = re.findall(r'I:\s+(-?[\d.]+) LUFS', o); pk = re.findall(r'Peak:\s+(-?[\d.]+) dBFS', o)
    return {'Mmax': max(M) if M else None, 'I': float(I[-1]) if I else None, 'peak': float(pk[-1]) if pk else None}
res = {}
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', args=['--no-sandbox', '--autoplay-policy=no-user-gesture-required'])
    pg = b.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    pg.goto('file://' + os.path.join(here, 'nature_render.html')); pg.wait_for_function('window.ready')
    for name, job in jobs.items():
        tries = job.get('tries', 1); vals = []
        for k in range(tries):
            r = pg.evaluate('j => render(j)', job)
            path = os.path.join(wdir, name + ('' if k == 0 else '-%d' % k) + '.wav') if wdir else tempfile.mktemp(suffix='.wav')
            open(path, 'wb').write(base64.b64decode(r['b64']))
            vals.append(loud(path))
            if not wdir: os.remove(path)
        avg = lambda key: round(sum(v[key] for v in vals if v[key] is not None) / max(1, len([v for v in vals if v[key] is not None])), 1) if any(v[key] is not None for v in vals) else None
        res[name] = {'Mmax': avg('Mmax'), 'I': avg('I'), 'peak': avg('peak')}
        print(name.ljust(22), res[name], flush=True)
    if errs: print('ERRORS', errs[:5])
    b.close()
json.dump(res, open(outp, 'w'), indent=1)
