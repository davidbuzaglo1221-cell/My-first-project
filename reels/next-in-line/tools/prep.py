"""Copy the stills that passed the anatomy gate into public/ at 1080 wide (Lanczos + light unsharp).

PICKS maps the edit's image name -> the generated file that passed review. Rejected files live in gen/rejected/.
"""
import os
from PIL import Image, ImageFilter, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PICKS = {
    's01': 's01_11', 's02': 's02_23', 's03': 's03_v1', 's04': 's04_23', 's05': 's05_37', 's05b': 's05_23',
    's07': 's07_11', 's08': 's08_11', 's09': 's09_11', 's09b': 's09_v1', 's10': 's10_11', 's11': 's11_11',
    's12': 's12_11', 's13': 's13_11',
}
RETOUCH = {'s04_23': [(332, 425, 428, 467)]}  # source-pixel boxes

for name, src in PICKS.items():
    p = os.path.join(ROOT, 'gen', src + '.png')
    if not os.path.exists(p):
        print('missing', src); continue
    im = Image.open(p).convert('RGB')
    for box in RETOUCH.get(src, []):   # soften generated pseudo-text (logos, signs) so it doesn't read as AI gibberish
        mask = Image.new('L', im.size, 0); ImageDraw.Draw(mask).rounded_rectangle(box, radius=12, fill=255)
        im = Image.composite(im.filter(ImageFilter.GaussianBlur(7)), im, mask.filter(ImageFilter.GaussianBlur(6)))
    im = im.resize((1080, round(im.height * 1080 / im.width)), Image.LANCZOS)
    im = im.filter(ImageFilter.UnsharpMask(radius=1.4, percent=55, threshold=2))
    im.save(os.path.join(ROOT, 'public', name + '.jpg'), quality=93)
    print(name, '<-', src)
