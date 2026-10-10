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

export type PawCreamPublicPhoto = {
  id: string
  authorName: string
  frameName: string
  createdAt: string
  clientPhotoId?: string
}

export type PawCreamPublicPhotoBatch = {
  photos: PawCreamPublicPhoto[]
  total: number
}

export type PawCreamPublicNoteOrder = 'recent' | 'random'

export type PawCreamNoteBatch = {
  notes: PawCreamNote[]
  total: number
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
const PREVIEW_NOTES_STORAGE_KEY = 'pawcream-notes-preview-data-v2'

const PREVIEW_USER: PawCreamUser = {
  id: 'preview-user',
  email: 'preview@pawcream.local',
  displayName: 'Creamy',
  role: 'user',
}

const DEFAULT_PREVIEW_NOTES: PreviewStoredNote[] = [
  ['preview-1', '今天也来 PawCream 坐一会儿 ♡', 'momo', null, '2026-10-08T01:20:00.000Z', 12],
  ['preview-2', '蓝色的小裙子真的很像晴天。', 'Rina', null, '2026-10-07T10:10:00.000Z', 8],
  ['preview-3', '希望下一次打开门的时候，也能听到喜欢的歌。', 'nana', null, '2026-10-06T13:40:00.000Z', 16],
  ['preview-mine-1', '这是我的预览便签，可以在「我的便签」里编辑或删除 ♡', PREVIEW_USER.displayName, PREVIEW_USER.id, '2026-10-06T02:16:00.000Z', 4],
  ['preview-4', '给今天留一张小小的便签。', 'Yuki', null, '2026-10-05T05:05:00.000Z', 5],
  ['preview-5', '冰淇淋音乐店今天也很好听。', 'Lulu', null, '2026-10-04T11:31:00.000Z', 9],
  ['preview-6', '路过这里，偷偷留下一颗草莓糖。', 'Miu', null, '2026-10-03T08:12:00.000Z', 7],
  ['preview-7', '愿你今天遇到的都是软绵绵的好事。', 'Aki', null, '2026-10-02T15:26:00.000Z', 14],
  ['preview-8', '下雨天也可以穿最喜欢的小裙子。', 'Nono', null, '2026-10-01T04:42:00.000Z', 6],
  ['preview-9', '今天的云像奶油一样。', 'Sora', null, '2026-09-30T12:18:00.000Z', 11],
  ['preview-10', '听到喜欢的歌时记得把音量调大一点 ♡', 'Mika', null, '2026-09-29T07:44:00.000Z', 18],
  ['preview-11', '想把这一刻夹进相册里。', 'Kiki', null, '2026-09-28T14:03:00.000Z', 3],
  ['preview-12', '今天也认真地喜欢了一点点生活。', 'Aya', null, '2026-09-27T09:36:00.000Z', 13],
  ['preview-13', '送给下一位看到这张便签的人一个拥抱。', 'Nami', null, '2026-09-26T02:51:00.000Z', 20],
  ['preview-14', 'PawCream 的蓝色让我想到清晨。', 'Melo', null, '2026-09-25T13:22:00.000Z', 10],
  ['preview-15', '希望衣柜里永远有一件最喜欢的衣服。', 'Hana', null, '2026-09-24T06:08:00.000Z', 8],
  ['preview-16', '晚安之前来这里留一句话。', 'Eri', null, '2026-09-23T16:47:00.000Z', 15],
  ['preview-mine-2', '第二张自己的预览便签，用来测试管理列表。', PREVIEW_USER.displayName, PREVIEW_USER.id, '2026-09-22T03:14:00.000Z', 2],
].map(([id, text, authorName, ownerId, createdAt, likesCount]) => ({
  id: String(id),
  text: String(text),
  authorName: String(authorName),
  ownerId: ownerId ? String(ownerId) : null,
  createdAt: String(createdAt),
  updatedAt: String(createdAt),
  likesCount: Number(likesCount),
  likedByPreviewUser: false,
}))

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

function stableRandomRank(value: string) {
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
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

export function publicPhotoImageUrl(id: string) {
  return `${API_BASE}/photos/${encodeURIComponent(id)}/image`
}

export function listPublicPhotos(offset = 0, limit = 24) {
  return request<PawCreamPublicPhotoBatch>(
    `/photos?offset=${encodeURIComponent(offset)}&limit=${encodeURIComponent(limit)}`,
  )
}

export async function getMyPublishedPhoto(clientPhotoId: string) {
  const result = await request<{ photo: PawCreamPublicPhoto | null }>(
    `/photos/mine/${encodeURIComponent(clientPhotoId)}`,
  )
  return result.photo
}

async function preparePublicImage(original: Blob): Promise<Blob> {
  if (original.size <= 3 * 1024 * 1024) return original
  // Reduce only the uploaded public copy; keep the original in the private tin box.
  const image = await createImageBitmap(original)
  const scale = Math.min(1, 1600 / Math.max(image.width, image.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(image.width * scale)
  canvas.height = Math.round(image.height * scale)
  const context = canvas.getContext('2d')
  if (!context) {
    image.close()
    throw new Error('照片压缩失败')
  }
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  image.close()
  const result = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', .82))
  if (!result || result.size > 3 * 1024 * 1024) throw new Error('返图超过 3MB，无法公开')
  return result
}

export async function publishPhoto(input: { id: string; frameName: string; imageBlob: Blob }) {
  if (!API_BASE) throw new Error('请在连接真实后端的正式站点公开返图')
  const imageBlob = await preparePublicImage(input.imageBlob)
  const query = new URLSearchParams({ clientPhotoId: input.id, frameName: input.frameName })
  const response = await fetch(`${API_BASE}/photos?${query}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': imageBlob.type || 'image/png' },
    body: imageBlob,
  })
  const payload = await response.json().catch(() => ({})) as {
    photo?: PawCreamPublicPhoto
    error?: string
  }
  if (!response.ok || !payload.photo) throw new Error(payload.error || '公开返图失败')
  return payload.photo
}

export async function revokePublishedPhoto(id: string) {
  return request<{ ok: boolean }>(`/photos/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export async function getPublicNotesBatch(options: {
  order: PawCreamPublicNoteOrder
  limit: number
  offset: number
  seed: string
}): Promise<PawCreamNoteBatch> {
  const limit = Math.max(1, Math.min(24, Math.floor(options.limit)))
  const offset = Math.max(0, Math.floor(options.offset))

  if (!API_BASE) {
    const notes = readPreviewNotes()
    const ordered = options.order === 'random'
      ? [...notes].sort((a, b) => {
          const left = stableRandomRank(`${options.seed}:${a.id}`)
          const right = stableRandomRank(`${options.seed}:${b.id}`)
          return left - right || a.id.localeCompare(b.id)
        })
      : [...notes].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))

    return {
      notes: ordered.slice(offset, offset + limit).map(toPreviewNote),
      total: ordered.length,
    }
  }

  const params = new URLSearchParams({
    scope: 'all',
    order: options.order,
    limit: String(limit),
    offset: String(offset),
    seed: options.seed,
  })
  return request<PawCreamNoteBatch>(`/notes?${params.toString()}`)
}

export async function getNotes(scope: 'all' | 'mine' = 'all'): Promise<PawCreamNote[]> {
  if (scope === 'all') {
    const result = await getPublicNotesBatch({
      order: 'recent',
      limit: 24,
      offset: 0,
      seed: 'recent',
    })
    return result.notes
  }

  if (!API_BASE) {
    const signedIn = isPawCreamPreviewSignedIn()
    const notes = readPreviewNotes()
      .filter((note) => signedIn && note.ownerId === PREVIEW_USER.id)
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
    return notes.map(toPreviewNote)
  }

  const result = await request<{ notes: PawCreamNote[] }>('/notes?scope=mine')
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
