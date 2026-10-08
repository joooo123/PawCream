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

export const AUTH_CHANGED_EVENT = 'pawcream:auth-changed'
export const OPEN_SIGNIN_EVENT = 'pawcream:open-signin'

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim().replace(/\/$/, '') ?? ''

const PREVIEW_NOTES: PawCreamNote[] = [
  {
    id: 'preview-1',
    text: '今天也来 PawCream 坐一会儿 ♡',
    authorName: 'momo',
    createdAt: '2026-10-08T01:20:00.000Z',
    updatedAt: '2026-10-08T01:20:00.000Z',
    likesCount: 12,
    likedByMe: false,
    isMine: false,
  },
  {
    id: 'preview-2',
    text: '蓝色的小裙子真的很像晴天。',
    authorName: 'Rina',
    createdAt: '2026-10-07T10:10:00.000Z',
    updatedAt: '2026-10-07T10:10:00.000Z',
    likesCount: 8,
    likedByMe: false,
    isMine: false,
  },
  {
    id: 'preview-3',
    text: '希望下一次打开门的时候，也能听到喜欢的歌。',
    authorName: 'nana',
    createdAt: '2026-10-06T13:40:00.000Z',
    updatedAt: '2026-10-06T13:40:00.000Z',
    likesCount: 16,
    likedByMe: false,
    isMine: false,
  },
  {
    id: 'preview-4',
    text: '给今天留一张小小的便签。',
    authorName: 'Yuki',
    createdAt: '2026-10-05T05:05:00.000Z',
    updatedAt: '2026-10-05T05:05:00.000Z',
    likesCount: 5,
    likedByMe: false,
    isMine: false,
  },
]

export function isPawCreamApiEnabled() {
  return Boolean(API_BASE)
}

export function openPawCreamSignin(mode: 'login' | 'register' = 'login') {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(OPEN_SIGNIN_EVENT, { detail: { mode } }))
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
  if (!API_BASE) return null
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
  if (!API_BASE) return
  await request<{ ok: true }>('/auth/logout', { method: 'POST' })
}

export async function getNotes(scope: 'all' | 'mine' = 'all'): Promise<PawCreamNote[]> {
  if (!API_BASE) return scope === 'mine' ? [] : PREVIEW_NOTES
  const result = await request<{ notes: PawCreamNote[] }>(`/notes?scope=${scope}`)
  return result.notes
}

export async function createNote(text: string) {
  return request<{ note: PawCreamNote }>('/notes', {
    method: 'POST',
    body: JSON.stringify({ text }),
  })
}

export async function updateNote(id: string, text: string) {
  return request<{ note: PawCreamNote }>(`/notes/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify({ text }),
  })
}

export async function deleteNote(id: string) {
  return request<{ ok: true }>(`/notes/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export async function toggleNoteLike(id: string) {
  return request<{ liked: boolean; likesCount: number }>(`/notes/${encodeURIComponent(id)}/like`, {
    method: 'POST',
  })
}
