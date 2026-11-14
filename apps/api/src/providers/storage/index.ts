import type { Env } from '../../env'
import { LocalDiskStorage } from './local-disk'
import { createS3Storage } from './s3'
import type { StorageProvider } from './types'

export * from './fake'
export * from './local-disk'
export * from './s3'
export * from './types'

export function createStorage(env: Env): StorageProvider {
  if (env.STORAGE_DRIVER === 's3') return createS3Storage(env)
  return new LocalDiskStorage(env.storageLocalDir, env.API_URL, env.SESSION_SECRET, !env.isProd)
}
