# Build the sound board: tools/soundboard_template.html with the game's own sound engine (src/25_nature.js) inside it.
import os, json
here = os.path.dirname(os.path.abspath(__file__)); root = os.path.dirname(here)
t = open(os.path.join(here, 'soundboard_template.html'), encoding='utf8').read()
eng = open(os.path.join(root, 'src', '25_nature.js'), encoding='utf8').read()
scenes = json.load(open(os.path.join(here, 'nature_scenes.json')))
page = t.replace('/*NATURE*/', eng).replace('/*SCENES*/', json.dumps(scenes))
os.makedirs(os.path.join(root, 'out'), exist_ok=True)
open(os.path.join(root, 'out', 'soundboard.html'), 'w', encoding='utf8').write(page)
print('built out/soundboard.html', len(page.encode('utf8')), 'bytes')
