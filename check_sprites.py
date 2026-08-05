from PIL import Image
import os

im = Image.open('public/sprites/rosie-front.png')
print('rosie-front:', im.size, im.mode)
px = im.convert('RGBA')
data = list(px.getdata())
opaque = sum(1 for p in data if p[3] > 10)
print('opaque px: %d/%d = %.1f%%' % (opaque, len(data), opaque/len(data)*100))

# Verify every sprite has content and reasonable alpha coverage
print('\n--- all sprites ---')
for fn in sorted(os.listdir('public/sprites')):
    if not fn.endswith('.png'): continue
    im = Image.open(os.path.join('public/sprites', fn)).convert('RGBA')
    data = list(im.getdata())
    opaque = sum(1 for p in data if p[3] > 10)
    pct = opaque/len(data)*100
    flag = '' if pct > 5 else '  <-- SUSPICIOUS'
    print(f'{fn:32s} {im.size[0]}x{im.size[1]}  opaque={pct:.1f}%{flag}')
