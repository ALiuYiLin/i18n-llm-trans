import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { runCheck } from '../check'
import { loadConfig } from '../config'
import { loadLlmEnv } from '../env'
import { buildVariants, dedupeUsages, expectedTargetKeys } from '../keys'
import { createOpenAiChatClient, type ChatClient } from '../llm/openai'
import { listLocales, readLocaleFile, writeLocaleFile, type LocaleFile } from '../locales'
import { formatMarker, isPlaceholderValue, isReviewValue } from '../placeholder'
import { scanProject } from '../project'
import { buildMessages, parseTranslationResponse, validateTranslations } from './prompt'
import type {
  I18nConfig,
  TransDeps,
  TransOptions,
  TransResult,
  TranslateBatch,
  TranslationRequest,
  TranslationUnit,
  Usage,
} from '../types'

const SNIPPET_LIMIT = 500

function buildUsageIndex(usages: Usage[], config: I18nConfig): Map<string, Usage> {
  const index = new Map<string, Usage>()

  for (const usage of usages) {
    if (!index.has(usage.source)) index.set(usage.source, usage)
    for (const id of usage.transIds) {
      const key = `${usage.source}${config.transId.separator}${id}`
      if (!index.has(key)) index.set(key, usage)
    }
  }

  return index
}

async function readContext(
  cwd: string,
  usage: Usage,
  contextLines: number,
  cache: Map<string, string[]>,
): Promise<string | undefined> {
  let lines = cache.get(usage.file)
  if (!lines) {
    try {
      const content = await readFile(join(cwd, usage.file), 'utf8')
      lines = content.split(/\r?\n/)
      cache.set(usage.file, lines)
    } catch {
      return undefined
    }
  }

  const start = Math.max(0, usage.line - 1 - contextLines)
  const end = Math.min(lines.length, usage.line + contextLines)
  const snippet = lines
    .slice(start, end)
    .map((line) => line.trim())
    .filter(Boolean)
    .join('\n')
    .slice(0, SNIPPET_LIMIT)

  return snippet === '' ? undefined : snippet
}

function createLlmBatchTranslator(client: ChatClient): TranslateBatch {
  return async (request) => {
    const content = await client.chat(buildMessages(request))
    return parseTranslationResponse(content)
  }
}

