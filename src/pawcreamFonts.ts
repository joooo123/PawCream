const LANGUAGE_STORAGE_KEY = 'pawcream-language-v1'

function currentLanguage() {
  return window.localStorage.getItem(LANGUAGE_STORAGE_KEY) === 'en' ? 'en' : 'zh'
}

function applyLanguageClass() {
  const language = currentLanguage()
  const root = document.documentElement
  root.classList.toggle('pawcream-lang-zh', language === 'zh')
  root.classList.toggle('pawcream-lang-en', language === 'en')
  root.lang = language === 'zh' ? 'zh-CN' : 'en'
}

async function addFontTestPanel() {
  const params = new URLSearchParams(window.location.search)
  if (params.get('fonttest') !== '1') return

  const panel = document.createElement('aside')
  panel.id = 'pawcream-font-test'
  panel.innerHTML = `
    <strong>Font diagnostics</strong>
    <div class="cn-sample">中文字体测试：留言板 写下一句话</div>
    <div class="en-sample">English font test: pick a photo!</div>
    <div data-font-status>Checking fonts…</div>
  `
  document.body.appendChild(panel)

  try {
    await document.fonts.ready
    const cnFaces = await document.fonts.load('26px "PawCream CN"', '中文字体测试留言板')
    const enFaces = await document.fonts.load('26px "PawCream EN"', 'pick a photo')
    const cnOk = cnFaces.length > 0 && document.fonts.check('26px "PawCream CN"', '中文字体测试留言板')
    const enOk = enFaces.length > 0 && document.fonts.check('26px "PawCream EN"', 'pick a photo')
    const status = panel.querySelector<HTMLElement>('[data-font-status]')
    if (status) status.textContent = `CN loaded: ${cnOk ? 'YES' : 'NO'} · EN loaded: ${enOk ? 'YES' : 'NO'}`
  } catch (error) {
    const status = panel.querySelector<HTMLElement>('[data-font-status]')
    if (status) status.textContent = `Font check failed: ${String(error)}`
  }
}

applyLanguageClass()
window.addEventListener('storage', applyLanguageClass)
window.setInterval(applyLanguageClass, 250)

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', addFontTestPanel, { once: true })
} else {
  void addFontTestPanel()
}
