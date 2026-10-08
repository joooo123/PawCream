import { useState } from 'react'

type Language = 'zh' | 'en'

type Props = {
  mobile: boolean
  language: Language
  viewerName: string
  onPublish: (text: string) => Promise<void>
  onCancel: () => void
}

export default function PawCreamNoteComposer({ mobile, language, viewerName, onPublish, onCancel }: Props) {
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')

  const englishBoost = language === 'en' ? 10 : 0
  const uiSize = (size: number) => size + englishBoost
  const copy = language === 'zh'
    ? {
        title: '写一张便签',
        subtitle: `以 ${viewerName} 的名字留在 PawCream。`,
        placeholder: '想在 PawCream 留下什么？',
        publish: '贴上便签',
        cancel: '取消',
        failed: '便签没有贴上，请再试一次。',
      }
    : {
        title: 'Write a note',
        subtitle: `Leave it in PawCream as ${viewerName}.`,
        placeholder: 'What would you like to leave in PawCream?',
        publish: 'Post note',
        cancel: 'Cancel',
        failed: 'The note was not posted. Please try again.',
      }

  const submit = async () => {
    const text = draft.trim()
    if (!text || busy) return
    setBusy(true)
    setStatus('')
    try {
      await onPublish(text)
      setDraft('')
    } catch (error) {
      setStatus(error instanceof Error ? error.message : copy.failed)
    } finally {
      setBusy(false)
    }
  }

  return (
    <section
      aria-label={copy.title}
      style={{
        marginTop: 17,
        padding: mobile ? 13 : 16,
        border: '1px solid rgba(205,148,168,.18)',
        borderRadius: 20,
        background: 'rgba(255,245,248,.78)',
        boxShadow: '0 12px 28px rgba(115,82,94,.08)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
        <div>
          <strong style={{ display: 'block', color: '#8c6775', fontSize: uiSize(mobile ? 14 : 15.5) }}>{copy.title}</strong>
          <p style={{ margin: '5px 0 0', color: '#a1848f', fontSize: uiSize(mobile ? 10.5 : 11.5), lineHeight: 1.5 }}>{copy.subtitle}</p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          style={{ border: 0, background: 'transparent', color: '#aa8a96', cursor: 'pointer', fontSize: uiSize(11), padding: '2px 4px' }}
        >
          {copy.cancel}
        </button>
      </div>

      <textarea
        autoFocus
        value={draft}
        maxLength={280}
        onChange={(event) => setDraft(event.currentTarget.value)}
        placeholder={copy.placeholder}
        style={{
          width: '100%',
          minHeight: mobile ? 105 : 124,
          marginTop: 12,
          resize: 'vertical',
          boxSizing: 'border-box',
          border: '1px solid rgba(205,148,168,.2)',
          borderRadius: 15,
          padding: mobile ? '11px 12px' : '13px 14px',
          outline: 'none',
          background: 'rgba(255,253,253,.92)',
          color: '#715a63',
          font: `${uiSize(mobile ? 14 : 15)}px/1.68 inherit`,
        }}
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', marginTop: 9 }}>
        <span style={{ fontSize: mobile ? 10.5 : 11.5, color: '#b0969f' }}>{draft.length}/280</span>
        <button
          type="button"
          disabled={!draft.trim() || busy}
          onClick={() => void submit()}
          style={{
            minHeight: language === 'en' ? 43 : 34,
            border: '1px solid rgba(203,130,158,.28)',
            borderRadius: 999,
            padding: '0 16px',
            background: draft.trim() && !busy ? '#f7e6ed' : '#f5f1f2',
            color: draft.trim() && !busy ? '#8f6072' : '#b7a7ad',
            cursor: draft.trim() && !busy ? 'pointer' : 'default',
            fontSize: uiSize(mobile ? 12 : 13),
          }}
        >
          {copy.publish}
        </button>
      </div>

      {status && (
        <div role="status" style={{ marginTop: 9, color: '#8c7480', fontSize: uiSize(mobile ? 10.5 : 11.5), lineHeight: 1.5 }}>
          {status}
        </div>
      )}
    </section>
  )
}
