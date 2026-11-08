import { useAuthStore } from './auth-store'
import { runStorageMigrations } from './migrations'
import { usePlannerStore } from './planner-store'
import { useProfileStore } from './profile-store'

/**
 * Brings every persisted store to its hydrated state: runs the one-time storage
 * migrations first, then rehydrates all stores in parallel. The stores are
 * created with `skipHydration: true`, so nothing reads storage before the
 * migrations have finished.
 *
 * Never rejects: a failure is logged and the affected store keeps its initial
 * state, so the root layout can always render.
 *
 * Deliberately not memoised. In development, Fast Refresh re-creates a store
 * whose module changed (back to its initial, un-hydrated state) and re-runs the
 * root layout's effect, which calls this again. Repeated runs are harmless
 * because every migration step is idempotent.
 */
export async function bootstrapStores(): Promise<void> {
  try {
    await runStorageMigrations()
    await Promise.all([
      useAuthStore.persist.rehydrate(),
      useProfileStore.persist.rehydrate(),
      usePlannerStore.persist.rehydrate(),
    ])
  } catch (error) {
    console.error('Error bootstrapping stores:', error)
  }
}
