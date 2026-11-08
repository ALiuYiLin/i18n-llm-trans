import { runCheck } from './check'
import { runTrans } from './trans/translate'
import type { CheckScope, TransOptions } from './types'

const HELP = `Usage: i18n-llm-trans <command> [options]

Commands:
  check   scan t() calls and compare them with the locale JSON files
  trans   translate untranslated target keys with an OpenAI-compatible LLM

check options:
  --source      check the source locale only
  --target      check target locales only
  --add         add missing keys to the source locale (identity values)
  --add-target  add missing target keys using marker placeholders
  --remove      remove unused source keys and extra target keys

trans options:
  --locale <locales>  comma separated target locales (default: all configured)
  --keys <keys>       comma separated resource keys
  --limit <n>         translate at most n units
  --dry-run           print units without calling the LLM
  --no-context        disable auto-collected code-context snippets
  --env-file <path>   custom .env path (default: ./.env)

Environment for trans:
  I18N_LLM_BASE_URL    OpenAI-compatible base URL, e.g. https://api.openai.com/v1
  I18N_LLM_API_KEY     API key (never committed)
  I18N_LLM_MODEL       model name
  optional: I18N_LLM_TIMEOUT_MS, I18N_LLM_MAX_RETRIES, I18N_LLM_JSON_MODE

Examples:
  i18n-llm-trans check
  i18n-llm-trans check --add --add-target --remove
  i18n-llm-trans trans --dry-run
  i18n-llm-trans trans --locale en-US
`

async function runCheckCommand(args: string[]): Promise<number> {
  let scope: CheckScope = 'all'
  let add = false
  let addTarget = false
  let remove = false

  for (const arg of args) {
    switch (arg) {
      case '--add':
        add = true
        break
      case '--add-target':
        addTarget = true
        break
      case '--remove':
        remove = true
        break
      case '--source':
        scope = scope === 'target' ? 'all' : 'source'
        break
      case '--target':
        scope = scope === 'source' ? 'all' : 'target'
        break
      default:
        console.error(`Unknown option: ${arg}\n\n${HELP}`)
        return 2
    }
  }

  if (add && scope === 'target') {
    console.error('--add only applies to the source locale; use --add-target for target placeholders')
    return 2
  }
  if (addTarget && scope === 'source') {
    console.error('--add-target only applies to target locales')
    return 2
  }

  try {
    const result = await runCheck({ cwd: process.cwd(), scope, add, addTarget, remove })
    return result.exitCode
  } catch (error) {
    console.error(`i18n check failed: ${(error as Error).message}`)
    return 2
  }
}

async function runTransCommand(args: string[]): Promise<number> {
  let locales: string[] | undefined
  let keys: string[] | undefined
  let limit: number | undefined
  let dryRun = false
  let useContext = true
  let envFile: string | undefined

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    switch (arg) {
      case '--locale': {
        const value = args[index + 1]
        if (!value) {
          console.error('--locale requires a value, e.g. --locale en-US')
          return 2
        }
        locales = value
          .split(',')
          .map((locale) => locale.trim())
          .filter(Boolean)
        index += 1
        break
      }
      case '--keys': {
        const value = args[index + 1]
        if (!value) {
          console.error('--keys requires a comma separated list of keys')
          return 2
        }
        keys = value
          .split(',')
          .map((key) => key.trim())
          .filter(Boolean)
        index += 1
        break
      }
      case '--limit': {
        const value = Number.parseInt(args[index + 1] ?? '', 10)
        if (!Number.isInteger(value) || value < 1) {
          console.error('--limit requires a positive integer')
          return 2
        }
        limit = value
        index += 1
        break
      }
      case '--dry-run':
        dryRun = true
        break
      case '--no-context':
        useContext = false
        break
      case '--env-file': {
        const value = args[index + 1]
        if (!value) {
          console.error('--env-file requires a path')
          return 2
        }
        envFile = value
        index += 1
        break
      }
      default:
        console.error(`Unknown option: ${arg}\n\n${HELP}`)
        return 2
    }
  }

  const options: TransOptions = {
    cwd: process.cwd(),
    locales,
    keys,
    limit,
    dryRun,
    useContext,
    envFile,
  }

  try {
    const result = await runTrans(options)
    return result.exitCode
  } catch (error) {
    console.error(`i18n trans failed: ${(error as Error).message}`)
    return 2
  }
}

async function main(): Promise<number> {
  const args = process.argv.slice(2)

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log(HELP)
    return 0
  }

  const [command, ...rest] = args

  switch (command) {
    case 'check':
      return runCheckCommand(rest)
    case 'trans':
      return runTransCommand(rest)
    default:
      console.error(`Unknown command: ${command}\n\n${HELP}`)
      return 2
  }
}

process.exitCode = await main()
