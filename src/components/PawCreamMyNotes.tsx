import { useState } from 'react'
import type { PawCreamNote } from '../pawcreamApi'

type Language = 'zh' | 'en'

type Props = {
  notes: PawCreamNote[]
  mobile: boolean
  language: Language
  onWrite: () => void
  onSave: (id: string, text: string) => Promise<void>
  onDelete: (note: PawCreamNote) => Promise<void>
}

export default function PawCreamMyNotes({ notes, mobile, language, onWrite, onSave, onDelete }: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingText, setEditingText] = useState('')
  const [busy, setBusy] = useState(false)

  const englishBoost = language === 'en' ? 10 : 0
  const uiSize = (size: number) => size + englishBoost
  const copy = language === 'zh'
    ? {
        title: '我的便签',
        count: `${notes.length} 张`,
        write: '写新便签',
        empty: '你还没有留下便签。',
        edit: '编辑',
        remove: '删除',
        save: '保存',
        cancel: '取消',
      }
    : {
        title: 'My notes',
        count: `${notes.length} notes`,
        write: 'Write a new note',
        empty: 'You have not left a note yet.',
        edit: 'Edit',
        remove: 'Delete',
        save: 'Save',
        cancel: 'Cancel',
      }

  const startEdit = (note: PawCreamNote) => {
    setEditingId(note.id)
    setEditingText(note.text)
  }

  const save = async () => {
    if (!editingId || !editingText.trim() || busy) return
    setBusy(true)
    try {
      await onSave(editingId, editingText.trim())
      setEditingId(null)
      setEditingText('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-label={copy.title} style={{ marginTop: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        <div>
          <strong style={{ color: '#8b6875', fontSize: uiSize(mobile ? 14 : 16) }}>{copy.title}</strong>
          <span style={{ marginLeft: 9, color: '#ad919b', fontSize: uiSize(mobile ? 10 : 11) }}>{copy.count}</span>
        </div>
        <button
          type="button"
          onClick={onWrite}
          style={{ minHeight: language === 'en' ? 42 : 32, border: '1px solid rgba(202,145,166,.22)', borderRadius: 999, padding: '0 14px', background: 'rgba(246,226,234,.9)', color: '#8f6173', cursor: 'pointer', fontSize: uiSize(12) }}
        >
          {copy.write}
        </button>
      </div>

      {notes.length === 0 ? (
        <p style={{ margin: '16px 0 0', padding: '22px 14px', borderRadius: 16, background: 'rgba(249,241,244,.62)', color: '#ad919b', fontSize: uiSize(mobile ? 12 : 13), textAlign: 'center' }}>
          {copy.empty}
        </p>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: mobile ? '1fr' : 'repeat(2, minmax(0,1fr))', gap: 11, marginTop: 14 }}>
          {notes.map((note, index) => (
            <article
              key={note.id}
              style={{
                minHeight: 128,
                padding: mobile ? '12px' : '14px',
                border: '1px solid rgba(207,155,174,.18)',
                borderRadius: 14,
                background: index % 2 ? '#fff9e8' : '#fff5f8',
                boxShadow: '0 8px 18px rgba(100,76,85,.07)',
              }}
            >
              {editingId === note.id ? (
                <>
                  <textarea
                    value={editingText}
                    maxLength={280}
                    onChange={(event) => setEditingText(event.currentTarget.value)}
                    style={{ width: '100%', minHeight: 88, resize: 'vertical', boxSizing: 'border-box', border: '1px solid rgba(205,148,168,.2)', borderRadius: 10, padding: 9, outline: 'none', background: 'rgba(255,255,255,.72)', color: '#715a63', font: `${mobile ? 13.5 : 14.5}px/1.62 inherit` }}
                  />
                  <div style={{ display: 'flex', gap: 7, marginTop: 8 }}>
                    <button type="button" onClick={() => void save()} style={{ minHeight: language === 'en' ? 38 : 29, border: '1px solid rgba(202,145,166,.22)', borderRadius: 999, padding: '0 11px', background: '#f7e6ed', color: '#8f6173', cursor: 'pointer', fontSize: uiSize(11.5) }}>{copy.save}</button>
                    <button type="button" onClick={() => setEditingId(null)} style={{ minHeight: language === 'en' ? 38 : 29, border: '1px solid rgba(202,145,166,.18)', borderRadius: 999, padding: '0 11px', background: '#fff', color: '#9a7b86', cursor: 'pointer', fontSize: uiSize(11.5) }}>{copy.cancel}</button>
                  </div>
                </>
              ) : (
                <>
                  <p style={{ minHeight: 64, margin: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', color: '#735d65', fontSize: mobile ? 13.5 : 15, lineHeight: 1.65 }}>{note.text}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center', marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(182,137,153,.12)' }}>
                    <span style={{ color: '#aa8c97', fontSize: mobile ? 10 : 11 }}>♡ {note.likesCount}</span>
                    <span style={{ display: 'flex', gap: 8 }}>
                      <button type="button" onClick={() => startEdit(note)} style={{ border: 0, background: 'transparent', color: '#92727f', cursor: 'pointer', fontSize: uiSize(mobile ? 10 : 11), padding: 0 }}>{copy.edit}</button>
                      <button type="button" onClick={() => void onDelete(note)} style={{ border: 0, background: 'transparent', color: '#b78696', cursor: 'pointer', fontSize: uiSize(mobile ? 10 : 11), padding: 0 }}>{copy.remove}</button>
                    </span>
                  </div>
                </>
              )}
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
