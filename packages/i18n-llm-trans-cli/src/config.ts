import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { I18nConfig } from './types'

export const CONFIG_FILENAME = 'i18n.config.json'

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
    },
  }
}
