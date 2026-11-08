# i18n-llm-trans

基于 **pnpm workspace + Vite + TypeScript** 的前端多语言演练仓库，`playground/` 下包含
**Vue** 与 **React** 两个独立应用，二者使用完全相同的界面结构、语言资源键名与语言切换行为，
便于对比两套 i18n 方案，也便于后续接入 LLM 批量翻译语言包。

## 目录结构

```
i18n-llm-trans/
├─ package.json            # workspace 根：统一脚本入口
├─ pnpm-workspace.yaml     # workspace 声明：playground/*
├─ playground/
│  ├─ vue/                 # Vue 3 + Vite + TS + vue-i18n
│  │  ├─ src/locales/      # en-US.json / zh-CN.json
│  │  ├─ src/i18n/         # i18n 实例、语言检测、语言切换
│  │  └─ src/components/LanguageSwitcher.vue
│  └─ react/               # React 19 + Vite + TS + react-i18next
│     ├─ src/locales/      # en-US.json / zh-CN.json
│     ├─ src/i18n/         # i18n 实例、语言检测、语言切换
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

两个 playground 的界面与交互完全一致（下图：浏览器语言为中文时的默认渲染）：

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

两个 playground 的行为保持一致：

1. **语言资源文件**：`src/locales/en-US.json`、`src/locales/zh-CN.json`，由 Vite 直接打包；
   两个应用使用相同的键名与占位符写法（单花括号 `{name}`），方便统一维护 / 机器翻译。
   React 侧通过 i18next 的 `interpolation.prefix/suffix` 配置对齐这一写法。
2. **自动检测**：首次访问依次尝试
   `localStorage` 中的偏好 → 浏览器语言（`zh-*` 命中中文）→ 默认 `en-US`。
3. **手动切换**：页面右上角的语言下拉框，切换后所有文案即时更新，不会刷新页面。
4. **偏好持久化**：选择结果写入 `localStorage`（键：`i18n-playground:locale`），下次访问自动恢复。
5. **文档元信息同步**：切换语言时同步更新 `<html lang>` 与 `document.title`。
6. **本地化格式**：演示用 `Intl.DateTimeFormat` / `Intl.NumberFormat` 按当前语言格式化日期与数字。

对应实现：

- Vue：`vue-i18n` 的 Composition API（`createI18n({ legacy: false })` + `useI18n()`）。
- React：`i18next` + `react-i18next`（`initReactI18next` + `useTranslation()`）。

### 新增一种语言

以 `ja-JP` 为例，两个应用各做同样的改动：

1. 新增 `src/locales/ja-JP.json`，键名与现有语言包保持一致。
2. 在 `src/i18n/index.ts` 中：
   - 把 `'ja-JP'` 加入 `SUPPORTED_LOCALES`；
   - 在 `LOCALE_LABELS` 中补充显示名称（如 `日本語`）；
   - 在初始化 `messages` / `resources` 时引入该 JSON。
3. 浏览器语言检测若需要支持日语，补充对应的 `startsWith` 判断即可。
