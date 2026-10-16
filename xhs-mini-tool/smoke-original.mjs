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
 await page.mouse.click(lampPoints.transparent.x,lampPoints.transparent.y);
 await page.waitForTimeout(280);
 if(!await night())throw Error('Transparent lamp padding closes night mode');
 await page.mouse.click(lampPoints.opaque.x,lampPoints.opaque.y);
 await page.waitForTimeout(280);
 if(await night())throw Error('Opaque lamp cannot close night mode');
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

 // Open the sticky-note wall and verify the actual mobile card does not
 // overlap the XHS header or phone home indicator.
 await page.evaluate(()=>document.querySelector('[data-atelier-asset="message"]').click());
 await page.waitForTimeout(100);
 const notePrompt=await page.locator('[data-atelier-asset="note"] > span').first().evaluate(el=>{
  const css=getComputedStyle(el);return {lines:el.querySelectorAll('span').length,bg:css.backgroundColor};
 });
 if(notePrompt.lines!==3||notePrompt.bg!=='rgba(0, 0, 0, 0)')
  throw Error('Note prompt needs three transparent lines: '+JSON.stringify(notePrompt));
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

 await page.goto(base+'/?scene=atelier',{waitUntil:'domcontentloaded'});
 await page.waitForSelector('[data-atelier-asset="music"]',{timeout:15000});
 await page.waitForTimeout(700);
 // All nine CD previews must have distinct moods and consistent lifecycle.
 await page.locator('[data-atelier-asset="music"]').click();
 await page.waitForSelector('.pawcream-music-slot-button',{timeout:5000});
 const coneInitial=await page.locator('section[aria-label="Current music disc"] > div').first().boundingBox();
 const moods=['糖果流行','轻盈电子','缓拍梦境','独立民谣','柔和律动',
              '俏皮节拍','温柔木吉他','夏日海风','雨夜钢琴'];
 for(let disc=0;disc<moods.length;disc++){
  await page.locator('.pawcream-music-slot-button').nth(disc).click();
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
 const instaxBounds=await page.locator('.pawcream-instax-maker-card').boundingBox();
 if(!instaxBounds||instaxBounds.width>355||instaxBounds.y<20||instaxBounds.y+instaxBounds.height>822)
  throw Error('Instax maker did not shrink: '+JSON.stringify(instaxBounds));
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
 const paperDimensions=await page.locator('.pawcream-signin-drop').boundingBox();
 await page.evaluate(()=>window.dispatchEvent(new CustomEvent('pawcream:open-signin',{detail:{mode:'login'}})));
 await page.waitForTimeout(420);
 const loginDimensions=await page.locator('.pawcream-signin-drop').boundingBox();
 if(!paperDimensions||!loginDimensions||
  Math.abs(paperDimensions.width-loginDimensions.width)>2||
  Math.abs(paperDimensions.y+paperDimensions.height-loginDimensions.y-loginDimensions.height)>2)
  throw Error('Register/login printer base misaligned: '+JSON.stringify({paperDimensions,loginDimensions}));

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
