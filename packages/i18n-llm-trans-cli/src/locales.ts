import { readFile, writeFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

export interface LocaleFile {
  locale: string
  path: string
  messages: Record<string, string>
  indent: string
  newline: string
  original: string
}

function detectFormat(raw: string): { indent: string; newline: string } {
  const newline = raw.includes('\r\n') ? '\r\n' : '\n'
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^([ \t]+)"/)
    if (match) return { indent: match[1], newline }
  }
  return { indent: '  ', newline }
}

export async function listLocales(localesDir: string): Promise<string[]> {
  try {
    const entries = await readdir(localesDir, { withFileTypes: true })
    return entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.json'))
      .map((entry) => entry.name.slice(0, -'.json'.length))
      .sort()
  } catch (error) {
    throw new Error(`Cannot read localesDir "${localesDir}": ${(error as Error).message}`)
  }
}

export async function readLocaleFile(localesDir: string, locale: string): Promise<LocaleFile> {
  const path = join(localesDir, `${locale}.json`)
  let original: string
  try {
    original = await readFile(path, 'utf8')
  } catch {
    throw new Error(`Locale file not found: ${path}`)
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(original)
  } catch (error) {
    throw new Error(`Invalid JSON in ${path}: ${(error as Error).message}`)
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Locale file must contain a flat JSON object: ${path}`)
  }

  const messages: Record<string, string> = {}
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof value !== 'string') {
      throw new Error(`Locale value for "${key}" must be a string: ${path}`)
    }
    messages[key] = value
  }

  const { indent, newline } = detectFormat(original)
  return { locale, path, messages, indent, newline, original }
}

export function serializeLocale(file: LocaleFile): string {
  const text = JSON.stringify(file.messages, null, file.indent)
  return (file.newline === '\r\n' ? text.replaceAll('\n', '\r\n') : text) + file.newline
}

/** Write the locale file when its content changed. Returns `true` when written. */
export async function writeLocaleFile(file: LocaleFile): Promise<boolean> {
  const next = serializeLocale(file)
  if (next === file.original) return false
  await writeFile(file.path, next, 'utf8')
  file.original = next
  return true
}
