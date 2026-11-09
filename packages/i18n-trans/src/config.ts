import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { I18nConfig, TranslationConfig } from './types'

export const CONFIG_FILENAME = 'i18n.config.json'

const TRANSLATION_DEFAULTS: TranslationConfig = {
  placeholderMarker: '⟦TODO⟧',
  reviewMarker: '⟦REVIEW⟧',
  batchSize: 20,
  contextLines: 0,
  hints: {},
  glossary: {},
  ignoreKeys: [],
  maxRetries: 1,
  jsonMode: true,
}

const DEFAULTS = {
  include: ['src/**/*.{ts,tsx}'],
  exclude: ['src/**/*.test.{ts,tsx}', 'src/**/*.d.ts'],
  localesDir: 'src/locales',
  callers: ['t', 'translate'],
  transId: { option: '__TRANS_ID', separator: '__TRANS_ID_' },
} as const

export interface LoadedConfig {
  config: I18nConfig
  path: string
}

export async function loadConfig(cwd: string): Promise<LoadedConfig> {
  const path = join(cwd, CONFIG_FILENAME)
  let raw: string
  try {
    raw = await readFile(path, 'utf8')
  } catch {
    throw new Error(`i18n config not found: ${path}`)
  }

  let parsed: Partial<I18nConfig>
  try {
    parsed = JSON.parse(raw) as Partial<I18nConfig>
  } catch (error) {
    throw new Error(`Invalid JSON in ${path}: ${(error as Error).message}`)
  }

  if (typeof parsed.sourceLocale !== 'string' || parsed.sourceLocale.length === 0) {
    throw new Error(`"sourceLocale" is required in ${path}`)
  }

  const transId = { ...DEFAULTS.transId, ...(parsed.transId ?? {}) }
  const translation = { ...TRANSLATION_DEFAULTS, ...(parsed.translation ?? {}) }

  if (translation.placeholderMarker.length === 0) {
    throw new Error(`"translation.placeholderMarker" must not be empty in ${path}`)
  }
  if (translation.reviewMarker.length === 0) {
    throw new Error(`"translation.reviewMarker" must not be empty in ${path}`)
  }
  if (translation.placeholderMarker === translation.reviewMarker) {
    throw new Error(
      `"translation.placeholderMarker" and "translation.reviewMarker" must be different in ${path}`,
    )
  }
  if (!Number.isInteger(translation.batchSize) || translation.batchSize < 1) {
    throw new Error(`"translation.batchSize" must be a positive integer in ${path}`)
  }

  return {
    path,
    config: {
      include: parsed.include ?? [...DEFAULTS.include],
      exclude: parsed.exclude ?? [...DEFAULTS.exclude],
      localesDir: parsed.localesDir ?? DEFAULTS.localesDir,
      sourceLocale: parsed.sourceLocale,
      targetLocales: parsed.targetLocales,
      callers: parsed.callers ?? [...DEFAULTS.callers],
      transId,
      translation,
    },
  }
}
