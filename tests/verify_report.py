"""Prevent publishing a passing layout test rendered with broken brand typography."""
import json
from pathlib import Path

report = json.loads((Path(__file__).resolve().parents[1] / 'test-results' / 'report.json').read_text())
assert report.get('passed'), 'Browser interaction or layout checks failed'
assert len(report['layouts']) == 9, 'Not all responsive widths were checked'
for layout in report['layouts']:
    fonts = {font['weight']: font['status'] for font in layout['fonts']}
    for weight in ['400', '500', '600']:
        assert fonts.get(weight) == 'loaded', f'Brand font {weight} failed at {layout["viewport"]}px: {fonts}'
    assert 'error' not in fonts.values(), f'Font delivery failed: {fonts}'
print('Verified nine responsive layouts and authentic brand typography.')
