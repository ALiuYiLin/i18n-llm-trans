import i18n from 'i18next'
import { useCallback } from 'react'
import { initReactI18next, useTranslation } from 'react-i18next'
import { FRAMEWORK_LABEL } from '../app-config'
import enUS from '../locales/en-US.json'
import zhCN from '../locales/zh-CN.json'
import {
  transIdConfig,
  type TransId,
  type TransIdOptions,
  type TransIdSeparator,
} from './trans-id'

/**
 * 约定：中文键 / 中文值（Chinese-as-key）
 * ---------------------------------------
 * 源语言是 zh-CN：`zh-CN.json` 的键是中文原文，值也是中文原文，例如：
 *
 *   { "你好": "你好" }
 *
 * `en-US.json` 使用相同的中文键，值为对应英文：
 *
 *   { "你好": "hello" }
 *
 * 同一个中文原文在不同场景需要不同译文时，调用时传入 `__TRANS_ID`，
 * 实际查找的键会变成 `<中文原文>__TRANS_ID_<id>`。例如中文都叫「删除」，
 * 英文却要区分永久销毁的 delete 与仅解除关联的 remove：
 *
 *   t('删除', { __TRANS_ID: 'delete' })  ->  { "删除__TRANS_ID_delete": "Delete" }
 *   t('删除', { __TRANS_ID: 'remove' })  ->  { "删除__TRANS_ID_remove": "Remove" }
 *
 * 标记名与分隔符都在 `./trans-id.ts` 的 `transIdConfig` 中配置，可整体换成
 * `__XXX_ID` 之类的命名；调用方式、资源键和类型都会随之变化。
 *
 * 目标语言缺少 `<原文>__TRANS_ID_<id>` 时回退到基础中文文案；源语言（zh-CN）
 * 始终直接展示中文原文，不会查找带 `__TRANS_ID` 的键。
 */

export const SUPPORTED_LOCALES = ['zh-CN', 'en-US'] as const
export type AppLocale = (typeof SUPPORTED_LOCALES)[number]
export type LocaleDetectionSource = 'storage' | 'browser' | 'default'


/** Chinese source text is the canonical locale. */
export const SOURCE_LOCALE: AppLocale = 'zh-CN'
/** Missing translations fall back to the Chinese source text. */
export const FALLBACK_LOCALE: AppLocale = SOURCE_LOCALE

export const LOCALE_STORAGE_KEY = 'i18n-playground:locale'

/** Native names shown in the language switcher. */
export const LOCALE_LABELS: Record<AppLocale, string> = {
  'zh-CN': '简体中文',
  'en-US': 'English',
}

/** Every key in `zh-CN.json` is a translatable Chinese source string. */
export type SourceKey = keyof typeof zhCN
export type MessageKey = SourceKey | `${SourceKey}${TransIdSeparator}${string}`

export { transIdConfig }
export type { TransId }

/**
 * Compile-time guard: if `en-US.json` contains a key that is neither a Chinese
 * source key nor a configured `<source><separator><id>` variant of one, this
 * type resolves to that key and TypeScript reports
 * "does not satisfy the constraint 'never'".
 */
type AssertNever<T extends never> = T
export type UnknownEnglishKeys = AssertNever<Exclude<keyof typeof enUS, MessageKey>>

/**
 * `t()` 的第二个参数：既支持配置的一词多译标记（如 `__TRANS_ID`），
 * 也支持 `{name}` 等插值参数。
 */
export type TranslateOptions = TransIdOptions & Record<string, unknown>

export type Translate = (source: SourceKey, options?: TranslateOptions) => string

export function isSupportedLocale(value: string): value is AppLocale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value)
}

export function normalizeLocale(value: string | null | undefined): AppLocale {
  return value && isSupportedLocale(value) ? value : SOURCE_LOCALE
}

