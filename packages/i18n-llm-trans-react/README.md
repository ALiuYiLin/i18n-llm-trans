# @10coding/i18n-llm-trans-react

基于 **源语言原文即 key（source-text-as-key）** 的 React i18n 运行时，支持 `__TRANS_ID`
一词多译，底层使用 [i18next](https://www.i18next.com/) + [react-i18next](https://react.i18next.com/)。

- 源语言由 `sourceLocale` 指定（本仓库示例为 `zh-CN`）：源语言文件「键 = 原文，值 = 原文」，
  目标语言文件用同样的原文 key 映射译文；
- 不绑定中文：任意语言都可以作为源语言，见下方「可以用其他语言作为 key 吗？」；
- 同一个原文需要多种译文时，用 `t('删除', { __TRANS_ID: 'delete' })` 区分，
  简写 `t('删除', 'delete')` 等价；
- 标记名、分隔符、检测顺序、存储 key、标题模板全部可配置；
- 类型从源语言 JSON 推导，`t()` 的 key 有编译期校验。

## 安装

```bash
pnpm add @10coding/i18n-llm-trans-react
# peerDependencies（宿主应用自行安装）
pnpm add react i18next react-i18next
```

## 快速开始

```ts
// src/i18n/index.ts
import { createI18nRuntime } from '@10coding/i18n-llm-trans-react'
import zhCN from '../locales/zh-CN.json'
import enUS from '../locales/en-US.json'

export const runtime = createI18nRuntime({
  messages: { 'zh-CN': zhCN, 'en-US': enUS },
  sourceLocale: 'zh-CN',
  detection: { storageKey: 'my-app:locale' },
  document: {
    title: (t) => `${t('i18n 演练场')} · My App`,
  },
})

export const {
  i18nReady,
  useI18n,
  translate,
  setLocale,
  applyDocumentMetadata,
} = runtime
```

```json
// src/locales/zh-CN.json
{ "你好": "你好", "删除": "删除" }
```

```json
// src/locales/en-US.json
{
  "你好": "hello",
  "删除__TRANS_ID_delete": "Delete",
  "删除__TRANS_ID_remove": "Remove"
}
```

```tsx
import { useI18n } from './i18n'

export function Demo() {
  const { t, locale, setLocale } = useI18n()
  return (
    <>
      <p>{locale}</p>
      <p>{t('你好')}</p>
      <button onClick={() => setLocale('en-US')}>{t('删除', 'delete')}</button>
    </>
  )
}
```

## RuntimeOptions

| 选项 | 说明 | 默认值 |
| --- | --- | --- |
| `messages` | 语言资源，源语言的键为原文 | 必填 |
| `sourceLocale` | 源语言（key 所在语言，不限于中文） | `messages` 第一个 key |
| `fallbackLocale` | 缺翻译时的回退语言 | `sourceLocale` |
| `supportedLocales` | 支持的语言列表 | `Object.keys(messages)` |
| `detection` | `{ order, storageKey, storage, normalize }` 或 `false` | `['storage','browser','default']` |
| `transId` | `{ option, separator, shorthand }`，默认 `__TRANS_ID` / `__TRANS_ID_` / `true` | - |
| `document` | `{ lang, title }` 或 `false` | `{ lang: true }` |
| `interpolation` | `{ prefix, suffix }`，默认单花括号 `{name}` | - |
| `i18next` | 透传给 `i18next.init` 的逃生舱配置 | - |

## 回退规则

1. 当前语言 `<原文><separator><id>`；
2. 缺失时用基础 `<原文>` 的当前语言译文；
3. 再缺失时回退到源语言原文；
4. 源语言始终直接展示原文。

## 可以用其他语言作为 key 吗？

可以。运行时只认「源语言（`sourceLocale`）的键」，不关心键里是不是中文。把
`sourceLocale` 设为英文即可用英文原文做 key：

```ts
createI18nRuntime({
  sourceLocale: 'en-US',
  messages: {
    'en-US': { 'Delete': 'Delete', 'Settings': 'Settings' },
    'zh-CN': {
      'Delete': '删除',
      'Delete__TRANS_ID_remove': '移除',
      'Settings': '设置',
    },
  },
})
```

```ts
t('Delete') // zh-CN → 删除；en-US → Delete
t('Delete', 'remove') // zh-CN → 移除
```

包内没有硬编码 `zh-CN`：`sourceLocale`、`fallbackLocale`、语言检测、`__TRANS_ID`
标记配置都与语言无关。本仓库的 playground 与文档示例选择中文，只是演示用法。

注意：如果源语言文本里包含 `.`、`:`、`{`、`}` 等特殊字符，i18next 默认会当成 key /
插值语法；本包已关闭 keySeparator、nsSeparator，插值符号也可以通过 `interpolation`
配置成别的形式。

## 说明

- 单实例约定：每个应用只调用一次 `createI18nRuntime`，然后从自己的 `src/i18n/index.ts`
  重新导出所需的 API；
- 本包使用 i18next 默认实例，便于与 `react-i18next` 的 `useTranslation` / `<Trans>` 直接互操作；
- 不提供 SSR 专项支持；如需在无 DOM 环境使用，请自行确保语言检测参数可预期；
- `react`、`i18next`、`react-i18next` 为 peerDependencies，避免重复实例；
- 同时提供 ESM（`dist/index.js`）与 CJS（`dist/index.cjs`）构建。
