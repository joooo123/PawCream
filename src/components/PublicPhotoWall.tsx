import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type TouchEvent as ReactTouchEvent } from 'react'
import {
  isPawCreamApiEnabled,
  listPublicPhotos,
  publicPhotoImageUrl,
  type PawCreamPublicPhoto,
} from '../pawcreamApi'

type Props = { mobile: boolean; onClose: () => void }
const PAGE_SIZE = 24

// Visual-only samples. They never leave this component or enter any photo storage.
type DisplayPhoto = PawCreamPublicPhoto & { ratio?: string; paper?: string }
const SAMPLE_RATIOS = ['3 / 4', '1 / 1', '4 / 3', '2 / 3', '16 / 9', '3 / 5', '5 / 4', '9 / 16']
const SAMPLE_PAPERS = ['#e8edf0', '#f1e2e9', '#e8efdf', '#f5e9d8', '#e5e7f3', '#f3e8e0']
const DEMO_PHOTOS: DisplayPhoto[] = Array.from({ length: 32 }, (_, index) => ({
  id: `sample-${index + 1}`,
  authorName: 'demo',
  frameName: '空白相纸',
  createdAt: '2026-01-01T00:00:00Z',
  ratio: SAMPLE_RATIOS[(index * 3 + Math.floor(index / 5)) % SAMPLE_RATIOS.length],
  paper: SAMPLE_PAPERS[index % SAMPLE_PAPERS.length],
}))

