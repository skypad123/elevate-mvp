import type { Env } from '../../env'
import { LocalDiskStorage } from './local-disk'
import type { StorageProvider } from './types'

export * from './fake'
export * from './local-disk'
export * from './types'

export function createStorage(env: Env): StorageProvider {
  if (env.STORAGE_DRIVER === 's3') {
    // Added in Phase 3 (S3/R2 presigned uploads). Fail loudly rather than silently writing to disk.
    throw new Error('STORAGE_DRIVER=s3 is not available yet; use local')
  }
  return new LocalDiskStorage(env.storageLocalDir, env.API_URL, env.SESSION_SECRET, !env.isProd)
}
