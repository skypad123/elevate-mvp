import { bigint, index, integer, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { users } from './auth'
import { createdAt, id, updatedAt } from './columns'
import { mediaKindEnum, mediaProviderEnum, mediaStatusEnum } from './enums'

export const mediaAssets = pgTable(
  'media_assets',
  {
    id: id(),
    ownerId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
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
  (t) => [index().on(t.ownerId), index().on(t.providerUploadId), index().on(t.providerAssetId)],
)
