import { useCallback } from 'react'
import { errorMessage } from '../portal/api'
import { useT } from './PreferencesProvider'

/**
 * `errorMessage` for a translated page. The server's message is shown as it is (the API answers
 * in English); the two sentences the client words itself, for a request that never reached the
 * server and for a failure with no message, follow the chosen language.
 */
export function useErrorMessage(): (error: unknown) => string {
  const t = useT()
  return useCallback(
    (error) => errorMessage(error, t('ui.error.generic'), t('ui.error.unreachable')),
    [t],
  )
}
