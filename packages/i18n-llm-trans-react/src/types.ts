import type { i18n as I18nInstance, InitOptions, TFunction } from 'i18next'

/** Where the initial locale was detected from. */
export type LocaleDetectionSource = 'storage' | 'browser' | 'default'

/** `__TRANS_ID` value: string or number. */
export type TransId = string | number

export interface StorageLike {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

export interface DetectionOptions {
  /** Detection order, defaults to `['storage', 'browser', 'default']`. */
  order?: readonly LocaleDetectionSource[]
  /** localStorage key, defaults to `'i18n-locale'`; `false` disables storage. */
  storageKey?: string | false
  /** Storage implementation, defaults to `localStorage`; `false` disables it. */
  storage?: StorageLike | false
  /** Custom normalizer, e.g. map `zh-Hans` to `zh-CN`. */
  normalize?: (raw: string) => string | undefined
}

export interface TransIdOptions<Option extends string = string> {
  /** Option name used in `t()` calls, defaults to `'__TRANS_ID'`. */
  option?: Option
  /** Resource key separator, defaults to `${option}_`. */
  separator?: string
  /** Allow `t('原文', id)` shorthand, defaults to `true`. */
  shorthand?: boolean
}

export interface ResolvedTransIdConfig {
  option: string
  separator: string
  shorthand: boolean
}

export type TranslateOptions<Option extends string = string> = {
  [K in Option]?: TransId
} & Record<string, unknown>

export type Translate<
  SourceKey extends string = string,
  Option extends string = string,
> = (source: SourceKey, options?: TranslateOptions<Option> | TransId) => string

export interface DocumentOptions<
  SourceKey extends string = string,
  Option extends string = string,
> {
  /** Sync `<html lang>`, defaults to `true`. */
  lang?: boolean
  /** Customize `document.title`. */
  title?: (t: Translate<SourceKey, Option>) => string
}

/** Keys of the source locale messages, e.g. every key of `zh-CN.json`. */
export type SourceKeyOf<
  Messages extends Record<string, Record<string, string>>,
  Source extends keyof Messages & string,
> = Extract<keyof Messages[Source], string>

export interface RuntimeOptions<
  Messages extends Record<string, Record<string, string>> = Record<string, Record<string, string>>,
  Source extends keyof Messages & string = keyof Messages & string,
  Option extends string = '__TRANS_ID',
> {
  /** Source-locale messages: the source locale's keys are its source text. */
  messages: Messages
  /** Source locale (the locale whose text is used as keys), defaults to the first messages key. */
  sourceLocale?: Source
  /** Locale used when a translation is missing, defaults to `sourceLocale`. */
  fallbackLocale?: Source
  /** Supported locales, defaults to `Object.keys(messages)`. */
  supportedLocales?: readonly Source[]
  /** Locale detection config; `false` skips detection entirely. */
  detection?: DetectionOptions | false
  /** One-source-multiple-translations marker config. */
  transId?: TransIdOptions<Option>
  /** `<html lang>` / `document.title` sync; `false` disables it. */
  document?: DocumentOptions<SourceKeyOf<Messages, Source>, Option> | false
  /** Interpolation syntax, defaults to single braces `{name}`. */
  interpolation?: { prefix?: string; suffix?: string }
  /** Escape hatch: extra options passed to `i18next.init`. */
  i18next?: Partial<InitOptions>
}

export interface I18nHelpers<
  SourceKey extends string = string,
  Option extends string = string,
> {
  t: Translate<SourceKey, Option>
  i18n: I18nInstance
  locale: string
  setLocale: (locale: string) => void
  supportedLocales: readonly string[]
}

export interface I18nRuntime<
  SourceKey extends string = string,
  Option extends string = string,
> {
  /** Underlying i18next instance. */
  i18n: I18nInstance
  /** Resolves once i18next finished initializing. */
  i18nReady: Promise<TFunction>
  /** Translate outside of a component, using the current locale. */
  t: Translate<SourceKey, Option>
  translate: Translate<SourceKey, Option>
  /** Hook bound to this runtime's configuration. */
  useI18n: () => I18nHelpers<SourceKey, Option>
  getLocale: () => string
  setLocale: (locale: string) => void
  supportedLocales: readonly string[]
  sourceLocale: string
  fallbackLocale: string
  /** Where the initial locale came from. */
  initialLocaleSource: LocaleDetectionSource
  transIdConfig: ResolvedTransIdConfig
  /** Manually sync `<html lang>` / `document.title`. */
  applyDocumentMetadata: (locale?: string) => void
  /** Remove the internal `languageChanged` listener (mainly for tests). */
  dispose: () => void
}

/** Allowed keys of a target locale file. */
export type MessageKey<SourceKey extends string, Separator extends string = string> =
  | SourceKey
  | `${SourceKey}${Separator}${string}`
