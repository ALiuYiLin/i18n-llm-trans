# i18n contract (CLI/runtime decoupling)

English | [简体中文](i18n-contract.md)

This repository only publishes the CLI tool `@10coding/i18n-trans`; **it does not provide a runtime
package**. Applications can use i18next, vue-i18n, or their own implementation, running on Vite,
webpack, SSR, or micro-frontends. As long as the data format and `t()` behavior contract below are
met, the CLI's `check` / `fix` / `trans` commands will work.

Reference implementations:

- [playground/react/src/i18n/index.ts](../playground/react/src/i18n/index.ts) (React + i18next)
- [playground/vue/src/i18n/index.ts](../playground/vue/src/i18n/index.ts) (Vue + vue-i18n)
- [templates/translator.ts](templates/translator.ts) (copyable core logic for any project)

## 1. Locale file format

- Source locale (e.g. `zh-CN.json`): **key = source text, value = source text**, i.e. an identity
  map that doubles as the translation checklist;
- Target locale (e.g. `en-US.json`): the same keys as the source locale, values are translations;
- The JSON must be **flat**; nested keys are not supported;
- A target locale may contain variant keys of the form `<source><separator><id>` for
  one-source-multiple-translations.

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

## 2. `t()` type contract

```ts
type SourceKey = keyof typeof sourceMessages
type TransId = string | number

interface TranslateOptions {
  __TRANS_ID?: TransId
  [param: string]: unknown
}

type Translate = (source: SourceKey, options?: TranslateOptions | TransId) => string
```

## 3. `t()` behavior contract

1. `t('你好')`: return the translation of `你好` in the target locale, falling back to the source
   text when it is missing;
2. `t('删除', 'remove')` is equivalent to `t('删除', { __TRANS_ID: 'remove' })`;
3. Lookup order:
   1. target locale `<source><separator><id>` (when an id is present);
   2. target locale `<source>`;
   3. source locale `<source>`;
   4. the raw source text.
4. When the current locale equals the source locale, return the raw source text directly;
5. Interpolation supports two styles, and the CLI detects and requires translations to preserve the
   same tokens (including brace style):
   - `{name}`: vue-i18n default syntax;
   - `{{name}}`: i18next default syntax;
   - A project may use only one of them; the CLI does not force a style, it only checks that
     placeholders in the source and translation correspond one-to-one;
6. Keys are arbitrary source text; i18next must disable key/namespace separators. The interpolation
   prefix may stay at the default or be changed to single braces:

```ts
i18n.init({
  fallbackLng: 'zh-CN',
  keySeparator: false,
  nsSeparator: false,
  // i18next defaults to {{name}}; enable the next line for single braces:
  // interpolation: { prefix: '{', suffix: '}' },
})
```

## 4. Marker conventions (used by the CLI, visible to the runtime)

| Marker | Written by | Meaning | Manual action |
| --- | --- | --- | --- |
| `⟦TODO⟧ source` | `i18n:fix --add-target` | key exists but has no translation yet | wait for `i18n:trans` |
| `⟦REVIEW⟧ translation` | `i18n:trans` | AI translated, waiting for human review | search for `⟦REVIEW⟧` and remove the marker |
| no marker | human / `trans --ignore` | confirmed translation | - |

- Marker names can be configured with `translation.placeholderMarker` /
  `translation.reviewMarker` in `i18n.config.json`; the two must be different;
- The runtime may display markers as-is (as a reminder that something is unfinished) or strip them
  at the presentation layer — but they must be kept in JSON for global search;
- `i18n:trans` does not re-translate `⟦REVIEW⟧` values.

## 5. CLI scanning contract

The CLI uses Babel static analysis (TS/TSX and Vue SFC), not runtime instrumentation. Therefore:

- Vue SFC: `<script>` / `<script setup>` and template expressions (`{{ ... }}`, `:prop="..."`,
  `@event="..."`) are parsed separately; directives that are not standalone JS expressions, such as
  `v-for="item in items"`, are ignored;
- Only function names listed in `callers` in `i18n.config.json` are recognized (default
  `["t", "translate"]`);
- Only static strings / template strings without interpolation are handled as the first argument;
- A string/number second argument, or `transId.option` in an object, is parsed as `__TRANS_ID`;
- Dynamic calls (`t(variable)`, `` t(`prefix.${id}`) ``) are reported only and do not participate in
  additions/removals;
- Aliases (`const { t: tr } = useI18n()`) and passing `t` as a function reference (`items.map(t)`)
  are not recognized yet;
- `transId.option` / `transId.separator` must match the key concatenation rules of the runtime
  implementation.

Configuration example:

```json
{
  "include": ["src/**/*.{ts,tsx,vue}"],
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

## 6. Adding a language / translation workflow

1. Create `src/locales/ja-JP.json` (an empty object is fine);
2. Add `ja-JP` to `targetLocales` in `i18n.config.json` and to the app's own locale list;
3. `i18n:check:target` reports what is missing;
4. `i18n:fix` writes `⟦TODO⟧ source` placeholders;
5. `i18n:trans` calls the LLM to translate (requires `.env`) and writes `⟦REVIEW⟧ translation`;
6. Search for `⟦REVIEW⟧` in the editor, review manually, and remove the markers;
7. `i18n:check` should pass.
