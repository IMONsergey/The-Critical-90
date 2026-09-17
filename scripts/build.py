"""Build a self-contained static directory, with no runtime package dependencies."""
from pathlib import Path
import shutil
from PIL import Image

root = Path(__file__).resolve().parents[1]
output = root / 'dist'
if output.exists():
    shutil.rmtree(output)
shutil.copytree(root / 'public', output)
(output / '.nojekyll').touch()
(output / 'robots.txt').write_text('User-agent: *\nDisallow: /\n')
# The CTA master is exported at print-like resolution. Keep the source intact.
image_path = output / 'assets' / 'cta.webp'
with Image.open(image_path) as source:
    image = source.convert('RGBA')
    image.thumbnail((1440, 1475), Image.Resampling.LANCZOS)
    image.save(image_path, 'WEBP', quality=86, method=6)
for name in ('font-reference.txt', 'manifest.json'):
    (output / 'assets' / name).unlink(missing_ok=True)
print(f'Built {len(list(output.rglob("*")))} entries in dist/')
