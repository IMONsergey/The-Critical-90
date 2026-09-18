"""Do not publish with missing viewport coverage or unloaded brand faces."""
import json
from pathlib import Path
report=json.loads((Path(__file__).resolve().parents[1]/'test-results/report.json').read_text())
assert report.get('passed'),'Browser interaction or layout checks failed'
assert {r['viewport'] for r in report['layouts']}=={320,375,480,640,768,960,1024,1200,1366,1440,1920},'Incomplete viewport coverage'
for layout in report['layouts']:
    fonts={f['weight']:f['status'] for f in layout['fonts']}
    for weight in ['300','400','500','600']:
        assert fonts.get(weight)=='loaded',f'Brand font {weight} failed at {layout["viewport"]}: {fonts}'
print('Verified 11 responsive layouts, input-method regressions and all four brand font faces.')
