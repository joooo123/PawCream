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
    source=source.replace("  const openMyBox = async () => {",fs.readFileSync(path.join(root,'offline-box-cache-snippet.ts'),'utf8')+'\n  const openMyBox = async () => {');
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
    const labelMarker='className="pawcream-signin-drop"';
    const labelReplacement='className="pawcream-signin-drop" data-site-only-label={language === "zh" ? "仅网站可以使用此功能" : "This feature is available on the website only"}';
    if(!source.includes(labelMarker))throw Error('XHS signin notice marker missing');
    source=source.replace(labelMarker,labelReplacement);
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
  if(args.path.endsWith(path.sep+'AtelierWithLetter.tsx')){
    // XHS-only: the actual PawCream brand story, typed on the white paper.
    // Widen only the mobile letter paper by 30% overall; keep the envelope unchanged.
    // A single newline separates each paragraph without wasting a blank line.
    const zhBody='你好呀，欢迎来到 PawCream。这里是一间装满甜蜜的娃衣小店。我们喜欢把少女的颜色、甜甜的灵感和一点点童话心思，缝进每一件小衣服里。\\n愿每一次换装，都像拆开一盒期待已久的小甜点。\\n          躲进糖分里，暂时逃避喧嚣的大人世界。\\n                            甜蜜不止一点点，\\n                            可爱也不止今天。';
    const enBody='Hello and welcome to PawCream. This is a sweet doll-clothes shop. We stitch girly colors, sweet ideas, and fairy-tale touches into each piece.Every outfit \\n    change is like unboxing a long-awaited sweet.\\n       Hide in sweetness, escaping the adult world \\n                for a while. Sweetness and \\n                    cuteness linger beyond\\n                             today.\\n';
    const mobileZhBodyLiteral=JSON.stringify(zhBody.replace(/\\n/g,'\n'));
    const mobileEnBodyLiteral=JSON.stringify(enBody.replace(/\\n/g,'\n'));
    const mobileCopySource="  const mobileZhBody = "+mobileZhBodyLiteral+"\n  const mobileEnBody = "+mobileEnBodyLiteral+"\n  const copy = mobile ? { ...COPY[language], body: language === 'zh' ? mobileZhBody : mobileEnBody, signature: 'made with a little sugar & lots of love ♡' } : COPY[language]";
    const oldCopyOpening = "                <div\n                  className=\"pawcream-paper-copy\"\n                  style={{\n                    left: \`\${tune.textLeft}%\`,\n                    top: \`\${tune.textTop}%\`,\n                    width: \`\${tune.textWidth}%\`,\n                    height: \`\${tune.textHeight}%\`,\n                    fontFamily: language === 'zh'\n                      ? \"'PawCream CN', 'PawCream EN', sans-serif\"\n                      : \"'PawCream EN', sans-serif\",\n                  }}\n                >";
    const newCopyOpening = "              </div>\n              <div className=\"pawcream-envelope-text-wrap\" style={{ position: 'absolute', zIndex: 5, left: tune.paperLeft + '%', top: tune.paperTop + '%', width: tune.paperWidth + '%', height: tune.paperHeight + '%', transform: 'translate3d(0, ' + previewY + '%, 0) rotate(' + tune.paperRotate + 'deg) scale(' + tune.paperScale + ')', transition: previewMode === 'play' ? 'transform ' + tune.riseMs + 'ms cubic-bezier(.2,.76,.28,1)' : 'none' }}>\n                <div className=\"pawcream-paper-copy\" style={{ left: tune.textLeft + '%', top: tune.textTop + '%', width: tune.textWidth + '%', height: tune.textHeight + '%', fontFamily: language === 'zh' ? \"'PawCream CN', 'PawCream EN', sans-serif\" : \"'PawCream EN', sans-serif\" }}>";
    const letterPatches=[
      ["title: '关于 PawCream'","title: '关于 PawCream'"],
      // Production mini-tool: never expose the letter tuning panel in the release ZIP.
      ["  const letterTuneMode = query.get('letterTune') === '1'","  const letterTuneMode = false"],
      ["const LETTER_TUNE_STORAGE_KEY = 'pawcream-letter-tune-v2'","const LETTER_TUNE_STORAGE_KEY = 'pawcream-letter-tune-v3'"],
      ["  const openLetter = () => {\n    void preloadEnvelopeAssets()\n    replay()\n  }",
       "  const openLetter = () => {\n    void preloadEnvelopeAssets()\n    if (letterTuneMode) {\n      setLanguage(readLanguage())\n      setPreviewMode('end')\n      setTypedChars(totalTypingLength)\n      setPaperRaised(true)\n      setOpen(true)\n      return\n    }\n    replay()\n  }"],
      // Keep the normal letter animation; the production ZIP has no tuning panel.
      ["  useEffect(() => {\n    if (!letterTuneMode) return\n    setLanguage(readLanguage())\n    setPreviewMode('end')\n    setTypedChars(totalTypingLength)\n    setPaperRaised(true)\n    setOpen(true)\n  }, [letterTuneMode, totalTypingLength])",
       "  useEffect(() => {\n    if (!letterTuneMode || !open) return\n    setLanguage(readLanguage())\n    setPreviewMode('end')\n    setTypedChars(totalTypingLength)\n    setPaperRaised(true)\n  }, [letterTuneMode, open, totalTypingLength])"],
      ["  const copy = COPY[language]",mobileCopySource],
      ["    setTypedChars(COPY[nextLanguage].title.length + COPY[nextLanguage].body.length)","    setTypedChars(COPY[nextLanguage].title.length + (mobile ? (nextLanguage === 'zh' ? mobileZhBody : mobileEnBody).length : COPY[nextLanguage].body.length))"],
      ["? 'min(520px, calc(100vw - 18px))'","? 'min(580px, calc(100vw - 8px))'"],
      ["right: mobile ? -1 : 4","right: mobile ? 8 : 4"],
      ["            <div className=\"pawcream-envelope-stage\">","            <div style={{ transform: mobile ? 'translateX(-12px) scale(1.26)' : undefined, transformOrigin: 'center' }}><div className=\"pawcream-envelope-stage\">"],
      ["            </div>\n\n            <button\n              type=\"button\"\n              className=\"pawcream-letter-close\"","            </div></div>\n\n            <button\n              type=\"button\"\n              className=\"pawcream-letter-close\""],
      ["    paperTop: 5.5,","    paperTop: 7.5,"],
      ["    endY: -16,","    endY: -15,"],
      ["    paperStretchX: 1.0,","    paperStretchX: 1.31,"],
      ["    textLeft: 19.5,","    textLeft: 10.5,"],
      ["    textTop: 16.5,","    textTop: 11,"],
      ["    textWidth: 64.5,","    textWidth: 85,"],
      ["    textHeight: 56,","    textHeight: 100,"],
      ["    titleSize: 19,","    titleSize: 21,"],
      ["    textHeight: 100,\n    titleLeft: 0,\n    titleTop: 0,\n    titleWidth: 100,\n    titleHeight: 18,\n    titleSize: 21,","    textHeight: 100,\n    titleLeft: 0,\n    titleTop: -2.5,\n    titleWidth: 100,\n    titleHeight: 18,\n    titleSize: 21,"],
      ["    titleSize: 21,\n    zhBodyLeft: 0,\n    zhBodyTop: 29,\n    zhBodyWidth: 100,\n    zhBodyHeight: 64,\n    zhBodySize: 10.5,\n    enBodyLeft: 0,\n    enBodyTop: 29,\n    enBodyWidth: 100,\n    enBodyHeight: 64,\n    enBodySize: 10.5,\n    bodyLineHeight: 1.62,","    titleSize: 21,\n    zhBodyLeft: 0,\n    zhBodyTop: 14,\n    zhBodyWidth: 100,\n    zhBodyHeight: 64,\n    zhBodySize: 10.5,\n    enBodyLeft: -5.5,\n    enBodyTop: 10.5,\n    enBodyWidth: 111.5,\n    enBodyHeight: 64,\n    enBodySize: 14.5,\n    bodyLineHeight: 1.1,"],
      ["  bodyLineHeight: number\n  subtitleLeft: number\n  subtitleTop: number","  bodyLineHeight: number\n  zhBodyLineHeight?: number\n  enBodyLineHeight?: number\n  subtitleLeft: number\n  subtitleTop: number\n  zhSubtitleTop?: number\n  enSubtitleTop?: number"],
      ["    bodyLineHeight: 1.1,\n    subtitleLeft: 0,","    bodyLineHeight: 1.1,\n    zhBodyLineHeight: 1.6,\n    enBodyLineHeight: 1.1,\n    subtitleLeft: 0,"],
      ["    subtitleLeft: 0,\n    subtitleTop: 18,\n    subtitleWidth: 100,\n    subtitleHeight: 10,\n    subtitleSize: 8,","    subtitleLeft: 0,\n    subtitleTop: 7.5,\n    zhSubtitleTop: 8.5,\n    enSubtitleTop: 5.5,\n    subtitleWidth: 100,\n    subtitleHeight: 9,\n    subtitleSize: 11.5,"],

      ["letterSpacing: language === 'zh' ? '.015em' : '.005em'","letterSpacing: language === 'zh' ? '-.025em' : '.005em'"],
      ["color: #648198;","color: #4c7188;"],
      ["margin: 11px 0 0;","margin: 2px 0 0;\n                white-space: pre-wrap;"],
      [".pawcream-paper-copy {\n                position: absolute;\n                z-index: 2;\n                box-sizing: border-box;\n                display: flex;\n                flex-direction: column;\n                align-items: stretch;\n                justify-content: flex-start;\n                overflow: hidden;",".pawcream-envelope-text-wrap { position: absolute; z-index: 5; transform-origin: 50% 84%; pointer-events: none; }\n              .pawcream-paper-copy {\n                position: absolute;\n                z-index: 1;\n                box-sizing: border-box;\n                display: flex;\n                flex-direction: column;\n                align-items: stretch;\n                justify-content: flex-start;\n                overflow: visible;"],
      [oldCopyOpening,newCopyOpening],
      ["height: \`\${tune.titleHeight}%\`,\n                      margin: 0,\n                      overflow: 'hidden',\n                      fontSize: tune.titleSize,","height: \`\${tune.titleHeight}%\`,\n                      margin: 0,\n                      overflow: 'visible',\n                      fontSize: tune.titleSize,"],
      ["lineHeight: tune.bodyLineHeight,","lineHeight: language === 'zh' ? (tune.zhBodyLineHeight ?? tune.bodyLineHeight) : (tune.enBodyLineHeight ?? tune.bodyLineHeight),"],
      ["top: \`${tune.subtitleTop}%\`,","top: \`${(language === 'zh' ? (tune.zhSubtitleTop ?? tune.subtitleTop) : (tune.enSubtitleTop ?? tune.subtitleTop))}%\`,"],
      ["<TuneControl label=\"正文行高\" value={tune.bodyLineHeight} min={1} max={2.6} step={0.02} suffix=\"×\" onChange={(v) => updateTune('bodyLineHeight', v)} />",""],
      ["<TuneControl label=\"中文字体大小\" value={tune.zhBodySize} min={6} max={30} step={0.5} suffix=\"px\" onChange={(v) => updateTune('zhBodySize', v)} />","<TuneControl label=\"中文字体大小\" value={tune.zhBodySize} min={6} max={30} step={0.5} suffix=\"px\" onChange={(v) => updateTune('zhBodySize', v)} />\n                <TuneControl label=\"中文行高\" value={tune.zhBodyLineHeight ?? tune.bodyLineHeight} min={0.8} max={2.2} step={0.02} suffix=\"×\" onChange={(v) => updateTune('zhBodyLineHeight', v)} />"],
      ["<TuneControl label=\"英文字体大小\" value={tune.enBodySize} min={6} max={30} step={0.5} suffix=\"px\" onChange={(v) => updateTune('enBodySize', v)} />","<TuneControl label=\"英文字体大小\" value={tune.enBodySize} min={6} max={30} step={0.5} suffix=\"px\" onChange={(v) => updateTune('enBodySize', v)} />\n                <TuneControl label=\"英文行高\" value={tune.enBodyLineHeight ?? tune.bodyLineHeight} min={0.8} max={2.2} step={0.02} suffix=\"×\" onChange={(v) => updateTune('enBodyLineHeight', v)} />"],
      ["<TuneControl label=\"副标题顶部\" value={tune.subtitleTop} min={0} max={100} step={0.5} suffix=\"%\" onChange={(v) => updateTune('subtitleTop', v)} />","<TuneControl label=\"中文副标题顶部\" value={tune.zhSubtitleTop ?? tune.subtitleTop} min={0} max={100} step={0.5} suffix=\"%\" onChange={(v) => updateTune('zhSubtitleTop', v)} />\n                <TuneControl label=\"英文副标题顶部\" value={tune.enSubtitleTop ?? tune.subtitleTop} min={0} max={100} step={0.5} suffix=\"%\" onChange={(v) => updateTune('enSubtitleTop', v)} />"],
      ["<TuneControl label=\"标题顶部\" value={tune.titleTop} min={0} max={100} step={0.5} suffix=\"%\" onChange={(v) => updateTune('titleTop', v)} />","<TuneControl label=\"标题顶部\" value={tune.titleTop} min={-20} max={100} step={0.5} suffix=\"%\" onChange={(v) => updateTune('titleTop', v)} />"],
      ["<TuneControl label=\"英文左侧\" value={tune.enBodyLeft} min={0} max={100} step={0.5} suffix=\"%\" onChange={(v) => updateTune('enBodyLeft', v)} />","<TuneControl label=\"英文左侧\" value={tune.enBodyLeft} min={-20} max={100} step={0.5} suffix=\"%\" onChange={(v) => updateTune('enBodyLeft', v)} />"],
      ["<TuneControl label=\"英文宽度\" value={tune.enBodyWidth} min={20} max={100} step={0.5} suffix=\"%\" onChange={(v) => updateTune('enBodyWidth', v)} />","<TuneControl label=\"英文宽度\" value={tune.enBodyWidth} min={20} max={130} step={0.5} suffix=\"%\" onChange={(v) => updateTune('enBodyWidth', v)} />"],
    ];
    for(const [from,to] of letterPatches){
      if(!source.includes(from))throw Error('XHS brand letter patch missing '+from);
      source=source.replace(from,to);
    }
    // Strip the tuning controls and their styles from the production bundle,
    // rather than merely leaving the panel hidden behind a false condition.
    const panelStart=source.indexOf('\n          {letterTuneMode && (\n            <aside className="pawcream-letter-tune-panel"');
    const panelEndToken='\n          )}';
    const panelEnd=panelStart>=0?source.indexOf(panelEndToken,panelStart):-1;
    if(panelStart<0||panelEnd<0)throw Error('XHS production build could not locate letter tuning panel');
    source=source.slice(0,panelStart)+source.slice(panelEnd+panelEndToken.length);
    const panelCssStart=source.indexOf('              .pawcream-letter-tune-panel {');
    const panelCssEnd=panelCssStart>=0?source.indexOf('              @keyframes pawcream-envelope-enter {',panelCssStart):-1;
    if(panelCssStart<0||panelCssEnd<0)throw Error('XHS production build could not locate letter tuning styles');
    source=source.slice(0,panelCssStart)+source.slice(panelCssEnd);
    const responsivePanelStart=source.indexOf('              @media (max-width: 700px) {\n                .pawcream-letter-tune-panel {');
    const responsivePanelEndToken='\n              }';
    const responsivePanelEnd=responsivePanelStart>=0?source.indexOf(responsivePanelEndToken,responsivePanelStart):-1;
    if(responsivePanelStart<0||responsivePanelEnd<0)throw Error('XHS production build could not locate responsive letter tuning styles');
    source=source.slice(0,responsivePanelStart)+source.slice(responsivePanelEnd+responsivePanelEndToken.length);
  }
  if(args.path.endsWith(path.sep+'AtelierWithInstax.tsx')){
    // On small screens the six tall size buttons used to set the entire
    // grid height, leaving a large empty strip below the photo preview.
    // Slightly widen the card, shrink the left options, and let the larger
    // right preview determine the grid height. Keep photo selection intact.
    const patches=[
      ["'min(410px, calc(100vw - 20px))'","'min(376px, calc(100vw - 20px))'"],
      ["maxHeight: 'calc(100svh - 20px)'","maxHeight: mobile ? 'calc(100svh - 68px)' : 'calc(100svh - 20px)'"],
      ["padding: mobile ? '26px 18px 22px'","padding: mobile ? '17px 12px 14px'"],
      ["paddingTop: mobile && step !== 'boxing' ? 70","paddingTop: mobile && step !== 'boxing' ? 53"],
      ["fontSize: mobile ? 29 : 32","fontSize: mobile ? 25 : 32"],
      ["fontSize: 20,\n                      color: theme.selectedText","fontSize: mobile ? 16 : 20,\n                      color: theme.selectedText"],
      ["<div style={{ textAlign: 'center', marginBottom: 18 }}>","<div style={{ textAlign: 'center', marginBottom: mobile ? 11 : 18 }}>"],
      ["gridTemplateColumns: mobile ? '86px minmax(0,1fr)'","gridTemplateColumns: mobile ? '64px minmax(0,1fr)'"],
      ["gap: mobile ? 14 : 22","gap: mobile ? 8 : 22"],
      ["<div style={{ display: 'grid', gap: 8, paddingTop: 44 }}>","<div style={{ display: 'grid', gap: mobile ? 6 : 8, paddingTop: mobile ? 36 : 44, alignContent: 'start' }}>"],
      ["minHeight: 44,\n                            padding: '6px 9px'","minHeight: mobile ? 42 : 44,\n                            padding: mobile ? '5px 6px' : '6px 9px'"],
      ["<span style={{ display: 'block', fontSize: 21, fontWeight: 720 }}>{option.label}</span>","<span style={{ display: 'block', fontSize: mobile ? 16 : 21, fontWeight: 720, whiteSpace: 'nowrap' }}>{option.label}</span>"],
      ["<span style={{ display: 'block', marginTop: 2, fontSize: 18, opacity: .72 }}>{option.hint}</span>","<span style={{ display: 'block', marginTop: 2, fontSize: mobile ? 11 : 18, opacity: .72, whiteSpace: 'nowrap' }}>{option.hint}</span>"],
      ["gap: mobile ? 9 : 12","gap: mobile ? 7 : 12"],
      ["minHeight: mobile ? 380 : 430","minHeight: mobile ? 340 : 430"],
      ["maxHeight: mobile ? '355px' : '405px'","maxHeight: mobile ? '328px' : '405px'"],
      ["<div style={{ display: 'flex', justifyContent: 'center', marginTop: 18 }}>","<div style={{ display: 'flex', justifyContent: 'center', marginTop: mobile ? 11 : 18 }}>"],
    ];
    for(const [oldValue,newValue] of patches){
      if(!source.includes(oldValue))throw Error('XHS Instax patch missing '+oldValue);
      source=source.replace(oldValue,newValue);
    }
  }
  if(args.path.endsWith(path.sep+'AtelierWithMusic.tsx')){
    // The 106px fixed header kept the ice-cream at the *wrapped* position.
    // Restore the reference layout: a natural-height title + one-line subtitle.
    const subtitle="style={{ marginTop: 5, fontSize: (mobile ? 11 : 13) + tune.fontBoost, opacity: .72, letterSpacing: '.08em' }}";
    const replacement="style={{ marginTop: 5, fontSize: (mobile ? 9 : 13) + tune.fontBoost, opacity: .72, letterSpacing: mobile ? 0 : '.08em', whiteSpace: mobile ? 'nowrap' : 'normal', lineHeight: mobile ? '14px' : undefined }}";
    if(!source.includes(subtitle))throw Error('XHS music status text style changed');
    source=source.replace(subtitle,replacement);
  }
  if(args.path.endsWith(path.sep+'AtelierWithMusicLayout.tsx')){
    source=source.replace("isPlaying ? 'Pause music' : 'Play music'","isPlaying ? '停止唱针动画' : '旋转唱针'");
  }
  if(args.path.endsWith(path.sep+'AtelierWithMusic.tsx')){
    source=source.replace('离线试听 20 秒','更多音乐见工作室网站');
  }
  if(args.path.endsWith(path.sep+'AtelierPlaceholderV2.tsx')){
    source=source.replace('aria-label={`PawCream Atelier Room ${deviceProfile} layout`}', 'aria-label={`PawCream Atelier Room ${deviceProfile} layout`} data-language={language}');
    // Add sewing to the interactive hit surface without changing the separate
    // People handler. A broad replacement here would make sewing open the wall.
    const interactiveBefore="const interactive = !tuneMode && (key === 'message' || key === 'light' || key === 'color' || key === 'people' || (mobile && key === 'note'))";
    const interactiveAfter="const interactive = !tuneMode && (key === 'message' || key === 'light' || key === 'color' || key === 'people' || key === 'sewing' || (mobile && key === 'note'))";
    if(!source.includes(interactiveBefore))throw Error('XHS sewing interaction marker missing');
    source=source.replace(interactiveBefore,interactiveAfter);
    // Three stable text lines physically inside the Note artwork.
    source=source.replace("{copy.notePrompt}", "{language === 'zh' ? <><span style={{display:'block'}}>留下你想对</span><span style={{display:'block'}}>PawCream</span><span style={{display:'block'}}>说的话吧</span></> : <><span style={{display:'block'}}>Leave a</span><span style={{display:'block'}}>little note</span><span style={{display:'block'}}>for PawCream</span></>}");
    source=source.replace("left: '50%', top: '50%', transform: `translate(-50%, -50%) rotate(${-layout.rotation}deg)`, width: mobile ? '40%' : '35%', maxWidth: 145",
      "left: '50%', top: '47%', transform: `translate(-50%, -50%) rotate(${-layout.rotation}deg)`, width: mobile ? '48%' : '35%', maxWidth: 145");
    for(const [a,b] of tuningFixes)source=source.split(a).join(b);
    source=source.replace(/^.*background4\.png.*\r?\n/m,'');
  }
  if(args.path.endsWith(path.sep+'App.tsx')){
    // The standalone container does not expose the administrator backend.
    source=source.replace("import AdminConsole from './components/AdminConsole'",'');
    source=source.replace("return <AdminConsole />","return null");
  }
  source=source.replace(/\.png\b/g,'.webp');
  if(args.path.endsWith(path.sep+'PublicPhotoWall.tsx')) source=source.replace(/\.(?:jpe?g)\b/gi,'.webp');
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
check(!fs.readFileSync(jsFile,'utf8').includes('pawcream-letter-tune-panel'),'Production bundle still contains letter tuning panel markup');
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
  'section[aria-label^="PawCream Atelier Room"][data-language="en"] div[aria-label="Room feature guide"] > span {font-size:17px!important;}',
  'section[aria-label^="PawCream Atelier Room"] div[data-atelier-asset="note"] > span {',
  'background:transparent!important;background-color:transparent!important;',
  'border:0!important;border-radius:0!important;box-shadow:none!important;',
  'color:#617b8b!important;font-size:12px!important;line-height:1.3!important;',
  'padding:0!important;white-space:normal!important;',
  '}',
  'html.pawcream-signin-open [data-pawcream-notes-board="true"] {z-index:200!important;}',
  'html.pawcream-signin-open [data-pawcream-notes-board="true"]::after {display:none!important;content:none!important;}',
  '.pawcream-signin-drop[data-site-only-label]::before {',
  'content:attr(data-site-only-label);position:absolute;top:-46px;left:12px;right:12px;z-index:1;',
  'display:block;box-sizing:border-box;padding:10px 16px;',
  'border:1px solid rgba(205,148,168,.24);border-radius:999px;',
  'background:rgba(255,249,251,.78);color:#8f6877;',
  'box-shadow:0 8px 24px rgba(101,74,84,.08);',
  'backdrop-filter:blur(13px);-webkit-backdrop-filter:blur(13px);',
  'font-family:"PawCream CN","PawCream EN",sans-serif;font-size:14px;line-height:1.5;text-align:center;',
  'pointer-events:none;',
  '}',
].join('\n');
fs.writeFileSync(cssFile,css);
// Copy all original visual resources after reducing to mobile resolution.
let optimizedImages=0;
for(const relative of walk(sourceAssets)){
 const ext=path.extname(relative).toLowerCase();
 if(ext!=='.png'&&ext!=='.jpg'&&ext!=='.jpeg'&&ext!=='.webp'&&ext!=='.svg')continue;
 const input=path.join(sourceAssets,relative);
 const output=path.join(assets,relative.replace(/\.(?:png|jpe?g)$/i,'.webp'));mkdir(output);
 if(ext==='.webp'||ext==='.svg'){fs.copyFileSync(input,output);continue}
 const studio=relative.startsWith('atelier/');
 const paper=relative.startsWith('instax/');
 const opening=relative.startsWith('instax-transparent/');
 const returnPhoto=relative.startsWith('return_photo/');
 const bg=relative.includes('background')||relative.startsWith('home/');
 const star=relative.startsWith('stars/');
 const width=returnPhoto?640:(paper||opening)?1000:bg?1240:star?180:studio?1100:850;
 const q=returnPhoto?50:(paper||opening)?65:bg?57:studio?61:66;
 cmd('cwebp',['-quiet','-mt','-m','5','-q',String(q),'-alpha_q','100','-resize',String(width),'0',input,'-o',output]);optimizedImages++;
}
// Pack the 40 return photos into the app bundle so the upload stays under the
// platform's 200-file limit without dropping any photos or frame assets.
const returnPhotoSource=path.join(sourceAssets,'return_photo');
check(fs.existsSync(returnPhotoSource),'Missing return_photo source directory');
const returnPhotoFiles=walk(returnPhotoSource).filter(relative=>/\.(?:png|jpe?g|webp)$/i.test(relative));
check(returnPhotoFiles.length===40,'Expected 40 return photos, found '+returnPhotoFiles.length);
const returnPhotoSourceBytes=returnPhotoFiles.reduce((sum,relative)=>sum+fs.statSync(path.join(returnPhotoSource,relative)).size,0);
let returnPhotoOptimizedBytes=0;
const returnPhotoData={};
for(const relative of returnPhotoFiles){
 const optimizedRelative=relative.replace(/\.(?:png|jpe?g)$/i,'.webp');
 const optimizedPath=path.join(assets,'return_photo',optimizedRelative);
 check(fs.existsSync(optimizedPath),'Missing optimized return photo '+optimizedRelative);
 const image=fs.readFileSync(optimizedPath);
 returnPhotoOptimizedBytes+=image.length;
 returnPhotoData[path.basename(optimizedRelative)]='data:image/webp;base64,'+image.toString('base64');
 fs.unlinkSync(optimizedPath);
}
fs.rmSync(path.join(assets,'return_photo'),{recursive:true,force:true});
check(Object.keys(returnPhotoData).length===40,'Return photo pack must contain 40 photos');
fs.writeFileSync(jsFile,'window.__PAWCREAM_RETURN_PHOTOS__='+JSON.stringify(returnPhotoData)+String.fromCharCode(59,10)+fs.readFileSync(jsFile,'utf8'));
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

