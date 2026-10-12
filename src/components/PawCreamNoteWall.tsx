import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type TouchEvent as ReactTouchEvent,
} from 'react'
import type { PawCreamNote } from '../pawcreamApi'
import './pawcreamNoteWall.css'

type Language = 'zh' | 'en'

type Props = {
  notes: PawCreamNote[]
  mobile: boolean
  language: Language
  onLike: (note: PawCreamNote) => Promise<void>
}

const PAPER_COLORS = ['#fff5f8', '#fff9e8', '#f5fafc', '#f4f2fc', '#f4faef', '#fff5ed']
const TILTS = [-0.9, 0.6, -0.4, 0.85, -0.7, 0.4]

function displayDate(createdAt: string, language: Language) {
  return new Date(createdAt).toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function paperStyle(index: number): CSSProperties {
  return { '--note-paper': PAPER_COLORS[index % PAPER_COLORS.length],
    '--note-tilt': TILTS[index % TILTS.length] + 'deg' } as CSSProperties
}

function NotePaper({ note, index, language, full = false }: {
  note: PawCreamNote
  index: number
  language: Language
  full?: boolean
}) {
  return (
    <div className={'pawcream-note-paper' + (full ? ' is-full' : '')}
      style={paperStyle(index)}>
      <span className="pawcream-note-paper-pushpin" aria-hidden="true">✿</span>
      <p className="pawcream-note-paper-text">{note.text}</p>
      <div className="pawcream-note-paper-author">
        <span>♡ {note.authorName}</span>
        <time dateTime={note.createdAt}>{displayDate(note.createdAt, language)}</time>
      </div>
    </div>
  )
}

export default function PawCreamNoteWall({ notes, mobile, language, onLike }: Props) {
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [detailId, setDetailId] = useState<string | null>(null)
  const [drift, setDrift] = useState({ x: 0, y: 0 })
  const [likingIds, setLikingIds] = useState<string[]>([])
  const touchStart = useRef<{ x: number; y: number } | null>(null)

  const copy = language === 'zh'
    ? { empty: '这里还没有便签。', like: '喜欢', select: '选中便签',
        preview: '预览便签', detail: '查看完整便签', close: '关闭',
        tips: '悬停浏览 · 点击展开完整便签',
        swipe: '左右滑动查看其他便签', prev: '上一张', next: '下一张' }
    : { empty: 'No notes here yet.', like: 'Like', select: 'Select note',
        preview: 'Preview note', detail: 'Read full note', close: 'Close',
        tips: 'Hover to browse · Click to read the full note',
        swipe: 'Swipe left or right to browse notes', prev: 'Previous', next: 'Next' }

  const focused = notes.find(note => note.id === focusedId) ?? notes[0]
  const focusedIndex = notes.findIndex(note => note.id === focused?.id)
  const preview = notes.find(note => note.id === previewId) ?? null
  const previewIndex = notes.findIndex(note => note.id === preview?.id)
  const detail = notes.find(note => note.id === detailId) ?? null
  const detailIndex = notes.findIndex(note => note.id === detail?.id)

  useEffect(() => {
    if (!previewId && !detailId) return
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      if (detailId) setDetailId(null)
      else setPreviewId(null)
    }
    document.addEventListener('keydown', onEscape)
    return () => document.removeEventListener('keydown', onEscape)
  }, [previewId, detailId])

  const like = async (note: PawCreamNote) => {
    if (likingIds.includes(note.id)) return
    setLikingIds(current => [...current, note.id])
    try {
      await onLike(note)
    } finally {
      setLikingIds(current => current.filter(id => id !== note.id))
    }
  }

  const likeButton = (note: PawCreamNote, large = false) => (
    <button type="button" className={'pawcream-note-like' + (large ? ' is-large' : '')}
      aria-label={copy.like + ' ' + note.authorName}
      aria-pressed={note.likedByMe}
      disabled={likingIds.includes(note.id)}
      onClick={() => void like(note)}>
      <span aria-hidden="true">{note.likedByMe ? '♥' : '♡'}</span> {note.likesCount}
    </button>
  )

  const hover = (note: PawCreamNote, event: ReactPointerEvent<HTMLElement>) => {
    if (mobile || event.pointerType !== 'mouse') return
    setFocusedId(note.id)
    const tile = event.currentTarget
    const rect = tile.getBoundingClientRect()
    const oldX = Number(tile.dataset.magnetX || '0')
    const oldY = Number(tile.dataset.magnetY || '0')
    const rx = Math.max(-1, Math.min(1,
      (event.clientX - (rect.left + rect.width / 2 - oldX)) / (rect.width / 2)))
    const ry = Math.max(-1, Math.min(1,
      (event.clientY - (rect.top + rect.height / 2 - oldY)) / (rect.height / 2)))
    const x = Math.round(rx * 11)
    const y = Math.round(ry * 9)
    tile.dataset.magnetX = String(x)
    tile.dataset.magnetY = String(y)
    tile.style.setProperty('--magnet-x', x + 'px')
    tile.style.setProperty('--magnet-y', y + 'px')
    tile.style.setProperty('--magnet-rotate', (rx * 2.7) + 'deg')
    setDrift({ x: rx * 9, y: ry * 7 })
  }

  const releaseMagnet = (event: ReactPointerEvent<HTMLElement>) => {
    const tile = event.currentTarget
    tile.dataset.magnetX = '0'
    tile.dataset.magnetY = '0'
    tile.style.setProperty('--magnet-x', '0px')
    tile.style.setProperty('--magnet-y', '0px')
    tile.style.setProperty('--magnet-rotate', '0deg')
    setDrift({ x: 0, y: 0 })
  }

  const movePreview = (delta: number) => {
    if (!notes.length) return
    const current = Math.max(0, previewIndex)
    setPreviewId(notes[(current + delta + notes.length) % notes.length].id)
  }

  const finishSwipe = (event: ReactTouchEvent<HTMLElement>) => {
    const start = touchStart.current
    touchStart.current = null
    if (!start || !preview || notes.length < 2) return
    const dx = event.changedTouches[0].clientX - start.x
    const dy = event.changedTouches[0].clientY - start.y
    if (Math.abs(dx) > 45 && Math.abs(dx) > Math.abs(dy) * 1.2) {
      movePreview(dx < 0 ? 1 : -1)
    }
  }

  if (!notes.length) {
    return (
      <p className="pawcream-note-wall-empty">{copy.empty}</p>
    )
  }

  return (
    <div className={'pawcream-note-gallery' + (mobile ? ' is-mobile' : '')} aria-label={language === 'zh' ? '公共便签画廊' : 'Public note gallery'}>
      <div className="pawcream-note-gallery-layout">
        {!mobile && focused && (
          <aside className="pawcream-note-gallery-hero" aria-label={copy.preview}>
            <div className="pawcream-note-gallery-hero-stage"
              style={{ transform: 'translate3d(' + drift.x + 'px,' + drift.y + 'px,0)' }}>
              <NotePaper note={focused} index={Math.max(0, focusedIndex)} language={language} full />
            </div>
            <div className="pawcream-note-gallery-hero-footer">
              {likeButton(focused, true)}
              <button type="button" className="pawcream-note-gallery-pill"
                onClick={() => setDetailId(focused.id)}>{copy.detail}</button>
            </div>
            <p className="pawcream-note-gallery-tip">{copy.tips}</p>
          </aside>
        )}

        <div className="pawcream-note-gallery-grid" role="list">
          {notes.map((note, index) => (
            <article key={note.id} role="listitem"
              className={'pawcream-note-gallery-tile' + (focused?.id === note.id ? ' is-selected' : '')}
              style={paperStyle(index)}
              onPointerEnter={event => hover(note, event)}
              onPointerMove={event => hover(note, event)}
              onPointerLeave={releaseMagnet}>
              <button type="button" className="pawcream-note-gallery-tile-content"
                aria-label={copy.select + ' - ' + note.authorName}
                onFocus={() => setFocusedId(note.id)}
                onClick={() => mobile ? setPreviewId(note.id) : setDetailId(note.id)}>
                <NotePaper note={note} index={index} language={language} />
              </button>
              <div className="pawcream-note-gallery-tile-actions">
                {likeButton(note)}
                <button type="button" className="pawcream-note-gallery-read"
                  onClick={() => mobile ? setPreviewId(note.id) : setDetailId(note.id)}>
                  {copy.detail} ›
                </button>
              </div>
            </article>
          ))}
        </div>
      </div>

      {mobile && preview && !detail && (
        <div className="pawcream-note-gallery-mobile-overlay">
          <div className="pawcream-note-gallery-backdrop" role="presentation"
            onClick={() => setPreviewId(null)} />
          <section className="pawcream-note-gallery-sheet"
            role="dialog" aria-modal="true" aria-label={copy.preview}
            onTouchStart={event => {
              touchStart.current = { x: event.touches[0].clientX, y: event.touches[0].clientY }
            }}
            onTouchEnd={finishSwipe}
            onTouchCancel={() => { touchStart.current = null }}>
            <div className="pawcream-note-gallery-sheet-handle" aria-hidden="true" />
            <NotePaper note={preview} index={Math.max(0, previewIndex)} language={language} full />
            <div className="pawcream-note-gallery-sheet-actions">
              <button type="button" className="pawcream-note-gallery-pill"
                onClick={() => movePreview(-1)} aria-label={copy.prev}>‹</button>
              <span className="pawcream-note-gallery-counter">{previewIndex + 1} / {notes.length}</span>
              <button type="button" className="pawcream-note-gallery-pill"
                onClick={() => movePreview(1)} aria-label={copy.next}>›</button>
              {likeButton(preview)}
            </div>
            <p className="pawcream-note-gallery-tip">{copy.swipe}</p>
            <div className="pawcream-note-gallery-sheet-actions">
              <button type="button" className="pawcream-note-gallery-pill"
                onClick={() => setDetailId(preview.id)}>{copy.detail}</button>
              <button type="button" className="pawcream-note-gallery-pill"
                onClick={() => setPreviewId(null)}>{copy.close}</button>
            </div>
          </section>
        </div>
      )}

      {detail && (
        <div className="pawcream-note-gallery-detail-backdrop" role="presentation"
          onClick={() => { setDetailId(null); setPreviewId(null) }}>
          <section className="pawcream-note-gallery-detail" role="dialog"
            aria-modal="true" aria-label={copy.detail}
            onClick={event => event.stopPropagation()}>
            <button type="button" className="pawcream-note-gallery-pill pawcream-note-gallery-detail-close"
              onClick={() => { setDetailId(null); setPreviewId(null) }}>{copy.close} ×</button>
            <NotePaper note={detail} index={Math.max(0, detailIndex)} language={language} full />
            <div className="pawcream-note-gallery-detail-actions">{likeButton(detail, true)}</div>
          </section>
        </div>
      )}
    </div>
  )
}
