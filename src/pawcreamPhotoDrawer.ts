export type PawCreamDrawerPhoto = {
  id: string
  ownerId: string
  ownerName: string
  imageBlob: Blob
  fileName: string
  frameIndex: number
  createdAt: string
}

export const PHOTO_DRAWER_CHANGED_EVENT = 'pawcream:photo-drawer-changed'

const DB_NAME = 'pawcream-photo-drawer-v1'
const STORE_NAME = 'photos'
const DB_VERSION = 1

function openDrawerDb(): Promise<IDBDatabase> {
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
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error ?? new Error('无法打开照片抽屉'))
  })
}

function idForPhoto() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `drawer-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function dispatchDrawerChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(PHOTO_DRAWER_CHANGED_EVENT))
  }
}

export async function saveDrawerPhoto(input: {
  ownerId: string
  ownerName: string
  imageBlob: Blob
  fileName: string
  frameIndex: number
}): Promise<PawCreamDrawerPhoto> {
  const photo: PawCreamDrawerPhoto = {
    id: idForPhoto(),
    ownerId: input.ownerId,
    ownerName: input.ownerName,
    imageBlob: input.imageBlob,
    fileName: input.fileName,
    frameIndex: input.frameIndex,
    createdAt: new Date().toISOString(),
  }

  const db = await openDrawerDb()
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

  dispatchDrawerChanged()
  return photo
}

export async function listDrawerPhotos(ownerId: string): Promise<PawCreamDrawerPhoto[]> {
  const db = await openDrawerDb()
  try {
    const photos = await new Promise<PawCreamDrawerPhoto[]>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const request = tx.objectStore(STORE_NAME).index('ownerId').getAll(ownerId)
      request.onsuccess = () => resolve((request.result ?? []) as PawCreamDrawerPhoto[])
      request.onerror = () => reject(request.error ?? new Error('无法读取照片抽屉'))
    })
    return photos.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt))
  } finally {
    db.close()
  }
}

export async function deleteDrawerPhoto(id: string, ownerId: string): Promise<void> {
  const db = await openDrawerDb()
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const getRequest = store.get(id)

      getRequest.onsuccess = () => {
        const photo = getRequest.result as PawCreamDrawerPhoto | undefined
        if (!photo || photo.ownerId !== ownerId) {
          tx.abort()
          reject(new Error('没有找到这张照片'))
          return
        }
        store.delete(id)
      }

      getRequest.onerror = () => reject(getRequest.error ?? new Error('无法读取照片'))
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error ?? new Error('删除照片失败'))
      tx.onabort = () => reject(tx.error ?? new Error('删除照片失败'))
    })
  } finally {
    db.close()
  }

  dispatchDrawerChanged()
}
