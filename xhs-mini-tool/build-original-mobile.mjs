#!/usr/bin/env node
/* Build original PawCream React UI into a CSP-compatible offline mini-tool. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import esbuild from 'esbuild';
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
  // The original p5 particle renderer embeds syntax unsupported by Chrome 61.
  // Keep its home UI slot and exact layout, replacing only this decorative layer.
  if(args.path.endsWith(path.sep+'P5DreamLayer.tsx')){
    return {contents:'export default function P5DreamLayer(){return null}',loader:'tsx'};
  }
  let source=fs.readFileSync(args.path,'utf8');
  if(args.path.endsWith(path.sep+'pawcreamApi.ts')){
   source=source.replace(/const API_BASE = [^\n]+/,"const API_BASE = ''");
   source=source.replace(/\bfetch\s*\(/g,'__offlineNetworkDisabled(');
   source="async function __offlineNetworkDisabled(){throw new Error('小红书离线版不提供云端服务；更多功能见工作室网站')}\n"+source;
   source=source.replace("return window.localStorage.getItem(PREVIEW_AUTH_STORAGE_KEY) === '1'","return false");
   source=source.replace("window.localStorage.setItem(PREVIEW_AUTH_STORAGE_KEY, signedIn ? '1' : '0')","void signedIn");
  }
  if(args.path.endsWith(path.sep+'AtelierPlaceholderV2.tsx')){
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
 platform:'browser',target:['chrome61','safari12'],jsx:'automatic',minify:true,
 legalComments:'none',outdir:dist,entryNames:'pawcream',
 define:{'import.meta.env.BASE_URL':'"./"','import.meta.env.VITE_API_BASE_URL':'""','process.env.NODE_ENV':'"production"'},
 plugins:[originalPlugin],logLevel:'warning'
});
const jsFile=path.join(dist,'pawcream.js'),cssFile=path.join(dist,'pawcream.css');
check(fs.existsSync(jsFile)&&fs.existsSync(cssFile),'Original React / CSS bundle missing');
let css=fs.readFileSync(cssFile,'utf8');
css=css.replace(/url\((['"]?)\/assets\/font\//g,'url($1./assets/font/');
css=css.replace(/,\s*url\((['"]?)\.\/assets\/font\/[^)]*\.ttf(['"]?)\)\s*format\(['"]truetype['"]\)/g,'');
css=css.replace(/\.png\b/g,'.webp');fs.writeFileSync(cssFile,css);
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
