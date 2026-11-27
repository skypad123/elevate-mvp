// Jest resolves the native module by default; this test loads the web one by its own name.
import { LOCATION_LIMIT_MS, readLocation } from '@/lib/location.web'

type Success = (position: {
  coords: { latitude: number; longitude: number; accuracy: number }
}) => void
type Failure = (error: { code: number }) => void

const getCurrentPosition = jest.fn<void, [Success, Failure, unknown]>()

beforeEach(() => {
  getCurrentPosition.mockReset()
  Object.defineProperty(navigator, 'geolocation', {
    value: { getCurrentPosition },
    configurable: true,
  })
})
afterEach(() => {
  Reflect.deleteProperty(navigator, 'geolocation')
  jest.useRealTimers()
})

describe('readLocation (web)', () => {
  it('answers the browser’s reading', async () => {
    getCurrentPosition.mockImplementation((success) =>
      success({ coords: { latitude: 1.3521, longitude: 103.8198, accuracy: 25 } }),
    )
    await expect(readLocation()).resolves.toEqual({ lat: 1.3521, lng: 103.8198, accuracyM: 25 })
    expect(getCurrentPosition).toHaveBeenCalledTimes(1)
  })

  it('answers `denied` when the learner refuses', async () => {
    getCurrentPosition.mockImplementation((_, failure) => failure({ code: 1 }))
    await expect(readLocation()).resolves.toEqual({ status: 'denied' })
  })

  it('answers `unavailable` when the browser fails to read one', async () => {
    getCurrentPosition.mockImplementation((_, failure) => failure({ code: 2 }))
    await expect(readLocation()).resolves.toEqual({ status: 'unavailable' })
  })

  it('answers `unavailable` when nothing comes within 10 seconds, the prompt included', async () => {
    jest.useFakeTimers()
    getCurrentPosition.mockImplementation(() => {})
    const reading = readLocation()
    jest.advanceTimersByTime(LOCATION_LIMIT_MS - 1)
    let settled = false
    void reading.then(() => {
      settled = true
    })
    await Promise.resolve()
    expect(settled).toBe(false)
    jest.advanceTimersByTime(1)
    await expect(reading).resolves.toEqual({ status: 'unavailable' })
    expect(LOCATION_LIMIT_MS).toBe(10_000)
  })

  it('keeps the first answer when a reading comes after the limit', async () => {
    jest.useFakeTimers()
    let late: Success = () => {}
    getCurrentPosition.mockImplementation((success) => {
      late = success
    })
    const reading = readLocation()
    jest.advanceTimersByTime(LOCATION_LIMIT_MS)
    late({ coords: { latitude: 1, longitude: 2, accuracy: 3 } })
    await expect(reading).resolves.toEqual({ status: 'unavailable' })
  })
})
