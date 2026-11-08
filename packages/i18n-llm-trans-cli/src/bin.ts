import { runCheck } from './check'
import type { CheckScope } from './types'

const HELP = `Usage: i18n-llm-trans check [options]

Scans static t() calls with Babel and compares them with the locale JSON files.

Options:
  --source      check the source locale only
  --target      check target locales only
  --add         add missing keys to the source locale (identity values)
  --add-target  add missing target keys using the source text as placeholder
  --remove      remove unused source keys and extra target keys
  -h, --help    show this help

Examples:
  i18n-llm-trans check
  i18n-llm-trans check --source
  i18n-llm-trans check --target --remove
  i18n-llm-trans check --add --add-target --remove
`

async function main(): Promise<number> {
  const args = process.argv.slice(2)

  if (args.includes('--help') || args.includes('-h')) {
    console.log(HELP)
    return 0
  }

  const [command, ...rest] = args
  if (command !== 'check') {
    console.error(`Unknown command: ${command ?? '(none)'}\n\n${HELP}`)
    return 2
  }

  let scope: CheckScope = 'all'
  let add = false
  let addTarget = false
  let remove = false

  for (const arg of rest) {
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

process.exitCode = await main()
