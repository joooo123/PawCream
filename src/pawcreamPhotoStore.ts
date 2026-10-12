import {
  deletePrivatePhoto,
  getCurrentUser,
  getPrivatePhotoImage,
  isPawCreamApiEnabled,
  listPrivatePhotos,
  uploadPrivatePhoto,
  type PawCreamPrivatePhoto,
  type PawCreamUser,
} from './pawcreamApi'

export type PawCreamPhotoVisibility = 'private' | 'public'

export type PawCreamStoredPhoto = {
  id: string
  ownerId: string
  ownerName: string
  imageBlob: Blob
  frameName: string
  visibility: PawCreamPhotoVisibility
  createdAt: string
  cloudSynced?: boolean
  syncError?: string
}

export const PHOTO_LIBRARY_CHANGED_EVENT = 'pawcream:photo-library-changed'
const DB_NAME = 'pawcream-photo-library-v2'
const STORE_NAME = 'photos'
const DB_VERSION = 1
const BROWSER_OWNER_KEY = 'pawcream-photo-browser-owner-v1'

function createId(prefix: string) {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID()}`
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      const store = db.objectStoreNames.contains(STORE_NAME)
        ? request.transaction!.objectStore(STORE_NAME)
        : db.createObjectStore(STORE_NAME, { keyPath: 'id' })
      if (!store.indexNames.contains('ownerId')) {
        store.createIndex('ownerId', 'ownerId', { unique: false })
      }
      if (!store.indexNames.contains('visibility')) {
        store.createIndex('visibility', 'visibility', { unique: false })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('无法打开 PawCream 照片库'))
  })
}

function browserOwnerId() {
  if (typeof window === 'undefined') return 'browser-preview'
  const existing = window.localStorage.getItem(BROWSER_OWNER_KEY)
  if (existing) return existing
  const created = createId('browser')
  window.localStorage.setItem(BROWSER_OWNER_KEY, created)
  return created
}

async function localPhotos() {
  const db = await openDb()
  try {
    return await new Promise<PawCreamStoredPhoto[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const request = tx.objectStore(STORE_NAME).getAll()
      request.onsuccess = () => resolve((request.result ?? []) as PawCreamStoredPhoto[])
      request.onerror = () => reject(request.error ?? new Error('无法读取照片库'))
    })
  } finally { db.close() }
}

async function putLocalPhoto(photo: PawCreamStoredPhoto) {
  const db = await openDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).put(photo)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('照片保存失败'))
      tx.onabort = () => reject(tx.error ?? new Error('照片保存失败'))
    })
  } finally { db.close() }
  window.dispatchEvent(new Event(PHOTO_LIBRARY_CHANGED_EVENT))
}

async function removeLocalPhoto(id: string) {
  const db = await openDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).delete(id)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('本地照片删除失败'))
    })
  } finally { db.close() }
  window.dispatchEvent(new Event(PHOTO_LIBRARY_CHANGED_EVENT))
}

async function requiredUser(): Promise<PawCreamUser> {
  if (!isPawCreamApiEnabled()) throw new Error('请在正式 PawCream 站点使用云端铁盒')
  const user = await getCurrentUser()
  if (!user) throw new Error('请先登录 PawCream 账号，再使用私人云端铁盒')
  return user
}

export async function resolvePawCreamPhotoOwner() {
  try {
    const user = await requiredUser()
    return { ownerId: user.id, ownerName: user.displayName, signedIn: true }
  } catch {
    return { ownerId: browserOwnerId(), ownerName: 'Creamy', signedIn: false }
  }
}

export async function countUnclaimedBrowserPhotos() {
  await requiredUser()
  const local = await localPhotos()
  return local.filter(photo => photo.ownerId === browserOwnerId()).length
}

// Browser-owned photos have no account association. Require an explicit user decision
// before attaching them to whichever user is currently signed in.
export async function claimUnclaimedBrowserPhotos() {
  const user = await requiredUser()
  const local = await localPhotos()
  let adopted = 0
  for (const photo of local) {
    if (photo.ownerId !== browserOwnerId()) continue
    await putLocalPhoto({
      ...photo, ownerId: user.id, ownerName: user.displayName,
      visibility: 'private', cloudSynced: false,
    })
    adopted++
  }
  return adopted
}

export async function savePawCreamPhoto(input: {
  imageBlob: Blob
  frameName: string
  visibility: PawCreamPhotoVisibility
}): Promise<PawCreamStoredPhoto> {
  const user = await requiredUser()
  const photo: PawCreamStoredPhoto = {
    id: createId('photo'),
    ownerId: user.id,
    ownerName: user.displayName,
    imageBlob: input.imageBlob,
    frameName: input.frameName,
    visibility: 'private',
    createdAt: new Date().toISOString(),
    cloudSynced: false,
  }
  // Keep a local backup first. If OSS fails, do not discard the only copy.
  await putLocalPhoto(photo)
  try {
    await uploadPrivatePhoto(photo)
    const synced = { ...photo, cloudSynced: true }
    await putLocalPhoto(synced).catch(() => {}) // Cloud upload already succeeded.
    return synced
  } catch (error) {
    return { ...photo, syncError: error instanceof Error ? error.message : '云端上传失败' }
  }
}

async function fetchAllCloudPhotos(): Promise<PawCreamPrivatePhoto[]> {
  const photos: PawCreamPrivatePhoto[] = []
  for (let offset = 0; ; offset += 100) {
    const batch = await listPrivatePhotos(offset, 100)
    photos.push(...batch.photos)
    if (photos.length >= batch.total || !batch.photos.length) break
  }
  return photos
}

export async function listPawCreamPhotos(scope: 'mine' | 'wall' = 'mine') {
  if (scope === 'wall') {
    const local = await localPhotos()
    return local.filter(photo => photo.visibility === 'public')
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
  }

  const user = await requiredUser()
  const local = await localPhotos().catch(() => [] as PawCreamStoredPhoto[])
  // Account boundary: never display other users' cached photos or anonymous photos.
  const mine = local.filter(photo => photo.ownerId === user.id)
  let remote: PawCreamPrivatePhoto[]
  try {
    remote = await fetchAllCloudPhotos()
  } catch (error) {
    if (!mine.length) throw error
    return mine.map(photo => ({ ...photo, cloudSynced: false, syncError: '云端连接失败，请稍后重试' }))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
  }

  const cloud = new Map(remote.map(photo => [photo.clientPhotoId, photo]))
  const pending = new Map<string, string>()
  // Migrate existing account-owned IndexedDB photos, and retry interrupted uploads.
  for (const photo of mine) {
    if (cloud.has(photo.id)) continue
    try {
      const uploaded = await uploadPrivatePhoto(photo)
      cloud.set(photo.id, uploaded)
      await putLocalPhoto({ ...photo, cloudSynced: true }).catch(() => {})
    } catch (error) {
      pending.set(photo.id, error instanceof Error ? error.message : '云端上传失败')
    }
  }

  const localById = new Map(mine.map(photo => [photo.id, photo]))
  const all = new Map<string, PawCreamStoredPhoto>()
  for (const photo of mine) {
    all.set(photo.id, {
      ...photo, cloudSynced: cloud.has(photo.id),
      syncError: pending.get(photo.id),
    })
  }

  // Four simultaneous image downloads avoid overwhelming small ECS instances.
  const cloudOnly = [...cloud.values()].filter(photo => !localById.has(photo.clientPhotoId))
  for (let i = 0; i < cloudOnly.length; i += 4) {
    const batch = await Promise.allSettled(cloudOnly.slice(i, i + 4).map(async photo => ({
      id: photo.clientPhotoId,
      ownerId: user.id,
      ownerName: user.displayName,
      imageBlob: await getPrivatePhotoImage(photo.clientPhotoId),
      frameName: photo.frameName,
      visibility: 'private' as const,
      createdAt: photo.createdAt,
      cloudSynced: true,
    })))
    for (const result of batch) {
      if (result.status === 'fulfilled') all.set(result.value.id, result.value)
    }
  }

  return [...all.values()]
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
}

export async function deletePawCreamPhoto(photo: PawCreamStoredPhoto) {
  const user = await requiredUser()
  if (photo.ownerId !== user.id) throw new Error('只能删除自己的私人照片')
  await deletePrivatePhoto(photo.id)
  // Deleting the local cache after the server avoids re-upload on the next visit.
  await removeLocalPhoto(photo.id)
}
