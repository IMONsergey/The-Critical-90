"""Deterministic visual review, separate from input/behaviour regression tests.

Reference geometry is measured from the approved Figma frames, not from the
current website. Diagnostic capture still runs when no reference is supplied.
"""
import asyncio
import json
import os
import pathlib
import subprocess
from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / os.environ.get('VISUAL_OUT', 'test-results/visual')
WIDTHS = [320, 375, 480, 640, 768, 960, 1024, 1200, 1366, 1440, 1920]
CONTROL = [320, 480, 640, 960, 1200, 1440]
SELECTORS = {
    'header': '.header-inner', 'brand': '.header-inner .brand',
    'hero': '.hero-stage', 'h1': 'h1', 'heroDescription': '.hero-description',
    'heroActions': '.hero-actions', 'primaryCTA': '.hero-actions .button-primary',
    'secondaryCTA': '.hero-actions .button-secondary',
    'priority': '#priority', 'priorityHeading': '.priority h2',
    'priorityCaption': '.priority-action p', 'priorityCTA': '.priority-action .button',
    'exposure': '.exposure-card', 'impact': '.impact-item',
    'shifts': '#shifts', 'shiftHeading': '.shifts-intro h2',
    'shiftBody': '.shifts-intro>.muted', 'shiftPrompt': '.shifts-prompt',
    'shiftVisual': '.shift-visual', 'shiftTabs': '.shift-tabs', 'shiftCard': '.shift-card',
    'why': '.why-card', 'whyHeading': '.why-copy h2', 'whyBody': '.why-copy>p:not(.eyebrow)',
    'whyArtwork': '.why-number', 'guide': '#guide', 'guideHeading': '#guide h2',
    'featureGrid': '.feature-grid', 'featureCard': '.feature-card',
    'outcome': '.feature-outcome', 'framework': '.framework',
    'frameworkHeading': '.framework-heading h2', 'timeline': '.timeline',
    'capsule': '.timeline-card', 'closing': '.closing-card',
    'closingHeading': '.closing-copy h2', 'closingBrand': '.closing-brand',
    'form': '.consultation-form', 'formTitle': '.form-header h2',
    'formDescription': '.form-header p', 'fields': '.form-fields',
    'field': '#full-name', 'textarea': '#comments', 'consents': '.form-consents',
    'submit': '.consultation-form [type=submit]', 'footer': '.site-footer',
}

async def run():
    OUT.mkdir(parents=True, exist_ok=True)
    base = os.environ.get('TEST_URL', 'http://127.0.0.1:4173/The-Critical-90/')
    server = None
    reference_path = ROOT / 'tests/figma_geometry.json'
    references = json.loads(reference_path.read_text()) if reference_path.exists() else {}
    report = {'url': base, 'widths': WIDTHS, 'layouts': [], 'errors': [], 'deviations': [], 'referenceChecked': bool(references)}
    try:
        if 'TEST_URL' not in os.environ:
            server = subprocess.Popen(['node', 'scripts/serve.mjs'], cwd=ROOT, stdout=subprocess.DEVNULL)
            await asyncio.sleep(.5)
        async with async_playwright() as p:
            options = {'headless': True}
            if os.environ.get('BROWSER_EXECUTABLE'):
                options['executable_path'] = os.environ['BROWSER_EXECUTABLE']
            browser = await p.chromium.launch(**options)
            for width in WIDTHS:
                context = await browser.new_context(viewport={'width': width, 'height': 900}, device_scale_factor=1, reduced_motion='reduce', has_touch=width < 800)
                page = await context.new_page()
                page.on('pageerror', lambda error: report['errors'].append(str(error)))
                response = await page.goto(base, wait_until='networkidle', timeout=60000)
                assert response and response.status == 200, f'HTTP failure at {width}'
                await page.evaluate('document.fonts.ready')
                await page.evaluate("document.querySelectorAll('img').forEach(i => i.loading='eager')")
                await page.evaluate("Promise.all([...document.images].map(i=>i.decode().catch(()=>null)))")
                await page.evaluate("document.querySelectorAll('[data-reveal]').forEach(e=>e.classList.add('is-revealed'))")
                layout = await page.evaluate('''selectors => {
                    const geometry = {}, typography = {};
                    for (const [key, selector] of Object.entries(selectors)) {
                        const e = document.querySelector(selector);
                        if (!e) { geometry[key] = null; continue; }
                        const r = e.getBoundingClientRect(), s = getComputedStyle(e);
                        geometry[key] = Object.fromEntries(Object.entries({x:r.x,y:r.y+scrollY,width:r.width,height:r.height}).map(([k,v])=>[k,Math.round(v*100)/100]));
                        typography[key] = {size:s.fontSize,line:s.lineHeight,tracking:s.letterSpacing,weight:s.fontWeight,trim:s.textBoxTrim};
                    }
                    return {width:innerWidth,height:document.documentElement.scrollHeight,scrollWidth:document.documentElement.scrollWidth,geometry,typography,
                        fonts:[...document.fonts].filter(f=>f.family.includes('Kaspersky')).map(f=>({weight:f.weight,status:f.status})),
                        broken:[...document.images].filter(i=>!i.complete||!i.naturalWidth).map(i=>i.getAttribute('src'))};
                }''', SELECTORS)
                report['layouts'].append(layout)
                assert layout['scrollWidth'] == width, f'Horizontal overflow at {width}'
                assert not layout['broken'], f'Broken images at {width}: {layout["broken"]}'
                assert len(layout['fonts']) == 4 and all(f['status']=='loaded' for f in layout['fonts']), f'Brand fonts missing at {width}'
                if width in CONTROL:
                    await page.screenshot(path=str(OUT/f'hero-{width}.png'))
                    await page.screenshot(path=str(OUT/f'page-{width}.png'), full_page=True)
                for key, target in references.get(str(width), {}).items():
                    actual = layout['geometry'].get(key)
                    for dimension, expected in target.items():
                        if dimension == 'tolerance': continue
                        tolerance = target.get('tolerance', 4)
                        if actual is None or abs(actual[dimension]-expected) > tolerance:
                            report['deviations'].append({'width':width,'element':key,'dimension':dimension,'expected':expected,'actual':None if actual is None else actual[dimension],'tolerance':tolerance})
                await context.close()
            await browser.close()
        assert not report['errors'], report['errors']
        assert not report['deviations'], report['deviations']
        report['passed'] = True
    except Exception as error:
        report['passed'] = False
        report['failure'] = str(error)
        raise
    finally:
        (OUT/'geometry.json').write_text(json.dumps(report, indent=2), encoding='utf8')
        print(json.dumps({k:v for k,v in report.items() if k!='layouts'}, indent=2))
        if server: server.terminate()

if __name__ == '__main__':
    asyncio.run(run())
