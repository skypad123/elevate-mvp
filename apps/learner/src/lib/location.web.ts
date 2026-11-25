import type { CheckInLocation } from '@elevate/core'

/** No reading within this long counts as `unavailable`, the permission prompt included. */
export const LOCATION_LIMIT_MS = 10_000

/** `GeolocationPositionError.PERMISSION_DENIED`. */
const PERMISSION_DENIED = 1

/**
 * One reading from the browser's own `navigator.geolocation`, for a check-in. A refusal answers
 * `denied`; an error, a browser without geolocation, or no answer within 10 seconds answers
 * `unavailable`. It never throws: location is evidence and never blocks a check-in.
 */
export function readLocation(): Promise<CheckInLocation> {
  return new Promise((resolve) => {
    const geolocation = typeof navigator === 'undefined' ? undefined : navigator.geolocation
    if (!geolocation) {
      resolve({ status: 'unavailable' })
      return
    }
    let settled = false
    const settle = (value: CheckInLocation) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(value)
    }
    // The browser's own `timeout` starts only once permission is given, so this one covers both.
    const timer = setTimeout(() => settle({ status: 'unavailable' }), LOCATION_LIMIT_MS)
    try {
      geolocation.getCurrentPosition(
        (position) =>
          settle({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            accuracyM: position.coords.accuracy,
          }),
        (error) => settle({ status: error.code === PERMISSION_DENIED ? 'denied' : 'unavailable' }),
        { enableHighAccuracy: true, maximumAge: 0, timeout: LOCATION_LIMIT_MS },
      )
    } catch {
      settle({ status: 'unavailable' })
    }
  })
}
