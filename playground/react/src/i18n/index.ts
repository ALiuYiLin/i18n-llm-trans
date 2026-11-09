import i18n from 'i18next'
import { useCallback } from 'react'
import { initReactI18next, useTranslation } from 'react-i18next'
import { FRAMEWORK_LABEL } from '../app-config'
import enUS from '../locales/en-US.json'
import jaJP from '../locales/ja-JP.json'
import zhCN from '../locales/zh-CN.json'

/**
 * 本地参考实现（非发布包）。
 *
 * 这里展示应用如何按 docs/i18n-contract.md 的契约自行实现 `t()`：
 * - 源语言原文即 key（zh-CN.json 是 identity map）；
 * - `t('原文')` / `t('原文', 'remove')` / `t('原文', { __TRANS_ID: 'remove' })`；
 * - 查找顺序：目标语言变体 → 目标语言基础文案 → 源语言基础文案 → 原文；
 * - 插值统一单花括号 `{name}`（与 CLI 的占位符校验一致）。
 *
 * 实际项目可以换成 Vue、webpack、SSR 或自研方案，只要保持同样的行为契约。
 */

export const SOURCE_LOCALE: AppLocale = 'zh-CN'
export const FALLBACK_LOCALE: AppLocale = SOURCE_LOCALE
export const SUPPORTED_LOCALES = ['zh-CN', 'en-US', 'ja-JP'] as const
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
  'ja-JP': '日本語',
}

const MESSAGES: Record<AppLocale, Record<string, string>> = {
  'zh-CN': zhCN,
  'en-US': enUS,
  'ja-JP': jaJP,
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

/**
 * i18next 只负责资源与字符串替换；中文键查找、__TRANS_ID、回退由下面的
 * `translate()` 完成。keySeparator / nsSeparator 关闭，因为 key 是任意原文。
 */
export const i18nReady = i18n.use(initReactI18next).init({
  resources: {
    'zh-CN': { translation: MESSAGES['zh-CN'] },
    'en-US': { translation: MESSAGES['en-US'] },
    'ja-JP': { translation: MESSAGES['ja-JP'] },
  },
  lng: detected.locale,
  fallbackLng: FALLBACK_LOCALE,
  supportedLngs: [...SUPPORTED_LOCALES],
  keySeparator: false,
  nsSeparator: false,
  interpolation: { escapeValue: false, prefix: '{', suffix: '}' },
  react: { useSuspense: false },
})

export function currentLocale(): AppLocale {
  return normalizeLocale(i18n.resolvedLanguage ?? i18n.language)
}

function lookup(key: string, params: Record<string, unknown>): string {
  return i18n.t(key, params as never) as unknown as string
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
    // 变体缺失：回退到基础文案（目标语言 → 源语言 → 原文）。
    return lookup(source, params)
  }
  return result
}

export function setLocale(locale: AppLocale): void {
  window.localStorage.setItem(LOCALE_STORAGE_KEY, locale)
  if (locale !== currentLocale()) {
    void i18n.changeLanguage(locale)
  }
}

export function applyDocumentMetadata(locale: AppLocale = currentLocale()): void {
  if (typeof document === 'undefined') return
  document.documentElement.lang = locale
  document.title = `${translate('i18n 演练场')} · ${FRAMEWORK_LABEL}`
}

i18n.on('languageChanged', (language) => {
  if (i18n.isInitialized) {
    applyDocumentMetadata(normalizeLocale(language))
  }
})

void i18nReady.then(() => {
  applyDocumentMetadata()
})

export interface I18nHelpers {
  t: Translate
  i18n: typeof i18n
  locale: AppLocale
  setLocale: (locale: AppLocale) => void
  supportedLocales: readonly AppLocale[]
}

export function useI18n(): I18nHelpers {
  // 订阅 i18next 的 languageChanged，切换语言后组件会重新渲染。
  const { i18n: instance } = useTranslation()

  const t = useCallback<Translate>((source, options) => translate(source, options), [])

  return {
    t,
    i18n: instance,
    locale: currentLocale(),
    setLocale,
    supportedLocales: SUPPORTED_LOCALES,
  }
}
