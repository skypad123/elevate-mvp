/**
 * The phone's languages as the `expo-localization` mock in `jest.setup.ts` reports them. English
 * by default, so screens render in English unless a test says otherwise; reset after every test.
 */
const DEFAULT = ['en-SG']

type MockLocale = { languageTag: string; languageCode: string | null }

const state = { tags: DEFAULT as readonly string[] }

export function setMockDeviceLanguages(tags: readonly string[]): void {
  state.tags = tags
}

export function resetMockDeviceLanguages(): void {
  state.tags = DEFAULT
}

export function mockLocales(): MockLocale[] {
  return state.tags.map((languageTag) => ({
    languageTag,
    languageCode: languageTag.split('-')[0] ?? null,
  }))
}
