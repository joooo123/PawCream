import type { PawCreamNote } from '../pawcreamApi'

type Language = 'zh' | 'en'

type Props = {
  notes: PawCreamNote[]
  mobile: boolean
  language: Language
  onLike: (note: PawCreamNote) => Promise<void>
}

const rotations = [-0.8, 0.55, -0.35, 0.7, -0.5, 0.3]

export default function PawCreamNoteWall({ notes, mobile, language, onLike }: Props) {
  const copy = language === 'zh'
    ? { empty: '这里还没有便签。', like: '喜欢' }
    : { empty: 'No notes here yet.', like: 'Like' }

  if (notes.length === 0) {
    return (
      <p style={{ margin: '20px 0 4px', padding: '20px 12px', borderRadius: 16, background: 'rgba(249,241,244,.62)', color: '#ad919b', fontSize: language === 'en' ? 23.5 : 13.5, textAlign: 'center' }}>
        {copy.empty}
      </p>
    )
  }

  return (
    <div
      aria-label={language === 'zh' ? '公共便签' : 'Public notes'}
      style={{
        display: 'grid',
        gridTemplateColumns: mobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(3, minmax(0, 1fr))',
        gap: mobile ? 10 : 13,
        marginTop: 20,
        padding: mobile ? '3px 3px 8px' : '5px 5px 10px',
      }}
    >
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
            transformOrigin: '50% 35%',
            textRendering: 'geometricPrecision',
            WebkitFontSmoothing: 'antialiased',
          }}
        >
          <p style={{ flex: 1, margin: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', color: '#735d65', fontSize: mobile ? 13.5 : 15, lineHeight: 1.68 }}>
            {note.text}
          </p>

          <div style={{ marginTop: 10, paddingTop: 7, borderTop: '1px solid rgba(182,137,153,.12)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 7, alignItems: 'center' }}>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#9a7a86', fontSize: mobile ? 10.5 : 11.5 }}>♡ {note.authorName}</span>
              <time dateTime={note.createdAt} style={{ color: '#b098a0', fontSize: mobile ? 9.5 : 10.5 }}>
                {new Date(note.createdAt).toLocaleDateString(language === 'zh' ? 'zh-CN' : 'en-US', { month: 'short', day: 'numeric' })}
              </time>
            </div>
            <button
              type="button"
              onClick={() => void onLike(note)}
              aria-label={copy.like}
              style={{ marginTop: 7, border: 0, padding: 0, background: 'transparent', color: note.likedByMe ? '#c47491' : '#a98c96', cursor: 'pointer', fontSize: mobile ? 11.5 : 12.5 }}
            >
              {note.likedByMe ? '♥' : '♡'} {note.likesCount}
            </button>
          </div>
        </article>
      ))}
    </div>
  )
}
