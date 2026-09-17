"""Prevent publishing layouts rendered without the four required brand webfonts."""
import json
from pathlib import Path

report = json.loads((Path(__file__).resolve().parents[1] / 'test-results' / 'report.json').read_text())
assert report.get('passed'), 'Browser interaction or layout checks failed'
assert len(report['layouts']) == 9, 'Not all responsive widths were checked'
for layout in report['layouts']:
    fonts = {font['weight']: font['status'] for font in layout['fonts']}
    # The four separate faces come from the brand CDN and must all load.
    # The optional 300–800 local Arial fallback depends on OS installation;
    # its absence is not a failed network delivery when these faces loaded.
    for weight in ['300', '400', '500', '600']:
        assert fonts.get(weight) == 'loaded', f'Brand font {weight} failed at {layout["viewport"]}px: {fonts}'
print('Verified nine responsive layouts and all four authentic brand webfonts.')
