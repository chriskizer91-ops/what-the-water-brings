#!/usr/bin/env python3
# Glue the parts in src/ back into one page.  out/index.html is the page for GitHub (and the artifact).
import os, sys, glob, json, hashlib
here = os.path.dirname(os.path.abspath(__file__))
S = os.path.join(here, 'src')
def rd(n): return open(os.path.join(S, n), encoding='utf8').read()
g = json.load(open(os.path.join(S, '_glue.json')))
names = sorted(os.path.basename(p) for p in glob.glob(os.path.join(S, '*.js')))
vendor = [n for n in names if n.startswith('0')]
game = [n for n in names if not n.startswith('0')]
HEAD = '''<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="description" content="Richard Sale, the Philosopher King, walks down to Tom's creek after a week of high water, to see what it has brought.">
<meta property="og:title" content="What the Water Brings"><meta property="og:description" content="The Philosopher King walks a creek valley the morning after the flood. Finds, five old shapes, and poems kept along the way.">
<meta name="theme-color" content="#1b1a18">
<style>:root{box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}html{scroll-padding-top:env(safe-area-inset-top,0px)}body{margin:0;padding:0}img{max-width:100%}[hidden]:not([hidden=until-found i]){display:none!important}</style></head><body>'''
line1 = g['line1'] if '--wrapped' in sys.argv else HEAD
# the recorded voice: every MP3 in voice/ is listed for the game as window.WWB_VOICE.
#   files: the recordings there are (by name, without .mp3).  text: what each one says, boiled down to letters and digits, so a line
#   the game is about to speak can be matched to its recording (tools/voice_items.json holds the words, from the recording checklist).
import re
def norm(t): return re.sub(r'[^a-z0-9]+', ' ', t.lower()).strip()
vdir = os.path.join(here, 'voice'); voice = {'files': {}, 'text': {}}
if os.path.isdir(vdir):
    have = sorted(f[:-4] for f in os.listdir(vdir) if f.endswith('.mp3'))
    voice['files'] = {f: 1 for f in have}
    for it in json.load(open(os.path.join(here, 'tools', 'voice_items.json'), encoding='utf8')):
        if it['stem'] in voice['files'] and it['stem'] != 'ponder-far-close-end': voice['text'][norm(it['text'].replace('\\', ' '))] = it['stem']
VOICE_JS = 'window.WWB_VOICE = ' + json.dumps(voice, separators=(',', ':')) + ';'
doc = [line1, rd('00_head.html'), '<script>', VOICE_JS, *[rd(n) for n in vendor], '</script>', '<script>', *[rd(n) for n in game], '</script>', rd('99_tail.html'), *g['last']]
page = '\n'.join(doc)
os.makedirs(os.path.join(here, 'out'), exist_ok=True)
open(os.path.join(here, 'out', 'index.html'), 'w', encoding='utf8').write(page)
import shutil
if os.path.isdir(vdir):   # the recordings go beside the page too
    shutil.copytree(vdir, os.path.join(here, 'out', 'voice'), dirs_exist_ok=True)
if os.path.isdir(os.path.join(here, 'music')):   # the songs go beside the page
    shutil.copytree(os.path.join(here, 'music'), os.path.join(here, 'out', 'music'), dirs_exist_ok=True)
print('built out/index.html', len(page.encode('utf8')), 'bytes', hashlib.md5(page.encode('utf8')).hexdigest()[:8])
# and the sound board, beside the game
import subprocess
subprocess.run([sys.executable, os.path.join(here, 'tools', 'build_board.py')], check=True)
