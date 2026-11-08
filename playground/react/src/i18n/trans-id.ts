/**
 * 「一词多译」标记配置（配合中文键 / 中文值方案使用）。
 *
 * 默认使用 `__TRANS_ID`：
 *
 *   t('删除', { __TRANS_ID: 'delete' })  ->  资源键 `删除__TRANS_ID_delete`
 *
 * 如果团队约定想换成别的名字（例如 `__XXX_ID`），只改这里的配置即可：
 *
 *   option: '__XXX_ID',
 *   separator: '__XXX_ID_',
 *
 * 之后调用方式变成 `t('删除', { __XXX_ID: 'delete' })`，资源键也变成
 * `删除__XXX_ID_delete`，TypeScript 类型会自动跟随，无需改 i18n 实现。
 *
 * 注意：`separator` 必须与 `en-US.json` 中的键保持一致；`zh-CN.json` 始终
 * 使用中文原文作为键，不需要带标记。
 */
export const transIdConfig = {
  /** `t()` 的选项名。 */
  option: '__TRANS_ID',
  /** 资源键分隔符，最终键为 `<中文原文><separator><id>`。 */
  separator: '__TRANS_ID_',
} as const

export type TransIdOption = typeof transIdConfig.option
export type TransIdSeparator = typeof transIdConfig.separator
export type TransId = string | number

/** `t()` 选项里被配置的标记字段。 */
export type TransIdOptions = { [K in TransIdOption]?: TransId }
