import type { I18nConfig, Usage } from './types'

export interface VariantInfo {
  variantKeys: Set<string>
  /** Variant key -> source (base) key. */
  variantSource: Map<string, string>
  /** Variant key -> __TRANS_ID value. */
  variantId: Map<string, string>
}

export function dedupeUsages(usages: Usage[]): Usage[] {
  const map = new Map<string, Usage>()
  for (const usage of usages) {
    const existing = map.get(usage.source)
    if (existing) {
      for (const id of usage.transIds) {
        if (!existing.transIds.includes(id)) existing.transIds.push(id)
      }
    } else {
      map.set(usage.source, { ...usage, transIds: [...usage.transIds] })
    }
  }
  return [...map.values()]
}

export function buildVariants(usages: Usage[], config: I18nConfig): VariantInfo {
  const variantKeys = new Set<string>()
  const variantSource = new Map<string, string>()
  const variantId = new Map<string, string>()

  for (const usage of usages) {
    for (const id of usage.transIds) {
      const key = `${usage.source}${config.transId.separator}${id}`
      variantKeys.add(key)
      variantSource.set(key, usage.source)
      variantId.set(key, id)
    }
  }

  return { variantKeys, variantSource, variantId }
}

export function expectedTargetKeys(sourceKeys: string[], variants: VariantInfo): Set<string> {
  return new Set<string>([...sourceKeys, ...variants.variantKeys])
}
