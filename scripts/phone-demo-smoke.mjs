import { chromium } from 'playwright'

const browser = await chromium.launch({
  headless: true,
  args: ['--no-sandbox'],
})

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } })
  const runtimeErrors = []
  page.on('pageerror', (error) => runtimeErrors.push(error.message))

  await page.goto('http://127.0.0.1:4173/?demo=1', { waitUntil: 'domcontentloaded' })

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

  const background = await page.locator('.pawcream-phone-demo').evaluate(
    (element) => getComputedStyle(element).backgroundImage,
  )
  const bezel = await page.locator('.pawcream-phone-demo__device').evaluate(
    (element) => getComputedStyle(element).backgroundImage,
  )
  if (!background.includes('radial-gradient')) throw new Error('Blue polka-dot background is missing')
  if (!bezel.includes('linear-gradient')) throw new Error('Light-blue phone bezel is missing')

  await appFrame.locator('#pawcream-splash').waitFor({ state: 'hidden', timeout: 30000 })
  await appFrame.locator('.house-hotspot').click({ timeout: 30000 })
  await appFrame.waitForSelector('.pawcream-app--atelier', { timeout: 12000 })
  await appFrame.waitForSelector('section[aria-label^="PawCream Atelier Room"]', { timeout: 12000 })

  if (runtimeErrors.length) {
    throw new Error('Browser runtime errors: ' + runtimeErrors.join(' | '))
  }

  console.log('PASS: white/blue polka-dot stage and light-blue phone frame')
  console.log('PASS: real 390x844 mobile app rendered inside the iframe')
  console.log('PASS: tap interaction entered the live Atelier Room')
} finally {
  await browser.close()
}
