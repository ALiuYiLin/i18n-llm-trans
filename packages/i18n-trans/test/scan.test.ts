import { describe, expect, it } from 'vitest'
import { scanCode, scanVueSfc } from '../src/scan'
import type { I18nConfig } from '../src/types'

const options: Pick<I18nConfig, 'callers' | 'transId'> = {
  callers: ['t', 'translate'],
  transId: { option: '__TRANS_ID', separator: '__TRANS_ID_' },
}

describe('scanCode', () => {
  it('collects static t() and translate() keys', () => {
    const result = scanCode(
      `const a = t('你好'); const b = translate('删除')`,
      'src/App.tsx',
      options,
    )
    expect(result.usages.map((usage) => usage.source).sort()).toEqual(['你好', '删除'].sort())
  })

  it('accepts template literals without expressions', () => {
    const result = scanCode('t(`你好，{name}！`)', 'src/App.tsx', options)
    expect(result.usages[0]?.source).toBe('你好，{name}！')
    expect(result.dynamicUsages).toHaveLength(0)
  })

  it('reads __TRANS_ID from shorthand and object forms', () => {
    const result = scanCode(
      `t('删除', 'remove'); t('删除', { __TRANS_ID: 'delete' })`,
      'src/App.tsx',
      options,
    )
    expect(result.usages.map((usage) => usage.transIds)).toEqual([['remove'], ['delete']])
  })

  it('reports dynamic keys instead of guessing', () => {
    const result = scanCode('t(name); t(`prefix.${id}`)', 'src/App.tsx', options)
    expect(result.usages).toHaveLength(0)
    expect(result.dynamicUsages).toHaveLength(2)
    expect(result.dynamicUsages[0]?.line).toBe(1)
  })

  it('ignores other callees and member expressions', () => {
    const result = scanCode(`foo('x'); runtime.t('y'); obj.translate('z')`, 'src/App.tsx', options)
    expect(result.usages).toHaveLength(0)
  })

  it('collects every string literal for the unused-key heuristic', () => {
    const result = scanCode(`const keys = ['动态键']; t(keys[0])`, 'src/App.tsx', options)
    expect(result.literals.has('动态键')).toBe(true)
    expect(result.dynamicUsages).toHaveLength(1)
  })

  it('scans Vue single-file component scripts and template expressions', () => {
    const sfc = [
      '<template>',
      "  <h1>{{ t('你好，{name}！', { name: t('朋友') }) }}</h1>",
      '  <button :title="t(\'删除\', \'remove\')">{{ t(\'删除\') }}</button>',
      '</template>',
      '<script setup lang="ts">',
      "import { useI18n } from './i18n'",
      'const { t } = useI18n()',
      "const saved = t('保存')",
      '</script>',
    ].join('\n')

    const result = scanVueSfc(sfc, 'src/App.vue', options)

    expect(result.usages.map((usage) => usage.source).sort()).toEqual(
      ['你好，{name}！', '保存', '删除', '删除', '朋友'].sort(),
    )
    expect(result.dynamicUsages).toHaveLength(0)
  })
})
