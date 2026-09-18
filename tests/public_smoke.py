"""Verify the exact deployed revision in an unauthenticated public browser."""
import asyncio
import json
import os
from pathlib import Path
import time
import urllib.request
from playwright.async_api import async_playwright

BASE=os.environ['PAGE_URL'].rstrip('/')+'/'
EXPECTED=os.environ['GITHUB_SHA']
OUT=Path('public-review')
OUT.mkdir(exist_ok=True)
for attempt in range(24):
    try:
        with urllib.request.urlopen(BASE+'build.json?revision='+EXPECTED,timeout=15) as response:
            build=json.load(response)
        if build.get('revision')==EXPECTED:
            break
    except Exception:
        pass
    time.sleep(5)
else:
    raise AssertionError('Public deployment did not expose the expected revision')

async def run():
    report={'revision':EXPECTED,'url':BASE,'layouts':[],'errors':[]}
    async with async_playwright() as p:
        browser=await p.chromium.launch()
        for width in (320,1440):
            context=await browser.new_context(viewport={'width':width,'height':900},reduced_motion='reduce')
            page=await context.new_page()
            page.on('pageerror',lambda error:report['errors'].append(str(error)))
            response=await page.goto(BASE+'?revision='+EXPECTED,wait_until='networkidle',timeout=60000)
            assert response.status==200
            assert await page.locator('meta[name="build-revision"]').get_attribute('content')==EXPECTED
            await page.evaluate('''async()=>{
                await Promise.all([300,400,500,600].map(w=>document.fonts.load(`${w} 20px "Kaspersky Sans Display"`)));
                document.querySelectorAll('img').forEach(i=>i.loading='eager');
                await Promise.all([...document.images].map(i=>i.decode().catch(()=>null)));
            }''')
            layout=await page.evaluate('''()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,broken:[...document.images].filter(i=>!i.naturalWidth).map(i=>i.src)})''')
            assert layout['width']==layout['scrollWidth'] and not layout['broken'],layout
            await page.locator('#shift-tab-3').click()
            assert await page.locator('#shift-tab-3').get_attribute('aria-selected')=='true'
            await page.evaluate('scrollTo({top:0,behavior:"instant"})')
            await page.screenshot(path=str(OUT/f'live-{width}.png'),full_page=True)
            report['layouts'].append(layout)
            await context.close()
        await browser.close()
    assert not report['errors'],report['errors']
    (OUT/'public-report.json').write_text(json.dumps(report,indent=2))
    print(json.dumps(report,indent=2))

asyncio.run(run())
