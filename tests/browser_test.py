"""Regression checks for responsive layout, input methods, focus and honest integration states."""
import asyncio
import json
import os
from pathlib import Path
import subprocess
import time
import urllib.request
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'test-results'
BASE = os.environ.get('TEST_URL', 'http://127.0.0.1:4173/The-Critical-90/')
WIDTHS = [320,375,480,640,768,960,1024,1200,1366,1440,1920]

async def ready(page):
    await page.goto(BASE, wait_until='networkidle', timeout=60000)
    await page.evaluate('''async()=>{
        await Promise.all([300,400,500,600].map(w=>document.fonts.load(`${w} 20px "Kaspersky Sans Display"`)));
        await document.fonts.ready;
        document.querySelectorAll('img').forEach(i=>i.loading='eager');
        await Promise.all([...document.images].map(i=>i.decode().catch(()=>null)));
    }''')

async def run():
    OUT.mkdir(exist_ok=True)
    server = None
    if 'TEST_URL' not in os.environ:
        server = subprocess.Popen(['node','scripts/serve.mjs'],cwd=ROOT,stdout=subprocess.DEVNULL)
        for _ in range(40):
            try:
                urllib.request.urlopen(BASE,timeout=1)
                break
            except Exception:
                time.sleep(.1)
    report = {'layouts':[], 'checks':[], 'errors':[]}
    def listen(page):
        page.on('pageerror',lambda error:report['errors'].append(str(error)))
        page.on('console',lambda message:report['errors'].append(message.text) if message.type=='error' and 'Unable to initialize' in message.text else None)
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch()
            for width in WIDTHS:
                context = await browser.new_context(viewport={'width':width,'height':900},device_scale_factor=1,has_touch=width<800)
                page = await context.new_page()
                listen(page)
                await ready(page)
                for y in range(0,await page.evaluate('document.documentElement.scrollHeight'),650):
                    await page.evaluate('y=>scrollTo({top:y,behavior:"instant"})',y)
                    await page.wait_for_timeout(30)
                await page.evaluate('scrollTo({top:0,behavior:"instant"})')
                await page.wait_for_timeout(800)
                layout = await page.evaluate('''()=>({
                  viewport:innerWidth,clientWidth:document.documentElement.clientWidth,scrollWidth:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,
                  overflow:[...document.querySelectorAll('.container,.hero-copy,.feature-card,.shift-card,.consultation-form,.header-inner')].filter(e=>{const r=e.getBoundingClientRect();return r.width&&(r.left<-.8||r.right>innerWidth+.8)}).map(e=>e.className),
                  brokenImages:[...document.images].filter(i=>!i.naturalWidth).map(i=>i.src),
                  fonts:[...document.fonts].filter(f=>f.family.includes('Kaspersky')).map(f=>({weight:f.weight,status:f.status}))
                })''')
                report['layouts'].append(layout)
                assert layout['clientWidth']==width and layout['scrollWidth']==width,layout
                assert not layout['overflow'] and not layout['brokenImages'],layout
                if width in (320,960):
                    await page.locator('#menu-open').click()
                    await page.wait_for_timeout(500)
                    assert await page.locator('#navigation-dialog .header-inner').count()==1
                    assert await page.locator('#menu-open').count()==1
                    assert await page.locator('#menu-open').get_attribute('aria-expanded')=='true'
                    for _ in range(18):
                        await page.keyboard.press('Tab')
                        assert await page.evaluate("Boolean(document.activeElement.closest('#navigation-dialog'))")
                    await page.screenshot(path=str(OUT/f'menu-{width}.png'))
                    await page.keyboard.press('Escape')
                    await page.wait_for_timeout(250)
                    assert await page.locator('#navigation-dialog').evaluate('d=>!d.open')
                    assert await page.locator('#site-header .header-inner').count()==1
                    assert await page.locator('#menu-open').evaluate('e=>e===document.activeElement')
                    await page.locator('#menu-open').click()
                    await page.locator('.menu-panel [href="#shifts"]').click()
                    await page.wait_for_timeout(700)
                    assert await page.locator('#navigation-dialog').evaluate('d=>!d.open')
                    report['checks'].append(f'{width}: shared header, keyboard trap, Escape, return focus and section link')
                await context.close()

            context = await browser.new_context(viewport={'width':1440,'height':900},reduced_motion='reduce')
            page = await context.new_page()
            listen(page)
            posts=[]
            page.on('request',lambda request: posts.append(request.url) if request.method=='POST' else None)
            await ready(page)
            for i in (0,2,3,1):
                await page.locator(f'#shift-tab-{i}').click()
                assert await page.locator(f'#shift-tab-{i}').get_attribute('aria-selected')=='true'
                assert await page.locator(f'#shift-panel-{i}').is_visible()
                assert await page.locator('.shift-progress .is-complete').count()==i
                assert await page.locator(f'#shift-panel-{i} img').evaluate('e=>e.naturalWidth===768 && e.naturalHeight===860')
                await page.locator('.shift-visual').screenshot(path=str(OUT/f'slider-image-{i+1}-1440.png'))
            await page.locator('#shift-tab-1').focus()
            for key,index in [('ArrowRight',2),('Home',0),('End',3),('ArrowDown',0),('ArrowUp',3)]:
                await page.keyboard.press(key)
                assert await page.locator(f'#shift-tab-{index}').get_attribute('aria-selected')=='true'
            assert await page.locator('.carousel-play,.shift-caption').count()==0
            assert await page.locator('.shift-visual').evaluate('e=>e.style.getPropertyValue("--slide-progress")==="1"')
            report['checks'].append('Four slide states, arrows, Home/End and reduced-motion autoplay lock')
            await page.locator('#shifts').screenshot(path=str(OUT/'slider-trust.png'))
            for day in (30,60,90):
                await page.locator(f'[data-day="{day}"]').click()
                assert await page.locator('#stage-dialog').is_visible()
                await page.keyboard.press('Escape')
                assert await page.locator(f'[data-day="{day}"]').evaluate('e=>e===document.activeElement')
            report['checks'].append('30/60/90 dialogs and focus restoration')
            await page.locator('.hero-actions [data-report="preview"]').click()
            assert 'not been connected' in await page.locator('.report-availability').inner_text()
            await page.keyboard.press('Escape')
            report['checks'].append('Honest missing-PDF state')
            form=page.locator('#consultation-form')
            await form.locator('[type="submit"]').click()
            assert await page.locator('#full-name').get_attribute('aria-invalid')=='true'
            for selector,value in [('#full-name','Website test'),('#email','test@example.invalid'),('#phone','+1 202 555 0100'),('#company','Test only')]:
                await page.locator(selector).fill(value)
            await page.locator('#country').select_option('US')
            await page.locator('#employees').select_option(label='1–49')
            await page.locator('#privacy').check()
            await form.locator('[type="submit"]').click()
            assert 'not been sent or saved' in await page.locator('#form-status').inner_text()
            assert not posts,posts
            report['checks'].append('Form validation, country, consent, retained input and zero POST without endpoint')
            await context.close()

            context=await browser.new_context(viewport={'width':1440,'height':900})
            page=await context.new_page()
            listen(page)
            await ready(page)
            await page.locator('.shift-visual').evaluate('e=>e.scrollIntoView({block:"center",behavior:"instant"})')
            await page.mouse.move(2,2)
            initial=await page.locator('[role=tab][aria-selected=true]').get_attribute('id')
            await page.wait_for_timeout(350)
            progress=await page.locator('.shift-visual').evaluate('e=>parseFloat(e.style.getPropertyValue("--slide-progress"))')
            assert 0<progress<1,progress
            await page.wait_for_timeout(9100)
            assert initial!=await page.locator('[role=tab][aria-selected=true]').get_attribute('id')
            # Manual selection restarts the timed strip, then the last slide wraps to the first.
            await page.locator('#shift-tab-3').click()
            assert await page.locator('.shift-visual').evaluate('e=>parseFloat(e.style.getPropertyValue("--slide-progress"))<.06')
            assert await page.locator('.shift-progress .is-complete').count()==3
            await page.mouse.move(2,2)
            await page.wait_for_timeout(9100)
            assert await page.locator('#shift-tab-0').get_attribute('aria-selected')=='true'
            assert await page.locator('#shift-panel-0').is_visible()
            assert await page.locator('.shift-progress .is-complete').count()==0
            await page.locator('.shift-visual').hover()
            paused=await page.locator('.shift-visual').evaluate('e=>e.style.getPropertyValue("--slide-progress")')
            await page.wait_for_timeout(350)
            assert paused==await page.locator('.shift-visual').evaluate('e=>e.style.getPropertyValue("--slide-progress")')
            report['checks'].append('Story progress fills, advances image and card, resets on selection, wraps and pauses on image hover')
            await page.evaluate('scrollTo({top:0,behavior:"instant"})')
            await page.wait_for_timeout(200)
            frozen=await page.locator('.shift-visual').evaluate('e=>e.style.getPropertyValue("--slide-progress")')
            await page.wait_for_timeout(350)
            assert frozen==await page.locator('.shift-visual').evaluate('e=>e.style.getPropertyValue("--slide-progress")')
            await page.mouse.move(1300,400)
            await page.wait_for_timeout(500)
            x=await page.locator('.hero-artwork').evaluate('e=>parseFloat(e.style.getPropertyValue("--hero-x"))||0')
            assert 0<abs(x)<8,x
            # Pointer and scroll movement must never reveal an empty image edge.
            for px,py,scroll in [(8,8,0),(1432,8,0),(1432,750,0),(8,400,240)]:
                await page.evaluate('y=>scrollTo({top:y,behavior:"instant"})',scroll)
                await page.mouse.move(px,py)
                await page.wait_for_timeout(500)
                bounds=await page.locator('.hero-artwork').evaluate('''e=>{
                  const frame=e.getBoundingClientRect(),image=e.querySelector('img').getBoundingClientRect();
                  return {left:frame.left-image.left,right:image.right-frame.right,top:frame.top-image.top,bottom:image.bottom-frame.bottom};
                }''')
                assert min(bounds.values())>=-.1, f'Uncovered Hero edge: {bounds}'
            await page.screenshot(path=str(OUT/'hero-motion-1440.png'))
            report['checks'].append('Hero image covers its fixed frame at pointer extremes and during scroll')
            await page.emulate_media(reduced_motion='reduce')
            await page.wait_for_timeout(100)
            assert await page.locator('.hero-artwork').evaluate('e=>!e.style.getPropertyValue("--hero-x")')
            assert await page.locator('.shift-visual').evaluate('e=>e.style.getPropertyValue("--slide-progress")==="1"')
            report['checks'].append('Autoplay advances, pauses offscreen; pointer depth cancels when motion preference changes')
            await context.close()

            context=await browser.new_context(viewport={'width':320,'height':900},has_touch=True,is_mobile=True)
            page=await context.new_page()
            listen(page)
            await ready(page)
            await page.locator('.shift-visual').evaluate('e=>e.scrollIntoView({block:"center",behavior:"instant"})')
            await page.locator('.shift-visual').dispatch_event('pointerdown',{'pointerType':'touch','clientX':240,'clientY':400})
            await page.locator('.shift-visual').dispatch_event('pointerup',{'pointerType':'touch','clientX':70,'clientY':405})
            await page.wait_for_timeout(500)
            assert await page.locator('#shift-tab-2').get_attribute('aria-selected')=='true'
            await page.emulate_media(reduced_motion='reduce')
            for i in range(4):
                await page.locator(f'#shift-tab-{i}').click()
                await page.locator('.shift-visual').screenshot(path=str(OUT/f'slider-image-{i+1}-320.png'))
            await page.locator('.hero-artwork').evaluate('e=>e.scrollIntoView({block:"center",behavior:"instant"})')
            assert await page.locator('.hero-artwork').evaluate('e=>!e.style.getPropertyValue("--hero-x")')
            report['checks'].append('Touch swipe and no touch parallax')
            await context.close()

            context=await browser.new_context(java_script_enabled=False,viewport={'width':1440,'height':900})
            page=await context.new_page()
            await page.goto(BASE,wait_until='networkidle')
            assert await page.locator('h1').is_visible() and await page.locator('#guide h2').is_visible()
            report['checks'].append('Readable content without JavaScript')
            await context.close()
            await browser.close()
            assert not report['errors'],report['errors']
            report['passed']=True
    except Exception as error:
        report.update(passed=False,failure=str(error))
        raise
    finally:
        (OUT/'report.json').write_text(json.dumps(report,indent=2))
        print(json.dumps(report,indent=2),flush=True)
        if server:
            server.terminate()
            server.wait(timeout=5)

asyncio.run(run())
