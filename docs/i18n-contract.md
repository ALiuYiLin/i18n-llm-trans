# i18n 契约（CLI 与运行时解耦）

本仓库只发布 CLI 工具 `@10coding/i18n-llm-trans-cli`，**不提供运行时包**。
应用可以选择 i18next、vue-i18n、自研实现，跑在 Vite / webpack / SSR / 微前端都可以，
只要满足下面的数据格式与 `t()` 行为契约，CLI 的 `check` / `fix` / `trans` 就能工作。

参考实现：

- [playground/react/src/i18n/index.ts](../playground/react/src/i18n/index.ts)（React + i18next，完整示例）
- [templates/translator.ts](templates/translator.ts)（可复制到任意项目的核心逻辑）

## 1. 语言文件格式

- 源语言（如 `zh-CN.json`）：**键 = 源语言原文，值 = 原文**，即 identity map，同时充当待翻译清单；
- 目标语言（如 `en-US.json`）：键与源语言一致，值为译文；
- 必须是**扁平 JSON**，不支持嵌套 key；
- 目标语言可以出现 `<原文><separator><id>` 形式的变体键，用于一词多译。

```json
// zh-CN.json
{
  "你好": "你好",
  "删除": "删除"
}
```

```json
// en-US.json
{
  "你好": "Hello",
  "删除": "Delete",
  "删除__TRANS_ID_remove": "Remove"
}
```

## 2. `t()` 类型契约

```ts
type SourceKey = keyof typeof sourceMessages
type TransId = string | number

interface TranslateOptions {
  __TRANS_ID?: TransId
  [param: string]: unknown
}

type Translate = (source: SourceKey, options?: TranslateOptions | TransId) => string
```

## 3. `t()` 行为契约

1. `t('你好')`：目标语言取 `你好` 的译文，缺失则回退源语言原文；
2. `t('删除', 'remove')` 等价于 `t('删除', { __TRANS_ID: 'remove' })`；
3. 查找顺序：
   1. 目标语言 `<原文><separator><id>`（有 id 时）；
   2. 目标语言 `<原文>`；
   3. 源语言 `<原文>`；
   4. 原文本身。
4. 当前语言 == 源语言时，直接返回原文；
5. 插值支持两种写法，CLI 自动识别并要求译文保留相同 token（含花括号样式）：
   - `{name}`：vue-i18n 默认写法；
   - `{{name}}`：i18next 默认写法；
   - 也允许整个项目只用其中一种；CLI 不做强制，只看源文与译文的占位符是否一一对应；
6. key 是任意原文，i18next 必须关闭 key/namespace 分隔；插值前缀可保持默认，也可改成单花括号：

```ts
i18n.init({
  fallbackLng: 'zh-CN',
  keySeparator: false,
  nsSeparator: false,
  // i18next 默认 {{name}}；如需单花括号再打开下面这行：
  // interpolation: { prefix: '{', suffix: '}' },
})
```

## 4. 标记约定（CLI 使用，运行时可见）

| 标记 | 写入者 | 含义 | 人工处理 |
| --- | --- | --- | --- |
| `⟦TODO⟧ 原文` | `i18n:fix --add-target` | key 存在但还没有译文 | 等 `i18n:trans` |
| `⟦REVIEW⟧ 译文` | `i18n:trans` | AI 已翻译，等待人工复核 | 编辑器全局搜索 `⟦REVIEW⟧` 删除标记 |
| 无标记 | 人工 / `trans --ignore` | 已确认译文 | - |

- 标记名可在 `i18n.config.json` 的 `translation.placeholderMarker` / `translation.reviewMarker` 配置，二者必须不同；
- 运行时可以把标记原样显示（提醒未完成），也可以在展示层去掉标记——但 JSON 里要保留，供全局搜索；
- `i18n:trans` 不会重复翻译 `⟦REVIEW⟧` 值。

## 5. CLI 扫描契约

CLI 用 Babel 静态分析，不是运行时插桩，因此：

- 只识别 `i18n.config.json` 中 `callers` 列出的函数名（默认 `["t", "translate"]`）；
- 只处理静态字符串 / 无插值模板字符串作为第一个参数；
- 第二个参数的字符串/数字或对象里的 `transId.option` 会解析为 `__TRANS_ID`；
- 动态调用（`t(variable)`、`` t(`prefix.${id}`) ``）只报告，不参与增删；
- 别名（`const { t: tr } = useI18n()`）、传参（`items.map(t)`）目前不识别；
- `transId.option` / `transId.separator` 必须与运行时实现的键拼接规则一致。

配置示例：

```json
{
  "include": ["src/**/*.{ts,tsx}"],
  "localesDir": "src/locales",
  "sourceLocale": "zh-CN",
  "targetLocales": ["en-US", "ja-JP"],
  "callers": ["t", "translate"],
  "transId": { "option": "__TRANS_ID", "separator": "__TRANS_ID_" },
  "translation": {
    "placeholderMarker": "⟦TODO⟧",
    "reviewMarker": "⟦REVIEW⟧",
    "batchSize": 20
  }
}
```

## 6. 新增语言 / 翻译流程

1. 新建 `src/locales/ja-JP.json`（空对象即可）；
2. 把 `ja-JP` 加入 `i18n.config.json` 的 `targetLocales`，以及应用自己的语言列表；
3. `i18n:check:target` 会报告缺失；
4. `i18n:fix` 补 `⟦TODO⟧ 原文` 占位；
5. `i18n:trans` 调用 LLM 翻译（需要 `.env`），写出 `⟦REVIEW⟧ 译文`；
6. 编辑器全局搜索 `⟦REVIEW⟧` 人工复核并去掉标记；
7. `i18n:check` 应通过。
