"""Side-by-side review sheet of generated stills at half size, labelled — used for the anatomy gate."""
import sys
from PIL import Image, ImageDraw
paths, out = sys.argv[1:-1], sys.argv[-1]
ims = [Image.open(p).convert('RGB').resize((384, 672)) for p in paths]
sheet = Image.new('RGB', (len(ims) * 394, 700), '#111')
for i, (p, im) in enumerate(zip(paths, ims)):
    sheet.paste(im, (i * 394, 0)); ImageDraw.Draw(sheet).text((i * 394 + 6, 680), p.split('/')[-1], fill='#ffcc66')
sheet.save(out, quality=90)
