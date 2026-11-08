import type { ChatMessage } from '../llm/openai'
import type { TranslationRequest, TranslationUnit } from '../types'

export function extractPlaceholders(text: string): string[] {
  const matches = text.match(/\{[a-zA-Z0-9_]+\}/g) ?? []
  return [...new Set(matches)].sort()
}

export function buildMessages(request: TranslationRequest): ChatMessage[] {
  const system = [
    'You are a professional software localization translator.',
    `Translate UI strings from "${request.sourceLocale}" to "${request.targetLocale}".`,
    '',
    'Return a single JSON object:',
    '{"results":[{"key":"<input key>","value":"<translated text>"}]}',
    '',
    'Rules:',
    '- Include exactly the input keys, in the same order. Never rename, add, or omit keys.',
    '- Translate only the "source" text; never translate the key.',
    '- Preserve interpolation placeholders (e.g. {name}, {count}) and HTML tags exactly.',
    '- Keep numbers, product names and code identifiers unchanged when appropriate.',
    '- Use "context" and "hint" to choose the right meaning. Keys that share the same source text',
    '  but carry different disambiguation values are variants and may need different translations.',
    '- Use the glossary for terminology.',
    '- Output JSON only: no markdown fences, no comments.',
  ].join('\n')

  const units = request.units.map((unit) => ({
    key: unit.key,
    source: unit.source,
    ...(unit.transId === undefined ? {} : { transId: unit.transId }),
    ...(unit.context === undefined ? {} : { context: unit.context }),
    ...(unit.hint === undefined ? {} : { hint: unit.hint }),
  }))

  const user = JSON.stringify(
    {
      sourceLocale: request.sourceLocale,
      targetLocale: request.targetLocale,
      glossary: request.glossary,
      units,
    },
    null,
    2,
  )

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]
}

export function parseTranslationResponse(content: string): Record<string, string> {
  const cleaned = content
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim()

  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    throw new Error('LLM response is not valid JSON')
  }

  if (Array.isArray(parsed)) {
    return collectResults(parsed)
  }

  if (parsed && typeof parsed === 'object') {
    const record = parsed as Record<string, unknown>
    if (Array.isArray(record.results)) {
      return collectResults(record.results)
    }

    // Plain key/value map is accepted as a fallback.
    const translations: Record<string, string> = {}
    for (const [key, value] of Object.entries(record)) {
      if (typeof value !== 'string') {
        throw new Error(`Unexpected translation value for "${key}"`)
      }
      translations[key] = value
    }
    return translations
  }

  throw new Error('LLM response must be a JSON array or object')
}

function collectResults(items: unknown[]): Record<string, string> {
  const translations: Record<string, string> = {}
  for (const item of items) {
    if (!item || typeof item !== 'object') {
      throw new Error('Translation result items must be objects')
    }
    const { key, value } = item as { key?: unknown; value?: unknown }
    if (typeof key !== 'string' || typeof value !== 'string') {
      throw new Error('Translation result items need string "key" and "value"')
    }
    translations[key] = value
  }
  return translations
}

export function validateTranslations(
  units: TranslationUnit[],
  translations: Record<string, string>,
): void {
  const expectedKeys = new Set(units.map((unit) => unit.key))
  const missing = [...expectedKeys].filter((key) => !(key in translations))
  const extra = Object.keys(translations).filter((key) => !expectedKeys.has(key))

  if (missing.length > 0 || extra.length > 0) {
    throw new Error(
      `Translation key mismatch (missing: ${missing.join(', ') || '-'}; extra: ${extra.join(', ') || '-'})`,
    )
  }

  for (const unit of units) {
    const value = translations[unit.key]
    if (typeof value !== 'string' || value.trim() === '') {
      throw new Error(`Empty translation for "${unit.key}"`)
    }

    const sourcePlaceholders = extractPlaceholders(unit.source).join('|')
    const valuePlaceholders = extractPlaceholders(value).join('|')
    if (sourcePlaceholders !== valuePlaceholders) {
      throw new Error(
        `Placeholder mismatch for "${unit.key}": expected [${sourcePlaceholders}] got [${valuePlaceholders}]`,
      )
    }
  }
}