function detectLocale(): { locale: AppLocale; source: LocaleDetectionSource } {
  if (typeof window === 'undefined') {
    return { locale: SOURCE_LOCALE, source: 'default' }
  }

  // 1. Preference saved by the language switcher.
  const stored = window.localStorage.getItem(LOCALE_STORAGE_KEY)
  if (stored && isSupportedLocale(stored)) {
    return { locale: stored, source: 'storage' }
  }

  // 2. Browser preference: zh-* uses Chinese, en-* uses English.
  const browserLocale = (
    window.navigator.languages?.[0] ??
    window.navigator.language ??
    ''
  ).toLowerCase()
  if (browserLocale.startsWith('zh')) {
    return { locale: 'zh-CN', source: 'browser' }
  }
  if (browserLocale.startsWith('en')) {
    return { locale: 'en-US', source: 'browser' }
  }

  // 3. Any other browser language starts from the Chinese source locale.
  return { locale: SOURCE_LOCALE, source: 'default' }
}

const detected = detectLocale()

export const initialLocale = detected.locale
export const initialLocaleSource = detected.source

export const i18nReady = i18n.use(initReactI18next).init({
  resources: {
    [SOURCE_LOCALE]: { translation: zhCN },
    'en-US': { translation: enUS },
  },
  lng: initialLocale,
  fallbackLng: FALLBACK_LOCALE,
  supportedLngs: [...SUPPORTED_LOCALES],
  // Chinese keys are flat strings that may contain '.', ':' or '/' characters.
  keySeparator: false,
  nsSeparator: false,
  interpolation: {
    escapeValue: false,
    // Locale files use single-brace placeholders, e.g. "你好，{name}！".
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

type RawTranslate = (key: string, options?: Record<string, unknown>) => string

function rawTranslate(key: string, options?: Record<string, unknown>): string {
  // `t` is typed with detailed-result overloads; here keys always resolve to strings.
  return i18n.t(key, options as never) as unknown as string
}

function translateWith(
  locale: AppLocale,
  baseT: RawTranslate,
  source: SourceKey,
  options: TranslateOptions = {},
): string {
  // The marker name comes from `transIdConfig`, so `__TRANS_ID` can be
  // reconfigured to `__XXX_ID` (or anything else) in one place.
  const { [transIdConfig.option]: rawTransId, ...params } = options as Record<string, unknown>
  const transId = rawTransId as TransId | undefined
  const needsTranslation = transId !== undefined && locale !== SOURCE_LOCALE
  const lookupKey = needsTranslation
    ? `${source}${transIdConfig.separator}${transId}`
    : source
  const result = baseT(lookupKey, params)

  if (typeof result !== 'string') {
    return source
  }

  // The target locale has no entry for this `__TRANS_ID`: fall back to the base
  // key, which resolves to the target translation of the plain text, then to zh-CN.
  if (needsTranslation && result === lookupKey) {
    return baseT(source, params)
  }

  return result
}

/** Translate a Chinese source string outside of a component. */
export function translate(source: SourceKey, options?: TranslateOptions): string {
  return translateWith(currentLocale(), rawTranslate, source, options)
}

/** Keep `<html lang>` and `document.title` in sync with the active locale. */
export function applyDocumentMetadata(locale: AppLocale = currentLocale()): void {
  document.documentElement.lang = locale
  document.title = `${translate('i18n 演练场')} · ${FRAMEWORK_LABEL}`
}

i18n.on('languageChanged', (language) => {
  if (i18n.isInitialized) {
    applyDocumentMetadata(normalizeLocale(language))
  }
})

export interface I18nHelpers {
  t: Translate
  i18n: typeof i18n
  locale: AppLocale
  setLanguage: (locale: AppLocale) => void
}

/**
 * Component hook: `useTranslation()` plus the Chinese-key lookup rules above.
 * Components must use this hook (not `useTranslation` directly) so that
 * `__TRANS_ID` keeps working.
 */
export function useI18n(): I18nHelpers {
  const { t: baseT, i18n: instance } = useTranslation()
  const locale = normalizeLocale(instance.resolvedLanguage ?? instance.language)

  const t = useCallback<Translate>(
    (source, options) =>
      translateWith(locale, baseT as unknown as RawTranslate, source, options),
    [baseT, locale],
  )

  return { t, i18n: instance, locale, setLanguage: setLocale }
}
