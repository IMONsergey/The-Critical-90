"""Temporary asynchronous shaping probe; removed after geometry is locked."""
import asyncio,json,subprocess
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parents[1]
async def run():
 server=subprocess.Popen(['node','scripts/serve.mjs'],cwd=ROOT,stdout=subprocess.DEVNULL)
 await asyncio.sleep(.4)
 results=[]
 try:
  async with async_playwright() as p:
   browser=await p.chromium.launch()
   for w,s in [(640,'.priority h2'),(960,'.form-header p'),(320,'.form-header p')]:
    page=await browser.new_page(viewport={'width':w,'height':900},reduced_motion='reduce')
    await page.goto('http://127.0.0.1:4173/The-Critical-90/',wait_until='networkidle')
    await page.evaluate('''async()=>{await Promise.all([300,400,500,600].map(w=>document.fonts.load(`${w} 20px "Kaspersky Sans Display"`)));await document.fonts.ready;}''')
    r=await page.evaluate('''async selector=>{
      const el=document.querySelector(selector),result={selector,html:el.innerHTML,variants:[]};
      const measure=()=>{const c=getComputedStyle(el),out=new Map(),walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);let n;while(n=walker.nextNode()){for(let i=0;i<n.length;i++){const range=new Range();range.setStart(n,i);range.setEnd(n,i+1);const rect=range.getBoundingClientRect();if(!rect.height)continue;const y=Math.round(rect.y*10)/10;out.set(y,(out.get(y)||'')+n.textContent[i]);}}return {font:c.font,width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height,letter:c.letterSpacing,wrap:c.textWrap,children:[...el.children].map(e=>({tag:e.tagName,font:getComputedStyle(e).font,letter:getComputedStyle(e).letterSpacing})),lines:[...out.values()]};};
      result.original=measure();
      for(const letter of ['-0.1px','-0.2px','-0.3px','-0.4px']){el.style.letterSpacing=letter;await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));result.variants.push({letter,...measure()});}
      el.style.letterSpacing='';
      const width=result.original.width;
      for(const extra of [2,4,8,12,20]){el.style.width=(width+extra)+'px';el.style.maxWidth='none';await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));result.variants.push({extra,...measure()});}
      return result;
    }''',s)
    r['viewport']=w;results.append(r);print(json.dumps(r),flush=True)
    await page.close()
   await browser.close()
 finally:
  server.terminate();server.wait(timeout=5)
  (ROOT/'test-results/font-shaping.json').write_text(json.dumps(results,indent=2))
asyncio.run(run())
