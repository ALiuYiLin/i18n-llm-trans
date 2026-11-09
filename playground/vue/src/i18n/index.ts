import { computed } from 'vue'
import { createI18n } from 'vue-i18n'
import type { ComputedRef } from 'vue'
import enUS from '../locales/en-US.json'
import zhCN from '../locales/zh-CN.json'

/**
 * Vue 参考实现（非发布包），按 docs/i18n-contract.md 实现：
 * - 源语言原文即 key；
 * - t('原文') / t('原文', 'remove') / t('原文', { __TRANS_ID: 'remove' })；
 * - 查找顺序：目标语言变体 → 目标语言基础文案 → 源语言基础文案 → 原文；
 * - vue-i18n 的单花括号 {name} 插值正好符合契约（CLI 同时支持 {{name}}）。
 */

export const SOURCE_LOCALE: AppLocale = 'zh-CN'
export const FALLBACK_LOCALE: AppLocale = SOURCE_LOCALE
export const SUPPORTED_LOCALES = ['zh-CN', 'en-US'] as const
export type AppLocale = (typeof SUPPORTED_LOCALES)[number]

export const LOCALE_STORAGE_KEY = 'i18n-playground:locale'

/** 必须与 i18n.config.json 的 transId 配置一致。 */
export const TRANS_ID_OPTION = '__TRANS_ID'
export const TRANS_ID_SEPARATOR = '__TRANS_ID_'

export type LocaleDetectionSource = 'storage' | 'browser' | 'default'
export type TransId = string | number
export type SourceKey = keyof typeof zhCN

export interface TranslateOptions {
  __TRANS_ID?: TransId
  [param: string]: unknown
}

export type Translate = (source: SourceKey, options?: TranslateOptions | TransId) => string

export const LOCALE_LABELS: Record<AppLocale, string> = {
  'zh-CN': '简体中文',
  'en-US': 'English',
}

function isSupportedLocale(value: string): value is AppLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value)
}

export function normalizeLocale(value: string | null | undefined): AppLocale {
  return value && isSupportedLocale(value) ? value : SOURCE_LOCALE
}

function matchLocale(raw: string): AppLocale | undefined {
  const lower = raw.toLowerCase()
  const exact = SUPPORTED_LOCALES.find((locale) => locale.toLowerCase() === lower)
  if (exact) return exact
  const primary = lower.split('-')[0]
  return SUPPORTED_LOCALES.find((locale) => locale.toLowerCase().split('-')[0] === primary)
}

function detectLocale(): { locale: AppLocale; source: LocaleDetectionSource } {
  if (typeof window === 'undefined') {
    return { locale: SOURCE_LOCALE, source: 'default' }
  }

  const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY)
  if (stored && isSupportedLocale(stored)) {
    return { locale: stored, source: 'storage' }
  }

  const browserLocale = window.navigator.languages?.[0] ?? window.navigator.language ?? ''
  const matched = matchLocale(browserLocale)
  if (matched) {
    return { locale: matched, source: 'browser' }
  }

  return { locale: SOURCE_LOCALE, source: 'default' }
}

const detected = detectLocale()

export const initialLocaleSource: LocaleDetectionSource = detected.source

export const i18n = createI18n({
  legacy: false,
  globalInjection: true,
  locale: detected.locale,
  fallbackLocale: FALLBACK_LOCALE,
  messages: {
    'zh-CN': zhCN,
    'en-US': enUS,
  },
  // key 是原文，可能包含 '.'、':'、'/'，必须按整串查找而不是按点分路径。
  messageResolver: (obj, path) => {
    if (typeof obj !== 'object' || obj === null) return null
    const value = (obj as Record<string, unknown>)[path]
    return typeof value === 'string' ? value : null
  },
  missingWarn: false,
  fallbackWarn: false,
})

export function currentLocale(): AppLocale {
  return normalizeLocale(i18n.global.locale.value)
}

function lookup(key: string, params: Record<string, unknown>): string {
  return i18n.global.t(key, params as never) as unknown as string
}

export const translate: Translate = (source, options) => {
  const normalized: TranslateOptions =
    typeof options === 'object' && options !== null
      ? options
      : ({ [TRANS_ID_OPTION]: options as TransId } as TranslateOptions)
  const { [TRANS_ID_OPTION]: transId, ...params } = normalized

  const locale = currentLocale()
  const needsTarget = transId !== undefined && locale !== SOURCE_LOCALE
  const lookupKey = needsTarget ? `${source}${TRANS_ID_SEPARATOR}${transId}` : source

  const result = lookup(lookupKey, params)
  if (needsTarget && result === lookupKey) {
    return lookup(source, params)
  }
  return result
}

export function setLocale(locale: AppLocale): void {
  window.localStorage.setItem(LOCALE_STORAGE_KEY, locale)
  if (locale !== currentLocale()) {
    i18n.global.locale.value = locale
  }
  applyDocumentMetadata(locale)
}

export function applyDocumentMetadata(locale: AppLocale = currentLocale()): void {
  if (typeof document === 'undefined') return
  document.documentElement.lang = locale
  document.title = `${translate('i18n 演练场')} · Vue 3`
}

export interface I18nHelpers {
  t: Translate
  locale: ComputedRef<AppLocale>
  setLocale: (locale: AppLocale) => void
  supportedLocales: readonly AppLocale[]
}

export function useI18n(): I18nHelpers {
  const locale = computed(() => currentLocale())
  return {
    t: translate,
    locale,
    setLocale,
    supportedLocales: SUPPORTED_LOCALES,
  }
}
