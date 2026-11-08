# @10coding/i18n-llm-trans-cli

静态扫描 `t()` 调用（Babel），检查并维护「源语言原文即 key」的语言 JSON 文件的 CLI。

- 统计代码中的静态 `t()` key，与 `locales/*.json` 对比；
- 报告源语言缺失 / 未使用、目标语言缺失译文 / 多余 key；
- `--add` 补源语言 key（identity 值），`--remove` 删除未使用 / 多余的 key；
- 支持 `__TRANS_ID` 一词多译：自动推导 `删除__TRANS_ID_remove` 这类目标语言 key；
- `trans` 子命令通过 OpenAI-compatible LLM 翻译未翻译 / 占位 key（`.env` 配置 API）；
- 纯非交互：CI 里直接跑，靠退出码判断。

## 使用

```bash
pnpm add -D @10coding/i18n-llm-trans-cli

# 默认检查源语言 + 目标语言
i18n-llm-trans check

# 只检查源语言 / 只检查目标语言
i18n-llm-trans check --source
i18n-llm-trans check --target

# 补源语言缺少的 key、给目标语言补占位 key、删除未使用 / 多余 key
i18n-llm-trans check --add
i18n-llm-trans check --add-target
i18n-llm-trans check --remove
i18n-llm-trans check --add --add-target --remove

# 给目标语言补 marker 占位 key（之后用 trans 翻译）
i18n-llm-trans check --target --add-target

# 用 LLM 翻译未翻译 / 占位 key
i18n-llm-trans trans
i18n-llm-trans trans --dry-run
```

| 参数 | 说明 |
| --- | --- |
| `--source` | 只检查源语言 |
| `--target` | 只检查目标语言 |
| `--add` | 补源语言缺少的 key，值为 key 本身 |
| `--add-target` | 补目标语言缺少的 key，值写成 marker 占位（如 `⟦TODO⟧ 你好`） |
| `--remove` | 删除源语言未使用 key 与目标语言多余 key |

建议在应用 `package.json` 里配置：

```json
{
  "scripts": {
    "i18n:check": "i18n-llm-trans check",
    "i18n:check:source": "i18n-llm-trans check --source",
    "i18n:check:target": "i18n-llm-trans check --target",
    "i18n:fix": "i18n-llm-trans check --add --add-target --remove",
    "i18n:trans": "i18n-llm-trans trans"
  }
}
```

## 配置

CLI 读取工作目录下的 `i18n.config.json`：

```json
{
  "include": ["src/**/*.{ts,tsx}"],
  "exclude": ["src/**/*.test.{ts,tsx}"],
  "localesDir": "src/locales",
  "sourceLocale": "zh-CN",
  "targetLocales": ["en-US"],
  "callers": ["t", "translate"],
  "transId": { "option": "__TRANS_ID", "separator": "__TRANS_ID_" }
}
```

| 字段 | 说明 | 默认值 |
| --- | --- | --- |
| `include` | 扫描文件 glob | `["src/**/*.{ts,tsx}"]` |
| `exclude` | 忽略 glob | 测试文件、`.d.ts` |
| `localesDir` | 语言 JSON 目录 | `src/locales` |
| `sourceLocale` | 源语言（必填） | - |
| `targetLocales` | 目标语言列表 | `localesDir` 下除源语言外的全部文件 |
| `callers` | 视为翻译调用的函数名 | `["t", "translate"]` |
| `transId` | 一词多译标记 | `__TRANS_ID` / `__TRANS_ID_` |
| `translation` | 翻译配置：`placeholderMarker` / `batchSize` / `contextLines` / `hints` / `glossary` / `ignoreKeys` / `maxRetries` / `jsonMode` | 见下方

## 检查规则

**源语言（`i18n:check:source`）**

