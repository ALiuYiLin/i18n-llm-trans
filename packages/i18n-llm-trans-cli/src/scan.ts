import { parse, type ParserPlugin } from '@babel/parser'
import type { DynamicUsage, I18nConfig, ScanResult, Usage } from './types'

interface AstNode {
  type: string
  start?: number | null
  end?: number | null
  loc?: { start: { line: number } } | null
  [key: string]: unknown
}

const SKIP_KEYS = new Set([
  'loc',
  'start',
  'end',
  'extra',
  'leadingComments',
  'trailingComments',
  'innerComments',
  'comments',
  'tokens',
])

function isNode(value: unknown): value is AstNode {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { type?: unknown }).type === 'string'
  )
}

function walk(value: unknown, visit: (node: AstNode) => void): void {
  if (Array.isArray(value)) {
    for (const item of value) walk(item, visit)
    return
  }
  if (!isNode(value)) return

  visit(value)
  for (const key of Object.keys(value)) {
    if (SKIP_KEYS.has(key)) continue
    walk(value[key], visit)
  }
}

function parserPlugins(filename: string): ParserPlugin[] {
  if (filename.endsWith('.tsx')) return ['typescript', 'jsx']
  if (filename.endsWith('.ts')) return ['typescript']
  if (filename.endsWith('.jsx')) return ['jsx']
  return []
}

/** Extract a static string from a string literal or a template literal without expressions. */
function staticString(value: unknown): string | undefined {
  if (!isNode(value)) return undefined

  if (value.type === 'StringLiteral' && typeof value.value === 'string') {
    return value.value
  }

  if (value.type === 'TemplateLiteral') {
    const expressions = value.expressions
    if (!Array.isArray(expressions) || expressions.length > 0) return undefined
    const quasis = value.quasis
    if (!Array.isArray(quasis) || quasis.length === 0) return undefined
    const quasi = quasis[0] as { value?: { cooked?: string | null; raw?: string } }
    const cooked = quasi.value?.cooked
    if (typeof cooked === 'string') return cooked
    if (typeof quasi.value?.raw === 'string') return quasi.value.raw
  }

  return undefined
}

function literalValue(value: unknown): string | undefined {
  if (!isNode(value)) return undefined
  if (value.type === 'StringLiteral' && typeof value.value === 'string') return value.value
  if (value.type === 'NumericLiteral' && typeof value.value === 'number') {
    return String(value.value)
  }
  return undefined
}

/** Read a `__TRANS_ID` value from the second argument: shorthand or `{ __TRANS_ID: 'x' }`. */
function transIdFromArgument(value: unknown, option: string): string | undefined {
  const shorthand = literalValue(value)
  if (shorthand !== undefined) return shorthand

  if (!isNode(value) || value.type !== 'ObjectExpression') return undefined
  const properties = value.properties
  if (!Array.isArray(properties)) return undefined

  for (const property of properties) {
    if (!isNode(property)) continue
    if (property.type !== 'ObjectProperty' && property.type !== 'Property') continue

    const key = property.key
    let name: string | undefined
    if (isNode(key) && key.type === 'Identifier' && typeof key.name === 'string') {
      name = key.name
    } else {
      name = literalValue(key)
    }

    if (name === option) return literalValue(property.value)
  }

  return undefined
}

export function scanCode(
  code: string,
  filename: string,
  options: Pick<I18nConfig, 'callers' | 'transId'>,
): ScanResult {
  const usages: Usage[] = []
  const dynamicUsages: DynamicUsage[] = []
  const literals = new Set<string>()

  let ast: unknown
  try {
    ast = parse(code, {
      sourceType: 'unambiguous',
      errorRecovery: true,
      plugins: parserPlugins(filename),
    })
  } catch (error) {
    throw new Error(`Failed to parse ${filename}: ${(error as Error).message}`)
  }

  walk(ast, (node) => {
    if (node.type === 'StringLiteral' && typeof node.value === 'string') {
      literals.add(node.value)
      return
    }

    if (node.type === 'TemplateLiteral') {
      const value = staticString(node)
      if (value !== undefined) literals.add(value)
      return
    }

    if (node.type !== 'CallExpression') return

    const callee = node.callee
    if (!isNode(callee) || callee.type !== 'Identifier' || typeof callee.name !== 'string') {
      return
    }
    if (!options.callers.includes(callee.name)) return

    const args = Array.isArray(node.arguments) ? node.arguments : []
    const source = staticString(args[0])
    const line = node.loc?.start.line ?? 0

    if (source === undefined) {
      const snippet = code
        .slice(node.start ?? 0, node.end ?? 0)
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 120)
      dynamicUsages.push({ file: filename, line, snippet })
      return
    }

    const transId =
      args.length > 1 ? transIdFromArgument(args[1], options.transId.option) : undefined

    usages.push({
      source,
      transIds: transId === undefined ? [] : [transId],
      file: filename,
      line,
    })
  })

  return { usages, dynamicUsages, literals }
}
