"""End-to-end layout and interaction checks. Screenshots contain no submitted personal data."""
import asyncio
import json
import os
import pathlib
import shutil
import subprocess
import time
import urllib.request
from playwright.async_api import async_playwright

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / 'test-results'
BASE = os.environ.get('TEST_URL', 'http://127.0.0.1:4173/The-Critical-90/')
WIDTHS = [320, 375, 480, 640, 768, 960, 1200, 1440, 1920]

async def run():
    OUT.mkdir(exist_ok=True)
    server = None
    if 'TEST_URL' not in os.environ:
        server = subprocess.Popen(['node', 'scripts/serve.mjs'], cwd=ROOT, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(40):
            try:
                urllib.request.urlopen(BASE, timeout=1)
                break
            except Exception:
                time.sleep(.1)
    report = {'layouts': [], 'checks': [], 'errors': [], 'fontStatus': []}
    try:
        async with async_playwright() as p:
            launch = {'headless': True}
            if os.environ.get('BROWSER_EXECUTABLE'):
                launch['executable_path'] = os.environ['BROWSER_EXECUTABLE']
            browser = await p.chromium.launch(**launch)
            for width in WIDTHS:
                context = await browser.new_context(viewport={'width': width, 'height': 900}, device_scale_factor=1, is_mobile=width <= 480, has_touch=width <= 768)
                page = await context.new_page()
                page.on('pageerror', lambda error: report['errors'].append(str(error)))
                await page.goto(BASE, wait_until='networkidle', timeout=60000)
                await page.evaluate('document.fonts.ready')
                await page.wait_for_timeout(1500)
                if width in [320, 640, 960, 1440]:
                    await page.screenshot(path=str(OUT / f'hero-{width}.png'))
                # Load the complete page before measuring and documenting it.
                await page.evaluate("document.querySelectorAll('img').forEach(i=>i.loading='eager')")
                await page.evaluate("Promise.all([...document.images].map(i=>i.decode().catch(()=>null)))")
                for y in range(0, await page.evaluate('document.documentElement.scrollHeight'), 650):
                    await page.evaluate('(y)=>window.scrollTo(0,y)', y)
                    await page.wait_for_timeout(45)
                await page.evaluate('window.scrollTo({top:0,behavior:"instant"})')
                await page.wait_for_timeout(1200)
                layout = await page.evaluate('''() => {
                  const box = selector => {
                    const element = document.querySelector(selector);
                    if (!element) return null;
                    const rect = element.getBoundingClientRect();
                    return {
                      x: Number(rect.x.toFixed(1)),
                      y: Number((rect.y + scrollY).toFixed(1)),
                      width: Number(rect.width.toFixed(1)),
                      height: Number(rect.height.toFixed(1))
                    };
                  };
                  return {
                    viewport: innerWidth,
                    clientWidth: document.documentElement.clientWidth,
                    scrollWidth: document.documentElement.scrollWidth,
                    height: document.documentElement.scrollHeight,
                    geometry: {
                      hero: box('.hero-stage'),
                      heroCopy: box('.hero-copy'),
                      heroArtwork: box('.hero-artwork'),
                      priority: box('#priority'),
                      shifts: box('#shifts'),
                      why: box('.why-card'),
                      guide: box('#guide'),
                      featureGrid: box('.feature-grid'),
                      framework: box('#agenda'),
                      timeline: box('.timeline'),
                      closing: box('.closing-card'),
                      consultation: box('#consultation'),
                      form: box('.consultation-form'),
                      footer: box('.site-footer')
                    },
                    brokenImages: [...document.images].filter(i=>i.complete&&!i.naturalWidth).map(i=>i.getAttribute('src')),
                    overflow: [...document.querySelectorAll('.container,.hero-copy,.feature-card,.shift-card,.consultation-form,.header-inner')]
                      .filter(e=>{const r=e.getBoundingClientRect();return r.width&&(r.left < -.8 || r.right > innerWidth+.8)})
                      .map(e=>({className:e.className,width:e.getBoundingClientRect().width})),
                    fonts: [...document.fonts].filter(f=>f.family.includes('Kaspersky')).map(f=>({weight:f.weight,status:f.status}))
                  };
                }''')
                report['layouts'].append(layout)
                assert layout['clientWidth'] == width, f'Layout viewport lost width at {width}: {layout["clientWidth"]}'
                assert layout['scrollWidth'] == width, f'Horizontal document width mismatch at {width}: {layout["scrollWidth"]}'
                assert not layout['overflow'], f'Content outside viewport at {width}: {layout["overflow"]}'
                assert not layout['brokenImages'], f'Missing images at {width}: {layout["brokenImages"]}'
                if width in [320, 640, 960, 1440]:
                    await page.screenshot(path=str(OUT / f'page-{width}.png'), full_page=True)
                if width == 320:
                    await page.locator('#menu-open').click()
                    await page.wait_for_timeout(450)
                    await page.screenshot(path=str(OUT / 'menu-320.png'))
                    await page.keyboard.press('Escape')
                    await page.wait_for_timeout(220)
                    assert await page.locator('#navigation-dialog').evaluate('(d)=>!d.open')
                    assert await page.locator('#menu-open').evaluate('(e)=>e===document.activeElement')
                    report['checks'].append('320px menu, Escape and focus restoration')
                if width == 960:
                    await page.locator('#menu-open').click()
                    for _ in range(18):
                        await page.keyboard.press('Tab')
                        assert await page.evaluate("Boolean(document.activeElement.closest('#navigation-dialog'))")
                    await page.locator('#navigation-dialog [href="#shifts"]').click()
                    await page.wait_for_timeout(700)
                    assert await page.locator('#navigation-dialog').evaluate('(d)=>!d.open')
                    report['checks'].append('Menu keyboard focus containment and section navigation')
                await context.close()

            context = await browser.new_context(viewport={'width':1440,'height':900}, reduced_motion='reduce')
            page = await context.new_page()
            page.on('pageerror', lambda error: report['errors'].append(str(error)))
            await page.goto(BASE, wait_until='networkidle')
            await page.locator('#shifts').scroll_into_view_if_needed()
            for i in [0, 2, 3, 1]:
                await page.locator(f'#shift-tab-{i}').click()
                assert await page.locator(f'#shift-tab-{i}').get_attribute('aria-selected') == 'true'
                assert await page.locator(f'#shift-panel-{i}').is_visible()
            await page.locator('#shift-tab-1').focus()
            await page.keyboard.press('ArrowRight')
            assert await page.locator('#shift-tab-2').get_attribute('aria-selected') == 'true'
            await page.keyboard.press('Home')
            assert await page.locator('#shift-tab-0').get_attribute('aria-selected') == 'true'
            report['checks'].append('Four distinct slide states, arrow keys and Home')
            await page.locator('#shifts').screenshot(path=str(OUT/'slider-revenue.png'))
            await page.locator('[data-day="60"]').click()
            assert 'Strengthen' in await page.locator('#stage-dialog-title').inner_text()
            await page.keyboard.press('Escape')
            report['checks'].append('Timeline stage details and Escape')
            await page.locator('.hero-actions [data-report="preview"]').click()
            assert await page.locator('#report-dialog').is_visible()
            assert 'not been connected' in await page.locator('.report-availability').inner_text()
            await page.keyboard.press('Escape')
            report['checks'].append('Honest report availability state')
            form = page.locator('#consultation-form')
            await form.locator('[type="submit"]').click()
            assert await page.locator('#full-name').get_attribute('aria-invalid') == 'true'
            await page.locator('#full-name').fill('Website test')
            await page.locator('#email').fill('test@example.invalid')
            await page.locator('#phone').fill('+1 202 555 0100')
            await page.locator('#country').select_option('US')
            await page.locator('#company').fill('Test only')
            await page.locator('#employees').select_option(label='1–49')
            await page.locator('#privacy').check()
            await form.locator('[type="submit"]').click()
            assert 'not been sent or saved' in await page.locator('#form-status').inner_text()
            report['checks'].append('Required validation, country selection, consent and no fake submission')
            assert await page.locator('.carousel-play').get_attribute('aria-pressed') == 'true'
            assert await page.evaluate("matchMedia('(prefers-reduced-motion: reduce)').matches")
            report['checks'].append('Reduced motion and stopped automatic rotation')
            report['fontStatus'] = await page.evaluate("[...document.fonts].filter(f=>f.family.includes('Kaspersky')).map(f=>({weight:f.weight,status:f.status}))")
            await context.close()

            context = await browser.new_context(java_script_enabled=False, viewport={'width':1440,'height':900})
            page = await context.new_page()
            await page.goto(BASE, wait_until='networkidle')
            assert await page.locator('h1').is_visible()
            assert await page.locator('#guide h2').is_visible()
            report['checks'].append('Readable content without JavaScript')
            await context.close()
            await browser.close()
            assert not report['errors'], report['errors']
            report['passed'] = True
    except Exception as error:
        report['passed'] = False
        report['failure'] = str(error)
        raise
    finally:
        (OUT/'report.json').write_text(json.dumps(report, indent=2), encoding='utf8')
        print(json.dumps(report, indent=2), flush=True)
        if server: server.terminate()

asyncio.run(run())
