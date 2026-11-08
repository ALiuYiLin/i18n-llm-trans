import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { I18nHelpers, TransId, Translate, TranslateOptions } from '../types'

export interface UseI18nConfig<SourceKey extends string, Option extends string> {
  translate: Translate<SourceKey, Option>
  getLocale: () => string
  setLocale: (locale: string) => void
  supportedLocales: readonly string[]
}

/**
 * Create the `useI18n` hook bound to a runtime. The hook subscribes to
 * i18next's `languageChanged` event through `useTranslation()` so components
 * re-render when the locale changes.
 */
export function createUseI18n<SourceKey extends string, Option extends string>(
  config: UseI18nConfig<SourceKey, Option>,
): () => I18nHelpers<SourceKey, Option> {
  const { translate, getLocale, setLocale, supportedLocales } = config

  return function useI18n(): I18nHelpers<SourceKey, Option> {
    const { i18n } = useTranslation()

    const t = useCallback(
      (source: SourceKey, options?: TranslateOptions<Option> | TransId) =>
        translate(source, options),
      [],
    )

    return {
      t,
      i18n,
      locale: getLocale(),
      setLocale,
      supportedLocales,
    }
  }
}
