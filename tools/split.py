# Split the published page into parts so each can be edited, and so build.py can glue them back.
import sys, os, json
src, out = sys.argv[1], sys.argv[2]
L = open(src, encoding='utf8').read().split('\n')
def seg(a, b): return '\n'.join(L[a-1:b])   # 1-based inclusive
parts = [
 ('00_head.html',      2, 580),      # title, fonts, css, markup (wrapper line 1 dropped)
 ('01_vendor.js',    582, 1420),     # three.js r128 + helpers
 ('10_core.js',     1423, 1680), ('11_skin.js', 1681, 1861), ('12_fabric.js', 1862, 2294), ('13_body3.js', 2295, 2678),
 ('14_wear.js',     2679, 3047), ('15_king3.js', 3048, 3623), ('16_toon.js', 3624, 3965), ('17_toon2.js', 3966, 4338),
 ('18_pixel3d.js',  4339, 4556), ('19_cardassets.js', 4557, 4560), ('20_card.js', 4561, 4643),
 ('30_valley.js',   4644, 6120), ('31_finds.js', 6121, 6844), ('32_life.js', 6845, 7329), ('40_main.js', 7330, 9593),
 ('99_tail.html',   9595, 9596),
]
os.makedirs(out, exist_ok=True)
for name, a, b in parts:
    open(os.path.join(out, name), 'w', encoding='utf8').write(seg(a, b))
json.dump({'line1': L[0], 'l581': L[580], 'l1421': L[1420], 'l1422': L[1421], 'l9594': L[9593], 'last': L[9596:]}, open(os.path.join(out, '_glue.json'), 'w'))
print('ok', [ (n, b-a+1) for n,a,b in parts ])
