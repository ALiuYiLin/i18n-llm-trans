import type { TransId, TransIdOptions } from '../types'

export interface ResolvedTransIdConfig {
  option: string
  separator: string
  shorthand: boolean
}

export function resolveTransIdConfig(options?: TransIdOptions): ResolvedTransIdConfig {
  const option = options?.option ?? '__TRANS_ID'
  return {
    option,
    separator: options?.separator ?? `${option}_`,
    shorthand: options?.shorthand ?? true,
  }
}

export interface TranslateParams {
  /** Current locale. */
  locale: string
  /** Locale that owns the Chinese keys. */
  sourceLocale: string
  transId: ResolvedTransIdConfig
  /** Bound `i18n.t` that always returns a string. */
  baseT: (key: string, params?: Record<string, unknown>) => string
}

/**
 * Translate a Chinese source key with optional `__TRANS_ID` disambiguation.
 *
 * Lookup order for a target locale:
 * 1. `<source><separator><id>`
 * 2. base `<source>` translation
 * 3. Chinese source text (i18next fallback to the source locale)
 * The source locale always returns the plain Chinese key.
 */
export function translateWith(
  source: string,
  options: Record<string, unknown> | TransId | undefined,
  params: TranslateParams,
): string {
  const { separator, option, shorthand } = params.transId

  let normalized: Record<string, unknown>
  if (options === undefined) {
    normalized = {}
  } else if (typeof options === 'object') {
    normalized = options
  } else if (shorthand) {
    // `t('删除', 'delete')` is shorthand for `t('删除', { __TRANS_ID: 'delete' })`.
    normalized = { [option]: options }
  } else {
    throw new TypeError(
      `[i18n-llm-trans-react] t(source, id) shorthand is disabled; pass { ${option}: id } instead.`,
    )
  }

  const rawTransId = normalized[option]
  const id = rawTransId as TransId | undefined

  const interpolation = { ...normalized }
  delete interpolation[option]

  const needsTranslation = id !== undefined && params.locale !== params.sourceLocale
  const lookupKey = needsTranslation ? `${source}${separator}${id}` : source
  const result = params.baseT(lookupKey, interpolation)

  if (typeof result !== 'string') {
    return source
  }

  // The target locale has no entry for this id: fall back to the base text
  // (which resolves to the target translation, then to the source locale).
  if (needsTranslation && result === lookupKey) {
    return params.baseT(source, interpolation)
  }

  return result
}
