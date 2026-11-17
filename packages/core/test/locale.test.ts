import { describe, expect, it } from 'vitest'
import { isChosen, resolveLocale } from '../src/domain/locale'

describe('resolveLocale', () => {
  it('lets a stored choice win over the account, ?lang and the device', () => {
    expect(
      resolveLocale({ stored: 'en', account: 'zh', param: 'zh', deviceLanguages: ['zh-CN'] }),
    ).toBe('en')
    expect(resolveLocale({ stored: 'zh', deviceLanguages: ['en-SG'] })).toBe('zh')
  })

  it('uses the account next, over ?lang and the device', () => {
    expect(
      resolveLocale({ stored: 'system', account: 'zh', param: 'en', deviceLanguages: ['en-SG'] }),
    ).toBe('zh')
  })

  it('uses a valid ?lang before the device', () => {
    expect(resolveLocale({ stored: 'system', param: 'zh', deviceLanguages: ['en-SG'] })).toBe('zh')
    expect(resolveLocale({ stored: 'system', param: 'fr', deviceLanguages: ['en-SG'] })).toBe('en')
    expect(resolveLocale({ stored: 'system', param: null, deviceLanguages: ['zh'] })).toBe('zh')
  })

  it('ignores a null account', () => {
    expect(resolveLocale({ stored: 'system', account: null, deviceLanguages: ['zh-SG'] })).toBe(
      'zh',
    )
  })

  it.each([
    [['zh-TW'], 'zh'],
    [['zh-Hant-HK'], 'zh'],
    [['zh'], 'zh'],
    [['ZH-sg'], 'zh'],
    [['zh-SG', 'en'], 'zh'],
    [['en-SG', 'zh-CN'], 'en'],
    [['ms-MY'], 'en'],
    [[], 'en'],
  ] as const)('reads only the first device language: %j gives %s', (deviceLanguages, want) => {
    expect(resolveLocale({ stored: 'system', deviceLanguages })).toBe(want)
  })
})

describe('isChosen', () => {
  it('is true for a stored language and false for system', () => {
    expect(isChosen('en')).toBe(true)
    expect(isChosen('zh')).toBe(true)
    expect(isChosen('system')).toBe(false)
  })
})
