"""Browser checks against the same project subpath used by GitHub Pages."""
import asyncio
import json
import os
from pathlib import Path
from playwright.async_api import async_playwright

URL = os.environ.get('SITE_URL', 'http://127.0.0.1:4173/The-Critical-90/')
OUT = Path('test-results')
OUT.mkdir(exist_ok=True)

async def main():
    results = {'url': URL, 'viewports': [], 'checks': []}
    failures = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(args=['--no-sandbox'])
        context = await browser.new_context(device_scale_factor=1)
        page = await context.new_page()
        errors = []
        page.on('pageerror', lambda error: errors.append(str(error)))
        for width in (320, 375, 480, 640, 768, 960, 1200, 1440, 1920):
            await page.set_viewport_size({'width': width, 'height': 960})
            response = await page.goto(URL, wait_until='networkidle', timeout=45000)
            await page.wait_for_function('document.documentElement.dataset.ready === "true"')
            await page.evaluate('document.fonts.ready')
            await page.wait_for_timeout(1800)
            await page.screenshot(path=str(OUT / f'hero-{width}.png'))
            # Scroll normally to exercise intersection observers and lazy media.
            height = await page.evaluate('document.documentElement.scrollHeight')
            for y in range(0, height, 700):
                await page.evaluate('(y) => window.scrollTo({top:y,behavior:"instant"})', y)
                await page.wait_for_timeout(100)
            await page.wait_for_timeout(800)
            await page.evaluate('window.scrollTo({top:0,behavior:"instant"})')
            await page.wait_for_timeout(600)
            metrics = await page.evaluate('''() => ({
                width: innerWidth, scrollWidth: document.documentElement.scrollWidth,
                height: document.documentElement.scrollHeight,
                brokenImages: [...document.images].filter(i => !i.complete || !i.naturalWidth).map(i => i.getAttribute('src')),
                headingCount: document.querySelectorAll('h1').length,
                fonts: [...document.fonts].filter(f => f.family === 'Kaspersky').map(f => ({weight:f.weight,status:f.status})),
                hiddenReveals: document.querySelectorAll('.reveal.is-waiting').length,
            })''')
            metrics['status'] = response.status
            results['viewports'].append(metrics)
            if metrics['scrollWidth'] > width + 1: failures.append(f'Horizontal overflow at {width}: {metrics["scrollWidth"]}')
            if metrics['brokenImages']: failures.append(f'Broken media at {width}: {metrics["brokenImages"]}')
            if metrics['headingCount'] != 1: failures.append('Page must have one H1')
            if width in (320,480,960,1440):
                await page.screenshot(path=str(OUT / f'page-{width}.png'), full_page=True, animations='disabled')
        await page.set_viewport_size({'width': 320, 'height': 812})
        await page.goto(URL, wait_until='networkidle')
        await page.click('#menu-toggle')
        await page.wait_for_timeout(450)
        assert await page.locator('#navigation-panel').is_visible()
        assert await page.evaluate('document.querySelector("#main").inert')
        await page.screenshot(path=str(OUT / 'menu-320.png'))
        await page.keyboard.press('Escape')
        await page.wait_for_timeout(400)
        assert not await page.locator('#navigation-panel').is_visible()
        assert await page.evaluate('document.activeElement.id === "menu-toggle"')
        results['checks'].append('Menu opens, locks background, closes with Escape and returns focus')
        await page.locator('#shift-tab-0').click()
        assert await page.locator('#shift-panel').get_attribute('data-active') == '0'
        await page.keyboard.press('ArrowRight')
        assert await page.locator('#shift-panel').get_attribute('data-active') == '1'
        assert await page.locator('#shift-tab-1').get_attribute('aria-selected') == 'true'
        await page.locator('#shift-tab-3').click()
        assert await page.locator('.shift-image.is-active').get_attribute('src') == 'assets/shift-trust.webp'
        results['checks'].append('Four-image carousel, selected states and keyboard navigation')
        await page.locator('[data-day="60"]').click()
        assert await page.locator('[data-day="60"]').get_attribute('aria-pressed') == 'true'
        results['checks'].append('Timeline phase selection and announcements')
        await page.locator('.form-submit').click()
        assert await page.locator('#name').get_attribute('aria-invalid') == 'true'
        await page.fill('#name', 'Preview test')
        await page.fill('#email', 'preview@example.com')
        await page.fill('#phone', '+44 7700 900000')
        await page.select_option('#country', 'GB')
        await page.fill('#company', 'Preview')
        await page.select_option('#employees', label='50–249')
        await page.check('#privacy')
        await page.locator('.form-submit').click()
        assert 'does not send personal details' in await page.locator('.form-status').inner_text()
        results['checks'].append('Form validation; no false success or personal data transmission in preview')
        await page.locator('.hero [data-document="preview"]').click()
        assert await page.locator('#document-dialog').is_visible()
        assert 'not been connected' in await page.locator('.document-availability').inner_text()
        await page.screenshot(path=str(OUT / 'document-320.png'))
        await page.keyboard.press('Escape')
        results['checks'].append('Document modal, keyboard dismissal and honest download availability')
        await page.emulate_media(reduced_motion='reduce')
        await page.goto(URL, wait_until='networkidle')
        assert await page.locator('.slider-play').get_attribute('aria-pressed') == 'true'
        assert await page.evaluate('getComputedStyle(document.querySelector(".hero h1")).animationName') == 'none'
        results['checks'].append('Reduced-motion preference respected; autoplay starts paused')
        results['javascriptErrors'] = errors
        failures.extend(errors)
        results['failures'] = failures
        (OUT / 'report.json').write_text(json.dumps(results, indent=2))
        print(json.dumps(results, indent=2))
        await browser.close()
    if failures:
        raise SystemExit('\n'.join(failures))

asyncio.run(main())
