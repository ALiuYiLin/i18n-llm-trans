import { describe, expect, it } from 'vitest'
import {
  resolveTransIdConfig,
  translateWith,
  type TranslateParams,
} from '../src/core/translate'

const zhMessages: Record<string, string> = {
  '删除': '删除',
  '删除__TRANS_ID_delete': '删除',
  '确定': '确定',
}

const enMessages: Record<string, string> = {
  '删除': 'Delete',
  '删除__TRANS_ID_delete': 'Delete',
  '删除__TRANS_ID_remove': 'Remove',
  '确定': 'Confirm',
}

function createParams(locale: string, dictionary: Record<string, string>): TranslateParams {
  return {
    locale,
    sourceLocale: 'zh-CN',
    transId: resolveTransIdConfig(),
    baseT: (key, options) => {
      let resolved = dictionary[key] ?? key
      for (const [name, value] of Object.entries(options ?? {})) {
        resolved = resolved.replaceAll(`{${name}}`, String(value))
      }
      return resolved
    },
  }
}

describe('translateWith', () => {
  it('returns the Chinese source text for the source locale', () => {
    expect(translateWith('删除', { __TRANS_ID: 'delete' }, createParams('zh-CN', zhMessages))).toBe(
      '删除',
    )
  })

  it('resolves the full options form', () => {
    expect(translateWith('删除', { __TRANS_ID: 'remove' }, createParams('en-US', enMessages))).toBe(
      'Remove',
    )
  })

  it('resolves the shorthand form', () => {
    expect(translateWith('删除', 'delete', createParams('en-US', enMessages))).toBe('Delete')
    expect(translateWith('删除', 'remove', createParams('en-US', enMessages))).toBe('Remove')
  })

  it('falls back to the base translation when the id variant is missing', () => {
    expect(translateWith('确定', 'missing', createParams('en-US', enMessages))).toBe('Confirm')
  })

  it('supports a custom option name and separator', () => {
    const transId = resolveTransIdConfig({ option: '__XXX_ID', separator: '__XXX_ID_' })
    const params: TranslateParams = {
      ...createParams('en-US', {
        '删除': 'Delete',
        '删除__XXX_ID_remove': 'Remove',
      }),
      transId,
    }
    expect(translateWith('删除', { __XXX_ID: 'remove' }, params)).toBe('Remove')
    expect(translateWith('删除', 'remove', params)).toBe('Remove')
  })

  it('strips the marker and keeps interpolation params', () => {
    const params = createParams('en-US', { '你好，{name}！': 'Hello, {name}!' })
    expect(translateWith('你好，{name}！', { name: 'friend' }, params)).toBe('Hello, friend!')
  })

  it('throws when the shorthand is disabled', () => {
    const params: TranslateParams = {
      ...createParams('en-US', enMessages),
      transId: resolveTransIdConfig({ shorthand: false }),
    }
    expect(() => translateWith('删除', 'delete', params)).toThrow(TypeError)
  })
})
