const OFFLINE_BOX_INDEX_KEY = 'pawcream-xhs-box-index-v1'
const OFFLINE_BOX_PHOTO_PREFIX = 'pawcream-xhs-box-photo-v1-'
const OFFLINE_BOX_MAX_PHOTOS = 8
const OFFLINE_BOX_MAX_DATA_URL_LENGTH = 450000

const offlineBoxCacheLimit = () => {
  const api = (window as any).xhs && (window as any).xhs.miniTool
  return api && typeof api.setStorage === 'function' ? OFFLINE_BOX_MAX_PHOTOS : 2
}

const readOfflineBoxValue = async (key: string): Promise<any> => {
  const api = (window as any).xhs && (window as any).xhs.miniTool
  if (api && typeof api.getStorage === 'function') {
    try {
      const result = await api.getStorage({ key })
      return !result || result.data == null ? null : JSON.parse(result.data)
    } catch (error) {
      throw new Error('读取小红书工具缓存失败')
    }
  }
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? JSON.parse(raw) : null
  } catch (error) {
    return null
  }
}

const writeOfflineBoxValue = async (key: string, value: unknown) => {
  const serialized = JSON.stringify(value)
  const api = (window as any).xhs && (window as any).xhs.miniTool
  if (api && typeof api.setStorage === 'function') {
    try {
      await api.setStorage({ key, data: serialized })
      return
    } catch (error) {
      throw new Error('小红书工具缓存空间不足或写入失败')
    }
  }
  try {
    window.localStorage.setItem(key, serialized)
  } catch (error) {
    throw new Error('小红书工具缓存空间不足或写入失败')
  }
}

const removeOfflineBoxValue = async (key: string) => {
  const api = (window as any).xhs && (window as any).xhs.miniTool
  if (api && typeof api.removeStorage === 'function') {
    await api.removeStorage({ key })
    return
  }
  window.localStorage.removeItem(key)
}

const offlineBoxBlobFromDataUrl = (dataUrl: string) => {
  const match = /^data:([^;,]+);base64,([\s\S]+)$/.exec(dataUrl)
  if (!match) throw new Error('本地拍立得缓存格式无效')
  const binary = window.atob(match[2])
  const bytes = new Uint8Array(binary.length)
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index)
  return new Blob([bytes], { type: match[1] })
}

const offlineBoxDataUrlFromBlob = async (blob: Blob) => {
  const sourceUrl = URL.createObjectURL(blob)
  let image: HTMLImageElement
  try {
    image = await loadImage(sourceUrl)
  } finally {
    URL.revokeObjectURL(sourceUrl)
  }
  const maxDimension = 1000
  const baseScale = Math.min(1, maxDimension / Math.max(image.naturalWidth, image.naturalHeight))
  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context) throw new Error('无法压缩拍立得缓存')
  for (const shrink of [1, .86, .72, .6, .5]) {
    canvas.width = Math.max(1, Math.round(image.naturalWidth * baseScale * shrink))
    canvas.height = Math.max(1, Math.round(image.naturalHeight * baseScale * shrink))
    context.clearRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    for (const quality of [.84, .76, .68]) {
      const dataUrl = canvas.toDataURL('image/webp', quality)
      if (dataUrl.length <= OFFLINE_BOX_MAX_DATA_URL_LENGTH) return dataUrl
    }
  }
  throw new Error('单张拍立得压缩后仍超过本地缓存限制')
}

const readOfflineBoxIndex = async (): Promise<any[]> => {
  const value = await readOfflineBoxValue(OFFLINE_BOX_INDEX_KEY)
  return Array.isArray(value) ? value.filter(item => item && typeof item.id === 'string') : []
}

const loadOfflineBoxPhotos = async (): Promise<PawCreamStoredPhoto[]> => {
  const index = await readOfflineBoxIndex()
  const photos: PawCreamStoredPhoto[] = []
  for (const item of index.slice(0, OFFLINE_BOX_MAX_PHOTOS)) {
    const dataUrl = await readOfflineBoxValue(OFFLINE_BOX_PHOTO_PREFIX + item.id)
    if (typeof dataUrl !== 'string') continue
    try {
      photos.push({
        id: item.id,
        ownerId: item.ownerId || 'offline-session',
        ownerName: item.ownerName || '离线访客',
        imageBlob: offlineBoxBlobFromDataUrl(dataUrl),
        frameName: item.frameName || '拍立得',
        visibility: 'private',
        createdAt: item.createdAt || new Date().toISOString(),
        cloudSynced: false,
      })
    } catch (error) {
      // Skip a malformed image payload without hiding the other cached photos.
    }
  }
  return photos
}

const saveOfflineBoxPhoto = async (photo: PawCreamStoredPhoto): Promise<PawCreamStoredPhoto> => {
  const dataUrl = await offlineBoxDataUrlFromBlob(photo.imageBlob)
  const photoKey = OFFLINE_BOX_PHOTO_PREFIX + photo.id
  const index = await readOfflineBoxIndex()
  await writeOfflineBoxValue(photoKey, dataUrl)
  try {
    const metadata = {
      id: photo.id, ownerId: photo.ownerId, ownerName: photo.ownerName,
      frameName: photo.frameName, createdAt: photo.createdAt,
    }
    const next = [metadata, ...index.filter(item => item.id !== photo.id)]
      .slice(0, offlineBoxCacheLimit())
    await writeOfflineBoxValue(OFFLINE_BOX_INDEX_KEY, next)
    const retained = new Set(next.map(item => item.id))
    await Promise.all(index.filter(item => !retained.has(item.id)).map(item =>
      removeOfflineBoxValue(OFFLINE_BOX_PHOTO_PREFIX + item.id).catch(() => {})
    ))
    return { ...photo, imageBlob: offlineBoxBlobFromDataUrl(dataUrl) }
  } catch (error) {
    await removeOfflineBoxValue(photoKey).catch(() => {})
    throw error
  }
}

const saveBoxPhotoToAlbum = async (photo: PawCreamStoredPhoto) => {
  const api = (window as any).xhs && (window as any).xhs.miniTool
  if (!api || typeof api.saveImageToPhotosAlbum !== 'function') {
    throw new Error('当前小红书客户端暂不支持保存到相册')
  }
  const sourceUrl = URL.createObjectURL(photo.imageBlob)
  let image: HTMLImageElement
  try {
    image = await loadImage(sourceUrl)
  } finally {
    URL.revokeObjectURL(sourceUrl)
  }
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const context = canvas.getContext('2d')
  if (!context) throw new Error('无法准备相册图片')
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  const dataUrl = canvas.toDataURL('image/png')
  let filePath = dataUrl
  if (typeof api.writeTempFile === 'function') {
    const result = await api.writeTempFile({ data: dataUrl })
    if (result && result.filePath) filePath = result.filePath
  }
  await api.saveImageToPhotosAlbum({ filePath })
}

const deleteOfflineBoxPhoto = async (photoId: string) => {
  const index = await readOfflineBoxIndex()
  const next = index.filter(item => item.id !== photoId)
  await writeOfflineBoxValue(OFFLINE_BOX_INDEX_KEY, next)
  await removeOfflineBoxValue(OFFLINE_BOX_PHOTO_PREFIX + photoId).catch(() => {})
}
