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
doc = [line1, rd('00_head.html'), '<script>', *[rd(n) for n in vendor], '</script>', '<script>', *[rd(n) for n in game], '</script>', rd('99_tail.html'), *g['last']]
page = '\n'.join(doc)
os.makedirs(os.path.join(here, 'out'), exist_ok=True)
open(os.path.join(here, 'out', 'index.html'), 'w', encoding='utf8').write(page)
import shutil
if os.path.isdir(os.path.join(here, 'music')):   # the songs go beside the page
    shutil.copytree(os.path.join(here, 'music'), os.path.join(here, 'out', 'music'), dirs_exist_ok=True)
print('built out/index.html', len(page.encode('utf8')), 'bytes', hashlib.md5(page.encode('utf8')).hexdigest()[:8])
