"""Deterministic geometry evidence against KASPER WEB, measured 2026-09-18."""
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
# y/height, measured from the six approved Figma frames, not the previous website.
TARGETS = {
  1440: [[993,520],[1703,688],[2581,562],[3333,886],[4409,988],[5624,662],[6488,861],[7385,27]],
  1200: [[840,464],[1424,777.13],[2321.13,382],[2823.13,717],[3660.13,797],[4577.13,480],[5177.13,878],[6103.13,25.373]],
  960: [[776,478.23],[1350.23,668.68],[2114.91,389],[2599.91,973],[3668.91,727],[4491.91,441],[5028.91,878],[5954.91,25.373]],
  640: [[1010,752.23],[1842.23,1319.32],[3241.55,568.72],[3890.27,938],[4908.27,1689],[6677.27,661.43],[7418.70,866],[8332.70,25.373]],
  480: [[1045,793.23],[1902.23,1176.28],[3142.51,618.51],[3825.02,1612],[5501.02,1683],[7248.02,562],[7874.02,908],[8830.02,62.373]],
  320: [[878,833.23],[1767.23,1279.24],[3102.47,590.71],[3749.18,1530],[5335.18,1590],[6981.18,481],[7518.18,970],[8536.18,62.373]],
}
SECTIONS = ['#priority','#shifts','.why-card','#guide','#framework','.closing-card','.consultation-form','.site-footer']
CHILD_TARGETS = json.loads((ROOT/'tests/figma-child-targets.json').read_text())['targets']
SELECTORS = SECTIONS + ['.priority-art','.hero-artwork','.hero-actions .button','.hero-actions .button>span','.hero-actions .button>.icon','.hero-stage','.hero-copy h1','.hero-description','.hero-actions','.brand','.header-inner','.language-trigger','.download-action','.menu-toggle','.priority h2','.priority-action','.priority-action p','.exposure-card','.impact-item','.shifts-intro','.shift-visual','.shift-tabs','.shift-card','.why-copy','.why-copy h2','.why-copy>p:not(.eyebrow)','.why-number','.section-heading','.feature-grid','.feature-card','.feature-outcome','.framework-heading','.timeline','.timeline-card','.timeline-number','.timeline-unit','.closing-copy','.closing-brand','.form-header','.form-header h2','.form-header p','.form-fields','.form-consents','.checkbox','.field input','.field textarea','.consultation-form>.button']

