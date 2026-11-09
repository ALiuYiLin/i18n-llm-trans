/** Format a marked value, e.g. `⟦TODO⟧ 你好` or `⟦REVIEW⟧ Hello`. */
export function formatMarker(marker: string, text: string): string {
  return `${marker} ${text}`
}

/** Missing-key placeholder written by `--add-target`, e.g. `⟦TODO⟧ 你好`. */
export function formatPlaceholder(marker: string, sourceText: string): string {
  return formatMarker(marker, sourceText)
}

/**
 * A target value is considered untranslated only when it is a placeholder for the
 * source text: the raw source text, the bare placeholder marker, or
 * `<placeholderMarker> <sourceText>`.
 */
export function isPlaceholderValue(
  value: string,
  placeholderMarker: string,
  sourceText: string,
): boolean {
  return (
    value === sourceText ||
    value === placeholderMarker ||
    value === formatPlaceholder(placeholderMarker, sourceText)
  )
}

/** A value written by `trans` that still needs human review. */
export function isReviewValue(value: string, reviewMarker: string): boolean {
  return value === reviewMarker || value.startsWith(`${reviewMarker} `)
}
