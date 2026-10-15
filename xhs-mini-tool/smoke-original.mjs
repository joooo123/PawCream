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
 // Regression: Color has a large transparent canvas. A tap in that padding
 // must not cycle the background, while a tap on painted pixels must.
 const colorPoints=await page.evaluate(()=>{
  const stage=document.querySelector('section[aria-label^="PawCream Atelier Room"]');
  const asset=stage?.querySelector('[data-atelier-asset="color"]');
  const image=asset?.querySelector('img');
  if(!stage||!asset||!image?.complete||!image.naturalWidth)throw Error('Color asset unavailable');
  const c=document.createElement('canvas');c.width=image.naturalWidth;c.height=image.naturalHeight;
  const context=c.getContext('2d',{willReadFrequently:true});context.drawImage(image,0,0);
  const data=context.getImageData(0,0,c.width,c.height).data;
  const rect=stage.getBoundingClientRect();
  const cx=rect.left+parseFloat(asset.style.left)/100*rect.width;
  const cy=rect.top+parseFloat(asset.style.top)/100*rect.height;
  const angle=parseFloat(asset.style.transform.match(/rotate\\(([-+\\d.]+)deg\\)/)?.[1]||0)*Math.PI/180;
  const width=asset.offsetWidth,height=asset.offsetHeight;
  const points={opaque:null,transparent:null};
  for(let v=.08;v<.92;v+=.02)for(let u=.08;u<.92;u+=.02){
   const alpha=data[(Math.floor(v*c.height)*c.width+Math.floor(u*c.width))*4+3];
   const dx=(u-.5)*width,dy=(v-.5)*height;
   const x=cx+dx*Math.cos(angle)-dy*Math.sin(angle);
   const y=cy+dx*Math.sin(angle)+dy*Math.cos(angle);
   if(x<5||y<5||x>innerWidth-5||y>innerHeight-5)continue;
   if(!document.elementFromPoint(x,y)?.closest('[data-atelier-asset="color"]'))continue;
   if(alpha>=150&&!points.opaque)points.opaque={x,y};
   if(alpha===0&&!points.transparent)points.transparent={x,y};
   if(points.opaque&&points.transparent)return points;
  }
  return points;
 });
 if(!colorPoints.opaque||!colorPoints.transparent)throw Error('Cannot identify painted and transparent Color tap points');
 const before=await page.evaluate(()=>localStorage.getItem('pawcream-atelier-background-v1'));
 await page.mouse.click(colorPoints.transparent.x,colorPoints.transparent.y);
 await page.waitForTimeout(100);
 const afterTransparent=await page.evaluate(()=>localStorage.getItem('pawcream-atelier-background-v1'));
 if(afterTransparent!==before)throw Error('Color transparent padding incorrectly switched the background');
 await page.mouse.click(colorPoints.opaque.x,colorPoints.opaque.y);
 await page.waitForTimeout(100);
 const afterOpaque=await page.evaluate(()=>localStorage.getItem('pawcream-atelier-background-v1'));
 if(afterOpaque===before)throw Error('Color painted pixels did not switch the background');

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
