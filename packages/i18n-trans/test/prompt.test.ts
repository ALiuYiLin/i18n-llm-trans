import { describe, expect, it } from 'vitest'
import {
  buildMessages,
  extractPlaceholders,
  parseTranslationResponse,
  validateTranslations,
} from '../src/trans/prompt'
import type { TranslationRequest, TranslationUnit } from '../src/types'

const units: TranslationUnit[] = [
  { key: '你好', source: '你好' },
  { key: '删除__TRANS_ID_remove', source: '删除', transId: 'remove', hint: '从角色组移出' },
]

describe('extractPlaceholders', () => {
  it('extracts single-brace placeholders and keeps duplicates', () => {
    expect(extractPlaceholders('你好，{name}！{count} {name}')).toEqual([
      '{count}',
      '{name}',
      '{name}',
    ])
  })

  it('extracts double-brace placeholders without mixing brace styles', () => {
    expect(extractPlaceholders('Hello, {{name}}! You have {{count}} items.')).toEqual([
      '{{count}}',
      '{{name}}',
    ])
  })
})

describe('parseTranslationResponse', () => {
  it('parses the results array form', () => {
    const raw = JSON.stringify({ results: [{ key: '你好', value: 'Hello' }] })
    expect(parseTranslationResponse(raw)).toEqual({ 你好: 'Hello' })
  })

  it('parses markdown fenced JSON and the map form', () => {
    expect(parseTranslationResponse('```json\n{"你好":"Hello"}\n```')).toEqual({ 你好: 'Hello' })
  })

  it('rejects invalid JSON', () => {
    expect(() => parseTranslationResponse('not json')).toThrow(/not valid JSON/)
  })
})

describe('validateTranslations', () => {
  it('accepts a valid response', () => {
    expect(() =>
      validateTranslations(units, { 你好: 'Hello', 删除__TRANS_ID_remove: 'Remove' }),
    ).not.toThrow()
  })

  it('rejects missing keys, empty values and placeholder mismatches', () => {
    expect(() => validateTranslations(units, { 你好: 'Hello' })).toThrow(/key mismatch/)
    expect(() =>
      validateTranslations(units, { 你好: '', 删除__TRANS_ID_remove: 'Remove' }),
    ).toThrow(/Empty translation/)
    expect(() =>
      validateTranslations(
        [{ key: '你好', source: '你好，{name}！' }],
        { 你好: 'Hello, friend!' },
      ),
    ).toThrow(/Placeholder mismatch/)
  })

  it('requires the same brace style as the source', () => {
    expect(() =>
      validateTranslations(
        [{ key: '你好', source: '你好，{{name}}！' }],
        { 你好: 'Hello, {name}!' },
      ),
    ).toThrow(/Placeholder mismatch/)
    expect(() =>
      validateTranslations(
        [{ key: '你好', source: '你好，{{name}}！' }],
        { 你好: 'Hello, {{name}}!' },
      ),
    ).not.toThrow()
  })
})

describe('buildMessages', () => {
  it('includes units with context and hint in the user message', () => {
    const request: TranslationRequest = {
      sourceLocale: 'zh-CN',
      targetLocale: 'en-US',
      glossary: { 仪表盘: 'dashboard' },
      units: [
        {
          key: '删除__TRANS_ID_remove',
          source: '删除',
          transId: 'remove',
          context: "t('删除', 'remove')",
          hint: '从角色组移出',
        },
      ],
    }

    const messages = buildMessages(request)
    expect(messages[0]?.role).toBe('system')
    expect(messages[0]?.content).toContain('JSON object')

    const user = messages[1]?.content as string
    expect(user).toContain('删除__TRANS_ID_remove')
    expect(user).toContain("t('删除', 'remove')")
    expect(user).toContain('从角色组移出')
    expect(user).toContain('dashboard')
  })
})
