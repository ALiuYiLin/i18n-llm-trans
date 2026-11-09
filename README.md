# i18n-llm-trans

English | [简体中文](README.zh-CN.md)

A runtime-agnostic i18n workflow CLI: it scans `t()` calls, maintains locale JSON files, and
optionally calls an LLM for translations. There is no React/Vue runtime package — implement `t()`
in your app following the [contract](docs/i18n-contract.en.md).

- **`i18n:check`**: statically scan `t()` calls with Babel (TS/TSX and Vue SFC), diff source and
  target locale JSON, and report missing, unused, and extra keys;
- **`i18n:fix`**: add source keys, write `⟦TODO⟧` placeholders for target locales, and remove
  unused/extra keys;
- **`i18n:trans`**: translate pending keys with an OpenAI-compatible LLM and write `⟦REVIEW⟧`
  entries for human review;
- **Runtime-agnostic**: works with Vite, webpack, SSR, micro-frontends, React, Vue, or anything else
  as long as the JSON format and the `t()` contract are respected.

## Why no runtime package

Runtime environments differ too much (build tools, SSR, multiple instances, i18next versions,
micro-frontends, …), so a generic wrapper package is unlikely to cover every setup. The CLI only
depends on two things: the JSON key format and the shape of `t()` calls. This repository therefore
maintains only the CLI and leaves the runtime to the application:

- Contract and type template: [docs/i18n-contract.en.md](docs/i18n-contract.en.md),
  [docs/templates/translator.ts](docs/templates/translator.ts)
- React reference implementation: [playground/react/src/i18n/index.ts](playground/react/src/i18n/index.ts)
- Vue reference implementation: [playground/vue/src/i18n/index.ts](playground/vue/src/i18n/index.ts)

## Repository layout

```
i18n-llm-trans/
├─ package.json
├─ pnpm-workspace.yaml
├─ packages/
│  └─ i18n-trans/                # @10coding/i18n-trans
│     ├─ src/                    # scan / check / fix / trans / LLM client
│     ├─ test/                   # vitest
│     └─ dist/                   # build output
├─ playground/
│  ├─ react/                     # React + i18next reference implementation
│  │  ├─ src/i18n/index.ts       # local t() implementation (not published)
│  │  ├─ src/locales/            # zh-CN / en-US / ja-JP
│  │  └─ i18n.config.json
│  └─ vue/                       # Vue + vue-i18n reference implementation
│     ├─ src/i18n/index.ts       # local t() implementation (not published)
│     ├─ src/locales/            # zh-CN / en-US (source text as keys)
│     └─ i18n.config.json
├─ docs/
│  ├─ i18n-contract.md, .en.md    # data format + t() behavior contract
│  ├─ templates/translator.ts    # copyable t() core implementation
│  └─ *.png                      # preview screenshots
└─ README.md
```

## Quick start

Requirements: Node.js `>= 20.19` and pnpm.

```bash
pnpm install

# check locale files (source + targets)
pnpm i18n:check

# add keys / placeholders
pnpm i18n:fix

# translate with an LLM (configure a model in the playground's .env first)
pnpm i18n:trans

pnpm dev:react    # http://localhost:5174
pnpm dev:vue      # http://localhost:5173
```

## Preview

| Vue 3 (source-text keys)                                                                       | React 19 (source-text keys + review markers)                                                         |
| ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| ![Vue playground](docs/vue-preview.png) | ![React playground](docs/react-preview.png) |

## Common scripts

| Command | Description |
| --- | --- |
| `pnpm dev:vue` | Start the Vue playground (5173) |
| `pnpm dev:react` | Start the React playground (5174) |
| `pnpm build` | Recursively build the CLI + both playgrounds |
| `pnpm build:cli` | Build only the CLI package |
| `pnpm build:vue` / `pnpm build:react` | Build only the corresponding app |
| `pnpm typecheck` | Recursive type checking |
| `pnpm test` | Run CLI unit tests (vitest) |
| `pnpm i18n:check` | Check source + target locales (exit code 1 when keys are missing) |
| `pnpm i18n:check:source` | Check the source locale only |
| `pnpm i18n:check:target` | Check target locales only |
| `pnpm i18n:fix` | Add source keys, add `⟦TODO⟧` placeholders, remove unused/extra keys |
| `pnpm i18n:trans` | Translate with an OpenAI-compatible LLM (requires `.env`) |
| `pnpm preview:vue` / `pnpm preview:react` | Preview the production build |

## CLI

`packages/i18n-trans` uses Babel to statically scan `t()` calls (TS/TSX and Vue SFC `<script>`
blocks / template expressions) and compares them with locale JSON. Scanning is framework-agnostic.
Both playgrounds use the same CLI configuration, and the root scripts run both of them.
See the [CLI README](packages/i18n-trans/README.md) ([中文](packages/i18n-trans/README.zh-CN.md))
for all options and configuration.

