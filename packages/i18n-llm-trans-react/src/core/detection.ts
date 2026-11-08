import type { LocaleDetectionSource, StorageLike } from '../types'

export interface DetectionContext {
  supportedLocales: readonly string[]
  defaultLocale: string
  order: readonly LocaleDetectionSource[]
  storage: StorageLike | null
  storageKey: string | null
  navigatorLanguages: readonly string[]
  normalize?: (raw: string) => string | undefined
}

export interface DetectionResult {
  locale: string
  source: LocaleDetectionSource
}

/**
 * Match a raw language tag (e.g. `zh-Hans-CN`, `en-GB`) against supported
 * locales. Falls back to the primary subtag (`zh`, `en`).
 */
export function matchLocale(
  raw: string | null | undefined,
  supportedLocales: readonly string[],
  normalize?: (raw: string) => string | undefined,
): string | undefined {
  if (!raw) return undefined

  const candidate = (normalize?.(raw) ?? raw).trim()
  if (!candidate) return undefined

  const lower = candidate.toLowerCase()
  const exact = supportedLocales.find((locale) => locale.toLowerCase() === lower)
  if (exact) return exact

  const primary = lower.split('-')[0]
  return supportedLocales.find((locale) => locale.toLowerCase().split('-')[0] === primary)
}

/** Resolve the initial locale by walking the configured detection order. */
export function detectLocale(context: DetectionContext): DetectionResult {
  for (const step of context.order) {
    if (step === 'storage') {
      if (context.storage && context.storageKey) {
        const stored = context.storage.getItem(context.storageKey)
        const locale = matchLocale(stored, context.supportedLocales, context.normalize)
        if (locale) return { locale, source: 'storage' }
      }
      continue
    }

    if (step === 'browser') {
      for (const raw of context.navigatorLanguages) {
        const locale = matchLocale(raw, context.supportedLocales, context.normalize)
        if (locale) return { locale, source: 'browser' }
      }
      continue
    }

    return { locale: context.defaultLocale, source: 'default' }
  }

  return { locale: context.defaultLocale, source: 'default' }
}