export async function runTrans(
  options: TransOptions,
  deps: TransDeps = {},
): Promise<TransResult> {
  const quiet = options.quiet ?? false
  const log = (...args: unknown[]): void => {
    if (!quiet) console.log(...args)
  }

  const { config } = await loadConfig(options.cwd)
  const localesDir = join(options.cwd, config.localesDir)

  const scanned = await scanProject(options.cwd, config)
  const uniqueUsages = dedupeUsages(scanned.usages)
  const variants = buildVariants(uniqueUsages, config)

  const locales = await listLocales(localesDir)
  const configuredTargets =
    config.targetLocales ?? locales.filter((locale) => locale !== config.sourceLocale)
  const requested = options.locales?.map((locale) => locale.trim()).filter(Boolean)

  const targetLocales =
    requested && requested.length > 0
      ? configuredTargets.filter((locale) => requested.includes(locale))
      : configuredTargets

  if (requested && requested.length > 0 && targetLocales.length === 0) {
    throw new Error(
      `None of the requested locales (${requested.join(', ')}) are configured target locales (${configuredTargets.join(', ')})`,
    )
  }

  const sourceFile = await readLocaleFile(localesDir, config.sourceLocale)
  const expectedKeys = [...expectedTargetKeys(Object.keys(sourceFile.messages), variants)]
  const usageIndex = buildUsageIndex(scanned.usages, config)
  const contextCache = new Map<string, string[]>()
  const keyFilter =
    options.keys && options.keys.length > 0 ? new Set(options.keys) : undefined
  const useContext = options.useContext ?? true
  const marker = config.translation.placeholderMarker
  const reviewMarker = config.translation.reviewMarker
  const ignoreKeys = new Set(config.translation.ignoreKeys)

  let remaining = options.limit ?? Number.POSITIVE_INFINITY
  let skipped = 0
  const groups: Array<{ locale: string; file: LocaleFile; units: TranslationUnit[] }> = []

  for (const locale of targetLocales) {
    const file = await readLocaleFile(localesDir, locale, { allowMissing: true })
    if (!file.exists && !options.dryRun) {
      // Create the configured target file even when there is nothing to translate.
      await writeLocaleFile(file)
    }
    const units: TranslationUnit[] = []

    for (const key of expectedKeys) {
      if (remaining <= 0) break
      if (keyFilter && !keyFilter.has(key)) continue

      const baseKey = variants.variantSource.get(key)
      const sourceText = baseKey
        ? (sourceFile.messages[baseKey] ?? baseKey)
        : (sourceFile.messages[key] ?? key)
      const current = file.messages[key]

      if (current !== undefined) {
        // A key allowed to stay identical to the source is already fine.
        if (current === sourceText && ignoreKeys.has(key)) {
          skipped += 1
          continue
        }
        // AI translations waiting for human review must not be translated again.
        if (isReviewValue(current, reviewMarker)) {
          skipped += 1
          continue
        }
        // Placeholder values still need translation.
        if (!isPlaceholderValue(current, marker, sourceText)) {
          skipped += 1
          continue
        }
      }

      const usage = usageIndex.get(key)
      const context =
        useContext && usage
          ? await readContext(options.cwd, usage, config.translation.contextLines, contextCache)
          : undefined
      const transId = variants.variantId.get(key)
      const hint = config.translation.hints[key]

      units.push({
        key,
        source: sourceText,
        ...(transId === undefined ? {} : { transId }),
        ...(context === undefined ? {} : { context }),
        ...(hint === undefined ? {} : { hint }),
      })

      remaining -= 1
    }

    if (units.length > 0) {
      groups.push({ locale, file, units })
    }
  }

  const title = `i18n trans · ${config.sourceLocale} → ${targetLocales.join(', ')}`
  const planned = groups.reduce((total, group) => total + group.units.length, 0)

  if (options.dryRun) {
    log(title)
    log(`dry run: ${planned} unit(s) to translate`)
    for (const group of groups) {
      log(`[${group.locale}] ${group.units.length} unit(s)`)
      for (const unit of group.units) {
        log(`  - ${unit.key}`)
      }
    }
    return { exitCode: 0, translated: 0, failed: 0, skipped, dryRun: true }
  }

  let translateBatch = deps.translateBatch
  let maxRetries = deps.maxRetries

  if (planned > 0 && !translateBatch) {
    const env = deps.env ?? loadLlmEnv(options.cwd, options.envFile)
    translateBatch = createLlmBatchTranslator(createOpenAiChatClient(env))
    if (maxRetries === undefined) maxRetries = env.maxRetries
  }

  log(title)
  if (planned === 0) {
    log('nothing to translate')
  }

  const retries = Math.max(0, maxRetries ?? 1)
  const batchSize = config.translation.batchSize
  let translated = 0
  let failed = 0

  for (const group of groups) {
    log(`[${group.locale}] ${group.units.length} unit(s)`)

    for (let index = 0; index < group.units.length; index += batchSize) {
      const batch = group.units.slice(index, index + batchSize)
      const request: TranslationRequest = {
        sourceLocale: config.sourceLocale,
        targetLocale: group.locale,
        glossary: config.translation.glossary,
        units: batch,
      }

      let translations: Record<string, string> | undefined
      let lastError: Error | undefined

      for (let attempt = 0; attempt <= retries; attempt += 1) {
        try {
          const result = await translateBatch!(request)
          validateTranslations(batch, result)
          translations = result
          break
        } catch (error) {
          lastError = error as Error
        }
      }

      if (!translations) {
        failed += batch.length
        log(`[${group.locale}]   ✖ batch failed: ${lastError?.message ?? 'unknown error'}`)
        continue
      }

      for (const unit of batch) {
        const value = translations[unit.key]
        // Mark AI translations for manual review unless --ignore was passed.
        group.file.messages[unit.key] = options.ignore
          ? value
          : formatMarker(reviewMarker, value)
      }
      await writeLocaleFile(group.file)
      translated += batch.length
      log(`[${group.locale}]   ✔ ${batch.length} translated`)
    }
  }

  const check = await runCheck({
    cwd: options.cwd,
    scope: 'all',
    add: false,
    addTarget: false,
    remove: false,
    quiet,
  })

  const exitCode = failed > 0 || check.exitCode !== 0 ? 1 : 0
  log('')
  log(`translated ${translated}, failed ${failed}, skipped ${skipped}`)

  return { exitCode, translated, failed, skipped, dryRun: false, check }
}
