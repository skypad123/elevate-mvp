import { createUploadSchema } from '@elevate/core'
import { Hono } from 'hono'
import type { Deps } from '../deps'
import { errors } from '../lib/errors'
import { validate } from '../lib/validate'
import { type AppEnv, ensureUser, requireUser } from '../middleware/auth'
import { LocalDiskStorage } from '../providers/storage'
import { MediaService } from '../services/media.service'

export const mediaRoutes = (deps: Deps) => {
  const media = new MediaService(deps)
  return (
    new Hono<AppEnv>()
      .post('/uploads', requireUser(), validate('json', createUploadSchema), async (c) => {
        const result = await media.createUpload(ensureUser(c.get('user')), c.req.valid('json'))
        return c.json(result, 200)
      })
      // Local storage driver only: the signed upload target returned by POST /uploads points here.
      .put('/uploads/:id/file', async (c) => {
        const storage = deps.storage
        if (!(storage instanceof LocalDiskStorage)) throw errors.notFound('Upload endpoint')
        const id = c.req.param('id')
        if (!storage.verifyUploadSignature(id, c.req.query('exp'), c.req.query('sig'))) {
          throw errors.forbidden('This upload link is invalid or has expired')
        }
        const body = c.req.raw.body
        if (!body) throw errors.badRequest('empty_body', 'No file received')
        const asset = await media.receiveLocalUpload(id, body)
        return c.json({ asset }, 200)
      })
      .post('/assets/:id/complete', requireUser(), async (c) => {
        const asset = await media.complete(ensureUser(c.get('user')), c.req.param('id'))
        return c.json({ asset }, 200)
      })
      .get('/assets/:id', requireUser(), async (c) => {
        const asset = await media.getAsset(ensureUser(c.get('user')), c.req.param('id'))
        return c.json({ asset }, 200)
      })
      .get('/assets/:id/playback', requireUser(), async (c) => {
        const playback = await media.playback(ensureUser(c.get('user')), c.req.param('id'))
        return c.json({ playback }, 200)
      })
  )
}
