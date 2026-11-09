import { join } from 'node:path'
import { loadConfig } from './config'
import { buildVariants, dedupeUsages, expectedTargetKeys } from './keys'
import { listLocales, readLocaleFile, writeLocaleFile } from './locales'
import { formatPlaceholder } from './placeholder'
import { displayFile, scanProject } from './project'
import type {
  ApplyAction,
  CheckOptions,
  CheckResult,
  MissingSourceKey,
  SourceDiff,
  TargetDiff,
} from './types'

const LIST_LIMIT = 20

function printItems(items: string[]): void {
  for (const item of items.slice(0, LIST_LIMIT)) {
    console.log(`    - ${item}`)
  }
  if (items.length > LIST_LIMIT) {
    console.log(`    … 还有 ${items.length - LIST_LIMIT} 个`)
  }
}

export async function runCheck(options: CheckOptions): Promise<CheckResult> {
  const quiet = options.quiet ?? false

  if (options.add && options.scope === 'target') {
    throw new Error(
      '--add is only supported for the source locale; use --add-target for target placeholder entries',
    )
  }
  if (options.addTarget && options.scope === 'source') {
    throw new Error('--add-target only applies to target locales')
  }

  const { config } = await loadConfig(options.cwd)
  const localesDir = join(options.cwd, config.localesDir)

  const scanned = await scanProject(options.cwd, config)
  const uniqueUsages = dedupeUsages(scanned.usages)

  const locales = await listLocales(localesDir)
  if (!locales.includes(config.sourceLocale)) {
    throw new Error(`sourceLocale "${config.sourceLocale}" not found in ${localesDir}`)
  }

  const targetLocales =
    config.targetLocales ?? locales.filter((locale) => locale !== config.sourceLocale)

  const sourceFile = await readLocaleFile(localesDir, config.sourceLocale)
  const sourceKeys = Object.keys(sourceFile.messages)
  const sourceKeySet = new Set(sourceKeys)
  const usedKeySet = new Set(uniqueUsages.map((usage) => usage.source))

  const missingSource: MissingSourceKey[] =
    options.scope === 'target'
      ? []
      : uniqueUsages
          .filter((usage) => !sourceKeySet.has(usage.source))
          .map((usage) => ({ key: usage.source, file: usage.file, line: usage.line }))

  // Keys that are not called via t() but appear as a literal somewhere are treated as
  // "used indirectly" (e.g. the app maps data to keys at runtime) and are never removed.
  const unusedSource =
    options.scope === 'target'
      ? []
      : sourceKeys.filter((key) => !usedKeySet.has(key) && !scanned.literals.has(key))

  const variants = buildVariants(uniqueUsages, config)

  const actions: ApplyAction[] = []

  if (options.scope !== 'target' && options.add) {
    const added: string[] = []
    for (const usage of uniqueUsages) {
      if (!(usage.source in sourceFile.messages)) {
        sourceFile.messages[usage.source] = usage.source
        added.push(usage.source)
      }
    }
    if (added.length > 0) {
      await writeLocaleFile(sourceFile)
      actions.push({
        file: displayFile(options.cwd, sourceFile.path),
        locale: config.sourceLocale,
        added,
        removed: [],
      })
    }
  }

  if (options.scope !== 'target' && options.remove) {
    const removed: string[] = []
    for (const key of unusedSource) {
      delete sourceFile.messages[key]
      removed.push(key)
    }
    if (removed.length > 0) {
      await writeLocaleFile(sourceFile)
      actions.push({
        file: displayFile(options.cwd, sourceFile.path),
        locale: config.sourceLocale,
        added: [],
        removed,
      })
    }
  }

  const finalSourceKeys = Object.keys(sourceFile.messages)
  const expectedKeys = expectedTargetKeys(finalSourceKeys, variants)

  const targets: TargetDiff[] = []
  if (options.scope !== 'source') {
    for (const locale of targetLocales) {
      const targetFile = await readLocaleFile(localesDir, locale, { allowMissing: true })
      const targetKeys = new Set(Object.keys(targetFile.messages))
      const missing = [...expectedKeys].filter((key) => !targetKeys.has(key))
      const extra = [...targetKeys].filter((key) => !expectedKeys.has(key))

      if (options.addTarget && missing.length > 0) {
        const added: string[] = []
        for (const key of missing) {
          const baseKey = variants.variantSource.get(key)
          const sourceText = baseKey
            ? (sourceFile.messages[baseKey] ?? baseKey)
            : (sourceFile.messages[key] ?? key)
          targetFile.messages[key] = formatPlaceholder(
            config.translation.placeholderMarker,
            sourceText,
          )
          added.push(key)
        }
        if (added.length > 0) {
          await writeLocaleFile(targetFile)
          actions.push({
            file: displayFile(options.cwd, targetFile.path),
            locale,
            added,
            removed: [],
          })
        }
      }

      // A configured target locale that has no file yet is created even when
      // there are no keys to add (e.g. an empty source locale).
      if (options.addTarget && !targetFile.exists) {
        await writeLocaleFile(targetFile)
      }

      if (options.remove && extra.length > 0) {
        for (const key of extra) delete targetFile.messages[key]
        await writeLocaleFile(targetFile)
        actions.push({
          file: displayFile(options.cwd, targetFile.path),
          locale,
          added: [],
          removed: extra,
        })
      }

      targets.push({
        locale,
        file: displayFile(options.cwd, targetFile.path),
        missing,
        extra,
      })
    }
  }

  const stayingMissingSource = options.add && options.scope !== 'target' ? [] : missingSource
  const stayingMissingTarget = options.addTarget
    ? 0
    : targets.reduce((total, target) => total + target.missing.length, 0)
  const exitCode = stayingMissingSource.length > 0 || stayingMissingTarget > 0 ? 1 : 0

  const source: SourceDiff | undefined =
    options.scope === 'target'
      ? undefined
      : {
          locale: config.sourceLocale,
          file: displayFile(options.cwd, sourceFile.path),
          missing: missingSource,
          unused: unusedSource,
        }

  const result: CheckResult = {
    exitCode,
    filesScanned: scanned.files.length,
    staticKeys: uniqueUsages.length,
    dynamicUsages: scanned.dynamicUsages,
    source,
    targets,
    actions,
  }

  if (!quiet) {
    printReport(result, options)
  }

  return result
}

