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
 await page.waitForFunction(() => Number(document.querySelector('.p5-dream-layer canvas')?.getAttribute('data-star-draw-count')) > 0, {timeout:12000});
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


 // Full opaque Color pixels (even outside center 10%) must work.
 const colorHits=await page.evaluate(()=>{
  const asset=document.querySelector('[data-atelier-asset="color"]');
  const img=asset?.querySelector('img');
  if(!img?.naturalWidth)throw Error('Color image unavailable');
  const r=asset.getBoundingClientRect();
  // Compute rendered CSS rotation from matrix; regex parsing inline style
  // previously failed and silently generated unrotated test coordinates.
  const values=getComputedStyle(asset).transform.slice(7,-1).split(',').map(Number);
  const angle=Math.atan2(values[1],values[0]);
  const point=(u,v)=>{
   const dx=(u-.5)*asset.offsetWidth,dy=(v-.5)*asset.offsetHeight;
   const x=r.left+r.width/2+dx*Math.cos(angle)-dy*Math.sin(angle);
   const y=r.top+r.height/2+dx*Math.sin(angle)+dy*Math.cos(angle);
   const target=document.elementFromPoint(x,y)?.closest('[data-atelier-asset]')?.getAttribute('data-atelier-asset');
   return {x,y,u,v,target};
  };
  return {opaque:point(.5,.45),transparent:point(.25,.5)};
 });
 if(!colorHits.opaque||!colorHits.transparent)throw Error('Cannot find Color painted/transparent taps');
 const backgroundIndex=()=>page.evaluate(()=>localStorage.getItem('pawcream-atelier-background-v1'));
 const before=await backgroundIndex();
 await page.mouse.click(colorHits.transparent.x,colorHits.transparent.y);
 await page.waitForTimeout(95);
 if(await backgroundIndex()!==before)throw Error('Color transparent pixel changed background');
 // Transparent Color areas can correctly pass through to the underlying
 // sewing machine. Reset the room before the independent painted-pixel test.
 await page.goto(base+'/?scene=atelier',{waitUntil:'domcontentloaded'});
 await page.waitForSelector('[data-atelier-asset="color"]',{timeout:5000});
 await page.waitForTimeout(480);
 await page.mouse.click(colorHits.opaque.x,colorHits.opaque.y);
 await page.waitForTimeout(95);
 if(await backgroundIndex()===before)throw Error('Color painted pixel did not change background: '+JSON.stringify(colorHits));

 // Regression: the lamp has a huge transparent image box. Only painted
 // lamp pixels may toggle night mode, in both directions.
 const lampPoints=await page.evaluate(()=>{
  const asset=document.querySelector('[data-atelier-asset="light"]');
  const image=asset?.querySelector('img');
  if(!image?.complete||!image.naturalWidth)throw Error('Lamp image unavailable');
  const rect=asset.getBoundingClientRect();
  const c=document.createElement('canvas');
  c.width=image.naturalWidth;c.height=image.naturalHeight;
  const ctx=c.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(image,0,0);
  const rgba=ctx.getImageData(0,0,c.width,c.height).data;
  const hits={opaque:null,transparent:null};
  for(let y=Math.max(70,Math.ceil(rect.top));y<Math.min(innerHeight-100,rect.bottom);y+=5){
   for(let x=Math.max(12,Math.ceil(rect.left));x<Math.min(innerWidth-12,rect.right);x+=5){
    if(!document.elementFromPoint(x,y)?.closest('[data-atelier-asset="light"]'))continue;
    const sx=Math.min(c.width-1,Math.floor((x-rect.left)/rect.width*c.width));
    const sy=Math.min(c.height-1,Math.floor((y-rect.top)/rect.height*c.height));
    const alpha=rgba[(sy*c.width+sx)*4+3];
    if(alpha>200&&!hits.opaque)hits.opaque={x,y};
    if(alpha===0&&!hits.transparent)hits.transparent={x,y};
    if(hits.opaque&&hits.transparent)return hits;
   }
  }
  return hits;
 });
 if(!lampPoints.opaque||!lampPoints.transparent)
  throw Error('Could not find tappable opaque/transparent lamp pixels');
 const night=()=>page.evaluate(()=>document.querySelector('section[aria-label^="PawCream Atelier Room"]').classList.contains('atelier-night-active'));
 await page.mouse.click(lampPoints.transparent.x,lampPoints.transparent.y);
 await page.waitForTimeout(280);
 if(await night())throw Error('Transparent lamp padding opens night mode');
 await page.mouse.click(lampPoints.opaque.x,lampPoints.opaque.y);
 await page.waitForTimeout(280);
 if(!await night())throw Error('Opaque lamp does not open night mode');
 if(!await page.locator('[aria-label="房间功能提示"]').isVisible())
  throw Error('Missing component feature hints in night mode');
 if(await page.locator('[aria-label="房间功能提示"] span').count()<5)
  throw Error('Night component guide is incomplete');
 const chip=await page.locator('[aria-label="房间功能提示"] > span').first().evaluate(el=>{
  const c=getComputedStyle(el);return {bg:c.backgroundColor,color:c.color,pad:c.padding};
 });
 if(chip.bg!=='rgba(0, 0, 0, 0)'||chip.color!=='rgb(255, 255, 255)'||chip.pad!=='0px')
  throw Error('Night guide still has a tinted chip: '+JSON.stringify(chip));
 await page.getByRole('button',{name:'EN',exact:true}).click();
 const englishHintFont=await page.locator('[aria-label="Room feature guide"] > span').first().evaluate(el=>parseFloat(getComputedStyle(el).fontSize));
 if(englishHintFont!==17)throw Error('English room hints should be 17px after switching to English: '+englishHintFont);
 await page.mouse.click(lampPoints.transparent.x,lampPoints.transparent.y);
 await page.waitForTimeout(280);
 if(!await night())throw Error('Transparent lamp padding closes night mode');
 await page.mouse.click(lampPoints.opaque.x,lampPoints.opaque.y);
 await page.waitForTimeout(280);
 if(await night())throw Error('Opaque lamp cannot close night mode');
 if(await page.locator('#xhs-cloud-hint').count())
  throw Error('Removed bottom website prompt still exists');
 if(await page.locator('[aria-label="房间功能提示"]').count())
  throw Error('Component hints remain after closing night mode');

 // Touch-synthesized clicks sometimes have detail=0; they must still reject
 // invisible image pixels (the previous bypass caused accidental lamp toggles).
 await page.evaluate(({x,y})=>{
  const lamp=document.querySelector('[data-atelier-asset="light"]');
  lamp.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,detail:0,clientX:x,clientY:y}));
 }, lampPoints.transparent);
 await page.waitForTimeout(250);
 if(await night())throw Error('detail=0 transparent touch still opens night mode');

 // Sewing must open from a genuinely painted part, not only its center.
 const sewingPoint=await page.evaluate(()=>{
  const control=document.querySelector('[data-atelier-asset="sewing"]');
  const image=control?.querySelector('img');
  if(!image?.naturalWidth)return null;
  const rect=control.getBoundingClientRect();
  const canvas=document.createElement('canvas');
  canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(image,0,0);
  const data=ctx.getImageData(0,0,canvas.width,canvas.height).data;
  for(let y=Math.max(120,rect.top);y<Math.min(innerHeight-120,rect.bottom);y+=8){
   for(let x=Math.max(10,rect.left);x<Math.min(innerWidth-10,rect.right);x+=8){
    const u=(x-rect.left)/rect.width,v=(y-rect.top)/rect.height;
    if(u<0||u>1||v<0||v>1)continue;
    const px=Math.min(canvas.width-1,Math.floor(u*canvas.width));
    const py=Math.min(canvas.height-1,Math.floor(v*canvas.height));
    if(data[(py*canvas.width+px)*4+3]<175)continue;
    const top=document.elementFromPoint(x,y)?.closest('[data-atelier-asset]');
    if(top?.getAttribute('data-atelier-asset')==='sewing')return {x,y};
   }
  }
  return null;
 });
 if(!sewingPoint)throw Error('Cannot find a painted sewing-machine touch target');
 await page.mouse.click(sewingPoint.x,sewingPoint.y);
 await page.waitForSelector('.pawcream-lookbook-overlay',{timeout:5000});
 const collectionCases=[
  {counter:'01 / 06',alt:'青空小蓓 海报'},
  {counter:'02 / 06',alt:'夏日海盐波波 海报'},
  {counter:'03 / 06',alt:'浅蓝雾屿 A款 海报'},
  {counter:'04 / 06',alt:'浅蓝雾屿 B款 海报'},
  {counter:'05 / 06',alt:'海盐舒芙蕾 A款 海报'},
  {counter:'06 / 06',alt:'海盐舒芙蕾 B款 海报'},
 ];
 for(let i=0;i<collectionCases.length;i++){
  const item=collectionCases[i];
  await page.waitForFunction(({counter,alt})=>{
   const img=document.querySelector('.pawcream-lookbook-base');
   const label=document.querySelector('.pawcream-lookbook-counter');
   return !!img&&img.alt===alt&&img.complete&&img.naturalWidth>0&&label?.textContent?.trim()===counter;
  },item,{timeout:8000});
  await page.waitForTimeout(500);
  const src=await page.locator('.pawcream-lookbook-base').evaluate(img=>img.currentSrc);
  if(!src.endsWith('.webp'))throw Error('Collection poster was not converted to WebP: '+src);
  if(i>=2){
   const name=['lanwu-a','lanwu-b','shufulei-a','shufulei-b'][i-2];
   await page.screenshot({path:path.join(release,'mobile-collection-'+name+'.png')});
  }
  if(i<collectionCases.length-1)await page.locator('.pawcream-lookbook-arrow.is-next').click();
 }
 // Closing via the X must not let the same touch/click reach the room behind it.
 await page.locator('.pawcream-lookbook-close').click();
 await page.waitForSelector('.pawcream-lookbook-overlay',{state:'detached',timeout:5000});
 await page.waitForTimeout(80);
 if(await page.locator('.pawcream-public-wall').count()!==0)
  throw Error('Closing Collection button unexpectedly opened the return wall');

 // Wait for the sewing interaction listener to reattach after closing, then reopen.
 await page.waitForTimeout(120);
 await page.waitForSelector('[aria-label="Sewing lookbook interaction"]',{timeout:5000});
 await page.mouse.click(sewingPoint.x,sewingPoint.y);
 await page.waitForSelector('.pawcream-lookbook-overlay',{timeout:5000});

 // The backdrop should also close the lookbook without activating anything behind it.
 await page.locator('.pawcream-lookbook-overlay').click({position:{x:4,y:4}});
 await page.waitForSelector('.pawcream-lookbook-overlay',{state:'detached',timeout:5000});
 await page.waitForTimeout(80);
 if(await page.locator('.pawcream-public-wall').count()!==0)
  throw Error('Closing Collection backdrop unexpectedly opened the return wall');

 // Open the public return wall and verify all bundled photos are optimized and usable.
 await page.evaluate(()=>document.querySelector('[data-atelier-asset="people"]').click());
 await page.waitForSelector('.pawcream-public-wall',{timeout:5000});
 const wallText=await page.locator('.pawcream-public-wall').innerText();
 if(!wallText.includes('离线返图展示 · 40 张实拍返图'))throw Error('Return wall count label missing: '+wallText.slice(0,180));
 const returnTiles=page.locator('.pawcream-public-wall-tile img');
 if(await returnTiles.count()!==40)throw Error('Expected 40 return photos, got '+await returnTiles.count());
 await returnTiles.evaluateAll(imgs=>imgs.forEach(img=>{img.loading='eager'}));
 await page.waitForFunction(()=>{
  const imgs=Array.from(document.querySelectorAll('.pawcream-public-wall-tile img'));
  return imgs.length===40&&imgs.every(img=>img.complete&&img.naturalWidth>0&&(img.currentSrc||img.src).startsWith('data:image/webp;base64,'));
 },null,{timeout:20000});
 await page.screenshot({path:path.join(release,'mobile-return-wall.png')});
 await page.locator('.pawcream-public-wall-tile').first().click();
 await page.waitForSelector('.pawcream-public-wall-mobile-sheet img',{timeout:5000});
 const firstPreviewSrc=await page.locator('.pawcream-public-wall-mobile-sheet img').evaluate(img=>img.currentSrc);
 await page.locator('.pawcream-public-wall-mobile-sheet button[aria-label="下一张相纸"]').click();
 await page.waitForFunction((previousSrc)=>{
  const img=document.querySelector('.pawcream-public-wall-mobile-sheet img');
  return !!img&&img.currentSrc!==previousSrc&&img.complete&&img.naturalWidth>0;
 },firstPreviewSrc,{timeout:5000});
 await page.locator('.pawcream-public-wall-mobile-sheet button.pawcream-public-wall-close').filter({hasText:'收起'}).click();
 await page.locator('.pawcream-public-wall > header .pawcream-public-wall-close').click();
 await page.waitForSelector('.pawcream-public-wall',{state:'detached',timeout:5000});

 // Each visible quadrant of the Note artwork must be clickable, including
 // pixels under transparent foreground wrappers (not only the lower-left corner).
 await page.goto(base+'/?scene=atelier',{waitUntil:'domcontentloaded'});
 await page.waitForSelector('[data-atelier-asset="note"] img',{timeout:5000});
 await page.waitForFunction(()=>{
  const img=document.querySelector('[data-atelier-asset="note"] img');
  return !!img&&img.complete&&img.naturalWidth>0;
 },null,{timeout:5000});
 const noteOpaquePoints=await page.evaluate(()=>{
  const note=document.querySelector('[data-atelier-asset="note"]');
  const image=note?.querySelector(':scope > img');
  if(!note||!image?.naturalWidth)return [];
  const canvas=document.createElement('canvas');
  canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  if(!ctx)return [];
  ctx.drawImage(image,0,0);
  const alpha=ctx.getImageData(0,0,canvas.width,canvas.height).data;
  const sample=document.createElement('canvas');sample.width=sample.height=1;
  const sampleCtx=sample.getContext('2d',{willReadFrequently:true});
  if(!sampleCtx)return [];
  const matrixFor=control=>{
   const m=getComputedStyle(control).transform.match(/^matrix\(([^)]+)\)$/);
   return m?m[1].split(',').map(Number):[1,0,0,1,0,0];
  };
  const thetaFor=control=>{
   const m=matrixFor(control);return Math.atan2(m[1],m[0]);
  };
  const pointFor=(px,py)=>{
   const r=note.getBoundingClientRect(),theta=thetaFor(note);
   const lx=((px+.5)/canvas.width-.5)*note.offsetWidth;
   const ly=((py+.5)/canvas.height-.5)*note.offsetHeight;
   return {
    x:r.left+r.width/2+lx*Math.cos(theta)-ly*Math.sin(theta),
    y:r.top+r.height/2+lx*Math.sin(theta)+ly*Math.cos(theta)
   };
  };
  const alphaAtControl=(control,x,y)=>{
   const img=control.querySelector(':scope > img');
   if(!img?.complete||!img.naturalWidth||!img.naturalHeight)return 255;
   const w=control.offsetWidth,h=control.offsetHeight,r=control.getBoundingClientRect();
   if(!w||!h)return 255;
   const m=matrixFor(control),angle=-Math.atan2(m[1],m[0]);
   const dx=x-(r.left+r.width/2),dy=y-(r.top+r.height/2);
   const lx=dx*Math.cos(angle)-dy*Math.sin(angle);
   const ly=dx*Math.sin(angle)+dy*Math.cos(angle);
   const u=(lx+w/2)/w,v=(ly+h/2)/h;
   if(u<0||u>=1||v<0||v>=1)return 0;
   const sx=Math.min(img.naturalWidth-1,Math.floor(u*img.naturalWidth));
   const sy=Math.min(img.naturalHeight-1,Math.floor(v*img.naturalHeight));
   sampleCtx.clearRect(0,0,1,1);
   sampleCtx.drawImage(img,sx,sy,1,1,0,0,1,1);
   return sampleCtx.getImageData(0,0,1,1).data[3];
  };
  const regions=[
   {name:'upper-left',x0:.33,x1:.5,y0:.19,y1:.5},
   {name:'upper-right',x0:.5,x1:.67,y0:.19,y1:.5},
   {name:'lower-left',x0:.33,x1:.5,y0:.5,y1:.8},
   {name:'lower-right',x0:.5,x1:.67,y0:.5,y1:.8}
  ];
  const points=[];
  for(const region of regions){
   let found=null;
   for(let py=Math.floor(region.y0*canvas.height);py<region.y1*canvas.height&&!found;py+=3){
    for(let px=Math.floor(region.x0*canvas.width);px<region.x1*canvas.width;px+=3){
     if(alpha[(py*canvas.width+px)*4+3]<40)continue;
     const p=pointFor(px,py);
     if(p.x<2||p.x>innerWidth-2||p.y<2||p.y>innerHeight-2)continue;
     let reachesNote=false;
     for(const el of document.elementsFromPoint(p.x,p.y)){
      const control=el instanceof Element?el.closest('[data-atelier-asset]'):null;
      if(!control)continue;
      if(control===note){reachesNote=true;break;}
      const key=control.dataset.atelierAsset;
      const threshold=key==='window'||key==='note'?1:(key==='light'||key==='sewing')?12:40;
      if(alphaAtControl(control,p.x,p.y)>=threshold){reachesNote=false;break;}
     }
     if(reachesNote)found={...p,name:region.name,sourceAlpha:alpha[(py*canvas.width+px)*4+3]};
    }
   }
   if(found)points.push(found);
  }
  return points;
 });
 if(noteOpaquePoints.length!==4)
  throw Error('Could not find a visible Note pixel in each quadrant: '+JSON.stringify(noteOpaquePoints));
 for(let i=0;i<noteOpaquePoints.length;i++){
  if(i>0){
   await page.goto(base+'/?scene=atelier',{waitUntil:'domcontentloaded'});
   await page.waitForSelector('[data-atelier-asset="note"] img',{timeout:5000});
   await page.waitForFunction(()=>{
    const img=document.querySelector('[data-atelier-asset="note"] img');
    return !!img&&img.complete&&img.naturalWidth>0;
   },null,{timeout:5000});
  }
  const point=noteOpaquePoints[i];
  await page.mouse.click(point.x,point.y);
  await page.waitForSelector('.pawcream-notes-card',{timeout:4000});
 }
 // Regression: the note board must isolate all artwork in both languages.
 await page.goto(base+'/?scene=atelier',{waitUntil:'domcontentloaded'});
 await page.waitForSelector('[data-atelier-asset="message"]',{timeout:5000});
 await page.mouse.click(lampPoints.opaque.x,lampPoints.opaque.y);
 await page.waitForFunction(()=>document.querySelector('section[aria-label^="PawCream Atelier Room"]')?.querySelector('nav[aria-label="PawCream Atelier toolbar"]')?.style.pointerEvents==='auto',{timeout:3000});

 const openNotesBoard=async()=>{
  await page.evaluate(()=>document.querySelector('[data-atelier-asset="message"]').click());
  await page.waitForTimeout(100);
  await page.evaluate(()=>{
   const stage=document.querySelector('section[aria-label^="PawCream Atelier Room"]');
   const note=stage.querySelector('[data-atelier-asset="note"]');
   const r=note.getBoundingClientRect();
   stage.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,
    clientX:r.left+r.width/2,clientY:r.top+r.height/2}));
  });
  await page.waitForSelector('[data-pawcream-notes-board="true"]',{timeout:4000});
  await page.waitForSelector('.pawcream-notes-card',{timeout:4000});
 };
 const assertNotesIsolation=async(buttonName)=>{
  const button=page.getByRole('button',{name:buttonName,exact:true});
  await button.evaluate(el=>{
   const r=el.getBoundingClientRect();
   const hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
   if(!hit?.closest('[data-pawcream-notes-board="true"]'))
    throw Error('Notes tab is not the topmost hit target: '+JSON.stringify({button:el.textContent,hit:hit?.outerHTML?.slice(0,180)}));
  });
  await button.click();
  await page.waitForTimeout(100);
  if(!await page.locator('.pawcream-notes-card').isVisible()||await page.locator('.pawcream-letter-overlay').isVisible().catch(()=>false))
   throw Error('Tapping '+buttonName+' triggered the brand introduction instead of staying in the notes board');

  // Simulate a click that reaches the underlying window/lamp handlers directly.
  // These must remain inert while the notes overlay is open.
  await page.evaluate(({x,y})=>{
   const windowControl=document.querySelector('[aria-label="Window interaction"]');
   if(!windowControl)throw Error('Window interaction target missing');
   const wr=windowControl.getBoundingClientRect();
   windowControl.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,
    clientX:wr.left+wr.width/2,clientY:wr.top+wr.height/2}));
   const light=document.querySelector('[data-atelier-asset="light"]');
   light.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,clientX:x,clientY:y}));
  },lampPoints.opaque);
  await page.waitForTimeout(100);
  if(!await page.locator('.pawcream-notes-card').isVisible()||await page.locator('.pawcream-letter-overlay').isVisible().catch(()=>false))
   throw Error('Underlying artwork opened the brand introduction while the notes board was open');
  const toolbarPointerEvents=await page.locator('nav[aria-label="PawCream Atelier toolbar"]').evaluate(el=>el.style.pointerEvents);
  if(toolbarPointerEvents!=='auto')throw Error('Underlying lamp toggled the toolbar while the notes board was open');
 };

 await page.getByRole('button',{name:'EN',exact:true}).click();
 await openNotesBoard();
 const enFont=await page.locator('[data-pawcream-notes-board="true"]').evaluate(el=>getComputedStyle(el).fontFamily);
 if(!enFont.includes('PawCream EN'))throw Error('English notes board lost PawCream EN font: '+enFont);
 const enPrompt=await page.locator('[data-atelier-asset="note"] > span').first().evaluate(el=>{
  const css=getComputedStyle(el);return {lines:[...el.querySelectorAll('span')].map(line=>line.textContent.trim()),bg:css.backgroundColor};
 });
 if(JSON.stringify(enPrompt.lines)!==JSON.stringify(['Leave a','little note','for PawCream'])||enPrompt.bg!=='rgba(0, 0, 0, 0)')
  throw Error('English Note prompt must be two words per line across three transparent lines: '+JSON.stringify(enPrompt));
 const noteOffset=await page.locator('[data-atelier-asset="note"] > span').first().evaluate(el=>el.style.left);
 if(noteOffset!=='50%')throw Error('Note prompt was not shifted right: '+noteOffset);
 await assertNotesIsolation('My notes');

 await page.getByRole('button',{name:'Close notes',exact:true}).click();
 await page.getByRole('button',{name:'中文',exact:true}).click();
 await openNotesBoard();
 const zhFont=await page.locator('[data-pawcream-notes-board="true"]').evaluate(el=>getComputedStyle(el).fontFamily);
 if(!zhFont.includes('PawCream CN'))throw Error('Chinese notes board lost PawCream CN font: '+zhFont);
 const zhPrompt=await page.locator('[data-atelier-asset="note"] > span').first().evaluate(el=>{
  const css=getComputedStyle(el);return {lines:[...el.querySelectorAll('span')].map(line=>line.textContent.trim()),bg:css.backgroundColor};
 });
 if(JSON.stringify(zhPrompt.lines)!==JSON.stringify(['留下你想对','PawCream','说的话吧'])||zhPrompt.bg!=='rgba(0, 0, 0, 0)')
  throw Error('Chinese Note prompt must keep three transparent lines: '+JSON.stringify(zhPrompt));
 await assertNotesIsolation('我的便签');

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

 await page.goto(base+'/?scene=atelier',{waitUntil:'domcontentloaded'});
 await page.waitForSelector('[data-atelier-asset="music"]',{timeout:15000});
 await page.waitForTimeout(700);
 // All nine CD previews must have distinct moods and consistent lifecycle.
 await page.locator('[data-atelier-asset="music"]').click();
 await page.waitForSelector('.pawcream-music-slot-button',{timeout:5000});
 const coneInitial=await page.locator('section[aria-label="Current music disc"] > div').first().boundingBox();
 const headerInitial=await page.locator('.pawcream-music-panel header').first().boundingBox();
 if(!headerInitial||headerInitial.height>85)throw Error('Music header retains old extra height: '+JSON.stringify(headerInitial));
 const moods=['糖果流行','轻盈电子','缓拍梦境','独立民谣','柔和律动',
              '俏皮节拍','温柔木吉他','夏日海风','雨夜钢琴'];
 for(let disc=0;disc<moods.length;disc++){
  await page.locator('.pawcream-music-slot-button').nth(disc).click();
  const status=await page.locator('.pawcream-music-panel header > div').nth(1).evaluate(el=>{
   const style=getComputedStyle(el);
   return {nowrap:style.whiteSpace==='nowrap',height:el.getBoundingClientRect().height,
     text:el.textContent,visibleWidth:el.clientWidth,scrollWidth:el.scrollWidth};
  });
  const currentHeader=await page.locator('.pawcream-music-panel header').first().boundingBox();
  if(!status.nowrap||status.height>17||status.scrollWidth>status.visibleWidth+1||
     !currentHeader||!headerInitial||Math.abs(currentHeader.height-headerInitial.height)>1)
   throw Error('Music status wraps or shifts the cone: '+JSON.stringify({status,headerInitial,currentHeader}));
  await page.waitForTimeout(120);
  const coneNow=await page.locator('section[aria-label="Current music disc"] > div').first().boundingBox();
  if(!coneNow||!coneInitial||Math.abs(coneNow.width-coneInitial.width)>2||
     Math.abs(coneNow.y-coneInitial.y)>2||Math.abs(coneNow.x-coneInitial.x)>2)
   throw Error('Ice-cream cone shifted when inserting disc: '+JSON.stringify({coneInitial,coneNow,disc}));
  await page.waitForSelector('section[aria-label="Current music disc"] button[aria-label="旋转唱针"]',{timeout:5000});
  await page.waitForTimeout(850);
  if(disc===0 && !await page.getByText('更多音乐见工作室网站',{exact:false}).count())
   throw Error('Requested studio-site music hint missing');
  await page.locator('section[aria-label="Current music disc"] button[aria-label="旋转唱针"]').click();
  await page.waitForFunction(({disc,mood})=>{
   const html=document.documentElement;
   return html.dataset.pawcreamAudioState==='playing' &&
    html.dataset.pawcreamAudioDisc===String(disc+1) && html.dataset.pawcreamAudioMood===mood;
  },{disc,mood:moods[disc]},{timeout:5000});
  if(!await page.locator('section[aria-label="Current music disc"] button[aria-label="停止唱针动画"]').count())
   throw Error('Spoon animation is not aligned to CD '+(disc+1));
  if(disc===0){
   await page.locator('section[aria-label="Current music disc"] button[aria-label="停止唱针动画"]').click();
   await page.waitForFunction(()=>document.documentElement.dataset.pawcreamAudioState==='stopped',{timeout:5000});
   await page.locator('section[aria-label="Current music disc"] button[aria-label="旋转唱针"]').click();
   await page.waitForFunction(()=>document.documentElement.dataset.pawcreamAudioState==='playing',{timeout:5000});
  }
 }
 await page.locator('[data-pawcream-current-disc-return="1"]').click();
 await page.waitForFunction(()=>document.documentElement.dataset.pawcreamAudioState==='stopped',{timeout:5000});
 await page.goto(base+'/?scene=atelier',{waitUntil:'domcontentloaded'});
 await page.waitForFunction(()=>document.documentElement.dataset.pawcreamAudioState==='stopped',{timeout:5000});
 if(await page.evaluate(()=>document.documentElement.hasAttribute('data-pawcream-audio-disc')||
   document.documentElement.hasAttribute('data-pawcream-audio-mood')))
  throw Error('Web Audio kept active track metadata after music exit');

 // Real file input activation: the offline photo editor must open the
 // system file chooser on a visible, user-tapped gallery control.
 await page.goto(base+'/?scene=atelier',{waitUntil:'domcontentloaded'});
 await page.waitForSelector('section[aria-label^="PawCream Atelier Room"]',{timeout:15000});
 await page.waitForTimeout(500);
 await page.locator('[data-atelier-asset="instax"]').click();
 await page.waitForSelector('.pawcream-instax-maker-card',{timeout:5000});
 const instaxLayout=await page.evaluate(()=>{
  const card=document.querySelector('.pawcream-instax-maker-card');
  const buttons=[...card.querySelectorAll('.pawcream-instax-size')];
  const grid=buttons[0]?.parentElement?.parentElement;
  const preview=grid?.children[1]?.children[1];
  const ok=[...card.querySelectorAll('button')].find(x=>x.textContent.trim()==='ok!');
  if(!card||!grid||!preview||!ok||buttons.length!==6)return null;
  const rect=el=>{const {x,y,width,height,bottom}=el.getBoundingClientRect();return {x,y,width,height,bottom}};
  return {card:rect(card),grid:rect(grid),preview:rect(preview),ok:rect(ok),
    button:rect(buttons[0]),
    labelFont:parseFloat(getComputedStyle(buttons[0].firstElementChild).fontSize),
    hintFont:parseFloat(getComputedStyle(buttons[0].lastElementChild).fontSize),
    gap:ok.getBoundingClientRect().top-preview.getBoundingClientRect().bottom,
    scrollHeight:card.scrollHeight,clientHeight:card.clientHeight};
 });
 if(!instaxLayout||instaxLayout.card.width<355||instaxLayout.card.width>378||
    instaxLayout.card.height>685||instaxLayout.card.y<30||
    instaxLayout.card.bottom>810||instaxLayout.button.width>67||
    instaxLayout.labelFont>17||instaxLayout.hintFont>12||
    instaxLayout.preview.width<238||instaxLayout.preview.height<335||
    instaxLayout.gap<7||instaxLayout.gap>37)
  throw Error('Instax mobile proportions / preview-to-OK spacing wrong: '+JSON.stringify(instaxLayout));
 await page.screenshot({path:path.join(release,'mobile-instax-select.png')});
 await page.getByRole('button',{name:'ok!'}).click();
 await page.getByRole('button',{name:/第 1 格，选择照片/}).click();
 await page.waitForSelector('input[aria-label="从图库选择照片"]',{state:'attached',timeout:4000});
 const choose=page.waitForEvent('filechooser',{timeout:4000});
 await page.getByText('从图库选择',{exact:false}).last().click();
 const fileChooser=await choose;
 await fileChooser.setFiles(path.join(dist,'assets/home/Home_mobile.webp'));
 await page.waitForTimeout(450);
 const inputClosed=await page.locator('input[aria-label="从图库选择照片"]').count()===0;
 const photoLoaded=await page.locator('.pawcream-instax-maker-card img[src^="blob:"]').count()>0;
 if(!inputClosed||!photoLoaded)throw Error('Photo gallery selection did not update the Instax editor');


 // Offline notes must not expose simulation-mode controls.
 await page.goto(base+'/?scene=atelier',{waitUntil:'domcontentloaded'});
 await page.waitForSelector('[data-atelier-asset="message"]',{timeout:5000});
 await page.evaluate(()=>document.querySelector('[data-atelier-asset="message"]').click());
 await page.evaluate(()=>{
  const stage=document.querySelector('section[aria-label^="PawCream Atelier Room"]');
  const note=stage.querySelector('[data-atelier-asset="note"]');
  const r=note.getBoundingClientRect();
  stage.dispatchEvent(new MouseEvent('click',{bubbles:true,cancelable:true,
   clientX:r.left+r.width/2,clientY:r.top+r.height/2}));
 });
 await page.waitForSelector('.pawcream-notes-card',{timeout:4000});
 if(await page.locator('.pawcream-notes-card').getByText('游客预览',{exact:true}).count() ||
    await page.locator('.pawcream-notes-card').getByText('已登录预览',{exact:true}).count())
  throw Error('Offline notes still have simulation mode controls');

 // Registration must stay within the paper, with no inner scrollbar.
 await page.goto(base+'/?scene=atelier',{waitUntil:'domcontentloaded'});
 await page.waitForSelector('[data-atelier-asset="light"]',{timeout:5000});
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('pawcream:open-signin',{detail:{mode:'register'}})));
 await page.waitForSelector('.pawcream-signin-drop',{timeout:5000});
 const registerFit=await page.evaluate(()=>{
  const modal=document.querySelector('.pawcream-signin-drop');
  const form=modal.querySelector('form');
  const paper=form?.parentElement;
  const send=[...modal.querySelectorAll('button')].find(x=>x.textContent?.includes('发送验证码'));
  const p=paper?.getBoundingClientRect(),b=send?.getBoundingClientRect();
  return {overflow:paper?getComputedStyle(paper).overflowY:null,
   sendInside:Boolean(p&&b&&b.left>=p.left-2&&b.right<=p.right+2),
   sendWidth:b?.width||0,scrollHeight:paper?.scrollHeight||0,clientHeight:paper?.clientHeight||0};
 });
 if(registerFit.overflow==='auto'||!registerFit.sendInside)
  throw Error('Registration paper still scrolls or verification button exceeds boundaries: '+JSON.stringify(registerFit));
 const registrationFont=await page.locator('.pawcream-signin-drop input[type="email"]').first().evaluate(el=>parseFloat(getComputedStyle(el).fontSize));
 if(registrationFont<14)throw Error('Registration input font too small: '+registrationFont);
 await page.waitForTimeout(420);
 const paperDimensions=await page.locator('.pawcream-signin-drop').boundingBox();
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('pawcream:open-signin',{detail:{mode:'login'}})));
 await page.waitForTimeout(420);
 const loginDimensions=await page.locator('.pawcream-signin-drop').boundingBox();
 if(!paperDimensions||!loginDimensions||
  Math.abs(paperDimensions.width-loginDimensions.width)>2||
  Math.abs(paperDimensions.y+paperDimensions.height-loginDimensions.y-loginDimensions.height)>2)
  throw Error('Register/login printer base misaligned: '+JSON.stringify({paperDimensions,loginDimensions}));


 // Verify Window/PawCream pixels can open the letter, including outer artwork.
 await page.goto(base+'/?scene=atelier',{waitUntil:'domcontentloaded'});
 await page.waitForSelector('[data-atelier-asset="window"] img',{timeout:5000});
 await page.waitForTimeout(500);
 const windowHit=await page.evaluate(()=>{
  const el=document.querySelector('[data-atelier-asset="window"]'),img=el?.querySelector('img');
  if(!img?.naturalWidth)return null;
  const rect=el.getBoundingClientRect(),c=document.createElement('canvas');
  c.width=img.naturalWidth;c.height=img.naturalHeight;
  const ctx=c.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(img,0,0);
  const data=ctx.getImageData(0,0,c.width,c.height).data;
  let first=null,last=null,blank=null;
  for(let y=Math.max(85,rect.top);y<Math.min(innerHeight-130,rect.bottom);y+=3)
   for(let x=Math.max(8,rect.left);x<Math.min(innerWidth-8,rect.right);x+=3){
    if(document.elementFromPoint(x,y)?.closest('[data-atelier-asset]')!==el)continue;
    const px=Math.floor((x-rect.left)/rect.width*c.width),py=Math.floor((y-rect.top)/rect.height*c.height);
    if(px<0||px>=c.width||py<0||py>=c.height)continue;
    if(data[(py*c.width+px)*4+3]>0){first??={x,y};if(!last||last.x<x)last={x,y};}
    else blank??={x,y};
   }
  return {first,last,blank};
 });
 if(!windowHit?.first||!windowHit.last||windowHit.last.x-windowHit.first.x<24)
  throw Error('Window visible pixels cannot be reached: '+JSON.stringify(windowHit));
 if(windowHit.blank){
  await page.mouse.click(windowHit.blank.x,windowHit.blank.y);
  await page.waitForTimeout(100);
  if(await page.locator('.pawcream-letter-overlay').count())
   throw Error('Transparent Window pixel opened the letter');
 }
 await page.mouse.click(windowHit.first.x,windowHit.first.y);
 await page.waitForSelector('.pawcream-letter-overlay',{timeout:4000});
 await page.locator('.pawcream-letter-close').click();
 await page.waitForTimeout(140);
 await page.mouse.click(windowHit.last.x,windowHit.last.y);
 await page.waitForSelector('.pawcream-letter-overlay',{timeout:4000});
 // Regression for the real mobile failure: the LOWER painted half of the
 // curtain is covered by Light's transparent DOM box. A lower-half tap must
 // still open the letter, not only the two upper samples used previously.
 await page.locator('.pawcream-letter-close').click();
 await page.waitForTimeout(150);
 const lowerWindowHit=await page.evaluate(()=>{
  const windowArt=document.querySelector('[data-atelier-asset="window"]');
  const img=windowArt?.querySelector('img');
  if(!img?.naturalWidth)return null;
  const rect=windowArt.getBoundingClientRect();
  const canvas=document.createElement('canvas');
  canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(img,0,0);
  const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;
  let paintedLower=null,paintedPixels=0;
  const byTop={},coveredBy={};
  for(let y=Math.max(100,Math.ceil(rect.top+rect.height*.53));
      y<Math.min(innerHeight-90,rect.top+rect.height*.80);y+=3){
   for(let x=Math.max(14,Math.ceil(rect.left));x<Math.min(innerWidth-12,rect.right);x+=3){
    const u=(x-rect.left)/rect.width,v=(y-rect.top)/rect.height;
    if(u<0||u>=1||v<.53||v>.80)continue;
    const px=Math.floor(u*canvas.width),py=Math.floor(v*canvas.height);
    if(pixels[(py*canvas.width+px)*4+3]<1)continue;
    paintedPixels++;
    const top=document.elementFromPoint(x,y)?.closest('[data-atelier-asset]');
    const topKey=top?.getAttribute('data-atelier-asset')||'stage';
    byTop[topKey]=(byTop[topKey]||0)+1;
    if(topKey==='window'&&!paintedLower)paintedLower={x,y,topKey};
    if(['music','color'].includes(topKey) && !coveredBy[topKey])
     coveredBy[topKey]={x,y,topKey};
   }
  }
  return {paintedLower,coveredBy,paintedPixels,byTop,rect:rect.toJSON(),natural:{width:img.naturalWidth,height:img.naturalHeight}};
 });
 if(!lowerWindowHit?.coveredBy?.music||!lowerWindowHit?.coveredBy?.color)
  throw Error('Missing covered lower Window pixels for Music and Color: '+JSON.stringify(lowerWindowHit));
 for(const topKey of ['music','color']){
  const hit=lowerWindowHit.coveredBy[topKey];
  await page.mouse.click(hit.x,hit.y);
  await page.waitForSelector('.pawcream-letter-overlay',{timeout:4000});
  await page.locator('.pawcream-letter-close').click();
  await page.waitForTimeout(180);
 }
 if(lowerWindowHit.paintedLower){
  await page.mouse.click(lowerWindowHit.paintedLower.x,lowerWindowHit.paintedLower.y);
  await page.waitForSelector('.pawcream-letter-overlay',{timeout:4000});
 }

 // Open the letter through the actual window interaction; the final ZIP
 // must keep the normal letter animation and omit the debug tuning panel.
 await page.goto(base+'/?scene=atelier',{waitUntil:'domcontentloaded'});
 await page.waitForSelector('section[aria-label^="PawCream Atelier Room"]',{timeout:15000});
 await page.waitForSelector('[aria-label="Window interaction"]',{timeout:5000});
 await page.locator('[aria-label="Window interaction"]').click({force:true});
 await page.waitForSelector('.pawcream-paper-copy',{timeout:5000});
 await page.waitForFunction(()=>{
  const title=document.querySelector('.pawcream-paper-title');
  const body=document.querySelector('.pawcream-paper-body');
  return !!title&&!!body&&title.textContent?.includes('关于 PawCream')&&body.textContent?.includes('可爱也不止今天。');
 },null,{timeout:20000});
 const fit=await page.evaluate(()=>{
  const el=document.querySelector('.pawcream-paper-copy'),title=el?.querySelector('h2'),body=el?.querySelector('.pawcream-paper-body');
  const paper=document.querySelector('.pawcream-envelope-paper-wrap');
  const subtitle=el?.querySelector('.pawcream-paper-signature');
  const paperImage=document.querySelector('.pawcream-envelope-paper');
  const tunePanel=document.querySelector('.pawcream-letter-tune-panel');
  const tuneLabels=[...(tunePanel?.querySelectorAll('.pawcream-letter-tune-row span')||[])].map(node=>node.textContent?.trim());
  if(!el||!title||!body||!paper||!subtitle||!paperImage)return null;
  const b=paper.getBoundingClientRect(),c=body.getBoundingClientRect();
  const stage=document.querySelector('.pawcream-envelope-stage');
  const dialog=document.querySelector('.pawcream-envelope-dialog');
  const front=document.querySelector('.pawcream-envelope-front');
  // Measure the actual painted envelope, not the transparent PNG bounding box.
  // The original front asset has transparent gutters (850px-wide canvas).
  const cv=document.createElement('canvas');
  cv.width=front.naturalWidth;cv.height=front.naturalHeight;
  const cx=cv.getContext('2d',{willReadFrequently:true});
  cx.drawImage(front,0,0);
  const pixels=cx.getImageData(0,0,cv.width,cv.height).data;
  let minX=cv.width,maxX=-1;
  for(let y=0;y<cv.height;y+=2)for(let x=0;x<cv.width;x+=2){
   if(pixels[(y*cv.width+x)*4+3]>30){minX=Math.min(minX,x);maxX=Math.max(maxX,x);}
  }
  const sr=stage.getBoundingClientRect();
  const frontLeft=sr.left+minX/cv.width*sr.width;
  const frontRight=sr.left+(maxX+1)/cv.width*sr.width;
  return {paintedMargins:{left:frontLeft,right:innerWidth-frontRight}, 
   copyLeft:parseFloat(el.style.left),copyWidth:parseFloat(el.style.width),
   font:parseFloat(getComputedStyle(body).fontSize),
   titleFont:parseFloat(getComputedStyle(title).fontSize),
   subtitleFont:parseFloat(getComputedStyle(subtitle).fontSize),
   top:parseFloat(el.style.top),margin:parseFloat(getComputedStyle(body).marginTop),
   h:el.clientHeight,scroll:el.scrollHeight,bodyHeight:c.height,bodyBottom:c.bottom,
   text:body.textContent,heading:title.textContent,subtitle:subtitle.textContent,
   subtitleDisplay:getComputedStyle(subtitle).display,
   paperObjectFit:getComputedStyle(paperImage).objectFit,
   paperTransform:paperImage.style.transform,
   tunePanelPresent:!!tunePanel,tuneLabels,
   whiteSpace:getComputedStyle(body).whiteSpace,
   dialogWidth:dialog.getBoundingClientRect().width,
   closeRect:document.querySelector('.pawcream-letter-close').getBoundingClientRect().toJSON(),
   viewportWidth:window.innerWidth,
   paperRel:{left:paper.style.left,top:paper.style.top,width:paper.style.width,
      height:paper.style.height,transform:paper.style.transform},
   stageRect:stage.getBoundingClientRect().toJSON(),
   // The copy wrapper intentionally extends beyond its top offset; verify the actual text elements stay on the paper.
   inside:[title,body,subtitle].every(node=>{const r=node.getBoundingClientRect();return r.top>=b.top-2&&r.bottom<=b.bottom+2}),
   titleGap:title.getBoundingClientRect().top-b.top};
 });
 const expected=[
  '你好呀，欢迎来到 PawCream。这里是一间装满甜蜜的娃衣小店。我们喜欢把少女的颜色、甜甜的灵感和一点点童话心思，缝进每一件小衣服里。',
  '愿每一次换装，都像拆开一盒期待已久的小甜点。',
  '          躲进糖分里，暂时逃避喧嚣的大人世界。',
  '                            甜蜜不止一点点，',
  '                            可爱也不止今天。',
 ];
 if(!fit||fit.font!==10.5||fit.titleFont!==21||fit.subtitleFont!==11.5||
  fit.copyLeft!==10.5||fit.copyWidth!==85||
  fit.paintedMargins.left<8||fit.paintedMargins.right<8||
  fit.paintedMargins.left>25||fit.paintedMargins.right>25||
  Math.abs(fit.paintedMargins.left-fit.paintedMargins.right)>5||
  fit.closeRect.left<3||fit.closeRect.right>fit.viewportWidth-3||
  fit.top<10.5||fit.top>11.5||fit.margin>5||
  fit.dialogWidth<375||fit.dialogWidth>390||
  // PNG alpha-painted pixels, not the transparent stage box, must be centered.
  fit.paperRel.left!=='14%'||fit.paperRel.top!=='7.5%'||
  fit.paperRel.width!=='75.5%'||fit.paperRel.height!=='84%'||
  !fit.paperRel.transform.includes('-15%')||!fit.paperRel.transform.includes('scale(0.88)')||
  fit.scroll>fit.h+2||!fit.inside||fit.heading!=='关于 PawCream'||
  fit.subtitleDisplay==='none'||fit.subtitle!=='made with a little sugar & lots of love ♡'||
  fit.paperObjectFit!=='contain'||!fit.paperTransform.includes('scaleX(1.31)')||fit.tunePanelPresent||
  fit.whiteSpace!=='pre-wrap'||fit.text!==expected.join('\n'))
  throw Error('New doll-clothes letter text clipped, incomplete or malformed: '+JSON.stringify(fit));
 console.log('BRAND_LETTER_LAYOUT='+JSON.stringify({heading:fit.heading,bodyHeight:fit.bodyHeight,bodyBottom:fit.bodyBottom,stageTop:fit.stageRect.top,containerHeight:fit.h,scrollHeight:fit.scroll,fullText:true,paintedMargins:fit.paintedMargins,copyMargins:{left:fit.copyLeft,right:100-fit.copyLeft-fit.copyWidth}}));
 await page.screenshot({path:path.join(release,'mobile-letter.png')});

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
