import { createI18n } from 'vue-i18n'
import enUS from '../locales/en-US.json'
import zhCN from '../locales/zh-CN.json'

/** Locales shipped with this playground. Add a locale here and in `messages`. */
export const SUPPORTED_LOCALES = ['en-US', 'zh-CN'] as const
export type AppLocale = (typeof SUPPORTED_LOCALES)[number]
export type LocaleDetectionSource = 'storage' | 'browser' | 'default'

export const DEFAULT_LOCALE: AppLocale = 'en-US'
export const LOCALE_STORAGE_KEY = 'i18n-playground:locale'

/** Native names shown in the language switcher. */
export const LOCALE_LABELS: Record<AppLocale, string> = {
  'en-US': 'English',
  'zh-CN': '简体中文',
}

export function isSupportedLocale(value: string): value is AppLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value)
}

export function normalizeLocale(value: string | null | undefined): AppLocale {
  return value && isSupportedLocale(value) ? value : DEFAULT_LOCALE
}

function detectLocale(): { locale: AppLocale; source: LocaleDetectionSource } {
  if (typeof window === 'undefined') {
    return { locale: DEFAULT_LOCALE, source: 'default' }
  }

  // 1. Preference saved by the language switcher.
  const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY)
  if (stored && isSupportedLocale(stored)) {
    return { locale: stored, source: 'storage' }
  }

  // 2. Browser preference: any zh-* language maps to zh-CN.
  const browserLocale = window.navigator.languages?.[0] ?? window.navigator.language
  if (browserLocale && browserLocale.toLowerCase().startsWith('zh')) {
    return { locale: 'zh-CN', source: 'browser' }
  }

  // 3. Default fallback.
  return { locale: DEFAULT_LOCALE, source: 'browser' }
}

const detected = detectLocale()

export const initialLocale = detected.locale
export const initialLocaleSource = detected.source

export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: initialLocale,
  fallbackLocale: DEFAULT_LOCALE,
  messages: {
    'en-US': enUS,
    'zh-CN': zhCN,
  },
})

export function currentLocale(): AppLocale {
  return normalizeLocale(i18n.global.locale.value)
}

/** Switch the active locale and persist the choice. */
export function setLocale(locale: AppLocale): void {
  window.localStorage.setItem(LOCALE_STORAGE_KEY, locale)
  i18n.global.locale.value = locale
  applyDocumentMetadata(locale)
}

/** Keep `<html lang>` and `document.title` in sync with the active locale. */
export function applyDocumentMetadata(locale: AppLocale = currentLocale()): void {
  document.documentElement.lang = locale
  document.title = `${i18n.global.t('app.title')} · ${i18n.global.t('app.framework')}`
}