function printReport(result: CheckResult, options: CheckOptions): void {
  console.log('')
  console.log(
    `i18n check · ${result.filesScanned} files scanned · ${result.staticKeys} static t() keys`,
  )

  if (result.source) {
    console.log('')
    console.log(`${result.source.locale} (source) · ${result.source.file}`)
    if (result.source.missing.length === 0 && result.source.unused.length === 0) {
      console.log('  ✔ no issues')
    } else {
      if (result.source.missing.length > 0) {
        console.log(`  ✖ missing ${result.source.missing.length} key(s)`)
        for (const item of result.source.missing.slice(0, LIST_LIMIT)) {
          console.log(`    - ${item.key}  (${item.file}:${item.line})`)
        }
        if (result.source.missing.length > LIST_LIMIT) {
          console.log(`    … 还有 ${result.source.missing.length - LIST_LIMIT} 个`)
        }
      }
      if (result.source.unused.length > 0) {
        console.log(
          `  ⚠ unused ${result.source.unused.length} key(s) (no static t() call or literal found)`,
        )
        printItems(result.source.unused)
      }
    }
  }

  for (const target of result.targets) {
    console.log('')
    console.log(`${target.locale} (target) · ${target.file}`)
    if (target.missing.length === 0 && target.extra.length === 0) {
      console.log('  ✔ no issues')
      continue
    }
    if (target.missing.length > 0) {
      console.log(`  ✖ missing ${target.missing.length} translation(s)`)
      printItems(target.missing)
    }
    if (target.extra.length > 0) {
      console.log(`  ⚠ extra ${target.extra.length} key(s) (not in the source locale)`)
      printItems(target.extra)
    }
  }

  if (result.dynamicUsages.length > 0) {
    console.log('')
    console.log(
      `⚠ ${result.dynamicUsages.length} dynamic t() call(s) cannot be statically analyzed:`,
    )
    for (const usage of result.dynamicUsages.slice(0, LIST_LIMIT)) {
      console.log(`    - ${usage.file}:${usage.line}  ${usage.snippet}`)
    }
    if (result.dynamicUsages.length > LIST_LIMIT) {
      console.log(`    … 还有 ${result.dynamicUsages.length - LIST_LIMIT} 个`)
    }
  }

  if (result.actions.length > 0) {
    console.log('')
    for (const action of result.actions) {
      if (action.added.length > 0) {
        console.log(`+ ${action.locale}: added ${action.added.length} key(s) in ${action.file}`)
      }
      if (action.removed.length > 0) {
        console.log(`- ${action.locale}: removed ${action.removed.length} key(s) in ${action.file}`)
      }
    }
  }

  const sourceMissing = (result.source?.missing.length ?? 0) > 0
  const targetMissing = result.targets.some((target) => target.missing.length > 0)
  const hasRemovable =
    (result.source?.unused.length ?? 0) > 0 || result.targets.some((target) => target.extra.length > 0)

  if (sourceMissing && !options.add) {
    console.log('')
    console.log('hint: --add 补源语言 key（identity 值）')
  }
  if (targetMissing && !options.addTarget) {
    console.log('')
    console.log('hint: --add-target 用 marker 占位补目标语言 key（之后由 i18n:trans 翻译）')
  }
  if (hasRemovable && !options.remove) {
    console.log('hint: --remove 删除未使用 / 多余的 key')
  }

  console.log('')
  if (result.exitCode === 0) {
    console.log('✔ check passed')
  } else {
    console.log('✖ check failed: missing keys remain')
  }
}
