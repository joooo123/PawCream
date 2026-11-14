import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import './PhoneDemoFrame.css'

const PHONE_WIDTH = 422
const PHONE_HEIGHT = 876

function getPhoneScale() {
  if (typeof window === 'undefined') return 1
  const widthScale = (window.innerWidth - 48) / PHONE_WIDTH
  const heightScale = (window.innerHeight - 48) / PHONE_HEIGHT
  return Math.max(0.2, Math.min(1, widthScale, heightScale))
}

export default function PhoneDemoFrame() {
  const [scale, setScale] = useState(getPhoneScale)
  const frameRef = useRef<HTMLIFrameElement>(null)

  // Reapply the same cursor inside the same-origin mobile iframe.
  const syncFrameCursor = useCallback(() => {
    const iframe = frameRef.current
    const doc = iframe?.contentDocument
    if (!iframe || !doc?.head) return
    const cursor = getComputedStyle(iframe).cursor
    if (!cursor.includes('pawcream-cake-cursor')) return

    let style = doc.getElementById('pawcream-frame-cursor-style') as HTMLStyleElement | null
    if (!style) {
      style = doc.createElement('style')
      style.id = 'pawcream-frame-cursor-style'
      doc.head.appendChild(style)
    }
    style.textContent = `
      html, html::before, html::after,
      body, body *, body *::before, body *::after {
        cursor: ${cursor} !important;
      }
      input:not([type='button']):not([type='submit']):not([type='reset']):not([type='checkbox']):not([type='radio']):not([type='range']),
      textarea, [contenteditable='true'] { cursor: text !important; }
      button:disabled, [aria-disabled='true'] { cursor: not-allowed !important; }
    `
  }, [])

  const appUrl = useMemo(() => {
    const url = new URL(window.location.href)
    url.searchParams.delete('demo')
    url.searchParams.delete('tune')
    url.searchParams.set('device', 'mobile')
    url.hash = ''
    return url.pathname + url.search
  }, [])

  useEffect(() => {
    const updateScale = () => setScale(getPhoneScale())
    window.addEventListener('resize', updateScale)
    return () => window.removeEventListener('resize', updateScale)
  }, [])

  return (
    <main className="pawcream-phone-demo" aria-label="PawCream mobile video demo">
      <div
        className="pawcream-phone-demo__stage"
        style={{ width: PHONE_WIDTH * scale, height: PHONE_HEIGHT * scale }}
      >
        <div
          className="pawcream-phone-demo__device"
          style={{ transform: 'scale(' + scale + ')' }}
        >
          <div className="pawcream-phone-demo__screen">
            <iframe
              ref={frameRef}
              onLoad={syncFrameCursor}
              src={appUrl}
              title="PawCream mobile experience"
              loading="eager"
              allow="clipboard-read; clipboard-write"
              referrerPolicy="same-origin"
            />
            <div className="pawcream-phone-demo__island" aria-hidden="true" />
            <div className="pawcream-phone-demo__home-indicator" aria-hidden="true" />
          </div>
        </div>
      </div>
    </main>
  )
}
