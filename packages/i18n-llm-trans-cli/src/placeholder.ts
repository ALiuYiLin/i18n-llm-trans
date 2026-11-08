/** Placeholder values written to target locales before translation. */
export function formatPlaceholder(marker: string, sourceText: string): string {
  return `${marker} ${sourceText}`
}

/**
 * A target value is considered untranslated when it is a marker placeholder or
 * (legacy mode) exactly equals the source text.
 */
export function isPlaceholderValue(value: string, marker: string, sourceText: string): boolean {
  return value === sourceText || value === marker || value.startsWith(`${marker} `)
}
