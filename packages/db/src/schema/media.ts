import {
  type AnyPgColumn,
  bigint,
  index,
  integer,
  snakeCase,
  text,
  uuid,
} from 'drizzle-orm/pg-core'
import { users } from './auth'
import { createdAt, id, updatedAt } from './columns'
import { mediaKindEnum, mediaProviderEnum, mediaStatusEnum } from './enums'
import { profiles } from './profiles'

export const mediaAssets = snakeCase.table(
  'media_assets',
  {
    id: id(),
    /** Who uploaded it. Kept when the user is deleted, so course media outlives its uploader. */
    uploaderId: uuid().references(() => users.id, { onDelete: 'set null' }),
    /** Set for a profile's course media; empty for learner avatars and teaching samples. */
    profileId: uuid().references((): AnyPgColumn => profiles.id, { onDelete: 'restrict' }),
    kind: mediaKindEnum().notNull(),
    provider: mediaProviderEnum().notNull(),
    status: mediaStatusEnum().notNull().default('pending'),
    /** Mux direct-upload id, or null for storage uploads. */
    providerUploadId: text(),
    /** Mux asset id. */
    providerAssetId: text(),
    /** Mux signed playback id. */
    playbackId: text(),
    /** Storage object key for local/S3 files. */
    storageKey: text(),
    filename: text().notNull(),
    mimeType: text().notNull(),
    sizeBytes: bigint({ mode: 'number' }),
    durationSeconds: integer(),
    width: integer(),
    height: integer(),
    errorMessage: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index().on(t.uploaderId),
    index().on(t.profileId),
    index().on(t.providerUploadId),
    index().on(t.providerAssetId),
  ],
)
