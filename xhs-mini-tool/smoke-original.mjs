#!/usr/bin/env node
// Verify the ORIGINAL Home / Atelier layout in a mobile Chromium viewport.
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {chromium} from 'playwright';

const root=path.dirname(fileURLToPath(import.meta.url));
const dist=path.join(root,'dist'),release=path.join(root,'release');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css',
 '.webp':'image/webp','.svg':'image/svg+xml','.woff2':'font/woff2'};
const server=http.createServer((req,res)=>{
 let pathname;
 try{pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname)}catch{res.writeHead(400);res.end();return}
 const file=path.resolve(dist,'.'+pathname);
 if(!file.startsWith(dist+path.sep)&&file!==dist){res.writeHead(403);res.end();return}
 const chosen=fs.existsSync(file)&&fs.statSync(file).isFile()?file:path.join(dist,'index.html');
 res.setHeader('Content-Type',mime[path.extname(chosen)]||'application/octet-stream');
 fs.createReadStream(chosen).pipe(res);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;
let browser;
try{
 browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',
  headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1,
  isMobile:true,hasTouch:true});
 const errors=[],unavailable=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('response',response=>{if(response.status()>=400)unavailable.push(response.url()+' '+response.status())});
 await page.goto(base+'/',{waitUntil:'domcontentloaded'});
 await page.waitForSelector('.home-stage',{timeout:15000});
 await page.waitForTimeout(1100);
 const home=await page.evaluate(()=>({
  hasOriginalHome:!!document.querySelector('.home-stage'),
  renderedImages:document.querySelectorAll('.home-stage img').length,
  appClass:document.querySelector('#root .pawcream-app')?.className||''
 }));
 await page.screenshot({path:path.join(release,'mobile-home.png')});
 await page.goto(base+'/?scene=atelier',{waitUntil:'domcontentloaded'});
 await page.waitForSelector('section[aria-label^="PawCream Atelier Room"]',{timeout:15000});
 await page.waitForTimeout(1300);
 const atelier=await page.evaluate(()=>({
  hasOriginalAtelier:!!document.querySelector('section[aria-label^="PawCream Atelier Room"]'),
  stage:document.querySelector('section[aria-label^="PawCream Atelier Room"]')?.getAttribute('aria-label'),
  originalImages:[...document.querySelectorAll('section[aria-label^="PawCream Atelier Room"] img')].map(i=>({
    alt:i.alt,ok:i.complete&&i.naturalWidth>0,url:i.currentSrc||i.src
  }))
 }));
 await page.screenshot({path:path.join(release,'mobile-atelier.png')});

 // The center 10% is interactive; the rest of Color's oversized artboard is not.
 const colorArea=await page.evaluate(()=>{
  const asset=document.querySelector('[data-atelier-asset="color"]');
  if(!asset)throw Error('Color control unavailable');
  const r=asset.getBoundingClientRect();
  const center={x:r.left+r.width/2,y:r.top+r.height/2};
  const outer={x:center.x-Math.min(r.width*.25,40),y:center.y};
  if(!document.elementFromPoint(center.x,center.y)?.closest('[data-atelier-asset="color"]'))
   throw Error('Color center is covered by another element');
  if(!document.elementFromPoint(outer.x,outer.y)?.closest('[data-atelier-asset="color"]'))
   throw Error('Color outer target is not hittable in test');
  return {center,outer};
 });
 const backgroundIndex=()=>page.evaluate(()=>localStorage.getItem('pawcream-atelier-background-v1'));
 const before=await backgroundIndex();
 await page.mouse.click(colorArea.outer.x,colorArea.outer.y);
 await page.waitForTimeout(90);
 if(await backgroundIndex()!==before)throw Error('Color outer 90% still switches the background');
 await page.mouse.click(colorArea.center.x,colorArea.center.y);
 await page.waitForTimeout(90);
 if(await backgroundIndex()===before)throw Error('Color central 10% cannot switch the background');

 // Open the sticky-note wall and verify the actual mobile card does not
 // overlap the XHS header or phone home indicator.
 await page.evaluate(()=>document.querySelector('[data-atelier-asset="message"]').click());
 await page.waitForTimeout(100);
 await page.evaluate(()=>{
  const stage=document.querySelector('section[aria-label^="PawCream Atelier Room"]');
  const note=stage.querySelector('[data-atelier-asset="note"]');
  const r=note.getBoundingClientRect();
  stage.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,
   clientX:r.left+r.width/2,clientY:r.top+r.height/2}));
 });
 await page.waitForSelector('.pawcream-notes-card',{timeout:4000});
 const assertNotesBounds=async(width,height)=>{
  const r=await page.locator('.pawcream-notes-card').boundingBox();
  if(!r||r.y<76||r.x<10||r.x+r.width>width-10||r.y+r.height>height-35)
   throw Error('Sticky-note panel overlaps phone chrome at '+width+'x'+height+': '+JSON.stringify(r));
  if(r.width>342)throw Error('Sticky-note card too wide: '+r.width);
 };
 await assertNotesBounds(390,844);
 await page.setViewportSize({width:320,height:700});
 await page.waitForTimeout(100);
 await assertNotesBounds(320,700);
 await page.setViewportSize({width:390,height:844});
 const results={size:{width:390,height:844},home,atelier,
  pageErrors:errors,missingAssets:unavailable};
 fs.writeFileSync(path.join(release,'browser-smoke.json'),JSON.stringify(results,null,2)+'\n');
 console.log(JSON.stringify({home,atelier:{hasOriginalAtelier:atelier.hasOriginalAtelier,
  images:atelier.originalImages.length,
  loaded:atelier.originalImages.filter(x=>x.ok).length,
  missing:atelier.originalImages.filter(x=>!x.ok).map(x=>x.alt)},
  errors,unavailable},null,2));
 if(!home.hasOriginalHome||!atelier.hasOriginalAtelier||errors.length||unavailable.length)
  throw Error('Original website failed mobile viewport smoke test');
}finally{
 if(browser)await browser.close();
 await new Promise(resolve=>server.close(resolve));
}
