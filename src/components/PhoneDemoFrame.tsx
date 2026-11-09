import { useEffect, useMemo, useState } from 'react'
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
