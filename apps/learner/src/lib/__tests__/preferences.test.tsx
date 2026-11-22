import { defaultPreferences, PREFERENCES_STORAGE_KEY } from '@elevate/core'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { Platform, Pressable, Text, useColorScheme } from 'react-native'
import { PreferencesProvider, usePreferences } from '@/lib/preferences'
import { preferencesStorage } from '@/lib/preferences-storage'
import { setMockDeviceLanguages } from '@/test-utils/device-languages'
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider'

/** Renders provider state as text so tests can read it, and exposes a setter button. */
function Probe() {
  const { preferences, ready, setPreference, locale, setAccountLocale, t } = usePreferences()
  const theme = useTheme()
  return (
    <>
      <Text testID="ready">{String(ready)}</Text>
      <Text testID="theme">{preferences.theme}</Text>
      <Text testID="locale">{preferences.locale}</Text>
      <Text testID="resolved">{locale}</Text>
      <Text testID="scheme">{theme.scheme}</Text>
      <Text testID="system">{useColorScheme() ?? 'null'}</Text>
      <Text testID="label">{t('nav.settings')}</Text>
      <Pressable testID="go-dark" onPress={() => setPreference('theme', 'dark')} />
      <Pressable testID="go-zh" onPress={() => setPreference('locale', 'zh')} />
      <Pressable testID="go-light" onPress={() => setPreference('theme', 'light')} />
      <Pressable testID="go-system" onPress={() => setPreference('locale', 'system')} />
      <Pressable testID="account-zh" onPress={() => setAccountLocale('zh')} />
      <Pressable testID="account-none" onPress={() => setAccountLocale(null)} />
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

const press = (id: string) =>
  act(async () => {
    fireEvent.press(screen.getByTestId(id))
  })
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

describe('the resolved locale', () => {
  it('follows an English phone under "system"', async () => {
    setMockDeviceLanguages(['en-SG', 'zh-SG'])
    await renderApp()
    await waitFor(() => expect(text('ready')).toBe('true'))
    expect(text('locale')).toBe('system')
    expect(text('resolved')).toBe('en')
    expect(text('label')).toBe('Settings')
  })

  it('follows a Chinese phone on first launch, Traditional included, without storing it', async () => {
    setMockDeviceLanguages(['zh-Hant-TW', 'en'])
    await renderApp()
    await waitFor(() => expect(text('ready')).toBe('true'))
    expect(text('resolved')).toBe('zh')
    expect(text('label')).toBe('设置')
    expect(JSON.parse((await AsyncStorage.getItem(PREFERENCES_STORAGE_KEY)) ?? '{}').locale).toBe(
      'system',
    )
  })

  it('keeps a stored English on a Chinese phone', async () => {
    setMockDeviceLanguages(['zh-CN'])
    await seed('{"locale":"en"}')
    await renderApp()
    await waitFor(() => expect(text('ready')).toBe('true'))
    expect(text('resolved')).toBe('en')
  })

  it('follows a stored choice over the account', async () => {
    await seed('{"locale":"en"}')
    await renderApp()
    await waitFor(() => expect(text('ready')).toBe('true'))
    await press('account-zh')
    expect(text('resolved')).toBe('en')
    await press('go-zh')
    expect(text('resolved')).toBe('zh')
  })

  it('follows the account under "system" until it is cleared, without storing it', async () => {
    await renderApp()
    await waitFor(() => expect(text('ready')).toBe('true'))
    await press('account-zh')
    expect(text('locale')).toBe('system')
    expect(text('resolved')).toBe('zh')
    expect(text('label')).toBe('设置')
    await press('account-none')
    expect(text('resolved')).toBe('en')
    expect(JSON.parse((await AsyncStorage.getItem(PREFERENCES_STORAGE_KEY)) ?? '{}').locale).toBe(
      'system',
    )
  })
})

describe('the resolved locale on web', () => {
  let restoreOS: () => void = () => {}
  const setWeb = (search: string, languages: readonly string[]) => {
    restoreOS = jest.replaceProperty(Platform, 'OS', 'web').restore
    Object.defineProperty(window, 'location', { value: { search }, configurable: true })
    // Jest resolves the native modules, so the browser's languages come through the same mock.
    setMockDeviceLanguages(languages)
  }

  afterEach(() => {
    restoreOS()
    Reflect.deleteProperty(window, 'location')
  })

  it('guesses from the browser languages', async () => {
    setWeb('', ['zh-TW', 'en'])
    await renderApp()
    await waitFor(() => expect(text('ready')).toBe('true'))
    expect(text('resolved')).toBe('zh')
  })

  it('uses ?lang over the browser, never stores it, and keeps it after the URL changes', async () => {
    setWeb('?lang=zh', ['en-SG'])
    await renderApp()
    await waitFor(() => expect(text('ready')).toBe('true'))
    expect(text('resolved')).toBe('zh')
    Object.defineProperty(window, 'location', { value: { search: '' }, configurable: true })
    await press('go-dark')
    expect(text('resolved')).toBe('zh')
    expect(JSON.parse((await AsyncStorage.getItem(PREFERENCES_STORAGE_KEY)) ?? '{}').locale).toBe(
      'system',
    )
  })

  it('lets a stored choice beat ?lang', async () => {
    setWeb('?lang=zh', [])
    await seed('{"locale":"en"}')
    await renderApp()
    await waitFor(() => expect(text('ready')).toBe('true'))
    expect(text('resolved')).toBe('en')
    await press('go-system')
    expect(text('resolved')).toBe('zh')
  })

  it('lets a chosen account beat ?lang', async () => {
    setWeb('?lang=en', [])
    await renderApp()
    await waitFor(() => expect(text('ready')).toBe('true'))
    expect(text('resolved')).toBe('en')
    await press('account-zh')
    expect(text('resolved')).toBe('zh')
  })

  it('ignores an unsupported ?lang', async () => {
    setWeb('?lang=klingon', ['en'])
    await renderApp()
    await waitFor(() => expect(text('ready')).toBe('true'))
    expect(text('resolved')).toBe('en')
  })
})