async def run():
    OUT.mkdir(exist_ok=True)
    server = None
    if 'TEST_URL' not in os.environ:
        server = subprocess.Popen(['node','scripts/serve.mjs'], cwd=ROOT, stdout=subprocess.DEVNULL)
        for _ in range(50):
            try:
                urllib.request.urlopen(BASE, timeout=1)
                break
            except Exception:
                time.sleep(.1)
    report = {'source':'Figma KASPER WEB, approved Desktop + REFINED frames', 'layouts':[], 'errors':[]}
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch()
            for width in WIDTHS:
                context = await browser.new_context(viewport={'width':width,'height':900}, device_scale_factor=1, reduced_motion='reduce', has_touch=width<800)
                page = await context.new_page()
                page.on('pageerror', lambda e: report['errors'].append(str(e)))
                await page.goto(BASE, wait_until='networkidle', timeout=60000)
                await page.evaluate('''async()=>{
                    await Promise.all([300,400,500,600].map(w=>document.fonts.load(`${w} 20px "Kaspersky Sans Display"`)));
                    await document.fonts.load('20px "Bebas Neue"');
                    document.querySelectorAll('img').forEach(i=>i.loading='eager');
                    await Promise.all([...document.images].map(i=>i.decode().catch(()=>null)));
                    await document.fonts.ready;
                }''')
                await page.wait_for_timeout(100)
                boxes = await page.evaluate('''selectors => Object.fromEntries(selectors.map(s=>[s,[...document.querySelectorAll(s)].map(e=>{
                    const r=e.getBoundingClientRect(),c=getComputedStyle(e);
                    return {x:+r.x.toFixed(2),y:+(r.y+scrollY).toFixed(2),width:+r.width.toFixed(2),height:+r.height.toFixed(2),font:c.fontSize,line:c.lineHeight,gap:c.gap,padding:c.padding};
                })]))''', SELECTORS)
                layout = await page.evaluate('''()=>({viewport:innerWidth,width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,fonts:[...document.fonts].map(f=>({family:f.family,weight:f.weight,status:f.status})),broken:[...document.images].filter(i=>!i.naturalWidth).map(i=>i.src)})''')
                layout['geometry'] = boxes
                layout['hero_lines'] = await page.locator('.hero-copy h1').evaluate("""e=>{
                  const walker=document.createTreeWalker(e,NodeFilter.SHOW_TEXT), lines=new Map();
                  while(walker.nextNode()){const n=walker.currentNode;for(let i=0;i<n.length;i++){
                    const r=document.createRange();r.setStart(n,i);r.setEnd(n,i+1);const b=r.getBoundingClientRect();
                    const y=Math.round(b.y);lines.set(y,(lines.get(y)||'')+n.textContent[i]);
                  }}return [...lines.values()].map(s=>s.trim()).filter(Boolean);
                }""")
                if str(width) in CHILD_TARGETS:
                    expected=CHILD_TARGETS[str(width)]
                    for selector, targets in [('.hero-copy h1',[expected['h1']]),('.hero-artwork',[expected['artwork']]),('.hero-actions .button',expected['buttons']),('.why-number',[expected['why_number']])]:
                        for actual,target in zip(boxes[selector],targets):
                            for i,dimension in enumerate(['x','y','width','height']):
                                assert abs(actual[dimension]-target[i])<=2, f'{width}: {selector} {dimension} {actual[dimension]} != {target[i]}'
                    assert layout['hero_lines']==expected['lines'], f'{width}: H1 lines {layout["hero_lines"]}'
                for button,label,icon in zip(boxes['.hero-actions .button'],boxes['.hero-actions .button>span'],boxes['.hero-actions .button>.icon']):
                    assert label['x']>=button['x'] and label['x']+label['width']<=icon['x'], f'{width}: CTA label overlaps icon'
                    assert icon['x']+icon['width']<=button['x']+button['width']-8, f'{width}: clipped CTA arrow'
                    assert icon['width']==24 and icon['height']==24, f'{width}: compressed CTA arrow'
                    assert button['font']==('20px' if width>=1360 else '18px'), f'{width}: Hero CTA typography' 
                layout['deltas'] = {s:{k:round(boxes[s][0][k]-target[j],2) for j,k in enumerate(['y','height'])} for s,target in zip(SECTIONS,TARGETS.get(width,[]))}
                report['layouts'].append(layout)
                assert layout['width']==width, f'Horizontal overflow at {width}'
                assert not layout['broken'], f'Broken images at {width}: {layout["broken"]}'
                if width in TARGETS:
                    await page.screenshot(path=str(OUT/f'page-{width}.png'),full_page=True)
                    await page.locator('.hero-stage').screenshot(path=str(OUT/f'hero-{width}.png'))
                if width in TARGETS or width==1920:
                    if width==1920:
                        await page.locator('.hero').screenshot(path=str(OUT/'hero-1920.png'))
                    seam=boxes['.closing-card'][0]
                    await page.evaluate('y=>scrollTo({top:y,behavior:"instant"})',seam['y']+seam['height']-140)
                    await page.screenshot(path=str(OUT/f'closing-join-{width}.png'))
                print(width,layout['height'],json.dumps(layout['deltas']),flush=True)
                await context.close()
            await browser.close()
        assert not report['errors'], report['errors']
        for layout in report['layouts']:
            for selector, delta in layout['deltas'].items():
                for dimension, value in delta.items():
                    assert abs(value)<=4, f'{layout["viewport"]}px {selector} {dimension}: {value:+.2f}px from Figma'
            width=layout['viewport']
            gutter=56 if width>=1360 else 48 if width>=1100 else 40 if width>=800 else 28 if width>=580 else 24 if width>=400 else 20
            expected=min(width-2*gutter,1328)
            assert abs(layout['geometry']['#priority'][0]['width']-expected)<=2, f'Container width at {width}'
        print('Verified Figma section y/height within 4px and all container widths within 2px.')
    finally:
        (OUT/'geometry.json').write_text(json.dumps(report,indent=2))
        if server:
            server.terminate()
            server.wait(timeout=5)

asyncio.run(run())