export default function PublicPhotoWall({ mobile, onClose }: Props) {
  // Without a backend, show sample paper automatically. The URL flag also forces
  // a safe animation preview on sites that have a real API configured.
  const demoMode = !isPawCreamApiEnabled() ||
    new URLSearchParams(window.location.search).get('wallDemo') === '1'
  const [photos, setPhotos] = useState<PawCreamPublicPhoto[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [focused, setFocused] = useState<string | null>(null)
  const [detail, setDetail] = useState<string | null>(null)
  const [mobilePreviewId, setMobilePreviewId] = useState<string | null>(null)
  const touchStartX = useRef<number | null>(null)
  const [drift, setDrift] = useState({ x: 0, y: 0 })

  const load = async (offset: number) => {
    if (loading || demoMode) return
    setLoading(true)
    setError('')
    try {
      const result = await listPublicPhotos(offset, PAGE_SIZE)
      setPhotos((current) => offset ? [...current, ...result.photos] : result.photos)
      setTotal(result.total)
      if (!offset && result.photos.length) setFocused(result.photos[0].id)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '返图墙暂时无法加载')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!demoMode) void load(0)
  // First page is requested only when the wall opens.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (detail) setDetail(null)
      else if (mobilePreviewId) setMobilePreviewId(null)
      else onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [detail, mobilePreviewId, onClose])

  const displayedPhotos: DisplayPhoto[] = demoMode ? DEMO_PHOTOS : photos
  const displayedTotal = demoMode ? DEMO_PHOTOS.length : total
  const selected = displayedPhotos.find((photo) => photo.id === focused) ?? displayedPhotos[0]
  const detailPhoto = displayedPhotos.find((photo) => photo.id === detail)
  const mobilePreviewPhoto = displayedPhotos.find((photo) => photo.id === mobilePreviewId)

  const stepMobilePreview = (step: number) => {
    const index = displayedPhotos.findIndex((photo) => photo.id === mobilePreviewId)
    if (index === -1) return
    const next = (index + step + displayedPhotos.length) % displayedPhotos.length
    setMobilePreviewId(displayedPhotos[next].id)
  }

  const endPreviewSwipe = (event: ReactTouchEvent<HTMLElement>) => {
    if (touchStartX.current === null) return
    const delta = event.changedTouches[0].clientX - touchStartX.current
    touchStartX.current = null
    if (Math.abs(delta) >= 45) stepMobilePreview(delta < 0 ? 1 : -1)
  }

  const artwork = (photo: DisplayPhoto, size: 'tile' | 'hero' | 'detail') =>
    demoMode ? (
      <div
        className={`pawcream-public-wall-sample pawcream-public-wall-sample-${size}`}
        style={{
          '--sample-paper': photo.paper,
          aspectRatio: photo.ratio,
          ...(size === 'tile' ? {} : {
            width: '100%',
            height: 'auto',
            maxWidth: (() => {
              const [w, h] = (photo.ratio || '1 / 1').split('/').map(Number)
              const scale = w / h
              return size === 'hero'
                ? `min(100%, ${52 * scale}vh, ${490 * scale}px)`
                : `min(100%, 620px, ${65 * scale}dvh)`
            })(),
          }),
        } as CSSProperties}
        aria-label="演示用空白相纸"
      >
        <span aria-hidden="true" />
      </div>
    ) : (
      <img
        className={size === 'hero' ? 'pawcream-public-wall-hero-image' : undefined}
        src={publicPhotoImageUrl(photo.id)}
        alt={size === 'tile' ? '' : photo.frameName}
        loading={size === 'tile' ? 'lazy' : 'eager'}
      />
    )

  const hover = (photo: DisplayPhoto, event: ReactPointerEvent<HTMLButtonElement>) => {
    if (mobile || event.pointerType !== 'mouse') return
    setFocused((previous) => previous === photo.id ? previous : photo.id)
    const tile = event.currentTarget
    const rect = tile.getBoundingClientRect()
    // Compensate for the tile's existing translation: calculating against the
    // shifted center would cause the magnetic movement to oscillate.
    const currentX = Number(tile.dataset.magnetX || 0)
    const currentY = Number(tile.dataset.magnetY || 0)
    const dx = Math.max(-1, Math.min(1, (event.clientX - (rect.left + rect.width / 2 - currentX)) / (rect.width / 2)))
    const dy = Math.max(-1, Math.min(1, (event.clientY - (rect.top + rect.height / 2 - currentY)) / (rect.height / 2)))
    const x = Math.round(dx * 14)
    const y = Math.round(dy * 12)
    tile.dataset.magnetX = String(x)
    tile.dataset.magnetY = String(y)
    tile.style.setProperty('--magnet-x', `${x}px`)
    tile.style.setProperty('--magnet-y', `${y}px`)
    tile.style.setProperty('--magnet-rotate', `${(dx * 3).toFixed(1)}deg`)
    setDrift({ x: dx * 12, y: dy * 9 })
  }

  const releaseMagnet = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const tile = event.currentTarget
    tile.dataset.magnetX = '0'
    tile.dataset.magnetY = '0'
    tile.style.setProperty('--magnet-x', '0px')
    tile.style.setProperty('--magnet-y', '0px')
    tile.style.setProperty('--magnet-rotate', '0deg')
    setDrift({ x: 0, y: 0 })
  }

  return (
    <div className="pawcream-public-wall-overlay" role="presentation">
      <style>{`
        .pawcream-public-wall-overlay {
          position: fixed; inset: 0; z-index: 180; background: rgba(57,45,56,.4);
          backdrop-filter: blur(14px); display: grid; place-items: center; padding: 16px;
        }
        .pawcream-public-wall {
          width: min(1100px, 100%); max-height: calc(100dvh - 32px); overflow: auto;
          border: 1px solid rgba(195,165,177,.42); border-radius: 30px;
          background: linear-gradient(145deg,#fffafa,#f7f3fa 55%,#eef4f1);
          box-shadow: 0 24px 80px rgba(69,49,62,.22); padding: 24px;
          color: #806b7c; font-family: ui-sans-serif,system-ui,sans-serif;
        }
        .pawcream-public-wall button { cursor: pointer; font: inherit; }
        .pawcream-public-wall-close {
          border: 1px solid #ecdee7; background: #fff; color: #98788e;
          border-radius: 999px; padding: 8px 14px;
        }
        .pawcream-public-wall-layout { display: grid; grid-template-columns: minmax(230px, .8fr) minmax(0, 1.4fr); gap: 24px; }
        .pawcream-public-wall-hero { position: sticky; top: 0; align-self: start; }
        .pawcream-public-wall-hero-image {
          width: 100%; height: min(52vh, 490px); object-fit: contain;
          filter: drop-shadow(0 16px 22px rgba(86,63,77,.18));
          transition: transform 190ms ease-out, opacity 180ms ease-out;
        }
        .pawcream-public-wall-grid { display: grid; grid-template-columns: repeat(5,minmax(0,1fr)); gap: 9px; }
        .pawcream-public-wall-tile {
          border: 1px solid rgba(194,170,181,.36); border-radius: 10px; overflow: hidden;
          padding: 0; background: #fff; aspect-ratio: 4/5;
          transform: translate3d(var(--magnet-x,0px),var(--magnet-y,0px),0) rotate(var(--magnet-rotate,0deg)) scale(1);
          transition: transform 340ms cubic-bezier(.2,1.25,.32,1), box-shadow 240ms ease, border-color 240ms ease;
          will-change: transform;
        }
        @media (hover:hover) and (pointer:fine) {
          .pawcream-public-wall-tile:hover,.pawcream-public-wall-tile:focus-visible {
            transform: translate3d(var(--magnet-x,0px),var(--magnet-y,0px),0) rotate(var(--magnet-rotate,0deg)) scale(1.13);
            border-color: #c6a0b8; box-shadow: 0 14px 26px rgba(126,93,113,.24);
            position: relative; z-index: 2;
          }
        }
        .pawcream-public-wall-tile.is-selected {
          border-color: #be9db6; box-shadow: 0 7px 20px rgba(126,93,113,.18);
        }
        .pawcream-public-wall-tile img { width: 100%; height: 100%; display: block; object-fit: contain; }
        .pawcream-public-wall-grid.is-demo {
          display: block; columns: 5; column-gap: 10px;
        }
        .pawcream-public-wall-grid.is-demo .pawcream-public-wall-tile {
          display: block; width: 100%; height: auto; margin: 0 0 10px;
          break-inside: avoid; -webkit-column-break-inside: avoid;
        }
        .pawcream-public-wall-sample {
          box-sizing: border-box; width: 100%; height: 100%;
          background: var(--sample-paper, #f2e9ec); border: 5px solid #fffefa;
          border-bottom-width: 13px; box-shadow: inset 0 0 0 1px rgba(151,126,140,.1);
          border-radius: 2px; position: relative;
        }
        .pawcream-public-wall-sample > span {
          display: block; width: 57%; height: 57%; position: absolute; top: 21%; left: 21%;
          border: 1px solid rgba(156,133,145,.14); border-radius: 3px;
          background: rgba(255,255,255,.2);
        }
        .pawcream-public-wall-hero-stage {
          min-height: min(52vh, 490px); display: flex; align-items: center; justify-content: center;
          transition: transform 190ms ease-out;
        }
        .pawcream-public-wall-sample-hero {
          width: auto; height: auto; max-height: min(52vh, 490px);
          max-width: 100%; filter: drop-shadow(0 16px 22px rgba(86,63,77,.18));
        }
        .pawcream-public-wall-sample-detail {
          height: auto; width: auto; max-width: 100%; max-height: 65dvh;
          margin: auto; box-shadow: 0 12px 35px rgba(64,48,61,.12);
        }
        .pawcream-public-wall-mobile-backdrop {
          position: fixed; inset: 0; z-index: 181; background: rgba(55,43,56,.27);
          backdrop-filter: blur(4px);
        }
        .pawcream-public-wall-mobile-sheet {
          position: fixed; bottom: 0; left: 0; right: 0; z-index: 182;
          display: flex; flex-direction: column; align-items: center; gap: 11px;
          padding: 14px 20px max(22px,env(safe-area-inset-bottom));
          border-radius: 25px 25px 0 0; background: #fffafc;
          box-shadow: 0 -15px 50px rgba(73,49,67,.18);
          animation: pawcream-wall-sheet-enter 250ms cubic-bezier(.16,1,.3,1);
          touch-action: pan-y;
        }
        .pawcream-public-wall-mobile-sheet .pawcream-public-wall-sample-detail {
          max-height: 45dvh; width: auto; max-width: 90%;
        }
        .pawcream-public-wall-mobile-sheet img {
          display: block; max-height: 45dvh; max-width: 90%; object-fit: contain;
        }
        .pawcream-public-wall-sheet-actions {
          display: flex; gap: 10px; align-items: center; justify-content: center; flex-wrap: wrap;
        }
        @keyframes pawcream-wall-sheet-enter {
          from { opacity: .6; transform: translateY(30px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .pawcream-public-wall-detail {
          position: fixed; inset: 0; z-index: 183; display: grid; place-items: center;
          padding: 20px; background: rgba(45,35,46,.73);
        }
        .pawcream-public-wall-detail-inner {
          max-width: min(680px,100%); max-height: 90dvh; display: grid; gap: 12px;
          padding: 20px; border-radius: 24px; background: #fffafc;
        }
        .pawcream-public-wall-detail-inner img { max-width: 100%; max-height: 70dvh; object-fit: contain; margin: auto; }
        @media (max-width:700px) {
          .pawcream-public-wall-overlay { padding: 6px; }
          .pawcream-public-wall { max-height: calc(100dvh - 12px); border-radius: 22px; padding: 17px; }
          .pawcream-public-wall-layout { display: block; }
          .pawcream-public-wall-hero { display: none; }
          .pawcream-public-wall-grid { grid-template-columns: repeat(2,minmax(0,1fr)); gap: 11px; }
          .pawcream-public-wall-grid.is-demo { columns: 2; column-gap: 11px; }
        }
        .pawcream-public-wall.is-mobile .pawcream-public-wall-layout { display: block; }
        .pawcream-public-wall.is-mobile .pawcream-public-wall-hero { display: none; }
        .pawcream-public-wall.is-mobile .pawcream-public-wall-grid {
          grid-template-columns: repeat(2,minmax(0,1fr)); gap: 11px;
        }
        .pawcream-public-wall.is-mobile .pawcream-public-wall-grid.is-demo {
          columns: 2; column-gap: 11px;
        }
        @media (prefers-reduced-motion:reduce) {
          .pawcream-public-wall *, .pawcream-public-wall-mobile-sheet {
            transition: none !important; animation: none !important;
          }
        }
      `}</style>
      <section className={`pawcream-public-wall${mobile ? ' is-mobile' : ''}`} role="dialog" aria-modal="true" aria-label="PawCream 公共返图墙">
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 12, marginBottom: 22 }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 650, letterSpacing: '.09em' }}>our little gallery ♡</div>
            <div style={{ fontSize: 13, marginTop: 5 }}>公共返图墙 · 分享每一张温柔瞬间</div>
            <div style={{ fontSize: 12, marginTop: 5, opacity: .72 }}>
              {mobile ? '轻点相纸预览，左右滑动切换' : '将鼠标移近相纸，感受磁吸和弹性回弹'}
            </div>
            <div style={{ fontSize: 12, marginTop: 6, opacity: .65 }}>
              {demoMode ? `交互演示 · ${displayedTotal} 张虚拟空白相纸（非真实返图）` : `${displayedTotal} 张公开返图`}
            </div>
          </div>
          <button type="button" className="pawcream-public-wall-close" onClick={onClose} aria-label="关闭公共返图墙">× 关闭</button>
        </header>
        <>

            {error && <p role="alert" style={{ color: '#ad526d' }}>{error}</p>}
            {!displayedPhotos.length && !loading && !error && <p>这里还没有公开返图。可以先在自己的铁盒中选择一张照片公开 ♡</p>}
            {displayedPhotos.length > 0 && (
              <div className="pawcream-public-wall-layout">
                <aside className="pawcream-public-wall-hero">
                  {selected && (
                    <>
                      <div className="pawcream-public-wall-hero-stage"
                        style={{ transform: `translate3d(${drift.x}px,${drift.y}px,0) rotate(${drift.x * .12}deg)` }}>
                        {artwork(selected, 'hero')}
                      </div>
                      <div style={{ textAlign: 'center', fontSize: 13, marginTop: 8 }}>
                        {demoMode ? `Sample ${selected.id.replace('sample-', '')} · ${selected.ratio?.replace(' / ', ':')}` : `@${selected.authorName} · ${selected.frameName}`}
                      </div>
                      <p style={{ textAlign: 'center', fontSize: 12, opacity: .6 }}>悬停浏览 · 点击查看完整返图</p>
                    </>
                  )}
                </aside>
                <div>
                  <div className={`pawcream-public-wall-grid${demoMode ? " is-demo" : ""}`}>
                    {displayedPhotos.map((photo) => (
                      <button key={photo.id} type="button"
                        className={`pawcream-public-wall-tile${mobilePreviewId === photo.id ? ' is-selected' : ''}`}
                        style={demoMode ? { aspectRatio: photo.ratio } : undefined}
                        title={demoMode ? `空白相纸 ${photo.ratio?.replace(' / ', ':')}` : `${photo.authorName} · ${photo.frameName}`}
                        aria-label={demoMode ? '查看空白相纸演示' : `查看 ${photo.authorName} 的返图`}
                        onPointerEnter={(event) => hover(photo, event)}
                        onPointerMove={(event) => hover(photo, event)}
                        onPointerLeave={releaseMagnet}
                        onFocus={() => setFocused(photo.id)}
                        onClick={() => mobile ? setMobilePreviewId(photo.id) : setDetail(photo.id)}>
                        {artwork(photo, 'tile')}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {!demoMode && photos.length < total && (
              <div style={{ textAlign: 'center', marginTop: 22 }}>
                <button type="button" disabled={loading} className="pawcream-public-wall-close"
                  onClick={() => void load(photos.length)}>{loading ? '加载中…' : '再看一些 ♡'}</button>
              </div>
            )}
            {loading && !photos.length && <p role="status">正在收集大家的返图…</p>}
        </>
      </section>
      {mobile && mobilePreviewPhoto && !detailPhoto && (
        <>
          <div className="pawcream-public-wall-mobile-backdrop" role="presentation"
            onClick={() => setMobilePreviewId(null)} />
          <section className="pawcream-public-wall-mobile-sheet"
            role="dialog" aria-modal="true" aria-label="返图快速预览"
            onTouchStart={(event) => { touchStartX.current = event.touches[0].clientX }}
            onTouchEnd={endPreviewSwipe}
            onTouchCancel={() => { touchStartX.current = null }}>
            <div aria-hidden="true" style={{ width: 38, height: 4, borderRadius: 999, background: '#dcccd9' }} />
            {artwork(mobilePreviewPhoto, 'detail')}
            <div style={{ fontSize: 13, color: '#967b90', textAlign: 'center' }}>
              {demoMode
                ? `Sample ${mobilePreviewPhoto.id.replace('sample-', '')} · ${mobilePreviewPhoto.ratio?.replace(' / ', ':')}`
                : `@${mobilePreviewPhoto.authorName} · ${mobilePreviewPhoto.frameName}`}
            </div>
            <div style={{ fontSize: 12, opacity: .65 }}>左右滑动切换相纸</div>
            <div className="pawcream-public-wall-sheet-actions">
              <button type="button" className="pawcream-public-wall-close"
                onClick={() => stepMobilePreview(-1)} aria-label="上一张相纸">‹</button>
              <button type="button" className="pawcream-public-wall-close"
                onClick={() => { setDetail(mobilePreviewPhoto.id); setMobilePreviewId(null) }}>查看大图</button>
              <button type="button" className="pawcream-public-wall-close"
                onClick={() => stepMobilePreview(1)} aria-label="下一张相纸">›</button>
              <button type="button" className="pawcream-public-wall-close"
                onClick={() => setMobilePreviewId(null)}>收起</button>
            </div>
          </section>
        </>
      )}
      {detailPhoto && (
        <div className="pawcream-public-wall-detail" role="presentation" onClick={() => setDetail(null)}>
          <div className="pawcream-public-wall-detail-inner" role="dialog" aria-modal="true"
            aria-label="返图详情" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="pawcream-public-wall-close"
              onClick={() => setDetail(null)} style={{ justifySelf: 'end' }}>关闭 ×</button>
            {artwork(detailPhoto, 'detail')}
            <div style={{ textAlign: 'center', color: '#92778c', fontSize: 13 }}>
              {demoMode ? `演示空白相纸 · ${detailPhoto.ratio?.replace(' / ', ':')}` : `@${detailPhoto.authorName} · ${detailPhoto.frameName} · ${new Date(detailPhoto.createdAt).toLocaleDateString('zh-CN')}`}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
