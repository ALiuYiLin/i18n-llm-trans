export interface TransIdOptions {
  option?: string
  separator?: string
}

export interface TranslationConfig {
  /** Prefix used for target-locale placeholder values, e.g. `⟦TODO⟧ 你好`. */
  placeholderMarker: string
  /** Maximum number of units sent to the model in one request. */
  batchSize: number
  /** Number of extra source lines included as translation context. */
  contextLines: number
  /** Manual per-key context, overrides the auto-collected code snippet. */
  hints: Record<string, string>
  /** Glossary passed to the model. */
  glossary: Record<string, string>
  /** Keys that are allowed to stay identical to the source text. */
  ignoreKeys: string[]
  /** Retry attempts per batch when the model returns invalid output. */
  maxRetries: number
  /** Ask the provider for `response_format: { type: 'json_object' }`. */
  jsonMode: boolean
}

export interface I18nConfig {
  /** Glob patterns of files to scan, relative to the working directory. */
  include: string[]
  /** Glob patterns to ignore. */
  exclude: string[]
  /** Directory that holds `<locale>.json` files, relative to the working directory. */
  localesDir: string
  /** Locale whose text is used as keys (e.g. `zh-CN`). */
  sourceLocale: string
  /** Target locales to check; defaults to every locale in `localesDir` except the source. */
  targetLocales?: string[]
  /** Function names treated as translation calls. */
  callers: string[]
  transId: Required<TransIdOptions>
  translation: TranslationConfig
}

export interface Usage {
  /** First argument of the `t()` call (the source text / key). */
  source: string
  /** `__TRANS_ID` values used with this source text. */
  transIds: string[]
  file: string
  line: number
}

export interface DynamicUsage {
  file: string
  line: number
  snippet: string
}

export interface ScanResult {
  usages: Usage[]
  dynamicUsages: DynamicUsage[]
  /** All static string literals found in the scanned files (used to avoid false "unused" reports). */
  literals: Set<string>
}

export interface MissingSourceKey {
  key: string
  file: string
  line: number
}

export interface SourceDiff {
  locale: string
  file: string
  missing: MissingSourceKey[]
  unused: string[]
}

export interface TargetDiff {
  locale: string
  file: string
  missing: string[]
  extra: string[]
}

export interface ApplyAction {
  file: string
  locale: string
  added: string[]
  removed: string[]
}

export type CheckScope = 'all' | 'source' | 'target'

export interface CheckOptions {
  cwd: string
  scope: CheckScope
  /** Add missing keys to the source locale (identity values). */
  add: boolean
  /** Add missing keys to target locales, using a marker placeholder value. */
  addTarget: boolean
  remove: boolean
  /** Skip console output (used by tests). */
  quiet?: boolean
}

export interface CheckResult {
  exitCode: number
  filesScanned: number
  staticKeys: number
  dynamicUsages: DynamicUsage[]
  source?: SourceDiff
  targets: TargetDiff[]
  actions: ApplyAction[]
}

export interface TranslationUnit {
  /** Resource key, e.g. `你好` or `删除__TRANS_ID_remove`. */
  key: string
  /** Source text that needs to be translated. */
  source: string
  /** `__TRANS_ID` value when this unit is a disambiguated variant. */
  transId?: string
  /** Auto-collected code snippet around the `t()` call. */
  context?: string
  /** Manual hint from `i18n.config.json`. */
  hint?: string
}

export interface TranslationRequest {
  sourceLocale: string
  targetLocale: string
  glossary: Record<string, string>
  units: TranslationUnit[]
}

export type TranslateBatch = (request: TranslationRequest) => Promise<Record<string, string>>

export interface LlmEnv {
  baseUrl: string
  apiKey: string
  model: string
  timeoutMs: number
  maxRetries: number
  jsonMode: boolean
}

export interface TransOptions {
  cwd: string
  /** Only translate these target locales. */
  locales?: string[]
  /** Only translate these resource keys. */
  keys?: string[]
  /** Stop after this many units (all locales combined). */
  limit?: number
  dryRun?: boolean
  /** Disable auto-collected code context. */
  useContext?: boolean
  /** Write translations without the review marker. */
  ignore?: boolean
  /** Custom `.env` file path. */
  envFile?: string
  quiet?: boolean
}

export interface TransDeps {
  /** Inject a batch translator (tests / custom providers). */
  translateBatch?: TranslateBatch
  /** Inject LLM connection settings instead of loading `.env`. */
  env?: LlmEnv
  maxRetries?: number
}

export interface TransResult {
  exitCode: number
  translated: number
  failed: number
  skipped: number
  dryRun: boolean
  check?: CheckResult
}
