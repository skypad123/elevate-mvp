import AsyncStorage from '@react-native-async-storage/async-storage'
import { runStorageMigrations } from '../store-utils'

describe('Storage Migrations', () => {
  beforeEach(async () => {
    // Clear AsyncStorage before each test
    await AsyncStorage.clear()
  })

  it('should migrate @elvate/planner to @elevate/planner', async () => {
    const oldKey = '@elvate/planner'
    const newKey = '@elevate/planner'
    const testData = JSON.stringify({ courses: [], tasks: [] })

    // Set up old misspelled key
    await AsyncStorage.setItem(oldKey, testData)

    // Run migration
    await runStorageMigrations()

    // Verify new key has the data
    const newData = await AsyncStorage.getItem(newKey)
    expect(newData).toBe(testData)

    // Verify old key is removed
    const oldData = await AsyncStorage.getItem(oldKey)
    expect(oldData).toBeNull()
  })

  it('should not fail if old key does not exist', async () => {
    // Run migration when old key doesn't exist
    await expect(runStorageMigrations()).resolves.not.toThrow()
  })

  it('should only run migration once', async () => {
    const oldKey = '@elvate/planner'
    const testData = JSON.stringify({ courses: [], tasks: [] })

    // Set up old key
    await AsyncStorage.setItem(oldKey, testData)

    // Run migration first time
    await runStorageMigrations()

    // Add the old key back (simulating if it was added after migration)
    await AsyncStorage.setItem(oldKey, testData)

    // Run migration second time
    await runStorageMigrations()

    // Old key should still exist (migration shouldn't run again)
    const oldData = await AsyncStorage.getItem(oldKey)
    expect(oldData).toBe(testData)
  })
})
