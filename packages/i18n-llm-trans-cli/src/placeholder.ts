/** Placeholder / review markers written to target locale values. */
export function formatPlaceholder(marker: string, text: string): string {
  return `${marker} ${text}`
}

/**
 * A target value is considered untranslated only when it is a placeholder for the
 * source text: the raw source text, the bare marker, or `<marker> <sourceText>`.
 *
 * A marker-prefixed value with a different text is an AI translation waiting for
 * manual review, so `trans` must leave it alone (otherwise re-running would
 * translate it again and stack markers).
 */
export function isPlaceholderValue(value: string, marker: string, sourceText: string): boolean {
  return value === sourceText || value === marker || value === formatPlaceholder(marker, sourceText)
}
