export type PawCreamUser = {
  id: string
  email: string
  displayName: string
  role: 'user' | 'admin'
}

export type PawCreamNote = {
  id: string
  text: string
  authorName: string
  createdAt: string
  updatedAt: string
  likesCount: number
  likedByMe: boolean
  isMine: boolean
}

type PreviewStoredNote = {
  id: string
  text: string
  authorName: string
  ownerId: string | null
  createdAt: string
  updatedAt: string
  likesCount: number
  likedByPreviewUser: boolean
}

export const AUTH_CHANGED_EVENT = 'pawcream:auth-changed'
export const OPEN_SIGNIN_EVENT = 'pawcream:open-signin'

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim().replace(/\/$/, '') ?? ''
const PREVIEW_AUTH_STORAGE_KEY = 'pawcream-notes-preview-auth-v1'
const PREVIEW_NOTES_STORAGE_KEY = 'pawcream-notes-preview-data-v1'

const PREVIEW_USER: PawCreamUser = {
  id: 'preview-user',
  email: 'preview@pawcream.local',
  displayName: 'Creamy',
  role: 'user',
}

const DEFAULT_PREVIEW_NOTES: PreviewStoredNote[] = [
  {
    id: 'preview-1',
    text: '今天也来 PawCream 坐一会儿 ♡',
    authorName: 'momo',
    ownerId: null,
    createdAt: '2026-10-08T01:20:00.000Z',
    updatedAt: '2026-10-08T01:20:00.000Z',
    likesCount: 12,
    likedByPreviewUser: false,
  },
  {
    id: 'preview-2',
    text: '蓝色的小裙子真的很像晴天。',
    authorName: 'Rina',
    ownerId: null,
    createdAt: '2026-10-07T10:10:00.000Z',
    updatedAt: '2026-10-07T10:10:00.000Z',
    likesCount: 8,
    likedByPreviewUser: false,
  },
  {
    id: 'preview-3',
    text: '希望下一次打开门的时候，也能听到喜欢的歌。',
    authorName: 'nana',
    ownerId: null,
    createdAt: '2026-10-06T13:40:00.000Z',
    updatedAt: '2026-10-06T13:40:00.000Z',
    likesCount: 16,
    likedByPreviewUser: false,
  },
  {
    id: 'preview-mine-1',
    text: '这是我的预览便签，可以在「我的便签」里编辑或删除 ♡',
    authorName: PREVIEW_USER.displayName,
    ownerId: PREVIEW_USER.id,
    createdAt: '2026-10-06T02:16:00.000Z',
    updatedAt: '2026-10-06T02:16:00.000Z',
    likesCount: 4,
    likedByPreviewUser: false,
  },
  {
    id: 'preview-4',
    text: '给今天留一张小小的便签。',
    authorName: 'Yuki',
    ownerId: null,
    createdAt: '2026-10-05T05:05:00.000Z',
    updatedAt: '2026-10-05T05:05:00.000Z',
    likesCount: 5,
    likedByPreviewUser: false,
  },
]

export function isPawCreamApiEnabled() {
  return Boolean(API_BASE)
}

export function openPawCreamSignin(mode: 'login' | 'register' = 'login') {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(OPEN_SIGNIN_EVENT, { detail: { mode } }))
}

export function isPawCreamPreviewSignedIn() {
  if (typeof window === 'undefined' || API_BASE) return false
  return window.localStorage.getItem(PREVIEW_AUTH_STORAGE_KEY) === '1'
}

export function setPawCreamPreviewSignedIn(signedIn: boolean) {
  if (typeof window === 'undefined' || API_BASE) return
  window.localStorage.setItem(PREVIEW_AUTH_STORAGE_KEY, signedIn ? '1' : '0')
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT))
}

export function resetPawCreamPreviewNotes() {
  if (typeof window === 'undefined' || API_BASE) return
  window.localStorage.removeItem(PREVIEW_NOTES_STORAGE_KEY)
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT))
}

function cloneDefaultPreviewNotes() {
  return DEFAULT_PREVIEW_NOTES.map((note) => ({ ...note }))
}

function readPreviewNotes(): PreviewStoredNote[] {
  if (typeof window === 'undefined') return cloneDefaultPreviewNotes()

  try {
    const raw = window.localStorage.getItem(PREVIEW_NOTES_STORAGE_KEY)
    if (!raw) return cloneDefaultPreviewNotes()
    const parsed = JSON.parse(raw) as PreviewStoredNote[]
    return Array.isArray(parsed) ? parsed : cloneDefaultPreviewNotes()
  } catch {
    return cloneDefaultPreviewNotes()
  }
}

