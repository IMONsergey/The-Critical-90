"""Compare browser font shaping with approved text wrapping before locking geometry."""
import asyncio, json, subprocess
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parents[1]
async def run():
    server=subprocess.Popen(['node','scripts/serve.mjs'],cwd=ROOT,stdout=subprocess.DEVNULL)
    await asyncio.sleep(.5)
    results=[]
    try:
        async with async_playwright() as p:
            browser=await p.chromium.launch()
            for w,s in [(1440,'.framework-heading h2'),(640,'.priority h2'),(960,'.form-header p'),(320,'.form-header p')]:
                page=await browser.new_page(viewport={'width':w,'height':900},reduced_motion='reduce')
                await page.goto('http://127.0.0.1:4173/The-Critical-90/',wait_until='networkidle')
                await page.evaluate('''async()=>{await Promise.all([300,400,500,600].map(w=>document.fonts.load(`${w} 20px "Kaspersky Sans Display"`))); await document.fonts.ready;}''')
                r=await page.evaluate('''selector=>{
                    const el=document.querySelector(selector),style=getComputedStyle(el);
                    const lines=()=>{const out=new Map(),walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let n;while(n=walker.nextNode()){for(let i=0;i<n.length;i++){const range=new Range();range.setStart(n,i);range.setEnd(n,i+1);const rect=range.getBoundingClientRect();if(!rect.height)continue;const y=Math.round(rect.y*10)/10;out.set(y,(out.get(y)||'')+n.textContent[i]);}}return [...out.values()];};
                    const result={selector,font:style.font,kerning:style.fontKerning,letter:style.letterSpacing,width:el.getBoundingClientRect().width,lines:lines(),variants:[]};
                    for(const kern of ['normal','none']){el.style.fontKerning=kern;result.variants.push({kern,lines:lines()});}
                    el.style.fontKerning='normal';el.style.textRendering='optimizeLegibility';result.variants.push({render:'optimizeLegibility',lines:lines()});
                    el.style.fontKerning='';el.style.textRendering='';
                    for(const letter of ['-.1px','-.2px','-.3px']){el.style.letterSpacing=letter;result.variants.push({letter,lines:lines()});}
                    el.style.letterSpacing='';el.style.maxWidth='none';
                    for(const extra of [2,4,8,12,20]){el.style.width=(result.width+extra)+'px';result.variants.push({extra,lines:lines()});}
                    return result;
                }''',s)
                r['viewport']=w;results.append(r);print(json.dumps(r),flush=True)
                await page.close()
            await browser.close()
    finally:
        server.terminate();server.wait(timeout=5)
        (ROOT/'test-results/font-shaping.json').write_text(json.dumps(results,indent=2))
asyncio.run(run())
