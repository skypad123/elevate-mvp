import type { Env } from '../../env'
import type { StorageProvider } from '../storage'
import { LocalVideoProvider } from './local'
import { MuxVideoProvider } from './mux'
import type { VideoProvider } from './types'

export * from './fake'
export * from './local'
export * from './mux'
export * from './types'

export function createVideoProvider(env: Env, storage: StorageProvider): VideoProvider {
  if (env.VIDEO_DRIVER === 'mux') {
    const missing = (
      ['MUX_TOKEN_ID', 'MUX_TOKEN_SECRET', 'MUX_SIGNING_KEY', 'MUX_PRIVATE_KEY'] as const
    ).filter((k) => !env[k])
    if (missing.length) throw new Error(`VIDEO_DRIVER=mux requires ${missing.join(', ')}`)
    return new MuxVideoProvider({
      tokenId: env.MUX_TOKEN_ID as string,
      tokenSecret: env.MUX_TOKEN_SECRET as string,
      webhookSecret: env.MUX_WEBHOOK_SECRET,
      signingKeyId: env.MUX_SIGNING_KEY as string,
      signingPrivateKey: env.MUX_PRIVATE_KEY as string,
      testMode: !env.isProd,
    })
  }
  return new LocalVideoProvider(storage)
}
