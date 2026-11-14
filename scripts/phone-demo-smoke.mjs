import { chromium } from 'playwright'

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox'],
})

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } })
  const runtimeErrors = []
  const apiRequests = []
  const photoFailures = []
  page.on('pageerror', (error) => runtimeErrors.push(error.message))
  page.on('request', (request) => {
    const url = new URL(request.url())
    if (url.pathname.startsWith('/api/') || url.hostname === 'pawcream.studio' || url.hostname === 'api-disabled.invalid') {
      apiRequests.push(url.href)
    }
  })
  page.on('response', (response) => {
    if (response.url().includes('/assets/return_photo/') && response.status() >= 400) {
      photoFailures.push(response.url() + ' ' + response.status())
    }
  })

  const demoBasePath = (process.env.DEMO_BASE_PATH || '').replace(/\/$/, '')
  await page.goto(`http://127.0.0.1:4173${demoBasePath}/?demo=1`, { waitUntil: 'domcontentloaded' })

  const iframe = page.locator('iframe[title="PawCream mobile experience"]')
  await iframe.waitFor({ state: 'attached', timeout: 30000 })
  const handle = await iframe.elementHandle()
  const appFrame = await handle?.contentFrame()
  if (!appFrame) throw new Error('Phone iframe did not become available')

  await appFrame.waitForSelector('.pawcream-app', { timeout: 30000 })
  await appFrame.waitForSelector('.home-artboard', { timeout: 30000 })

  const viewport = await appFrame.evaluate(() => ({
    width: window.innerWidth,
    height: window.innerHeight,
  }))
  if (viewport.width !== 390 || viewport.height !== 844) {
    throw new Error('Expected a 390x844 mobile viewport, received ' + JSON.stringify(viewport))
  }

  const cursorStyles = await page.evaluate(() => {
    const stage = document.querySelector('.pawcream-phone-demo')
    const device = document.querySelector('.pawcream-phone-demo__device')
    const frame = document.querySelector('iframe[title="PawCream mobile experience"]')
    const frameBody = frame?.contentDocument?.body
    const hotspot = frameBody?.querySelector('.house-hotspot')
    const screen = frame?.parentElement
    const island = screen?.querySelector('.pawcream-phone-demo__island')
    const homeIndicator = screen?.querySelector('.pawcream-phone-demo__home-indicator')
    if (!stage || !device || !frameBody || !hotspot || !screen || !island || !homeIndicator) {
      throw new Error('Custom cursor test elements are incomplete')
    }
    return {
      outerBody: getComputedStyle(document.body).cursor,
      stage: getComputedStyle(stage).cursor,
      device: getComputedStyle(device).cursor,
      deviceBefore: getComputedStyle(device, '::before').cursor,
      deviceAfter: getComputedStyle(device, '::after').cursor,
      screen: getComputedStyle(screen).cursor,
      island: getComputedStyle(island).cursor,
      homeIndicator: getComputedStyle(homeIndicator).cursor,
      iframeElement: getComputedStyle(frame).cursor,
      iframeBody: getComputedStyle(frameBody).cursor,
      iframeBodyBefore: getComputedStyle(frameBody, '::before').cursor,
      iframeBodyAfter: getComputedStyle(frameBody, '::after').cursor,
      mobileHotspot: getComputedStyle(hotspot).cursor,
    }
  })
  const hasCakeCursor = (value) => (value.includes('pawcream-cake-cursor') || value.includes('data:image/png;base64,')) && value.includes('10 18')
  if (!Object.values(cursorStyles).every(hasCakeCursor)) {
    throw new Error('Cake-slice cursor must be active on the demo shell, pseudo-elements, and mobile iframe: ' + JSON.stringify(cursorStyles))
  }
  const bezelCursorChecks = await page.evaluate(() => {
    const device = document.querySelector('.pawcream-phone-demo__device')
    if (!device) throw new Error('Phone bezel is missing')
    const rect = device.getBoundingClientRect()
    const points = [
      { label: 'top bezel', x: rect.left + rect.width / 2, y: rect.top + 6 },
      { label: 'left bezel', x: rect.left + 6, y: rect.top + rect.height / 2 },
      { label: 'right bezel', x: rect.right - 6, y: rect.top + rect.height / 2 },
      { label: 'bottom bezel', x: rect.left + rect.width / 2, y: rect.bottom - 6 },
    ]
    return points.map((point) => {
      const target = document.elementFromPoint(point.x, point.y)
      return {
        label: point.label,
        target: target?.className?.toString() ?? target?.tagName ?? 'none',
        cursor: target ? getComputedStyle(target).cursor : '',
      }
    })
  })
  if (!bezelCursorChecks.every((item) => hasCakeCursor(item.cursor))) {
    throw new Error('Phone bezel hit areas fell back to a default cursor: ' + JSON.stringify(bezelCursorChecks))
  }
  const cursorUrl = cursorStyles.stage.split('url(')[1]?.split(')')[0]?.replaceAll('"', '').replaceAll("'", '')
  if (!cursorUrl) throw new Error('Cake-slice cursor image URL is missing')
  const cursorSize = await page.evaluate(async (src) => {
    const image = new Image()
    image.src = src
    await image.decode()
    return { width: image.naturalWidth, height: image.naturalHeight }
  }, cursorUrl)
  if (cursorSize.width !== 64 || cursorSize.height !== 64) {
    throw new Error('Cake-slice cursor must be a 64x64 transparent PNG: ' + JSON.stringify(cursorSize))
  }
  const cursorPixels = await page.evaluate(async (src) => {
    const image = new Image()
    image.src = src
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Cursor alpha test canvas is unavailable')
    context.drawImage(image, 0, 0)
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data
    const hotspot = context.getImageData(10, 18, 1, 1).data
    const tipRegion = context.getImageData(7, 14, 12, 12).data
    const transparentCorner = context.getImageData(0, 0, 1, 1).data
    let tipRegionMaxAlpha = 0
    for (let i = 3; i < tipRegion.length; i += 4) tipRegionMaxAlpha = Math.max(tipRegionMaxAlpha, tipRegion[i])
    let darkFringePixels = 0
    let totalAlpha = 0
    let weightedX = 0
    let weightedY = 0
    for (let y = 0; y < image.naturalHeight; y += 1) {
      for (let x = 0; x < image.naturalWidth; x += 1) {
        const i = (y * image.naturalWidth + x) * 4
        const alpha = pixels[i + 3]
        if (alpha > 0) {
          totalAlpha += alpha
          weightedX += x * alpha
          weightedY += y * alpha
        }
        if (alpha > 0 && alpha < 128 && Math.max(pixels[i], pixels[i + 1], pixels[i + 2]) < 40) {
          darkFringePixels += 1
        }
      }
    }
    return {
      hotspotAlpha: hotspot[3],
      tipRegionMaxAlpha,
      transparentCornerAlpha: transparentCorner[3],
      darkFringePixels,
      artworkCentroidX: weightedX / totalAlpha,
      artworkCentroidY: weightedY / totalAlpha,
      artworkAngleDeg: Math.atan2(weightedY / totalAlpha - 11, weightedX / totalAlpha - 15) * 180 / Math.PI,
    }
  }, cursorUrl)
  if (cursorPixels.hotspotAlpha === 0 || cursorPixels.tipRegionMaxAlpha < 128) {
    throw new Error('Cake-slice cursor tip hotspot must align with visible cake artwork: ' + JSON.stringify(cursorPixels))
  }
  if (cursorPixels.artworkCentroidX <= 10 || cursorPixels.artworkCentroidY <= 18) {
    throw new Error('Cake-slice artwork must extend down-right from its pointed hotspot: ' + JSON.stringify(cursorPixels))
  }
  if (cursorPixels.transparentCornerAlpha !== 0) {
    throw new Error('Cake-slice cursor must preserve transparent canvas pixels: ' + cursorPixels.transparentCornerAlpha)
  }
  // A single near-transparent resampling pixel is invisible; reject visible dark fringes.
  if (cursorPixels.darkFringePixels > 1) {
    throw new Error('Cake-slice cursor contains dark matte pixels on translucent edges: ' + cursorPixels.darkFringePixels)
  }
  const innerRimCursors = await appFrame.evaluate(() => {
    const points = [[2, 72], [388, 72], [2, 422], [388, 422],
      [2, 772], [388, 772], [72, 2], [195, 2], [318, 2], [195, 842]]
    return points.map(([x, y]) => {
      const element = document.elementFromPoint(x, y)
      return { x, y, cursor: element ? getComputedStyle(element).cursor : '' }
    })
  })
  if (!innerRimCursors.every(({ cursor }) => hasCakeCursor(cursor))) {
    throw new Error('Mobile iframe inner rim fell back to a default cursor: ' + JSON.stringify(innerRimCursors))
  }

  const textEntryCursor = await appFrame.evaluate(() => {
    const input = document.createElement('input')
    input.type = 'text'
    document.body.appendChild(input)
    const cursor = getComputedStyle(input).cursor
    input.remove()
    return cursor
  })
  if (textEntryCursor !== 'text') throw new Error('Text fields must retain the text cursor: ' + textEntryCursor)

  const shell = await page.evaluate(() => {
    const stage = document.querySelector('.pawcream-phone-demo')
    const device = document.querySelector('.pawcream-phone-demo__device')
    if (!stage || !device) throw new Error('Phone shell is missing')
    const stageStyle = getComputedStyle(stage)
    const deviceStyle = getComputedStyle(device)
    const rect = device.getBoundingClientRect()
    return {
      backgroundColor: stageStyle.backgroundColor,
      backgroundImage: stageStyle.backgroundImage,
      backgroundRepeat: stageStyle.backgroundRepeat,
      backgroundSize: stageStyle.backgroundSize,
      backgroundUrl: stageStyle.backgroundImage.match(/url\(["']?(.*?)["']?\)/)?.[1] ?? '',
      bezelColor: deviceStyle.backgroundColor,
      bezelImage: deviceStyle.backgroundImage,
      width: rect.width,
      height: rect.height,
    }
  })
  if (shell.backgroundColor !== 'rgb(255, 250, 240)') throw new Error('Cream background color mismatch: ' + shell.backgroundColor)
  if (!shell.backgroundUrl.includes('demo-polka-bg')) {
    throw new Error('Uploaded polka-dot background image is missing: ' + shell.backgroundImage)
  }
  if (shell.backgroundRepeat !== 'no-repeat' || shell.backgroundSize !== 'cover') {
    throw new Error('Uploaded polka-dot background must cover the demo viewport without repeating: ' + JSON.stringify(shell))
  }
  const backgroundImageSize = await page.evaluate(async (src) => {
    const image = new Image()
    image.src = src
    await image.decode()
    return { width: image.naturalWidth, height: image.naturalHeight }
  }, shell.backgroundUrl)
  if (backgroundImageSize.width !== 1024 || backgroundImageSize.height !== 768) {
    throw new Error('Uploaded polka-dot background image dimensions mismatch: ' + JSON.stringify(backgroundImageSize))
  }
  if (shell.bezelColor !== 'rgb(199, 224, 237)' || shell.bezelImage !== 'none') {
    throw new Error('Phone bezel must be a solid light blue, received ' + JSON.stringify(shell))
  }
  if (Math.round(shell.width) !== 422 || Math.round(shell.height) !== 876) {
    throw new Error('Phone frame dimensions mismatch: ' + JSON.stringify(shell))
  }

  await appFrame.locator('#pawcream-splash').waitFor({ state: 'hidden', timeout: 30000 })
  await appFrame.locator('.house-hotspot').click({ timeout: 30000 })
  await appFrame.waitForSelector('.pawcream-app--atelier', { timeout: 12000 })
  await appFrame.waitForSelector('section[aria-label^="PawCream Atelier Room"]', { timeout: 12000 })

  // Exercise XHS alpha-aware routing: a transparent overlay over the lamp must pass the tap through.
  await appFrame.waitForFunction(() => {
    const image = document.querySelector('section[aria-label^="PawCream Atelier Room"] [data-atelier-asset="light"] > img')
    return image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0
  }, null, { timeout: 10000 })

  await appFrame.evaluate(() => {
    const stage = document.querySelector('section[aria-label^="PawCream Atelier Room"]')
    const light = stage?.querySelector('[data-atelier-asset="light"]')
    const lightImage = light?.querySelector(':scope > img')
    if (!stage || !light || !lightImage?.complete || !lightImage.naturalWidth) {
      throw new Error('Light artwork is not ready for the transparent-hit test')
    }

    const stageRect = stage.getBoundingClientRect()
    const rect = light.getBoundingClientRect()
    const x = rect.left + rect.width / 2
    const y = rect.top + rect.height / 2
    const overlay = document.createElement('div')
    overlay.dataset.atelierAsset = 'color'
    Object.assign(overlay.style, {
      position: 'absolute',
      left: `${x - stageRect.left - 3}px`,
      top: `${y - stageRect.top - 3}px`,
      width: '6px',
      height: '6px',
      zIndex: '999',
    })

    const transparentCanvas = document.createElement('canvas')
    transparentCanvas.width = 1
    transparentCanvas.height = 1
    const transparentImage = document.createElement('img')
    transparentImage.alt = ''
    transparentImage.src = transparentCanvas.toDataURL('image/png')
    transparentImage.style.width = '100%'
    transparentImage.style.height = '100%'
    overlay.appendChild(transparentImage)
    stage.appendChild(overlay)
    overlay.dispatchEvent(new MouseEvent('click', {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: x,
      clientY: y,
      detail: 1,
    }))
    overlay.remove()
  })

  await appFrame.waitForFunction(() => {
    const stage = document.querySelector('section[aria-label^="PawCream Atelier Room"]')
    const legacyGuide = stage?.querySelector(':scope > div[aria-label="房间功能提示"], :scope > div[aria-label="Room feature guide"]')
    const labelLayer = stage?.querySelector(':scope > .pawcream-guide-label-layer')
    const labels = Array.from(labelLayer?.querySelectorAll('.pawcream-guide-label') ?? [])
      .map((label) => label.textContent ?? '')
    const toolbar = stage?.querySelector('nav[aria-label="PawCream Atelier toolbar"]')
    const brand = toolbar?.querySelector(':scope > strong')
    const shortcutImages = ['people', 'instax', 'sewing', 'note', 'music', 'color']
      .map((key) => stage?.querySelector(`[data-atelier-asset="${key}"] > img[alt]`))
    return Boolean(
      stage?.classList.contains('pawcream-guides-active') &&
      legacyGuide &&
      getComputedStyle(legacyGuide).display === 'none' &&
      labels.includes('品牌介绍') &&
      labels.includes('公共照片墙 ♡') &&
      labels.includes('娃衣收藏册') &&
      labels.includes('留言便签 ✎') &&
      labels.includes('音乐播放器 ♫') &&
      labels.includes('拖动信封') &&
      labels.includes('制作拍立得') &&
      labels.includes('切换背景') &&
      !labels.includes('看看收藏') &&
      !labels.includes('发现小熊') &&
      brand?.textContent?.trim() === 'PawCream' &&
      getComputedStyle(brand).display !== 'none' &&
      shortcutImages.every((image) => image && Number.parseFloat(getComputedStyle(image).opacity) === 0)
    )
  }, null, { timeout: 5000 })

  const toolbarAppearance = await appFrame.evaluate(() => {
    const toolbar = document.querySelector('section[aria-label^="PawCream Atelier Room"] nav[aria-label="PawCream Atelier toolbar"]')
    const brand = toolbar?.querySelector(':scope > strong')
    const controls = toolbar?.querySelector(':scope > div')
    const language = controls?.querySelector(':scope > div:first-child')
    if (!toolbar || !brand || !controls || !language) throw new Error('Authoritative mobile toolbar elements are incomplete')
    const brandRect = brand.getBoundingClientRect()
    const controlsRect = controls.getBoundingClientRect()
    const toolbarRect = toolbar.getBoundingClientRect()
    return {
      background: getComputedStyle(toolbar).backgroundColor,
      height: getComputedStyle(toolbar).height,
      languageWidth: getComputedStyle(language).width,
      columns: getComputedStyle(controls).gridTemplateColumns,
      brandDisplay: getComputedStyle(brand).display,
      brandText: brand.textContent?.trim(),
      justifyContent: getComputedStyle(toolbar).justifyContent,
      brandBeforeControls: brandRect.right < controlsRect.left,
      controlsInsideToolbar: controlsRect.right <= toolbarRect.right + 1,
    }
  })
  if (
    toolbarAppearance.background !== 'rgba(241, 248, 253, 0.95)' ||
    toolbarAppearance.height !== '48px' ||
    toolbarAppearance.languageWidth !== '84px' ||
    toolbarAppearance.columns !== '84px 68px 76px 28px' ||
    toolbarAppearance.brandDisplay === 'none' ||
    toolbarAppearance.brandText !== 'PawCream' ||
    toolbarAppearance.justifyContent !== 'space-between' ||
    !toolbarAppearance.brandBeforeControls ||
    !toolbarAppearance.controlsInsideToolbar
  ) {
    throw new Error('Authoritative mobile toolbar styling mismatch: ' + JSON.stringify(toolbarAppearance))
  }

  await appFrame.waitForFunction(() => {
    const stage = document.querySelector('section[aria-label^="PawCream Atelier Room"]')
    const lightOn = stage?.querySelector('img[data-pawcream-lightline="true"]')
    return Boolean(
      stage?.classList.contains('atelier-night-active') &&
      lightOn?.classList.contains('is-visible') &&
      Number.parseFloat(lightOn ? getComputedStyle(lightOn).opacity : '0') > 0,
    )
  }, null, { timeout: 5000 })

  const lightLayerOrder = await appFrame.evaluate(() => {
    const stage = document.querySelector('section[aria-label^="PawCream Atelier Room"]')
    const lightOn = stage?.querySelector('img[data-pawcream-lightline="true"]')
    const toolbar = stage?.querySelector('nav[aria-label="PawCream Atelier toolbar"]')
    const lamp = stage?.querySelector('[data-atelier-asset="light"]')
    if (!stage || !lightOn || !toolbar || !lamp) throw new Error('Light-on layers are incomplete')
    return {
      veil: Number.parseInt(getComputedStyle(stage, '::after').zIndex, 10),
      lightOn: Number.parseInt(getComputedStyle(lightOn).zIndex, 10),
      toolbar: Number.parseInt(getComputedStyle(toolbar).zIndex, 10),
      lampOutline: getComputedStyle(lamp).outlineStyle,
      lampShadow: getComputedStyle(lamp).boxShadow,
    }
  })
  if (!(lightLayerOrder.veil < lightLayerOrder.lightOn && lightLayerOrder.lightOn < lightLayerOrder.toolbar) ||
      lightLayerOrder.lampOutline !== 'none' || lightLayerOrder.lampShadow !== 'none') {
    throw new Error('Light-on layer/interaction styling mismatch: ' + JSON.stringify(lightLayerOrder))
  }

  const windowInteraction = appFrame.locator('[aria-label="Window interaction"]')
  await windowInteraction.waitFor({ state: 'attached', timeout: 5000 })
  const interactionDebug = await windowInteraction.evaluate((element) => ({
    tag: element.tagName,
    rect: (() => {
      const value = element.getBoundingClientRect()
      return { x: value.x, y: value.y, width: value.width, height: value.height }
    })(),
    notesBoardOpen: Boolean(document.querySelector('[data-pawcream-notes-board="true"]')),
    tune: new URLSearchParams(window.location.search).get('tune'),
  }))
  console.log('Brand introduction hotspot:', JSON.stringify(interactionDebug))
  await windowInteraction.evaluate((element) => {
    element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }))
  })
  const letter = appFrame.locator('.pawcream-letter-overlay')
  await letter.waitFor({ state: 'visible', timeout: 10000 })
  await appFrame.waitForFunction(() => {
    const body = document.querySelector('.pawcream-paper-body')
    return body?.textContent?.includes('可爱也不止今天。')
  }, null, { timeout: 30000 })
  const brandCopy = await letter.locator('.pawcream-paper-body').textContent() ?? ''
  const brandSignature = await letter.locator('.pawcream-paper-signature').textContent() ?? ''
  const brandTextFits = await letter.locator('.pawcream-paper-body').evaluate((element) =>
    element.scrollHeight <= element.clientHeight + 2,
  )
  if (!brandCopy.includes('你好呀，欢迎来到 PawCream') ||
      !brandCopy.includes('装满甜蜜的娃衣小店') ||
      brandCopy.includes('收集柔软日常')) {
    throw new Error('Latest Chinese brand introduction copy mismatch: ' + brandCopy)
  }
  if (!brandSignature.includes('made with a little sugar & lots of love')) {
    throw new Error('Latest brand signature is missing: ' + brandSignature)
  }
  if (!brandTextFits) throw new Error('Latest brand introduction text overflows the paper area')
  await letter.locator('.pawcream-letter-close').click({ force: true })

  await appFrame.locator('[data-atelier-asset="people"]').click({ force: true })
  const wall = appFrame.locator('section[aria-label="PawCream 公共返图墙"]')
  await wall.waitFor({ state: 'visible', timeout: 10000 })
  const wallLayout = await wall.evaluate((element) => {
    const overlay = element.parentElement
    const header = element.querySelector('header')
    const close = element.querySelector('.pawcream-public-wall-icon-close')
    if (!overlay || !header || !close) throw new Error('Mobile photo-wall header elements are incomplete')
    const overlayRect = overlay.getBoundingClientRect()
    const headerRect = header.getBoundingClientRect()
    const closeRect = close.getBoundingClientRect()
    const overlayStyle = getComputedStyle(overlay)
    const closeStyle = getComputedStyle(close)
    return {
      paddingTop: overlayStyle.paddingTop,
      wallTop: element.getBoundingClientRect().top,
      overlayTop: overlayRect.top,
      headerTop: headerRect.top,
      closeText: close.textContent?.trim(),
      closeTitle: close.getAttribute('title'),
      closeWidth: closeRect.width,
      closeHeight: closeRect.height,
      closeRadius: closeStyle.borderRadius,
    }
  })
  if (
    wallLayout.paddingTop !== '72px' ||
    wallLayout.wallTop < 72 ||
    wallLayout.headerTop < 88 ||
    wallLayout.closeText !== '×' ||
    wallLayout.closeTitle !== null ||
    wallLayout.closeWidth !== 38 ||
    wallLayout.closeHeight !== 38 ||
    wallLayout.closeRadius !== '50%'
  ) {
    throw new Error('Mobile photo-wall safe-area/close-button mismatch: ' + JSON.stringify(wallLayout))
  }
  const photoImages = wall.locator('.pawcream-public-wall-grid img')
  const photoCount = await photoImages.count()
  if (photoCount !== 53) throw new Error('Expected 53 return-wall photos, found ' + photoCount)
  await photoImages.evaluateAll((images) => images.forEach((image) => { image.loading = 'eager' }))
  await appFrame.waitForFunction(() => {
    const images = Array.from(document.querySelectorAll('.pawcream-public-wall-grid img'))
    return images.length === 53 && images.every((image) => image.complete && image.naturalWidth > 0)
  }, null, { timeout: 30000 })
  const photoResult = await photoImages.evaluateAll((images) => ({
    loaded: images.filter((image) => image.complete && image.naturalWidth > 0).length,
    wrongBase: images.filter((image) => !new URL(image.src).pathname.includes('/PawCream/xhs-demo/assets/return_photo/')).length,
  }))
  if (photoResult.loaded !== 53 || photoResult.wrongBase !== 0 || photoFailures.length) {
    throw new Error('Return-wall image check failed: ' + JSON.stringify({ photoResult, photoFailures }))
  }
  await photoImages.first().click()
  const quickPreview = appFrame.locator('section[aria-label="返图快速预览"]')
  await quickPreview.waitFor({ state: 'visible', timeout: 5000 })
  await quickPreview.getByRole('button', { name: '查看大图' }).click()
  const detail = appFrame.locator('div[role="dialog"][aria-label="返图详情"]')
  await detail.waitFor({ state: 'visible', timeout: 5000 })
  const detailClose = detail.locator('.pawcream-public-wall-icon-close')
  const detailCloseStyle = await detailClose.evaluate((element) => ({
    text: element.textContent?.trim(),
    title: element.getAttribute('title'),
    width: element.getBoundingClientRect().width,
    height: element.getBoundingClientRect().height,
    radius: getComputedStyle(element).borderRadius,
  }))
  if (detailCloseStyle.text !== '×' || detailCloseStyle.title !== null || detailCloseStyle.width !== 38 ||
      detailCloseStyle.height !== 38 || detailCloseStyle.radius !== '50%') {
    throw new Error('Photo detail close button is not a circular ×: ' + JSON.stringify(detailCloseStyle))
  }
  await detailClose.click()
  await wall.getByRole('button', { name: '关闭公共返图墙' }).click()

  await appFrame.evaluate(() => {
    window.dispatchEvent(new CustomEvent('pawcream:open-signin', { detail: { mode: 'login' } }))
  })
  const signin = appFrame.locator('.pawcream-signin-drop')
  const previewMessage = /当前为演示版本，不提供真实账号登录或注册|This demo does not support real account sign-in or registration/
  await signin.waitFor({ state: 'visible', timeout: 10000 })
  await signin.getByLabel(/邮箱|Email/).fill('demo@example.com')
  await signin.locator('#pawcream-password').fill('not-a-real-password')
  await signin.locator('button[type="submit"]').click()
  await signin.getByText(previewMessage).waitFor({ timeout: 5000 })

  await signin.getByRole('button', { name: /注册|Register/ }).click()
  await signin.getByLabel(/邮箱|Email/).fill('demo@example.com')
  await signin.locator('#pawcream-password').fill('demo-password')
  await signin.getByLabel(/昵称|Nickname/).fill('Demo')
  await signin.getByLabel(/邀请码|Invite code/).fill('DEMO')
  await signin.locator('button[type="submit"]').click()
  await signin.getByText(previewMessage).waitFor({ timeout: 5000 })

  if (apiRequests.length) {
    throw new Error('Demo attempted to call an API/backend: ' + apiRequests.join(' | '))
  }
  if (runtimeErrors.length) {
    throw new Error('Browser runtime errors: ' + runtimeErrors.join(' | '))
  }

  console.log('PASS: cream background uses the uploaded polka-dot image with cover scaling')
  console.log('PASS: uploaded cake-slice cursor preserves aspect ratio and transparent pixels, has clean translucent edges, and anchors clicks at the triangular tip')
  console.log('PASS: solid light-blue phone bezel with exact 390x844 app viewport')
  console.log('PASS: authoritative mobile guide copy is asset-aligned; cabinet/bear labels are hidden and legacy prompts do not overlap')
  console.log('PASS: authoritative mobile toolbar keeps PawCream left and controls right in one 48px row')
  console.log('PASS: transparent overlay taps pass through to Light; LightOn is above the night veil and below the toolbar')
  console.log('PASS: mobile photo wall clears the Dynamic Island, uses circular × close buttons, and loads all 53 photos')
  console.log('PASS: login and registration show demo-only messaging')
  console.log('PASS: no backend/API requests were made')
} finally {
  await browser.close()
}
