import { useEffect, useMemo, useRef, useState } from 'react'
import cakeCursor from '../assets/pawcream-cake-cursor.png'
import './PhoneDemoFrame.css'

const PHONE_WIDTH = 422
const PHONE_HEIGHT = 876
const CURSOR_HOTSPOT_X = 10
const CURSOR_HOTSPOT_Y = 18
const SPECIAL_CURSOR_TARGETS = [
  'input:not([type="button"]):not([type="submit"]):not([type="reset"]):not([type="checkbox"]):not([type="radio"]):not([type="range"])',
  'textarea',
  '[contenteditable="true"]',
  'button:disabled',
  '[aria-disabled="true"]',
].join(', ')

function getPhoneScale() {
  if (typeof window === 'undefined') return 1
  const widthScale = (window.innerWidth - 48) / PHONE_WIDTH
  const heightScale = (window.innerHeight - 48) / PHONE_HEIGHT
  return Math.max(0.2, Math.min(1, widthScale, heightScale))
}

export default function PhoneDemoFrame() {
  const [scale, setScale] = useState(getPhoneScale)
  const frameRef = useRef<HTMLIFrameElement>(null)
  const cursorRef = useRef<HTMLImageElement>(null)

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

  // Native image cursors can visibly fall back at the rounded iframe boundary.
  // Paint one non-interactive cursor in the outer viewport across both documents.
  useEffect(() => {
    const frame = frameRef.current
    const cursor = cursorRef.current
    if (!frame || !cursor) return

    let frameDocument: Document | null = null
    let frameStyle: HTMLStyleElement | null = null
    const hide = () => { cursor.style.visibility = 'hidden' }

    const show = (x: number, y: number, target: EventTarget | null, pointerType: string) => {
      const element = target as Element | null
      if (pointerType !== 'mouse' || (element && typeof element.closest === 'function' &&
          element.closest(SPECIAL_CURSOR_TARGETS))) {
        hide()
        return
      }
      cursor.style.transform = `translate3d(${x - CURSOR_HOTSPOT_X}px, ${y - CURSOR_HOTSPOT_Y}px, 0)`
      cursor.style.visibility = 'visible'
    }

    const onOuterMove = (event: PointerEvent) => {
      show(event.clientX, event.clientY, event.target, event.pointerType)
    }
    const onInnerMove = (event: PointerEvent) => {
      const rect = frame.getBoundingClientRect()
      show(
        rect.left + event.clientX * rect.width / frame.clientWidth,
        rect.top + event.clientY * rect.height / frame.clientHeight,
        event.target,
        event.pointerType,
      )
    }

    const attachFrame = () => {
      const doc = frame.contentDocument
      if (!doc?.head || doc === frameDocument) return
      frameDocument?.removeEventListener('pointermove', onInnerMove, true)
      frameStyle?.remove()
      frameDocument = doc
      frameStyle = doc.createElement('style')
      frameStyle.id = 'pawcream-frame-cursor-style'
      frameStyle.textContent = `
        html, html::before, html::after,
        body, body *, body *::before, body *::after { cursor: none !important; }
        input:not([type='button']):not([type='submit']):not([type='reset']):not([type='checkbox']):not([type='radio']):not([type='range']),
        textarea, [contenteditable='true'] { cursor: text !important; }
        button:disabled, [aria-disabled='true'] { cursor: not-allowed !important; }
      `
      doc.head.appendChild(frameStyle)
      doc.addEventListener('pointermove', onInnerMove, true)
    }

    document.addEventListener('pointermove', onOuterMove, true)
    document.addEventListener('pointerleave', hide, true)
    window.addEventListener('blur', hide)
    frame.addEventListener('load', attachFrame)
    attachFrame()

    return () => {
      document.removeEventListener('pointermove', onOuterMove, true)
      document.removeEventListener('pointerleave', hide, true)
      window.removeEventListener('blur', hide)
      frame.removeEventListener('load', attachFrame)
      frameDocument?.removeEventListener('pointermove', onInnerMove, true)
      frameStyle?.remove()
    }
  }, [])

  return (
    <>
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
      <img
        ref={cursorRef}
        className="pawcream-phone-demo__cursor"
        src={cakeCursor}
        alt=""
        aria-hidden="true"
        draggable={false}
      />
    </>
  )
}
