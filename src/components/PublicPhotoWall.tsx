import { useEffect, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type TouchEvent as ReactTouchEvent } from 'react'
import {
  isPawCreamApiEnabled,
  listPublicPhotos,
  publicPhotoImageUrl,
  type PawCreamPublicPhoto,
} from '../pawcreamApi'

type Props = { mobile: boolean; onClose: () => void }
const PAGE_SIZE = 24

// Bundled buyer-return photos for the offline mini-tool.
type DisplayPhoto = PawCreamPublicPhoto & { localSrc?: string }
const RETURN_PHOTO_FILES = [
  '0f8351c6eeeac02e8ef16fe839076192.jpg',
  '140f90a4ac9947706d9aaea85cfb54ad.jpg',
  '1b45c61d81024c61585f4482efd5eadb.jpg',
  '21eba6feae6d63e506646c26af832cca.jpg',
  '28f4dc20d57d7393a9d1971c86f43e7f.jpg',
  '2cc1223122e04d9cbcdef3ea24ffaee8.jpg',
  '2e0284be387934df8f30a4bda73e3d6b.jpg',
  '2eed847cac88ba92a64738fdcef693b9.jpg',
  '33cdf90413cb951a00a9c89878145160.jpg',
  '3d253413de887621c183df93bb6bdeac.jpg',
  '3fbc9cc690ae6fc499012bf111d99ca9.jpg',
  '4caba4f1404bc7299b69ab1606680a66.jpg',
  '4fabc128cac96f6ef39b8db970c6a789.jpg',
  '5018c1efc5679dbf0492ef923483aac9.jpg',
  '5542212a304236319dfc4cb8c7234a00.jpg',
  '59c720be29aab7fddf2f457b9146ce80.jpg',
  '5d9e98157d385c178ef947492719f8f0.jpg',
  '6698ff521e8fa2af3833f967d1e88c7b.jpg',
  '743e004c87f582548fb939c947c05000.jpg',
  '76eb5d03f76304b3729518038b1974b0.jpg',
  '77dc08aa06862eabd32dfba7a2aa2c73.jpg',
  '792ec9f1de371853d1f8711a60511be6.jpg',
  '83d66baa1f607b0c7a9e093d9d27d402.jpg',
  '88b1e44265d659c390bd1e23442a04a0.jpg',
  '90da14fb66d4604d1413cb09a017d85c.jpg',
  '91a92d1912d69bc1493f771833ccb7f0.jpg',
  '96c8d31b6483dc06abaf1d2d944bacb2.jpg',
  'a1e72167678464c24dbf52be695b7dcb.jpg',
  'a2fff4824b0555321abcfa53204ecbdd.jpg',
  'a99a32d2c63e9157c4ae5b07c152ee62.jpg',
  'ae74e949f0d9c8c06b084beceefd83aa.jpg',
  'b2a99ed730e5d90082b5c87580312ea6.jpg',
  'bf547e0963239d8ae2d9db1b704eb185.jpg',
  'c28671766321134089a55b67f3c814de.jpg',
  'd5890ef40c9e6cdf3390c4cccecbd2a6.jpg',
  'dd43ae972a05025e885311a96ed34978.jpg',
  'e15835259feda9bae05d8eb838f473ae.jpg',
  'fa12ee52ded64e1b44426c8067c8a962.jpg',
  'fa977a8bebd47d3beff298451a457dfa.jpg',
  'ff8b5248845e636c38dd9721a71c3e2d.jpg',
]
const BUNDLED_RETURN_PHOTOS: DisplayPhoto[] = RETURN_PHOTO_FILES.map((filename, index) => ({
  id: `return-${index + 1}`,
  authorName: 'PawCream',
  frameName: '精选返图',
  createdAt: '2026-10-23T00:00:00Z',
  localSrc: `${import.meta.env.BASE_URL}assets/return_photo/${filename}`,
}))

export default function PublicPhotoWall({ mobile, onClose }: Props) {
  // The offline mini-tool shows bundled return photos without making network requests.
  // The URL flag forces this local gallery for safe previews on API-enabled sites.
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

  const displayedPhotos: DisplayPhoto[] = demoMode ? BUNDLED_RETURN_PHOTOS : photos
  const displayedTotal = demoMode ? BUNDLED_RETURN_PHOTOS.length : total
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

  const artwork = (photo: DisplayPhoto, size: 'tile' | 'hero' | 'detail') => (
    <img
      className={size === 'hero' ? 'pawcream-public-wall-hero-image' : undefined}
      src={demoMode ? photo.localSrc : publicPhotoImageUrl(photo.id)}
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
  }

  const releaseMagnet = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const tile = event.currentTarget
    tile.dataset.magnetX = '0'
    tile.dataset.magnetY = '0'
    tile.style.setProperty('--magnet-x', '0px')
    tile.style.setProperty('--magnet-y', '0px')
    tile.style.setProperty('--magnet-rotate', '0deg')
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
          transition: opacity 180ms ease-out;
        }
        .pawcream-public-wall-grid { display: block; columns: 5; column-gap: 10px; }
        .pawcream-public-wall-tile {
          border: 1px solid rgba(194,170,181,.36); border-radius: 10px; overflow: hidden;
          display: block; width: 100%; height: auto; margin-bottom: 10px;
          break-inside: avoid; -webkit-column-break-inside: avoid;
          padding: 0; background: #fff; aspect-ratio: auto;
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
        .pawcream-public-wall-tile img { width: 100%; height: auto; display: block; object-fit: contain; }
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
          /* Left hero stays fixed while the right grid reacts magnetically. */
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
          .pawcream-public-wall-grid { columns: 2; column-gap: 11px; }
          .pawcream-public-wall-grid.is-demo { columns: 2; column-gap: 11px; }
        }
        .pawcream-public-wall.is-mobile .pawcream-public-wall-layout { display: block; }
        .pawcream-public-wall.is-mobile .pawcream-public-wall-hero { display: none; }
        .pawcream-public-wall.is-mobile .pawcream-public-wall-grid {
          columns: 2; column-gap: 11px;
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
              {mobile ? '轻点照片预览，左右滑动切换' : '将鼠标移近照片，感受磁吸和弹性回弹'}
            </div>
            <div style={{ fontSize: 12, marginTop: 6, opacity: .65 }}>
              {demoMode ? `离线返图展示 · ${displayedTotal} 张实拍返图` : `${displayedTotal} 张公开返图`}
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
                      <div className="pawcream-public-wall-hero-stage">
                        {artwork(selected, 'hero')}
                      </div>
                      <div style={{ textAlign: 'center', fontSize: 13, marginTop: 8 }}>
                        {demoMode ? `精选返图 ${selected.id.replace('return-', '')} / ${displayedTotal}` : `@${selected.authorName} · ${selected.frameName}`}
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
                        title={demoMode ? `精选返图 ${photo.id.replace('return-', '')}` : `${photo.authorName} · ${photo.frameName}`}
                        aria-label={demoMode ? '查看精选返图' : `查看 ${photo.authorName} 的返图`}
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
                ? `精选返图 ${mobilePreviewPhoto.id.replace('return-', '')} / ${displayedTotal}`
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
              {demoMode ? `精选返图 ${detailPhoto.id.replace('return-', '')} / ${displayedTotal}` : `@${detailPhoto.authorName} · ${detailPhoto.frameName} · ${new Date(detailPhoto.createdAt).toLocaleDateString('zh-CN')}`}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
