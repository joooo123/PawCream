import { useEffect, useState } from 'react'
import {
  AUTH_CHANGED_EVENT,
  createNote,
  deleteNote,
  getCurrentUser,
  getNotes,
  isPawCreamApiEnabled,
  openPawCreamSignin,
  toggleNoteLike,
  updateNote,
  type PawCreamNote,
  type PawCreamUser,
} from '../pawcreamApi'

type Language = 'zh' | 'en'

type Props = {
  open: boolean
  onClose: () => void
  mobile: boolean
  language: Language
}

type Scope = 'all' | 'mine'

const rotations = [-1.2, .7, -0.45, 1.1, -.8, .35]

export default function PawCreamNotesBoard({ open, onClose, mobile, language }: Props) {
  const [viewer, setViewer] = useState<PawCreamUser | null>(null)
  const [scope, setScope] = useState<Scope>('all')
  const [notes, setNotes] = useState<PawCreamNote[]>([])
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState('')

  const apiEnabled = isPawCreamApiEnabled()
  const copy = language === 'zh'
    ? {
        title: 'PawCream 公共便签墙',
        subtitle: '大家留下的便签都会在这里相遇。',
        preview: 'GitHub Pages 预览模式 · 现在展示的是示例公共便签',
        all: '全部便签',
        mine: '我的便签',
        write: '写一张便签',
        placeholder: '想在 PawCream 留下什么？',
        publish: '贴上便签',
        loginLead: '所有人都可以看便签，登录 PawCream 后可以留言、点赞和管理自己的便签。',
        login: '登入',
        register: '注册',
        empty: '这里还没有便签。',
        loading: '正在整理便签…',
        edit: '编辑',
        remove: '删除',
        save: '保存',
        cancel: '取消',
        deleteConfirm: '确定要删除这张便签吗？',
        close: '关闭留言板',
        heart: '喜欢',
      }
    : {
        title: 'PawCream Public Notes',
        subtitle: 'Little notes from everyone meet here.',
        preview: 'GitHub Pages preview · showing sample public notes',
        all: 'All notes',
        mine: 'My notes',
        write: 'Write a note',
        placeholder: 'What would you like to leave in PawCream?',
        publish: 'Post note',
        loginLead: 'Everyone can read notes. Sign in to post, like, and manage your own notes.',
        login: 'Sign in',
        register: 'Register',
        empty: 'No notes here yet.',
        loading: 'Gathering notes…',
        edit: 'Edit',
        remove: 'Delete',
        save: 'Save',
        cancel: 'Cancel',
        deleteConfirm: 'Delete this note?',
        close: 'Close notes',
        heart: 'Like',
      }

  const load = async (nextScope: Scope = scope) => {
    setLoading(true)
    setStatus('')
    try {
      const [nextViewer, nextNotes] = await Promise.all([
        getCurrentUser(),
        getNotes(nextScope),
      ])
      setViewer(nextViewer)
      setNotes(nextNotes)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'PawCream notes unavailable')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!open) return
    void load(scope)
  }, [open, scope])

  useEffect(() => {
    const onAuthChanged = () => {
      if (!open) return
      void load(scope)
    }
    window.addEventListener(AUTH_CHANGED_EVENT, onAuthChanged)
    return () => window.removeEventListener(AUTH_CHANGED_EVENT, onAuthChanged)
  }, [open, scope])

  if (!open) return null

  const askSignin = (mode: 'login' | 'register') => {
    onClose()
    window.setTimeout(() => openPawCreamSignin(mode), 0)
  }

  const selectScope = (nextScope: Scope) => {
    if (nextScope === 'mine' && !viewer) {
      askSignin('login')
      return
    }
    setEditingId(null)
    setScope(nextScope)
  }

  const publish = async () => {
    const text = draft.trim()
    if (!text) return
    if (!viewer) {
      askSignin('login')
      return
    }

    setStatus('')
    try {
      await createNote(text)
      setDraft('')
      setScope('all')
      await load('all')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to post note')
    }
  }

  const like = async (note: PawCreamNote) => {
    if (!viewer) {
      askSignin('login')
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

  const beginEdit = (note: PawCreamNote) => {
    setEditingId(note.id)
    setEditingText(note.text)
  }

  const saveEdit = async () => {
    if (!editingId || !editingText.trim()) return
    try {
      await updateNote(editingId, editingText.trim())
      setEditingId(null)
      setEditingText('')
      await load(scope)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to update note')
    }
  }

  const remove = async (note: PawCreamNote) => {
    if (!window.confirm(copy.deleteConfirm)) return
    try {
      await deleteNote(note.id)
      await load(scope)
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to delete note')
    }
  }

  const pill = (active: boolean) => ({
    minHeight: 32,
    border: '1px solid rgba(202,145,166,.22)',
    borderRadius: 999,
    padding: '0 13px',
    background: active ? 'rgba(246,226,234,.95)' : 'rgba(255,255,255,.72)',
    color: active ? '#8f6173' : '#9a7b86',
    cursor: 'pointer',
    fontSize: 13,
  } as const)

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
      <section
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
            <strong style={{ display: 'block', fontSize: mobile ? 22 : 28, letterSpacing: '.015em' }}>{copy.title}</strong>
            <p style={{ margin: '6px 0 0', fontSize: mobile ? 13 : 14, lineHeight: 1.55, color: '#9d818a' }}>{copy.subtitle}</p>
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
          <div style={{ marginTop: 13, padding: '8px 11px', borderRadius: 13, background: 'rgba(233,243,249,.78)', color: '#7891a1', fontSize: mobile ? 11.5 : 12.5, lineHeight: 1.5 }}>
            {copy.preview}
          </div>
        )}

        <div style={{ display: 'flex', gap: 7, marginTop: 14 }}>
          <button type="button" onClick={() => selectScope('all')} style={pill(scope === 'all')}>{copy.all}</button>
          <button type="button" onClick={() => selectScope('mine')} style={pill(scope === 'mine')}>{copy.mine}</button>
        </div>

        {viewer ? (
          <section style={{ marginTop: 15, padding: mobile ? 12 : 14, borderRadius: 18, background: 'rgba(251,241,245,.64)', border: '1px solid rgba(209,156,176,.14)' }}>
            <div style={{ marginBottom: 8, fontSize: mobile ? 12 : 13.5, fontWeight: 700, color: '#91717d' }}>{copy.write} · {viewer.displayName}</div>
            <textarea
              value={draft}
              maxLength={280}
              onChange={(event) => setDraft(event.currentTarget.value)}
              placeholder={copy.placeholder}
              style={{ width: '100%', minHeight: mobile ? 92 : 108, resize: 'vertical', boxSizing: 'border-box', border: '1px solid rgba(205,148,168,.2)', borderRadius: 15, padding: '11px 12px', outline: 'none', background: 'rgba(255,253,253,.88)', color: '#715a63', font: `${mobile ? 14 : 15}px/1.65 inherit` }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginTop: 8 }}>
              <span style={{ fontSize: mobile ? 10.5 : 11.5, color: '#b0969f' }}>{draft.length}/280</span>
              <button type="button" disabled={!draft.trim()} onClick={() => void publish()} style={{ minHeight: 33, border: '1px solid rgba(203,130,158,.28)', borderRadius: 999, padding: '0 15px', background: draft.trim() ? '#f7e6ed' : '#f5f1f2', color: draft.trim() ? '#8f6072' : '#b7a7ad', cursor: draft.trim() ? 'pointer' : 'default', fontSize: mobile ? 12 : 13 }}>
                {copy.publish}
              </button>
            </div>
          </section>
        ) : (
          <section style={{ marginTop: 15, padding: '13px 14px', borderRadius: 18, background: 'rgba(251,241,245,.62)', border: '1px solid rgba(209,156,176,.14)' }}>
            <p style={{ margin: 0, fontSize: mobile ? 12.5 : 13.5, lineHeight: 1.65, color: '#967884' }}>{copy.loginLead}</p>
            <div style={{ display: 'flex', gap: 7, marginTop: 10 }}>
              <button type="button" onClick={() => askSignin('login')} style={pill(true)}>{copy.login}</button>
              <button type="button" onClick={() => askSignin('register')} style={pill(false)}>{copy.register}</button>
            </div>
          </section>
        )}

        {status && (
          <div role="status" style={{ marginTop: 10, padding: '8px 10px', borderRadius: 12, background: 'rgba(235,244,249,.72)', color: '#768e9d', fontSize: mobile ? 11.5 : 12.5 }}>
            {status}
          </div>
        )}

        {loading ? (
          <p style={{ margin: '20px 0 4px', textAlign: 'center', color: '#ae929c', fontSize: mobile ? 11.5 : 12.5 }}>{copy.loading}</p>
        ) : notes.length === 0 ? (
          <p style={{ margin: '20px 0 4px', padding: '20px 12px', borderRadius: 16, background: 'rgba(249,241,244,.62)', color: '#ad919b', fontSize: mobile ? 12.5 : 13.5, textAlign: 'center' }}>{copy.empty}</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: mobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(3, minmax(0, 1fr))', gap: mobile ? 10 : 13, marginTop: 20, padding: mobile ? '1px 2px 8px' : '3px 4px 10px' }}>
            {notes.map((note, index) => (
              <article
                key={note.id}
                style={{
                  minHeight: mobile ? 142 : 158,
                  display: 'flex',
                  flexDirection: 'column',
                  padding: mobile ? '12px 11px 10px' : '14px 13px 11px',
                  border: '1px solid rgba(207,155,174,.18)',
                  borderRadius: 4,
                  background: index % 3 === 1 ? '#fff9e8' : index % 3 === 2 ? '#f5fafc' : '#fff5f8',
                  boxShadow: '0 9px 20px rgba(100,76,85,.09)',
                  transform: `rotate(${rotations[index % rotations.length]}deg)`,
                  transformOrigin: '50% 30%',
                }}
              >
                {editingId === note.id ? (
                  <>
                    <textarea
                      value={editingText}
                      maxLength={280}
                      onChange={(event) => setEditingText(event.currentTarget.value)}
                      style={{ flex: 1, width: '100%', minHeight: 86, resize: 'none', boxSizing: 'border-box', border: '1px solid rgba(205,148,168,.2)', borderRadius: 9, padding: 8, background: 'rgba(255,255,255,.68)', color: '#715a63', font: `${mobile ? 13.5 : 14.5}px/1.6 inherit`, outline: 'none' }}
                    />
                    <div style={{ display: 'flex', gap: 5, marginTop: 7 }}>
                      <button type="button" onClick={() => void saveEdit()} style={{ ...pill(true), minHeight: 27, padding: '0 9px', fontSize: 11.5 }}>{copy.save}</button>
                      <button type="button" onClick={() => setEditingId(null)} style={{ ...pill(false), minHeight: 27, padding: '0 9px', fontSize: 11.5 }}>{copy.cancel}</button>
                    </div>
                  </>
                ) : (
                  <>
                    <p style={{ flex: 1, margin: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', color: '#735d65', fontSize: mobile ? 13.5 : 15, lineHeight: 1.68 }}>{note.text}</p>
                    <div style={{ marginTop: 10, paddingTop: 7, borderTop: '1px solid rgba(182,137,153,.12)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 7, alignItems: 'center' }}>
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#9a7a86', fontSize: mobile ? 10.5 : 11.5 }}>♡ {note.authorName}</span>
                        <time dateTime={note.createdAt} style={{ color: '#b098a0', fontSize: mobile ? 9.5 : 10.5 }}>
                          {new Date(note.createdAt).toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric' })}
                        </time>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6, alignItems: 'center', marginTop: 7 }}>
                        <button type="button" onClick={() => void like(note)} aria-label={copy.heart} style={{ border: 0, padding: 0, background: 'transparent', color: note.likedByMe ? '#c47491' : '#a98c96', cursor: 'pointer', fontSize: mobile ? 11.5 : 12.5 }}>
                          {note.likedByMe ? '♥' : '♡'} {note.likesCount}
                        </button>
                        {note.isMine && (
                          <span style={{ display: 'flex', gap: 6 }}>
                            <button type="button" onClick={() => beginEdit(note)} style={{ border: 0, padding: 0, background: 'transparent', color: '#9b7b87', cursor: 'pointer', fontSize: mobile ? 10 : 11 }}>{copy.edit}</button>
                            <button type="button" onClick={() => void remove(note)} style={{ border: 0, padding: 0, background: 'transparent', color: '#b78696', cursor: 'pointer', fontSize: mobile ? 10 : 11 }}>{copy.remove}</button>
                          </span>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
