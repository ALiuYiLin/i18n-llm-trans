# @10coding/i18n-trans

[English](./README.md) | [简体中文](./README.zh-CN.md)

[![npm version](https://img.shields.io/npm/v/@10coding/i18n-trans.svg)](https://www.npmjs.com/package/@10coding/i18n-trans)
[![license](https://img.shields.io/npm/l/@10coding/i18n-trans.svg)](https://github.com/ALiuYiLin/i18n-llm-trans/blob/master/packages/i18n-trans/LICENSE)

一个与运行时解耦的 **「源语言原文即 key」** i18n CLI：静态扫描 `t()` 调用，维护语言 JSON，
并可用 OpenAI-compatible LLM 翻译缺失文案。

- 支持 TS/TSX 与 Vue 单文件组件（`<script>` + 模板表达式）；
- `check` / `fix` / `trans` 三个能力，全程非交互；
- 原文即 key、`__TRANS_ID` 一词多译、`{name}` / `{{name}}` 插值；
- 标记化复核流程：`⟦TODO⟧` 表示缺翻译，`⟦REVIEW⟧` 表示 AI 译文待复核；
- 不发布运行时包、不绑定框架，`t()` 由应用按契约自行实现。

## 安装

```bash
pnpm add -D @10coding/i18n-trans
```

要求 Node.js `>= 20.19`。

## 快速开始

```bash
# 检查源语言 + 目标语言
npx i18n-trans check

# 补源语言 key、给目标语言写 ⟦TODO⟧ 占位
npx i18n-trans check --add --add-target

# 调用 LLM 翻译待翻译项
npx i18n-trans trans

# 删除未使用 / 多余的 key
npx i18n-trans check --remove
```

建议在应用 `package.json` 中配置脚本：

```json
{
  "scripts": {
    "i18n:check": "i18n-trans check",
    "i18n:check:source": "i18n-trans check --source",
    "i18n:check:target": "i18n-trans check --target",
    "i18n:fix": "i18n-trans check --add --add-target --remove",
    "i18n:trans": "i18n-trans trans"
  }
}
```

## 命令

| 命令 | 说明 |
| --- | --- |
| `i18n-trans check` | 检查源语言 + 目标语言 |
| `i18n-trans check --source` | 只检查源语言 |
| `i18n-trans check --target` | 只检查目标语言 |
| `i18n-trans check --add` | 补源语言缺少的 key |
| `i18n-trans check --add-target` | 给目标语言补 `⟦TODO⟧` 占位 |
| `i18n-trans check --remove` | 删除未使用 key / 多余 key |
| `i18n-trans trans` | 用 LLM 翻译待翻译项 |
| `i18n-trans trans --dry-run` | 只列出翻译单元，不调用模型 |

`trans` 还支持：`--locale <list>`、`--keys <list>`、`--limit <n>`、`--no-context`、
`--ignore`（不写 `⟦REVIEW⟧` 标记）、`--env-file <path>`。

## 配置

CLI 读取当前工作目录下的 `i18n.config.json`：

```json
{
  "include": ["src/**/*.{ts,tsx}"],
  "exclude": ["src/**/*.test.{ts,tsx}"],
  "localesDir": "src/locales",
  "sourceLocale": "zh-CN",
  "targetLocales": ["en-US"],
  "callers": ["t", "translate"],
  "transId": { "option": "__TRANS_ID", "separator": "__TRANS_ID_" },
  "translation": {
    "placeholderMarker": "⟦TODO⟧",
    "reviewMarker": "⟦REVIEW⟧",
    "batchSize": 20,
    "hints": {},
    "glossary": {}
  }
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
| `translation` | 标记、批量大小、上下文、hints、glossary、重试、JSON 模式 | 见上 |

Vue 项目把 `.vue` 加进 `include`，例如 `["src/**/*.{ts,vue}"]`；CLI 会分别解析 `<script>` 与
模板表达式。

## 语言文件

源语言文件用原文同时作为 key 和 value；目标语言复用相同 key：

```json
// src/locales/zh-CN.json
{
  "你好": "你好",
  "删除": "删除"
}
```

```json
// src/locales/en-US.json
{
  "你好": "Hello",
  "删除": "Delete",
  "删除__TRANS_ID_remove": "Remove"
}
```

`t('删除', 'remove')` 会先查目标语言的 `删除__TRANS_ID_remove`，再回退到 `删除`，最后回退到源语言原文。
完整契约见
[docs/i18n-contract.md](https://github.com/ALiuYiLin/i18n-llm-trans/blob/master/docs/i18n-contract.md)，
可复制的实现见
[docs/templates/translator.ts](https://github.com/ALiuYiLin/i18n-llm-trans/blob/master/docs/templates/translator.ts)。

## 检查规则

**源语言**

- **missing**：代码里静态 `t('...')` 用到、但源语言 JSON 没有；`--add` 会以 `"key": "key"` 追加；
- **unused**：源语言 JSON 有、但代码里既没有静态 `t()` 调用、也没有以字符串字面量出现；
  `--remove` 会删除。字面量出现视为「间接使用」，避免误删动态映射的 key。

**目标语言**

- 期望 key = 源语言全部 key + 代码中由 `__TRANS_ID` 生成的变体 key；
- **missing**：目标语言缺少的 key；默认只报告，`--add-target` 写入 `⟦TODO⟧ <原文>` 占位；
- **文件不存在 / 为空**：配置的目标语言文件缺失或内容为空时按空 locale 处理；
  `--add-target` / `fix` 会创建并写入占位，`trans` 也会在翻译前创建文件；
- **extra**：不属于期望集合的 key；`--remove` 会删除。

**动态 key**（`t(variable)`、`` t(`prefix.${id}`) ``）只报告，不参与增删。

完整 `t()` 契约见
[docs/i18n-contract.md](https://github.com/ALiuYiLin/i18n-llm-trans/blob/master/docs/i18n-contract.md)。

## 标记

| 标记 | 写入者 | 含义 |
| --- | --- | --- |
| `⟦TODO⟧ 原文` | `check --add-target` | key 存在，还没有译文 |
| `⟦REVIEW⟧ 译文` | `trans` | AI 已翻译，等待人工复核 |
| 无标记 | 人工 / `trans --ignore` | 已确认译文 |

全局搜索 `⟦TODO⟧` 可确认是否还有缺翻译；搜索 `⟦REVIEW⟧` 可找到待复核的 AI 译文。
`trans` 不会重复翻译 `⟦REVIEW⟧` 值，也不会覆盖已有译文。

## 翻译

`trans` 调用 OpenAI-compatible 的 `/chat/completions` 接口。配置来自工作目录下的 `.env`
（已 gitignore）或进程环境变量：

```bash
I18N_LLM_BASE_URL=https://api.openai.com/v1
I18N_LLM_API_KEY=sk-...
I18N_LLM_MODEL=gpt-4o-mini

# 可选
I18N_LLM_TIMEOUT_MS=60000
I18N_LLM_MAX_RETRIES=1
I18N_LLM_JSON_MODE=true
```

- 未翻译判定：目标语言缺 key、`⟦TODO⟧ <原文>` 占位，或值等于源语言原文（旧数据兼容）；
- 每次请求发送一批 unit（`translation.batchSize`，默认 20），串行执行，要求返回 JSON result；
  会校验 key 集合、非空值、以及 `{name}` / `{{name}}` 占位符（保留花括号样式）；
- 自动带入 `t()` 调用处代码片段作为上下文，`translation.hints` 可手工补充；
- AI 译文写成 `⟦REVIEW⟧ <译文>`；`--ignore` 则写不带标记的译文；
- 翻译结束后自动跑一次 `check`，仍有缺失时退出码为 1。

## 退出码

| 退出码 | 含义 |
| --- | --- |
| `0` | 没有缺失的 key（warnings 不影响退出码） |
| `1` | 仍有缺失的源语言 key 或目标语言 key |
| `2` | 配置 / 参数 / 解析错误 |

## 限制

- 只识别静态字符串字面量（含无插值模板字符串）作为 key；
- 只识别 `callers` 中列出的函数名；`const { t: tr } = useI18n()` 这类别名暂不支持；
- unused 判断是启发式的：动态 key 只能作为警告，不会让命令失败；
- `--add-target` 只写占位，真实译文由 `trans` 生成；
- `trans` 串行请求；上游限流时请调小 `batchSize` 或分次执行。

## 链接

- 仓库：<https://github.com/ALiuYiLin/i18n-llm-trans>
- 契约：<https://github.com/ALiuYiLin/i18n-llm-trans/blob/master/docs/i18n-contract.md>
- React 示例：<https://github.com/ALiuYiLin/i18n-llm-trans/tree/master/playground/react>
- Vue 示例：<https://github.com/ALiuYiLin/i18n-llm-trans/tree/master/playground/vue>
- Issues：<https://github.com/ALiuYiLin/i18n-llm-trans/issues>
