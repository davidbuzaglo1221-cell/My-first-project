"""Contact sheet: one frame every 0.4 s (each beat) of a rendered video, labelled with the time."""
import subprocess, sys, os, tempfile
from PIL import Image, ImageDraw

video, out = sys.argv[1], sys.argv[2]
step = float(sys.argv[3]) if len(sys.argv) > 3 else 0.4
tmp = tempfile.mkdtemp()
subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', video, '-vf', f'fps=1/{step},scale=216:384', os.path.join(tmp, 'f%03d.png')], check=True)
files = sorted(os.listdir(tmp)); cols = 10; rows = (len(files) + cols - 1) // cols
sheet = Image.new('RGB', (cols * 220, rows * 404), '#111')
for i, f in enumerate(files):
    im = Image.open(os.path.join(tmp, f)); x, y = (i % cols) * 220, (i // cols) * 404
    sheet.paste(im, (x + 2, y + 2)); ImageDraw.Draw(sheet).text((x + 6, y + 386), f'{i * step:.1f}s', fill='#ffcc66')
sheet.save(out, quality=85); print(out, len(files), 'frames')
