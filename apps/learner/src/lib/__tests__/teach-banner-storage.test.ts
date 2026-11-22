import AsyncStorage from '@react-native-async-storage/async-storage'
import {
  readDismissedAt,
  TEACH_BANNER_STORAGE_KEY,
  writeDismissedAt,
} from '@/lib/teach-banner-storage'

// The official mock's methods are jest.fn()s; call them directly. Do not jest.spyOn/mockRestore
// them: spyOn returns the existing mock and mockRestore would erase its implementation.
const mocked = AsyncStorage as unknown as Record<'getItem' | 'setItem', jest.Mock>

beforeEach(async () => {
  await AsyncStorage.clear()
})

describe('the Teach banner dismissal storage', () => {
  it('reads back the time it wrote, under its key', async () => {
    await writeDismissedAt(1_800_000_000_000)
    expect(await AsyncStorage.getItem(TEACH_BANNER_STORAGE_KEY)).toBe('1800000000000')
    expect(await readDismissedAt()).toBe(1_800_000_000_000)
  })

  it('reads null when nothing is stored', async () => {
    expect(await readDismissedAt()).toBeNull()
  })

  it('reads a stored value that is not a number as null', async () => {
    await AsyncStorage.setItem(TEACH_BANNER_STORAGE_KEY, 'yesterday')
    expect(await readDismissedAt()).toBeNull()
    await AsyncStorage.setItem(TEACH_BANNER_STORAGE_KEY, '')
    expect(await readDismissedAt()).toBeNull()
  })

  it('reads a failed read as null', async () => {
    mocked.getItem.mockRejectedValueOnce(new Error('storage unavailable'))
    expect(await readDismissedAt()).toBeNull()
  })

  it('ignores a failed write', async () => {
    mocked.setItem.mockRejectedValueOnce(new Error('storage full'))
    await expect(writeDismissedAt(1)).resolves.toBeUndefined()
  })
})