```bash
pnpm i18n:check          # source + targets
pnpm i18n:check:source   # source only
pnpm i18n:check:target   # targets only

pnpm i18n:fix            # check --add --add-target --remove
pnpm i18n:trans          # translate pending / placeholder keys (requires .env)
```

### Translation environment (.env)

`trans` reads OpenAI-compatible settings from each playground's `.env` (gitignored; templates:
[react/.env.example](playground/react/.env.example), [vue/.env.example](playground/vue/.env.example)):

```bash
I18N_LLM_BASE_URL=https://api.deepseek.com/v1
I18N_LLM_API_KEY=sk-...
I18N_LLM_MODEL=deepseek-chat
```

### Markers

| Marker | Written by | Meaning |
| --- | --- | --- |
| `⟦TODO⟧ source` | `i18n:fix --add-target` | key exists, no translation yet |
| `⟦REVIEW⟧ translation` | `i18n:trans` | AI translation waiting for human review |
| no marker | human / `trans --ignore` | confirmed translation |

To review, search the repository for `⟦REVIEW⟧` and remove the marker after checking; search for
`⟦TODO⟧` to see whether any translations are still missing. `trans` never re-translates `⟦REVIEW⟧`
values and never overwrites existing translations.

## `t()` contract

Applications implement `t()` themselves; it must satisfy:

```ts
type Translate = (
  source: SourceKey,
  options?: { __TRANS_ID?: string | number; [param: string]: unknown } | string | number,
) => string
```

- `t('删除', 'remove')` is equivalent to `t('删除', { __TRANS_ID: 'remove' })`;
- lookup order: target `删除__TRANS_ID_remove` → target `删除` → source `删除` → raw source text;
- the source locale returns the raw source text; interpolation supports `{name}` (vue-i18n) and
  `{{name}}` (i18next), and translations must preserve the same style; JSON is flat and
  `keySeparator` must be disabled;
- full contract and type template: [docs/i18n-contract.en.md](docs/i18n-contract.en.md);
  copy [docs/templates/translator.ts](docs/templates/translator.ts) directly if useful.

## playground/react reference implementation

[playground/react/src/i18n/index.ts](playground/react/src/i18n/index.ts) implements the contract
with i18next (language detection, persistence, `<html lang>` / `document.title` sync all live in the
app). It is an example only and is not published as an npm package.

It ships three locales: `zh-CN` (source), `en-US`, and `ja-JP`, and demonstrates:

- `t('删除', 'delete')` / `t('删除', { __TRANS_ID: 'remove' })` one-source-multiple-translations;
- `⟦TODO⟧` placeholders from `i18n:fix` and `⟦REVIEW⟧` markers from `i18n:trans`;
- language switching, localStorage persistence, and browser language detection.

## playground/vue reference implementation

[playground/vue/src/i18n/index.ts](playground/vue/src/i18n/index.ts) implements the same contract
with vue-i18n:

- source locale `zh-CN` uses the source text as keys; target locale is `en-US`;
- a custom `messageResolver` looks up whole keys (keys may contain `.` or `/`) and the app handles
  `__TRANS_ID` and fallback itself;
- vue-i18n's default single-brace `{name}` interpolation matches the CLI contract;
- the CLI scans `.vue` `<script setup>` blocks and template expressions (`{{ t(...) }}`,
  `:prop="t(...)"`);
- the page also demonstrates `t('删除', 'delete')` / `t('删除', 'remove')`.

Vue and React differ only in their runtime implementation (vue-i18n vs i18next); the locale data
format, markers, and CLI behavior are identical.

## Release

Only `@10coding/i18n-trans` is published to npm. See [.changeset/README.md](.changeset/README.md)
(Chinese) for the process:

1. run `pnpm changeset` locally to record the change;
2. run `pnpm changeset version` to update the version and CHANGELOG;
3. commit and open a PR to `master`;
4. after merging, [release.yml](.github/workflows/release.yml) compares the package version with
   npm latest: it only runs build/test/publish when there is an update; the `vX.Y.Z` tag and GitHub
   Release are ensured idempotently.

There is no `changeset-release/*` branch and no Version Packages PR; other branches trigger no
workflow.

## Adding a language / translation workflow

1. Create `src/locales/ja-JP.json` (an empty object is fine);
2. add it to `targetLocales` in `i18n.config.json` and to the app's locale list;
3. run `pnpm i18n:check:target` to see what is missing;
4. run `pnpm i18n:fix` to write `⟦TODO⟧ source` placeholders;
5. run `pnpm i18n:trans` to generate `⟦REVIEW⟧ translation` entries;
6. search for `⟦REVIEW⟧` in the editor and review manually;
7. `pnpm i18n:check` should pass.
