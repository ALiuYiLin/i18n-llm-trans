import type { i18n as I18nInstance } from 'i18next'

/**
 * 可复制到任意项目的 t() 参考实现（不含 React/Vue 绑定）。
 *
 * 用法：
 *   const t = createTranslate<keyof typeof zhCN>({ i18n, sourceLocale: 'zh-CN' })
 *   t('你好')
 *   t('删除', 'remove')
 *   t('删除', { __TRANS_ID: 'remove' })
 *
 * 完整约定见 ../i18n-contract.md。
 */

export const TRANS_ID_OPTION = '__TRANS_ID'
export const TRANS_ID_SEPARATOR = '__TRANS_ID_'

export type TransId = string | number

export interface TranslateOptions {
  __TRANS_ID?: TransId
  [param: string]: unknown
}

export type Translate<SourceKey extends string = string> = (
  source: SourceKey,
  options?: TranslateOptions | TransId,
) => string

export interface CreateTranslateOptions {
  i18n: I18nInstance
  sourceLocale: string
  transIdOption?: string
  transIdSeparator?: string
}

export function createTranslate<SourceKey extends string = string>(
  options: CreateTranslateOptions,
): Translate<SourceKey> {
  const { i18n, sourceLocale } = options
  const transIdOption = options.transIdOption ?? TRANS_ID_OPTION
  const transIdSeparator = options.transIdSeparator ?? TRANS_ID_SEPARATOR

  const currentLocale = (): string => i18n.resolvedLanguage ?? i18n.language
  const lookup = (key: string, params: Record<string, unknown>): string =>
    i18n.t(key, params as never) as unknown as string

  return ((source: SourceKey, translateOptions?: TranslateOptions | TransId): string => {
    const normalized: TranslateOptions =
      typeof translateOptions === 'object' && translateOptions !== null
        ? translateOptions
        : ({ [transIdOption]: translateOptions as TransId } as TranslateOptions)

    const { [transIdOption]: transId, ...params } = normalized
    const needsTarget = transId !== undefined && currentLocale() !== sourceLocale
    const key = needsTarget ? `${source}${transIdSeparator}${transId}` : source

    const result = lookup(key, params)
    if (needsTarget && result === key) {
      // 变体缺失：回退到基础文案（目标语言 → 源语言 → 原文）。
      return lookup(source, params)
    }
    return result
  }) as Translate<SourceKey>
}