- missing：代码里静态 `t('...')` 用到、但源语言 JSON 没有的 key；`--add` 会以 `"key": "key"` 追加；
- unused：源语言 JSON 有、但代码里既没有静态 `t()` 调用、也没有以字符串字面量出现的 key；
  `--remove` 会删除。字面量出现也算「使用中」，用于兼容通过数组/映射间接取 key 的写法。

**目标语言（`i18n:check:target`）**

- 期望 key = 源语言全部 key + 代码中通过 `__TRANS_ID` 生成的变体 key（如 `删除__TRANS_ID_remove`）；
- missing：目标语言缺少的 key，默认只报告；`--add-target` 会用源语言原文作为占位值写入，
  之后仍需人工 / LLM 翻译（占位值不是译文）；
- extra：目标语言里不属于上述期望集合的 key，`--remove` 会删除。

**动态 key**

`t(variable)`、`` t(`prefix.${id}`) `` 无法静态分析，只报告、不参与增删判断。

## 翻译（trans）

`trans` 通过 OpenAI-compatible 的 `/chat/completions` 接口翻译目标语言里未翻译的 key。

### `.env`

在应用目录（`i18n.config.json` 所在处）创建 `.env`（已 gitignore，参考 `.env.example`）：

```bash
I18N_LLM_BASE_URL=https://api.openai.com/v1
I18N_LLM_API_KEY=sk-...
I18N_LLM_MODEL=gpt-4o-mini
# 可选
I18N_LLM_TIMEOUT_MS=60000
I18N_LLM_MAX_RETRIES=1
I18N_LLM_JSON_MODE=true
```

已有的 `process.env` 优先于 `.env`；也可用 `--env-file <path>` 指定文件。缺变量时直接报错退出（不发网络请求）。

### 未翻译判定

- 目标 JSON 缺少该 key；
- 值是 marker 占位（`translation.placeholderMarker`，默认 `⟦TODO⟧`）；
- 兼容旧数据：值等于源语言原文也算未翻译（用 `translation.ignoreKeys` 排除本来就应该相同的词）。

判定完全基于 key 集合与标记，不依赖模型。

### 上下文

- 自动：扫描阶段记录了每个 `t()` 的 `file:line`，翻译时把该行（`contextLines` 可扩到前后 N 行）
  作为 `context` 发给模型；
- 手工：`translation.hints` 按 key 覆盖/补充语义说明（优先级高于自动片段）。

```json
"hints": {
  "删除__TRANS_ID_remove": "从角色组移出用户，不是销毁数据"
}
```

### 行为

- 一次请求发送 `unit[]`（受 `translation.batchSize` 限制，串行、不并发），要求返回 `result[]`；
- 校验响应：key 集合一致、值非空、`{name}` 等占位符一致；失败按 `maxRetries` 重试，
  仍失败则记录错误、不写入坏数据；
- 只替换未翻译 / 占位值，**不覆盖已有译文**；
- 完成后自动跑一次 `i18n-llm-trans check`，仍有缺失时退出码为 1；
- `--dry-run` 只列出待翻译 unit，不调用模型、不需要 `.env`。

```bash
i18n-llm-trans trans
i18n-llm-trans trans --dry-run
i18n-llm-trans trans --locale en-US --limit 20
i18n-llm-trans trans --keys "你好啊哈,保存成功"
i18n-llm-trans trans --no-context
```

## 退出码

| 退出码 | 含义 |
| --- | --- |
| `0` | 没有缺失的 key（warnings 不影响退出码） |
| `1` | 仍有缺失的源语言 key 或目标语言 key |
| `2` | 配置 / 参数 / 解析错误 |

## 限制

- 只识别静态字符串字面量（含无插值模板字符串）作为第一个参数；
- 只识别 `callers` 中列出的函数名，别名（`const { t: tr } = useI18n()`）暂不支持；
- unused 判断是启发式的：动态 key 无法覆盖，只作为警告，不会让 CI 失败；
- `--add-target` 只写 marker 占位，真实译文由 `trans` 生成；
- `trans` 不并发请求；上游限流时请调小 `batchSize` 或分次执行。
