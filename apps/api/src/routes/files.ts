import { Hono } from 'hono'
import type { Deps } from '../deps'
import { errors } from '../lib/errors'
import type { AppEnv } from '../middleware/auth'
import { assertSafeKey, isPublicKey, LocalDiskStorage } from '../providers/storage'

/**
 * Serves `public/` keys from any storage driver (cacheable), and signed private files for the
 * local driver. With S3, private files are read through presigned bucket URLs instead.
 */
export const filesRoutes = (deps: Deps) =>
  new Hono<AppEnv>().get('/*', async (c) => {
    const key = decodeURIComponent(c.req.path.replace(/^\/api\/files\//, ''))
    try {
      assertSafeKey(key)
    } catch {
      throw errors.badRequest('bad_key', 'Invalid file path')
    }
    const storage = deps.storage
    if (!isPublicKey(key)) {
      if (!(storage instanceof LocalDiskStorage)) throw errors.notFound('File')
      if (!storage.verifyFileSignature(key, c.req.query('exp'), c.req.query('sig'))) {
        throw errors.forbidden('This file link is invalid or has expired')
      }
    }
    const object = await storage.get(key)
    if (!object) throw errors.notFound('File')
    c.header('Content-Type', object.mimeType)
    c.header('Content-Length', String(object.size))
    c.header(
      'Cache-Control',
      isPublicKey(key) ? 'public, max-age=31536000, immutable' : 'private, no-store',
    )
    return c.body(object.body)
  })
