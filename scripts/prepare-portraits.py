"""
Prepares the team portraits for the website from the originals, without changing the originals.

    python -B scripts/prepare-portraits.py <persona-folder> [--out public/team] [--check]

For each confirmed member photo it crops a square head-and-shoulders frame around the face, resizes it to
640 px (or less when the source is smaller), applies a gentle sharpen only when upscaling, and writes WebP and
JPEG copies with no metadata (EXIF, GPS and colour-profile chunks are dropped). The site shows the portraits in
a circular frame; for Ahmed the crop sits inside the LinkedIn "#OpenToWork" ring, so the ring and its text are
left out entirely and nothing in his face is retouched.

`--check` writes a contact sheet to the scratch directory given by TMP instead, for visual review.
Crops are fractions of the source size: (centre x, centre y, half-size), so they survive re-exports.
"""
import argparse, os
from PIL import Image, ImageFilter, ImageDraw

ap = argparse.ArgumentParser()
ap.add_argument('persona')
ap.add_argument('--out', default=os.path.join('public', 'team'))
ap.add_argument('--check', action='store_true')
a = ap.parse_args()

PORTRAITS = {
    # member id: (source file, (cx, cy, half) as fractions of width/height/width)
    'omar': ('profile-photo.jpg', (0.49, 0.42, 0.36)),  # owner-confirmed: his own photo (2026-11-24)
    'ahmed': ('WhatsApp Image 2026-11-24 at 2.48.50 PM.jpeg', (0.49, 0.29, 0.33)),  # owner-approved 2026-11-24
    'sara': ('WhatsApp Image 2026-11-24 at 2.32.38 PM.jpeg', (0.575, 0.57, 0.25)),  # owner-supplied 2026-11-24; crop drops the screenshot bars
    'ola': ('WhatsApp Image 2026-11-24 at 2.55.33 PM.jpeg', (0.50, 0.42, 0.38)),  # owner-supplied 2026-11-24
}
SIZE = 640

os.makedirs(a.out, exist_ok=True)
sheet = []
for mid, (name, (cx, cy, half)) in PORTRAITS.items():
    src = Image.open(os.path.join(a.persona, name)).convert('RGB')
    w, h = src.size
    x0, y0, s = int((cx - half) * w), int(cy * h - half * w), int(2 * half * w)
    x0, y0 = max(0, x0), max(0, y0)
    crop = src.crop((x0, y0, x0 + s, y0 + s))
    size = min(SIZE, max(s * 2, 320))
    out = crop.resize((size, size), Image.LANCZOS)
    if size > s:  # upscaled: recover a little edge contrast
        out = out.filter(ImageFilter.UnsharpMask(radius=1.2, percent=60, threshold=2))
    sheet.append(out)
    if not a.check:
        out.save(os.path.join(a.out, f'{mid}.webp'), 'WEBP', quality=84, method=6)
        out.save(os.path.join(a.out, f'{mid}.jpg'), 'JPEG', quality=86, optimize=True, progressive=True)
        print(f'{mid}: {name} {w}x{h} -> crop {s}px -> {size}px')

if a.check:
    cs = Image.new('RGB', (len(sheet) * 330, 330), (20, 30, 50))
    for i, im in enumerate(sheet):
        t = im.resize((320, 320))
        m = Image.new('L', (320, 320), 0); ImageDraw.Draw(m).ellipse((0, 0, 319, 319), fill=255)
        cs.paste(t, (i * 330 + 5, 5), m)
    p = os.path.join(os.environ.get('TMP', '.'), 'portraits-check.png')
    cs.save(p)
    print(p)
