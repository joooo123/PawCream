import { randomUUID } from 'node:crypto'
import OSS from 'ali-oss'
import CredentialsModule from '@alicloud/credentials'

export const PHOTO_STORAGE = (process.env.PHOTO_STORAGE || 'database').trim().toLowerCase()
export const OSS_AUTH_MODE = (process.env.OSS_AUTH_MODE || 'ecs_ram_role').trim().toLowerCase()
const OSS_BUCKET = (process.env.OSS_BUCKET || '').trim()
const OSS_REGION = (process.env.OSS_REGION || 'oss-cn-beijing').trim()
const OSS_ENDPOINT = (process.env.OSS_ENDPOINT || `https://${OSS_REGION}-internal.aliyuncs.com`).trim()

if (!['database', 'oss'].includes(PHOTO_STORAGE)) {
  throw new Error('PHOTO_STORAGE must be either database or oss')
}
if (PHOTO_STORAGE === 'oss' && !['ecs_ram_role', 'access_key'].includes(OSS_AUTH_MODE)) {
  throw new Error('OSS_AUTH_MODE must be ecs_ram_role or access_key')
}
if (PHOTO_STORAGE === 'oss' && OSS_AUTH_MODE === 'access_key' &&
    (!process.env.OSS_ACCESS_KEY_ID || !process.env.OSS_ACCESS_KEY_SECRET)) {
  throw new Error('OSS_ACCESS_KEY_ID and OSS_ACCESS_KEY_SECRET are required for OSS_AUTH_MODE=access_key')
}
if (PHOTO_STORAGE === 'oss' && !OSS_BUCKET) {
  throw new Error('OSS_BUCKET is required when PHOTO_STORAGE=oss')
}
if (PHOTO_STORAGE === 'oss' && !/^oss-[a-z0-9-]+$/.test(OSS_REGION)) {
  throw new Error('Invalid OSS_REGION')
}

let ossClientPromise

async function createOssClient() {
  // Light-weight application servers do not provide the ECS instance role attachment flow.
  // Use a dedicated, least-privilege RAM programmatic user when OSS_AUTH_MODE=access_key.
  // These values must only be supplied via server-side secrets, never source control.
  if (OSS_AUTH_MODE === 'access_key') {
    return new OSS({
      region: OSS_REGION,
      bucket: OSS_BUCKET,
      endpoint: OSS_ENDPOINT,
      authorizationV4: true,
      accessKeyId: process.env.OSS_ACCESS_KEY_ID,
      accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
    })
  }

  // ECS instances can use an attached RAM role with auto-refreshed STS credentials.

  const roleName = (process.env.OSS_ECS_ROLE_NAME || '').trim()
  // Support the CommonJS/ESM export shapes used by the official credentials package.
  const Credential = CredentialsModule.default || CredentialsModule
  const credentialClient = new Credential({
    type: 'ecs_ram_role',
    ...(roleName ? { roleName } : {}),
    disableIMDSv1: true,
  })
  const initial = await credentialClient.getCredential()
  return new OSS({
    region: OSS_REGION,
    bucket: OSS_BUCKET,
    endpoint: OSS_ENDPOINT,
    authorizationV4: true,
    accessKeyId: initial.accessKeyId,
    accessKeySecret: initial.accessKeySecret,
    stsToken: initial.securityToken,
    refreshSTSTokenInterval: 0,
    refreshSTSToken: async () => {
      const current = await credentialClient.getCredential()
      return {
        accessKeyId: current.accessKeyId,
        accessKeySecret: current.accessKeySecret,
        stsToken: current.securityToken,
      }
    },
  })
}

async function getOssClient() {
  if (PHOTO_STORAGE !== 'oss') {
    throw new Error('OSS photo storage is not enabled')
  }
  if (!ossClientPromise) {
    ossClientPromise = createOssClient().catch((error) => {
      ossClientPromise = undefined
      throw error
    })
  }
  return ossClientPromise
}

export function newPublicPhotoKey(userId, mimeType) {
  const suffix = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[mimeType]
  if (!suffix || !/^[a-f0-9-]{36}$/i.test(userId)) {
    throw new Error('Invalid photo owner or content type')
  }
  return 'public/' + userId + '/' + randomUUID() + '.' + suffix
}

export function newPrivatePhotoKey(userId, mimeType) {
  const suffix = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[mimeType]
  if (!suffix || !/^[a-f0-9-]{36}$/i.test(userId)) {
    throw new Error('Invalid private photo owner or content type')
  }
  return 'private/' + userId + '/' + randomUUID() + '.' + suffix
}

export async function putPublicPhoto(key, bytes, mimeType) {
  const client = await getOssClient()
  await client.put(key, bytes, {
    headers: {
      'Content-Type': mimeType,
      'Cache-Control': 'private, no-store',
    },
  })
}

export async function readPublicPhoto(key) {
  const client = await getOssClient()
  const result = await client.get(key)
  return result.content
}

export async function deletePublicPhoto(key) {
  const client = await getOssClient()
  await client.delete(key)
}