function writePreviewNotes(notes: PreviewStoredNote[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(PREVIEW_NOTES_STORAGE_KEY, JSON.stringify(notes))
}

function previewUserRequired() {
  if (!isPawCreamPreviewSignedIn()) {
    throw new Error('请先切换到「已登录预览」')
  }
}

function toPreviewNote(note: PreviewStoredNote): PawCreamNote {
  const signedIn = isPawCreamPreviewSignedIn()
  return {
    id: note.id,
    text: note.text,
    authorName: note.authorName,
    createdAt: note.createdAt,
    updatedAt: note.updatedAt,
    likesCount: note.likesCount,
    likedByMe: signedIn && note.likedByPreviewUser,
    isMine: signedIn && note.ownerId === PREVIEW_USER.id,
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!API_BASE) throw new Error('PawCream API is not configured')

  const response = await fetch(`${API_BASE}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...init.headers,
    },
  })

  const payload = await response.json().catch(() => ({})) as { error?: string } & T
  if (!response.ok) throw new Error(payload.error || `Request failed (${response.status})`)
  return payload
}

export async function getCurrentUser(): Promise<PawCreamUser | null> {
  if (!API_BASE) return isPawCreamPreviewSignedIn() ? PREVIEW_USER : null
  const result = await request<{ user: PawCreamUser | null }>('/auth/me')
  return result.user
}

export async function signInPawCream(email: string, password: string) {
  return request<{ user: PawCreamUser }>('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
}

export async function registerPawCream(email: string, password: string, inviteCode: string) {
  return request<{ user: PawCreamUser }>('/auth/register', {
    method: 'POST',
    body: JSON.stringify({ email, password, inviteCode }),
  })
}

export async function signOutPawCream() {
  if (!API_BASE) {
    setPawCreamPreviewSignedIn(false)
    return
  }
  await request<{ ok: true }>('/auth/logout', { method: 'POST' })
}

export async function getNotes(scope: 'all' | 'mine' = 'all'): Promise<PawCreamNote[]> {
  if (!API_BASE) {
    const signedIn = isPawCreamPreviewSignedIn()
    const notes = readPreviewNotes()
      .filter((note) => scope === 'all' || (signedIn && note.ownerId === PREVIEW_USER.id))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    return notes.map(toPreviewNote)
  }

  const result = await request<{ notes: PawCreamNote[] }>(`/notes?scope=${scope}`)
  return result.notes
}

export async function createNote(text: string) {
  if (!API_BASE) {
    previewUserRequired()
    const now = new Date().toISOString()
    const stored: PreviewStoredNote = {
      id: `preview-user-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      text: text.trim().slice(0, 280),
      authorName: PREVIEW_USER.displayName,
      ownerId: PREVIEW_USER.id,
      createdAt: now,
      updatedAt: now,
      likesCount: 0,
      likedByPreviewUser: false,
    }
    const notes = readPreviewNotes()
    writePreviewNotes([stored, ...notes])
    return { note: toPreviewNote(stored) }
  }

  return request<{ note: PawCreamNote }>('/notes', {
    method: 'POST',
    body: JSON.stringify({ text }),
  })
}

export async function updateNote(id: string, text: string) {
  if (!API_BASE) {
    previewUserRequired()
    const notes = readPreviewNotes()
    const index = notes.findIndex((note) => note.id === id)
    if (index < 0) throw new Error('没有找到这张预览便签')
    if (notes[index].ownerId !== PREVIEW_USER.id) throw new Error('只能编辑自己的便签')

    const updated: PreviewStoredNote = {
      ...notes[index],
      text: text.trim().slice(0, 280),
      updatedAt: new Date().toISOString(),
    }
    notes[index] = updated
    writePreviewNotes(notes)
    return { note: toPreviewNote(updated) }
  }

  return request<{ note: PawCreamNote }>(`/notes/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ text }),
  })
}

export async function deleteNote(id: string) {
  if (!API_BASE) {
    previewUserRequired()
    const notes = readPreviewNotes()
    const target = notes.find((note) => note.id === id)
    if (!target) throw new Error('没有找到这张预览便签')
    if (target.ownerId !== PREVIEW_USER.id) throw new Error('只能删除自己的便签')
    writePreviewNotes(notes.filter((note) => note.id !== id))
    return { ok: true as const }
  }

  return request<{ ok: true }>(`/notes/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export async function toggleNoteLike(id: string) {
  if (!API_BASE) {
    previewUserRequired()
    const notes = readPreviewNotes()
    const index = notes.findIndex((note) => note.id === id)
    if (index < 0) throw new Error('没有找到这张预览便签')

    const liked = !notes[index].likedByPreviewUser
    notes[index] = {
      ...notes[index],
      likedByPreviewUser: liked,
      likesCount: Math.max(0, notes[index].likesCount + (liked ? 1 : -1)),
    }
    writePreviewNotes(notes)

    return {
      liked,
      likesCount: notes[index].likesCount,
    }
  }

  return request<{ liked: boolean; likesCount: number }>(`/notes/${encodeURIComponent(id)}/like`, {
    method: 'POST',
  })
}
