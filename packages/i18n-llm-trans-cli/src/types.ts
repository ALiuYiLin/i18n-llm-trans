export interface TransIdOptions {
  option?: string
  separator?: string
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
  /** Add missing keys to target locales, using the source text as a placeholder value. */
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
