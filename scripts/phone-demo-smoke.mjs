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
      bezelColor: deviceStyle.backgroundColor,
      bezelImage: deviceStyle.backgroundImage,
      width: rect.width,
      height: rect.height,
    }
  })
  if (shell.backgroundColor !== 'rgb(255, 250, 240)') throw new Error('Cream background color mismatch: ' + shell.backgroundColor)
  if ((shell.backgroundImage.match(/radial-gradient/g) || []).length !== 2) throw new Error('Diamond blue polka-dot pattern is missing')
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

  const featureGuide = appFrame.locator('[aria-label="房间功能提示"]')
  await featureGuide.getByText('品牌介绍', { exact: true }).waitFor({ state: 'visible', timeout: 5000 })
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

  console.log('PASS: cream background with the reference diamond polka-dot pattern')
  console.log('PASS: solid light-blue phone bezel with exact 390x844 app viewport')
  console.log('PASS: latest Atelier feature guide includes the brand introduction hint')
  console.log('PASS: transparent overlay taps pass through to Light; LightOn is above the night veil and below the toolbar')
  console.log('PASS: all 53 return-wall photos load from the GitHub Pages subpath')
  console.log('PASS: login and registration show demo-only messaging')
  console.log('PASS: no backend/API requests were made')
} finally {
  await browser.close()
}
