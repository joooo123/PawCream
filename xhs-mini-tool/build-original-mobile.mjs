#!/usr/bin/env node
/* Build original PawCream React UI into a CSP-compatible offline mini-tool. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import esbuild from 'esbuild';
import { transformSync } from '@babel/core';
const root=path.dirname(fileURLToPath(import.meta.url));
const repo=path.resolve(root,'..'), dist=path.join(root,'dist'),release=path.join(root,'release');
const sourceAssets=path.join(repo,'public/assets'), assets=path.join(dist,'assets');
const zip=path.join(release,'pawcream-xhs-mini-tool.zip');
function check(b,msg){if(!b)throw new Error(msg)}
function cmd(bin,args,opts={}){return execFileSync(bin,args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],...opts})}
function mkdir(f){fs.mkdirSync(path.dirname(f),{recursive:true})}
function walk(d,p=''){return fs.readdirSync(d,{withFileTypes:true}).flatMap(it=>it.isDirectory()?walk(path.join(d,it.name),p+it.name+'/'):[p+it.name])}
fs.rmSync(dist,{recursive:true,force:true});fs.mkdirSync(assets,{recursive:true});fs.mkdirSync(release,{recursive:true});
const tuningFixes=[
 ['music: L(37, 40.7, 38, 0)','music: L(35.5, 34.8, 38, 0)'],
 ['color: L(81.5, 16.5, 30, -89)','color: L(80.2, 17.3, 30, -89)'],
 ['music: L(35.5, 36.3, 93.5, 0)','music: L(25.4, 32.5, 93.5, 0)'],
 ['color: L(84, 36.5, 83, -89)','color: L(82.1, 36.6, 83, -89)']
];
const originalPlugin={name:'original-pawcream-mobile',setup(build){
 build.onLoad({filter:/\.(tsx?|jsx?)$/},async args=>{
  if(!args.path.startsWith(path.join(repo,'src')+path.sep))return;
  // Use the offline Canvas renderer in place of the p5 dependency.
  // Removing the entire layer previously deleted all flying Home stars.
  if(args.path.endsWith(path.sep+'P5DreamLayer.tsx')){
    const contents=fs.readFileSync(path.join(root,'P5DreamLayerOffline.tsx'),'utf8');
    return {contents:contents.replace(/\\.png\\b/g,'.webp'),loader:'tsx'};
  }
  let source=fs.readFileSync(args.path,'utf8');
  if(args.path.endsWith(path.sep+'pawcreamApi.ts')){
   source=source.replace(/const API_BASE = [^\n]+/,"const API_BASE = ''");
   source=source.replace(/\bfetch\s*\(/g,'__offlineNetworkDisabled(');
   source="async function __offlineNetworkDisabled(){throw new Error('小红书离线版不提供云端服务；更多功能见工作室网站')}\n"+source;
   source=source.replace("return window.localStorage.getItem(PREVIEW_AUTH_STORAGE_KEY) === '1'","return false");
   source=source.replace("window.localStorage.setItem(PREVIEW_AUTH_STORAGE_KEY, signedIn ? '1' : '0')","void signedIn");
  }
  if(args.path.endsWith(path.sep+'atelierAlphaHit.ts')){
    return {contents:fs.readFileSync(path.join(root,'atelierAlphaHitXhs.ts'),'utf8'),loader:'ts'};
  }
  // Replace only the offline music engine; the website keeps its MP3 player.
  if(args.path.endsWith(path.sep+'AtelierWithMusicAudio.tsx')){
    return {contents:fs.readFileSync(path.join(root,'AtelierWithMusicWebAudio.tsx'),'utf8'),loader:'tsx'};
  }
  if(args.path.endsWith(path.sep+'AtelierWithInstax.tsx')){
    // Keep the original Instax and tin-box React UIs, but replace their cloud
    // handlers with a clearly labeled current-session local preview. The
    // original website source remains untouched.
    const patches=[
      ['  const openMyBox = async () => {','  const retryBoxSync = async () => {',
`  const openMyBox = async () => {
    setBoxOwnerName('离线访客')
    // Keep private creations already made during this offline page session.
    setNewestPhotoId(null)
    setBoxSyncStatus('当前为离线预览；更多功能见工作室网站')
    setStep('boxing')
  }

`],
      ['  const retryBoxSync = async () => {','  const deleteBoxPhoto = async (photo: PawCreamStoredPhoto) => {',
`  const retryBoxSync = async () => {
    setBoxSyncStatus('小红书离线版不支持云端同步；更多功能见工作室网站')
  }

`],
      ['  const deleteBoxPhoto = async (photo: PawCreamStoredPhoto) => {','  useEffect(() => {',
`  const deleteBoxPhoto = async (photo: PawCreamStoredPhoto) => {
    setBoxPhotos(current => current.filter(item => item.id !== photo.id))
    setNewestPhotoId(null)
  }

`],
      ['  const placeInBox = async () => {','  const renderEditableComposite = () => {',
`  const placeInBox = async () => {
    if (!frameMeta || !frameName || !allSlotsFilled || busy) return
    setBusy(true)
    setStatus('正在保存这一刻…')
    try {
      const blob = await composeFinishedPhoto(transparentFrameSrc, frameMeta, photos)
      const saved: PawCreamStoredPhoto = {
        id: 'offline-' + Date.now(),
        ownerId: 'offline-session',
        ownerName: '离线访客',
        imageBlob: blob,
        sourceBlobs: frameMeta.slots.map((_, index) => photos[index]!.sourceBlob),
        frameName, visibility: 'private',
        createdAt: new Date().toISOString(),
        cloudSynced: false,
      }
      setBoxOwnerName('离线访客')
      setBoxPhotos(current => [saved, ...current])
      setNewestPhotoId(saved.id)
      setStep('boxing')
      setStatus('')
      setBoxSyncStatus('作品只在本次离线页面中预览；更多功能见工作室网站')
      const api: any = (window as any).xhs && (window as any).xhs.miniTool
      if (api && typeof api.saveImageToPhotosAlbum === 'function') {
        try {
          const encoded = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader()
            reader.onload = () => resolve(String(reader.result))
            reader.onerror = () => reject(new Error('无法编码照片'))
            reader.readAsDataURL(blob)
          })
          let filePath = encoded
          if (typeof api.writeTempFile === 'function') {
            const result = await api.writeTempFile({ data: encoded })
            if (result && result.filePath) filePath = result.filePath
          }
          await api.saveImageToPhotosAlbum({ filePath })
          setBoxSyncStatus('图片已保存至相册；云端铁盒请前往工作室网站')
        } catch (error) {
          setBoxSyncStatus('已完成离线盒子预览；相册保存未成功，请检查权限。更多功能见工作室网站')
        }
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : '生成拍立得失败')
    } finally { setBusy(false) }
  }

`]
    ];
    for(const [startToken,endToken,replacement] of patches){
      const a=source.indexOf(startToken),b=a>=0?source.indexOf(endToken,a+startToken.length):-1;
      if(a<0||b<=a)throw Error('Unable to locate original Instax offline adapter: '+startToken);
      source=source.slice(0,a)+replacement+source.slice(b);
    }
  }
  // XHS-only responsive overrides: keep the public site untouched.
  if(args.path.endsWith(path.sep+'AtelierWithSignin.tsx')){
    const patches=[
      ["(mobile && registerPaper ? 0.90 : 1)","(mobile ? 0.90 : 1)"],
      ["Math.min(tune.fontBoost, 2)","Math.min(tune.fontBoost, 7)"],
      ["height: mobile && registerPaper ? 23 : mobile ? 27 : 32","height: mobile && registerPaper ? 29 : mobile ? 27 : 32"],
      ["height: mobile && registerPaper ? 24 : mobile ? 28 : 32","height: mobile && registerPaper ? 29 : mobile ? 28 : 32"],
      ["fontSize: (mobile ? 9 : 10) + formFontBoost,","fontSize: mobile && registerPaper ? 12 : (mobile ? 9 : 10) + formFontBoost,\n    whiteSpace: 'nowrap' as const, padding: mobile && registerPaper ? '0 2px' : undefined,\n    flex: mobile && registerPaper ? '1 1 0' : undefined, boxSizing: 'border-box' as const,"],
      ["minHeight: mobile ? 22 : 27,","minHeight: status ? (mobile ? 18 : 27) : 0,"],
      ["marginTop: mobile ? 6 : 8,","marginTop: status ? (mobile ? 3 : 8) : 0,"],
    ];
    for(const [oldValue,newValue] of patches){
      if(!source.includes(oldValue))throw Error('XHS signin patch missing '+oldValue);
      source=source.replace(oldValue,newValue);
    }
  }
  if(args.path.endsWith(path.sep+'AtelierWithInstax.tsx')){
    const patches=[
      ["'min(410px, calc(100vw - 20px))'","'min(350px, calc(100vw - 52px))'"],
      ["maxHeight: 'calc(100svh - 20px)'","maxHeight: mobile ? 'calc(100svh - 94px)' : 'calc(100svh - 20px)'"],
      ["padding: mobile ? '26px 18px 22px'","padding: mobile ? '20px 14px 17px'"],
      ["paddingTop: mobile && step !== 'boxing' ? 70","paddingTop: mobile && step !== 'boxing' ? 60"],
      ["fontSize: mobile ? 29 : 32","fontSize: mobile ? 25 : 32"],
      ["fontSize: 20,\n                      color: theme.selectedText","fontSize: mobile ? 16 : 20,\n                      color: theme.selectedText"],
      ["gridTemplateColumns: mobile ? '86px minmax(0,1fr)'","gridTemplateColumns: mobile ? '76px minmax(0,1fr)'"],
      ["gap: mobile ? 14 : 22","gap: mobile ? 10 : 22"],
      ["minHeight: mobile ? 380 : 430","minHeight: mobile ? 330 : 430"],
      ["maxHeight: mobile ? '355px' : '405px'","maxHeight: mobile ? '310px' : '405px'"],
    ];
    for(const [oldValue,newValue] of patches){
      if(!source.includes(oldValue))throw Error('XHS Instax patch missing '+oldValue);
      source=source.replace(oldValue,newValue);
    }
  }
  if(args.path.endsWith(path.sep+'AtelierWithMusic.tsx')){
    const oldValue="padding: mobile ? '22px 64px 4px 22px' : 0,";
    const newValue="padding: mobile ? '22px 64px 4px 22px' : 0,\n                height: mobile ? 106 : undefined,\n                boxSizing: 'border-box' as const,";
    if(!source.includes(oldValue))throw Error('XHS cone header patch missing');
    source=source.replace(oldValue,newValue);
  }
  if(args.path.endsWith(path.sep+'AtelierWithMusicLayout.tsx')){
    source=source.replace("isPlaying ? 'Pause music' : 'Play music'","isPlaying ? '停止唱针动画' : '旋转唱针'");
  }
  if(args.path.endsWith(path.sep+'AtelierWithMusic.tsx')){
    source=source.replace('离线试听 20 秒','更多音乐见工作室网站');
  }
  if(args.path.endsWith(path.sep+'AtelierPlaceholderV2.tsx')){
    // Give sewing a real interactive hit surface from initial render.
    source=source.replace("key === 'people')","key === 'people' || key === 'sewing')");
    // Three stable text lines physically inside the Note artwork.
    source=source.replace("{copy.notePrompt}", "{language === 'zh' ? <><span style={{display:'block'}}>留下你想对</span><span style={{display:'block'}}>PawCream</span><span style={{display:'block'}}>说的话吧</span></> : copy.notePrompt}");
    source=source.replace("left: '50%', top: '50%', transform: `translate(-50%, -50%) rotate(${-layout.rotation}deg)`, width: mobile ? '40%' : '35%', maxWidth: 145",
      "left: '46%', top: '47%', transform: `translate(-50%, -50%) rotate(${-layout.rotation}deg)`, width: mobile ? '48%' : '35%', maxWidth: 145");
    for(const [a,b] of tuningFixes)source=source.split(a).join(b);
    source=source.replace(/^.*background4\.png.*\r?\n/m,'');
  }
  if(args.path.endsWith(path.sep+'App.tsx')){
    // The standalone container does not expose the administrator backend.
    source=source.replace("import AdminConsole from './components/AdminConsole'",'');
    source=source.replace("return <AdminConsole />","return null");
  }
  source=source.replace(/\.png\b/g,'.webp');
  const loader=args.path.endsWith('.tsx')?'tsx':args.path.endsWith('.jsx')?'jsx':'ts';
  return{contents:source,loader};
 });
}};
await esbuild.build({
 entryPoints:[path.join(root,'site-entry.ts')],bundle:true,format:'iife',write:true,
 external:['/assets/*'],
 platform:'browser',target:'es2020',jsx:'automatic',minify:true,
 legalComments:'none',outdir:dist,entryNames:'pawcream',
 define:{'import.meta.env.BASE_URL':'"./"','import.meta.env.VITE_API_BASE_URL':'""','process.env.NODE_ENV':'"production"'},
 plugins:[originalPlugin],logLevel:'warning'
});
const jsFile=path.join(dist,'pawcream.js'),cssFile=path.join(dist,'pawcream.css');
check(fs.existsSync(jsFile)&&fs.existsSync(cssFile),'Original React / CSS bundle missing');
// Babel safely lowers the completed classic script for Android Chrome 61.
const transpiled=transformSync(fs.readFileSync(jsFile,'utf8'),{babelrc:false,configFile:false,
 presets:[['@babel/preset-env',{targets:{chrome:'61',safari:'12'},modules:false}]],compact:true,comments:false});
check(transpiled && transpiled.code,'Chrome61 Babel transformation failed');
fs.writeFileSync(jsFile,transpiled.code);
let css=fs.readFileSync(cssFile,'utf8');
css=css.replace(/url\((['"]?)\/assets\/font\//g,'url($1./assets/font/');
css=css.replace(/,\s*url\((['"]?)\.\/assets\/font\/[^)]*\.ttf(['"]?)\)\s*format\(['"]truetype['"]\)/g,'');
css=css.replace(/\.png\b/g,'.webp');

// XHS-only override: polka-overlays.css has a blanket !important selector
// that was forcing blue chips and 17px fonts onto both prompt systems.
css += [
  'section[aria-label^="PawCream Atelier Room"] div[aria-label="房间功能提示"] > span,',
  'section[aria-label^="PawCream Atelier Room"] div[aria-label="Room feature guide"] > span {',
  'background:transparent!important;background-color:transparent!important;',
  'border:0!important;border-radius:0!important;box-shadow:none!important;',
  'color:#fff!important;font-size:12px!important;line-height:1.3!important;',
  'padding:0!important;text-shadow:0 1px 5px rgba(0,0,0,.88)!important;',
  '}',
  'section[aria-label^="PawCream Atelier Room"] div[data-atelier-asset="note"] > span {',
  'background:transparent!important;background-color:transparent!important;',
  'border:0!important;border-radius:0!important;box-shadow:none!important;',
  'color:#617b8b!important;font-size:12px!important;line-height:1.3!important;',
  'padding:0!important;white-space:normal!important;',
  '}',
].join('\n');
fs.writeFileSync(cssFile,css);
// Copy all original visual resources after reducing to mobile resolution.
let num=0;
for(const relative of walk(sourceAssets)){
 const ext=path.extname(relative).toLowerCase();
 if(ext!=='.png'&&ext!=='.webp'&&ext!=='.svg')continue;
 const input=path.join(sourceAssets,relative);
 const output=path.join(assets,relative.replace(/\.png$/i,'.webp'));mkdir(output);
 if(ext!=='.png'){fs.copyFileSync(input,output);continue}
 const studio=relative.startsWith('atelier/');
 const paper=relative.startsWith('instax/');
 const opening=relative.startsWith('instax-transparent/');
 const bg=relative.includes('background')||relative.startsWith('home/');
 const star=relative.startsWith('stars/');
 const width=(paper||opening)?1000:bg?1240:star?180:studio?1100:850;
 const q=(paper||opening)?65:bg?57:studio?61:66;
 cmd('cwebp',['-quiet','-mt','-m','5','-q',String(q),'-alpha_q','100','-resize',String(width),'0',input,'-o',output]);num++;
}
// No audio files: the XHS upload whitelist rejects MP3.
for(const font of ['pawcream-en.woff2','pawcream-cn.woff2']){
 const input=path.join(sourceAssets,'font',font);
 check(fs.existsSync(input),'Missing converted font: '+font);
 const output=path.join(assets,'font',font);mkdir(output);fs.copyFileSync(input,output);
}
const lines=[
'<!DOCTYPE html>','<html lang="zh-CN">','<head>','<meta charset="utf-8">',
'<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">',
'<meta name="theme-color" content="#fbf5f8">','<title>PawCream 工作室</title>',
'<link rel="stylesheet" href="./pawcream.css">',
'<link rel="stylesheet" href="./offline-hint.css">',
'</head>','<body>','<div id="root"></div>',
'<div id="xhs-cloud-hint" class="xhs-cloud-hint" role="status" aria-live="polite" hidden>更多功能见工作室网站 ♡<button id="xhs-hint-dismiss" type="button" aria-label="关闭提示">×</button></div>',
'<script src="./pawcream.js"></script>','<script src="./offline-hint.js"></script>',
'</body>','</html>'
];
fs.writeFileSync(path.join(dist,'index.html'),lines.join('\n')+'\n');
for(const file of ['offline-hint.css','offline-hint.js'])fs.copyFileSync(path.join(root,file),path.join(dist,file));
for(const image of ['home/Home_mobile.webp','atelier/background.webp','atelier/instax.webp','signin/打字机.webp','signin/打印机注册.webp','iron_box.webp','姓名贴.webp','instax-transparent/粉白竖1.webp'])
 check(fs.existsSync(path.join(assets,image)),'Missing artwork '+image);
const bundledJs=fs.readFileSync(jsFile,'utf8');
for(const [re,name] of [[/\bfetch\s*\(/,'network fetch'],[/\bXMLHttpRequest\b/,'network XHR'],[/\bnew\s+Function\s*\(/,'dynamic Function'],[/\beval\s*\(/,'eval'],[/\bimport\s*\(/,'dynamic import']])
 check(!re.test(bundledJs),'Unsupported JavaScript: '+name);
for(const file of [jsFile,path.join(dist,'offline-hint.js')])cmd('node',['--check',file]);
fs.rmSync(zip,{force:true});cmd('zip',['-q','-X','-9','-r',zip,'.'],{cwd:dist});
const zipBytes=fs.statSync(zip).size;
check(zipBytes<=10*1048576,'ZIP TOO LARGE: '+(zipBytes/1048576).toFixed(2)+' MiB');
const entries=cmd('unzip',['-Z','-1',zip]).trim().split('\n');
check(entries.includes('index.html'),'Missing ZIP root index.html');
const allowed=new Set(['jpg','css','gif','svg','png','js','jpeg','json','html','woff2','webp','woff']);
const forbidden=entries.filter(entry=>!entry.endsWith('/')&&!allowed.has(path.extname(entry).slice(1).toLowerCase()));
check(forbidden.length===0,'XHS upload rejects unsupported file types: '+forbidden.join(', '));
check(entries.every(x=>!x.startsWith('/')&&!x.startsWith('../')&&!/\.map$/.test(x)),'Unsupported ZIP entry');
const official=path.join(repo,'.skill/minitool-zip-builder/scripts/audit_artifact.py');
const directoryAudit=cmd('python3',[official,dist]).trim(),zipAudit=cmd('python3',[official,zip]).trim();
const summary={status:'STATIC_PASS_DEVICE_PENDING',architecture:'ORIGINAL_REACT_COMPONENTS',
 originalSiteEntry:'src/main.tsx',sourceWebsiteChanged:false,networkRequestsRemoved:true,
 runtime:'classic JS IIFE, Chrome61+',zipBytes,assetCount:entries.length,optimizedPngs:num,
 simulator:'PENDING',android:'PENDING',ios:'PENDING',directoryAudit,zipAudit};
fs.writeFileSync(path.join(release,'validation-summary.json'),JSON.stringify(summary,null,2)+'\n');
console.log('PawCream ORIGINAL mobile UI bundle PASS');
console.log('PNG optimized:',num,'ZIP:',(zipBytes/1048576).toFixed(2),'MiB');
console.log(directoryAudit);console.log(zipAudit);
