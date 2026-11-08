import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import enUS from '../locales/en-US.json'
import zhCN from '../locales/zh-CN.json'

/** Locales shipped with this playground. Add a locale here and in `resources`. */
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

export const i18nReady = i18n.use(initReactI18next).init({
  resources: {
    'en-US': { translation: enUS },
    'zh-CN': { translation: zhCN },
  },
  lng: initialLocale,
  fallbackLng: DEFAULT_LOCALE,
  supportedLngs: [...SUPPORTED_LOCALES],
  interpolation: {
    escapeValue: false,
    // Keep the locale files identical to the Vue playground: `{name}` instead of
    // i18next's default `{{name}}` interpolation syntax.
    prefix: '{',
    suffix: '}',
  },
  react: { useSuspense: false },
})

export function currentLocale(): AppLocale {
  return normalizeLocale(i18n.resolvedLanguage ?? i18n.language)
}

/** Switch the active locale and persist the choice. */
export function setLocale(locale: AppLocale): void {
  window.localStorage.setItem(LOCALE_STORAGE_KEY, locale)
  void i18n.changeLanguage(locale)
}

/** Keep `<html lang>` and `document.title` in sync with the active locale. */
export function applyDocumentMetadata(locale: AppLocale = currentLocale()): void {
  document.documentElement.lang = locale
  document.title = `${String(i18n.t('app.title'))} · ${String(i18n.t('app.framework'))}`
}

i18n.on('languageChanged', (language) => {
  if (i18n.isInitialized) {
    applyDocumentMetadata(normalizeLocale(language))
  }
})
