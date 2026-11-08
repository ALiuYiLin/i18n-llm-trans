import { createI18nRuntime } from '@10coding/i18n-llm-trans-react'
import { FRAMEWORK_LABEL } from '../app-config'
import enUS from '../locales/en-US.json'
import jaJP from '../locales/ja-JP.json'
import zhCN from '../locales/zh-CN.json'

export const LOCALE_STORAGE_KEY = 'i18n-playground:locale'

/**
 * 应用适配层：语言资源、标题模板、存储 key 都留在应用，
 * 运行时能力来自 @10coding/i18n-llm-trans-react。
 */
export const runtime = createI18nRuntime({
  messages: { 'zh-CN': zhCN, 'en-US': enUS, 'ja-JP': jaJP },
  sourceLocale: 'zh-CN',
  detection: { storageKey: LOCALE_STORAGE_KEY },
  document: {
    title: (t) => `${t('i18n 演练场')} · ${FRAMEWORK_LABEL}`,
  },
})

export const {
  i18n,
  i18nReady,
  useI18n,
  translate,
  setLocale,
  applyDocumentMetadata,
  initialLocaleSource,
  sourceLocale,
  fallbackLocale,
  supportedLocales,
} = runtime

export const SOURCE_LOCALE = sourceLocale
export const FALLBACK_LOCALE = fallbackLocale
export const SUPPORTED_LOCALES = supportedLocales

/** Native locale names used by the language switcher (application UI concern). */
export const LOCALE_LABELS: Record<string, string> = {
  'zh-CN': '简体中文',
  'en-US': 'English',
  'ja-JP': '日本語',
}

export function normalizeLocale(value: string | null | undefined): string {
  return value && supportedLocales.includes(value) ? value : sourceLocale
}