'</head>','<body>','<div id="root"></div>',

'<script src="./pawcream.js"></script>','<script src="./offline-hint.js"></script>',
'</body>','</html>'
];
fs.writeFileSync(path.join(dist,'index.html'),lines.join('\n')+'\n');
fs.copyFileSync(path.join(root,'offline-hint.js'),path.join(dist,'offline-hint.js'));
for(const image of ['home/Home_mobile.webp','atelier/background.webp','atelier/instax.webp','signin/打字机.webp','signin/打印机注册.webp','iron_box.webp','姓名贴.webp','instax-transparent/粉白竖1.webp','collection/浅蓝雾屿A款.webp','collection/浅蓝雾屿B款.webp','collection/海盐舒芙蕾A款.webp','collection/海盐舒芙蕾B款.webp'])
 check(fs.existsSync(path.join(assets,image)),'Missing artwork '+image);
check(fs.existsSync(path.join(assets,'return_photo'))===false,'Individual return photo files were not packed');
const bundledJs=fs.readFileSync(jsFile,'utf8');
check(bundledJs.includes('window.__PAWCREAM_RETURN_PHOTOS__='),'Missing inline return photo pack');
for(const [re,name] of [[/\bfetch\s*\(/,'network fetch'],[/\bXMLHttpRequest\b/,'network XHR'],[/\bnew\s+Function\s*\(/,'dynamic Function'],[/\beval\s*\(/,'eval'],[/\bimport\s*\(/,'dynamic import']])
 check(!re.test(bundledJs),'Unsupported JavaScript: '+name);
for(const file of [jsFile,path.join(dist,'offline-hint.js')])cmd('node',['--check',file]);
fs.rmSync(zip,{force:true});cmd('zip',['-q','-X','-9','-r',zip,'.'],{cwd:dist});
const zipBytes=fs.statSync(zip).size;
check(zipBytes<=10*1048576,'ZIP TOO LARGE: '+(zipBytes/1048576).toFixed(2)+' MiB');
const entries=cmd('unzip',['-Z','-1',zip]).trim().split('\n');
const packagedFiles=entries.filter(entry=>!entry.endsWith('/'));
check(packagedFiles.length<200,'ZIP contains '+packagedFiles.length+' files; must be under 200');
check(entries.includes('index.html'),'Missing ZIP root index.html');
const allowed=new Set(['jpg','css','gif','svg','png','js','jpeg','json','html','woff2','webp','woff']);
const forbidden=entries.filter(entry=>!entry.endsWith('/')&&!allowed.has(path.extname(entry).slice(1).toLowerCase()));
check(forbidden.length===0,'XHS upload rejects unsupported file types: '+forbidden.join(', '));
check(entries.every(x=>!x.startsWith('/')&&!x.startsWith('../')&&!/\.map$/.test(x)),'Unsupported ZIP entry');
const official=path.join(repo,'.skill/minitool-zip-builder/scripts/audit_artifact.py');
const directoryAudit=cmd('python3',[official,dist]).trim(),zipAudit=cmd('python3',[official,zip]).trim();
const summary={status:'STATIC_PASS_DEVICE_PENDING',architecture:'ORIGINAL_REACT_COMPONENTS',
 originalSiteEntry:'src/main.tsx',sourceWebsiteChanged:false,networkRequestsRemoved:true,
 runtime:'classic JS IIFE, Chrome61+',zipBytes,assetCount:entries.length,fileCount:packagedFiles.length,optimizedRasterImages:optimizedImages,returnPhotoCount:returnPhotoFiles.length,returnPhotoSourceBytes,returnPhotoOptimizedBytes,
 simulator:'PENDING',android:'PENDING',ios:'PENDING',directoryAudit,zipAudit};
fs.writeFileSync(path.join(release,'validation-summary.json'),JSON.stringify(summary,null,2)+'\n');
console.log('PawCream ORIGINAL mobile UI bundle PASS');
console.log('Raster images optimized:',optimizedImages,'ZIP:',(zipBytes/1048576).toFixed(2),'MiB');
console.log(directoryAudit);console.log(zipAudit);
