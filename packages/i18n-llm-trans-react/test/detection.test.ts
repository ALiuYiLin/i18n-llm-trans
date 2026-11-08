import { describe, expect, it } from 'vitest'
import { detectLocale, matchLocale } from '../src/core/detection'
import type { DetectionContext } from '../src/core/detection'
import type { StorageLike } from '../src/types'

const supportedLocales = ['zh-CN', 'en-US']

const baseContext: DetectionContext = {
  supportedLocales,
  defaultLocale: 'zh-CN',
  order: ['storage', 'browser', 'default'],
  storage: null,
  storageKey: null,
  navigatorLanguages: [],
}

function storageWith(value: string | null): StorageLike {
  return {
    getItem: () => value,
    setItem: () => undefined,
  }
}

describe('matchLocale', () => {
  it('matches exact tags case-insensitively', () => {
    expect(matchLocale('en-US', supportedLocales)).toBe('en-US')
    expect(matchLocale('EN-us', supportedLocales)).toBe('en-US')
  })

  it('matches by primary subtag', () => {
    expect(matchLocale('zh-Hans-CN', supportedLocales)).toBe('zh-CN')
    expect(matchLocale('en-GB', supportedLocales)).toBe('en-US')
    expect(matchLocale('ja-JP', supportedLocales)).toBeUndefined()
  })

  it('supports a custom normalizer', () => {
    const normalize = (raw: string) => (raw === 'zh-Hant' ? 'zh-CN' : undefined)
    expect(matchLocale('zh-Hant', supportedLocales, normalize)).toBe('zh-CN')
  })

  it('returns undefined for empty input', () => {
    expect(matchLocale(null, supportedLocales)).toBeUndefined()
    expect(matchLocale('   ', supportedLocales)).toBeUndefined()
  })
})

describe('detectLocale', () => {
  it('prefers a stored preference', () => {
    const result = detectLocale({
      ...baseContext,
      storage: storageWith('en-US'),
      storageKey: 'locale',
      navigatorLanguages: ['zh-CN'],
    })
    expect(result).toEqual({ locale: 'en-US', source: 'storage' })
  })

  it('falls back to the browser when storage is invalid', () => {
    const result = detectLocale({
      ...baseContext,
      storage: storageWith('fr-FR'),
      storageKey: 'locale',
      navigatorLanguages: ['en-GB'],
    })
    expect(result).toEqual({ locale: 'en-US', source: 'browser' })
  })

  it('uses the default locale when nothing matches', () => {
    const result = detectLocale({ ...baseContext, navigatorLanguages: ['fr-FR'] })
    expect(result).toEqual({ locale: 'zh-CN', source: 'default' })
  })

  it('respects a custom detection order', () => {
    const result = detectLocale({
      ...baseContext,
      order: ['browser', 'storage', 'default'],
      storage: storageWith('zh-CN'),
      storageKey: 'locale',
      navigatorLanguages: ['en-US'],
    })
    expect(result).toEqual({ locale: 'en-US', source: 'browser' })
  })
})
