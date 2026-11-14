import { defaultPreferences, PREFERENCES_STORAGE_KEY } from '@elevate/core'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { Pressable, Text, useColorScheme } from 'react-native'
import { PreferencesProvider, usePreferences } from '@/lib/preferences'
import { preferencesStorage } from '@/lib/preferences-storage'
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider'

/** Renders provider state as text so tests can read it, and exposes a setter button. */
function Probe() {
  const { preferences, ready, setPreference, t } = usePreferences()
  const theme = useTheme()
  return (
    <>
      <Text testID="ready">{String(ready)}</Text>
      <Text testID="theme">{preferences.theme}</Text>
      <Text testID="locale">{preferences.locale}</Text>
      <Text testID="scheme">{theme.scheme}</Text>
      <Text testID="system">{useColorScheme() ?? 'null'}</Text>
      <Text testID="label">{t('nav.settings')}</Text>
      <Pressable testID="go-dark" onPress={() => setPreference('theme', 'dark')} />
      <Pressable testID="go-zh" onPress={() => setPreference('locale', 'zh')} />
      <Pressable testID="go-light" onPress={() => setPreference('theme', 'light')} />
    </>
  )
}

function renderApp() {
  return render(
    <PreferencesProvider>
      <ThemeProvider>
        <Probe />
      </ThemeProvider>
    </PreferencesProvider>,
  )
}

const text = (id: string) => screen.getByTestId(id).props.children as string
const seed = (value: string) => AsyncStorage.setItem(PREFERENCES_STORAGE_KEY, value)
// The official mock's methods are jest.fn()s; call them directly. Do not jest.spyOn/mockRestore them:
// spyOn returns the existing mock and mockRestore would erase its implementation.
const mocked = AsyncStorage as unknown as Record<'getItem' | 'setItem', jest.Mock>

// Note: no jest.restoreAllMocks() here. In Jest 29 it also resets the implementations of the
// AsyncStorage mock's jest.fn()s, which silently breaks storage for later tests.
beforeEach(async () => {
  await AsyncStorage.clear()
})

describe('preferencesStorage (native, AsyncStorage)', () => {
  it('has no synchronous source, so the provider must wait for read()', () => {
    expect(preferencesStorage.readSync()).toBeNull()
  })

  it('reads what was stored and falls back to defaults for garbage', async () => {
    await seed('{"theme":"dark","locale":"zh"}')
    expect(await preferencesStorage.read()).toEqual({ theme: 'dark', locale: 'zh' })
    await seed('{nope')
    expect(await preferencesStorage.read()).toEqual(defaultPreferences)
  })

  it('never throws when AsyncStorage fails', async () => {
    mocked.getItem.mockRejectedValueOnce(new Error('disk'))
    await expect(preferencesStorage.read()).resolves.toEqual(defaultPreferences)
    mocked.setItem.mockRejectedValueOnce(new Error('disk'))
    await expect(preferencesStorage.write({ theme: 'dark', locale: 'en' })).resolves.toBeUndefined()
  })
})

describe('PreferencesProvider on native', () => {
  it('starts not ready while AsyncStorage is still reading, then applies the stored preferences', async () => {
    // Hold the read open so the gate is observable (RNTL's render awaits settled effects).
    let release: (value: string) => void = () => {}
    mocked.getItem.mockReturnValueOnce(new Promise<string>((resolve) => (release = resolve)))
    await renderApp()
    expect(text('ready')).toBe('false')
    await act(async () => release('{"theme":"dark","locale":"zh"}'))
    await waitFor(() => expect(text('ready')).toBe('true'))
    expect(text('theme')).toBe('dark')
    expect(text('locale')).toBe('zh')
    expect(text('label')).toBe('设置')
  })

  it('becomes ready with defaults when nothing is stored', async () => {
    await renderApp()
    await waitFor(() => expect(text('ready')).toBe('true'))
    expect(text('theme')).toBe(defaultPreferences.theme)
    expect(text('locale')).toBe(defaultPreferences.locale)
  })

  it('becomes ready with defaults when the stored value is garbage (no stuck splash)', async () => {
    await seed('[1,2,3]')
    await renderApp()
    await waitFor(() => expect(text('ready')).toBe('true'))
    expect(text('theme')).toBe('system')
  })

  it('becomes ready with defaults when the read fails (no stuck splash)', async () => {
    mocked.getItem.mockRejectedValueOnce(new Error('disk'))
    await renderApp()
    await waitFor(() => expect(text('ready')).toBe('true'))
    expect(text('theme')).toBe('system')
  })

  it('persists changes to AsyncStorage', async () => {
    await renderApp()
    await waitFor(() => expect(text('ready')).toBe('true'))
    await act(async () => {
      fireEvent.press(screen.getByTestId('go-dark'))
    })
    await act(async () => {
      fireEvent.press(screen.getByTestId('go-zh'))
    })
    await waitFor(async () =>
      expect(JSON.parse((await AsyncStorage.getItem(PREFERENCES_STORAGE_KEY)) ?? '{}')).toEqual({
        theme: 'dark',
        locale: 'zh',
      }),
    )
    expect(text('label')).toBe('设置')
  })
})

describe('ThemeProvider', () => {
  it('follows the OS under "system"', async () => {
    await renderApp()
    await waitFor(() => expect(text('ready')).toBe('true'))
    const system = text('system') === 'dark' ? 'dark' : 'light'
    expect(text('scheme')).toBe(system)
  })

  it('obeys an explicit choice regardless of the OS', async () => {
    await seed('{"theme":"dark"}')
    await renderApp()
    await waitFor(() => expect(text('ready')).toBe('true'))
    expect(text('scheme')).toBe('dark')
    await act(async () => {
      fireEvent.press(screen.getByTestId('go-light'))
    })
    expect(text('scheme')).toBe('light')
  })
})
