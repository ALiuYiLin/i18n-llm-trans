import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { detectLocale, matchLocale } from './core/detection'
import { resolveTransIdConfig, translateWith } from './core/translate'
import { createUseI18n } from './react/useI18n'
import type {
  DetectionOptions,
  I18nRuntime,
  LocaleDetectionSource,
  RuntimeOptions,
  SourceKeyOf,
  StorageLike,
  TransId,
  TranslateOptions,
} from './types'

const DEFAULT_DETECTION_ORDER: readonly LocaleDetectionSource[] = [
  'storage',
  'browser',
  'default',
]
const DEFAULT_STORAGE_KEY = 'i18n-locale'

function getDefaultStorage(): StorageLike | null {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage
    }
  } catch {
    // Accessing localStorage can throw in privacy modes; fall back to detection.
  }
  return null
}

function getNavigatorLanguages(): readonly string[] {
  if (typeof navigator === 'undefined') return []
  if (navigator.languages?.length) return navigator.languages
  return navigator.language ? [navigator.language] : []
}

/**
 * Create the source-text-key i18n runtime for an app.
 *
 * The package follows a single-instance convention: call this once per app and
 * re-export the returned helpers from your own `src/i18n/index.ts`.
 */
export function createI18nRuntime<
  const Messages extends Record<string, Record<string, string>>,
  const Source extends keyof Messages & string = keyof Messages & string,
  const Option extends string = '__TRANS_ID',
>(
  options: RuntimeOptions<Messages, Source, Option>,
): I18nRuntime<SourceKeyOf<Messages, Source>, Option> {
  type SourceKey = SourceKeyOf<Messages, Source>

  const messages = options.messages as Record<string, Record<string, string>>
  const supportedLocales = (options.supportedLocales ?? Object.keys(messages)) as readonly string[]
  const sourceLocale = (options.sourceLocale ?? supportedLocales[0]) as string

  if (!sourceLocale || !supportedLocales.includes(sourceLocale)) {
    throw new Error(
      `[i18n-llm-trans-react] sourceLocale "${String(sourceLocale)}" is not in supportedLocales.`,
    )
  }

  const fallbackLocale = (options.fallbackLocale ?? sourceLocale) as string
  if (!supportedLocales.includes(fallbackLocale)) {
    throw new Error(
      `[i18n-llm-trans-react] fallbackLocale "${fallbackLocale}" is not in supportedLocales.`,
    )
  }

  const transIdConfig = resolveTransIdConfig(options.transId)

  const detection: DetectionOptions | false = options.detection ?? {}
  const storage =
    detection === false || detection.storage === false
      ? null
      : detection.storage ?? getDefaultStorage()
  const storageKey =
    detection === false || detection.storageKey === false
      ? null
      : detection.storageKey ?? DEFAULT_STORAGE_KEY
  const order =
    detection === false ? (['default'] as const) : detection.order ?? DEFAULT_DETECTION_ORDER
  const normalize = detection === false ? undefined : detection.normalize

  const detected = detectLocale({
    supportedLocales,
    defaultLocale: sourceLocale,
    order,
    storage,
    storageKey,
    navigatorLanguages: getNavigatorLanguages(),
    normalize,
  })

  const resources: Record<string, { translation: Record<string, string> }> = {}
  for (const locale of supportedLocales) {
    resources[locale] = { translation: messages[locale] ?? {} }
  }

  const i18nReady = i18n.use(initReactI18next).init({
    resources,
    lng: detected.locale,
    fallbackLng: fallbackLocale,
    supportedLngs: [...supportedLocales],
    // Source-text keys are flat strings that may contain '.', ':' or '/' characters.
    keySeparator: false,
    nsSeparator: false,
    interpolation: {
      escapeValue: false,
      prefix: options.interpolation?.prefix ?? '{',
      suffix: options.interpolation?.suffix ?? '}',
    },
    react: { useSuspense: false },
    ...options.i18next,
  })

  const getLocale = (): string =>
    matchLocale(i18n.resolvedLanguage ?? i18n.language, supportedLocales) ?? sourceLocale

  const baseTranslate = (key: string, params?: Record<string, unknown>): string =>
    i18n.t(key, params as never) as unknown as string

  const translate = ((
    source: SourceKey,
    opts?: TranslateOptions<Option> | TransId,
  ): string =>
    translateWith(source as string, opts as Record<string, unknown> | TransId | undefined, {
      locale: getLocale(),
      sourceLocale,
      transId: transIdConfig,
      baseT: baseTranslate,
    })) as I18nRuntime<SourceKey, Option>['translate']

  const setLocale = (next: string): void => {
    const locale = matchLocale(next, supportedLocales) ?? sourceLocale
    if (storage && storageKey) {
      storage.setItem(storageKey, locale)
    }
    if (locale !== getLocale()) {
      void i18n.changeLanguage(locale)
    }
  }

  const documentOptions = options.document === false ? false : options.document ?? {}
  const applyDocumentMetadata = (locale: string = getLocale()): void => {
    if (documentOptions === false || typeof document === 'undefined') return
    if (documentOptions.lang !== false) {
      document.documentElement.lang = locale
    }
    if (documentOptions.title) {
      document.title = documentOptions.title(translate)
    }
  }

  const onLanguageChanged = (language: string): void => {
    if (!i18n.isInitialized) return
    applyDocumentMetadata(matchLocale(language, supportedLocales) ?? sourceLocale)
  }
  i18n.on('languageChanged', onLanguageChanged)

  void i18nReady.then(() => {
    applyDocumentMetadata()
  })

  const useI18n = createUseI18n<SourceKey, Option>({
    translate,
    getLocale,
    setLocale,
    supportedLocales,
  })

  return {
    i18n,
    i18nReady,
    t: translate,
    translate,
    useI18n,
    getLocale,
    setLocale,
    supportedLocales,
    sourceLocale,
    fallbackLocale,
    initialLocaleSource: detected.source,
    transIdConfig,
    applyDocumentMetadata,
    dispose: () => {
      i18n.off('languageChanged', onLanguageChanged)
    },
  }
}
