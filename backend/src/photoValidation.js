const photoTypes = new Set(['image/png', 'image/jpeg', 'image/webp'])
const MAX_PHOTO_BYTES = 3 * 1024 * 1024

export function validPhotoBytes(bytes, type) {
  if (!photoTypes.has(type) || !Buffer.isBuffer(bytes) || !bytes.length || bytes.length > MAX_PHOTO_BYTES) return false
  if (type === 'image/png') return bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  if (type === 'image/jpeg') return bytes.length > 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
  if (type === 'image/webp') return bytes.length > 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP'
  return false
}
