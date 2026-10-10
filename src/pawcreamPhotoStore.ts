import { getCurrentUser } from './pawcreamApi'

export type PawCreamPhotoVisibility = 'private' | 'public'

export type PawCreamStoredPhoto = {
  id: string
  ownerId: string
  ownerName: string
  imageBlob: Blob
  frameName: string
  visibility: PawCreamPhotoVisibility
  createdAt: string
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

export async function resolvePawCreamPhotoOwner() {
  try {
    const user = await getCurrentUser()
    if (user) {
      return {
        ownerId: user.id,
        ownerName: user.displayName,
        signedIn: true,
      }
    }
  } catch {
    // Preview/offline mode falls back to a browser-local owner.
  }

  return {
    ownerId: browserOwnerId(),
    ownerName: 'Creamy',
    signedIn: false,
  }
}

export async function savePawCreamPhoto(input: {
  imageBlob: Blob
  frameName: string
  visibility: PawCreamPhotoVisibility
}): Promise<PawCreamStoredPhoto> {
  const owner = await resolvePawCreamPhotoOwner()
  const photo: PawCreamStoredPhoto = {
    id: createId('photo'),
    ownerId: owner.ownerId,
    ownerName: owner.ownerName,
    imageBlob: input.imageBlob,
    frameName: input.frameName,
    visibility: input.visibility,
    createdAt: new Date().toISOString(),
  }

  const db = await openDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.objectStore(STORE_NAME).put(photo)
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('照片保存失败'))
      tx.onabort = () => reject(tx.error ?? new Error('照片保存失败'))
    })
  } finally {
    db.close()
  }

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(PHOTO_LIBRARY_CHANGED_EVENT))
  }
  return photo
}

export async function listPawCreamPhotos(scope: 'mine' | 'wall' = 'mine') {
  const owner = await resolvePawCreamPhotoOwner()
  const db = await openDb()

  try {
    const photos = await new Promise<PawCreamStoredPhoto[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const request = tx.objectStore(STORE_NAME).getAll()
      request.onsuccess = () => resolve((request.result ?? []) as PawCreamStoredPhoto[])
      request.onerror = () => reject(request.error ?? new Error('无法读取照片库'))
    })

    return photos
      .filter((photo) => scope === 'wall'
        ? photo.visibility === 'public'
        : photo.ownerId === owner.ownerId || (owner.signedIn && photo.ownerId === browserOwnerId()))
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
  } finally {
    db.close()
  }
}
