# i18n-llm-trans

基于 **pnpm workspace + Vite + TypeScript** 的前端多语言演练仓库，`playground/` 下包含
**Vue** 与 **React** 两个独立应用。两者界面与语言切换行为一致，但语言资源约定不同：

- **Vue**：`vue-i18n`，使用语义化 key（如 `features.localeFiles.title`）。
- **React**：`react-i18next`，使用**中文键 / 中文值**（中文原文就是 key），并通过
  `__TRANS_ID` 支持「一词多译」。

便于对比两种维护方式，也便于后续接入 LLM 批量翻译语言包。

## 目录结构

```
i18n-llm-trans/
├─ package.json            # workspace 根：统一脚本入口
├─ pnpm-workspace.yaml     # workspace 声明：playground/*
├─ playground/
│  ├─ vue/                 # Vue 3 + Vite + TS + vue-i18n
│  │  ├─ src/locales/      # en-US.json / zh-CN.json（语义化 key）
│  │  ├─ src/i18n/         # i18n 实例、语言检测、语言切换
│  │  └─ src/components/LanguageSwitcher.vue
│  └─ react/               # React 19 + Vite + TS + react-i18next
│     ├─ src/locales/      # en-US.json / zh-CN.json（中文键 / 中文值）
│     ├─ src/i18n/         # i18n 实例、中文键查找、__TRANS_ID、useI18n
│     ├─ src/app-config.ts # 各语言一致的静态标识
│     └─ src/components/LanguageSwitcher.tsx
└─ README.md
```

## 快速开始

环境要求：Node.js `>= 20.19`、pnpm。

```bash
pnpm install

# 分别启动两个 playground
pnpm dev:vue      # http://localhost:5173
pnpm dev:react    # http://localhost:5174
```

## 预览

下图是浏览器语言为中文时的默认渲染（React 页面底部带「一词多译」演示）：

| Vue 3                                                                                          | React 19                                                                                            |
| ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| ![Vue playground](docs/vue-preview.png) | ![React playground](docs/react-preview.png) |

## 常用脚本

| 命令                | 说明                                        |
| ------------------- | ------------------------------------------- |
| `pnpm dev:vue`      | 启动 Vue playground 开发服务器（5173）      |
| `pnpm dev:react`    | 启动 React playground 开发服务器（5174）    |
| `pnpm build`        | 递归构建全部应用（先类型检查再打包）        |
| `pnpm build:vue`    | 仅构建 Vue 应用                             |
| `pnpm build:react`  | 仅构建 React 应用                           |
| `pnpm typecheck`    | 递归执行类型检查（`vue-tsc -b` / `tsc -b`） |
| `pnpm preview:vue`  | 预览 Vue 应用的生产构建                     |
| `pnpm preview:react`| 预览 React 应用的生产构建                   |

## 多语言能力

两个 playground 共同具备的行为：

1. **语言资源文件**：`src/locales/en-US.json`、`src/locales/zh-CN.json`，由 Vite 直接打包。
2. **自动检测**：首次访问依次尝试 `localStorage` 偏好 → 浏览器语言 → 默认语言。
   - Vue：`zh-*` 命中中文，其余浏览器默认 `en-US`。
   - React：`zh-*` / `en-*` 分别命中中文 / 英文，其余浏览器语言（或 SSR）使用中文源语言。
3. **手动切换**：页面右上角的语言下拉框，切换后所有文案即时更新，不会刷新页面。
4. **偏好持久化**：选择结果写入 `localStorage`（键：`i18n-playground:locale`），下次访问自动恢复。
5. **文档元信息同步**：切换语言时同步更新 `<html lang>` 与 `document.title`。
6. **本地化格式**：演示用 `Intl.DateTimeFormat` / `Intl.NumberFormat` 按当前语言格式化日期与数字。
7. **占位符**：两端统一使用单花括号 `{name}`（React 侧通过 i18next 的
   `interpolation.prefix/suffix` 对齐）。

对应实现：

