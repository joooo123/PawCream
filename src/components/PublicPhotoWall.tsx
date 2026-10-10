import { useEffect, useState, type PointerEvent as ReactPointerEvent } from 'react'
import {
  isPawCreamApiEnabled,
  listPublicPhotos,
  publicPhotoImageUrl,
  type PawCreamPublicPhoto,
} from '../pawcreamApi'

type Props = { mobile: boolean; onClose: () => void }
const PAGE_SIZE = 24

export default function PublicPhotoWall({ mobile, onClose }: Props) {
  const [photos, setPhotos] = useState<PawCreamPublicPhoto[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [focused, setFocused] = useState<string | null>(null)
  const [detail, setDetail] = useState<string | null>(null)
  const [drift, setDrift] = useState({ x: 0, y: 0 })

  const load = async (offset: number) => {
    if (loading || !isPawCreamApiEnabled()) return
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
    if (isPawCreamApiEnabled()) void load(0)
  // First page is requested only when the wall opens.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (detail) setDetail(null)
      else onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [detail, onClose])

  const selected = photos.find((photo) => photo.id === focused) ?? photos[0]
  const detailPhoto = photos.find((photo) => photo.id === detail)

  const hover = (photo: PawCreamPublicPhoto, event: ReactPointerEvent<HTMLButtonElement>) => {
    if (mobile || event.pointerType !== 'mouse') return
    setFocused(photo.id)
    const rect = event.currentTarget.getBoundingClientRect()
    setDrift({
      x: Math.max(-12, Math.min(12, (event.clientX - rect.left - rect.width / 2) * .18)),
      y: Math.max(-12, Math.min(12, (event.clientY - rect.top - rect.height / 2) * .18)),
    })
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
          transition: transform 180ms ease-out, box-shadow 180ms ease-out, border-color 180ms;
        }
        .pawcream-public-wall-tile:hover,.pawcream-public-wall-tile:focus-visible {
          transform: scale(1.07); border-color: #c6a0b8;
          box-shadow: 0 8px 18px rgba(126,93,113,.19); position: relative; z-index: 1;
        }
        .pawcream-public-wall-tile img { width: 100%; height: 100%; display: block; object-fit: contain; }
        .pawcream-public-wall-detail {
          position: fixed; inset: 0; z-index: 181; display: grid; place-items: center;
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
        }
        @media (prefers-reduced-motion:reduce) {
          .pawcream-public-wall * { transition: none !important; }
        }
      `}</style>
      <section className="pawcream-public-wall" role="dialog" aria-modal="true" aria-label="PawCream 公共返图墙">
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 12, marginBottom: 22 }}>
          <div>
            <div style={{ fontSize: 24, fontWeight: 650, letterSpacing: '.09em' }}>our little gallery ♡</div>
            <div style={{ fontSize: 13, marginTop: 5 }}>公共返图墙 · 分享每一张温柔瞬间</div>
            <div style={{ fontSize: 12, marginTop: 6, opacity: .65 }}>{total} 张公开返图</div>
          </div>
          <button type="button" className="pawcream-public-wall-close" onClick={onClose} aria-label="关闭公共返图墙">× 关闭</button>
        </header>
        {!isPawCreamApiEnabled() ? (
          <p role="status">此预览站尚未连接公共照片服务器。请在配置真实 API 的正式站点查看跨用户返图。</p>
        ) : (
          <>
            {error && <p role="alert" style={{ color: '#ad526d' }}>{error}</p>}
            {!photos.length && !loading && !error && <p>这里还没有公开返图。可以先在自己的铁盒中选择一张照片公开 ♡</p>}
            {photos.length > 0 && (
              <div className="pawcream-public-wall-layout">
                <aside className="pawcream-public-wall-hero">
                  {selected && (
                    <>
                      <img className="pawcream-public-wall-hero-image" src={publicPhotoImageUrl(selected.id)}
                        alt={selected.frameName}
                        style={{ transform: `translate3d(${drift.x}px,${drift.y}px,0) rotate(${drift.x * .12}deg)` }} />
                      <div style={{ textAlign: 'center', fontSize: 13, marginTop: 8 }}>
                        @{selected.authorName} · {selected.frameName}
                      </div>
                      <p style={{ textAlign: 'center', fontSize: 12, opacity: .6 }}>悬停浏览 · 点击查看完整返图</p>
                    </>
                  )}
                </aside>
                <div>
                  <div className="pawcream-public-wall-grid">
                    {photos.map((photo) => (
                      <button key={photo.id} type="button" className="pawcream-public-wall-tile"
                        title={`${photo.authorName} · ${photo.frameName}`}
                        aria-label={`查看 ${photo.authorName} 的返图`}
                        onPointerMove={(event) => hover(photo, event)}
                        onFocus={() => setFocused(photo.id)}
                        onClick={() => setDetail(photo.id)}>
                        <img src={publicPhotoImageUrl(photo.id)} alt="" loading="lazy" />
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
            {photos.length < total && (
              <div style={{ textAlign: 'center', marginTop: 22 }}>
                <button type="button" disabled={loading} className="pawcream-public-wall-close"
                  onClick={() => void load(photos.length)}>{loading ? '加载中…' : '再看一些 ♡'}</button>
              </div>
            )}
            {loading && !photos.length && <p role="status">正在收集大家的返图…</p>}
          </>
        )}
      </section>
      {detailPhoto && (
        <div className="pawcream-public-wall-detail" role="presentation" onClick={() => setDetail(null)}>
          <div className="pawcream-public-wall-detail-inner" role="dialog" aria-modal="true"
            aria-label="返图详情" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="pawcream-public-wall-close"
              onClick={() => setDetail(null)} style={{ justifySelf: 'end' }}>关闭 ×</button>
            <img src={publicPhotoImageUrl(detailPhoto.id)} alt={`${detailPhoto.authorName} 的返图`} />
            <div style={{ textAlign: 'center', color: '#92778c', fontSize: 13 }}>
              @{detailPhoto.authorName} · {detailPhoto.frameName} · {new Date(detailPhoto.createdAt).toLocaleDateString('zh-CN')}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
