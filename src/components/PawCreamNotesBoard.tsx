import { useEffect, useState } from 'react'
import {
  AUTH_CHANGED_EVENT,
  createNote,
  deleteNote,
  getCurrentUser,
  getNotes,
  getPublicNotesBatch,
  isPawCreamApiEnabled,
  openPawCreamSignin,
  resetPawCreamPreviewNotes,
  setPawCreamPreviewSignedIn,
  toggleNoteLike,
  updateNote,
  type PawCreamNote,
  type PawCreamPublicNoteOrder,
  type PawCreamUser,
} from '../pawcreamApi'
import PawCreamMyNotes from './PawCreamMyNotes'
import PawCreamNoteComposer from './PawCreamNoteComposer'
import PawCreamNoteWall from './PawCreamNoteWall'

type Language = 'zh' | 'en'

type Props = {
  open: boolean
  onClose: () => void
  mobile: boolean
  language: Language
}

type Scope = 'all' | 'mine'

function makeRandomSeed() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
}

export default function PawCreamNotesBoard({ open, onClose, mobile, language }: Props) {
  const [viewer, setViewer] = useState<PawCreamUser | null>(null)
  const [scope, setScope] = useState<Scope>('all')
  const [notes, setNotes] = useState<PawCreamNote[]>([])
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [composerOpen, setComposerOpen] = useState(false)
  const [publicOrder, setPublicOrder] = useState<PawCreamPublicNoteOrder>('recent')
  const [batchOffset, setBatchOffset] = useState(0)
  const [randomSeed, setRandomSeed] = useState(makeRandomSeed)
  const [totalNotes, setTotalNotes] = useState(0)
  const [refreshTick, setRefreshTick] = useState(0)

  const apiEnabled = isPawCreamApiEnabled()
  const pageSize = mobile ? 6 : 12
  const englishBoost = language === 'en' ? 10 : 0
  const uiSize = (size: number) => size + englishBoost
  const copy = language === 'zh'
    ? {
        title: 'PawCream 公共便签墙',
        subtitle: '大家留下的便签都会在这里相遇。',
        preview: 'GitHub Pages 预览模式 · 可以切换模拟登录状态，完整测试写便签、我的便签、编辑、删除和点赞。',
        guestPreview: '游客预览',
        signedPreview: '已登录预览',
        resetPreview: '重置预览数据',
        previewUser: '预览用户',
        all: '全部便签',
        mine: '我的便签',
        recent: '最近留下的',
        random: '随便看看 ♡',
        next: '下一批',
        shuffle: '换一批 ♡',
        write: '写一张便签',
        loginLead: '所有人都可以看便签，登录 PawCream 后可以留言、点赞和管理自己的便签。',
        login: '登入',
        register: '注册',
        loading: '正在整理便签…',
        deleteConfirm: '确定要删除这张便签吗？',
        close: '关闭留言板',
        previewNeedLogin: '当前是游客预览。请切换到「已登录预览」查看登录后的便签逻辑。',
      }
    : {
        title: 'PawCream Public Notes',
        subtitle: 'Little notes from everyone meet here.',
        preview: 'GitHub Pages preview · switch the mock account state to test writing, My notes, edit, delete, and likes.',
        guestPreview: 'Guest preview',
        signedPreview: 'Signed-in preview',
        resetPreview: 'Reset preview data',
        previewUser: 'Preview user',
        all: 'All notes',
        mine: 'My notes',
        recent: 'Recently left',
        random: 'Wander around ♡',
        next: 'Next batch',
        shuffle: 'Another batch ♡',
        write: 'Write a note',
        loginLead: 'Everyone can read notes. Sign in to post, like, and manage your own notes.',
        login: 'Sign in',
        register: 'Register',
        loading: 'Gathering notes…',
        deleteConfirm: 'Delete this note?',
        close: 'Close notes',
        previewNeedLogin: 'You are in guest preview. Switch to Signed-in preview to inspect the signed-in note flow.',
      }

  useEffect(() => {
    if (!open) {
      setComposerOpen(false)
      return
    }

    let cancelled = false

    const load = async () => {
      setLoading(true)
      setStatus('')
      try {
        const [nextViewer, result] = await Promise.all([
          getCurrentUser(),
          scope === 'all'
            ? getPublicNotesBatch({
                order: publicOrder,
                limit: pageSize,
                offset: batchOffset,
                seed: randomSeed,
              })
            : getNotes('mine').then((mineNotes) => ({ notes: mineNotes, total: mineNotes.length })),
        ])

        if (cancelled) return
        setViewer(nextViewer)
        setNotes(result.notes)
        setTotalNotes(result.total)
      } catch (error) {
        if (cancelled) return
        setStatus(error instanceof Error ? error.message : 'PawCream notes unavailable')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [open, scope, publicOrder, batchOffset, randomSeed, pageSize, refreshTick])

  useEffect(() => {
    const onAuthChanged = () => {
      if (!open) return
      setRefreshTick((value) => value + 1)
    }
    window.addEventListener(AUTH_CHANGED_EVENT, onAuthChanged)
    return () => window.removeEventListener(AUTH_CHANGED_EVENT, onAuthChanged)
  }, [open])

  useEffect(() => {
    setBatchOffset(0)
  }, [mobile])

  if (!open) return null

  const askSignin = (mode: 'login' | 'register') => {
    window.setTimeout(() => openPawCreamSignin(mode), 0)
  }

  const selectScope = (nextScope: Scope) => {
    setComposerOpen(false)
    setStatus('')
    if (nextScope === 'mine' && !viewer) {
      if (apiEnabled) askSignin('login')
      else setStatus(copy.previewNeedLogin)
      return
    }
    setBatchOffset(0)
    setScope(nextScope)
  }

  const selectPublicOrder = (nextOrder: PawCreamPublicNoteOrder) => {
    setComposerOpen(false)
    setStatus('')
    setBatchOffset(0)
    if (nextOrder === 'random' && publicOrder !== 'random') {
      setRandomSeed(makeRandomSeed())
    }
    setPublicOrder(nextOrder)
  }

  const nextBatch = () => {
    if (totalNotes <= pageSize) return

    const reachesEnd = batchOffset + pageSize >= totalNotes
    if (publicOrder === 'random' && reachesEnd) {
      setRandomSeed(makeRandomSeed())
      setBatchOffset(0)
      return
    }

    if (!reachesEnd) {
      setBatchOffset((value) => value + pageSize)
    }
  }

  const switchPreviewUser = (signedIn: boolean) => {
    if (apiEnabled) return
    setComposerOpen(false)
    setStatus('')
    setBatchOffset(0)
    if (!signedIn && scope === 'mine') setScope('all')
    setPawCreamPreviewSignedIn(signedIn)
  }

  const resetPreview = () => {
    if (apiEnabled) return
    setComposerOpen(false)
    setBatchOffset(0)
    setRandomSeed(makeRandomSeed())
    resetPawCreamPreviewNotes()
  }

  const startWrite = () => {
    setStatus('')
    if (!viewer) {
      if (apiEnabled) askSignin('login')
      else setStatus(copy.previewNeedLogin)
      return
    }
    setComposerOpen(true)
  }

  const publish = async (text: string) => {
    await createNote(text)
    setComposerOpen(false)
    setScope('all')
    setPublicOrder('recent')
    setBatchOffset(0)
    setRefreshTick((value) => value + 1)
  }

  const like = async (note: PawCreamNote) => {
    if (!viewer) {
      if (apiEnabled) askSignin('login')
      else setStatus(copy.previewNeedLogin)
      return
    }

    try {
      const result = await toggleNoteLike(note.id)
      setNotes((current) => current.map((item) => (
        item.id === note.id
          ? { ...item, likedByMe: result.liked, likesCount: result.likesCount }
          : item
      )))
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to like note')
    }
  }

  const saveMine = async (id: string, text: string) => {
    try {
      await updateNote(id, text)
      setRefreshTick((value) => value + 1)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to update note')
      throw error
    }
  }

  const removeMine = async (note: PawCreamNote) => {
    if (!window.confirm(copy.deleteConfirm)) return
    try {
      await deleteNote(note.id)
      setRefreshTick((value) => value + 1)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to delete note')
    }
  }

  const pill = (active: boolean) => ({
    minHeight: language === 'en' ? 42 : 32,
    border: '1px solid rgba(202,145,166,.22)',
    borderRadius: 999,
    padding: language === 'en' ? '0 16px' : '0 13px',
    background: active ? 'rgba(246,226,234,.95)' : 'rgba(255,255,255,.72)',
    color: active ? '#8f6173' : '#9a7b86',
    cursor: 'pointer',
    fontSize: uiSize(13),
  } as const)

  const previewPill = (active: boolean) => ({
    minHeight: language === 'en' ? 38 : 29,
    border: '1px solid rgba(149,181,201,.24)',
    borderRadius: 999,
    padding: language === 'en' ? '0 14px' : '0 11px',
    background: active ? 'rgba(218,235,245,.92)' : 'rgba(255,255,255,.68)',
    color: active ? '#66879b' : '#8199a7',
    cursor: 'pointer',
    fontSize: uiSize(11),
  } as const)

  const currentStart = totalNotes === 0 ? 0 : batchOffset + 1
  const currentEnd = Math.min(batchOffset + notes.length, totalNotes)
  const canAdvanceRecent = publicOrder === 'recent' && batchOffset + pageSize < totalNotes
  const canShuffle = publicOrder === 'random' && totalNotes > pageSize

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={copy.title}
      onClick={(event) => event.stopPropagation()}
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 80,
        display: 'grid',
        placeItems: 'center',
        padding: mobile ? 12 : 28,
        background: 'rgba(255,249,251,.64)',
        backdropFilter: 'blur(13px)',
        WebkitBackdropFilter: 'blur(13px)',
        fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <style>{`
        .pawcream-notes-card {
          transition: opacity 180ms ease, transform 180ms ease, visibility 180ms step-end;
        }
        html.pawcream-signin-open .pawcream-notes-card {
          opacity: 0 !important;
          visibility: hidden !important;
          pointer-events: none !important;
          transform: scale(.985);
        }
      `}</style>

      <section
        className="pawcream-notes-card"
        style={{
          width: mobile ? '100%' : 'min(760px, 100%)',
          maxHeight: mobile ? 'calc(100% - 12px)' : 'min(760px, calc(100% - 30px))',
          overflow: 'auto',
          boxSizing: 'border-box',
          padding: mobile ? 17 : 24,
          border: '1px solid rgba(205,148,168,.23)',
          borderRadius: mobile ? 23 : 30,
          background: 'rgba(255,253,253,.965)',
          boxShadow: '0 24px 70px rgba(101,74,84,.17)',
          color: '#765d66',
        }}
      >
        <header style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'flex-start' }}>
          <div>
            <strong style={{ display: 'block', fontSize: uiSize(mobile ? 22 : 28), letterSpacing: '.015em' }}>{copy.title}</strong>
            <p style={{ margin: '6px 0 0', fontSize: uiSize(mobile ? 13 : 14), lineHeight: 1.55, color: '#9d818a' }}>{copy.subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={copy.close}
            style={{ width: 34, height: 34, flex: '0 0 auto', border: '1px solid rgba(198,133,157,.2)', borderRadius: '50%', background: '#fff', color: '#98737f', cursor: 'pointer', fontSize: 20 }}
          >
            ×
          </button>
        </header>

        {!apiEnabled && (
          <section style={{ marginTop: 13, padding: '10px 11px', borderRadius: 14, background: 'rgba(233,243,249,.78)', color: '#7891a1' }}>
            <div style={{ fontSize: uiSize(mobile ? 11.5 : 12.5), lineHeight: 1.5 }}>{copy.preview}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7, marginTop: 9 }}>
              <button type="button" onClick={() => switchPreviewUser(false)} style={previewPill(!viewer)}>{copy.guestPreview}</button>
              <button type="button" onClick={() => switchPreviewUser(true)} style={previewPill(Boolean(viewer))}>{copy.signedPreview}</button>
              <button type="button" onClick={resetPreview} style={previewPill(false)}>{copy.resetPreview}</button>
            </div>
          </section>
        )}

        <div style={{ display: 'flex', gap: 7, marginTop: 14 }}>
          <button type="button" onClick={() => selectScope('all')} style={pill(scope === 'all')}>{copy.all}</button>
          <button type="button" onClick={() => selectScope('mine')} style={pill(scope === 'mine')}>{copy.mine}</button>
        </div>

        {scope === 'all' && (
          <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 9, alignItems: 'center', marginTop: 10 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
              <button type="button" onClick={() => selectPublicOrder('recent')} style={previewPill(publicOrder === 'recent')}>{copy.recent}</button>
              <button type="button" onClick={() => selectPublicOrder('random')} style={previewPill(publicOrder === 'random')}>{copy.random}</button>
            </div>
            {!loading && totalNotes > 0 && (
              <span style={{ color: '#b097a0', fontSize: uiSize(mobile ? 9.5 : 10.5) }}>
                {currentStart}–{currentEnd} / {totalNotes}
              </span>
            )}
          </div>
        )}

        {viewer ? (
          <section style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center', marginTop: 15, padding: '11px 13px', borderRadius: 17, background: 'rgba(251,241,245,.58)', border: '1px solid rgba(209,156,176,.13)' }}>
            <div style={{ minWidth: 0 }}>
              <strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#8e6c79', fontSize: uiSize(mobile ? 11.5 : 12.5) }}>{viewer.displayName}</strong>
              {!apiEnabled && <span style={{ display: 'block', marginTop: 3, color: '#aa8e99', fontSize: uiSize(mobile ? 9.5 : 10.5) }}>{copy.previewUser}</span>}
            </div>
            <button type="button" onClick={startWrite} style={pill(true)}>{copy.write}</button>
          </section>
        ) : (
          <section style={{ marginTop: 15, padding: '13px 14px', borderRadius: 18, background: 'rgba(251,241,245,.62)', border: '1px solid rgba(209,156,176,.14)' }}>
            <p style={{ margin: 0, fontSize: uiSize(mobile ? 12.5 : 13.5), lineHeight: 1.65, color: '#967884' }}>{copy.loginLead}</p>
            <div style={{ display: 'flex', gap: 7, marginTop: 10 }}>
              <button type="button" onClick={() => askSignin('login')} style={pill(true)}>{copy.login}</button>
              <button type="button" onClick={() => askSignin('register')} style={pill(false)}>{copy.register}</button>
            </div>
          </section>
        )}

        {status && (
          <div role="status" style={{ marginTop: 10, padding: '8px 10px', borderRadius: 12, background: 'rgba(235,244,249,.72)', color: '#768e9d', fontSize: uiSize(mobile ? 11.5 : 12.5), lineHeight: 1.5 }}>
            {status}
          </div>
        )}

        {composerOpen && viewer && (
          <PawCreamNoteComposer
            mobile={mobile}
            language={language}
            viewerName={viewer.displayName}
            onPublish={publish}
            onCancel={() => setComposerOpen(false)}
          />
        )}

        {loading ? (
          <p style={{ margin: '20px 0 4px', textAlign: 'center', color: '#ae929c', fontSize: uiSize(mobile ? 11.5 : 12.5) }}>{copy.loading}</p>
        ) : scope === 'all' ? (
          <>
            <PawCreamNoteWall
              notes={notes}
              mobile={mobile}
              language={language}
              onLike={like}
            />

            {(canAdvanceRecent || canShuffle) && (
              <div style={{ display: 'flex', justifyContent: 'center', marginTop: mobile ? 12 : 16, paddingBottom: 2 }}>
                <button
                  type="button"
                  onClick={nextBatch}
                  style={{
                    minHeight: language === 'en' ? 44 : 35,
                    border: '1px solid rgba(202,145,166,.24)',
                    borderRadius: 999,
                    padding: language === 'en' ? '0 19px' : '0 17px',
                    background: 'rgba(250,235,241,.88)',
                    color: '#936a7a',
                    boxShadow: '0 5px 14px rgba(130,92,106,.07)',
                    cursor: 'pointer',
                    fontSize: uiSize(mobile ? 12 : 13),
                  }}
                >
                  {publicOrder === 'random' ? copy.shuffle : copy.next}
                </button>
              </div>
            )}
          </>
        ) : (
          <PawCreamMyNotes
            notes={notes}
            mobile={mobile}
            language={language}
            onWrite={startWrite}
            onSave={saveMine}
            onDelete={removeMine}
          />
        )}
      </section>
    </div>
  )
}