- Vue：`createI18n({ legacy: false })` + `useI18n()`。
- React：`initReactI18next` + 自定义 `useI18n()`（见下节）。

### React：中文键 / 中文值 + `__TRANS_ID`

React 应用采用「中文原文即 key」的方案：

- `zh-CN.json`：键 = 中文原文，值 = 中文原文，同时作为待翻译文案清单。
- `en-US.json`：键与 `zh-CN.json` 相同，值为对应译文。

```jsonc
// playground/react/src/locales/zh-CN.json
{ "你好": "你好" }

// playground/react/src/locales/en-US.json
{ "你好": "hello" }
```

同一个中文原文在不同场景需要不同译文时，调用时传入 `__TRANS_ID`。例如中文都叫「删除」，
英文却必须区分永久销毁的 delete 与仅解除关联的 remove——后台按钮混用会直接误导用户：

```ts
const { t } = useI18n()

t('删除', { __TRANS_ID: 'delete' }) // → en-US.json: { "删除__TRANS_ID_delete": "Delete" }
t('删除', 'remove') // 简写，等价于 { __TRANS_ID: 'remove' } → "Remove"
```

规则与约束：

- 实际查找的键是 `<中文原文>__TRANS_ID_<id>`，`id` 可以是字符串或数字。
- 第二个参数支持简写：`t('删除', 'remove')` 等价于 `t('删除', { __TRANS_ID: 'remove' })`，
  且不依赖标记名配置（改成 `__XXX_ID` 后依然可用）。
- 目标语言缺少该变体时，回退到基础文案的译文；再缺失则回退到中文源文案。
- `zh-CN` 是源语言，始终直接展示中文原文，不会查找带 `__TRANS_ID` 的键。
- 组件内必须使用 `useI18n()` 返回的 `t`（而非 `useTranslation()`），`__TRANS_ID` 才会生效。
- `t()` 的入参在编译期被约束为 `zh-CN.json` 中存在的键；`en-US.json` 中若出现不属于
  中文键、也不符合 `<中文键>__TRANS_ID_<id>` 格式的键，同样会直接类型报错。
- React 页面底部的「一词多译」区块就是 `__TRANS_ID` 的实时演示：
  中文下两个按钮都显示「删除」，英文下分别显示 `Delete` / `Remove`，并各自附上语义说明。

英文界面中同一区块的渲染效果：

![React 英文界面中的 delete / remove](docs/react-delete-remove-en.png)

#### 自定义标记名

标记名与资源键分隔符集中在 [trans-id.ts](playground/react/src/i18n/trans-id.ts)，只改这一处即可
把 `__TRANS_ID` 换成 `__XXX_ID` 等任意命名：

```ts
export const transIdConfig = {
  option: '__TRANS_ID', // t() 的选项名
  separator: '__TRANS_ID_', // 资源键分隔符
} as const
```

例如改成 `__XXX_ID`：

```ts
export const transIdConfig = {
  option: '__XXX_ID',
  separator: '__XXX_ID_',
} as const
```

```ts
t('删除', { __XXX_ID: 'delete' }) // → en-US.json: { "删除__XXX_ID_delete": "Delete" }
```

`TranslateOptions`、`MessageKey` 的编译期校验都从该配置推导：改完配置后，若资源键
（`删除__XXX_ID_delete`）或调用方式没同步，TypeScript 会直接报错。

### 新增一种语言

以 `ja-JP` 为例，两个应用各做同样的改动：

1. 新增 `src/locales/ja-JP.json`：
   - Vue：键名与现有语言包保持一致；
   - React：键名保持中文原文，值为日文译文。
2. 在 `src/i18n/index.ts` 中：
   - 把 `'ja-JP'` 加入 `SUPPORTED_LOCALES`；
   - 在 `LOCALE_LABELS` 中补充显示名称（如 `日本語`）；
   - 初始化时引入该 JSON（Vue 的 `messages` / React 的 `resources`）。
3. 如需按浏览器语言自动选择，在 `detectLocale` 中补充 `startsWith('ja')` 判断。
