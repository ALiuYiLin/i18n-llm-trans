import { readFile } from 'node:fs/promises'
import { relative } from 'node:path'
import { glob } from 'tinyglobby'
import { scanCode } from './scan'
import type { DynamicUsage, I18nConfig, Usage } from './types'

export interface ScannedProject {
  files: string[]
  usages: Usage[]
  dynamicUsages: DynamicUsage[]
  literals: Set<string>
}

export function displayFile(cwd: string, path: string): string {
  return relative(cwd, path).replaceAll('\\', '/')
}

export async function scanProject(cwd: string, config: I18nConfig): Promise<ScannedProject> {
  const files = (
    await glob(config.include, {
      cwd,
      ignore: config.exclude,
      absolute: true,
      dot: false,
    })
  ).sort()

  if (files.length === 0) {
    throw new Error(`No files matched include patterns: ${config.include.join(', ')}`)
  }

  const usages: Usage[] = []
  const dynamicUsages: DynamicUsage[] = []
  const literals = new Set<string>()

  for (const file of files) {
    const code = await readFile(file, 'utf8')
    const result = scanCode(code, displayFile(cwd, file), config)
    usages.push(...result.usages)
    dynamicUsages.push(...result.dynamicUsages)
    for (const literal of result.literals) literals.add(literal)
  }

  return { files, usages, dynamicUsages, literals }
}
